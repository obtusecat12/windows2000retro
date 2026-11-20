import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copyNode,
  createInitialVfs,
  createNode,
  deleteToRecycleBin,
  emptyRecycleBin,
  getDisplayPath,
  listChildren,
  moveNode,
  MY_DOCS_ID,
  NETWORK_ID,
  RECYCLE_BIN_ID,
  resolveDosPath,
  restoreFromRecycleBin,
} from './vfs';
import {
  createEmptyBoard,
  cycleMark,
  MINE_DIFFICULTIES,
  placeMinesSafe,
  revealCell,
} from './minesweeper';
import {
  calcBinaryOp,
  calcClearAll,
  calcEquals,
  calcInputDigit,
  calcMemory,
  calcUnary,
  createCalcState,
} from './calculator';
import { executeCmdCommand } from './cmd';
import {
  buildCalendarMatrix,
  formatConnectionDuration,
  tickNetworkStats,
  transitionPowerState,
} from './systemState';
import { WIN2K_WALLPAPERS, getWallpaperStyle } from './themes';

test('VFS: create, recycle, restore, and empty cycle works cleanly', () => {
  const vfs0 = createInitialVfs();
  const { nextVfs: vfs1, created } = createNode(vfs0, MY_DOCS_ID, '测试笔记.txt', 'file', '你好 2000');
  assert.equal(listChildren(vfs1, MY_DOCS_ID).some((n) => n.id === created.id), true);

  const vfs2 = deleteToRecycleBin(vfs1, created.id);
  assert.equal(listChildren(vfs2, RECYCLE_BIN_ID).some((n) => n.id === created.id), true);
  assert.equal(listChildren(vfs2, MY_DOCS_ID).some((n) => n.id === created.id), false);

  const vfs3 = restoreFromRecycleBin(vfs2, created.id);
  assert.equal(listChildren(vfs3, MY_DOCS_ID).some((n) => n.id === created.id), true);

  const vfs4 = deleteToRecycleBin(vfs3, created.id);
  const vfs5 = emptyRecycleBin(vfs4);
  assert.equal(listChildren(vfs5, RECYCLE_BIN_ID).length, 0);
});

test('VFS: copyNode, moveNode, and Network Places hierarchy work cleanly', () => {
  const vfs0 = createInitialVfs();
  const netItems = listChildren(vfs0, NETWORK_ID);
  assert.equal(netItems.some((n) => n.id === 'net-entire'), true);
  assert.equal(netItems.some((n) => n.id === 'net-add-place'), true);
  assert.equal(getDisplayPath(vfs0, 'net-workgroup'), '网上邻居\\整个网络\\WORKGROUP');

  const { nextVfs: vfs1, copiedId } = copyNode(vfs0, 'doc-welcome', MY_DOCS_ID);
  assert.ok(copiedId);
  assert.equal(vfs1[copiedId!].name, '复件 欢迎使用 Windows 2000.txt');

  const vfs2 = moveNode(vfs1, copiedId!, 'drive-d');
  assert.equal(vfs2[copiedId!].parentId, 'drive-d');
  assert.equal(listChildren(vfs2, MY_DOCS_ID).some((n) => n.id === copiedId), false);
});

test('VFS: DOS path resolution handles relative and drive paths', () => {
  const vfs = createInitialVfs();
  const winntId = resolveDosPath(vfs, 'drive-c', 'WINNT\\system32');
  assert.equal(winntId, 'c-winnt-system32');
  assert.equal(getDisplayPath(vfs, winntId!), 'C:\\WINNT\\system32');

  const backToC = resolveDosPath(vfs, winntId!, '..\\..');
  assert.equal(backToC, 'drive-c');
});

test('Minesweeper: first click is always safe and flood-fill reveals board', () => {
  let state = createEmptyBoard(MINE_DIFFICULTIES.beginner);
  state = revealCell(state, 4, 4, () => 0.123);
  assert.equal(state.status, 'playing');
  assert.equal(state.board[4][4].hasMine, false);
  assert.equal(state.board[4][4].revealed, true);

  let mineCount = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.hasMine) mineCount++;
    }
  }
  assert.equal(mineCount, 10);
});

test('Minesweeper: flag and question cycle updates flag counter', () => {
  let state = createEmptyBoard(MINE_DIFFICULTIES.beginner);
  state = placeMinesSafe(state, 0, 0, () => 0.5);
  state = cycleMark(state, 1, 1, true);
  assert.equal(state.board[1][1].mark, 'flag');
  assert.equal(state.flagsCount, 1);

  state = cycleMark(state, 1, 1, true);
  assert.equal(state.board[1][1].mark, 'question');
  assert.equal(state.flagsCount, 0);

  state = cycleMark(state, 1, 1, true);
  assert.equal(state.board[1][1].mark, 'none');
});

