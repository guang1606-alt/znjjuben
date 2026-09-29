const test = require('node:test');
const assert = require('node:assert');
const L = require('../dist/engine/listen-script.js');

const SAMPLE = [
  '第1集 雨夜归来',
  '内景 老旧居民楼·楼道 夜',
  '镜头：缓推至302门口，声控灯忽明忽暗。',
  '△林晚攥紧钥匙，指节发白，鞋尖还滴着水。',
  '林晚（压低声音）：妈，是我，我回来了。',
  '母亲（哽咽）：你还知道回来……三年了。',
  '配乐：钢琴单音渐入。',
  '窗外一道闪电劈过，照亮她脸上未干的泪痕。',
].join('\n');

// c204：行分类器对外导出（diff 变更摘要卡复用同一套口径，禁止各引擎各写一份正则）
test('c204 parseScriptLine：场标/集标题→scene；△动作→action；中英台词带 speaker/cue/content', () => {
  assert.strictEqual(L.parseScriptLine('内景 老旧居民楼·楼道 夜').kind, 'scene');
  assert.strictEqual(L.parseScriptLine('外景 巷口·夜').kind, 'scene');
  assert.strictEqual(L.parseScriptLine('INT. LOBBY - DAY').kind, 'scene');
  assert.strictEqual(L.parseScriptLine('第1集 雨夜归来').kind, 'scene');
  assert.strictEqual(L.parseScriptLine('△林晚攥紧钥匙，指节发白。').kind, 'action');
  assert.strictEqual(L.parseScriptLine('门外喇叭响了两声。').kind, 'action');
  const zh = L.parseScriptLine('林晚（压低声音）：妈，是我。');
  assert.strictEqual(zh.kind, 'dialogue');
  assert.strictEqual(zh.speaker, '林晚');
  assert.strictEqual(zh.cue, '压低声音');
  assert.strictEqual(zh.content, '妈，是我。');
  const en = L.parseScriptLine('JOHN (smiling): Hey there.');
  assert.strictEqual(en.kind, 'dialogue');
  assert.strictEqual(en.speaker, 'JOHN');
  assert.strictEqual(en.cue, 'smiling');
  assert.strictEqual(en.content, 'Hey there.');
  assert.strictEqual(typeof L.classifyScriptLine, 'function');
  assert.strictEqual(L.classifyScriptLine('内景 小店·日'), 'scene');
});

test('c204 parseScriptLine：技术行/空值→other；名位含句读的叙述句不误判为台词', () => {
  assert.strictEqual(L.parseScriptLine('镜头：缓推至门口。').kind, 'other');
  assert.strictEqual(L.parseScriptLine('配乐：钢琴渐入。').kind, 'other');
  assert.strictEqual(L.parseScriptLine('   ').kind, 'other');
  assert.strictEqual(L.parseScriptLine(null).kind, 'other');
  assert.strictEqual(L.parseScriptLine(undefined).kind, 'other');
  // 名位带逗号的叙述句（“原来，她一直都在：……”）不得当成角色台词
  assert.strictEqual(L.parseScriptLine('原来，她一直都在：日记里写得明明白白。').kind, 'action');
});

test('听剧本：场标/动作/台词三类片段正确切分，技术行被剔除', () => {
  const r = L.buildListenScript(SAMPLE);
  const kinds = r.segments.map((s) => s.kind);
  assert.ok(kinds.includes('scene'));
  assert.ok(kinds.includes('dialogue'));
  assert.ok(kinds.includes('action'));
  // 镜头/配乐技术提示行不进入朗读
  assert.ok(!r.segments.some((s) => /^(镜头|配乐)[：:]/.test(s.text)));
  // 集标题作为场景口播
  assert.ok(r.segments[0].text.includes('第1集'));
  // 场标识别
  const scene = r.segments.find((s) => s.kind === 'scene' && s.text.includes('内景'));
  assert.ok(scene, '内景场标应识别为 scene');
  assert.strictEqual(scene.speaker, '旁白');
});

test('听剧本：台词带角色名与情绪提示，speakerSet 去重统计', () => {
  const r = L.buildListenScript(SAMPLE);
  const lin = r.segments.find((s) => s.speaker === '林晚');
  assert.ok(lin);
  assert.strictEqual(lin.cue, '压低声音');
  assert.ok(lin.text.includes('我回来了'));
  assert.strictEqual(r.dialogueCount, 2);
  assert.deepStrictEqual(r.speakerSet, ['林晚', '母亲']);
  assert.ok(r.sceneCount >= 2);
});

