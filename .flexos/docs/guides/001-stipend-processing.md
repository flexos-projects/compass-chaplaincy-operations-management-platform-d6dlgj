---
id: guide-stipend-processing
title: "Stipend Processing Implementation Guide"
description: "Step-by-step guide for implementing the monthly stipend processing workflow"
type: doc
subtype: guide
status: draft
sequence: 1
tags: [guide, stipend, workflow, financial]
relatesTo: ["docs/core/005-flows.md", "specs/006-features_stipend-processing.md", "specs/029-flow_stipend-processing-flow.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Stipend Processing Implementation Guide

## Overview

Stipend processing is the most complex and business-critical workflow in COMPASS. It replaces a manual process that took program directors 2-3 hours per month with spreadsheets, calculator, and paper checks. The workflow involves server-side financial calculations, Firestore batch writes, audit trail generation, and careful state management to prevent duplicate payments. The original FlutterFlow app dedicated ~2500 lines of generated code to this feature alone—more than any other single workflow.

This guide provides implementation details for the stipend processing workflow including server-side calculation patterns, Firestore query strategies, adjustment handling, batch payout creation, check number recording, running total calculation (monthly + YTD + all-time), state management considerations, edge cases, and security requirements. All financial calculations must happen server-side to prevent client-side manipulation. All payout operations use Firestore batch writes to ensure atomicity. All administrative actions are recorded in the audit log.

## Why This Workflow Is Complex

Stipend processing combines several challenging requirements: (1) **Date range queries** across duty logs with multiple filters (unpaid, within period, approved), (2) **Grouping and aggregation** by chaplain with per-entry and per-chaplain totals, (3) **Adjustment tracking** where individual shifts can have positive or negative modifications, (4) **Batch operations** that create multiple records atomically (payouts, stipend records, duty log updates), (5) **Immutability enforcement** on payout records to maintain audit trail, (6) **Duplicate prevention** to avoid paying the same shift twice, (7) **Running totals** across multiple time periods (monthly, YTD, all-time), (8) **Check number recording** for paper trail reconciliation, (9) **Multi-collection updates** that must all succeed or all fail (no partial state), and (10) **Real-time UI updates** that reflect processing status without page refresh.

The workflow has six distinct phases: period selection (choosing a month), data loading (querying qualifying shifts), adjustments (optional modifications to individual shift amounts), selection (batch checkbox selection of entries to process), server-side processing (atomic creation of payout records), and confirmation (UI refresh showing completed state). Each phase has its own error scenarios and recovery paths.

## Server-Side Calculation Requirements

All stipend calculations must occur on the server. Client-side calculations are only for preview purposes—the server is the source of truth. The base stipend rate is stored in `app_settings/config.baseStipendRate` (default $80 per shift). When a chaplain has 4 qualifying shifts, the calculation is straightforward: 4 × $80 = $320. Adjustments add complexity: if Shift 1 has a +$20 adjustment (holiday bonus), the shift total becomes $100, and the chaplain total becomes $340.

Server-side calculation prevents manipulation attacks where a malicious client could inflate amounts. The server must validate: (1) all duty log IDs exist and are not already paid, (2) all duty logs belong to the period being processed, (3) adjustment amounts are within reasonable bounds (e.g., -$80 to +$200), (4) the requesting user has admin role, (5) check number format is valid if provided, (6) total amounts match the sum of individual entries. If any validation fails, the entire batch is rejected atomically.

## Firestore Query Patterns for Qualifying Shifts

The first step in stipend processing is identifying qualifying shifts for the selected month. This requires a compound Firestore query:

```javascript
// Query pattern (pseudo-code for clarity)
const startDate = new Date(year, month - 1, 1, 0, 0, 0)
const endDate = new Date(year, month, 0, 23, 59, 59)

const qualifyingShifts = await db.collection('duty_logs')
  .where('isPaid', '==', false)
  .where('startTime', '>=', startDate)
  .where('startTime', '<=', endDate)
  .where('approved', '==', true)  // Only approved shifts qualify
  .orderBy('startTime', 'asc')
  .get()
```

This query requires a composite Firestore index: `duty_logs` collection with fields `isPaid ASC`, `startTime ASC` (must index twice for range). The query returns all unpaid, approved shifts within the selected month. The server then groups these by `userId`, fetches chaplain display names from the `users` collection, and calculates base amounts for each chaplain.

Optimization: Instead of 18 individual reads from `users` collection, use a single query or batch get: `db.collection('users').where(documentId(), 'in', uniqueUserIds)` (maximum 10 IDs per query—split into multiple queries if more). For each chaplain, create a summary object: `{ chaplainId, chaplainName, shiftCount, baseAmount, adjustmentTotal, finalTotal, dutyLogIds }`.

## Adjustment Handling

Adjustments modify individual shift stipend amounts. Common scenarios: holiday bonuses (+$20 to +$50), partial shifts due to early departure (-$20 to -$40), special circumstances (+$100 for crisis response), training deductions (-$80 if shift was primarily training). Adjustments are client-side-only until the payout is processed—they do not modify the duty log document until the final processing step.

Client-side state management for adjustments:

```javascript
// Component state (Vue composition API pseudo-code)
const adjustments = ref(new Map()) // key: dutyLogId, value: adjustmentAmount

function applyAdjustment(dutyLogId, amount) {
  if (amount === 0) {
    adjustments.value.delete(dutyLogId)
  } else {
    adjustments.value.set(dutyLogId, amount)
  }
  recalculateTotals()
}

function recalculateTotals() {
  chaplains.value.forEach(chaplain => {
    chaplain.adjustmentTotal = chaplain.dutyLogIds
      .map(id => adjustments.value.get(id) || 0)
      .reduce((sum, adj) => sum + adj, 0)
    chaplain.finalTotal = chaplain.baseAmount + chaplain.adjustmentTotal
  })
}
```

When the user processes the payout, adjustments are sent to the server as part of the request payload: `entries: [{ dutyLogId, baseAmount, adjustmentAmount, finalAmount }, ...]`. The server validates that `finalAmount === baseAmount + adjustmentAmount` for each entry before proceeding.

## Batch Payout Creation

Once the admin has selected entries and entered a check number, the server creates multiple records atomically using a Firestore batch write. A batch write ensures that if any operation fails, all operations are rolled back—no partial state is written. This is critical for financial transactions.

Server-side Nuxt API route (`/api/stipends/process.post.ts`):

```javascript
export default defineEventHandler(async (event) => {
  // 1. Verify admin authentication
  const adminUser = await verifyAdminAuth(event)
  if (!adminUser) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // 2. Parse request body
  const { entries, checkNumber, month, year } = await readBody(event)

  // entries: [{ dutyLogId, chaplainId, chaplainName, baseAmount, adjustmentAmount, finalAmount }, ...]
  // checkNumber: string (e.g., "CHK-2026-0147")
  // month: string (e.g., "January")
  // year: number (e.g., 2026)

  // 3. Validate entries
  if (!entries || entries.length === 0) {
    throw createError({ statusCode: 400, message: 'No entries provided' })
  }

  // 4. Group entries by chaplainId
  const chaplainGroups = entries.reduce((groups, entry) => {
    if (!groups[entry.chaplainId]) {
      groups[entry.chaplainId] = []
    }
    groups[entry.chaplainId].push(entry)
    return groups
  }, {})

  // 5. Initialize Firestore batch
  const batch = db.batch()
  const payoutIds = []

  // 6. For each chaplain group, create payout and update stipend record
  for (const [chaplainId, chaplainEntries] of Object.entries(chaplainGroups)) {
    const totalAmount = chaplainEntries.reduce((sum, e) => sum + e.finalAmount, 0)
    const dutyLogIds = chaplainEntries.map(e => e.dutyLogId)

    // Create chaplain_payouts document
    const payoutRef = db.collection('chaplain_payouts').doc()
    batch.set(payoutRef, {
      chaplainId,
      payoutAmount: totalAmount,
      dutyLogIds,
      dutyLogCount: dutyLogIds.length,
      checkNumber,
      isPaid: true,
      monthPaid: month,
      yearPaid: year,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: adminUser.uid
    })
    payoutIds.push(payoutRef.id)

    // Create or update stipend_records document
    const stipendRecordId = `${chaplainId}_${year}_${month}`
    const stipendRecordRef = db.collection('stipend_records').doc(stipendRecordId)
    batch.set(stipendRecordRef, {
      chaplainId,
      chaplainName: chaplainEntries[0].chaplainName,
      monthName: month,
      year,
      startDate: new Date(year, monthNameToNumber(month) - 1, 1),
      endDate: new Date(year, monthNameToNumber(month), 0),
      instancesAuthorized: dutyLogIds.length,
      instancesPaid: dutyLogIds.length,
      stipendAmount: totalAmount,
      adjustmentAmount: chaplainEntries.reduce((sum, e) => sum + (e.adjustmentAmount || 0), 0),
      hasAdjustment: chaplainEntries.some(e => e.adjustmentAmount !== 0),
      isCompleted: true,
      completedAt: FieldValue.serverTimestamp(),
      processedBy: adminUser.uid
    }, { merge: true })

    // Update each duty_logs document
    for (const entry of chaplainEntries) {
      const dutyLogRef = db.collection('duty_logs').doc(entry.dutyLogId)
      batch.update(dutyLogRef, {
        isPaid: true,
        paymentAmount: entry.finalAmount,
        paymentStatus: 'paid',
        adjustmentAmount: entry.adjustmentAmount || 0,
        hasAdjustment: (entry.adjustmentAmount || 0) !== 0,
        checkNumber,
        payoutId: payoutRef.id,
        processedBy: adminUser.uid,
        processedAt: FieldValue.serverTimestamp()
      })
    }
  }

  // 7. Write audit log entry
  const auditRef = db.collection('audit_log').doc()
  batch.set(auditRef, {
    action: 'payout_create',
    adminId: adminUser.uid,
    targetCollection: 'chaplain_payouts',
    targetId: payoutIds.join(','),
    details: {
      summary: `Processed ${entries.length} shifts for ${Object.keys(chaplainGroups).length} chaplains`,
      totalAmount: entries.reduce((sum, e) => sum + e.finalAmount, 0),
      checkNumber,
      month,
      year
    },
    createdAt: FieldValue.serverTimestamp()
  })

  // 8. Commit batch atomically
  await batch.commit()

  // 9. Return success with payout IDs
  return { success: true, payoutIds }
})
```

This pattern ensures that either all documents are written (payout records, stipend records, duty log updates, audit log) or none are. If the batch fails (network error, permission error, invalid data), Firestore rolls back the entire operation.

## Check Number Recording

Check numbers provide a paper trail linking digital records to physical checks. Format is typically "CHK-YYYY-####" (e.g., "CHK-2026-0147"). The check number is entered via a modal dialog after the admin clicks "Process Selected". The modal has validation: required field, minimum 5 characters, alphanumeric plus hyphens allowed.

The same check number may cover multiple chaplains if the organization issues one check per batch (common in smaller programs). Alternatively, each chaplain may receive their own check, in which case the admin processes chaplains one at a time with unique check numbers. The system does not enforce uniqueness on check numbers—this is an intentional design decision to support both patterns.

## Running Total Calculation

The stipend page displays three running totals for context: **Monthly Total** (selected month only), **Year-to-Date Total** (January through current month), and **All-Time Total** (all historical payouts). These totals are calculated on the server and cached in stipend_records for efficiency.

Server-side calculation for totals:

```javascript
// Monthly Total (for selected month)
const monthlyTotal = await db.collection('chaplain_payouts')
  .where('yearPaid', '==', year)
  .where('monthPaid', '==', month)
  .get()
  .then(snapshot => snapshot.docs.reduce((sum, doc) => sum + doc.data().payoutAmount, 0))

// YTD Total (January through current month)
const monthsToDate = getMonthsUpTo(month) // ['January', 'February', ..., month]
const ytdTotal = await db.collection('chaplain_payouts')
  .where('yearPaid', '==', year)
  .where('monthPaid', 'in', monthsToDate)  // requires index
  .get()
  .then(snapshot => snapshot.docs.reduce((sum, doc) => sum + doc.data().payoutAmount, 0))

// All-Time Total (all years)
const allTimeTotal = await db.collection('chaplain_payouts')
  .get()
  .then(snapshot => snapshot.docs.reduce((sum, doc) => sum + doc.data().payoutAmount, 0))
```

These queries can be expensive (especially all-time) so they should be cached client-side and only recalculated when necessary. Alternative: store aggregated totals in `app_settings` and update them on each payout creation (denormalization for performance).

## State Management Considerations

The stipend page has several complex state requirements: (1) selected month (reactive), (2) qualifying chaplains list (reactive, updates when month changes), (3) adjustments map (reactive, updates on slider changes), (4) selected entries set (reactive, updates on checkbox changes), (5) processing flag (boolean, prevents duplicate submissions), (6) processed entries set (reactive, marks green after processing). Use Vue composition API or Pinia store to centralize this state.

Example composition pattern:

```javascript
// composables/useStipendProcessing.ts
export function useStipendProcessing() {
  const selectedMonth = ref('January')
  const selectedYear = ref(2026)
  const chaplains = ref([])
  const adjustments = ref(new Map())
  const selectedEntries = ref(new Set())
  const processing = ref(false)
  const processedEntries = ref(new Set())

  const loadQualifyingShifts = async () => {
    const response = await $fetch('/api/stipends/qualifying', {
      params: { month: selectedMonth.value, year: selectedYear.value }
    })
    chaplains.value = response.chaplains
  }

  const processPayouts = async (checkNumber) => {
    if (processing.value) return
    processing.value = true
    try {
      const entries = Array.from(selectedEntries.value).map(id => {
        const entry = findEntryById(id)
        return {
          dutyLogId: id,
          chaplainId: entry.userId,
          chaplainName: entry.chaplainName,
          baseAmount: 80,
          adjustmentAmount: adjustments.value.get(id) || 0,
          finalAmount: 80 + (adjustments.value.get(id) || 0)
        }
      })
      await $fetch('/api/stipends/process', { method: 'POST', body: { entries, checkNumber, month: selectedMonth.value, year: selectedYear.value } })
      entries.forEach(e => processedEntries.value.add(e.dutyLogId))
      selectedEntries.value.clear()
    } finally {
      processing.value = false
    }
  }

  return { selectedMonth, selectedYear, chaplains, adjustments, selectedEntries, processing, processedEntries, loadQualifyingShifts, processPayouts }
}
```

## Edge Cases

**Mid-month termination:** If a chaplain leaves the program mid-month, they should still receive payment for completed shifts. The query filters by date range, not employment status, so terminated chaplains' unpaid shifts will appear. This is correct behavior—the admin can choose to process or skip them.

**Zero-hour shifts:** Some duty logs may have totalHours = 0 (clock-in immediately followed by clock-out, or data entry error). These should be excluded from qualifying shifts. Add a filter: `.where('totalHours', '>', 0)` or exclude them in post-processing.

**Duplicate processing prevention:** The most critical edge case. If an admin clicks "Process" twice quickly, the server could create duplicate payouts. Solutions: (1) client-side disable button during processing (UX layer), (2) server-side transaction that checks isPaid status before updating (data layer), (3) idempotency key on payout creation (API layer). Implement all three layers for robustness.

**Partial month processing:** An admin may want to process only some chaplains in a month (e.g., process half now, half next week). This is supported by the selective checkbox pattern. Mark entries as paid individually, not by period. The "period complete" state is informational only, not enforced.

**Negative total after adjustment:** If an admin applies a -$90 adjustment to an $80 shift, the total becomes -$10. This should be prevented at validation: adjustment range should be clamped to -$80 (minimum) to ensure non-negative shift totals.

## Security Requirements

All financial calculations happen server-side. Client-side calculations are for preview only. Admin authentication is verified on every API request using Firebase Auth token validation. The audit log is written from the server, not the client, to prevent tampering. Firestore security rules enforce that only authenticated admins can write to chaplain_payouts, duty_logs, and stipend_records. The admin role check happens in two places: Firestore security rules (data layer) and API route middleware (application layer). Both must pass for the write to succeed.

Payout records are immutable. Once a chaplain_payouts document is created, it cannot be updated or deleted. Firestore security rules enforce this: `allow update, delete: if false`. Corrections are made by creating adjustment payout records (e.g., a negative payout to reverse an error, followed by a corrected positive payout). This maintains a complete audit trail.
