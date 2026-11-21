import React, { useEffect, useState } from 'react';
import type {
  AppId,
  ColorSchemeId,
  SystemPowerState,
  WallpaperId,
  WindowState,
} from '../../types/os';
import {
  WIN2K_COLOR_SCHEMES,
  WIN2K_WALLPAPERS,
  getWallpaperStyle,
} from '../../core/themes';
import { Win2kIcon, WinFlagIcon } from '../icons/Win2kIcons';
import { Win2kCheckbox } from './TrayDialogsApp';

/* 1. Display Properties (显示属性) */
interface DisplayPropsAppProps {
  wallpaper: WallpaperId;
  colorScheme: ColorSchemeId;
  crtEnabled: boolean;
  onApply: (wallpaper: WallpaperId, scheme: ColorSchemeId, crtEnabled: boolean) => void;
  onClose: () => void;
}

export const DisplayPropsApp: React.FC<DisplayPropsAppProps> = ({
  wallpaper,
  colorScheme,
  crtEnabled,
  onApply,
  onClose,
}) => {
  const [tab, setTab] = useState<'bg' | 'appearance' | 'settings'>('bg');
  const [draftWallpaper, setDraftWallpaper] = useState<WallpaperId>(wallpaper);
  const [draftScheme, setDraftScheme] = useState<ColorSchemeId>(colorScheme);
  const [draftCrt, setDraftCrt] = useState<boolean>(crtEnabled);

  const previewScheme = WIN2K_COLOR_SCHEMES[draftScheme];

  return (
    <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-2.5 gap-2.5">
      {/* Tabs */}
      <div className="flex items-end px-0.5">
        <button
          type="button"
          className={`w2k-tab ${tab === 'bg' ? 'active' : ''}`}
          onClick={() => setTab('bg')}
        >
          背景
        </button>
        <button
          type="button"
          className={`w2k-tab ${tab === 'appearance' ? 'active' : ''}`}
          onClick={() => setTab('appearance')}
        >
          外观
        </button>
        <button
          type="button"
          className={`w2k-tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          设置
        </button>
      </div>

      {/* Tab Panel */}
      <div className="w2k-tab-panel flex-1 flex flex-col gap-3 min-h-0">
        {/* CRT Monitor Preview */}
        <div className="flex flex-col items-center py-1">
          <div className="w-[184px] h-[136px] bg-[#D4D0C8] border-2 border-[#808080] p-2.5 flex flex-col items-center">
            <div
              className="w-full h-full border border-[#404040] relative overflow-hidden flex items-center justify-center"
              style={getWallpaperStyle(draftWallpaper, previewScheme.desktopBg)}
            >
              {draftWallpaper === 'win2000' && (
                <div className="text-[9px] text-white/90 font-bold text-center">
                  Windows 2000
                </div>
              )}
              <div
                className="absolute right-2 bottom-2 w-[88px] h-[54px] border border-[#404040] p-[2px]"
                style={{ backgroundColor: previewScheme.face }}
              >
                <div
                  className="h-[10px] px-1 text-[7px] flex items-center"
                  style={{
                    background: `linear-gradient(90deg, ${previewScheme.activeTitleStart}, ${previewScheme.activeTitleEnd})`,
                    color: previewScheme.activeTitleText,
                  }}
                >
                  活动窗口
                </div>
                <div
                  className="h-[34px] mt-[1px] p-1 text-[7px]"
                  style={{
                    backgroundColor: previewScheme.windowBg,
                    color: previewScheme.windowText,
                  }}
                >
                  窗口文本
                </div>
              </div>
            </div>
          </div>
          <div className="w-[38px] h-[10px] bg-[#808080]" />
          <div className="w-[82px] h-[6px] bg-[#404040]" />
        </div>

        {tab === 'bg' && (
          <div className="flex flex-col gap-1.5 flex-1 min-h-0">
            <label className="text-[12px]">墙纸(W):</label>
            <div className="w2k-inset flex-1 overflow-y-auto w2k-scroll p-0.5 bg-white">
              {WIN2K_WALLPAPERS.map((wp) => (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => setDraftWallpaper(wp.id)}
                  className={`w-full text-left px-2 py-0.5 text-[12px] border-0 cursor-default block ${
                    draftWallpaper === wp.id
                      ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                      : 'bg-transparent text-black'
                  }`}
                >
                  {wp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'appearance' && (
          <div className="flex flex-col gap-2">
            <label htmlFor="scheme-select">方案(S):</label>
            <select
              id="scheme-select"
              value={draftScheme}
              onChange={(e) => setDraftScheme(e.target.value as ColorSchemeId)}
              className="w2k-select w-full"
            >
              {Object.values(WIN2K_COLOR_SCHEMES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-2.5 text-[12px]">
            <div>显示: 17" 彩色监视器</div>
            <fieldset className="w2k-fieldset">
              <legend>颜色(C)</legend>
              <div className="text-[12px]">真彩色 (32 位)</div>
            </fieldset>
            <fieldset className="w2k-fieldset">
              <legend>CRT 显示</legend>
              <Win2kCheckbox
                checked={draftCrt}
                onChange={setDraftCrt}
                label="启用 CRT 显示效果"
              />
            </fieldset>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="w2k-btn default-btn min-w-[72px]"
          onClick={() => {
            onApply(draftWallpaper, draftScheme, draftCrt);
            onClose();
          }}
        >
          确定
        </button>
        <button type="button" className="w2k-btn min-w-[72px]" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="w2k-btn min-w-[72px]"
          onClick={() => onApply(draftWallpaper, draftScheme, draftCrt)}
        >
          应用(A)
        </button>
      </div>
    </div>
  );
};

/* 2. System Properties (系统属性) */
export const SystemPropsApp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-3 gap-3">
    <div className="w2k-tab-panel flex-1 flex gap-4 items-start">
      <div className="pt-2 shrink-0 flex flex-col items-center gap-2">
        <Win2kIcon kind="my-computer" size={48} />
        <WinFlagIcon size={24} />
      </div>
      <div className="text-[12px] space-y-2.5">
        <div>
          <div className="font-bold">系统:</div>
          <div>Microsoft Windows 2000</div>
          <div>5.00.2195</div>
          <div>Service Pack 4</div>
        </div>
        <div>
          <div className="font-bold">注册到:</div>
          <div>Administrator</div>
          <div>千禧桌面工作站</div>
          <div className="tabular-nums text-[#404040]">51873-OEM-0011903-00102</div>
        </div>
        <div>
          <div className="font-bold">计算机:</div>
          <div>x86 Family 6 Model 8 Stepping 3</div>
          <div>AT/AT COMPATIBLE</div>
          <div className="tabular-nums">261,616 KB RAM</div>
        </div>
      </div>
    </div>
    <div className="flex justify-end">
      <button type="button" className="w2k-btn default-btn min-w-[74px]" onClick={onClose}>
        确定
      </button>
    </div>
  </div>
);

/* 3. Task Manager (任务管理器) */
interface TaskManagerAppProps {
  windows: WindowState[];
  onFocusWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onLaunchApp: (appId: AppId) => void;
}

export const TaskManagerApp: React.FC<TaskManagerAppProps> = ({
  windows,
  onFocusWindow,
  onCloseWindow,
  onLaunchApp,
}) => {
  const [selectedWinId, setSelectedWinId] = useState<string | null>(null);
  const [cpuSamples, setCpuSamples] = useState<number[]>([8, 12, 10, 15, 9, 14, 11, 7, 13, 10]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setCpuSamples((prev) => [
        ...prev.slice(1),
        Math.min(95, Math.max(4, Math.round(windows.length * 6 + Math.random() * 14))),
      ]);
    }, 1000);
    return () => window.clearInterval(t);
  }, [windows.length]);

  const latestCpu = cpuSamples[cpuSamples.length - 1] ?? 10;

  return (
    <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-2.5 gap-2.5 min-h-0">
      <div className="w2k-inset flex-1 bg-white overflow-y-auto w2k-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[var(--w2k-face)] text-left border-b border-[#808080]">
              <th className="py-1 px-2 font-normal border-r border-[#808080]">任务</th>
              <th className="py-1 px-2 font-normal w-[90px]">状态</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr
                key={w.id}
                onClick={() => setSelectedWinId(w.id)}
                className={`cursor-default ${
                  selectedWinId === w.id
                    ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                    : ''
                }`}
              >
                <td className="py-1 px-2 flex items-center gap-1.5">
                  <Win2kIcon kind={w.icon} size={16} />
                  <span className="truncate">{w.title}</span>
                </td>
                <td className="py-1 px-2">正在运行</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mini CPU Bar */}
      <div className="flex items-center gap-2 bg-black text-[#00FF00] p-1.5 font-mono text-[11px] border border-[#808080]">
        <span className="shrink-0">CPU 使用率: {latestCpu}%</span>
        <div className="flex items-end gap-[2px] h-[18px] flex-1">
          {cpuSamples.map((val, idx) => (
            <div
              key={idx}
              className="flex-1 bg-[#00FF00]"
              style={{ height: `${Math.max(15, val)}%` }}
            />
          ))}
        </div>
        <span className="shrink-0">进程: {windows.length + 14}</span>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="w2k-btn"
          disabled={!selectedWinId}
          onClick={() => selectedWinId && onCloseWindow(selectedWinId)}
        >
          结束任务(E)
        </button>
        <button
          type="button"
          className="w2k-btn"
          disabled={!selectedWinId}
          onClick={() => selectedWinId && onFocusWindow(selectedWinId)}
        >
          切换至(S)
        </button>
        <button type="button" className="w2k-btn" onClick={() => onLaunchApp('run')}>
          新任务(N)...
        </button>
      </div>
    </div>
  );
};

/* 4. Run Dialog (运行) */
interface RunDialogAppProps {
  onLaunchApp: (appId: AppId, payload?: WindowState['payload']) => void;
  onClose: () => void;
}

export const RunDialogApp: React.FC<RunDialogAppProps> = ({ onLaunchApp, onClose }) => {
  const [cmd, setCmd] = useState('notepad');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cmd.trim().toLowerCase().replace(/\.exe$/, '');
    const map: Record<string, { appId: AppId; payload?: WindowState['payload'] }> = {
      notepad: { appId: 'notepad' },
      calc: { appId: 'calculator' },
      winmine: { appId: 'minesweeper' },
      mspaint: { appId: 'paint' },
      cmd: { appId: 'cmd' },
      command: { appId: 'cmd' },
      iexplore: { appId: 'ie' },
      explorer: { appId: 'explorer' },
      control: { appId: 'explorer', payload: { path: 'control-panel' } },
      taskmgr: { appId: 'taskmgr' },
      winver: { appId: 'about' },
      royalhawaii: { appId: 'royal-hawaii' },
      palmbath: { appId: 'palm-bath' },
    };
    const match = map[clean];
    if (!match) {
      setErrorMsg(`Windows 找不到文件 '${cmd}'。可尝试 notepad、calc、royalhawaii、palmbath、cmd、winver。`);
      return;
    }
    onLaunchApp(match.appId, match.payload);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col bg-[var(--w2k-face)] p-3 gap-3">
      <div className="flex items-start gap-3">
        <Win2kIcon kind="run" size={32} className="shrink-0" />
        <div className="text-[12px] leading-relaxed">
          请输入程序、文件夹、文档或 Internet 资源的名称，Windows 将为您打开它。
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="run-input" className="shrink-0">
          打开(O):
        </label>
        <input
          id="run-input"
          type="text"
          autoFocus
          value={cmd}
          onChange={(e) => {
            setCmd(e.target.value);
            setErrorMsg('');
          }}
          className="w2k-input flex-1"
        />
      </div>

      {errorMsg && <div className="text-[11px] text-[#CC0000]">{errorMsg}</div>}

      <div className="flex justify-end gap-2 mt-auto">
        <button type="submit" className="w2k-btn default-btn min-w-[74px]">
          确定
        </button>
        <button type="button" className="w2k-btn min-w-[74px]" onClick={onClose}>
          取消
        </button>
      </div>
    </form>
  );
};

/* 5. Shut Down Windows Dialog (关闭 Windows) */
interface ShutdownDialogAppProps {
  initialAction?: 'shutdown' | 'restart' | 'logoff';
  onExecutePower: (nextState: SystemPowerState) => void;
  onClose: () => void;
}

export const ShutdownDialogApp: React.FC<ShutdownDialogAppProps> = ({
  initialAction = 'shutdown',
  onExecutePower,
  onClose,
}) => {
  const [action, setAction] = useState<'shutdown' | 'restart' | 'logoff'>(initialAction);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
    if (action === 'shutdown') {
      onExecutePower('shutting-down');
    } else if (action === 'restart') {
      onExecutePower('booting');
    } else {
      onExecutePower('saving-settings');
    }
  };

  return (
    <form onSubmit={handleConfirm} className="flex-1 flex flex-col bg-[var(--w2k-face)]">
      {/* Authentic Windows 2000 Banner (about256.bmp) + Sweeping Blue Ribbon */}
      <div className="bg-white border-b border-[#808080] flex flex-col">
        <img
          src="/win2k-ui/about-banner.png"
          alt="Microsoft Windows 2000"
          draggable={false}
          className="w-full h-auto block"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="w2k-ribbon-sweep" />
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <img
            src="/win2k-ui/gina-shutdown.png"
            alt=""
            draggable={false}
            className="w-[32px] h-[32px] shrink-0"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="flex-1 space-y-2">
            <label htmlFor="shutdown-select" className="block">
              希望计算机做什么？
            </label>
            <select
              id="shutdown-select"
              value={action}
              onChange={(e) => setAction(e.target.value as 'shutdown' | 'restart' | 'logoff')}
              className="w2k-select w-full"
            >
              <option value="shutdown">关机</option>
              <option value="restart">重新启动</option>
              <option value="logoff">注销 Administrator</option>
            </select>
            <div className="text-[11px] text-[#404040] pt-1">
              {action === 'shutdown'
                ? '结束您的会话并关闭 Windows，以便安全关闭电源。'
                : action === 'restart'
                ? '结束您的会话，关闭 Windows，然后重新启动 Windows。'
                : '结束您的会话，保持计算机运行以便其他用户登录。'}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-auto">
          <button type="submit" className="w2k-btn default-btn min-w-[74px]">
            确定
          </button>
          <button type="button" className="w2k-btn min-w-[74px]" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </form>
  );
};

/* 6. About Windows 2000 & Help */
export const AboutWinApp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex-1 flex flex-col bg-[var(--w2k-face)]">
    <div className="bg-white border-b border-[#808080] flex flex-col">
      <img
        src="/win2k-ui/about-banner.png"
        alt="Microsoft Windows 2000"
        draggable={false}
        className="w-full h-auto block"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="w2k-ribbon-sweep" />
    </div>
    <div className="p-4 text-[12px] space-y-2.5 flex-1">
      <div>Microsoft(R) Windows 2000 Professional</div>
      <div>版本 5.0 (内部版本号 2195: Service Pack 4)</div>
      <div>版权所有 (C) 1981-1999 Microsoft Corp.</div>
      <div className="border-t border-[#808080] pt-2 text-[11px] text-[#404040]">
        此产品使用权授予: Administrator / 千禧工作站
      </div>
    </div>
    <div className="px-4 pb-3 flex justify-end">
      <button type="button" className="w2k-btn default-btn min-w-[74px]" onClick={onClose}>
        确定
      </button>
    </div>
  </div>
);

export const HelpApp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex-1 flex flex-col bg-[var(--w2k-face)] p-3 gap-3">
    <div className="w2k-inset bg-white p-3 flex-1 overflow-y-auto w2k-scroll text-[12px] space-y-2">
      <div className="text-[14px] font-bold text-[#0A246A]">
        Windows 2000 Professional 简体中文桌面指南
      </div>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>桌面与窗口：</strong>双击桌面图标打开程序；拖动标题栏移动窗口，拖动右下角调整大小。
        </li>
        <li>
          <strong>虚拟文件系统：</strong>在“我的电脑”、“我的文档”或“记事本”中新建、编辑或删除的文件，会实时同步至“回收站”与“命令提示符”。
        </li>
        <li>
          <strong>命令提示符：</strong>支持 <code>help</code>、<code>dir</code>、<code>cd</code>、
          <code>type</code>、<code>mkdir</code>、<code>ver</code>、<code>ipconfig</code> 等命令。
        </li>
        <li>
          <strong>个性化外观：</strong>右键桌面空白处选择“属性”，可以切换经典壁纸与系统配色方案。
        </li>
      </ul>
    </div>
    <div className="flex justify-end">
      <button type="button" className="w2k-btn default-btn min-w-[74px]" onClick={onClose}>
        关闭
      </button>
    </div>
  </div>
);
