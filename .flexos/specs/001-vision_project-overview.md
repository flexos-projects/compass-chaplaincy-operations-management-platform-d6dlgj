---
id: project-overview
title: "Project Overview"
description: "Vision, problem statement, target users, and strategic direction for COMPASS"
type: spec
subtype: vision
status: draft
sequence: 1
tags: [vision, overview, strategy, mvp]
relatesTo: ["docs/core/001-vision.md", "docs/core/002-features.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Project Overview

## Problem Statement

The Dallas Fort Worth Airport Interfaith Chaplaincy manages 50-200 chaplains, interns, and support staff across five airport terminals. They currently operate using a fragile FlutterFlow-generated dashboard with critical architectural flaws: zero Firestore security (all rules are `allow: if true`), no mobile access despite chaplaincy directors working on tablets and phones, no search functionality, no data export, and a denormalized data model with 119 boolean fields for a weekly coverage schedule. The most business-critical workflow — monthly stipend processing at $80 per qualifying shift — takes hours of manual work with spreadsheets cross-referenced against duty logs, and leaves no audit trail.

The existing system is not just inefficient — it's insecure, unmaintainable, and excludes the mobile/tablet workflows that chaplaincy operations demand.

## Proposed Solution

COMPASS (Chaplaincy Operations Management Platform) is a purpose-built admin dashboard that replaces manual processes with secure, server-side workflows while maintaining all validated domain logic from the original system. Built on Nuxt 4 with proper Firebase security rules, responsive design from day one, and a normalized data model, COMPASS reduces stipend processing from hours to under 30 minutes while providing complete audit trails for financial operations.

The platform preserves the chaplaincy-specific domain concepts that make airport chaplaincy management unique: terminal coverage tracking, encounter categorization (crisis, grief, prayer, violence, travel-related), intern evaluation, and shift-based stipend processing. It does not attempt to be a generic scheduling tool or church management suite.

### Core Features (v1.0 MVP)

1. **Secure Authentication & RBAC** — Email/password login with server-enforced admin role verification. All Firestore access gated by role. Proper logout. Session management.

2. **Operations Dashboard** — At-a-glance KPI cards showing total users, active chaplains, on-duty count, new signups (7d/30d), encounter metrics. Real-time updates via Firestore listeners.

3. **User Management** — Searchable, filterable list of chaplains, interns, and support staff. Click-through to full profile with edit capability for name, email, phone, bio, role, terminal assignments (A/B/C/D/E), and photo upload.

4. **Duty Day Tracking** — View shift records with terminal distribution analysis, per-chaplain hour totals (all-time, 30d, 7d), and recent duty log listing.

5. **Coverage Schedule Grid** — Interactive 7-day x 17-hour matrix (5 AM to 9 PM) showing which hourly slots have chaplain coverage. Admin edit mode for toggling slots. Week navigation. Normalized storage model (nested map) replacing the original 119 flat booleans.

6. **Stipend Processing** — Multi-step workflow: select pay period (month), view qualifying unpaid shifts grouped by chaplain, apply individual adjustments (±$80), batch-select entries, enter check number, create immutable payout records. Server-side calculation at $80/shift + adjustments. Running totals: monthly, YTD, all-time.

### Post-MVP Enhancements (v1.1)

7. **Metrics & Reporting** — Encounter metrics aggregation by type (crisis, grief, prayer), terminal, date range. Charts and summary tables.

8. **CSV Data Export** — Export encounters, duty hours, and stipends to CSV for board presentations and external reporting.

9. **Audit Trail** — Track all admin actions (profile edits, stipend approvals, payout creation, coverage edits, role changes) with before/after diffs.

10. **Settings & Configuration** — Centralized system settings: base stipend rate, program year, admin user management, display preferences.

11. **Responsive Tablet Layout** — Full functionality on iPad with collapsible sidebar, touch-friendly tables, and optimized coverage grid.

## Target Users

### Persona 1: Linda, Program Director (Primary User)
**Daily life:** Opens COMPASS first thing in the morning to see overnight coverage and on-duty chaplains. Reviews duty logs daily to identify terminal staffing imbalances. Processes monthly stipend payments (currently a 3-4 hour manual task). Presents quarterly metrics to the airport authority board.

**Pain points:** Cannot quickly see which terminals had no chaplain coverage last night. Stipend processing requires manual spreadsheet cross-referencing. No way to export data for board presentations. Old dashboard only works on office desktop — cannot check anything from tablet during terminal walkthroughs.

**COMPASS solves:** Real-time coverage visibility on dashboard, one-click stipend processing with server-side calculation, CSV export for reports, responsive design that works on iPad.

### Persona 2: James, Operations Coordinator (Secondary User)
**Daily life:** Manages weekly coverage schedule ensuring 5 AM - 9 PM chaplain presence daily. Onboards new chaplains and interns, updating profiles and terminal assignments. Handles day-to-day user management.

**Pain points:** Coverage grid is stored as 119 separate boolean fields, making bulk edits impossible. No search functionality means scrolling through entire user list. No audit trail means he can't verify who changed a profile field.

**COMPASS solves:** Normalized coverage grid with click-to-toggle interface, full-text search on user list, complete audit trail for all administrative actions.

### Persona 3: Rev. Martha, Board Chair (Tertiary User)
**Daily life:** Reviews quarterly reports on chaplaincy activity. Needs encounter metrics (crisis interventions, prayer requests, grief counseling) broken down by terminal and time period. Approves budget for stipend rate changes.

**Pain points:** Receives hand-compiled PDF reports weeks out of date. Cannot drill into specific metrics or time periods. No self-service access to data.

**COMPASS solves:** Reports page with date-range filtering, encounter-type breakdowns, CSV export. Potential read-only board view in v2.0.

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Stipend processing time | Under 30 minutes per monthly cycle | Time from opening Stipends page to final payout confirmation |
| Security vulnerabilities | Zero open Firestore rules | Automated security rules audit (all rules require auth + role) |
| Device coverage | 100% of workflows on desktop and tablet | Manual QA pass on iPad and desktop for every page |
| Audit completeness | 100% of admin writes logged | Every Firestore mutation from admin triggers audit_log entry |
| Dashboard load time | Under 3 seconds on 4G connection | Lighthouse performance audit, real-device testing |
| Data export capability | CSV export for all major data views | Reports page export covers encounters, duty hours, stipends |

## Unique Value Proposition

COMPASS occupies a niche that mainstream tools underserve:

**Generic scheduling tools** (When I Work, Deputy) handle shift scheduling but know nothing about encounter categorization, stipend processing, or chaplaincy-specific workflows. They charge per-user per-month and would cost $300-600/month for 60+ chaplains.

**Church management software** (Planning Center, Breeze) handles volunteer scheduling and giving but is designed around Sunday services, not 7-day airport operations with hourly coverage grids and per-shift financial processing.

**Custom low-code apps** (FlutterFlow, Glide) can be prototyped quickly but collapse under real operational complexity. The original app proved this — 2500 lines of generated stipend code, no security, no mobile support, no reporting.

**COMPASS's position:** A domain-specific operations platform for airport chaplaincy programs. It does one thing exceptionally well: manage the specific intersection of shift coverage, encounter tracking, and stipend processing unique to funded chaplaincy programs at major airports.

## Market Positioning

COMPASS is explicitly NOT:
- **A chaplain-facing app** — This is an admin dashboard. Chaplains use their own mobile app for clocking in and logging encounters.
- **A scheduling/rostering tool** — It tracks coverage after the fact and lets admins edit the schedule grid, but does not auto-generate optimal schedules.
- **A payroll system** — It calculates stipend amounts and tracks check numbers but does not issue payments or generate 1099s.
- **A communication platform** — Chat monitoring is read-only oversight. No messaging, push notifications, or communication channels.
- **A public-facing website** — No marketing page, no chaplain directory, no traveler interface. Gated admin tool only.

## Non-Goals

Out of scope for v1.0 and v1.1:
- Auto-generated optimal coverage schedules (requires availability tracking, shift-swapping, constraint solving)
- Electronic payment integration (Stripe, PayPal, ACH)
- Push notification system
- Multi-airport tenancy (COMPASS v1 is DFW-specific)
- Google/Apple sign-in (email/password sufficient for launch)
- Mobile-first design (tablet yes, phone limited/message)

## Technical Constraints

1. **Security first** — Firestore security rules written before first page component. Role-based access enforced at database layer.
2. **Server-side financial logic** — All stipend calculations happen in Nuxt API routes using Firebase Admin SDK. Client displays previews but never submits pre-calculated totals.
3. **Responsive from day one** — Desktop primary (1024px+), tablet first-class (768-1023px), mobile limited with clear messaging where workflows don't fit.
4. **Real-time where it matters** — Dashboard KPIs, on-duty status, and coverage grid use Firestore listeners. Stipend processing is request/response (batch write, not streaming).
5. **Audit trail for accountability** — Every admin write (profile edit, stipend processing, coverage edit, role change) creates an audit_log entry via server-side API route.

## Build Phases

### Phase 1: Foundation (2-3 weeks)
Authentication, layout, navigation, core data infrastructure, Firestore security rules, login page, basic dashboard skeleton. Success: Admin can log in and see empty dashboard.

### Phase 2: Core Features (4-5 weeks)
Dashboard KPIs, user management, duty tracking, coverage grid, stipend processing end-to-end, payout history. Success: Admin can complete a full stipend cycle.

### Phase 3: Polish & Launch (2-3 weeks)
Reporting, CSV export, audit trail, settings page, responsive tablet support, error handling, production indexes, performance optimization. Success: All v1.1 features shipped and tablet-ready.

**Total estimated build time: 8-11 weeks from kickoff to production deployment.**
