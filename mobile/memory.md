# Budget Mobile Memory

Last updated: 2026-05-03

## Project

- Workspace: `C:\Users\linval\Desktop\prototypes\budget-app\mobile`
- App: Expo React Native budgeting app.
- Entry: `./index.ts` in `package.json`.
- Reanimated was removed because it caused opaque iOS runtime crashes. Do not reintroduce `react-native-reanimated` unless the native/dev-build setup is verified first.

## Current Core Features

- Local-first data storage with AsyncStorage through `src/services/storage.ts`.
- Theme support through `ThemeContext`.
- App lock through Expo Local Authentication.
- Ledger tab with dashboard cards, cash flow chart, recent entries, and date filter.
- Reports tab with spending by category and monthly comparison.
- Projections tab based on recurring schedules.
- Recurring schedule engine for daily, weekly, monthly, and yearly schedules.
- Dashboard monthly budgets, linked-ledger savings goals, and a Bills tab for recurring income/expense commitments with optional payment proof.
- Settings tab with theme, app lock, currency symbol, and clear data.

## Transaction Features

- Transactions support:
  - income or expense
  - amount
  - description
  - category
  - date
  - recurring flag and recurring schedule
  - linked ledger/account via `ledgerId`
- Transactions can be added and edited.
- Recurring transactions appear as scheduled commitments in the Bills tab before posting unless auto-post is enabled.
- Editing writes a `TransactionEditHistory` record with:
  - before transaction
  - after transaction
  - edit timestamp
  - monthly projection delta
  - annual projection delta
- Recent entry gestures:
  - swipe left reveals delete
  - swipe right reveals edit
  - tap opens transaction details and audit trail
- Transaction details show linked account, currency, masked account number, and audit trail.

## Ledger / Account Features

- Ledger accounts are represented by `LedgerAccount`.
- Default account: `Cash Ledger`.
- Existing transactions are migrated to the default ledger if they do not have `ledgerId`.
- Ledger tab supports:
  - All Accounts view
  - individual account selection
  - account summary card
  - add-account sheet
- Account fields:
  - name
  - description
  - color
  - currency code
  - currency symbol
  - optional account number
- Account numbers are stored locally but displayed masked with `maskAccountNumber`, e.g. `**** 1234`.
- Selected account currency is used for:
  - ledger card totals
  - transaction form amount prefix
  - transaction row amount
  - transaction details amount
- All Accounts converts mixed-currency totals into the selected reporting currency using cached exchange rates when needed.

## Recent Fixes

- Cash flow chart changed from daily spike lines to cumulative income/expense totals.
- Chart x-axis label clipping was improved.
- Recent entry title layout was fixed so long titles can wrap.
- Transaction form bug fix:
  - keyboard dismisses on submit
  - submit button works while fields are focused
  - selected account/currency is resolved before saving
  - submit is disabled if amount, description, or account is missing

## Important Files

