---
id: pages-dashboard
title: "Dashboard Page"
description: "Operations overview with real-time KPI cards, on-duty chaplain list, recent duty logs, and coverage summary"
type: spec
subtype: pages
status: draft
sequence: 12
tags: [pages, dashboard, operations, p0]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, docs/core/004-database.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Dashboard Page

## Overview

The Dashboard is the operational command center of COMPASS. It is the first page an admin sees after login, designed to communicate the health and status of the chaplaincy program in under 5 seconds of scanning. The dashboard aggregates data from `users`, `duty_logs`, `chaplain_metrics`, and `coverage_schedules` into a clean, scannable layout optimized for quick decision-making.

This page answers the critical questions a program director asks every morning:
- How many chaplains are currently on duty?
- What's our operational tempo this week?
- Are there any coverage gaps today?
- Who are our most active chaplains?

The dashboard is **read-only** -- no edits happen here. It's a window into the system, not a control panel. Navigation to detail pages is via click-through on list items and cards.

## Route

**Path:** `/` (root)

**Layout:** Admin layout (sidebar + content area)

**Auth requirement:** Admin role (route guard enforced)

**Real-time updates:** Yes. Dashboard uses Firestore listeners for KPI cards and on-duty list. Data refreshes automatically when chaplains clock in/out or new encounters are logged.

## Page Structure

### 1. Page Header

**Content:**
- Page title: "Dashboard" (28px, bold, navy)
- Greeting: "Welcome back, [Admin First Name]" (16px, neutral-600, appears on same line as title on desktop, below on mobile)
- Last updated timestamp: "Last updated at 10:45 AM" (12px, neutral-400, far right on desktop)

**Actions:**
- Refresh button (icon-only, circular, tooltip: "Refresh data") -- forces re-query of all Firestore listeners
- This button is subtle, not prominent (data refreshes automatically, manual refresh is rarely needed)

### 2. KPI Cards Grid

**Layout:** Four cards in a horizontal row (desktop), 2x2 grid (tablet), vertical stack (mobile).

**Card structure (all cards):**
- Overline label (11px, uppercase, neutral-600, bold)
- Large number (36px, bold, neutral-900 or semantic color)
- Trend indicator (optional): Small arrow icon + percentage change + "vs [period]" text (12px)
  - Up arrow + green text for positive trends (e.g., more active chaplains)
  - Down arrow + red text for negative trends (only show if contextually bad, e.g., fewer encounters)
  - Neutral dash for no change
- Optional sparkline (tiny line chart showing last 7 days of this metric, 60px wide x 20px tall)

**Card 1: Total Chaplains**
- Label: "TOTAL CHAPLAINS"
- Metric: Count of `users` where `isChaplain = true`
- Trend: "+3 vs 30 days ago" (compare current count to count 30 days ago)
- Color: Neutral (dark text on white card)
- Click action: Navigate to `/users?filter=chaplains`

**Card 2: On Duty Now**
- Label: "ON DUTY NOW"
- Metric: Count of `users` where `onDuty = true AND isChaplain = true`
- Trend: None (real-time status, not historical)
- Color: Green number if count > 0, neutral if 0
- Click action: Scroll to "Currently On Duty" section below
- Real-time: Updates within 5 seconds when a chaplain clocks in/out

**Card 3: Encounters (7 Days)**
- Label: "ENCOUNTERS (7D)"
- Metric: Count of `chaplain_metrics` where `dateCollected >= 7 days ago`
- Trend: "+12% vs prior 7 days" (compare to the 7-day period before that)
- Sparkline: Daily encounter counts for the last 7 days
- Color: Neutral
- Click action: Navigate to `/reports?range=7d`

**Card 4: New Signups (30 Days)**
- Label: "NEW SIGNUPS (30D)"
- Metric: Count of `users` where `createdAt >= 30 days ago`
- Trend: "+5 vs prior 30 days"
- Color: Neutral
- Click action: Navigate to `/users?filter=new`

**Spacing:** 16px gap between cards. Cards have subtle shadow on white surface (like floating cards).

### 3. Two-Column Layout (Main Content)

**Desktop (1024px+):** Two equal-width columns with 24px gap.

**Tablet (768-1023px):** Columns stack vertically.

**Mobile (<768px):** Single column, sections stack.

#### Left Column: Currently On Duty

**Section header:** "Currently On Duty" (20px, bold, neutral-900)

