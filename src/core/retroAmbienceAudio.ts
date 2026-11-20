/**
 * Zero-dependency Procedural Web Audio Engine for Year-2000 Tropical Ambience Apps:
 * - Royal Hawaii 3D Cocktail Lounge (gentle ocean surf swell, ice clinks, liquid pour, straw sip, umbrella flick)
 * - Palm Bath 2000 Pixel Bathhouse (soft tropical rain on palm leaves, warm steam shower spray, serene slow lo-fi spa chords)
 */

function createSoftBrownPinkNoiseBuffer(ctx: AudioContext, durationSec = 5): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let smooth = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.095;
    b6 = white * 0.115926;
    // Slight warm smoothing to eliminate harsh digital hiss
    smooth = smooth * 0.35 + pink * 0.65;
    data[i] = smooth;
  }
  return buffer;
}

export class CocktailAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private surfGain: GainNode | null = null;
  private surfFilter: BiquadFilterNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private enabled = true;
  private sysLevel = 0.75;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.enabled ? this.sysLevel * 0.52 : 0;
        this.masterGain.connect(this.ctx.destination);

        const noiseBuf = createSoftBrownPinkNoiseBuffer(this.ctx, 5);
        this.noiseSrc = this.ctx.createBufferSource();
        this.noiseSrc.buffer = noiseBuf;
        this.noiseSrc.loop = true;

        this.surfFilter = this.ctx.createBiquadFilter();
        this.surfFilter.type = 'lowpass';
        this.surfFilter.frequency.value = 520;

        this.surfGain = this.ctx.createGain();
        this.surfGain.gain.value = 0.13;

        this.lfoOsc = this.ctx.createOscillator();
        this.lfoOsc.type = 'sine';
        this.lfoOsc.frequency.value = 0.12;
        const lfoDepth = this.ctx.createGain();
        lfoDepth.gain.value = 0.065;
        this.lfoOsc.connect(lfoDepth);
        lfoDepth.connect(this.surfGain.gain);

        this.noiseSrc.connect(this.surfFilter);
        this.surfFilter.connect(this.surfGain);
        this.surfGain.connect(this.masterGain);

        this.noiseSrc.start();
        this.lfoOsc.start();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public syncVolume(systemVolumePct: number, systemMuted: boolean, appSoundEnabled: boolean) {
    this.enabled = appSoundEnabled;
    this.sysLevel = systemMuted ? 0 : Math.max(0, Math.min(1, systemVolumePct / 100));
    if (this.masterGain && this.ctx) {
      const target = this.enabled ? this.sysLevel * 0.52 : 0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  public setBeachMood(mood: 'noon' | 'sunset' | 'torch') {
    const ctx = this.ensureContext();
    if (!ctx || !this.surfFilter) return;
    const freq = mood === 'noon' ? 600 : mood === 'sunset' ? 470 : 390;
    this.surfFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.25);
  }

  public playIceClink(count = 2) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const now = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.065;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const base = 1780 + Math.random() * 440;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(base * 1.46, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.13);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.15);
      osc2.stop(t + 0.15);
    }
  }

  public playPour() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.24);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playSip(nearEmpty = false) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(nearEmpty ? 420 : 380, now);
    osc.frequency.exponentialRampToValueAtTime(nearEmpty ? 640 : 230, now + 0.18);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playUmbrellaFlick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public dispose() {
    try {
      this.noiseSrc?.stop();
      this.lfoOsc?.stop();
      void this.ctx?.close().catch(() => {});
    } catch {
      // ignore already closed
    }
    this.ctx = null;
  }
}

// Slow, warm, deeply atmospheric bathhouse ambient voicings (low-register lush maj7/add9 pads)
const AMBIENT_CHORD_PADS: number[][][] = [
  // Station 0: Rainy Palm Night Ambient (Fmaj9 -> Em7 -> Dm9 -> Cmaj9)
  [
    [174.61, 220.0, 261.63, 329.63],
    [164.81, 196.0, 246.94, 293.66],
    [146.83, 220.0, 261.63, 329.63],
    [130.81, 196.0, 246.94, 293.66],
  ],
  // Station 1: Warm Spring Spa Rhodes (Dmaj7 -> Bm7 -> Gmaj7 -> A6)
  [
    [146.83, 220.0, 277.18, 369.99],
    [123.47, 185.0, 220.0, 293.66],
    [196.0, 246.94, 293.66, 369.99],
    [164.81, 220.0, 277.18, 329.63],
  ],
  // Station 2: Distant Ocean Breeze Chimes (Pentatonic low-pass whispers)
  [
    [261.63, 329.63, 392.0],
    [220.0, 293.66, 392.0],
    [196.0, 261.63, 329.63],
    [174.61, 261.63, 329.63],
  ],
];

