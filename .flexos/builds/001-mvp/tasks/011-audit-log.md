---
id: build-001-task-011
title: "Audit Log System"
description: "Implement server-side audit utility function and audit log page with paginated admin action history"
type: build
subtype: task
status: pending
sequence: 11
tags: [build, task, audit, compliance]
relatesTo: ["builds/001-mvp/build-spec/011-audit-log.md", "specs/010-features_audit-log.md", "specs/024-database_audit-settings-collections.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 011: Audit Log System

## Objective

Create a reusable server-side audit utility function that writes immutable audit log entries to Firestore, integrate it into all existing server routes that perform write operations (profile edits, stipend processing, coverage edits, settings updates), and build an `/audit` page for admins to review the action history.

## Prerequisites

- Task 007 (User Management) complete -- for profile edit auditing
- Task 009 (Stipend Processing) complete -- payout_create audit entries already exist from T-009
- `server/utils/firebaseAdmin.ts` exists (from T-002)
- `audit_log` collection security rules deployed: `allow read: if isAdmin(); allow write: if false;`

## Steps

### 1. Create Server Audit Utility

Create `server/utils/audit.ts`:

```typescript
import { adminDb } from './firebaseAdmin'
import { FieldValue, WriteBatch } from 'firebase-admin/firestore'

export type AuditAction =
  | 'profile_edit'
  | 'stipend_approve'
  | 'payout_create'
  | 'coverage_edit'
  | 'role_change'
  | 'settings_update'
  | 'photo_upload'
  | 'admin_add'
  | 'admin_remove'

interface AuditEntryOptions {
  action: AuditAction
  adminId: string
  targetId?: string
  targetCollection?: string
  details?: {
    before?: Record<string, any>
    after?: Record<string, any>
    summary?: string
    [key: string]: any
  }
}

/**
 * Create an audit log entry using Firebase Admin SDK.
 *
 * If a batch is provided, the entry is added to the batch (committed by caller).
 * If no batch is provided, the entry is written immediately.
 */
export async function createAuditEntry(
  options: AuditEntryOptions,
  batch?: WriteBatch
): Promise<string> {
  const auditRef = adminDb.collection('audit_log').doc()

  const entry = {
    action: options.action,
    adminId: options.adminId,
    targetId: options.targetId || null,
    targetCollection: options.targetCollection || null,
    details: options.details || null,
    createdAt: FieldValue.serverTimestamp()
  }

  if (batch) {
    batch.set(auditRef, entry)
  } else {
    await auditRef.set(entry)
  }

  return auditRef.id
}

/**
 * Helper to compute a diff between two objects (before/after).
 * Only includes fields that changed.
 */
export function computeDiff(
  before: Record<string, any>,
  after: Record<string, any>
): { before: Record<string, any>; after: Record<string, any> } {
  const diffBefore: Record<string, any> = {}
  const diffAfter: Record<string, any> = {}

  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diffBefore[key] = before[key]
      diffAfter[key] = after[key]
    }
  }

  return { before: diffBefore, after: diffAfter }
}
```

### 2. Integrate Audit Into User Profile Edit Route

Update `server/api/users/[id]/update.post.ts` (created in T-007) to include audit logging:

```typescript
import { adminDb } from '../../../utils/firebaseAdmin'
import { verifyAdmin } from '../../../utils/auth'
import { createAuditEntry, computeDiff } from '../../../utils/audit'
import { FieldValue } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  const admin = await verifyAdmin(event)
  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const userRef = adminDb.doc(`users/${userId}`)
  const userSnap = await userRef.get()

  if (!userSnap.exists) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const beforeData = userSnap.data()!

  // Fields that can be updated
  const allowedFields = [
    'displayName', 'email', 'phoneNumber', 'bio', 'title',
    'role', 'isChaplain', 'isIntern', 'isSupportMember',
    'isAfterHours', 'terminals'
  ]

  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  // Add admin edit metadata
  updates.adminEditedAt = FieldValue.serverTimestamp()
  updates.adminEditedBy = admin.uid

  // Use batch to write update + audit entry atomically
  const batch = adminDb.batch()
  batch.update(userRef, updates)

  // Detect role change specifically
  const action = (updates.role && updates.role !== beforeData.role) ? 'role_change' : 'profile_edit'
  const diff = computeDiff(beforeData, updates)

  await createAuditEntry({
    action,
    adminId: admin.uid,
    targetId: userId,
    targetCollection: 'users',
    details: {
      before: diff.before,
      after: diff.after,
      summary: `Updated ${Object.keys(diff.after).join(', ')} for ${beforeData.displayName}`
    }
  }, batch)

  await batch.commit()

  return { success: true }
})
```

### 3. Add Audit to Coverage Slot Edits

Create `server/api/coverage/[weekYear].patch.ts` for audited coverage edits:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'
import { createAuditEntry } from '../../utils/audit'
import { FieldValue } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  const admin = await verifyAdmin(event)
  const weekYear = getRouterParam(event, 'weekYear')
  const { day, hour, covered } = await readBody(event)

  if (!weekYear || !day || hour === undefined) {
    throw createError({ statusCode: 400, message: 'weekYear, day, and hour are required' })
  }

  const docRef = adminDb.doc(`coverage_schedules/${weekYear}`)
  const docSnap = await docRef.get()
  const previousValue = docSnap.data()?.slots?.[day]?.[hour] ?? false

  const fieldPath = `slots.${day}.${hour}`

  const batch = adminDb.batch()
  batch.update(docRef, {
    [fieldPath]: covered,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: admin.uid
  })

  await createAuditEntry({
    action: 'coverage_edit',
    adminId: admin.uid,
    targetId: weekYear,
    targetCollection: 'coverage_schedules',
    details: {
      day,
      hour,
      before: previousValue,
      after: covered,
      summary: `${covered ? 'Marked' : 'Unmarked'} ${day} ${hour}:00 as ${covered ? 'covered' : 'uncovered'}`
    }
  }, batch)

  await batch.commit()

  return { success: true }
})
```

### 4. Add Audit to Settings Updates

This will be integrated in T-012 when the settings server route is created. For now, the `createAuditEntry` utility is ready to be called with `action: 'settings_update'`.

### 5. Verify Stipend Processing Audit

The `server/api/stipends/process.post.ts` from T-009 already creates `payout_create` audit entries. Verify the audit entry is correctly written by checking Firestore after processing a test payout.

### 6. Create Audit Log Page

Create `app/pages/audit.vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold text-neutral-dark">Audit Log</h1>

    <!-- Filter controls -->
    <div class="flex flex-wrap gap-3">
      <select
        v-model="actionFilter"
        class="px-3 py-2 border border-neutral-light rounded-lg text-sm"
      >
        <option value="all">All Actions</option>
        <option value="profile_edit">Profile Edits</option>
        <option value="payout_create">Payout Created</option>
        <option value="coverage_edit">Coverage Edits</option>
        <option value="settings_update">Settings Updates</option>
        <option value="role_change">Role Changes</option>
        <option value="photo_upload">Photo Uploads</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-neutral-mid">Loading audit log...</div>

    <!-- Empty state -->
    <div v-else-if="entries.length === 0" class="text-center py-12 text-neutral-mid">
      No audit entries found.
    </div>

    <!-- Audit entries table -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-neutral-bg text-left">
          <tr>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Timestamp</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Admin</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Action</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Target</th>
            <th class="px-4 py-3 text-sm font-medium text-neutral-mid">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-light">
          <tr
            v-for="entry in entries"
            :key="entry.id"
            class="hover:bg-neutral-bg/50"
          >
            <td class="px-4 py-3 text-sm text-neutral-mid whitespace-nowrap">
              {{ formatTimestamp(entry.createdAt) }}
            </td>
            <td class="px-4 py-3 text-sm text-neutral-dark">
              {{ entry.adminId }}
            </td>
            <td class="px-4 py-3">
              <span
                :class="actionBadgeClass(entry.action)"
                class="text-xs px-2 py-1 rounded-full font-medium"
              >
                {{ formatAction(entry.action) }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-neutral-mid">
              <span v-if="entry.targetCollection">
                {{ entry.targetCollection }}/{{ entry.targetId }}
              </span>
              <span v-else>—</span>
            </td>
            <td class="px-4 py-3 text-sm text-neutral-mid max-w-xs truncate">
              {{ entry.details?.summary || '—' }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-neutral-light flex justify-between items-center">
        <p class="text-sm text-neutral-mid">
          Showing {{ entries.length }} entries
        </p>
        <button
          v-if="hasMore"
          class="px-4 py-2 text-sm border border-neutral-light rounded-lg hover:bg-neutral-bg"
          @click="loadMore"
        >
          Load More
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { collection, query, where, orderBy, limit, getDocs, startAfter, Timestamp } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { format } from 'date-fns'

const db = useFirestore()
const entries = ref<any[]>([])
const loading = ref(true)
const hasMore = ref(false)
const lastDoc = ref<any>(null)
const actionFilter = ref('all')
const PAGE_SIZE = 50

async function fetchEntries(append = false) {
  loading.value = true
  try {
    const constraints: any[] = []

    if (actionFilter.value !== 'all') {
      constraints.push(where('action', '==', actionFilter.value))
    }

    constraints.push(orderBy('createdAt', 'desc'))

    if (append && lastDoc.value) {
      constraints.push(startAfter(lastDoc.value))
    }

    constraints.push(limit(PAGE_SIZE + 1))

    const q = query(collection(db, 'audit_log'), ...constraints)
    const snap = await getDocs(q)

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    if (docs.length > PAGE_SIZE) {
      hasMore.value = true
      docs.pop()
    } else {
      hasMore.value = false
    }

    lastDoc.value = snap.docs[snap.docs.length - 1] || null

    if (append) {
      entries.value.push(...docs)
    } else {
      entries.value = docs
    }
  } finally {
    loading.value = false
  }
}

function loadMore() {
  fetchEntries(true)
}

watch(actionFilter, () => {
  lastDoc.value = null
  fetchEntries()
})

onMounted(() => fetchEntries())

function formatTimestamp(ts: any): string {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return format(date, 'MMM d, yyyy h:mm a')
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function actionBadgeClass(action: string): string {
  const map: Record<string, string> = {
    profile_edit: 'bg-primary/10 text-primary',
    payout_create: 'bg-success/10 text-success',
    coverage_edit: 'bg-accent/10 text-accent',
    settings_update: 'bg-warning/10 text-warning',
    role_change: 'bg-error/10 text-error',
    photo_upload: 'bg-primary/10 text-primary',
    admin_add: 'bg-success/10 text-success',
    admin_remove: 'bg-error/10 text-error'
  }
  return map[action] || 'bg-neutral-bg text-neutral-mid'
}
</script>
```

### 7. Add Navigation and Test

Update sidebar to include "Audit Log" link to `/audit`.

```bash
pnpm dev
```

**Test audit logging:**
1. Edit a user profile (from `/users/{id}`) -- check Firestore `audit_log` for `profile_edit` entry
2. Process a test stipend payout -- check for `payout_create` entry
3. Toggle a coverage slot via the PATCH route -- check for `coverage_edit` entry
4. Navigate to `/audit` -- verify entries display with timestamps, admin IDs, actions, and summaries
5. Use the action filter dropdown -- verify filtering works
6. Click "Load More" if >50 entries exist -- verify pagination

### 8. Commit

```bash
git add .
git commit -m "feat: add audit log utility, integrate with all write operations, and build audit viewer page"
```

## Acceptance Criteria

- [ ] `server/utils/audit.ts` exports `createAuditEntry()` and `computeDiff()` functions
- [ ] `createAuditEntry()` works both standalone (immediate write) and with batch (deferred commit)
- [ ] Profile edit (`server/api/users/[id]/update.post.ts`) creates `profile_edit` or `role_change` audit entry with before/after diff
- [ ] Coverage slot edit creates `coverage_edit` audit entry with day, hour, before/after values
- [ ] Stipend processing (from T-009) creates `payout_create` audit entry with amount, chaplain count, check number
- [ ] All audit writes are atomic with the primary operation (batch commits together)
- [ ] `/audit` page displays audit entries in reverse chronological order (newest first)
- [ ] Action filter dropdown restricts displayed entries to the selected action type
- [ ] Pagination loads 50 entries per page with "Load More" button
- [ ] Audit entries show: timestamp, admin ID, action badge, target collection/ID, summary text
- [ ] `audit_log` Firestore security rules: `allow read: if isAdmin(); allow write: if false;`

## Estimated Time

**1 day** -- Utility creation, integration into existing routes, and audit page

## Files Created/Modified

### Created
- `server/utils/audit.ts`
- `server/api/coverage/[weekYear].patch.ts`
- `app/pages/audit.vue`

### Modified
- `server/api/users/[id]/update.post.ts` (add audit logging)
- Sidebar navigation (add Audit Log link)

## Dependencies

**Depends on:** T-007 (User Management), T-009 (Stipend Processing)

## Next Task

**T-012: Chat monitoring, settings page, production hardening**

## Notes

- Audit log entries are written ONLY from server-side routes using Firebase Admin SDK. The client Firestore security rule `allow write: if false` prevents any client-side tampering.
- The `computeDiff()` helper compares before/after objects and only includes fields that actually changed, keeping audit entries concise.
- The `createAuditEntry()` function accepts an optional `WriteBatch` parameter. When provided, the audit entry is added to the batch and committed atomically with the primary operation. If the batch fails, neither the primary write nor the audit entry is persisted.
- The `/audit` page uses cursor-based pagination with `startAfter()` for efficient Firestore queries.
- Action filter uses a Firestore `where('action', '==', ...)` clause, which requires the composite index `audit_log: action ASC, createdAt DESC`.
