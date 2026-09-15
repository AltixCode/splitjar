import Feather from '@expo/vector-icons/Feather';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { t } from '@/i18n';
import { parseAmount, splitItemised } from '@/logic/split';
import { useBillStore } from '@/store/useBillStore';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

interface Props {
  money: (minor: number) => string;
  tipPercent: number;
}

/**
 * Itemised splitting: what was ordered, who had it, and what each person therefore owes.
 *
 * The arithmetic is entirely in `splitItemised`, which keeps every division in integer minor
 * units so a shared dish and the proportional tip both add back to exactly the bill.
 */
export function ItemisedPanel({ money, tipPercent }: Props) {
  const { colors, spacing, radius } = useTheme();

  const items = useBillStore((s) => s.items);
  const assignments = useBillStore((s) => s.assignments);
  const names = useBillStore((s) => s.names);
  const addItem = useBillStore((s) => s.addItem);
  const removeItem = useBillStore((s) => s.removeItem);
  const toggleAssignment = useBillStore((s) => s.toggleAssignment);

  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');

  const amount = parseAmount(price);
  const canAdd = label.trim() !== '' && Number.isFinite(amount) && amount > 0;

  const owed = splitItemised(items, assignments, names, tipPercent);

  const add = () => {
    if (!canAdd) return;
    addItem(label.trim(), amount);
    setLabel('');
    setPrice('');
  };

  const peopleFor = (itemId: string): string[] =>
    assignments.find((a) => a.itemId === itemId)?.people ?? [];

  return (
    <View style={{ gap: spacing.base }}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('itemNameLabel')}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={t('itemNameLabel')}
          style={[
            styles.input,
            styles.grow,
            { color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md },
          ]}
        />
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={t('itemAmountLabel')}
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={t('itemAmountLabel')}
          style={[
            styles.input,
            styles.price,
            { color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md },
          ]}
        />
        <Button label={t('addItemLabel')} size="sm" disabled={!canAdd} onPress={add} />
      </View>

      {items.length === 0 ? (
        <Text variant="caption" tone="muted">
          {t('noItems')}
        </Text>
      ) : (
        items.map((item) => {
          const sharers = peopleFor(item.id);
          return (
            <Card key={item.id}>
              <View style={[styles.row, { gap: spacing.md }]}>
                <Text variant="callout" style={styles.grow} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text variant="bodyStrong">{money(item.amount)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('deleteItem')}
                  onPress={() => removeItem(item.id)}
                  hitSlop={10}
                  style={styles.iconSlot}
                >
                  <Feather name="x" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
              <Text variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
                {t('whoHadThis').toUpperCase()}
              </Text>
              <View style={[styles.chips, { gap: spacing.sm, marginTop: spacing.xs }]}>
                {names.map((name, index) => {
                  const selected = sharers.includes(name);
                  const display = t('personNumber', { n: index + 1 });
                  return (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${display}, ${item.label}`}
                      onPress={() => toggleAssignment(item.id, name)}
                      android_ripple={{ color: withAlpha(colors.accent, 0.16) }}
                      style={{
                        minHeight: MIN_TOUCH_TARGET - 8,
                        justifyContent: 'center',
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.full,
                        backgroundColor: selected ? colors.accent : colors.surfaceAlt,
                      }}
                    >
                      <Text variant="caption" color={selected ? colors.onAccent : colors.text}>
                        {display}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          );
        })
      )}

      {items.length > 0 ? (
        <Card>
          <Text variant="micro" tone="faint">
            {t('everyoneOwes').toUpperCase()}
          </Text>
          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
            {names.map((name, index) => (
              <View key={name} style={[styles.row, { gap: spacing.md }]}>
                <Text variant="callout" style={styles.grow}>
                  {t('personNumber', { n: index + 1 })}
                </Text>
                <Text variant="bodyStrong">{money(owed[name] ?? 0)}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  grow: { flex: 1 },
  input: { minHeight: MIN_TOUCH_TARGET, fontSize: 16 },
  price: { width: 96 },
  iconSlot: { width: 32, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
