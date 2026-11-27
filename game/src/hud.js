// Instruments for Golden Hour — Valley Run.
// Everything the pilot needs, drawn on the canvas so it shows up in
// screenshots exactly as it plays: an artificial horizon, airspeed and
// altitude tapes, a heading compass, fuel and throttle, gear lights,
// the objective, and the warnings. Lit glass on a dark panel.

import { COLORS } from './config.js';

const NM_PER_UNIT = 50 / 6076; // one world unit is 50 ft; a nautical mile is 6076 ft

function panel(ctx, x, y, w, h, radius = 10) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.72)';
  ctx.strokeStyle = 'rgba(57, 230, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, str, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function headingDegrees(plane) {
  // Runway 27 faces 270 degrees; the compass reads from there.
  let deg = 270 + (plane.heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

function drawCompass(ctx, plane, width) {
  const y = 26;
  const w = 460;
  const x0 = (width - w) / 2;
  panel(ctx, x0 - 10, y - 18, w + 20, 40);
  const heading = headingDegrees(plane);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y - 16, w, 36);
  ctx.clip();
  const pxPerDeg = w / 120;
  const centerDeg = heading;
  for (let d = Math.floor(centerDeg - 60); d <= centerDeg + 60; d += 5) {
    const norm = ((d % 360) + 360) % 360;
    const dx = x0 + w / 2 + (d - centerDeg) * pxPerDeg;
    const isCardinal = norm % 90 === 0;
    const isMajor = norm % 30 === 0;
    ctx.strokeStyle = isCardinal ? COLORS.hudLine : 'rgba(216, 246, 255, 0.5)';
    ctx.lineWidth = isCardinal ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(dx, y + (isMajor ? -12 : -6));
    ctx.lineTo(dx, y + 2);
    ctx.stroke();
    if (isCardinal) {
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[norm];
      if (dx > x0 + 14 && dx < x0 + w - 14) text(ctx, label, dx, y + 12, 13, COLORS.hudText, 'center');
    } else if (isMajor) {
      if (dx > x0 + 16 && dx < x0 + w - 16) text(ctx, String(norm), dx, y + 12, 10, 'rgba(216, 246, 255, 0.75)', 'center');
    }
  }
  ctx.restore();
  // Centre caret and the digital readout.
  ctx.fillStyle = COLORS.hudLine;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 7, y - 18);
  ctx.lineTo(width / 2 + 7, y - 18);
  ctx.lineTo(width / 2, y - 8);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${Math.round(heading)}°`, width / 2, y - 32, 15, COLORS.hudText, 'center');
}

function drawHorizon(ctx, plane, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank);
  const pitchShift = plane.pitch * r * 1.6;
  // Sky above the line, ground below it.
  ctx.fillStyle = '#2f6db3';
  ctx.fillRect(-r, -r + pitchShift, r * 2, r - pitchShift);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(-r, pitchShift, r * 2, r - pitchShift + r);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchShift);
  ctx.lineTo(r, pitchShift);
  ctx.stroke();
  // Pitch ladder rungs.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1;
  for (const deg of [-20, -10, 10, 20]) {
    const yy = pitchShift - (deg * Math.PI) / 180 * r * 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, yy);
    ctx.lineTo(r * 0.3, yy);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol and the bezel.
  ctx.strokeStyle = COLORS.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + 5);
  ctx.stroke();
}

function drawTape(ctx, x, y, w, h, value, unit, step, format) {
  panel(ctx, x, y, w, h);
  const cy = y + h / 2;
  const pxPerUnit = h / (step * 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const base = Math.floor(value / step) * step;
  for (let v = base - step * 4; v <= base + step * 4; v += step) {
    const dy = cy - (v - value) * pxPerUnit;
    const major = v % (step * 5) === 0;
    ctx.strokeStyle = major ? COLORS.hudText : 'rgba(216, 246, 255, 0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + w - (major ? 16 : 9), dy);
    ctx.lineTo(x + w, dy);
    ctx.stroke();
    if (major) text(ctx, format(v), x + 6, dy, 12, COLORS.hudText);
  }
  ctx.restore();
  // Current-value window.
  ctx.fillStyle = COLORS.hudLine;
  ctx.beginPath();
  ctx.moveTo(x + w, cy - 13);
  ctx.lineTo(x + w - 8, cy);
  ctx.lineTo(x + w, cy + 13);
  ctx.closePath();
  ctx.fill();
  text(ctx, format(value), x + w / 2, cy, 15, '#06222e', 'center');
  text(ctx, unit, x + w / 2, y - 10, 11, COLORS.hudText, 'center');
}

function drawBar(ctx, x, y, w, h, fraction, label, color) {
  text(ctx, label, x, y - 10, 11, COLORS.hudText);
  panel(ctx, x, y, w, h, 5);
  const inner = Math.max(0, Math.min(1, fraction));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, (w - 4) * inner, h - 4, 3);
  ctx.fill();
  text(ctx, `${Math.round(inner * 100)}%`, x + w + 8, y + h / 2, 12, COLORS.hudText);
}

export function drawHUD(ctx, state, time) {
  const { plane, width, height, fuel, score, objective, message, messageUntil } = state;
  const s = width / 1280; // scale the instrument layout from the 1280 design

  drawCompass(ctx, plane, width);

  // Objective panel, top left: the objective on its own line, then the
  // score and the distance to the runway sharing the line below it.
  const ow = 360 * s;
  panel(ctx, 16, 14, ow, 76 * s);
  text(ctx, 'OBJECTIVE', 30, 32, 11 * s + 2, COLORS.hudAmber);
  text(ctx, objective, 30, 54, 14 * s + 2, COLORS.hudText);
  text(ctx, `SCORE ${score.toLocaleString('en-US')}`, 30, 76, 13 * s + 2, COLORS.hudGreen);
  const distNm = Math.max(0, (state.runwayZ - plane.z) * NM_PER_UNIT);
  text(ctx, `RWY 27 · ${distNm.toFixed(1)} NM`, 30 + ow - 16, 76, 12 * s + 2, COLORS.hudText, 'right');

  // Fuel and throttle, top right.
  const bw = 170 * s;
  drawBar(ctx, width - bw - 60, 26, bw, 12, fuel / 100, 'FUEL', fuel < 25 ? COLORS.hudWarn : COLORS.hudGreen);
  drawBar(ctx, width - bw - 60, 58, bw, 12, plane.throttle, 'THROTTLE', COLORS.hudLine);

  // Gear and state lights, under the fuel bars.
  const gearY = 96;
  text(ctx, plane.gearDown ? '● GEAR DOWN' : '○ GEAR UP', width - 60, gearY, 12, plane.gearDown ? COLORS.hudGreen : COLORS.hudAmber, 'right');
  if (plane.engineOut) text(ctx, 'ENGINE OUT', width - 60, gearY + 20, 12, COLORS.hudWarn, 'right');

  // Instrument cluster, bottom centre.
  const cx = width / 2;
  const cy = height - 98 * s;
  const r = 58 * s;
  drawHorizon(ctx, plane, cx, cy, r);
  drawTape(ctx, cx - r - 118 * s, cy - r, 96 * s, r * 2, plane.speed, 'KNOTS', 20, (v) => String(Math.round(v)));
  drawTape(ctx, cx + r + 22 * s, cy - r, 96 * s, r * 2, plane.altitudeFt, 'FEET', 100, (v) => String(Math.round(v)));
  text(ctx, 'ATTITUDE', cx, cy + r + 16, 10, COLORS.hudText, 'center');

  // Warnings, centre screen.
  if (plane.stalled && state.mode === 'playing') {
    const blink = Math.sin(time * 10) > 0;
    if (blink) text(ctx, '⚠ STALL — NOSE DOWN, ADD POWER', width / 2, height * 0.3, 22, COLORS.hudWarn, 'center');
  }
  if (fuel < 25 && fuel > 0 && state.mode === 'playing') {
    text(ctx, 'LOW FUEL — FLY THROUGH A RING', width / 2, height * 0.3 + 30, 16, COLORS.hudAmber, 'center');
  }

  // Transient centre message (ring scored, gear moved, and so on).
  if (message && time < messageUntil) {
    const alpha = Math.min(1, (messageUntil - time) / 0.5);
    ctx.globalAlpha = alpha;
    text(ctx, message, width / 2, height * 0.42, 26, COLORS.hudGreen, 'center');
    ctx.globalAlpha = 1;
  }
}
