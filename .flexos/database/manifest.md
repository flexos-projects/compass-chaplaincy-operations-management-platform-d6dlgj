---
id: database-manifest
title: "Database Manifest"
description: "Schema registry for all COMPASS Firestore collections"
type: database
subtype: manifest
status: draft
sequence: 1
tags: [database, schema, firestore]
relatesTo: ["docs/core/004-database.md"]
createdAt: "2026-02-09T01:00:00Z"
updatedAt: "2026-02-09T01:00:00Z"
---

# Database Manifest

<flex_block type="instructions">
This schema registry defines all Firestore collections used in COMPASS. Each collection has a schema block with complete field definitions. When implementing features, reference these schemas for field names, types, and relationships. The schema is normalized (no extreme denormalization like the original 119 boolean fields) with intentional denormalization only where read performance justifies it (e.g., chaplainName in stipend_records). All timestamps use Firestore Timestamp type. All references store document IDs as strings. Security rules enforce that only admin-role users can write to most collections. Query patterns and required indexes are documented in the core database doc. Mock data generation should respect the field types and relationship constraints defined here.
</flex_block>

## Entity Relationship Summary

The database centers on the **users** collection, which represents all system participants (chaplains, interns, support staff, admins). Users are referenced by nine other collections. The **duty_logs** collection records individual shift clock-in/clock-out events and is the source of truth for stipend calculations. The **chaplain_metrics** collection stores detailed encounter records (crisis, prayer, grief) for reporting. The **coverage_schedules** collection stores weekly grids showing which hourly slots have chaplain coverage. The **chaplain_payouts** and **stipend_records** collections form the financial trail: payouts are immutable transaction records, stipend_records are per-chaplain per-month summaries. The **chats** and **chat_messages** collections provide 1:1 messaging infrastructure (read-only for admins). The **audit_log** collection records all administrative actions for accountability. The **app_settings** collection is a single document storing system configuration.

Key relationships: duty_logs.userId → users.uid, duty_logs.payoutId → chaplain_payouts.id, chaplain_payouts.dutyLogIds → duty_logs.id (array), chaplain_metrics.chaplainId → users.uid, stipend_records.chaplainId → users.uid, coverage_schedules is standalone (no references), chats.userA/userB → users.uid, chat_messages.userId → users.uid, audit_log.adminId → users.uid, all processedBy/createdBy/updatedBy fields → users.uid.

<flex_block type="schema" name="users">
{
  "collection": "users",
  "description": "All system users including chaplains, interns, support staff, and administrators",
  "estimatedDocumentCount": "50-200",
  "fields": [
    {"name": "uid", "type": "string", "required": true, "description": "Firebase Auth UID (document ID matches this)"},
    {"name": "email", "type": "string", "required": true, "description": "Email address"},
    {"name": "displayName", "type": "string", "required": true, "description": "Full display name"},
    {"name": "photoUrl", "type": "string", "required": false, "description": "Firebase Storage URL for profile photo"},
    {"name": "phoneNumber", "type": "string", "required": false, "description": "Phone number"},
    {"name": "bio", "type": "string", "required": false, "description": "Biography in primary language"},
    {"name": "translatedBios", "type": "map", "required": false, "description": "Map of language code to translated bio text {es: '...', fr: '...', ko: '...'}"},
    {"name": "language", "type": "string", "required": false, "description": "Preferred language code (ISO 639-1)"},
    {"name": "title", "type": "string", "required": false, "description": "Professional title (Chaplain, Senior Chaplain, etc.)"},
    {"name": "role", "type": "string", "required": true, "enum": ["admin", "chaplain", "intern", "support"], "description": "Primary role"},
    {"name": "isChaplain", "type": "boolean", "required": true, "description": "Active chaplain flag"},
    {"name": "isIntern", "type": "boolean", "required": false, "description": "Intern chaplain flag"},
    {"name": "isSupportMember", "type": "boolean", "required": false, "description": "Support staff flag"},
    {"name": "isAfterHours", "type": "boolean", "required": false, "description": "Available for after-hours duty"},
    {"name": "terminals", "type": "array", "required": false, "description": "Assigned terminals as array of strings ['A', 'B', 'C', 'D', 'E']"},
    {"name": "onDuty", "type": "boolean", "required": true, "description": "Currently clocked in"},
    {"name": "currentStatus", "type": "string", "required": false, "description": "Current availability status text"},
    {"name": "location", "type": "geopoint", "required": false, "description": "Current GPS location from chaplain app"},
    {"name": "totalTime", "type": "number", "required": false, "description": "Accumulated all-time duty hours"},
    {"name": "createdAt", "type": "timestamp", "required": true, "description": "Account creation timestamp"},
    {"name": "lastActiveAt", "type": "timestamp", "required": false, "description": "Last activity in any system"},
    {"name": "adminEditedAt", "type": "timestamp", "required": false, "description": "Last admin edit timestamp for audit trail"},
    {"name": "adminEditedBy", "type": "string", "required": false, "description": "UID of admin who last edited"}
  ]
}
</flex_block>

