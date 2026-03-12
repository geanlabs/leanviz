import { DEFAULT_VALIDATOR_COUNT, DEMO_SLOT_MS, LIVE_SLOT_MS, PHASES, state } from "../state.js";
import { asNumber, randomHash, randomInt, truncateRoot } from "../utils.js";

export function currentSlotMs() {
  return state.mode === "live" ? LIVE_SLOT_MS : DEMO_SLOT_MS;
}

export function getValidatorCount() {
  return Math.max(1, state.validatorCount || state.validators.length || DEFAULT_VALIDATOR_COUNT);
}

export function ensureValidators(count) {
  const c = Math.max(1, Number(count) || DEFAULT_VALIDATOR_COUNT);
  state.validatorCount = c;
  if (state.validators.length === c) return;
  state.validators = Array.from({ length: c }, (_, i) => {
    const prev = state.validators[i];
    return {
      id: i,
      status: prev?.status || "idle",
      active: prev?.active !== false
    };
  });
  state.currentVoters = new Set();
  state.targetVoters = [];
  state.voteCursor = 0;
  if (state.proposer >= c) state.proposer = c - 1;
}

export function isValidatorActiveStatus(status) {
  const s = String(status || "").toLowerCase();
  if (!s) return true;
  if (s.includes("pending") || s.includes("exited") || s.includes("withdraw")) return false;
  return s.includes("active");
}

export function applyLiveValidatorStatuses(rows) {
  if (!Array.isArray(rows)) return;
  ensureValidators(rows.length || getValidatorCount());

  const activeByIndex = new Map();
  for (const row of rows) {
    const idx = asNumber(row?.index ?? row?.validator?.index);
    const status = row?.status ?? row?.validator?.status;
    if (idx == null || idx < 0 || idx >= state.validators.length) continue;
    activeByIndex.set(idx, isValidatorActiveStatus(status));
  }

  for (const v of state.validators) {
    if (activeByIndex.has(v.id)) v.active = activeByIndex.get(v.id);
  }
}

export function makeDeterministicVoters(slot, proposer, voteCount, count, seed = "") {
  const pool = Array.from({ length: count }, (_, i) => i).filter((v) => v !== proposer);
  const baseSeed = String(seed || "") + ":" + slot.toString() + ":" + proposer.toString();
  let h = 2166136261;
  for (let i = 0; i < baseSeed.length; i++) {
    h ^= baseSeed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    h ^= i + 0x9e3779b9;
    h = Math.imul(h, 16777619);
    const j = Math.abs(h) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(voteCount, pool.length));
}

export function chooseProposer() {
  const count = getValidatorCount();
  let proposer = randomInt(0, count - 1);
  while (count > 1 && proposer === state.previousProposer) proposer = randomInt(0, count - 1);
  state.previousProposer = proposer;
  return proposer;
}

export function createSlotPlan(opts = {}) {
  const count = getValidatorCount();
  const proposer = opts.proposer != null ? opts.proposer : chooseProposer();
  const participationRate = opts.participationRate != null ? opts.participationRate : randomInt(82, 99);
  const voteCount = Math.max(0, Math.round((participationRate / 100) * (count - 1)));

  state.targetVoters = makeDeterministicVoters(state.currentSlot, proposer, voteCount, count, opts.seed);
  state.currentVoters = new Set();
  state.voteCursor = 0;
  state.nextVoteAt = performance.now() + randomInt(400, 800);

  for (const v of state.validators) {
    v.status = v.id === proposer ? "proposer" : "idle";
  }

  if (!state.blocks.some((b) => b.slot === state.currentSlot)) {
    addBlock(state.currentSlot, false, {
      proposer,
      participationRate,
      root: opts.root || "",
      checkpoint: {
        sourceSlot: state.justifiedCheckpoint?.slot ?? Math.max(0, state.currentSlot - 2),
        targetSlot: Math.max(0, state.currentSlot - 1),
        headSlot: state.currentSlot
      }
    });
  }
}

export function addBlock(slot, missed = false, opts = {}) {
  const hash = opts.root ? truncateRoot(opts.root) : randomHash(slot);
  const proposer = opts.proposer != null ? opts.proposer : chooseProposer();
  const participationRate = opts.participationRate != null ? opts.participationRate : randomInt(82, 99);

  const checkpoint = opts.checkpoint || {
    sourceSlot: Math.max(0, slot - 2),
    targetSlot: Math.max(0, slot - 1),
    headSlot: slot
  };

  const block = {
    slot,
    hash,
    proposer,
    participation: participationRate,
    missed,
    checkpoint,
    createdAt: performance.now(),
    synthetic: !!opts.synthetic,
    countMissed: opts.countMissed !== false,
    flashUntil: 0
  };

  state.blocks = state.blocks.filter((b) => b.slot !== slot).concat(block);
  state.blocks.sort((a, b) => a.slot - b.slot);
  if (missed && block.countMissed) state.missedSlots += 1;
}

