---
id: pages-duty-days
title: "Duty Days & Coverage Schedule Pages"
description: "Admin pages for reviewing chaplain duty shift records, coverage schedules, and terminal distribution analysis"
type: spec
subtype: pages
status: draft
sequence: 14
tags: [pages, duty-tracking, coverage, admin-tools]
relatesTo: [docs/core/003-pages.md, docs/core/004-database.md, docs/core/005-flows.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Pages: Duty Days & Coverage Schedule

## Overview

Two interconnected pages for monitoring chaplain shift coverage and scheduling. The `/duty-days` route provides historical duty shift analysis, terminal distribution breakdowns, and per-chaplain hour totals. The `/coverage` route focuses exclusively on the weekly coverage grid, allowing admins to visualize and edit the 7-day by 17-hour schedule matrix to identify and fill coverage gaps.

## Routes

### Route 1: /duty-days
**Layout:** Admin (sidebar navigation)
**Auth:** Admin only
**Primary data sources:** duty_logs, users, coverage_schedules

### Route 2: /coverage
**Layout:** Admin (sidebar navigation)
**Auth:** Admin only
**Primary data sources:** coverage_schedules

## /duty-days Page Structure

### Sections

1. **Period Filter Bar**
   - Quick select chips: "All Time", "30 Days", "7 Days", "Custom Range"
   - Date range picker (appears when "Custom Range" selected)
   - Real-time count display: "{count} duty logs in selected period"

2. **Terminal Distribution Panel**
   - Visual breakdown: Terminals A through E
   - Horizontal bar chart or pie chart showing percentage of duty hours per terminal
   - Tooltip on hover showing exact hour count
   - Identifies staffing imbalances (e.g., Terminal E at 5% vs Terminal A at 40%)

3. **Chaplain Hours Table**
   - Columns: Chaplain Name, All-Time Hours, 30-Day Hours, 7-Day Hours
   - Sortable by any column
   - Searchable by chaplain name
   - Shows denormalized totalTime from user document + calculated recent hours from duty_logs
   - Paginated (50 rows per page)

4. **Coverage Grid Preview**
   - Mini version of the full coverage grid (7 days x 17 hours)
   - Shows current week by default
   - Green cells = covered slot, empty/red = gap
   - Click "View Full Coverage" button navigates to `/coverage`

5. **Duty Log List**
   - Most recent 50 duty logs in selected period
   - Columns: Chaplain, Date, Start Time, End Time, Total Hours, Terminal, Status (Approved/Paid)
   - Filter by chaplain, terminal, approval status
   - Click row to navigate to chaplain's user detail page
   - Export to CSV button

### States

- **Loading:** Skeleton UI for terminal chart, tables, and grid preview
- **Loaded:** All data rendered with real-time Firestore listeners active
- **Admin Edit Mode:** Toggle switch in header enables edit mode for coverage grid preview (or prompts user to navigate to full `/coverage` page)
- **Empty (No Logs):** "No duty logs for this period. Try a different date range."
- **Error:** "Unable to load duty data. Check your connection and try again."

### Key Interactions

- **Period filter change:** Instantly re-queries duty_logs with new date range, updates terminal distribution and chaplain hours
- **Coverage preview click:** Navigate to `/coverage` route with current week pre-selected
- **Export duty logs:** Calls `/api/reports/export?type=duty-hours&from=...&to=...` and downloads CSV

## /coverage Page Structure

### Sections

1. **Week Selector**
   - Month/year display (e.g., "February 2026")
   - Previous/next week arrows
   - Week number display (ISO week 1-53)
   - "Jump to Today" button to reset to current week

2. **Coverage Grid (Primary Component)**
   - 7 columns (Monday through Sunday)
   - 17 rows (5 AM through 9 PM, one row per hour)
   - 119 total cells
   - Cell states:
     - **Covered:** Green background, hour label (e.g., "14" for 2 PM)
     - **Gap:** Empty/light red background, hour label
     - **Hovered (edit mode):** Blue outline
     - **Saving:** Spinner overlay
   - Responsive: on tablet, grid scrolls horizontally; on desktop, fits viewport

3. **Coverage Summary Stats**
   - Total covered hours: "{X}/119 hours covered this week"
   - Percentage covered: "{Y}% coverage"
   - Gap count: "{Z} gaps" (uncovered hour slots)
   - Breakdown by day: "Monday: 12/17, Tuesday: 14/17, ..."

4. **Gap Indicators**
   - List of specific uncovered slots for quick reference
   - Example: "Monday 5-6 AM, Wednesday 8-9 PM, Sunday 6-7 AM"
   - Click a gap to highlight that cell in the grid

### States

- **Loading:** Skeleton grid with shimmer effect
- **Loaded (View Mode):** Grid rendered with current coverage state, read-only
- **Editing:** Admin toggle enabled, cells are clickable, shows "Save changes are automatic" banner
- **Saving:** Individual cell shows spinner during Firestore write
- **Error:** "Unable to load coverage schedule. Try refreshing." OR "Save failed. Click again to retry." (for slot toggle failure)

### Admin Edit Mode

- Toggle switch in page header: "Edit Mode"
- When enabled:
  - All 119 cells become interactive buttons
  - Click a cell to toggle its coverage status (true ↔ false)
  - Optimistic update: cell color changes immediately
  - Firestore write: `update(doc, { "slots.monday.5": true })`
  - On success: no visible change (already optimistic)
  - On failure: revert cell color, show error toast
  - Each toggle creates an audit_log entry: `coverage_edit` action with slot details

### Key Interactions

- **Week navigation:** Fetch/create coverage_schedules document for new week (document ID: `{weekNumber}-{year}`)
- **Cell toggle:** Single-field Firestore update with optimistic UI
- **Gap indicator click:** Scroll and highlight corresponding grid cell
- **Export schedule:** Generate CSV showing all 119 slots for the selected week

## Data Model

### Duty Days Page Queries

```typescript
// Terminal distribution (aggregated client-side from duty logs)
query(collection('duty_logs'),
  where('startTime', '>=', periodStart),
  where('startTime', '<=', periodEnd),
  orderBy('startTime', 'desc')
)

// Chaplain hours (per-chaplain aggregation)
query(collection('duty_logs'),
  where('userId', '==', chaplainId),
  orderBy('startTime', 'desc')
)

// Coverage preview (current week)
doc(collection('coverage_schedules'), `${currentWeek}-${currentYear}`)
```

### Coverage Page Queries

```typescript
// Single week's coverage schedule
doc(collection('coverage_schedules'), `${weekNumber}-${year}`)
// If document doesn't exist, create it with all slots = false
```

### Coverage Schedule Document Structure

```typescript
interface CoverageSchedule {
  weekNumber: number              // ISO week (1-53)
  year: number                    // 2026, etc.
  slots: {
    monday:    { "5": boolean, "6": boolean, ..., "21": boolean }
    tuesday:   { "5": boolean, "6": boolean, ..., "21": boolean }
    wednesday: { "5": boolean, "6": boolean, ..., "21": boolean }
    thursday:  { "5": boolean, "6": boolean, ..., "21": boolean }
    friday:    { "5": boolean, "6": boolean, ..., "21": boolean }
    saturday:  { "5": boolean, "6": boolean, ..., "21": boolean }
    sunday:    { "5": boolean, "6": boolean, ..., "21": boolean }
  }
  updatedAt: Timestamp
  updatedBy: string               // Admin UID
}
```

## Technical Considerations

### Performance

- **Duty logs query limit:** Cap at 500 logs per query, paginate beyond that
- **Coverage grid rendering:** Use CSS Grid for layout, single component re-render per cell toggle
- **Real-time listeners:** Attach on mount, detach on unmount (VueFire handles this)

### Responsive Design

- **Desktop (1024px+):** Full grid visible, side-by-side terminal chart and chaplain hours table
- **Tablet (768-1023px):** Grid scrolls horizontally, stats stack above grid
- **Mobile (<768px):** Show message: "Coverage editing is best on tablet or desktop. View-only mode available." Grid becomes horizontally scrollable table.

### Accessibility

- **Coverage grid cells:** Use `<button>` elements with aria-label: "Monday 5 AM, {covered/gap}"
- **Keyboard navigation:** Arrow keys move between cells in edit mode
- **Color blind support:** Use patterns (checkmark icon for covered) in addition to color

## Acceptance Criteria

### Duty Days Page

- [ ] Given I select "30 Days" filter, when duty data loads, then only logs from the last 30 days are displayed
- [ ] Given duty logs exist for multiple terminals, when the terminal distribution chart renders, then percentages sum to 100%
- [ ] Given I click a chaplain row in the hours table, when navigation completes, then I am on `/users/{chaplainId}` with their detail page
- [ ] Given I click "Export CSV", when the export completes, then a CSV file downloads with columns: Chaplain, Date, Start, End, Hours, Terminal, Status
- [ ] Given the coverage preview is displayed, when I click "View Full Coverage", then I navigate to `/coverage` with the current week selected

### Coverage Page

- [ ] Given I navigate to `/coverage`, when the page loads, then the current week's grid is displayed with accurate coverage state
- [ ] Given I enable edit mode, when I click a covered cell, then it immediately turns red/empty and the Firestore write begins
- [ ] Given a Firestore write fails, when the error occurs, then the cell color reverts and an error toast appears
- [ ] Given I navigate to a week with no coverage_schedules document, when the page loads, then a new document is created with all 119 slots set to false
- [ ] Given coverage summary stats show "85/119 hours covered", when I toggle 3 more cells to covered, then stats update to "88/119 hours covered (74%)"
- [ ] Given gap indicators list "Monday 5 AM", when I click that gap, then the corresponding grid cell is highlighted with a scroll-into-view animation

## Open Questions

1. **Multi-admin concurrency:** If two admins edit the coverage grid simultaneously, last write wins. Should we add optimistic locking or conflict detection?
2. **Coverage history:** Should past weeks be read-only, or can admins edit historical coverage schedules?
3. **Mobile coverage editing:** Is view-only sufficient, or should we build a simplified mobile edit interface (e.g., list view instead of grid)?

## Related Documents

- Core Pages Doc: `docs/core/003-pages.md` (User Journey 1, Journey 2)
- Core Database Doc: `docs/core/004-database.md` (coverage_schedules, duty_logs collections)
- Core Flows Doc: `docs/core/005-flows.md` (FL-008 Duty Day Review, FL-009 Coverage Schedule Edit)
