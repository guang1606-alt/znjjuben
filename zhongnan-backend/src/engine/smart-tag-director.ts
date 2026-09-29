/**
 * 智能选片导演（Smart Tag Director）—— v1.68
 * ----------------------------------------------------------------
 * 把此前「各自建好却没被调用」的三块能力合流成一个统一入口，真正落地 PRD 反复点名的要求：
 *   1) 标签随机必须「懂市场 + 懂用户 + 懂时令」，且不造成选择困难、绝不产出未知/重复/互斥标签；
 *   2) 5 月写本自动向高考等时令节点倾斜、红果等平台昨日爆款方向优先，并由小南告知原因；
 *   3) 结合用户地域/年龄/性别/历史创作/与小南聊天，主动迎合且可关闭；
 *   4) 用户选英文（或海外平台）时，标签按海外市场重排、文化强绑定标签自动转译。
 *
 * 合流来源（全部复用、不重复造）：
 *   - config/tag-taxonomy      ：国内四级标签树 / smartRandomCombo / validateCombo / recommendNext / comboToBrief
 *   - engine/context-personalization：时令日历 + 国内外榜单 + 用户画像三路融合与小南文案
 *   - config/overseas-taxonomy ：海外标签 / 文化转译 / 按语言重排 / 海外智能随机
 *
 * 纯函数、零 IO、任何输入缺失都安全降级、绝不抛错；输出保证可直接用于立项与驱动架构岗。
 */
import {
  smartRandomCombo, validateCombo, recommendNext, comboToBrief, findTagByName,
  mutexConflict, type DimId, type ComboReport,
} from '../config/tag-taxonomy';
import {
  composePersonalization, inferDemographic, type BoardItem, type UserProfile, type BoardRegion, type Direction,
} from './context-personalization';
import {
  smartOverseasCombo, localizeCombo, overseasBrief,
  type Locale, type OverseasTag, type LocalizedItem, type CultureRemap,
} from '../config/overseas-taxonomy';

export interface DirectorInput {
  locale?: Locale;                         // 'zh'（默认）| 'en'
  seed?: string[];                         // 用户已锚定的标签（中文标签名）
  dims?: DimId[];                          // 指定抽取维度，默认=必备3维+推荐3维
  maxTags?: number;                        // 总数上限，默认 8（防选择困难），钳制 3..14
  personalized?: boolean;                  // 个性化开关，默认 true，可在设置关闭
  maxInjected?: number;                    // 时令/榜单/画像信号最多注入几个，默认 2（只做点睛不喧宾夺主）
  date?: Date;
  board?: BoardItem[];
  profile?: UserProfile;
  boardRegion?: BoardRegion | 'all';
  freq?: Record<string, number>;           // 全局使用频次 id->次数
  pref?: Record<string, number>;           // 用户个人偏好 id->次数
  rng?: () => number;
}
export interface InjectedTag { tag: string; source: Direction['source']; reason: string }
export interface EnglishResult {
  enNames: string[];
  items: LocalizedItem[];
  notes: string[];
  replaced: { from: string; to: CultureRemap }[];
}
export interface DirectorResult {
  locale: Locale;
  /** 面向创作流水线的规范标签名（中文体系；英文模式下为可回写国内维度的规范名） */
  names: string[];
  report: ComboReport;
  /** 本次因时令/爆款/画像而主动加入的标签及可解释原因（小南播报用） */
  injected: InjectedTag[];
  xiaonanLines: string[];
  brief: { title: string; lines: string[]; raw: string };
  english?: EnglishResult;
}

const DEFAULT_MAX = 8; const MIN_MAX = 3; const MAX_HARD = 14;
function clampMax(n?: number): number {
  if (!Number.isFinite(n as number)) return DEFAULT_MAX;
  return Math.min(MAX_HARD, Math.max(MIN_MAX, Math.round(n as number)));
}
function injectReason(src: Direction['source'], tag: string): string {
  if (src === 'trending') return `近期平台爆款正在带火「${tag}」，小南给你安排上，踩中风口更容易起量`;
  if (src === 'seasonal') return `当下时令观众正吃「${tag}」这一套，小南帮你顺势蹭上情绪节点`;
  return `「${tag}」贴合你的创作偏好，小南记得你擅长、也喜欢这个方向`;
}

