import { doc } from 'firebase/firestore';
import { db } from '@/core/firebase/client';
import { useFirestoreDoc } from '@/core/firebase/useFirestoreDoc';
import type { PartnershipDoc } from '@shared/types';

export function usePartnership(pid: string | null) {
  return useFirestoreDoc<PartnershipDoc>(
    pid === null ? null : doc(db, 'partnerships', pid),
    ['partnership', pid],
  );
}
