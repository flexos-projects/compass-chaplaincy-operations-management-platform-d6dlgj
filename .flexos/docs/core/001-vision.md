---
id: core-vision
title: "Vision"
description: "The strategic vision, mission, and positioning for COMPASS - the chaplaincy operations management platform"
type: doc
subtype: core
status: draft
sequence: 1
tags: [core, vision]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Vision

## Vision Statement

A world where airport chaplaincy directors spend their time on pastoral leadership instead of spreadsheets. COMPASS eliminates the administrative friction between chaplains serving travelers in crisis and the operations teams who keep those programs running. Every duty shift is tracked, every stipend is processed accurately, every coverage gap is visible -- so that chaplains can focus on the human being standing in front of them at Gate B14.

## Mission

Build a purpose-built admin dashboard that replaces manual processes and a fragile FlutterFlow prototype with a secure, responsive, production-grade operations platform for the DFW Airport Interfaith Chaplaincy. Reduce stipend processing from hours to minutes, close all security vulnerabilities, and give program directors a real-time operational picture across five terminals and dozens of chaplains.

## Strategic Pillars

### 1. Operational Clarity
Program directors should never have to ask "who's on duty?" or "did we pay everyone for January?" The dashboard provides a living, breathing picture of operations: who is where, what shifts need payment, where coverage gaps exist, and how encounter metrics are trending. Real-time data replaces end-of-month scrambles.

### 2. Financial Integrity
Stipend processing is the highest-stakes workflow in the system. Every dollar must be traceable from duty shift to check number. COMPASS introduces immutable payout records, server-side calculations (no client-side manipulation of dollar amounts), and a complete audit trail. The system protects the organization from accounting errors and supports annual audits with exportable records.

### 3. Security by Default
The original system had Firestore rules of `allow: if true` on every collection -- meaning any authenticated user (or even unauthenticated requests, depending on config) could read or modify any record, including other chaplains' pay data. COMPASS enforces role-based access at the database layer. Admin functions are admin-only. Period. No exceptions, no workarounds.

### 4. Device Freedom
Chaplaincy directors work from their office desktop, from a tablet during board meetings, and from their phone while walking the terminals. COMPASS works on all three. The original app hid its mobile navigation entirely (literally `display: none` on mobile breakpoints). The rebuild is responsive from day one, with tablet as a first-class form factor.

## Target Audience

### Persona 1: The Program Director (Primary User)
**Name:** Linda, Director of Chaplaincy Services
**Daily life:** Manages 60+ chaplains across Terminals A-E. Opens the dashboard first thing in the morning to see overnight coverage. Processes stipend payments monthly, which currently takes a full afternoon with a spreadsheet open alongside the old system. Presents quarterly metrics to the airport authority board.
**Frustrations:** Cannot quickly see which terminals had no chaplain last night. Stipend processing requires manually cross-referencing duty logs with a calculator. No way to export data for board presentations. The old dashboard only works on her office desktop -- she can't check anything from her phone during terminal walkthroughs.
**COMPASS solves:** Real-time coverage visibility, one-click stipend processing, CSV export for board reports, and a dashboard that works on her iPad.

### Persona 2: The Operations Coordinator
**Name:** James, Operations & Scheduling Coordinator
**Daily life:** Manages the weekly coverage schedule, ensuring every hour from 5 AM to 9 PM has chaplain presence. Onboards new chaplains and interns, updating their profiles and terminal assignments. Handles the day-to-day user management.
**Frustrations:** The coverage grid in the old system was stored as 119 individual boolean fields, making it nearly impossible to update programmatically. Searching for a specific chaplain requires scrolling through the entire list. No audit trail means he can't verify who changed a profile field.
**COMPASS solves:** Normalized coverage grid with an intuitive click-to-toggle interface, full-text search on user list, and audit logging for every administrative action.

### Persona 3: The Board Liaison (Secondary User)
**Name:** Rev. Martha, Board Chair
**Daily life:** Reviews quarterly reports on chaplaincy activity. Needs encounter metrics (crisis interventions, prayer requests, grief counseling) broken down by terminal and time period. Approves budget for stipend rate changes.
**Frustrations:** Currently receives hand-compiled PDF reports that are weeks out of date. Cannot drill into specific metrics or time periods. Has no self-service access to data.
**COMPASS solves:** Reports page with date-range filtering, encounter-type breakdowns, and CSV export. Could potentially have a read-only board view in a future release.

