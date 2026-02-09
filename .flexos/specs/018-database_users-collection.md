---
id: database-users-collection
title: "Users Collection"
description: "Complete schema, relationships, indexes, security rules, and data lifecycle for the users collection"
type: spec
subtype: database
status: draft
sequence: 18
tags: [database, schema, users, authentication]
relatesTo: [docs/core/004-database.md, docs/core/007-technical.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Database: Users Collection

## Overview

The `users` collection is the central entity in COMPASS, storing all system users including chaplains, interns, support staff, and administrators. Every duty log, encounter metric, payout, and audit entry references a user document. The collection combines Firebase Auth identity data with chaplaincy-specific profile information, role assignments, and live operational status.

## Collection Name

`users`

**Document ID:** Matches Firebase Auth `uid` (not auto-generated). When a user is created via Firebase Auth, a corresponding Firestore document is created with the same ID.

**Estimated document count:** 50-200 (typical airport chaplaincy program size)

## Schema

```block flex_block
type: schema
format: typescript
name: User
---
interface User {
  // ========================================
  // IDENTITY
  // ========================================
  uid: string                              // Firebase Auth UID (matches document ID)
  email: string                            // Email address (unique, from Firebase Auth)
  displayName: string                      // Full display name (e.g., "Rev. Maria Rodriguez")
  photoUrl?: string                        // Firebase Storage URL: /user-photos/{uid}/{timestamp}.jpg
  phoneNumber?: string                     // Phone number (format: "+1-555-555-5555" or freeform)
  bio?: string                             // Biography in primary language (max 1000 chars)
  translatedBios?: Record<string, string>  // Map: { es: "...", ko: "...", fr: "..." } for multi-language support
  language?: string                        // Preferred language code (ISO 639-1: en, es, ko, fr, etc.)
  title?: string                           // Professional title (e.g., "Chaplain", "Senior Chaplain", "Intern")

  // ========================================
  // ROLES & STATUS
  // ========================================
  role: 'admin' | 'chaplain' | 'intern' | 'support'  // Primary role (enum, required)
  isChaplain: boolean                      // Active chaplain flag (required, default: false)
  isIntern: boolean                        // Intern chaplain flag (default: false)
  isSupportMember: boolean                 // Support staff flag (default: false)
  isAfterHours: boolean                    // Available for after-hours duty (default: false)
  terminals: string[]                      // Assigned terminals: ['A', 'B', 'C', 'D', 'E'] (airport-specific)

  // ========================================
  // LIVE OPERATIONAL STATUS
  // ========================================
  onDuty: boolean                          // Currently clocked in (required, default: false)
  currentStatus?: string                   // Free-text status (e.g., "Available", "In chapel", "On break")
  location?: {                             // Current GPS coordinates (from mobile app)
    lat: number                            // Latitude
    lng: number                            // Longitude
  }
  totalTime?: number                       // Accumulated all-time duty hours (denormalized for quick display)

  // ========================================
  // TIMESTAMPS & AUDIT
  // ========================================
  createdAt: Timestamp                     // Account creation timestamp (serverTimestamp on first write)
  lastActiveAt?: Timestamp                 // Last activity in any COMPASS or mobile app (updated on interaction)
  adminEditedAt?: Timestamp                // Last admin edit timestamp (for audit trail)
  adminEditedBy?: string                   // UID of admin who last edited this profile (for audit trail)
}
```

## Field Descriptions

### Identity Fields

- **uid:** Matches Firebase Auth UID. This ensures a 1:1 mapping between Auth users and Firestore user documents.
- **email:** Unique email address. Updated automatically when Firebase Auth email changes (via Cloud Function or manual sync).
- **displayName:** Human-readable name. Displayed throughout the UI (dashboard, tables, payout records).
- **photoUrl:** URL to profile photo in Firebase Storage. Uploaded via admin dashboard or mobile app. Default avatar used if null.
- **phoneNumber:** Contact phone number. Optional. No strict format validation (supports international formats).
- **bio:** Short biography. Used in chaplain directory views (not critical for admin dashboard). Max 1000 chars.
- **translatedBios:** Map of language codes to translated bio text. Replaces the original 16 separate fields (bioEnglish, bioSpanish, etc.). Example: `{ es: "Capellán con 10 años de experiencia", ko: "10년 경력의 목사" }`.
- **language:** User's preferred language for app UI localization (future feature, not used in v1).
- **title:** Professional title. Displayed in profile headers and cards.

### Roles & Status Fields

- **role:** Primary role enum. Determines base permissions. `admin` is checked against `app_settings.adminUserIds` for dashboard access.
- **isChaplain:** Boolean flag indicating active chaplain status. Used in queries for chaplain-only lists and duty tracking.
- **isIntern:** Intern chaplain flag. Interns may have different stipend rules or supervision requirements.
- **isSupportMember:** Support staff flag (e.g., administrative assistants, volunteers who don't do pastoral work).
- **isAfterHours:** Indicates availability for after-hours duty shifts (nights, weekends).
- **terminals:** Array of assigned terminals. Chaplains may be assigned to specific areas of the airport for coverage planning.

### Live Status Fields

- **onDuty:** Real-time flag indicating current duty status. Updated when chaplain clocks in/out via mobile app. Used in dashboard "On Duty" widget.
- **currentStatus:** Free-text status message (e.g., "Available", "In chapel", "Assisting at Gate A12"). Updated by chaplain in mobile app.
- **location:** GPS coordinates. Updated periodically when chaplain is on duty (mobile app). Used for location-based features (future: map view of on-duty chaplains).
- **totalTime:** Denormalized sum of all duty hours. Updated when duty logs are completed. Avoids complex aggregation queries for "all-time hours" display.

### Timestamps & Audit Fields

- **createdAt:** When the user document was created (typically matches Firebase Auth account creation).
- **lastActiveAt:** Last interaction timestamp. Updated by both admin dashboard and mobile app. Used for idle logout and activity tracking.
- **adminEditedAt:** When an admin last edited this profile. Used for audit trail and change tracking.
- **adminEditedBy:** UID of the admin who made the last edit. Allows accountability for profile changes.

## Relationships

The `users` collection is referenced by nearly all other collections:

### Outbound References (users → other collections)
None. The `users` collection does not reference other collections directly.

### Inbound References (other collections → users)

| Collection | Relationship | Field | Cardinality |
|-----------|-------------|-------|-------------|
| duty_logs | Duty logs belong to a chaplain | `duty_logs.userId` → `users.uid` | Many-to-One |
| duty_logs | Duty logs processed by an admin | `duty_logs.processedBy` → `users.uid` | Many-to-One |
| chaplain_metrics | Encounter records belong to a chaplain | `chaplain_metrics.chaplainId` → `users.uid` | Many-to-One |
| chaplain_payouts | Payouts issued to a chaplain | `chaplain_payouts.chaplainId` → `users.uid` | Many-to-One |
| chaplain_payouts | Payouts created by an admin | `chaplain_payouts.createdBy` → `users.uid` | Many-to-One |
| stipend_records | Stipend history per chaplain | `stipend_records.chaplainId` → `users.uid` | Many-to-One |
| stipend_records | Stipends processed by an admin | `stipend_records.processedBy` → `users.uid` | Many-to-One |
| chats | Chat between two users | `chats.userA`, `chats.userB` → `users.uid` | Many-to-Many |
| chat_messages | Messages sent by a user | `chat_messages.userId` → `users.uid` | Many-to-One |
| audit_log | Actions performed by an admin | `audit_log.adminId` → `users.uid` | Many-to-One |
| app_settings | Admin user IDs | `app_settings.adminUserIds[]` includes `users.uid` | Many-to-Many |

## Indexes

Firestore requires composite indexes for queries with multiple filters or sort orders.

**Required indexes for `users` collection:**

```
// Role + displayName (for filtered user lists)
users: role ASC, displayName ASC

// isChaplain + displayName (for chaplain-only lists)
users: isChaplain ASC, displayName ASC

// onDuty + isChaplain (for "currently on duty" dashboard query)
users: onDuty ASC, isChaplain ASC

// createdAt descending (for "new signups" queries)
users: createdAt DESC

// lastActiveAt descending (for activity monitoring)
users: lastActiveAt DESC
```

**Index creation command (via Firebase CLI):**

```bash
firebase deploy --only firestore:indexes
```

## Security Rules

```javascript
// users: Admins can read/write. Authenticated users can read all profiles (for chat, directory).
match /users/{userId} {
  // Allow any authenticated user to read user documents (for chaplain directory, chat participant lookup)
  allow read: if request.auth != null;

  // Allow users to update their own profile (limited fields)
  allow update: if request.auth != null
    && request.auth.uid == userId
    && onlyUpdatingAllowedFields(['displayName', 'phoneNumber', 'bio', 'photoUrl', 'currentStatus', 'location', 'lastActiveAt']);

  // Allow admins to write (create, update, delete)
  allow write: if isAdmin();
}

// Helper function to check if only allowed fields are being updated
function onlyUpdatingAllowedFields(allowedFields) {
  let affectedKeys = request.resource.data.diff(resource.data).affectedKeys();
  return affectedKeys.hasOnly(allowedFields);
}

// Helper function to check admin status
function isAdmin() {
  return request.auth != null
    && get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
}
```

**Key rules:**
1. **Read:** Any authenticated user can read all user documents (needed for chaplain directory, chat participants, encounter attribution).
2. **Self-update:** Users can update a limited set of fields on their own profile (displayName, phoneNumber, bio, photoUrl, currentStatus, location, lastActiveAt). This allows mobile app users to update their status and profile info.
3. **Admin write:** Admins have full write access (create, update, delete). Used for profile management, role assignment, terminal assignment.
4. **Field-level validation:** The `onlyUpdatingAllowedFields` helper prevents non-admins from modifying sensitive fields like `role`, `isChaplain`, `terminals`, `totalTime`, or audit fields.

## Data Lifecycle

### Creation

**Trigger:** New user signs up via Firebase Auth (admin invites or self-registration in mobile app)

**Process:**
1. Firebase Auth creates user with `uid`, `email`, `displayName` (from signup form)
2. Cloud Function or manual API call creates corresponding Firestore document:
   ```typescript
   {
     uid: authUser.uid,
     email: authUser.email,
     displayName: authUser.displayName || 'New User',
     role: 'chaplain',  // Default role
     isChaplain: false,  // Admin must manually enable
     onDuty: false,
     createdAt: serverTimestamp()
   }
   ```
3. Admin navigates to `/users`, finds new user, edits profile to set `isChaplain`, `terminals`, etc.

### Updates

**User-initiated (mobile app):**
- Update `displayName`, `phoneNumber`, `bio`, `photoUrl`, `currentStatus`, `location`, `lastActiveAt`
- Writes go directly to Firestore (protected by security rule)

**Admin-initiated (dashboard):**
- Update any field (role, terminals, status flags, etc.)
- Writes go through server API route `/api/users/:id/update`
- Server sets `adminEditedAt`, `adminEditedBy` and creates `audit_log` entry

### Deletion

**Soft delete (recommended):**
- Set a `deleted: true` flag and `deletedAt: timestamp`
- Security rules filter out deleted users from queries
- Preserves referential integrity (duty logs, payouts still reference the user)

**Hard delete (not recommended):**
- Deleting a user document breaks references in duty_logs, chaplain_payouts, etc.
- Only permissible if user has no associated records (new account, no activity)

## Common Queries

### Dashboard: Currently on duty chaplains

```typescript
query(collection('users'),
  where('onDuty', '==', true),
  where('isChaplain', '==', true),
  orderBy('displayName', 'asc'),
  limit(50)
)
```

### Users page: All chaplains

```typescript
query(collection('users'),
  where('isChaplain', '==', true),
  orderBy('displayName', 'asc'),
  limit(50)
)
```

### User search by name (client-side filter or Algolia)

```typescript
// Option 1: Client-side filter (fetch all, filter in memory)
const allUsers = await getDocs(query(collection('users'), orderBy('displayName', 'asc')))
const filtered = allUsers.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()))

// Option 2: Firestore range query (prefix match only)
query(collection('users'),
  where('displayName', '>=', searchTerm),
  where('displayName', '<=', searchTerm + '\uf8ff'),
  limit(20)
)

// Option 3: Algolia search (requires Algolia extension, best for full-text search)
```

### User detail with duty history

```typescript
// Fetch user document
const userDoc = await getDoc(doc(collection('users'), userId))

// Fetch duty logs for this user
const dutyLogs = await getDocs(
  query(collection('duty_logs'),
    where('userId', '==', userId),
    orderBy('startTime', 'desc'),
    limit(20)
  )
)

// Fetch payouts for this user
const payouts = await getDocs(
  query(collection('chaplain_payouts'),
    where('chaplainId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(10)
  )
)
```

## Data Quality Considerations

### Denormalized Fields

- **totalTime:** Sum of all duty hours. Must be recalculated periodically or on duty log completion. Risk of drift if duty logs are edited/deleted.
- **Mitigation:** Cloud Function trigger on duty_logs writes to update `users.totalTime`.

### Translated Bios

- **translatedBios map:** Replaces 16 separate fields. More scalable (supports any language code).
- **Challenge:** Admins must manually add translations. Future: integrate translation API.

### Role vs. Boolean Flags

- **role field:** Single primary role (admin, chaplain, intern, support).
- **Boolean flags:** `isChaplain`, `isIntern`, `isSupportMember` allow overlapping roles (e.g., admin who is also a chaplain).
- **Clarification needed:** Can a user have multiple boolean flags set to true? Yes, for flexibility.

## Open Questions

1. **User deactivation:** Should there be an `isActive` flag separate from role assignment? Or rely on `deleted` flag?
2. **Multi-organization support:** If COMPASS expands to serve multiple chaplaincy programs, add `organizationId` field?
3. **Profile photo storage cleanup:** When a user uploads a new photo, delete the old one from Storage? Or keep history?
4. **Real-time location updates:** How frequently should mobile app update `location`? Every 5 minutes? On significant movement?

## Related Documents

- Core Database Doc: `docs/core/004-database.md` (Full schema overview, relationship diagram)
- Core Technical Doc: `docs/core/007-technical.md` (Auth architecture, security rules philosophy)
- Pages Spec: `specs/users-pages.md` (User management UI flows, TBD)
