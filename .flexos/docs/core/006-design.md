---
id: core-design
title: "Design"
description: "Visual identity, color system, typography, component inventory, and interaction patterns for COMPASS"
type: doc
subtype: core
status: draft
sequence: 6
tags: [core, design]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Design

## Brand Voice

COMPASS is an institutional operations tool. It is not playful, not trendy, not consumer-facing. It communicates through:

- **Authority:** Deep navy, professional typography, structured layouts. This tool handles money and personnel data. It must feel trustworthy.
- **Clarity:** Dense data presented without clutter. Every number, badge, and chart earns its screen space. White space is used for separation, not decoration.
- **Efficiency:** Workflows minimize clicks. Batch operations exist where single-item operations would be tedious. The interface anticipates what the admin needs next.
- **Restraint:** No animations for delight. Transitions serve orientation (what just changed?). Color is used for status and hierarchy, not decoration.

**Tone comparisons:** Stripe Dashboard (data density), GitHub (institutional trust), Linear (operational efficiency). NOT: Notion (too playful), Airtable (too colorful), Monday.com (too noisy).

## Color System

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#0A2D8C` | Sidebar background, primary buttons, active states, headings |
| `--color-primary-dark` | `#061B5A` | Sidebar hover, pressed states, emphasis |
| `--color-primary-light` | `#3B65D9` | Links, secondary highlights, selected items |
| `--color-primary-50` | `#EBF0FF` | Light primary tint for backgrounds, hover rows |

### Accent

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent` | `#39D2C0` | Coverage grid "covered" slots, positive trend indicators, accent buttons |
| `--color-accent-dark` | `#2BA899` | Accent hover states |
| `--color-accent-light` | `#7CE8DB` | Accent backgrounds |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#249689` | Paid badges, approved status, successful saves, covered slots |
| `--color-warning` | `#F9CF58` | Pending states, adjustment indicators, low coverage alerts |
| `--color-error` | `#E53E3E` | Failed operations, uncovered slots, validation errors, destructive actions |
| `--color-info` | `#3B65D9` | Informational badges, tool tips, help text |

### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-neutral-900` | `#14181B` | Body text, table headers, strong emphasis |
| `--color-neutral-600` | `#57636C` | Secondary text, descriptions, timestamps |
| `--color-neutral-400` | `#95A1AC` | Placeholder text, disabled states |
| `--color-neutral-200` | `#E0E3E7` | Borders, dividers, table lines |
| `--color-neutral-100` | `#F1F4F8` | Page background, card backgrounds, alternate rows |
| `--color-neutral-0` | `#FFFFFF` | Card surfaces, input backgrounds, sidebar content area |

### Dark Mode
COMPASS is a desktop-first admin tool used primarily in office environments. Dark mode is a **v2 consideration**, not a launch requirement. The color system is designed to support it (tokens are abstracted), but implementation is deferred.

## Typography

**Font Family:** Inter (Google Fonts, weights 400, 500, 600)

