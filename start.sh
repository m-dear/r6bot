#!/usr/bin/env bash
# start.sh — launch the R6Bot demo in one command (no ROS2 required)
#
# Starts:
#   1. virtual_r6bot.py — robot simulator + WebSocket server (ws://localhost:8765)
#                         also speaks UDP port 30000 so the ROS2 driver can connect optionally
#   2. r6bot_webui      — Vite dev server  →  http://localhost:5173
#
# Usage:
#   ./start.sh
#   WEBUI_PORT=3000 ./start.sh   # optional custom UI port
#
# Optional ROS2 driver (separate terminal, not required for the web UI):
#   source install/setup.bash && ros2 launch r6bot_driver r6bot.launch.py
#
# Stop: Ctrl+C  (kills both processes)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE="$SCRIPT_DIR/virtual_r6bot.py"
WEBUI_DIR="$SCRIPT_DIR/r6bot_webui"
WEBUI_HOST="${WEBUI_HOST:-0.0.0.0}"
WEBUI_PORT="${WEBUI_PORT:-5173}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log() { echo -e "${GREEN}[start]${RESET} $*"; }
die() { echo -e "${RED}[start] ERROR:${RESET} $*" >&2; exit 1; }

APT_UPDATED=0

apt_update_once() {
    [[ "$APT_UPDATED" == "1" ]] && return
    command -v apt-get >/dev/null 2>&1 || die "apt-get not found; install dependencies manually"
    log "Updating apt package index…"
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
        apt-get update
    else
        command -v sudo >/dev/null 2>&1 || die "sudo not found; install dependencies manually"
        sudo apt-get update
    fi
    APT_UPDATED=1
}

apt_install() {
    apt_update_once
    log "Installing system packages: $*"
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
        DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    else
        sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    fi
}

node_major_version() {
    node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0
}

ensure_nodejs() {
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        local major
        major="$(node_major_version)"
        if (( major >= 18 )); then
            log "Node.js $(node --version) and npm $(npm --version) found."
            return
        fi
        log "Node.js $(node --version) found, but Node.js >= 18 is required."
    else
        log "Node.js/npm not found."
    fi

    log "Installing Node.js and npm from apt…"
    apt_install nodejs npm

    command -v node >/dev/null 2>&1 || die "node command still not found after install"
    command -v npm  >/dev/null 2>&1 || die "npm command still not found after install"

    local major
    major="$(node_major_version)"
    (( major >= 18 )) || die "Node.js $(node --version) installed, but Node.js >= 18 is required"
    log "Node.js $(node --version) and npm $(npm --version) ready."
}

ensure_python_websockets() {
    python3 -c "import websockets" 2>/dev/null && return

    log "Python websockets library not found."
    if command -v apt-get >/dev/null 2>&1; then
        apt_install python3-websockets
    else
        command -v pip3 >/dev/null 2>&1 || die "pip3 not found; install python3-websockets manually"
        pip3 install --user websockets --quiet
    fi

    python3 -c "import websockets" 2>/dev/null || die "Python websockets library still not available"
}

install_webui_dependencies() {
    cd "$WEBUI_DIR"
    if [[ ! -d "node_modules" ]] \
        || [[ "package.json" -nt "node_modules/.package-lock.json" ]] \
        || [[ "package-lock.json" -nt "node_modules/.package-lock.json" ]]; then
        log "Installing web UI dependencies with npm (Tailwind, shadcn UI dependencies, Vite, React)…"
        npm install --silent
    else
        log "Web UI npm dependencies already installed."
    fi
}

PIDS=()
CLEANED_UP=0
cleanup() {
    [[ "$CLEANED_UP" == "1" ]] && return
    CLEANED_UP=1
    echo ""
    log "Stopping all processes…"
    for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
    sleep 0.5
    for pid in "${PIDS[@]}"; do kill -9 "$pid" 2>/dev/null || true; done
    wait 2>/dev/null || true
    log "Done."
}
trap cleanup EXIT INT TERM

# ── preflight ────────────────────────────────────────────────────────────────
[[ -f "$BRIDGE" ]]    || die "virtual_r6bot.py not found: $BRIDGE"
[[ -d "$WEBUI_DIR" ]] || die "r6bot_webui/ not found: $WEBUI_DIR"
command -v python3 >/dev/null 2>&1 || die "python3 not found"
ensure_nodejs
ensure_python_websockets

# ── mesh symlink (serves r6bot_description meshes to Vite dev server) ───────
MESH_LINK="$WEBUI_DIR/public/meshes"
MESH_TARGET="../../r6bot_description/meshes"
MESH_TARGET_ABS="$SCRIPT_DIR/r6bot_description/meshes"
[[ -d "$MESH_TARGET_ABS" ]] || die "mesh directory not found: $MESH_TARGET_ABS"

mkdir -p "$WEBUI_DIR/public"
if [[ -L "$MESH_LINK" ]]; then
    if [[ "$(readlink "$MESH_LINK")" != "$MESH_TARGET" ]]; then
        ln -sfn "$MESH_TARGET" "$MESH_LINK"
        log "Linked mesh files → $MESH_LINK"
    fi
elif [[ -e "$MESH_LINK" ]]; then
    log "Using existing mesh directory → $MESH_LINK"
else
    ln -s "$MESH_TARGET" "$MESH_LINK"
    log "Linked mesh files → $MESH_LINK"
fi

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║         R6Bot Demo — starting up                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. virtual robot (sim + WebSocket + UDP) ─────────────────────────────────
log "Starting virtual_r6bot.py…"
python3 "$BRIDGE" &
PIDS+=($!)
log "  Virtual robot PID ${PIDS[-1]}  →  ws://localhost:8765"
sleep 1
if ! kill -0 "${PIDS[-1]}" 2>/dev/null; then
    wait "${PIDS[-1]}" 2>/dev/null || true
    die "virtual_r6bot.py exited early; check whether UDP port 30000 or WebSocket port 8765 is already in use"
fi

# ── 2. web UI ──────────────────────────────────────────────────────────────
log "Starting r6bot_webui from $WEBUI_DIR on port $WEBUI_PORT…"
install_webui_dependencies

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${GREEN}  Open →  http://localhost:${WEBUI_PORT}                     ${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Ctrl+C to stop\n"

npm run dev -- --host "$WEBUI_HOST" --port "$WEBUI_PORT"
