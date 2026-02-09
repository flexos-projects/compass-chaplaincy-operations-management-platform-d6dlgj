---
id: stipend-processing
title: "Stipend Payment Processing"
description: "Multi-step monthly workflow for processing chaplain stipends: period selection, qualification, adjustments, batch payouts, check numbers, and payment history"
type: spec
subtype: feature
status: draft
sequence: 6
tags: [stipends, payments, financial, workflow, p0]
relatesTo: ["docs/core/002-features.md", "docs/core/003-pages.md", "docs/core/004-database.md", "docs/core/005-flows.md", "docs/core/007-technical.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Stipend Payment Processing

## Overview

Stipend processing is the most business-critical and complex workflow in COMPASS. It replaces hours of manual spreadsheet work with a guided, server-validated process that ensures financial accuracy and complete audit trails.

The workflow spans multiple interactions on the `/stipends` page:
1. **Period selection** — Admin selects a month (e.g., January 2026)
2. **Qualification** — System identifies unpaid duty shifts in that month and groups by chaplain
3. **Adjustment** — Admin optionally applies individual shift adjustments (±$80 for special circumstances)
4. **Selection** — Admin batch-selects entries for payment (or excludes specific entries)
5. **Check number entry** — Admin enters the physical check number for the payout
6. **Processing** — Server creates immutable payout records, marks duty logs as paid, updates running totals

The stipend rate is $80 per qualifying duty shift. This rate is configurable in `app_settings.baseStipendRate` and applied server-side during calculation. Adjustments (positive or negative) can be applied to individual shifts for holidays, partial shifts, or corrections.

All financial calculations happen server-side to prevent client manipulation. The client displays previews and collects user input, but the server recalculates amounts from source data on every payout creation.

## User Stories

**US-001:** As a program director, I want to select a pay period (month) and see all qualifying chaplain duty shifts so I can begin monthly stipend processing.

**US-002:** As a program director, I want the system to automatically identify unpaid duty shifts and calculate the base stipend amount ($80 per shift) so I don't have to do this manually.

**US-003:** As an admin, I want to apply individual adjustments to specific shifts (positive for holidays, negative for partial shifts) so I can account for special circumstances.

**US-004:** As a program director, I want to batch-select multiple duty entries and create a single payout record so I can process payments efficiently without clicking 50 times.

**US-005:** As an admin, I want to enter a check number for each payout so I can track which physical check covered which shifts for reconciliation.

**US-006:** As a program director, I want to see running totals (monthly, YTD, all-time) so I can monitor the stipend budget and report to the board.

**US-007:** As an admin, I want paid entries to show a green "Paid" badge and become non-selectable so I don't accidentally process the same shift twice.

**US-008:** As a program director, I want to click a chaplain row and see their individual duty entries so I can verify shift counts before processing.

**US-009:** As an admin, I want the system to create an audit trail for every payout so there is accountability and traceability for all financial transactions.

**US-010:** As a program director, I want to navigate to a payout detail page to see the full breakdown (chaplain, shifts, amounts, check number, who processed it) so I can answer accounting questions.

## Acceptance Criteria

### Month Selection

**Given** the stipends page loads
**When** the page renders
**Then** a month selector displays 12 chips (January through December) for the current program year
**And** the current month is auto-selected with primary color fill
**And** months with completed payouts show a small green checkmark icon

**Given** the admin selects a month (e.g., "January")
**When** the chip is clicked
**Then** the chip highlights
**And** the page queries the server: `GET /api/stipends/qualifying?month=1&year=2026`
**And** the server returns qualifying chaplains with unpaid shifts grouped by chaplainId

**Given** a month has zero unpaid shifts (all already paid)
**When** the month is selected
**Then** the main table shows an empty state: "No unpaid shifts for January 2026"
**And** the summary bar shows: "Qualifying Chaplains: 0 | Total Shifts: 0 | Total Amount: $0"

### Qualifying Chaplains Table

**Given** the server returns qualifying data for January
**When** the data loads
**Then** a data table displays with expandable rows:
- **Columns:** Checkbox (batch select), Chaplain (avatar + name), Shift Count, Base Amount, Adjustments, Total Amount
- **Rows:** One per chaplain with unpaid shifts in the selected period
- **Sort:** By chaplain name ascending (default)

**Given** a chaplain row is displayed
**When** the row renders
**Then** it shows: chaplain name, count of unpaid shifts, base amount ($80 x shift count), total adjustments ($0 initially), final total

**Example row:** `[☐] Martinez, John | 4 shifts | $320 | +$0 | $320`

**Given** the admin clicks a chaplain row to expand
**When** the row expands
**Then** it reveals a nested table showing individual duty entries:
- **Columns:** Checkbox (individual select), Date, Hours Worked, Terminal, Base Amount, Adjustment, Total
- **Rows:** One per duty log entry for this chaplain
- **Initial state:** All entries checked (ready for payment)

**Given** an individual duty entry is displayed
**When** the row renders
**Then** it shows: `[☑] Jan 5, 2026 | 6.5 hrs | Terminal A | $80 | $0 | $80`

### Adjustments

**Given** a duty entry row is visible
**When** the admin clicks the "Adjust" button (or inline adjustment control)
**Then** an adjustment slider/input appears allowing values from -$80 to +$80

**Given** the admin adjusts a shift by +$20 (holiday bonus)
**When** the adjustment is applied
**Then** the entry's Total updates: `$80 + $20 = $100`
**And** the chaplain's Adjustments column updates: `+$20`
**And** the chaplain's Total Amount updates: `$320 + $20 = $340`
**And** the summary bar Grand Total updates

**Given** the admin adjusts a shift by -$40 (partial shift)
**When** the adjustment is applied
**Then** the entry's Total updates: `$80 - $40 = $40`
**And** the adjustment is stored in the entry's state (not yet written to Firestore)

**Given** multiple adjustments are applied across chaplains
**When** adjustments are made
**Then** the summary bar reflects: `Base Amount: $3,760 | Adjustments: +$60 | Grand Total: $3,820`

### Batch Selection

**Given** the qualifying chaplains table is displayed
**When** the admin clicks the header checkbox (select all)
**Then** all chaplain rows are checked
**And** all individual duty entries for all chaplains are checked
**And** the summary bar shows: "18 chaplains selected | 47 shifts | Total: $3,820"

**Given** the admin unchecks a chaplain row
**When** the checkbox is unchecked
**Then** that chaplain and all their duty entries are deselected
**And** the summary bar updates to exclude that chaplain's total

**Given** the admin expands a chaplain and unchecks specific duty entries
**When** individual entries are unchecked
**Then** only those specific entries are excluded from the payout
**And** the chaplain's row checkbox shows an indeterminate state (some but not all selected)

**Example use case:** Chaplain Kim has 3 shifts. Admin unchecks 1 shift (paying via different funding). Kim's row shows indeterminate checkbox. Processing will create payout for 2 shifts only.

### Payout Processing

**Given** entries are selected
**When** the admin clicks "Process Selected" button
**Then** the system validates: at least one entry selected
**And** a modal dialog appears: "Enter Check Number"

**Given** the check number modal is displayed
**When** the modal renders
**Then** it shows: text input labeled "Check Number", Cancel button, Confirm button

**Given** the admin enters check number "CHK-2026-0147"
**When** "Confirm" is clicked
**Then** the client calls: `POST /api/stipends/process` with request body:
```json
{
  "entries": [
    { "dutyLogId": "abc123", "amount": 80, "adjustment": 0 },
    { "dutyLogId": "def456", "amount": 100, "adjustment": 20 }
  ],
  "checkNumber": "CHK-2026-0147",
  "month": "January",
  "year": 2026
}
```

**Given** the server receives the payout request
**When** the server processes
**Then** it performs (in a Firestore batch write):
1. **Group entries by chaplainId**
2. **For each chaplain group:**
   - Create `chaplain_payouts` document with: `chaplainId`, `payoutAmount` (sum of entries), `dutyLogIds` (array), `dutyLogCount`, `checkNumber`, `monthPaid`, `yearPaid`, `createdAt`, `createdBy` (admin UID)
   - Create or update `stipend_records` document for chaplain-month with: `instancesAuthorized`, `instancesPaid`, `stipendAmount`, `adjustmentAmount`, `isCompleted: true`, `completedAt`, `processedBy`
3. **For each duty_log in entries:**
   - Set `isPaid: true`, `paymentAmount`, `paymentStatus: 'paid'`, `checkNumber`, `payoutId` (reference to chaplain_payouts doc), `processedBy`, `processedAt`
4. **Create audit_log entry** with `action: 'payout_create'` and details: month, year, chaplain count, total amount, check number

**Given** the server batch write succeeds
**When** the response returns
**Then** the client shows a success toast: "Processed $3,820 across 18 chaplains"
**And** the page refreshes qualifying data (VueFire listener auto-detects changes)
**And** processed entries show green "Paid" badge and checkboxes are disabled

**Given** the server batch write fails (e.g., network error)
**When** the error occurs
**Then** NO changes are made (batch is atomic: all or nothing)
**And** the client shows error toast: "Processing failed. No changes were made. Try again."

### Paid Entries Display

**Given** duty entries have been paid
**When** the page loads with the same month selected
**Then** paid entries appear below the main table in a collapsed section: "Processed Payments (18)"
**And** clicking the section expands it to show paid entries
**And** paid entries display: chaplain name, shift count, total amount, check number, processed date, green "Paid" badge
**And** paid entries have no checkboxes (cannot be re-selected or re-processed)

**Given** a paid entry row is clicked
**When** the click event fires
**Then** the user navigates to `/stipends/{payoutId}` detail page

### Running Totals

**Given** the stipends page is displayed
**When** qualifying data is loaded
**Then** a totals card displays:
- **Monthly Total:** Sum of all payouts for selected month
- **YTD Total:** Sum of all payouts for current year
- **All-Time Total:** Sum of all payouts ever

**Example:** `Monthly: $3,820 | YTD: $24,560 | All-Time: $147,200`

**Given** a payout is processed
**When** the payout completes
**Then** totals update immediately (VueFire listener on chaplain_payouts collection)

### Stipend Detail Page (/stipends/:id)

**Given** the admin navigates to a payout detail page
**When** the page loads with a valid payout ID
**Then** the page displays:
- **Payout header:** Chaplain name, payout amount, month/year, check number
- **Duty entries list:** All duty logs included in this payout (date, hours, terminal, amount)
- **Amount breakdown:** Base total, adjustments total, final total
- **Audit info:** Processed by (admin name), processed date, created timestamp

**Given** the payout ID is invalid or not found
**When** the page tries to load
**Then** a 404 state displays: "Payout not found" with link back to `/stipends`

## Functional Requirements

### FR-001: Server API Endpoint — Get Qualifying Entries
Route: `GET /api/stipends/qualifying?month=1&year=2026`

**Server logic:**
1. Verify admin auth and role
2. Calculate date range: first day of month 00:00:00 to last day 23:59:59
3. Query duty_logs: `where('isPaid', '==', false), where('startTime', '>=', startDate), where('startTime', '<=', endDate), where('approved', '==', true)`
4. Group by `userId`
5. For each chaplain: count shifts, fetch display name from users collection
6. Fetch base stipend rate from `app_settings.baseStipendRate`
7. Calculate base amounts: `shiftCount * baseStipendRate`
8. Return array of qualifying chaplains: `{ chaplainId, chaplainName, shifts: DutyLog[], baseAmount }`

**Response:**
```json
{
  "baseStipendRate": 80,
  "chaplains": [
    {
      "chaplainId": "user123",
      "chaplainName": "John Martinez",
      "shifts": [
        { "id": "log1", "startTime": "2026-01-05T10:00:00Z", "totalHours": 6.5, "terminal": "A" },
        { "id": "log2", "startTime": "2026-01-12T09:00:00Z", "totalHours": 7.0, "terminal": "B" }
      ],
      "baseAmount": 160
    }
  ]
}
```

### FR-002: Server API Endpoint — Process Payout
Route: `POST /api/stipends/process`

**Request body:**
```json
{
  "entries": [
    { "dutyLogId": "log1", "amount": 80, "adjustment": 0 },
    { "dutyLogId": "log2", "amount": 100, "adjustment": 20 }
  ],
  "checkNumber": "CHK-2026-0147",
  "month": "January",
  "year": 2026
}
```

**Server logic:**
1. Verify admin auth
2. **Re-calculate amounts server-side** (do NOT trust client amounts):
   - Fetch each duty_log by ID
   - Verify `isPaid == false` (prevent double-payment)
   - Apply base stipend rate from app_settings
   - Validate adjustment is within allowed range (-$80 to +$80)
   - Recalculate total: `baseRate + adjustment`
3. Group entries by chaplainId
4. Create batch write:
   - For each chaplain: create `chaplain_payouts` document
   - For each chaplain: create/update `stipend_records` document
   - For each duty_log: update with payment fields
   - Create `audit_log` entry
5. Commit batch
6. Return success with payout IDs

**Response:**
```json
{
  "success": true,
  "payoutIds": ["payout123", "payout456"],
  "totalAmount": 3820,
  "chaplainCount": 18,
  "shiftCount": 47
}
```

**Error cases:**
- Entry already paid: `{ error: "Some entries have already been paid", codes: ["ALREADY_PAID"] }`
- Invalid adjustment: `{ error: "Adjustment must be between -$80 and +$80", codes: ["INVALID_ADJUSTMENT"] }`
- Network/Firestore error: `{ error: "Processing failed. Try again.", codes: ["BATCH_WRITE_FAILED"] }`

### FR-003: Immutable Payout Records
Once created, `chaplain_payouts` documents are IMMUTABLE. Firestore security rules enforce:
```
allow update, delete: if false;
```

Corrections are made by creating NEW payout records (e.g., adjustment payout of +$20), not editing old ones.

### FR-004: Month Selector State
- Month selector state stored in URL query param: `/stipends?month=1&year=2026`
- Default: current month
- On month change, URL updates and page fetches new qualifying data
- Past months with completed payouts show checkmark icon

### FR-005: Adjustment UX
- Adjustment control: slider with +/- buttons OR numeric input with +/- 80 range
- Adjustment stored in client state until "Process" is clicked (not written to Firestore yet)
- Adjustments are per-duty-log, not per-chaplain (allows shift-specific bonuses/deductions)
- Default adjustment: $0

### FR-006: Totals Calculation
**Monthly Total:** Sum of all `chaplain_payouts` where `monthPaid == selectedMonth && yearPaid == selectedYear`

**YTD Total:** Sum of all `chaplain_payouts` where `yearPaid == currentYear`

**All-Time Total:** Sum of all `chaplain_payouts` (no filter)

Calculated via Firestore aggregation query or client-side sum from listener.

## Non-Functional Requirements

### NFR-001: Security
- All financial calculations happen server-side (client amounts are IGNORED)
- Server recalculates from source duty_logs on every payout creation
- Admin auth verified on every API call
- Firestore rules prevent direct client writes to chaplain_payouts
- Audit trail is tamper-proof (written server-side only)

### NFR-002: Performance
- Qualifying data fetch: < 3 seconds for 200 duty logs
- Payout processing: < 5 seconds for 50 entries (batch write)
- Running totals calculation: < 1 second (aggregation query or cached)

### NFR-003: Atomicity
- Payout processing uses Firestore batch write (all or nothing)
- If ANY part of the batch fails, NO changes are persisted
- User sees clear error message: "Processing failed. No changes were made."

### NFR-004: Accuracy
- Base stipend rate is configurable (not hardcoded)
- Server fetches current rate from app_settings on every calculation
- Adjustments are validated server-side (range check)
- Dollar amounts are stored as integers (cents) to avoid floating-point errors (optional enhancement)

### NFR-005: Accessibility
- Month selector chips navigable via keyboard (Tab, Enter to select)
- Adjustment slider has keyboard controls (arrows to increment/decrement)
- Success/error toasts have `role="alert"`
- Paid entries announce "Already paid" to screen readers

### NFR-006: Mobile Responsiveness
- Stipend page works on tablet (768px+)
- On mobile (< 768px), show message: "Stipend processing is best experienced on desktop or tablet"
- Simplified view on mobile: show chaplain list only, no nested entry expansion

## Dependencies

- VueFire `useCollection` for chaplain_payouts (running totals)
- Firestore batch writes for atomic payout creation
- Nuxt server API routes with Firebase Admin SDK
- `date-fns` for month date range calculations

## Edge Cases

**EC-001: Zero Qualifying Shifts**
Month has no unpaid duty logs. Show empty state: "No unpaid shifts for January 2026."

**EC-002: Partial Chaplain Selection**
Admin selects some chaplains but not all. Processing creates payouts only for selected chaplains. Unselected chaplains remain in the qualifying list.

**EC-003: Individual Entry Exclusion**
Admin unchecks 1 shift out of 3 for a chaplain. Processing pays 2 shifts. The unchecked shift remains unpaid and appears in the qualifying list next time.

**EC-004: Duplicate Payout Attempt**
Admin processes January, then tries to process January again. Server validation detects `isPaid == true` on duty logs and returns error: "These entries have already been paid."

**EC-005: Check Number Format**
No strict validation on check number format (can be alphanumeric). Admin enters "CHK-2026-0147" or "1234" — both valid.

**EC-006: Negative Total After Adjustment**
If adjustment is -$80 on an $80 shift, total is $0. Allowed. If adjustment is greater than base (invalid), server rejects with error.

**EC-007: Missing Base Stipend Rate**
If `app_settings.baseStipendRate` is null/undefined, server returns error: "Configure stipend rate in Settings before processing."

**EC-008: Concurrent Processing**
Two admins process payouts for different months simultaneously. No conflict (different duty logs). If they process the SAME month simultaneously, last write wins (but server checks isPaid, so second attempt fails with "already paid" error).

## Testing Requirements

### Unit Tests
- [ ] Date range calculation for month boundaries
- [ ] Adjustment validation (-$80 to +$80)
- [ ] Amount recalculation server-side (ignore client amounts)
- [ ] Totals aggregation (monthly, YTD, all-time)

### Integration Tests
- [ ] Qualifying data API returns correct unpaid shifts
- [ ] Payout processing API creates all documents and audit entry
- [ ] Batch write atomicity: simulate failure mid-batch, verify rollback
- [ ] Duplicate payout attempt rejected with "already paid" error

### E2E Tests
- [ ] Full flow: select month → view chaplains → apply adjustment → select all → process → verify paid badges
- [ ] Empty state: select month with zero unpaid shifts
- [ ] Partial selection: uncheck one chaplain, process, verify only selected paid
- [ ] Individual exclusion: uncheck one entry, process, verify excluded entry still unpaid
- [ ] Navigate to payout detail page, verify all fields display

## Future Enhancements (Post-v1.1)

- Electronic payments (ACH, Stripe) instead of paper checks
- Stipend period locking (prevent re-processing completed months)
- Bulk adjustment: apply $20 bonus to all shifts on a holiday
- Export stipend data to CSV for accounting
- Stipend approval workflow: pending → reviewed → approved → paid
- Multi-rate stipends: different rates for chaplains vs. interns
- 1099 generation for tax reporting
- Stipend calendar view: monthly grid showing payment history
