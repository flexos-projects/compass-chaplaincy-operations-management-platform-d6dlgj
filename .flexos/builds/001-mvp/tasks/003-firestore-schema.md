---
id: build-001-task-003
title: "Firestore Schema & Security Rules"
description: "Create Firestore security rules, composite indexes, TypeScript interfaces for all 10 collections, seed admin and test chaplain data"
type: build
subtype: task
status: pending
sequence: 3
tags: [build, task, database]
relatesTo: ["builds/001-mvp/build-spec/001-project-setup.md", "docs/core/004-database.md", "specs/018-database_users-collection.md", "specs/019-database_duty-logs-collection.md", "specs/020-database_chaplain-metrics-collection.md", "specs/024-database_audit-settings-collections.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 003: Firestore Schema & Security Rules

## Objective

Define the complete Firestore data layer for COMPASS: TypeScript interfaces for all 10 collections, security rules that enforce admin-only writes on financial collections and server-only writes on the audit log, composite indexes for all query patterns, and seed data (admin user, test chaplains, initial app_settings config). After this task, the database is production-ready and locked down.

## Prerequisites

- Task 001 (Project Scaffolding) complete
- Firebase project created with Firestore enabled (from T-002)
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project linked (`firebase init` with Firestore selected)
- Admin user created in Firebase Auth (from T-002)

## Steps

### 1. Define TypeScript Interfaces

Create `app/types/firestore.ts`:

```typescript
import type { Timestamp } from 'firebase/firestore'

// ============================================
// USERS
// ============================================
export interface User {
  uid: string
  email: string
  displayName: string
  photoUrl?: string
  phoneNumber?: string
  bio?: string
  translatedBios?: Record<string, string>
  language?: string
  title?: string

  role: 'admin' | 'chaplain' | 'intern' | 'support'
  isChaplain: boolean
  isIntern: boolean
  isSupportMember: boolean
  isAfterHours: boolean
  terminals: string[]

  onDuty: boolean
  currentStatus?: string
  location?: { lat: number; lng: number }
  totalTime?: number

  createdAt: Timestamp
  lastActiveAt?: Timestamp
  adminEditedAt?: Timestamp
  adminEditedBy?: string
}

// ============================================
// DUTY LOGS
// ============================================
export interface DutyLog {
  userId: string
  startTime: Timestamp
  endTime?: Timestamp
  totalHours?: number

  startLocation?: { lat: number; lng: number }
  endLocation?: { lat: number; lng: number }

  dayName?: string
  week?: number
  year?: number
  hours?: number[]

  approved: boolean
  isPaid: boolean
  paymentAmount?: number
  paymentStatus?: 'pending' | 'approved' | 'paid'
  adjustmentAmount?: number
  hasAdjustment: boolean
  checkNumber?: string
  payoutId?: string
  processedBy?: string
  processedAt?: Timestamp
}

// ============================================
// CHAPLAIN METRICS (Encounters)
// ============================================
export interface ChaplainMetric {
  chaplainId: string
  dateCollected: Timestamp
  dateEntered?: Timestamp

  terminal?: string
  gate?: string
  inChapel: boolean

  encounterType: {
    crisis: boolean
    violence: boolean
    policeInvolved: boolean
    grief: boolean
    travelRelated: boolean
    personalIssue: boolean
    prayerRequested: boolean
    fallenAngel: boolean
  }

  encounterMedium: {
    inPerson: boolean
    byPhone: boolean
    chatOnly: boolean
    selfDiscovered: boolean
  }

  recipientType?: 'traveler' | 'employee' | 'crew' | 'vendor' | 'other'
  personsInvolved?: number
  isAdult: boolean
  eventNarrative?: string
  note?: string
  images?: string[]
  durationMinutes?: number
  timeEnded?: Timestamp

  isTrainingSession: boolean
  trainingFeedback?: string

  internEvaluation?: {
    name: string
    isShadowing: boolean
    isAssisting: boolean
    initiative: number
    pastoralDemeanor: number
    pluralisticCompetence: number
    situationalAwareness: number
    feedback: string
  }
}

// ============================================
// COVERAGE SCHEDULES
// ============================================
export interface CoverageSchedule {
  weekNumber: number
  year: number
  slots: {
    monday: Record<string, boolean>
    tuesday: Record<string, boolean>
    wednesday: Record<string, boolean>
    thursday: Record<string, boolean>
    friday: Record<string, boolean>
    saturday: Record<string, boolean>
    sunday: Record<string, boolean>
  }
  updatedAt?: Timestamp
  updatedBy?: string
}

// ============================================
// CHAPLAIN PAYOUTS (Immutable)
// ============================================
export interface ChaplainPayout {
  chaplainId: string
  payoutAmount: number
  dutyLogIds: string[]
  dutyLogCount: number
  checkNumber?: string
  transactionId?: string
  isPaid: boolean
  monthPaid: string
  yearPaid: number
  createdAt: Timestamp
  createdBy: string
}

// ============================================
// STIPEND RECORDS
// ============================================
export interface StipendRecord {
  chaplainId: string
  chaplainName: string
  monthName: string
  year: number
  startDate: Timestamp
  endDate: Timestamp
  instancesAuthorized: number
  instancesPaid?: number
  stipendAmount?: number
  adjustmentAmount?: number
  hasAdjustment: boolean
  isCompleted: boolean
  completedAt?: Timestamp
  processedBy?: string
}

// ============================================
// CHATS
// ============================================
export interface Chat {
  userA: string
  userB: string
  userALanguage?: string
  lastMessage?: string
  lastMessageTime?: Timestamp
  lastMessageSentBy?: string
  lastMessageSeenBy?: string[]
  createdAt: Timestamp
}

// ============================================
// CHAT MESSAGES (subcollection of chats)
// ============================================
export interface ChatMessage {
  chatId: string
  userId: string
  text?: string
  image?: string
  video?: string
  createdAt: Timestamp
}

// ============================================
// AUDIT LOG
// ============================================
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

export interface AuditLogEntry {
  action: AuditAction
  adminId: string
  targetId?: string
  targetCollection?: string
  details?: {
    before?: Record<string, any>
    after?: Record<string, any>
    summary?: string
    affectedCount?: number
    checkNumber?: string
    amount?: number
    [key: string]: any
  }
  createdAt: Timestamp
}

// ============================================
// APP SETTINGS (single document: "config")
// ============================================
export interface AppSettings {
  baseStipendRate: number
  programYear: number
  adminUserIds: string[]
  defaultPhotoUrl?: string
  orgName: string
  supportEmail?: string
  updatedAt: Timestamp
  updatedBy: string
}
```

### 2. Create Firestore Security Rules

Create `firestore.rules` at the project root:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // =========================================
    // HELPER FUNCTIONS
    // =========================================

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated()
        && get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // =========================================
    // USERS
    // =========================================
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // =========================================
    // DUTY LOGS
    // =========================================
    match /duty_logs/{logId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.isPaid == false
        && request.resource.data.approved == true;
      allow update, delete: if isAdmin();
    }

    // =========================================
    // CHAPLAIN METRICS
    // =========================================
    match /chaplain_metrics/{metricId} {
      allow read: if isAdmin()
        || (isAuthenticated() && resource.data.chaplainId == request.auth.uid);
      allow create: if isAuthenticated()
        && request.resource.data.chaplainId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    // =========================================
    // COVERAGE SCHEDULES
    // =========================================
    match /coverage_schedules/{scheduleId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // =========================================
    // CHAPLAIN PAYOUTS (Immutable)
    // =========================================
    match /chaplain_payouts/{payoutId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false;
    }

    // =========================================
    // STIPEND RECORDS
    // =========================================
    match /stipend_records/{recordId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    // =========================================
    // CHATS
    // =========================================
    match /chats/{chatId} {
      allow read: if isAdmin()
        || (isAuthenticated() && request.auth.uid in [resource.data.userA, resource.data.userB]);
      allow write: if isAuthenticated()
        && request.auth.uid in [request.resource.data.userA, request.resource.data.userB];
    }

    // =========================================
    // CHAT MESSAGES (subcollection)
    // =========================================
    match /chats/{chatId}/chat_messages/{messageId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    // =========================================
    // AUDIT LOG (server-side writes only)
    // =========================================
    match /audit_log/{entryId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // =========================================
    // APP SETTINGS
    // =========================================
    match /app_settings/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // =========================================
    // DENY EVERYTHING ELSE
    // =========================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 3. Create Composite Indexes

Create `firestore.indexes.json` at the project root:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "displayName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isChaplain", "order": "ASCENDING" },
        { "fieldPath": "displayName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "onDuty", "order": "ASCENDING" },
        { "fieldPath": "isChaplain", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "duty_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "startTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "duty_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isPaid", "order": "ASCENDING" },
        { "fieldPath": "startTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "duty_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "year", "order": "ASCENDING" },
        { "fieldPath": "week", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "chaplain_metrics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "chaplainId", "order": "ASCENDING" },
        { "fieldPath": "dateCollected", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chaplain_metrics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "terminal", "order": "ASCENDING" },
        { "fieldPath": "dateCollected", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chaplain_payouts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "chaplainId", "order": "ASCENDING" },
        { "fieldPath": "yearPaid", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chaplain_payouts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "monthPaid", "order": "ASCENDING" },
        { "fieldPath": "yearPaid", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "stipend_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "chaplainId", "order": "ASCENDING" },
        { "fieldPath": "year", "order": "DESCENDING" },
        { "fieldPath": "monthName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "stipend_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "year", "order": "ASCENDING" },
        { "fieldPath": "monthName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "audit_log",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "adminId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "audit_log",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetCollection", "order": "ASCENDING" },
        { "fieldPath": "targetId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "audit_log",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "action", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userA", "order": "ASCENDING" },
        { "fieldPath": "lastMessageTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userB", "order": "ASCENDING" },
        { "fieldPath": "lastMessageTime", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 4. Create Seed Data Script

Create `scripts/seed.ts`:

```typescript
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const serviceAccount = JSON.parse(process.env.NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT || '{}')

const app = initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore(app)
const auth = getAuth(app)

const ADMIN_EMAIL = 'admin@compassdemo.com'
const ADMIN_PASSWORD = 'CompassAdmin2026!'

const TEST_CHAPLAINS = [
  { displayName: 'Rev. Maria Rodriguez', email: 'maria@compassdemo.com', terminals: ['A', 'B'], title: 'Senior Chaplain' },
  { displayName: 'Pastor James Chen', email: 'james@compassdemo.com', terminals: ['C', 'D'], title: 'Chaplain' },
  { displayName: 'Rev. Sarah Okonkwo', email: 'sarah@compassdemo.com', terminals: ['A', 'E'], title: 'Chaplain' },
  { displayName: 'Father Michael Torres', email: 'michael@compassdemo.com', terminals: ['B', 'C'], title: 'Chaplain' },
  { displayName: 'Imam Hassan Ali', email: 'hassan@compassdemo.com', terminals: ['D', 'E'], title: 'Chaplain' },
  { displayName: 'Rabbi David Cohen', email: 'david@compassdemo.com', terminals: ['A'], title: 'Chaplain' },
  { displayName: 'Jennifer Park', email: 'jennifer@compassdemo.com', terminals: ['B', 'D'], title: 'Intern Chaplain' },
  { displayName: 'Marcus Williams', email: 'marcus@compassdemo.com', terminals: ['C'], title: 'Intern Chaplain' },
]

async function seed() {
  console.log('Seeding COMPASS database...\n')

  // 1. Create admin user in Firebase Auth
  let adminUid: string
  try {
    const adminUser = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'Admin User',
    })
    adminUid = adminUser.uid
    console.log(`Created admin user: ${adminUid}`)
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(ADMIN_EMAIL)
      adminUid = existing.uid
      console.log(`Admin user already exists: ${adminUid}`)
    } else {
      throw err
    }
  }

  // 2. Create admin user document
  await db.collection('users').doc(adminUid).set({
    uid: adminUid,
    email: ADMIN_EMAIL,
    displayName: 'Admin User',
    role: 'admin',
    isChaplain: false,
    isIntern: false,
    isSupportMember: false,
    isAfterHours: false,
    terminals: [],
    onDuty: false,
    createdAt: Timestamp.now(),
  })
  console.log('Created admin user document')

  // 3. Create app_settings/config
  await db.collection('app_settings').doc('config').set({
    baseStipendRate: 80,
    programYear: 2026,
    adminUserIds: [adminUid],
    orgName: 'DFW Airport Interfaith Chaplaincy',
    supportEmail: 'support@dfwaichaplains.org',
    updatedAt: Timestamp.now(),
    updatedBy: adminUid,
  })
  console.log('Created app_settings/config')

  // 4. Create test chaplain users
  for (const chaplain of TEST_CHAPLAINS) {
    let uid: string
    try {
      const authUser = await auth.createUser({
        email: chaplain.email,
        password: 'TestChaplain2026!',
        displayName: chaplain.displayName,
      })
      uid = authUser.uid
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        const existing = await auth.getUserByEmail(chaplain.email)
        uid = existing.uid
      } else {
        throw err
      }
    }

    const isIntern = chaplain.title === 'Intern Chaplain'

    await db.collection('users').doc(uid).set({
      uid,
      email: chaplain.email,
      displayName: chaplain.displayName,
      title: chaplain.title,
      role: isIntern ? 'intern' : 'chaplain',
      isChaplain: !isIntern,
      isIntern,
      isSupportMember: false,
      isAfterHours: false,
      terminals: chaplain.terminals,
      onDuty: false,
      createdAt: Timestamp.now(),
    })
    console.log(`Created chaplain: ${chaplain.displayName} (${uid})`)
  }

  console.log('\nSeed complete!')
  console.log(`\nAdmin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

### 5. Add Seed Script to package.json

Add to `package.json` scripts:

```json
{
  "scripts": {
    "seed": "npx tsx scripts/seed.ts"
  }
}
```

Install tsx if needed:

```bash
pnpm add -D tsx dotenv
```

### 6. Run Seed Script

```bash
pnpm seed
```

Verify in Firebase Console:
- `users` collection has 9 documents (1 admin + 8 chaplains)
- `app_settings/config` document exists with `adminUserIds` array
- Admin UID is in the `adminUserIds` array

### 7. Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

### 8. Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

Note: Index creation can take 5-10 minutes. Check the Firebase Console under Firestore > Indexes for build status.

### 9. Test Security Rules

In Firebase Console (Rules Playground) or via the running app:

1. **Unauthenticated read on users** -- should be DENIED
2. **Authenticated non-admin read on users** -- should be ALLOWED
3. **Authenticated non-admin write on users** -- should be DENIED
4. **Admin write on users** -- should be ALLOWED
5. **Any client write on audit_log** -- should be DENIED
6. **Any client update on chaplain_payouts** -- should be DENIED
7. **Admin create on chaplain_payouts** -- should be ALLOWED

### 10. Commit

```bash
git add .
git commit -m "feat: add Firestore schema, security rules, indexes, and seed data"
git push
```

## Acceptance Criteria

- [ ] `app/types/firestore.ts` defines interfaces for all 10 collections
- [ ] `firestore.rules` deployed with admin-only writes on financial collections
- [ ] `firestore.indexes.json` includes all composite indexes (17 indexes)
- [ ] `audit_log` has `allow write: if false` (server-only writes)
- [ ] `chaplain_payouts` has `allow update, delete: if false` (immutable)
- [ ] `app_settings/config` document created with `baseStipendRate: 80` and `adminUserIds`
- [ ] Admin user exists in `users` collection with matching Auth UID
- [ ] 8 test chaplain users seeded with terminals and roles
- [ ] Security rules tested (unauthenticated read denied, admin write allowed)
- [ ] Indexes deployed and building (check Firebase Console)
- [ ] Seed script runs without errors (`pnpm seed`)

## Estimated Time

**1 day (8 hours)** including seed data creation, rules testing, and index deployment

## Files Created/Modified

### Created
- `app/types/firestore.ts`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/seed.ts`

### Modified
- `package.json` (seed script)

## Dependencies

**Depends on:** T-001 (Project Scaffolding)

## Next Task

**T-004: App layout (sidebar nav, COMPASS branding, responsive shell)**

After this task, the database is fully defined and secured. Next task builds the visual shell around the authenticated app.

## Troubleshooting

### Issue: "Missing or insufficient permissions" when reading users
**Solution:** Verify `app_settings/config` document exists and `adminUserIds` includes the current user's UID.

### Issue: Indexes stuck in "Building" state
**Solution:** Indexes can take up to 10 minutes. If stuck longer, check Firebase Console for errors. Delete and re-deploy if needed.

### Issue: Seed script fails with "Permission denied"
**Solution:** Verify `NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT` in `.env.local` is valid JSON and the service account has Firestore Admin permissions.

### Issue: Security rules fail for admin user
**Solution:** The `isAdmin()` helper reads `app_settings/config`. If that document does not exist, all admin checks fail. Seed it first.

## Notes

- The `audit_log` collection uses `allow write: if false` on purpose. All audit entries are written server-side via Firebase Admin SDK to prevent client-side tampering.
- `chaplain_payouts` are immutable by design. Once a payout record is created, it cannot be edited or deleted. Corrections are made by creating new payout records.
- The seed script uses `auth/email-already-exists` error handling so it can be run multiple times without duplicating data.
- Test chaplain passwords are the same for convenience. In production, use Firebase Auth invitations or password reset flow.
