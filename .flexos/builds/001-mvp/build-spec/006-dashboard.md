---
id: build-001-spec-dashboard
title: "Dashboard Build Spec"
description: "Gap analysis for the operations dashboard with KPI cards, on-duty list, coverage summary, and recent duty logs"
type: build
subtype: build-spec
status: draft
sequence: 6
tags: [build, spec, dashboard, kpi, realtime]
relatesTo: ["builds/001-mvp/config.md", "specs/003-features_operations-dashboard.md", "specs/012-pages_dashboard.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Dashboard Build Spec

## What We Need

The dashboard specs (003-features_operations-dashboard.md, 012-pages_dashboard.md) call for the operational command center -- the first page admins see after login:

- **4 KPI cards** in a responsive grid: Total Chaplains, On Duty Now (real-time), Encounters (7d with trend), New Signups (30d)
- **On-Duty List** -- up to 10 chaplain cards with avatar, name, terminal, and clock-in time, updating in real-time via Firestore listeners
- **Today's Coverage Summary** -- mini 17-cell horizontal grid (5 AM - 9 PM) showing covered/uncovered hours with gap alerts for 3+ consecutive uncovered hours
- **Recent Duty Logs** -- data table with 10 most recent logs showing chaplain, date, terminal, hours, and approval status
- **Loading skeletons** for all sections, error/stale-data banners, and empty states
- **Real-time updates** -- all data powered by Firestore listeners, no polling, updates within 5 seconds

## What Nuxt 4 Provides

- **VueFire composables** -- `useCollection()` and `useDocument()` return reactive refs bound to Firestore queries with automatic listener management (attach on mount, detach on unmount)
- **Nuxt `pages/index.vue`** maps to `/` route automatically
- **Tailwind grid/flexbox** for responsive 4-column to 1-column KPI layout
- **`date-fns`** (from T-001) for relative time formatting ("2 hours ago") and date calculations

## The Gap

1. **`composables/useDashboard.ts`** -- encapsulates all 6 Firestore queries (4 KPIs + on-duty list + recent logs), trend calculations, and coverage parsing
2. **`components/dashboard/KPICard.vue`** -- reusable card with label, large number, optional trend arrow, optional color coding, and click navigation
3. **`components/dashboard/OnDutyList.vue`** -- chaplain card list with avatar, name, terminal badges, relative clock-in time
4. **`components/dashboard/CoverageMini.vue`** -- horizontal 17-cell grid for today's coverage with gap detection
5. **`components/dashboard/RecentDutyLogs.vue`** -- data table with 10 rows, status badges, row click navigation
6. **`pages/index.vue`** -- dashboard page wiring the composable to the 4 sections with loading/empty/error states

## Component Mapping

| File | Type | Purpose |
|------|------|---------|
| `pages/index.vue` | Page | Dashboard page shell |
| `composables/useDashboard.ts` | Composable | All Firestore queries + trend math |
| `components/dashboard/KPICard.vue` | Component | Reusable metric card |
| `components/dashboard/OnDutyList.vue` | Component | On-duty chaplain cards |
| `components/dashboard/CoverageMini.vue` | Component | Today's coverage mini-grid |
| `components/dashboard/RecentDutyLogs.vue` | Component | Recent duty logs table |

### KPICard Props

```typescript
interface KPICardProps {
  label: string                    // "TOTAL CHAPLAINS"
  value: number                    // 62
  trend?: {
    delta: number                  // +3
    percentage?: number            // +5%
    label: string                  // "vs 30 days ago"
  }
  color?: 'neutral' | 'success'   // green for on-duty count > 0
  to?: string                     // click navigation target
  loading?: boolean               // show skeleton
}
```

### useDashboard Composable API

```typescript
export function useDashboard() {
  // KPI data (reactive, real-time)
  const totalChaplains: Ref<number>
  const onDutyCount: Ref<number>
  const encounters7d: Ref<number>
  const newSignups30d: Ref<number>

  // Trend data (computed from current vs prior period)
  const chaplainTrend: ComputedRef<{ delta: number; percentage: number }>
  const encounterTrend: ComputedRef<{ delta: number; percentage: number }>

  // Lists (reactive, real-time)
  const onDutyChaplains: Ref<User[]>          // up to 10
  const recentDutyLogs: Ref<DutyLog[]>        // last 10
  const todayCoverage: Ref<boolean[]>          // 17 booleans (5AM-9PM)
  const coverageRate: ComputedRef<string>      // "14/17 (82%)"
  const coverageGaps: ComputedRef<string[]>    // ["6-9 AM uncovered"]

  // States
  const loading: Ref<boolean>
  const error: Ref<string | null>
}
```

## Data Requirements

### Firestore Queries (6 real-time listeners)

```typescript
// 1. Total chaplains (KPI)
query(collection('users'), where('isChaplain', '==', true))

// 2. On-duty chaplains (KPI + list)
query(collection('users'),
  where('onDuty', '==', true),
  where('isChaplain', '==', true),
  orderBy('displayName'),
  limit(10))

// 3. Encounters last 7 days (KPI)
query(collection('chaplain_metrics'),
  where('dateCollected', '>=', Timestamp.fromDate(sevenDaysAgo)))

// 4. New signups last 30 days (KPI)
query(collection('users'),
  where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)))

// 5. Recent duty logs (table)
query(collection('duty_logs'),
  orderBy('startTime', 'desc'),
  limit(10))

// 6. Today's coverage (mini-grid)
doc('coverage_schedules', `${weekNumber}-${year}`)
```

### Required Indexes

- `users: isChaplain ASC, displayName ASC`
- `users: onDuty ASC, isChaplain ASC, displayName ASC`
- `chaplain_metrics: dateCollected DESC`
- `duty_logs: startTime DESC`

### Trend Calculation

For "Encounters (7d)" trend: query `chaplain_metrics` for days 8-14 ago as the comparison period. Calculate `((current - prior) / prior) * 100`. If prior is 0, show "+N encounters" without percentage to avoid division by zero.

For "Total Chaplains" trend: this requires knowing the count 30 days ago. Option A: snapshot counts in a metrics collection (complex). Option B: query users where `createdAt <= 30 days ago AND isChaplain == true` and subtract from current count. Option B is simpler and accurate enough for v1.

## Implementation Notes

- **6 Firestore listeners** on one page is within normal limits. VueFire manages attach/detach automatically. No performance concern at COMPASS scale.
- **Coverage mini-grid** -- today's coverage is extracted from the current week's `coverage_schedules` document. The document stores `slots` as `Record<string, Record<number, boolean>>` where keys are day names and inner keys are hours (5-21). Extract today's day name, read the 17 boolean values.
- **Gap detection** -- iterate the 17 coverage booleans, find consecutive sequences of `false` values with length >= 3. Format as "6-9 AM uncovered" for the warning message.
- **Skeleton loading** -- each section independently manages loading state. Use `<template v-if="loading">` with skeleton UI components (pulsing gray blocks). Transition from skeleton to content with a 150ms cross-fade.
- **Empty states are per-section** -- "No chaplains on duty" only shows in the on-duty list. KPI cards always show a number (even 0), never an empty state.
- **Error banner** -- if any Firestore listener fails (network loss, permission error), show a yellow banner at the top: "Connection lost. Showing cached data from [time]." VueFire's offline persistence shows cached data automatically.
- **Clock-in time formatting** -- use `date-fns`'s `formatDistanceToNow()` for relative times ("2 hours ago"). For same-day logs, show the actual time ("6:30 AM") instead.
- **Responsive grid** -- KPI cards use `grid-cols-4` on desktop (>=1024px), `grid-cols-2` on tablet, `grid-cols-1` on mobile. The two-column body (on-duty + coverage) uses `grid-cols-2` on desktop, stacks on tablet/mobile.

## Dependencies

- **T-002 (Firebase Auth)** -- admin must be authenticated to view dashboard
- **T-003 (Firestore Schema)** -- collections (`users`, `duty_logs`, `chaplain_metrics`, `coverage_schedules`) must exist with correct indexes deployed
- **T-004 (App Layout)** -- `layouts/default.vue` provides the sidebar + content shell
- `date-fns` for relative time formatting
- `lucide-vue-next` for trend arrow icons and section icons
