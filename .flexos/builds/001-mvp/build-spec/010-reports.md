---
id: build-001-spec-reports
title: "Reports Build Spec"
description: "Gap analysis for reports page with metrics aggregation and CSV export"
type: build
subtype: build-spec
status: draft
sequence: 10
tags: [build, spec, reports, export]
relatesTo: ["builds/001-mvp/config.md", "specs/007-features_metrics-reporting.md", "specs/016-pages_reports.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Reports Build Spec

## What We Need

The specs define a central analytics hub at `/reports` that consolidates data from three Firestore collections into filterable, exportable views. This addresses the original FlutterFlow app's biggest UX gap: a Reports button that appeared on every page but did nothing.

**Filter bar (sticky header)** -- Date range presets (Last 7 Days / Last 30 Days / This Quarter / This Year / Custom Range), terminal dropdown (All / A-E), chaplain typeahead search, Apply and Reset buttons. Filters stored in URL query params for shareable links.

**Encounter metrics section** -- Summary cards (total encounters, crisis interventions, prayer requests, grief counseling), encounter type horizontal bar chart (8 categories: crisis, violence, police, grief, travel, personal, prayer, Fallen Angel), encounter medium stat row (in-person / phone / chat / self-discovered), terminal distribution bar chart, and a data table with recent 50 encounters.

**Duty hours section** -- Summary cards (total hours, average shift length, total shifts, active chaplain count), chaplain hours table (top 20 with "View All"), hours-by-terminal bar chart, and recent 50 duty shift table.

**Stipend summary section** -- Summary cards (total paid, shifts paid, average payout, unpaid shifts), monthly payout trend (line chart or simplified bar if single month), chaplain stipend table (top 20), and payouts table with links to `/stipends/{id}`.

**CSV export (sticky footer)** -- Three export buttons: Encounters CSV, Duty Hours CSV, Stipends CSV. Server-side generation via papaparse with filtered data. Filename: `compass-{type}-{from}-{to}.csv`.

## What Nuxt 4 Provides

- Single page route at `pages/reports.vue`
- VueFire for one-time queries (reports use static queries, not real-time listeners)
- `papaparse` (installed in T-001) for CSV generation
- `date-fns` for date range calculations and formatting
- Nuxt server routes for secure export endpoints

## The Gap

After T-009, no reporting or export functionality exists. Everything below is new:

1. **Multi-collection aggregation** -- Reports pull from `chaplain_metrics`, `duty_logs`, and `chaplain_payouts` simultaneously, each with independent filter logic
2. **Encounter type breakdown** -- Parse boolean flag objects from `chaplain_metrics.encounterType` into category counts and percentages
3. **Chart components** -- Horizontal bar charts for encounter types, terminal distribution, and hours. CSS-based bars (same pattern as T-008 terminal distribution) unless complexity warrants Chart.js
4. **CSV export server routes** -- Fetch all matching documents (no pagination limit), denormalize references (chaplainId to name), flatten nested objects, generate CSV via papaparse, return as file download
5. **Filter state management** -- URL-synced filters that drive queries across three collections
6. **Intern evaluation summary** -- Aggregate scores from `chaplain_metrics.internEvaluation` per intern, compute averages, color-code cells

## Component Mapping

### Pages
- `pages/reports.vue` -- Filter bar + three metric sections (encounters, duty hours, stipends) + export footer

### Components
- `components/reports/ReportFilterBar.vue` -- Date range presets + custom picker + terminal dropdown + chaplain typeahead + apply/reset. Props: `filters`. Emits: `@apply(filters)`, `@reset()`.
- `components/reports/EncounterMetricsSection.vue` -- Summary cards + encounter type chart + medium stats + data table. Props: `encounters[]`, `loading`.
- `components/reports/DutyHoursSection.vue` -- Summary cards + chaplain hours table + terminal hours chart + shift table. Props: `dutyLogs[]`, `loading`.
- `components/reports/StipendSummarySection.vue` -- Summary cards + monthly trend + chaplain stipend table + payouts table. Props: `payouts[]`, `stipendRecords[]`, `loading`.
- `components/reports/SummaryCard.vue` -- Reusable KPI card. Props: `label`, `value`, `icon`, `trend?`.
- `components/reports/HorizontalBarChart.vue` -- Reusable CSS bar chart. Props: `items: { label, value, color? }[]`. Used for encounter types, terminal distribution, hours by terminal.

### Composables
- `composables/useReports.ts` -- Manages filter state (synced to URL), fetches from three collections with applied filters, computes aggregations client-side. Returns: `filters`, `encounters`, `dutyLogs`, `payouts`, `loading`, `applyFilters()`, `resetFilters()`, `exportCSV(type)`.

### Server Routes
- `server/api/reports/export.get.ts` -- Query params: `type` (encounters | duty-hours | stipends), `from`, `to`, `terminal?`, `chaplain?`. Logic: verify admin, query Firestore with no pagination limit, denormalize chaplain names from `users` collection, flatten nested fields, generate CSV with papaparse `Papa.unparse()`, return with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="compass-{type}-{from}-{to}.csv"`.

## Data Requirements

### Firestore Collections (Read Only)
- **chaplain_metrics** -- Encounter records with `dateCollected`, `terminal`, `encounterType` (boolean flag object), `encounterMedium` (boolean flag object), `internEvaluation` (nested scores). Up to 500 docs per query, paginated.
- **duty_logs** -- Shift records with `startTime`, `totalHours`, `userId`, `terminal`, `isPaid`. Reuses existing indexes from T-008.
- **chaplain_payouts** -- Payout records with `createdAt`, `chaplainId`, `payoutAmount`, `monthPaid`, `yearPaid`. Reuses indexes from T-009.
- **users** -- For chaplain name denormalization in exports and typeahead filter.

### Composite Indexes
- `chaplain_metrics`: (`dateCollected` DESC) -- date range filter
- `chaplain_metrics`: (`terminal`, `dateCollected` DESC) -- terminal + date filter
- `chaplain_metrics`: (`chaplainId`, `dateCollected` DESC) -- chaplain + date filter

## Implementation Notes

**Chart library decision.** The specs mention Chart.js as optional. For v1, stick with CSS-based horizontal bars (same `HorizontalBarChart.vue` used across encounter types, terminal distribution, and hours sections). If the stipend monthly trend line chart proves essential, add Chart.js at that point. A simpler alternative: show monthly stipend totals as a vertical bar chart using the same CSS approach.

**Client-side aggregation.** Reports use one-time queries (not real-time listeners) since report data doesn't need live updates. Fetch up to 500 records per collection, compute all summary cards and chart data client-side. For larger datasets, consider server-side aggregation endpoints in v1.1.

**CSV export streaming.** The spec warns about Vercel's 10-second serverless timeout for large exports. For v1, set the export route timeout to 30 seconds (`export const config = { maxDuration: 30 }`). If exports exceed 1000 rows, generate in chunks. Papaparse handles this efficiently in memory.

**Filter URL sync.** Store all filter values in URL query params (`?from=2026-01-01&to=2026-03-31&terminal=A&chaplain=user123`). Use `useRoute().query` and `navigateTo()` for two-way sync. This makes report links shareable -- an admin can email a filtered report URL to a colleague.

**Encounter type parsing.** `chaplain_metrics.encounterType` is an object with boolean flags (`{ crisis: true, grief: false, prayer: true }`). To aggregate, iterate all encounter docs, count true flags per category, compute percentages against total encounters.

## Dependencies

- **T-009 (Stipend Processing)** -- Stipend summary section reads from `chaplain_payouts` and `stipend_records` created by the stipend workflow
- **T-008 (Duty Tracking)** -- Duty hours section reads from `duty_logs`
- **T-007 (User Management)** -- Chaplain filter typeahead needs user list, CSV export denormalizes chaplain names
- **T-001 (Project Setup)** -- papaparse must be installed

## Estimated Effort

- Composable (useReports): **3 hours**
- Filter bar component with URL sync: **3 hours**
- Three metric section components: **6 hours**
- Reusable HorizontalBarChart + SummaryCard: **2 hours**
- Server route (export CSV): **4 hours**
- Reports page assembly + responsive layout: **3 hours**
- Testing (filters, exports, empty states): **3 hours**

**Total: ~24 hours (2-3 days)**
