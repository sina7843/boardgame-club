#!/bin/sh
# Entry point for a RESTORE container (never the primary). Unpacks the chosen encrypted base backup into an
# empty data directory, configures WAL replay from the archive, then starts PostgreSQL normally.
#   BASE_BACKUP=<file in /archive/base> (default: newest)   RECOVERY_TARGET_TIME='2026-10-06 08:00:00+00' (optional)
set -eu
set -o pipefail
marker="$PGDATA/.restore-complete"
if [ ! -f "$marker" ]; then
  # A data directory without the marker is an interrupted restore: refuse rather than boot a half-unpacked cluster.
  if [ -n "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
    echo "restore: $PGDATA is not empty and has no completion marker — use a fresh volume" >&2
    exit 1
  fi
  base="${BASE_BACKUP:-$(ls -1 /archive/base/*.tar.zst.age | sort | tail -n 1)}"
  mkdir -p "$PGDATA"
  age -d -i /run/secrets/backup_identity "$base" | zstd -q -d -c | tar -x -C "$PGDATA"
  {
    echo "restore_command = 'restore-wal.sh %f %p'"
    if [ -n "${RECOVERY_TARGET_TIME:-}" ]; then
      echo "recovery_target_time = '$RECOVERY_TARGET_TIME'"
      echo "recovery_target_action = 'promote'"
    fi
  } >> "$PGDATA/postgresql.auto.conf"
  touch "$PGDATA/recovery.signal" "$marker"
  chown -R postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  echo "restore: unpacked $(basename "$base")"
fi
# restore_command runs as postgres: give it a private, container-ephemeral copy of the identity (never in PGDATA).
install -d -m 0700 -o postgres -g postgres /run/restore
install -m 0400 -o postgres -g postgres /run/secrets/backup_identity /run/restore/identity
export BACKUP_IDENTITY=/run/restore/identity
# The restored server must never write into the production archive.
exec docker-entrypoint.sh postgres -c archive_mode=off
