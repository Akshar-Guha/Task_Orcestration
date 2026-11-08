# Goal Tracker × Health Data — Product & Backend Plan

> **Status: living document, incomplete on purpose.**
> Part A covers only the *health-data* features. Part B is the start of the
> *app-level* rework: how the whole backend changes so the app's purpose —
> planning your day, keeping goals and habits honest, and reflecting on it —
> is fulfilled and enhanced automatically by watch data, with no manual
> re-entry. **Part B must be expanded further** as each area is designed.

Principle for everything below: **the app should never ask for something the
watch already knows, and every decision the app makes (plan, nudge, review,
email) should be informed by the body's state at that moment.**

---

## Current state (8 Nov 2026)

- Garmin Health API app created in the developer portal (status: *Pending*).
  Client ID/secret live in Vercel. OAuth connect flow, webhook receiver,
  backfill and settings page are deployed to production.
- Direct watch route (Connect IQ watch face / app for vívoactive 5) sends HR,
  stress, Body Battery, SpO₂ and daily totals every 5 min to
  `/api/watch/ingest`. Not yet installed on the watch.
- Raw data lands in `garmin_summaries` (full JSON), `watch_samples`,
  `watch_daily`. **Nothing in the app consumes it yet.**
- Manual inputs that still exist and must go: sleep/wake buttons, exercise
  habit tick, energy slider, step counter from Android.

Data we will receive (per Garmin Health API, every watch sync):
`dailies` (steps, distance, calories, intensity minutes, resting/avg/max HR,
stress avg/max + time in stress bands, Body Battery charged/drained/high/low),
`sleeps` (start/end, stages, score, overnight HRV/respiration/SpO₂),
`hrv`, `stressDetails` (3-min stress + Body Battery series),
`pulseox`, `allDayRespiration`, `userMetrics` (VO₂ max, fitness age),
`activities`, `bodyComps`, `epochs` (15-min activity/HR).

---

## Part A — Health features that replace paid products

None of this sends Garmin data to an LLM (Garmin terms + our privacy page).
Scores are deterministic; coaching text is rule-generated. All scores are
computed against **your own rolling baseline**, not population norms.

| # | Feature (who charges) | Computation | Value to you | Status |
|---|---|---|---|---|
| A1 | **Recovery score** (Whoop $30/mo, Oura $6/mo) | Overnight HRV, resting HR, respiration, sleep duration/efficiency vs. 30-day baseline → 0–100 | Morning green/yellow/red, personal to you | planned |
| A2 | **Strain + daily strain target** (Whoop) | Time-in-HR-zones (epochs + activities) + intensity minutes → load; recovery sets tomorrow's target | "Room for a hard session" / "stay easy" | planned |
| A3 | **Sleep debt + energy schedule** (Rise $70/yr) | 14-day sleep need vs. actual; sleep midpoint → chronotype → predicted peaks/dips | Planner places deep work in your peak window | planned |
| A4 | **Illness early warning** (Oura Symptom Radar) | Same-night deviation: RHR ↑, HRV ↓, respiration ↑, SpO₂ ↓ | "Lighten today" 1–2 days before symptoms | planned |
| A5 | **Burnout risk index** (corporate wellness $5–15/user/mo) | 14-day stress load + sleep debt + HRV slope **+ task-completion rate + diary mood** | What no wearable app can do: it sees your work too | planned |
| A6 | **Fitness / fatigue / form** (TrainingPeaks $20/mo) | Activities + HR → TSS → CTL/ATL/TSB | Peak vs. flat; when to rest | planned |
| A7 | **Behaviour → outcome correlations** (Whoop Journal, Exist.io) | Diary tags/habits (caffeine, alcohol, screens, late work) vs. next-day recovery & productive hours | "Alcohol costs you 11 HRV and 1.5 productive hours" | planned |
| A8 | **Monthly performance report** (Whoop MPA, Garmin Connect+ $7/mo) | Auto PDF/email from A1–A7 | Replaces the Connect+ subscription | planned |

