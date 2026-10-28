const { describe, it } = require('node:test');
const assert = require('node:assert');
const mp = require('../dist/lib/model-proxy.js');
mp.__setProviderSource(async () => ({ providers: [], routing: {} }));
const { runEpisode } = require('../dist/agents/pipeline.js');
const { EngineTier } = require('../dist/config/pricing.js');
const F = require('../dist/engine/script-format.js');

const cjkRe = /[一-鿿]/;
const bible = () => ({ worldview: '', characters: {}, timeline: [], foreshadow: [] });

const PAD = '她把纸页一张张码齐，指尖压平折角，目光落在窗外的车流上，呼吸放得很慢，肩线一直没有松下来。';
const PAD2 = '她抬头看了一眼墙上的钟，又低下头去。';

// 9 场 9 个说话角色的真人稿：版式齐全（有△/有台词）、字数在区间内，但制片规模排不出通告
function badZhDraft() {
  // 两字名（DIALOGUE_RE 要求 ≥2 字），确保坏稿只违反制片维度、版式本身是齐的
  const names = ['甲一', '乙二', '丙三', '丁四', '戊五', '己六', '庚七', '辛八', '壬九'];
  const rows = ['《测试》 第1集'];
  for (let i = 0; i < 9; i++) {
    rows.push(`场景${i + 1}：会议室${i + 1}·日`);
    rows.push('△她把文件夹推到桌面中央，指节在桌面上敲了两下。');
    rows.push(`${names[i]}（冷冷）：这句话我只说一次。`);
    rows.push(PAD);
    rows.push(PAD2);
  }
  return rows.join('\n');
}

// 合规黄金稿：4 场、4 个说话角色、一处地点复用、全部标内外景、全白天
function goodZhDraft() {
  const rows = ['《测试》 第1集'];
  const scenes = [
    ['内景 咖啡馆·日', '△林晚把文件夹按在桌面，指尖压住边角，眼睛盯着门口。', '林晚（压低声音）：今天这一步，我不能再退。'],
    ['外景 楼道·日', '△陈凯从楼梯拐角上来，把外套搭在臂弯，脚步在最后一级停住。', '陈凯（冷淡）：合同我看过了，条件没得谈。'],
    ['内景 咖啡馆·日', '△林晚把杯子推到对面，杯底在桌面划出一圈水痕。', '林晚（很轻）：那就不谈条件，谈谈你怕什么。'],
    ['外景 天台·日', '△陈凯站在护栏边，风把他的衬衫吹得贴在背上。', '陈凯（低声）：你以为我不敢。'],
  ];
  for (const [head, action, line] of scenes) {
    rows.push(head, action, line, PAD.repeat(4), PAD2);
  }
  return rows.join('\n');
}

function badEnDraft() {
  const names = ['ALEX', 'BLAKE', 'CARA', 'DANA', 'ELI', 'FIONA', 'GREG', 'HANA', 'IVAN'];
  const rows = [];
  for (let i = 0; i < 9; i++) {
    rows.push(`INT. OFFICE ${i + 1} - DAY`);
    rows.push('△ She pushes the folder to the centre of the desk and taps it twice.');
    rows.push(`${names[i]}: I will say this only once.`);
    rows.push('She stacks the pages one by one, presses the creases flat, and keeps her eyes on the traffic outside.');
  }
  return rows.join('\n');
}

function stubWriter(draft) {
  const cap = [];
  mp.callText = async (t, r, p) => {
    cap.push({ r, p });
    if (r === 'writer') return { text: draft, sandbox: false, costFen: 0 };
    return { text: '', sandbox: true, costFen: 0 };
  };
  mp.callJson = mp.callText;
  return cap;
}

