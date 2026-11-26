// Archipelago Airmail — the game itself: state machine, input, camera,
// mission flow, scoring and the render loop. One file, one job: run the game.

const Game = {
  state: 'menu', // menu | flying | paused | landed | crashed | frozen (screenshot)
  missionIndex: 0,
  mission: null,
  flight: null,
  rings: [],
  fuelRings: [],
  ringsPassed: 0,
  score: 0,
  elapsed: 0,
  bestScore: 0,
  input: {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    throttleUp: false,
    throttleDown: false,
  },
  renderer: null,
  scene: null,
  camera: null,
  plane: null,
  world: null,
  clock: null,
  camPos: null,
  camLook: null,
};

function $(id) {
  return document.getElementById(id);
}

function initGame() {
  const canvas = $('game-canvas');
  Game.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  Game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  Game.renderer.setSize(window.innerWidth, window.innerHeight);
  Game.scene = new THREE.Scene();
  Game.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 9000);
  Game.world = buildWorld(Game.scene);
  Game.plane = buildPlane();
  Game.scene.add(Game.plane);
  Game.clock = new THREE.Clock();
  Game.camPos = new THREE.Vector3(0, 40, 40);
  Game.camLook = new THREE.Vector3(0, 10, 0);
  initHud();
  bindInput();
  bindMenu();
  window.addEventListener('resize', onResize);

  // Debug handle for automated play-testing (read-only state inspection).
  window.__airmail = Game;

  // Screenshot mode: ?autostart=1&shot=N jumps straight into a live moment.
  // &freeze=1 holds that exact moment (no flight advance) so screenshots
  // are deterministic renders of the preset state.
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    const shot = parseInt(params.get('shot') || '1', 10);
    startMission(0);
    applyShotPreset(shot);
    $('hud').style.display = 'block';
    Game.state = params.get('freeze') === '1' ? 'frozen' : 'flying';
  } else {
    showMenu();
  }
  Game.renderer.setAnimationLoop(tick);
}

function onResize() {
  Game.camera.aspect = window.innerWidth / window.innerHeight;
  Game.camera.updateProjectionMatrix();
  Game.renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Menu and overlays ------------------------------------------------------

function showMenu() {
  Game.state = 'menu';
  $('hud').style.display = 'none';
  $('menu').style.display = 'flex';
  $('end-screen').style.display = 'none';
  $('pause-screen').style.display = 'none';
  renderMissionList();
  // Park the camera for a slow orbit over Coral Bay behind the menu.
  const t = performance.now() / 1000;
  Game.camera.position.set(Math.sin(t * 0.05) * 320, 130, Math.cos(t * 0.05) * 320);
  Game.camera.lookAt(0, 10, 0);
}

function renderMissionList() {
  const list = $('mission-list');
  list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const card = document.createElement('button');
    card.className = 'mission-card';
    card.innerHTML =
      '<b>' + m.id + '. ' + m.name + '</b>' +
      '<span>' + m.rings.length + ' rings · wind ' + m.wind + ' m/s · fuel ' + m.fuel + '%</span>' +
      '<span class="brief">' + m.briefing + '</span>';
    card.addEventListener('click', () => {
      AudioSys.init();
      AudioSys.resume();
      startMission(i);
    });
    list.appendChild(card);
  });
}

function bindMenu() {
  $('btn-fly').addEventListener('click', () => {
    AudioSys.init();
    AudioSys.resume();
    startMission(Game.missionIndex);
  });
  $('btn-again').addEventListener('click', () => startMission(Game.missionIndex));
  $('btn-menu').addEventListener('click', showMenu);
  $('btn-next').addEventListener('click', () => {
    const next = Math.min(MISSIONS.length - 1, Game.missionIndex + 1);
    startMission(next);
  });
  $('btn-resume').addEventListener('click', () => {
    Game.state = 'flying';
    $('pause-screen').style.display = 'none';
  });
  $('btn-restart').addEventListener('click', () => {
    $('pause-screen').style.display = 'none';
    startMission(Game.missionIndex);
  });
  $('btn-quit').addEventListener('click', showMenu);
  $('btn-mute').addEventListener('click', () => {
    const muted = AudioSys.toggleMute();
    $('btn-mute').textContent = muted ? 'Sound: OFF' : 'Sound: ON';
  });
}

// --- Mission flow -----------------------------------------------------------

