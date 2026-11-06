# Scorer Console batch substitutions

Normal substitutions now use a pending list: select OUT and IN, add each pair,
review the list, and confirm once. Remove a pair with its × button before confirming.
Exceptional substitutions retain the existing separate flow.

The client validates the entire list against the current lineup, return-substitution
tracker, disqualified players, and the existing eight-substitution limit. It takes
one history snapshot and applies the lineup and counters as one state change.

One `SUBSTITUTION_BATCH` operation enters the existing event queue (or the official
offline journal). The server expands it into ordinary `SUBSTITUTION` rows inside
the existing match transaction. This preserves report compatibility. Child event
IDs derive from the batch ID; retries check that batch ID before inserting.

Match History groups the pairs in one expandable entry. Undo restores the single
before-state. Online undo deletes all rows for that batch and retains a cancellation
marker to prevent delayed queue retries from recreating them. Official offline undo
deletes all child rows when replaying the journal.

Checks:

```sh
node --test client/src/utils/scorer/substitutionBatch.test.js backend/tests/substitutionBatch.test.js backend/tests/scorerOfflineRules.test.js
```

No schema migration is required.
