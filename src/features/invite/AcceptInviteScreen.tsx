import { Share, StyleSheet, Text, View } from 'react-native';
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

  async function onAccept() {
    try {
      await accept();
      router.replace('/');
    } catch {
      // O motivo já está no estado da mutação e aparece na tela.
    }
  }

  function askForNewInvite(reason: 'used' | 'expired') {
    const what = reason === 'used' ? 'já foi usado' : 'esfriou';
    const greeting = inviterName !== null ? `${inviterName}, seu` : 'Seu';
    void Share.share({ message: `${greeting} convite do Parcerio ${what} — me manda outro?` });
  }

  if (ownPartnership) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{REJECTION_MESSAGES['already-partners']}</Text>
        <Button
          label="Ver parceria"
          onPress={() => router.replace(`/partnership/${partnershipId(invite.fromUid, uid)}`)}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  if (rejection !== null) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{REJECTION_MESSAGES[rejection]}</Text>
        {canAskForNewInvite(rejection) && (
          <Button label="Pedir um convite novo" onPress={() => askForNewInvite(rejection)} />
        )}
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
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
