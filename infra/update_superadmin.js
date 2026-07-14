const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

async function main() {
  const prisma = new PrismaClient();
  try {
    const email = 'valterpcjr@gmail.com';
    const password = 'NW=v1lt2r._00@';
    console.log(`Hashing password for ${email}...`);
    const passwordHash = await argon2.hash(password);
    
    console.log('Upserting user...');
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: 'Valter Junior',
        passwordHash,
        isActive: true,
        emailVerified: true,
      },
      create: {
        name: 'Valter Junior',
        email,
        passwordHash,
        isActive: true,
        emailVerified: true,
      },
    });
    
    console.log('User successfully upserted:', user.email);
  } catch (err) {
    console.error('Error updating user:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
