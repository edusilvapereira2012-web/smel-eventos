FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Copiar arquivos de definição de workspace do monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/frontend/package.json ./apps/frontend/package.json

# Target de Desenvolvimento
FROM base AS dev
COPY apps/frontend ./apps/frontend
RUN pnpm install
CMD ["pnpm", "--filter", "frontend", "run", "dev"]

# Build de Produção
FROM base AS build
COPY apps/frontend ./apps/frontend
RUN pnpm install --frozen-lockfile
RUN pnpm --filter frontend run build

# Target de Produção
FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=build --chown=node:node /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build --chown=node:node /app/apps/frontend/public ./apps/frontend/public
COPY --from=build --chown=node:node /app/apps/frontend/package.json ./apps/frontend/package.json
EXPOSE 3000
WORKDIR /app/apps/frontend
USER node
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