**Empty state:** If no chaplains on duty, show empty state illustration + message: "No chaplains are currently on duty. Check the coverage schedule for today's assignments."

**Content (when data exists):** Vertical list of chaplain cards, sorted by clock-in time (most recent first).

**Chaplain card structure:**
- Avatar (48px circular) on left
- Name (16px, bold) + role badge (small pill: "Chaplain" or "Intern")
- Terminal assignment (14px, neutral-600): "Terminals: A, C"
- Clock-in time (12px, neutral-400): "On duty since 6:30 AM"
- Horizontal layout: avatar | info stack | clock-in time (right-aligned)
- Hover state: Subtle background highlight (primary-50)
- Click action: Navigate to `/users/:id` (chaplain detail page)

**List limit:** Show up to 10 chaplains. If more than 10 are on duty, show a "View all" link that navigates to `/users?filter=on-duty`.

**Real-time:** This list updates automatically when chaplains clock in/out (Firestore listener on `users` where `onDuty = true`).

#### Right Column: Today's Coverage Summary

**Section header:** "Today's Coverage" (20px, bold, neutral-900)

**Content:** Mini version of the coverage grid showing only today's row (17 hours, 5 AM - 9 PM).

**Display:** Horizontal row of 17 cells (small squares, 30px each). Each cell represents one hour:
- Green fill: Covered (slot value = true)
- White/empty: Not covered (slot value = false)
- Red border: Gap (3+ consecutive uncovered hours detected)

**Labels:**
- Hour labels above each cell: "5a, 6a, 7a, ... 9p" (abbreviated, small font)
- Coverage rate below grid: "Coverage Rate: 14/17 hours (82%)" (14px, neutral-600)

**Click action:** Navigate to `/coverage` (full coverage schedule page).

