/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppId,
  ColorSchemeId,
  ContextMenuState,
  DesktopIconSort,
  ImeId,
  NetworkConnectionState,
  SystemPowerState,
  VfsNode,
  WallpaperId,
  WindowState,
} from './types/os';
import {
  DESKTOP_FOLDER_ID,
  MY_DOCS_ID,
  NETWORK_ID,
  RECYCLE_BIN_ID,
  ROOT_ID,
  createInitialVfs,
  createNode,
  deleteToRecycleBin,
  emptyRecycleBin,
  listChildren,
} from './core/vfs';
import { tickNetworkStats } from './core/systemState';
import { WIN2K_COLOR_SCHEMES, getWallpaperStyle } from './core/themes';
import { DesktopIconGrid, DesktopShortcut } from './components/os/DesktopIconGrid';
import { Taskbar } from './components/os/Taskbar';
import { StartMenu } from './components/os/StartMenu';
import { WindowFrame } from './components/os/WindowFrame';
import { ContextMenu } from './components/os/ContextMenu';
import { BootAndShutdownScreen } from './components/os/BootAndShutdownScreen';
import { ExplorerApp } from './components/apps/ExplorerApp';
import { NotepadApp } from './components/apps/NotepadApp';
import { MinesweeperApp } from './components/apps/MinesweeperApp';
import { CalculatorApp } from './components/apps/CalculatorApp';
import { PaintApp } from './components/apps/PaintApp';
import { CommandPromptApp } from './components/apps/CommandPromptApp';
import { InternetExplorerApp } from './components/apps/InternetExplorerApp';
import {
  AboutWinApp,
  DisplayPropsApp,
  HelpApp,
  RunDialogApp,
  ShutdownDialogApp,
  SystemPropsApp,
  TaskManagerApp,
} from './components/apps/SystemDialogsApp';
import {
  DateTimePropsApp,
  LocalAreaStatusApp,
  SndVolApp,
} from './components/apps/TrayDialogsApp';
import { RoyalHawaiiApp } from './components/apps/RoyalHawaiiApp';
import { PalmBathApp } from './components/apps/PalmBathApp';
import { ImagingApp } from './components/apps/ImagingApp';
import { MediaPlayerApp } from './components/apps/MediaPlayerApp';
import { CrtGlassOverlay, CrtOpticsSvgDefs } from './components/os/CrtOpticsOverlay';
import { WinFlagIcon } from './components/icons/Win2kIcons';

interface AppBlueprint {
  title: string;
  icon: WindowState['icon'];
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  resizable: boolean;
  maximizable: boolean;
  minimizable: boolean;
  singleton?: boolean;
}

