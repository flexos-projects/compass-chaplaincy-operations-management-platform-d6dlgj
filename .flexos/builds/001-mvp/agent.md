---
id: build-001-agent
title: "Build Agent Instructions"
description: "AI agent context and execution rules for the COMPASS MVP build"
type: build
subtype: agent
status: draft
sequence: 2
tags: [build, agent, ai]
relatesTo: ["builds/001-mvp/config.md", "builds/001-mvp/queue.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Build Agent Instructions

## Context Loading Order

When starting work on a task, always read in this order:

1. **This file** -- agent instructions and standards
2. **builds/001-mvp/config.md** -- stack, scope, success criteria
3. **builds/001-mvp/plan.md** -- phased execution plan with dependencies
4. **builds/001-mvp/queue.md** -- current task queue and status
5. **Current task file** -- builds/001-mvp/tasks/NNN-{task-slug}.md
6. **Related specs** -- any spec files referenced by the task's `relatesTo` frontmatter
7. **Related docs** -- docs/core/ files as needed for domain understanding

## Code Standards

### TypeScript Strictness
- Strict mode enabled in tsconfig.json
- No `any` types except for third-party library integrations with missing types
- All Firestore documents have explicit interfaces in `~/types/firestore.ts`
- All API routes return typed responses (success + data shape, or error + message)
- All composables export typed return values

### Vue 3 Composition API
```vue
<!-- Standard component structure -->
<template>
  <div>
    <!-- Template content -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { User } from '~/types/firestore'

// Props interface first
interface Props {
  userId: string
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

// Composables
const { user, loading, error } = useUserDetail(props.userId)

// Local state
const isEditing = ref(false)

// Computed values
const displayName = computed(() => user.value?.displayName || 'Loading...')

// Functions
function startEdit() {
  if (!props.editable) return
  isEditing.value = true
}
</script>
```

### Nuxt 4 Conventions
- **Auto-imports:** Do NOT manually import Vue, Nuxt, or VueFire functions. They are auto-imported.
- **Composables:** All composables in `app/composables/` are auto-imported. Name them with `use` prefix.
- **Components:** All components in `app/components/` are auto-imported. Use PascalCase file names.
- **Pages:** File-based routing. Dynamic routes use `[param].vue`. No manual route config.
- **Middleware:** Global middleware in `middleware/*.global.ts`, route-specific in `middleware/*.ts` (used via `definePageMeta`).
- **API routes:** Server routes in `server/api/` follow file-based routing. Use `.get.ts`, `.post.ts`, `.patch.ts` suffixes.

## Firestore Patterns

### VueFire Reactive Bindings (Read-Heavy Operations)
```typescript
// In a composable: useUserDetail.ts
export function useUserDetail(userId: string) {
  const userRef = doc(db, 'users', userId)
  const user = useDocument(userRef)

  // user.value is reactive and auto-updates
  // listener attaches on mount, detaches on unmount
  // no manual cleanup needed

  return {
    user,
    loading: computed(() => user.pending),
    error: computed(() => user.error)
  }
}
```

### Direct Firestore Writes (Client-Side)
Use for non-sensitive operations protected by security rules:
```typescript
// Coverage grid toggle
async function toggleCoverageSlot(day: string, hour: number) {
  const docRef = doc(db, 'coverage_schedules', `${weekNumber}-${year}`)
  await updateDoc(docRef, {
    [`slots.${day}.${hour}`]: !currentValue
  })
}
```

### Server-Side Writes (Sensitive Operations)
Use for all financial data and operations requiring audit trail:
```typescript
// In server/api/stipends/process.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = event.headers.get('authorization')?.replace('Bearer ', '')

  // 1. Verify auth
  const decodedToken = await adminAuth.verifyIdToken(token)

  // 2. Verify admin role
  const settingsDoc = await adminDb.doc('app_settings/config').get()
  const adminUserIds = settingsDoc.data()?.adminUserIds || []
  if (!adminUserIds.includes(decodedToken.uid)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  // 3. Recalculate amounts server-side (ignore client totals)
  const stipendRate = settingsDoc.data()?.stipendRate || 80
  const calculatedAmounts = body.entries.map(entry => ({
    ...entry,
    amount: (stipendRate + (entry.adjustment || 0))
  }))

  // 4. Batch write with audit trail
  const batch = adminDb.batch()
  // ... create payout records, update duty logs, create audit entries
  await batch.commit()

  return { success: true, payoutIds: [...] }
})
```

### Firestore Security Rules
Every collection MUST have explicit rules. Default deny:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
    }

    // Users: admins can write, authenticated can read
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Financial data: admin-only
    match /chaplain_payouts/{payoutId} {
      allow read, write: if isAdmin();
    }

    match /stipend_records/{recordId} {
      allow read, write: if isAdmin();
    }

    // Coverage: admins write, authenticated read
    match /coverage_schedules/{scheduleId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Audit log: admin read-only (writes are server-side)
    match /audit_log/{logId} {
      allow read: if isAdmin();
      allow write: if false; // Server-side only
    }
  }
}
```

## Authentication Patterns

### Route Guards
```typescript
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useCurrentUser()
  const publicRoutes = ['/login']

  if (!currentUser.value && !publicRoutes.includes(to.path)) {
    return navigateTo(`/login?redirect=${to.fullPath}`)
  }
})
```

### Admin Check (Client-Side)
```typescript
// composables/useAuth.ts
export function useAuth() {
  const { currentUser } = useCurrentUser()
  const settingsRef = doc(db, 'app_settings', 'config')
  const settings = useDocument(settingsRef)

  const isAdmin = computed(() => {
    if (!currentUser.value || !settings.value) return false
    const adminUserIds = settings.value.adminUserIds || []
    return adminUserIds.includes(currentUser.value.uid)
  })

  return {
    currentUser,
    isAdmin,
    loading: computed(() => settings.pending)
  }
}
```

### Server-Side Token Verification
```typescript
// server/utils/auth.ts
import { adminAuth } from './firebaseAdmin'

