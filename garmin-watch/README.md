# Goal Tracker — Garmin watch app (vívoactive 5)

**Background (every 5 min, through Garmin Connect on the paired iPhone):**
POSTs heart rate, stress, Body Battery, SpO₂ and today's steps/calories/active
minutes to `/api/watch/ingest`, then GETs today's routine tasks from
`/api/watch/tasks`. When a task becomes due (its notification rule time, or
its snooze ends) the watch asks *"Task due: …"*; confirming opens the app,
buzzes and focuses that task.

**App:** today's routine tasks (gold dot = done, gold ring = due now, half ring =
snoozed, dash = skipped; sublabel = due time). Tap a task → **Done / Snooze 15 min /
Skip** (reason: busy, low energy, not needed) → `POST /api/watch/tasks/{id}/action`.
This is the same record the phone push "Yes" writes and it acks the push alarm,
so whichever you answer first silences the other. **Quick capture** logs idea /
low energy / distracted / break / win with current HR, stress and Body Battery
(`POST /api/watch/capture`). Actions are saved on the watch first and sent when
the phone is reachable ("N waiting for phone" under *Sync now*).

**Glance:** next task + readiness + done/total.

No new keys in `Config.mc`: the task and capture URLs are derived from `INGEST_URL`.

## Build (once, on a Mac or Windows PC)
1. Install the Connect IQ SDK Manager: https://developer.garmin.com/connect-iq/sdk/
   Sign in with your Garmin account, install the latest SDK, and under
   **Devices** download **vívoactive 5**.
2. Create `../garmin-shared/Config.mc` from `../garmin-shared/Config.mc.example` and set
   `INGEST_KEY` to the same value as `WATCH_INGEST_KEY` in Vercel.
3. Generate a developer key (once):
   `openssl genrsa -out developer_key.pem 4096 && openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt`
4. Build:
   `monkeyc -d vivoactive5 -f monkey.jungle -o bin/GoalTrackerSync.prg -y developer_key.der`
   (add `-l 2` to see type-checker warnings; it builds clean apart from older
   warnings in the sensor code)

## Install
Connect the watch by USB and copy `bin/GoalTrackerSync.prg` into `GARMIN/APPS/`
on the watch (macOS needs the free *OpenMTP* app for this). Unplug, then open
**Goal Tracker** from the watch's app list once. It keeps syncing after that.
Add the glance from the watch's glance list (swipe up → Edit → Add).
