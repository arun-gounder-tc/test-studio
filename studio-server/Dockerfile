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
      dumb-init \
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

# tini = PID 1 reaper (handles SIGTERM correctly + reaps zombie Cypress procs)
# xvfb-run = virtual display so headed runs work even on a headless host
ENTRYPOINT ["tini", "--", "xvfb-run", "--auto-servernum", "--server-args=-screen 0 1440x900x24"]
CMD ["node", "dist/server.js"]
