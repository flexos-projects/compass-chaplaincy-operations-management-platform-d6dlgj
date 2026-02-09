---
id: core-features
title: "Features"
description: "Complete feature inventory with priorities, dependencies, and MVP scope for COMPASS"
type: doc
subtype: core
status: draft
sequence: 2
tags: [core, features]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Features

## Feature Inventory

### P0 -- Must Have for Launch

| ID | Feature | Description | Phase |
|----|---------|-------------|-------|
| F-001 | Authentication & RBAC | Email/password login with server-enforced admin role. Logout. Session persistence. | 1 |
| F-002 | Operations Dashboard | KPI cards (user counts, on-duty, encounters, signups), real-time updates, coverage summary widget. | 2 |
| F-003 | User Management | Searchable, filterable list of all users. Role filter chips. Click-through to detail. | 2 |
| F-004 | User Profile Editing | Full profile edit form: name, email, phone, bio, role, terminal assignments, status flags, photo upload. Audit timestamps. | 2 |
| F-005 | Duty Day Tracking | View duty shift records with terminal distribution percentages, per-chaplain hour totals (all-time, 30d, 7d). | 2 |
| F-006 | Coverage Schedule Grid | 7-day x 17-hour (5 AM - 9 PM) interactive grid. View mode and admin edit mode. Week navigation. Normalized storage. | 2 |
| F-007 | Stipend Processing | Monthly workflow: select period, view qualifying shifts, apply adjustments, batch-select entries, enter check number, create immutable payout record. | 2 |
| F-008 | Stipend History | Running totals: monthly, YTD, all-time per chaplain. Paid entries marked green and locked from re-selection. | 2 |
| F-009 | Firestore Security Rules | Role-based read/write rules on every collection. Admin-only writes for financial data. Authenticated reads for non-sensitive data. | 1 |
| F-010 | Sidebar Navigation | Persistent sidebar with icon+label items for all main pages. Collapsible on tablet. COMPASS branding. Active state highlighting. | 1 |

### P1 -- Important, Post-MVP

| ID | Feature | Description | Phase |
|----|---------|-------------|-------|
| F-011 | Metrics & Reporting | Encounter metric aggregation by type (crisis, grief, prayer, violence), terminal, date range, and chaplain. Charts and summary tables. | 3 |
| F-012 | CSV Data Export | Export filtered data views (encounters, duty hours, stipends) to CSV files for external reporting and board presentations. | 3 |
| F-013 | Audit Log | Track all admin actions: profile edits, stipend approvals, payout creation, coverage edits, role changes. Before/after diffs where applicable. | 3 |
| F-014 | Settings & Configuration | Configurable base stipend rate, admin user management, program year, display preferences. Centralized settings document. | 3 |
| F-015 | Intern Evaluation Summary | Aggregate intern evaluation data from chaplain_metrics (initiative, pastoral demeanor, competence ratings) for training program oversight. | 3 |
| F-016 | Responsive Tablet Layout | Full functionality on iPad/tablet: collapsible sidebar, touch-friendly data tables, coverage grid optimized for touch. | 3 |

### P2 -- Nice to Have / Future

| ID | Feature | Description | Phase |
|----|---------|-------------|-------|
| F-017 | Chat Monitoring | Read-only admin view of chaplain-to-chaplain chat threads. Message history with timestamps and media. No send capability. | 3 |
| F-018 | Google/Apple Sign-In | Additional authentication providers beyond email/password. | Future |
| F-019 | Notification System | Email or push notifications for coverage gaps, stipend processing reminders, new chaplain registrations. | Future |
| F-020 | Advanced Scheduling | Auto-suggest optimal coverage schedules based on chaplain availability and historical coverage patterns. | Future |
| F-021 | Multi-Airport Support | Tenant architecture supporting multiple airport chaplaincy programs under a single deployment. | Future |
| F-022 | Board Member Portal | Read-only view for board members to access reports and metrics without full admin access. | Future |

## Feature-to-Page Matrix

| Feature | Login | Dashboard | Users | User Detail | Duty Days | Coverage | Stipends | Stipend Detail | Reports | Settings |
|---------|-------|-----------|-------|-------------|-----------|----------|----------|----------------|---------|----------|
| F-001 Auth & RBAC | **P** | G | G | G | G | G | G | G | G | G |
| F-002 Dashboard KPIs | | **P** | | | | | | | | |
| F-003 User Management | | | **P** | S | | | | | | |
| F-004 Profile Editing | | | | **P** | | | | | | |
| F-005 Duty Tracking | | S | | S | **P** | S | | | S | |
| F-006 Coverage Grid | | S | | | S | **P** | | | | |
| F-007 Stipend Processing | | | | | | | **P** | S | | |
| F-008 Stipend History | | | | S | | | S | **P** | S | |
| F-009 Security Rules | G | G | G | G | G | G | G | G | G | G |
| F-010 Sidebar Nav | | G | G | G | G | G | G | G | G | G |
| F-011 Reporting | | | | | | | | | **P** | |
| F-012 CSV Export | | | | | | | | | **P** | |
| F-013 Audit Log | | | S | S | | S | S | S | | S |
| F-014 Settings | | | | | | | | | | **P** |

