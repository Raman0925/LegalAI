# ─────────────────────────────────────────────────────────────────────────────
# LegalAI Backend — Production Dockerfile
# Multi-stage build: deps → builder → production
#
# WHY node:22-slim and NOT node:22-alpine?
#   tesseract.js v7 and pg v8 include native bindings compiled against glibc.
#   Alpine uses musl libc; those binaries will fail at runtime with a
#   "GLIBC_2.xx not found" error. Debian-slim (glibc) avoids the entire class
#   of musl-compatibility breakage. The size penalty (~100-150 MB) is accepted
#   in exchange for runtime reliability.
#
# WHY Node 22 and NOT Node 20?
#   @supabase/supabase-js uses realtime-js which requires a native globalThis.WebSocket.
#   WebSocket became available as a stable global only in Node 22+. Running on
#   Node 20 causes a silent connection failure in the Supabase Realtime client.
# ─────────────────────────────────────────────────────────────────────────────


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — deps
# Install ALL dependencies (including devDependencies) so the TypeScript
# compiler (tsc) and its type definitions are available for the build step.
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-slim AS deps

WORKDIR /app

# Copy ONLY the manifest files first.
# This is the critical cache-optimisation layer: if package.json and
# package-lock.json haven't changed, Docker reuses this cached layer on every
# subsequent build, even when source files have changed. npm ci is always
# faster than npm install and guarantees a fully reproducible install.
COPY package.json package-lock.json ./

# Install all dependencies (dev + prod) using the exact versions locked in
# package-lock.json. --frozen-lockfile equivalent for npm is the default
# behaviour of `npm ci` — it errors if the lockfile is out of date.
RUN npm ci


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2 — builder
# Compile TypeScript → JavaScript using the project's tsconfig.json.
# Output lands in dist/ (outDir) with the same directory structure as rootDir.
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-slim AS builder

WORKDIR /app

# Bring in the full node_modules from the deps stage (includes tsc, tsx, etc.)
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source tree. Source changes invalidate THIS layer and later,
# but NOT the npm ci layer above — keeping incremental builds fast.
COPY . .

# Run the TypeScript compiler.
# tsconfig.json: outDir="dist", rootDir=".", target=ES2022, module=NodeNext
# Produces:
#   dist/server.js          <- entrypoint
#   dist/src/**/*.js        <- all domain / config / plugin compiled output
#   dist/src/**/*.d.ts      <- type declarations (not needed at runtime, but harmless)
RUN npm run build


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3 — production
# Start from a clean minimal image. Copy ONLY what's needed at runtime:
#   * package manifests -> run npm ci --omit=dev for a lean, prod-only install
#   * the compiled dist/ output from the builder stage
# DevDependencies (TypeScript, tsx, vitest, prettier, @types/*) never enter
# this image. Neither does any build toolchain.
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-slim AS production

# Set production environment early so any package that checks NODE_ENV at
# import time (e.g. certain ORM or logging libs) sees the correct value.
ENV NODE_ENV=production

WORKDIR /app

# Copy only the manifest files, then install PRODUCTION-ONLY dependencies in
# this fresh stage. We do NOT copy node_modules from the deps/builder stages —
# that would drag devDependencies (tsc, vitest, @types/*, etc.) into the final
# image, wasting 50-100 MB and introducing unnecessary surface area.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the compiled JavaScript output from the builder stage.
# dist/ contains: dist/server.js + dist/src/**/*.js
COPY --from=builder /app/dist ./dist

# ── Non-root user ────────────────────────────────────────────────────────────
# WHY: Running as root inside a container is a security anti-pattern. If an
# attacker exploits the app, running as root gives them full container
# filesystem access and makes container-escape easier. Creating a dedicated
# user limits the blast radius to only what the app legitimately needs.
#
# node:22-slim ships a built-in "node" user (uid=1000). We use it directly
# rather than creating a new one, which keeps layer complexity minimal.
RUN chown -R node:node /app
USER node

# Expose the port the app listens on.
# server.ts: const port = Number(process.env.PORT || 3000)
# .env.example canonically sets PORT=5000 for this project.
# EXPOSE is documentation — the actual port is controlled by PORT env var.
EXPOSE 5000

# ── Health Check ─────────────────────────────────────────────────────────────
# Hits the real /health endpoint defined in health.controller.ts.
# That endpoint queries the database (SELECT 1) and returns:
#   200 OK   — status: "UP"   (healthy)
#   503      — status: "DOWN" (DB unreachable)
# --interval   how often Docker checks (every 30s)
# --timeout    how long to wait for a response before marking as unhealthy
# --start-period grace period after container start before checks are enforced
#              (allow DB connections + LangGraph init to settle)
# --retries    number of consecutive failures before marking UNHEALTHY
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# ── Start Command ─────────────────────────────────────────────────────────────
# WHY --conditions=production ?
#
# This repo uses Node's "imports" field in package.json for path aliases:
#   "#config/*.js"      -> { "production": "./dist/src/config/*.js",  "default": "./src/config/*.js" }
#   "#plugins/*.js"     -> { "production": "./dist/src/plugins/*.js", "default": "./src/plugins/*.js" }
#   ... etc. for #middlewares, #domains, #utils
#
# Without --conditions=production, Node resolves these aliases via the
# "default" condition, pointing to ./src/*.ts raw TypeScript files — which
# do NOT exist in this production image. The process would crash immediately
# at startup with "ERR_MODULE_NOT_FOUND" (or silently if the error is caught).
#
# This flag is NOT optional. It is the exact same flag used in the npm start
# script: "node --conditions=production dist/server.js"
#
# We use CMD in exec form (JSON array) to ensure the process receives OS
# signals (SIGTERM/SIGINT) directly — required for the graceful shutdown
# logic in server.ts (process.on('SIGTERM', ...) / process.on('SIGINT', ...)).
# Shell form (CMD "node ...") would wrap in /bin/sh -c, which intercepts
# signals before they reach the Node process, breaking graceful shutdown.
CMD ["node", "--conditions=production", "dist/server.js"]
