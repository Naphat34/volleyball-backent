# VIS Offline: deployment and verification

Scope: private custom VIS matches only. Official competition matches continue online. No new migration: device lease, synchronization timestamp and command receipts live in the existing `custom_vis_matches.payload` JSON (migration 32 must already exist).

## Deployment

1. Install client dependencies with `npm.cmd install` (fake-indexeddb is a development test dependency).
2. The browser engine is generated from backend VIS rules. After editing rules run `npm.cmd run generate:vis-engine` in client. `prebuild` rejects stale generated output; parity tests compare complete browser/server timelines.
3. Build client with `npm.cmd run build`; deploy **all** `dist` files including `sw.js`, `manifest.webmanifest`, fonts and hashed assets. Restart backend with the new routes.
4. Serve over HTTPS or localhost, with SPA navigation fallback and the service worker available at `/sw.js`. Avoid long immutable caching for `sw.js` and `index.html`; hashed assets may be immutable.
5. PWA is production-only. It precaches the build and VIS fonts atomically. Updates wait for the previous worker's tabs to close; the worker never caches APIs, user responses or mutations. IndexedDB is independent of app-shell cache versions.

## Identity and storage

An approved authenticated scoring account obtains a seven-day local permit from `GET /api/vis-custom/offline-permit`. PIN-derived PBKDF2-SHA256 (210,000 iterations, random salt) encrypts the permit with AES-GCM. No account password or JWT is persisted in the Offline profile. Unlock is local; it never grants server access. Server authorization always rechecks the authenticated account and ownership. Local clock/storage cannot enforce revocation against a hostile device owner; revoked access is enforced when reconnecting, and Offline permits are not server credentials.

IndexedDB stores owner, device ID, payload, ordered commands, base revision and synchronization acknowledgements. Transactions serialize concurrent tabs. Quota/transaction failures are surfaced without advancing the UI. A two-minute expiring synchronization flag blocks concurrent recording and recovers after a crashed tab. Retrying uses unchanged operation IDs. Files exported as JSON remain the recovery path if browser storage is cleared.

## Exclusive checkout and synchronization

- `POST /api/vis-custom/:id/offline-checkout` reserves a custom match for a device for seven days. Other devices and normal online writes are rejected while leased. A new device may explicitly check out after release/expiry; old-device synchronization is then rejected.
- `POST /api/vis-custom/:id/offline-sync` receives config for first creation, optional supported backup, base revision, device ID, ordered operations and a release flag. It locks the row and validates/replays the entire batch inside one SQL transaction. A bad command rolls back even initial creation.
- Retrying a fully committed batch returns the acknowledgement without adding points. Revision mismatch with unapplied commands returns HTTP 409. No automatic server overwrite or merge is performed.
- Conflict UI offers a new private copy, or a backup followed by explicit replacement from the server. Another device's live lease cannot be overridden by that replacement path.
- Confirmation/reopening/publication occur online after release. Existing viewers may continue seeing the last successfully synced snapshot while recording continues offline. Unpublication remains possible while leased.
- The local copy becomes read-only after release. To resume local work, check out the server copy again. Offline data is not auto-deleted after synchronization.

VIS context keys compare serialized context exactly; they are concurrency identifiers, not authentication tokens. The browser and server use the same synchronous rule implementation.

## Checks

```powershell
cd client
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:pwa
cd ../backend
node --check controllers/customVisController.js
node --test tests/visOffline.test.js tests/customVis.test.js tests/customVisController.test.js tests/importCustomVis.test.js tests/visRally.test.js tests/visRotation.test.js
$env:RUN_MYSQL_CUSTOM_VIS_TESTS = '1'
node --test tests/visOffline.mysql.test.js
Remove-Item Env:RUN_MYSQL_CUSTOM_VIS_TESTS
```

MySQL verification uses a connection-local temporary table and never persists sample matches. Existing `visWorkflow.test.js` still describes an older statistics-only workflow and has seven baseline failures; the same failures reproduce with the pre-change SHA256 context-key calculation. This Offline change does not rewrite those unrelated expectations.

Manual acceptance on the deployed build: prepare PIN and wait for PWA ready; close app; disable network; unlock; create/import; record side-out, Undo, substitution and timeout; reload; export JSON/PDF; reconnect; log in online with same owner; sync; compare server state; retry after a lost response; verify other-device rejection and conflict preservation; sync/release; confirm and publish; inspect viewer timestamp; unpublish. Also check expiry, quota failure and update waiting while a scorer tab is open.
