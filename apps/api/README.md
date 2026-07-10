# SMEL-Plataforma de Eventos — API REST (NestJS Microservice)

Esta é a API central do ecossistema SMEL-Plataforma de Eventos, desenvolvida com o framework **NestJS**, utilizando **Prisma ORM** para comunicação com o PostgreSQL, **Redis (Valkey)** para cache e rate limiting, e **Socket.io** para WebSockets em tempo real.

---

## 🛠️ Stack Tecnológica

* **Framework**: NestJS
* **ORM**: Prisma (PostgreSQL)
* **Caching & Session Storage**: Redis / Valkey
* **Real-time Gateway**: Socket.io (Namespaces dinâmicos por inquilino)
* **Auditoria**: AuditLog integrado por Interceptores globais
* **Segurança**: Rate limiting com `@nestjs/throttler` (Redis Storage), CORS dinâmico e `helmet` middleware.

---

## 📂 Organização de Diretórios

```text
apps/api/
├── src/
│   ├── config/          ← Esquema de validação de ambiente (Zod)
│   ├── common/          ← Guardas, interceptores, filtros e middlewares comuns (RBAC, Tenancy, Logs)
│   ├── gateways/        ← Gateways WebSocket genéricos
│   ├── modules/         ← Módulos de domínio da API (Auth, Events, CheckIn, Registrations, etc.)
│   ├── main.ts          ← Bootstrapper do servidor NestJS
│   └── app.module.ts    ← Módulo raiz importando todas as dependências
├── test/                ← Testes de integração End-to-End (e2e)
├── Dockerfile           ← Dockerfile multi-stage configurado para usuário non-root
└── package.json
```

---

## 🚀 Comandos de Desenvolvimento

```bash
# Instalar dependências (executar no root ou filter)
pnpm install

# Rodar em watch mode localmente
pnpm run start:dev

# Rodar testes unitários do módulo
pnpm run test

# Rodar testes de integração e2e
pnpm run test:e2e
```

## 🔒 Variáveis de Ambiente Necessárias (.env)
A API exige as seguintes chaves de configuração no arquivo `.env`:
* `DATABASE_URL`: String de conexão com o PostgreSQL.
* `REDIS_URL`: URI de conexão com o Valkey/Redis.
* `JWT_SECRET` & `JWT_REFRESH_SECRET`: Chaves secretas para assinatura de tokens.
* `QR_SECRET`: Segredo de assinatura criptográfica simétrica dos ingressos.
* `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`: Configurações de conexão com o S3 local.