## Success Metrics

| Metric | Target | How We Measure |
|--------|--------|---------------|
| Stipend processing time | Under 30 minutes per monthly cycle | Time from opening Stipends page to final payout confirmation |
| Security vulnerabilities | Zero open Firestore rules | Automated security rules audit (all rules require auth + role) |
| Device coverage | 100% of workflows on desktop and tablet | Manual QA pass on iPad and desktop for every page |
| Audit completeness | 100% of admin writes logged | Every Firestore mutation from an admin triggers an audit_log entry |
| Dashboard load time | Under 3 seconds on 4G connection | Lighthouse performance audit, real-device testing |
| Data export capability | CSV export for all major data views | Reports page export covers encounters, duty hours, and stipends |

## Market Positioning

COMPASS occupies a niche that mainstream tools underserve:

**Generic scheduling tools** (When I Work, Deputy, Homebase) handle shift scheduling but know nothing about encounter categorization, stipend processing, or chaplaincy-specific workflows. They charge per user per month and would cost $300-600/month for 60+ chaplains.

**Church management software** (Planning Center, Breeze, ChurchTrac) handles volunteer scheduling and giving but is designed around Sunday services, not 7-day airport operations with hourly coverage grids and per-shift financial processing.

**Custom FlutterFlow/Glide apps** (the status quo) can be prototyped quickly but collapse under real operational complexity. The original app proved this -- 2500 lines of generated stipend code, no security, no mobile support, no reporting.

**COMPASS's position:** A domain-specific operations platform for airport chaplaincy programs. It does one thing exceptionally well. It is not trying to be a general-purpose scheduling tool, a church management suite, or an HR platform. It manages the specific intersection of shift coverage, encounter tracking, and stipend processing that is unique to funded chaplaincy programs at major airports.

## Non-Goals

COMPASS is explicitly NOT:

- **A chaplain-facing app.** This is an admin dashboard. Chaplains have their own mobile app (the existing Flutter app) for clocking in, logging encounters, and chatting. COMPASS reads that data but does not replace the chaplain experience.
- **A scheduling/rostering tool.** COMPASS tracks coverage after the fact and lets admins edit the schedule grid, but it does not auto-generate optimal schedules or handle shift swaps. That is a future system.
- **A payroll system.** COMPASS calculates stipend amounts and tracks check numbers, but it does not issue payments, generate 1099s, or integrate with payroll providers. It produces the data that the accounting department needs.
- **A communication platform.** Chat monitoring is read-only oversight. COMPASS does not send messages, push notifications, or manage communication channels.
- **A public-facing website.** There is no public marketing page, no chaplain directory, no traveler-facing interface. It is a gated admin tool.

## Lessons from the Import

The analysis of the original FlutterFlow application (DFWAIC App Dashboard) revealed several critical insights that directly shape COMPASS's architecture:

1. **Stipend processing is the crown jewel.** At approximately 2500 lines of generated Flutter code, it was by far the most complex feature. It works -- the business logic for calculating $80/shift, applying adjustments, and batching payouts is sound. COMPASS preserves every bit of that domain logic while moving calculations server-side for security.

2. **The data model needs surgery, not a rewrite.** Most collections have good fields and reasonable structure. The two exceptions are `coverageHours` (119 flat booleans for a 7x17 grid) and translated bios (16 separate fields instead of a map). These get normalized. Everything else gets cleaned up but not reinvented.

3. **Security was an afterthought -- it must be foundational.** Every Firestore rule was `allow: if true`. In the rebuild, security rules are written before the first page component. Role-based access is enforced at the database layer, not just the UI layer.

4. **Mobile was explicitly disabled.** The original app had CSS that hid the navigation on mobile viewports. This was not a responsive design gap -- it was intentional exclusion. COMPASS must be responsive from the first commit, with tablet being the secondary form factor after desktop.

5. **Reports were promised but never delivered.** A "Reports" button appeared in the navigation on every page but led nowhere. The data exists (chaplain_metrics has 35 rich fields), but no reporting UI was built. COMPASS delivers the reports page as a Phase 3 priority with CSV export.

6. **Unused infrastructure should not carry forward.** The original had LangChain, Stripe, and OneSignal dependencies that were never implemented. COMPASS starts with zero speculative dependencies. If we don't need it in Phase 1, it doesn't go in `package.json`.
