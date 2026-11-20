import React, { useEffect, useState } from 'react';
import type { SystemPowerState } from '../../types/os';
import { transitionPowerState } from '../../core/systemState';

interface BootAndShutdownScreenProps {
  powerState: SystemPowerState;
  onChangePowerState: (next: SystemPowerState) => void;
}

export const BootAndShutdownScreen: React.FC<BootAndShutdownScreenProps> = ({
  powerState,
  onChangePowerState,
}) => {
  const [progress, setProgress] = useState(0);
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('WORKSTATION (本机)');
  const [showOptions, setShowOptions] = useState(false);

  // Boot progress ticker (never triggers parent setState inside state updater)
  useEffect(() => {
    if (powerState !== 'booting') return;
    setProgress(0);
    const interval = window.setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : Math.min(100, prev + 10)));
    }, 150);
    return () => window.clearInterval(interval);
  }, [powerState]);

  // Transition booting -> sas-prompt cleanly when progress completes
  useEffect(() => {
    if (powerState !== 'booting' || progress < 100) return;
    const t = window.setTimeout(() => {
      onChangePowerState(transitionPowerState('booting', 'boot-complete'));
    }, 240);
    return () => window.clearTimeout(t);
  }, [powerState, progress, onChangePowerState]);

  // Keyboard listener for Ctrl+Alt+Delete on SAS prompt
  useEffect(() => {
    if (powerState !== 'sas-prompt') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onChangePowerState(transitionPowerState('sas-prompt', 'press-cad'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [powerState, onChangePowerState]);

  // Automatic timed transitions for loading-settings, saving-settings, and shutting-down
  useEffect(() => {
    if (powerState === 'loading-settings') {
      const t = window.setTimeout(
        () => onChangePowerState(transitionPowerState('loading-settings', 'settings-loaded')),
        1100
      );
      return () => window.clearTimeout(t);
    }
    if (powerState === 'saving-settings') {
      const t = window.setTimeout(
        () => onChangePowerState(transitionPowerState('saving-settings', 'settings-saved')),
        1100
      );
      return () => window.clearTimeout(t);
    }
    if (powerState === 'shutting-down') {
      const t = window.setTimeout(
        () => onChangePowerState(transitionPowerState('shutting-down', 'shutdown-complete')),
        1300
      );
      return () => window.clearTimeout(t);
    }
  }, [powerState, onChangePowerState]);

  if (powerState === 'running') return null;

  /* 1. Classic Windows 2000 Professional Boot Splash (ntoskrnl style) */
  if (powerState === 'booting') {
    return (
      <div className="absolute inset-0 z-[10000] bg-white flex flex-col items-center justify-between py-10 select-none">
        <div className="text-[11px] text-[#606060]">
          Microsoft® Windows® 2000 Professional
        </div>

        {/* Center Boot Splash Graphic */}
        <div className="w-[468px] max-w-[92vw] flex flex-col items-center">
          <div className="w-full border border-[#808080] bg-white shadow-sm overflow-hidden">
            {/* Top billboard panel using authentic w2kbb.png crop & Win2K branding */}
            <div className="relative h-[228px] bg-[#E8EFF8] overflow-hidden flex items-center justify-between px-7 border-b border-[#0A246A]">
              <img
                src="/win2k-ui/w2kbb.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="relative z-10 space-y-1">
                <div className="text-[13px] text-[#0A246A] font-bold">
                  Microsoft®
                </div>
                <div className="text-[34px] font-bold text-black leading-none tracking-tight">
                  Windows <span className="text-[#0A246A]">2000</span>
                </div>
                <div className="text-[16px] text-[#303030] font-bold">
                  Professional
                </div>
                <div className="text-[11px] text-[#505050] pt-4">
                  基于 NT 技术构建 · Build 2195
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-end gap-2">
                <img
                  src="/icons/48/my-computer.png"
                  alt=""
                  className="w-[48px] h-[48px]"
                  style={{ imageRendering: 'pixelated' }}
                />
                <img
                  src="/icons/ui/win-flag-32.png"
                  alt=""
                  className="w-[32px] h-[32px]"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            {/* Animated Blue Sweep Ribbon + Progress Strip */}
            <div className="relative h-[12px] bg-[#0A246A] overflow-hidden">
              <div className="w2k-boot-pulse-block" />
            </div>

            <div className="bg-white px-6 py-4 flex flex-col items-center gap-2">
              <div className="text-[12px] text-black">正在启动 Windows...</div>
              <div className="w2k-inset w-full h-[18px] p-[2px] flex items-center gap-[2px] bg-white">
                {Array.from({ length: 24 }).map((_, idx) => {
                  const filled = (idx + 1) * (100 / 24) <= progress;
                  return (
                    <div
                      key={idx}
                      className="h-full flex-1"
                      style={{ backgroundColor: filled ? '#0A246A' : 'transparent' }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[#808080]">
          版权所有 (C) 1981-1999 Microsoft Corporation. 保留所有权利。
        </div>
      </div>
    );
  }

  /* 2. Authentic Secure Attention Sequence (Press Ctrl+Alt+Del to log on) */
  if (powerState === 'sas-prompt') {
    return (
      <div className="absolute inset-0 z-[10000] bg-[#3A6EA5] flex items-center justify-center select-none">
        <div className="w2k-window-frame w-[420px] max-w-[94vw]">
          <div className="w2k-titlebar">
            <span>欢迎使用 Windows</span>
          </div>
          <div className="bg-white border-b border-[#808080]">
            <img
              src="/win2k-ui/about-banner.png"
              alt="Microsoft Windows 2000"
              draggable={false}
              className="w-full h-auto block"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="w2k-ribbon-sweep" />
          </div>
          <div className="p-4 bg-[var(--w2k-face)] flex items-start gap-4">
            <img
              src="/win2k-ui/sas-bmp.png"
              alt="Ctrl+Alt+Del"
              draggable={false}
              className="w-[36px] h-[33px] shrink-0 mt-1"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="flex-1 space-y-3 text-[12px] text-black">
              <div className="font-bold">按 Ctrl+Alt+Del 开始。</div>
              <div className="text-[#404040] leading-relaxed">
                因为浏览器会拦截系统级 Ctrl+Alt+Delete 组合键，您可以直接点击下方按钮进入登录界面。
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  className="w2k-btn default-btn"
                  onClick={() =>
                    onChangePowerState(transitionPowerState('sas-prompt', 'press-cad'))
                  }
                >
                  模拟按 Ctrl+Alt+Del(C)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* 3. Authentic Windows 2000 Logon Dialog (msgina.dll) */
  if (powerState === 'logon') {
    return (
      <div className="absolute inset-0 z-[10000] bg-[#3A6EA5] flex items-center justify-center select-none">
        <div className="w2k-window-frame w-[416px] max-w-[94vw]">
          <div className="w2k-titlebar">
            <span>登录到 Windows</span>
          </div>
          <div className="bg-white border-b border-[#808080]">
            <img
              src="/win2k-ui/about-banner.png"
              alt="Microsoft Windows 2000"
              draggable={false}
              className="w-full h-auto block"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="w2k-ribbon-sweep" />
          </div>
          <form
            className="p-4 flex flex-col gap-3 bg-[var(--w2k-face)]"
            onSubmit={(e) => {
              e.preventDefault();
              onChangePowerState(transitionPowerState('logon', 'submit-login'));
            }}
          >
            <div className="flex items-start gap-3">
              <img
                src="/win2k-ui/gina-logoff.png"
                alt=""
                draggable={false}
                className="w-[36px] h-[36px] shrink-0"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <label htmlFor="logon-user" className="w-[68px] text-right shrink-0">
                    用户名(U):
                  </label>
                  <input
                    id="logon-user"
                    type="text"
                    readOnly
                    value="Administrator"
                    className="w2k-input flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="logon-pass" className="w-[68px] text-right shrink-0">
                    密码(P):
                  </label>
                  <input
                    id="logon-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="留空直接按确定登录"
                    className="w2k-input flex-1"
                  />
                </div>
                {showOptions && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="logon-domain" className="w-[68px] text-right shrink-0">
                      登录到(L):
                    </label>
                    <select
                      id="logon-domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w2k-select flex-1"
                    >
                      <option value="WORKSTATION (本机)">WORKSTATION (本机)</option>
                      <option value="WORKGROUP">WORKGROUP</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button type="submit" className="w2k-btn default-btn min-w-[74px]">
                确定
              </button>
              <button
                type="button"
                className="w2k-btn min-w-[74px]"
                onClick={() => onChangePowerState('sas-prompt')}
              >
                取消
              </button>
              <button
                type="button"
                className="w2k-btn min-w-[74px]"
                onClick={() => onChangePowerState('shutting-down')}
              >
                关机(S)...
              </button>
              <button
                type="button"
                className="w2k-btn min-w-[74px]"
                onClick={() => setShowOptions((o) => !o)}
              >
                {showOptions ? '<< 选项(O)' : '选项(O) >>'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* 4. Loading / Saving Personal Settings & Shutting Down Dialogs */
  if (
    powerState === 'loading-settings' ||
    powerState === 'saving-settings' ||
    powerState === 'shutting-down'
  ) {
    const title =
      powerState === 'loading-settings'
        ? '正在加载个人设置...'
        : powerState === 'saving-settings'
        ? '正在保存您的设置...'
        : 'Windows 正在关机...';
    const iconSrc =
      powerState === 'shutting-down'
        ? '/win2k-ui/gina-shutdown.png'
        : '/win2k-ui/unlock-bmp.png';

    return (
      <div className="absolute inset-0 z-[10000] bg-[#3A6EA5] flex items-center justify-center select-none">
        <div className="w2k-window-frame w-[410px] max-w-[94vw]">
          <div className="w2k-titlebar">
            <span>Windows 2000</span>
          </div>
          <div className="bg-white border-b border-[#808080]">
            <img
              src="/win2k-ui/about-banner.png"
              alt="Microsoft Windows 2000"
              draggable={false}
              className="w-full h-auto block"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="w2k-ribbon-sweep" />
          </div>
          <div className="p-5 flex items-center gap-4 bg-[var(--w2k-face)]">
            <img
              src={iconSrc}
              alt=""
              draggable={false}
              className="w-[42px] h-auto shrink-0"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="space-y-1">
              <div className="font-bold text-[12px] text-black">{title}</div>
              <div className="text-[11px] text-[#404040]">请稍候...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* 5. Halted: Classic Windows 2000 Orange-on-Black Safe Shutdown Screen */
  return (
    <div className="absolute inset-0 z-[10000] bg-black flex flex-col items-center justify-center gap-6 select-none">
      <div className="text-[#FF8C00] text-[22px] font-bold tracking-wide text-center px-4">
        现在可以安全地关闭计算机了。
      </div>
      <button
        type="button"
        className="w2k-btn px-6 py-1.5"
        onClick={() => onChangePowerState(transitionPowerState('halted', 'power-on'))}
      >
        重新启动计算机
      </button>
    </div>
  );
};
