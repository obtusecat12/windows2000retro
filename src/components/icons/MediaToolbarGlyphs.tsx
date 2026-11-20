import React from 'react';

export type ImagingGlyphName =
  | 'new-doc'
  | 'scan'
  | 'view-page'
  | 'view-thumbs'
  | 'view-both'
  | 'pan-hand'
  | 'select-rect'
  | 'select-annot'
  | 'annot-toggle'
  | 'zoom-sel'
  | 'fit-width'
  | 'annot-pointer'
  | 'annot-freehand'
  | 'annot-highlight'
  | 'annot-line'
  | 'annot-rect'
  | 'annot-filled-rect'
  | 'annot-text'
  | 'annot-note'
  | 'annot-stamp'
  | 'annot-clear';

/**
 * Authentic 16x16 1-bit/16-color Windows 2000 Imaging toolbar pixel glyphs (shapeRendering="crispEdges").
 */
export const ImagingToolGlyph: React.FC<{ name: ImagingGlyphName; disabled?: boolean }> = ({
  name,
  disabled = false,
}) => {
  const opacityClass = disabled ? 'opacity-45' : '';
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`inline-block shrink-0 ${opacityClass}`}
    >
      {name === 'new-doc' && (
        <>
          <path d="M3 1h7v1h1v1h1v12H3V1z" fill="#FFFFFF" />
          <path d="M2 1h8v1h1v1h1v12H2V1zm1 1v12h8V4H9V2H3z" fill="#000000" />
          <path d="M9 2h1v2H9zM10 3h1v1h-1z" fill="#808080" />
        </>
      )}
      {name === 'scan' && (
        <>
          <rect x="2" y="8" width="12" height="5" fill="#C0C0C0" />
          <rect x="3" y="9" width="10" height="3" fill="#808080" />
          <path d="M2 7h12v1H2zM1 8h1v5H1zM14 8h1v5h-1zM2 13h12v1H2z" fill="#000000" />
          <path d="M4 2h9l-2 5H2l2-5z" fill="#FFFFFF" />
          <path d="M4 1h10v1H4zM3 2h1v4H3zM13 2h1v4h-1z" fill="#000080" />
          <rect x="4" y="10" width="2" height="1" fill="#00FF00" />
        </>
      )}
      {name === 'view-page' && (
        <>
          <rect x="3" y="2" width="10" height="12" fill="#FFFFFF" />
          <path d="M2 1h12v14H2V1zm1 1v12h10V2H3z" fill="#000080" />
          <rect x="5" y="4" width="6" height="4" fill="#008080" />
          <rect x="5" y="9" width="6" height="1" fill="#808080" />
          <rect x="5" y="11" width="4" height="1" fill="#808080" />
        </>
      )}
      {name === 'view-thumbs' && (
        <>
          <rect x="2" y="2" width="5" height="5" fill="#FFFFFF" stroke="#000080" strokeWidth="1" />
          <rect x="9" y="2" width="5" height="5" fill="#FFFFFF" stroke="#000080" strokeWidth="1" />
          <rect x="2" y="9" width="5" height="5" fill="#FFFFFF" stroke="#000080" strokeWidth="1" />
          <rect x="9" y="9" width="5" height="5" fill="#FFFFFF" stroke="#000080" strokeWidth="1" />
          <rect x="3" y="3" width="3" height="2" fill="#008080" />
          <rect x="10" y="3" width="3" height="2" fill="#008080" />
          <rect x="3" y="10" width="3" height="2" fill="#008080" />
          <rect x="10" y="10" width="3" height="2" fill="#008080" />
        </>
      )}
      {name === 'view-both' && (
        <>
          <rect x="1" y="2" width="4" height="4" fill="#FFFFFF" />
          <path d="M1 2h4v4H1V2zm1 1v2h2V3H2z" fill="#000080" />
          <rect x="1" y="8" width="4" height="4" fill="#FFFFFF" />
          <path d="M1 8h4v4H1V8zm1 1v2h2V9H2z" fill="#000080" />
          <rect x="7" y="2" width="8" height="12" fill="#FFFFFF" />
          <path d="M6 1h9v14H6V1zm1 1v12h7V2H7z" fill="#000080" />
          <rect x="8" y="4" width="5" height="4" fill="#008080" />
          <rect x="8" y="10" width="5" height="1" fill="#808080" />
        </>
      )}
      {name === 'pan-hand' && (
        <>
          <path
            d="M7 2h2v5h1V3h2v5h1V5h1v6h-1v3H5v-2H4V9H3V7h2v2h1V3h1V2z"
            fill="#FFFFFF"
          />
          <path
            d="M7 1h2v1H7zM6 2h1v6H6zM9 2h1v5H9zM10 2h2v1h-2zM12 3h1v5h-1zM13 4h1v1h-1zM14 5h1v6h-1zM13 11h1v3h-1zM5 14h8v1H5zM4 12h1v2H4zM3 9h1v3H3zM2 7h1v2H2zM3 6h2v1H3zM5 7h1v2H5z"
            fill="#000000"
          />
        </>
      )}
      {name === 'select-rect' && (
        <>
          <path
            d="M2 2h2v1H2zM6 2h2v1H6zM10 2h2v1h-2zM13 3h1v2h-1zM13 7h1v2h-1zM13 11h1v2h-1zM10 13h2v1h-2zM6 13h2v1H6zM2 13h2v1H2zM2 10h1v2H2zM2 6h1v2H2zM2 3h1v2H2z"
            fill="#000000"
          />
        </>
      )}
      {name === 'select-annot' && (
        <>
          <rect x="2" y="2" width="7" height="7" fill="#FFFF80" />
          <path d="M2 2h7v7H2V2zm1 1v5h5V3H3z" fill="#808000" />
          <path d="M9 6h1v7H9zM10 7h1v5h-1zM11 8h1v3h-1zM12 9h1v2h-1zM13 10h1v1h-1z" fill="#000000" />
          <path d="M10 8h1v3h-1zM11 9h1v1h-1z" fill="#FFFFFF" />
        </>
      )}
      {name === 'annot-toggle' && (
        <>
          <rect x="2" y="3" width="11" height="11" fill="#FFFFFF" />
          <path d="M1 2h13v13H1V2zm1 1v11h11V3H2z" fill="#000080" />
          <path d="M4 11h4v1H4z" fill="#008000" />
          <path d="M5 9l5-5 2 2-5 5H5V9z" fill="#FFFF00" />
          <path d="M10 3l3 3-1 1-3-3 1-1z" fill="#FF0000" />
          <path d="M5 10h1v1H5zM6 9h1v1H6zM7 8h1v1H7zM8 7h1v1H8zM9 6h1v1H9z" fill="#000000" />
        </>
      )}
      {name === 'zoom-sel' && (
        <>
          <path d="M1 1h2v1H1zM5 1h2v1H5zM9 1h2v1H9zM1 5h1v2H1zM1 9h1v2H1z" fill="#000000" />
          <circle cx="9" cy="9" r="3.5" fill="#E0F4FF" stroke="#000000" strokeWidth="1" />
          <path d="M12 12h2v1h-2zM13 13h2v2h-2z" fill="#000080" />
        </>
      )}
      {name === 'fit-width' && (
        <>
          <rect x="1" y="2" width="14" height="12" fill="#FFFFFF" />
          <path d="M1 2h14v12H1V2zm1 1v10h12V3H2z" fill="#808080" />
          <path d="M3 8h10v1H3zM3 7h1v3H3zM4 6h1v5H4zM12 7h1v3h-1zM11 6h1v5h-1z" fill="#000080" />
        </>
      )}
      {name === 'annot-pointer' && (
        <>
          <path
            d="M4 2h1v11H4zM5 3h1v9H5zM6 4h1v7H6zM7 5h1v5H7zM8 6h1v4H8zM9 7h1v3H9zM10 8h1v2h-1zM11 9h1v1h-1z"
            fill="#000000"
          />
          <path d="M5 4h1v7H5zM6 5h1v5H6zM7 6h1v3H7zM8 7h1v2H8z" fill="#FFFFFF" />
          <path d="M7 10h2v4H7z" fill="#000000" />
        </>
      )}
      {name === 'annot-freehand' && (
        <>
          <path
            d="M2 11h2v1H2zM4 9h2v2H4zM6 6h2v3H6zM8 5h2v1H8zM10 6h2v4h-2zM12 10h2v2h-2z"
            fill="#000080"
          />
        </>
      )}
      {name === 'annot-highlight' && (
        <>
          <rect x="2" y="11" width="12" height="3" fill="#FFFF00" />
          <path d="M4 9l6-6 3 3-6 6H4V9z" fill="#FFCC00" />
          <path d="M4 9h3v1H4zM7 6h1v3H7zM10 3h1v3h-1z" fill="#000000" />
        </>
      )}
      {name === 'annot-line' && (
        <>
          <path
            d="M2 13h2v1H2zM4 11h2v2H4zM6 9h2v2H6zM8 7h2v2H8zM10 5h2v2h-2zM12 3h2v2h-2z"
            fill="#000000"
          />
        </>
      )}
      {name === 'annot-rect' && (
        <path d="M2 3h12v10H2V3zm1 1v8h10V4H3z" fill="#000000" />
      )}
      {name === 'annot-filled-rect' && (
        <>
          <rect x="2" y="3" width="12" height="10" fill="#808080" />
          <path d="M2 3h12v10H2V3zm1 1v8h10V4H3z" fill="#000000" />
        </>
      )}
      {name === 'annot-text' && (
        <>
          <path d="M2 7h3v1H2zM5 8h1v4H5zM2 10h3v1H2zM2 8h1v2H2zM3 9h2v1H3z" fill="#000000" />
          <path d="M8 4h1v8H8zM9 7h2v1H9zM11 8h1v3h-1zM9 11h2v1H9z" fill="#000000" />
          <path d="M13 3h1v10h-1z" fill="#000080" />
        </>
      )}
      {name === 'annot-note' && (
        <>
          <rect x="2" y="2" width="12" height="12" fill="#FFFF80" />
          <path d="M2 2h12v9l-3 3H2V2zm1 1v10h7v-3h3V3H3z" fill="#808000" />
          <rect x="4" y="5" width="7" height="1" fill="#000000" />
          <rect x="4" y="7" width="6" height="1" fill="#000000" />
          <rect x="4" y="9" width="4" height="1" fill="#000000" />
        </>
      )}
      {name === 'annot-stamp' && (
        <>
          <rect x="6" y="2" width="4" height="4" fill="#800000" />
          <rect x="7" y="6" width="2" height="3" fill="#800000" />
          <rect x="3" y="9" width="10" height="3" fill="#800000" />
          <rect x="2" y="12" width="12" height="2" fill="#000000" />
        </>
      )}
      {name === 'annot-clear' && (
        <>
          <path d="M3 4h1v2H3zM4 5h2v2H4zM6 7h4v2H6zM10 5h2v2h-2zM12 4h1v2h-1zM4 10h2v2H4zM3 11h1v2H3zM10 10h2v2h-2zM12 11h1v2h-1z" fill="#CC0000" />
        </>
      )}
    </svg>
  );
};

