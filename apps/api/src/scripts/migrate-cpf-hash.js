const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';

function getProductionKeyStr(rawSecretKey) {
  let productionKeyStr = (rawSecretKey || '').trim();
  if ((productionKeyStr.startsWith('"') && productionKeyStr.endsWith('"')) || 
      (productionKeyStr.startsWith("'") && productionKeyStr.endsWith("'"))) {
    productionKeyStr = productionKeyStr.slice(1, -1);
  }
  if (!productionKeyStr) {
    productionKeyStr = 'super_secret_encryption_key_32_bytes_long_12345678';
  }
  return productionKeyStr;
}

function tryDecrypt(text, rawSecretKey) {
  if (!text) return null;
  
  const productionKeyStr = getProductionKeyStr(rawSecretKey);
  
  // Define key variations to try
  const keysToTry = [
    productionKeyStr,
    'super_secret_encryption_key_32_bytes_long_12345678',
    'default_secret_encryption_key_32_bytes_long'
  ];

  const parts = text.split(':');
  if (parts.length !== 3) {
    return null;
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
      
      return { decrypted, workingKey: keyStr };
    } catch (error) {
      // Try next key
    }
  }
  
  return null;
}

function encrypt(text, secretKeyStr) {
  const key = crypto.createHash('sha256').update(secretKeyStr).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

function getCpfHash(cpf, secretKey) {
  const digits = cpf.replace(/\D/g, '');
  return crypto.createHmac('sha256', secretKey).update(digits).digest('hex');
}

async function main() {
  const rawSecretKey = process.env.ENCRYPTION_KEY || 'default_secret_encryption_key_32_bytes_long';
  const productionKeyStr = getProductionKeyStr(rawSecretKey);
  console.log('Chave de criptografia bruta carregada. Comprimento:', rawSecretKey.length);
  console.log('Chave de produção derivada. Comprimento:', productionKeyStr.length);

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
    const hash = getCpfHash(decrypted, productionKeyStr);
    
    const updateData = { cpfHash: hash };
    
    if (workingKey !== productionKeyStr) {
      console.log(`Rotacionando chave: Re-criptografando CPF para ID ${reg.id} usando a chave de produção...`);
      updateData.cpf = encrypt(decrypted, productionKeyStr);
    }
    
    await prisma.registration.update({
      where: { id: reg.id },
      data: updateData,
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
