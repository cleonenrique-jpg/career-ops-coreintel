import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { type ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { db, evaluationRuns } from '@career-ops/db';

type Provider = 'gemini' | 'groq';
const PROVIDER: Provider = (process.env.LLM_PROVIDER as Provider) || 'gemini';

// --- Provider-specific clients (lazy) ---

let geminiClient: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set (LLM_PROVIDER=gemini)');
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set (LLM_PROVIDER=groq)');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// --- Pricing (USD per 1M tokens). 0 means free tier; update for paid plans. ---

const PRICING: Record<string, { input: number; output: number }> = {
  // Gemini
  'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
  'gemini-2.5-flash':      { input: 0.075, output: 0.30 },
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash':      { input: 0.10,  output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  // Groq (developer tier; free tier = $0 actual cost but we track for visibility)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant':    { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768':      { input: 0.24, output: 0.24 },
};

// --- Model resolver ---

/**
 * Resolves the model name for a given tier based on the active provider.
 * Callers use this instead of reading env vars directly, so switching
 * provider via LLM_PROVIDER doesn't require touching every callsite.
 */
export function pickModel(tier: 'pro' | 'flash'): string {
  if (PROVIDER === 'groq') {
    if (tier === 'pro') return process.env.GROQ_MODEL_PRO ?? 'llama-3.3-70b-versatile';
    return process.env.GROQ_MODEL_FLASH ?? 'llama-3.1-8b-instant';
  }
  if (tier === 'pro') return process.env.GEMINI_MODEL_PRO ?? 'gemini-2.5-pro';
  return process.env.GEMINI_MODEL_FLASH ?? 'gemini-2.5-flash';
}

export function activeProvider(): Provider {
  return PROVIDER;
}

// --- Shared types ---

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

// --- Provider implementations ---

async function callViaGemini<T>(opts: CallOptions): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const { model: modelName, systemPrompt, userPrompt, schema, temperature = 0.2 } = opts;
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  const model = getGemini().getGenerativeModel({
    model: modelName,
    systemInstruction: `${systemPrompt}\n\nResponde SIEMPRE con JSON válido que cumpla este schema:\n\`\`\`json\n${JSON.stringify(jsonSchema, null, 2)}\n\`\`\``,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    } as GenerationConfig,
  });

  const res = await model.generateContent(userPrompt);
  const text = res.response.text();
  const usage = res.response.usageMetadata;
  const json = JSON.parse(text);
  const parsed = schema.parse(json) as T;
  return {
    data: parsed,
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

async function callViaGroq<T>(opts: CallOptions): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const { model: modelName, systemPrompt, userPrompt, schema, temperature = 0.2 } = opts;
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: modelName,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nResponde SIEMPRE con un único JSON válido que cumpla este schema:\n\`\`\`json\n${JSON.stringify(jsonSchema, null, 2)}\n\`\`\``,
      },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty content');
  const json = JSON.parse(text);
  const parsed = schema.parse(json) as T;
  return {
    data: parsed,
    inputTokens: res.usage?.prompt_tokens ?? 0,
    outputTokens: res.usage?.completion_tokens ?? 0,
  };
}

// --- Public router ---

export async function callGemini<T>(opts: CallOptions): Promise<CallResult<T>> {
  const { model: modelName, promptVersion, userId, pipelineUrlId = null, applicationId = null } = opts;

  let inputTokens = 0;
  let outputTokens = 0;
  let parsed: T | undefined;
  let success = true;
  let errorMessage: string | null = null;

  try {
    const impl = PROVIDER === 'groq' ? callViaGroq<T> : callViaGemini<T>;
    const out = await impl(opts);
    parsed = out.data;
    inputTokens = out.inputTokens;
    outputTokens = out.outputTokens;
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
    throw new Error(`LLM call failed (provider=${PROVIDER}, run ${run?.id ?? 'unknown'}): ${errorMessage ?? 'no output'}`);
  }

  return {
    data: parsed,
    usage: { inputTokens, outputTokens, costUsd },
    runId: run?.id ?? '',
  };
}