**P** = Primary page for this feature. **S** = Secondary/supporting. **G** = Global (applies to all pages).

## Feature Dependencies

```
F-001 Auth & RBAC
  └── F-009 Security Rules (must be written alongside auth)
  └── F-010 Sidebar Navigation (requires auth state for user display)
      └── F-002 Dashboard KPIs (first page after login)
      └── F-003 User Management
          └── F-004 Profile Editing (requires user list to navigate to)
      └── F-005 Duty Tracking (requires users collection for chaplain names)
          └── F-006 Coverage Grid (reads duty data for coverage analysis)
          └── F-007 Stipend Processing (requires duty logs as input)
              └── F-008 Stipend History (reads payout records)
      └── F-011 Reporting (requires metrics, duty, and stipend data)
          └── F-012 CSV Export (exports report data)
      └── F-013 Audit Log (requires all write operations to be instrumented)
      └── F-014 Settings (configures stipend rate used by F-007)
```

## MVP Scope

### v1.0 -- Operational Foundation (Phases 1-2)
All P0 features. An admin can log in, see dashboard KPIs, manage users, review duty shifts, edit coverage schedules, and process stipend payments end-to-end. This replaces the core functionality of the FlutterFlow app with proper security and responsive design.

**v1.0 delivers:** Login, dashboard, user management, duty tracking, coverage grid, stipend processing, stipend history, security rules, sidebar navigation.

### v1.1 -- Reporting & Accountability (Phase 3)
All P1 features plus chat monitoring (P2). The system gains reporting, data export, audit trail, and configuration management. This addresses the biggest gap in the original app (the Reports button that did nothing) and adds the audit trail that a financial processing system demands.

**v1.1 adds:** Metrics reporting, CSV export, audit log, settings page, intern evaluation summaries, responsive tablet layout, chat monitoring.

### v2.0 -- Platform Expansion (Future)
P2 features that expand COMPASS beyond a single-airport admin dashboard. Additional auth providers, notifications, intelligent scheduling, multi-airport tenancy, and board member access.

**v2.0 adds:** Google/Apple sign-in, notifications, advanced scheduling, multi-airport support, board portal.

## Feature-to-Collection Mapping

| Feature | Primary Collections | Read | Write |
|---------|-------------------|------|-------|
| F-001 Auth | users | R | - |
| F-002 Dashboard | users, duty_logs, chaplain_metrics, coverage_schedules | R | - |
| F-003 User Management | users | R | - |
| F-004 Profile Editing | users | R | W |
| F-005 Duty Tracking | duty_logs, users | R | - |
| F-006 Coverage Grid | coverage_schedules | R | W |
| F-007 Stipend Processing | duty_logs, users, chaplain_payouts, stipend_records | R | W |
| F-008 Stipend History | chaplain_payouts, stipend_records | R | - |
| F-011 Reporting | chaplain_metrics, duty_logs, chaplain_payouts | R | - |
| F-012 CSV Export | chaplain_metrics, duty_logs, chaplain_payouts, stipend_records | R | - |
| F-013 Audit Log | audit_log | R | W |
| F-014 Settings | app_settings | R | W |
| F-017 Chat Monitoring | chats, chat_messages | R | - |

## Inferred Features

The concept document describes the explicit features well, but several features are obviously necessary for a production system and were not called out:

### F-INF-001: Password Reset Flow
**Priority:** P0. Users will forget passwords. Firebase Auth provides the infrastructure but the UI must exist -- a "Forgot password?" link on the login page that triggers a password reset email.

### F-INF-002: Session Timeout & Token Refresh
**Priority:** P0. Admin sessions should timeout after inactivity (e.g., 4 hours). Firebase Auth tokens expire after 1 hour by default; the client must handle silent refresh and graceful re-authentication.

### F-INF-003: Empty State Design
**Priority:** P0. Every data view needs an empty state: no users found, no duty logs this period, no stipends to process, no coverage data for this week. These are not error states -- they are normal operational states that need clear messaging and guidance.

### F-INF-004: Error Boundary & Offline Handling
**Priority:** P1. Firestore listeners can fail (network loss, permission errors). Every page needs a consistent error boundary pattern that shows a meaningful message and a retry action. Brief offline periods should be tolerated gracefully.

### F-INF-005: Bulk User Import
**Priority:** P2. When onboarding a new cohort of intern chaplains (which happens seasonally), adding 10-20 users one-at-a-time is tedious. A CSV upload for bulk user creation would save significant time.

### F-INF-006: Stipend Period Locking
**Priority:** P1. Once a month's stipend processing is complete, the period should be lockable to prevent accidental re-processing. The concept mentions marking entries as paid (green, non-selectable) but does not explicitly describe period-level locking.

### F-INF-007: Data Pagination
**Priority:** P0. The concept does not mention pagination, but the users collection could have 200+ documents and duty_logs could have thousands. Every list view must paginate at a reasonable limit (25-50 items per page) to avoid loading the entire collection into memory.

### F-INF-008: Profile Photo Optimization
**Priority:** P1. Uploaded profile photos need to be resized and compressed before storage. A 5 MB phone photo should not be served as an avatar thumbnail. Firebase Storage + a Cloud Function for image resize, or client-side compression before upload.
