---
id: core-technical
title: "Technical"
description: "Architecture, tech stack, data flow, API surface, deployment, and performance targets for COMPASS"
type: doc
subtype: core
status: draft
sequence: 7
tags: [core, technical]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Technical

## Architecture Overview

COMPASS is a server-rendered admin dashboard built on Nuxt 4, backed by Firebase services, deployed to Vercel.

```
┌──────────────────────────────────────────────────────────┐
│                        CLIENT                             │
│                                                           │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Nuxt Pages   │  │  Composables │  │  VueFire     │ │
│  │  (SSR + SPA)   │←─│  (useAuth,   │←─│  (real-time  │ │
│  │                │  │  useStipend, │  │   bindings)  │ │
│  │  Dashboard     │  │  useCoverage │  │              │ │
│  │  Users         │  │  useReport)  │  │              │ │
│  │  Duty Days     │  │              │  │              │ │
│  │  Coverage      │  └──────────────┘  └──────┬───────┘ │
│  │  Stipends      │                           │         │
│  │  Reports       │                           │         │
│  │  Settings      │                           │         │
│  └───────┬────────┘                           │         │
│          │ API calls                          │ Firestore│
│          │                                    │ listeners│
└──────────┼────────────────────────────────────┼─────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│   Nuxt Server API    │    │       Firebase Services       │
│                      │    │                               │
│  /api/auth/verify    │    │  ┌─────────────┐             │
│  /api/users/:id      │───>│  │  Firestore   │             │
│  /api/stipends/*     │    │  │  (9 cols)    │             │
│  /api/reports/export │    │  └─────────────┘             │
│  /api/coverage/*     │    │  ┌─────────────┐             │
│                      │    │  │  Firebase    │             │
│  Uses Firebase       │    │  │  Auth        │             │
│  Admin SDK           │    │  └─────────────┘             │
│  (server-side only)  │    │  ┌─────────────┐             │
└──────────────────────┘    │  │  Firebase    │             │
                            │  │  Storage     │             │
           ▲                │  └─────────────┘             │
           │                │  ┌─────────────┐             │
           │                │  │  Security    │             │
┌──────────┴──────────┐    │  │  Rules       │             │
│       Vercel         │    │  └─────────────┘             │
│  (Hosting + Edge)    │    └──────────────────────────────┘
└─────────────────────┘
```

### Key Architectural Decisions

1. **Hybrid rendering (SSR + SPA).** Initial page loads are server-rendered for performance and SEO (login page). After hydration, navigation is SPA-style with Firestore real-time listeners providing live data updates. No full page reloads after login.

2. **Server-side financial calculations.** All stipend calculations (base rate x shifts + adjustments) happen in Nuxt API routes using the Firebase Admin SDK. The client displays previews but never submits pre-calculated totals. The server recalculates from source data on every payout creation to prevent client-side manipulation.

3. **Audit trail via server API.** All write operations that need audit logging go through Nuxt server API routes, not direct Firestore client writes. This ensures audit entries are created atomically with the primary write and cannot be bypassed by a modified client.

4. **VueFire for real-time reads.** Read-heavy operations (dashboard KPIs, user lists, on-duty status) use VueFire's reactive bindings for automatic Firestore listener management. Listeners attach on mount and detach on unmount with no manual cleanup.

5. **Direct Firestore writes for non-sensitive operations.** Coverage grid toggles and user search go directly to Firestore from the client (protected by security rules). These don't need server-side validation beyond what security rules enforce.

## Tech Stack

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Nuxt 4** | Latest | Application framework (SSR + SPA + API routes) |
| **Vue 3** | 3.5+ | Component framework (Composition API, `<script setup>`) |
| **TypeScript** | 5.x | Type safety throughout |

### Firebase
| Package | Purpose |
|---------|---------|
| **nuxt-vuefire** | Nuxt module for Firebase integration (handles SSR, auth, admin SDK) |
| **vuefire** | Vue composables for Firestore reactive bindings |
| **firebase/auth** | Client-side authentication (email/password) |
| **firebase/firestore** | Client-side Firestore SDK (reads, real-time listeners) |
| **firebase/storage** | Client-side Storage SDK (photo uploads) |
| **firebase-admin** | Server-side Admin SDK (write operations, audit trail) |

