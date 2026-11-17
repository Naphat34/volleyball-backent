# Admin match detail

The Access Center match list now opens `/admin-matches/:matchId` inside the shared administration shell. Central, Scorer and VIMS administrators and scoped Organizers can use this route; custom VIMS matches retain the previously approved table summary. Other users retain the existing public match link.

During the UUID transition, new administrator links use `matches.public_id`. Legacy numeric detail links remain accepted by the scoped detail API. Only after a successful authorized response does the page replace its browser-history entry with the canonical UUID URL, preserving search parameters and the hash. Failed or unauthorized requests do not resolve or redirect to a UUID. The route helper rejects non-UUID link values and stale responses for a different match. This change covers administrator detail URLs; existing report, recording, mutation API and Offline identifiers remain separate migration groups.

Protected-route login redirects preserve pathname, query and fragment inside the encoded `returnTo`. Online access routing accepts only explicitly allowlisted internal destinations for the account role. External, protocol-relative, backslash/control-character, encoded-path and path-normalization tricks are rejected. Invalid or wrong-role destinations fall back to the role home. The existing Offline entry flow and local match/permit checks remain in use; it does not resume an online administration page. A resumed numeric match detail still resolves its UUID only after the API authorizes competition access.

`GET /api/access/matches/match/:id/detail` requires an active authenticated administrator or Organizer and competition access. Numeric IDs and UUIDs resolve to the same match. The controller checks competition access before reading child data, uses a repeatable-read read-only transaction, sends `Cache-Control: no-store`, and returns explicit field allowlists. It does not refresh or repair rosters as a side effect of viewing them.

The four tabs show overview/readiness, registered or saved match rosters and lineups, scores/events/documents, and latest review plus revision/audit history. Scheduled official rosters follow current registration using existing `setupPlayers` rules; started/completed matches use saved match rosters when present. Athlete snapshots restore registered names. Identity documents, birth dates, contact details, signature image data, leases and tokens are excluded from this response.

Review controls are derived from the latest revision, role permissions and submitter identity. They call the existing review API, which rechecks scope, actor role, revision, transition and fingerprint under its existing transaction lock. Central administrators remain read-only for domain review. Official matches retain public readability independent of review status. Publication controls apply only to linked private score matches and their authorized Scorer reviewer.

Limits are explicit: 100 score events per page, latest 100 VIMS rows for VIMS-monitoring administrators, latest 200 score/VIMS audit records. Review history lists revision metadata, not immutable rendered documents. Existing scoresheet and roster-verification links open current data; the page labels this limitation. No historical report archive, new publication policy, migration, or new recording permission is introduced. Retrospective correction markers preserve the existing signature-retention indication.

Validation:

```powershell
cd backend
node --test tests/adminMatchDetail.test.js tests/accessHttp.test.js tests/accessControl.test.js
node --check controllers/adminMatchDetailController.js
cd ../client
npm.cmd run lint
npm.cmd run build
```

The integration suite covers authentication, direct-link scope, numeric/UUID parity, invalid identifiers, each administrator domain, self-review exclusion, current-vs-saved roster selection, privacy, pagination and no roster writes. Test fixtures run in isolated PostgreSQL-compatible schemas. UI checks use existing local data without submitting review actions.

## Organizer detail extension

Organizers use the same UUID transition and live competition ACL, with four role-specific tabs: readiness, roster, results/documents and review status. The API returns only latest review status/revision/timestamps with no review actions or reasons, prior revisions, event journal, audit trail or VIMS detail rows. Score and VIMS review/write permissions remain unchanged. Officials are explicit role/name pairs; incomplete assignments and missing rosters are shown as readiness items. Management links open the existing competition and fixture pages, which retain their own mutation checks. Existing report links remain current-data views with the displayed revision-status caveat.

UI verified with an isolated in-memory PostgreSQL-compatible fixture and temporary Vite/API ports, including all four tabs and mobile layout; no real accounts or database rows were changed for UI testing.
