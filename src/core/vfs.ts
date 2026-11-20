import type { VfsNode } from '../types/os';
import { TROPICAL_PHOTOS, TROPICAL_VIDEOS } from './mediaCatalog';

export const ROOT_ID = 'my-computer';
export const DESKTOP_FOLDER_ID = 'folder-desktop';
export const MY_DOCS_ID = 'folder-mydocs';
export const RECYCLE_BIN_ID = 'recycle-bin';
export const NETWORK_ID = 'network-places';
export const CONTROL_PANEL_ID = 'control-panel';

export function createInitialVfs(): Record<string, VfsNode> {
  const now = '2000-05-04 14:20';
  const nodes: VfsNode[] = [
    {
      id: ROOT_ID,
      name: '我的电脑',
      type: 'virtual',
      parentId: null,
      icon: 'my-computer',
      modifiedAt: now,
    },
    {
      id: 'drive-a',
      name: '3.5 软盘 (A:)',
      type: 'drive',
      parentId: ROOT_ID,
      icon: 'drive-floppy',
      driveLetter: 'A:',
      totalSpaceMB: 1.44,
      freeSpaceMB: 1.44,
      modifiedAt: now,
    },
    {
      id: 'drive-c',
      name: '本地磁盘 (C:)',
      type: 'drive',
      parentId: ROOT_ID,
      icon: 'drive-hdd',
      driveLetter: 'C:',
      totalSpaceMB: 20480,
      freeSpaceMB: 14320,
      modifiedAt: now,
    },
    {
      id: 'drive-d',
      name: '本地磁盘 (D:)',
      type: 'drive',
      parentId: ROOT_ID,
      icon: 'drive-hdd',
      driveLetter: 'D:',
      totalSpaceMB: 40960,
      freeSpaceMB: 32800,
      modifiedAt: now,
    },
    {
      id: 'drive-e',
      name: 'Compact Disc (E:)',
      type: 'drive',
      parentId: ROOT_ID,
      icon: 'drive-cd',
      driveLetter: 'E:',
      totalSpaceMB: 650,
      freeSpaceMB: 0,
      modifiedAt: now,
    },
    {
      id: CONTROL_PANEL_ID,
      name: '控制面板',
      type: 'virtual',
      parentId: ROOT_ID,
      icon: 'control-panel',
      modifiedAt: now,
    },
    // C:\ folders
    {
      id: 'c-winnt',
      name: 'WINNT',
      type: 'folder',
      parentId: 'drive-c',
      icon: 'folder',
      modifiedAt: '2000-02-17 09:00',
    },
    {
      id: 'c-winnt-system32',
      name: 'system32',
      type: 'folder',
      parentId: 'c-winnt',
      icon: 'folder',
      modifiedAt: '2000-02-17 09:00',
    },
    {
      id: 'c-progfiles',
      name: 'Program Files',
      type: 'folder',
      parentId: 'drive-c',
      icon: 'folder',
      modifiedAt: '2000-02-17 09:05',
    },
    {
      id: 'c-progfiles-ie',
      name: 'Internet Explorer',
      type: 'folder',
      parentId: 'c-progfiles',
      icon: 'folder',
      modifiedAt: '2000-02-17 09:05',
    },
    {
      id: 'c-docs-settings',
      name: 'Documents and Settings',
      type: 'folder',
      parentId: 'drive-c',
      icon: 'folder',
      modifiedAt: '2000-02-17 09:10',
    },
    {
      id: 'c-admin',
      name: 'Administrator',
      type: 'folder',
      parentId: 'c-docs-settings',
      icon: 'folder',
      modifiedAt: '2000-02-17 09:10',
    },
    {
      id: DESKTOP_FOLDER_ID,
      name: '桌面',
      type: 'folder',
      parentId: 'c-admin',
      icon: 'folder',
      modifiedAt: now,
    },
    {
      id: MY_DOCS_ID,
      name: '我的文档',
      type: 'folder',
      parentId: 'c-admin',
      icon: 'my-documents',
      modifiedAt: now,
    },
    {
      id: 'file-boot-ini',
      name: 'boot.ini',
      type: 'file',
      parentId: 'drive-c',
      icon: 'sys-file',
      size: 211,
      attributes: 'SH',
      modifiedAt: '2000-02-17 08:55',
      content: `[boot loader]\r\ntimeout=30\r\ndefault=multi(0)disk(0)rdisk(0)partition(1)\\WINNT\r\n[operating systems]\r\nmulti(0)disk(0)rdisk(0)partition(1)\\WINNT="Microsoft Windows 2000 Professional" /fastdetect\r\n`,
    },
    {
      id: 'file-readme-sys',
      name: 'readme.txt',
      type: 'file',
      parentId: 'drive-c',
      icon: 'text-file',
      size: 486,
      modifiedAt: '2000-02-17 09:00',
      content: `Microsoft Windows 2000 Professional (Version 5.00.2195 Service Pack 4)\r\n\r\n欢迎使用 Windows 2000 简体中文版。\r\n提示：\r\n- 双击桌面图标可打开资源管理器、记事本、扫雷、计算器、命令提示符、图像处理与 Windows Media Player 等程序。\r\n- 在桌面空白处点击鼠标右键，选择“属性”可更改桌面壁纸与外观配色方案。\r\n- 在“我的文档\\我的图片”和“我的文档\\我的视频”中收藏了 2000 年海岛假期摄影与录像。\r\n`,
    },
    // My Documents files & subfolders
    {
      id: 'doc-welcome',
      name: '欢迎使用 Windows 2000.txt',
      type: 'file',
      parentId: MY_DOCS_ID,
      icon: 'text-file',
      size: 320,
      modifiedAt: '2000-05-04 14:20',
      content: `Windows 2000 Professional 简体中文版操作备忘：\n\n1. 点击左下角“开始”按钮可以浏览所有程序、文档与系统设置。\n2. 按下“显示桌面”快捷图标可以一键最小化所有打开的窗口。\n3. 尝试打开“命令提示符”，输入 help、dir、ver、ipconfig 体验经典命令行！\n`,
    },
    {
      id: 'doc-plan',
      name: '2000年工作计划.txt',
      type: 'file',
      parentId: MY_DOCS_ID,
      icon: 'text-file',
      size: 198,
      modifiedAt: '2000-03-12 10:15',
      content: `2000年第一季度工作备忘录\n========================\n1. 完成公司局域网升级至 Windows 2000 Server\n2. 备份财务数据到 3.5 英寸软盘及 D 盘\n3. 整理夏威夷海岛假期数码照片与 DV 录像\n`,
    },
    {
      id: 'doc-pics',
      name: '我的图片',
      type: 'folder',
      parentId: MY_DOCS_ID,
      icon: 'folder',
      modifiedAt: '2000-07-28 16:40',
    },
    {
      id: 'doc-pics-readme',
      name: '海岛假期照片说明.txt',
      type: 'file',
      parentId: 'doc-pics',
      icon: 'text-file',
      size: 164,
      modifiedAt: '2000-07-28 16:41',
      content: `2000年夏威夷海岛假期数码照片存档：\n使用 Sony Mavica / Kodak DC280 拍摄，双击任意位图文件可用“图像处理”打开并添加批注。\n`,
    },
    ...TROPICAL_PHOTOS.map((photo) => ({
      id: photo.id,
      name: photo.filename,
      type: 'file' as const,
      parentId: 'doc-pics',
      icon: 'image-file' as const,
      mediaId: photo.id,
      mimeKind: 'image' as const,
      size: photo.sizeBytes,
      modifiedAt: photo.date,
      content: `${photo.title}\n拍摄设备: ${photo.camera}\n分辨率: ${photo.width}×${photo.height} (${photo.colorDepth})`,
    })),
    {
      id: 'doc-videos',
      name: '我的视频',
      type: 'folder',
      parentId: MY_DOCS_ID,
      icon: 'folder',
      modifiedAt: '2000-07-28 18:10',
    },
    ...TROPICAL_VIDEOS.map((video) => ({
      id: video.id,
      name: video.filename,
      type: 'file' as const,
      parentId: 'doc-videos',
      icon: 'video-file' as const,
      mediaId: video.id,
      mimeKind: 'video' as const,
      size: video.sizeBytes,
      modifiedAt: video.date,
      content: `${video.title}\n编码格式: ${video.codecLabel}\n分辨率: ${video.width}×${video.height} (${video.fps} fps, ${video.durationSec}秒)`,
    })),
    {
      id: 'doc-music',
      name: '我的音乐',
      type: 'folder',
      parentId: MY_DOCS_ID,
      icon: 'folder',
      modifiedAt: '2000-04-12 19:00',
    },
    // D:\ Drive
    {
      id: 'd-software',
      name: '常用软件',
      type: 'folder',
      parentId: 'drive-d',
      icon: 'folder',
      modifiedAt: '2000-04-18 11:22',
    },
    {
      id: 'd-backup',
      name: '数据备份',
      type: 'folder',
      parentId: 'drive-d',
      icon: 'folder',
      modifiedAt: '2000-05-01 09:30',
    },
    {
      id: 'd-notes',
      name: '装机清单.txt',
      type: 'file',
      parentId: 'drive-d',
      icon: 'text-file',
      size: 256,
      modifiedAt: '2000-04-20 19:05',
      content: `2000年主力兼容机配置清单：\nCPU: Intel Pentium III 733MHz\n主板: ASUS CUSL2 (i815E)\n内存: 256MB SDRAM PC133\n硬盘: IBM Deskstar 40GB 7200rpm\n显卡: NVIDIA GeForce2 MX 32MB\n系统: Windows 2000 Professional 简体中文版\n`,
    },
    // E:\ CD-ROM
    {
      id: 'e-setup',
      name: 'WIN2000_SP4',
      type: 'folder',
      parentId: 'drive-e',
      icon: 'folder',
      modifiedAt: '2003-06-26 12:00',
    },
    {
      id: 'e-autorun',
      name: 'autorun.inf',
      type: 'file',
      parentId: 'drive-e',
      icon: 'sys-file',
      size: 64,
      modifiedAt: '2003-06-26 12:00',
      content: `[autorun]\r\nopen=setup.exe\r\nicon=setup.exe,0\r\n`,
    },
    // Virtual Network Places (网上邻居)
    {
      id: NETWORK_ID,
      name: '网上邻居',
      type: 'virtual',
      parentId: null,
      icon: 'network',
      modifiedAt: now,
    },
    {
      id: 'net-add-place',
      name: '添加网上邻居',
      type: 'virtual',
      parentId: NETWORK_ID,
      icon: 'add-network',
      modifiedAt: now,
    },
    {
      id: 'net-entire',
      name: '整个网络',
      type: 'folder',
      parentId: NETWORK_ID,
      icon: 'entire-network',
      modifiedAt: now,
    },
    {
      id: 'net-workgroup',
      name: 'WORKGROUP',
      type: 'folder',
      parentId: 'net-entire',
      icon: 'entire-network',
      modifiedAt: now,
    },
    {
      id: 'net-pc-office',
      name: 'PC-OFFICE (财务部主机)',
      type: 'folder',
      parentId: 'net-workgroup',
      icon: 'server',
      modifiedAt: now,
    },
    {
      id: 'net-server',
      name: 'FILESERVER-01 (文件服务器)',
      type: 'folder',
      parentId: 'net-workgroup',
      icon: 'server',
      modifiedAt: now,
    },
    {
      id: 'net-share-docs',
      name: 'FILESERVER-01 上的 共享文档',
      type: 'folder',
      parentId: NETWORK_ID,
      icon: 'share-folder',
      modifiedAt: now,
    },
    {
      id: 'net-share-soft',
      name: 'FILESERVER-01 上的 公共软件',
      type: 'folder',
      parentId: 'net-server',
      icon: 'share-folder',
      modifiedAt: now,
    },
    {
      id: 'net-share-notice',
      name: '局域网共享说明.txt',
      type: 'file',
      parentId: 'net-share-docs',
      icon: 'text-file',
      size: 245,
      modifiedAt: '2000-05-03 11:00',
      content: `\\\\FILESERVER-01\\共享文档\n\n局域网工作组：WORKGROUP\n文件协议：SMB / NetBIOS over TCP/IP\n提示：您可以像本地文件夹一样直接打开、编辑或复制网络共享文档。\n`,
    },
    {
      id: 'net-share-soft-list',
      name: '装机必备软件列表.txt',
      type: 'file',
      parentId: 'net-share-soft',
      icon: 'text-file',
      size: 210,
      modifiedAt: '2000-04-28 15:40',
      content: `2000年装机必备目录：\n1. Winamp 2.64 简体中文版\n2. WinZip 8.0 / WinRAR 2.71\n3. 东方快车 2000\n4. QQ2000 (OICQ 2000 Build 0515)\n5. 豪杰超级解霸 2000\n`,
    },
    {
      id: 'net-office-report',
      name: '2000年部门通讯录.txt',
      type: 'file',
      parentId: 'net-pc-office',
      icon: 'text-file',
      size: 168,
      modifiedAt: '2000-05-02 09:20',
      content: `总机分机表：\n信息中心：8001\n行政办公：8002\n技术支持：8008\n`,
    },
    {
      id: 'net-printer',
      name: 'HP LaserJet 1100 (共享打印机)',
      type: 'file',
      parentId: NETWORK_ID,
      icon: 'net-printer',
      size: 0,
      modifiedAt: now,
      content: '网络共享打印机端口: \\\\FILESERVER-01\\HPLJ1100\n状态: 就绪 (空闲)\n驱动程序: HP LaserJet 1100 (MS)',
    },
    {
      id: RECYCLE_BIN_ID,
      name: '回收站',
      type: 'virtual',
      parentId: null,
      icon: 'recycle-empty',
      modifiedAt: now,
    },
  ];

  const map: Record<string, VfsNode> = {};
  for (const node of nodes) {
    map[node.id] = node;
  }
  return map;
}

