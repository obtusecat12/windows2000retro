import React, { useMemo, useState } from 'react';
import type { AppId, VfsNode, WindowState } from '../../types/os';
import {
  CONTROL_PANEL_ID,
  MY_DOCS_ID,
  NETWORK_ID,
  RECYCLE_BIN_ID,
  ROOT_ID,
  copyNode,
  createNode,
  deleteToRecycleBin,
  emptyRecycleBin,
  getDisplayPath,
  getParentFolderId,
  listChildren,
  moveNode,
  renameNode,
  restoreFromRecycleBin,
} from '../../core/vfs';
import { getAppForVfsNode } from '../../core/mediaCatalog';
import { Win2kBrowseIcon, Win2kIcon, Win2kThrobber } from '../icons/Win2kIcons';
import { PixelCheckmark, PixelRadioDot } from '../icons/Win2kPixelGlyphs';

interface ExplorerAppProps {
  initialPath?: string;
  vfs: Record<string, VfsNode>;
  setVfs: React.Dispatch<React.SetStateAction<Record<string, VfsNode>>>;
  onLaunchApp: (appId: AppId, payload?: WindowState['payload']) => void;
  onUpdateTitle: (title: string, icon: WindowState['icon']) => void;
  onClose: () => void;
}

interface ClipboardItem {
  nodeId: string;
  mode: 'copy' | 'cut';
}

