---
id: core-pages
title: "Pages"
description: "Complete page inventory, navigation hierarchy, user journeys, and state matrix for COMPASS"
type: doc
subtype: core
status: draft
sequence: 3
tags: [core, pages]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Pages

## Site Map

```
COMPASS
├── /login                          (public, unauthenticated)
├── /forgot-password                (public, unauthenticated)
│
├── / (Dashboard)                   (auth: admin)
│
├── /users                          (auth: admin)
│   └── /users/:id                  (auth: admin)
│
├── /duty-days                      (auth: admin)
│
├── /coverage                       (auth: admin)
│
├── /stipends                       (auth: admin)
│   └── /stipends/:id               (auth: admin)
│
├── /reports                        (auth: admin)
│
├── /chats                          (auth: admin)
│   └── /chats/:id                  (auth: admin)
│
├── /settings                       (auth: admin)
│
└── /404                            (public, catch-all)
```

The application uses two layouts: a **public layout** (centered card, no sidebar) for login/forgot-password/404, and an **admin layout** (persistent sidebar + content area) for all authenticated pages.

## Page Inventory

| Route | Page Name | Auth | Layout | Primary Data Sources | Key Components | Phase |
|-------|-----------|------|--------|---------------------|----------------|-------|
| `/login` | Login | None | Public | - | LoginForm, BrandHeader, ErrorAlert | 1 |
| `/forgot-password` | Forgot Password | None | Public | - | ResetForm, BrandHeader, SuccessMessage | 1 |
| `/` | Dashboard | Admin | Admin | users, duty_logs, chaplain_metrics, coverage_schedules | KPICardGrid, OnDutyList, RecentDutyTable, CoverageMiniGrid | 2 |
| `/users` | Users | Admin | Admin | users | SearchBar, RoleFilterChips, UserTable, UserCountBadge | 2 |
| `/users/:id` | User Detail | Admin | Admin | users, duty_logs, chaplain_payouts | ProfileHeader, PersonalInfoForm, RoleToggles, TerminalPicker, DutyHistoryTable, StipendHistoryTable, PhotoUpload | 2 |
| `/duty-days` | Duty Days | Admin | Admin | duty_logs, users, coverage_schedules | PeriodFilter, TerminalDistributionChart, ChaplainHoursTable, CoverageGridPreview, DutyLogList | 2 |
| `/coverage` | Coverage Schedule | Admin | Admin | coverage_schedules | WeekSelector, CoverageGrid (17x7), GapIndicators, CoverageSummaryStats, AdminModeToggle | 2 |
| `/stipends` | Stipends | Admin | Admin | duty_logs, users, chaplain_payouts, stipend_records | MonthSelector, PeriodSummaryCard, QualifyingChaplainsList, DutyEntryTable, PayoutTotalsCard, ProcessButton, CheckNumberModal, AdjustmentSlider | 2 |
| `/stipends/:id` | Stipend Detail | Admin | Admin | chaplain_payouts, duty_logs, users | PayoutHeader, ChaplainInfoCard, DutyEntriesList, AmountBreakdownTable, AuditInfoCard | 2 |
| `/reports` | Reports | Admin | Admin | chaplain_metrics, duty_logs, chaplain_payouts, stipend_records | DateRangeFilter, EncounterTypeChart, DutyHoursSummary, StipendSummaryTable, ExportButton, TerminalFilter, ChaplainFilter | 3 |
| `/chats` | Chat Monitoring | Admin | Admin | chats, users | ChatThreadList, ThreadPreview, UnreadBadge | 3 |
| `/chats/:id` | Chat Detail | Admin | Admin | chat_messages, users | MessageList, MediaViewer, ReadOnlyBanner | 3 |
| `/settings` | Settings | Admin | Admin | app_settings, users | StipendRateConfig, AdminUsersList, ProgramYearPicker, DisplayPreferences | 3 |
| `/:catchAll` | 404 | None | Public | - | NotFoundMessage, BackToLoginLink | 1 |

## User Journeys

### Journey 1: Morning Operations Check
**Actor:** Linda (Program Director)
**Goal:** Understand overnight operations status in under 2 minutes.

