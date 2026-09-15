# Splitjar — handoff

What was actually run, and what is still unknown. **Unverified is `UNKNOWN`,
never a pass** — a green build is not a verification.

Last updated: 2026-09-15 (device pass complete, both platforms driven)

## Verification state

| Gate | State | Evidence |
|---|---|---|
| Lint | ✅ | `npm run lint` clean |
| Typecheck | ✅ | `npx tsc --noEmit` clean |
| Unit tests | ✅ | 252 passing, coverage thresholds met |
| i18n completeness (14 locales) | ✅ | `14 locales × 73 keys — complete` |
| UI rules (colour tokens, `t()`) | ✅ | `check-ui-rules: 13 files clean` |
| iOS + Android bundle export | ✅ | `npx expo export` both platforms |
| CI green on a self-hosted runner | ⬜ | |
| `check:release` with real identifiers | ✅ | AdMob + RevenueCat ids present |
| Builds, installs, launches on the iOS simulator | ✅ | iPhone 17 / iOS 27; alive, no UIScene death in the device log |
| Renders in light **and** dark on device | ✅ | both appearances captured on both platforms |
| Every feature driven on the Android emulator | ✅ | bill, tip presets, headcount, round-up, paywall gate, persistence |
| Purchase flow exercised against a real offering | ⬜ | |
| Ads served under real consent | ✅ | test banner on Android; ATT declined and the UMP form completed on iOS |

## Store and service state

| | State | Id |
|---|---|---|
| Bundle id registered | ✅ | `com.altixcode.splitjar` (ASC `YDJ4H9DK5Z`) |
| App Store Connect record | ⬜ | |
| iOS IAP created and priced | ⬜ | |
| Play Console app | ⬜ | |
| Play AAB uploaded (internal) | ⬜ | |
| Play in-app product | ⬜ | |
| AdMob apps (iOS + Android) | ✅ | `ca-app-pub-2504845459806550~2550869855` / `~2549199202` |
| AdMob ad units (6) | ✅ | banner, interstitial, rewarded per platform, read back from AdMob |
| AdMob GDPR + US-states messages published | ⬜ | |
| RevenueCat project, apps, entitlement, offering | ✅ | `proj05808841`; `remove_ads`; `default`/`$rc_lifetime` |

## Decisions the owner owns

- Publish on altixcode.com and itsata.com? **Not yet asked.**

## What was proved on device, and how

| Claim | The artifact |
|---|---|
| The even split is right | 100.00 at 15% across two reads `$57.50` each, `Total with tip: $115.00`, `Tip amount: $15.00`, in the live view hierarchy |
| **The remainder is not lost** | 10.00 at 0% across three reads **`$3.34`** — on Android *and* on iOS. Rounding each share independently would read 3.33 and the table would collect 9.99 |
| Round-up is honest about its cost | rounding those shares shows `$4.00` each and the line "Rounding up adds $2.00 to the tip" |
| Itemised splitting is gated | a free user tapping it gets "Itemised splitting is part of the unlock" and the upgrade, not the feature |
| The bill is deliberately NOT persisted | after force-stop the app's store holds `{"tipPercent":0,"people":3,"roundUp":true}` and no bill. Reopening to last night's restaurant would be worse than a blank form |
| Ads serve | a Google test banner rendered on Android |
| The consent chain works | ATT declined and the UMP form completed on iOS with idb |

## Known UNKNOWNs

- **The purchase flow has never been exercised** — no App Store Connect record,
  so no store product, so the offering carries no package. The paywall shows
  its "store unavailable" state, which is correct.
- **The GDPR consent message is not published in AdMob**, so an EEA user sees
  no ads at all. What ran on the simulator was Google's test form.
- **No App Store Connect or Play Console record.** ASC needs a human sign-in.
