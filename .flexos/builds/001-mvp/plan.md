---
id: build-001-plan
title: "MVP Build Plan"
description: "Phased execution plan for building COMPASS from scratch"
type: build
subtype: plan
status: draft
sequence: 3
tags: [build, plan, phases]
relatesTo: ["builds/001-mvp/config.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# MVP Build Plan

## Build Philosophy

COMPASS is a **fresh build from scratch** on Nuxt 4 + Firebase. This is NOT a migration, refactor, or fix of the existing FlutterFlow app. We are building a new admin dashboard that implements the validated domain logic and data model from the original app while fixing its architecture, security, and usability problems.

**Build priorities:**
1. **Security first** -- Firestore rules written before UI components
2. **Mobile-responsive from day one** -- Desktop + tablet, no mobile-only pages
3. **Server-side financial logic** -- All stipend calculations happen in API routes
4. **Real-time where it matters** -- Dashboard KPIs and on-duty status use Firestore listeners
5. **Immutable financial records** -- Payouts are append-only, never edited

## Phase 1: Foundation

**Goal:** Authentication, layout, navigation, and core data infrastructure.

**Duration:** 1 week (5 working days)

### Deliverables

1. **Nuxt 4 project scaffolding**
   - `npx nuxi init compass-chaplaincy`
   - Install dependencies: nuxt-vuefire, @tanstack/vue-table, date-fns, papaparse
   - Configure nuxt.config.ts with VueFire module
   - Set up Tailwind with COMPASS design tokens
   - Deploy to Vercel (initial empty deploy)

2. **Firebase integration**
   - Create Firebase project: `compass-chaplaincy`
   - Enable Firebase Auth (email/password provider)
   - Create Firestore database (production mode)
   - Set up Firebase Storage bucket
   - Configure nuxt-vuefire with client SDK credentials
   - Add Firebase Admin SDK to server utilities

3. **Firestore security rules**
   - Write rules for all 10 collections (users, duty_logs, chaplain_metrics, coverage_schedules, chaplain_payouts, stipend_records, chats, chat_messages, audit_log, app_settings)
   - Default deny, admin-only writes for financial data
   - Authenticated reads for non-sensitive collections
   - Server-only writes for audit_log
   - Deploy rules: `firebase deploy --only firestore:rules`

4. **Firestore collection schemas**
   - Define TypeScript interfaces in `~/types/firestore.ts` for all collections
   - Create initial app_settings/config document with:
     - `adminUserIds: []` (to be populated with first admin)
     - `stipendRate: 80`
     - `currentYear: 2026`
   - Seed one test admin user in users collection
   - Seed 5-10 test chaplain users

5. **Authentication system**
   - Create `useAuth` composable:
     - `currentUser` (VueFire)
     - `isAdmin` (checks app_settings.adminUserIds)
     - `login(email, password)`
     - `logout()`
   - Create global auth middleware: `middleware/auth.global.ts`
     - Redirect to `/login?redirect={path}` if not authenticated
     - Allow `/login` without auth
   - Create server utility: `server/utils/auth.ts`
     - `verifyAdmin(event)` -- validates token and checks admin role

6. **Login page**
   - `app/pages/login.vue`
   - Email and password inputs
   - "Forgot password?" link (triggers Firebase password reset email)
   - Error display for invalid credentials
   - Success redirects to dashboard (or ?redirect path)
   - COMPASS branding (logo, colors from design tokens)

7. **Sidebar navigation layout**
   - `app/components/layout/Sidebar.vue`
   - Nav items: Dashboard, Users, Duty Days, Coverage, Stipends, Reports, Settings
   - Active state highlighting (based on current route)
   - User avatar + name at top (from currentUser)
   - Logout button at bottom
   - Collapsible on tablet (hamburger icon)
   - COMPASS logo at top

8. **Dashboard skeleton**
   - `app/pages/index.vue`
   - Empty KPI card grid (8 cards with placeholder text)
   - Page header: "Operations Dashboard"
   - No real data yet -- just layout and structure
   - Uses sidebar layout

### Success Criteria

- [ ] Admin can log in with email/password
- [ ] Non-admin users are rejected at dashboard (redirect to unauthorized page)
- [ ] Logout works (clears session, redirects to login)
- [ ] Navigation between all 8 pages works (pages can be skeletons)
- [ ] Firestore security rules tested:
  - [ ] Unauthenticated read of users collection is rejected
  - [ ] Authenticated read of users collection succeeds
  - [ ] Non-admin write to chaplain_payouts is rejected
  - [ ] Admin write to chaplain_payouts succeeds (via server API)
- [ ] Vercel deployment successful (can visit compass-preview.vercel.app)

### Dependency Graph

```
Project scaffolding
  ├── Firebase integration
  │   ├── Firestore security rules
  │   └── Firestore collection schemas
  ├── Authentication system
  │   ├── useAuth composable
  │   ├── Auth middleware
  │   └── Login page
  └── Sidebar navigation layout
      └── Dashboard skeleton
```

## Phase 2: Core Features

**Goal:** All primary management workflows operational.

**Duration:** 3 weeks (15 working days)

### Deliverables

1. **Dashboard with live KPIs** (2 days)
   - Create `useDashboard` composable
   - Real-time Firestore queries:
     - Total users count
     - Active chaplains count (isChaplain === true)
     - On-duty count (onDuty === true)
     - New signups (7-day and 30-day: createdAt >= date)
     - Encounter count (chaplain_metrics: dateCollected >= date)
     - Duty log count (duty_logs: startTime >= date)
   - KPI cards with trend indicators (7d vs 30d comparison)
   - On-duty chaplain list (name, photo, time on duty)
   - Recent duty log entries (last 10, with chaplain name and duration)
   - Coverage summary widget (current week coverage percentage)

2. **User management list** (2 days)
   - `app/pages/users/index.vue`
   - Create `useUsers` composable:
     - Firestore query with pagination (50 users per page)
     - Real-time listener on users collection
     - Filter by role (all, chaplains only, interns only, support only)
     - Search by name or email (client-side filter)
   - Components:
     - Search bar (debounced input)
     - Role filter chips (All Users, Chaplains, Interns, Support)
     - User list with avatar, name, email, role, on-duty badge
     - User count summary ("Showing 42 of 127 users")
   - Click user row → navigate to `/users/{id}`

3. **User profile detail & editing** (3 days)
   - `app/pages/users/[id].vue`
   - Create `useUserDetail` composable:
     - Fetch single user document (real-time)
     - Fetch user's duty history (last 20 shifts)
     - Fetch user's stipend history (last 12 months)
   - Components:
     - Profile header (large avatar, name, role, status)
     - Personal info form (name, email, phone, bio, title)
     - Role toggles (chaplain, intern, support, after-hours)
     - Terminal assignment checkboxes (A, B, C, D)
     - Photo upload (compress to 800x800, upload to Storage, update photoUrl)
     - Duty history table (date, hours, terminal)
     - Stipend history table (month, amount, status)
   - Server API route: `POST /api/users/:id/update`
     - Verify admin
     - Update user document
     - Create audit_log entry (action: profile_edit, before/after values)
   - Save button (disabled during upload/save)
   - Success/error toast notifications

4. **Duty day tracking** (3 days)
   - `app/pages/duty-days.vue`
   - Create `useDutyDays` composable:
     - Query duty_logs collection (paginated, date range filter)
     - Calculate terminal distribution (count by terminal, percentage)
     - Calculate per-chaplain hours (group by userId, sum totalHours)
     - Support time period filters: all-time, 30-day, 7-day
   - Components:
     - Period filter buttons (All Time, 30 Days, 7 Days)
     - Terminal distribution chart (5 bars: A-E with percentages)
     - Chaplain hours table (name, all-time, 30d, 7d columns, sortable)
     - Duty log list (date, chaplain, hours, terminal, approved status)
   - No editing on this page -- read-only duty log review

5. **Coverage schedule grid** (4 days)
   - `app/pages/coverage.vue`
   - Create `useCoverage` composable:
     - Query coverage_schedules collection (by week number + year)
     - Create document if not exists (initialize all slots to false)
     - Week navigation (prev/next buttons)
     - Toggle slot function (update nested map field)
   - Components:
     - Week selector (current week, prev, next)
     - Coverage grid (7 columns [days] x 17 rows [hours 5-21])
       - Each cell: checkbox or toggle button
       - Covered = green checkmark, uncovered = empty gray cell
     - Admin mode toggle (switches from view to edit mode)
     - Coverage summary stats (X out of 119 slots covered, Y% coverage)
     - Gap indicators (highlight uncovered slots in red in view mode)
   - Edit mode:
     - Click any cell to toggle coverage status
     - Auto-save to Firestore on every toggle (no save button)
     - Loading indicator during write
   - View mode:
     - Cells are non-interactive, show coverage status only
   - Normalized storage:
     - Document: `coverage_schedules/{weekNumber}-{year}`
     - Field: `slots.monday.5: true` (not 119 flat booleans)

6. **Stipend processing workflow** (5 days)
   - `app/pages/stipends/index.vue`
   - Create `useStipends` composable:
     - Fetch app_settings for current stipend rate
     - Query duty_logs for a date range (pay period)
     - Filter for unpaid shifts (isPaid === false, approved === true)
     - Group by chaplainId
     - Calculate base amounts (count × stipend rate)
     - Track adjustments (per entry, stored in memory until processing)
     - Batch processing function (calls server API)
   - Components:
     - Month selector chips (Jan, Feb, ..., Dec)
     - Period summary (date range, qualifying shift count, total estimated)
     - Qualifying chaplains list (name, shift count, calculated amount, expandable)
     - Duty entry table (for selected chaplain: date, hours, base amount, adjustment slider)
     - Adjustment slider (+/- $100 range, default 0)
     - Batch selection checkboxes (select all, select chaplain's all entries)
     - Payout totals panel (running total, selected count, adjustment total)
     - Check number modal (text input, appears before final processing)
     - Process button (disabled until check number entered)
   - Server API route: `POST /api/stipends/process`
     - Verify admin
     - Fetch current stipend rate from app_settings
     - Recalculate amounts from duty_logs (ignore client totals)
     - Firestore batch write:
       1. Create chaplain_payouts documents (one per chaplain with selected entries)
       2. Update duty_logs (isPaid: true, paymentAmount, checkNumber, payoutId, processedBy, processedAt)
       3. Create/update stipend_records (per chaplain per month summary)
       4. Create audit_log entries (action: payout_create)
     - Return success + payout IDs
   - Post-processing:
     - Refresh duty log query (paid entries now show green badge)
     - Clear selections and adjustments
     - Show success toast with payout summary

7. **Stipend history** (integrated into stipends page) (1 day)
   - Add tabs to stipends page: "Process" and "History"
   - History tab:
     - Query chaplain_payouts (ordered by createdAt desc, paginated)
     - Display payout cards (chaplain name, month, amount, check number, date processed)
     - Click card → navigate to `/stipends/{payoutId}`
   - `app/pages/stipends/[id].vue`
     - Fetch single payout record
     - Fetch related duty_logs (by payoutId)
     - Display:
       - Payout header (chaplain, month, total amount, check number)
       - Duty entries list (date, hours, base amount, adjustment, subtotal)
       - Amount breakdown table (base total, adjustments, final total)
       - Audit info (processed by, processed at)
     - No editing (immutable record)

### Success Criteria

- [ ] Dashboard loads with real-time KPI data (all 7+ cards populated)
- [ ] Dashboard updates in real-time (chaplain goes on duty → on-duty count increments within 5 seconds)
- [ ] User list search works (typing "John" filters to users with "John" in name or email)
- [ ] User role filter works (clicking "Chaplains" shows only chaplains)
- [ ] User profile edit saves successfully (admin updates name → Firestore document updates, audit_log entry created)
- [ ] User photo upload works (admin uploads image → compressed, stored in Storage, photoUrl updated in Firestore)
- [ ] Duty day page shows terminal distribution (5 terminals with percentages that sum to ~100%)
- [ ] Duty day page shows per-chaplain hours (sortable table, all-time/30d/7d columns)
- [ ] Coverage grid displays current week (7x17 grid with coverage status)
- [ ] Coverage grid edit mode works (admin toggles slots → Firestore updates immediately)
- [ ] Coverage grid week navigation works (prev/next buttons load correct week)
- [ ] Stipend page shows qualifying chaplains for selected month
- [ ] Stipend adjustment slider works (moving slider updates preview total)
- [ ] Stipend processing creates immutable payout records (payout document created, duty logs updated, cannot be re-selected)
- [ ] Stipend history shows past payouts (sorted by date, paginated)
- [ ] Stipend detail page shows full payout breakdown (entries + amounts + audit info)

### Dependency Graph

```
Dashboard with KPIs
  └── (depends on Phase 1: auth, layout, Firestore schemas)

User management list
  └── User profile detail & editing
      └── (depends on Phase 1: auth, layout)

Duty day tracking
  └── Coverage schedule grid
      └── (depends on Phase 1: Firestore schemas)

Stipend processing workflow
  ├── (depends on duty day tracking for duty_logs data)
  ├── (depends on user management for chaplain data)
  └── Stipend history
      └── (depends on stipend processing for payout records)
```

## Phase 3: Polish & Launch

**Goal:** Reporting, audit trail, responsive design, and production hardening.

**Duration:** 1 week (5 working days)

### Deliverables

1. **Reports page with metrics aggregation** (2 days)
   - `app/pages/reports.vue`
   - Create `useReports` composable:
     - Query chaplain_metrics, duty_logs, chaplain_payouts
     - Filter by date range, terminal, chaplain
     - Aggregate encounter types (crisis, grief, prayer, violence, etc.)
     - Aggregate duty hours (per chaplain, per terminal, per week)
     - Aggregate stipend totals (monthly, YTD, all-time)
   - Components:
     - Date range picker (from/to dates)
     - Terminal filter dropdown (All, A, B, C, D, E)
     - Chaplain filter dropdown (All, or specific chaplain)
     - Encounter metrics chart (bar chart: encounter types with counts)
     - Duty hours summary table (chaplain, hours, percentage)
     - Stipend summary table (month, total paid, number of chaplains)
   - No charting library for MVP -- use HTML tables and CSS bar charts

2. **CSV data export** (1 day)
   - Add export buttons to reports page (one per section)
   - Server API route: `GET /api/reports/export`
     - Accept query params: type (encounters/duty-hours/stipends), filters (date range, terminal, chaplain)
     - Query Firestore with filters
     - Generate CSV using papaparse
     - Return as downloadable file (Content-Type: text/csv, Content-Disposition: attachment)
   - Export file naming: `compass-{type}-{date}.csv`

3. **Audit log** (1 day)
   - Server-side audit logging (already implemented in Phase 2 user edit and stipend processing)
   - Add audit logging to:
     - Coverage slot edits (action: coverage_edit)
     - Settings updates (action: settings_update)
   - Optional: Create `/audit` page for admin review of audit log
     - Query audit_log collection (paginated, filterable by action/date/admin)
     - Display log entries (timestamp, admin name, action, target, details)

4. **Settings page** (1 day)
   - `app/pages/settings.vue`
   - Create `useSettings` composable:
     - Fetch app_settings/config document
     - Update settings function (calls server API)
   - Components:
     - Stipend configuration section:
       - Base stipend rate (number input, default 80)
       - Current program year (number input, default 2026)
     - Admin user management section:
       - List of admin users (name, email, remove button)
       - Add admin user (email input, add button)
   - Server API route: `POST /api/settings/update`
     - Verify admin
     - Update app_settings/config document
     - Create audit_log entry (action: settings_update, before/after values)
   - Validation:
     - Stipend rate must be >= 0
     - Year must be >= 2024
     - Admin user must exist in users collection before adding to adminUserIds

5. **Chat monitoring (read-only)** (1 day)
   - `app/pages/chats.vue`
   - Create `useChats` composable:
     - Query chats collection (ordered by lastMessageTime)
     - Query chat_messages subcollection for selected chat
   - Components:
     - Chat thread list (participant names, last message preview, timestamp)
     - Message view (selected thread: messages with sender name, timestamp, text/image)
   - Read-only: no send button, no message input
   - Show image attachments inline

6. **Responsive tablet layout** (1 day)
   - Test all pages on iPad (1024x768)
   - Breakpoint adjustments:
     - Sidebar: collapsible via hamburger menu on tablet
     - Data tables: horizontal scroll on tablet if needed
     - Coverage grid: touch-friendly cell size (min 44px touch target)
     - Stipend page: stack sections vertically on tablet
   - Touch event handling:
     - Coverage grid toggles work with tap (not just click)
     - Data table row selection works with tap
   - No mobile phone support needed (tablet minimum)

7. **Error handling & loading states** (1 day)
   - Add error boundaries to all composables (catch Firestore errors)
   - Add loading skeletons to all data-heavy pages:
     - Dashboard: skeleton cards
     - User list: skeleton rows
     - Duty days: skeleton table
     - Coverage grid: skeleton grid
   - Add empty states to all lists:
     - No users found
     - No duty logs this period
     - No qualifying shifts for stipend processing
     - No coverage data for this week
   - Add toast notifications for all mutations:
     - Success: "User profile updated"
     - Error: "Failed to update user profile. Please try again."

8. **Production indexes** (deploy only)
   - Create firestore.indexes.json with composite indexes:
     - `users`: `role + displayName`
     - `users`: `isChaplain + displayName`
     - `users`: `onDuty + isChaplain`
     - `duty_logs`: `userId + startTime`
     - `duty_logs`: `week + year`
     - `duty_logs`: `isPaid + startTime`
     - `chaplain_metrics`: `chaplainId + dateCollected`
     - `chaplain_payouts`: `chaplainId + yearPaid`
     - `coverage_schedules`: `weekNumber + year`
   - Deploy: `firebase deploy --only firestore:indexes`

### Success Criteria

- [ ] Reports page displays encounter metrics (breakdowns by type)
- [ ] Reports page filters work (date range, terminal, chaplain)
- [ ] CSV export downloads a valid file (opens in Excel/Google Sheets)
- [ ] CSV export includes all filtered data (e.g., only Terminal A encounters if Terminal A filter applied)
- [ ] Audit log records all admin actions (profile edits, stipend processing, coverage edits, settings updates)
- [ ] Settings page updates stipend rate (new rate used in next stipend calculation)
- [ ] Settings page manages admin users (add/remove admins, changes persist)
- [ ] Chat monitoring shows chat threads (read-only, no send capability)
- [ ] All pages work on iPad (1024x768, Safari)
- [ ] Sidebar collapses on tablet (hamburger menu)
- [ ] Coverage grid works with touch (tap to toggle)
- [ ] All loading states render (skeletons before data)
- [ ] All empty states render (friendly messages, no broken layouts)
- [ ] All error states render (Firestore errors caught, user-friendly messages)
- [ ] Production indexes deployed (queries fast, no Firestore warnings)

### Dependency Graph

```
Reports page with metrics
  ├── (depends on Phase 2: duty_logs, chaplain_metrics, chaplain_payouts data)
  └── CSV data export
      └── (depends on reports page filters)

Audit log
  └── (depends on Phase 2: all write operations instrumented)

Settings page
  └── (depends on Phase 1: app_settings collection)

Chat monitoring
  └── (depends on Phase 1: chats and chat_messages collections)

Responsive tablet layout
  └── (depends on Phase 1 & 2: all pages implemented)

Error handling & loading states
  └── (depends on Phase 1 & 2: all composables and pages)

Production indexes
  └── (depends on final schema and query patterns from Phase 2)
```

## Post-MVP Roadmap

### v1.1 Enhancements
- Bulk user import (CSV upload for intern cohorts)
- Advanced charting (replace HTML/CSS charts with Chart.js or similar)
- Period locking (lock completed stipend periods to prevent re-processing)
- Profile photo thumbnails (Cloud Function for automatic resize)
- Email notifications (password reset, stipend processed, coverage gaps)

### v2.0 Platform Features
- Google/Apple sign-in
- Push notifications (OneSignal or Firebase Cloud Messaging)
- Automated scheduling (suggest optimal coverage based on historical data)
- Multi-airport tenancy (support multiple chaplaincy programs)
- Board member read-only portal (reports access without admin privileges)

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stipend calculation logic wrong | Low | Critical | Preserve exact logic from original app, add server-side validation, write unit tests |
| Firestore rules too permissive | Medium | Critical | Security rules deployed before UI, tested with non-admin accounts |
| Performance issues with large data | Medium | High | Pagination on all lists (50 items max), Firestore query limits, indexes |
| Coverage grid UX confusing | Medium | Medium | User testing with chaplaincy admin before launch, iterate on design |
| Data migration from old app needed | Low | High | This is a fresh build -- original data stays in old Firebase project, manual migration if needed |
| Vercel function timeout on CSV export | Low | Medium | Stream CSV generation or increase function timeout to 30s |

## Build Completion Checklist

Before declaring MVP complete:

- [ ] All Phase 1 success criteria met
- [ ] All Phase 2 success criteria met
- [ ] All Phase 3 success criteria met
- [ ] Firestore security rules deployed and tested
- [ ] Firestore indexes deployed
- [ ] Vercel production deployment successful
- [ ] Manual testing on desktop (Chrome, Safari, Firefox)
- [ ] Manual testing on tablet (iPad Safari)
- [ ] Network throttling test (Fast 3G, all pages load < 5s)
- [ ] End-to-end stipend processing test (select month → process → verify payout record)
- [ ] End-to-end user management test (create user → edit profile → upload photo)
- [ ] Error monitoring configured (Sentry or similar)
- [ ] Database backups scheduled (Firestore export to Cloud Storage)
- [ ] Documentation complete (README, API docs, deployment guide)
