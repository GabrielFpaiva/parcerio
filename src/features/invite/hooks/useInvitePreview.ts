import { useQuery } from '@tanstack/react-query';
import type { Timestamp } from 'firebase/firestore';
import { db } from '@/core/firebase/client';
import { checkInvite, type InviteRejection } from '@shared/invite';
import type { InviteDoc } from '@shared/types';
import { readInvite } from '../services/invites';

export interface InvitePreview {
  /** null quando o código não existe. */
  invite: InviteDoc | null;
  /** O que já dá para saber só lendo o convite; `already-partners` só sai no aceite. */
  rejection: InviteRejection | null;
}

export function useInvitePreview(code: string, uid: string | null) {
  return useQuery<InvitePreview>({
    queryKey: ['invite', code, uid],
    enabled: uid !== null,
    queryFn: async () => {
      const invite = await readInvite(db, code);
      if (invite === null) return { invite: null, rejection: null };
      const rejection = checkInvite(
        {
          fromUid: invite.fromUid,
          usedBy: invite.usedBy,
          status: invite.status,
          createdAtMs: (invite.createdAt as Timestamp).toMillis(),
        },
        uid!,
        Date.now(),
      );
      return { invite, rejection };
    },
  });
}
