# Match settings transaction wrapper fix

The settings snapshot calls the scorer controller through `scopedController` so
nested work shares its caller's transaction. That wrapper exposed `query` and
`release`, but roster refresh also called `beginTransaction`, `commit` and
`rollback`. Competition-backed rosters therefore failed on `beginTransaction`;
the error handler's missing `rollback` then hid the first failure with
`connection.rollback is not a function`.

The scoped connection now exposes no-op lifecycle methods: the outer caller owns
commit, rollback and release. SQL BEGIN/COMMIT/ROLLBACK continue to be suppressed
inside the nested scope. Errors propagate to the outer owner without being masked.

Settings reads now acquire a real connection and transaction before loading the
snapshot and release it in `finally`. Reads of official lists run sequentially on
that connection rather than submitting concurrent queries to one pg client.

Verification:

- Regression tests ensure nested helpers never commit/rollback/release the outer
  transaction and retain the original error.
- A real PostgreSQL workflow loads settings for a competition-backed match and
  exercises automatic roster refresh through the nested scope.
- Settings/proxy/PostgreSQL workflow tests passed (26 passed, one live-only skip).
- Reading an existing match's settings on Supabase staging returned 200 with a
  populated settings draft and official lists. No roster or identity values were
  included in diagnostic output.