1. **Login** -- Linda opens COMPASS on her desktop. If her session is still active (token refresh), she lands directly on the dashboard. If expired, she logs in with email/password.
2. **Dashboard** -- She immediately sees: (a) how many chaplains are currently on duty, (b) KPI cards showing 7-day encounter trends, (c) a mini coverage summary highlighting any gaps in today's schedule.
3. **Coverage Schedule** -- She clicks the coverage summary widget to navigate to `/coverage`. The current week is displayed. She sees that Wednesday 6-7 AM has no coverage (red/empty slot). She makes a mental note to call a chaplain.
4. **Duty Days** -- She navigates to `/duty-days` to see yesterday's duty log entries and terminal distribution. Terminal E shows only 5% of encounters. She wonders if staffing there is adequate.
5. **Users** -- She navigates to `/users`, filters by "Chaplains", and searches for "Martinez" to check his terminal assignments. She clicks through to his detail page and confirms he is assigned to Terminal E.

**Total time:** Under 3 minutes. **Pages touched:** Login (conditional), Dashboard, Coverage, Duty Days, Users, User Detail.

### Journey 2: Monthly Stipend Processing
**Actor:** Linda (Program Director)
**Goal:** Process January stipend payments for all qualifying chaplains.

1. **Stipends page** -- Linda navigates to `/stipends`. She selects "January" from the month selector chips.
2. **Review qualifying chaplains** -- The system queries duty_logs for January 1-31, filtering for unpaid shifts. It displays a list of 18 chaplains with qualifying shifts. Each shows shift count and calculated amount ($80/shift).
3. **Apply adjustments** -- Chaplain Rodriguez worked a holiday shift. Linda clicks his row and applies a +$40 adjustment using the slider. His total changes from $240 (3 shifts) to $280.
4. **Select entries** -- Linda clicks "Select All" to batch-select all 18 chaplains' entries. She unchecks Intern Kim, whose stipend is handled through a different funding source.
5. **Enter check number** -- She clicks "Process Selected." A modal prompts for the check number. She enters "CHK-2026-0147".
6. **Confirm processing** -- The system creates chaplain_payouts records, marks all selected duty_logs as paid, and creates stipend_records for each chaplain-month combination. The page refreshes: processed entries turn green, totals update.
7. **Verify** -- Linda clicks one payout to navigate to `/stipends/:id` and confirms the amount breakdown is correct.

**Total time:** 15-25 minutes. **Pages touched:** Stipends, Stipend Detail.

### Journey 3: Quarterly Board Report Preparation
**Actor:** Linda (Program Director)
**Goal:** Generate encounter metrics and financial summary for the Q4 board meeting.

1. **Reports page** -- Linda navigates to `/reports`. She sets the date range to October 1 through December 31.
2. **Review encounter metrics** -- A chart breaks down encounters by type: 142 prayer requests, 38 grief counseling, 12 crisis interventions, 8 police-involved incidents. She notes the 15% increase in prayer requests.
3. **Filter by terminal** -- She selects Terminal A to see if the new intern is contributing. Terminal A shows 45 encounters in Q4, up from 30 in Q3.
4. **Export encounters CSV** -- She clicks "Export to CSV" and downloads the encounter data for her spreadsheet.
5. **Review stipend summary** -- A summary table shows total stipend expenditure for Q4: $14,720 across 184 qualifying shifts. She exports this too.
6. **Build presentation** -- She imports both CSVs into her PowerPoint template for the board meeting.

**Total time:** 10-15 minutes. **Pages touched:** Reports.

## Navigation Pattern

COMPASS uses a **persistent sidebar** navigation pattern, which is the standard for operational dashboards:

**Desktop (1024px+):** Full sidebar (240px wide) with icon + label for each item. Sidebar is always visible. Content area fills remaining width.

**Tablet (768-1023px):** Sidebar collapses to icon-only mode (64px wide). Hover or click expands to show labels temporarily. Content area gets more room.

**Mobile (< 768px):** Sidebar becomes a hamburger-triggered drawer overlay. Bottom bar is NOT used -- this is an admin dashboard, not a consumer app. The drawer pattern is appropriate because admins rarely need rapid page switching on mobile; they typically check one thing and close.

**Sidebar Items (in order):**
1. Dashboard (home icon) - `/`
2. Users (people icon) - `/users`
3. Duty Days (clock icon) - `/duty-days`
4. Coverage (calendar-grid icon) - `/coverage`
5. Stipends (dollar icon) - `/stipends`
6. Reports (chart icon) - `/reports`
7. Chats (message icon) - `/chats`
8. --- divider ---
9. Settings (gear icon) - `/settings`

**Sidebar Footer:** Current admin's name and avatar. Logout button.

