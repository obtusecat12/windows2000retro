import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TROPICAL_PHOTOS,
  TropicalPhoto,
  clampZoomPercent,
  cycleIndex,
} from '../../core/mediaCatalog';
import { Win2kIcon } from '../icons/Win2kIcons';
import { PixelCheckmark, PixelRadioDot } from '../icons/Win2kPixelGlyphs';
import { ImagingToolGlyph } from '../icons/MediaToolbarGlyphs';

interface ImagingAppProps {
  initialMediaId?: string;
  onUpdateTitle?: (title: string) => void;
  onClose: () => void;
}

type ViewMode = 'page' | 'thumbs' | 'both';
type ToolMode = 'pan' | 'select-rect' | 'select-annot';
type AnnotTool =
  | 'pointer'
  | 'freehand'
  | 'highlight'
  | 'line'
  | 'rect'
  | 'filled-rect'
  | 'text'
  | 'note'
  | 'stamp';

type ZoomMode = 'fit' | 'fit-width' | number;

interface PhotoTransform {
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

interface AnnotationItem {
  id: string;
  kind: Exclude<AnnotTool, 'pointer'>;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
}

const ANNOT_COLORS = ['#FF0000', '#FFFF00', '#0000FF', '#008000', '#000000'];

const PNG_TOOL_BTN = (
  iconFile: string,
  label: string,
  onClick: () => void,
  opts?: { disabled?: boolean; active?: boolean }
) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={opts?.disabled}
    onClick={onClick}
    className={`w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
      opts?.active
        ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
        : 'hover:enabled:border-t-[var(--w2k-highlight)] hover:enabled:border-l-[var(--w2k-highlight)] hover:enabled:border-r-[var(--w2k-shadow)] hover:enabled:border-b-[var(--w2k-shadow)] active:enabled:border-t-[var(--w2k-shadow)] active:enabled:border-l-[var(--w2k-shadow)] active:enabled:border-r-[var(--w2k-highlight)] active:enabled:border-b-[var(--w2k-highlight)]'
    } disabled:opacity-45`}
  >
    <img
      src={`/icons/ui/imaging/${iconFile}.png`}
      width={16}
      height={16}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ imageRendering: 'pixelated' }}
    />
  </button>
);

