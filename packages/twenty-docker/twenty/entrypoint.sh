#!/bin/sh
set -e

setup_and_migrate_db() {
    if [ "${DISABLE_DB_MIGRATIONS}" = "true" ]; then
        echo "Database setup and migrations are disabled, skipping..."
        return
    fi

    echo "Waiting for database to be ready..."
    MAX_RETRIES=30
    COUNT=0
    until psql -tAc "SELECT 1;" "${PG_DATABASE_URL}" >/dev/null 2>&1 || [ $COUNT -ge $MAX_RETRIES ]; do
        echo "Database is unavailable - sleeping 2 seconds ($COUNT/$MAX_RETRIES)..."
        sleep 2
        COUNT=$((COUNT + 1))
    done

    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "Error: Database connection timed out after 60 seconds."
        exit 1
    fi
    echo "Database connection established!"

    echo "Running database setup and migrations..."

    # Check if core schema exists
    has_schema=$(psql -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'core')" "${PG_DATABASE_URL}" 2>/dev/null || echo "f")
    if [ "$has_schema" = "f" ]; then
        echo "Database appears to be empty, running setup-db..."
        node dist/database/scripts/setup-db.js || true
        node dist/command/command run-instance-commands --force --include-slow || true
    fi

    if ! node dist/command/command cache:flush; then
        echo "Warning: Failed to flush cache before upgrade, but continuing startup..."
    fi

    if ! node dist/command/command upgrade; then
        echo "Warning: Upgrade completed with errors. Some workspaces may not be fully migrated. Check logs for details."
    fi

    if ! node dist/command/command cache:flush; then
        echo "Warning: Failed to flush cache after upgrade, but continuing startup..."
    fi

    echo "Successfully migrated DB!"
}

register_background_jobs() {
    if [ "${DISABLE_CRON_JOBS_REGISTRATION}" = "true" ]; then
        echo "Cron job registration is disabled, skipping..."
        return
    fi

    echo "Registering background sync jobs..."
    if node dist/command/command cron:register:all; then
        echo "Successfully registered all background sync jobs!"
    else
        echo "Warning: Failed to register background jobs, but continuing startup..."
    fi
}

setup_and_migrate_db
register_background_jobs

# Continue with the original Docker command
exec "$@"
