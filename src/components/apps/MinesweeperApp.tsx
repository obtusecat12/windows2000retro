import React, { useEffect, useState } from 'react';
import {
  MINE_DIFFICULTIES,
  MineDifficulty,
  createEmptyBoard,
  cycleMark,
  revealCell,
} from '../../core/minesweeper';

interface MinesweeperAppProps {
  onClose: () => void;
  onResizeForDifficulty?: (w: number, h: number) => void;
}

const LedCounter: React.FC<{ value: number }> = ({ value }) => {
  const clamped = Math.max(-99, Math.min(999, value));
  const text =
    clamped < 0
      ? `-${String(Math.abs(clamped)).padStart(2, '0')}`
      : String(clamped).padStart(3, '0');

  return (
    <div
      className="bg-black border-t border-l border-[#808080] border-r border-b border-white p-[1px] flex items-center"
      aria-label={`计数器 ${text}`}
    >
      {text.split('').map((ch, idx) => {
        const bgPos = ch === '-' ? '-130px -32px' : `-${Number(ch) * 13}px -32px`;
        return (
          <span
            key={idx}
            aria-hidden="true"
            className="block w-[13px] h-[23px]"
            style={{
              backgroundImage: 'url(/icons/ui/winmine-sprite.png)',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: bgPos,
              imageRendering: 'pixelated',
            }}
          />
        );
      })}
    </div>
  );
};

export const MinesweeperApp: React.FC<MinesweeperAppProps> = ({
  onClose,
  onResizeForDifficulty,
}) => {
  const [difficulty, setDifficulty] = useState<MineDifficulty>('beginner');
  const [game, setGame] = useState(() => createEmptyBoard(MINE_DIFFICULTIES.beginner));
  const [allowQuestion, setAllowQuestion] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [mouseDownBoard, setMouseDownBoard] = useState(false);
  const [facePressed, setFacePressed] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const timer = window.setInterval(() => {
      setSeconds((s) => Math.min(999, s + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [game.status]);

  const startNewGame = (diff: MineDifficulty = difficulty) => {
    const cfg = MINE_DIFFICULTIES[diff];
    setDifficulty(diff);
    setGame(createEmptyBoard(cfg));
    setSeconds(0);
    setOpenMenu(null);
    if (onResizeForDifficulty) {
      const w = Math.max(220, cfg.cols * 16 + 44);
      const h = Math.max(270, cfg.rows * 16 + 124);
      onResizeForDifficulty(w, h);
    }
  };

  const remainingMines = game.config.mines - game.flagsCount;

  const faceBgPos = facePressed
    ? '-26px -55px'
    : game.status === 'lost'
    ? '-78px -55px'
    : game.status === 'won'
    ? '-104px -55px'
    : mouseDownBoard
    ? '-52px -55px'
    : '0px -55px';

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
            className={`w2k-menubar-item ${openMenu === 'game' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'game' ? null : 'game');
            }}
          >
            游戏(G)
          </button>
          {openMenu === 'game' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30">
              <button type="button" className="w2k-menu-item" onClick={() => startNewGame(difficulty)}>
                <span>开局(N)</span>
                <span className="text-[11px] opacity-70">F2</span>
              </button>
              <div className="w2k-menu-sep" />
              {(['beginner', 'intermediate', 'expert'] as MineDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => startNewGame(diff)}
                >
                  {difficulty === diff && <span className="absolute left-1.5">✓</span>}
                  <span>{MINE_DIFFICULTIES[diff].label}</span>
                </button>
              ))}
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setAllowQuestion((q) => !q);
                  setOpenMenu(null);
                }}
              >
                {allowQuestion && <span className="absolute left-1.5">✓</span>}
                <span>标记 (?)(M)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button type="button" className="w2k-menu-item" onClick={onClose}>
                <span>退出(X)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Outer Bevel */}
      <div className="p-2 flex-1 flex flex-col items-center justify-center overflow-auto">
        <div className="w2k-outset p-2 flex flex-col gap-2">
          {/* Header HUD */}
          <div className="w2k-inset-shallow bg-[var(--w2k-face)] px-2 py-1.5 flex items-center justify-between gap-2">
            <LedCounter value={remainingMines} />
            <button
              type="button"
              aria-label="重新开始扫雷"
              onMouseDown={() => setFacePressed(true)}
              onMouseUp={() => setFacePressed(false)}
              onMouseLeave={() => setFacePressed(false)}
              onClick={() => startNewGame(difficulty)}
              className="p-0 m-0 border-0 bg-transparent w-[26px] h-[26px] min-h-0 block shrink-0 cursor-default"
              style={{
                backgroundImage: 'url(/icons/ui/winmine-sprite.png)',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: faceBgPos,
                imageRendering: 'pixelated',
              }}
            />
            <LedCounter value={seconds} />
          </div>

          {/* Minefield Grid using authentic winmine-sprite.png 16x16 tiles */}
          <div
            className="border-t-2 border-l-2 border-[#808080] border-r-2 border-b-2 border-r-white border-b-white inline-grid"
            style={{
              gridTemplateColumns: `repeat(${game.config.cols}, 16px)`,
            }}
            onMouseLeave={() => setMouseDownBoard(false)}
          >
            {game.board.map((row, r) =>
              row.map((cell, c) => {
                if (cell.revealed) {
                  let bgPos = '-16px -16px';
                  if (cell.hasMine) {
                    bgPos = cell.exploded ? '-80px -16px' : '-32px -16px';
                  } else if (cell.adjacent > 0) {
                    bgPos = `-${(cell.adjacent - 1) * 16}px 0px`;
                  }
                  return (
                    <div
                      key={`${r}-${c}`}
                      className="w-[16px] h-[16px]"
                      style={{
                        backgroundImage: 'url(/icons/ui/winmine-sprite.png)',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: bgPos,
                        imageRendering: 'pixelated',
                      }}
                    />
                  );
                }

                const unrevealedPos =
                  cell.mark === 'flag'
                    ? '-48px -16px'
                    : cell.mark === 'question'
                    ? '-96px -16px'
                    : '0px -16px';

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    aria-label={`格子 ${r + 1}-${c + 1}`}
                    onMouseDown={(e) => {
                      if (e.button === 0) setMouseDownBoard(true);
                    }}
                    onMouseUp={() => setMouseDownBoard(false)}
                    onClick={() => setGame((prev) => revealCell(prev, r, c))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setGame((prev) => cycleMark(prev, r, c, allowQuestion));
                    }}
                    className="w-[16px] h-[16px] p-0 m-0 border-0 bg-transparent block cursor-default"
                    style={{
                      backgroundImage: 'url(/icons/ui/winmine-sprite.png)',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: unrevealedPos,
                      imageRendering: 'pixelated',
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
