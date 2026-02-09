---
id: build-001-task-001
title: "Project Scaffolding"
description: "Set up Nuxt 4 project with Firebase integration and Vercel deployment"
type: build
subtype: task
status: pending
sequence: 1
tags: [build, task, setup]
relatesTo: ["builds/001-mvp/build-spec/001-project-setup.md", "docs/core/007-technical.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 001: Project Scaffolding

## Objective

Initialize a fresh Nuxt 4 project with all required dependencies, Firebase configuration, design tokens, and initial Vercel deployment. This establishes the foundation for all subsequent development.

## Prerequisites

- Node.js 18+ installed
- pnpm package manager installed (`npm install -g pnpm`)
- Git installed
- GitHub account
- Vercel account
- Firebase account

## Steps

### 1. Initialize Nuxt 4 Project

```bash
# Create new Nuxt project
npx nuxi init compass-chaplaincy

# Navigate into directory
cd compass-chaplaincy

# Initialize git (if not already done)
git init
git add .
git commit -m "chore: initial Nuxt 4 scaffold"
```

### 2. Install Dependencies

**Core Firebase packages:**
```bash
pnpm add nuxt-vuefire vuefire firebase firebase-admin
```

**UI and styling:**
```bash
pnpm add -D @nuxtjs/tailwindcss @nuxtjs/google-fonts
```

**Data and utilities:**
```bash
pnpm add @tanstack/vue-table date-fns papaparse
```

**TypeScript (should already be included):**
```bash
pnpm add -D typescript @nuxt/types
```

### 3. Configure Nuxt

Edit `nuxt.config.ts`:

```typescript
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    'nuxt-vuefire',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts'
  ],

  vuefire: {
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID
    },
    admin: {
      serviceAccount: process.env.NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT
    }
  },

  googleFonts: {
    families: {
      Inter: [400, 500, 600]
    }
  },

  typescript: {
    strict: true,
    typeCheck: true
  }
})
```

### 4. Configure Tailwind

Create `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './nuxt.config.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2D8C',
          dark: '#061B5A',
          light: '#3B65D9',
        },
        accent: '#39D2C0',
        success: '#249689',
        warning: '#F9CF58',
        error: '#E53E3E',
        neutral: {
          dark: '#14181B',
          mid: '#57636C',
          light: '#E0E3E7',
          bg: '#F1F4F8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

### 5. Create Environment Variables

Create `.env.local` (gitignored):

```bash
# Firebase Client SDK (public)
NUXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NUXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NUXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (server-only)
NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

Create `.env.example` (committed to git):

```bash
# Firebase Client SDK (public)
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-only, JSON string)
NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT=
```

### 6. Configure Vercel

Create `vercel.json`:

```json
{
  "framework": "nuxt",
  "buildCommand": "nuxt build",
  "outputDirectory": ".output",
  "installCommand": "pnpm install",
  "env": {
    "NUXT_PUBLIC_FIREBASE_API_KEY": "@firebase-api-key",
    "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN": "@firebase-auth-domain",
    "NUXT_PUBLIC_FIREBASE_PROJECT_ID": "@firebase-project-id",
    "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET": "@firebase-storage-bucket",
    "NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "@firebase-messaging-sender-id",
    "NUXT_PUBLIC_FIREBASE_APP_ID": "@firebase-app-id",
    "NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT": "@firebase-admin-sa"
  }
}
```

### 7. Update .gitignore

Ensure `.env.local` is gitignored:

```
.env.local
.output
.nuxt
node_modules
dist
```

### 8. Create Initial Directory Structure

```bash
mkdir -p app/pages
mkdir -p app/components/layout
mkdir -p app/components/dashboard
mkdir -p app/components/users
mkdir -p app/components/duty
mkdir -p app/components/coverage
mkdir -p app/components/stipends
mkdir -p app/composables
mkdir -p app/middleware
mkdir -p app/types
mkdir -p server/api/auth
mkdir -p server/api/users
mkdir -p server/api/stipends
mkdir -p server/api/coverage
mkdir -p server/api/reports
mkdir -p server/api/settings
mkdir -p server/utils
```

### 9. Commit Initial Setup

```bash
git add .
git commit -m "feat: add Firebase integration, Tailwind config, and project structure"
```

### 10. Create GitHub Repository

```bash
# Create repo on GitHub (via web UI or gh CLI)
gh repo create compass-chaplaincy --private

# Push to GitHub
git branch -M main
git remote add origin git@github.com:your-org/compass-chaplaincy.git
git push -u origin main
```

### 11. Deploy to Vercel

**Option A: Vercel CLI**
```bash
# Install Vercel CLI
pnpm add -g vercel

# Login and link project
vercel login
vercel link

# Add environment variables
vercel env add NUXT_PUBLIC_FIREBASE_API_KEY production
vercel env add NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
vercel env add NUXT_PUBLIC_FIREBASE_PROJECT_ID production
vercel env add NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET production
vercel env add NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production
vercel env add NUXT_PUBLIC_FIREBASE_APP_ID production
vercel env add NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT production

# Deploy
vercel --prod
```

**Option B: Vercel Dashboard**
1. Go to vercel.com
2. New Project → Import Git Repository
3. Select `compass-chaplaincy` repo
4. Framework Preset: Nuxt.js (auto-detected)
5. Add environment variables in dashboard
6. Deploy

### 12. Verify Deployment

- Visit the deployed URL (e.g., `compass-chaplaincy.vercel.app`)
- Should see the default Nuxt welcome page
- Check Vercel function logs for any errors

## Acceptance Criteria

- [ ] Nuxt 4 project initialized and runs locally (`pnpm dev`)
- [ ] All dependencies installed (check `package.json`)
- [ ] `nuxt.config.ts` configured with VueFire, Tailwind, Google Fonts
- [ ] `tailwind.config.ts` includes COMPASS design tokens
- [ ] `.env.local` created with Firebase credentials (not committed)
- [ ] `.env.example` created (committed to git)
- [ ] `vercel.json` configured
- [ ] Directory structure created (app/, server/, types/)
- [ ] Git repository initialized with initial commits
- [ ] GitHub repository created and code pushed
- [ ] Vercel project created and deployed successfully
- [ ] Vercel environment variables added
- [ ] Deployment URL loads without errors

## Estimated Time

**4-6 hours** (including Firebase project setup, which is done separately in next task)

## Files Created/Modified

### Created
- `compass-chaplaincy/` (project root)
- `nuxt.config.ts`
- `tailwind.config.ts`
- `vercel.json`
- `.env.local`
- `.env.example`
- `.gitignore` (updated)
- `package.json` (dependencies)
- Directory structure (app/, server/, types/)

### Modified
- None (fresh project)

## Dependencies

**None** -- this is the first task.

## Next Task

**T-002: Firebase Auth + role-based route guards**

After this task, the project will be ready for Firebase integration and authentication setup.

## Troubleshooting

### Issue: `pnpm` not found
**Solution:** Install pnpm globally: `npm install -g pnpm`

### Issue: Vercel deployment fails with "Missing environment variables"
**Solution:** Ensure all Vercel secrets are added in dashboard or via CLI

### Issue: Nuxt dev server won't start
**Solution:** Check `nuxt.config.ts` syntax, ensure all modules are installed

### Issue: Tailwind styles not applying
**Solution:** Verify `@nuxtjs/tailwindcss` is in `modules` array in nuxt.config.ts

## Notes

- Do NOT populate Firebase credentials yet -- that happens in T-002
- The project will not have any pages yet -- just the default Nuxt welcome screen
- Focus on getting the build pipeline working end-to-end
- Vercel preview deployments will be created automatically for all PRs after this
