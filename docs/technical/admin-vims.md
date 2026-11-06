# Admin VIMS overview

The existing `escore` tab in AdminDashboard now displays the VIMS monitoring view.
The tab key remains unchanged so saved navigation continues to work.

## Access and data scope

- `GET /api/admin/vis/overview` requires an approved authenticated account with
  `admin.manage` permission. It is a read-only endpoint.
- It includes official competition matches of all competition statuses and custom
  VIS matches belonging to all owners. Manual eScore matches are outside VIS scope.
- All reads share one database transaction. A query failure returns an error,
  rather than a successful but incomplete overview.
- Raw `vis_state`, `live_state`, checkout tokens, device identifiers and operation
  receipts are not serialized. Active offline leases and last known sync times are
  exposed separately. Queues that only exist on another device are unknowable.
- Custom owners are available; historical official match operators cannot be
  inferred when no operator/audit data was recorded.

## Display and aggregation

Date, competition, age, gender, team, owner, match status, VIS status and source
filters apply to counters, attention lists, tables, rankings and CSV exports.
Match tables paginate; counters and exports use the entire filtered result.
Rankings default to confirmed VIS records, with an explicit option to include
unconfirmed data. They use canonical `VIS_STAT` actions only, not official scoring
events. Points equal attack kills + block points + service aces. Attack efficiency
equals (kills - errors - blocked attacks) / attack attempts.

Official player/team identities remain stable; custom identities are scoped to
their match to prevent unrelated teams sharing numeric IDs from merging.
Cancelled matches are excluded from rankings. Each ranked identity carries the
number of matches with recorded statistics used for its calculation.

Read-only details expose server roster, lineup, statistics, event history and
available audit records. Editing requires explicitly opening the VIS workspace.
P-2 uses the existing match-result exporter. No migrations are required.

## Verification

```
cd backend
npm.cmd run test:admin-vis
node --check controllers/adminVisController.js
node --check utils/adminVisSnapshot.js
node --check routes/adminRoutes.js

cd ../client
npm.cmd run test:admin-vis
npm.cmd run lint
npm.cmd run build
```