// Put the chase camera exactly where it belongs behind the plane, so the
// first frame is already framed (no slow lerp across the map).
function snapCamera() {
  const f = Game.flight;
  const backX = -Math.sin(f.heading);
  const backZ = Math.cos(f.heading);
  Game.camPos.set(
    f.x + backX * CONFIG.cameraDistance,
    f.y + CONFIG.cameraHeight,
    f.z + backZ * CONFIG.cameraDistance,
  );
  Game.camLook.set(f.x, f.y + 1, f.z);
  Game.camera.position.copy(Game.camPos);
  Game.camera.lookAt(Game.camLook);
}

function startMission(index) {
  Game.missionIndex = index;
  Game.mission = MISSIONS[index];
  // Clear the previous mission's rings from the scene.
  for (const r of Game.rings) Game.scene.remove(r.mesh);
  for (const r of Game.fuelRings) Game.scene.remove(r.mesh);
  Game.rings = buildMissionRings(Game.scene, Game.mission);
  Game.fuelRings = buildFuelRings(Game.scene);
  Game.flight = createFlightState(Game.mission);
  Game.ringsPassed = 0;
  Game.score = 0;
  Game.elapsed = 0;
  Game.state = 'flying';
  $('menu').style.display = 'none';
  $('end-screen').style.display = 'none';
  $('pause-screen').style.display = 'none';
  $('hud').style.display = 'block';
  setObjective(
    'Mission ' + Game.mission.id + ' — ' + Game.mission.name + ': fly the rings, then land at ' +
      CONFIG.runways[Game.mission.destination].name + '.',
  );
  showMessage('Throttle up with SHIFT — lift off past 60 km/h!', 5);
  snapCamera();
  updateHud(Game.flight, Game);
}

function endMission(landed, reason) {
  const timePenalty = Math.round(Game.elapsed * CONFIG.timePenaltyPerSec);
  let landingBonus = 0;
  if (landed) {
    // Soft, centred, slow touchdowns pay best.
    const f = Game.flight;
    const soft = Math.max(0, 1 - Math.abs(f.verticalSpeed) / 4.5);
    const slow = Math.max(0, 1 - Math.max(0, f.speed - 12) / 22);
    landingBonus = Math.round(CONFIG.landingBonusMax * (soft * 0.6 + slow * 0.4));
  }
  const finalScore = Game.ringsPassed * CONFIG.ringScore + landingBonus - timePenalty;
  Game.score = Math.max(0, finalScore);
  Game.bestScore = Math.max(Game.bestScore, Game.score);
  Game.state = landed ? 'landed' : 'crashed';
  AudioSys.update(0, 0, false);
  if (landed) AudioSys.fanfare();
  else AudioSys.crash();

  const title = $('end-title');
  const body = $('end-body');
  if (landed) {
    title.textContent = 'Mail delivered!';
    body.innerHTML =
      'Landed at ' + CONFIG.runways[Game.mission.destination].name + ' with the mail intact.<br>' +
      'Rings: ' + Game.ringsPassed + '/' + Game.rings.length + ' (+' + Game.ringsPassed * CONFIG.ringScore + ')<br>' +
      'Landing bonus: +' + landingBonus + ' &nbsp;·&nbsp; Time penalty: −' + timePenalty + '<br>' +
      '<b>Score: ' + Game.score + '</b> &nbsp;·&nbsp; Best: ' + Game.bestScore;
    $('btn-next').style.display = Game.missionIndex < MISSIONS.length - 1 ? 'inline-block' : 'none';
  } else {
    title.textContent = 'Crashed! ' + (reason || 'You crashed.');
    body.innerHTML =
      'Rings: ' + Game.ringsPassed + '/' + Game.rings.length + ' &nbsp;·&nbsp; Score: ' + Game.score +
      '<br>Tip: keep the wings level, flare gently, and land slow on the strip.';
    $('btn-next').style.display = 'none';
  }
  $('end-screen').style.display = 'flex';
}

// --- Input -------------------------------------------------------------------

