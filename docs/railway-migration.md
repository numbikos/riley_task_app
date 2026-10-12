# Move Riley's task app to Railway

The app and API run together in one service. PostgreSQL holds tasks, tag colors,
and shared-login sessions. The browser calls the API on the same origin; database
credentials and the shared password stay on the server. No Supabase package or
key is needed by the running app.

## Railway configuration

Use the `riley-task-app` project in the existing Railway workspace. Add the
standard `postgres` template as `Postgres` and an app service from this repository.
Connect the app to the migration branch for verification, then `main` for releases.
The checked-in Dockerfile and `railway.json` handle builds, startup, and `/health`.

Set the app's variables in the Railway dashboard:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (private network) |
| `AUTH_USERNAME` | Your shared username; use Riley's previous email to retain her daily messages |
| `AUTH_PASSWORD` | A shared password of at least 8 characters, entered directly in Railway |
| `SESSION_SECRET` | At least 32 random characters; generate with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` |
| `APP_ORIGIN` | The app's full HTTPS origin, without a trailing slash |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

Generate a Railway domain targeting port 3000 and use it for `APP_ORIGIN`.
Changing the username or password invalidates existing sessions. Logout deletes
the server session. Sessions otherwise last 30 days and survive app restarts.
Use one replica; the login rate limiter is in memory and is scoped to that replica.

## Preserve the existing data

The live source is `https://vrllahirhzfsvtujvdgu.supabase.co`. Supabase access must
belong to that project. Export exactly Riley's user, including completed tasks;
do not combine other users' data into the shared account.

The preferred export uses a consistent, read-only PostgreSQL snapshot. In an
ignored `.env.migration.local` file on a trusted machine, set:

```dotenv
SOURCE_DATABASE_URL=your-source-Supabase-session-pooler-URL
SOURCE_USER_ID=the-exact-Supabase-user-UUID
```

Alternatively, export using the existing app login and Supabase's Data API:

```dotenv
SUPABASE_URL=https://vrllahirhzfsvtujvdgu.supabase.co
SUPABASE_ANON_KEY=the-source-project-publishable-or-anon-key
SUPABASE_EMAIL=the-existing-app-login-email
SUPABASE_PASSWORD=the-existing-app-login-password
```

This option signs in as the existing user, so Supabase RLS applies. Stop editing
tasks on all devices during the final export; paginated Data API reads are not a
transactional snapshot. Passwords, database URLs, and snapshots must stay out of
Git and chat. Store exports inside the ignored `backups/` directory.

```bash
mkdir -p backups
npm run db:export -- backups/riley-snapshot.json
```

The exporter checks row counts, preserves IDs, checklist items, recurrence
groups, settings, creation and modification dates, and tag colors. It refuses
to overwrite a backup file.

Set `DATABASE_URL` for the Railway destination using a secure local environment
or an ignored `.env` file. A local import needs the database's public proxy URL
(and appropriate certificate trust); the app itself uses the private URL.
Alternatively run the importer from a trusted Railway shell on the private network.

```bash
npm run db:import -- backups/riley-snapshot.json
```

Import initializes the schema, locks the destination tables, refuses a destination
that already has tasks or colors, imports in one transaction, reads back every
field, and rolls back if verification fails. Sessions are separate and are not
imported from Supabase. An empty source exports an empty snapshot; confirm that is
expected before treating it as the final backup.

For a managed first deployment without local database credentials, the same
snapshot can be gzip-compressed, base64-encoded, and staged as the app's private
`DATA_IMPORT_GZIP_BASE64` variable. Startup imports and verifies it before serving
requests and records a checksum in the same transaction. Subsequent restarts skip
that completed import, preserving edits. Clear the variable after the first
successful deployment. Never put the snapshot in a frontend variable or Git.

An authenticated `POST /api/migration/import` also accepts a snapshot for manual
first imports; it uses the same verification and empty-destination requirement.

## Verification and cutover

1. Keep the original app and Supabase project available during verification.
2. Stop edits in the original app, take the final export, and import it before
   allowing writes to the new app. Retain the backup and the export row counts.
3. Confirm the Railway deployment reaches `SUCCESS` and `/health` returns `ok`.
4. Sign in, compare task and completed-task totals and tag colors, and create,
   edit, complete, undo, and delete a test task.
5. Open a second browser/device and verify task changes appear within 15 seconds
   or when the app comes back into view. Verify recurring settings and pagination.
6. Log out and confirm task endpoints reject unauthenticated requests. Restart
   the app and verify data and a valid signed-in session survive.
7. Use the Railway URL going forward. The GitHub Pages deployment workflow is
   removed, so the old static app is not overwritten by this backend migration.
   Retire or redirect the old site only after successful cutover.

Do not delete or pause Supabase until the new app has been verified with live
data. Before writes begin on Railway, rollback is simply returning to the old
URL. Once Railway accepts new edits, those edits must be exported/reconciled
before reverting to Supabase; the databases do not synchronize with each other.

## Automated verification

```bash
npm run build
npm test -- --run
TEST_DATABASE_URL=postgresql://postgres:test-password@localhost:5432/riley_test npm run test:api
```

The API tests truncate `tasks`, `tag_colors`, and `app_sessions`. Use a separate
disposable database, never production. CI runs these checks against PostgreSQL 18.
