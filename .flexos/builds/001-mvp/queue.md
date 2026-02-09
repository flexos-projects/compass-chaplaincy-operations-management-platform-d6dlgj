---
id: build-001-queue
title: "Build Queue"
description: "Task execution queue with status tracking for COMPASS MVP"
type: build
subtype: queue
status: draft
sequence: 4
tags: [build, queue, tasks]
relatesTo: ["builds/001-mvp/plan.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Build Queue

## Status Legend

- **pending** -- Not started, waiting for dependencies
- **in-progress** -- Currently being worked on
- **blocked** -- Cannot proceed due to blocker (requires user input or external dependency)
- **complete** -- Task finished and tested
- **skipped** -- Intentionally skipped or deferred to later phase

## Task Queue

| ID | Task | Phase | Status | Dependencies | Spec Refs |
|----|------|-------|--------|--------------|-----------|
| T-001 | Project scaffolding (Nuxt 4, Firebase, Vercel config) | 1 | pending | none | docs/core/007-technical.md |
| T-002 | Firebase Auth + role-based route guards | 1 | pending | T-001 | specs/002-features_authentication-rbac.md, specs/011-pages_login.md |
| T-003 | Firestore security rules + collection schemas | 1 | pending | T-001 | docs/core/004-database.md, specs/018-database_users-collection.md |
| T-004 | App layout (sidebar nav, COMPASS branding, responsive shell) | 1 | pending | T-002 | specs/003-pages_dashboard.md |
| T-005 | Login page | 1 | pending | T-002 | specs/011-pages_login.md |
| T-006 | Dashboard page with KPI cards | 2 | pending | T-004, T-003 | specs/003-pages_dashboard.md, specs/004-features_dashboard-kpis.md |
| T-007 | User management (list, search, filter, detail, edit, photo upload) | 2 | pending | T-004, T-003 | specs/012-pages_users.md, specs/013-pages_user-detail.md, specs/005-features_user-management.md |
| T-008 | Duty day tracking + coverage schedule grid | 2 | pending | T-007 | specs/014-pages_duty-days.md, specs/015-pages_coverage-schedule.md, specs/006-features_duty-tracking.md |
| T-009 | Stipend processing workflow (period selection, qualification, payout) | 2 | pending | T-008 | specs/016-pages_stipends.md, specs/017-pages_stipend-detail.md, specs/007-features_stipend-processing.md |
| T-010 | Reports page with metrics aggregation + CSV export | 3 | pending | T-009 | specs/025-pages_reports.md, specs/008-features_metrics-reporting.md |
| T-011 | Audit log system | 3 | pending | T-007, T-009 | specs/009-features_audit-log.md |
| T-012 | Chat monitoring (read-only), settings page, production hardening | 3 | pending | T-010, T-011 | specs/010-features_settings-config.md, specs/026-pages_settings.md |

## Current Focus

**Phase 1 Foundation**

Next task to start: **T-001 Project scaffolding**

## Task Details

### T-001: Project scaffolding
**Estimate:** 4-6 hours

**Steps:**
1. Run `npx nuxi init compass-chaplaincy`
2. Install dependencies: `pnpm add nuxt-vuefire vuefire @tanstack/vue-table date-fns papaparse`
3. Install dev dependencies: `pnpm add -D @nuxtjs/google-fonts @nuxtjs/tailwindcss`
4. Configure `nuxt.config.ts` with VueFire module
5. Set up `tailwind.config.ts` with COMPASS design tokens
6. Create `vercel.json` with build config
7. Initial commit and push to GitHub
8. Connect to Vercel, deploy preview

**Acceptance:** Empty Nuxt app deploys to Vercel, Tailwind configured, dependencies installed.

---

### T-002: Firebase Auth + role-based route guards
**Estimate:** 1 day

**Steps:**
1. Create Firebase project `compass-chaplaincy` in Firebase Console
2. Enable email/password auth provider
3. Configure nuxt-vuefire with Firebase credentials
4. Create `composables/useAuth.ts` with login, logout, isAdmin check
5. Create `middleware/auth.global.ts` for route protection
6. Create `server/utils/auth.ts` for server-side token verification
7. Add environment variables to `.env` and Vercel

**Acceptance:** Auth composable works, middleware redirects unauthenticated users to login, server utility verifies tokens.

---

### T-003: Firestore security rules + collection schemas
**Estimate:** 1 day

**Steps:**
1. Create `firestore.rules` with admin-only writes for financial collections
2. Create `firestore.indexes.json` with composite indexes
3. Define TypeScript interfaces in `types/firestore.ts` for all 10 collections
4. Create app_settings/config document with stipendRate and adminUserIds
5. Seed test admin user in users collection
6. Seed 5-10 test chaplain users
7. Deploy rules: `firebase deploy --only firestore:rules`
8. Test rules with Firebase Console (try read/write as unauthenticated user)

**Acceptance:** All collections have security rules, test data seeded, rules tested and working.

---

### T-004: App layout (sidebar nav, COMPASS branding, responsive shell)
**Estimate:** 1 day

**Steps:**
1. Create `components/layout/Sidebar.vue` with nav items
2. Add COMPASS logo and brand colors
3. Add user avatar + name at top (from useAuth)
4. Add logout button
5. Make collapsible on tablet (hamburger icon)
6. Create `layouts/default.vue` with sidebar + main content area
7. Test responsive behavior (desktop, tablet)

**Acceptance:** Sidebar displays on all pages, navigation works, responsive on tablet, logout button functional.

---

### T-005: Login page
**Estimate:** 0.5 day

**Steps:**
1. Create `pages/login.vue` with email/password form
2. Wire up to useAuth.login()
3. Add error display for invalid credentials
4. Add "Forgot password?" link (triggers Firebase password reset)
5. Success redirects to dashboard or ?redirect path
6. Add COMPASS branding

**Acceptance:** Admin can log in, invalid credentials show error, redirect works, password reset link triggers email.

---

### T-006: Dashboard page with KPI cards
**Estimate:** 2 days

**Steps:**
1. Create `composables/useDashboard.ts` with Firestore queries
2. Create `components/dashboard/KPICard.vue` component
3. Create `components/dashboard/OnDutyList.vue` component
4. Create `pages/index.vue` with 8 KPI cards
5. Wire up real-time Firestore listeners for:
   - Total users count
   - Active chaplains count
   - On-duty count
   - New signups (7d, 30d)
   - Encounter count
   - Duty log count
6. Add loading skeletons
7. Add empty state ("No data available")

**Acceptance:** Dashboard displays all KPIs with real data, updates in real-time, loading states work.

---

### T-007: User management (list, search, filter, detail, edit, photo upload)
**Estimate:** 3 days

**Steps:**
1. Create `composables/useUsers.ts` with Firestore query + pagination
2. Create `pages/users/index.vue` with search bar and role filters
3. Create `components/users/UserList.vue` with user cards
4. Create `pages/users/[id].vue` with profile detail
5. Create `composables/useUserDetail.ts` with user fetch + duty/stipend history
6. Create `components/users/ProfileEditForm.vue` with all fields
7. Implement photo upload (compress, upload to Storage, update photoUrl)
8. Create `server/api/users/[id]/update.post.ts` for profile updates
9. Add audit_log entry creation to server route
10. Test on desktop and tablet

**Acceptance:** User list search works, role filters work, profile edit saves, photo upload works, audit log entry created.

---

### T-008: Duty day tracking + coverage schedule grid
**Estimate:** 4 days

**Steps:**
1. Create `composables/useDutyDays.ts` with duty log queries
2. Create `pages/duty-days.vue` with terminal distribution and chaplain hours
3. Create `components/duty/TerminalDistribution.vue` (bar chart)
4. Create `components/duty/DutyLogList.vue` (table)
5. Create `composables/useCoverage.ts` with coverage schedule queries
6. Create `pages/coverage.vue` with 7x17 grid
7. Create `components/coverage/CoverageGrid.vue` with edit mode
8. Create `components/coverage/WeekSelector.vue` for navigation
9. Implement slot toggle (update nested Firestore field)
10. Test normalized storage (not 119 flat booleans)
11. Test on tablet with touch

**Acceptance:** Duty days page shows terminal distribution and chaplain hours, coverage grid displays correctly, edit mode toggles slots, data persists in normalized format.

---

### T-009: Stipend processing workflow (period selection, qualification, payout)
**Estimate:** 5 days

**Steps:**
1. Create `composables/useStipends.ts` with period queries
2. Create `pages/stipends/index.vue` with month selector
3. Create `components/stipends/PeriodSelector.vue` (month chips)
4. Create `components/stipends/QualifyingChaplainsList.vue` with expandable entries
5. Create `components/stipends/StipendAdjustmentSlider.vue` for per-entry adjustments
6. Implement batch selection checkboxes
7. Create check number modal
8. Create `server/api/stipends/process.post.ts` with server-side recalculation
9. Implement Firestore batch write (payouts + duty log updates + stipend records + audit log)
10. Create `pages/stipends/[id].vue` for payout detail view
11. Test end-to-end cycle (select month → adjust → process → verify)

**Acceptance:** Stipend processing creates immutable payout records, duty logs marked as paid, stipend history displays past payouts, server recalculates amounts (client totals ignored).

---

### T-010: Reports page with metrics aggregation + CSV export
**Estimate:** 2 days

**Steps:**
1. Create `composables/useReports.ts` with metrics queries
2. Create `pages/reports.vue` with date range and filter controls
3. Implement encounter metrics aggregation (by type)
4. Implement duty hours aggregation (by chaplain, terminal)
5. Implement stipend totals aggregation (by month, YTD)
6. Create `server/api/reports/export.get.ts` with papaparse CSV generation
7. Add export buttons (one per section)
8. Test CSV download (opens in Excel)

**Acceptance:** Reports page displays aggregated metrics, filters work, CSV export downloads valid file with filtered data.

---

### T-011: Audit log system
**Estimate:** 1 day

**Steps:**
1. Add audit logging to coverage slot edits
2. Add audit logging to settings updates
3. (Optional) Create `/audit` page for admin review
4. Query audit_log collection with pagination
5. Display log entries (timestamp, admin, action, details)

**Acceptance:** All admin actions logged (profile edits, stipend processing, coverage edits, settings updates), audit log page displays entries.

---

### T-012: Chat monitoring (read-only), settings page, production hardening
**Estimate:** 2 days

**Steps:**
1. Create `pages/chats.vue` with chat thread list
2. Create `composables/useChats.ts` with queries
3. Display messages (read-only, no send)
4. Create `pages/settings.vue` with stipend rate and admin user management
5. Create `composables/useSettings.ts` with app_settings query
6. Create `server/api/settings/update.post.ts` with validation
7. Test responsive layout on all pages (tablet)
8. Add loading skeletons and empty states to all pages
9. Add error boundaries to all composables
10. Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
11. Production QA pass (manual testing checklist)

**Acceptance:** Chat monitoring works (read-only), settings page updates stipend rate and admin users, all pages responsive on tablet, all loading/empty/error states render, indexes deployed.

## Blockers

None currently. All dependencies are internal to the project.

## Notes

- Each task should be committed separately with a descriptive commit message.
- Update this queue.md file after completing each task (change status to `complete`).
- If a task is blocked, note the blocker and move to the next unblocked task.
- Estimated times are for an experienced developer. Adjust as needed based on actual progress.
