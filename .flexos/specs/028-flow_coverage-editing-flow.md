---
id: flow_coverage-editing-flow
title: "Coverage Schedule Editing Flow"
description: "Administrative workflow for editing the weekly chaplain coverage schedule grid, including week navigation, edit mode toggling, slot editing with auto-save, and gap identification"
type: spec
subtype: flow
status: draft
sequence: 28
tags: [flow, coverage, editing, admin, schedule]
relatesTo: [docs/core/005-flows.md, specs/027-flow_duty-review-flow.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Coverage Schedule Editing Flow

## Overview
The Coverage Schedule Editing Flow is a dedicated workflow for managing the weekly chaplain coverage grid. This flow emphasizes rapid, fine-grained editing of individual hourly slots with auto-save, optimistic UI updates, and real-time conflict resolution when multiple admins edit simultaneously.

## Trigger
Admin navigates to the Coverage Schedule page (`/coverage`) OR enables admin mode on the Duty Days page coverage grid section

## Primary Actor
Chaplaincy program administrator with edit privileges

## Related Features
- F-006 Coverage Grid
- F-013 Audit Log
- F-005 Duty Tracking (context)

## Related Collections
- `coverage_schedules` (read/write)
- `audit_log` (write)
- `users` (read, for admin verification)

</flex_block>

<flex_block type="flow" title="Coverage Editing Flow Steps">

### Phase 1: Navigate to Coverage
**Step 1: Navigate to coverage page**
- **Actor:** User
- **Action:** Click "Coverage" in sidebar navigation OR click coverage grid section on Duty Days
- **Routing:** Navigate to `/coverage` (dedicated page) or scroll to grid on `/duty-days`
- **Initial State:** Edit mode is OFF by default (view-only)
- **Page Load:**
  - Fetch current week number and year (ISO 8601 week date)
  - Query Firestore for `coverage_schedules/{weekNumber}-{year}`
  - Render grid in read-only state

### Phase 2: Select Week
**Step 2: Select target week using week selector**
- **Actor:** User
- **Action:** Click previous/next arrows to navigate weeks, or select week from date picker
- **UI Component:** Week selector with:
  - Left arrow: Go to previous week
  - Center label: "Week 6, Feb 3-9, 2026"
  - Right arrow: Go to next week
  - (Optional) Date picker dropdown for jumping to arbitrary week
- **Data Fetch:** On week change:
  1. Calculate new week number and year
  2. Detach current Firestore listener
  3. Query new week's coverage document
  4. Attach new listener
  5. Render grid with new data
- **Document Creation:** If coverage document doesn't exist for selected week:
  - Initialize all 119 slots (7 days × 17 hours) to `false` (uncovered)
  - Do NOT write to Firestore yet (created on first edit)
- **Navigation Constraints:**
  - Can navigate to past weeks (historical data, read-only unless admin overrides)
  - Can navigate to future weeks (planning ahead)
  - Cannot navigate more than 52 weeks into the future
- **Error Handling:**
  - Failed to fetch week data → Show previous week's data with error banner "Unable to load Week X"
  - Invalid week number → Clamp to valid range (1-53)

### Phase 3: Enable Edit Mode
**Step 3: Toggle admin mode to make grid editable**
- **Actor:** User
- **Action:** Click toggle switch labeled "Edit Mode" in page header
- **State Transition:** OFF (view-only) → ON (editable)
- **Visual Changes:**
  - Toggle switch changes from gray to primary blue
  - Grid cells gain hover state (blue highlight)
  - Cursor changes to pointer over cells
  - Header shows "Changes auto-save" message
  - Cell borders become more prominent (2px instead of 1px)
- **Permission Check:**
  - Client-side: Verify `isAdmin` flag from auth context
  - If not admin: Disable toggle, show tooltip "Admin access required"
- **Persistence:** Edit mode state is NOT persisted (resets to OFF on page reload)
- **Error Handling:**
  - Non-admin attempts toggle → Prevent toggle, show toast "Only admins can edit coverage"

### Phase 4: Toggle Slots (Auto-Save)
**Step 4: Toggle individual coverage slots**
- **Actor:** User
- **Action:** Click individual hour slots to mark as covered or uncovered
- **Flow Sequence:**
  1. User clicks cell at `(Monday, 8:00 AM)`
  2. **Optimistic Update (Instant):**
     - Cell color toggles: white → teal (or teal → white)
     - Cell shows brief pulse animation (200ms, subtle scale 1.0 → 1.05 → 1.0)
  3. **Firestore Write (Async):**
     - Write operation: `update(doc('coverage_schedules', weekId), { 'slots.monday.8': true })`
     - Field path uses dot notation for nested map update
  4. **Success:**
     - No visual change (already optimistic)
     - Add cell to "recently saved" set (shows subtle checkmark for 2 seconds)
  5. **Failure:**
     - Cell color reverts to original state
     - Show error toast: "Failed to save Monday 8:00 AM. Try again."
     - Log error to console with full context
  6. **Audit Entry (Async):**
     - Write to `audit_log` collection:
       ```typescript
       {
         action: 'coverage_edit',
         adminId: currentUser.uid,
         targetCollection: 'coverage_schedules',
         targetId: weekId,
         details: {
           day: 'monday',
           hour: 8,
           before: false,
           after: true
         },
         createdAt: serverTimestamp()
       }
       ```
- **Keyboard Support:**
  - Arrow keys navigate between cells
  - Spacebar/Enter toggles focused cell
  - Escape exits edit mode
- **Multi-Select (Future Enhancement):** Drag to select multiple cells, batch toggle
- **Error Handling:**
  - Concurrent edit conflict → Firestore listener updates cell to server truth within 2 seconds, overrides optimistic update
  - Write permission denied → Cell reverts, toast: "Permission error. Contact support."
  - Network disconnected → Cell reverts, banner: "Offline. Changes not saved."

### Phase 5: Auto-Save Behavior
**Step 5: Each toggle immediately writes to Firestore**
- **No Save Button:** Changes are persisted instantly (auto-save)
- **Write Queue:** If user clicks rapidly (>1 edit/second):
  1. Queue writes sequentially
  2. Prevent concurrent writes to same document (use local lock)
  3. Batch writes if queue exceeds 5 pending (combine into single update)
- **Conflict Resolution:** If two admins edit the same slot simultaneously:
  - Both optimistic updates succeed locally
  - Firestore applies last-write-wins
  - Firestore listener fires on both clients
  - Loser's cell updates to winner's value within 2 seconds
  - Show subtle notification: "Monday 8 AM updated by another admin"
- **Undo Support (Future):** Track edit history per session, allow undo within 30 seconds
- **Error Handling:**
  - Firestore batch write fails → Revert all queued edits, show error count "3 changes failed"
  - Rate limit exceeded → Show cooldown message "Too many edits. Pausing for 30 seconds."

### Phase 6: Review Gap Indicators
**Step 6: Review visual gap indicators**
- **Actor:** User
- **Action:** Observe automatically highlighted coverage gaps
- **Gap Definition:** 3+ consecutive uncovered hours in a single day
- **Visual Indicators:**
  - Red left-border (4px) on row with gap
  - Gap count badge on day label: "Monday (3 gaps)"
  - Summary below grid: "Coverage Rate: 68% | Gaps: 37 hours | Longest Gap: Tuesday 6-9 AM (3 hours)"
- **Interactive:** Click gap indicator to auto-focus first uncovered cell in that sequence
- **Real-Time Update:** Gap indicators update as slots are toggled (no page refresh)
- **Error Handling:**
  - Gap calculation overflow → Clamp gap count display at 99+

</flex_block>

<flex_block type="flow" title="Error Flows">

### Navigation Errors
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Invalid week number in URL | Redirect to current week | Log warning, sanitize URL param | Use week selector arrows instead of manual URL editing |
| Failed to load week data | Grid shows previous week's data, error banner | Retry fetch once, then show cached data | Click "Retry" button or refresh page |
| Listener disconnect mid-session | Yellow banner: "Showing cached data" | Attempt reconnect every 5 seconds | Wait for auto-reconnect or manual refresh |

### Edit Operation Errors
| Error | User Sees | System Action | Recovery Path |
|-------|-----------|---------------|---------------|
| Optimistic update conflict | Cell flickers (reverts then updates to server state) | Listener overrides optimistic update | No action needed, final state correct |
| Write permission denied | Cell reverts, toast: "Permission denied" | Log security violation with user ID | Verify admin status, check Firestore rules |
| Network timeout during save | Cell reverts, toast: "Save failed. Try again." | Write queued for retry (3 attempts) | Retry manually or wait for auto-retry |
| Concurrent edit by two admins | Subtle notification: "Updated by [Admin Name]" | Last-write-wins, listener syncs both clients | Continue editing, final state is consistent |
| Firestore quota exceeded | Edit mode disables, banner: "Coverage editing temporarily unavailable" | Prevent new writes, show quota message | Wait for quota reset (daily) or contact support |

### Data Integrity Errors
| Error | System Behavior | Recovery |
|-------|----------------|----------|
| Malformed slot data (non-boolean) | Treat as `false`, log warning | Admin manually fixes or system auto-heals on next write |
| Missing day in slots map | Initialize missing day to all uncovered | Created on first edit to that day |
| Duplicate coverage documents for same week | Use most recently updated, delete duplicates | Background job consolidates, or manual Firestore cleanup |

</flex_block>

## Acceptance Criteria

### Functional Requirements
- [ ] Week selector navigates forward/backward and displays correct week label
- [ ] Fetching a new week detaches old listener and attaches new listener correctly
- [ ] Non-existent coverage documents initialize with all slots uncovered
- [ ] Edit mode toggle enables/disables cell interaction with visual feedback
- [ ] Coverage slot toggles update cell color instantly (optimistic)
- [ ] Each slot toggle writes to Firestore within 500ms
- [ ] Audit log entry created for every slot edit
- [ ] Concurrent edits by multiple admins resolve to consistent final state
- [ ] Gap indicators calculate and display correctly in real-time
- [ ] Network disconnection prevents edits and shows clear offline state
- [ ] Failed writes revert optimistic updates and show error messages

### Non-Functional Requirements
- [ ] Grid renders 119 cells in under 500ms
- [ ] Optimistic update response time under 50ms (instant feel)
- [ ] Firestore write completes within 500ms on 4G connection
- [ ] Page supports up to 10 edits per second without UI lag
- [ ] Firestore listener latency under 2 seconds for conflict resolution
- [ ] Audit log writes do not block cell toggle operations (async)
- [ ] Page remains responsive during rapid-fire clicking (no frozen UI)

### Edge Cases
- [ ] Toggling the same cell rapidly (double-click) results in final server state, not intermediate
- [ ] Navigating to a different week while an edit is in-flight commits the edit before switching
- [ ] Edit mode disabled mid-edit (e.g., admin role revoked) prevents further edits but completes pending
- [ ] Coverage grid with all slots covered shows 100% coverage rate, zero gaps
- [ ] Coverage grid with all slots uncovered shows 0% coverage rate, 119 hours of gaps
- [ ] Admin edits past week's coverage (historical data) – should this be allowed? (See Open Questions)
- [ ] Two admins on different weeks do not interfere with each other (separate documents)

## Business Rules

### Coverage Grid Structure
- **7 days:** Monday through Sunday (ISO 8601 week starts Monday)
- **17 hours:** 5:00 AM through 9:00 PM (airport operating hours)
- **Total slots:** 119 (7 × 17)
- **Slot states:** Binary (covered/uncovered), no partial coverage

### Edit Permissions
- Only users with `adminUserIds` containing their `uid` can enable edit mode
- Non-admins can view coverage grid but cannot toggle slots

### Auto-Save Behavior
- No manual save button – every edit commits immediately
- No unsaved changes state – latest cell color always reflects latest write status (optimistic or confirmed)

### Gap Threshold
- **Gap definition:** 3 or more consecutive uncovered hours
- **Calculation scope:** Per day (gaps do not span across days)
- **Longest gap:** Calculated across all days, ties broken by earliest in week

## Assumptions
- Admin has logged in and verified admin role before accessing this page
- Firestore security rules allow admin write access to `coverage_schedules` collection
- Coverage schedule represents planned coverage, not actual chaplain attendance (actual logged in `duty_logs`)
- Week numbering follows ISO 8601 standard (week 1 contains first Thursday of year)
- All times are airport local time (Dallas timezone, CST/CDT)

## Open Questions
1. **Historical edits:** Should admins be able to edit past weeks' coverage, or should weeks be locked after they end?
2. **Planning horizon:** How far into the future should admins be able to plan coverage? (Current: 52 weeks)
3. **Batch edit UI:** Should we add a "Fill Week" or "Copy Previous Week" feature to speed up initial setup?
4. **Undo/Redo:** Should edit history allow undo within the current session, or is optimistic revert sufficient?
5. **Coverage vs. Actual:** Should the grid show a diff between planned coverage and actual duty logs from chaplains?
6. **Multi-admin notifications:** Should admins be notified when another admin is editing the same week simultaneously?
