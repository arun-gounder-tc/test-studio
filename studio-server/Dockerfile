# syntax=docker/dockerfile:1.6
# ───────────────────────────────────────────────────────────────────────────
# Test Studio backend — Express + AI + Cypress runner
# Single-stage build: keeps the image self-contained for Coolify deploy.
# ───────────────────────────────────────────────────────────────────────────
FROM node:20-bullseye-slim AS runtime

# ---------- Cypress runtime dependencies + xvfb (for headed runs) ----------
# Sourced from Cypress's official Docker docs:
#   https://docs.cypress.io/app/continuous-integration/overview#Docker
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgtk2.0-0 \
      libgtk-3-0 \
      libgbm-dev \
      libnotify-dev \
      libnss3 \
      libxss1 \
      libasound2 \
      libxtst6 \
      xauth \
      xvfb \
      ca-certificates \
      curl \
      tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- Dependencies ----------
# Copy only manifests first → docker layer cache stays warm across code edits.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev=false

# ---------- Source ----------
COPY tsconfig.json tsconfig.cypress.json ./
COPY src ./src
COPY cypress ./cypress
COPY cypress.config.ts ./
COPY config ./config

# ---------- Pre-fetch the Cypress browser bundle ----------
# Avoids first-run download stalls inside the container.
RUN npx cypress install --force

# ---------- Build ----------
RUN npm run build

# ---------- Runtime ----------
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Simple healthcheck — Coolify uses this to know the container is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/test-studio/health || exit 1

# tini = PID 1 reaper (handles SIGTERM correctly + reaps zombie Cypress procs).
# xvfb stays installed for HEADED runs — the runner can wrap individual
# `cypress run --headed` spawns with `xvfb-run` when needed. We DON'T wrap
# the server itself with xvfb-run because that fails in some container
# runtimes (small /dev/shm, X11 lock conflicts) and causes restart loops.
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
