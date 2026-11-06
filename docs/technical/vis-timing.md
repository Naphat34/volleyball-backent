# VIS set timing

The set clock starts on the first nonempty code entry (including code toolbar
shortcuts). Direct point entry starts it when the first rally is submitted.
Lineup selection and waiting between sets do not start the next clock.

Before the first save the start is kept in account/match/set-scoped session storage.
When saved, each VIS event persists `details.visTiming` with the set number,
first-entry time and original device recording time. Custom match events also
populate `created_at`. Official VIS retains database `created_at` as its server
timestamp and keeps the original event time in metadata. No scoring tables or
official match durations are updated by the VIS timing feature.

The shared projection groups surviving events by set and freezes a completed set
at its first winning-score event. Later statistical corrections cannot extend it.
Undoing that winning rally reopens the clock; undoing a subsequent set naturally
removes it from the reconstructed timing. Offline replay and duplicate requests
reuse the original timestamps instead of the synchronization time.

Final total = sum of completed set durations + 180 seconds per interval between
consecutive played sets, except the interval immediately before the deciding set.
There is no interval added after the last set. The deciding set is set 3 in a
best-of-three match or set 5 in a best-of-five match.

- Three sets in a best-of-five match: two intervals, 6 minutes.
- Three sets in a best-of-three match: one interval, 3 minutes.
- Five sets in a best-of-five match: three intervals, 9 minutes.

UI completed-set chips show frozen `mm:ss` durations. The main clock shows the
current set while recording, then the computed total at match end. P-2 prefers
saved VIS set durations when available, otherwise existing set duration records;
its match total includes the specified intervals when all set durations are known.

Legacy regular events may recover timing from existing `created_at`. Missing
legacy custom timestamps cannot be reconstructed and are not invented; incomplete
timing is displayed as unavailable rather than a full match total. No migration
or historical database rewrite is required.

P-2 uses independent VIS `visContext.scoreAfter` values for its set scores and
sets-won totals when available, including the live set. This report projection
does not update official results or change the official summary pages.
P-2 does not infer durations from legacy import/edit `created_at` timestamps;
it uses explicit `visTiming`, falling back to recorded official set durations.
Unavailable historical timing stays blank. Run `npm.cmd run test:vis:p2` in client
to verify this report-specific behavior.

Verification:

```
cd backend
npm.cmd run test:vis:timing
node --check controllers/visController.js
node --check utils/visTiming.js

cd ../client
npm.cmd run test:vis:timing
npm.cmd run lint
npm.cmd run build
```
