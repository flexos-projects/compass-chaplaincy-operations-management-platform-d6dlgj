---
id: build-001-task-004
title: "App Layout"
description: "Create responsive app shell with sidebar navigation, COMPASS branding, user avatar, and collapsible tablet mode"
type: build
subtype: task
status: pending
sequence: 4
tags: [build, task, layout, navigation]
relatesTo: ["builds/001-mvp/build-spec/002-auth-route-guards.md", "specs/012-pages_dashboard.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 004: App Layout

## Objective

Build the persistent application shell that wraps all authenticated pages: a sidebar with COMPASS branding, navigation links to all major sections, user avatar with name, a logout button, and responsive behavior that collapses to a hamburger menu on tablet. After this task, every dashboard page renders inside a consistent layout with working navigation.

## Prerequisites

- Task 002 (Auth & Route Guards) complete
- `useAuth` composable available with `currentUser`, `isAdmin`, `logout`
- Tailwind CSS configured with COMPASS design tokens
- Admin user can log in and reach the dashboard

## Steps

### 1. Create the Sidebar Component

Create `app/components/layout/Sidebar.vue`:

```vue
<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-30 flex flex-col bg-primary text-white transition-all duration-300',
      isCollapsed ? 'w-0 -translate-x-full' : 'w-64'
    ]"
  >
    <!-- Logo & Branding -->
    <div class="flex items-center gap-3 px-6 py-5 border-b border-white/10">
      <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg">
        C
      </div>
      <div>
        <h1 class="text-lg font-semibold tracking-tight">COMPASS</h1>
        <p class="text-xs text-white/60">Chaplaincy Operations</p>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-3">
      <ul class="space-y-1">
        <li v-for="item in navItems" :key="item.path">
          <NuxtLink
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(item.path)
                ? 'bg-white/15 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            ]"
            @click="$emit('navigate')"
          >
            <span class="w-5 h-5 flex items-center justify-center text-base">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <!-- User Section -->
    <div class="border-t border-white/10 px-4 py-4">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
          {{ userInitials }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ displayName }}</p>
          <p class="text-xs text-white/50 truncate">{{ currentUser?.email }}</p>
        </div>
      </div>
      <button
        @click="handleLogout"
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <span class="text-base">&#x2190;</span>
        <span>Log out</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
const route = useRoute()
const { currentUser, logout } = useAuth()

defineProps<{
  isCollapsed: boolean
}>()

defineEmits<{
  navigate: []
}>()

const navItems = [
  { path: '/', label: 'Dashboard', icon: '\u25A0' },
  { path: '/users', label: 'Users', icon: '\u263A' },
  { path: '/duty-days', label: 'Duty Days', icon: '\u25CB' },
  { path: '/coverage', label: 'Coverage', icon: '\u25A3' },
  { path: '/stipends', label: 'Stipends', icon: '\u0024' },
  { path: '/reports', label: 'Reports', icon: '\u25B6' },
  { path: '/settings', label: 'Settings', icon: '\u2699' },
]

const displayName = computed(() => {
  if (!currentUser.value) return 'User'
  return currentUser.value.displayName || currentUser.value.email || 'User'
})

const userInitials = computed(() => {
  const name = displayName.value
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
})

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

async function handleLogout() {
  await logout()
}
</script>
```

### 2. Create the Default Layout

Create `app/layouts/default.vue`:

```vue
<template>
  <div class="min-h-screen bg-neutral-bg">
    <!-- Mobile header bar -->
    <header class="lg:hidden fixed top-0 inset-x-0 z-40 bg-primary text-white h-14 flex items-center px-4 shadow-md">
      <button
        @click="sidebarOpen = !sidebarOpen"
        class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10"
        aria-label="Toggle menu"
      >
        <span class="text-xl">&#9776;</span>
      </button>
      <h1 class="ml-3 text-lg font-semibold">COMPASS</h1>
    </header>

    <!-- Overlay (mobile/tablet) -->
    <Transition name="fade">
      <div
        v-if="sidebarOpen && !isDesktop"
        class="fixed inset-0 z-20 bg-black/40"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <Sidebar
      :is-collapsed="!sidebarOpen && !isDesktop"
      @navigate="handleNavigate"
    />

    <!-- Main content -->
    <main
      :class="[
        'transition-all duration-300 min-h-screen',
        isDesktop ? 'ml-64' : 'ml-0',
        'lg:ml-64',
        'pt-14 lg:pt-0'
      ]"
    >
      <div class="p-4 md:p-6 lg:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const sidebarOpen = ref(false)

const isDesktop = ref(false)

function checkDesktop() {
  isDesktop.value = window.innerWidth >= 1024
  if (isDesktop.value) {
    sidebarOpen.value = true
  }
}

function handleNavigate() {
  if (!isDesktop.value) {
    sidebarOpen.value = false
  }
}

onMounted(() => {
  checkDesktop()
  window.addEventListener('resize', checkDesktop)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkDesktop)
})

// Close sidebar on route change (mobile)
const route = useRoute()
watch(() => route.path, () => {
  if (!isDesktop.value) {
    sidebarOpen.value = false
  }
})
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

### 3. Create the Public Layout (Login)

Create `app/layouts/public.vue`:

```vue
<template>
  <div class="min-h-screen bg-neutral-bg">
    <slot />
  </div>
</template>
```

### 4. Update Login Page to Use Public Layout

Edit `app/pages/login.vue` -- add the layout declaration at the top of `<script setup>`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: 'public'
})

// ... rest of existing login code
</script>
```

### 5. Add Global Base Styles

Create `app/assets/css/main.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans text-neutral-dark antialiased;
  }

  /* Prevent zoom on input focus (iOS) */
  input, select, textarea {
    font-size: 16px;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2.5 rounded-lg font-medium
      hover:bg-primary-dark transition-colors
      disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-secondary {
    @apply bg-neutral-light text-neutral-dark px-4 py-2.5 rounded-lg font-medium
      hover:bg-neutral-light/80 transition-colors;
  }

  .card {
    @apply bg-white rounded-xl shadow-sm border border-neutral-light/50 p-6;
  }
}
```

Update `nuxt.config.ts` to include the global CSS:

```typescript
export default defineNuxtConfig({
  // ... existing config

  css: ['~/assets/css/main.css'],

  // ... rest of config
})
```

### 6. Create a Page Header Component

Create `app/components/layout/PageHeader.vue`:

```vue
<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-semibold text-neutral-dark">
        <slot name="title" />
      </h1>
      <p v-if="$slots.subtitle" class="mt-1 text-sm text-neutral-mid">
        <slot name="subtitle" />
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
```

### 7. Verify Layout with Placeholder Pages

Update `app/pages/index.vue` to use the layout properly:

```vue
<template>
  <div>
    <PageHeader>
      <template #title>Dashboard</template>
      <template #subtitle>Welcome back, {{ displayName }}</template>
    </PageHeader>

    <!-- KPI cards placeholder -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div v-for="kpi in kpis" :key="kpi.label" class="card">
        <p class="text-xs font-medium uppercase tracking-wider text-neutral-mid">{{ kpi.label }}</p>
        <p class="text-3xl font-semibold text-neutral-dark mt-2">{{ kpi.value }}</p>
      </div>
    </div>

    <p class="text-neutral-mid">Dashboard content will be built in T-006.</p>
  </div>
</template>

<script setup lang="ts">
const { currentUser } = useAuth()

const displayName = computed(() => {
  if (!currentUser.value) return ''
  const name = currentUser.value.displayName || currentUser.value.email || ''
  return name.split(' ')[0]
})

const kpis = [
  { label: 'Total Chaplains', value: '-' },
  { label: 'On Duty Now', value: '-' },
  { label: 'Encounters (7d)', value: '-' },
  { label: 'New Signups (30d)', value: '-' },
]
</script>
```

### 8. Test Responsive Behavior

Start the dev server and verify:

```bash
pnpm dev
```

**Desktop (1024px+):**
1. Sidebar is always visible on the left (256px wide)
2. Main content has left margin of 256px
3. Navigation items are clickable and highlight the current page
4. User name and email display at the bottom of the sidebar
5. Logout button works

**Tablet (768-1023px):**
1. Sidebar is hidden by default
2. Hamburger menu button appears in the top header bar
3. Clicking hamburger opens sidebar with overlay backdrop
4. Clicking a nav item closes the sidebar
5. Clicking the overlay closes the sidebar

**Mobile (<768px):**
1. Same as tablet behavior
2. Content takes full width
3. Page padding reduces (16px instead of 32px)

### 9. Commit

```bash
git add .
git commit -m "feat: add app layout with sidebar navigation and responsive shell"
git push
```

## Acceptance Criteria

- [ ] `components/layout/Sidebar.vue` renders with COMPASS branding (navy background, "C" logo, "COMPASS" title)
- [ ] Sidebar has 7 navigation items: Dashboard, Users, Duty Days, Coverage, Stipends, Reports, Settings
- [ ] Current page is highlighted in the sidebar (white background, bolder text)
- [ ] User avatar (initials), display name, and email appear at the bottom of the sidebar
- [ ] Logout button in sidebar calls `useAuth().logout()` and redirects to `/login`
- [ ] `layouts/default.vue` wraps all authenticated pages with sidebar + content area
- [ ] `layouts/public.vue` wraps the login page (no sidebar)
- [ ] Login page uses `definePageMeta({ layout: 'public' })`
- [ ] On desktop (1024px+), sidebar is always visible with 256px width
- [ ] On tablet/mobile (<1024px), sidebar is hidden behind hamburger toggle
- [ ] Hamburger button appears in a fixed header bar on mobile
- [ ] Clicking overlay closes the sidebar on mobile
- [ ] Route changes close the sidebar on mobile
- [ ] `PageHeader` component used for consistent page titles
- [ ] Global CSS includes base styles and utility classes (`btn-primary`, `card`)

## Estimated Time

**1 day (8 hours)** including responsive testing across breakpoints

## Files Created/Modified

### Created
- `app/components/layout/Sidebar.vue`
- `app/components/layout/PageHeader.vue`
- `app/layouts/default.vue`
- `app/layouts/public.vue`
- `app/assets/css/main.css`

### Modified
- `nuxt.config.ts` (add global CSS)
- `app/pages/login.vue` (add `layout: 'public'`)
- `app/pages/index.vue` (use PageHeader, placeholder KPIs)

## Dependencies

**Depends on:** T-002 (Auth & Route Guards)

## Next Task

**T-005: Login page**

After this task, the app has a visual shell. Next task polishes the login page with full branding and error handling.

## Troubleshooting

### Issue: Sidebar overlaps content on desktop
**Solution:** Ensure `main` element has `ml-64` (margin-left: 256px) when `isDesktop` is true.

### Issue: Hamburger menu not visible on tablet
**Solution:** Check that the header bar has `lg:hidden` class (hidden on desktop, visible below 1024px).

### Issue: Sidebar flickers on page load
**Solution:** Initialize `isDesktop` on `onMounted` and conditionally show sidebar. Add `transition-all duration-300` for smooth open/close.

### Issue: Navigation links not highlighting correctly
**Solution:** The `isActive` function uses `route.path.startsWith(path)` for nested routes. The root path (`/`) checks for exact match to avoid always being active.

## Notes

- The sidebar uses Unicode characters for icons as placeholders. Replace with an icon library (Heroicons, Lucide) in a later polish pass.
- The `COMPASS` text and "C" logo placeholder should be replaced with the actual COMPASS logo SVG when available.
- The navy color (`#0A2D8C`) is the primary brand color defined in `tailwind.config.ts`.
- The sidebar width (256px / `w-64`) is a common pattern for admin dashboards. Adjust if content feels cramped.
