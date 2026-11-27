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
  // Clouds with volume: a warm shadow belly, then a bright top, so
  // they read as lit puffs instead of flat pink cutouts.
  for (let i = 0; i < 7; i++) {
    const seed = i * 137.5;
    const speed = 6 + (i % 3) * 4;
    let x = (seed * 7 + time * speed - plane.x * (20 + i * 8)) % (width + 320);
    if (x < -160) x += width + 320;
    const y = 46 + ((seed * 13) % 110) + plane.pitch * 30;
    const s = 0.7 + ((seed * 7) % 10) / 14;
    ctx.fillStyle = 'rgba(214, 130, 110, 0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y + 7 * s, 74 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 42 * s, y + 11 * s, 46 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 46 * s, y + 11 * s, 50 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 226, 196, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y, 74 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 42 * s, y + 5 * s, 46 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 46 * s, y + 5 * s, 50 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // High cirrus streaks, thin and fast, for a bigger sky.
  ctx.fillStyle = 'rgba(255, 210, 180, 0.45)';
  for (let i = 0; i < 3; i++) {
    const seed = i * 211.3;
    let x = (seed * 3 + time * (9 + i * 5) - plane.x * 12) % (width + 400);
    if (x < -200) x += width + 400;
    const y = 24 + i * 22 + ((seed * 5) % 14);
    ctx.beginPath();
    ctx.ellipse(x, y, 130 + i * 40, 4, 0.02 * (i - 1), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Distant terrain: the valley is only 18 units wide, so the land
// beyond its edges used to read as a flat brown wall. Three wavy
// foothill bands, each with its own patchwork, fill the ground below
// the horizon across the full width and fade into the haze.
function drawFoothills(ctx, plane, width, height, horizonY) {
  const bands = [
    { top: 0, depth: 46, color: '#8a6a3f', patch: 'rgba(122, 143, 60, 0.35)', seed: 2.2, par: 30 },
    { top: 34, depth: 90, color: '#77582f', patch: 'rgba(168, 137, 63, 0.3)', seed: 5.7, par: 55 },
    { top: 78, depth: 190, color: '#5d4526', patch: 'rgba(93, 122, 53, 0.3)', seed: 8.9, par: 90 },
  ];
  for (const band of bands) {
    const baseY = horizonY + 4 + band.top;
    ctx.fillStyle = band.color;
    ctx.beginPath();
    ctx.moveTo(-10, height + 10);
    ctx.lineTo(-10, baseY + 6);
    for (let x = 0; x <= width + 40; x += 40) {
      const t = x / width;
      const y =
        baseY -
        (Math.sin(t * 7 + band.seed - plane.x * 0.02 - plane.heading * band.par * 0.004) * 10 +
          Math.sin(t * 17 + band.seed * 2.3 - plane.x * 0.05) * 6);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width + 10, baseY + 6);
    ctx.lineTo(width + 10, height + 10);
    ctx.closePath();
    ctx.fill();
    // Patchwork on the band: a few soft field-coloured blobs.
    ctx.fillStyle = band.patch;
    for (let i = 0; i < 6; i++) {
      const seed = i * 97.3 + band.seed * 31;
      let x = (seed * 11 - plane.x * band.par * 0.6) % (width + 240);
      if (x < -120) x += width + 240;
      const y = baseY + 8 + ((seed * 7) % band.depth);
      const w = 60 + ((seed * 13) % 110);
      ctx.beginPath();
      ctx.ellipse(x, y, w, 10 + ((seed * 5) % 12), 0, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // Hedgerows: dark seams between the field bands on near ground,
  // so the patchwork reads as divided fields, not flat colour blocks.
  if (fog < 0.25) {
    ctx.strokeStyle = 'rgba(38, 62, 26, 0.55)';
    ctx.lineWidth = Math.max(1, (1 - fog) * 2);
    for (let b = 1; b < BANDS.length - 1; b++) {
      const a1 = p(seg.centerX + BANDS[b], z1);
      const a2 = p(next.centerX + BANDS[b], z2);
      if (!a1 || !a2) continue;
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
    }
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
    // PAPI glide-slope lights beside the threshold: four lamps on the
    // left of the runway. White means high on the slope, red low;
    // two and two is on the glide path. Far away they read neutral.
    if (seg.isLandingRunway && seg.index < COURSE.landingRunwayStart + 2) {
      const altFt = (cam.y - 3) * 50;
      const distUnits = COURSE.landingRunwayStart * VIEW.segmentLength - cam.z;
      let whites = 2;
      if (distUnits > 0 && distUnits <= 3000) {
        const ideal = distUnits * 50 * 0.0524; // 3-degree glide slope
        const ratio = ideal > 0 ? altFt / ideal : 1;
        whites = ratio > 1.15 ? 4 : ratio > 1.02 ? 3 : ratio > 0.98 ? 2 : ratio > 0.85 ? 1 : 0;
      }
      for (let lamp = 0; lamp < 4; lamp++) {
        const pt = projectPoint(
          seg.centerX - 1.7 - lamp * 0.35,
          0.15,
          seg.index * VIEW.segmentLength + VIEW.segmentLength / 2,
          cam.x,
          cam.y,
          cam.z,
          horizonY,
          width,
          height,
        );
        if (!pt) continue;
        const r = Math.max(1.5, pt.scale * 0.35 * (width / 2));
        ctx.fillStyle = lamp < whites ? COLORS.papiWhite : COLORS.papiRed;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = r * 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
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

function drawFarm(ctx, x, y, scale, width) {
  const h = scale * width * 0.5 * 0.9;
  if (h < 3) return;
  // White walls, red roof, one lit window: a farmstead in the fields.
  ctx.fillStyle = '#e8e0cc';
  ctx.fillRect(x - h * 0.3, y - h * 0.45, h * 0.6, h * 0.45);
  ctx.fillStyle = '#a33327';
  ctx.beginPath();
  ctx.moveTo(x - h * 0.36, y - h * 0.45);
  ctx.lineTo(x, y - h * 0.75);
  ctx.lineTo(x + h * 0.36, y - h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(x - h * 0.06, y - h * 0.32, h * 0.12, h * 0.14);
}

function drawBale(ctx, x, y, scale, width) {
  const h = scale * width * 0.5 * 0.9;
  if (h < 2) return;
  ctx.fillStyle = '#c9a44a';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.2, h * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a8893f';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.2, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawRing(ctx, ring, cam, horizonY, width, height, time) {
  const pt = projectPoint(ring.x, ring.y, ring.z, cam.x, cam.y, cam.z, horizonY, width, height);
  if (!pt) return;
  const r = Math.max(2, pt.scale * ring.radius * (width / 2));
  if (r < 2.5) return; // too far to see: no dot, no smudge of a label
  const color = ring.kind === 'bonus' ? COLORS.bonus : ring.kind === 'ring' ? COLORS.ring : COLORS.gate;
  const pulse = 0.75 + Math.sin(time * 4 + ring.index) * 0.25;
  ctx.save();
  // Beacon: a light column from the ring down to the ground, so the
  // next objective is visible from far away instead of a dot that
  // only appears when you are nearly on top of it.
  const ground = projectPoint(ring.x, 0, ring.z, cam.x, cam.y, cam.z, horizonY, width, height);
  if (ground) {
    const beam = ctx.createLinearGradient(0, pt.y, 0, ground.y);
    beam.addColorStop(0, color);
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = Math.min(0.35, pulse * 0.4);
    ctx.fillStyle = beam;
    const wTop = Math.max(2, r * 0.12);
    const wBot = Math.max(4, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(pt.x - wTop, pt.y);
    ctx.lineTo(pt.x + wTop, pt.y);
    ctx.lineTo(ground.x + wBot, ground.y);
    ctx.lineTo(ground.x - wBot, ground.y);
    ctx.closePath();
    ctx.fill();
  }
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
    ctx.fillText(ring.kind === 'bonus' ? 'BONUS' : ring.kind === 'ring' ? 'RING' : 'GATE', pt.x, pt.y);
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

  // Distant terrain over the haze: foothill bands with patchwork, so
  // the ground below the horizon reads as land across the full width.
  drawFoothills(ctx, plane, width, height, horizonY);

  const sunX = width * 0.86 - plane.heading * 120;
  const sunY = horizonY - 108 + plane.pitch * height * 0.2;
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

    // Farmstead and hay bales of this segment, drawn with its ground.
    if (seg.farm) {
      const pt = projectPoint(
        seg.centerX + seg.farm.x,
        0,
        segIndex * VIEW.segmentLength + VIEW.segmentLength / 2,
        cam.x,
        cam.y,
        cam.z,
        horizonY,
        width,
        height,
      );
      if (pt) {
        ctx.globalAlpha = 1 - fog;
        drawFarm(ctx, pt.x, pt.y, pt.scale * seg.farm.size, width);
        ctx.globalAlpha = 1;
      }
    }
    for (const bale of seg.bales) {
      const pt = projectPoint(
        seg.centerX + bale.x,
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
      drawBale(ctx, pt.x, pt.y, pt.scale * bale.size, width);
      ctx.globalAlpha = 1;
    }
  }

  // --- Rings and gates, far to near (bonus rings included). ---
  const objects = [...course.rings, ...course.gates, ...course.bonusRings]
    .filter((o) => !o.hit && o.z > plane.z)
    .sort((a, b) => b.z - a.z);
  for (const obj of objects) drawRing(ctx, obj, cam, horizonY, width, height, time);

  // --- Speed streaks at the screen edges when really moving. ---
  if (state.mode === 'playing' && plane.speed > 300) {
    const strength = Math.min(1, (plane.speed - 300) / 130);
    ctx.strokeStyle = `rgba(255, 240, 210, ${0.28 * strength})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const seed = i * 173.3 + Math.floor(time * 24) * 7.1;
      const side = i % 2 === 0 ? 0 : 1;
      const x = side === 0 ? 10 + ((seed * 13) % 90) : width - 10 - ((seed * 17) % 90);
      const y = (seed * 29) % height;
      const len = 26 + ((seed * 7) % 40) * strength;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (side === 0 ? len : -len), y + 3);
      ctx.stroke();
    }
  }

  // --- The jet, last: it flies in front of the world. ---
  drawAircraft(ctx, plane, width, height, time);
}
