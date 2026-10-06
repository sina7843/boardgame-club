#!/bin/sh
# Failure paths of archive-wal.sh: each must exit non-zero and leave no final file in the archive.
# Run without any key mounted:
#   docker run --rm -u postgres -v "$PWD/docker/postgres/selftest-failures.sh:/t.sh:ro" --entrypoint sh <postgres image> /t.sh
head -c 100000 /dev/urandom > /tmp/seg
archive-wal.sh /tmp/missing-seg SEG1 2>/dev/null; a=$?
archive-wal.sh /tmp/seg SEG2 2>/dev/null; b=$?
n=$(ls /archive/wal | grep -vc '\.tmp$')
echo "missing source exit=$a; missing recipient key exit=$b; final files=$n"
[ "$a" -ne 0 ] && [ "$b" -ne 0 ] && [ "$n" -eq 0 ] && echo PASS || { echo FAIL; exit 1; }
