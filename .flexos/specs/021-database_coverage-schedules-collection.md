---
id: coverage-schedules-collection
title: "Coverage Schedules Collection"
description: "Normalized weekly chaplain coverage schedule replacing the original 119 flat boolean fields"
type: spec
subtype: database
status: draft
sequence: 21
tags: [database, schema, coverage, normalization]
relatesTo: [docs/core/004-database.md, docs/core/005-flows.md]
createdAt: "2026-02-09T00:30:00Z"
updatedAt: "2026-02-09T00:30:00Z"
---

# Coverage Schedules Collection

## Overview

The `coverage_schedules` collection stores weekly chaplain coverage schedules for DFW Airport terminals, tracking which hourly time slots (5 AM to 9 PM) have chaplain presence. This is a normalized replacement for the original FlutterFlow app's denormalized approach that used 119 individual boolean fields per week (7 days × 17 hours). The normalized design uses a nested map structure for cleaner queries, easier editing, and better scalability.

## Problem Statement

The original DFWAIC App Dashboard stored coverage schedules as 119 separate boolean fields named like `monday5am`, `monday6am`, ..., `sunday9pm` in a single collection document. This created several problems:
- **Denormalization:** Field count grew linearly with time slots, making the schema brittle
- **Query complexity:** Identifying coverage gaps required reading all 119 fields client-side
- **Edit operations:** Each slot toggle required a specific field path, leading to bloated update code
- **Scalability:** Adding terminals or extending hours meant adding hundreds more fields

The fresh build addresses this with a normalized nested map: `slots.monday.5`, `slots.tuesday.14`, etc. This reduces field count from 119 to 1 (the `slots` object), improves read/write patterns, and supports future extensions like per-terminal coverage.

## Collection Schema

### flex_block type="schema"

```typescript
interface CoverageSchedule {
  // Document ID: "{weekNumber}-{year}" (e.g., "8-2026" for week 8 of 2026)

  // Identity
  weekNumber: number             // ISO week number (1-53)
  year: number                   // Year (e.g., 2026)

  // Coverage Data
  slots: {
    monday:    Record<string, boolean>  // { "5": true, "6": false, ..., "21": true }
    tuesday:   Record<string, boolean>  // Hours 5-21 (5 AM through 9 PM = 17 slots)
    wednesday: Record<string, boolean>
    thursday:  Record<string, boolean>
    friday:    Record<string, boolean>
    saturday:  Record<string, boolean>
    sunday:    Record<string, boolean>
  }

  // Audit
  updatedAt?: Timestamp          // Last modification timestamp
  updatedBy?: string             // Admin UID who last edited
}
```

**Total slots per week:** 7 days × 17 hours = 119 boolean values, stored as nested maps instead of flat fields.

**Hour range:** 5 through 21 represents 5:00 AM through 9:00 PM. These are the active chaplaincy hours at DFW Airport. Outside these hours, chaplains are on-call via the after-hours system.

### flex_block type="schema" (example document)

```json
{
  "weekNumber": 8,
  "year": 2026,
  "slots": {
    "monday": {
      "5": false,
      "6": false,
      "7": true,
      "8": true,
      "9": true,
      "10": true,
      "11": true,
      "12": true,
      "13": true,
      "14": false,
      "15": false,
      "16": true,
      "17": true,
      "18": true,
      "19": false,
      "20": false,
      "21": false
    },
    "tuesday": { "...": "..." },
    "wednesday": { "...": "..." },
    "thursday": { "...": "..." },
    "friday": { "...": "..." },
    "saturday": { "...": "..." },
    "sunday": { "...": "..." }
  },
  "updatedAt": "2026-02-18T14:32:00Z",
  "updatedBy": "admin-uid-12345"
}
```

## Document ID Pattern

**Pattern:** `{weekNumber}-{year}`

**Examples:**
- Week 1 of 2026: `1-2026`
- Week 52 of 2025: `52-2025`
- Week 27 of 2026: `27-2026`

**Why this pattern:**
- Natural primary key (week + year uniquely identifies a schedule)
- Predictable ID generation (no need to query to find the document)
- Sorted alphabetically by year, then week
- Easy to construct client-side: `${getISOWeek(date)}-${getYear(date)}`

## Read Patterns

### Get Current Week Coverage
```typescript
// Client-side
const weekNumber = getISOWeek(new Date())
const year = getYear(new Date())
const docRef = doc(db, 'coverage_schedules', `${weekNumber}-${year}`)
const schedule = await getDoc(docRef)

// If document doesn't exist, create a default (all slots false)
if (!schedule.exists()) {
  const defaultSlots = generateEmptySlots() // 7 days × 17 hours all false
  await setDoc(docRef, { weekNumber, year, slots: defaultSlots })
}
```

### Get Specific Week Range
```typescript
// For week navigation (previous/next week)
const targetDate = addWeeks(currentDate, offset) // offset = -1 for previous, +1 for next
const weekNumber = getISOWeek(targetDate)
const year = getYear(targetDate)
const docRef = doc(db, 'coverage_schedules', `${weekNumber}-${year}`)
```

### Check Coverage for a Specific Slot
```typescript
const schedule = await getDoc(docRef)
const isCovered = schedule.data()?.slots?.wednesday?.["14"] ?? false // 2 PM Wednesday
```

