import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { applicationsRoute } from './routes/applications.js';
import { pipelineRoute } from './routes/pipeline.js';
import { profileRoute } from './routes/profile.js';
import { scanRoute } from './routes/scan.js';
import { metricsRoute } from './routes/metrics.js';

const app = new Hono();
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.route('/api/applications', applicationsRoute);
app.route('/api/pipeline', pipelineRoute);
app.route('/api/profile', profileRoute);
app.route('/api/scan', scanRoute);
app.route('/api/metrics', metricsRoute);

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
