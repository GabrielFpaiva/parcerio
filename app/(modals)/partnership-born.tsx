import { useRef } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { PartnershipBornCeremony } from '@/features/ceremony/PartnershipBornCeremony';
import { markCeremonySeen } from '@/features/ceremony/useBornCeremony';
import { usePartnerships } from '@/features/partnership/hooks/usePartnerships';

export default function PartnershipBornModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const partnership = usePartnerships(user?.uid ?? null).data?.find((p) => p.id === id);
  const closing = useRef(false);

  if (closing.current) return null;
  // Link antigo ou parceria que sumiu: nada a celebrar, volta para a raiz.
  if (partnership === undefined) return <Redirect href="/" />;

  return (
    <PartnershipBornCeremony
      partnership={partnership}
      onDismiss={() => {
        closing.current = true;
        void markCeremonySeen(partnership.id);
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
    />
  );
}