export function listChildren(vfs: Record<string, VfsNode>, parentId: string): VfsNode[] {
  return Object.values(vfs)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => {
      const rank = (n: VfsNode) =>
        n.type === 'drive' ? 0 : n.type === 'folder' || n.type === 'virtual' ? 1 : 2;
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
}

export function getDisplayPath(vfs: Record<string, VfsNode>, nodeId: string): string {
  const node = vfs[nodeId];
  if (!node) return '我的电脑';
  if (nodeId === ROOT_ID) return '我的电脑';
  if (nodeId === MY_DOCS_ID) return '我的文档';
  if (nodeId === NETWORK_ID) return '网上邻居';
  if (nodeId === RECYCLE_BIN_ID) return '回收站';
  if (nodeId === CONTROL_PANEL_ID) return '控制面板';

  const parts: string[] = [];
  let curr: VfsNode | undefined = node;
  while (curr && curr.id !== ROOT_ID) {
    if (curr.type === 'drive' && curr.driveLetter) {
      parts.unshift(curr.driveLetter);
      break;
    }
    if (curr.parentId === null) {
      parts.unshift(curr.name);
      break;
    }
    parts.unshift(curr.name);
    curr = curr.parentId ? vfs[curr.parentId] : undefined;
  }
  if (parts.length === 1 && parts[0].endsWith(':')) {
    return `${parts[0]}\\`;
  }
  return parts.join('\\');
}

export function resolveDosPath(
  vfs: Record<string, VfsNode>,
  cwdId: string,
  targetPath: string
): string | null {
  const raw = targetPath.trim().replace(/\//g, '\\');
  if (!raw || raw === '.') return cwdId;

  if (raw === '\\') {
    // Go to root of current drive
    let curr: VfsNode | undefined = vfs[cwdId];
    while (curr && curr.type !== 'drive' && curr.parentId) {
      curr = vfs[curr.parentId];
    }
    return curr && curr.type === 'drive' ? curr.id : 'drive-c';
  }

  let currentId = cwdId;
  let segments = raw.split('\\').filter(Boolean);

  // Handle drive prefix e.g. C:\WINNT or D:
  if (segments.length > 0 && /^[a-zA-Z]:$/.test(segments[0])) {
    const letter = segments[0].toUpperCase();
    const drive = Object.values(vfs).find(
      (n) => n.type === 'drive' && n.driveLetter?.toUpperCase() === letter
    );
    if (!drive) return null;
    currentId = drive.id;
    segments = segments.slice(1);
  } else if (raw.startsWith('\\')) {
    const driveRoot = resolveDosPath(vfs, cwdId, '\\');
    if (driveRoot) currentId = driveRoot;
  }

  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') {
      const curr = vfs[currentId];
      if (!curr || curr.type === 'drive' || !curr.parentId || curr.parentId === ROOT_ID) {
        continue;
      }
      currentId = curr.parentId;
      continue;
    }
    const child = Object.values(vfs).find(
      (n) => n.parentId === currentId && n.name.toLowerCase() === seg.toLowerCase()
    );
    if (!child) return null;
    currentId = child.id;
  }

  return currentId;
}

