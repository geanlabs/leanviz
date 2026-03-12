# LeanViz Monitoring API Contract (v0)

This document defines the minimum API surface required by the LeanViz dashboard.
It is intentionally small and focused on monitoring data.

## Status
- UI defaults to Lean-style paths (`/lean/v0/...`).
- Clients may also serve `/eth/v1/...` as a compatibility alias during migration.

## Base URL
All endpoints are relative to a base URL (configured in `web/config/config.json`).

## Endpoints (Required)
1. `GET /lean/v0/beacon/genesis`
2. `GET /lean/v0/beacon/headers/head`
3. `GET /lean/v0/beacon/states/head/finality_checkpoints`
4. `GET /lean/v0/beacon/states/head/validators`
5. `GET /lean/v0/node/peers`
6. `GET /lean/v0/node/syncing`
7. `GET /lean/v0/events` (SSE)

Compatibility alias (optional):
- `/eth/v1/...` with the same semantics

## Response Shape (Minimum Fields)
The UI only depends on the following fields. Extra fields are ignored.

1. `/beacon/headers/head`
- `data.root` or `root`
- `data.header.message.slot` or `slot`
- `data.header.message.proposer_index` or `proposer_index`

2. `/beacon/states/head/finality_checkpoints`
- `data.current_justified.slot` or `current_justified_slot`
- `data.current_justified.epoch` or `current_justified.epoch`
- `data.current_justified.root` or `current_justified.root`
- `data.finalized.slot` or `finalized_slot`
- `data.finalized.epoch` or `finalized.epoch`
- `data.finalized.root` or `finalized.root`

3. `/beacon/states/head/validators`
- `data[]` array length determines validator count
- `data[i].index` or `data[i].validator.index`
- `data[i].status` or `data[i].validator.status`

4. `/node/peers`
- `data[]` array length determines peer count

5. `/node/syncing`
- `data.head_slot` (optional; used only for display)

## Example Responses
1. `/beacon/headers/head`
```json
{
  "data": {
    "root": "0xabc123...",
    "header": {
      "message": {
        "slot": "107",
        "proposer_index": "22"
      }
    }
  }
}
```

2. `/beacon/states/head/finality_checkpoints`
```json
{
  "data": {
    "current_justified": {
      "epoch": "3",
      "slot": "96",
      "root": "0xdef456..."
    },
    "finalized": {
      "epoch": "3",
      "slot": "98",
      "root": "0x789abc..."
    }
  }
}
```

3. `/beacon/states/head/validators`
```json
{
  "data": [
    { "index": "0", "status": "active_ongoing" },
    { "index": "1", "status": "active_ongoing" }
  ]
}
```

4. `/node/peers`
```json
{
  "data": [
    { "peer_id": "16Uiu2H..." }
  ]
}
```

5. `/node/syncing`
```json
{
  "data": {
    "head_slot": "107"
  }
}
```

## SSE Events
Endpoint: `/events?topics=head,block,finalized_checkpoint,chain_reorg,attester_slashing,proposer_slashing`

The UI uses only:
- `head` or `block` events
  - `slot`
  - `proposer_index` (optional)
  - `block` or `root`
- `finalized_checkpoint` events
  - `slot` or `finalized_slot`
  - `epoch` (optional)
  - `block` or `root`
- `chain_reorg` events
  - payload is not parsed
- `attester_slashing` or `proposer_slashing` events
  - `validator_index` or `proposer_index` or `index`

## Example SSE Events
```
event: head
data: {"slot":"107","proposer_index":"22","block":"0xabc123..."}

event: finalized_checkpoint
data: {"slot":"98","epoch":"3","block":"0x789abc..."}
```

## CORS
The API must allow the dashboard origin.
Recommended:
- `Access-Control-Allow-Origin: *` (dev)
- Restrict origin in production.

## Notes
- The UI will run in "demo" mode if API calls fail.
- Missing fields will degrade the display but should not crash the UI.
