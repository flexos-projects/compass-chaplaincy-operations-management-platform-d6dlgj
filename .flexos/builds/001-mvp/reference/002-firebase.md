---
id: build-001-ref-firebase
title: "Firebase Reference"
description: "Firebase patterns for Auth, Firestore, and Storage in COMPASS"
type: build
subtype: reference
status: draft
sequence: 2
tags: [build, reference, firebase]
relatesTo: ["docs/core/004-database.md", "docs/core/007-technical.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Firebase Reference

## Firebase Auth

### Email/Password Authentication

COMPASS uses email/password as the primary auth method in v1.

**Sign In:**
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth'

const auth = useFirebaseAuth()
try {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  const user = userCredential.user
  // Redirect to dashboard
  navigateTo('/')
} catch (error) {
  if (error.code === 'auth/wrong-password') {
    // Show error: "Invalid email or password"
  } else if (error.code === 'auth/user-not-found') {
    // Show error: "No account found with this email"
  }
}
```

**Sign Out:**
```typescript
import { signOut } from 'firebase/auth'

const auth = useFirebaseAuth()
await signOut(auth)
navigateTo('/login')
```

**Password Reset:**
```typescript
import { sendPasswordResetEmail } from 'firebase/auth'

const auth = useFirebaseAuth()
await sendPasswordResetEmail(auth, email)
// Show success: "Password reset email sent"
```

### Custom Claims for Roles

COMPASS uses `app_settings.adminUserIds` array instead of custom claims for simplicity. Custom claims could be added in v2:

```typescript
// Server-side only (Firebase Admin SDK)
import { adminAuth } from '~/server/utils/firebaseAdmin'

await adminAuth.setCustomUserClaims(uid, { admin: true })
```

### Token Verification (Server-Side)

```typescript
// server/utils/auth.ts
import { adminAuth } from './firebaseAdmin'

export async function verifyAdmin(event: any) {
  const token = event.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    throw createError({ statusCode: 401, message: 'No token provided' })
  }

  const decodedToken = await adminAuth.verifyIdToken(token)

  // Check admin status
  const settingsDoc = await adminDb.doc('app_settings/config').get()
  const adminUserIds = settingsDoc.data()?.adminUserIds || []

  if (!adminUserIds.includes(decodedToken.uid)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  return decodedToken
}
```

## Cloud Firestore

### Collection References

```typescript
const db = useFirestore()

// Get a collection reference
const usersRef = collection(db, 'users')

// Get a document reference
const userRef = doc(db, 'users', userId)

// Subcollection reference
const messagesRef = collection(db, 'chats', chatId, 'messages')
```

### Queries

**Basic query:**
```typescript
const usersQuery = query(
  collection(db, 'users'),
  where('isChaplain', '==', true),
  orderBy('displayName'),
  limit(50)
)
```

**Multiple conditions:**
```typescript
const onDutyQuery = query(
  collection(db, 'users'),
  where('isChaplain', '==', true),
  where('onDuty', '==', true)
)
// Requires composite index: isChaplain + onDuty
```

**Date range:**
```typescript
import { startOfMonth, endOfMonth } from 'date-fns'

const start = startOfMonth(new Date(2026, 0)) // Jan 1
const end = endOfMonth(new Date(2026, 0))     // Jan 31

const dutyLogsQuery = query(
  collection(db, 'duty_logs'),
  where('startTime', '>=', start),
  where('startTime', '<=', end),
  orderBy('startTime', 'desc')
)
```

**Array contains:**
```typescript
// Find users assigned to Terminal A
const terminalAQuery = query(
  collection(db, 'users'),
  where('terminals', 'array-contains', 'A')
)
```

**Pagination:**
```typescript
// First page
const firstPage = query(
  collection(db, 'users'),
  orderBy('displayName'),
  limit(50)
)

// Next page (using last document from previous page)
const nextPage = query(
  collection(db, 'users'),
  orderBy('displayName'),
  startAfter(lastDoc),
  limit(50)
)
```

### Real-Time Listeners (VueFire)

**Single document:**
```typescript
const db = useFirestore()
const userRef = doc(db, 'users', userId)
const user = useDocument(userRef)

// user.value updates automatically when Firestore changes
// user.pending is true while loading
// user.error contains any errors
```

**Collection/query:**
```typescript
const db = useFirestore()
const usersQuery = query(
  collection(db, 'users'),
  where('onDuty', '==', true)
)
const onDutyUsers = useCollection(usersQuery)

// onDutyUsers.value updates in real-time
// When a chaplain goes on duty, they appear automatically
```

**Computed from Firestore:**
```typescript
const onDutyCount = computed(() => onDutyUsers.value?.length || 0)
```

### Writes (Client-Side)

**Add document:**
```typescript
const db = useFirestore()
await addDoc(collection(db, 'audit_log'), {
  action: 'profile_edit',
  adminId: currentUser.value.uid,
  createdAt: serverTimestamp()
})
```

**Update document:**
```typescript
const userRef = doc(db, 'users', userId)
await updateDoc(userRef, {
  displayName: 'New Name',
  adminEditedAt: serverTimestamp(),
  adminEditedBy: currentUser.value.uid
})
```

**Update nested field:**
```typescript
// Update coverage slot: slots.monday.5 = true
const scheduleRef = doc(db, 'coverage_schedules', `${week}-${year}`)
await updateDoc(scheduleRef, {
  'slots.monday.5': true,
  updatedAt: serverTimestamp(),
  updatedBy: currentUser.value.uid
})
```

**Delete document:**
```typescript
await deleteDoc(doc(db, 'users', userId))
```

### Batch Writes (Server-Side)

For atomic operations (all succeed or all fail):

```typescript
// server/api/stipends/process.post.ts
import { adminDb } from '~/server/utils/firebaseAdmin'

const batch = adminDb.batch()

// Create payout record
const payoutRef = adminDb.collection('chaplain_payouts').doc()
batch.set(payoutRef, {
  chaplainId,
  payoutAmount,
  dutyLogIds,
  checkNumber,
  isPaid: true,
  createdAt: new Date(),
  createdBy: decodedToken.uid
})

// Update duty logs
dutyLogIds.forEach(logId => {
  const logRef = adminDb.doc(`duty_logs/${logId}`)
  batch.update(logRef, {
    isPaid: true,
    paymentAmount,
    payoutId: payoutRef.id,
    processedBy: decodedToken.uid,
    processedAt: new Date()
  })
})

// Create audit log
const auditRef = adminDb.collection('audit_log').doc()
batch.set(auditRef, {
  action: 'payout_create',
  adminId: decodedToken.uid,
  targetId: payoutRef.id,
  targetCollection: 'chaplain_payouts',
  createdAt: new Date()
})

// Commit all at once
await batch.commit()
```

**Batch limits:** Max 500 operations per batch.

### Transactions

For operations that depend on reading current state:

```typescript
const db = adminDb
await db.runTransaction(async (transaction) => {
  // Read
  const userDoc = await transaction.get(db.doc(`users/${userId}`))
  const currentHours = userDoc.data()?.totalTime || 0

  // Write based on read
  transaction.update(db.doc(`users/${userId}`), {
    totalTime: currentHours + newHours
  })
})
```

### Composite Indexes

Required for queries with multiple `where` clauses or `where` + `orderBy`:

```json
// firestore.indexes.json
{
  "indexes": [
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
        { "fieldPath": "startTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chaplain_payouts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "chaplainId", "order": "ASCENDING" },
        { "fieldPath": "yearPaid", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Deploy indexes:**
```bash
firebase deploy --only firestore:indexes
```

Firestore will create the indexes (can take several minutes for large collections).

### Security Rules

**Role-based access:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
    }

    // Admin-only write, authenticated read
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Admin-only (financial data)
    match /chaplain_payouts/{payoutId} {
      allow read, write: if isAdmin();
    }

    // Server-only write
    match /audit_log/{logId} {
      allow read: if isAdmin();
      allow write: if false; // Server-side only
    }
  }
}
```

**Field-level validation:**
```
match /users/{userId} {
  allow write: if isAdmin() &&
    request.resource.data.email is string &&
    request.resource.data.displayName is string &&
    request.resource.data.role in ['admin', 'chaplain', 'intern', 'support'];
}
```

**Deploy rules:**
```bash
firebase deploy --only firestore:rules
```

**Test rules in Firebase Console:**
- Go to Firestore → Rules → Rules Playground
- Simulate read/write as different users

## Firebase Storage

### Upload Profile Photo (Client-Side)

```typescript
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

const storage = useFirebaseStorage()

async function uploadPhoto(file: File, userId: string) {
  // Compress image first (client-side)
  const compressedFile = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.8 })

  // Upload to Storage
  const photoRef = storageRef(storage, `user-photos/${userId}/${Date.now()}.jpg`)
  const snapshot = await uploadBytes(photoRef, compressedFile)

  // Get download URL
  const downloadURL = await getDownloadURL(snapshot.ref)

  // Update Firestore user document
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    photoUrl: downloadURL,
    adminEditedAt: serverTimestamp()
  })

  return downloadURL
}
```

### Image Compression (Client-Side)

```typescript
function compressImage(file: File, options: { maxWidth: number, maxHeight: number, quality: number }): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Scale down if needed
        if (width > options.maxWidth || height > options.maxHeight) {
          const ratio = Math.min(options.maxWidth / width, options.maxHeight / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        }, 'image/jpeg', options.quality)
      }
      img.src = e.target.result as string
    }
    reader.readAsDataURL(file)
  })
}
```

### Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /user-photos/{userId}/{fileName} {
      // Only admins can upload/delete
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        firestore.get(/databases/(default)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
    }
  }
}
```

