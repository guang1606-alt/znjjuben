/**
 * 全剧情绪波形「交付级」绘图原语（v2.59）。
 * 三层零依赖设计：
 *  1) waveChartLayout —— 纯函数几何（点坐标/网格/面积路径），确定性、可单测；
 *  2) renderWavePng   —— 纯 Node（仅内置 zlib）RGBA 光栅化 + PNG 编码，供 docx 内嵌；
 *     PNG 内只画无字体依赖的图形与点阵数字，中文标题/图例由 docx/pdf 原生文字承载，避免服务器字体耦合；
 *  3) waveSparkline / waveTextLines —— txt 等纯文本载体用的火花线与逐集张力行。
 * 颜色与前端结果页 renderEmotionWave 保持一致：≥80 红、≥60 琥珀、其余蓝；主线蓝、面积淡蓝。
 */
import zlib from 'zlib';

export interface ChartWavePoint { ep: number; intensity: number; valence?: number; emoZh?: string; emoEn?: string }
export interface ChartWave {
  episodeCount: number;
  points: ChartWavePoint[];
  avgIntensity: number;
  peakEp: number;
  flatWarn?: boolean;
  range?: number;
}

/** v2.60 全剧节奏体检（确定性纯函数）：压放占比、峰值位置、最长平段、首尾走向 */
export interface WaveRhythmStats {
  driveShare: number;       // 推进+高能集（≥60）占比 %
  breatheShare: number;     // 呼吸留白集（<60）占比 %
  peakPosPct: number;       // 峰值出现位置（0-100，越靠后越大）
  longestFlatRun: number;   // 最长连续齐平段（相邻差≤6）长度（集）
  open: number; close: number;
}
export function waveRhythmStats(wave: ChartWave): WaveRhythmStats {
  const pts = wave.points; const n = pts.length || 1;
  const drive = pts.filter((p) => p.intensity >= 60).length;
  const driveShare = Math.round((drive / n) * 100);
  let longest = pts.length ? 1 : 0; let run = 1;
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].intensity - pts[i - 1].intensity) <= 6) { run += 1; longest = Math.max(longest, run); } else run = 1;
  }
  return {
    driveShare,
    breatheShare: 100 - driveShare,
    peakPosPct: n <= 1 ? 0 : Math.round(((wave.peakEp - 1) / (n - 1)) * 100),
    longestFlatRun: longest,
    open: pts[0]?.intensity ?? 0,
    close: pts[n - 1]?.intensity ?? 0,
  };
}

/** 节奏诊断双语结论文本（2 行：压放结构 + 峰值/平段），买家一眼看懂节奏设计 */
export function describeRhythm(wave: ChartWave, lang: 'zh' | 'en' = 'zh'): string[] {
  const s = waveRhythmStats(wave);
  if (lang === 'en') {
    const l1 = `Rhythm: drive ${s.driveShare}% / breathing ${s.breatheShare}%; opens ${s.open}, closes ${s.close}`;
    let l2: string;
    if (s.longestFlatRun >= 3) l2 = `Peak at ${s.peakPosPct}% of the series; longest level run ${s.longestFlatRun} eps — add suppress/release alternation there`;
    else if (s.driveShare >= 85) l2 = `Peak at ${s.peakPosPct}%; drive-heavy (${s.driveShare}%) — reserve 1-2 breathing eps to avoid fatigue`;
    else if (s.driveShare <= 25) l2 = `Peak at ${s.peakPosPct}%; too much breathing (${s.breatheShare}%) — lift mid-act conflicts`;
    else l2 = `Peak at ${s.peakPosPct}% of the series; suppression/release alternation is healthy`;
    return [l1, l2];
  }
  const l1 = `节奏结构：推进/高能占${s.driveShare}%、呼吸留白占${s.breatheShare}%；开篇张力${s.open}、收尾张力${s.close}`;
  let l2: string;
  if (s.longestFlatRun >= 3) l2 = `峰值出现在全剧${s.peakPosPct}%位置；最长齐平段${s.longestFlatRun}集，建议在此段补压放交替`;
  else if (s.driveShare >= 85) l2 = `峰值出现在全剧${s.peakPosPct}%位置；高能占比${s.driveShare}%偏满，留1-2集呼吸段防疲劳`;
  else if (s.driveShare <= 25) l2 = `峰值出现在全剧${s.peakPosPct}%位置；留白占比${s.breatheShare}%偏高，中段需补冲突抬张力`;
  else l2 = `峰值出现在全剧${s.peakPosPct}%位置；压放交替健康，张弛有度`;
  return [l1, l2];
}

