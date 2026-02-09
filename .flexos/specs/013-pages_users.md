---
id: pages-users-and-detail
title: "Users & User Detail Pages"
description: "Searchable user list with role filtering and comprehensive user detail page with profile editing, duty history, and stipend tracking"
type: spec
subtype: pages
status: draft
sequence: 13
tags: [pages, users, profile, p0]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, docs/core/004-database.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Users & User Detail Pages

## Overview

COMPASS has TWO interconnected user pages that together form the complete user management workflow:

1. **Users List Page** (`/users`) -- Searchable, filterable list of all users in the system
2. **User Detail Page** (`/users/:id`) -- Full profile view and editing interface for a single user

These pages enable admins to find, review, and update chaplain profiles, assign terminals, manage roles, track duty history, and review stipend payments. The Users page is optimized for scanning and filtering. The User Detail page is optimized for deep inspection and editing.

---

# Part 1: Users List Page

## Route

**Path:** `/users`

**Layout:** Admin layout (sidebar + content area)

**Auth requirement:** Admin role

**Query parameters:**
- `filter` (optional) -- Pre-apply a role filter: `chaplains`, `interns`, `support`, `on-duty`, `new`
- `search` (optional) -- Pre-fill the search bar
- Example: `/users?filter=chaplains&search=Martinez`

## Page Structure

### 1. Page Header

**Content:**
- Page title: "Users" (28px, bold)
- User count badge: "(62 total)" (16px, neutral-600, inline with title)
- Action button: "+ Add User" (primary button, right-aligned) -- navigates to user creation flow (v1.1 feature)

### 2. Search Bar

**Location:** Below page header, full-width on mobile, 400px max-width on desktop (left-aligned)

**Functionality:**
- Text input with search icon on left
- Placeholder: "Search by name or email..."
- Debounced filtering (300ms delay after user stops typing)
- Clear button (X icon) appears when text is entered
- Autofocus: true (when navigating to page via sidebar)

**Search logic:**
- Case-insensitive partial match on `displayName` OR `email` fields
- Firestore query: `displayName >= searchTerm AND displayName <= searchTerm + '\uf8ff'`
- Search across all users or within the active role filter (if applied)

### 3. Role Filter Chips

**Location:** Below search bar, horizontal row of chips (wraps on narrow screens)

**Chips:**
- "All Users" (default active, count badge shows total)
- "Chaplains" (count badge shows chaplain count)
- "Interns" (count badge shows intern count)
- "Support Staff" (count badge shows support member count)

**Behavior:**
- Single-select (only one chip active at a time)
- Click a chip to activate it (primary color background, white text)
- Inactive chips: neutral background, dark text
- Active chip shows a checkmark icon

**Filtering logic:**
- "All Users": No filter (all users in `users` collection)
- "Chaplains": `isChaplain = true`
- "Interns": `isIntern = true`
- "Support Staff": `isSupportMember = true`

**Combined with search:** If search term is "Martinez" and "Chaplains" filter is active, show only chaplains whose name/email matches "Martinez".

### 4. User List (Data Table)

**Layout:** Data table with sortable columns, paginated (50 users per page).

**Columns:**
- **Avatar + Name** (combined cell, 300px width)
  - 40px circular avatar on left
  - Display name (16px, bold) on right, stacked above email (14px, neutral-600)
- **Role** (100px width)
  - Badge showing primary role: "Admin", "Chaplain", "Intern", "Support"
  - Color-coded: Admin (navy), Chaplain (green), Intern (yellow), Support (gray)
- **Terminals** (120px width)
  - Comma-separated letters: "A, B, C" or "—" if none assigned
- **Status** (100px width)
  - "On Duty" badge (green) if `onDuty = true`, otherwise "Off Duty" (gray)
- **Last Active** (140px width)
  - Relative time: "2 hours ago", "Yesterday", "Jan 15, 2026"
  - Sort by this column by default (most recently active first)

**Row interactions:**
- Hover: Subtle background highlight (primary-50)
- Click: Navigate to `/users/:id` (detail page)
- No row selection checkboxes in v1.0 (bulk actions deferred to v1.1)

**Sorting:**
- Default: `lastActiveAt desc` (most recently active first)
- Click column header to toggle ascending/descending sort
- Sortable columns: Name (alphabetical), Role (alphabetical), Last Active (chronological)
- Terminals and Status columns are not sortable

**Pagination:**
- Load 50 users per page
- Pagination controls at bottom: "Previous" | Page 1 of 3 | "Next"
- Show "Showing 1-50 of 124 users" text above pagination controls

### 5. Empty States

**No users in database (unlikely):**
- Illustration + "No users yet. The first user will appear after signing up."

