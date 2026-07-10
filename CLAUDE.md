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

## 🛠️ Stack Tecnológica

* **Monorepo**: pnpm Workspaces + Turborepo
* **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui
* **API / Backend**: NestJS + Prisma + PostgreSQL + Redis (Valkey)
* **Worker**: NestJS (isolado para BullMQ, sem servidor HTTP)
* **Infra**: Docker, NGINX (Proxy Reverso), MinIO (S3 local)

---

## 📝 Regras de Código (Karpathy & Estilo)

1. **Pense Antes de Codar**: Sem suposições ou complexidade oculta. Se houver dúvidas sobre regras de negócio, pare e valide.
2. **Simplicidade Primeiro**: Mínimo de código para resolver o problema. Sem abstrações precoces ou configurabilidade não solicitada.
3. **Mudanças Cirúrgicas**: Altere apenas o necessário. Siga estritamente o estilo de código existente no arquivo/pasta.
4. **Foco em Metas**: Defina critérios de sucesso e valide a cada passo.
5. **Tipagem Estrita**: TypeScript com `strict: true`. Evite `any`.
6. **Segurança**: Sem segredos hardcoded. Sempre use `process.env` validado com Zod.

---

## 🗣️ Diretrizes de Comunicação (Caveman Mode)

* **Respostas ultra-concisas**: Apenas o código, comandos e explicações em tópicos fragmentados.
* **Sem enrolação/fillers**: Evite introduções ("Certamente...", "Aqui está...", "Com base em...") e conclusões educadas.
* **Direto ao ponto**: Vá direto ao arquivo e ao código modificado.