const APP_BLUEPRINTS: Record<AppId, AppBlueprint> = {
  explorer: {
    title: '我的电脑',
    icon: 'my-computer',
    width: 740,
    height: 490,
    minWidth: 380,
    minHeight: 280,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  notepad: {
    title: '无标题 - 记事本',
    icon: 'notepad',
    width: 520,
    height: 360,
    minWidth: 280,
    minHeight: 200,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  minesweeper: {
    title: '扫雷',
    icon: 'minesweeper',
    width: 240,
    height: 310,
    minWidth: 220,
    minHeight: 280,
    resizable: false,
    maximizable: false,
    minimizable: true,
  },
  calculator: {
    title: '计算器',
    icon: 'calculator',
    width: 268,
    height: 256,
    minWidth: 260,
    minHeight: 250,
    resizable: false,
    maximizable: false,
    minimizable: true,
  },
  paint: {
    title: '未命名 - 画图',
    icon: 'paint',
    width: 560,
    height: 390,
    minWidth: 400,
    minHeight: 300,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  cmd: {
    title: 'C:\\WINNT\\system32\\cmd.exe',
    icon: 'cmd',
    width: 580,
    height: 360,
    minWidth: 340,
    minHeight: 220,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  ie: {
    title: 'MSN China - Microsoft Internet Explorer',
    icon: 'ie',
    width: 780,
    height: 520,
    minWidth: 440,
    minHeight: 320,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  display: {
    title: '显示 属性',
    icon: 'display',
    width: 404,
    height: 452,
    minWidth: 380,
    minHeight: 420,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  system: {
    title: '系统属性',
    icon: 'system',
    width: 396,
    height: 332,
    minWidth: 360,
    minHeight: 300,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  taskmgr: {
    title: 'Windows 任务管理器',
    icon: 'taskmgr',
    width: 420,
    height: 360,
    minWidth: 320,
    minHeight: 260,
    resizable: true,
    maximizable: true,
    minimizable: true,
    singleton: true,
  },
  run: {
    title: '运行',
    icon: 'run',
    width: 360,
    height: 186,
    minWidth: 320,
    minHeight: 170,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  shutdown: {
    title: '关闭 Windows',
    icon: 'shutdown',
    width: 380,
    height: 248,
    minWidth: 350,
    minHeight: 230,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  about: {
    title: '关于 Windows',
    icon: 'system',
    width: 400,
    height: 256,
    minWidth: 360,
    minHeight: 240,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  help: {
    title: 'Windows 2000 帮助',
    icon: 'help',
    width: 460,
    height: 340,
    minWidth: 320,
    minHeight: 240,
    resizable: true,
    maximizable: true,
    minimizable: true,
    singleton: true,
  },
  sndvol: {
    title: '音量控制',
    icon: 'system',
    width: 432,
    height: 318,
    minWidth: 380,
    minHeight: 290,
    resizable: false,
    maximizable: false,
    minimizable: true,
    singleton: true,
  },
  timedate: {
    title: '日期和时间 属性',
    icon: 'timedate',
    width: 428,
    height: 396,
    minWidth: 390,
    minHeight: 360,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  netstatus: {
    title: '本地连接 状态',
    icon: 'network',
    width: 368,
    height: 368,
    minWidth: 330,
    minHeight: 340,
    resizable: false,
    maximizable: false,
    minimizable: false,
    singleton: true,
  },
  'royal-hawaii': {
    title: 'Royal Hawaii',
    icon: 'royal-hawaii',
    width: 680,
    height: 496,
    minWidth: 480,
    minHeight: 360,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  'palm-bath': {
    title: '棕榈浴场',
    icon: 'palm-bath',
    width: 660,
    height: 486,
    minWidth: 460,
    minHeight: 350,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  imaging: {
    title: '图像处理',
    icon: 'imaging',
    width: 720,
    height: 520,
    minWidth: 460,
    minHeight: 340,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  mplayer: {
    title: 'Windows Media Player',
    icon: 'mplayer',
    width: 460,
    height: 410,
    minWidth: 340,
    minHeight: 350,
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
};

export default function App() {
  const [vfs, setVfs] = useState<Record<string, VfsNode>>(() => createInitialVfs());
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperId>('tiki-island');
  const [colorSchemeId, setColorSchemeId] = useState<ColorSchemeId>('win2k-standard');
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);
  const [showDesktopIcons, setShowDesktopIcons] = useState<boolean>(true);
  const [showWebContent, setShowWebContent] = useState<boolean>(true);
  const [iconSort, setIconSort] = useState<DesktopIconSort | null>(null);
  const [autoArrange, setAutoArrange] = useState<boolean>(true);
  const [alignToGrid, setAlignToGrid] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(75);
  const [muted, setMuted] = useState<boolean>(false);
  const [imeId, setImeId] = useState<ImeId>('quanpin');
  const [network, setNetwork] = useState<NetworkConnectionState>({
    enabled: true,
    speedMbps: '100.0 Mbps',
    durationSeconds: 2712,
    packetsSent: 12450,
    packetsReceived: 18920,
    activityTick: 0,
  });
  const [powerState, setPowerState] = useState<SystemPowerState>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('boot') === '1' ? 'booting' : 'running';
  });

  const screenRef = useRef<HTMLDivElement>(null);
  const zCounterRef = useRef(100);
  const cascadeOffsetRef = useRef(0);
  const windowsRef = useRef<WindowState[]>(windows);
  windowsRef.current = windows;

  const activeScheme = WIN2K_COLOR_SCHEMES[colorSchemeId];

  const getScreenMetrics = useCallback(() => {
    const rect = screenRef.current?.getBoundingClientRect();
    return {
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
      width: rect?.width ?? window.innerWidth,
      height: rect?.height ?? window.innerHeight,
    };
  }, []);

  // Live 1s Local Area Connection duration & packet ticker
  useEffect(() => {
    if (powerState !== 'running') return;
    const t = window.setInterval(() => {
      setNetwork((prev) => tickNetworkStats(prev));
    }, 1000);
    return () => window.clearInterval(t);
  }, [powerState]);

  const focusWindow = useCallback((id: string) => {
    zCounterRef.current += 1;
    const nextZ = zCounterRef.current;
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: false, zIndex: nextZ } : w))
    );
    setActiveWindowId(id);
  }, []);

  const launchApp = useCallback(
    (appId: AppId, payload?: WindowState['payload']) => {
      setStartMenuOpen(false);
      setContextMenu(null);

      const bp = APP_BLUEPRINTS[appId];
      if (bp.singleton) {
        const existing = windows.find((w) => w.appId === appId);
        if (existing) {
          focusWindow(existing.id);
          return;
        }
      }

      zCounterRef.current += 1;
      const step = cascadeOffsetRef.current;
      cascadeOffsetRef.current += 1;

      const { width: screenW, height: screenH } = getScreenMetrics();
      const maxW = Math.max(300, screenW - 24);
      const maxH = Math.max(240, screenH - 52);
      const width = Math.min(bp.width, maxW);
      const height = Math.min(bp.height, maxH);

      const isCenteredDialog =
        appId === 'display' ||
        appId === 'system' ||
        appId === 'run' ||
        appId === 'shutdown' ||
        appId === 'about' ||
        appId === 'timedate' ||
        appId === 'netstatus' ||
        appId === 'sndvol';

      const slotX = 104 + (step % 4) * 140;
      const slotY = 28 + (step % 5) * 42;
      const x = isCenteredDialog
        ? Math.max(12, Math.round((screenW - width) / 2))
        : Math.min(Math.max(16, slotX), Math.max(16, screenW - width - 16));
      const y = isCenteredDialog
        ? Math.max(12, Math.round((screenH - 28 - height) / 2))
        : Math.min(Math.max(16, slotY), Math.max(16, screenH - height - 40));

      let title = bp.title;
      let icon = bp.icon;
      if (appId === 'explorer' && payload?.path && vfs[payload.path]) {
        title = vfs[payload.path].name;
        icon = vfs[payload.path].icon ?? 'folder';
      } else if (appId === 'notepad' && payload?.fileName) {
        title = `${payload.fileName} - 记事本`;
      } else if (appId === 'imaging' && payload?.fileName) {
        title = `${payload.fileName} - 图像处理`;
      } else if (appId === 'mplayer' && payload?.fileName) {
        title = `${payload.fileName} - Windows Media Player`;
      }

      const id = `win-${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newWin: WindowState = {
        id,
        appId,
        title,
        icon,
        x,
        y,
        width,
        height,
        minWidth: bp.minWidth,
        minHeight: bp.minHeight,
        isMinimized: false,
        isMaximized: false,
        zIndex: zCounterRef.current,
        resizable: bp.resizable,
        maximizable: bp.maximizable,
        minimizable: bp.minimizable,
        payload,
      };

      setWindows((prev) => [...prev, newWin]);
      setActiveWindowId(id);
    },
    [focusWindow, getScreenMetrics, vfs, windows]
  );

  // Global keyboard shortcuts (Escape, Ctrl+Shift+Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStartMenuOpen(false);
        setContextMenu(null);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        launchApp('taskmgr');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [launchApp]);

  const closeWindow = useCallback((id: string) => {
    const remaining = windowsRef.current.filter((w) => w.id !== id);
    setWindows(remaining);
    setActiveWindowId((currActive) => {
      if (currActive !== id) return currActive;
      const visible = remaining.filter((w) => !w.isMinimized);
      if (visible.length === 0) return null;
      return [...visible].sort((a, b) => b.zIndex - a.zIndex)[0].id;
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)));
    setActiveWindowId((curr) => (curr === id ? null : curr));
  }, []);

  const toggleMaximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, width, height } : w)));
  }, []);

  const updateWindowMeta = useCallback(
    (id: string, title: string, icon?: WindowState['icon']) => {
      setWindows((prev) => {
        const target = prev.find((w) => w.id === id);
        if (!target) return prev;
        const nextIcon = icon ?? target.icon;
        if (target.title === title && target.icon === nextIcon) return prev;
        return prev.map((w) => (w.id === id ? { ...w, title, icon: nextIcon } : w));
      });
    },
    []
  );

  const handleTaskbarSelect = useCallback(
    (id: string) => {
      const target = windows.find((w) => w.id === id);
      if (!target) return;
      if (target.id === activeWindowId && !target.isMinimized) {
        minimizeWindow(id);
      } else {
        focusWindow(id);
      }
    },
    [activeWindowId, focusWindow, minimizeWindow, windows]
  );

  const handleShowDesktop = useCallback(() => {
    const anyVisible = windows.some((w) => !w.isMinimized);
    if (anyVisible) {
      setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
      setActiveWindowId(null);
    } else {
      setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: false })));
      const top = [...windows].sort((a, b) => b.zIndex - a.zIndex)[0];
      if (top) setActiveWindowId(top.id);
    }
  }, [windows]);

  const handleCascadeWindows = useCallback(() => {
    const { width: screenW, height: screenH } = getScreenMetrics();
    const areaH = Math.max(240, screenH - 28);
    setWindows((prev) => {
      const visibleIds = prev.filter((w) => !w.isMinimized).map((w) => w.id);
      let idx = 0;
      return prev.map((w) => {
        if (!visibleIds.includes(w.id)) return w;
        const offset = (idx % 6) * 26;
        idx += 1;
        zCounterRef.current += 1;
        return {
          ...w,
          isMaximized: false,
          x: Math.min(24 + offset, Math.max(0, screenW - w.width - 12)),
          y: Math.min(24 + offset, Math.max(0, areaH - w.height - 12)),
          zIndex: zCounterRef.current,
        };
      });
    });
  }, [getScreenMetrics]);

  const handleTileWindowsHorizontal = useCallback(() => {
    const { width: screenW, height: screenH } = getScreenMetrics();
    const areaH = Math.max(220, screenH - 28);
    setWindows((prev) => {
      const visible = prev.filter((w) => !w.isMinimized);
      if (visible.length === 0) return prev;
      const sliceH = Math.max(160, Math.floor(areaH / visible.length));
      let idx = 0;
      return prev.map((w) => {
        if (w.isMinimized) return w;
        const y = idx * sliceH;
        const h = idx === visible.length - 1 ? areaH - y : sliceH;
        idx += 1;
        return {
          ...w,
          isMaximized: false,
          x: 0,
          y,
          width: Math.max(w.minWidth, screenW),
          height: Math.max(w.minHeight, h),
        };
      });
    });
  }, [getScreenMetrics]);

  const handleTileWindowsVertical = useCallback(() => {
    const { width: screenW, height: screenH } = getScreenMetrics();
    const areaH = Math.max(220, screenH - 28);
    setWindows((prev) => {
      const visible = prev.filter((w) => !w.isMinimized);
      if (visible.length === 0) return prev;
      const sliceW = Math.max(220, Math.floor(screenW / visible.length));
      let idx = 0;
      return prev.map((w) => {
        if (w.isMinimized) return w;
        const x = idx * sliceW;
        const width = idx === visible.length - 1 ? screenW - x : sliceW;
        idx += 1;
        return {
          ...w,
          isMaximized: false,
          x,
          y: 0,
          width: Math.max(w.minWidth, width),
          height: Math.max(w.minHeight, areaH),
        };
      });
    });
  }, [getScreenMetrics]);

  const toScreenPoint = (clientX: number, clientY: number) => {
    const { left, top } = getScreenMetrics();
    return {
      x: Math.round(clientX - left),
      y: Math.round(clientY - top),
    };
  };

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setStartMenuOpen(false);
    setSelectedIconId(null);
    const pt = toScreenPoint(e.clientX, e.clientY);
    setContextMenu({
      x: pt.x,
      y: pt.y,
      items: [
        {
          id: 'ctx-active-desktop',
          label: 'Active Desktop(D)',
          submenu: [
            {
              id: 'ctx-ad-web',
              label: '显示 Web 内容(W)',
              checked: showWebContent,
              action: () => setShowWebContent((v) => !v),
            },
            {
              id: 'ctx-ad-icons',
              label: '在桌面上显示桌面图标(D)',
              checked: showDesktopIcons,
              action: () => setShowDesktopIcons((v) => !v),
            },
            {
              id: 'ctx-ad-custom',
              label: '自定义我的桌面(C)...',
              action: () => launchApp('display'),
            },
            { id: 'ctx-ad-sep', label: '', separator: true },
            {
              id: 'ctx-ad-sync',
              label: '同步(S)',
              action: () => setSelectedIconId(null),
            },
          ],
        },
        { id: 'ctx-sep-0', label: '', separator: true },
        {
          id: 'ctx-arrange',
          label: '排列图标(I)',
          submenu: [
            {
              id: 'ctx-sort-name',
              label: '按名称(N)',
              checked: iconSort === 'name',
              radio: true,
              action: () => setIconSort('name'),
            },
            {
              id: 'ctx-sort-type',
              label: '按类型(T)',
              checked: iconSort === 'type',
              radio: true,
              action: () => setIconSort('type'),
            },
            {
              id: 'ctx-sort-size',
              label: '按大小(S)',
              checked: iconSort === 'size',
              radio: true,
              action: () => setIconSort('size'),
            },
            {
              id: 'ctx-sort-date',
              label: '按日期(D)',
              checked: iconSort === 'date',
              radio: true,
              action: () => setIconSort('date'),
            },
            { id: 'ctx-sort-sep', label: '', separator: true },
            {
              id: 'ctx-auto-arrange',
              label: '自动排列(A)',
              checked: autoArrange,
              action: () => setAutoArrange((v) => !v),
            },
          ],
        },
        {
          id: 'ctx-align-grid',
          label: '按网格对齐(G)',
          checked: alignToGrid,
          action: () => setAlignToGrid((v) => !v),
        },
        { id: 'ctx-sep-1', label: '', separator: true },
        {
          id: 'ctx-refresh',
          label: '刷新(E)',
          action: () => setSelectedIconId(null),
        },
        { id: 'ctx-sep-2', label: '', separator: true },
        {
          id: 'ctx-paste',
          label: '粘贴(P)',
          disabled: true,
        },
        {
          id: 'ctx-paste-shortcut',
          label: '粘贴快捷方式(S)',
          disabled: true,
        },
        { id: 'ctx-sep-3', label: '', separator: true },
        {
          id: 'ctx-new',
          label: '新建(N)',
          submenu: [
            {
              id: 'ctx-new-folder',
              label: '文件夹(F)',
              icon: '/icons/16/folder.png',
              action: () => {
                setVfs((prev) => createNode(prev, DESKTOP_FOLDER_ID, '新建文件夹', 'folder').nextVfs);
              },
            },
            {
              id: 'ctx-new-shortcut',
              label: '快捷方式(S)',
              icon: '/icons/ui/ctx-shortcut.png',
              action: () => {
                setVfs((prev) =>
                  createNode(prev, DESKTOP_FOLDER_ID, '新建快捷方式.lnk', 'file', '').nextVfs
                );
              },
            },
            { id: 'ctx-new-sep', label: '', separator: true },
            {
              id: 'ctx-new-briefcase',
              label: '公文包',
              icon: '/icons/ui/ctx-briefcase.png',
              action: () => {
                setVfs((prev) => createNode(prev, DESKTOP_FOLDER_ID, '我的公文包', 'folder').nextVfs);
              },
            },
            {
              id: 'ctx-new-bmp',
              label: 'BMP 图像',
              icon: '/icons/ui/ctx-bmp.png',
              action: () => {
                setVfs((prev) =>
                  createNode(prev, DESKTOP_FOLDER_ID, '新建 BMP 图像.bmp', 'file', '').nextVfs
                );
                launchApp('paint');
              },
            },
            {
              id: 'ctx-new-rtf',
              label: '写字板文档',
              icon: '/icons/ui/ctx-rtf.png',
              action: () => {
                const { nextVfs, created } = createNode(
                  vfs,
                  DESKTOP_FOLDER_ID,
                  '新建 写字板文档.rtf',
                  'file',
                  ''
                );
                setVfs(nextVfs);
                launchApp('notepad', { fileId: created.id, fileName: created.name });
              },
            },
            {
              id: 'ctx-new-txt',
              label: '文本文档',
              icon: '/icons/ui/ctx-txt.png',
              action: () => {
                const { nextVfs, created } = createNode(
                  vfs,
                  DESKTOP_FOLDER_ID,
                  '新建文本文档.txt',
                  'file',
                  ''
                );
                setVfs(nextVfs);
                launchApp('notepad', { fileId: created.id, fileName: created.name });
              },
            },
            {
              id: 'ctx-new-wav',
              label: '声音',
              icon: '/icons/ui/ctx-wav.png',
              action: () => {
                setVfs((prev) =>
                  createNode(prev, DESKTOP_FOLDER_ID, '新建声音.wav', 'file', '').nextVfs
                );
              },
            },
          ],
        },
        { id: 'ctx-sep-4', label: '', separator: true },
        {
          id: 'ctx-props',
          label: '属性(R)',
          bold: true,
          action: () => launchApp('display'),
        },
      ],
    });
  };

  const handleIconContextMenu = (e: React.MouseEvent, shortcut: DesktopShortcut) => {
    setStartMenuOpen(false);
    const pt = toScreenPoint(e.clientX, e.clientY);
    const recycleCount = listChildren(vfs, RECYCLE_BIN_ID).length;

    if (shortcut.id === 'desk-recycle') {
      setContextMenu({
        x: pt.x,
        y: pt.y,
        items: [
          {
            id: 'ico-open',
            label: '打开(O)',
            bold: true,
            icon: recycleCount === 0 ? '/icons/16/recycle-empty.png' : '/icons/16/recycle-full.png',
            action: () => launchApp('explorer', { path: RECYCLE_BIN_ID }),
          },
          {
            id: 'ico-explore',
            label: '资源管理器(X)',
            action: () => launchApp('explorer', { path: RECYCLE_BIN_ID }),
          },
          { id: 'ico-sep-1', label: '', separator: true },
          {
            id: 'ico-empty-bin',
            label: '清空回收站(B)',
            disabled: recycleCount === 0,
            action: () => setVfs((prev) => emptyRecycleBin(prev)),
          },
          { id: 'ico-sep-2', label: '', separator: true },
          {
            id: 'ico-shortcut',
            label: '创建快捷方式(S)',
            disabled: true,
          },
          {
            id: 'ico-props',
            label: '属性(R)',
            action: () => launchApp('display'),
          },
        ],
      });
      return;
    }

    if (shortcut.id === 'desk-mycomputer') {
      setContextMenu({
        x: pt.x,
        y: pt.y,
        items: [
          {
            id: 'ico-open',
            label: '打开(O)',
            bold: true,
            icon: '/icons/16/my-computer.png',
            action: () => launchApp('explorer', { path: ROOT_ID }),
          },
          {
            id: 'ico-explore',
            label: '资源管理器(X)',
            action: () => launchApp('explorer', { path: ROOT_ID }),
          },
          {
            id: 'ico-search',
            label: '搜索(F)...',
            icon: '/icons/16/search.png',
            action: () => launchApp('explorer', { path: 'drive-c' }),
          },
          {
            id: 'ico-manage',
            label: '管理(G)',
            action: () => launchApp('taskmgr'),
          },
          { id: 'ico-sep-1', label: '', separator: true },
          {
            id: 'ico-map-net',
            label: '映射网络驱动器(N)...',
            action: () => launchApp('netstatus'),
          },
          {
            id: 'ico-disc-net',
            label: '断开网络驱动器(D)...',
            disabled: true,
          },
          { id: 'ico-sep-2', label: '', separator: true },
          {
            id: 'ico-shortcut',
            label: '创建快捷方式(S)',
            action: () =>
              setVfs((prev) =>
                createNode(prev, DESKTOP_FOLDER_ID, '我的电脑 快捷方式.lnk', 'file', '').nextVfs
              ),
          },
          { id: 'ico-sep-3', label: '', separator: true },
          {
            id: 'ico-props',
            label: '属性(R)',
            action: () => launchApp('system'),
          },
        ],
      });
      return;
    }

    if (shortcut.id === 'desk-network') {
      setContextMenu({
        x: pt.x,
        y: pt.y,
        items: [
          {
            id: 'ico-open',
            label: '打开(O)',
            bold: true,
            icon: '/icons/16/network.png',
            action: () => launchApp('explorer', { path: NETWORK_ID }),
          },
          {
            id: 'ico-explore',
            label: '资源管理器(X)',
            action: () => launchApp('explorer', { path: NETWORK_ID }),
          },
          { id: 'ico-sep-1', label: '', separator: true },
          {
            id: 'ico-props',
            label: '属性(R)',
            action: () => launchApp('netstatus'),
          },
        ],
      });
      return;
    }

    if (shortcut.id === 'desk-mydocs') {
      setContextMenu({
        x: pt.x,
        y: pt.y,
        items: [
          {
            id: 'ico-open',
            label: '打开(O)',
            bold: true,
            icon: '/icons/16/my-documents.png',
            action: () => launchApp('explorer', { path: MY_DOCS_ID }),
          },
          {
            id: 'ico-explore',
            label: '资源管理器(X)',
            action: () => launchApp('explorer', { path: MY_DOCS_ID }),
          },
          {
            id: 'ico-search',
            label: '搜索(F)...',
            icon: '/icons/16/search.png',
            action: () => launchApp('explorer', { path: MY_DOCS_ID }),
          },
          { id: 'ico-sep-1', label: '', separator: true },
          {
            id: 'ico-props',
            label: '属性(R)',
            action: () => launchApp('display'),
          },
        ],
      });
      return;
    }

    setContextMenu({
      x: pt.x,
      y: pt.y,
      items: [
        {
          id: 'ico-open',
          label: '打开(O)',
          bold: true,
          action: () => launchApp(shortcut.appId, shortcut.payload),
        },
        ...(shortcut.vfsNodeId
          ? [
              { id: 'ico-sep-1', label: '', separator: true },
              {
                id: 'ico-del',
                label: '删除(D)',
                icon: '/icons/ui/delete.png',
                action: () =>
                  setVfs((prev) => deleteToRecycleBin(prev, shortcut.vfsNodeId!)),
              },
            ]
          : [
              {
                id: 'ico-shortcut',
                label: '创建快捷方式(S)',
                action: () =>
                  setVfs((prev) =>
                    createNode(
                      prev,
                      DESKTOP_FOLDER_ID,
                      `${shortcut.label} 快捷方式.lnk`,
                      'file',
                      ''
                    ).nextVfs
                  ),
              },
            ]),
        { id: 'ico-sep-2', label: '', separator: true },
        {
          id: 'ico-props',
          label: '属性(R)',
          action: () => launchApp('display'),
        },
      ],
    });
  };

  const handleTaskbarContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStartMenuOpen(false);
    const pt = toScreenPoint(e.clientX, e.clientY);
    const hasVisibleWindows = windows.some((w) => !w.isMinimized);
    setContextMenu({
      x: pt.x,
      y: pt.y,
      items: [
        {
          id: 'tb-toolbars',
          label: '工具栏(T)',
          submenu: [
            { id: 'tb-bar-quick', label: '快速启动(Q)', checked: true },
            { id: 'tb-bar-addr', label: '地址(A)', checked: false },
            { id: 'tb-bar-links', label: '链接(L)', checked: false },
            { id: 'tb-bar-desk', label: '桌面(D)', checked: false },
          ],
        },
        { id: 'tb-sep-1', label: '', separator: true },
        {
          id: 'tb-cascade',
          label: '层叠窗口(C)',
          disabled: !hasVisibleWindows,
          action: handleCascadeWindows,
        },
        {
          id: 'tb-tile-h',
          label: '横向平铺窗口(H)',
          disabled: !hasVisibleWindows,
          action: handleTileWindowsHorizontal,
        },
        {
          id: 'tb-tile-v',
          label: '纵向平铺窗口(V)',
          disabled: !hasVisibleWindows,
          action: handleTileWindowsVertical,
        },
        {
          id: 'tb-min-all',
          label: '最小化所有窗口(M)',
          disabled: !hasVisibleWindows,
          action: () => {
            setWindows((prev) => prev.map((w) => ({ ...w, isMinimized: true })));
            setActiveWindowId(null);
          },
        },
        { id: 'tb-sep-2', label: '', separator: true },
        {
          id: 'tb-timedate',
          label: '调整日期/时间(A)',
          icon: '/icons/ui/date-16.png',
          action: () => launchApp('timedate'),
        },
        { id: 'tb-sep-3', label: '', separator: true },
        {
          id: 'tb-taskmgr',
          label: '任务管理器(K)',
          bold: true,
          icon: '/icons/16/taskmgr.png',
          action: () => launchApp('taskmgr'),
        },
        { id: 'tb-sep-4', label: '', separator: true },
        {
          id: 'tb-props',
          label: '属性(R)',
          action: () => launchApp('display'),
        },
      ],
    });
  };

  const themeCssVars = useMemo(
    () =>
      ({
        '--w2k-desktop': activeScheme.desktopBg,
        '--w2k-face': activeScheme.face,
        '--w2k-highlight': activeScheme.highlight,
        '--w2k-light': activeScheme.light,
        '--w2k-shadow': activeScheme.shadow,
        '--w2k-dark-shadow': activeScheme.darkShadow,
        '--w2k-title-active-start': activeScheme.activeTitleStart,
        '--w2k-title-active-end': activeScheme.activeTitleEnd,
        '--w2k-title-active-text': activeScheme.activeTitleText,
        '--w2k-title-inactive-start': activeScheme.inactiveTitleStart,
        '--w2k-title-inactive-end': activeScheme.inactiveTitleEnd,
        '--w2k-title-inactive-text': activeScheme.inactiveTitleText,
        '--w2k-window-bg': activeScheme.windowBg,
        '--w2k-window-text': activeScheme.windowText,
        '--w2k-menu-bg': activeScheme.menuBg,
        '--w2k-menu-text': activeScheme.menuText,
        '--w2k-selection-bg': activeScheme.selectionBg,
        '--w2k-selection-text': activeScheme.selectionText,
      }) as React.CSSProperties,
    [activeScheme]
  );

  const renderWindowBody = (win: WindowState) => {
    switch (win.appId) {
      case 'explorer':
        return (
          <ExplorerApp
            initialPath={win.payload?.path ?? ROOT_ID}
            vfs={vfs}
            setVfs={setVfs}
            onLaunchApp={launchApp}
            onUpdateTitle={(title, icon) => updateWindowMeta(win.id, title, icon)}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'notepad':
        return (
          <NotepadApp
            fileId={win.payload?.fileId}
            fileName={win.payload?.fileName}
            vfs={vfs}
            setVfs={setVfs}
            onUpdateTitle={(title) => updateWindowMeta(win.id, title)}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'minesweeper':
        return (
          <MinesweeperApp
            onClose={() => closeWindow(win.id)}
            onResizeForDifficulty={(w, h) => resizeWindow(win.id, w, h)}
          />
        );
      case 'calculator':
        return <CalculatorApp />;
      case 'paint':
        return <PaintApp />;
      case 'cmd':
        return (
          <CommandPromptApp
            vfs={vfs}
            setVfs={setVfs}
            onLaunchApp={launchApp}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'ie':
        return (
          <InternetExplorerApp
            initialUrl={win.payload?.initialUrl}
            onUpdateTitle={(title) => updateWindowMeta(win.id, title)}
            onNetworkActivity={() =>
              setNetwork((prev) => ({
                ...tickNetworkStats(prev, { sentDelta: 18, recvDelta: 42 }),
                activityTick: prev.activityTick + 1,
              }))
            }
          />
        );
      case 'display':
        return (
          <DisplayPropsApp
            wallpaper={wallpaper}
            colorScheme={colorSchemeId}
            crtEnabled={crtEnabled}
            onApply={(wp, sc, crt) => {
              setWallpaper(wp);
              setColorSchemeId(sc);
              setCrtEnabled(crt);
            }}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'system':
        return <SystemPropsApp onClose={() => closeWindow(win.id)} />;
      case 'taskmgr':
        return (
          <TaskManagerApp
            windows={windows}
            onFocusWindow={focusWindow}
            onCloseWindow={closeWindow}
            onLaunchApp={(appId) => launchApp(appId)}
          />
        );
      case 'run':
        return <RunDialogApp onLaunchApp={launchApp} onClose={() => closeWindow(win.id)} />;
      case 'shutdown':
        return (
          <ShutdownDialogApp
            initialAction={win.payload?.initialTab === 'logoff' ? 'logoff' : 'shutdown'}
            onExecutePower={(next) => setPowerState(next)}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'about':
        return <AboutWinApp onClose={() => closeWindow(win.id)} />;
      case 'help':
        return <HelpApp onClose={() => closeWindow(win.id)} />;
      case 'sndvol':
        return (
          <SndVolApp
            volume={volume}
            muted={muted}
            onChangeMasterVolume={setVolume}
            onChangeMasterMuted={setMuted}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'timedate':
        return <DateTimePropsApp onClose={() => closeWindow(win.id)} />;
      case 'netstatus':
        return (
          <LocalAreaStatusApp
            network={network}
            onToggleEnabled={() =>
              setNetwork((prev) => ({
                ...prev,
                enabled: !prev.enabled,
                activityTick: prev.activityTick + 1,
              }))
            }
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'royal-hawaii':
        return (
          <RoyalHawaiiApp
            systemVolume={volume}
            systemMuted={muted}
            onUpdateTitle={(title) => updateWindowMeta(win.id, title)}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'palm-bath':
        return (
          <PalmBathApp
            systemVolume={volume}
            systemMuted={muted}
            onUpdateTitle={(title) => updateWindowMeta(win.id, title)}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'imaging':
        return (
          <ImagingApp
            initialMediaId={win.payload?.mediaId}
            onUpdateTitle={(title) => updateWindowMeta(win.id, title)}
            onClose={() => closeWindow(win.id)}
          />
        );
      case 'mplayer':
        return (
          <MediaPlayerApp
            initialMediaId={win.payload?.mediaId}
            autoPlay={Boolean(win.payload?.autoPlay)}
            onUpdateTitle={(title) => updateWindowMeta(win.id, title)}
            onOpenVideosFolder={() => launchApp('explorer', { path: 'doc-videos' })}
            onClose={() => closeWindow(win.id)}
          />
        );
    }
  };

  const screenMetrics = getScreenMetrics();

  return (
    <main className="w-screen h-screen overflow-hidden relative">
      {crtEnabled && <CrtOpticsSvgDefs />}
      <div
        ref={screenRef}
        style={{
          ...themeCssVars,
          ...getWallpaperStyle(wallpaper, activeScheme.desktopBg),
        }}
        className={`w2k-crt-screen select-none ${crtEnabled ? 'is-crt-optics' : ''}`}
        onClick={() => {
          setSelectedIconId(null);
          setStartMenuOpen(false);
          setContextMenu(null);
        }}
        onContextMenu={handleDesktopContextMenu}
      >
        {/* Centered Windows 2000 Classic Logo Wallpaper (when selected) */}
        {wallpaper === 'win2000' && (
          <div className="pointer-events-none absolute inset-0 bottom-[28px] flex items-center justify-center">
            <div className="bg-white/10 border border-white/25 px-8 py-6 flex items-center gap-4 text-white">
              <WinFlagIcon size={48} />
              <div>
                <div className="text-[12px] opacity-90">Microsoft®</div>
                <div className="text-[28px] font-bold leading-none">Windows 2000</div>
                <div className="text-[14px] opacity-90 mt-1">Professional</div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Icons */}
        <DesktopIconGrid
          vfs={vfs}
          selectedId={selectedIconId}
          showIcons={showDesktopIcons}
          sortMode={iconSort}
          onSelect={setSelectedIconId}
          onLaunchApp={launchApp}
          onContextMenuIcon={handleIconContextMenu}
        />

        {/* Open Application Windows */}
        {windows.map((win) => (
          <WindowFrame
            key={win.id}
            win={win}
            isActive={win.id === activeWindowId}
            onFocus={focusWindow}
            onClose={closeWindow}
            onMinimize={minimizeWindow}
            onToggleMaximize={toggleMaximizeWindow}
            onMove={moveWindow}
            onResize={resizeWindow}
          >
            {renderWindowBody(win)}
          </WindowFrame>
        ))}

        {/* Start Menu */}
        <StartMenu
          open={startMenuOpen}
          vfs={vfs}
          onClose={() => setStartMenuOpen(false)}
          onLaunchApp={launchApp}
        />

        {/* Context Menu */}
        <ContextMenu
          menu={contextMenu}
          containerWidth={screenMetrics.width}
          containerHeight={screenMetrics.height}
          onClose={() => setContextMenu(null)}
        />

        {/* Bottom Taskbar */}
        <Taskbar
          windows={windows}
          activeWindowId={activeWindowId}
          startMenuOpen={startMenuOpen}
          volume={volume}
          muted={muted}
          imeId={imeId}
          network={network}
          onChangeVolume={setVolume}
          onChangeMuted={setMuted}
          onChangeIme={setImeId}
          onToggleStartMenu={() => {
            setContextMenu(null);
            setStartMenuOpen((o) => !o);
          }}
          onSelectWindow={handleTaskbarSelect}
          onShowDesktop={handleShowDesktop}
          onLaunchApp={launchApp}
          onContextMenuTaskbar={handleTaskbarContextMenu}
        />

        {/* Boot / SAS / Logon / Shutdown Screens */}
        <BootAndShutdownScreen
          powerState={powerState}
          onChangePowerState={setPowerState}
        />
      </div>

      {/* Shadow-Mask Dot Triads & Spherical CRT Glass Reflection Overlay */}
      {crtEnabled && <CrtGlassOverlay />}
    </main>
  );
}
