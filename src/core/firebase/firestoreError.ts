const MESSAGES: Record<string, string> = {
  'permission-denied': 'Você não tem acesso a isso.',
  unavailable: 'Sem conexão. Tenta de novo.',
  'not-found': 'Não encontrei isso.',
  'already-exists': 'Isso já existe.',
  'deadline-exceeded': 'A conexão demorou demais. Tenta de novo.',
};

/** Nunca vaza o código cru do Firestore para a tela. */
export function firestoreErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return (code !== undefined ? MESSAGES[code] : undefined) ?? 'Algo deu errado. Tenta de novo.';
}
