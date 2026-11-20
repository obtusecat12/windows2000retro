import React, { useEffect, useRef, useState } from 'react';
import type { NetworkConnectionState } from '../../types/os';
import {
  DEFAULT_MIXER_CHANNELS,
  MixerChannel,
  WIN2K_TIMEZONES,
  buildCalendarMatrix,
  formatConnectionDuration,
} from '../../core/systemState';
import { Win2kUiIcon } from '../icons/Win2kIcons';

/* Reusable authentic Windows 2000 13x13 sharp sunken checkbox */
export const Win2kCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}> = ({ checked, onChange, label, disabled = false, className = '' }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-default text-left text-[12px] text-black ${className}`}
  >
    <span className={`w2k-checkbox-box ${disabled ? 'disabled' : ''}`} aria-hidden="true">
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9" shapeRendering="crispEdges">
          <path
            d="M1 4h1v1h1v1h1V4h1V3h1V2h1V1h1v2H7v1H6v1H5v1H4v1H3V6H2V5H1z"
            fill={disabled ? '#808080' : '#000000'}
          />
        </svg>
      )}
    </span>
    <span>{label}</span>
  </button>
);

/* Reusable authentic Windows 2000 vertical volume trackbar */
export const Win2kVerticalFader: React.FC<{
  value: number;
  onChange: (next: number) => void;
  onCommit?: (val: number) => void;
  height?: number;
  ariaLabel?: string;
}> = ({ value, onChange, onCommit, height = 104, ariaLabel = '音量滑块' }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const calcValueFromClientY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    return Math.round(Math.max(0, Math.min(100, ratio * 100)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = calcValueFromClientY(e.clientY);
    onChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.buttons & 1) !== 1) return;
    const next = calcValueFromClientY(e.clientY);
    onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const next = calcValueFromClientY(e.clientY);
    onCommit?.(next);
  };

  const thumbTop = Math.round(((100 - value) / 100) * (height - 10));

  return (
    <div className="flex items-center gap-1 select-none">
      {/* Left tick marks */}
      <div
        className="flex flex-col justify-between py-[4px]"
        style={{ height }}
        aria-hidden="true"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[4px] h-[1px] bg-[#808080]" />
        ))}
      </div>

      {/* Sunken track + draggable sharp beveled thumb */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        style={{ height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(Math.min(100, value + 5));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(Math.max(0, value - 5));
          }
        }}
        className="relative w-[22px] flex justify-center cursor-default outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black"
      >
        <div
          className="w-[4px] h-full bg-[#B4B0A8]"
          style={{
            borderTop: '1px solid #808080',
            borderLeft: '1px solid #808080',
            borderRight: '1px solid #FFFFFF',
            borderBottom: '1px solid #FFFFFF',
          }}
        />
        {/* Win2K horizontal beveled slider knob */}
        <div
          style={{ top: thumbTop }}
          className="absolute left-0 w-[22px] h-[10px] bg-[var(--w2k-face)] border-t border-l border-white border-r border-b border-r-[#404040] border-b-[#404040] shadow-[inset_-1px_-1px_0_#808080,inset_1px_1px_0_#E8E6E1] flex items-center justify-center pointer-events-none"
        >
          <div className="w-[14px] h-[1px] bg-[#808080]" />
        </div>
      </div>

      {/* Right tick marks */}
      <div
        className="flex flex-col justify-between py-[4px]"
        style={{ height }}
        aria-hidden="true"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[4px] h-[1px] bg-[#808080]" />
        ))}
      </div>
    </div>
  );
};

/* 1. Volume Control Mixer (音量控制 - SndVol32) */
interface SndVolAppProps {
  volume: number;
  muted: boolean;
  onChangeMasterVolume: (vol: number) => void;
  onChangeMasterMuted: (muted: boolean) => void;
  onClose: () => void;
}

export const SndVolApp: React.FC<SndVolAppProps> = ({
  volume,
  muted,
  onChangeMasterVolume,
  onChangeMasterMuted,
  onClose,
}) => {
  const [channels, setChannels] = useState<MixerChannel[]>(() =>
    DEFAULT_MIXER_CHANNELS.map((c) =>
      c.id === 'master' ? { ...c, volume, muted } : c
    )
  );
  const [openMenu, setOpenMenu] = useState<'options' | 'help' | null>(null);

  const updateChannel = (id: MixerChannel['id'], patch: Partial<MixerChannel>) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch))
    );
    if (id === 'master') {
      if (patch.volume !== undefined) onChangeMasterVolume(patch.volume);
      if (patch.muted !== undefined) onChangeMasterMuted(patch.muted);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--w2k-face)] select-none"
      onClick={() => setOpenMenu(null)}
    >
      {/* Menu Bar */}
      <div className="w2k-menubar relative">
        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'options' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'options' ? null : 'options');
            }}
          >
            选项(P)
          </button>
          {openMenu === 'options' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setChannels(DEFAULT_MIXER_CHANNELS);
                  onChangeMasterVolume(75);
                  onChangeMasterMuted(false);
                  setOpenMenu(null);
                }}
              >
                恢复默认音量(R)
              </button>
              <div className="w2k-menu-sep" />
              <button type="button" className="w2k-menu-item" onClick={onClose}>
                退出(X)
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="w2k-menubar-item"
          onClick={() => setOpenMenu(null)}
        >
          帮助(H)
        </button>
      </div>

      {/* Channels Strip */}
      <div className="flex-1 grid grid-cols-4 divide-x divide-[#808080] bg-[var(--w2k-face)] min-h-0">
        {channels.map((ch) => {
          const effectiveVol = ch.id === 'master' ? volume : ch.volume;
          const effectiveMuted = ch.id === 'master' ? muted : ch.muted;
          return (
            <div
              key={ch.id}
              className="flex flex-col items-center justify-between p-2.5 gap-2 border-l border-white first:border-l-0"
            >
              <div className="text-[12px] font-bold text-black">{ch.label}</div>

              {/* Balance mini-bar */}
              <div className="w-full flex flex-col items-center gap-0.5">
                <div className="text-[10px] text-[#404040]">平衡:</div>
                <div className="flex items-center gap-1 text-[10px] text-[#404040]">
                  <span>左</span>
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label={`${ch.label} 声道平衡`}
                    aria-valuemin={-50}
                    aria-valuemax={50}
                    aria-valuenow={ch.balance}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - r.left) / r.width;
                      updateChannel(ch.id, {
                        balance: Math.round((ratio - 0.5) * 100),
                      });
                    }}
                    className="relative w-[44px] h-[12px] flex items-center cursor-default"
                  >
                    <div className="w-full h-[3px] bg-[#B4B0A8] border-t border-l border-[#808080] border-r border-b border-white" />
                    <div
                      style={{ left: `${((ch.balance + 50) / 100) * 34}px` }}
                      className="absolute w-[10px] h-[12px] bg-[var(--w2k-face)] border-t border-l border-white border-r border-b border-[#404040]"
                    />
                  </div>
                  <span>右</span>
                </div>
              </div>

              {/* Vertical Volume Fader */}
              <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-[#404040]">音量:</div>
                <div className="flex items-center gap-1">
                  {/* Volume triangle indicator */}
                  <svg width="10" height="86" viewBox="0 0 10 86" aria-hidden="true">
                    <polygon points="1,2 9,2 9,84" fill="#808080" />
                    <polygon points="2,3 8,3 8,78" fill="#D4D0C8" />
                  </svg>
                  <Win2kVerticalFader
                    value={effectiveVol}
                    height={92}
                    ariaLabel={`${ch.label} 滑块`}
                    onChange={(v) =>
                      updateChannel(ch.id, { volume: v, muted: v > 0 ? false : effectiveMuted })
                    }
                  />
                </div>
              </div>

              {/* Mute Checkbox */}
              <Win2kCheckbox
                checked={effectiveMuted}
                onChange={(m) => updateChannel(ch.id, { muted: m })}
                label={ch.id === 'master' ? '全部静音(M)' : '静音(M)'}
              />
            </div>
          );
        })}
      </div>

      {/* Status Bar */}
      <div className="w2k-sunken-bar px-2 py-[2px] text-[11px] text-[#404040]">
        ESS Maestro PCI Audio (WDM) · 主音量: {muted ? '静音' : `${volume}%`}
      </div>
    </div>
  );
};

/* 2. Local Area Connection Status (本地连接 状态) */
interface LocalAreaStatusAppProps {
  network: NetworkConnectionState;
  onToggleEnabled: () => void;
  onClose: () => void;
}

export const LocalAreaStatusApp: React.FC<LocalAreaStatusAppProps> = ({
  network,
  onToggleEnabled,
  onClose,
}) => {
  const [showProperties, setShowProperties] = useState(false);

  if (showProperties) {
    return (
      <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-2.5 gap-2.5">
        <div className="flex items-end px-0.5">
          <button type="button" className="w2k-tab active">
            常规
          </button>
        </div>
        <div className="w2k-tab-panel flex-1 flex flex-col gap-2.5 text-[12px]">
          <div className="flex items-center gap-2">
            <span>连接时使用:</span>
          </div>
          <div className="w2k-inset bg-white px-2 py-1 text-[12px]">
            Intel(R) PRO/100+ Management Adapter
          </div>
          <div>此连接使用下列项目(O):</div>
          <div className="w2k-inset bg-white flex-1 p-1.5 space-y-1.5 text-[12px]">
            <div className="flex items-center gap-2 bg-[var(--w2k-selection-bg)] text-white px-1.5 py-0.5">
              <span>☑</span>
              <span>Microsoft 网络客户端</span>
            </div>
            <div className="flex items-center gap-2 px-1.5 py-0.5">
              <span>☑</span>
              <span>Microsoft 网络的文件和打印机共享</span>
            </div>
            <div className="flex items-center gap-2 px-1.5 py-0.5">
              <span>☑</span>
              <span>Internet 协议 (TCP/IP)</span>
            </div>
          </div>
          <fieldset className="w2k-fieldset text-[11px] space-y-0.5">
            <legend>TCP/IP 当前地址信息</legend>
            <div>IP 地址: 192.168.1.108 · 子网掩码: 255.255.255.0</div>
            <div>默认网关: 192.168.1.1 · DNS: 202.106.0.20</div>
          </fieldset>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="w2k-btn default-btn min-w-[74px]"
            onClick={() => setShowProperties(false)}
          >
            确定
          </button>
          <button
            type="button"
            className="w2k-btn min-w-[74px]"
            onClick={() => setShowProperties(false)}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  const phase = network.activityTick % 4;
  const statusIcon32 = !network.enabled
    ? 'lan-dis-32'
    : phase === 1
    ? 'lan-10-32'
    : phase === 2
    ? 'lan-01-32'
    : phase === 3
    ? 'lan-11-32'
    : 'lan-00-32';

  return (
    <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-2.5 gap-2.5">
      <div className="flex items-end px-0.5">
        <button type="button" className="w2k-tab active">
          常规
        </button>
      </div>

      <div className="w2k-tab-panel flex-1 flex flex-col gap-2.5 text-[12px]">
        {/* Connection Box (statmon.rc IDD_STATMON_GENERAL_LAN) */}
        <fieldset className="w2k-fieldset space-y-1.5">
          <legend>连接</legend>
          <div className="flex justify-between">
            <span>状态:</span>
            <span className="font-bold">
              {network.enabled ? '已连接' : '已禁用'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>持续时间:</span>
            <span className="tabular-nums">
              {network.enabled ? formatConnectionDuration(network.durationSeconds) : '00:00:00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>速度:</span>
            <span className="tabular-nums">
              {network.enabled ? network.speedMbps : '0 bps'}
            </span>
          </div>
        </fieldset>

        {/* Activity Box matching Windows 2000 netshell.dll */}
        <fieldset className="w2k-fieldset space-y-2">
          <legend>活动</legend>

          {/* Top Row: 已发送 --- [32x32 Dual-PC Icon] --- 已收到 */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-black shrink-0 w-[44px] text-right">已发送</span>
            <div className="flex-1 h-[2px] border-t border-[#808080] border-b border-white" />
            <Win2kUiIcon name={statusIcon32} size={32} />
            <div className="flex-1 h-[2px] border-t border-[#808080] border-b border-white" />
            <span className="text-[12px] text-black shrink-0 w-[44px] text-left">已收到</span>
          </div>

          {/* Bottom Row: 数据包:  12,450 | 18,920 */}
          <div className="grid grid-cols-[54px_1fr_2px_1fr] items-center gap-2 pt-0.5">
            <span className="text-[12px] text-black">数据包:</span>
            <span className="text-[12px] tabular-nums text-right">
              {network.packetsSent.toLocaleString('en-US')}
            </span>
            <div className="h-[18px] w-[2px] border-l border-[#808080] border-r border-white" />
            <span className="text-[12px] tabular-nums text-right">
              {network.packetsReceived.toLocaleString('en-US')}
            </span>
          </div>
        </fieldset>

        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            type="button"
            className="w2k-btn min-w-[82px]"
            onClick={() => setShowProperties(true)}
          >
            属性(P)
          </button>
          <button
            type="button"
            className="w2k-btn min-w-[82px]"
            onClick={onToggleEnabled}
          >
            {network.enabled ? '禁用(D)' : '启用(E)'}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="w2k-btn default-btn min-w-[74px]" onClick={onClose}>
          关闭(C)
        </button>
      </div>
    </div>
  );
};

/* Crisp high-DPI Windows 2000 timedate.cpl analog clock (smooth hands, zero jaggedness) */
const Win2kAnalogClock: React.FC<{ date: Date }> = ({ date }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 124;
    const dpr = Math.max(2, window.devicePixelRatio || 2);
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 52;

    // 12 authentic Win2K timedate.cpl hour pips (3D teal squares at 12/3/6/9, crisp ticks at others)
    for (let i = 0; i < 12; i++) {
      const rad = (i * 30 * Math.PI) / 180;
      const px = Math.round(cx + Math.sin(rad) * radius);
      const py = Math.round(cy - Math.cos(rad) * radius);
      if (i % 3 === 0) {
        // 5x5 beveled teal square matching clock.c BLOB_COLOR
        ctx.fillStyle = '#008080';
        ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
        ctx.fillStyle = '#00FFFF';
        ctx.fillRect(px - 2.5, py - 2.5, 5, 1);
        ctx.fillRect(px - 2.5, py - 2.5, 1, 5);
        ctx.fillStyle = '#000000';
        ctx.fillRect(px - 2.5, py + 1.5, 5, 1);
        ctx.fillRect(px + 1.5, py - 2.5, 1, 5);
      } else {
        ctx.fillStyle = '#008080';
        ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(px - 1, py - 1, 1, 1);
      }
    }

    const hrs = date.getHours();
    const mins = date.getMinutes();
    const secs = date.getSeconds();
    const hrAngle = (((hrs % 12) + mins / 60) * 30 * Math.PI) / 180;
    const minAngle = ((mins + secs / 60) * 6 * Math.PI) / 180;
    const secAngle = (secs * 6 * Math.PI) / 180;

    // DrawFatHand from Win2K timedate.cpl: classic teal diamond polygon with crisp dark & cyan bevel
    const drawDiamondHand = (angle: number, length: number, tail: number, width: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(width, 0);
      ctx.lineTo(0, tail);
      ctx.lineTo(-width, 0);
      ctx.closePath();

      ctx.fillStyle = '#008080';
      ctx.fill();

      // Highlight edge (left)
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(-width, 0);
      ctx.lineTo(0, tail);
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Shadow edge (right)
      ctx.beginPath();
      ctx.moveTo(0, -length);
      ctx.lineTo(width, 0);
      ctx.lineTo(0, tail);
      ctx.strokeStyle = '#003838';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    };

    drawDiamondHand(hrAngle, 30, 7, 4.2);
    drawDiamondHand(minAngle, 43, 9, 3.2);

    // Smooth crisp second hand
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(secAngle);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -45);
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.restore();
  }, [date]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="模拟时钟"
      style={{ width: 124, height: 124 }}
      className="block"
    />
  );
};

/* 3. Date and Time Properties (日期和时间 属性) */
interface DateTimePropsAppProps {
  onClose: () => void;
}

const WORLD_MAP_SRC: Record<string, string> = {
  beijing: '/win2k-ui/world-map-beijing.png',
  taipei: '/win2k-ui/world-map-beijing.png',
  tokyo: '/win2k-ui/world-map-tokyo.png',
  utc: '/win2k-ui/world-map-utc.png',
  pacific: '/win2k-ui/world-map-pacific.png',
  eastern: '/win2k-ui/world-map-eastern.png',
};

export const DateTimePropsApp: React.FC<DateTimePropsAppProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'datetime' | 'timezone'>('datetime');
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const [timeOffsetSec, setTimeOffsetSec] = useState(0);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [timezoneId, setTimezoneId] = useState('beijing');
  const [dstAuto, setDstAuto] = useState(true);

  useEffect(() => {
    const t = window.setInterval(() => setDisplayDate(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const effectiveDate = new Date(displayDate.getTime() + timeOffsetSec * 1000);
  const cells = buildCalendarMatrix(selectedYear, selectedMonth);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
  ];

  const hrs = effectiveDate.getHours();
  const mins = effectiveDate.getMinutes();
  const secs = effectiveDate.getSeconds();
  const currentTzLabel = WIN2K_TIMEZONES.find((t) => t.id === timezoneId)?.label ?? '中国标准时间';
  const mapSrc = WORLD_MAP_SRC[timezoneId] ?? '/win2k-ui/world-map.png';

  return (
    <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-2.5 gap-2.5">
      <div className="flex items-end px-0.5">
        <button
          type="button"
          className={`w2k-tab ${tab === 'datetime' ? 'active' : ''}`}
          onClick={() => setTab('datetime')}
        >
          日期和时间
        </button>
        <button
          type="button"
          className={`w2k-tab ${tab === 'timezone' ? 'active' : ''}`}
          onClick={() => setTab('timezone')}
        >
          时区
        </button>
      </div>

      <div className="w2k-tab-panel flex-1 flex flex-col gap-2.5 min-h-0">
        {tab === 'datetime' ? (
          <>
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
              {/* Left: Date Selector + Calendar */}
              <fieldset className="w2k-fieldset flex flex-col gap-2">
                <legend>日期(D)</legend>
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="选择月份"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w2k-select flex-1 py-0.5 text-[11px]"
                  >
                    {monthNames.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-stretch">
                    <input
                      type="number"
                      aria-label="输入年份"
                      min={1980}
                      max={2035}
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value) || 2000)}
                      className="w2k-input w-[54px] text-[11px] tabular-nums"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="年份加一"
                        onClick={() => setSelectedYear((y) => Math.min(2035, y + 1))}
                        className="w2k-btn px-1 min-h-0 h-[11px] text-[7px] leading-none"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label="年份减一"
                        onClick={() => setSelectedYear((y) => Math.max(1980, y - 1))}
                        className="w2k-btn px-1 min-h-0 h-[11px] text-[7px] leading-none"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="w2k-inset bg-white p-1 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-7 text-center text-[11px] text-[#0A246A] border-b border-[#D4D0C8] pb-0.5">
                    {weekDays.map((w) => (
                      <div key={w}>{w}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-[1px] text-center text-[11px] tabular-nums">
                    {cells.map((cell, idx) => {
                      const isSel = cell.inCurrentMonth && cell.day === selectedDay;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => cell.inCurrentMonth && setSelectedDay(cell.day)}
                          className={`py-[1px] border-0 cursor-default ${
                            !cell.inCurrentMonth
                              ? 'text-[#A0A0A0] bg-transparent'
                              : isSel
                              ? 'bg-[#0A246A] text-white font-bold'
                              : 'text-black bg-transparent hover:bg-[#DCE8F8]'
                          }`}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </fieldset>

              {/* Right: High-DPI Smooth Analog Clock + Digital Time Spinner */}
              <fieldset className="w2k-fieldset flex flex-col items-center justify-between gap-2">
                <legend>时间(T)</legend>
                <div className="flex-1 flex items-center justify-center">
                  <Win2kAnalogClock date={effectiveDate} />
                </div>
                <div className="flex items-stretch w-[124px]">
                  <div className="w2k-input flex-1 text-center tabular-nums text-[12px] py-[2px]">
                    {String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:
                    {String(secs).padStart(2, '0')}
                  </div>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="时间加一分钟"
                      onClick={() => setTimeOffsetSec((s) => s + 60)}
                      className="w2k-btn px-1 min-h-0 h-[11px] text-[7px] leading-none"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="时间减一分钟"
                      onClick={() => setTimeOffsetSec((s) => s - 60)}
                      className="w2k-btn px-1 min-h-0 h-[11px] text-[7px] leading-none"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </fieldset>
            </div>
            <div className="text-[11px] text-black truncate">
              当前时区: {currentTzLabel}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col gap-2.5 min-h-0">
            <select
              aria-label="选择时区"
              value={timezoneId}
              onChange={(e) => setTimezoneId(e.target.value)}
              className="w2k-select w-full text-[12px]"
            >
              {WIN2K_TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
            </select>

            {/* Official Windows 2000 timedate.cpl smalwrld.bmp World Timezone Map */}
            <div className="w2k-inset bg-[#00007F] flex items-center justify-center overflow-hidden">
              <img
                src={mapSrc}
                alt="Windows 2000 世界时区地图"
                draggable={false}
                className="w-full h-auto block"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <Win2kCheckbox
              checked={dstAuto}
              onChange={setDstAuto}
              label="自动随夏令时调整时钟(T)"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="w2k-btn default-btn min-w-[74px]" onClick={onClose}>
          确定
        </button>
        <button type="button" className="w2k-btn min-w-[74px]" onClick={onClose}>
          取消
        </button>
        <button type="button" className="w2k-btn min-w-[74px]" onClick={() => {}}>
          应用(A)
        </button>
      </div>
    </div>
  );
};
