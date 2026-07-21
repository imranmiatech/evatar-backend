# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL required by Prisma
RUN apk add --no-cache openssl

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL required by Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy generated Prisma Client and schema
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy assets like email logo
COPY --from=builder /app/src/assets ./src/assets

EXPOSE 5000

# Run migrations and start the server
CMD npm run start:prod
