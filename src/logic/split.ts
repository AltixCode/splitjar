/**
 * Splitting a bill. Pure, dependency-free, and entirely in **integer minor units**.
 *
 * Money is not floating point. `0.1 + 0.2` is 0.30000000000000004, and a bill split whose
 * parts do not add back to the total is the one defect this app cannot ship with — it is the
 * first thing a table of people notices and the only thing they will remember. So every amount
 * here is an integer count of the smallest unit (cents, pence, yen), and division distributes
 * the remainder one unit at a time rather than rounding each share independently.
 */

export interface Item {
  id: string;
  label: string;
  /** Minor units. */
  amount: number;
}

export interface Assignment {
  itemId: string;
  /** Who shared this item. An empty list means nobody claimed it. */
  people: string[];
}

/**
 * Reads a typed amount into minor units.
 *
 * Clamps at zero: a negative bill is not a thing, and letting one through produces negative
 * shares that look like the app owes the user money.
 */
export function parseAmount(text: string): number {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return 0;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return Number.NaN;
  if (value <= 0) return 0;
  return Math.round(value * 100);
}

/** The tip, in minor units. */
export function tipOn(billMinor: number, tipPercent: number): number {
  if (!Number.isFinite(billMinor) || !Number.isFinite(tipPercent) || tipPercent <= 0) return 0;
  return Math.round((billMinor * tipPercent) / 100);
}

export function totalWithTip(billMinor: number, tipPercent: number): number {
  return billMinor + tipOn(billMinor, tipPercent);
}

/**
 * Splits a total across N people so the shares differ by at most one minor unit and sum to
 * exactly the total.
 *
 * The naive version — `Math.round(total / n)` for everyone — loses or invents money: three
 * people and 10.00 gives 3.33 each and 9.99 collected. Here the base share is the integer
 * quotient and the remainder is handed out one unit at a time, which is both exact and the
 * fairest distribution possible in whole units.
 */
export function splitEvenly(totalMinor: number, people: number): number[] {
  if (!Number.isFinite(people) || people < 1) return [];
  const base = Math.floor(totalMinor / people);
  const remainder = totalMinor - base * people;
  return Array.from({ length: people }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Rounds every share up to a whole major unit, and reports how much that adds.
 *
 * The extra is returned rather than absorbed: rounding up silently increases what everyone
 * pays, and an app that does that without saying so is taking the user's money for a tidier
 * number.
 */
export function roundUpShares(shares: readonly number[]): { shares: number[]; extra: number } {
  const rounded = shares.map((share) => Math.ceil(share / 100) * 100);
  const extra = rounded.reduce((sum, r, i) => sum + (r - (shares[i] ?? 0)), 0);
  return { shares: rounded, extra };
}

/**
 * Charges each person for the items they shared, plus their proportional share of the tip.
 *
 * Every division here goes through `splitEvenly`, so a shared item and the tip are both exact.
 * The tip is apportioned by what each person owes rather than split evenly — someone who had
 * a salad should not tip for someone else's steak.
 */
export function splitItemised(
  items: readonly Item[],
  assignments: readonly Assignment[],
  people: readonly string[],
  tipPercent: number,
): Record<string, number> {
  const byPerson: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));
  const itemsById = new Map(items.map((item) => [item.id, item]));

  for (const assignment of assignments) {
    const item = itemsById.get(assignment.itemId);
    if (!item) continue;
    const sharers = assignment.people.filter((p) => p in byPerson);
    if (sharers.length === 0) continue;
    const shares = splitEvenly(item.amount, sharers.length);
    sharers.forEach((person, i) => {
      byPerson[person] = (byPerson[person] ?? 0) + (shares[i] ?? 0);
    });
  }

  const tip = tipOn(
    items.reduce((sum, item) => sum + item.amount, 0),
    tipPercent,
  );
  if (tip <= 0) return byPerson;

  // Apportion the tip by subtotal, distributing the rounding remainder so the parts still add
  // up to exactly the tip.
  const subtotalAll = Object.values(byPerson).reduce((a, b) => a + b, 0);
  if (subtotalAll <= 0) return byPerson;

  let distributed = 0;
  const entries = Object.entries(byPerson);
  entries.forEach(([person, subtotal], index) => {
    const isLast = index === entries.length - 1;
    const portion = isLast
      ? tip - distributed
      : Math.round((tip * subtotal) / subtotalAll);
    distributed += portion;
    byPerson[person] = subtotal + portion;
  });

  return byPerson;
}

/** Minor units rendered in the device's own locale and currency. */
export function formatMinor(minor: number, locale: string, currency: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(major);
  } catch {
    // A runtime or locale tag without full Intl still shows a correct number.
    return major.toFixed(2);
  }
}