### UI & Data
| Package | Purpose |
|---------|---------|
| **@nuxtjs/google-fonts** | Inter font loading (weights 400, 500, 600) |
| **@tanstack/vue-table** | Data tables with sorting, filtering, pagination, row selection |
| **date-fns** | Date manipulation (pay period calculations, week numbers, relative dates) |
| **papaparse** | CSV generation for data export |

### Development
| Tool | Purpose |
|------|---------|
| **Tailwind CSS** | Utility-first styling (mapped to design tokens) |
| **ESLint** | Code quality |
| **Vitest** | Unit testing for composables and utility functions |

### Explicitly NOT Included
These were present in the original FlutterFlow app but are NOT included in COMPASS:
- **LangChain** -- No AI features in admin dashboard
- **Stripe** -- No electronic payments (check-based stipends)
- **OneSignal** -- No push notifications in v1
- **Any charting library** -- Coverage grid and terminal distribution are custom components. If charts become complex in Reports, we add Chart.js at that point, not before.

## Data Flow

### Read Path (Real-Time)
```
User opens Dashboard
  → Nuxt renders page shell (SSR)
  → Client hydrates, VueFire attaches listeners:
      useCollection(query(collection('users'), where('onDuty', '==', true)))
      useCollection(query(collection('duty_logs'), orderBy('startTime', 'desc'), limit(10)))
      useDocument(doc('coverage_schedules', `${currentWeek}-${currentYear}`))
  → Firestore pushes initial data snapshot
  → Vue reactivity renders components
  → Firestore pushes incremental updates (chaplain goes on/off duty)
  → Vue reactivity re-renders affected components (no refetch, no polling)
```

### Write Path (Secure)
```
Admin processes stipend payout
  → Client collects: selected entries, adjustments, check number
  → Client calls: POST /api/stipends/process
  → Nuxt API route:
      1. Verify auth token (Firebase Admin SDK)
      2. Verify admin role (check app_settings.adminUserIds)
      3. Fetch app_settings for current stipend rate
      4. Recalculate amounts from duty_logs (server-side, ignore client totals)
      5. Firestore batch write:
         - Create chaplain_payouts documents
         - Update duty_logs (isPaid, payoutId, checkNumber, etc.)
         - Create/update stipend_records
         - Create audit_log entries
      6. Batch commit (atomic: all or nothing)
  → Return { success: true, payoutIds: [...] }
  → Client refreshes: VueFire listeners auto-detect changes, UI updates
```

### Upload Path
```
Admin uploads profile photo
  → Client validates file (size, type)
  → Client compresses image (800x800 max, 80% JPEG)
  → Client uploads to Firebase Storage: /user-photos/{userId}/{timestamp}.jpg
  → Storage returns download URL
  → Client calls: POST /api/users/:id/update { photoUrl: downloadUrl }
  → Server writes user document + audit_log entry
  → VueFire listener updates avatar component
```

## Auth Architecture

### Authentication Flow
1. **Login:** Client calls `signInWithEmailAndPassword(auth, email, password)`
2. **Token:** Firebase Auth issues a JWT (1-hour expiry, auto-refresh)
3. **Route guard:** Nuxt middleware checks `auth.currentUser` on every navigation
   - Not authenticated: redirect to `/login?redirect={intended}`
   - Authenticated: proceed
4. **Admin check:** After auth, client fetches `app_settings/config` and checks `adminUserIds.includes(user.uid)`
   - Not admin: show "Unauthorized" page with logout option
   - Is admin: proceed to dashboard
5. **Server verification:** Every API route calls `auth.verifyIdToken(token)` and independently checks admin status

### Role Model
COMPASS v1 has a simple binary role model:
- **Admin:** Full access to everything in the dashboard
- **Non-admin:** No dashboard access (they use the chaplain mobile app)

