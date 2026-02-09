---
id: core-database
title: "Database"
description: "Complete Firestore schema, relationships, query patterns, indexes, and security rules for COMPASS"
type: doc
subtype: core
status: draft
sequence: 4
tags: [core, database]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Database

## Collection Inventory

| Collection | Purpose | Est. Doc Count | Read Frequency | Write Frequency |
|-----------|---------|----------------|----------------|-----------------|
| `users` | All system users: chaplains, interns, support, admins | 50-200 | Very High (every page) | Low (profile edits) |
| `duty_logs` | Individual shift clock-in/clock-out records | 500-5000/year | High (dashboard, duty days, stipends) | Medium (clock events from chaplain app) |
| `chaplain_metrics` | Encounter records: crisis, prayer, grief, etc. | 1000-10000/year | Medium (reports, dashboard) | Medium (chaplain app submissions) |
| `coverage_schedules` | Weekly coverage grids (one doc per week) | 52/year | Medium (dashboard, coverage page) | Low (admin edits) |
| `chaplain_payouts` | Immutable payout transaction records | 50-200/month | Medium (stipend pages) | Low (monthly processing) |
| `stipend_records` | Per-chaplain per-month stipend summaries | 50-200/month | Medium (stipend history) | Low (monthly processing) |
| `chats` | 1:1 chat room metadata | 100-500 | Low (chat monitoring) | Low (created by chaplain app) |
| `chat_messages` | Individual chat messages (subcollection of chats) | 1000-50000 | Low (chat detail view) | None (admin is read-only) |
| `audit_log` | Administrative action trail | Growing (all admin writes) | Low (audit review) | High (every admin action) |
| `app_settings` | System configuration (single document) | 1 | Low (settings page, stipend calc) | Very Low (config changes) |

## Entity Relationship Diagram

```
                         ┌─────────────────┐
                         │   app_settings   │
                         │  (single doc)    │
                         └─────────────────┘

┌──────────┐     ┌────────────┐     ┌───────────────────┐
│  users   │────<│ duty_logs  │────<│  chaplain_payouts  │
│          │     │            │     │                     │
│  uid     │     │  userId    │     │  chaplainId         │
│  role    │     │  payoutId ─┼────>│  dutyLogIds         │
│  ...     │     │  ...       │     │  createdBy ────────>│users│
└────┬─────┘     └────────────┘     └───────────────────┘
     │
     ├──────────<┌──────────────────┐
     │           │ chaplain_metrics │
     │           │                  │
     │           │  chaplainId      │
     │           │  encounterType   │
     │           │  ...             │
     │           └──────────────────┘
     │
     ├──────────<┌──────────────────┐
     │           │ stipend_records  │
     │           │                  │
     │           │  chaplainId      │
     │           │  processedBy ───>│users│
     │           │  ...             │
     │           └──────────────────┘
     │
     ├──────────<┌──────────┐     ┌────────────────┐
     │           │  chats   │────<│ chat_messages   │
     │           │          │     │  (subcollection) │
     │           │  userA   │     │  chatId          │
     │           │  userB   │     │  userId           │
     │           └──────────┘     └────────────────┘
     │
     └──────────<┌─────────────────────┐
                 │  audit_log           │
                 │                      │
                 │  adminId             │
                 │  targetCollection    │
                 │  targetId            │
                 └─────────────────────┘

┌──────────────────────┐
│ coverage_schedules   │
│  (standalone)        │
│  weekNumber + year   │
│  slots: { day: {h} } │
└──────────────────────┘
```

## Full Schema

### users

```typescript
interface User {
  // Identity
  uid: string                    // Firebase Auth UID (document ID matches this)
  email: string                  // Email address
  displayName: string            // Full display name
  photoUrl?: string              // Firebase Storage URL for profile photo
  phoneNumber?: string           // Phone number
  bio?: string                   // Biography in primary language
  translatedBios?: Record<string, string>  // { es: "...", fr: "...", ko: "..." }
  language?: string              // Preferred language code (ISO 639-1)
  title?: string                 // Professional title ("Chaplain", "Senior Chaplain", etc.)

  // Roles & Status
  role: 'admin' | 'chaplain' | 'intern' | 'support'
  isChaplain: boolean            // Active chaplain flag
  isIntern: boolean              // Intern chaplain flag
  isSupportMember: boolean       // Support staff flag
  isAfterHours: boolean          // Available for after-hours duty
  terminals: string[]            // Assigned terminals: ['A', 'B', 'C', 'D', 'E']

  // Live Status
  onDuty: boolean                // Currently clocked in
  currentStatus?: string         // Free-text status ("Available", "In chapel", etc.)
  location?: { lat: number, lng: number }  // Current GPS (from chaplain app)
  totalTime?: number             // Accumulated all-time duty hours

  // Timestamps
  createdAt: Timestamp           // Account creation
  lastActiveAt?: Timestamp       // Last activity in any system
  adminEditedAt?: Timestamp      // Last admin edit (audit)
  adminEditedBy?: string         // UID of admin who last edited
}
```

