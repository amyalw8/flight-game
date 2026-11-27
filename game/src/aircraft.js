// The jet: flight model and the chase-view drawing.
// Arcade physics with real trade-offs: throttle buys speed, climbing
// spends it, banking turns the jet, and the wing quits below stall
// speed. The drawing is a jet seen from behind and above, banking
// with the stick and pitching with the climb.

import { PLANE, COLORS, VIEW } from './config.js';
import { knotsToWorldSpeed, feetToUnits } from './world.js';

export function createAircraft() {
  return {
    x: 0, // lateral position, road-width units; 0 is the centreline
    z: 0, // distance down the valley, world units
    altitudeFt: 0,
    speed: 0, // knots
    throttle: 0,
    pitch: 0, // radians; positive is nose up
    bank: 0, // radians; positive is right wing down
    heading: 0, // radians of turn away from the valley direction
    verticalSpeed: 0, // feet per second, for the landing judgement
    gearDown: false,
    onGround: true,
    stalled: false,
    engineOut: false,
  };
}

export function stepAircraft(plane, input, fuel, dt, course) {
  const keys = input.keys;
  const mouse = input.mouse;

  // --- Controls: stick (arrows or mouse) and throttle (W/S). ---
  let bankInput = (keys.bankRight ? 1 : 0) - (keys.bankLeft ? 1 : 0);
  let pitchInput = (keys.pitchUp ? 1 : 0) - (keys.pitchDown ? 1 : 0);
  if (mouse.active) {
    bankInput += Math.max(-1, Math.min(1, mouse.x * 2.4));
    pitchInput += Math.max(-1, Math.min(1, mouse.y * 2.4));
  }
  bankInput = Math.max(-1, Math.min(1, bankInput));
  pitchInput = Math.max(-1, Math.min(1, pitchInput));

  if (keys.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.7);
  if (keys.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.7);
  if (keys.brake) plane.throttle = Math.max(0, plane.throttle - dt * 1.6);

  const wasGear = plane.gearDown;
  if (input.wasPressed('KeyG')) plane.gearDown = !plane.gearDown;
  const gearChanged = wasGear !== plane.gearDown;

  // --- Speed: throttle pulls it up, drag and climbing pull it down. ---
  const targetSpeed = plane.engineOut ? 0 : plane.throttle * PLANE.maxSpeed;
  let speed = plane.speed + (targetSpeed - plane.speed) * PLANE.accel * dt;
  speed -= Math.sin(plane.pitch) * PLANE.climbDrag * 60 * dt;
  if (plane.gearDown) speed -= PLANE.gearDrag * 60 * dt;
  if (plane.onGround && speed < 40) speed = Math.max(0, speed);
  plane.speed = Math.max(0, speed);

  // --- Attitude: bank chases the stick, pitch chases the stick. ---
  const targetBank = bankInput * PLANE.maxBank;
  plane.bank += (targetBank - plane.bank) * Math.min(1, dt * 6);
  const targetPitch = plane.onGround ? 0 : pitchInput * PLANE.maxPitch;
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 4);

  // --- Stall: below stall speed the wing quits and the nose drops. ---
  plane.stalled = !plane.onGround && plane.speed < PLANE.stallSpeed && plane.altitudeFt > 5;
  if (plane.stalled) {
    plane.pitch -= dt * 0.5;
    plane.pitch = Math.max(-0.5, plane.pitch);
  }

  // --- Motion: forward, turning with the bank, climbing with pitch. ---
  const worldSpeed = knotsToWorldSpeed(plane.speed);
  plane.heading += -plane.bank * PLANE.turnRate * (plane.speed / PLANE.maxSpeed) * dt;
  plane.x += Math.sin(plane.heading) * worldSpeed * dt;
  plane.z += Math.cos(plane.heading) * worldSpeed * dt;

  const climbRate = Math.sin(plane.pitch) * plane.speed * 1.55; // ft/s
  plane.verticalSpeed = plane.onGround ? 0 : climbRate;
  plane.altitudeFt += climbRate * dt;
  if (plane.altitudeFt > PLANE.ceiling) {
    plane.altitudeFt = PLANE.ceiling;
    plane.pitch = Math.min(plane.pitch, 0);
  }

  // --- Ground: touching down, rolling, rotating. ---
  // Rotation needs speed AND a pull on the stick: below rotation
  // speed, or with the stick neutral, the jet stays on its wheels.
  if (plane.altitudeFt <= 0) {
    plane.altitudeFt = 0;
    plane.verticalSpeed = 0;
    if (plane.speed > 110 && pitchInput > 0.2) {
      plane.onGround = false;
      plane.altitudeFt = 0.5;
      plane.pitch = 0.08;
    } else {
      plane.onGround = true;
      plane.pitch = 0;
    }
  } else {
    plane.onGround = false;
  }

  // --- Fuel: the throttle sets the burn; empty means gliding. ---
  let newFuel = fuel;
  if (!plane.onGround || plane.speed > 30) {
    const burn = PLANE.fuelBurnCruise + plane.throttle * (PLANE.fuelBurnFull - PLANE.fuelBurnCruise);
    newFuel = Math.max(0, fuel - burn * dt);
  }
  plane.engineOut = newFuel <= 0;

  return { fuel: newFuel, gearChanged };
}

