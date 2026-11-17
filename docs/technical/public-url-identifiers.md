# Public UUID URLs

Browser paths, ID query parameters, API paths and API ID query parameters use public UUIDs. Integer deep links are rejected, including encoded integers. Primary keys, foreign keys, JWT claims, request bodies, Socket.IO rooms and offline journals retain their existing internal IDs.

`backend/config/publicIdRoutes.json` defines identifier positions for browser and API URLs. Both applications use this contract. Add new ID-bearing routes here when adding an endpoint or page.

`backend/middleware/publicUrl.js` validates external URLs and resolves UUIDs before the existing authorization boundary, recording locks and controllers. Existing authorization therefore still uses database keys. `publicId.js` permits numeric references only after the global URL middleware has resolved them.

The client converts generated links, router navigation, native anchors, popup windows, shared VIMS links and Axios requests at their boundaries. The browser address and rendered hrefs contain UUIDs; components continue to receive internal references through the router. `POST /api/public-identifiers` exchanges identifier metadata in JSON bodies when a mapping is not already available from an authorized API response. It returns only internal/public references, never resource data. Private metadata requires an approved session and private matches retain ownership/competition checks. Resource endpoints independently enforce their existing permissions.

Local VIMS records and virtual competition filters receive persistent browser UUID aliases. Prepared Scorer records seed mappings from downloaded public IDs; older offline records can retain a browser-only alias while synchronization resolves the server ID separately. Offline IndexedDB adapters operate on internal cache keys without sending internal URLs over HTTP. Custom VIMS server records have a UUID `public_id` matching the UUID portion of their internal `custom-…` key; first offline sync can create this record through its UUID URL and the existing VIMS authorization/locking workflow.

## Migration

Run `npm.cmd run migrate:public-urls` in `backend`. This applies only the provider-specific migration for this change and records it in migration history. PostgreSQL uses `006_custom_vis_public_ids.sql`; MySQL uses `43_public_url_identifiers.sql`. PostgreSQL master tables already received public IDs in migration 003. Deploy server and client together; stale clients sending integer URLs receive HTTP 400.

The PostgreSQL migration has been applied to the configured local database. MySQL migration is supplied for other deployments and was not executed against the local PostgreSQL installation.

## Verification

- Client: `npm.cmd run test:public-urls`, `npm.cmd run test:public-urls:browser`, `npm.cmd run lint`, `npm.cmd run build`.
- Backend: `npm.cmd run test:public-urls`.
- Native PostgreSQL: set `$env:RUN_LOCAL_PUBLIC_URL_TESTS='1'`, then run `node --test tests/publicUrls.test.js` in `backend`.
- Recording/revocation regression: set `$env:RUN_LOCAL_ACCESS_TESTS='1'`, then run `node --test tests/accessNative.test.js tests/recordingIsolation.native.test.js` in `backend`.

Native tests create isolated schemas and remove them afterward. The headless browser test uses an isolated Edge profile and mocked API data; it checks the competition selector, report hrefs, reload restoration and rejection of integer deep links. Edge must be installed, and port 5184 must be available.
