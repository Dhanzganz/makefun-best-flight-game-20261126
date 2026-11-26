// Archipelago Airmail — the HUD: altitude, speed, heading, fuel, throttle
// and the little attitude indicator, all as DOM so they stay crisp and lit
// in screenshots. One file, one job: read the flight state, paint the HUD.

const hud = {
  alt: null,
  spd: null,
  hdg: null,
  vs: null,
  fuelBar: null,
  fuelText: null,
  thrBar: null,
  thrText: null,
  objective: null,
  rings: null,
  score: null,
  timer: null,
  message: null,
  attitude: null,
  attitudeCtx: null,
  compass: null,
  messageTimer: 0,
};

function initHud() {
  hud.alt = document.getElementById('hud-alt');
  hud.spd = document.getElementById('hud-spd');
  hud.hdg = document.getElementById('hud-hdg');
  hud.vs = document.getElementById('hud-vs');
  hud.fuelBar = document.getElementById('fuel-fill');
  hud.fuelText = document.getElementById('fuel-text');
  hud.thrBar = document.getElementById('thr-fill');
  hud.thrText = document.getElementById('thr-text');
  hud.objective = document.getElementById('hud-objective');
  hud.rings = document.getElementById('hud-rings');
  hud.score = document.getElementById('hud-score');
  hud.timer = document.getElementById('hud-timer');
  hud.message = document.getElementById('hud-message');
  hud.attitude = document.getElementById('attitude');
  hud.attitudeCtx = hud.attitude.getContext('2d');
  hud.compass = document.getElementById('compass-strip');
}

function headingDegrees(headingRad) {
  let deg = (headingRad * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return Math.round(deg);
}

function compassPoint(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function drawAttitude(state) {
  const ctx = hud.attitudeCtx;
  const w = hud.attitude.width;
  const h = hud.attitude.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.clip();
  // Sky / ground halves, rotated by bank and shifted by pitch.
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll);
  const pitchShift = state.pitch * 90;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-60, -60 + pitchShift, 120, 60);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-60, pitchShift, 120, 60);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-60, pitchShift);
  ctx.lineTo(60, pitchShift);
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol + bezel.
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCompassStrip(deg) {
  // A sliding strip of cardinal marks centred on the current heading.
  const marks = [];
  for (let d = -60; d <= 60; d += 15) {
    const h = ((Math.round(deg) + d) % 360 + 360) % 360;
    const label = h % 90 === 0 ? compassPoint(h) : String(h).padStart(3, '0');
    const left = 50 + (d / 60) * 46;
    marks.push(
      '<span style="left:' + left.toFixed(1) + '%">' + label + '</span>',
    );
  }
  hud.compass.innerHTML = marks.join('');
}

function updateHud(state, game) {
  if (!hud.alt) return;
  const deg = headingDegrees(state.heading);
  hud.alt.textContent = Math.max(0, Math.round(state.y)) + ' m';
  hud.spd.textContent = Math.round(state.speed * 3.6) + ' km/h';
  hud.hdg.textContent = String(deg).padStart(3, '0') + '° ' + compassPoint(deg);
  const vs = state.verticalSpeed;
  hud.vs.textContent = (vs >= 0 ? '+' : '') + vs.toFixed(1) + ' m/s';
  hud.vs.style.color = vs >= 0 ? '#7dff9a' : '#ffb020';

  hud.fuelBar.style.width = Math.max(0, state.fuel) + '%';
  hud.fuelBar.style.background = state.fuel < 25 ? '#ff5340' : '#2fd35a';
  hud.fuelText.textContent = 'FUEL ' + Math.round(state.fuel) + '%';
  hud.thrBar.style.width = Math.round(state.throttle * 100) + '%';
  hud.thrText.textContent = 'THR ' + Math.round(state.throttle * 100) + '%';

  hud.rings.textContent = game.ringsPassed + '/' + game.rings.length;
  hud.score.textContent = String(game.score);
  hud.timer.textContent = formatTime(game.elapsed);

  drawAttitude(state);
  drawCompassStrip(deg);

  if (hud.messageTimer > 0) {
    hud.messageTimer -= 1 / 60;
    if (hud.messageTimer <= 0) hud.message.style.opacity = '0';
  }
}

function showMessage(text, seconds) {
  if (!hud.message) return;
  hud.message.textContent = text;
  hud.message.style.opacity = '1';
  hud.messageTimer = seconds || 3;
}

function setObjective(text) {
  if (hud.objective) hud.objective.textContent = text;
}
