# Use Node.js 18 Debian-based image for better Prisma compatibility
FROM node:18-slim

# Install OpenSSL and other dependencies needed for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema first for better caching
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port 5001
EXPOSE 5001

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs backend

# Change ownership of the app directory
RUN chown -R backend:nodejs /app
USER backend

# Start the application
CMD ["npm", "start"]
