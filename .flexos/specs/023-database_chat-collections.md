---
id: chat-collections
title: "Chats & Chat Messages Collections"
description: "1:1 chaplain messaging infrastructure with admin read-only monitoring capability"
type: spec
subtype: database
status: draft
sequence: 23
tags: [database, schema, chat, messaging, monitoring]
relatesTo: [docs/core/004-database.md, docs/core/005-flows.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Chats & Chat Messages Collections

## Overview

The chat system enables 1:1 messaging between chaplains for coordination, support, and team communication. The admin dashboard provides read-only access to chat threads for oversight and support purposes. The system uses two collections: `chats` for thread metadata and `chat_messages` as a subcollection for individual messages.

## Problem Statement

The original DFWAIC App Dashboard had complete chat infrastructure (collections, fields, language awareness, read receipts) but the admin dashboard only showed aggregate chat counts on the main dashboard. No chat detail view existed despite the data being fully populated by the chaplain mobile app.

The fresh build adds a read-only chat monitoring page for admins while preserving the existing schema that the mobile app depends on. Admins can view conversations to:
- Monitor team communication quality
- Investigate reported issues between chaplains
- Provide technical support for chat-related problems
- Understand team dynamics and morale

**Critical constraint:** Admins cannot send messages or modify chat data. This is a monitoring feature, not a participation feature.

## Collection 1: chats

### Purpose
Stores metadata for each 1:1 chat room between two users, including last message preview and language preferences for potential translation features.

### flex_block type="schema"

```typescript
interface Chat {
  // Document ID: Auto-generated Firestore ID (e.g., "chat-abc123")

  // Participants
  userA: string                  // First participant UID (from users collection)
  userB: string                  // Second participant UID (from users collection)
  userALanguage?: string         // Language preference of user A (ISO 639-1: "en", "es", "ko", etc.)

  // Last Message Preview
  lastMessage?: string           // Text preview of the last message sent (truncated to 100 chars)
  lastMessageTime?: Timestamp    // When the last message was sent
  lastMessageSentBy?: string     // UID of who sent the last message
  lastMessageSeenBy?: string[]   // Array of UIDs who have seen the last message

  // Metadata
  createdAt: Timestamp           // When the chat was created (first message timestamp)
}
```

### Key Properties

**Participant ordering:** `userA` and `userB` are not ordered by any specific rule. When creating a chat, the mobile app uses lexicographic ordering: `userA` is the smaller UID alphabetically. This prevents duplicate chats (both "user1-user2" and "user2-user1" would resolve to the same document).

**Language awareness:** The `userALanguage` field was intended for future translation features (auto-translate messages to recipient's language). Not currently implemented but preserved for mobile app compatibility.

**Read receipts:** The `lastMessageSeenBy` array tracks who has read the most recent message. Used for unread badge counts on the mobile app.

**Last message preview:** Updated automatically when a new message is sent (using a Firestore trigger in the mobile app backend). Admins see this preview in the chat list.

### flex_block type="schema" (example document)

```json
{
  "userA": "chaplain-martinez-uid",
  "userB": "chaplain-johnson-uid",
  "userALanguage": "es",
  "lastMessage": "Thanks for covering my shift yesterday!",
  "lastMessageTime": "2026-02-08T14:32:00Z",
  "lastMessageSentBy": "chaplain-martinez-uid",
  "lastMessageSeenBy": ["chaplain-martinez-uid", "chaplain-johnson-uid"],
  "createdAt": "2025-12-15T09:00:00Z"
}
```

## Collection 2: chat_messages (subcollection)

### Purpose
Individual messages within a chat thread, stored as a subcollection under each chat document. Supports text, images, and video attachments.

### Collection Path
`chats/{chatId}/chat_messages/{messageId}`

### flex_block type="schema"

```typescript
interface ChatMessage {
  // Document ID: Auto-generated Firestore ID (e.g., "msg-xyz789")

  // Core
  chatId: string                 // Parent chat document ID (denormalized for easier querying)
  userId: string                 // Sender UID (from users collection)

  // Content (at least one must be present)
  text?: string                  // Message text content
  image?: string                 // Firebase Storage URL for attached image
  video?: string                 // Firebase Storage URL for attached video

  // Metadata
  createdAt: Timestamp           // When the message was sent
}
```

### Key Properties

**Append-only:** Chat messages cannot be edited or deleted. Security rules enforce `allow update, delete: if false`. This is intentional for accountability and compliance.

**Media attachments:** Images and videos are stored in Firebase Storage at `/chat-media/{chatId}/{timestamp}-{filename}`. Messages include the public download URL.

**Denormalized chatId:** The parent chat ID is stored on each message for easier cross-chat queries (if needed for admin search in future versions).

### flex_block type="schema" (example document)

```json
{
  "chatId": "chat-abc123",
  "userId": "chaplain-martinez-uid",
  "text": "Can you help with Terminal D coverage tomorrow 2-5 PM?",
  "image": null,
  "video": null,
  "createdAt": "2026-02-08T14:30:00Z"
}
```

## Query Patterns

### Get All Chats for a User
```typescript
// Mobile app query (not used in admin dashboard)
const q = query(
  collection(db, 'chats'),
  where('userA', '==', userId),
  orderBy('lastMessageTime', 'desc')
)

// Also query userB to find chats where this user is the second participant
const q2 = query(
  collection(db, 'chats'),
  where('userB', '==', userId),
  orderBy('lastMessageTime', 'desc')
)

// Combine and sort client-side
```

### Get All Chats (Admin Dashboard)
```typescript
// Admin monitoring page: show all chats ordered by most recent activity
const q = query(
  collection(db, 'chats'),
  orderBy('lastMessageTime', 'desc'),
  limit(50)
)
```

### Get Messages for a Chat Thread
```typescript
// Load messages in chronological order
const q = query(
  collection(db, `chats/${chatId}/chat_messages`),
  orderBy('createdAt', 'asc')
)

// Real-time listener for live updates
onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      // New message received, append to UI
    }
  })
})
```

### Get Recent Messages Across All Chats (Admin Dashboard)
```typescript
// Admin dashboard KPI: total chat messages in last 7 days
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const q = collectionGroup(db, 'chat_messages')
  .where('createdAt', '>', sevenDaysAgo)

const snapshot = await getCountFromServer(q)  // Count only, no data fetch
```

## Security Rules

```javascript
// chats: Admins read-only, participants can read/write
match /chats/{chatId} {
  // Admins can read any chat
  allow read: if isAdmin();

  // Participants can read their own chats
  allow read: if request.auth != null
    && request.auth.uid in [resource.data.userA, resource.data.userB];

  // Participants can create/update their chats (but not delete)
  allow create, update: if request.auth != null
    && request.auth.uid in [request.resource.data.userA, request.resource.data.userB]
    && request.resource.data.keys().hasAll(['userA', 'userB', 'createdAt']);

  allow delete: if false;  // No deletes
}

// chat_messages: Admins read-only, participants can create (append-only)
match /chats/{chatId}/chat_messages/{messageId} {
  // Admins can read any message
  allow read: if isAdmin();

  // Any authenticated user can read (they check chatId access separately)
  allow read: if request.auth != null;

  // Users can create messages if they're the sender
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.keys().hasAny(['text', 'image', 'video'])
    && request.resource.data.createdAt == request.time;

  // No updates or deletes (append-only)
  allow update, delete: if false;
}
```

## Admin Dashboard UI

### Chat Monitoring Page (`/chats`)

**List View:**
- Table or card layout showing all chat threads
- Columns: Participants (both names), Last Message (preview), Time, Unread badge (if applicable)
- Sort by most recent activity (lastMessageTime desc)
- Filter by participant name (search)
- Click to view detail

**Detail View:**
- Header: Participant names, language preferences, chat created date
- Messages list: Chronological, grouped by date
  - Sender name + avatar
  - Message text
  - Image/video thumbnails (click to view full size)
  - Timestamp
- Auto-scroll to bottom on load
- Real-time updates (new messages appear as they're sent)
- **No send button** — admins cannot participate

### Dashboard KPI Card
- **Total chat messages (7d):** Count of messages in last 7 days
- **Active chat threads (30d):** Count of chats with activity in last 30 days
- Click to navigate to full chat monitoring page

## Data Privacy & Compliance

**Read-only access justification:** Admin read-only access is necessary for:
- Investigating reported harassment or misconduct
- Troubleshooting technical issues ("my messages aren't sending")
- Monitoring team morale and communication health
- Compliance with organizational policies

**No write access:** Admins cannot send messages to avoid:
- Violating chaplain-chaplain confidentiality
- Creating records of admin intervention in private conversations
- Mixing admin oversight with peer support communication

**Future enhancement:** Add a flag `isPrivate: boolean` on chats, allowing chaplains to mark sensitive conversations as private (admins would see "Private conversation" placeholder instead of messages).

## Relationship to Mobile App

The chaplain mobile app (separate codebase, not part of COMPASS) handles:
- Creating chat documents when two chaplains start a conversation
- Sending messages (creates chat_message documents)
- Updating lastMessage/lastMessageTime on the parent chat
- Uploading images/videos to Firebase Storage
- Marking messages as seen (updating lastMessageSeenBy)

The admin dashboard is a **passive observer** of this data. It does not create or modify chats or messages.

## Acceptance Criteria

- [ ] chats collection stores metadata for each 1:1 conversation
- [ ] chat_messages subcollection stores individual messages in chronological order
- [ ] Admin dashboard can query and display all chat threads
- [ ] Admin can view message history for any chat thread
- [ ] Messages display text, images, and videos correctly
- [ ] Security rules prevent admin writes to chats or messages
- [ ] Security rules prevent non-participants from reading chat content
- [ ] Chat list shows last message preview and timestamp
- [ ] Real-time updates: new messages appear live in detail view (admin monitoring)
- [ ] Dashboard KPI shows chat activity metrics (7d/30d)

## Related Flows

- **FL-015:** Chat Thread Browse (admin navigates and views read-only)
- **FL-004:** Dashboard Load (includes chat activity KPIs)

## Future Enhancements

- **Search:** Full-text search across chat messages (using Algolia or Firestore extension)
- **Export:** Admin can export a chat thread as PDF for documentation
- **Privacy flag:** Chaplains can mark sensitive chats as private (hides content from admins)
- **Translation:** Auto-translate messages based on userALanguage preference
- **Moderation:** Admins can flag inappropriate messages (adds `flagged: true` field, does not delete)
