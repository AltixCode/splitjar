import {
  formatMinor,
  parseAmount,
  roundUpShares,
  splitEvenly,
  splitItemised,
  tipOn,
  totalWithTip,
  type Assignment,
} from '../split';

describe('parseAmount — text to minor units', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.55', 1055],
    ['0.01', 1],
    ['', 0],
    ['.', 0],
  ])('reads %p as %p minor units', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it('accepts a comma decimal separator', () => {
    expect(parseAmount('10,55')).toBe(1055);
  });

  it('rounds a third decimal rather than truncating it', () => {
    expect(parseAmount('10.555')).toBe(1056);
    expect(parseAmount('10.554')).toBe(1055);
  });

  it('is NaN for text that is not a number', () => {
    expect(Number.isNaN(parseAmount('abc'))).toBe(true);
  });

  it('never returns a negative amount — a bill is not owed to you', () => {
    expect(parseAmount('-10')).toBe(0);
  });
});

describe('tipOn', () => {
  it('is a percentage of the bill, in minor units', () => {
    expect(tipOn(10000, 20)).toBe(2000);
  });

  it('rounds to the nearest minor unit', () => {
    // 15% of 10.33 is 1.5495 -> 155
    expect(tipOn(1033, 15)).toBe(155);
  });

  it('is zero for a zero tip', () => {
    expect(tipOn(10000, 0)).toBe(0);
  });

  it('refuses a negative tip', () => {
    expect(tipOn(10000, -5)).toBe(0);
  });
});

describe('totalWithTip', () => {
  it('adds the tip to the bill', () => {
    expect(totalWithTip(10000, 20)).toBe(12000);
  });
});

describe('splitEvenly — the part that must never lose a cent', () => {
  it('divides a clean total exactly', () => {
    expect(splitEvenly(1200, 4)).toEqual([300, 300, 300, 300]);
  });

  it('distributes the remainder one unit at a time, never dropping it', () => {
    // 10.00 across three is 3.34 / 3.33 / 3.33.
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
  });

  it('always sums back to exactly the total', () => {
    for (const total of [1, 7, 99, 1000, 1001, 123456, 9999999]) {
      for (const people of [1, 2, 3, 4, 5, 6, 7, 11, 13]) {
        const shares = splitEvenly(total, people);
        expect(shares).toHaveLength(people);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it('never differs by more than one minor unit between people', () => {
    const shares = splitEvenly(1000, 7);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it('gives one person the whole bill', () => {
    expect(splitEvenly(1234, 1)).toEqual([1234]);
  });

  it('returns nothing for a headcount below one rather than dividing by zero', () => {
    expect(splitEvenly(1000, 0)).toEqual([]);
    expect(splitEvenly(1000, -3)).toEqual([]);
  });

  it('handles a total of zero', () => {
    expect(splitEvenly(0, 3)).toEqual([0, 0, 0]);
  });
});

describe('roundUpShares', () => {
  it('rounds each share up to the next whole unit', () => {
    expect(roundUpShares([334, 333, 333]).shares).toEqual([400, 400, 400]);
  });

  it('reports how much extra that adds, so it is never hidden', () => {
    // 10.00 becomes 12.00, so 2.00 more.
    expect(roundUpShares([334, 333, 333]).extra).toBe(200);
  });

  it('leaves shares that are already whole alone, and adds nothing', () => {
    expect(roundUpShares([300, 300])).toEqual({ shares: [300, 300], extra: 0 });
  });

  it('handles an empty split', () => {
    expect(roundUpShares([])).toEqual({ shares: [], extra: 0 });
  });
});

describe('splitItemised', () => {
  const items = [
    { id: 'a', label: 'Pizza', amount: 1200 },
    { id: 'b', label: 'Wine', amount: 3000 },
    { id: 'c', label: 'Water', amount: 300 },
  ];

  it('charges each person for what they had', () => {
    const assignments: Assignment[] = [
      { itemId: 'a', people: ['Ann'] },
      { itemId: 'b', people: ['Ann', 'Bo'] },
      { itemId: 'c', people: ['Bo'] },
    ];
    // Ann: 1200 + 1500 = 2700. Bo: 1500 + 300 = 1800.
    expect(splitItemised(items, assignments, ['Ann', 'Bo'], 0)).toEqual({ Ann: 2700, Bo: 1800 });
  });

  it('splits a shared item without losing a unit', () => {
    const result = splitItemised(
      [{ id: 'a', label: 'Cake', amount: 1000 }],
      [{ itemId: 'a', people: ['Ann', 'Bo', 'Cy'] }],
      ['Ann', 'Bo', 'Cy'],
      0,
    );
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('adds the tip in proportion to what each person owes', () => {
    const result = splitItemised(
      [{ id: 'a', label: 'X', amount: 3000 }, { id: 'b', label: 'Y', amount: 1000 }],
      [{ itemId: 'a', people: ['Ann'] }, { itemId: 'b', people: ['Bo'] }],
      ['Ann', 'Bo'],
      10,
    );
    // 10% on 40.00 is 4.00, split 3:1 -> Ann 33.00, Bo 11.00.
    expect(result).toEqual({ Ann: 3300, Bo: 1100 });
  });

  it('still sums to the total with tip, whatever the proportions', () => {
    const result = splitItemised(
      [{ id: 'a', label: 'X', amount: 1033 }, { id: 'b', label: 'Y', amount: 767 }],
      [{ itemId: 'a', people: ['Ann'] }, { itemId: 'b', people: ['Bo', 'Cy'] }],
      ['Ann', 'Bo', 'Cy'],
      17,
    );
    const expected = totalWithTip(1033 + 767, 17);
    expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(expected);
  });

  it('charges nothing to someone who had nothing', () => {
    const result = splitItemised(
      [{ id: 'a', label: 'X', amount: 1000 }],
      [{ itemId: 'a', people: ['Ann'] }],
      ['Ann', 'Bo'],
      0,
    );
    expect(result.Bo).toBe(0);
  });

  it('ignores an assignment naming an item that is not on the bill', () => {
    const result = splitItemised(items, [{ itemId: 'zzz', people: ['Ann'] }], ['Ann'], 0);
    expect(result.Ann).toBe(0);
  });

  it('ignores an unassigned item rather than charging it to nobody and losing it', () => {
    // An item nobody claimed cannot be silently dropped from the total the app reports.
    const result = splitItemised(items, [{ itemId: 'a', people: ['Ann'] }], ['Ann'], 0);
    expect(result.Ann).toBe(1200);
  });
});

describe('formatMinor', () => {
  it('renders minor units as a decimal amount', () => {
    expect(formatMinor(1234, 'en-US', 'USD')).toMatch(/12[.,]34/);
  });

  it('renders zero', () => {
    expect(formatMinor(0, 'en-US', 'USD')).toMatch(/0[.,]00/);
  });

  it('still returns something readable for a locale Intl rejects', () => {
    expect(formatMinor(1234, 'not a locale', 'USD')).toContain('12.34');
  });
});