Inter is the right choice for data-dense operational interfaces. It has excellent legibility at small sizes, clear number disambiguation (distinguishes 0/O, 1/l/I), and tabular number support for financial data alignment.

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-display` | 28px | 600 | 1.2 | Page titles ("Dashboard", "Stipends") |
| `--text-heading` | 20px | 600 | 1.3 | Section headings, card titles |
| `--text-subheading` | 16px | 500 | 1.4 | Subsection labels, table headers |
| `--text-body` | 14px | 400 | 1.5 | Body text, descriptions, form labels |
| `--text-caption` | 12px | 400 | 1.4 | Timestamps, helper text, metadata |
| `--text-overline` | 11px | 500 | 1.3 | Uppercase labels, KPI card labels |
| `--text-kpi` | 36px | 600 | 1.1 | KPI card numbers (large, prominent) |

### Number Formatting
Financial amounts use tabular figures (`font-variant-numeric: tabular-nums`) to ensure columns of numbers align vertically in tables. Dollar amounts always show two decimal places ($80.00, not $80). Stipend totals are right-aligned.

## Component Inventory

These are the UI components needed to build COMPASS, organized by function:

### Navigation
- **AppSidebar** -- Persistent sidebar with nav items, branding, user info, logout
- **SidebarItem** -- Icon + label nav item with active state and badge support
- **Breadcrumb** -- Simple breadcrumb for detail pages (Users > Martinez)
- **PageHeader** -- Page title + optional actions (right-aligned buttons)

### Data Display
- **KPICard** -- Single metric with label, value, trend indicator (up/down/neutral), and optional sparkline
- **DataTable** -- Sortable, paginated table with row selection (checkboxes), column alignment, and click-through
- **StatusBadge** -- Colored pill for statuses: On Duty (green), Off Duty (gray), Paid (green), Pending (yellow), Approved (blue)
- **ChiplainCard** -- Compact card showing avatar, name, role, terminal assignment, on-duty status
- **EmptyState** -- Illustration + message + optional action button for empty data views
- **StatSummary** -- Horizontal row of labeled numbers (e.g., Monthly: $720 | YTD: $4,320 | All-Time: $12,960)

### Charts & Grids
- **CoverageGrid** -- 7-column x 17-row interactive matrix. Cells are toggleable in edit mode. Color: green (covered), white (uncovered), red border (gap alert). Column headers: Mon-Sun. Row headers: 5 AM-9 PM.
- **TerminalDistributionChart** -- Horizontal bar chart showing percentage of encounters per terminal (A through E). Simple colored bars, no 3D or animation.
- **EncounterTypeChart** -- Horizontal bar or pie chart for encounter category breakdown (crisis, grief, prayer, etc.)
- **TrendIndicator** -- Small up/down arrow with percentage change, colored green (positive) or red (negative)

### Forms & Inputs
- **TextInput** -- Standard text input with label, validation, error state
- **TextArea** -- Multi-line text for bios and narratives
- **Select** -- Dropdown for role selection, terminal selection
- **Toggle** -- Boolean switch for flags (isChaplain, isIntern, etc.)
- **FilterChips** -- Horizontal row of selectable chips (All Users, Chaplains, Interns, Support)
- **MonthSelector** -- Horizontal row of month chips (Jan-Dec) for stipend period selection
- **WeekSelector** -- Previous/Next arrows with current week label for coverage navigation
- **DateRangePicker** -- Start date + end date inputs for report filtering
- **AdjustmentSlider** -- Numeric input with +/- controls for stipend adjustments (range: -$80 to +$80)
- **SearchBar** -- Text input with search icon, debounced filtering, clear button
- **CheckNumberInput** -- Specialized text input in a modal for entering check references
- **PhotoUpload** -- Click-to-upload area with preview thumbnail, progress indicator, size validation
- **MultiSelect** -- Terminal assignment picker (checkboxes for A, B, C, D, E)

### Feedback & Overlay
- **Toast** -- Transient success/error messages (bottom-right, auto-dismiss after 4 seconds)
- **Modal** -- Centered overlay for check number entry, confirmation dialogs
- **ConfirmDialog** -- "Are you sure?" modal with cancel/confirm buttons for destructive or irreversible actions
- **LoadingSkeleton** -- Pulsing placeholder blocks matching the shape of content they replace
- **Spinner** -- Small inline spinner for button loading states
- **ProgressBar** -- Determinate progress for photo uploads
- **ErrorBanner** -- Full-width yellow/red banner for connection issues or permission errors
- **ReadOnlyBanner** -- Blue info banner for chat monitoring: "You are viewing this conversation in read-only mode"

### Layout
- **AdminLayout** -- Sidebar + content area shell with responsive breakpoints
- **PublicLayout** -- Centered card layout for login/forgot-password pages
- **Card** -- White surface with subtle shadow, used for KPI cards, profile sections, form groups
- **Section** -- Labeled content group within a page (heading + content + optional action)
- **Divider** -- Thin horizontal line for visual separation

## Interaction Patterns

### Click & Selection
- **Table row click** navigates to detail page (cursor: pointer, hover highlight)
- **Table row checkbox** selects for batch actions (shift+click for range select on stipends)
- **Coverage grid cell click** toggles coverage status (only in edit mode)
- **Filter chip click** toggles filter (single-select for role, multi-select for terminals in reports)
- **Month chip click** selects pay period (single-select, highlighted active)

### Transitions
- **Page transitions:** None. Instant navigation. Admin dashboards should not animate between pages.
- **Toast appearance:** Slide up from bottom-right, fade out after 4 seconds
- **Modal appearance:** Fade in overlay + scale up modal card (200ms ease-out)
- **Skeleton to content:** Cross-fade (150ms) when data loads
- **Coverage cell toggle:** Instant color change (no transition -- feels responsive)
- **Sidebar collapse:** Width transition (200ms ease) when switching between full and icon-only modes

### Touch & Mobile
- **Touch targets:** All interactive elements minimum 44x44px on tablet
- **Coverage grid on tablet:** Each cell is at least 40x40px. Scroll horizontally if needed. Pinch-zoom disabled to prevent accidental page zoom.
- **Sidebar on tablet:** Collapsed to icon-only mode by default. Tap hamburger to expand overlay.
- **Tables on mobile:** Horizontal scroll with sticky first column (chaplain name stays visible)
- **Stipend processing on mobile:** Show "Use a desktop or tablet" message. Do not attempt to squeeze this workflow onto a phone.

### Keyboard Navigation
- **Tab** moves between interactive elements in logical order
- **Enter/Space** activates buttons and toggles
- **Escape** closes modals and dropdown menus
- **Arrow keys** navigate coverage grid cells in edit mode
- **Ctrl+A** selects all entries in stipend batch selection

## Navigation Design

### Sidebar Structure (Desktop, 1024px+)

```
┌──────────────────────────────────────────────────┐
│ ┌────────────┐  ┌──────────────────────────────┐ │
│ │  COMPASS   │  │                              │ │
│ │  ─ ─ ─ ─  │  │     [Page Content Area]      │ │
│ │ ☐ Dashboard│  │                              │ │
│ │ ☐ Users    │  │                              │ │
│ │ ☐ Duty Days│  │                              │ │
│ │ ☐ Coverage │  │                              │ │
│ │ ☐ Stipends │  │                              │ │
│ │ ☐ Reports  │  │                              │ │
│ │ ☐ Chats    │  │                              │ │
│ │ ─ ─ ─ ─   │  │                              │ │
│ │ ☐ Settings │  │                              │ │
│ │            │  │                              │ │
│ │ ─ ─ ─ ─   │  │                              │ │
│ │ 👤 Linda   │  │                              │ │
│ │ [Logout]   │  │                              │ │
│ └────────────┘  └──────────────────────────────┘ │
└──────────────────────────────────────────────────┘
   240px width       Remaining width (fluid)