export function getBlockStatus(block) {
  if (block.missed) return "MISSED";
  if (state.finalizedCheckpoint && block.slot <= state.finalizedCheckpoint.slot) return "FINALIZED";
  if (state.justifiedCheckpoint && block.slot <= state.justifiedCheckpoint.slot) return "JUSTIFIED";
  return "HEAD";
}

export function findLatestByStatus(status) {
  for (let i = state.blocks.length - 1; i >= 0; i--) {
    const b = state.blocks[i];
    if (getBlockStatus(b) === status) return b;
  }
  return null;
}

export function onNewSlot() {
  state.currentSlot += 1;
  state.epoch = Math.floor(state.currentSlot / 32);
  state.slotStartedAt = performance.now();
  state.proposer = chooseProposer();
  state.participationRate = randomInt(82, 99);
  createSlotPlan({ proposer: state.proposer, participationRate: state.participationRate, seed: `${state.currentSlot}` });
  addBlock(state.currentSlot, Math.random() < 0.06);
  hydrateHistory();
}

export function hydrateHistory() {
  state.finalizedHistory = state.blocks
    .filter((b) => !b.missed && b.slot <= state.currentSlot - 2)
    .slice(-12)
    .map((b) => b.slot)
    .reverse();
}

export function markFinalized(slot) {
  const block = state.blocks.find((b) => b.slot === slot && !b.missed);
  if (block) {
    block.flashUntil = performance.now() + 600;
  }
  if (!state.finalizedHistory.includes(slot)) {
    state.finalizedHistory.unshift(slot);
    state.finalizedHistory = state.finalizedHistory.slice(0, 12);
  }
}

export function applyHead(slot, proposer, root) {
  if (slot == null) return;

  if (slot < state.currentSlot) {
    state.blocks = state.blocks.filter((b) => b.slot <= slot);
    state.finalizedHistory = state.finalizedHistory.filter((s) => s <= slot);
    state.missedSlots = state.blocks.filter((b) => b.missed && !b.synthetic).length;
    state.currentSlot = slot - 1;
  }

  if (slot === state.currentSlot) {
    const existing = state.blocks.find((b) => b.slot === slot);
    if (existing) {
      if (proposer != null) existing.proposer = proposer;
      if (root) existing.hash = truncateRoot(root);
      existing.checkpoint = {
        sourceSlot: state.justifiedCheckpoint?.slot ?? Math.max(0, slot - 2),
        targetSlot: Math.max(0, slot - 1),
        headSlot: slot
      };
      existing.createdAt = performance.now();
    }
    return;
  }

  for (let s = state.currentSlot + 1; s < slot; s++) {
    state.proposer = chooseProposer();
    state.participationRate = randomInt(82, 99);
    addBlock(s, true, { countMissed: false, synthetic: true });
  }

  state.currentSlot = slot;
  state.epoch = Math.floor(slot / 32);
  state.slotStartedAt = performance.now();
  state.proposer = proposer != null ? proposer : chooseProposer();
  state.previousProposer = state.proposer;
  state.participationRate = randomInt(82, 99);
  createSlotPlan({ proposer: state.proposer, participationRate: state.participationRate, seed: `${slot}:${root || ""}`, root: root || "" });
}

export function applyFinalityCheckpoint(kind, root, slot) {
  if (slot == null) return;
  const cp = { root: truncateRoot(root), slot };
  if (kind === "justified") state.justifiedCheckpoint = cp;
  if (kind === "finalized") {
    const prev = state.finalizedCheckpoint ? state.finalizedCheckpoint.slot : null;
    state.finalizedCheckpoint = cp;
    if (prev == null || slot > prev) markFinalized(slot);
  }
}

export function getPhase(now) {
  const slotMs = currentSlotMs();
  const elapsed = (now - state.slotStartedAt + slotMs) % slotMs;
  let cursor = 0;
  for (const phase of PHASES) {
    const duration = phase.ratio * slotMs;
    if (elapsed >= cursor && elapsed < cursor + duration) {
      return { id: phase.id, progress: (elapsed - cursor) / duration, elapsed };
    }
    cursor += duration;
  }
  return { id: "merge", progress: 1, elapsed };
}

export function updateVotes(now) {
  const phase = state.currentPhase;
  if (phase !== "vote") return;
  while (state.voteCursor < state.targetVoters.length && now >= state.nextVoteAt) {
    const id = state.targetVoters[state.voteCursor];
    state.voteCursor += 1;
    state.currentVoters.add(id);
    if (state.validators[id].status !== "proposer") state.validators[id].status = "voted";

    state.particles.push({ validatorId: id, startAt: now, duration: 1450, kind: "attestation" });
    state.voteRings.push({ validatorId: id, startAt: now, duration: 1300 });

    state.nextVoteAt = now + randomInt(900, 1300);
  }
}
