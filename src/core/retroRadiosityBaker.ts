import * as THREE from 'three';
import { BeachTimeId } from './cocktailCatalog';

export interface RadiosityRgb {
  r: number;
  g: number;
  b: number;
}

export interface RadiosityMoodConfig {
  sunDir: [number, number, number];
  sunColor: RadiosityRgb;
  sunIntensity: number;
  skyColor: RadiosityRgb;
  skyIntensity: number;
  oceanBounceColor: RadiosityRgb;
  oceanBounceIntensity: number;
  woodBounceColor: RadiosityRgb;
  woodBounceIntensity: number;
  torchColor: RadiosityRgb;
  torchIntensity: number;
  ambientFloor: RadiosityRgb;
}

export const RADIOSITY_MOODS: Record<BeachTimeId, RadiosityMoodConfig> = {
  noon: {
    sunDir: [0.46, 0.78, 0.42],
    sunColor: { r: 1.0, g: 0.96, b: 0.86 },
    sunIntensity: 1.18,
    skyColor: { r: 0.72, g: 0.91, b: 1.0 },
    skyIntensity: 0.62,
    oceanBounceColor: { r: 0.36, g: 0.88, b: 0.96 },
    oceanBounceIntensity: 0.44,
    woodBounceColor: { r: 0.95, g: 0.68, b: 0.38 },
    woodBounceIntensity: 0.32,
    torchColor: { r: 1.0, g: 0.56, b: 0.2 },
    torchIntensity: 0.24,
    ambientFloor: { r: 0.26, g: 0.24, b: 0.22 },
  },
  sunset: {
    sunDir: [-0.62, 0.48, 0.36],
    sunColor: { r: 1.0, g: 0.66, b: 0.36 },
    sunIntensity: 1.15,
    skyColor: { r: 1.0, g: 0.68, b: 0.56 },
    skyIntensity: 0.54,
    oceanBounceColor: { r: 0.92, g: 0.54, b: 0.44 },
    oceanBounceIntensity: 0.46,
    woodBounceColor: { r: 0.96, g: 0.54, b: 0.26 },
    woodBounceIntensity: 0.36,
    torchColor: { r: 1.0, g: 0.55, b: 0.18 },
    torchIntensity: 0.72,
    ambientFloor: { r: 0.24, g: 0.18, b: 0.16 },
  },
  torch: {
    sunDir: [0.3, 0.72, 0.38],
    sunColor: { r: 0.54, g: 0.72, b: 1.0 },
    sunIntensity: 0.46,
    skyColor: { r: 0.32, g: 0.48, b: 0.78 },
    skyIntensity: 0.42,
    oceanBounceColor: { r: 0.24, g: 0.54, b: 0.76 },
    oceanBounceIntensity: 0.34,
    woodBounceColor: { r: 0.96, g: 0.52, b: 0.22 },
    woodBounceIntensity: 0.42,
    torchColor: { r: 1.0, g: 0.6, b: 0.22 },
    torchIntensity: 1.65,
    ambientFloor: { r: 0.16, g: 0.16, b: 0.22 },
  },
};

interface CylinderOccluder {
  x: number;
  z: number;
  r: number;
  h: number;
  transmittance: number; // 0 = opaque, >0 = translucent glass
}

const COUNTER_OCCLUDERS: CylinderOccluder[] = [
  // Center cut-crystal cocktail glass (lets refracted light partially pass)
  { x: 0.0, z: 0.0, r: 0.62, h: 1.65, transmittance: 0.52 },
  // Left carved Polynesian Tiki idol
  { x: -1.72, z: -0.45, r: 0.34, h: 1.24, transmittance: 0.0 },
  // Right turned Koa ice & lime bowl
  { x: 1.66, z: -0.32, r: 0.4, h: 0.36, transmittance: 0.08 },
];

