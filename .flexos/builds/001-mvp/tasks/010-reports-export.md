---
id: build-001-task-010
title: "Reports Page with Metrics Aggregation & CSV Export"
description: "Build the reports analytics page with encounter metrics, duty hours summaries, stipend totals, date range filtering, and CSV export using papaparse"
type: build
subtype: task
status: pending
sequence: 10
tags: [build, task, reports, export]
relatesTo: ["builds/001-mvp/build-spec/010-reports-export.md", "specs/007-features_metrics-reporting.md", "specs/016-pages_reports.md", "specs/030-flow_report-export-flow.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 010: Reports Page with Metrics Aggregation & CSV Export

## Objective

Build the Reports page at `/reports` with three aggregated data sections (encounters by type, duty hours by chaplain/terminal, stipend totals by month/YTD), date range and filter controls, and server-side CSV export using papaparse. This provides operational analytics for board presentations and grant reporting.

## Prerequisites

- Task 009 (Stipend Processing) complete
- `chaplain_metrics`, `duty_logs`, and `chaplain_payouts` collections have data
- `papaparse` installed (from T-001)
- Server auth utilities working (from T-002)

## Steps

### 1. Create Reports Composable

Create `app/composables/useReports.ts`:

```typescript
import { ref, computed, watch } from 'vue'
import { subDays, subMonths, startOfYear, format } from 'date-fns'

type DatePreset = '7d' | '30d' | '90d' | 'year' | 'custom'

interface ReportFilters {
  datePreset: DatePreset
  fromDate: string
  toDate: string
  terminal: string
  chaplainId: string
}

interface EncounterMetrics {
  total: number
  byType: Record<string, number>
  byMedium: Record<string, number>
  byTerminal: Record<string, { count: number; percentage: number }>
}

interface DutyMetrics {
  totalHours: number
  totalShifts: number
  avgShiftLength: number
  byChaplain: { name: string; hours: number; shifts: number }[]
  byTerminal: Record<string, { hours: number; shifts: number }>
}

interface StipendMetrics {
  totalPaid: number
  totalShifts: number
  byMonth: { month: string; amount: number; shifts: number }[]
  byChaplain: { name: string; totalPaid: number; shifts: number }[]
}

export function useReports() {
  const filters = ref<ReportFilters>({
    datePreset: '30d',
    fromDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
    terminal: 'all',
    chaplainId: 'all'
  })

  const encounters = ref<EncounterMetrics | null>(null)
  const dutyHours = ref<DutyMetrics | null>(null)
  const stipends = ref<StipendMetrics | null>(null)
  const loading = ref(false)
  const exporting = ref(false)

  // Update date range when preset changes
  function applyPreset(preset: DatePreset) {
    filters.value.datePreset = preset
    const now = new Date()
    switch (preset) {
      case '7d':
        filters.value.fromDate = format(subDays(now, 7), 'yyyy-MM-dd')
        break
      case '30d':
        filters.value.fromDate = format(subDays(now, 30), 'yyyy-MM-dd')
        break
      case '90d':
        filters.value.fromDate = format(subMonths(now, 3), 'yyyy-MM-dd')
        break
      case 'year':
        filters.value.fromDate = format(startOfYear(now), 'yyyy-MM-dd')
        break
    }
    filters.value.toDate = format(now, 'yyyy-MM-dd')
  }

  async function fetchReports() {
    loading.value = true
    try {
      const token = await useCurrentUser().value?.getIdToken()
      const params = {
        from: filters.value.fromDate,
        to: filters.value.toDate,
        terminal: filters.value.terminal,
        chaplain: filters.value.chaplainId
      }
      const headers = { Authorization: `Bearer ${token}` }

      const [encData, dutyData, stipendData] = await Promise.all([
        $fetch('/api/reports/encounters', { params, headers }),
        $fetch('/api/reports/duty-hours', { params, headers }),
        $fetch('/api/reports/stipend-summary', { params, headers })
      ])

      encounters.value = encData as any
      dutyHours.value = dutyData as any
      stipends.value = stipendData as any
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      loading.value = false
    }
  }

  async function exportCSV(type: 'encounters' | 'duty-hours' | 'stipends') {
    exporting.value = true
    try {
      const token = await useCurrentUser().value?.getIdToken()
      const response = await $fetch('/api/reports/export', {
        params: {
          type,
          from: filters.value.fromDate,
          to: filters.value.toDate,
          terminal: filters.value.terminal,
          chaplain: filters.value.chaplainId
        },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      })

      // Trigger browser download
      const blob = new Blob([response as any], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `compass-${type}-${filters.value.fromDate}-${filters.value.toDate}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export. Try again.')
    } finally {
      exporting.value = false
    }
  }

  function resetFilters() {
    applyPreset('30d')
    filters.value.terminal = 'all'
    filters.value.chaplainId = 'all'
  }

  // Fetch on mount
  watch(filters, () => fetchReports(), { deep: true, immediate: true })

  return {
    filters,
    encounters,
    dutyHours,
    stipends,
    loading,
    exporting,
    applyPreset,
    fetchReports,
    exportCSV,
    resetFilters
  }
}
```

### 2. Create Reports Page

Create `app/pages/reports.vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold text-neutral-dark">Reports</h1>

    <!-- Filter Bar -->
    <div class="bg-white rounded-lg shadow p-4 space-y-3">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in presets"
          :key="preset.value"
          :class="filters.datePreset === preset.value
            ? 'bg-primary text-white'
            : 'bg-neutral-bg text-neutral-dark hover:bg-neutral-light'"
          class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="applyPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="block text-xs text-neutral-mid mb-1">From</label>
          <input
            v-model="filters.fromDate"
            type="date"
            class="px-3 py-2 border border-neutral-light rounded-lg text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-neutral-mid mb-1">To</label>
          <input
            v-model="filters.toDate"
            type="date"
            class="px-3 py-2 border border-neutral-light rounded-lg text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-neutral-mid mb-1">Terminal</label>
          <select
            v-model="filters.terminal"
            class="px-3 py-2 border border-neutral-light rounded-lg text-sm"
          >
            <option value="all">All Terminals</option>
            <option v-for="t in ['A','B','C','D','E']" :key="t" :value="t">Terminal {{ t }}</option>
          </select>
        </div>
        <button
          class="px-3 py-2 text-sm text-primary hover:text-primary-dark"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-neutral-mid">Loading report data...</div>

    <template v-else>
      <!-- Encounter Metrics -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-neutral-dark">Chaplain Encounters</h2>
          <button
            :disabled="exporting"
            class="px-3 py-1 text-sm border border-neutral-light rounded-lg hover:bg-neutral-bg"
            @click="exportCSV('encounters')"
          >
            Export CSV
          </button>
        </div>

        <div v-if="encounters" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Total Encounters</p>
            <p class="text-2xl font-semibold text-neutral-dark">{{ encounters.total }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Crisis</p>
            <p class="text-2xl font-semibold text-error">{{ encounters.byType?.crisis || 0 }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Prayer Requests</p>
            <p class="text-2xl font-semibold text-primary">{{ encounters.byType?.prayerRequested || 0 }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Grief</p>
            <p class="text-2xl font-semibold text-warning">{{ encounters.byType?.grief || 0 }}</p>
          </div>
        </div>

        <!-- Encounter Type Breakdown (CSS bars) -->
        <div v-if="encounters?.byType" class="space-y-2">
          <div
            v-for="(count, type) in encounters.byType"
            :key="type"
            class="flex items-center gap-3"
          >
            <span class="w-32 text-sm text-neutral-mid capitalize">{{ formatType(type as string) }}</span>
            <div class="flex-1 bg-neutral-bg rounded-full h-5 overflow-hidden">
              <div
                class="h-full bg-primary/70 rounded-full transition-all duration-500"
                :style="{ width: `${encounters.total > 0 ? (count / encounters.total) * 100 : 0}%` }"
              />
            </div>
            <span class="w-12 text-sm text-neutral-mid text-right">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- Duty Hours Summary -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-neutral-dark">Duty Hours</h2>
          <button
            :disabled="exporting"
            class="px-3 py-1 text-sm border border-neutral-light rounded-lg hover:bg-neutral-bg"
            @click="exportCSV('duty-hours')"
          >
            Export CSV
          </button>
        </div>

        <div v-if="dutyHours" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Total Hours</p>
            <p class="text-2xl font-semibold text-neutral-dark">{{ dutyHours.totalHours?.toFixed(1) }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Total Shifts</p>
            <p class="text-2xl font-semibold text-neutral-dark">{{ dutyHours.totalShifts }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Avg Shift</p>
            <p class="text-2xl font-semibold text-neutral-dark">{{ dutyHours.avgShiftLength?.toFixed(1) }} hrs</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Active Chaplains</p>
            <p class="text-2xl font-semibold text-neutral-dark">{{ dutyHours.byChaplain?.length || 0 }}</p>
          </div>
        </div>

        <!-- Chaplain Hours Table -->
        <table v-if="dutyHours?.byChaplain?.length" class="w-full text-sm">
          <thead class="bg-neutral-bg text-left">
            <tr>
              <th class="px-4 py-2 text-neutral-mid">Chaplain</th>
              <th class="px-4 py-2 text-neutral-mid">Shifts</th>
              <th class="px-4 py-2 text-neutral-mid">Hours</th>
              <th class="px-4 py-2 text-neutral-mid">Avg/Shift</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-light">
            <tr v-for="ch in dutyHours.byChaplain" :key="ch.name">
              <td class="px-4 py-2 text-neutral-dark">{{ ch.name }}</td>
              <td class="px-4 py-2 text-neutral-mid">{{ ch.shifts }}</td>
              <td class="px-4 py-2 text-neutral-mid">{{ ch.hours.toFixed(1) }}</td>
              <td class="px-4 py-2 text-neutral-mid">
                {{ ch.shifts > 0 ? (ch.hours / ch.shifts).toFixed(1) : '0' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Stipend Summary -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-neutral-dark">Stipend Payments</h2>
          <button
            :disabled="exporting"
            class="px-3 py-1 text-sm border border-neutral-light rounded-lg hover:bg-neutral-bg"
            @click="exportCSV('stipends')"
          >
            Export CSV
          </button>
        </div>

        <div v-if="stipends" class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Total Paid</p>
            <p class="text-2xl font-semibold text-neutral-dark">${{ stipends.totalPaid?.toFixed(2) }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Shifts Paid</p>
            <p class="text-2xl font-semibold text-neutral-dark">{{ stipends.totalShifts }}</p>
          </div>
          <div class="bg-neutral-bg rounded-lg p-4">
            <p class="text-xs text-neutral-mid">Avg per Chaplain</p>
            <p class="text-2xl font-semibold text-neutral-dark">
              ${{ stipends.byChaplain?.length
                ? (stipends.totalPaid / stipends.byChaplain.length).toFixed(2)
                : '0' }}
            </p>
          </div>
        </div>

        <!-- Monthly Breakdown -->
        <div v-if="stipends?.byMonth?.length" class="mb-4">
          <h3 class="text-sm font-medium text-neutral-dark mb-2">Monthly Breakdown</h3>
          <div class="space-y-1">
            <div v-for="m in stipends.byMonth" :key="m.month" class="flex justify-between text-sm">
              <span class="text-neutral-mid">{{ m.month }}</span>
              <span class="text-neutral-dark font-medium">${{ m.amount.toFixed(2) }} ({{ m.shifts }} shifts)</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const {
  filters, encounters, dutyHours, stipends,
  loading, exporting, applyPreset, exportCSV, resetFilters
} = useReports()

const presets = [
  { label: 'Last 7 Days', value: '7d' as const },
  { label: 'Last 30 Days', value: '30d' as const },
  { label: 'Last 90 Days', value: '90d' as const },
  { label: 'This Year', value: 'year' as const },
]

function formatType(type: string): string {
  return type.replace(/([A-Z])/g, ' $1').trim()
}
</script>
```

### 3. Create Server Route: Encounter Metrics

Create `server/api/reports/encounters.get.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)
  const { from, to, terminal, chaplain } = getQuery(event)

  let q = adminDb.collection('chaplain_metrics')
    .where('dateCollected', '>=', new Date(from as string))
    .where('dateCollected', '<=', new Date(to as string))
    .orderBy('dateCollected', 'desc')

  if (terminal && terminal !== 'all') {
    q = q.where('terminal', '==', terminal) as any
  }
  if (chaplain && chaplain !== 'all') {
    q = q.where('chaplainId', '==', chaplain) as any
  }

  const snap = await q.limit(1000).get()
  const docs = snap.docs.map(d => d.data())

  // Aggregate by type
  const byType: Record<string, number> = {
    crisis: 0, violence: 0, policeInvolved: 0, grief: 0,
    travelRelated: 0, personalIssue: 0, prayerRequested: 0
  }
  const byMedium: Record<string, number> = { inPerson: 0, byPhone: 0, chatOnly: 0 }
  const byTerminal: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }

  for (const doc of docs) {
    const et = doc.encounterType || {}
    for (const key of Object.keys(byType)) {
      if (et[key]) byType[key]++
    }
    const em = doc.encounterMedium || {}
    for (const key of Object.keys(byMedium)) {
      if (em[key]) byMedium[key]++
    }
    const t = doc.terminal || 'Unknown'
    if (byTerminal[t] !== undefined) byTerminal[t]++
  }

  const total = docs.length
  const byTerminalWithPct = Object.fromEntries(
    Object.entries(byTerminal).map(([k, v]) => [k, {
      count: v,
      percentage: total > 0 ? Math.round((v / total) * 100) : 0
    }])
  )

  return { total, byType, byMedium, byTerminal: byTerminalWithPct }
})
```

### 4. Create Server Route: Duty Hours

Create `server/api/reports/duty-hours.get.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)
  const { from, to, terminal, chaplain } = getQuery(event)

  let q = adminDb.collection('duty_logs')
    .where('startTime', '>=', new Date(from as string))
    .where('startTime', '<=', new Date(to as string))
    .orderBy('startTime', 'desc')

  const snap = await q.limit(1000).get()
  const docs = snap.docs.map(d => d.data())

  let totalHours = 0
  const byChaplainMap: Record<string, { name: string; hours: number; shifts: number }> = {}
  const byTerminal: Record<string, { hours: number; shifts: number }> = {}

  for (const doc of docs) {
    const hours = doc.totalHours || 0
    totalHours += hours

    const uid = doc.userId
    if (!byChaplainMap[uid]) byChaplainMap[uid] = { name: uid, hours: 0, shifts: 0 }
    byChaplainMap[uid].hours += hours
    byChaplainMap[uid].shifts++

    const t = doc.terminal || 'Unknown'
    if (!byTerminal[t]) byTerminal[t] = { hours: 0, shifts: 0 }
    byTerminal[t].hours += hours
    byTerminal[t].shifts++
  }

  // Fetch chaplain names
  const byChaplain = await Promise.all(
    Object.entries(byChaplainMap).map(async ([uid, data]) => {
      const userSnap = await adminDb.doc(`users/${uid}`).get()
      return { ...data, name: userSnap.data()?.displayName || uid }
    })
  )

  return {
    totalHours,
    totalShifts: docs.length,
    avgShiftLength: docs.length > 0 ? totalHours / docs.length : 0,
    byChaplain: byChaplain.sort((a, b) => b.hours - a.hours),
    byTerminal
  }
})
```

### 5. Create Server Route: Stipend Summary

Create `server/api/reports/stipend-summary.get.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)
  const { from, to, chaplain } = getQuery(event)

  let q = adminDb.collection('chaplain_payouts')
    .where('createdAt', '>=', new Date(from as string))
    .where('createdAt', '<=', new Date(to as string))
    .orderBy('createdAt', 'desc')

  if (chaplain && chaplain !== 'all') {
    q = q.where('chaplainId', '==', chaplain) as any
  }

  const snap = await q.limit(500).get()
  const docs = snap.docs.map(d => d.data())

  let totalPaid = 0
  let totalShifts = 0
  const byMonthMap: Record<string, { amount: number; shifts: number }> = {}
  const byChaplainMap: Record<string, { totalPaid: number; shifts: number }> = {}

  for (const doc of docs) {
    totalPaid += doc.payoutAmount || 0
    totalShifts += doc.dutyLogCount || 0

    const monthKey = `${doc.monthPaid} ${doc.yearPaid}`
    if (!byMonthMap[monthKey]) byMonthMap[monthKey] = { amount: 0, shifts: 0 }
    byMonthMap[monthKey].amount += doc.payoutAmount || 0
    byMonthMap[monthKey].shifts += doc.dutyLogCount || 0

    const cid = doc.chaplainId
    if (!byChaplainMap[cid]) byChaplainMap[cid] = { totalPaid: 0, shifts: 0 }
    byChaplainMap[cid].totalPaid += doc.payoutAmount || 0
    byChaplainMap[cid].shifts += doc.dutyLogCount || 0
  }

  // Fetch chaplain names
  const byChaplain = await Promise.all(
    Object.entries(byChaplainMap).map(async ([uid, data]) => {
      const userSnap = await adminDb.doc(`users/${uid}`).get()
      return { name: userSnap.data()?.displayName || uid, ...data }
    })
  )

  return {
    totalPaid,
    totalShifts,
    byMonth: Object.entries(byMonthMap).map(([month, data]) => ({ month, ...data })),
    byChaplain: byChaplain.sort((a, b) => b.totalPaid - a.totalPaid)
  }
})
```

### 6. Create Server Route: CSV Export

Create `server/api/reports/export.get.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'
import Papa from 'papaparse'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)
  const { type, from, to, terminal, chaplain } = getQuery(event)

  let rows: any[] = []

  if (type === 'encounters') {
    let q = adminDb.collection('chaplain_metrics')
      .where('dateCollected', '>=', new Date(from as string))
      .where('dateCollected', '<=', new Date(to as string))
      .orderBy('dateCollected', 'desc')
      .limit(5000)

    const snap = await q.get()

    // Fetch chaplain names
    const userCache: Record<string, string> = {}
    for (const doc of snap.docs) {
      const uid = doc.data().chaplainId
      if (uid && !userCache[uid]) {
        const userSnap = await adminDb.doc(`users/${uid}`).get()
        userCache[uid] = userSnap.data()?.displayName || uid
      }
    }

    rows = snap.docs.map(d => {
      const data = d.data()
      const et = data.encounterType || {}
      const em = data.encounterMedium || {}
      return {
        Date: data.dateCollected?.toDate?.()?.toISOString()?.split('T')[0] || '',
        Chaplain: userCache[data.chaplainId] || data.chaplainId,
        Terminal: data.terminal || '',
        Gate: data.gate || '',
        Crisis: et.crisis ? 'Yes' : 'No',
        Violence: et.violence ? 'Yes' : 'No',
        'Police Involved': et.policeInvolved ? 'Yes' : 'No',
        Grief: et.grief ? 'Yes' : 'No',
        'Travel Related': et.travelRelated ? 'Yes' : 'No',
        Prayer: et.prayerRequested ? 'Yes' : 'No',
        'In Person': em.inPerson ? 'Yes' : 'No',
        'By Phone': em.byPhone ? 'Yes' : 'No',
        Chat: em.chatOnly ? 'Yes' : 'No',
        'Duration (min)': data.durationMinutes || '',
        Notes: data.note || ''
      }
    })
  } else if (type === 'duty-hours') {
    let q = adminDb.collection('duty_logs')
      .where('startTime', '>=', new Date(from as string))
      .where('startTime', '<=', new Date(to as string))
      .orderBy('startTime', 'desc')
      .limit(5000)

    const snap = await q.get()

    const userCache: Record<string, string> = {}
    for (const doc of snap.docs) {
      const uid = doc.data().userId
      if (uid && !userCache[uid]) {
        const userSnap = await adminDb.doc(`users/${uid}`).get()
        userCache[uid] = userSnap.data()?.displayName || uid
      }
    }

    rows = snap.docs.map(d => {
      const data = d.data()
      return {
        Date: data.startTime?.toDate?.()?.toISOString()?.split('T')[0] || '',
        Chaplain: userCache[data.userId] || data.userId,
        'Start Time': data.startTime?.toDate?.()?.toISOString() || '',
        'End Time': data.endTime?.toDate?.()?.toISOString() || '',
        'Total Hours': data.totalHours || 0,
        Terminal: data.terminal || '',
        Approved: data.approved ? 'Yes' : 'No',
        Paid: data.isPaid ? 'Yes' : 'No',
        'Payment Amount': data.paymentAmount || '',
        'Check Number': data.checkNumber || ''
      }
    })
  } else if (type === 'stipends') {
    let q = adminDb.collection('chaplain_payouts')
      .where('createdAt', '>=', new Date(from as string))
      .where('createdAt', '<=', new Date(to as string))
      .orderBy('createdAt', 'desc')
      .limit(5000)

    const snap = await q.get()

    const userCache: Record<string, string> = {}
    for (const doc of snap.docs) {
      const cid = doc.data().chaplainId
      if (cid && !userCache[cid]) {
        const userSnap = await adminDb.doc(`users/${cid}`).get()
        userCache[cid] = userSnap.data()?.displayName || cid
      }
      const aid = doc.data().createdBy
      if (aid && !userCache[aid]) {
        const userSnap = await adminDb.doc(`users/${aid}`).get()
        userCache[aid] = userSnap.data()?.displayName || aid
      }
    }

    rows = snap.docs.map(d => {
      const data = d.data()
      return {
        'Date Processed': data.createdAt?.toDate?.()?.toISOString()?.split('T')[0] || '',
        Chaplain: userCache[data.chaplainId] || data.chaplainId,
        'Shift Count': data.dutyLogCount || 0,
        'Total Amount': data.payoutAmount || 0,
        'Check Number': data.checkNumber || '',
        'Processed By': userCache[data.createdBy] || data.createdBy,
        Month: data.monthPaid || '',
        Year: data.yearPaid || ''
      }
    })
  }

  // Generate CSV with papaparse
  const csv = Papa.unparse(rows)

  // Add UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF'

  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="compass-${type}-${from}-${to}.csv"`
  })

  return bom + csv
})
```

