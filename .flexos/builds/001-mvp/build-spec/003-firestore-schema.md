---
id: build-001-spec-firestore-schema
title: "Firestore Schema Build Spec"
description: "Gap analysis for Firestore security rules, collection schemas, indexes, and seed data"
type: build
subtype: build-spec
status: draft
sequence: 3
tags: [build, spec, database, firestore]
relatesTo: ["builds/001-mvp/config.md", "specs/018-database_users-collection.md", "specs/019-database_duty-logs-collection.md", "specs/020-database_chaplain-metrics-collection.md", "specs/021-database_coverage-schedules-collection.md", "specs/022-database_stipend-collections.md", "specs/023-database_chat-collections.md", "specs/024-database_audit-settings-collections.md", "docs/core/004-database.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Firestore Schema Build Spec

## What We Need

The database specs (018 through 024) define 10 Firestore collections with specific schemas, relationships, security rules, indexes, and query patterns:

| Collection | Spec Reference | Document Count |
|-----------|----------------|----------------|
| `users` | 018-database_users-collection.md | 50-200 |
| `duty_logs` | 019-database_duty-logs-collection.md | 500-5000/yr |
| `chaplain_metrics` | 020-database_chaplain-metrics-collection.md | 1000-10000/yr |
| `coverage_schedules` | 021-database_coverage-schedules-collection.md | 52/yr |
| `chaplain_payouts` | 022-database_stipend-collections.md | 50-200/mo |
| `stipend_records` | 022-database_stipend-collections.md | 50-200/mo |
| `chats` | 023-database_chat-collections.md | 100-500 |
| `chat_messages` | 023-database_chat-collections.md | 1000-50000 |
| `audit_log` | 024-database_audit-settings-collections.md | Growing |
| `app_settings` | 024-database_audit-settings-collections.md | 1 doc |

Security rules enforce a tiered model:
- **Financial collections** (`chaplain_payouts`, `stipend_records`): admin-only read/write, payouts are immutable (no update/delete)
- **Operational collections** (`users`, `duty_logs`, `coverage_schedules`): authenticated read, admin write
- **Chat collections**: read-only from admin dashboard (no client writes)
- **Audit log**: admin read, server-write only (client writes blocked)

## What Nuxt 4 Provides

- **Firestore client SDK** via nuxt-vuefire: `useCollection()`, `useDocument()` composables with real-time listeners
- **Firebase Admin SDK** on server: batch writes, server timestamps, admin-level access for API routes
- **Firebase CLI** for deploying `firestore.rules` and `firestore.indexes.json`
- **TypeScript** throughout -- interfaces can be shared between client and server

## The Gap

1. **`firestore.rules`** -- complete security rules file covering all 10 collections with `isAuthenticated()` and `isAdmin()` helper functions, field-level validation for self-updates on `users`, and immutability enforcement on `chaplain_payouts`
2. **`firestore.indexes.json`** -- composite indexes for all multi-field queries: `users` (role+name, onDuty+isChaplain, createdAt desc), `duty_logs` (userId+startTime, isPaid+startTime), `chaplain_metrics` (dateCollected desc), `chaplain_payouts` (chaplainId+createdAt)
3. **`types/firestore.ts`** -- TypeScript interfaces for all 10 collections, matching spec schemas exactly. Used by both client composables and server API routes.
4. **Seed data** -- test admin user, 5-10 test chaplains with varied roles/terminals, sample duty logs, one `app_settings/config` document with `stipendRate` and `adminUserIds`
5. **`scripts/seed.ts`** -- Node script using Admin SDK to populate test data (runs locally, not deployed)

## Component Mapping

| File | Type | Purpose |
|------|------|---------|
| `firestore.rules` | Config | Security rules for all 10 collections |
| `firestore.indexes.json` | Config | Composite indexes for query performance |
| `types/firestore.ts` | TypeScript | Shared interfaces for all collections |
| `scripts/seed.ts` | Script | Test data seeder using Admin SDK |
| `firebase.json` | Config | Firebase CLI config pointing to rules/indexes |

### Core TypeScript Interfaces

```typescript
// types/firestore.ts -- key interfaces (see spec 018-024 for full schemas)

export interface User {
  uid: string
  email: string
  displayName: string
  role: 'admin' | 'chaplain' | 'intern' | 'support'
  isChaplain: boolean
  onDuty: boolean
  terminals: string[]
  // ... 20+ fields per spec 018
}

export interface DutyLog {
  userId: string
  startTime: Timestamp
  endTime?: Timestamp
  totalHours?: number
  isPaid: boolean
  payoutId?: string
  // ... per spec 019
}

export interface AppSettings {
  adminUserIds: string[]
  stipendRate: number
  currentYear: number
}
```

## Data Requirements

### Required Indexes (firestore.indexes.json)

```
users:          role ASC, displayName ASC
users:          isChaplain ASC, displayName ASC
users:          onDuty ASC, isChaplain ASC
users:          createdAt DESC
duty_logs:      userId ASC, startTime DESC
duty_logs:      isPaid ASC, startTime DESC
chaplain_metrics: dateCollected DESC
chaplain_payouts: chaplainId ASC, createdAt DESC
stipend_records:  chaplainId ASC, year DESC, monthName ASC
audit_log:      createdAt DESC
```

### Seed Data Requirements

- 1 `app_settings/config` doc: `{ adminUserIds: ['test-admin-uid'], stipendRate: 120, currentYear: 2026 }`
- 1 admin user + 8 chaplain users with varied terminals, languages, and on-duty states
- 20 duty logs spread across chaplains (some paid, some unpaid)
- 10 chaplain_metrics entries (encounter records)
- 1 coverage_schedules document for the current week

## Implementation Notes

- **Security rules `isAdmin()` helper** uses `get()` to read `app_settings/config` on every write. This costs 1 Firestore read per security rule evaluation. At COMPASS scale (~50 writes/day) this is negligible.
- **`chaplain_payouts` immutability** -- rules allow `create` for admins but block `update` and `delete` entirely. Once a payout record is written, it can never be modified. This is a financial integrity requirement.
- **Field-level validation on `users`** -- non-admin users can update only their own profile with a restricted field set (displayName, phoneNumber, bio, photoUrl, currentStatus, location, lastActiveAt). The `onlyUpdatingAllowedFields()` rule helper enforces this.
- **Deploy rules and indexes separately** from app code: `firebase deploy --only firestore:rules,firestore:indexes`. This happens once during setup and again after any rule changes.
- **Test rules manually** in Firebase Console's Rules Playground before deploying. Verify: unauthenticated read fails, non-admin write to `chaplain_payouts` fails, admin write succeeds.

## Dependencies

- **T-001 (Project scaffolding)** must be complete -- Firebase CLI installed, `firebase.json` configured
- Firebase project created with Firestore in production mode
- Service account key available for seed script
