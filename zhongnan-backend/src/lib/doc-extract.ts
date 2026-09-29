/**
 * 源文档文本提取（v1.81，零外部依赖，服务本地 CPU 解析、不耗模型 token）
 * 支持创意改编 / 小说改编模式上传：txt / md / docx / epub / pdf
 *  - txt/md：UTF-8 直读（自动去 BOM）
 *  - docx：ZIP→word/document.xml，段落转换行后去标签
 *  - epub：ZIP→container→opf 脊柱顺序，拼接所有 xhtml/html 正文
 *  - pdf：尽力提取文本型 PDF（FlateDecode 流 + Tj/TJ）；扫描件/加密件提取不到时明确返回 unsupportedNote，
 *    绝不返回乱码冒充成功，引导用户改为粘贴文本。
 */
import zlib from 'zlib';

export type DocFormat = 'txt' | 'md' | 'docx' | 'epub' | 'pdf' | 'unknown';
export interface ExtractResult {
  format: DocFormat;
  text: string;
  chars: number;
  truncated: boolean;
  note?: string;
  chapters: string[];
}

const MAX_CHARS_DEFAULT = 200_000;

export function detectFormat(filename: string): DocFormat {
  const n = (filename || '').toLowerCase();
  if (n.endsWith('.txt')) return 'txt';
  if (n.endsWith('.md') || n.endsWith('.markdown')) return 'md';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.epub')) return 'epub';
  if (n.endsWith('.pdf')) return 'pdf';
  return 'unknown';
}

