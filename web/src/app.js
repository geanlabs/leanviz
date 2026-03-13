import { fetchJSON, fetchText, parseFinalizedEvent, parseHeadEvent, parseReorgEvent } from "./api/client.js";
import { loadConfig } from "./config.js";
import { COLORS, PHASES, peers, state } from "./state.js";
import { chainCanvas, chainCtx, nodes, validatorCanvas, validatorCtx } from "./dom.js";
import { formatSince, randomInt } from "./utils.js";
import { drawChainCanvas } from "./render/chain.js";
import { drawValidatorCanvas } from "./render/validators.js";
import {
  addBlock,
  applyFinalityCheckpoint,
  applyHead,
  applyLiveValidatorStatuses,
  chooseProposer,
  createSlotPlan,
  currentSlotMs,
  ensureValidators,
  findLatestByStatus,
  getPhase,
  getValidatorCount,
  onNewSlot,
  updateVotes
} from "./sim/logic.js";

"use strict";

function setupPeerPills() {
  nodes.peerPills.innerHTML = "";
  for (const p of peers) {
    const el = document.createElement("div");
    el.className = `peer-pill ${p.self ? "self" : ""}`;
    el.innerHTML = `<span class="dot ${p.status}"></span><span>${p.name} · ${p.lang}</span>`;
    nodes.peerPills.appendChild(el);
  }
}

function setWarning(msg) {
  if (!msg) {
    nodes.warningBanner.classList.remove("show");
    nodes.warningBanner.textContent = "";
    return;
  }
  nodes.warningBanner.textContent = `⚠ ${msg}`;
  nodes.warningBanner.classList.add("show");
}

function toUserError(err, phase) {
  const raw = err && err.message ? String(err.message) : String(err || "unknown error");
  const lower = raw.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return `${phase}: network/CORS blocked (${state.live.beaconUrl})`;
  }
  if (lower.includes("abort")) {
    return `${phase}: request timeout`;
  }
  return `${phase}: ${raw}`;
}

function setLiveError(errText) {
  state.live.lastError = errText || "";
  updateConnectionStrip();
}

function updateConnectionStrip() {
  nodes.connMode.textContent = state.mode;
  if (state.mode === "demo") {
    nodes.connTransport.textContent = "simulation";
  } else {
    nodes.connTransport.textContent = state.live.connected ? "sse + rest" : "connecting";
  }
  nodes.connLastRest.textContent = formatSince(state.live.lastRestSuccessAt);
  const evt = state.live.lastEventType ? `${state.live.lastEventType} · ${formatSince(state.live.lastEventAt)}` : "never";
  nodes.connLastEvent.textContent = evt;
  nodes.connError.textContent = state.live.lastError || "none";
}

function setModeBadge() {
  if (state.mode === "live") {
    nodes.liveBadge.textContent = state.live.connected ? "● LIVE API" : "● LIVE (CONNECTING)";
    nodes.liveBadge.classList.toggle("warn", !state.live.connected);
  } else {
    nodes.liveBadge.textContent = "● LIVE SIM";
    nodes.liveBadge.classList.remove("warn");
  }
  updateConnectionStrip();
}

function setMode(mode, reason = "") {
  if (mode !== "live") mode = "demo";
  state.mode = mode;
  localStorage.setItem("leanviz_mode", mode);
  nodes.modeSelect.value = mode;
  setModeBadge();
  if (mode === "demo") {
    disconnectLive();
    if (reason) setWarning(reason);
  } else {
    setWarning("");
    setLiveError("");
    connectLive();
  }
  updateSlotCycleLabel();
}


function updateSlotCycleLabel() {
  const sec = (currentSlotMs() / 1000).toFixed(1);
  nodes.slotCycleLabel.textContent = `3 slot finality / ${sec}s cycle`;
}

function setupPhases() {
  nodes.phaseList.innerHTML = "";
  for (const phase of PHASES) {
    const item = document.createElement("div");
    item.className = "phase-item pending";
    item.dataset.phase = phase.id;
    item.innerHTML = `
          <div class="phase-top">
            <span class="phase-icon">${phase.icon}</span>
            <span class="phase-name">${phase.label}</span>
            <span class="phase-state">···</span>
          </div>
          <div class="phase-desc">${phase.desc}</div>
          <div class="phase-progress"><span></span></div>
        `;
    nodes.phaseList.appendChild(item);
  }
}

