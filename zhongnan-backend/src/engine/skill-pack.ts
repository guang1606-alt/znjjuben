/**
 * 剧本创作技能封装包（v2.19）
 * ------------------------------------------------------------------
 * 用户诉求：把沉淀的剧本创作技能“封装”交付，且①版本升级自动同步（本模块从各引擎/钩子/节拍/制式
 * 的真实导出动态装配，新增装置或引擎后无需手工搬运，技能包天然跟随升级）；②其他窗口可调用
 * （纯函数、零 IO、离线可跑，管线/立项会/后台下载/外部导入都只依赖这一个入口）。
 *
 * 包内只含“可迁移的创作方法与硬规则”，不含任何 API Key、价格成本与用户数据。
 */
import { CRAFT_ENGINES } from './craft-registry';
import { COMEDY_MECHANISMS } from './comedy-craft';
import { MYSTERY_TRICKS } from './mystery-craft';
import { TOURISM_DEVICES } from './tourism-craft';
import { TRANSMIGRATE_DEVICES } from './transmigrate-craft';
import { ROMANCE_DEVICES } from './romance-craft';
import { UNDERDOG_DEVICES } from './underdog-craft';
import { RULELOOP_DEVICES } from './ruleloop-craft';
import { COURT_DEVICES } from './courtintrigue-craft';
import { FAMILY_DEVICES } from './family-craft';
import { PRO_DEVICES } from './professional-craft';
import { XUAN_DEVICES } from './xuanhuan-craft';
import { SPY_DEVICES } from './spy-craft';
import { APOCALYPSE_DEVICES } from './apocalypse-craft';
import { MILITARY_DEVICES } from './military-craft';
import { ESPORTS_DEVICES } from './esports-craft';
import { META_DEVICES } from './meta-craft';
import { INV_DEVICES } from './investigation-craft';
import { TENDER_DEVICES } from './tender-craft';
import { RURAL_DEVICES } from './rural-craft';
import { SISTERHOOD_DEVICES } from './sisterhood-craft';
import { NATION_DEVICES } from './nation-craft';
import { ALL_HOOKS } from './hook-system';
import { HOOK_STRATEGIES } from './hook-strategy';
import { PACE_STRATEGIES, DIALOGUE_STRATEGIES, EMOTION_STRATEGIES, CHARACTER_STRATEGIES } from './creation-strategy';
import { BEAT_LIBRARY } from './beat-system';
import { WORD_RANGE } from './script-format';
import { THEME, AUDIENCE, REGION } from './style-library';
import { GENRE_COMPENSATION } from './genre-compensate';
import { unifiedSpecSummary, evolutionProtocolMd, CREATION_STAGES, SCORE_DIMENSIONS, HOOK_TAXONOMY } from './creation-spec';
import { buildSampleScript } from './sample-script';

/** 引擎 id → 装置表（注册表顺序一一对应；新增引擎在此登记即自动进包） */
const DEVICE_SOURCE: Record<string, { id: string; name: string; nameEn: string; principle: string; principleEn: string; technique: string; techniqueEn: string; risk: string; riskEn: string; kw: string[] }[]> = {
  comedy: COMEDY_MECHANISMS,
  mystery: MYSTERY_TRICKS,
  tourism: TOURISM_DEVICES,
  transmigrate: TRANSMIGRATE_DEVICES,
  romance: ROMANCE_DEVICES,
  underdog: UNDERDOG_DEVICES,
  ruleloop: RULELOOP_DEVICES,
  court: COURT_DEVICES,
  family: FAMILY_DEVICES,
  professional: PRO_DEVICES,
  xuanhuan: XUAN_DEVICES,
  spy: SPY_DEVICES,
  apocalypse: APOCALYPSE_DEVICES,
  military: MILITARY_DEVICES,
  esports: ESPORTS_DEVICES,
  meta: META_DEVICES,
  investigation: INV_DEVICES,
  tender: TENDER_DEVICES,
  rural: RURAL_DEVICES,
  sisterhood: SISTERHOOD_DEVICES,
  nation: NATION_DEVICES,
};

export interface SkillPackDevice {
  id: string; name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  keywords: string[];
}
export interface SkillPackEngine { id: string; name: string; deviceCount: number; devices: SkillPackDevice[] }

