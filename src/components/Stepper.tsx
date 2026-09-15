import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  decrementLabel: string;
  incrementLabel: string;
}

/**
 * A number stepper with real 44pt targets on both buttons.
 *
 * A stepper is the right control here rather than a text field: the headcount at a table is a
 * small number that changes by one, and a keyboard covering half the screen to type "4" is
 * worse than two taps.
 */
export function Stepper({ label, value, min = 1, max = 50, onChange, decrementLabel, incrementLabel }: Props) {
  const { colors, spacing, radius } = useTheme();

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) return;
    void Haptics.selectionAsync();
    onChange(next);
  };

  const button = (icon: 'minus' | 'plus', delta: number, accessibilityLabel: string, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => step(delta)}
      android_ripple={{ color: withAlpha(colors.text, 0.12), borderless: true, radius: 22 }}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radius.full,
          backgroundColor: colors.surfaceAlt,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="micro" tone="faint">
        {label.toUpperCase()}
      </Text>
      <View style={[styles.row, { gap: spacing.md }]}>
        {button('minus', -1, decrementLabel, value <= min)}
        <Text variant="numeric" align="center" style={styles.value}>
          {value}
        </Text>
        {button('plus', 1, incrementLabel, value >= max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  value: { flex: 1 },
});
