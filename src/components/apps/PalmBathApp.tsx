import React, { useCallback, useEffect, useRef, useState } from 'react';
import dioramaUrl from '../../assets/images/palm_bath_iso_diorama_1795099206970.jpg';
import {
  PalmBathState,
  PalmWeatherMode,
  RADIO_STATION_NAMES,
  ShowerTempMode,
  createInitialBathState,
  cycleShowerMode,
  stepBathSimulation,
} from '../../core/palmBathSim';
import { BathhouseAudioEngine } from '../../core/retroAmbienceAudio';
import { Win2kIcon } from '../icons/Win2kIcons';
import { PixelCheckmark, PixelRadioDot } from '../icons/Win2kPixelGlyphs';

interface PalmBathAppProps {
  systemVolume?: number;
  systemMuted?: boolean;
  onUpdateTitle?: (title: string) => void;
  onClose: () => void;
}

type OpenMenuId = 'room' | 'weather' | 'help' | null;

interface Pt2 {
  x: number;
  y: number;
}

interface HitPolygon {
  kind: 'window' | 'shower' | 'radio';
  points: Pt2[];
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Normalized feature geometry measured directly from palm_bath_iso_diorama_1795099206970.jpg (1200x896)
const WIN_QUAD_NORM: Pt2[] = [
  { x: 0.197, y: 0.336 }, // top-left (tucked neatly inside inner wood trim)
  { x: 0.307, y: 0.262 }, // top-right
  { x: 0.307, y: 0.436 }, // bottom-right
  { x: 0.197, y: 0.514 }, // bottom-left
];

const SHOWER_NOZZLE_NORM = { x: 0.510, y: 0.242, halfW: 0.025 };
const SHOWER_FLOOR_Y_NORM = 0.585;
const LANTERN_CENTER_NORM = { x: 0.708, y: 0.348 };
const RADIO_CENTER_NORM = { x: 0.706, y: 0.476 };
const TUB_WATER_QUAD_NORM: Pt2[] = [
  { x: 0.194, y: 0.638 },
  { x: 0.345, y: 0.542 },
  { x: 0.438, y: 0.606 },
  { x: 0.284, y: 0.703 },
];

function pointInPoly(px: number, py: number, pts: Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Flood-fills the flat outer #112232 dark navy background of the hand-painted pixel diorama
 * into clean transparency and subtly quantizes to authentic 16-bit pixel clarity.
 */
function buildTransparentPixelDiorama(img: HTMLImageElement, targetW: number, targetH: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const d = imgData.data;

  // Sample outer corner RGB
  const bgR = d[0];
  const bgG = d[1];
  const bgB = d[2];

  const visited = new Uint8Array(targetW * targetH);
  const stack: number[] = [];

  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || x >= targetW || y < 0 || y >= targetH) return;
    const p = y * targetW + x;
    if (visited[p]) return;
    const i = p * 4;
    const diff =
      Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB);
    if (diff <= 38) {
      visited[p] = 1;
      stack.push(p);
    }
  };

  for (let x = 0; x < targetW; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, targetH - 1);
  }
  for (let y = 0; y < targetH; y++) {
    pushIfBg(0, y);
    pushIfBg(targetW - 1, y);
  }

  while (stack.length > 0) {
    const p = stack.pop()!;
    const i = p * 4;
    d[i + 3] = 0;
    const x = p % targetW;
    const y = (p - x) / targetW;
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }

  // Soft fringe cleanup: clear 1px outer navy halo adjacent to transparent pixels
  const fringeClear: number[] = [];
  for (let y = 1; y < targetH - 1; y++) {
    for (let x = 1; x < targetW - 1; x++) {
      const p = y * targetW + x;
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const diff =
        Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB);
      if (diff <= 56) {
        if (
          d[(p - 1) * 4 + 3] === 0 ||
          d[(p + 1) * 4 + 3] === 0 ||
          d[(p - targetW) * 4 + 3] === 0 ||
          d[(p + targetW) * 4 + 3] === 0
        ) {
          fringeClear.push(p);
        }
      }
    }
  }
  for (const p of fringeClear) {
    d[p * 4 + 3] = 0;
  }

  // Crisp 15-bit pixel quantization on opaque pixels for true retro pixel-art crispness
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      if (d[i + 3] < 128) {
        d[i + 3] = 0;
        continue;
      }
      d[i + 3] = 255;
      const bayer = (BAYER_4X4[y & 3][x & 3] / 15 - 0.5) * 6;
      d[i] = Math.max(0, Math.min(255, Math.round((d[i] + bayer) / 6) * 6));
      d[i + 1] = Math.max(0, Math.min(255, Math.round((d[i + 1] + bayer) / 6) * 6));
      d[i + 2] = Math.max(0, Math.min(255, Math.round((d[i + 2] + bayer) / 6) * 6));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