export interface ChartPad { l: number; r: number; t: number; b: number }
export interface WaveChartLayout {
  width: number; height: number; pad: ChartPad;
  plotW: number; plotH: number;
  coords: { ep: number; x: number; y: number; v: number }[];
  grid: { v: number; y: number }[];
  baselineY: number;
  xOf: (i: number) => number;
  yOf: (v: number) => number;
}

export function waveChartLayout(
  wave: ChartWave,
  width = 960,
  height = 300,
  pad: ChartPad = { l: 46, r: 14, t: 16, b: 30 },
): WaveChartLayout {
  const w = Math.max(120, Math.floor(width));
  const h = Math.max(90, Math.floor(height));
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const pts = wave.points.length ? wave.points : [];
  const yOf = (v: number) => pad.t + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const xOf = (i: number) => (pts.length <= 1 ? pad.l + plotW / 2 : pad.l + (i / (pts.length - 1)) * plotW);
  const coords = pts.map((p, i) => ({ ep: p.ep, x: xOf(i), y: yOf(p.intensity), v: p.intensity }));
  const grid = [0, 20, 40, 60, 80, 100].map((v) => ({ v, y: yOf(v) }));
  return { width: w, height: h, pad, plotW, plotH, coords, grid, baselineY: pad.t + plotH, xOf, yOf };
}

/* ---------------- 极简 5×7 点阵字体（仅数字与少量 ASCII，够画坐标轴） ---------------- */
const FONT5x7: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

interface RGBA { r: number; g: number; b: number; a: number }
const hex = (s: string): RGBA => ({
  r: parseInt(s.slice(1, 3), 16), g: parseInt(s.slice(3, 5), 16), b: parseInt(s.slice(5, 7), 16), a: 255,
});

class Canvas {
  data: Uint8Array;
  constructor(public w: number, public h: number, bg: RGBA = { r: 255, g: 255, b: 255, a: 255 }) {
    this.data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.data[i * 4] = bg.r; this.data[i * 4 + 1] = bg.g; this.data[i * 4 + 2] = bg.b; this.data[i * 4 + 3] = bg.a;
    }
  }
  px(x: number, y: number, c: RGBA) {
    const xi = Math.round(x); const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    // Alpha 混合（面积填充是半透明）
    const a = c.a / 255;
    this.data[i] = Math.round(c.r * a + this.data[i] * (1 - a));
    this.data[i + 1] = Math.round(c.g * a + this.data[i + 1] * (1 - a));
    this.data[i + 2] = Math.round(c.b * a + this.data[i + 2] * (1 - a));
    this.data[i + 3] = 255;
  }
  disk(cx: number, cy: number, r: number, c: RGBA) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGBA, thick = 2) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const r = Math.max(0, (thick - 1) / 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t; const y = y0 + (y1 - y0) * t;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) this.px(x + dx, y + dy, c);
    }
  }
  dashed(x0: number, x1: number, y: number, c: RGBA) {
    for (let x = x0; x < x1; x += 9) this.line(x, y, Math.min(x1, x + 4), y, c, 1);
  }
  text(str: string, x: number, y: number, c: RGBA, scale = 2) {
    let cx = Math.round(x);
    for (const ch of String(str)) {
      const glyph = FONT5x7[ch] || FONT5x7[' '];
      glyph.forEach((row, ry) => {
        for (let rx = 0; rx < 5; rx++) if (row[rx] === '1') {
          for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.px(cx + rx * scale + sx, y + ry * scale + sy, c);
        }
      });
      cx += 6 * scale;
    }
  }
}

function dotColor(v: number): RGBA {
  if (v >= 80) return hex('#e06a5b');
  if (v >= 60) return hex('#e0a23a');
  return hex('#7c9cff');
}