function bindInput() {
  const keymap = {
    ArrowUp: 'pitchUp',
    KeyW: 'throttleUp',
    ArrowDown: 'pitchDown',
    KeyS: 'throttleDown',
    ArrowLeft: 'rollLeft',
    KeyA: 'rollLeft',
    ArrowRight: 'rollRight',
    KeyD: 'rollRight',
    ShiftLeft: 'throttleUp',
    ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown',
    ControlRight: 'throttleDown',
    KeyC: 'throttleDown',
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (Game.state === 'flying') {
        Game.state = 'paused';
        $('pause-screen').style.display = 'flex';
      } else if (Game.state === 'paused') {
        Game.state = 'flying';
        $('pause-screen').style.display = 'none';
      }
      return;
    }
    if (e.code === 'KeyM') {
      const muted = AudioSys.toggleMute();
      $('btn-mute').textContent = muted ? 'Sound: OFF' : 'Sound: ON';
      return;
    }
    if (e.code === 'Enter' && Game.state === 'menu') {
      startMission(Game.missionIndex);
      return;
    }
    const action = keymap[e.code];
    if (action) {
      Game.input[action] = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = keymap[e.code];
    if (action) Game.input[action] = false;
  });
  // Mouse: drag on the canvas to nudge pitch/roll (gentle, for mouse players).
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const canvas = $('game-canvas');
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (!dragging || Game.state !== 'flying') return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    Game.flight.roll = Math.max(-0.9, Math.min(0.9, Game.flight.roll + dx * 0.002));
    Game.flight.pitch = Math.max(-0.45, Math.min(0.45, Game.flight.pitch - dy * 0.0015));
  });
}

// --- Screenshot presets -------------------------------------------------------
// Real gameplay moments, frozen by URL params for the maker's screenshots.

function applyShotPreset(shot) {
  const f = Game.flight;
  const dest = CONFIG.runways[Game.mission.destination];
  // Airborne presets must clear the runway-spawn onGround flag, or the
  // first tick snaps the plane back down to the terrain.
  f.onGround = false;
  if (shot === 2) {
    // Takeoff roll on the home runway, throttle firewalled.
    f.onGround = true;
    f.throttle = 1;
    f.speed = 26;
    f.pitch = 0.06;
    showMessage('CORAL BAY — runway 09, cleared for takeoff', 6);
  } else if (shot === 3) {
    // Low pass along the Palm Cay beach, fuel ring ahead, palms below.
    f.x = -560;
    f.z = 260;
    f.y = 65;
    f.heading = (20 * Math.PI) / 180;
    f.speed = 44;
    f.throttle = 0.72;
    f.pitch = 0.02;
    Game.ringsPassed = 2;
    Game.score = 200;
    showMessage('Low pass over Palm Cay — fuel ring ahead', 6);
  } else if (shot === 4) {
    // Final approach: destination runway ahead, gear down, on glide path.
    // High enough (90 m) that the strip reads over the island's rise.
    const hdg = (dest.heading * Math.PI) / 180;
    f.x = dest.x - Math.sin(hdg) * 260;
    f.z = dest.z - Math.cos(hdg) * 260;
    f.y = 90;
    f.heading = hdg;
    f.speed = 30;
    f.throttle = 0.42;
    f.pitch = -0.05;
    Game.ringsPassed = 4;
    Game.score = 400;
    setObjective('Final approach — land at ' + dest.name + '. Flare gently!');
    showMessage('FINAL — ' + dest.name.toUpperCase() + ' runway ahead', 6);
  } else {
    // Cover shot: 70 m before the second ring, islands and ocean below.
    const r = Game.mission.rings[1];
    const prev = Game.mission.rings[0];
    const dx = r.x - prev.x;
    const dz = r.z - prev.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    f.x = r.x - (dx / len) * 70;
    f.y = r.y + 4;
    f.z = r.z - (dz / len) * 70;
    f.heading = Math.atan2(dx, -dz);
    f.speed = 46;
    f.throttle = 0.78;
    f.pitch = 0.03;
    Game.ringsPassed = 1;
    Game.score = 100;
    showMessage('Ring 2 ahead — thread it clean', 6);
  }
  snapCamera();
  updateHud(f, Game);
}

// --- Main loop -----------------------------------------------------------------

