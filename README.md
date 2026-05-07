# Renaiss Website (Backend + Frontend Chain Backup)

This repository tracks both parts in one place:
- Backend runtime (Zeabur): API + scheduler in `scripts/` and `main.py`
- Frontend chain deployment package (backup): `frontend_chain/`

`frontend_chain/` is static backup data for Walrus/Walgo publishing.
It does not add backend runtime behavior on Zeabur.

## 1) Local run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
./start.sh
```

Backend API base: `http://127.0.0.1:8787`

## 2) Zeabur deployment (backend)

Recommended runtime command:

```bash
pip install -r requirements.txt && ./start.sh
```

The server reads `PORT` from environment and binds `0.0.0.0` by default via `start.sh`.

### Frontend/Backend split (runtime rule)

- Zeabur runs backend only.
- Frontend is deployed on-chain from `frontend_chain/`.
- Keeping `frontend_chain/` inside this repo is for backup and traceability.

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
- `APP_ENV=server`, `WEBSITE_DATA_ROOT=/data/RENAISS_WEBSITE`
- `WEBSITE_DATA_RESTORE_ON_STARTUP=0` (restore by admin button), `WEBSITE_DATA_RESTORE_POLICY=always`
- `I18N_FEED_FALLBACK_MODE=base`

### Recommended persistent data env for Zeabur

To keep backend cards and translations consistent across restarts:

- `APP_ENV=server`
- `WEBSITE_DATA_ROOT=/data/RENAISS_WEBSITE`
- `WEBSITE_DATA_RESTORE_ON_STARTUP=0` (manual restore via admin panel)
- `WEBSITE_DATA_RESTORE_POLICY=always`
- `WEBSITE_BACKUP_PROVIDER=git`
- `WEBSITE_BACKUP_REPO=https://github.com/Gavinzip/webdata.git`
- `WEBSITE_BACKUP_SUBDIR=RENAISS_WEBSITE`
- Keep `WEBSITE_BACKUP_ENABLED=0` by default unless you explicitly want server-side auto-push back to git.

## 3) Frontend deployment (Walrus / chain)

Frontend source of truth:
- `website/`

Frontend package location generated for chain publishing:
- `frontend_chain/index.html`
- `frontend_chain/game.html`
- `frontend_chain/assets/`
- `frontend_chain/sbt_icons.json`
- `frontend_chain/image.png`
- `frontend_chain/data/i18n_text_cache.json`

`frontend_chain/` is synced from `website/` by whitelist before every chain update. Backend folders and `website/scripts` are not copied.

Manual sync only:

```bash
./scripts/sync_frontend_chain.sh
```

Update command example (use this for daily deploy, do not create a new site):

```bash
./scripts/update_frontend_chain.sh
```

Dry-run example:

```bash
DRY_RUN=1 GAS_BUDGET=200000000 ./scripts/update_frontend_chain.sh
```

Latest published site object ID (clean frontend package, pinned):
- `0xbdce612ad5728af48fc2361f083ad6d615d41b16c7018f99920471e479c243c8`

Latest publish metadata file:
- `frontend_chain/ws-resources.json`

If frontend and backend are deployed separately:
- Point frontend API requests to your backend domain.
- Add frontend domain to `INTEL_ALLOWED_ORIGINS`.
- For cross-site login cookies, set:
  - `INTEL_COOKIE_SAMESITE=None`
  - `INTEL_COOKIE_SECURE=1`
  - `INTEL_COOKIE_DOMAIN=<your-backend-domain>` (optional)

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
