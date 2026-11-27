// Golden Hour — Valley Run: bootstrap, game loop and screens.
// One sortie, three legs: rings, gates, runway 27. The title screen
// flies itself (attract mode) behind the menu; Enter starts the flight;
// the jet lands or crashes, and Enter flies again. A ?scene= parameter
// jumps straight to a state for screenshots: title, rings, landing,
// landed — the same code path, only the starting state is preset.

import { VIEW, COURSE } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCourse, feetToUnits } from './world.js';
import { createAircraft, stepAircraft } from './aircraft.js';
import { renderScene } from './render.js';
import { drawHUD } from './hud.js';
import { createSortie, objectiveText, updateSortie, evaluateTouchdown, crashCheck } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

let width = 1280;
let height = 720;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}
window.addEventListener('resize', resize);
resize();

function freshRun() {
  const course = createCourse();
  return {
    course,
    plane: createAircraft(),
    sortie: createSortie(course),
    fuel: 100,
    mode: 'title',
    time: 0,
    message: '',
    messageUntil: 0,
    lastBeep: 0,
    rollout: 0,
  };
}

let game = freshRun();

// Best run, kept in the browser so there is a score to chase next
// time. Local only, no network; a missing or blocked store just
// means no best score is shown.
let bestScore = 0;
try {
  bestScore = Number(window.localStorage.getItem('goldenHourBest') || 0) || 0;
} catch (e) {
  bestScore = 0;
}
function saveBest(score) {
  if (score > bestScore) {
    bestScore = score;
    try {
      window.localStorage.setItem('goldenHourBest', String(score));
    } catch (e) {
      // Storage blocked: the score still shows for this run.
    }
  }
}

function showMessage(text, seconds = 2.2) {
  game.message = text;
  game.messageUntil = game.time + seconds;
}

function startFlight() {
  const keepTime = game.time;
  game = freshRun();
  game.time = keepTime;
  game.mode = 'playing';
  audio.unlock();
  statusLine.textContent = 'Flying. Thread the sky rings, then slalom the gates, then land on runway 27.';
}

function endFlightLanded() {
  game.mode = 'landed';
  saveBest(game.sortie.score);
  statusLine.textContent = `Landed on runway 27. Score ${game.sortie.score}. Press Enter to fly again.`;
}

function endFlightCrashed(reason) {
  game.sortie.crashReason = reason;
  game.mode = 'crashed';
  saveBest(game.sortie.score);
  audio.crash();
  statusLine.textContent = `Crashed: ${reason} Score ${game.sortie.score}. Press Enter to try again.`;
}

// Attract mode: the jet flies itself behind the title screen.
function stepAttract(dt) {
  const { plane } = game;
  plane.throttle = 0.55;
  plane.speed = 240;
  plane.altitudeFt = 620 + Math.sin(game.time * 0.25) * 120;
  plane.pitch = Math.cos(game.time * 0.25) * 0.06;
  plane.bank = Math.sin(game.time * 0.4) * 0.35;
  plane.x = Math.sin(game.time * 0.11) * 1.6;
  plane.z += 100 * dt;
  if (plane.z > game.course.landingStartZ) {
    plane.z = 0;
    plane.x = 0;
  }
  plane.onGround = false;
}

