export type AppId =
  | 'explorer'
  | 'notepad'
  | 'minesweeper'
  | 'calculator'
  | 'paint'
  | 'cmd'
  | 'ie'
  | 'display'
  | 'system'
  | 'taskmgr'
  | 'run'
  | 'shutdown'
  | 'about'
  | 'help'
  | 'sndvol'
  | 'timedate'
  | 'netstatus'
  | 'royal-hawaii'
  | 'palm-bath'
  | 'imaging'
  | 'mplayer';

export type IconKind =
  | 'my-computer'
  | 'my-documents'
  | 'network'
  | 'recycle-empty'
  | 'recycle-full'
  | 'ie'
  | 'notepad'
  | 'minesweeper'
  | 'calculator'
  | 'paint'
  | 'cmd'
  | 'control-panel'
  | 'folder'
  | 'folder-open'
  | 'drive-floppy'
  | 'drive-hdd'
  | 'drive-cd'
  | 'text-file'
  | 'sys-file'
  | 'help'
  | 'search'
  | 'run'
  | 'shutdown'
  | 'logoff'
  | 'taskmgr'
  | 'display'
  | 'system'
  | 'printer'
  | 'programs'
  | 'windows-update'
  | 'add-network'
  | 'entire-network'
  | 'server'
  | 'share-folder'
  | 'net-printer'
  | 'timedate'
  | 'royal-hawaii'
  | 'palm-bath'
  | 'imaging'
  | 'image-file'
  | 'mplayer'
  | 'video-file';

export interface VfsNode {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'drive' | 'virtual';
  parentId: string | null;
  icon?: IconKind;
  content?: string;
  mediaId?: string;
  mimeKind?: 'image' | 'video';
  size?: number;
  modifiedAt: string;
  originalParentId?: string | null;
  attributes?: string;
  driveLetter?: string;
  totalSpaceMB?: number;
  freeSpaceMB?: number;
}

export interface WindowState {
  id: string;
  appId: AppId;
  title: string;
  icon: IconKind;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  resizable: boolean;
  maximizable: boolean;
  minimizable: boolean;
  payload?: {
    path?: string;
    fileId?: string;
    fileName?: string;
    mediaId?: string;
    initialUrl?: string;
    initialTab?: string;
    autoPlay?: boolean;
  };
}

export type WallpaperId =
  | 'none'
  | 'win2000'
  | 'blue-lace'
  | 'prairie-wind'
  | 'boiling-point'
  | 'paradise'
  | 'tiki-island';

export type ColorSchemeId =
  | 'win2k-standard'
  | 'win-classic'
  | 'desert'
  | 'rainy-day'
  | 'high-contrast-black';

export interface ColorScheme {
  id: ColorSchemeId;
  name: string;
  desktopBg: string;
  face: string;
  highlight: string;
  shadow: string;
  darkShadow: string;
  light: string;
  activeTitleStart: string;
  activeTitleEnd: string;
  activeTitleText: string;
  inactiveTitleStart: string;
  inactiveTitleEnd: string;
  inactiveTitleText: string;
  windowBg: string;
  windowText: string;
  menuBg: string;
  menuText: string;
  selectionBg: string;
  selectionText: string;
}

export type SystemPowerState =
  | 'running'
  | 'booting'
  | 'sas-prompt'
  | 'logon'
  | 'loading-settings'
  | 'saving-settings'
  | 'shutting-down'
  | 'halted';

export type ImeId = 'quanpin' | 'abc' | 'mspinyin' | 'en';

export interface NetworkConnectionState {
  enabled: boolean;
  speedMbps: string;
  durationSeconds: number;
  packetsSent: number;
  packetsReceived: number;
  activityTick: number;
}

export type DesktopIconSort = 'name' | 'type' | 'size' | 'date';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  bold?: boolean;
  separator?: boolean;
  checked?: boolean;
  radio?: boolean;
  shortcut?: string;
  action?: () => void;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}