function tick() {
  const dt = Math.min(0.05, Game.clock.getDelta());
  const time = Game.clock.elapsedTime;

  // Frozen screenshot moment: render the preset state, advance nothing.
  if (Game.state === 'frozen') {
    const f = Game.flight;
    Game.plane.position.set(f.x, f.y, f.z);
    Game.plane.rotation.order = 'YXZ';
    Game.plane.rotation.y = f.heading;
    Game.plane.rotation.x = -f.pitch;
    Game.plane.rotation.z = -f.roll;
    Game.plane.userData.propeller.rotation.z += 0.12;
    snapCamera();
    updateHud(f, Game);
    Game.renderer.render(Game.scene, Game.camera);
    return;
  }

  if (Game.state === 'menu') {
    // Slow cinematic orbit while the menu is up.
    const t = performance.now() / 1000;
    Game.camera.position.set(Math.sin(t * 0.04) * 380, 175, Math.cos(t * 0.04) * 380);
    Game.camera.lookAt(0, 12, 0);
    Game.plane.position.set(0, terrainHeight(0, -40) + 1.6, -40);
    Game.plane.rotation.set(0, Math.PI / 2, 0);
    Game.plane.userData.propeller.rotation.z += dt * 6;
    animateRings([], [], time);
    Game.world.clouds.children.forEach((c) => {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1400) c.position.x = -1400;
    });
    Game.renderer.render(Game.scene, Game.camera);
    return;
  }

  if (Game.state === 'flying') {
    const f = Game.flight;
    Game.elapsed += dt;
    stepFlight(f, Game.input, dt);
    AudioSys.update(f.throttle, f.speed, true);

    // Ring collection.
    const next = Game.rings[Game.ringsPassed];
    if (next && ringCaught(next, f)) {
      next.passed = true;
      hideRing(next);
      Game.ringsPassed++;
      Game.score += CONFIG.ringScore;
      AudioSys.ring();
      if (Game.ringsPassed >= Game.rings.length) {
        setObjective('All rings flown! Land at ' + CONFIG.runways[Game.mission.destination].name + '.');
        showMessage('All rings! Now land at ' + CONFIG.runways[Game.mission.destination].name, 4);
      } else {
        showMessage('Ring ' + Game.ringsPassed + '/' + Game.rings.length + ' — +' + CONFIG.ringScore, 2);
      }
    }
    for (const fr of Game.fuelRings) {
      if (!fr.taken && fuelRingCaught(fr, f)) {
        fr.taken = true;
        hideRing(fr);
        f.fuel = Math.min(100, f.fuel + CONFIG.fuelRingBonus);
        AudioSys.fuel();
        showMessage('Fuel +30% — tank topped up', 3);
      }
    }

    // Landing / crash outcomes.
    if (f.crashed) {
      endMission(false, f.crashReason);
    } else if (
      f.onGround &&
      checkLanding(f, Game.mission) &&
      Game.ringsPassed >= Game.rings.length
    ) {
      // Down on the destination strip with every ring flown: mail delivered.
      // (A gentle touchdown already proved itself in stepFlight; a player
      // who lands early can throttle up and take off again.)
      f.landed = true;
      endMission(true);
    } else if (f.onGround && f.speed < 3 && Game.ringsPassed >= Game.rings.length) {
      // Landed somewhere flat but not on the strip: survivable, not a delivery.
      showMessage('You are down, but not on the runway — take off and try the strip.', 5);
      f.speed = 0;
    }

    // Sync the 3D plane to the flight state.
    Game.plane.position.set(f.x, f.y, f.z);
    Game.plane.rotation.order = 'YXZ';
    Game.plane.rotation.y = f.heading;
    Game.plane.rotation.x = -f.pitch;
    Game.plane.rotation.z = -f.roll;
    Game.plane.userData.propeller.rotation.z += dt * (4 + f.throttle * 46);

    // Chase camera: behind and above, smoothed, speed-kicked FOV.
    const backX = -Math.sin(f.heading);
    const backZ = Math.cos(f.heading);
    const targetPos = new THREE.Vector3(
      f.x + backX * CONFIG.cameraDistance - Math.sin(f.heading + Math.PI / 2) * f.roll * 2,
      f.y + CONFIG.cameraHeight - f.pitch * 4,
      f.z + backZ * CONFIG.cameraDistance,
    );
    Game.camPos.lerp(targetPos, CONFIG.cameraSmoothing);
    Game.camera.position.copy(Game.camPos);
    const lookTarget = new THREE.Vector3(f.x, f.y + 1, f.z);
    Game.camLook.lerp(lookTarget, 0.25);
    Game.camera.lookAt(Game.camLook);
    Game.camera.fov = 66 + (f.speed / CONFIG.maxSpeed) * 10;
    Game.camera.updateProjectionMatrix();

    animateRings(Game.rings, Game.fuelRings, time);
    Game.world.clouds.children.forEach((c) => {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1400) c.position.x = -1400;
    });
    updateHud(f, Game);
  }

  Game.renderer.render(Game.scene, Game.camera);
}

window.addEventListener('DOMContentLoaded', initGame);
