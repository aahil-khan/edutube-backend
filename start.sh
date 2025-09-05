#!/bin/bash

echo "🚀 Starting EduTube Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 5

# Setup default admin user
echo "🔐 Setting up default admin user..."
node scripts/setupDefaultAdmin.js || echo "Admin setup completed with warnings"

# Start the application
echo "🎯 Starting application server..."
exec npm start