<flex_block type="schema" name="duty_logs">
{
  "collection": "duty_logs",
  "description": "Clock-in/clock-out shift records for chaplains. Source of truth for stipend calculations.",
  "estimatedDocumentCount": "500-5000 per year",
  "fields": [
    {"name": "userId", "type": "string", "required": true, "description": "Reference to users.uid"},
    {"name": "startTime", "type": "timestamp", "required": true, "description": "Shift start timestamp"},
    {"name": "endTime", "type": "timestamp", "required": false, "description": "Shift end timestamp (null if still on duty)"},
    {"name": "totalHours", "type": "number", "required": false, "description": "Calculated hours (endTime - startTime)"},
    {"name": "startLocation", "type": "geopoint", "required": false, "description": "GPS coordinates at clock-in"},
    {"name": "endLocation", "type": "geopoint", "required": false, "description": "GPS coordinates at clock-out"},
    {"name": "dayName", "type": "string", "required": false, "description": "Day of the week (Monday, Tuesday, etc.)"},
    {"name": "week", "type": "number", "required": false, "description": "ISO week number of the year"},
    {"name": "year", "type": "number", "required": false, "description": "Year of the shift"},
    {"name": "hours", "type": "array", "required": false, "description": "Array of hour slots covered (e.g., [5, 6, 7] for 5-7 AM)"},
    {"name": "approved", "type": "boolean", "required": true, "description": "Whether shift has been approved by admin"},
    {"name": "isPaid", "type": "boolean", "required": true, "description": "Whether this shift has been paid via stipend"},
    {"name": "paymentAmount", "type": "number", "required": false, "description": "Amount paid for this shift in dollars"},
    {"name": "paymentStatus", "type": "string", "required": false, "enum": ["pending", "approved", "paid"], "description": "Payment status"},
    {"name": "adjustmentAmount", "type": "number", "required": false, "description": "Stipend adjustment amount (positive or negative)"},
    {"name": "hasAdjustment", "type": "boolean", "required": false, "description": "Whether an adjustment was applied"},
    {"name": "checkNumber", "type": "string", "required": false, "description": "Check number used for payment"},
    {"name": "payoutId", "type": "string", "required": false, "description": "Reference to chaplain_payouts document"},
    {"name": "processedBy", "type": "string", "required": false, "description": "UID of admin who processed the payment"},
    {"name": "processedAt", "type": "timestamp", "required": false, "description": "When payment was processed"}
  ]
}
</flex_block>

