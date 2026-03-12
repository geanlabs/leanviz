# Change Notes

This file tracks significant refactors and structural changes in the LeanViz codebase.

## 2026-03-11
- Extracted dashboard into a standalone repo layout under `web/`.
- Split monolithic HTML into `index.html`, `styles/main.css`, and JS modules.
- Added runtime config support via `web/config/config.json` and query params.
- Split JS into modules: `api/`, `render/`, `sim/`, `state`, `dom`, and `utils`.
- Preserved visual design and animation behavior.
- Default API namespace switched to `/lean/v0` with optional `/eth/v1` override.
- Added `web/health.html` API check page.
