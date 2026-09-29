/**
 * v2.54 全量 API 清单 · 设计版 docx 生成器（后台下载，仅超管）
 * 排版：封面（品牌/出品方/联系/版本/日期预留）→ 使用说明 → 三大类表格（含预留“实际Key/备注”列）
 *      → 申请顺序清单 → 签署/复核预留位。页脚“第 X 页 共 Y 页”。
 */
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, HeadingLevel,
} from 'docx';
import { BRAND } from '../config/brand';
import { API_DIRECTORY, type ApiEntry } from '../config/api-directory';

const BODY = '宋体'; const HEAD = '黑体';
const f = (ea = BODY) => ({ ascii: 'Times New Roman', eastAsia: ea, hAnsi: 'Times New Roman' });
const run = (t: string, o: { bold?: boolean; size?: number; head?: boolean; color?: string } = {}) =>
  new TextRun({ text: t, bold: o.bold, size: o.size ?? 21, font: f(o.head ? HEAD : BODY), color: o.color });
const p = (t: string, o: { bold?: boolean; size?: number; align?: any; head?: boolean; before?: number; after?: number } = {}) =>
  new Paragraph({
    alignment: o.align, heading: o.head ? HeadingLevel.HEADING_1 : undefined,
    spacing: { before: o.before ?? 60, after: o.after ?? 80, line: 320 },
    children: [run(t, { bold: o.bold ?? o.head, size: o.size ?? (o.head ? 30 : 21), head: o.head })],
  });
const blank = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [run('')] }));

const border = { style: BorderStyle.SINGLE, size: 4, color: 'B9C2D6' };
const cellBorders = { top: border, bottom: border, left: border, right: border };
function cell(text: string, w: number, o: { bold?: boolean; head?: boolean; fill?: string } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    borders: cellBorders,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ spacing: { line: 280 }, children: [run(text, { bold: o.bold || o.head, size: 19, head: o.head })] })],
  });
}
function apiTable(rows: ApiEntry[], withReserve: boolean) {
  const widths = withReserve ? [18, 22, 9, 26, 25] : [20, 26, 10, 30, 14];
  const headCells = ['厂商/产品', '承担功能/岗位', '属性', '官方申请入口', withReserve ? '实际 Key / 备注（预留手填）' : '说明']
    .map((h, i) => cell(h, widths[i], { head: true, fill: 'EAF0FF' }));
  const bodyRows = rows.map((e) => new TableRow({ children: [
    cell(`${e.vendor}\n${e.product}`, widths[0]),
    cell(e.usedBy.join('；'), widths[1]),
    cell(`${e.region === 'domestic' ? '国产' : e.region === 'overseas' ? '海外' : '均可'}｜${e.necessity === 'core' ? '必需' : e.necessity === 'alternative' ? '备选' : '可选'}`, widths[2]),
    cell(e.consoleUrl || '（无官方开放API）', widths[3]),
    cell(withReserve ? '' : e.note, widths[4]),
  ] }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: headCells }), ...bodyRows] });
}

export async function renderApiDirectoryDocx(version: string): Promise<Buffer> {
  const today = new Date();
  const dateStr = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;
  const children: any[] = [
    ...blank(3),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(BRAND.fullName, { bold: true, size: 44, head: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [run('全量 API 申请与配置清单（内部机密 · 仅限超管）', { bold: true, size: 28, head: true })] }),
    ...blank(2),
    p(`出品方：${BRAND.producer}`, { align: AlignmentType.CENTER, size: 22 }),
    p(`商务/技术联系：${BRAND.contactPhone}`, { align: AlignmentType.CENTER, size: 22 }),
    p(`工具版本：v${version}　　清单生成日期：${dateStr}`, { align: AlignmentType.CENTER, size: 22 }),
    ...blank(1),
    p('配置负责人：________________　　复核人：________________　　配置完成日期：______年____月____日', { align: AlignmentType.CENTER, size: 21 }),
    ...blank(2),
    p('使用说明', { head: true }),
    p('1. 本清单为「终南集」全部外部依赖的官方申请入口，C 端用户不可见；所有密钥仅在后台填写、加密存储，禁止写入前端或日志。'),
    p('2. 「实际 Key / 备注」列为预留手填位：申请到 Key 后可打印手写或在 Word 中补录，密钥本身建议只存于后台与离线密码管理器。'),
    p('3. 创作类模型按「首选全球最适 + 第一替补国产最强」配置；任一海外服务不可用时自动切国产替补，不中断用户创作。'),
    p('4. 单价以后台真实账单为准，用户售价始终不低于采购成本 2 倍；如厂商控制台改版，以其官网最新入口为准。'),

    p('一、文本大模型（十岗位 AGI 协作流水线）', { head: true, before: 240 }),
    apiTable(API_DIRECTORY.filter((e) => e.layer === 'llm_text'), true),
    p('二、图片大模型（剧本海报 / 分镜，全部收费、无免费额度）', { head: true, before: 240 }),
    apiTable(API_DIRECTORY.filter((e) => e.layer === 'llm_image'), true),
    p('三、基础设施 API（登录 / 支付 / 存储 / 审核 / 语音等）', { head: true, before: 240 }),
    apiTable(API_DIRECTORY.filter((e) => e.layer === 'infra'), true),

    p('四、上线前申请顺序（建议）', { head: true, before: 240 }),
    p('第一步：5 家国产文本（DeepSeek / 火山方舟 / 阿里百炼 / Kimi / MiniMax）——经济档、标准档即可全量运转。'),
    p('第二步：图片先开火山 Seedream 与 OpenAI GPT-image，覆盖 39 / 199 积分两档海报。'),
    p('第三步：P0 基础设施——短信、微信/抖音登录、微信支付、对象存储 OSS、内容安全审核。'),
    p('第四步：TTS/ASR 随「听剧本」与采访式语音灰度；实名核验随 X剧本；版权存证随交易广场。'),
    p('第五步：海外 3 家（OpenAI / Anthropic / Gemini）仅服务旗舰档，须在国产替补全部配好后再开通。'),
    ...blank(1),
    p('五、配置核对与签署（预留位）', { head: true }),
    p('□ 文本八岗首选与国产最强替补已全部配置并连通测试　　测试人：__________　日期：__________'),
    p('□ 图片模型两档海报已出图验收　　验收人：__________　日期：__________'),
    p('□ 基础设施 P0（短信/登录/支付/存储/审核）已联调　　联调人：__________　日期：__________'),
    p('□ 售价 ≥ 采购成本×2 铁底已在后台逐模型校验通过　　校验人：__________　日期：__________'),
    ...blank(2),
    p(`出品方（盖章）：${BRAND.producer}`, { size: 21 }),
    p('负责人签字：________________　　　　日期：______年____月____日', { size: 21 }),
  ];

  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
    run('第 ', { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: f() }),
    run(' 页　共 ', { size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: f() }),
    run(` 页　${BRAND.name} · 内部机密`, { size: 18 }),
  ] })] });

  const doc = new Document({
    creator: BRAND.fullName, title: '终南集全量API清单',
    styles: { default: { document: { run: { font: f(), size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1100, right: 1100 } } }, footers: { default: footer }, children }],
  });
  return Packer.toBuffer(doc);
}