<flex_block type="schema" name="chaplain_metrics">
{
  "collection": "chaplain_metrics",
  "description": "Detailed records of individual chaplain encounters with travelers. Rich categorization system for pastoral care reporting.",
  "estimatedDocumentCount": "1000-10000 per year",
  "fields": [
    {"name": "chaplainId", "type": "string", "required": true, "description": "Reference to users.uid"},
    {"name": "dateCollected", "type": "timestamp", "required": true, "description": "When the encounter occurred"},
    {"name": "dateEntered", "type": "timestamp", "required": false, "description": "When the record was entered into the system"},
    {"name": "terminal", "type": "string", "required": false, "enum": ["A", "B", "C", "D", "E"], "description": "Terminal where encounter occurred"},
    {"name": "gate", "type": "string", "required": false, "description": "Gate number or identifier"},
    {"name": "inChapel", "type": "boolean", "required": false, "description": "Encounter was in the chapel"},
    {"name": "encounterType", "type": "map", "required": false, "description": "Boolean flags: {crisis: bool, violence: bool, policeInvolved: bool, grief: bool, travelRelated: bool, personalIssue: bool, prayerRequested: bool, fallenAngel: bool}"},
    {"name": "encounterMedium", "type": "map", "required": false, "description": "Boolean flags: {inPerson: bool, byPhone: bool, chatOnly: bool, selfDiscovered: bool}"},
    {"name": "recipientType", "type": "string", "required": false, "enum": ["traveler", "employee", "crew", "vendor", "other"], "description": "Type of person helped"},
    {"name": "personsInvolved", "type": "number", "required": false, "description": "Number of persons involved in encounter"},
    {"name": "isAdult", "type": "boolean", "required": false, "description": "Encounter was with an adult"},
    {"name": "eventNarrative", "type": "string", "required": false, "description": "Detailed free-text narrative of the event"},
    {"name": "note", "type": "string", "required": false, "description": "Short notes about the encounter"},
    {"name": "images", "type": "array", "required": false, "description": "Array of image URLs from the encounter"},
    {"name": "durationMinutes", "type": "number", "required": false, "description": "Duration of the encounter in minutes"},
    {"name": "timeEnded", "type": "timestamp", "required": false, "description": "When the encounter ended"},
    {"name": "isTrainingSession", "type": "boolean", "required": false, "description": "This was a training session"},
    {"name": "trainingFeedback", "type": "string", "required": false, "description": "Feedback on the training session"},
    {"name": "internEvaluation", "type": "map", "required": false, "description": "Intern evaluation: {name: string, isShadowing: bool, isAssisting: bool, initiative: number (1-5), pastoralDemeanor: number (1-5), pluralisticCompetence: number (1-5), situationalAwareness: number (1-5), feedback: string}"}
  ]
}
</flex_block>

<flex_block type="schema" name="coverage_schedules">
{
  "collection": "coverage_schedules",
  "description": "Weekly coverage schedule storing which hourly slots (5AM-9PM) have chaplain coverage. One document per week. Normalized as nested structure instead of 119 flat booleans.",
  "estimatedDocumentCount": "52 per year",
  "fields": [
    {"name": "weekNumber", "type": "number", "required": true, "description": "ISO week number (1-53)"},
    {"name": "year", "type": "number", "required": true, "description": "Year"},
    {"name": "slots", "type": "map", "required": true, "description": "Nested map: {monday: {5: true, 6: false, ...}, tuesday: {...}, wednesday: {...}, thursday: {...}, friday: {...}, saturday: {...}, sunday: {...}} for each day and hour 5-21"},
    {"name": "updatedAt", "type": "timestamp", "required": false, "description": "Last edit timestamp"},
    {"name": "updatedBy", "type": "string", "required": false, "description": "UID of admin who last edited"}
  ]
}
</flex_block>

