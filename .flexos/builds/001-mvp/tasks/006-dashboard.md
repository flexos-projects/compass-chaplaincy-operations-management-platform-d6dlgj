---
id: build-001-task-006
title: "Dashboard Page"
description: "Operations dashboard with real-time KPI cards, on-duty chaplain list, today's coverage summary, and recent duty logs"
type: build
subtype: task
status: pending
sequence: 6
tags: [build, task, dashboard, realtime]
relatesTo: ["specs/003-features_operations-dashboard.md", "specs/012-pages_dashboard.md", "docs/core/004-database.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 006: Dashboard Page

## Objective

Build the operations dashboard -- the first page admins see after login. Displays 4 real-time KPI cards (Total Chaplains, On Duty Now, Encounters 7d, New Signups 30d), a live on-duty chaplain list, today's coverage summary bar, and a recent duty logs table. All data powered by Firestore real-time listeners via VueFire. Includes loading skeletons and empty states.

## Prerequisites

- Task 004 (App Layout) complete -- sidebar and default layout working
- Task 003 (Firestore Schema) complete -- TypeScript interfaces and seed data
- VueFire module configured in `nuxt.config.ts`
- Test chaplain data seeded in Firestore
- `date-fns` installed

## Steps

### 1. Create the Dashboard Composable

Create `app/composables/useDashboard.ts`:

```typescript
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { useCollection, useDocument } from 'vuefire'
import { getISOWeek, getYear, startOfDay, subDays, format } from 'date-fns'
import type { User, DutyLog, ChaplainMetric, CoverageSchedule } from '~/types/firestore'

export function useDashboard() {
  const db = useFirestore()

  // ------------------------------------------
  // KPI: Total chaplains
  // ------------------------------------------
  const chaplainsQuery = computed(() =>
    query(collection(db, 'users'), where('isChaplain', '==', true))
  )
  const chaplains = useCollection<User>(chaplainsQuery)
  const totalChaplains = computed(() => chaplains.value?.length ?? 0)

  // ------------------------------------------
  // KPI: On duty now
  // ------------------------------------------
  const onDutyQuery = computed(() =>
    query(
      collection(db, 'users'),
      where('onDuty', '==', true),
      where('isChaplain', '==', true),
      orderBy('displayName', 'asc')
    )
  )
  const onDutyChaplains = useCollection<User>(onDutyQuery)
  const onDutyCount = computed(() => onDutyChaplains.value?.length ?? 0)

  // ------------------------------------------
  // KPI: Encounters (7 days)
  // ------------------------------------------
  const sevenDaysAgo = Timestamp.fromDate(subDays(new Date(), 7))
  const encountersQuery = computed(() =>
    query(
      collection(db, 'chaplain_metrics'),
      where('dateCollected', '>=', sevenDaysAgo)
    )
  )
  const encounters7d = useCollection<ChaplainMetric>(encountersQuery)
  const encounterCount7d = computed(() => encounters7d.value?.length ?? 0)

  // Trend: prior 7 days (days 8-14)
  const fourteenDaysAgo = Timestamp.fromDate(subDays(new Date(), 14))
  const priorEncountersQuery = computed(() =>
    query(
      collection(db, 'chaplain_metrics'),
      where('dateCollected', '>=', fourteenDaysAgo),
      where('dateCollected', '<', sevenDaysAgo)
    )
  )
  const encountersPrior7d = useCollection<ChaplainMetric>(priorEncountersQuery)

  const encounterTrend = computed(() => {
    const current = encounterCount7d.value
    const prior = encountersPrior7d.value?.length ?? 0
    if (prior === 0) return current > 0 ? `+${current}` : null
    const pct = Math.round(((current - prior) / prior) * 100)
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct}%`
  })

  // ------------------------------------------
  // KPI: New signups (30 days)
  // ------------------------------------------
  const thirtyDaysAgo = Timestamp.fromDate(subDays(new Date(), 30))
  const newSignupsQuery = computed(() =>
    query(
      collection(db, 'users'),
      where('createdAt', '>=', thirtyDaysAgo)
    )
  )
  const newSignups30d = useCollection<User>(newSignupsQuery)
  const newSignupCount = computed(() => newSignups30d.value?.length ?? 0)

  // ------------------------------------------
  // On duty list (shared with KPI)
  // ------------------------------------------
  // onDutyChaplains already defined above

  // ------------------------------------------
  // Recent duty logs
  // ------------------------------------------
  const recentLogsQuery = computed(() =>
    query(
      collection(db, 'duty_logs'),
      orderBy('startTime', 'desc'),
      limit(10)
    )
  )
  const recentDutyLogs = useCollection<DutyLog>(recentLogsQuery)

  // ------------------------------------------
  // Today's coverage
  // ------------------------------------------
  const now = new Date()
  const currentWeek = getISOWeek(now)
  const currentYear = getYear(now)
  const todayDayName = format(now, 'EEEE').toLowerCase() as keyof CoverageSchedule['slots']

  const coverageDocRef = computed(() =>
    doc(db, 'coverage_schedules', `${currentWeek}-${currentYear}`)
  )
  const coverageDoc = useDocument<CoverageSchedule>(coverageDocRef)

  const todayCoverage = computed(() => {
    if (!coverageDoc.value?.slots) return null
    return coverageDoc.value.slots[todayDayName] ?? null
  })

  const coverageStats = computed(() => {
    const slots = todayCoverage.value
    if (!slots) return { covered: 0, total: 17, percentage: 0 }

    let covered = 0
    for (let h = 5; h <= 21; h++) {
      if (slots[String(h)]) covered++
    }
    return {
      covered,
      total: 17,
      percentage: Math.round((covered / 17) * 100)
    }
  })

  // ------------------------------------------
  // Loading state
  // ------------------------------------------
  const isLoading = computed(() =>
    chaplains.value === undefined
    || onDutyChaplains.value === undefined
    || encounters7d.value === undefined
    || recentDutyLogs.value === undefined
  )

  return {
    // KPI data
    totalChaplains,
    onDutyCount,
    encounterCount7d,
    encounterTrend,
    newSignupCount,

    // Lists
    onDutyChaplains,
    recentDutyLogs,

    // Coverage
    todayCoverage,
    coverageStats,
    todayDayName,

    // State
    isLoading,
  }
}
```

### 2. Create the KPI Card Component

Create `app/components/dashboard/KPICard.vue`:

```vue
<template>
  <component
    :is="clickable ? 'NuxtLink' : 'div'"
    :to="to"
    class="card group"
    :class="{ 'hover:shadow-md cursor-pointer transition-shadow': clickable }"
  >
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="h-3 w-24 bg-neutral-light/80 rounded animate-pulse mb-3" />
      <div class="h-9 w-16 bg-neutral-light/80 rounded animate-pulse" />
    </template>

    <!-- Content -->
    <template v-else>
      <p class="text-xs font-semibold uppercase tracking-wider text-neutral-mid">
        {{ label }}
      </p>
      <div class="flex items-end gap-2 mt-2">
        <p
          class="text-3xl font-bold"
          :class="valueColor"
        >
          {{ value }}
        </p>
        <span
          v-if="trend"
          class="text-xs font-medium mb-1"
          :class="trend.startsWith('+') ? 'text-success' : trend.startsWith('-') ? 'text-error' : 'text-neutral-mid'"
        >
          {{ trend }}
        </span>
      </div>
    </template>
  </component>
