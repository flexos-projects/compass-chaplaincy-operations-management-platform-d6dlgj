---
id: flow_report-export-flow
title: "Report Generation & Export Flow"
description: "Workflow for generating filtered chaplaincy operational reports with encounter metrics, duty hours, and stipend summaries, then exporting to CSV for external use"
type: spec
subtype: flow
status: draft
sequence: 30
tags: [flow, reporting, export, analytics, csv]
relatesTo: [docs/core/005-flows.md, docs/core/007-technical.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Report Generation & Export Flow

## Overview
The Report Generation & Export Flow enables administrators to analyze chaplaincy operations through filtered, aggregated metrics and export data for external reporting (board meetings, grant applications, financial audits). This flow emphasizes flexibility in filtering and performance with large datasets.

## Trigger
Admin navigates to Reports page (`/reports`)

## Primary Actor
Chaplaincy program administrator, operations director, or financial controller

## Related Features
- F-011 Metrics & Reporting
- F-012 CSV Export
- F-002 Dashboard KPIs (related context)

## Related Collections
- `chaplain_metrics` (read) – Encounter data
- `duty_logs` (read) – Shift hours and terminals
- `chaplain_payouts` (read) – Financial summaries
- `stipend_records` (read) – Per-chaplain payment history
- `users` (read) – Chaplain names and roles

</flex_block>

<flex_block type="flow" title="Report Export Flow Steps">

## Phase 1: Filter Configuration

### Step 1: Set Filters
- **Actor:** User
- **Action:** Configure report parameters using filter controls
- **Filter Options:**
  1. **Date Range** (required):
     - Preset chips: "Last 7 days", "Last 30 days", "Last 90 days", "This Year", "All Time"
     - Custom range: Start date + end date picker
     - Validation: End date cannot be before start date
  2. **Terminal Filter** (optional):
     - Multi-select checkboxes: A, B, C, D, E
     - "All Terminals" checkbox to select/deselect all
     - Default: All selected
  3. **Chaplain Filter** (optional):
     - Searchable dropdown with all chaplains
     - "All Chaplains" option
     - Default: All chaplains
  4. **Report Type** (required):
     - Radio buttons: "Encounters", "Duty Hours", "Stipends"
     - Default: Encounters
- **Filter State:** Filters persist in URL query params (shareable links)
- **Auto-Apply:** Filters apply automatically on change (debounced 300ms)
- **Reset Button:** One-click to restore default filters
- **Error Handling:**
  - Invalid date range → Show error: "End date must be after start date"
  - Very large date range (>2 years) → Show warning: "Large date range may be slow. Continue?"

## Phase 2: Server-Side Aggregation

### Step 2: Generate Report
- **Actor:** System
- **Action:** Aggregate encounter metrics, duty hours, or stipend data based on filters
- **Server API Routes:**
  - `GET /api/reports/encounters?from=...&to=...&terminal=...&chaplain=...`
  - `GET /api/reports/duty-hours?from=...&to=...&terminal=...&chaplain=...`
  - `GET /api/reports/stipend-summary?from=...&to=...&chaplain=...`

### Report Type: Encounters
- **Data Source:** `chaplain_metrics` collection
- **Aggregations:**
  1. **Encounter Breakdown by Type:**
     - Crisis: count where `encounterType.crisis === true`
     - Violence: count where `encounterType.violence === true`
     - Police Involved: count where `encounterType.policeInvolved === true`
     - Grief: count where `encounterType.grief === true`
     - Travel-Related: count where `encounterType.travelRelated === true`
     - Personal Issue: count where `encounterType.personalIssue === true`
     - Prayer Requested: count where `encounterType.prayerRequested === true`
  2. **Encounter Medium:**
     - In-Person: count where `encounterMedium.inPerson === true`
     - By Phone: count where `encounterMedium.byPhone === true`
     - Chat Only: count where `encounterMedium.chatOnly === true`
  3. **Terminal Distribution:**
     - Count per terminal (A-E)
     - Percentage of total
  4. **Chaplain Activity:**
     - Top 10 chaplains by encounter count
     - Average encounters per chaplain
  5. **Time Series:**
     - Encounters per day/week/month (depending on date range)
- **Query Optimization:** Use Firestore composite indexes for filtered queries
- **Response Example:**
  ```typescript
  {
    dateRange: { from: '2026-01-01', to: '2026-01-31' },
    totals: {
      encounters: 142,
      uniqueChaplains: 18,
      avgPerChaplain: 7.9
    },
    byType: {
      crisis: 23,
      violence: 4,
      policeInvolved: 6,
      grief: 31,
      travelRelated: 54,
      personalIssue: 18,
      prayerRequested: 67
    },
    byMedium: {
      inPerson: 98,
      byPhone: 32,
      chatOnly: 12
    },
    byTerminal: {
      A: { count: 45, percentage: 31.7 },
      B: { count: 38, percentage: 26.8 },
      C: { count: 29, percentage: 20.4 },
      D: { count: 20, percentage: 14.1 },
      E: { count: 10, percentage: 7.0 }
    },
    topChaplains: [
      { name: 'Rev. Martinez', count: 19 },
      { name: 'Rev. Johnson', count: 15 },
      // ...
    ]
  }
  ```

### Report Type: Duty Hours
- **Data Source:** `duty_logs` collection
- **Aggregations:**
  1. **Total Hours:** Sum of `totalHours` for all logs in range
  2. **Total Shifts:** Count of duty logs
  3. **Average Shift Length:** Total hours / total shifts
  4. **By Terminal:** Hours and shift counts per terminal
  5. **By Chaplain:** Hours, shift count, average per chaplain
  6. **By Day of Week:** Hours distribution (Monday-Sunday)
  7. **Approval Status:** Counts of approved vs. pending
- **Response Example:**
  ```typescript
  {
    dateRange: { from: '2026-01-01', to: '2026-01-31' },
    totals: {
      hours: 312.5,
      shifts: 47,
      avgShiftLength: 6.6
    },
    byTerminal: {
      A: { hours: 98, shifts: 15 },
      B: { hours: 85, shifts: 13 },
      // ...
    },
    byChaplain: [
      { name: 'Rev. Martinez', hours: 42, shifts: 6, avg: 7.0 },
      // ...
    ],
    byDayOfWeek: {
      monday: 52, tuesday: 48, wednesday: 45, // ...
    }
  }
  ```

### Report Type: Stipends
- **Data Source:** `chaplain_payouts`, `stipend_records` collections
- **Aggregations:**
  1. **Total Paid:** Sum of all `payoutAmount` in range
  2. **Total Shifts Paid:** Sum of `dutyLogCount`
  3. **Average Per Chaplain:** Total / unique chaplain count
  4. **By Month:** Monthly totals
  5. **By Chaplain:** Total paid, shift count, average per shift
  6. **Adjustments:** Sum of all positive/negative adjustments
- **Response Example:**
  ```typescript
  {
    dateRange: { from: '2026-01-01', to: '2026-12-31' },
    totals: {
      totalPaid: 37600,
      totalShifts: 470,
      avgPerChaplain: 2090,
      avgPerShift: 80
    },
    byMonth: [
      { month: 'January', amount: 3760, shifts: 47 },
      // ...
    ],
    byChaplain: [
      { name: 'Rev. Martinez', totalPaid: 4800, shifts: 60, avgPerShift: 80 },
      // ...
    ],
    adjustments: {
      positive: 340,
      negative: -160,
      net: 180
    }
  }
  ```

- **Error Handling:**
  - **Large Dataset Timeout:** If query takes >10 seconds:
    - Show progress indicator: "Processing large dataset..."
    - Implement pagination: Return first 1000 records, offer "Load More"
  - **Empty Results:**
    - Display empty state: "No data found for the selected filters"
    - Suggest adjusting filters (expand date range, remove terminal filter)
  - **Firestore Read Limits:**
    - If hitting daily quota: Show error "Report temporarily unavailable. Try again later."
  - **Calculation Errors:**
    - Division by zero (avg per chaplain with zero chaplains) → Display "N/A"
    - Null values in aggregation → Exclude from calculation, log warning

## Phase 3: Display Results

### Step 3: Display Results
- **Actor:** System
- **Action:** Render charts, tables, and summary cards based on report data
- **Layout:**
  1. **Summary Cards (Top):**
     - Large KPI cards with totals (encounters, hours, amount)
     - Trend indicators (vs. previous period)
  2. **Charts (Middle):**
     - **Encounters:** Horizontal bar chart for encounter types
     - **Duty Hours:** Column chart for hours by terminal
     - **Stipends:** Line chart for monthly totals
  3. **Data Tables (Bottom):**
     - Sortable tables with detailed breakdowns
     - Per-chaplain rows with drill-down
- **Interactivity:**
  - Click chart segments to filter table
  - Sort table columns (ascending/descending)
  - Expand chaplain rows to see individual records
- **Performance:**
  - Render charts using lightweight library (Chart.js or native SVG)
  - Paginate tables if >100 rows (20 per page)
  - Use virtual scrolling for very long tables
- **Error Handling:**
  - Chart rendering failure → Show table only, log error
  - Missing data points → Show gaps in charts, don't interpolate

## Phase 4: CSV Export

### Step 4: Export to CSV
- **Actor:** User
- **Action:** Click "Export to CSV" button to download current report
- **Server API Route:** `GET /api/reports/export?type=encounters&from=...&to=...&...`
- **Export Logic:**
  1. **Query Same Filters:** Use exact same filters as displayed report
  2. **Flatten Data:** Convert nested objects to flat rows
     - Encounters: One row per encounter with all fields
     - Duty Hours: One row per duty log
     - Stipends: One row per payout or per stipend record
  3. **Include Metadata Header:**
     ```csv
     COMPASS Chaplaincy Report - Encounters
     Date Range: 2026-01-01 to 2026-01-31
     Generated: 2026-02-09 14:32:15
     Filters: All Terminals, All Chaplains

     Date,Chaplain,Terminal,Type,Medium,Duration,Notes
     2026-01-05,Rev. Martinez,A,Crisis,In-Person,45,"Assisted traveler in distress"
     ```
  4. **Generate CSV (Server-Side):**
     - Use `papaparse` library for CSV formatting
     - Escape special characters (commas, quotes, newlines)
     - UTF-8 encoding with BOM for Excel compatibility
  5. **Stream Response:**
     ```typescript
     res.setHeader('Content-Type', 'text/csv; charset=utf-8')
     res.setHeader('Content-Disposition', `attachment; filename="compass-report-${type}-${timestamp}.csv"`)
     res.send(csvString)
     ```
- **File Naming:**
  - Format: `compass-{type}-{from}-{to}.csv`
  - Example: `compass-encounters-2026-01-01-2026-01-31.csv`
- **Size Limits:**
  - Warn if export exceeds 1000 rows: "Large export may take a minute"
  - Hard limit at 10,000 rows: Offer date range splitting
- **Error Handling:**
  - **Export Generation Timeout (>30s):**
    - Show error: "Export too large. Try a smaller date range."
  - **Firestore Read Failure:**
    - Show error: "Unable to export. Try again."
  - **Server Memory Overflow:**
    - Use streaming CSV generation (don't load all data into memory)
  - **Empty Dataset:**
    - Generate CSV with header row only
    - Add comment: "No data found for the selected filters"

</flex_block>

<flex_block type="flow" title="Error Flows">

## Data Query Errors
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Firestore timeout (>10s) | "Loading report..." (indefinite) | Retry once, then show error | Click "Retry" or adjust filters |
| No data for filters | Empty state: "No data found. Adjust filters." | Render empty charts/tables | Expand date range or change filters |
| Large dataset (>1000 records) | Progress bar: "Processing large dataset..." | Paginate results, load incrementally | Wait for completion or narrow filters |
| Permission denied | "You don't have access to reports" | Log error, redirect to dashboard | Verify admin role in Settings |

## Aggregation Errors
| Error | System Behavior | Display Fallback |
|-------|----------------|------------------|
| Division by zero (avg calculations) | Return null, handle gracefully | Show "N/A" or "—" |
| Negative values (bad data) | Log warning, clamp to 0 | Display 0 with warning icon |
| Sum overflow (>999,999) | Cap at display limit | Show "999,999+" |
| Missing fields (null terminal, etc.) | Count as "Unspecified" category | Separate row/segment for unknowns |

## Export Errors
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Export timeout (>30s) | "Export failed. Dataset too large." | Cancel generation, suggest smaller range | Split into multiple exports |
| Server memory overflow | "Export failed. Contact support." | Log error, kill process | Implement streaming export |
| Network disconnect during download | Partial file downloaded | Browser shows failed download | Click "Export" again |
| No data to export | CSV with header only | Generate empty CSV | Informational toast: "Export is empty" |

## Chart Rendering Errors
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Chart library fails to load | Tables only, no charts | Log error, show table view | Refresh page to retry |
| Invalid data for chart type | Empty chart with message | Skip chart, show raw data | Review data integrity |
| Browser canvas limit exceeded | Chart not rendered | Fallback to table view | Reduce data points or use summary |

</flex_block>

## Acceptance Criteria

### Functional Requirements
- [ ] Date range filter supports preset and custom ranges with validation
- [ ] Terminal and chaplain filters apply correctly to all report types
- [ ] Encounters report aggregates by type, medium, terminal, and chaplain
- [ ] Duty hours report aggregates by terminal, chaplain, and day of week
- [ ] Stipends report aggregates by month, chaplain, and adjustments
- [ ] Charts render correctly for each report type with labeled axes
- [ ] Data tables sort by any column and paginate for large datasets
- [ ] CSV export includes metadata header and flattened data rows
- [ ] CSV export filename includes report type and date range
- [ ] Exported CSV opens correctly in Excel and Google Sheets
- [ ] Empty result sets display helpful empty state messages

### Non-Functional Requirements
- [ ] Report generation completes within 5 seconds for 1000 records
- [ ] CSV export completes within 10 seconds for 1000 rows
- [ ] Charts render within 2 seconds of data load
- [ ] Page remains responsive during report generation (no UI freeze)
- [ ] Filters debounce at 300ms to avoid excessive queries
- [ ] Firestore queries use composite indexes for optimal performance
- [ ] CSV generation uses streaming to avoid memory overflow
- [ ] Large exports (>1000 rows) show progress indicator

### Edge Cases
- [ ] Date range of 0 days (same start and end) returns single-day data
- [ ] All-time date range handles years of data without timeout
- [ ] Terminal filter with no selection defaults to "All Terminals"
- [ ] Chaplain with zero encounters appears in list with 0 count
- [ ] Encounter with multiple types (e.g., crisis + grief) counts in both categories
- [ ] Duty log with missing terminal appears under "Unspecified" terminal
- [ ] Stipend with $0 adjustment appears in report (not filtered out)
- [ ] Two admins exporting the same report simultaneously do not conflict

## Business Rules

### Data Aggregation
- **Encounter Type Counts:** Boolean flags are not mutually exclusive – one encounter can have multiple types
- **Terminal Distribution:** Percentages calculated from total encounters, sum to 100%
- **Duty Hours:** Calculated from `duty_logs.totalHours`, not recalculated from start/end times
- **Stipend Amounts:** Use final paid amounts from `chaplain_payouts`, not recalculated

### Date Range Handling
- **Inclusive:** Start date 00:00:00 through end date 23:59:59
- **Timezone:** All dates use airport local time (Dallas CST/CDT)
- **Fiscal Year:** January through December (not offset)

### CSV Export Format
- **Encoding:** UTF-8 with BOM for Excel compatibility
- **Delimiter:** Comma (not semicolon or tab)
- **Escaping:** Double quotes for fields containing commas or newlines
- **Headers:** First row contains column names (human-readable, not technical field names)

## Assumptions
- Admin has logged in and verified admin role
- Firestore security rules allow admin read access to all collections queried
- Firestore composite indexes are deployed for filtered queries
- Browser supports CSV download (all modern browsers)
- Reports page does not write data (read-only operations)
- All dates in Firestore are stored as timestamps (not strings)

## Open Questions
1. **Historical data retention:** Should very old reports (>5 years) be archived or remain queryable?
2. **Scheduled reports:** Should admins be able to schedule monthly reports to auto-generate and email?
3. **Chart library:** Use Chart.js (heavier, more features) or native SVG (lighter, less features)?
4. **Export formats:** Should we support PDF or Excel (.xlsx) in addition to CSV?
5. **Real-time updates:** Should report data refresh automatically if new data is added while viewing?
6. **Comparative analysis:** Should reports show year-over-year or month-over-month comparisons?