## Write Patterns

### Toggle a Single Slot
```typescript
// Admin clicks a cell in the coverage grid
const dayName = 'wednesday'
const hour = '14'
const fieldPath = `slots.${dayName}.${hour}`

await updateDoc(docRef, {
  [fieldPath]: !currentValue,
  updatedAt: serverTimestamp(),
  updatedBy: currentAdmin.uid
})

// Audit log entry
await addDoc(collection(db, 'audit_log'), {
  action: 'coverage_edit',
  adminId: currentAdmin.uid,
  targetId: `${weekNumber}-${year}`,
  targetCollection: 'coverage_schedules',
  details: {
    day: dayName,
    hour: hour,
    before: currentValue,
    after: !currentValue
  },
  createdAt: serverTimestamp()
})
```

### Batch Update Multiple Slots
```typescript
// Fill an entire day with coverage
const batch = writeBatch(db)
const hours = Array.from({ length: 17 }, (_, i) => (5 + i).toString())

hours.forEach(hour => {
  const fieldPath = `slots.friday.${hour}`
  batch.update(docRef, {
    [fieldPath]: true,
    updatedAt: serverTimestamp(),
    updatedBy: currentAdmin.uid
  })
})

await batch.commit()
```

## Query Patterns

Since each week is a single document with a predictable ID, queries are mostly direct document reads. However, if building a multi-week view:

### Get Coverage for a Date Range
```typescript
// Get 4 weeks of coverage (current + 3 future)
const weeks = Array.from({ length: 4 }, (_, i) => {
  const date = addWeeks(new Date(), i)
  return { weekNumber: getISOWeek(date), year: getYear(date) }
})

const schedules = await Promise.all(
  weeks.map(w => getDoc(doc(db, 'coverage_schedules', `${w.weekNumber}-${w.year}`)))
)
```

**No composite index needed** because we're using direct document IDs, not query filters.

## Security Rules

```javascript
match /coverage_schedules/{scheduleId} {
  // All authenticated users can read coverage (chaplains need to see gaps)
  allow read: if request.auth != null;

  // Only admins can create or modify coverage schedules
  allow write: if isAdmin();

  // Validate structure on write
  allow create, update: if request.resource.data.keys().hasAll(['weekNumber', 'year', 'slots'])
    && request.resource.data.weekNumber is int
    && request.resource.data.year is int
    && request.resource.data.slots is map
    && request.resource.data.slots.keys().hasAll(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
}
```

## UI Integration

The coverage grid component (`CoverageSchedule.vue`) renders a 7×17 table:
- **Columns:** Monday through Sunday
- **Rows:** 5 AM through 9 PM (17 rows)
- **Cell color:** Green if `slots[day][hour] === true`, red/gray if false
- **Edit mode:** Clicking a cell toggles the boolean and writes to Firestore
- **Optimistic update:** Cell color changes immediately, reverts if write fails
- **Week navigation:** Arrows to move between weeks, auto-fetches the target week document

## Data Migration

For migrating from the original 119-field schema:

```typescript
// Migration script (run once, server-side)
async function migrateOldCoverageToNormalized(oldDoc: any) {
  const slots = {
    monday: {},
    tuesday: {},
    wednesday: {},
    thursday: {},
    friday: {},
    saturday: {},
    sunday: {},
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const hours = Array.from({ length: 17 }, (_, i) => 5 + i)

  days.forEach(day => {
    hours.forEach(hour => {
      const fieldName = `${day}${hour}` // e.g., "monday5", "tuesday14"
      slots[day][hour.toString()] = oldDoc[fieldName] ?? false
    })
  })

  return {
    weekNumber: oldDoc.weekNumber,
    year: oldDoc.year,
    slots,
    updatedAt: oldDoc.updatedAt,
    updatedBy: oldDoc.updatedBy
  }
}
```

## Acceptance Criteria

- [ ] Coverage schedule documents are created with ID pattern `{weekNumber}-{year}`
- [ ] `slots` field contains 7 nested maps (one per day) with 17 hour keys each
- [ ] Admin can toggle individual slots via the coverage grid UI
- [ ] Each slot toggle writes an audit log entry
- [ ] Coverage grid displays gaps (uncovered hours) with visual indicators
- [ ] Week navigation loads the correct document for previous/next week
- [ ] If a week's document doesn't exist, it is auto-created with all slots false
- [ ] Security rules prevent non-admin writes and enforce schema structure
- [ ] Old 119-field schema is successfully migrated to normalized format

## Related Flows

- **FL-009:** Coverage Schedule Edit (toggles slots)
- **FL-008:** Duty Day Review (displays coverage grid as read-only)
- **SYS-001:** Real-Time Listener Management (coverage listeners attach/detach per page)

## Future Enhancements

- **Per-terminal coverage:** Extend `slots` to `slots.monday.terminalA.5`, `slots.monday.terminalB.5`, etc. for tracking which terminals have coverage at which hours
- **Multi-chaplain coverage:** Store an array of chaplain IDs per slot instead of a boolean (track not just "is covered" but "who is covering")
- **Scheduled coverage:** Add a `scheduled` field alongside `slots` to differentiate between "actually covered" (from duty logs) vs. "scheduled to be covered"