**Deploy rules:**
```bash
firebase deploy --only storage
```

## Firebase Admin SDK (Server-Side)

### Setup

```typescript
// server/utils/firebaseAdmin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let adminApp
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT)
  adminApp = initializeApp({
    credential: cert(serviceAccount)
  })
} else {
  adminApp = getApps()[0]
}

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
```

### Usage in API Routes

```typescript
// server/api/users/[id]/update.post.ts
import { adminAuth, adminDb } from '~/server/utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  // Verify token
  const token = event.headers.get('authorization')?.replace('Bearer ', '')
  const decodedToken = await adminAuth.verifyIdToken(token)

  // Update Firestore
  await adminDb.doc(`users/${id}`).update({
    ...body,
    adminEditedAt: new Date(),
    adminEditedBy: decodedToken.uid
  })

  return { success: true }
})
```

## COMPASS Firestore Schema

### Collections

| Collection | Description | Admin Write | Auth Read |
|-----------|-------------|-------------|----------|
| app_settings | System configuration (stipend rate, admin user IDs) | Server-only | Admin-only |
| users | All users (chaplains, interns, admins) | Admin | All auth |
| duty_logs | Shift clock-in/out records | Admin | All auth |
| chaplain_metrics | Encounter tracking (crisis, prayer, grief, etc.) | Admin | All auth |
| coverage_schedules | Weekly coverage grid (7x17 slots) | Admin | All auth |
| chaplain_payouts | Immutable payout records | Admin | Admin |
| stipend_records | Per-chaplain per-month stipend summaries | Admin | Admin |
| chats | Chat room metadata (read-only in dashboard) | None | All auth |
| chat_messages | Individual messages (read-only in dashboard) | None | All auth |
| audit_log | Admin action tracking | Server-only | Admin-only |