const TORCH_POSITIONS: Array<[number, number, number]> = [
  [-2.38, 2.28, -1.35],
  [2.38, 2.28, -1.35],
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Pure deterministic 3-bounce radiosity + soft raytraced shadow evaluator for a world point (wx, wz)
 * on the bar counter surface (y = 0). Exported for both Lightmap texture baking and unit tests.
 */
export function evaluateCounterRadiosity(
  wx: number,
  wz: number,
  mood: BeachTimeId
): RadiosityRgb {
  const cfg = RADIOSITY_MOODS[mood];
  const [sdx, sdy, sdz] = cfg.sunDir;
  const invLen = 1 / Math.hypot(sdx, sdy, sdz);
  const lx = sdx * invLen;
  const ly = Math.max(0.2, sdy * invLen);
  const lz = sdz * invLen;

  // 1. Direct Key Sun/Moon Visibility (soft penumbra raycast against occluders)
  let sunVis = 1.0;
  for (const occ of COUNTER_OCCLUDERS) {
    // Ray P(t) = (wx + lx*t, ly*t, wz + lz*t)
    const dx = occ.x - wx;
    const dz = occ.z - wz;
    const horizLen2 = lx * lx + lz * lz;
    if (horizLen2 > 1e-5) {
      const tProj = Math.max(0, (dx * lx + dz * lz) / horizLen2);
      const hitY = ly * tProj;
      if (hitY > 0.01 && hitY < occ.h * 1.15) {
        const perpX = wx + lx * tProj - occ.x;
        const perpZ = wz + lz * tProj - occ.z;
        const dist = Math.hypot(perpX, perpZ);
        const penumbra = 0.14 + hitY * 0.16;
        const block = 1 - smoothstep(occ.r * 0.65, occ.r + penumbra, dist);
        sunVis *= 1 - block * (1 - occ.transmittance) * 0.68;
      }
    }
  }

  // 2. Multi-Sample Hemisphere Contact Ambient Occlusion (crevices under glass, totem, bowl, back rail)
  let ao = 1.0;
  for (const occ of COUNTER_OCCLUDERS) {
    const d = Math.hypot(wx - occ.x, wz - occ.z);
    const contact = 1 - smoothstep(occ.r * 0.72, occ.r + 0.58, d);
    ao *= 1 - contact * (occ.transmittance > 0.3 ? 0.24 : 0.44);
  }
  // Subtle crevice AO near the back bamboo rail (z ~ -1.42)
  const railDist = Math.abs(wz - -1.42);
  ao *= 1 - (1 - smoothstep(0.05, 0.42, railDist)) * 0.22;

  // 3. Bounce 1: Sky Hemisphere Fill (crisp 1999 CG airy luminance)
  const skyFactor = cfg.skyIntensity * (0.45 + 0.55 * ao);

  // 4. Bounce 2: Ocean Horizon Turquoise/Coral Indirect Bounce (stronger along the sea-facing back half)
  const seaFacing = smoothstep(1.6, -1.35, wz);
  const oceanFactor = cfg.oceanBounceIntensity * (0.35 + 0.65 * seaFacing) * (0.55 + 0.45 * ao);

  // 5. Bounce 3: Warm Rattan Mat & Mahogany Wood Inter-Reflection (radiates outward from center mat)
  const matDist = Math.hypot(wx * 0.65, wz * 0.9);
  const matBounce = (1 - smoothstep(0.4, 2.5, matDist)) * cfg.woodBounceIntensity * (0.5 + 0.5 * sunVis);

  // 6. Twin Flanking Tiki Torch Radiosity Bounce (inverse-square warm pools)
  let torchSum = 0;
  for (const [tx, ty, tz] of TORCH_POSITIONS) {
    const d2 = (wx - tx) * (wx - tx) + ty * ty + (wz - tz) * (wz - tz);
    torchSum += (ty / Math.pow(d2 + 1.2, 1.15)) * cfg.torchIntensity * 2.2;
  }

  const directFactor = cfg.sunIntensity * Math.max(0.22, ly) * sunVis;

  // True 3-bounce irradiance accumulation scaled for rich non-clipping 1999 CG tonal range
  const r =
    cfg.ambientFloor.r * ao +
    cfg.sunColor.r * directFactor * 0.62 +
    cfg.skyColor.r * skyFactor * 0.42 +
    cfg.oceanBounceColor.r * oceanFactor * 0.48 +
    cfg.woodBounceColor.r * matBounce * 0.44 +
    cfg.torchColor.r * torchSum * 0.55;

  const g =
    cfg.ambientFloor.g * ao +
    cfg.sunColor.g * directFactor * 0.62 +
    cfg.skyColor.g * skyFactor * 0.42 +
    cfg.oceanBounceColor.g * oceanFactor * 0.48 +
    cfg.woodBounceColor.g * matBounce * 0.44 +
    cfg.torchColor.g * torchSum * 0.55;

  const b =
    cfg.ambientFloor.b * ao +
    cfg.sunColor.b * directFactor * 0.62 +
    cfg.skyColor.b * skyFactor * 0.42 +
    cfg.oceanBounceColor.b * oceanFactor * 0.48 +
    cfg.woodBounceColor.b * matBounce * 0.44 +
    cfg.torchColor.b * torchSum * 0.55;

  // Smooth filmic exponential rolloff preserves soft shadows, contact AO & torch pools without flat-white clipping
  const tone = (v: number) => Math.min(0.98, 1 - Math.exp(-Math.max(0, v) * 1.18));
  return {
    r: tone(r),
    g: tone(g),
    b: tone(b),
  };
}

/**
 * Bakes a 128x64 RGB Multi-Bounce Radiosity Lightmap Texture for the mahogany bar countertop.
 */
export function bakeCounterLightmap(mood: BeachTimeId): THREE.CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;

  // Counter spans x in [-4.1, 4.1], z in [-1.45, 1.95] (center z = 0.25, size 8.2 x 3.4)
  for (let py = 0; py < h; py++) {
    const v = py / (h - 1);
    const wz = -1.45 + v * 3.4;
    for (let px = 0; px < w; px++) {
      const u = px / (w - 1);
      const wx = -4.1 + u * 8.2;
      const col = evaluateCounterRadiosity(wx, wz, mood);
      const idx = (py * w + px) * 4;
      d[idx] = Math.round(col.r * 255);
      d[idx + 1] = Math.round(col.g * 255);
      d[idx + 2] = Math.round(col.b * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Bakes a warm multi-bounce vertical lightmap for the carved Tiki Idol & Bar Props
 * (warm mahogany up-bounce at the bottom, crisp sky/ocean rim light on edges, zero dead-black face!).
 */
export function bakePropRadiosityLightmap(mood: BeachTimeId): THREE.CanvasTexture {
  const w = 64;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const cfg = RADIOSITY_MOODS[mood];

  for (let py = 0; py < h; py++) {
    // py=0 is top, py=h-1 is bottom resting on counter
    const ny = 1 - py / (h - 1); // 0 bottom -> 1 top
    for (let px = 0; px < w; px++) {
      const nx = px / (w - 1); // 0 left -> 1 right
      const skyTop = (0.35 + 0.65 * ny) * cfg.skyIntensity * 0.55;
      const woodUpBounce = (1 - ny * 0.72) * (cfg.woodBounceIntensity + 0.25) * 0.52;
      const torchSide = (1 - nx * 0.65) * cfg.torchIntensity * 0.36;
      const oceanRim = nx * cfg.oceanBounceIntensity * 0.48;
      const direct = cfg.sunIntensity * (0.32 + 0.35 * ny) * 0.65;

      const r =
        0.24 +
        cfg.sunColor.r * direct +
        cfg.skyColor.r * skyTop +
        cfg.woodBounceColor.r * woodUpBounce +
        cfg.torchColor.r * torchSide +
        cfg.oceanBounceColor.r * oceanRim;
      const g =
        0.22 +
        cfg.sunColor.g * direct +
        cfg.skyColor.g * skyTop +
        cfg.woodBounceColor.g * woodUpBounce +
        cfg.torchColor.g * torchSide +
        cfg.oceanBounceColor.g * oceanRim;
      const b =
        0.22 +
        cfg.sunColor.b * direct +
        cfg.skyColor.b * skyTop +
        cfg.woodBounceColor.b * woodUpBounce +
        cfg.torchColor.b * torchSide +
        cfg.oceanBounceColor.b * oceanRim;

      const tone = (v: number) => Math.min(0.98, 1 - Math.exp(-Math.max(0, v) * 1.15));
      const idx = (py * w + px) * 4;
      d[idx] = Math.round(tone(r) * 255);
      d[idx + 1] = Math.round(tone(g) * 255);
      d[idx + 2] = Math.round(tone(b) * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Raytraces a silky luminous 1999 CG glass refraction caustic crescent + soft concentric jewel glow
 * (white luminance alpha-blended so the material color tints it dynamically to any cocktail!).
 */
export function bakeGlassCausticTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const cx = size * 0.5;
  const cy = size * 0.5;

  for (let y = 0; y < size; y++) {
    const ny = (y - cy) / (size * 0.46);
    for (let x = 0; x < size; x++) {
      const nx = (x - cx) / (size * 0.46);
      const r = Math.hypot(nx, ny);
      if (r >= 1.0) continue;

      const ang = Math.atan2(ny, nx);
      // Curved refractive crescent focused on the exit side (+X) of the cylindrical crystal glass
      const focusX = nx - 0.24;
      const focusR = Math.hypot(focusX * 1.15, ny * 0.92);
      const crescentArc = Math.exp(-Math.pow((focusR - 0.34) / 0.16, 2)) * smoothstep(-0.25, 0.55, nx);

      // Soft inner focal lens pool directly beneath/beside the refracting liquid core
      const innerPool = Math.exp(-(focusX * focusX * 3.8 + ny * ny * 4.4)) * 0.72;

      // Subtle 12-facet crystal caustic ripple modulation (smooth sine, never jagged spikes!)
      const facetShimmer = 0.84 + 0.16 * Math.cos(ang * 12.0 + r * 4.5);

      const radialFade = 1 - smoothstep(0.62, 0.98, r);
      const val = Math.min(1, (crescentArc * 0.92 + innerPool) * facetShimmer * radialFade);

      const idx = (y * size + x) * 4;
      const hotCore = Math.pow(val, 2.4) * 0.45;
      d[idx] = Math.round(Math.min(1, val + hotCore) * 255);
      d[idx + 1] = Math.round(Math.min(1, val * 0.96 + hotCore) * 255);
      d[idx + 2] = Math.round(Math.min(1, val * 0.92 + hotCore) * 255);
      d[idx + 3] = Math.round(val * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an equirectangular 1999 CG tropical studio reflection map (bright sky softboxes,
 * turquoise sea horizon, and warm amber wood bounce) for crisp raytraced crystal glassware & ice.
 */
export function bakeRetroStudioEnvMap(mood: BeachTimeId): THREE.CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (mood === 'noon') {
    grad.addColorStop(0.0, '#7AD8FF');
    grad.addColorStop(0.32, '#E8FAFF');
    grad.addColorStop(0.49, '#FFFFFF');
    grad.addColorStop(0.52, '#22C8E8');
    grad.addColorStop(0.75, '#8A5226');
    grad.addColorStop(1.0, '#4E2A12');
  } else if (mood === 'sunset') {
    grad.addColorStop(0.0, '#6B4E8E');
    grad.addColorStop(0.3, '#FF9E6B');
    grad.addColorStop(0.49, '#FFF0B8');
    grad.addColorStop(0.53, '#C95A42');
    grad.addColorStop(0.78, '#7A3E1E');
    grad.addColorStop(1.0, '#3C1B0D');
  } else {
    grad.addColorStop(0.0, '#162448');
    grad.addColorStop(0.35, '#2E4C85');
    grad.addColorStop(0.5, '#6BA2E0');
    grad.addColorStop(0.54, '#1B4D70');
    grad.addColorStop(0.78, '#7A3C16');
    grad.addColorStop(1.0, '#2A1408');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Add crisp 1999 raytrace studio window softbox highlights so cut-crystal facets sparkle sharply
  ctx.fillStyle = mood === 'torch' ? 'rgba(255, 195, 110, 0.92)' : 'rgba(255, 255, 250, 0.95)';
  ctx.fillRect(18, 9, 20, 12);
  ctx.fillRect(86, 12, 16, 10);
  if (mood === 'torch') {
    // Warm flanking torch reflection orbs
    ctx.fillStyle = '#FFB84D';
    ctx.fillRect(36, 26, 8, 12);
    ctx.fillRect(84, 26, 8, 12);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Ensures a BufferGeometry has a second UV channel (`uv1`) matching `uv` so Three.js lightMap/aoMap work cleanly.
 */
export function ensureUv1(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.attributes.uv1 && geo.attributes.uv) {
    geo.setAttribute('uv1', geo.attributes.uv.clone());
  }
  return geo;
}
