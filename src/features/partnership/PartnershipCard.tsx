import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/core/ui/Avatar';
import { GlassCard } from '@/core/ui/GlassCard';
import { theme } from '@/core/ui/theme';
import { XParceriaBar } from '@/core/ui/XParceriaBar';
import { bandForTemperature } from '@shared/temperature';
import type { PartnershipDoc, PartnershipStatus } from '@shared/types';

type Props = {
  partnership: PartnershipDoc;
  /** Quem está olhando: o card mostra o outro membro, nunca este. */
  viewerUid: string;
  onPress: () => void;
};

const STATUS_LABEL: Partial<Record<PartnershipStatus, string>> = {
  paused: 'Pausada',
  ended: 'Encerrada',
};

export function PartnershipCard({ partnership: p, viewerUid, onPress }: Props) {
  const partnerUid = p.members.find((m) => m !== viewerUid) ?? viewerUid;
  const partner = p.memberProfiles[partnerUid];
  // O campo gravado é cache do servidor e pode divergir; a banda vem sempre da temperatura.
  const band = bandForTemperature(p.temperature);
  const statusLabel = STATUS_LABEL[p.status];

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <GlassCard>
        <View style={styles.row}>
          <Avatar
            photoURL={partner?.photoURL ?? null}
            fallbackEmoji={partner?.avatarEmoji ?? '🙂'}
            size={52}
            temperature={p.temperature}
          />
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{partner?.displayName ?? 'Parceiro'}</Text>
            <Text style={styles.meta}>{`${band.emoji} `}<Text>{band.label}</Text></Text>
          </View>
          <View style={styles.side}>
            <Text style={styles.level}>{`Nível ${p.level}`}</Text>
            {statusLabel !== undefined && <Text style={styles.status}>{statusLabel}</Text>}
          </View>
        </View>
        <View style={styles.bar}>
          <XParceriaBar level={p.level} xpIntoLevel={p.xpIntoLevel} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  info: { flex: 1 },
  name: {
    fontSize: theme.type.headline.fontSize,
    fontWeight: '600',
    color: theme.colors.ink[900],
  },
  meta: { fontSize: theme.type.caption.fontSize, color: theme.colors.ink[500] },
  side: { alignItems: 'flex-end', gap: theme.space[1] },
  level: {
    fontSize: theme.type.callout.fontSize,
    fontWeight: '500',
    color: theme.colors.ink[700],
  },
  status: {
    fontSize: theme.type.micro.fontSize,
    fontWeight: '600',
    color: theme.colors.warning,
  },
  bar: { marginTop: theme.space[3] },
});
