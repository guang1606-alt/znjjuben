/**
 * v2.80 信物跨集连续性账本（Prop Continuity Ledger）
 * ------------------------------------------------------------------
 * 缺口：evidence-chain-check 只查单集证据链，跨集维度"关键信物"（玉佩/
 * 婚书/DNA报告/日记本）无人追踪——信物某集出现后连着几集没人提（挖坑
 * 不填=观众早忘了你埋过这笔），或明确摔碎/烧毁/交出的信物过两集又凭空
 * 出现在角色手里（逻辑穿帮=评论区抓虫=口碑崩）。
 *
 * 记账模型（状态机，纯确定性）：
 *   每集摘要 { ep, items: [{ name, closed }] }（本集提及的信物 + 是否伴随
 *   销毁/丢失动作），生成侧用信物词典从终稿正文提取后落库 qcReport.props。
 *   台账按集升序过账：
 *     已封禁信物再提及 → phantom（凭空再用，high，账面保持封禁）；
 *     首次提及 → planted 入账面；再提及 → 刷新 lastSeen；
 *     伴随销毁/丢失动作 → 封禁（移出账面，之后再现即 phantom）；
 *   账面信物距当前集 gap ≥2 → 预警位（指令提前一集拦截）；
 *   gap ≥3 → dangling 正式报告（mid）；≥4 → high。
 * 输出：连续性结果 + 架构师"信物封禁/悬空预警"指令（与钩型疲劳注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文；
 * 信物名按词典原样透传。
 */

export type PledLang = 'zh' | 'en';

export interface PropItem {
  /** 信物名（词典原样） */
  name: string;
  /** 本集是否伴随销毁/丢失动作（true=封禁） */
  closed: boolean;
}

export interface PropRow {
  /** 集号 */
  ep: number;
  /** 本集提及的信物清单（去重后） */
  items: PropItem[];
}

export interface PropIssue {
  severity: 'mid' | 'high';
  type: 'prop_dangling' | 'prop_phantom';
  evidence: string;
  advice: string;
}

export interface PropLedgerResult {
  /** 账面活跃信物数（planted 未封禁） */
  plantedCount: number;
  /** 悬空预警位：gap ≥ PROP_DIRECTIVE_GAP 的账面信物（指令提前拦截用，含 gap=2） */
  stale: { name: string; plantedEp: number; lastSeenEp: number; gap: number }[];
  /** 已封禁信物名（销毁/丢失后禁止再现，供指令引用） */
  closed: string[];
  /** 凭空再用记录（封禁后再提及） */
  phantom: { name: string; closedEp: number; reopenedEp: number }[];
  /** none / mid / high */
  level: 'none' | 'mid' | 'high';
  issues: PropIssue[];
}

/** 悬空阈值：gap ≥3 报 mid，≥4 升 high */
export const PROP_DANGLING_MID = 3;
export const PROP_DANGLING_HIGH = 4;
/** 指令预防式阈值：gap ≥2 集未提即预警（提前一集拦住第 3 集悬空） */
export const PROP_DIRECTIVE_GAP = 2;

/** 指令引用信物数上限（控提示词预算） */
const PROP_QUOTE_MAX = 5;

// —— 信物词典：只收"剧情关键信物"级别（人人可见的服饰/日用不收，防噪音）——
// v2.80 导出供 item-ownership-ledger（信物归属账本）复用：两引擎共用同一信物口径
export const PROP_WORDS_ZH: string[] = [
  '亲子鉴定报告', 'DNA报告', '鉴定报告', '亲子鉴定', '化验单', '诊断书', '病历',
  '玉佩', '半块玉佩', '玉镯', '手镯', '项链', '吊坠', '戒指', '耳环', '胸针', '怀表',
  '婚书', '结婚证', '离婚协议', '婚约',
  '日记本', '账本', '合同', '协议书', '契约', '房本', '地契',
  '照片', '相片', '合影', '遗像',
  '信件', '遗书', '借条', '欠条', '遗嘱',
  '录音笔', '录音', '录像带', '监控录像', 'U盘', '光盘',
  '钥匙', '门禁卡', '银行卡', '存折', '支票', '印章', '令牌', '徽章', '工牌', '平安符', '护身符',
];

/** en 信物词（\b 词界匹配，收关键信物级） */
export const PROP_WORDS_EN: string[] = [
  'paternity test', 'dna report', 'autopsy report', 'medical record', 'lab report',
  'pendant', 'locket', 'brooch', 'necklace', 'bracelet', 'pocket watch', 'ring',
  'marriage certificate', 'divorce agreement', 'prenup',
  'diary', 'journal', 'contract', 'deed', 'testament',
  'photograph', 'photo', 'portrait',
  'letter', 'suicide note', 'iou', 'promissory note',
  'voice recorder', 'recording', 'tape', 'usb drive', 'usb', 'cd',
  'key', 'keycard', 'bank card', 'passbook', 'cheque', 'seal', 'token', 'badge',
];

