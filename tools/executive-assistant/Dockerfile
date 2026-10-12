# Dockerfile
# Project NoéMI - Executive Assistant
#
# The builder stage installs the UI toolchain and emits ui/dist.
# The runtime image keeps production server dependencies and that dist.
# ui/node_modules (Vite) stay in the builder.

FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY ui/package.json ui/package-lock.json ./ui/
RUN cd ui && npm ci
COPY ui ./ui
RUN cd ui && npm run build

FROM node:24-alpine

WORKDIR /usr/src/app
RUN chown node:node /usr/src/app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --from=builder --chown=node:node /usr/src/app/ui/dist ./ui/dist
# There is no index.js in this tree. package.json "main" / "start" and CMD
# are node server.js. Develop copied a missing index.js from the builder.
COPY --chown=node:node server.js ./
COPY --chown=node:node delta-sync.js ./
COPY --chown=node:node state-manager.js ./
COPY --chown=node:node triage-router.js ./
COPY --chown=node:node oauth-manager.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
