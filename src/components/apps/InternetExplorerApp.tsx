import React, { useState } from 'react';
import { Win2kBrowseIcon, Win2kIcon, Win2kThrobber, Win2kUiIcon } from '../icons/Win2kIcons';

interface InternetExplorerAppProps {
  initialUrl?: string;
  onNetworkActivity?: () => void;
  onUpdateTitle?: (title: string) => void;
}

interface BookmarkItem {
  title: string;
  url: string;
  desc: string;
}

const BOOKMARKS: BookmarkItem[] = [
  { title: 'MSN 2000 首页', url: 'http://www.msn.com.cn/win2k', desc: '2000年2月经典分栏门户' },
  {
    title: 'Microsoft 中国 / Windows 2000',
    url: 'http://www.microsoft.com/china/windows2000',
    desc: 'Windows 2000 中文专题与官方站点',
  },
  { title: '新浪网 (2000年5月存档)', url: 'http://www.sina.com.cn', desc: '全球最大中文门户千禧黄页版' },
  { title: '网易 163 (2000年2月存档)', url: 'http://www.163.com', desc: '网聚人的力量 · YEAH! 搜索' },
  { title: 'Windows Update', url: 'http://windowsupdate.microsoft.com', desc: 'NT 5.0 系统安全更新中心' },
  { title: 'TechNet 中文技术库', url: 'http://technet.microsoft.com/zh-cn', desc: 'NT 5.0 网络与命令参考' },
];

function getPageTitle(url: string): string {
  if (url.startsWith('search://')) {
    return `MSN 搜索: ${decodeURIComponent(url.replace('search://', ''))} - Microsoft Internet Explorer`;
  }
  if (url.includes('sina.com.cn')) return '新浪网首页 - Microsoft Internet Explorer';
  if (url.includes('163.com')) return '网易 NetEase (163.com) - Microsoft Internet Explorer';
  if (url.includes('microsoft.com/china')) return 'Microsoft Windows 2000 中文主页 - Microsoft Internet Explorer';
  if (url.includes('windowsupdate')) return 'Microsoft Windows Update - Microsoft Internet Explorer';
  if (url.includes('technet')) return 'Microsoft TechNet 中文技术库 - Microsoft Internet Explorer';
  return 'MSN China - Microsoft Internet Explorer';
}

