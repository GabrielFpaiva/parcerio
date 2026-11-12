import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/core/ui/Avatar';
import { Button } from '@/core/ui/Button';
import { ErrorState } from '@/core/ui/ErrorState';
import { firestoreErrorMessage } from '@/core/firebase/firestoreError';
import { theme } from '@/core/ui/theme';
import { useAuth } from '@/core/auth/useAuth';
import { partnershipId } from '@shared/partnership';
import { REJECTION_MESSAGES, canAskForNewInvite, useAcceptInvite } from './hooks/useAcceptInvite';
import { useInvitePreview } from './hooks/useInvitePreview';
import { useShare } from './hooks/useShare';
import { newInviteRequestMessage } from './inviteShare';
import type { AcceptRejection } from './services/invites';

type Props = { code: string };

function Skeleton() {
  return (
    <View testID="invite-skeleton" style={styles.center}>
      <View style={[styles.bone, { width: 96, height: 96, borderRadius: 48 }]} />
      <View style={[styles.bone, { width: 220, height: 20 }]} />
      <View style={[styles.bone, { width: 160, height: 14 }]} />
    </View>
  );
}

export function AcceptInviteScreen({ code }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const preview = useInvitePreview(code, uid);
  const { accept, isPending, rejection: acceptRejection, errorMessage } = useAcceptInvite(code, uid);
  const sharing = useShare();

  if (preview.isLoading || uid === null) return <Skeleton />;
  if (preview.isError) {
    return (
      <ErrorState message={firestoreErrorMessage(preview.error)} onRetry={() => void preview.refetch()} />
    );
  }

  const invite = preview.data?.invite ?? null;
  const rejection: AcceptRejection | null =
    invite === null ? 'not-found' : (preview.data?.rejection ?? acceptRejection);
  const inviterName = invite?.fromProfile.displayName ?? null;
  // Quem já aceitou e toca no link de novo: a parceria é dele, não "de outra pessoa".
  const ownPartnership = invite !== null && invite.usedBy === uid && invite.fromUid !== uid;

  // Sem histórico (app aberto direto pelo link), back() não faz nada.
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // Com histórico, troca esta tela pela visão geral. Sem histórico, a visão
  // geral seria a única tela, sem voltar: a lista, que mostra a parceria, é
  // o destino seguro.
  function seePartnership(pid: string) {
    if (router.canGoBack()) router.replace(`/partnership/${pid}`);
    else router.replace('/');
  }

  async function onAccept() {
    try {
      await accept();
      // Volta à lista que já está na pilha (replace empilharia outra). A
      // cerimônia é do BornCeremonyGate, que espera esta tela sair da frente.
      router.dismissTo('/');
    } catch {
      // O motivo já está no estado da mutação e aparece na tela.
    }
  }

  function askForNewInvite(reason: 'used' | 'expired') {
    void sharing.share(newInviteRequestMessage(inviterName, reason));
  }

  // Já parceiros: quem reabre o link do convite que aceitou, ou o aceite
  // recusado porque a parceria do par está ativa. Nos dois, o caminho é ela.
  if (invite !== null && (ownPartnership || rejection === 'already-partners')) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{REJECTION_MESSAGES['already-partners']}</Text>
        <Button
          label="Ver parceria"
          onPress={() => seePartnership(partnershipId(invite.fromUid, uid))}
        />
        <Button label="Voltar" variant="ghost" onPress={goBack} />
      </View>
    );
  }

  if (rejection !== null) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{REJECTION_MESSAGES[rejection]}</Text>
        {sharing.error !== null && <Text style={styles.error}>{sharing.error}</Text>}
        {canAskForNewInvite(rejection) && (
          <Button label="Pedir um convite novo" onPress={() => askForNewInvite(rejection)} />
        )}
        <Button label="Voltar" variant="ghost" onPress={goBack} />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Avatar
        photoURL={invite!.fromProfile.photoURL}
        fallbackEmoji={invite!.fromProfile.avatarEmoji ?? '🙂'}
        size={96}
      />
      <Text style={styles.title}>{inviterName ?? 'Alguém'} quer construir uma parceria com você</Text>
      {errorMessage !== null && <Text style={styles.error}>{errorMessage}</Text>}
      <Button label="Aceitar" onPress={() => void onAccept()} loading={isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space[5],
    gap: theme.space[4],
  },
  title: {
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
    textAlign: 'center',
  },
  error: { color: theme.colors.danger, fontSize: theme.type.caption.fontSize, textAlign: 'center' },
  bone: { backgroundColor: theme.colors.paper[100], borderRadius: theme.radius.sm },
});
