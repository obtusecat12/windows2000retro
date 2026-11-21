import React, { useCallback, useEffect, useRef, useState } from 'react';
// Individual modular pixel-art architectural tile textures & vistas (ZERO whole-room AI diorama!)
import wallMosaicUrl from '../../assets/images/bath_tex_wall_mosaic_1795185834618.jpg';
import floorTeakUrl from '../../assets/images/bath_tex_floor_teak_1795185834501.jpg';
import vistaSunnyUrl from '../../assets/images/bath_tex_vista_sunny_1795185835977.jpg';
import vistaRainyUrl from '../../assets/images/bath_tex_vista_rainy_1795185835296.jpg';
// Individual modular chroma-keyed isometric pixel-art props (each sorted by real 3D isometric depth!)
import showerBrassUrl from '../../assets/images/bath_prop_shower_brass_1795185832574.jpg';
import vanitySinkUrl from '../../assets/images/bath_prop_vanity_sink_1795185830741.jpg';
import stoolWoodUrl from '../../assets/images/bath_prop_stool_wood_1795185832235.jpg';
import bucketHinokiUrl from '../../assets/images/bath_prop_bucket_hinoki_1795186052669.jpg';
import monsteraPotUrl from '../../assets/images/bath_prop_monstera_pot_1795186060741.jpg';
import radioYellowUrl from '../../assets/images/bath_prop_radio_yellow_1795186052001.jpg';
import lanternBrassUrl from '../../assets/images/bath_prop_lantern_brass_1795186048478.jpg';
import duckyYellowUrl from '../../assets/images/bath_prop_ducky_yellow_1795186050346.jpg';
import paintingWaveUrl from '../../assets/images/bath_prop_painting_wave_1795186048595.jpg';
import bathCaddyUrl from '../../assets/images/bath_prop_bath_caddy_1795186061339.jpg';

import {
  IsoProjectorConfig,
  IsoPt2,
  IsoSortableItem,
  buildBayerDitherBackdrop,
  buildDitherSteamSprite,
  buildOrderedDitherGlowSprite,
  drawPixelContactShadow,
  drawSixFramePixelShowerWater,
  drawSolidIsoQuad,
  drawTexturedIsoQuad,
  extractMagentaChromaSprite,
  preparePixelTileTexture,
  projectIso,
  sortIsoRenderItems,
} from '../../core/palmBathIsoEngine';
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

interface HitPolygon {
  kind: 'window' | 'shower' | 'radio' | 'ducky';
  points: IsoPt2[];
}

interface ModularBathAssets {
  wallMosaicLeft: HTMLCanvasElement | null;
  wallMosaicRight: HTMLCanvasElement | null;
  floorMosaicWet: HTMLCanvasElement | null;
  floorTeak: HTMLCanvasElement | null;
  vistaSunny: HTMLCanvasElement | null;
  vistaRainy: HTMLCanvasElement | null;
  showerBrass: HTMLCanvasElement | null;
  vanitySink: HTMLCanvasElement | null;
  stoolWood: HTMLCanvasElement | null;
  bucketHinoki: HTMLCanvasElement | null;
  monsteraPot: HTMLCanvasElement | null;
  radioYellow: HTMLCanvasElement | null;
  lanternBrass: HTMLCanvasElement | null;
  duckyYellow: HTMLCanvasElement | null;
  paintingWave: HTMLCanvasElement | null;
  bathCaddy: HTMLCanvasElement | null;
}

interface RenderQueueItem extends IsoSortableItem {
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function pointInPoly(px: number, py: number, pts: IsoPt2[]): boolean {
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

/**
 * Draws a single teak wooden louver shutter panel mapped strictly onto a left-wall isometric quad
 * (v0 -> v1 along left wall, z0 -> z1 vertically), guaranteeing 100% pixel-flush alignment with the window frame!
 */
function drawLouverShutterLeaf(
  ctx: CanvasRenderingContext2D,
  cfg: IsoProjectorConfig,
  uPlane: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
  isLit: boolean
) {
  const pTL = projectIso(uPlane, v0, z1, cfg);
  const pTR = projectIso(uPlane, v1, z1, cfg);
  const pBR = projectIso(uPlane, v1, z0, cfg);
  const pBL = projectIso(uPlane, v0, z0, cfg);

  // Outer solid oiled-teak shutter frame
  drawSolidIsoQuad(ctx, [pTL, pTR, pBR, pBL], isLit ? '#8B5028' : '#733F1E', '#3A1D0B');

  // Inner louvered recess panel
  const insetV = (v1 - v0) * 0.13;
  const insetZ = (z1 - z0) * 0.08;
  const iTL = projectIso(uPlane, v0 + insetV, z1 - insetZ, cfg);
  const iTR = projectIso(uPlane, v1 - insetV, z1 - insetZ, cfg);
  const iBR = projectIso(uPlane, v1 - insetV, z0 + insetZ, cfg);
  const iBL = projectIso(uPlane, v0 + insetV, z0 + insetZ, cfg);
  drawSolidIsoQuad(ctx, [iTL, iTR, iBR, iBL], '#44220E');

  // Crisp angled horizontal wooden louver slats strictly parallel to the 2:1 isometric wall slope
  const slatCount = 10;
  for (let i = 0; i < slatCount; i++) {
    const t0 = (i + 0.08) / slatCount;
    const t1 = (i + 0.64) / slatCount;
    const szTop = z1 - insetZ - (z1 - z0 - 2 * insetZ) * t0;
    const szBot = z1 - insetZ - (z1 - z0 - 2 * insetZ) * t1;
    const sTL = projectIso(uPlane, v0 + insetV, szTop, cfg);
    const sTR = projectIso(uPlane, v1 - insetV, szTop, cfg);
    const sBR = projectIso(uPlane, v1 - insetV, szBot, cfg);
    const sBL = projectIso(uPlane, v0 + insetV, szBot, cfg);

    drawSolidIsoQuad(ctx, [sTL, sTR, sBR, sBL], isLit ? '#AB6939' : '#90542B');
    // Subtle top bevel pixel highlight on each slat
    ctx.strokeStyle = isLit ? '#CF8B53' : '#AF703E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sTL.x, sTL.y);
    ctx.lineTo(sTR.x, sTR.y);
    ctx.stroke();
  }
}

export const PalmBathApp: React.FC<PalmBathAppProps> = ({
  systemVolume = 75,
  systemMuted = false,
  onUpdateTitle,
  onClose,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetsRef = useRef<ModularBathAssets>({
    wallMosaicLeft: null,
    wallMosaicRight: null,
    floorMosaicWet: null,
    floorTeak: null,
    vistaSunny: null,
    vistaRainy: null,
    showerBrass: null,
    vanitySink: null,
    stoolWood: null,
    bucketHinoki: null,
    monsteraPot: null,
    radioYellow: null,
    lanternBrass: null,
    duckyYellow: null,
    paintingWave: null,
    bathCaddy: null,
  });

  const rainBgRef = useRef<HTMLCanvasElement | null>(null);
  const sunnyBgRef = useRef<HTMLCanvasElement | null>(null);
  const lanternRainGlowRef = useRef<HTMLCanvasElement | null>(null);
  const lanternSunGlowRef = useRef<HTMLCanvasElement | null>(null);
  const steamSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const duckyBounceRef = useRef<number>(0);
  const hitPolysRef = useRef<HitPolygon[]>([]);
  const simRef = useRef<PalmBathState>(createInitialBathState());
  const audioRef = useRef<BathhouseAudioEngine | null>(null);
  const onUpdateTitleRef = useRef(onUpdateTitle);
  onUpdateTitleRef.current = onUpdateTitle;

  const [openMenu, setOpenMenu] = useState<OpenMenuId>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hoverHint, setHoverHint] = useState<string>('就绪');

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
    onUpdateTitleRef.current?.('棕榈浴场');
  }, []);

