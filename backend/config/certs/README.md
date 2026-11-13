# Supabase database CA

`supabase-prod-ca-2021.crt` is a public CA certificate, not a private key.

Downloaded over HTTPS from the production URL referenced by Supabase's official
Dashboard configuration:

- https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
- https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Subject: Supabase Root 2021 CA, Supabase Inc. Expires 2031-04-26.

SHA-256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Point `DB_SSL_CA_FILE` at this file to verify the database TLS certificate and
hostname. Do not disable certificate verification. Review the official Dashboard
download and fingerprint again when rotating this trust anchor.