function resizeCanvas(canvas, ctx) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * ratio);
  canvas.height = Math.floor(h * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
















async function pollLiveREST() {
  const base = state.live.beaconUrl.replace(/\/+$/, "");
  const ns = state.live.apiNamespace === "eth" ? "eth/v1" : "lean/v0";
  try {
    const fcResp = await fetchJSON(`${base}/${ns}/fork_choice`);
    const fcData = fcResp?.data || fcResp || {};

    const headRoot = fcData.head;
    const nodesList = fcData.nodes || [];
    const headNode = nodesList.find(n => n.root === headRoot) || {};

    if (headRoot && headNode.slot != null) {
      applyHead(headNode.slot, headNode.proposer_index || 0, headRoot);
    }

    if (fcData.justified?.slot != null) {
      applyFinalityCheckpoint("justified", fcData.justified.root, fcData.justified.slot);
    }
    if (fcData.finalized?.slot != null) {
      applyFinalityCheckpoint("finalized", fcData.finalized.root, fcData.finalized.slot);
    }

    const validatorCount = fcData.validator_count || getValidatorCount();
    ensureValidators(validatorCount);
    if (state.proposer >= getValidatorCount()) state.proposer = getValidatorCount() - 1;

    state.live.peerCount = 0; // Not provided by fork_choice yet
    nodes.mPeers.textContent = "-";

    state.live.lastRestSuccessAt = Date.now();
    setLiveError("");
  } catch (err) {
    const userErr = toUserError(err, "REST");
    setLiveError(userErr);
    if (state.mode === "live") {
      setWarning(`${userErr} - staying in live mode`);
      state.live.connected = false;
      setModeBadge();
    } else {
      setMode("demo", `${userErr} - running in demo mode`);
    }
  }
}

async function pollMetrics() {
  if (!state.live.metricsUrl) return;
  try {
    const raw = await fetchText(`${state.live.metricsUrl.replace(/\/+$/, "")}/metrics`, 2000);
    const gor = raw.match(/^go_goroutines\\s+([0-9.]+)/m);
    const mem = raw.match(/^process_resident_memory_bytes\\s+([0-9.]+)/m);
    nodes.dbgGoroutines.textContent = gor ? Math.round(Number(gor[1])).toString() : "-";
    nodes.dbgMemory.textContent = mem ? (Number(mem[1]) / (1024 * 1024)).toFixed(1) : "-";
    state.live.lastMetricsSuccessAt = Date.now();
  } catch (_) {
    nodes.dbgGoroutines.textContent = "-";
    nodes.dbgMemory.textContent = "-";
  }
}

function handleSSE(type, payload) {
  state.live.lastEventAt = Date.now();
  state.live.lastEventType = type;
  state.live.eventsSeen += 1;
  nodes.dbgEvents.textContent = String(state.live.eventsSeen);
  nodes.dbgLastEvent.textContent = type;
  if (state.mode === "live") setLiveError("");

  if (type === "head" || type === "block") {
    const parsed = parseHeadEvent(payload);
    applyHead(parsed.slot, parsed.proposer, parsed.root);
    return;
  }

  if (type === "finalized_checkpoint") {
    const parsed = parseFinalizedEvent(payload);
    if (parsed.slot != null) applyFinalityCheckpoint("finalized", parsed.root, parsed.slot);
    else if (parsed.epoch != null) applyFinalityCheckpoint("finalized", parsed.root, parsed.epoch * 32);
    return;
  }

  if (type === "chain_reorg") {
    setWarning("Chain reorg event observed from Lean node");
    return;
  }

  if (type === "attester_slashing" || type === "proposer_slashing") {
    const parsed = parseReorgEvent(payload);
    const idx = parsed.index;
    if (idx != null && idx < state.validators.length) {
      state.validators[idx].status = "slashed";
      setTimeout(() => {
        if (state.validators[idx].status === "slashed") state.validators[idx].status = "idle";
      }, 2500);
    }
  }
}

function connectLive() {
  disconnectLive();
  state.live.connected = false;
  setModeBadge();
  const base = state.live.beaconUrl.replace(/\/+$/, "");
  const ns = state.live.apiNamespace === "eth" ? "eth/v1" : "lean/v0";
  const sseUrl = `${base}/${ns}/events?topics=head,block,finalized_checkpoint,chain_reorg,attester_slashing,proposer_slashing`;

  try {
    const es = new EventSource(sseUrl);
    state.live.eventSource = es;

    es.onopen = () => {
      state.live.connected = true;
      state.live.lastEventAt = Date.now();
      setWarning("");
      setLiveError("");
      setModeBadge();
    };

    es.onerror = () => {
      const errText = `SSE: network/CORS blocked (${state.live.beaconUrl})`;
      setLiveError(errText);
      if (state.mode === "live") {
        setWarning(`${errText} - staying in live mode`);
        state.live.connected = false;
        setModeBadge();
      } else {
        setMode("demo", `${errText} - running in demo mode`);
      }
    };

    const bindEvent = (name) => {
      es.addEventListener(name, (ev) => {
        let payload = {};
        try {
          payload = ev.data ? JSON.parse(ev.data) : {};
        } catch (_) { }
        handleSSE(name, payload);
      });
    };
    ["head", "block", "finalized_checkpoint", "chain_reorg", "attester_slashing", "proposer_slashing"].forEach(bindEvent);
  } catch (err) {
    const userErr = toUserError(err, "SSE");
    setLiveError(userErr);
    if (state.mode === "live") {
      setWarning(`${userErr} - staying in live mode`);
      state.live.connected = false;
      setModeBadge();
    } else {
      setMode("demo", `${userErr} - running in demo mode`);
    }
    return;
  }

  state.live.restTimer = setInterval(() => {
    pollLiveREST();
    pollMetrics();
  }, currentSlotMs());
  pollLiveREST();
  pollMetrics();

  state.live.watchdogTimer = setInterval(() => {
    if (state.mode !== "live") return;
    const idleFor = Date.now() - state.live.lastEventAt;
    if (idleFor > 20000) {
      const errText = "SSE: timeout waiting for events";
      setLiveError(errText);
      if (state.mode === "live") {
        setWarning(`${errText} - staying in live mode`);
        state.live.connected = false;
        setModeBadge();
      } else {
        setMode("demo", "Live SSE timeout - running in demo mode");
      }
    }
  }, 5000);
}

function disconnectLive() {
  if (state.live.eventSource) {
    state.live.eventSource.close();
    state.live.eventSource = null;
  }
  if (state.live.restTimer) {
    clearInterval(state.live.restTimer);
    state.live.restTimer = null;
  }
  if (state.live.watchdogTimer) {
    clearInterval(state.live.watchdogTimer);
    state.live.watchdogTimer = null;
  }
  state.live.connected = false;
  setModeBadge();
}

function bindControls() {
  nodes.beaconInput.value = state.live.beaconUrl;
  nodes.metricsInput.value = state.live.metricsUrl;
  nodes.nsSelect.value = state.live.apiNamespace === "eth" ? "eth" : "lean";
  nodes.modeSelect.value = state.mode;

  nodes.settingsBtn.addEventListener("click", () => {
    nodes.settingsPanel.classList.toggle("open");
  });

  const applySettingsFromInputs = () => {
    state.live.beaconUrl = nodes.beaconInput.value.trim() || "http://localhost:5052";
    state.live.metricsUrl = nodes.metricsInput.value.trim() || "http://localhost:9090";
    state.live.apiNamespace = nodes.nsSelect.value === "eth" ? "eth" : "lean";
    localStorage.setItem("leanviz_beacon_url", state.live.beaconUrl);
    localStorage.setItem("leanviz_metrics_url", state.live.metricsUrl);
    localStorage.setItem("leanviz_api_ns", state.live.apiNamespace);

    const mode = nodes.modeSelect.value === "live" ? "live" : "demo";
    setMode(mode);
  };

  nodes.applySettings.addEventListener("click", () => {
    applySettingsFromInputs();
  });
}



function updateUI(now) {
  updateConnectionStrip();
  const phase = getPhase(now);
  state.currentPhase = phase.id;
  state.phaseProgress = phase.progress;

  const untilNext = Math.max(0, currentSlotMs() - phase.elapsed) / 1000;
  nodes.countdown.textContent = `NEXT SLOT IN ${untilNext.toFixed(1)}s`;
  nodes.leftSlot.textContent = `SLOT ${state.currentSlot}`;
  nodes.proposerText.textContent = `Proposer: Validator #${state.proposer}`;
  nodes.finalizeHint.textContent = `Slot ${Math.max(0, state.currentSlot - 3)} finalizes this round`;

  const phaseItems = nodes.phaseList.querySelectorAll(".phase-item");
  PHASES.forEach((p, idx) => {
    const item = phaseItems[idx];
    const bar = item.querySelector(".phase-progress > span");
    const phaseState = item.querySelector(".phase-state");
    const currentIdx = PHASES.findIndex((x) => x.id === phase.id);

    item.classList.remove("active", "done", "pending");
    if (idx < currentIdx) {
      item.classList.add("done");
      phaseState.textContent = "✓";
      bar.style.width = "100%";
    } else if (idx === currentIdx) {
      item.classList.add("active");
      phaseState.textContent = "●";
      bar.style.width = `${Math.max(3, phase.progress * 100)}%`;
    } else {
      item.classList.add("pending");
      phaseState.textContent = "···";
      bar.style.width = "0%";
    }
  });

  const justified = findLatestByStatus("JUSTIFIED");
  const finalized = findLatestByStatus("FINALIZED");

  const finalizedSlot = state.finalizedCheckpoint?.slot ?? (finalized ? finalized.slot : Math.max(0, state.currentSlot - 2));
  const justifiedSlot = state.justifiedCheckpoint?.slot ?? (justified ? justified.slot : Math.max(0, state.currentSlot - 1));
  const gap = Math.max(0, state.currentSlot - finalizedSlot);

  nodes.topSlot.textContent = String(state.currentSlot);
  nodes.topEpoch.textContent = String(state.epoch);
  nodes.topFinalized.textContent = String(finalizedSlot);
  nodes.topPart.textContent = `${state.participationRate}%`;

  nodes.justSlot.textContent = String(justifiedSlot);
  nodes.justHash.textContent = state.justifiedCheckpoint?.root ?? (justified ? justified.hash : "0x-");
  nodes.finSlot.textContent = String(finalizedSlot);
  nodes.finHash.textContent = state.finalizedCheckpoint?.root ?? (finalized ? finalized.hash : "0x-");
  nodes.gapTitle.textContent = `HEAD → FINALIZED GAP: ${gap} SLOTS`;

  const maxGap = 14;
  nodes.gapFill.style.width = `${Math.min(100, (gap / maxGap) * 100)}%`;
  if (gap <= 5) {
    nodes.gapFill.style.backgroundColor = COLORS.green;
  } else if (gap <= 10) {
    nodes.gapFill.style.backgroundColor = COLORS.amber;
  } else {
    nodes.gapFill.style.backgroundColor = COLORS.red;
  }

  const chips = state.finalizedHistory.slice(0, 10);
  nodes.chipWrap.innerHTML = "";
  for (const slot of chips) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = slot;
    nodes.chipWrap.appendChild(chip);
  }

  nodes.mSlot.textContent = String(state.currentSlot);
  nodes.mPart.textContent = `${state.participationRate}%`;
  nodes.mMissed.textContent = String(state.missedSlots);
  nodes.mPeers.textContent = state.mode === "live"
    ? String(state.live.peerCount || 0)
    : String(peers.filter((p) => p.status !== "offline").length);

  const validatorCount = getValidatorCount();
  const activeValidatorCount = state.validators.slice(0, validatorCount).filter((v) => v.active !== false).length;
  const votedActiveCount = Array.from(state.currentVoters.values())
    .filter((id) => state.validators[id] && state.validators[id].active !== false).length;
  const rateBase = Math.max(1, activeValidatorCount);
  nodes.statTotal.textContent = String(validatorCount);
  nodes.statActive.textContent = String(activeValidatorCount);
  nodes.validatorSubtitle.textContent = `${activeValidatorCount} active / ${validatorCount} total validators`;
  nodes.statVoted.textContent = String(votedActiveCount);
  nodes.statRate.textContent = `${Math.round((votedActiveCount / rateBase) * 100)}%`;
}





