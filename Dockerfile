# syntax=docker/dockerfile:1
# Custom-Server Next.js (tsx server.ts). Fertiges Image fuer Coolify (kein Build am Server).
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m appuser \
    && mkdir -p /app/data
COPY --from=builder --chown=appuser:nodejs /app ./
RUN chown -R appuser:nodejs /app
USER appuser
EXPOSE 3000
# /app/data ist als Volume gedacht (z. B. SQLite-Datei) - in Coolify mounten.
VOLUME ["/app/data"]
CMD ["npm", "run", "start"]