// The jet, drawn from behind and above at the bottom centre of the
// screen. It banks with the stick and lifts its nose with the climb.
export function drawAircraft(ctx, plane, width, height, time) {
  const cx = width / 2;
  const cy = height * 0.78 - plane.pitch * height * 0.35;
  const size = Math.min(width, height) / 6.4;
  const strobe = Math.sin(time * 6) > 0.7;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank * 0.9);
  ctx.scale(1, 1 - Math.abs(plane.pitch) * 0.25);

  // Engine glow, brighter with throttle.
  const glow = 0.25 + plane.throttle * 0.75;
  const grad = ctx.createRadialGradient(0, size * 0.34, 2, 0, size * 0.34, size * 0.5);
  grad.addColorStop(0, `rgba(255, 190, 90, ${0.85 * glow})`);
  grad.addColorStop(0.5, `rgba(255, 120, 40, ${0.4 * glow})`);
  grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, size * 0.34, size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Wings: swept back, red tips, grey tops.
  ctx.fillStyle = COLORS.jetBody;
  ctx.strokeStyle = COLORS.jetTrim;
  ctx.lineWidth = size * 0.03;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(size * 1.05, size * 0.28);
  ctx.lineTo(size * 0.92, size * 0.38);
  ctx.lineTo(0, size * 0.12);
  ctx.lineTo(-size * 0.92, size * 0.38);
  ctx.lineTo(-size * 1.05, size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fuselage: a tapered body with a darker belly and a red spine.
  ctx.fillStyle = COLORS.jetBody;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.62);
  ctx.quadraticCurveTo(size * 0.16, -size * 0.1, size * 0.1, size * 0.42);
  ctx.quadraticCurveTo(0, size * 0.52, -size * 0.1, size * 0.42);
  ctx.quadraticCurveTo(-size * 0.16, -size * 0.1, 0, -size * 0.62);
  ctx.fill();
  ctx.fillStyle = COLORS.jetBelly;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.3);
  ctx.quadraticCurveTo(size * 0.12, 0, size * 0.08, size * 0.42);
  ctx.quadraticCurveTo(0, size * 0.5, -size * 0.08, size * 0.42);
  ctx.quadraticCurveTo(-size * 0.12, 0, 0, -size * 0.3);
  ctx.fill();

  // Canopy: a dark glass teardrop ahead of the wing.
  ctx.fillStyle = '#1c2733';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.34, size * 0.07, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(140, 220, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.02, -size * 0.38, size * 0.025, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Twin tail fins.
  ctx.fillStyle = COLORS.jetTrim;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, size * 0.3);
  ctx.lineTo(-size * 0.3, size * 0.05);
  ctx.lineTo(-size * 0.26, size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.1, size * 0.3);
  ctx.lineTo(size * 0.3, size * 0.05);
  ctx.lineTo(size * 0.26, size * 0.32);
  ctx.closePath();
  ctx.fill();

  // Navigation lights: red port, green starboard, white strobe.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-size * 1.02, size * 0.3, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#35e08a';
  ctx.beginPath();
  ctx.arc(size * 1.02, size * 0.3, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  if (strobe) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, size * 0.5, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Soft shadow on the ground when flying low: it sells the height.
  const altUnits = feetToUnits(plane.altitudeFt);
  if (!plane.onGround && altUnits < 12) {
    const alpha = 0.3 * (1 - altUnits / 12);
    const shadowScale = 1 + altUnits * 0.12;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cx + plane.bank * 40, height * 0.94, size * 0.9 * shadowScale, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