function stepPlaying(dt) {
  const { plane, course, sortie } = game;
  const prevZ = plane.z;
  const prevAirborne = sortie.wasAirborne;
  const wasOnGround = plane.onGround;

  const step = stepAircraft(plane, input, game.fuel, dt, course);
  game.fuel = step.fuel;
  if (step.gearChanged) {
    audio.gear();
    showMessage(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', 1.4);
  }
  if (!plane.onGround && plane.speed > 110) sortie.wasAirborne = true;

  // Rings, gates and phase changes.
  for (const event of updateSortie(sortie, plane, prevZ, course, game.fuel)) {
    if (event.type === 'ring') {
      audio.ring();
      game.fuel = Math.min(100, game.fuel + event.fuel);
      showMessage(`RING  +${250}   ·   FUEL +${event.fuel}`);
    } else if (event.type === 'gate') {
      audio.gate();
      game.fuel = Math.min(100, game.fuel + event.fuel);
      showMessage(`GATE  +${150}   ·   FUEL +${event.fuel}`);
    } else if (event.type === 'bonus') {
      audio.ring();
      game.fuel = Math.min(100, game.fuel + event.fuel);
      showMessage(`BONUS RING  +${400}   ·   FUEL +${event.fuel}`);
    } else if (event.type === 'ringMaster') {
      showMessage('RING MASTER  +500 — every ring threaded');
    } else if (event.type === 'phase') {
      showMessage(event.phase === 'gates' ? 'NEXT LEG — SLALOM THE CANYON GATES' : 'FINAL LEG — LAND ON RUNWAY 27', 3);
    }
  }

  // Touchdown: the jet was flying and its wheels just found the ground.
  if (!wasOnGround && plane.onGround && prevAirborne) {
    const verdict = evaluateTouchdown(sortie, plane, course, game.fuel);
    if (verdict.result === 'landed') {
      audio.touchdown();
      showMessage(`TOUCHDOWN  +${verdict.bonus}`, 3);
      game.rollout = 0;
    } else if (verdict.result === 'crash') {
      endFlightCrashed(verdict.reason);
      return;
    }
  }

  // Landing rollout: bleed speed on the runway, then the sortie ends.
  if (sortie.landed) {
    plane.throttle = 0;
    plane.speed = Math.max(0, plane.speed - 90 * dt);
    game.rollout += dt;
    if (plane.speed < 15 && game.rollout > 1) {
      endFlightLanded();
      return;
    }
  }

  // Crashes that do not wait for a touchdown.
  const crash = crashCheck(sortie, plane, course);
  if (crash) {
    endFlightCrashed(crash);
    return;
  }

  // Stall horn.
  if (plane.stalled && game.time - game.lastBeep > 0.5) {
    audio.warning();
    game.lastBeep = game.time;
  }
  audio.update(plane.throttle, plane.speed, true);
}

function step(dt) {
  game.time += dt;
  if (input.wasPressedAny(['KeyM'])) audio.setMuted(!audio.isMuted());
  if (game.mode === 'title') {
    stepAttract(dt);
    if (input.wasPressedAny(['Enter'])) startFlight();
  } else if (game.mode === 'playing') {
    if (input.wasPressedAny(['KeyP'])) {
      game.mode = 'paused';
      statusLine.textContent = 'Paused. Press P to keep flying.';
    } else {
      stepPlaying(dt);
    }
  } else if (game.mode === 'paused') {
    if (input.wasPressedAny(['KeyP'])) game.mode = 'playing';
    audio.update(0, 0, false);
  } else if (game.mode === 'landed' || game.mode === 'crashed') {
    if (input.wasPressedAny(['Enter'])) startFlight();
    audio.update(0, 0, false);
  }
  input.endFrame();
}

function drawTitle() {
  ctx.fillStyle = 'rgba(10, 8, 24, 0.42)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd98a';
  ctx.font = `900 ${Math.round(64 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('GOLDEN HOUR', width / 2, height * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.font = `300 ${Math.round(30 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('—  V A L L E Y   R U N  —', width / 2, height * 0.3 + 52);
  ctx.fillStyle = '#d8f6ff';
  ctx.font = `${Math.round(18 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('Thread six sky rings. Slalom eight canyon gates. Put her down on runway 27 before the fuel runs out.', width / 2, height * 0.46);
  ctx.fillStyle = '#39e6ff';
  ctx.font = `bold ${Math.round(20 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('PRESS ENTER TO FLY', width / 2, height * 0.56);
  ctx.fillStyle = 'rgba(216, 246, 255, 0.9)';
  ctx.font = `${Math.round(15 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('W / S throttle  ·  Arrow keys or mouse fly the jet  ·  G landing gear  ·  Space airbrake  ·  P pause  ·  M sound', width / 2, height * 0.66);
  if (bestScore > 0) {
    ctx.fillStyle = '#ffd98a';
    ctx.font = `bold ${Math.round(18 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText(`BEST RUN  ${bestScore.toLocaleString('en-US')}`, width / 2, height * 0.73);
  }
  ctx.fillStyle = 'rgba(216, 246, 255, 0.55)';
  ctx.font = `${Math.round(13 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('A complete original flight game — static files, no network, keyboard and mouse.', width / 2, height * 0.9);
}

function drawEndScreen() {
  const { sortie } = game;
  const landed = game.mode === 'landed';
  ctx.fillStyle = 'rgba(10, 8, 24, 0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = landed ? '#59e391' : '#ff5a4e';
  ctx.font = `900 ${Math.round(46 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText(landed ? 'TOUCHDOWN — RUNWAY 27' : 'CRASHED', width / 2, height * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(19 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  if (landed && sortie.touchdown) {
    const t = sortie.touchdown;
    ctx.fillText(`Centreline error ${t.centerError.toFixed(2)} runway widths  ·  Touchdown ${t.verticalSpeed.toFixed(1)} ft/s  ·  ${t.speed.toFixed(0)} knots`, width / 2, height * 0.42);
    ctx.fillText(`Landing bonus +${t.bonus}  ·  Fuel left ${t.fuelLeft.toFixed(0)}`, width / 2, height * 0.47);
  } else {
    ctx.fillText(sortie.crashReason || '', width / 2, height * 0.42);
  }
  ctx.fillStyle = '#ffd98a';
  ctx.font = `bold ${Math.round(30 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText(`SCORE  ${sortie.score.toLocaleString('en-US')}`, width / 2, height * 0.56);
  if (bestScore > 0) {
    ctx.fillStyle = '#d8f6ff';
    ctx.font = `${Math.round(15 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText(`BEST  ${bestScore.toLocaleString('en-US')}`, width / 2, height * 0.61);
  }
  ctx.fillStyle = '#d8f6ff';
  ctx.font = `${Math.round(16 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText(`Rings ${sortie.ringsHit}/${COURSE.ringCount}   ·   Gates ${sortie.gatesHit}/${COURSE.gateCount}   ·   Bonus ${sortie.bonusHit}/2`, width / 2, height * 0.68);
  ctx.fillStyle = '#39e6ff';
  ctx.font = `bold ${Math.round(20 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('PRESS ENTER TO FLY AGAIN', width / 2, height * 0.74);
}

function drawPaused() {
  ctx.fillStyle = 'rgba(10, 8, 24, 0.6)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(40 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillText('PAUSED', width / 2, height / 2);
  ctx.font = `${Math.round(17 * (width / 1280))}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = '#d8f6ff';
  ctx.fillText('Press P to keep flying', width / 2, height / 2 + 44);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Distance to the next objective, for the HUD: the nearest ring or
  // gate still ahead, or the runway on the final leg.
  let nextZ = game.course.landingStartZ;
  const ahead = [...game.course.rings, ...game.course.gates].filter((o) => !o.hit && o.z > game.plane.z);
  if (game.sortie.phase !== 'landing' && ahead.length > 0) {
    nextZ = Math.min(...ahead.map((o) => o.z));
  }
  const state = {
    plane: game.plane,
    width,
    height,
    fuel: game.fuel,
    score: game.sortie.score,
    objective: objectiveText(game.sortie),
    message: game.message,
    messageUntil: game.messageUntil,
    runwayZ: game.course.landingStartZ,
    phase: game.sortie.phase,
    nextZ,
    mode: game.mode,
  };
  renderScene(ctx, state, game.course, game.time);
  if (game.mode === 'playing' || game.mode === 'paused') drawHUD(ctx, state, game.time);
  if (game.mode === 'title') drawTitle();
  if (game.mode === 'paused') drawPaused();
  if (game.mode === 'landed' || game.mode === 'crashed') drawEndScreen();
}

// Screenshot scenes: the same render path, a preset starting state.
// ?scene=title | rings | landing | landed
// The ?scene= parameter stages one frame for a screenshot: title,
// rings, landing or landed. When it is set and the staged frame is
// a live flight, the physics are frozen so the shot is exactly the
// staged frame — otherwise the jet flies on during page load and
// the framing depends on how fast the page happened to load.
const stagedScene = new URLSearchParams(window.location.search).get('scene');

function applyScene() {
  const scene = stagedScene;
  if (!scene) return;
  if (scene === 'title') {
    game.mode = 'title';
    return;
  }
  const { plane, course, sortie } = game;
  if (scene === 'rings') {
    const ring = course.rings[2];
    game.mode = 'playing';
    // The ring fills a good part of the frame with its beacon and
    // label, and the valley is still visible around it. Exact,
    // because the staged frame is frozen (see frame() below).
    plane.z = ring.z - 35;
    plane.x = ring.x;
    plane.altitudeFt = ring.y * 50;
    plane.speed = 150;
    plane.throttle = 0.45;
    plane.onGround = false;
    sortie.wasAirborne = true;
    game.fuel = 82;
  } else if (scene === 'landing') {
    game.mode = 'playing';
    // Short final: the runway wedge, threshold bars and PAPI lights
    // read clearly, and the jet is still airborne. Exact, because
    // the staged frame is frozen (see frame() below).
    plane.z = course.landingStartZ - 30;
    plane.x = course.segmentAt(plane.z).centerX + 0.2;
    plane.altitudeFt = 90;
    plane.speed = 150;
    plane.throttle = 0.35;
    plane.gearDown = true;
    plane.onGround = false;
    plane.pitch = -0.06;
    sortie.wasAirborne = true;
    sortie.phase = 'landing';
    game.fuel = 44;
  } else if (scene === 'landed') {
    const seg = course.segmentAt(course.landingStartZ + 1200);
    plane.z = course.landingStartZ + 1200;
    plane.x = seg.centerX;
    plane.altitudeFt = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.gearDown = true;
    plane.onGround = true;
    sortie.landed = true;
    sortie.phase = 'landing';
    sortie.ringsHit = 5;
    sortie.gatesHit = 7;
    sortie.score = 2840;
    sortie.touchdown = { centerError: 0.32, verticalSpeed: 3.1, speed: 148, fuelLeft: 31, bonus: 1948 };
    game.fuel = 31;
    game.mode = 'landed';
  }
}

applyScene();

// Debug handle for play-testing: exposes the live game state so an
// automated test can read the mode, the jet and the score. A getter,
// because startFlight replaces the game object and a plain reference
// would go stale and keep reporting the title screen.
Object.defineProperty(window, '__flightGame', {
  get() {
    return game;
  },
});

let last = performance.now();
function frame(now) {
  // The first animation-frame timestamp can sit a few milliseconds
  // before the performance.now() taken at module load (headless
  // clocks disagree by that much); a negative dt would fly the jet
  // backwards off the course and kill the renderer, so clamp it.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  // A staged screenshot frame does not fly: with ?scene=rings or
  // ?scene=landing the jet holds the exact staged position, so the
  // shot never depends on page-load timing. Normal play (no ?scene=)
  // is unaffected.
  if (!(stagedScene && game.mode === 'playing')) step(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
