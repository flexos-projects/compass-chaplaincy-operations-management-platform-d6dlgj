---
id: core-flows
title: "Flows"
description: "Complete workflow inventory, detailed step sequences, error flows, and system flows for COMPASS"
type: doc
subtype: core
status: draft
sequence: 5
tags: [core, flows]
relatesTo: []
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Flows

## Flow Inventory

| ID | Flow Name | Trigger | Outcome | Priority | Phase |
|----|-----------|---------|---------|----------|-------|
| FL-001 | Admin Authentication | User navigates to any protected page | Admin is authenticated and redirected to dashboard | P0 | 1 |
| FL-002 | Password Reset | User clicks "Forgot Password" on login | Password reset email sent | P0 | 1 |
| FL-003 | Session Management | Token expiration or manual logout | Session ended, redirect to login | P0 | 1 |
| FL-004 | Dashboard Load | Admin navigates to dashboard | Real-time KPIs and operational summary displayed | P0 | 2 |
| FL-005 | User Search & Filter | Admin uses search bar or role filter | Filtered user list displayed in real-time | P0 | 2 |
| FL-006 | User Profile Edit | Admin clicks edit on user detail | Profile updated in Firestore with audit entry | P0 | 2 |
| FL-007 | Photo Upload | Admin uploads new profile photo | Photo compressed, stored, URL saved to user doc | P0 | 2 |
| FL-008 | Duty Day Review | Admin navigates to Duty Days | Terminal distribution, hours, and duty logs displayed | P0 | 2 |
| FL-009 | Coverage Schedule Edit | Admin toggles edit mode on coverage grid | Coverage slots toggled and saved | P0 | 2 |
| FL-010 | Monthly Stipend Processing | Admin selects a month on Stipends page | Qualifying shifts identified, payouts created | P0 | 2 |
| FL-011 | Stipend Adjustment | Admin adjusts an individual shift amount | Adjustment recorded on duty log entry | P0 | 2 |
| FL-012 | Payout Creation | Admin batch-selects entries and processes | Immutable payout record created, entries marked paid | P0 | 2 |
| FL-013 | Report Generation | Admin sets filters on Reports page | Aggregated metrics displayed in charts/tables | P1 | 3 |
| FL-014 | CSV Export | Admin clicks Export on Reports page | CSV file generated and downloaded | P1 | 3 |
| FL-015 | Chat Thread Browse | Admin navigates to Chat Monitoring | Read-only view of chat threads | P2 | 3 |
| FL-016 | Settings Update | Admin modifies system configuration | Settings saved, effective immediately | P1 | 3 |
| FL-017 | Audit Log Write | Any admin write operation occurs | Audit entry created server-side | P1 | 3 |

## Detailed Flow Steps

### FL-001: Admin Authentication

```
TRIGGER: User navigates to any page without valid session

1. [SYSTEM] Route guard checks for Firebase Auth token
   ├── Token exists and valid → Skip to step 5
   ├── Token exists but expired → Attempt silent refresh
   │   ├── Refresh succeeds → Skip to step 5
   │   └── Refresh fails → Continue to step 2
   └── No token → Continue to step 2

2. [SYSTEM] Redirect to /login, store intended destination in query param
   URL becomes: /login?redirect=/stipends

3. [USER] Enter email and password in login form
   Validation: email format check, password non-empty

4. [SYSTEM] Call Firebase Auth signInWithEmailAndPassword()
   ├── Success → Continue to step 5
   └── Failure → Show error message:
       ├── auth/wrong-password → "Invalid email or password"
       ├── auth/user-not-found → "Invalid email or password" (same message for security)
       ├── auth/too-many-requests → "Too many attempts. Try again later."
       └── auth/user-disabled → "This account has been disabled. Contact your administrator."

5. [SYSTEM] Verify admin role
   Read app_settings/config document → check adminUserIds includes user.uid
   ├── Is admin → Continue to step 6
   └── Not admin → Show "Unauthorized: Admin access required." Offer logout.

6. [SYSTEM] Redirect to intended destination (or / if none stored)
   Set up Firestore listeners for global data (user count, on-duty status)

OUTCOME: Admin is authenticated with valid session, viewing dashboard or intended page.
```

### FL-002: Password Reset

```
TRIGGER: User clicks "Forgot Password?" link on login page

1. [SYSTEM] Navigate to /forgot-password
2. [USER] Enter email address
3. [SYSTEM] Call Firebase Auth sendPasswordResetEmail(email)
   ├── Success → Show "Check your email for a reset link" (always show this, even if email not found, to prevent email enumeration)
   └── Network error → Show "Unable to send reset email. Check your connection."
4. [USER] Click "Back to Login" to return

OUTCOME: Password reset email sent (or user informed to check email regardless).
```

### FL-006: User Profile Edit

