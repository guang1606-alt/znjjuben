const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const { extractDocument, detectFormat, detectChapters } = require('../dist/lib/doc-extract.js');

// ---- 最小 ZIP 构造器（deflateRaw + 本地头/中央目录/EOCD），用于在内存造 docx/epub ----
const CRC_TABLE = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function makeZip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, str] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(str, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    centrals.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

test('格式识别', () => {
  assert.strictEqual(detectFormat('a.docx'), 'docx');
  assert.strictEqual(detectFormat('a.epub'), 'epub');
  assert.strictEqual(detectFormat('a.md'), 'md');
  assert.strictEqual(detectFormat('a.pdf'), 'pdf');
  assert.strictEqual(detectFormat('a.xyz'), 'unknown');
});

test('txt/md：去 BOM 直读', () => {
  const r = extractDocument(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('第一章 起\n正文', 'utf8')]), 'x.txt');
  assert.strictEqual(r.format, 'txt');
  assert.ok(r.text.startsWith('第一章'));
  assert.ok(r.chapters.includes('第一章 起'));
});

test('docx：解压 document.xml，段落转换行、去标签', () => {
  const xml = `<w:document><w:p><w:t>第一句</w:t></w:p><w:p><w:t>第二句</w:t></w:p></w:document>`;
  const buf = makeZip([['word/document.xml', xml], ['[Content_Types].xml', '<x/>']]);
  const r = extractDocument(buf, 'novel.docx');
  assert.strictEqual(r.format, 'docx');
  assert.ok(r.text.includes('第一句')); assert.ok(r.text.includes('第二句'));
  assert.ok(!r.text.includes('<w:'), '标签必须清除');
  assert.ok(r.text.includes('\n'), '段落应换行');
});

test('epub：按 spine 顺序拼接正文章节', () => {
  const container = `<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`;
  const opf = `<package><manifest>
    <item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
  const ch1 = `<html><body><p>甲章正文</p></body></html>`;
  const ch2 = `<html><body><p>乙章正文</p></body></html>`;
  const buf = makeZip([['META-INF/container.xml', container], ['OEBPS/content.opf', opf], ['OEBPS/ch2.xhtml', ch2], ['OEBPS/ch1.xhtml', ch1]]);
  const r = extractDocument(buf, 'book.epub');
  assert.strictEqual(r.format, 'epub');
  const i1 = r.text.indexOf('甲章正文'), i2 = r.text.indexOf('乙章正文');
  assert.ok(i1 >= 0 && i2 > i1, '必须按 spine 顺序，而非压缩包内顺序');
});

test('pdf：文本型可提取；扫描/加密件明确返回 note 而非乱码', () => {
  // 未压缩文本流（PDF 文本操作符按 latin1 解析，用 ASCII 验证提取链路）
  const textPdf = Buffer.from('%PDF-1.4\nstream\nBT (The quick brown fox jumps over) Tj ET\nendstream\n%%EOF', 'latin1');
  const r1 = extractDocument(textPdf, 'a.pdf');
  assert.ok(r1.text.includes('quick brown fox'));
  // 无任何文本流（扫描件）
  const scanned = Buffer.from('%PDF-1.4\n%binary\n%%EOF', 'latin1');
  const r2 = extractDocument(scanned, 'scan.pdf');
  assert.strictEqual(r2.text, '');
  assert.ok(/扫描|加密/.test(r2.note));
});

test('超长文本截断并标记 truncated', () => {
  const r = extractDocument(Buffer.from('字'.repeat(5000), 'utf8'), 'big.txt', 1000);
  assert.strictEqual(r.truncated, true);
  assert.ok(r.chars <= 1000);
});

test('章节标题探测：中文章回 + Chapter', () => {
  const ch = detectChapters('前言\n第三章 风起\n内容\nChapter 4 The Storm\n尾');
  assert.ok(ch.some((x) => x.includes('第三章')));
  assert.ok(ch.some((x) => x.includes('Chapter 4')));
});