```

### Sidebar Structure (Tablet, 768-1023px)

```
┌──────────────────────────────────────────────────┐
│ ┌──┐  ┌─────────────────────────────────────────┐│
│ │☐ │  │                                         ││
│ │☐ │  │     [Page Content Area]                 ││
│ │☐ │  │     (wider, more room for tables)       ││
│ │☐ │  │                                         ││
│ │☐ │  │                                         ││
│ │☐ │  │                                         ││
│ │☐ │  │                                         ││
│ │──│  │                                         ││
│ │☐ │  │                                         ││
│ │──│  │                                         ││
│ │👤│  │                                         ││
│ └──┘  └─────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
 64px     Remaining width
```

## Key Screen Descriptions

### Dashboard (Most-Viewed Screen)

The dashboard is the first thing an admin sees after login. It must communicate the operational health of the chaplaincy program in under 5 seconds of scanning.

**Top section:** Four KPI cards in a horizontal row. Each card has an overline label (gray, uppercase, 11px), a large number (36px, bold), and a trend indicator. Cards: "Total Chaplains" (count, trend vs 30d ago), "On Duty Now" (count, green if > 0), "Encounters (7d)" (count, trend vs prior 7d), "New Signups (30d)" (count).

**Middle section:** Two-column layout. Left column: "Currently On Duty" -- a compact list of chaplain cards showing avatar, name, terminal, and clock-in time. Right column: "Today's Coverage" -- a mini version of the coverage grid showing only today's row (17 hours) with green/empty cells.

**Bottom section:** "Recent Duty Logs" -- a 10-row data table with columns: Chaplain, Date, Terminal, Hours, Status (approved/pending). Sorted by most recent. Click a row to navigate to the duty days page filtered for that chaplain.

**Visual feel:** Clean, professional, information-dense but not cluttered. Navy header with white page background. Cards have subtle shadows on white surfaces. No heavy borders anywhere.

### Stipends Page (Most Complex Screen)

The stipends page is where COMPASS earns its keep. This screen replaces an afternoon of spreadsheet work.

**Top section:** Month selector -- a horizontal row of 12 chips (Jan through Dec). Current month is auto-selected with primary color fill. Past completed months show a small checkmark. Future months are dimmed.

**Summary bar:** Below the month selector, a horizontal stat summary shows: "Selected: January 2026 | Qualifying Chaplains: 18 | Total Shifts: 47 | Base Amount: $3,760 | Adjustments: +$60 | Grand Total: $3,820"

**Main table:** A data table with expandable rows. Each row shows a chaplain with: checkbox (for batch select), avatar, name, shift count, base amount, adjustment total, and final total. Clicking the row expands to show individual duty entries underneath (nested rows) with per-entry checkboxes and adjustment controls.

**Already-paid section:** Below the main table, a collapsed section "Processed Payments (4)" shows previously paid entries for this month with green "Paid" badges and check numbers. These rows have no checkboxes -- they are read-only.

**Action bar:** Fixed to the bottom of the content area. Shows: "X entries selected | Total: $X,XXX" on the left, "Process Selected" button (primary, large) on the right. Disabled if nothing selected.

### Coverage Schedule (Most Interactive Screen)

The coverage grid is a unique UI element specific to airport chaplaincy operations.

**Top section:** Week selector with left/right arrows and a center label showing "Week 6, Feb 3-9, 2026". A toggle switch labeled "Edit Mode" (off by default, requires admin intent to enable).

**Grid:** A 7-column (Mon-Sun) by 17-row (5 AM - 9 PM) matrix. Each cell is a square (minimum 40x40px on desktop). Covered slots are filled with a solid teal/green (`#39D2C0`). Uncovered slots are white with a light gray border. In edit mode, hovering a cell shows a subtle highlight; clicking toggles coverage.

