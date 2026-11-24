/**
 * v2.683 结果页诊断可读性：评分色必须走主题令牌
 *
 * 证伪：结果页 7 处评分卡（改稿尺子/创作深度/标题传播力/每集三问/开场四要素/六维评分卡/资方视角）
 * 仍把分数颜色写死为 #2e7d32 / #1565c0 / #e0a030。浅色主题下尚可，切到 tech/dark 后
 * 深绿深蓝落在 #0b1211 面板上只有 3.0~3.5:1，小于小字所需的 4.5:1——用户看到的是「分数像被擦掉」。
 * 15 条诊断提示的左边框同样是写死色值，暗色下几近不可见。
 *
 * 修复口径：颜色只允许引用 --grade-good / --grade-mid / --grade-warn / --danger-text /
 * --ok-text / --warn-text / --info-text / --gold / --cinnabar / --accent 等主题令牌，
 * 让四套主题各自给出达标对比度（令牌已在 styles.css 的四套主题中定义）。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'web', 'styles.css'), 'utf8');

// 结果页诊断提示条（index.html #resultPanel 内）
const DIAG_NOTICE_IDS = [
  'complianceTip', 'aiLabelTip', 'filingTip', 'postScanTip', 'modeGateTip',
  'craftLintTip', 'craftDepthTip', 'trackTip', 'titlePitchTip', 'epThreeQTip',
  'openingCheckTip', 'scorecardTip', 'genresTip', 'investorTip', 'aigcBeatTip',
  'foreshadowTip', 'arcTrackTip', 'hitTeardownTip',
];

function tagForId(id) {
  const re = new RegExp(`<[^>]*\\bid="${id}"[^>]*>`);
  const m = html.match(re);
  assert.ok(m, `index.html 缺少 #${id}`);
  return m[0];
}

describe('v2.683 结果页诊断评分色走主题令牌', () => {
  it('① app.js 不再写死深绿/深蓝/琥珀评分色', () => {
    const offenders = [];
    for (const hex of ['#2e7d32', '#1565c0', '#e0a030', '#8a6d3b']) {
      const re = new RegExp(`['"]${hex}['"]`, 'i');
      if (re.test(app)) offenders.push(hex);
    }
    assert.deepStrictEqual(offenders, [],
      '写死评分色在暗色主题只有 3.0~3.5:1，必须改用 --grade-* / --ok-text / --warn-text 令牌：' + offenders.join(', '));
  });

  it('② 四级评分色改用 --grade-good / --grade-mid / --grade-warn / --danger-text', () => {
    for (const token of ['var(--grade-good)', 'var(--grade-mid)', 'var(--grade-warn)', 'var(--danger-text)']) {
      assert.ok(app.includes(token), `app.js 评分色应引用 ${token}`);
    }
  });

  it('③ 结果页每条诊断提示的左边框只用主题令牌，不写死色值', () => {
    const bad = [];
    for (const id of DIAG_NOTICE_IDS) {
      const tag = tagForId(id);
      if (/#[0-9a-fA-F]{3,8}\b/.test(tag)) bad.push(`#${id} 写死色值：${tag}`);
      else if (/border-left/.test(tag) && !/var\(--/.test(tag)) bad.push(`#${id} 边框未用令牌：${tag}`);
    }
    assert.deepStrictEqual(bad, [], '诊断提示边框须随主题切换：\n' + bad.join('\n'));
  });

  it('④ 四套主题都定义了 grade 令牌（令牌缺失会让 var() 回退成无效色）', () => {
    for (const token of ['--grade-good:', '--grade-mid:', '--grade-warn:', '--grade-bad:']) {
      const n = css.split(token).length - 1;
      assert.ok(n >= 4, `${token} 应至少在 :root/light/dark/eye 四处定义，实际 ${n} 处`);
    }
  });

  it('⑤ 诊断卡底色按各自 --tone 轻微着色（一屏多条不再同一种灰底）', () => {
    const rule = css.match(/#resultPanel\s+\.notice\[style\*="--tone"\]\s*\{([^}]*)\}/);
    assert.ok(rule, 'styles.css 缺少结果页诊断卡的 --tone 作用域规则');
    assert.match(rule[1], /color-mix\(/, '诊断卡底色须用 color-mix 掺色');
    assert.match(rule[1], /var\(--tone\)/, '诊断卡底色须掺入各自的 --tone，且保持主题令牌体系');
    const toneVars = DIAG_NOTICE_IDS.map((id) => tagForId(id)).filter((tag) => tag.includes('--tone:'));
    assert.ok(toneVars.length >= 15, `至少 15 条诊断应声明 --tone，实际 ${toneVars.length}`);
  });
});
