---
id: build-001-spec-setup
title: "Project Setup Build Spec"
description: "Gap analysis between COMPASS specs and a blank Nuxt 4 project"
type: build
subtype: build-spec
status: draft
sequence: 1
tags: [build, spec, setup]
relatesTo: ["builds/001-mvp/config.md", "docs/core/007-technical.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Project Setup Build Spec

## What a Blank Nuxt 4 Project Provides

When running `npx nuxi init compass-chaplaincy`, you get:

### Directory Structure
```
compass-chaplaincy/
├── .nuxt/              # Build output (gitignored)
├── .output/            # Production build (gitignored)
├── node_modules/       # Dependencies (gitignored)
├── app.vue             # Root component
├── nuxt.config.ts      # Nuxt configuration
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
└── README.md
```

### Out of the Box
- ✅ Vue 3 with Composition API
- ✅ TypeScript support
- ✅ Auto-imports for Vue, Nuxt, and composables
- ✅ File-based routing (when pages/ created)
- ✅ Server API routes (when server/api/ created)
- ✅ Hot module replacement (dev server)
- ✅ SSR + SPA hybrid rendering
- ✅ Production build with optimization

### Not Included
- ❌ Firebase integration (no nuxt-vuefire)
- ❌ Authentication system
- ❌ Database connection
- ❌ UI framework or component library
- ❌ Styling solution (no Tailwind)
- ❌ Data table library
- ❌ Date utilities
- ❌ CSV export library
- ❌ Deployment configuration

## What COMPASS Needs

### 1. Firebase Integration

**Gap:** No Firebase SDK or authentication

**Required packages:**
```json
{
  "nuxt-vuefire": "^1.0.0",
  "vuefire": "^3.0.0",
  "firebase": "^10.0.0",
  "firebase-admin": "^12.0.0"
}
```

**Configuration:**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    'nuxt-vuefire'
  ],
  vuefire: {
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID
    },
    admin: {
      serviceAccount: process.env.NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT
    }
  }
})
```

**Environment variables needed:**
- `NUXT_PUBLIC_FIREBASE_API_KEY`
- `NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NUXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NUXT_PUBLIC_FIREBASE_APP_ID`
- `NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT` (server-only, JSON string)

### 2. Authentication Middleware

**Gap:** No route protection or auth state management

**Required files:**
```typescript
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useCurrentUser() // VueFire composable
  const publicRoutes = ['/login']

  if (!currentUser.value && !publicRoutes.includes(to.path)) {
    return navigateTo(`/login?redirect=${to.fullPath}`)
  }
})
```

```typescript
// composables/useAuth.ts
export function useAuth() {
  const { currentUser } = useCurrentUser()
  const db = useFirestore()
  const settingsRef = doc(db, 'app_settings', 'config')
  const settings = useDocument(settingsRef)

  const isAdmin = computed(() => {
    if (!currentUser.value || !settings.value) return false
    const adminUserIds = settings.value.adminUserIds || []
    return adminUserIds.includes(currentUser.value.uid)
  })

  async function login(email: string, password: string) {
    const auth = useFirebaseAuth()
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    const auth = useFirebaseAuth()
    await signOut(auth)
  }

  return {
    currentUser,
    isAdmin,
    loading: computed(() => settings.pending),
    login,
    logout
  }
}
```

```typescript
// server/utils/auth.ts
import { adminAuth, adminDb } from './firebaseAdmin'

