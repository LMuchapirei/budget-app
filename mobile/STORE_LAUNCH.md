# Store Launch Checklist

Everything that must be done — by you or by code — before submitting **The Budget** to the App Store and Play Store.

> Items already wired up in this branch are marked **[done]**. Items you must do manually are marked **[manual]**.

---

## 1. Crash reporting (Sentry)

**[done]** Code wiring:
- `src/services/sentry.ts` — safe init that no-ops without a DSN.
- `App.tsx` — calls `initSentry()` and exports the app wrapped with Sentry.
- `app.json` — `@sentry/react-native/expo` plugin registered (uploads source maps automatically on EAS Build).
- `package.json` — `@sentry/react-native` added as a dependency.

**[manual]** Steps you still need to do:

1. Install dependencies:
   ```sh
   npx expo install @sentry/react-native expo-sharing
   ```
2. Create a Sentry project at https://sentry.io → React Native → copy the **DSN**.
3. Add the DSN as an EAS secret so production builds get it baked in:
   ```sh
   eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://YOUR_KEY@oXXX.ingest.sentry.io/YYY"
   ```
   Locally, put the same line in a `.env` file (and add `.env` to `.gitignore` if not already).
4. (Optional but recommended) For source-map uploads on EAS Build, also add a `SENTRY_AUTH_TOKEN` secret:
   ```sh
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<token from sentry.io → Account → Auth Tokens>"
   ```
5. Verify it works: build a preview, force a crash from a hidden dev menu, confirm the issue lands in Sentry within ~30 seconds.

> Crash reporting is intentionally **disabled in `__DEV__`** (see `sentry.ts`) so local development isn't noisy.

---

## 2. Data export (CSV + JSON)

**[done]**:
- `src/services/dataExport.ts` — `exportBackupJson()` and `exportTransactionsCsv()`.
- Settings → new **Data** card with two rows that share to the OS share sheet.
- JSON backup includes every storage key, with `schemaVersion: 1` for future restore support.

**[manual]**: After running the install command above (which adds `expo-sharing`), test on a real device — the iOS Simulator's share sheet has limited destinations.

> A future enhancement: build a corresponding `importBackupJson()` so users can restore. The export already includes `schemaVersion` to make this easy.

---

## 3. Icon, splash, and store screenshots

### Icon audit (current state)

| Asset | Size | Notes |
| --- | --- | --- |
| `assets/icon.png` | 1024×1024 | **Action needed:** flat 8-bit indexed PNG. Re-export as **flattened 24-bit RGB PNG with no alpha channel** before App Store upload — App Store Connect rejects icons with any transparency. |
| `assets/adaptive-icon.png` | 1024×1024 | OK for Android adaptive foreground (the white background is set in `app.json`). |
| `assets/splash-icon.png` | 1024×1024 | OK. |
| `assets/favicon.png` | 48×48 | Web only, fine. |

**Quick fix for icon.png:** open in Figma / Preview / Photoshop, flatten on a solid background matching the brand (`#F5F1E8` is the splash color), export as PNG with no alpha.

### Splash

The splash uses `resizeMode: contain` with background `#F5F1E8`. Verified the asset is 1024×1024 — fine for Expo's auto-generation pipeline. EAS Build will downscale per device.

### Required screenshots (cannot be generated from code)

Capture these from the iOS Simulator and an Android emulator, with the app populated with realistic-looking demo data (use the seed flow if you have one, or make ~10 transactions, 1 budget, 1 goal).

**App Store (iOS) — required:**

| Device class | Pixel size (portrait) | Min count |
| --- | --- | --- |
| iPhone 6.9" (15/16 Pro Max) | 1290 × 2796 | 3 |
| iPhone 6.5" (older fallback) | 1242 × 2688 | 3 |
| iPad 13" (since `supportsTablet: true`) | 2064 × 2752 | 3 |

Capture command (with simulator open):
```sh
xcrun simctl io booted screenshot ~/Desktop/budget-shot-01.png
```

**Play Store (Android) — required:**

| Asset | Pixel size | Min count |
| --- | --- | --- |
| Phone screenshots | 1080 × 1920 (or higher, 16:9) | 2 |
| 7" tablet screenshots | 1200 × 1920 | optional |
| Feature graphic | **1024 × 500** | 1 (mandatory) |
| High-res icon | **512 × 512** | 1 (mandatory) |

Capture from Android Studio emulator: ⌘+S (Mac) / Ctrl+S (Win) → saves to `~/Desktop/Screenshots/`.

