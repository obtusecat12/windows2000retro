import type { ColorScheme, ColorSchemeId, WallpaperId } from '../types/os';

export const WIN2K_COLOR_SCHEMES: Record<ColorSchemeId, ColorScheme> = {
  'win2k-standard': {
    id: 'win2k-standard',
    name: 'Windows 标准',
    desktopBg: '#3A6EA5',
    face: '#D4D0C8',
    highlight: '#FFFFFF',
    light: '#E8E6E1',
    shadow: '#808080',
    darkShadow: '#404040',
    activeTitleStart: '#0A246A',
    activeTitleEnd: '#A6CAF0',
    activeTitleText: '#FFFFFF',
    inactiveTitleStart: '#808080',
    inactiveTitleEnd: '#C0C0C0',
    inactiveTitleText: '#D4D0C8',
    windowBg: '#FFFFFF',
    windowText: '#000000',
    menuBg: '#D4D0C8',
    menuText: '#000000',
    selectionBg: '#0A246A',
    selectionText: '#FFFFFF',
  },
  'win-classic': {
    id: 'win-classic',
    name: 'Windows 经典 (98)',
    desktopBg: '#008080',
    face: '#C0C0C0',
    highlight: '#FFFFFF',
    light: '#DFDFDF',
    shadow: '#808080',
    darkShadow: '#000000',
    activeTitleStart: '#000080',
    activeTitleEnd: '#1084D0',
    activeTitleText: '#FFFFFF',
    inactiveTitleStart: '#808080',
    inactiveTitleEnd: '#B5B5B5',
    inactiveTitleText: '#C0C0C0',
    windowBg: '#FFFFFF',
    windowText: '#000000',
    menuBg: '#C0C0C0',
    menuText: '#000000',
    selectionBg: '#000080',
    selectionText: '#FFFFFF',
  },
  desert: {
    id: 'desert',
    name: '沙漠',
    desktopBg: '#808040',
    face: '#D5CCBB',
    highlight: '#EAE5DD',
    light: '#E0D9CD',
    shadow: '#A28D68',
    darkShadow: '#000000',
    activeTitleStart: '#008080',
    activeTitleEnd: '#80A8A8',
    activeTitleText: '#FFFFFF',
    inactiveTitleStart: '#A28D68',
    inactiveTitleEnd: '#D5CCBB',
    inactiveTitleText: '#D5CCBB',
    windowBg: '#FFFFFF',
    windowText: '#000000',
    menuBg: '#D5CCBB',
    menuText: '#000000',
    selectionBg: '#008080',
    selectionText: '#FFFFFF',
  },
  'rainy-day': {
    id: 'rainy-day',
    name: '雨天',
    desktopBg: '#4A5D73',
    face: '#8D9FB5',
    highlight: '#C6D0DC',
    light: '#A8B7C9',
    shadow: '#53687E',
    darkShadow: '#000000',
    activeTitleStart: '#1D334A',
    activeTitleEnd: '#6885A3',
    activeTitleText: '#FFFFFF',
    inactiveTitleStart: '#53687E',
    inactiveTitleEnd: '#8D9FB5',
    inactiveTitleText: '#C6D0DC',
    windowBg: '#FFFFFF',
    windowText: '#000000',
    menuBg: '#8D9FB5',
    menuText: '#000000',
    selectionBg: '#1D334A',
    selectionText: '#FFFFFF',
  },
  'high-contrast-black': {
    id: 'high-contrast-black',
    name: '高对比度黑',
    desktopBg: '#000000',
    face: '#000000',
    highlight: '#FFFFFF',
    light: '#C0C0C0',
    shadow: '#808080',
    darkShadow: '#FFFFFF',
    activeTitleStart: '#800080',
    activeTitleEnd: '#800080',
    activeTitleText: '#FFFFFF',
    inactiveTitleStart: '#008000',
    inactiveTitleEnd: '#008000',
    inactiveTitleText: '#FFFFFF',
    windowBg: '#000000',
    windowText: '#FFFFFF',
    menuBg: '#000000',
    menuText: '#FFFFFF',
    selectionBg: '#800080',
    selectionText: '#FFFFFF',
  },
};