export async function verifyAdmin(event: any) {
  const token = event.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    throw createError({ statusCode: 401, message: 'No token provided' })
  }

  const decodedToken = await adminAuth.verifyIdToken(token)
  const settingsDoc = await adminDb.doc('app_settings/config').get()
  const adminUserIds = settingsDoc.data()?.adminUserIds || []

  if (!adminUserIds.includes(decodedToken.uid)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  return decodedToken
}
```

### 3. Firestore Security Rules

**Gap:** No database security

**Required file:** `firestore.rules`

**Content:**
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

    // App settings: admin read, no write (managed via server)
    match /app_settings/{docId} {
      allow read: if isAdmin();
      allow write: if false; // Server-side only
    }

    // Users: admin write, authenticated read
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Duty logs: admin write, authenticated read
    match /duty_logs/{logId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Chaplain metrics: admin write, authenticated read
    match /chaplain_metrics/{metricId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Coverage schedules: admin write, authenticated read
    match /coverage_schedules/{scheduleId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Financial data: admin-only
    match /chaplain_payouts/{payoutId} {
      allow read, write: if isAdmin();
    }

    match /stipend_records/{recordId} {
      allow read, write: if isAdmin();
    }

    // Chats: authenticated read, no write (handled via chaplain app)
    match /chats/{chatId} {
      allow read: if isAuthenticated();
      allow write: if false;
    }

    match /chat_messages/{messageId} {
      allow read: if isAuthenticated();
      allow write: if false;
    }

    // Audit log: admin read, no write (server-side only)
    match /audit_log/{logId} {
      allow read: if isAdmin();
      allow write: if false;
    }
  }
}
```

**Deployment:**
```bash
firebase deploy --only firestore:rules
```

### 4. Sidebar Layout Component

**Gap:** No navigation or layout structure

**Required files:**
```vue
<!-- components/layout/Sidebar.vue -->
<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <img src="/logo.svg" alt="COMPASS" class="logo" />
      <h1>COMPASS</h1>
    </div>

    <nav class="sidebar-nav">
      <NuxtLink to="/" class="nav-item">
        <Icon name="dashboard" />
        <span>Dashboard</span>
      </NuxtLink>
      <NuxtLink to="/users" class="nav-item">
        <Icon name="users" />
        <span>Users</span>
      </NuxtLink>
      <NuxtLink to="/duty-days" class="nav-item">
        <Icon name="calendar" />
        <span>Duty Days</span>
      </NuxtLink>
      <NuxtLink to="/coverage" class="nav-item">
        <Icon name="grid" />
        <span>Coverage</span>
      </NuxtLink>
      <NuxtLink to="/stipends" class="nav-item">
        <Icon name="dollar" />
        <span>Stipends</span>
      </NuxtLink>
      <NuxtLink to="/reports" class="nav-item">
        <Icon name="chart" />
        <span>Reports</span>
      </NuxtLink>
      <NuxtLink to="/settings" class="nav-item">
        <Icon name="settings" />
        <span>Settings</span>
      </NuxtLink>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info" v-if="currentUser">
        <img :src="currentUser.photoURL || '/default-avatar.png'" alt="User" />
        <span>{{ currentUser.displayName }}</span>
      </div>
      <button @click="logout" class="logout-btn">Logout</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
const { currentUser, logout } = useAuth()
</script>
```

```vue
<!-- layouts/default.vue -->
<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>
```

### 5. Design Tokens (Tailwind)

**Gap:** No styling framework or design system

**Required packages:**
```json
{
  "@nuxtjs/tailwindcss": "^6.0.0",
  "@nuxtjs/google-fonts": "^3.0.0"
}
```

**Configuration:**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts'
  ],
  googleFonts: {
    families: {
      Inter: [400, 500, 600]
    }
  }
})
```

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2D8C',
          dark: '#061B5A',
          light: '#3B65D9',
        },
        accent: '#39D2C0',
        success: '#249689',
        warning: '#F9CF58',
        error: '#E53E3E',
        neutral: {
          dark: '#14181B',
          mid: '#57636C',
          light: '#E0E3E7',
          bg: '#F1F4F8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}
```

### 6. Route Definitions

**Gap:** No pages directory

