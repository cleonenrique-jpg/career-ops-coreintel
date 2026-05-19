import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';
import { type ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { db, evaluationRuns } from '@career-ops/db';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[gemini] GEMINI_API_KEY not set — calls will fail until configured.');
}

const genAI = new GoogleGenerativeAI(apiKey ?? '');

// Approximate pricing (USD per 1M tokens). Update when Google changes them.
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
  'gemini-2.5-flash':      { input: 0.075, output: 0.30 },
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash':      { input: 0.10,  output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
};

export interface CallOptions {
  model: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodTypeAny;
  userId: string;
  pipelineUrlId?: string | null;
  applicationId?: string | null;
  temperature?: number;
}

export interface CallResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  runId: string;
}

export async function callGemini<T>(opts: CallOptions): Promise<CallResult<T>> {
  const {
    model: modelName, promptVersion, systemPrompt, userPrompt, schema, userId,
    pipelineUrlId = null, applicationId = null, temperature = 0.2,
  } = opts;

  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: `${systemPrompt}\n\nResponde SIEMPRE con JSON válido que cumpla este schema:\n\`\`\`json\n${JSON.stringify(jsonSchema, null, 2)}\n\`\`\``,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    } as GenerationConfig,
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let parsed: T | undefined;
  let success = true;
  let errorMessage: string | null = null;

  try {
    const res = await model.generateContent(userPrompt);
    const text = res.response.text();
    const usage = res.response.usageMetadata;
    inputTokens = usage?.promptTokenCount ?? 0;
    outputTokens = usage?.candidatesTokenCount ?? 0;

    const json = JSON.parse(text);
    parsed = schema.parse(json) as T;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const price = PRICING[modelName] ?? { input: 0, output: 0 };
  const costUsd = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;

  const [run] = await db.insert(evaluationRuns).values({
    userId,
    pipelineUrlId,
    applicationId,
    model: modelName,
    promptVersion,
    inputTokens,
    outputTokens,
    costUsd: costUsd.toFixed(6),
    success,
    errorMessage,
  }).returning({ id: evaluationRuns.id });

  if (!success || parsed === undefined) {
    throw new Error(`Gemini call failed (run ${run?.id ?? 'unknown'}): ${errorMessage ?? 'no output'}`);
  }

  return {
    data: parsed,
    usage: { inputTokens, outputTokens, costUsd },
    runId: run?.id ?? '',
  };
}
