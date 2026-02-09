---
id: build-001-spec-app-layout
title: "App Layout Build Spec"
description: "Gap analysis for sidebar navigation, COMPASS branding, and responsive app shell"
type: build
subtype: build-spec
status: draft
sequence: 4
tags: [build, spec, layout, navigation]
relatesTo: ["builds/001-mvp/config.md", "specs/012-pages_dashboard.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# App Layout Build Spec

## What We Need

The dashboard spec (012-pages_dashboard.md) and queue task T-004 describe the app shell that wraps every authenticated page:

- **Fixed sidebar** on the left with COMPASS logo, 7 navigation links (Dashboard, Users, Duty Days, Coverage, Stipends, Reports, Settings), user avatar + name at bottom, and a logout button
- **Collapsible on tablet** (768-1023px) -- hamburger icon toggles sidebar visibility, sidebar overlays content when open
- **Responsive content area** fills remaining width, scrolls independently from sidebar
- **COMPASS branding** -- navy primary (#0A2D8C), accent teal (#39D2C0), Inter font, COMPASS logo SVG
- **Active route highlighting** -- current page's nav item gets primary background color
- **Admin layout** used by all pages except `/login` and `/forgot-password` (which use a public/centered layout)

## What Nuxt 4 Provides

- **Layouts system** -- `layouts/default.vue` wraps all pages automatically unless a page specifies `definePageMeta({ layout: 'public' })`
- **`<NuxtLink>`** component with automatic active class (`router-link-active`, `router-link-exact-active`) for current route highlighting
- **`<NuxtPage>`** renders the matched page inside a layout's `<slot />`
- **Tailwind CSS** (from T-001) provides responsive utilities, flex/grid, color classes mapped to design tokens

## The Gap

1. **`layouts/default.vue`** -- the admin shell with sidebar + content area flex layout. Sidebar is fixed-width (256px on desktop), content area fills the rest.
2. **`components/layout/Sidebar.vue`** -- the navigation sidebar component with logo, nav items, user info, and logout
3. **`layouts/public.vue`** -- centered card layout for login/forgot-password pages (no sidebar)
4. **COMPASS logo** -- SVG file at `public/logo.svg` (or inline SVG component)
5. **Responsive toggle logic** -- composable or component state for sidebar open/closed on tablet screens

## Component Mapping

| File | Type | Purpose |
|------|------|---------|
| `layouts/default.vue` | Layout | Admin shell: sidebar + main content |
| `layouts/public.vue` | Layout | Centered card layout for auth pages |
| `components/layout/Sidebar.vue` | Component | Navigation sidebar with branding |
| `components/layout/PageHeader.vue` | Component | Reusable page header (title + actions) |
| `public/logo.svg` | Static asset | COMPASS logo |

### Sidebar.vue Props and Structure

```vue
<template>
  <aside class="fixed left-0 top-0 h-dvh w-64 bg-primary-dark flex flex-col">
    <!-- Logo section -->
    <div class="p-6 flex items-center gap-3">
      <img src="/logo.svg" alt="COMPASS" class="w-8 h-8" />
      <span class="text-white font-semibold text-lg">COMPASS</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 space-y-1">
      <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/10"
        active-class="bg-white/20 text-white font-medium">
        <component :is="item.icon" class="w-5 h-5" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <!-- User footer -->
    <div class="p-4 border-t border-white/10">
      <div class="flex items-center gap-3">
        <img :src="currentUser?.photoURL || '/default-avatar.png'"
          class="w-9 h-9 rounded-full" />
        <span class="text-white/80 text-sm truncate">
          {{ currentUser?.displayName }}
        </span>
      </div>
      <button @click="logout" class="mt-3 text-white/50 hover:text-white text-sm">
        Logout
      </button>
    </div>
  </aside>
</template>
```

### Navigation Items

```typescript
const navItems = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboardIcon },
  { to: '/users',     label: 'Users',     icon: UsersIcon },
  { to: '/duty-days', label: 'Duty Days', icon: CalendarIcon },
  { to: '/coverage',  label: 'Coverage',  icon: GridIcon },
  { to: '/stipends',  label: 'Stipends',  icon: DollarSignIcon },
  { to: '/reports',   label: 'Reports',   icon: BarChartIcon },
  { to: '/settings',  label: 'Settings',  icon: SettingsIcon },
]
```

### default.vue Layout

```vue
<template>
  <div class="flex min-h-dvh bg-neutral-bg">
    <Sidebar :open="sidebarOpen" @toggle="sidebarOpen = !sidebarOpen" />
    <main class="flex-1 ml-0 lg:ml-64 p-6 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>
```

## Data Requirements

- **`useAuth()` composable** provides `currentUser` and `logout()` to the sidebar (from T-002)
- No Firestore queries in the layout itself -- sidebar is purely navigational

## Implementation Notes

- **Icon library** -- use Lucide Vue (`lucide-vue-next`) for icons. It's tree-shakeable and has all the icons needed (LayoutDashboard, Users, Calendar, Grid, DollarSign, BarChart, Settings). Install: `pnpm add lucide-vue-next`.
- **Tablet collapsible sidebar** -- on screens < 1024px, sidebar starts hidden. A hamburger button in the top-left of the main content area toggles it. When open on tablet, sidebar overlays content with a backdrop. Clicking backdrop or a nav link closes it.
- **Active route matching** -- use `NuxtLink`'s `exact-active-class` for the dashboard (/) and `active-class` for all others. This prevents the dashboard link from highlighting when on `/users`.
- **Dark sidebar, light content** -- sidebar uses `bg-primary-dark` (#061B5A) with white text. Content area uses `bg-neutral-bg` (#F1F4F8). This matches COMPASS brand guidelines.
- **dvh units** -- sidebar height uses `h-dvh` (not `h-screen`) to handle mobile browser chrome correctly, per the technical spec.
- **Scroll behavior** -- main content scrolls independently from the sidebar. Sidebar itself does not scroll (7 nav items fit comfortably).

## Dependencies

- **T-001 (Project scaffolding)** -- Tailwind configured with COMPASS design tokens
- **T-002 (Firebase Auth)** -- `useAuth()` composable provides currentUser and logout for sidebar footer
- Lucide Vue icons package installed
