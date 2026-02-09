---
id: prototype-sitemap
title: "Sitemap"
description: "Route map and navigation structure for COMPASS prototypes"
type: prototype
subtype: config
status: draft
sequence: 1
tags: [prototype, sitemap, routes]
relatesTo: ["docs/core/003-pages.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Sitemap

<flex_block type="config">
{
  "routes": {
    "/login": "login-v1.html",
    "/": "dashboard-v1.html",
    "/users": "users-v1.html",
    "/users/:id": "user-detail-v1.html",
    "/duty-days": "duty-days-v1.html",
    "/coverage": "coverage-v1.html",
    "/stipends": "stipends-v1.html",
    "/stipends/:id": "stipend-detail-v1.html",
    "/reports": "reports-v1.html",
    "/settings": "settings-v1.html"
  },
  "fallback": "404.html",
  "redirects": {
    "/home": "/",
    "/signin": "/login",
    "/dashboard": "/",
    "/admin": "/"
  },
  "pages": [
    {
      "id": "login",
      "route": "/login",
      "file": "login-v1.html",
      "version": 1,
      "status": "ready",
      "auth": false,
      "layout": "public",
      "description": "Email/password authentication page with COMPASS branding. Centered card on neutral background. Clean form with error handling."
    },
    {
      "id": "dashboard",
      "route": "/",
      "file": "dashboard-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Operations overview with KPI cards (total chaplains, on-duty count, encounters, new signups), on-duty chaplain list, recent duty logs table, and today's coverage summary."
    },
    {
      "id": "users",
      "route": "/users",
      "file": "users-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Searchable, filterable list of all users. Role filter chips (All Users, Chaplains, Interns, Support Staff). Click user row to navigate to detail page."
    },
    {
      "id": "user-detail",
      "route": "/users/:id",
      "file": "user-detail-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Full profile view and edit form for a single user. Profile header with photo, personal info form, role toggles, terminal assignments, duty history, stipend history."
    },
    {
      "id": "duty-days",
      "route": "/duty-days",
      "file": "duty-days-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Duty shift records with terminal distribution analysis, per-chaplain hour breakdowns, coverage grid preview, and full duty log list. Period filter (all-time, 30-day, 7-day)."
    },
    {
      "id": "coverage",
      "route": "/coverage",
      "file": "coverage-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Weekly coverage schedule grid (7 days x 17 hours, 5AM-9PM). Week navigation, view/edit mode toggle, gap indicators, coverage summary stats."
    },
    {
      "id": "stipends",
      "route": "/stipends",
      "file": "stipends-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Monthly stipend processing hub. Month selector, period summary, qualifying chaplains list, duty entry table with checkboxes, adjustment controls, payout totals, process button."
    },
    {
      "id": "stipend-detail",
      "route": "/stipends/:id",
      "file": "stipend-detail-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Detail view of a single payout record showing chaplain info, covered duty log entries, amount breakdown, adjustments, check number, and processing metadata."
    },
    {
      "id": "reports",
      "route": "/reports",
      "file": "reports-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "Analytics and reporting page with date range filter, encounter metrics chart, duty hours summary, stipend totals, and CSV export actions."
    },
    {
      "id": "settings",
      "route": "/settings",
      "file": "settings-v1.html",
      "version": 1,
      "status": "ready",
      "auth": true,
      "layout": "admin",
      "description": "System configuration including base stipend rate, admin user management, program year, and display preferences."
    }
  ]
}
</flex_block>

## Route Hierarchy Visualization

```
COMPASS Application Structure
│
├── Public Routes (no auth required)
│   ├── /login → Login Page
│   └── /forgot-password → Password Reset (not prototyped yet)
│
└── Protected Routes (admin auth required)
    │
    ├── / → Dashboard (Home)
    │   [KPI cards, on-duty list, recent logs]
    │
    ├── /users → User Management
    │   │   [Search, filter, user list]
    │   │
    │   └── /users/:id → User Detail
    │       [Profile edit, photo upload, history]
    │
    ├── /duty-days → Duty Tracking
    │   [Terminal distribution, hours, logs]
    │
    ├── /coverage → Coverage Schedule
    │   [17x7 grid, week navigation, edit mode]
    │
    ├── /stipends → Stipend Processing
    │   │   [Month selector, qualifying chaplains, process]
    │   │
    │   └── /stipends/:id → Payout Detail
    │       [Payout record, entries, audit trail]
    │
    ├── /reports → Reporting & Analytics
    │   [Metrics, charts, CSV export]
    │
    └── /settings → System Configuration
        [Stipend rate, admin users, preferences]
```

## Navigation Structure

### Desktop Sidebar Items (in order)

1. **Dashboard** - Home icon, route: `/`, always first item
2. **Users** - People icon, route: `/users`, user management functions
3. **Duty Days** - Clock icon, route: `/duty-days`, shift tracking and analysis
4. **Coverage** - Calendar-grid icon, route: `/coverage`, weekly schedule grid
5. **Stipends** - Dollar icon, route: `/stipends`, payment processing hub
6. **Reports** - Chart icon, route: `/reports`, analytics and export
7. *[Divider line]*
8. **Settings** - Gear icon, route: `/settings`, system configuration

### Sidebar Footer
- Current admin avatar (48px circle)
- Admin display name (subheading text)
- Logout button (icon-only or with "Logout" label)

### Breadcrumb Examples
- User Detail: `Users > Martinez`
- Stipend Detail: `Stipends > CHK-2026-0147`
- Edit Coverage: `Coverage > Week 6, Feb 3-9`

### Auth Requirements Summary

| Route | Auth Required | Admin Role Required | Redirect If Unauthorized |
|-------|---------------|---------------------|--------------------------|
| /login | No | No | Redirect to / if already authenticated |
| / | Yes | Yes | Redirect to /login, show "Admin access required" |
| /users | Yes | Yes | Redirect to /login |
| /users/:id | Yes | Yes | Redirect to /login or 404 if user not found |
| /duty-days | Yes | Yes | Redirect to /login |
| /coverage | Yes | Yes | Redirect to /login |
| /stipends | Yes | Yes | Redirect to /login |
| /stipends/:id | Yes | Yes | Redirect to /login or 404 if payout not found |
| /reports | Yes | Yes | Redirect to /login |
| /settings | Yes | Yes | Redirect to /login |
| /* (catch-all) | No | No | Show 404 page |

### Mobile Navigation Notes

COMPASS is desktop/tablet-first. On mobile devices (< 768px width):
- Sidebar becomes a hamburger-triggered drawer overlay
- Bottom tab bar is NOT used (this is an admin dashboard, not a consumer app)
- Coverage grid and stipend processing workflows show message: "This feature works best on a tablet or desktop"
- Login, Dashboard, Users, User Detail, Reports, and Settings pages adapt to mobile width
- Table-heavy pages (Duty Days, Stipends) enable horizontal scroll with sticky first column

### Tablet Navigation (768-1023px)

- Sidebar collapses to icon-only mode (64px width) by default
- Hover or tap sidebar icon expands labels temporarily
- Content area gains more horizontal space for data tables
- All features remain fully functional (unlike mobile)

### Desktop Navigation (1024px+)

- Full sidebar (240px width) with icon + label for each item
- Sidebar is persistent, always visible
- Content area is fluid width, fills remaining space
- Optimal experience for data-dense workflows
