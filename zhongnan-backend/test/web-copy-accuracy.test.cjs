/**
 * v2.471 用户可见文案准确性守卫（纯静态，不起服务器）
 *
 * 背景：站点经历上百版迭代后，用户可见文案与实际实现脱节的三类真实残留：
 *  ① 死入口占位语——v2.188 工作台化后导航项全部改成 data-open / data-view，
 *    index.html 中已无任何 `data-nav` 元素，但 app.js 仍绑着
 *    「该板块正在建设中，敬请期待～」处理器，永远不可能触发；
 *  ② 死字段分支——`I18N.MODES` 九项（auto + 8 模式）自 v2.329 起没有 `soon` 字段，
 *    「研发中 / coming soon」徽章与「电影剧本功能正在打磨，敬请期待～」全是不可达分支
 *    （电影剧本已是 SCRIPT_TYPES.feature_film，PRO 会员可直接使用）；
 *  ③ 数量漂移——会员权益手写「全部12模式」「采访/改编/标签/小说/互动 5模式」，
 *    实际只有 8 种创作模式（web/i18n.js MODES 与后端 src/config/modes.ts CREATION_MODES
 *    都是 8），与首页「全部 8 种模式 + 自动匹配」自相矛盾。
 *
 * 本守卫把三类固化成回归断言：再写「敬请期待」类占位语、再引用不存在的字段、
 * 再手写模式数量，立即红。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const read = (...p) => fs.readFileSync(path.join(WEB, ...p), 'utf8');

function webSources() {
  const out = new Map();
  for (const f of fs.readdirSync(WEB)) if (f.endsWith('.js') || f.endsWith('.html')) out.set(f, read(f));
  return out;
}

describe('v2.471 文案准确性', () => {
  it('G1 不得再出现「敬请期待 / 建设中 / coming soon / 研发中」类占位语', () => {
    const BANNED = ['敬请期待', '建设中', '即将上线', 'coming soon', '研发中', '敬请关注'];
    const hits = [];
    for (const [file, src] of webSources()) {
      for (const w of BANNED) {
        let i = src.indexOf(w);
        while (i >= 0) {
          hits.push(`${file}:${src.slice(0, i).split('\n').length} 「${w}」`);
          i = src.indexOf(w, i + w.length);
        }
      }
    }
    assert.deepStrictEqual(hits, [], '占位语残留（功能已实现或入口已不存在时，不得用「敬请期待」搪塞）：\n' + hits.join('\n'));
  });

  it('G2 不得再绑定不存在的 data-nav 选择器', () => {
    const app = read('app.js');
    assert.ok(!/\[data-nav\]/.test(app), 'app.js 仍引用 [data-nav]，但 index.html 中已无该属性（死处理器）');
    assert.ok(!/data-nav/.test(read('index.html')), 'index.html 不应出现 data-nav');
  });

  it('G3 不得引用 I18N.MODES 中不存在的 soon 字段（含其徽章与 CSS）', () => {
    const i18n = read('i18n.js');
    const app = read('app.js');
    const css = read('styles.css');
    assert.ok(!/\bsoon\s*:/.test(i18n), 'i18n.js 的 MODES 现有实现不含 soon 字段；若新增必须先补该字段并同步本守卫');
    assert.ok(!/m\.soon/.test(app), 'app.js 仍引用 m.soon（MODES 无此字段 → 徽章与提示都是不可达分支）');
    assert.ok(!/soon-badge/.test(app), 'app.js 仍渲染 soon-badge 徽章');
    assert.ok(!/\.soon(-badge)?\b/.test(css), 'styles.css 仍有已死的 .soon / .soon-badge 规则');
  });

  it('G4 不得手写创作模式数量（实际 8 种；auto 是路由入口不计入）', () => {
    const app = read('app.js');
    const bad = app.match(/全部\s*12\s*模式|All 12 modes|\b12\s*模式|\b12\s*modes|5模式|5 core modes/g) || [];
    assert.deepStrictEqual(bad, [], '硬编码模式数量与实际不符：' + bad.join(', '));
  });

  it('G5 会员权益的模式名单必须由 I18N.MODES 派生（单一事实源，防再次漂移）', () => {
    const app = read('app.js');
    assert.ok(/const modesUpTo = I18N\.MODES\.filter\(/.test(app), '未找到由 I18N.MODES 派生的 modesUpTo 计算');
    assert.ok(/modesUpTo\.length/.test(app), '权益文案应使用派生数量 modesUpTo.length，而不是手写数字');
    assert.ok(/const modeNames = modesUpTo\.map\(/.test(app), '权益文案应使用派生的模式名单 modeNames');
  });

  it('G6 派生数量自检：i18n MODES 去掉 auto 后恰为 8，且与后端 CREATION_MODES 对齐', () => {
    const I18N = require(path.join(WEB, 'i18n.js'));
    const modes = I18N.MODES.filter((m) => m.id !== 'auto');
    assert.strictEqual(modes.length, 8, 'web/i18n.js MODES 去 auto 后应为 8 种，实际 ' + modes.length);
    const ts = fs.readFileSync(path.join(ROOT, 'src', 'config', 'modes.ts'), 'utf8');
    const block = ts.slice(ts.indexOf('export const CREATION_MODES'), ts.indexOf('/* -------', ts.indexOf('export const CREATION_MODES')));
    const ids = [...block.matchAll(/\bid:\s*'([a-z_]+)'/g)].map((m) => m[1]);
    assert.strictEqual(ids.length, 8, 'src/config/modes.ts CREATION_MODES 应为 8 项，实际 ' + ids.length);
    assert.deepStrictEqual(
      [...modes.map((m) => m.id)].sort(), [...ids].sort(),
      '前端模式 id 与后端 CREATION_MODES 不一致（会产生可选但不可建的卡片）',
    );
  });

  it('G7 岗位数量必须与后端 ALL_ROLE_IDS 对齐（九大），不得手写「十大 / 10 岗位」', () => {
    const policy = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'model-config-policy.ts'), 'utf8');
    const m = policy.match(/ALL_ROLE_IDS:\s*RoleId\[\]\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(m, 'model-config-policy.ts 缺少 ALL_ROLE_IDS');
    const count = (m[1].match(/'[a-z]+'/g) || []).length;
    assert.strictEqual(count, 9, 'ALL_ROLE_IDS 应恰为 9 个（本守卫的数量基准），实际 ' + count);
    const zhNum = { 9: '九', 10: '十' }[count];
    // 前端：任何文件都不得再写「十大岗位 / 10 岗位 / 十岗位」
    const bad = [];
    for (const [file, src] of webSources()) {
      if (/十大岗位|10\s*岗位|十岗位/.test(src)) bad.push(file);
    }
    assert.deepStrictEqual(bad, [], '岗位数量与实际不符（后端 ALL_ROLE_IDS 为 ' + count + ' 个）：' + bad.join(', '));
    // 首页副标题必须用对齐后的数字（中英各一处，i18n 与 app.js 兜底文案都要对）
    const i18n = read('i18n.js');
    assert.match(i18n, new RegExp(zhNum + '大岗位智能体协同创作'), 'i18n 中文首页副标题的岗位数必须为' + zhNum + '大');
    assert.match(i18n, /homeSub:\s*'Nine agent roles/, 'i18n 英文首页副标题必须为 Nine agent roles');
    assert.ok(!/Ten agent roles|Ten specialized agents/.test(read('app.js')), 'app.js 英文兜底文案仍写 Ten');
    // 后端对外的 Word 清单同源文案
    const docx = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'api-directory-docx.ts'), 'utf8');
    assert.ok(!/十岗位|10\s*岗位/.test(docx), 'api-directory-docx.ts 的岗位数文案仍与实际不符');
  });

  it('G8 导出权益文案的会员档位必须与后端门控常量一致', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'script-doc.ts'), 'utf8');
    const min = doc.match(/EXPORT_MIN_LEVEL[^{]*\{([\s\S]*?)\};/);
    assert.ok(min, 'script-doc.ts 缺少 EXPORT_MIN_LEVEL');
    const levelOf = (body, fmt) => (body.match(new RegExp(fmt + ':\\s*MemberLevel\\.(\\w+)')) || [])[1];
    const docxLevel = levelOf(min[1], 'docx');
    const pdfLevel = levelOf(min[1], 'pdf');
    assert.ok(docxLevel && pdfLevel, 'EXPORT_MIN_LEVEL 必须声明 docx/pdf 档位');
    // 去水印 / 分镜附录：比较表达式里的档位才是真源（函数开头的 ?? FREE 兜底不算）
    const wmLevel = (doc.match(/canRemoveWatermark[\s\S]{0,260}?LEVEL_RANK\[MemberLevel\.(\w+)\]/) || [])[1];
    const shotLevel = (doc.match(/canExportShotList[\s\S]{0,320}?LEVEL_RANK\[MemberLevel\.(\w+)\]/) || [])[1];
    assert.ok(wmLevel && shotLevel, '去水印/分镜附录的门控档位应可从 script-doc.ts 读出');

    const ZH = { FREE: '免费', BASIC: '基础', ADVANCED: '高级', PRO: '专业' };
    const EN = { FREE: 'Free', BASIC: 'Basic', ADVANCED: 'Advanced', PRO: 'Pro' };
    const i18n = read('i18n.js');
    const copy = (key, lang) => {
      const block = i18n.slice(i18n.indexOf(lang === 'zh' ? '  zh: {' : '  en: {'));
      const m = block.match(new RegExp(key + ":\\s*'([^']*)'"));
      assert.ok(m, '词典缺少 ' + key + '（' + lang + '）');
      return m[1];
    };
    const cases = [
      ['dlDocx', docxLevel],
      ['dlPdf', pdfLevel],
      ['dlShotHint', shotLevel],
    ];
    for (const [key, level] of cases) {
      assert.ok(copy(key, 'zh').includes(ZH[level]), `${key} 中文文案未写对档位（应为${ZH[level]}会员）`);
      assert.ok(copy(key, 'en').includes(EN[level] + '+'), `${key} 英文文案未写对档位（应为 ${EN[level]}+）`);
    }
    // 去水印文案没有档位声明是允许的，但不能写着更低的档位（会诱导基础会员点空）
    const noWm = copy('dlNoWm', 'zh');
    for (const low of ['免费', '基础']) assert.ok(!noWm.includes(low), '去水印文案不得暗示低于 ' + ZH[wmLevel] + ' 的档位');
  });

  it('G9 会员权益说明不得手写档位数字（项目上限/折扣须由服务端目录派生）', () => {
    // 真源：src/config/pricing.ts 的 MEMBERSHIP.maxActiveProjects
    const pricing = fs.readFileSync(path.join(ROOT, 'src', 'config', 'pricing.ts'), 'utf8');
    const memBlock = pricing.slice(pricing.indexOf('export const MEMBERSHIP'), pricing.indexOf('} as const;', pricing.indexOf('export const MEMBERSHIP')));
    assert.ok(memBlock.length > 0, '未能定位 MEMBERSHIP 真源块');
    const limits = ['FREE', 'BASIC', 'ADVANCED', 'PRO'].map((lv) => {
      const seg = memBlock.slice(memBlock.indexOf(lv + ': {'));
      return Number((seg.match(/maxActiveProjects:\s*(\d+)/) || [])[1]);
    });
    assert.deepStrictEqual(limits, [2, 10, 30, 100], '提取器读到的项目上限与预期不符，先修提取器：' + limits.join(','));
    // 前端任何文件都不得再把这组数字/折扣写成固定文案
    const banned = [/免费\s*2\s*个[\s\S]{0,20}基础\s*10\s*个/, /免费2\/基础10\/高级30\/专业100/];
    const hits = [];
    for (const [file, src] of webSources()) {
      for (const re of banned) if (re.test(src)) hits.push(file + ' 命中 ' + re);
    }
    assert.deepStrictEqual(hits, [], '权益数字又回到手写文案（会员价格一调就失真）：\n' + hits.join('\n'));
    // 必须由目录数据动态渲染
    const app = read('app.js');
    assert.match(app, /\$\('vipLimitNote'\)/, 'app.js 必须渲染 #vipLimitNote');
    assert.match(app, /p2\.maxActiveProjects/, '项目上限必须取自目录 plans.maxActiveProjects');
    assert.match(app, /p2\.vaRate/, '增值折扣必须取自目录 plans.vaRate');
    assert.match(read('index.html'), /id="vipLimitNote"/, 'index.html 必须保留可被动态填充的 #vipLimitNote');
    // 后端目录必须下发 VA_LEVEL_RATE（否则前端拿不到折扣真源）
    const order = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'order.ts'), 'utf8');
    assert.match(order, /vaRate:\s*VA_LEVEL_RATE\[lv\]/, '/order/catalog 必须下发 vaRate=VA_LEVEL_RATE[lv]');
  });

  it('G10 反馈/知识库的状态与类型不得直接暴露原始枚举', () => {
    // ① 词典：新工单 DB 默认 PENDING（prisma Feedback.status），缺键时中文徽章会漏出枚举值
    const i18n = read('i18n.js');
    const zhStart = i18n.indexOf('  zh: {'), enStart = i18n.indexOf('  en: {');
    assert.ok(zhStart > 0 && enStart > zhStart, '无法定位 zh/en 词典块');
    for (const [name, block] of [['zh', i18n.slice(zhStart, enStart)], ['en', i18n.slice(enStart)]]) {
      assert.match(block, /fbStatus_PENDING:\s*'/, name + ' 词典缺少 fbStatus_PENDING（新工单默认态会显示原始枚举）');
      assert.match(block, /fbTypeBUG:\s*'/, name + ' 词典缺少 fbTypeBUG');
    }
    // ② 筛选下拉：每个状态选项都必须走词典，且不得以枚举值本身作文案
    const html = read('index.html');
    const start = html.indexOf('id="fbStatus"');
    assert.ok(start > 0, '缺少反馈状态筛选 #fbStatus');
    const sel = html.slice(start, html.indexOf('</select>', start));
    for (const v of ['PENDING', 'EXECUTING', 'TODO', 'REJECTED']) {
      const tag = sel.match(new RegExp('<option value="' + v + '"([^>]*)>'));
      assert.ok(tag, '反馈状态筛选缺少 ' + v + ' 选项');
      assert.match(tag[1], /data-i="fbStatus_/, v + ' 选项必须用 data-i 走词典');
      assert.ok(!new RegExp('<option value="' + v + '"[^>]*>' + v + '<').test(sel), v + ' 不得直接以枚举值作选项文案');
    }
    // ③ 列表徽章：状态名走词典，不在英文界面回落枚举；知识库状态/类型均需本地化
    const app = read('app.js');
    assert.ok(!/lang === 'en' \? s : \(FB_STATUS_ZH/.test(app), '英文界面不得直接显示 PENDING/TODO 原始枚举');
    assert.match(app, /const fbStatusName = \(s\) => \{ const k = 'fbStatus_' \+ s;/, '反馈状态名必须经 t() 词典解析');
    assert.match(app, /stName\[k\.status\]/, '知识库状态徽章必须本地化（不得直接输出 APPROVED/PENDING）');
    assert.match(app, /kindName\[k\.kind\]/, '知识库类型标签必须本地化（不得直接输出 TEXT/URL）');
    assert.ok(!/\[?\$\{k\.status\}<\/span>/.test(app), '知识库列表不得直接渲染 k.status');
  });

  it('G11 交易权益文案必须与后端「可交易档位」门控一致（免费版不得显示 0% 佣金）', () => {
    // 真源：pricing.ts 的 MIN_TRADE_LEVEL + canTrade；免费用户 market.ts 上架直接 403
    const pricing = fs.readFileSync(path.join(ROOT, 'src', 'config', 'pricing.ts'), 'utf8');
    assert.match(pricing, /export const MIN_TRADE_LEVEL\s*=\s*MemberLevel\.\w+/, 'pricing.ts 必须声明交易最低档位 MIN_TRADE_LEVEL');
    assert.match(pricing, /export function canTrade\(/, 'pricing.ts 必须提供 canTrade()');
    // 路由必须复用同一门控，不得再硬编码 'FREE'（否则升档门槛一调，文案就再次脱节）
    const market = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'market.ts'), 'utf8');
    assert.ok(!/level === 'FREE'/.test(market), "market.ts 不得再硬编码 level === 'FREE'");
    assert.match(market, /canTrade\(level\)/, 'market.ts 上架门控必须调用 canTrade(level)');
    // 目录必须下发 canTrade，前端才能按档位渲染「升级后可上架」而不是展示 0% 佣金
    const order = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'order.ts'), 'utf8');
    assert.match(order, /canTrade:\s*canTrade\(lv\)/, '/order/catalog 必须下发 canTrade=canTrade(lv)');
    const app = read('app.js');
    assert.match(app, /p\.canTrade === false/, 'app.js 必须按 catalog.canTrade 区分交易权益');
    assert.ok(!/交易佣金 0%/.test(app + read('index.html') + read('i18n.js')), '免费版不得把「交易佣金 0%」当作权益展示（实际不可上架）');
    // 副标题事实核对：ADVANCED 与 PRO 的 engines 数组完全相同，写「引擎组合越强」属名实不符
    const i18n = read('i18n.js');
    assert.ok(!/引擎组合越强/.test(i18n), 'vip 副标题不得声称「档位越高引擎组合越强」（高级/专业可用引擎档相同）');
    assert.ok(!/stronger engine mixes/i.test(i18n), '英文副标题同样不得声称 stronger engine mixes');
    assert.ok(/旗舰/.test(i18n) && /flagship/i.test(i18n), '副标题应写清旗舰引擎组合的开放档位（与 engines 真源一致）');
    // 权益折扣必须真接线：vip 页承诺「AI 共创（拆爆款/围读/选题会）积分消耗折扣」，
    // 选题会与围读此前走固定价 consumeValueAdded，承诺从未生效（静默失效）。
    const room = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'room.ts'), 'utf8');
    assert.match(room, /vaPointsForLevel\(key, await levelOf\(userId\)\)/, '选题会/围读必须按会员档位计价');
    assert.match(room, /refundFlexible\(tx, userId, points, key, refId, idem\)/, '退款必须按实扣积分，不得按标准价多退');
    assert.ok(!/consumeValueAdded\(tx, userId, key/.test(room), '选题会/围读不得再走固定价扣费');
  });
});
