import type { AppId, VfsNode } from '../types/os';

export interface TropicalPhoto {
  id: string;
  filename: string;
  title: string;
  date: string;
  width: number;
  height: number;
  colorDepth: string;
  camera: string;
  sizeBytes: number;
  src: string;
  thumbSrc: string;
}

export interface TropicalVideo {
  id: string;
  filename: string;
  title: string;
  date: string;
  width: number;
  height: number;
  fps: number;
  codecLabel: string;
  durationSec: number;
  sizeBytes: number;
  webmSrc: string;
  mp4Src: string;
  posterSrc: string;
}

export const TROPICAL_PHOTOS: TropicalPhoto[] = [
  {
    id: 'photo-tiki-beach-2000',
    filename: 'DSCN0014_海岛泻湖.bmp',
    title: '夏威夷热带泻湖沙滩 (2000年春)',
    date: '2000-05-04 14:20',
    width: 640,
    height: 480,
    colorDepth: '16位高彩',
    camera: 'Sony Mavica MVC-FD88',
    sizeBytes: 921654,
    src: '/media/photos/tiki_beach_2000.png',
    thumbSrc: '/media/photos/tiki_beach_2000_thumb.png',
  },
  {
    id: 'photo-tiki-sunset-bar',
    filename: 'DSCN0028_夕阳Tiki吧.bmp',
    title: '日落茅草凉亭与海滨火焰炬',
    date: '2000-07-24 18:45',
    width: 640,
    height: 480,
    colorDepth: '16位高彩',
    camera: 'Sony Mavica MVC-FD88',
    sizeBytes: 921654,
    src: '/media/photos/tiki_sunset_bar.png',
    thumbSrc: '/media/photos/tiki_sunset_bar_thumb.png',
  },
  {
    id: 'photo-tiki-cocktail-deck',
    filename: 'DSCN0035_热带鸡尾酒.bmp',
    title: '海景木露台 Mai Tai 热带特饮',
    date: '2000-07-25 15:10',
    width: 640,
    height: 480,
    colorDepth: '16位高彩',
    camera: 'Kodak DC280 Zoom',
    sizeBytes: 921654,
    src: '/media/photos/tiki_cocktail_deck.png',
    thumbSrc: '/media/photos/tiki_cocktail_deck_thumb.png',
  },
  {
    id: 'photo-tiki-volcano-cove',
    filename: 'DSCN0042_火山海湾.bmp',
    title: '可爱岛翡翠火山峡湾游船码头',
    date: '2000-07-26 11:30',
    width: 640,
    height: 480,
    colorDepth: '16位高彩',
    camera: 'Kodak DC280 Zoom',
    sizeBytes: 921654,
    src: '/media/photos/tiki_volcano_cove.png',
    thumbSrc: '/media/photos/tiki_volcano_cove_thumb.png',
  },
  {
    id: 'photo-tiki-hammock-palms',
    filename: 'DSCN0051_棕榈吊床湾.bmp',
    title: '午后双椰树吊床与白色贝壳滩',
    date: '2000-07-27 16:05',
    width: 640,
    height: 480,
    colorDepth: '16位高彩',
    camera: 'Olympus C-2020Z',
    sizeBytes: 921654,
    src: '/media/photos/tiki_hammock_palms.png',
    thumbSrc: '/media/photos/tiki_hammock_palms_thumb.png',
  },
  {
    id: 'photo-tiki-island-palms',
    filename: 'DSCN0060_椰林沙滩.bmp',
    title: '千禧海岛假日明信片风光照',
    date: '2000-05-01 12:00',
    width: 640,
    height: 480,
    colorDepth: '16位高彩',
    camera: 'Windows 2000 示例图片',
    sizeBytes: 308278,
    src: '/media/photos/tiki_island_palms.png',
    thumbSrc: '/media/photos/tiki_island_palms_thumb.png',
  },
];

export const TROPICAL_VIDEOS: TropicalVideo[] = [
  {
    id: 'video-tiki-lagoon-2000',
    filename: '热带泻湖假期_2000.avi',
    title: '2000夏威夷泻湖DV实拍',
    date: '2000-05-04 14:20',
    width: 320,
    height: 240,
    fps: 15,
    codecLabel: 'Video for Windows (Cinepak)',
    durationSec: 8,
    sizeBytes: 1843200,
    webmSrc: '/media/videos/tiki_lagoon_2000.webm',
    mp4Src: '/media/videos/tiki_lagoon_2000.mp4',
    posterSrc: '/media/photos/tiki_beach_2000.png',
  },
  {
    id: 'video-tiki-sunset-torches',
    filename: '夏威夷日落篝火.mpg',
    title: '黄昏海滨Tiki篝火实录',
    date: '2000-07-24 19:05',
    width: 320,
    height: 240,
    fps: 15,
    codecLabel: 'MPEG-1 视频 (352kbps)',
    durationSec: 8,
    sizeBytes: 1568400,
    webmSrc: '/media/videos/tiki_sunset_torches.webm',
    mp4Src: '/media/videos/tiki_sunset_torches.mp4',
    posterSrc: '/media/photos/tiki_sunset_bar.png',
  },
  {
    id: 'video-tropical-tour-2000',
    filename: '2000热带风情游记.avi',
    title: '千禧热带群岛观光指南 CD-ROM',
    date: '2000-07-28 10:15',
    width: 320,
    height: 240,
    fps: 15,
    codecLabel: 'Microsoft Video 1 / PCM',
    durationSec: 10,
    sizeBytes: 2421760,
    webmSrc: '/media/videos/tropical_tour_2000.webm',
    mp4Src: '/media/videos/tropical_tour_2000.mp4',
    posterSrc: '/media/photos/tiki_volcano_cove.png',
  },
];

export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return ((current + delta) % length + length) % length;
}

export function clampZoomPercent(zoom: number): number {
  return Math.max(25, Math.min(400, Math.round(zoom)));
}

export function getAppForVfsNode(
  node: Pick<VfsNode, 'type' | 'name' | 'mimeKind'>
): { appId: AppId; mimeKind?: 'image' | 'video' } {
  if (node.type === 'drive' || node.type === 'folder' || node.type === 'virtual') {
    return { appId: 'explorer' };
  }
  const lower = node.name.toLowerCase();
  if (
    node.mimeKind === 'image' ||
    lower.endsWith('.bmp') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.tif')
  ) {
    return { appId: 'imaging', mimeKind: 'image' };
  }
  if (
    node.mimeKind === 'video' ||
    lower.endsWith('.avi') ||
    lower.endsWith('.mpg') ||
    lower.endsWith('.mpeg') ||
    lower.endsWith('.wmv') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mp4')
  ) {
    return { appId: 'mplayer', mimeKind: 'video' };
  }
  return { appId: 'notepad' };
}
