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
