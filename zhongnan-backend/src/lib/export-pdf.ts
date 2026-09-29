/**
 * PDF 渲染器：随包内置 Noto Sans SC（含完整中文/拉丁/数字）。
 * 两遍法保证“共 N 页”准确：两遍用完全相同的 pdfkit 流式排版调用序列，
 * 分页交给 pdfkit（绝不手动累加 y，避免与引擎自动分页错位）：
 *   第一遍只跑排版，借 pageAdded 事件得到真实总页数 N（不输出）；
 *   第二遍正式输出，pageAdded 时用 switchToPage 回上一页补页脚，收尾补最后一页。
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type { ScriptDoc, ExportWave } from './script-doc';

// pdfkit 内置 fontkit 不支持 TTC，故随包内置从 Noto Sans CJK 抽取的简体 SC 单字重 OTF。
function resolveFonts(): { reg: string; bold: string } {
  const bundled = (f: string) => path.join(__dirname, '../../assets/fonts', f);
  const reg = bundled('NotoSansSC-Regular.otf');
  const bold = bundled('NotoSansSC-Bold.otf');
  if (fs.existsSync(reg)) return { reg, bold: fs.existsSync(bold) ? bold : reg };
  const droid = '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'; // 最差降级（缺数字字形）
  if (fs.existsSync(droid)) return { reg: droid, bold: droid };
  throw new Error('服务器缺少中文字体（随包 Noto Sans SC OTF 缺失），无法生成 PDF');
}

interface RLine {
  text: string; font: 'cn' | 'cnb'; size: number; align: 'left' | 'center';
  indent: number; gapBefore: number; gapAfter: number; breakPage: boolean;
}
interface RChart { chart: true; wave: ExportWave }
type RItem = RLine | RChart;

function flatten(doc: ScriptDoc): RItem[] {
  const out: RItem[] = [];
  const L = (text: string, font: 'cn' | 'cnb', size: number, align: 'left' | 'center' = 'left', extra: Partial<RLine> = {}): RLine =>
    ({ text, font, size, align, indent: 0, gapBefore: 0, gapAfter: 4, breakPage: false, ...extra });
  doc.blocks.forEach((b) => {
    switch (b.kind) {
      case 'cover':
        out.push(L('', 'cn', 12, 'left', { gapBefore: 90 }));
        out.push(L(b.title, 'cnb', 26, 'center', { gapAfter: 18 }));
        b.meta.forEach((m) => out.push(L(m, 'cn', 11, 'center', { gapAfter: 6 })));
        break;
      case 'h1': out.push(L(b.text, 'cnb', 17, 'left', { gapBefore: 14, gapAfter: 8 })); break;
      case 'h2': out.push(L(b.text, 'cnb', 13.5, 'left', { gapBefore: 6, gapAfter: 4 })); break;
      case 'p': b.text.split('\n').forEach((x) => out.push(L(x, 'cn', 12, 'left', { indent: 24 }))); break;
      case 'toc':
        if (!b.items.length) out.push(L('（暂无分集）', 'cn', 12));
        b.items.forEach((it) => out.push(L(`第${it.ep}集  ${it.title}${it.synopsis ? `  — ${it.synopsis}` : ''}`, 'cn', 11, 'left', { gapAfter: 3 })));
        break;
      case 'waveChart': out.push({ chart: true, wave: b.wave }); break;
      case 'epStart': out.push(L(`第${b.ep}集  ${b.title}`, 'cnb', 16, 'left', { breakPage: true, gapAfter: 8 })); break;
      case 'para': out.push(L(b.text, 'cn', 12, 'left', { indent: 24 })); break;
    }
  });
  return out;
}

/** v2.59 矢量绘制情绪波形（两遍法中调用序列完全一致，分页保持一致） */
function drawWavePdf(d: PDFKitDoc, wave: ExportWave, margin: number) {
  const CHART_H = 176; const LABEL_H = 26;
  if (d.y + CHART_H + LABEL_H > d.page.height - margin) d.addPage();
  const x0 = margin + 26; const x1 = d.page.width - margin - 8;
  const y0 = d.y + 22; const y1 = y0 + 128;
  const pts = wave.points;
  const xOf = (i: number) => (pts.length <= 1 ? (x0 + x1) / 2 : x0 + (i / (pts.length - 1)) * (x1 - x0));
  const yOf = (v: number) => y1 - (Math.max(0, Math.min(100, v)) / 100) * (y1 - y0);
  d.font('cn').fontSize(8).fillColor('#9aa3af');
  [0, 20, 40, 60, 80, 100].forEach((v) => {
    const y = yOf(v);
    d.save(); d.strokeColor('#e5e8ec').lineWidth(1).moveTo(x0, y).lineTo(x1, y).stroke(); d.restore();
    d.text(String(v), margin - 2, y - 5, { width: 24, align: 'right', lineBreak: false });
  });
  d.save(); d.strokeColor('#9aa3af').lineWidth(1).moveTo(x0, y0).lineTo(x0, y1).lineTo(x1, y1).stroke(); d.restore();
  if (pts.length > 1) {
    d.save(); d.fillColor('#3b82f6').fillOpacity(0.13);
    d.moveTo(xOf(0), yOf(pts[0].intensity));
    pts.forEach((p, i) => d.lineTo(xOf(i), yOf(p.intensity)));
    d.lineTo(x1, y1).lineTo(x0, y1).fill(); d.restore();
    d.save(); d.strokeColor('#3b82f6').lineWidth(2);
    d.moveTo(xOf(0), yOf(pts[0].intensity));
    pts.forEach((p, i) => d.lineTo(xOf(i), yOf(p.intensity)));
    d.stroke(); d.restore();
  }
  pts.forEach((p, i) => {
    const c = p.intensity >= 80 ? '#e06a5b' : p.intensity >= 60 ? '#e0a23a' : '#7c9cff';
    d.save(); d.fillColor(c).circle(xOf(i), yOf(p.intensity), pts.length > 60 ? 1.6 : 3.2).fill(); d.restore();
  });
  // v2.60 逐集主导情绪短标（≤20 集才标，奇偶上下错位防重叠）
  if (pts.length <= 20) {
    d.font('cn').fontSize(7).fillColor('#5b6472');
    pts.forEach((p, i) => {
      const label = wave.lang === 'en' ? p.emoEn : p.emoZh;
      if (!label) return;
      // 首点标签右移、末点左移，避开纵轴刻度与右边界
      const lx = i === 0 ? xOf(i) + 2 : i === pts.length - 1 ? xOf(i) - 30 : xOf(i) - 14;
      d.text(label, lx, yOf(p.intensity) - (i % 2 === 0 ? 10 : 19), { width: 28, align: i === 0 ? 'left' : 'center', lineBreak: false });
    });
  }
  d.font('cn').fontSize(8).fillColor('#9aa3af');
  if (pts.length <= 30) {
    const step = Math.ceil(pts.length / 8);
    pts.forEach((p, i) => {
      if (i === 0 || i === pts.length - 1 || (i + 1) % step === 0) {
        d.text(String(p.ep), xOf(i) - 8, y1 + 6, { width: 16, align: 'center', lineBreak: false });
      }
    });
  }
  d.x = margin; d.y = y1 + LABEL_H;
}

