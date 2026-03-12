# leanviz

LeanViz is a standalone, client-agnostic dashboard for Lean consensus networks.

## Run
Serve the static files:
`python3 -m http.server 7070 --directory web`

Open:
`http://localhost:7070/index.html`

API check page:
`http://localhost:7070/health.html`

## Configure
Edit `web/config/config.json` or use query params:
- `?beacon=http://localhost:5052`
- `?metrics=http://localhost:9090`
- `?mode=live`
- `?ns=eth` (use `/eth/v1/...` instead of `/lean/v0/...`)

## Docs
- `docs/api-contract.md`
- `docs/runbook.md`
- `docs/changes.md`
