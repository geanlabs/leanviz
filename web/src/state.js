export const DEMO_SLOT_MS = 4000;
export const LIVE_SLOT_MS = 4000;
export const DEFAULT_VALIDATOR_COUNT = 24;

export const PHASES = [
  { id: "propose", label: "PROPOSE", icon: "📡", ratio: 0.20, desc: "Proposer broadcasts block" },
  { id: "attest", label: "ATTEST", icon: "🗳️", ratio: 0.30, desc: "Validators cast Head + FFG votes" },
  { id: "aggregate", label: "AGGREGATE", icon: "👥", ratio: 0.20, desc: "Aggregators combine votes" },
  { id: "confirm", label: "CONFIRM", icon: "⚡", ratio: 0.15, desc: "Quorum reaches two thirds" },
  { id: "merge", label: "MERGE", icon: "🔗", ratio: 0.15, desc: "View merge enters canonical chain" }
];

export const COLORS = {
  cyan: "#00ffcc",
  purple: "#7b61ff",
  blue: "#3b82f6",
  amber: "#f59e0b",
  green: "#22c55e",
  red: "#ef4444",
  grey: "#2a2a3a",
  text: "#e2e8f0",
  muted: "#64748b",
  border: "#1a1a2e",
  surface: "#0d0d14"
};

export const peers = [
  { name: "GEAN", lang: "Go", status: "online", self: true },
  { name: "ZEAM", lang: "Zig", status: "online", self: false },
  { name: "REAM", lang: "Rust", status: "syncing", self: false },
  { name: "LANTERN", lang: "C", status: "online", self: false },
  { name: "QLEAN", lang: "C++", status: "offline", self: false }
];

export const state = {
  currentSlot: 100,
  epoch: 3,
  slotStartedAt: performance.now(),
  lastFrame: performance.now(),
  mode: localStorage.getItem("leanviz_mode") || "demo",
  currentPhase: "propose",
  phaseProgress: 0,
  participationRate: 0,
  missedSlots: 0,
  validatorCount: DEFAULT_VALIDATOR_COUNT,
  blocks: [],
  finalizedHistory: [],
  proposer: 0,
  previousProposer: null,
  justifiedCheckpoint: null,
  finalizedCheckpoint: null,
  currentVoters: new Set(),
  targetVoters: [],
  voteCursor: 0,
  nextVoteAt: 0,
  validators: Array.from({ length: DEFAULT_VALIDATOR_COUNT }, (_, i) => ({ id: i, status: "idle", active: true })),
  particles: [],
  voteRings: [],
  live: {
    beaconUrl: localStorage.getItem("leanviz_beacon_url") || "http://localhost:5052",
    metricsUrl: localStorage.getItem("leanviz_metrics_url") || "http://localhost:9090",
    apiNamespace: localStorage.getItem("leanviz_api_ns") || "lean",
    eventSource: null,
    restTimer: null,
    watchdogTimer: null,
    lastEventAt: 0,
    lastEventType: "",
    lastRestSuccessAt: 0,
    lastMetricsSuccessAt: 0,
    lastError: "",
    peerCount: 0,
    eventsSeen: 0,
    connected: false
  }
};
