/**
 * 创作上下文聚合器：把【时令/爆款/画像个性化 + 地域文化 + 平台官方方法论】统一打包，
 * 一份注入创作流水线（架构/人设/撰写岗 prompt 的“创作取向”），一份给小南做透明播报。
 *
 * 关键边界：这些都是“取向与底线”，不是硬标签；严禁把“钩子/爽点/标签/方法论”等术语写进剧本正文。
 * 纯函数、零 IO、可离线对拍；任何输入缺失都安全降级，绝不阻断创作。
 */
import { composePersonalization, type BoardItem, type UserProfile, type BoardRegion } from './context-personalization';
import { regionalBrief, matchRegion } from '../config/regional-culture';
import { crossCultureBrief } from '../config/platform-playbook';
import { historyWhatIfBrief, type WhatIfVariable } from './history-whatif';
import { aigcProductionBrief } from './aigc-beat';

/** 命中即视为“历史脑洞 What-if”题材（标签 + 关键词双通道，避免漏触发） */
const HISTORY_WHATIF_TAGS = new Set(['历史脑洞', '历史WhatIf', '历史事件反转', '历史人物现代错位', '平行历史', '离谱历史演绎', '假如历史跑偏', '古人空降现代', '历史小人物逆袭', '历史错位']);
const HISTORY_WHATIF_RE = /(历史脑洞|what-?if|另一种可能|平行历史|假如历史|历史错位|古人.*现代)/i;
export function isHistoryWhatIf(tags: string[] = [], tagBrief = ''): boolean {
  return tags.some((t) => HISTORY_WHATIF_TAGS.has(t)) || HISTORY_WHATIF_RE.test(`${tags.join(' ')} ${tagBrief}`);
}

export interface CreationContextInput {
  date?: Date;
  board?: BoardItem[];
  profile?: UserProfile;
  personalized?: boolean;
  boardRegion?: BoardRegion | 'all';
  tagBrief?: string;
  /** 当故事是“某地域人物进入异质环境”时给出，触发跨文化三要素 */
  crossCulture?: { from?: string; to?: string };
  /** 结构化标签（用于识别历史脑洞等专项题材） */
  tags?: string[];
  /** 历史脑洞锚点（真实人物/事件/常识）与变量类型，命中题材时自动启用 */
  historyAnchor?: string;
  historyVariable?: WhatIfVariable;
  outputLang?: string;
  /** 制作形式：AIGC 时注入 30 秒微节拍与制作规范；默认 LIVE 不注入 */
  scriptMode?: 'LIVE' | 'AIGC';
}
export interface CreationContext {
  /** 注入架构/人设/撰写岗的取向指令块 */
  contextBrief: string;
  /** 创作开始前小南对用户的透明播报（共创感） */
  xiaonanLines: string[];
  /** 结构化推荐方向（前端可展示成“本次为你优先考虑”） */
  directions: { tag: string; source: string; weight: number }[];
  regional?: string;
}

export function buildCreationContext(inp: CreationContextInput = {}): CreationContext {
  const compose = composePersonalization({
    date: inp.date, board: inp.board, profile: inp.profile,
    personalized: inp.personalized, boardRegion: inp.boardRegion,
  });
  const regionText = inp.profile?.region ? regionalBrief(matchRegion([inp.profile.region, inp.profile.bio ?? ''].join(' '))?.name ?? inp.profile.region) : '';
  const cross = inp.crossCulture ? crossCultureBrief(inp.crossCulture.from, inp.crossCulture.to) : '';
  const useWhatIf = isHistoryWhatIf(inp.tags ?? [], inp.tagBrief ?? '');
  const history = useWhatIf
    ? historyWhatIfBrief({ anchor: inp.historyAnchor ?? (inp.tagBrief ?? ''), variable: inp.historyVariable })
    : '';
  const aigc = inp.scriptMode === 'AIGC' ? aigcProductionBrief() : '';
  const dirLines = compose.directions.slice(0, 6).map((d) => `·${d.tag}（${sourceLabel(d.source)}）`);

  const brief: string[] = [];
  brief.push('【本次创作上下文·仅供取向参考，不是硬设定；术语不得写进正文】');
  if (inp.tagBrief) brief.push(inp.tagBrief);
  if (dirLines.length) brief.push(`优先贴近的方向（自然融入，不堆砌）：\n${dirLines.join('\n')}`);
  if (regionText) brief.push(`地域文化贴合（人物语言/生活细节/关系分寸要地道，方言点到为止全国可懂，严禁地域黑与四不像）：\n${regionText}`);
  if (cross) brief.push(cross);
  if (history) brief.push(history);
  if (aigc) brief.push(aigc);
  brief.push([
    '三条创作底线（破亿短剧与官方方法论）：',
    '①活人感——角色有生计算计、真实私心、说人话、边做边说、有缺点、关系有分寸；',
    '②懂观众——想清为谁写、替观众兑现什么情绪、前3秒能代入、看下去有明确回报；',
    '③情绪要沉淀为情感——强情绪事件要改变人物关系或留下情感印记，不要爽完即忘。',
  ].join(''));
  const contextBrief = brief.filter(Boolean).join('\n');

  const xiaonanLines = [...compose.xiaonanLines];
  if (regionText) xiaonanLines.push('小南会把地道的地域细节揉进人物里，保证不出戏、不刻板～');
  if (history) xiaonanLines.push('小南认出这是历史脑洞题材啦：守住一个真实锚点、只开一个离谱变量，一本正经地推演，反差才最好玩～');
  if (aigc) xiaonanLines.push('这是AIGC制作本，小南按30秒一个微节拍帮你排好镜头节奏，口型、局部修改和视觉连贯都替你考虑到啦～');
  xiaonanLines.push('小南已经把时令氛围、平台热趋势和你的偏好悄悄融进大纲啦，你专心讲故事，剩下的交给我！');

  return {
    contextBrief,
    xiaonanLines,
    directions: compose.directions.map((d) => ({ tag: d.tag, source: d.source, weight: d.weight })),
    regional: regionText || undefined,
  };
}

function sourceLabel(s: string): string {
  return s === 'trending' ? '近期平台热趋势' : s === 'seasonal' ? '当下时令' : '贴合你的偏好';
}
