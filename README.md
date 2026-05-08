# leanviz

LeanViz is a standalone, client-agnostic dashboard for Lean consensus networks.

## Run
Serve the static files and API proxy:
`python3 proxy.py`

Open:
`http://localhost:7070/index.html`

API check page:
`http://localhost:7070/health.html`

## Configure
Edit `web/config/config.json` or use query params:
- `?beacon=http://localhost:5052`
- `?metrics=http://localhost:5054`
- `?mode=live`
- `?ns=lean` (default)

## Integration with Gean

To visualize a local `gean` node:

1. **Start Gean**: Ensure your node is running with the API enabled (default port 5052).
2. **Start LeanViz Proxy**: Run `python3 proxy.py` in this directory.
3. **Open LeanViz**: Navigate to [http://localhost:7070](http://localhost:7070).
4. **Configure Connection**:
   - Open **Settings** (⚙ icon).
   - Set **Beacon API URL** to: `http://localhost:7070/proxy/http://localhost:5052`
   - Set **Metrics URL** to: `http://localhost:7070/proxy/http://localhost:5054`
   - Set **Mode** to `Live`.
   - Click **Apply**.

> [!NOTE]
> The proxy is required to bypass CORS restrictions since `gean` does not serve CORS headers by default.

## Docs
- `docs/api-contract.md`
- `docs/runbook.md`
- `docs/changes.md`