**No search results:**
- "No users found matching '[search term]'. Try a different search."
- Clear search button to reset

**No users in filtered role:**
- "No [role] found. Adjust your filters or add users."

## Page States

**Loading:** Skeleton rows (5 placeholder rows with gray avatars and text bars)

**Loaded:** Full user table with real data

**Empty (filtered):** Empty state message when search/filter returns no results

**Error:** Yellow banner: "Unable to load users. [Retry]"

## Acceptance Criteria

**Given** an admin navigates to `/users`,
**When** the page loads,
**Then** all users display in a sortable table, sorted by most recently active first, with search bar and role filter chips above.

**Given** an admin types "Martinez" in the search bar,
**When** the search debounces (300ms),
**Then** the table filters to show only users whose name or email includes "Martinez".

**Given** an admin clicks the "Chaplains" filter chip,
**When** the filter is applied,
**Then** only users with `isChaplain = true` are shown, and the chip displays a checkmark and primary color background.

**Given** an admin clicks a user row,
**When** the row is clicked,
**Then** they navigate to `/users/:id` where `:id` is the user's document ID.

**Given** the user list has 124 users,
**When** the page loads,
**Then** the first 50 users are shown, and pagination controls display "Page 1 of 3" with a "Next" button.

---

# Part 2: User Detail Page

## Route

**Path:** `/users/:id`

**Layout:** Admin layout (sidebar + content area)

**Auth requirement:** Admin role

**Dynamic parameter:** `:id` is the Firestore document ID of the user

## Page Structure

### 1. Page Header

**Content:**
- Breadcrumb: "Users > [User Display Name]" (small, neutral-600)
- Page title: User's display name (28px, bold)
- Role badges: Pills showing all active roles (e.g., "Chaplain" + "Intern" if both flags are true)
- Last edited note: "Last edited by Linda Martinez on Feb 8, 2026" (12px, neutral-400, below title)

**Actions:**
- "Edit Profile" button (primary, right-aligned) -- toggles edit mode
- "Delete User" button (secondary, danger color, right-aligned) -- v1.1 feature, not in MVP

### 2. Profile Header Section

**Layout:** Two-column layout (avatar on left, info on right)

**Left column (Avatar):**
- Large circular avatar (120px)
- "Upload Photo" button below avatar (secondary button, small)
  - Click to open file picker
  - Accepts: JPEG, PNG, WebP
  - Max size: 5 MB
  - Compresses to 800x800px before upload

**Right column (Quick Info):**
- Display name (24px, bold)
- Email (16px, with email icon)
- Phone number (16px, with phone icon, or "—" if not set)
- Title (16px, neutral-600, or "—" if not set)
- Account created date: "Member since Feb 1, 2024" (14px, neutral-500)

### 3. Personal Info Form

**Edit/view toggle:** When "Edit Profile" button is clicked, all fields become editable. When in view mode, fields display as read-only text.

**Fields:**

**Display Name** (required)
- Type: text input
- Max length: 100 characters
- Validation: Non-empty

**Email** (required)
- Type: email input
- Validation: Valid email format
- Warning: "Changing email affects login credentials"

**Phone Number** (optional)
- Type: tel input
- Placeholder: "(555) 123-4567"
- Auto-formatting: U.S. phone number format

**Title** (optional)
- Type: text input
- Placeholder: "Chaplain", "Senior Chaplain", "Intern Chaplain"

**Bio** (optional)
- Type: textarea
- Max length: 500 characters
- Placeholder: "A brief biography visible to other chaplains..."
- Helper text: "500 characters max"

**Language** (optional)
- Type: dropdown
- Options: English, Spanish, French, Korean, Chinese, Other
- Default: English

### 4. Role & Status Toggles

**Display:** Horizontal row of toggle switches (view mode shows badges instead)

**Toggles:**
- **Chaplain** (isChaplain boolean) -- Green toggle when active
- **Intern** (isIntern boolean) -- Yellow toggle when active
- **Support Staff** (isSupportMember boolean) -- Gray toggle when active
- **After-Hours** (isAfterHours boolean) -- Blue toggle when active
- **Admin** (requires special permission check) -- Red toggle when active
  - If granting admin, show confirmation modal: "Grant admin access to [Name]?"
  - Admin toggle only appears if current admin has "super admin" flag (v1.1 feature)

### 5. Terminal Assignments

**Display:** Multi-select checkboxes for terminals A through E

**Layout:** Horizontal row of checkbox chips on desktop, vertical stack on mobile

**Checkboxes:**
- [ ] Terminal A
- [ ] Terminal B
- [ ] Terminal C
- [ ] Terminal D
- [ ] Terminal E

