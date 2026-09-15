import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerAdSlot } from '@/components/BannerAdSlot';
import { ItemisedPanel } from '@/components/ItemisedPanel';
import { Stepper } from '@/components/Stepper';
import { Button, Card, Text } from '@/components/ui';
import { getDeviceLanguage, t } from '@/i18n';
import {
  formatMinor,
  parseAmount,
  roundUpShares,
  splitEvenly,
  tipOn,
  totalWithTip,
} from '@/logic/split';
import { shouldShowInterstitial } from '@/monetization/adPolicy';
import { shouldShowAds } from '@/monetization/entitlements';
import { showInterstitial } from '@/monetization/interstitial';
import { TIP_PRESETS, useBillStore } from '@/store/useBillStore';
import { usePremiumStore } from '@/store/usePremiumStore';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

/**
 * The device's own currency, derived from its locale.
 *
 * Splitjar does not convert currencies and never fetches a rate — it formats the number typed
 * in, in the currency the phone is already set to. Anything else would be a claim about
 * exchange rates that the app does not make.
 */
function deviceCurrency(locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })
      .resolvedOptions();
    return parts.currency ?? 'USD';
  } catch {
    return 'USD';
  }
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = useTheme();

  const billText = useBillStore((s) => s.billText);
  const tipPercent = useBillStore((s) => s.tipPercent);
  const people = useBillStore((s) => s.people);
  const roundUp = useBillStore((s) => s.roundUp);
  const mode = useBillStore((s) => s.mode);
  const setBillText = useBillStore((s) => s.setBillText);
  const setTipPercent = useBillStore((s) => s.setTipPercent);
  const setPeople = useBillStore((s) => s.setPeople);
  const toggleRoundUp = useBillStore((s) => s.toggleRoundUp);
  const setMode = useBillStore((s) => s.setMode);
  const reset = useBillStore((s) => s.reset);
  const hydrate = useBillStore((s) => s.hydrate);

  const isPremium = usePremiumStore((s) => s.isPremium);
  const isReady = usePremiumStore((s) => s.isReady);

  const billsCompleted = useRef(0);
  const lastInterstitialAt = useRef(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const locale = getDeviceLanguage();
  const currency = useMemo(() => deviceCurrency(locale), [locale]);
  const money = (minor: number) => formatMinor(minor, locale, currency);

  const bill = parseAmount(billText);
  const hasBill = Number.isFinite(bill) && bill > 0;
  const tip = tipOn(bill, tipPercent);
  const total = totalWithTip(bill, tipPercent);

  const evenShares = splitEvenly(total, people);
  const rounded = roundUpShares(evenShares);
  const shares = roundUp ? rounded.shares : evenShares;
  const perPerson = shares[0] ?? 0;

  /**
   * The interstitial runs when the user starts the NEXT bill — never over a result. The number
   * on this screen is the whole reason the app was opened, and covering it is the one thing
   * that would make someone delete it at the table.
   */
  const newBill = () => {
    billsCompleted.current += 1;
    if (
      shouldShowAds({ isPremium, isReady }) &&
      shouldShowInterstitial({
        gamesPlayed: billsCompleted.current,
        lastInterstitialAt: lastInterstitialAt.current,
        now: Date.now(),
        adsRemoved: isPremium,
      }) &&
      showInterstitial()
    ) {
      lastInterstitialAt.current = Date.now();
    }
    reset();
  };

  const share = async () => {
    if (!hasBill) return;
    const lines = [
      `${t('totalWithTipLabel')}: ${money(total)}`,
      `${t('tipLabel')} ${tipPercent}%: ${money(tip)}`,
      `${t('perPerson')}: ${money(perPerson)}`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  const chooseItemised = () => {
    if (!isPremium) {
      Alert.alert(t('itemisedLockedTitle'), t('itemisedLockedBody'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('removeAdsCta'), onPress: () => router.push('/paywall') },
      ]);
      return;
    }
    setMode('itemised');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.base,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
          gap: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text variant="title" style={styles.grow}>
            {t('appName')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settingsTitle')}
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={styles.iconSlot}
          >
            <Feather name="settings" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="micro" tone="faint">
            {t('billTotal').toUpperCase()}
          </Text>
          <View
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              paddingHorizontal: spacing.base,
              minHeight: 64,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={billText}
              onChangeText={setBillText}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={t('enterBill')}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={t('billTotal')}
              maxFontSizeMultiplier={1.3}
              style={[styles.billInput, { color: colors.text }]}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="micro" tone="faint">
            {`${t('tipLabel').toUpperCase()}  ${tipPercent}%`}
          </Text>
          <View style={[styles.chips, { gap: spacing.sm }]}>
            {TIP_PRESETS.map((preset) => {
              const selected = preset === tipPercent;
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${t('tipLabel')} ${preset}%`}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setTipPercent(preset);
                  }}
                  android_ripple={{ color: withAlpha(colors.accent, 0.16) }}
                  style={{
                    minHeight: MIN_TOUCH_TARGET,
                    minWidth: MIN_TOUCH_TARGET + 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    backgroundColor: selected ? colors.accent : colors.surfaceAlt,
                  }}
                >
                  <Text variant="callout" color={selected ? colors.onAccent : colors.text}>
                    {`${preset}%`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Stepper
          label={t('peopleLabel')}
          value={people}
          onChange={setPeople}
          decrementLabel={`${t('peopleLabel')} −`}
          incrementLabel={`${t('peopleLabel')} +`}
        />

        <Card>
          <Text variant="micro" tone="faint">
            {t('perPerson').toUpperCase()}
          </Text>
          <Text variant="display" style={{ marginTop: spacing.xs }}>
            {hasBill ? money(perPerson) : '—'}
          </Text>
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            <Text variant="caption" tone="muted">
              {`${t('totalWithTipLabel')}: ${hasBill ? money(total) : '—'}`}
            </Text>
            <Text variant="caption" tone="muted">
              {`${t('tipAmountLabel')}: ${hasBill ? money(tip) : '—'}`}
            </Text>
            {roundUp && rounded.extra > 0 ? (
              <Text variant="caption" tone="accent">
                {t('roundUpExtra', { amount: money(rounded.extra) })}
              </Text>
            ) : null}
          </View>
        </Card>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: roundUp }}
          accessibilityLabel={t('roundUpLabel')}
          onPress={toggleRoundUp}
          style={[styles.switchRow, { minHeight: MIN_TOUCH_TARGET, gap: spacing.md }]}
        >
          <Feather
            name={roundUp ? 'check-square' : 'square'}
            size={20}
            color={roundUp ? colors.accent : colors.textFaint}
          />
          <Text variant="callout" style={styles.grow}>
            {t('roundUpLabel')}
          </Text>
        </Pressable>

        <View style={[styles.chips, { gap: spacing.sm }]}>
          <Button
            label={t('modeEven')}
            variant={mode === 'even' ? 'secondary' : 'ghost'}
            size="sm"
            onPress={() => setMode('even')}
          />
          <Button
            label={t('modeItemised')}
            icon={isPremium ? undefined : 'lock'}
            variant={mode === 'itemised' ? 'secondary' : 'ghost'}
            size="sm"
            onPress={chooseItemised}
          />
        </View>

        {mode === 'itemised' && isPremium ? (
          <ItemisedPanel money={money} tipPercent={tipPercent} />
        ) : null}

        <View style={[styles.chips, { gap: spacing.sm, marginTop: spacing.sm }]}>
          <Button label={t('shareResult')} icon="share-2" variant="secondary" size="sm" disabled={!hasBill} onPress={() => void share()} />
          <Button label={t('newBill')} icon="refresh-cw" variant="ghost" size="sm" onPress={newBill} />
        </View>
      </ScrollView>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  iconSlot: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  billInput: { fontSize: 34, lineHeight: 42, fontWeight: '700', letterSpacing: -1, padding: 0 },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
});