<flex_block type="schema" name="chaplain_payouts">
{
  "collection": "chaplain_payouts",
  "description": "Immutable payment records linking multiple duty log entries to a single payout transaction. Created during stipend processing. NEVER updated or deleted.",
  "estimatedDocumentCount": "50-200 per month",
  "fields": [
    {"name": "chaplainId", "type": "string", "required": true, "description": "Reference to users.uid"},
    {"name": "payoutAmount", "type": "number", "required": true, "description": "Total payout amount in dollars"},
    {"name": "dutyLogIds", "type": "array", "required": true, "description": "Array of duty_logs document IDs covered by this payout"},
    {"name": "dutyLogCount", "type": "number", "required": true, "description": "Number of duty logs in this payout"},
    {"name": "checkNumber", "type": "string", "required": false, "description": "Check number for paper trail"},
    {"name": "transactionId", "type": "string", "required": false, "description": "External transaction ID if electronic payment"},
    {"name": "isPaid", "type": "boolean", "required": true, "description": "Whether the payout has been issued"},
    {"name": "monthPaid", "type": "string", "required": true, "description": "Month name of the pay period (January, February, etc.)"},
    {"name": "yearPaid", "type": "number", "required": true, "description": "Year of the pay period"},
    {"name": "createdAt", "type": "timestamp", "required": true, "description": "When the payout record was created"},
    {"name": "createdBy", "type": "string", "required": true, "description": "UID of admin who created the payout"}
  ]
}
</flex_block>

<flex_block type="schema" name="stipend_records">
{
  "collection": "stipend_records",
  "description": "Per-chaplain stipend history per pay period. Normalized replacement for original parallel-array stipendhistory collection. One document per chaplain per month.",
  "estimatedDocumentCount": "50-200 per month",
  "fields": [
    {"name": "chaplainId", "type": "string", "required": true, "description": "Reference to users.uid"},
    {"name": "chaplainName", "type": "string", "required": true, "description": "Denormalized chaplain name for display efficiency"},
    {"name": "monthName", "type": "string", "required": true, "description": "Month name of the pay period (January, February, etc.)"},
    {"name": "year", "type": "number", "required": true, "description": "Year of the pay period"},
    {"name": "startDate", "type": "timestamp", "required": true, "description": "Pay period start date"},
    {"name": "endDate", "type": "timestamp", "required": true, "description": "Pay period end date"},
    {"name": "instancesAuthorized", "type": "number", "required": true, "description": "Number of qualifying duty shifts"},
    {"name": "instancesPaid", "type": "number", "required": false, "description": "Number of shifts actually paid"},
    {"name": "stipendAmount", "type": "number", "required": false, "description": "Total amount paid to chaplain for this period"},
    {"name": "adjustmentAmount", "type": "number", "required": false, "description": "Total adjustments applied"},
    {"name": "hasAdjustment", "type": "boolean", "required": false, "description": "Whether adjustments were applied"},
    {"name": "isCompleted", "type": "boolean", "required": true, "description": "Whether this period's stipend is finalized"},
    {"name": "completedAt", "type": "timestamp", "required": false, "description": "When stipend processing was completed"},
    {"name": "processedBy", "type": "string", "required": false, "description": "UID of admin who processed this stipend"}
  ]
}
</flex_block>

<flex_block type="schema" name="chats">
{
  "collection": "chats",
  "description": "1:1 chat room metadata between two users. Stores participants, last message preview, and language preference for potential translation.",
  "estimatedDocumentCount": "100-500",
  "fields": [
    {"name": "userA", "type": "string", "required": true, "description": "First participant UID"},
    {"name": "userB", "type": "string", "required": true, "description": "Second participant UID"},
    {"name": "userALanguage", "type": "string", "required": false, "description": "Language preference of user A for translation"},
    {"name": "lastMessage", "type": "string", "required": false, "description": "Preview text of the last message"},
    {"name": "lastMessageTime", "type": "timestamp", "required": false, "description": "Timestamp of the last message"},
    {"name": "lastMessageSentBy", "type": "string", "required": false, "description": "UID of who sent the last message"},
    {"name": "lastMessageSeenBy", "type": "array", "required": false, "description": "Array of user UIDs who have seen the last message"},
    {"name": "createdAt", "type": "timestamp", "required": true, "description": "When the chat was created"}
  ]
}
</flex_block>