```
TRIGGER: Admin clicks a user row on /users and navigates to /users/:id

1. [SYSTEM] Fetch user document by ID from Firestore
   ├── Found → Render profile form with current values
   └── Not found → Show 404 state

2. [USER] Modify fields (any combination):
   - displayName (text input)
   - email (text input, validated)
   - phoneNumber (text input, formatted)
   - bio (textarea)
   - role (dropdown: admin, chaplain, intern, support)
   - isChaplain, isIntern, isSupportMember, isAfterHours (toggles)
   - terminals (multi-select: A, B, C, D, E)
   - title (text input)

3. [USER] Click "Save Changes"

4. [SYSTEM] Validate all fields client-side
   ├── Valid → Continue to step 5
   └── Invalid → Highlight errors, prevent submission

5. [SYSTEM] Server API route: POST /api/users/:id/update
   a. Verify admin auth (server-side token verification)
   b. Read current user document (for audit diff)
   c. Write updated fields to Firestore
   d. Set adminEditedAt = serverTimestamp, adminEditedBy = admin.uid
   e. Write audit_log entry with before/after diff
   f. Return success

6. [SYSTEM] Show success toast: "Profile updated"
   Refresh user data from Firestore listener

OUTCOME: User profile updated, audit trail recorded.
```

### FL-007: Photo Upload

```
TRIGGER: Admin clicks "Upload Photo" on user detail page

1. [USER] Select image file from device (accept: image/jpeg, image/png, image/webp)
2. [SYSTEM] Validate file:
   - Max size: 5 MB
   - Type: JPEG, PNG, or WebP only
   ├── Valid → Continue
   └── Invalid → Show error: "Image must be JPEG, PNG, or WebP under 5 MB"
3. [SYSTEM] Show upload progress indicator
4. [SYSTEM] Compress image client-side (max 800x800px, 80% quality JPEG)
5. [SYSTEM] Upload to Firebase Storage: /user-photos/{userId}/{timestamp}.jpg
6. [SYSTEM] Get download URL from Storage
7. [SYSTEM] Update user.photoUrl in Firestore
8. [SYSTEM] Write audit_log entry (photo_upload action)
9. [SYSTEM] Update avatar display on page

OUTCOME: New profile photo stored and displayed. Old photo remains in Storage (no auto-cleanup).
```

### FL-009: Coverage Schedule Edit

```
TRIGGER: Admin toggles "Edit Mode" on coverage schedule page

1. [SYSTEM] Fetch coverage_schedules document for selected week + year
   ├── Exists → Load current slot states
   └── Doesn't exist → Create document with all slots set to false

2. [SYSTEM] Render 7x17 grid:
   Columns: Monday through Sunday
   Rows: 5 AM through 9 PM (17 rows)
   Each cell: green (covered) or empty/red (gap)

3. [USER] Click a cell to toggle coverage
4. [SYSTEM] Optimistic update: immediately toggle cell color
5. [SYSTEM] Write single field update to Firestore:
   update(doc, { "slots.wednesday.14": true })
   ├── Success → No visible change (already optimistic)
   └── Failure → Revert cell color, show error toast

6. [SYSTEM] Write audit_log entry: coverage_edit, with slot details

7. [USER] Navigate to different week using week selector
8. [SYSTEM] Fetch/create document for new week, render new grid

OUTCOME: Coverage schedule updated slot by slot with optimistic UI.
```

### FL-010: Monthly Stipend Processing (Full Cycle)

This is the most complex flow in the system. It spans multiple interactions across the Stipends page.

