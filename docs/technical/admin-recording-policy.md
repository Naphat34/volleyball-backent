# Admin recording policy

Administrators manage competitions, accounts, teams and match metadata. They can monitor VIMS statistics, read match details and export reports. They cannot enter recording workspaces, record scores/statistics/lineups, claim statistics work, obtain offline recording permits or upload offline scoring operations.

The central permission check explicitly denies match.score to admin despite the administrative wildcard. Recording endpoints reload the active account role before authorizing writes. Match creation and metadata updates also reject changes to scoring fields; unchanged values remain accepted. Athlete identity linking remains an administrative data-management operation.

Previously cached admin offline grants cannot unlock recording; cached match data is retained. Deploy both client and backend, restart the backend, and reload clients to apply the policy.

Verification:
- Backend: npm.cmd run test:recording-policy
- Client: node --test src/offline/entryRouting.test.js src/offline/accessRouting.test.js
- Client: npm.cmd run lint and npm.cmd run build
