#!/bin/bash
set -euo pipefail
DUMP_FILE="${1:?Usage: ./restore-supabase.sh <dump_file>}"
CONNECTION_STRING="${SUPABASE_DB_URL:?Set SUPABASE_DB_URL env var}"

pg_restore --clean --no-owner --no-privileges \
  -d "$CONNECTION_STRING" "$DUMP_FILE"

echo "Restored from: $DUMP_FILE"
