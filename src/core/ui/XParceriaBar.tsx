import type { ComponentType } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { xpForNextLevel } from '@shared/level';
import { theme } from './theme';

type Props = {
  level: number;
  xpIntoLevel: number;
  /**
   * Variante animada: o chamador injeta um componente animado e um estilo que
   * escala o preenchimento (ex.: scaleX de 0 a 1 com transformOrigin 'left').
   * A largura estática continua sendo o valor final, então sem estes props o
   * comportamento é o mesmo de sempre.
   */
  FillComponent?: ComponentType<ViewProps>;
  fillStyle?: StyleProp<ViewStyle>;
  hideLabel?: boolean;
};

export function XParceriaBar({
  level,
  xpIntoLevel,
  FillComponent = View,
  fillStyle,
  hideLabel = false,
}: Props) {
  const target = xpForNextLevel(level);
  const progress = Math.min(1, Math.max(0, xpIntoLevel / target));

  return (
    <View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Progresso de XParceria"
        accessibilityValue={{ min: 0, max: target, now: xpIntoLevel }}
        style={styles.track}
      >
        <FillComponent style={[styles.fill, { width: `${progress * 100}%` }, fillStyle]} />
      </View>
      {hideLabel ? null : <Text style={styles.label}>{`${xpIntoLevel} / ${target} XParceria`}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.ink[100],
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.colors.brand[500] },
  label: {
    marginTop: theme.space[2],
    fontSize: theme.type.caption.fontSize,
    color: theme.colors.ink[500],
    fontVariant: theme.type.title.fontVariant,
  },
});
