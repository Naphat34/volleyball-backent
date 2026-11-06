# Match settings

The scorer dashboard's match details and review entry points share a “ตั้งค่าแมตซ์” dialog. Four editable tabs cover competition details, team display names and players, team staff, and match officials. Set results and result confirmation remain separate tabs and actions.

## Storage and API

Apply `backend/migrations/35_add_match_setup.sql` before deploying this code. It adds nullable `matches.match_setup` JSON and a `match_setup_revision` counter. Existing matches retain their previous roster behavior until settings are saved.

- `GET /scorer/match/:matchId/settings` returns the draft, available players, official lists, age groups, permissions, revision and fingerprint.
- `PUT /scorer/match/:matchId/settings` accepts `{ revision, fingerprint, draft }`. It validates all sections and writes them in one transaction.

Team names, shirt numbers, player names and roles, and staff overrides belong to this match. Player IDs and team IDs remain linked to the existing registrations. Adding a player selects from the existing team roster; creating a new registered athlete remains a team-management action. Referee IDs and schedule fields use the existing match columns. Manual-match scoring rules are also synchronized to `manual_config`.

Roster, scoresheet, scorer detail and dashboard reads apply the overrides. The existing console's roster update respects a saved match-specific roster rather than replacing competition registrations. A previous manual-match editor save clears the overrides because it rebuilds the private manual teams.

## Editing rules

Only approved users with `match.score` may save. Manual matches additionally require the owner or admin. Completed, cancelled and confirmed matches are read only. Once the match starts, team rosters, staff and scoring rules cannot change through this dialog. An active scorer or VIS offline lease blocks saving. Revision and draft fingerprint checks reject concurrent changes.

Official competition matches use 25 points per regular set and 15 in the deciding set. Manual matches support their existing configurable point targets. Team assignment is retained; editable team names are display overrides.

## Verification

```powershell
cd client
npm.cmd run lint
npm.cmd run build
node --test src/utils/scorer/matchSettings.test.js src/utils/scorer/matchReview.test.js

cd ../backend
node --test tests/matchSettings.test.js tests/matchDashboard.test.js tests/manualScorer.test.js
node --check controllers/matchSettingsController.js
node --check controllers/scorerController.js
```

For UI review, open “ตั้งค่าแมตซ์” on a scheduled match, edit multiple tabs, switch tabs, save, and reopen. Check that cancelling or Escape asks before discarding unsaved changes. Check validation of duplicate shirt numbers and referee assignments, and read-only behavior for locked matches. Verify both desktop and mobile layouts.
