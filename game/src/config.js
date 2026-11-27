// Golden Hour — Valley Run: shared constants for the whole game.
// One place for every number that shapes how the game looks and flies,
// so tuning never means hunting through the render or physics code.

export const VIEW = {
  width: 1280,
  height: 720,
  horizonY: 300, // screen y of the horizon when the nose is level
  cameraDepth: 0.84, // 1 / tan(fov / 2); wider than a racer, it fits the sky
  drawDistance: 170, // how many valley segments ahead are drawn
  segmentLength: 60, // world units per valley segment
  roadHalfWidth: 1, // one road-width unit; the runway is 2.2 wide
  valleyHalfWidth: 9, // fields stretch this far each side of the centreline
};

export const COURSE = {
  totalSegments: 640,
  takeoffRunwayStart: 0, // first runway: the strip you take off from
  takeoffRunwayEnd: 46,
  ringZoneStart: 110, // sky rings live between these segments
  ringZoneEnd: 330,
  ringCount: 6,
  gateZoneStart: 350, // canyon gates (amber rings) live here
  gateZoneEnd: 540,
  gateCount: 8,
  landingRunwayStart: 560, // runway 27: the strip you must land on
  landingRunwayEnd: 640,
  riverMeander: 0.045, // how fast the river winds across the valley
};

export const PLANE = {
  maxSpeed: 430, // knots at full throttle, level flight
  minSpeed: 70, // below this the wing stops flying
  stallSpeed: 95, // below this the nose drops and the horn sounds
  accel: 0.45, // how fast speed chases the throttle setting
  climbDrag: 0.9, // climbing bleeds speed; diving builds it
  turnRate: 1.15, // radians of heading per second at full bank
  maxBank: 0.9, // radians of roll at full stick
  pitchRate: 0.55, // radians of pitch per second
  maxPitch: 0.42,
  fuelCapacity: 100,
  fuelBurnCruise: 0.55, // units per second at half throttle
  fuelBurnFull: 1.15, // units per second at full throttle
  ringFuelBonus: 12, // fuel a sky ring gives back
  gateFuelBonus: 6,
  gearDrag: 0.22, // flying with the gear down costs speed
  ceiling: 1500, // feet; the sky stops being useful above this
};

export const SCORE = {
  ring: 250,
  gate: 150,
  ringMasterBonus: 500, // all six rings threaded
  landingBase: 1000,
  centerlineBonus: 400, // touchdown within half a runway width
  softTouchBonus: 300, // gentle vertical speed at touchdown
  fuelBonusPerUnit: 8, // every unit of fuel left at landing
};

export const COLORS = {
  skyTop: '#2b1d4e',
  skyMid: '#7a3b6e',
  skyLow: '#e8703a',
  sunCore: '#ffd98a',
  sunGlow: 'rgba(255, 170, 80, 0.55)',
  mountainFar: '#4a2b5e',
  mountainNear: '#33204a',
  fieldA: '#5d7a35',
  fieldB: '#7a8f3c',
  fieldC: '#a8893f',
  fieldD: '#4f6b2e',
  river: '#3f7fa8',
  runway: '#3c3f46',
  runwayEdge: '#e8e4d8',
  runwayDash: '#f4f1e6',
  ring: '#39e6ff',
  gate: '#ffb02e',
  jetBody: '#c8ccd4',
  jetBelly: '#8f959f',
  jetTrim: '#c22730',
  jetGlow: '#ff9a3c',
  hudPanel: 'rgba(8, 14, 24, 0.72)',
  hudLine: '#39e6ff',
  hudText: '#d8f6ff',
  hudWarn: '#ff5a4e',
  hudAmber: '#ffb02e',
  hudGreen: '#59e391',
};

export const KEYS = {
  throttleUp: ['KeyW'],
  throttleDown: ['KeyS'],
  pitchUp: ['ArrowUp'],
  pitchDown: ['ArrowDown'],
  bankLeft: ['ArrowLeft', 'KeyA'],
  bankRight: ['ArrowRight', 'KeyD'],
  brake: ['Space'],
  gear: ['KeyG'],
  start: ['Enter'],
  pause: ['KeyP'],
  mute: ['KeyM'],
};
