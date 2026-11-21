/**
 * Modular 2.5D Isometric Pixel-Art Rendering & Depth-Sorting Engine (Palm Bath 2000)
 * Zero flat whole-room AI diorama images: every surface tile and bathhouse prop is
 * individually generated, chroma-key extracted with zero halo, and composited in
 * strict mathematical 2:1 isometric painter's order (u + v, layerPriority, z).
 */

export interface IsoPt2 {
  x: number;
  y: number;
}

export interface IsoProjectorConfig {
  originX: number;
  originY: number;
  tileW: number;
  tileH: number;
  unitZ: number;
}

export const DEFAULT_ISO_CONFIG: IsoProjectorConfig = {
  originX: 192,
  originY: 112,
  tileW: 34,
  tileH: 17,
  unitZ: 17,
};

export function projectIso(
  u: number,
  v: number,
  z: number,
  cfg: IsoProjectorConfig = DEFAULT_ISO_CONFIG
): IsoPt2 {
  return {
    x: cfg.originX + (u - v) * (cfg.tileW * 0.5),
    y: cfg.originY + (u + v) * (cfg.tileH * 0.5) - z * cfg.unitZ,
  };
}

export interface IsoSortableItem {
  id: string;
  u: number;
  v: number;
  z: number;
  /** Fine tie-breaker for nested layers at similar (u+v), e.g., tub inner wall < water < ducky < caddy < front rim */
  priority?: number;
}

/**
 * Deterministic 2:1 isometric painter's algorithm depth key.
 * Objects with smaller (u + v) sit farther back toward the corner (0,0);
 * larger (u + v) sit closer to the viewer and draw on top.
 */
export function computeIsoDepthKey(item: IsoSortableItem): number {
  return (item.u + item.v) * 100 + (item.priority ?? 0) * 2 + item.z * 0.35;
}

export function sortIsoRenderItems<T extends IsoSortableItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => computeIsoDepthKey(a) - computeIsoDepthKey(b));
}

export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Generates an authentic 16-bit Bayer 4x4 ordered-dithered pixel backdrop (no smooth modern gradients).
 */