export function getParentFolderId(vfs: Record<string, VfsNode>, nodeId: string): string | null {
  const node = vfs[nodeId];
  if (!node) return null;
  if (nodeId === ROOT_ID || nodeId === NETWORK_ID || nodeId === RECYCLE_BIN_ID) return null;
  if (nodeId === MY_DOCS_ID) return DESKTOP_FOLDER_ID ? ROOT_ID : null;
  return node.parentId;
}

export function createNode(
  vfs: Record<string, VfsNode>,
  parentId: string,
  name: string,
  type: 'folder' | 'file',
  content = ''
): { nextVfs: Record<string, VfsNode>; created: VfsNode } {
  const existingNames = new Set(listChildren(vfs, parentId).map((n) => n.name.toLowerCase()));
  let finalName = name;
  let counter = 2;
  while (existingNames.has(finalName.toLowerCase())) {
    if (type === 'file' && name.includes('.')) {
      const dot = name.lastIndexOf('.');
      finalName = `${name.slice(0, dot)} (${counter})${name.slice(dot)}`;
    } else {
      finalName = `${name} (${counter})`;
    }
    counter += 1;
  }

  const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const created: VfsNode = {
    id,
    name: finalName,
    type,
    parentId,
    icon: type === 'folder' ? 'folder' : 'text-file',
    content: type === 'file' ? content : undefined,
    size: type === 'file' ? new TextEncoder().encode(content).length : undefined,
    modifiedAt: timestamp,
  };

  return {
    nextVfs: { ...vfs, [id]: created },
    created,
  };
}

