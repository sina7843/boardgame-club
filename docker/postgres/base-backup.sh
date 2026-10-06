#!/bin/sh
# Encrypted base backup into /archive/base. Run as postgres inside the database container:
#   docker compose -f compose.prod.yaml exec -u postgres postgres base-backup.sh
# WAL needed for consistency comes from the WAL archive (-X none), so archiving must be healthy.
# pipefail: a pg_basebackup/zstd failure leaves only the .tmp file (removed) and a non-zero exit.
set -eu
set -o pipefail
ts=$(date -u +%Y%m%dT%H%M%SZ)
out="/archive/base/$ts.tar.zst.age"
trap 'rm -f "$out.tmp"' EXIT
pg_basebackup -U "$POSTGRES_USER" -D - -Ft -X none -c fast -l "base-$ts" \
  | zstd -q -T0 | age -R /run/secrets/backup_recipient > "$out.tmp"
[ -s "$out.tmp" ]
sync "$out.tmp"
mv "$out.tmp" "$out"
trap - EXIT
echo "$out"
