---
id: build-001-task-009
title: "Stipend Processing Workflow"
description: "Build the multi-step monthly stipend processing system with period selection, qualifying chaplains, adjustments, batch payouts, and server-side recalculation"
type: build
subtype: task
status: pending
sequence: 9
tags: [build, task, stipend, financial]
relatesTo: ["builds/001-mvp/build-spec/009-stipend-processing.md", "specs/006-features_stipend-processing.md", "specs/015-pages_stipends.md", "specs/022-database_stipend-collections.md", "specs/029-flow_stipend-processing-flow.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 009: Stipend Processing Workflow

## Objective

Build the most business-critical feature in COMPASS: monthly stipend processing. This includes period selection (month chips), qualifying chaplain display with expandable duty entries, per-entry adjustment sliders, batch selection with checkboxes, check number modal, server-side payout processing with Firestore batch writes, and a payout detail page. All financial calculations happen server-side.

## Prerequisites

- Task 008 (Duty Day Tracking) complete
- `duty_logs` collection has test data with `isPaid: false` entries
- `app_settings/config` document has `baseStipendRate` set (e.g., 80)
- `server/utils/firebaseAdmin.ts` and `server/utils/auth.ts` exist (from T-002)
- Firebase Admin SDK configured for server routes

## Steps

### 1. Create Stipend Composable

Create `app/composables/useStipends.ts`:

```typescript
import { collection, query, where, orderBy, doc } from 'firebase/firestore'
import { useCollection, useDocument, useFirestore } from 'vuefire'
import { startOfMonth, endOfMonth, format } from 'date-fns'

interface StipendEntry {
  dutyLogId: string
  chaplainId: string
  date: Date
  hours: number
  terminal: string
  baseAmount: number
  adjustment: number
  total: number
  selected: boolean
}

interface ChaplainGroup {
  chaplainId: string
  chaplainName: string
  entries: StipendEntry[]
  expanded: boolean
  selected: boolean
}

export function useStipends() {
  const db = useFirestore()

  const selectedMonth = ref(new Date().getMonth()) // 0-indexed
  const selectedYear = ref(new Date().getFullYear())
  const chaplainGroups = ref<ChaplainGroup[]>([])
  const loading = ref(false)
  const processing = ref(false)

  // App settings for base rate
  const settingsRef = doc(db, 'app_settings', 'config')
  const settings = useDocument(settingsRef)
  const baseRate = computed(() => (settings.value as any)?.baseStipendRate ?? 80)

  // Month labels
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const selectedMonthName = computed(() => months[selectedMonth.value])

  // Fetch qualifying data when month changes
  async function fetchQualifying() {
    loading.value = true
    chaplainGroups.value = []

    try {
      const token = await useCurrentUser().value?.getIdToken()
      const response = await $fetch('/api/stipends/qualifying', {
        params: {
          month: selectedMonth.value + 1, // 1-indexed for API
          year: selectedYear.value
        },
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = response as any
      chaplainGroups.value = (data.chaplains || []).map((c: any) => ({
        chaplainId: c.chaplainId,
        chaplainName: c.chaplainName,
        expanded: false,
        selected: true,
        entries: c.shifts.map((s: any) => ({
          dutyLogId: s.id,
          chaplainId: c.chaplainId,
          date: new Date(s.startTime),
          hours: s.totalHours,
          terminal: s.terminal || '—',
          baseAmount: data.baseStipendRate,
          adjustment: 0,
          total: data.baseStipendRate,
          selected: true
        }))
      }))
    } catch (error) {
      console.error('Failed to fetch qualifying data:', error)
    } finally {
      loading.value = false
    }
  }

  // Computed totals
  const selectedEntries = computed(() =>
    chaplainGroups.value.flatMap(g => g.entries.filter(e => e.selected))
  )

  const grandTotal = computed(() =>
    selectedEntries.value.reduce((sum, e) => sum + e.total, 0)
  )

  // Toggle all entries for a chaplain
  function toggleChaplain(group: ChaplainGroup) {
    const newState = !group.selected
    group.selected = newState
    group.entries.forEach(e => { e.selected = newState })
  }

  // Select/deselect all
  function selectAll() {
    chaplainGroups.value.forEach(g => {
      g.selected = true
      g.entries.forEach(e => { e.selected = true })
    })
  }

  function deselectAll() {
    chaplainGroups.value.forEach(g => {
      g.selected = false
      g.entries.forEach(e => { e.selected = false })
    })
  }

  // Update adjustment on an entry
  function setAdjustment(entry: StipendEntry, amount: number) {
    entry.adjustment = Math.max(-baseRate.value, Math.min(baseRate.value, amount))
    entry.total = entry.baseAmount + entry.adjustment
  }

  // Process selected entries
  async function processPayouts(checkNumber: string) {
    if (selectedEntries.value.length === 0) {
      throw new Error('No entries selected')
    }

    processing.value = true

    try {
      const token = await useCurrentUser().value?.getIdToken()
      const response = await $fetch('/api/stipends/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          entries: selectedEntries.value.map(e => ({
            dutyLogId: e.dutyLogId,
            adjustment: e.adjustment
          })),
          checkNumber,
          month: selectedMonthName.value,
          year: selectedYear.value
        }
      })

      // Refresh qualifying data
      await fetchQualifying()

      return response
    } finally {
      processing.value = false
    }
  }

  // Watch for month changes
  watch([selectedMonth, selectedYear], () => {
    fetchQualifying()
  }, { immediate: true })

  return {
    selectedMonth,
    selectedYear,
    selectedMonthName,
    months,
    chaplainGroups,
    selectedEntries,
    grandTotal,
    baseRate,
    loading,
    processing,
    fetchQualifying,
    toggleChaplain,
    selectAll,
    deselectAll,
    setAdjustment,
    processPayouts
  }
}
```

### 2. Create Period Selector Component

Create `app/components/stipends/PeriodSelector.vue`:

```vue
<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="(month, index) in months"
      :key="month"
      :class="selectedMonth === index
        ? 'bg-primary text-white'
        : 'bg-white text-neutral-dark border border-neutral-light hover:bg-neutral-bg'"
      class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      @click="$emit('update:selectedMonth', index)"
    >
      {{ month.slice(0, 3) }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  months: string[]
  selectedMonth: number
}>()

defineEmits<{
  'update:selectedMonth': [month: number]
}>()
</script>
```

### 3. Create Qualifying Chaplains List Component

Create `app/components/stipends/QualifyingChaplainsList.vue`:

```vue
<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div v-if="groups.length === 0" class="p-8 text-center text-neutral-mid">
      No unpaid shifts for {{ monthName }} {{ year }}.
    </div>

    <div v-else>
      <div
        v-for="group in groups"
        :key="group.chaplainId"
        class="border-b border-neutral-light last:border-0"
      >
        <!-- Chaplain Row -->
        <div
          class="flex items-center gap-4 px-4 py-3 hover:bg-neutral-bg/50 cursor-pointer"
          @click="group.expanded = !group.expanded"
        >
          <input
            type="checkbox"
            :checked="group.selected"
            class="w-4 h-4 rounded border-neutral-light text-primary"
            @click.stop="$emit('toggleChaplain', group)"
          />
          <div class="flex-1">
            <p class="text-sm font-medium text-neutral-dark">{{ group.chaplainName }}</p>
            <p class="text-xs text-neutral-mid">{{ group.entries.length }} shifts</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold text-neutral-dark">
              ${{ groupTotal(group).toFixed(2) }}
            </p>
            <p v-if="groupAdjustment(group) !== 0" class="text-xs text-warning">
              Adj: {{ groupAdjustment(group) > 0 ? '+' : '' }}${{ groupAdjustment(group) }}
            </p>
          </div>
          <span class="text-neutral-mid text-xs">{{ group.expanded ? '&#9650;' : '&#9660;' }}</span>
        </div>

        <!-- Expanded Entries -->
        <div v-if="group.expanded" class="bg-neutral-bg/30 border-t border-neutral-light">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-neutral-mid">
                <th class="px-4 py-2 w-8"></th>
                <th class="px-4 py-2">Date</th>
                <th class="px-4 py-2">Hours</th>
                <th class="px-4 py-2">Terminal</th>
                <th class="px-4 py-2">Base</th>
                <th class="px-4 py-2">Adj</th>
                <th class="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in group.entries" :key="entry.dutyLogId" class="border-t border-neutral-light/50">
                <td class="px-4 py-2">
                  <input
                    type="checkbox"
                    v-model="entry.selected"
                    class="w-4 h-4 rounded border-neutral-light text-primary"
                  />
                </td>
                <td class="px-4 py-2 text-neutral-dark">{{ formatDate(entry.date) }}</td>
                <td class="px-4 py-2 text-neutral-mid">{{ entry.hours?.toFixed(1) }}</td>
                <td class="px-4 py-2 text-neutral-mid">{{ entry.terminal }}</td>
                <td class="px-4 py-2 text-neutral-mid">${{ entry.baseAmount }}</td>
                <td class="px-4 py-2">
                  <StipendAdjustmentSlider
                    :value="entry.adjustment"
                    :max="entry.baseAmount"
                    @update="(val) => $emit('adjust', entry, val)"
                  />
                </td>
                <td class="px-4 py-2 font-medium text-neutral-dark">${{ entry.total }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'

defineProps<{
  groups: any[]
  monthName: string
  year: number
}>()

defineEmits<{
  toggleChaplain: [group: any]
  adjust: [entry: any, amount: number]
}>()

function groupTotal(group: any): number {
  return group.entries.reduce((sum: number, e: any) => sum + e.total, 0)
}

function groupAdjustment(group: any): number {
  return group.entries.reduce((sum: number, e: any) => sum + e.adjustment, 0)
}

function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy')
}
</script>
```

### 4. Create Adjustment Slider Component

Create `app/components/stipends/StipendAdjustmentSlider.vue`:

```vue
<template>
  <div class="flex items-center gap-1">
    <button
      class="w-6 h-6 rounded bg-neutral-bg text-neutral-mid text-xs hover:bg-neutral-light"
      @click="$emit('update', value - 10)"
    >
      -
    </button>
    <input
      type="number"
      :value="value"
      class="w-16 text-center text-xs border border-neutral-light rounded px-1 py-1"
      @change="$emit('update', Number(($event.target as HTMLInputElement).value))"
    />
    <button
      class="w-6 h-6 rounded bg-neutral-bg text-neutral-mid text-xs hover:bg-neutral-light"
      @click="$emit('update', value + 10)"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: number
  max: number
}>()

defineEmits<{
  update: [amount: number]
}>()
</script>
```

### 5. Create Server Route: Get Qualifying Entries

Create `server/api/stipends/qualifying.get.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await verifyAdmin(event)

  const query = getQuery(event)
  const month = parseInt(query.month as string) // 1-indexed
  const year = parseInt(query.year as string)

  if (!month || !year) {
    throw createError({ statusCode: 400, message: 'month and year are required' })
  }

  // Calculate date range
  const startDate = new Date(year, month - 1, 1, 0, 0, 0)
  const endDate = new Date(year, month, 0, 23, 59, 59) // last day of month

  // Fetch app settings for base rate
  const settingsSnap = await adminDb.doc('app_settings/config').get()
  const baseStipendRate = settingsSnap.data()?.baseStipendRate ?? 80

  // Query unpaid, approved duty logs in date range
  const logsSnap = await adminDb.collection('duty_logs')
    .where('isPaid', '==', false)
    .where('startTime', '>=', startDate)
    .where('startTime', '<=', endDate)
    .orderBy('startTime', 'asc')
    .get()

  // Group by userId (chaplainId)
  const grouped: Record<string, any[]> = {}
  for (const doc of logsSnap.docs) {
    const data = doc.data()
    const userId = data.userId
    if (!grouped[userId]) grouped[userId] = []
    grouped[userId].push({
      id: doc.id,
      startTime: data.startTime?.toDate?.()?.toISOString() || null,
      totalHours: data.totalHours || 0,
      terminal: data.terminal || null
    })
  }

  // Fetch chaplain names
  const chaplains = await Promise.all(
    Object.keys(grouped).map(async (uid) => {
      const userSnap = await adminDb.doc(`users/${uid}`).get()
      const userName = userSnap.data()?.displayName || 'Unknown'
      return {
        chaplainId: uid,
        chaplainName: userName,
        shifts: grouped[uid],
        baseAmount: grouped[uid].length * baseStipendRate
      }
    })
  )

  return {
    baseStipendRate,
    month: month,
    year: year,
    chaplains: chaplains.sort((a, b) => a.chaplainName.localeCompare(b.chaplainName))
  }
})
```

### 6. Create Server Route: Process Payouts

Create `server/api/stipends/process.post.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'
import { FieldValue } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  const admin = await verifyAdmin(event)
  const body = await readBody(event)

  const { entries, checkNumber, month, year } = body

  if (!entries?.length) {
    throw createError({ statusCode: 400, message: 'No entries provided' })
  }
  if (!checkNumber) {
    throw createError({ statusCode: 400, message: 'Check number is required' })
  }

  // Fetch base stipend rate
  const settingsSnap = await adminDb.doc('app_settings/config').get()
  const baseRate = settingsSnap.data()?.baseStipendRate ?? 80

  // Fetch all duty logs and verify they are unpaid
  const dutyLogs: Record<string, any> = {}
  for (const entry of entries) {
    const logSnap = await adminDb.doc(`duty_logs/${entry.dutyLogId}`).get()
    if (!logSnap.exists) {
      throw createError({ statusCode: 400, message: `Duty log ${entry.dutyLogId} not found` })
    }
    const data = logSnap.data()!
    if (data.isPaid) {
      throw createError({ statusCode: 400, message: `Duty log ${entry.dutyLogId} is already paid` })
    }
    dutyLogs[entry.dutyLogId] = { ...data, id: logSnap.id }
  }

  // Group entries by chaplainId
  const grouped: Record<string, { entries: any[], adjustment: number }> = {}
  for (const entry of entries) {
    const log = dutyLogs[entry.dutyLogId]
    const chaplainId = log.userId
    if (!grouped[chaplainId]) {
      grouped[chaplainId] = { entries: [], adjustment: 0 }
    }
    const adj = Math.max(-baseRate, Math.min(baseRate, entry.adjustment || 0))
    grouped[chaplainId].entries.push({ ...entry, adjustment: adj })
    grouped[chaplainId].adjustment += adj
  }

  // Build batch write
  const batch = adminDb.batch()
  const payoutIds: string[] = []
  let totalAmount = 0

  for (const [chaplainId, group] of Object.entries(grouped)) {
    // Fetch chaplain name
    const chaplainSnap = await adminDb.doc(`users/${chaplainId}`).get()
    const chaplainName = chaplainSnap.data()?.displayName || 'Unknown'

    // Calculate total for this chaplain
    const chaplainTotal = group.entries.reduce(
      (sum: number, e: any) => sum + baseRate + (e.adjustment || 0), 0
    )
    const totalAdj = group.entries.reduce(
      (sum: number, e: any) => sum + (e.adjustment || 0), 0
    )
    totalAmount += chaplainTotal

    // 1. Create chaplain_payouts document
    const payoutRef = adminDb.collection('chaplain_payouts').doc()
    payoutIds.push(payoutRef.id)
    batch.set(payoutRef, {
      chaplainId,
      payoutAmount: chaplainTotal,
      dutyLogIds: group.entries.map((e: any) => e.dutyLogId),
      dutyLogCount: group.entries.length,
      checkNumber,
      isPaid: true,
      monthPaid: month,
      yearPaid: year,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: admin.uid
    })

    // 2. Update each duty log
    for (const entry of group.entries) {
      const logRef = adminDb.doc(`duty_logs/${entry.dutyLogId}`)
      batch.update(logRef, {
        isPaid: true,
        paymentAmount: baseRate + (entry.adjustment || 0),
        paymentStatus: 'paid',
        adjustmentAmount: entry.adjustment || 0,
        hasAdjustment: (entry.adjustment || 0) !== 0,
        checkNumber,
        payoutId: payoutRef.id,
        processedBy: admin.uid,
        processedAt: FieldValue.serverTimestamp()
      })
    }

    // 3. Create/update stipend_records
    const monthNumber = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(month) + 1
    const recordId = `${chaplainId}-${year}-${monthNumber}`
    const recordRef = adminDb.doc(`stipend_records/${recordId}`)
    batch.set(recordRef, {
      chaplainId,
      chaplainName,
      monthName: month,
      year,
      startDate: new Date(year, monthNumber - 1, 1),
      endDate: new Date(year, monthNumber, 0, 23, 59, 59),
      instancesAuthorized: group.entries.length,
      instancesPaid: group.entries.length,
      stipendAmount: chaplainTotal,
      adjustmentAmount: totalAdj,
      hasAdjustment: totalAdj !== 0,
      isCompleted: true,
      completedAt: FieldValue.serverTimestamp(),
      processedBy: admin.uid
    }, { merge: true })
  }

  // 4. Create audit log entry
  const auditRef = adminDb.collection('audit_log').doc()
  batch.set(auditRef, {
    action: 'payout_create',
    adminId: admin.uid,
    targetCollection: 'chaplain_payouts',
    details: {
      month,
      year,
      checkNumber,
      chaplainCount: Object.keys(grouped).length,
      totalAmount,
      entryCount: entries.length,
      summary: `Processed ${entries.length} duty logs totaling $${totalAmount.toFixed(2)}`
    },
    createdAt: FieldValue.serverTimestamp()
  })

  // 5. Commit batch
  await batch.commit()

  return {
    success: true,
    payoutIds,
    summary: {
      chaplains: Object.keys(grouped).length,
      shifts: entries.length,
      totalAmount
    }
  }
})
```

### 7. Create Stipends Page

Create `app/pages/stipends/index.vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold text-neutral-dark">Stipend Processing</h1>

    <!-- Period Selector -->
    <PeriodSelector
      :months="months"
      :selected-month="selectedMonth"
      @update:selected-month="selectedMonth = $event"
    />

    <p class="text-sm text-neutral-mid">
      Period: <strong>{{ selectedMonthName }} {{ selectedYear }}</strong>
      &middot; Base Rate: <strong>${{ baseRate }}/shift</strong>
    </p>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-neutral-mid">Loading qualifying data...</div>

    <!-- Qualifying Chaplains -->
    <QualifyingChaplainsList
      v-else
      :groups="chaplainGroups"
      :month-name="selectedMonthName"
      :year="selectedYear"
      @toggle-chaplain="toggleChaplain"
      @adjust="(entry, val) => setAdjustment(entry, val)"
    />

    <!-- Sticky Footer -->
    <div
      v-if="chaplainGroups.length > 0"
      class="sticky bottom-0 bg-white border-t border-neutral-light px-6 py-4 flex items-center justify-between shadow-lg"
    >
      <div class="text-sm text-neutral-mid">
        <strong>{{ selectedEntries.length }}</strong> entries selected
        &middot;
        <strong class="text-neutral-dark">${{ grandTotal.toFixed(2) }}</strong> total
      </div>
      <div class="flex gap-2">
        <button
          class="px-4 py-2 text-sm border border-neutral-light rounded-lg hover:bg-neutral-bg"
          @click="selectAll"
        >
          Select All
        </button>
        <button
          class="px-4 py-2 text-sm border border-neutral-light rounded-lg hover:bg-neutral-bg"
          @click="deselectAll"
        >
          Deselect All
        </button>
        <button
          :disabled="selectedEntries.length === 0 || processing"
          class="px-6 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          @click="showCheckModal = true"
        >
          {{ processing ? 'Processing...' : 'Process Selected' }}
        </button>
      </div>
    </div>

    <!-- Check Number Modal -->
    <div v-if="showCheckModal" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 class="text-xl font-semibold mb-2">Enter Check Number</h2>
        <p class="text-sm text-neutral-mid mb-4">
          Processing {{ selectedEntries.length }} entries for ${{ grandTotal.toFixed(2) }}
        </p>
        <input
          v-model="checkNumber"
          type="text"
          placeholder="e.g. CHK-2026-0147"
          class="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
        />
        <div class="flex gap-2">
          <button
            :disabled="!checkNumber.trim() || processing"
            class="flex-1 bg-primary text-white py-2 rounded-lg font-medium disabled:opacity-50"
            @click="handleProcess"
          >
            Confirm & Process
          </button>
          <button
            class="flex-1 bg-neutral-light text-neutral-dark py-2 rounded-lg"
            @click="showCheckModal = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  selectedMonth, selectedYear, selectedMonthName, months,
  chaplainGroups, selectedEntries, grandTotal, baseRate,
  loading, processing,
  toggleChaplain, selectAll, deselectAll, setAdjustment,
  processPayouts
} = useStipends()

const showCheckModal = ref(false)
const checkNumber = ref('')

async function handleProcess() {
  try {
    const result = await processPayouts(checkNumber.value)
    showCheckModal.value = false
    checkNumber.value = ''
    alert(`Processed $${(result as any).summary.totalAmount.toFixed(2)} across ${(result as any).summary.chaplains} chaplains`)
  } catch (error: any) {
    alert(error.message || 'Processing failed. No changes were made.')
  }
}
</script>
```

### 8. Create Payout Detail Page

Create `app/pages/stipends/[id].vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <div v-if="!payout" class="text-center py-12">
      <p class="text-neutral-mid">Payout not found.</p>
      <NuxtLink to="/stipends" class="text-primary hover:text-primary-dark text-sm">
        Back to Stipends
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Payout Header -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-2xl font-semibold text-neutral-dark">Payout Detail</h1>
            <p class="text-sm text-neutral-mid mt-1">
              {{ payout.monthPaid }} {{ payout.yearPaid }}
            </p>
          </div>
          <span class="bg-success/10 text-success px-3 py-1 rounded-full text-sm font-medium">
            Paid
          </span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p class="text-xs text-neutral-mid">Chaplain</p>
            <NuxtLink
              :to="`/users/${payout.chaplainId}`"
              class="text-sm font-medium text-primary hover:text-primary-dark"
            >
              {{ payout.chaplainId }}
            </NuxtLink>
          </div>
          <div>
            <p class="text-xs text-neutral-mid">Amount</p>
            <p class="text-sm font-semibold text-neutral-dark">
              ${{ payout.payoutAmount?.toFixed(2) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-neutral-mid">Check Number</p>
            <p class="text-sm text-neutral-dark">{{ payout.checkNumber || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-neutral-mid">Shifts</p>
            <p class="text-sm text-neutral-dark">{{ payout.dutyLogCount }} duty logs</p>
          </div>
        </div>
      </div>

      <!-- Audit Info -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-neutral-dark mb-3">Audit Info</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-xs text-neutral-mid">Processed By</p>
            <p class="text-neutral-dark">{{ payout.createdBy }}</p>
          </div>
          <div>
            <p class="text-xs text-neutral-mid">Processed At</p>
            <p class="text-neutral-dark">
              {{ payout.createdAt?.toDate?.()
                ? format(payout.createdAt.toDate(), 'MMM d, yyyy h:mm a')
                : '—' }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { doc } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'
import { format } from 'date-fns'

const route = useRoute()
const db = useFirestore()

const payoutRef = doc(db, 'chaplain_payouts', route.params.id as string)
const payout = useDocument(payoutRef)
</script>
```

### 9. Add Navigation and Test

Update sidebar to include "Stipends" link to `/stipends`.

```bash
pnpm dev
```

**Test full cycle:**
1. Navigate to `/stipends`
2. Select a month that has unpaid duty logs
3. Verify qualifying chaplains appear with shift counts and totals
4. Expand a chaplain -- see individual duty entries
5. Apply an adjustment (+$20 on one entry) -- verify totals recalculate
6. Select all entries, click "Process Selected"
7. Enter check number "CHK-TEST-001", click "Confirm & Process"
8. Verify success message and entries disappear from qualifying list
9. Check Firestore: `chaplain_payouts` has new document, `duty_logs` have `isPaid: true`, `audit_log` has `payout_create` entry
10. Navigate to `/stipends/{payoutId}` -- verify detail page renders

### 10. Commit

```bash
git add .
git commit -m "feat: add stipend processing workflow with server-side calculations and batch payouts"
```

## Acceptance Criteria

- [ ] Period selector shows 12 month chips; clicking one queries qualifying data
- [ ] Qualifying chaplains table shows chaplain name, shift count, base amount, and total
- [ ] Clicking a chaplain row expands to show individual duty entries
- [ ] Adjustment slider updates entry total and chaplain total in real-time (client-side)
- [ ] Batch selection checkboxes work (individual, per-chaplain, select all, deselect all)
- [ ] "Process Selected" button is disabled when no entries are selected
- [ ] Check number modal requires input before confirming
- [ ] Server route `POST /api/stipends/process` recalculates amounts server-side (ignores client totals)
- [ ] Server creates `chaplain_payouts` documents (immutable), updates `duty_logs` (`isPaid: true`), creates `stipend_records`, and creates `audit_log` entry -- all in a single batch
- [ ] If any duty log is already paid, server returns error and no changes are made
- [ ] After processing, qualifying list refreshes and paid entries no longer appear
- [ ] Payout detail page at `/stipends/[id]` renders chaplain info, amount, check number, and audit trail
- [ ] Success toast shows total amount and chaplain count after processing

## Estimated Time

**5 days** -- Most complex feature in the system

## Notes

- The server MUST recalculate all amounts from `app_settings.baseStipendRate`. Never trust client-submitted totals.
- Firestore batch writes are atomic: all succeed or all fail. This protects against partial payout creation.
- Adjustments are clamped to the range `-baseRate` to `+baseRate` on both client and server.
- The `chaplain_payouts` collection uses `allow update, delete: if false` in security rules -- records are immutable.
- Stipend records use composite document ID: `{chaplainId}-{year}-{monthNumber}` with `{ merge: true }` for incremental processing.