**Suggested screenshot order (both stores):**
1. Dashboard with monthly summary card + sparkline
2. A populated Bills tab (mix of due / upcoming / confirmed)
3. Budgets in progress (one over-cap to show the warning state)
4. Reports → spending by category
5. Settings → showing themes / app lock

Add bold marketing captions overlayed in Figma/Canva — the captions are what users read in the gallery.

---

## 4. Privacy declarations

### iOS Privacy Manifest

**[done]** `app.json` → `ios.privacyManifests` declares:
- `NSPrivacyTracking: false` (we don't track users across apps)
- **Collected data**: `CrashData`, `PerformanceData` — both not linked to identity, not used for tracking, purpose `AppFunctionality` (Sentry).
- **Required-reason APIs** with their reason codes:
  - `UserDefaults` → `CA92.1` (covers AsyncStorage)
  - `FileTimestamp` → `C617.1`, `0A2A.1` (covers expo-file-system + image picker)
  - `DiskSpace` → `E174.1`
  - `SystemBootTime` → `35F9.1`

**[manual]** Re-audit if you add any new native module. Apple's reason-code reference: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api

### App Store Connect → "App Privacy" form

In App Store Connect → your app → **App Privacy**, click "Get Started" and answer:

| Question | Answer |
| --- | --- |
| Do you or your third-party partners collect data? | **Yes** (because Sentry collects crash data) |
| Crash Data → linked to user identity? | **No** |
| Crash Data → used for tracking? | **No** |
| Crash Data → purpose | **App Functionality** |
| Performance Data → same as above | Same answers |
| Any other categories | **No** |

If you skip Sentry entirely (don't set the DSN), change the answer to **No, we do not collect any data** — the app is fully local in that case.

### Android → Play Console "Data Safety" form

Play Console → your app → **App content** → **Data safety**. Answers below.

| Section | Answer |
| --- | --- |
| Does your app collect or share any user data? | **Yes** (only if Sentry DSN is set; otherwise **No**) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (Sentry uses HTTPS) |
| Do you provide a way for users to request that their data be deleted? | **Yes** — via "Clear All Data" in Settings; Sentry crash data also auto-purges per their retention policy |
| **Data type collected:** | App activity → Crashes, App activity → Diagnostics |
| **Collection purpose:** | App functionality, Analytics |
| **Required or optional:** | Optional (Sentry can be disabled by uninstalling — it's not user-toggleable in-app yet, consider adding) |
| Is the data shared with third parties? | **Yes** — Sentry (crash + diagnostics for app functionality) |

> If you'd rather not deal with the data-collection forms at all, simply **don't set `EXPO_PUBLIC_SENTRY_DSN`** for the first release. The app code is already a no-op without a DSN.

---

## 5. Other store-listing prerequisites (manual)

- [ ] **Replace placeholder URLs** in `src/services/legal.ts`:
  - `PRIVACY_POLICY_URL` — must be a real, hosted URL (Notion / GitHub Pages / your domain). Both stores will reject with `example.com`.
  - `SUPPORT_EMAIL` — must be a real, monitored inbox.
- [ ] **Privacy policy content** — must explicitly mention crash data collection if Sentry is enabled, the local-first storage model, and the user's right to delete via "Clear All Data".
- [ ] **Terms of Service** — recommended even though only Play Store strictly requires it for paid apps.
- [ ] **App Store category**: Finance.
- [ ] **App Store age rating**: complete the questionnaire (almost certainly 4+).
- [ ] **Play Store content rating**: same questionnaire.
- [ ] **Long description / short description** for both stores. Mention: local-first, no account required, biometric lock, multi-currency, payment-evidence photos.
- [ ] **App Store**: keywords (100 chars total, comma-separated).
- [ ] **Promo text / what's new** for the first release.
- [ ] **Test account credentials** for the App Store reviewer — N/A here since there's no login. Mention this in the review notes.

---

## 6. Final pre-submission sanity check

Run through this flow on a clean install on a real device:

1. Onboarding completes without crash.
2. Add 1 transaction, 1 budget, 1 goal.
3. Take a payment-evidence photo.
4. Toggle App Lock on, lock screen, biometric unlock works.
5. Export full backup (JSON) → confirm file shares correctly.
6. Export transactions (CSV) → open in Numbers / Sheets, confirm columns are correct.
7. Clear all data → app returns to onboarding.
8. Re-onboard, force a deliberate JS error (or use Sentry's `Sentry.nativeCrash()` test) → confirm it lands in Sentry within 1 minute.
