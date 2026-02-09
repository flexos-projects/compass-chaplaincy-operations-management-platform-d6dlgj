---
id: features-settings-configuration
title: "Settings & Configuration"
description: "System-wide configuration including stipend rate, admin user management, program year, and display preferences"
type: spec
subtype: features
status: draft
sequence: 9
tags: [features, settings, configuration, p1]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, docs/core/004-database.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Settings & Configuration

## Overview

The Settings & Configuration feature provides a centralized admin interface for managing system-wide operational parameters that affect how COMPASS functions. This replaces the scattered SharedPreferences approach of the original FlutterFlow app (where settings were stored locally on each device) with a single, authoritative, server-synced `app_settings` Firestore document.

The settings page is where admins configure the base stipend rate (default $80/shift), manage which users have admin access, set the current program year for date calculations, and adjust display preferences. Changes made on the settings page take effect immediately across all admin sessions.

## Business Context

Chaplaincy program operations have configurable parameters that change occasionally:
- **Stipend rate:** The board may approve a rate increase from $80 to $90 per shift
- **Program year:** Academic-style programs run on a fiscal calendar (e.g., Aug 1 - Jul 31)
- **Admin roster:** As staff turnover occurs, admin privileges must be granted or revoked
- **Display preferences:** Organization branding, default avatars, support contact information

The original app hardcoded these values (`stipendAmount = 80`, `year = 2025`) in the FlutterFlow UI, requiring a full app rebuild and redeploy to change them. COMPASS stores these in Firestore as live configuration.

## Core Functionality

### 1. Base Stipend Rate Configuration

**Field:** `app_settings.baseStipendRate` (number, dollars per shift)

**Display:** Numeric input with dollar sign prefix. Default value: 80.

**Validation:**
- Must be a positive number
- Minimum: $10 (sanity check, unrealistically low)
- Maximum: $500 (sanity check, unrealistically high)
- Decimals allowed (e.g., $82.50 is valid)
- Required field (cannot be empty or zero)

**Impact:** When this value changes, all future stipend calculations use the new rate. **Historical payout records are immutable** -- changing the rate does NOT retroactively change past payouts (those used the rate that was current at the time of processing).

**Use case:** The board approves a stipend increase effective March 1. The program director updates the rate from $80 to $90 on February 28. Starting March 1, all new duty shifts calculate at $90/shift. January and February payouts remain at $80.

**UI helper text:** Display below the input: "Current rate: $80.00 per qualifying duty shift. Changing this rate affects future payments only. Past payouts are not recalculated."

### 2. Admin User Management

**Field:** `app_settings.adminUserIds` (array of strings, each string is a Firebase Auth UID)

**Display:** A table showing current admins with columns: Name, Email, UID, Actions (Remove button). Below the table: "Add Admin User" section with a UID input field and Add button.

**Add flow:**
1. Admin enters a Firebase Auth UID (36-character alphanumeric string, usually starts with a letter)
2. System validates UID format (regex: `^[a-zA-Z0-9-_]{20,36}$`)
3. System looks up the UID in `users` collection to fetch display name and email
4. If user exists, show confirmation modal: "Grant admin access to [Name] ([email])? This user will have full access to all administrative functions."
5. On confirm, append UID to `adminUserIds` array in Firestore
6. Show success toast: "[Name] is now an admin."

**Remove flow:**
1. Admin clicks Remove button on a row
2. Show confirmation modal: "Revoke admin access for [Name]? They will no longer be able to access the admin dashboard."
3. On confirm, remove UID from `adminUserIds` array
4. Show success toast: "Admin access revoked for [Name]."
5. **Critical safeguard:** If removing the UID would result in an empty `adminUserIds` array (last admin), show error: "Cannot remove the last admin user. Add another admin before removing yourself."

**Use case:** Linda is the sole admin. She hires a new program coordinator, Marcus. She adds Marcus's UID to the admin list. Marcus can now log in and see the full dashboard. Six months later, Marcus leaves. Linda removes his UID. Marcus's account still exists in `users`, but he can no longer access the admin pages.

**Bootstrap mechanism:** The very first admin must manually add their UID to the `app_settings/config` document in the Firebase console during initial deployment. This is a one-time manual step documented in the deployment guide.

### 3. Program Year Setting

**Field:** `app_settings.programYear` (number, four-digit year)

**Display:** Numeric input or dropdown with years 2020-2030.

**Validation:**
- Must be a four-digit year
- Minimum: 2020 (earlier years are historical, unlikely to be relevant)
- Maximum: 2030 (far-future years indicate data entry error)
- Default: Current calendar year (auto-populated on first setup)

**Impact:** Used for:
- Dashboard KPI calculations (e.g., "YTD encounters" = encounters in current program year)
- Stipend period defaults (when selecting months, default to current program year)
- Coverage schedule year context (week selector shows year context)

**Use case:** If the program runs on an August-to-July fiscal year, the program director sets programYear = 2026 in August 2026. All YTD calculations now measure from Aug 1, 2026 forward.

**Note:** In v1.0, we simplify to calendar year (Jan-Dec). The program year field exists for future expansion to fiscal year support.

### 4. Display Preferences

