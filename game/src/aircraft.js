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
    // Arrow-key hold time per key, seconds of full hold. A tap is a
    // gentle nudge, holding builds to full authority (see stepAircraft).
    keyHold: { bankLeft: 0, bankRight: 0, pitchUp: 0, pitchDown: 0 },
  };
}

export function stepAircraft(plane, input, fuel, dt, course) {
  const keys = input.keys;
  const mouse = input.mouse;

  // --- Controls: stick (arrows or mouse) and throttle (W/S). ---
  // Arrow keys ramp: a tap is a gentle nudge, holding builds to full
  // authority in about half a second. Binary keys at full bank used to
  // swing the jet clean across the valley before they could reverse,
  // so a keyboard-only pilot threaded only 3/6 rings and then died of
  // fuel starvation in the gates leg — while mouse pilots landed near
  // perfect. The mouse is already proportional and is untouched.
  const hold = plane.keyHold;
  const rampOf = (key) => {
    // Every frame, held or not, so a released key decays back to a
    // fresh tap instead of keeping its old hold time.
    if (keys[key]) hold[key] = Math.min(1, hold[key] + dt * 2.2);
    else hold[key] = Math.max(0, hold[key] - dt * 6);
    return 0.25 + 0.75 * hold[key];
  };
  const rampR = rampOf('bankRight');
  const rampL = rampOf('bankLeft');
  const rampU = rampOf('pitchUp');
  const rampD = rampOf('pitchDown');
  let bankInput = (keys.bankRight ? rampR : 0) - (keys.bankLeft ? rampL : 0);
  let pitchInput = (keys.pitchUp ? rampU : 0) - (keys.pitchDown ? rampD : 0);
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
  // No altitude floor: a stalled jet at 3 ft must still sink the
  // last few feet instead of hovering there forever (the climb rate
  // is proportional to speed, so at ~0 kt nothing else brings it
  // down). On the ground the jet never stalls (onGround is false
  // only in the air), and a touchdown below 100 kt is already a
  // crash by the landing rules, so this changes no fair landing.
  plane.stalled = !plane.onGround && plane.speed < PLANE.stallSpeed;
  if (plane.stalled) {
    plane.pitch -= dt * 0.5;
    plane.pitch = Math.max(-0.5, plane.pitch);
  }

  // --- Motion: forward, turning with the bank, climbing with pitch. ---
  const worldSpeed = knotsToWorldSpeed(plane.speed);
  // Banking right turns the jet right: positive bank grows the
  // heading, and a bigger heading moves the jet to +x. (This was
  // backwards before: ArrowRight banked the jet left and flew it
  // into the left mountains. The render parallax, the compass and
  // the attitude ball were already built for this sign.)
  plane.heading += plane.bank * PLANE.turnRate * (plane.speed / PLANE.maxSpeed) * dt;
  plane.x += Math.sin(plane.heading) * worldSpeed * dt;
  plane.z += Math.cos(plane.heading) * worldSpeed * dt;

  const climbRate = Math.sin(plane.pitch) * plane.speed * 1.55; // ft/s
  // A stalled wing makes no lift: the jet sinks even with no forward
  // speed. Without this the climb rate (proportional to speed) goes
  // to zero as the speed does, and an engine-out jet hangs motionless
  // in the sky instead of falling.
  const sinkRate = plane.stalled ? 150 : 0; // ft/s
  plane.verticalSpeed = plane.onGround ? 0 : climbRate - sinkRate;
  plane.altitudeFt += (climbRate - sinkRate) * dt;
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
  // Banking right dips the right wing: clockwise from behind, so
  // the rotation takes the bank's sign as-is. (It was negated
  // before, matching the old backwards turn.)
  ctx.rotate(plane.bank * 0.9);
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

  // Afterburner: a flickering flame cone out of the tail when the
  // throttle is high and the jet is flying — speed you can see.
  if (!plane.onGround && plane.throttle > 0.7) {
    const flicker = 0.85 + Math.sin(time * 42) * 0.15;
    const flameLen = size * (0.55 + plane.throttle * 0.55) * flicker;
    const flame = ctx.createLinearGradient(0, size * 0.4, 0, size * 0.4 + flameLen);
    flame.addColorStop(0, 'rgba(255, 240, 170, 0.95)');
    flame.addColorStop(0.45, 'rgba(255, 150, 50, 0.85)');
    flame.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-size * 0.09, size * 0.4);
    ctx.lineTo(size * 0.09, size * 0.4);
    ctx.lineTo(0, size * 0.4 + flameLen);
    ctx.closePath();
    ctx.fill();
  }

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
