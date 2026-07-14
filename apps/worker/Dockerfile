FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache openssl
WORKDIR /app

# Copiar arquivos de definição de workspace do monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/api/package.json ./apps/api/package.json

# Target de Desenvolvimento
FROM base AS dev
COPY apps/worker ./apps/worker
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install
RUN pnpm --filter worker exec prisma generate --schema=../../apps/api/prisma/schema.prisma
CMD ["pnpm", "--filter", "worker", "run", "start:dev"]

# Build de Produção
FROM base AS build
COPY apps/worker ./apps/worker
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker exec prisma generate --schema=../../apps/api/prisma/schema.prisma
RUN pnpm --filter worker run build

# Target de Produção
FROM base AS prod
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=node:node /app/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=node:node /app/apps/worker/package.json ./apps/worker/package.json
USER node
CMD ["node", "apps/worker/dist/main"]