- `src/context/BudgetContext.tsx`: main budget state, transactions, ledgers, edit history, scoped stats.
- `src/services/storage.ts`: AsyncStorage persistence.
- `src/types/index.ts`: data models.
- `src/screens/DashboardScreen.tsx`: Ledger tab UI, account selector, add account sheet, cash flow, recent entries.
- `src/screens/BillsScreen.tsx`: scheduled commitments tracker with due, upcoming, confirmed, skipped, and postponed views.
- `src/components/forms/ConfirmOccurrenceSheet.tsx`: confirm-before-post sheet for recurring occurrence amount/date/account overrides.
- `src/components/forms/PaymentEvidenceSheet.tsx`: add/view/remove bill payment proof from a scheduled occurrence.
- `src/components/forms/PaymentEvidencePreviewSheet.tsx`: focused proof preview for attached photos, pasted alerts, and parsed details.
- `src/components/forms/TransactionForm.tsx`: add/edit transaction sheet.
- `src/components/forms/DatePickerSheet.tsx`: reusable calendar picker for single date fields.
- `src/components/forms/LedgerSheet.tsx`: add/edit account sheet with archive, set-default, and delete-with-reassignment.
- `src/components/forms/BudgetSheet.tsx`: add/edit/delete monthly category budget sheet with optional per-ledger scope and carry-over flag.
- `src/components/forms/GoalSheet.tsx`: add/edit/delete savings goals linked to active accounts with pause/resume and mark-complete actions.
- `src/components/forms/TransferForm.tsx`: add/edit/delete account transfers, including cross-currency received amounts.
- `src/components/forms/QuickActionsSheet.tsx`: command-palette overlay with live transaction search and quick-action chips, opened from a Search button on the Header.
- `src/components/forms/AddCategorySheet.tsx`: add/edit/delete sheet for custom categories with color swatches, icon picker, and a delete-with-reassignment flow. Also exports `Field`, `getCategoryIcon`, and `CATEGORY_ICONS`.
- `src/components/forms/CategoryManagerSheet.tsx`: list of custom + built-in categories with edit affordance and a "+ New" button per type. Opened from Settings > Customization.
- `src/screens/OnboardingScreen.tsx`: 4-slide first-launch intro with privacy policy link and a data-handling summary opener.
- `src/components/forms/DataHandlingSheet.tsx`: in-app data-handling summary that mirrors the Play Console data-safety form. Linked from onboarding and Settings.
- `src/services/legal.ts`: editable constants for the privacy policy URL and support email surfaced in onboarding and Settings.
- `src/context/OnboardingContext.tsx`: tiny context exposing `replay()` so Settings can re-open the intro after first run.
- `src/components/ui/MonthlySummary.tsx`: unified dashboard summary card with net balance, sparkline, income/spent/savings metrics, and period-over-period deltas.
- `src/components/ui/Sparkline.tsx`: tiny axis-less SVG sparkline used inside summary card.
- `src/components/ui/TxRow.tsx`: transaction row gestures, detail sheet, audit trail.
- `src/charts/AreaChart.tsx`: cash flow chart rendering.
- `src/utils/recurring.ts`: recurring schedule engine, occurrence generation, due dates, monthly impact estimates.
- `src/utils/paymentEvidence.ts`: local parsing and labels for pasted SMS/email/reference evidence.
- `src/services/scheduledNotifications.ts`: local schedule reminder permission, scheduling, and cancellation through Expo Notifications.
- `src/services/paymentEvidenceFiles.ts`: stores selected proof photos in app document storage and removes them when evidence is deleted.
- `src/services/billNotifications.ts`: deprecated aliases for the older bill reminder function names.

## Known Follow-Ups

- Clean remaining encoded text artifacts in older screens if they appear in the UI.
- Add tests once the feature set settles.
- Replace the placeholder privacy policy URL in `src/services/legal.ts` with the production-hosted page before submitting to the Play Store.

## Quick actions and search

- The Header has a Search button (top-right of the title row) that opens a Quick Actions sheet from anywhere in the app.
- The sheet doubles as a command palette: an empty search shows quick action chips (Add expense, Add income, Transfer, jump to Bills/Reports/Projections); typing filters across description, category, ledger name, transfer counterpart name, and amount.
- Transfer pairs are collapsed in search results — only the "out" half is shown to avoid duplicates. Tapping a transfer result opens the TransferForm; tapping a regular transaction opens the TransactionForm.
- "Add expense" and "Add income" share a single TransactionForm; the type is preselected via the new `initialType` prop.

## Onboarding

- 4-slide first-launch intro: Welcome, Track, Plan, Privacy first.
- Pager uses a horizontal `ScrollView` with `pagingEnabled` so no native module is required.
- Status persisted under `budget:onboarded:v1` (ISO timestamp). `clearAllData` does not touch it.
- The privacy slide links to the privacy policy URL and opens the in-app data-handling summary.
- Settings has an About card with `How data is handled`, `Privacy policy`, and `Show intro again` rows. Replay is wired through `OnboardingContext` so the layout re-renders the intro on demand.

## Partial Features

- Budgets:
  - Monthly per-category caps with optional per-account scope.
  - Spent / cap / remaining shown on the dashboard with progress bars.
  - Status colors: safe under 80%, warning 80-99%, over at or above 100%.
  - Spent is calculated for the current calendar month, with reporting-currency conversion when the budget is "All accounts".
  - Carry-over applies unused prior-month budget room to the current cap and reduces the cap after prior overspend.
  - Reports surface over-budget categories.

- Savings goals:
  - Goals are linked-ledger-only in v1.
  - A linked account can back one goal at a time.
  - Saved amount is derived from ledger running balance: opening balance plus income minus expenses.
  - Goals support optional deadlines, pause/resume, delete, and manual mark-complete.
  - Goal cards show saved / target, remaining, pacing, deadline countdown, suggested monthly contribution, and archived/currency warnings.
  - Completed goals collapse into a completed footer/list on the Dashboard.

