---
id: features-audit-log
title: "Audit Log"
description: "Automatic logging of all administrative actions with before/after values for accountability and compliance"
type: spec
subtype: features
status: draft
sequence: 10
tags: [features, audit, compliance, p1]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, docs/core/004-database.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Audit Log

## Overview

The Audit Log feature provides a comprehensive, tamper-proof record of all administrative actions performed in COMPASS. Every profile edit, stipend approval, payout creation, coverage schedule change, role modification, and settings update is automatically logged with:
- **Who** performed the action (admin UID + display name)
- **What** was changed (collection, document ID, action type)
- **When** it happened (server timestamp, millisecond precision)
- **Details** of the change (before/after values for edits)

This feature addresses a critical gap in the original FlutterFlow app: zero accountability. The original had no audit trail whatsoever. When a chaplain's stipend amount was incorrect, there was no way to determine who made the error or when. COMPASS logs every write operation to provide transparency and accountability.

## Business Context

Chaplaincy programs handle sensitive operational data:
- **Financial records:** Stipend payments totaling $50,000-$200,000 annually
- **Personnel data:** Role assignments, contact information, performance notes
- **Coverage commitments:** Promises to airport authorities about chaplain availability

When discrepancies arise (a chaplain disputes a payment amount, a coverage gap is questioned, a role change is contested), the audit log provides definitive answers. It's also essential for:
- **Compliance:** Grant funders and airport authorities may request evidence of operational integrity
- **Training:** New admins can review past decisions to understand workflow patterns
- **Incident investigation:** When something goes wrong, the audit log is the first place to look

## Core Functionality

### 1. Automatic Logging (Server-Side)

**Mechanism:** All write operations that modify Firestore data go through Nuxt server API routes (not direct client writes). Each API route includes audit logging as part of the write transaction.

**Logged actions:**
- `profile_edit` -- Changes to user profile fields (name, email, role, terminals, etc.)
- `stipend_approve` -- Duty log marked as approved
- `payout_create` -- chaplain_payouts record created
- `coverage_edit` -- Coverage schedule slot toggled
- `role_change` -- User role updated (e.g., intern promoted to chaplain)
- `settings_update` -- app_settings configuration changed
- `photo_upload` -- Profile photo updated

**Not logged:**
- Read operations (too noisy, no compliance value)
- Automated system operations (e.g., Firestore listener refreshes)
- Login/logout events (handled by Firebase Auth audit logs, separate system)

**Atomicity:** Audit log writes are part of Firestore batch transactions. If the primary operation fails, the audit entry is not written. This ensures the audit log never contains entries for operations that didn't complete.

### 2. Audit Log Schema

**Collection:** `audit_log`

**Document structure:**
```typescript
{
  action: 'profile_edit' | 'stipend_approve' | 'payout_create' | 'coverage_edit' | 'role_change' | 'settings_update' | 'photo_upload',
  adminId: string,              // Firebase Auth UID of the admin
  adminName: string,             // Denormalized display name for quick display
  targetId: string,              // Document ID of the affected record
  targetCollection: string,      // Collection name (e.g., 'users', 'duty_logs')
  details: {
    before?: Record<string, any>,  // Previous values (for edits)
    after?: Record<string, any>,   // New values (for edits)
    summary?: string               // Human-readable description
  },
  createdAt: Timestamp           // Server timestamp (immutable)
}
```

**Example entries:**

**Profile edit:**
```json
{
  "action": "profile_edit",
  "adminId": "abc123def456",
  "adminName": "Linda Martinez",
  "targetId": "chaplain-xyz",
  "targetCollection": "users",
  "details": {
    "before": { "email": "old@example.com", "terminals": ["A", "B"] },
    "after": { "email": "new@example.com", "terminals": ["A", "B", "C"] },
    "summary": "Updated email and added Terminal C"
  },
  "createdAt": "2026-02-09T14:23:45.123Z"
}
```

**Payout creation:**
```json
{
  "action": "payout_create",
  "adminId": "abc123def456",
  "adminName": "Linda Martinez",
  "targetId": "payout-789",
  "targetCollection": "chaplain_payouts",
  "details": {
    "summary": "Created payout for Chaplain Rodriguez: $340 (4 shifts + $20 adjustment), check CHK-2026-0147"
  },
  "createdAt": "2026-02-09T15:10:22.987Z"
}
```

**Coverage edit:**
```json
{
  "action": "coverage_edit",
  "adminId": "abc123def456",
  "adminName": "Linda Martinez",
  "targetId": "week-6-2026",
  "targetCollection": "coverage_schedules",
  "details": {
    "before": { "monday.14": false },
    "after": { "monday.14": true },
    "summary": "Marked Monday 2 PM as covered"
  },
  "createdAt": "2026-02-09T09:45:12.456Z"
}
```

### 3. Audit Log Browser (Future v1.1)

While audit entries are created in Phase 3, the **dedicated audit log browser page** is deferred to v1.1. In v1.0, admins can view audit entries via:
- **Settings page:** Show recent audit entries related to settings changes
- **User detail page:** Show audit entries for that specific user (profile edits, role changes)
- **Stipend detail page:** Show audit entries for that specific payout

