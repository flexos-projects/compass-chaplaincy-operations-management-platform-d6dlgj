---
id: operations-dashboard
title: "Operations Dashboard"
description: "Real-time KPI cards, on-duty chaplain list, recent duty logs, and coverage summary for at-a-glance operational visibility"
type: spec
subtype: feature
status: draft
sequence: 3
tags: [dashboard, kpis, realtime, p0]
relatesTo: ["docs/core/002-features.md", "docs/core/003-pages.md", "docs/core/005-flows.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Operations Dashboard

## Overview

The Operations Dashboard is the first page an admin sees after login and the most frequently viewed page in COMPASS. Its purpose is singular: communicate the operational health of the chaplaincy program in under 5 seconds of scanning. The dashboard answers four critical questions every morning: (1) How many chaplains are on duty right now? (2) Are there coverage gaps today? (3) What were encounter metrics over the past week? (4) Are there any new chaplain signups?

All data on the dashboard is real-time, powered by Firestore listeners. When a chaplain clocks in via the mobile app, the "On Duty" count updates within 5 seconds without page refresh. The dashboard is mobile-friendly (stacks vertically on phone/tablet) but optimized for desktop where admins typically start their day.

Unlike generic admin templates with endless widget grids, the COMPASS dashboard is intentionally sparse — only information that drives daily operational decisions.

## User Stories

**US-001:** As a program director, when I open COMPASS in the morning, I want to immediately see how many chaplains are currently on duty so I know if terminal coverage is adequate.

**US-002:** As an operations coordinator, I want to see new chaplain signups over the last 7 and 30 days so I can proactively reach out for onboarding.

**US-003:** As a program director, I want to see encounter trends (crisis interventions, prayer requests) so I can identify when chaplain activity is unusually high or low.

**US-004:** As an admin, I want to see a list of who is currently on duty with their terminal assignments so I can quickly direct a traveler question to the right chaplain.

**US-005:** As an operations coordinator, I want to see today's coverage schedule at a glance so I can identify any uncovered hours and call backup chaplains.

**US-006:** As an admin, when data is loading, I want to see skeleton placeholders (not blank white space) so I know the page is working and data is on the way.

## Acceptance Criteria

### KPI Cards

**Given** the dashboard loads
**When** Firestore data is available
**Then** four KPI cards display in a horizontal row:
1. **Total Chaplains** — Count of users where `isChaplain == true`, with 30-day trend (e.g., "↑ 3 from 30d ago")
2. **On Duty Now** — Count of users where `onDuty == true && isChaplain == true`, colored green if > 0
3. **Encounters (7d)** — Count of `chaplain_metrics` documents where `dateCollected` is within the last 7 days, with trend vs. prior 7 days
4. **New Signups (30d)** — Count of users where `createdAt` is within the last 30 days

**Given** a chaplain goes on duty via the mobile app
**When** the dashboard is open in a browser
**Then** the "On Duty Now" count updates within 5 seconds (Firestore real-time listener)
**And** the chaplain appears in the "Currently On Duty" list below the KPI cards

**Given** there are no chaplains on duty
**When** the dashboard loads
**Then** the "On Duty Now" card shows "0" with a neutral gray color (not green)

**Given** encounter data is trending up
**When** the 7-day encounter count is greater than the prior 7-day period
**Then** the Encounters KPI card shows a green up-arrow with percentage increase (e.g., "↑ 15%")

### Currently On Duty List

**Given** there are chaplains currently on duty
**When** the dashboard loads
**Then** a section titled "Currently On Duty" displays up to 10 chaplain cards
**And** each card shows: avatar (photo or default), display name, terminal assignments (e.g., "Terminals A, B"), and clock-in time (relative, e.g., "2 hours ago")

**Given** there are no chaplains on duty
**When** the dashboard loads
**Then** the "Currently On Duty" section shows an empty state: "No chaplains on duty" with a neutral icon

**Given** there are more than 10 chaplains on duty
**When** the dashboard loads
**Then** the list shows the 10 most recently clocked-in chaplains
**And** a "View all (24)" link navigates to the Duty Days page pre-filtered for today

### Today's Coverage Summary

**Given** the dashboard loads
**When** coverage schedule data is available for today's date
**Then** a mini coverage grid displays showing only today's row (17 hourly slots from 5 AM to 9 PM)
**And** covered slots are filled green
**And** uncovered slots are white/empty
**And** the widget shows a summary stat: "Coverage: 12/17 hours (71%)"

**Given** there are 3+ consecutive uncovered hours
**When** the coverage summary renders
**Then** those slots have a red border to draw attention
**And** a warning message displays: "Gap Alert: 6-9 AM uncovered"

**Given** the admin clicks the coverage summary widget
**When** the click event fires
**Then** the user navigates to `/coverage` with today's week pre-selected

### Recent Duty Logs

**Given** the dashboard loads
**When** duty log data is available
**Then** a data table displays the 10 most recent duty logs
**And** columns are: Chaplain (name + avatar), Date, Terminal, Hours, Status (approved/pending badge)
**And** rows are sorted by `startTime DESC`

**Given** a duty log row is clicked
**When** the click event fires
**Then** the user navigates to `/duty-days` with the selected chaplain pre-filtered

**Given** there are no duty logs in the database (new deployment)
**When** the dashboard loads
**Then** the duty logs section shows an empty state: "No duty logs yet"

### Loading & Error States

**Given** the dashboard page is loading for the first time
**When** Firestore data has not yet arrived
**Then** each KPI card shows a skeleton placeholder (pulsing gray block matching card dimensions)
**And** the on-duty list shows 3 skeleton chaplain cards
**And** the coverage summary shows a skeleton grid
**And** the duty logs table shows 5 skeleton rows

**Given** a Firestore listener disconnects (network loss)
**When** the disconnect event fires
**Then** a yellow banner appears at top of page: "Connection lost. Showing cached data."
**And** data continues to display from Firestore's local cache
**And** the banner disappears automatically when the connection resumes

**Given** Firestore query fails with a permission error
**When** the error is caught
**Then** the affected section (e.g., KPI cards) shows an error state: "Unable to load data. Contact support."
**And** other sections that succeeded continue to display normally

### Responsive Behavior

**Given** the dashboard is viewed on desktop (≥ 1024px)
**When** the page renders
**Then** KPI cards display in a 4-column horizontal row
**And** on-duty list and coverage summary are side-by-side (2-column layout)
**And** duty logs table shows all columns

**Given** the dashboard is viewed on tablet (768-1023px)
**When** the page renders
**Then** KPI cards display in a 2x2 grid (2 rows, 2 columns)
**And** on-duty list and coverage summary stack vertically (1-column layout)
**And** duty logs table scrolls horizontally if needed

**Given** the dashboard is viewed on mobile (< 768px)
**When** the page renders
**Then** KPI cards stack vertically (1-column)
**And** on-duty list and coverage summary stack vertically
**And** duty logs table shows first 3 columns, others hidden (click row for details)

## Functional Requirements

### FR-001: KPI Card Component
Reusable component structure:
- **Label** (overline, gray, 11px, uppercase): "Total Chaplains"
- **Value** (large number, 36px, bold): "62"
- **Trend** (optional, small, with arrow icon): "↑ 3 from 30 days ago" (green if positive, red if negative)
- **Color coding**: Success green for on-duty count > 0, neutral otherwise
- **Click action**: Optional navigation (e.g., Total Chaplains → /users?filter=chaplains)

### FR-002: Firestore Queries
All queries use real-time listeners (not one-time fetches):

```typescript
// Total chaplains
const totalChaplains = useCollection(
  query(collection('users'), where('isChaplain', '==', true))
)

// On duty now
const onDutyChaplains = useCollection(
  query(
    collection('users'),
    where('onDuty', '==', true),
    where('isChaplain', '==', true),
    orderBy('displayName')
  )
)

// Encounters (7d)
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const encountersLast7d = useCollection(
  query(
    collection('chaplain_metrics'),
    where('dateCollected', '>=', Timestamp.fromDate(sevenDaysAgo))
  )
)

// New signups (30d)
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const newSignups30d = useCollection(
  query(
    collection('users'),
    where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
  )
)

// Recent duty logs
const recentDutyLogs = useCollection(
  query(
    collection('duty_logs'),
    orderBy('startTime', 'desc'),
    limit(10)
  )
)

// Coverage for today
const { weekNumber, year } = getCurrentWeek()
const coverageDoc = useDocument(
  doc('coverage_schedules', `${weekNumber}-${year}`)
)
```

### FR-003: Trend Calculation
For each trending KPI:
1. Fetch current period count (e.g., chaplains today)
2. Fetch comparison period count (e.g., chaplains 30 days ago)
3. Calculate delta: `current - comparison`
4. Calculate percentage: `((current - comparison) / comparison) * 100`
5. Display: "↑ 3 (+5%)" if positive, "↓ 2 (-3%)" if negative, "—" if unchanged

Trend comparisons:
- Total Chaplains: vs. 30 days ago
- Encounters (7d): vs. prior 7 days (days 8-14)
- New Signups: informational only (no trend)

### FR-004: Data Freshness
- Dashboard listeners attach on page mount (composable `onMounted` hook)
- Listeners detach on page unmount to prevent memory leaks
- No manual polling or refresh buttons needed (Firestore handles it)
- KPI counts recompute automatically when underlying collections change

### FR-005: Empty States
- **No chaplains on duty:** "No chaplains on duty" with neutral icon
- **No duty logs:** "No duty logs yet" with illustration
- **No coverage data:** Create coverage document with all slots `false`, show 0% coverage
- **New deployment (zero data):** Dashboard shows all zeros without errors

## Non-Functional Requirements

### NFR-001: Performance
- Dashboard initial render: < 2 seconds after hydration
- Firestore listener attachment: < 500ms
- Real-time update latency: < 5 seconds from Firestore write to UI update
- Page remains interactive during data loading (skeleton, not spinner overlay)

### NFR-002: Real-Time Guarantees
- On-duty count updates when chaplain clocks in/out (no page refresh needed)
- Coverage summary updates when admin edits today's schedule on `/coverage` page
- Recent duty logs update when new shift ends
- All updates use Firestore's real-time listeners (not polling)

### NFR-003: Mobile Responsiveness
- All KPI cards stack vertically on mobile (< 768px)
- Touch targets for clickable cards: minimum 44px height
- No horizontal scrolling on mobile (except duty logs table)
- Data remains readable on 375px width (iPhone SE)

### NFR-004: Accessibility
- KPI cards use `aria-label` for full context: "Total Chaplains: 62, up 3 from 30 days ago"
- Coverage summary announces: "Today's coverage: 12 out of 17 hours covered"
- Skeleton loaders have `aria-busy="true"` while loading
- Error states have `role="alert"`

## Dependencies

- VueFire composables (`useCollection`, `useDocument`) for real-time bindings
- Firestore indexes:
  - `users: isChaplain ASC, displayName ASC`
  - `users: onDuty ASC, isChaplain ASC`
  - `chaplain_metrics: dateCollected DESC`
  - `duty_logs: startTime DESC`
- `date-fns` for relative time formatting ("2 hours ago")

## Edge Cases

**EC-001: Zero Data on New Deployment**
All KPI cards show "0" with neutral styling. Empty states for lists. No errors.

**EC-002: Clock-In Without Terminal Assignment**
On-duty list shows "No terminal" instead of crashing.

**EC-003: Coverage Document Missing**
Create document on-the-fly with all slots `false`. Show 0% coverage.

**EC-004: Large On-Duty Count (50+ chaplains)**
Show top 10 most recent with "View all (52)" link. Do not render 50 cards (performance issue).

**EC-005: Negative Trend Calculation**
If comparison period is 0 (divide by zero), show absolute delta only: "↑ 5" without percentage.

## Testing Requirements

### Unit Tests
- [ ] Trend calculation: positive, negative, zero, and divide-by-zero cases
- [ ] Date range calculation for 7d and 30d lookups
- [ ] Week number calculation for coverage document ID
- [ ] Relative time formatting ("2 hours ago", "just now")

### Integration Tests
- [ ] Firestore listeners attach on mount and detach on unmount
- [ ] Real-time update: mock chaplain clock-in triggers UI update
- [ ] Error handling: listener failure shows error state, not crash
- [ ] Empty state: zero chaplains shows "No chaplains on duty"

### E2E Tests
- [ ] Dashboard loads with all sections visible
- [ ] KPI cards display correct counts from seeded data
- [ ] Clicking on-duty chaplain navigates to user detail
- [ ] Clicking coverage summary navigates to coverage page
- [ ] Mobile layout: cards stack vertically on 375px width

## Future Enhancements (Post-v1.1)

- Customizable dashboard widgets (admin chooses which KPIs to show)
- Historical trend charts (7-day encounter sparkline on KPI card)
- Quick actions: "Add New Chaplain" button on dashboard
- Notification center: unread messages, pending approvals badge
