const { describe, it } = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const {
  waveChartLayout, renderWavePng, encodePng, waveSparkline, waveTextLines,
  waveRhythmStats, describeRhythm,
} = require('../dist/lib/wave-chart.js');

function mkWave(vals) {
  const points = vals.map((v, i) => ({ ep: i + 1, intensity: v, valence: 0 }));
  const avg = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
  return { episodeCount: vals.length, points, avgIntensity: avg, peakEp: vals.indexOf(Math.max(...vals)) + 1, range: Math.max(...vals) - Math.min(...vals), flatWarn: false };
}
function parsePng(buf) {
  assert.deepStrictEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const w = buf.readUInt32BE(16); const h = buf.readUInt32BE(20);
  // 找 IDAT
  let off = 8; let idat = Buffer.alloc(0);
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat = Buffer.concat([idat, buf.subarray(off + 8, off + 8 + len)]);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return { w, h, raw: zlib.inflateSync(idat) };
}

describe('wave-chart 几何纯函数', () => {
  it('布局确定性：同输入同输出', () => {
    const w = mkWave([40, 70, 90, 55]);
    const a = waveChartLayout(w); const b = waveChartLayout(w);
    assert.deepStrictEqual(a.coords, b.coords);
    assert.strictEqual(a.coords.length, 4);
    assert.strictEqual(a.grid.length, 6);
  });
  it('纵轴反向：张力越高 y 越小，且夹在绘图区内', () => {
    const w = mkWave([10, 50, 100]);
    const l = waveChartLayout(w, 960, 300);
    const ys = l.coords.map((c) => c.y);
    assert.ok(ys[0] > ys[1] && ys[1] > ys[2]);
    ys.forEach((y) => assert.ok(y >= l.pad.t && y <= l.baselineY));
    assert.strictEqual(l.yOf(100), l.pad.t);
    assert.strictEqual(l.yOf(0), l.baselineY);
  });
  it('超界张力被夹取不炸', () => {
    const w = mkWave([-20, 140]);
    const l = waveChartLayout(w);
    assert.ok(Number.isFinite(l.coords[0].y) && Number.isFinite(l.coords[1].y));
  });
});

describe('renderWavePng 零依赖光栅化', () => {
  it('合法 PNG：签名/IHDR 尺寸/IDAT 可解压且行字节正确', () => {
    const w = mkWave([30, 60, 85, 40, 72]);
    const png = renderWavePng(w, { width: 320, height: 120 });
    const { w: pw, h: ph, raw } = parsePng(png);
    assert.strictEqual(pw, 320); assert.strictEqual(ph, 120);
    assert.strictEqual(raw.length, (320 * 4 + 1) * 120);
    // 每行首字节 filter=0
    for (let y = 0; y < ph; y++) assert.strictEqual(raw[y * (320 * 4 + 1)], 0);
  });
  it('确实画出了非白像素（折线/点/网格）', () => {
    const w = mkWave([20, 55, 90, 40]);
    const png = renderWavePng(w);
    const { w: pw, h: ph, raw } = parsePng(png);
    let nonWhite = 0;
    for (let i = 0; i < pw * ph; i++) {
      const r = raw[i * 4 + 1]; const g = raw[i * 4 + 2]; const b = raw[i * 4 + 3];
      if (!(r === 255 && g === 255 && b === 255)) nonWhite++;
    }
    assert.ok(nonWhite > 300, `非白像素过少 ${nonWhite}`);
  });
  it('确定性：同输入逐字节一致', () => {
    const w = mkWave([33, 61, 88, 50, 70]);
    assert.ok(renderWavePng(w).equals(renderWavePng(w)));
  });
  it('encodePng 最小 1×1 图合法', () => {
    const rgba = Buffer.from([10, 20, 30, 255]);
    const png = encodePng(rgba, 1, 1);
    const { w, h, raw } = parsePng(png);
    assert.strictEqual(w, 1); assert.strictEqual(h, 1); assert.strictEqual(raw.length, 5);
  });
});

describe('文本载体', () => {
  it('火花线：平坦给中段、递增序列字符索引不下降', () => {
    assert.strictEqual(waveSparkline([50, 50, 50]), '▄▄▄');
    const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const s = waveSparkline([10, 20, 30, 40, 50, 60, 70, 80]);
    const idx = [...s].map((c) => SPARK.indexOf(c));
    for (let i = 1; i < idx.length; i++) assert.ok(idx[i] >= idx[i - 1]);
    assert.strictEqual(waveSparkline([]), '');
  });
  it('waveTextLines 中英双语且逐集行齐全', () => {
    const w = mkWave([40, 80, 55, 30, 90, 60, 44, 70]);
    const zh = waveTextLines(w, 'zh'); const en = waveTextLines(w, 'en');
    assert.ok(zh[0].includes('共8集') && zh[0].includes('峰值'));
    assert.ok(en[0].includes('8 eps') && en[0].includes('peak'));
    const joined = zh.join('');
    for (let e = 1; e <= 8; e++) assert.ok(joined.includes(`第${e}集`));
    assert.ok(zh[1].includes('张力曲线'));
  });

describe('v2.60 节奏体检与主情绪标注', () => {
  it('压放占比互补为100、峰值位置与最长平段正确', () => {
    const w = mkWave([85, 84, 50, 80, 100, 89, 95, 89]);
    const st = waveRhythmStats(w);
    assert.strictEqual(st.driveShare + st.breatheShare, 100);
    assert.strictEqual(st.driveShare, 88);
    assert.strictEqual(st.peakPosPct, 57); // 第5集/共8集
    assert.ok(st.longestFlatRun >= 2);
    assert.strictEqual(st.open, 85); assert.strictEqual(st.close, 89);
  });
  it('齐平序列最长平段=全长且触发诊断提示', () => {
    const w = mkWave([60, 61, 60, 61]);
    assert.strictEqual(waveRhythmStats(w).longestFlatRun, 4);
    const zh = describeRhythm(w, 'zh').join('');
    assert.ok(zh.includes('最长齐平段4集'));
  });
  it('诊断双语、英文层无中文', () => {
    const w = mkWave([30, 40, 35, 90]);
    const en = describeRhythm(w, 'en').join(' ');
    assert.ok(/Rhythm: drive/.test(en) && !/[\u4e00-\u9fff]/.test(en));
    const zh = describeRhythm(w, 'zh');
    assert.strictEqual(zh.length, 2); assert.ok(zh[0].includes('节奏结构'));
  });
  it('逐集行携带主导情绪短标', () => {
    const w = mkWave([80, 30]); w.points[0].emoZh = '高燃'; w.points[0].emoEn = 'Hype';
    const zh = waveTextLines(w, 'zh').join(''); const en = waveTextLines(w, 'en').join('');
    assert.ok(zh.includes('第1集80·高燃')); assert.ok(en.includes('E1:80(Hype)'));
  });
});
});