- Ledger/account management:
  - Accounts can be created, edited, archived, restored, and deleted from the dashboard.
  - Edit sheet supports name, description, account type, currency, account number, opening balance, and color.
  - Archive hides an account from chips and the transaction form selector but keeps its history.
  - Delete is blocked for the default account; otherwise it requires reassigning linked transactions to another active account.
  - Default account flag can be moved between accounts from the edit sheet.
  - Reordering is not implemented yet.
- Multi-currency support:
  - Individual accounts can have their own currency symbol.
  - Transaction rows and selected account totals use account currency.
  - All Accounts, budgets, reports, and projections convert mixed-currency values into the selected reporting currency where appropriate.
- Transfers:
  - The floating add button lets users choose a normal income/expense entry or a transfer between accounts.
  - Transfers are represented as linked debit/credit entries with a shared `transferPairId`.
  - Same-currency transfers use the same amount on both sides.
  - Cross-currency transfers auto-convert when cached rates are available and require a manual received amount when rates are missing.
  - Editing a transfer opens the transfer form and updates both linked entries together.
  - Removing either transfer half removes the pair.
  - Transfers affect individual account balances but are excluded from headline income/expense stats, budgets, reports, and cash-flow charts.
  - All Accounts recent entries collapse each transfer pair into one visible row and expose a dedicated Transfers filter.
- Recurring transactions:
  - Transactions can be marked as recurring.
  - Recurring schedules support daily, weekly, monthly, and yearly frequencies.
  - Schedules support interval, first due date, optional end date, and reminder lead days.
  - Expense schedules default to confirm-before-post; income schedules default to auto-post.
  - Users can override auto-post per recurring schedule.
  - Due occurrences are derived into a scheduled occurrence inbox instead of silently materializing.
  - Confirming an occurrence posts a real transaction with `generatedFromRecurringId` and `generatedOccurrenceDate`.
  - Users can skip or postpone a single occurrence.
  - Source schedules can be paused/resumed from the transaction edit sheet; resume starts from today without backfill.
  - Projections read scheduled occurrences so skipped, postponed, and paused schedules are reflected.
  - Reminder lead days are used for local notification scheduling across recurring income and expenses.
- Bills and subscriptions:
  - The Bills tab derives commitments from recurring income and expense transactions.
  - Bills show due, upcoming, confirmed, skipped, and postponed filters.
  - Each occurrence can be confirmed, skipped, postponed, or undone when applicable.
  - Occurrences can carry payment evidence: receipt/payment photo, pasted SMS alert, pasted email alert, or manual reference/note.
  - The confirm sheet can attach proof before posting; the Bills card can open a proof sheet after posting.
  - Pasted proof is parsed locally for amount, date, currency, and reference confidence.
  - Attached proof rows open a preview sheet with full image/text detail, parsed fields, and remove action.
  - SMS/email proof analysis tags paid amount separately from balance/fees and surfaces merchant, reference, account hint, status, channel, date, currency, and match-quality insights.
  - The parser recognizes ZWG/ZWL alerts and filters account numbers, dates, and times out of amount detection.
  - Proof photos use `expo-image-picker` and are copied into app document storage through `expo-file-system`.
  - Bank/wallet transaction matching is modeled as a future `bank_match` evidence type but is not integrated yet.
  - Local reminders use `expo-notifications` and the recurring schedule's reminder lead days.
  - Occurrence status is stored separately from transactions in `budget:scheduled-occurrences:v2`.
  - Payment evidence is stored separately from transactions in `budget:payment-evidence:v1`.
  - `app.json` registers the `expo-notifications` plugin so EAS / dev builds get correct iOS prompts and Android channels.
  - Notifications and scheduled records are pruned when the source recurring transaction is deleted, has pending schedule records refreshed, or when `clearAllData` runs.
  - Schedule notifications auto-sync once on app load when permission is already granted.
  - Settings has a top-level Schedule reminders row with toggle, "Sync now", and an Open device settings shortcut when blocked.

- Theme customization:
  - Six theme presets ship: Warm Cream (default), Slate, Forest, Marine, Plum, Carbon - each with light and dark palettes.
  - Appearance mode is tri-state: Light, Dark, or Auto (follows system).
  - Accent color override replaces the preset's accent (used for FAB, primary buttons, focus highlights). "Auto" restores the preset default.
  - Preferences persist under `budget:theme:v2` with migration from the legacy `budget:theme:v1` light/dark string.
  - All UI consumes tokens via `useTheme().colors`, so presets/accent flow everywhere with no per-component changes.