test('听剧本：动作行剥离舞台符号，narration 可直接朗读', () => {
  const r = L.buildListenScript(SAMPLE);
  assert.ok(!r.narration.includes('△'));
  assert.ok(r.narration.includes('林晚'));
  assert.ok(r.narration.includes('母亲（哽咽）：你还知道回来'));
  assert.ok(r.totalChars > 0);
  assert.ok(r.estSeconds > 0);
  r.segments.forEach((s) => assert.ok(s.estSeconds > 0));
});

test('听剧本：时长估算中文为正且随字数单调增长', () => {
  const short = L.estimateSpeechSeconds('你好。');
  const long = L.estimateSpeechSeconds('你好，这是一段明显更长的中文朗读文本，包含多个分句，以及句号收尾。');
  assert.ok(short > 0 && long > short);
});

test('听剧本：英文本走 Narrator 与英文语速', () => {
  const en = 'INT. APARTMENT HALLWAY - NIGHT\nJane (whispering): I am home.\nThe light flickers above her head.';
  const r = L.buildListenScript(en, { lang: 'en' });
  const scene = r.segments.find((s) => s.kind === 'scene');
  assert.strictEqual(scene.speaker, 'Narrator');
  const jane = r.segments.find((s) => s.speaker === 'Jane');
  assert.ok(jane && jane.cue === 'whispering');
});

test('听剧本：空串与纯技术行返回空片段，不报错', () => {
  assert.deepStrictEqual(L.buildListenScript('').segments, []);
  const r = L.buildListenScript('镜头：特写\n配乐：BGM起');
  assert.strictEqual(r.segments.length, 0);
  assert.strictEqual(r.estSeconds, 0);
});

// c205 复盘：场记台账行（时间/地点/人物/道具等元数据前缀）不是任何角色的台词，
// 旧口径下 DIALOGUE_RE 会把"时间：夜"判成角色"时间"的对白——TTS 念出台账、speakerSet 混入假角色、
// 版本摘要"台词N句"虚高。台账行归 other（不朗读、技术计数），同时合法角色名不得被误杀。
test('c205 parseScriptLine：中文场记台账前缀→other，不冒充角色台词', () => {
  for (const line of [
    '时间：夜', '地点：外滩江边', '日期：中秋节后三日', '场次：12场',
    '人物：林晚、母亲、老周', '出场：围观群众若干', '道具：黄铜钥匙一把',
    '服装：洗得发白的校服', '备注：本场实拍雨戏', '注释：此处分镜待补',
    '提要：女主首次发现密信', '字幕：三年后', '转场：闪回', '场景：教室',
  ]) {
    assert.strictEqual(L.parseScriptLine(line).kind, 'other', `台账行应归 other：${line}`);
  }
});

test('c205 parseScriptLine：英文场记台账前缀→other', () => {
  for (const line of [
    'TIME: NIGHT', 'LOCATION: THE BUND', 'PLACE: ROOFTOP', 'DATE: THREE DAYS LATER',
    'CAST: JANE, MARY', 'CHARACTERS: JANE AND MARY', 'PROPS: A BRASS KEY',
    'PROP: OLD PHOTO', 'WARDROBE: FADED SCHOOL UNIFORM', 'COSTUME: BLACK SUIT',
    'NOTE: real rain on set', 'NOTES: match cut here',
  ]) {
    assert.strictEqual(L.parseScriptLine(line).kind, 'other', `slate line should be other: ${line}`);
  }
});

test('c205 parseScriptLine：台账词表不得误杀合法角色台词', () => {
  // “时光/小时”是可能的真人角色名，不在台账词表内；普通角色台词照常识别
  const a = L.parseScriptLine('时光：你终于来了。');
  assert.strictEqual(a.kind, 'dialogue');
  assert.strictEqual(a.speaker, '时光');
  const b = L.parseScriptLine('林晚（低声）：地点我已经选好了。');
  assert.strictEqual(b.kind, 'dialogue');
  assert.strictEqual(b.speaker, '林晚');
  assert.ok(b.content.includes('地点我已经选好了'));
});

test('c205 buildListenScript：台账行不朗读、不进 speakerSet、不计台词数', () => {
  const raw = [
    '内景 老教室·日',
    '时间：白天',
    '地点：县三中教室',
    '人物：林晚、陈默',
    '林晚：你怎么才来。',
    '陈默（喘气）：路上堵了。',
  ].join('\n');
  const r = L.buildListenScript(raw);
  assert.strictEqual(r.dialogueCount, 2);
  assert.deepStrictEqual(r.speakerSet, ['林晚', '陈默']);
  assert.ok(!r.segments.some((s) => /^(时间|地点|人物)[：:]/.test(s.text)), '台账行不得进入朗读片段');
  assert.ok(!r.narration.includes('时间：白天'));
});