/* ============================ 中文（国内市场） ============================ */
// 受众维度叶子按"性别频道 / 年龄段"分两组，画像对齐时只在同组内替换，绝不动 genre/protagonist/conflict 等必备维度
const AUD_GENDER = new Set(['现言女频', '古言女频', '女性成长向', '宝妈向', '职场女性向', '银发女性向', '玄幻男频', '都市男频', '军旅男频', '科幻男频']);
const AUD_AGE = new Set(['Z世代', '年轻白领25_35', '中年35_50', '银发50加']);
function alignAudienceToProfile(names: string[], profile: UserProfile, maxTags: number): string[] {
  try {
    const dm = inferDemographic(profile);
    const wants: { leaf: string; group: 'g' | 'a' }[] = [];
    if (dm.gender === '女') wants.push({ leaf: /宝妈|孕妈|妈妈/.test(profile.bio || '') ? '宝妈向' : '女性成长向', group: 'g' });
    else if (dm.gender === '男') wants.push({ leaf: '都市男频', group: 'g' });
    if (dm.age != null) wants.push({ leaf: dm.age <= 24 ? 'Z世代' : dm.age <= 35 ? '年轻白领25_35' : dm.age < 50 ? '中年35_50' : '银发50加', group: 'a' });
    if (!wants.length) return names;
    const REQUIRED_DIM = new Set<DimId>(['genre', 'protagonist', 'conflict']);
    const ALL_AUD = new Set([...AUD_GENDER, ...AUD_AGE]);
    for (const w of wants) {
      const t = findTagByName(w.leaf);
      if (!t || t.level !== 3 || names.includes(w.leaf)) continue;
      const groupSet = w.group === 'g' ? AUD_GENDER : AUD_AGE;
      const others = names.filter((n) => !groupSet.has(n));
      if (mutexConflict(w.leaf, others)) continue; // 与非同类标签互斥则不强塞
      for (let i = names.length - 1; i >= 0; i--) if (groupSet.has(names[i])) names.splice(i, 1); // 同组旧受众叶让位
      if (names.length >= maxTags) { // 仍满：移除一个非必备维度叶子腾位，绝不动 genre/protagonist/conflict
        for (let i = names.length - 1; i >= 0; i--) {
          const c = findTagByName(names[i]);
          if (c && !REQUIRED_DIM.has(c.dim) && !ALL_AUD.has(names[i])) { names.splice(i, 1); break; }
        }
      }
      if (names.length >= maxTags) continue; // 腾不出名额就不加，保证必备维度不被挤掉
      names.push(w.leaf);
    }
  } catch { /* 画像对齐失败不阻断主流程 */ }
  return names;
}
function directZh(inp: DirectorInput): DirectorResult {
  const maxTags = clampMax(inp.maxTags);
  const maxInjected = Math.max(0, Math.min(3, inp.maxInjected ?? 2));
  const rng = inp.rng ?? Math.random;
  const compose = composePersonalization({
    date: inp.date, board: inp.board, profile: inp.profile,
    personalized: inp.personalized, boardRegion: inp.boardRegion ?? 'domestic',
  });
  // 1) 用户锚定标签：必须真实存在，去重、去互斥（以用户先选的为准）
  const names: string[] = [];
  const pushSafe = (name: string): boolean => {
    const t = findTagByName(name);
    if (!t || t.level !== 3) return false;
    if (names.includes(t.name) || mutexConflict(t.name, names)) return false;
    names.push(t.name); return true;
  };
  (inp.seed ?? []).forEach(pushSafe);

  // 2) 先算出可注入的时令/爆款/画像信号（只认真实存在于标签树、且不互斥不重复的），为其预留名额
  const injected: InjectedTag[] = [];
  for (const d of compose.directions) {
    if (injected.length >= maxInjected) break;
    const t = findTagByName(d.tag);
    if (!t || t.level !== 3) continue;
    if (names.includes(t.name) || mutexConflict(t.name, names)) continue;
    injected.push({ tag: t.name, source: d.source, reason: injectReason(d.source, t.name) });
  }
  const injectNames = injected.map((x) => x.tag);

  // 3) 智能随机打底（懂市场热度+全局频次+个人偏好），为注入信号预留名额，先把盘子铺到 maxTags-注入数
  const targetBeforeInject = Math.max(MIN_MAX, maxTags - injected.length);
  const filler = smartRandomCombo({
    dims: inp.dims, seed: names, freq: inp.freq, pref: inp.pref,
    maxTags: Math.max(names.length + 1, targetBeforeInject), rng,
  });
  for (const f of filler) {
    if (names.length >= targetBeforeInject) break;
    if (injectNames.includes(f)) continue;
    pushSafe(f);
  }

  // 4) 必备维度兜底（genre/protagonist/conflict 缺了无法立项），用互补推荐补齐
  let guard = 0;
  while (guard++ < 12) {
    const rep = validateCombo(names);
    if (!rep.missingRequired.length || names.length >= maxTags) break;
    const miss = new Set(rep.missingRequired);
    const cand = recommendNext(names, 12).find((t) => miss.has(t.dim) && !injectNames.includes(t.name));
    if (!cand || !pushSafe(cand.name)) break;
  }

  // 5) 注入时令/爆款/画像标签（点睛，受总上限约束）
  injected.forEach((x) => { if (names.length < maxTags) pushSafe(x.tag); });
  // 注入未被容纳（名额满）时从 injected 中剔除，保证 injected ⊆ names
  for (let i = injected.length - 1; i >= 0; i--) if (!names.includes(injected[i].tag)) injected.splice(i, 1);

  // 6) 仍有名额则用高热度互补标签补足，保证组合丰满但不超过上限
  guard = 0;
  while (names.length < maxTags && guard++ < 16) {
    const cand = recommendNext(names, 6)[0];
    if (!cand || !pushSafe(cand.name)) break;
  }
  // 6.5) 受众维度向用户画像对齐（性别频道/年龄段），只在受众同组内替换，避免"95后女生却推银发向"的错位
  if (inp.personalized !== false && inp.profile) alignAudienceToProfile(names, inp.profile, maxTags);
  // 受众对齐可能腾挪掉注入标签，最终再做一次 injected ⊆ names 收敛（v2.62 修复时令标签被挤掉但记录残留）
  for (let i = injected.length - 1; i >= 0; i--) if (!names.includes(injected[i].tag)) injected.splice(i, 1);

  const report = validateCombo(names);
  const brief = comboToBrief(names);
  const xiaonanLines = [...compose.xiaonanLines];
  injected.forEach((x) => xiaonanLines.push(`小南选片：${x.reason}`));
  return { locale: 'zh', names, report, injected, xiaonanLines: dedupLines(xiaonanLines), brief };
}

