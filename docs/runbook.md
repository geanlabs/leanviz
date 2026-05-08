# LeanViz Runbook

## Local Dev
Serve the static files and API proxy:
`python3 proxy.py`

Open:
`http://localhost:7070/index.html`

API check page:
`http://localhost:7070/health.html`

## Configure API URLs
Edit `web/config/config.json`:
```
{
  "beaconUrl": "http://localhost:5052",
  "metricsUrl": "http://localhost:9090",
  "mode": "demo",
  "apiNamespace": "lean"
}
```

Or use query params:
- `?beacon=http://localhost:5052`
- `?metrics=http://localhost:9090`
- `?mode=live`
- `?ns=eth` (use `/eth/v1/...` instead of `/lean/v0/...`)

## Troubleshooting
- If UI shows no movement, check console errors.
- If API is unreachable, UI falls back to demo mode.
