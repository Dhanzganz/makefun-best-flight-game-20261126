// Archipelago Airmail — world building: terrain, ocean, sky, runways, trees.
// One file, one job: turns the height function into the visible islands.

function buildSky(scene) {
  // Gradient sky dome: warm horizon fading to deep blue overhead.
  const geo = new THREE.SphereGeometry(4200, 24, 16);
  const top = new THREE.Color(0x2f6fd0);
  const mid = new THREE.Color(0x7fb8e8);
  const low = new THREE.Color(0xf6d9a0);
  const colors = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 4200;
    const c = new THREE.Color();
    if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6));
    else c.copy(low).lerp(mid, Math.max(0, (y + 0.05) / 0.3));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);

  // Low sun disc in the west, warm and bright.
  const sunGeo = new THREE.CircleGeometry(150, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(-2600, 620, -1800);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
}

function buildOcean(scene) {
  const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x1e6f8e,
    shininess: 120,
    specular: 0x99ccdd,
  });
  const ocean = new THREE.Mesh(geo, mat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = CONFIG.oceanLevel;
  scene.add(ocean);
  return ocean;
}

function terrainColor(h, slope) {
  // Sand at the shore, grass on the flats, rock on the steep/high ground.
  const sand = new THREE.Color(0xe8d49a);
  const grass = new THREE.Color(0x4f9e4a);
  const deepGrass = new THREE.Color(0x2f7a3d);
  const rock = new THREE.Color(0x8a7d6b);
  const c = new THREE.Color();
  if (h < 2.2) {
    c.copy(sand);
    if (h > 1.4) c.lerp(grass, (h - 1.4) / 0.8);
  } else if (slope > 0.55) {
    c.copy(rock);
  } else {
    c.copy(grass).lerp(deepGrass, Math.min(1, h / 55));
    if (h > 38) c.lerp(rock, Math.min(1, (h - 38) / 14));
  }
  return c;
}

function buildTerrain(scene) {
  const size = 2600;
  const segments = 180;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const slope = terrainSlope(x, z);
    const c = terrainColor(h, slope);
    // Slight brightness jitter so the mesh reads as hand-painted low-poly.
    const jitter = 0.94 + 0.06 * Math.abs(terrainNoise(x * 0.05, z * 0.05));
    colors.push(c.r * jitter, c.g * jitter, c.b * jitter);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

function buildRunway(scene, key) {
  const rw = CONFIG.runways[key];
  const group = new THREE.Group();
  const headingRad = (rw.heading * Math.PI) / 180;

  // Asphalt strip.
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(rw.width, rw.length),
    new THREE.MeshLambertMaterial({ color: 0x3a3f45 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 4.35;
  group.add(strip);

  // Centreline dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
  const dashes = Math.floor(rw.length / 14);
  for (let i = 0; i < dashes; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 4.4, -rw.length / 2 + 10 + i * 14);
    group.add(dash);
  }

  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 7), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(k * 2.6, 4.4, end * (rw.length / 2 - 6));
      group.add(bar);
    }
  }

  // Runway name board beside the strip, so the destination reads in shots.
  // It faces the approach end (local -Z), so an incoming pilot reads it.
  const board = makeTextBoard(rw.name.toUpperCase(), 0x10243a, 0xffffff);
  board.rotation.y = Math.PI;
  board.position.set(rw.width / 2 + 14, 8, -rw.length / 2 + 18);
  group.add(board);

  group.position.set(rw.x, 0, rw.z);
  group.rotation.y = headingRad;
  scene.add(group);
  return group;
}

// A small canvas-texture sign board (all art is generated in code, no files).
function makeTextBoard(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#' + bg.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#' + fg.toString(16).padStart(6, '0');
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
  );
  return mesh;
}

function buildPalm(x, z) {
  const group = new THREE.Group();
  const h = terrainHeight(x, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.9, 11, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b46 }),
  );
  trunk.position.y = 5.5;
  trunk.rotation.z = 0.12;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b3a });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 2.6, 11.5, Math.sin(a) * 2.6);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  group.position.set(x, h, z);
  return group;
}

function buildTrees(scene) {
  const rng = makeRng(4242);
  const group = new THREE.Group();
  let placed = 0;
  let tries = 0;
  while (placed < 260 && tries < 4000) {
    tries++;
    const x = (rng() - 0.5) * 2400;
    const z = (rng() - 0.5) * 2400;
    const h = terrainHeight(x, z);
    if (h < 3 || h > 34) continue;
    if (terrainSlope(x, z) > 0.4) continue;
    if (runwayFlatten(x, z) > 0.05) continue;
    const palm = buildPalm(x, z);
    palm.rotation.y = rng() * Math.PI * 2;
    const s = 0.8 + rng() * 0.5;
    palm.scale.set(s, s, s);
    group.add(palm);
    placed++;
  }
  scene.add(group);
  return group;
}

function buildClouds(scene) {
  // Puffy low-poly clouds: clusters of white spheres drifting slowly.
  const group = new THREE.Group();
  const rng = makeRng(777);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.94,
  });
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 9 + rng() * 12;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set((rng() - 0.5) * 34, (rng() - 0.5) * 5, (rng() - 0.5) * 16);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(
      (rng() - 0.5) * 2600,
      190 + rng() * 90,
      (rng() - 0.5) * 2600,
    );
    cloud.userData.drift = 1.5 + rng() * 2;
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

function buildWorld(scene) {
  buildSky(scene);
  const ocean = buildOcean(scene);
  buildTerrain(scene);
  for (const key of Object.keys(CONFIG.runways)) buildRunway(scene, key);
  buildTrees(scene);
  const clouds = buildClouds(scene);

  // Warm afternoon light + soft sky fill + a cool fill from the east so
  // shadowed slopes never read as a black wall.
  const sun = new THREE.DirectionalLight(0xfff0c8, 1.5);
  sun.position.set(-800, 900, -600);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd9ee, 0.55);
  fill.position.set(900, 500, 700);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x9cc8ee, 0x3f6b4a, 1.05));
  scene.fog = new THREE.Fog(0xa8c8e0, 700, 3400);

  return { ocean, clouds };
}
