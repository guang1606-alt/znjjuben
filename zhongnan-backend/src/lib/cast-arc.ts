/**
 * 人物表与成长弧一页纸（v2.63）——导演交付包第四页。
 * 数据全部来自真实产物，绝不编造：
 *  1) 人物卡：project.bible.characters（人设设计师写入全局圣经的隐性设定/说话方式/弧光）；
 *  2) 出场与对手戏：逐集解析成稿正文「【人物】/[Characters]」场头与全文提及，统计出场集数、同场共现；
 *  3) 主角成长阶段线：复用 beat-chain 同源反转排布，累计反转推进五段成长阶段，确定性可复现。
 */
import { buildBeatChain } from './beat-chain';

export interface BibleChar { traits?: string; arc?: string; voice?: string; visualAnchor?: string }

export interface CastArcPage {
  characterCount: number;
  namedFromText: string[];
  cards: { name: string; traits: string; voice: string; arc: string; epCount: number; topPartner: string | null }[];
  growth: { ep: number; stage: number; onStage: string[]; reversal: string | null; reversalEn: string | null }[];
  pairs: { a: string; b: string; eps: number[] }[];
  fromBible: boolean;
}

const STAGE_ZH = ['受压起步', '蓄力蛰伏', '初次反击', '连环升级', '登顶收束'];
const STAGE_EN = ['Underdog start', 'Biding time', 'First counter', 'Escalation', 'Final resolution'];
const CIRcled = ['①', '②', '③', '④', '⑤'];

// v2.192 c192 Json 读取不信任铁律：bible.characters 是无 zod 的 LLM 裸 JSON，导出文档这一消费方
// 旧用 (c.traits || '').trim() 半截守卫——truthy 非字符串（123/[]/{}）照样 TypeError，
// 外层 try/catch 吞错后整页人物表从导出文档静默蒸发。入口统一形态归一+类型壳：
// 支持对象形态与数组形态（[{name,...}]，与资产沉淀入口三形态同口径）；
// 原始值/null/非对象一律视同无圣经；值字段非字符串视同缺失；畸形条目只影响自己，不连坐。
// 导出供导出清单（export.ts 海报人物表）同源复用，禁止两处各写一份归一（c190 同源铁律）。
export function normalizeBibleCharacters(input: unknown): Record<string, BibleChar> {
  const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
  const cleanEntry = (v: unknown): BibleChar | null => {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    return {
      traits: asString(o.traits),
      arc: asString(o.arc),
      voice: asString(o.voice),
      ...(asString(o.visualAnchor) ? { visualAnchor: asString(o.visualAnchor) } : {}),
    };
  };
  const out: Record<string, BibleChar> = {};
  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const name = typeof (item as Record<string, unknown>).name === 'string' ? (item as Record<string, any>).name.trim() : '';
      const c = cleanEntry(item);
      if (name && c) out[name] = c;
    }
  } else if (input && typeof input === 'object') {
    for (const [rawName, v] of Object.entries(input as Record<string, unknown>)) {
      const name = rawName.trim();
      const c = cleanEntry(v); // 原始值条目（{名字: 123}）→ null，丢弃但不影响成稿解析
      if (name && c) out[name] = c;
    }
  }
  return out;
}

// v2.193 c193 复盘：生成路由配角在场台账（v2.80）的名表提取旧码只认数组形态，而 pipeline
// 主路径回写的是对象形态（bible.characters[name] = {...}）→ 第 2 集起 castNameList 恒空、
// 在场台账与关系线保鲜台账双双静默失效（功能静默蒸发，无报错）。抽成纯函数统一三形态：
// 对象（键即名）/ 数组（name 字段，字符串元素直接当名）/ JSON 字符串（老库序列化，parse 失败视同无）；
// 长度窗 [2,12]（防单字误伤/整段设定误当人名）、去重、cap 20（控提示词预算），与路由旧注释口径一致。
export function extractBibleCastNames(input: unknown, opts: { minLen?: number; maxLen?: number; cap?: number } = {}): string[] {
  const minLen = opts.minLen ?? 2, maxLen = opts.maxLen ?? 12, cap = opts.cap ?? 20;
  let data: unknown = input;
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s) return [];
    try { data = JSON.parse(s); } catch { return []; } // 普通字符串不是 JSON，视同无圣经（不把拆字符当人名）
  }
  // 名表语义只认"被声明的名字"：对象形态键即名（值畸形不影响追踪）；数组形态字符串元素直接
  // 当名、对象元素取 name（与旧路由 typeof c === 'string' ? c : c?.name 口径一致，不回归）。
  const rawNames: string[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') rawNames.push(item);
      else if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).name === 'string') {
        rawNames.push((item as Record<string, string>).name);
      }
    }
  } else if (data && typeof data === 'object') {
    for (const k of Object.keys(data as Record<string, unknown>)) rawNames.push(k);
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const rawName of rawNames) {
    const name = rawName.trim();
    if (name.length < minLen || name.length > maxLen) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= cap) break;
  }
  return names;
}