export function buildBayerDitherBackdrop(
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
      const nx = (x / Math.max(1, w - 1) - 0.5) * 2;
      const vig = Math.min(1, nx * nx * 0.22);
      const t = Math.max(0, Math.min(1, ny * 0.84 + vig));
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

export interface SpriteExtractOptions {
  targetW: number;
  targetH: number;
  flipX?: boolean;
  quantStep?: number;
}

/**
 * Extracts a single modular pixel-art prop sprite generated on a pure magenta (#FF00FF) backdrop.
 * Removes BOTH exterior magenta and interior magenta holes (e.g., between stool legs, monstera cuts,
 * shower hose loops, bath caddy slats), despills 1px pink edge fringe, auto-trims tight bounds,
 * and quantizes into crisp 16-bit pixel clarity.
 */
export function extractMagentaChromaSprite(
  img: HTMLImageElement,
  opts: SpriteExtractOptions
): HTMLCanvasElement {
  // Process at 2x target resolution first so magenta keying doesn't blend pink into outline pixels
  const workW = Math.max(24, opts.targetW * 2);
  const workH = Math.max(24, opts.targetH * 2);
  const work = document.createElement('canvas');
  work.width = workW;
  work.height = workH;
  const wCtx = work.getContext('2d')!;
  wCtx.imageSmoothingEnabled = true;
  wCtx.imageSmoothingQuality = 'high';

  wCtx.save();
  if (opts.flipX) {
    wCtx.translate(workW, 0);
    wCtx.scale(-1, 1);
  }
  wCtx.drawImage(img, 0, 0, workW, workH);
  wCtx.restore();

  const imgData = wCtx.getImageData(0, 0, workW, workH);
  const d = imgData.data;

  // Pass 1: Remove pure & near-pure magenta background (exterior AND interior cutouts)
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const magentaExcess = r + b - 2 * g;
    if (
      (r > 135 && b > 135 && g < 125 && magentaExcess > 118) ||
      (r > 180 && b > 170 && g < 145 && r - g > 55 && b - g > 50)
    ) {
      d[i + 3] = 0;
    }
  }

  // Pass 2: Edge fringe despill & thin magenta halo cleanup adjacent to transparency
  const clearList: number[] = [];
  for (let y = 1; y < workH - 1; y++) {
    for (let x = 1; x < workW - 1; x++) {
      const p = y * workW + x;
      const i = p * 4;
      if (d[i + 3] === 0) continue;
      const nearTrans =
        d[(p - 1) * 4 + 3] === 0 ||
        d[(p + 1) * 4 + 3] === 0 ||
        d[(p - workW) * 4 + 3] === 0 ||
        d[(p + workW) * 4 + 3] === 0;
      if (!nearTrans) continue;

      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const magentaExcess = r + b - 2 * g;
      if (magentaExcess > 72 && r > 95 && b > 95) {
        clearList.push(p);
      } else if (magentaExcess > 38 && r > g + 18 && b > g + 18) {
        // Despill subtle pink cast along dark pixel outline into clean charcoal outline
        const dark = Math.min(g, 38);
        d[i] = dark;
        d[i + 1] = dark;
        d[i + 2] = dark;
      }
    }
  }
  for (const p of clearList) {
    d[p * 4 + 3] = 0;
  }

  wCtx.putImageData(imgData, 0, 0);

  // Compute tight non-transparent bounding box in work canvas
  let minX = workW;
  let minY = workH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < workH; y++) {
    for (let x = 0; x < workW; x++) {
      if (d[(y * workW + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = workW - 1;
    maxY = workH - 1;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Preserve cropped aspect ratio inside targetW x targetH
  const scale = Math.min(opts.targetW / cropW, opts.targetH / cropH);
  const outW = Math.max(8, Math.round(cropW * scale));
  const outH = Math.max(8, Math.round(cropH * scale));

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const oCtx = out.getContext('2d')!;
  oCtx.imageSmoothingEnabled = true;
  oCtx.imageSmoothingQuality = 'medium';
  oCtx.drawImage(work, minX, minY, cropW, cropH, 0, 0, outW, outH);

  // Snap alpha strictly to 0 or 255 & crisp 16-bit palette quantization
  const outImg = oCtx.getImageData(0, 0, outW, outH);
  const od = outImg.data;
  const step = opts.quantStep ?? 6;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const i = (y * outW + x) * 4;
      if (od[i + 3] < 132) {
        od[i + 3] = 0;
        continue;
      }
      od[i + 3] = 255;
      let r = od[i];
      let g = od[i + 1];
      let b = od[i + 2];
      // Final safety despill against any residual magenta tint
      if (r + b - 2 * g > 84 && r > 120 && b > 120 && g < 90) {
        od[i + 3] = 0;
        continue;
      }
      const bayer = (BAYER_4X4[y & 3][x & 3] / 15 - 0.5) * step;
      r = Math.max(0, Math.min(255, Math.round((r + bayer) / step) * step));
      g = Math.max(0, Math.min(255, Math.round((g + bayer) / step) * step));
      b = Math.max(0, Math.min(255, Math.round((b + bayer) / step) * step));
      od[i] = r;
      od[i + 1] = g;
      od[i + 2] = b;
    }
  }
  oCtx.putImageData(outImg, 0, 0);
  return out;
}

/**
 * Downsamples & pixel-quantizes a seamless architectural tile texture (wall mosaic, teak floor, window vista).
 */
export function preparePixelTileTexture(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  tint?: { r: number; g: number; b: number }
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const d = imgData.data;
  const tr = tint?.r ?? 1;
  const tg = tint?.g ?? 1;
  const tb = tint?.b ?? 1;
  const step = 6;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const bayer = (BAYER_4X4[y & 3][x & 3] / 15 - 0.5) * step;
      d[i] = Math.max(0, Math.min(255, Math.round((d[i] * tr + bayer) / step) * step));
      d[i + 1] = Math.max(0, Math.min(255, Math.round((d[i + 1] * tg + bayer) / step) * step));
      d[i + 2] = Math.max(0, Math.min(255, Math.round((d[i + 2] * tb + bayer) / step) * step));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

/**
 * Draws an affine-mapped pixel texture cleanly onto an exact isometric parallelogram defined by
 * origin corner p0, local +X vector (pU - p0), and local +Y vector (pV - p0).
 * Supports seamless tiling via repeatX / repeatY with zero gaps!
 */
export function drawTexturedIsoQuad(
  ctx: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  p0: IsoPt2,
  pU: IsoPt2,
  pV: IsoPt2,
  repeatX = 1,
  repeatY = 1,
  shadeOverlay?: string
): void {
  const pUV = { x: pU.x + pV.x - p0.x, y: pU.y + pV.y - p0.y };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(pU.x, pU.y);
  ctx.lineTo(pUV.x, pUV.y);
  ctx.lineTo(pV.x, pV.y);
  ctx.closePath();
  ctx.clip();

  const ux = (pU.x - p0.x) / (tex.width * repeatX);
  const uy = (pU.y - p0.y) / (tex.width * repeatX);
  const vx = (pV.x - p0.x) / (tex.height * repeatY);
  const vy = (pV.y - p0.y) / (tex.height * repeatY);

  ctx.transform(ux, uy, vx, vy, p0.x, p0.y);
  ctx.imageSmoothingEnabled = false;

  const cols = Math.ceil(repeatX);
  const rows = Math.ceil(repeatY);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.drawImage(tex, c * tex.width, r * tex.height);
    }
  }
  ctx.restore();

  if (shadeOverlay) {
    ctx.save();
    ctx.fillStyle = shadeOverlay;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(pU.x, pU.y);
    ctx.lineTo(pUV.x, pUV.y);
    ctx.lineTo(pV.x, pV.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function drawSolidIsoQuad(
  ctx: CanvasRenderingContext2D,
  pts: IsoPt2[],
  fill: string,
  stroke?: string
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draws a crisp Bayer-dithered isometric soft contact shadow ellipse under a modular prop
 * (baked lighting feel, zero modern blurry CSS shadows!).
 */
export function drawPixelContactShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  strength = 0.45
): void {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  ctx.fillStyle = '#091822';
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) / Math.max(1, ry);
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / Math.max(1, rx);
      const d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue;
      const alpha = (1 - d2) * strength;
      const thresh = (BAYER_4X4[y & 3][x & 3] + 0.5) / 16;
      if (alpha > thresh) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * Hand-crafted 6-frame pixel-art rain-shower stream & slatted-duckboard splash animation.
 * Renders multi-layered translucent aqua/white pixel water columns with organic gaps,
 * glistening falling droplets, foaming splash crowns, and expanding floor ripples —
 * positioned strictly from the exact brass showerhead nozzle down to the teak duckboard.
 */
export function drawSixFramePixelShowerWater(
  ctx: CanvasRenderingContext2D,
  nozzleX: number,
  nozzleY: number,
  floorY: number,
  frameIdx: number,
  mode: 'hot' | 'cold'
): void {
  const f = ((frameIdx % 6) + 6) % 6;
  const colHeight = Math.max(24, Math.round(floorY - nozzleY));
  const isHot = mode === 'hot';

  const coreCol = isHot ? '#F2FDFF' : '#D4F8FF';
  const midCol = isHot ? 'rgba(176, 238, 250, 0.84)' : 'rgba(108, 218, 248, 0.86)';
  const edgeCol = isHot ? 'rgba(116, 210, 232, 0.55)' : 'rgba(64, 178, 224, 0.58)';

  // 7 staggered nozzle jets matching the elliptical brass rain-shower face
  const jets = [
    { dx: -7, phase: 0, speed: 6, spread: -1 },
    { dx: -4, phase: 2, speed: 7, spread: -0.5 },
    { dx: -2, phase: 4, speed: 6, spread: -0.2 },
    { dx: 0, phase: 1, speed: 7, spread: 0 },
    { dx: 2, phase: 3, speed: 6, spread: 0.2 },
    { dx: 5, phase: 5, speed: 7, spread: 0.5 },
    { dx: 7, phase: 2, speed: 6, spread: 1 },
  ];

  for (let j = 0; j < jets.length; j++) {
    const jet = jets[j];
    const startX = Math.round(nozzleX + jet.dx);
    const startY = Math.round(nozzleY + (Math.abs(jet.dx) > 5 ? 1 : 2));
    // Subtle organic wave + dash pattern unique to each of the 6 frames
    const shift = (f * jet.speed + jet.phase * 4) % 18;

    for (let dy = 0; dy < colHeight; dy += 2) {
      const progress = dy / colHeight;
      const seg = (dy + shift) % 18;
      // Organic hand-crafted pixel dash pattern (longer streaks near top, breaking into droplets lower down)
      const isGap = progress > 0.55 ? seg >= 11 : seg >= 14;
      if (isGap) continue;

      const xShift = Math.round(jet.spread * progress * 3.5);
      const px = startX + xShift;
      const py = startY + dy;

      // Translucent outer aqua body
      ctx.fillStyle = j === 0 || j === jets.length - 1 ? edgeCol : midCol;
      ctx.fillRect(px, py, 1, 2);

      // Crisp sparkling white specular pixel highlights traveling downward per frame
      if ((seg === 2 || seg === 8) && (j === 1 || j === 3 || j === 5)) {
        ctx.fillStyle = coreCol;
        ctx.fillRect(px, py, 1, 2);
      }
    }

    // Detached falling splash droplets flanking the outer streams
    const dropY = startY + ((f * 13 + j * 19) % Math.max(12, colHeight - 6));
    ctx.fillStyle = coreCol;
    ctx.fillRect(startX + Math.round(jet.spread * 3) + (f % 2 === 0 ? 1 : -1), dropY, 1, 2);
  }

  // Animated 6-frame Duckboard Impact Foam Crown + Concentric Isometric Water Ripples
  const impactX = Math.round(nozzleX);
  const impactY = Math.round(floorY);

  // Expanding isometric water ripple diamond on wet teak slats
  const ripPhase = f / 6;
  const ripRx = Math.round(7 + ripPhase * 11);
  const ripRy = Math.round(3.5 + ripPhase * 5.5);
  ctx.strokeStyle = isHot ? 'rgba(218, 252, 255, 0.72)' : 'rgba(155, 236, 255, 0.78)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(impactX, impactY - ripRy);
  ctx.lineTo(impactX + ripRx, impactY);
  ctx.lineTo(impactX, impactY + ripRy);
  ctx.lineTo(impactX - ripRx, impactY);
  ctx.closePath();
  ctx.stroke();

  // Second inner ripple out-of-phase
  const rip2Phase = ((f + 3) % 6) / 6;
  const rip2Rx = Math.round(5 + rip2Phase * 9);
  const rip2Ry = Math.round(2.5 + rip2Phase * 4.5);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.beginPath();
  ctx.moveTo(impactX, impactY - rip2Ry);
  ctx.lineTo(impactX + rip2Rx, impactY);
  ctx.lineTo(impactX, impactY + rip2Ry);
  ctx.lineTo(impactX - rip2Rx, impactY);
  ctx.closePath();
  ctx.stroke();

  // Crisp pixel foam crown & bouncing micro-droplets on impact
  const crownOffsets: Array<Array<[number, number]>> = [
    [[-6, -2], [-3, -4], [0, -3], [4, -4], [7, -1], [-1, 1], [3, 0]],
    [[-8, -1], [-4, -3], [-1, -5], [2, -3], [6, -2], [-2, 0], [4, 1]],
    [[-7, -3], [-2, -2], [1, -4], [5, -3], [8, -1], [0, 1], [-4, 1]],
    [[-5, -4], [-1, -3], [3, -5], [6, -2], [-8, 0], [2, 1], [-3, 0]],
    [[-6, -2], [-3, -5], [0, -2], [4, -4], [7, -3], [-1, 1], [5, 0]],
    [[-7, -1], [-2, -4], [2, -3], [5, -5], [8, -2], [-3, 1], [1, 0]],
  ];
  const pts = crownOffsets[f];
  for (let i = 0; i < pts.length; i++) {
    const [ox, oy] = pts[i];
    ctx.fillStyle = i < 4 ? '#FFFFFF' : '#B8F4FF';
    ctx.fillRect(impactX + ox, impactY + oy, i % 3 === 0 ? 2 : 1, 1);
  }
}

export function buildOrderedDitherGlowSprite(
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

export function buildDitherSteamSprite(rad: number, dense: boolean): HTMLCanvasElement {
  const size = rad * 2 + 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#EBFBFF';
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
