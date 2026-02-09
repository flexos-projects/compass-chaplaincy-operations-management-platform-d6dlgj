---
id: content-briefing
title: "Project Briefing"
description: "Background context on airport chaplaincy operations for AI agents and developers"
type: content
subtype: info
status: draft
sequence: 2
tags: [content, briefing, domain]
relatesTo: ["docs/core/001-vision.md", "docs/core/000-import.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

<flex_block type="instructions">
This briefing provides domain context for AI agents and developers working on COMPASS. Read this before working on any feature that involves chaplaincy-specific terminology or workflows.
</flex_block>

# Project Briefing — Airport Chaplaincy Operations

## What is Airport Chaplaincy?

Airport chaplaincy programs provide spiritual care, emotional support, and crisis assistance to travelers, airport employees, and their families. Chaplains are typically interfaith clergy or trained volunteers who serve at airport terminals, offering comfort during travel disruptions, medical emergencies, grief situations, and everyday stress.

## The DFW Airport Interfaith Chaplaincy (DFWAIC)

The Dallas Fort Worth Airport Interfaith Chaplaincy manages approximately 50-200 chaplains, interns, and support staff across five terminals (A, B, C, D, E). The program operates with:

- **Volunteer and stipended chaplains** who sign up for duty shifts
- **Monthly stipend payments** of $80 per qualifying duty shift (paid by check)
- **Coverage schedules** tracking which hourly slots (5AM-9PM) have chaplain presence
- **Encounter metrics** recording interactions categorized by type (crisis, grief, prayer, violence, travel-related)
- **Intern evaluation** tracking initiative, pastoral demeanor, pluralistic competence, and situational awareness

## Key Domain Concepts

### Duty Days
A "duty day" is a shift when a chaplain is on-duty at the airport. Chaplains clock in and out, recording their terminal location, hours worked, and any encounters. Duty logs track start/end times, GPS locations, and are the basis for stipend calculations.

### Stipend Processing
The most complex workflow. Monthly cycle:
1. Admin selects a pay period (month)
2. System identifies all unpaid duty shifts in that date range
3. Each qualifying shift earns $80 base rate
4. Admin can apply individual adjustments (positive or negative)
5. Admin batch-selects shifts and creates a payout record
6. Check numbers are recorded for paper trail
7. Running totals track monthly, YTD, and all-time payments per chaplain

### Coverage Schedule
A 7-day by 17-hour grid (5AM to 9PM, 7 days a week) showing which time slots have chaplain coverage. Administrators use this to identify and fill gaps in the schedule. One document per week in the system.

### Encounter Types
Chaplain interactions are categorized using a rich taxonomy:
- **Crisis** — emergency situations requiring immediate pastoral care
- **Violence** — incidents involving aggression or threat
- **Police involved** — encounters where law enforcement is present
- **Grief** — travelers or employees dealing with loss
- **Travel-related** — standard travel anxiety, delays, missed connections
- **Personal issue** — non-travel-related personal matters
- **Prayer requested** — direct request for prayer
- **Fallen angel** — (domain-specific term from the original system)

### Encounter Medium
How the chaplain connected with the person:
- In-person, by phone, chat only, self-discovered

### Terminals
DFW Airport has 5 terminals: A, B, C, D, and E. Chaplains are assigned to specific terminals but may cover multiple. Terminal distribution analysis helps administrators balance coverage across the airport.

## Technology Context

The original system was built with FlutterFlow (a code generation platform for Flutter/Dart apps) backed by Firebase. The rebuild uses Nuxt 4 (Vue 3 SSR framework) with the same Firebase backend — preserving data continuity while modernizing the admin interface.

Key technical decisions informed by the original system's failures:
- Server-side financial calculations (original had client-side only)
- Proper Firestore security rules (original was `allow: if true` everywhere)
- Normalized data model (original had 119 boolean fields for coverage)
- Responsive design (original hid mobile navigation entirely)