## Mobile vs Desktop Priority

| Page | Desktop | Tablet | Mobile | Notes |
|------|---------|--------|--------|-------|
| Login | Essential | Essential | Essential | Must work everywhere |
| Dashboard | Primary | Primary | Useful | KPI cards stack vertically on mobile |
| Users | Primary | Primary | Useful | List view works on all sizes; search is key |
| User Detail | Primary | Primary | Limited | Form editing on phone is awkward but possible |
| Duty Days | Primary | Useful | Limited | Data tables need horizontal space |
| Coverage | Primary | Primary | Not practical | 17x7 grid requires minimum 768px |
| Stipends | Primary | Useful | Not practical | Multi-step workflow needs screen real estate |
| Stipend Detail | Primary | Primary | Useful | Read-only view works on mobile |
| Reports | Primary | Primary | Limited | Charts need space; export still works |
| Chat Monitoring | Primary | Primary | Useful | Message list is naturally mobile-friendly |
| Settings | Primary | Primary | Useful | Simple form, works everywhere |

The coverage schedule grid and stipend processing workflow are explicitly desktop/tablet features. Attempting to squeeze a 17-column interactive grid or a multi-step financial workflow onto a phone screen would produce a bad experience. On mobile, these pages should show a clear message: "This feature is best experienced on a tablet or desktop."

## Inferred Pages

### Forgot Password (`/forgot-password`)
Not in the concept but essential. A simple form with email input that triggers Firebase Auth's `sendPasswordResetEmail()`. Shows success message: "Check your email for a reset link."

### 404 Not Found (catch-all route)
Standard catch-all page for invalid routes. COMPASS branding, clear message, and a link back to the dashboard (if authenticated) or login (if not).

### Onboarding Wizard (Future: `/onboarding`)
When COMPASS is first deployed, an admin needs to configure the base stipend rate, program year, and import existing chaplain data. A one-time setup wizard could guide this. Not needed for v1 (manual setup via Settings page is sufficient).

### Audit Log View (Future: `/audit-log`)
While audit_log entries are recorded from Phase 3, the concept does not define a dedicated page to browse them. The audit trail is useful for accountability but could initially be viewed through the settings page or a sub-section of reports. A dedicated `/audit-log` page with filtering by action type, admin, and date range would be a natural v1.1 addition.

## State Matrix

Every page must handle these states:

| Page | Loading | Loaded | Empty | Error | Special States |
|------|---------|--------|-------|-------|----------------|
| Login | Spinner on submit | Redirect to / | n/a | Invalid credentials, account disabled, network error | |
| Forgot Password | Spinner on submit | Success message | n/a | Email not found, rate limited | |
| Dashboard | Skeleton cards | KPI data rendered | "No data yet" for new deployments | Firestore connection failed | |
| Users | Table skeleton | User rows rendered | "No users match your search" | Query failed | Filtered empty: "No chaplains found" |
| User Detail | Form skeleton | Profile rendered | n/a (404 if no user) | User not found, save failed | Editing, Saving, Photo uploading |
| Duty Days | Chart skeleton | Distribution + hours rendered | "No duty logs for this period" | Query failed | Period filter active |
| Coverage | Grid skeleton | 7x17 grid rendered | "No schedule for this week" (all false) | Save failed on toggle | Admin edit mode, Saving slot |
| Stipends | List skeleton | Qualifying chaplains shown | "No unpaid shifts for [month]" | Payout creation failed | Processing, Period complete (all paid), Check number modal |
| Stipend Detail | Card skeleton | Payout details rendered | n/a (404 if not found) | Not found | |
| Reports | Chart skeleton | Charts + tables rendered | "No data for selected filters" | Export failed | Exporting CSV |
| Chat Monitoring | Thread list skeleton | Thread list rendered | "No chat history" | Query failed | |
| Chat Detail | Message skeleton | Messages rendered | "No messages in this thread" | Query failed | Read-only banner always visible |
| Settings | Form skeleton | Config loaded | n/a (defaults exist) | Save failed | Saving |

### Transition States
- **Optimistic updates** for coverage grid toggle (show change immediately, revert on failure)
- **Pessimistic updates** for stipend processing (show processing spinner, only update UI on success)
- **Background refresh** for dashboard KPIs (refresh every 30 seconds, no loading state on refresh)
- **Stale data indicator** for any page where the Firestore listener disconnects (yellow banner: "Connection lost. Showing cached data.")
