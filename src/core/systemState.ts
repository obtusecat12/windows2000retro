import type { ImeId, NetworkConnectionState, SystemPowerState } from '../types/os';

export interface ImeDef {
  id: ImeId;
  shortLabel: string;
  label: string;
  title: string;
}

export const WIN2K_IMES: ImeDef[] = [
  {
    id: 'quanpin',
    shortLabel: '拼',
    label: '中文(中国) - 全拼输入法',
    title: '中文 (中国) - 全拼输入法',
  },
  {
    id: 'abc',
    shortLabel: '智',
    label: '中文(中国) - 智能 ABC 输入法',
    title: '中文 (中国) - 智能 ABC 输入法',
  },
  {
    id: 'mspinyin',
    shortLabel: '微',
    label: '中文(中国) - 微软拼音输入法 2.0',
    title: '中文 (中国) - 微软拼音输入法 2.0',
  },
  {
    id: 'en',
    shortLabel: 'En',
    label: '英语(美国)',
    title: '英语 (美国)',
  },
];

export interface TimezoneDef {
  id: string;
  offsetMinutes: number;
  label: string;
}

export const WIN2K_TIMEZONES: TimezoneDef[] = [
  {
    id: 'beijing',
    offsetMinutes: 480,
    label: '(GMT+08:00) 北京，重庆，香港特别行政区，乌鲁木齐',
  },
  {
    id: 'taipei',
    offsetMinutes: 480,
    label: '(GMT+08:00) 台北',
  },
  {
    id: 'tokyo',
    offsetMinutes: 540,
    label: '(GMT+09:00) 大阪，札幌，东京',
  },
  {
    id: 'utc',
    offsetMinutes: 0,
    label: '(GMT) 格林威治标准时间：都柏林，爱丁堡，里斯本，伦敦',
  },
  {
    id: 'pacific',
    offsetMinutes: -480,
    label: '(GMT-08:00) 太平洋时间(美国和加拿大)；蒂华纳',
  },
  {
    id: 'eastern',
    offsetMinutes: -300,
    label: '(GMT-05:00) 东部时间(美国和加拿大)',
  },
];

export interface MixerChannel {
  id: 'master' | 'wave' | 'synth' | 'cd';
  label: string;
  volume: number;
  balance: number; // -50 to 50
  muted: boolean;
}

export const DEFAULT_MIXER_CHANNELS: MixerChannel[] = [
  { id: 'master', label: '主音量', volume: 75, balance: 0, muted: false },
  { id: 'wave', label: '波形', volume: 80, balance: 0, muted: false },
  { id: 'synth', label: 'SW 合成器', volume: 65, balance: 0, muted: false },
  { id: 'cd', label: 'CD 唱机', volume: 70, balance: 0, muted: true },
];

export type PowerTransitionEvent =
  | 'boot-complete'
  | 'press-cad'
  | 'submit-login'
  | 'settings-loaded'
  | 'request-logoff'
  | 'request-shutdown'
  | 'request-restart'
  | 'settings-saved'
  | 'shutdown-complete'
  | 'power-on';

export function transitionPowerState(
  current: SystemPowerState,
  event: PowerTransitionEvent
): SystemPowerState {
  switch (event) {
    case 'boot-complete':
      return current === 'booting' ? 'sas-prompt' : current;
    case 'press-cad':
      return current === 'sas-prompt' ? 'logon' : current;
    case 'submit-login':
      return current === 'logon' ? 'loading-settings' : current;
    case 'settings-loaded':
      return current === 'loading-settings' ? 'running' : current;
    case 'request-logoff':
      return 'saving-settings';
    case 'request-shutdown':
      return 'shutting-down';
    case 'request-restart':
      return 'booting';
    case 'settings-saved':
      return current === 'saving-settings' ? 'logon' : current;
    case 'shutdown-complete':
      return current === 'shutting-down' ? 'halted' : current;
    case 'power-on':
      return 'booting';
    default:
      return current;
  }
}

export function formatConnectionDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function tickNetworkStats(
  prev: NetworkConnectionState,
  burst?: { sentDelta: number; recvDelta: number }
): NetworkConnectionState {
  if (!prev.enabled) return prev;
  const sentDelta = burst ? burst.sentDelta : 2;
  const recvDelta = burst ? burst.recvDelta : 3;
  return {
    ...prev,
    durationSeconds: prev.durationSeconds + (burst ? 0 : 1),
    packetsSent: prev.packetsSent + sentDelta,
    packetsReceived: prev.packetsReceived + recvDelta,
  };
}

export interface CalendarCell {
  day: number;
  inCurrentMonth: boolean;
}

export function buildCalendarMatrix(year: number, monthIndex: number): CalendarCell[] {
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, inCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inCurrentMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ day: nextDay++, inCurrentMonth: false });
  }
  return cells;
}

/**
 * Plays a gentle classic Windows 2000 ding wave using Web Audio API when unmuted.
 */
export function playWin2kDing(volumePercent: number, muted: boolean): void {
  if (muted || volumePercent <= 0) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const level = Math.min(0.18, (volumePercent / 100) * 0.14);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 260);
  } catch {
    // Ignore autoplay or audio hardware blocks gracefully
  }
}