describe('v2.338 真人实拍制片硬伤驱动重写', () => {
  it('中文：9 场 9 角色的稿子触发制片重排，重写后回到可拍摄规模且闸门通过', async () => {
    const bad = badZhDraft();
    const good = goodZhDraft();
    const badReport = F.validateScript(bad, 'LIVE');
    assert.strictEqual(badReport.feasibility.level, 'over', '夹具必须先坐实为不可拍');
    assert.ok(badReport.hasAction && badReport.hasDialogue, '坏稿版式本身是齐的，重写只能由制片硬伤触发');
    assert.strictEqual(F.validateScript(good, 'LIVE').feasibility.level, 'ok', '黄金稿必须制片无压力');
    assert.ok(F.validateScript(good, 'LIVE').inRange, `黄金稿字数需在区间内，实际 ${F.validateScript(good, 'LIVE').cjk}`);

    const cap = [];
    mp.callText = async (t, r, p) => {
      cap.push({ r, p });
      if (r === 'writer') return { text: bad, sandbox: false, costFen: 0 };
      if (r === 'polisher' && p.includes('制片重排')) return { text: good, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const notes = [];
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭', (e) => notes.push(e.note || ''), {
      episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'LIVE',
    });

    const repair = cap.filter((x) => x.r === 'polisher' && x.p.includes('制片重排'));
    assert.strictEqual(repair.length, 1, '一次修复就应达标，不应重复重写');
    const task = repair[0].p;
    assert.ok(task.includes('单集 9 场'), '修复提示必须带机器诊断出的具体场次硬伤');
    assert.ok(task.includes('3-5场') && task.includes('不超过6人') && task.includes('800-1000'), '修复提示必须给出可拍摄规模与字数约束');
    assert.ok(notes.some((n) => n.includes('制片闸门') && n.includes('不可拍')), '过程事件需显性告知制片硬伤');
    assert.strictEqual(r.format.feasibility.level, 'ok', r.format.violations.join(';'));
    assert.strictEqual(r.format.pass, true, r.format.violations.join(';'));
    assert.ok(!r.format.violations.some((v) => v.includes('制片不可行')));
  });

  it('中文：模型拒绝重排时最多重写 2 轮，成稿如实保留不可拍违规不假装通过', async () => {
    const bad = badZhDraft();
    const cap = [];
    mp.callText = async (t, r, p) => {
      cap.push({ r, p });
      if (r === 'writer') return { text: bad, sandbox: false, costFen: 0 };
      if (r === 'polisher' && p.includes('制片重排')) return { text: bad, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const r = await runEpisode(EngineTier.STANDARD, bible(), '都市逆袭', () => {}, {
      episodeCount: 1, episodeIndex: 0, lang: 'zh', scriptFormat: 'LIVE',
    });
    assert.strictEqual(cap.filter((x) => x.r === 'polisher' && x.p.includes('制片重排')).length, 2, '重写上限 2 轮，不许无限重试');
    assert.strictEqual(r.format.feasibility.level, 'over');
    assert.ok(r.format.violations.some((v) => v.includes('制片不可行')), '修不掉就必须如实报错');
    assert.strictEqual(r.format.pass, false);
  });

  it('英文：制片重排提示零中文，诊断文案为英文', async () => {
    const bad = badEnDraft();
    const badReport = F.validateScript(bad, 'LIVE');
    assert.ok(badReport.hasAction && badReport.hasDialogue, '英文坏稿版式齐备，只违反制片规模');
    assert.strictEqual(badReport.feasibility.level, 'over');
    const cap = [];
    mp.callText = async (t, r, p) => {
      cap.push({ r, p });
      if (r === 'writer') return { text: bad, sandbox: false, costFen: 0 };
      if (r === 'polisher' && p.includes('PRODUCTION REPAIR')) return { text: bad, sandbox: false, costFen: 0 };
      return { text: '', sandbox: true, costFen: 0 };
    };
    mp.callJson = mp.callText;
    const r = await runEpisode(EngineTier.STANDARD, bible(), 'an urban comeback', () => {}, {
      episodeCount: 1, episodeIndex: 0, lang: 'en', scriptFormat: 'LIVE',
    });
    const repair = cap.filter((x) => x.r === 'polisher' && x.p.includes('PRODUCTION REPAIR'));
    assert.ok(repair.length >= 1, '英文同样要触发制片重排');
    assert.ok(repair[0].p.includes('Unshootable:'), '英文修复提示需带 high 级场次硬伤（不能拿 mid 提示充数）');
    assert.ok(!cjkRe.test(repair[0].p), '英文修复提示零中文');
    assert.ok(r.format.violations.some((v) => v.startsWith('Production: ')), '英文违规前缀须为 Production: ');
  });
});