/** 销毁/丢失动作词（信物同句出现即封禁：摔碎/烧毁/撕/扔/丢/埋/吞…） */
const CLOSE_VERBS_ZH: string[] = ['碎', '摔', '烧', '焚', '毁', '撕', '扔', '丢', '埋', '吞', '砸', '销毁'];
const CLOSE_VERBS_EN: string[] = [
  'shatter', 'shattered', 'smash', 'smashed', 'break', 'broke', 'broken',
  'burn', 'burned', 'burnt', 'tear', 'tore', 'torn', 'throw', 'threw', 'thrown',
  'destroy', 'destroyed', 'bury', 'buried', 'swallow', 'swallowed', 'lost', 'discard', 'discarded',
];

// v2.159 否定语境守卫：「这玉佩我绝不会丢」「没烧」是保持而非销毁——
// 否定词紧邻销毁动词（zh 允许 0 字间隔，en 允许一个助动词）时不算封禁，防账本误封/沉淀误标
const NEG_RE_ZH = /(不会|绝不|不能|不再|未曾|没|未)\s*(碎|摔|烧|焚|毁|撕|扔|丢|埋|吞|砸|销毁)/;
const NEG_RE_EN = /\b(?:not|never|no longer)\s+(?:\w+\s+)?(?:shatter\w*|smash\w*|broke?n?|burn\w*|tear|tore|torn|throw\w*|destroy\w*|bury|buried|swallow\w*|lost|discard\w*)\b/;

/** 同句含销毁动作且非否定语境 → 封禁（c154：否定语境守卫防"绝不会丢"误判） */
const isClosedSentence = (sent: string, zh: boolean): boolean =>
  zh ? (!NEG_RE_ZH.test(sent) && CLOSE_VERBS_ZH.some((v) => sent.includes(v)))
     : (!NEG_RE_EN.test(sent) && CLOSE_VERBS_EN.some((v) => new RegExp(`\\b${v}\\b`, 'i').test(sent)));

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

/** 按名字长度降序匹配（长词优先，防"玉佩"截胡"半块玉佩"/"亲子鉴定"截胡"亲子鉴定报告"） */
const WORDS_ZH_SORTED = [...PROP_WORDS_ZH].sort((a, b) => b.length - a.length);

/**
 * 信物提及提取：切句后逐句匹配信物词典，同句含销毁/丢失动作词 → closed。
 * zh 长词优先 + 逐句去重；en \b 词界大小写不敏感。纯确定性。
 */
export function extractPropMentions(text: string): PropItem[] {
  if (!text || !text.trim()) return [];
  const zh = isZhText(text);
  const sentences = text.split(/[。！？；!?;\n\r]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Map<string, PropItem>();
  for (const sent of sentences) {
    if (zh) {
      for (const word of WORDS_ZH_SORTED) {
        if (sent.includes(word) && !seen.has(word)) {
          seen.set(word, { name: word, closed: isClosedSentence(sent, true) });
        }
      }
    } else {
      const lower = sent.toLowerCase();
      for (const word of PROP_WORDS_EN) {
        const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(sent) && !seen.has(word)) {
          seen.set(word, { name: word, closed: isClosedSentence(sent, false) });
        }
      }
    }
  }
  return [...seen.values()];
}

/** 落库摘要 → PropRow（规范化容错：ep 非法丢弃；items 非数组/条目 name 非字符串一律丢弃；closed 容错） */
export function normalizePropRow(raw: unknown): PropRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items: PropItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== 'object') continue;
    const name = (it as Record<string, unknown>).name;
    if (typeof name !== 'string') continue;
    const trimmed = name.trim().slice(0, 30);
    if (!trimmed) continue;
    items.push({ name: trimmed, closed: (it as Record<string, unknown>).closed === true || (it as Record<string, unknown>).closed === 1 });
  }
  return { ep, items };
}