```
TRIGGER: Admin navigates to /stipends

PHASE 1: Period Selection
1. [SYSTEM] Display month selector chips (January through December) for current program year
2. [USER] Select a month (e.g., "January")
3. [SYSTEM] Calculate date range: Jan 1 00:00:00 through Jan 31 23:59:59

PHASE 2: Data Loading
4. [SYSTEM] Server API route: GET /api/stipends/qualifying?month=1&year=2026
   a. Query duty_logs: isPaid == false, startTime within range
   b. Group by userId
   c. For each chaplain: count shifts, calculate base amount ($80 x shifts)
   d. Fetch chaplain display names from users
   e. Return sorted list of qualifying chaplains

5. [SYSTEM] Display qualifying chaplains table:
   | Chaplain | Shifts | Base Amount | Adjustments | Total |
   |----------|--------|-------------|-------------|-------|
   | Martinez | 4      | $320        | $0          | $320  |
   | Johnson  | 3      | $240        | $0          | $240  |
   | Lee      | 2      | $160        | $0          | $160  |

PHASE 3: Adjustments (Optional)
6. [USER] Click chaplain row to expand duty entries
7. [SYSTEM] Show individual duty log entries for that chaplain:
   | Date     | Hours | Terminal | Base | Adj  | Total |
   |----------|-------|----------|------|------|-------|
   | Jan 5    | 6.5   | A        | $80  | $0   | $80   |
   | Jan 12   | 7.0   | B        | $80  | $0   | $80   |
   | Jan 19   | 5.5   | A        | $80  | $0   | $80   |

8. [USER] Click adjustment control on a specific entry
9. [USER] Slide adjustment: +$20 (holiday bonus) or -$40 (partial shift)
10. [SYSTEM] Update entry display: Total = $80 + $20 = $100
    [SYSTEM] Recalculate chaplain total: $320 + $20 = $340

PHASE 4: Selection & Processing
11. [USER] Check individual entries or click "Select All"
    [USER] Optionally uncheck entries to exclude (e.g., intern paid separately)
12. [USER] Click "Process Selected" button
13. [SYSTEM] Validate: at least one entry selected
14. [SYSTEM] Show check number modal
15. [USER] Enter check number: "CHK-2026-0147"
16. [USER] Click "Confirm"

PHASE 5: Server-Side Processing
17. [SYSTEM] Server API route: POST /api/stipends/process
    Request body: {
      entries: [{ dutyLogId, amount, adjustment }],
      checkNumber: "CHK-2026-0147",
      month: "January",
      year: 2026
    }

    Server performs (in a Firestore batch write):
    a. Group entries by chaplainId
    b. For each chaplain group:
       - Create chaplain_payouts document (immutable)
       - Create/update stipend_records document
    c. For each duty_log in entries:
       - Set isPaid = true
       - Set paymentAmount = base + adjustment
       - Set paymentStatus = 'paid'
       - Set checkNumber
       - Set payoutId = new payout doc ID
       - Set processedBy = admin.uid
       - Set processedAt = serverTimestamp
    d. Write audit_log entry: payout_create

18. [SYSTEM] Return success response with payout IDs

PHASE 6: Confirmation
19. [SYSTEM] Refresh stipend page data
    - Processed entries show green "Paid" badge
    - Paid entries are disabled (cannot re-select)
    - Running totals update: Monthly, YTD, All-Time
20. [SYSTEM] Show success toast: "Processed $720 across 3 chaplains"

OUTCOME: Immutable payout records created, duty logs marked paid, audit trail recorded.
```

### FL-014: CSV Export

```
TRIGGER: Admin clicks "Export to CSV" on Reports page

1. [SYSTEM] Read current filter state (date range, terminal, chaplain)
2. [SYSTEM] Server API route: GET /api/reports/export?type=encounters&from=...&to=...
   a. Query filtered data from Firestore
   b. Transform to flat rows (denormalize references)
   c. Generate CSV using papaparse on server
   d. Return CSV as file download response
3. [BROWSER] File download dialog appears
4. [USER] Save CSV file

OUTCOME: CSV file downloaded containing currently filtered data.

Supported export types:
- encounters: chaplain_metrics with chaplain name, terminal, encounter types, dates
- duty-hours: duty_logs with chaplain name, terminal, hours, shift dates
- stipends: chaplain_payouts + stipend_records with chaplain name, amounts, dates
```

## Flow-to-Page-to-Feature Mapping

| Flow | Primary Page(s) | Feature(s) | Collections Modified |
|------|----------------|------------|---------------------|
| FL-001 Auth | Login, Dashboard | F-001 Auth & RBAC | - |
| FL-002 Password Reset | Forgot Password | F-001 Auth & RBAC | - |
| FL-003 Session Mgmt | All pages | F-001 Auth & RBAC | - |
| FL-004 Dashboard Load | Dashboard | F-002 Dashboard KPIs | - (read only) |
| FL-005 User Search | Users | F-003 User Management | - (read only) |
| FL-006 Profile Edit | User Detail | F-004 Profile Editing | users, audit_log |
| FL-007 Photo Upload | User Detail | F-004 Profile Editing | users, audit_log |
| FL-008 Duty Review | Duty Days | F-005 Duty Tracking | - (read only) |
| FL-009 Coverage Edit | Coverage Schedule | F-006 Coverage Grid | coverage_schedules, audit_log |
| FL-010 Stipend Processing | Stipends | F-007 Stipend Processing | duty_logs, chaplain_payouts, stipend_records, audit_log |
| FL-011 Stipend Adjustment | Stipends | F-007 Stipend Processing | - (client-side until process) |
| FL-012 Payout Creation | Stipends, Stipend Detail | F-007, F-008 | chaplain_payouts, duty_logs, stipend_records, audit_log |
| FL-013 Report Generation | Reports | F-011 Reporting | - (read only) |
| FL-014 CSV Export | Reports | F-012 CSV Export | - (read only) |
| FL-015 Chat Browse | Chat Monitoring | F-017 Chat Monitoring | - (read only) |
| FL-016 Settings Update | Settings | F-014 Settings | app_settings, audit_log |
| FL-017 Audit Write | (All write operations) | F-013 Audit Log | audit_log |

