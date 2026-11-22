export const ORIGINAL_MASTER_OWNER_ID = '312f0489-d5ba-4a34-b493-4ffe7318cf2e';
export const ORIGINAL_MASTER_OWNER_EMAIL = 'Alifermadeiro@hotmail.com';

export interface MasterIdentityCandidate {
  id: string;
  email: string;
  role: string;
  active: boolean;
}

export interface MasterSystemConfigCandidate {
  masterEmail?: string | null;
}

export function getOfficialMasterEmailNormalized(
  config?: MasterSystemConfigCandidate | null
): string {
  const raw = (config?.masterEmail || ORIGINAL_MASTER_OWNER_EMAIL).trim().toLowerCase();
  return raw || ORIGINAL_MASTER_OWNER_EMAIL.toLowerCase();
}

export function isOfficialMasterOwner(
  user?: MasterIdentityCandidate | null,
  config?: MasterSystemConfigCandidate | null
): boolean {
  if (!user || !user.active) return false;
  if (user.role !== 'master_owner') return false;
  if (user.id !== ORIGINAL_MASTER_OWNER_ID) return false;

  const userEmail = String(user.email || '').trim().toLowerCase();
  const officialEmail = ORIGINAL_MASTER_OWNER_EMAIL.toLowerCase();
  const configEmail = getOfficialMasterEmailNormalized(config);

  return userEmail === officialEmail && configEmail === officialEmail;
}

export function assertMasterOwnerSingleton(
  users: MasterIdentityCandidate[],
  config?: MasterSystemConfigCandidate | null
): void {
  const officialEmail = ORIGINAL_MASTER_OWNER_EMAIL.toLowerCase();
  const configEmail = getOfficialMasterEmailNormalized(config);

  if (configEmail !== officialEmail) {
    throw new Error(
      `Violação de singleton Master Owner: systemConfig.masterEmail inválido (${config?.masterEmail}).`
    );
  }

  const masterUsers = users.filter((u) => u.role === 'master_owner');
  if (masterUsers.length > 1) {
    throw new Error(
      `Violação de singleton Master Owner: detectados ${masterUsers.length} registros com role master_owner. Somente ${ORIGINAL_MASTER_OWNER_ID} (${ORIGINAL_MASTER_OWNER_EMAIL}) é permitido.`
    );
  }

  if (masterUsers.length === 1) {
    const m = masterUsers[0];
    if (
      m.id !== ORIGINAL_MASTER_OWNER_ID ||
      String(m.email || '').trim().toLowerCase() !== officialEmail
    ) {
      throw new Error(
        `Violação de singleton Master Owner: o único registro master_owner permitido é ${ORIGINAL_MASTER_OWNER_ID} (${ORIGINAL_MASTER_OWNER_EMAIL}), encontrado ${m.id}.`
      );
    }
  }
}
