import type { VfsNode } from '../types/os';
import { createNode, getDisplayPath, listChildren, resolveDosPath } from './vfs';

export interface CmdResult {
  output: string[];
  nextCwdId: string;
  nextVfs: Record<string, VfsNode>;
  clearScreen?: boolean;
  exit?: boolean;
  launchApp?: string;
}

export function executeCmdCommand(
  rawLine: string,
  cwdId: string,
  vfs: Record<string, VfsNode>
): CmdResult {
  const line = rawLine.trim();
  if (!line) {
    return { output: [], nextCwdId: cwdId, nextVfs: vfs };
  }

  // Handle drive switch like "D:" or "C:"
  if (/^[a-zA-Z]:$/.test(line)) {
    const resolved = resolveDosPath(vfs, cwdId, line);
    if (!resolved) {
      return { output: ['系统找不到指定的驱动器。'], nextCwdId: cwdId, nextVfs: vfs };
    }
    return { output: [], nextCwdId: resolved, nextVfs: vfs };
  }

  const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const [firstPart, ...restParts] = parts;
  if (!firstPart) {
    return { output: [], nextCwdId: cwdId, nextVfs: vfs };
  }
  const cmd = firstPart.toLowerCase();
  const args = restParts.map((a) => a.replace(/^"|"$/g, ''));
  const argStr = args.join(' ');

  switch (cmd) {
    case 'help':
      return {
        output: [
          '有关某个命令的详细信息，请键入 HELP 命令名',
          'CD             显示当前目录的名称或将其更改。',
          'CLS            清除屏幕。',
          'DATE           显示或设置日期。',
          'DIR            显示一个目录中的文件和子目录。',
          'ECHO           显示消息，或将命令回显打开或关上。',
          'EXIT           退出 CMD.EXE 程序(命令解释程序)。',
          'HELP           提供 Windows 2000 命令的帮助信息。',
          'IPCONFIG       显示当前的 TCP/IP 网络配置。',
          'MD / MKDIR     创建一个目录。',
          'TIME           显示系统时间。',
          'TYPE           显示文本文件的内容。',
          'VER            显示 Windows 2000 版本。',
          'WHOAMI         显示当前登录的用户名。',
        ],
        nextCwdId: cwdId,
        nextVfs: vfs,
      };

    case 'ver':
      return {
        output: ['', 'Microsoft Windows 2000 [Version 5.00.2195]', ''],
        nextCwdId: cwdId,
        nextVfs: vfs,
      };

    case 'cls':
      return { output: [], nextCwdId: cwdId, nextVfs: vfs, clearScreen: true };

    case 'exit':
      return { output: [], nextCwdId: cwdId, nextVfs: vfs, exit: true };

    case 'whoami':
      return { output: ['WORKGROUP\\Administrator'], nextCwdId: cwdId, nextVfs: vfs };

    case 'date': {
      const now = new Date();
      return {
        output: [`当前日期: ${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`],
        nextCwdId: cwdId,
        nextVfs: vfs,
      };
    }

    case 'time': {
      const now = new Date();
      return {
        output: [`当前时间: ${now.toTimeString().slice(0, 8)}`],
        nextCwdId: cwdId,
        nextVfs: vfs,
      };
    }

    case 'echo':
      return { output: [line.slice(4).trimStart()], nextCwdId: cwdId, nextVfs: vfs };

    case 'ipconfig':
      return {
        output: [
          '',
          'Windows 2000 IP Configuration',
          '',
          'Ethernet adapter 本地连接:',
          '',
          '        Connection-specific DNS Suffix  . : corp.local',
          '        IP Address. . . . . . . . . . . . : 192.168.1.108',
          '        Subnet Mask . . . . . . . . . . . : 255.255.255.0',
          '        Default Gateway . . . . . . . . . : 192.168.1.1',
          '',
        ],
        nextCwdId: cwdId,
        nextVfs: vfs,
      };

    case 'cd':
    case 'chdir': {
      if (!argStr) {
        return { output: [getDisplayPath(vfs, cwdId)], nextCwdId: cwdId, nextVfs: vfs };
      }
      const targetId = resolveDosPath(vfs, cwdId, argStr);
      if (!targetId || vfs[targetId]?.type === 'file') {
        return { output: ['系统找不到指定的路径。'], nextCwdId: cwdId, nextVfs: vfs };
      }
      return { output: [], nextCwdId: targetId, nextVfs: vfs };
    }

    case 'dir': {
      const targetId = argStr ? resolveDosPath(vfs, cwdId, argStr) : cwdId;
      if (!targetId) {
        return { output: ['找不到文件'], nextCwdId: cwdId, nextVfs: vfs };
      }
      const children = listChildren(vfs, targetId);
      const pathStr = getDisplayPath(vfs, targetId);
      const lines: string[] = [
        ` 驱动器 ${pathStr.slice(0, 2)} 中的卷没有标签。`,
        ` 卷的序列号是 2000-2195`,
        '',
        ` ${pathStr} 的目录`,
        '',
      ];
      let fileCount = 0;
      let dirCount = 0;
      let totalBytes = 0;
      for (const item of children) {
        const datePart = item.modifiedAt.slice(0, 16);
        if (item.type === 'folder') {
          dirCount++;
          lines.push(`${datePart}    <DIR>          ${item.name}`);
        } else {
          fileCount++;
          const size = item.size ?? 0;
          totalBytes += size;
          lines.push(`${datePart}         ${String(size).padStart(9, ' ')} ${item.name}`);
        }
      }
      lines.push(`             ${String(fileCount).padStart(3, ' ')} 个文件    ${totalBytes.toLocaleString('en-US')} 字节`);
      lines.push(`             ${String(dirCount).padStart(3, ' ')} 个目录  14,320,128,000 可用字节`);
      lines.push('');
      return { output: lines, nextCwdId: cwdId, nextVfs: vfs };
    }

    case 'type': {
      if (!argStr) {
        return { output: ['命令语法不正确。'], nextCwdId: cwdId, nextVfs: vfs };
      }
      const targetId = resolveDosPath(vfs, cwdId, argStr);
      const node = targetId ? vfs[targetId] : undefined;
      if (!node || node.type !== 'file') {
        return { output: ['系统找不到指定的文件。'], nextCwdId: cwdId, nextVfs: vfs };
      }
      return {
        output: (node.content ?? '').split(/\r?\n/),
        nextCwdId: cwdId,
        nextVfs: vfs,
      };
    }

    case 'md':
    case 'mkdir': {
      if (!argStr) {
        return { output: ['命令语法不正确。'], nextCwdId: cwdId, nextVfs: vfs };
      }
      const { nextVfs } = createNode(vfs, cwdId, argStr, 'folder');
      return { output: [], nextCwdId: cwdId, nextVfs };
    }

    case 'notepad':
    case 'calc':
    case 'winmine':
    case 'mspaint':
    case 'explorer':
    case 'taskmgr':
    case 'control':
      return {
        output: [`正在启动 ${cmd}.exe ...`],
        nextCwdId: cwdId,
        nextVfs: vfs,
        launchApp: cmd,
      };

    default:
      return {
        output: [`'${parts[0]}' 不是内部或外部命令，也不是可运行的程序`, '或批处理文件。'],
        nextCwdId: cwdId,
        nextVfs: vfs,
      };
  }
}
