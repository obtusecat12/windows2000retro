import React from 'react';
import type { AppId, DesktopIconSort, IconKind, VfsNode, WindowState } from '../../types/os';
import {
  DESKTOP_FOLDER_ID,
  MY_DOCS_ID,
  NETWORK_ID,
  RECYCLE_BIN_ID,
  ROOT_ID,
  listChildren,
} from '../../core/vfs';
import { getAppForVfsNode } from '../../core/mediaCatalog';
import { Win2kIcon } from '../icons/Win2kIcons';

export interface DesktopShortcut {
  id: string;
  label: string;
  icon: IconKind;
  appId: AppId;
  payload?: WindowState['payload'];
  vfsNodeId?: string;
  sortTypeRank?: number;
  sortSize?: number;
  sortDate?: string;
}

interface DesktopIconGridProps {
  vfs: Record<string, VfsNode>;
  selectedId: string | null;
  showIcons?: boolean;
  sortMode?: DesktopIconSort | null;
  onSelect: (id: string | null) => void;
  onLaunchApp: (appId: AppId, payload?: WindowState['payload']) => void;
  onContextMenuIcon: (e: React.MouseEvent, shortcut: DesktopShortcut) => void;
}

export const DesktopIconGrid: React.FC<DesktopIconGridProps> = ({
  vfs,
  selectedId,
  showIcons = true,
  sortMode = null,
  onSelect,
  onLaunchApp,
  onContextMenuIcon,
}) => {
  if (!showIcons) return null;

  const recycleEmpty = listChildren(vfs, RECYCLE_BIN_ID).length === 0;

  const builtInShortcuts: DesktopShortcut[] = [
    {
      id: 'desk-mydocs',
      label: '我的文档',
      icon: 'my-documents',
      appId: 'explorer',
      payload: { path: MY_DOCS_ID },
      sortTypeRank: 0,
      sortSize: 0,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-mycomputer',
      label: '我的电脑',
      icon: 'my-computer',
      appId: 'explorer',
      payload: { path: ROOT_ID },
      sortTypeRank: 0,
      sortSize: 0,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-network',
      label: '网上邻居',
      icon: 'network',
      appId: 'explorer',
      payload: { path: NETWORK_ID },
      sortTypeRank: 0,
      sortSize: 0,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-recycle',
      label: '回收站',
      icon: recycleEmpty ? 'recycle-empty' : 'recycle-full',
      appId: 'explorer',
      payload: { path: RECYCLE_BIN_ID },
      sortTypeRank: 0,
      sortSize: 0,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-ie',
      label: 'Internet Explorer',
      icon: 'ie',
      appId: 'ie',
      sortTypeRank: 1,
      sortSize: 92,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-notepad',
      label: '记事本',
      icon: 'notepad',
      appId: 'notepad',
      sortTypeRank: 2,
      sortSize: 51,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-minesweeper',
      label: '扫雷',
      icon: 'minesweeper',
      appId: 'minesweeper',
      sortTypeRank: 2,
      sortSize: 118,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-paint',
      label: '画图',
      icon: 'paint',
      appId: 'paint',
      sortTypeRank: 2,
      sortSize: 344,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-calc',
      label: '计算器',
      icon: 'calculator',
      appId: 'calculator',
      sortTypeRank: 2,
      sortSize: 94,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-cmd',
      label: '命令提示符',
      icon: 'cmd',
      appId: 'cmd',
      sortTypeRank: 2,
      sortSize: 231,
      sortDate: '2000-02-17',
    },
    {
      id: 'desk-royal-hawaii',
      label: 'Royal Hawaii',
      icon: 'royal-hawaii',
      appId: 'royal-hawaii',
      sortTypeRank: 2,
      sortSize: 384,
      sortDate: '2000-05-05',
    },
    {
      id: 'desk-palm-bath',
      label: '棕榈浴场',
      icon: 'palm-bath',
      appId: 'palm-bath',
      sortTypeRank: 2,
      sortSize: 256,
      sortDate: '2000-05-05',
    },
    {
      id: 'desk-imaging',
      label: '图像处理',
      icon: 'imaging',
      appId: 'imaging',
      sortTypeRank: 2,
      sortSize: 412,
      sortDate: '2000-05-04',
    },
    {
      id: 'desk-mplayer',
      label: 'Windows Media Player',
      icon: 'mplayer',
      appId: 'mplayer',
      sortTypeRank: 2,
      sortSize: 468,
      sortDate: '2000-05-04',
    },
  ];

  const desktopFiles: DesktopShortcut[] = listChildren(vfs, DESKTOP_FOLDER_ID).map((node) => {
    const assoc = getAppForVfsNode(node);
    return {
      id: `desk-vfs-${node.id}`,
      label: node.name,
      icon: node.icon ?? (node.type === 'folder' ? 'folder' : 'text-file'),
      appId: assoc.appId,
      payload:
        node.type === 'folder'
          ? { path: node.id }
          : assoc.appId === 'imaging' || assoc.appId === 'mplayer'
          ? { fileId: node.id, fileName: node.name, mediaId: node.mediaId, autoPlay: assoc.appId === 'mplayer' }
          : { fileId: node.id, fileName: node.name },
      vfsNodeId: node.id,
      sortTypeRank: node.type === 'folder' ? 3 : 4,
      sortSize: node.size ?? 0,
      sortDate: node.modifiedAt,
    };
  });

  let allShortcuts = [...builtInShortcuts, ...desktopFiles];
  if (sortMode === 'name') {
    allShortcuts = [...allShortcuts].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  } else if (sortMode === 'type') {
    allShortcuts = [...allShortcuts].sort(
      (a, b) =>
        (a.sortTypeRank ?? 9) - (b.sortTypeRank ?? 9) ||
        a.label.localeCompare(b.label, 'zh-CN')
    );
  } else if (sortMode === 'size') {
    allShortcuts = [...allShortcuts].sort((a, b) => (b.sortSize ?? 0) - (a.sortSize ?? 0));
  } else if (sortMode === 'date') {
    allShortcuts = [...allShortcuts].sort((a, b) =>
      (b.sortDate ?? '').localeCompare(a.sortDate ?? '')
    );
  }

  return (
    <div
      className="absolute top-2 left-2 bottom-[36px] flex flex-col flex-wrap content-start gap-y-2 gap-x-3 pointer-events-none z-10"
      aria-label="桌面图标"
    >
      {allShortcuts.map((item) => {
        const isSelected = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            className={`w2k-desktop-icon pointer-events-auto w-[74px] py-1 px-1 flex flex-col items-center gap-1 bg-transparent border-0 cursor-default focus:outline-none ${
              isSelected ? 'selected' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onLaunchApp(item.appId, item.payload);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(item.id);
              onContextMenuIcon(e, item);
            }}
          >
            <Win2kIcon kind={item.icon} size={32} />
            <span className="w2k-desktop-label line-clamp-2">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