### duty_logs

```typescript
interface DutyLog {
  // Core
  userId: string                 // Reference to users.uid
  startTime: Timestamp           // Shift start
  endTime?: Timestamp            // Shift end (null = still on duty)
  totalHours?: number            // Calculated hours (endTime - startTime)

  // Location
  startLocation?: { lat: number, lng: number }
  endLocation?: { lat: number, lng: number }

  // Calendar
  dayName?: string               // "Monday", "Tuesday", etc.
  week?: number                  // ISO week number
  year?: number                  // Year
  hours?: number[]               // Hour slots covered (e.g., [5, 6, 7] for 5-7 AM)

  // Approval & Payment
  approved: boolean              // Admin-approved shift
  isPaid: boolean                // Payment processed
  paymentAmount?: number         // Dollar amount paid
  paymentStatus?: 'pending' | 'approved' | 'paid'
  adjustmentAmount?: number      // Positive or negative adjustment
  hasAdjustment: boolean         // Whether adjustment was applied
  checkNumber?: string           // Paper check reference
  payoutId?: string              // Reference to chaplain_payouts doc
  processedBy?: string           // Admin UID who processed payment
  processedAt?: Timestamp        // When payment was processed
}
```

### chaplain_metrics

```typescript
interface ChaplainMetric {
  // Core
  chaplainId: string             // Reference to users.uid
  dateCollected: Timestamp       // When encounter occurred
  dateEntered?: Timestamp        // When record was entered

  // Location
  terminal?: string              // 'A' | 'B' | 'C' | 'D' | 'E'
  gate?: string                  // Gate identifier
  inChapel: boolean              // Encounter in chapel space

  // Encounter Classification
  encounterType: {
    crisis: boolean
    violence: boolean
    policeInvolved: boolean
    grief: boolean
    travelRelated: boolean
    personalIssue: boolean
    prayerRequested: boolean
    fallenAngel: boolean         // Airport-specific term
  }

  // Encounter Medium
  encounterMedium: {
    inPerson: boolean
    byPhone: boolean
    chatOnly: boolean
    selfDiscovered: boolean      // Chaplain initiated contact
  }

  // Details
  recipientType?: string         // 'traveler' | 'employee' | 'crew' | 'vendor' | 'other'
  personsInvolved?: number       // Count of persons in encounter
  isAdult: boolean               // Adult vs. minor
  eventNarrative?: string        // Detailed narrative
  note?: string                  // Short notes
  images?: string[]              // Image URLs
  durationMinutes?: number       // Duration in minutes
  timeEnded?: Timestamp          // Encounter end time

  // Training
  isTrainingSession: boolean
  trainingFeedback?: string

  // Intern Evaluation
  internEvaluation?: {
    name: string
    isShadowing: boolean
    isAssisting: boolean
    initiative: number           // 1-5 scale
    pastoralDemeanor: number     // 1-5 scale
    pluralisticCompetence: number // 1-5 scale
    situationalAwareness: number  // 1-5 scale
    feedback: string
  }
}
```

### coverage_schedules

```typescript
interface CoverageSchedule {
  weekNumber: number             // ISO week number (1-53)
  year: number                   // Year
  slots: {
    monday:    Record<string, boolean>  // { "5": true, "6": false, ... "21": true }
    tuesday:   Record<string, boolean>
    wednesday: Record<string, boolean>
    thursday:  Record<string, boolean>
    friday:    Record<string, boolean>
    saturday:  Record<string, boolean>
    sunday:    Record<string, boolean>
  }
  updatedAt?: Timestamp
  updatedBy?: string             // Admin UID
}
// Note: Hours are 5 through 21 (5 AM to 9 PM) = 17 slots per day, 119 total per week.
// This is a normalized replacement for the original 119 flat boolean fields.
```

### chaplain_payouts

```typescript
interface ChaplainPayout {
  chaplainId: string             // Reference to users.uid
  payoutAmount: number           // Total dollars paid
  dutyLogIds: string[]           // Array of duty_log document IDs
  dutyLogCount: number           // Count of included duty logs
  checkNumber?: string           // Paper check number
  transactionId?: string         // Electronic payment reference
  isPaid: boolean                // Whether check/payment was issued
  monthPaid: string              // "January", "February", etc.
  yearPaid: number               // 2026, etc.
  createdAt: Timestamp           // When payout record was created
  createdBy: string              // Admin UID who created it
}
// IMMUTABLE: Once created, payout records should never be edited.
// Corrections are made by creating new payout records, not modifying old ones.
```