export interface BuiltinSkillPack {
  name: string;
  appVersion: string;
  packSchema: 1;
  builtAt: string;
  summary: { engines: number; devices: number; hooks: number; beatKinds: Record<string, number>; genres: number };
  engines: SkillPackEngine[];
  /** 四层钩子（开篇/集尾/场钩/微钩）——微钩内含动作/语言/氛围/情绪/信息差/伏笔六风味，与 hook-system 的 29 钩同口径 */
  hooks: { id: string; layer: 'open' | 'episode' | 'scene' | 'micro'; name: string; definition: string; technique: string; example: string }[];
  /** v2.27 钩子策略（用户选项 vs 系统默认）：五套命名策略，系统按题材智能匹配 */
  hookStrategies: { id: string; name: string; nameEn: string; tagline: string; taglineEn: string; fit: string; fitEn: string; strength: string; microFlavors: string[] }[];
  /** v2.28 节奏曲线策略 */
  paceStrategies: { id: string; name: string; nameEn: string; tagline: string; taglineEn: string; fit: string; fitEn: string; directive: string; directiveEn: string }[];
  /** v2.28 台词风格策略 */
  dialogueStrategies: { id: string; name: string; nameEn: string; tagline: string; taglineEn: string; fit: string; fitEn: string; colloquial: string; directive: string; directiveEn: string }[];
  /** v2.29 情绪/爽点曲线策略 */
  emotionStrategies: { id: string; name: string; nameEn: string; tagline: string; taglineEn: string; fit: string; fitEn: string; directive: string; directiveEn: string }[];
  /** v2.37 人物与关系策略（第五套策略层） */
  characterStrategies: { id: string; name: string; nameEn: string; tagline: string; taglineEn: string; fit: string; fitEn: string; lead: string; leadEn: string; relation: string; relationEn: string; directive: string; directiveEn: string }[];
  /** 三类节拍：反转/爽点兑付/情绪，各自手法库 */
  beats: { kind: string; count: number; items: { id: string; name: string }[] }[];
  /** 11 流派情绪补偿方法论 */
  genres: { id: string; name: string; realityPain: string; compensation: string; shortDramaFit: string; avoid: string }[];
  /** 真人编剧风格库：题材×受众×地域的可执行参数 */
  styles: { themes: Record<string, { label: string; colloquial: number; maxSentence: number; blank: string }>; audiences: Record<string, string>; regions: Record<string, string> };
  /** 双制式刚性标准 */
  scriptFormats: {
    LIVE: { cjkRange: [number, number]; layout: string[]; note: string };
    AIGC: { cjkRange: [number, number]; layout: string[]; note: string };
  };
  hardLines: string[];
}

/** 硬底线（任何引擎/模式都不可突破，随包下发） */
const HARD_LINES = [
  '剧本本质是标准剧本，禁止提示词手册式关键词堆砌与模型参数',
  '真人实拍单集800-1000字并给导演/演员留发挥空间；AIGC制作单集1200-1500字，用流畅自然段写足五维（环境/动作/微情绪/声音/台词），不堆技术标签、机器可按集场拆分',
  '人设/战力/时间线前后一致，不为推进剧情让人设崩塌',
  '主角成长与责任绑定，不纯靠掠夺踩人；杀伐点到为止，不渲染血腥，不宣扬封建压迫',
  '露骨淫秽色情、未成年人性化在所有法域硬禁；成熟向叙事走分级问卷与成稿筛查',
  '反转/打脸/以弱胜强必须有前置铺垫与明确依据，拒绝机械降神',
];

