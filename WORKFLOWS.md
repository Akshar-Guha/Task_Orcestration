# Goal Tracker - Product Workflows & Rules

> This document defines ALL core workflows, business rules, and page behaviors.
> Any enhancement must follow these rules. Updated: 2026-01-19

---

## 📱 Application Structure

### Pages Overview
| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/dashboard` | Main view - time slots, goals, tasks, productivity |
| Create | `/create` | Create new goals or tasks |
| Edit | `/edit` | Edit time slots, goals, and their relationships |
| Diary | `/diary` | Daily journal/reflection system |
| Sleep/Wake | `/sleep` | Record sleep and wake times |
| Timeline | `/timeline` | Event history view |
| Profile | `/profile` | User profile and stats |
| Settings | `/settings/*` | App configuration |
| Search | `/search` | Semantic search across all content |

---

## 🌅 Wake-Up Workflow

### Current Rules
1. **When popup appears:**
   - Morning hours only: 5 AM - 12 PM
   - 4+ hours since last app interaction
   - No wake-up already recorded for today
   - Not on `/diary` routes

2. **User records wake-up time:**
   - Stores to `sleepWakeLogs` table
   - Can optionally select initial mood
   - Triggers wake-up email notification

### Bug Fix Needed: Manual Entry
**ISSUE:** If user misses the popup window, there's no way to manually enter wake-up time.
**SOLUTION:** Add manual entry button on `/sleep` page.

---

## 😴 Sleep Recording Workflow

### Current Rules
1. User manually navigates to `/sleep` page
2. Clicks "Go to Sleep" button
3. Records current time as sleep time
4. Triggers sleep summary email

---

## 🎯 Goal Management Workflow

### Goal Properties
- `title`, `description`
- `status`: not_started, in_progress, completed, paused
- `priority`: 1 (highest), 2, 3 (lowest)
- `level`: lifetime, yearly, quarterly, monthly, weekly, daily
- `timeSlotId`: Links goal to a time slot
- `dependsOn[]`: Goal dependencies
- `unlocks[]`: Goals this unlocks when completed

### Goal Creation Rules
1. Must have a title
2. Automatically assigned to user ID
3. Optionally linked to time slot
4. Synced to Supabase immediately
5. Synced to Obsidian (GitHub markdown)

---

## ✅ Task Management Workflow

### Task Properties
- `title`, `description`
- `goalId`: Parent goal (required)
- `estimatedMinutes`: Task duration
- `isCompleted`: Completion status
- `priority`: 1, 2, or 3

### Task Completion Rules
1. Mark task complete → logs productivity
2. Updates `timelineEvents` table
3. Adds to today's productivity metrics
4. Can trigger "task completed" push notification

---

## 🕐 Time Slots Workflow

### Default Time Slots
| Name | Type | Default Times |
|------|------|---------------|
| Morning Routine | morning | 06:00 - 09:00 |
| Deep Work | deep_work | 09:00 - 12:00 |
| Afternoon | afternoon | 12:00 - 17:00 |
| Evening | evening | 17:00 - 22:00 |

### Time Slot Rules
1. Goals are assigned to time slots via `timeSlotId`
2. Time slots have a `goalIds[]` array (redundant for UI)
3. Dashboard displays goals under their time slots
4. Productivity is calculated per time slot

---

## 📔 Diary Workflow

### Entry Creation
1. User writes free-form text
2. AI extracts structured data:
   - Mood (1-5 scale)
   - Energy level (1-5 scale)
   - Wins (array of strings)
   - Challenges (array of strings)
   - Productivity data
3. Stored in `daily_entries` table
4. Embedding generated for semantic search

### Entry Properties
- `date`: Entry date (unique per day)
- `summary`: Main text content
- `mood`, `energyLevel`: 1-5 ratings
- `wins[]`, `challenges[]`: Extracted insights
- `embedding`: Vector for semantic search

---

## 🔔 Notification Workflow

### Push Notification Triggers
| Trigger | When | Message |
|---------|------|---------|
| Morning Reminder | 7:00 AM daily | Focus goals + task count |
| Diary Reminder | 8:00 PM daily | Prompt to write reflection |
| Goal Deadline | 24h before due | Deadline approaching warning |
| Task Completion | On complete | Celebration message |
| Time Slot Summary | End of each slot | Tasks completed summary |

### Email Triggers
| Trigger | When | Content |
|---------|------|---------|
| Wake-up Email | On wake-up record | Daily plan, goals, weather |
| Sleep Email | On sleep record | Day summary, achievements |

---

## 💾 Data Sync Workflow

### Supabase (Primary Database)
- All changes save immediately via `supabaseSync.ts`
- RLS policies protect user data
- Service role key for admin operations

### Obsidian (Markdown Backup)
- Syncs to GitHub repository on goal/task changes
- Creates markdown files with YAML frontmatter
- Path: `/Goals/[goal-name].md`

---

## 🔐 Authentication Workflow

### Device Authorization
1. First visit → PIN entry required
2. PIN matches → Device token generated
3. Token stored in localStorage + `device_auth_tokens` table
4. Future visits → Automatic validation

### Kill Switch
- Available at `/umbra` route
- Revokes all device tokens
- Requires re-authentication on all devices

---

## 📊 Productivity Tracking

### How It's Calculated
1. Each completed task adds `estimatedMinutes` to daily total
2. Stored in `productivity_logs` table
3. Dashboard shows: `completedMinutes / 480` (8hr day) as percentage

---

## 🚨 Known Issues & Rules

### Wake-Up Popup
- **Rule:** Only shows 5 AM - 12 PM
- **Issue:** No manual entry if missed
- **Fix:** Add manual entry on `/sleep` page

### Data Display
- **Rule:** Goals show via BOTH `slot.goalIds[]` OR `goal.timeSlotId`
- **Rationale:** Redundancy for reliability

### Touch Targets
- **Rule:** All buttons/links minimum 44px height/width (iOS requirement)

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/store.ts` | Zustand state management |
| `src/lib/supabaseSync.ts` | Database sync functions |
| `src/components/AppInitializer.tsx` | App startup logic |
| `src/lib/pushScheduler.ts` | Push notification scheduling |
| `src/lib/emailTrigger.ts` | Email notification triggers |
| `src/app/globals.css` | Global styles + iOS fixes |
