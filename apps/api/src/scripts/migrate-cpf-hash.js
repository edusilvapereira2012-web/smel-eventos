const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';

function decrypt(text, secretKey) {
  if (!text) return '';
  try {
    const parts = text.split(':');
    if (parts.length !== 3) {
      return text;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    
    // Derive the 32-byte key from the secretKey
    const key = crypto.createHash('sha256').update(secretKey).digest();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    return '';
  }
}

function getCpfHash(cpf, secretKey) {
  const digits = cpf.replace(/\D/g, '');
  return crypto.createHmac('sha256', secretKey).update(digits).digest('hex');
}

async function main() {
  const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_encryption_key_32_bytes_long';
  console.log('Chave de criptografia carregada. Comprimento:', secretKey.length);

  const registrations = await prisma.registration.findMany({
    where: {
      cpfHash: null,
      cpf: { not: null },
    },
  });

  console.log(`Encontradas ${registrations.length} inscrições sem cpfHash.`);

  let updatedCount = 0;
  for (const reg of registrations) {
    if (!reg.cpf) continue;
    const decryptedCpf = decrypt(reg.cpf, secretKey);
    if (!decryptedCpf) {
      console.warn(`Não foi possível descriptografar o CPF para a inscrição ID: ${reg.id}`);
      continue;
    }
    
    const hash = getCpfHash(decryptedCpf, secretKey);
    await prisma.registration.update({
      where: { id: reg.id },
      data: { cpfHash: hash },
    });
    updatedCount++;
  }

  console.log(`Migração concluída com sucesso! ${updatedCount} registros atualizados.`);
}

main()
  .catch((e) => {
    console.error('Erro durante a migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