export function buildBuiltinSkillPack(appVersion = 'dev'): BuiltinSkillPack {
  const engines: SkillPackEngine[] = CRAFT_ENGINES.map((e) => {
    const src = DEVICE_SOURCE[e.id] ?? [];
    return {
      id: e.id, name: e.name, deviceCount: src.length,
      devices: src.map((d) => ({
        id: d.id, name: d.name, nameEn: d.nameEn,
        principle: d.principle, principleEn: d.principleEn,
        technique: d.technique, techniqueEn: d.techniqueEn,
        risk: d.risk, riskEn: d.riskEn, keywords: d.kw,
      })),
    };
  });
  const deviceTotal = engines.reduce((s, e) => s + e.deviceCount, 0);
  const beatKinds: Record<string, number> = Object.fromEntries(Object.entries(BEAT_LIBRARY).map(([k, v]) => [k, (v as unknown[]).length]));
  return {
    name: '终南集·AGI编剧大师·内置创作技能包',
    appVersion, packSchema: 1, builtAt: new Date().toISOString(),
    summary: { engines: engines.length, devices: deviceTotal, hooks: ALL_HOOKS.length, beatKinds, genres: GENRE_COMPENSATION.length },
    engines,
    hooks: ALL_HOOKS.map((h) => ({ id: h.id, layer: h.layer, name: h.name, definition: h.definition, technique: h.technique, example: h.example })),
    hookStrategies: HOOK_STRATEGIES.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn, tagline: s.tagline, taglineEn: s.taglineEn, fit: s.fit, fitEn: s.fitEn, strength: s.strength, microFlavors: s.microFlavors })),
    paceStrategies: PACE_STRATEGIES.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn, tagline: s.tagline, taglineEn: s.taglineEn, fit: s.fit, fitEn: s.fitEn, directive: s.directiveZh, directiveEn: s.directiveEn })),
    dialogueStrategies: DIALOGUE_STRATEGIES.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn, tagline: s.tagline, taglineEn: s.taglineEn, fit: s.fit, fitEn: s.fitEn, colloquial: s.colloquial, directive: s.directiveZh, directiveEn: s.directiveEn })),
    emotionStrategies: EMOTION_STRATEGIES.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn, tagline: s.tagline, taglineEn: s.taglineEn, fit: s.fit, fitEn: s.fitEn, directive: s.directiveZh, directiveEn: s.directiveEn })),
    characterStrategies: CHARACTER_STRATEGIES.map((s) => ({ id: s.id, name: s.name, nameEn: s.nameEn, tagline: s.tagline, taglineEn: s.taglineEn, fit: s.fit, fitEn: s.fitEn, lead: s.lead, leadEn: s.leadEn, relation: s.relation, relationEn: s.relationEn, directive: s.directiveZh, directiveEn: s.directiveEn })),
    beats: Object.entries(BEAT_LIBRARY).map(([kind, arr]) => ({ kind, count: (arr as { id: string; name: string }[]).length, items: (arr as { id: string; name: string }[]).map((b) => ({ id: b.id, name: b.name })) })),
    genres: GENRE_COMPENSATION.map((g) => ({ id: g.id, name: g.name, realityPain: g.realityPain, compensation: g.compensation, shortDramaFit: g.shortDramaFit, avoid: g.avoid })),
    styles: {
      themes: Object.fromEntries(Object.entries(THEME).map(([k, v]) => [k, { label: v.label, colloquial: v.colloquial, maxSentence: v.maxSentence, blank: v.blank }])),
      audiences: Object.fromEntries(Object.entries(AUDIENCE).map(([k, v]) => [k, v.note])),
      regions: Object.fromEntries(Object.entries(REGION).map(([k, v]) => [k, v.note])),
    },
    scriptFormats: {
      LIVE: { cjkRange: WORD_RANGE.LIVE, layout: ['集数+标题', '场景信息（时间/地点/内景或外景）', '△可拍摄动作提示', '角色名（情绪/动作）：台词'], note: '给导演现场调度与演员表演留发挥空间，不写景别运镜术语' },
      AIGC: { cjkRange: WORD_RANGE.AIGC, layout: ['集数+标题', '短场标（内景/外景+地点+时间，单行≤24字）', '流畅自然段承载环境/光影/动作/微情绪/内心（不加△、不堆【】标签）', '自然括号语义：（内心：…）（OS：…）（音效：…）（配乐：…）', '角色名（情绪/动作）：台词', '约30秒一个微叙事单元；机器层自动按集/场拆成分镜'], note: 'Z-AIGC流畅制作本：人读顺畅不跳戏，同时可被语言/图片/视频/音频模型与libtv类工作流确定性拆分；按成片时长精算容量（1200-1500字/分钟，两分钟2400-3000字），台词+OS+内心独白仅占18%-28%（语速4-5字/秒硬约束），其余为画面叙述；禁止提示词手册化与关键词堆砌' },
    },
    hardLines: HARD_LINES,
  };
}

