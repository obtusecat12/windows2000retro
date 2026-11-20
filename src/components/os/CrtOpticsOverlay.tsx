import React from 'react';

/**
 * Hidden SVG filter definitions for Year-2000 Spherical PC Shadow-Mask CRT optics:
 * 1. Tinted safety-glass black floor lift + calibrated ~2.45 CRT gamma transfer
 * 2. Dual-radius highlight isolation & phosphor halation/bloom
 */
export const CrtOpticsSvgDefs: React.FC = () => (
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    className="absolute w-0 h-0 overflow-hidden pointer-events-none"
  >
    <defs>
      <filter
        id="w2k-crt-optics"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        {/* 1. Tinted glass ambient black floor (#000 -> ~#05070B) + soft highlight headroom */}
        <feComponentTransfer in="SourceGraphic" result="glass-floor">
          <feFuncR type="linear" slope="0.965" intercept="0.015" />
          <feFuncG type="linear" slope="0.965" intercept="0.016" />
          <feFuncB type="linear" slope="0.968" intercept="0.020" />
        </feComponentTransfer>

        {/* 2. Calibrated CRT electron-gun transfer curve (~2.42 effective gamma over sRGB) */}
        <feComponentTransfer in="glass-floor" result="crt-tonal">
          <feFuncR type="gamma" amplitude="1.01" exponent="1.09" offset="0" />
          <feFuncG type="gamma" amplitude="1.0" exponent="1.09" offset="0" />
          <feFuncB type="gamma" amplitude="0.99" exponent="1.08" offset="0" />
        </feComponentTransfer>

        {/* 3. Subtle P22 phosphor colorimetry warmth */}
        <feColorMatrix
          in="crt-tonal"
          type="matrix"
          values="
            1.012  0.004 -0.004  0  0
            0.002  0.998  0.002  0  0
           -0.004  0.006  0.986  0  0
            0      0      0      1  0
          "
          result="crt-base"
        />

        {/* 4. Isolate high-luminance regions (>62% brightness) so 12px UI text stays crisp */}
        <feComponentTransfer in="crt-base" result="hi-mask">
          <feFuncR type="linear" slope="2.8" intercept="-1.74" />
          <feFuncG type="linear" slope="2.8" intercept="-1.74" />
          <feFuncB type="linear" slope="2.8" intercept="-1.74" />
        </feComponentTransfer>

        {/* 5a. Tight electron-beam phosphor scatter around bright glyphs & edges */}
        <feGaussianBlur in="hi-mask" stdDeviation="1.35" result="scatter-tight" />
        <feColorMatrix
          in="scatter-tight"
          type="matrix"
          values="
            0.16  0     0     0  0
            0     0.15  0     0  0
            0     0     0.14  0  0
            0     0     0     1  0
          "
          result="scatter-weighted"
        />

        {/* 5b. Wide faceplate internal glass halation halo */}
        <feGaussianBlur in="hi-mask" stdDeviation="8.5" result="halation-wide" />
        <feColorMatrix
          in="halation-wide"
          type="matrix"
          values="
            0.125 0     0     0  0
            0     0.118 0     0  0
            0     0     0.105 0  0
            0     0     0     1  0
          "
          result="halation-weighted"
        />

        {/* 6. Combine tight phosphor scatter + wide halation additively */}
        <feComposite
          in="scatter-weighted"
          in2="halation-weighted"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="1"
          k4="0"
          result="total-glow"
        />

        {/* 7. Blend optical phosphor glow onto crisp CRT base */}
        <feComposite
          in="crt-base"
          in2="total-glow"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="0.88"
          k4="0"
        />
      </filter>
    </defs>
  </svg>
);

/**
 * Non-interactive optical glass overlay for 1024x768 spherical PC shadow-mask CRT:
 * - Staggered P22 RGB dot-triad micro-pattern with dark carbon matrix interstices
 * - Subtle curved spherical faceplate ambient reflection & edge luminance falloff
 */
export const CrtGlassOverlay: React.FC = () => (
  <>
    {/* Staggered 0.25mm RGB Dot-Triad Shadow Mask Micro-Texture */}
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full z-[19997]"
      style={{ mixBlendMode: 'soft-light', opacity: 0.34 }}
    >
      <defs>
        <pattern
          id="w2k-shadow-mask-triads"
          width="6"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          {/* Faint dark carbon matrix interstices */}
          <rect width="6" height="4" fill="#181c22" />
          {/* Row A: staggered R / G / B phosphor dots */}
          <circle cx="1" cy="1" r="0.88" fill="#ff3b30" />
          <circle cx="3" cy="1" r="0.88" fill="#34d058" />
          <circle cx="5" cy="1" r="0.88" fill="#3b82f6" />
          {/* Row B (offset 3px horizontally): staggered G / B / R phosphor dots */}
          <circle cx="0" cy="3" r="0.88" fill="#34d058" />
          <circle cx="2" cy="3" r="0.88" fill="#3b82f6" />
          <circle cx="4" cy="3" r="0.88" fill="#ff3b30" />
          <circle cx="6" cy="3" r="0.88" fill="#34d058" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#w2k-shadow-mask-triads)" />
    </svg>

    {/* Ultra-delicate carbon dot-mask contrast bite (no coarse horizontal scanlines) */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[19998] w2k-crt-micrograin"
    />

    {/* Spherical CRT Glass Curvature Sheen & Peripheral Luminance Falloff */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[19999] w2k-crt-spherical-glass"
    />
  </>
);