## Error Flows

### Authentication Errors
| Error | User Sees | Recovery |
|-------|-----------|----------|
| Wrong password | "Invalid email or password" | Retry or use forgot password |
| Account disabled | "Account disabled. Contact administrator." | Contact admin offline |
| Token expired during session | Yellow banner: "Session expired" | Click "Re-authenticate" button |
| Network error during login | "Unable to connect. Check your internet." | Retry when connected |

### Data Write Errors
| Error | User Sees | Recovery |
|-------|-----------|----------|
| Firestore permission denied | "You don't have permission for this action" | Verify admin status in Settings |
| Coverage slot save fails | Cell color reverts (optimistic undo) | Click again to retry |
| Stipend processing fails mid-batch | "Processing failed. No changes were made." (batch is atomic) | Retry entire batch |
| Photo upload fails | "Upload failed. Try a smaller image." | Resize or try different image |
| Settings save fails | "Unable to save. Try again." | Retry |

### Data Read Errors
| Error | User Sees | Recovery |
|-------|-----------|----------|
| Firestore listener disconnects | Yellow banner: "Showing cached data" | Auto-reconnect; manual refresh |
| User document not found | 404 page on user detail | Navigate back to user list |
| Coverage doc not found | Empty grid (all slots uncovered) | Start editing to create doc |
| No duty logs for period | "No qualifying shifts for [month]" | Select different month |

### Business Logic Errors
| Error | User Sees | Recovery |
|-------|-----------|----------|
| No entries selected for payout | "Select at least one entry to process" | Check entries and retry |
| Duplicate payout attempt | "These entries have already been paid" | Entries are already green/disabled |
| Stipend rate is zero or missing | "Configure stipend rate in Settings first" | Navigate to Settings |
| Invalid check number format | "Enter a valid check number" | Correct input and retry |

## Inferred Flows

### FL-INF-001: Admin User Promotion
**Trigger:** Super-admin adds a new UID to adminUserIds in Settings.
**Steps:** Admin navigates to Settings > Admin Users > enters UID of existing user > saves. Next time that user logs in, role check passes and they see the full dashboard.
**Critical consideration:** There must be a bootstrap mechanism -- the first admin must be able to add themselves. This is done by manually adding the UID to the `app_settings/config` document in the Firebase console during initial setup.

### FL-INF-002: Data Pagination Navigation
**Trigger:** Admin scrolls to bottom of a long list or clicks "Next Page."
**Steps:** System loads the next 50 records using Firestore cursor-based pagination (startAfter the last document in current page). Back button loads previous page from cache.
**Applies to:** Users list, duty logs, chaplain_payouts, stipend_records, audit_log, chat threads.

### FL-INF-003: Duty Log Approval (Future)
**Trigger:** Chaplain submits a duty log from the mobile app.
**Steps:** Log appears in admin duty list with "Pending" badge. Admin reviews and clicks "Approve." Sets approved = true. Currently the concept assumes all logs are pre-approved (approved defaults to true). A future version could introduce an approval workflow.

### FL-INF-004: Stipend Period Lock
**Trigger:** Admin has finished processing all chaplains for a month.
**Steps:** Admin clicks "Close Period" button. System marks stipend_records.isCompleted = true for all records in that month. Future payout attempts for that month show a warning: "This period is closed. Reopen to process additional entries."

## System Flows (Background Processes)

### SYS-001: Real-Time Listener Management
When an admin navigates between pages, Firestore listeners must be properly managed:
- **Dashboard:** Attach listeners for users (count), duty_logs (recent), coverage (current week)
- **Leave Dashboard:** Detach duty_logs and coverage listeners (keep user count global)
- **Stipends:** Attach listener for duty_logs filtered by selected period
- **Leave Stipends:** Detach period-specific listener

Vue composables handle this via `onMounted`/`onUnmounted` lifecycle hooks with VueFire's automatic listener management.

### SYS-002: Audit Trail Pipeline
Every server-side API route that modifies data follows this pattern:
1. Verify admin auth token
2. Read current state of target document
3. Perform the write operation
4. Create audit_log entry with action, admin, target, and before/after diff
5. Return success

Steps 2-4 use a Firestore batch write to ensure atomicity -- if the audit entry fails, the primary write also rolls back.

### SYS-003: Token Refresh Cycle
Firebase Auth tokens expire after 1 hour. The client-side auth listener monitors token state:
- **Token valid:** Normal operation
- **Token expiring (< 5 min):** Silent refresh via `getIdToken(true)`
- **Refresh fails:** Show re-authentication prompt (not a full logout -- preserve unsaved work)
- **Idle > 4 hours:** Force logout for security (configurable in app_settings)
