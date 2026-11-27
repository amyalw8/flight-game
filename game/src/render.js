// Scene rendering for Golden Hour — Valley Run.
// A pseudo-3D segment renderer: the valley is a chain of short
// segments, each projected from world space and drawn far to near,
// so the fields, the river and the runway rush toward the camera.
// The sky, sun, mountains and clouds are painted behind it.

import { VIEW, COURSE, COLORS } from './config.js';
import { projectPoint, horizonForPitch, riverXAt } from './world.js';
import { drawAircraft } from './aircraft.js';

const FIELD_PALETTE = [COLORS.fieldA, COLORS.fieldB, COLORS.fieldC, COLORS.fieldD];
const BANDS = [-9, -5.4, -1.8, 1.8, 5.4, 9]; // lateral band edges, road units

// Deterministic ridge line for a mountain layer.
function ridgePoints(seed, width) {
  const points = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y =
      Math.sin(t * 9 + seed) * 0.35 +
      Math.sin(t * 23 + seed * 2.7) * 0.2 +
      Math.sin(t * 5 + seed * 0.6) * 0.45;
    points.push({ t, y: 0.5 + y * 0.5 });
  }
  return points;
}

const RIDGE_FAR = ridgePoints(1.3, 1280);
const RIDGE_NEAR = ridgePoints(4.1, 1280);

function drawRidge(ctx, points, baseY, height, color, offsetX, width) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, baseY + 4);
  for (const p of points) {
    let x = p.t * width + offsetX;
    while (x < -width) x += width;
    while (x > width) x -= width;
    ctx.lineTo(x, baseY - p.y * height);
  }
  ctx.lineTo(width + 10, baseY + 4);
  ctx.closePath();
  ctx.fill();
}

