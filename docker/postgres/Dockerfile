# PostgreSQL with encrypted WAL archiving + base backups (docs/OPERATIONS.md#backups).
# Encryption uses age public-key mode: this server only holds the RECIPIENT (public) key, so a compromised
# database host cannot decrypt the archive. The private identity is mounted only on restore hosts.
FROM postgres:18.6-alpine
RUN apk add --no-cache age zstd \
 && mkdir -p /archive/wal /archive/base \
 && chown -R postgres:postgres /archive
COPY --chmod=0755 archive-wal.sh restore-wal.sh base-backup.sh restore-base.sh /usr/local/bin/
