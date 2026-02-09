---
id: audit-settings-collections
title: "Audit Log & App Settings Collections"
description: "Administrative action audit trail and centralized system configuration for accountability and operational control"
type: spec
subtype: database
status: draft
sequence: 24
tags: [database, schema, audit, settings, security, compliance]
relatesTo: [docs/core/004-database.md, docs/core/005-flows.md, docs/core/007-technical.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Audit Log & App Settings Collections

## Overview

Two critical operational collections enable accountability and centralized control:
1. **audit_log** — Immutable record of all administrative actions with before/after diffs
2. **app_settings** — Single-document system configuration (stipend rate, admin users, program year)

Neither collection existed in the original FlutterFlow app. These are NEW additions to establish proper governance, compliance, and operational transparency in the fresh build.

## Problem Statement

The original DFWAIC App Dashboard had critical operational gaps:
- **No audit trail:** Profile edits, stipend processing, coverage changes had no record of who made changes or when
- **Scattered settings:** Stipend rate hardcoded at $80, program year hardcoded as 2025, display preferences in local storage (SharedPreferences)
- **No admin management:** Admin access was implicit via Firebase Auth, no centralized list of who has admin privileges
- **Compliance risk:** No way to answer "who processed this payout?" or "who changed this chaplain's role?" in the event of a dispute

The fresh build addresses these with two purpose-built collections following enterprise audit best practices.

## Collection 1: audit_log

### Purpose
Immutable append-only log of every administrative write operation performed in the system. Provides complete accountability and compliance trail.

### flex_block type="schema"

```typescript
interface AuditLogEntry {
  // Document ID: Auto-generated Firestore ID (chronological order due to Firestore ID generation)

  // Action Classification
  action: 'profile_edit' | 'stipend_approve' | 'payout_create' | 'coverage_edit' | 'role_change' | 'settings_update' | 'photo_upload' | 'admin_add' | 'admin_remove'

  // Actor
  adminId: string                // UID of admin who performed the action

  // Target
  targetId?: string              // Document ID of the affected record (nullable for bulk operations)
  targetCollection?: string      // Collection name ("users", "duty_logs", "coverage_schedules", etc.)

  // Details
  details?: {
    before?: Record<string, any>   // Snapshot of fields before change (for edits)
    after?: Record<string, any>    // Snapshot of fields after change (for edits)
    summary?: string               // Human-readable summary (e.g., "Processed 4 duty logs totaling $340")
    affectedCount?: number         // For batch operations (e.g., 12 duty logs marked as paid)
    checkNumber?: string           // For payout actions
    amount?: number                // For financial actions
    [key: string]: any             // Flexible structure for action-specific metadata
  }

  // Metadata
  createdAt: Timestamp           // When the action occurred
}
```

### Key Properties

**Immutability:** Audit log entries can NEVER be edited or deleted. Security rules enforce `allow write: if false` on the client (all writes come from server-side Admin SDK).

**Server-side writes only:** Audit entries are created by Nuxt API routes using the Firebase Admin SDK. The client cannot create audit entries directly, preventing tampering.

**Flexible details field:** The `details` object is schema-free to accommodate different action types:
- **profile_edit:** `{ before: { displayName: "John" }, after: { displayName: "John Smith" } }`
- **payout_create:** `{ chaplainId, amount, dutyLogCount, checkNumber }`
- **coverage_edit:** `{ day: "wednesday", hour: 14, before: false, after: true }`

**Action enum:** The fixed set of action types makes it easy to filter and aggregate audit data ("show me all stipend approvals by Sarah in January").

### flex_block type="schema" (example documents)

```json
// Profile edit
{
  "action": "profile_edit",
  "adminId": "admin-sarah-uid",
  "targetId": "chaplain-martinez-uid",
  "targetCollection": "users",
  "details": {
    "before": { "phoneNumber": "555-1234", "terminals": ["A", "B"] },
    "after": { "phoneNumber": "555-9876", "terminals": ["A", "B", "C"] },
    "summary": "Updated phone number and added Terminal C"
  },
  "createdAt": "2026-02-08T14:32:00Z"
}

// Payout creation
{
  "action": "payout_create",
  "adminId": "admin-sarah-uid",
  "targetId": "payout-abc123",
  "targetCollection": "chaplain_payouts",
  "details": {
    "chaplainId": "chaplain-martinez-uid",
    "amount": 340.00,
    "dutyLogCount": 4,
    "checkNumber": "CHK-2026-0147",
    "monthPaid": "January",
    "yearPaid": 2026,
    "summary": "Processed 4 duty logs totaling $340.00"
  },
  "createdAt": "2026-02-01T16:45:00Z"
}

// Coverage edit
{
  "action": "coverage_edit",
  "adminId": "admin-marcus-uid",
  "targetId": "8-2026",
  "targetCollection": "coverage_schedules",
  "details": {
    "day": "wednesday",
    "hour": "14",
    "before": false,
    "after": true,
    "summary": "Marked Wednesday 2 PM as covered"
  },
  "createdAt": "2026-02-07T10:15:00Z"
}
```

## Collection 2: app_settings

### Purpose
Single-document centralized configuration for system-wide operational parameters. Eliminates hardcoded values and scattered local storage settings.

### Document Structure
This collection contains exactly ONE document with ID `config`.

### flex_block type="schema"

```typescript
interface AppSettings {
  // Financial
  baseStipendRate: number        // Default stipend per qualifying shift (e.g., 80.00 for $80)

  // Operational
  programYear: number            // Current chaplaincy program year (e.g., 2026)
  adminUserIds: string[]         // Array of UIDs with admin dashboard access

  // Defaults
  defaultPhotoUrl?: string       // Default avatar URL for users without photos
  orgName: string                // Organization name for branding ("DFW Airport Interfaith Chaplaincy")
  supportEmail?: string          // Support contact email for help links

  // Display Preferences (future)
  theme?: 'light' | 'dark'       // UI theme preference (future)
  dateFormat?: 'US' | 'ISO'      // Date display format preference

  // Audit
  updatedAt: Timestamp           // Last modification timestamp
  updatedBy: string              // Admin UID who last modified settings
}
```

### Key Properties

**Single document:** Always accessed at `app_settings/config`. No queries needed, just direct document reads.

**Admin user management:** The `adminUserIds` array is the single source of truth for who has admin access. On every page load, the client checks if `currentUser.uid` is in this array. On every API route, the server verifies the same.

**Stipend rate configuration:** Changing `baseStipendRate` immediately affects all future stipend calculations. Historical payouts already processed are unaffected (they store the calculated amount, not a reference to the rate).

**Bootstrap requirement:** The first admin must manually add their UID to `adminUserIds` via the Firebase Console before they can use the dashboard. After that, admins can add/remove other admins via the Settings page.

### flex_block type="schema" (example document)

```json
{
  "baseStipendRate": 80.00,
  "programYear": 2026,
  "adminUserIds": [
    "admin-sarah-uid",
    "admin-marcus-uid",
    "admin-director-uid"
  ],
  "defaultPhotoUrl": "https://storage.googleapis.com/compass-chaplaincy/defaults/avatar.png",
  "orgName": "DFW Airport Interfaith Chaplaincy",
  "supportEmail": "support@dfwaichaplains.org",
  "theme": "light",
  "dateFormat": "US",
  "updatedAt": "2026-01-15T09:00:00Z",
  "updatedBy": "admin-director-uid"
}
```

## Query Patterns

### Get Current App Settings
```typescript
// Client-side (cached after first load)
const settingsRef = doc(db, 'app_settings', 'config')
const settings = await getDoc(settingsRef)

// Server-side (every API route that needs stipend rate or admin check)
const settingsSnapshot = await adminDb.doc('app_settings/config').get()
const baseRate = settingsSnapshot.data().baseStipendRate
```

### Check if User is Admin
```typescript
// Client-side route guard
const settings = await getDoc(doc(db, 'app_settings', 'config'))
const isAdmin = settings.data().adminUserIds.includes(currentUser.uid)

if (!isAdmin) {
  navigateTo('/unauthorized')
}
```

### Update Stipend Rate
```typescript
// Server API route: POST /api/settings/update
const { baseStipendRate } = await readBody(event)

// Read current state for audit
const before = await getDoc(doc(db, 'app_settings', 'config'))

// Update settings
await updateDoc(doc(db, 'app_settings', 'config'), {
  baseStipendRate,
  updatedAt: serverTimestamp(),
  updatedBy: admin.uid
})

// Create audit log
await addDoc(collection(db, 'audit_log'), {
  action: 'settings_update',
  adminId: admin.uid,
  targetId: 'config',
  targetCollection: 'app_settings',
  details: {
    before: { baseStipendRate: before.data().baseStipendRate },
    after: { baseStipendRate },
    summary: `Updated stipend rate from $${before.data().baseStipendRate} to $${baseStipendRate}`
  },
  createdAt: serverTimestamp()
})
```

### Query Audit Log
```typescript
// Get all actions by a specific admin
const q = query(
  collection(db, 'audit_log'),
  where('adminId', '==', adminId),
  orderBy('createdAt', 'desc'),
  limit(50)
)

// Get all stipend processing actions
const q = query(
  collection(db, 'audit_log'),
  where('action', '==', 'payout_create'),
  orderBy('createdAt', 'desc')
)

// Get all actions affecting a specific user
const q = query(
  collection(db, 'audit_log'),
  where('targetCollection', '==', 'users'),
  where('targetId', '==', userId),
  orderBy('createdAt', 'desc')
)
```

## Security Rules

```javascript
// audit_log: Admin read-only, server writes only
match /audit_log/{entryId} {
  allow read: if isAdmin();
  allow write: if false;  // Written only from server-side (Admin SDK)
}

// app_settings: Admin read/write
match /app_settings/{docId} {
  // All authenticated users can read settings (need adminUserIds to check role)
  allow read: if request.auth != null;

  // Only existing admins can write
  allow write: if isAdmin()
    && request.resource.data.keys().hasAll(['baseStipendRate', 'programYear', 'adminUserIds', 'orgName', 'updatedAt', 'updatedBy'])
    && request.resource.data.baseStipendRate is number
    && request.resource.data.programYear is int
    && request.resource.data.adminUserIds is list;
}
```

## Server-Side Audit Pattern

Every Nuxt API route that modifies data follows this pattern:

```typescript
export default defineEventHandler(async (event) => {
  // 1. Verify admin auth
  const admin = await verifyAdmin(event)

  // 2. Read current state (for before diff)
  const beforeSnap = await getDoc(doc(db, targetCollection, targetId))
  const before = beforeSnap.data()

  // 3. Perform the write operation (in a batch if multiple writes)
  const batch = writeBatch(db)

  batch.update(doc(db, targetCollection, targetId), updatedFields)

  // 4. Create audit entry
  const auditRef = doc(collection(db, 'audit_log'))
  batch.set(auditRef, {
    action: determineAction(context),
    adminId: admin.uid,
    targetId,
    targetCollection,
    details: {
      before: pickRelevantFields(before),
      after: pickRelevantFields(updatedFields),
      summary: generateSummary(context)
    },
    createdAt: serverTimestamp()
  })

  // 5. Commit atomically (both the change and the audit entry)
  await batch.commit()

  return { success: true }
})
```

**Atomic writes:** The primary change and the audit entry are committed in the same batch. If the audit entry fails, the primary change is rolled back. This ensures the audit log is always complete.

## UI Integration

### Settings Page (`/settings`)

**Sections:**
- **Financial Settings:** Editable stipend base rate, display historical changes
- **Program Settings:** Current year selector (dropdown 2024-2030)
- **Admin Users:** List of current admins with "Add Admin" and "Remove" buttons
  - Add: Modal with UID input field (validates user exists before adding)
  - Remove: Confirmation dialog ("Are you sure? This will revoke admin access for [name]")
- **Organization Info:** Editable org name, support email, default photo URL
- **Display Preferences:** Theme selector, date format toggle (future)

**Save behavior:** Settings are saved individually (each section has its own save button). Each save creates an audit entry.

### Audit Log Page (`/audit`) (Future - Phase 3)

**Features:**
- Table view: Action, Admin, Target, Summary, Timestamp
- Filters: By action type, by admin, by date range, by target collection
- Detail modal: Click row to see full before/after diff
- Export: CSV export of filtered audit records
- Search: Free-text search in summary field

## Bootstrap Process

When deploying COMPASS for the first time:

1. **Firebase Console:** Manually create `app_settings/config` document with:
   ```json
   {
     "baseStipendRate": 80,
     "programYear": 2026,
     "adminUserIds": ["initial-admin-uid-from-firebase-auth"],
     "orgName": "DFW Airport Interfaith Chaplaincy",
     "updatedAt": "2026-01-01T00:00:00Z",
     "updatedBy": "system"
   }
   ```

2. **First Admin Login:** Initial admin authenticates, system reads their UID from `adminUserIds`, grants access

3. **Add More Admins:** First admin uses Settings page to add other admin UIDs

4. **Audit Trail Begins:** All subsequent actions are automatically logged

## Acceptance Criteria

- [ ] audit_log collection stores all administrative actions with before/after diffs
- [ ] Audit entries are created server-side only (client security rules deny write)
- [ ] Every profile edit, stipend processing, and coverage change creates an audit entry
- [ ] Audit entries are created atomically with the primary write (batch)
- [ ] app_settings collection has exactly one document with ID "config"
- [ ] All authenticated users can read app_settings (needed for admin check)
- [ ] Only admins can write to app_settings
- [ ] Changing baseStipendRate immediately affects future stipend calculations
- [ ] Adding/removing adminUserIds grants/revokes dashboard access
- [ ] Settings page displays current configuration and allows edits
- [ ] Each settings change creates an audit entry with before/after values

## Related Flows

- **FL-016:** Settings Update (modifies app_settings and creates audit entry)
- **FL-017:** Audit Log Write (system flow for every write operation)
- **FL-001:** Admin Authentication (checks adminUserIds)
- **SYS-002:** Audit Trail Pipeline (server-side audit creation pattern)

## Future Enhancements

- **Audit retention policy:** Archive audit entries older than 7 years to cold storage (compliance requirement)
- **Audit export:** Generate compliance reports for board review (PDF with signature page)
- **Tamper detection:** Hash chain linking audit entries to detect retroactive modifications (paranoid security)
- **Multi-level admin roles:** Add "super-admin" vs. "viewer-admin" (can view but not edit stipends)
- **Settings history:** Track all historical values of baseStipendRate with effective dates
