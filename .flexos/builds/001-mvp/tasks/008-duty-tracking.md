---
id: build-001-task-008
title: "Duty Day Tracking & Coverage Schedule Grid"
description: "Build duty day review page with terminal distribution chart, chaplain hours table, and interactive weekly coverage grid with edit mode"
type: build
subtype: task
status: pending
sequence: 8
tags: [build, task, duty, coverage]
relatesTo: ["builds/001-mvp/build-spec/008-duty-tracking.md", "specs/005-features_duty-tracking-coverage.md", "specs/014-pages_duty-days.md", "specs/021-database_coverage-schedules-collection.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 008: Duty Day Tracking & Coverage Schedule Grid

## Objective

Build two interconnected pages: `/duty-days` for historical duty shift analysis (terminal distribution, per-chaplain hours, duty log table) and `/coverage` for the interactive 7-day x 17-hour weekly coverage grid with admin edit mode. These pages read from `duty_logs` and `coverage_schedules` collections respectively.

## Prerequisites

- Task 007 (User Management) complete
- `duty_logs` collection has test data (seeded from T-003 or manually)
- `coverage_schedules` collection exists in Firestore
- `date-fns` installed (from T-001)
- VueFire configured and working

## Steps

### 1. Create Duty Days Composable

Create `app/composables/useDutyDays.ts`:

```typescript
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import { subDays, subWeeks } from 'date-fns'

type Period = 'all' | '30d' | '7d'

export function useDutyDays() {
  const db = useFirestore()
  const selectedPeriod = ref<Period>('all')

  // Compute the date filter based on selected period
  const periodStart = computed(() => {
    if (selectedPeriod.value === '7d') return Timestamp.fromDate(subDays(new Date(), 7))
    if (selectedPeriod.value === '30d') return Timestamp.fromDate(subDays(new Date(), 30))
    return null // all time
  })

  // Build query based on period
  const dutyLogsQuery = computed(() => {
    const constraints: any[] = []
    if (periodStart.value) {
      constraints.push(where('startTime', '>=', periodStart.value))
    }
    constraints.push(orderBy('startTime', 'desc'))
    constraints.push(limit(500))
    return query(collection(db, 'duty_logs'), ...constraints)
  })

  const dutyLogs = useCollection(dutyLogsQuery)

  // Terminal distribution: group by terminal, count logs
  const terminalDistribution = computed(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    const logs = dutyLogs.value || []
    let total = 0

    for (const log of logs) {
      const terminal = (log as any).terminal || 'Unknown'
      if (counts[terminal] !== undefined) {
        counts[terminal]++
      }
      total++
    }

    return Object.entries(counts)
      .map(([terminal, count]) => ({
        terminal,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
  })

  // Chaplain hours: group by userId, sum totalHours
  const chaplainHours = computed(() => {
    const byChaplain: Record<string, { allTime: number; thirtyDay: number; sevenDay: number }> = {}
    const now = new Date()
    const thirtyDaysAgo = subDays(now, 30)
    const sevenDaysAgo = subDays(now, 7)

    for (const log of dutyLogs.value || []) {
      const userId = (log as any).userId
      const hours = (log as any).totalHours || 0
      const startTime = (log as any).startTime?.toDate?.() || new Date(0)

      if (!byChaplain[userId]) {
        byChaplain[userId] = { allTime: 0, thirtyDay: 0, sevenDay: 0 }
      }

      byChaplain[userId].allTime += hours
      if (startTime >= thirtyDaysAgo) byChaplain[userId].thirtyDay += hours
      if (startTime >= sevenDaysAgo) byChaplain[userId].sevenDay += hours
    }

    return Object.entries(byChaplain)
      .map(([userId, hours]) => ({ userId, ...hours }))
      .sort((a, b) => b.allTime - a.allTime)
  })

  return {
    selectedPeriod,
    dutyLogs,
    terminalDistribution,
    chaplainHours,
    loading: computed(() => dutyLogs.pending?.value ?? false)
  }
}
```

### 2. Create Terminal Distribution Component

Create `app/components/duty/TerminalDistribution.vue`:

```vue
<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h3 class="text-lg font-semibold text-neutral-dark mb-4">Terminal Distribution</h3>

    <div v-if="data.length === 0" class="text-neutral-mid text-sm py-4">
      No duty log data available.
    </div>

    <div v-else class="space-y-3">
      <div v-for="item in data" :key="item.terminal" class="flex items-center gap-3">
        <span class="w-24 text-sm font-medium text-neutral-dark">
          Terminal {{ item.terminal }}
        </span>
        <div class="flex-1 bg-neutral-bg rounded-full h-6 overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            :style="{ width: `${Math.max(item.percentage, 2)}%` }"
          >
            <span v-if="item.percentage > 10" class="text-xs text-white font-medium">
              {{ item.count }}
            </span>
          </div>
        </div>
        <span class="w-16 text-sm text-neutral-mid text-right">
          {{ item.count }} ({{ item.percentage }}%)
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TerminalData {
  terminal: string
  count: number
  percentage: number
}

defineProps<{
  data: TerminalData[]
}>()
</script>
```

### 3. Create Duty Log List Component

Create `app/components/duty/DutyLogList.vue`:

```vue
<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="px-6 py-4 border-b border-neutral-light">
      <h3 class="text-lg font-semibold text-neutral-dark">Recent Duty Logs</h3>
    </div>

    <div v-if="logs.length === 0" class="p-6 text-center text-neutral-mid">
      No duty logs found for this period.
    </div>

    <table v-else class="w-full">
      <thead class="bg-neutral-bg text-left">
        <tr>
          <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Chaplain</th>
          <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Date</th>
          <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Terminal</th>
          <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Hours</th>
          <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-neutral-light">
        <tr
          v-for="log in logs"
          :key="log.id"
          class="hover:bg-neutral-bg/50 cursor-pointer"
          @click="navigateTo(`/users/${log.userId}`)"
        >
          <td class="px-4 py-3 text-sm text-neutral-dark">{{ log.userId }}</td>
          <td class="px-4 py-3 text-sm text-neutral-mid">
            {{ formatDate(log.startTime?.toDate?.()) }}
          </td>
          <td class="px-4 py-3 text-sm text-neutral-mid">{{ log.terminal || '—' }}</td>
          <td class="px-4 py-3 text-sm text-neutral-mid">
            {{ log.totalHours?.toFixed(1) || '0' }} hrs
          </td>
          <td class="px-4 py-3">
            <span
              :class="log.isPaid
                ? 'bg-success/10 text-success'
                : 'bg-warning/10 text-warning'"
              class="text-xs px-2 py-1 rounded-full font-medium"
            >
              {{ log.isPaid ? 'Paid' : 'Unpaid' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'

defineProps<{
  logs: any[]
}>()

function formatDate(date?: Date): string {
  if (!date) return '—'
  return format(date, 'MMM d, yyyy')
}
</script>
```

### 4. Create Duty Days Page

Create `app/pages/duty-days.vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold text-neutral-dark">Duty Days</h1>

    <!-- Period Filter Chips -->
    <div class="flex gap-2">
      <button
        v-for="period in periods"
        :key="period.value"
        :class="selectedPeriod === period.value
          ? 'bg-primary text-white'
          : 'bg-white text-neutral-dark border border-neutral-light hover:bg-neutral-bg'"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        @click="selectedPeriod = period.value"
      >
        {{ period.label }}
      </button>
    </div>

    <!-- Terminal Distribution -->
    <TerminalDistribution :data="terminalDistribution" />

    <!-- Chaplain Hours Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 border-b border-neutral-light">
        <h3 class="text-lg font-semibold text-neutral-dark">Chaplain Hours</h3>
      </div>
      <table class="w-full">
        <thead class="bg-neutral-bg text-left">
          <tr>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Chaplain</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">All-Time</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">30 Days</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">7 Days</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-light">
          <tr
            v-for="chaplain in chaplainHours"
            :key="chaplain.userId"
            class="hover:bg-neutral-bg/50 cursor-pointer"
            @click="navigateTo(`/users/${chaplain.userId}`)"
          >
            <td class="px-4 py-3 text-sm text-neutral-dark">{{ chaplain.userId }}</td>
            <td class="px-4 py-3 text-sm text-neutral-mid">{{ chaplain.allTime.toFixed(1) }} hrs</td>
            <td class="px-4 py-3 text-sm text-neutral-mid">{{ chaplain.thirtyDay.toFixed(1) }} hrs</td>
            <td class="px-4 py-3 text-sm text-neutral-mid">{{ chaplain.sevenDay.toFixed(1) }} hrs</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Duty Log List -->
    <DutyLogList :logs="(dutyLogs as any[] || [])" />
  </div>
</template>

<script setup lang="ts">
const { selectedPeriod, dutyLogs, terminalDistribution, chaplainHours } = useDutyDays()

const periods = [
  { label: 'All Time', value: 'all' as const },
  { label: 'Last 30 Days', value: '30d' as const },
  { label: 'Last 7 Days', value: '7d' as const },
]
</script>
```

### 5. Create Coverage Composable

Create `app/composables/useCoverage.ts`:

```typescript
import { doc, updateDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'
import { getISOWeek, getYear, addWeeks, startOfISOWeek, endOfISOWeek, format } from 'date-fns'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const HOURS = Array.from({ length: 17 }, (_, i) => (5 + i).toString()) // "5" through "21"

function generateEmptySlots(): Record<string, Record<string, boolean>> {
  const slots: Record<string, Record<string, boolean>> = {}
  for (const day of DAYS) {
    slots[day] = {}
    for (const hour of HOURS) {
      slots[day][hour] = false
    }
  }
  return slots
}

export function useCoverage() {
  const db = useFirestore()
  const { currentUser } = useAuth()

  const currentDate = ref(new Date())
  const editMode = ref(false)

  const weekNumber = computed(() => getISOWeek(currentDate.value))
  const year = computed(() => getYear(currentDate.value))
  const docId = computed(() => `${weekNumber.value}-${year.value}`)

  const weekStart = computed(() => startOfISOWeek(currentDate.value))
  const weekEnd = computed(() => endOfISOWeek(currentDate.value))
  const weekLabel = computed(() =>
    `Week ${weekNumber.value}, ${format(weekStart.value, 'MMM d')} - ${format(weekEnd.value, 'MMM d, yyyy')}`
  )

  // Firestore document reference
  const docRef = computed(() => doc(db, 'coverage_schedules', docId.value))
  const schedule = useDocument(docRef)

  // Slots data (from Firestore or empty defaults)
  const slots = computed(() => {
    return (schedule.value as any)?.slots || generateEmptySlots()
  })

  // Coverage summary
  const summary = computed(() => {
    let covered = 0
    const total = 119 // 7 days x 17 hours
    for (const day of DAYS) {
      for (const hour of HOURS) {
        if (slots.value[day]?.[hour]) covered++
      }
    }
    return {
      covered,
      total,
      gaps: total - covered,
      percentage: Math.round((covered / total) * 100)
    }
  })

  // Navigate weeks
  function goToPreviousWeek() {
    currentDate.value = addWeeks(currentDate.value, -1)
  }

  function goToNextWeek() {
    currentDate.value = addWeeks(currentDate.value, 1)
  }

  function goToCurrentWeek() {
    currentDate.value = new Date()
  }

  // Toggle a slot
  async function toggleSlot(day: string, hour: string) {
    if (!editMode.value) return

    const currentValue = slots.value[day]?.[hour] ?? false
    const fieldPath = `slots.${day}.${hour}`

    try {
      // Check if document exists; if not, create it
      if (!schedule.value) {
        await setDoc(docRef.value, {
          weekNumber: weekNumber.value,
          year: year.value,
          slots: generateEmptySlots(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.value?.uid || 'unknown'
        })
      }

      await updateDoc(docRef.value, {
        [fieldPath]: !currentValue,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.value?.uid || 'unknown'
      })
    } catch (error) {
      console.error('Failed to toggle coverage slot:', error)
      throw error
    }
  }

  return {
    weekNumber,
    year,
    weekLabel,
    editMode,
    slots,
    summary,
    loading: computed(() => schedule.pending?.value ?? false),
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    toggleSlot,
    DAYS,
    HOURS
  }
}
```

### 6. Create Coverage Grid Component

Create `app/components/coverage/CoverageGrid.vue`:

```vue
<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse min-w-[700px]">
      <thead>
        <tr>
          <th class="w-16 px-2 py-2 text-xs text-neutral-mid font-medium">Hour</th>
          <th
            v-for="day in days"
            :key="day"
            class="px-2 py-2 text-xs text-neutral-mid font-medium capitalize"
          >
            {{ day.slice(0, 3) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="hour in hours" :key="hour">
          <td class="px-2 py-1 text-xs text-neutral-mid font-medium text-right">
            {{ formatHour(hour) }}
          </td>
          <td
            v-for="day in days"
            :key="`${day}-${hour}`"
            :class="[
              'border border-neutral-light w-[60px] h-[36px] text-center transition-colors',
              slots[day]?.[hour]
                ? 'bg-success/20 text-success'
                : 'bg-white text-neutral-light',
              editable ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : ''
            ]"
            :aria-label="`${day} ${formatHour(hour)}: ${slots[day]?.[hour] ? 'covered' : 'gap'}`"
            role="button"
            :tabindex="editable ? 0 : -1"
            @click="editable && $emit('toggle', day, hour)"
            @keydown.enter="editable && $emit('toggle', day, hour)"
            @keydown.space.prevent="editable && $emit('toggle', day, hour)"
          >
            <span v-if="slots[day]?.[hour]" class="text-xs font-medium">&#10003;</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  slots: Record<string, Record<string, boolean>>
  days: readonly string[]
  hours: string[]
  editable: boolean
}>()

defineEmits<{
  toggle: [day: string, hour: string]
}>()

function formatHour(hour: string): string {
  const h = parseInt(hour)
  if (h === 0 || h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}
</script>
```

### 7. Create Week Selector Component

Create `app/components/coverage/WeekSelector.vue`:

```vue
<template>
  <div class="flex items-center gap-4">
    <button
      class="p-2 rounded-lg hover:bg-neutral-bg text-neutral-mid"
      aria-label="Previous week"
      @click="$emit('prev')"
    >
      &larr;
    </button>

    <div class="text-center">
      <p class="text-lg font-semibold text-neutral-dark">{{ label }}</p>
    </div>

    <button
      class="p-2 rounded-lg hover:bg-neutral-bg text-neutral-mid"
      aria-label="Next week"
      @click="$emit('next')"
    >
      &rarr;
    </button>

    <button
      class="ml-4 text-sm text-primary hover:text-primary-dark"
      @click="$emit('today')"
    >
      Jump to Today
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
}>()

defineEmits<{
  prev: []
  next: []
  today: []
}>()
</script>
```

### 8. Create Coverage Page

Create `app/pages/coverage.vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-neutral-dark">Coverage Schedule</h1>

      <!-- Edit Mode Toggle -->
      <label class="flex items-center gap-2 cursor-pointer">
        <span class="text-sm text-neutral-mid">Edit Mode</span>
        <input
          v-model="editMode"
          type="checkbox"
          class="w-5 h-5 rounded border-neutral-light text-primary focus:ring-primary"
        />
      </label>
    </div>

    <!-- Week Selector -->
    <WeekSelector
      :label="weekLabel"
      @prev="goToPreviousWeek"
      @next="goToNextWeek"
      @today="goToCurrentWeek"
    />

    <!-- Edit Mode Banner -->
    <div v-if="editMode" class="bg-primary/10 border border-primary/30 text-primary px-4 py-3 rounded-lg text-sm">
      Edit mode enabled. Click cells to toggle coverage.
    </div>

    <!-- Coverage Summary -->
    <div class="flex gap-4 text-sm">
      <div class="bg-white rounded-lg shadow px-4 py-3">
        <span class="text-neutral-mid">Coverage:</span>
        <span class="font-semibold text-neutral-dark ml-1">
          {{ summary.covered }}/{{ summary.total }} hours ({{ summary.percentage }}%)
        </span>
      </div>
      <div class="bg-white rounded-lg shadow px-4 py-3">
        <span class="text-neutral-mid">Gaps:</span>
        <span class="font-semibold text-error ml-1">{{ summary.gaps }} hours</span>
      </div>
    </div>

    <!-- Coverage Grid -->
    <div class="bg-white rounded-lg shadow p-4">
      <CoverageGrid
        :slots="slots"
        :days="DAYS"
        :hours="HOURS"
        :editable="editMode"
        @toggle="handleToggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  weekLabel, editMode, slots, summary, loading,
  goToPreviousWeek, goToNextWeek, goToCurrentWeek,
  toggleSlot, DAYS, HOURS
} = useCoverage()

async function handleToggle(day: string, hour: string) {
  try {
    await toggleSlot(day, hour)
  } catch {
    alert('Failed to save. Try again.')
  }
}
</script>
```

### 9. Add Navigation Links

Update the sidebar navigation (from T-004) to include:
- "Duty Days" linking to `/duty-days`
- "Coverage" linking to `/coverage`

### 10. Test

```bash
pnpm dev
```

**Test duty days page:**
1. Navigate to `/duty-days`
2. Verify terminal distribution bars render with counts and percentages
3. Click "Last 30 Days" and "Last 7 Days" filters -- data should re-query
4. Verify chaplain hours table shows all-time, 30d, 7d columns
5. Click a chaplain name -- should navigate to `/users/{id}`

**Test coverage page:**
1. Navigate to `/coverage`
2. Verify 7x17 grid renders with correct day/hour labels
3. Click prev/next week arrows -- grid should reload
4. Toggle "Edit Mode" on
5. Click a cell -- should toggle green/white and persist to Firestore
6. Check Firestore document: `coverage_schedules/{weekNumber}-{year}` has the updated `slots.{day}.{hour}` value
7. Verify coverage summary updates after toggling cells

### 11. Commit

```bash
git add .
git commit -m "feat: add duty day tracking page and interactive coverage schedule grid"
```

## Acceptance Criteria

- [ ] `/duty-days` page renders with period filter chips (All Time, 30 Days, 7 Days)
- [ ] Terminal distribution shows horizontal bars for Terminals A-E with counts and percentages
- [ ] Chaplain hours table shows all-time, 30-day, and 7-day hour breakdowns
- [ ] Clicking a chaplain name navigates to `/users/{chaplainId}`
- [ ] Duty log list table displays chaplain, date, terminal, hours, and paid/unpaid status
- [ ] Period filter updates terminal distribution, chaplain hours, and duty log list
- [ ] `/coverage` page renders a 7-day x 17-hour grid (119 cells)
- [ ] Week selector navigates between previous/next weeks with correct labels
- [ ] "Jump to Today" resets to current week
- [ ] Edit mode toggle enables/disables cell clicking
- [ ] Clicking a cell in edit mode toggles coverage and writes to Firestore: `slots.{day}.{hour}`
- [ ] Coverage summary shows covered hours, total, percentage, and gap count
- [ ] If coverage document does not exist for a week, it is auto-created with all slots false
- [ ] Failed slot toggle reverts the cell and shows an error message

## Estimated Time

**4 days** -- 2 days for duty tracking, 2 days for coverage grid

## Files Created/Modified

### Created
- `app/composables/useDutyDays.ts`
- `app/composables/useCoverage.ts`
- `app/pages/duty-days.vue`
- `app/pages/coverage.vue`
- `app/components/duty/TerminalDistribution.vue`
- `app/components/duty/DutyLogList.vue`
- `app/components/coverage/CoverageGrid.vue`
- `app/components/coverage/WeekSelector.vue`

### Modified
- Sidebar navigation (add Duty Days and Coverage links)

## Dependencies

**Depends on:** T-007 (User Management -- for chaplain user data and navigation)

## Next Task

**T-009: Stipend processing workflow**

## Notes

- The coverage grid stores hours as string keys (`"5"` through `"21"`) in a nested map -- NOT as 119 flat boolean fields. This is the normalized design from the spec.
- Document ID format for coverage schedules: `{weekNumber}-{year}` (e.g., `6-2026`).
- Use `date-fns` `getISOWeek()` for week number calculation. Handle week 53 edge case (some years have 53 ISO weeks).
- Coverage slot updates use Firestore dot-notation field paths: `slots.wednesday.14`.
- The `toggleSlot` function creates the document if it does not exist (first access of a new week).
- For production, audit log entries for coverage edits should be added via a server API route. In the MVP, client-side Firestore writes with security rules are acceptable.
