// Keyboard and mouse state for Golden Hour — Valley Run.
// The game reads this one object every frame; nothing else touches
// the DOM event listeners. Mouse steering works like a stick: moving
// the mouse left or right banks the jet, moving it up or down pitches
// it, and the keys always work the same way.

import { KEYS } from './config.js';

function makeKeySet() {
  return {
    throttleUp: false,
    throttleDown: false,
    pitchUp: false,
    pitchDown: false,
    bankLeft: false,
    bankRight: false,
    brake: false,
  };
}

export function createInput(canvas) {
  const keys = makeKeySet();
  const pressed = new Set(); // edge-triggered keys, consumed once
  const mouse = { x: 0, y: 0, active: false, down: false };

  const actionOf = (code) => {
    for (const [action, codes] of Object.entries(KEYS)) {
      if (codes.includes(code)) return action;
    }
    return null;
  };

  window.addEventListener('keydown', (event) => {
    const action = actionOf(event.code);
    if (action) event.preventDefault();
    if (action && action in keys) keys[action] = true;
    if (!event.repeat) pressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    const action = actionOf(event.code);
    if (action && action in keys) keys[action] = false;
  });
  window.addEventListener('blur', () => {
    for (const action of Object.keys(keys)) keys[action] = false;
    mouse.active = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (event.clientY - rect.top) / rect.height - 0.5;
    mouse.active = true;
  });
  canvas.addEventListener('mousedown', () => {
    mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    keys,
    mouse,
    // True once for the frame after the key goes down, then false.
    wasPressed(code) {
      return pressed.has(code);
    },
    // True once for any of the codes in the list.
    wasPressedAny(codes) {
      return codes.some((code) => pressed.has(code));
    },
    endFrame() {
      pressed.clear();
    },
  };
}