export function updateFileContent(
  vfs: Record<string, VfsNode>,
  fileId: string,
  content: string
): Record<string, VfsNode> {
  const existing = vfs[fileId];
  if (!existing || existing.type !== 'file') return vfs;
  return {
    ...vfs,
    [fileId]: {
      ...existing,
      content,
      size: new TextEncoder().encode(content).length,
      modifiedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    },
  };
}

export function renameNode(
  vfs: Record<string, VfsNode>,
  nodeId: string,
  newName: string
): Record<string, VfsNode> {
  const trimmed = newName.trim();
  const node = vfs[nodeId];
  if (!node || !trimmed || node.type === 'drive' || node.type === 'virtual') return vfs;
  return {
    ...vfs,
    [nodeId]: {
      ...node,
      name: trimmed,
    },
  };
}

export function deleteToRecycleBin(
  vfs: Record<string, VfsNode>,
  nodeId: string
): Record<string, VfsNode> {
  const node = vfs[nodeId];
  if (!node || node.type === 'drive' || node.type === 'virtual') return vfs;

  if (node.parentId === RECYCLE_BIN_ID) {
    // Permanently delete node and descendants
    const next = { ...vfs };
    const removeRecursive = (id: string) => {
      for (const child of Object.values(next)) {
        if (child.parentId === id) removeRecursive(child.id);
      }
      delete next[id];
    };
    removeRecursive(nodeId);
    return next;
  }

  return {
    ...vfs,
    [nodeId]: {
      ...node,
      originalParentId: node.parentId,
      parentId: RECYCLE_BIN_ID,
    },
  };
}

