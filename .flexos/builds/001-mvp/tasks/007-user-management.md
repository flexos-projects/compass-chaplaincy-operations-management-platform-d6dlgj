---
id: build-001-task-007
title: "User Management"
description: "Searchable user list with role filters, user detail page with profile editing, photo upload, terminal assignments, duty/stipend history, and audit trail"
type: build
subtype: task
status: pending
sequence: 7
tags: [build, task, users, crud]
relatesTo: ["specs/004-features_user-management.md", "specs/013-pages_users.md", "docs/core/004-database.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 007: User Management

## Objective

Build the complete user management workflow: a searchable, filterable user list page at `/users` with role filter chips and pagination, and a user detail page at `/users/[id]` with profile editing, photo upload to Firebase Storage, terminal assignment toggles, duty history, stipend history, and server-side audit logging. After this task, admins can find, view, and edit any user in the system with full accountability.

## Prerequisites

- Task 004 (App Layout) complete -- sidebar and default layout
- Task 003 (Firestore Schema) complete -- `User` interface, security rules, seed data
- `useAuth` composable returns `currentUser` with UID
- VueFire configured with Firestore
- Firebase Storage enabled (from T-002)
- Seeded test chaplains in Firestore

## Steps

### 1. Create the Users Composable

Create `app/composables/useUsers.ts`:

```typescript
import { collection, query, where, orderBy, limit, startAfter, getDocs, type DocumentSnapshot } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import type { User } from '~/types/firestore'

export function useUsers() {
  const db = useFirestore()

  // Reactive filter state
  const searchTerm = ref('')
  const activeFilter = ref<'all' | 'chaplains' | 'interns' | 'support'>('all')
  const pageSize = 50
  const lastDoc = ref<DocumentSnapshot | null>(null)
  const currentPage = ref(1)

  // Build Firestore query based on active filter
  const usersQuery = computed(() => {
    let q = collection(db, 'users')
    const constraints: any[] = []

    switch (activeFilter.value) {
      case 'chaplains':
        constraints.push(where('isChaplain', '==', true))
        break
      case 'interns':
        constraints.push(where('isIntern', '==', true))
        break
      case 'support':
        constraints.push(where('isSupportMember', '==', true))
        break
    }

    constraints.push(orderBy('displayName', 'asc'))
    constraints.push(limit(pageSize))

    return query(q, ...constraints)
  })

  const users = useCollection<User>(usersQuery)

  // Client-side search filter (applied on top of Firestore results)
  const filteredUsers = computed(() => {
    if (!users.value) return []
    if (!searchTerm.value.trim()) return users.value

    const term = searchTerm.value.toLowerCase().trim()
    return users.value.filter(user =>
      user.displayName?.toLowerCase().includes(term)
      || user.email?.toLowerCase().includes(term)
    )
  })

  // Count queries for filter chips
  const allUsersQuery = computed(() => query(collection(db, 'users')))
  const allUsers = useCollection<User>(allUsersQuery)

  const chipCounts = computed(() => {
    const all = allUsers.value ?? []
    return {
      all: all.length,
      chaplains: all.filter(u => u.isChaplain).length,
      interns: all.filter(u => u.isIntern).length,
      support: all.filter(u => u.isSupportMember).length,
    }
  })

  function setFilter(filter: typeof activeFilter.value) {
    activeFilter.value = filter
    currentPage.value = 1
    lastDoc.value = null
  }

  function setSearch(term: string) {
    searchTerm.value = term
  }

  return {
    users: filteredUsers,
    searchTerm,
    activeFilter,
    chipCounts,
    currentPage,
    isLoading: computed(() => users.value === undefined),
    setFilter,
    setSearch,
  }
}
```

### 2. Create the Users List Page

Create `app/pages/users/index.vue`:

```vue
<template>
  <div>
    <PageHeader>
      <template #title>Users <span class="text-neutral-mid font-normal text-lg">({{ chipCounts.all }})</span></template>
    </PageHeader>

    <!-- Search bar -->
    <div class="mb-4">
      <div class="relative max-w-md">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-mid">&#x1F50D;</span>
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search by name or email..."
          class="w-full pl-10 pr-10 py-2.5 border border-neutral-light rounded-lg
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            text-sm"
          @input="handleSearch"
        />
        <button
          v-if="searchInput"
          @click="clearSearch"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-mid hover:text-neutral-dark"
        >
          &#x2715;
        </button>
      </div>
    </div>

    <!-- Role filter chips -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="chip in filterChips"
        :key="chip.value"
        @click="setFilter(chip.value)"
        :class="[
          'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
          activeFilter === chip.value
            ? 'bg-primary text-white'
            : 'bg-white text-neutral-dark border border-neutral-light hover:bg-neutral-bg'
        ]"
      >
        {{ chip.label }}
        <span
          class="ml-1 text-xs"
          :class="activeFilter === chip.value ? 'text-white/70' : 'text-neutral-mid'"
        >
          ({{ chip.count }})
        </span>
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="card space-y-4">
      <div v-for="i in 5" :key="i" class="flex items-center gap-4 py-3 border-b border-neutral-light/50 last:border-0">
        <div class="w-10 h-10 rounded-full bg-neutral-light/80 animate-pulse" />
        <div class="flex-1 space-y-2">
          <div class="h-4 w-48 bg-neutral-light/80 rounded animate-pulse" />
          <div class="h-3 w-32 bg-neutral-light/80 rounded animate-pulse" />
        </div>
        <div class="h-6 w-16 bg-neutral-light/80 rounded-full animate-pulse" />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="users.length === 0"
      class="card text-center py-12"
    >
      <p class="text-neutral-mid">No users found{{ searchInput ? ` matching "${searchInput}"` : '' }}.</p>
      <button
        v-if="searchInput || activeFilter !== 'all'"
        @click="resetFilters"
        class="mt-2 text-sm text-primary hover:text-primary-dark"
      >
        Clear filters
      </button>
    </div>

    <!-- User table -->
    <div v-else class="card overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-neutral-light">
            <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2">Name</th>
            <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2 hidden md:table-cell">Role</th>
            <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2 hidden lg:table-cell">Terminals</th>
            <th class="text-left text-xs font-semibold text-neutral-mid uppercase tracking-wider py-3 px-2">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.uid"
            @click="navigateTo(`/users/${user.uid}`)"
            class="border-b border-neutral-light/50 last:border-0 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <!-- Name + email -->
            <td class="py-3 px-2">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                  {{ getInitials(user.displayName) }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-neutral-dark truncate">{{ user.displayName }}</p>
                  <p class="text-xs text-neutral-mid truncate">{{ user.email }}</p>
                </div>
              </div>
            </td>

            <!-- Role badge -->
            <td class="py-3 px-2 hidden md:table-cell">
              <span
                class="text-xs font-medium px-2 py-1 rounded-full"
                :class="getRoleBadgeClass(user.role)"
              >
                {{ user.role }}
              </span>
            </td>

            <!-- Terminals -->
            <td class="py-3 px-2 hidden lg:table-cell">
              <span class="text-sm text-neutral-mid">
                {{ user.terminals?.length ? user.terminals.join(', ') : '\u2014' }}
              </span>
            </td>

            <!-- On-duty status -->
            <td class="py-3 px-2">
              <span
                class="text-xs font-medium px-2 py-1 rounded-full"
                :class="user.onDuty
                  ? 'bg-success/10 text-success'
                  : 'bg-neutral-light text-neutral-mid'"
              >
                {{ user.onDuty ? 'On Duty' : 'Off Duty' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination info -->
      <div class="mt-4 flex items-center justify-between text-sm text-neutral-mid">
        <p>Showing {{ users.length }} user{{ users.length !== 1 ? 's' : '' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { users, searchTerm, activeFilter, chipCounts, isLoading, setFilter, setSearch } = useUsers()

const searchInput = ref(searchTerm.value)
let searchTimeout: ReturnType<typeof setTimeout>

const filterChips = computed(() => [
  { label: 'All Users', value: 'all' as const, count: chipCounts.value.all },
  { label: 'Chaplains', value: 'chaplains' as const, count: chipCounts.value.chaplains },
  { label: 'Interns', value: 'interns' as const, count: chipCounts.value.interns },
  { label: 'Support', value: 'support' as const, count: chipCounts.value.support },
])

function handleSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    setSearch(searchInput.value)
  }, 300)
}

function clearSearch() {
  searchInput.value = ''
  setSearch('')
}

function resetFilters() {
  clearSearch()
  setFilter('all')
}

function getInitials(name: string): string {
  const parts = name?.split(' ') ?? []
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (name ?? '').slice(0, 2).toUpperCase()
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin': return 'bg-primary/10 text-primary'
    case 'chaplain': return 'bg-success/10 text-success'
    case 'intern': return 'bg-warning/10 text-warning'
    case 'support': return 'bg-neutral-light text-neutral-mid'
    default: return 'bg-neutral-light text-neutral-mid'
  }
}

// Apply query params on mount
const route = useRoute()
onMounted(() => {
  if (route.query.filter) {
    const f = route.query.filter as string
    if (['chaplains', 'interns', 'support'].includes(f)) {
      setFilter(f as any)
    }
  }
  if (route.query.search) {
    searchInput.value = route.query.search as string
    setSearch(searchInput.value)
  }
})
</script>
```

### 3. Create the User Detail Composable

Create `app/composables/useUserDetail.ts`:

```typescript
import { doc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { useDocument } from 'vuefire'
import type { User, DutyLog, ChaplainPayout } from '~/types/firestore'

export function useUserDetail(userId: string) {
  const db = useFirestore()

  // User document (real-time listener)
  const userRef = computed(() => doc(db, 'users', userId))
  const user = useDocument<User>(userRef)
  const isLoading = computed(() => user.value === undefined)

  // Duty logs (one-time fetch, most recent 10)
  const dutyLogs = ref<DutyLog[]>([])
  const dutyLogsLoading = ref(true)

  async function fetchDutyLogs() {
    dutyLogsLoading.value = true
    try {
      const q = query(
        collection(db, 'duty_logs'),
        where('userId', '==', userId),
        orderBy('startTime', 'desc'),
        limit(10)
      )
      const snap = await getDocs(q)
      dutyLogs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as DutyLog & { id: string })
    } catch (err) {
      console.error('Failed to fetch duty logs:', err)
    } finally {
      dutyLogsLoading.value = false
    }
  }

  // Stipend payouts (one-time fetch)
  const payouts = ref<ChaplainPayout[]>([])
  const payoutsLoading = ref(true)

  async function fetchPayouts() {
    payoutsLoading.value = true
    try {
      const q = query(
        collection(db, 'chaplain_payouts'),
        where('chaplainId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(12)
      )
      const snap = await getDocs(q)
      payouts.value = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ChaplainPayout & { id: string })
    } catch (err) {
      console.error('Failed to fetch payouts:', err)
    } finally {
      payoutsLoading.value = false
    }
  }

  // Computed totals
  const ytdTotal = computed(() => {
    const currentYear = new Date().getFullYear()
    return payouts.value
      .filter(p => p.yearPaid === currentYear)
      .reduce((sum, p) => sum + (p.payoutAmount || 0), 0)
  })

  const allTimeTotal = computed(() =>
    payouts.value.reduce((sum, p) => sum + (p.payoutAmount || 0), 0)
  )

  // Load data on init
  fetchDutyLogs()
  fetchPayouts()

  return {
    user,
    isLoading,
    dutyLogs,
    dutyLogsLoading,
    payouts,
    payoutsLoading,
    ytdTotal,
    allTimeTotal,
    refetchDutyLogs: fetchDutyLogs,
    refetchPayouts: fetchPayouts,
  }
}
```

### 4. Create the Profile Edit Form Component

Create `app/components/users/ProfileEditForm.vue`:

```vue
<template>
  <form @submit.prevent="$emit('save', formData)" class="space-y-6">
    <!-- Personal Info -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-neutral-dark mb-1.5">Display Name *</label>
        <input
          v-model="formData.displayName"
          type="text"
          required
          maxlength="100"
          :disabled="!editing"
          class="w-full px-3 py-2 border border-neutral-light rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            disabled:bg-neutral-bg disabled:text-neutral-mid"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-neutral-dark mb-1.5">Email *</label>
        <input
          v-model="formData.email"
          type="email"
          required
          :disabled="!editing"
          class="w-full px-3 py-2 border border-neutral-light rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            disabled:bg-neutral-bg disabled:text-neutral-mid"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-neutral-dark mb-1.5">Phone</label>
        <input
          v-model="formData.phoneNumber"
          type="tel"
          placeholder="(555) 123-4567"
          :disabled="!editing"
          class="w-full px-3 py-2 border border-neutral-light rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            disabled:bg-neutral-bg disabled:text-neutral-mid"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-neutral-dark mb-1.5">Title</label>
        <input
          v-model="formData.title"
          type="text"
          placeholder="Chaplain"
          :disabled="!editing"
          class="w-full px-3 py-2 border border-neutral-light rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            disabled:bg-neutral-bg disabled:text-neutral-mid"
        />
      </div>
    </div>

    <!-- Bio -->
    <div>
      <label class="block text-sm font-medium text-neutral-dark mb-1.5">Bio</label>
      <textarea
        v-model="formData.bio"
        rows="3"
        maxlength="500"
        placeholder="A brief biography..."
        :disabled="!editing"
        class="w-full px-3 py-2 border border-neutral-light rounded-lg text-sm resize-none
          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
          disabled:bg-neutral-bg disabled:text-neutral-mid"
      />
      <p v-if="editing" class="text-xs text-neutral-mid mt-1">{{ formData.bio?.length ?? 0 }}/500</p>
    </div>

    <!-- Role toggles -->
    <div>
      <h3 class="text-sm font-medium text-neutral-dark mb-3">Roles</h3>
      <div class="flex flex-wrap gap-4">
        <label v-for="toggle in roleToggles" :key="toggle.key" class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            v-model="(formData as any)[toggle.key]"
            :disabled="!editing"
            class="w-4 h-4 rounded border-neutral-light text-primary focus:ring-primary/30"
          />
          <span class="text-sm text-neutral-dark">{{ toggle.label }}</span>
        </label>
      </div>
    </div>

    <!-- Terminal assignments -->
    <div>
      <h3 class="text-sm font-medium text-neutral-dark mb-3">Terminal Assignments</h3>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="terminal in ['A', 'B', 'C', 'D', 'E']"
          :key="terminal"
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
            formData.terminals?.includes(terminal)
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-white border-neutral-light text-neutral-dark',
            !editing && 'opacity-60 cursor-default'
          ]"
        >
          <input
            type="checkbox"
            :checked="formData.terminals?.includes(terminal)"
            @change="toggleTerminal(terminal)"
            :disabled="!editing"
            class="sr-only"
          />
          <span class="text-sm font-medium">Terminal {{ terminal }}</span>
        </label>
      </div>
    </div>

    <!-- Action buttons -->
    <div v-if="editing" class="flex gap-3 pt-2">
      <button type="submit" :disabled="saving" class="btn-primary">
        {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>
      <button type="button" @click="$emit('cancel')" class="btn-secondary">
        Cancel
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { User } from '~/types/firestore'

const props = defineProps<{
  user: User
  editing: boolean
  saving: boolean
}>()

defineEmits<{
  save: [data: Partial<User>]
  cancel: []
}>()

const formData = reactive({
  displayName: props.user.displayName,
  email: props.user.email,
  phoneNumber: props.user.phoneNumber ?? '',
  title: props.user.title ?? '',
  bio: props.user.bio ?? '',
  isChaplain: props.user.isChaplain,
  isIntern: props.user.isIntern,
  isSupportMember: props.user.isSupportMember,
  isAfterHours: props.user.isAfterHours,
  terminals: [...(props.user.terminals ?? [])],
})

// Reset form when user prop changes
watch(() => props.user, (newUser) => {
  if (!newUser) return
  formData.displayName = newUser.displayName
  formData.email = newUser.email
  formData.phoneNumber = newUser.phoneNumber ?? ''
  formData.title = newUser.title ?? ''
  formData.bio = newUser.bio ?? ''
  formData.isChaplain = newUser.isChaplain
  formData.isIntern = newUser.isIntern
  formData.isSupportMember = newUser.isSupportMember
  formData.isAfterHours = newUser.isAfterHours
  formData.terminals = [...(newUser.terminals ?? [])]
}, { deep: true })

const roleToggles = [
  { key: 'isChaplain', label: 'Chaplain' },
  { key: 'isIntern', label: 'Intern' },
  { key: 'isSupportMember', label: 'Support Staff' },
  { key: 'isAfterHours', label: 'After-Hours' },
]

function toggleTerminal(terminal: string) {
  if (!props.editing) return
  const idx = formData.terminals.indexOf(terminal)
  if (idx >= 0) {
    formData.terminals.splice(idx, 1)
  } else {
    formData.terminals.push(terminal)
    formData.terminals.sort()
  }
}
</script>
```

### 5. Create the Server API Route for Profile Updates

Create `server/api/users/[id]/update.post.ts`:

```typescript
import { adminAuth, adminDb } from '~/server/utils/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  // 1. Verify admin
  const admin = await verifyAdmin(event)

  // 2. Get target user ID
  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  // 3. Read request body
  const body = await readBody(event)
  const allowedFields = [
    'displayName', 'email', 'phoneNumber', 'title', 'bio',
    'role', 'isChaplain', 'isIntern', 'isSupportMember', 'isAfterHours',
    'terminals', 'photoUrl'
  ]

  // Filter to allowed fields only
  const updates: Record<string, any> = {}
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  // 4. Fetch current user document (for audit before/after)
  const userRef = adminDb.collection('users').doc(userId)
  const userSnap = await userRef.get()

  if (!userSnap.exists) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const before = userSnap.data()!

  // 5. Build before/after diff for audit
  const auditBefore: Record<string, any> = {}
  const auditAfter: Record<string, any> = {}
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = before[key]
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      auditBefore[key] = oldValue
      auditAfter[key] = newValue
    }
  }

  // 6. Add audit metadata to update
  updates.adminEditedAt = Timestamp.now()
  updates.adminEditedBy = admin.uid

  // 7. Batch write: update user + create audit entry
  const batch = adminDb.batch()

  batch.update(userRef, updates)

  if (Object.keys(auditBefore).length > 0) {
    const auditRef = adminDb.collection('audit_log').doc()
    batch.set(auditRef, {
      action: 'profile_edit',
      adminId: admin.uid,
      targetId: userId,
      targetCollection: 'users',
      details: {
        before: auditBefore,
        after: auditAfter,
        summary: `Updated ${Object.keys(auditAfter).join(', ')} for ${before.displayName}`
      },
      createdAt: Timestamp.now()
    })
  }

  await batch.commit()

  return { success: true }
})
```

### 6. Create the User Detail Page

Create `app/pages/users/[id].vue`:

```vue
<template>
  <div>
    <!-- Back link -->
    <NuxtLink to="/users" class="inline-flex items-center gap-1 text-sm text-neutral-mid hover:text-primary mb-4">
      &#x2190; Back to Users
    </NuxtLink>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-6">
      <div class="card flex items-center gap-6">
        <div class="w-24 h-24 rounded-full bg-neutral-light/80 animate-pulse" />
        <div class="space-y-3">
          <div class="h-6 w-48 bg-neutral-light/80 rounded animate-pulse" />
          <div class="h-4 w-32 bg-neutral-light/80 rounded animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Not found -->
    <div v-else-if="!user" class="card text-center py-12">
      <p class="text-neutral-mid text-lg">User not found.</p>
      <NuxtLink to="/users" class="text-primary hover:text-primary-dark text-sm mt-2 inline-block">
        Return to user list
      </NuxtLink>
    </div>

    <!-- User detail -->
    <template v-else>
      <!-- Profile header -->
      <div class="card flex flex-col sm:flex-row items-start gap-6 mb-6">
        <!-- Avatar -->
        <div class="flex flex-col items-center gap-2">
          <div
            v-if="user.photoUrl"
            class="w-24 h-24 rounded-full bg-cover bg-center"
            :style="{ backgroundImage: `url(${user.photoUrl})` }"
          />
          <div v-else class="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {{ getInitials(user.displayName) }}
          </div>
          <button
            @click="triggerPhotoUpload"
            class="text-xs text-primary hover:text-primary-dark"
          >
            {{ uploadingPhoto ? 'Uploading...' : 'Upload Photo' }}
          </button>
          <input
            ref="photoInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handlePhotoUpload"
          />
        </div>

        <!-- Info + actions -->
        <div class="flex-1">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 class="text-2xl font-semibold text-neutral-dark">{{ user.displayName }}</h1>
              <p class="text-sm text-neutral-mid">{{ user.email }}</p>
            </div>
            <button
              v-if="!editing"
              @click="editing = true"
              class="btn-primary self-start"
            >
              Edit Profile
            </button>
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
            <span class="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
              {{ user.role }}
            </span>
            <span
              v-if="user.onDuty"
              class="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success"
            >
              On Duty
            </span>
            <span
              v-if="user.terminals?.length"
              class="text-xs font-medium px-2 py-1 rounded-full bg-neutral-light text-neutral-mid"
            >
              Terminals: {{ user.terminals.join(', ') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Success/error banners -->
      <div v-if="saveSuccess" class="mb-4 px-4 py-3 rounded-lg bg-success/10 text-success border border-success/30 text-sm" role="status">
        Profile updated successfully.
      </div>
      <div v-if="saveError" class="mb-4 px-4 py-3 rounded-lg bg-error/10 text-error border border-error/30 text-sm" role="alert">
        {{ saveError }}
      </div>

      <!-- Edit form -->
      <div class="card mb-6">
        <h2 class="text-lg font-semibold text-neutral-dark mb-4">Profile Information</h2>
        <ProfileEditForm
          :user="user"
          :editing="editing"
          :saving="saving"
          @save="handleSave"
          @cancel="handleCancel"
        />
      </div>

      <!-- Duty History -->
      <div class="card mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-neutral-dark">Duty History</h2>
          <NuxtLink :to="`/duty-days?chaplain=${user.uid}`" class="text-sm text-primary hover:text-primary-dark">
            View all
          </NuxtLink>
        </div>

        <div v-if="dutyLogsLoading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-10 bg-neutral-light/80 rounded animate-pulse" />
        </div>
        <div v-else-if="dutyLogs.length === 0" class="text-sm text-neutral-mid py-4 text-center">
          No duty logs yet.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-light">
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase">Date</th>
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase hidden sm:table-cell">Hours</th>
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in dutyLogs" :key="log.id" class="border-b border-neutral-light/50 last:border-0">
              <td class="py-2 px-2 text-neutral-dark">{{ formatDate(log.startTime) }}</td>
              <td class="py-2 px-2 text-neutral-mid hidden sm:table-cell">
                {{ log.totalHours ? `${log.totalHours.toFixed(1)} hrs` : 'Active' }}
              </td>
              <td class="py-2 px-2">
                <span
                  class="text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="log.isPaid ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'"
                >
                  {{ log.isPaid ? 'Paid' : 'Approved' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Stipend History -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-neutral-dark">Stipend History</h2>
          <div class="text-sm text-neutral-mid">
            YTD: <span class="font-medium text-neutral-dark">${{ ytdTotal.toFixed(2) }}</span>
            <span class="mx-1">|</span>
            All-Time: <span class="font-medium text-neutral-dark">${{ allTimeTotal.toFixed(2) }}</span>
          </div>
        </div>

        <div v-if="payoutsLoading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-10 bg-neutral-light/80 rounded animate-pulse" />
        </div>
        <div v-else-if="payouts.length === 0" class="text-sm text-neutral-mid py-4 text-center">
          No stipend payments yet.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-light">
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase">Month</th>
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase hidden sm:table-cell">Shifts</th>
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase">Amount</th>
              <th class="text-left py-2 px-2 text-xs font-semibold text-neutral-mid uppercase hidden md:table-cell">Check #</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payout in payouts" :key="payout.id" class="border-b border-neutral-light/50 last:border-0">
              <td class="py-2 px-2 text-neutral-dark">{{ payout.monthPaid }} {{ payout.yearPaid }}</td>
              <td class="py-2 px-2 text-neutral-mid hidden sm:table-cell">{{ payout.dutyLogCount }}</td>
              <td class="py-2 px-2 text-neutral-dark font-medium">${{ payout.payoutAmount.toFixed(2) }}</td>
              <td class="py-2 px-2 text-neutral-mid hidden md:table-cell">{{ payout.checkNumber ?? '\u2014' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { format } from 'date-fns'
import type { Timestamp } from 'firebase/firestore'
import type { User } from '~/types/firestore'

const route = useRoute()
const userId = route.params.id as string
const { currentUser } = useAuth()

const {
  user,
  isLoading,
  dutyLogs,
  dutyLogsLoading,
  payouts,
  payoutsLoading,
  ytdTotal,
  allTimeTotal,
} = useUserDetail(userId)

// Edit state
const editing = ref(false)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref('')

// Photo upload state
const photoInput = ref<HTMLInputElement | null>(null)
const uploadingPhoto = ref(false)

function getInitials(name: string): string {
  const parts = name?.split(' ') ?? []
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name ?? '').slice(0, 2).toUpperCase()
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '-'
  try { return format(ts.toDate(), 'MMM d, yyyy') }
  catch { return '-' }
}

async function handleSave(data: Partial<User>) {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    const token = await currentUser.value?.getIdToken()
    const res = await $fetch(`/api/users/${userId}/update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    })

    if (res.success) {
      saveSuccess.value = true
      editing.value = false
      setTimeout(() => { saveSuccess.value = false }, 3000)
    }
  } catch (err: any) {
    saveError.value = err.data?.message || 'Failed to save changes. Please try again.'
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  editing.value = false
  saveError.value = ''
}