/* ============================ 英文（海外市场） ============================ */
function directEn(inp: DirectorInput): DirectorResult {
  const maxTags = clampMax(inp.maxTags);
  const maxInjected = Math.max(0, Math.min(3, inp.maxInjected ?? 2));
  const rng = inp.rng ?? Math.random;
  // 海外：榜单只看海外区；时令以全球市场为主，不强行套中国节日（避免文化错位）
  const compose = composePersonalization({
    date: inp.date, board: inp.board, profile: inp.profile,
    personalized: inp.personalized, boardRegion: inp.boardRegion ?? 'overseas',
  });
  // 1) 海外智能随机：保证 核心题材/关系/主角 三槽位，再按海外热度补情绪/结构
  let os: OverseasTag[] = smartOverseasCombo({ n: maxTags, rng });
  const usedEn = new Set<string>();
  os = os.filter((t) => (usedEn.has(t.en) ? false : (usedEn.add(t.en), true)));

  // 2) 海外爆款/画像信号注入：方向词能对应到某个海外标签才注入（宁缺毋滥，保证海外观众看得懂）
  const injected: InjectedTag[] = [];
  const pool = smartOverseasCombo({ n: 40, rng }); // 更大候选池用于匹配信号
  const overseasIndex = [...os, ...pool];
  for (const d of compose.directions) {
    if (injected.length >= maxInjected) break;
    if (d.source === 'seasonal') continue; // 海外模式不套中国时令节点
    const hit = overseasIndex.find((t) =>
      !os.some((o) => o.en === t.en) &&
      (t.mapsToZh === d.tag || t.zh.includes(d.tag) || d.tag.includes(t.zh) || t.en.toLowerCase().includes(d.tag.toLowerCase())));
    if (!hit) continue;
    os.push(hit);
    injected.push({
      tag: hit.mapsToZh ?? hit.zh, source: d.source,
      reason: d.source === 'trending'
        ? `Overseas charts are pushing “${hit.en}” right now — added to ride the wave.`
        : `“${hit.en}” matches your creative profile.`,
    });
  }
  os = os.slice(0, maxTags);

  // 3) 面向流水线的规范名（可回写国内维度用 mapsToZh，否则用中文对照名）+ 英文展示名
  const names = os.map((t) => t.mapsToZh ?? t.zh);
  // 上限截断后保证 injected ⊆ names（v2.62 与中文路径同口径收敛）
  for (let i = injected.length - 1; i >= 0; i--) if (!names.includes(injected[i].tag)) injected.splice(i, 1);
  const enNames = os.map((t) => t.en);
  const loc = localizeCombo(names);
  const brief = overseasBrief(names);

  // 4) 组合自检：只对能回写国内标签树的部分跑 validateCombo，海外独有标签不算“未知”错误
  const resolvable = names.filter((n) => !!findTagByName(n));
  const base = validateCombo(resolvable);
  const slots = new Set(os.map((t) => t.slot));
  const slotOk = ['core', 'relation', 'protagonist'].every((s) => slots.has(s as OverseasTag['slot']));
  const report: ComboReport = {
    ...base,
    ok: slotOk && !base.errors.some((e) => e.includes('互斥')),
    errors: base.errors.filter((e) => !e.includes('未知标签')),
  };

  const xiaonanLines: string[] = [];
  compose.directions.filter((d) => d.source === 'trending').slice(0, 2)
    .forEach((d) => xiaonanLines.push(`Xiaonan noticed overseas charts trending “${d.tag}”, and tilted your combo accordingly.`));
  if (inp.personalized !== false && (inp.profile?.pastTags?.length || inp.profile?.editPreferredTags?.length))
    xiaonanLines.push('Xiaonan folded in your past creative preferences.');
  injected.forEach((x) => xiaonanLines.push(`Xiaonan picked: ${x.reason}`));
  if (!xiaonanLines.length) xiaonanLines.push('Xiaonan built an overseas-proven combo: core trope + relationship hook + lead, then emotion & structure.');

  return {
    locale: 'en', names, report, injected,
    xiaonanLines: dedupLines(xiaonanLines),
    brief: { title: brief.title, lines: brief.lines, raw: brief.raw },
    english: { enNames, items: loc.items, notes: brief.notes, replaced: loc.replaced },
  };
}

function dedupLines(lines: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const l of lines) { const k = l.trim(); if (k && !seen.has(k)) { seen.add(k); out.push(l); } }
  return out;
}

/** 统一入口：按 locale 路由到国内/海外选片导演，任何异常都安全降级，绝不阻断创作 */
export function directTags(input: DirectorInput = {}): DirectorResult {
  try {
    return input.locale === 'en' ? directEn(input) : directZh(input);
  } catch (err) {
    // 最后兜底：用最小可用组合，保证前端永远拿得到合法结果
    const fallback = smartRandomCombo({ rng: input.rng });
    return {
      locale: input.locale === 'en' ? 'en' : 'zh',
      names: fallback, report: validateCombo(fallback), injected: [],
      xiaonanLines: ['小南刚刚打了个小盹，先用一组稳妥标签顶上，你可以随时换一批～'],
      brief: comboToBrief(fallback),
    };
  }
}
