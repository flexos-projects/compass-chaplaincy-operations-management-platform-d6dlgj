---
id: flexos-root
title: "COMPASS - Chaplaincy Operations Management Platform"
description: "Root overview of the COMPASS project"
type: project
status: imported
tags: [compass, chaplaincy, dfw-airport, admin-dashboard]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# COMPASS - Chaplaincy Operations Management Platform

**Streamlined operations management for airport chaplaincy programs**

COMPASS is an administrative dashboard for managing chaplaincy operations at DFW Airport. It handles scheduling, stipend processing, terminal coverage coordination, and volunteer management across five terminals (A-E). The system replaces manual spreadsheet workflows with a unified web application that supports role-based access control, real-time duty assignments, and automated stipend calculations.

## Quick Start

This is a FlexOS project directory. All project documentation, specifications, prototypes, and build artifacts live here.

**Key entry points:**
- **Vision:** `docs/core/001-vision.md` - What we're building and why
- **Prototypes:** `prototype/sitemap.md` - Browse interactive HTML prototypes
- **Specs:** `specs/` - 32 detailed specification files
- **Build:** `builds/001-mvp/` - Current build lifecycle
- **Database:** `database/manifest.md` - Schema registry
- **Design:** `design/design-system.md` - Design tokens and patterns

**Origin:** This project was imported from a FlutterFlow application via the FlexOS Importer on 2026-02-09.

## File Structure

```
.flexos/
├── FLEXOS.md                              ← You are here
├── assets/
│   ├── manifest.md                        Asset registry
│   └── images/                            3 imported images
├── builds/
│   └── 001-mvp/
│       ├── agent.md                       Build agent instructions
│       ├── config.md                      Build configuration
│       ├── log.md                         Build changelog
│       ├── plan.md                        Build plan
│       ├── queue.md                       Task queue
│       ├── build-spec/
│       │   └── 001-project-setup.md       Build specification
│       ├── reference/
│       │   ├── 001-nuxt4.md               Nuxt 4 reference
│       │   └── 002-firebase.md            Firebase reference
│       └── tasks/
│           ├── 001-project-scaffolding.md
│           ├── 002-auth-route-guards.md
│           └── 003-firestore-schemas.md
├── content/
│   ├── manifest.md                        Content registry
│   ├── team.md                            Team information
│   └── briefing.md                        Project briefing
├── database/
│   └── manifest.md                        Schema registry
├── design/
│   └── design-system.md                   Design tokens and patterns
├── docs/
│   ├── core/
│   │   ├── 000-import.md                  Import summary
│   │   ├── 001-vision.md                  Project vision
│   │   ├── 002-features.md                Feature overview
│   │   ├── 003-pages.md                   Page inventory
│   │   ├── 004-database.md                Database overview
│   │   ├── 005-flows.md                   User flows
│   │   ├── 006-design.md                  Design overview
│   │   └── 007-technical.md               Technical overview
│   └── guides/
│       └── 001-stipend-processing.md      Stipend workflow guide
├── imports/
│   ├── README.md                          Import landing zone
│   ├── figma/.gitkeep
│   ├── flutterflow/.gitkeep
│   └── github/.gitkeep
├── notes/
│   ├── README.md                          Session notes
│   └── 001-project-kickoff/
│       ├── changelog.md
│       ├── note.md
│       └── files/.gitkeep
├── prototype/
│   ├── sitemap.md                         Prototype sitemap
│   ├── vercel.json                        Deploy config
│   ├── pages/
│   │   ├── dashboard-v1.html              Dashboard prototype
│   │   ├── login-v1.html                  Login prototype
│   │   └── stipends-v1.html               Stipends prototype
│   └── shared/
│       ├── tokens.css                     Design tokens
│       ├── components.css                 Component styles
│       ├── mock-data.json                 Mock data
│       └── mock-data.js                   Mock data functions
└── specs/
    ├── 001-vision_project-overview.md
    ├── 002-features_authentication-rbac.md
    ├── 003-features_operations-dashboard.md
    ├── ... (32 spec files total)
    └── 032-technical_technical-architecture.md
```

## Project Status

| Section | Status | Completeness | Notes |
|---------|--------|--------------|-------|
| Vision | Complete | 100% | Imported from FlutterFlow |
| Specs | Complete | 100% | 32 detailed specification files |
| Database | Imported | 80% | Schema extracted, relationships need verification |
| Design | Imported | 70% | Tokens extracted, patterns need refinement |
| Prototypes | In Progress | 40% | 3 key pages prototyped (dashboard, login, stipends) |
| Builds | Active | 10% | MVP build initiated, scaffolding tasks defined |
| Documentation | Complete | 100% | 8 core docs + 1 guide |

## Key Domain Concepts

**Chaplains**
Volunteer chaplains who serve at the airport. Each chaplain has a profile with contact information, religious affiliation, languages spoken, and training certifications.

**Duty Shifts**
Scheduled time blocks when chaplains are on duty. Shifts are assigned to specific terminals and time slots, with coverage requirements varying by terminal traffic patterns.

**Stipends**
Monthly compensation for chaplains based on duty hours worked. The system tracks hours, applies rate calculations, and generates payment records for processing.

**Terminals**
DFW Airport has five terminals (A, B, C, D, E). Each terminal requires chaplain coverage based on its operational schedule and passenger volume.

**Coverage Grid**
Weekly schedule showing which terminals have chaplain coverage at which times. The grid helps identify gaps and optimize resource allocation.

**Roles**
- **Admin:** Full system access, manages all chaplains and operations
- **Coordinator:** Manages scheduling and assignments
- **Chaplain:** Views own schedule, submits hours, updates availability

## Architecture Overview

**Frontend:** Nuxt 4 (Vue 3, TypeScript)
- Server-side rendering (SSR) for initial page loads
- Client-side navigation for SPA experience
- Composables for shared business logic
- Pinia stores for global state management

**Backend:** Firebase
- **Authentication:** Email/password auth with role claims
- **Firestore:** Document database for all operational data
- **Storage:** File storage for chaplain photos and documents
- **Security Rules:** Role-based access control at database level

**Deployment:** Vercel
- Edge network deployment
- Automatic preview environments for branches
- Environment variables for Firebase config

**Styling:** Tailwind CSS
- Design token system (colors, spacing, typography)
- Mobile-first responsive design
- Component utility classes

## Next Steps

1. Complete project scaffolding (task 001)
2. Implement authentication and route guards (task 002)
3. Define Firestore schemas and security rules (task 003)
4. Build core pages (dashboard, chaplains, schedules, stipends)
5. Implement stipend calculation engine
6. Deploy staging environment

---

**Last updated:** 2026-02-09
**Build:** 001-mvp
**Status:** Imported, ready for development