### 7. Add Navigation and Test

Update sidebar to include "Reports" link to `/reports`.

```bash
pnpm dev
```

**Test reports page:**
1. Navigate to `/reports`
2. Verify encounter summary cards display (total, crisis, prayer, grief counts)
3. Click "Last 7 Days" and "Last 90 Days" presets -- data should reload
4. Verify duty hours section shows total hours, shifts, avg shift, active chaplains
5. Verify stipend section shows total paid, shifts paid, monthly breakdown
6. Click "Export CSV" on encounters section -- CSV file downloads
7. Open CSV in Excel or text editor -- verify column headers and data rows

### 8. Commit

```bash
git add .
git commit -m "feat: add reports page with encounter/duty/stipend metrics and CSV export"
```

## Acceptance Criteria

- [ ] Reports page displays three sections: Encounters, Duty Hours, Stipends
- [ ] Date range filter presets (7d, 30d, 90d, year) recalculate all metrics
- [ ] Custom date range with from/to pickers works
- [ ] Terminal filter restricts all data to the selected terminal
- [ ] Encounter metrics aggregate by type (crisis, grief, prayer, etc.) with CSS bar chart
- [ ] Duty hours metrics show total hours, total shifts, avg shift length, per-chaplain breakdown
- [ ] Stipend metrics show total paid, monthly breakdown, and per-chaplain breakdown
- [ ] "Export CSV" button on each section triggers server-side CSV generation via papaparse
- [ ] CSV file downloads with correct filename pattern: `compass-{type}-{from}-{to}.csv`
- [ ] CSV opens correctly in Excel with proper column headers and formatted data
- [ ] Empty state displays when no data matches filters
- [ ] Reset button clears all filters to defaults (30-day, all terminals, all chaplains)

## Estimated Time

**2 days** -- 1 day for reports page and composable, 1 day for server routes and CSV export

## Notes

- Reports use one-time queries (not real-time listeners) to avoid unnecessary re-renders.
- The server routes use `limit(1000)` for display queries and `limit(5000)` for CSV exports. If datasets grow beyond this, implement pagination or streaming.
- CSV export adds a UTF-8 BOM character for Excel compatibility.
- Encounter types are not mutually exclusive -- one encounter can have multiple types (e.g., crisis + grief). Counts may sum to more than the total.
- The chaplain name cache in export routes prevents N+1 queries for repeated chaplain IDs.