**Required directory structure:**
```
app/
├── pages/
│   ├── index.vue              # Dashboard
│   ├── login.vue              # Login page
│   ├── users/
│   │   ├── index.vue          # User list
│   │   └── [id].vue           # User detail
│   ├── duty-days.vue          # Duty tracking
│   ├── coverage.vue           # Coverage schedule
│   ├── stipends/
│   │   ├── index.vue          # Stipend processing
│   │   └── [id].vue           # Payout detail
│   ├── reports.vue            # Metrics & reporting
│   └── settings.vue           # Settings
```

All pages initially created as skeletons with basic layout:
```vue
<template>
  <div>
    <h1>Page Title</h1>
    <p>Content goes here...</p>
  </div>
</template>
```

### 7. Data & Utility Libraries

**Gap:** No data tables, date utilities, or CSV export

**Required packages:**
```json
{
  "@tanstack/vue-table": "^8.0.0",
  "date-fns": "^3.0.0",
  "papaparse": "^5.4.0"
}
```

**Usage examples:**
```typescript
// TanStack Table for user list
import { useVueTable, getCoreRowModel } from '@tanstack/vue-table'

// date-fns for stipend period calculations
import { startOfMonth, endOfMonth, format } from 'date-fns'

// papaparse for CSV export
import Papa from 'papaparse'
const csv = Papa.unparse(data)
```

### 8. TypeScript Types

**Gap:** No domain types or Firestore interfaces

**Required file:** `types/firestore.ts`

**Content:**
```typescript
export interface User {
  uid: string
  email: string
  displayName: string
  photoUrl?: string
  phoneNumber?: string
  bio?: string
  translatedBios?: Record<string, string>
  language?: string
  role: 'admin' | 'chaplain' | 'intern' | 'support'
  title?: string
  isChaplain: boolean
  isIntern?: boolean
  isSupportMember?: boolean
  isAfterHours?: boolean
  terminals?: string[]
  onDuty: boolean
  currentStatus?: string
  location?: { lat: number; lng: number }
  totalTime?: number
  createdAt: Date
  lastActiveAt?: Date
  adminEditedAt?: Date
  adminEditedBy?: string
}

export interface DutyLog {
  userId: string
  startTime: Date
  endTime?: Date
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
  hasAdjustment?: boolean
  checkNumber?: string
  payoutId?: string
  processedBy?: string
  processedAt?: Date
}

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
  createdAt: Date
  createdBy: string
}

export interface StipendRecord {
  chaplainId: string
  chaplainName: string
  monthName: string
  year: number
  startDate: Date
  endDate: Date
  instancesAuthorized: number
  instancesPaid?: number
  stipendAmount?: number
  adjustmentAmount?: number
  hasAdjustment?: boolean
  isCompleted: boolean
  completedAt?: Date
  processedBy?: string
}

export interface CoverageSchedule {
  weekNumber: number
  year: number
  slots: Record<string, Record<number, boolean>> // { monday: { 5: true, 6: false, ... }, ... }
  updatedAt?: Date
  updatedBy?: string
}

export interface AppSettings {
  adminUserIds: string[]
  stipendRate: number
  currentYear: number
}

export interface AuditLog {
  action: 'profile_edit' | 'stipend_approve' | 'payout_create' | 'coverage_edit' | 'role_change' | 'settings_update'
  adminId: string
  targetId?: string
  targetCollection?: string
  details?: Record<string, any>
  createdAt: Date
}

// Additional types for chaplain_metrics, chats, chat_messages...
```

### 9. Vercel Deployment Configuration

**Gap:** No deployment setup

**Required file:** `vercel.json`

**Content:**
```json
{
  "framework": "nuxt",
  "buildCommand": "nuxt build",
  "outputDirectory": ".output",
  "installCommand": "pnpm install",
  "env": {
    "NUXT_PUBLIC_FIREBASE_API_KEY": "@firebase-api-key",
    "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN": "@firebase-auth-domain",
    "NUXT_PUBLIC_FIREBASE_PROJECT_ID": "@firebase-project-id",
    "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET": "@firebase-storage-bucket",
    "NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "@firebase-messaging-sender-id",
    "NUXT_PUBLIC_FIREBASE_APP_ID": "@firebase-app-id",
    "NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT": "@firebase-admin-sa"
  }
}
```

