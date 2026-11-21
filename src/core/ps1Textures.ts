import * as THREE from 'three';
import bambooBarAlbedoUrl from '../assets/images/bamboo_bar_albedo_1794731022256.jpg';
import bambooBarRoughnessUrl from '../assets/images/bamboo_bar_roughness_1794731024445.jpg';
import cocktailFoamUrl from '../assets/images/cocktail_pulp_foam_albedo_1794754880838.jpg';
import crystalHeightUrl from '../assets/images/cut_crystal_glass_height_1794754882146.jpg';
import driftwoodBarUrl from '../assets/images/ps1_driftwood_bar_tex_1795099212018.jpg';
import glassCondensationUrl from '../assets/images/glass_condensation_roughness_1794731026343.jpg';
import oceanWavesUrl from '../assets/images/ps1_ocean_waves_tex_1795099193568.jpg';
import beachSandShellsUrl from '../assets/images/ps1_beach_sand_shells_tex_1795099189022.jpg';
import cocktailGlassUrl from '../assets/images/ps1_cocktail_glass_tex_1795099135764.jpg';
import tropicalLiquidUrl from '../assets/images/ps1_tropical_liquid_tex_1795099178959.jpg';
import umbrellaFloralUrl from '../assets/images/ps1_umbrella_floral_tex_1795099120486.jpg';
import rattanCoasterUrl from '../assets/images/ps1_rattan_coaster_1794753406543.jpg';
import tikiTotemUrl from '../assets/images/ps1_tiki_totem_carving_1794753411987.jpg';
import palmAtlasUrl from '../assets/images/ps1_palm_foliage_bark_1794753408180.jpg';
import skyNoonUrl from '../assets/images/ps1_beach_skybox_noon_1794753409684.jpg';
import skySunsetUrl from '../assets/images/ps1_beach_skybox_sunset_1794753405332.jpg';
import thatchAwningUrl from '../assets/images/ps1_thatch_awning_1794753413149.jpg';
import cocktailAtlasUrl from '../assets/images/ps1_cocktail_ice_fruit_1794753410881.jpg';
import wetSandUrl from '../assets/images/wet_coral_sand_albedo_1794754882862.jpg';

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

