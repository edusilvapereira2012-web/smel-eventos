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

/**
 * Generates a deterministic, secure hash of a CPF for indexing/lookup (Blind Index).
 */
export function getCpfHash(cpf: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('Chave de criptografia não configurada.');
  }
  const digits = cleanCpf(cpf);
  return crypto.createHmac('sha256', secretKey).update(digits).digest('hex');
}

/**
 * Mathematically validates a CPF string (checking length, repeated digits, and verifier digits).
 */
export function isValidCpf(cpf: string): boolean {
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) {
    return false;
  }

  // Reject known invalid repeated digit patterns (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  // Validate 1st digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(digits.charAt(9), 10)) {
    return false;
  }

  // Validate 2nd digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(digits.charAt(10), 10)) {
    return false;
  }

  return true;
}
