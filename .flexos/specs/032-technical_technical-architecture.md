---
id: technical_technical-architecture
title: "Technical Architecture & Stack"
description: "Complete technical specification including architecture, tech stack, data flow, API surface, third-party services, performance targets, deployment strategy, and security architecture for COMPASS"
type: spec
subtype: technical
status: draft
sequence: 32
tags: [technical, architecture, stack, deployment, security]
relatesTo: [docs/core/007-technical.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Technical Architecture & Stack

## Architecture Overview

COMPASS is a **server-rendered admin dashboard** built on Nuxt 4, backed by Firebase services, deployed to Vercel. It follows a hybrid SSR+SPA architecture with server-side financial calculations and client-side real-time data bindings.

### System Architecture Diagram
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
│  /api/stipends/*     │    │  │  (10 cols)   │             │
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

### Architectural Decisions

**1. Hybrid Rendering (SSR + SPA)**
- **SSR:** Initial page loads server-rendered for performance and SEO (login page)
- **SPA:** After hydration, navigation is client-side with no full page reloads
- **Real-time:** VueFire listeners provide live data updates after hydration
- **Rationale:** Best of both worlds – fast initial load + interactive experience

**2. Server-Side Financial Calculations**
- **Client:** Displays previews, collects inputs, shows optimistic updates
- **Server:** Recalculates all amounts from source data (base rate × shifts + adjustments)
- **Security:** Client-submitted totals are ignored – prevents manipulation
- **API Route:** `POST /api/stipends/process` performs all calculations server-side

**3. Audit Trail via Server API**
- **Write Path:** All sensitive writes go through Nuxt server API routes
- **Audit Entry:** Created atomically in same Firestore batch as primary write
- **Immutability:** Audit entries cannot be deleted or modified
- **Bypass Prevention:** Client cannot write directly to `chaplain_payouts` or `audit_log`

**4. VueFire for Real-Time Reads**
- **Read-Heavy:** Dashboard KPIs, user lists, on-duty status use VueFire
- **Auto-Cleanup:** Listeners attach on mount, detach on unmount (no manual cleanup)
- **Reactivity:** Vue reactivity updates UI when Firestore pushes changes
- **Rationale:** Reduces boilerplate, ensures consistent listener lifecycle

**5. Direct Firestore Writes for Non-Sensitive Ops**
- **Coverage Grid:** Toggles write directly to Firestore (protected by security rules)
- **User Search:** Client-side filtering (no API call needed)
- **Rationale:** Reduce server load, improve responsiveness for low-risk operations

## Tech Stack

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Nuxt 4** | Latest (4.x) | Application framework (SSR + SPA + API routes + file-based routing) |
| **Vue 3** | 3.5+ | Component framework (Composition API, `<script setup>`, reactivity) |
| **TypeScript** | 5.x | Type safety throughout (interfaces, type guards, generics) |

### Firebase Integration
| Package | Purpose | Environment |
|---------|---------|-------------|
| **nuxt-vuefire** | Nuxt module for Firebase (SSR support, auth, admin SDK) | Both |
| **vuefire** | Vue composables for Firestore reactive bindings (`useCollection`, `useDocument`) | Client |
| **firebase/auth** | Client-side authentication (email/password, token management) | Client |
| **firebase/firestore** | Client-side Firestore SDK (queries, real-time listeners) | Client |
| **firebase/storage** | Client-side Storage SDK (photo uploads) | Client |
| **firebase-admin** | Server-side Admin SDK (batch writes, auth verification, privileged operations) | Server |

**Why Firebase?**
- Real-time listeners (on-duty status updates without polling)
- Strong security rules (role-based access enforced at database level)
- Mature ecosystem (auth, storage, hosting integration)
- No server infrastructure to manage (serverless Firestore)

### UI & Data Handling
| Package | Purpose | Rationale |
|---------|---------|-----------|
| **@nuxtjs/google-fonts** | Inter font loading (weights 400, 500, 600) | Performance (font subsetting), CDN |
| **@tanstack/vue-table** | Data tables (sorting, filtering, pagination, row selection) | Most mature Vue table library, headless UI |
| **date-fns** | Date manipulation (pay period calc, week numbers, relative dates) | Lightweight (vs. moment.js), tree-shakeable |
| **papaparse** | CSV generation for data export | Standard, handles edge cases (escaping, BOM) |
| **Tailwind CSS** | Utility-first styling (mapped to design tokens) | Rapid development, consistent design system |

### Development Tools
| Tool | Purpose |
|------|---------|
| **ESLint** | Code quality (enforces standards, catches bugs) |
| **Prettier** | Code formatting (consistent style) |
| **Vitest** | Unit testing (composables, utility functions) |
| **TypeScript Strict Mode** | Maximum type safety (no implicit any, strict null checks) |

### Explicitly NOT Included
These packages existed in the original FlutterFlow app but are **not needed** in COMPASS:

| Package | Why Excluded |
|---------|-------------|
| **LangChain** | No AI features in admin dashboard (future: chaplain-facing chatbot, not admin tool) |
| **Stripe** | No electronic payments in v1 (check-based stipends only) |
| **OneSignal** | No push notifications (admin tool used on desktop, not mobile alerts) |
| **Chart.js (initially)** | Custom SVG for coverage grid. Add Chart.js later if Reports page needs complex charts. |

## Data Flow Patterns

### Read Path (Real-Time)
```
User opens Dashboard
  → Nuxt SSR renders page shell (HTML + initial data)
  → Client hydrates Vue app
  → VueFire attaches Firestore listeners:
      useCollection(query(collection('users'), where('onDuty', '==', true)))
      useCollection(query(collection('duty_logs'), orderBy('startTime', 'desc'), limit(10)))
      useDocument(doc('coverage_schedules', `${currentWeek}-${currentYear}`))
  → Firestore pushes initial data snapshot
  → Vue reactivity renders components
  → [REAL-TIME] Firestore pushes incremental updates (chaplain goes on/off duty)
  → [REAL-TIME] Vue re-renders affected components (no refetch, no polling)
```

**Performance:**
- Initial snapshot: ~500ms on 4G
- Incremental updates: ~200ms latency (Firestore listener push)
- No polling overhead (WebSocket connection maintained)

### Write Path (Secure, Server-Side Validation)
```
Admin processes stipend payout
  → Client collects: selected entries, adjustments, check number
  → Client calls: POST /api/stipends/process (with auth token in header)
  → Nuxt API route:
      1. Verify auth token (Firebase Admin SDK: auth.verifyIdToken())
      2. Verify admin role (check app_settings.adminUserIds array)
      3. Fetch app_settings for current stipend rate
      4. Recalculate amounts from duty_logs (server-side, ignore client totals)
      5. Firestore batch write (atomic, all-or-nothing):
         - Create chaplain_payouts documents
         - Update duty_logs (isPaid, payoutId, checkNumber, processedAt, etc.)
         - Create/update stipend_records
         - Create audit_log entries
      6. Batch commit (max 500 operations, well within limits)
  → Return: { success: true, payoutIds: [...], totalAmount: $X }
  → Client: VueFire listeners auto-detect changes, UI updates with new paid status
```

**Security Layers:**
1. **Client-side:** Auth token required (Firebase Auth)
2. **Server-side:** Token verification + admin role check
3. **Firestore rules:** Deny direct writes to sensitive collections
4. **Recalculation:** Server ignores client-submitted totals

### Upload Path (Photo Upload)
```
Admin uploads profile photo
  → Client validates file (type: image/jpeg|png|webp, size: <5MB)
  → Client compresses image (canvas resize to 800×800 max, JPEG 80% quality)
  → Client uploads to Firebase Storage: /user-photos/{userId}/{timestamp}.jpg
  → Storage SDK returns download URL
  → Client calls: POST /api/users/:id/update { photoUrl: downloadURL }
  → Server:
      1. Verify admin auth
      2. Write user.photoUrl to Firestore
      3. Create audit_log entry (action: 'photo_upload')
  → Client: VueFire listener updates avatar component
```

**Why Client-Side Compression?**
- Reduces upload time (smaller file)
- Reduces storage costs (not storing 5MB RAW photos)
- Reduces bandwidth on subsequent profile loads

## Auth Architecture

### Authentication Flow
```
1. Login: Client calls signInWithEmailAndPassword(auth, email, password)
2. Token: Firebase Auth issues JWT (1-hour expiry, auto-refresh)
3. Route Guard: Nuxt middleware checks auth.currentUser on every navigation
   - Not authenticated → redirect to /login?redirect={intended}
   - Authenticated → proceed
4. Admin Check: Client fetches app_settings/config, checks adminUserIds.includes(user.uid)
   - Not admin → show "Unauthorized" page with logout option
   - Is admin → proceed to dashboard
5. Server Verification: Every API route calls auth.verifyIdToken(token) + independent admin check
```

**Middleware Code (Simplified):**
```typescript
// ~/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useCurrentUser()
  const publicRoutes = ['/login', '/forgot-password']

  if (!currentUser.value && !publicRoutes.includes(to.path)) {
    return navigateTo(`/login?redirect=${to.fullPath}`)
  }
})
```

### Role Model (Simple Binary)
- **Admin:** Full dashboard access (UIDs in `app_settings.adminUserIds` array)
- **Non-Admin:** No dashboard access (they use the chaplain mobile app)

**Why Array-Based Instead of Role Field?**
- **Single Source of Truth:** One document (`app_settings`) controls all admin access
- **Auditable:** Changes to admin list are versioned in Firestore history
- **Secure:** Cannot be manipulated by editing individual user documents (even if rules had a gap)

### Token Management
- **Expiry:** 1 hour (Firebase default)
- **Refresh:** Automatic via Firebase SDK (silent refresh at 55 minutes)
- **Failure:** If refresh fails (account disabled, revoked), auth listener fires → redirect to login
- **Idle Timeout:** Force logout after 4 hours of inactivity (configurable in `app_settings`)

## API Surface

All server API routes live under `server/api/` in Nuxt project structure.

### Authentication
| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| POST | `/api/auth/verify` | Verify token, return admin status | Token required |

### Users
| Method | Route | Purpose | Returns |
|--------|-------|---------|---------|
| GET | `/api/users` | List users with pagination, optional role filter | `{ users: [], total: N, page: X }` |
| GET | `/api/users/:id` | Get single user with duty history, stipend history | `{ user: {...}, dutyLogs: [], stipends: [] }` |
| POST | `/api/users/:id/update` | Update user profile (admin only, creates audit entry) | `{ success: true }` |

### Stipends
| Method | Route | Purpose | Returns |
|--------|-------|---------|---------|
| GET | `/api/stipends/qualifying` | Get unpaid duty logs for pay period, grouped by chaplain | `{ chaplains: [...] }` |
| POST | `/api/stipends/process` | Create payouts, mark entries paid (atomic batch) | `{ success: true, payoutIds: [...] }` |
| GET | `/api/stipends/summary` | Get monthly/YTD/all-time totals for a chaplain | `{ monthly: X, ytd: Y, allTime: Z }` |

### Coverage
| Method | Route | Purpose | Returns |
|--------|-------|---------|---------|
| GET | `/api/coverage/:weekYear` | Get coverage schedule for week (creates empty if not found) | `{ weekNumber, year, slots: {...} }` |
| PATCH | `/api/coverage/:weekYear` | Update single coverage slot (creates audit entry) | `{ success: true }` |

### Reports
| Method | Route | Purpose | Returns |
|--------|-------|---------|---------|
| GET | `/api/reports/encounters` | Aggregated encounter metrics with filters | `{ totals: {...}, byType: {...}, byTerminal: {...} }` |
| GET | `/api/reports/duty-hours` | Duty hour summaries with filters | `{ totals: {...}, byTerminal: {...}, byChaplain: [...] }` |
| GET | `/api/reports/stipend-summary` | Stipend financial summary with filters | `{ totals: {...}, byMonth: [...], byChaplain: [...] }` |
| GET | `/api/reports/export` | Generate and download CSV for report type | CSV file download |

### Settings
| Method | Route | Purpose | Returns |
|--------|-------|---------|---------|
| GET | `/api/settings` | Get current app settings | `{ stipendRate: 80, adminUserIds: [...], ... }` |
| POST | `/api/settings/update` | Update settings (admin only, creates audit entry) | `{ success: true }` |

### Audit
| Method | Route | Purpose | Returns |
|--------|-------|---------|---------|
| GET | `/api/audit` | List audit log entries with pagination, filters | `{ entries: [...], total: N }` |

**Total: 14 API routes.** All require admin authentication except `/api/auth/verify`.

## Third-Party Services

| Service | Usage | Billing Model | Est. Monthly Cost |
|---------|-------|---------------|-------------------|
| **Firebase Auth** | User authentication (email/password) | Free tier: 10K MAU | **$0** (well under limit) |
| **Cloud Firestore** | Primary database (10 collections, real-time listeners) | Free tier: 1GB storage, 50K reads/day, 20K writes/day | **$0-$25** (may exceed reads with real-time) |
| **Firebase Storage** | Profile photos, chaplain event images | Free tier: 5GB storage, 1GB/day downloads | **$0-$5** (minimal image storage) |
| **Vercel** | Hosting + serverless functions (Nuxt API routes) | Hobby (free) or Pro ($20/mo) | **$0-$20** (Pro for custom domain) |
| **Google Fonts** | Inter font CDN | Free (Google-hosted) | **$0** |

**Estimated Total Infrastructure Cost:** **$0-$50/month** for a 100-user deployment.

**Cost Scaling:**
- Firestore free tier covers most usage
- If real-time listeners become heavy (many admins online simultaneously), Firestore could reach $25/month
- If chaplain mobile app is heavily used (1000+ active users), Firestore could reach $50-$100/month

## Performance Targets

| Metric | Target | Measurement Tool |
|--------|--------|------------------|
| **First Contentful Paint** | < 1.5s | Lighthouse |
| **Largest Contentful Paint** | < 2.5s | Lighthouse |
| **Time to Interactive** | < 3.0s | Lighthouse |
| **Cumulative Layout Shift** | < 0.1 | Lighthouse |
| **First Input Delay** | < 100ms | Lighthouse |
| **Dashboard Data Render** | < 2s after hydration | Custom timing (console.time) |
| **Stipend Page Load** | < 3s for 200 duty logs | Custom timing |
| **Coverage Grid Render** | < 500ms (119 cells) | Custom timing |
| **CSV Export Generation** | < 5s for 1000 rows | Server timing header |
| **Bundle Size (Initial)** | < 200KB gzipped | Webpack Bundle Analyzer |
| **Photo Upload (Compressed)** | < 3s on 4G | Real device testing |

### Performance Strategies

**Code Splitting:**
- Each page is a separate chunk (automatic via Nuxt)
- Stipend processing page (heaviest) lazy-loads components
- Reports page lazy-loads `papaparse` only when export is triggered

**Firestore Query Limits:**
- No query returns more than 50 documents at once (pagination)
- Dashboard KPIs use `getCountFromServer()` for counts (not fetching all docs)

**Image Optimization:**
- Profile photos compressed client-side before upload (max 800×800, JPEG 80%)
- Thumbnails could use Firebase Extension for auto-resizing if needed (future)

**Real-Time Listener Scope:**
- Listeners scoped to current page (dashboard doesn't listen to stipend data)
- Global listeners (auth state, admin status) are minimal
- Listeners detach on unmount (no orphaned connections)

## Deployment

### Environments
| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| **Production** | `compass.dfwchaplaincy.org` | `main` | Live admin dashboard |
| **Preview** | `compass-preview-{pr}.vercel.app` | PR branches | Automated preview per PR |
| **Development** | `localhost:3000` | Any | Local development |

### Vercel Configuration
```json
{
  "framework": "nuxt",
  "buildCommand": "nuxt build",
  "outputDirectory": ".output",
  "installCommand": "npm install",
  "devCommand": "nuxt dev",
  "env": {
    "NUXT_PUBLIC_FIREBASE_API_KEY": "@firebase-api-key",
    "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN": "@firebase-auth-domain",
    "NUXT_PUBLIC_FIREBASE_PROJECT_ID": "@firebase-project-id",
    "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET": "@firebase-storage-bucket",
    "NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT": "@firebase-admin-sa"
  },
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10
    },
    "api/reports/export.ts": {
      "maxDuration": 30
    }
  }
}
```

**Function Timeouts:**
- Default API routes: 10 seconds (sufficient for most operations)
- CSV export route: 30 seconds (handles large exports)

### Firebase Project Structure
```
compass-chaplaincy (Firebase project)
├── Authentication
│   └── Email/Password provider enabled
│   └── Authorized domains: compass.dfwchaplaincy.org, localhost
├── Firestore Database
│   ├── Security rules (deployed via Firebase CLI)
│   ├── Composite indexes (deployed via Firebase CLI)
│   └── 10 collections (users, duty_logs, chaplain_metrics, coverage_schedules, etc.)
├── Storage
│   └── /user-photos/{userId}/ (public read, admin write)
└── IAM & Admin
    └── Service account for Nuxt server (Admin SDK credentials)
```

### CI/CD Pipeline
1. **Push to PR branch** → Vercel creates preview deployment automatically (builds + deploys in ~2 min)
2. **Merge to `main`** → Vercel deploys to production (atomic deploy, zero downtime)
3. **Firebase rules/indexes** → Deployed manually via `firebase deploy --only firestore:rules,firestore:indexes`
   - **Future:** GitHub Actions workflow to auto-deploy rules on merge to main

## Security Architecture

### Firestore Security Rules (Enforced at Database Level)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
    }

    // App settings (read: all authenticated, write: admin only)
    match /app_settings/{doc} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Users (read: all authenticated, write: admin only)
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Duty logs (read: all authenticated, write: admin or self)
    match /duty_logs/{logId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
      allow update, delete: if isAdmin();
    }

    // Chaplain payouts (read: admin, write: admin via server only)
    match /chaplain_payouts/{payoutId} {
      allow read: if isAdmin();
      allow write: if false; // Server-side only via Admin SDK
    }

    // Audit log (read: admin, write: server only)
    match /audit_log/{entryId} {
      allow read: if isAdmin();
      allow write: if false; // Server-side only
    }

    // Coverage schedules (read: authenticated, write: admin)
    match /coverage_schedules/{scheduleId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

**Key Security Rules:**
- `chaplain_payouts` and `audit_log` are **write: false** (only server via Admin SDK)
- Admin check queries `app_settings.adminUserIds` dynamically (no role field to manipulate)
- All writes require authentication minimum, most require admin role

### Input Sanitization (Server-Side)
- **XSS Prevention:** All user-submitted text sanitized before storage (strip `<script>`, dangerous HTML)
- **SQL Injection:** N/A (Firestore is NoSQL, uses parameterized queries inherently)
- **CSV Injection:** Escape special characters in CSV export (`=`, `+`, `-`, `@` prefixes)

### Rate Limiting (Nuxt API Routes)
- Simple in-memory store: hash request body, reject duplicates within 30-second window
- Prevents accidental double-submission (e.g., user double-clicks "Process" button)
- Future: Per-IP rate limiting using Vercel Edge Middleware

### Error Monitoring
- **Integrate Sentry** before launch (lightweight error tracking)
- Capture unhandled exceptions in API routes and client-side
- Include context: user ID, page, action, request body (sanitized)
- Critical for stipend processing errors (financial accuracy)

## Acceptance Criteria

- [ ] Nuxt 4 project builds successfully with TypeScript strict mode
- [ ] All 14 API routes are implemented and tested
- [ ] Firebase Admin SDK service account configured in Vercel env vars
- [ ] Firestore security rules deployed and tested (deny direct client writes to sensitive collections)
- [ ] VueFire listeners attach/detach correctly on page mount/unmount
- [ ] Server-side stipend recalculation produces correct totals (validated with test cases)
- [ ] CSV export handles 1000 rows within 10 seconds
- [ ] Coverage grid renders 119 cells in under 500ms
- [ ] Lighthouse scores: Performance >85, Accessibility >90, Best Practices >90
- [ ] Photo uploads compress to <500KB before upload
- [ ] Auth token verification works on all protected API routes
- [ ] Admin role check correctly denies non-admin users

## Open Questions
1. **Firestore indexes:** Which composite indexes are required? (Deploy list TBD based on query analysis)
2. **Backup strategy:** Daily Firestore export to Cloud Storage? Manual or automated?
3. **Error monitoring:** Sentry (preferred) or LogRocket or alternatives?
4. **CDN:** Should Vercel Edge Network be sufficient, or add Cloudflare for DDoS protection?
5. **Database backups:** How long to retain Firestore exports? (30 days? 1 year? Forever?)
6. **Orphaned photos:** Scheduled cleanup job for unreferenced Storage files? Or manual periodic cleanup?