test('Calculator: arithmetic, unary sqrt, memory, and division by zero', () => {
  let c = createCalcState();
  c = calcInputDigit(c, '1');
  c = calcInputDigit(c, '2');
  c = calcBinaryOp(c, '+');
  c = calcInputDigit(c, '8');
  c = calcEquals(c);
  assert.equal(c.display, '20');

  c = calcMemory(c, 'MS');
  c = calcClearAll(c);
  c = calcMemory(c, 'MR');
  assert.equal(c.display, '20');

  c = calcInputDigit(calcClearAll(c), '9');
  c = calcUnary(c, 'sqrt');
  assert.equal(c.display, '3');

  c = calcBinaryOp(c, '/');
  c = calcInputDigit(c, '0');
  c = calcEquals(c);
  assert.equal(c.error, true);
});

test('CMD: ver, cd, dir, mkdir, and type work against VFS', () => {
  const vfs = createInitialVfs();
  const verRes = executeCmdCommand('ver', 'drive-c', vfs);
  assert.equal(verRes.output.some((l) => l.includes('5.00.2195')), true);

  const cdRes = executeCmdCommand('cd WINNT', 'drive-c', vfs);
  assert.equal(cdRes.nextCwdId, 'c-winnt');

  const mdRes = executeCmdCommand('mkdir TestDir', 'drive-c', vfs);
  assert.equal(listChildren(mdRes.nextVfs, 'drive-c').some((n) => n.name === 'TestDir'), true);

  const typeRes = executeCmdCommand('type boot.ini', 'drive-c', vfs);
  assert.equal(typeRes.output.some((l) => l.includes('Windows 2000 Professional')), true);
});

test('SystemState: power lifecycle, network stats, and calendar matrix work cleanly', () => {
  let power = transitionPowerState('booting', 'boot-complete');
  assert.equal(power, 'sas-prompt');
  power = transitionPowerState(power, 'press-cad');
  assert.equal(power, 'logon');
  power = transitionPowerState(power, 'submit-login');
  assert.equal(power, 'loading-settings');
  power = transitionPowerState(power, 'settings-loaded');
  assert.equal(power, 'running');
  power = transitionPowerState(power, 'request-logoff');
  assert.equal(power, 'saving-settings');
  power = transitionPowerState(power, 'settings-saved');
  assert.equal(power, 'logon');

  assert.equal(formatConnectionDuration(3661), '01:01:01');
  const net0 = {
    enabled: true,
    speedMbps: '100.0 Mbps',
    durationSeconds: 10,
    packetsSent: 100,
    packetsReceived: 200,
    activityTick: 0,
  };
  const net1 = tickNetworkStats(net0);
  assert.equal(net1.durationSeconds, 11);
  assert.equal(net1.packetsSent, 102);

  const disabled = tickNetworkStats({ ...net0, enabled: false });
  assert.equal(disabled.packetsSent, 100);

  const cal = buildCalendarMatrix(2000, 1); // Feb 2000 (leap year)
  assert.equal(cal.length, 42);
  const currentDays = cal.filter((c) => c.inCurrentMonth);
  assert.equal(currentDays.length, 29);
});

test('Themes: Tiki island 640x480 256-color wallpaper and classic solid teal-blue resolve cleanly', () => {
  assert.equal(WIN2K_WALLPAPERS.some((w) => w.id === 'tiki-island'), true);
  const tikiStyle = getWallpaperStyle('tiki-island', '#3A6EA5');
  assert.equal(tikiStyle.backgroundImage?.includes('tiki-island-640x480.png'), true);
  assert.equal(tikiStyle.backgroundSize, '100% 100%');
  assert.equal(tikiStyle.imageRendering, 'pixelated');

  const noneStyle = getWallpaperStyle('none', '#3A6EA5');
  assert.equal(noneStyle.backgroundColor, '#3A6EA5');
  assert.equal(noneStyle.backgroundImage, undefined);
});

test('VFS: Desktop ShellNew items create cleanly and recycle bin empties completely', () => {
  const vfs0 = createInitialVfs();
  const { nextVfs: vfs1, created: folderNode } = createNode(vfs0, 'folder-desktop', '我的公文包', 'folder');
  const { nextVfs: vfs2, created: lnkNode } = createNode(vfs1, 'folder-desktop', '新建快捷方式.lnk', 'file', '');
  const { nextVfs: vfs3, created: bmpNode } = createNode(vfs2, 'folder-desktop', '新建 BMP 图像.bmp', 'file', '');
  assert.equal(listChildren(vfs3, 'folder-desktop').length >= 3, true);

  let next = deleteToRecycleBin(vfs3, folderNode.id);
  next = deleteToRecycleBin(next, lnkNode.id);
  next = deleteToRecycleBin(next, bmpNode.id);
  assert.equal(listChildren(next, RECYCLE_BIN_ID).length, 3);

  next = emptyRecycleBin(next);
  assert.equal(listChildren(next, RECYCLE_BIN_ID).length, 0);
});

import {
  TROPICAL_PHOTOS,
  TROPICAL_VIDEOS,
  clampZoomPercent,
  cycleIndex,
  formatMediaTime,
  getAppForVfsNode,
} from './mediaCatalog';

