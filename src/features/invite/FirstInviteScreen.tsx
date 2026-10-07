import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';
import { Button } from '@/core/ui/Button';
import { theme } from '@/core/ui/theme';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useCreateInvite } from './hooks/useCreateInvite';
import { formatInviteCode, shareInvite } from './inviteShare';

export function FirstInviteScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const profile = useProfile(uid);
  const invite = useCreateInvite(uid, profile.data);

  if (invite.code === null || invite.url === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quem é o seu parceiro?</Text>
        <Text style={styles.body}>
          Uma pessoa só. Você gera um convite e manda do jeito que preferir.
        </Text>
        {invite.error !== null && <Text style={styles.error}>{invite.error}</Text>}
        <Button
          label={invite.error !== null ? 'Tentar de novo' : 'Gerar convite'}
          onPress={invite.mutate}
          loading={invite.isPending}
          disabled={profile.data == null}
        />
      </View>
    );
  }

  const url = invite.url;
  const code = invite.code;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seu convite está pronto</Text>
      <Text accessibilityLabel={`Código ${code.split('').join(' ')}`} style={styles.code}>
        {formatInviteCode(code)}
      </Text>
      <Button label="Compartilhar no WhatsApp" onPress={() => void shareInvite(url)} />
      <Button
        label="Já mandei"
        variant="ghost"
        onPress={() => router.replace({ pathname: '/onboarding/waiting', params: { code } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.space[5], gap: theme.space[4] },
  title: {
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
  },
  body: {
    fontSize: theme.type.body.fontSize,
    lineHeight: theme.type.body.lineHeight,
    color: theme.colors.ink[700],
  },
  code: {
    fontSize: theme.type.display.fontSize,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    color: theme.colors.brand[600],
  },
  error: { color: theme.colors.danger },
});
