---
id: flow_stipend-processing-flow
title: "Monthly Stipend Processing Flow"
description: "Complete end-to-end workflow for processing monthly chaplain stipend payments including period selection, qualification calculation, adjustments, batch approval, check number entry, and payout record creation"
type: spec
subtype: flow
status: draft
sequence: 29
tags: [flow, stipend, payment, financial, admin, critical]
relatesTo: [docs/core/005-flows.md, docs/core/007-technical.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Monthly Stipend Processing Flow

## Overview
The Monthly Stipend Processing Flow is the most complex and business-critical workflow in COMPASS. It replaces hours of manual spreadsheet work with a guided, auditable process for calculating and recording chaplain stipend payments. This flow handles financial data and must be implemented with strict validation, error handling, and audit trails.

**Complexity:** High (8 phases, 17 steps, multiple Firestore writes, financial calculations)

**Criticality:** P0 – Errors in this flow directly affect chaplain compensation

## Trigger
Admin navigates to Stipends page (`/stipends`) and selects a pay period month

## Primary Actor
Chaplaincy program administrator with financial processing authority

## Related Features
- F-007 Stipend Processing (primary)
- F-008 Payout Records
- F-013 Audit Log
- F-005 Duty Tracking (source data)

## Related Collections
- `duty_logs` (read/write) – Source data, marked as paid after processing
- `chaplain_payouts` (write) – Immutable payment records created
- `stipend_records` (write) – Per-chaplain per-period summaries
- `users` (read) – Chaplain names and details
- `app_settings` (read) – Current stipend rate ($80 default)
- `audit_log` (write) – Financial audit trail

</flex_block>

<flex_block type="flow" title="Stipend Processing Flow Steps">

## Phase 1: Period Selection

### Step 1: Select Pay Period
- **Actor:** User
- **Action:** Choose a month from the month selector chips (Jan-Dec)
- **UI Component:** Horizontal row of 12 chips, one per month
  - Current month auto-selected by default
  - Past completed months show checkmark badge
  - Future months are dimmed (cannot process future stipends)
- **State:** `selectedMonth: 'January'`, `selectedYear: 2026`
- **Validation:** Cannot select a month more than 3 months in the past (prevents late processing without admin override)
- **Error Handling:**
  - Future month selected → Toast: "Cannot process stipends for future months"
  - Very old month selected → Warning modal: "Processing stipends for [Month] [Year]. This is X months old. Continue?"

## Phase 2: Data Loading

### Step 2: Load Period Data
- **Actor:** System
- **Action:** Query duty logs within selected month's date range, filter for unpaid shifts
- **Server API Route:** `GET /api/stipends/qualifying?month=1&year=2026`
- **Query Logic:**
  ```typescript
  const startDate = new Date(year, month - 1, 1, 0, 0, 0) // Jan 1, 00:00:00
  const endDate = new Date(year, month, 0, 23, 59, 59)   // Jan 31, 23:59:59

  const unpaidLogs = query(
    collection('duty_logs'),
    where('isPaid', '==', false),
    where('approved', '==', true),
    where('startTime', '>=', startDate),
    where('startTime', '<=', endDate),
    orderBy('startTime', 'desc')
  )
  ```
- **Grouping:** Server groups results by `userId` (chaplain)
- **Calculation:** For each chaplain:
  - Count qualifying shifts
  - Base amount = shift count × `app_settings.stipendRate` (default $80)
  - Fetch chaplain `displayName` from `users` collection
- **Response:**
  ```typescript
  {
    month: 'January',
    year: 2026,
    chaplains: [
      {
        chaplainId: 'user123',
        name: 'Rev. Sarah Martinez',
        shiftCount: 4,
        baseAmount: 320,
        adjustments: 0,
        total: 320,
        dutyLogIds: ['log1', 'log2', 'log3', 'log4']
      }
    ]
  }
  ```
- **Error Handling:**
  - No unpaid logs found → Display empty state "No qualifying shifts for [Month]"
  - Firestore query timeout → Retry once, then show "Failed to load. Try again."
  - Missing stipend rate in settings → Show error: "Stipend rate not configured. Go to Settings."

### Step 3: Display Qualifying Chaplains
- **Actor:** System
- **Action:** Render data table with qualifying chaplains and calculated amounts
- **Table Columns:**
  | Select | Chaplain | Shifts | Base | Adj | Total | Actions |
  |--------|----------|--------|------|-----|-------|---------|
  | ☐      | Martinez | 4      | $320 | $0  | $320  | [Expand]|
- **Sorting:** Default by shift count descending
- **Selection:** Checkboxes for batch processing (shift+click for range select)
- **Expand Row:** Click to show individual duty log entries for that chaplain
- **Summary Bar:** Above table shows: `Total Shifts: 47 | Total Amount: $3,760 | Selected: 0 | Selected Total: $0`

## Phase 3: Adjustments (Optional)

### Step 4: Apply Adjustments
- **Actor:** User
- **Action:** Optionally modify individual shift stipend amounts (positive or negative adjustments)
- **Trigger:** Click chaplain row to expand, then click "Adjust" on a specific duty entry
- **Adjustment UI:** Modal with:
  - Duty entry details (date, hours, terminal)
  - Base amount (read-only): `$80.00`
  - Adjustment amount (slider + number input): Range `-$80` to `+$80`
  - Reason (optional text field): "Holiday bonus", "Partial shift", etc.
  - Total (calculated): Base + Adjustment
- **Calculation:** `total = baseAmount + adjustmentAmount`
- **Persistence:** Adjustment is stored in **local state only** until processing (not written to Firestore yet)
- **Visual Indicator:** Adjusted entries show yellow badge: "Adj: +$20"
- **Business Rules:**
  - Cannot reduce below $0 (min total is $0, not negative)
  - Cannot exceed 2x base rate (max adjustment +$80 for $80 base)
- **Validation:**
  - Adjustment amount must be integer dollar values (no cents)
  - Reason field max 200 characters
- **Error Handling:**
  - Invalid adjustment (e.g., NaN) → Show error: "Enter a valid dollar amount"
  - Adjustment exceeds limit → Clamp to valid range, show warning

## Phase 4: Selection & Processing

### Step 5: Select Entries for Payment
- **Actor:** User
- **Action:** Check/uncheck individual duty entries or use "Select All" for batch selection
- **Selection Scope:** Can select across multiple chaplains (batch processing)
- **Selection State:**
  - Checked entries included in payout
  - Unchecked entries remain unpaid (can be processed in later batch)
- **Visual Feedback:**
  - Checked row highlighted with primary-light background
  - Summary bar updates: `Selected: 12 entries | Selected Total: $1,040`
- **Keyboard Support:** Shift+click for range select, Ctrl+A for select all
- **Business Rule:** Can process partial months (not all entries at once) to match check batches

### Step 6: Enter Check Number
- **Actor:** User
- **Action:** Click "Process Selected" button, enter check number in modal dialog
- **Preconditions:**
  - At least one entry selected
  - Admin has verified amounts are correct
- **Modal UI:**
  - Title: "Process Stipend Payment"
  - Summary: "Processing [X] entries for [Y] chaplains totaling $[Z]"
  - Check Number field (required, text input)
    - Validation: 3-50 characters, alphanumeric + hyphens
    - Example: "CHK-2026-0147", "1234", "JAN-BATCH-1"
  - Optional: Transaction ID field (if electronic payment)
  - Buttons: "Cancel" (gray), "Confirm" (primary, requires check number)
- **Validation:**
  - Check number required → Button disabled until filled
  - Duplicate check number warning → "This check number was used for [Month] [Year]. Continue?"
- **Error Handling:**
  - Empty check number → Button remains disabled
  - Invalid format → Show inline error: "Check number must be 3-50 alphanumeric characters"

## Phase 5: Server-Side Processing

### Step 7: Process Payout (Server-Side Batch Write)
- **Actor:** System
- **Action:** Create payout records and mark duty logs as paid in atomic Firestore batch
- **Server API Route:** `POST /api/stipends/process`
- **Request Body:**
  ```typescript
  {
    entries: [
      {
        dutyLogId: 'log1',
        chaplainId: 'user123',
        baseAmount: 80,
        adjustmentAmount: 20,
        adjustmentReason: 'Holiday bonus'
      }
    ],
    checkNumber: 'CHK-2026-0147',
    transactionId: null,
    month: 'January',
    year: 2026
  }
  ```
- **Server Processing Logic:**
  1. **Verify Admin Auth:** `verifyIdToken(token)` and check admin role
  2. **Fetch Settings:** Read `app_settings.stipendRate` from Firestore
  3. **Recalculate Amounts:** Server recalculates totals from base rate (ignore client-submitted totals for security)
  4. **Group by Chaplain:** Group selected entries by `chaplainId`
  5. **Firestore Batch Write (Atomic):**
     ```typescript
     const batch = firestore.batch()

     // For each chaplain group:
     chaplainGroups.forEach(({ chaplainId, entries, total }) => {
       // 1. Create immutable payout record
       const payoutRef = collection('chaplain_payouts').doc()
       batch.set(payoutRef, {
         chaplainId,
         payoutAmount: total,
         dutyLogIds: entries.map(e => e.dutyLogId),
         dutyLogCount: entries.length,
         checkNumber,
         transactionId,
         isPaid: true,
         monthPaid: month,
         yearPaid: year,
         createdAt: serverTimestamp(),
         createdBy: adminUid
       })

       // 2. Update each duty log
       entries.forEach(entry => {
         const logRef = doc('duty_logs', entry.dutyLogId)
         batch.update(logRef, {
           isPaid: true,
           paymentAmount: entry.baseAmount + entry.adjustmentAmount,
           paymentStatus: 'paid',
           adjustmentAmount: entry.adjustmentAmount,
           hasAdjustment: entry.adjustmentAmount !== 0,
           checkNumber,
           payoutId: payoutRef.id,
           processedBy: adminUid,
           processedAt: serverTimestamp()
         })
       })

       // 3. Create/update stipend_records summary
       const recordRef = doc('stipend_records', `${chaplainId}-${year}-${month}`)
       batch.set(recordRef, {
         chaplainId,
         chaplainName: chaplainNames[chaplainId],
         monthName: month,
         year,
         startDate: periodStart,
         endDate: periodEnd,
         instancesAuthorized: entries.length,
         instancesPaid: entries.length,
         stipendAmount: total,
         adjustmentAmount: entries.reduce((sum, e) => sum + e.adjustmentAmount, 0),
         hasAdjustment: entries.some(e => e.adjustmentAmount !== 0),
         isCompleted: true,
         completedAt: serverTimestamp(),
         processedBy: adminUid
       }, { merge: true }) // Merge in case of partial month processing
     })

     // 4. Create audit log entry
     const auditRef = collection('audit_log').doc()
     batch.set(auditRef, {
       action: 'payout_create',
       adminId: adminUid,
       targetCollection: 'chaplain_payouts',
       details: {
         month,
         year,
         checkNumber,
         chaplainCount: chaplainGroups.length,
         totalAmount: grandTotal,
         entryCount: totalEntries
       },
       createdAt: serverTimestamp()
     })

     // Commit atomic batch
     await batch.commit()
     ```
  6. **Return Success:**
     ```typescript
     return {
       success: true,
       payoutIds: [...],
       totalAmount: grandTotal,
       chaplainCount: chaplainGroups.length
     }
     ```
- **Error Handling:**
  - **Partial Batch Failure:** Firestore batch is atomic – all writes succeed or all fail
    - On failure: No data written, return error
    - Client shows: "Processing failed. No changes were made. [Error details]"
  - **Duplicate Processing Prevention:**
    - Server checks if any `dutyLogId` is already marked `isPaid === true`
    - If found: Return error "These entries have already been paid"
    - Client marks those rows as green (paid) and excludes from selection
  - **Invalid Check Number:**
    - Server rejects if check number fails validation
    - Return error: "Invalid check number format"
  - **Firestore Permission Denied:**
    - Return error: "Database write failed. Contact support."
  - **Network Timeout:**
    - Batch commit has 10-second timeout
    - On timeout: Return error, client retries entire batch (idempotent)

### Step 8: Display Updated Totals
- **Actor:** System
- **Action:** Refresh UI to show updated paid status and running totals
- **UI Updates:**
  1. **Processed entries:**
     - Move to "Processed Payments" section (below main table)
     - Show green "Paid" badge
     - Display check number in row
     - Disable checkboxes (read-only)
  2. **Chaplain totals:**
     - Update per-chaplain paid totals
     - Show "Paid [X] of [Y] shifts" indicator
  3. **Summary bar:**
     - Monthly total: Sum of all payouts in selected month
     - YTD total: Sum of all payouts in selected year
     - All-time total: Sum of all payouts ever
  4. **Success toast:**
     - "Processed $[amount] across [N] chaplains"
     - Auto-dismiss after 4 seconds
- **Data Refresh:** VueFire listeners auto-update `duty_logs` and `chaplain_payouts` collections
- **Error Handling:**
  - Listener disconnect during refresh → Yellow banner: "Showing cached data"
  - Partial data refresh → Show spinner on affected sections only

</flex_block>

<flex_block type="flow" title="Error Flows">

## Critical Error Scenarios

### Data Load Failures
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| No unpaid duty logs | Empty state: "No qualifying shifts for [Month]" | Normal state, not an error | Select different month or wait for chaplains to log shifts |
| Firestore query timeout | "Failed to load stipend data. Try again." | Retry once automatically, then manual | Click "Retry" button or refresh page |
| Missing stipend rate in settings | "Stipend rate not configured. Go to Settings to set the base rate." | Block processing, redirect to Settings | Admin configures rate, returns to stipends |
| Corrupt duty log data | Skip corrupt entries, log error | Render partial data, show warning count | Admin reviews audit log, fixes data in Firestore console |

### Calculation Errors
| Error | System Behavior | Display Fallback |
|-------|----------------|------------------|
| Negative shift count | Log warning, treat as 0 | Show "0 shifts" for that chaplain |
| Adjustment overflow (>$160) | Clamp to +$80 max | Show warning: "Adjustment capped at maximum" |
| Total calculation overflow | Log error, cap at $9,999 | Show "$9,999+" |

### Processing Failures (Critical)
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Batch write fails (network) | "Processing failed. No changes were made." | No data written (atomic batch) | Retry entire batch (safe, idempotent) |
| Duplicate processing detected | "These entries have already been paid." | Return error, no writes | Refresh page to see current paid status |
| Permission denied (security rules) | "Database write failed. Contact support." | Log error with user ID, time, entries | Verify admin role, check Firestore rules |
| Check number conflict | Warning: "This check number was used before. Continue?" | Allow override with confirmation | Change check number or confirm duplicate |
| Server timeout (>10s) | "Processing timeout. Verifying status..." | Check if batch committed (query payouts) | If committed: show success. If not: retry. |

### Business Logic Violations
| Error | Prevention | User Sees |
|-------|-----------|-----------|
| Future month selected | Disable future month chips | Dimmed chips, no click |
| No entries selected | Disable "Process" button | Button grayed out until selection |
| Empty check number | Require field, disable submit | Button disabled until filled |
| Adjustment reduces total below $0 | Validation clamps to $0 min | Warning: "Total cannot be negative" |

</flex_block>

## Acceptance Criteria

### Functional Requirements
- [ ] Month selector displays 12 months with correct state (past/current/future)
- [ ] Qualifying chaplains query returns only unpaid, approved duty logs within date range
- [ ] Server recalculates stipend amounts from base rate (ignores client totals)
- [ ] Adjustments apply correctly to individual entries and recalculate totals
- [ ] Batch selection allows individual and range selection across chaplains
- [ ] Check number validation enforces 3-50 alphanumeric characters
- [ ] Server-side batch write is atomic (all succeed or all fail)
- [ ] Duplicate processing is prevented by checking `isPaid` flag server-side
- [ ] Processed entries move to read-only section with green badges
- [ ] Running totals (monthly, YTD, all-time) calculate correctly
- [ ] Audit log records all payout operations with full context

### Non-Functional Requirements
- [ ] Qualifying data loads within 3 seconds for 200 duty logs
- [ ] Server processing completes within 5 seconds for 50 entries
- [ ] Batch write timeout set to 10 seconds (Firestore limit)
- [ ] UI remains responsive during processing (show spinner, don't block)
- [ ] Page supports processing up to 100 entries in a single batch
- [ ] Error messages are actionable (not technical stack traces)
- [ ] All financial amounts display with two decimal places ($80.00)

### Security Requirements
- [ ] Only admins with verified tokens can access `/api/stipends/process`
- [ ] Server recalculates all amounts (client-submitted totals ignored)
- [ ] Firestore security rules prevent direct client writes to `chaplain_payouts`
- [ ] Audit log entries cannot be deleted or modified (immutable)
- [ ] Check numbers are logged for financial audit trail
- [ ] Duplicate check number warnings prevent accidental reuse

### Edge Cases
- [ ] Processing a month with zero qualifying shifts shows empty state (not error)
- [ ] Chaplain with mixed paid/unpaid shifts shows only unpaid in selection
- [ ] Partial month processing (some entries paid, others remain unpaid) works correctly
- [ ] Multiple admins processing different chaplains simultaneously do not conflict
- [ ] Two admins processing the same chaplain simultaneously → last-write-wins, detect conflict
- [ ] Network disconnect mid-processing → batch fails, no partial writes, safe retry
- [ ] Stipend rate changes mid-month → uses rate from `app_settings` at processing time
- [ ] Adjustment of +$0 is valid (no change, but marks as adjusted for clarity)

## Business Rules

### Payment Eligibility
- Duty log must have `approved === true` to qualify for stipend
- Duty log must have `isPaid === false` to appear in qualifying list
- Date range is inclusive: month start 00:00:00 through month end 23:59:59

### Stipend Calculation
- **Base rate:** Configurable in `app_settings.stipendRate` (default $80)
- **Per shift:** One base rate per qualifying duty log (not prorated by hours)
- **Adjustments:** Integer dollar amounts only, range -$80 to +$80
- **Minimum total:** $0 (cannot pay negative amount)
- **Maximum total:** Base + max adjustment ($160 if base is $80)

### Payout Record Immutability
- `chaplain_payouts` documents are immutable once created
- Cannot edit or delete a payout (financial audit requirement)
- Corrections require creating a new payout with opposite amount (reversal + new payment)

### Check Number Management
- Check numbers are freeform text (no enforced format)
- Duplicate check numbers trigger warning but can be overridden
- Check number is required (cannot be blank)

## Assumptions
- Admin has logged in and verified admin role
- Firestore security rules allow admin read/write to all collections used
- Stipend rate is configured in `app_settings` before first use
- All duty logs have valid references to `users` collection (no orphaned chaplain IDs)
- Firestore batch write limit (500 operations) is sufficient for any single month
- Network connection is stable during batch write (timeouts are rare)
- Timezone: All dates use airport local time (Dallas CST/CDT)

## Open Questions
1. **Reversal workflow:** How should admins correct an incorrect payout? Negative payout? Manual correction?
2. **Partial shift handling:** Should shifts under X hours receive reduced stipend automatically, or only via manual adjustment?
3. **Multi-month processing:** Should there be a "Process All Unpaid" option across multiple months?
4. **Check number uniqueness:** Should duplicate check numbers be hard-blocked or just warned?
5. **Electronic payment:** If using ACH/direct deposit instead of checks, what replaces `checkNumber`?
6. **Approval workflow:** Should there be a two-step process (calculate → review → approve), or is one-step sufficient?
