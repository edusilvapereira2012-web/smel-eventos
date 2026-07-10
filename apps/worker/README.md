# SMEL-Plataforma de Eventos — Worker (Fila Assíncrona NestJS)

Este é o microserviço isolado do **SMEL-Plataforma de Eventos** encarregado do processamento assíncrono de tarefas em background. O worker não expõe nenhuma porta HTTP pública e consome tarefas enfileiradas na infraestrutura Redis/Valkey usando **BullMQ**.

---

## 🛠️ Stack Tecnológica

* **Framework**: NestJS (App sem servidor HTTP, escuta apenas eventos/filas)
* **Fila de Mensagens**: BullMQ (Redis Storage)
* **PDF Engine**: `pdf-lib` (para geração do certificado e assinaturas digitais)
* **E-mail client**: Nodemailer (SMTP)

---

## 📂 Filas Processadas

1. **`email`**:
   * Processa disparos de e-mails transacionais (como códigos de check-in, confirmações, avisos de fila de espera).
   * Política de retry automática com backoff exponencial.
   * Registro do status final de envio no banco de dados (`EmailLog`).
2. **`generate-certificate`**:
   * Gera arquivos PDF em formato paisagem baseados no template do inquilino.
   * Cria QR Code público vetorial.
   * Realiza upload automático do arquivo gerado para o bucket do MinIO (S3).
3. **`retention`**:
   * Executa crons semanais para limpeza de logs expirados (EmailLog e AuditLog).

---

## 🚀 Comandos de Desenvolvimento

```bash
# Instalar dependências (executar no root ou filter)
pnpm install

# Rodar o worker em watch mode localmente
pnpm --filter worker run start:dev

# Compilar build de produção
pnpm --filter worker run build
```