export const WmpStepFrameIcon: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className={`inline-block shrink-0 ${disabled ? 'opacity-45' : ''}`}
  >
    <rect x="3" y="4" width="2" height="8" fill="#505050" />
    <path d="M7 4h1v8H7zM8 5h1v6H8zM9 6h1v4H9zM10 7h1v2h-1z" fill="#505050" />
    <rect x="12" y="4" width="2" height="8" fill="#505050" />
  </svg>
);

export const WmpSpeakerIcon: React.FC<{ muted: boolean }> = ({ muted }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    aria-hidden="true"
    className="inline-block shrink-0"
  >
    <path d="M2 6h3v4H2V6z" fill="#D4D0C8" />
    <path d="M5 5h1v6H5zM6 4h1v8H6zM7 3h1v10H7zM8 2h1v12H8z" fill="#FFFF00" />
    <path
      d="M1 6h1v4H1zM2 5h3v1H2zM2 10h3v1H2zM5 4h1v1H5zM5 11h1v1H5zM6 3h1v1H6zM6 12h1v1H6zM7 2h2v1H7zM7 13h2v1H7zM9 2h1v12H9z"
      fill="#000000"
    />
    {muted ? (
      <path
        d="M11 5h1v1h-1zM14 5h1v1h-1zM12 6h2v2h-2zM11 8h1v1h-1zM14 8h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1z"
        fill="#CC0000"
      />
    ) : (
      <>
        <path d="M11 6h1v4h-1z" fill="#000080" />
        <path d="M13 4h1v8h-1z" fill="#000080" />
      </>
    )}
  </svg>
);

