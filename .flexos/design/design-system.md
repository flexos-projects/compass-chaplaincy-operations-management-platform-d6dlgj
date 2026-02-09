---
id: design-system
title: "Design System"
description: "Visual identity, design tokens, and component guidelines for COMPASS"
type: design
subtype: manifest
status: draft
sequence: 1
tags: [design, tokens, components]
relatesTo: ["docs/core/006-design.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Design System

<flex_block type="instructions">
This design system is the single source of truth for all visual design decisions in COMPASS. Use the tokens defined here for all colors, typography, and spacing. When building components, reference the Component Inventory section to understand interaction patterns and visual hierarchy. All measurements use pixels. All colors are specified as hex codes. The design system is optimized for desktop-first admin dashboards with tablet support. Dark mode is deferred to v2. When in doubt, prioritize clarity over decoration—this is an operational tool, not a consumer product.
</flex_block>

## Brand Voice

COMPASS is an institutional operations management tool built for chaplaincy program directors at DFW Airport. The interface communicates through authority, clarity, efficiency, and restraint. The visual language must feel trustworthy because it handles sensitive personnel data and financial transactions. Every element serves a functional purpose—no animations for delight, no decorative color, no playful language. The tone is professional and direct, comparable to Stripe's dashboard (data density), GitHub's enterprise UI (institutional trust), and Linear's task management (operational efficiency). It is explicitly not like Notion (too playful), Airtable (too colorful), or Monday.com (too noisy).

The color palette centers on a deep institutional navy that conveys stability and trust. Teal accents provide energy without frivolity. Financial data uses green for positive states (paid, approved, covered) and red for alerts (gaps, errors, failures). Typography is Inter, chosen for exceptional legibility at small sizes, clear number differentiation (critical for financial data), and professional character without personality. White space separates functional zones but never dominates—screen real estate is precious in data-dense interfaces.

## Color Usage Guidelines

Primary navy (#0A2D8C) is the backbone of the interface: sidebar background, primary buttons, active navigation states, and section headings. It provides visual weight and institutional gravitas. Primary light (#3B65D9) is used sparingly for links and secondary highlights, maintaining the same hue family while providing contrast. Primary dark (#061B5A) appears on hover and pressed states, reinforcing interaction affordance without introducing new colors.

Accent teal (#39D2C0) marks positive operational states: coverage grid slots that have chaplain coverage, successful saves, positive trend indicators. It provides visual energy and optimism in an otherwise reserved palette. Success green (#249689) is semantically distinct from accent teal—it marks completed transactions (paid badges, approved status) and final states. Warning yellow (#F9CF58) highlights pending states, adjustment indicators, and low-coverage alerts without triggering alarm. Error red (#E53E3E) is reserved for true failures: validation errors, uncovered critical time slots, destructive action confirmations.

Neutrals provide hierarchy and structure. Neutral-900 (#14181B) is body text and table headers—high contrast for readability. Neutral-600 (#57636C) is secondary text like timestamps and descriptions. Neutral-400 (#95A1AC) marks disabled states and placeholder text. Neutral-200 (#E0E3E7) provides subtle borders and dividers. Neutral-100 (#F1F4F8) is the page background, creating separation from white card surfaces. Neutral-0 (pure white) is reserved for content surfaces, input backgrounds, and sidebar content areas.

<flex_block type="tokens" name="colors-light">
{
  "primary": {
    "50": "#EBF0FF",
    "100": "#D6E0FF",
    "200": "#ADC2FF",
    "300": "#85A3FF",
    "400": "#5C85FF",
    "500": "#3B65D9",
    "600": "#0A2D8C",
    "700": "#082470",
    "800": "#061B5A",
    "900": "#041343"
  },
  "accent": {
    "100": "#E5F9F7",
    "200": "#B3F0E9",
    "300": "#7CE8DB",
    "400": "#39D2C0",
    "500": "#2BA899",
    "600": "#1D8072",
    "700": "#175E54",
    "800": "#114339",
    "900": "#0A2B24"
  },
  "success": {
    "100": "#D4F2EF",
    "200": "#A9E5DF",
    "300": "#7DD8CF",
    "400": "#52CBBF",
    "500": "#249689",
    "600": "#1E7B70",
    "700": "#185F57",
    "800": "#12443E",
    "900": "#0C2925"
  },
  "warning": {
    "100": "#FEF8E7",
    "200": "#FDF0CC",
    "300": "#FBE8B0",
    "400": "#FADF94",
    "500": "#F9CF58",
    "600": "#E8B523",
    "700": "#B88D1B",
    "800": "#876714",
    "900": "#57400C"
  },
  "error": {
    "100": "#FEE8E8",
    "200": "#FDD1D1",
    "300": "#FBABAB",
    "400": "#F98585",
    "500": "#E53E3E",
    "600": "#C42F2F",
    "700": "#A32525",
    "800": "#7A1C1C",
    "900": "#521313"
  },
  "info": {
    "100": "#D6E0FF",
    "200": "#ADC2FF",
    "300": "#85A3FF",
    "400": "#5C85FF",
    "500": "#3B65D9",
    "600": "#2A4FB8",
    "700": "#1E3A8A",
    "800": "#14265C",
    "900": "#0A1330"
  },
  "neutral": {
    "0": "#FFFFFF",
    "100": "#F1F4F8",
    "200": "#E0E3E7",
    "300": "#C8CCD1",
    "400": "#95A1AC",
    "500": "#778491",
    "600": "#57636C",
    "700": "#424B54",
    "800": "#2D343C",
    "900": "#14181B"
  }
}
</flex_block>

<flex_block type="tokens" name="colors-dark">
{
  "note": "Dark mode is deferred to v2. These tokens are placeholders for future implementation.",
  "primary": {
    "50": "#041343",
    "500": "#5C85FF",
    "900": "#EBF0FF"
  },
  "neutral": {
    "0": "#14181B",
    "100": "#2D343C",
    "900": "#F1F4F8"
  }
}
</flex_block>

## Typography Guidelines

Inter is the typeface family for all text in COMPASS. It was designed specifically for digital interfaces with exceptional legibility at small sizes. Critical features include clear differentiation between 0/O and 1/l/I (essential for check numbers and user IDs), tabular figure support (numeric columns align vertically in tables), and a neutral professional character that does not distract from content.

Three weights are used: 400 (regular) for body text and descriptions, 500 (medium) for subheadings and emphasized labels, and 600 (semi-bold) for page titles and KPI numbers. Avoid using bold (700) except in extreme emphasis situations—semi-bold provides sufficient weight without overwhelming the interface. Never use light weights (300 or below) as they reduce legibility on lower-quality displays.

The type scale balances hierarchy with density. Display text (28px) is reserved for page titles like "Dashboard" and "Stipends"—used once per page. Heading text (20px) marks major sections within a page: "Currently On Duty", "Qualifying Chaplains". Subheading (16px) labels subsections and table column headers. Body text (14px) is the default for all content, form labels, and table cells. Caption text (12px) provides metadata like timestamps and helper text without competing with primary content. Overline text (11px, uppercase, medium weight) labels KPI cards and status groupings. KPI numbers (36px, semi-bold) are the largest text on screen, ensuring at-a-glance readability of critical metrics.

Line heights are optimized for scanability. Headings use tighter line-height (1.2-1.3) because they are short and benefit from vertical compactness. Body text uses 1.5 for comfortable reading over multiple lines. Captions and overlines use 1.3-1.4 as they rarely wrap and benefit from compactness.

<flex_block type="tokens" name="typography">
{
  "fontFamily": {
    "primary": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif"
  },
  "fontSize": {
    "display": "28px",
    "heading": "20px",
    "subheading": "16px",
    "body": "14px",
    "caption": "12px",
    "overline": "11px",
    "kpi": "36px"
  },
  "fontWeight": {
    "regular": 400,
    "medium": 500,
    "semibold": 600
  },
  "lineHeight": {
    "display": 1.2,
    "heading": 1.3,
    "subheading": 1.4,
    "body": 1.5,
    "caption": 1.4,
    "overline": 1.3,
    "kpi": 1.1
  },
  "letterSpacing": {
    "tight": "-0.02em",
    "normal": "0",
    "wide": "0.05em"
  },
  "textTransform": {
    "overline": "uppercase"
  },
  "fontVariant": {
    "numeric": "tabular-nums"
  }
}
</flex_block>

<flex_block type="tokens" name="spacing">
{
  "base": "4px",
  "scale": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "2xl": "48px",
    "3xl": "64px",
    "4xl": "96px"
  },
  "usage": {
    "componentPadding": "16px",
    "cardPadding": "24px",
    "sectionGap": "32px",
    "pageMargin": "48px",
    "inputHeight": "44px",
    "buttonHeight": "44px",
    "touchTarget": "44px",
    "gridGap": "8px"
  }
}
</flex_block>

## Component Inventory

COMPASS is built from 47 components organized by function. Each component has defined size variants, color variants, and state behaviors. All interactive components meet WCAG AA touch target minimums (44x44px). All components use design tokens exclusively—no hardcoded colors or sizes.

**Navigation (4 components):** AppSidebar provides persistent navigation with icon+label items, branding header, user info footer, and logout button. Width: 240px desktop, 64px tablet (icon-only collapsed), full-screen overlay on mobile. SidebarItem is a nav link with active state (primary-600 background), hover state (primary-700), icon (24x24px), label (body text), and optional badge for counts. Breadcrumb shows navigation path on detail pages (Users > Martinez > Edit) with separator chevrons and clickable segments. PageHeader combines page title (display text) with optional right-aligned action buttons.

**Data Display (6 components):** KPICard shows a single metric with overline label, large KPI number, optional trend indicator (up/down arrow with percentage, colored green/red), and optional sparkline. White card surface with subtle shadow. DataTable is a sortable, paginated table with column headers, row selection checkboxes, column alignment (left for text, right for numbers), click-through on rows, and sticky header on scroll. StatusBadge is a colored pill with 8px vertical padding, 12px horizontal padding, 12px font size, and border-radius 12px (fully rounded). Colors map to semantic states: green (on duty, paid, approved), yellow (pending, adjustment), red (error, failed), gray (off duty, inactive), blue (info). ChaplainCard is a compact horizontal card with avatar (48x48px circle), name (subheading), role (caption, neutral-600), terminal badges (small pills), and on-duty indicator (green dot if active). EmptyState shows an illustration (simple line drawing, neutral-400), message (subheading), and optional action button centered in the content area. StatSummary is a horizontal row of labeled numbers separated by vertical dividers: "Monthly: $720 | YTD: $4,320 | All-Time: $12,960". Numbers use tabular figures for alignment.

**Charts & Grids (4 components):** CoverageGrid is the most unique component in COMPASS—a 7-column (Mon-Sun) by 17-row (5 AM-9 PM) interactive matrix. Each cell is a square (minimum 40x40px) with green fill (covered), white background with light border (uncovered), red left-border on row (3+ consecutive gaps), blue highlight (hovered in edit mode), and pulse animation (200ms after save). Grid has column headers (day names, subheading) and row headers (time labels, caption). TerminalDistributionChart is a horizontal bar chart showing percentage by terminal A-E. Bars use primary-500 color, fill from left, show percentage label on right. EncounterTypeChart is a horizontal bar chart for encounter categories (crisis, grief, prayer, violence, travel-related, personal). Colors use semantic palette. TrendIndicator is a small icon+text component: up arrow (green) for positive change, down arrow (red) for negative, horizontal line (gray) for no change. Shows percentage like "+12%".

**Forms & Inputs (14 components):** All form components share consistent sizing (44px height for single-line inputs), 16px padding, border radius 8px, border color neutral-200 (default) or primary-500 (focus), and transition 150ms. TextInput has label above, input field, optional helper text below, and error state (red border + error message). TextArea is multi-line with minimum 3 rows and resize handle. Select is a custom dropdown (not native) with search filtering for long lists. Toggle is a boolean switch: 48x28px track, 24x24px thumb, smooth slide transition 200ms, primary-500 when on. FilterChips are horizontal row of selectable chips with 36px height, 8px gap, neutral-200 border (inactive) or primary-500 background (active). Single-select or multi-select mode. MonthSelector is 12 chips (Jan-Dec) with checkmark on completed months and dimmed future months. WeekSelector has left/right arrow buttons (icon-only, 44x44px) with center label "Week 6, Feb 3-9, 2026". DateRangePicker has two date inputs side-by-side with hyphen separator. AdjustmentSlider is numeric input with -/+ buttons, range -$80 to +$80, step $5, current value displayed in center. SearchBar has search icon prefix (neutral-600), debounced input (300ms), and clear button (X icon) when text present. CheckNumberInput is a text input in a modal with format mask "CHK-####-####". PhotoUpload is a click-to-upload area (dotted border, 200x200px) with file input, image preview thumbnail, progress bar during upload, and size/type validation error display. MultiSelect has checkboxes for each option (A, B, C, D, E terminals) with select-all option.

**Feedback & Overlay (8 components):** Toast appears bottom-right, slides up from below viewport, shows for 4 seconds, then fades out. Max width 400px. Color background matches semantic state (green/yellow/red). White text. Dismiss button (X icon) on right. Modal centers on screen with semi-transparent backdrop (neutral-900 at 40% opacity), white card with 24px padding, heading at top, action buttons at bottom (cancel left, confirm right). Max width 600px. ConfirmDialog is a specialized modal for destructive actions with warning icon, bold question "Are you sure?", detail text explaining consequences, and prominent red "Delete" or "Remove" button. LoadingSkeleton uses pulsing gray blocks matching the shape of content (card, table row, text line). Pulse animation 1.5s infinite. Spinner is a rotating circle (24x24px default, 16x16px small, 36x36px large) using primary-500 color. ProgressBar is a horizontal bar (height 8px, border-radius 4px) with gray background and primary-500 fill animated to percentage. ErrorBanner is full-width banner at top of page, yellow background (warning) or red (error), white text, icon on left, dismiss button on right. ReadOnlyBanner is blue info background with lock icon and message "You are viewing in read-only mode".

**Layout (5 components):** AdminLayout is the main shell: AppSidebar on left (fixed position, full height), content area on right (fluid width, padding 48px), responsive breakpoints at 768px (collapse sidebar) and 1024px (expand sidebar). PublicLayout centers a card (max width 480px) on neutral-100 background for login/forgot-password pages. Card is white surface with box-shadow (0 2px 8px rgba(0,0,0,0.08)), border-radius 12px, padding 24px. Section groups related content with heading (heading text), optional action button (right-aligned), and content area below. Divider is a horizontal line (1px solid neutral-200) with vertical margin 24px.

## Interaction Patterns

Click targets must be minimum 44x44px on all devices. Table rows are fully clickable (not just the text) with hover highlight (neutral-100 background) and cursor pointer. Checkboxes are 20x20px with 12px padding around them for effective 44px touch target. Coverage grid cells in edit mode have hover highlight (blue tint) and cursor pointer. Filter chips toggle on click with visual feedback (background color change, no animation). Month chips are single-select with clear active state (primary background, white text).

Transitions serve orientation, not delight. Toast slides up 300ms ease-out. Modal backdrop fades in 200ms with modal scaling from 0.95 to 1.0 simultaneously. Skeleton to content cross-fades 150ms. Coverage cell toggle has instant color change (no transition) for responsive feel. Sidebar collapse/expand animates width over 200ms ease. Button hover states have 150ms transition. Page navigation is instant (no transition).

Keyboard navigation follows standard patterns. Tab moves between interactive elements in DOM order. Enter/Space activates buttons and toggles. Escape closes modals and dropdowns. Arrow keys navigate coverage grid cells in edit mode (up/down/left/right). Ctrl+A selects all entries in stipend batch selection table. Focus indicators are 2px primary-500 outline with 2px offset for visibility.

## Accessibility Notes

All color combinations meet WCAG AA contrast minimums (4.5:1 for body text, 3:1 for large text). Coverage grid uses both color and shape (filled vs empty border) to distinguish covered/uncovered slots. Status badges have aria-labels that include the text color represents ("Status: Paid" not just green). KPI cards announce full metric with context to screen readers ("Total Chaplains: 62, up 3 from 30 days ago"). All images have descriptive alt text. Data tables use semantic HTML (thead, tbody, th with scope). Page structure uses landmarks (nav, main, header). Touch targets exceed WCAG minimum on all devices.
