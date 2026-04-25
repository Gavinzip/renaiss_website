# Renaiss Website (Frontend + AI Intel Backend)

This repository contains:
- Static frontend: `index.html`, `game.html`, `assets/`
- Backend API + scheduler: `scripts/ai_intel_server.py`
- Intel pipeline: `scripts/x_intel_core.py`, `scripts/minimax_news.py`

## 1) Local run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
./start.sh
```

Open: `http://127.0.0.1:8787/index.html`

## 2) Zeabur deployment (backend)

Recommended runtime command:

```bash
pip install -r requirements.txt && ./start.sh
```

The server reads `PORT` from environment and binds `0.0.0.0` by default via `start.sh`.

### Required env vars
- `MINIMAX_API_KEY`
- `INTEL_ADMIN_USER`
- One of:
  - `INTEL_ADMIN_PASS_HASH` (recommended)
  - `INTEL_ADMIN_PASS`

### Optional env vars
- `MINIMAX_API_HOST` (default `https://api.minimax.io`)
- `MINIMAX_TEXT_MODEL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_MONITOR_ENABLED`, `DISCORD_MONITOR_CHANNEL_IDS`, `DISCORD_MONITOR_LIMIT`
- `INTEL_ALLOWED_ORIGINS`
- `INTEL_COOKIE_SAMESITE`, `INTEL_COOKIE_SECURE`, `INTEL_COOKIE_DOMAIN`
- `INTEL_SESSION_TTL_SECONDS`
- `NEWS_INTERVAL_MINUTES`, `NEWS_LANGS`

## 3) Frontend deployment

If frontend and backend are deployed separately:
- Keep frontend static hosting as-is.
- Point frontend API requests to your backend domain.
- Add frontend domain to `INTEL_ALLOWED_ORIGINS`.
- For cross-site login cookies, set:
  - `INTEL_COOKIE_SAMESITE=None`
  - `INTEL_COOKIE_SECURE=1`
  - `INTEL_COOKIE_DOMAIN=<your-backend-domain>` (optional, depends on domain strategy)

## 4) Generate password hash (recommended)

### PBKDF2-SHA256 format (supported by backend)

```bash
python3 - <<'PY'
import hashlib, secrets
pwd = "replace-with-your-password"
salt = secrets.token_hex(8)
iterations = 600000
digest = hashlib.pbkdf2_hmac("sha256", pwd.encode(), salt.encode(), iterations).hex()
print(f"pbkdf2_sha256${iterations}${salt}${digest}")
PY
```

Use the output as `INTEL_ADMIN_PASS_HASH`.

## 5) Data files

The backend reads/writes under `data/`:
- `x_intel_feed.json`
- `x_intel_feedback.json`
- `x_intel_jobs.json`
- `x_intel_manual_entries.json`
- `x_intel_manual_picks.json`
- `pokemon_latest_news*.json`

If your platform has ephemeral disk, data resets on redeploy unless you mount persistent storage.