/** 序列化为可下载/可导入的 JSON 字符串（其他窗口直接 JSON.parse 即可调用全部方法知识） */
export function serializeBuiltinSkillPack(appVersion = 'dev'): string {
  return JSON.stringify(buildBuiltinSkillPack(appVersion), null, 2);
}

/** 健康自检：每个注册引擎都必须有装置、装置字段完整，防止“注册了但没装技能” */
export function auditSkillPack(pack = buildBuiltinSkillPack()): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const e of pack.engines) {
    if (!e.deviceCount) problems.push(`引擎 ${e.id}(${e.name}) 无装置`);
    e.devices.forEach((d) => {
      (['name', 'nameEn', 'principle', 'principleEn', 'technique', 'techniqueEn', 'risk', 'riskEn'] as const).forEach((k) => {
        if (!String(d[k] ?? '').trim()) problems.push(`${e.id}.${d.id} 缺字段 ${k}`);
      });
    });
  }
  if (!pack.hooks.length) problems.push('钩子库为空');
  if (pack.hookStrategies.length !== 5) problems.push('钩子策略应为5套');
  if (pack.paceStrategies.length !== 5) problems.push('节奏策略应为5套');
  if (pack.dialogueStrategies.length !== 5) problems.push('台词策略应为5套');
  if (pack.emotionStrategies.length !== 5) problems.push('情绪策略应为5套');
  if (pack.characterStrategies.length !== 5) problems.push('人物策略应为5套');
  if (!pack.hardLines.length) problems.push('硬底线为空');
  return { ok: problems.length === 0, problems };
}

/* ============================ 标准 SKILL.md 封装（v2.19） ============================ */

export const SKILL_NAME = 'zhongnan-shortdrama-craft';

function devicesReferenceMd(pack: BuiltinSkillPack): string {
  const out: string[] = [`# 类型机制装置库（${pack.engines.length} 套引擎 · ${pack.summary.devices} 装置）`, '', '> 用法：先判定题材命中哪些引擎，再从命中引擎里选装置组合；每个装置含“机理（为什么有效）→技法（怎么写）→风险（不能犯）”。', ''];
  for (const e of pack.engines) {
    out.push(`## ${e.name}（${e.id}，${e.deviceCount} 装置）`, '');
    for (const d of e.devices) {
      out.push(`### ${d.name} / ${d.nameEn}（${d.id}）`);
      out.push(`- 机理：${d.principle}`);
      out.push(`- 技法：${d.technique}`);
      out.push(`- 风险：${d.risk}`);
      out.push(`- 识别词：${d.keywords.join('、')}`, '');
    }
  }
  return out.join('\n');
}

