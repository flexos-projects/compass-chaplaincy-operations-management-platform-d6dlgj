---
id: features-chat-monitoring
title: "Chat Monitoring (Read-Only)"
description: "Admin read-only view of chaplain-to-chaplain chat conversations for oversight and support"
type: spec
subtype: features
status: draft
sequence: 8
tags: [features, chat, monitoring, p2]
relatesTo: [docs/core/002-features.md, docs/core/003-pages.md, docs/core/004-database.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Chat Monitoring (Read-Only)

## Overview

Chat Monitoring provides program administrators with read-only visibility into chaplain-to-chaplain conversations that occur in the chaplain mobile app. This feature is for oversight, quality assurance, and team support -- not for active participation. Admins cannot send messages, edit content, or delete conversations. They can only observe.

The original FlutterFlow app had complete chat infrastructure (`chats` and `chat_messages` collections with rich schema) but the admin dashboard only showed aggregate chat counts on the dashboard KPI cards. No detail view existed despite the data being fully available. This feature surfaces that existing data for administrative review.

## Business Context

Chaplaincy program directors need to:
- **Monitor team communication quality** -- Ensure chaplains are communicating professionally and effectively
- **Provide support** -- Identify chaplains in distress or requesting help from peers
- **Quality assurance** -- Review conversations for training and coaching opportunities
- **Incident review** -- Understand team coordination during critical incidents (e.g., multi-chaplain crisis response)

This is NOT surveillance. The chaplains know they are using an official work communication system. The chat monitoring feature is transparent: a banner on every chat detail view states "You are viewing this conversation in read-only mode."

## Core Functionality

### 1. Chat Thread List

**Data source:** `chats` collection

**Display:** Scrollable list of all chat threads, sorted by most recent message first (`lastMessageTime desc`). Each thread card shows:
- **Participants:** Avatar + name for both userA and userB
- **Last message preview:** First 80 characters of `lastMessage`
- **Last message timestamp:** Relative time (e.g., "2 hours ago", "Yesterday", "Jan 15")
- **Last sender indicator:** Small badge showing who sent the last message
- **Unread status:** Only relevant for participants, not admin (admin view is always "read")

**Search/filter:** Text search filters by participant name (search both userA and userB display names). No filter by message content (too slow, privacy concern).

**Pagination:** Load 25 threads per page, infinite scroll to load more.

**Click action:** Navigate to `/chats/:chatId` to view full message history.

### 2. Chat Detail View

**Data source:** `chat_messages` subcollection of `chats/:chatId`

**Display:** Standard vertical message list (newest at bottom, scrollable). Each message bubble shows:
- **Sender name + avatar** (left-aligned for one participant, right-aligned for the other)
- **Message text** (supports line breaks, no markdown rendering)
- **Image attachment** (displayed inline, click to expand to full-screen viewer)
- **Video attachment** (displayed as thumbnail with play button)
- **Timestamp** (HH:MM format, date header inserted for each new day)

**Read-only banner:** Fixed blue banner at top of chat: "🔒 You are viewing this conversation in read-only mode. You cannot send messages or modify this chat."

**Message loading:** Load last 50 messages on initial view, "Load earlier messages" button to fetch previous 50 (cursor-based pagination using `createdAt` field).

**No send capability:** The message input field is absent. There is no "Send" button. No gesture or keyboard shortcut can send a message from this view.

### 3. Media Viewer

**Functionality:** Click an inline image to open a full-screen lightbox viewer with:
- **Full-resolution image display** (up to viewport size)
- **Close button** (X in top-right)
- **Download button** (saves image to device)
- **Context caption** (sender name + timestamp below image)

**Video viewer:** Click a video thumbnail to open an in-page video player (HTML5 `<video>` element) with standard controls (play, pause, seek, volume, fullscreen).

**Security:** Media URLs are Firebase Storage URLs with download tokens. Firestore security rules ensure only admins can read chat_messages. No additional auth layer needed.

### 4. Chat Activity Metrics

**Display location:** Small metrics summary at the top of the chat monitoring page (above thread list).

**Metrics shown:**
- **Total chat threads:** Count of `chats` collection documents
- **Active chats (7d):** Threads with `lastMessageTime` in the last 7 days
- **Total messages (30d):** Count of `chat_messages` where `createdAt` in last 30 days
- **Most active chaplains:** Top 3 chaplains by message count in last 30 days (name + count)

**Use case:** Quick operational visibility. If chat activity drops sharply, it may indicate a technical issue or team disengagement.

## Acceptance Criteria

**Given** an admin navigates to `/chats`,
**When** the page loads,
**Then** a list of chat threads displays sorted by most recent message first, showing participant names, last message preview, and timestamp.

**Given** the admin views the chat list,
**When** they search for a chaplain name (e.g., "Martinez"),
**Then** only threads where userA or userB display name includes "Martinez" are shown.

**Given** the admin clicks a chat thread,
**When** the detail view loads,
**Then** the last 50 messages display in chronological order with sender names, timestamps, and inline media, and a blue read-only banner appears at the top.

**Given** a chat contains an image attachment,
**When** the admin clicks the image,
**Then** a full-screen lightbox viewer opens showing the image at full resolution with close and download buttons.

**Given** the admin is viewing a chat detail,
**When** they attempt to find a way to send a message,
**Then** no message input field, send button, or keyboard shortcut is available -- the interface prevents all write operations.

**Given** the admin is viewing an empty chat (no messages yet),
**When** the detail view loads,
**Then** an empty state message displays: "No messages in this conversation yet."

**Given** the admin loads a chat with more than 50 messages,
**When** they scroll to the top,
**Then** a "Load earlier messages" button appears, which fetches the previous 50 messages when clicked.

**Given** the admin navigates to `/chats`,
**When** chat activity metrics are calculated,
**Then** the summary shows total threads, active chats (7d), total messages (30d), and top 3 most active chaplains.

## Edge Cases

### Empty States
- **No chat threads exist:** Show "No chat conversations yet. Chaplains will appear here when they start using the messaging feature."
- **No messages in thread:** Show "No messages in this conversation yet."
- **Search returns no results:** Show "No chats found matching '[search term]'. Try a different chaplain name."

### Data Loading
- **Slow network:** Show loading skeleton for thread list and message view
- **Firestore listener disconnect:** Yellow banner: "Connection lost. Showing cached messages."
- **Large media files:** Show progress spinner on image/video thumbnails while loading

### Deleted/Archived Data
- **Chaplain account deleted:** Show "[Deleted User]" in thread list and message bubbles where user data no longer exists
- **Storage URLs expired:** If image/video URL returns 404, show placeholder: "Media no longer available"

## Mobile Considerations

**Chat monitoring on tablet (768px+):** Full functionality. Two-column layout: thread list on left (300px), detail view on right. Works like desktop email client.

**Chat monitoring on mobile (<768px):** Single-column layout. Thread list fills screen. Tapping a thread navigates to detail view (full-screen message list). Back button returns to thread list. Read-only banner collapses to icon badge to save vertical space.

**Touch targets:** Thread list items minimum 64px height (larger than typical 44px because they contain multi-line preview text). Message bubbles are read-only so no minimum touch target required.

## Performance Requirements

- **Thread list load:** Under 2 seconds for 100 threads
- **Message detail load:** Last 50 messages render in under 1 second
- **Pagination:** Load earlier messages in under 1 second
- **Image viewer:** Full-resolution image displays in under 3 seconds on typical connection
- **Real-time updates:** Optional. Chats can refresh on page navigation (no live listener required for admin view)

## Security & Privacy

- **Admin-only access:** Chat monitoring requires admin role (enforced by route guard)
- **Firestore rules:** Admins can read `chats` and `chat_messages`, but `allow write: if false` for chat_messages (append-only for participants, no writes for admins)
- **No audit trail for views:** Viewing a chat does NOT create an audit log entry (too noisy). Only if we add a future feature like "flag this conversation" would we log admin actions.
- **HTTPS only:** Chat content is sensitive. Ensure all traffic is HTTPS (enforced by Firebase Hosting).

## Ethical Considerations

**Transparency:** The chaplain mobile app should display a notice during onboarding: "Your conversations with other chaplains may be reviewed by program administrators for quality assurance and support purposes."

**Scope limitation:** Admins can only view chaplain-to-chaplain chats. They cannot view any hypothetical chaplain-to-traveler messages (which don't exist in this system, but if added, would require higher privacy standards).

**No retroactive deletion:** Even if a chaplain leaves the program, their chat history remains visible for continuity and incident review. User accounts can be marked inactive but messages are not deleted.

## Future Enhancements (v1.1+)

- **Export chat transcript:** Download a PDF or text file of an entire conversation
- **Flag conversation:** Admin can flag a chat for follow-up (adds a badge to thread list)
- **Search message content:** Full-text search across all messages (requires Cloud Functions + Algolia or similar)
- **Translation indicator:** If `userALanguage` is set and differs from userB, show a badge indicating the chat may involve language translation
- **Notification settings:** Admins can opt-in to receive a daily digest of new chat activity
