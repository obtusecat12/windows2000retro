export type GlassShapeId = 'tiki-tumbler' | 'hurricane' | 'highball';

export type GarnishId = 'umbrella' | 'straw' | 'pineapple' | 'cherry' | 'mint-lime';

export type BeachTimeId = 'noon' | 'sunset' | 'torch';

export interface LiquidLayerSpec {
  id: string;
  name: string;
  color: string;
  opacity: number;
  roughness: number;
  ratio: number;
}

export interface CocktailPreset {
  id: string;
  nameZh: string;
  nameEn: string;
  glassShape: GlassShapeId;
  abvLabel: string;
  flavorNote: string;
  layers: LiquidLayerSpec[];
  garnishes: GarnishId[];
  defaultIceCount: number;
  topStyle: 'crushed-ice-dome' | 'lagoon-foam-ice' | 'coconut-cream-swirl' | 'passion-shaved-ice';
}

export interface GlassProfilePoint {
  r: number;
  y: number;
}

export const TROPICAL_COCKTAILS: CocktailPreset[] = [
  {
    id: 'mai-tai',
    nameZh: '皇家迈泰',
    nameEn: 'Royal Mai Tai',
    glassShape: 'tiki-tumbler',
    abvLabel: '22% VOL',
    flavorNote: '牙买加陈年黑朗姆 · 杏仁糖浆 · 鲜青柠菠萝碎冰',
    layers: [
      { id: 'mt-1', name: '红石榴杏仁底', color: '#C81933', opacity: 0.96, roughness: 0.22, ratio: 0.24 },
      { id: 'mt-2', name: '金菠萝青柠汁', color: '#F29B14', opacity: 0.94, roughness: 0.20, ratio: 0.50 },
      { id: 'mt-3', name: '黑朗姆琥珀浮层', color: '#8A300C', opacity: 0.92, roughness: 0.18, ratio: 0.26 },
    ],
    garnishes: ['umbrella', 'straw', 'pineapple', 'cherry', 'mint-lime'],
    defaultIceCount: 5,
    topStyle: 'crushed-ice-dome',
  },
  {
    id: 'blue-hawaii',
    nameZh: '蓝色夏威夷',
    nameEn: 'Blue Hawaii',
    glassShape: 'hurricane',
    abvLabel: '16% VOL',
    flavorNote: '蓝橙力娇酒 · 白朗姆 · 泻湖冰晶微泡',
    layers: [
      { id: 'bh-1', name: '深海蓝橙酒', color: '#005AD9', opacity: 0.95, roughness: 0.18, ratio: 0.35 },
      { id: 'bh-2', name: '泻湖碧蓝特调', color: '#0EC7E8', opacity: 0.94, roughness: 0.20, ratio: 0.45 },
      { id: 'bh-3', name: '雪浪青柠微泡', color: '#B8F6FF', opacity: 0.96, roughness: 0.26, ratio: 0.20 },
    ],
    garnishes: ['umbrella', 'straw', 'pineapple', 'cherry', 'mint-lime'],
    defaultIceCount: 4,
    topStyle: 'lagoon-foam-ice',
  },
  {
    id: 'pina-colada',
    nameZh: '椰林飘香',
    nameEn: 'Pina Colada',
    glassShape: 'hurricane',
    abvLabel: '14% VOL',
    flavorNote: '波多黎各白朗姆 · 鲜打椰香奶油顶 · 熟菠萝浆',
    layers: [
      { id: 'pc-1', name: '熟金菠萝果浆', color: '#F2BF2E', opacity: 0.96, roughness: 0.28, ratio: 0.28 },
      { id: 'pc-2', name: '丝滑椰奶朗姆', color: '#FAF0D4', opacity: 0.98, roughness: 0.32, ratio: 0.52 },
      { id: 'pc-3', name: '鲜打椰香雪顶', color: '#FFFDF7', opacity: 0.99, roughness: 0.36, ratio: 0.20 },
    ],
    garnishes: ['umbrella', 'straw', 'pineapple', 'cherry'],
    defaultIceCount: 3,
    topStyle: 'coconut-cream-swirl',
  },
  {
    id: 'hurricane',
    nameZh: '夏威夷飓风',
    nameEn: 'Tiki Hurricane',
    glassShape: 'highball',
    abvLabel: '24% VOL',
    flavorNote: '双倍黑白朗姆 · 百香果刨冰山 · 鲜血橙汁',
    layers: [
      { id: 'hc-1', name: '百香果深红底', color: '#BA1438', opacity: 0.96, roughness: 0.22, ratio: 0.32 },
      { id: 'hc-2', name: '血橙烈性朗姆', color: '#EA5618', opacity: 0.94, roughness: 0.22, ratio: 0.43 },
      { id: 'hc-3', name: '热带金芒顶层', color: '#FAAE22', opacity: 0.94, roughness: 0.20, ratio: 0.25 },
    ],
    garnishes: ['umbrella', 'straw', 'cherry', 'mint-lime'],
    defaultIceCount: 5,
    topStyle: 'passion-shaved-ice',
  },
];