function hooksReferenceMd(pack: BuiltinSkillPack): string {
  const layerName: Record<string, string> = { open: '开篇钩（黄金三秒）', episode: '集尾钩（追更钩）', scene: '场钩（目标阻断/信息抛出/转场疑问）', micro: '微钩（句段级·动作/语言/氛围/情绪/信息差/伏笔六风味）' };
  const out: string[] = ['# 钩子库（29 个装置 · 四层结构 · 微钩六风味）', '', '> 结构钩子共四层：开篇钩(open)/集尾钩(episode)/场钩(scene)/微钩(micro)，29 个装置即按此四组存放。动作钩、氛围钩、语言钩不是独立层，而是微钩(micro)层内的装置，对用户归并为动作/语言/氛围/情绪/信息差/伏笔六种风味；场钩仅含目标阻断、信息抛出、转场疑问三个装置。钩子不是僵硬公式：默认系统按节奏曲线布点，用户可指定层级与偏好。', '', '## 钩子策略（用户选项 vs 系统默认，v2.27）', '', '> 用户不选时，系统按题材/标签/模式确定性匹配下表策略并说明原因；用户自选则尊重；用户逐点精细指定时精细项优先。', ''];
  pack.hookStrategies.forEach((s) => {
    out.push(`- **${s.name} / ${s.nameEn}（${s.id}，强度 ${s.strength}）**：${s.tagline}；适用：${s.fit}；偏好微钩风味：${s.microFlavors.join('/') || '均衡'}`);
  });
  out.push('', '## 逐点钩子调色板（v2.56，系统默认+用户可选）', '',
    '> 结构性钩子位逐点可见：每个「开场钩/场末牵引/集尾卡点」位置系统都给出 1 个默认+2 个备选及双语理由，打分=策略偏好+题材标签命中+防疲劳冷却轮换+确定性破序；用户点选即接管该位（hybrid：用户优先、其余系统补），未改位置系统自动补。',
    '> 位置键分层命名空间（manual）：开场=集0基序号；场末=1000+集序号×100+场序号；集尾=20000+集序号；微钩=40000+全局序号，杜绝跨层撞号。句子级微钩不逐点指定，走动作/语言/氛围/情绪/信息差/伏笔六风味软加权（约70%落偏好、其余轮换）。',
    '> 钩子使用永远不是僵硬公式：同型钩子遵守 cooldown 轮换，开场/集尾不得连续同型；策略、标签、用户点选冲突时，用户显式点选 > 用户偏好池 > 策略推荐 > 系统轮换。', '');
  out.push('', '## 逐集钩子地图与导出（v2.61）', '',
    '> 交付文件（docx/pdf/txt）在情绪导演页之后固定装配「逐集钩子地图（钩子编排页）」：逐集列出开场钩→集尾卡点、场末牵引处数、微钩处数与六风味（动作/语言/氛围/情绪/信息差/伏笔）计数；与管线同种子同源、确定性可复现（第 e 集 0 基种子 0x9e3779b1^(e*2654435761)，每集场景数缺省取标准张弛流区间中位 4）；超 24 集只列前 10 后 4 并注明，完整排布在创作端。', '');
  out.push('', '## 节奏曲线策略（v2.28，用户选项 vs 系统默认）', '');
  pack.paceStrategies.forEach((s) => out.push(`- **${s.name} / ${s.nameEn}（${s.id}）**：${s.tagline}；适用：${s.fit}；执行：${s.directive}`));
  out.push('', '## 台词风格策略（v2.28，用户选项 vs 系统默认）', '');
  pack.dialogueStrategies.forEach((s) => out.push(`- **${s.name} / ${s.nameEn}（${s.id}，口语档 ${s.colloquial}）**：${s.tagline}；适用：${s.fit}；执行：${s.directive}`));
  out.push('', '## 情绪/爽点曲线策略（v2.29，用户选项 vs 系统默认）', '');
  pack.emotionStrategies.forEach((s) => out.push(`- **${s.name} / ${s.nameEn}（${s.id}）**：${s.tagline}；适用：${s.fit}；执行：${s.directive}`));
  out.push('', '## 人物与关系策略（v2.37 第五套策略层，用户选项 vs 系统默认）', '');
  pack.characterStrategies.forEach((s) => out.push(`- **${s.name} / ${s.nameEn}（${s.id}）**：${s.tagline}；适用：${s.fit}；主角：${s.lead}；关系网：${s.relation}；执行：${s.directive}`));
  out.push('');
  for (const layer of ['open', 'episode', 'scene', 'micro'] as const) {
    out.push(`## ${layerName[layer]}`, '');
    pack.hooks.filter((h) => h.layer === layer).forEach((h) => {
      out.push(`### ${h.name}（${h.id}）`);
      out.push(`- 定义：${h.definition}`);
      out.push(`- 技法：${h.technique}`);
      out.push(`- 示例：${h.example}`, '');
    });
  }
  return out.join('\n');
}