**Real-time:** Updates when coverage schedule is edited (Firestore listener on current week's `coverage_schedules` document).

### 4. Full-Width Section: Recent Duty Logs

**Section header:** "Recent Duty Logs" (20px, bold, neutral-900) with "View all" link on right (navigates to `/duty-days`)

**Content:** Data table with 10 most recent duty logs (sorted by `startTime desc`).

**Table columns:**
- Chaplain (name + avatar, 40px circular)
- Date (e.g., "Feb 9, 2026")
- Terminal (single letter: A, B, C, D, E, or "—" if not recorded)
- Hours (calculated from startTime/endTime, e.g., "6.5 hrs", or "Active" if still on duty)
- Status (badge: "Approved" in green, "Pending" in yellow, "Paid" in green with checkmark)

**Row click action:** Navigate to `/duty-days?highlight={logId}` (duty days page with that log highlighted)

**Empty state:** If no duty logs exist, show: "No duty logs yet. Chaplains will appear here when they clock in."

**Real-time:** Updates when new duty logs are created (Firestore listener on `duty_logs` ordered by `startTime desc`, limit 10).

## Page States

### Loading State
- **Trigger:** Initial page load or when Firestore listeners are connecting
- **Display:** Skeleton placeholders for all sections:
  - KPI cards: Pulsing gray rectangles matching card dimensions
  - On-duty list: 3 placeholder chaplain cards (gray avatars, gray text bars)
  - Coverage grid: Gray squares for all 17 cells
  - Duty logs table: 5 skeleton rows
- **Duration:** Typically <1 second on good connection, up to 3 seconds on slow networks

### Loaded State
- **Trigger:** All Firestore listeners have returned data
- **Display:** Full content rendered with real data
- **Transition:** Smooth cross-fade from skeleton to content (150ms ease)

### Empty State (Partial)
- **Scenario:** Some sections have no data (e.g., no chaplains on duty, no recent duty logs)
- **Display:** Empty state messages in those sections only. Other sections show data normally.
- **Examples:**
  - On-duty list empty: Illustration + "No chaplains on duty" message
  - Duty logs empty: "No duty logs yet" message in table area
  - KPI cards always show a number (even if 0), never empty state

### Error State
- **Trigger:** Firestore connection fails, permission denied, or query timeout
- **Display:** Yellow banner at top of page: "Unable to load dashboard data. [Retry] button."
- **Content below banner:** Show cached data if available (Firestore offline persistence) with a timestamp: "Showing cached data from 10:30 AM"
- **Retry action:** Re-initialize all Firestore listeners

### Stale Data State
- **Trigger:** Firestore listener disconnects (network loss) but cached data exists
- **Display:** Yellow banner: "Connection lost. Showing cached data from [time]. Data will refresh when connection is restored."
- **Auto-recovery:** Banner disappears when listener reconnects and fresh data loads

## Acceptance Criteria

**Given** an admin logs in successfully,
**When** the dashboard loads,
**Then** four KPI cards display with current counts, a list of on-duty chaplains appears (or empty state if none), today's coverage grid shows current status, and the 10 most recent duty logs appear in the table.

**Given** a chaplain clocks in while an admin is viewing the dashboard,
**When** the Firestore listener detects the change,
**Then** the "On Duty Now" KPI count increments within 5 seconds, and the chaplain's card appears in the on-duty list.

**Given** an admin clicks a KPI card,
**When** the card is clicked,
**Then** they navigate to the relevant filtered page (e.g., Total Chaplains → /users?filter=chaplains).

**Given** an admin clicks a chaplain card in the on-duty list,
**When** the card is clicked,
**Then** they navigate to that chaplain's detail page at `/users/:id`.

**Given** an admin clicks the coverage grid,
**When** the grid is clicked,
**Then** they navigate to the full coverage schedule page at `/coverage`.

**Given** the dashboard loads with no duty logs in the database,
**When** the Recent Duty Logs section attempts to render,
**Then** an empty state message displays: "No duty logs yet. Chaplains will appear here when they clock in."

**Given** the dashboard loses network connection,
**When** Firestore listeners disconnect,
**Then** a yellow banner appears: "Connection lost. Showing cached data from [time]." and the page displays the last known data.

## Edge Cases

### High On-Duty Count
- **Scenario:** 25 chaplains are on duty simultaneously (e.g., during a major event).
- **Behavior:** Show first 10 in the on-duty list, with "View all 25" link at the bottom.

### No Coverage Data for Today
- **Scenario:** Today's week hasn't been created in `coverage_schedules` yet.
- **Behavior:** Show all 17 cells as empty/white with note below: "No coverage data for this week. Visit the coverage page to create a schedule."

### Negative Trend Display
- **Scenario:** New signups are down 50% vs prior 30 days.
- **Behavior:** Show red down arrow with "−50% vs prior 30 days". This is not necessarily bad (signups fluctuate seasonally), so use neutral context, not alarming language.

### KPI Calculation Edge Cases
- **Encounters (7d) trend:** If prior 7-day period had 0 encounters and current has 10, show "+10 encounters" instead of "+∞%" (avoid division by zero).
- **On Duty Now = 0:** Show neutral gray "0" instead of red (zero on duty may be normal overnight).

## Mobile Considerations

**Dashboard on mobile (<768px):**
- KPI cards stack vertically (4 cards, full width, 16px gap)
- Two-column layout becomes single-column (on-duty list, then coverage summary, then duty logs)
- Coverage grid scrolls horizontally if needed (17 cells may not fit on narrow screens)
- Duty logs table shows only 3 columns on mobile: Chaplain, Date, Status (Terminal and Hours columns hidden to save space)
- Tap targets: All clickable cards and rows are minimum 56px height

**Performance:** Mobile dashboard should load in under 3 seconds on 3G network. Consider lazy-loading the duty logs table (load it after KPIs and on-duty list are visible).

## Performance Requirements

- **Initial load:** Dashboard fully rendered in under 2 seconds on desktop, under 3 seconds on mobile (3G)
- **Real-time update latency:** Changes propagate within 5 seconds (Firestore listener speed)
- **KPI calculation:** Client-side aggregation for counts completes in <100ms (Firestore queries are indexed)
- **Memory usage:** Dashboard page should not exceed 50 MB RAM (reasonable for a data-dense SPA view)

## Security & Privacy

- **Admin-only access:** Dashboard requires admin role (route guard)
- **No PII exposure:** Chaplain names and photos are internal-use data (not traveler data)
- **Firestore rules:** All read queries are protected by admin-only rules

## Future Enhancements (v1.1+)

- **Customizable KPIs:** Admin can choose which 4 metrics to display from a library of 10+ options
- **Date range selector:** Toggle between "Today", "This week", "This month" views for KPIs
- **Alerts/notifications:** Visual badge on dashboard if critical issues exist (e.g., 0 coverage tomorrow)
- **Export dashboard snapshot:** Download a PDF summary of current dashboard state for weekly reports
- **Heatmap visualization:** Replace coverage mini-grid with a heatmap showing intensity of chaplain activity by hour
