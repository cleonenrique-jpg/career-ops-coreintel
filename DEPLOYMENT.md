# Deployment — Railway + Supabase

Pasos concretos para llevar `career-ops-cloud` a producción.

## 0. Pre-requisitos

- Cuenta Supabase (free tier ok para arrancar).
- Cuenta Railway (Hobby plan recomendado, ~$5/mes).
- API key de Google Gemini ([AI Studio](https://aistudio.google.com/app/apikey)).
- Repo `career-ops` legacy clonado en local con `cv.md`, `data/`, `portals.yml` poblados (fuente de la migración).

## 1. Supabase

1. Crear proyecto nuevo. Anotá `Project URL`, `anon key`, `service role key`.
2. Project Settings → Database → Connection string → copiar Direct (port 5432) **y** Pooler (port 6543).
3. SQL editor → ejecutar en orden:
   - `supabase/migrations/20260518000001_init.sql`
   - `supabase/migrations/20260518000002_storage.sql`
4. Auth → Users → "Add user" → crear el usuario único (vos). Copiá su `id` UUID — ése es el `DEFAULT_USER_ID`.
5. (Opcional) Authentication → URL Configuration → agregar tu dominio Railway al allowlist.

## 2. Variables de entorno

Copiá `.env.example` → `.env` y completá:

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...:5432/postgres
DATABASE_URL_POOLER=postgresql://...:6543/postgres
DEFAULT_USER_ID=<uuid del usuario creado en paso 1.4>
STORAGE_BUCKET=career-ops

# LLM provider — 'groq' (recommended free tier) or 'gemini'
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL_PRO=llama-3.3-70b-versatile
GROQ_MODEL_FLASH=llama-3.1-8b-instant

# Optional: Gemini fallback (used if LLM_PROVIDER=gemini)
GEMINI_API_KEY=AIza...
GEMINI_MODEL_PRO=gemini-2.0-flash
GEMINI_MODEL_FLASH=gemini-2.0-flash-lite

# Scheduler / scan tuning (defaults work for personal use)
SCAN_CRON=0 */4 * * *
FOLLOWUP_CHECK_CRON=0 13 * * *
AUTO_EVAL_NEW=true
SCAN_LIVENESS_CHECK=true
SCAN_LIVENESS_CONCURRENCY=3

# Web — at build time, Next.js bakes the NEXT_PUBLIC_* in
NEXT_PUBLIC_API_URL=https://<your-api-service>.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Local migration only
LEGACY_REPO_PATH=../career-ops
```

## 3. Local — migrar datos

```bash
pnpm install
pnpm --filter @career-ops/shared build
pnpm --filter @career-ops/db build
pnpm migrate:from-md
```

Verificá en Supabase Studio:
```sql
select count(*) from applications;            -- = 5
select count(*) from pipeline_urls where status='pending'; -- ≈ 126
select count(*) from reports;                  -- = 1 (sólo 001 existe en md actualmente)
select count(*) from portals_config;
select * from profiles;
select * from cvs where is_active;
```

## 4. Railway

1. New Project → "Deploy from GitHub repo" → seleccioná `career-ops-cloud`.
2. Railway detecta `railway.json` y crea 8 services:
   - `api` — Hono REST API
   - `web` — Next.js dashboard
   - `worker-evaluator` — consume `evaluate-pipeline-url` queue (Groq calls)
   - `worker-pdfgen` — legacy CV PDF generator (kept for backward compat)
   - `worker-interview-prep` — generates playbook .docx
   - `worker-tailor-cv` — generates JD-tailored CV .docx
   - `worker-scheduler` — cron in-process; runs scanner every 4h + queues evaluator
   - `worker-liveness` — Railway cron (daily 09:00 UTC) — re-checks pending URLs
3. Para cada service → Variables → setear las del `.env` local. Railway recomienda usar "shared variables" (un set centralizado) y luego "referenciar" desde cada service. Mínimo necesario por service:

   | Service                  | Variables relevantes                                                                                                                  |
   |--------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
   | `api`                    | DATABASE_URL_POOLER, SUPABASE_* (incluyendo SERVICE_ROLE), DEFAULT_USER_ID, API_PORT                                                   |
   | `web`                    | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (estos se bakean en build → tienen que estar antes del deploy) |
   | `worker-*`               | DATABASE_URL_POOLER, SUPABASE_*, DEFAULT_USER_ID, LLM_PROVIDER, GROQ_API_KEY, GROQ_MODEL_PRO, GROQ_MODEL_FLASH, STORAGE_BUCKET         |
   | `worker-scheduler`       | Lo anterior + SCAN_CRON, FOLLOWUP_CHECK_CRON, AUTO_EVAL_NEW, SCAN_LIVENESS_CHECK                                                      |
   | `worker-evaluator`/etc.  | Lo anterior — los workers comparten Dockerfile pero corren scripts distintos                                                          |

4. Generar dominio público para `api` y `web`. (Service → Settings → Networking → Generate Domain).
5. **CRÍTICO**: setear `NEXT_PUBLIC_API_URL` en el service `web` apuntando al dominio del service `api` antes del primer build, o el dashboard no podrá hablar con el API.

## 5. Verificación end-to-end

1. `curl https://<api>.up.railway.app/health` → `{ "ok": true }`.
2. Abrir `https://<web>.up.railway.app/` → dashboard con counts correctos.
3. `/pipeline` → seleccionar la oferta de Foundever → "Evaluar" → verificar logs del worker-evaluator.
4. En `<5 min`:
   - row nuevo en `applications`,
   - row en `reports` con `content_md`,
   - row en `evaluation_runs` con `cost_usd > 0`,
   - si decisión = apply: row en `applications.pdf_url` con URL de Supabase Storage.
5. Worker scanner: Railway → service worker-scanner → "Run now" → ver logs.

## 6. Multi-tenant cuando quieras abrir signup

- En Supabase → Authentication → Providers → habilitar Email/OTP signups.
- Borrar la variable `DEFAULT_USER_ID` en los services `api` y `web` (mantenerla en los workers — siguen siendo single-tenant hasta migrar workers a per-user cron).
- Revisar RLS: ya está activa por user_id. Nuevo signup → cada usuario solo ve sus filas.
- Para workers per-user: convertir cada cron en un job que itera `select distinct user_id from profiles` y procesa cada uno.

## 7. Costos esperados (mes, single-user)

| Servicio | Estimado |
|----------|----------|
| Supabase Free | $0 (límite 500MB DB, 1GB storage) |
| Railway Hobby | $5–10 |
| Groq Llama 3.3 70B (free tier) | $0 (500k tokens/día — alcanza para uso personal) |
| Groq paid (si excedés free tier) | $1–3 (~$0.59/M input + $0.79/M output) |
| **Total estimado** | **~$5–13/mes** |

### Notas

- El free tier de Groq (`llama-3.3-70b-versatile`) cubre fácilmente uso personal de 1 usuario.
- Si necesitás más volumen o querés comparar con Gemini, cambiá `LLM_PROVIDER=gemini` (sin redeploy).
- Los workers Playwright (Procomer/CINDE/LinkedIn/Talent/Computrabajo) consumen ~512MB RAM cada uno. En Railway Hobby ($5 plan), conviene tener solo el `worker-scheduler` corriendo el scrape — los demás workers son livianos (queue consumers).