interface CropSpec {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface Ps1TexOpts {
  crop?: CropSpec;
  repeatX?: number;
  repeatY?: number;
  clamp?: boolean;
  fallbackColor?: string;
  alphaKeyMode?: 'none' | 'dark-circle' | 'dark-frond';
  alphaThreshold?: number;
  quantStep?: number;
  highKeyLuminance?: boolean;
}

function quantizeCanvasPs1(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step = 8,
  alphaKeyMode: 'none' | 'dark-circle' | 'dark-frond' = 'none',
  alphaThreshold = 58,
  highKeyLuminance = false
): void {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const maxR2 = (w * 0.47) * (w * 0.47);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      if (alphaKeyMode === 'dark-frond') {
        const lum = r * 0.3 + g * 0.59 + b * 0.11;
        if (lum < alphaThreshold && g < r + 24) {
          d[i + 3] = 0;
          continue;
        }
      } else if (alphaKeyMode === 'dark-circle') {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist2 = dx * dx + dy * dy;
        const lum = r * 0.3 + g * 0.59 + b * 0.11;
        if (dist2 > maxR2 || (dist2 > maxR2 * 0.72 && lum < alphaThreshold)) {
          d[i + 3] = 0;
          continue;
        }
      }

      if (highKeyLuminance) {
        // Convert texture to crisp neutral high-key luminance [182..255] so tinting preserves vibrant drink color
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const boosted = Math.round(182 + (lum / 255) * 73);
        r = boosted;
        g = boosted;
        b = boosted;
      }

      const bayer = (BAYER_4X4[y & 3][x & 3] / 15 - 0.5) * step;
      d[i] = Math.max(0, Math.min(255, Math.round((r + bayer) / step) * step));
      d[i + 1] = Math.max(0, Math.min(255, Math.round((g + bayer) / step) * step));
      d[i + 2] = Math.max(0, Math.min(255, Math.round((b + bayer) / step) * step));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function loadPs1Texture(
  url: string,
  targetW: number,
  targetH: number,
  opts: Ps1TexOpts = {}
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = opts.fallbackColor ?? '#6E4224';
  ctx.fillRect(0, 0, targetW, targetH);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (opts.repeatX || opts.repeatY) {
    tex.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1);
  }

  const img = new Image();
  img.onload = () => {
    const crop = opts.crop ?? { sx: 0, sy: 0, sw: 1, sh: 1 };
    const sx = Math.floor(img.naturalWidth * crop.sx);
    const sy = Math.floor(img.naturalHeight * crop.sy);
    const sw = Math.max(1, Math.floor(img.naturalWidth * crop.sw));
    const sh = Math.max(1, Math.floor(img.naturalHeight * crop.sh));

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
    quantizeCanvasPs1(
      ctx,
      targetW,
      targetH,
      opts.quantStep ?? 8,
      opts.alphaKeyMode ?? 'none',
      opts.alphaThreshold ?? 62,
      opts.highKeyLuminance ?? false
    );
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

function createStripeStrawTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FFF7EA';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#E62E3D';
  for (let y = -32; y < 64; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(32, y + 16);
    ctx.lineTo(32, y + 20);
    ctx.lineTo(0, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

export interface Ps1TextureSet {
  barWood: THREE.CanvasTexture;
  barBamboo: THREE.CanvasTexture;
  barRelief: THREE.CanvasTexture;
  rattanMat: THREE.CanvasTexture;
  coaster: THREE.CanvasTexture;
  totemFront: THREE.CanvasTexture;
  palmBark: THREE.CanvasTexture;
  palmFrond: THREE.CanvasTexture;
  thatch: THREE.CanvasTexture;
  skyNoon: THREE.CanvasTexture;
  skySunset: THREE.CanvasTexture;
  ocean: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  wetSand: THREE.CanvasTexture;
  liquidFoam: THREE.CanvasTexture;
  glassCrystal: THREE.CanvasTexture;
  glassRelief: THREE.CanvasTexture;
  glassCondensation: THREE.CanvasTexture;
  liquidPulp: THREE.CanvasTexture;
  ice: THREE.CanvasTexture;
  umbrella: THREE.CanvasTexture;
  pineapple: THREE.CanvasTexture;
  lime: THREE.CanvasTexture;
  straw: THREE.CanvasTexture;
  dispose: () => void;
}

export function createPs1TextureSet(): Ps1TextureSet {
  const barWood = loadPs1Texture(driftwoodBarUrl, 128, 128, {
    repeatX: 2.2,
    repeatY: 1.2,
    fallbackColor: '#663418',
    quantStep: 8,
  });

  const barBamboo = loadPs1Texture(bambooBarAlbedoUrl, 128, 128, {
    repeatX: 3.2,
    repeatY: 1.2,
    fallbackColor: '#8B5B32',
    quantStep: 10,
  });
  const barRelief = loadPs1Texture(bambooBarRoughnessUrl, 96, 96, {
    repeatX: 3.2,
    repeatY: 1.2,
    fallbackColor: '#777777',
    quantStep: 12,
  });
  barRelief.colorSpace = THREE.NoColorSpace;

  const rattanMat = loadPs1Texture(rattanCoasterUrl, 96, 96, {
    repeatX: 2.4,
    repeatY: 1.5,
    fallbackColor: '#C98A36',
    quantStep: 10,
  });

  const coaster = loadPs1Texture(rattanCoasterUrl, 96, 96, {
    repeatX: 1,
    repeatY: 1,
    fallbackColor: '#D6993D',
    quantStep: 10,
  });

  const totemFront = loadPs1Texture(tikiTotemUrl, 96, 160, {
    crop: { sx: 0.23, sy: 0.01, sw: 0.54, sh: 0.98 },
    clamp: true,
    fallbackColor: '#5B4634',
    quantStep: 8,
  });

  const palmBark = loadPs1Texture(palmAtlasUrl, 64, 128, {
    crop: { sx: 0.52, sy: 0.02, sw: 0.46, sh: 0.96 },
    repeatX: 1,
    repeatY: 3,
    fallbackColor: '#6E4A2E',
    quantStep: 10,
  });

  const palmFrond = loadPs1Texture(palmAtlasUrl, 96, 128, {
    crop: { sx: 0.02, sy: 0.02, sw: 0.46, sh: 0.96 },
    clamp: true,
    alphaKeyMode: 'dark-frond',
    alphaThreshold: 44,
    fallbackColor: '#2B8E3A',
    quantStep: 10,
  });

  const thatch = loadPs1Texture(thatchAwningUrl, 128, 128, {
    repeatX: 5,
    repeatY: 1.5,
    fallbackColor: '#A8823A',
    quantStep: 10,
  });

  const skyNoon = loadPs1Texture(skyNoonUrl, 256, 128, {
    repeatX: 2,
    repeatY: 1,
    fallbackColor: '#40A6E8',
    quantStep: 8,
  });

  const skySunset = loadPs1Texture(skySunsetUrl, 256, 128, {
    repeatX: 2,
    repeatY: 1,
    fallbackColor: '#B85C4E',
    quantStep: 8,
  });

  const ocean = loadPs1Texture(oceanWavesUrl, 128, 128, {
    repeatX: 7,
    repeatY: 6,
    fallbackColor: '#0E97BF',
    quantStep: 8,
  });

  const sand = loadPs1Texture(beachSandShellsUrl, 128, 128, {
    repeatX: 7,
    repeatY: 3,
    fallbackColor: '#E8CA88',
    quantStep: 8,
  });
  const wetSand = loadPs1Texture(wetSandUrl, 128, 96, {
    repeatX: 5,
    repeatY: 1.5,
    fallbackColor: '#A87955',
    quantStep: 8,
  });
  const liquidFoam = loadPs1Texture(cocktailFoamUrl, 96, 96, {
    repeatX: 2,
    repeatY: 2,
    fallbackColor: '#FFF4DF',
    quantStep: 8,
    highKeyLuminance: true,
  });

  const glassCrystal = loadPs1Texture(cocktailGlassUrl, 128, 128, {
    repeatX: 2,
    repeatY: 1,
    fallbackColor: '#D6F6FF',
    quantStep: 10,
    highKeyLuminance: true,
  });
  const glassRelief = loadPs1Texture(crystalHeightUrl, 128, 128, {
    repeatX: 2,
    repeatY: 1,
    fallbackColor: '#808080',
    quantStep: 12,
  });
  glassRelief.colorSpace = THREE.NoColorSpace;
  const glassCondensation = loadPs1Texture(glassCondensationUrl, 128, 128, {
    repeatX: 2,
    repeatY: 1,
    fallbackColor: '#B0B0B0',
    quantStep: 12,
  });
  glassCondensation.colorSpace = THREE.NoColorSpace;

  const liquidPulp = loadPs1Texture(tropicalLiquidUrl, 128, 128, {
    repeatX: 2,
    repeatY: 2,
    fallbackColor: '#FFF5E0',
    quantStep: 8,
    highKeyLuminance: true,
  });

  const ice = loadPs1Texture(cocktailAtlasUrl, 64, 64, {
    crop: { sx: 0.08, sy: 0.08, sw: 0.36, sh: 0.36 },
    fallbackColor: '#CCF2FF',
    quantStep: 10,
  });

  const umbrella = loadPs1Texture(umbrellaFloralUrl, 128, 128, {
    clamp: true,
    fallbackColor: '#F55E42',
    quantStep: 8,
  });

  const pineapple = loadPs1Texture(cocktailAtlasUrl, 64, 64, {
    crop: { sx: 0.01, sy: 0.51, sw: 0.48, sh: 0.48 },
    fallbackColor: '#F2B429',
    quantStep: 10,
  });

  const lime = loadPs1Texture(cocktailAtlasUrl, 64, 64, {
    crop: { sx: 0.505, sy: 0.505, sw: 0.49, sh: 0.49 },
    clamp: true,
    alphaKeyMode: 'dark-circle',
    alphaThreshold: 68,
    fallbackColor: '#69D632',
    quantStep: 10,
  });

  const straw = createStripeStrawTexture();

  const all = [
    barWood,
    barBamboo,
    barRelief,
    rattanMat,
    coaster,
    totemFront,
    palmBark,
    palmFrond,
    thatch,
    skyNoon,
    skySunset,
    ocean,
    sand,
    wetSand,
    liquidFoam,
    glassCrystal,
    glassRelief,
    glassCondensation,
    liquidPulp,
    ice,
    umbrella,
    pineapple,
    lime,
    straw,
  ];

  return {
    barWood,
    barBamboo,
    barRelief,
    rattanMat,
    coaster,
    totemFront,
    palmBark,
    palmFrond,
    thatch,
    skyNoon,
    skySunset,
    ocean,
    sand,
    wetSand,
    liquidFoam,
    glassCrystal,
    glassRelief,
    glassCondensation,
    liquidPulp,
    ice,
    umbrella,
    pineapple,
    lime,
    straw,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}

/**
 * Remaps ConeGeometry UVs radially from center (0.5, 0.5) so pinwheel paper umbrella textures align cleanly.
 */
export function applyRadialPinwheelUvs(geo: THREE.BufferGeometry, height: number): void {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (!pos || !uv) return;
  const halfH = height * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const radial = Math.min(1, Math.max(0, 1 - (y + halfH) / Math.max(0.001, height)));
    const ang = Math.atan2(z, x);
    const u = 0.5 + Math.cos(ang) * radial * 0.47;
    const v = 0.5 + Math.sin(ang) * radial * 0.47;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}
