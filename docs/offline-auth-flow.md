# PIN Offline: architecture and acceptance

VIS and ScorerControl share one encrypted Offline account per browser profile. Existing profile/session keys and IndexedDB schemas are preserved; this change does not migrate, delete or reset match data.

Thai operating instructions: [VIS user manual](vis-user-manual-th.md#ลำดับ-pin-offline-และการแก้ปัญหาเข้าใช้งาน). This flow also applies to ScorerControl's shared PIN setup.

## Sources of truth

- `authStorage.getAccessSession()` resolves `locked`, `online`, or `offline`. Offline mode uses the decrypted grant exclusively. An expired grant stays locked instead of falling through to an old online token. JWT expiry is checked locally for routing; the server still verifies authentication and permissions for every request.
- `offlineAuth.unlockOffline(pin, {workspace})` checks decryption, expiry, valid user and workspace authorization before committing. A failed PIN or forbidden workspace leaves the previous session unchanged. A different online identity is removed after successful unlock.
- `accessRouting.accessDecision/resolveAccess` is the shared Login routing decision. `navigateAccess` performs a single replace-navigation and carries any match fallback explanation in router state.
- `PrivateRoute` and `useAccessSession` use the same session resolution. Protected pages recheck on focus, storage events and every 15 seconds so an expired permit cannot leave a scorer page unlocked indefinitely.
- `OfflineMatchGate` checks direct/bookmarked Offline match routes before mounting a console, including when the user is already unlocked. It uses the same match resolver as Login and sends failed match checks to the list with an explanation.
- Connectivity indicators describe the browser network hint only, not server reachability. Network changes never switch modes or navigate. Synchronization continues to require manual action, an online token and matching online owner; server leases/revisions/idempotency are unchanged.

## Destination contract

| Entry | Offline success |
| --- | --- |
| `/vis/login` | `/adminvis`, including an empty local list |
| `/scorer/login` | `/scorer-offline`, including an empty local list |
| `/login` | picker for dual-workspace users; direct entry for a single workspace |
| matching internal `returnTo` | cached, unreleased match on this device; otherwise list plus a visible explanation |

Forbidden workspace requests stay on Login and explain the denial. External URLs, viewers and arbitrary return targets are rejected. A referee can read the Scorer dashboard online but cannot enter a scoring console through `returnTo`.

Missing match, released match, wrong device and IndexedDB read failure remain distinct. Local list entry itself does not require a successful match lookup. Loading failures must not be displayed as an empty list.

Read-only database operations used by match lists and account-replacement checks have a 10-second deadline. A blocked database produces a retryable message instead of leaving Login or a match gate spinning indefinitely. Writes are not wrapped in this deadline, so a still-running write is never falsely reported as failed by this mechanism.

## Preparation and account replacement

Both systems use `OfflineSetup`, including confirmation of the new PIN and a per-form in-flight guard. Login shares one in-flight guard between online credentials and PIN to avoid concurrent authentication attempts.

Preparation renews the grant without switching working mode. Same-account PIN renewal does not inspect or modify queued match data. A different account requires explicit replacement confirmation; both local databases are inspected without filtering by the current online user. Queued commands and new VIS matches not yet created on the server prevent replacement. Read failures also prevent replacement. Existing match rows are never removed. Users must back up before replacement and return to the original account to access its records.

## Automated checks

Run from `client`:

```powershell
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:pwa
```

`offline/accessRouting.test.js` exercises real WebCrypto and fake IndexedDB: wrong PIN, forbidden workspace without committing, account mismatch, expiry without token fallback, empty list routing, match fallback explanations, state restoration allowlist, explicit account replacement, pending work in both databases, same-account renewal and mode switching. Existing scoring/sync tests cover queues and server acknowledgements. PWA checks verify both Login routes are available from the built shell while offline.

## Browser acceptance still required

The agent's browser inventory was empty, so no real-browser acceptance was performed for this change. Execute these steps on a production build using HTTPS or localhost before deploying to scorers:

1. Back up any existing matches; do not clear site storage. Wait for PWA readiness. After an update, close all app tabs and reopen to activate the new worker.
2. Prepare an eligible account and confirm the PIN. Download one VIS custom match and one ScorerControl match if the account supports both.
3. Close/reopen the browser, disconnect, open each dedicated Login and test wrong PIN, correct PIN and direct match links. Confirm empty lists are accessible for an account without downloads.
4. Refresh the match, record a point and Undo, return to its list, and verify queue counts and account name. Switch workspaces without another PIN while the session is valid.
5. Test a scorer-only PIN from VIS Login: denial must not commit Offline mode or change the previous account. Use the Scorer login link to continue.
6. Test expiry and a stale online token. There must be no Login/dashboard loop. Reauthenticate online to renew the original account; queued work must survive.
7. Reconnect while a match is open. No automatic navigation or sync should occur. Authenticate the same owner, manually sync, retry after a lost response, and release only after all acknowledgements.
8. Attempt to prepare another account while pending work exists in either system. It must be refused without changing the old PIN. Renew the original PIN and verify all match rows remain.
9. After sync and backups, explicitly confirm replacing the Offline account. Verify the old account's data remains isolated and recoverable when preparing that account again.
10. Test a missing/released match link and denied browser storage. Verify a clear explanation, retry option, and no deletion or silent overwrite.