Build order: **A1 → A3 → A5 → A4 → A2 → A6 → A7 → A8.**
A1–A4 need ~14 days of history to be trustworthy → backfill 90 days on connect.

---

## Part B — App-level changes (backend) so the whole app runs on health data

> **TODO: expand each section below into a concrete spec.** This is the
> skeleton of the app-wide redesign, not just the health module.

### B1. Ingestion → processing pipeline (foundation)
- Every webhook / watch push triggers `processHealth(userId, date)`:
  normalises raw summaries into **one `health_day` row per date** (sleep,
  recovery, strain, stress load, Body Battery curve, steps, HRV, RHR,
  readiness) + `health_samples` time series. Idempotent: Garmin re-sends and
  late sleep revisions recompute the day, never duplicate.
- Precedence rule: Garmin API > watch-app sync > manual, per field.
- `garmin_webhook_log` for replay; nightly gap check → auto-backfill.
- **TODO:** schema for `health_day`; baseline tables (30-day rolling stats).

### B2. Kill every manual input the watch already answers
- `sleep_wake_logs` written by the pipeline; Sleep page → read-only card
  with "correct this" override. Wake-up modal keeps **mood only**.
- "Exercise" habit auto-completed from activities / intensity minutes.
- Energy slider → prefilled from Body Battery, optional.
- Android step counter + `sensor_logs` removed.
- **TODO:** audit `daily_entries`, `questions`, diary quick-capture for
  other fields the body already answers.

### B3. Planner & tasks become body-aware
- Daily plan capacity = f(recovery, sleep debt, chronotype window).
  Low recovery → fewer goal-hours proposed, hard tasks moved later.
- Time slots: deep-work blocks placed in predicted energy peaks (A3).
- Task reviews / adaptive LLM questions: ask "why" only when the body
  explains it already ("you slept 4h — skip the post-mortem").
- **TODO:** define capacity formula; how `time_slots` and `daily_task_status`
  consume `health_day`.

### B4. Notifications & nudges driven by live state
- Existing push + `notification_rules` gain **health triggers**: sustained
  stress during a task → break nudge; Body Battery below evening baseline →
  "move remaining tasks"; illness flag → cancel non-essential reminders.
- Morning email = readiness + plan for the day; night email = strain, sleep
  target, and tomorrow's suggested bedtime (from sleep debt).
- **TODO:** rule DSL for health conditions in `notification_rules`.

### B5. Goals & habits scoring
- Goal/habit scores weighted by what the body was capable of that day
  (a 60% day on a red-recovery day is a win, not a miss).
- Streaks aware of illness days (freeze, not break).
- **TODO:** scoring changes in `/api/goals`, `/api/habits`, diary stats.

### B6. Diary, reflection and memory
- Each diary day auto-gets a health header (sleep, recovery, stress peaks);
  weekly/monthly stats include A7 correlations.
- Obsidian/Khoj sync exports the health header so notes are searchable by
  body state ("days I felt great").
- **TODO:** markdown format; privacy — health data in Obsidian vault is
  user-controlled, never sent to Groq/Khoj cloud.

### B7. ML dataset & long-term model
- `/api/export/ml-dataset` becomes the single joined table: health_day ×
  tasks × habits × diary. Target variables: productive hours, goal
  completion, mood.
- **TODO:** feature list; where personal models run (on-device/local only,
  never trained on Garmin data per their terms).

### B8. Platform / ops
- Single `health` domain module (`src/lib/health/*`) with pure functions
  (testable with sample Garmin payloads).
- Cron: nightly recompute (baselines, debt, CTL/ATL), weekly report.
- Security: webhook user verification, payload cap, key rotation checklist.
- Observability: last-sync, gaps, score history page in Settings.
- **TODO:** test fixtures from real Garmin payloads once approved.

### B9. Watch as a two-way terminal for routine tasks
- Connect IQ app polls `GET /api/watch/tasks` every 5 min (Garmin minimum);
  due routine task → vibration + wake notification; on-wrist list of today's
  routine tasks with **Done / Snooze 15 / Skip (reason)** →
  `POST /api/watch/tasks/{id}/action` (reuses push ack/action logic).
