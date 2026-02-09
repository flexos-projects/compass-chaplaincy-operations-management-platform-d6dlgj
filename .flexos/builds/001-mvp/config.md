---
id: build-001-config
title: "MVP Build Configuration"
description: "Stack, scope, and deployment configuration for COMPASS MVP build"
type: build
subtype: config
status: draft
sequence: 1
tags: [build, config, mvp]
relatesTo: ["docs/core/007-technical.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# MVP Build Configuration

## Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Nuxt 4 | Latest | SSR + SPA + API routes |
| **Frontend** | Vue 3 | 3.5+ | Composition API, `<script setup>` |
| **Language** | TypeScript | 5.x | Type safety throughout |
| **Styling** | Tailwind CSS | Latest | Utility-first CSS, custom tokens |
| **Auth** | Firebase Auth | v10+ | Email/password authentication |
| **Database** | Cloud Firestore | Latest | Real-time NoSQL database |
| **Storage** | Firebase Storage | Latest | Profile photo uploads |
| **Hosting** | Vercel | Latest | Edge deployment + serverless functions |
| **Fonts** | Inter | 400/500/600 | Via @nuxtjs/google-fonts |

## Core Packages

```json
{
  "dependencies": {
    "nuxt": "^4.0.0",
    "vue": "^3.5.0",
    "nuxt-vuefire": "^1.0.0",
    "vuefire": "^3.0.0",
    "firebase": "^10.0.0",
    "firebase-admin": "^12.0.0",
    "@tanstack/vue-table": "^8.0.0",
    "date-fns": "^3.0.0",
    "papaparse": "^5.4.0"
  },
  "devDependencies": {
    "@nuxtjs/google-fonts": "^3.0.0",
    "@nuxtjs/tailwindcss": "^6.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Scope Definition

### Phase 1: Foundation (Week 1)
All P0 features required for authentication, navigation, and data infrastructure:
- Firebase Auth integration (email/password)
- Role-based route guards (admin-only access)
- Firestore security rules (role-based read/write)
- Sidebar navigation layout
- Login page
- Dashboard skeleton
- User collection schema

**Deliverable:** Admin can log in, see the dashboard skeleton, and navigate between pages.

### Phase 2: Core Features (Weeks 2-4)
All P0 operational features:
- Dashboard with live KPI cards (7+ metrics)
- User management (list, search, filter by role)
- User profile detail and editing (including photo upload)
- Duty day tracking with terminal distribution
- Coverage schedule grid (7x17, view + edit mode)
- Stipend processing workflow (full cycle: select period → apply adjustments → enter check number → create payout)
- Stipend history (monthly/YTD/all-time per chaplain)

**Deliverable:** Admin can complete end-to-end stipend processing for a pay period.

### Phase 3: Polish & Launch (Week 5)
All P1 features for reporting, audit, and production readiness:
- Reports page with encounter metrics aggregation
- CSV data export (encounters, duty hours, stipends)
- Audit log collection and display
- Settings page (stipend rate, admin users, program year)
- Responsive tablet layout
- Chat monitoring (read-only, P2 but fast to implement)
- Error handling and loading states on all pages
- Production Firestore indexes

**Deliverable:** System ready for production launch with full reporting and audit capabilities.

## Output Paths

```
compass-chaplaincy/
├── nuxt.config.ts              # Nuxt configuration
├── tailwind.config.ts           # Tailwind + design tokens
├── app/
│   ├── pages/
│   │   ├── login.vue
│   │   ├── index.vue            # Dashboard
│   │   ├── users/
│   │   │   ├── index.vue
│   │   │   └── [id].vue
│   │   ├── duty-days.vue
│   │   ├── coverage.vue
│   │   ├── stipends/
│   │   │   ├── index.vue
│   │   │   └── [id].vue
│   │   ├── reports.vue
│   │   └── settings.vue
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useDashboard.ts
│   │   ├── useUsers.ts
│   │   ├── useUserDetail.ts
│   │   ├── useDutyDays.ts
│   │   ├── useCoverage.ts
│   │   ├── useStipends.ts
│   │   ├── useReports.ts
│   │   └── useSettings.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.vue
│   │   │   └── PageHeader.vue
│   │   ├── dashboard/
│   │   │   ├── KPICard.vue
│   │   │   └── OnDutyList.vue
│   │   ├── users/
│   │   │   ├── UserList.vue
│   │   │   ├── UserCard.vue
│   │   │   └── ProfileEditForm.vue
│   │   ├── duty/
│   │   │   ├── DutyLogList.vue
│   │   │   └── TerminalDistribution.vue
│   │   ├── coverage/
│   │   │   ├── CoverageGrid.vue
│   │   │   └── WeekSelector.vue
│   │   └── stipends/
│   │       ├── PeriodSelector.vue
│   │       ├── QualifyingChaplainsList.vue
│   │       └── StipendAdjustmentSlider.vue
│   └── middleware/
│       └── auth.global.ts       # Auth guard
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   └── verify.post.ts
│   │   ├── users/
│   │   │   ├── index.get.ts
│   │   │   └── [id]/update.post.ts
│   │   ├── stipends/
│   │   │   ├── qualifying.get.ts
│   │   │   ├── process.post.ts
│   │   │   └── summary.get.ts
│   │   ├── coverage/
│   │   │   └── [weekYear].patch.ts
│   │   ├── reports/
│   │   │   ├── encounters.get.ts
│   │   │   ├── duty-hours.get.ts
│   │   │   └── export.get.ts
│   │   └── settings/
│   │       ├── index.get.ts
│   │       └── update.post.ts
│   └── utils/
│       ├── firebaseAdmin.ts     # Admin SDK setup
│       └── auth.ts              # Token verification
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Composite indexes
└── vercel.json                  # Deployment config
```

## Environment Variables

### Required for Development
```bash
# Firebase Client SDK (public)
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-only, JSON service account)
NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT=
```

### Required for Production (Vercel)
Same as above, configured in Vercel dashboard as environment variables. The Admin SDK service account should be stored as a Vercel secret (`@firebase-admin-sa`) and referenced in `vercel.json`.

## Design Tokens

From the imported FlutterFlow app, mapped to Tailwind config:

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

## Success Criteria

The MVP build is complete when:

1. **Authentication works end-to-end:** Admin can log in with email/password, non-admin is rejected, logout works, session persists across page refreshes.
2. **Dashboard loads real data:** All 7+ KPI cards pull from Firestore and update in real-time (on-duty count, new signups, encounter metrics).
3. **User management is fully functional:** Admin can search, filter, edit any user profile, upload photos, and see audit timestamps.
4. **Coverage grid works:** Admin can toggle the 7x17 grid in edit mode, changes save instantly, data persists normalized (not 119 flat booleans).
5. **Stipend processing completes:** Admin can select January, see qualifying chaplains, apply adjustments, batch-select entries, enter check number, create immutable payout records, and see running totals update.
6. **Reports export data:** Admin can filter encounter metrics, view duty hour summaries, and export any data view to CSV.
7. **Security rules enforce access:** All Firestore rules tested -- unauthorized reads/writes rejected, admin writes succeed, audit log entries created.
8. **Responsive on tablet:** Dashboard, users, duty, coverage, and stipends pages tested on iPad with no layout breakage or usability issues.
9. **Deployed to production:** Vercel deployment pipeline working, Firebase indexes deployed, error monitoring active.

## Non-Goals for MVP

These are explicitly out of scope for the MVP build:
- Google/Apple sign-in (Phase 1 is email/password only)
- Push notifications or email alerts
- Automated scheduling or shift suggestions
- Multi-airport tenancy (single DFW Airport deployment)
- Board member read-only portal
- Advanced charting or data visualization (simple tables and counts only)
- Electronic payment integration (check-based stipends only)
- Bulk user import via CSV (manual user creation only)
