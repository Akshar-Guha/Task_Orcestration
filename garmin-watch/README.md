# Goal Tracker Sync — Garmin watch app (vívoactive 5)

Runs in the background on the watch every 5 minutes and POSTs heart rate,
stress, Body Battery, SpO₂ and today's steps/calories/active minutes to
`/api/watch/ingest`, through the Garmin Connect app on the paired iPhone.

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

## Install
Connect the watch by USB and copy `bin/GoalTrackerSync.prg` into `GARMIN/APPS/`
on the watch (macOS needs the free *OpenMTP* app for this). Unplug, then open
**Goal Tracker Sync** from the watch's app list once. It keeps syncing after that.
