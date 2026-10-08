import { collection, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/core/firebase/client';
import { useFirestoreCollection } from '@/core/firebase/useFirestoreCollection';
import type { PartnershipDoc } from '@shared/types';

export function usePartnerships(uid: string | null) {
  // useFirestoreCollection estabiliza a query por queryEqual: montar inline é seguro.
  const q =
    uid === null
      ? null
      : query(
          collection(db, 'partnerships'),
          where('members', 'array-contains', uid),
          orderBy('temperature', 'desc'),
        );
  return useFirestoreCollection<PartnershipDoc>(q, ['partnerships', uid]);
}
