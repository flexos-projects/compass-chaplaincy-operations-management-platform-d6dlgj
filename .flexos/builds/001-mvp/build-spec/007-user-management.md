---
id: build-001-spec-user-management
title: "User Management Build Spec"
description: "Gap analysis for user list with search/filter, user detail page, profile editing, and photo upload"
type: build
subtype: build-spec
status: draft
sequence: 7
tags: [build, spec, users, crud, search]
relatesTo: ["builds/001-mvp/config.md", "specs/004-features_user-management.md", "specs/013-pages_users.md", "specs/018-database_users-collection.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# User Management Build Spec

## What We Need

The user management specs (004-features_user-management.md, 013-pages_users.md) describe a two-page workflow:

**Users List (`/users`):**
- **Search bar** with 300ms debounce, case-insensitive matching on `displayName` and `email`
- **Role filter chips** (All Users, Chaplains, Interns, Support Staff) -- single-select, count badges on each chip
- **Data table** with columns: Avatar+Name, Role (color-coded badge), Terminals, Status (on-duty badge), Last Active
- **Pagination** -- 50 users per page, cursor-based with Previous/Next
- **Row click** navigates to `/users/:id`

**User Detail (`/users/:id`):**
- **Profile header** with large avatar (120px), name, role badges, last-edited timestamp
- **Edit mode toggle** -- "Edit Profile" button flips all fields from read-only to editable
- **Form fields**: displayName, email, phoneNumber, title, bio (500 char max), language dropdown
- **Role toggles**: isChaplain, isIntern, isSupportMember, isAfterHours (boolean switches)
- **Terminal assignments**: multi-select checkboxes for A through E
- **Photo upload** with client-side compression (800x800, JPEG 80%), progress bar, Firebase Storage
- **Duty history** -- last 10 duty logs for this user
- **Stipend history** -- YTD and all-time totals with monthly breakdown
- **Audit trail sidebar** -- last 5 audit entries for this user
- **Server-side save** via `POST /api/users/:id/update` with atomic audit log creation

## What Nuxt 4 Provides

- **VueFire `useCollection()`** for real-time user list binding with query support
- **VueFire `useDocument()`** for single user detail binding
- **`@tanstack/vue-table`** (from T-001) for sortable, paginated data tables
- **File-based routing** -- `pages/users/index.vue` and `pages/users/[id].vue` map to `/users` and `/users/:id`
- **Nuxt server routes** -- `server/api/users/[id]/update.post.ts` handles profile updates
- **Firebase Storage client** for photo uploads

## The Gap

1. **`composables/useUsers.ts`** -- user list query with reactive role filter, client-side search, pagination state, and role counts
2. **`composables/useUserDetail.ts`** -- single user document, duty log history query, stipend history query, edit state management, save function
3. **`pages/users/index.vue`** -- user list page with search bar, filter chips, data table
4. **`pages/users/[id].vue`** -- user detail page with profile header, edit form, duty/stipend history
5. **`components/users/UserList.vue`** -- data table component with TanStack Table, role badges, on-duty indicators
6. **`components/users/ProfileEditForm.vue`** -- the edit form with all fields, validation, and save/cancel actions
7. **`components/users/PhotoUpload.vue`** -- file picker, compression, upload progress, error handling
8. **`server/api/users/[id]/update.post.ts`** -- server route that validates input, updates user document, sets audit fields, creates `audit_log` entry in a batch write

## Component Mapping

| File | Type | Purpose |
|------|------|---------|
| `pages/users/index.vue` | Page | User list with search/filter |
| `pages/users/[id].vue` | Page | User detail and editing |
| `composables/useUsers.ts` | Composable | List queries, search, filter, pagination |
| `composables/useUserDetail.ts` | Composable | Single user data, edit state, save |
| `components/users/UserList.vue` | Component | TanStack data table |
| `components/users/ProfileEditForm.vue` | Component | Profile edit form fields |
| `components/users/PhotoUpload.vue` | Component | Photo picker + compression + upload |
| `server/api/users/[id]/update.post.ts` | Server route | Profile update with audit trail |

### useUsers Composable API

```typescript
export function useUsers() {
  // Filter state
  const searchTerm: Ref<string>
  const activeFilter: Ref<'all' | 'chaplains' | 'interns' | 'support'>

  // Data (real-time via VueFire)
  const users: Ref<User[]>               // filtered + searched
  const roleCounts: ComputedRef<{
    all: number
    chaplains: number
    interns: number
    support: number
  }>

  // Pagination
  const page: Ref<number>
  const totalPages: ComputedRef<number>
  const displayedUsers: ComputedRef<User[]>  // current page slice

  // States
  const loading: Ref<boolean>
}
```

### useUserDetail Composable API

```typescript
export function useUserDetail(userId: string) {
  const user: Ref<User | null>
  const dutyLogs: Ref<DutyLog[]>           // last 10
  const stipendSummary: Ref<{
    ytd: number
    allTime: number
    monthly: StipendRecord[]
  }>
  const auditEntries: Ref<AuditLog[]>      // last 5

  // Edit mode
  const editing: Ref<boolean>
  const editForm: Ref<Partial<User>>       // working copy
  const saving: Ref<boolean>
  const saveError: Ref<string | null>

  async function save(): Promise<void>      // POST /api/users/:id/update
  function cancel(): void                   // discard changes
}
```

### Server Route: POST /api/users/:id/update

```typescript
export default defineEventHandler(async (event) => {
  const admin = await verifyAdmin(event)
  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)

  // 1. Fetch current user doc (for audit before/after)
  const userRef = adminDb.doc(`users/${userId}`)
  const currentDoc = await userRef.get()
  if (!currentDoc.exists) throw createError({ statusCode: 404 })

  // 2. Validate fields (displayName required, email format, etc.)

  // 3. Batch write: update user + create audit entry
  const batch = adminDb.batch()
  batch.update(userRef, {
    ...body,
    adminEditedAt: FieldValue.serverTimestamp(),
    adminEditedBy: admin.uid,
  })
  batch.create(adminDb.collection('audit_log').doc(), {
    action: 'profile_edit',
    adminId: admin.uid,
    targetId: userId,
    targetCollection: 'users',
    details: { before: currentDoc.data(), after: body },
    createdAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  return { success: true }
})
```

## Data Requirements

### Firestore Queries

```typescript
// User list (real-time, with filter)
query(collection('users'),
  where('isChaplain', '==', true),  // varies by active filter
  orderBy('displayName'),
  limit(50))

// Single user (real-time)
doc('users', userId)

// Duty logs for user (one-time fetch)
query(collection('duty_logs'),
  where('userId', '==', userId),
  orderBy('startTime', 'desc'),
  limit(10))

// Payouts for user (one-time fetch)
query(collection('chaplain_payouts'),
  where('chaplainId', '==', userId),
  orderBy('createdAt', 'desc'),
  limit(12))

// Audit entries for user (one-time fetch)
query(collection('audit_log'),
  where('targetId', '==', userId),
  orderBy('createdAt', 'desc'),
  limit(5))
```

### Required Indexes

- `users: isChaplain ASC, displayName ASC`
- `users: isIntern ASC, displayName ASC`
- `users: isSupportMember ASC, displayName ASC`
- `duty_logs: userId ASC, startTime DESC`
- `chaplain_payouts: chaplainId ASC, createdAt DESC`
- `audit_log: targetId ASC, createdAt DESC`

## Implementation Notes

- **Client-side search** -- fetch all users matching the active role filter (up to ~200 for COMPASS scale), then filter in-memory by search term. This avoids Firestore's limited text search capabilities. At 200 users, client-side filtering is instant. If the collection grows past 500, switch to Firestore prefix query (`displayName >= term && displayName <= term + '\uf8ff'`).
- **Role filter chips** use `useCollection()` with a dynamic query ref. When the active filter changes, VueFire detaches the old listener and attaches a new one for the updated query. Role counts come from separate `getCountFromServer()` calls (one per role) on page mount.
- **TanStack Table setup** -- define columns with `createColumnHelper<User>()`. Enable sorting on Name, Role, and Last Active columns. Pagination is client-side (all 50 users loaded, TanStack handles page slicing).
- **Photo compression** -- use canvas API (`createImageBitmap` + canvas resize + `toBlob('image/jpeg', 0.8)`). Max dimension 800px on either side. Validate file size (< 5MB) and MIME type (image/*) before compression. Upload to Firebase Storage at `/user-photos/{userId}/{Date.now()}.jpg`.
- **Edit mode UX** -- default is read-only (text values displayed as `<p>` elements). Clicking "Edit Profile" swaps to `<input>` elements pre-filled with current values. "Save" validates and submits. "Cancel" prompts if unsaved changes exist ("Discard changes?").
- **Audit before/after diff** -- the server route fetches the current document before applying updates. The `details` field stores both `before` and `after` snapshots. Only changed fields are meaningful, but storing full snapshots simplifies the audit log viewer.
- **Terminal checkboxes** -- render 5 checkbox chips labeled A through E. Store as `string[]` (e.g., `['A', 'C']`). Empty array is valid (unassigned chaplain).
- **404 handling** -- if `getDoc()` returns null for the user ID, show a "User not found" page with a link back to `/users`. Don't crash or show a blank page.

## Dependencies

- **T-003 (Firestore Schema)** -- `users`, `duty_logs`, `chaplain_payouts`, `audit_log` collections with indexes deployed
- **T-004 (App Layout)** -- admin layout with sidebar navigation
- **T-002 (Firebase Auth)** -- `verifyAdmin()` server utility for the update API route
- `@tanstack/vue-table` for the user list data table
- `lucide-vue-next` for icons (Search, Filter, Camera, Check, etc.)
- Firebase Storage client SDK for photo uploads
