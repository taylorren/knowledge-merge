# Knowledge Merges

Knowledge Merges is a Nuxt app for exploring two topic branches, generating step-by-step concept cards, and declaring where both paths converge.

## What the app does today

- Starts a dual-branch session from two user-provided topics (`left` and `right`)
- Generates a summary and up to 3 suggested next keywords per step using AI
- Lets you continue either branch using a suggested keyword or your own keyword
- Lets you declare a merged concept and optionally auto-generate the merge narrative
- Archives completed merges and provides a detail view for historical paths
- Shows concept previews (keyword + summary) for archived branch steps
- Persists one active session and merge history in local SQLite
- Supports toggling AI provider between local and cloud in the UI
- Uses a dedicated login screen at `/` and an authenticated workspace at `/workspace`

## Tech stack

- Nuxt 4 + Vue 3
- Nitro server routes (`server/api/*`)
- SQLite via Node `node:sqlite`

## Runtime requirements

- Node.js 22.5+ (24+ recommended for best `node:sqlite` support)
- pnpm (recommended), npm also works

## Configuration

Copy `.env.example` to `.env` and set values for your environment:

```bash
LOCAL_OLLAMA_BASE_URI=http://your-ollama-host:11434
LOCAL_OLLAMA_MODEL=your-local-model
CLOUD_AI_BASE_URI=https://your-provider.example.com/v1
CLOUD_AI_MODEL=your-cloud-model
CLOUD_AI_API_KEY=your-cloud-api-key
APP_AUTH_USERNAME=admin
APP_AUTH_PASSWORD=replace-with-strong-password
AUTH_SESSION_TTL_HOURS=24
AI_MAX_REQUESTS_PER_MINUTE=20
AI_REPLAY_PROTECTION_WINDOW_MS=15000
```

Notes:

- Local provider is the default active provider.
- If you switch to cloud in the UI, cloud vars must be fully configured.
- If local is active, local Ollama vars must be configured.
- `APP_AUTH_USERNAME` and `APP_AUTH_PASSWORD` are required for login-protected write routes.
- Write routes that can trigger AI usage require an authenticated session cookie.
- `AUTH_SESSION_TTL_HOURS` controls login session expiration (sliding expiration, default 24h).
- `AI_MAX_REQUESTS_PER_MINUTE` applies an in-memory per-IP limit to protected write routes (`0` disables the limit).
- `AI_REPLAY_PROTECTION_WINDOW_MS` blocks rapid duplicate AI-consuming requests for the same user and payload (default 15s).
- Archive browsing endpoints remain publicly readable.

## Install and run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to sign in, then continue in `/workspace`.

## Build and preview

```bash
pnpm build
pnpm preview
```

## Product flow

1. Sign in at `/`.
2. Start a session in `/workspace` with left and right topics.
3. The server creates one active session and generates initial steps for both branches.
4. Continue each branch step-by-step with suggested or custom keywords.
5. Declare a merge concept; narrative can be manual or AI-generated.
6. Review archived merge cards in `/archives`.

Starting a new session automatically marks any previous active session as `abandoned`.

## Data persistence

- Default database path: `data/knowledge-merges.db`
- Optional override: `KNOWLEDGE_MERGES_DB_PATH`

Main persisted entities:

- `sessions` (`active`, `merged`, `abandoned`)
- `branch_steps`
- `merge_cards`
- `ai_settings` (active provider selection)

## API surface (used by the UI)

- `GET /api/session/active`
- `POST /api/session/start`
- `POST /api/session/step`
- `POST /api/session/merge`
- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/merge-cards/recent?limit=50`
- `GET /api/merge-cards/:id/concept?branch=left|right&stepIndex=n`
- `GET /api/ai/settings`
- `POST /api/ai/settings`
