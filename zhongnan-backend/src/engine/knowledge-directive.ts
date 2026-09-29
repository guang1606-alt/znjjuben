/**
 * 知识库指令注入（把已生效的自主学习/人工审核知识注入创作管线各岗位提示词）
 * ------------------------------------------------------------------
 * 自主学习引擎采集并落库的知识（高分剧本技法/市场趋势/政策规则/人工录入经验），
 * 在生成剧本时按 brief 相关性筛选后，翻译成给架构师/撰写师的明确创作指引。
 *
 * 设计原则：
 *  - 纯函数、可离线对拍；IO 由 routes 层负责（fetch + 传入 knowledgeHints 字符串数组）；
 *  - 只注入"方法/规律/方向"，绝不抄具体表达（信号源已脱敏泛化，此处只做格式化拼接）；
 *  - 按相关性排序、条数封顶（避免提示词膨胀导致模型注意力分散）；
 *  - 合规类知识单独标注（创作时必须遵守，不是"可选参考"）。
 */
import { classifyCategory, LearnCategory } from './self-learning';

export interface KnowledgeHint {
  title: string;
  content: string;
  category: string;
}

const MAX_HINTS = 8;           // 单次注入最多条数（防止提示词膨胀）
const MAX_CHARS_PER_HINT = 300; // 单条截断（信号源本已泛化，此处双保险）
const MIN_RELEVANCE = 1;       // 关键词命中数下限

/** 按品类+关键词相关性给每条知识打分，排序后取 TopN */
export function rankByRelevance(hints: KnowledgeHint[], brief: string): KnowledgeHint[] {
  const briefLower = brief.toLowerCase();
  const tokens = briefLower
    .split(/[\s,，。、；;：:()（）【】"'！？!?.\-_/]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 40); // 取 brief 中前 40 个有效词做匹配
  const scored = hints.map((h) => {
    const text = `${h.title} ${h.content}`.toLowerCase();
    let hits = 0;
    for (const tk of tokens) {
      if (text.includes(tk)) hits++;
    }
    // 合规类知识加权（安全优先，必须被看到）
    if (h.category === 'compliance') hits += 10;
    return { hint: h, score: hits };
  });
  return scored
    .filter((s) => s.score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HINTS)
    .map((s) => s.hint);
}

/** 把知识条目格式化为给模型的指令串（中/英）；brief 可选，有则按相关性筛选排序 */
export function buildKnowledgeDirective(hints: KnowledgeHint[] | null | undefined, lang: 'zh' | 'en' = 'zh', brief?: string): string {
  if (!hints || hints.length === 0) return '';
  // 有 brief 时按相关性筛选排序；无 brief 时按原序截取（合规类优先排前）
  const ranked = brief && brief.trim()
    ? rankByRelevance(hints, brief)
    : hints.slice(0, MAX_HINTS);
  if (ranked.length === 0) return '';

  const en = lang === 'en';
  const header = en
    ? '[Knowledge-base directives — methods/patterns learned from high-score scripts, market trends, and policy rules. Follow the direction, never copy concrete expression.]'
    : '【知识库创作指引——来自高分剧本技法/市场趋势/政策规则的沉淀，只学规律方向、绝不照搬具体表达】';

  const lines = ranked.map((h) => {
    const cat = classifyCategory(`${h.title} ${h.content}`, h.category as LearnCategory);
    const catLabel = en ? catLabelEn(cat) : catLabelZh(cat);
    const body = h.content.slice(0, MAX_CHARS_PER_HINT);
    const isCompliance = cat === 'compliance' || h.category === 'compliance';
    const prefix = isCompliance
      ? (en ? '⚠ MUST-COMPLY: ' : '⚠ 必须遵守：')
      : '';
    return `${prefix}[${catLabel}] ${h.title}：${body}`;
  });

  return `${header}\n${lines.join('\n')}\n`;
}

function catLabelZh(cat: LearnCategory): string {
  const m: Record<LearnCategory, string> = {
    character: '人物', plot: '剧情', payoff: '爽点', reversal: '反转',
    scene: '场景', dialogue: '台词', av: '视听', compliance: '合规',
  };
  return m[cat] ?? cat;
}
function catLabelEn(cat: LearnCategory): string {
  const m: Record<LearnCategory, string> = {
    character: 'Character', plot: 'Plot', payoff: 'Payoff', reversal: 'Reversal',
    scene: 'Scene', dialogue: 'Dialogue', av: 'AV', compliance: 'Compliance',
  };
  return m[cat] ?? cat;
}