/** 两遍共用的流式排版序列；任何分页只由 pdfkit 决定，保证两遍分页一致 */
function emit(d: PDFKitDoc, l: RLine) {
  if (l.breakPage) d.addPage();
  if (l.gapBefore) d.moveDown(l.gapBefore / 12);
  d.font(l.font).fontSize(l.size).fillColor('#222222')
    .text(l.text, { align: l.align, indent: l.indent || 0, lineGap: 2, paragraphGap: l.gapAfter });
}
type PDFKitDoc = InstanceType<typeof PDFDocument>;

export async function renderPdf(doc: ScriptDoc): Promise<Buffer> {
  const { reg, bold } = resolveFonts();
  const margin = 54;
  const lines = flatten(doc);
  const mk = (): PDFKitDoc => {
    const d = new PDFDocument({ size: 'A4', margin, bufferPages: true });
    d.registerFont('cn', reg); d.registerFont('cnb', bold);
    return d;
  };

  // 正文流式排版（分页交给 pdfkit），bufferPages 保留全部页，排完后回填页脚（此时总页数已知）
  return new Promise((resolve, reject) => {
    const pdf = mk();
    const chunks: Buffer[] = [];
    pdf.on('data', (c) => chunks.push(c as Buffer));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    // 正文一次性流式排完（分页交给 pdfkit），随后逐页回填页脚——避免在 pageAdded 回调里重入
    lines.forEach((l) => { if ('chart' in l) drawWavePdf(pdf, l.wave, margin); else emit(pdf, l); });
    const realTotal = pdf.bufferedPageRange().count;
    for (let i = 0; i < realTotal; i += 1) {
      pdf.switchToPage(i);
      const pg = pdf.page;
      const savedBottom = pg.margins.bottom;
      // 临时收窄下边距，让页脚落在页脚带而不触发 LineWrapper 自动翻页（CJK 行高偏大，需留足余量）
      pg.margins.bottom = 18;
      const foot = `第 ${i + 1} 页　共 ${realTotal} 页${doc.watermark ? `　|　${doc.watermark}` : ''}`;
      pdf.font('cn').fontSize(9).fillColor('#888888')
        .text(foot, margin, pg.height - 44, { width: pg.width - margin * 2, align: 'center', lineBreak: false });
      pg.margins.bottom = savedBottom;
    }
    pdf.end();
  });
}
