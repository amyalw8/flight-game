// The valley the game flies through: course layout, projection and
// the world objects (sky rings, canyon gates, runway, river, trees).
// The renderer is a pseudo-3D segment renderer: the valley is a chain
// of short segments, each one projected from world space to the screen
// and drawn far to near, so the ground rushes toward the camera.

import { VIEW, COURSE } from './config.js';

export const FT_PER_UNIT = 50; // one world unit of height is 50 feet
const WORLD_SPEED = 0.42; // world units per second per displayed knot

export function knotsToWorldSpeed(knots) {
  return knots * WORLD_SPEED;
}

export function feetToUnits(feet) {
  return feet / FT_PER_UNIT;
}

// Deterministic pseudo-random from an integer, so the valley looks the
// same every run: the same trees stand in the same fields.
function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 15;
  x = (x * 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// The valley meanders gently: the centreline is a bounded sum of
// sines, faded in after the takeoff runway and out before runway 27,
// so it never wanders out of the valley it sits in and both runways
// stay dead straight for fair takeoffs and landings.
function centerXAt(i) {
  if (i <= COURSE.takeoffRunwayEnd || i >= COURSE.landingRunwayStart) return 0;
  const fadeIn = smoothstep((i - COURSE.takeoffRunwayEnd) / 40);
  const fadeOut = smoothstep((COURSE.landingRunwayStart - i) / 40);
  const envelope = Math.min(fadeIn, fadeOut);
  return envelope * (3.2 * Math.sin(i * 0.011) + 1.4 * Math.sin(i * 0.004 + 1.7));
}

function buildSegments() {
  const segments = [];
  for (let i = 0; i < COURSE.totalSegments; i++) {
    const centerX = centerXAt(i);
    const curve = centerX - centerXAt(Math.max(0, i - 1));
    const isRunway =
      (i >= COURSE.takeoffRunwayStart && i <= COURSE.takeoffRunwayEnd) ||
      (i >= COURSE.landingRunwayStart && i <= COURSE.landingRunwayEnd);
    const isLandingRunway = i >= COURSE.landingRunwayStart && i <= COURSE.landingRunwayEnd;
    segments.push({
      index: i,
      curve,
      centerX,
      isRunway,
      isLandingRunway,
      // Field patchwork: which of the four field colours this segment
      // and its lateral bands wear.
      field: Math.floor(hash(i * 7 + 1) * 4),
      // Trees stand in the fields, never on a runway.
      trees: isRunway
        ? []
        : [0, 1]
            .map((slot) => {
              const r = hash(i * 13 + slot * 5);
              if (r < 0.3) return null;
              const side = hash(i * 29 + slot * 11) > 0.5 ? 1 : -1;
              return { x: side * (2.6 + hash(i * 41 + slot) * 5.2), size: 0.7 + hash(i * 17 + slot) * 0.9 };
            })
            .filter(Boolean),
    });
  }
  return segments;
}

function placeRings(segments) {
  const rings = [];
  const span = COURSE.ringZoneEnd - COURSE.ringZoneStart;
  for (let n = 0; n < COURSE.ringCount; n++) {
    const segIndex = Math.round(COURSE.ringZoneStart + (span * (n + 0.5)) / COURSE.ringCount);
    const seg = segments[segIndex];
    rings.push({
      kind: 'ring',
      z: segIndex * VIEW.segmentLength,
      x: seg.centerX + (hash(n * 31 + 4) - 0.5) * 3.2,
      y: feetToUnits(420 + hash(n * 47 + 9) * 480),
      radius: 2.6,
      hit: false,
      index: n,
    });
  }
  return rings;
}

function placeGates(segments) {
  const gates = [];
  const span = COURSE.gateZoneEnd - COURSE.gateZoneStart;
  for (let n = 0; n < COURSE.gateCount; n++) {
    const segIndex = Math.round(COURSE.gateZoneStart + (span * (n + 0.5)) / COURSE.gateCount);
    const seg = segments[segIndex];
    gates.push({
      kind: 'gate',
      z: segIndex * VIEW.segmentLength,
      x: seg.centerX + (hash(n * 53 + 8) - 0.5) * 4.4,
      y: feetToUnits(260 + hash(n * 61 + 3) * 420),
      radius: 3.2,
      hit: false,
      index: n,
    });
  }
  return gates;
}

export function createCourse() {
  const segments = buildSegments();
  return {
    segments,
    rings: placeRings(segments),
    gates: placeGates(segments),
    totalLength: COURSE.totalSegments * VIEW.segmentLength,
    landingStartZ: COURSE.landingRunwayStart * VIEW.segmentLength,
    landingEndZ: COURSE.landingRunwayEnd * VIEW.segmentLength,
    segmentAt(z) {
      const i = Math.floor(z / VIEW.segmentLength);
      return segments[Math.max(0, Math.min(segments.length - 1, i))];
    },
  };
}

// Project a world point to the screen. Returns null when it is behind
// the camera. scale grows as the point gets closer: it sizes sprites.
export function projectPoint(worldX, worldY, worldZ, camX, camY, camZ, horizonShift, width, height) {
  const dz = worldZ - camZ;
  if (dz <= VIEW.cameraDepth) return null;
  const scale = VIEW.cameraDepth / dz;
  return {
    x: width / 2 + scale * (worldX - camX) * (width / 2),
    y: horizonShift - scale * (worldY - camY) * (height / 2),
    scale,
  };
}

// The horizon's screen y for a given pitch: pulling up pushes the
// horizon down, pushing over lifts it.
export function horizonForPitch(pitch, height) {
  return VIEW.horizonY + pitch * height * 0.38;
}

// River centreline at a segment: it winds across the right-hand fields.
export function riverXAt(segmentIndex) {
  return 5.2 + Math.sin(segmentIndex * COURSE.riverMeander) * 3.0;
}
