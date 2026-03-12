import { COLORS, state } from "../state.js";
import { chainCanvas, chainCtx } from "../dom.js";
import { currentSlotMs, getBlockStatus } from "../sim/logic.js";
import { roundRect } from "./primitives.js";

export function drawChainCanvas(now) {
  const ctx = chainCtx;
  const w = chainCanvas.clientWidth;
  const h = chainCanvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  for (let x = 0; x < w; x += 40) {
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }

  const blockW = 128;
  const blockH = 116;
  const spacing = 30;
  const slotMs = currentSlotMs();
  const speed = (blockW + spacing) / slotMs;
  const baseY = h * 0.48;
  const visible = [];

  const phaseElapsed = (now - state.slotStartedAt + slotMs) % slotMs;

  for (const block of state.blocks) {
    const ageMs = (state.currentSlot - block.slot) * slotMs + phaseElapsed;
    const x = w - 130 - ageMs * speed;
    if (x < -blockW - 80 || x > w + 120) continue;
    visible.push({ block, x, y: baseY });
  }

  visible.sort((a, b) => a.block.slot - b.block.slot);

  for (let i = 1; i < visible.length; i++) {
    const prev = visible[i - 1];
    const cur = visible[i];
    const gap = cur.block.slot - prev.block.slot;
    ctx.beginPath();
    ctx.moveTo(prev.x + blockW, prev.y + blockH / 2);
    ctx.lineTo(cur.x, cur.y + blockH / 2);
    ctx.strokeStyle = gap > 1 ? "rgba(100,116,139,0.7)" : "rgba(59,130,246,0.45)";
    ctx.setLineDash(gap > 1 ? [6, 4] : []);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const item of visible) {
    const { block, x, y } = item;
    const status = getBlockStatus(block);
    const fade = Math.max(0.1, Math.min(1, (x + 80) / (w * 0.52)));

    let color = COLORS.blue;
    if (status === "JUSTIFIED") color = COLORS.amber;
    if (status === "FINALIZED") color = COLORS.green;
    if (status === "MISSED") color = COLORS.grey;

    ctx.globalAlpha = fade;
    roundRect(ctx, x, y, blockW, blockH, 12);
    ctx.fillStyle = "rgba(13,13,20,0.95)";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = status === "MISSED" ? "rgba(42,42,58,1)" : color;
    if (status === "MISSED") ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowBlur = status === "MISSED" ? 0 : 18;
    ctx.shadowColor = status === "FINALIZED" ? "rgba(34,197,94,0.65)" : `${color}99`;
    if (block.flashUntil > now) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = "rgba(34,197,94,0.9)";
    }
    roundRect(ctx, x, y, blockW, blockH, 12);
    ctx.strokeStyle = status === "MISSED" ? "rgba(42,42,58,0.9)" : `${color}cc`;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = "700 13px 'Space Mono'";
    ctx.fillStyle = status === "MISSED" ? "#9aa8bb" : COLORS.cyan;
    ctx.fillText(`SLOT ${block.slot}`, x + 8, y + 16);

    ctx.font = "10px 'Space Mono'";
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(block.hash, x + 8, y + 30);

    ctx.fillStyle = "#a6b5cb";
    ctx.fillText(`Proposer: #${block.proposer}`, x + 8, y + 43);

    const sourceSlot = block.checkpoint?.sourceSlot ?? Math.max(0, block.slot - 2);
    const targetSlot = block.checkpoint?.targetSlot ?? Math.max(0, block.slot - 1);
    const headSlot = block.checkpoint?.headSlot ?? block.slot;
    ctx.fillStyle = "#8197b8";
    ctx.fillText(`CP S:${sourceSlot} T:${targetSlot} H:${headSlot}`, x + 8, y + 56);

    const barY = y + 70;
    roundRect(ctx, x + 8, barY, blockW - 16, 7, 4);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();

    const fill = status === "MISSED" ? 0 : (Math.max(0, Math.min(100, block.participation)) / 100) * (blockW - 16);
    roundRect(ctx, x + 8, barY, fill, 7, 4);
    ctx.fillStyle = status === "MISSED" ? "#434a5d" : COLORS.purple;
    ctx.fill();
    ctx.font = "700 8px 'Space Mono'";
    ctx.fillStyle = "#9bb3d7";
    ctx.fillText(`ATT ${Math.round(block.participation)}%`, x + blockW - 58, barY - 2);

    const badgeY = y + 92;
    roundRect(ctx, x + 8, badgeY, blockW - 16, 16, 6);
    ctx.fillStyle = status === "MISSED" ? "rgba(42,42,58,0.9)" : `${color}26`;
    ctx.fill();
    ctx.strokeStyle = status === "MISSED" ? "#3c4354" : `${color}cc`;
    ctx.stroke();

    ctx.font = "700 9px 'Space Mono'";
    ctx.fillStyle = status === "MISSED" ? "#9aa8bb" : color;
    const label = status === "FINALIZED" ? "FINALIZED 🔒" : status;
    ctx.fillText(label, x + 12, y + 103);

    if (status === "MISSED") {
      ctx.font = "700 24px 'Space Mono'";
      ctx.fillStyle = "rgba(154,168,187,0.65)";
      ctx.fillText("×", x + blockW - 28, y + 24);
    }
  }
  ctx.globalAlpha = 1;
}
