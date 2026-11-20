import React, { useState } from 'react';
import type { VfsNode } from '../../types/os';
import { MY_DOCS_ID, createNode, updateFileContent } from '../../core/vfs';

interface NotepadAppProps {
  fileId?: string;
  fileName?: string;
  vfs: Record<string, VfsNode>;
  setVfs: React.Dispatch<React.SetStateAction<Record<string, VfsNode>>>;
  onUpdateTitle: (title: string) => void;
  onClose: () => void;
}

export const NotepadApp: React.FC<NotepadAppProps> = ({
  fileId: initialFileId,
  fileName: initialFileName,
  vfs,
  setVfs,
  onUpdateTitle,
  onClose,
}) => {
  const initialNode = initialFileId ? vfs[initialFileId] : undefined;
  const [currentFileId, setCurrentFileId] = useState<string | undefined>(initialNode?.id);
  const [currentName, setCurrentName] = useState<string>(
    initialNode?.name ?? initialFileName ?? '无标题'
  );
  const [text, setText] = useState<string>(initialNode?.content ?? '');
  const [dirty, setDirty] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState(
    currentName === '无标题' ? '新建文本文档.txt' : currentName
  );
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const updateCursor = (el: HTMLTextAreaElement) => {
    const upto = el.value.slice(0, el.selectionStart);
    const lines = upto.split('\n');
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const handleSave = () => {
    setOpenMenu(null);
    if (currentFileId && vfs[currentFileId]) {
      setVfs((prev) => updateFileContent(prev, currentFileId, text));
      setDirty(false);
      onUpdateTitle(`${currentName} - 记事本`);
    } else {
      setSaveAsName(currentName === '无标题' ? '新建文本文档.txt' : currentName);
      setSaveAsOpen(true);
    }
  };

  const handleSaveAsConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = saveAsName.trim() || '新建文本文档.txt';
    const { nextVfs, created } = createNode(vfs, MY_DOCS_ID, finalName, 'file', text);
    setVfs(nextVfs);
    setCurrentFileId(created.id);
    setCurrentName(created.name);
    setDirty(false);
    setSaveAsOpen(false);
    onUpdateTitle(`${created.name} - 记事本`);
  };

  const handleNew = () => {
    setCurrentFileId(undefined);
    setCurrentName('无标题');
    setText('');
    setDirty(false);
    setOpenMenu(null);
    onUpdateTitle('无标题 - 记事本');
  };

  const insertDateTime = () => {
    const now = new Date();
    const stamp = `${now.toTimeString().slice(0, 5)} ${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setText((prev) => prev + stamp);
    setDirty(true);
    setOpenMenu(null);
  };

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--w2k-face)] min-h-0 relative"
      onClick={() => setOpenMenu(null)}
    >
      {/* Menu Bar */}
      <div className="w2k-menubar relative">
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
              <button type="button" className="w2k-menu-item" onClick={handleNew}>
                <span>新建(N)</span>
                <span className="text-[11px] opacity-70">Ctrl+N</span>
              </button>
              <button type="button" className="w2k-menu-item" onClick={handleSave}>
                <span>保存(S)</span>
                <span className="text-[11px] opacity-70">Ctrl+S</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  setSaveAsOpen(true);
                }}
              >
                <span>另存为(A)...</span>
              </button>
              <div className="w2k-menu-sep" />
              <button type="button" className="w2k-menu-item" onClick={onClose}>
                <span>退出(X)</span>
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
              <button type="button" className="w2k-menu-item" onClick={insertDateTime}>
                <span>时间/日期(D)</span>
                <span className="text-[11px] opacity-70">F5</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'format' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'format' ? null : 'format');
            }}
          >
            格式(O)
          </button>
          {openMenu === 'format' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setWordWrap((w) => !w);
                  setOpenMenu(null);
                }}
              >
                {wordWrap && <span className="absolute left-1.5">✓</span>}
                <span>自动换行(W)</span>
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
                  setShowStatusBar((s) => !s);
                  setOpenMenu(null);
                }}
              >
                {showStatusBar && <span className="absolute left-1.5">✓</span>}
                <span>状态栏(S)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Text Editor Area */}
      <textarea
        aria-label="记事本文本区"
        value={text}
        wrap={wordWrap ? 'soft' : 'off'}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
          updateCursor(e.target);
        }}
        onClick={(e) => updateCursor(e.currentTarget)}
        onKeyUp={(e) => updateCursor(e.currentTarget)}
        className="w2k-inset w2k-scroll flex-1 w-full p-1.5 resize-none outline-none text-[14px] leading-[18px] w2k-cmd-font"
      />

      {/* Status Bar */}
      {showStatusBar && (
        <div className="flex items-center justify-between px-1 py-[2px] text-[11px]">
          <div className="w2k-sunken-bar px-2 py-[1px] flex-1">
            {dirty ? '已修改（请通过 文件 -> 保存 存至“我的文档”）' : '就绪'}
          </div>
          <div className="w2k-sunken-bar px-2 py-[1px] w-[140px] text-right tabular-nums">
            第 {cursorPos.line} 行，第 {cursorPos.col} 列
          </div>
        </div>
      )}

      {/* Save As Dialog */}
      {saveAsOpen && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-40">
          <form
            onSubmit={handleSaveAsConfirm}
            className="w2k-window-frame w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w2k-titlebar">
              <span>另存为（保存至 我的文档）</span>
              <button
                type="button"
                className="w2k-win-btn"
                onClick={() => setSaveAsOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="p-3 space-y-3 bg-[var(--w2k-face)]">
              <div className="flex items-center gap-2">
                <label className="shrink-0">文件名(N):</label>
                <input
                  type="text"
                  autoFocus
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  className="w2k-input flex-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" className="w2k-btn default-btn">
                  保存(S)
                </button>
                <button
                  type="button"
                  className="w2k-btn"
                  onClick={() => setSaveAsOpen(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