**Vercel secrets to create:**
```bash
vercel secrets add firebase-api-key "AIza..."
vercel secrets add firebase-auth-domain "compass-chaplaincy.firebaseapp.com"
vercel secrets add firebase-project-id "compass-chaplaincy"
vercel secrets add firebase-storage-bucket "compass-chaplaincy.appspot.com"
vercel secrets add firebase-messaging-sender-id "123456789"
vercel secrets add firebase-app-id "1:123456789:web:abc123"
vercel secrets add firebase-admin-sa '{"type":"service_account",...}'
```

### 10. Firebase Project Setup

**Gap:** No Firebase project

**Required steps:**
1. Go to Firebase Console (https://console.firebase.google.com)
2. Create new project: `compass-chaplaincy`
3. Enable Firebase Auth → Email/Password provider
4. Create Firestore database (production mode)
5. Create Storage bucket
6. Generate service account key (Project Settings → Service Accounts → Generate new private key)
7. Copy Firebase config (Project Settings → General → Your apps → Web app config)
8. Add config to `.env.local` and Vercel environment variables

## Gap Summary

| Component | Blank Nuxt | COMPASS Needs | Status |
|-----------|-----------|---------------|--------|
| Framework | ✅ Nuxt 4 | ✅ Nuxt 4 | Ready |
| Auth | ❌ None | ✅ Firebase Auth + middleware | To build |
| Database | ❌ None | ✅ Firestore + security rules | To build |
| UI | ❌ None | ✅ Tailwind + design tokens | To configure |
| Layout | ❌ None | ✅ Sidebar nav + responsive | To build |
| Data Tables | ❌ None | ✅ TanStack Table | To install |
| Date Utils | ❌ None | ✅ date-fns | To install |
| CSV Export | ❌ None | ✅ papaparse | To install |
| Types | ❌ Generic | ✅ Domain-specific | To define |
| Routes | ❌ None | ✅ 10 pages | To create |
| Deployment | ❌ None | ✅ Vercel config | To configure |

## Installation Checklist

- [ ] Run `npx nuxi init compass-chaplaincy`
- [ ] Install Firebase packages: `pnpm add nuxt-vuefire vuefire firebase firebase-admin`
- [ ] Install UI packages: `pnpm add @nuxtjs/tailwindcss @nuxtjs/google-fonts`
- [ ] Install data packages: `pnpm add @tanstack/vue-table date-fns papaparse`
- [ ] Configure nuxt.config.ts (VueFire, Tailwind, Google Fonts)
- [ ] Create tailwind.config.ts with design tokens
- [ ] Create Firebase project in Firebase Console
- [ ] Enable Auth, Firestore, Storage
- [ ] Create firestore.rules and deploy
- [ ] Create types/firestore.ts with domain interfaces
- [ ] Create middleware/auth.global.ts
- [ ] Create composables/useAuth.ts
- [ ] Create server/utils/auth.ts
- [ ] Create components/layout/Sidebar.vue
- [ ] Create layouts/default.vue
- [ ] Create pages/ directory with 10 route files (skeletons)
- [ ] Create .env.local with Firebase credentials
- [ ] Create vercel.json with deployment config
- [ ] Push to GitHub and connect to Vercel
- [ ] Add Vercel secrets for Firebase credentials
- [ ] Deploy preview and verify

## Estimated Effort

- Package installation and configuration: **2 hours**
- Firebase project setup: **1 hour**
- Firestore security rules: **2 hours**
- TypeScript types: **1 hour**
- Auth system (middleware, composables, server utils): **3 hours**
- Sidebar layout and page skeletons: **2 hours**
- Vercel deployment: **1 hour**

**Total: ~12 hours (1.5 days)**
