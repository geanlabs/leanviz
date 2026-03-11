import { COLORS, state } from "../state.js";
import { validatorCanvas, validatorCtx } from "../dom.js";
import { getValidatorCount } from "../sim/logic.js";
import { drawValidatorAvatar } from "./primitives.js";

export function drawValidatorCanvas(now) {
  const ctx = validatorCtx;
  const w = validatorCanvas.clientWidth;
  const h = validatorCanvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 - 4;
  const ringR = Math.min(w, h) * 0.34;

  const centerPulse = ((now % 1300) / 1300);
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,255,204,0.2)";
  ctx.fill();
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 1.4;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(0,255,204,0.7)";
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(cx, cy, 18 + centerPulse * 36, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0,255,204,${1 - centerPulse})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.font = "700 11px 'Space Mono'";
  ctx.fillStyle = "#c9fff4";
  ctx.textAlign = "center";
  ctx.fillText("BLOCK", cx, cy - 2);
  ctx.font = "700 13px 'Space Mono'";
  ctx.fillText(String(state.currentSlot), cx, cy + 12);

  const count = getValidatorCount();
  const nodePos = [];
  for (let i = 0; i < count; i++) {
    const a = (-Math.PI / 2) + (i / count) * Math.PI * 2;
    nodePos.push({ id: i, x: cx + Math.cos(a) * ringR, y: cy + Math.sin(a) * ringR });
  }

  ctx.strokeStyle = "rgba(100,116,139,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  state.voteRings = state.voteRings.filter((r) => now - r.startAt < r.duration);
  for (const ring of state.voteRings) {
    const p = nodePos[ring.validatorId];
    if (!p) continue;
    const t = (now - ring.startAt) / ring.duration;
    const rr = 6 + t * 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(123,97,255,${1 - t})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  state.particles = state.particles.filter((pt) => now - pt.startAt < pt.duration);
  for (const pt of state.particles) {
    const p = nodePos[pt.validatorId];
    if (!p) continue;
    const t = Math.min(1, (now - pt.startAt) / pt.duration);
    const x = p.x + (cx - p.x) * (1 - (1 - t) * (1 - t));
    const y = p.y + (cy - p.y) * (1 - (1 - t) * (1 - t));

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = `rgba(123,97,255,${0.5 - t * 0.4})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.purple;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(123,97,255,0.9)";
    ctx.fill();
    ctx.shadowBlur = 0;

    if (pt.kind === "attestation" && t < 0.9) {
      ctx.font = "700 8px 'Space Mono'";
      ctx.fillStyle = `rgba(174,196,255,${1 - t})`;
      ctx.textAlign = "left";
      ctx.fillText("attestation", x + 5, y - 4);
    }
  }

  for (const v of state.validators.slice(0, count)) {
    const p = nodePos[v.id];
    let color = "#54607a";
    let size = 10;
    let label = `#${v.id}`;
    let labelColor = "#7f8eaa";
    let emphasis = false;
    if (v.active === false) {
      color = "#2f3748";
      size = 10;
      label = `#${v.id} off`;
      labelColor = "#5f6d86";
    } else if (v.status === "proposer") {
      color = COLORS.cyan;
      size = 14;
      labelColor = "#b8fff2";
      emphasis = true;
    } else if (v.status === "voted") {
      color = COLORS.green;
      size = 12;
      labelColor = "#9cf1b8";
    } else if (v.status === "slashed") {
      color = COLORS.red;
      size = 12;
      labelColor = "#ffb1b1";
      emphasis = true;
    }
    drawValidatorAvatar(ctx, p.x, p.y, size, color, label, emphasis, labelColor);
  }
  ctx.textAlign = "left";
}
