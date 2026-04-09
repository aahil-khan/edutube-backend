#!/bin/bash

echo "🚀 Starting EduTube Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 5

# Apply migrations before serving traffic (idempotent if already applied)
echo "📦 Running database migrations..."
if ! npx prisma migrate deploy; then
    echo "❌ prisma migrate deploy failed"
    exit 1
fi

# Setup default admin user
echo "🔐 Setting up default admin user..."
node scripts/setupDefaultAdmin.js || echo "Admin setup completed with warnings"

# Start the application
echo "🎯 Starting application server..."
exec npm start
