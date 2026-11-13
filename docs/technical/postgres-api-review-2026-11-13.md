# PostgreSQL API review — 2026-11-13

## Changes

- Official pre-Live roster writes validate player IDs against the current competition
  registration, rather than an older `matches.match_setup` player list. New eligible
  athletes can be saved; foreign-team players still fail validation. Live roster
  edits return 409.
- A completed coin toss no longer makes the match-settings editor read-only.
  The database match status controls the Live boundary.
- `PUT /api/match/:matchId/requests/:requestId` now approves LINEUP requests in one
  checked-out PostgreSQL transaction. It locks the match and request, checks the
  current set, workflow, team, six distinct positions, current eligible roster,
  Libero restrictions and offline leases, saves the lineup and marks the request
  APPROVED before committing. Failed writes roll back both operations. A repeated
  approval returns the approved request without replacing the saved lineup.
- The scorer client uses this atomic approval endpoint instead of first issuing
  a separate lineup save. Successful approvals still place the six on court.
- An explicit Bearer token takes priority over an older HttpOnly API cookie.
  Invalid Bearer credentials never fall back to another account's cookie.
  Existing role permissions and active-account checks remain in force.
- Nested scorer controllers flag their caller-owned transaction. They do not retry
  a deadlock inside an already aborted PostgreSQL transaction; the owner rolls back.

## Verification

The expanded `npm.cmd run test:postgres` command passed 61 tests, with two opt-in
external-server/concurrency checks skipped. It includes the adapter, native SQL
planner, PostgreSQL workflows, roster lifecycle, atomic approval, token selection,
coin toss and athlete-integrity regressions. SQL planning checked 445 complete
static application queries; workflow tests exercise additional dynamic statements.

The configured PostgreSQL database was checked read-only against an isolated
migrated reference: 24 application tables, 372 columns, data types and nullability,
six compatibility functions, 120 non-NOT-NULL constraints and 126 indexes matched.
PostgreSQL versions represent NOT NULL constraint catalog entries differently;
nullability was compared through `information_schema.columns` instead.

Frontend lint and production build passed. No production migration, match update,
lineup approval, account-role change or deployment was performed during this review.
No new migration is needed for these changes.

## Broader suite limitations

The full backend run reported 256 tests: 218 passed, 23 failed, 15 skipped.
Remaining failures are in older controller/mock and VIMS suites, including obsolete
dependency stubs, older account-status fixtures and expectations for the earlier
VIMS recording model. They are not counted as passing PostgreSQL verification.
See the local ignored `backend/backend-test-results.log` for the full failure list.
This review does not certify all historical tests, browser/PWA behaviour, external
PostgreSQL concurrency or every live deployment workflow.

## Deployment

Deploy the backend first, then the frontend. An older backend does not implement
atomic LINEUP approval and must not receive the new client's approval-only flow.
After deployment, test with an active scorer account: load the current roster,
save it after coin toss, accept each team's six, check the court, start the set,
and verify that Live roster edits are rejected and accepted lineup identities remain.
