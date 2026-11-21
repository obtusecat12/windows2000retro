import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TROPICAL_VIDEOS,
  TropicalVideo,
  cycleIndex,
  formatMediaTime,
} from '../../core/mediaCatalog';
import { Win2kIcon } from '../icons/Win2kIcons';
import { PixelCheckmark, PixelRadioDot } from '../icons/Win2kPixelGlyphs';
import {
  WmpClassicLogo,
  WmpSpeakerIcon,
  WmpStepFrameIcon,
} from '../icons/MediaToolbarGlyphs';

interface MediaPlayerAppProps {
  initialMediaId?: string;
  autoPlay?: boolean;
  onUpdateTitle?: (title: string) => void;
  onOpenVideosFolder?: () => void;
  onClose: () => void;
}

type PlaybackState = 'stopped' | 'playing' | 'paused';
type ZoomPreset = 'fit' | '50' | '100' | '200';

const WMP_BTN = (
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
    className={`w-[24px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
      opts?.active
        ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
        : 'hover:enabled:border-t-[var(--w2k-highlight)] hover:enabled:border-l-[var(--w2k-highlight)] hover:enabled:border-r-[var(--w2k-shadow)] hover:enabled:border-b-[var(--w2k-shadow)] active:enabled:border-t-[var(--w2k-shadow)] active:enabled:border-l-[var(--w2k-shadow)] active:enabled:border-r-[var(--w2k-highlight)] active:enabled:border-b-[var(--w2k-highlight)]'
    } disabled:opacity-40`}
  >
    <img
      src={`/icons/ui/wmp/${iconFile}.png`}
      width={16}
      height={16}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ imageRendering: 'pixelated' }}
    />
  </button>
);

