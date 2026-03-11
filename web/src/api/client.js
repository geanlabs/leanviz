import { asNumber, pickFirstNumber, pickFirstString } from "../utils.js";

export async function fetchJSON(url, { timeout = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(tid);
  }
}

export function parseHeadResponse(headResp) {
  const slot = pickFirstNumber(headResp, ["slot"]);
  const proposer = pickFirstNumber(headResp, ["proposer_index", "proposerIndex"]);
  const root = pickFirstString(headResp, ["root", "block"]);
  return { slot, proposer, root };
}

export function parseFinalityResponse(finalityData) {
  const jSlot = asNumber(finalityData?.current_justified?.slot) ??
    asNumber(finalityData?.current_justified_slot) ??
    asNumber(finalityData?.justified_slot);
  const jEpoch = asNumber(finalityData?.current_justified?.epoch) ??
    pickFirstNumber(finalityData?.current_justified, ["epoch"]);
  const jRoot = finalityData?.current_justified?.root || pickFirstString(finalityData?.current_justified, ["root"]);

  const fSlot = asNumber(finalityData?.finalized?.slot) ??
    asNumber(finalityData?.finalized_slot);
  const fEpoch = asNumber(finalityData?.finalized?.epoch) ??
    pickFirstNumber(finalityData?.finalized, ["epoch"]);
  const fRoot = finalityData?.finalized?.root || pickFirstString(finalityData?.finalized, ["root"]);

  return {
    justified: { slot: jSlot, epoch: jEpoch, root: jRoot },
    finalized: { slot: fSlot, epoch: fEpoch, root: fRoot }
  };
}

export function parseHeadEvent(payload) {
  const slot = pickFirstNumber(payload, ["slot"]);
  const proposer = pickFirstNumber(payload, ["proposer_index", "proposerIndex"]);
  const root = pickFirstString(payload, ["block", "block_root", "root"]);
  return { slot, proposer, root };
}

export function parseFinalizedEvent(payload) {
  const slot = pickFirstNumber(payload, ["slot", "finalized_slot"]);
  const epoch = pickFirstNumber(payload, ["epoch"]);
  const root = pickFirstString(payload, ["block", "root"]);
  return { slot, epoch, root };
}

export function parseReorgEvent(payload) {
  const idx = pickFirstNumber(payload, ["validator_index", "proposer_index", "index"]);
  return { index: idx };
}
