# Guia Operacional do Desenvolvedor (SKILL.md)

Este arquivo serve como manual operacional (Runbook / Skill) para desenvolvedores e agentes trabalhando no ecossistema do **SMEL-Plataforma de Eventos**. Ele contém fluxos de trabalho práticos, comandos recomendados, políticas de testes e rotinas de manutenção.

---

## 🛠️ 1. Ambiente de Desenvolvimento

### 1.1. Configuração Inicial do Workspace
Para inicializar o projeto localmente com as dependências corretas:
```bash
pnpm install
```

### 1.2. Gerenciando Contêineres de Infraestrutura (Local)
Para subir o banco de dados PostgreSQL, o Redis (Valkey), o MinIO e as dependências da aplicação usando Docker Compose:
```bash
# Iniciar infra local em segundo plano
docker compose up -d

# Visualizar logs em tempo real
docker compose logs -f

# Parar os serviços preservando os volumes
docker compose down

# Recriar os contêineres forçando rebuild
docker compose up --build -d
```

### 1.3. Migrações e Schema Prisma
Toda alteração de banco de dados deve ser declarada no schema Prisma e executada a migration correspondente:
```bash
# Gerar novos typings do Prisma Client (dentro de apps/api ou root)
pnpm --filter api exec prisma generate

# Criar e rodar uma migração de banco local
pnpm --filter api exec prisma migrate dev --name <nome_da_migracao>

# Acessar a interface visual do banco (Studio)
pnpm --filter api exec prisma studio
```

### 1.4. Scripts de Migração de Dados (CPF & Blind Index)
Para backfill de registros legados de CPF e rotação de chaves de criptografia:
```bash
# Executar localmente
pnpm --filter api run ts-node apps/api/src/scripts/migrate-cpf-hash.js

# Executar no ambiente de produção (dentro do contêiner da API na VPS)
sudo docker compose -f docker-compose.prod.yml exec -T api node apps/api/src/scripts/migrate-cpf-hash.js
```

---

## 🧪 2. Protocolo de Testes e Qualidade

O projeto utiliza **Jest** para testes unitários no backend. Todos os commits e pull requests passam por validação CI de testes globais.

### 2.1. Execução de Testes
```bash
# Rodar todos os testes do monorepo (Turborepo)
pnpm run test

# Executar testes unitários de forma interativa (API)
pnpm --filter api run test:watch

# Rodar os testes de integração e-to-e (API)
pnpm --filter api run test:e2e
```

### 2.2. Regras de Escrita de Testes
- **Mocks Limpos**: Mocker dependências pesadas de infraestrutura (como `RedisService`, `EmailService` e `UploadService`).
- **Isolamento**: Cada caso de teste (`spec.ts`) deve ser executado de forma limpa sem poluir o banco ou arquivos locais do ambiente.
- **Race Conditions**: Ao testar concorrência, utilize scripts que lancem promessas simultâneas (como em `registrations.service.spec.ts`) para validar travas de transação (`SELECT FOR UPDATE`).

---

## 🚀 3. Processo de Produção e Hardening

### 3.1. Orquestração Local com PM2
Em ambientes de staging ou VPS que não utilizam orquestração direta por Docker, a aplicação é iniciada usando o PM2 configurado em `ecosystem.config.js`:
```bash
# Iniciar a API em modo cluster e o Worker em modo fork
pm2 start ecosystem.config.js

# Listar processos ativos
pm2 list

# Visualizar logs do PM2
pm2 logs

# Parar e reiniciar instâncias
pm2 reload all
pm2 delete all
```

### 3.2. Configurações do Nginx
O proxy reverso no Nginx redireciona as conexões externas para os serviços internos corretos:
- `/api/*` redirecionado para a API NestJS (`http://api:3001`).
- `/*` redirecionado para o servidor Next.js (`http://frontend:3000`).

### 3.4. Execução de Deploy Automatizado na VPS
Para atualizar o ambiente de produção na VPS (`administrator@190.2.72.72`) de forma automática:
```bash
# Executa o script de deploy automatizado com pexpect
python3 infra/run_deploy.py
```
*Este comando gera um pacote ultraleve (~10 MB), envia para o servidor via SCP, reconstrói os contêineres Docker e roda as migrações Prisma.*

### 3.5. Padronização de Componentes de Interface (UI)
- **Paginação de Tabelas**: Todas as listas paginadas (Inscrições, Certificados, Logs de E-mail) devem obrigatoriamente utilizar o rodapé com o indicador **`Página X`** no lado esquerdo e os botões estilizados **`< Anterior`** e **`Próximo >`** no lado direito.

### 3.6. Backup e Manutenção do Banco
O script de backup de banco de dados e arquivos MinIO está implementado no repositório. Para executar backups manuais:
```bash
# Executar script de backup do banco e do S3
chmod +x infra/backup.sh
./infra/backup.sh
```

---

## 🧹 4. Rotinas e Políticas LGPD

### 4.1. Limpeza de Logs (Data Retention Policy)
A limpeza automática de registros de e-mail e logs de auditoria antigos é disparada via agendador semanal. Para depurar ou executar manualmente a limpeza:
```bash
# A API NestJS executa crons de limpeza automáticos no boot
# Verifique o módulo `JobsModule` e o serviço `RetentionService` para detalhes de depuração.
```

### 4.2. Fluxo de Direito ao Esquecimento
Ao processar uma solicitação de exclusão de dados de usuário (`DELETE /api/auth/me`):
1. Confirme que todos os campos de identificação pessoal (Nome, E-mail, CPF, Telefone) foram anonimizados no banco.
2. Certifique-se de que os logs de auditoria históricos não contenham o IP e o User-Agent associados àquele usuário.
3. Exclua quaisquer arquivos de assinatura digital ou personalizados pertencentes à organização caso a organização inteira seja removida.

---

## 🛡️ 5. Gestão de Superadmin e Cache de Desenvolvimento

### 5.1. Verificação do Painel Superadmin
*   Para testar acessos e regras do painel administrativo global, autentique-se com o e-mail: `valterpcjr@gmail.com`.
*   Qualquer outra conta deve ser testada para certificar-se de que recebe `403 Forbidden` nas rotas do painel.

### 5.2. Recuperando o Cache do Next.js (Módulos não encontrados)
*   **Problema**: Se você rodar o build de produção (`pnpm build`) enquanto o servidor de desenvolvimento (`pnpm dev`) estiver em execução, o compilador do Next.js pode misturar arquivos estáticos de chunks Webpack, gerando erros HTTP 500 (`Cannot find module './xxx.js'`) e páginas em branco.
*   **Solução**: 
    1. Pare o processo local ativo (`Ctrl+C`).
    2. Limpe a pasta cache de compilação:
       ```bash
       rm -rf apps/frontend/.next
       ```
    3. Reinicie o servidor de desenvolvimento:
       ```bash
       pnpm dev
       ```

