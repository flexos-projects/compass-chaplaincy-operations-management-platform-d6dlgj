---
id: pages-reports
title: "Reports Page"
description: "Analytics dashboard for chaplain encounter metrics, duty hours summaries, stipend totals, and CSV data export"
type: spec
subtype: pages
status: draft
sequence: 16
tags: [pages, reporting, analytics, data-export]
relatesTo: [docs/core/003-pages.md, docs/core/004-database.md, docs/core/005-flows.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Pages: Reports

## Overview

The Reports page is the central analytics hub for COMPASS, providing admins with aggregated metrics, drill-down filtering, and CSV export capabilities. It consolidates data from chaplain_metrics (encounter records), duty_logs (shift hours), and chaplain_payouts (financial summaries) into filterable, exportable views for board reporting and operational analysis.

## Route

**Route:** `/reports`
**Layout:** Admin (sidebar navigation)
**Auth:** Admin only
**Primary data sources:** chaplain_metrics, duty_logs, chaplain_payouts, stipend_records, users

## Page Structure

### Sections

1. **Filter Bar (Sticky Header)**
   - **Date Range Filter:**
     - Quick select chips: "Last 7 Days", "Last 30 Days", "This Quarter", "This Year", "Custom Range"
     - Custom range: Two date pickers (From / To)
     - Default: "This Quarter" (current quarter of program year)
   - **Terminal Filter:**
     - Dropdown: "All Terminals" | "Terminal A" | "Terminal B" | "Terminal C" | "Terminal D" | "Terminal E"
   - **Chaplain Filter:**
     - Searchable dropdown of all chaplains (typeahead)
     - Default: "All Chaplains"
   - **Apply Filters Button** (triggers re-query)
   - **Reset Filters** (clears all, returns to defaults)

2. **Encounter Metrics Section**
   - **Title:** "Chaplain Encounters"
   - **Summary Cards (Row 1):**
     - Total Encounters (count)
     - Crisis Interventions (count)
     - Prayer Requests (count)
     - Grief Counseling (count)
   - **Encounter Type Breakdown Chart:**
     - Horizontal bar chart or pie chart
     - Categories: Crisis, Violence, Police Involved, Grief, Travel-Related, Personal Issue, Prayer Requested, Fallen Angel
     - Shows counts + percentages
     - Hover tooltip with exact numbers
   - **Encounter Medium Breakdown:**
     - Simple stat row: "In-Person: {X} | By Phone: {Y} | Chat: {Z} | Self-Discovered: {W}"
   - **Terminal Distribution (if not filtered by terminal):**
     - Bar chart: Encounters per terminal
     - Shows encounter density by location
   - **Data Table:**
     - Recent 50 encounters in filtered range
     - Columns: Date, Chaplain, Terminal, Type (badges), Medium, Duration, Notes (truncated)
     - Sortable by date, chaplain, terminal
     - Click row to view full encounter details (modal or detail page, TBD)

3. **Duty Hours Summary Section**
   - **Title:** "Duty Hours"
   - **Summary Cards (Row 1):**
     - Total Duty Hours (sum of totalHours from duty_logs)
     - Average Shift Length (mean hours per shift)
     - Total Shifts (count of duty_logs)
     - Active Chaplains (unique chaplain count)
   - **Chaplain Hours Table:**
     - Columns: Chaplain Name, Shift Count, Total Hours, Avg Hours/Shift
     - Sortable by hours (descending default)
     - Shows top 20, "View All" expands to full list
   - **Hours by Terminal:**
     - If terminal filter is "All", show bar chart of hours per terminal
     - If filtered by terminal, show hours by chaplain at that terminal
   - **Data Table:**
     - Recent 50 duty shifts in filtered range
     - Columns: Date, Chaplain, Start Time, End Time, Hours, Terminal, Status (Paid/Unpaid)
     - Sortable, filterable

4. **Stipend Summary Section**
   - **Title:** "Stipend Payments"
   - **Summary Cards (Row 1):**
     - Total Paid (sum of payoutAmount from chaplain_payouts)
     - Total Shifts Paid (sum of dutyLogCount)
     - Average Payout (mean payout per chaplain)
     - Unpaid Shifts (count of isPaid == false duty_logs, if date range includes unpaid)
   - **Monthly Payout Trend:**
     - Line chart: X-axis = months, Y-axis = total payout amount
     - If date range spans multiple months, show trend
     - If single month, show weekly breakdown
   - **Chaplain Stipend Table:**
     - Columns: Chaplain Name, Shifts Paid, Total Amount, Avg per Shift
     - Sortable by amount (descending default)
     - Shows top 20, "View All" expands
   - **Data Table:**
     - Payouts in filtered range
     - Columns: Date Processed, Chaplain, Shifts, Amount, Check Number, Processed By
     - Click row to navigate to `/stipends/{payoutId}`

5. **Export Actions (Sticky Footer)**
   - **Export Buttons (3 options):**
     - "Export Encounters CSV" → Downloads filtered encounter data
     - "Export Duty Hours CSV" → Downloads filtered duty log data
     - "Export Stipends CSV" → Downloads filtered payout data
   - **Status Indicator:**
     - Shows "Generating export..." spinner when export is in progress
     - Shows "Export ready" success message when download starts

### States

- **Loading:** Skeleton UI for summary cards, charts, tables (progressive loading: cards load first, then charts, then tables)
- **Loaded:** All data rendered based on current filters
- **Exporting:** Export button shows spinner, status indicator appears
- **Empty (No Data):** "No data matches your filters. Try a different date range or chaplain."
- **Error:** "Unable to load report data. Check your connection and try again."

## Data Model

### Encounter Metrics Queries

```typescript
// Base query for filtered encounters
query(collection('chaplain_metrics'),
  where('dateCollected', '>=', fromDate),
  where('dateCollected', '<=', toDate),
  orderBy('dateCollected', 'desc')
)

// If terminal filter applied:
query(collection('chaplain_metrics'),
  where('dateCollected', '>=', fromDate),
  where('dateCollected', '<=', toDate),
  where('terminal', '==', selectedTerminal),
  orderBy('dateCollected', 'desc')
)

// If chaplain filter applied:
query(collection('chaplain_metrics'),
  where('chaplainId', '==', selectedChaplainId),
  where('dateCollected', '>=', fromDate),
  where('dateCollected', '<=', toDate),
  orderBy('dateCollected', 'desc')
)
```

### Duty Hours Queries

```typescript
// Base query for filtered duty logs
query(collection('duty_logs'),
  where('startTime', '>=', fromDate),
  where('startTime', '<=', toDate),
  orderBy('startTime', 'desc')
)

// Additional filters applied client-side or via composite queries (requires indexes)
```

### Stipend Queries

```typescript
// Payouts in date range
query(collection('chaplain_payouts'),
  where('createdAt', '>=', fromDate),
  where('createdAt', '<=', toDate),
  orderBy('createdAt', 'desc')
)

// If chaplain filter applied:
query(collection('chaplain_payouts'),
  where('chaplainId', '==', selectedChaplainId),
  where('createdAt', '>=', fromDate),
  where('createdAt', '<=', toDate),
  orderBy('createdAt', 'desc')
)
```

## CSV Export Formats

### Encounters CSV

**Columns:** Date, Chaplain, Terminal, Gate, In Chapel, Type (comma-separated flags), Medium (comma-separated), Recipient Type, Persons Involved, Duration (min), Notes

**Example Row:**
```
2026-02-05, Rev. Martinez, A, A12, No, "crisis,prayer", "in-person", traveler, 2, 15, "Family distress situation"
```

### Duty Hours CSV

**Columns:** Date, Chaplain, Start Time, End Time, Total Hours, Terminal, Approved, Paid, Payment Amount, Check Number

**Example Row:**
```
2026-02-05, Rev. Martinez, 08:00, 14:30, 6.5, A, Yes, Yes, 80, CHK-001
```

### Stipends CSV

**Columns:** Date Processed, Chaplain, Shift Count, Base Amount, Adjustments, Total Amount, Check Number, Processed By

**Example Row:**
```
2026-02-05, Rev. Martinez, 4, 320, +20, 340, CHK-001, Linda Chen
```

## Server API Routes

### Report Data Endpoints

```typescript
// GET /api/reports/encounters?from={date}&to={date}&terminal={X}&chaplain={id}
// Returns aggregated encounter metrics + filtered list

// GET /api/reports/duty-hours?from={date}&to={date}&terminal={X}&chaplain={id}
// Returns duty hour summaries + filtered list

// GET /api/reports/stipend-summary?from={date}&to={date}&chaplain={id}
// Returns stipend totals + filtered payouts
```

### Export Endpoints

```typescript
// GET /api/reports/export?type=encounters&from={date}&to={date}&filters={json}
// Streams CSV file as download response (Content-Type: text/csv)

// GET /api/reports/export?type=duty-hours&from={date}&to={date}&filters={json}
// Streams CSV file as download response

// GET /api/reports/export?type=stipends&from={date}&to={date}&filters={json}
// Streams CSV file as download response
```

**Export Logic (Server-Side):**
1. Verify admin auth token
2. Apply filters to Firestore query
3. Fetch all matching documents (no pagination limit for exports)
4. Transform to flat rows (denormalize references: chaplainId → chaplain name)
5. Generate CSV using papaparse
6. Return as file download with filename: `compass-{type}-{fromDate}-{toDate}.csv`

## Technical Considerations

### Performance

- **Query limits:** Initial page load queries max 50 rows per table
- **Aggregations:** Summary card calculations happen client-side from fetched data (Firestore doesn't support server-side aggregations natively)
- **Large exports:** If export exceeds 1000 rows, stream CSV generation to avoid memory issues
- **Real-time vs static:** Reports use one-time queries (not real-time listeners) to avoid unnecessary re-renders

### Caching

- **Filter state:** Store current filters in URL query params for shareable links
- **Export throttling:** Rate-limit export requests to 1 per 10 seconds per admin to prevent abuse

### Chart Library

- If encounter counts exceed 8 types, use horizontal bar chart instead of pie chart (better readability)
- Consider lightweight chart library: Chart.js or recharts (Vue wrapper)
- If no charting library is added initially, use CSS bar graphs (simple, performant)

## Accessibility

- **Chart alternatives:** Provide data tables as fallback for screen readers (aria-describedby linking chart to table)
- **Filter labels:** All filter inputs have explicit labels, not just placeholders
- **Export feedback:** Announce export status to screen readers via aria-live region

## Acceptance Criteria

- [ ] Given I select date range "Last 30 Days", when data loads, then only encounters, duty logs, and payouts from the last 30 days are displayed
- [ ] Given I filter by Terminal A, when charts update, then only Terminal A data is shown and terminal distribution chart is hidden
- [ ] Given I select Chaplain "Rev. Martinez", when data loads, then all metrics show only Martinez's data
- [ ] Given I click "Export Encounters CSV", when export completes, then a CSV file downloads with correct columns and filtered data
- [ ] Given encounter type breakdown shows "Prayer: 142 (38%)", when I hover the chart bar, then a tooltip displays "142 prayer requests"
- [ ] Given duty hours table displays 50 shifts, when I click a row, then I navigate to the chaplain's detail page (or shift detail, TBD)
- [ ] Given no data matches my filters, when query completes, then "No data matches your filters" message displays

## Open Questions

1. **Encounter detail view:** Should clicking an encounter row open a modal with full details, or navigate to a dedicated page?
2. **Intern evaluations:** Should reports include a dedicated section for intern evaluation summaries from chaplain_metrics.internEvaluation?
3. **Chart customization:** Should admins be able to toggle chart types (bar vs pie) or export chart images?
4. **Scheduled reports:** Should we add a "Schedule Report" feature that emails a CSV weekly/monthly (future enhancement)?

## Related Documents

- Core Pages Doc: `docs/core/003-pages.md` (User Journey 3: Quarterly Board Report Preparation)
- Core Database Doc: `docs/core/004-database.md` (chaplain_metrics, duty_logs, chaplain_payouts collections)
- Core Flows Doc: `docs/core/005-flows.md` (FL-013 Report Generation, FL-014 CSV Export)
- Core Technical Doc: `docs/core/007-technical.md` (CSV export streaming, API surface)
