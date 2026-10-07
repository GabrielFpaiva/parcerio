import { useMutation } from '@tanstack/react-query';
import { db } from '@/core/firebase/client';
import { firestoreErrorMessage } from '@/core/firebase/firestoreError';
import { InviteRejectedError, acceptInvite, type AcceptRejection } from '../services/invites';

export const REJECTION_MESSAGES: Record<AcceptRejection, string> = {
  used: 'Esse convite já virou parceria de outra pessoa.',
  expired: 'Esse convite esfriou.',
  self: 'Esse convite é seu.',
  'already-partners': 'Vocês já são parceiros.',
  'not-found': 'Não encontrei esse convite.',
};

/** Recusas que levam ao "Pedir um convite novo". */
export function canAskForNewInvite(reason: AcceptRejection | null): reason is 'used' | 'expired' {
  return reason === 'used' || reason === 'expired';
}

export function useAcceptInvite(code: string, uid: string | null) {
  const mutation = useMutation({
    mutationFn: () => {
      if (uid === null) throw new Error('sem sessão');
      return acceptInvite(db, code, uid);
    },
  });

  const error = mutation.error;
  const rejection = error instanceof InviteRejectedError ? error.reason : null;
  const errorMessage =
    error === null
      ? null
      : rejection !== null
        ? REJECTION_MESSAGES[rejection]
        : firestoreErrorMessage(error);

  return {
    accept: mutation.mutateAsync,
    isPending: mutation.isPending,
    rejection,
    errorMessage,
  };
}