export class BathhouseAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private showerGain: GainNode | null = null;
  private showerFilter: BiquadFilterNode | null = null;
  private windowGain: GainNode | null = null;
  private windowFilter: BiquadFilterNode | null = null;
  private swellLfo: OscillatorNode | null = null;
  private noiseSrcA: AudioBufferSourceNode | null = null;
  private noiseSrcB: AudioBufferSourceNode | null = null;
  private radioTimer: number | null = null;
  private radioStep = 0;
  private radioStation = 0;
  private radioOn = false;
  private enabled = true;
  private sysLevel = 0.75;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.enabled ? this.sysLevel * 0.45 : 0;
        this.masterGain.connect(this.ctx.destination);

        const buf = createSoftBrownPinkNoiseBuffer(this.ctx, 5);

        // Warm misty shower spray channel (soft low-mid filtered steam/water)
        this.noiseSrcA = this.ctx.createBufferSource();
        this.noiseSrcA.buffer = buf;
        this.noiseSrcA.loop = true;
        this.showerFilter = this.ctx.createBiquadFilter();
        this.showerFilter.type = 'lowpass';
        this.showerFilter.frequency.value = 920;
        this.showerFilter.Q.value = 0.4;
        this.showerGain = this.ctx.createGain();
        this.showerGain.gain.value = 0;
        this.noiseSrcA.connect(this.showerFilter);
        this.showerFilter.connect(this.showerGain);
        this.showerGain.connect(this.masterGain);

        // Window tropical rain & distant coastal breeze channel (warm mellow rain patter)
        this.noiseSrcB = this.ctx.createBufferSource();
        this.noiseSrcB.buffer = buf;
        this.noiseSrcB.loop = true;
        this.windowFilter = this.ctx.createBiquadFilter();
        this.windowFilter.type = 'lowpass';
        this.windowFilter.frequency.value = 680;
        this.windowGain = this.ctx.createGain();
        this.windowGain.gain.value = 0.08;

        // Gentle breathing swell LFO on window rain/breeze for organic immersion
        this.swellLfo = this.ctx.createOscillator();
        this.swellLfo.type = 'sine';
        this.swellLfo.frequency.value = 0.09;
        const lfoDepth = this.ctx.createGain();
        lfoDepth.gain.value = 0.025;
        this.swellLfo.connect(lfoDepth);
        lfoDepth.connect(this.windowGain.gain);

        this.noiseSrcB.connect(this.windowFilter);
        this.windowFilter.connect(this.windowGain);
        this.windowGain.connect(this.masterGain);

        this.noiseSrcA.start();
        this.noiseSrcB.start(0, 1.7);
        this.swellLfo.start();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public syncEnvironment(opts: {
    systemVolumePct: number;
    systemMuted: boolean;
    appSoundEnabled: boolean;
    showerMode: 'off' | 'cold' | 'warm' | 'hot';
    tubFilling: boolean;
    windowOpen: boolean;
    weather: 'sunny' | 'rain';
    radioOn: boolean;
    radioStation: number;
  }) {
    this.enabled = opts.appSoundEnabled;
    this.sysLevel = opts.systemMuted ? 0 : Math.max(0, Math.min(1, opts.systemVolumePct / 100));
    const ctx = this.ensureContext();
    if (
      !ctx ||
      !this.masterGain ||
      !this.showerGain ||
      !this.showerFilter ||
      !this.windowGain ||
      !this.windowFilter
    ) {
      return;
    }

    const now = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.enabled ? this.sysLevel * 0.45 : 0, now, 0.14);

    // Gentle, relaxing water spray rather than loud static
    const showerActive = opts.showerMode !== 'off';
    const sprayLevel = showerActive ? 0.12 : 0;
    const sprayFreq = opts.showerMode === 'hot' ? 860 : 1120;
    this.showerGain.gain.setTargetAtTime(sprayLevel, now, 0.18);
    this.showerFilter.frequency.setTargetAtTime(sprayFreq, now, 0.18);

    // Warm tropical rainfall / soft sea breeze outside window
    const isRain = opts.weather === 'rain';
    const winCutoff = opts.windowOpen ? (isRain ? 1050 : 620) : isRain ? 420 : 280;
    const winVol = opts.windowOpen ? (isRain ? 0.18 : 0.08) : isRain ? 0.09 : 0.035;
    this.windowFilter.frequency.setTargetAtTime(winCutoff, now, 0.25);
    this.windowGain.gain.setTargetAtTime(winVol, now, 0.25);

    this.radioStation = opts.radioStation % AMBIENT_CHORD_PADS.length;
    if (opts.radioOn && !this.radioOn) {
      this.radioOn = true;
      this.startRadioLoop();
    } else if (!opts.radioOn && this.radioOn) {
      this.radioOn = false;
      this.stopRadioLoop();
    }
  }

  private playAmbientPadChord() {
    if (!this.radioOn || !this.enabled || !this.ctx || !this.masterGain) return;
    if (this.ctx.state !== 'running') return;
    const chords = AMBIENT_CHORD_PADS[this.radioStation] ?? AMBIENT_CHORD_PADS[0];
    const chord = chords[this.radioStep % chords.length];
    this.radioStep += 1;
    if (!chord) return;

    const now = this.ctx.currentTime;
    const warmFilter = this.ctx.createBiquadFilter();
    warmFilter.type = 'lowpass';
    warmFilter.frequency.value = 720;
    warmFilter.Q.value = 0.7;
    warmFilter.connect(this.masterGain);

    chord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const startT = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      // Tiny analog detune for lush soothing bathhouse warmth
      osc.frequency.setValueAtTime(freq + (idx % 2 === 0 ? 0.35 : -0.35), startT);

      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(0.022, startT + 0.55);
      g.gain.exponentialRampToValueAtTime(0.0004, startT + 2.65);

      osc.connect(g);
      g.connect(warmFilter);
      osc.start(startT);
      osc.stop(startT + 2.75);
    });
  }

  private startRadioLoop() {
    this.stopRadioLoop();
    // Play slow, serene spa ambient chords every 2.8 seconds (calm, atmospheric, never noisy!)
    this.radioTimer = window.setInterval(() => {
      this.playAmbientPadChord();
    }, 2800);
  }

  private stopRadioLoop() {
    if (this.radioTimer !== null) {
      window.clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  public playSplash() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public dispose() {
    this.stopRadioLoop();
    try {
      this.noiseSrcA?.stop();
      this.noiseSrcB?.stop();
      this.swellLfo?.stop();
      void this.ctx?.close().catch(() => {});
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
