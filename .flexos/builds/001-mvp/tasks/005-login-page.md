---
id: build-001-task-005
title: "Login Page"
description: "Polished login page with COMPASS branding, email/password form, error handling, forgot password flow, and redirect support"
type: build
subtype: task
status: pending
sequence: 5
tags: [build, task, auth, login]
relatesTo: ["specs/011-pages_login.md", "specs/002-features_authentication-rbac.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 005: Login Page

## Objective

Build the polished login page with COMPASS branding (navy background, centered white card), email/password form with validation, comprehensive error handling for all Firebase Auth error codes, a forgot-password flow via Firebase's `sendPasswordResetEmail`, and redirect support so users land on their intended page after login. This replaces the placeholder login from T-002.

## Prerequisites

- Task 002 (Auth & Route Guards) complete
- `useAuth` composable available with `login`, `logout`, `resetPassword`
- `layouts/public.vue` created (from T-004)
- Firebase Auth email/password provider enabled
- Admin user exists in Firebase Auth

## Steps

### 1. Create the Login Page

Replace `app/pages/login.vue` with the full implementation:

```vue
<template>
  <div class="min-h-screen bg-primary flex items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <!-- Branding -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 mb-4">
          <span class="text-white text-2xl font-bold">C</span>
        </div>
        <h1 class="text-3xl font-semibold text-white tracking-tight">COMPASS</h1>
        <p class="text-white/60 mt-1 text-sm">DFW Airport Interfaith Chaplaincy</p>
      </div>

      <!-- Login Card -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <h2 class="text-xl font-semibold text-neutral-dark mb-6">Admin Login</h2>

        <!-- Error banner -->
        <div
          v-if="error"
          class="mb-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2"
          :class="errorIsWarning ? 'bg-warning/10 text-warning border border-warning/30' : 'bg-error/10 text-error border border-error/30'"
          role="alert"
        >
          <span class="mt-0.5 flex-shrink-0">&#x26A0;</span>
          <span>{{ error }}</span>
        </div>

        <!-- Login form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-neutral-dark mb-1.5">
              Email
            </label>
            <input
              id="email"
              ref="emailInput"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="admin@dfwchaplaincy.org"
              :disabled="loading"
              class="w-full px-4 py-2.5 border border-neutral-light rounded-lg text-neutral-dark
                placeholder:text-neutral-mid/50
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                disabled:opacity-50 disabled:bg-neutral-bg
                transition-colors"
              @input="clearError"
            />
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-neutral-dark mb-1.5">
              Password
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="Enter your password"
                :disabled="loading"
                class="w-full px-4 py-2.5 pr-12 border border-neutral-light rounded-lg text-neutral-dark
                  placeholder:text-neutral-mid/50
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  disabled:opacity-50 disabled:bg-neutral-bg
                  transition-colors"
                @input="clearError"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-mid hover:text-neutral-dark p-1"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
              >
                <span class="text-sm">{{ showPassword ? '&#x25C9;' : '&#x25CE;' }}</span>
              </button>
            </div>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading || !email || !password"
            class="w-full btn-primary py-3 text-base"
          >
            <span v-if="loading" class="flex items-center justify-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Logging in...
            </span>
            <span v-else>Log In</span>
          </button>
        </form>

        <!-- Forgot password -->
        <div class="mt-4 text-center">
          <button
            @click="showForgotPassword = true"
            class="text-sm text-primary hover:text-primary-dark transition-colors"
          >
            Forgot your password?
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-6 flex justify-between items-center text-xs text-white/40">
        <span>COMPASS v1.0</span>
        <a href="mailto:support@dfwaichaplains.org" class="hover:text-white/60 transition-colors">
          Need help?
        </a>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showForgotPassword" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="closeForgotPassword" />
          <div class="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 class="text-lg font-semibold text-neutral-dark mb-2">Reset Password</h2>
            <p class="text-sm text-neutral-mid mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <!-- Reset success message -->
            <div
              v-if="resetSuccess"
              class="mb-4 px-4 py-3 rounded-lg bg-success/10 text-success border border-success/30 text-sm"
              role="status"
            >
              Password reset email sent! Check your inbox.
            </div>

            <form v-if="!resetSuccess" @submit.prevent="handleResetPassword" class="space-y-4">
              <input
                v-model="resetEmail"
                type="email"
                required
                placeholder="Enter your email"
                class="w-full px-4 py-2.5 border border-neutral-light rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <div class="flex gap-2">
                <button
                  type="submit"
                  :disabled="resetLoading || !resetEmail"
                  class="flex-1 btn-primary py-2.5"
                >
                  {{ resetLoading ? 'Sending...' : 'Send Reset Email' }}
                </button>
                <button
                  type="button"
                  @click="closeForgotPassword"
                  class="flex-1 btn-secondary py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>

            <button
              v-else
              @click="closeForgotPassword"
              class="w-full btn-primary py-2.5"
            >
              Back to Login
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'public'
})

const route = useRoute()
const { currentUser, login, resetPassword } = useAuth()

// Form state
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const errorIsWarning = ref(false)
const emailInput = ref<HTMLInputElement | null>(null)

// Forgot password state
const showForgotPassword = ref(false)
const resetEmail = ref('')
const resetLoading = ref(false)
const resetSuccess = ref(false)

// Autofocus email input on mount
onMounted(() => {
  emailInput.value?.focus()
})

// Redirect authenticated users away from login
watchEffect(() => {
  if (currentUser.value) {
    const redirect = route.query.redirect as string || '/'
    navigateTo(redirect)
  }
})

function clearError() {
  error.value = ''
  errorIsWarning.value = false
}

async function handleLogin() {
  clearError()
  loading.value = true

  const result = await login(email.value, password.value)

  loading.value = false

  if (result.success) {
    // Redirect happens via the watchEffect above
    return
  }

  // Handle specific error types
  if (result.error?.includes('not have admin')) {
    errorIsWarning.value = true
  }

  error.value = result.error || 'An unexpected error occurred. Please try again.'

  // Return focus to email input on error
  nextTick(() => {
    emailInput.value?.focus()
  })
}

async function handleResetPassword() {
  resetLoading.value = true

  const result = await resetPassword(resetEmail.value)

  resetLoading.value = false

  if (result.success) {
    resetSuccess.value = true
  } else {
    // Always show success message to prevent email enumeration
    resetSuccess.value = true
  }
}

function closeForgotPassword() {
  showForgotPassword.value = false
  resetEmail.value = ''
  resetSuccess.value = false
}
</script>
```

### 2. Update useAuth Error Messages

If not already done in T-002, ensure `app/composables/useAuth.ts` returns descriptive error messages:

```typescript
// Inside the login function catch block, ensure these cases are handled:
async function login(email: string, password: string) {
  if (!auth) throw new Error('Firebase Auth not initialized')

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    let message = 'An unexpected error occurred. Please try again.'

    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        message = 'Invalid email or password. Please try again.'
        break
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.'
        break
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please wait a few minutes and try again.'
        break
      case 'auth/user-disabled':
        message = 'This account has been disabled. Please contact your administrator.'
        break
      case 'auth/network-request-failed':
        message = 'Unable to connect. Please check your internet connection.'
        break
    }

    return { success: false, error: message }
  }
}
```

### 3. Add Loading Spinner Animation

The spinner uses a Tailwind `animate-spin` class that should work out of the box. Verify that your `tailwind.config.ts` does not override the default animation settings.

### 4. Test Login Flow

Start the dev server:

```bash
pnpm dev
```

**Happy path:**
1. Navigate to `http://localhost:3000/login`
2. Enter admin email and password
3. Click "Log In" -- button shows spinner
4. Redirects to `/` (dashboard)
5. Sidebar shows with user name

**Invalid credentials:**
1. Enter wrong password
2. Click "Log In"
3. Red error banner: "Invalid email or password. Please try again."
4. Form remains editable, focus returns to email

**Empty form submission:**
1. Leave both fields empty
2. Submit button is disabled (cannot click)
3. HTML5 validation fires if somehow submitted

**Password visibility toggle:**
1. Type a password
2. Click the eye icon -- password becomes visible
3. Click again -- password is masked
4. Icon changes to indicate current state

**Forgot password:**
1. Click "Forgot your password?" link
2. Modal opens with email input
3. Enter email, click "Send Reset Email"
4. Success message displays (always, to prevent email enumeration)
5. Click "Back to Login" to close modal

**Already authenticated:**
1. While logged in, manually navigate to `/login`
2. Should immediately redirect to `/` (dashboard)

**Redirect after login:**
1. Log out
2. Manually navigate to `/users`
3. Middleware redirects to `/login?redirect=/users`
4. Log in successfully
5. Redirects to `/users` (not `/`)

### 5. Test Responsive Layout

**Mobile (<768px):**
1. Login card fills screen width (minus 16px padding)
2. Logo scales appropriately
3. Form fields stack properly
4. Submit button is full width, 48px height
5. Footer stacks if needed

**Tablet (768-1023px):**
1. Login card centered, max-width 400px
2. Everything readable at this width

**Desktop (1024px+):**
1. Login card centered vertically and horizontally
2. Navy background fills entire viewport

### 6. Commit

```bash
git add .
git commit -m "feat: add polished login page with branding, error handling, and forgot password"
git push
```

## Acceptance Criteria

- [ ] Login page uses `layout: 'public'` (no sidebar)
- [ ] COMPASS branding: navy background, white "C" logo, "COMPASS" title, organization subtitle
- [ ] Email input has autofocus on page load
- [ ] Password field has show/hide toggle button
- [ ] Submit button is disabled when fields are empty or form is submitting
- [ ] Loading state shows spinner and "Logging in..." text
- [ ] Invalid credentials show red error banner: "Invalid email or password."
- [ ] Too many attempts show: "Too many failed attempts..."
- [ ] Network error shows: "Unable to connect..."
- [ ] Disabled account shows: "This account has been disabled..."
- [ ] Error clears when user types in either input field
- [ ] Focus returns to email input after failed login
- [ ] "Forgot your password?" link opens modal
- [ ] Forgot password modal sends reset email via Firebase
- [ ] Success message always shown (prevents email enumeration)
- [ ] Already-authenticated users redirect away from login page
- [ ] `?redirect=` query param works (login redirects to intended page)
- [ ] Page footer shows "COMPASS v1.0" and "Need help?" mailto link
- [ ] Responsive: card is centered on all screen sizes
- [ ] Touch targets: submit button 48px height, toggle button 44px

## Estimated Time

**0.5 day (4 hours)** including error state testing and responsive verification

## Files Created/Modified

### Created
- None (login page already exists from T-002, this is a full replacement)

### Modified
- `app/pages/login.vue` (complete rewrite with branding and error handling)
- `app/composables/useAuth.ts` (ensure comprehensive error messages)

## Dependencies

**Depends on:** T-002 (Auth & Route Guards)

## Next Task

**T-006: Dashboard page with KPI cards**

After this task, the login experience is complete and polished. Next task builds the real dashboard with live Firestore data.

## Troubleshooting

### Issue: Login page flashes before redirect (already authenticated)
**Solution:** The `watchEffect` with `currentUser` triggers redirect immediately. If there is still a flash, add a `v-if="!currentUser"` wrapper around the entire template.

### Issue: Forgot password always shows success
**Solution:** This is intentional. Showing "email not found" would allow email enumeration attacks. Always display the success message regardless of whether the email exists.

### Issue: Error banner does not disappear
**Solution:** The `clearError` function fires on `@input` for both email and password fields. Verify the event handler is attached correctly.

### Issue: Password toggle does not work
**Solution:** The input `:type="showPassword ? 'text' : 'password'"` binding must be dynamic. Check that `showPassword` ref is toggled correctly.

## Notes

- The login page uses Unicode characters for icons as temporary placeholders. Replace with proper SVG icons (Heroicons or Lucide) in a polish pass.
- The forgot password flow shows success regardless of email existence. This is a security best practice to prevent email enumeration.
- Firebase Auth error codes changed in v9+. The `auth/invalid-credential` code covers both wrong password and user not found in newer SDK versions.
- The `Teleport` directive moves the forgot password modal to the document body, preventing z-index issues with the page layout.
