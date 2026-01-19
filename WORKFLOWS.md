# Goal Tracker - Complete Product Workflows & Rules

> **CRITICAL:** This document defines ALL core workflows, business rules, and page behaviors.
> **ANY enhancement MUST follow these rules. DO NOT modify workflows without updating this doc.**
> Last Updated: 2026-01-19

---

## 🏗️ Core Architecture Principles

### Data Flow
1. **Primary Database:** Supabase (PostgreSQL with RLS)
2. **Backup/Sync:** Obsidian vault via GitHub API
3. **State Management:** Zustand store (`src/lib/store.ts`)
4. **Sync Strategy:** Dual-write (Supabase + Obsidian on every change)

### Timeline-Based System
**CRITICAL RULE:** This app is built around a **timeline of events**. Everything is logged to `timeline_events` and `productivity_logs` tables.

---

## 📅 Daily Task Reset System

### How It Works
1. **Task Property:** Every task has `isDaily: boolean`
   - `isDaily: true` → Task resets every morning
   - `isDaily: false` → Task persists until manually completed

2. **Reset Trigger:** `resetDailyTasks()` is called when:
   - User records wake-up time via WakeUpModal
   - Happens automatically if 4+ hours since last app open (5 AM - 12 PM only)

3. **Reset Logic:**
   ```typescript
   // From store.ts line 1054-1074
   tasks.map(t => 
     t.isDaily 
       ? { ...t, isCompleted: false, completedAt: undefined, actualMinutes: undefined }
       : t
   )
   ```

4. **What Gets Reset:**
   - `isCompleted` → `false`
   - `completedAt` → `undefined`
   - `actualMinutes` → `undefined`

### **CRITICAL BUG FIX NEEDED:**
Currently, `resetDailyTasks()` is ONLY called from WakeUpModal. If user doesn't see the popup (outside 5 AM - 12 PM), tasks never reset!

**Solution:** Add automatic daily reset check in AppInitializer based on date change.

---

## 📊 Timeline & Productivity Tracking

### Timeline Events (`timeline_events` table)
Every significant action creates a timeline event:
- Goal created/started/completed
- Task completed
- Productivity logged
- Daily tasks reset

### Productivity Logs (`productivity_logs` table)
- **When Created:** Every time a task is completed
- **Data Stored:**
  - `date`: YYYY-MM-DD
  - `productiveMinutes`: Task's `estimatedMinutes`
  - `goalId`: Parent goal
  - `userId`: Owner

### Timeline Page (`/timeline`)
Shows two views:
1. **Goals Tab:** All goals with progress bars, time spent, task breakdown
2. **Productivity Tab:** 
   - Today's productive time
   - Last 7 days chart
   - Weekly totals
   - Top goals by time spent

---

## 🗂️ Obsidian Folder Structure

### Folder Hierarchy
```
MTO/
├── Goals/
│   ├── active/          # status !== 'completed' && !isArchived
│   ├── completed/       # status === 'completed'
│   └── archive/         # isArchived === true
├── Tasks/
│   ├── active/          # !isCompleted
│   └── completed/       # isCompleted
├── Diary/
│   └── YYYY/
│       └── MM/
│           └── YYYY-MM-DD.md
└── Sleep/
    └── YYYY/
        └── MM.md        # Monthly sleep log
```

### File Format
All files are markdown with YAML frontmatter:
```yaml
---
schema_version: "2026.1"
id: "uuid"
title: "Goal Title"
# ... other properties
metadata:
  source: "mto-app"
  synced_at: "2026-01-19T..."
---

# Goal Title
Content here...
```

### Sync Triggers
- **Goal:** Created, updated, status changed, archived, deleted
- **Task:** Created, completed, updated, deleted
- **Diary:** Entry saved
- **Sleep:** Monthly aggregation

---

## 🎯 Goal Management

