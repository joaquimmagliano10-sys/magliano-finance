// Gera o hash bcrypt da senha do painel para usar em ADMIN_PASSWORD_HASH.
// Uso: npm run hash-senha -- "minha senha forte"
import bcrypt from "bcryptjs";

const senha = process.argv[2];
if (!senha || senha.length < 10) {
  console.error('Use: npm run hash-senha -- "uma senha com pelo menos 10 caracteres"');
  process.exit(1);
}
const hash = await bcrypt.hash(senha, 12);
console.log("\nCole na variável ADMIN_PASSWORD_HASH (no .env.local ou na Vercel):\n");
console.log(hash);
console.log("\nAtenção: no arquivo .env, escape os cifrões ($) com barra invertida: \\$\n");