- Font customization:
  - Four bundled Google Font pairs ship: Fraunces / Inter (default), Jost (all sans), Playfair / Inter, DM Serif / DM Sans.
  - Font selection lives in Settings under the Theme card with a live preview row per pair.
  - The `fonts` object in `theme.ts` is mutated in place by `setActiveFontPair`; `ThemeContext` bumps a `_fontPair` field on the colors object so every `useMemo([colors])` recomputes and picks up the new font without an app restart.
  - All fonts are bundled at build time. Runtime download from Google Fonts is intentionally not implemented yet.
  - The previous circular import between `theme.ts` and `ThemeContext.tsx` is removed; `theme.ts` no longer depends on `lightColors`.
- Transaction audit trail:
  - Edits are recorded with before/after data and projection impact.
  - Audit trail is shown in transaction details and projections.
  - Deletions are not audited yet.
  - Account/ledger changes are captured in the before/after object but not summarized clearly in audit text yet.
- Transaction details:
  - Tap-to-view details exists.
  - Shows account, currency, masked number, amount, metadata, and audit history.
  - No notes, attachments, merchant, payment method, or tags yet.
- Transaction form:
  - Supports add/edit, account selection, category selection, calendar date picking, and recurring schedule setup.
  - Entry dates and recurring first/end dates use the shared calendar picker.
  - Recurring setup includes an auto-post toggle and pause/resume action in edit mode.
  - Amount parsing is basic and does not handle commas, symbols, or locale-specific formats.
- Categories:
  - Built-in categories live in `theme.ts` and stay read-only.
  - Custom categories support add, rename, recolor, icon assignment, and delete from Settings > Customization > Manage categories.
  - `CustomCategory` carries an optional `icon` field (Lucide name) rendered through `getCategoryIcon`.
  - Renames propagate automatically to existing transactions and budgets so historical data stays linked.
  - Delete blocks if the category has linked transactions until the user picks a reassignment target (built-in or another custom of the same type).
  - The category manager exposes a per-type tab (Expense / Income), a + New button, and a read-only Built-in section that still shows live transaction counts.
- Reports:
  - Scope chip at the top shows the active period and selected ledger.
  - "Spending by Category" respects both the active ledger (via `scopedTransactions`) and the active date filter.
  - "Monthly Comparison" stays on a 6-month rolling window regardless of date filter, but respects the active ledger.
  - Tapping a category row opens a drill-down sheet listing the contributing transactions for the active period and scope, using the standard `TxRow` component.
  - "Over Budget" alerts continue to read from `budgetProgress` (current calendar month).
- Cash flow:
  - Dashboard cash flow now uses cumulative income/expense totals.
  - It does not yet show net balance line, account-specific legend labels, or tooltip/tap inspection.
- App lock:
  - Biometrics/passcode lock exists.
  - No PIN-only fallback inside the app.
- Data safety:
  - Local AsyncStorage persistence exists.
  - No manual export/import yet.
  - No cloud backup or online sync yet.

## Yet To Be Implemented

- Account management:
  - Reorder accounts in the chip strip.
  - Per-account credit limit / overdraft warning for credit cards and loans.
- Savings goals:
  - Manual contribution mode.
  - Historical goal progress chart.
- Search and filters:
  - Search by description, amount, category, account, and date.
  - Filter by account, category, type, recurring status, and amount range.
  - Sort recent entries.
- Transaction enhancements:
  - Notes.
  - Merchant/payee.
  - Payment method.
  - Tags.
  - Split transactions across categories/accounts.
  - Attach receipts/images.
  - Duplicate transaction.
- Reports and insights:
  - Account-scoped reports.
  - Date-range-aware reports throughout.
  - Net worth/account balance over time.
  - Top spending categories.
  - Month-over-month comparisons.
  - Unusual spending insights.
  - Exportable reports.
- Import/export:
  - CSV export.
  - JSON backup export.
  - Restore/import flow.
  - Data migration/versioning strategy.
- Cloud and backup:
  - Online account/auth.
  - Cloud backup.
  - Multi-device sync.
  - Conflict resolution.
  - Encrypted remote storage.
- Security:
  - PIN fallback.
  - Optional local data encryption.
  - Hide balances/privacy mode.
- Quality:
  - Unit tests for context logic.
  - Component tests for forms and ledger selection.
  - Manual QA checklist for iOS/Android.
  - Crash/error reporting.
