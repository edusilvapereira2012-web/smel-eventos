const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';

function tryDecrypt(text, rawSecretKey) {
  if (!text) return '';
  
  // Define key variations to try (raw, trimmed, quote-stripped)
  const keysToTry = [
    rawSecretKey,
    rawSecretKey.trim(),
  ];
  
  const trimmed = rawSecretKey.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    keysToTry.push(trimmed.slice(1, -1));
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    keysToTry.push(trimmed.slice(1, -1));
  }

  const parts = text.split(':');
  if (parts.length !== 3) {
    return text; // Not encrypted
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');

  for (const keyStr of keysToTry) {
    try {
      const key = crypto.createHash('sha256').update(keyStr).digest();
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // If decryption succeeded, return it and log the working key length
      return { decrypted, workingKey: keyStr };
    } catch (error) {
      // Try next key variation
    }
  }
  
  return null;
}

function getCpfHash(cpf, secretKey) {
  const digits = cpf.replace(/\D/g, '');
  return crypto.createHmac('sha256', secretKey).update(digits).digest('hex');
}

async function main() {
  const rawSecretKey = process.env.ENCRYPTION_KEY || 'default_secret_encryption_key_32_bytes_long';
  console.log('Chave de criptografia bruta carregada. Comprimento:', rawSecretKey.length);

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
    const decryptResult = tryDecrypt(reg.cpf, rawSecretKey);
    if (!decryptResult) {
      console.warn(`Não foi possível descriptografar o CPF para a inscrição ID: ${reg.id} com nenhuma variação da chave.`);
      continue;
    }
    
    const { decrypted, workingKey } = decryptResult;
    const hash = getCpfHash(decrypted, workingKey);
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
