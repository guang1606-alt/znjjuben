/**
 * docx 渲染器：把 ScriptDoc 渲染为合法 .docx（Office Open XML）。
 * 中文字体名写入文档（宋体/黑体），由用户本机 Word/WPS 渲染，不依赖服务器字体。
 * 页脚固定“第 X 页 共 Y 页”（Word 域，打开即自动计算），未去水印时附带平台·笔名水印。
 */
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber, ImageRun,
} from 'docx';
import { BRAND } from '../config/brand';
import type { ScriptDoc } from './script-doc';
import { renderWavePng } from './wave-chart';

const BODY_FONT = '宋体';
const HEAD_FONT = '黑体';
const font = (eastAsia = BODY_FONT) => ({ ascii: 'Times New Roman', eastAsia, hAnsi: 'Times New Roman' });

function tr(text: string, opts: { bold?: boolean; size?: number; fontName?: string } = {}) {
  return new TextRun({ text, bold: opts.bold, size: opts.size ?? 24, font: font(opts.fontName ?? BODY_FONT) });
}
function para(text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; fontName?: string; spacing?: number; indent?: number; pageBreakBefore?: boolean } = {}) {
  return new Paragraph({
    alignment: opts.align,
    pageBreakBefore: opts.pageBreakBefore,
    spacing: { line: opts.spacing ?? 360, after: 80 },
    indent: opts.indent ? { firstLine: opts.indent } : undefined,
    children: [tr(text, { bold: opts.bold, size: opts.size, fontName: opts.fontName })],
  });
}

export async function renderDocx(doc: ScriptDoc): Promise<Buffer> {
  const children: Paragraph[] = [];

  doc.blocks.forEach((b) => {
    switch (b.kind) {
      case 'cover': {
        children.push(new Paragraph({ spacing: { before: 2400, after: 240 }, alignment: AlignmentType.CENTER, children: [tr(b.title, { bold: true, size: 52, fontName: HEAD_FONT })] }));
        b.meta.forEach((m) => children.push(para(m, { align: AlignmentType.CENTER, size: 22, spacing: 300 })));
        break;
      }
      case 'h1':
        children.push(para(b.text, { bold: true, size: 32, fontName: HEAD_FONT, spacing: 360 }));
        break;
      case 'h2':
        children.push(para(b.text, { bold: true, size: 26, fontName: HEAD_FONT }));
        break;
      case 'p':
        b.text.split('\n').forEach((line) => children.push(para(line, { indent: 480 })));
        break;
      case 'toc':
        if (!b.items.length) children.push(para('（暂无分集）'));
        b.items.forEach((it) => children.push(para(`第${it.ep}集　${it.title}${it.synopsis ? `　— ${it.synopsis}` : ''}`, { size: 22, spacing: 300 })));
        break;
      case 'waveChart': {
        // v2.59 导演节奏页：零依赖 PNG 内嵌（960×300 → 页宽 560px 等比）
        const png = renderWavePng(b.wave, { width: 960, height: 300 });
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [new ImageRun({ data: png, transformation: { width: 560, height: 175 }, type: 'png' })],
        }));
        break;
      }
      case 'epStart':
        children.push(para(`第${b.ep}集　${b.title}`, { bold: true, size: 30, fontName: HEAD_FONT, pageBreakBefore: true }));
        break;
      case 'para':
        children.push(para(b.text, { indent: 480 }));
        break;
    }
  });

  const wm = doc.watermark ? `　|　${doc.watermark}` : '';
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        tr('第 ', { size: 18 }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, font: font() }),
        tr(' 页　共 ', { size: 18 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: font() }),
        tr(` 页${wm}`, { size: 18 }),
      ],
    })],
  });

  const document = new Document({
    creator: BRAND.fullName,
    title: doc.title,
    styles: { default: { document: { run: { font: font(), size: 24 } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: { default: footer },
      children,
    }],
  });
  return Packer.toBuffer(document);
}
