---
id: duty-tracking-coverage
title: "Duty Day Tracking & Coverage Schedule"
description: "View duty shift records with terminal distribution, per-chaplain hours, and interactive weekly coverage grid with admin edit mode"
type: spec
subtype: feature
status: draft
sequence: 5
tags: [duty, coverage, schedule, grid, p0]
relatesTo: ["docs/core/002-features.md", "docs/core/003-pages.md", "docs/core/004-database.md", "docs/core/005-flows.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Duty Day Tracking & Coverage Schedule

## Overview

Duty tracking and coverage scheduling are core operational functions in COMPASS. Admins need to (1) review completed duty shifts to understand terminal distribution and chaplain engagement, and (2) manage the weekly coverage schedule to ensure 5 AM - 9 PM chaplain presence every day.

This spec covers two interconnected features:

**Duty Day Tracking (`/duty-days` page):** View and analyze chaplain shift records with terminal distribution percentages (which terminals get the most coverage), per-chaplain hour totals (all-time, 30-day, 7-day breakdowns), and time-period filtering. Read-only view of historical data.

**Coverage Schedule Grid (`/coverage` page):** Interactive 7-day x 17-hour matrix showing which hourly slots (5 AM to 9 PM) have scheduled chaplain coverage. Admin edit mode allows click-to-toggle coverage status. Week navigation to view/edit past and future weeks. This replaces the original system's 119 flat boolean fields with a normalized nested map structure.

Both features read from the `duty_logs` and `coverage_schedules` collections, but serve different purposes: duty tracking is retrospective (what happened), coverage scheduling is prospective (what is planned).

## User Stories

### Duty Tracking

**US-001:** As a program director, I want to see which terminals have the most chaplain activity so I can identify staffing imbalances and adjust assignments.

**US-002:** As an operations coordinator, I want to see per-chaplain duty hour totals (all-time, 30-day, 7-day) so I can track engagement levels and identify inactive chaplains.

**US-003:** As an admin, I want to filter duty logs by time period (all-time, last 30 days, last 7 days) so I can focus on recent activity.

**US-004:** As a program director, I want to see a list of recent duty log entries with chaplain names, dates, terminals, and hours worked so I can answer questions about specific shifts.

**US-005:** As an admin, I want to click a chaplain name in the duty list to navigate to their user detail page so I can view their full profile.

### Coverage Schedule

**US-006:** As an operations coordinator, I want to view the weekly coverage grid showing which hours (5 AM - 9 PM) have chaplain coverage so I can identify gaps.

**US-007:** As an operations coordinator, I want to toggle admin edit mode on the coverage grid so I can mark which hourly slots are covered without accidentally editing when just viewing.

**US-008:** As an admin, when I click a coverage slot in edit mode, I want it to toggle between covered (green) and uncovered (white) and save immediately to Firestore.

**US-009:** As a program director, I want to navigate between weeks (previous week, next week) so I can review past coverage and plan future weeks.

**US-010:** As an operations coordinator, I want to see visual indicators for coverage gaps (3+ consecutive uncovered hours in a row) so I can quickly spot problem areas.

**US-011:** As an admin, I want to see a coverage summary (e.g., "72% covered, 33 hours with gaps") so I can understand the overall weekly coverage at a glance.

## Acceptance Criteria

### Duty Days Page (/duty-days)

**Given** the duty days page loads
**When** duty log data is available
**Then** four sections display:
1. **Period filter chips** (All Time, Last 30 Days, Last 7 Days)
2. **Terminal distribution chart** — horizontal bar chart showing percentage of encounters per terminal (A-E)
3. **Chaplain hours table** — per-chaplain totals with all-time, 30d, and 7d hour breakdowns
4. **Recent duty logs list** — data table with chaplain, date, terminal, hours, status

**Given** the admin selects "Last 30 Days" filter
**When** the filter chip is clicked
**Then** the chip highlights (primary color)
**And** terminal distribution and chaplain hours recalculate for the last 30 days only
**And** the duty logs list filters to show only logs from the last 30 days

**Given** terminal distribution data is loaded
**When** the chart renders
**Then** it shows 5 horizontal bars (Terminals A through E)
**And** each bar displays: terminal letter, count of duty logs, percentage of total
**And** bars are colored with a gradient from the primary color
**And** bars are sorted by percentage descending (highest coverage first)

**Given** zero duty logs exist for a terminal
**When** the chart renders
**Then** that terminal's bar shows "0 (0%)" with a minimal gray bar

**Given** the chaplain hours table renders
**When** data is available
**Then** rows show: chaplain name (avatar + name), all-time hours, 30-day hours, 7-day hours
**And** rows are sorted by all-time hours descending (most hours first)
**And** clicking a chaplain name navigates to `/users/{chaplainId}`

**Given** a chaplain has zero duty hours
**When** the table renders
**Then** their row shows "0 hrs" for all time periods (not hidden, not excluded)

**Given** the recent duty logs list loads
**When** duty data is available
**Then** a table displays: chaplain (avatar + name), date, terminal, hours worked, status (approved/pending badge)
**And** rows are sorted by date descending (most recent first)
**And** the table shows 50 entries per page with pagination

**Given** the period filter is "Last 7 Days"
**When** terminal distribution is calculated
**Then** only duty logs with `startTime` within the last 7 days are included in the count

### Coverage Schedule Page (/coverage)

**Given** the coverage schedule page loads
**When** the current week's coverage document exists
**Then** the page displays:
- **Week selector** — "Week 6, Feb 3-9, 2026" with previous/next arrows
- **Coverage grid** — 7 columns (Mon-Sun) x 17 rows (5 AM - 9 PM)
- **Edit mode toggle** — switch labeled "Edit Mode" (off by default)
- **Coverage summary** — "Coverage: 84/119 hours (71%) | Gaps: 35 hours"

**Given** the coverage grid renders
**When** the week document has slot data
**Then** each cell displays as:
- **Green filled** if `slots.{day}.{hour} == true` (covered)
- **White/empty** if `slots.{day}.{hour} == false` (uncovered)
- **Red left border** on rows with 3+ consecutive uncovered slots (gap alert)

**Given** the coverage document does not exist for the selected week
**When** the page tries to load
**Then** the system creates a new document with all 119 slots set to `false`
**And** the grid displays with all cells empty (uncovered)

**Given** the admin toggles "Edit Mode" to ON
**When** the toggle switches
**Then** the grid enters edit mode:
- Cells become clickable (cursor changes to pointer)
- Hovering a cell shows subtle highlight
- A blue info banner displays: "Edit mode enabled. Click cells to toggle coverage."

**Given** edit mode is active
**When** the admin clicks a cell (e.g., Monday 9 AM)
**Then** the cell immediately toggles color (optimistic update)
**And** the system writes to Firestore: `update(doc, { 'slots.monday.9': !currentValue })`
**And** an audit_log entry is created with `action: 'coverage_edit'` and slot details
**And** if the write fails, the cell reverts to its original color and shows an error toast

**Given** the admin navigates to the previous week
**When** the "Previous Week" arrow is clicked
**Then** the week selector decrements by 1 (e.g., Week 6 → Week 5)
**And** the grid fetches/creates the coverage document for the new week
**And** the grid re-renders with the new week's data

**Given** there are 3+ consecutive uncovered hours in a row
**When** the coverage grid renders
**Then** those row(s) have a red left border (visual gap indicator)
**And** the coverage summary shows: "Longest Gap: Tuesday 6-9 AM (3 hours)"

**Given** the coverage summary is calculated
**When** the grid data loads
**Then** the summary shows:
- Total covered slots (e.g., 84)
- Total slots (always 119: 7 days x 17 hours)
- Percentage (e.g., 71%)
- Count of uncovered slots (e.g., 35)
- Longest consecutive gap with day and time range

### Data Model: Coverage Schedules

The original system used 119 individual boolean fields (one per hour slot). COMPASS uses a normalized nested map:

```typescript
interface CoverageSchedule {
  weekNumber: number           // ISO week number (1-53)
  year: number                 // Year (e.g., 2026)
  slots: {
    monday: { "5": true, "6": false, "7": true, ... "21": false }
    tuesday: { "5": true, "6": true, ... }
    wednesday: { ... }
    thursday: { ... }
    friday: { ... }
    saturday: { ... }
    sunday: { ... }
  }
  updatedAt?: Timestamp
  updatedBy?: string          // Admin UID
}
```

Document ID format: `{weekNumber}-{year}` (e.g., `6-2026` for week 6 of 2026)

Hours are stored as string keys (`"5"` through `"21"`) representing 5 AM through 9 PM (17 hourly slots per day).

### Coverage Grid Cell Interaction

**Given** edit mode is off (default)
**When** a cell is clicked
**Then** nothing happens (read-only view)

**Given** edit mode is on
**When** a cell is clicked
**Then** the following sequence occurs:
1. Client toggles cell color immediately (optimistic update)
2. Client calls Firestore: `updateDoc(docRef, { 'slots.wednesday.14': true })`
3. If success: cell remains toggled, audit entry created server-side
4. If failure: cell reverts, error toast shows "Failed to save. Try again."

**Given** edit mode is on and the admin clicks rapidly (multiple cells)
**When** multiple updates fire in quick succession
**Then** each update is independent (no batching)
**And** Firestore handles concurrent writes (last write wins)
**And** each successful write creates a separate audit entry

### Terminal Distribution Calculation

**Algorithm:**
1. Fetch all duty logs in the selected time period
2. Group by `terminal` field (A, B, C, D, E, or null)
3. Count logs per terminal
4. Calculate percentage: `(terminalCount / totalLogs) * 100`
5. Sort by percentage descending

**Display:**
- Horizontal bar chart
- Each bar: `[Terminal Letter] [Count] ([Percentage]%)`
- Example: "Terminal A: 45 (28%)"
- Bar width proportional to percentage
- Color: gradient from primary color

### Chaplain Hours Calculation

**Algorithm:**
1. Fetch all duty logs in the selected time period(s)
2. Group by `userId`
3. Sum `totalHours` field for each chaplain
4. Compute: all-time total, last-30-days total, last-7-days total
5. Sort by all-time total descending

**Display:**
- Data table with columns: Chaplain (avatar + name), All-Time Hours, 30-Day Hours, 7-Day Hours
- Hours formatted: "42.5 hrs"
- Click chaplain name → navigate to `/users/{chaplainId}`

## Functional Requirements

### FR-001: Period Filter State
- Filter state stored in URL query param: `/duty-days?period=30d`
- Options: `all` (default), `30d`, `7d`
- On filter change, URL updates and page re-queries
- Firestore queries:
  - All time: no time filter
  - 30d: `where('startTime', '>=', Timestamp.fromDate(thirtyDaysAgo))`
  - 7d: `where('startTime', '>=', Timestamp.fromDate(sevenDaysAgo))`

### FR-002: Coverage Grid Component
Reusable component: `<CoverageGrid />`
Props:
- `weekNumber: number`
- `year: number`
- `editable: boolean` (default false)

Emits:
- `@cell-click="(day, hour) => ..."`
- `@week-change="(newWeek, newYear) => ..."`

State:
- Fetches `coverage_schedules/{weekNumber}-{year}` document
- Creates empty document if not found (all slots false)
- Renders 7 columns x 17 rows
- Cell component: `<CoverageCell :day="'monday'" :hour="9" :covered="true" :editable="true" />`

### FR-003: Week Navigation
- ISO week number calculation using `date-fns` library
- Current week: `getISOWeek(new Date())`
- Previous week: decrement week number, handle year rollover (week 1 → week 52 of prior year)
- Next week: increment week number, handle year rollover (week 52 → week 1 of next year)

### FR-004: Gap Detection Algorithm
```typescript
function detectGaps(slots: Record<string, boolean>): Gap[] {
  const hours = Object.keys(slots).map(Number).sort()
  const gaps: Gap[] = []
  let gapStart: number | null = null
  let gapLength = 0

  for (const hour of hours) {
    if (!slots[hour]) {
      if (gapStart === null) gapStart = hour
      gapLength++
    } else {
      if (gapLength >= 3) {
        gaps.push({ start: gapStart!, end: gapStart! + gapLength - 1, length: gapLength })
      }
      gapStart = null
      gapLength = 0
    }
  }

  return gaps
}
```

Gap alert triggers when `gapLength >= 3` hours consecutively uncovered in a single day.

### FR-005: Audit Trail for Coverage Edits
Server-side API route: `PATCH /api/coverage/{weekNumber}-{year}`
Request body: `{ day: 'monday', hour: 9, covered: true }`
Server logic:
1. Verify admin auth
2. Update coverage document: `{ 'slots.monday.9': true }`
3. Set `updatedAt` and `updatedBy`
4. Create audit_log entry: `{ action: 'coverage_edit', details: { week, day, hour, before, after } }`

### FR-006: Real-Time Updates
- Coverage grid uses Firestore listener (`useDocument`)
- If another admin edits the same week simultaneously, changes sync in real-time
- Optimistic updates provide immediate feedback, listener confirms/reverts

## Non-Functional Requirements

### NFR-001: Performance
- Duty days page load: < 3 seconds for 500 duty logs
- Terminal distribution calculation: < 500ms
- Coverage grid render: < 500ms (119 cells)
- Coverage slot toggle: < 100ms optimistic, < 500ms Firestore write

### NFR-002: Scalability
- Duty logs paginated at 50 per page
- Chaplain hours table limited to active chaplains (isChaplain == true)
- Coverage documents are 1 per week (52 per year), not 1 per day (low doc count)

### NFR-003: Accessibility
- Coverage grid cells have `aria-label`: "Monday 9 AM: covered" or "Monday 9 AM: uncovered"
- Edit mode toggle announces: "Edit mode enabled" / "Edit mode disabled"
- Keyboard navigation: Tab moves between cells, Enter/Space toggles in edit mode
- Gap indicators visible to screen readers: "Gap detected: Tuesday 6-9 AM"

### NFR-004: Mobile/Tablet
- Duty days page on tablet: works well, tables scroll horizontally if needed
- Coverage grid on tablet: minimum cell size 40x40px, horizontal scroll if needed
- Coverage grid on mobile: show message "Coverage grid best viewed on tablet or desktop" (7x17 matrix doesn't fit < 768px)

## Dependencies

- VueFire `useDocument` for coverage schedule listener
- VueFire `useCollection` for duty logs
- `date-fns` for week number calculations, date arithmetic
- Chart component for terminal distribution (custom or lightweight library like Chart.js)

## Edge Cases

**EC-001: Zero Duty Logs**
Terminal distribution shows "No data" message. Chaplain hours table is empty with "No duty logs found" state.

**EC-002: Week 53 Edge Case**
Some years have 53 ISO weeks. Handle week 53 correctly (not all years have it).

**EC-003: Concurrent Coverage Edits**
Two admins edit same cell simultaneously. Firestore last-write-wins. Both see the final state via listener. Both audit entries are created.

**EC-004: Coverage Document Missing**
On first load of a new week, document doesn't exist. Create it with all slots `false` before rendering grid.

**EC-005: Negative Hours (Data Corruption)**
If `totalHours` is negative (data corruption), display as "0 hrs" and log warning.

**EC-006: Terminal Field Null**
If `terminal` is null/undefined, categorize as "Unknown" in distribution chart.

**EC-007: Large Gap (Full Day Uncovered)**
If all 17 hours of a day are uncovered, gap detection identifies it as a 17-hour gap. Summary shows: "Longest Gap: Saturday 5 AM - 9 PM (17 hours)".

## Testing Requirements

### Unit Tests
- [ ] Week number increment/decrement with year rollover
- [ ] Gap detection algorithm (3+ consecutive uncovered hours)
- [ ] Terminal distribution percentage calculation
- [ ] Chaplain hours aggregation (all-time, 30d, 7d)

### Integration Tests
- [ ] Period filter updates terminal distribution and hours
- [ ] Coverage grid fetches/creates document correctly
- [ ] Coverage cell toggle writes to Firestore and creates audit entry
- [ ] Week navigation loads correct document

### E2E Tests
- [ ] Full duty days page loads with all sections
- [ ] Filter "Last 7 Days" → data updates
- [ ] Coverage grid: enable edit mode → click cell → cell toggles and saves
- [ ] Week navigation: next week → grid updates
- [ ] Gap indicator: create 3 consecutive uncovered hours → red border appears

## Future Enhancements (Post-v1.1)

- Bulk coverage editing: "Mark all Monday slots as covered"
- Coverage import/export: upload CSV of schedule, download current schedule
- Coverage comparison: compare two weeks side-by-side
- Auto-suggest coverage: AI recommends optimal schedule based on chaplain availability
- Duty log approval workflow: pending → approved by admin
- Terminal-specific coverage views: filter grid by terminal
