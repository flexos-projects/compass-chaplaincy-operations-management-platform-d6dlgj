---
id: stipend-collections
title: "Chaplain Payouts & Stipend Records Collections"
description: "Immutable payout transactions and per-chaplain per-period stipend history for financial accountability"
type: spec
subtype: database
status: draft
sequence: 22
tags: [database, schema, stipend, financial, audit]
relatesTo: [docs/core/004-database.md, docs/core/005-flows.md, specs/021-database_coverage-schedules-collection.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Chaplain Payouts & Stipend Records Collections

## Overview

The stipend processing system uses two complementary collections to track chaplain payments with full audit trail:
1. **chaplain_payouts** — Immutable transaction records linking multiple duty log entries to a single payout
2. **stipend_records** — Per-chaplain per-period summaries for historical tracking and reporting

This dual-collection design replaces the original app's temporary staging collection approach (which calculated stipends in memory and discarded details) with a permanent, auditable, queryable financial record system.

## Problem Statement

The original DFWAIC App Dashboard had a stipend processing workflow spanning ~2500 lines of generated code that:
- Used a temporary `stipendhistory` collection with parallel arrays (chaplainNames[], amounts[], dates[])
- Discarded transaction details after processing (no record of which duty logs were paid in which check)
- Had no audit trail for who processed payments or when
- Required client-side calculation of totals, opening the door to manipulation
- Lacked referential integrity between duty logs and payout records

The fresh build creates two normalized collections with proper foreign keys, immutable records, server-side validation, and complete audit trail.

## Collection 1: chaplain_payouts

### Purpose
Immutable transaction records representing a single payment (check or electronic transfer) to a chaplain, with references to all duty log entries covered by that payment.

### flex_block type="schema"

```typescript
interface ChaplainPayout {
  // Document ID: Auto-generated Firestore ID (e.g., "payout-abc123")

  // Core
  chaplainId: string             // Reference to users.uid
  payoutAmount: number           // Total dollars paid (calculated server-side)
  dutyLogIds: string[]           // Array of duty_logs document IDs covered by this payout
  dutyLogCount: number           // Count of included duty logs (denormalized for quick display)

  // Payment Details
  checkNumber?: string           // Paper check number (e.g., "CHK-2026-0147")
  transactionId?: string         // Electronic payment reference (future: Stripe, ACH, etc.)
  isPaid: boolean                // Whether payment has been issued (future: support "pending" state)

  // Period
  monthPaid: string              // Month name: "January", "February", etc.
  yearPaid: number               // Year: 2026, etc.

  // Audit
  createdAt: Timestamp           // When payout record was created
  createdBy: string              // Admin UID who processed the payout
}
```

### Key Properties

**Immutability:** Once created, payout records are NEVER edited. Security rules enforce `allow update, delete: if false`. If a correction is needed, create a new payout with a negative adjustment or mark the old payout as voided in a separate `voidedPayouts` tracking system (future enhancement).

**Server-side calculation:** The `payoutAmount` is calculated server-side from the sum of duty log base amounts + adjustments. The client submits duty log IDs and adjustments; the server recalculates totals to prevent manipulation.

**Atomic linking:** When a payout is created, the duty logs referenced in `dutyLogIds` are updated in the same Firestore batch write to set `isPaid = true` and `payoutId = {this-document-id}`. This ensures referential integrity.

### flex_block type="schema" (example document)

```json
{
  "chaplainId": "user-chaplain-martinez-uid",
  "payoutAmount": 340.00,
  "dutyLogIds": [
    "duty-log-jan5-abc",
    "duty-log-jan12-def",
    "duty-log-jan19-ghi",
    "duty-log-jan26-jkl"
  ],
  "dutyLogCount": 4,
  "checkNumber": "CHK-2026-0147",
  "transactionId": null,
  "isPaid": true,
  "monthPaid": "January",
  "yearPaid": 2026,
  "createdAt": "2026-02-01T16:45:00Z",
  "createdBy": "admin-sarah-uid"
}
```

## Collection 2: stipend_records

### Purpose
Per-chaplain per-month summary records for historical reporting and YTD tracking. One document per chaplain per pay period.

### flex_block type="schema"

```typescript
interface StipendRecord {
  // Document ID: "{chaplainId}-{year}-{monthNumber}" (e.g., "chaplain-uid-2026-1")

  // Identity
  chaplainId: string             // Reference to users.uid
  chaplainName: string           // Denormalized display name (snapshot at time of processing)
  monthName: string              // "January", "February", etc.
  year: number                   // 2026, etc.

  // Period
  startDate: Timestamp           // Pay period start (e.g., Jan 1 00:00:00)
  endDate: Timestamp             // Pay period end (e.g., Jan 31 23:59:59)

  // Qualifying Shifts
  instancesAuthorized: number    // Count of qualifying duty shifts in this period
  instancesPaid?: number         // Count of shifts actually paid (may differ if some excluded)

  // Amounts
  stipendAmount?: number         // Total paid to chaplain for this period
  adjustmentAmount?: number      // Sum of all adjustments (positive or negative)
  hasAdjustment: boolean         // Whether any adjustments were applied

  // Completion
  isCompleted: boolean           // Whether this period is finalized (future: period lock feature)
  completedAt?: Timestamp        // When period was marked complete
  processedBy?: string           // Admin UID who finalized the period
}
```

### Key Properties

**Document ID pattern:** Composite key ensures one record per chaplain per month: `{chaplainId}-{year}-{monthNumber}`. Example: `chaplain-martinez-uid-2026-1` for Martinez's January 2026 stipend.

**Denormalized chaplain name:** Stores the chaplain's display name at time of processing. If the chaplain later changes their name, historical records remain unchanged (important for audit trail).

**Incremental updates:** A stipend record is created the first time a chaplain receives payment in a month, then updated if additional duty logs from that month are processed later.

### flex_block type="schema" (example document)

```json
{
  "chaplainId": "user-chaplain-martinez-uid",
  "chaplainName": "Rev. Maria Martinez",
  "monthName": "January",
  "year": 2026,
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-01-31T23:59:59Z",
  "instancesAuthorized": 4,
  "instancesPaid": 4,
  "stipendAmount": 340.00,
  "adjustmentAmount": 20.00,
  "hasAdjustment": true,
  "isCompleted": true,
  "completedAt": "2026-02-01T16:45:00Z",
  "processedBy": "admin-sarah-uid"
}
```

## Relationship to duty_logs

When a payout is processed, the referenced duty logs are updated:

```typescript
// Before processing
dutyLog = {
  userId: "chaplain-martinez-uid",
  startTime: "2026-01-05T07:00:00Z",
  totalHours: 6.5,
  approved: true,
  isPaid: false,  // ← Not yet paid
  paymentAmount: null,
  payoutId: null,
  checkNumber: null,
  processedBy: null,
  processedAt: null
}

// After processing (atomic update in batch with payout creation)
dutyLog = {
  userId: "chaplain-martinez-uid",
  startTime: "2026-01-05T07:00:00Z",
  totalHours: 6.5,
  approved: true,
  isPaid: true,               // ← Marked as paid
  paymentAmount: 100.00,      // ← $80 base + $20 adjustment
  paymentStatus: 'paid',
  adjustmentAmount: 20.00,
  hasAdjustment: true,
  payoutId: "payout-abc123",  // ← Reference to payout document
  checkNumber: "CHK-2026-0147",
  processedBy: "admin-sarah-uid",
  processedAt: "2026-02-01T16:45:00Z"
}
```

## Query Patterns

### Get All Payouts for a Month
```typescript
const q = query(
  collection(db, 'chaplain_payouts'),
  where('yearPaid', '==', 2026),
  where('monthPaid', '==', 'January'),
  orderBy('createdAt', 'desc')
)
```

### Get All Payouts for a Chaplain (YTD)
```typescript
const q = query(
  collection(db, 'chaplain_payouts'),
  where('chaplainId', '==', chaplainId),
  where('yearPaid', '==', 2026),
  orderBy('createdAt', 'desc')
)
```

### Get Stipend Summary for a Chaplain's Month
```typescript
const docRef = doc(db, 'stipend_records', `${chaplainId}-${year}-${monthNumber}`)
const record = await getDoc(docRef)
```

### Calculate YTD Total for a Chaplain
```typescript
const q = query(
  collection(db, 'stipend_records'),
  where('chaplainId', '==', chaplainId),
  where('year', '==', 2026)
)
const records = await getDocs(q)
const ytdTotal = records.docs.reduce((sum, doc) => sum + (doc.data().stipendAmount || 0), 0)
```

## Security Rules

```javascript
// chaplain_payouts: Admin read/create only, NEVER update or delete (immutable)
match /chaplain_payouts/{payoutId} {
  allow read: if isAdmin();
  allow create: if isAdmin()
    && request.resource.data.keys().hasAll(['chaplainId', 'payoutAmount', 'dutyLogIds', 'dutyLogCount', 'isPaid', 'monthPaid', 'yearPaid', 'createdAt', 'createdBy'])
    && request.resource.data.payoutAmount is number
    && request.resource.data.dutyLogIds is list;

  allow update, delete: if false;  // Immutable
}

// stipend_records: Admin read/write
match /stipend_records/{recordId} {
  allow read: if isAdmin();
  allow write: if isAdmin()
    && request.resource.data.keys().hasAll(['chaplainId', 'chaplainName', 'monthName', 'year', 'startDate', 'endDate', 'instancesAuthorized', 'isCompleted'])
    && request.resource.data.year is int
    && request.resource.data.instancesAuthorized is int;
}
```

## Server-Side Processing Flow

The stipend processing server API route (`POST /api/stipends/process`) performs the following in a Firestore batch write:

```typescript
// Pseudocode for server-side stipend processing
export default defineEventHandler(async (event) => {
  // 1. Verify admin auth
  const admin = await verifyAdmin(event)

  // 2. Parse request
  const { entries, checkNumber, month, year } = await readBody(event)
  // entries = [{ dutyLogId, adjustment }, ...]

  // 3. Fetch current stipend rate from app_settings
  const settings = await getDoc(doc(db, 'app_settings', 'config'))
  const baseRate = settings.data().baseStipendRate  // e.g., 80

  // 4. Group entries by chaplainId
  const grouped = groupByChaplain(entries)

  // 5. Start batch write
  const batch = writeBatch(db)

  // 6. For each chaplain group
  for (const [chaplainId, chaplainEntries] of Object.entries(grouped)) {
    // Fetch chaplain name
    const chaplain = await getDoc(doc(db, 'users', chaplainId))

    // Calculate total
    const total = chaplainEntries.reduce((sum, e) => sum + baseRate + (e.adjustment || 0), 0)
    const totalAdjustments = chaplainEntries.reduce((sum, e) => sum + (e.adjustment || 0), 0)

    // Create payout document
    const payoutRef = doc(collection(db, 'chaplain_payouts'))
    batch.set(payoutRef, {
      chaplainId,
      payoutAmount: total,
      dutyLogIds: chaplainEntries.map(e => e.dutyLogId),
      dutyLogCount: chaplainEntries.length,
      checkNumber,
      isPaid: true,
      monthPaid: month,
      yearPaid: year,
      createdAt: serverTimestamp(),
      createdBy: admin.uid
    })

    // Update duty logs
    chaplainEntries.forEach(entry => {
      const logRef = doc(db, 'duty_logs', entry.dutyLogId)
      batch.update(logRef, {
        isPaid: true,
        paymentAmount: baseRate + (entry.adjustment || 0),
        paymentStatus: 'paid',
        adjustmentAmount: entry.adjustment || 0,
        hasAdjustment: !!entry.adjustment,
        payoutId: payoutRef.id,
        checkNumber,
        processedBy: admin.uid,
        processedAt: serverTimestamp()
      })
    })

    // Create/update stipend_record
    const monthNumber = getMonthNumber(month)  // "January" -> 1
    const recordId = `${chaplainId}-${year}-${monthNumber}`
    const recordRef = doc(db, 'stipend_records', recordId)

    batch.set(recordRef, {
      chaplainId,
      chaplainName: chaplain.data().displayName,
      monthName: month,
      year,
      startDate: getMonthStart(year, monthNumber),
      endDate: getMonthEnd(year, monthNumber),
      instancesAuthorized: chaplainEntries.length,
      instancesPaid: chaplainEntries.length,
      stipendAmount: total,
      adjustmentAmount: totalAdjustments,
      hasAdjustment: totalAdjustments !== 0,
      isCompleted: false,  // Manual completion in future version
      processedBy: admin.uid
    }, { merge: true })  // Merge if record already exists from earlier payment

    // Create audit log
    const auditRef = doc(collection(db, 'audit_log'))
    batch.set(auditRef, {
      action: 'payout_create',
      adminId: admin.uid,
      targetId: payoutRef.id,
      targetCollection: 'chaplain_payouts',
      details: {
        chaplainId,
        amount: total,
        dutyLogCount: chaplainEntries.length,
        checkNumber,
        month,
        year
      },
      createdAt: serverTimestamp()
    })
  }

  // 7. Commit batch
  await batch.commit()

  // 8. Return success
  return { success: true, payoutCount: Object.keys(grouped).length }
})
```

## UI Integration

### Stipends Page
- **Month selector:** Chips for January-December, query unpaid duty logs for selected period
- **Qualifying chaplains list:** Group unpaid logs by chaplain, show count and calculated total
- **Duty entry table:** Expandable per chaplain, with adjustment sliders
- **Process button:** Opens check number modal, submits to server API
- **Paid indicator:** Green badge on paid entries, grayed out to prevent re-selection

### Stipend Detail Page (`/stipends/:payoutId`)
- **Payout header:** Chaplain name, total amount, check number, date processed
- **Duty entries list:** All duty logs covered by this payout with amounts
- **Audit info:** Admin who processed, timestamp

### User Detail Page (`/users/:id`)
- **Stipend history section:** Table of stipend_records for this chaplain
  - Columns: Month/Year, Shifts Paid, Amount, Adjustments, Processed By, Date
  - Summary row: YTD total, all-time total

## Acceptance Criteria

- [ ] chaplain_payouts documents are created with auto-generated IDs
- [ ] Each payout links to 1+ duty_logs via dutyLogIds array
- [ ] Payout amount is calculated server-side from base rate + adjustments
- [ ] Duty logs are updated atomically with payout creation (isPaid, payoutId, checkNumber)
- [ ] stipend_records documents use composite ID pattern `{chaplainId}-{year}-{month}`
- [ ] Each stipend record is created/updated when a payout is processed for that period
- [ ] Security rules prevent update/delete on chaplain_payouts (immutable)
- [ ] YTD and all-time totals are calculated by aggregating stipend_records
- [ ] Admin can view payout detail page showing all linked duty logs
- [ ] Audit log entry is created for every payout creation

## Related Flows

- **FL-010:** Monthly Stipend Processing (creates payouts and records)
- **FL-012:** Payout Creation (batch write with atomic linking)
- **FL-INF-004:** Stipend Period Lock (future: mark isCompleted = true)

## Future Enhancements

- **Electronic payments:** Add `transactionId` field for ACH/Stripe references when moving beyond paper checks
- **Void/refund workflow:** New `payout_voids` collection to track reversed payments without deleting immutable records
- **Multi-period payouts:** Support payouts that span multiple months (e.g., quarterly contractors)
- **Export to accounting software:** Generate QuickBooks or Xero import files from chaplain_payouts
