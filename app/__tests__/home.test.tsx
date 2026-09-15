import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import React from 'react';

import Home from '../index';
import { testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import * as interstitial from '@/monetization/interstitial';
import { useAdsConsentStore } from '@/store/useAdsConsentStore';
import { useBillStore } from '@/store/useBillStore';
import { usePremiumStore } from '@/store/usePremiumStore';

const billInitial = useBillStore.getState();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useBillStore.setState(billInitial, true);
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({ consent: { canServeAds: true, offerPrivacyOptions: false } });
});

describe('the even split', () => {
  it('shows nothing before a bill is entered', async () => {
    const { getAllByText } = await renderWithProviders(<Home />);
    expect(getAllByText('—').length).toBeGreaterThan(0);
  });

  it('divides the bill and the tip across the headcount', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('billTotal')), '100');
    // 100 + 15% = 115.00 across two is 57.50 each.
    await waitFor(() => expect(getByText(/57[.,]50/)).toBeTruthy());
  });

  it('changes the tip from a preset', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('billTotal')), '100');
    await fireEvent.press(getByLabelText(`${t('tipLabel')} 20%`));
    // 120.00 across two is 60.00 each.
    await waitFor(() => expect(getByText(/60[.,]00/)).toBeTruthy());
  });

  it('changes the headcount with the stepper', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(`${t('peopleLabel')} +`));
    expect(useBillStore.getState().people).toBe(3);
  });

  it('will not go below one person', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(`${t('peopleLabel')} −`));
    await fireEvent.press(getByLabelText(`${t('peopleLabel')} −`));
    expect(useBillStore.getState().people).toBe(1);
  });

  it('rounds shares up and says what that costs, rather than hiding it', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('billTotal')), '10');
    await fireEvent.press(getByLabelText(`${t('tipLabel')} 0%`));
    await fireEvent.press(getByLabelText(`${t('peopleLabel')} +`));
    await fireEvent.press(getByLabelText(t('roundUpLabel')));
    // 10.00 across three is 3.34/3.33/3.33; rounded up that is 4.00 each, 2.00 more.
    await waitFor(() => expect(getByText(/4[.,]00/)).toBeTruthy());
    expect(getByText(new RegExp(t('roundUpExtra', { amount: '.*' })))).toBeTruthy();
  });

  it('shares the split as text', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('billTotal')), '100');
    await fireEvent.press(getByText(t('shareResult')));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining(t('perPerson')) }));
  });

  it('does not share an empty bill', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('shareResult')));
    expect(spy).not.toHaveBeenCalled();
  });

  it('clears the bill on a new bill but keeps the tip and headcount', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('billTotal')), '100');
    await fireEvent.press(getByLabelText(`${t('tipLabel')} 20%`));
    await fireEvent.press(getByText(t('newBill')));
    const s = useBillStore.getState();
    expect(s.billText).toBe('');
    expect(s.tipPercent).toBe(20);
  });
});

describe('the itemised split', () => {
  it('offers the upgrade to a free user instead of the feature', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('modeItemised')));
    expect(alert).toHaveBeenCalledWith(t('itemisedLockedTitle'), t('itemisedLockedBody'), expect.any(Array));
    expect(useBillStore.getState().mode).toBe('even');
  });

  it('opens for a premium user', async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('modeItemised')));
    await waitFor(() => expect(getByText(t('noItems'))).toBeTruthy());
  });

  it('charges each person only for what they had', async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByLabelText, getByText, getAllByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('modeItemised')));
    await fireEvent.press(getByLabelText(`${t('tipLabel')} 0%`));
    await fireEvent.changeText(getByLabelText(t('itemNameLabel')), 'Pizza');
    await fireEvent.changeText(getByLabelText(t('itemAmountLabel')), '12');
    await fireEvent.press(getByText(t('addItemLabel')));
    await waitFor(() => expect(getByLabelText(`${t('personNumber', { n: 1 })}, Pizza`)).toBeTruthy());
    await fireEvent.press(getByLabelText(`${t('personNumber', { n: 1 })}, Pizza`));
    // Person 1 owes 12.00; person 2 owes nothing.
    await waitFor(() => expect(getAllByText(/12[.,]00/).length).toBeGreaterThan(0));
    expect(getAllByText(/0[.,]00/).length).toBeGreaterThan(0);
  });

  it('removes an item and its assignment together', async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('modeItemised')));
    await fireEvent.changeText(getByLabelText(t('itemNameLabel')), 'Pizza');
    await fireEvent.changeText(getByLabelText(t('itemAmountLabel')), '12');
    await fireEvent.press(getByText(t('addItemLabel')));
    await waitFor(() => expect(getByLabelText(t('deleteItem'))).toBeTruthy());
    await fireEvent.press(getByLabelText(t('deleteItem')));
    expect(useBillStore.getState().items).toEqual([]);
    expect(useBillStore.getState().assignments).toEqual([]);
  });
});

describe('ads', () => {
  it('shows a banner to a free user', async () => {
    const { queryByTestId } = await renderWithProviders(<Home />);
    expect(queryByTestId('banner-ad')).not.toBeNull();
  });

  it('shows no banner to a premium user', async () => {
    usePremiumStore.setState({ isPremium: true });
    const { queryByTestId } = await renderWithProviders(<Home />);
    expect(queryByTestId('banner-ad')).toBeNull();
  });

  it('never interrupts before the result — only on starting the next bill', async () => {
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('billTotal')), '100');
    expect(spy).not.toHaveBeenCalled();
    // Three "new bill" actions is where the shared pacing rule first allows one.
    await fireEvent.press(getByText(t('newBill')));
    await fireEvent.press(getByText(t('newBill')));
    await fireEvent.press(getByText(t('newBill')));
    expect(spy).toHaveBeenCalled();
  });

  it('never interrupts a premium user', async () => {
    usePremiumStore.setState({ isPremium: true });
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    const { getByText } = await renderWithProviders(<Home />);
    for (let i = 0; i < 6; i += 1) await fireEvent.press(getByText(t('newBill')));
    expect(spy).not.toHaveBeenCalled();
  });

  it('opens settings', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('settingsTitle')));
    expect(testRouter.push).toHaveBeenCalledWith('/settings');
  });
});
