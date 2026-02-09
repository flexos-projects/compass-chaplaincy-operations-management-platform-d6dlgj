---
id: build-001-spec-final-hardening
title: "Final Hardening Build Spec"
description: "Gap analysis for chat monitoring, settings page, and production hardening"
type: build
subtype: build-spec
status: draft
sequence: 12
tags: [build, spec, chat, settings, hardening]
relatesTo: ["builds/001-mvp/config.md", "specs/008-features_chat-monitoring.md", "specs/009-features_settings-configuration.md", "specs/017-pages_settings.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Final Hardening Build Spec

## What We Need

T-012 bundles three distinct deliverables into the final MVP task: chat monitoring (read-only), settings page, and production hardening across all pages.

### Chat Monitoring (`/chats`)

Read-only admin view of chaplain-to-chaplain conversations from the mobile app. The data already exists in Firestore (`chats` and `chat_messages` collections) -- this feature surfaces it.

**Chat thread list** -- Scrollable list sorted by `lastMessageTime` desc. Each card shows participant avatars + names, last message preview (80 chars), relative timestamp, last sender badge. Search by participant name. Paginated at 25 threads with infinite scroll.

**Chat detail view** -- Vertical message list (newest at bottom). Message bubbles with sender name/avatar, text content, inline image/video attachments, day separator headers. Fixed blue banner: "You are viewing this conversation in read-only mode." Load last 50 messages, cursor-based "Load earlier" pagination. Absolutely no send capability -- no input field, no send button.

**Chat activity metrics** -- Summary at top of page: total threads, active chats (7d), total messages (30d), top 3 most active chaplains.

### Settings Page (`/settings`)

Centralized configuration replacing the original app's hardcoded values and device-local SharedPreferences.

**Stipend configuration section** -- Base stipend rate (number input, $10-$500 range, default $80), adjustment limits (min/max).

**Admin users section** -- Table of current admins (name, email, UID, remove button). Add admin by UID with user lookup validation. Last-admin-removal protection. Confirmation modals for add/remove.

**Program settings** -- Program year (number, 2020-2030), organization name (text, max 100), support email (optional).

**Display preferences** -- Default avatar URL (optional, with preview), idle logout timeout (1-24 hours).

**Save/discard/reset footer** -- Save writes to `app_settings/config` via server route with audit logging. Discard reverts to last saved. Reset to defaults with confirmation.

### Production Hardening

Systematic pass across all 10+ pages to ensure production readiness:

- Loading skeletons on every page and section
- Empty states with actionable messages on every data list
- Error boundaries on every composable with retry UI
- Responsive QA: all pages tested at 768px (tablet) and 1024px+ (desktop)
- Deploy Firestore composite indexes (`firebase deploy --only firestore:indexes`)
- Verify all security rules are deployed and tested

## What Nuxt 4 Provides

- VueFire `useCollection` for chat threads and messages (read-only listeners)
- VueFire `useDocument` for `app_settings/config` (real-time settings sync)
- Nuxt server API routes for settings update with Firebase Admin SDK
- Built-in error handling (`createError`, `showError`)
- Tailwind responsive utilities for QA pass

## The Gap

### Chat Monitoring (New)
1. **Chat thread list page** -- No chat UI exists. Need thread list with search, infinite scroll, participant display
2. **Chat detail view** -- Message bubble layout, day separators, inline media, cursor-based older-message loading
3. **Media viewer** -- Lightbox for images, HTML5 video player for videos (Firebase Storage URLs)
4. **Chat metrics** -- Aggregation queries for total threads, active chats, message counts, most active chaplains

### Settings Page (New)
1. **Settings form** -- Multi-section form bound to single Firestore document
2. **Admin user management** -- UID-based add/remove with user lookup, last-admin protection
3. **Server route** -- `POST /api/settings/update` with validation, batch write (settings + audit entry)
4. **Real-time sync** -- Settings changes propagate to all admin sessions via VueFire listener

### Production Hardening (Retrofit)
1. **Loading states** -- Add skeleton UI to any page/section missing it
2. **Empty states** -- Add meaningful empty messages to every data list (duty logs, coverage grid, stipend list, reports, users, chats)
3. **Error handling** -- Wrap every composable's Firestore operations in try/catch with user-facing error messages
4. **Responsive verification** -- Test every page at tablet breakpoint, fix any layout issues
5. **Index deployment** -- Compile all composite indexes into `firestore.indexes.json` and deploy

## Component Mapping

### Chat Pages
- `pages/chats/index.vue` -- Thread list with search + metrics summary
- `pages/chats/[id].vue` -- Message detail view with read-only banner

### Chat Components
- `components/chats/ChatThreadList.vue` -- Infinite-scroll list of thread cards. Props: `threads[]`, `searchQuery`. Emits: `@select(chatId)`, `@load-more()`.
- `components/chats/ChatThreadCard.vue` -- Single thread card with avatars, preview, timestamp. Props: `thread`.
- `components/chats/ChatMessageList.vue` -- Vertical message bubbles with day separators. Props: `messages[]`, `hasMore`. Emits: `@load-earlier()`.
- `components/chats/ChatMessageBubble.vue` -- Single message with sender info, text, media. Props: `message`, `isCurrentUser` (for left/right alignment based on participant A/B).
- `components/chats/ChatMetricsSummary.vue` -- Top-of-page stats cards. Props: `totalThreads`, `activeChats`, `recentMessages`, `topChaplains`.
- `components/chats/MediaViewer.vue` -- Lightbox for images, inline player for videos. Props: `type`, `url`, `caption`.

### Settings Page
- `pages/settings.vue` -- Multi-section settings form with sticky save footer

### Settings Components
- `components/settings/StipendConfigSection.vue` -- Base rate + adjustment limits inputs.
- `components/settings/AdminUsersSection.vue` -- Admin table + add admin form + modals.
- `components/settings/ProgramSettingsSection.vue` -- Program year + org name + support email.
- `components/settings/DisplayPreferencesSection.vue` -- Default avatar URL + idle timeout.

### Composables
- `composables/useChats.ts` -- VueFire queries on `chats` collection (sorted by `lastMessageTime` desc, paginated at 25). Returns: `threads`, `loading`, `searchQuery`, `search()`, `loadMore()`.
- `composables/useChatDetail.ts` -- VueFire query on `chat_messages` subcollection for a specific chat. Returns: `messages`, `loading`, `hasMore`, `loadEarlier()`. Cursor-based pagination using `createdAt`.
- `composables/useSettings.ts` -- VueFire `useDocument` on `app_settings/config`. Returns: `settings`, `loading`, `saveSettings(updates)`, `addAdmin(uid)`, `removeAdmin(uid)`.

### Server Routes
- `server/api/settings/update.post.ts` -- Verify admin, validate fields, read current settings, batch write (update `app_settings/config` + create `audit_log` entry with before/after diff), return updated settings.

## Data Requirements

### Firestore Collections (Read Only -- Chat)
- **chats** -- Thread metadata with `userA`, `userB`, `userAName`, `userBName`, `lastMessage`, `lastMessageTime`, `lastSenderId`. Query: `orderBy('lastMessageTime', 'desc')`, limit 25 per page.
- **chat_messages** -- Individual messages with `chatId`, `senderId`, `text`, `imageUrl`, `videoUrl`, `createdAt`. Query: `where('chatId', '==', id)`, `orderBy('createdAt', 'desc')`, limit 50.

### Firestore Collections (Read/Write -- Settings)
- **app_settings** -- Single document `config`. Updated via server route only.

### Indexes
- `chats`: (`lastMessageTime` DESC) -- thread list sorting
- `chat_messages`: (`chatId`, `createdAt` DESC) -- message pagination

### Index Deployment (All Collections)
Compile all composite indexes accumulated from T-003 through T-012 into `firestore.indexes.json`:
- duty_logs: multiple composite indexes for period/paid/approved filters
- chaplain_payouts: month/year and year filters
- chaplain_metrics: date/terminal/chaplain filters
- audit_log: target/action/date filters
- chats: lastMessageTime
- chat_messages: chatId + createdAt

Deploy: `firebase deploy --only firestore:indexes`

## Implementation Notes

**Chat message structure.** Messages may have `imageUrl` and/or `videoUrl` fields from the chaplain mobile app. Render images inline (max 300px wide) with click-to-lightbox. Render video as thumbnail with play icon. If the Firebase Storage URL returns 404 (expired token or deleted), show "Media no longer available" placeholder.

**Chat search is name-only.** Search filters by participant display name (`userAName` or `userBName` contains search term). Full-text message search requires an external search service (Algolia) -- explicitly deferred to v1.1.

**Settings form dirty state.** Track which fields have been modified since last save. Enable "Save Changes" button only when at least one field differs from the stored value. "Discard Changes" resets all fields to the VueFire-provided current values.

**Last admin protection.** The `removeAdmin()` function in `useSettings` must check `settings.adminUserIds.length > 1` before allowing removal. The server route independently validates this (defense in depth).

**Self-removal warning.** If the current admin's UID matches the UID being removed, show a special confirmation: "You are removing yourself. You will lose access immediately." On confirm, remove the UID, then redirect to `/login`.

**Production hardening checklist.** Systematic pass through every page:
1. Force `loading = true` state and verify skeleton renders
2. Clear test data and verify empty state renders
3. Simulate network error and verify error state renders with retry
4. Resize to 768px and verify no layout breaks
5. Test keyboard navigation on all interactive elements
6. Verify all links and navigation targets are correct

## Dependencies

- **T-010 (Reports)** -- Reports page must be complete before hardening QA pass
- **T-011 (Audit Log)** -- `createAuditEntry` utility must exist for settings update route
- **T-003 (Firestore Rules)** -- `chats` and `chat_messages` readable by authenticated users, `app_settings` writable by admins

## Estimated Effort

- Chat monitoring (2 pages + 6 components + 2 composables): **10 hours**
- Settings page (1 page + 4 components + 1 composable + server route): **8 hours**
- Production hardening (loading/empty/error states across all pages): **6 hours**
- Responsive QA pass: **4 hours**
- Firestore index compilation and deployment: **2 hours**
- Final integration testing: **4 hours**

**Total: ~34 hours (4-5 days)**
