#!/bin/sh
# restore_command = 'restore-wal.sh %f %p'  (restore hosts only: needs the private identity)
# Decrypt to a temp file first: a bad identity or corrupt file must fail, never hand PostgreSQL a partial segment.
set -eu
set -o pipefail
f="/archive/wal/$1.zst.age"
[ -f "$f" ] || exit 1
age -d -i "${BACKUP_IDENTITY:-/run/secrets/backup_identity}" "$f" | zstd -q -d -c > "$2.part"
mv "$2.part" "$2"