### Goal Properties
```typescript
{
  id: string;
  title: string;
  description?: string;
  level: 'lifetime' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily';
  status: 'not_started' | 'in_progress' | 'completed' | 'paused' | 'blocked';
  priority: 1 | 2 | 3;  // 1=low, 2=normal, 3=critical
  dependsOn: string[];  // Goal IDs that must complete first
  unlocks: string[];    // Goal IDs this unlocks when completed
  timeSlotId?: string;  // Assigned time slot
  isArchived: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### Goal Lifecycle
1. **Created** → `status: 'not_started'`
2. **Started** → `status: 'in_progress'`, `startedAt` set
3. **Completed** → `status: 'completed'`, `completedAt` set, moved to `Goals/completed/` in Obsidian
4. **Archived** → `isArchived: true`, moved to `Goals/archive/`

### Dependencies
- `dependsOn`: Goals that block this goal
- `unlocks`: Goals that become available when this completes
- **UI Rule:** Blocked goals show with 🔒 icon

---

## ✅ Task Management

### Task Properties
```typescript
{
  id: string;
  title: string;
  description?: string;
  goalId?: string;          // Parent goal
  isCompleted: boolean;
  isDaily: boolean;         // CRITICAL: Resets on wake-up
  isArchived: boolean;
  estimatedMinutes: number; // Default 30
  actualMinutes?: number;   // Set on completion
  priority: 1 | 2 | 3;
  createdAt: string;
  completedAt?: string;
}
```

### Task Completion Flow
1. User clicks task checkbox
2. `completeTask(id)` called
3. Updates:
   - `isCompleted = true`
   - `completedAt = now()`
   - `actualMinutes = estimatedMinutes` (default)
4. Creates `ProductivityLog` entry
5. Creates `TimelineEvent`
6. Syncs to Supabase
7. Syncs to Obsidian (`Tasks/completed/`)

### **CRITICAL:** Daily vs Persistent Tasks
- **Daily Tasks (`isDaily: true`):** Reset every wake-up
- **Persistent Tasks (`isDaily: false`):** Stay completed until manually reset
- **Default:** `isDaily: true` (line 391 in store.ts)

---

## 🕐 Time Slots

### Default Slots
| Name | Type | Times | Purpose |
|------|------|-------|---------|
| Morning Routine | morning | 06:00-09:00 | Morning habits |
| Deep Work | deep_work | 09:00-12:00 | Focused work |
| Afternoon | afternoon | 12:00-17:00 | General tasks |
| Evening | evening | 17:00-22:00 | Wind down |

### Time Slot Properties
```typescript
{
  id: string;
  name: string;
  type: TimeSlotType;
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  goalIds: string[];  // Redundant array for UI
  isActive: boolean;
}
```

### Goal-Slot Relationship
**DUAL REFERENCE (Redundancy for reliability):**
1. `TimeSlot.goalIds[]` contains goal IDs
2. `Goal.timeSlotId` references slot

**Dashboard Display Logic:**
```typescript
// From dashboard/page.tsx line 44-49
const getGoalsForSlot = (slot) => {
  return goals.filter(g => 
    slot.goalIds.includes(g.id) || g.timeSlotId === slot.id
  );
};
```

---

## 🌅 Wake-Up Workflow

### Automatic Popup Rules
1. **Time Window:** 5 AM - 12 PM only
2. **Conditions:**
   - 4+ hours since `lastAppOpen`
   - No wake-up recorded for today
   - Not on `/diary` routes

3. **What Happens:**
   - WakeUpModal appears
   - User selects wake-up time (with 15min adjustment)
   - Optional mood selection (1-5)
   - `recordWakeUp()` called
   - `resetDailyTasks()` called
   - Wake-up email triggered

### Manual Entry (NEW)
- Available on `/sleep` page anytime
- Same WakeUpModal, same logic
- Bypasses time window restriction

---

## 😴 Sleep Workflow

### Recording Sleep
1. User navigates to `/sleep` or clicks "Going to Sleep"
2. `recordSleep()` called
3. Creates/updates `SleepWakeLog` for today:
   - `sleepTime = now()`
   - Calculates `sleepDurationMinutes` if wake-up exists
4. Triggers sleep summary email
5. Syncs to Supabase

### Sleep Metrics
- **Average Duration:** Last 30 days
- **Sleep Debt:** Total minutes below 8h/night
- **Mood Tracking:** 1-5 scale on wake-up

---

## 📔 Diary System

### Entry Structure
```typescript
{
  id: string;
  date: string;          // YYYY-MM-DD (unique)
  summary: string;       // Main text
  mood?: number;         // 1-5
  energyLevel?: number;  // 1-10
  wins?: string[];       // Extracted by AI
  challenges?: string[]; // Extracted by AI
  productivityData?: Record<string, number>;
  embedding?: number[];  // Vector for semantic search
}
```

### AI Extraction Flow
1. User writes free-form text
2. POST to `/api/diary/extract`
3. Ollama extracts structured data
4. Fallback: Pattern-based extraction if Ollama fails
5. Embedding generated via `@xenova/transformers`
6. Saved to `daily_entries` table
7. Synced to Obsidian `Diary/YYYY/MM/YYYY-MM-DD.md`

---

## 🔔 Notification System

### Push Notifications (Scheduled)
| Trigger | Time | Message | File |
|---------|------|---------|------|
| Morning Reminder | 7:00 AM | Focus goals + task count | `pushScheduler.ts` |
| Diary Reminder | 8:00 PM | "How was your day?" | `pushScheduler.ts` |
| Goal Deadline | 24h before | "Deadline approaching" | `pushScheduler.ts` |
| Task Completion | On complete | "Nice work!" | `pushScheduler.ts` |
| Time Slot End | End of slot | Tasks completed summary | `routineNotifications.ts` |

### Email Notifications
| Trigger | When | Content | File |
|---------|------|---------|------|
| Wake-Up Email | On wake-up | Daily plan, goals, weather | `emailTrigger.ts` |
| Sleep Email | On sleep | Day summary, achievements | `emailTrigger.ts` |

### Push Notification Setup
1. Service worker: `/public/sw.js`
2. Subscription API: `/api/push/subscribe`
3. Send API: `/api/push/send`
4. Test API: `/api/push/test`
5. VAPID keys required in Vercel env vars

---

## 🔐 Authentication

### Device Authorization
1. First visit → PIN entry at `/`
2. PIN validated via `/api/auth/validate-pin`
3. Device token generated and stored:
   - `localStorage.deviceToken`
   - `device_auth_tokens` table in Supabase
4. Future visits → Auto-validated

### Kill Switch
- Route: `/umbra`
- Action: Revokes ALL device tokens
- Forces re-authentication on all devices

---

## � Page Structure

| Route | Purpose | Key Features |
|-------|---------|--------------|
| `/dashboard` | Main view | Time slots, goals, tasks, productivity bar |
| `/create` | Create goal/task | Form with goal/slot linking |
| `/edit` | Edit entities | Time slots, goals, dependencies |
| `/timeline` | Progress view | Goal timeline, productivity charts |
| `/diary` | Journal | AI extraction, semantic search |
| `/sleep` | Sleep tracking | Wake-up/sleep recording, stats |
| `/profile` | User stats | Overview, settings link |
| `/settings/*` | Configuration | Database, notifications, profile |
| `/search` | Semantic search | Vector search across diary/goals |

---

## � Known Issues & Fixes

### 1. Daily Tasks Not Resetting
**Issue:** Tasks only reset if wake-up popup appears (5 AM - 12 PM)
**Fix Needed:** Add date-change check in AppInitializer

### 2. Completed Tasks Persist
**Issue:** Non-daily tasks stay completed forever
**Workaround:** Manual reset or archive
**Design:** This is intentional for persistent tasks

### 3. Timeline Events Accumulate
**Issue:** No automatic cleanup of old events
**Fix Needed:** Add retention policy (e.g., 90 days)

---

## � Key Files Reference

| File | Purpose | Critical Functions |
|------|---------|-------------------|
| `src/lib/store.ts` | Zustand state | `resetDailyTasks`, `completeTask`, `addGoal` |
| `src/lib/supabaseSync.ts` | Database sync | `saveTask`, `saveGoal`, `loadAllFromSupabase` |
| `src/lib/obsidian-sync.ts` | GitHub sync | `syncGoal`, `syncTask`, `syncDiaryEntry` |
| `src/lib/pushScheduler.ts` | Push notifications | Scheduled notification triggers |
| `src/lib/emailTrigger.ts` | Email notifications | `triggerWakeUpEmail`, `triggerSleepEmail` |
| `src/components/AppInitializer.tsx` | App startup | Wake-up popup logic, data loading |
| `src/app/globals.css` | Global styles | iOS safe areas, touch targets |

---

## 🚨 CRITICAL RULES - DO NOT BREAK

1. **NEVER remove `isDaily` property from tasks**
2. **ALWAYS call `resetDailyTasks()` on wake-up**
3. **ALWAYS dual-write to Supabase + Obsidian**
4. **NEVER modify timeline events after creation** (immutable log)
5. **ALWAYS check `isDaily` before resetting tasks**
6. **NEVER change Obsidian folder structure** without migration
7. **ALWAYS log to timeline for significant events**
8. **NEVER skip RLS policies in Supabase**

---

## 📝 Enhancement Checklist

Before making ANY change:
- [ ] Read this WORKFLOWS.md
- [ ] Identify affected workflows
- [ ] Check if change breaks timeline system
- [ ] Verify Obsidian sync still works
- [ ] Test daily task reset
- [ ] Update this document if workflows change
- [ ] Test on iPhone 14 (safe areas, touch targets)
