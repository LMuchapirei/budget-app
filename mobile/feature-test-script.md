# Feature Test Script

This document is the living test script for feature work in the mobile budget app. Add each feature as it lands, record how to test it, and keep notes about how the behavior evolves after real trial use.

## How To Use This File

1. Before testing, note the feature version or branch in the trial log.
2. Follow the setup and test cases for the feature.
3. Record what worked, what felt confusing, and what should change next.
4. When a feature changes, append a new trial entry instead of overwriting the old one.

## Feature Status

| Feature | Status | First Test Scope | Notes |
| --- | --- | --- | --- |
| Monthly category budgets | In progress | Dashboard, Reports, reporting currency | Wave 2 #1 |
| Savings goals | In progress | Dashboard, linked ledger balance, goal status | Wave 2 #2 |
| Date picker UX | In progress | Transaction form, recurring schedules, goal deadlines | Shared calendar picker |
| Bills & subscriptions tracker | In progress | Bills tab, confirmations, skips, local reminders | Wave 2 #3 |
| Recurring engine controls | In progress | Confirm inbox, skip, postpone, pause/resume, auto-post | Wave 2 #4 |

## Monthly Category Budgets

### What This Feature Does

Users can set a monthly spending cap per expense category, optionally scoped to a specific account. The Dashboard shows progress toward each budget, warns at 80%, marks budgets over at 100%, and Reports surfaces over-budget callouts. Budget values and progress are displayed in the selected reporting currency.

Carry-over budgets roll unused prior-month budget room into the current month. Prior overspend reduces the current month's available cap.

### Setup

1. Open the app.
2. Go to `Settings`.
3. Set the `Reporting Currency`, for example `USD` or `ZAR`.
4. Go to `Ledger`.
5. Make sure at least one account exists.
6. Optional multi-currency setup: create another account with a different currency.

### Test Case 1: Create A Basic Budget

1. On `Ledger`, scroll to the `Budgets` section.
2. Tap `Set your first budget` or `Add a budget`.
3. Pick an expense category, for example `Food`.
4. Set `Monthly cap` to `100`.
5. Keep the scope as `All accounts`.
6. Save the budget.

Expected result:

- A budget card appears on the Dashboard.
- It shows `Food`.
- It shows `0` spent out of the cap.
- The progress bar starts empty.

### Test Case 2: Progress, Warning, And Over-Budget States

1. Add an expense transaction:
   - Type: `Expense`
   - Category: same as the budget, for example `Food`
   - Amount: `50`
2. Return to the `Budgets` section.
3. Add another matching expense for `30`.
4. Add another matching expense for `25`.

Expected result:

- After `50`, the budget shows about `50%`.
- After `80`, the budget reaches the warning range.
- After `105`, the budget shows `Over`.
- The card shows how much the user is over by.

### Test Case 3: Ledger-Scoped Budget

1. Create or edit a budget.
2. Set the budget scope to a specific account.
3. Add a matching category expense in that account.
4. Add another matching category expense in a different account.

Expected result:

- Only the expense in the scoped account counts toward the scoped budget.
- The expense in the other account does not affect that budget.

### Test Case 4: Reporting Currency Conversion

1. Create two accounts with different currencies, for example `USD` and `ZAR`.
2. Set the reporting currency in `Settings`.
3. Create an `All accounts` budget.
4. Add matching expense transactions in both accounts.

Expected result:

- The budget totals are converted into the selected reporting currency.
- Amounts are not raw-summed across currencies.
- If exchange rates are unavailable, the UI should indicate that the estimate is partial or missing rates.

### Test Case 5: Reports Over-Budget Callout

1. Push any budget over 100%.
2. Go to `Reports`.

Expected result:

- An `Over Budget` section appears.
- It lists the over-budget category.
- It shows the relevant account scope or `All accounts`.
- It shows the amount over in the reporting currency.

### Test Case 6: Carry-Over

