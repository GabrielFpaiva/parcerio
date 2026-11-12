import { useLocalSearchParams } from 'expo-router';
import { normalizeInviteCode } from '@shared/invite';
import { AcceptInviteScreen } from '@/features/invite/AcceptInviteScreen';

export default function InviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <AcceptInviteScreen code={normalizeInviteCode(code ?? '')} />;
}
