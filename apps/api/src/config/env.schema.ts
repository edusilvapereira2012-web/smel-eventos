import { z } from 'zod';

export const envSchema = z.object({
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
  ENCRYPTION_KEY: z.string().default('super_secret_encryption_key_32_bytes_long_12345678'),
  QR_SECRET: z.string().default('super_secret_qr_signature_key_32_bytes_long_12345'),
});

export type Env = z.infer<typeof envSchema>;