### stipend_records

```typescript
interface StipendRecord {
  chaplainId: string             // Reference to users.uid
  chaplainName: string           // Denormalized for display efficiency
  monthName: string              // "January", "February", etc.
  year: number                   // 2026, etc.
  startDate: Timestamp           // Period start
  endDate: Timestamp             // Period end
  instancesAuthorized: number    // Qualifying shift count
  instancesPaid?: number         // Actually paid shift count
  stipendAmount?: number         // Total paid for this period
  adjustmentAmount?: number      // Total adjustments
  hasAdjustment: boolean         // Whether any adjustments applied
  isCompleted: boolean           // Period finalized
  completedAt?: Timestamp        // When finalized
  processedBy?: string           // Admin UID
}
```

### chats

```typescript
interface Chat {
  userA: string                  // First participant UID
  userB: string                  // Second participant UID
  userALanguage?: string         // Language code for translation
  lastMessage?: string           // Preview text
  lastMessageTime?: Timestamp    // Last message timestamp
  lastMessageSentBy?: string     // Sender UID
  lastMessageSeenBy?: string[]   // UIDs who have seen it
  createdAt: Timestamp
}
```

### chat_messages (subcollection of chats)

```typescript
interface ChatMessage {
  chatId: string                 // Parent chat document ID
  userId: string                 // Sender UID
  text?: string                  // Message text
  image?: string                 // Image URL
  video?: string                 // Video URL
  createdAt: Timestamp
}
```

### audit_log

```typescript
interface AuditLogEntry {
  action: 'profile_edit' | 'stipend_approve' | 'payout_create' | 'coverage_edit' | 'role_change' | 'settings_update' | 'photo_upload'
  adminId: string                // Admin who performed the action
  targetId?: string              // Affected document ID
  targetCollection?: string      // Affected collection name
  details?: {
    before?: Record<string, any> // Previous values (for edits)
    after?: Record<string, any>  // New values (for edits)
    summary?: string             // Human-readable description
  }
  createdAt: Timestamp
}
```

### app_settings (single document: `config`)

```typescript
interface AppSettings {
  baseStipendRate: number        // Default: 80 (dollars per shift)
  programYear: number            // Current program year (e.g., 2026)
  adminUserIds: string[]         // UIDs with admin access
  defaultPhotoUrl?: string       // Default avatar URL for new users
  orgName: string                // "DFW Airport Interfaith Chaplaincy"
  supportEmail?: string          // Support contact
  updatedAt: Timestamp
  updatedBy: string
}
```

## Query Patterns

### Dashboard Page
| Query | Collection | Filters | Order | Limit | Real-time? |
|-------|-----------|---------|-------|-------|-----------|
| Total user count | users | - | - | - | Yes (listener) |
| Active chaplain count | users | isChaplain == true | - | - | Yes |
| Currently on duty | users | onDuty == true, isChaplain == true | displayName asc | 50 | Yes |
| New signups (7d) | users | createdAt > 7 days ago | - | - | Yes |
| New signups (30d) | users | createdAt > 30 days ago | - | - | Yes |
| Recent duty logs | duty_logs | - | startTime desc | 10 | Yes |
| Encounter count (7d) | chaplain_metrics | dateCollected > 7 days ago | - | - | Yes |
| Current week coverage | coverage_schedules | weekNumber == X, year == Y | - | 1 | Yes |

### Users Page
| Query | Collection | Filters | Order | Limit |
|-------|-----------|---------|-------|-------|
| All users | users | - | displayName asc | 50 (paginated) |
| Chaplains only | users | isChaplain == true | displayName asc | 50 |
| Interns only | users | isIntern == true | displayName asc | 50 |
| Support staff | users | isSupportMember == true | displayName asc | 50 |
| Search by name | users | displayName >= term, displayName <= term + '\uf8ff' | displayName asc | 50 |

### Stipends Page
| Query | Collection | Filters | Order | Limit |
|-------|-----------|---------|-------|-------|
| Unpaid duty logs in period | duty_logs | isPaid == false, startTime >= periodStart, startTime <= periodEnd | userId asc, startTime asc | 500 |
| Chaplain payouts for period | chaplain_payouts | monthPaid == X, yearPaid == Y | createdAt desc | 100 |
| Stipend records for period | stipend_records | year == Y, monthName == X | chaplainName asc | 100 |
| Chaplain YTD total | chaplain_payouts | chaplainId == X, yearPaid == Y | - | - |

