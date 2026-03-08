#!/bin/bash
set -euo pipefail
DATE=$(date +%Y-%m-%d_%H%M)
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Connection string depuis Supabase Dashboard > Settings > Database
CONNECTION_STRING="${SUPABASE_DB_URL:?Set SUPABASE_DB_URL env var}"

pg_dump "$CONNECTION_STRING" \
  --format=custom \
  --no-owner \
  --no-privileges \
  -f "$BACKUP_DIR/watthunter_$DATE.dump"

echo "Backup saved: $BACKUP_DIR/watthunter_$DATE.dump"
