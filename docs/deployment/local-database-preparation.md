# Approved local database preparation

Completed 2026-10-05 (Asia/Bangkok), `feature/multi-tenant`. This executes the user's
explicit approval for backup, isolated restore verification and restricted API-role
provisioning. No deployment, service restart, migration, seed/reset, customer-record
change, third-party credential rotation or LINE configuration change occurred.

## Recoverable backup and restore evidence

- Full custom-format backup of the existing `chatto_phase2` database, using its
  verified admin credentials and an exported REPEATABLE READ, READ ONLY snapshot.
  Snapshot table counts/content fingerprints and the dump refer to the same data.
- Archive: `backups/20261005-8bdfb3ea69535806/chatto_phase2.dump.aes`.
- Separate recovery key: `chatto-backup-8bdfb3ea69535806.private.env`. Keep this file;
  its value is deliberately absent from reports and tracked files.
- Custom archive size before encryption: 109,436 bytes. AES-256-GCM authentication
  and SHA-256 integrity were verified after reading the stored encrypted archive.
  No plaintext customer dump was written to host disk. Backup directory, manifest
  and recovery key have restricted Windows ACLs; Git and Docker exclude them.
- Restored the decrypted archive from memory into a uniquely labelled PostgreSQL
  container using the cached image matching the existing database. It had network
  mode `none`, a tmpfs data directory, no published port, bind mount or Docker volume.
- All 30 table counts and content fingerprints, eight migration records/checksums,
  82 constraint identities/validation states and seven tenant-relation counts matched.
  PostgreSQL reparsed one `catalog_imports_status_check` array cast as equivalent
  element casts; the exact expression pair was checked on all five allowed statuses,
  three rejected inputs and NULL. The legacy connection-proof CHECK remains NOT VALID
  in both databases. No live constraint was altered to make the comparison pass.
- Each temporary restore container was verified by unique name, ID and label before
  cleanup. No temporary restore container or persistent restore volume remains.

The archive is a full database backup with `--no-owner --no-acl`; PostgreSQL shared
roles and original ownership/permission assignments are not part of this archive.
Recovery must provision those separately under the existing runbook. The protected
`manifest.json` beside the archive records hashes and the snapshot comparison.

Encryption layout: ASCII `CHATTO-PG-BACKUP-v1\n`, followed by a 12-byte nonce, 16-byte
GCM tag and ciphertext. The header is authenticated as AAD. The protected recovery
file's `CHATTO_BACKUP_AES_KEY` is canonical base64 for the 32-byte key. Recovery reads
both files, verifies GCM/SHA-256 and pipes the resulting custom archive into
`pg_restore --no-owner --no-acl --exit-on-error` against a separately isolated target.
Never restore over the active database/volume or print the decrypted archive.

Operational artifacts are retained under ignored `build/local-database-preparation`:
backup/restore procedure, role provisioning, final configuration verification and
`result.json`. The procedures suppress raw errors/Compose output; role provisioning
refuses an existing role or nonempty application URL rather than rotating it.

## Restricted API role

Provisioned `chatto_api_runtime` with LOGIN, SCRAM password storage and independent
32-byte random password; NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE,
NOREPLICATION and NOINHERIT. It has no role memberships, database/schema/table
ownership or grant options, and cannot create persistent schemas/objects or access
`_prisma_migrations`. Existing shared PUBLIC defaults were preserved; no TEMP,
schema CREATE, ownership, administrative membership, sequence or future-table grant
was issued. There are no application sequences in this database.

The [explicit grant whitelist](../../apps/api/prisma/provisioning/api-runtime-grants.sql)
covers 20 tables used by existing authentication, onboarding, catalog, merchant LINE,
webhook/conversation and internal AI code. Unimplemented scaffold tables receive no
grants. Table DML is limited by actual operations; roles and merchant memberships
receive only the extra column UPDATE permissions required for owner-role upsert and
row locks. PostgreSQL requires UPDATE on at least one column for
[FOR SHARE/FOR UPDATE](https://www.postgresql.org/docs/16/sql-select.html).

Verified every table privilege/denial, column UPDATE allowance, membership,
ownership, schema privilege and grant option against that whitelist. Authenticated
the new role from the host and existing API container using `postgres:5432` inside
Docker. Existing application's no-row row-lock/advisory-lock queries and reads of
all granted tables passed without writing customer records. The production API
runtime-role validator accepts the new role.

Root `API_DATABASE_URL` now uses this authenticated role with Docker hostname
`postgres`. Root `DATABASE_URL` and `ADMIN_DATABASE_URL` remain unchanged; admin
configuration is mapped only to maintenance/Studio, never the API. The protected,
ignored `chatto-api-database.private.env` retains the new role credential for recovery.
The root `.env` now also has restricted Windows ACLs. The existing staged service,
JWT and encryption settings were preserved byte-for-byte and were not activated.

## Final gates

- `docker compose config --quiet`: PASS.
- Same command with explicit root plus staged private environment: PASS.
- Configuration inspected with all profiles included: API uses the restricted URL;
  maintenance/Studio use the admin URL; OA import inputs are absent from services.
- Existing PostgreSQL, API, AI, Web and Studio container IDs, images, start times,
  restart counts and mounts match the pre-backup snapshot. Existing volume preserved.

No preparation blocker remains for these four checks. Runtime replacement and
exposed third-party credential rotation remain outside this approval. Current
containers continue using their previous configuration until a separately approved
rollout. Follow the existing exposure inventory and LINE lifecycle before live use.