### Document ID Conventions

| Collection | ID Format | Example |
|-----------|-----------|---------|
| app_settings | Static (`config`) | `app_settings/config` |
| users | Firebase Auth UID | `users/abc123xyz` |
| duty_logs | Auto-generated | `duty_logs/xyz789` |
| chaplain_metrics | Auto-generated | `chaplain_metrics/met456` |
| coverage_schedules | `{weekNumber}-{year}` | `coverage_schedules/1-2026` |
| chaplain_payouts | Auto-generated | `chaplain_payouts/pay123` |
| stipend_records | Auto-generated | `stipend_records/rec789` |
| audit_log | Auto-generated | `audit_log/log456` |

### Date Storage

Use Firebase `serverTimestamp()` for creation timestamps:

```typescript
await addDoc(collection(db, 'audit_log'), {
  action: 'profile_edit',
  createdAt: serverTimestamp() // Server's timestamp, not client's
})
```

Use JavaScript `Date` objects for date range queries:

```typescript
const start = new Date(2026, 0, 1) // Jan 1, 2026
const query = query(
  collection(db, 'duty_logs'),
  where('startTime', '>=', start)
)
```

## Performance Best Practices

1. **Index all multi-field queries** -- Firestore will error if an index is missing
2. **Limit query results** -- Always use `.limit(50)` or pagination
3. **Detach listeners** -- VueFire does this automatically on unmount
4. **Batch writes** -- Use batch writes for atomic multi-document operations
5. **Server-side aggregation** -- Don't fetch 1000 documents just to count them (use `getCountFromServer()`)
6. **Denormalize when needed** -- Store chaplain name in payout record to avoid extra lookups

## Debugging

### Firestore Console

- View all collections: Firebase Console → Firestore Database
- Run queries manually to test indexes
- View security rule violations in the Rules tab

### Security Rules Testing

- Firestore → Rules → Rules Playground
- Simulate read/write as authenticated or unauthenticated user
- Test with specific UIDs

### Emulator (Local Development)

For local testing without hitting production Firestore:

```bash
firebase emulators:start --only firestore,auth,storage
```

Configure Nuxt to use emulators:
```typescript
// nuxt.config.ts
vuefire: {
  emulators: {
    enabled: process.env.NODE_ENV === 'development',
    auth: { port: 9099 },
    firestore: { port: 8080 },
    storage: { port: 9199 }
  }
}
```

## Further Reading

- Firebase Auth Docs: https://firebase.google.com/docs/auth
- Firestore Docs: https://firebase.google.com/docs/firestore
- Security Rules: https://firebase.google.com/docs/rules
- VueFire: https://vuefire.vuejs.org/