// v2.194 c194 复盘（与 c193 同根的第二处死代码）：生成路由 prevArc 在 qcReport.arcTrack 缺失时
// 回退"从圣经重算弧光"，旧码 for (const c of b.characters) 直接迭代——对象形态
//（pipeline 主回写形态）抛 not iterable，外层 try/catch 吞错 → castNames 恒空 → 回退返回 null，
// 前集弧光对主形态项目静默不跟踪。抽纯函数统一三形态，语义=arcTracker 的 名→弧光种子：
// 对象（键即名，值畸形不影响名追踪，与 extractBibleCastNames 同口径）、数组（name 字段，
// 旧码 arc||role 回退保留）、JSON 字符串（parse 失败视同无）；非字符串字段视同缺失。
export function extractBibleCastArcs(input: unknown): Record<string, string> {
  let data: unknown = input;
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s) return {};
    try { data = JSON.parse(s); } catch { return {}; }
  }
  const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');
  const out: Record<string, string> = {};
  const put = (rawName: unknown, entry: unknown) => {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name || Object.prototype.hasOwnProperty.call(out, name)) return;
    const o = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null;
    out[name] = asStr(o?.arc) || asStr(o?.role) || '';
  };
  if (Array.isArray(data)) {
    for (const item of data) {
      // 旧码只收对象元素的 name（裸字符串元素 c?.name 为 undefined，本就忽略），不回归
      if (item && typeof item === 'object') put((item as Record<string, unknown>).name, item);
    }
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) put(k, v);
  }
  return out;
}

/** 从一集正文解析：场头人物列表集合、全文提及计数 */
function parseEpisode(text: string, names: string[]): { sceneCasts: string[][]; mentions: Record<string, number> } {
  const sceneCasts: string[][] = [];
  const re = /(?:【人物】|\[Characters?\])\s*([^\n\r]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const parts = m[1].split(/[、,，/／]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) sceneCasts.push(parts);
  }
  const mentions: Record<string, number> = {};
  names.forEach((name) => {
    if (!name) return;
    let count = 0; let idx = 0;
    while ((idx = text.indexOf(name, idx)) !== -1) { count++; idx += name.length; }
    mentions[name] = count;
  });
  return { sceneCasts, mentions };
}

export function buildCastArcPage(opts: {
  characters?: unknown; // project.bible.characters 裸 Json：形态/值类型均不可信，入口统一归一
  epTexts: string[];
  totalEps: number;
  beatPref?: unknown;
  hookPref?: unknown;
  scenesPerEp?: number;
}): CastArcPage {
  const epTexts = opts.epTexts.map((t) => t || '');
  const n = Math.max(1, opts.totalEps || epTexts.length || 1);
  const bibleChars = normalizeBibleCharacters(opts.characters);
  const fromBible = Object.keys(bibleChars).length > 0;

  // 第一轮粗扫：圣经人物 + 场头出现过的名字，构成候选名集合
  const nameSet = new Set<string>(Object.keys(bibleChars));
  const allSceneCasts: string[][][] = epTexts.map(() => []);
  epTexts.forEach((t, i) => {
    const { sceneCasts } = parseEpisode(t, []);
    allSceneCasts[i] = sceneCasts;
    sceneCasts.forEach((line) => line.forEach((x) => nameSet.add(x)));
  });
  // 过滤明显不是人名的碎片（场头里混入的场景词）；允许英文名内部单个空格（Lin Wan / Mr. Chen）
  let names = [...nameSet]
    .map((x) => x.trim())
    .filter((x) => x.length >= 1 && x.length <= 12 && !/[\n\r\t。！？!?：:]/.test(x) && !/\s{2,}/.test(x));
  // 全文提及统计
  const totalMentions: Record<string, number> = {};
  const epPresence: Record<string, Set<number>> = {};
  names.forEach((x) => { totalMentions[x] = 0; epPresence[x] = new Set(); });
  epTexts.forEach((t, i) => {
    const { mentions } = parseEpisode(t, names);
    Object.entries(mentions).forEach(([k, v]) => {
      totalMentions[k] += v;
      if (v > 0) epPresence[k].add(i + 1);
    });
  });
  // 至少在正文出现过（或圣经在册）；按提及量排序，正文零提及且不在圣经的剔除
  names = names.filter((x) => fromBible && x in bibleChars ? true : (totalMentions[x] ?? 0) > 0);
  names.sort((a, b) => (totalMentions[b] ?? 0) - (totalMentions[a] ?? 0));
  const topNames = names.slice(0, 10); // 一页纸最多 10 人，防膨胀

  // 同场共现矩阵（只统计 topNames）
  const pairEp: Record<string, Set<number>> = {};
  const SEP = '\u0001';
  const pairKey = (a: string, b: string) => `${a}${SEP}${b}`;
  allSceneCasts.forEach((scenes, i) => {
    scenes.forEach((line) => {
      const present = [...new Set(line)].filter((x) => topNames.includes(x));
      for (let a = 0; a < present.length; a++) {
        for (let b = a + 1; b < present.length; b++) {
          const [x, y] = [present[a], present[b]];
          const k = pairKey(x, y);
          if (!pairEp[k]) pairEp[k] = new Set();
          pairEp[k].add(i + 1);
        }
      }
    });
  });
  const pairs = Object.entries(pairEp)
    .map(([k, eps]) => ({ a: k.split(SEP)[0], b: k.split(SEP)[1], eps: [...eps].sort((x, y) => x - y) }))
    .filter((p) => p.a && p.b)
    .sort((a, b) => b.eps.length - a.eps.length)
    .slice(0, 6);
  const topPartnerOf = (name: string): string | null => {
    const mine = pairs.filter((p) => p.a === name || p.b === name).sort((a, b) => b.eps.length - a.eps.length)[0];
    return mine ? (mine.a === name ? mine.b : mine.a) : null;
  };

  // 人物卡（bibleChars 已经过形态归一+类型壳，字段恒为 string）
  const cards = topNames.map((name) => {
    const c = bibleChars[name] ?? {};
    return {
      name,
      traits: (c.traits ?? '').trim(),
      voice: (c.voice ?? '').trim(),
      arc: (c.arc ?? '').trim(),
      epCount: epPresence[name].size,
      topPartner: topPartnerOf(name),
    };
  });

  // 成长阶段线：同源反转累计推进五段
  const chain = buildBeatChain(n, opts.scenesPerEp ?? 4, opts.beatPref ?? null, opts.hookPref ?? null);
  let cum = 0;
  const growth = chain.episodes.map((e) => {
    if (e.reversalZh) cum++;
    const stage = Math.min(5, 1 + cum) - 1; // 0 基阶段索引
    const onStage = topNames.filter((x) => epPresence[x].has(e.ep)).slice(0, 5);
    return { ep: e.ep, stage, onStage, reversal: e.reversalZh, reversalEn: e.reversalEn };
  });

  return { characterCount: topNames.length, namedFromText: topNames, cards, growth, pairs, fromBible };
}