/**
 * Classic Windows Media Player 6.4 / mplayer2 stopped-state emblem for the #000000 viewport.
 */
export const WmpClassicLogo: React.FC = () => (
  <div className="flex flex-col items-center justify-center gap-3 select-none pointer-events-none px-4">
    <svg
      width="108"
      height="88"
      viewBox="0 0 54 44"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Classic 3D tilted clapper / Windows Media 6.4 reel emblem */}
      <rect x="6" y="14" width="42" height="24" fill="#202830" />
      <rect x="7" y="15" width="40" height="22" fill="#0D141C" />
      <path d="M6 14h42v1H6zM6 14h1v24H6z" fill="#8090A0" />
      <path d="M6 37h42v1H6zM47 14h1v24h-1z" fill="#000000" />
      {/* Clapper top stripe */}
      <path d="M6 8l40-5 2 6-40 5-2-6z" fill="#303840" />
      <path d="M10 7h5v5h-5zM20 6h5v5h-5zM30 5h5v5h-5zM40 4h5v5h-5z" fill="#DCDCDC" />
      {/* Classic 3-2-1 RGB pixel blocks matching mplayer2/MPC heritage */}
      <path
        d="M11 19h8v2h-8zM17 21h2v3h-2zM13 24h5v2h-5zM17 26h2v4h-2zM11 30h8v2h-8z"
        fill="#E53935"
      />
      <path
        d="M23 19h8v2h-8zM29 21h2v4h-2zM23 24h8v2h-8zM23 26h2v4h-2zM23 30h8v2h-8z"
        fill="#2979FF"
      />
      <path
        d="M36 19h4v2h-4zM38 21h2v9h-2zM35 30h8v2h-8z"
        fill="#43A047"
      />
    </svg>
    <div className="text-center space-y-1">
      <div className="text-[13px] font-bold tracking-wide text-[#DCDCDC]">
        Windows Media Player 6.4
      </div>
      <div className="text-[11px] text-[#8090A0]">
        千禧热带风情映像 · 点击“播放”按钮或画面开始放映
      </div>
    </div>
  </div>
);
