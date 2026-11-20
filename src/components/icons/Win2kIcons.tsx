import React, { useEffect, useState } from 'react';
import type { IconKind } from '../../types/os';

interface IconProps {
  kind: IconKind;
  size?: 16 | 24 | 32 | 48;
  className?: string;
}

export type UiIconName =
  | 'show-desktop'
  | 'tray-network'
  | 'tray-volume'
  | 'tray-volume-muted'
  | 'nav-back'
  | 'nav-forward'
  | 'nav-up'
  | 'nav-home'
  | 'nav-refresh'
  | 'nav-stop'
  | 'folder-new'
  | 'delete'
  | 'view-details'
  | 'view-icons'
  | 'date-16'
  | 'date-32'
  | 'ie-url'
  | 'ie-htmldoc'
  | 'ie-globe'
  | 'ie-browse'
  | 'lan-00-16'
  | 'lan-01-16'
  | 'lan-10-16'
  | 'lan-11-16'
  | 'lan-dis-16'
  | 'lan-00-32'
  | 'lan-01-32'
  | 'lan-10-32'
  | 'lan-11-32'
  | 'lan-dis-32';

/**
 * Known 0-based sprite indices in public/icons/ui/browse-ui-icons.png (63 icons, 20x20 each).
 * Grayscale strip is used at rest and 24-bit color strip on hover/active, matching Windows 2000 & IE5.
 */
export const BROWSE_UI_SPRITES = {
  back: 0,
  forward: 1,
  stop: 2,
  refresh: 3,
  home: 4,
  searchGlobe: 5,
  favorites: 6,
  print: 7,
  fontSize: 8,
  edit: 9,
  history: 12,
  mail: 13,
  folders: 59,
  cut: 21,
  copy: 22,
  paste: 23,
  undo: 24,
  delete: 26,
  properties: 31,
  find: 33,
  viewIcons: 36,
  viewList: 38,
  viewDetails: 39,
  up: 44,
  newFolder: 48,
  moveTo: 60,
  copyTo: 61,
} as const;

export type BrowseUiSpriteName = keyof typeof BROWSE_UI_SPRITES;

/**
 * Authentic Windows 2000 / 98 4-color flying Windows flag icon.
 */
export const WinFlagIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className = '',
}) => {
  const src = size <= 20 ? '/icons/ui/win-flag-16.png' : '/icons/ui/win-flag-32.png';
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

/**
 * Authentic extracted Windows 2000 / 98 system & application icons (16x16, 32x32, 48x48 PNGs).
 */
export const Win2kIcon: React.FC<IconProps> = ({ kind, size = 32, className = '' }) => {
  let src = `/icons/32/${kind}.png`;
  if (kind === 'timedate') {
    src = size <= 16 ? '/icons/ui/date-16.png' : '/icons/ui/date-32.png';
  } else if (size <= 16) {
    src = `/icons/16/${kind}.png`;
  } else if (size >= 48 && kind === 'my-computer') {
    src = '/icons/48/my-computer.png';
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

/**
 * Authentic extracted Windows 2000 / Redmond97 toolbar & notification tray icons.
 */
export const Win2kUiIcon: React.FC<{
  name: UiIconName;
  size?: number;
  className?: string;
}> = ({ name, size = 16, className = '' }) => (
  <img
    src={`/icons/ui/${name}.png`}
    width={size}
    height={size}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`inline-block shrink-0 select-none ${className}`}
    style={{ imageRendering: 'pixelated' }}
  />
);

/**
 * Authentic IE5 / Win2K Explorer 20x20 sprite icon from browse-ui-icons.
 * Renders grayscale at rest and switches to 24-bit color when parent .w2k-toolbar-btn is hovered/active.
 */
export const Win2kBrowseIcon: React.FC<{
  sprite: BrowseUiSpriteName;
  disabled?: boolean;
  alwaysColor?: boolean;
  className?: string;
}> = ({ sprite, disabled = false, alwaysColor = false, className = '' }) => {
  const index = BROWSE_UI_SPRITES[sprite];
  const offset = -(index * 20);
  return (
    <span
      aria-hidden="true"
      data-always-color={alwaysColor ? 'true' : 'false'}
      className={`w2k-browse-sprite ${disabled ? 'is-disabled' : ''} ${className}`}
      style={{ backgroundPosition: `${offset}px 0px` }}
    />
  );
};

/**
 * Authentic Windows 2000 Explorer / IE5 top-right brand throbber (22x22 or 38x38) from browseui brand.bmp.
 */
export const Win2kThrobber: React.FC<{
  size?: 22 | 38;
  loading?: boolean;
}> = ({ size = 22, loading = false }) => {
  const [frame, setFrame] = useState(0);
  const totalFrames = 41;

  useEffect(() => {
    if (!loading) {
      setFrame(0);
      return;
    }
    const timer = window.setInterval(() => {
      setFrame((f) => (f + 1) % totalFrames);
    }, 65);
    return () => window.clearInterval(timer);
  }, [loading]);

  const src = size === 38 ? '/win2k-ui/throbber-38.png' : '/win2k-ui/throbber-22.png';

  return (
    <div
      className="shrink-0 bg-black flex items-center justify-center border-l border-[var(--w2k-shadow)]"
      style={{ width: size === 38 ? 39 : 26, height: '100%' }}
      aria-hidden="true"
    >
      <span
        style={{
          display: 'block',
          width: size,
          height: size,
          backgroundImage: `url(${src})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `0px -${frame * size}px`,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
};