export function restoreFromRecycleBin(
  vfs: Record<string, VfsNode>,
  nodeId: string
): Record<string, VfsNode> {
  const node = vfs[nodeId];
  if (!node || node.parentId !== RECYCLE_BIN_ID) return vfs;
  const targetParent =
    node.originalParentId && vfs[node.originalParentId] ? node.originalParentId : MY_DOCS_ID;
  return {
    ...vfs,
    [nodeId]: {
      ...node,
      parentId: targetParent,
      originalParentId: undefined,
    },
  };
}

export function emptyRecycleBin(vfs: Record<string, VfsNode>): Record<string, VfsNode> {
  const next = { ...vfs };
  const recycledIds = Object.values(next)
    .filter((n) => n.parentId === RECYCLE_BIN_ID)
    .map((n) => n.id);
  const removeRecursive = (id: string) => {
    for (const child of Object.values(next)) {
      if (child.parentId === id) removeRecursive(child.id);
    }
    delete next[id];
  };
  for (const id of recycledIds) {
    removeRecursive(id);
  }
  return next;
}

function isDescendantOrSelf(
  vfs: Record<string, VfsNode>,
  ancestorId: string,
  targetId: string
): boolean {
  let curr: VfsNode | undefined = vfs[targetId];
  while (curr) {
    if (curr.id === ancestorId) return true;
    curr = curr.parentId ? vfs[curr.parentId] : undefined;
  }
  return false;
}