function lerpPiecewise(y: number, knots: Array<[number, number]>): number {
  if (y <= knots[0][0]) return knots[0][1];
  for (let i = 0; i < knots.length - 1; i++) {
    const [y0, r0] = knots[i];
    const [y1, r1] = knots[i + 1];
    if (y <= y1) {
      const t = (y - y0) / Math.max(1e-5, y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return knots[knots.length - 1][1];
}

/**
 * Returns sculpted cut-crystal glass lathe profile (thick sham base, beveled walls, rolled rim)
 * and exact inner cavity radius curve so modeled 3D drink volumes fit flush inside the crystal wall.
 */
export function getGlassGeometrySpec(shape: GlassShapeId): {
  outerPoints: GlassProfilePoint[];
  cavityBottomY: number;
  cavityTopY: number;
  rimY: number;
  rimRadius: number;
  shamHeight: number;
  shamRadius: number;
  radiusAtY: (y: number) => number;
  radialSegments: number;
} {
  switch (shape) {
    case 'tiki-tumbler': {
      // Heavy cut-crystal Double Old-Fashioned Mai Tai rocks glass
      const outerPoints: GlassProfilePoint[] = [
        { r: 0.0, y: 0.0 },
        { r: 0.64, y: 0.0 },
        { r: 0.68, y: 0.06 },
        { r: 0.69, y: 0.32 },
        { r: 0.73, y: 0.78 },
        { r: 0.79, y: 1.32 },
        { r: 0.84, y: 1.76 },
        { r: 0.86, y: 1.80 },
        { r: 0.82, y: 1.82 },
        { r: 0.78, y: 1.76 },
        { r: 0.73, y: 1.32 },
        { r: 0.67, y: 0.78 },
        { r: 0.63, y: 0.38 },
        { r: 0.24, y: 0.35 },
        { r: 0.0, y: 0.37 },
      ];
      const innerKnots: Array<[number, number]> = [
        [0.37, 0.61],
        [0.78, 0.65],
        [1.32, 0.71],
        [1.72, 0.76],
      ];
      return {
        outerPoints,
        cavityBottomY: 0.38,
        cavityTopY: 1.66,
        rimY: 1.80,
        rimRadius: 0.83,
        shamHeight: 0.34,
        shamRadius: 0.64,
        radialSegments: 10,
        radiusAtY: (y) => lerpPiecewise(y, innerKnots),
      };
    }
    case 'hurricane': {
      // Classic Tulip-Curved Tiki Hurricane Stemmed Retro Glass
      const outerPoints: GlassProfilePoint[] = [
        { r: 0.0, y: 0.0 },
        { r: 0.58, y: 0.0 },
        { r: 0.60, y: 0.07 },
        { r: 0.44, y: 0.14 },
        { r: 0.19, y: 0.24 },
        { r: 0.23, y: 0.38 },
        { r: 0.19, y: 0.52 },
        { r: 0.48, y: 0.68 },
        { r: 0.75, y: 0.98 },
        { r: 0.72, y: 1.24 },
        { r: 0.58, y: 1.54 },
        { r: 0.66, y: 1.84 },
        { r: 0.77, y: 2.08 },
        { r: 0.79, y: 2.12 },
        { r: 0.74, y: 2.13 },
        { r: 0.71, y: 2.07 },
        { r: 0.60, y: 1.84 },
        { r: 0.52, y: 1.54 },
        { r: 0.66, y: 1.24 },
        { r: 0.69, y: 0.98 },
        { r: 0.42, y: 0.70 },
        { r: 0.18, y: 0.60 },
        { r: 0.0, y: 0.60 },
      ];
      const innerKnots: Array<[number, number]> = [
        [0.61, 0.22],
        [0.72, 0.41],
        [0.98, 0.67],
        [1.24, 0.64],
        [1.54, 0.50],
        [1.84, 0.58],
        [2.02, 0.68],
      ];
      return {
        outerPoints,
        cavityBottomY: 0.62,
        cavityTopY: 1.96,
        rimY: 2.11,
        rimRadius: 0.76,
        shamHeight: 0.14,
        shamRadius: 0.54,
        radialSegments: 12,
        radiusAtY: (y) => lerpPiecewise(y, innerKnots),
      };
    }
    case 'highball': {
      // Tall Faceted Retro Zombie / Collins Glass
      const outerPoints: GlassProfilePoint[] = [
        { r: 0.0, y: 0.0 },
        { r: 0.54, y: 0.0 },
        { r: 0.57, y: 0.06 },
        { r: 0.57, y: 0.32 },
        { r: 0.59, y: 0.95 },
        { r: 0.62, y: 1.62 },
        { r: 0.65, y: 2.14 },
        { r: 0.67, y: 2.18 },
        { r: 0.62, y: 2.19 },
        { r: 0.59, y: 2.13 },
        { r: 0.56, y: 1.62 },
        { r: 0.53, y: 0.95 },
        { r: 0.51, y: 0.36 },
        { r: 0.20, y: 0.34 },
        { r: 0.0, y: 0.35 },
      ];
      const innerKnots: Array<[number, number]> = [
        [0.36, 0.49],
        [0.95, 0.51],
        [1.62, 0.54],
        [2.06, 0.57],
      ];
      return {
        outerPoints,
        cavityBottomY: 0.36,
        cavityTopY: 2.02,
        rimY: 2.17,
        rimRadius: 0.64,
        shamHeight: 0.32,
        shamRadius: 0.53,
        radialSegments: 10,
        radiusAtY: (y) => lerpPiecewise(y, innerKnots),
      };
    }
  }
}

export interface ComputedLiquidSlice {
  layer: LiquidLayerSpec;
  yBottom: number;
  yTop: number;
}

export function computeLayerSlices(
  layers: LiquidLayerSpec[],
  liquidLevel: number,
  cavityBottomY: number,
  cavityTopY: number
): ComputedLiquidSlice[] {
  const clampedLevel = Math.max(0, Math.min(1, liquidLevel));
  if (layers.length === 0 || clampedLevel <= 0.01) return [];
  const totalRatio = layers.reduce((acc, l) => acc + Math.max(0.05, l.ratio), 0);
  const fullSpan = (cavityTopY - cavityBottomY) * clampedLevel;

  let cursor = cavityBottomY;
  return layers.map((layer) => {
    const share = Math.max(0.05, layer.ratio) / totalRatio;
    const h = fullSpan * share;
    const slice: ComputedLiquidSlice = {
      layer,
      yBottom: cursor,
      yTop: cursor + h,
    };
    cursor += h;
    return slice;
  });
}

export function sipLiquidLevel(currentLevel: number, step = 0.18): number {
  return Math.max(0.04, Number((currentLevel - step).toFixed(2)));
}
