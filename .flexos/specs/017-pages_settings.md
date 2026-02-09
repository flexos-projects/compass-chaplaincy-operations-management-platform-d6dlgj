---
id: pages-settings
title: "Settings Page"
description: "System configuration page for stipend rate, admin user management, program year, and display preferences"
type: spec
subtype: pages
status: draft
sequence: 17
tags: [pages, settings, configuration, admin-tools]
relatesTo: [docs/core/003-pages.md, docs/core/004-database.md, docs/core/005-flows.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Pages: Settings

## Overview

The Settings page provides centralized configuration for system-wide parameters that affect COMPASS behavior. Unlike the original FlutterFlow app which stored settings in local SharedPreferences (unsynced, device-specific), COMPASS uses a single Firestore document (`app_settings/config`) that syncs across all admin sessions and enforces consistency.

## Route

**Route:** `/settings`
**Layout:** Admin (sidebar navigation)
**Auth:** Admin only
**Primary data source:** app_settings (single document: `config`)

## Page Structure

### Sections

The Settings page is organized into 4 collapsible/tabbed sections:

1. **Stipend Configuration**
   - **Base Stipend Rate:**
     - Label: "Base stipend rate per qualifying shift"
     - Input: Number field (dollars)
     - Current value from `app_settings.baseStipendRate`
     - Default: $80
     - Validation: Must be > 0, max $500
     - Help text: "This rate applies to all future stipend calculations. Past payouts are not affected."
   - **Adjustment Limits:**
     - Min adjustment: Number field (default: -$80)
     - Max adjustment: Number field (default: +$200)
     - Help text: "Limits for manual adjustments on individual shifts."

2. **Admin Users List**
   - **Current Admins Table:**
     - Columns: Name, Email, Added Date, Actions
     - Fetched from `users` collection where `uid` is in `app_settings.adminUserIds`
     - Shows denormalized user info for display
     - Each row has "Remove" button (with confirmation modal)
   - **Add Admin Section:**
     - Input: "User UID" (text field)
     - Help text: "Enter the Firebase UID of an existing user to grant admin access. Find UIDs in the Users page."
     - Button: "Add Admin"
     - Validation: Must be a valid UID (check if user exists in `users` collection)
     - On success: Append UID to `app_settings.adminUserIds`, show success toast
     - On failure: "User not found" or "User is already an admin"
   - **Bootstrap Note:**
     - Collapsible info panel: "First-time setup: If you need to add the first admin, manually add the UID to the app_settings document in the Firebase console."

3. **Program Settings**
   - **Program Year:**
     - Label: "Current program year"
     - Input: Number field (year, e.g., 2026)
     - Current value from `app_settings.programYear`
     - Validation: Must be >= 2020, <= current year + 2
     - Help text: "Used for stipend periods and annual reporting. Update at the start of each program year."
   - **Organization Name:**
     - Label: "Organization name"
     - Input: Text field
     - Current value from `app_settings.orgName`
     - Default: "DFW Airport Interfaith Chaplaincy"
     - Max 100 chars
     - Used in branding, reports, emails
   - **Support Email:**
     - Label: "Support contact email"
     - Input: Email field
     - Current value from `app_settings.supportEmail`
     - Optional
     - Displayed in error pages and help links

4. **Display Preferences**
   - **Default Profile Photo URL:**
     - Label: "Default avatar for new users"
     - Input: URL field
     - Current value from `app_settings.defaultPhotoUrl`
     - Optional
     - Preview: Shows avatar thumbnail if URL provided
   - **Idle Logout Timeout:**
     - Label: "Auto-logout after inactivity (hours)"
     - Input: Number field
     - Range: 1-24 hours
     - Default: 4 hours
     - Help text: "Admins are logged out after this period of inactivity for security."
   - **Future:** Additional preferences like date format, time zone (not in v1)

### Action Buttons (Sticky Footer)

- **Save Changes:** Primary button, enabled when any field is modified
- **Discard Changes:** Secondary button, resets form to last saved values
- **Reset to Defaults:** Tertiary button (with confirmation), restores all settings to hardcoded defaults

### States

- **Loading:** Skeleton UI for all sections, form fields disabled
- **Loaded:** All settings rendered from `app_settings/config` document
- **Editing:** User has modified at least one field, unsaved changes indicator appears
- **Saving:** "Saving..." spinner on Save button, form disabled
- **Error:** "Unable to save settings. Try again." toast, form re-enabled

## Data Model

### app_settings Collection (Single Document)

**Document ID:** `config`

```typescript
interface AppSettings {
  // Stipend
  baseStipendRate: number           // Default: 80
  minAdjustment: number             // Default: -80
  maxAdjustment: number             // Default: 200

  // Admin Access
  adminUserIds: string[]            // Array of Firebase UIDs with admin access

  // Program
  programYear: number               // Default: 2026
  orgName: string                   // Default: "DFW Airport Interfaith Chaplaincy"
  supportEmail?: string             // Optional

  // Display
  defaultPhotoUrl?: string          // Optional
  idleLogoutHours: number           // Default: 4

  // Metadata
  updatedAt: Timestamp
  updatedBy: string                 // UID of admin who last updated
}
```

### Default Values

If `app_settings/config` document doesn't exist (first-time setup), create it with:

```typescript
{
  baseStipendRate: 80,
  minAdjustment: -80,
  maxAdjustment: 200,
  adminUserIds: [],  // Must be manually populated via console for bootstrap
  programYear: new Date().getFullYear(),
  orgName: "DFW Airport Interfaith Chaplaincy",
  idleLogoutHours: 4,
  updatedAt: serverTimestamp(),
  updatedBy: 'system'
}
```

## API Routes

### GET /api/settings

**Purpose:** Fetch current app settings
**Auth:** Admin only
**Response:**
```typescript
{
  success: true,
  settings: AppSettings
}
```

### POST /api/settings/update

**Purpose:** Update app settings (partial or full)
**Auth:** Admin only
**Request Body:**
```typescript
{
  baseStipendRate?: number,
  minAdjustment?: number,
  maxAdjustment?: number,
  adminUserIds?: string[],
  programYear?: number,
  orgName?: string,
  supportEmail?: string,
  defaultPhotoUrl?: string,
  idleLogoutHours?: number
}
```

**Server Logic:**
1. Verify admin auth token
2. Validate all fields (type checks, range checks)
3. Read current `app_settings/config` document
4. Merge updates with existing settings
5. Firestore batch write:
   - Update `app_settings/config` with new values + `updatedAt`, `updatedBy`
   - Create `audit_log` entry: `settings_update` action with before/after diff
6. Batch commit

**Response:**
```typescript
{
  success: true,
  settings: AppSettings  // Updated settings
}
```

**Error Responses:**
- 400: Validation failed (e.g., baseStipendRate <= 0)
- 403: Not authorized (non-admin)
- 500: Firestore write failed

## Security Considerations

### Admin User Management

**Risk:** Admins can add/remove other admins, including themselves.

**Mitigations:**
1. **Last admin protection:** If removing an admin UID would result in `adminUserIds` being empty, reject with error: "Cannot remove the last admin. Add another admin first."
2. **Self-removal warning:** If admin tries to remove their own UID, show confirmation: "You are removing yourself from admin access. You will be logged out immediately. Continue?"
3. **Audit trail:** Every admin add/remove creates an `audit_log` entry with full context.

### Stipend Rate Changes

**Risk:** Changing the base stipend rate mid-month could cause inconsistencies.

**Mitigations:**
1. **Warning banner:** When editing base rate, show: "This affects future stipend calculations. Past payouts are not recalculated."
2. **Effective date (future enhancement):** Add `effectiveDate` field to stipend rate changes, apply only to shifts after that date.

## Accessibility

- **Form field labels:** All inputs have explicit `<label>` elements
- **Help text:** Uses `aria-describedby` to link help text to inputs
- **Validation errors:** Announced to screen readers via `aria-live="polite"`
- **Confirmation modals:** Focus trap and keyboard navigation (Esc to cancel, Enter to confirm)

## Acceptance Criteria

- [ ] Given I navigate to `/settings`, when the page loads, then all current settings are displayed with correct values from `app_settings/config`
- [ ] Given I change the base stipend rate from $80 to $90, when I click "Save Changes", then the new rate is stored and a success toast appears
- [ ] Given I enter a valid user UID in the Add Admin field, when I click "Add Admin", then the UID is appended to `adminUserIds` and the admin list refreshes
- [ ] Given I try to add a UID that doesn't exist, when I click "Add Admin", then an error message "User not found" is displayed
- [ ] Given I try to remove the last admin, when I click "Remove", then an error message "Cannot remove the last admin" is displayed
- [ ] Given I modify the program year to 2027, when I save, then an `audit_log` entry is created with action `settings_update` and details showing before/after values
- [ ] Given I click "Reset to Defaults", when I confirm, then all settings revert to hardcoded defaults and a success toast appears

## Open Questions

1. **Stipend rate history:** Should we track historical stipend rates with effective dates, or is a single current rate sufficient?
2. **Role permissions beyond admin:** Should we add a "read-only admin" role for viewing dashboards without editing capability?
3. **Email notifications:** Should we add settings for email notification preferences (e.g., weekly stipend reminder)?
4. **Multi-organization support:** Is COMPASS always single-tenant (one chaplaincy program), or should we plan for multi-tenant configuration?

## Related Documents

- Core Pages Doc: `docs/core/003-pages.md` (Settings page reference in navigation)
- Core Database Doc: `docs/core/004-database.md` (app_settings collection schema)
- Core Flows Doc: `docs/core/005-flows.md` (FL-016 Settings Update)
- Core Technical Doc: `docs/core/007-technical.md` (Auth architecture, admin role model)
