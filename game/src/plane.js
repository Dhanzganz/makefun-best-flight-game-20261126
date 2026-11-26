// Archipelago Airmail — the aircraft: a red-and-cream bush plane built
// from primitives, with a spinning propeller and an AIRMAIL fuselage decal.
// One file, one job: the plane's look and its propeller animation.

function buildPlane() {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f33 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd4e8,
    shininess: 140,
    specular: 0xffffff,
  });

  // Fuselage: cream body with a red tail cone.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  group.add(fuselage);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.12, 2.2, 12), red);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = -2.6;
  group.add(tailCone);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.9, 12), red);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.5;
  group.add(nose);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10), glass);
  canopy.scale.set(1, 0.72, 1.5);
  canopy.position.set(0, 0.62, 1.15);
  group.add(canopy);

  // Main wing (high wing, red with cream tips) and struts.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.22, 1.7), red);
  wing.position.set(0, 0.85, 0.9);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.7), cream);
    tip.position.set(side * 4.45, 0.85, 0.9);
    group.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), dark);
    strut.position.set(side * 1.7, 0.1, 0.9);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: horizontal stabiliser + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.1), red);
  stab.position.set(0, 0.25, -3.4);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 1.0), red);
  fin.position.set(0, 0.62, -3.4);
  fin.rotation.x = -0.25;
  group.add(fin);

  // Fixed landing gear: two wheels + tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), dark);
    leg.position.set(side * 0.8, -0.75, 1.6);
    leg.rotation.z = side * 0.35;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.0, -1.25, 1.6);
    group.add(wheel);
  }

  // Propeller: hub + two blades, spun by the animation loop.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dark);
  prop.add(hub);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const flip of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.08), bladeMat);
    blade.rotation.z = flip;
    blade.position.y = 0;
    prop.add(blade);
  }
  // Blur disc so the prop reads as spinning even in a still screenshot.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.75, 24),
    new THREE.MeshBasicMaterial({
      color: 0xbbbbbb,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
    }),
  );
  prop.add(disc);
  prop.position.set(0, 0, 4.05);
  group.add(prop);

  // AIRMAIL decal on both fuselage sides, drawn on a canvas texture.
  const decal = makeDecal('AIRMAIL ✈');
  for (const side of [-1, 1]) {
    const d = decal.clone();
    d.position.set(side * 0.88, 0.1, 0.6);
    d.rotation.y = side * (Math.PI / 2);
    if (side < 0) d.rotation.y = -Math.PI / 2;
    group.add(d);
  }

  group.userData.propeller = prop;
  return group;
}

function makeDecal(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = '#c23b2e';
  ctx.font = 'bold 58px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.64),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
}
