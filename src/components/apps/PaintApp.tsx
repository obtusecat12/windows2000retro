import React, { useEffect, useRef, useState } from 'react';

type PaintTool = 'pencil' | 'brush' | 'eraser' | 'fill' | 'picker' | 'line' | 'rect' | 'ellipse';

const PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
  '#808040', '#004040', '#0080FF', '#004080', '#8000FF', '#804000',
  '#FFFFFF', '#C0C0C0', '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF',
  '#FFFF80', '#00FF80', '#80FFFF', '#8080FF', '#FF0080', '#FF8040',
];

const TOOLS: Array<{ id: PaintTool; label: string; spriteIndex: number }> = [
  { id: 'eraser', label: '橡皮', spriteIndex: 2 },
  { id: 'fill', label: '用颜色填充', spriteIndex: 3 },
  { id: 'picker', label: '取色', spriteIndex: 4 },
  { id: 'pencil', label: '铅笔', spriteIndex: 6 },
  { id: 'brush', label: '刷子', spriteIndex: 7 },
  { id: 'line', label: '直线', spriteIndex: 10 },
  { id: 'rect', label: '矩形', spriteIndex: 12 },
  { id: 'ellipse', label: '椭圆', spriteIndex: 14 },
];

export const PaintApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<PaintTool>('pencil');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor] = useState('#FFFFFF');
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    clearCanvas();
  }, []);

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(e.clientX - rect.left),
      y: Math.floor(e.clientY - rect.top),
    };
  };

  const floodFill = (ctx: CanvasRenderingContext2D, startX: number, startY: number, hex: string) => {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const idx = (startY * w + startX) * 4;
    const sr = data[idx];
    const sg = data[idx + 1];
    const sb = data[idx + 2];

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (sr === r && sg === g && sb === b) return;

    const stack: number[] = [startX, startY];
    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const i = (y * w + x) * 4;
      if (data[i] !== sr || data[i + 1] !== sg || data[i + 2] !== sb) continue;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
      if (x > 0) stack.push(x - 1, y);
      if (x < w - 1) stack.push(x + 1, y);
      if (y > 0) stack.push(x, y - 1);
      if (y < h - 1) stack.push(x, y + 1);
    }
    ctx.putImageData(img, 0, 0);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pt = getPoint(e);
    if (tool === 'fill') {
      floodFill(ctx, pt.x, pt.y, fgColor);
      return;
    }

    if (tool === 'picker') {
      const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
      const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
      setFgColor(`#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`);
      return;
    }

    setIsDrawing(true);
    lastPosRef.current = pt;
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = tool === 'eraser' ? bgColor : fgColor;
      const size = tool === 'eraser' ? 10 : tool === 'brush' ? 5 : 2;
      ctx.fillRect(pt.x - size / 2, pt.y - size / 2, size, size);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPoint(e);
    setCoords(pt);
    if (!isDrawing || !lastPosRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.strokeStyle = fgColor;
      ctx.lineWidth = 2;
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(
          lastPosRef.current.x,
          lastPosRef.current.y,
          pt.x - lastPosRef.current.x,
          pt.y - lastPosRef.current.y
        );
      } else {
        const cx = (lastPosRef.current.x + pt.x) / 2;
        const cy = (lastPosRef.current.y + pt.y) / 2;
        const rx = Math.abs(pt.x - lastPosRef.current.x) / 2;
        const ry = Math.abs(pt.y - lastPosRef.current.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    ctx.strokeStyle = tool === 'eraser' ? bgColor : fgColor;
    ctx.lineWidth = tool === 'eraser' ? 10 : tool === 'brush' ? 5 : 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPosRef.current = pt;
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
    snapshotRef.current = null;
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--w2k-face)] min-h-0">
      <div className="w2k-menubar">
        <button type="button" className="w2k-menubar-item" onClick={clearCanvas}>
          新建图像(N)
        </button>
        <button
          type="button"
          className="w2k-menubar-item"
          onClick={() => {
            const url = canvasRef.current?.toDataURL('image/png');
            if (!url) return;
            const a = document.createElement('a');
            a.href = url;
            a.download = '未命名.png';
            a.click();
          }}
        >
          下载图片(S)
        </button>
      </div>

      <div className="flex-1 min-h-0 flex gap-1 p-1">
        {/* Left 2-column Classic MS Paint Tool Box using authentic mspaint-tools.png sprite */}
        <div className="w-[54px] shrink-0 flex flex-col gap-1">
          <div className="grid grid-cols-2 gap-[2px]">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                onClick={() => setTool(t.id)}
                className={`w2k-btn p-0 w-[25px] h-[25px] min-h-0 flex items-center justify-center ${
                  tool === t.id ? 'pressed bg-[#EEEEEE]' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className="block w-[16px] h-[16px]"
                  style={{
                    backgroundImage: 'url(/icons/ui/mspaint-tools.png)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `-${t.spriteIndex * 16}px 0px`,
                    imageRendering: 'pixelated',
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Workspace */}
        <div className="w2k-inset flex-1 bg-[#808080] p-2 overflow-auto w2k-scroll">
          <canvas
            ref={canvasRef}
            width={420}
            height={240}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="bg-white cursor-crosshair border border-black block"
          />
        </div>
      </div>

      {/* Color Palette */}
      <div className="flex items-center gap-2 px-1.5 py-1 border-t border-[var(--w2k-shadow)]">
        <div className="w2k-inset w-[26px] h-[26px] relative bg-[var(--w2k-face)] shrink-0">
          <div
            className="w-[14px] h-[14px] border border-white absolute bottom-0.5 right-0.5"
            style={{ backgroundColor: bgColor }}
          />
          <div
            className="w-[14px] h-[14px] border border-white absolute top-0.5 left-0.5"
            style={{ backgroundColor: fgColor }}
          />
        </div>
        <div className="grid grid-cols-14 gap-[2px]">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`颜色 ${c}`}
              onClick={() => setFgColor(c)}
              className="w-[14px] h-[14px] p-0 border-t border-l border-[#808080] border-r border-b border-white cursor-default"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-1 px-1 py-[2px] text-[11px]">
        <div className="w2k-sunken-bar px-2 py-[1px] flex-1">
          当前工具: {TOOLS.find((t) => t.id === tool)?.label}
        </div>
        <div className="w2k-sunken-bar px-2 py-[1px] w-[100px] tabular-nums">
          {coords.x}, {coords.y}
        </div>
      </div>
    </div>
  );
};