- Quick-capture presets ("idea", "low energy", "distracted", "break") logged
  with timestamp + current HR/stress → feeds A7 correlations.
- Glance widget: next task + time left. Health-aware timing (B4): alerts
  wait during workouts / stress spikes.
- iPhone limit: mirrored push is display-only; all actions go through the
  CIQ app. Phone push stays alongside; ack on either clears both.
- **TODO:** endpoint contracts; offline queue on watch when phone is away.

---

## Part C — More paid / enterprise features we can build for free

Prices are approximate 2026 list prices; several vendors changed pricing this
year and sources conflict. "Needs" = data we already have or will have.

### C1. Planning & time (Motion ~$19–29/mo, Reclaim ~$10/mo, Sunsama ~$20/mo)
| Feature | Needs | What we build |
|---|---|---|
| **Auto-scheduling / auto-rescheduling** of tasks into free slots | tasks, time_slots | Planner fills slots by priority + deadline; re-plans when a task overruns or recovery is low (B3) |
| **Habit / focus-time protection** (Reclaim "Habits") | routine tasks | Routine tasks are reserved blocks the scheduler can't overwrite; defended by watch nudges (B9) |
| **Daily planning ritual + shutdown ritual** (Sunsama) | diary, tasks | Morning: plan sized by readiness; evening: unfinished → tomorrow, with sleep target from debt |
| **Workload / capacity view** | tasks + health_day | Week view shows planned hours vs. body-adjusted capacity, not a flat 8h |
| **Buffer & travel time, meeting recovery** | calendar (if connected later) | Insert recovery gaps after high-stress blocks (stress series shows which ones) |

### C2. Focus & attention (Rize ~$10–24/mo, Opal ~$100/yr, Freedom ~$40/yr)
| Feature | Needs | What we build |
|---|---|---|
| **Automatic focus/work-session detection** | watch HR/stress + task in progress | A started task + stable HR/stress = focus session; spikes = interruption, logged automatically |
| **Focus score & "best focus hours"** | epochs, stress, task completion | Hours of day where you complete most with lowest stress → feeds energy schedule (A3) |
| **Break reminders by physiology, not timer** (Rize) | 5-min watch data | Already B4: stress plateau → break nudge on wrist |
| **Overwork alerts** | strain + late-work diary tags | "3rd day >10h with falling HRV" warning |

### C3. Sleep & circadian (Rise ~$70/yr, Sleep Cycle ~$40/yr, Garmin Connect+ ~$7/mo)
| Feature | Needs | What we build |
|---|---|---|
| **Sleep debt, sleep need, melatonin window, bedtime target** | sleeps, 14-day history | A3; bedtime target pushed in night email + watch |
| **Social jet-lag / consistency score** | sleep midpoints | Weekly consistency score; correlate with productive hours |
| **Nap advisor** | Body Battery curve, afternoon dip | "A 20-min nap at 14:30 would lift Body Battery before your 16:00 block" |
| **Sleep coaching rules** (Connect+ "Sleep Coach") | sleeps + activities + stress | Rule-based advice ("your HRV is lower after sessions ending >20:00") |

### C4. Recovery, training & longevity (Whoop ~$25–40/mo, Oura ~$6/mo, Garmin Connect+)
| Feature | Needs | What we build |
|---|---|---|
| **Recovery, strain, fitness/fatigue/form** | A1, A2, A6 | — |
| **Cardiovascular age / VO₂ max trend / resilience** | userMetrics, RHR, HRV | Trend lines + "what changed" explanations from correlations |
| **Workout readiness + suggested session type** (Garmin Connect+ Training Readiness) | recovery, strain, CTL/ATL | "Easy aerobic 40 min" vs. "intervals OK" each morning |
| **Chronic stress / resilience score** (Oura Resilience) | stress bands, Body Battery charge/drain | Daytime recovery vs. night recovery balance over 2 weeks |
| **Women's health cycle-aware adjustments** (Oura/Whoop) | Women's Health API (optional) | Phase-aware recovery baselines if enabled |

