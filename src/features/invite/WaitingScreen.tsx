import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { Button } from '@/core/ui/Button';
import { theme } from '@/core/ui/theme';
import { usePartnerships } from '@/features/partnership/hooks/usePartnerships';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useCreateInvite } from './hooks/useCreateInvite';
import { useShare } from './hooks/useShare';
import { formatInviteCode, inviteMessage } from './inviteShare';
import { PartnershipPreview } from './PartnershipPreview';
import { inviteUrl } from './services/invites';

export function WaitingScreen() {
  const params = useLocalSearchParams<{ code?: string; nome?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const profile = useProfile(uid);
  const partnerships = usePartnerships(uid);
  const regenerate = useCreateInvite(uid, profile.data);
  const sharing = useShare();

  // O convite novo substitui o da rota: é o que passa a ser mostrado e compartilhado.
  const code = regenerate.code ?? params.code ?? null;
  const url = regenerate.url
    ?? (code !== null && profile.data != null ? inviteUrl(code, profile.data.displayName) : null);
  const name = params.nome?.trim() ? params.nome.trim() : null;

  // Só volta à raiz: a cerimônia é do BornCeremonyGate, que espera esta tela
  // sair da frente. dismissTo, não replace: replace empilharia outra lista.
  const hasPartnership = (partnerships.data?.length ?? 0) > 0;
  useEffect(() => {
    if (hasPartnership) router.dismissTo('/');
  }, [hasPartnership, router]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {name !== null
          ? `Enquanto o ${name} não aceita, olha o que vocês vão construir`
          : 'Enquanto seu convite não é aceito, olha o que vocês vão construir'}
      </Text>
      <PartnershipPreview />
      {code !== null && (
        <Text accessibilityLabel={`Código ${code.split('').join(' ')}`} style={styles.code}>
          {formatInviteCode(code)}
        </Text>
      )}
      {regenerate.error !== null && <Text style={styles.error}>{regenerate.error}</Text>}
      {sharing.error !== null && <Text style={styles.error}>{sharing.error}</Text>}
      <View style={styles.actions}>
        {url !== null && <Button label="Compartilhar de novo" onPress={() => void sharing.share(inviteMessage(url))} />}
        <Button
          label="Gerar outro convite"
          variant="glass"
          onPress={regenerate.mutate}
          loading={regenerate.isPending}
          disabled={profile.data == null}
        />
        <Button label="Depois eu faço isso" variant="ghost" onPress={() => router.dismissTo('/')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: theme.space[5], gap: theme.space[5] },
  title: {
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
  },
  code: {
    fontSize: theme.type.headline.fontSize,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    color: theme.colors.brand[600],
  },
  error: { color: theme.colors.danger, textAlign: 'center' },
  actions: { gap: theme.space[2] },
});
