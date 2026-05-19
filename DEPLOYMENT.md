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
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...:5432/postgres
DATABASE_URL_POOLER=postgresql://...:6543/postgres
GEMINI_API_KEY=AIza...
DEFAULT_USER_ID=<uuid del usuario creado en paso 1.4>
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
2. Railway detecta `railway.json` y crea 6 services:
   - `api`, `web`, `worker-scanner` (cron), `worker-evaluator`, `worker-pdfgen`, `worker-liveness` (cron)
3. Para cada service → Variables → setear las mismas del `.env` local (Railway tiene "shared variables" útil aquí).
4. El service `web` necesita además:
   ```
   NEXT_PUBLIC_API_URL=https://<api-service>.up.railway.app
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
5. Generar dominio público para `api` y `web`. (Settings → Networking → Generate Domain).

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
| Gemini 2.5 Pro evals | $3–8 (≈30 ofertas/día × 30K tokens) |
| Gemini 2.5 Flash filter | <$0.10 |
| **Total** | **~$10–20/mes** |
