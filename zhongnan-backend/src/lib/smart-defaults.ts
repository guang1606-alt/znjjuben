/**
 * smart-defaults.ts — 立项前「智能默认」预览引擎（v2.70，纯确定性、零 LLM）
 * ------------------------------------------------------------------
 * 解决一个真实缺口：时令/榜单/画像个性化此前只在"生成中"通过 SSE 出现，用户在付费生成前
 * 看不到"系统到底替我默认了什么、为什么"。本引擎把同一份能力提前到立项前，且：
 *   1) 复用 composePersonalization（时令/真实榜单/画像三路融合）+ recommendStrategy（钩子策略），不重复造轮子；
 *   2) 双语：linesZh 直接用中文播报，linesEn 为确定性英文模板（标签名属标签库用户内容，不强行翻译）；
 *   3) 诚实：没有保鲜期内真实榜单时 boardActive=false，绝不伪造"昨日爆款"，并明确告诉用户默认依据；
 *   4) 全部是"系统默认（可改）"，不替用户做死决定。
 */
import {
  composePersonalization,
  type BoardItem, type UserProfile,
} from '../engine/context-personalization';
import { recommendStrategy, getHookStrategy, HOOK_STRATEGY_IDS } from '../engine/hook-strategy';

export type SmartLang = 'zh' | 'en';
export type DirectionSource = 'trending' | 'seasonal' | 'profile';

export interface SmartDirection {
  tag: string;
  source: DirectionSource;
  sourceZh: string;
  sourceEn: string;
  weight: number;
}
export interface SmartHookStrategy {
  id: string;
  name: string; nameEn: string;
  tagline: string; taglineEn: string;
  reason: string; reasonEn: string;
  auto: boolean;
  options: { id: string; name: string; nameEn: string }[];
}
export interface SmartDefaults {
  lang: SmartLang;
  personalized: boolean;
  boardActive: boolean;
  sourceCounts: Record<DirectionSource, number>;
  directions: SmartDirection[];
  linesZh: string[];
  linesEn: string[];
  hookStrategy: SmartHookStrategy;
}

const SOURCE_ZH: Record<DirectionSource, string> = {
  trending: '近期平台热趋势', seasonal: '当下时令', profile: '贴合你的偏好',
};
const SOURCE_EN: Record<DirectionSource, string> = {
  trending: 'recent platform trend', seasonal: 'current season/timing', profile: 'your preference',
};

export interface BuildSmartDefaultsInput {
  tags?: string[];
  mode?: string;
  scriptMode?: 'LIVE' | 'AIGC';
  date?: Date;
  board?: BoardItem[];
  profile?: UserProfile;
  personalized?: boolean;
  boardRegion?: 'domestic' | 'overseas' | 'all';
  lang?: SmartLang;
}

export function buildSmartDefaults(inp: BuildSmartDefaultsInput = {}): SmartDefaults {
  const lang: SmartLang = inp.lang === 'en' ? 'en' : 'zh';
  const board = inp.board ?? [];
  const compose = composePersonalization({
    date: inp.date, board, profile: inp.profile,
    personalized: inp.personalized, boardRegion: inp.boardRegion ?? 'all',
  });
  const sourceCounts: Record<DirectionSource, number> = { trending: 0, seasonal: 0, profile: 0 };
  const directions: SmartDirection[] = compose.directions.slice(0, 8).map((d) => {
    const src = (d.source as DirectionSource) ?? 'profile';
    if (src in sourceCounts) sourceCounts[src] += 1;
    return { tag: d.tag, source: src, sourceZh: SOURCE_ZH[src], sourceEn: SOURCE_EN[src], weight: d.weight };
  });

  // 钩子策略：系统默认 + 全部可选项（用户可改）
  const rec = recommendStrategy({ tags: inp.tags ?? [], mode: inp.mode });
  const hs = getHookStrategy(rec.id);
  // 英文理由里 recommendStrategy 会回显命中的中文题材词（标签库内容）；英文平台层统一净化为零中文
  const reasonEnSafe = rec.reasonEn.replace(/[一-鿿]+/g, 'the selected genre');
  const hookStrategy: SmartHookStrategy = {
    id: rec.id, auto: rec.auto,
    name: hs.name, nameEn: hs.nameEn, tagline: hs.tagline, taglineEn: hs.taglineEn,
    reason: rec.reason, reasonEn: reasonEnSafe,
    options: HOOK_STRATEGY_IDS.map((id) => { const s = getHookStrategy(id); return { id, name: s.name, nameEn: s.nameEn }; }),
  };

  const boardActive = sourceCounts.trending > 0;
  // 中文播报：直接复用 compose 的人话，并补一句系统默认说明
  const linesZh = [...compose.xiaonanLines];
  if (!boardActive) {
    linesZh.push('当前没有保鲜期内的真实榜单，系统默认按标签契合度、当下时令和你的创作偏好来选，不会编造爆款。');
  }
  linesZh.push(`钩子节奏系统默认采用「${hs.name}」，这些都能在生成前手动调整～`);

  // 英文播报：确定性模板，平台层零中文（标签名属标签库内容，不在 lines 内嵌入）
  const linesEn: string[] = [];
  if (sourceCounts.trending > 0) linesEn.push(`Xiao-nan noticed recent trending hits lifting ${sourceCounts.trending} direction(s) and prioritized them for you.`);
  if (sourceCounts.seasonal > 0) linesEn.push(`Seasonal timing is woven into ${sourceCounts.seasonal} default direction(s).`);
  if (sourceCounts.profile > 0) linesEn.push(`Tailored ${sourceCounts.profile} direction(s) to your region, history and editing taste.`);
  if (!boardActive) linesEn.push('No fresh real board right now: defaults use tag fit, current season and your profile — no fabricated trending.');
  linesEn.push(`Default hook pacing is “${hs.nameEn}”. Every default is adjustable before you generate.`);

  return {
    lang, personalized: inp.personalized !== false, boardActive,
    sourceCounts, directions, linesZh, linesEn, hookStrategy,
  };
}