/**
 * 信物连续性记账：按集升序过账，封禁/悬空/凭空再用三查。
 * @param rows    前集信物摘要序列（乱序安全，内部按 ep 升序）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function propLedger(rows: PropRow[], curEpNo: number): PropLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const sorted = [...(rows ?? [])]
    .map(normalizePropRow)
    .filter((r): r is PropRow => r !== null && Number.isFinite(cur) && r.ep < cur)
    .sort((a, b) => a.ep - b.ep);
  const active = new Map<string, { plantedEp: number; lastSeenEp: number }>();
  const closedEp = new Map<string, number>();
  const phantom: { name: string; closedEp: number; reopenedEp: number }[] = [];
  for (const r of sorted) {
    for (const item of r.items) {
      if (closedEp.has(item.name)) {
        if (!item.closed) phantom.push({ name: item.name, closedEp: closedEp.get(item.name)!, reopenedEp: r.ep });
        continue; // 账面保持封禁（穿帮只记录，不重新激活）
      }
      if (active.has(item.name)) {
        active.get(item.name)!.lastSeenEp = r.ep;
      } else {
        active.set(item.name, { plantedEp: r.ep, lastSeenEp: r.ep });
      }
      if (item.closed) {
        closedEp.set(item.name, r.ep);
        active.delete(item.name);
      }
    }
  }
  const stale = [...active.entries()]
    .map(([name, s]) => ({ name, plantedEp: s.plantedEp, lastSeenEp: s.lastSeenEp, gap: Math.max(0, cur - s.lastSeenEp) }))
    .filter((s) => s.gap >= PROP_DIRECTIVE_GAP)
    .sort((a, b) => b.gap - a.gap);
  const maxGap = stale.length ? stale[0].gap : 0;
  const level: 'none' | 'mid' | 'high' = phantom.length ? 'high'
    : maxGap >= PROP_DANGLING_HIGH ? 'high'
    : maxGap >= PROP_DANGLING_MID ? 'mid' : 'none';
  const issues: PropIssue[] = [];
  if (phantom.length) {
    const names = [...new Set(phantom.map((p) => p.name))].slice(0, 3);
    issues.push({
      severity: 'high',
      type: 'prop_phantom',
      evidence: `已销毁/丢失信物${names.map((n) => `「${n}」`).join('')}又在第 ${phantom[phantom.length - 1].reopenedEp} 集凭空再现`,
      advice: '信物连续性穿帮：已销毁/交出的信物不得凭空再现；如剧情确需该信物，必须先补"找回原件/重新制作/另有备份"的交代，否则改用新信物',
    });
  }
  const dangling = stale.filter((s) => s.gap >= PROP_DANGLING_MID);
  if (dangling.length) {
    const names = dangling.slice(0, PROP_QUOTE_MAX).map((s) => `「${s.name}」`).join('');
    issues.push({
      severity: maxGap >= PROP_DANGLING_HIGH ? 'high' : 'mid',
      type: 'prop_dangling',
      evidence: `关键信物${names}已连续 ${maxGap} 集未提及（埋下即忘）`,
      advice: '信物悬空：埋下的关键信物必须回收或推进——本集让它自然复现并承担剧情功能，或借角色之口明确交代搁置原因；挖坑不填=观众流失',
    });
  }
  return { plantedCount: active.size, stale, closed: [...closedEp.keys()], phantom, level, issues };
}

/**
 * 信物连续性调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 预防式：有封禁名单即出封禁令；账面信物 gap ≥2 即出悬空预警（提前一集拦截）。
 * 无封禁无预警返回空串。
 */
export function propDirective(rows: PropRow[]): { zh: string; en: string } {
  const maxEp = (rows ?? []).reduce((m, r) => Math.max(m, Math.round(Number(r.ep)) || 0), 0);
  if (!maxEp) return { zh: '', en: '' };
  const r = propLedger(rows, maxEp + 1);
  const build = (isEn: boolean): string => {
    const lines: string[] = [];
    if (r.closed.length) {
      const names = r.closed.slice(0, PROP_QUOTE_MAX);
      lines.push(isEn
        ? `[Prop continuity — banned props]\n  - Banned: ${names.join(', ')} — destroyed/lost already. This episode must NOT have them reappear out of thin air; if the plot truly needs one, first show how it was recovered, remade, or backed up — otherwise introduce a new prop.`
        : `【信物连续性·封禁令】\n  - 已销毁/丢失信物：${names.join('、')}——本集禁止凭空再现；剧情确需该信物，必须先补"找回原件/重新制作/另有备份"的交代，否则换新信物。`);
    }
    if (r.stale.length) {
      const names = r.stale.slice(0, 3);
      const quote = isEn
        ? names.map((s) => `${s.name} (${s.gap} eps unseen)`).join(', ')
        : names.map((s) => `「${s.name}」(${s.gap} 集未提)`).join('');
      lines.push(isEn
        ? `[Prop continuity — dangling warning]\n  - Unresolved props: ${quote} — this episode must bring them back naturally with a plot function, or have a character explain why they're shelved; props planted then forgotten = viewers churn.`
        : `【信物连续性·悬空预警】\n  - 未回收信物：${quote}——本集必须让它们自然复现并承担剧情功能，或借角色之口交代搁置原因；信物埋了就忘=观众流失。`);
    }
    return lines.length ? lines.join('\n') + '\n' : '';
  };
  return { zh: build(false), en: build(true) };
}
