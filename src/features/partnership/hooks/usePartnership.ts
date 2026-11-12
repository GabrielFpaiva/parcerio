import { doc } from 'firebase/firestore';
import { useAuth } from '@/core/auth/useAuth';
import { db } from '@/core/firebase/client';
import { useFirestoreDoc } from '@/core/firebase/useFirestoreDoc';
import type { PartnershipDoc } from '@shared/types';

export function usePartnership(pid: string | null) {
  const { user } = useAuth();
  return useFirestoreDoc<PartnershipDoc>(
    pid === null ? null : doc(db, 'partnerships', pid),
    // uid na chave: o QueryClient sobrevive ao sign-out, e sem ele a conta
    // seguinte no mesmo aparelho veria a parceria em cache da anterior.
    ['partnership', pid, user?.uid ?? null],
  );
}
