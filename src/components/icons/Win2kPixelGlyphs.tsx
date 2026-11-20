import React from 'react';

/**
 * Pure 1-bit Windows 2000 pixel UI glyphs (shapeRendering="crispEdges")
 * Guarantees zero OS/browser fallback to Noto/Apple Color Emoji on any platform.
 */

export const PixelArrowRight: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="4"
    height="7"
    viewBox="0 0 4 7"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <path d="M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z" fill="currentColor" />
  </svg>
);

export const PixelCheckmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="7"
    height="7"
    viewBox="0 0 7 7"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <path
      d="M6 0h1v2H6zM5 1h1v2H5zM4 2h1v2H4zM3 3h1v2H3zM2 4h1v2H2zM1 3h1v2H1zM0 2h1v2H0z"
      fill="currentColor"
    />
  </svg>
);

export const PixelRadioDot: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="5"
    height="5"
    viewBox="0 0 5 5"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <path d="M1 0h3v1H1zM0 1h5v3H0zM1 4h3v1H1z" fill="currentColor" />
  </svg>
);

export const PixelTriangle: React.FC<{ dir: 'up' | 'down'; className?: string }> = ({
  dir,
  className = '',
}) => (
  <svg
    width="5"
    height="3"
    viewBox="0 0 5 3"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <path
      d={
        dir === 'up'
          ? 'M2 0h1v1H2zM1 1h3v1H1zM0 2h5v1H0z'
          : 'M0 0h5v1H0zM1 1h3v1H1zM2 2h1v1H2z'
      }
      fill="currentColor"
    />
  </svg>
);

export const PixelSquareBullet: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-block w-[3px] h-[3px] bg-current shrink-0 mt-[5px] ${className}`}
  />
);

export const PixelCheckedBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center w-[11px] h-[11px] bg-white border border-[#808080] text-black shrink-0 ${className}`}
  >
    <PixelCheckmark />
  </span>
);
