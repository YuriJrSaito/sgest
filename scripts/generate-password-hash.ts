// Script para gerar hash bcrypt de senha
// Uso: npx tsx scripts/generate-password-hash.ts "SuaSenha@123"

import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
  console.log('Uso: npx tsx scripts/generate-password-hash.ts "SuaSenha@123"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(`\nSenha: ${password}`);
console.log(`Hash:  ${hash}\n`);