// c207 复盘：朗读化不足——英文场标裸字母与舞台技术括号会被 TTS 念出声
test('c207 buildListenScript：英文场标 INT./EXT. 口播化，TTS 不念裸字母', () => {
  const raw = ['INT. APARTMENT 302 - NIGHT', 'LI WEI: Open the door.', 'EXT. STREET - DAWN'].join('\n');
  const r = L.buildListenScript(raw, { lang: 'en' });
  const scenes = r.segments.filter((s) => s.kind === 'scene');
  assert.strictEqual(scenes.length, 2);
  assert.ok(/Interior\s+APARTMENT/i.test(scenes[0].text), 'INT. 应口播为 Interior');
  assert.ok(/Exterior\s+STREET/i.test(scenes[1].text), 'EXT. 应口播为 Exterior');
  assert.ok(!/\bINT\.?\b/.test(r.narration) && !/\bEXT\.?\b/.test(r.narration), '整篇朗读稿不得残留裸 INT/EXT');
});

test('c207 buildListenScript：动作/场标里的音效配乐舞台括号被剥离，纯提示行不成段', () => {
  const raw = [
    '内景 老宅堂屋·夜',
    '（音效：门轴吱呀一声）',
    '△ 她抬眼，（BGM《夜曲》渐起）目光变冷。',
    '林晚：你来了。',
    '(SFX: doorbell rings)',
    'He looks up. (V.O.) I knew this day would come.',
  ].join('\n');
  const r = L.buildListenScript(raw);
  const spoken = r.segments.map((s) => s.text).join('\n');
  assert.ok(!spoken.includes('音效'), '中文音效提示括号不得朗读');
  assert.ok(!spoken.includes('BGM'), 'BGM 提示不得朗读');
  assert.ok(!/SFX/i.test(spoken), '英文 SFX 提示不得朗读');
  assert.ok(!/V\.O\./i.test(spoken), 'V.O. 画外音标记不得朗读');
  assert.ok(spoken.includes('她抬眼') && spoken.includes('目光变冷'), '剥括号后正文必须保留且连贯');
  assert.ok(spoken.includes('He looks up') && spoken.includes('I knew this day would come'), '英文动作正文保留');
  // 两条纯提示行剥净后不得生成空段
  assert.ok(r.segments.every((s) => s.text.trim().length > 0));
});

test('c207 buildListenScript：封闭词表不误杀——普通动作/情绪括号与台词内括号保留', () => {
  const raw = [
    '△ 他握紧拳（指甲掐进掌心），没有说话。',
    '△ 她（望着窗外）轻声叹息。',
    '陈默：我没事（小声），你先走。',
  ].join('\n');
  const r = L.buildListenScript(raw);
  const spoken = r.segments.map((s) => s.text).join('\n');
  assert.ok(spoken.includes('指甲掐进掌心'), '非提示词的动作描写括号必须保留（宁放勿错杀）');
  assert.ok(spoken.includes('望着窗外'), '普通动作括号保留');
  const line = r.segments.find((s) => s.kind === 'dialogue');
  assert.ok(line.text.includes('小声'), '台词正文内情绪括号不走舞台剥离，原样保留给表演');
});

// c207 复盘：英文剧本标准对白 slug 是"名+姓"（可带 MR./DR. 称谓），旧台词正则不允许空格，整句被误判动作
test('c207 parseScriptLine：英文"名 姓"对白 slug 识别为台词，含称谓/情绪提示亦可', () => {
  const a = L.parseScriptLine('LI WEI: Drive fast.');
  assert.strictEqual(a.kind, 'dialogue'); assert.strictEqual(a.speaker, 'LI WEI'); assert.strictEqual(a.content, 'Drive fast.');
  const b = L.parseScriptLine('Li Wei（whispers）: Drive fast.');
  assert.strictEqual(b.kind, 'dialogue'); assert.strictEqual(b.speaker, 'Li Wei'); assert.strictEqual(b.cue, 'whispers');
  const c = L.parseScriptLine('MR. SMITH: Sit down.');
  assert.strictEqual(c.kind, 'dialogue'); assert.strictEqual(c.speaker, 'MR. SMITH');
});

test('c207 parseScriptLine：含小写词的英文叙述句不得被"名 姓"slug 误判', () => {
  // "She said/He thought" 是叙述句（含小写动词），不是角色名；逗号句读同样拦截
  assert.strictEqual(L.parseScriptLine('She said: hello there.').kind, 'action');
  assert.strictEqual(L.parseScriptLine('He thought: maybe not.').kind, 'action');
  assert.strictEqual(L.parseScriptLine('Wait, man: go now.').kind, 'action');
});