<flex_block type="schema" name="chat_messages">
{
  "collection": "chat_messages",
  "description": "Individual messages within a chat thread. Subcollection of chats. Supports text, images, and video. Append-only (no edits or deletes).",
  "parent": "chats",
  "estimatedDocumentCount": "1000-50000",
  "fields": [
    {"name": "chatId", "type": "string", "required": true, "description": "Reference to parent chat document"},
    {"name": "userId", "type": "string", "required": true, "description": "UID of who sent the message"},
    {"name": "text", "type": "string", "required": false, "description": "Message text content"},
    {"name": "image", "type": "string", "required": false, "description": "Attached image URL"},
    {"name": "video", "type": "string", "required": false, "description": "Attached video URL"},
    {"name": "createdAt", "type": "timestamp", "required": true, "description": "When the message was sent"}
  ]
}
</flex_block>

<flex_block type="schema" name="audit_log">
{
  "collection": "audit_log",
  "description": "Administrative action trail. Records who did what and when for accountability. Written only from server-side (admin SDK).",
  "estimatedDocumentCount": "Growing (all admin writes)",
  "fields": [
    {"name": "action", "type": "string", "required": true, "enum": ["profile_edit", "stipend_approve", "payout_create", "coverage_edit", "role_change", "settings_update", "photo_upload"], "description": "Action type"},
    {"name": "adminId", "type": "string", "required": true, "description": "UID of admin who performed the action"},
    {"name": "targetId", "type": "string", "required": false, "description": "Document ID of the affected record"},
    {"name": "targetCollection", "type": "string", "required": false, "description": "Collection name of the affected record"},
    {"name": "details", "type": "map", "required": false, "description": "JSON object with action-specific details: {before: {...}, after: {...}, summary: string}"},
    {"name": "createdAt", "type": "timestamp", "required": true, "description": "When the action occurred"}
  ]
}
</flex_block>

<flex_block type="schema" name="app_settings">
{
  "collection": "app_settings",
  "description": "System configuration. Single document with ID 'config'. Replaces scattered SharedPreferences from original app.",
  "estimatedDocumentCount": "1",
  "documentId": "config",
  "fields": [
    {"name": "baseStipendRate", "type": "number", "required": true, "default": 80, "description": "Default dollars per shift"},
    {"name": "programYear", "type": "number", "required": true, "description": "Current program year (e.g., 2026)"},
    {"name": "adminUserIds", "type": "array", "required": true, "description": "Array of UIDs with admin access"},
    {"name": "defaultPhotoUrl", "type": "string", "required": false, "description": "Default avatar URL for new users"},
    {"name": "orgName", "type": "string", "required": true, "default": "DFW Airport Interfaith Chaplaincy", "description": "Organization name"},
    {"name": "supportEmail", "type": "string", "required": false, "description": "Support contact email"},
    {"name": "updatedAt", "type": "timestamp", "required": true, "description": "Last configuration update"},
    {"name": "updatedBy", "type": "string", "required": true, "description": "UID of admin who last updated"}
  ]
}
</flex_block>

