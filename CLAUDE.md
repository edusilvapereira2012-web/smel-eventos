# SMEL-Plataforma de Eventos - CLAUDE.md

Diretrizes de desenvolvimento, comandos e regras de comunicação para o monorepo SMEL-Plataforma de Eventos. Referencie também a especificação completa em [SPEC.md](./SPEC.md) e o guia do desenvolvedor em [SKILL.md](./SKILL.md).

## 🚀 Comandos Úteis

### Workspace Root (pnpm + Turborepo)
* Instalação: `pnpm install`
* Modo Dev: `pnpm run dev` (inicia frontend + api + worker em watch)
* Build: `pnpm run build`
* Lint: `pnpm run lint`
* Testes: `pnpm run test`

### Docker Compose (Infraestrutura)
* Subir infra dev: `docker compose up -d`
* Derrubar infra: `docker compose down`
* Log de serviços: `docker compose logs -f [serviço]`
* Reconstruir e subir: `docker compose up --build -d`

### Prisma (Executar dentro de `apps/api`)
* Gerar Client: `pnpm prisma generate`
* Criar migration: `pnpm prisma migrate dev --name [nome]`
* Abrir Studio: `pnpm prisma studio`

---

## 🛠️ Stack Tecnológica & Arquitetura

### Frontend (`apps/frontend`)
* **Framework**: Next.js 14 (App Router) + TypeScript (`strict: true`).
* **Estilização & UI**: Tailwind CSS (Dark Mode com Glassmorphism) + Lucide Icons + shadcn/ui.
* **Recursos**: PWA (Service Worker para suporte e credenciamento offline com IndexedDB/Dexie.js), Socket.io Client para métricas de check-in ao vivo.
* **Padrão de Paginação**: Paginação por cursor padronizada no rodapé de tabelas (`Página X` no lado esquerdo, botões `< Anterior` e `Próximo >` no lado direito).

### Backend & API (`apps/api`)
* **Framework**: NestJS + TypeScript + Prisma ORM + PostgreSQL 16.
* **Fila & Cache**: Redis (Valkey 7) + BullMQ para envio assíncrono de e-mails, PDFs e notificações.
* **Segurança & LGPD**:
  - Criptografia simétrica `AES-256-GCM` para campos sensíveis (como CPF).
  - *Blind Index* (`HMAC-SHA256`) para prevenção determinística de duplicidade.
  - Validação estrita de variáveis de ambiente com Zod (`env.schema.ts` com `superRefine` bloqueando chaves padrão em `NODE_ENV=production`).
  - RBAC refinado por Tenant (`OWNER`, `ADMIN`, `ORGANIZER`, `CHECKER`, `MEMBER`, `SUPERADMIN`) + Logger não-bloqueante (`Pino`).
  - Rate Limiting contextual (`CustomThrottlerGuard`).

### Worker (`apps/worker`)
* Service worker NestJS isolado (sem servidor HTTP) para consumo exclusivo das filas do BullMQ.

### Infraestrutura & Deploy (`infra/`)
* Docker Compose (`docker-compose.prod.yml`) + Proxy Reverso Nginx + MinIO (S3 local).
* Script de deploy otimizado (`infra/deploy.sh`) compactando apenas código-fonte (~10 MB, excluindo `.turbo`, `dist`, `.next` e `node_modules`).
* Automação via pexpect em `infra/run_deploy.py` para deploy seguro na VPS de produção (`190.2.72.72`).

---

## 📝 Regras de Código (Karpathy & Estilo)

1. **Pense Antes de Codar**: Sem suposições ou complexidade oculta. Se houver dúvidas sobre regras de negócio, pare e valide.
2. **Simplicidade Primeiro**: Mínimo de código para resolver o problema. Sem abstrações precoces ou configurabilidade não solicitada.
3. **Mudanças Cirúrgicas**: Altere apenas o necessário. Siga estritamente o estilo de código existente no arquivo/pasta.
4. **Foco em Metas**: Defina critérios de sucesso e valide a cada passo.
5. **Tipagem Estrita**: TypeScript com `strict: true`. Evite `any`.
6. **Segurança**: Sem segredos hardcoded. Sempre use `process.env` validado com Zod.
7. **Padrão de Paginação**: Sempre utilize a paginação padronizada no rodapé com indicador `Página X` e controles `< Anterior` / `Próximo >`.

---

## 🗣️ Diretrizes de Comunicação (Caveman Mode)

* **Respostas ultra-concisas**: Apenas o código, comandos e explicações em tópicos fragmentados.
* **Sem enrolação/fillers**: Evite introduções ("Certamente...", "Aqui está...", "Com base em...") e conclusões educadas.
* **Direto ao ponto**: Vá direto ao arquivo e ao código modificado.

