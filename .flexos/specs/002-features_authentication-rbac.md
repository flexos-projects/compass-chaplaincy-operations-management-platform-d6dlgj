---
id: authentication-rbac
title: "Authentication & Role-Based Access Control"
description: "Email/password login, admin role verification, route guards, session management, and Firestore security rules"
type: spec
subtype: feature
status: draft
sequence: 2
tags: [auth, security, firebase, rbac, p0]
relatesTo: ["docs/core/002-features.md", "docs/core/004-database.md", "docs/core/007-technical.md"]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Authentication & Role-Based Access Control

## Overview

COMPASS requires secure authentication with role-based access control to protect financial data, user profiles, and administrative functions. Only authenticated users with the `admin` role can access the dashboard. All Firestore access is gated by server-enforced security rules, eliminating the `allow: if true` vulnerability of the original system.

Authentication uses Firebase Auth with email/password as the initial provider. Future versions may add Google and Apple sign-in, but email/password is sufficient for the chaplaincy director and operations coordinator personas.

The admin role model is intentionally simple: a user is either an admin (full dashboard access) or not (no dashboard access, uses chaplain mobile app instead). The single source of truth for admin status is the `app_settings/config` document's `adminUserIds` array, which is more auditable and secure than per-user role fields.

## User Stories

**US-001:** As a program director, I want to log in with my email and password so I can access the management dashboard.

**US-002:** As the system, I want to enforce that only admin-role users can view financial data and edit other users' profiles, preventing unauthorized access even if someone bypasses the UI.

**US-003:** As an admin, I want to log out securely when I'm done working so my session cannot be hijacked if I walk away from my computer.

**US-004:** As an admin, I want my session to remain active across page refreshes and browser tabs so I don't have to re-login constantly during normal work.

**US-005:** As a non-admin user, when I attempt to access the admin dashboard, then I see an "Unauthorized" message with a logout option (instead of cryptic errors or blank pages).

**US-006:** As the system, I want to automatically refresh authentication tokens before they expire so admins experience seamless sessions without unexpected logouts.

## Acceptance Criteria

### Login Flow

**Given** a valid admin email and password
**When** the user submits the login form
**Then** Firebase Auth authenticates the user
**And** the client verifies the user's UID is in `app_settings.adminUserIds`
**And** the user is redirected to the dashboard (or their intended destination if navigating from a deep link)

**Given** an invalid email or password
**When** the user submits the login form
**Then** the system shows "Invalid email or password" (same message for both to prevent email enumeration)
**And** the login form remains visible for retry

**Given** a valid email/password but the user is not in the admin list
**When** authentication succeeds
**Then** the client shows "Unauthorized: Admin access required"
**And** displays a logout button
**And** does NOT redirect to the dashboard

**Given** an account that has been disabled by Firebase
**When** the user attempts to login
**Then** the system shows "This account has been disabled. Contact your administrator."

### Route Protection

**Given** an unauthenticated user
**When** they navigate to any protected route (/, /users, /stipends, etc.)
**Then** the Nuxt middleware redirects to `/login?redirect={intendedPath}`
**And** after successful login, redirects to the intended path

**Given** an authenticated non-admin user
**When** they navigate to any dashboard route
**Then** the middleware redirects to an "Unauthorized" page
**And** the page shows a logout button

**Given** an authenticated admin user
**When** they navigate between dashboard pages
**Then** no additional authentication checks occur (single admin verification on login is sufficient)

### Session Management

**Given** an admin is logged in
**When** their Firebase Auth token is about to expire (< 5 minutes remaining)
**Then** the client automatically refreshes the token using `getIdToken(true)`
**And** the user experiences no interruption

**Given** an admin has been inactive for 4 hours
**When** they next interact with the app
**Then** the system forces re-authentication for security
**And** preserves any unsaved work in local state

**Given** an admin clicks the logout button
**When** the logout completes
**Then** Firebase Auth signs out the user
**And** the client clears all cached Firestore data
**And** redirects to the login page
**And** any active Firestore listeners are detached

