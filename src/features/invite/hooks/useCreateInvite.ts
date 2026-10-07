import { useMutation } from '@tanstack/react-query';
import { db } from '@/core/firebase/client';
import { firestoreErrorMessage } from '@/core/firebase/firestoreError';
import type { UserDoc } from '@shared/types';
import { createInvite, inviteUrl } from '../services/invites';

/** Cada `mutate` gera um código novo; `code`/`url` são sempre os do último gerado. */
export function useCreateInvite(uid: string | null, profile: UserDoc | null | undefined) {
  const m = useMutation({
    mutationFn: async () => {
      if (uid === null || profile == null) throw new Error('Sem perfil para convidar.');
      return createInvite(db, uid, profile);
    },
  });
  const code = m.data ?? null;
  return {
    mutate: () => m.mutate(),
    code,
    url: code !== null && profile != null ? inviteUrl(code, profile.displayName) : null,
    isPending: m.isPending,
    error: m.isError ? firestoreErrorMessage(m.error) : null,
  };
}
