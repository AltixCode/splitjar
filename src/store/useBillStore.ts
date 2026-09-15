/**
 * The current bill, and the handful of preferences worth remembering between meals.
 *
 * Amounts are integer minor units everywhere, as in `src/logic/split.ts`. The bill itself is
 * deliberately NOT persisted: a bill is over when you have paid it, and reopening the app to
 * last night's restaurant is worse than a blank form. Only the defaults — the tip you usually
 * leave, the headcount you usually are — survive, because those genuinely repeat.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { Assignment, Item } from '@/logic/split';

export const BILL_CACHE_KEY = 'splitjar.prefs.v1';

/** Tip percentages offered as chips. Beyond these the user types one. */
export const TIP_PRESETS = [0, 10, 15, 18, 20, 25] as const;

export type Mode = 'even' | 'itemised';

interface BillState {
  /** Raw text, so a half-typed "12." survives a render. */
  billText: string;
  tipPercent: number;
  people: number;
  roundUp: boolean;
  mode: Mode;

  items: Item[];
  assignments: Assignment[];
  names: string[];

  setBillText: (text: string) => void;
  setTipPercent: (percent: number) => void;
  setPeople: (people: number) => void;
  toggleRoundUp: () => void;
  setMode: (mode: Mode) => void;

  addItem: (label: string, amount: number) => Item;
  removeItem: (id: string) => void;
  toggleAssignment: (itemId: string, person: string) => void;
  setNames: (names: string[]) => void;

  /** Clears the bill but keeps the defaults. The "new bill" action. */
  reset: () => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

let sequence = 0;
const nextId = () => `item-${Date.now().toString(36)}-${(sequence += 1)}`;

/** Names are positional: "Person 1..N" until the user renames them. */
const defaultNames = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => String(i + 1));

export const useBillStore = create<BillState>((set, get) => ({
  billText: '',
  tipPercent: 15,
  people: 2,
  roundUp: false,
  mode: 'even',
  items: [],
  assignments: [],
  names: defaultNames(2),

  setBillText: (billText) => set({ billText }),

  setTipPercent: (tipPercent) => {
    if (!Number.isFinite(tipPercent) || tipPercent < 0) return;
    set({ tipPercent });
    void get().persist();
  },

  setPeople: (people) => {
    if (!Number.isFinite(people) || people < 1) return;
    const capped = Math.min(Math.floor(people), 50);
    set((s) => ({
      people: capped,
      // Keep whatever the user has already named and extend or trim to fit.
      names: capped <= s.names.length
        ? s.names.slice(0, capped)
        : [...s.names, ...defaultNames(capped).slice(s.names.length)],
    }));
    void get().persist();
  },

  toggleRoundUp: () => {
    set((s) => ({ roundUp: !s.roundUp }));
    void get().persist();
  },

  setMode: (mode) => set({ mode }),

  addItem: (label, amount) => {
    const item: Item = { id: nextId(), label, amount };
    set((s) => ({ items: [...s.items, item] }));
    return item;
  },

  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
      // Drop the assignment too, or an orphan keeps a person charged for a deleted item.
      assignments: s.assignments.filter((a) => a.itemId !== id),
    })),

  toggleAssignment: (itemId, person) =>
    set((s) => {
      const existing = s.assignments.find((a) => a.itemId === itemId);
      if (!existing) return { assignments: [...s.assignments, { itemId, people: [person] }] };
      const people = existing.people.includes(person)
        ? existing.people.filter((p) => p !== person)
        : [...existing.people, person];
      return {
        assignments: s.assignments.map((a) => (a.itemId === itemId ? { ...a, people } : a)),
      };
    }),

  setNames: (names) => set({ names }),

  reset: () => set({ billText: '', items: [], assignments: [], mode: 'even' }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(BILL_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const people =
        typeof parsed.people === 'number' && parsed.people >= 1 ? Math.floor(parsed.people) : 2;
      set({
        tipPercent:
          typeof parsed.tipPercent === 'number' && parsed.tipPercent >= 0 ? parsed.tipPercent : 15,
        people,
        roundUp: parsed.roundUp === true,
        names: defaultNames(people),
      });
    } catch {
      // Corrupt preferences start at the defaults rather than crashing on launch.
    }
  },

  persist: async () => {
    const { tipPercent, people, roundUp } = get();
    try {
      await AsyncStorage.setItem(BILL_CACHE_KEY, JSON.stringify({ tipPercent, people, roundUp }));
    } catch {
      // Losing the default tip costs one tap next time.
    }
  },
}));