  // Load & extract ALL 14 modular individually-generated pixel assets cleanly!
  useEffect(() => {
    const engine = new BathhouseAudioEngine();
    audioRef.current = engine;

    lanternRainGlowRef.current = buildOrderedDitherGlowSprite(40, 36, '#FFD97A', 0.65);
    lanternSunGlowRef.current = buildOrderedDitherGlowSprite(24, 22, '#FFE8A6', 0.34);

    let cancelled = false;
    const loadImg = (url: string, onReady: (img: HTMLImageElement) => void) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) onReady(img);
      };
      img.src = url;
    };

    // 1. Architectural Seamless Pixel Textures & Vistas
    loadImg(wallMosaicUrl, (img) => {
      assetsRef.current.wallMosaicLeft = preparePixelTileTexture(img, 64, 64, {
        r: 0.96,
        g: 1.0,
        b: 1.02,
      });
      assetsRef.current.wallMosaicRight = preparePixelTileTexture(img, 64, 64, {
        r: 0.88,
        g: 0.92,
        b: 0.94,
      });
      assetsRef.current.floorMosaicWet = preparePixelTileTexture(img, 64, 64, {
        r: 0.8,
        g: 0.93,
        b: 0.98,
      });
    });
    loadImg(floorTeakUrl, (img) => {
      assetsRef.current.floorTeak = preparePixelTileTexture(img, 64, 64, {
        r: 1.0,
        g: 0.96,
        b: 0.9,
      });
    });
    loadImg(vistaSunnyUrl, (img) => {
      assetsRef.current.vistaSunny = preparePixelTileTexture(img, 88, 72);
    });
    loadImg(vistaRainyUrl, (img) => {
      assetsRef.current.vistaRainy = preparePixelTileTexture(img, 88, 72);
    });

    // 2. Individually Generated Magenta-Keyed Isometric Prop Sprites
    loadImg(showerBrassUrl, (img) => {
      assetsRef.current.showerBrass = extractMagentaChromaSprite(img, {
        targetW: 48,
        targetH: 76,
      });
    });
    loadImg(vanitySinkUrl, (img) => {
      assetsRef.current.vanitySink = extractMagentaChromaSprite(img, {
        targetW: 66,
        targetH: 66,
      });
    });
    loadImg(stoolWoodUrl, (img) => {
      assetsRef.current.stoolWood = extractMagentaChromaSprite(img, {
        targetW: 34,
        targetH: 34,
      });
    });
    loadImg(bucketHinokiUrl, (img) => {
      assetsRef.current.bucketHinoki = extractMagentaChromaSprite(img, {
        targetW: 28,
        targetH: 28,
      });
    });
    loadImg(monsteraPotUrl, (img) => {
      assetsRef.current.monsteraPot = extractMagentaChromaSprite(img, {
        targetW: 48,
        targetH: 60,
      });
    });
    loadImg(radioYellowUrl, (img) => {
      assetsRef.current.radioYellow = extractMagentaChromaSprite(img, {
        targetW: 17,
        targetH: 17,
      });
    });
    loadImg(lanternBrassUrl, (img) => {
      assetsRef.current.lanternBrass = extractMagentaChromaSprite(img, {
        targetW: 24,
        targetH: 32,
      });
    });
    loadImg(duckyYellowUrl, (img) => {
      assetsRef.current.duckyYellow = extractMagentaChromaSprite(img, {
        targetW: 16,
        targetH: 16,
      });
    });
    loadImg(paintingWaveUrl, (img) => {
      // Flip horizontally so top edge slopes down-right at exact 2:1 isometric right-wall angle!
      assetsRef.current.paintingWave = extractMagentaChromaSprite(img, {
        targetW: 34,
        targetH: 36,
        flipX: true,
      });
    });
    loadImg(bathCaddyUrl, (img) => {
      // Flip horizontally so tray spans exact diagonal cleanly inside left-wall soaking tub rims!
      assetsRef.current.bathCaddy = extractMagentaChromaSprite(img, {
        targetW: 58,
        targetH: 36,
        flipX: true,
      });
    });

    return () => {
      cancelled = true;
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

  const renderModularIsoScene = useCallback(() => {
    const display = displayCanvasRef.current;
    if (!display) return;

    const cw = Math.max(240, display.clientWidth || 560);
    const ch = Math.max(180, display.clientHeight || 340);
    const bufW = 384;
    const bufH = Math.max(248, Math.min(308, Math.round((bufW * ch) / cw)));

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const off = offscreenCanvasRef.current;
    if (off.width !== bufW || off.height !== bufH) {
      off.width = bufW;
      off.height = bufH;
      // 16-bit Bayer 4x4 ordered-dithered retro pixel backdrops (NO smooth modern gradients!)
      rainBgRef.current = buildBayerDitherBackdrop(bufW, bufH, [
        [32, 52, 70],
        [25, 42, 58],
        [19, 34, 48],
        [14, 25, 37],
        [10, 18, 28],
      ]);
      sunnyBgRef.current = buildBayerDitherBackdrop(bufW, bufH, [
        [44, 94, 114],
        [35, 76, 94],
        [27, 60, 77],
        [20, 46, 61],
        [15, 34, 47],
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
    const a = assetsRef.current;
    const isRain = s.weather === 'rain';

    // Exact 2:1 isometric room scaling centered dynamically inside buffer
    const tileW = Math.max(28, Math.min(34, Math.floor((bufH - 26) / 7.5) * 2));
    const tileH = tileW * 0.5;
    const cfg: IsoProjectorConfig = {
      originX: Math.round(bufW * 0.5),
      originY: Math.round(bufH * 0.415),
      tileW,
      tileH,
      unitZ: tileH,
    };
    const P = (u: number, v: number, z = 0) => projectIso(u, v, z, cfg);

    // =========================================================================
    // LAYER 0: 16-BIT BAYER 4x4 ORDERED-DITHERED RETRO BACKDROP
    // =========================================================================
    const bgCanvas = isRain ? rainBgRef.current : sunnyBgRef.current;
    if (bgCanvas) {
      ctx.drawImage(bgCanvas, 0, 0);
    } else {
      ctx.fillStyle = isRain ? '#142230' : '#1E4759';
      ctx.fillRect(0, 0, bufW, bufH);
    }

    if (isRain) {
      ctx.fillStyle = 'rgba(160, 212, 238, 0.22)';
      for (let i = 0; i < 24; i++) {
        const rx = ((i * 39 + s.tickCount * 2) % (bufW + 24)) - 12;
        const ry = (i * 27 + s.tickCount * 4) % bufH;
        ctx.fillRect(rx, ry, 1, 4);
      }
    } else {
      for (let i = 0; i < 16; i++) {
        const sx = (i * 67 + 23) % bufW;
        const sy = (i * 31 + 11) % Math.round(bufH * 0.55);
        const blink = ((s.tickCount >> 3) + i) % 5 === 0;
        ctx.fillStyle = blink ? '#FFF4C2' : '#7BC4D6';
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    // Subtle dark pixel drop shadow under the entire cutaway diorama base
    const baseS = [P(0, 8, -0.52), P(8, 8, -0.52), P(8, 0, -0.52), P(0, 0, -0.52)];
    drawSolidIsoQuad(
      ctx,
      [
        { x: baseS[0].x - 2, y: baseS[0].y + 4 },
        { x: baseS[1].x, y: baseS[1].y + 6 },
        { x: baseS[2].x + 2, y: baseS[2].y + 4 },
        { x: baseS[3].x, y: baseS[3].y + 2 },
      ],
      'rgba(5, 12, 20, 0.52)'
    );

    // =========================================================================
    // LAYER 1: ARCHITECTURAL CUTAWAY FOUNDATION SLAB & FLOOR TILES (U:0..8, V:0..8)
    // =========================================================================
    // Cutaway oiled teak slab front-left & front-right faces
    drawSolidIsoQuad(
      ctx,
      [P(0, 8, 0), P(8, 8, 0), P(8, 8, -0.52), P(0, 8, -0.52)],
      '#5C3218',
      '#2B1408'
    );
    drawSolidIsoQuad(
      ctx,
      [P(8, 8, 0), P(8, 0, 0), P(8, 0, -0.52), P(8, 8, -0.52)],
      '#472511',
      '#2B1408'
    );

    // Floor Wet Mosaic Area (u: 0..4.5, v: 0..8)
    if (a.floorMosaicWet) {
      drawTexturedIsoQuad(
        ctx,
        a.floorMosaicWet,
        P(0, 0, 0),
        P(4.5, 0, 0),
        P(0, 8, 0),
        1.7,
        3.0,
        isRain ? 'rgba(10, 26, 44, 0.16)' : 'rgba(255, 250, 224, 0.06)'
      );
    } else {
      drawSolidIsoQuad(ctx, [P(0, 0, 0), P(4.5, 0, 0), P(4.5, 8, 0), P(0, 8, 0)], '#2E9CA6');
    }

    // Floor Warm Oiled Teak Dry Deck (u: 4.5..8, v: 0..8)
    if (a.floorTeak) {
      drawTexturedIsoQuad(
        ctx,
        a.floorTeak,
        P(4.5, 0, 0),
        P(8, 0, 0),
        P(4.5, 8, 0),
        1.4,
        2.8,
        isRain ? 'rgba(12, 22, 36, 0.12)' : undefined
      );
    } else {
      drawSolidIsoQuad(ctx, [P(4.5, 0, 0), P(8, 0, 0), P(8, 8, 0), P(4.5, 8, 0)], '#9A5A2A');
    }

    // Teak transition trim strip between wet mosaic & dry deck
    drawSolidIsoQuad(
      ctx,
      [P(4.44, 0, 0), P(4.58, 0, 0), P(4.58, 8, 0), P(4.44, 8, 0)],
      '#6E3C1D'
    );

    // =========================================================================
    // LAYER 2: LEFT & RIGHT MOSAIC WALLS + GOLDEN POLYNESIAN FRIEZE + CROWN BEAMS
    // =========================================================================
    const wallH = 5.25;
    // Left Wall (u = 0, v: 0..8, z: 0..wallH)
    if (a.wallMosaicLeft) {
      drawTexturedIsoQuad(
        ctx,
        a.wallMosaicLeft,
        P(0, 8, wallH),
        P(0, 0, wallH),
        P(0, 8, 0),
        2.8,
        1.8,
        isRain ? 'rgba(14, 34, 54, 0.18)' : undefined
      );
    } else {
      drawSolidIsoQuad(
        ctx,
        [P(0, 8, wallH), P(0, 0, wallH), P(0, 0, 0), P(0, 8, 0)],
        '#36AAB4'
      );
    }

    // Right Wall (v = 0, u: 0..8, z: 0..wallH):
    // Left half (u: 0..4.5) is aqua mosaic shower bay; right half (u: 4.5..8) is warm tropical plaster vanity alcove!
    if (a.wallMosaicRight) {
      drawTexturedIsoQuad(
        ctx,
        a.wallMosaicRight,
        P(0, 0, wallH),
        P(4.6, 0, wallH),
        P(0, 0, 0),
        1.65,
        1.8,
        isRain ? 'rgba(10, 26, 44, 0.22)' : 'rgba(10, 26, 44, 0.08)'
      );
    } else {
      drawSolidIsoQuad(
        ctx,
        [P(0, 0, wallH), P(4.6, 0, wallH), P(4.6, 0, 0), P(0, 0, 0)],
        '#2A8F99'
      );
    }

    // Warm sunlit coral-sand stucco alcove behind vanity & wall lantern (u: 4.6..8)
    drawSolidIsoQuad(
      ctx,
      [P(4.6, 0, wallH), P(8, 0, wallH), P(8, 0, 0), P(4.6, 0, 0)],
      isRain ? '#D49A6E' : '#E8B68A'
    );
    // Vertical oiled teak wood divider pillar between shower mosaic bay and vanity alcove
    drawSolidIsoQuad(
      ctx,
      [P(4.48, 0, wallH), P(4.74, 0, wallH), P(4.74, 0, 0), P(4.48, 0, 0)],
      '#6E3D1E',
      '#3B1E0D'
    );

    // Polynesian Golden Wave Mosaic Frieze Strip on Left Wall & Shower Right Wall (z: 1.95..2.28)
    const drawFrieze = (pts: IsoPt2[]) => {
      drawSolidIsoQuad(ctx, pts, '#D8A24A', '#6A4716');
      ctx.strokeStyle = '#FFF0A8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y + 1);
      ctx.lineTo(pts[1].x, pts[1].y + 1);
      ctx.stroke();
    };
    drawFrieze([P(0, 8, 2.28), P(0, 0, 2.28), P(0, 0, 1.95), P(0, 8, 1.95)]);
    drawFrieze([P(0, 0, 2.28), P(4.48, 0, 2.28), P(4.48, 0, 1.95), P(0, 0, 1.95)]);

    // Baked Architectural Corner & Baseboard Ambient Occlusion Creases (zero flat SVG look!)
    drawSolidIsoQuad(
      ctx,
      [P(0, 0.35, wallH), P(0, 0, wallH), P(0, 0, 0), P(0, 0.35, 0)],
      'rgba(8, 24, 34, 0.24)'
    );
    drawSolidIsoQuad(
      ctx,
      [P(0, 0, wallH), P(0.38, 0, wallH), P(0.38, 0, 0), P(0, 0, 0)],
      'rgba(8, 24, 34, 0.28)'
    );
    drawSolidIsoQuad(
      ctx,
      [P(0, 8, 0.35), P(0, 0, 0.35), P(0, 0, 0), P(0, 8, 0)],
      'rgba(8, 24, 34, 0.2)'
    );
    drawSolidIsoQuad(
      ctx,
      [P(0, 0, 0.35), P(8, 0, 0.35), P(8, 0, 0), P(0, 0, 0)],
      'rgba(8, 24, 34, 0.22)'
    );

    // Cutaway Teak Wall Thickness & Top Crown Beams (3D Isometric Architecture!)
    const wallT = 0.32;
    // Left wall outer thickness strip (v = 8)
    drawSolidIsoQuad(
      ctx,
      [P(-wallT, 8, wallH + 0.26), P(0, 8, wallH + 0.26), P(0, 8, -0.52), P(-wallT, 8, -0.52)],
      '#6E3E1F',
      '#2B1408'
    );
    // Right wall outer thickness strip (u = 8)
    drawSolidIsoQuad(
      ctx,
      [P(8, 0, wallH + 0.26), P(8, -wallT, wallH + 0.26), P(8, -wallT, -0.52), P(8, 0, -0.52)],
      '#582F15',
      '#2B1408'
    );
    // Left top crown teak beam cap
    drawSolidIsoQuad(
      ctx,
      [P(-wallT, 8, wallH + 0.26), P(-wallT, -wallT, wallH + 0.26), P(0, 0, wallH + 0.26), P(0, 8, wallH + 0.26)],
      '#B5703C',
      '#3B1D0B'
    );
    drawSolidIsoQuad(
      ctx,
      [P(0, 8, wallH + 0.26), P(0, 0, wallH + 0.26), P(0, 0, wallH), P(0, 8, wallH)],
      '#844A23',
      '#3B1D0B'
    );
    // Right top crown teak beam cap
    drawSolidIsoQuad(
      ctx,
      [P(-wallT, -wallT, wallH + 0.26), P(8, -wallT, wallH + 0.26), P(8, 0, wallH + 0.26), P(0, 0, wallH + 0.26)],
      '#A56333',
      '#3B1D0B'
    );
    drawSolidIsoQuad(
      ctx,
      [P(0, 0, wallH + 0.26), P(8, 0, wallH + 0.26), P(8, 0, wallH), P(0, 0, wallH)],
      '#733F1D',
      '#3B1D0B'
    );

    // =========================================================================
    // LAYER 3: MATHEMATICALLY ALIGNED LEFT-WALL WINDOW + HINGED LOUVER SHUTTERS
    // =========================================================================
    // Window sits cleanly on Left Wall: v in [2.7..6.1], z in [2.35..4.55]
    const wV0 = 2.7;
    const wV1 = 6.1;
    const wZ0 = 2.35;
    const wZ1 = 4.55;
    const wMidV = (wV0 + wV1) * 0.5;

    // Outer thick teak casing trim around window
    const framePadV = 0.22;
    const framePadZ = 0.2;
    const winOuterPts = [
      P(0, wV1 + framePadV, wZ1 + framePadZ),
      P(0, wV0 - framePadV, wZ1 + framePadZ),
      P(0, wV0 - framePadV, wZ0 - framePadZ),
      P(0, wV1 + framePadV, wZ0 - framePadZ),
    ];
    drawSolidIsoQuad(ctx, winOuterPts, '#7A4420', '#381B0A');

    // Exact inner window cutout parallelogram (100% locked to vista clip AND shutter edges!)
    const winTL = P(0, wV1, wZ1);
    const winTR = P(0, wV0, wZ1);
    const winBR = P(0, wV0, wZ0);
    const winBL = P(0, wV1, wZ0);
    const winInnerPts = [winTL, winTR, winBR, winBL];

    // Step 3A: Draw Sea Vista STRICTLY clipped inside inner window opening!
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(winTL.x, winTL.y);
    ctx.lineTo(winTR.x, winTR.y);
    ctx.lineTo(winBR.x, winBR.y);
    ctx.lineTo(winBL.x, winBL.y);
    ctx.closePath();
    ctx.clip();

    const vistaTex = isRain ? a.vistaRainy : a.vistaSunny;
    if (vistaTex) {
      drawTexturedIsoQuad(ctx, vistaTex, winTL, winTR, winBL, 1, 1);
    } else {
      ctx.fillStyle = isRain ? '#1C3552' : '#4CC8E8';
      ctx.fillRect(winTL.x - 4, winTR.y - 4, winTR.x - winTL.x + 8, winBL.y - winTR.y + 8);
    }

    // Live weather animation STRICTLY inside the window opening
    if (isRain) {
      const minX = winTL.x;
      const spanW = winTR.x - winTL.x;
      const minY = winTR.y;
      const spanH = winBL.y - winTR.y;
      for (const r of s.rainStreaks) {
        const rx = Math.round(minX + r.x * spanW);
        const ry = Math.round(minY + r.y * spanH);
        const rLen = Math.max(4, Math.round(r.len * spanH * 0.85));
        ctx.fillStyle = '#C2F0FF';
        for (let k = 0; k < rLen; k++) {
          ctx.fillRect(rx - (k >> 1), ry + k, 1, 1);
        }
      }
    } else {
      // Sparkling turquoise sea sun-glints inside the sunny window vista
      ctx.fillStyle = '#FFF9D2';
      for (let g = 0; g < 7; g++) {
        const fracU = ((g * 0.17 + (s.tickCount >> 2) * 0.03) % 0.84) + 0.08;
        const fracV = 0.56 + (g % 3) * 0.1;
        const gx = Math.round(winTL.x + (winTR.x - winTL.x) * fracU);
        const gy = Math.round(
          winTL.y + (winTR.y - winTL.y) * fracU + (winBL.y - winTL.y) * fracV
        );
        ctx.fillRect(gx, gy, 3 + (g % 2), 1);
      }
    }
    ctx.restore();

    // 3D Recessed Teak Jamb Thickness along window right reveal & bottom sill
    drawSolidIsoQuad(
      ctx,
      [P(0, wV0, wZ1), P(-0.24, wV0, wZ1), P(-0.24, wV0, wZ0), P(0, wV0, wZ0)],
      '#582F15'
    );
    drawSolidIsoQuad(
      ctx,
      [P(-0.24, wV1, wZ0), P(-0.24, wV0, wZ0), P(0, wV0, wZ0), P(0, wV1, wZ0)],
      '#9E6134',
      '#4A260E'
    );

    // Step 3B: Hinged Louver Teak Shutters — 100% Pixel-Flush Closed OR Cleanly Swung Open!
    if (!s.windowOpen) {
      // Closed: left & right shutter leaves meet flush at wMidV with ZERO gap and ZERO orange leak!
      drawLouverShutterLeaf(ctx, cfg, 0.02, wV0, wMidV, wZ0, wZ1, !isRain);
      drawLouverShutterLeaf(ctx, cfg, 0.02, wMidV, wV1, wZ0, wZ1, !isRain);
      // Center vertical stile + gleaming brass latch
      const latchPt = P(0.03, wMidV, (wZ0 + wZ1) * 0.5);
      ctx.fillStyle = '#3B1D0B';
      ctx.fillRect(Math.round(latchPt.x) - 1, Math.round(latchPt.y) - 3, 3, 6);
      ctx.fillStyle = '#F6CE52';
      ctx.fillRect(Math.round(latchPt.x), Math.round(latchPt.y) - 2, 2, 4);
    } else {
      // Open: left leaf folds outward onto wall [wV1 .. wV1 + 1.0], right leaf folds onto [wV0 - 1.0 .. wV0]
      drawLouverShutterLeaf(ctx, cfg, 0.04, wV0 - 0.95, wV0, wZ0, wZ1, !isRain);
      drawLouverShutterLeaf(ctx, cfg, 0.04, wV1, wV1 + 0.95, wZ0, wZ1, !isRain);
    }

    // Recessed Tile Shampoo Niche on Left Wall (v in [0.65..1.55], z in [2.95..3.85])
    const nTL = P(0, 1.55, 3.85);
    const nTR = P(0, 0.65, 3.85);
    const nBR = P(0, 0.65, 2.95);
    const nBL = P(0, 1.55, 2.95);
    drawSolidIsoQuad(ctx, [nTL, nTR, nBR, nBL], '#1B646D', '#104249');
    drawSolidIsoQuad(
      ctx,
      [P(-0.18, 1.55, 2.95), P(-0.18, 0.65, 2.95), nBR, nBL],
      '#46B6BE'
    );
    // Tiny pixel amber shampoo bottle & ivory spa soap resting on niche ledge
    const bottleBase = P(0, 1.25, 3.02);
    ctx.fillStyle = '#2B1508';
    ctx.fillRect(Math.round(bottleBase.x) - 3, Math.round(bottleBase.y) - 10, 6, 10);
    ctx.fillStyle = '#C96828';
    ctx.fillRect(Math.round(bottleBase.x) - 2, Math.round(bottleBase.y) - 8, 4, 7);
    ctx.fillStyle = '#F2C063';
    ctx.fillRect(Math.round(bottleBase.x) - 1, Math.round(bottleBase.y) - 10, 2, 2);
    const soapBase = P(0, 0.88, 3.04);
    ctx.fillStyle = '#3B281E';
    ctx.fillRect(Math.round(soapBase.x) - 3, Math.round(soapBase.y) - 4, 6, 4);
    ctx.fillStyle = '#F7DEC2';
    ctx.fillRect(Math.round(soapBase.x) - 2, Math.round(soapBase.y) - 3, 4, 2);

    // =========================================================================
    // LAYER 4: RIGHT-WALL MODULAR FIXTURES & BAKED WARM LANTERN RADIOSITY
    // =========================================================================
    // Warm flickering lantern radiosity bounce on the stucco vanity alcove wall
    const lanternAnchor = P(5.32, 0.08, 3.35);
    const lanternGlow = isRain ? lanternRainGlowRef.current : lanternSunGlowRef.current;
    if (lanternGlow) {
      const flicker =
        0.86 + Math.sin(s.tickCount * 0.22) * 0.1 + Math.cos(s.tickCount * 0.37) * 0.05;
      ctx.save();
      ctx.globalAlpha = (isRain ? 0.64 : 0.32) * flicker;
      ctx.drawImage(
        lanternGlow,
        Math.round(lanternAnchor.x - lanternGlow.width * 0.5),
        Math.round(lanternAnchor.y - lanternGlow.height * 0.5)
      );
      ctx.restore();
    }

    // Framed Sunset Ocean Wave Painting (flipped flush onto right isometric wall!)
    const paintAnchor = P(6.85, 0.06, 3.35);
    if (a.paintingWave) {
      ctx.drawImage(
        a.paintingWave,
        Math.round(paintAnchor.x - a.paintingWave.width * 0.5),
        Math.round(paintAnchor.y - a.paintingWave.height * 0.5)
      );
    }

    // Brass Wall Lantern Sconce Sprite
    if (a.lanternBrass) {
      ctx.drawImage(
        a.lanternBrass,
        Math.round(lanternAnchor.x - a.lanternBrass.width * 0.55),
        Math.round(lanternAnchor.y - a.lanternBrass.height * 0.52)
      );
    }

    // Antique Arched Brass Rain Shower Fixture mounted cleanly above the teak duckboard center
    const showerWallMount = P(2.85, 0.14, 2.75);
    let showerNozzlePx = P(2.05, 1.38, 3.62);
    let showerHitPts: IsoPt2[] = [];
    if (a.showerBrass) {
      const sx = Math.round(showerWallMount.x - a.showerBrass.width * 0.74);
      const sy = Math.round(showerWallMount.y - a.showerBrass.height * 0.58);
      // Subtle baked wall drop shadow behind brass pipe so it stands crisply off the mosaic tiles
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.filter = 'brightness(0)';
      ctx.drawImage(a.showerBrass, sx + 2, sy + 2);
      ctx.restore();
      ctx.drawImage(a.showerBrass, sx, sy);
      // Exact measured showerhead underside disc position on the sprite (26% X, 34% Y)
      showerNozzlePx = {
        x: Math.round(sx + a.showerBrass.width * 0.26),
        y: Math.round(sy + a.showerBrass.height * 0.34),
      };
      showerHitPts = [
        { x: sx - 4, y: sy - 2 },
        { x: sx + a.showerBrass.width + 4, y: sy - 2 },
        { x: sx + a.showerBrass.width + 4, y: sy + a.showerBrass.height + 6 },
        { x: sx - 4, y: sy + a.showerBrass.height + 6 },
      ];
    }

    // =========================================================================
    // LAYER 5: TRUE DEPTH-SORTED PAINTER'S ALGORITHM OBJECT QUEUE
    // (Every tub layer, duckboard, 6-frame shower water, vanity, radio, bucket,
    //  stool, and monstera is sorted strictly by isometric depth (u + v, priority)!)
    // =========================================================================
    const queue: RenderQueueItem[] = [];

    // 5.1 Slatted Teak Shower Duckboard (u: 0.7..3.45, v: 0.45..2.35, z: 0.10)
    const duckboardFloorCenter = P(2.05, 1.38, 0.1);
    queue.push({
      id: 'duckboard',
      u: 2.05,
      v: 1.38,
      z: 0.05,
      priority: -15,
      draw: (c) => {
        const du0 = 0.7;
        const du1 = 3.45;
        const dv0 = 0.45;
        const dv1 = 2.35;
        const dz = 0.1;
        // Baked contact shadow under duckboard
        drawSolidIsoQuad(
          c,
          [P(du0, dv1, 0), P(du1, dv1, 0), P(du1, dv0, 0), P(du0, dv0, 0)],
          'rgba(6, 18, 26, 0.52)'
        );
        // Duckboard front-left & front-right thickness edges
        drawSolidIsoQuad(
          c,
          [P(du0, dv1, dz), P(du1, dv1, dz), P(du1, dv1, 0), P(du0, dv1, 0)],
          '#5E3217'
        );
        drawSolidIsoQuad(
          c,
          [P(du1, dv1, dz), P(du1, dv0, dz), P(du1, dv0, 0), P(du1, dv1, 0)],
          '#47240F'
        );
        // Individual teak slats with crisp dark water-drainage slots
        const slats = 7;
        for (let k = 0; k < slats; k++) {
          const sv0 = dv0 + (dv1 - dv0) * (k / slats);
          const sv1 = dv0 + (dv1 - dv0) * ((k + 0.8) / slats);
          const wetTint = s.showerMode !== 'off' && k >= 1 && k <= 5 ? '#874D24' : '#A26030';
          drawSolidIsoQuad(
            c,
            [P(du0, sv0, dz), P(du1, sv0, dz), P(du1, sv1, dz), P(du0, sv1, dz)],
            wetTint,
            '#3F1E0C'
          );
          if (s.showerMode !== 'off' && k >= 2 && k <= 4) {
            // Wet glistening sheen across center slats under rain shower
            const gl0 = P(du0 + 0.45, (sv0 + sv1) * 0.5, dz);
            const gl1 = P(du1 - 0.55, (sv0 + sv1) * 0.5, dz);
            c.strokeStyle = 'rgba(186, 245, 255, 0.42)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(gl0.x, gl0.y);
            c.lineTo(gl1.x, gl1.y);
            c.stroke();
          }
        }
      },
    });

    // 5.2 Multi-Frame (6-Frame) Hand-Crafted Pixel Shower Water Stream & Splash
    if (s.showerMode !== 'off') {
      const mode = s.showerMode;
      queue.push({
        id: 'shower-water',
        u: 2.05,
        v: 1.38,
        z: 1.8,
        priority: 4,
        draw: (c) => {
          const frameIdx = Math.floor(s.tickCount / 2) % 6;
          drawSixFramePixelShowerWater(
            c,
            showerNozzlePx.x,
            showerNozzlePx.y,
            duckboardFloorCenter.y,
            frameIdx,
            mode
          );
        },
      });
    }

    // 5.3 Sunken Mosaic Soaking Tub — SPLIT INTO 5 TRUE DEPTH-SORTED LAYERS!
    // Footprint: u in [0.18..3.08], v in [2.65..6.85], height z in [0..1.22], wall rim thickness = 0.34
    const tU0 = 0.18;
    const tU1 = 3.08;
    const tV0 = 2.65;
    const tV1 = 6.85;
    const tH = 1.22;
    const tRim = 0.34;
    const waterZ = 0.96;

    // Tub Layer 1: Inner back-left & back-right ceramic mosaic cavity walls
    queue.push({
      id: 'tub-back-inner',
      u: 1.65,
      v: 4.75,
      z: 0.4,
      priority: -12,
      draw: (c) => {
        // Baked floor shadow around soaking tub base
        drawPixelContactShadow(c, P(1.8, 5.2, 0).x, P(1.8, 5.2, 0).y + 4, 44, 22, 0.38);

        // Top back-left rim & back-right rim behind the water
        drawSolidIsoQuad(
          c,
          [P(tU0, tV1, tH), P(tU0, tV0, tH), P(tU0 + tRim, tV0, tH), P(tU0 + tRim, tV1, tH)],
          '#62D4D8',
          '#1D5E66'
        );
        drawSolidIsoQuad(
          c,
          [P(tU0, tV0, tH), P(tU1, tV0, tH), P(tU1, tV0 + tRim, tH), P(tU0, tV0 + tRim, tH)],
          '#55C6CC',
          '#1D5E66'
        );
        // Inner wet basin walls descending down to water level
        drawSolidIsoQuad(
          c,
          [
            P(tU0 + tRim, tV1 - tRim, tH),
            P(tU0 + tRim, tV0 + tRim, tH),
            P(tU0 + tRim, tV0 + tRim, waterZ - 0.15),
            P(tU0 + tRim, tV1 - tRim, waterZ - 0.15),
          ],
          '#278994'
        );
        drawSolidIsoQuad(
          c,
          [
            P(tU0 + tRim, tV0 + tRim, tH),
            P(tU1 - tRim, tV0 + tRim, tH),
            P(tU1 - tRim, tV0 + tRim, waterZ - 0.15),
            P(tU0 + tRim, tV0 + tRim, waterZ - 0.15),
          ],
          '#1D737F'
        );
      },
    });

    // Tub Layer 2: Dynamic Shimmering Turquoise Tub Water Surface (nested inside cavity!)
    queue.push({
      id: 'tub-water',
      u: 1.65,
      v: 4.75,
      z: waterZ,
      priority: -6,
      draw: (c) => {
        const wPts = [
          P(tU0 + tRim, tV0 + tRim, waterZ),
          P(tU1 - tRim, tV0 + tRim, waterZ),
          P(tU1 - tRim, tV1 - tRim, waterZ),
          P(tU0 + tRim, tV1 - tRim, waterZ),
        ];
        drawSolidIsoQuad(c, wPts, isRain ? '#3BB5C8' : '#4FD2E0');

        // Animated pixel caustic glints & gentle surface wave ripples clipped inside tub water
        c.save();
        c.beginPath();
        c.moveTo(wPts[0].x, wPts[0].y);
        for (let i = 1; i < wPts.length; i++) c.lineTo(wPts[i].x, wPts[i].y);
        c.closePath();
        c.clip();

        for (let i = 0; i < 8; i++) {
          const waveShift = ((s.tickCount >> 2) + i * 5) % 20;
          const uPos = tU0 + tRim + 0.2 + ((i * 0.43 + waveShift * 0.04) % (tU1 - tU0 - 2 * tRim - 0.4));
          const vPos = tV0 + tRim + 0.35 + ((i * 0.67) % (tV1 - tV0 - 2 * tRim - 0.6));
          const gp = P(uPos, vPos, waterZ);
          c.fillStyle = i % 2 === 0 ? 'rgba(225, 254, 255, 0.8)' : 'rgba(138, 242, 248, 0.62)';
          c.fillRect(Math.round(gp.x) - 2, Math.round(gp.y), 4 + (i % 3), 1);
        }

        // Expanding ripple ring around the rubber ducky when clicked!
        if (duckyBounceRef.current > 0.04) {
          const dp = P(1.62, 5.45, waterZ);
          const expand = (1 - duckyBounceRef.current) * 14 + 4;
          c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(dp.x, dp.y - expand * 0.5);
          c.lineTo(dp.x + expand, dp.y);
          c.lineTo(dp.x, dp.y + expand * 0.5);
          c.lineTo(dp.x - expand, dp.y);
          c.closePath();
          c.stroke();
        }
        c.restore();
      },
    });

    // Tub Layer 3: Floating Modular AI Pixel Rubber Ducky inside Tub Water (clickable!)
    const duckyCenter = P(1.62, 5.45, waterZ);
    const duckyHitPts: IsoPt2[] = [
      { x: duckyCenter.x - 10, y: duckyCenter.y - 14 },
      { x: duckyCenter.x + 10, y: duckyCenter.y - 14 },
      { x: duckyCenter.x + 10, y: duckyCenter.y + 6 },
      { x: duckyCenter.x - 10, y: duckyCenter.y + 6 },
    ];
    queue.push({
      id: 'tub-ducky',
      u: 1.65,
      v: 4.75,
      z: waterZ + 0.2,
      priority: -2,
      draw: (c) => {
        const bob =
          Math.sin(s.tickCount * 0.16) * 1.1 - Math.sin(duckyBounceRef.current * Math.PI) * 3.5;
        // Tiny dark teal reflection beneath floating ducky
        c.fillStyle = 'rgba(16, 78, 92, 0.52)';
        c.fillRect(Math.round(duckyCenter.x) - 5, Math.round(duckyCenter.y) + 1, 10, 3);
        if (a.duckyYellow) {
          c.drawImage(
            a.duckyYellow,
            Math.round(duckyCenter.x - a.duckyYellow.width * 0.5),
            Math.round(duckyCenter.y - a.duckyYellow.height * 0.78 + bob)
          );
        }
      },
    });

    // Tub Layer 4: Modular AI Pixel Bamboo Bath Caddy Spanning Across Tub Rims!
    queue.push({
      id: 'tub-caddy',
      u: 1.65,
      v: 4.75,
      z: tH + 0.08,
      priority: 2,
      draw: (c) => {
        const cp = P(1.64, 3.92, tH + 0.04);
        if (a.bathCaddy) {
          // Soft shadow cast onto tub water below caddy
          drawSolidIsoQuad(
            c,
            [
              P(tU0 + tRim, 3.62, waterZ),
              P(tU1 - tRim, 3.62, waterZ),
              P(tU1 - tRim, 4.32, waterZ),
              P(tU0 + tRim, 4.32, waterZ),
            ],
            'rgba(10, 52, 66, 0.34)'
          );
          c.drawImage(
            a.bathCaddy,
            Math.round(cp.x - a.bathCaddy.width * 0.5),
            Math.round(cp.y - a.bathCaddy.height * 0.56)
          );
        }
      },
    });

    // Tub Layer 5: Front-Left & Front-Right Outer Glazed Mosaic Walls & Rim Cap (TRUE FOREGROUND OCCLUSION!)
    queue.push({
      id: 'tub-front-mask',
      u: 1.65,
      v: 4.75,
      z: tH,
      priority: 9,
      draw: (c) => {
        // Front-left outer mosaic face (v = tV1, u: tU0..tU1, z: 0..tH)
        if (a.wallMosaicLeft) {
          drawTexturedIsoQuad(
            c,
            a.wallMosaicLeft,
            P(tU0, tV1, tH),
            P(tU1, tV1, tH),
            P(tU0, tV1, 0),
            1.25,
            0.55,
            'rgba(10, 42, 54, 0.1)'
          );
        } else {
          drawSolidIsoQuad(
            c,
            [P(tU0, tV1, tH), P(tU1, tV1, tH), P(tU1, tV1, 0), P(tU0, tV1, 0)],
            '#38B2BA'
          );
        }
        // Front-right outer mosaic face (u = tU1, v: tV0..tV1, z: 0..tH)
        if (a.wallMosaicRight) {
          drawTexturedIsoQuad(
            c,
            a.wallMosaicRight,
            P(tU1, tV1, tH),
            P(tU1, tV0, tH),
            P(tU1, tV1, 0),
            1.65,
            0.55,
            'rgba(8, 30, 44, 0.24)'
          );
        } else {
          drawSolidIsoQuad(
            c,
            [P(tU1, tV1, tH), P(tU1, tV0, tH), P(tU1, tV0, 0), P(tU1, tV1, 0)],
            '#248692'
          );
        }
        // Front top tiled rim caps sealing the tub cleanly over the water edge
        drawSolidIsoQuad(
          c,
          [P(tU0, tV1, tH), P(tU1, tV1, tH), P(tU1, tV1 - tRim, tH), P(tU0, tV1 - tRim, tH)],
          '#6ADDE0',
          '#1A5C66'
        );
        drawSolidIsoQuad(
          c,
          [P(tU1 - tRim, tV1, tH), P(tU1, tV1, tH), P(tU1, tV0, tH), P(tU1 - tRim, tV0, tH)],
          '#52C4CA',
          '#1A5C66'
        );
      },
    });

    // 5.4 Modular Teak Louvered Vanity Cabinet + White Ceramic Vessel Sink (u: 6.15, v: 1.25)
    queue.push({
      id: 'vanity-sink',
      u: 6.15,
      v: 1.25,
      z: 0,
      priority: 0,
      draw: (c) => {
        const vp = P(6.15, 1.35, 0);
        drawPixelContactShadow(c, vp.x, vp.y - 2, 28, 13, 0.48);
        if (a.vanitySink) {
          c.drawImage(
            a.vanitySink,
            Math.round(vp.x - a.vanitySink.width * 0.5),
            Math.round(vp.y - a.vanitySink.height * 0.86)
          );
        }
      },
    });

    // 5.5 Modular Yellow Waterproof Shower Radio — seated squarely on the flat teak vanity countertop
    // beside the ceramic vessel sink, well right of the brass wall lantern so notes float into clear air!
    const radioAnchor = P(6.95, 1.24, 1.88);
    const radioHitPts: IsoPt2[] = [
      { x: radioAnchor.x - 12, y: radioAnchor.y - 16 },
      { x: radioAnchor.x + 12, y: radioAnchor.y - 16 },
      { x: radioAnchor.x + 12, y: radioAnchor.y + 6 },
      { x: radioAnchor.x - 12, y: radioAnchor.y + 6 },
    ];
    queue.push({
      id: 'radio-yellow',
      u: 6.95,
      v: 1.24,
      z: 1.88,
      priority: 8,
      draw: (c) => {
        drawPixelContactShadow(c, radioAnchor.x, radioAnchor.y + 1, 7, 3, 0.38);
        if (a.radioYellow) {
          c.drawImage(
            a.radioYellow,
            Math.round(radioAnchor.x - a.radioYellow.width * 0.5),
            Math.round(radioAnchor.y - a.radioYellow.height * 0.82)
          );
        }
      },
    });

    // 5.6 Modular Hinoki Wooden Spa Bucket with Copper Hoops (u: 3.95, v: 4.85)
    queue.push({
      id: 'bucket-hinoki',
      u: 3.95,
      v: 4.85,
      z: 0,
      priority: 0,
      draw: (c) => {
        const bp = P(3.95, 4.85, 0);
        // Subtle wet water puddle glistening on mosaic tiles beside bucket
        c.fillStyle = 'rgba(130, 232, 245, 0.42)';
        c.fillRect(Math.round(bp.x) - 10, Math.round(bp.y) + 2, 18, 4);
        c.fillRect(Math.round(bp.x) - 6, Math.round(bp.y) + 5, 11, 2);
        drawPixelContactShadow(c, bp.x, bp.y + 1, 13, 6, 0.48);
        if (a.bucketHinoki) {
          c.drawImage(
            a.bucketHinoki,
            Math.round(bp.x - a.bucketHinoki.width * 0.5),
            Math.round(bp.y - a.bucketHinoki.height * 0.82)
          );
        }
      },
    });

    // 5.7 Modular Cedar 2-Step Bath Stool in front of soaking tub (u: 3.55, v: 6.55)
    queue.push({
      id: 'stool-wood',
      u: 3.55,
      v: 6.55,
      z: 0,
      priority: 0,
      draw: (c) => {
        const sp = P(3.55, 6.55, 0);
        drawPixelContactShadow(c, sp.x, sp.y + 1, 15, 7, 0.5);
        if (a.stoolWood) {
          c.drawImage(
            a.stoolWood,
            Math.round(sp.x - a.stoolWood.width * 0.5),
            Math.round(sp.y - a.stoolWood.height * 0.84)
          );
        }
      },
    });

    // 5.8 Modular Foreground Potted Tropical Monstera Plant (u: 6.35, v: 6.45)
    queue.push({
      id: 'monstera-pot',
      u: 6.35,
      v: 6.45,
      z: 0,
      priority: 2,
      draw: (c) => {
        const mp = P(6.35, 6.45, 0);
        drawPixelContactShadow(c, mp.x, mp.y + 1, 15, 7, 0.52);
        if (a.monsteraPot) {
          c.drawImage(
            a.monsteraPot,
            Math.round(mp.x - a.monsteraPot.width * 0.5),
            Math.round(mp.y - a.monsteraPot.height * 0.88)
          );
        }
      },
    });

    // Execute Strict Isometric Painter's Order Render Queue!
    const sortedQueue = sortIsoRenderItems(queue);
    for (const item of sortedQueue) {
      item.draw(ctx);
    }

    // =========================================================================
    // LAYER 6: BAKED WINDOW SUNBEAM / RAINLIGHT SHAFT, BAYER STEAM & RADIO NOTES
    // =========================================================================
    if (s.windowOpen) {
      // Diagonal light shaft pouring from open left-wall sea window onto the soaking tub!
      ctx.save();
      ctx.fillStyle = isRain
        ? 'rgba(136, 206, 240, 0.10)'
        : 'rgba(255, 244, 186, 0.16)';
      const beamPts = [winTL, winTR, P(3.3, wV0 + 0.6, 0.4), P(3.3, wV1 + 0.3, 0.4)];
      ctx.beginPath();
      ctx.moveTo(beamPts[0].x, beamPts[0].y);
      for (let i = 1; i < beamPts.length; i++) ctx.lineTo(beamPts[i].x, beamPts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Rising Bayer-Dithered Hot-Water Steam Puffs drifting gracefully above shower & tub
    if (s.steamPuffs.length > 0 && (s.showerMode === 'hot' || s.steamLevel > 30)) {
      for (const puff of s.steamPuffs) {
        const rad = Math.max(4, Math.min(9, Math.round(puff.radius)));
        const dense = puff.alpha > 0.22;
        const key = `${rad}-${dense ? 1 : 0}`;
        let stSprite = steamSpritesRef.current.get(key);
        if (!stSprite) {
          stSprite = buildDitherSteamSprite(rad, dense);
          steamSpritesRef.current.set(key, stSprite);
        }
        const fracZ = Math.max(0, Math.min(1, (puff.z - 0.35) / 4.2));
        const driftX = (puff.u - 6.3) * 14 - fracZ * (s.windowOpen ? 22 : 5);
        const px = Math.round(showerNozzlePx.x + driftX);
        const py = Math.round(
          duckboardFloorCenter.y - 6 - fracZ * (duckboardFloorCenter.y - showerNozzlePx.y + 16)
        );
        ctx.save();
        ctx.globalAlpha = Math.min(0.62, puff.alpha * 1.35);
        ctx.drawImage(stSprite, px - rad, py - rad);
        ctx.restore();
      }
    }

    // Floating Pixel Eighth-Notes Rising from Yellow Radio into Clear Right-Side Air (ZERO Lantern Overlap!)
    if (s.radioOn) {
      const noteColors = ['#FFE854', '#70F5FF', '#FF99C8'];
      for (const n of s.radioNotes) {
        const rise = Math.max(0, (n.z - 1.85) * 16);
        const swayX = Math.sin((s.tickCount + n.life) * 0.14) * 4 + 4;
        drawPixelMusicNote(
          ctx,
          radioAnchor.x + swayX,
          radioAnchor.y - 16 - rise,
          noteColors[n.hueIdx % noteColors.length]
        );
      }
    }

    // Update exact interactive hitboxes
    hitPolysRef.current = [
      { kind: 'radio', points: radioHitPts },
      { kind: 'ducky', points: duckyHitPts },
      { kind: 'shower', points: showerHitPts },
      { kind: 'window', points: winOuterPts },
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
      if (duckyBounceRef.current > 0) {
        duckyBounceRef.current = Math.max(0, duckyBounceRef.current - 0.08);
      }
      renderModularIsoScene();
      hudTick += 1;
      if (hudTick % 7 === 0) {
        syncHudNow();
      }
      timer = window.setTimeout(loop, 80);
    };

    renderModularIsoScene();
    timer = window.setTimeout(loop, 80);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [renderModularIsoScene, syncHudNow]);

  const toBufferCoords = (ev: React.MouseEvent<HTMLCanvasElement>): IsoPt2 | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
      y: ((ev.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const hitTest = (pt: IsoPt2): HitPolygon['kind'] | null => {
    for (const poly of hitPolysRef.current) {
      if (poly.points.length >= 3 && pointInPoly(pt.x, pt.y, poly.points)) {
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

  const handlePokeDucky = () => {
    duckyBounceRef.current = 1.0;
    audioRef.current?.playSplash();
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
    } else if (kind === 'ducky') {
      handlePokeDucky();
    }
  };

  const handleCanvasMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toBufferCoords(ev);
    if (!pt) return;
    const kind = hitTest(pt);
    if (kind === 'window') {
      setHoverHint('百叶窗');
    } else if (kind === 'shower') {
      setHoverHint('花洒');
    } else if (kind === 'radio') {
      setHoverHint('收音机');
    } else if (kind === 'ducky') {
      setHoverHint('小黄鸭');
    } else {
      setHoverHint('就绪');
    }
  };

  const showerLabel =
    hud.showerMode === 'hot'
      ? '花洒: 热水'
      : hud.showerMode === 'cold'
        ? '花洒: 冷水'
        : '花洒: 关';

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
                    {mode === 'hot' ? '热水 (43°C)' : mode === 'cold' ? '冷水 (21°C)' : '关闭花洒'}
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
                {hud.windowOpen ? '合上百叶窗' : '推开百叶窗'}
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
            <div className="absolute left-0 top-full w-[170px] win2k-raised bg-[#D4D0C8] py-0.5 z-50">
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
                  <span>{w === 'rain' ? '雨夜' : '晴日'}</span>
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
                <span>关闭收音机</span>
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
                <span>音效</span>
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

      {/* Main Modular 2.5D Depth-Sorted Isometric Pixel Bathhouse Viewport */}
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
            百叶窗: {hud.windowOpen ? '开' : '关'}
          </button>

          <button
            type="button"
            className="win2k-raised bg-[#D4D0C8] px-2 py-0.5 whitespace-nowrap active:win2k-sunken"
            onClick={handleToggleWeather}
          >
            天气: {hud.weather === 'rain' ? '雨夜' : '晴日'}
          </button>

          <button
            type="button"
            className={`px-2 py-0.5 whitespace-nowrap ${
              hud.radioOn ? 'win2k-sunken bg-[#EAE6DE]' : 'win2k-raised bg-[#D4D0C8]'
            }`}
            onClick={handleToggleRadio}
          >
            收音机: {hud.radioOn ? `FM ${hud.radioStation + 1}` : '关'}
          </button>
        </div>
      </div>

      {/* Classic Win2K Sunken Status Bar */}
      <div className="h-[20px] flex items-center gap-1 px-1 pb-0.5 bg-[#D4D0C8] shrink-0">
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center flex-1 truncate">
          {hoverHint}
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center shrink-0 whitespace-nowrap">
          水温 {hud.waterTempC}°C · 蒸汽 {hud.steamPct}%
        </div>
        <div className="win2k-sunken px-1.5 h-[17px] flex items-center min-w-[148px] shrink-0 truncate">
          {hud.radioOn ? RADIO_STATION_NAMES[hud.radioStation] : '静音'}
        </div>
      </div>

      {showGuideModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/25"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="win2k-window bg-[#D4D0C8] w-[260px] p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win2k-titlebar-active h-[20px] px-1.5 flex items-center justify-between text-white font-bold">
              <span>关于 棕榈浴场</span>
              <button
                type="button"
                className="win2k-raised bg-[#D4D0C8] text-black w-[15px] h-[14px] flex items-center justify-center text-[10px]"
                onClick={() => setShowGuideModal(false)}
              >
                ×
              </button>
            </div>
            <div className="p-3 flex gap-3 items-center">
              <Win2kIcon kind="palm-bath" size={32} />
              <div className="space-y-1">
                <div className="font-bold">棕榈浴场</div>
                <div className="text-[#404040]">版本 1.0</div>
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