### Reports Page
| Query | Collection | Filters | Order | Limit |
|-------|-----------|---------|-------|-------|
| Encounters in date range | chaplain_metrics | dateCollected >= start, dateCollected <= end | dateCollected desc | 1000 (paginated) |
| Encounters by terminal | chaplain_metrics | terminal == X, dateCollected >= start | dateCollected desc | 500 |
| Duty hours in range | duty_logs | startTime >= start, startTime <= end | startTime desc | 1000 |

## Index Strategy

Firestore requires composite indexes for queries with multiple inequality or range filters. Required indexes:

```
// users
users: role ASC, displayName ASC
users: isChaplain ASC, displayName ASC
users: onDuty ASC, isChaplain ASC
users: createdAt DESC

// duty_logs
duty_logs: userId ASC, startTime DESC
duty_logs: isPaid ASC, startTime ASC, startTime DESC
duty_logs: year ASC, week ASC, userId ASC
duty_logs: startTime DESC

// chaplain_metrics
chaplain_metrics: chaplainId ASC, dateCollected DESC
chaplain_metrics: terminal ASC, dateCollected DESC
chaplain_metrics: dateCollected DESC

// coverage_schedules
coverage_schedules: weekNumber ASC, year ASC

// chaplain_payouts
chaplain_payouts: chaplainId ASC, yearPaid DESC
chaplain_payouts: monthPaid ASC, yearPaid ASC
chaplain_payouts: yearPaid DESC, createdAt DESC

// stipend_records
stipend_records: chaplainId ASC, year DESC, monthName ASC
stipend_records: year ASC, monthName ASC
stipend_records: isCompleted ASC, year ASC

// audit_log
audit_log: adminId ASC, createdAt DESC
audit_log: targetCollection ASC, targetId ASC, createdAt DESC
audit_log: action ASC, createdAt DESC

// chat_messages (subcollection)
chat_messages: chatId ASC, createdAt ASC

// chats
chats: userA ASC, lastMessageTime DESC
chats: userB ASC, lastMessageTime DESC
```

## Security Rules

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Is the request from an authenticated user?
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: Is the requesting user an admin?
    function isAdmin() {
      return isAuthenticated()
        && get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
    }

    // Helper: Is the user accessing their own document?
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // users: Admins can read/write. Users can read own profile.
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // duty_logs: Admins can read/write. Chaplains can create their own.
    match /duty_logs/{logId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    // chaplain_metrics: Admins can read. Chaplains can create their own.
    match /chaplain_metrics/{metricId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated() && request.resource.data.chaplainId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    // coverage_schedules: Admins only.
    match /coverage_schedules/{scheduleId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // chaplain_payouts: Admin read/create only. NEVER update or delete (immutable).
    match /chaplain_payouts/{payoutId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;  // Immutable
    }

    // stipend_records: Admin read/write.
    match /stipend_records/{recordId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    // chats: Admin read-only.
    match /chats/{chatId} {
      allow read: if isAdmin() || request.auth.uid in [resource.data.userA, resource.data.userB];
      allow write: if isAuthenticated() && request.auth.uid in [request.resource.data.userA, request.resource.data.userB];
    }

    // chat_messages: Admin read-only. Participants can create.
    match /chats/{chatId}/chat_messages/{messageId} {
      allow read: if isAdmin() || isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false;  // Append-only
    }

    // audit_log: Admin read. System write (via server-side API routes).
    match /audit_log/{entryId} {
      allow read: if isAdmin();
      allow write: if false;  // Written only from server-side (admin SDK)
    }

    // app_settings: Admin read/write.
    match /app_settings/{docId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Critical note on audit_log:** Audit log entries must be written from Nuxt server API routes using the Firebase Admin SDK, not from the client. This ensures they cannot be tampered with or bypassed. The client-side security rule is `allow write: if false` -- only the server can write audit entries.

## Inferred Collections

### app_settings
Already included above. The concept mentioned settings stored in SharedPreferences (Flutter local storage) with no centralized config. A single Firestore document (`app_settings/config`) replaces this with a server-synced, admin-editable configuration.

### audit_log
Already included above. The concept called out the need for an audit trail but the original app had none. Every admin write operation (profile edit, stipend processing, coverage change, role change) writes an audit entry from the server side.

### Potential Future: notification_preferences
If notifications are added in v2.0, a per-user notification preferences document would store channel preferences (email, push) and subscription topics (coverage gaps, new chaplain registration, stipend reminders).

### Potential Future: import_batches
If bulk user import (CSV) is added, an `import_batches` collection would track each import: file name, row count, success count, error details, imported-by admin, and timestamp. This provides an audit trail for bulk operations.
