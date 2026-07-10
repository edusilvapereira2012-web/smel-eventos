import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encrypt(text: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('Chave de criptografia não configurada.');
  }
  // Derive a 32-byte key from the secretKey
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

export function decrypt(encryptedText: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('Chave de criptografia não configurada.');
  }
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Formato do texto criptografado inválido.');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const tag = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Clean CPF by keeping only numbers.
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Masks CPF according to LGPD rules.
 * Format: ***.***.123-45 (shows last 5 digits including verification digits)
 */
export function maskCpf(cpf: string): string {
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) {
    return '***.***.***-**';
  }
  // User spec: ***.***.123-45
  // Shows 3 digits before dash and 2 digits after dash.
  // Example for 12345678901 -> ***.***.789-01
  return `***.***.${digits.substring(6, 9)}-${digits.substring(9, 11)}`;
}