A full-featured `/audit-log` page with filtering (by admin, action type, date range, collection) and search (by summary text) is a natural v1.1 enhancement.

### 4. Audit Entry Display Component

**Reusable component:** `AuditLogEntry.vue`

**Props:**
- `entry` (AuditLogEntry object)
- `compact` (boolean, default false) -- Show abbreviated version

**Display format (full):**
```
[Icon based on action type] [Admin Name] [Action Verb] [Target]
[Timestamp]
[Details expansion: before/after diff or summary]
```

**Example rendering:**
```
✏️ Linda Martinez edited Chaplain Rodriguez's profile
Feb 9, 2026 at 2:23 PM
Changed: email (old@example.com → new@example.com), terminals (A, B → A, B, C)
```

**Compact format (for sidebars):**
```
Linda Martinez • profile_edit • 2 hours ago
```

### 5. Before/After Diff Display

For actions with `before` and `after` values, display a clear visual diff:

**Field-by-field comparison:**
```
Email
  Before: old@example.com
  After:  new@example.com

Terminals
  Before: A, B
  After:  A, B, C (added C)
```

**Color coding:**
- Removed values: Red text with strikethrough
- Added values: Green text
- Changed values: Yellow highlight

## Acceptance Criteria

**Given** an admin edits a user profile,
**When** they save the changes,
**Then** an audit log entry is created with action `profile_edit`, the admin's UID and name, the user document ID, and before/after values for all changed fields.

**Given** an admin creates a payout,
**When** the payout transaction completes,
**Then** an audit log entry is created with action `payout_create`, the payout document ID, and a summary including chaplain name, amount, and check number.

**Given** an admin toggles a coverage schedule slot,
**When** the Firestore write succeeds,
**Then** an audit log entry is created with action `coverage_edit`, the coverage document ID, and before/after values for the toggled slot.

**Given** an admin updates a system setting,
**When** they save the settings,
**Then** an audit log entry is created with action `settings_update`, the setting field name, and before/after values.

**Given** an audit log write fails (network error, permission denied),
**When** the primary operation is in a batch transaction with the audit entry,
**Then** the primary operation is also rolled back (atomicity guarantee).

**Given** an admin views a user detail page,
**When** the page loads,
**Then** a sidebar section shows the 5 most recent audit log entries for that user with timestamps and admin names.

**Given** a non-admin user attempts to read the `audit_log` collection,
**When** they query Firestore,
**Then** the security rules deny access (admins only).

## Edge Cases

### High-Volume Logging
- **Scenario:** An admin bulk-processes 100 stipend payouts, creating 100 audit entries in 10 seconds.
- **Impact:** Audit log collection grows quickly. Monitor collection size.
- **Mitigation:** In v1.1+, implement log rotation (archive entries older than 2 years to Cloud Storage).

### Large Before/After Diffs
- **Scenario:** An admin uploads a new bio (500 words) for a chaplain. The before/after diff is very long.
- **Truncation strategy:** Store full diff but display first 200 characters in compact view with "Show full diff" expansion.

### Deleted Target Documents
- **Scenario:** A user profile is deleted (rare, but possible). Audit entries reference a now-missing document ID.
- **Display:** Show `targetId` as plain text with a note: "(User record no longer exists)".

### Anonymous Admin Actions
- **Scenario:** An admin account is deleted, but their audit entries remain.
- **Display:** Show `adminName` as stored (denormalized), even if the UID no longer exists. Note: "(Admin account no longer active)".

## Mobile Considerations

**Audit log entries on mobile:** Compact format by default. Tap to expand for full details. Before/after diffs stack vertically (field name on first line, before/after on subsequent lines).

**Touch targets:** Each audit entry row is minimum 56px height for comfortable tap-to-expand.

## Performance Requirements

- **Audit write latency:** Adds <100ms to any write operation (batch write overhead)
- **Audit query (user detail sidebar):** Fetch 5 most recent entries in under 500ms
- **Collection growth:** Plan for 10,000-50,000 entries per year (manageable in Firestore)

## Security & Privacy

- **Admin-only read access:** Firestore rule: `allow read: if isAdmin()`
- **Server-only writes:** Firestore rule: `allow write: if false` (client cannot write)
- **Server-side enforcement:** All audit writes happen in Nuxt API routes using Firebase Admin SDK
- **Immutable entries:** Once created, audit log entries are never modified or deleted (integrity guarantee)
- **PII in logs:** Audit entries may contain email addresses and names. Treat the audit log as sensitive data. Do not export to untrusted systems.

## Future Enhancements (v1.1+)

- **Dedicated audit log page:** `/audit-log` with advanced filtering (admin, action type, date range, collection, summary text search)
- **Audit log export:** Download audit entries as CSV for external archival or compliance reporting
- **Retention policy:** Automatically archive entries older than 2 years to Cloud Storage (reduce active collection size)
- **Audit alerts:** Email notification when critical actions occur (e.g., admin role granted, stipend rate changed)
- **Revert operation:** For certain actions (e.g., profile edits), provide a "Revert to previous value" button that uses the audit log's `before` data
- **Visual timeline:** Chart showing audit activity over time (frequency heatmap, action type distribution)
- **Compliance reports:** Pre-formatted reports for auditors (e.g., "All stipend payouts created in Q4 2026")
