import React, { useEffect, useRef, useState } from 'react';
import type { AppId, VfsNode, WindowState } from '../../types/os';
import { executeCmdCommand } from '../../core/cmd';
import { getDisplayPath } from '../../core/vfs';

interface CommandPromptAppProps {
  vfs: Record<string, VfsNode>;
  setVfs: React.Dispatch<React.SetStateAction<Record<string, VfsNode>>>;
  onLaunchApp: (appId: AppId, payload?: WindowState['payload']) => void;
  onClose: () => void;
}

export const CommandPromptApp: React.FC<CommandPromptAppProps> = ({
  vfs,
  setVfs,
  onLaunchApp,
  onClose,
}) => {
  const [cwdId, setCwdId] = useState('c-admin');
  const [lines, setLines] = useState<string[]>([
    'Microsoft Windows 2000 [Version 5.00.2195]',
    '(C) 版权所有 1985-2000 Microsoft Corp.',
    '',
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histCursor, setHistCursor] = useState(-1);
  const [rasterSize, setRasterSize] = useState<'16' | '12'>('16');
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  useEffect(() => {
    if (!ctxPos) return;
    const hide = () => setCtxPos(null);
    window.addEventListener('click', hide);
    return () => window.removeEventListener('click', hide);
  }, [ctxPos]);

  const promptPath = getDisplayPath(vfs, cwdId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmdLine = input;
    const result = executeCmdCommand(cmdLine, cwdId, vfs);

    if (result.exit) {
      onClose();
      return;
    }

    if (result.nextVfs !== vfs) {
      setVfs(result.nextVfs);
    }
    setCwdId(result.nextCwdId);

    if (result.launchApp) {
      const map: Record<string, AppId> = {
        notepad: 'notepad',
        calc: 'calculator',
        winmine: 'minesweeper',
        mspaint: 'paint',
        explorer: 'explorer',
        taskmgr: 'taskmgr',
        control: 'explorer',
      };
      const target = map[result.launchApp];
      if (target) {
        onLaunchApp(
          target,
          result.launchApp === 'control' ? { path: 'control-panel' } : undefined
        );
      }
    }

    if (result.clearScreen) {
      setLines([]);
    } else {
      setLines((prev) => [...prev, `${promptPath}>${cmdLine}`, ...result.output]);
    }

    if (cmdLine.trim()) {
      setHistory((prev) => [cmdLine, ...prev]);
    }
    setHistCursor(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(history.length - 1, histCursor + 1);
      if (history[next] !== undefined) {
        setHistCursor(next);
        setInput(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histCursor - 1;
      if (next < 0) {
        setHistCursor(-1);
        setInput('');
      } else {
        setHistCursor(next);
        setInput(history[next]);
      }
    }
  };

  const textSizeCls = rasterSize === '16' ? 'text-[16px] leading-[18px]' : 'text-[12px] leading-[15px]';

  return (
    <div
      className={`relative flex-1 bg-black text-[#C0C0C0] px-1.5 py-1 overflow-y-auto w2k-scroll w2k-cmd-font ${textSizeCls} cursor-text`}
      onClick={() => inputRef.current?.focus()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
      }}
    >
      <div className="whitespace-pre-wrap break-words select-text">
        {lines.map((line, i) => (
          <div key={i} className={rasterSize === '16' ? 'min-h-[18px]' : 'min-h-[15px]'}>
            {line}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center">
        <span className="shrink-0">{promptPath}&gt;</span>
        <input
          ref={inputRef}
          type="text"
          aria-label="命令行输入"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`flex-1 bg-transparent text-[#C0C0C0] border-0 outline-none w2k-cmd-font ${textSizeCls} p-0 m-0 caret-white`}
        />
      </form>
      <div ref={bottomRef} />

      {/* Classic CMD Right-click Context Menu for Raster Size & Quick Actions */}
      {ctxPos && (
        <div
          className="w2k-menu-popup absolute z-30 min-w-[160px]"
          style={{ left: Math.min(ctxPos.x, 340), top: Math.min(ctxPos.y, 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w2k-menu-item"
            onClick={() => {
              setRasterSize('16');
              setCtxPos(null);
            }}
          >
            {rasterSize === '16' && <span className="absolute left-1.5">✓</span>}
            <span>点阵字体 8×16 (默认)</span>
          </button>
          <button
            type="button"
            className="w2k-menu-item"
            onClick={() => {
              setRasterSize('12');
              setCtxPos(null);
            }}
          >
            {rasterSize === '12' && <span className="absolute left-1.5">✓</span>}
            <span>点阵字体 6×12 (紧凑)</span>
          </button>
          <div className="w2k-menu-sep" />
          <button
            type="button"
            className="w2k-menu-item"
            onClick={() => {
              setLines([]);
              setCtxPos(null);
            }}
          >
            清除屏幕 (cls)
          </button>
        </div>
      )}
    </div>
  );
};