function beatsReferenceMd(pack: BuiltinSkillPack): string {
  const kindName: Record<string, string> = { reversal: '反转节拍', payoff: '爽点兑付节拍', emotion: '情绪节拍' };
  const out: string[] = ['# 节拍库（反转 8 · 爽点兑付 10 · 情绪 8）', '', '> 每集必须形成“钩子-冲突-转折-留白”节奏弧；反转/爽点需要前置铺垫，情绪节拍负责呼吸感，禁止全程高密度无留白。', '',
    '## 逐集节拍调色板（v2.57，系统默认+用户可选）', '',
    '> 每个「主反转 / 爽点①② / 情绪起·承·合」节拍位，系统都给出 1 个★默认+2 个备选及双语理由；★默认与真实生成落位严格一致（逐集换种子重排全剧、取本集，与管线同算法），展示即生成。打分=用户偏好池+题材标签命中+风味轴+防疲劳冷却轮换+确定性破序。',
    '> 位置键分层命名空间（manual）：主反转=10000+集0基序号；爽点=20000+集序号×10+集内序；情绪=30000+集序号×3+拍序（起0/承1/合2），三类永不撞号。用户点备选即接管该位（hybrid：用户优先、其余系统补），点回★即撤销；情绪三拍恒守“有压必放”硬规则，钩子对齐只在缺反转时补位、从不覆盖用户点选。',
    '> 密度档：relax 反转每3集、爽点0-1；balanced 反转约2/3集、爽点1-2；tight 每集反转、爽点2-3；情绪恒3拍。冲突优先级：用户显式点选 > 用户偏好池/风味 > 题材标签 > 系统轮换。', '',
    '## 全剧情绪波形事前编排（v2.58，生成前预览·区间框选连改）', '',
    '> 动笔前即可确定性预览全剧张力曲线（逐集同种子重排，与真实管线同源，展示即生成），并可框选连续集区间，按五种波形意图一键连改该区间每集的情绪三拍：蓄力加压（憋屈→揪心→释放）、高燃拉升（悬念→爆发→高燃）、破防催泪（压抑→泪点→释放）、揪心连拽（悬念→憋屈→爆发）、温情治愈（温情→释放→治愈）。',
    '> 区间连改只写 30000 段情绪键（30000+集序号×3+拍序），绝不触碰反转/爽点；每个意图模板都守三拍互异、有压必放（起/承含压抑类时合必为释放类）。v2.58 起：用户定点某一集不会涟漪改变其他集——选择器无论是否被点选都消耗相同随机数，情绪兜底抽取也恒定执行；释放分支的合拍同样尊重合法点选（但只接受本身即释放类的点选，硬规则不放松）。',
    '## 爽点-反转兑现链时间线与导出（v2.62）', '',
    '> 交付文件（docx/pdf/txt）在逐集钩子地图之后固定装配「爽点-反转兑现链（节拍时间线）」：逐集列主反转、爽点节拍、情绪三拍弧与当集埋伏笔数；总览给反转/爽点总数与五风味分布；末尾兑现体检自动给出反转/爽点最大空窗、有压必放达成率、末集是否仍埋伏笔（无后续可回收即告警前移）。',
    '> 同源保真：第 e 集（0 基）依次用种子 0x9e3779b1^(e*2654435761) 排钩子、0x5bd1e995^(e*40503) 排节拍、0x1b873593^(e*2246822519) 做钩子×节拍对齐，逐集重排全剧取本集，与真实管线完全一致、确定性可复现；缺省每集 4 场；超 24 集前 10 后 4 截断。', ''];
  pack.beats.forEach((g) => {
    out.push(`## ${kindName[g.kind] ?? g.kind}（${g.count}）`, '');
    g.items.forEach((b) => out.push(`- ${b.name}（${b.id}）`));
    out.push('');
  });
  return out.join('\n');
}

