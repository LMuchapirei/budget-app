# Budget Mobile Memory

Last updated: 2026-04-27

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
- Projections tab based on recurring transactions.
- Settings tab with theme, app lock, currency symbol, and clear data.

## Transaction Features

- Transactions support:
  - income or expense
  - amount
  - description
  - category
  - date
  - recurring flag
  - linked ledger/account via `ledgerId`
- Transactions can be added and edited.
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
- All Accounts still uses the app-level default currency because mixed-currency conversion needs exchange rates later.

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
- `src/components/forms/TransactionForm.tsx`: add/edit transaction sheet.
- `src/components/ui/TxRow.tsx`: transaction row gestures, detail sheet, audit trail.
- `src/charts/AreaChart.tsx`: cash flow chart rendering.

## Known Follow-Ups

- Add account editing and account deletion.
- Add transfer transactions between accounts.
- Add exchange-rate handling before summing mixed currencies in All Accounts.
- Add a proper date picker to transaction form.
- Clean remaining encoded text artifacts in older screens if they appear in the UI.
- Add tests once the feature set settles.

## Partial Features

- Ledger/account management:
  - Accounts can be created and selected.
  - Transactions can be assigned to accounts.
  - Account currency and masked account number display exist.
  - Missing account editing, deletion, reordering, and color/symbol customization.
- Multi-currency support:
  - Individual accounts can have their own currency symbol.
  - Transaction rows and selected account totals use account currency.
  - All Accounts uses the global/default currency and does not convert mixed currencies.
- Recurring transactions:
  - Transactions can be marked as recurring.
  - Projections read recurring transactions.
  - There is no recurring schedule engine, auto-created future transactions, custom frequency, due date, or reminder flow.
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
  - Supports add/edit, account selection, category selection, date text entry, and recurring toggle.
  - Date is still plain text rather than a picker.
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
  - Edit account name, description, currency, account number, color, and default status.
  - Delete/archive account safely.
  - Prevent deleting accounts with transactions, or offer reassignment.
  - Account opening balance.
  - Account type such as cash, bank, mobile money, credit card, loan, savings.
- Transfers:
  - Transfer money between accounts.
  - Represent transfer as linked debit/credit entries.
  - Exclude transfers from income/expense reports where appropriate.
- Budgeting:
  - Monthly category budgets.
  - Account-specific budgets.
  - Budget progress bars and over-budget warnings.
  - Carry-over budgets.
- Savings goals:
  - Goal name, target amount, deadline, linked account.
  - Contribution tracking.
  - Suggested monthly contribution.
- Bills and subscriptions:
  - Bill/subscription tracker.
  - Upcoming due dates.
  - Local notifications.
  - Missed/paid status.
- Recurring engine:
  - Frequencies: daily, weekly, monthly, yearly.
  - Start/end dates.
  - Auto-generation or confirmation of recurring entries.
  - Upcoming recurring transactions list.
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
