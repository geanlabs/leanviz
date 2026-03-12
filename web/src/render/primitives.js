export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawValidatorAvatar(ctx, x, y, size, color, label, emphasis, labelColor = "#9fb5d7") {
  roundRect(ctx, x - size / 2, y - size / 2, size, size, 6);
  ctx.fillStyle = "rgba(12,15,24,0.95)";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(x, y - 3, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Body
  ctx.beginPath();
  ctx.moveTo(x, y - 0.5);
  ctx.lineTo(x, y + 4.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 2.8, y + 2);
  ctx.lineTo(x + 2.8, y + 2);
  ctx.stroke();

  if (emphasis) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = `${color}aa`;
    roundRect(ctx, x - size / 2, y - size / 2, size, size, 6);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (label) {
    ctx.font = "700 9px 'Space Mono'";
    ctx.fillStyle = labelColor;
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - size / 2 - 4);
  }
}
