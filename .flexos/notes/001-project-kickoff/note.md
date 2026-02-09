---
id: note-001-kickoff
title: "Project Kickoff"
description: "Initial import analysis and project setup session"
type: note
subtype: session
status: complete
sequence: 1
tags: [kickoff, import, setup]
relatesTo: ["docs/core/000-import.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Project Kickoff — Import Session

**Date:** 2026-02-09
**Participants:** Sarah Chen (Project Lead), Marcus Johnson (UX Designer), Rev. David Park (Domain Advisor)

## Context

The Dallas Fort Worth Airport Interfaith Chaplaincy (DFWAIC) has been operating with a FlutterFlow-generated admin dashboard that has reached its limits. The existing app manages chaplain duty shifts, stipend payments, and encounter metrics — but suffers from critical architectural issues including wide-open Firestore security rules, extreme data denormalization, no reporting, and desktop-only access.

## Import Source

- **Source:** FlutterFlow export of DFWAIC App Dashboard
- **Method:** Bottom-up forensic analysis using FlexOS `/import` command
- **Analysis:** 6 domain experts examined the codebase in parallel, findings synthesized by a senior architect

## Key Findings

| Area | Finding | Impact |
|------|---------|--------|
| Security | All Firestore rules set to `allow: if true` | Critical — rebuild with proper RBAC |
| Data Model | 119 flat booleans for coverage schedule | Normalize to nested map structure |
| Data Model | 16 separate translated bio fields | Consolidate to single map |
| Features | Reports button on every page, links to nothing | Add real reporting with CSV export |
| Features | No logout button despite auth | Add proper session management |
| Features | No search across any list | Add search + filtering |
| UX | Desktop only — mobile nav completely hidden | Responsive tablet support |
| Architecture | Stipend processing at ~2500 lines | Simplify with server-side calculation |

## Decisions

| Decision | Rationale |
|----------|-----------|
| Fresh build on Nuxt 4 + Firebase | FlutterFlow code is unmaintainable; keep Firebase backend for data continuity |
| 8 core features for MVP | Focus on proven workflows, add missing essentials (reports, audit, settings) |
| Server-side financial calculations | Prevent client-side manipulation of stipend amounts |
| Normalized data model | Eliminate 119-boolean anti-pattern, consolidate scattered fields |
| Sidebar navigation (desktop) + bottom tabs (mobile) | Institutional dashboard feel on desktop, native app feel on mobile |

## Action Items

- [x] Complete forensic analysis of existing codebase
- [x] Generate fresh project concept
- [x] Create 8 core documents (000-import through 007-technical)
- [x] Expand into detailed spec files
- [ ] Generate design system and prototype assets
- [ ] Create build plan with task queue
- [ ] Generate prototype HTML pages