1. Create a budget with `Carry-over` enabled.
2. Add previous-month transactions in the same category.
3. Test two cases:
   - Previous month spent less than the cap.
   - Previous month spent more than the cap.

Expected result:

- If the previous month was under budget, the current cap increases by the unused amount.
- If the previous month was over budget, the current cap is reduced.
- The budget card shows a carry-over line.

### Trial Log

| Date | Tester | Build/Branch | Scenario | Result | Follow-Up |
| --- | --- | --- | --- | --- | --- |
| 2026-05-02 | Codex | Working tree | Initial implementation smoke test with TypeScript | `tsc --noEmit` passed | Manual app/device pass still needed |

### Evolution Notes

- Budgets currently support monthly periods only.
- Budget caps are stored in the reporting currency.
- Spending is converted into the reporting currency before comparison.
- Carry-over is calculated from the budget creation month through the previous month.
- Future improvement: add a month selector so testers can inspect historical budget periods directly.

## Savings Goals

### What This Feature Does

Users can create named savings goals linked to an account. The saved amount is derived from the linked account's running balance: opening balance plus income minus expenses. The Dashboard shows goal progress, deadline pacing, suggested monthly contribution, pause/resume controls, and a manual mark-complete action when the target is reached.

This v1 uses linked-ledger tracking only. Manual contribution entries are deferred.

### Setup

1. Open the app.
2. Go to `Ledger`.
3. Create or choose an active account for savings, ideally account type `Savings` or `Mobile money`.
4. Add an opening balance if you want to test a goal that already has money saved.

### Test Case 1: Create A Goal

1. On `Ledger`, scroll to the `Goals` section.
2. Tap `Create a savings goal` or `Add a goal`.
3. Enter a name, for example `Emergency fund`.
4. Pick a linked account.
5. Set a target amount in that account's currency.
6. Optional: enable a deadline, tap the target date row, and pick a future date.
7. Save the goal.

Expected result:

- A goal card appears on the Dashboard.
- It shows the linked account name.
- It shows saved amount, target amount, remaining amount, and progress percent.
- If a deadline was set, it shows days remaining and suggested monthly contribution.

### Test Case 2: Contributions Through Transactions

1. Add an `Income` transaction to the linked savings account.
2. Return to the `Goals` section.
3. Add an `Expense` transaction from the same account.

Expected result:

- Income increases the saved amount and progress bar.
- Expense decreases the saved amount and progress bar.
- No separate contribution entry is needed.

### Test Case 3: One Goal Per Ledger

1. Create a goal linked to an account.
2. Try creating another goal linked to the same account.

Expected result:

- The form blocks saving.
- A warning says another goal already uses that account.

### Test Case 4: Pause And Resume

1. Tap an active goal card.
2. Choose `Pause goal`.
3. Reopen the goal and choose `Resume goal`.

Expected result:

- A paused goal remains visible but shows a paused status.
- Suggested monthly contribution is `0` while paused.
- Resuming restores pacing calculations.

### Test Case 5: Mark Complete

1. Add enough income to the linked account so saved amount reaches or exceeds the target.
2. Return to the goal card.
3. Tap `Mark complete`.

Expected result:

- The goal first shows a ready/complete CTA instead of auto-completing.
- After tapping `Mark complete`, the goal moves into the completed goals footer.
- Tapping the completed footer opens the completed goals list.

### Test Case 6: Ledger Archive Or Delete

1. Create a goal linked to an account.
2. Archive that account.
3. Check the goal card.
4. Delete the linked account with reassignment.

Expected result:

- Archived linked accounts still compute progress, but the goal warns that the linked account is archived.
- Deleted linked accounts clear the goal link so the goal does not point at a stale account.
- Editing an orphaned goal requires picking an active account.

### Trial Log

| Date | Tester | Build/Branch | Scenario | Result | Follow-Up |
| --- | --- | --- | --- | --- | --- |
| 2026-05-02 | Codex | Working tree | Initial savings goals implementation smoke test | `tsc --noEmit` passed | Manual app/device pass still needed |