### C5. Stress & mental health (Welltory ~$5–10/mo, Lief, Calm/Headspace ~$70/yr, Bearable)
| Feature | Needs | What we build |
|---|---|---|
| **Stress load timeline with causes** | stressDetails + tasks/timeline | Overlay stress series on your task timeline → which tasks/people/meetings spike you |
| **Guided breathing when stress crosses threshold** (Lief) | 5-min watch data | Watch nudge opens the watch's built-in Breathwork; we log before/after stress |
| **Mood ↔ physiology correlation** (Bearable) | diary mood + health_day | "Your mood tracks HRV 2 days later" style insights (A7) |
| **Burnout index** | A5 | — |

### C6. Habit & journaling (Streaks ~$5, Day One ~$35/yr, Reflectly, Exist.io ~$6/mo)
| Feature | Needs | What we build |
|---|---|---|
| **Auto-completed habits** (exercise, steps, bedtime, no-late-caffeine via HR) | activities, dailies, sleeps | B2/B5 |
| **Smart streak freeze on illness / travel** | A4 illness flag | B5 |
| **"On this day" + body-state header on every entry** (Day One) | diary + health_day | B6 |
| **Cross-domain correlations dashboard** (Exist.io) | everything | A7 as a page, not just a weekly card |

### C7. Enterprise wellbeing & analytics (Virgin Pulse / Wellhub ~$5–15/user/mo, Gyroscope ~$30/mo)
| Feature | Needs | What we build |
|---|---|---|
| **Personal "life dashboard"** (Gyroscope) | all tables | One page: readiness, strain, focus score, goals, mood, sleep — 7/30/90 day |
| **Health-risk flags & trends** | RHR, SpO₂, respiration, VO₂ | Long-term drift alerts (e.g. resting HR +5 over 3 months) |
| **Monthly / quarterly performance report (PDF)** | A8 | — |
| **Data ownership: full export, replay, local ML** | B7 | — |

### C8. Watch-side (Garmin Connect+ "Active Intelligence", third-party CIQ apps $2–10)
| Feature | Needs | What we build |
|---|---|---|
| **Personalised on-wrist insights** | health_day + tasks | Glance text generated by rules ("Readiness 82 — good day for the hard task") |
| **Routine tasks & two-way actions on the wrist** | B9 | — |
| **Context capture with physiology** | B9 quick-capture | — |

Everything in C respects: no Garmin data to LLMs; all baselines personal;
nothing duplicated from the built-in Garmin Connect app (raw charts).

---

## Part D — UI principles (anti-flooding rules, apply to every feature)

Most features produce **decisions, not screens**. They run in the background
and change what the app already shows.

1. **No new tabs.** Nav stays Home · Goals · Create · Sleep(→Body) · Diary.
   Garmin/watch connection lives in Settings only.
2. **One number per surface.** Dashboard gets a single *Readiness* line
   (score + one sentence). Recovery, strain, sleep debt, illness, burnout fold
   into it; tap for breakdown.
3. **Insights only when actionable.** A card appears only on the day it
   matters (illness flag, burnout trend, nap suggestion), never "because we
   have the data".
4. **All health detail in one place.** Sleep page becomes *Body*: one
   scrolling page, sections collapsed by default (trends, CTL/ATL, VO₂,
   correlations).
5. **Watch shows less than the phone.** Glance = next task + readiness.
   App = task list + actions. Nothing else.
6. **Gate for every new feature:** it must change an existing number, send
   one nudge, or add at most one card. Needs its own page → doesn't ship
   until proven useful.
7. **Removals offset additions.** Sleep/wake buttons, energy slider,
   exercise tick, Android step counter are removed; net screen count must
   go down.

---

## Open questions
- Which features of the built-in Garmin Connect app should we deliberately
  **not** rebuild (raw HR/steps charts, sleep-stage pie)? Default: none of them.
- Should the direct watch-app sync stay once the Health API is approved, or
  only for the 5-minute live stress/Body Battery nudges?
- How much of B3 (planner capacity) should be automatic vs. suggested?