export interface WallpaperDef {
  id: WallpaperId;
  name: string;
  mode: 'solid' | 'tile' | 'center' | 'stretch';
}

export const WIN2K_WALLPAPERS: WallpaperDef[] = [
  { id: 'none', name: '(无)', mode: 'solid' },
  { id: 'win2000', name: 'Windows 2000 经典徽标', mode: 'center' },
  { id: 'blue-lace', name: '蓝花边 16 (Blue Lace 16)', mode: 'tile' },
  { id: 'prairie-wind', name: '草原之风 (Prairie Wind)', mode: 'tile' },
  { id: 'boiling-point', name: '沸点 (Boiling Point)', mode: 'tile' },
  { id: 'paradise', name: '天堂 (Paradise)', mode: 'stretch' },
  { id: 'tiki-island', name: 'Tiki 海岛风光 (640×480 256色)', mode: 'stretch' },
];

export function getWallpaperStyle(wallpaperId: WallpaperId, desktopBg: string): React.CSSProperties {
  switch (wallpaperId) {
    case 'none':
      return { backgroundColor: desktopBg };
    case 'blue-lace': {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" shape-rendering="crispEdges">
        <rect width="32" height="32" fill="#2B5B84"/>
        <path d="M0 0h4v4H0zm16 0h4v4h-4zm8 8h4v4h-4zm-16 8h4v4H8zm16 8h4v4h-4z" fill="#4682B4"/>
        <path d="M4 4h4v4H4zm16 0h4v4h-4zM4 20h4v4H4zm16 0h4v4h-4z" fill="#87CEEB" opacity="0.55"/>
        <path d="M12 12h8v8h-8z" fill="none" stroke="#5B9BD5" stroke-width="1"/>
        <rect x="15" y="15" width="2" height="2" fill="#B0E0E6"/>
      </svg>`;
      return {
        backgroundColor: '#2B5B84',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
        backgroundRepeat: 'repeat',
      };
    }
    case 'prairie-wind': {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" shape-rendering="crispEdges">
        <rect width="48" height="48" fill="#4E6B48"/>
        <path d="M0 12h48M0 36h48" stroke="#3F593A" stroke-width="2"/>
        <path d="M12 0v48M36 0v48" stroke="#5F7F57" stroke-width="2"/>
        <rect x="10" y="10" width="4" height="4" fill="#8FA876"/>
        <rect x="34" y="34" width="4" height="4" fill="#8FA876"/>
        <rect x="22" y="22" width="4" height="4" fill="#A9BFA0" opacity="0.5"/>
      </svg>`;
      return {
        backgroundColor: '#4E6B48',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
        backgroundRepeat: 'repeat',
      };
    }
    case 'boiling-point': {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" shape-rendering="crispEdges">
        <rect width="40" height="40" fill="#1E3F5A"/>
        <rect x="0" y="0" width="20" height="20" fill="#264D6E"/>
        <rect x="20" y="20" width="20" height="20" fill="#264D6E"/>
        <circle cx="10" cy="10" r="4" fill="#3A6EA5"/>
        <circle cx="30" cy="30" r="4" fill="#3A6EA5"/>
        <circle cx="30" cy="10" r="2" fill="#70A1D7"/>
        <circle cx="10" cy="30" r="2" fill="#70A1D7"/>
      </svg>`;
      return {
        backgroundColor: '#1E3F5A',
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
        backgroundRepeat: 'repeat',
      };
    }
    case 'paradise': {
      return {
        background:
          'linear-gradient(180deg, #1E5799 0%, #2989D8 45%, #7DB9E8 62%, #D8C593 64%, #3B7D63 72%, #1D4D4F 100%)',
      };
    }
    case 'tiki-island': {
      return {
        backgroundColor: '#2A7CA8',
        backgroundImage: "url('/win2k-ui/tiki-island-640x480.png')",
        backgroundSize: '100% 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      };
    }
    case 'win2000':
    default: {
      return { backgroundColor: desktopBg };
    }
  }
}
