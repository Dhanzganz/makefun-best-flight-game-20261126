// Archipelago Airmail — sound, all synthesised with WebAudio: no audio
// files, nothing loads over the network. One file, one job: engine hum,
// wind, ring chimes, landing fanfare and the crash thud.

const AudioSys = {
  ctx: null,
  engineOsc: null,
  engineGain: null,
  windGain: null,
  muted: false,
  started: false,

  init() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      return; // audio unavailable: the game plays silent, never crashes
    }
    this.started = true;

    // Engine: two detuned sawtooths through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 55.7;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    osc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    osc2.start();
    this.osc2 = osc2;

    // Wind: looped filtered noise, gain tied to airspeed.
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    noise.start();
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Called every frame while flying: engine pitch follows throttle.
  update(throttle, speed, flying) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const target = flying ? 0.05 + throttle * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.15);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 70, t, 0.2);
    this.osc2.frequency.setTargetAtTime(48.6 + throttle * 71, t, 0.2);
    const wind = flying ? Math.min(0.11, (speed / CONFIG.maxSpeed) * 0.11) : 0;
    this.windGain.gain.setTargetAtTime(wind, t, 0.25);
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const g = this.muted ? 0 : 1;
      this.ctx.destination.gain && 0; // master stays; per-node gains mute
      if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : 0.05;
      if (this.windGain) this.windGain.gain.value = 0;
    }
    return this.muted;
  },

  blip(freq, dur, type, vol, when) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  ring() {
    this.blip(880, 0.35, 'sine', 0.22);
    this.blip(1318, 0.45, 'sine', 0.18, 0.09);
  },

  fuel() {
    this.blip(659, 0.25, 'triangle', 0.2);
    this.blip(988, 0.35, 'triangle', 0.18, 0.08);
  },

  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.blip(n, 0.5, 'triangle', 0.2, i * 0.13));
  },

  crash() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t0);
    this.blip(70, 0.6, 'sine', 0.4);
  },
};