function formatsReferenceMd(pack: BuiltinSkillPack): string {
  const L = pack.scriptFormats.LIVE, A = pack.scriptFormats.AIGC;
  return [
    '# 双制式刚性格式标准',
    '',
    '## 真人实拍剧本（LIVE）',
    `- 单集汉字数：${L.cjkRange[0]}-${L.cjkRange[1]}，给导演现场调度与演员表演留发挥空间`,
    `- 版式顺序：${L.layout.join(' → ')}`,
    `- 约束：${L.note}；禁止景别/运镜术语，禁止提示词式说明`,
    '',
    '## AIGC 制作剧本（AIGC）',
    `- 单集汉字数：${A.cjkRange[0]}-${A.cjkRange[1]}，约 30 秒一个微叙事单元`,
    `- 版式顺序：${A.layout.join(' → ')}`,
    `- 约束：${A.note}；视听细节只写在动作行，本质仍是剧本，不是关键词堆砌`,
    '',
    '## 创作硬底线（任何模式不可突破）',
    ...pack.hardLines.map((x) => `- ${x}`),
    '',
    '## 交付文件结构（docx/pdf/txt 导出刚性装配顺序）',
    '- 固定顺序：封面 → 故事大纲 → 人物小传 → 分集目录 → 全剧情绪节奏图（导演页）→ 逐集钩子地图（钩子编排页）→ 爽点-反转兑现链（节拍时间线）→ 人物表与成长弧（一页纸）→ 完整分集正文 →（AIGC 制式 ADVANCED+ 才有的机器分镜附录）',
    '- 导演页：与创作管线同源、确定性可复现的全剧情绪波形；纵轴张力 0-100，红点≥80 高能峰值、琥珀 60-79 推进段、蓝点<60 呼吸留白段；docx 内嵌 PNG、pdf 矢量绘制、txt 用火花线 ▁▂▃▄▅▆▇█ 加逐集张力行；波形取项目 beatPrefs 经统一归一化后现算，钩子/节拍/波形调色板的定点修改必须在导出页同步体现',
    '- 导演页必须逐集标注主导情绪拍（压抑/悬念/爆发/释放/泪点/高燃/暖意/治愈，英文 Supp/Susp/Burst/Rel/Tear/Hype/Warm/Heal），并给两行节奏体检：①推进/高能(≥60)与呼吸留白(<60)占比、开篇与收尾张力；②峰值位置百分比、最长齐平段（相邻差≤6）长度与对应压放交替建议；占比之和必须为 100',
    '- 页脚必须带「第 X 页 共 Y 页」；未达去水印等级带「平台·笔名」水印；目录、大纲、人物小传缺一不可',
    '',
  ].join('\n');
}

