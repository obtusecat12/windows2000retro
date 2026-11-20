import React, { useState } from 'react';
import type { ContextMenuItem, ContextMenuState } from '../../types/os';
import {
  PixelArrowRight,
  PixelCheckmark,
  PixelRadioDot,
} from '../icons/Win2kPixelGlyphs';

interface ContextMenuProps {
  menu: ContextMenuState | null;
  containerWidth?: number;
  containerHeight?: number;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  containerWidth,
  containerHeight,
  onClose,
}) => {
  const [openSubId, setOpenSubId] = useState<string | null>(null);

  if (!menu) return null;

  const maxW = containerWidth ?? window.innerWidth;
  const maxH = containerHeight ?? window.innerHeight;
  const estHeight = Math.min(340, menu.items.length * 22 + 12);
  const adjustedX = Math.max(4, Math.min(menu.x, maxW - 210));
  const adjustedY = Math.max(4, Math.min(menu.y, maxH - estHeight - 30));
  const flipSubLeft = adjustedX > maxW - 390;

  const renderItem = (item: ContextMenuItem) => {
    if (item.separator) {
      return <div key={item.id} className="w2k-menu-sep" />;
    }
    const hasSub = item.submenu && item.submenu.length > 0;
    return (
      <div
        key={item.id}
        className="relative"
        onMouseEnter={() => setOpenSubId(hasSub ? item.id : null)}
      >
        <button
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={`w2k-menu-item ${item.bold ? 'font-bold' : ''}`}
          onClick={() => {
            if (item.disabled || hasSub) return;
            item.action?.();
            onClose();
          }}
        >
          {item.icon ? (
            <img
              src={item.icon}
              width={16}
              height={16}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute left-[4px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] pointer-events-none"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : item.checked && item.radio ? (
            <PixelRadioDot className="absolute left-[8px] top-1/2 -translate-y-1/2" />
          ) : item.checked ? (
            <PixelCheckmark className="absolute left-[7px] top-1/2 -translate-y-1/2" />
          ) : null}

          <span className="truncate">{item.label}</span>

          {hasSub ? (
            <PixelArrowRight className="ml-auto pl-3" />
          ) : item.shortcut ? (
            <span className="text-[12px] opacity-75 ml-auto pl-3">{item.shortcut}</span>
          ) : null}
        </button>

        {hasSub && openSubId === item.id && (
          <div
            className={`w2k-menu-popup absolute top-[-2px] z-20 ${
              flipSubLeft ? 'right-full mr-[-2px]' : 'left-full ml-[-2px]'
            }`}
          >
            {item.submenu!.map((sub) => renderItem(sub))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="menu"
      className="w2k-menu-popup absolute z-[9900] min-w-[184px]"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      {menu.items.map((item) => renderItem(item))}
    </div>
  );
};