test('c207 buildListenScript：英文全名角色进 speakerSet 且分角色声线可查', () => {
  const raw = ['INT. CAR - NIGHT', 'LI WEI: Drive.', 'JOHN: Go.'].join('\n');
  const r = L.buildListenScript(raw, { lang: 'en' });
  assert.deepStrictEqual(r.speakerSet, ['LI WEI', 'JOHN']);
  const lw = r.segments.find((s) => s.speaker === 'LI WEI');
  assert.ok(lw && lw.kind === 'dialogue' && lw.text === 'Drive.');
});

test('听剧本：权益说明双语完整', () => {
  const zh = L.listenEntitleNote('zh');
  const en = L.listenEntitleNote('en');
  assert.ok(zh.title.includes('高级会员') && zh.lines.length === 2);
  assert.ok(/Advanced/.test(en.title) && en.lines.length === 2);
});

// c208 功能轮：LLM 成稿/改写稿偶发残留 Markdown 排版标记（**强调**、## 标题、--- 分隔线、反引号、引用符），
// TTS 会逐字念出"星号、井号、减号"；重复叹/问号造成机械拖音。朗读化必须净化这些排版噪声（台词也净化——
// markdown 标记不是表演信息，与 c207"台词正文情绪括号永不剥"不冲突）。
test('c208 buildListenScript：Markdown 排版标记不进朗读文本（含台词正文）', () => {
  const raw = [
    '## 第1集 **星夜**',
    '内景 酒吧·夜',
    '△ 她推开那扇 `铁门`，灯光打在脸上。',
    '林晚：**你给我站住！** 这件事没完。',
    '陈默：__不可能__，`code` 不会出错。',
    '> 雨还在下，像三年前那个晚上。',
  ].join('\n');
  const r = L.buildListenScript(raw);
  const spoken = r.segments.map((s) => s.text).join('\n');
  assert.ok(!/\*|#|`|_{2}|^>/m.test(spoken), '星号/井号/反引号/下划线/引用符不得残留：' + spoken);
  assert.ok(spoken.includes('星夜'), '去除标记后文字保留');
  assert.ok(spoken.includes('你给我站住'), '台词去标记后正文保留');
  assert.ok(spoken.includes('不可能'), '__斜体__ 标记剥离后文字保留');
  assert.ok(spoken.includes('code'), '行内反引号代码只剥符号不删词');
  const cite = r.segments.find((s) => s.text.includes('雨还在下'));
  assert.ok(cite && !cite.text.startsWith('>'), '引用前缀剥离、内容按叙述保留');
});

test('c208 buildListenScript：水平分隔线整行剔除，不产生空朗读段；重复叹问号归一', () => {
  const raw = [
    '第1集 测试',
    '---',
    '***',
    '林晚：真的吗？？？我不敢相信！！！',
    '================',
  ].join('\n');
  const r = L.buildListenScript(raw);
  const spoken = r.segments.map((s) => s.text).join('\n');
  assert.ok(!r.segments.some((s) => /^[-*=]{3,}$/.test(s.text)), '纯分隔线不得成段');
  const line = r.segments.find((s) => s.kind === 'dialogue');
  assert.ok(line, '台词仍在');
  assert.ok(!/！{2,}/.test(line.text) && !/？{2,}/.test(line.text) && !/!{2,}/.test(line.text) && !/\?{2,}/.test(line.text),
    '重复叹/问号归一为单个：' + line.text);
  assert.ok(line.text.includes('？') && line.text.includes('！'), '句读本身保留');
});

test('c208 buildListenScript：净化不误伤合法内容（省略号/数学/连线/单星脚注/正常标点）', () => {
  const raw = [
    '第1集 守夜人',
    '△ 她等了三年……从2019-2021，一共872天。',
    '林晚：我给你打了80分——不，是90分。',
    '陈默：比分3:1，倒计时10、9、8！',
  ].join('\n');
  const r = L.buildListenScript(raw);
  const spoken = r.segments.map((s) => s.text).join('\n');
  assert.ok(spoken.includes('三年……'), '省略号是合法停顿，保留');
  assert.ok(spoken.includes('2019-2021'), '年份区间连字符保留');
  assert.ok(spoken.includes('80分——不'), '破折号是语气转折，保留');
  assert.ok(spoken.includes('3:1') && spoken.includes('10、9、8'), '比分/顿号序列保留');
  assert.ok(!/[*#`]/.test(spoken), '仅净化排版符号');
});