function bootstrap() {
  setupPeerPills();
  setupPhases();
  bindControls();
  updateSlotCycleLabel();
  resizeCanvas(chainCanvas, chainCtx);
  resizeCanvas(validatorCanvas, validatorCtx);
  requestAnimationFrame(() => {
    resizeCanvas(chainCanvas, chainCtx);
    resizeCanvas(validatorCanvas, validatorCtx);
  });

  createSlotPlan();
  for (let s = state.currentSlot - 14; s <= state.currentSlot; s++) {
    state.proposer = chooseProposer();
    state.participationRate = randomInt(82, 99);
    addBlock(s, Math.random() < 0.06);
  }
  state.finalizedHistory = state.blocks
    .filter((b) => !b.missed && b.slot <= state.currentSlot - 2)
    .slice(-12)
    .map((b) => b.slot)
    .reverse();
  const j = state.blocks.find((b) => b.slot === state.currentSlot - 1 && !b.missed);
  const f = state.blocks.find((b) => b.slot === state.currentSlot - 2 && !b.missed);
  if (j) state.justifiedCheckpoint = { slot: j.slot, root: j.hash };
  if (f) state.finalizedCheckpoint = { slot: f.slot, root: f.hash };
  setModeBadge();
  if (state.mode === "live") connectLive();

  state.lastFrame = performance.now();
  requestAnimationFrame(tick);
}

function tick(now) {
  try {
    while (state.mode === "demo" && now - state.slotStartedAt >= currentSlotMs()) {
      onNewSlot();
    }

    updateUI(now);
    updateVotes(now);
    drawChainCanvas(now);
    drawValidatorCanvas(now);

    state.lastFrame = now;
    requestAnimationFrame(tick);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

window.addEventListener("resize", () => {
  resizeCanvas(chainCanvas, chainCtx);
  resizeCanvas(validatorCanvas, validatorCtx);
});
window.addEventListener("load", () => {
  resizeCanvas(chainCanvas, chainCtx);
  resizeCanvas(validatorCanvas, validatorCtx);
});

export async function init() {
  await loadConfig(state);
  bootstrap();
}