/**
 * Generates an authentic 16-bit Bayer 4x4 ordered-dithered retro pixel backdrop
 * (zero smooth modern gradients!).
 */
function buildBayerDitherBackdrop(
  w: number,
  h: number,
  palette: Array<[number, number, number]>
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  const d = imgData.data;
  const maxIdx = palette.length - 1;

  for (let y = 0; y < h; y++) {
    const ny = y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      // Subtle radial vignette blended into stepped vertical palette band via Bayer 4x4 matrix
      const nx = (x / Math.max(1, w - 1) - 0.5) * 2;
      const vig = Math.min(1, nx * nx * 0.22);
      const t = Math.max(0, Math.min(1, ny * 0.85 + vig));
      const scaled = t * maxIdx;
      const low = Math.floor(scaled);
      const high = Math.min(maxIdx, low + 1);
      const frac = scaled - low;
      const thresh = (BAYER_4X4[y & 3][x & 3] + 0.5) / 16;
      const col = frac > thresh ? palette[high] : palette[low];

      const idx = (y * w + x) * 4;
      d[idx] = col[0];
      d[idx + 1] = col[1];
      d[idx + 2] = col[2];
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

function buildOrderedDitherGlowSprite(
  rx: number,
  ry: number,
  color: string,
  strength: number
): HTMLCanvasElement {
  const w = rx * 2 + 2;
  const h = ry * 2 + 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;

  for (let y = 0; y < h; y++) {
    const ny = (y - ry) / ry;
    for (let x = 0; x < w; x++) {
      const nx = (x - rx) / rx;
      const d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue;
      const falloff = (1 - d2) * (1 - d2) * strength;
      const threshold = (BAYER_4X4[y & 3][x & 3] + 0.5) / 16;
      if (falloff > threshold) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

function buildDitherSteamSprite(rad: number, dense: boolean): HTMLCanvasElement {
  const size = rad * 2 + 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#E8FAFC';
  const r2 = rad * rad;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const px = dx + rad;
      const py = dy + rad;
      if (dense ? ((px + py) & 1) === 0 : (px & 1) === 0 && (py & 1) === 0) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  return c;
}

function drawPixelMusicNote(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  ctx.fillStyle = '#142429';
  ctx.fillRect(ix + 1, iy + 4, 3, 2);
  ctx.fillRect(ix + 3, iy + 1, 2, 4);
  ctx.fillRect(ix + 4, iy + 1, 2, 2);
  ctx.fillStyle = color;
  ctx.fillRect(ix, iy + 3, 3, 2);
  ctx.fillRect(ix + 2, iy, 1, 4);
  ctx.fillRect(ix + 3, iy, 2, 1);
}

export const PalmBathApp: React.FC<PalmBathAppProps> = ({
  systemVolume = 75,
  systemMuted = false,
  onUpdateTitle,
  onClose,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dioramaSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const rainBgRef = useRef<HTMLCanvasElement | null>(null);
  const sunnyBgRef = useRef<HTMLCanvasElement | null>(null);
  const lanternRainGlowRef = useRef<HTMLCanvasElement | null>(null);
  const lanternSunGlowRef = useRef<HTMLCanvasElement | null>(null);
  const steamSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const hitPolysRef = useRef<HitPolygon[]>([]);
  const simRef = useRef<PalmBathState>(createInitialBathState());
  const audioRef = useRef<BathhouseAudioEngine | null>(null);
  const onUpdateTitleRef = useRef(onUpdateTitle);
  onUpdateTitleRef.current = onUpdateTitle;

  const [openMenu, setOpenMenu] = useState<OpenMenuId>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hoverHint, setHoverHint] = useState<string>(
    '点击浴室中的木窗、黄铜花洒或黄色收音机直接互动 · 慢节奏海岛疗愈氛围'
  );

  const [hud, setHud] = useState(() => ({
    showerMode: simRef.current.showerMode,
    windowOpen: simRef.current.windowOpen,
    weather: simRef.current.weather,
    steamPct: Math.round(simRef.current.steamLevel),
    waterTempC: simRef.current.waterTempC,
    radioOn: simRef.current.radioOn,
    radioStation: simRef.current.radioStation,
  }));

  const syncHudNow = useCallback(() => {
    const s = simRef.current;
    setHud({
      showerMode: s.showerMode,
      windowOpen: s.windowOpen,
      weather: s.weather,
      steamPct: Math.round(s.steamLevel),
      waterTempC: s.waterTempC,
      radioOn: s.radioOn,
      radioStation: s.radioStation,
    });
  }, []);

  useEffect(() => {
    const weatherText = hud.weather === 'rain' ? '热带淋雨' : '晴日海风';
    onUpdateTitleRef.current?.(`棕榈浴场 - [${weatherText}]`);
  }, [hud.weather]);

  useEffect(() => {
    const engine = new BathhouseAudioEngine();
    audioRef.current = engine;

    lanternRainGlowRef.current = buildOrderedDitherGlowSprite(34, 30, '#FFD875', 0.62);
    lanternSunGlowRef.current = buildOrderedDitherGlowSprite(20, 18, '#FFE699', 0.32);

    const img = new Image();
    img.onload = () => {
      try {
        dioramaSpriteRef.current = buildTransparentPixelDiorama(img, 360, 270);
      } catch {
        // fallback handled in render loop
      }
    };
    img.src = dioramaUrl;

    return () => {
      engine.dispose();
      audioRef.current = null;
    };
  }, []);

  const pushAudioSync = useCallback(
    (nextSoundEnabled = soundEnabled) => {
      const s = simRef.current;
      audioRef.current?.syncEnvironment({
        systemVolumePct: systemVolume,
        systemMuted,
        appSoundEnabled: nextSoundEnabled,
        showerMode: s.showerMode,
        tubFilling: false,
        windowOpen: s.windowOpen,
        weather: s.weather,
        radioOn: s.radioOn,
        radioStation: s.radioStation,
      });
    },
    [soundEnabled, systemMuted, systemVolume]
  );

  useEffect(() => {
    pushAudioSync();
  }, [
    hud.radioOn,
    hud.radioStation,
    hud.showerMode,
    hud.weather,
    hud.windowOpen,
    pushAudioSync,
  ]);

  const renderPixelDioramaFrame = useCallback(() => {
    const display = displayCanvasRef.current;
    if (!display) return;

    const cw = Math.max(240, display.clientWidth || 560);
    const ch = Math.max(180, display.clientHeight || 340);
    const bufW = 384;
    const bufH = Math.max(240, Math.min(308, Math.round((bufW * ch) / cw)));

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const off = offscreenCanvasRef.current;
    if (off.width !== bufW || off.height !== bufH) {
      off.width = bufW;
      off.height = bufH;
      // Rebuild authentic 16-bit Bayer 4x4 ordered-dithered pixel backdrops when buffer size changes
      rainBgRef.current = buildBayerDitherBackdrop(bufW, bufH, [
        [34, 54, 72],
        [27, 45, 62],
        [21, 36, 51],
        [15, 27, 40],
        [11, 20, 31],
      ]);
      sunnyBgRef.current = buildBayerDitherBackdrop(bufW, bufH, [
        [45, 95, 114],
        [36, 78, 96],
        [28, 62, 79],
        [21, 48, 63],
        [16, 36, 49],
      ]);
    }
    if (display.width !== bufW || display.height !== bufH) {
      display.width = bufW;
      display.height = bufH;
    }

    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const s = simRef.current;
    const isRain = s.weather === 'rain';

    // 1. Authentic 16-bit Bayer-Dithered Retro Pixel Backdrop (NO smooth modern gradients!)
    const bgCanvas = isRain ? rainBgRef.current : sunnyBgRef.current;
    if (bgCanvas) {
      ctx.drawImage(bgCanvas, 0, 0);
    } else {
      ctx.fillStyle = isRain ? '#152433' : '#1E4658';
      ctx.fillRect(0, 0, bufW, bufH);
    }

    // Subtle animated pixel atmosphere outside cutaway diorama
    if (isRain) {
      ctx.fillStyle = 'rgba(155, 205, 232, 0.22)';
      for (let i = 0; i < 22; i++) {
        const rx = ((i * 39 + s.tickCount * 2) % (bufW + 24)) - 12;
        const ry = (i * 27 + s.tickCount * 4) % bufH;
        ctx.fillRect(rx, ry, 1, 4);
      }
    } else {
      // Gentle twinkling retro pixel sparkles in tropical dusk sky
      for (let i = 0; i < 14; i++) {
        const sx = (i * 67 + 23) % bufW;
        const sy = (i * 31 + 11) % Math.round(bufH * 0.55);
        const blink = ((s.tickCount >> 3) + i) % 5 === 0;
        ctx.fillStyle = blink ? '#FFF4C2' : '#7BC4D6';
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    // Fit 360x270 (4:3) hand-painted diorama cleanly centered inside buffer
    const scale = Math.min((bufW - 8) / 360, (bufH - 4) / 270);
    const drawW = Math.round(360 * scale);
    const drawH = Math.round(270 * scale);
    const drawX = Math.round((bufW - drawW) * 0.5);
    const drawY = Math.round((bufH - drawH) * 0.5);

    const toPx = (nx: number, ny: number): Pt2 => ({
      x: Math.round(drawX + nx * drawW),
      y: Math.round(drawY + ny * drawH),
    });

    // Subtle pixel floor drop-shadow diamond beneath diorama cutaway
    const shadowPts = [
      toPx(0.50, 0.99),
      toPx(0.89, 0.74),
      toPx(0.50, 0.54),
      toPx(0.11, 0.74),
    ];
    ctx.fillStyle = 'rgba(6, 14, 22, 0.45)';
    ctx.beginPath();
    ctx.moveTo(shadowPts[0].x, shadowPts[0].y + 2);
    ctx.lineTo(shadowPts[1].x + 2, shadowPts[1].y + 3);
    ctx.lineTo(shadowPts[2].x, shadowPts[2].y);
    ctx.lineTo(shadowPts[3].x - 2, shadowPts[3].y + 3);
    ctx.closePath();
    ctx.fill();

    // 2. Hand-Painted Isometric Pixel-Art Bathhouse Diorama Sprite
    const sprite = dioramaSpriteRef.current;
    if (sprite) {
      ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
    }

    // 3. Exact Window Parallelogram Interactive Weather / Wooden Louver Shutters
    const winPts = WIN_QUAD_NORM.map((p) => toPx(p.x, p.y));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(winPts[0].x, winPts[0].y);
    for (let i = 1; i < winPts.length; i++) ctx.lineTo(winPts[i].x, winPts[i].y);
    ctx.closePath();
    ctx.clip();

    if (!s.windowOpen) {
      // Closed hand-crafted pixel teak wooden louver shutters with brass center latch
      ctx.fillStyle = '#6B3D1F';
      ctx.fillRect(winPts[0].x - 2, winPts[1].y - 2, winPts[1].x - winPts[0].x + 4, winPts[3].y - winPts[1].y + 4);

      const slats = 11;
      for (let i = 0; i < slats; i++) {
        const t0 = i / slats;
        const t1 = (i + 0.58) / slats;
        const lx0 = winPts[0].x + 2;
        const rx0 = winPts[1].x - 2;
        const ly0 = Math.round(winPts[0].y + (winPts[3].y - winPts[0].y) * t0);
        const ry0 = Math.round(winPts[1].y + (winPts[2].y - winPts[1].y) * t0);
        const ly1 = Math.round(winPts[0].y + (winPts[3].y - winPts[0].y) * t1);
        const ry1 = Math.round(winPts[1].y + (winPts[2].y - winPts[1].y) * t1);

        ctx.fillStyle = '#9C6034';
        ctx.beginPath();
        ctx.moveTo(lx0, ly0);
        ctx.lineTo(rx0, ry0);
        ctx.lineTo(rx0, ry1);
        ctx.lineTo(lx0, ly1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#3E200D';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx0, ly1);
        ctx.lineTo(rx0, ry1);
        ctx.stroke();
      }
      // Center vertical stile + warm brass latch
      const midX = Math.round((winPts[0].x + winPts[1].x) * 0.5);
      const midYTop = Math.round((winPts[0].y + winPts[1].y) * 0.5);
      const midYBot = Math.round((winPts[2].y + winPts[3].y) * 0.5);
      ctx.fillStyle = '#522C14';
      ctx.fillRect(midX - 2, midYTop, 4, midYBot - midYTop);
      ctx.fillStyle = '#F2C64D';
      ctx.fillRect(midX - 1, Math.round((midYTop + midYBot) * 0.5) - 2, 3, 4);
    } else if (isRain) {
      // Stormy tropical rain overlay inside the open sea-view window!
      ctx.fillStyle = 'rgba(18, 42, 66, 0.54)';
      ctx.fillRect(winPts[0].x - 2, winPts[1].y - 2, winPts[1].x - winPts[0].x + 4, winPts[3].y - winPts[1].y + 4);

      // Rolling stormy pixel rain streaks slanted across the tropical window opening
      const minX = winPts[0].x;
      const spanW = winPts[1].x - winPts[0].x;
      const minY = winPts[1].y;
      const spanH = winPts[3].y - winPts[1].y;
      for (const r of s.rainStreaks) {
        const rx = Math.round(minX + r.x * spanW);
        const ry = Math.round(minY + r.y * spanH);
        const rLen = Math.max(4, Math.round(r.len * spanH * 0.9));
        ctx.fillStyle = '#B8ECFF';
        for (let k = 0; k < rLen; k++) {
          ctx.fillRect(rx - (k >> 1), ry + k, 1, 1);
        }
      }

      // Tiny rainwater bounce pixels along the bottom teak sill
      ctx.fillStyle = '#E0FAFF';
      for (let sp = 0; sp < 4; sp++) {
        const t = ((sp * 0.27 + (s.tickCount % 9) * 0.04) % 0.85) + 0.08;
        const sx = Math.round(winPts[3].x + (winPts[2].x - winPts[3].x) * t);
        const sy = Math.round(winPts[3].y + (winPts[2].y - winPts[3].y) * t) - 2 - ((s.tickCount + sp) % 3);
        ctx.fillRect(sx, sy, 2, 1);
      }
    } else {
      // Sunny coastal sunset glints sparkling across the ocean horizon inside the window
      const minX = winPts[0].x;
      const spanW = winPts[1].x - winPts[0].x;
      const midY = Math.round((winPts[0].y + winPts[3].y) * 0.52);
      ctx.fillStyle = '#FFF6C4';
      for (let g = 0; g < 6; g++) {
        const gx = Math.round(minX + ((g * 13 + (s.tickCount >> 2)) % Math.max(8, spanW - 8)) + 3);
        const gy = midY + (g % 3) * 4 - 4;
        ctx.fillRect(gx, gy, 3 + (g % 2), 1);
      }
    }
    ctx.restore();

    // 4. Animated Turquoise Water Shimmer Glints inside Mosaic Soaking Tub
    const tubPts = TUB_WATER_QUAD_NORM.map((p) => toPx(p.x, p.y));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tubPts[0].x, tubPts[0].y);
    for (let i = 1; i < tubPts.length; i++) ctx.lineTo(tubPts[i].x, tubPts[i].y);
    ctx.closePath();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const phase = ((s.tickCount >> 2) + i * 7) % 24;
      const gx = Math.round(tubPts[0].x + 8 + ((i * 15 + phase) % Math.max(12, tubPts[2].x - tubPts[0].x - 14)));
      const gy = Math.round(tubPts[1].y + 8 + ((i * 9) % Math.max(10, tubPts[3].y - tubPts[1].y - 12)));
      ctx.fillStyle = i % 2 === 0 ? 'rgba(218, 253, 255, 0.72)' : 'rgba(130, 238, 248, 0.55)';
      ctx.fillRect(gx, gy, 4 + (i % 3), 1);
    }
    ctx.restore();

    // 5. Live Brass Rain Shower Streams, Duckboard Splashes & Rising Bayer Steam
    const nozzle = toPx(SHOWER_NOZZLE_NORM.x, SHOWER_NOZZLE_NORM.y);
    const nozzleHalfPx = Math.max(5, Math.round(SHOWER_NOZZLE_NORM.halfW * drawW));
    const floorY = Math.round(drawY + SHOWER_FLOOR_Y_NORM * drawH);

    if (s.showerMode !== 'off') {
      const isHot = s.showerMode === 'hot';
      const streamColor = isHot ? 'rgba(220, 248, 255, 0.85)' : 'rgba(145, 232, 255, 0.85)';
      const headColor = isHot ? '#FFFFFF' : '#D6F8FF';

      // Crisp animated falling pixel droplets aligned cleanly under the brass rain-shower disc
      for (const d of s.waterDrops) {
        // Map simulation (u,v,z) cleanly onto the diorama shower bay column
        const fracZ = Math.max(0, Math.min(1, (3.92 - d.z) / 3.78));
        const dxOffset = ((d.u - 6.35) + (d.v - 6.35)) * nozzleHalfPx * 1.45;
        const px = Math.round(nozzle.x + dxOffset);
        const py = Math.round(nozzle.y + fracZ * (floorY - nozzle.y));

        if (d.splash) {
          ctx.fillStyle = '#E8FCFF';
          ctx.fillRect(px, py - 2, 1, 1);
          ctx.fillRect(px + 2, py - 1, 1, 1);
        } else {
          ctx.fillStyle = streamColor;
          ctx.fillRect(px, py, 1, 5);
          ctx.fillStyle = headColor;
          ctx.fillRect(px, py + 4, 1, 1);
        }
      }

      // Lively splash shimmer pixels on the slatted teak duckboard
      ctx.fillStyle = 'rgba(214, 252, 255, 0.78)';
      for (let sp = 0; sp < 5; sp++) {
        const sx = nozzle.x - nozzleHalfPx + ((sp * 7 + s.tickCount * 3) % (nozzleHalfPx * 2 + 2));
        const sy = floorY + ((sp * 3) % 7) - 3;
        ctx.fillRect(sx, sy, 2, 1);
      }
    }

    // Rising Bayer-Dithered Hot-Water Steam Puffs drifting gracefully from shower bay
    if (s.steamPuffs.length > 0 && (s.showerMode === 'hot' || s.steamLevel > 28)) {
      for (const puff of s.steamPuffs) {
        const rad = Math.max(4, Math.min(10, Math.round(puff.radius * 1.05)));
        const dense = puff.alpha > 0.22;
        const key = `${rad}-${dense ? 1 : 0}`;
        let stSprite = steamSpritesRef.current.get(key);
        if (!stSprite) {
          stSprite = buildDitherSteamSprite(rad, dense);
          steamSpritesRef.current.set(key, stSprite);
        }
        const fracZ = Math.max(0, Math.min(1, (puff.z - 0.35) / 4.2));
        const driftX = (puff.u - 6.3) * 18 - fracZ * (s.windowOpen ? 24 : 6);
        const px = Math.round(nozzle.x + driftX);
        const py = Math.round(floorY - 6 - fracZ * (floorY - nozzle.y + 18));
        ctx.save();
        ctx.globalAlpha = Math.min(0.68, puff.alpha * 1.45);
        ctx.drawImage(stSprite, px - rad, py - rad);
        ctx.restore();
      }
    }

    // 6. Warm Flickering Pixel Wall Lantern Glow (cozy rainy evening ambiance)
    const lanternPos = toPx(LANTERN_CENTER_NORM.x, LANTERN_CENTER_NORM.y);
    const lanternSprite = isRain ? lanternRainGlowRef.current : lanternSunGlowRef.current;
    if (lanternSprite) {
      const flicker = 0.84 + Math.sin(s.tickCount * 0.22) * 0.12 + Math.cos(s.tickCount * 0.37) * 0.05;
      ctx.save();
      ctx.globalAlpha = (isRain ? 0.58 : 0.28) * flicker;
      ctx.drawImage(
        lanternSprite,
        Math.round(lanternPos.x - lanternSprite.width * 0.5),
        Math.round(lanternPos.y - lanternSprite.height * 0.5)
      );
      ctx.restore();
    }

    // 7. Floating Pixel Eighth-Notes Rising from Yellow Waterproof Radio
    const radioPos = toPx(RADIO_CENTER_NORM.x, RADIO_CENTER_NORM.y);
    if (s.radioOn) {
      const noteColors = ['#FFE854', '#70F5FF', '#FF99C8'];
      for (const n of s.radioNotes) {
        const rise = Math.max(0, (n.z - 1.85) * 18);
        const swayX = Math.sin((s.tickCount + n.life) * 0.14) * 5;
        drawPixelMusicNote(
          ctx,
          radioPos.x + swayX - 2,
          radioPos.y - 12 - rise,
          noteColors[n.hueIdx % noteColors.length]
        );
      }
    }

    // Update exact interactive hitboxes aligned with the diorama
    const showerHitPts: Pt2[] = [
      toPx(0.455, 0.135),
      toPx(0.610, 0.135),
      toPx(0.610, 0.500),
      toPx(0.455, 0.500),
    ];
    const radioHitPts: Pt2[] = [
      toPx(0.668, 0.425),
      toPx(0.748, 0.425),
      toPx(0.748, 0.525),
      toPx(0.668, 0.525),
    ];
    hitPolysRef.current = [
      { kind: 'radio', points: radioHitPts },
      { kind: 'shower', points: showerHitPts },
      { kind: 'window', points: winPts },
    ];

    // Present crisp nearest-neighbor pixel buffer onto display canvas
    const dCtx = display.getContext('2d');
    if (dCtx) {
      dCtx.imageSmoothingEnabled = false;
      dCtx.clearRect(0, 0, display.width, display.height);
      dCtx.drawImage(off, 0, 0);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let hudTick = 0;

    const loop = () => {
      if (!alive) return;
      stepBathSimulation(simRef.current);
      renderPixelDioramaFrame();
      hudTick += 1;
      if (hudTick % 7 === 0) {
        syncHudNow();
      }
      timer = window.setTimeout(loop, 80);
    };

    renderPixelDioramaFrame();
    timer = window.setTimeout(loop, 80);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [renderPixelDioramaFrame, syncHudNow]);

  const toBufferCoords = (ev: React.MouseEvent<HTMLCanvasElement>): Pt2 | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
      y: ((ev.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const hitTest = (pt: Pt2): HitPolygon['kind'] | null => {
    for (const poly of hitPolysRef.current) {
      if (pointInPoly(pt.x, pt.y, poly.points)) {
        return poly.kind;
      }
    }
    return null;
  };

  const handleCycleShower = () => {
    simRef.current.showerMode = cycleShowerMode(simRef.current.showerMode);
    audioRef.current?.playSplash();
    syncHudNow();
  };

  const handleToggleWindow = () => {
    simRef.current.windowOpen = !simRef.current.windowOpen;
    syncHudNow();
  };

  const handleToggleWeather = () => {
    simRef.current.weather = simRef.current.weather === 'rain' ? 'sunny' : 'rain';
    syncHudNow();
  };

  const handleToggleRadio = () => {
    const s = simRef.current;
    if (!s.radioOn) {
      s.radioOn = true;
    } else if (s.radioStation < RADIO_STATION_NAMES.length - 1) {
      s.radioStation += 1;
    } else {
      s.radioOn = false;
      s.radioStation = 0;
    }
    syncHudNow();
  };

  const handleCanvasClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toBufferCoords(ev);
    if (!pt) return;
    const kind = hitTest(pt);
    if (kind === 'window') {
      handleToggleWindow();
    } else if (kind === 'shower') {
      handleCycleShower();
    } else if (kind === 'radio') {
      handleToggleRadio();
    }
  };

  const handleCanvasMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toBufferCoords(ev);
    if (!pt) return;
    const kind = hitTest(pt);
    if (kind === 'window') {
      setHoverHint('海景木窗 · 点击推开或合上木质百叶窗，感受窗外热带雨声与海风');
    } else if (kind === 'shower') {
      setHoverHint('黄铜雨淋花洒 · 点击切换「热水 43°C / 冷水 21°C / 关闭」');
    } else if (kind === 'radio') {
      setHoverHint('防水浴场收音机 · 点击切换轻柔疗愈氛围频道或关闭');
    } else {
      setHoverHint('点击浴室中的木窗、黄铜花洒或黄色收音机直接互动 · 慢节奏海岛疗愈氛围');
    }
  };

  const showerLabel =
    hud.showerMode === 'hot'
      ? '花洒: 热水 43°C'
      : hud.showerMode === 'cold'
        ? '花洒: 冷水 21°C'
        : '花洒: 已关闭';

  return (
    <div
      className="flex flex-col w-full h-full bg-[#D4D0C8] select-none relative text-[11px]"
      onClick={() => openMenu && setOpenMenu(null)}
    >
      {/* Classic Win2K Menu Bar */}
      <div className="h-[20px] flex items-center px-1 border-b border-[#808080] bg-[#D4D0C8] gap-0.5 shrink-0 z-20">
        <div className="relative">
          <button
            type="button"
            className={`px-2 py-0.5 ${
              openMenu === 'room' ? 'bg-[#0A246A] text-white' : 'hover:bg-[#0A246A] hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'room' ? null : 'room');
            }}
          >
            浴室(<u>R</u>)
          </button>
          {openMenu === 'room' && (
            <div className="absolute left-0 top-full w-[170px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
              {(['hot', 'cold', 'off'] as ShowerTempMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                  onClick={() => {
                    simRef.current.showerMode = mode;
                    syncHudNow();
                    setOpenMenu(null);
                  }}
                >
                  <span className="w-3 inline-flex items-center justify-center">
                    {hud.showerMode === mode && <PixelRadioDot />}
                  </span>
                  <span>
                    {mode === 'hot' ? '热水雨淋花洒 (43°C)' : mode === 'cold' ? '清凉冷水花洒 (21°C)' : '关闭花洒'}
                  </span>
                </button>
              ))}
              <div className="my-0.5 border-t border-[#808080] border-b border-white" />
              <button
                type="button"
                className="w-full text-left px-5 py-1 hover:bg-[#0A246A] hover:text-white"
                onClick={() => {
                  handleToggleWindow();
                  setOpenMenu(null);
                }}
              >
                {hud.windowOpen ? '合上木百叶窗' : '推开木百叶窗'}
              </button>
              <div className="my-0.5 border-t border-[#808080] border-b border-white" />
              <button
                type="button"
                className="w-full text-left px-5 py-1 hover:bg-[#0A246A] hover:text-white"
                onClick={onClose}
              >
                退出(X)
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`px-2 py-0.5 ${
              openMenu === 'weather'
                ? 'bg-[#0A246A] text-white'
                : 'hover:bg-[#0A246A] hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'weather' ? null : 'weather');
            }}
          >
            天气与电台(<u>W</u>)
          </button>
          {openMenu === 'weather' && (
            <div className="absolute left-0 top-full w-[190px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
              {(['rain', 'sunny'] as PalmWeatherMode[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                  onClick={() => {
                    simRef.current.weather = w;
                    syncHudNow();
                    setOpenMenu(null);
                  }}
                >
                  <span className="w-3 inline-flex items-center justify-center">
                    {hud.weather === w && <PixelRadioDot />}
                  </span>
                  <span>{w === 'rain' ? '窗外：热带淋雨夜' : '窗外：晴日海风湾'}</span>
                </button>
              ))}
              <div className="my-0.5 border-t border-[#808080] border-b border-white" />
              {RADIO_STATION_NAMES.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                  onClick={() => {
                    simRef.current.radioOn = true;
                    simRef.current.radioStation = idx;
                    syncHudNow();
                    setOpenMenu(null);
                  }}
                >
                  <span className="w-3 inline-flex items-center justify-center">
                    {hud.radioOn && hud.radioStation === idx && <PixelRadioDot />}
                  </span>
                  <span>{name}</span>
                </button>
              ))}
              <button
                type="button"
                className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                onClick={() => {
                  simRef.current.radioOn = false;
                  syncHudNow();
                  setOpenMenu(null);
                }}
              >
                <span className="w-3 inline-flex items-center justify-center">
                  {!hud.radioOn && <PixelRadioDot />}
                </span>
                <span>关闭浴场收音机</span>
              </button>
              <div className="my-0.5 border-t border-[#808080] border-b border-white" />
              <button
                type="button"
                className="w-full text-left px-2 py-1 hover:bg-[#0A246A] hover:text-white flex items-center gap-1.5"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  pushAudioSync(next);
                  setOpenMenu(null);
                }}
              >
                <span className="w-3 inline-flex items-center justify-center">
                  {soundEnabled && <PixelCheckmark />}
                </span>
                <span>开启环境音效</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`px-2 py-0.5 ${
              openMenu === 'help' ? 'bg-[#0A246A] text-white' : 'hover:bg-[#0A246A] hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'help' ? null : 'help');
            }}
          >
            帮助(<u>H</u>)
          </button>
          {openMenu === 'help' && (
            <div className="absolute left-0 top-full w-[160px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
              <button
                type="button"
                className="w-full text-left px-3 py-1 hover:bg-[#0A246A] hover:text-white"
                onClick={() => {
                  setShowGuideModal(true);
                  setOpenMenu(null);
                }}
              >
                关于棕榈浴场...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Hand-Painted 2.5D Isometric Pixel Bathhouse Viewport */}
      <div className="flex-1 min-h-0 p-1 flex flex-col">
        <div className="flex-1 min-h-[210px] win2k-sunken bg-[#111E2B] relative overflow-hidden">
          <canvas
            ref={displayCanvasRef}
            data-testid="palm-bath-canvas"
            className="w-full h-full block cursor-pointer"
            style={{ imageRendering: 'pixelated' }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
          />
        </div>
      </div>

      {/* Streamlined 4-Button Bathhouse Control Strip */}
      <div className="px-1 pb-1 pt-0.5 bg-[#D4D0C8] shrink-0">
        <div className="flex items-center gap-1 flex-nowrap overflow-x-auto">
          <button
            type="button"
            className={`px-2 py-0.5 whitespace-nowrap ${
              hud.showerMode !== 'off'
                ? 'win2k-sunken bg-[#EAE6DE] font-bold'
                : 'win2k-raised bg-[#D4D0C8]'
            }`}
            onClick={handleCycleShower}
          >
            {showerLabel}
          </button>

          <button
            type="button"
            className={`px-2 py-0.5 whitespace-nowrap ${
              hud.windowOpen ? 'win2k-sunken bg-[#EAE6DE]' : 'win2k-raised bg-[#D4D0C8]'
            }`}
            onClick={handleToggleWindow}
          >
            百叶窗: {hud.windowOpen ? '已推开' : '已合上'}
          </button>

          <button
            type="button"
            className="win2k-raised bg-[#D4D0C8] px-2 py-0.5 whitespace-nowrap active:win2k-sunken"
            onClick={handleToggleWeather}
          >
            窗外: {hud.weather === 'rain' ? '热带淋雨' : '晴日海风'}
          </button>

          <button
            type="button"
            className={`px-2 py-0.5 whitespace-nowrap ${
              hud.radioOn ? 'win2k-sunken bg-[#EAE6DE]' : 'win2k-raised bg-[#D4D0C8]'
            }`}
            onClick={handleToggleRadio}
          >
            收音机: {hud.radioOn ? `FM ${hud.radioStation + 1}台` : '关闭'}
          </button>
        </div>
      </div>

      {/* Classic Win2K Sunken Status Bar */}
      <div className="h-[20px] flex items-center gap-1 px-1 pb-0.5 bg-[#D4D0C8] shrink-0">
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center flex-1 truncate">
          {hoverHint}
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center w-[138px] shrink-0 truncate">
          水温 {hud.waterTempC}°C · 蒸汽 {hud.steamPct}%
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center w-[142px] shrink-0 truncate">
          {hud.radioOn ? RADIO_STATION_NAMES[hud.radioStation] : '收音机已静音'}
        </div>
      </div>

      {showGuideModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/25"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="win2k-window bg-[#D4D0C8] w-[320px] p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win2k-titlebar-active h-[20px] px-1.5 flex items-center justify-between text-white font-bold">
              <span>关于 棕榈浴场 2000</span>
              <button
                type="button"
                className="win2k-raised bg-[#D4D0C8] text-black w-[15px] h-[14px] flex items-center justify-center text-[10px]"
                onClick={() => setShowGuideModal(false)}
              >
                ×
              </button>
            </div>
            <div className="p-3 flex gap-3 items-start">
              <Win2kIcon kind="palm-bath" size={32} />
              <div className="space-y-1.5 leading-relaxed">
                <div className="font-bold">棕榈浴场 2000 (Palm Bath Pixel Edition)</div>
                <div>手绘立体像素海景浴场 · 16-bit Bayer 抖动夜色背景</div>
                <div className="text-[#404040]">
                  支持推开/合上海景木百叶窗、切换窗外热带淋雨与晴日海风、开启黄铜雨淋热冷花洒，以及聆听慢节奏雨夜浴场疗愈和弦。
                </div>
              </div>
            </div>
            <div className="px-3 pb-2.5 flex justify-end">
              <button
                type="button"
                className="win2k-raised bg-[#D4D0C8] px-5 py-1"
                onClick={() => setShowGuideModal(false)}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
