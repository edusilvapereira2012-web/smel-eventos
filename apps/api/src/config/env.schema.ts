import { z } from 'zod';

const DEFAULT_ENCRYPTION_KEY = 'super_secret_encryption_key_32_bytes_long_12345678';
const DEFAULT_QR_SECRET = 'super_secret_qr_signature_key_32_bytes_long_12345';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    MINIO_ENDPOINT: z.string(),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: z.string(),
    MINIO_SECRET_KEY: z.string(),
    MINIO_BUCKET_EVENTS: z.string(),
    MINIO_BUCKET_CERTIFICATES: z.string(),
    MINIO_EXTERNAL_URL: z.string().url().optional(),
    JWT_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number(),
    SMTP_USER: z.string(),
    SMTP_PASS: z.string(),
    SMTP_FROM: z.string(),
    APP_URL: z.string().url(),
    API_URL: z.string().url(),
    ENCRYPTION_KEY: z.string().default(DEFAULT_ENCRYPTION_KEY),
    QR_SECRET: z.string().default(DEFAULT_QR_SECRET),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.ENCRYPTION_KEY === DEFAULT_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Em ambiente de produção (production), ENCRYPTION_KEY deve ser configurada com um segredo forte no .env e não utilizar o valor padrão.',
          path: ['ENCRYPTION_KEY'],
        });
      }
      if (data.QR_SECRET === DEFAULT_QR_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Em ambiente de produção (production), QR_SECRET deve ser configurada com um segredo forte no .env e não utilizar o valor padrão.',
          path: ['QR_SECRET'],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

