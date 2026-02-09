---
id: build-001-task-002
title: "Authentication & Route Guards"
description: "Implement Firebase Auth with email/password login and role-based access control"
type: build
subtype: task
status: pending
sequence: 2
tags: [build, task, auth]
relatesTo: ["specs/002-features_authentication-rbac.md", "specs/011-pages_login.md", "builds/001-mvp/reference/002-firebase.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 002: Authentication & Route Guards

## Objective

Implement complete authentication system with Firebase Auth (email/password), role-based access control (admin-only dashboard), route guards, and server-side token verification. After this task, only authenticated admin users can access the dashboard.

## Prerequisites

- Task 001 (Project Scaffolding) complete
- Firebase project created
- Firebase credentials added to `.env.local` and Vercel

## Steps

### 1. Create Firebase Project

**In Firebase Console (https://console.firebase.google.com):**

1. Create new project: `compass-chaplaincy`
2. Disable Google Analytics (not needed for admin dashboard)
3. Wait for project creation (~30 seconds)

**Enable Authentication:**

1. Go to Build → Authentication
2. Click "Get started"
3. Enable Email/Password provider
4. Save

**Create Firestore Database:**

1. Go to Build → Firestore Database
2. Click "Create database"
3. Select "Start in production mode" (we'll add rules next task)
4. Choose location (us-central1 recommended)
5. Enable

**Create Storage Bucket:**

1. Go to Build → Storage
2. Click "Get started"
3. Start in production mode
4. Choose same location as Firestore
5. Enable

**Get Firebase Config:**

1. Go to Project Settings (gear icon)
2. Scroll to "Your apps"
3. Click "Web app" icon (</>)
4. Register app: `COMPASS Dashboard`
5. Copy the config object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "compass-chaplaincy.firebaseapp.com",
  projectId: "compass-chaplaincy",
  storageBucket: "compass-chaplaincy.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**Generate Admin SDK Service Account:**

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file (keep it secure!)
4. Convert to single-line JSON string for env var:

```bash
cat service-account.json | jq -c
# Outputs: {"type":"service_account","project_id":"..."}
```

### 2. Update Environment Variables

Update `.env.local`:

```bash
# Paste values from Firebase config
NUXT_PUBLIC_FIREBASE_API_KEY=AIza...
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=compass-chaplaincy.firebaseapp.com
NUXT_PUBLIC_FIREBASE_PROJECT_ID=compass-chaplaincy
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=compass-chaplaincy.appspot.com
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NUXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Paste single-line JSON from service account
NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

**Also add to Vercel:**

```bash
vercel env add NUXT_PUBLIC_FIREBASE_API_KEY production
# ... (paste value)

vercel env add NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT production
# ... (paste single-line JSON)
```

### 3. Create Firebase Admin Utility

Create `server/utils/firebaseAdmin.ts`:

```typescript
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let adminApp

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT || '{}')

  adminApp = initializeApp({
    credential: cert(serviceAccount)
  })
} else {
  adminApp = getApps()[0]
}

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
```

### 4. Create Auth Composable

Create `app/composables/useAuth.ts`:

```typescript
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'
import type { User } from 'firebase/auth'

export function useAuth() {
  const { currentUser } = useCurrentUser()
  const auth = useFirebaseAuth()
  const db = useFirestore()

  // Admin status check
  const settingsRef = computed(() => db ? doc(db, 'app_settings', 'config') : null)
  const settings = settingsRef.value ? useDocument(settingsRef.value) : { value: null, pending: false }

  const isAdmin = computed(() => {
    if (!currentUser.value || !settings.value) return false
    const adminUserIds = settings.value.adminUserIds || []
    return adminUserIds.includes(currentUser.value.uid)
  })

  // Login function
  async function login(email: string, password: string) {
    if (!auth) throw new Error('Firebase Auth not initialized')

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return { success: true, user: userCredential.user }
    } catch (error: any) {
      console.error('Login error:', error)

      let message = 'Failed to log in. Please try again.'
      if (error.code === 'auth/wrong-password') {
        message = 'Invalid email or password.'
      } else if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.'
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.'
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.'
      }

      return { success: false, error: message }
    }
  }

  // Logout function
  async function logout() {
    if (!auth) return
    await signOut(auth)
    navigateTo('/login')
  }

  // Password reset function
  async function resetPassword(email: string) {
    if (!auth) throw new Error('Firebase Auth not initialized')

    try {
      await sendPasswordResetEmail(auth, email)
      return { success: true }
    } catch (error: any) {
      console.error('Password reset error:', error)
      return { success: false, error: 'Failed to send password reset email.' }
    }
  }

  return {
    currentUser,
    isAdmin,
    loading: computed(() => settings.pending || false),
    login,
    logout,
    resetPassword
  }
}
```

### 5. Create Auth Middleware

Create `app/middleware/auth.global.ts`:

```typescript
export default defineNuxtRouteMiddleware((to) => {
  const { currentUser } = useCurrentUser()

  // Public routes that don't require auth
  const publicRoutes = ['/login']

  // If not authenticated and trying to access protected route
  if (!currentUser.value && !publicRoutes.includes(to.path)) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
```

### 6. Create Server Auth Utility

Create `server/utils/auth.ts`:

```typescript
import { adminAuth, adminDb } from './firebaseAdmin'

export async function verifyAdmin(event: any) {
  const authHeader = event.headers.get('authorization')

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      message: 'No authorization token provided'
    })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    // Verify Firebase token
    const decodedToken = await adminAuth.verifyIdToken(token)

    // Check admin status
    const settingsDoc = await adminDb.doc('app_settings/config').get()
    const adminUserIds = settingsDoc.data()?.adminUserIds || []

    if (!adminUserIds.includes(decodedToken.uid)) {
      throw createError({
        statusCode: 403,
        message: 'Admin access required'
      })
    }

    return decodedToken
  } catch (error: any) {
    if (error.statusCode) {
      throw error // Re-throw createError errors
    }

    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token'
    })
  }
}
```

### 7. Create Auth Verification API Route

Create `server/api/auth/verify.post.ts`:

```typescript
export default defineEventHandler(async (event) => {
  try {
    const decodedToken = await verifyAdmin(event)

    return {
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        isAdmin: true
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
})
```

### 8. Seed Initial Admin User

**In Firebase Console:**

1. Go to Authentication → Users
2. Click "Add user"
3. Enter admin email and password (e.g., `admin@compassdemo.com` / strong password)
4. Save the UID (e.g., `abc123xyz`)

**In Firestore Console:**

1. Go to Firestore Database
2. Create collection: `app_settings`
3. Add document with ID: `config`
4. Add fields:
   - `adminUserIds` (array): `['abc123xyz']` (paste the UID from step 3)
   - `stipendRate` (number): `80`
   - `currentYear` (number): `2026`
5. Save

**Create initial user document:**

1. Create collection: `users`
2. Add document with ID: `abc123xyz` (same as Auth UID)
3. Add fields:
   - `uid` (string): `abc123xyz`
   - `email` (string): `admin@compassdemo.com`
   - `displayName` (string): `Admin User`
   - `role` (string): `admin`
   - `isChaplain` (boolean): `false`
   - `onDuty` (boolean): `false`
   - `createdAt` (timestamp): *click "Set to current timestamp"*
4. Save

### 9. Create Login Page

Create `app/pages/login.vue`:

```vue
<template>
  <div class="min-h-screen bg-neutral-bg flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
      <!-- Logo and branding -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-semibold text-primary">COMPASS</h1>
        <p class="text-neutral-mid mt-2">Chaplaincy Operations Management</p>
      </div>

      <!-- Login form -->
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-neutral-dark mb-1">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="admin@example.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-neutral-dark mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••••••"
          />
        </div>

        <!-- Error message -->
        <div v-if="error" class="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Logging in...' : 'Log In' }}
        </button>
      </form>

      <!-- Forgot password link -->
      <div class="mt-4 text-center">
        <button
          @click="showResetPassword = true"
          class="text-sm text-primary hover:text-primary-dark"
        >
          Forgot password?
        </button>
      </div>

      <!-- Password reset modal (simple version) -->
      <div v-if="showResetPassword" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-xl font-semibold mb-4">Reset Password</h2>
          <input
            v-model="resetEmail"
            type="email"
            placeholder="Enter your email"
            class="w-full px-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
          />
          <div class="flex gap-2">
            <button
              @click="handleResetPassword"
              class="flex-1 bg-primary text-white py-2 rounded-lg"
            >
              Send Reset Email
            </button>
            <button
              @click="showResetPassword = false"
              class="flex-1 bg-neutral-light text-neutral-dark py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { login, resetPassword } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showResetPassword = ref(false)
const resetEmail = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true

  const result = await login(email.value, password.value)

  loading.value = false

  if (result.success) {
    // Redirect to intended page or dashboard
    const redirect = route.query.redirect as string || '/'
    navigateTo(redirect)
  } else {
    error.value = result.error || 'Login failed'
  }
}

async function handleResetPassword() {
  const result = await resetPassword(resetEmail.value)
  if (result.success) {
    alert('Password reset email sent! Check your inbox.')
    showResetPassword.value = false
  } else {
    alert(result.error)
  }
}

// Prevent authenticated users from seeing login page
const { currentUser } = useCurrentUser()
watchEffect(() => {
  if (currentUser.value) {
    navigateTo('/')
  }
})
</script>
```

### 10. Create Placeholder Dashboard Page

Create `app/pages/index.vue`:

```vue
<template>
  <div class="p-8">
    <h1 class="text-3xl font-semibold text-neutral-dark mb-4">Dashboard</h1>
    <p class="text-neutral-mid">Welcome to COMPASS, {{ currentUser?.email }}</p>

    <!-- Admin check -->
    <div v-if="!isAdmin" class="mt-8 bg-warning/10 border border-warning text-warning px-6 py-4 rounded-lg">
      <p class="font-medium">Unauthorized</p>
      <p class="text-sm mt-1">You do not have admin access to this dashboard.</p>
      <button @click="logout" class="mt-4 bg-warning text-white px-4 py-2 rounded-lg text-sm">
        Log Out
      </button>
    </div>

    <!-- Dashboard content placeholder -->
    <div v-else class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-6 rounded-lg shadow">
        <p class="text-neutral-mid text-sm">Total Users</p>
        <p class="text-3xl font-semibold text-neutral-dark mt-2">-</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <p class="text-neutral-mid text-sm">Active Chaplains</p>
        <p class="text-3xl font-semibold text-neutral-dark mt-2">-</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <p class="text-neutral-mid text-sm">On Duty Now</p>
        <p class="text-3xl font-semibold text-neutral-dark mt-2">-</p>
      </div>
      <div class="bg-white p-6 rounded-lg shadow">
        <p class="text-neutral-mid text-sm">New Signups (7d)</p>
        <p class="text-3xl font-semibold text-neutral-dark mt-2">-</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { currentUser, isAdmin, logout } = useAuth()
</script>
```

### 11. Test Authentication Flow

**Start dev server:**
```bash
pnpm dev
```

**Test login:**
1. Go to `http://localhost:3000`
2. Should redirect to `/login` (not authenticated)
3. Enter admin credentials (from step 8)
4. Should redirect to `/` (dashboard)
5. Verify "Welcome to COMPASS, admin@compassdemo.com" appears
6. Verify no "Unauthorized" message (admin check passed)

**Test unauthorized access:**
1. In Firestore, temporarily remove admin UID from `app_settings/config.adminUserIds`
2. Refresh dashboard
3. Should see "Unauthorized" message
4. Add UID back to `adminUserIds`

**Test logout:**
1. Click "Log Out" button (add one temporarily to dashboard)
2. Should redirect to `/login`
3. Trying to visit `/` should redirect back to `/login`

### 12. Deploy and Verify

```bash
git add .
git commit -m "feat: add Firebase Auth, login page, and role-based access control"
git push
```

**Verify Vercel deployment:**
- Visit production URL
- Test login flow
- Verify admin check works

## Acceptance Criteria

- [ ] Firebase project created (Auth, Firestore, Storage enabled)
- [ ] Firebase config added to `.env.local` and Vercel
- [ ] Admin SDK service account added to Vercel
- [ ] `server/utils/firebaseAdmin.ts` created and exports `adminAuth`, `adminDb`
- [ ] `server/utils/auth.ts` created with `verifyAdmin` function
- [ ] `app/composables/useAuth.ts` created with `login`, `logout`, `resetPassword`, `isAdmin`
- [ ] `app/middleware/auth.global.ts` redirects unauthenticated users to `/login`
- [ ] `server/api/auth/verify.post.ts` verifies admin tokens
- [ ] Initial admin user created in Firebase Auth
- [ ] `app_settings/config` document created with `adminUserIds` array
- [ ] `users/{uid}` document created for admin user
- [ ] Login page created at `app/pages/login.vue`
- [ ] Dashboard page created at `app/pages/index.vue` (placeholder)
- [ ] Admin can log in with email/password
- [ ] Non-admin login is rejected (unauthorized message shown)
- [ ] Logout works (clears session, redirects to login)
- [ ] Unauthenticated users are redirected to `/login`
- [ ] Password reset email sends successfully

## Estimated Time

**1 day (8 hours)** including Firebase setup, testing, and deployment verification

## Files Created/Modified

### Created
- `server/utils/firebaseAdmin.ts`
- `server/utils/auth.ts`
- `app/composables/useAuth.ts`
- `app/middleware/auth.global.ts`
- `server/api/auth/verify.post.ts`
- `app/pages/login.vue`
- `app/pages/index.vue`

### Modified
- `.env.local` (Firebase credentials)
- Vercel environment variables (via dashboard or CLI)

## Dependencies

**Depends on:** T-001 (Project Scaffolding)

## Next Task

**T-003: Firestore security rules + collection schemas**

After this task, authentication is complete but Firestore has no security rules yet (all access is open in production mode). Next task secures the database.

## Troubleshooting

### Issue: "Firebase Auth not initialized"
**Solution:** Verify Firebase config in `.env.local` is correct, restart dev server

### Issue: Admin check always fails
**Solution:** Verify admin UID matches between Firebase Auth and `app_settings/config.adminUserIds`

### Issue: Login succeeds but redirects back to login
**Solution:** Check if `middleware/auth.global.ts` is running before auth state hydrates

### Issue: Server-side token verification fails
**Solution:** Verify `NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT` is a valid single-line JSON string

## Notes

- This task establishes the security foundation for the entire app
- All future API routes will use `verifyAdmin(event)` to enforce admin-only access
- Password reset uses Firebase's built-in email templates (can be customized in Firebase Console)
- Admin role is stored in Firestore, not as a custom claim (simpler, easier to modify)