export const MediaPlayerApp: React.FC<MediaPlayerAppProps> = ({
  initialMediaId,
  autoPlay = false,
  onUpdateTitle,
  onOpenVideosFolder,
  onClose,
}) => {
  const initialIndex = useMemo(() => {
    if (!initialMediaId) return 0;
    const idx = TROPICAL_VIDEOS.findIndex((v) => v.id === initialMediaId);
    return idx >= 0 ? idx : 0;
  }, [initialMediaId]);

  const [videoIdx, setVideoIdx] = useState<number>(initialIndex);
  const [playState, setPlayState] = useState<PlaybackState>(autoPlay ? 'playing' : 'stopped');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(TROPICAL_VIDEOS[initialIndex]?.durationSec ?? 8);
  const [volume, setVolume] = useState<number>(0.8);
  const [muted, setMuted] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(true);
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>('fit');
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [showPropsModal, setShowPropsModal] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const seekTrackRef = useRef<HTMLDivElement>(null);
  const volTrackRef = useRef<HTMLDivElement>(null);
  const pendingPlayRef = useRef<boolean>(autoPlay);
  const onUpdateTitleRef = useRef(onUpdateTitle);
  onUpdateTitleRef.current = onUpdateTitle;

  const activeVideo: TropicalVideo = TROPICAL_VIDEOS[videoIdx] ?? TROPICAL_VIDEOS[0];

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted, videoIdx]);

  useEffect(() => {
    onUpdateTitleRef.current?.(
      playState === 'stopped'
        ? 'Windows Media Player'
        : `${activeVideo.filename} - Windows Media Player`
    );
  }, [activeVideo.filename, playState]);

  const safePlayVideo = () => {
    const el = videoRef.current;
    if (!el) return;
    const promise = el.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {
        // Fallback: if browser blocks unmuted autoplay on initial double-click, retry muted
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {});
      });
    }
  };

  const handlePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (playState === 'stopped') {
      el.currentTime = 0;
    }
    setPlayState('playing');
    safePlayVideo();
  };

  const handlePause = () => {
    const el = videoRef.current;
    if (!el) return;
    if (playState === 'playing') {
      el.pause();
      setPlayState('paused');
    } else if (playState === 'paused') {
      setPlayState('playing');
      safePlayVideo();
    }
  };

  const handleStop = () => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setCurrentTime(0);
    setPlayState('stopped');
  };

  const switchTrack = (nextIdx: number, startPlaying = true) => {
    const wrapped = cycleIndex(nextIdx, 0, TROPICAL_VIDEOS.length);
    const nextVid = TROPICAL_VIDEOS[wrapped];
    pendingPlayRef.current = startPlaying;
    setVideoIdx(wrapped);
    setCurrentTime(0);
    setDuration(nextVid.durationSec);
    setPlayState(startPlaying ? 'playing' : 'stopped');
  };

  const handleSeekBy = (deltaSec: number) => {
    const el = videoRef.current;
    const maxDur = duration || activeVideo.durationSec;
    const next = Math.max(0, Math.min(maxDur, (el?.currentTime ?? currentTime) + deltaSec));
    if (el) el.currentTime = next;
    setCurrentTime(next);
  };

  const handleStepFrame = () => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      const next = Math.min(duration || activeVideo.durationSec, el.currentTime + 1 / activeVideo.fps);
      el.currentTime = next;
      setCurrentTime(next);
      setPlayState('paused');
    }
  };

  const updateSeekFromClientX = (clientX: number) => {
    const rect = seekTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const maxDur = duration || activeVideo.durationSec;
    const nextTime = ratio * maxDur;
    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
    if (playState === 'stopped') {
      setPlayState('paused');
    }
  };

  const updateVolumeFromClientX = (clientX: number) => {
    const rect = volTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(ratio);
    if (ratio > 0 && muted) setMuted(false);
  };

  const startSliderDrag = (
    e: React.MouseEvent,
    onMoveValue: (clientX: number) => void
  ) => {
    e.preventDefault();
    onMoveValue(e.clientX);
    const onMove = (ev: MouseEvent) => onMoveValue(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const effectiveVol = muted ? 0 : volume;
  const statusLabel =
    playState === 'playing' ? '正在播放' : playState === 'paused' ? '已暂停' : '已停止';

  const videoDimensionStyle =
    zoomPreset === '50'
      ? { width: 160, height: 120 }
      : zoomPreset === '100'
      ? { width: 320, height: 240 }
      : zoomPreset === '200'
      ? { width: 640, height: 480 }
      : undefined;

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--w2k-face)] min-h-0 relative select-none"
      onClick={() => setOpenMenu(null)}
    >
      {/* Classic WMP 6.4 Menu Bar matching ref-mpc64.png */}
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
                  setShowOpenModal(true);
                  setOpenMenu(null);
                }}
              >
                <span>打开(O)...</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  handleStop();
                  setOpenMenu(null);
                }}
              >
                <span>关闭文件(C)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowPropsModal(true);
                  setOpenMenu(null);
                }}
              >
                <span>属性(R)</span>
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
            className={`w2k-menubar-item ${openMenu === 'view' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'view' ? null : 'view');
            }}
          >
            查看(V)
          </button>
          {openMenu === 'view' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[165px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowControls((c) => !c);
                  setOpenMenu(null);
                }}
              >
                {showControls && (
                  <span className="absolute left-2 flex items-center">
                    <PixelCheckmark />
                  </span>
                )}
                <span>标准控制栏(S)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowPlaylist((p) => !p);
                  setOpenMenu(null);
                }}
              >
                {showPlaylist && (
                  <span className="absolute left-2 flex items-center">
                    <PixelCheckmark />
                  </span>
                )}
                <span>播放列表(L)</span>
              </button>
              <div className="w2k-menu-sep" />
              {(
                [
                  ['fit', '适应窗口大小(A)'],
                  ['50', '缩放 50%(5)'],
                  ['100', '缩放 100%(1)'],
                  ['200', '缩放 200%(2)'],
                ] as const
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    setZoomPreset(preset);
                    setOpenMenu(null);
                  }}
                >
                  {zoomPreset === preset && (
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
            className={`w2k-menubar-item ${openMenu === 'play' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'play' ? null : 'play');
            }}
          >
            播放(P)
          </button>
          {openMenu === 'play' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[160px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  if (playState === 'playing') handlePause();
                  else handlePlay();
                  setOpenMenu(null);
                }}
              >
                <span>{playState === 'playing' ? '暂停(P)' : '播放(P)'}</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  handleStop();
                  setOpenMenu(null);
                }}
              >
                <span>停止(S)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  switchTrack(videoIdx - 1, true);
                  setOpenMenu(null);
                }}
              >
                <span>上一个剪辑(R)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  switchTrack(videoIdx + 1, true);
                  setOpenMenu(null);
                }}
              >
                <span>下一个剪辑(N)</span>
              </button>
              <div className="w2k-menu-sep" />
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setLoop((l) => !l);
                  setOpenMenu(null);
                }}
              >
                {loop && (
                  <span className="absolute left-2 flex items-center">
                    <PixelCheckmark />
                  </span>
                )}
                <span>循环播放(L)</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'favorites' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'favorites' ? null : 'favorites');
            }}
          >
            收藏(A)
          </button>
          {openMenu === 'favorites' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[205px]">
              {TROPICAL_VIDEOS.map((vid, idx) => (
                <button
                  key={vid.id}
                  type="button"
                  className="w2k-menu-item"
                  onClick={() => {
                    switchTrack(idx, true);
                    setOpenMenu(null);
                  }}
                >
                  {idx === videoIdx && (
                    <span className="absolute left-2 flex items-center">
                      <PixelRadioDot />
                    </span>
                  )}
                  <span className="truncate">{vid.filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`w2k-menubar-item ${openMenu === 'goto' ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(openMenu === 'goto' ? null : 'goto');
            }}
          >
            转到(G)
          </button>
          {openMenu === 'goto' && (
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[165px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  onOpenVideosFolder?.();
                  setOpenMenu(null);
                }}
              >
                <span>打开“我的视频”文件夹(V)</span>
              </button>
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowPlaylist((p) => !p);
                  setOpenMenu(null);
                }}
              >
                <span>切换播放列表(P)</span>
              </button>
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
            <div className="w2k-menu-popup absolute left-0 top-full z-30 min-w-[180px]">
              <button
                type="button"
                className="w2k-menu-item"
                onClick={() => {
                  setShowAboutModal(true);
                  setOpenMenu(null);
                }}
              >
                <span>关于 Windows Media Player(A)...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div
          aria-label="导航工具栏"
          className="h-[25px] shrink-0 flex items-center gap-1 px-1 bg-[var(--w2k-face)] border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)]"
        >
          <button
            type="button"
            title="后退"
            aria-label="后退"
            disabled
            className="w-[23px] h-[21px] p-0 flex items-center justify-center bg-transparent border border-transparent disabled:opacity-45 cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M14 7H6V4L1 8l5 4V9h8z" fill="#808080" />
            </svg>
          </button>
          <button
            type="button"
            title="前进"
            aria-label="前进"
            disabled
            className="w-[23px] h-[21px] p-0 flex items-center justify-center bg-transparent border border-transparent disabled:opacity-45 cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M2 7h8V4l5 4-5 4V9H2z" fill="#808080" />
            </svg>
          </button>
          <div className="w2k-divider-v mx-0.5" />
          <div className="ml-auto flex items-center gap-1 pr-1">
            <button
              type="button"
              title="电台"
              aria-label="电台"
              disabled
              className="h-[21px] px-1 flex items-center gap-1 bg-transparent border border-transparent text-[11px] text-[#404040] disabled:opacity-75 cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
                <path d="M6 2h1v4H6zM2 7h12v7H2z" fill="#000000" />
                <path d="M3 8h10v5H3z" fill="#D4D0C8" />
                <circle cx="8" cy="10" r="2" fill="#008080" />
                <path d="M8 6a4 4 0 0 1 4 4h-1a3 3 0 0 0-3-3z" fill="#000080" />
              </svg>
              电台
            </button>
            <button
              type="button"
              title="音乐"
              aria-label="音乐"
              disabled
              className="h-[21px] px-1 flex items-center gap-1 bg-transparent border border-transparent text-[11px] text-[#404040] disabled:opacity-75 cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
                <path d="M8 2h6v9h-1V4L8 5v7H7V4z" fill="#000000" />
                <path d="M8 3h5v1L8 5z" fill="#CC0000" />
                <ellipse cx="5" cy="12" rx="3" ry="2" fill="#008000" />
                <ellipse cx="12" cy="11" rx="2" ry="2" fill="#008000" />
              </svg>
              音乐
            </button>
            <button
              type="button"
              title="媒体指南"
              aria-label="媒体指南"
              disabled
              className="h-[21px] px-1 flex items-center gap-1 bg-transparent border border-transparent text-[11px] text-[#404040] disabled:opacity-75 cursor-default"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
                <path d="M2 2h12v12H2z" fill="#000080" />
                <path d="M3 3h10v10H3z" fill="#FFFFFF" />
                <path d="M4 4h8v5H4z" fill="#008080" />
                <path d="M4 10h7v1H4zM4 12h5v1H4z" fill="#808080" />
              </svg>
              媒体指南
            </button>
          </div>
        </div>
      )}

      {/* Main #000000 Sunken Video Viewport */}
      <div className="flex-1 min-h-0 flex flex-col m-[2px] w2k-inset bg-black overflow-hidden relative">
        <div
          className="flex-1 min-h-[64px] flex items-center justify-center bg-black relative overflow-auto"
          onClick={() => {
            if (playState === 'stopped') handlePlay();
            else handlePause();
          }}
        >
          <video
            key={activeVideo.id}
            ref={videoRef}
            playsInline
            preload="auto"
            loop={loop}
            poster={activeVideo.posterSrc}
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              if (vid.duration && Number.isFinite(vid.duration)) {
                setDuration(vid.duration);
              }
              if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                safePlayVideo();
              }
            }}
            onCanPlay={() => {
              if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                safePlayVideo();
              }
            }}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onPlay={() => setPlayState('playing')}
            onPause={() => {
              setPlayState((cur) => (cur === 'stopped' ? 'stopped' : 'paused'));
            }}
            onEnded={() => {
              if (!loop) {
                setPlayState('stopped');
                setCurrentTime(0);
              }
            }}
            className={`block bg-black ${
              zoomPreset === 'fit' ? 'w-full h-full object-contain' : 'shrink-0 object-contain'
            } ${playState === 'stopped' ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'}`}
            style={{
              ...videoDimensionStyle,
              imageRendering: 'pixelated',
            }}
          >
            <source src={activeVideo.webmSrc} type="video/webm" />
            <source src={activeVideo.mp4Src} type="video/mp4" />
          </video>

          {playState === 'stopped' && <WmpClassicLogo />}
        </div>

        {/* Optional Collapsible Classic Playlist Drawer */}
        {showPlaylist && (
          <div
            aria-label="播放列表"
            onClick={(e) => e.stopPropagation()}
            className="h-[88px] shrink min-h-[56px] bg-[#14181E] border-t border-[#404040] text-[#DCDCDC] flex flex-col"
          >
            <div className="px-2 py-0.5 bg-[var(--w2k-face)] text-black text-[11px] flex items-center justify-between border-b border-[var(--w2k-shadow)]">
              <span>播放列表 ({TROPICAL_VIDEOS.length} 个假期视频)</span>
              <button
                type="button"
                aria-label="关闭播放列表"
                onClick={() => setShowPlaylist(false)}
                className="bg-transparent border-0 p-0 text-[11px] leading-none cursor-default"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w2k-scroll p-1 space-y-0.5 text-[11px]">
              {TROPICAL_VIDEOS.map((vid, idx) => {
                const isActive = idx === videoIdx;
                return (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => switchTrack(idx, true)}
                    className={`w-full flex items-center justify-between px-2 py-0.5 text-left border-0 cursor-default ${
                      isActive
                        ? 'bg-[#0A246A] text-white'
                        : 'bg-transparent text-[#DCDCDC] hover:bg-[#232A36]'
                    }`}
                  >
                    <span className="truncate">
                      {idx + 1}. {vid.filename} ({vid.title})
                    </span>
                    <span className="tabular-nums shrink-0 ml-2">
                      {formatMediaTime(vid.durationSec)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Controls Section (Grooved Seek Bar + Transport & Triangle Volume Row) */}
      {showControls && (
        <div className="px-1.5 pt-1 pb-0.5 space-y-1">
          {/* Win32 Grooved Seek Bar matching ref-mpc64.png */}
          <div
            ref={seekTrackRef}
            role="slider"
            tabIndex={0}
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || activeVideo.durationSec)}
            aria-valuenow={Math.round(currentTime)}
            onMouseDown={(e) => startSliderDrag(e, updateSeekFromClientX)}
            className="h-[11px] relative flex items-center cursor-default"
          >
            <div className="w-full h-[2px] w2k-sunken-bar bg-[#D4D0C8]" />
            <div
              className="absolute top-[-1px] w-[9px] h-[13px] bg-[var(--w2k-face)] border-t border-l border-[var(--w2k-highlight)] border-r border-b border-[var(--w2k-dark-shadow)] shadow-[inset_-1px_-1px_0_var(--w2k-shadow),inset_1px_1px_0_var(--w2k-light)] pointer-events-none"
              style={{ left: `calc(${progressRatio * 100}% - ${progressRatio * 9}px)` }}
            />
          </div>

          {/* Transport Buttons + Ascending Triangle Volume Slider matching ref-mpc64.png */}
          <div className="flex items-center justify-between gap-1 py-[1px]">
            <div className="flex items-center gap-[1px]">
              {WMP_BTN('play', '播放', handlePlay, { active: playState === 'playing' })}
              {WMP_BTN('pause', '暂停', handlePause, { active: playState === 'paused' })}
              {WMP_BTN('stop', '停止', handleStop, { disabled: playState === 'stopped' })}
              <div className="w2k-divider-v mx-1" />
              {WMP_BTN('prev', '上一个剪辑', () => switchTrack(videoIdx - 1, true))}
              {WMP_BTN('rew', '快退 2 秒', () => handleSeekBy(-2))}
              {WMP_BTN('fwd', '快进 2 秒', () => handleSeekBy(2))}
              {WMP_BTN('next', '下一个剪辑', () => switchTrack(videoIdx + 1, true))}
              <div className="w2k-divider-v mx-1" />
              <button
                type="button"
                title="预览"
                aria-label="预览"
                onClick={handleStepFrame}
                className="w-[24px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)] cursor-default"
              >
                <WmpStepFrameIcon />
              </button>
              <div className="w2k-divider-v mx-1" />
              <button
                type="button"
                title={muted ? '取消静音' : '静音'}
                aria-label={muted ? '取消静音' : '静音'}
                onClick={() => setMuted((m) => !m)}
                className={`w-[24px] h-[22px] p-0 flex items-center justify-center bg-transparent border border-transparent cursor-default ${
                  muted
                    ? 'border-t-[var(--w2k-shadow)] border-l-[var(--w2k-shadow)] border-r-[var(--w2k-highlight)] border-b-[var(--w2k-highlight)] bg-[#E8E6E1]'
                    : 'hover:border-t-[var(--w2k-highlight)] hover:border-l-[var(--w2k-highlight)] hover:border-r-[var(--w2k-shadow)] hover:border-b-[var(--w2k-shadow)]'
                }`}
              >
                <WmpSpeakerIcon muted={muted} />
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Signature WMP 6.4 Ascending Triangle Wedge Volume Slider */}
              <div
                ref={volTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="音量"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(effectiveVol * 100)}
                onMouseDown={(e) => startSliderDrag(e, updateVolumeFromClientX)}
                className="w-[68px] h-[18px] relative flex items-center cursor-default"
              >
                <svg
                  width="68"
                  height="14"
                  viewBox="0 0 68 14"
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                  className="pointer-events-none"
                >
                  <line x1="0" y1="13" x2="67" y2="1" stroke="#808080" strokeWidth="1" />
                  <line x1="0" y1="13" x2="67" y2="13" stroke="#FFFFFF" strokeWidth="1" />
                  <line x1="67" y1="1" x2="67" y2="13" stroke="#FFFFFF" strokeWidth="1" />
                </svg>
                <div
                  className="absolute top-0 w-[9px] h-[18px] bg-[var(--w2k-face)] border-t border-l border-[var(--w2k-highlight)] border-r border-b border-[var(--w2k-dark-shadow)] shadow-[inset_-1px_-1px_0_var(--w2k-shadow)] pointer-events-none"
                  style={{ left: `calc(${effectiveVol * 100}% - ${effectiveVol * 9}px)` }}
                />
              </div>
            </div>
          </div>
          <div
            aria-label="媒体选择下拉栏"
            className="h-[19px] w2k-sunken-bar bg-white flex items-center justify-end"
          >
            <span className="h-full w-[18px] border-l border-[#808080] flex items-center justify-center bg-[var(--w2k-face)]">
              <svg width="8" height="5" viewBox="0 0 8 5" shapeRendering="crispEdges" aria-hidden="true">
                <path d="M0 0h8L4 5z" fill="#000000" />
              </svg>
            </span>
          </div>
        </div>
      )}

      {/* Signature Pure #000000 Bottom Info Panel matching ref-mpc64.png */}
      <div className="mx-[2px] mt-0.5 px-2 py-1 w2k-inset bg-black text-[#DCDCDC] font-[var(--w2k-font)]">
        <div className="grid grid-cols-[50px_minmax(0,1fr)] items-center text-[11px] leading-[14px]">
          <span className="text-right pr-1 text-white">节目:</span>
          <span className="truncate text-white">{activeVideo.title}</span>
        </div>
        <div className="h-px bg-[#505050] my-[2px]" />
        <div className="grid grid-cols-[50px_minmax(0,1fr)] items-center text-[11px] leading-[14px]">
          <span className="text-right pr-1 text-white">剪辑:</span>
          <span className="truncate">{activeVideo.filename}</span>
          <span className="text-right pr-1 text-white">作者:</span>
          <span />
          <span className="text-right pr-1 text-white">版权:</span>
          <span />
        </div>
      </div>

      <div className="mx-[2px] mb-[2px] px-2 py-[3px] w2k-inset bg-black text-[#DCDCDC] flex items-center justify-between gap-3">
        <div className="min-w-0 text-[10px] text-[#DCDCDC] truncate">
          {statusLabel} · {activeVideo.width}×{activeVideo.height} · {activeVideo.fps} fps
          {loop ? ' · 循环' : ''}
        </div>
        <div
          aria-label="播放时间"
          className="w2k-cmd-font text-[13px] text-[#E6E6E6] tabular-nums shrink-0 tracking-wider"
        >
          {formatMediaTime(currentTime)} / {formatMediaTime(duration || activeVideo.durationSec)}
        </div>
      </div>

      {/* Open Media Picker Modal */}
      {showOpenModal && (
        <div
          className="absolute inset-0 bg-black/25 flex items-center justify-center z-40"
          onClick={() => setShowOpenModal(false)}
        >
          <div
            role="dialog"
            aria-label="打开媒体文件"
            className="w2k-window-frame w-[340px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w2k-titlebar">
              <span>打开 - 我的文档\我的视频</span>
              <button
                type="button"
                className="w2k-win-btn"
                aria-label="关闭打开对话框"
                onClick={() => setShowOpenModal(false)}
              >
                <img src="/icons/ui/win-close.svg" alt="" className="w-[8px] h-[7px]" />
              </button>
            </div>
            <div className="p-2.5 bg-[var(--w2k-face)] space-y-2 text-[12px]">
              <div className="w2k-inset bg-white p-1 space-y-0.5">
                {TROPICAL_VIDEOS.map((vid, idx) => (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => {
                      switchTrack(idx, true);
                      setShowOpenModal(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-1.5 py-1 text-left border-0 cursor-default ${
                      idx === videoIdx
                        ? 'bg-[var(--w2k-selection-bg)] text-[var(--w2k-selection-text)]'
                        : 'bg-transparent text-black hover:bg-[#EEF4FC]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Win2kIcon kind="video-file" size={16} />
                      <span className="truncate">{vid.filename}</span>
                    </span>
                    <span className="text-[11px] opacity-80 shrink-0 tabular-nums">
                      {formatMediaTime(vid.durationSec)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="w2k-btn default-btn"
                  onClick={() => setShowOpenModal(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Properties / About Dialogs */}
      {(showPropsModal || showAboutModal) && (
        <div
          className="absolute inset-0 bg-black/25 flex items-center justify-center z-40"
          onClick={() => {
            setShowPropsModal(false);
            setShowAboutModal(false);
          }}
        >
          <div
            role="dialog"
            aria-label={showAboutModal ? '关于 Windows Media Player' : '媒体属性'}
            className={`w2k-window-frame ${showAboutModal ? 'w-[360px]' : 'w-[310px]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w2k-titlebar">
              <span>{showAboutModal ? '关于 Windows Media Player' : `${activeVideo.filename} 属性`}</span>
              <button
                type="button"
                className="w2k-win-btn"
                aria-label="关闭窗口"
                onClick={() => {
                  setShowPropsModal(false);
                  setShowAboutModal(false);
                }}
              >
                <img src="/icons/ui/win-close.svg" alt="" className="w-[8px] h-[7px]" />
              </button>
            </div>
            <div className="p-3 bg-[var(--w2k-face)] space-y-3 text-[12px]">
              <div className="flex items-start gap-3">
                <Win2kIcon kind="mplayer" size={32} />
                {showAboutModal ? (
                  <div className="space-y-1">
                    <div className="font-[var(--w2k-font)] text-[11px] text-black">
                      <div>Windows Media Player</div>
                      <div>版权所有 (C) 1992-1999 Microsoft Corp.</div>
                      <div>版本:  6.4.09.1109</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    <div className="font-bold text-[12px]">{activeVideo.title}</div>
                    <div>文件名: {activeVideo.filename}</div>
                    <div>
                      图像尺寸: {activeVideo.width} × {activeVideo.height} ({activeVideo.fps} fps)
                    </div>
                    <div>编解码器: {activeVideo.codecLabel}</div>
                    <div>长度: {formatMediaTime(activeVideo.durationSec)}</div>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="w2k-btn default-btn min-w-[68px]"
                  onClick={() => {
                    setShowPropsModal(false);
                    setShowAboutModal(false);
                  }}
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