function drawClouds(ctx, plane, time, width, horizonY) {
  ctx.fillStyle = 'rgba(255, 214, 180, 0.85)';
  for (let i = 0; i < 7; i++) {
    const seed = i * 137.5;
    const speed = 6 + (i % 3) * 4;
    let x = (seed * 7 + time * speed - plane.x * (20 + i * 8)) % (width + 320);
    if (x < -160) x += width + 320;
    const y = 46 + ((seed * 13) % 110) + plane.pitch * 30;
    const s = 0.7 + ((seed * 7) % 10) / 14;
    ctx.beginPath();
    ctx.ellipse(x, y, 74 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 42 * s, y + 5 * s, 46 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 46 * s, y + 5 * s, 50 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSegmentGround(ctx, seg, next, cam, horizonY, width, height, fog) {
  const z1 = Math.max(seg.index * VIEW.segmentLength, cam.z + VIEW.cameraDepth + 0.5);
  const z2 = (seg.index + 1) * VIEW.segmentLength;
  if (z2 <= z1) return;
  const groundY = 0;
  const p = (worldX, worldZ) =>
    projectPoint(worldX, groundY, worldZ, cam.x, cam.y, cam.z, horizonY, width, height);
  const light = seg.index % 2 === 0 ? 1 : 0.88;

  ctx.globalAlpha = 1 - fog;
  // Patchwork fields, band by band across the valley.
  for (let b = 0; b < BANDS.length - 1; b++) {
    const a1 = p(seg.centerX + BANDS[b], z1);
    const b1 = p(seg.centerX + BANDS[b + 1], z1);
    const a2 = p(next.centerX + BANDS[b], z2);
    const b2 = p(next.centerX + BANDS[b + 1], z2);
    if (!a1 || !b1 || !a2 || !b2) continue;
    ctx.fillStyle = shade(FIELD_PALETTE[(seg.field + b) % FIELD_PALETTE.length], light);
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(a2.x, a2.y);
    ctx.closePath();
    ctx.fill();
  }

  // The river winds down the right-hand fields.
  if (!seg.isRunway && seg.index > COURSE.takeoffRunwayEnd && seg.index < COURSE.landingRunwayStart) {
    const r1 = riverXAt(seg.index);
    const r2 = riverXAt(seg.index + 1);
    const a1 = p(seg.centerX + r1 - 0.6, z1);
    const b1 = p(seg.centerX + r1 + 0.6, z1);
    const a2 = p(next.centerX + r2 - 0.6, z2);
    const b2 = p(next.centerX + r2 + 0.6, z2);
    if (a1 && b1 && a2 && b2) {
      ctx.fillStyle = COLORS.river;
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // The runway: grey strip, white edges, dashed centreline.
  if (seg.isRunway) {
    const strip = (x1, x2, color) => {
      const a1 = p(seg.centerX + x1, z1);
      const b1 = p(seg.centerX + x2, z1);
      const a2 = p(next.centerX + x1, z2);
      const b2 = p(next.centerX + x2, z2);
      if (!a1 || !b1 || !a2 || !b2) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.closePath();
      ctx.fill();
    };
    strip(-1.1, 1.1, COLORS.runway);
    strip(-1.1, -1.02, COLORS.runwayEdge);
    strip(1.02, 1.1, COLORS.runwayEdge);
    if (seg.index % 2 === 0) strip(-0.05, 0.05, COLORS.runwayDash);
    // Threshold bars at the start of the landing runway.
    if (seg.isLandingRunway && seg.index < COURSE.landingRunwayStart + 3) {
      strip(-0.95, -0.55, COLORS.runwayDash);
      strip(-0.2, 0.2, COLORS.runwayDash);
      strip(0.55, 0.95, COLORS.runwayDash);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTree(ctx, x, y, scale, width) {
  const h = scale * width * 0.5 * 0.9;
  if (h < 2) return;
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(x - h * 0.04, y - h * 0.25, h * 0.08, h * 0.25);
  ctx.fillStyle = '#2e5230';
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - h * 0.32, y - h * 0.2);
  ctx.lineTo(x + h * 0.32, y - h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a6b35';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.82);
  ctx.lineTo(x - h * 0.24, y - h * 0.2);
  ctx.lineTo(x + h * 0.24, y - h * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx, ring, cam, horizonY, width, height, time) {
  const pt = projectPoint(ring.x, ring.y, ring.z, cam.x, cam.y, cam.z, horizonY, width, height);
  if (!pt) return;
  const r = Math.max(2, pt.scale * ring.radius * (width / 2));
  if (r < 2.5) return; // too far to see: no dot, no smudge of a label
  const color = ring.kind === 'ring' ? COLORS.ring : COLORS.gate;
  const pulse = 0.75 + Math.sin(time * 4 + ring.index) * 0.25;
  ctx.save();
  ctx.globalAlpha = Math.min(1, pulse);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.5;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // The label only once the ring is big enough to read it.
  if (r >= 14) {
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(11, r * 0.28)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ring.kind === 'ring' ? 'RING' : 'GATE', pt.x, pt.y);
  }
  ctx.restore();
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

export function renderScene(ctx, state, course, time) {
  const { plane, width, height } = state;
  const cam = { x: plane.x, y: plane.altitudeFt / 50 + 3, z: plane.z };
  const horizonY = horizonForPitch(plane.pitch, height);

  // --- Sky: a golden-hour gradient, sun low on the right. ---
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 4);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(0.55, COLORS.skyMid);
  sky.addColorStop(1, COLORS.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY + 4);
  // Below the horizon: hazy distant ground, not sky — the valley is
  // only 18 units wide, and the land beyond its edges has to read as
  // land, not as a band of sunset.
  const haze = ctx.createLinearGradient(0, horizonY, 0, height);
  haze.addColorStop(0, COLORS.skyLow);
  haze.addColorStop(0.35, '#8a6a3f');
  haze.addColorStop(1, '#4c3d24');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY + 4, width, height - horizonY - 4);

  const sunX = width * 0.72 - plane.heading * 120;
  const sunY = horizonY - 92 + plane.pitch * height * 0.2;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
  glow.addColorStop(0, COLORS.sunGlow);
  glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = COLORS.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // --- Mountains: two parallax ridges sitting on the horizon. ---
  drawRidge(ctx, RIDGE_FAR, horizonY + 3, 92, COLORS.mountainFar, -plane.x * 26 - plane.heading * 160, width);
  drawRidge(ctx, RIDGE_NEAR, horizonY + 3, 58, COLORS.mountainNear, -plane.x * 64 - plane.heading * 380, width);
  drawClouds(ctx, plane, time, width, horizonY);

  // --- Ground: segments far to near. ---
  const baseIndex = Math.max(
    0,
    Math.min(course.segments.length - 1, Math.floor(plane.z / VIEW.segmentLength)),
  );
  const maxN = Math.min(VIEW.drawDistance, course.segments.length - baseIndex - 1);
  for (let n = maxN; n >= 0; n--) {
    const segIndex = baseIndex + n;
    if (segIndex >= course.segments.length) continue;
    const seg = course.segments[segIndex];
    const next = course.segments[Math.min(segIndex + 1, course.segments.length - 1)];
    const fog = Math.pow(n / VIEW.drawDistance, 2) * 0.6;
    drawSegmentGround(ctx, seg, next, cam, horizonY, width, height, fog);

    // Trees of this segment, drawn with its ground.
    for (const tree of seg.trees) {
      const pt = projectPoint(
        seg.centerX + tree.x,
        0,
        segIndex * VIEW.segmentLength + VIEW.segmentLength / 2,
        cam.x,
        cam.y,
        cam.z,
        horizonY,
        width,
        height,
      );
      if (!pt) continue;
      ctx.globalAlpha = 1 - fog;
      drawTree(ctx, pt.x, pt.y, pt.scale * tree.size, width);
      ctx.globalAlpha = 1;
    }
  }

  // --- Rings and gates, far to near. ---
  const objects = [...course.rings, ...course.gates]
    .filter((o) => !o.hit && o.z > plane.z)
    .sort((a, b) => b.z - a.z);
  for (const obj of objects) drawRing(ctx, obj, cam, horizonY, width, height, time);

  // --- The jet, last: it flies in front of the world. ---
  drawAircraft(ctx, plane, width, height, time);
}
