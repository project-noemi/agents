# Dockerfile
# Project NoéMI - Executive Assistant (Cloud Run)

# Multi-stage build for a lean production image
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
# Install all dependencies (including devDependencies if needed for build)
RUN npm install

COPY . .

# Final stage
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
# Only install production dependencies
RUN npm install --production

# Copy application files out of builder ensuring no tests or extraneous markdown files bulk up the container
COPY --from=builder /usr/src/app/index.js ./
COPY --from=builder /usr/src/app/server.js ./
COPY --from=builder /usr/src/app/delta-sync.js ./
COPY --from=builder /usr/src/app/state-manager.js ./
COPY --from=builder /usr/src/app/triage-router.js ./
COPY --from=builder /usr/src/app/oauth-manager.js ./

# Best practice for Cloud Run Node.js execution
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
