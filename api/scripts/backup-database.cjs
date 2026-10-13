// Free local PostgreSQL backup. Requires official pg_dump/pg_restore on PATH.
// No credentials in command arguments, logs, or the backup filename.
const { spawnSync } = require('node:child_process');
const { mkdirSync, statSync } = require('node:fs');
const { resolve, join } = require('node:path');
const raw = process.env.DATABASE_URL;
if (!raw) throw Error('Configure DATABASE_URL locally; never paste it into chat');
let url;
try { url = new URL(raw); } catch { console.error('DATABASE_URL format is invalid; value omitted for security.'); process.exit(1); }
if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('PostgreSQL connection required');
const directory = resolve(__dirname, '../../output/db-backups');
mkdirSync(directory, { recursive: true });
const target = join(directory, `drive-coach-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: url.searchParams.get('sslmode') || 'prefer' };
const backup = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', target], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
if (backup.error || backup.status !== 0) { console.error('Backup failed. Install official PostgreSQL client tools and check the connection. Production must not be migrated.'); process.exit(1); }
const check = spawnSync('pg_restore', ['--list', target], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
if (check.error || check.status !== 0 || !statSync(target).size) { console.error('Backup archive verification failed; do not migrate production.'); process.exit(1); }
console.log(`Backup archive verified: ${target}`);
console.log('Keep it private. A staging restore test is still required before production migration.');
