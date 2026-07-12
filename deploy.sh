#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Backend deployment script for LegalAI
#
# Called by the GitHub Actions CD workflow over SSH.
# Also safe to run manually on the VPS for a hot-fix deploy:
#   bash /var/www/legalai/deploy.sh
#
# ASSUMPTIONS (edit the variables below to match your VPS):
#   REPO_DIR   — absolute path to the cloned repo on the VPS
#   APP_DIR    — subdirectory of the backend workspace
#   PM2_NAME   — the PM2 process name you used when you first started the app
#   PORT       — the port the backend listens on (must match .env PORT)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail   # -e: exit on any error  -u: treat unset vars as errors  -o pipefail: catch pipe failures

# ── Load nvm explicitly ───────────────────────────────────────────────────────
# Non-interactive SSH sessions (like GitHub Actions' ssh-action) do NOT source
# ~/.bashrc, so nvm's PATH additions (node, npm, pm2) are invisible unless we
# load nvm ourselves here. Without this, `pm2`/`npm`/`node` all fail with
# "command not found" even though they work fine when you SSH in by hand.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null

# ── Configuration — edit these to match your VPS ────────────────────────────
REPO_DIR="/var/www/legalai"
APP_DIR="$REPO_DIR/app/backend"
PM2_NAME="legalai-api"
PORT="${PORT:-5000}"                   # ← must match PORT in your server .env

# ── Colours for readable logs ────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; exit 1; }

log "=== LegalAI Backend Deploy — $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="

# ── 1. Pull latest code ──────────────────────────────────────────────────────
log "Pulling latest code from origin/main..."
cd "$REPO_DIR"
git fetch --all --prune
git checkout main
git reset --hard origin/main
log "Git HEAD is now: $(git rev-parse --short HEAD)"

# ── 2. Install dependencies ────────────────────────────────────────────────────
# Run from the repo root so npm workspaces resolve correctly, then
# cd into the backend to build — this mirrors what CI does.
log "Installing dependencies (including dev for build)..."
cd "$APP_DIR"
npm ci

# ── 3. Build TypeScript ──────────────────────────────────────────────────────
# tsc compiles src/ + server.ts → dist/ (see tsconfig.json outDir)
# NODE_ENV is set here so any build-time env checks behave correctly.
log "Compiling TypeScript..."
NODE_ENV=production npm run build

# ── 3.5 Prune devDependencies ────────────────────────────────────────────────
# Now that the build is done, we can remove the devDependencies (tsc, etc.)
# to save space on the VPS.
log "Pruning devDependencies..."
npm prune --omit=dev

# ── 4. Reload PM2 (zero-downtime) ────────────────────────────────────────────
# `pm2 reload` does a rolling restart: spins up the new process, waits for it
# to be online, THEN kills the old one — no gap in request handling.
# If the process doesn't exist yet (first deploy), `pm2 reload` will fail;
# the fallback `pm2 start` handles that case.
log "Reloading PM2 process '$PM2_NAME'..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  warn "Process '$PM2_NAME' not found in PM2 — starting fresh..."
  # node --conditions=production is REQUIRED for the package.json #imports aliases
  # (e.g. #config/*.js → dist/src/config/*.js). Without this flag Node falls
  # back to the "default" condition → ./src/*.ts (raw TS, not present) → crash.
  pm2 start dist/server.js \
    --name "$PM2_NAME" \
    --interpreter node \
    --node-args="--conditions=production" \
    --update-env
fi

# Save the PM2 process list so it survives a VPS reboot
pm2 save

# ── 5. Health check — verify the app actually came back up ──────────────────
# Give the process a head start before probing — connecting to the DB pool
# and Supabase takes a few seconds and an immediate curl just wastes retries.
log "Giving the server 30s to finish connecting to the server/DB before probing..."
sleep 30

# Wait up to 30 more seconds for the server to accept connections.
# We probe /health (real endpoint in health.controller.ts) which returns:
#   200 → { status: "UP", services: { database: { status: "UP" } } }
#   503 → database unreachable but app is running (still a "partial" health)
# We fail the deploy only on a non-response (connection refused / timeout),
# NOT on a 503, because a DB blip shouldn't roll back a good code deploy.
log "Waiting for server to come up on port $PORT..."
MAX_WAIT=30
ELAPSED=0
until curl --silent --fail --max-time 3 "http://localhost:${PORT}/health" > /dev/null 2>&1; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    fail "Server did not respond on :${PORT}/health within ${MAX_WAIT}s — deploy may have failed. Check: pm2 logs $PM2_NAME"
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

log "Health check passed ✓"
log "=== Deploy complete — $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="