</template>

<script setup lang="ts">
interface Props {
  label: string
  value: string | number
  trend?: string | null
  to?: string
  loading?: boolean
  color?: 'default' | 'success' | 'warning'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'default',
  loading: false,
})

const clickable = computed(() => !!props.to)

const valueColor = computed(() => {
  switch (props.color) {
    case 'success': return 'text-success'
    case 'warning': return 'text-warning'
    default: return 'text-neutral-dark'
  }
})
</script>
```

### 3. Create the On Duty List Component

Create `app/components/dashboard/OnDutyList.vue`:

```vue
<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-neutral-dark">Currently On Duty</h2>
      <NuxtLink
        v-if="chaplains.length > 10"
        to="/users?filter=on-duty"
        class="text-sm text-primary hover:text-primary-dark"
      >
        View all ({{ chaplains.length }})
      </NuxtLink>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3 rounded-lg bg-white">
        <div class="w-10 h-10 rounded-full bg-neutral-light/80 animate-pulse" />
        <div class="flex-1 space-y-2">
          <div class="h-4 w-32 bg-neutral-light/80 rounded animate-pulse" />
          <div class="h-3 w-20 bg-neutral-light/80 rounded animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="chaplains.length === 0"
      class="card text-center py-8"
    >
      <p class="text-neutral-mid text-sm">No chaplains are currently on duty.</p>
      <p class="text-neutral-mid/60 text-xs mt-1">Check the coverage schedule for today's assignments.</p>
    </div>

    <!-- Chaplain list -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="chaplain in displayedChaplains"
        :key="chaplain.uid"
        :to="`/users/${chaplain.uid}`"
        class="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-primary/5 transition-colors"
      >
        <!-- Avatar -->
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
          {{ getInitials(chaplain.displayName) }}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-neutral-dark truncate">{{ chaplain.displayName }}</p>
          <p class="text-xs text-neutral-mid">
            {{ chaplain.terminals?.length ? `Terminals: ${chaplain.terminals.join(', ')}` : 'No terminal' }}
          </p>
        </div>

        <!-- Status badge -->
        <span class="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full flex-shrink-0">
          On Duty
        </span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types/firestore'