export const ImagingApp: React.FC<ImagingAppProps> = ({
  initialMediaId,
  onUpdateTitle,
  onClose,
}) => {
  const initialIndex = useMemo(() => {
    if (!initialMediaId) return 0;
    const idx = TROPICAL_PHOTOS.findIndex((p) => p.id === initialMediaId);
    return idx >= 0 ? idx : 0;
  }, [initialMediaId]);

  const [photoIdx, setPhotoIdx] = useState<number>(initialIndex);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [showMainToolbars, setShowMainToolbars] = useState<boolean>(true);
  const [showAnnotBar, setShowAnnotBar] = useState<boolean>(true);
  const [showStatusBar, setShowStatusBar] = useState<boolean>(true);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit');
  const [activeTool, setActiveTool] = useState<ToolMode>('pan');
  const [activeAnnotTool, setActiveAnnotTool] = useState<AnnotTool>('pointer');
  const [annotColor, setAnnotColor] = useState<string>('#FF0000');
  const [transforms, setTransforms] = useState<Record<string, PhotoTransform>>({});
  const [annotationsByPhoto, setAnnotationsByPhoto] = useState<Record<string, AnnotationItem[]>>({});
  const [clipboardAnnotation, setClipboardAnnotation] = useState<AnnotationItem | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [draftAnnot, setDraftAnnot] = useState<AnnotationItem | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [panDrag, setPanDrag] = useState<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>('按 F1 获取帮助。');
  const [showOpenDialog, setShowOpenDialog] = useState<boolean>(false);
  const [showAboutDialog, setShowAboutDialog] = useState<boolean>(false);
  const [showScannerNotice, setShowScannerNotice] = useState<boolean>(false);
  const [showPrintNotice, setShowPrintNotice] = useState<boolean>(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const onUpdateTitleRef = useRef(onUpdateTitle);
  onUpdateTitleRef.current = onUpdateTitle;
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 500, h: 360 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setViewportSize({
        w: Math.max(160, el.clientWidth - 28),
        h: Math.max(120, el.clientHeight - 28),
      });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, showMainToolbars, showAnnotBar, showStatusBar]);

  const activePhoto: TropicalPhoto = TROPICAL_PHOTOS[photoIdx] ?? TROPICAL_PHOTOS[0];
  useEffect(() => {
    onUpdateTitleRef.current?.(`${activePhoto.filename} - 图像处理`);
  }, [activePhoto.filename]);

  const currentTransform: PhotoTransform = transforms[activePhoto.id] ?? {
    rotation: 0,
    flipH: false,
    flipV: false,
  };
  const currentAnnotations = annotationsByPhoto[activePhoto.id] ?? [];

  const selectPhotoIndex = (nextIdx: number) => {
    const wrapped = cycleIndex(nextIdx, 0, TROPICAL_PHOTOS.length);
    const nextPhoto = TROPICAL_PHOTOS[wrapped];
    setPhotoIdx(wrapped);
    setMarqueeBox(null);
    setStatusNote(`就绪 - ${nextPhoto.filename} · ${nextPhoto.camera} (${nextPhoto.date})`);
  };

  const updateTransform = (updater: (prev: PhotoTransform) => PhotoTransform) => {
    setTransforms((prev) => {
      const cur = prev[activePhoto.id] ?? { rotation: 0, flipH: false, flipV: false };
      return { ...prev, [activePhoto.id]: updater(cur) };
    });
  };

  const rotateLeft = () => {
    updateTransform((t) => ({ ...t, rotation: (t.rotation + 270) % 360 }));
    setStatusNote(`已逆时针旋转 90° (${activePhoto.filename})`);
  };

  const rotateRight = () => {
    updateTransform((t) => ({ ...t, rotation: (t.rotation + 90) % 360 }));
    setStatusNote(`已顺时针旋转 90° (${activePhoto.filename})`);
  };

  const flipHorizontal = () => {
    updateTransform((t) => ({ ...t, flipH: !t.flipH }));
    setStatusNote(`已水平翻转图像 (${activePhoto.filename})`);
  };

  const flipVertical = () => {
    updateTransform((t) => ({ ...t, flipV: !t.flipV }));
    setStatusNote(`已垂直翻转图像 (${activePhoto.filename})`);
  };

  const effectivePercent = useMemo(() => {
    if (typeof zoomMode === 'number') return zoomMode;
    const isQuarter = currentTransform.rotation === 90 || currentTransform.rotation === 270;
    const baseW = isQuarter ? activePhoto.height : activePhoto.width;
    const baseH = isQuarter ? activePhoto.width : activePhoto.height;
    if (zoomMode === 'fit-width') {
      return Math.max(25, Math.floor((viewportSize.w / baseW) * 100));
    }
    const fitScale = Math.min(viewportSize.w / baseW, viewportSize.h / baseH);
    return Math.max(25, Math.floor(fitScale * 100));
  }, [
    activePhoto.height,
    activePhoto.width,
    currentTransform.rotation,
    viewportSize.h,
    viewportSize.w,
    zoomMode,
  ]);

  const zoomLabel = `${effectivePercent}%`;

  const zoomIn = () => {
    const cur = typeof zoomMode === 'number' ? zoomMode : effectivePercent;
    const next = clampZoomPercent(cur + 25);
    setZoomMode(next);
    setStatusNote(`缩放比例: ${next}%`);
  };

  const zoomOut = () => {
    const cur = typeof zoomMode === 'number' ? zoomMode : effectivePercent;
    const next = clampZoomPercent(cur - 25);
    setZoomMode(next);
    setStatusNote(`缩放比例: ${next}%`);
  };

  const undoLastAnnotation = () => {
    setAnnotationsByPhoto((prev) => {
      const list = prev[activePhoto.id] ?? [];
      if (list.length === 0) return prev;
      return { ...prev, [activePhoto.id]: list.slice(0, -1) };
    });
    setStatusNote('已撤消上一步批注');
  };

  const clearAnnotations = () => {
    setAnnotationsByPhoto((prev) => ({ ...prev, [activePhoto.id]: [] }));
    setStatusNote('已清除当前页面全部批注');
  };

  const handleSaveSnapshot = () => {
    setSavedNotice(`已将 ${activePhoto.filename} 及 ${currentAnnotations.length} 处批注保存至“我的图片”。`);
    setStatusNote(`已保存: ${activePhoto.filename}`);
    window.setTimeout(() => setSavedNotice(null), 2200);
  };

  const isRotatedQuarter = currentTransform.rotation === 90 || currentTransform.rotation === 270;
  const stageWidth = Math.round((activePhoto.width * effectivePercent) / 100);
  const stageHeight = Math.round((activePhoto.height * effectivePercent) / 100);

  const getStageCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const nx = Math.max(0, Math.min(640, ((e.clientX - rect.left) / rect.width) * 640));
    const ny = Math.max(0, Math.min(480, ((e.clientY - rect.top) / rect.height) * 480));
    return { x: Math.round(nx), y: Math.round(ny) };
  };

  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setOpenMenu(null);

    if (activeAnnotTool !== 'pointer') {
      const pt = getStageCoords(e);
      if (activeAnnotTool === 'text' || activeAnnotTool === 'note' || activeAnnotTool === 'stamp') {
        const textVal =
          activeAnnotTool === 'stamp'
            ? 'ALOHA 2000'
            : activeAnnotTool === 'note'
            ? '2000 夏威夷假日留念'
            : '热带海岛风景';
        const item: AnnotationItem = {
          id: `ann-${Date.now()}`,
          kind: activeAnnotTool,
          color: annotColor,
          x1: pt.x,
          y1: pt.y,
          x2: pt.x + 120,
          y2: pt.y + 40,
          text: textVal,
        };
        setAnnotationsByPhoto((prev) => ({
          ...prev,
          [activePhoto.id]: [...(prev[activePhoto.id] ?? []), item],
        }));
        setStatusNote(`已添加批注: ${textVal}`);
        return;
      }

      setDraftStart(pt);
      setDraftAnnot({
        id: `ann-${Date.now()}`,
        kind: activeAnnotTool,
        color: activeAnnotTool === 'highlight' ? '#FFFF00' : annotColor,
        x1: pt.x,
        y1: pt.y,
        x2: pt.x,
        y2: pt.y,
        points: activeAnnotTool === 'freehand' || activeAnnotTool === 'highlight' ? [pt] : undefined,
      });
      return;
    }

    if (activeTool === 'select-rect') {
      const pt = getStageCoords(e);
      setDraftStart(pt);
      setMarqueeBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }

    if (activeTool === 'pan' && viewportRef.current) {
      setPanDrag({
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: viewportRef.current.scrollLeft,
        scrollTop: viewportRef.current.scrollTop,
      });
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (panDrag && viewportRef.current) {
      viewportRef.current.scrollLeft = panDrag.scrollLeft - (e.clientX - panDrag.startX);
      viewportRef.current.scrollTop = panDrag.scrollTop - (e.clientY - panDrag.startY);
      return;
    }

    if (draftAnnot && draftStart) {
      const pt = getStageCoords(e);
      if (draftAnnot.kind === 'freehand' || draftAnnot.kind === 'highlight') {
        setDraftAnnot((prev) =>
          prev
            ? {
                ...prev,
                x2: pt.x,
                y2: pt.y,
                points: [...(prev.points ?? []), pt],
              }
            : null
        );
      } else {
        setDraftAnnot((prev) => (prev ? { ...prev, x2: pt.x, y2: pt.y } : null));
      }
      return;
    }

    if (activeTool === 'select-rect' && draftStart) {
      const pt = getStageCoords(e);
      setMarqueeBox({
        x: Math.min(draftStart.x, pt.x),
        y: Math.min(draftStart.y, pt.y),
        w: Math.abs(pt.x - draftStart.x),
        h: Math.abs(pt.y - draftStart.y),
      });
    }
  };

  const handleStageMouseUp = () => {
    if (panDrag) setPanDrag(null);
    if (draftAnnot) {
      setAnnotationsByPhoto((prev) => ({
        ...prev,
        [activePhoto.id]: [...(prev[activePhoto.id] ?? []), draftAnnot],
      }));
      setDraftAnnot(null);
      setDraftStart(null);
      setStatusNote('已绘制图像批注');
      return;
    }
    if (draftStart) {
      setDraftStart(null);
      if (marqueeBox && marqueeBox.w > 8 && marqueeBox.h > 8) {
        setStatusNote(`已选择图像区域 (${marqueeBox.w} × ${marqueeBox.h})`);
      }
    }
  };

  const renderAnnotationElement = (ann: AnnotationItem) => {
    const left = Math.min(ann.x1, ann.x2);
    const top = Math.min(ann.y1, ann.y2);
    const width = Math.max(4, Math.abs(ann.x2 - ann.x1));
    const height = Math.max(4, Math.abs(ann.y2 - ann.y1));

    if (ann.kind === 'freehand' || ann.kind === 'highlight') {
      const pts = (ann.points ?? []).map((p) => `${p.x},${p.y}`).join(' ');
      return (
        <polyline
          key={ann.id}
          points={pts}
          fill="none"
          stroke={ann.color}
          strokeWidth={ann.kind === 'highlight' ? 16 : 3}
          strokeOpacity={ann.kind === 'highlight' ? 0.45 : 1}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      );
    }
    if (ann.kind === 'line') {
      return (
        <line
          key={ann.id}
          x1={ann.x1}
          y1={ann.y1}
          x2={ann.x2}
          y2={ann.y2}
          stroke={ann.color}
          strokeWidth={3}
        />
      );
    }
    if (ann.kind === 'rect') {
      return (
        <rect
          key={ann.id}
          x={left}
          y={top}
          width={width}
          height={height}
          fill="none"
          stroke={ann.color}
          strokeWidth={3}
        />
      );
    }
    if (ann.kind === 'filled-rect') {
      return (
        <rect
          key={ann.id}
          x={left}
          y={top}
          width={width}
          height={height}
          fill={ann.color}
          fillOpacity={0.78}
        />
      );
    }
    if (ann.kind === 'note') {
      return (
        <g key={ann.id}>
          <rect
            x={ann.x1}
            y={ann.y1}
            width={156}
            height={42}
            fill="#FFFF99"
            stroke="#808000"
            strokeWidth={2}
          />
          <text x={ann.x1 + 8} y={ann.y1 + 25} fill="#000000" fontSize="13" fontWeight="bold">
            {ann.text ?? '假日留念'}
          </text>
        </g>
      );
    }
    if (ann.kind === 'stamp') {
      return (
        <g key={ann.id} transform={`rotate(-10 ${ann.x1 + 58} ${ann.y1 + 16})`}>
          <rect
            x={ann.x1}
            y={ann.y1}
            width={126}
            height={32}
            fill="none"
            stroke="#CC0000"
            strokeWidth={3}
          />
          <text
            x={ann.x1 + 10}
            y={ann.y1 + 22}
            fill="#CC0000"
            fontSize="16"
            fontWeight="bold"
            letterSpacing="1"
          >
            {ann.text ?? 'ALOHA 2000'}
          </text>
        </g>
      );
    }
    return (
      <text key={ann.id} x={ann.x1} y={ann.y1 + 16} fill={ann.color} fontSize="16" fontWeight="bold">
        {ann.text ?? '热带海岛风景'}
      </text>
    );
  };

  const renderAnnotToolBtn = (
    tool: AnnotTool,
    glyph: Parameters<typeof ImagingToolGlyph>[0]['name'],
    label: string
  ) => (
    <button
      key={tool}
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setActiveAnnotTool(tool)}
      className={`w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
        activeAnnotTool === tool
          ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
          : 'hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)]'
      }`}
    >
      <ImagingToolGlyph name={glyph} />
    </button>
  );

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--w2k-face)] min-h-0 relative select-none"
      onClick={() => setOpenMenu(null)}
    >
      {/* Classic Win2K Menu Bar */}
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
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[165px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowOpenDialog(true);
                  setOpenMenu(null);
                }}
              >
                <span>打开(O)...</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  handleSaveSnapshot();
                  setOpenMenu(null);
                }}
              >
                <span>保存(S)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowScannerNotice(true);
                  setOpenMenu(null);
                }}
              >
                <span>扫描新图像(C)...</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowPrintNotice(true);
                  setOpenMenu(null);
                }}
              >
                <span>打印(P)...</span>
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
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[165px]">
              <button
                type="button"
                className="w2k-menu-item"
                disabled={currentAnnotations.length === 0}
                onClick={() => {
                  undoLastAnnotation();
                  setOpenMenu(null);
                }}
              >
                <span>撤消(U)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                disabled={currentAnnotations.length === 0}
                onClick={() => {
                  const last = currentAnnotations[currentAnnotations.length - 1];
                  if (last) setClipboardAnnotation(last);
                  setOpenMenu(null);
                }}
              >
                <span>复制批注(C)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                disabled={!clipboardAnnotation}
                onClick={() => {
                  if (clipboardAnnotation) {
                    setAnnotationsByPhoto((prev) => ({
                      ...prev,
                      [activePhoto.id]: [
                        ...(prev[activePhoto.id] ?? []),
                        {
                          ...clipboardAnnotation,
                          id: `ann-${Date.now()}`,
                          x1: clipboardAnnotation.x1 + 18,
                          y1: clipboardAnnotation.y1 + 18,
                          x2: clipboardAnnotation.x2 + 18,
                          y2: clipboardAnnotation.y2 + 18,
                        },
                      ],
                    }));
                  }
                  setOpenMenu(null);
                }}
              >
                <span>粘贴批注(P)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                disabled={currentAnnotations.length === 0}
                onClick={() => {
                  clearAnnotations();
                  setOpenMenu(null);
                }}
              >
                <span>清除全部批注(L)</span>
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
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[185px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setViewMode('page');
                  setOpenMenu(null);
                }}
              >
                {viewMode === 'page' && (
                  <span className="absolute left-2 flex items-center">
                    <PixelRadioDot />
                  </span>
                )}
                <span>单页视图(O)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setViewMode('thumbs');
                  setOpenMenu(null);
                }}
              >
                {viewMode === 'thumbs' && (
                  <span className="absolute left-2 flex items-center">
                    <PixelRadioDot />
                  </span>
                )}
                <span>缩略图视图(T)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setViewMode('both');
                  setOpenMenu(null);
                }}
              >
                {viewMode === 'both' && (
                  <span className="absolute left-2 flex items-center">
                    <PixelRadioDot />
                  </span>
                )}
                <span>页面和缩略图视图(B)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowMainToolbars((v) => !v);
                  setOpenMenu(null);
                }}
              >
                {showMainToolbars && (
                  <span className="absolute left-2 flex items-center">
                    <PixelCheckmark />
                  </span>
                )}
                <span>标准工具栏(S)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowAnnotBar((v) => !v);
                  setOpenMenu(null);
                }}
              >
                {showAnnotBar && (
                  <span className="absolute left-2 flex items-center">
                    <PixelCheckmark />
                  </span>
                )}
                <span>批注工具栏(A)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowStatusBar((v) => !v);
                  setOpenMenu(null);
                }}
              >
                {showStatusBar && (
                  <span className="absolute left-2 flex items-center">
                    <PixelCheckmark />
                  </span>
                )}
                <span>状态栏(R)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setFullscreen(true);
                  setOpenMenu(null);
                }}
              >
                <span>全屏显示(F)</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'page' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'page' ? null : 'page');
            }}
          >
            页面(P)
          </button>
          {openMenu === 'page' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[165px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  selectPhotoIndex(photoIdx - 1);
                  setOpenMenu(null);
                }}
              >
                <span>上一页(P)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  selectPhotoIndex(photoIdx + 1);
                  setOpenMenu(null);
                }}
              >
                <span>下一页(N)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  rotateLeft();
                  setOpenMenu(null);
                }}
              >
                <span>向左旋转 90°(L)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  rotateRight();
                  setOpenMenu(null);
                }}
              >
                <span>向右旋转 90°(R)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  flipHorizontal();
                  setOpenMenu(null);
                }}
              >
                <span>水平翻转(H)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  flipVertical();
                  setOpenMenu(null);
                }}
              >
                <span>垂直翻转(V)</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'zoom' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'zoom' ? null : 'zoom');
            }}
          >
            缩放(Z)
          </button>
          {openMenu === 'zoom' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[160px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  zoomIn();
                  setOpenMenu(null);
                }}
              >
                <span>放大(I)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  zoomOut();
                  setOpenMenu(null);
                }}
              >
                <span>缩小(O)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setZoomMode('fit');
                  setOpenMenu(null);
                }}
              >
                <span>最佳适应(B)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setZoomMode('fit-width');
                  setOpenMenu(null);
                }}
              >
                <span>适合宽度(W)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setZoomMode(100);
                  setOpenMenu(null);
                }}
              >
                <span>实际大小 100%(1)</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'tools' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'tools' ? null : 'tools');
            }}
          >
            工具(T)
          </button>
          {openMenu === 'tools' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[160px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setActiveTool('pan');
                  setActiveAnnotTool('pointer');
                  setOpenMenu(null);
                }}
              >
                <span>手形拖动(P)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setActiveTool('select-rect');
                  setActiveAnnotTool('pointer');
                  setOpenMenu(null);
                }}
              >
                <span>图像选择框(S)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setActiveTool('select-annot');
                  setShowAnnotBar(true);
                  setOpenMenu(null);
                }}
              >
                <span>批注选择(A)</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'annot' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'annot' ? null : 'annot');
            }}
          >
            批注(A)
          </button>
          {openMenu === 'annot' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[170px]">
              {(
                [
                  ['pointer', '选择指针'],
                  ['freehand', '手绘线条'],
                  ['highlight', '荧光笔标记'],
                  ['line', '直线'],
                  ['rect', '空心矩形'],
                  ['filled-rect', '实心矩形'],
                  ['text', '文字批注'],
                  ['note', '黄底便签附注'],
                  ['stamp', '橡皮图章 (ALOHA 2000)'],
                ] as Array<[AnnotTool, string]>
              ).map(([toolId, label]) => (
                <button
                  key={toolId}
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setShowAnnotBar(true);
                    setActiveAnnotTool(toolId);
                    setOpenMenu(null);
                  }}
                >
                  {activeAnnotTool === toolId && (
                    <span className="absolute left-2 flex items-center">
                      <PixelRadioDot />
                    </span>
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'help' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'help' ? null : 'help');
            }}
          >
            帮助(H)
          </button>
          {openMenu === 'help' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[175px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowAboutDialog(true);
                  setOpenMenu(null);
                }}
              >
                <span>关于 图像处理(A)...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Row Toolbars matching ref-imaging-win2k.png */}
      {showMainToolbars && (
        <>
          {/* Toolbar Row 1 */}
          <div className="flex items-center flex-wrap gap-[1px] px-1 py-[2px] border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)]">
            <div className="w2k-gripper mr-0.5" />
            <button
              type="button"
              title="新建文档"
              aria-label="新建文档"
              onClick={() => {
                clearAnnotations();
                setTransforms((p) => {
                  const next = { ...p };
                  delete next[activePhoto.id];
                  return next;
                });
                setStatusNote('已重置当前视图与批注');
              }}
              className="w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)] cursor-default"
            >
              <ImagingToolGlyph name="new-doc" />
            </button>
            {PNG_TOOL_BTN('open', '打开图像', () => setShowOpenDialog(true))}
            {PNG_TOOL_BTN('save', '保存图像与批注', handleSaveSnapshot)}
            {PNG_TOOL_BTN('print', '打印', () => setShowPrintNotice(true))}
            <div className="w2k-divider-v mx-0.5" />
            {PNG_TOOL_BTN(
              'cut',
              '剪切批注',
              () => {
                const last = currentAnnotations[currentAnnotations.length - 1];
                if (last) {
                  setClipboardAnnotation(last);
                  undoLastAnnotation();
                }
              },
              { disabled: currentAnnotations.length === 0 }
            )}
            {PNG_TOOL_BTN(
              'copy',
              '复制批注',
              () => {
                const last = currentAnnotations[currentAnnotations.length - 1];
                if (last) {
                  setClipboardAnnotation(last);
                  setStatusNote('已复制最新批注到剪贴板');
                }
              },
              { disabled: currentAnnotations.length === 0 }
            )}
            {PNG_TOOL_BTN(
              'paste',
              '粘贴批注',
              () => {
                if (clipboardAnnotation) {
                  setAnnotationsByPhoto((prev) => ({
                    ...prev,
                    [activePhoto.id]: [
                      ...(prev[activePhoto.id] ?? []),
                      {
                        ...clipboardAnnotation,
                        id: `ann-${Date.now()}`,
                        x1: clipboardAnnotation.x1 + 20,
                        y1: clipboardAnnotation.y1 + 20,
                        x2: clipboardAnnotation.x2 + 20,
                        y2: clipboardAnnotation.y2 + 20,
                      },
                    ],
                  }));
                }
              },
              { disabled: !clipboardAnnotation }
            )}
            {PNG_TOOL_BTN('undo', '撤消', undoLastAnnotation, {
              disabled: currentAnnotations.length === 0,
            })}
            <button
              type="button"
              title="重做"
              aria-label="重做"
              disabled
              className="w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent disabled:opacity-45 cursor-default"
            >
              <img
                src="/icons/ui/imaging/undo.png"
                width={16}
                height={16}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ imageRendering: 'pixelated', transform: 'scaleX(-1)' }}
              />
            </button>
            <div className="w2k-divider-v mx-0.5" />
            {PNG_TOOL_BTN('zoom-in', '放大', zoomIn)}
            {PNG_TOOL_BTN('zoom-out', '缩小', zoomOut)}
            <button
              type="button"
              title="缩放到选区"
              aria-label="缩放到选区"
              onClick={() => {
                setZoomMode(150);
                setStatusNote('已放大至选区视图 (150%)');
              }}
              className="w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)] cursor-default"
            >
              <ImagingToolGlyph name="zoom-sel" />
            </button>
            {PNG_TOOL_BTN(
              'zoom-fit',
              '最佳适应',
              () => {
                setZoomMode('fit');
                setStatusNote('缩放模式: 最佳适应');
              },
              { active: zoomMode === 'fit' }
            )}
            <button
              type="button"
              title="适合宽度"
              aria-label="适合宽度"
              onClick={() => {
                setZoomMode('fit-width');
                setStatusNote('缩放模式: 适合宽度');
              }}
              className={`w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
                zoomMode === 'fit-width'
                  ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
                  : 'hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)]'
              }`}
            >
              <ImagingToolGlyph name="fit-width" />
            </button>
            {PNG_TOOL_BTN(
              'zoom-100',
              '实际大小 100%',
              () => {
                setZoomMode(100);
                setStatusNote('缩放比例: 100%');
              },
              { active: zoomMode === 100 }
            )}
            <select
              aria-label="缩放比例"
              value={String(zoomMode)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'fit' || v === 'fit-width') {
                  setZoomMode(v);
                } else {
                  setZoomMode(Number(v));
                }
              }}
              className="w2k-select h-[20px] text-[11px] px-1 py-0 ml-1 w-[84px]"
            >
              <option value="fit">最佳适应</option>
              <option value="fit-width">适合宽度</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
              <option value="150">150%</option>
              <option value="200">200%</option>
            </select>
          </div>

          {/* Toolbar Row 2 */}
          <div className="flex items-center flex-wrap gap-[1px] px-1 py-[2px] border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)]">
            <div className="w2k-gripper mr-0.5" />
            <button
              type="button"
              title="扫描新图像"
              aria-label="扫描新图像"
              onClick={() => setShowScannerNotice(true)}
              className="w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)] cursor-default"
            >
              <ImagingToolGlyph name="scan" />
            </button>
            <div className="w2k-divider-v mx-0.5" />
            {(
              [
                ['page', 'view-page', '单页视图'],
                ['thumbs', 'view-thumbs', '缩略图视图'],
                ['both', 'view-both', '页面和缩略图视图'],
              ] as const
            ).map(([mode, glyph, label]) => (
              <button
                key={mode}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setViewMode(mode)}
                className={`w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
                  viewMode === mode
                    ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
                    : 'hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)]'
                }`}
              >
                <ImagingToolGlyph name={glyph} />
              </button>
            ))}
            <div className="w2k-divider-v mx-0.5" />
            {(
              [
                ['pan', 'pan-hand', '手形拖动'],
                ['select-rect', 'select-rect', '选择图像'],
                ['select-annot', 'select-annot', '选择批注'],
              ] as const
            ).map(([toolId, glyph, label]) => (
              <button
                key={toolId}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => {
                  setActiveTool(toolId);
                  if (toolId !== 'select-annot') setActiveAnnotTool('pointer');
                }}
                className={`w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
                  activeTool === toolId && activeAnnotTool === 'pointer'
                    ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
                    : 'hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)]'
                }`}
              >
                <ImagingToolGlyph name={glyph} />
              </button>
            ))}
            <div className="w2k-divider-v mx-0.5" />
            <button
              type="button"
              title="显示/隐藏批注工具栏"
              aria-label="切换批注工具栏"
              onClick={() => setShowAnnotBar((v) => !v)}
              className={`w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
                showAnnotBar
                  ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
                  : 'hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)]'
              }`}
            >
              <ImagingToolGlyph name="annot-toggle" />
            </button>
            <div className="w2k-divider-v mx-0.5" />
            {PNG_TOOL_BTN('rot-left', '向左旋转 90°', rotateLeft)}
            {PNG_TOOL_BTN('rot-right', '向右旋转 90°', rotateRight)}
            <div className="w2k-divider-v mx-0.5" />
            {PNG_TOOL_BTN('flip-h', '水平翻转', flipHorizontal)}
            {PNG_TOOL_BTN('flip-v', '垂直翻转', flipVertical)}
            <div className="w2k-divider-v mx-0.5" />
            {PNG_TOOL_BTN('prev', '上一页', () => selectPhotoIndex(photoIdx - 1))}
            <div
              className="w2k-input h-[20px] px-1.5 py-0 text-[11px] flex items-center justify-center tabular-nums min-w-[44px]"
              aria-label="当前页码"
            >
              {photoIdx + 1} / {TROPICAL_PHOTOS.length}
            </div>
            {PNG_TOOL_BTN('next', '下一页', () => selectPhotoIndex(photoIdx + 1))}
            <div className="w2k-divider-v mx-0.5" />
            {PNG_TOOL_BTN('fullscreen', '全屏显示', () => setFullscreen(true))}
          </div>
        </>
      )}

      {showAnnotBar && (
        <div
          aria-label="批注工具栏"
          className="flex items-center justify-between gap-2 px-1 py-[2px] border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)] bg-[var(--w2k-face)]"
        >
          <div className="flex items-center gap-[1px] flex-wrap">
            <div className="w2k-gripper mr-0.5" />
            {renderAnnotToolBtn('pointer', 'annot-pointer', '选择批注指针')}
            {renderAnnotToolBtn('freehand', 'annot-freehand', '手绘线条')}
            {renderAnnotToolBtn('highlight', 'annot-highlight', '荧光笔')}
            {renderAnnotToolBtn('line', 'annot-line', '直线')}
            {renderAnnotToolBtn('rect', 'annot-rect', '空心矩形')}
            {renderAnnotToolBtn('filled-rect', 'annot-filled-rect', '实心矩形')}
            {renderAnnotToolBtn('text', 'annot-text', '文字批注')}
            {renderAnnotToolBtn('note', 'annot-note', '便签附注')}
            {renderAnnotToolBtn('stamp', 'annot-stamp', '橡皮图章 (ALOHA 2000)')}
            <div className="w2k-divider-v mx-1" />
            <div className="flex items-center gap-1" aria-label="批注颜色">
              {ANNOT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={`批注颜色 ${hex}`}
                  aria-label={`批注颜色 ${hex}`}
                  onClick={() => setAnnotColor(hex)}
                  className={`w-[14px] h-[14px] p-0 border cursor-default ${
                    annotColor === hex
                      ? 'border-white outline outline-1 outline-black'
                      : 'border-[#808080]'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            <div className="w2k-divider-v mx-1" />
            <button
              type="button"
              title="清除当前页面全部批注"
              aria-label="清除当前页面全部批注"
              disabled={currentAnnotations.length === 0}
              onClick={clearAnnotations}
              className="w-[23px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent hover:enabled:border-t-[var(--w2k-highlight)] hover:enabled:border-l-[var(--w2k-highlight)] hover:enabled:border-r-[var(--w2k-shadow)] hover:enabled:border-b-[var(--w2k-shadow)] disabled:opacity-40 cursor-default"
            >
              <ImagingToolGlyph name="annot-clear" disabled={currentAnnotations.length === 0} />
            </button>
          </div>
          <span className="text-[11px] text-[#404040] pr-1 hidden sm:inline truncate">
            {activePhoto.title}
          </span>
        </div>
      )}

      {/* Main Workspace (Thumbnail Strip + Page Canvas) */}
      <div className="flex-1 min-h-0 flex m-[2px] gap-[2px]">
        {/* Left Thumbnail Strip (in 'both' mode) OR Full Grid (in 'thumbs' mode) */}
        {(viewMode === 'both' || viewMode === 'thumbs') && (
          <div
            aria-label="缩略图窗格"
            className={`w2k-inset bg-white overflow-y-auto w2k-scroll ${
              viewMode === 'thumbs'
                ? 'flex-1 p-3 flex flex-wrap gap-4 content-start'
                : 'w-[136px] shrink-0 p-2 flex flex-col gap-2.5'
            }`}
          >
            {TROPICAL_PHOTOS.map((photo, idx) => {
              const isSelected = idx === photoIdx;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => selectPhotoIndex(idx)}
                  onDoubleClick={() => {
                    selectPhotoIndex(idx);
                    if (viewMode === 'thumbs') setViewMode('both');
                  }}
                  className={`flex flex-col items-center gap-1 p-1.5 bg-transparent border cursor-default ${
                    isSelected
                      ? 'border-[#808080] bg-[#D4D0C8]'
                      : 'border-[#D4D0C8] hover:border-[#808080]'
                  } ${viewMode === 'thumbs' ? 'w-[140px]' : 'w-full'}`}
                >
                  <div className="relative bg-black p-[1px] border border-[#808080]">
                    <img
                      src={photo.thumbSrc}
                      alt={photo.title}
                      width={96}
                      height={72}
                      draggable={false}
                      className="block"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span
                      className="absolute top-0.5 left-0.5 px-1 text-[10px] leading-tight tabular-nums bg-white/90 text-black"
                    >
                      {idx + 1}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] leading-tight truncate w-full text-center px-0.5 text-black ${
                      isSelected ? 'font-semibold' : ''
                    }`}
                  >
                    {photo.filename}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Page Image Viewport */}
        {viewMode !== 'thumbs' && (
          <div
            ref={viewportRef}
            className={`flex-1 min-w-0 min-h-0 w2k-inset bg-[#FFFFFF] overflow-auto w2k-scroll flex items-center justify-center p-3 relative ${
              activeAnnotTool !== 'pointer'
                ? 'cursor-crosshair'
                : activeTool === 'pan'
                ? 'cursor-grab'
                : 'cursor-crosshair'
            }`}
          >
            <div
              ref={stageRef}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onDoubleClick={() => setFullscreen(true)}
              className="relative bg-white border border-[#808080] shadow-[2px_2px_0_rgba(0,0,0,0.22)] shrink-0 overflow-hidden"
              style={{
                width: isRotatedQuarter ? stageHeight : stageWidth,
                height: isRotatedQuarter ? stageWidth : stageHeight,
              }}
            >
              <div
                className="w-full h-full relative flex items-center justify-center"
                style={{
                  transform: `rotate(${currentTransform.rotation}deg) scaleX(${
                    currentTransform.flipH ? -1 : 1
                  }) scaleY(${currentTransform.flipV ? -1 : 1})`,
                }}
              >
                <img
                  src={activePhoto.src}
                  alt={activePhoto.title}
                  draggable={false}
                  className="block select-none"
                  style={{
                    width: stageWidth,
                    height: stageHeight,
                    maxWidth: 'none',
                    imageRendering: 'pixelated',
                  }}
                />
                {/* Interactive Vector Annotation Overlay (640x480 coordinate space) */}
                <svg
                  viewBox="0 0 640 480"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  shapeRendering="crispEdges"
                >
                  {currentAnnotations.map(renderAnnotationElement)}
                  {draftAnnot && renderAnnotationElement(draftAnnot)}
                  {marqueeBox && marqueeBox.w > 1 && marqueeBox.h > 1 && (
                    <rect
                      x={marqueeBox.x}
                      y={marqueeBox.y}
                      width={marqueeBox.w}
                      height={marqueeBox.h}
                      fill="rgba(10,36,106,0.12)"
                      stroke="#0A246A"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                  )}
                </svg>
              </div>
            </div>

            {savedNotice && (
              <div className="absolute top-2 right-2 bg-[#FFFFE1] border border-black px-2 py-1 text-[11px] text-black shadow-[1px_1px_0_rgba(0,0,0,0.3)] z-10">
                {savedNotice}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom 3-Pane Sunken Status Bar (matching ref-imaging-win2k.png) */}
      {showStatusBar && (
        <div className="flex items-center gap-1 px-1 pb-[2px] pt-[1px] text-[11px] text-[#000000]">
          <div className="w2k-sunken-bar px-2 py-[1px] flex-1 truncate">{statusNote}</div>
          <div className="w2k-sunken-bar px-2 py-[1px] w-[72px] text-center tabular-nums">
            {zoomLabel}
          </div>
          <div className="w2k-sunken-bar px-2 py-[1px] w-[170px] truncate text-center tabular-nums">
            第 {photoIdx + 1} 页，共 {TROPICAL_PHOTOS.length} 页
          </div>
        </div>
      )}

      {/* Open Photo Picker Modal */}
      {showOpenDialog && (
        <div
          className="absolute inset-0 bg-black/20 flex items-center justify-center z-40"
          onClick={() => setShowOpenDialog(false)}
        >
          <div
            role="dialog"
            aria-label="打开图像"
            className="w2k-window-frame w-[390px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w2k-titlebar">
              <span>打开 - C:\...\我的图片</span>
              <button
                type="button"
                className="w2k-win-btn"
                aria-label="关闭打开对话框"
                onClick={() => setShowOpenDialog(false)}
              >
                <img src="/icons/ui/win-close.svg" alt="" className="w-[8px] h-[7px]" />
              </button>
            </div>
            <div className="p-2.5 bg-[var(--w2k-face)] space-y-2.5 text-[12px]">
              <div className="text-[11px] text-[#404040]">
                查找范围: 我的文档\我的图片 (千禧海岛假期摄影)
              </div>
              <div className="w2k-inset bg-white max-h-[200px] overflow-y-auto w2k-scroll p-1 space-y-0.5">
                {TROPICAL_PHOTOS.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => {
                      selectPhotoIndex(idx);
                      setShowOpenDialog(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-1.5 py-1 text-left border-0 cursor-default ${
                      idx === photoIdx
                        ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                        : 'bg-transparent text-black hover:bg-[#EEF4FC]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Win2kIcon kind="image-file" size={16} />
                      <span className="truncate">{photo.filename}</span>
                    </span>
                    <span className="text-[11px] opacity-80 shrink-0 tabular-nums">
                      {photo.width}×{photo.height}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="w2k-btn default-btn"
                  onClick={() => setShowOpenDialog(false)}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner / Print / About Dialogs */}
      {(showScannerNotice || showPrintNotice || showAboutDialog) && (
        <div
          className="absolute inset-0 bg-black/20 flex items-center justify-center z-40"
          onClick={() => {
            setShowScannerNotice(false);
            setShowPrintNotice(false);
            setShowAboutDialog(false);
          }}
        >
          <div
            role="dialog"
            aria-label="图像处理提示"
            className="w2k-window-frame w-[310px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w2k-titlebar">
              <span>
                {showAboutDialog
                  ? '关于 图像处理'
                  : showScannerNotice
                  ? '选择扫描仪源'
                  : '打印预览'}
              </span>
              <button
                type="button"
                className="w2k-win-btn"
                aria-label="关闭提示框"
                onClick={() => {
                  setShowScannerNotice(false);
                  setShowPrintNotice(false);
                  setShowAboutDialog(false);
                }}
              >
                <img src="/icons/ui/win-close.svg" alt="" className="w-[8px] h-[7px]" />
              </button>
            </div>
            <div className="p-3 bg-[var(--w2k-face)] text-[12px] space-y-3">
              <div className="flex items-start gap-3">
                <Win2kIcon kind="imaging" size={32} />
                {showAboutDialog ? (
                  <div className="space-y-1">
                    <div className="font-bold">Imaging for Windows (图像处理)</div>
                    <div className="text-[11px] text-[#404040]">
                      版本 1.0 (Windows 2000 Build 2195)
                    </div>
                    <div className="text-[11px] text-[#404040]">
                      Kodak Eastman Software, Inc. 版权所有
                    </div>
                  </div>
                ) : showScannerNotice ? (
                  <div className="text-[11px]">
                    未检测到联机的 TWAIN 扫描仪或数码相机接口，请直接打开“我的图片”中的相册文件。
                  </div>
                ) : (
                  <div className="text-[11px]">
                    已将 {activePhoto.filename} 发送至默认打印机：HP LaserJet 1100 (\\\\FILESERVER-01)。
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="w2k-btn default-btn min-w-[68px]"
                  onClick={() => {
                    setShowScannerNotice(false);
                    setShowPrintNotice(false);
                    setShowAboutDialog(false);
                  }}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Preview */}
      {fullscreen && (
        <div
          className="fixed inset-0 bg-black z-[9900] flex flex-col items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={activePhoto.src}
            alt={activePhoto.title}
            className="max-w-full max-h-[88vh] object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="mt-2 text-[12px] text-[#DCDCDC]">
            {activePhoto.filename} · {activePhoto.title}（点击任意处退出全屏）
          </div>
        </div>
      )}
    </div>
  );
};