export function copyNode(
  vfs: Record<string, VfsNode>,
  sourceId: string,
  targetParentId: string
): { nextVfs: Record<string, VfsNode>; copiedId: string | null } {
  const source = vfs[sourceId];
  const targetParent = vfs[targetParentId];
  if (
    !source ||
    !targetParent ||
    source.type === 'drive' ||
    source.type === 'virtual' ||
    targetParent.type === 'file' ||
    isDescendantOrSelf(vfs, sourceId, targetParentId)
  ) {
    return { nextVfs: vfs, copiedId: null };
  }

  let next = { ...vfs };

  const cloneRecursive = (nodeId: string, parentId: string, isRoot: boolean): string => {
    const orig = vfs[nodeId];
    const existingNames = new Set(
      listChildren(next, parentId).map((n) => n.name.toLowerCase())
    );
    let finalName = orig.name;
    if (isRoot && existingNames.has(finalName.toLowerCase())) {
      const base = `复件 ${orig.name}`;
      finalName = base;
      let counter = 2;
      while (existingNames.has(finalName.toLowerCase())) {
        finalName = `复件 (${counter}) ${orig.name}`;
        counter += 1;
      }
    }
    const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    next[newId] = {
      ...orig,
      id: newId,
      name: finalName,
      parentId,
      originalParentId: undefined,
    };
    for (const child of listChildren(vfs, nodeId)) {
      cloneRecursive(child.id, newId, false);
    }
    return newId;
  };

  const copiedId = cloneRecursive(sourceId, targetParentId, true);
  return { nextVfs: next, copiedId };
}

export function moveNode(
  vfs: Record<string, VfsNode>,
  sourceId: string,
  targetParentId: string
): Record<string, VfsNode> {
  const source = vfs[sourceId];
  const targetParent = vfs[targetParentId];
  if (
    !source ||
    !targetParent ||
    source.type === 'drive' ||
    source.type === 'virtual' ||
    targetParent.type === 'file' ||
    source.parentId === targetParentId ||
    isDescendantOrSelf(vfs, sourceId, targetParentId)
  ) {
    return vfs;
  }

  const existingNames = new Set(
    listChildren(vfs, targetParentId).map((n) => n.name.toLowerCase())
  );
  let finalName = source.name;
  let counter = 2;
  while (existingNames.has(finalName.toLowerCase())) {
    if (source.type === 'file' && source.name.includes('.')) {
      const dot = source.name.lastIndexOf('.');
      finalName = `${source.name.slice(0, dot)} (${counter})${source.name.slice(dot)}`;
    } else {
      finalName = `${source.name} (${counter})`;
    }
    counter += 1;
  }

  return {
    ...vfs,
    [sourceId]: {
      ...source,
      name: finalName,
      parentId: targetParentId,
      originalParentId: undefined,
    },
  };
}