export const ExplorerApp: React.FC<ExplorerAppProps> = ({
  initialPath = ROOT_ID,
  vfs,
  setVfs,
  onLaunchApp,
  onUpdateTitle,
  onClose,
}) => {
  const [history, setHistory] = useState<string[]>([initialPath]);
  const [histIdx, setHistIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'icons' | 'list' | 'details'>('icons');
  const [leftBarMode, setLeftBarMode] = useState<'webview' | 'folders' | 'search'>('webview');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [undoVfs, setUndoVfs] = useState<Record<string, VfsNode> | null>(null);
  const [throbberActive, setThrobberActive] = useState(false);
  const [propsNodeId, setPropsNodeId] = useState<string | null>(null);
  const [showAddNetworkModal, setShowAddNetworkModal] = useState(false);
  const [newNetSharePath, setNewNetSharePath] = useState('\\\\192.168.1.50\\共享资料');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTreeIds, setExpandedTreeIds] = useState<Record<string, boolean>>({
    [ROOT_ID]: true,
    [MY_DOCS_ID]: true,
    [NETWORK_ID]: true,
    'net-entire': true,
    'net-workgroup': true,
    'drive-c': true,
  });

  const currentId = history[histIdx] ?? ROOT_ID;
  const currentNode = vfs[currentId] ?? vfs[ROOT_ID];
  const children = useMemo(() => listChildren(vfs, currentId), [vfs, currentId]);
  const selectedNode = selectedId ? vfs[selectedId] : undefined;

  const pulseThrobber = () => {
    setThrobberActive(true);
    window.setTimeout(() => setThrobberActive(false), 380);
  };

  const navigateTo = (targetId: string) => {
    if (!vfs[targetId]) return;
    if (targetId === 'net-add-place') {
      setShowAddNetworkModal(true);
      return;
    }
    const nextHist = history.slice(0, histIdx + 1);
    if (nextHist[nextHist.length - 1] !== targetId) {
      nextHist.push(targetId);
      setHistory(nextHist);
      setHistIdx(nextHist.length - 1);
    }
    setSelectedId(null);
    setOpenMenu(null);
    pulseThrobber();
    const target = vfs[targetId];
    onUpdateTitle(target.name, target.icon ?? 'folder');
  };

  const canBack = histIdx > 0;
  const canForward = histIdx < history.length - 1;
  const parentId = getParentFolderId(vfs, currentId);

  const handleBack = () => {
    if (!canBack) return;
    const nextIdx = histIdx - 1;
    setHistIdx(nextIdx);
    setSelectedId(null);
    pulseThrobber();
    const node = vfs[history[nextIdx]];
    if (node) onUpdateTitle(node.name, node.icon ?? 'folder');
  };

  const handleForward = () => {
    if (!canForward) return;
    const nextIdx = histIdx + 1;
    setHistIdx(nextIdx);
    setSelectedId(null);
    pulseThrobber();
    const node = vfs[history[nextIdx]];
    if (node) onUpdateTitle(node.name, node.icon ?? 'folder');
  };

  const handleUp = () => {
    if (parentId) navigateTo(parentId);
  };

  const handleOpenItem = (item: VfsNode) => {
    if (item.id === 'net-add-place') {
      setShowAddNetworkModal(true);
      return;
    }
    if (item.type === 'drive' || item.type === 'folder' || item.type === 'virtual') {
      navigateTo(item.id);
    } else if (item.type === 'file') {
      const assoc = getAppForVfsNode(item);
      if (assoc.appId === 'imaging') {
        onLaunchApp('imaging', { fileId: item.id, fileName: item.name, mediaId: item.mediaId });
      } else if (assoc.appId === 'mplayer') {
        onLaunchApp('mplayer', {
          fileId: item.id,
          fileName: item.name,
          mediaId: item.mediaId,
          autoPlay: true,
        });
      } else {
        onLaunchApp('notepad', { fileId: item.id, fileName: item.name });
      }
    }
  };

  const isVirtualRoot =
    currentId === ROOT_ID ||
    currentId === NETWORK_ID ||
    currentId === RECYCLE_BIN_ID ||
    currentId === CONTROL_PANEL_ID ||
    currentId === 'net-entire' ||
    currentId === 'net-workgroup';

  const canMutateSelected =
    Boolean(selectedNode) &&
    selectedNode!.type !== 'drive' &&
    selectedNode!.type !== 'virtual' &&
    selectedNode!.id !== MY_DOCS_ID;

  const handleCreateFolder = () => {
    if (isVirtualRoot) return;
    setUndoVfs(vfs);
    const { nextVfs, created } = createNode(vfs, currentId, '新建文件夹', 'folder');
    setVfs(nextVfs);
    setSelectedId(created.id);
    setRenamingId(created.id);
    setRenameText(created.name);
    setOpenMenu(null);
  };

  const handleCreateFile = () => {
    if (isVirtualRoot) return;
    setUndoVfs(vfs);
    const { nextVfs, created } = createNode(vfs, currentId, '新建文本文档.txt', 'file', '');
    setVfs(nextVfs);
    setSelectedId(created.id);
    setRenamingId(created.id);
    setRenameText(created.name);
    setOpenMenu(null);
  };

  const handleDeleteSelected = () => {
    if (!canMutateSelected || !selectedNode) return;
    setUndoVfs(vfs);
    setVfs((prev) => deleteToRecycleBin(prev, selectedNode.id));
    setSelectedId(null);
    setOpenMenu(null);
  };

  const handleCopy = () => {
    if (!canMutateSelected || !selectedNode) return;
    setClipboard({ nodeId: selectedNode.id, mode: 'copy' });
    setOpenMenu(null);
  };

  const handleCut = () => {
    if (!canMutateSelected || !selectedNode) return;
    setClipboard({ nodeId: selectedNode.id, mode: 'cut' });
    setOpenMenu(null);
  };

  const handlePaste = () => {
    if (!clipboard || isVirtualRoot || !vfs[clipboard.nodeId]) return;
    setUndoVfs(vfs);
    if (clipboard.mode === 'copy') {
      const { nextVfs, copiedId } = copyNode(vfs, clipboard.nodeId, currentId);
      setVfs(nextVfs);
      if (copiedId) setSelectedId(copiedId);
    } else {
      const nextVfs = moveNode(vfs, clipboard.nodeId, currentId);
      setVfs(nextVfs);
      setSelectedId(clipboard.nodeId);
      setClipboard(null);
    }
    setOpenMenu(null);
  };

  const handleUndo = () => {
    if (!undoVfs) return;
    setVfs(undoVfs);
    setUndoVfs(null);
    setSelectedId(null);
    setOpenMenu(null);
  };

  const handleRestoreSelected = () => {
    if (!selectedNode || currentId !== RECYCLE_BIN_ID) return;
    setUndoVfs(vfs);
    setVfs((prev) => restoreFromRecycleBin(prev, selectedNode.id));
    setSelectedId(null);
  };

  const handleEmptyRecycleBin = () => {
    setUndoVfs(vfs);
    setVfs((prev) => emptyRecycleBin(prev));
    setSelectedId(null);
  };

  const commitRename = () => {
    if (renamingId && renameText.trim()) {
      setUndoVfs(vfs);
      setVfs((prev) => renameNode(prev, renamingId, renameText));
    }
    setRenamingId(null);
  };

  const handleAddNetworkPlaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newNetSharePath.trim();
    if (!raw) return;
    const cleanName = raw.replace(/^\\\\/, '').replace(/\\/g, ' 上的 ');
    const { nextVfs, created } = createNode(vfs, NETWORK_ID, cleanName, 'folder');
    nextVfs[created.id] = {
      ...created,
      icon: 'share-folder',
    };
    const readme = createNode(
      nextVfs,
      created.id,
      '网络位置信息.txt',
      'file',
      `UNC 网络路径: ${raw}\n已成功添加至“网上邻居”。`
    );
    setVfs(readme.nextVfs);
    setShowAddNetworkModal(false);
    setSelectedId(created.id);
  };

  const controlPanelApplets = [
    {
      id: 'cp-display',
      name: '显示',
      desc: '更改桌面背景、屏幕保护程序及 Windows 外观配色方案。',
      icon: 'display' as const,
      action: () => onLaunchApp('display'),
    },
    {
      id: 'cp-system',
      name: '系统',
      desc: '查看计算机硬件配置与 Windows 2000 系统版本信息。',
      icon: 'system' as const,
      action: () => onLaunchApp('system'),
    },
    {
      id: 'cp-network',
      name: '网络和拨号连接',
      desc: '连接到其他计算机、网络和 Internet。',
      icon: 'network' as const,
      action: () => navigateTo(NETWORK_ID),
    },
    {
      id: 'cp-ie',
      name: 'Internet 选项',
      desc: '配置 Internet Explorer 主页与连接设置。',
      icon: 'ie' as const,
      action: () => onLaunchApp('ie'),
    },
    {
      id: 'cp-taskmgr',
      name: '任务管理器',
      desc: '监视正在运行的程序和系统性能指标。',
      icon: 'taskmgr' as const,
      action: () => onLaunchApp('taskmgr'),
    },
    {
      id: 'cp-cmd',
      name: '命令提示符',
      desc: '打开 Windows 2000 命令行解释程序。',
      icon: 'cmd' as const,
      action: () => onLaunchApp('cmd'),
    },
  ];

  const addressLocations = [
    { id: ROOT_ID, label: '我的电脑', icon: 'my-computer' as const },
    { id: MY_DOCS_ID, label: '我的文档', icon: 'my-documents' as const },
    { id: 'drive-a', label: '3.5 软盘 (A:)', icon: 'drive-floppy' as const },
    { id: 'drive-c', label: '本地磁盘 (C:)', icon: 'drive-hdd' as const },
    { id: 'drive-d', label: '本地磁盘 (D:)', icon: 'drive-hdd' as const },
    { id: 'drive-e', label: 'Compact Disc (E:)', icon: 'drive-cd' as const },
    { id: CONTROL_PANEL_ID, label: '控制面板', icon: 'control-panel' as const },
    { id: NETWORK_ID, label: '网上邻居', icon: 'network' as const },
    { id: 'net-entire', label: '网上邻居\\整个网络', icon: 'entire-network' as const },
    { id: 'net-workgroup', label: '网上邻居\\整个网络\\WORKGROUP', icon: 'entire-network' as const },
    { id: RECYCLE_BIN_ID, label: '回收站', icon: 'recycle-empty' as const },
  ];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(vfs)
      .filter((n) => n.name.toLowerCase().includes(q) && n.id !== ROOT_ID)
      .slice(0, 30);
  }, [searchQuery, vfs]);

  const toggleTreeExpand = (id: string) => {
    setExpandedTreeIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTreeNode = (nodeId: string, depth: number): React.ReactNode => {
    const node = vfs[nodeId];
    if (!node) return null;
    const subFolders = listChildren(vfs, nodeId).filter(
      (c) => c.type === 'drive' || c.type === 'folder' || c.type === 'virtual'
    );
    const hasChildren = subFolders.length > 0;
    const isExpanded = Boolean(expandedTreeIds[nodeId]);
    const isCurrent = currentId === nodeId;

    return (
      <div key={nodeId}>
        <div
          className="flex items-center gap-1 py-[1px] pr-1 cursor-default whitespace-nowrap"
          style={{ paddingLeft: depth * 12 + 2 }}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isExpanded ? `折叠 ${node.name}` : `展开 ${node.name}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleTreeExpand(nodeId);
              }}
              className="w-[11px] h-[11px] border border-[#808080] bg-white text-[9px] leading-[9px] flex items-center justify-center p-0 shrink-0 text-black"
            >
              {isExpanded ? '-' : '+'}
            </button>
          ) : (
            <span className="w-[11px] shrink-0" />
          )}
          <button
            type="button"
            onClick={() => navigateTo(nodeId)}
            className={`flex items-center gap-1 border-0 px-1 py-[1px] text-[12px] cursor-default text-left min-w-0 ${
              isCurrent
                ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                : 'bg-transparent text-black hover:underline'
            }`}
          >
            <Win2kIcon kind={node.icon ?? 'folder'} size={16} />
            <span className="truncate">{node.name}</span>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>{subFolders.map((sub) => renderTreeNode(sub.id, depth + 1))}</div>
        )}
      </div>
    );
  };

  const renderWebViewSideDescription = () => {
    if (selectedNode) {
      return (
        <div className="text-[11px] text-[#222222] space-y-1.5 px-3">
          <div className="font-bold text-[#0A246A] break-words">{selectedNode.name}</div>
          <div>
            类型:{' '}
            {selectedNode.type === 'drive'
              ? '本地驱动器'
              : selectedNode.id === 'net-add-place'
              ? '网络向导'
              : selectedNode.type === 'folder'
              ? '文件夹'
              : selectedNode.type === 'virtual'
              ? '系统文件夹'
              : '文档项目'}
          </div>
          {selectedNode.size !== undefined && <div>大小: {selectedNode.size} 字节</div>}
          <div>修改日期: {selectedNode.modifiedAt}</div>
          {selectedNode.type === 'drive' && selectedNode.totalSpaceMB ? (
            <div className="pt-2 space-y-1">
              <div>总大小: {selectedNode.totalSpaceMB} MB</div>
              <div>可用空间: {selectedNode.freeSpaceMB} MB</div>
              <div className="w-full h-[12px] border border-[#808080] bg-[#FF00FF]/70 flex">
                <div
                  className="h-full bg-[#0000FF]"
                  style={{
                    width: `${Math.max(
                      6,
                      Math.round(
                        ((selectedNode.totalSpaceMB - (selectedNode.freeSpaceMB ?? 0)) /
                          selectedNode.totalSpaceMB) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-[#0000FF]" />
                  已用空间
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-[#FF00FF]" />
                  可用空间
                </span>
              </div>
            </div>
          ) : null}
          {selectedNode.type === 'file' && selectedNode.content && (
            <div className="pt-2 border-t border-[#E8E6E1] text-[10px] text-[#404040] whitespace-pre-wrap line-clamp-4">
              {selectedNode.content}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-[11px] text-[#222222] space-y-2.5 leading-relaxed px-3">
        <p className="m-0">
          {currentId === ROOT_ID
            ? '要查看某个项目的内容，请单击该项目。要编辑文件，请双击图标。'
            : currentId === MY_DOCS_ID
            ? '此文件夹用来存放您的个人信件、报告、图片和其他文档。'
            : currentId === NETWORK_ID
            ? '在“网上邻居”中查看的文件夹和文件是以前访问过的网络项目、工作组主机与共享打印机。'
            : currentId === CONTROL_PANEL_ID
            ? '使用“控制面板”中的设置可以自定义您的计算机外观、硬件和网络。'
            : currentId === RECYCLE_BIN_ID
            ? '回收站包含您已删除的文件。您可以选择还原项目或清空回收站。'
            : '选择一个项目以查看其说明、属性和可用操作。'}
        </p>

        {!isVirtualRoot && (
          <div className="pt-1 flex flex-col gap-1">
            <div className="font-bold text-[#404040]">文件夹任务:</div>
            <button
              type="button"
              onClick={handleCreateFolder}
              className="text-left text-[#0A246A] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]"
            >
              新建文件夹
            </button>
            <button
              type="button"
              onClick={handleCreateFile}
              className="text-left text-[#0A246A] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]"
            >
              新建文本文档
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-[#E8E6E1] flex flex-col gap-1">
          <div className="font-bold text-[#404040]">请参见:</div>
          <button
            type="button"
            onClick={() => navigateTo(MY_DOCS_ID)}
            className="text-left text-[#0A246A] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]"
          >
            我的文档
          </button>
          <button
            type="button"
            onClick={() => navigateTo(NETWORK_ID)}
            className="text-left text-[#0A246A] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]"
          >
            网上邻居
          </button>
          <button
            type="button"
            onClick={() => navigateTo(ROOT_ID)}
            className="text-left text-[#0A246A] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]"
          >
            我的电脑
          </button>
          <button
            type="button"
            onClick={() => navigateTo(CONTROL_PANEL_ID)}
            className="text-left text-[#0A246A] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]"
          >
            控制面板
          </button>
        </div>
      </div>
    );
  };

  const activeAddressMeta =
    addressLocations.find((a) => a.id === currentId) ?? {
      id: currentId,
      label: getDisplayPath(vfs, currentId),
      icon: currentNode.icon ?? 'folder',
    };

  const propsNode = propsNodeId ? vfs[propsNodeId] : undefined;

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--w2k-face)] min-h-0 relative"
      onClick={() => setOpenMenu(null)}
    >
      {/* Row 1: Menu Bar + Right-Side Windows Throbber */}
      <div className="flex items-stretch border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)] bg-[var(--w2k-menu-bg)]">
        <div className="w2k-menubar flex-1 border-b-0 shadow-none relative">
          <div className="w2k-gripper mr-0.5" />
          <div className="relative">
            <button
              type="button"
              className={`w2k-menubar-item ${openMenu === 'file' ? 'open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === 'file' ? null : 'file');
              }}
            >
              文件(F)
            </button>
            {openMenu === 'file' && (
              <div className="w2k-menu-popup absolute left-0 top-full z-30">
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={isVirtualRoot}
                  onClick={handleCreateFolder}
                >
                  新建文件夹(N)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={isVirtualRoot}
                  onClick={handleCreateFile}
                >
                  新建文本文档(T)
                </button>
                <div className="w2k-menu-sep" />
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!canMutateSelected}
                  onClick={handleDeleteSelected}
                >
                  删除(D)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!canMutateSelected}
                  onClick={() => {
                    if (selectedNode) {
                      setRenamingId(selectedNode.id);
                      setRenameText(selectedNode.name);
                      setOpenMenu(null);
                    }
                  }}
                >
                  重命名(M)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!selectedNode}
                  onClick={() => {
                    if (selectedNode) {
                      setPropsNodeId(selectedNode.id);
                      setOpenMenu(null);
                    }
                  }}
                >
                  属性(R)
                </button>
                <div className="w2k-menu-sep" />
                <button type="button" className="w2k-menu-item" onClick={onClose}>
                  关闭(C)
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className={`w2k-menubar-item ${openMenu === 'edit' ? 'open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === 'edit' ? null : 'edit');
              }}
            >
              编辑(E)
            </button>
            {openMenu === 'edit' && (
              <div className="w2k-menu-popup absolute left-0 top-full z-30">
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!undoVfs}
                  onClick={handleUndo}
                >
                  撤消(U)
                </button>
                <div className="w2k-menu-sep" />
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!canMutateSelected}
                  onClick={handleCut}
                >
                  剪切(T)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!canMutateSelected}
                  onClick={handleCopy}
                >
                  复制(C)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  disabled={!clipboard || isVirtualRoot}
                  onClick={handlePaste}
                >
                  粘贴(P)
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className={`w2k-menubar-item ${openMenu === 'view' ? 'open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === 'view' ? null : 'view');
              }}
            >
              查看(V)
            </button>
            {openMenu === 'view' && (
              <div className="w2k-menu-popup absolute left-0 top-full z-30">
                <button
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setLeftBarMode((m) => (m === 'folders' ? 'webview' : 'folders'));
                    setOpenMenu(null);
                  }}
                >
                  {leftBarMode === 'folders' && (
                    <span className="absolute left-2 flex items-center">
                      <PixelCheckmark />
                    </span>
                  )}
                  浏览器栏 - 文件夹(F)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setLeftBarMode((m) => (m === 'search' ? 'webview' : 'search'));
                    setOpenMenu(null);
                  }}
                >
                  {leftBarMode === 'search' && (
                    <span className="absolute left-2 flex items-center">
                      <PixelCheckmark />
                    </span>
                  )}
                  浏览器栏 - 搜索(S)
                </button>
                <div className="w2k-menu-sep" />
                <button
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setViewMode('icons');
                    setOpenMenu(null);
                  }}
                >
                  {viewMode === 'icons' && (
                    <span className="absolute left-2 flex items-center">
                      <PixelRadioDot />
                    </span>
                  )}
                  大图标(G)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setViewMode('list');
                    setOpenMenu(null);
                  }}
                >
                  {viewMode === 'list' && (
                    <span className="absolute left-2 flex items-center">
                      <PixelRadioDot />
                    </span>
                  )}
                  列表(L)
                </button>
                <button
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setViewMode('details');
                    setOpenMenu(null);
                  }}
                >
                  {viewMode === 'details' && (
                    <span className="absolute left-2 flex items-center">
                      <PixelRadioDot />
                    </span>
                  )}
                  详细信息(D)
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="w2k-menubar-item"
            onClick={() => navigateTo(MY_DOCS_ID)}
          >
            收藏(A)
          </button>
          <button
            type="button"
            className="w2k-menubar-item"
            onClick={() => navigateTo(CONTROL_PANEL_ID)}
          >
            工具(T)
          </button>
          <button
            type="button"
            className="w2k-menubar-item"
            onClick={() => onLaunchApp('about')}
          >
            帮助(H)
          </button>
        </div>

        {/* Authentic Windows 2000 right-hand logo throbber box */}
        <Win2kThrobber size={22} loading={throbberActive} />
      </div>

      {/* Row 2: Standard Buttons Toolbar (Authentic browse-ui-icons sprites) */}
      <div className="flex items-center gap-[1px] px-1 py-[2px] border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)] flex-wrap">
        <div className="w2k-gripper mr-0.5" />
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!canBack}
          onClick={handleBack}
          aria-label="后退"
        >
          <Win2kBrowseIcon sprite="back" disabled={!canBack} />
          <span>后退</span>
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!canForward}
          onClick={handleForward}
          aria-label="前进"
        >
          <Win2kBrowseIcon sprite="forward" disabled={!canForward} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!parentId}
          onClick={handleUp}
          aria-label="向上"
        >
          <Win2kBrowseIcon sprite="up" disabled={!parentId} />
        </button>

        <div className="w2k-divider-v mx-0.5" />

        <button
          type="button"
          className={`w2k-toolbar-btn ${leftBarMode === 'search' ? 'active' : ''}`}
          onClick={() => setLeftBarMode((m) => (m === 'search' ? 'webview' : 'search'))}
          aria-label="搜索"
        >
          <Win2kBrowseIcon sprite="find" />
          <span>搜索</span>
        </button>
        <button
          type="button"
          className={`w2k-toolbar-btn ${leftBarMode === 'folders' ? 'active' : ''}`}
          onClick={() => setLeftBarMode((m) => (m === 'folders' ? 'webview' : 'folders'))}
          aria-label="文件夹"
        >
          <Win2kBrowseIcon sprite="folders" />
          <span>文件夹</span>
        </button>

        <div className="w2k-divider-v mx-0.5" />

        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!canMutateSelected}
          onClick={handleCut}
          aria-label="剪切"
          title="剪切"
        >
          <Win2kBrowseIcon sprite="cut" disabled={!canMutateSelected} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!canMutateSelected}
          onClick={handleCopy}
          aria-label="复制"
          title="复制"
        >
          <Win2kBrowseIcon sprite="copy" disabled={!canMutateSelected} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!clipboard || isVirtualRoot}
          onClick={handlePaste}
          aria-label="粘贴"
          title="粘贴"
        >
          <Win2kBrowseIcon sprite="paste" disabled={!clipboard || isVirtualRoot} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!undoVfs}
          onClick={handleUndo}
          aria-label="撤消"
          title="撤消"
        >
          <Win2kBrowseIcon sprite="undo" disabled={!undoVfs} />
        </button>

        <div className="w2k-divider-v mx-0.5" />

        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!canMutateSelected}
          onClick={handleDeleteSelected}
          aria-label="删除"
          title="删除"
        >
          <Win2kBrowseIcon sprite="delete" disabled={!canMutateSelected} />
        </button>
        <button
          type="button"
          className="w2k-toolbar-btn"
          disabled={!selectedNode}
          onClick={() => selectedNode && setPropsNodeId(selectedNode.id)}
          aria-label="属性"
          title="属性"
        >
          <Win2kBrowseIcon sprite="properties" disabled={!selectedNode} />
        </button>

        <div className="w2k-divider-v mx-0.5" />

        <button
          type="button"
          className="w2k-toolbar-btn"
          onClick={() =>
            setViewMode((v) => (v === 'icons' ? 'list' : v === 'list' ? 'details' : 'icons'))
          }
          aria-label="切换查看方式"
        >
          <Win2kBrowseIcon
            sprite={
              viewMode === 'icons'
                ? 'viewIcons'
                : viewMode === 'list'
                ? 'viewList'
                : 'viewDetails'
            }
          />
          <span>查看</span>
        </button>

        {!isVirtualRoot && (
          <button
            type="button"
            className="w2k-toolbar-btn"
            onClick={handleCreateFolder}
            aria-label="新建文件夹"
          >
            <Win2kBrowseIcon sprite="newFolder" />
            <span>新建</span>
          </button>
        )}

        {currentId === RECYCLE_BIN_ID && (
          <>
            <button
              type="button"
              className="w2k-toolbar-btn"
              disabled={children.length === 0}
              onClick={handleEmptyRecycleBin}
            >
              <span>清空回收站</span>
            </button>
            <button
              type="button"
              className="w2k-toolbar-btn"
              disabled={!selectedNode}
              onClick={handleRestoreSelected}
            >
              <span>还原</span>
            </button>
          </>
        )}
      </div>

      {/* Row 3: Address Bar (地址) */}
      <div className="flex items-center gap-1.5 px-1.5 py-[2px] border-b border-[var(--w2k-shadow)]">
        <div className="w2k-gripper" />
        <span className="text-[11px] text-[#404040] shrink-0">地址(D)</span>
        <div className="w2k-input flex-1 h-[22px] flex items-center gap-1.5 px-1 py-0">
          <Win2kIcon kind={activeAddressMeta.icon} size={16} />
          <select
            aria-label="地址栏"
            className="bg-transparent border-0 outline-none flex-1 text-[12px] font-inherit h-full cursor-default"
            value={addressLocations.some((a) => a.id === currentId) ? currentId : ''}
            onChange={(e) => {
              if (e.target.value) navigateTo(e.target.value);
            }}
          >
            {!addressLocations.some((a) => a.id === currentId) && (
              <option value="">{getDisplayPath(vfs, currentId)}</option>
            )}
            {addressLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="w2k-go-btn"
          onClick={() => navigateTo(currentId)}
          aria-label="转到"
        >
          <span className="w2k-go-icon" aria-hidden="true" />
          <span>转到</span>
        </button>
      </div>

      {/* Main Split Pane */}
      <div className="flex-1 min-h-0 flex bg-[var(--w2k-window-bg)] w2k-inset m-[2px]">
        {/* Left Pane: Folders Tree OR Search OR Authentic Win2K Web View */}
        {leftBarMode === 'folders' ? (
          <aside
            aria-label="文件夹树"
            className="w-[200px] shrink-0 border-r border-[var(--w2k-shadow)] bg-white flex flex-col min-h-0"
          >
            <div className="bg-[var(--w2k-face)] px-2 py-[2px] border-b border-[var(--w2k-shadow)] flex items-center justify-between text-[11px]">
              <span>文件夹</span>
              <button
                type="button"
                aria-label="关闭文件夹栏"
                onClick={() => setLeftBarMode('webview')}
                className="bg-transparent border-0 p-0 text-[11px] leading-none cursor-default"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto w2k-scroll py-1">
              {renderTreeNode(MY_DOCS_ID, 0)}
              {renderTreeNode(ROOT_ID, 0)}
              {renderTreeNode(NETWORK_ID, 0)}
              {renderTreeNode(RECYCLE_BIN_ID, 0)}
            </div>
          </aside>
        ) : leftBarMode === 'search' ? (
          <aside
            aria-label="搜索文件栏"
            className="w-[200px] shrink-0 border-r border-[var(--w2k-shadow)] bg-[#F5F4F0] flex flex-col min-h-0"
          >
            <div className="bg-[var(--w2k-face)] px-2 py-[2px] border-b border-[var(--w2k-shadow)] flex items-center justify-between text-[11px]">
              <span>搜索结果</span>
              <button
                type="button"
                aria-label="关闭搜索栏"
                onClick={() => setLeftBarMode('webview')}
                className="bg-transparent border-0 p-0 text-[11px] leading-none cursor-default"
              >
                ×
              </button>
            </div>
            <div className="p-2.5 space-y-2 border-b border-[#D4D0C8]">
              <label htmlFor="explorer-search" className="block text-[11px] font-bold">
                要搜索的文件或文件夹名为(M):
              </label>
              <input
                id="explorer-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="例如: readme 或 计划"
                className="w2k-input w-full"
              />
            </div>
            <div className="flex-1 overflow-y-auto w2k-scroll p-2 space-y-1">
              {!searchQuery.trim() ? (
                <div className="text-[11px] text-[#606060]">
                  输入关键字以在“我的电脑”和“网上邻居”中实时检索文档与文件夹。
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-[11px] text-[#606060]">未找到匹配的项目。</div>
              ) : (
                searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleOpenItem(res)}
                    className="w-full flex items-center gap-1.5 text-left px-1 py-1 bg-transparent border-0 hover:bg-[#0A246A] hover:text-white text-[11px] cursor-default"
                  >
                    <Win2kIcon kind={res.icon ?? 'text-file'} size={16} />
                    <span className="truncate">{res.name}</span>
                  </button>
                ))
              )}
            </div>
          </aside>
        ) : (
          <aside className="w-[202px] shrink-0 border-r border-[#D4D0C8] bg-white flex flex-col gap-2.5 overflow-y-auto overflow-x-hidden hidden sm:flex relative">
            {/* Real Windows 2000 Web View top-left corner artwork (wvleft) */}
            <div className="relative w-full shrink-0 pt-2">
              <div
                className="w-[200px] h-[48px] bg-no-repeat relative"
                style={{
                  backgroundImage: 'url(/win2k-ui/webview-banner.png)',
                  imageRendering: 'pixelated',
                }}
              >
                <div className="absolute left-[14px] top-[7px]">
                  <Win2kIcon kind={currentNode.icon ?? 'folder'} size={32} />
                </div>
              </div>
              <div className="px-3 text-[15px] font-bold text-black leading-tight mt-1">
                {currentNode.name}
              </div>
              {/* Signature Windows 2000 horizontal multi-color line */}
              <div
                className="h-[3px] mx-3 my-1.5"
                style={{
                  background:
                    'linear-gradient(90deg, #E35D25 0%, #3AB54A 28%, #0078D7 58%, #FFB900 80%, transparent 100%)',
                }}
              />
            </div>

            {renderWebViewSideDescription()}
          </aside>
        )}

        {/* Right File/Folder View */}
        <div
          className="flex-1 min-w-0 p-3 overflow-y-auto w2k-scroll"
          onClick={() => setSelectedId(null)}
        >
          {currentId === CONTROL_PANEL_ID ? (
            <div className="flex flex-wrap gap-4 content-start">
              {controlPanelApplets.map((applet) => (
                <button
                  key={applet.id}
                  type="button"
                  onClick={applet.action}
                  className="w-[104px] p-2 flex flex-col items-center gap-1.5 bg-transparent border border-transparent hover:border-[#A6CAF0] hover:bg-[#EEF4FC] cursor-default text-center"
                >
                  <Win2kIcon kind={applet.icon} size={32} />
                  <span className="text-[12px] text-black">{applet.name}</span>
                </button>
              ))}
            </div>
          ) : children.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#808080] text-[12px]">
              此文件夹为空。
            </div>
          ) : viewMode === 'icons' ? (
            <div className="flex flex-wrap gap-3 content-start">
              {children.map((item) => {
                const isSel = selectedId === item.id;
                const isRen = renamingId === item.id;
                const isCut = clipboard?.mode === 'cut' && clipboard.nodeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(item.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item);
                    }}
                    className={`w-[92px] p-1.5 flex flex-col items-center gap-1 bg-transparent border-0 cursor-default ${
                      isSel ? 'outline-1 outline-dotted outline-[#0A246A]' : ''
                    } ${isCut ? 'opacity-50' : ''}`}
                  >
                    <Win2kIcon
                      kind={item.icon ?? (item.type === 'folder' ? 'folder' : 'text-file')}
                      size={32}
                    />
                    {isRen ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w2k-input w-full text-center text-[11px] px-0.5 py-0"
                      />
                    ) : (
                      <span
                        className={`text-[12px] leading-tight text-center break-words px-1 ${
                          isSel
                            ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                            : 'text-[var(--w2k-window-text)]'
                        }`}
                      >
                        {item.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            <div className="flex flex-col flex-wrap max-h-full gap-x-6 gap-y-1 content-start">
              {children.map((item) => {
                const isSel = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(item.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item);
                    }}
                    className={`w-[220px] flex items-center gap-1.5 px-1 py-0.5 text-left border-0 cursor-default ${
                      isSel
                        ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                        : 'bg-transparent text-black'
                    }`}
                  >
                    <Win2kIcon
                      kind={item.icon ?? (item.type === 'folder' ? 'folder' : 'text-file')}
                      size={16}
                    />
                    <span className="truncate text-[12px]">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[var(--w2k-face)] text-left border-b border-[var(--w2k-shadow)]">
                  <th className="py-1 px-2 font-normal border-r border-[var(--w2k-shadow)]">名称</th>
                  <th className="py-1 px-2 font-normal border-r border-[var(--w2k-shadow)] w-[90px]">
                    大小
                  </th>
                  <th className="py-1 px-2 font-normal border-r border-[var(--w2k-shadow)] w-[100px]">
                    类型
                  </th>
                  <th className="py-1 px-2 font-normal w-[130px]">修改时间</th>
                </tr>
              </thead>
              <tbody>
                {children.map((item) => {
                  const isSel = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleOpenItem(item);
                      }}
                      className={`cursor-default ${
                        isSel
                          ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                          : 'hover:bg-[#F3F6FA]'
                      }`}
                    >
                      <td className="py-0.5 px-2 flex items-center gap-1.5">
                        <Win2kIcon
                          kind={item.icon ?? (item.type === 'folder' ? 'folder' : 'text-file')}
                          size={16}
                        />
                        <span className="truncate">{item.name}</span>
                      </td>
                      <td className="py-0.5 px-2 tabular-nums">
                        {item.size !== undefined ? `${item.size} 字节` : ''}
                      </td>
                      <td className="py-0.5 px-2">
                        {item.type === 'drive'
                          ? '驱动器'
                          : item.type === 'folder'
                          ? '文件夹'
                          : item.type === 'virtual'
                          ? '系统项目'
                          : item.mimeKind === 'image'
                          ? '位图图像'
                          : item.mimeKind === 'video'
                          ? '视频剪辑'
                          : '文本文档'}
                      </td>
                      <td className="py-0.5 px-2 tabular-nums">{item.modifiedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-1 px-1 py-[2px] text-[11px]">
        <div className="w2k-sunken-bar px-2 py-[1px] flex-1 truncate">
          {currentId === CONTROL_PANEL_ID
            ? `${controlPanelApplets.length} 个对象`
            : `${children.length} 个对象`}
          {selectedNode ? `  (已选择 "${selectedNode.name}")` : ''}
          {clipboard ? `  [剪贴板: ${vfs[clipboard.nodeId]?.name ?? ''}]` : ''}
        </div>
        <div className="w2k-sunken-bar px-2 py-[1px] w-[140px] truncate hidden sm:flex items-center gap-1.5">
          <Win2kIcon kind={currentNode.icon ?? 'my-computer'} size={16} />
          <span className="truncate">{currentNode.name}</span>
        </div>
      </div>

      {/* Add Network Place Modal */}
      {showAddNetworkModal && (
        <div
          className="absolute inset-0 bg-black/15 flex items-center justify-center z-40"
          onClick={() => setShowAddNetworkModal(false)}
        >
          <form
            className="w2k-window-frame w-[340px]"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddNetworkPlaceSubmit}
          >
            <div className="w2k-titlebar">
              <span>添加网上邻居向导</span>
              <button
                type="button"
                className="w2k-win-btn"
                aria-label="关闭添加网上邻居"
                onClick={() => setShowAddNetworkModal(false)}
              >
                <img src="/icons/ui/win-close.svg" alt="" className="w-[8px] h-[7px]" />
              </button>
            </div>
            <div className="p-3 bg-[var(--w2k-face)] space-y-3 text-[12px]">
              <div className="flex items-start gap-2.5">
                <Win2kIcon kind="add-network" size={32} />
                <div>请输入要添加的共享文件夹或网络位置路径:</div>
              </div>
              <input
                type="text"
                value={newNetSharePath}
                onChange={(e) => setNewNetSharePath(e.target.value)}
                className="w2k-input w-full"
                aria-label="网络路径"
              />
              <div className="flex justify-end gap-2">
                <button type="submit" className="w2k-btn default-btn">
                  确定
                </button>
                <button
                  type="button"
                  className="w2k-btn"
                  onClick={() => setShowAddNetworkModal(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Properties Modal */}
      {propsNode && (
        <div
          className="absolute inset-0 bg-black/15 flex items-center justify-center z-40"
          onClick={() => setPropsNodeId(null)}
        >
          <div
            className="w2k-window-frame w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w2k-titlebar">
              <span>{propsNode.name} 属性</span>
              <button
                type="button"
                className="w2k-win-btn"
                aria-label="关闭属性"
                onClick={() => setPropsNodeId(null)}
              >
                <img src="/icons/ui/win-close.svg" alt="" className="w-[8px] h-[7px]" />
              </button>
            </div>
            <div className="p-3 bg-[var(--w2k-face)] space-y-2.5 text-[12px]">
              <div className="flex items-center gap-3 pb-2 border-b border-[var(--w2k-shadow)]">
                <Win2kIcon kind={propsNode.icon ?? 'folder'} size={32} />
                <div className="font-bold truncate">{propsNode.name}</div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div>
                  类型:{' '}
                  {propsNode.type === 'drive'
                    ? '本地磁盘 (NTFS)'
                    : propsNode.type === 'folder'
                    ? '文件夹'
                    : '文件'}
                </div>
                <div>位置: {getDisplayPath(vfs, propsNode.id)}</div>
                {propsNode.size !== undefined && <div>大小: {propsNode.size} 字节</div>}
                <div>修改时间: {propsNode.modifiedAt}</div>
                {propsNode.totalSpaceMB && (
                  <div>
                    容量: {propsNode.totalSpaceMB} MB (可用 {propsNode.freeSpaceMB} MB)
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  className="w2k-btn default-btn"
                  onClick={() => setPropsNodeId(null)}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
