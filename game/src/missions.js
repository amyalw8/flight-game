// The sortie: objectives, scoring, and what counts as a landing.
// One flight has three legs: thread the sky rings, slalom the canyon
// gates, then put the jet down on runway 27. Rings and gates pay
// points and fuel; the landing pays on how centred, soft and thrifty
// it is. Everything else is a crash, with its reason named.

import { COURSE, SCORE, PLANE } from './config.js';
import { feetToUnits } from './world.js';

export function createSortie(course) {
  return {
    phase: 'rings',
    ringsHit: 0,
    gatesHit: 0,
    bonusHit: 0,
    score: 0,
    landed: false,
    crashReason: null,
    touchdown: null, // { centerError, verticalSpeed, speed, fuelLeft }
    wasAirborne: false,
  };
}

export function objectiveText(sortie) {
  if (sortie.phase === 'rings') return `Sky rings  ${sortie.ringsHit}/${COURSE.ringCount}`;
  if (sortie.phase === 'gates') return `Canyon gates  ${sortie.gatesHit}/${COURSE.gateCount}`;
  if (sortie.phase === 'landing') return 'Land on runway 27';
  return 'Sortie complete';
}

function crossed(prevZ, z, targetZ) {
  return prevZ < targetZ && z >= targetZ;
}

// Called every frame while flying. Returns the events that happened:
// { type: 'ring' | 'gate' | 'phase' } so the game can chime and score.
export function updateSortie(sortie, plane, prevZ, course, fuel) {
  const events = [];
  const ringZoneEndZ = COURSE.ringZoneEnd * 60;
  const gateZoneEndZ = COURSE.gateZoneEnd * 60;

  for (const ring of course.rings) {
    if (ring.hit || ring.passed) continue;
    if (crossed(prevZ, plane.z, ring.z)) {
      const dx = plane.x - ring.x;
      const dy = feetToUnits(plane.altitudeFt) - ring.y;
      if (Math.hypot(dx, dy) <= ring.radius) {
        ring.hit = true;
        sortie.ringsHit++;
        sortie.score += SCORE.ring;
        events.push({ type: 'ring', fuel: PLANE.ringFuelBonus });
      } else {
        ring.passed = true;
      }
    }
  }
  for (const gate of course.gates) {
    if (gate.hit || gate.passed) continue;
    if (crossed(prevZ, plane.z, gate.z)) {
      const dx = plane.x - gate.x;
      const dy = feetToUnits(plane.altitudeFt) - gate.y;
      if (Math.hypot(dx, dy) <= gate.radius) {
        gate.hit = true;
        sortie.gatesHit++;
        sortie.score += SCORE.gate;
        events.push({ type: 'gate', fuel: PLANE.gateFuelBonus });
      } else {
        gate.passed = true;
      }
    }
  }
  // Gold bonus rings: off the racing line, worth more, and they never
  // gate the phases — missing one costs nothing but the points.
  for (const ring of course.bonusRings) {
    if (ring.hit || ring.passed) continue;
    if (crossed(prevZ, plane.z, ring.z)) {
      const dx = plane.x - ring.x;
      const dy = feetToUnits(plane.altitudeFt) - ring.y;
      if (Math.hypot(dx, dy) <= ring.radius) {
        ring.hit = true;
        sortie.bonusHit++;
        sortie.score += SCORE.bonusRing;
        events.push({ type: 'bonus', fuel: PLANE.bonusRingFuel });
      } else {
        ring.passed = true;
      }
    }
  }

  if (sortie.phase === 'rings' && plane.z >= ringZoneEndZ) {
    sortie.phase = 'gates';
    if (sortie.ringsHit === COURSE.ringCount) {
      sortie.score += SCORE.ringMasterBonus;
      events.push({ type: 'ringMaster' });
    } else {
      events.push({ type: 'phase', phase: 'gates' });
    }
  } else if (sortie.phase === 'gates' && plane.z >= gateZoneEndZ) {
    sortie.phase = 'landing';
    events.push({ type: 'phase', phase: 'landing' });
  }
  return events;
}

// The moment the wheels touch: a landing or a crash, with its reason.
// Only called when the jet was airborne and its altitude hits zero.
export function evaluateTouchdown(sortie, plane, course, fuel) {
  const seg = course.segmentAt(plane.z);
  const centerError = Math.abs(plane.x - seg.centerX);
  const vs = Math.abs(plane.verticalSpeed);
  const inLandingZone = plane.z >= course.landingStartZ && plane.z <= course.landingEndZ;
  const onTakeoffRunway = plane.z <= COURSE.takeoffRunwayEnd * 60;

  if (onTakeoffRunway) return { result: 'roll', reason: null };
  if (!inLandingZone) {
    if (plane.z > course.landingEndZ) return { result: 'crash', reason: 'You overshot runway 27.' };
    return { result: 'crash', reason: 'You put it down in the fields.' };
  }
  if (!plane.gearDown) return { result: 'crash', reason: 'You landed with the gear up.' };
  if (centerError > 1.5) return { result: 'crash', reason: 'You landed off the runway.' };
  if (vs > 9) return { result: 'crash', reason: 'You came down too hard.' };
  if (plane.speed > 230) return { result: 'crash', reason: 'You touched down too fast.' };
  if (plane.speed < 100) return { result: 'crash', reason: 'You stalled onto the runway.' };

  // A landing. Score it on centreline, softness and fuel left.
  let bonus = SCORE.landingBase;
  if (centerError < 0.5) bonus += SCORE.centerlineBonus;
  if (vs < 4) bonus += SCORE.softTouchBonus;
  bonus += Math.round(fuel * SCORE.fuelBonusPerUnit);
  sortie.score += bonus;
  sortie.landed = true;
  sortie.touchdown = { centerError, verticalSpeed: vs, speed: plane.speed, fuelLeft: fuel, bonus };
  return { result: 'landed', reason: null, bonus };
}

// Crash checks that do not wait for a touchdown.
export function crashCheck(sortie, plane, course) {
  const seg = course.segmentAt(plane.z);
  if (!plane.onGround && Math.abs(plane.x - seg.centerX) > 8.5) {
    return 'You flew into the mountains.';
  }
  if (plane.onGround && !plane.engineOut) {
    const pastTakeoff = plane.z > (COURSE.takeoffRunwayEnd + 10) * 60;
    const inLandingZone = plane.z >= course.landingStartZ && plane.z <= course.landingEndZ;
    if (pastTakeoff && !inLandingZone && plane.speed < 80 && plane.z < course.landingStartZ) {
      return 'You ran off the end of the runway.';
    }
  }
  return null;
}