export function formatCastArcLines(page: CastArcPage, lang: 'zh' | 'en' = 'zh'): {
  head: string[]; cards: string[]; relations: string[]; growth: string[];
} {
  const head: string[] = [];
  const cards: string[] = [];
  const relations: string[] = [];
  const growth: string[] = [];
  if (lang === 'en') {
    head.push(`Cast & growth sheet: ${page.characterCount} named roles${page.fromBible ? ' (series bible)' : ' (parsed from drafts)'} · five-stage protagonist arc`);
    page.cards.forEach((c) => {
      const bits = [`Eps on screen: ${c.epCount}`];
      if (c.traits) bits.push(`hidden: ${c.traits}`);
      if (c.voice) bits.push(`voice: ${c.voice}`);
      if (c.arc) bits.push(`arc: ${c.arc}`);
      if (c.topPartner) bits.push(`most scenes with: ${c.topPartner}`);
      cards.push(`• ${c.name} — ${bits.join('; ')}`);
    });
    if (page.pairs.length) {
      relations.push('Scene-sharing axis (episodes together):');
      page.pairs.forEach((p) => relations.push(`- ${p.a} × ${p.b}: ${p.eps.length} ep(s) [${p.eps.join(',')}]`));
    }
    page.growth.forEach((g) => {
      growth.push(`E${g.ep} ${CIRcled[g.stage]}${STAGE_EN[g.stage]}${g.reversalEn ? ` (reversal: ${g.reversalEn})` : ''}｜cast: ${g.onStage.join('/') || '—'}`);
    });
  } else {
    head.push(`人物表与成长弧：共${page.characterCount}个有名角色${page.fromBible ? '（取自全局圣经）' : '（由成稿解析）'} · 主角五段成长曲线`);
    page.cards.forEach((c) => {
      const bits: string[] = [];
      if (c.traits) bits.push(`隐性设定：${c.traits}`);
      if (c.voice) bits.push(`说话方式：${c.voice}`);
      if (c.arc) bits.push(`成长弧光：${c.arc}`);
      bits.push(`出场${c.epCount}集${c.topPartner ? `、对手戏最多：${c.topPartner}` : ''}`);
      cards.push(`• ${c.name}｜${bits.join('｜')}`);
    });
    if (page.pairs.length) {
      relations.push('对手戏关系轴（同场集次）：');
      page.pairs.forEach((p) => relations.push(`- ${p.a} × ${p.b}：同场${p.eps.length}集（第${p.eps.join('、')}集）`));
    }
    page.growth.forEach((g) => {
      growth.push(`第${g.ep}集 ${CIRcled[g.stage]}${STAGE_ZH[g.stage]}${g.reversal ? `（反转：${g.reversal}）` : ''}｜出场：${g.onStage.join('/') || '无主要角色'}`);
    });
  }
  return { head, cards, relations, growth };
}
