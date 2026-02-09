---
id: flow_duty-review-flow
title: "Duty Day Review Flow"
description: "Workflow for reviewing chaplain duty data including terminal distribution, per-chaplain hours, and weekly coverage grid with admin editing capabilities"
type: spec
subtype: flow
status: draft
sequence: 27
tags: [flow, duty-tracking, coverage, admin]
relatesTo: [docs/core/005-flows.md, docs/core/007-technical.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Duty Day Review Flow

## Overview
The Duty Day Review Flow enables administrators to monitor chaplain duty coverage across all terminals, analyze hour distributions, and manage the weekly coverage schedule. This is a read-heavy workflow with critical write operations when admin mode is enabled for coverage editing.

## Trigger
Admin navigates to the Duty Days page (`/duty-days`)

## Primary Actor
Chaplaincy program administrator

## Related Features
- F-005 Duty Tracking
- F-006 Coverage Grid
- Dashboard KPIs (secondary)

## Related Collections
- `duty_logs` (read)
- `chaplain_metrics` (read)
- `coverage_schedules` (read/write in admin mode)
- `users` (read)
- `audit_log` (write when coverage edited)

</flex_block>

<flex_block type="flow" title="Duty Review Flow Steps">

### Phase 1: Initial Data Load
**Step 1: Load duty data**
- **Actor:** System
- **Action:** Query Firestore for duty logs, chaplain metrics, and coverage hours
- **Queries:**
  - `duty_logs`: Recent entries, grouped by terminal and chaplain
  - `chaplain_metrics`: Encounter counts for terminal distribution
  - `coverage_schedules`: Current week's coverage grid
  - `users`: Active chaplains with `isChaplain === true`
- **Error Handling:**
  - Firestore listener disconnect → Show yellow banner "Showing cached data", enable manual refresh
  - No duty logs found → Display empty state "No duty data for selected period"
  - Coverage document missing → Create empty grid (all slots uncovered)

### Phase 2: Display Terminal Distribution
**Step 2: Display terminal distribution**
- **Actor:** System
- **Action:** Calculate and render percentage of encounters at each terminal (A through E)
- **Calculation:**
  ```typescript
  terminalCounts = chaplain_metrics.reduce((acc, metric) => {
    if (metric.terminal) acc[metric.terminal]++
    return acc
  }, {})

  terminalPercentages = Object.entries(terminalCounts).map(([term, count]) => ({
    terminal: term,
    percentage: (count / totalEncounters) * 100
  }))
  ```
- **Display:** Horizontal bar chart with terminal labels (A-E), percentage labels, colored bars
- **Error Handling:**
  - Zero encounters → Show "No encounters recorded" state
  - Missing terminal field → Count as "Unspecified" category

### Phase 3: Show Chaplain Hours
**Step 3: Show chaplain hours breakdown**
- **Actor:** System
- **Action:** Aggregate and display per-chaplain duty hours with time period breakdowns
- **Aggregation:**
  - All-time total: Sum `duty_logs.totalHours` for each chaplain
  - 30-day total: Sum where `startTime >= now() - 30 days`
  - 7-day total: Sum where `startTime >= now() - 7 days`
- **Display:** Data table with columns:
  | Chaplain | All-Time | 30-Day | 7-Day | Shifts This Week |
  |----------|----------|--------|-------|-----------------|
- **Sorting:** Default sort by 30-day total (descending)
- **Error Handling:**
  - Calculation overflow → Cap display at 999+ hours
  - Missing totalHours field → Calculate from `endTime - startTime` fallback

### Phase 4: Render Coverage Grid
**Step 4: Render coverage grid**
- **Actor:** System
- **Action:** Display 7-day x 17-hour grid showing coverage status per slot
- **Data Structure:**
  ```typescript
  interface CoverageSlot {
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    hour: 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21
    covered: boolean
  }
  ```
- **Visual States:**
  - Covered (true): Teal fill (`#39D2C0`)
  - Uncovered (false): White with light gray border
  - Gap (3+ consecutive uncovered): Red left-border on row
- **Gap Detection:** Scan each day's 17-hour row, flag sequences of 3+ uncovered slots
- **Error Handling:**
  - Coverage document not found → Initialize all slots to `false`
  - Corrupt slot data → Default individual slot to `false`

### Phase 5: Toggle Admin Mode
**Step 5: Toggle admin mode**
- **Actor:** User
- **Action:** Enable edit mode to modify coverage schedule slots
- **UI Change:** Toggle switch "Edit Mode" changes from off (gray) to on (primary blue)
- **State Change:**
  - Grid cells become clickable (cursor: pointer)
  - Hover states activate on cells (blue highlight)
  - Save indicator appears in header ("Changes auto-save")
- **Precondition:** User must have admin role (verified client-side, enforced server-side)
- **Error Handling:**
  - Non-admin attempts toggle → Show toast "Admin access required"

### Phase 6: Edit Coverage Slot
**Step 6: Edit coverage slot**
- **Actor:** User
- **Action:** Click a slot to toggle coverage status, auto-saves to Firestore
- **Flow:**
  1. User clicks cell at `(Wednesday, 14:00)`
  2. Optimistic update: Cell color toggles immediately (green ↔ white)
  3. Write to Firestore: `update(coverageDoc, { "slots.wednesday.14": !currentValue })`
  4. On success: No visible change (already optimistic), brief pulse animation (200ms)
  5. On failure: Revert cell color, show error toast "Save failed. Try again."
- **Audit Trail:** Write `audit_log` entry with action: `coverage_edit`, target: slot coordinates, admin: current user
- **Debouncing:** Individual clicks are NOT debounced (each is a distinct edit), but rapid-fire clicking uses a queue to prevent write conflicts
- **Stale Data Handling:** If another admin edited the same slot, Firestore's last-write-wins applies. Listener update resolves conflict within 2 seconds.
- **Error Handling:**
  - Firestore permission denied → Show "You don't have permission to edit coverage"
  - Network disconnected → Cell reverts, show "Offline. Changes will sync when reconnected."
  - Concurrent edit conflict → Listener overrides optimistic update with server state

</flex_block>

<flex_block type="flow" title="Error Flows">

### Data Load Failures
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Firestore read timeout | "Loading duty data..." (indefinite spinner) | Retry with exponential backoff (3 attempts) | Manual page refresh, check Firebase status |
| Permission denied on duty_logs | "You don't have access to duty data" | Log error with user ID, route | Verify admin status in Settings, contact support |
| Malformed duty log data | Individual rows fail to render, others succeed | Skip corrupt records, log error with document ID | Admin reviews audit log, corrects bad data in console |
| Coverage document schema mismatch | Grid shows all uncovered | Create new document with correct schema | Old data lost (acceptable for coverage which is weekly) |

### Coverage Edit Failures
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Write permission denied | Cell reverts, toast: "Permission denied" | Log security rule violation | Verify Firestore rules allow admin writes |
| Optimistic update conflict | Cell flickers (reverts then updates) | Listener resolves to server truth | No action needed, UI reflects final state |
| Network disconnected mid-edit | Cell reverts, yellow banner: "Offline" | Queue write for retry when reconnected | Wait for connection, or manually refresh |
| Rate limit exceeded | Toast: "Too many changes. Slow down." | Reject writes for 30 seconds | Wait, then retry |

### Calculation Errors
| Error | System Behavior | Display Fallback |
|-------|----------------|------------------|
| Negative total hours | Log warning, clamp to 0 | Show "0 hours" for that chaplain |
| Future-dated duty logs | Include in all-time, exclude from recent | Show in table with indicator "Future shift" |
| Missing chaplain reference | Duty log appears as "Unknown Chaplain" | Link to user management to resolve orphaned data |
| Terminal distribution sum ≠ 100% | Normalize percentages proportionally | Display normalized values, log warning |

</flex_block>

## Acceptance Criteria

### Functional Requirements
- [ ] Dashboard loads within 2 seconds on initial Firestore data fetch
- [ ] Terminal distribution accurately reflects chaplain_metrics data with percentages summing to 100%
- [ ] Per-chaplain hours display all-time, 30-day, and 7-day totals correctly calculated from duty_logs
- [ ] Coverage grid renders 7 days x 17 hours (119 cells) with correct color states
- [ ] Gap detection highlights rows with 3+ consecutive uncovered slots
- [ ] Admin mode toggle enables/disables grid editing with appropriate visual feedback
- [ ] Coverage slot toggles save to Firestore within 500ms and update audit log
- [ ] Optimistic updates provide instant visual feedback with revert on failure
- [ ] Concurrent edits by multiple admins resolve via Firestore listeners within 2 seconds
- [ ] Page remains usable with cached data when Firestore listener disconnects

### Non-Functional Requirements
- [ ] Coverage grid renders in under 500ms (119 cells)
- [ ] Terminal distribution calculation completes in under 100ms for 1000+ encounters
- [ ] Firestore read queries use composite indexes for optimal performance
- [ ] No more than 3 active Firestore listeners when viewing this page
- [ ] Coverage edits queue locally if offline, sync when connection restored
- [ ] All error states display actionable messages (not technical stack traces)

### Edge Cases
- [ ] Coverage grid with no data initializes to all uncovered (not an error state)
- [ ] Chaplain with zero duty logs appears in list with 0 hours (not hidden)
- [ ] Terminal distribution with only one terminal shows 100% for that terminal
- [ ] Coverage grid for current week updates in real-time as slots are edited
- [ ] Admin mode can be toggled off mid-edit without data loss (changes already saved)
- [ ] Rapidly toggling the same cell (double-click) results in final server state, not intermediate states

## Assumptions
- Admin has already logged in and verified admin role before reaching this page
- Firestore security rules allow admin read access to all collections queried
- Firestore security rules allow admin write access to coverage_schedules and audit_log
- Coverage grid uses ISO week numbering (week 1 starts on first Thursday of year)
- All times are stored in UTC, displayed in chaplain's local timezone (TBD: timezone config)

## Open Questions
1. **Timezone handling:** Should duty hours display in airport local time (Dallas) or admin's browser timezone?
2. **Historical coverage:** Should old coverage weeks be editable, or locked after the week ends?
3. **Gap threshold:** Is 3 consecutive uncovered hours the right threshold for a "gap", or should it be configurable?
4. **Terminal distribution period:** Should the chart show all-time data, or filter to a specific date range like the hours table?