The `app_settings.adminUserIds` array is the single source of truth for who is an admin. This is simpler and more auditable than a role field on each user document (which could be manipulated if security rules had a gap).

### Token Management
```typescript
// Nuxt middleware: ~/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useCurrentUser()
  const publicRoutes = ['/login', '/forgot-password']

  if (!currentUser.value && !publicRoutes.includes(to.path)) {
    return navigateTo(`/login?redirect=${to.fullPath}`)
  }
})
```

Token refresh is handled automatically by the Firebase SDK. If a refresh fails (e.g., account disabled), the auth state listener fires and the middleware redirects to login.

## API Surface

All server API routes live under `server/api/` in the Nuxt project.

### Authentication
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/verify` | Verify token and return admin status (called on app init) |

### Users
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/users` | List users with pagination and optional role filter |
| GET | `/api/users/:id` | Get single user with duty and stipend history |
| POST | `/api/users/:id/update` | Update user profile (admin only, creates audit entry) |

### Stipends
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/stipends/qualifying` | Get unpaid duty logs for a pay period, grouped by chaplain |
| POST | `/api/stipends/process` | Create payouts and mark entries as paid (batch write) |
| GET | `/api/stipends/summary` | Get monthly/YTD/all-time totals for a chaplain |

### Coverage
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/coverage/:weekYear` | Get coverage schedule for a week (creates empty if not found) |
| PATCH | `/api/coverage/:weekYear` | Update a single coverage slot (creates audit entry) |

### Reports
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/reports/encounters` | Aggregated encounter metrics with filters |
| GET | `/api/reports/duty-hours` | Duty hour summaries with filters |
| GET | `/api/reports/stipend-summary` | Stipend financial summary with filters |
| GET | `/api/reports/export` | Generate and download CSV for a specific report type |

### Settings
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/settings` | Get current app settings |
| POST | `/api/settings/update` | Update settings (admin only, creates audit entry) |

### Audit
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/audit` | List audit log entries with pagination and filters |

**Total: 14 API routes.** All require admin authentication via token verification except the auth verify endpoint itself.

## Third-Party Services

| Service | Usage | Billing Model | Est. Cost |
|---------|-------|---------------|-----------|
| **Firebase Auth** | User authentication | Free tier (10K MAU) | $0 |
| **Cloud Firestore** | Primary database | Free tier (1GB storage, 50K reads/day) | $0-25/mo |
| **Firebase Storage** | Profile photo storage | Free tier (5GB, 1GB/day download) | $0-5/mo |
| **Vercel** | Hosting + serverless functions | Hobby/Pro plan | $0-20/mo |
| **Google Fonts** | Inter font CDN | Free | $0 |

**Estimated total infrastructure cost:** $0-50/month for a 100-user deployment. Firestore free tier covers most usage. If the chaplaincy program grows or real-time listeners become heavy, Firestore costs could reach $25/month.

## Performance Targets

| Metric | Target | Tool |
|--------|--------|------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| First Input Delay | < 100ms | Lighthouse |
| Dashboard data render | < 2s after hydration | Custom timing |
| Stipend page load | < 3s for 200 duty logs | Custom timing |
| Coverage grid render | < 500ms (119 cells) | Custom timing |
| CSV export generation | < 5s for 1000 rows | Custom timing |
| Bundle size (initial) | < 200KB gzipped | Build analysis |
| Photo upload (compressed) | < 3s on 4G | Real device testing |

### Performance Strategies

**Code splitting:** Each page is a separate chunk. The stipend processing page (heaviest) loads its components lazily. The reports page lazy-loads papaparse only when export is triggered.

**Firestore query limits:** No query ever returns more than 50 documents at a time (pagination). Dashboard KPIs use `getCountFromServer()` for counts instead of fetching all documents just to count them.

**Image optimization:** Profile photos are compressed client-side before upload (max 800x800, JPEG 80%). Thumbnails could use a Firebase Extension for automatic resizing if needed.

**Real-time listener scope:** Listeners are scoped to the current page. The dashboard doesn't listen to stipend data. The stipends page doesn't listen to chat data. Global listeners (auth state, admin status) are minimal.

## Deployment

### Environments
| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| Production | compass.example.com | main | Live admin dashboard |
| Preview | compass-preview.vercel.app | PR branches | Automated preview per PR |
| Development | localhost:3000 | any | Local development |

### Vercel Configuration
```json
{
  "framework": "nuxt",
  "buildCommand": "nuxt build",
  "outputDirectory": ".output",
  "env": {
    "NUXT_PUBLIC_FIREBASE_API_KEY": "@firebase-api-key",
    "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN": "@firebase-auth-domain",
    "NUXT_PUBLIC_FIREBASE_PROJECT_ID": "@firebase-project-id",
    "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET": "@firebase-storage-bucket",
    "NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT": "@firebase-admin-sa"
  }
}
```

### Firebase Project Structure
```
compass-chaplaincy (Firebase project)
├── Authentication
│   └── Email/Password provider enabled
├── Firestore Database
│   ├── Security rules (deployed via firebase CLI)
│   ├── Composite indexes (deployed via firebase CLI)
│   └── 10 collections
├── Storage
│   └── /user-photos/{userId}/
└── IAM
    └── Service account for Nuxt server (Admin SDK)
