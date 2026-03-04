#!/bin/bash

# Open Brain Database Backup Script

set -e

DB_NAME="${DB_NAME:-openbrain}"
DB_USER="${DB_USER:-openbrain}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/openbrain_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "Backing up Open Brain database..."
echo "Database: ${DB_NAME}"
echo "File: ${BACKUP_FILE}"

# Perform backup
pg_dump -U ${DB_USER} ${DB_NAME} > "${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "✓ Backup complete: ${BACKUP_FILE} (${SIZE})"

# Clean up old backups (keep last 7 days)
find "${BACKUP_DIR}" -name "openbrain_*.sql.gz" -mtime +7 -delete

echo "✓ Old backups cleaned (keeping last 7 days)"

# Show backup count
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/openbrain_*.sql.gz 2>/dev/null | wc -l)
echo "Total backups: ${BACKUP_COUNT}"
