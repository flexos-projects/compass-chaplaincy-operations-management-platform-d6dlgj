---
id: features-metrics-reporting
title: "Metrics & Reporting"
description: "Encounter metric aggregation, filtering, visualization, and CSV export for operational reporting"
type: spec
subtype: features
status: draft
sequence: 7
tags: [features, reporting, metrics, p1]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, docs/core/004-database.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Metrics & Reporting

## Overview

The Metrics & Reporting feature transforms raw chaplain encounter data from the `chaplain_metrics` collection into actionable insights for board presentations, grant applications, and operational planning. This is the feature that addresses the original app's biggest gap -- the Reports navigation button that did nothing despite appearing on every page.

This feature enables admins to filter encounter data by date range, terminal location, and individual chaplain, then view aggregated breakdowns by encounter type (crisis, violence, police involvement, grief, travel-related, prayer requests), encounter medium (in-person, phone, chat), and intern evaluation summaries. All filtered data can be exported to CSV for external reporting.

## Business Context

DFW Airport chaplaincy must report to a board of directors, funders, and airport authorities. They need to demonstrate:
- Operational impact (number and nature of encounters)
- Terminal-specific activity (justifying chaplain assignments)
- Training program effectiveness (intern evaluation data)
- Trend analysis (7-day, 30-day, year-over-year comparisons)

The original FlutterFlow app stored rich encounter data (35 fields) but provided no way to analyze or export it beyond the aggregate counts shown on the dashboard. This feature closes that gap.

## Core Functionality

### 1. Encounter Type Breakdown

**Data source:** `chaplain_metrics.encounterType` (object with boolean flags)

**Categories tracked:**
- Crisis interventions (medical emergency, suicide risk, severe distress)
- Violence (domestic, assault, threatening behavior)
- Police involvement (incidents requiring law enforcement)
- Grief counseling (death notification, bereavement support)
- Travel-related (missed connections, lost luggage, travel anxiety)
- Personal issues (family conflict, financial distress)
- Prayer requests (spiritual support)
- Fallen Angel (airport-specific term: staff/crew in distress)

**Display:** Horizontal bar chart showing count per category for the selected date range. Clicking a bar drills down to the individual encounter records in that category. Each bar shows both count and percentage of total encounters.

**Mobile consideration:** Chart stacks vertically on mobile with simplified labels. Touch-friendly bar targets (minimum 44px height).

### 2. Encounter Medium Analysis

**Data source:** `chaplain_metrics.encounterMedium` (object with boolean flags)

**Categories:**
- In-person (face-to-face encounter)
- By phone (phone call to chaplain)
- Chat only (via chaplain mobile app messaging)
- Self-discovered (chaplain initiated contact vs. request for help)

**Display:** Pie chart or stacked horizontal bar showing distribution. This data helps understand how travelers are finding chaplain support (proactive chaplain presence vs. reactive requests).

### 3. Terminal Distribution

**Data source:** `chaplain_metrics.terminal` (string: A, B, C, D, E)

**Display:** Horizontal bar chart with percentage breakdown. Cross-reference with duty hour data to show encounters-per-duty-hour efficiency by terminal (some terminals may have more need despite less coverage).

**Use case:** If Terminal E shows only 5% of encounters despite 15% of duty hours, the program director can reallocate chaplain assignments.

### 4. Date Range Filtering

**Controls:** Start date and end date pickers. Presets: "Last 7 days", "Last 30 days", "This month", "Last month", "This quarter", "This year", "Custom range".

**Logic:** Filters `chaplain_metrics` where `dateCollected >= startDate AND dateCollected <= endDate`. Real-time query, no pre-aggregation. For large datasets (>1000 records), show loading skeleton during query.

**Validation:** Start date must be before end date. Maximum range: 2 years (to prevent performance issues).

### 5. Chaplain-Specific Filtering

**Control:** Dropdown or searchable select showing all chaplains (from `users` collection where `isChaplain = true`, ordered by displayName).

**Use case:** Generate a performance report for a specific chaplain's quarterly review. Show their encounter breakdown, medium distribution, and hours worked.

**Display:** When chaplain filter is active, show their name and avatar in the report header: "Encounter Report: Chaplain Martinez (Jan 1 - Mar 31, 2026)".

### 6. Intern Evaluation Summary

**Data source:** `chaplain_metrics.internEvaluation` (object with ratings and feedback)

**Metrics aggregated per intern:**
- Total evaluations submitted
- Average initiative score (1-5 scale)
- Average pastoral demeanor score (1-5)
- Average pluralistic competence score (1-5)
- Average situational awareness score (1-5)
- Most recent evaluation date
- Most recent evaluator (chaplain who submitted)

**Display:** Data table with intern rows, average scores in columns, color-coded cells (green for 4-5, yellow for 3-3.9, red for <3). Click an intern row to view individual evaluation narratives (feedback field).

**Use case:** Quarterly intern program review. Identify interns who need additional mentoring. Recognize high performers.

