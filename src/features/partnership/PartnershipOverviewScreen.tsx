import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { db } from '@/core/firebase/client';
import { firestoreErrorMessage } from '@/core/firebase/firestoreError';
import { Avatar } from '@/core/ui/Avatar';
import { Button } from '@/core/ui/Button';
import { ErrorState } from '@/core/ui/ErrorState';
import { GlassCard } from '@/core/ui/GlassCard';
import { theme } from '@/core/ui/theme';
import { XParceriaBar } from '@/core/ui/XParceriaBar';
import { useCreateInvite } from '@/features/invite/hooks/useCreateInvite';
import { useShare } from '@/features/invite/hooks/useShare';
import { resumeInviteMessage } from '@/features/invite/inviteShare';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { bandForTemperature } from '@shared/temperature';
import { usePartnership } from './hooks/usePartnership';
import { endPartnership, pausePartnership, resumePartnership } from './services/partnerships';

function formatSince(activatedAt: unknown): string | null {
  const date = (activatedAt as { toDate?: () => Date } | null)?.toDate?.();
  return date === undefined ? null : date.toLocaleDateString('pt-BR');
}

export function PartnershipOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const q = usePartnership(id ?? null);
  const profile = useProfile(uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invite = useCreateInvite(uid, profile.data);
  const sharing = useShare();

  if (q.isError) {
    return <ErrorState message={firestoreErrorMessage(q.error)} onRetry={() => void q.refetch()} />;
  }
  if (uid === null || q.isLoading || q.data === undefined) {
    return <View testID="partnership-skeleton" style={styles.skeleton} />;
  }
  if (q.data === null) {
    return <ErrorState message="Não encontrei essa parceria." onRetry={() => void q.refetch()} />;
  }

  const p = q.data;
  const pid = p.id;
  const mine = p.memberProfiles[uid];
  // Sem o outro membro (dado inconsistente), cai no fallback "Parceiro" — nunca
  // mostra a própria pessoa como parceira dela mesma.
  const partnerUid = p.members.find((m) => m !== uid);
  const partner = partnerUid === undefined ? undefined : p.memberProfiles[partnerUid];
  const band = bandForTemperature(p.temperature);
  const since = formatSince(p.activatedAt);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(firestoreErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmEnd() {
    Alert.alert(
      'Encerrar parceria?',
      'O XParceria e a história de vocês ficam preservados. Um convite novo traz a parceria de volta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: () => void run(() => endPartnership(db, pid)) },
      ],
    );
  }

  // Criar (erro do Firestore, traduzido pelo hook) e compartilhar (falha do
  // Share, mensagem própria) são passos separados: se só o Share falhou, o
  // convite já existe e tentar de novo compartilha o mesmo, sem criar outro.
  // Fora desse caso, cada toque gera um convite novo (o anterior pode ter
  // sido usado).
  function sendNewInvite() {
    setError(null);
    if (profile.data == null) {
      setError('Não consegui carregar seu perfil. Tenta de novo.');
      return;
    }
    if (invite.url !== null && sharing.error !== null) {
      void sharing.share(resumeInviteMessage(invite.url));
      return;
    }
    invite.createThen((url) => void sharing.share(resumeInviteMessage(url)));
  }

  const shownError = error ?? invite.error ?? sharing.error;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GlassCard>
        <View style={styles.avatars}>
          <Avatar photoURL={mine?.photoURL ?? null} fallbackEmoji={mine?.avatarEmoji ?? '🙂'} size={64} />
          <Avatar
            photoURL={partner?.photoURL ?? null}
            fallbackEmoji={partner?.avatarEmoji ?? '🙂'}
            size={64}
            temperature={p.temperature}
          />
        </View>
        <View style={styles.names}>
          <Text style={styles.name}>{mine?.displayName ?? 'Você'}</Text>
          <Text style={styles.name}>{partner?.displayName ?? 'Parceiro'}</Text>
        </View>
        <Text style={styles.band}>{`${band.emoji} ${band.label}`}</Text>
        <Text style={styles.level}>{`Nível ${p.level}`}</Text>
        <XParceriaBar level={p.level} xpIntoLevel={p.xpIntoLevel} />
        {since !== null && <Text style={styles.since}>{`Parceria desde ${since}`}</Text>}
      </GlassCard>

      {shownError !== null && <Text accessibilityRole="alert" style={styles.error}>{shownError}</Text>}

      {p.status === 'ended' ? (
        <View style={styles.actions}>
          <Text style={styles.body}>
            Essa parceria está encerrada. Um convite novo traz a parceria de volta, com todo o XParceria de vocês.
          </Text>
          <Button
            label="Mandar convite novo"
            onPress={sendNewInvite}
            disabled={invite.isPending}
            loading={invite.isPending}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          {p.status === 'paused' ? (
            <Button label="Retomar" onPress={() => void run(() => resumePartnership(db, pid))} disabled={busy} />
          ) : (
            <Button label="Pausar" variant="glass" onPress={() => void run(() => pausePartnership(db, pid))} disabled={busy} />
          )}
          <Button label="Encerrar" variant="ghost" onPress={confirmEnd} disabled={busy} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    height: 220,
    margin: theme.space[4],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.ink[100],
  },
  content: { padding: theme.space[4], gap: theme.space[4] },
  avatars: { flexDirection: 'row', justifyContent: 'center', gap: theme.space[4] },
  names: { flexDirection: 'row', justifyContent: 'center', gap: theme.space[4], marginTop: theme.space[2] },
  name: {
    fontSize: theme.type.headline.fontSize,
    fontWeight: '600',
    color: theme.colors.ink[900],
  },
  band: {
    textAlign: 'center',
    marginTop: theme.space[2],
    fontSize: theme.type.callout.fontSize,
    color: theme.colors.ink[700],
  },
  level: {
    textAlign: 'center',
    marginVertical: theme.space[2],
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
  },
  since: {
    textAlign: 'center',
    marginTop: theme.space[3],
    fontSize: theme.type.caption.fontSize,
    color: theme.colors.ink[500],
  },
  error: { textAlign: 'center', color: theme.colors.danger },
  body: {
    fontSize: theme.type.body.fontSize,
    lineHeight: theme.type.body.lineHeight,
    color: theme.colors.ink[700],
  },
  actions: { gap: theme.space[2] },
});
