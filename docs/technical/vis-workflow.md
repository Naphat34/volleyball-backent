# VIS scoring workflow

## Statistician dashboard

Statistician accounts land on `/adminvis` after login. Admins can also open this
page from the VIS tab. The dashboard loads matches through the authenticated
`GET /scorer/matches` endpoint using the existing `match.score` permission, so
statisticians do not need competition-management privileges.

Filter by competition, status or team/match number, then open
`/adminvis/match/:matchId` to enter `LiveMatchScorer`. This URL can be refreshed or
bookmarked. Closing the scorer returns to the list and reloads match results.
Completed matches open read-only; cancelled matches and matches with missing
teams cannot be opened for recording.

## Recording

### PDF statistics report

The PDF button in LiveMatchScorer appends a portrait match summary and landscape
player-statistics pages for each team to the existing scoresheet. Optional
per-set details (starting lineup, team totals, timeouts, substitutions and a
score progression chart) and the full event history can be selected before export.
Tables repeat headers when rosters/history require extra pages. Thai glyph
positions are applied from fontkit to preserve vowel and tone-mark placement.

Reports keep team A/B fixed using the opening court assignment, show the export
time in Bangkok and distinguish live from final results. Totals include only
canonical VIS skill/grade events; unsupported grades are counted in a notice.
No recorded statistics are displayed as a dash rather than an invented zero.
Individual points count only attack, serve and block winners. Attack efficiency
is (attack winners - attack errors) / attack attempts; positive reception is
(reception # + reception +) / reception attempts. Both percentages are labeled
and use a dash for a zero denominator. All statistics are explicitly described
as based on recorded events, even when the match is completed.

### Keyboard entry

The recording panel accepts one code at a time: `S21#`, `A12=`, `R7+`, etc.
The current team is displayed above the input; there is no team dropdown.
After entering a code, press Space once to save for the current team, or twice
within 350 ms to save for the opposite team and retain that team for subsequent
events. A single Space waits for this interval before saving. Repeated keydown
events from holding Space are ignored. Double Space on an empty input switches
the team without saving. Explicit prefixes `A:S21#` / `B:R7+` remain supported;
double Space switches away from the prefixed team.
A/B follows the opening toss assignment and stays fixed when teams change ends.
The preview identifies the team, player, action and scoring effect before Enter.
Before eScoreControl publishes a lineup, a unique registered jersey number can
be submitted immediately through the keyboard entry. Once an official lineup is
available, VIS restricts recording to players on that lineup.

Enter submits the same STAT command used by the grade buttons. Escape clears
unsubmitted text; Tab follows normal form focus. There are no page-wide letter
shortcuts or Ctrl+Z overrides, and Enter/Space during IME composition do not submit.
Input remains intact on failure. A successful save or retry clears it and returns
focus to the field. Pending retries retain their operation ID, preventing a
second submission of the same event when the operator retries outside the field.

Skill events persist a shorthand code in `match_actions.description.event_code` with
the format skill + jersey number + grade, e.g. `S21#` for player 21's serve ace,
`A12=` for an attack error and `R7+` for positive reception. The server resolves
the match registration number before the player's default number, and stores
`jersey_number` alongside the code so later roster changes do not change history.
History displays these codes; older events without stored codes are displayed
using the available roster number. No schema migration is required for codes.

The recording panel always displays the selected team, jersey number and skill.
All six skills keep fixed positions; grade buttons explain both the quality and
whether the action awards a point. The Back action returns to skills while
keeping the selected player. Bench players enter the court through substitution,
rather than being selectable for a skill attempt.

History lists the set, team, jersey, skill/grade and post-action score without
truncating the event description. Scores follow the current left/right team
order shown in the scoreboard. On small screens, the History button switches
between the recording controls and history. Read-only matches use the full
recording-panel width for history and hide inactive recording controls.

Undo displays the actual last saved action. Undoing a final point asks for
confirmation because it reopens a finished set or match. Pending saves display
the affected player/skill and provide a retry beside the recording controls.

The VIS console records each skill attempt, including `+`, `!` and `-`, without
changing the official score. `A#`, `S#` and `B#` are scoring outcomes for the
statistical report only; eScoreControl remains the sole source of official points.

Each save uses `POST /scorer/match/:matchId/vis` with a unique operation ID and
the revision returned by the previous save. The server locks the match row and
commits the event, score, set result and recoverable state together. A failed
save leaves the last confirmed state on screen and offers a retry with the same
operation ID. Conflicting revisions refresh the screen before another action.

The current VIS session state is stored in `matches.vis_state`. Each VIS skill
record is written to `match_actions` with `action_type = 'VIS_STAT'`; its
`description` stores the official-rally reference and shorthand metadata. The
official eScore timeline, scores, lineups and match status remain in
`match_events` and `matches.live_state`. Undo removes only the matching
`match_actions` row and never changes the official score or set result.

VIS does not wait for eScoreControl to start a set. Before official context is
available, it records the current match score as a reference and validates the
player against the team roster. When eScoreControl publishes a score, lineup or
official rally, VIS uses that context automatically and restricts players to
the recorded lineup. Match completion locks skill recording; Undo remains
available in the active recording session.

Matches recorded before this workflow do not have a trustworthy recoverable
rotation/history. They open for inspection only, using persisted scores and
starting lineup sheets, rather than starting a new scoring session at 0–0.

Player, team and public statistics read `match_actions` as the canonical VIS
source. Legacy VIS rows in `match_events` are used only for matches that have
no canonical graded VIS action, so the two sources are never added together for
the same match.
Both sources explicitly convert `skill` and `grade` to utf8mb4 with
`utf8mb4_unicode_ci` before UNION ALL, so legacy and new tables can retain their
existing collations without breaking public or individual-player statistics.

## Verification

```powershell
cd backend
npm.cmd run test:vis
```

The workflow and controller tests use mock transactions. SQL aggregation tests
use Node's in-memory SQLite on Node 22.13+ and are skipped when it is unavailable.
By default these checks do not connect to the configured MySQL database. The
mixed-collation regression can also run against MySQL using connection-local
temporary tables; it does not modify persistent match data or schemas:

```powershell
cd backend
$env:RUN_MYSQL_VIS_TESTS = '1'
node --test tests/visStatistics.test.js
Remove-Item Env:RUN_MYSQL_VIS_TESTS
```

Also run the client
lint/build and verify a new match, retry, refresh, final-point Undo and live
viewer updates against the deployment's MySQL database before release.