export async function verifyAdmin(event) {
  const token = event.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    throw createError({ statusCode: 401, message: 'No token provided' })
  }

  const decodedToken = await adminAuth.verifyIdToken(token)
  const settingsDoc = await adminDb.doc('app_settings/config').get()
  const adminUserIds = settingsDoc.data()?.adminUserIds || []

  if (!adminUserIds.includes(decodedToken.uid)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  return decodedToken
}
```

## Server-Side Calculation Rules

**CRITICAL:** All financial calculations MUST happen server-side. The client can display previews, but the server recalculates from source data on every write.

### Stipend Calculation (Server-Side)
```typescript
// DO THIS (server recalculates)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { dutyLogIds, adjustments, checkNumber } = body

  // Fetch fresh data from Firestore
  const dutyLogs = await Promise.all(
    dutyLogIds.map(id => adminDb.doc(`duty_logs/${id}`).get())
  )

  // Fetch current stipend rate from settings
  const settings = await adminDb.doc('app_settings/config').get()
  const baseRate = settings.data()?.stipendRate || 80

  // Recalculate amounts (ignore client-provided totals)
  const total = dutyLogs.reduce((sum, log, idx) => {
    const adjustment = adjustments[log.id] || 0
    return sum + baseRate + adjustment
  }, 0)

  // Create immutable payout record with server-calculated amount
  // ...
})
```

```typescript
// DO NOT DO THIS (trusts client calculation)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { total, checkNumber } = body // ❌ Never trust client-provided totals

  // ❌ This allows client manipulation of dollar amounts
  await adminDb.collection('chaplain_payouts').add({
    amount: total // ❌ WRONG
  })
})
```

## Testing Expectations

### Unit Tests (Composables & Utils)
All composables with business logic MUST have Vitest tests:
```typescript
// tests/composables/useStipends.test.ts
import { describe, it, expect, vi } from 'vitest'
import { useStipends } from '~/composables/useStipends'

describe('useStipends', () => {
  it('calculates base amount correctly', () => {
    const { calculateBaseAmount } = useStipends()
    expect(calculateBaseAmount(3, 80)).toBe(240)
  })

  it('applies positive adjustment', () => {
    const { applyAdjustment } = useStipends()
    expect(applyAdjustment(80, 20)).toBe(100)
  })
})
```

### Manual Testing Checklist (Per Feature)
Before marking a task complete:
- [ ] Desktop Chrome (1920x1080)
- [ ] Tablet Safari (iPad, 1024x768)
- [ ] Mobile Safari (iPhone, 375x667)
- [ ] Dark mode toggle (if applicable)
- [ ] Network throttling (Fast 3G)
- [ ] Empty states (no data)
- [ ] Error states (Firestore permission denied)
- [ ] Loading states (slow network)

## Commit Conventions

Use conventional commits format:
```
feat: add stipend processing workflow
fix: correct coverage grid slot toggle
refactor: extract user list to composable
docs: update build plan with Phase 2 completion
test: add unit tests for date utilities
```

Commit after each logical unit of work:
- ✅ One component implementation
- ✅ One composable with tests
- ✅ One API route with validation
- ✅ One page with all sections working

Do NOT commit:
- ❌ Half-implemented features with TODOs
- ❌ Broken builds
- ❌ Failing tests
- ❌ Uncommitted console.logs

## Error Handling

### Client-Side Errors
```typescript
// In a composable
export function useUsers() {
  const usersQuery = query(collection(db, 'users'))
  const users = useCollection(usersQuery)

  const error = computed(() => {
    if (users.error.value) {
      // Friendly error messages
      if (users.error.value.code === 'permission-denied') {
        return 'You do not have permission to view users.'
      }
      return 'Failed to load users. Please try again.'
    }
    return null
  })

  return { users, error, loading: users.pending }
}
```

### Server-Side Errors
```typescript
export default defineEventHandler(async (event) => {
  try {
    // ... operation
  } catch (err) {
    console.error('Stipend processing error:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to process stipend payment. Please contact support.',
      data: { originalError: err.message } // Log this, don't show to user
    })
  }
})
```

## Deployment

### Vercel Deployment
Push to `main` branch triggers automatic production deployment. No manual steps.

### Firebase Rules & Indexes
MUST be deployed manually before first production use:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Add to Phase 3 checklist: automate this via GitHub Actions.

## Performance Budgets

- **Page load:** < 3s on 4G
- **Firestore query result:** < 50 documents per query (use pagination)
- **Image upload size:** < 500KB after compression
- **Bundle size:** < 200KB gzipped for initial load
- **Coverage grid render:** < 500ms for 119 cells

If any metric exceeds the budget, investigate before continuing.

## When You're Stuck

If a task is blocked or ambiguous:
1. **Check the spec** -- does specs/ have a file that clarifies?
2. **Check the original** -- the concept.json has evidence from the FlutterFlow app
3. **Check the domain docs** -- docs/core/001-vision.md and docs/core/002-features.md
4. **Ask the user** -- better to clarify than to build the wrong thing

Do NOT:
- ❌ Guess at business logic (especially stipend calculations)
- ❌ Invent features not in the spec
- ❌ Skip security rules "for now"
- ❌ Use placeholder data instead of Firestore
