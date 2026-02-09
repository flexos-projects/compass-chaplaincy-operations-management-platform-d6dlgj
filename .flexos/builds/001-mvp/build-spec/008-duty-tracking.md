---
id: build-001-spec-duty-tracking
title: "Duty Tracking Build Spec"
description: "Gap analysis for duty day tracking and coverage schedule grid"
type: build
subtype: build-spec
status: draft
sequence: 8
tags: [build, spec, duty, coverage]
relatesTo: ["builds/001-mvp/config.md", "specs/005-features_duty-tracking-coverage.md", "specs/014-pages_duty-days.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Duty Tracking Build Spec

## What We Need

The specs define two interconnected pages for chaplain shift analysis and coverage planning:

**`/duty-days` page** -- Retrospective view of completed shifts. Four sections: period filter chips (All Time / 30d / 7d), terminal distribution horizontal bar chart (Terminals A-E with counts and percentages), chaplain hours table (all-time / 30d / 7d per chaplain, clickable to user detail), and a paginated duty log list (50 per page, sortable by date descending).

**`/coverage` page** -- Prospective weekly schedule matrix. 7 columns (Mon-Sun) x 17 rows (5 AM - 9 PM) = 119 cells. Week selector with ISO week navigation and year rollover handling. Edit mode toggle: off by default (read-only), on enables click-to-toggle cells. Optimistic updates with Firestore single-field writes. Coverage summary showing X/119 slots covered with percentage and longest consecutive gap detection. Gap alert with red left border on rows with 3+ consecutive uncovered hours.

Coverage documents use normalized nested maps (`slots.monday.5: true`) instead of 119 flat booleans from the original FlutterFlow app. Document ID format: `{weekNumber}-{year}`. Auto-create empty document (all slots false) when navigating to a week that doesn't exist.

## What Nuxt 4 Provides

- File-based routing creates `/duty-days` and `/coverage` from page files
- VueFire `useDocument` and `useCollection` for real-time Firestore bindings
- `date-fns` (already installed per T-001) for ISO week calculations, date arithmetic, period boundaries
- Auto-imports for composables and components
- Tailwind CSS for grid layout and responsive design

## The Gap

No duty tracking or coverage UI exists after T-001 through T-007. Everything below must be built from scratch:

1. **Terminal distribution chart** -- Custom horizontal bar component (no chart library in v1, CSS-based bars)
2. **Chaplain hours aggregation** -- Client-side groupBy and sum across duty_logs with three time windows
3. **Coverage grid component** -- 119-cell interactive matrix with edit mode, optimistic updates, and gap detection
4. **Week navigation** -- ISO week increment/decrement with year rollover edge cases (week 53, Jan 1 in prior year's week)
5. **Coverage slot persistence** -- Direct Firestore field-path writes (`slots.wednesday.14`) with audit trail via server API
6. **Gap detection algorithm** -- Per-day scan for 3+ consecutive uncovered hours

## Component Mapping

### Pages
- `pages/duty-days.vue` -- Period filter + terminal chart + chaplain hours table + duty log list
- `pages/coverage.vue` -- Week selector + coverage grid + summary stats + gap indicators

### Components
- `components/duty/TerminalDistribution.vue` -- Horizontal bar chart (CSS bars, no library). Props: `dutyLogs`, `period`. Emits nothing (display only). Calculates terminal grouping internally.
- `components/duty/ChaplainHoursTable.vue` -- Data table with all-time/30d/7d columns. Props: `dutyLogs`, `users`. Clickable chaplain name links to `/users/{id}`.
- `components/duty/DutyLogList.vue` -- Paginated table (50/page). Props: `dutyLogs`. Columns: chaplain, date, terminal, hours, status badge.
- `components/coverage/CoverageGrid.vue` -- 7x17 CSS Grid. Props: `weekNumber`, `year`, `editable`. Emits: `@cell-click(day, hour)`, `@week-change(week, year)`. Each cell is a `<button>` with aria-label.
- `components/coverage/WeekSelector.vue` -- Previous/next arrows, week number display, "Jump to Today" button. Uses `date-fns` `getISOWeek` and `getISOWeekYear`.
- `components/coverage/CoverageSummary.vue` -- Covered count, percentage, gap count, longest gap display.

### Composables
- `composables/useDutyDays.ts` -- VueFire `useCollection` on duty_logs with period filter. Returns `dutyLogs`, `loading`, `period`, `setPeriod`. Computes terminal distribution and chaplain hours.
- `composables/useCoverage.ts` -- VueFire `useDocument` on `coverage_schedules/{week}-{year}`. Returns `schedule`, `loading`, `editMode`, `toggleSlot(day, hour)`, `navigateWeek(direction)`. Handles auto-create for missing documents.

### Server Routes
- `server/api/coverage/[weekYear].patch.ts` -- Verify admin, update single slot field, set `updatedAt`/`updatedBy`, create audit_log entry. Request: `{ day, hour, covered }`.

## Data Requirements

### Firestore Collections
- **duty_logs** -- Read via VueFire with time-range `where` clauses. Composite index needed: `startTime` + `approved`. Pagination at 50 docs.
- **coverage_schedules** -- Single document per week. Nested map: `slots.{day}.{hour}: boolean`. Direct field-path updates for toggles.
- **users** -- Join for chaplain display names and avatars in duty tables.
- **audit_log** -- Server-side write on every coverage edit.

### Composite Indexes
- `duty_logs`: (`startTime` ASC) -- for period filtering
- `duty_logs`: (`userId`, `startTime` DESC) -- for per-chaplain queries

## Implementation Notes

**Terminal distribution without a chart library.** Use Tailwind width percentages on colored `<div>` bars. Each bar: `style="width: ${percentage}%"` inside a fixed-width container. This avoids adding Chart.js for a single horizontal bar chart.

**Coverage grid storage decision.** The spec explicitly calls for nested maps (`slots.monday.5`) over 119 flat booleans. Firestore supports dot-notation field-path updates (`updateDoc(ref, { 'slots.monday.5': true })`), so single-cell toggles don't require reading the full document.

**Week 53 edge case.** Not all years have ISO week 53. Use `date-fns` `getISOWeeksInYear()` to check. When decrementing from week 1, compute the prior year's last week number dynamically.

**Optimistic updates.** Toggle cell color immediately on click, then write to Firestore. If write fails, revert color and show error toast. VueFire listener will confirm the write on success (no visible change since already optimistic).

**Coverage edit audit trail.** The spec says coverage edits go through a server API route (PATCH) for audit logging, but also mentions direct client writes for non-sensitive operations. For v1, use the server route to satisfy the audit requirement. The slight latency (optimistic UI hides it) is worth the accountability.

## Dependencies

- **T-007 (User Management)** -- Chaplain hours table needs user display names and avatars from the users composable
- **T-003 (Firestore Rules)** -- coverage_schedules collection must be readable by authenticated users, writable via server API
- **T-004 (App Layout)** -- Both pages render inside the sidebar layout

## Estimated Effort

- Composables (useDutyDays, useCoverage): **4 hours**
- Duty days page + 3 components: **6 hours**
- Coverage page + grid + week selector + summary: **8 hours**
- Server route (coverage PATCH + audit): **2 hours**
- Gap detection algorithm + tests: **2 hours**
- Responsive QA (tablet, edge cases): **2 hours**

**Total: ~24 hours (3-4 days)**
