import readline from 'readline';
import { db, hashPassword, revokeAllUserSessionsAsync } from '../db.ts';
import { isPostgresActive } from '../persistence/repository.ts';

function validateStrongPassword(password: string): string | null {
  if (!password || password.length < 12) {
    return 'A senha deve possuir pelo menos 12 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra maiúscula.';
  }
  if (!/[a-z]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'A senha deve conter pelo menos um número.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve conter pelo menos um caractere especial.';
  }
  return null;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const mutableStdout = process.stdout as NodeJS.WriteStream & { muted?: boolean };
    const origWrite = process.stdout.write.bind(process.stdout);

    process.stdout.write = ((chunk: any, encoding?: any, cb?: any) => {
      if (mutableStdout.muted) {
        return true;
      }
      return origWrite(chunk, encoding, cb);
    }) as typeof process.stdout.write;

    rl.question(question, (answer) => {
      mutableStdout.muted = false;
      process.stdout.write = origWrite;
      console.log('');
      rl.close();
      resolve(answer);
    });
    mutableStdout.muted = true;
  });
}

async function main() {
  if (isPostgresActive()) {
    throw new Error('Este script interativo opera exclusivamente com PERSISTENCE_MODE=json.');
  }

  const targetEmail = (process.argv[2] || 'aliferkl@icloud.com').trim().toLowerCase();
  const user = db.users.find((u) => u.email.trim().toLowerCase() === targetEmail);

  if (!user) {
    console.error(`Usuário não encontrado: ${targetEmail}`);
    process.exit(1);
  }
  if (!user.active) {
    console.error('Usuário inativo.');
    process.exit(1);
  }
  if (!user.mustSetPassword && user.passwordHash && user.salt) {
    console.error('Esta conta já concluiu o primeiro acesso.');
    process.exit(1);
  }

  const newPassword = await promptHidden(`Nova senha definitiva para ${user.email}: `);
  const strengthError = validateStrongPassword(newPassword);
  if (strengthError) {
    console.error(strengthError);
    process.exit(1);
  }

  const confirmPassword = await promptHidden('Confirmar nova senha definitiva: ');
  if (newPassword !== confirmPassword) {
    console.error('A confirmação da nova senha não confere.');
    process.exit(1);
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  user.mustSetPassword = false;
  await db.save();
  await revokeAllUserSessionsAsync(user.id);

  await db.logAudit({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    acao: 'PRIMEIRO_ACESSO_DEFINIDO',
    detalhes: `Senha definitiva definida via CLI de primeiro acesso (${user.role}).`,
  });

  console.log(`Senha definitiva gravada com sucesso via scrypt para ${user.email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