test('MediaCatalog: tropical photos, videos, formatters, and VFS associations work cleanly', () => {
  assert.equal(TROPICAL_PHOTOS.length, 6);
  assert.equal(TROPICAL_VIDEOS.length, 3);
  assert.equal(formatMediaTime(0), '00:00');
  assert.equal(formatMediaTime(65.9), '01:05');
  assert.equal(formatMediaTime(-3), '00:00');

  assert.equal(cycleIndex(0, -1, 6), 5);
  assert.equal(cycleIndex(5, 1, 6), 0);
  assert.equal(clampZoomPercent(10), 25);
  assert.equal(clampZoomPercent(550), 400);

  const vfs = createInitialVfs();
  const picChildren = listChildren(vfs, 'doc-pics');
  const vidChildren = listChildren(vfs, 'doc-videos');
  assert.equal(picChildren.filter((n) => n.mimeKind === 'image').length, 6);
  assert.equal(vidChildren.filter((n) => n.mimeKind === 'video').length, 3);

  const firstPhoto = picChildren.find((n) => n.mimeKind === 'image')!;
  const firstVideo = vidChildren.find((n) => n.mimeKind === 'video')!;
  assert.equal(getAppForVfsNode(firstPhoto).appId, 'imaging');
  assert.equal(getAppForVfsNode(firstVideo).appId, 'mplayer');
  assert.equal(getAppForVfsNode({ type: 'file', name: 'notes.txt' }).appId, 'notepad');
  assert.equal(getAppForVfsNode({ type: 'folder', name: '我的图片' }).appId, 'explorer');
});

import { TROPICAL_VIDEO_GEN_SPECS, buildRetroTranscodeArgs } from './videoGenSpecs';

test('VideoGenSpecs: specs match catalog and build 320x240 15fps retro ffmpeg arguments', () => {
  assert.equal(TROPICAL_VIDEO_GEN_SPECS.length, 3);
  for (const spec of TROPICAL_VIDEO_GEN_SPECS) {
    assert.equal(TROPICAL_VIDEOS.some((v) => v.id === spec.id), true);
    const { webmArgs, mp4Args } = buildRetroTranscodeArgs({
      inputPath: '/tmp/in.mp4',
      outputWebmPath: '/tmp/out.webm',
      outputMp4Path: '/tmp/out.mp4',
      hasAudioStream: false,
      fontPath: '/app/applet/public/fonts/fixedsys-excelsior-301.ttf',
      spec,
    });
    assert.equal(webmArgs.includes('scale=320:240:flags=bilinear,fps=15,eq=contrast=1.06:saturation=0.92,noise=alls=5:allf=t') || webmArgs.some((a) => a.includes('scale=320:240:flags=bilinear') && a.includes('fps=15')), true);
    assert.equal(mp4Args.includes('libx264'), true);
    assert.equal(webmArgs.includes('libvpx'), true);
  }
});

import {
  TROPICAL_COCKTAILS,
  computeLayerSlices,
  getGlassGeometrySpec,
  sipLiquidLevel,
} from './cocktailCatalog';
import {
  createInitialBathState,
  cycleShowerMode,
  stepBathSimulation,
} from './palmBathSim';

test('CocktailCatalog: 4 classic PS1 presets, faceted lathe specs, and sipping work cleanly', () => {
  assert.equal(TROPICAL_COCKTAILS.length, 4);
  for (const drink of TROPICAL_COCKTAILS) {
    const spec = getGlassGeometrySpec(drink.glassShape);
    assert.equal(spec.outerPoints.length >= 7, true);
    assert.equal(spec.cavityTopY > spec.cavityBottomY, true);
    const slices = computeLayerSlices(drink.layers, 0.9, spec.cavityBottomY, spec.cavityTopY);
    assert.equal(slices.length, drink.layers.length);
    assert.equal(Math.abs(slices[0].yBottom - spec.cavityBottomY) < 1e-6, true);
  }

  let lvl = 0.92;
  lvl = sipLiquidLevel(lvl, 0.2);
  assert.equal(lvl, 0.72);
  assert.equal(sipLiquidLevel(0.05, 0.2), 0.04);
});

test('PalmBathSim: isometric shower spray, steam ventilation, rain, and radio notes work cleanly', () => {
  const s = createInitialBathState();
  assert.equal(cycleShowerMode('off'), 'hot');
  assert.equal(cycleShowerMode('hot'), 'cold');
  assert.equal(cycleShowerMode('cold'), 'off');

  s.showerMode = 'hot';
  s.windowOpen = false;
  const startSteam = s.steamLevel;
  for (let i = 0; i < 25; i++) {
    stepBathSimulation(s);
  }
  assert.equal(s.waterDrops.length > 0, true);
  assert.equal(s.steamLevel > startSteam, true);
  assert.equal(s.waterTempC, 43);

  s.showerMode = 'cold';
  s.windowOpen = true;
  const peakSteam = s.steamLevel;
  for (let i = 0; i < 20; i++) {
    stepBathSimulation(s);
  }
  assert.equal(s.steamLevel < peakSteam, true);
  assert.equal(s.waterTempC, 21);
});