**Fields:**
- `app_settings.orgName` (string, default: "DFW Airport Interfaith Chaplaincy")
- `app_settings.supportEmail` (email, default: "support@dfwchaplaincy.org")
- `app_settings.defaultPhotoUrl` (URL, default: a generic avatar image in Firebase Storage)

**Display:** Three text inputs in a "Display Preferences" section.

**Validation:**
- `orgName`: Required, max 100 characters
- `supportEmail`: Valid email format, optional
- `defaultPhotoUrl`: Valid HTTPS URL, optional

**Impact:**
- `orgName` appears in the sidebar branding and page titles
- `supportEmail` appears in footer and error messages ("Contact support at [email]")
- `defaultPhotoUrl` is used as the profile photo for new users who haven't uploaded one

**Use case:** If COMPASS is later adopted by a different airport chaplaincy (e.g., LAX), they can rebrand the org name and support email without code changes.

## Acceptance Criteria

**Given** an admin navigates to `/settings`,
**When** the page loads,
**Then** the current base stipend rate, program year, admin user list, and display preferences are displayed in editable form fields.

**Given** the admin changes the base stipend rate from $80 to $90,
**When** they click Save,
**Then** the new rate is written to `app_settings/config`, an audit log entry is created, and a success toast appears: "Stipend rate updated to $90.00."

**Given** the admin enters a valid Firebase UID in the "Add Admin User" field,
**When** they click Add,
**Then** the system fetches the user's display name and email, shows a confirmation modal, and on confirm, adds the UID to the admin list.

**Given** the admin enters an invalid UID (wrong format or doesn't exist),
**When** they attempt to add it,
**Then** an error message appears: "User not found. Check the UID and try again."

**Given** the admin clicks Remove on an admin user,
**When** they confirm the removal,
**Then** the UID is removed from `adminUserIds`, an audit log entry is created, and a success toast appears: "Admin access revoked for [Name]."

**Given** the admin attempts to remove the last remaining admin user,
**When** they click Remove,
**Then** an error modal prevents the action: "Cannot remove the last admin user. Add another admin before removing yourself."

**Given** the admin updates the program year from 2025 to 2026,
**When** they save the change,
**Then** the new year is written to Firestore, and all YTD calculations on the dashboard immediately reflect the new program year context.

**Given** the admin updates the organization name,
**When** they save the change,
**Then** the sidebar branding and page titles update to show the new org name within 5 seconds (Firestore listener refresh).

## Edge Cases

### Validation Errors
- **Stipend rate is negative:** Show error: "Stipend rate must be a positive number."
- **Stipend rate is zero:** Show error: "Stipend rate cannot be zero. Enter a valid amount."
- **Stipend rate exceeds $500:** Show warning: "This rate seems unusually high. Confirm before saving."
- **Program year is in the past (>3 years ago):** Show warning: "This year is in the past. Are you sure?"
- **UID format invalid:** Show error: "Invalid UID format. Firebase UIDs are 20-36 alphanumeric characters."

### Concurrent Edits
- **Two admins editing settings simultaneously:** Last write wins (Firestore default). Show a warning: "Settings were recently updated by another admin. Refresh to see the latest values."
- **Mitigation:** Display last updated timestamp and admin name below each section: "Last updated by Linda Martinez on Feb 9, 2026 at 10:45 AM."

### Deleted Users
- **Admin UID points to deleted user:** Show "[Deleted User]" in the admin list with the UID visible. Allow removal.
- **Admin tries to add a UID that doesn't exist in `users`:** Show error: "This UID does not match any user in the system. Create the user account first."

## Mobile Considerations

**Settings page on tablet (768px+):** Full functionality. Form sections stack vertically.

**Settings page on mobile (<768px):** Full functionality. All form fields are touch-friendly (minimum 44px height). Admin user table switches to card layout (one card per admin with Remove button at bottom of card).

## Performance Requirements

- **Page load:** Settings load in under 1 second (single document read from `app_settings/config`)
- **Save operation:** Settings update completes in under 2 seconds
- **UID lookup:** User name/email fetch for UID validation completes in under 1 second
- **Real-time sync:** Settings changes propagate to all active admin sessions within 5 seconds (Firestore listener)

## Security & Privacy

- **Admin-only access:** Settings page requires admin role (route guard + Firestore rules)
- **Firestore rule for app_settings:** `allow read: if isAdmin(); allow write: if isAdmin();`
- **Audit trail:** All settings changes are logged in `audit_log` with before/after values
- **UID exposure:** Displaying Firebase UIDs in the admin list is acceptable (internal admin tool, UIDs are not secret)
- **No sensitive data:** Settings do not store passwords, API keys, or payment credentials

## Future Enhancements (v1.1+)

- **Fiscal year configuration:** Start month and end month for program year (e.g., Aug-Jul)
- **Notification preferences:** Global settings for email notifications (daily digest, weekly summary)
- **Custom branding:** Logo upload, primary color picker, custom CSS injection
- **Timezone setting:** Override default timezone for date/time display (currently uses server timezone)
- **Backup & restore:** Export settings as JSON for disaster recovery, import to restore
- **Settings history:** Audit log view integrated into settings page showing all configuration changes
- **Multi-language support:** Interface language setting (currently English-only)
