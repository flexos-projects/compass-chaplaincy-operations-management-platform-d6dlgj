---
id: design_visual-identity
title: "Visual Identity & Design System"
description: "Complete visual design specification including brand identity, color system, typography, component inventory, navigation patterns, layouts, and accessibility standards for COMPASS"
type: spec
subtype: design
status: draft
sequence: 31
tags: [design, visual-identity, branding, ui, accessibility]
relatesTo: [docs/core/006-design.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Visual Identity & Design System

## Brand Identity

### Brand Personality
COMPASS is an **institutional operations tool** for chaplaincy program management. The design communicates:

- **Authority & Trust:** Handles sensitive personnel and financial data – must feel secure and professional
- **Operational Clarity:** Dense data presented without clutter – every element earns its space
- **Efficiency:** Workflows minimize clicks, anticipate admin needs, enable rapid task completion
- **Restraint:** No playful elements, no decorative flourishes – design serves function

**Tone Comparisons:**
- **Like:** Stripe Dashboard (data density), GitHub (institutional trust), Linear (operational efficiency)
- **Unlike:** Notion (too playful), Airtable (too colorful), Monday.com (too noisy)

### Design Principles
1. **Data First:** Information hierarchy prioritizes actionable data over aesthetics
2. **Consistency Over Novelty:** Reuse patterns – admin tools should be predictable, not surprising
3. **Performance Matters:** Every animation, every library, every image must justify its impact on load time
4. **Accessibility is Non-Negotiable:** WCAG AA compliance minimum, AAA target

## Color System

### Primary Palette
| Token | Hex | RGB | Usage | WCAG AA |
|-------|-----|-----|-------|---------|
| `--color-primary` | `#0A2D8C` | 10, 45, 140 | Sidebar background, primary buttons, headings, active nav items | ✓ on white |
| `--color-primary-dark` | `#061B5A` | 6, 27, 90 | Sidebar hover states, pressed buttons, deep emphasis | ✓ on white |
| `--color-primary-light` | `#3B65D9` | 59, 101, 217 | Links, secondary highlights, selected table rows | ✓ on white |
| `--color-primary-50` | `#EBF0FF` | 235, 240, 255 | Light primary tint for backgrounds, hover rows, focus states | ✓ on dark text |

**Rationale:** Deep navy conveys professionalism and institutional trust. Not black (too harsh), not blue-gray (too corporate tech), but a balanced authoritative blue.

### Accent & Semantic Colors
| Token | Hex | Usage | Notes |
|-------|-----|-------|-------|
| `--color-accent` | `#39D2C0` | Coverage grid "covered" state, positive trend indicators | Teal – distinct from primary, calming |
| `--color-accent-dark` | `#2BA899` | Accent hover states | — |
| `--color-accent-light` | `#7CE8DB` | Accent backgrounds, subtle highlights | — |
| `--color-success` | `#249689` | Paid badges, approved status, successful saves | Green-teal, consistent with accent |
| `--color-warning` | `#F9CF58` | Pending states, adjustment indicators, low coverage alerts | Warm yellow, not alarming |
| `--color-error` | `#E53E3E` | Failed operations, uncovered slots, validation errors | Standard error red |
| `--color-info` | `#3B65D9` | Informational badges, tooltips, help text | Same as primary-light for consistency |

### Neutrals
| Token | Hex | Usage | Contrast |
|-------|-----|-------|----------|
| `--color-neutral-900` | `#14181B` | Body text, table headers, strong emphasis | 18.2:1 on white |
| `--color-neutral-600` | `#57636C` | Secondary text, descriptions, timestamps | 5.9:1 on white |
| `--color-neutral-400` | `#95A1AC` | Placeholder text, disabled states | 3.2:1 on white (AA large text) |
| `--color-neutral-200` | `#E0E3E7` | Borders, dividers, table lines | — |
| `--color-neutral-100` | `#F1F4F8` | Page background, card surfaces alternate | — |
| `--color-neutral-0` | `#FFFFFF` | Card surfaces, input backgrounds, sidebar content | — |

**Dark Mode:** Not included in v1. Color tokens are abstracted for future implementation.

## Typography

### Font Family
**Inter** (Google Fonts, weights 400, 500, 600)

**Rationale:**
- Excellent legibility at small sizes (critical for dense data tables)
- Clear number disambiguation (0/O, 1/l/I are distinct)
- Tabular number support for financial data alignment
- Neutral, professional, widely used in operational tools

### Type Scale
| Token | Size | Weight | Line Height | Usage | Example |
|-------|------|--------|-------------|-------|---------|
| `--text-display` | 28px | 600 | 1.2 | Page titles | "Dashboard", "Stipends" |
| `--text-heading` | 20px | 600 | 1.3 | Section headings, card titles | "Currently On Duty" |
| `--text-subheading` | 16px | 500 | 1.4 | Subsection labels, table headers | "Chaplain Name" |
| `--text-body` | 14px | 400 | 1.5 | Body text, form labels, table cells | Most content |
| `--text-caption` | 12px | 400 | 1.4 | Timestamps, helper text, metadata | "Updated 2 hours ago" |
| `--text-overline` | 11px | 500 | 1.3 | Uppercase labels (all caps) | "TOTAL CHAPLAINS" |
| `--text-kpi` | 36px | 600 | 1.1 | KPI card numbers | "62" (large, prominent) |

### Number Formatting
- **Tabular Figures:** All financial amounts use `font-variant-numeric: tabular-nums` for vertical alignment
- **Decimal Places:** Dollar amounts always show two decimals: `$80.00`, `$3,760.00`
- **Alignment:** Right-align numbers in tables, left-align text
- **Thousands Separator:** Use commas: `$12,960.00`

## Component Inventory

### Navigation Components
| Component | Description | States | Variants |
|-----------|-------------|--------|----------|
| **AppSidebar** | Persistent sidebar with logo, nav items, user info, logout | Expanded (240px), Collapsed (64px) | Desktop, Tablet |
| **SidebarItem** | Icon + label nav item | Default, Hover, Active, Disabled | With/without badge |
| **Breadcrumb** | Simple breadcrumb trail | Default | Max 3 levels |
| **PageHeader** | Page title + optional action buttons | Default | With/without actions |

### Data Display Components
| Component | Description | Usage |
|-----------|-------------|-------|
| **KPICard** | Single metric with value, label, trend | Dashboard summary cards |
| **DataTable** | Sortable, paginated table with row selection | Users, duty logs, stipends |
| **StatusBadge** | Colored pill for statuses | On Duty, Paid, Pending, Approved |
| **ChaplainCard** | Compact card with avatar, name, role, terminal | On-duty list, search results |
| **EmptyState** | Illustration + message + optional CTA | No data found states |
| **StatSummary** | Horizontal row of labeled numbers | Monthly/YTD/All-Time totals |

### Charts & Grids
| Component | Description | Library | Usage |
|-----------|-------------|---------|-------|
| **CoverageGrid** | 7×17 interactive matrix | Custom (CSS Grid) | Weekly coverage schedule |
| **TerminalDistributionChart** | Horizontal bar chart | Chart.js or native SVG | Duty tracking breakdown |
| **EncounterTypeChart** | Horizontal bar or pie chart | Chart.js or native SVG | Reports page |
| **TrendIndicator** | Up/down arrow with percentage | Custom component | KPI cards |

### Form & Input Components
| Component | States | Validation | Notes |
|-----------|--------|------------|-------|
| **TextInput** | Default, Focus, Error, Disabled | Client-side + server-side | Standard text field |
| **TextArea** | Default, Focus, Error, Disabled | Character count (optional) | Multi-line bios, notes |
| **Select** | Default, Open, Focus, Disabled | Required check | Role, terminal selection |
| **Toggle** | Off, On, Disabled | Boolean value | isChaplain, isIntern flags |
| **FilterChips** | Default, Selected, Hover | Single or multi-select | All/Chaplains/Interns/Support |
| **MonthSelector** | Default, Selected, Completed, Disabled | Month validation | Stipend period selection |
| **WeekSelector** | Default, Disabled | Week range 1-53 | Coverage week navigation |
| **DateRangePicker** | Default, Focus, Error | Start < End validation | Report filtering |
| **AdjustmentSlider** | Default, Dragging, Disabled | Range -$80 to +$80 | Stipend adjustments |
| **SearchBar** | Default, Focus, Active (with text) | Debounced (300ms) | User search, filtering |
| **CheckNumberInput** | Default, Focus, Error | 3-50 char alphanumeric | Check number entry modal |
| **PhotoUpload** | Empty, Preview, Uploading, Error | Size, type validation | Profile photo upload |
| **MultiSelect** | Default, Open, Selected items | At least one selected | Terminal assignment |

### Feedback & Overlay Components
| Component | Behavior | Duration | Position |
|-----------|----------|----------|----------|
| **Toast** | Slide up, auto-dismiss | 4 seconds | Bottom-right |
| **Modal** | Fade in overlay + scale up | Dismissible with Escape | Centered |
| **ConfirmDialog** | Modal variant | User-dismissed | Centered |
| **LoadingSkeleton** | Pulsing animation | Until data loads | In-place |
| **Spinner** | Rotating animation | Indefinite | Inline or centered |
| **ProgressBar** | Determinate 0-100% | Until complete | Inline |
| **ErrorBanner** | Full-width, dismissible | User-dismissed | Top of page |
| **ReadOnlyBanner** | Full-width, persistent | Persistent | Below header |

### Layout Components
| Component | Description | Responsive Behavior |
|-----------|-------------|---------------------|
| **AdminLayout** | Sidebar + content area shell | Sidebar collapses to icons on tablet |
| **PublicLayout** | Centered card for login/forgot-password | Fixed width card (480px max) |
| **Card** | White surface with subtle shadow | Full-width on mobile, max-width on desktop |
| **Section** | Labeled content group (heading + content + optional action) | Stack vertically on mobile |
| **Divider** | Thin horizontal line (1px, neutral-200) | Full-width |

## Navigation Design

### Sidebar Structure (Desktop, 1024px+)
```
┌────────────┐
│  COMPASS   │  Logo + wordmark (primary color)
│  ─ ─ ─ ─  │
│ ☐ Dashboard│  Icon + label nav items
│ ☐ Users    │  Active state: primary-light background
│ ☐ Duty Days│  Hover state: primary-dark background
│ ☐ Coverage │  Badge support (e.g., "3 gaps")
│ ☐ Stipends │
│ ☐ Reports  │
│ ☐ Chats    │
│ ─ ─ ─ ─   │  Divider
│ ☐ Settings │  Secondary items below divider
│            │
│ ─ ─ ─ ─   │  Bottom section (sticky)
│ 👤 Linda   │  Admin name + avatar
│ [Logout]   │  Logout button
└────────────┘
```
**Width:** 240px (full), 64px (collapsed icons-only)

### Sidebar Structure (Tablet, 768-1023px)
```
┌──┐
│☐ │  Icon-only by default
│☐ │  Tap hamburger to expand overlay
│☐ │  Overlay slides in from left (240px)
│☐ │  Click outside to dismiss
│☐ │
│☐ │
│☐ │
│──│
│☐ │
│──│
│👤│
└──┘
```
**Width:** 64px (collapsed), 240px (overlay expanded)

## Key Screen Layouts

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                         [Refresh] │  Page Header
├─────────────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │  KPI Cards (4)
│ │  62    │ │   4    │ │  142   │ │   8    │              │
│ │Chaplain│ │On Duty │ │Encount │ │New (30d│              │
│ │  ↑ 3   │ │        │ │  ↑ 12% │ │        │              │
│ └────────┘ └────────┘ └────────┘ └────────┘              │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌───────────────────────────────┐│
│ │ Currently On Duty    │ │ Today's Coverage             ││  Two-Column
│ │ ┌──────────────────┐ │ │ ┌─────────────────────────┐ ││
│ │ │👤 Martinez  Term A│ │ │ │ 5 6 7 8 9 10 11 12 1 2 │ ││
│ │ │👤 Johnson   Term B│ │ │ │ ✓ ✓ ✓ ✓ ✓  ✓  ✓  ✓ ✓ ✓ │ ││  (Mini grid)
│ │ │👤 Lee       Term C│ │ │ └─────────────────────────┘ ││
│ │ │👤 Park      Term A│ │ │ Coverage: 72% | 5 gaps     ││
│ │ └──────────────────┘ │ └───────────────────────────────┘│
│ └──────────────────────┘                                  │
├─────────────────────────────────────────────────────────────┤
│ Recent Duty Logs                                  [View All]│  Section Header
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Chaplain   │ Date      │ Terminal │ Hours │ Status   │ │  Data Table
│ │ Martinez   │ Feb 9     │ A        │ 6.5   │ Approved │ │
│ │ Johnson    │ Feb 9     │ B        │ 7.0   │ Approved │ │
│ │ ...        │           │          │       │          │ │
│ └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Stipends Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Stipends                                                    │  Page Header
├─────────────────────────────────────────────────────────────┤
│ [Jan][Feb][Mar][Apr][May][Jun][Jul][Aug][Sep][Oct][Nov][Dec]│  Month Selector
│  ✓    ✓   (Mar)  ...                                       │  (Chips)
├─────────────────────────────────────────────────────────────┤
│ March 2026 | 18 Chaplains | 47 Shifts | $3,760 | Adj: +$60│  Summary Bar
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐│
│ │☐│Chaplain  │Shifts│Base  │Adj │Total │     [Expand]    ││  Main Table
│ │☐│Martinez  │  4   │$320  │ $0 │ $320 │                 ││  (Expandable)
│ │☐│Johnson   │  3   │$240  │+$20│ $260 │                 ││
│ │ │  └─ Jan 5  6.5h  Term A   $80   +$20  $100          ││  Nested rows
│ │ │  └─ Jan 12 7.0h  Term B   $80    $0   $80           ││  (on expand)
│ │ │  └─ Jan 19 5.5h  Term A   $80    $0   $80           ││
│ │☐│Lee       │  2   │$160  │ $0 │ $160 │                 ││
│ └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ Processed Payments (4)                           [Collapse]│  Already Paid
│ ┌─────────────────────────────────────────────────────────┐│  (Read-Only)
│ │ Martinez  │ 2 shifts │ $160 │ Paid ✓ │ CHK-2026-0147   ││
│ └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ 12 selected | Total: $1,040              [Process Selected]│  Action Bar
└─────────────────────────────────────────────────────────────┘  (Fixed bottom)
```

### Coverage Schedule Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Coverage Schedule                           [Edit Mode: OFF]│  Page Header
├─────────────────────────────────────────────────────────────┤
│ [<] Week 6, Feb 3-9, 2026 [>]                              │  Week Selector
├─────────────────────────────────────────────────────────────┤
│      │ Mon│ Tue│ Wed│ Thu│ Fri│ Sat│ Sun│                  │  Grid Header
│ ─────┼────┼────┼────┼────┼────┼────┼────┤                 │
│  5 AM│ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │    │    │                  │  17 rows
│  6 AM│ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │    │    │                  │  (5 AM-9 PM)
│  7 AM│ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │ ✓  │    │                  │
│  ...│    │    │    │    │    │    │    │                  │  Green = covered
│  9 PM│ ✓  │ ✓  │ ✓  │    │    │    │    │                  │  White = uncovered
├─────────────────────────────────────────────────────────────┤
│ Coverage: 68% | 37 gaps | Longest: Tue 6-9 AM (3 hours)   │  Summary Stats
└─────────────────────────────────────────────────────────────┘
```

## Accessibility Standards

### Color Contrast (WCAG AA Minimum)
- Body text (14px, neutral-900 on white): **18.2:1** (AAA)
- Secondary text (14px, neutral-600 on white): **5.9:1** (AA)
- Headings (20px+, primary on white): **9.4:1** (AAA)
- Error text (14px, error on white): **4.6:1** (AA)
- Button text (14px, white on primary): **9.4:1** (AAA)

**Coverage Grid Color + Shape:**
- Covered slots: Teal fill (`#39D2C0`)
- Uncovered slots: White with gray border (1px `#E0E3E7`)
- Not color-alone (border distinguishes states)

### Keyboard Navigation
- **Tab order:** Logical left-to-right, top-to-bottom
- **Focus indicators:** 2px primary-color outline, 2px offset
- **Coverage grid:** Arrow keys navigate cells in edit mode
- **Tables:** Tab to cells, Enter to activate row click
- **Modals:** Focus trap until dismissed with Escape
- **Skip links:** "Skip to main content" for screen readers

### Screen Reader Support
- **Semantic HTML:** `<nav>`, `<main>`, `<header>`, `<table>` with proper scope
- **Alt text:** All profile photos: "Photo of [Name]"
- **Aria labels:** KPI cards announce full reading: "Total Chaplains: 62, up 3 from 30 days ago"
- **Coverage grid:** Cells announce "Monday 5 AM: covered" or "uncovered"
- **Status badges:** `aria-label="Status: Paid"` not just color

### Touch Targets (Mobile/Tablet)
- **All buttons:** Minimum 44×44px (WCAG AAA)
- **Sidebar items:** 48px height (comfortable touch)
- **Filter chips:** 36px height, 8px gaps
- **Coverage grid cells:** 40px minimum (adequate for intentional taps)
- **Table rows:** Full row clickable, minimum 48px height

## Acceptance Criteria

- [ ] All text meets WCAG AA contrast ratios (4.5:1 body, 3:1 large text)
- [ ] Color is never the only indicator of state (use icons, borders, labels)
- [ ] All interactive elements have minimum 44px touch targets
- [ ] Focus indicators are visible on all focusable elements
- [ ] Keyboard navigation works for all interactive flows
- [ ] Screen reader testing passes with NVDA and VoiceOver
- [ ] Component library documented with usage examples
- [ ] Design tokens are defined in CSS custom properties
- [ ] Responsive breakpoints tested: 768px (tablet), 1024px (desktop)
- [ ] Coverage grid renders correctly at all viewport sizes

## Design Tokens (CSS Custom Properties)
All design values are abstracted as CSS custom properties for consistency and future theming:

```css
:root {
  /* Colors */
  --color-primary: #0A2D8C;
  --color-primary-dark: #061B5A;
  --color-primary-light: #3B65D9;
  --color-accent: #39D2C0;
  --color-success: #249689;
  --color-warning: #F9CF58;
  --color-error: #E53E3E;

  /* Typography */
  --font-family: 'Inter', sans-serif;
  --text-display: 28px;
  --text-heading: 20px;
  --text-body: 14px;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```
