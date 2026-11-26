// Archipelago Airmail — the flight model: arcade physics for the bush plane.
// One file, one job: turn pilot input into position, attitude and speed.

function createFlightState(mission) {
  const rw = CONFIG.runways[mission.startRunway];
  const headingRad = (rw.heading * Math.PI) / 180;
  return {
    // Position in metres; y is altitude above sea level.
    x: rw.x,
    y: terrainHeight(rw.x, rw.z) + 1.4, // resting on the gear
    z: rw.z,
    heading: headingRad, // radians, 0 = north (-z), grows clockwise
    pitch: 0, // radians, + = nose up
    roll: 0, // radians, + = right wing down
    speed: 0, // m/s forward
    throttle: 0, // 0..1
    fuel: mission.fuel,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    crashReason: '',
    landed: false,
    wind: mission.wind,
  };
}

// Pilot input: { pitchUp, pitchDown, rollLeft, rollRight, throttleUp,
// throttleDown } — booleans set by the keyboard handler each frame.
function stepFlight(state, input, dt) {
  if (state.crashed || state.landed) return;

  // --- Throttle -----------------------------------------------------------
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.7);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.7);

  // --- Attitude targets from input ----------------------------------------
  const maxPitch = (CONFIG.maxPitchDeg * Math.PI) / 180;
  const maxRoll = (CONFIG.maxRollDeg * Math.PI) / 180;
  let targetPitch = 0;
  let targetRoll = 0;
  if (input.pitchUp) targetPitch = maxPitch;
  if (input.pitchDown) targetPitch = -maxPitch * 0.8;
  if (input.rollLeft) targetRoll = -maxRoll;
  if (input.rollRight) targetRoll = maxRoll;

  // Attitude eases toward the target: heavy at low speed, crisp at speed.
  const agility = 1.6 + (state.speed / CONFIG.maxSpeed) * 2.2;
  state.pitch += (targetPitch - state.pitch) * Math.min(1, agility * dt);
  state.roll += (targetRoll - state.roll) * Math.min(1, agility * dt);

  // --- Speed ---------------------------------------------------------------
  const targetSpeed = state.throttle * CONFIG.maxSpeed;
  const accel = state.throttle > 0.05 ? 7 : 3.5;
  state.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - state.speed));

  // --- Heading: banked turns ----------------------------------------------
  const turnRate = Math.sin(state.roll) * CONFIG.turnRate * Math.min(1, state.speed / 25);
  state.heading += turnRate * dt;

  // --- Vertical motion ------------------------------------------------------
  const stalled = state.speed < CONFIG.stallSpeed;
  let climb = 0;
  if (state.onGround) {
    climb = 0; // rolling on the strip: glued to the ground
  } else {
    // Pitch converts speed into climb; a stall or idle throttle sinks.
    climb = Math.sin(state.pitch) * state.speed * 0.9;
    if (stalled) climb -= CONFIG.sinkRate * (1 - state.speed / CONFIG.stallSpeed);
    if (state.throttle < 0.08 && state.speed < CONFIG.cruiseSpeed) climb -= 1.5;
    climb = Math.max(-CONFIG.sinkRate * 1.6, Math.min(CONFIG.climbRate, climb));
  }
  state.verticalSpeed = climb;

  // --- Position -------------------------------------------------------------
  const forwardX = Math.sin(state.heading);
  const forwardZ = -Math.cos(state.heading);
  state.x += forwardX * state.speed * Math.cos(state.pitch) * dt;
  state.z += forwardZ * state.speed * Math.cos(state.pitch) * dt;
  state.y += climb * dt;

  // Wind pushes the plane sideways (missions 2 and 3).
  if (state.wind) {
    state.x += Math.sin(state.wind * 0.13) * state.wind * dt * 0.6;
    state.z += Math.cos(state.wind * 0.13) * state.wind * dt * 0.6;
  }

  // Stay inside the playable square: soft wall, turn the plane gently back.
  const half = CONFIG.worldSize / 2 - 40;
  if (Math.abs(state.x) > half || Math.abs(state.z) > half) {
    state.heading += Math.PI * 0.35 * dt;
    state.x = Math.max(-half, Math.min(half, state.x));
    state.z = Math.max(-half, Math.min(half, state.z));
  }

  // --- Fuel ------------------------------------------------------------------
  if (state.throttle > 0 && state.fuel > 0) {
    state.fuel = Math.max(0, state.fuel - CONFIG.fuelDrainPerSec * state.throttle * dt);
    if (state.fuel <= 0) state.throttle = 0; // out of fuel: glide only
  }

  // --- Ground / terrain contact ----------------------------------------------
  // A plane that is already on the ground stays glued to it and can only
  // lift off; only a plane coming down from the air gets its touchdown judged.
  const ground = terrainHeight(state.x, state.z);
  if (state.onGround) {
    state.y = ground + 1.4;
    // Rolling off a beach into the sea is a ditching, not a landing.
    if (ground <= 0.5) {
      state.crashed = true;
      state.crashReason = 'You ditched in the sea — the mail got wet.';
    }
    if (state.speed > CONFIG.stallSpeed + 4 && state.pitch > 0.08) {
      state.onGround = false;
    }
  } else if (state.y <= ground + 1.4) {
    // Touchdown: judge it as a landing or a crash. Water is never a runway.
    if (ground <= 0.5) {
      state.y = ground + 1.4;
      state.crashed = true;
      state.crashReason = 'You ditched in the sea — the mail got wet.';
      return;
    }
    state.y = ground + 1.4;
    state.onGround = true;
    state.verticalSpeed = 0;
    const hard = Math.abs(climb) > 4.5;
    const crooked = Math.abs(state.roll) > 0.35 || Math.abs(state.pitch) > 0.3;
    const fast = state.speed > 34;
    if (hard || crooked) {
      state.crashed = true;
      state.crashReason = hard
        ? 'You slammed into the ground — flare gently before touchdown.'
        : 'You touched down banked — keep the wings level to land.';
    } else if (fast) {
      state.crashed = true;
      state.crashReason = 'Too fast on touchdown — cut the throttle and bleed speed first.';
    } else {
      state.speed *= 0.92; // rolling out
      if (state.speed < 2) state.speed = 0;
    }
  }

  // Ditching in the sea.
  if (state.y <= CONFIG.oceanLevel + 1.2 && ground <= 0.5) {
    state.crashed = true;
    state.crashReason = 'You ditched in the sea — the mail got wet.';
  }
}

// Is the plane on the destination runway, slow and level? (landing check)
function checkLanding(state, mission) {
  const rw = CONFIG.runways[mission.destination];
  const headingRad = (rw.heading * Math.PI) / 180;
  const dx = state.x - rw.x;
  const dz = state.z - rw.z;
  const along = dx * Math.sin(headingRad) + dz * Math.cos(headingRad);
  const across = dx * Math.cos(headingRad) - dz * Math.sin(headingRad);
  const onStrip = Math.abs(along) < rw.length / 2 && Math.abs(across) < rw.width / 2 + 2;
  if (!onStrip || !state.onGround || state.crashed) return false;
  // Heading must roughly match the runway (either direction).
  let diff = Math.abs(state.heading - headingRad) % Math.PI;
  if (diff > Math.PI / 2) diff = Math.PI - diff;
  return diff < 0.5;
}
