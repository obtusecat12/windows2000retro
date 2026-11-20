import React, { useRef } from 'react';
import type { WindowState } from '../../types/os';
import { Win2kIcon } from '../icons/Win2kIcons';

interface WindowFrameProps {
  win: WindowState;
  isActive: boolean;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number, x?: number, y?: number) => void;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  win,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onMove,
  onResize,
  children,
}) => {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  if (win.isMinimized) return null;

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus(win.id);
    if (win.isMaximized || e.button !== 0) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
    };

    const screenEl = (e.currentTarget as HTMLElement).closest('.w2k-crt-screen') as HTMLElement | null;
    const cw = screenEl?.clientWidth ?? window.innerWidth;
    const ch = screenEl?.clientHeight ?? window.innerHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const maxX = Math.max(0, cw - 120);
      const maxY = Math.max(0, ch - 56);
      const nextX = Math.max(-win.width + 120, Math.min(maxX, dragRef.current.origX + dx));
      const nextY = Math.max(0, Math.min(maxY, dragRef.current.origY + dy));
      onMove(win.id, nextX, nextY);
    };

    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResize = (dir: 'e' | 's' | 'se') => (e: React.MouseEvent) => {
    if (!win.resizable || win.isMaximized) return;
    e.stopPropagation();
    e.preventDefault();
    onFocus(win.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origW = win.width;
    const origH = win.height;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nextW = dir === 'e' || dir === 'se' ? Math.max(win.minWidth, origW + dx) : origW;
      const nextH = dir === 's' || dir === 'se' ? Math.max(win.minHeight, origH + dy) : origH;
      onResize(win.id, nextW, nextH);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const frameStyle: React.CSSProperties = win.isMaximized
    ? {
        left: 0,
        top: 0,
        width: '100%',
        height: 'calc(100% - 28px)',
        zIndex: win.zIndex,
      }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      };

  return (
    <section
      role="dialog"
      aria-label={win.title}
      data-testid={`window-${win.appId}`}
      data-active={isActive ? 'true' : 'false'}
      className="w2k-window-frame absolute flex flex-col"
      style={frameStyle}
      onMouseDown={() => onFocus(win.id)}
    >
      {/* Title Bar */}
      <div
        className={`w2k-titlebar shrink-0 ${isActive ? '' : 'inactive'}`}
        onMouseDown={handleTitleMouseDown}
        onDoubleClick={() => {
          if (win.maximizable) onToggleMaximize(win.id);
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Win2kIcon kind={win.icon} size={16} className="shrink-0" />
          <span className="truncate leading-none">{win.title}</span>
        </div>

        <div className="flex items-center gap-[2px] shrink-0">
          {win.minimizable && (
            <button
              type="button"
              className="w2k-win-btn"
              aria-label={`最小化 ${win.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onMinimize(win.id);
              }}
            >
              <img
                src="/icons/ui/win-minimize.svg"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="w-[6px] h-[2px] mt-[5px] mr-[1px] block pointer-events-none"
                style={{ imageRendering: 'pixelated' }}
              />
            </button>
          )}
          {win.maximizable && (
            <button
              type="button"
              className="w2k-win-btn"
              aria-label={win.isMaximized ? `还原 ${win.title}` : `最大化 ${win.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMaximize(win.id);
              }}
            >
              <img
                src={win.isMaximized ? '/icons/ui/win-restore.svg' : '/icons/ui/win-maximize.svg'}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={
                  win.isMaximized
                    ? 'w-[8px] h-[9px] block pointer-events-none'
                    : 'w-[9px] h-[9px] block pointer-events-none'
                }
                style={{ imageRendering: 'pixelated' }}
              />
            </button>
          )}
          <button
            type="button"
            className="w2k-win-btn ml-[2px]"
            aria-label={`关闭 ${win.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose(win.id);
            }}
          >
            <img
              src="/icons/ui/win-close.svg"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="w-[8px] h-[7px] block pointer-events-none"
              style={{ imageRendering: 'pixelated' }}
            />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden mt-[2px]">
        {children}
      </div>

      {/* Resize handles */}
      {win.resizable && !win.isMaximized && (
        <>
          <div
            onMouseDown={startResize('e')}
            className="absolute top-2 right-0 bottom-2 w-[4px] cursor-ew-resize"
          />
          <div
            onMouseDown={startResize('s')}
            className="absolute left-2 right-2 bottom-0 h-[4px] cursor-ns-resize"
          />
          <div
            onMouseDown={startResize('se')}
            className="absolute right-0 bottom-0 w-[10px] h-[10px] cursor-nwse-resize"
          />
        </>
      )}
    </section>
  );
};
