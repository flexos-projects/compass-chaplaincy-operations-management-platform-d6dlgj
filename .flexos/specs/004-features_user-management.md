---
id: user-management
title: "Chaplain & User Management"
description: "Searchable user list with role filtering, user detail pages, profile editing, photo upload, terminal assignments, and audit trail"
type: spec
subtype: feature
status: draft
sequence: 4
tags: [users, profiles, search, crud, p0]
relatesTo: ["docs/core/002-features.md", "docs/core/003-pages.md", "docs/core/004-database.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Chaplain & User Management

## Overview

User management is the foundation of COMPASS — every other feature references the `users` collection. Admins need to search for chaplains by name, filter by role (chaplain, intern, support staff), view full profiles, edit personal information, assign terminals, upload photos, and track changes via an audit trail.

The user management interface has two main components: (1) a searchable, filterable list page at `/users` and (2) individual detail/edit pages at `/users/:id`. The list page is optimized for quick lookup ("Find chaplain Martinez"), while the detail page provides a full profile view with duty history, stipend history, and editable fields.

Unlike the original FlutterFlow app (which had no search and buried profile editing in a bottom sheet), COMPASS makes user management fast and transparent with full-text search, persistent filter state, and dedicated detail pages.

## User Stories

### List & Search

**US-001:** As an operations coordinator, I want to search for a chaplain by name or email so I can quickly find their profile without scrolling through a long list.

**US-002:** As an admin, I want to filter the user list by role (all users, chaplains only, interns only, support staff) so I can focus on the group I'm managing.

**US-003:** As a program director, I want to see user count badges on filter chips so I know how many people are in each role at a glance.

**US-004:** As an admin, I want to click a user row to navigate to their full detail page so I can view history and edit their profile.

**US-005:** As an admin, when I search or filter, I want results to update instantly (debounced) so I don't have to click a separate "Search" button.

### Detail & Edit

**US-006:** As an operations coordinator, I want to edit a chaplain's terminal assignments (A, B, C, D, E) so I can update their work areas when coverage needs change.

**US-007:** As an admin, I want to upload a new profile photo for a chaplain so their directory listing stays current.

**US-008:** As a program director, I want to toggle role flags (isChaplain, isIntern, isSupportMember, isAfterHours) so I can track who is active in which capacity.

**US-009:** As an admin, I want to see a chaplain's duty history and stipend payment history on their detail page so I can answer questions without navigating to separate pages.

**US-010:** As an admin, when I save profile changes, I want the system to record an audit entry with my UID and timestamp so there is accountability for all edits.

## Acceptance Criteria

### Users List Page (/users)

**Given** the users page loads
**When** there are users in the database
**Then** a data table displays with columns: Avatar, Name, Email, Role, Terminals, Status (on duty badge)
**And** rows are sorted by `displayName` ascending
**And** the table shows 50 users per page with pagination controls

**Given** the search bar is visible
**When** the admin types a search term (e.g., "martinez")
**Then** the user list filters in real-time (300ms debounce)
**And** matching is case-insensitive on `displayName` and `email` fields
**And** the table updates to show only matching users

**Given** role filter chips are displayed (All Users, Chaplains, Interns, Support)
**When** the admin clicks "Chaplains"
**Then** the chip highlights (primary color fill)
**And** the user list filters to show only users where `isChaplain == true`
**And** the chip shows a count badge: "Chaplains (42)"

**Given** both search and filter are active
**When** the admin has searched for "john" and selected "Chaplains" filter
**Then** the list shows only chaplains whose name or email contains "john"
**And** both the search term and filter remain visible/active

**Given** the user list has no matches
**When** the search or filter results in zero users
**Then** an empty state displays: "No users found" with a "Clear filters" button

**Given** a user row is clicked
**When** the click event fires
**Then** the admin navigates to `/users/{userId}`

### User Detail Page (/users/:id)

**Given** the user detail page loads
**When** the user document exists
**Then** the page displays:
- **Profile header**: large avatar, name, role, on-duty status badge
- **Personal info section**: email, phone, bio (read-only until edit mode)
- **Role toggles**: isChaplain, isIntern, isSupportMember, isAfterHours (toggle switches)
- **Terminal assignments**: multi-select checkboxes for A, B, C, D, E
- **Duty history table**: 10 most recent duty logs with dates, hours, terminals
- **Stipend history table**: year-to-date and all-time payment totals

**Given** the admin clicks "Edit Profile"
**When** edit mode activates
**Then** personal info fields become editable text inputs
**And** a "Save Changes" button appears
**And** a "Cancel" button discards unsaved changes

**Given** the admin edits fields and clicks "Save Changes"
**When** the save action triggers
**Then** the client validates all fields (email format, phone format, required fields)
**And** the client calls server API: `POST /api/users/:id/update`
**And** the server updates the user document in Firestore
**And** the server sets `adminEditedAt = serverTimestamp()` and `adminEditedBy = currentAdmin.uid`
**And** the server writes an `audit_log` entry with before/after diff
**And** the page shows a success toast: "Profile updated"
**And** the form returns to read-only mode

**Given** the admin clicks "Upload Photo"
**When** a file is selected
**Then** the client validates: max 5 MB, image/* MIME types only
**And** the client compresses the image (max 800x800px, 80% JPEG quality)
**And** the client uploads to Firebase Storage: `/user-photos/{userId}/{timestamp}.jpg`
**And** the client receives the download URL
**And** the client calls `POST /api/users/:id/update` with `{ photoUrl: downloadUrl }`
**And** the server writes the user document and audit entry
**And** the avatar updates immediately

**Given** the user document does not exist (invalid ID)
**When** the page tries to load
**Then** a 404 state displays: "User not found" with a link back to `/users`

### Profile Editing Form Fields

**Field: displayName**
- Type: Text input
- Validation: Required, 2-100 characters
- Error: "Name is required"

**Field: email**
- Type: Email input
- Validation: Required, valid email format
- Error: "Enter a valid email address"

**Field: phoneNumber**
- Type: Text input with formatting (e.g., (555) 123-4567)
- Validation: Optional, valid phone format
- Error: "Enter a valid phone number"

**Field: bio**
- Type: Textarea
- Validation: Optional, max 500 characters
- Error: "Bio must be under 500 characters"

**Field: role**
- Type: Dropdown select
- Options: admin, chaplain, intern, support
- Validation: Required
- Note: Changing to/from "admin" also updates `app_settings.adminUserIds` array

**Field: terminals**
- Type: Multi-select checkboxes
- Options: A, B, C, D, E
- Validation: Optional
- Stored as: array of strings `['A', 'B']`

**Field: isChaplain, isIntern, isSupportMember, isAfterHours**
- Type: Toggle switches
- Validation: None (boolean)

### Terminal Assignment UX

**Given** a chaplain is assigned to Terminals A and C
**When** the detail page loads
**Then** the terminal assignment section shows checkboxes for A-E
**And** A and C are checked, B, D, E are unchecked

**Given** the admin checks Terminal D
**When** the change occurs
**Then** the `terminals` array updates immediately (optimistic)
**And** on save, the array becomes `['A', 'C', 'D']`

**Given** a chaplain has no terminal assignments
**When** the detail page loads
**Then** the terminal section shows "No terminals assigned"

### Photo Upload

**Given** the admin clicks "Upload Photo"
**When** a file selector appears
**Then** only image files are selectable (JPEG, PNG, WebP)

**Given** a 4 MB JPEG is selected
**When** upload begins
**Then** the client compresses to max 800x800px at 80% quality
**And** a progress bar shows upload status (0-100%)
**And** on completion, the avatar updates with the new URL

**Given** a 6 MB PNG is selected
**When** validation runs
**Then** an error displays: "Image must be under 5 MB"
**And** upload does not proceed

**Given** upload fails (network error)
**When** the error occurs
**Then** the progress bar shows an error state
**And** an error message displays: "Upload failed. Try again."
**And** the old avatar remains unchanged

### Audit Trail

**Given** an admin edits a user profile
**When** the save completes
**Then** an audit_log entry is created with:
- `action: 'profile_edit'`
- `adminId: currentAdmin.uid`
- `targetId: userId`
- `targetCollection: 'users'`
- `details.before: { displayName: 'John Doe', email: 'old@example.com' }`
- `details.after: { displayName: 'John Martinez', email: 'new@example.com' }`
- `createdAt: serverTimestamp()`

**Given** an admin uploads a photo
**When** the upload completes
**Then** an audit_log entry is created with `action: 'photo_upload'` and the new photo URL in details

## Functional Requirements

### FR-001: Search Implementation
- Client-side search using computed filter (no Firestore query)
- Search term stored in component state (not URL query param)
- Debounce delay: 300ms
- Case-insensitive match on `displayName` and `email`
- Highlight matching text (optional enhancement)

### FR-002: Role Filter Chips
- Single-select filter (only one chip active at a time)
- Chips: "All Users" (default), "Chaplains", "Interns", "Support Staff"
- Firestore queries per chip:
  - All Users: no filter
  - Chaplains: `where('isChaplain', '==', true)`
  - Interns: `where('isIntern', '==', true)`
  - Support: `where('isSupportMember', '==', true)`
- Count badges update in real-time via listener

### FR-003: Pagination
- Page size: 50 users
- Firestore cursor-based pagination using `startAfter` and `limit`
- "Previous" and "Next" buttons
- Current page indicator: "Showing 1-50 of 142"
- Pagination resets when search or filter changes

### FR-004: User Detail Data Loading
- Single Firestore listener for user document
- Separate queries for duty history and stipend history (one-time fetch, not listener)
- Duty history: last 10 entries, sorted by `startTime DESC`
- Stipend history: aggregated totals from `chaplain_payouts` and `stipend_records`

### FR-005: Edit Mode Toggle
- Default: read-only view with "Edit Profile" button
- Edit mode: form fields editable, "Save" and "Cancel" buttons appear
- Cancel: discard changes, return to read-only (confirm if unsaved changes exist)
- Save: validate, submit API request, show loading spinner on button

### FR-006: Server API Endpoint
Route: `POST /api/users/:id/update`
Request body:
```json
{
  "displayName": "John Martinez",
  "email": "jmartinez@example.com",
  "phoneNumber": "(555) 123-4567",
  "bio": "Chaplain since 2018...",
  "role": "chaplain",
  "terminals": ["A", "C"],
  "isChaplain": true,
  "isIntern": false,
  "isSupportMember": false,
  "isAfterHours": true,
  "photoUrl": "https://storage.../photo.jpg"
}
```
Server logic:
1. Verify auth token and admin status
2. Fetch current user document (for audit before/after)
3. Validate all fields
4. Batch write:
   - Update user document
   - Set `adminEditedAt` and `adminEditedBy`
   - Create audit_log entry
5. Return success

### FR-007: Photo Compression
Use browser canvas API to compress before upload:
```typescript
async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const maxDim = 800
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
  canvas.width = img.width * scale
  canvas.height = img.height * scale
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}
```

## Non-Functional Requirements

### NFR-001: Performance
- User list initial load: < 2 seconds for 50 users
- Search results update: < 300ms after last keystroke
- Profile save: < 1 second for text fields, < 3 seconds for photo upload
- Photo compression: < 500ms client-side

### NFR-002: Accessibility
- Search input has `aria-label="Search users by name or email"`
- Filter chips use `role="radiogroup"` (single-select)
- User table has proper `<thead>`, `<tbody>`, scope attributes
- Edit mode toggles announce: "Edit mode enabled" to screen readers
- Form errors have `role="alert"` and associate with inputs via `aria-describedby`

### NFR-003: Mobile Responsiveness
- User list on mobile: show avatar, name, role only (hide email, terminals)
- Click row to see full details on detail page
- Detail page on mobile: sections stack vertically
- Photo upload on mobile: use native file picker with camera option

## Dependencies

- VueFire `useCollection` for user list real-time binding
- VueFire `useDocument` for single user detail
- Firebase Storage for photo uploads
- `@tanstack/vue-table` for data table sorting and pagination
- Server-side audit trail API (Nuxt route)

## Edge Cases

**EC-001: Editing Own Profile**
Admin can edit their own profile. If they remove themselves from `adminUserIds`, they immediately lose access (next API call fails). Warn: "Removing yourself from admins will lock you out. Confirm?"

**EC-002: Duplicate Email**
Firebase Auth enforces unique emails. If admin changes email to one already in use, server returns error: "Email already exists."

**EC-003: Large Bio Text**
Bio max 500 chars. Client enforces with character counter. Server truncates if bypassed.

**EC-004: Photo Upload Timeout**
If upload takes > 30 seconds (slow connection), show progress bar and allow cancel.

**EC-005: Search with Special Characters**
Search term sanitized to prevent Firestore query errors (escape special regex characters).

**EC-006: Zero Terminal Assignments**
Valid state. Some chaplains are unassigned (interns in training). Show "No terminals" instead of empty.

## Testing Requirements

### Unit Tests
- [ ] Search filter matches case-insensitive
- [ ] Role filter query construction
- [ ] Image compression reduces file size
- [ ] Before/after diff generation for audit

### Integration Tests
- [ ] User list loads with pagination
- [ ] Search updates results in real-time
- [ ] Filter chips toggle correctly
- [ ] Profile edit saves and triggers audit entry

### E2E Tests
- [ ] Full flow: search → click user → edit profile → save → verify audit
- [ ] Photo upload: select file → compress → upload → update avatar
- [ ] Terminal assignment: toggle → save → verify array update
- [ ] Empty state: filter with no results shows "No users found"

## Future Enhancements (Post-v1.1)

- Bulk user import via CSV upload
- Bulk edit: select multiple users, change role or terminals at once
- User deactivation/archival (soft delete, hide from main list)
- Activity timeline on detail page (all audit entries for this user)
- Export user list to CSV
