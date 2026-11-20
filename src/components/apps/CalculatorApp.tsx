import React, { useState } from 'react';
import {
  BinaryOp,
  calcBackspace,
  calcBinaryOp,
  calcClearAll,
  calcClearEntry,
  calcEquals,
  calcInputDigit,
  calcMemory,
  calcToggleSign,
  calcUnary,
  createCalcState,
} from '../../core/calculator';

export const CalculatorApp: React.FC = () => {
  const [calc, setCalc] = useState(createCalcState);

  const btnCls = 'w2k-btn h-[26px] min-h-0 px-0 font-normal text-[12px]';

  return (
    <div className="flex-1 flex flex-col bg-[var(--w2k-face)]">
      {/* Menu Bar */}
      <div className="w2k-menubar">
        <span className="w2k-menubar-item">编辑(E)</span>
        <span className="w2k-menubar-item">查看(V)</span>
        <span className="w2k-menubar-item">帮助(H)</span>
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {/* LCD Readout */}
        <div
          aria-label="计算器显示屏"
          className="w2k-inset bg-white text-black px-2 py-1 text-right text-[14px] font-mono tabular-nums truncate"
        >
          {calc.display}
        </div>

        {/* Top Control Row: Memory indicator + Backspace / CE / C */}
        <div className="grid grid-cols-6 gap-1.5">
          <div className="w2k-inset-shallow flex items-center justify-center text-[11px] font-bold text-black bg-[var(--w2k-face)]">
            {calc.memory !== 0 ? 'M' : ''}
          </div>
          <button
            type="button"
            className={`${btnCls} col-span-2 text-[#800000]`}
            onClick={() => setCalc((c) => calcBackspace(c))}
          >
            Backspace
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#800000]`}
            onClick={() => setCalc((c) => calcClearEntry(c))}
          >
            CE
          </button>
          <button
            type="button"
            className={`${btnCls} col-span-2 text-[#800000]`}
            onClick={() => setCalc((c) => calcClearAll(c))}
          >
            C
          </button>
        </div>

        {/* Main Keypad (6 columns: Mem + 3 digits + op + unary) */}
        <div className="grid grid-cols-6 gap-1.5">
          {/* Row 1 */}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcMemory(c, 'MC'))}
          >
            MC
          </button>
          {['7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              className={`${btnCls} text-[#0000FF]`}
              onClick={() => setCalc((c) => calcInputDigit(c, d))}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcBinaryOp(c, '/'))}
          >
            /
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#000080]`}
            onClick={() => setCalc((c) => calcUnary(c, 'sqrt'))}
          >
            sqrt
          </button>

          {/* Row 2 */}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcMemory(c, 'MR'))}
          >
            MR
          </button>
          {['4', '5', '6'].map((d) => (
            <button
              key={d}
              type="button"
              className={`${btnCls} text-[#0000FF]`}
              onClick={() => setCalc((c) => calcInputDigit(c, d))}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcBinaryOp(c, '*'))}
          >
            *
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#000080]`}
            onClick={() => setCalc((c) => calcUnary(c, 'percent'))}
          >
            %
          </button>

          {/* Row 3 */}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcMemory(c, 'MS'))}
          >
            MS
          </button>
          {['1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              className={`${btnCls} text-[#0000FF]`}
              onClick={() => setCalc((c) => calcInputDigit(c, d))}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcBinaryOp(c, '-'))}
          >
            -
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#000080]`}
            onClick={() => setCalc((c) => calcUnary(c, 'recip'))}
          >
            1/x
          </button>

          {/* Row 4 */}
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcMemory(c, 'M+'))}
          >
            M+
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#0000FF]`}
            onClick={() => setCalc((c) => calcInputDigit(c, '0'))}
          >
            0
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#0000FF]`}
            onClick={() => setCalc((c) => calcToggleSign(c))}
          >
            +/-
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#0000FF]`}
            onClick={() => setCalc((c) => calcInputDigit(c, '.'))}
          >
            .
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#FF0000]`}
            onClick={() => setCalc((c) => calcBinaryOp(c, '+' as BinaryOp))}
          >
            +
          </button>
          <button
            type="button"
            className={`${btnCls} text-[#FF0000] font-bold`}
            onClick={() => setCalc((c) => calcEquals(c))}
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
};