**Behavior:** Check/uncheck to add/remove terminals from the `terminals` array. Changes saved when "Save Changes" button is clicked.

### 6. Duty History Section

**Header:** "Duty History" (20px, bold) with filter dropdown on right (All-Time, Last 30 Days, Last 7 Days)

**Content:** Data table showing recent duty logs for this user only.

**Columns:**
- Date (e.g., "Feb 9, 2026")
- Terminal (A-E)
- Hours (calculated from start/end time)
- Status (Approved, Pending, Paid)

**Pagination:** Show 10 most recent, "View all" link to `/duty-days?chaplain={userId}`

**Empty state:** "No duty logs yet."

### 7. Stipend History Section

**Header:** "Stipend History" (20px, bold) with running totals on right: "YTD: $2,880 | All-Time: $8,640"

**Content:** Data table showing payout records for this user.

**Columns:**
- Month (e.g., "January 2026")
- Shifts (count of duty logs paid)
- Amount (total paid for that period)
- Check Number
- Date Paid

**Pagination:** Show 12 most recent (one year), "View all" link to `/stipends?chaplain={userId}`

**Empty state:** "No stipend payments yet."

### 8. Audit Trail Sidebar (Collapsed by default)

**Header:** "Recent Changes" (16px, bold) with expand/collapse toggle

**Content:** Last 5 audit log entries for this user (from `audit_log` where `targetId = userId`)

**Entry format:**
- Admin name + action + timestamp
- Example: "Linda Martinez edited profile • 2 hours ago"

**Click to expand:** Show before/after diff for each entry

## Page States

**Loading:** Skeleton layout with gray blocks for all sections

**Loaded:** Full profile rendered with editable/view mode toggle

**Not Found (404):** If `:id` doesn't match any user, show 404 page: "User not found. Return to user list."

**Edit Mode:** All form fields enabled, "Save Changes" and "Cancel" buttons appear at bottom

**Saving:** Spinner on "Save Changes" button, form fields disabled during save

**Error (save failed):** Red banner: "Unable to save changes. [Retry]"

## Acceptance Criteria

**Given** an admin navigates to `/users/:id` for a valid user,
**When** the page loads,
**Then** the user's full profile displays with avatar, personal info, role toggles, terminal assignments, duty history, and stipend history.

**Given** an admin clicks "Edit Profile",
**When** edit mode activates,
**Then** all form fields become editable, role toggles become interactive, and "Save Changes" button appears.

**Given** an admin modifies the user's email and clicks "Save Changes",
**When** the save completes,
**Then** the email field updates in Firestore, an audit log entry is created, and a success toast appears: "Profile updated."

**Given** an admin uploads a new profile photo,
**When** the upload completes,
**Then** the photo is compressed, uploaded to Firebase Storage, the `photoUrl` field is updated, and the avatar displays the new image.

**Given** an admin toggles the "Chaplain" switch from off to on,
**When** they save the changes,
**Then** `isChaplain` is set to `true`, an audit log entry is created, and the role badge updates.

**Given** an admin views the Duty History section,
**When** the user has 25 duty logs,
**Then** the 10 most recent logs are shown with a "View all" link to the full duty days page filtered for this chaplain.

## Edge Cases

**User has no terminal assignments:** Show "—" in terminals field

**User has never been edited:** "Last edited" note shows "Never edited"

**User photo upload fails:** Show error toast: "Upload failed. Try a smaller image."

**Concurrent edits:** If two admins edit the same profile simultaneously, last write wins (Firestore default). Show warning if `adminEditedAt` timestamp changed since page load.

## Mobile Considerations

**User detail on mobile:**
- Profile header stacks vertically (avatar above info)
- Form fields stack vertically (full-width)
- Role toggles stack vertically (each on its own line)
- Terminal checkboxes stack vertically
- Duty/stipend tables scroll horizontally or show simplified columns

## Performance Requirements

- **Page load:** Under 2 seconds
- **Photo upload:** 800x800px compressed image uploads in under 5 seconds
- **Save operation:** Profile update completes in under 1 second

## Security & Privacy

- **Admin-only access:** Route guard enforced
- **Audit trail:** All profile edits logged with before/after values
- **Photo storage:** Firebase Storage with security rules (admin read/write only)

## Future Enhancements (v1.1+)

- **User creation flow:** "+ Add User" button on list page leads to new user form
- **Bulk user import:** CSV upload to create multiple users at once
- **Email user:** "Send Email" button on detail page opens email client
- **User deactivation:** Soft delete (set `isActive = false`) instead of hard delete
- **Role history:** Timeline showing all role changes over time
