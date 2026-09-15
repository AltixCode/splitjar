# Splitjar — what is being built

Guide item 3. Enter a bill, a tip and a headcount; get the per-person number
before the card comes back.

## The shape

One screen. Bill total, tip percentage, number of people, and the answer is
already on it — no calculate button, because there is nothing to wait for.

- Tip as a slider **and** a field. The slider is for the common case one-handed
  at a table; the field is for when the answer has to be exact.
- Round-up: round each person's share to the nearest whole unit, and show what
  that does to the tip rather than hiding it.
- Itemised mode: add line items, assign each to whoever ate it, and the split
  stops being equal. This is the higher-value half and it is behind the unlock.

## The currency question, answered honestly

Splitjar does **not** convert currencies and does not fetch a rate. It formats
whatever number is typed in the device's own locale currency via
`Intl.NumberFormat`, and the symbol shown is the device's. Nothing is claimed
about exchange rates anywhere in the app or the listing.

## Free and paid

| | Free | Unlocked |
|---|---|---|
| Even split, any tip, any headcount | ✅ | ✅ |
| Round-up | ✅ | ✅ |
| Share the result as text | ✅ | ✅ |
| Itemised split | ⬜ | ✅ |
| Saved people | ⬜ | ✅ |

## Ads

The guide asks for no banner here — the screen is small and the banner would
crowd the one number that matters. Interstitial only, at the **start of the
next bill** (the "new bill" action), never over a result, and behind the shared
pacing rules.

## Rounding, which is the whole correctness risk

Money is not floating point. Every amount is held in **minor units as an
integer** (cents), and the split is an integer division with the remainder
distributed one unit at a time across the first N people. Three people and
£10.00 gives 3.34 / 3.33 / 3.33, and the three shares add back to exactly
£10.00 — a split whose parts do not sum to the bill is the one bug this app
cannot ship with.