/** 生成标准 SKILL.md（YAML frontmatter + 可执行正文） */
export function buildSkillMarkdown(pack = buildBuiltinSkillPack()): string {
  const fm = [
    '---',
    `name: ${SKILL_NAME}`,
    'description: 竖屏短剧人类级剧本创作技能。当需要创作/改写/诊断竖屏短剧、微短剧、AIGC制作剧本、真人实拍剧本，或涉及分集大纲、钩子、反转、爽点、人设反差、节奏曲线、去AI味、12种创作模式（采访式/标签/小说改编/互动分支/名场面/热点追更/爆款逆向/短视频脚本/软广脑洞/X剧本/长系列IP/电影灰度）时使用。内置' + `${pack.engines.length}` + '套类型引擎' + `${pack.summary.devices}` + '装置、四层钩子体系、26节拍、双制式格式、统一创作规范、进化与反自我封闭协议与创作硬底线。',
    'metadata:',
    `  version: ${pack.appVersion}`,
    '---',
  ].join('\n');
  const engineLines = pack.engines.map((e) => `| ${e.id} | ${e.name} | ${e.deviceCount} |`).join('\n');
  const body = `
# 终南剧本创作技能（人类级·去AI味·双制式）

本技能是「终南集 · 人工通用智能（AGI）编剧大师」的创作内核封装。目标：写出无法被识别为 AI、符合市场规律、可直接拍摄或进入 AIGC 制作的竖屏短剧剧本。

## 何时使用
- 用户要写/改/续写/拆解竖屏短剧、微短剧剧本或分集大纲
- 用户要把小说/热点/名场面/爆款改成短剧，或要互动分支、软广脑洞、短视频脚本
- 用户要给剧本做去 AI 味、节奏、钩子、人设、台词口语化诊断
- 用户要区分真人实拍本与 AIGC 制作本的写法

## 创作总流程（统一规范，禁止一键终稿；详见 references/05-unified-spec.md）
${CREATION_STAGES.map((s, i) => `${i + 1}. **${s.name}**：${s.output}`).join('\n')}
- 六维质量评分：${SCORE_DIMENSIONS.map((d) => d.name).join('、')}（逐集/全本可评，优化保留版本可对比）。
- 四层钩子：${HOOK_TAXONOMY.map((h) => h.name).join('、')}；默认系统按节奏曲线布点，用户可指定层级，禁止僵硬套模板。

## 类型引擎选择（详见 references/01-devices.md）
命中多个引擎时装置叠加使用；识别不出时用通用三件套（强钩子开局、清晰欲望链、集尾反转）兜底。
| id | 引擎 | 装置数 |
|---|---|---|
${engineLines}

## 钩子与节拍（详见 references/02-hooks.md、03-beats.md）
- 四层钩子：开篇黄金三秒钩、集尾追更钩、场钩（目标阻断/信息抛出/转场疑问）、句段微钩（动作/语言/氛围/情绪/信息差/伏笔六风味）；默认系统布点，也可由用户指定层级。
- 三类节拍：反转（须前置伏笔，拒绝机械降神）、爽点兑付（压抑-兑现节奏，不无脑爽）、情绪（留白与呼吸感）。

## 进化与反自我封闭（详见 references/06-evolution.md，强制执行）
- **可复用**：本技能为纯方法资产，跨窗口加载即用；**可进化**：后台学习窗口/在榜爆款/平台规则/用户反馈持续注入；**可迭代**：新知识先过合规一致性与标准用例 A/B 验证，提升才全量、否则回滚。
- **反封闭铁律**：禁止只在既有生成内容里自我复制，每次创作必须显式经过外部校准（市场热度/平台规则/用户画像至少一项），无外部信号时标注“缺市场校准”；方法可复用、事实要新鲜；低效装置定期下线，防止风格固化。
- 同一需求多版本必须强制差异化（人设/走向/核心冲突不同），杜绝换汤不换药。
- **自我成长与维护（增/减/优化/优胜劣汰/自我批判，流程见 06 第六节）**：新增方法须四段齐全+查重+补测试；优化须标准用例 A/B 证实有效；低效/相悖条目观察期后下线；每轮主动找反例、查逻辑相悖与旧断言、不臆造事实，做不到就如实标缺口。

## 双制式与硬底线（详见 references/04-formats.md，必须严格执行）
- 真人实拍 800-1000 字、△可拍摄动作、给导演留空间；AIGC 1200-1500 字、视听信息只写动作行、约30秒一微单元。
- 两种制式都必须是标准剧本，**严禁输出提示词手册、模型参数、关键词堆砌**。

## 输出与自检清单（交付前逐条核对）
- [ ] 人设前后一致、配角也有独立行为逻辑，无人设崩塌
- [ ] 每个反转/打脸/以弱胜强都有前置铺垫
- [ ] 台词符合人物年龄身份地域，无书面腔、无说教、无 AI 工整对仗
- [ ] 钩子分层布点、集尾有追更钩、全程有张弛留白
- [ ] 制式字数与版式达标（LIVE 800-1000 / AIGC 1200-1500），无提示词污染
- [ ] 未触碰硬底线（露骨淫秽与未成年人性化全法域硬禁；成熟向走分级与问卷，不豁免硬禁）

## 参考资产（随版本自动同步，机器可读副本见 references/craft-pack.json）
- references/01-devices.md：${pack.summary.devices} 个创作装置（机理/技法/风险/识别词）
- references/02-hooks.md：四层钩子（开篇/集尾/场钩/微钩；微钩含动作/语言/氛围/情绪/信息差/伏笔六风味）
- references/03-beats.md：26 节拍
- references/04-formats.md：双制式格式与硬底线
- references/05-unified-spec.md：统一创作规范（四阶段/六维评分/四层钩子/语言与个性化）
- references/06-evolution.md：技能进化与反自我封闭协议
- references/07-aigc-exemplar.md：AIGC 制式达标黄金样例（过格式闸门，照此版式写）
`;
  return `${fm}\n${body}`;
}

/** 标准技能包文件映射（相对路径 → 文本），可直接落盘为 Skill 目录或打包 zip */
export function buildSkillBundle(pack = buildBuiltinSkillPack()): Record<string, string> {
  const exemplar = buildSampleScript('AIGC');
  return {
    'SKILL.md': buildSkillMarkdown(pack),
    'references/01-devices.md': devicesReferenceMd(pack),
    'references/02-hooks.md': hooksReferenceMd(pack),
    'references/03-beats.md': beatsReferenceMd(pack),
    'references/04-formats.md': formatsReferenceMd(pack),
    'references/05-unified-spec.md': unifiedSpecSummary(),
    'references/06-evolution.md': evolutionProtocolMd(),
    'references/07-aigc-exemplar.md': `# AIGC 制式达标黄金样例（自动取自工具离线样例，随制式规范同步）\n\n> 用途：对照版式——景别/运镜/光影只写动作行、约30秒一微单元、集尾留钩、本质是剧本不是提示词。\n\n${exemplar}`,
    'references/craft-pack.json': JSON.stringify(pack, null, 2),
  };
}
