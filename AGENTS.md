# Codex project handoff

## Project identity

- GitHub repository: Akshar-Guha/Task_Orcestration (spelling is intentional).
- Repository ID: 1124092115.
- Default branch: main.
- Current Garmin and health feature branch: claude/great-ptolemy-srs1yf.
- Production site: https://goal-tracker-web.vercel.app
- Garmin settings: https://goal-tracker-web.vercel.app/settings/garmin

## GitHub and Vercel access

Use the user's connected GitHub and Vercel apps when their tools are available.
Discover the current tool schemas before calling them; account selectors may
change between sessions.

For this repository, select the Vercel connection named
"Portfolio/task_orcastration", belonging to aksharguha123@gmail.com
(username umbra01), rather than the separate "Primary" / um-bra account.
The latter contains mgmt-aarez and is not the GoalTracker owner.

- Vercel team slug: umbrag
- Vercel team ID: team_tHzEFJfrhm58j52mVMTzopdF
- Vercel project name: goal-tracker-web
- Vercel project ID: prj_gCHtc43TkxQSRA7YOgSmg7vPYWQV

Verify the selected project and live domain before changing configuration or
deploying. Inspect production's current commit; do not assume main or the newest
preview is already live. The feature branch above was serving production as of
2026-11-15; verify this again before future changes.

If Vercel returns a team-authorization 403, request team access for the team above
using the matching account connection and give the user the returned approval
link. Do not send them through reconnecting an already valid account.
If tools or authentication are unavailable, explain the specific missing access.
This file records project context, not credentials or authorization for new work.

## Garmin maintenance

Garmin OAuth token requests (authorization code and refresh) use HTTP Basic
authentication with the configured client ID and secret. Preserve PKCE and
single-use state checks. Garmin's current reference implementation is:
https://apis.garmin.com/tools/js/oauth2Confirm.js

The Basic-auth fix was committed as f48b4eb1165e5a0894f0fd73f76a064b94e695bf
and deployed to production on 2026-11-15. Actual Garmin consent and data sync still
require end-to-end verification; deployment success alone does not prove them.

Keep PINs, client secrets, watch ingestion keys, and access/refresh tokens out of
repository files, chat output, command arguments, and logs. Do not put raw
upstream response bodies into user-facing redirect URLs.

## Reading the user's Garmin and watch data in future sessions

When the user requests their Garmin/health data, use the app's authenticated
read-only APIs rather than asking them to repeatedly export data:

- GET /api/garmin/status: configured/connected state, last sync, summary counts,
  and latest Garmin summaries.
- GET /api/watch/latest: timestamped heart rate, stress, Body Battery, SpO2,
  and the most recent daily totals.
- GET /api/health/today: processed health and up to 31 days of history.

All three require the x-site-pin request header. For an authorized health-data
request, obtain the production SITE_PIN securely through the connected Vercel
project's environment-variable tools; discover the variable ID from metadata,
then retrieve only that variable. Do not print its value. Use it only in an
HTTPS request header to the exact production origin above, with redirects
disabled. Never put it in a URL, command argument, or committed configuration.
If a temporary credential file is necessary, keep it in a private directory,
delete it immediately after the request, and do not persist health responses
unless requested. Use supported connected HTTP capabilities where available;
shell HTTP requests require the execution environment's network access.

Report connected status and lastDataAt separately from data availability.
Check reading timestamps and daily dates: /api/watch/latest's "today" and
/api/health/today's "today" may actually contain the most recent historical day.
A 200 page response does not verify OAuth, ingestion, or fresh readings.
A 401 is an authentication failure; a 404 may indicate an older deployment.
Do not disconnect, request backfills, or reauthorize Garmin merely to read data.

## Production auto-deploy caveat

As of 2026-11-15, committing to main can automatically replace production with
the older main app, even while the Garmin feature branch is deployed.
Documentation-only commits to main are therefore not deployment-neutral.
Check automatic deployment state before and after edits. Reconcile production
with the exact user-authorized commit; do not change production-branch settings
or merge branches without task authorization.
