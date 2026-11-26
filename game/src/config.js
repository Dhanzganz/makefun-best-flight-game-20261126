// Archipelago Airmail — tuning constants and mission definitions.
// One file, one job: every number the flight model and the missions use.

const CONFIG = {
  // World
  worldSize: 2600, // playable square, metres, centred on (0, 0)
  oceanLevel: 0,

  // Aircraft limits
  maxSpeed: 62, // m/s at full throttle (~223 km/h)
  cruiseSpeed: 38,
  stallSpeed: 12, // below this the plane sinks (kept low so finals stay flyable)
  maxPitchDeg: 28,
  maxRollDeg: 55,
  climbRate: 9, // m/s at full power, level pitch
  sinkRate: 5, // m/s when stalled or idle
  turnRate: 0.55, // rad/s at full bank

  // Fuel: percent, drains with throttle; a full tank lasts ~4 minutes at cruise
  fuelCapacity: 100,
  fuelDrainPerSec: 0.42, // at full throttle
  fuelRingBonus: 30,

  // Rings
  ringRadius: 18,
  ringCatchRadius: 15,

  // Scoring
  ringScore: 100,
  landingBonusMax: 500,
  timePenaltyPerSec: 2,

  // Camera
  cameraDistance: 13,
  cameraHeight: 4.2,
  cameraSmoothing: 0.12,

  // Runways (flattened strips on the terrain)
  runways: {
    home: { x: 0, z: -40, heading: 90, length: 170, width: 16, name: 'Coral Bay' },
    turtle: { x: 760, z: -330, heading: 250, length: 150, width: 16, name: 'Turtle Island' },
    palm: { x: -640, z: 330, heading: 10, length: 150, width: 16, name: 'Palm Cay' },
  },
};

// Missions: fly the rings in order, then land on the destination runway.
// Wind is a sideways push in m/s that grows with the mission number.
const MISSIONS = [
  {
    id: 1,
    name: 'First Post',
    briefing: 'Carry the morning mail from Coral Bay to Turtle Island. Fly through all 4 rings, then land on the Turtle Island strip.',
    startRunway: 'home',
    destination: 'turtle',
    wind: 0,
    fuel: 100,
    rings: [
      { x: 190, y: 95, z: -120 },
      { x: 380, y: 110, z: -260 },
      { x: 560, y: 100, z: -380 },
      { x: 700, y: 85, z: -380 },
    ],
  },
  {
    id: 2,
    name: 'Storm Run',
    briefing: 'A squall is crossing the strait. Six rings to Palm Cay, gusts shoving you sideways — watch the fuel gauge.',
    startRunway: 'turtle',
    destination: 'palm',
    wind: 6,
    fuel: 85,
    rings: [
      { x: 620, y: 105, z: -180 },
      { x: 380, y: 120, z: 20 },
      { x: 120, y: 95, z: 140 },
      { x: -140, y: 110, z: 260 },
      { x: -400, y: 90, z: 320 },
      { x: -580, y: 80, z: 330 },
    ],
  },
  {
    id: 3,
    name: 'Island Grand Tour',
    briefing: 'The full circuit: eight rings over all three islands, then home to Coral Bay. Tight fuel, strong wind — fly clean.',
    startRunway: 'palm',
    destination: 'home',
    wind: 9,
    fuel: 80,
    rings: [
      { x: -480, y: 100, z: 180 },
      { x: -220, y: 120, z: 60 },
      { x: -40, y: 90, z: -180 },
      { x: 240, y: 115, z: -300 },
      { x: 520, y: 100, z: -420 },
      { x: 720, y: 90, z: -240 },
      { x: 540, y: 105, z: -60 },
      { x: 260, y: 90, z: -120 },
    ],
  },
];

// Fuel rings float along the routes: green rings that top the tank up.
const FUEL_RINGS = [
  { x: 300, y: 105, z: -190, taken: false },
  { x: -260, y: 105, z: 190, taken: false },
  { x: 420, y: 100, z: -330, taken: false },
];
