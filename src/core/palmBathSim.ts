/**
 * 2.5D Isometric Voxel-Pixel Sea-View Bathhouse Simulation Engine (Palm Bath 2000)
 * Models 3D isometric shower spray & splashes, rising hot-water steam drifting toward
 * the open louver window, window tropical rain streaks vs sunny golden breeze, and
 * waterproof shower radio music notes.
 */

export type ShowerTempMode = 'off' | 'cold' | 'hot';
export type PalmWeatherMode = 'sunny' | 'rain';

export interface IsoWaterDrop {
  u: number;
  v: number;
  z: number;
  vu: number;
  vv: number;
  vz: number;
  splash: boolean;
  life: number;
}

export interface IsoSteamPuff {
  u: number;
  v: number;
  z: number;
  vu: number;
  vv: number;
  vz: number;
  radius: number;
  alpha: number;
}

export interface RainStreak {
  x: number; // normalized [0..1] across window opening
  y: number; // normalized [0..1] vertically across window opening
  speed: number;
  len: number;
}

export interface IsoRadioNote {
  u: number;
  v: number;
  z: number;
  life: number;
  hueIdx: number;
}

export interface PalmBathState {
  tickCount: number;
  showerMode: ShowerTempMode;
  windowOpen: boolean;
  weather: PalmWeatherMode;
  steamLevel: number; // 0..100
  waterTempC: number;
  radioOn: boolean;
  radioStation: number;
  waterDrops: IsoWaterDrop[];
  steamPuffs: IsoSteamPuff[];
  rainStreaks: RainStreak[];
  radioNotes: IsoRadioNote[];
}

export const RADIO_STATION_NAMES = [
  'FM 88.6 雨夜椰林氛围',
  'FM 94.2 暖泉疗愈和弦',
  'FM 101.8 海风风铃低语',
] as const;

export function createInitialBathState(): PalmBathState {
  const rainStreaks: RainStreak[] = [];
  for (let i = 0; i < 36; i++) {
    rainStreaks.push({
      x: Math.random(),
      y: Math.random(),
      speed: 0.028 + Math.random() * 0.02,
      len: 0.08 + Math.random() * 0.07,
    });
  }

  return {
    tickCount: 0,
    showerMode: 'hot',
    windowOpen: true,
    weather: 'rain',
    steamLevel: 38,
    waterTempC: 43,
    radioOn: true,
    radioStation: 0,
    waterDrops: [],
    steamPuffs: [],
    rainStreaks,
    radioNotes: [],
  };
}

export function cycleShowerMode(current: ShowerTempMode): ShowerTempMode {
  if (current === 'off') return 'hot';
  if (current === 'hot') return 'cold';
  return 'off';
}

export function stepBathSimulation(state: PalmBathState): void {
  state.tickCount += 1;

  state.waterTempC =
    state.showerMode === 'hot' ? 43 : state.showerMode === 'cold' ? 21 : 26;

  // Emit 3D isometric shower drops from overhead brass nozzle (u=6.35, v=6.35, z=3.95)
  if (state.showerMode !== 'off') {
    const count = state.showerMode === 'hot' ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.34;
      state.waterDrops.push({
        u: 6.35 + Math.cos(ang) * rad,
        v: 6.35 + Math.sin(ang) * rad,
        z: 3.92,
        vu: (Math.random() - 0.5) * 0.015 + (state.windowOpen ? -0.01 : 0),
        vv: (Math.random() - 0.5) * 0.015,
        vz: -0.14 - Math.random() * 0.06,
        splash: false,
        life: 45,
      });
    }
  }

  // Update 3D drops & duckboard floor splashes (z = 0.14)
  const nextDrops: IsoWaterDrop[] = [];
  for (let i = 0; i < state.waterDrops.length; i++) {
    const d = state.waterDrops[i];
    d.u += d.vu;
    d.v += d.vv;
    d.z += d.vz;
    d.vz -= d.splash ? 0.025 : 0.012;
    d.life -= 1;

    if (!d.splash && d.z <= 0.14) {
      if (nextDrops.length < 110 && Math.random() < 0.55) {
        const ang = Math.random() * Math.PI * 2;
        nextDrops.push({
          u: d.u,
          v: d.v,
          z: 0.16,
          vu: Math.cos(ang) * (0.025 + Math.random() * 0.03),
          vv: Math.sin(ang) * (0.025 + Math.random() * 0.03),
          vz: 0.045 + Math.random() * 0.04,
          splash: true,
          life: 9 + Math.floor(Math.random() * 5),
        });
      }
      continue;
    }

    if (d.life > 0 && d.z >= 0.05) {
      nextDrops.push(d);
    }
  }
  state.waterDrops = nextDrops;

  // Steam accumulation & ventilation toward window
  const steamGain = state.showerMode === 'hot' ? 0.38 : -0.22;
  const ventLoss =
    (state.windowOpen ? (state.weather === 'rain' ? 0.18 : 0.28) : 0.04) +
    (state.showerMode === 'cold' ? 0.22 : 0);
  state.steamLevel = Math.max(0, Math.min(100, state.steamLevel + steamGain - ventLoss));

  if (
    (state.showerMode === 'hot' || state.steamLevel > 32) &&
    state.steamPuffs.length < 18 &&
    Math.random() < (state.showerMode === 'hot' ? 0.36 : 0.14)
  ) {
    state.steamPuffs.push({
      u: 5.5 + Math.random() * 1.6,
      v: 5.5 + Math.random() * 1.6,
      z: 0.4 + Math.random() * 0.8,
      vu: state.windowOpen ? -0.018 : (Math.random() - 0.5) * 0.008,
      vv: state.windowOpen ? 0.016 : (Math.random() - 0.5) * 0.008,
      vz: 0.03 + Math.random() * 0.025,
      radius: 4 + Math.floor(Math.random() * 4),
      alpha: 0.28 + Math.random() * 0.18,
    });
  }

  const nextSteam: IsoSteamPuff[] = [];
  for (const s of state.steamPuffs) {
    s.u += s.vu + Math.sin((state.tickCount + s.z * 10) * 0.08) * 0.006;
    s.v += s.vv;
    s.z += s.vz;
    s.alpha -= 0.0045;
    if (s.alpha > 0.03 && s.z < 5.0 && s.u > 0.5 && s.v < 7.9) {
      nextSteam.push(s);
    }
  }
  state.steamPuffs = nextSteam;

  // Window rain streaks
  if (state.weather === 'rain') {
    for (const r of state.rainStreaks) {
      r.x -= r.speed * 0.38;
      r.y += r.speed;
      if (r.y > 1.05) {
        r.y = -0.05;
        r.x = Math.random() * 1.15;
      }
      if (r.x < -0.1) {
        r.x = 1.05;
      }
    }
  }

  // Waterproof radio floating pixel eighth-notes
  if (state.radioOn && state.tickCount % 22 === 0 && state.radioNotes.length < 6) {
    state.radioNotes.push({
      u: 7.05 + (Math.random() - 0.5) * 0.3,
      v: 2.1 + (Math.random() - 0.5) * 0.3,
      z: 1.85,
      life: 52,
      hueIdx: state.tickCount % 3,
    });
  }
  const nextNotes: IsoRadioNote[] = [];
  for (const n of state.radioNotes) {
    n.z += 0.032;
    n.v += Math.sin((state.tickCount + n.life) * 0.15) * 0.012;
    n.life -= 1;
    if (n.life > 0 && n.z < 4.5) {
      nextNotes.push(n);
    }
  }
  state.radioNotes = nextNotes;
}
