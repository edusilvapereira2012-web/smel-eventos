import { envSchema } from './env.schema';

describe('envSchema Validation', () => {
  const validBaseConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    MINIO_ENDPOINT: 'localhost',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET_EVENTS: 'events',
    MINIO_BUCKET_CERTIFICATES: 'certificates',
    JWT_SECRET: 'jwtsecret123',
    JWT_REFRESH_SECRET: 'jwtrefreshsecret123',
    SMTP_HOST: 'smtp.mailtrap.io',
    SMTP_PORT: '2525',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    SMTP_FROM: 'noreply@example.com',
    APP_URL: 'http://localhost:3000',
    API_URL: 'http://localhost:3001',
  };

  it('should parse successfully in development mode with default keys', () => {
    const result = envSchema.safeParse({
      ...validBaseConfig,
      NODE_ENV: 'development',
    });
    expect(result.success).toBe(true);
  });

  it('should parse successfully in production mode when custom keys are provided', () => {
    const result = envSchema.safeParse({
      ...validBaseConfig,
      NODE_ENV: 'production',
      ENCRYPTION_KEY: 'custom_production_encryption_key_32_bytes!',
      QR_SECRET: 'custom_production_qr_secret_key_32_bytes!',
    });
    expect(result.success).toBe(true);
  });

  it('should fail validation in production mode if ENCRYPTION_KEY is the default fallback', () => {
    const result = envSchema.safeParse({
      ...validBaseConfig,
      NODE_ENV: 'production',
      QR_SECRET: 'custom_production_qr_secret_key_32_bytes!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.includes('ENCRYPTION_KEY'),
      );
      expect(issue).toBeDefined();
    }
  });

  it('should fail validation in production mode if QR_SECRET is the default fallback', () => {
    const result = envSchema.safeParse({
      ...validBaseConfig,
      NODE_ENV: 'production',
      ENCRYPTION_KEY: 'custom_production_encryption_key_32_bytes!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes('QR_SECRET'),
      );
      expect(issue).toBeDefined();
    }
  });
});