### Evolution Notes

- V1 requires a linked account; no manual contribution mode yet.
- Saved amount is the linked account running balance.
- One goal per linked account is enforced in the UI.
- Goals display in the linked account currency.
- Reached targets require a user-confirmed `Mark complete` action.
- Future improvement: manual contributions so multiple goals can share one account.

## Date Picker UX

### What This Feature Does

Date fields that used to require manual `YYYY-MM-DD` typing now open the shared calendar picker. This covers normal transaction dates, recurring first due dates, optional recurring end dates, and savings goal deadlines.

### Setup

1. Open the app.
2. Go to `Ledger`.
3. Make sure at least one active account exists.
4. For goal deadline testing, make sure at least one goal-capable account exists.

### Test Case 1: Transaction Entry Date

1. Tap `New entry`.
2. Tap the `Date` row.
3. Pick a different date from the calendar.
4. Save the transaction.

Expected result:

- The form shows the selected date in a readable format.
- The saved transaction uses the selected ISO date internally.
- No manual date typing is required.

### Test Case 2: Recurring Schedule Dates

1. Tap `New entry`.
2. Turn on `Recurring schedule`.
3. Tap `First due date` and choose a date.
4. Tap `Ends on` and choose a date after the first due date.
5. Reopen `Ends on` and choose `No end date`.

Expected result:

- First due date and end date are selected through the calendar.
- End date cannot be earlier than the first due date.
- `No end date` clears the optional end date.

### Test Case 3: Savings Goal Deadline

1. Create or edit a savings goal.
2. Turn on `Deadline`.
3. Tap the target date row and choose a future date.
4. Save the goal.

Expected result:

- New goals require a future deadline when deadline is enabled.
- The goal card shows deadline pacing and suggested monthly contribution.
- Editing an existing goal still allows reviewing older deadlines for behind-schedule goals.

### Trial Log

| Date | Tester | Build/Branch | Scenario | Result | Follow-Up |
| --- | --- | --- | --- | --- | --- |
| 2026-05-02 | Codex | Working tree | Replaced date text fields with shared calendar picker | `tsc --noEmit` passed | Manual app/device pass still needed |

### Evolution Notes

- The shared picker reuses the manually built calendar from the date range filter.
- Calendar navigation now supports future years for recurring dates and goal deadlines.
- No native date picker dependency has been added yet.

## Bills & Subscriptions Tracker

### What This Feature Does

Recurring income and expense transactions are surfaced as scheduled commitments in a dedicated `Bills` tab. Each due date can be confirmed into a real transaction, skipped, or postponed. Local reminders use the recurring schedule's `reminderDaysBefore` value.

### Setup

1. Open the app.
2. Go to `Ledger`.
3. Create an expense transaction for a bill, for example `Netflix` or `Rent`.
4. Turn on `Recurring schedule`.
5. Pick a first due date, frequency, and reminder days.
6. Save the transaction.

### Test Case 1: Schedule Appears In Bills Tab

1. Go to `Bills`.
2. Open `Due` and `Upcoming`.

Expected result:

- The recurring schedule appears as a commitment.
- The card shows due date, category, account, frequency, amount in reporting currency, and status.
- Income schedules appear too, with income-colored amounts.

### Test Case 2: Confirm With Default Values

1. Tap `Confirm` on a pending occurrence.
2. Leave the amount, date, account, and category unchanged.
3. Tap `Post transaction`.

Expected result:

- A real transaction appears in the Dashboard.
- The occurrence moves into the `Confirmed` filter.
- Stats, budgets, and reports reflect the newly posted transaction.

### Test Case 3: Confirm With Edited Amount Or Date

1. Tap `Confirm` on a pending occurrence.
2. Change the amount or post date in the confirm sheet.
3. Tap `Post transaction`.

Expected result:

