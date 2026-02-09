---
id: pages-stipends
title: "Stipends & Stipend Detail Pages"
description: "Monthly stipend processing workflow and payout record detail views for chaplain shift compensation"
type: spec
subtype: pages
status: draft
sequence: 15
tags: [pages, stipends, financial, admin-workflow]
relatesTo: [docs/core/003-pages.md, docs/core/004-database.md, docs/core/005-flows.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Pages: Stipends & Stipend Detail

## Overview

The stipend processing system is the most complex and business-critical feature in COMPASS. Two routes handle this workflow: `/stipends` for the monthly processing workflow (period selection, qualification, adjustments, batch payout creation), and `/stipends/:id` for viewing individual payout records with full audit details.

## Routes

### Route 1: /stipends
**Layout:** Admin (sidebar navigation)
**Auth:** Admin only
**Primary data sources:** duty_logs, users, chaplain_payouts, stipend_records, app_settings

### Route 2: /stipends/:id
**Layout:** Admin (sidebar navigation)
**Auth:** Admin only
**Primary data sources:** chaplain_payouts, duty_logs, users

## /stipends Page Structure

### Sections

1. **Month Selector**
   - Horizontal chip row: January through December
   - Year selector dropdown (default: current program year from app_settings)
   - Selected month highlighted in accent color
   - Shows "Active Period: {Month} {Year}" label

2. **Period Summary Card**
   - Total qualifying chaplains in period
   - Total unpaid shifts in period
   - Estimated payout total (base rate × shift count, before adjustments)
   - "Period Status: {Open/Partially Processed/Complete}"
   - If complete: "All shifts paid. Check history below."

3. **Qualifying Chaplains List**
   - Accordion-style expandable rows
   - One row per chaplain with unpaid shifts in selected period
   - Row displays:
     - Chaplain name and avatar
     - Shift count (e.g., "4 shifts")
     - Base amount ($80 × shift count)
     - Adjustment amount (if any, shows +/- dollars)
     - Total amount (base + adjustments)
     - Checkbox for batch selection
   - Click row to expand and show individual duty entries

4. **Duty Entry Table (per chaplain, expanded)**
   - Nested within chaplain row
   - Columns: Date, Start Time, End Time, Hours, Terminal, Base Rate, Adjustment, Total
   - Each entry has:
     - Individual checkbox for selection
     - Adjustment slider (range: -$80 to +$200)
     - Status badge (Unpaid/Processing/Paid)
   - If entry is already paid: green badge, disabled checkbox, shows check number and payout ID

5. **Payout Totals Card (sticky footer)**
   - Selected entries count: "{X} entries selected"
   - Selected amount: "${Y} total"
   - Running totals for context:
     - Month total: "${Z} processed this month"
     - YTD total: "${W} paid year-to-date"
   - Action buttons:
     - "Select All" / "Deselect All"
     - "Process Selected" (primary action, disabled if no selection)
     - "Export Period Data" (CSV)

### States

- **Loading:** Skeleton for month selector, summary card, chaplain list
- **Loaded:** All data rendered, real-time listener active for duty_logs in selected period
- **Processing:** Modal overlay showing "Creating payout records..." with progress indicator
- **Period Not Started:** Selected period is in the future, no duty logs yet. Show "No data for {month}. Select a past period."
- **Period Complete:** All shifts marked as paid. Show "All shifts paid for {month}. View history below or select a different period."
- **Error:** "Unable to load stipend data. Try refreshing." OR "Payout processing failed. No changes were made."

### Modal: Check Number Entry

- Triggered when admin clicks "Process Selected"
- Input field: "Check Number" (text, required, max 50 chars)
- Optional: "Transaction ID" (if electronic payment, max 100 chars)
- Validation: Check number must be unique within the same month/year
- Buttons: "Cancel" | "Confirm & Process"
- After confirm: calls `/api/stipends/process` with batch data

### Key Interactions

1. **Month selection:** Re-queries duty_logs for new period, recalculates qualifying data
2. **Chaplain row expansion:** Lazy-loads individual duty entries for that chaplain
3. **Adjustment slider:** Updates client-side totals immediately (no server call until process)
4. **Individual checkbox:** Adds/removes entry from batch selection
5. **Select All:** Checks all unpaid entries across all chaplains in visible period
6. **Process Selected:** Opens check number modal, then batch-creates payouts server-side

## /stipends/:id Page Structure

### Sections

1. **Payout Header**
   - Payout ID (document ID)
   - Status badge: "Paid" (always, payouts are immutable)
   - Month/year: "January 2026"
   - Created date: "Processed on Feb 5, 2026 at 3:42 PM"
   - Processed by: Admin name + avatar

2. **Chaplain Info Card**
   - Chaplain name, photo, title
   - Contact info (email, phone)
   - Quick stats: Total shifts this year, total paid YTD
   - Link: "View Full Profile" → `/users/{chaplainId}`

3. **Duty Entries List**
   - Table showing all duty_logs included in this payout
   - Columns: Date, Start Time, End Time, Hours, Terminal, Base Rate, Adjustment, Total
   - Footer row: "Total: {count} shifts, ${amount}"
   - Each row links to the duty log (no edit, read-only)

4. **Amount Breakdown Table**
   - Base amount: `$80 × {count} shifts = ${baseTotal}`
   - Adjustments: `+${positiveAdj}, -${negativeAdj} = ${netAdj}`
   - Final total: `${payoutAmount}`

5. **Audit Info Card**
   - Check number (or "N/A" if electronic)
   - Transaction ID (if provided)
   - Created by: Admin name
   - Created at: Full timestamp
   - Related records count: "{X} stipend records updated"

### States

- **Loading:** Skeleton for header, chaplain card, entries table
- **Loaded:** All payout details rendered from Firestore
- **Not Found:** 404 state if payout ID doesn't exist or admin lacks permission
- **Error:** "Unable to load payout details. Try refreshing."

### Key Interactions

- **View Chaplain Profile:** Click chaplain name/photo → navigate to `/users/{chaplainId}`
- **Export Payout:** Button to download single-payout CSV with all entry details
- **Navigate to Stipends:** Breadcrumb link back to `/stipends` with month pre-selected

## Data Model

### Stipends Page Queries

```typescript
// Unpaid duty logs in selected period
query(collection('duty_logs'),
  where('isPaid', '==', false),
  where('startTime', '>=', periodStart),
  where('startTime', '<=', periodEnd),
  orderBy('startTime', 'asc')
)

// Payouts for selected period (to show "already processed" context)
query(collection('chaplain_payouts'),
  where('monthPaid', '==', monthName),
  where('yearPaid', '==', year),
  orderBy('createdAt', 'desc')
)

// Stipend records for running totals
query(collection('stipend_records'),
  where('year', '==', year),
  orderBy('monthName', 'asc')
)

// App settings for base stipend rate
doc(collection('app_settings'), 'config')
```

### Stipend Detail Page Queries

```typescript
// Single payout record
doc(collection('chaplain_payouts'), payoutId)

// Duty logs included in payout (via dutyLogIds array)
getMultiple(collection('duty_logs'), payout.dutyLogIds)

// Chaplain user document
doc(collection('users'), payout.chaplainId)

// Admin who processed (for audit display)
doc(collection('users'), payout.createdBy)
```

## Business Logic (Server-Side)

### Stipend Processing Flow

When admin clicks "Confirm & Process" after entering check number:

**Server API Route:** `POST /api/stipends/process`

**Request Body:**
```typescript
{
  entries: [
    { dutyLogId: string, adjustment: number },
    ...
  ],
  checkNumber: string,
  transactionId?: string,
  month: string,        // "January"
  year: number          // 2026
}
```

**Server Logic:**
1. Verify admin auth token
2. Fetch app_settings.baseStipendRate (e.g., $80)
3. Group entries by chaplainId
4. For each chaplain group:
   - Fetch chaplain user document
   - Calculate total: (base rate × shift count) + sum of adjustments
   - Create chaplain_payouts document:
     ```typescript
     {
       chaplainId,
       payoutAmount: calculatedTotal,
       dutyLogIds: [array of IDs],
       dutyLogCount: entries.length,
       checkNumber,
       transactionId,
       isPaid: true,
       monthPaid: month,
       yearPaid: year,
       createdAt: serverTimestamp(),
       createdBy: adminUid
     }
     ```
   - Create/update stipend_records document (composite ID: `{chaplainId}-{year}-{month}`):
     ```typescript
     {
       chaplainId,
       chaplainName: user.displayName,
       monthName: month,
       year,
       startDate: periodStart,
       endDate: periodEnd,
       instancesAuthorized: entries.length,
       instancesPaid: entries.length,
       stipendAmount: calculatedTotal,
       adjustmentAmount: sumOfAdjustments,
       hasAdjustment: sumOfAdjustments !== 0,
       isCompleted: true,
       completedAt: serverTimestamp(),
       processedBy: adminUid
     }
     ```
5. For each duty_log in entries:
   - Update fields:
     ```typescript
     {
       isPaid: true,
       paymentAmount: baseRate + adjustment,
       paymentStatus: 'paid',
       adjustmentAmount: adjustment,
       hasAdjustment: adjustment !== 0,
       checkNumber,
       payoutId: newPayoutDocId,
       processedBy: adminUid,
       processedAt: serverTimestamp()
     }
     ```
6. Write audit_log entry:
   ```typescript
   {
     action: 'payout_create',
     adminId: adminUid,
     targetCollection: 'chaplain_payouts',
     targetId: newPayoutDocId,
     details: {
       chaplainCount: groupCount,
       totalAmount: sumOfAllPayouts,
       checkNumber,
       month,
       year
     },
     createdAt: serverTimestamp()
   }
   ```
7. Commit all writes in a Firestore batch (atomic: all succeed or all fail)

**Response:**
```typescript
{
  success: true,
  payoutIds: [array of created payout doc IDs],
  summary: {
    chaplains: number,
    shifts: number,
    totalAmount: number
  }
}
```

## Technical Considerations

### Immutability of Payouts

Once a chaplain_payouts document is created, it is NEVER edited or deleted. Corrections are made by creating new payout records (with negative amounts if reversing). This ensures complete audit trail and prevents financial data tampering.

### Adjustment Validation

- Client-side: Adjustment slider range -$80 to +$200
- Server-side: No hard limit enforced (admins may need flexibility for unusual cases)
- Adjustment reasoning: Optional note field could be added to duty_log.adjustmentNote for audit purposes (future enhancement)

### Batch Size Limits

- Firestore batch writes support up to 500 operations
- If processing >250 chaplains in one month (unlikely), server should split into multiple batches
- Current implementation assumes <100 chaplains per period, single batch sufficient

### Deduplication

- Check number uniqueness: Query chaplain_payouts for existing checkNumber in same month/year before creating new payout
- If duplicate found: return error "Check number {X} already used for {month} {year}"

## Acceptance Criteria

### Stipends Page

- [ ] Given I select "January", when duty logs load, then only unpaid shifts from Jan 1-31 are displayed
- [ ] Given Chaplain Rodriguez has 3 qualifying shifts at $80 base rate, when the list renders, then his row shows "3 shifts, $240"
- [ ] Given I apply a +$20 adjustment to one shift, when totals recalculate, then Rodriguez's total shows "$260" and selected amount updates
- [ ] Given I select 5 entries across 2 chaplains, when I click "Process Selected", then the check number modal appears
- [ ] Given I enter check number "CHK-001" and click Confirm, when processing completes, then 5 duty logs are marked paid, 2 payout records created, and success toast shows
- [ ] Given all shifts for January are paid, when I select January, then "Period Complete" status displays and process button is disabled

### Stipend Detail Page

- [ ] Given I navigate to `/stipends/{validId}`, when the page loads, then payout header, chaplain info, and duty entries render with correct data
- [ ] Given a payout includes 4 duty entries, when the amount breakdown renders, then base ($80 × 4 = $320), adjustments, and final total match payout.payoutAmount
- [ ] Given I click "View Full Profile", when navigation completes, then I am on `/users/{chaplainId}` detail page
- [ ] Given I navigate to `/stipends/invalid-id`, when query completes, then 404 state displays with "Payout not found" message

## Open Questions

1. **Period locking:** Should admins be able to "close" a pay period to prevent future edits? Or rely on isPaid flags alone?
2. **Adjustment notes:** Should we add a free-text note field to explain why an adjustment was applied?
3. **Electronic payments:** Should we add Stripe integration for direct deposit in v2, or stay with check-based workflow?
4. **Retroactive edits:** If a payout was processed incorrectly, what's the correction workflow? Create a negative payout + new correct payout?

## Related Documents

- Core Pages Doc: `docs/core/003-pages.md` (User Journey 2: Monthly Stipend Processing)
- Core Database Doc: `docs/core/004-database.md` (duty_logs, chaplain_payouts, stipend_records collections)
- Core Flows Doc: `docs/core/005-flows.md` (FL-010 Monthly Stipend Processing, FL-011 Stipend Adjustment, FL-012 Payout Creation)
- Core Technical Doc: `docs/core/007-technical.md` (Server-side financial calculations, Batch write patterns)
