---
id: pages-login
title: "Login Page"
description: "Email and password authentication page with COMPASS branding, error handling, and password reset flow"
type: spec
subtype: pages
status: draft
sequence: 11
tags: [pages, auth, login, p0]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, specs/001-features_auth-rbac.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Login Page

## Overview

The Login page is the entry point for all admin access to COMPASS. It provides email and password authentication via Firebase Auth, validates admin role permissions, and redirects authenticated admins to the dashboard. This page is public (no authentication required to view it), but successful login leads to a role check that restricts access to admin users only.

The login page uses a **centered card layout** on a neutral background with COMPASS branding -- no sidebar, no navigation, just the authentication form. It is intentionally minimal to focus the user on the single task: authenticate.

## Route

**Path:** `/login`

**Layout:** Public layout (centered card, no sidebar)

**Auth requirement:** None (public page)

**Query parameters:**
- `redirect` (optional) -- URL to navigate to after successful login (default: `/`)

**Example:** `/login?redirect=/stipends` (user attempted to access stipends page while logged out, route guard captured the intended destination)

## Page Structure

### 1. Branding Header

**Content:**
- COMPASS logo (SVG or PNG, 200px width, centered)
- Organization name: "DFW Airport Interfaith Chaplaincy" (centered, 16px, neutral gray)
- Page title: "Admin Login" (centered, 28px, bold, navy)

**Styling:**
- White background
- Logo and text vertically centered in a 300px tall header section
- Subtle bottom border (1px, neutral-200)

### 2. Login Form

**Container:**
- White card with subtle shadow
- Max width: 400px
- Padding: 32px
- Centered horizontally and vertically on viewport

**Form fields:**

**Email input:**
- Label: "Email" (14px, neutral-900)
- Type: email
- Placeholder: "admin@dfwchaplaincy.org"
- Autofocus: true (cursor lands in email field on page load)
- Autocomplete: email
- Validation: HTML5 email format check
- Error state: Red border + red text below if invalid

**Password input:**
- Label: "Password" (14px, neutral-900)
- Type: password
- Placeholder: "Enter your password"
- Autocomplete: current-password
- Show/hide toggle: Eye icon button on right side of input (toggles between password and text type)
- Validation: Non-empty (minimum 1 character, but Firebase requires 6+ on account creation)
- Error state: Red border + red text below if empty on submit

**Submit button:**
- Text: "Login"
- Style: Primary button (navy background, white text, full width)
- Height: 48px (comfortable touch target)
- Loading state: Spinner replaces text, button disabled while authenticating
- Disabled state: Gray background if form is invalid or submitting

**Forgot password link:**
- Text: "Forgot your password?"
- Style: Small link (12px, primary-light color) below the submit button
- Action: Navigate to `/forgot-password`

### 3. Error Message Display

**Location:** Between the form and submit button (or above the form for global errors)

**Error types:**

**Invalid credentials:**
- Message: "Invalid email or password. Please try again."
- Style: Red background with white text, 12px padding, rounded corners
- Icon: Alert circle icon
- Trigger: `auth/wrong-password` or `auth/user-not-found` error from Firebase

**Account disabled:**
- Message: "This account has been disabled. Please contact your administrator at [support email]."
- Style: Yellow background with dark text (warning, not critical error)
- Trigger: `auth/user-disabled` error from Firebase

**Too many attempts:**
- Message: "Too many failed login attempts. Please try again in a few minutes."
- Style: Red background
- Trigger: `auth/too-many-requests` error from Firebase (rate limiting)

**Network error:**
- Message: "Unable to connect. Please check your internet connection and try again."
- Style: Red background
- Trigger: Network timeout or offline state

**Not an admin:**
- Message: "Access denied. This account does not have admin privileges. Please contact your program director if you believe this is an error."
- Style: Yellow background (not a Firebase error, but a role check failure)
- Trigger: Successful Firebase auth but `app_settings.adminUserIds` does not include the user's UID

**Errors persist until:** User edits either input field (error clears) or submits again (new error may appear)

### 4. Footer

**Content:**
- App version: "COMPASS v1.0" (small gray text, bottom-left)
- Support link: "Need help? Contact support" (small link, bottom-right, opens email to support address from settings)

**Styling:**
- Fixed to bottom of card or page
- 12px font, neutral-600 color
- Horizontal space-between layout

## Page States

### Default State
- Email and password fields empty
- Submit button enabled
- No error messages
- Autofocus on email input

### Loading State
- Submit button shows spinner, text changes to "Logging in..."
- Submit button disabled
- Input fields disabled (prevent edits during auth)
- This state lasts 500ms - 2 seconds (Firebase Auth call duration)

### Error State
- Error banner appears above or below form
- Email and password fields remain editable
- Submit button re-enabled
- Error persists until user modifies input or successfully logs in

### Success State (brief, before redirect)
- Success message: "Login successful. Redirecting..." (green banner)
- This state lasts <500ms before redirect to dashboard or intended page
- Prevents the user from seeing an abrupt navigation

## User Flow

