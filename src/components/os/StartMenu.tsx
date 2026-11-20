import React, { useState } from 'react';
import type { AppId, IconKind, VfsNode, WindowState } from '../../types/os';
import { MY_DOCS_ID, listChildren } from '../../core/vfs';
import { getAppForVfsNode } from '../../core/mediaCatalog';
import { Win2kIcon } from '../icons/Win2kIcons';
import { PixelArrowRight } from '../icons/Win2kPixelGlyphs';

interface StartMenuProps {
  open: boolean;
  vfs: Record<string, VfsNode>;
  onClose: () => void;
  onLaunchApp: (appId: AppId, payload?: WindowState['payload']) => void;
}

type SubMenuKey = 'programs' | 'accessories' | 'games' | 'documents' | 'settings' | null;

export const StartMenu: React.FC<StartMenuProps> = ({ open, vfs, onClose, onLaunchApp }) => {
  const [hovered, setHovered] = useState<SubMenuKey>(null);

  if (!open) return null;

  const recentDocs = listChildren(vfs, MY_DOCS_ID).filter((n) => n.type === 'file');

  const launch = (appId: AppId, payload?: WindowState['payload']) => {
    onLaunchApp(appId, payload);
    setHovered(null);
    onClose();
  };

  const renderMenuRow = (
    label: string,
    icon: IconKind,
    onClick?: () => void,
    hasArrow?: boolean,
    onHover?: () => void
  ) => (
    <button
      type="button"
      className="w-full flex items-center justify-between px-2 py-[5px] text-left text-[12px] hover:bg-[var(--w2k-selection-bg)] hover:text-[var(--w2k-selection-text)] cursor-default bg-transparent border-0"
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Win2kIcon kind={icon} size={24} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {hasArrow && <PixelArrowRight className="ml-3 mr-0.5" />}
    </button>
  );

  const renderSubRow = (
    label: string,
    icon: IconKind,
    onClick: () => void,
    hasArrow?: boolean,
    onHover?: () => void
  ) => (
    <button
      type="button"
      className="w-full flex items-center justify-between px-2 py-[3px] text-left text-[12px] hover:bg-[var(--w2k-selection-bg)] hover:text-[var(--w2k-selection-text)] cursor-default bg-transparent border-0"
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Win2kIcon kind={icon} size={16} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {hasArrow && <PixelArrowRight className="ml-3 mr-0.5" />}
    </button>
  );

  return (
    <nav
      aria-label="开始菜单"
      className="w2k-window-frame absolute bottom-[28px] left-0 z-[9500] flex p-[2px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Authentic Windows 2000 Professional vertical sidebar bitmap (ntstrtbk.bmp, 21x233) */}
      <div
        className="w2k-start-banner"
        aria-label="Windows 2000 Professional"
      />

      {/* Main Start Menu Items */}
      <div className="w-[184px] flex flex-col bg-[var(--w2k-menu-bg)] relative">
        {renderMenuRow(
          'Windows Update',
          'windows-update',
          () => launch('ie', { initialUrl: 'http://windowsupdate.microsoft.com' }),
          false,
          () => setHovered(null)
        )}
        <div className="w2k-menu-sep" />

        {/* Programs */}
        <div
          className="relative"
          onMouseEnter={() => setHovered('programs')}
        >
          {renderMenuRow(
            '程序(P)',
            'programs',
            () => setHovered('programs'),
            true,
            () => setHovered('programs')
          )}
          {(hovered === 'programs' || hovered === 'accessories' || hovered === 'games') && (
            <div className="w2k-menu-popup absolute left-full top-0 w-[176px] z-10">
              <div
                className="relative"
                onMouseEnter={() => setHovered('accessories')}
              >
                {renderSubRow('附件(A)', 'programs', () => setHovered('accessories'), true)}
                {hovered === 'accessories' && (
                  <div className="w2k-menu-popup absolute left-full top-0 w-[184px] z-20">
                    {renderSubRow('记事本', 'notepad', () => launch('notepad'))}
                    {renderSubRow('画图', 'paint', () => launch('paint'))}
                    {renderSubRow('图像处理', 'imaging', () => launch('imaging'))}
                    {renderSubRow('Windows Media Player', 'mplayer', () => launch('mplayer'))}
                    {renderSubRow('计算器', 'calculator', () => launch('calculator'))}
                    {renderSubRow('命令提示符', 'cmd', () => launch('cmd'))}
                    {renderSubRow('Windows 资源管理器', 'my-computer', () =>
                      launch('explorer', { path: 'my-computer' })
                    )}
                    <div className="w2k-menu-sep" />
                    {renderSubRow('Royal Hawaii', 'royal-hawaii', () => launch('royal-hawaii'))}
                    {renderSubRow('棕榈浴场', 'palm-bath', () => launch('palm-bath'))}
                    <div className="w2k-menu-sep" />
                    {renderSubRow('系统工具 - 任务管理器', 'taskmgr', () => launch('taskmgr'))}
                  </div>
                )}
              </div>

              <div
                className="relative"
                onMouseEnter={() => setHovered('games')}
              >
                {renderSubRow('游戏(G)', 'programs', () => setHovered('games'), true)}
                {hovered === 'games' && (
                  <div className="w2k-menu-popup absolute left-full top-0 w-[140px] z-20">
                    {renderSubRow('扫雷', 'minesweeper', () => launch('minesweeper'))}
                  </div>
                )}
              </div>

              <div className="w2k-menu-sep" />
              {renderSubRow('Internet Explorer', 'ie', () => launch('ie'))}
              {renderSubRow('图像处理', 'imaging', () => launch('imaging'))}
              {renderSubRow('Windows Media Player', 'mplayer', () => launch('mplayer'))}
              {renderSubRow('命令提示符', 'cmd', () => launch('cmd'))}
              {renderSubRow('记事本', 'notepad', () => launch('notepad'))}
              {renderSubRow('Royal Hawaii', 'royal-hawaii', () => launch('royal-hawaii'))}
              {renderSubRow('棕榈浴场', 'palm-bath', () => launch('palm-bath'))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div
          className="relative"
          onMouseEnter={() => setHovered('documents')}
        >
          {renderMenuRow('文档(D)', 'my-documents', () => launch('explorer', { path: MY_DOCS_ID }), true)}
          {hovered === 'documents' && (
            <div className="w2k-menu-popup absolute left-full top-0 w-[210px] z-10">
              {renderSubRow('我的文档', 'my-documents', () =>
                launch('explorer', { path: MY_DOCS_ID })
              )}
              {renderSubRow('我的图片', 'folder', () =>
                launch('explorer', { path: 'doc-pics' })
              )}
              {renderSubRow('我的视频', 'folder', () =>
                launch('explorer', { path: 'doc-videos' })
              )}
              <div className="w2k-menu-sep" />
              {recentDocs.length === 0 ? (
                <div className="px-3 py-1 text-[12px] text-[var(--w2k-shadow)]">(空)</div>
              ) : (
                recentDocs.map((doc) => {
                  const assoc = getAppForVfsNode(doc);
                  return (
                    <React.Fragment key={doc.id}>
                      {renderSubRow(doc.name, doc.icon ?? 'text-file', () =>
                        launch(assoc.appId, {
                          fileId: doc.id,
                          fileName: doc.name,
                          mediaId: doc.mediaId,
                          autoPlay: assoc.appId === 'mplayer',
                        })
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <div
          className="relative"
          onMouseEnter={() => setHovered('settings')}
        >
          {renderMenuRow(
            '设置(S)',
            'control-panel',
            () => setHovered('settings'),
            true
          )}
          {hovered === 'settings' && (
            <div className="w2k-menu-popup absolute left-full top-0 w-[184px] z-10">
              {renderSubRow('控制面板(C)', 'control-panel', () =>
                launch('explorer', { path: 'control-panel' })
              )}
              {renderSubRow('网络和拨号连接(N)', 'network', () =>
                launch('explorer', { path: 'network-places' })
              )}
              {renderSubRow('显示属性(D)', 'display', () => launch('display'))}
              {renderSubRow('系统属性(Y)', 'system', () => launch('system'))}
            </div>
          )}
        </div>

        {renderMenuRow(
          '搜索(C)',
          'search',
          () => launch('explorer', { path: 'drive-c' }),
          false,
          () => setHovered(null)
        )}
        {renderMenuRow(
          '帮助(H)',
          'help',
          () => launch('help'),
          false,
          () => setHovered(null)
        )}
        {renderMenuRow(
          '运行(R)...',
          'run',
          () => launch('run'),
          false,
          () => setHovered(null)
        )}

        <div className="w2k-menu-sep" />

        {renderMenuRow(
          '注销 Administrator(L)...',
          'logoff',
          () => launch('shutdown', { initialTab: 'logoff' }),
          false,
          () => setHovered(null)
        )}
        {renderMenuRow(
          '关机(U)...',
          'shutdown',
          () => launch('shutdown'),
          false,
          () => setHovered(null)
        )}
      </div>
    </nav>
  );
};
