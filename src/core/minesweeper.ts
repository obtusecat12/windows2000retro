export type MineDifficulty = 'beginner' | 'intermediate' | 'expert';

export interface MineConfig {
  rows: number;
  cols: number;
  mines: number;
  label: string;
}

export const MINE_DIFFICULTIES: Record<MineDifficulty, MineConfig> = {
  beginner: { rows: 9, cols: 9, mines: 10, label: '初级' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: '中级' },
  expert: { rows: 16, cols: 30, mines: 99, label: '高级' },
};

export type CellMark = 'none' | 'flag' | 'question';

export interface MineCell {
  row: number;
  col: number;
  hasMine: boolean;
  adjacent: number;
  revealed: boolean;
  mark: CellMark;
  exploded?: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface MinesweeperState {
  config: MineConfig;
  board: MineCell[][];
  status: GameStatus;
  minesPlaced: boolean;
  flagsCount: number;
  revealedCount: number;
}

export function createEmptyBoard(config: MineConfig): MinesweeperState {
  const board: MineCell[][] = [];
  for (let r = 0; r < config.rows; r++) {
    const row: MineCell[] = [];
    for (let c = 0; c < config.cols; c++) {
      row.push({
        row: r,
        col: c,
        hasMine: false,
        adjacent: 0,
        revealed: false,
        mark: 'none',
      });
    }
    board.push(row);
  }
  return {
    config,
    board,
    status: 'idle',
    minesPlaced: false,
    flagsCount: 0,
    revealedCount: 0,
  };
}

function getNeighbors(rows: number, cols: number, r: number, c: number): Array<[number, number]> {
  const res: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        res.push([nr, nc]);
      }
    }
  }
  return res;
}

export function placeMinesSafe(
  state: MinesweeperState,
  safeRow: number,
  safeCol: number,
  rng: () => number = Math.random
): MinesweeperState {
  const { rows, cols, mines } = state.config;
  const board = state.board.map((row) => row.map((cell) => ({ ...cell })));

  const candidates: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === safeRow && c === safeCol) continue;
      candidates.push([r, c]);
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const count = Math.min(mines, candidates.length);
  for (let i = 0; i < count; i++) {
    const [mr, mc] = candidates[i];
    board[mr][mc].hasMine = true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].hasMine) continue;
      let adj = 0;
      for (const [nr, nc] of getNeighbors(rows, cols, r, c)) {
        if (board[nr][nc].hasMine) adj++;
      }
      board[r][c].adjacent = adj;
    }
  }

  return {
    ...state,
    board,
    minesPlaced: true,
    status: 'playing',
  };
}

export function revealCell(
  inputState: MinesweeperState,
  row: number,
  col: number,
  rng: () => number = Math.random
): MinesweeperState {
  if (inputState.status === 'won' || inputState.status === 'lost') return inputState;

  let state = inputState.minesPlaced
    ? inputState
    : placeMinesSafe(inputState, row, col, rng);

  const cell = state.board[row]?.[col];
  if (!cell || cell.revealed || cell.mark === 'flag') return state;

  const board = state.board.map((r) => r.map((c) => ({ ...c })));
  const { rows, cols, mines } = state.config;

  if (board[row][col].hasMine) {
    board[row][col].revealed = true;
    board[row][col].exploded = true;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].hasMine) {
          board[r][c].revealed = true;
        }
      }
    }
    return {
      ...state,
      board,
      status: 'lost',
    };
  }

  let newlyRevealed = 0;
  const queue: Array<[number, number]> = [[row, col]];
  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!;
    const curr = board[cr][cc];
    if (curr.revealed || curr.mark === 'flag' || curr.hasMine) continue;
    curr.revealed = true;
    curr.mark = 'none';
    newlyRevealed++;
    if (curr.adjacent === 0) {
      for (const [nr, nc] of getNeighbors(rows, cols, cr, cc)) {
        if (!board[nr][nc].revealed && board[nr][nc].mark !== 'flag') {
          queue.push([nr, nc]);
        }
      }
    }
  }

  const totalRevealed = state.revealedCount + newlyRevealed;
  const safeCellsTotal = rows * cols - mines;
  const won = totalRevealed >= safeCellsTotal;

  if (won) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].hasMine) {
          board[r][c].mark = 'flag';
        }
      }
    }
  }

  return {
    ...state,
    board,
    revealedCount: totalRevealed,
    flagsCount: won ? mines : state.flagsCount,
    status: won ? 'won' : 'playing',
  };
}

export function cycleMark(
  state: MinesweeperState,
  row: number,
  col: number,
  allowQuestion: boolean
): MinesweeperState {
  if (state.status === 'won' || state.status === 'lost') return state;
  const cell = state.board[row]?.[col];
  if (!cell || cell.revealed) return state;

  const board = state.board.map((r) => r.map((c) => ({ ...c })));
  const target = board[row][col];
  let flagsCount = state.flagsCount;

  if (target.mark === 'none') {
    target.mark = 'flag';
    flagsCount++;
  } else if (target.mark === 'flag') {
    flagsCount--;
    target.mark = allowQuestion ? 'question' : 'none';
  } else {
    target.mark = 'none';
  }

  return {
    ...state,
    board,
    flagsCount,
    status: state.status === 'idle' ? 'playing' : state.status,
  };
}
