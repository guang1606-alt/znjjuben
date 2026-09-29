/**
 * 剧本导出文档组装器（docx / pdf 渲染层共用的结构化模型）
 * 用户要求：下载文件自带 ①页码“第X页 共Y页” ②分集目录 ③故事大纲 ④人物小传 ⑤完整分集剧情。
 * 本模块只负责把作品组装成有序章节并估算分页/页码；真正的 .docx/.pdf 字节由渲染层（docx/pdfkit）消费本结构生成。
 */
import { cjkCount } from './script-format';

const PAGE_CJK = 600; // A4 正文每页约容纳汉字数（用于页码与分页估算）

export interface ExportCharacter { name: string; desc: string }
export interface ExportEpisode { n: number; title: string; body: string }
export interface ExportMeta {
  title: string;
  penName?: string | null;
  synopsis: string;                 // 故事大纲
  logline?: string;
  characters: ExportCharacter[];    // 人物小传
  episodes: ExportEpisode[];        // 完整分集
  createdAt?: string;
}

export interface DocSection {
  key: string;
  title: string;
  body: string;
  startPage: number;
  pages: number;
}

export interface ExportDocument {
  coverLines: string[];
  sections: DocSection[];
  toc: { label: string; page: number }[];
  pageCount: number;
  footer: (page: number) => string;
}

function pagesNeeded(text: string): number {
  return Math.max(1, Math.ceil(cjkCount(text) / PAGE_CJK));
}

export function buildExportDocument(m: ExportMeta): ExportDocument {
  if (!m || !m.title?.trim()) throw new Error('缺少剧名，无法导出');
  if (!Array.isArray(m.episodes) || m.episodes.length === 0) throw new Error('没有可导出的分集内容');

  const coverLines = [
    m.title,
    m.penName ? `编剧：${m.penName}` : '编剧：匿名编剧',
    `共 ${m.episodes.length} 集`,
    m.createdAt ? `导出时间：${m.createdAt}` : '',
  ].filter(Boolean);

  // 各章节正文
  const charText = m.characters.length
    ? m.characters.map((c) => `【${c.name}】${c.desc}`).join('\n')
    : '（暂无人物小传）';
  const epText = (e: ExportEpisode) => `第${e.n}集 ${e.title}\n\n${e.body}`;

  const raw: Omit<DocSection, 'startPage' | 'pages'>[] = [
    { key: 'synopsis', title: '故事大纲', body: (m.logline ? `${m.logline}\n\n` : '') + (m.synopsis || '（暂无故事大纲）') },
    { key: 'characters', title: '人物小传', body: charText },
    ...m.episodes.map((e) => ({ key: `ep_${e.n}`, title: `第${e.n}集 ${e.title}`, body: epText(e) })),
  ];

  // 封面1页 + 目录1页，正文从第3页起顺序分页
  let cursor = 3;
  const sections: DocSection[] = [];
  const toc: { label: string; page: number }[] = [];
  for (const s of raw) {
    const pages = pagesNeeded(s.body);
    sections.push({ ...s, startPage: cursor, pages });
    toc.push({ label: s.title, page: cursor });
    cursor += pages;
  }
  const pageCount = cursor - 1;
  return {
    coverLines,
    sections,
    toc,
    pageCount,
    footer: (page: number) => `第 ${page} 页  共 ${pageCount} 页`,
  };
}