- The created transaction uses the edited amount/date.
- The source recurring schedule remains unchanged.

### Test Case 4: Skip And Undo

1. Tap `Skip` on a pending occurrence.
2. Confirm the alert.
3. Switch to the `Skipped` filter.
4. Tap `Undo`.

Expected result:

- The occurrence moves to `Skipped`.
- It does not create a transaction.
- Undo returns it to the derived pending/upcoming status.

### Test Case 5: Postpone

1. Tap `Postpone` on a pending occurrence.
2. Pick a future date.

Expected result:

- The occurrence shows the new effective date.
- The occurrence appears in the `Postponed` filter.
- Projections use the postponed date.

### Test Case 6: Local Reminder Permission And Sync

1. Go to `Bills`.
2. Tap `Enable` on the reminders card.
3. Approve notification permission on the device.
4. Tap `Sync` after adding or editing another recurring schedule.

Expected result:

- Permission status changes to enabled.
- Upcoming open schedule reminders are scheduled using `reminderDaysBefore`.
- Confirmed or skipped occurrences are skipped and their scheduled reminders are cancelled.

### Trial Log

| Date | Tester | Build/Branch | Scenario | Result | Follow-Up |
| --- | --- | --- | --- | --- | --- |
| 2026-05-02 | Codex | Working tree | Bills tracker implementation smoke test | `tsc --noEmit` passed | Manual device notification pass still needed |
| 2026-05-02 | Codex | Working tree | Unified recurring controls smoke test | `tsc --noEmit` passed | Manual app/device pass still needed |

### Evolution Notes

- V1 now derives scheduled commitments from recurring income and expense transactions.
- Occurrence statuses are stored separately from transactions in `scheduled-occurrences:v2`.
- Confirm posts a real transaction; skip/postpone stay in the schedule layer.
- Local notification reminders are wired through `expo-notifications`.

## Recurring Engine Controls

### What This Feature Does

Recurring schedules no longer silently materialize every past-due occurrence. The app derives pending occurrences, lets the user confirm/skip/postpone them, supports pause/resume on the source schedule, and still supports auto-post for schedules where the user explicitly wants it.

### Setup

1. Open the app.
2. Create a recurring expense with `Auto-post without confirming` turned off.
3. Create a recurring income with `Auto-post without confirming` turned on.
4. Optional: enable `Schedule reminders` in Settings.

### Test Cases

1. Confirm a pending expense and verify a Dashboard transaction is created.
2. Skip an occurrence and verify Projections no longer count it.
3. Postpone an occurrence and verify Projections use the new date.
4. Edit a recurring schedule and change its frequency; pending records should refresh while confirmed/skipped decisions remain.
5. Pause a schedule from the edit sheet; future pending occurrences disappear.
6. Resume the schedule; it restarts from today without backfilling the pause gap.
7. Restart the app twice and verify no duplicate generated transactions or duplicate records appear.

### Trial Log

| Date | Tester | Build/Branch | Scenario | Result | Follow-Up |
| --- | --- | --- | --- | --- | --- |
| 2026-05-02 | Codex | Working tree | Recurring engine controls implementation smoke test | `tsc --noEmit` passed | Manual app/device pass still needed |

### Evolution Notes

- Expense schedules default to confirm-before-post.
- Income schedules default to auto-post.
- Users can override the auto-post mode per schedule.
- Source schedule pause/resume lives in the transaction edit sheet.

## Upcoming Feature Test Sections

Use this template when the next feature lands.

### Feature Name

#### What This Feature Does

Short description.

#### Setup

1. Step one.
2. Step two.

#### Test Cases

1. Test the happy path.
2. Test empty states.
3. Test edge cases.
4. Test reporting currency behavior if money is involved.

#### Trial Log

| Date | Tester | Build/Branch | Scenario | Result | Follow-Up |
| --- | --- | --- | --- | --- | --- |

#### Evolution Notes

- Add notes here as the feature changes.
