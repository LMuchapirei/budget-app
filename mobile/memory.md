# Budget Mobile Memory

Last updated: 2026-05-02

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
- Dashboard monthly budgets, linked-ledger savings goals, and a Bills tab for recurring expense commitments.
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
- Recurring expense transactions appear as bill/subscription commitments in the Bills tab.
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
- `src/screens/BillsScreen.tsx`: bills/subscriptions tracker with upcoming, paid, and missed occurrence views.
- `src/components/forms/TransactionForm.tsx`: add/edit transaction sheet.
- `src/components/forms/DatePickerSheet.tsx`: reusable calendar picker for single date fields.
- `src/components/forms/LedgerSheet.tsx`: add/edit account sheet with archive, set-default, and delete-with-reassignment.
- `src/components/forms/BudgetSheet.tsx`: add/edit/delete monthly category budget sheet with optional per-ledger scope and carry-over flag.
- `src/components/forms/GoalSheet.tsx`: add/edit/delete savings goals linked to active accounts with pause/resume and mark-complete actions.
- `src/components/ui/TxRow.tsx`: transaction row gestures, detail sheet, audit trail.
- `src/charts/AreaChart.tsx`: cash flow chart rendering.
- `src/utils/recurring.ts`: recurring schedule engine, occurrence generation, due dates, monthly impact estimates.
- `src/services/billNotifications.ts`: local bill reminder permission, scheduling, and cancellation through Expo Notifications.

## Known Follow-Ups

- Add transfer transactions between accounts.
- Clean remaining encoded text artifacts in older screens if they appear in the UI.
- Add tests once the feature set settles.

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
- Recurring transactions:
  - Transactions can be marked as recurring.
  - Recurring schedules support daily, weekly, monthly, and yearly frequencies.
  - Schedules support interval, first due date, optional end date, and reminder lead days.
  - The engine materializes due recurring entries locally when the app loads or a recurring transaction is saved.
  - Projections read generated future occurrences for the next 12 months.
  - Reminder lead days are used by the Bills tab for local notification scheduling.
- Bills and subscriptions:
  - The Bills tab derives commitments from recurring expense transactions.
  - Bills show due soon, upcoming, paid, and missed filters.
  - Each occurrence can be marked paid or missed, with undo.
  - Local reminders use `expo-notifications` and the recurring schedule's reminder lead days.
  - Occurrence status is stored separately from transactions so Wave 2 recurring controls can expand it later.
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
  - Amount parsing is basic and does not handle commas, symbols, or locale-specific formats.
- Categories:
  - Built-in categories exist.
  - Users can add custom categories.
  - Custom categories cannot be edited, deleted, assigned icons, or given custom colors from the UI.
- Reports:
  - Spending by category and monthly comparison exist.
  - Reports still use all transactions rather than fully respecting ledger/account and date filters everywhere.
  - No drill-down report views yet.
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
- Transfers:
  - Transfer money between accounts.
  - Represent transfer as linked debit/credit entries.
  - Exclude transfers from income/expense reports where appropriate.
- Savings goals:
  - Manual contribution mode.
  - Historical goal progress chart.
- Recurring engine:
  - Confirmation flow before posting generated entries.
  - Skip/postpone one occurrence.
  - Pause/resume a recurring schedule.
  - Mark recurring bill occurrence as paid/missed.
  - Local notification integration for stored reminder lead days.
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