### Happy Path
1. User navigates to `/login` (or is redirected there by route guard)
2. User enters email and password
3. User clicks Login (or presses Enter)
4. Form validates client-side (email format, password non-empty)
5. Submit button enters loading state
6. Firebase Auth `signInWithEmailAndPassword()` is called
7. Firebase returns success with user object
8. System reads `app_settings/config` to check if `user.uid` is in `adminUserIds`
9. Admin check passes
10. System reads `redirect` query param (or defaults to `/`)
11. System navigates to intended page (e.g., `/` or `/stipends`)
12. Dashboard page loads with authenticated session

### Error Path: Invalid Credentials
1. Steps 1-6 from happy path
2. Firebase returns `auth/wrong-password` error
3. Error banner appears: "Invalid email or password"
4. Submit button exits loading state, re-enables
5. User corrects password, retries
6. Continues to happy path step 7

### Error Path: Not an Admin
1. Steps 1-7 from happy path
2. Admin check fails (UID not in `adminUserIds`)
3. Error banner appears: "Access denied. This account does not have admin privileges."
4. Logout button appears: "Logout" (to clear the non-admin session)
5. User clicks Logout
6. System calls Firebase `signOut()`
7. Page returns to default state

## Acceptance Criteria

**Given** a user navigates to `/login`,
**When** the page loads,
**Then** the email input has autofocus, the submit button is enabled, and no error messages are visible.

**Given** a user enters a valid email and password,
**When** they click Login,
**Then** the submit button shows a loading spinner, Firebase Auth is called, and on success the user is redirected to the dashboard.

**Given** a user enters invalid credentials,
**When** they submit the form,
**Then** an error message appears: "Invalid email or password. Please try again." and the form remains editable.

**Given** a user successfully authenticates but is not in the admin list,
**When** the role check fails,
**Then** an error message appears: "Access denied. This account does not have admin privileges." and a logout button is displayed.

**Given** a user is already logged in as an admin,
**When** they navigate to `/login`,
**Then** they are immediately redirected to the dashboard (no need to show login form to authenticated users).

**Given** a user clicks "Forgot your password?",
**When** the link is clicked,
**Then** they are navigated to `/forgot-password`.

**Given** a user has a slow network connection,
**When** Firebase Auth takes >5 seconds to respond,
**Then** the loading state persists and a timeout error appears after 10 seconds: "Request timed out. Please try again."

## Edge Cases

### Pre-filled Email from Browser Autofill
- **Behavior:** Allow autofill. Do not disable autocomplete.
- **Validation:** Validate on submit, not on autofill (prevents false positives from browser behavior)

### Session Already Active
- **Scenario:** User has a valid session token in localStorage. They manually navigate to `/login`.
- **Behavior:** Redirect to dashboard immediately (no need to re-authenticate)
- **Implementation:** Route guard checks `firebase.auth().currentUser` before rendering login page

### Password Visible Toggle
- **Accessibility:** Ensure the eye icon button has `aria-label="Show password"` / `"Hide password"`
- **Keyboard navigation:** Button is focusable and activates on Enter/Space

### Long Email Addresses
- **Edge case:** Email is 60+ characters (e.g., firstname.lastname.middle@subdomain.domain.org)
- **Behavior:** Input field scrolls horizontally if needed (no truncation). Max width of input is constrained to card width.

## Mobile Considerations

**Login page on mobile (<768px):**
- Card width becomes 100% minus 16px padding on each side
- Form fields stack vertically (already the case on desktop)
- Submit button remains full-width (fills card)
- Branding header logo scales down to 150px width
- Footer text stacks vertically (version on top, support link below)

**Touch targets:**
- Submit button: 48px height (WCAG AAA standard)
- Password toggle button: 44px x 44px
- Forgot password link: 44px height (larger tap area than text size)

## Accessibility

**Keyboard navigation:**
- Tab order: Email → Password → Show/Hide toggle → Submit button → Forgot password link
- Enter key in any input field submits the form

**Screen reader:**
- Form has `<form role="form" aria-label="Admin login form">`
- Error messages have `role="alert"` to announce immediately
- Loading state announces: "Logging in, please wait"

**Color contrast:**
- Error text on red background: white text = 4.5:1+ ratio
- Submit button text on navy: 9.4:1 ratio (exceeds AAA)

## Security Considerations

**Password visibility:** Show/hide toggle is a usability feature, not a security risk (user controls it)

**Error message security:** Do not distinguish between "user not found" and "wrong password" (prevents email enumeration attack). Use generic "Invalid email or password" for both.

**HTTPS only:** Login page must always load over HTTPS (enforced by Firebase Hosting, Nuxt production builds)

**No pre-auth data exposure:** The original FlutterFlow app queried Firestore before login (a security flaw). COMPASS ensures no Firestore reads occur until after authentication.

## Future Enhancements (v2.0)

- **Google Sign-In:** Add "Sign in with Google" button below the email/password form
- **Apple Sign-In:** Add "Sign in with Apple" button (required for iOS app distribution if mobile version is built)
- **Remember me:** Checkbox to extend session duration (default is 1 hour token, remember me = 7 days)
- **2FA (Two-Factor Authentication):** SMS or TOTP-based second factor for high-security deployments