```

### CI/CD Pipeline
1. **Push to PR branch** -- Vercel creates preview deployment automatically
2. **Merge to main** -- Vercel deploys to production
3. **Firebase rules/indexes** -- Deployed manually via `firebase deploy --only firestore:rules,firestore:indexes` (consider GitHub Actions for automation in v1.1)

## Inferred Technical Needs

### Rate Limiting
Nuxt API routes for write operations (stipend processing, profile updates) should have basic rate limiting to prevent accidental double-submissions. A simple approach: hash the request body and reject duplicates within a 30-second window. More sophisticated rate limiting (per-IP, per-user) can use Vercel Edge Middleware or a simple in-memory store.

### CSV Export Streaming
For large exports (1000+ rows), generating the entire CSV in memory and returning it as a single response could time out on Vercel's serverless function limit (10s default). Stream the CSV generation using Node.js readable streams, or increase the function timeout to 30s for export routes.

### Image Storage Cleanup
When a new profile photo replaces an old one, the old file remains in Firebase Storage. Over time, this accumulates orphaned files. A scheduled Cloud Function (monthly) could scan for unreferenced photos and delete them. Not critical for launch, but good hygiene.

### Error Monitoring
Integrate a lightweight error tracking service (Sentry or similar) before launch. Unhandled exceptions in API routes and client-side errors should be captured with context (user ID, page, action). This is especially important for stipend processing errors, which could affect financial accuracy.

### Database Backups
Firestore should have scheduled exports to Cloud Storage for disaster recovery. Firebase's built-in export (`gcloud firestore export`) can run daily via Cloud Scheduler. This is critical for a system handling financial records -- losing payout data would be catastrophic.

### Input Sanitization
User-submitted text fields (bio, event narrative, notes) should be sanitized against XSS on the server side before storage. While Vue's template rendering auto-escapes HTML, any `v-html` usage or future email templates could be vulnerable.

### Composable Architecture
Each major feature area should have its own composable:

```typescript
// Composable per domain
useAuth()        // Login, logout, admin check, token state
useDashboard()   // KPI data, on-duty list, coverage summary
useUsers()       // User list, search, filter, pagination
useUserDetail()  // Single user profile, edit, photo upload
useDutyDays()    // Duty logs, terminal distribution, hour calculations
useCoverage()    // Coverage grid state, week navigation, slot toggling
useStipends()    // Pay period, qualifying data, adjustments, processing
useReports()     // Filters, aggregations, export
useAudit()       // Audit log queries (if dedicated page)
useSettings()    // App config read/write
```

Each composable encapsulates Firestore queries, real-time listeners, computed transformations, and write functions. Pages become thin shells that wire composables to templates.