const props = defineProps<{
  chaplains: User[]
  loading: boolean
}>()

const displayedChaplains = computed(() => props.chaplains.slice(0, 10))

function getInitials(name: string): string {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
</script>
```

### 4. Create the Coverage Summary Component

Create `app/components/dashboard/CoverageSummary.vue`:

```vue
<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-neutral-dark">Today's Coverage</h2>
      <NuxtLink to="/coverage" class="text-sm text-primary hover:text-primary-dark">
        Full schedule
      </NuxtLink>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="card">
      <div class="flex gap-1">
        <div
          v-for="i in 17"
          :key="i"
          class="w-6 h-6 rounded bg-neutral-light/80 animate-pulse"
        />
      </div>
    </div>

    <!-- No data -->
    <div v-else-if="!coverage" class="card text-center py-6">
      <p class="text-neutral-mid text-sm">No coverage data for this week.</p>
      <NuxtLink to="/coverage" class="text-sm text-primary hover:text-primary-dark mt-1 inline-block">
        Create schedule
      </NuxtLink>
    </div>

    <!-- Coverage grid -->
    <div v-else class="card">
      <div class="flex gap-1 overflow-x-auto pb-2">
        <div v-for="hour in hours" :key="hour" class="flex flex-col items-center gap-1 flex-shrink-0">
          <span class="text-[10px] text-neutral-mid">{{ formatHour(hour) }}</span>
          <div
            class="w-6 h-6 rounded-sm border"
            :class="getSlotClass(hour)"
          />
        </div>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <p class="text-sm text-neutral-mid">
          Coverage: {{ stats.covered }}/{{ stats.total }} hours ({{ stats.percentage }}%)
        </p>
        <p class="text-xs text-neutral-mid capitalize">{{ dayName }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  coverage: Record<string, boolean> | null
  stats: { covered: number; total: number; percentage: number }
  dayName: string
  loading: boolean
}

const props = defineProps<Props>()

const hours = Array.from({ length: 17 }, (_, i) => i + 5) // 5 AM to 9 PM

function formatHour(h: number): string {
  if (h === 12) return '12p'
  if (h > 12) return `${h - 12}p`
  return `${h}a`
}

function getSlotClass(hour: number): string {
  if (!props.coverage) return 'bg-neutral-bg border-neutral-light'
  const covered = props.coverage[String(hour)]
  if (covered) return 'bg-success/30 border-success/50'
  return 'bg-white border-neutral-light'
}
</script>
```

### 5. Build the Dashboard Page

Replace `app/pages/index.vue`:

```vue
<template>
  <div>
    <PageHeader>
      <template #title>Dashboard</template>
      <template #subtitle>Welcome back, {{ displayName }}</template>
    </PageHeader>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <KPICard
        label="Total Chaplains"
        :value="totalChaplains"
        :loading="isLoading"
        to="/users?filter=chaplains"
      />
      <KPICard
        label="On Duty Now"
        :value="onDutyCount"
        :loading="isLoading"
        :color="onDutyCount > 0 ? 'success' : 'default'"
      />
      <KPICard
        label="Encounters (7d)"
        :value="encounterCount7d"
        :trend="encounterTrend"
        :loading="isLoading"
        to="/reports?range=7d"
      />
      <KPICard
        label="New Signups (30d)"
        :value="newSignupCount"
        :loading="isLoading"
      />
    </div>

    <!-- Two-column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- On Duty List -->
      <OnDutyList
        :chaplains="onDutyChaplains ?? []"
        :loading="isLoading"
      />

      <!-- Coverage Summary -->
      <CoverageSummary
        :coverage="todayCoverage"
        :stats="coverageStats"
        :day-name="todayDayName"
        :loading="isLoading"
      />
    </div>

    <!-- Recent Duty Logs -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-neutral-dark">Recent Duty Logs</h2>
        <NuxtLink to="/duty-days" class="text-sm text-primary hover:text-primary-dark">
          View all
        </NuxtLink>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="card">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4 py-3 border-b border-neutral-light/50 last:border-0">
          <div class="w-8 h-8 rounded-full bg-neutral-light/80 animate-pulse" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-40 bg-neutral-light/80 rounded animate-pulse" />
            <div class="h-3 w-24 bg-neutral-light/80 rounded animate-pulse" />
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!recentDutyLogs?.length"
        class="card text-center py-8"
      >
        <p class="text-neutral-mid text-sm">No duty logs yet.</p>
        <p class="text-neutral-mid/60 text-xs mt-1">Chaplains will appear here when they clock in.</p>
      </div>

      <!-- Duty logs table -->
      <div v-else class="card overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-neutral-light">
              <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2">Chaplain</th>
              <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2 hidden md:table-cell">Date</th>
              <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2 hidden lg:table-cell">Hours</th>
              <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in recentDutyLogs"
              :key="log.id"
              class="border-b border-neutral-light/50 last:border-0 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <td class="py-3 px-2">
                <p class="text-sm font-medium text-neutral-dark">{{ log.userId }}</p>
              </td>
              <td class="py-3 px-2 hidden md:table-cell">
                <p class="text-sm text-neutral-mid">{{ formatDate(log.startTime) }}</p>
              </td>
              <td class="py-3 px-2 hidden lg:table-cell">
                <p class="text-sm text-neutral-mid">
                  {{ log.totalHours ? `${log.totalHours.toFixed(1)} hrs` : 'Active' }}
                </p>
              </td>
              <td class="py-3 px-2">
                <span
                  class="text-xs font-medium px-2 py-1 rounded-full"
                  :class="log.isPaid
                    ? 'bg-success/10 text-success'
                    : log.approved
                      ? 'bg-primary/10 text-primary'
                      : 'bg-warning/10 text-warning'"
                >
                  {{ log.isPaid ? 'Paid' : log.approved ? 'Approved' : 'Pending' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import type { Timestamp } from 'firebase/firestore'

const { currentUser } = useAuth()

const {
  totalChaplains,
  onDutyCount,
  encounterCount7d,
  encounterTrend,
  newSignupCount,
  onDutyChaplains,
  recentDutyLogs,
  todayCoverage,
  coverageStats,
  todayDayName,
  isLoading,
} = useDashboard()

const displayName = computed(() => {
  if (!currentUser.value) return ''
  const name = currentUser.value.displayName || currentUser.value.email || ''
  return name.split(' ')[0]
})

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '-'
  try {
    return format(ts.toDate(), 'MMM d, yyyy')
  } catch {
    return '-'
  }
}
</script>
```

### 6. Test Dashboard

```bash
pnpm dev
```

**With seed data:**
1. Log in as admin
2. Dashboard loads with all 4 KPI cards showing counts from seed data
3. "Total Chaplains" shows count of seeded chaplains
4. "On Duty Now" shows 0 (no one is on duty initially)
5. "Encounters (7d)" shows 0 (no encounter data seeded)
6. "New Signups (30d)" shows count of recently created users

**Loading state:**
1. Refresh the page
2. Skeleton placeholders appear briefly before data loads
3. KPI cards show pulsing gray rectangles
4. On-duty list shows 3 skeleton cards
5. Duty logs table shows 5 skeleton rows

**Empty states:**
1. On-duty section shows "No chaplains are currently on duty."
2. Duty logs section shows "No duty logs yet."
3. Coverage shows "No coverage data for this week." (if no schedule created)

**Responsive:**
1. Desktop (1024px+): 4 KPI cards in a row, two-column layout below
2. Tablet (768-1023px): 2x2 KPI grid, sections stack vertically
3. Mobile (<768px): KPI cards stack vertically, simplified table columns

### 7. Commit

```bash
git add .
git commit -m "feat: add real-time dashboard with KPI cards, on-duty list, and coverage summary"
git push
```

## Acceptance Criteria

- [ ] `composables/useDashboard.ts` returns all KPI data with real-time Firestore listeners
- [ ] `components/dashboard/KPICard.vue` displays label, value, optional trend, and loading skeleton
- [ ] `components/dashboard/OnDutyList.vue` shows on-duty chaplains with avatar, name, terminals
- [ ] `components/dashboard/CoverageSummary.vue` shows today's 17-hour coverage bar
- [ ] `pages/index.vue` wires all components together in the dashboard layout
- [ ] Total Chaplains KPI shows correct count from `users` collection
- [ ] On Duty Now KPI updates in real-time when chaplain `onDuty` changes
- [ ] Encounters (7d) KPI shows count with trend percentage vs. prior 7 days
- [ ] New Signups (30d) KPI shows count of recently created users
- [ ] KPI cards with `to` prop are clickable links to filtered pages
- [ ] On Duty Now value is green when > 0
- [ ] Loading skeletons display for all sections while data loads
- [ ] Empty states display when sections have no data
- [ ] Coverage bar shows green (covered) and white (uncovered) slots for today
- [ ] Coverage stats show "X/17 hours (Y%)"
- [ ] Recent duty logs table shows 10 most recent entries
- [ ] Duty log status badges: Paid (green), Approved (blue), Pending (yellow)
- [ ] Responsive: 4-col KPI on desktop, 2-col on tablet, 1-col on mobile
- [ ] Table hides Date column on mobile, hides Hours column below lg breakpoint

## Estimated Time

**2 days (16 hours)** including composable development, component creation, and responsive testing

## Files Created/Modified

### Created
- `app/composables/useDashboard.ts`
- `app/components/dashboard/KPICard.vue`
- `app/components/dashboard/OnDutyList.vue`
- `app/components/dashboard/CoverageSummary.vue`

### Modified
- `app/pages/index.vue` (full rewrite with real data)

## Dependencies

**Depends on:** T-004 (App Layout), T-003 (Firestore Schema)

## Next Task

**T-007: User management**

After this task, the dashboard provides real-time operational visibility. Next task builds the user management pages for searching, viewing, and editing chaplain profiles.

## Troubleshooting

### Issue: KPI counts are always 0
**Solution:** Verify seed data exists in Firestore. Check that composite indexes are built (Firebase Console > Firestore > Indexes). VueFire queries may fail silently if indexes are missing.

### Issue: "Missing or insufficient permissions" on queries
**Solution:** Verify `app_settings/config` document exists with `adminUserIds` including the current user. Security rules use `isAdmin()` which reads this document.

### Issue: Coverage summary shows "No data" even though data exists
**Solution:** Coverage document ID format is `{weekNumber}-{year}` (e.g., `6-2026`). Verify the document ID matches `getISOWeek(now)-getYear(now)`.

### Issue: Real-time updates not working
**Solution:** VueFire listeners require the reactive query to be a `computed` ref. If the query is static, wrap it in `computed(() => ...)`. Also verify no Firestore index errors in browser console.

## Notes

- The duty logs table shows `log.userId` as the chaplain identifier. In a production implementation, you would join this with the `users` collection to show the chaplain's display name. A denormalized `userName` field on the duty log, or a lookup map from the users query, avoids N+1 queries.
- The `encounterTrend` computation avoids division by zero: if the prior period had 0 encounters, it shows the absolute count instead of a percentage.
- Coverage hours are 5-21 (5 AM to 9 PM), totaling 17 slots per day.
- All VueFire listeners automatically detach when the component unmounts (page navigation), preventing memory leaks.
