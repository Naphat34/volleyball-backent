# Scoresheet roster layout

The right-hand roster panel in `client/src/pages/reports/ScoreSheet.jsx` uses
`ScoresheetRoster` with the competition's `competition_max_players` value. It
supports 12-, 14- and 20-player configurations without a separate template.

The limit is the total number of players, including selected liberos (up to two).
A team with no libero retains all its normal-player slots; one libero consumes
one slot rather than always reserving two. Empty names are filtered before the
limit is applied. Both team columns share row positions even when their roster
sizes differ or one team is empty.

The panel uses a bounded CSS grid inside the existing A3 scoresheet. The regular
player section receives the remaining height after headers, liberos, officials
and signatures. The 20-player mode compacts the fixed sections. Name text is fitted
to each cell's actual width and height after font loading and resizing, including
print and scaled previews. Original A/B indicators, captain circles, official
roles and signature images remain supported.

Verification:

- Unit cases cover competition limits and zero/one/two liberos.
- Headless Chrome checks 24 cases on an A3-sized flex layout: 12/14/20 players,
  screen/print media, long Thai/English names, empty opponents, no liberos and
  scaled previews. It checks player counts, name bounds, panel overflow and that
  signatures remain within the A3 sheet.
- Fixture screenshots are written to ignored `tmp/scoresheet-roster-preview/`.
  The fixtures never read or modify a real match or database.
- Client lint and production build pass.

Run from `client`: `npm.cmd run test:scoresheet-roster`. Chrome must be installed,
or set `CHROME_BIN` to a compatible browser executable. `PLAYWRIGHT_MODULE_PATH`
can select an existing Playwright package instead of the bundled dev dependency.
