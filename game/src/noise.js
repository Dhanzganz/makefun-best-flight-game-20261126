// Archipelago Airmail — seeded noise and the terrain height function.
// One file, one job: every part of the game (mesh, collision, trees) asks
// this file how high the ground is at (x, z), so they always agree.

// Mulberry32 — small deterministic PRNG.
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise on a 2D grid, seeded.
function makeNoise2D(seed) {
  const rng = makeRng(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function hash(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const ux = smooth(fx);
    const uz = smooth(fz);
    return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
  }
  // Fractal sum: 3 octaves of value noise.
  return function fbm(x, z) {
    return (
      noise(x, z) * 0.55 +
      noise(x * 2.13 + 7.7, z * 2.13 + 3.1) * 0.3 +
      noise(x * 4.31 + 13.5, z * 4.31 + 9.4) * 0.15
    );
  };
}

const terrainNoise = makeNoise2D(1337);

// Island definitions: centre, radius, peak height. The terrain is the sum
// of these bumps plus noise detail, falling to the ocean between islands.
const ISLANDS = [
  { x: 0, z: 0, r: 430, h: 58 }, // Coral Bay (home)
  { x: 760, z: -330, r: 300, h: 42 }, // Turtle Island
  { x: -640, z: 330, r: 350, h: 50 }, // Palm Cay
  { x: -180, z: -780, r: 260, h: 36 }, // Gull Rock (scenery)
  { x: 900, z: 420, r: 230, h: 30 }, // Far Reef (scenery)
];

function islandBump(x, z, island) {
  const dx = x - island.x;
  const dz = z - island.z;
  const d = Math.sqrt(dx * dx + dz * dz) / island.r;
  if (d >= 1) return 0;
  // Smooth dome: 1 at centre, 0 at the shore, with a flat beach ring.
  const dome = Math.pow(Math.cos(d * Math.PI * 0.5), 1.4);
  return dome * island.h;
}

// How flat the ground is forced near a runway strip (0 = untouched, 1 = flat).
function runwayFlatten(x, z) {
  let flat = 0;
  for (const key of Object.keys(CONFIG.runways)) {
    const rw = CONFIG.runways[key];
    const headingRad = (rw.heading * Math.PI) / 180;
    const dx = x - rw.x;
    const dz = z - rw.z;
    // Rotate into runway-local coords: along = runway axis, across = width.
    const along = dx * Math.sin(headingRad) + dz * Math.cos(headingRad);
    const across = dx * Math.cos(headingRad) - dz * Math.sin(headingRad);
    const halfL = rw.length / 2 + 60;
    const halfW = rw.width / 2 + 45;
    if (Math.abs(along) < halfL && Math.abs(across) < halfW) {
      const edge = Math.max(Math.abs(along) / halfL, Math.abs(across) / halfW);
      flat = Math.max(flat, 1 - Math.max(0, edge - 0.55) / 0.45);
    }
  }
  return flat;
}

// The one true ground height. Mesh, collision and tree placement all use it.
function terrainHeight(x, z) {
  let h = 0;
  for (const island of ISLANDS) h += islandBump(x, z, island);
  // Noise detail only where there is land, so the sea floor stays flat.
  if (h > 1) {
    h += terrainNoise(x * 0.008, z * 0.008) * 7 * Math.min(1, h / 20);
    h += terrainNoise(x * 0.03 + 40, z * 0.03 + 40) * 1.6;
  }
  // Flatten near runways to a gentle 4 m plateau so takeoffs and landings work.
  const flat = runwayFlatten(x, z);
  if (flat > 0) h = h * (1 - flat) + 4 * flat;
  return Math.max(0, h);
}

// Slope estimate, for tree placement (trees want gentle ground).
function terrainSlope(x, z) {
  const e = 3;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
}
