---
id: build-001-task-012
title: "Chat Monitoring, Settings Page & Production Hardening"
description: "Build read-only chat monitoring page, system settings page with admin management, and harden all pages with skeletons, empty states, error boundaries, and responsive polish"
type: build
subtype: task
status: pending
sequence: 12
tags: [build, task, chat, settings, hardening, production]
relatesTo: ["builds/001-mvp/build-spec/012-chat-settings-hardening.md", "specs/008-features_chat-monitoring.md", "specs/009-features_settings-configuration.md", "specs/017-pages_settings.md", "specs/023-database_chat-collections.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Task 012: Chat Monitoring, Settings Page & Production Hardening

## Objective

Complete the final MVP feature set and polish. Build the read-only chat monitoring page (thread list + message detail), the system settings page (stipend rate, admin user management, program year, display preferences), and then sweep through all 10 pages to add loading skeletons, empty states, error boundaries, and responsive layout fixes. Deploy Firestore indexes and run a full production QA checklist.

## Prerequisites

- Task 010 (Reports & Export) complete
- Task 011 (Audit Log) complete -- `createAuditEntry()` utility available in `server/utils/audit.ts`
- `chats` and `chat_messages` collections exist in Firestore (populated by the chaplain mobile app)
- `app_settings/config` document exists with at least `adminUserIds` and `baseStipendRate`
- All 10 previous pages built and working

## Steps

### 1. Create Chat Composable

Create `app/composables/useChats.ts`:

```typescript
import { collection, query, orderBy, limit, startAfter, getDocs, doc } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'

export function useChats() {
  const db = useFirestore()

  // All chat threads sorted by most recent message
  const chatsQuery = computed(() =>
    query(collection(db, 'chats'), orderBy('lastMessageTime', 'desc'), limit(50))
  )
  const threads = useCollection(chatsQuery)

  // Search filter
  const searchTerm = ref('')

  const filteredThreads = computed(() => {
    if (!searchTerm.value.trim()) return threads.value || []
    const term = searchTerm.value.toLowerCase()
    return (threads.value || []).filter((thread: any) => {
      const nameA = (thread.userAName || thread.userA || '').toLowerCase()
      const nameB = (thread.userBName || thread.userB || '').toLowerCase()
      return nameA.includes(term) || nameB.includes(term)
    })
  })

  // Selected chat thread
  const selectedChatId = ref<string | null>(null)

  // Messages for selected chat
  const messages = ref<any[]>([])
  const messagesLoading = ref(false)
  const hasMoreMessages = ref(false)
  const lastMessageDoc = ref<any>(null)
  const MESSAGE_PAGE_SIZE = 50

  async function loadMessages(chatId: string, append = false) {
    messagesLoading.value = true
    try {
      const constraints: any[] = [orderBy('createdAt', 'asc')]

      if (append && lastMessageDoc.value) {
        constraints.push(startAfter(lastMessageDoc.value))
      }

      constraints.push(limit(MESSAGE_PAGE_SIZE + 1))

      const q = query(collection(db, `chats/${chatId}/chat_messages`), ...constraints)
      const snap = await getDocs(q)

      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      if (docs.length > MESSAGE_PAGE_SIZE) {
        hasMoreMessages.value = true
        docs.pop()
      } else {
        hasMoreMessages.value = false
      }

      lastMessageDoc.value = snap.docs[snap.docs.length - 1] || null

      if (append) {
        messages.value = [...docs, ...messages.value]
      } else {
        messages.value = docs
      }
    } finally {
      messagesLoading.value = false
    }
  }

  function selectChat(chatId: string) {
    selectedChatId.value = chatId
    messages.value = []
    lastMessageDoc.value = null
    hasMoreMessages.value = false
    loadMessages(chatId)
  }

  function loadEarlierMessages() {
    if (selectedChatId.value && hasMoreMessages.value) {
      loadMessages(selectedChatId.value, true)
    }
  }

  return {
    threads,
    filteredThreads,
    searchTerm,
    selectedChatId,
    messages,
    messagesLoading,
    hasMoreMessages,
    selectChat,
    loadEarlierMessages,
    loading: computed(() => threads.pending?.value ?? false)
  }
}
```

### 2. Create Chat Monitoring Page

Create `app/pages/chats.vue`:

```vue
<template>
  <div class="h-full flex">
    <!-- Thread List (Left Panel) -->
    <div
      :class="[
        'border-r border-neutral-light flex flex-col',
        selectedChatId && isMobile ? 'hidden' : 'w-full md:w-80 lg:w-96'
      ]"
    >
      <div class="p-4 border-b border-neutral-light">
        <h1 class="text-xl font-semibold text-neutral-dark mb-3">Chat Monitoring</h1>
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search by chaplain name..."
          class="w-full px-3 py-2 border border-neutral-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="p-4 space-y-3">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-neutral-light animate-pulse" />
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-neutral-light rounded animate-pulse w-3/4" />
            <div class="h-3 bg-neutral-light rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredThreads.length === 0" class="p-8 text-center text-neutral-mid">
        <svg class="w-12 h-12 mx-auto mb-3 text-neutral-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p v-if="searchTerm" class="text-sm">
          No chats found matching "{{ searchTerm }}".
        </p>
        <p v-else class="text-sm">
          No chat conversations yet. Chaplains will appear here when they start messaging.
        </p>
      </div>

      <!-- Thread list -->
      <div v-else class="flex-1 overflow-y-auto">
        <button
          v-for="thread in filteredThreads"
          :key="thread.id"
          :class="[
            'w-full text-left px-4 py-3 border-b border-neutral-light hover:bg-neutral-bg/50 transition-colors',
            selectedChatId === thread.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
          ]"
          @click="selectChat(thread.id)"
        >
          <div class="flex items-center justify-between mb-1">
            <p class="text-sm font-medium text-neutral-dark truncate">
              {{ thread.userA }} &harr; {{ thread.userB }}
            </p>
            <span class="text-xs text-neutral-mid whitespace-nowrap ml-2">
              {{ formatRelativeTime(thread.lastMessageTime) }}
            </span>
          </div>
          <p class="text-xs text-neutral-mid truncate">
            {{ thread.lastMessage || 'No messages yet' }}
          </p>
        </button>
      </div>
    </div>

    <!-- Message Detail (Right Panel) -->
    <div
      :class="[
        'flex-1 flex flex-col',
        !selectedChatId && isMobile ? 'hidden' : ''
      ]"
    >
      <!-- No selection -->
      <div v-if="!selectedChatId" class="flex-1 flex items-center justify-center text-neutral-mid">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-neutral-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p class="text-sm">Select a conversation to view messages</p>
        </div>
      </div>

      <!-- Selected chat -->
      <template v-else>
        <!-- Read-only banner -->
        <div class="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
          <button
            v-if="isMobile"
            class="mr-2 text-blue-700"
            @click="selectedChatId = null"
          >
            &larr;
          </button>
          <span>&#128274;</span>
          <span>You are viewing this conversation in read-only mode. You cannot send messages or modify this chat.</span>
        </div>

        <!-- Messages loading -->
        <div v-if="messagesLoading && messages.length === 0" class="flex-1 p-4 space-y-4">
          <div v-for="i in 5" :key="i" :class="['flex', i % 2 === 0 ? 'justify-end' : 'justify-start']">
            <div class="max-w-xs space-y-1">
              <div class="h-3 bg-neutral-light rounded animate-pulse w-20" />
              <div class="h-10 bg-neutral-light rounded-lg animate-pulse w-48" />
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div v-else class="flex-1 overflow-y-auto p-4 space-y-3">
          <!-- Load earlier -->
          <div v-if="hasMoreMessages" class="text-center">
            <button
              class="text-sm text-primary hover:text-primary-dark"
              :disabled="messagesLoading"
              @click="loadEarlierMessages"
            >
              {{ messagesLoading ? 'Loading...' : 'Load earlier messages' }}
            </button>
          </div>

          <!-- Empty state -->
          <div v-if="messages.length === 0 && !messagesLoading" class="text-center py-12 text-neutral-mid">
            <p class="text-sm">No messages in this conversation yet.</p>
          </div>

          <!-- Message bubbles -->
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['flex', msg.userId === messages[0]?.userId ? 'justify-start' : 'justify-end']"
          >
            <div
              :class="[
                'max-w-[70%] rounded-lg px-3 py-2',
                msg.userId === messages[0]?.userId
                  ? 'bg-neutral-bg text-neutral-dark'
                  : 'bg-primary text-white'
              ]"
            >
              <p class="text-xs font-medium mb-1 opacity-75">{{ msg.userId }}</p>
              <p v-if="msg.text" class="text-sm whitespace-pre-wrap">{{ msg.text }}</p>
              <img
                v-if="msg.image"
                :src="msg.image"
                alt="Chat image"
                class="mt-2 rounded max-w-full max-h-48 cursor-pointer"
                @click="openMediaViewer(msg.image, 'image')"
              />
              <video
                v-if="msg.video"
                :src="msg.video"
                controls
                class="mt-2 rounded max-w-full max-h-48"
              />
              <p class="text-xs mt-1 opacity-60 text-right">
                {{ formatMessageTime(msg.createdAt) }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Media Viewer (Lightbox) -->
    <div
      v-if="mediaViewerOpen"
      class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      @click.self="mediaViewerOpen = false"
    >
      <button
        class="absolute top-4 right-4 text-white text-2xl hover:text-neutral-light"
        @click="mediaViewerOpen = false"
      >
        &times;
      </button>
      <img
        v-if="mediaViewerType === 'image'"
        :src="mediaViewerUrl"
        alt="Full image"
        class="max-w-full max-h-full rounded-lg"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow, format } from 'date-fns'

const isMobile = ref(false)
onMounted(() => {
  isMobile.value = window.innerWidth < 768
  window.addEventListener('resize', () => { isMobile.value = window.innerWidth < 768 })
})

const {
  filteredThreads, searchTerm, selectedChatId, messages,
  messagesLoading, hasMoreMessages, loading,
  selectChat, loadEarlierMessages
} = useChats()

// Media viewer state
const mediaViewerOpen = ref(false)
const mediaViewerUrl = ref('')
const mediaViewerType = ref<'image' | 'video'>('image')

function openMediaViewer(url: string, type: 'image' | 'video') {
  mediaViewerUrl.value = url
  mediaViewerType.value = type
  mediaViewerOpen.value = true
}

function formatRelativeTime(ts: any): string {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return formatDistanceToNow(date, { addSuffix: true })
}

function formatMessageTime(ts: any): string {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return format(date, 'h:mm a')
}
</script>
```

### 3. Create Settings Composable

Create `app/composables/useSettings.ts`:

```typescript
import { doc, serverTimestamp } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'

interface AppSettings {
  baseStipendRate: number
  adminUserIds: string[]
  programYear: number
  orgName: string
  supportEmail: string
  defaultPhotoUrl: string
  idleLogoutHours: number
  updatedAt: any
  updatedBy: string
}

const DEFAULTS: Omit<AppSettings, 'updatedAt' | 'updatedBy'> = {
  baseStipendRate: 80,
  adminUserIds: [],
  programYear: new Date().getFullYear(),
  orgName: 'DFW Airport Interfaith Chaplaincy',
  supportEmail: '',
  defaultPhotoUrl: '',
  idleLogoutHours: 4
}

export function useSettings() {
  const db = useFirestore()

  const settingsRef = doc(db, 'app_settings', 'config')
  const settingsDoc = useDocument(settingsRef)

  // Editable form state (initialized from Firestore)
  const form = reactive({
    baseStipendRate: DEFAULTS.baseStipendRate,
    programYear: DEFAULTS.programYear,
    orgName: DEFAULTS.orgName,
    supportEmail: DEFAULTS.supportEmail,
    defaultPhotoUrl: DEFAULTS.defaultPhotoUrl,
    idleLogoutHours: DEFAULTS.idleLogoutHours
  })

  // Admin users (separate from the save form)
  const adminUsers = ref<Array<{ uid: string; displayName: string; email: string }>>([])
  const adminLoading = ref(false)

  // Track dirty state
  const isDirty = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Sync form from Firestore on load
  watch(settingsDoc, (doc) => {
    if (!doc) return
    const data = doc as any
    form.baseStipendRate = data.baseStipendRate ?? DEFAULTS.baseStipendRate
    form.programYear = data.programYear ?? DEFAULTS.programYear
    form.orgName = data.orgName ?? DEFAULTS.orgName
    form.supportEmail = data.supportEmail ?? DEFAULTS.supportEmail
    form.defaultPhotoUrl = data.defaultPhotoUrl ?? DEFAULTS.defaultPhotoUrl
    form.idleLogoutHours = data.idleLogoutHours ?? DEFAULTS.idleLogoutHours
    isDirty.value = false
  }, { immediate: true })

  // Mark dirty when form changes
  watch(form, () => { isDirty.value = true }, { deep: true })

  // Save settings via server route
  async function saveSettings() {
    saving.value = true
    error.value = null

    try {
      const token = await useCurrentUser().value?.getIdToken()
      await $fetch('/api/settings/update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          baseStipendRate: form.baseStipendRate,
          programYear: form.programYear,
          orgName: form.orgName,
          supportEmail: form.supportEmail,
          defaultPhotoUrl: form.defaultPhotoUrl,
          idleLogoutHours: form.idleLogoutHours
        }
      })

      isDirty.value = false
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to save settings'
      throw err
    } finally {
      saving.value = false
    }
  }

  // Discard edits (reload from Firestore)
  function discardChanges() {
    const data = settingsDoc.value as any
    if (!data) return
    form.baseStipendRate = data.baseStipendRate ?? DEFAULTS.baseStipendRate
    form.programYear = data.programYear ?? DEFAULTS.programYear
    form.orgName = data.orgName ?? DEFAULTS.orgName
    form.supportEmail = data.supportEmail ?? DEFAULTS.supportEmail
    form.defaultPhotoUrl = data.defaultPhotoUrl ?? DEFAULTS.defaultPhotoUrl
    form.idleLogoutHours = data.idleLogoutHours ?? DEFAULTS.idleLogoutHours
    isDirty.value = false
  }

  // Reset to defaults
  function resetToDefaults() {
    form.baseStipendRate = DEFAULTS.baseStipendRate
    form.programYear = DEFAULTS.programYear
    form.orgName = DEFAULTS.orgName
    form.supportEmail = DEFAULTS.supportEmail
    form.defaultPhotoUrl = DEFAULTS.defaultPhotoUrl
    form.idleLogoutHours = DEFAULTS.idleLogoutHours
    isDirty.value = true
  }

  // Add admin user
  async function addAdmin(uid: string) {
    adminLoading.value = true
    try {
      const token = await useCurrentUser().value?.getIdToken()
      await $fetch('/api/settings/update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { addAdminUid: uid }
      })
    } finally {
      adminLoading.value = false
    }
  }

  // Remove admin user
  async function removeAdmin(uid: string) {
    const currentAdmins = (settingsDoc.value as any)?.adminUserIds || []
    if (currentAdmins.length <= 1) {
      throw new Error('Cannot remove the last admin user. Add another admin before removing yourself.')
    }

    adminLoading.value = true
    try {
      const token = await useCurrentUser().value?.getIdToken()
      await $fetch('/api/settings/update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { removeAdminUid: uid }
      })
    } finally {
      adminLoading.value = false
    }
  }

  return {
    form,
    settingsDoc,
    adminUsers,
    adminLoading,
    isDirty,
    saving,
    error,
    loading: computed(() => settingsDoc.pending?.value ?? false),
    saveSettings,
    discardChanges,
    resetToDefaults,
    addAdmin,
    removeAdmin
  }
}
```

### 4. Create Settings Page

Create `app/pages/settings.vue`:

```vue
<template>
  <div class="p-6 space-y-8 max-w-3xl">
    <h1 class="text-2xl font-semibold text-neutral-dark">Settings</h1>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-6">
      <div v-for="i in 4" :key="i" class="bg-white rounded-lg shadow p-6 space-y-4">
        <div class="h-5 bg-neutral-light rounded animate-pulse w-1/3" />
        <div class="h-10 bg-neutral-light rounded animate-pulse w-full" />
        <div class="h-10 bg-neutral-light rounded animate-pulse w-2/3" />
      </div>
    </div>

    <template v-else>
      <!-- 1. Stipend Configuration -->
      <section class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-neutral-dark mb-4">Stipend Configuration</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-dark mb-1">
              Base stipend rate per qualifying shift
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-mid">$</span>
              <input
                v-model.number="form.baseStipendRate"
                type="number"
                min="10"
                max="500"
                step="0.50"
                class="w-full pl-7 pr-4 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p class="text-xs text-neutral-mid mt-1">
              This rate applies to all future stipend calculations. Past payouts are not affected.
            </p>
          </div>
        </div>
      </section>

      <!-- 2. Admin Users -->
      <section class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-neutral-dark mb-4">Admin Users</h2>

        <!-- Current admins -->
        <div class="space-y-2 mb-4">
          <div
            v-for="uid in ((settingsDoc as any)?.adminUserIds || [])"
            :key="uid"
            class="flex items-center justify-between px-4 py-3 bg-neutral-bg/50 rounded-lg"
          >
            <div>
              <p class="text-sm font-medium text-neutral-dark">{{ uid }}</p>
              <p class="text-xs text-neutral-mid">Firebase UID</p>
            </div>
            <button
              class="text-sm text-error hover:text-error/80"
              :disabled="adminLoading"
              @click="handleRemoveAdmin(uid)"
            >
              Remove
            </button>
          </div>
        </div>

        <!-- Add admin -->
        <div class="flex gap-2">
          <input
            v-model="newAdminUid"
            type="text"
            placeholder="Enter Firebase UID to add admin..."
            class="flex-1 px-3 py-2 border border-neutral-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            :disabled="!newAdminUid.trim() || adminLoading"
            class="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50"
            @click="handleAddAdmin"
          >
            Add Admin
          </button>
        </div>
        <p class="text-xs text-neutral-mid mt-2">
          Enter the Firebase UID of an existing user. Find UIDs on the Users page.
        </p>
      </section>

      <!-- 3. Program Settings -->
      <section class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-neutral-dark mb-4">Program Settings</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-neutral-dark mb-1">
              Program Year
            </label>
            <input
              v-model.number="form.programYear"
              type="number"
              min="2020"
              max="2030"
              class="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p class="text-xs text-neutral-mid mt-1">
              Used for YTD calculations and reporting periods.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-dark mb-1">
              Organization Name
            </label>
            <input
              v-model="form.orgName"
              type="text"
              maxlength="100"
              class="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-dark mb-1">
              Support Contact Email
            </label>
            <input
              v-model="form.supportEmail"
              type="email"
              placeholder="support@example.org"
              class="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-dark mb-1">
              Auto-Logout Timeout (hours)
            </label>
            <input
              v-model.number="form.idleLogoutHours"
              type="number"
              min="1"
              max="24"
              class="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      <!-- 4. Display Preferences -->
      <section class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-neutral-dark mb-4">Display Preferences</h2>

        <div>
          <label class="block text-sm font-medium text-neutral-dark mb-1">
            Default Avatar URL
          </label>
          <input
            v-model="form.defaultPhotoUrl"
            type="url"
            placeholder="https://..."
            class="w-full px-3 py-2 border border-neutral-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div v-if="form.defaultPhotoUrl" class="mt-2">
            <img
              :src="form.defaultPhotoUrl"
              alt="Default avatar preview"
              class="w-12 h-12 rounded-full object-cover border border-neutral-light"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
          </div>
        </div>
      </section>

      <!-- Error message -->
      <div v-if="error" class="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg text-sm">
        {{ error }}
      </div>

      <!-- Action Buttons (Sticky Footer) -->
      <div class="sticky bottom-0 bg-white border-t border-neutral-light px-6 py-4 flex gap-3 shadow-lg -mx-6">
        <button
          :disabled="!isDirty || saving"
          class="px-6 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
        <button
          :disabled="!isDirty"
          class="px-6 py-2 border border-neutral-light rounded-lg text-sm hover:bg-neutral-bg disabled:opacity-50"
          @click="discardChanges"
        >
          Discard Changes
        </button>
        <button
          class="px-6 py-2 text-sm text-error hover:text-error/80"
          @click="confirmReset"
        >
          Reset to Defaults
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const {
  form, settingsDoc, adminLoading, isDirty, saving, error, loading,
  saveSettings, discardChanges, resetToDefaults, addAdmin, removeAdmin
} = useSettings()

const newAdminUid = ref('')

async function handleSave() {
  try {
    await saveSettings()
    alert('Settings saved successfully.')
  } catch {
    // error state is handled by the composable
  }
}

async function handleAddAdmin() {
  const uid = newAdminUid.value.trim()
  if (!uid) return

  if (!/^[a-zA-Z0-9\-_]{20,36}$/.test(uid)) {
    alert('Invalid UID format. Firebase UIDs are 20-36 alphanumeric characters.')
    return
  }

  try {
    await addAdmin(uid)
    newAdminUid.value = ''
    alert('Admin access granted.')
  } catch (err: any) {
    alert(err.data?.message || err.message || 'Failed to add admin.')
  }
}

async function handleRemoveAdmin(uid: string) {
  if (!confirm(`Revoke admin access for ${uid}? They will no longer be able to access the admin dashboard.`)) {
    return
  }

  try {
    await removeAdmin(uid)
    alert('Admin access revoked.')
  } catch (err: any) {
    alert(err.message || 'Failed to remove admin.')
  }
}

function confirmReset() {
  if (confirm('Reset all settings to their default values? This cannot be undone until you save.')) {
    resetToDefaults()
  }
}
</script>
```

### 5. Create Settings Server Route

Create `server/api/settings/update.post.ts`:

```typescript
import { adminDb } from '../../utils/firebaseAdmin'
import { verifyAdmin } from '../../utils/auth'
import { createAuditEntry, computeDiff } from '../../utils/audit'
import { FieldValue } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  const admin = await verifyAdmin(event)
  const body = await readBody(event)

  const configRef = adminDb.doc('app_settings/config')
  const configSnap = await configRef.get()
  const currentSettings = configSnap.data() || {}

  // Handle admin user add/remove separately
  if (body.addAdminUid) {
    const uid = body.addAdminUid
    const currentAdmins: string[] = currentSettings.adminUserIds || []

    if (currentAdmins.includes(uid)) {
      throw createError({ statusCode: 400, message: 'User is already an admin' })
    }

    // Verify user exists
    const userSnap = await adminDb.doc(`users/${uid}`).get()
    if (!userSnap.exists) {
      throw createError({ statusCode: 400, message: 'User not found. Check the UID and try again.' })
    }

    const batch = adminDb.batch()
    batch.update(configRef, {
      adminUserIds: FieldValue.arrayUnion(uid),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid
    })

    await createAuditEntry({
      action: 'admin_add',
      adminId: admin.uid,
      targetId: uid,
      targetCollection: 'users',
      details: {
        summary: `Granted admin access to ${userSnap.data()?.displayName || uid}`
      }
    }, batch)

    await batch.commit()
    return { success: true }
  }

  if (body.removeAdminUid) {
    const uid = body.removeAdminUid
    const currentAdmins: string[] = currentSettings.adminUserIds || []

    if (currentAdmins.length <= 1) {
      throw createError({ statusCode: 400, message: 'Cannot remove the last admin user. Add another admin first.' })
    }

    if (!currentAdmins.includes(uid)) {
      throw createError({ statusCode: 400, message: 'User is not an admin' })
    }

    const batch = adminDb.batch()
    batch.update(configRef, {
      adminUserIds: FieldValue.arrayRemove(uid),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid
    })

    await createAuditEntry({
      action: 'admin_remove',
      adminId: admin.uid,
      targetId: uid,
      targetCollection: 'users',
      details: {
        summary: `Revoked admin access for ${uid}`
      }
    }, batch)

    await batch.commit()
    return { success: true }
  }

  // Handle general settings update
  const allowedFields = [
    'baseStipendRate', 'programYear', 'orgName',
    'supportEmail', 'defaultPhotoUrl', 'idleLogoutHours'
  ]

  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  // Validate stipend rate
  if (updates.baseStipendRate !== undefined) {
    const rate = Number(updates.baseStipendRate)
    if (isNaN(rate) || rate <= 0) {
      throw createError({ statusCode: 400, message: 'Stipend rate must be a positive number' })
    }
    if (rate > 500) {
      throw createError({ statusCode: 400, message: 'Stipend rate cannot exceed $500' })
    }
    updates.baseStipendRate = rate
  }

  // Validate program year
  if (updates.programYear !== undefined) {
    const year = Number(updates.programYear)
    if (isNaN(year) || year < 2020 || year > 2030) {
      throw createError({ statusCode: 400, message: 'Program year must be between 2020 and 2030' })
    }
    updates.programYear = year
  }

  // Validate org name
  if (updates.orgName !== undefined && updates.orgName.length > 100) {
    throw createError({ statusCode: 400, message: 'Organization name cannot exceed 100 characters' })
  }

  updates.updatedAt = FieldValue.serverTimestamp()
  updates.updatedBy = admin.uid

  const batch = adminDb.batch()
  batch.update(configRef, updates)

  const diff = computeDiff(currentSettings, updates)
  await createAuditEntry({
    action: 'settings_update',
    adminId: admin.uid,
    targetId: 'config',
    targetCollection: 'app_settings',
    details: {
      before: diff.before,
      after: diff.after,
      summary: `Updated settings: ${Object.keys(diff.after).filter(k => k !== 'updatedAt' && k !== 'updatedBy').join(', ')}`
    }
  }, batch)

  await batch.commit()

  return { success: true }
})
```

### 6. Add Loading Skeletons to All Pages

Add loading skeleton patterns to every page that queries data. The pattern uses the `animate-pulse` Tailwind class on placeholder divs:

```vue
<!-- Standard skeleton pattern for list pages -->
<div v-if="loading" class="space-y-3">
  <div v-for="i in 5" :key="i" class="bg-white rounded-lg shadow p-4 flex items-center gap-4">
    <div class="w-10 h-10 rounded-full bg-neutral-light animate-pulse" />
    <div class="flex-1 space-y-2">
      <div class="h-4 bg-neutral-light rounded animate-pulse w-3/4" />
      <div class="h-3 bg-neutral-light rounded animate-pulse w-1/2" />
    </div>
  </div>
</div>

<!-- Standard skeleton for card grids (dashboard KPIs) -->
<div v-if="loading" class="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div v-for="i in 4" :key="i" class="bg-white rounded-lg shadow p-6 space-y-3">
    <div class="h-3 bg-neutral-light rounded animate-pulse w-2/3" />
    <div class="h-8 bg-neutral-light rounded animate-pulse w-1/2" />
  </div>
</div>

<!-- Standard skeleton for tables -->
<div v-if="loading" class="bg-white rounded-lg shadow overflow-hidden">
  <div class="px-4 py-3 bg-neutral-bg">
    <div class="h-4 bg-neutral-light rounded animate-pulse w-1/4" />
  </div>
  <div v-for="i in 8" :key="i" class="px-4 py-3 border-t border-neutral-light flex gap-4">
    <div class="h-4 bg-neutral-light rounded animate-pulse w-1/4" />
    <div class="h-4 bg-neutral-light rounded animate-pulse w-1/3" />
    <div class="h-4 bg-neutral-light rounded animate-pulse w-1/6" />
    <div class="h-4 bg-neutral-light rounded animate-pulse w-1/6" />
  </div>
</div>
```

Apply appropriate skeletons to these pages:
- `/dashboard` -- 4 KPI card skeletons + table skeleton
- `/users` -- List skeleton with avatar placeholders
- `/users/[id]` -- Profile card skeleton + detail skeleton
- `/duty-days` -- Bar chart skeleton + table skeleton
- `/coverage` -- Grid skeleton (rows of cells)
- `/stipends` -- List skeleton with expandable rows
- `/reports` -- Card + table skeletons
- `/audit` -- Table skeleton

### 7. Add Empty States to All List Pages

Every page that displays a list must handle the empty case with an icon, message, and optional action:

```vue
<!-- Standard empty state pattern -->
<div v-else-if="items.length === 0" class="text-center py-16">
  <svg class="w-16 h-16 mx-auto mb-4 text-neutral-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <!-- Use appropriate icon per context -->
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
  <p class="text-neutral-mid text-sm mb-1">No data available</p>
  <p class="text-neutral-light text-xs">Data will appear here when it becomes available.</p>
</div>
```

Apply empty states to:
- `/users` -- "No chaplains registered yet."
- `/duty-days` -- "No duty logs found for this period."
- `/coverage` -- (coverage grid always renders, no empty state needed)
- `/stipends` -- "No unpaid shifts for {month} {year}."
- `/reports` -- "No data available for the selected period."
- `/audit` -- "No audit entries found."
- `/chats` -- "No chat conversations yet."

### 8. Add Error Boundaries to All Composables

Wrap all data-fetching logic in composables with try/catch and surface user-friendly errors:

```typescript
// Pattern for composables with error state
export function useSomething() {
  const error = ref<string | null>(null)

  async function fetchData() {
    error.value = null
    try {
      // ... fetch logic
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Something went wrong. Please try again.'
      console.error('fetchData failed:', err)
    }
  }

  return { error, fetchData }
}
```

```vue
<!-- Error display pattern for pages -->
<div v-if="error" class="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg text-sm flex items-center gap-2">
  <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
  <span>{{ error }}</span>
  <button class="ml-auto text-error/70 hover:text-error" @click="error = null">&times;</button>
</div>
```

Add error state to composables:
- `useDutyDays.ts` -- wrap query construction
- `useCoverage.ts` -- wrap `toggleSlot` and document creation
- `useStipends.ts` -- wrap `fetchQualifying` and `processPayouts`
- `useReports.ts` -- wrap export function
- `useChats.ts` -- wrap `loadMessages`
- `useSettings.ts` -- wrap `saveSettings`, `addAdmin`, `removeAdmin`

### 9. Test Responsive Layout on All Pages

Test every page at three viewport widths:

| Viewport | Width | Layout Expectation |
|----------|-------|-------------------|
| Mobile | 375px | Stacked single-column, no sidebar overlap |
| Tablet | 768px | Sidebar visible, content fills remaining space |
| Desktop | 1280px | Spacious layout, multi-column grids |

**Check each page for:**
- Tables: horizontal scroll on narrow viewports, no content cutoff
- Forms: full-width inputs on mobile, labels above inputs
- Cards: stack to single column on mobile
- Modals: centered, properly sized, not clipped by viewport edges
- Sticky footers: visible above mobile safe area, no overlap with sidebar
- Chat page: thread list full-width on mobile, two-panel on tablet+

### 10. Deploy Firestore Indexes

Create or update `firestore.indexes.json` and deploy:

```json
{
  "indexes": [
    {
      "collectionGroup": "audit_log",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "action", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "duty_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isPaid", "order": "ASCENDING" },
        { "fieldPath": "startTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "duty_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "startTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lastMessageTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "chaplain_payouts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "chaplainId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

```bash
firebase deploy --only firestore:indexes
```

### 11. Production QA Checklist

Run through every page manually before declaring MVP complete:

| Page | Loads | Data | Actions | Empty State | Skeleton | Error | Mobile |
|------|-------|------|---------|-------------|----------|-------|--------|
| `/login` | - | - | Login/logout | - | - | Invalid creds | - |
| `/dashboard` | - | KPIs render | Click KPI navigates | No data cards | - | - | - |
| `/users` | - | List renders | Search, filter | No users | - | - | - |
| `/users/[id]` | - | Profile renders | Edit, photo upload | Not found | - | - | - |
| `/duty-days` | - | Logs + chart | Period filter | No logs | - | - | - |
| `/coverage` | - | Grid renders | Toggle cells (edit) | Auto-creates doc | - | - | - |
| `/stipends` | - | Qualifying list | Process payout | No unpaid shifts | - | - | - |
| `/stipends/[id]` | - | Payout detail | Back link | Not found | - | - | - |
| `/reports` | - | Metrics cards | CSV export | No data | - | - | - |
| `/audit` | - | Log entries | Filter, paginate | No entries | - | - | - |
| `/chats` | - | Thread list | Select, scroll | No chats | - | - | - |
| `/settings` | - | Form values | Save, add/remove admin | Defaults | - | - | - |

Mark each cell with a checkmark during testing. Fix any failures before marking T-012 complete.

### 12. Add Navigation Links and Commit

Update sidebar navigation to include:
- "Chats" linking to `/chats`
- "Settings" linking to `/settings`

```bash
pnpm dev
```

Full test cycle, then commit:

```bash
git add .
git commit -m "feat: add chat monitoring, settings page, loading skeletons, empty states, error boundaries, and production hardening"
```

## Acceptance Criteria

- [ ] `/chats` page renders a list of chat threads sorted by most recent message
- [ ] Chat thread list shows participant names, last message preview, and relative timestamp
- [ ] Search input filters threads by participant name
- [ ] Clicking a thread opens the message detail view with chronological messages
- [ ] Read-only banner is always visible in the chat detail view
- [ ] "Load earlier messages" button fetches previous 50 messages (cursor-based pagination)
- [ ] Image attachments display inline; clicking opens a full-screen lightbox viewer
- [ ] No send button, message input, or any write affordance exists in the chat view
- [ ] Mobile chat layout: single-column with back navigation from detail to list
- [ ] `/settings` page loads current values from `app_settings/config`
- [ ] Base stipend rate input validates: positive number, max $500
- [ ] Admin user list shows current admin UIDs with Remove buttons
- [ ] Add Admin validates UID format, checks user exists, adds to `adminUserIds`
- [ ] Remove Admin prevents removing the last admin user
- [ ] All settings changes are audited via `createAuditEntry()` with before/after diff
- [ ] "Save Changes" button is enabled only when form is dirty
- [ ] "Discard Changes" resets form to last saved values
- [ ] Server route `POST /api/settings/update` validates all fields and rejects invalid input
- [ ] Loading skeletons appear on all 10 pages while data is loading
- [ ] Empty states with icon and message appear on all list pages when no data exists
- [ ] Error boundaries catch and display user-friendly error messages on all pages
- [ ] Firestore indexes deployed: `audit_log (action, createdAt)`, `duty_logs (isPaid, startTime)`, `chats (lastMessageTime)`
- [ ] All 12 pages pass manual QA at mobile (375px), tablet (768px), and desktop (1280px) widths

## Estimated Time

**5 days** -- 2 days for chat + settings features, 3 days for hardening and QA sweep

## Files Created/Modified

### Created
- `app/composables/useChats.ts`
- `app/composables/useSettings.ts`
- `app/pages/chats.vue`
- `app/pages/settings.vue`
- `server/api/settings/update.post.ts`
- `firestore.indexes.json`

### Modified
- `app/pages/dashboard.vue` (add loading skeleton, empty states)
- `app/pages/users/index.vue` (add loading skeleton, empty state)
- `app/pages/users/[id].vue` (add loading skeleton, error boundary)
- `app/pages/duty-days.vue` (add loading skeleton, empty state)
- `app/pages/coverage.vue` (add loading skeleton)
- `app/pages/stipends/index.vue` (add loading skeleton, empty state)
- `app/pages/reports.vue` (add loading skeleton, empty state)
- `app/pages/audit.vue` (add loading skeleton, empty state)
- `app/composables/useDutyDays.ts` (add error state)
- `app/composables/useCoverage.ts` (add error state)
- `app/composables/useStipends.ts` (add error state)
- `app/composables/useReports.ts` (add error state)
- Sidebar navigation (add Chats and Settings links)

## Dependencies

**Depends on:** T-010 (Reports & Export), T-011 (Audit Log)

## Notes

- The chat monitoring page is strictly read-only. There is no message input field, no send button, no keyboard shortcut to send messages. The Firestore security rule `allow write: if false` on `chat_messages` provides server-side enforcement.
- The settings server route handles three distinct operations: general settings update, add admin, and remove admin. The `addAdminUid` and `removeAdminUid` fields trigger admin management branches; all other fields trigger the general update path.
- The last-admin safeguard is enforced on both client (composable check) and server (route check). If `adminUserIds` would become empty, the operation is rejected.
- Loading skeletons use the `animate-pulse` Tailwind class on neutral-colored placeholder divs. The skeleton shape should roughly match the content it replaces (circles for avatars, rectangles for text, grids for tables).
- Empty states use an inline SVG icon, a primary message, and a secondary hint. Each page has a context-specific message rather than a generic "No data" string.
- Error boundaries in composables use a `ref<string | null>` pattern. Pages display the error in a styled banner with a dismiss button. The error text comes from the server response when available, with a fallback generic message.
- Firestore composite indexes must be deployed before production use. The `audit_log (action ASC, createdAt DESC)` index is required for the action filter on the audit page. The `duty_logs (isPaid, startTime)` index is required for the stipend qualifying query.
- The production QA checklist is a manual sweep. Every page must be tested at three viewport widths (375px, 768px, 1280px) before the MVP is considered complete.
