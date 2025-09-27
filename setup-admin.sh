#!/bin/bash

echo "🔐 Creating Default Admin User for EduTube"
echo "=========================================="
echo ""

# Run the admin setup script
docker-compose exec backend node scripts/setupDefaultAdmin.js

echo ""
echo "✅ Admin setup completed!"
echo ""
echo "🔑 Login credentials:"
echo "   URL: http://localhost:4000"
echo "   Email: admin@edutube.com"
echo "   Password: admin123"
echo ""
echo "⚠️  SECURITY: Please change the password after first login!"