export const InternetExplorerApp: React.FC<InternetExplorerAppProps> = ({
  initialUrl = 'http://www.msn.com.cn/win2k',
  onNetworkActivity,
  onUpdateTitle,
}) => {
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [histIdx, setHistIdx] = useState(0);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [sideBar, setSideBar] = useState<'none' | 'favorites' | 'search' | 'history'>('none');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(100);
  const [searchInput, setSearchInput] = useState('Windows 2000');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);

  const activeUrl = history[histIdx] ?? 'http://www.msn.com.cn/win2k';

  const navigate = (target: string) => {
    const clean = target.trim() || 'about:blank';
    const nextHist = history.slice(0, histIdx + 1);
    if (nextHist[nextHist.length - 1] !== clean) {
      nextHist.push(clean);
      setHistory(nextHist);
      setHistIdx(nextHist.length - 1);
    }
    setUrlInput(clean);
    onUpdateTitle?.(getPageTitle(clean));
    setOpenMenu(null);
    setLoading(true);
    setProgress(30);
    onNetworkActivity?.();
    window.setTimeout(() => setProgress(78), 110);
    window.setTimeout(() => {
      setProgress(100);
      setLoading(false);
    }, 240);
  };

  const canBack = histIdx > 0;
  const canForward = histIdx < history.length - 1;

  const handleBack = () => {
    if (!canBack) return;
    const idx = histIdx - 1;
    setHistIdx(idx);
    setUrlInput(history[idx]);
    onUpdateTitle?.(getPageTitle(history[idx]));
  };

  const handleForward = () => {
    if (!canForward) return;
    const idx = histIdx + 1;
    setHistIdx(idx);
    setUrlInput(history[idx]);
    onUpdateTitle?.(getPageTitle(history[idx]));
  };

  const handleWebSearch = (q: string) => {
    const clean = q.trim() || 'Windows 2000';
    navigate(`search://${encodeURIComponent(clean)}`);
  };

  const renderPageContent = () => {
    if (activeUrl.startsWith('search://')) {
      const q = decodeURIComponent(activeUrl.replace('search://', ''));
      const matched = BOOKMARKS.filter(
        (b) =>
          b.title.toLowerCase().includes(q.toLowerCase()) ||
          b.desc.toLowerCase().includes(q.toLowerCase()) ||
          b.url.toLowerCase().includes(q.toLowerCase())
      );
      const list = matched.length > 0 ? matched : BOOKMARKS;
      return (
        <div className="bg-white text-black p-4 space-y-3 text-[12px]">
          <div className="bg-[#336699] text-white px-3 py-2 flex items-center justify-between">
            <span className="font-bold text-[14px]">MSN 搜索结果 — “{q}”</span>
            <span className="text-[11px] text-[#FFFFCC]">共 {list.length} 条记录</span>
          </div>
          <div className="space-y-3">
            {list.map((item) => (
              <div key={item.url} className="border-b border-[#E5E5E5] pb-2">
                <button
                  type="button"
                  onClick={() => navigate(item.url)}
                  className="text-[13px] font-bold text-[#0000CC] underline bg-transparent border-0 p-0 cursor-pointer text-left"
                >
                  {item.title}
                </button>
                <div className="text-[11px] text-[#008000]">{item.url}</div>
                <div className="text-[12px] text-[#333333] mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    switch (activeUrl) {
      /* 1. MSN 2000 (Grounded in 2000-02-29 www.msn.com 3-column #336699 table structure) */
      case 'http://www.msn.com.cn/win2k':
        return (
          <div className="bg-white text-black text-[12px] p-2">
            <div className="max-w-[660px] mx-auto space-y-1.5">
              {/* Row 1: Classic MSN Top Bar */}
              <div className="bg-[#336699] text-white px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/win2k-ui/ie256.gif"
                    alt=""
                    className="w-[30px] h-[34px] shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div>
                    <div className="text-[19px] font-bold tracking-tight leading-none">
                      msn<span className="text-[#FFCC00] text-[14px]">.com.cn</span>
                    </div>
                    <div className="text-[10px] text-[#FFFFCC] mt-0.5">
                      Microsoft Network · Windows 2000 简体中文默认首页
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#FFFFCC]">
                  <button
                    type="button"
                    onClick={() => navigate('http://www.microsoft.com/china/windows2000')}
                    className="bg-transparent border-0 p-0 text-[#FFFFCC] font-bold hover:underline cursor-pointer"
                  >
                    Windows 2000
                  </button>
                  <span>|</span>
                  <button
                    type="button"
                    onClick={() => navigate('http://www.sina.com.cn')}
                    className="bg-transparent border-0 p-0 text-[#FFFFCC] font-bold hover:underline cursor-pointer"
                  >
                    新浪网
                  </button>
                  <span>|</span>
                  <button
                    type="button"
                    onClick={() => navigate('http://www.163.com')}
                    className="bg-transparent border-0 p-0 text-[#FFFFCC] font-bold hover:underline cursor-pointer"
                  >
                    网易 163
                  </button>
                </div>
              </div>

              {/* Row 2: Search Ribbon */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleWebSearch(searchInput);
                }}
                className="bg-[#DCE8F8] border border-[#336699] px-3 py-1.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#003366]">MSN Search:</span>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w2k-input w-[200px] bg-white"
                    aria-label="MSN 网页搜索"
                  />
                  <button type="submit" className="w2k-btn">
                    Go
                  </button>
                </div>
                <span className="text-[11px] text-[#003366]">2000年2月版历史档案</span>
              </form>

              {/* Row 3: Authentic 3-column table separated by 1px black lines (from 2000-02-29 archive) */}
              <div className="grid grid-cols-1 md:grid-cols-12 border-t border-b border-[#336699] pt-1 pb-2 gap-0">
                {/* Left Column */}
                <div className="md:col-span-3 pr-2 md:border-r md:border-black space-y-2">
                  <div>
                    <div className="bg-[#336699] text-white font-bold px-1.5 py-[1px] text-[11px]">
                      热门站点直达
                    </div>
                    <ul className="p-1.5 space-y-1 text-[11px]">
                      {BOOKMARKS.map((bm) => (
                        <li key={bm.url} className="flex items-start gap-1 leading-snug">
                          <span aria-hidden="true" className="shrink-0">▪</span>
                          <button
                            type="button"
                            onClick={() => navigate(bm.url)}
                            className="text-[#0000CC] underline bg-transparent border-0 p-0 text-left cursor-pointer"
                          >
                            {bm.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#CCCCFF] p-1.5 text-[11px] space-y-0.5 leading-snug">
                    <div className="font-bold text-[#003366]">Hotmail 免费电子邮箱</div>
                    <div>在浏览器中免费收发 @hotmail.com 邮件与 MSN Messenger 好友即时联系。</div>
                  </div>
                </div>

                {/* Center Column */}
                <div className="md:col-span-6 px-2.5 md:border-r md:border-black space-y-2.5">
                  <div>
                    <div className="bg-[#336699] text-white font-bold px-1.5 py-[1px] text-[11px]">
                      今日新闻焦点 (MSNBC / 新浪)
                    </div>
                    <div className="p-1.5 space-y-1.5">
                      <div className="font-bold text-[#003366]">Microsoft Windows 2000 正式发布</div>
                      <ul className="list-disc pl-4 space-y-1 text-[11px]">
                        <li>
                          <button
                            type="button"
                            onClick={() => navigate('http://www.microsoft.com/china/windows2000')}
                            className="text-[#0000CC] underline bg-transparent border-0 p-0 text-left cursor-pointer"
                          >
                            Windows 2000 Professional：基于 NT 5.0 内核的新一代商业桌面
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => navigate('http://www.sina.com.cn')}
                            className="text-[#0000CC] underline bg-transparent border-0 p-0 text-left cursor-pointer"
                          >
                            新浪网 2000 年千禧资讯：门户网站与中文互联网全面提速
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => navigate('http://www.163.com')}
                            className="text-[#0000CC] underline bg-transparent border-0 p-0 text-left cursor-pointer"
                          >
                            网易 163 推出 YEAH! 极速中文搜索引擎与免费邮箱
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <div className="bg-[#336699] text-white font-bold px-1.5 py-[1px] text-[11px]">
                      Personal Finance &amp; Tech
                    </div>
                    <div className="p-1.5 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-[#CCFF99] p-1.5 border border-[#80A060]">
                        <div className="font-bold">千禧装机推荐</div>
                        <div>Pentium III 600MHz · 128MB SDRAM · 17寸特丽珑 CRT</div>
                      </div>
                      <div className="bg-[#F2F5FA] p-1.5 border border-[#8AA8D6]">
                        <div className="font-bold">Internet Explorer 5.0</div>
                        <div>支持自动完成、脱机浏览与活动桌面通道</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="md:col-span-3 pl-2 space-y-2.5">
                  <div>
                    <div className="bg-[#336699] text-white font-bold px-1.5 py-[1px] text-[11px]">
                      Microsoft 推荐
                    </div>
                    <div className="p-1.5 flex flex-col items-center gap-2 text-center">
                      <img
                        src="/retro-web/win2k-serv.gif"
                        alt="Windows 2000 Service Pack"
                        className="border border-[#CCCCCC]"
                      />
                      <button
                        type="button"
                        onClick={() => navigate('http://windowsupdate.microsoft.com')}
                        className="text-[#0000CC] underline bg-transparent border-0 p-0 text-[11px] cursor-pointer"
                      >
                        检查 Windows Update 最新补丁
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#336699] text-white text-center py-2 text-[11px]">
                <span className="text-[#FFFFCC] font-bold">PERSONALIZE</span> this page in 3 easy steps · ©2000 Microsoft Corporation.
              </div>
            </div>
          </div>
        );

      /* 2. Microsoft China / Windows 2000 (Real Wayback 2000 GIFs & black+curve header) */
      case 'http://www.microsoft.com/china/windows2000':
        return (
          <div className="bg-white text-black text-[12px]">
            {/* Authentic 2000 Microsoft Top Bar (Black strip + curve.gif + mslogo.gif + bnrWin2000.gif) */}
            <table className="w-full border-collapse bg-white" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td rowSpan={2} className="align-top w-[250px]">
                    <img src="/retro-web/win2k-bnr.gif" alt="Microsoft Windows 2000 Home" className="block" />
                  </td>
                  <td className="align-top text-right h-[20px] bg-black text-white text-[11px]">
                    <div className="flex items-center justify-end h-[20px] bg-white">
                      <img src="/retro-web/ms-curve.gif" alt="" className="block shrink-0" />
                      <div className="bg-black text-white h-[20px] px-3 flex items-center gap-2 font-bold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate('http://www.microsoft.com/china/windows2000')}
                          className="bg-transparent border-0 p-0 text-white cursor-pointer"
                        >
                          产品
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => navigate('http://technet.microsoft.com/zh-cn')}
                          className="bg-transparent border-0 p-0 text-white cursor-pointer"
                        >
                          支持
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => navigate('http://windowsupdate.microsoft.com')}
                          className="bg-transparent border-0 p-0 text-white cursor-pointer"
                        >
                          搜索
                        </button>
                        <span>|</span>
                        <span>Microsoft 指南</span>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="bg-[#003399] text-right h-[40px] pr-2">
                    <img src="/retro-web/mslogo.gif" alt="Microsoft" className="inline-block" />
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Left #6699CC Module */}
              <div className="md:col-span-3 space-y-2.5">
                <div className="bg-[#6699CC] text-white">
                  <div className="flex items-center justify-between px-2 py-0.5 font-bold text-[11px]">
                    <span>Windows 2000 产品线</span>
                    <img src="/retro-web/win2k-tableft.gif" alt="" />
                  </div>
                  <div className="bg-[#EEF4FB] text-black border border-[#6699CC] p-2 space-y-1 text-[11px]">
                    <div className="font-bold text-[#003399]">• Professional 专业版</div>
                    <div>• Server 服务器版</div>
                    <div>• Advanced Server 高级服务器版</div>
                    <div>• Datacenter Server 数据中心版</div>
                  </div>
                </div>

                <div className="bg-[#FFFF99] border border-[#CC9900] p-2 text-[11px] space-y-1">
                  <div className="font-bold text-[#990000]">重要推荐</div>
                  <div>立即访问 Windows Update 获取最新安全更新与 Service Pack 4。</div>
                  <button
                    type="button"
                    onClick={() => navigate('http://windowsupdate.microsoft.com')}
                    className="text-[#003399] underline font-bold bg-transparent border-0 p-0 cursor-pointer"
                  >
                    立即前往 &gt;&gt;
                  </button>
                </div>
              </div>

              {/* Main Area */}
              <div className="md:col-span-9 space-y-3">
                <div className="border-b-2 border-[#003399] pb-1.5">
                  <div className="text-[16px] font-bold text-[#003399]">
                    欢迎光临 Microsoft 中国 — Windows 2000 中文网页
                  </div>
                  <div className="text-[11px] text-[#555555]">
                    Built on NT Technology · 专为商业桌面与移动计算打造
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <img
                    src="/retro-web/win2k-serv.gif"
                    alt="Windows 2000 Server & Professional"
                    className="border border-[#CCCCCC] shrink-0"
                  />
                  <div className="space-y-2 text-[12px]">
                    <p>
                      <strong>Microsoft® Windows® 2000 Professional</strong> 结合了 Windows 98 的易用性与
                      Windows NT 的卓越稳定性与安全性（Build 2195），带来真正的即插即用、电源管理与全面保护的内存空间。
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-[11px]">
                      <li>NTFS 5.0 文件系统：支持磁盘配额、EFS 加密与动态磁盘管理</li>
                      <li>活动目录 (Active Directory) 企业域架构与策略管理</li>
                      <li>内置 Internet Explorer 5.0 浏览器与系统文件保护 (SFP)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      /* 3. Sina 2000 (Grounded in 2000-05-19 www.sina.com.cn #FFCC66 folder-index layout) */
      case 'http://www.sina.com.cn':
        return (
          <div className="bg-white text-black text-[12px] p-2">
            <div className="max-w-[740px] mx-auto">
              {/* Top Authentic folder_index.gif Banner */}
              <div className="bg-white text-center pb-1">
                <img
                  src="/retro-web/sina-folder.gif"
                  alt="新浪网 SINA"
                  className="mx-auto block max-w-full"
                />
              </div>

              {/* Golden Sina Folder Body (#ffcc66 left + #fefee8 main) */}
              <div className="bg-[#FFCC66] p-1 grid grid-cols-1 md:grid-cols-12 gap-0 border border-[#E0A840]">
                {/* Left Sidebar (#ffcc66 + #fae2b1 + #f8f8e0) */}
                <div className="md:col-span-3 p-1.5 space-y-2 text-[11px]">
                  <div className="bg-[#FAE2B1] text-[#876010] font-bold text-center py-0.5">
                    新浪免费邮件
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      navigate('http://www.163.com');
                    }}
                    className="bg-[#F8F8E0] p-2 space-y-1.5 text-center border border-[#E5C98B]"
                  >
                    <div className="flex items-center justify-between gap-1 text-[#876010]">
                      <span>代号</span>
                      <input type="text" size={8} defaultValue="admin" className="w2k-input w-[84px] bg-white text-[11px]" />
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[#876010]">
                      <span>密码</span>
                      <input type="password" size={8} defaultValue="123456" className="w2k-input w-[84px] bg-white text-[11px]" />
                    </div>
                    <button type="submit" className="w2k-btn py-0 px-3 text-[11px]">
                      登录
                    </button>
                  </form>

                  <div className="bg-[#FAE2B1] text-[#876010] font-bold text-center py-0.5">
                    新浪快速连接
                  </div>
                  <div className="bg-[#F8F8E0] p-2 space-y-1 text-[#0000CC]">
                    <div className="flex items-center gap-1">
                      <span>▪ 新浪主题桌面</span>
                      <img src="/retro-web/sina-new.gif" alt="new" />
                    </div>
                    <div>▪ 新浪搜索 · 股票行情</div>
                    <div>▪ 电脑与互联网频道</div>
                    <div>▪ 体育沙龙 · 戛纳专题</div>
                  </div>
                </div>

                {/* Right Main Portal (#fefee8 + #eeeecc) */}
                <div className="md:col-span-9 bg-[#FEFEE8] p-2 space-y-2 relative">
                  <img
                    src="/retro-web/sina-rounder.gif"
                    alt=""
                    className="hidden md:block absolute top-0 left-0"
                  />
                  {/* Quick hot links row */}
                  <div className="bg-[#F8F8E0] border border-[#E5D5A8] px-2 py-1 text-[11px] flex flex-wrap gap-2 text-[#0000CC]">
                    <span className="underline">戛纳</span>
                    <span className="underline">汤尤杯</span>
                    <span className="underline">医药</span>
                    <span className="underline">女性</span>
                    <span className="underline">房地产</span>
                    <span className="underline">求职</span>
                    <span className="underline">MP3</span>
                    <span className="underline">小说</span>
                    <span className="underline">股票</span>
                    <span className="font-bold text-[#876010]">更多...</span>
                  </div>

                  {/* Two Columns: 今日焦点 & 分类精选 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-[#EEEECC] border border-[#D8C89E]">
                      <div className="bg-[#FAE2B1] px-2 py-0.5 flex justify-between font-bold text-[#876010]">
                        <span>今日焦点</span>
                        <span className="font-normal">更多新闻&lt;&lt;</span>
                      </div>
                      <ul className="p-2 space-y-1.5 text-[11px] text-[#0000CC] underline">
                        <li>
                          <button
                            type="button"
                            onClick={() => navigate('http://www.microsoft.com/china/windows2000')}
                            className="bg-transparent border-0 p-0 text-[#0000CC] underline text-left cursor-pointer"
                          >
                            Windows 2000 简体中文版在企业全面普及
                          </button>
                        </li>
                        <li>国内主要 ISP 全面推广 56K Modem 与 ISDN</li>
                        <li>OICQ 2000 同时在线人数突破新高</li>
                        <li>千年春光灿烂 · 2000年北京 IT 硬件报价</li>
                      </ul>
                    </div>

                    <div className="bg-[#EEEECC] border border-[#D8C89E]">
                      <div className="bg-[#FAE2B1] px-2 py-0.5 flex justify-between font-bold text-[#876010]">
                        <span>网址导航 · 科技时代</span>
                        <span className="font-normal">存档: 2000-05-19</span>
                      </div>
                      <div className="p-2 space-y-1.5 text-[11px]">
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate('http://www.163.com')}
                            className="text-[#0000CC] underline bg-transparent border-0 p-0 cursor-pointer"
                          >
                            网易 163 网站 (2000年典藏)
                          </button>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate('http://www.msn.com.cn/win2k')}
                            className="text-[#0000CC] underline bg-transparent border-0 p-0 cursor-pointer"
                          >
                            返回 MSN 2000 主页
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      /* 4. NetEase 163 (Grounded in 2000-02-29 www.163.com layout & real logo.gif + 163.gif) */
      case 'http://www.163.com':
        return (
          <div className="bg-white text-black text-[12px] p-2">
            <div className="max-w-[740px] mx-auto space-y-2">
              <div className="flex items-center justify-between border-b-4 border-[#FFD800] pb-1.5">
                <img src="/retro-web/163-logo.gif" alt="网易 163" className="block" />
                <div className="text-right space-y-1">
                  <img src="/retro-web/163-bar.gif" alt="163 频道导航" className="block max-w-full" />
                  <div className="text-[11px] text-[#FF0000] font-bold">
                    &gt;&gt;&gt;将网易设为首页 · 2000年2月29日存档
                  </div>
                </div>
              </div>

              {/* YEAH! Search Bar (#d0d8d8) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleWebSearch(searchInput);
                }}
                className="bg-[#D0D8D8] py-1.5 px-3 flex items-center justify-center gap-2 border border-[#777777]"
              >
                <span className="font-bold text-[#FF0000] text-[13px]">YEAH!</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w2k-input w-[210px] bg-white"
                  aria-label="YEAH 搜索"
                />
                <button type="submit" className="w2k-btn py-0">
                  查询
                </button>
              </form>

              {/* Main 2-column grid (#FFD800 gold headers) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-4 border border-[#777777]">
                  <div className="bg-[#FFD800] px-2 py-0.5 font-bold text-[12px]">
                    &nbsp;超级书签
                  </div>
                  <div className="p-2 space-y-1.5 text-[11px]">
                    {BOOKMARKS.map((bm) => (
                      <div key={bm.url}>
                        •{' '}
                        <button
                          type="button"
                          onClick={() => navigate(bm.url)}
                          className="text-[#0000FF] underline bg-transparent border-0 p-0 text-left cursor-pointer"
                        >
                          {bm.title}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-8 border border-[#777777]">
                  <div className="bg-[#FFD800] px-2 py-0.5 font-bold text-[12px]">
                    &nbsp;今日网易热点 &amp; 经典频道
                  </div>
                  <div className="p-2.5 space-y-3">
                    <div className="grid grid-cols-5 gap-2 text-center font-bold text-[12px] text-[#0000FF] border-b border-[#D0D8D8] pb-2">
                      <span>新闻</span>
                      <span>体育</span>
                      <span>影视</span>
                      <span>
                        <span className="text-[#FF0000]">生</span>活
                      </span>
                      <span>I T</span>
                      <span>科学</span>
                      <span>财经</span>
                      <span>文化</span>
                      <span>游戏</span>
                      <span>居易</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-[#383098]">
                      <li>163.net / 163.com 免费电子邮局全面升级至 25MB 空间</li>
                      <li>千禧年网页制作与个人主页空间免费申请开放中</li>
                      <li>Windows 2000 简体中文企业版技术白皮书发布</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      /* 5. Windows Update (2000 V31Site style) */
      case 'http://windowsupdate.microsoft.com':
        return (
          <div className="bg-white text-black text-[12px] h-full flex flex-col">
            <div className="bg-[#003399] text-white px-4 py-2 flex items-center justify-between border-b-2 border-[#FFCC00]">
              <div className="flex items-center gap-2">
                <img src="/retro-web/mslogo.gif" alt="Microsoft" className="h-[28px]" />
                <span className="font-bold text-[15px]">Windows Update</span>
              </div>
              <span className="text-[11px] text-[#CCDDFF]">Build 2195 SP4</span>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-3 bg-[#336699] text-white p-3 space-y-2 text-[11px]">
                <div className="font-bold border-b border-[#6699CC] pb-1">Windows Update 目录</div>
                <div className="text-[#FFFFCC]">▶ 产品更新</div>
                <div>• 关键更新通知</div>
                <div>• 设备驱动程序</div>
                <div>• Internet Explorer 5.01</div>
              </div>
              <div className="md:col-span-9 p-4 space-y-3">
                <div className="text-[15px] font-bold text-[#003399]">
                  Microsoft Windows Update — 保持您的 Windows 2000 最新
                </div>
                <p>
                  当前检测系统: <strong>Microsoft Windows 2000 Professional 简体中文版</strong>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w2k-btn default-btn"
                    onClick={() => setScanDone(true)}
                  >
                    立即扫描可用更新
                  </button>
                  {scanDone && (
                    <span className="text-[11px] text-[#008000] font-bold">
                      扫描完成：系统关键安全补丁均已最新。
                    </span>
                  )}
                </div>
                <div className="border border-[#808080] p-2.5 bg-[#FFFFEE] text-[12px] space-y-1">
                  <div className="font-bold">推荐的可选更新组件:</div>
                  <div>☑ Internet Explorer 5.01 Service Pack 2</div>
                  <div>☑ DirectX 8.0a 中文最终用户运行库</div>
                  <div>☑ Windows 2000 简体中文输入法增强包</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'http://technet.microsoft.com/zh-cn':
        return (
          <div className="bg-white text-black text-[12px] space-y-3 p-3">
            <div className="bg-[#2B4F81] text-white px-3 py-2 font-bold text-[15px]">
              Microsoft TechNet 中文技术资源库
            </div>
            <div className="border border-[#808080] p-2.5 space-y-1.5">
              <div className="font-bold">KB219500 — Windows 2000 常用网络诊断命令参考</div>
              <p>您可以在“开始”-&gt;“附件”-&gt;“命令提示符”中运行以下命令：</p>
              <pre className="bg-[#F2F2F2] border border-[#CCCCCC] p-2 text-[14px] w2k-cmd-font">
                {`ipconfig   查看本机 TCP/IP 地址与网关\nver        显示 Windows 2000 Build 2195 版本信息\ndir        列出目录与可用磁盘空间`}
              </pre>
            </div>
          </div>
        );

      case 'about:blank':
        return <div className="text-[12px] text-[#808080] py-10 text-center">about:blank</div>;

      default:
        return (
          <div className="p-4 space-y-3 bg-white text-black">
            <div className="flex items-center gap-2 text-[15px] font-bold text-[#0A246A]">
              <img src="/win2k-ui/pagerror.gif" alt="" style={{ imageRendering: 'pixelated' }} />
              <span>正在浏览：{activeUrl}</span>
            </div>
            <p className="text-[12px] text-[#404040]">
              当前处于 Windows 2000 本地档案缓存模式，您可以点击下方 2000 年历史站点继续浏览：
            </p>
            <div className="flex flex-wrap gap-2">
              {BOOKMARKS.map((bm) => (
                <button
                  key={bm.url}
                  type="button"
                  className="w2k-btn"
                  onClick={() => navigate(bm.url)}
                >
                  {bm.title}
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="flex-1 flex flex-col bg-[var(--w2k-face)] min-h-0"
      onClick={() => setOpenMenu(null)}
    >
      {/* Top IE5 Rebar Block: Rows 1 & 2 on the left + classic 38x38 Windows/IE Throbber */}
      <div className="flex items-stretch border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)]">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Menu Bar */}
          <div className="w2k-menubar relative">
            <div className="w2k-gripper mr-0.5" />
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
                <div className="w2k-menu-popup absolute left-0 top-full z-30">
                  <button
                    type="button"
                    className="w2k-menu-item"
                    onClick={() => navigate('about:blank')}
                  >
                    新建空白页(N)
                  </button>
                  <button
                    type="button"
                    className="w2k-menu-item"
                    onClick={() => window.print()}
                  >
                    打印(P)...
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="w2k-menubar-item"
              onClick={() => setSideBar((s) => (s === 'search' ? 'none' : 'search'))}
            >
              编辑(E)
            </button>
            <button
              type="button"
              className="w2k-menubar-item"
              onClick={() => navigate(activeUrl)}
            >
              查看(V)
            </button>
            <div className="relative">
              <button
                type="button"
                className={`w2k-menubar-item ${openMenu === 'fav' ? 'open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === 'fav' ? null : 'fav');
                }}
              >
                收藏(A)
              </button>
              {openMenu === 'fav' && (
                <div className="w2k-menu-popup absolute left-0 top-full z-30">
                  {BOOKMARKS.map((bm) => (
                    <button
                      key={bm.url}
                      type="button"
                      className="w2k-menu-item"
                      onClick={() => navigate(bm.url)}
                    >
                      {bm.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="w2k-menubar-item"
              onClick={() => navigate('http://windowsupdate.microsoft.com')}
            >
              工具(T)
            </button>
            <button
              type="button"
              className="w2k-menubar-item"
              onClick={() => navigate('http://technet.microsoft.com/zh-cn')}
            >
              帮助(H)
            </button>
          </div>

          {/* Standard Buttons Toolbar */}
          <div className="flex items-center gap-[1px] px-1 py-[2px] flex-wrap">
            <div className="w2k-gripper mr-0.5" />
            <button
              type="button"
              className="w2k-toolbar-btn"
              disabled={!canBack}
              onClick={handleBack}
              aria-label="后退"
            >
              <Win2kBrowseIcon sprite="back" disabled={!canBack} />
              <span>后退</span>
            </button>
            <button
              type="button"
              className="w2k-toolbar-btn"
              disabled={!canForward}
              onClick={handleForward}
              aria-label="前进"
            >
              <Win2kBrowseIcon sprite="forward" disabled={!canForward} />
            </button>
            <button
              type="button"
              className="w2k-toolbar-btn"
              onClick={() => {
                setLoading(false);
                setProgress(100);
              }}
              aria-label="停止"
              title="停止"
            >
              <Win2kBrowseIcon sprite="stop" />
              <span>停止</span>
            </button>
            <button
              type="button"
              className="w2k-toolbar-btn"
              onClick={() => navigate(activeUrl)}
              aria-label="刷新"
              title="刷新"
            >
              <Win2kBrowseIcon sprite="refresh" />
              <span>刷新</span>
            </button>
            <button
              type="button"
              className="w2k-toolbar-btn"
              onClick={() => navigate('http://www.msn.com.cn/win2k')}
              aria-label="主页"
              title="主页"
            >
              <Win2kBrowseIcon sprite="home" />
              <span>主页</span>
            </button>

            <div className="w2k-divider-v mx-0.5" />

            <button
              type="button"
              className={`w2k-toolbar-btn ${sideBar === 'search' ? 'active' : ''}`}
              onClick={() => setSideBar((s) => (s === 'search' ? 'none' : 'search'))}
              aria-label="搜索"
            >
              <Win2kBrowseIcon sprite="searchGlobe" />
              <span>搜索</span>
            </button>
            <button
              type="button"
              className={`w2k-toolbar-btn ${sideBar === 'favorites' ? 'active' : ''}`}
              onClick={() => setSideBar((s) => (s === 'favorites' ? 'none' : 'favorites'))}
              aria-label="收藏夹"
            >
              <Win2kBrowseIcon sprite="favorites" />
              <span>收藏夹</span>
            </button>
            <button
              type="button"
              className={`w2k-toolbar-btn ${sideBar === 'history' ? 'active' : ''}`}
              onClick={() => setSideBar((s) => (s === 'history' ? 'none' : 'history'))}
              aria-label="历史"
            >
              <Win2kBrowseIcon sprite="history" />
              <span>历史</span>
            </button>

            <div className="w2k-divider-v mx-0.5" />

            <button
              type="button"
              className="w2k-toolbar-btn"
              onClick={() => window.print()}
              aria-label="打印"
              title="打印"
            >
              <Win2kBrowseIcon sprite="print" />
            </button>
          </div>
        </div>

        <Win2kThrobber size={38} loading={loading} />
      </div>

      {/* Address Bar */}
      <form
        className="flex items-center gap-1.5 px-1.5 py-[2px] border-b border-[var(--w2k-shadow)] shadow-[0_1px_0_var(--w2k-highlight)]"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(urlInput);
        }}
      >
        <div className="w2k-gripper" />
        <span className="text-[11px] text-[#404040] shrink-0">地址(D)</span>
        <div className="w2k-input flex-1 h-[22px] flex items-center gap-1.5 px-1 py-0">
          <Win2kUiIcon name="ie-htmldoc" size={16} />
          <input
            type="text"
            aria-label="IE 地址栏"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="bg-transparent border-0 outline-none flex-1 text-[12px] h-full min-w-0"
          />
        </div>
        <button type="submit" className="w2k-go-btn" aria-label="转到">
          <span className="w2k-go-icon" aria-hidden="true" />
          <span>转到</span>
        </button>
      </form>

      {/* Links Bar */}
      <div className="flex items-center gap-1 px-1.5 py-[1px] border-b border-[var(--w2k-shadow)] overflow-x-auto">
        <div className="w2k-gripper mr-0.5" />
        <span className="text-[11px] text-[#404040] shrink-0 mr-1">链接</span>
        {BOOKMARKS.slice(0, 5).map((bm) => (
          <button
            key={bm.url}
            type="button"
            onClick={() => navigate(bm.url)}
            className="w2k-toolbar-btn py-[1px] px-1.5 text-[11px]"
          >
            {bm.url.includes('windowsupdate') ? (
              <Win2kIcon kind="windows-update" size={16} />
            ) : (
              <Win2kUiIcon name="ie-url" size={16} />
            )}
            <span>{bm.title.replace(/ \(.*\)/, '')}</span>
          </button>
        ))}
      </div>

      {/* Main Split Viewport */}
      <div className="flex-1 min-h-0 flex m-[2px] gap-[2px]">
        {sideBar !== 'none' && (
          <aside className="w-[192px] shrink-0 w2k-inset bg-[#F5F4F0] flex flex-col min-h-0">
            <div className="bg-[var(--w2k-face)] px-2 py-[2px] border-b border-[var(--w2k-shadow)] flex items-center justify-between text-[11px]">
              <span>
                {sideBar === 'favorites'
                  ? '收藏夹'
                  : sideBar === 'search'
                  ? 'Web 搜索'
                  : '历史记录'}
              </span>
              <button
                type="button"
                aria-label="关闭侧边栏"
                onClick={() => setSideBar('none')}
                className="bg-transparent border-0 p-0 text-[11px] leading-none cursor-default"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w2k-scroll p-2 space-y-1.5 text-[11px]">
              {sideBar === 'favorites' &&
                BOOKMARKS.map((bm) => (
                  <button
                    key={bm.url}
                    type="button"
                    onClick={() => navigate(bm.url)}
                    className="w-full flex items-center gap-1.5 px-1 py-1 text-left bg-transparent border-0 hover:bg-[#0A246A] hover:text-white cursor-default"
                  >
                    {bm.url.includes('windowsupdate') ? (
                      <Win2kIcon kind="windows-update" size={16} />
                    ) : (
                      <Win2kUiIcon name="ie-url" size={16} />
                    )}
                    <span className="truncate">{bm.title}</span>
                  </button>
                ))}
              {sideBar === 'search' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleWebSearch(searchInput);
                  }}
                  className="space-y-2"
                >
                  <label className="block font-bold">查找网页:</label>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w2k-input w-full"
                  />
                  <button type="submit" className="w2k-btn w-full">
                    立即搜索
                  </button>
                </form>
              )}
              {sideBar === 'history' &&
                [...new Set(history)].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => navigate(u)}
                    className="w-full flex items-center gap-1.5 px-1 py-1 text-left bg-transparent border-0 hover:bg-[#0A246A] hover:text-white cursor-default"
                  >
                    <Win2kUiIcon name="ie-htmldoc" size={16} />
                    <span className="truncate">{u}</span>
                  </button>
                ))}
            </div>
          </aside>
        )}

        <div className="w2k-inset flex-1 bg-white overflow-y-auto w2k-scroll text-black">
          {renderPageContent()}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-1 px-1 py-[2px] text-[11px]">
        <div className="w2k-sunken-bar px-2 py-[1px] flex-1 flex items-center gap-1.5 truncate">
          <Win2kUiIcon name="ie-htmldoc" size={16} />
          <span>{loading ? `正在打开网页 ${activeUrl}...` : '完毕'}</span>
        </div>
        <div className="w2k-sunken-bar w-[110px] h-[16px] p-[1px] hidden sm:flex items-center gap-[1px]">
          {loading && (
            <div
              className="h-full bg-[#0A246A]"
              style={{ width: `${progress}%`, transition: 'width 100ms linear' }}
            />
          )}
        </div>
        <div className="w2k-sunken-bar px-2 py-[1px] w-[110px] flex items-center justify-center gap-1.5">
          <Win2kUiIcon name="ie-globe" size={16} />
          <span>Internet</span>
        </div>
      </div>
    </div>
  );
};