function triggerPhotoUpload() {
  photoInput.value?.click()
}

async function handlePhotoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validate
  if (file.size > 5 * 1024 * 1024) {
    saveError.value = 'Image must be under 5 MB.'
    return
  }
  if (!file.type.startsWith('image/')) {
    saveError.value = 'Please select an image file.'
    return
  }

  uploadingPhoto.value = true
  saveError.value = ''

  try {
    // Compress image
    const compressed = await compressImage(file)

    // Upload to Firebase Storage
    const storage = useFirebaseStorage()
    const photoRef = storageRef(storage, `user-photos/${userId}/${Date.now()}.jpg`)
    await uploadBytes(photoRef, compressed)
    const photoUrl = await getDownloadURL(photoRef)

    // Update user profile via API
    const token = await currentUser.value?.getIdToken()
    await $fetch(`/api/users/${userId}/update`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { photoUrl },
    })

    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err: any) {
    saveError.value = 'Photo upload failed. Please try again.'
  } finally {
    uploadingPhoto.value = false
    input.value = ''
  }
}

async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const maxDim = 800
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
  canvas.width = img.width * scale
  canvas.height = img.height * scale
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
      'image/jpeg',
      0.8
    )
  })
}
</script>
```

### 7. Test User Management

```bash
pnpm dev
```

**Users list:**
1. Navigate to `/users`
2. All seeded users appear in alphabetical order
3. Role filter chips show counts (All: 9, Chaplains: 6, Interns: 2, Support: 0)
4. Click "Chaplains" -- list filters to chaplains only
5. Type "maria" in search -- filters to matching users
6. Clear search and filters -- all users return
7. Click a user row -- navigates to `/users/{id}`

**User detail:**
1. Profile header shows avatar (initials), name, email, role badge
2. Terminals show if assigned
3. Click "Edit Profile" -- form fields become editable
4. Change display name, click "Save Changes"
5. Success banner appears, form returns to read-only
6. Verify in Firestore: user document updated, audit_log entry created

**Photo upload:**
1. Click "Upload Photo"
2. Select an image file (<5 MB)
3. "Uploading..." text appears
4. Photo compresses and uploads to Storage
5. Avatar updates with new photo
6. Verify in Firestore: `photoUrl` field updated
7. Verify in Storage: file exists at `user-photos/{uid}/`

**Terminal assignment:**
1. Enter edit mode
2. Click Terminal D checkbox -- chip highlights
3. Save changes
4. Verify in Firestore: `terminals` array updated to include 'D'

### 8. Commit

```bash
git add .
git commit -m "feat: add user management with search, filters, profile editing, and photo upload"
git push
```

## Acceptance Criteria

- [ ] `composables/useUsers.ts` provides search, filter, and pagination for user list
- [ ] `composables/useUserDetail.ts` loads user document, duty logs, and payouts
- [ ] `pages/users/index.vue` displays searchable user table with role filter chips
- [ ] Search debounces at 300ms and filters case-insensitive on name and email
- [ ] Role filter chips show counts and single-select behavior
- [ ] Empty state shows when search/filter returns no results
- [ ] User rows are clickable and navigate to `/users/{id}`
- [ ] `pages/users/[id].vue` shows full profile with avatar, info, and badges
- [ ] "Edit Profile" button toggles form between read-only and editable
- [ ] `ProfileEditForm` handles display name, email, phone, title, bio, roles, terminals
- [ ] "Save Changes" calls `POST /api/users/:id/update` with auth token
- [ ] Server route validates admin, updates user document, creates audit_log entry
- [ ] Audit entry includes before/after diff of changed fields
- [ ] Photo upload compresses to 800x800px JPEG, uploads to Firebase Storage
- [ ] Photo URL stored in user document via server API (creates audit entry)
- [ ] File validation: max 5 MB, image types only
- [ ] Duty history table shows 10 most recent logs
- [ ] Stipend history table shows payouts with YTD and all-time totals
- [ ] 404 state when user ID does not exist
- [ ] Back link navigates to `/users`
- [ ] Responsive: tables hide columns on mobile, form stacks vertically

## Estimated Time

**3 days (24 hours)** including composables, components, server route, and testing

## Files Created/Modified

### Created
- `app/composables/useUsers.ts`
- `app/composables/useUserDetail.ts`
- `app/components/users/ProfileEditForm.vue`
- `app/pages/users/index.vue`
- `app/pages/users/[id].vue`
- `server/api/users/[id]/update.post.ts`

### Modified
- None

## Dependencies

**Depends on:** T-004 (App Layout), T-003 (Firestore Schema)

## Next Task

**T-008: Duty day tracking + coverage schedule grid**

After this task, admins can find, view, and edit any user. Next task builds duty day tracking and the coverage schedule grid.

## Troubleshooting

### Issue: User list is empty
**Solution:** Verify seed data exists. Check browser console for Firestore permission errors. Confirm composite index `users: isChaplain ASC, displayName ASC` is built.

### Issue: Profile save returns 401
**Solution:** The server route requires a Bearer token. Ensure `currentUser.getIdToken()` is called and the token is passed in the Authorization header.

### Issue: Photo upload fails with CORS error
**Solution:** Firebase Storage CORS must be configured. Create a `cors.json` file and deploy: `gsutil cors set cors.json gs://your-bucket.appspot.com`.

### Issue: Audit log entry not created
**Solution:** Audit entries are created in a batch with the user update. If the batch fails, both the update and audit entry are rolled back. Check server logs for the specific error.

## Notes

- The user list uses client-side search filtering (fetching all users and filtering in memory). This works well for 50-200 users. For larger deployments, consider Algolia or a Firestore prefix range query.
- Photo compression uses the browser Canvas API. The `createImageBitmap` function is supported in all modern browsers. The output is always JPEG at 80% quality, max 800x800px.
- The server route uses a batch write to ensure atomicity between the user update and the audit log entry. If either fails, both are rolled back.
- Terminal assignments are stored as a sorted array (`['A', 'C', 'D']`). The UI sorts automatically when toggling.
