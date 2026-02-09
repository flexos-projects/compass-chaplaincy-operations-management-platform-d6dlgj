---
id: build-001-spec-login-page
title: "Login Page Build Spec"
description: "Gap analysis for the email/password login page with error handling and forgot password flow"
type: build
subtype: build-spec
status: draft
sequence: 5
tags: [build, spec, auth, login, pages]
relatesTo: ["builds/001-mvp/config.md", "specs/011-pages_login.md", "specs/002-features_authentication-rbac.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Login Page Build Spec

## What We Need

The login page spec (011-pages_login.md) calls for:

- **Centered card layout** on neutral background -- no sidebar, no navigation, just the COMPASS logo and a login form
- **Email input** with autofocus, `autocomplete="email"`, HTML5 email validation
- **Password input** with show/hide toggle (eye icon), `autocomplete="current-password"`
- **Submit button** that shows spinner during authentication, disables during loading
- **Five distinct error states**: invalid credentials, account disabled, too many attempts, network error, and non-admin rejection
- **"Forgot your password?" link** navigating to `/forgot-password`
- **Redirect logic** -- reads `?redirect=` query param, navigates there after successful login (defaults to `/`)
- **Already authenticated check** -- if user has active session, redirect to dashboard immediately (don't show login form)
- **Page footer** with version number and support contact

## What Nuxt 4 Provides

- **File-based routing** -- `pages/login.vue` automatically creates the `/login` route
- **`definePageMeta({ layout: 'public' })`** -- uses the centered layout instead of admin shell
- **`useRoute()`** composable to read `redirect` query param
- **`navigateTo()`** for programmatic navigation after login
- **Tailwind** for form styling, responsive centering, and color tokens

## The Gap

1. **`pages/login.vue`** -- complete login page with form, validation, error display, and loading states
2. **`pages/forgot-password.vue`** -- simple form with email input, calls `sendPasswordResetEmail()`, shows success message regardless of whether email exists (prevents enumeration)
3. **Error message mapping** -- translate Firebase Auth error codes to user-friendly messages

## Component Mapping

| File | Type | Purpose |
|------|------|---------|
| `pages/login.vue` | Page | Login form with COMPASS branding |
| `pages/forgot-password.vue` | Page | Password reset request form |

### Login Page Structure

```vue
<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { login } = useAuth()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

async function handleSubmit() {
  loading.value = true
  error.value = null
  try {
    await login(email.value, password.value)
    // useAuth.login() handles admin check internally
    const redirect = (route.query.redirect as string) || '/'
    await navigateTo(redirect)
  } catch (e: any) {
    error.value = mapFirebaseError(e.code)
  } finally {
    loading.value = false
  }
}
</script>
```

### Error Code Mapping

```typescript
function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact your administrator.'
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again in a few minutes.'
    case 'not-admin':
      return 'Access denied. This account does not have admin privileges.'
    default:
      return 'Unable to connect. Please check your internet connection and try again.'
  }
}
```

### Form Layout (Tailwind)

```html
<!-- Centered card on neutral background -->
<div class="min-h-dvh flex items-center justify-center bg-neutral-bg px-4">
  <div class="w-full max-w-[400px] bg-white rounded-xl shadow-sm p-8">
    <!-- Logo + branding -->
    <div class="text-center mb-8">
      <img src="/logo.svg" alt="COMPASS" class="w-[200px] mx-auto mb-3" />
      <p class="text-neutral-mid text-sm">DFW Airport Interfaith Chaplaincy</p>
      <h1 class="text-2xl font-bold text-primary mt-2">Admin Login</h1>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- Error banner -->
      <!-- Email input -->
      <!-- Password input with toggle -->
      <!-- Submit button with loading spinner -->
    </form>

    <!-- Forgot password link -->
    <NuxtLink to="/forgot-password"
      class="block text-center text-sm text-primary-light mt-4">
      Forgot your password?
    </NuxtLink>
  </div>
</div>
```

## Data Requirements

- No Firestore queries on the login page itself
- `useAuth().login()` internally calls `signInWithEmailAndPassword()` and then checks `app_settings/config.adminUserIds`
- If the user authenticates successfully but is not an admin, the composable should throw an error with code `'not-admin'` so the login page can display the correct message

## Implementation Notes

- **Autofocus on email field** -- use `autofocus` attribute on the email input. Works on initial page load. On error, focus returns to the email field via `emailRef.value?.focus()`.
- **Password show/hide toggle** -- toggles input `type` between `password` and `text`. The eye icon button needs `aria-label="Show password"` / `"Hide password"` and must be keyboard-accessible (Enter/Space to toggle).
- **Submit on Enter** -- wrapping inputs in a `<form>` with `@submit.prevent` handles this natively. No extra keydown listeners needed.
- **Loading state disables everything** -- both input fields and the submit button disable during the auth call. This prevents double-submission and field editing mid-request.
- **Non-admin logout** -- when the error is `not-admin`, show a "Logout" button alongside the error message. Clicking it calls `signOut()` and clears the session so the user can try a different account.
- **Already logged in redirect** -- in `onMounted`, check if `useCurrentUser().value` exists. If authenticated, call `navigateTo('/')` immediately. This prevents an already-logged-in admin from seeing the login form.
- **Prevent font-size zoom on iOS** -- set email and password input font-size to 16px minimum. iOS Safari zooms the viewport when focusing an input with font-size < 16px.
- **Accessibility** -- form uses `<form role="form" aria-label="Admin login form">`, error messages use `role="alert"`, and the tab order follows: email, password, show/hide toggle, submit, forgot password link.

## Dependencies

- **T-002 (Firebase Auth)** -- `useAuth()` composable with `login()`, `logout()`, and admin verification
- **T-004 (App Layout)** -- `layouts/public.vue` provides the centered card layout
- COMPASS logo SVG at `public/logo.svg`
