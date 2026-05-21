FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS base
RUN npm install -g pnpm@10.15.1
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/workers/package.json apps/workers/
COPY packages/db/package.json packages/db/
COPY packages/gemini/package.json packages/gemini/
COPY packages/scan-core/package.json packages/scan-core/
COPY packages/scan-listings/package.json packages/scan-listings/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @career-ops/shared build && \
    pnpm --filter @career-ops/db build && \
    pnpm --filter @career-ops/scan-core build && \
    pnpm --filter @career-ops/scan-listings build && \
    pnpm --filter @career-ops/gemini build && \
    pnpm --filter @career-ops/workers build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/workers/dist ./apps/workers/dist
COPY --from=build /app/apps/workers/node_modules ./apps/workers/node_modules
COPY --from=build /app/apps/workers/package.json ./apps/workers/
COPY --from=build /app/packages ./packages
COPY --from=build /app/templates ./templates
# Default command (overridden per service in railway.json)
CMD ["node", "apps/workers/dist/evaluator.js"]
