import AsyncStorage from '@react-native-async-storage/async-storage';

import { BILL_CACHE_KEY, useBillStore } from '../useBillStore';

const initial = useBillStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useBillStore.setState(initial, true);
});

describe('defaults', () => {
  it('opens on an empty even split for two at 15%', () => {
    const s = useBillStore.getState();
    expect([s.billText, s.people, s.tipPercent, s.mode]).toEqual(['', 2, 15, 'even']);
  });
});

describe('headcount', () => {
  it('keeps the names the user already set when the count grows', () => {
    useBillStore.getState().setNames(['Ann', 'Bo']);
    useBillStore.getState().setPeople(4);
    const { names } = useBillStore.getState();
    expect(names.slice(0, 2)).toEqual(['Ann', 'Bo']);
    expect(names).toHaveLength(4);
  });

  it('trims names when the count shrinks', () => {
    useBillStore.getState().setNames(['Ann', 'Bo', 'Cy']);
    useBillStore.getState().setPeople(2);
    expect(useBillStore.getState().names).toEqual(['Ann', 'Bo']);
  });

  it('refuses a headcount below one', () => {
    useBillStore.getState().setPeople(0);
    expect(useBillStore.getState().people).toBe(2);
  });

  it('caps an absurd headcount rather than rendering fifty thousand rows', () => {
    useBillStore.getState().setPeople(100000);
    expect(useBillStore.getState().people).toBe(50);
  });
});

describe('items and assignments', () => {
  it('adds an item with an id', () => {
    const item = useBillStore.getState().addItem('Pizza', 1200);
    expect(item.id).toBeTruthy();
    expect(useBillStore.getState().items).toHaveLength(1);
  });

  it('gives items distinct ids within the same millisecond', () => {
    const a = useBillStore.getState().addItem('A', 100);
    const b = useBillStore.getState().addItem('B', 100);
    expect(a.id).not.toBe(b.id);
  });

  it('assigns and unassigns a person', () => {
    const item = useBillStore.getState().addItem('Pizza', 1200);
    useBillStore.getState().toggleAssignment(item.id, 'Ann');
    expect(useBillStore.getState().assignments[0]!.people).toEqual(['Ann']);
    useBillStore.getState().toggleAssignment(item.id, 'Ann');
    expect(useBillStore.getState().assignments[0]!.people).toEqual([]);
  });

  it('lets several people share one item', () => {
    const item = useBillStore.getState().addItem('Wine', 3000);
    useBillStore.getState().toggleAssignment(item.id, 'Ann');
    useBillStore.getState().toggleAssignment(item.id, 'Bo');
    expect(useBillStore.getState().assignments[0]!.people).toEqual(['Ann', 'Bo']);
  });

  it('drops the assignment when its item is deleted, so nobody is charged for a ghost', () => {
    const item = useBillStore.getState().addItem('Pizza', 1200);
    useBillStore.getState().toggleAssignment(item.id, 'Ann');
    useBillStore.getState().removeItem(item.id);
    expect(useBillStore.getState().items).toEqual([]);
    expect(useBillStore.getState().assignments).toEqual([]);
  });
});

describe('reset', () => {
  it('clears the bill but keeps the defaults worth remembering', () => {
    useBillStore.getState().setBillText('40');
    useBillStore.getState().setTipPercent(20);
    useBillStore.getState().setPeople(5);
    useBillStore.getState().addItem('Pizza', 1200);
    useBillStore.getState().reset();

    const s = useBillStore.getState();
    expect([s.billText, s.items, s.assignments]).toEqual(['', [], []]);
    expect([s.tipPercent, s.people]).toEqual([20, 5]);
  });
});

describe('persistence', () => {
  it('remembers the tip, headcount and round-up but NOT the bill', async () => {
    useBillStore.getState().setBillText('40');
    useBillStore.getState().setTipPercent(20);
    useBillStore.getState().setPeople(5);
    useBillStore.getState().toggleRoundUp();
    await useBillStore.getState().persist();

    useBillStore.setState(initial, true);
    await useBillStore.getState().hydrate();

    const s = useBillStore.getState();
    expect([s.tipPercent, s.people, s.roundUp]).toEqual([20, 5, true]);
    // Last night's bill must not come back.
    expect(s.billText).toBe('');
  });

  it('starts at the defaults when nothing is stored', async () => {
    await useBillStore.getState().hydrate();
    expect(useBillStore.getState().tipPercent).toBe(15);
  });

  it('starts at the defaults rather than throwing on corrupt state', async () => {
    await AsyncStorage.setItem(BILL_CACHE_KEY, '{{{');
    await useBillStore.getState().hydrate();
    expect(useBillStore.getState().people).toBe(2);
  });

  it('ignores stored values of the wrong shape', async () => {
    await AsyncStorage.setItem(BILL_CACHE_KEY, JSON.stringify({ tipPercent: 'lots', people: -4 }));
    await useBillStore.getState().hydrate();
    const s = useBillStore.getState();
    expect([s.tipPercent, s.people]).toEqual([15, 2]);
  });
});
