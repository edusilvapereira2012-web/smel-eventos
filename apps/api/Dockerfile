FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache openssl
WORKDIR /app

# Copiar arquivos de definição de workspace do monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/package.json

# Target de Desenvolvimento
FROM base AS dev
COPY apps/api ./apps/api
RUN pnpm install
RUN pnpm --filter api exec prisma generate
CMD ["pnpm", "--filter", "api", "run", "start:dev"]

# Build de Produção
FROM base AS build
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api run build

# Target de Produção
FROM base AS prod
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main"]
