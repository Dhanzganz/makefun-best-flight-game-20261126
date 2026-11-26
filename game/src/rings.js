// Archipelago Airmail — target rings and fuel rings: the glowing gates
// the pilot flies through, and the green rings that refill the tank.
// One file, one job: build the rings, animate them, detect fly-throughs.

// A camera-facing label sprite (canvas texture on a THREE.Sprite).
function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10243a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
}

function buildRingMesh(x, y, z, radius, color, label) {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 1.1, 12, 40),
    new THREE.MeshBasicMaterial({ color }),
  );
  group.add(torus);
  // Inner glow disc, faint so the pilot can see through the gate.
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(radius - 1, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    }),
  );
  group.add(glow);
  // Number board floating above the ring — a sprite, so it always faces
  // the pilot and never reads mirrored from behind.
  if (label) {
    const sprite = makeLabelSprite(label);
    sprite.scale.set(14, 3.5, 1);
    sprite.position.y = radius + 7;
    group.add(sprite);
  }
  group.position.set(x, y, z);
  // Face the ring toward the pilot's approach: rings sit upright, facing
  // the previous ring (or the start runway for the first one).
  group.userData.spin = Math.random() * Math.PI * 2;
  return group;
}

function buildMissionRings(scene, mission) {
  const rings = mission.rings.map((pos, i) => {
    const mesh = buildRingMesh(pos.x, pos.y, pos.z, CONFIG.ringRadius, 0xffb020, String(i + 1));
    // Aim each ring at the next waypoint so the pilot flies through it, not past it.
    const next = mission.rings[i + 1] || CONFIG.runways[mission.destination];
    mesh.lookAt(next.x, next.y, next.z);
    scene.add(mesh);
    return { ...pos, radius: CONFIG.ringRadius, mesh, passed: false, index: i };
  });
  return rings;
}

function buildFuelRings(scene) {
  return FUEL_RINGS.map((pos) => {
    const mesh = buildRingMesh(pos.x, pos.y, pos.z, 12, 0x2fd35a, 'FUEL');
    mesh.lookAt(0, pos.y, 0);
    scene.add(mesh);
    return { ...pos, radius: 12, mesh, taken: false };
  });
}

// A ring counts when the plane comes within the catch radius of its centre.
function ringCaught(ring, state) {
  const dx = state.x - ring.x;
  const dy = state.y - ring.y;
  const dz = state.z - ring.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < CONFIG.ringCatchRadius;
}

function fuelRingCaught(ring, state) {
  const dx = state.x - ring.x;
  const dy = state.y - ring.y;
  const dz = state.z - ring.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < 13;
}

// Rings pulse and slowly spin so they read as alive in still screenshots.
function animateRings(rings, fuelRings, time) {
  for (const ring of rings) {
    if (ring.passed) continue;
    const s = 1 + Math.sin(time * 2.4 + ring.index) * 0.045;
    ring.mesh.scale.set(s, s, s);
  }
  for (const ring of fuelRings) {
    if (ring.taken) continue;
    const s = 1 + Math.sin(time * 3.1) * 0.06;
    ring.mesh.scale.set(s, s, s);
  }
}

function hideRing(ring) {
  ring.mesh.visible = false;
}
