export type BinaryOp = '+' | '-' | '*' | '/';

export interface CalcState {
  display: string;
  accumulator: number | null;
  pendingOp: BinaryOp | null;
  waitingForOperand: boolean;
  memory: number;
  error: boolean;
}

export function createCalcState(): CalcState {
  return {
    display: '0',
    accumulator: null,
    pendingOp: null,
    waitingForOperand: true,
    memory: 0,
    error: false,
  };
}

function formatResult(num: number): string {
  if (!Number.isFinite(num)) return '错误';
  const rounded = parseFloat(num.toPrecision(12));
  return String(rounded);
}

function applyBinary(left: number, right: number, op: BinaryOp): number | '错误' {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return right === 0 ? '错误' : left / right;
  }
}

export function calcInputDigit(state: CalcState, digit: string): CalcState {
  if (state.error) {
    return {
      ...createCalcState(),
      memory: state.memory,
      display: digit === '.' ? '0.' : digit,
      waitingForOperand: false,
    };
  }
  if (state.waitingForOperand) {
    return {
      ...state,
      display: digit === '.' ? '0.' : digit,
      waitingForOperand: false,
    };
  }
  if (digit === '.' && state.display.includes('.')) return state;
  const next = state.display === '0' && digit !== '.' ? digit : state.display + digit;
  return {
    ...state,
    display: next.slice(0, 18),
  };
}

export function calcBackspace(state: CalcState): CalcState {
  if (state.error || state.waitingForOperand) return state;
  if (state.display.length <= 1 || (state.display.length === 2 && state.display.startsWith('-'))) {
    return { ...state, display: '0' };
  }
  return { ...state, display: state.display.slice(0, -1) };
}

export function calcClearEntry(state: CalcState): CalcState {
  return {
    ...state,
    display: '0',
    waitingForOperand: true,
    error: false,
  };
}

export function calcClearAll(state: CalcState): CalcState {
  return {
    ...createCalcState(),
    memory: state.memory,
  };
}

export function calcToggleSign(state: CalcState): CalcState {
  if (state.error || state.display === '0') return state;
  return {
    ...state,
    display: state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`,
  };
}

export function calcBinaryOp(state: CalcState, nextOp: BinaryOp): CalcState {
  if (state.error) return state;
  const current = parseFloat(state.display);
  if (state.accumulator !== null && state.pendingOp && !state.waitingForOperand) {
    const res = applyBinary(state.accumulator, current, state.pendingOp);
    if (res === '错误') {
      return { ...state, display: '除数不能为零。', error: true, accumulator: null, pendingOp: null };
    }
    return {
      ...state,
      display: formatResult(res),
      accumulator: res,
      pendingOp: nextOp,
      waitingForOperand: true,
    };
  }
  return {
    ...state,
    accumulator: current,
    pendingOp: nextOp,
    waitingForOperand: true,
  };
}

export function calcEquals(state: CalcState): CalcState {
  if (state.error) return state;
  if (state.accumulator === null || !state.pendingOp) {
    return { ...state, waitingForOperand: true };
  }
  const right = parseFloat(state.display);
  const res = applyBinary(state.accumulator, right, state.pendingOp);
  if (res === '错误') {
    return {
      ...state,
      display: '除数不能为零。',
      error: true,
      accumulator: null,
      pendingOp: null,
      waitingForOperand: true,
    };
  }
  return {
    ...state,
    display: formatResult(res),
    accumulator: null,
    pendingOp: null,
    waitingForOperand: true,
  };
}

export function calcUnary(state: CalcState, op: 'sqrt' | 'recip' | 'percent'): CalcState {
  if (state.error) return state;
  const current = parseFloat(state.display);
  if (op === 'sqrt') {
    if (current < 0) {
      return { ...state, display: '函数输入无效。', error: true, waitingForOperand: true };
    }
    return { ...state, display: formatResult(Math.sqrt(current)), waitingForOperand: true };
  }
  if (op === 'recip') {
    if (current === 0) {
      return { ...state, display: '除数不能为零。', error: true, waitingForOperand: true };
    }
    return { ...state, display: formatResult(1 / current), waitingForOperand: true };
  }
  // percent
  const base = state.accumulator ?? 0;
  return {
    ...state,
    display: formatResult((base * current) / 100),
    waitingForOperand: true,
  };
}

export function calcMemory(state: CalcState, action: 'MC' | 'MR' | 'MS' | 'M+'): CalcState {
  if (state.error && action !== 'MC') return state;
  const current = parseFloat(state.display) || 0;
  switch (action) {
    case 'MC':
      return { ...state, memory: 0 };
    case 'MR':
      return { ...state, display: formatResult(state.memory), waitingForOperand: true };
    case 'MS':
      return { ...state, memory: current, waitingForOperand: true };
    case 'M+':
      return { ...state, memory: state.memory + current, waitingForOperand: true };
  }
}