### 7. CSV Export

**Functionality:** Export the currently filtered data view to a CSV file using `papaparse` library.

**Export types:**
- **Encounters CSV:** All fields from `chaplain_metrics` with denormalized chaplain name, flattened encounter type flags, readable date format
- **Duty Hours CSV:** Aggregated hours per chaplain with terminal breakdowns
- **Stipend Summary CSV:** Total paid per chaplain with monthly breakdown

**Filename convention:** `compass-{type}-{startDate}-{endDate}.csv` (e.g., `compass-encounters-2026-01-01-2026-03-31.csv`)

**Column mapping for Encounters CSV:**
```
Date, Chaplain, Terminal, Gate, Duration (min), Crisis, Violence, Police, Grief, Travel, Prayer, In Person, By Phone, Chat, Self-Initiated, Persons Involved, Narrative
```

**Security:** Server-side export via API route to ensure only admins can access full data. Client-side papaparse only for final CSV generation (data already filtered by server).

## Acceptance Criteria

**Given** the admin navigates to the Reports page,
**When** the page loads,
**Then** default date range is "Last 30 days", all terminals selected, no chaplain filter, encounter type chart displays with current data.

**Given** the admin selects "Last 7 days" preset,
**When** the preset is applied,
**Then** the date range inputs update to show the last 7 calendar days, all charts re-query and update within 2 seconds.

**Given** the admin selects Terminal A from the filter,
**When** the filter is applied,
**Then** only encounters where `terminal = 'A'` are included in all charts and counts, and the terminal distribution chart highlights Terminal A.

**Given** the admin selects a specific chaplain,
**When** the chaplain filter is applied,
**Then** the page header shows "Encounter Report: [Chaplain Name]", all metrics reflect only that chaplain's data, and the chaplain filter dropdown remains in context.

**Given** filtered data is displayed,
**When** the admin clicks "Export to CSV",
**Then** a CSV file downloads containing all encounter records matching the current filters with human-readable column headers and formatted dates.

**Given** the admin views the intern evaluation summary,
**When** evaluations exist for at least one intern,
**Then** a table displays with intern names, average scores for all 4 dimensions, and color-coded cells (green for 4+, yellow for 3-3.9, red for <3).

**Given** no encounters match the selected filters,
**When** the charts attempt to render,
**Then** an empty state message displays: "No encounters found for the selected filters. Adjust your date range or remove filters."

**Given** the date range exceeds 2 years,
**When** the admin attempts to apply the filter,
**Then** a validation message appears: "Date range cannot exceed 2 years. Please select a shorter period."

## Edge Cases

### Empty Data States
- **No encounters in period:** Show empty state with suggestion to expand date range
- **No interns evaluated:** Hide intern summary section entirely (not an error)
- **Terminal filter excludes all data:** Clear messaging that the filter may be too restrictive

### Large Datasets
- **>1000 encounter records:** Show loading skeleton during query, consider pagination
- **CSV export >10,000 rows:** Server-side streaming response to prevent memory issues
- **Slow network:** Show progress indicator for export, estimated time remaining

### Data Quality Issues
- **Missing terminal data:** Show "Unknown" category in terminal chart
- **Invalid encounter type flags:** All false flags show as "Unspecified Encounter"
- **Intern evaluation with missing scores:** Show "N/A" for missing dimensions, exclude from average

## Mobile Considerations

**Reports page on tablet (768px+):** Full functionality. Charts stack vertically. Filters collapse into a drawer on smaller tablets.

**Reports page on mobile (<768px):** Simplified view. Show only the most critical metrics (total encounters, top 3 encounter types). CSV export works. Full chart detail available via horizontal scroll or drill-down. Consider showing a message: "For detailed reporting, use a desktop or tablet."

**Touch targets:** All filter controls minimum 44px height. Chart bars minimum 36px for tappable drill-down.

## Performance Requirements

- **Initial page load:** Under 2 seconds for 30-day default range with up to 500 encounters
- **Filter application:** Charts update within 1 second after filter change
- **CSV export:** Generate and download a 1000-row CSV in under 5 seconds
- **Real-time updates:** Not required for reports (static query at page load)

## Security & Privacy

- **Admin-only access:** Reports page requires admin role (enforced by route guard and Firestore rules)
- **PII in exports:** Chaplain names are included (internal use), but traveler names/details are not collected in `chaplain_metrics` (privacy by design)
- **Audit trail:** CSV export actions are logged in `audit_log` with admin ID, timestamp, and export type

## Future Enhancements (v1.1+)

- **Saved report templates:** Admins can save frequently used filter combinations
- **Scheduled email reports:** Weekly/monthly email with key metrics PDF
- **Comparative analysis:** Year-over-year encounter trend charts
- **Heatmap visualization:** Time-of-day encounter distribution on a 24-hour grid
- **Predictive staffing:** ML suggestions for optimal coverage based on historical patterns
