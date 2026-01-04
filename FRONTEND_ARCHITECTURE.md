# Frontend Architecture Documentation

## 1. High-Level Overview

This application is a **Goal Tracking & Life Management System** built as a **Progressive Web App (PWA)**. It is designed to act as an "Operating System for Life," integrating high-level long-term goals with granular daily actions, sleep tracking, and routine management.

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Variables (Deep Space Theme)
- **State Management**: Zustand (with Persist middleware)
- **Animations**: Framer Motion
- **Icons**: Standard Emoji + Lucide React (planned)

---

## 2. Core Systems & Modules

The application is divided into several interconnected systems:

### A. Goal & Task Management (`/goals`, `/planner`)
- **Hierarchy**: Yearly -> Quarterly -> Monthly -> Weekly Goals.
- **Task Linkage**: Tasks can be linked to multiple goals with weighted contributions.
- **Architecture**:
  - `Goal` and `Task` interfaces defined in `types.ts`.
  - CRUD operations handled centrally in `store.ts`.

### B. Life Routines System (`/dashboard`)
- **Purpose**: Connects daily actions to core life pillars (Health, Money, Relationships).
- **Structure**:
  - **Life Routine**: Top-level category (e.g., "Health").
  - **Sub-Routine**: Actionable group (e.g., "Morning Workout").
  - **Routine Task**: Specific checklist item.
- **Visuals**: Color-coded progress bars on the Dashboard.

### C. Timeline System (`/timeline`)
- **Views**: Daily (24h), Weekly, Monthly, Quarterly, Yearly.
- **Logic**: Visualizes `TimeSpec` data (start/end times) for tasks.
- **Timezone**: Hardcoded to **IST (Asia/Kolkata)** for consistency.

### D. Sleep/Wake Tracker (`/sleep`, `/profile`)
- **Logic**:
  - **Sleep Mode**: Tracks "Sleep Attempts" timestamps.
  - **Wake Up**: records wake time and "Wake Up Mood" (1-5 scale).
  - **Activity Tracking**: Global event listeners monitoring mouse/keyboard activity to infer wakefulness.
- **Components**: `SleepButton`, `WakeUpModal`.
- **Data**: Stored in `sleepWakeLogs` array.

---

## 3. Directory Structure

```
src/
├── app/                  # Next.js App Router
│   ├── create/           # Universal creation form (Task/Goal)
│   ├── dashboard/        # Main landing view
│   ├── edit/             # System configuration
│   ├── goals/            # Goal browser
│   ├── logs/             # Activity history
│   ├── planner/          # Daily task list
│   ├── profile/          # User stats & settings
│   ├── sleep/            # Sleep analytics page
│   ├── timeline/         # Calendar views
│   └── globals.css       # Global styles & specific CSS variables
├── components/
│   ├── layout/           # Structural components
│   │   ├── AppShell.tsx  # Main layout wrapper + Activity Listeners
│   │   ├── Header.tsx    # Top navigation
│   │   └── MobileNav.tsx # Bottom navigation bar
│   ├── sleep/            # Sleep-specific UI
│   └── ui/               # Reusable primitives (Buttons, Cards)
└── lib/
    ├── store.ts          # Central Zustand store (Logic Core)
    └── types.ts          # TypeScript interfaces (Data Contract)
```

---

## 4. State Management (Zustand)

State is managed globally via `store.ts` using the `persist` middleware to save to `localStorage`.

### Key Store Slices:
1.  **Core Data**: `goals`, `tasks`, `links`.
2.  **Routines**: `lifeRoutines`, `subRoutines`, `routineTemplates`.
3.  **Tracking**: `activities`, `sleepWakeLogs`, `dailyStats`.
4.  **UI State**: `nodePositions` (for graphical views), `lastInteraction` (for activity tracking).

### Data Persistence
- **Storage**: `localStorage` (Key: `goal-tracker-storage`)
- **Hydration**: Auto-hydrates on app launch.

---

## 5. Design System

### Theme: "Deep Space"
- **Backgrounds**: Dark Slate (`slate-950`) to Deep Violet (`violet-950`).
- **Surface**: Translucent Glassmorphism (`bg-slate-900/50`).
- **Accents**:
  - **Violet**: Primary/Action
  - **Emerald**: Success/Health
  - **Amber**: Money/Energy
  - **Rose**: Relationships/Alerts

### Responsive Strategy
- **Mobile First**: Design targets mobile viewports first.
- **Navigation**:
  - **Mobile**: Sticky Bottom Navigation Bar.
  - **Desktop**: (Planned) Sidebar or Top Nav.
- **Layout**: `max-w-md` to `max-w-4xl` containers centered on screen.

---

## 6. Key Data Interfaces (`types.ts`)

### `Goal`
```typescript
{
  id: string;
  level: 'yearly' | 'quarterly' | 'monthly' | 'weekly';
  lifeRoutineLinks: LifeRoutineLink[]; // Link to Health/Money/etc
  // ...
}
```

### `SleepWakeLog`
```typescript
{
  date: string; // ISO Date
  wakeUpTime?: string;
  sleepTime?: string;
  wakeUpMood?: 1 | 2 | 3 | 4 | 5;
  sleepDurationMinutes?: number;
}
```

---

## 7. Data Relationships (Entity-Relationship)

The system is built on a relational-like model managed in memory.

### Key Relationships:

1.  **Task ↔ Goal (Many-to-Many)**
    *   Managed by `TaskGoalLink` interface in `types.ts`.
    *   Attributes: `contributionWeight` (allows a task to contribute 30% to Goal A and 70% to Goal B).
    *   Access: `store.getLinksForTask(taskId)` / `store.getLinksForGoal(goalId)`.

2.  **Goal/Task ↔ Life Routine (Many-to-Many)**
    *   Managed by `lifeRoutineLinks` array on both `Goal` and `Task` objects.
    *   Purpose: Allows any action (writing code) to contribute to a Life Pillar (e.g., "Money").
    *   Structure: `{ lifeRoutineId: string; weight: number }`.

3.  **Life Routine → Sub-Routine (One-to-Many)**
    *   Strict hierarchy: Health (Life Routine) contains Exercise (Sub-Routine).
    *   Managed via `lifeRoutineId` fk on `SubRoutine` object.

4.  **Sub-Routine → Routine Task (One-to-Many)**
    *   Sub-Routines contain specific check-listable tasks (SubRoutineTask).
    *   These are *distinct* from the main `Task` entity (which are project/goal-oriented).

5.  **Routine Template → Daily Task Instance**
    *   Templates (e.g., "Morning Routine") spawn `DailyTaskInstance` records for each day.
    *   Allows tracking completion history while keeping templates editable.

---

## 8. Future Roadmap Hooks
- **Backend Integration**: Store structure is ready to be swapped for API calls (Supabase).
- **Notifications**: Service Workers setup required for push notifications.
- **AI Integration**: `details` field in Activity Logs ready for LLM processing.