### Server-Side Verification

**Given** a client makes a request to any Nuxt API route
**When** the server receives the request
**Then** the server calls `auth.verifyIdToken(token)` to validate the Firebase token
**And** fetches `app_settings/config` to verify the UID is in `adminUserIds`
**And** rejects the request with 401 Unauthorized if either check fails
**And** proceeds with the request only if both checks pass

**Given** a client directly writes to Firestore (bypassing API routes)
**When** Firestore security rules evaluate the request
**Then** rules verify `request.auth != null`
**And** rules verify `request.auth.uid` is in `get(/databases/$(database)/documents/app_settings/config).data.adminUserIds`
**And** rules reject the write if either check fails

## Functional Requirements

### FR-001: Login Page
- Single-page form with email and password inputs
- "Forgot Password?" link navigating to `/forgot-password`
- Submit button shows spinner during authentication
- Error messages display below form (not as popups/toasts)
- COMPASS branding and tagline at top
- Responsive: centers on all screen sizes
- Auto-focus email field on page load

### FR-002: Forgot Password Flow
- Separate page at `/forgot-password` with email input
- Submit triggers `sendPasswordResetEmail(email)`
- Always show success message "Check your email for a reset link" regardless of whether email exists (prevents email enumeration)
- "Back to Login" link
- Same branding and layout as login page

### FR-003: Auth State Management
- Nuxt middleware (`~/middleware/auth.global.ts`) checks auth state on every navigation
- Public routes: `/login`, `/forgot-password`, `/404`
- Protected routes: all others
- Redirect logic preserves intended destination in query param
- Auth state listener fires on token changes, account deletions, role changes

### FR-004: Admin Role Check
- On successful authentication, client fetches `app_settings/config`
- Checks if `config.adminUserIds.includes(user.uid)`
- Caches admin status in composable/store (Pinia)
- Re-verifies admin status on page refresh (cannot trust client cache alone)
- Server-side API routes independently verify admin status (never trust client)

### FR-005: Session Persistence
- Firebase Auth manages session tokens automatically
- Client stores minimal state: `currentUser.uid`, `isAdmin` boolean
- On page refresh, auth state listener restores session
- No localStorage or sessionStorage needed for tokens (Firebase SDK handles it)

### FR-006: Logout
- Logout button in sidebar footer
- Calls `signOut(auth)`
- Clears any local state (Pinia stores, cached queries)
- Detaches all Firestore listeners to prevent memory leaks
- Redirects to `/login`

### FR-007: Token Refresh
- Firebase SDK auto-refreshes tokens every ~50 minutes (1-hour expiry)
- Client monitors token state via auth state listener
- If refresh fails (account disabled, revoked), force logout
- No user-visible action during successful refresh

### FR-008: Firestore Security Rules
All collections enforce:
```
function isAuthenticated() {
  return request.auth != null;
}

function isAdmin() {
  return isAuthenticated()
    && get(/databases/$(database)/documents/app_settings/config).data.adminUserIds.hasAny([request.auth.uid]);
}
```

- `users`: Read: authenticated. Write: admin only.
- `duty_logs`: Read: authenticated. Create: owner or admin. Update/delete: admin only.
- `chaplain_metrics`: Read: admin only. Create: owner. Update/delete: admin only.
- `coverage_schedules`: Read: authenticated. Write: admin only.
- `chaplain_payouts`: Read: admin only. Create: admin only. **Update/delete: NEVER (immutable).**
- `stipend_records`: Read: admin only. Write: admin only.
- `chats`: Read: admin or participant. Write: participant.
- `chat_messages`: Read: admin or participant. Create: participant. Update/delete: never.
- `audit_log`: Read: admin only. Write: server-side only (client writes blocked).
- `app_settings`: Read: admin only. Write: admin only.

## Non-Functional Requirements

### NFR-001: Security
- No credentials stored in localStorage, sessionStorage, or cookies (Firebase SDK manages tokens securely)
- All API routes verify tokens server-side (never trust client claims)
- Firestore security rules are the authoritative access control layer
- Admin role is verified independently by client and server
- Token refresh happens silently without user disruption

