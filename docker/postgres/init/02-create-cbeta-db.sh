#!/usr/bin/env bash
# Fresh volume only: create isolated CBETA database beside tosuthien.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  SELECT 'CREATE DATABASE cbeta OWNER ${POSTGRES_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cbeta')\gexec
EOSQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname cbeta \
  -f /cbeta-schema/01-schema.sql