**Gap indicators:** Rows with 3 or more uncovered slots in a row get a red left-border to draw attention. A summary below the grid shows: "Coverage Rate: 72% | Gaps: 33 hours | Longest Gap: Tuesday 6-9 AM (3 hours)".

**Color logic:**
- Green fill: Covered (slot.value = true)
- White/empty: Not covered (slot.value = false)
- Red border on row: 3+ consecutive gaps detected
- Blue highlight: Currently hovered cell (edit mode only)
- Pulse animation: Cell being saved (brief, 200ms, after toggle)

## Accessibility

### Color Contrast
All text meets WCAG AA contrast ratios (minimum 4.5:1 for body text, 3:1 for large text):
- `#14181B` on `#FFFFFF` = 18.2:1 (body text on white)
- `#57636C` on `#FFFFFF` = 5.9:1 (secondary text on white)
- `#FFFFFF` on `#0A2D8C` = 9.4:1 (sidebar text on navy)
- `#FFFFFF` on `#E53E3E` = 4.6:1 (white on error red)

The coverage grid uses color + shape (filled vs. empty cell border) to distinguish states, not color alone.

### Keyboard Navigation
- Full keyboard support for all interactive elements
- Visible focus indicators (2px primary-color outline, 2px offset)
- Coverage grid navigable with arrow keys in edit mode
- Data tables navigable with Tab (cells) and Enter (activation)
- Modal traps focus until dismissed with Escape

### Screen Readers
- All images have alt text (profile photos: "Photo of [name]")
- KPI cards use `aria-label` for the full reading: "Total Chaplains: 62, up 3 from 30 days ago"
- Coverage grid cells announce: "Monday 5 AM: covered" or "Monday 5 AM: uncovered"
- Status badges have `aria-label` not just color: "Status: Paid" not just a green dot
- Data tables use proper `<thead>`, `<tbody>`, scope attributes
- Page landmarks: `<nav>` for sidebar, `<main>` for content, `<header>` for page titles

### Touch Targets
- All buttons: minimum 44px height
- Sidebar items: 48px height (comfortable touch)
- Filter chips: 36px height, 8px gaps (sufficient for finger targets)
- Coverage grid cells: 40px minimum (adequate for intentional taps, not casual scrolling)
- Table row click areas: full row height (at least 48px)