/** 纯 Node 光栅化波形 PNG（确定性：同输入逐字节一致） */
export function renderWavePng(wave: ChartWave, opts: { width?: number; height?: number } = {}): Buffer {
  const layout = waveChartLayout(wave, opts.width ?? 960, opts.height ?? 300);
  const cv = new Canvas(layout.width, layout.height);
  const axis = hex('#9aa3af'); const grid = hex('#e5e8ec'); const line = hex('#3b82f6');
  const area: RGBA = { r: 59, g: 130, b: 246, a: 34 };
  const { pad, plotH, baselineY, coords } = layout;

  // 网格 + Y 轴数字
  layout.grid.forEach((g) => {
    cv.dashed(pad.l, layout.width - pad.r, g.y, grid);
    cv.text(String(g.v), 6, g.y - 7, axis, 2);
  });
  // 坐标轴线
  cv.line(pad.l, pad.t, pad.l, baselineY, axis, 1);
  cv.line(pad.l, baselineY, layout.width - pad.r, baselineY, axis, 1);

  // 面积：逐 x 列在折线上方/基线间填充半透明
  if (coords.length > 1) {
    const topAt = new Array(layout.width).fill(-1);
    for (let k = 0; k + 1 < coords.length; k++) {
      const a = coords[k]; const b = coords[k + 1];
      for (let x = Math.floor(a.x); x <= Math.ceil(b.x); x++) {
        const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
        topAt[x] = a.y + (b.y - a.y) * t;
      }
    }
    for (let x = pad.l; x <= layout.width - pad.r; x++) {
      if (topAt[x] < 0) continue;
      for (let y = Math.round(topAt[x]); y <= baselineY; y++) cv.px(x, y, area);
    }
    // 折线
    for (let k = 0; k + 1 < coords.length; k++) cv.line(coords[k].x, coords[k].y, coords[k + 1].x, coords[k + 1].y, line, 3);
  }
  // 点
  coords.forEach((p) => cv.disk(p.x, p.y, coords.length > 60 ? 3 : 5, dotColor(p.v)));
  // X 轴集号（与前端同规则：≤30 集稀疏标注）
  if (coords.length <= 30) {
    const step = Math.ceil(coords.length / 8);
    coords.forEach((p, i) => {
      if (i === 0 || i === coords.length - 1 || (i + 1) % step === 0) {
        const label = String(p.ep);
        // 末位标签左收，避免贴右边界被裁（3 位集号宽 36px）
        const lx = i === coords.length - 1 ? p.x - 6 * 2 * label.length : p.x - 5;
        cv.text(label, lx, baselineY + 8, axis, 2);
      }
    });
  }
  return encodePng(cv.data, cv.w, cv.h);
}

/* ---------------- PNG 编码（IHDR/IDAT/IEND + CRC32，零依赖） ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
export function encodePng(rgba: Uint8Array, w: number, h: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit, RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.subarray(y * stride, (y + 1) * stride).forEach((v, i) => { raw[y * (stride + 1) + 1 + i] = v; });
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------------- 纯文本载体 ---------------- */
const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export function waveSparkline(values: number[]): string {
  if (!values.length) return '';
  const min = Math.min(...values); const max = Math.max(...values);
  return values.map((v) => {
    if (max === min) return SPARK[3];
    return SPARK[Math.max(0, Math.min(7, Math.round(((v - min) / (max - min)) * 7)))];
  }).join('');
}

export function waveTextLines(wave: ChartWave, lang: 'zh' | 'en' = 'zh'): string[] {
  const vals = wave.points.map((p) => p.intensity);
  const head = lang === 'en'
    ? `Series emotion rhythm · ${wave.episodeCount} eps · avg ${wave.avgIntensity} · peak Ep${wave.peakEp} · range ${wave.range ?? 0}`
    : `全剧情绪节奏 · 共${wave.episodeCount}集 · 平均张力${wave.avgIntensity} · 峰值第${wave.peakEp}集 · 级差${wave.range ?? 0}${wave.flatWarn ? '（存在连续过平段，建议压放交替）' : ''}`;
  const spark = waveSparkline(vals);
  // 每行最多 6 集，纯文本也能逐集核对；v2.60 带上主导情绪短标
  const rows: string[] = [head, lang === 'en' ? 'Tension curve: ' + spark : '张力曲线：' + spark];
  const perRow = 6;
  for (let i = 0; i < wave.points.length; i += perRow) {
    rows.push(wave.points.slice(i, i + perRow).map((p) => {
      const emo = lang === 'en' ? p.emoEn : p.emoZh;
      if (lang === 'en') return `E${p.ep}:${p.intensity}${emo ? `(${emo})` : ''}`;
      return `第${p.ep}集${p.intensity}${emo ? `·${emo}` : ''}`;
    }).join(lang === 'en' ? '  ' : '　'));
  }
  return rows;
}