### NFR-002: Performance
- Login completes in under 2 seconds on stable connection
- Route guard checks add < 50ms to navigation time
- Admin role check caches result for session duration (no re-fetch on every navigation)
- Logout is instant (no server round-trip needed beyond Firebase signOut)

### NFR-003: Error Handling
- Network errors: "Unable to connect. Check your internet connection."
- Invalid credentials: "Invalid email or password."
- Account disabled: "This account has been disabled. Contact your administrator."
- Too many attempts: "Too many login attempts. Try again in 5 minutes."
- Token expired: "Your session has expired. Please log in again."
- All errors display inline on the login form (no popups/alerts)

### NFR-004: Accessibility
- Login form uses semantic HTML (`<form>`, proper `<label>` associations)
- Tab order: email → password → submit button → forgot password link
- Enter key submits form from any focused field
- Error messages have `role="alert"` for screen readers
- Focus returns to email field after failed login attempt

## Dependencies

- Firebase Auth configured in Firebase Console (email/password provider enabled)
- `nuxt-vuefire` module installed and configured in `nuxt.config.ts`
- Firestore security rules deployed via `firebase deploy --only firestore:rules`
- `app_settings/config` document created with initial `adminUserIds` array (manual bootstrap for first admin)

## Edge Cases

**EC-001: First Admin Bootstrap**
Problem: Who adds the first admin to `adminUserIds` if no admins exist yet?
Solution: Manual creation. During initial Firebase setup, an engineer creates the `app_settings/config` document with the program director's UID in `adminUserIds` array.

**EC-002: Last Admin Removed**
Problem: What if an admin accidentally removes all UIDs from `adminUserIds`?
Solution: Firestore security rules validation prevents empty array. Rules require `adminUserIds.size() > 0` on writes to `app_settings/config`.

**EC-003: Token Revoked Mid-Session**
Problem: Admin is revoked via Firebase Console while logged in.
Solution: Next API call or Firestore write fails with 401. Client catches error, shows "Access revoked" message, and forces logout.

**EC-004: Race Condition on Login**
Problem: User submits login, then immediately clicks back and submits again.
Solution: Login button disables on first click, shows spinner. Second click ignored.

**EC-005: Session Hijacking Attempt**
Problem: Attacker steals token from network traffic.
Solution: Firebase tokens are short-lived (1 hour). All traffic is HTTPS-only. Vercel enforces HTTPS. Tokens cannot be refreshed without the original session. Idle timeout (4 hours) limits hijack window.

## Testing Requirements

### Unit Tests
- [ ] `useAuth()` composable returns correct auth state
- [ ] Admin role check correctly parses `adminUserIds` array
- [ ] Token refresh triggers before expiry
- [ ] Logout clears all local state

### Integration Tests
- [ ] Valid login redirects to dashboard
- [ ] Invalid login shows error message
- [ ] Non-admin login shows unauthorized message
- [ ] Protected route redirects to login when unauthenticated
- [ ] Intended destination preserved in redirect query param
- [ ] Logout clears auth state and redirects to login

### E2E Tests
- [ ] Full login → navigate dashboard → logout flow
- [ ] Login attempt with disabled account
- [ ] Login attempt with wrong password (3x) triggers rate limit
- [ ] Session persists across page refresh
- [ ] Session expires after 4 hours idle time

### Security Tests
- [ ] Direct Firestore write rejected without auth
- [ ] Direct Firestore write rejected for non-admin
- [ ] API route rejects request without token
- [ ] API route rejects request with invalid token
- [ ] API route rejects request from non-admin

## Future Enhancements (Post-v1.1)

- Google Sign-In (Firebase Auth provider)
- Apple Sign-In (Firebase Auth provider)
- Multi-factor authentication (SMS or authenticator app)
- Session device management (view active sessions, revoke remotely)
- Login activity audit trail (track login times, IPs, devices)
