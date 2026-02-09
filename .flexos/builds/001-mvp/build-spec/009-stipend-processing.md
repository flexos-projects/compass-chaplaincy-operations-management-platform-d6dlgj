---
id: build-001-spec-stipend-processing
title: "Stipend Processing Build Spec"
description: "Gap analysis for stipend processing workflow with server-side financial calculations"
type: build
subtype: build-spec
status: draft
sequence: 9
tags: [build, spec, stipend, financial]
relatesTo: ["builds/001-mvp/config.md", "specs/006-features_stipend-processing.md", "specs/015-pages_stipends.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Stipend Processing Build Spec

## What We Need

The specs define COMPASS's most complex and business-critical workflow: monthly stipend processing across two routes.

**`/stipends` page** -- Multi-step workflow: (1) Month selector with 12 chips for the current program year, auto-selecting the current month, with green checkmarks on months that have completed payouts. (2) Period summary card showing qualifying chaplain count, unpaid shift count, estimated payout total, and period status (Open / Partially Processed / Complete). (3) Qualifying chaplains list as accordion rows -- each row shows chaplain name, shift count, base amount ($80 x shifts), adjustments total, and final total, with a batch selection checkbox. Expanding a chaplain row reveals individual duty entries with per-entry checkboxes and adjustment sliders (-$80 to +$200). (4) Sticky footer with selected entry count, selected amount, running totals (month / YTD), and "Process Selected" button. (5) Check number modal triggered by Process -- text input for check number, optional transaction ID, then server-side batch creation.

**`/stipends/[id]` page** -- Payout detail view. Payout header (chaplain, amount, month, check number), chaplain info card, included duty entries table, amount breakdown (base + adjustments = total), and audit info (processed by, timestamp). Read-only, immutable record.

**Server-side financial calculations are mandatory.** The client displays previews and collects adjustments, but the server recalculates all amounts from source duty_logs using the current `app_settings.baseStipendRate`. Client-submitted totals are ignored. Firestore batch writes ensure atomicity: payout records, duty log updates, stipend records, and audit entries all succeed or all fail.

## What Nuxt 4 Provides

- Dynamic routes: `pages/stipends/index.vue` and `pages/stipends/[id].vue` auto-generated
- VueFire for real-time listeners on `chaplain_payouts` (running totals update after processing)
- Nuxt server API routes with Firebase Admin SDK for secure batch writes
- `date-fns` for month boundary calculations (`startOfMonth`, `endOfMonth`)
- Auto-imported composables and components

## The Gap

After T-001 through T-008, no stipend UI or processing logic exists. Every piece below is new:

1. **Month selector with period status** -- Query `chaplain_payouts` per month to determine Open/Complete status
2. **Qualifying chaplains fetch** -- Server route that queries unpaid approved duty_logs in a month, groups by chaplainId, joins user display names, and returns structured data
3. **Accordion-style expandable list** -- Chaplain rows that expand to show individual duty entries with checkboxes and adjustment controls
4. **Adjustment slider** -- Per-entry client-side state (-$80 to +$200 range) stored until process, not written to Firestore
5. **Batch selection logic** -- Select-all / individual / indeterminate checkbox states across chaplain groups and individual entries
6. **Server-side payout processing** -- The critical API route: verify admin, re-fetch duty logs by ID, verify unpaid status, recalculate from `baseStipendRate`, create `chaplain_payouts` + update `duty_logs` + create/update `stipend_records` + write `audit_log`, all in one batch
7. **Running totals** -- Monthly, YTD, and all-time aggregations from `chaplain_payouts`
8. **Payout detail page** -- Fetch single payout, join duty logs by `dutyLogIds` array, join chaplain and admin user docs

## Component Mapping

### Pages
- `pages/stipends/index.vue` -- Month selector + summary + qualifying list + sticky footer + check number modal
- `pages/stipends/[id].vue` -- Payout detail (header, chaplain card, entries table, breakdown, audit info)

### Components
- `components/stipends/PeriodSelector.vue` -- 12 month chips with year dropdown. Props: `selectedMonth`, `selectedYear`, `completedMonths[]`. Emits: `@select(month, year)`.
- `components/stipends/PeriodSummaryCard.vue` -- Qualifying count, shift count, estimated total, period status badge. Props: `qualifyingData`, `periodStatus`.
- `components/stipends/QualifyingChaplainsList.vue` -- Accordion list with expand/collapse. Props: `chaplains[]`, `selectedEntries`. Emits: `@toggle-entry(dutyLogId)`, `@toggle-chaplain(chaplainId)`, `@adjust(dutyLogId, amount)`.
- `components/stipends/StipendAdjustmentSlider.vue` -- Range input or numeric stepper. Props: `value`, `min`, `max`. Emits: `@change(newValue)`.
- `components/stipends/CheckNumberModal.vue` -- Modal with check number input, optional transaction ID, cancel/confirm buttons. Emits: `@confirm({ checkNumber, transactionId })`.
- `components/stipends/PayoutTotalsFooter.vue` -- Sticky footer with selection summary and running totals. Props: `selectedCount`, `selectedAmount`, `monthTotal`, `ytdTotal`.
- `components/stipends/PayoutDetail.vue` -- Full payout record display for the detail page.

### Composables
- `composables/useStipends.ts` -- Manages month selection state, fetches qualifying data from server, tracks client-side adjustments and selections, computes running totals via VueFire listener on `chaplain_payouts`. Returns: `month`, `year`, `qualifyingData`, `selectedEntries`, `adjustments`, `totals`, `loading`, `processing`, `selectMonth()`, `toggleEntry()`, `toggleChaplain()`, `setAdjustment()`, `processSelected()`.

### Server Routes
- `server/api/stipends/qualifying.get.ts` -- Query params: `month`, `year`. Logic: calculate date range, query `duty_logs` where `isPaid == false` and `approved == true` and `startTime` in range, group by `userId`, join user names, return structured array with `baseStipendRate` from `app_settings`.
- `server/api/stipends/process.post.ts` -- Request body: `{ entries: [{ dutyLogId, adjustment }], checkNumber, transactionId?, month, year }`. Logic: verify admin, re-fetch each duty log by ID, verify `isPaid == false` (prevent double-pay), fetch `baseStipendRate`, validate adjustments, group by chaplainId, Firestore batch write (create `chaplain_payouts`, update `duty_logs`, create/update `stipend_records`, write `audit_log`), return `{ success, payoutIds, summary }`.

## Data Requirements

### Firestore Collections (Writes)
- **chaplain_payouts** -- Create one doc per chaplain per processing batch. Immutable after creation (`allow update, delete: if false` in security rules).
- **duty_logs** -- Update: `isPaid`, `paymentAmount`, `paymentStatus`, `adjustmentAmount`, `hasAdjustment`, `checkNumber`, `payoutId`, `processedBy`, `processedAt`.
- **stipend_records** -- Create or update composite-ID doc (`{chaplainId}-{year}-{month}`): `instancesAuthorized`, `instancesPaid`, `stipendAmount`, `adjustmentAmount`, `isCompleted`, `completedAt`, `processedBy`.
- **audit_log** -- Create entry with action `payout_create`.

### Composite Indexes
- `duty_logs`: (`isPaid`, `startTime` ASC) -- qualifying query
- `duty_logs`: (`isPaid`, `approved`, `startTime` ASC) -- more selective qualifying query
- `chaplain_payouts`: (`monthPaid`, `yearPaid`, `createdAt` DESC) -- period payout history
- `chaplain_payouts`: (`yearPaid`, `createdAt` DESC) -- YTD totals

## Implementation Notes

**Server-side recalculation is non-negotiable.** The process endpoint ignores client-submitted `amount` values entirely. It fetches each duty log, applies `baseStipendRate` from `app_settings`, adds the adjustment (validated within range), and writes the server-calculated total. This prevents any client-side manipulation of financial data.

**Firestore batch write limits.** Each processing run creates: 1 payout doc per chaplain + 1 stipend_records doc per chaplain + N duty_log updates + 1 audit_log entry. For 20 chaplains with 5 shifts each = 20 + 20 + 100 + 1 = 141 operations. Well within Firestore's 500-operation batch limit. If the program scales beyond 250 chaplains, split into multiple sequential batches.

**Adjustment state management.** Adjustments live in client-side reactive state (a `Map<dutyLogId, number>`) until the admin clicks Process. They are never written to Firestore until the batch. This means navigating away loses adjustments -- acceptable for v1, could persist to sessionStorage in v1.1.

**Indeterminate checkbox state.** When a chaplain has some but not all entries selected, the chaplain-level checkbox shows an indeterminate visual state. Use the HTML `indeterminate` property on the checkbox input element.

**Duplicate payout prevention.** The server checks `isPaid == false` for every duty log ID in the request. If any log is already paid (race condition from concurrent admin), the entire batch is rejected with a clear error. No partial processing.

## Dependencies

- **T-008 (Duty Tracking)** -- Stipend processing queries `duty_logs` created by the duty tracking system. The `useDutyDays` composable is not directly reused, but the data model must match.
- **T-003 (Firestore Rules)** -- `chaplain_payouts` must have `allow create: if isAdmin(); allow update, delete: if false;` for immutability.
- **T-001 (Project Setup)** -- `app_settings.baseStipendRate` must exist (seeded in T-003).

## Estimated Effort

- Server route: qualifying.get.ts: **3 hours**
- Server route: process.post.ts (most complex route in the app): **6 hours**
- Composable (useStipends): **4 hours**
- Stipends index page + 6 components: **8 hours**
- Stipend detail page: **3 hours**
- Batch selection + adjustment logic: **4 hours**
- Integration testing (end-to-end flow): **4 hours**

**Total: ~32 hours (4-5 days)**
