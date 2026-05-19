FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/workers/package.json apps/workers/
COPY packages/db/package.json packages/db/
COPY packages/gemini/package.json packages/gemini/
COPY packages/scan-core/package.json packages/scan-core/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @career-ops/shared build && \
    pnpm --filter @career-ops/db build && \
    pnpm --filter @career-ops/scan-core build && \
    pnpm --filter @career-ops/gemini build && \
    pnpm --filter @career-ops/workers build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/workers/dist ./apps/workers/dist
COPY --from=build /app/apps/workers/package.json ./apps/workers/
COPY --from=build /app/packages ./packages
COPY --from=build /app/templates ./templates
CMD ["node", "apps/workers/dist/evaluator.js"]