<flex_block type="config" name="mock-data-settings">
{
  "recordsPerCollection": {
    "users": 62,
    "duty_logs": 847,
    "chaplain_metrics": 1453,
    "coverage_schedules": 52,
    "chaplain_payouts": 186,
    "stipend_records": 186,
    "chats": 73,
    "chat_messages": 892,
    "audit_log": 234,
    "app_settings": 1
  },
  "crossReferenceRules": {
    "duty_logs_userId_must_exist_in_users": true,
    "duty_logs_payoutId_must_exist_in_chaplain_payouts_if_isPaid": true,
    "chaplain_metrics_chaplainId_must_exist_in_users": true,
    "chaplain_payouts_chaplainId_must_exist_in_users": true,
    "chaplain_payouts_dutyLogIds_must_exist_in_duty_logs": true,
    "stipend_records_chaplainId_must_exist_in_users": true,
    "chats_userA_userB_must_exist_in_users": true,
    "chat_messages_userId_must_exist_in_users": true,
    "audit_log_adminId_must_exist_in_users": true,
    "coverage_schedules_has_no_references": true
  },
  "dateRanges": {
    "users_createdAt": "2024-01-01 to 2026-02-09",
    "duty_logs_startTime": "2025-06-01 to 2026-02-09",
    "chaplain_metrics_dateCollected": "2025-06-01 to 2026-02-09",
    "coverage_schedules": "2026 weeks 1-52",
    "chaplain_payouts_createdAt": "2025-06-01 to 2026-02-01",
    "stipend_records": "June 2025 to January 2026",
    "chats_createdAt": "2025-03-01 to 2026-02-09",
    "audit_log_createdAt": "2025-09-01 to 2026-02-09"
  }
}
</flex_block>

## Index Strategy

Firestore requires composite indexes for queries with multiple inequality or range filters, multiple orderBy clauses, or combining where and orderBy. COMPASS requires 24 composite indexes across 9 collections to support all query patterns. Critical indexes: users (role + displayName, isChaplain + displayName, onDuty + isChaplain, createdAt DESC), duty_logs (userId + startTime DESC, isPaid + startTime ASC, year + week + userId, startTime DESC), chaplain_metrics (chaplainId + dateCollected DESC, terminal + dateCollected DESC, dateCollected DESC), coverage_schedules (weekNumber + year), chaplain_payouts (chaplainId + yearPaid DESC, monthPaid + yearPaid, yearPaid DESC + createdAt DESC), stipend_records (chaplainId + year DESC + monthName, year + monthName, isCompleted + year), audit_log (adminId + createdAt DESC, targetCollection + targetId + createdAt DESC, action + createdAt DESC), chat_messages subcollection (chatId + createdAt ASC), chats (userA + lastMessageTime DESC, userB + lastMessageTime DESC). All indexes must be created in Firestore console or via firestore.indexes.json before production deployment.

## Data Lifecycle

Users are created when chaplains register via the mobile app or when admins manually add profiles. Users are soft-deleted (not removed from Firestore) by setting an isActive: false flag (future feature). Duty logs are created when chaplains clock in/out via mobile app. Duty logs are never deleted. Chaplain metrics are created when chaplains submit encounter reports via mobile app. Chaplain metrics are never deleted. Coverage schedules are created on-demand when an admin first edits a week. Coverage schedules persist indefinitely. Chaplain payouts are created during monthly stipend processing. Payouts are immutable—never updated or deleted. Stipend records are created/updated during stipend processing. Stipend records are never deleted. Chats and chat messages are created by chaplains via mobile app. Chat data is never deleted. Audit log entries are created on every admin write operation. Audit log entries are never deleted. App settings are created during initial system setup and updated rarely.

## Security Rules Overview

Security rules enforce that all write operations (except duty log and chaplain metric creation by chaplains) require admin role. Admin role is verified by checking if request.auth.uid exists in app_settings/config.adminUserIds array. Chaplains can create their own duty logs and metrics but cannot edit or delete them. Coverage schedules are admin-only for both read and write. Chaplain payouts are admin-create-only (no update or delete allowed—enforces immutability). Stipend records are admin read/write. Chats are readable by participants or admins. Chat messages are readable by all authenticated users but only creatable by participants. Audit log is admin-read, server-write-only (written via admin SDK from Nuxt API routes, not client-side). App settings are admin read/write. The catch-all rule denies everything else. Critical note: audit log writes must come from server-side API routes using Firebase Admin SDK to prevent tampering. Client-side rule is allow write: if false.
