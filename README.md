# SMEL-Plataforma de Eventos — Plataforma SaaS Multi-Tenant

SMEL-Plataforma de Eventos é uma plataforma SaaS multi-tenant robusta para gerenciamento completo de eventos corporativos, acadêmicos e sociais. O sistema conta com processamento assíncrono em segundo plano (BullMQ), armazenamento seguro de arquivos em S3 local (MinIO), atualizações instantâneas via WebSockets, geração e autenticação de ingressos/certificados, e total conformidade com a LGPD.

---

## 📖 Guias Rápidos de Consulta

* **[Especificações Técnicas (SPEC.md)](./SPEC.md)**: Detalhamento completo da arquitetura, do schema do banco de dados, dos fluxos de segurança e das regras de negócio de todas as levas.
* **[Manual Operacional (SKILL.md)](./SKILL.md)**: Guia prático de comandos, migrações, scripts de manutenção, qualidade de código e execução de testes.

---

## 🚀 Como Iniciar (Setup Rápido)

### Pré-requisitos
* **Node.js** >= 20.x
* **pnpm** >= 9.x
* **Docker** & **Docker Compose**

### Passos para Rodar Localmente

1. **Clonar o Repositório**:
   ```bash
   git clone <repo-url> smel-plataforma-eventos
   cd smel-plataforma-eventos
   ```

2. **Configurar as Variáveis de Ambiente**:
   ```bash
   cp .env.example .env
   ```
   *(Ajuste as chaves secretas no arquivo `.env` de acordo com as necessidades do seu ambiente).*

3. **Subir a Infraestrutura Base e Serviços (Docker)**:
   ```bash
   docker compose up -d --build
   ```
   *Este comando compila e inicializa os seguintes contêineres:*
   * **PostgreSQL** (Porta 5432) — Banco relacional.
   * **Redis (Valkey)** (Porta 6379) — Cache de leituras, armazenamento de sessões e filas BullMQ.
   * **MinIO Object Storage** (API: 9000, Console: 9001) — Armazenamento de banners e PDFs de certificados.
   * **NestJS API** (Porta 3001) — Servidor principal da API.
   * **Next.js Frontend (PWA)** (Porta 3000) — Interface do usuário.
   * **NestJS Worker** — Processamento em background de e-mails e PDFs.
   * **Nginx Proxy Reverso** (Porta 80) — Roteamento central das conexões.

4. **Executar em Modo de Desenvolvimento (Watch Mode)**:
   Caso prefira rodar os aplicativos fora do Docker localmente para desenvolvimento:
   ```bash
   pnpm install
   pnpm run dev
   ```

---

## 📂 Estrutura de Diretórios

```text
smel-plataforma-eventos/
├── apps/
│   ├── frontend/        ← Next.js 14 + TypeScript + Tailwind CSS (PWA)
│   ├── api/             ← NestJS API + Prisma + PostgreSQL + Redis
│   └── worker/          ← NestJS worker isolado para processamento de filas BullMQ
├── packages/
│   ├── ui/              ← Componentes UI compartilhados (Design System)
│   ├── shared/          ← Helper functions e constantes comuns
│   └── types/           ← Definição de tipos TypeScript comuns
├── infra/
│   ├── nginx/           ← Configuração do Proxy Reverso
│   └── k6/              ← Scripts para teste de estresse
├── docker-compose.yml
├── docker-compose.prod.yml
├── ecosystem.config.js  ← Arquivo de clustering PM2 para produção
└── package.json
```

---

## 🛠️ Comandos de Qualidade e Operação

* **Instalar Dependências**: `pnpm install`
* **Iniciar Workspace**: `pnpm run dev`
* **Compilar Aplicações (Build)**: `pnpm run build`
* **Executar Suíte de Testes**: `pnpm run test`
* **Linter de Código**: `pnpm run lint`
* **Execução em Produção via PM2**: `pm2 start ecosystem.config.js`

---

## 🌐 Endereços de Acesso Local

* **Frontend Principal**: [http://localhost](http://localhost)
* **Documentação Swagger (API)**: [http://localhost/api/docs](http://localhost/api/docs)
* **Painel Administrativo MinIO**: [http://localhost:9001](http://localhost:9001) (usuário: `minio_admin`, senha: `minio_secret_key_123`)
* **Painel de Emails Transacionais (Frontend)**: [http://localhost/admin/email/logs](http://localhost/admin/email/logs)
