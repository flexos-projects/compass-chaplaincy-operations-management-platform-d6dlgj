---
id: build-001-spec-audit-log
title: "Audit Log Build Spec"
description: "Gap analysis for audit logging across all admin write operations"
type: build
subtype: build-spec
status: draft
sequence: 11
tags: [build, spec, audit, compliance]
relatesTo: ["builds/001-mvp/config.md", "specs/010-features_audit-log.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Audit Log Build Spec

## What We Need

The specs define a comprehensive, tamper-proof audit trail for every administrative write operation in COMPASS. The original FlutterFlow app had zero accountability -- when a stipend amount was wrong, no one could determine who changed it or when.

**Logged actions (7 types):**
- `profile_edit` -- User profile field changes with before/after values
- `stipend_approve` -- Duty log marked as approved
- `payout_create` -- Chaplain payout record created (financial)
- `coverage_edit` -- Coverage schedule slot toggled
- `role_change` -- User role updated
- `settings_update` -- App settings configuration changed
- `photo_upload` -- Profile photo updated

**Not logged:** Read operations, automated system actions, login/logout (Firebase Auth has its own audit).

**Audit entry schema:** `action`, `adminId`, `adminName` (denormalized), `targetId`, `targetCollection`, `details` (with optional `before`/`after` objects and `summary` string), `createdAt` (server timestamp).

**Atomicity guarantee:** Audit writes are part of the same Firestore batch transaction as the primary operation. If the primary write fails, no audit entry is created. If the audit write fails, the primary operation also rolls back.

**Display in v1:** No dedicated `/audit-log` page (deferred to v1.1). Instead, audit entries surface inline: user detail page shows recent edits for that user, stipend detail page shows payout audit, settings page shows recent config changes. A reusable `AuditLogEntry.vue` component renders entries in full and compact formats.

## What Nuxt 4 Provides

- Firebase Admin SDK batch writes in server API routes (already used in T-009 stipend processing)
- Firestore security rules already block client writes to `audit_log` (`allow write: if false`)
- Server timestamps via `FieldValue.serverTimestamp()` for immutable creation dates
- VueFire `useCollection` for reading audit entries on detail pages

## The Gap

Some audit logging was already implemented in prior tasks (T-009 payout processing writes audit entries, T-008 coverage edits go through a server route with audit). What remains:

1. **Centralized audit utility** -- A reusable server-side function that creates audit entries with consistent schema, called from every write route
2. **Retrofit existing routes** -- Verify T-007 user profile update, T-008 coverage PATCH, and T-009 stipend process all create proper audit entries. Add audit logging to any routes that were implemented without it.
3. **Settings update audit** -- Will be built in T-012, but the audit pattern must be established here
4. **Before/after diff capture** -- Server routes must read the current document state before writing, then store the diff in `details.before` and `details.after`
5. **AuditLogEntry display component** -- Reusable Vue component with full and compact modes
6. **Inline audit display** -- Add audit entry sidebar/section to user detail page and stipend detail page
7. **(Optional) Dedicated audit page** -- Simple paginated list at `/audit` for admin review

## Component Mapping

### Server Utilities
- `server/utils/audit.ts` -- Central audit utility:
  ```typescript
  function createAuditEntry(batch: WriteBatch, params: {
    action: AuditAction,
    adminId: string,
    adminName: string,
    targetId: string,
    targetCollection: string,
    details?: { before?: object, after?: object, summary?: string }
  }): void
  ```
  Adds a `audit_log` collection write to an existing Firestore batch. Every server route that modifies data calls this before committing the batch.

### Components
- `components/audit/AuditLogEntry.vue` -- Reusable entry display. Props: `entry` (AuditLog object), `compact` (boolean, default false). Full mode shows icon (based on action type), admin name, action verb, target, timestamp, and expandable before/after diff. Compact mode shows one-line summary: "Linda Martinez -- profile_edit -- 2 hours ago".
- `components/audit/AuditLogList.vue` -- Paginated list of audit entries with optional filtering. Props: `targetId?`, `targetCollection?`, `limit` (default 10). Uses VueFire to query `audit_log` with filters.
- `components/audit/AuditDiffDisplay.vue` -- Before/after field comparison. Props: `before`, `after`. Renders field-by-field diff with color coding: red strikethrough for removed, green for added, yellow highlight for changed.

### Pages (Optional)
- `pages/audit.vue` -- Simple paginated audit log browser. Filter by action type, admin, date range. Shows 50 entries per page. Low priority for v1 -- the inline displays on detail pages are more immediately useful.

### Composables
- `composables/useAudit.ts` -- VueFire query on `audit_log` collection with optional filters (`targetId`, `targetCollection`, `action`, date range). Returns: `entries`, `loading`, `loadMore()`.

### Integration Points (Retrofit)
- `server/api/users/[id]/update.post.ts` -- Add `createAuditEntry(batch, { action: 'profile_edit', ... })` with before/after user fields
- `server/api/coverage/[weekYear].patch.ts` -- Verify audit entry creation exists (should already from T-008)
- `server/api/stipends/process.post.ts` -- Verify audit entry creation exists (should already from T-009)
- `server/api/settings/update.post.ts` -- Will be built in T-012, but must use `createAuditEntry`

## Data Requirements

### Firestore Collection
- **audit_log** -- Write-only from server, read-only for admins. No client writes. No updates or deletes (immutable).
- Estimated volume: 50-200 entries per month (10 admins, moderate activity)
- No TTL needed for v1 (Firestore handles 50K+ docs easily)

### Indexes
- `audit_log`: (`targetId`, `createdAt` DESC) -- for user detail page inline display
- `audit_log`: (`targetCollection`, `createdAt` DESC) -- for filtering by collection
- `audit_log`: (`action`, `createdAt` DESC) -- for filtering by action type
- `audit_log`: (`createdAt` DESC) -- for chronological browsing

## Implementation Notes

**Before/after capture pattern.** Every server route that updates a document should:
1. Read the current document state
2. Compute the fields that will change
3. Store only changed fields in `details.before` (current values) and `details.after` (new values)
4. Do NOT store the entire document -- only the diff. This keeps audit entries small and readable.

**Denormalized admin name.** Store `adminName` alongside `adminId` in every audit entry. This avoids a join when displaying audit logs. If the admin later changes their name, old entries retain the name at time of action (this is correct for audit purposes).

**Truncation for large diffs.** If a field value is longer than 500 characters (e.g., a long bio), truncate the stored before/after value to 500 chars with "..." suffix. The full value exists in the actual document.

**Action type icons.** Map each action to an icon for visual scanning: profile_edit (pencil), stipend_approve (check), payout_create (dollar), coverage_edit (grid), role_change (shield), settings_update (gear), photo_upload (camera).

**Immutability enforcement.** Firestore security rules for `audit_log`: `allow read: if isAdmin(); allow write: if false;`. Server uses Admin SDK which bypasses security rules, so it can write. No client can write, update, or delete audit entries.

## Dependencies

- **T-007 (User Management)** -- User profile update route must have audit logging integrated
- **T-008 (Coverage)** -- Coverage edit route should already create audit entries
- **T-009 (Stipend Processing)** -- Payout creation should already create audit entries
- **T-003 (Firestore Rules)** -- `audit_log` collection rules must be deployed

## Estimated Effort

- Server utility (audit.ts): **2 hours**
- Retrofit existing routes (verify + add before/after): **3 hours**
- AuditLogEntry + AuditDiffDisplay components: **3 hours**
- AuditLogList component + useAudit composable: **2 hours**
- Inline display on user detail + stipend detail pages: **2 hours**
- (Optional) Dedicated audit page: **3 hours**
- Testing (verify all 7 action types create entries): **2 hours**

**Total: ~17 hours (1.5-2 days)**
