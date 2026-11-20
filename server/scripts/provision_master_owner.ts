import crypto from 'crypto';
import { db, type User } from '../db.ts';
import { isPostgresActive } from '../persistence/repository.ts';

export interface ProvisionMasterOwnerInput {
  name: string;
  email: string;
}

export function provisionMasterOwnerInJson(input: ProvisionMasterOwnerInput): {
  created: boolean;
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'active' | 'companyId' | 'mustSetPassword' | 'createdAt'>;
} {
  if (isPostgresActive()) {
    throw new Error(
      'Provisionamento JSON deve ser executado apenas com PERSISTENCE_MODE=json.'
    );
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail || !input.name.trim()) {
    throw new Error('Nome e e-mail são obrigatórios.');
  }

  const existing = db.users.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail
  );

  if (existing) {
    return {
      created: false,
      user: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        active: existing.active,
        companyId: existing.companyId,
        mustSetPassword: existing.mustSetPassword,
        createdAt: existing.createdAt,
      },
    };
  }

  // Sem senha fixa, sem hash fixo e sem credenciais em código: aguarda primeiro acesso seguro.
  const newUser: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: input.name.trim(),
    passwordHash: '',
    salt: '',
    role: 'master_owner',
    companyId: null,
    active: true,
    createdAt: new Date().toISOString(),
    mustSetPassword: true,
  };

  db.users.push(newUser);
  db.save();

  db.logAudit({
    userId: newUser.id,
    userEmail: newUser.email,
    userName: newUser.name,
    acao: 'CRIACAO_MASTER_OWNER',
    detalhes:
      'Novo administrador Master Owner provisionado em modo JSON com primeiro acesso pendente (sem senha fixa).',
  });

  return {
    created: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      active: newUser.active,
      companyId: newUser.companyId,
      mustSetPassword: newUser.mustSetPassword,
      createdAt: newUser.createdAt,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = provisionMasterOwnerInJson({
    name: 'Alifer Madeiro',
    email: 'aliferkl@icloud.com',
  });
  console.log(JSON.stringify(result, null, 2));
}