function decodeUtf8(buf: Buffer): string {
  let s = buf.toString('utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}

function htmlToText(xml: string): string {
  return xml
    .replace(/<\/(?:[a-zA-Z0-9]+:)?(p|div|h[1-6]|li|blockquote|section|article|br)>/gi, '\n')
    .replace(/<(?:[a-zA-Z0-9]+:)?br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------------- 极简 ZIP 读取（仅解压需要的条目，支持 stored/deflate） ---------------- */
interface ZipEntry { name: string; data: Buffer; }
function readZipEntries(buf: Buffer): Map<string, ZipEntry> {
  // EOCD 签名 0x06054b50，从尾部向前找
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP_INVALID: 找不到中央目录，文件可能已损坏');
  const total = buf.readUInt16LE(eocd + 10);
  let cd = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, ZipEntry>();
  let p = cd;
  for (let k = 0; k < total; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    // 本地头定位数据起点（本地头的 extra 长度与中央目录可能不同，以本地头为准）
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(dataStart, dataStart + compSize);
    let data: Buffer;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`ZIP_UNSUPPORTED_METHOD:${method}`);
    out.set(name, { name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function extractDocx(entries: Map<string, ZipEntry>): string {
  const doc = entries.get('word/document.xml');
  if (!doc) throw new Error('DOCX_NO_DOCUMENT: 内部缺少 word/document.xml，可能不是标准 docx');
  return htmlToText(doc.data.toString('utf8'));
}

function extractEpub(entries: Map<string, ZipEntry>): string {
  const order: string[] = [];
  const container = entries.get('META-INF/container.xml');
  let opfPath = '';
  if (container) {
    const m = container.data.toString('utf8').match(/full-path="([^"]+)"/);
    if (m) opfPath = m[1];
  }
  const opf = opfPath ? entries.get(opfPath) : null;
  if (opf) {
    const opfXml = opf.data.toString('utf8');
    const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const idToHref = new Map<string, string>();
    const itemRe = /<item\b[^>]*>/gi; let im: RegExpExecArray | null;
    while ((im = itemRe.exec(opfXml))) {
      const tag = im[0];
      const idM = tag.match(/id="([^"]+)"/); const hrefM = tag.match(/href="([^"]+)"/);
      if (idM && hrefM) idToHref.set(idM[1], baseDir + hrefM[1]);
    }
    const spineRe = /<itemref\b[^>]*>/gi; let sm: RegExpExecArray | null;
    while ((sm = spineRe.exec(opfXml))) {
      const idM = sm[0].match(/idref="([^"]+)"/);
      if (idM && idToHref.has(idM[1])) order.push(idToHref.get(idM[1])!);
    }
  }
  // 兜底：没有脊柱就按文件名排序取所有正文
  if (!order.length) {
    for (const name of entries.keys()) {
      if (/\.(x?html?|xml)$/i.test(name) && !/toc|nav|ncx/i.test(name)) order.push(name);
    }
    order.sort();
  }
  const parts: string[] = [];
  for (const path of order) {
    const e = entries.get(path) || entries.get(decodeURIComponent(path));
    if (e) { const txt = htmlToText(e.data.toString('utf8')); if (txt) parts.push(txt); }
  }
  if (!parts.length) throw new Error('EPUB_NO_CONTENT: 未解析到正文章节');
  return parts.join('\n\n');
}

/* ---------------- PDF 文本（仅文本型，尽力而为） ---------------- */
function unescapePdfLiteral(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { out += c; continue; }
    const n = s[i + 1];
    if (n === 'n') { out += '\n'; i++; }
    else if (n === 'r') { out += '\n'; i++; }
    else if (n === 't') { out += ' '; i++; }
    else if (n === '(' || n === ')' || n === '\\') { out += n; i++; }
    else if (n >= '0' && n <= '7') {
      let oct = n; let j = i + 2;
      while (j < s.length && s[j] >= '0' && s[j] <= '7' && oct.length < 3) { oct += s[j]; j++; }
      out += String.fromCharCode(parseInt(oct, 8) & 0xff); i = j - 1;
    } else out += n ?? '';
  }
  return out;
}
function extractPdfText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const chunks: string[] = [];
  const re = /stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    let content = m[1];
    const cbuf = Buffer.from(content, 'latin1');
    try { content = zlib.inflateSync(cbuf).toString('latin1'); } catch { /* 未压缩流直接用 */ }
    // Tj：(文本) Tj ；TJ：[(a)-10(b)] TJ
    const tj = /\((?:[^()\\]|\\.)*\)\s*Tj/g; let tm: RegExpExecArray | null;
    while ((tm = tj.exec(content))) chunks.push(unescapePdfLiteral(tm[0].slice(1, tm[0].lastIndexOf(')'))));
    const tjArr = /\[([^\]]*)\]\s*TJ/g; let am: RegExpExecArray | null;
    while ((am = tjArr.exec(content))) {
      const literals = am[1].match(/\((?:[^()\\]|\\.)*\)/g) || [];
      let line = '';
      for (const l of literals) line += unescapePdfLiteral(l.slice(1, -1));
      if (line) chunks.push(line);
    }
  }
  return chunks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------------- 章节标题探测（用于小说章节导航/精华提取） ---------------- */
export function detectChapters(text: string, limit = 60): string[] {
  const re = /^[ \t　]*(第[\s0-9零一二三四五六七八九十百千万两]+[章节回卷集部][^\n]{0,40}|(?:Chapter|CHAPTER)\s+[0-9ivxlcdm]+[^\n]{0,60}|楔子|序章|引子|尾声|番外[^\n]{0,30})[ \t　]*$/gm;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < limit) out.push(m[1].trim());
  return out;
}

/** 主入口：Buffer → 结构化文本 */
export function extractDocument(buf: Buffer, filename: string, maxChars = MAX_CHARS_DEFAULT): ExtractResult {
  const format = detectFormat(filename);
  let text = '';
  let note: string | undefined;
  if (format === 'txt' || format === 'md' || format === 'unknown') {
    text = decodeUtf8(buf);
    if (format === 'unknown') note = '未识别扩展名，已按纯文本解析';
  } else if (format === 'docx') {
    text = extractDocx(readZipEntries(buf));
  } else if (format === 'epub') {
    text = extractEpub(readZipEntries(buf));
  } else if (format === 'pdf') {
    text = extractPdfText(buf);
    if (text.replace(/\s/g, '').length < 16) {
      return {
        format, text: '', chars: 0, truncated: false, chapters: [],
        note: '该 PDF 为扫描图片或加密文档，无法直接提取文字，请另存为 txt/docx，或直接粘贴正文文本。',
      };
    }
    note = 'PDF 为尽力提取，若排版错乱建议改用 docx/txt 或直接粘贴正文';
  }
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const truncated = text.length > maxChars;
  if (truncated) text = text.slice(0, maxChars);
  return { format, text, chars: text.length, truncated, note, chapters: detectChapters(text) };
}
