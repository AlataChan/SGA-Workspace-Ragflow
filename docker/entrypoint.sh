#!/bin/sh
set -e

echo "Running prisma migrate..."

npx prisma migrate deploy

echo "Starting app..."

exec "$@"