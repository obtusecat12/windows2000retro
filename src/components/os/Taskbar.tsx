import React, { useEffect, useState } from 'react';
import type { AppId, ImeId, NetworkConnectionState, WindowState } from '../../types/os';
import { WIN2K_IMES, playWin2kDing } from '../../core/systemState';
import { Win2kIcon, Win2kUiIcon, WinFlagIcon } from '../icons/Win2kIcons';
import { PixelCheckmark } from '../icons/Win2kPixelGlyphs';
import { Win2kCheckbox, Win2kVerticalFader } from '../apps/TrayDialogsApp';

interface TaskbarProps {
  windows: WindowState[];
  activeWindowId: string | null;
  startMenuOpen: boolean;
  volume: number;
  muted: boolean;
  imeId: ImeId;
  network: NetworkConnectionState;
  onChangeVolume: (vol: number) => void;
  onChangeMuted: (muted: boolean) => void;
  onChangeIme: (ime: ImeId) => void;
  onToggleStartMenu: () => void;
  onSelectWindow: (id: string) => void;
  onShowDesktop: () => void;
  onLaunchApp: (appId: AppId, payload?: WindowState['payload']) => void;
  onContextMenuTaskbar: (e: React.MouseEvent) => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({
  windows,
  activeWindowId,
  startMenuOpen,
  volume,
  muted,
  imeId,
  network,
  onChangeVolume,
  onChangeMuted,
  onChangeIme,
  onToggleStartMenu,
  onSelectWindow,
  onShowDesktop,
  onLaunchApp,
  onContextMenuTaskbar,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [trayPopup, setTrayPopup] = useState<'none' | 'volume' | 'ime'>('none');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (trayPopup === 'none') return;
    const close = () => setTrayPopup('none');
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [trayPopup]);

  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const weekNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateTitle = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekNames[now.getDay()]}`;
  const activeIme = WIN2K_IMES.find((i) => i.id === imeId) ?? WIN2K_IMES[0];

  return (
    <footer
      className="w2k-taskbar absolute bottom-0 left-0 right-0 z-[9000]"
      onContextMenu={onContextMenuTaskbar}
    >
      {/* Start Button */}
      <button
        type="button"
        aria-label="开始"
        aria-expanded={startMenuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setTrayPopup('none');
          onToggleStartMenu();
        }}
        className={`w2k-btn font-bold px-[6px] h-[22px] min-h-0 shrink-0 ${
          startMenuOpen ? 'pressed' : ''
        }`}
      >
        <WinFlagIcon size={15} />
        <span>开始</span>
      </button>

      <div className="w2k-divider-v shrink-0" />

      {/* Quick Launch Bar */}
      <div className="flex items-center gap-[1px] shrink-0" aria-label="快速启动">
        <div className="w2k-gripper mr-[2px]" />
        <button
          type="button"
          className="w2k-toolbar-btn p-[2px]"
          title="显示桌面"
          aria-label="显示桌面"
          onClick={onShowDesktop}
        >
          <Win2kUiIcon name="show-desktop" size={16} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn p-[2px]"
          title="启动 Internet Explorer 浏览器"
          aria-label="启动 Internet Explorer 浏览器"
          onClick={() => onLaunchApp('ie')}
        >
          <Win2kIcon kind="ie" size={16} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn p-[2px]"
          title="记事本"
          aria-label="快速启动记事本"
          onClick={() => onLaunchApp('notepad')}
        >
          <Win2kIcon kind="notepad" size={16} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn p-[2px]"
          title="命令提示符"
          aria-label="快速启动命令提示符"
          onClick={() => onLaunchApp('cmd')}
        >
          <Win2kIcon kind="cmd" size={16} />
        </button>
      </div>

      <div className="w2k-divider-v shrink-0" />
      <div className="w2k-gripper shrink-0" />

      {/* Open Window Task Buttons */}
      <div className="flex items-center gap-[3px] flex-1 min-w-0 overflow-hidden">
        {windows.map((w) => {
          const isActive = w.id === activeWindowId && !w.isMinimized;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelectWindow(w.id)}
              className={`w2k-task-btn ${isActive ? 'active' : ''}`}
              title={w.title}
            >
              <Win2kIcon kind={w.icon} size={16} className="shrink-0" />
              <span className="truncate text-left">{w.title}</span>
            </button>
          );
        })}
      </div>

      {/* System Tray (Notification Area) */}
      <div className="w2k-sunken-bar h-[22px] px-1.5 flex items-center gap-1.5 shrink-0 relative">
        {/* Input Method Indicator */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTrayPopup((p) => (p === 'ime' ? 'none' : 'ime'));
          }}
          title={activeIme.title}
          aria-label="切换输入法"
          aria-expanded={trayPopup === 'ime'}
          className="w-[16px] h-[16px] flex items-center justify-center bg-[#0A246A] text-white text-[12px] font-bold leading-none cursor-default"
        >
          {activeIme.shortLabel}
        </button>

        {/* Local Area Connection Tray Icon (authentic 4-state dual-monitor icons) */}
        <button
          type="button"
          title={
            network.enabled
              ? `本地连接\n速度: ${network.speedMbps}\n状态: 已连接`
              : '本地连接\n状态: 已禁用'
          }
          aria-label="本地连接状态"
          onClick={(e) => {
            e.stopPropagation();
            setTrayPopup('none');
            onLaunchApp('netstatus');
          }}
          className="relative bg-transparent border-0 p-0 cursor-default flex items-center"
        >
          {(() => {
            if (!network.enabled) {
              return (
                <>
                  <Win2kUiIcon name="lan-00-16" size={16} />
                  <Win2kUiIcon
                    name="lan-dis-16"
                    size={16}
                    className="absolute inset-0 pointer-events-none"
                  />
                </>
              );
            }
            const phase = network.activityTick % 4;
            const lanIcon =
              phase === 1
                ? 'lan-10-16'
                : phase === 2
                ? 'lan-01-16'
                : phase === 3
                ? 'lan-11-16'
                : 'lan-00-16';
            return <Win2kUiIcon name={lanIcon} size={16} />;
          })()}
        </button>

        {/* Volume Icon (Single click -> vertical tray popup; Double click -> SndVol32 mixer) */}
        <button
          type="button"
          title={muted ? '音量: 静音（双击打开音量控制）' : `音量: ${volume}%（双击打开音量控制）`}
          aria-label="音量控制"
          aria-expanded={trayPopup === 'volume'}
          onClick={(e) => {
            e.stopPropagation();
            setTrayPopup((p) => (p === 'volume' ? 'none' : 'volume'));
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setTrayPopup('none');
            onLaunchApp('sndvol');
          }}
          className="bg-transparent border-0 p-0 cursor-default flex items-center"
        >
          <Win2kUiIcon name={muted || volume === 0 ? 'tray-volume-muted' : 'tray-volume'} size={16} />
        </button>

        {/* System Clock (Hover -> Date tooltip; Click/DoubleClick -> Date & Time Properties) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTrayPopup('none');
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setTrayPopup('none');
            onLaunchApp('timedate');
          }}
          title={`${dateTitle}\n双击调整日期和时间`}
          aria-label={`系统时间 ${timeStr}，双击调整日期和时间`}
          className="bg-transparent border-0 p-0 pl-0.5 text-[12px] text-black tabular-nums cursor-default"
        >
          {timeStr}
        </button>

        {/* Authentic Win2K Input Method Selector Popup */}
        {trayPopup === 'ime' && (
          <div
            className="w2k-menu-popup absolute bottom-[24px] right-[36px] min-w-[196px] z-[9500]"
            onClick={(e) => e.stopPropagation()}
          >
            {WIN2K_IMES.map((ime) => (
              <button
                key={ime.id}
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  onChangeIme(ime.id);
                  setTrayPopup('none');
                }}
              >
                {imeId === ime.id && (
                  <PixelCheckmark className="absolute left-[7px] top-1/2 -translate-y-1/2" />
                )}
                <span>{ime.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Authentic Win2K Vertical Tray Volume Popup */}
        {trayPopup === 'volume' && (
          <div
            className="w2k-window-frame absolute bottom-[24px] right-[18px] w-[76px] p-2 flex flex-col items-center gap-2 z-[9500]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[12px] text-black leading-none">音量</div>

            <div className="flex items-center gap-1 py-0.5">
              {/* Classic gray volume triangle wedge */}
              <svg width="11" height="94" viewBox="0 0 11 94" aria-hidden="true">
                <polygon points="1,2 10,2 10,92" fill="#808080" />
                <polygon points="2,3 9,3 9,85" fill="#D4D0C8" />
                <line x1="10" y1="2" x2="10" y2="92" stroke="#FFFFFF" strokeWidth="1" />
              </svg>
              <Win2kVerticalFader
                value={muted ? 0 : volume}
                height={102}
                ariaLabel="系统托盘音量滑块"
                onChange={(v) => {
                  if (muted && v > 0) onChangeMuted(false);
                  onChangeVolume(v);
                }}
                onCommit={(v) => playWin2kDing(v, muted)}
              />
            </div>

            <Win2kCheckbox
              checked={muted}
              onChange={(m) => onChangeMuted(m)}
              label="静音(M)"
              className="text-[12px]"
            />

            <button
              type="button"
              onClick={() => {
                setTrayPopup('none');
                onLaunchApp('sndvol');
              }}
              className="w-full text-[12px] text-[#0A246A] hover:underline bg-transparent border-0 p-0 pt-0.5 border-t border-[#808080] cursor-default text-center"
            >
              音量控制...
            </button>
          </div>
        )}
      </div>
    </footer>
  );
};
