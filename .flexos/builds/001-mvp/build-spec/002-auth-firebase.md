---
id: build-001-spec-auth-firebase
title: "Firebase Auth Build Spec"
description: "Gap analysis for Firebase Auth integration with role-based route guards"
type: build
subtype: build-spec
status: draft
sequence: 2
tags: [build, spec, auth, firebase]
relatesTo: ["builds/001-mvp/config.md", "specs/002-features_authentication-rbac.md", "specs/011-pages_login.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Firebase Auth Build Spec

## What We Need

The authentication spec (002-features_authentication-rbac.md) calls for:

- **Firebase Auth with email/password** as the sole provider for v1
- **Binary admin role model** -- user is either in `app_settings.adminUserIds` or they have no dashboard access
- **Client-side route guard** (`middleware/auth.global.ts`) that redirects unauthenticated users to `/login?redirect={path}`
- **Server-side token verification** on every API route via Firebase Admin SDK
- **Session management** -- auto-refresh tokens, 4-hour idle timeout, secure logout that clears all cached data and detaches Firestore listeners
- **Five error states** for login: invalid credentials, account disabled, too many attempts, network error, and non-admin rejection
- **Forgot password flow** at `/forgot-password` using `sendPasswordResetEmail()`

## What Nuxt 4 Provides

- **nuxt-vuefire module** handles Firebase SDK initialization for both client and server, including SSR-safe auth state management
- **VueFire composables** -- `useCurrentUser()` returns a reactive ref to the current Firebase Auth user, `useFirebaseAuth()` returns the Auth instance
- **File-based routing** means `middleware/auth.global.ts` runs on every navigation automatically
- **Server utilities** via `server/utils/` are auto-imported in all API routes -- a single `verifyAdmin()` helper covers every endpoint
- **Nuxt runtime config** exposes Firebase credentials via `NUXT_PUBLIC_*` env vars to the client and `NUXT_*` vars to the server only

## The Gap

Starting from a blank Nuxt 4 + nuxt-vuefire install, the following must be built:

1. **`composables/useAuth.ts`** -- wraps VueFire's `useCurrentUser()` with COMPASS-specific logic: `isAdmin` computed (checks UID against `app_settings/config.adminUserIds`), `login(email, password)`, `logout()` (calls `signOut()`, clears Pinia stores, navigates to `/login`), and `loading` state
2. **`middleware/auth.global.ts`** -- checks `useCurrentUser().value` on every navigation, redirects to `/login?redirect=` for unauthenticated users, allows public routes (`/login`, `/forgot-password`)
3. **`server/utils/auth.ts`** -- exports `verifyAdmin(event)` that extracts Bearer token from `Authorization` header, calls `adminAuth.verifyIdToken(token)`, fetches `app_settings/config` doc, and throws 401/403 errors if checks fail
4. **`server/utils/firebaseAdmin.ts`** -- initializes Firebase Admin SDK from `NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT` env var, exports `adminAuth` and `adminDb`
5. **Firebase Console setup** -- create project, enable email/password provider, generate service account key

## Component Mapping

| File | Type | Purpose |
|------|------|---------|
| `composables/useAuth.ts` | Composable | Auth state, login/logout, admin check |
| `middleware/auth.global.ts` | Middleware | Route protection, redirect logic |
| `server/utils/auth.ts` | Server utility | Token verification, admin enforcement |
| `server/utils/firebaseAdmin.ts` | Server utility | Admin SDK singleton initialization |

### useAuth Composable API

```typescript
export function useAuth() {
  const currentUser: Ref<User | null>        // from useCurrentUser()
  const isAdmin: ComputedRef<boolean>         // UID in adminUserIds
  const loading: ComputedRef<boolean>         // settings doc pending
  async function login(email: string, password: string): Promise<void>
  async function logout(): Promise<void>
  async function resetPassword(email: string): Promise<void>
}
```

### Server verifyAdmin Pattern

```typescript
// Called at top of every protected API route
export default defineEventHandler(async (event) => {
  const admin = await verifyAdmin(event)  // throws 401/403
  // admin.uid is now available for audit logging
})
```

## Data Requirements

- **`app_settings/config`** document must exist with `adminUserIds: string[]` before first login
- Bootstrap step: manually create this document in Firebase Console with the program director's UID
- The `useAuth` composable reads this document via VueFire's `useDocument()` and caches it for the session

## Implementation Notes

- **Token refresh is automatic** -- Firebase SDK handles refresh every ~50 minutes. No custom code needed.
- **Idle timeout (4 hours)** -- store `lastActivityAt` in memory, check on each navigation in middleware. If stale, force `signOut()` and redirect to login.
- **Error mapping** -- Firebase Auth throws coded errors (`auth/wrong-password`, `auth/user-not-found`, `auth/user-disabled`, `auth/too-many-requests`). Map these to user-friendly messages in the login page, never expose codes to the user.
- **Non-admin path** -- if Firebase auth succeeds but UID is not in `adminUserIds`, show "Access denied" with a logout button. Do NOT redirect to dashboard and then bounce back.
- **SSR considerations** -- `useCurrentUser()` returns `null` during SSR. The auth middleware must handle this by allowing SSR to complete and checking auth state after hydration on the client.

## Dependencies

- **T-001 (Project scaffolding)** must be complete -- nuxt-vuefire installed, Firebase credentials in `.env`
- Firebase project created in Firebase Console with email/password auth enabled
- `app_settings/config` document seeded with at least one admin UID
