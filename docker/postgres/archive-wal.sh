#!/bin/sh
# archive_command = 'archive-wal.sh %p %f'
# Compress + encrypt one WAL segment. pipefail: a failure anywhere in the pipe fails the archive attempt, so
# PostgreSQL keeps the segment and retries. Written to a temp name, synced, then renamed — an existing final file
# is always complete (a retry after a crash between rename and PostgreSQL's bookkeeping is then a no-op).
set -eu
set -o pipefail
src="$1"
dest="/archive/wal/$2.zst.age"
[ -s "$dest" ] && exit 0
zstd -q -c "$src" | age -R /run/secrets/backup_recipient > "$dest.tmp"
[ -s "$dest.tmp" ]
sync "$dest.tmp"
mv "$dest.tmp" "$dest"
