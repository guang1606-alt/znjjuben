/**
 * v2.80 境界进阶账本（Power Progress Ledger）
 * ------------------------------------------------------------------
 * 查重分工（五个近邻引擎）：
 *  - cheat-rule-check：单集"金手指/新能力凭空解锁"（能力来源合法性，不追踪境界阶梯）
 *  - xuanhuan-craft：圣经层"境界阶梯清晰"创作原则（cultivation_ladder，非执行检测）
 *  - character-state-ledger：跨集"大状态"（怀孕/坐牢/昏迷…状态维度不分人名）
 *  - wound-recovery-ledger：跨集"创伤恢复节奏"人名级连续性
 *  - 本引擎：跨集"修为境界阶梯"人名级连续性——具名角色的境界（炼气→筑基→金丹→
 *    元婴→化神→炼虚→合体→大乘→渡劫）逐集追踪：
 *      skip_realm_jump  凭空跳级：连升 ≥2 级且无突破交代（high）
 *      soft_realm_jump  升 1 级但无突破/进阶场景（mid 提醒）
 *      realm_drop       凭空降级：境界倒退且无废功/散功交代（high）
 *    豁免：夺舍/转世/重生/隐藏修为/废功重修等合法身份洗牌（重置追踪）。
 *    "低境界施展高阶神通"的能力合法性由 cheat-rule-check 单集另查，本引擎只管
 *    境界数字本身的跨集连续性——这正是账本系列可确定性对拍的部分。
 *
 * 记账模型（与创伤/死亡账本同构，纯确定性）：
 *   每集摘要 { ep, name, realm, broke, down, exempted }（具名角色逐个提取）：
 *   realm = 阶梯索引（0..8，同行多境界词取最高）；信号 = 名字与境界词共现
 *   （zh 前后 6 字符窗口，"差点/险些"前缀跳过；en 双向窄窗 + almost/nearly）；
 *   broke = 突破/进阶词共现；down = 废功/散功/跌境词共现；exempted = 身份洗牌词共现。
 *   按集升序过账（同集同名以后到为准）：exempted 重置；down 合法降级；有境界词
 *   与池中比对出 issue；仅突破无境界词 = 阶梯 +1。每名字每类型只报 1 次。
 * 输出：当前境界名册 + issue 清单 + 架构师"境界连续性"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名按原名透传）。
 */

export interface PowerRow {
  /** 集号 */
  ep: number;
  /** 角色名（具名，≥2 字符） */
  name: string;
  /** 本集境界阶梯索引（0..8）；本集未出现境界词 = null */
  realm: number | null;
  /** 本集突破/进阶（突破/破境/结丹成功…与名字共现） */
  broke: boolean;
  /** 本集合法降级交代（废功/散功/跌境/走火入魔…与名字共现） */
  down: boolean;
  /** 本集身份洗牌豁免（夺舍/转世/隐藏修为…与名字共现，重置追踪） */
  exempted: boolean;
}

export interface PowerProgressIssue {
  severity: 'high' | 'mid';
  type: 'skip_realm_jump' | 'soft_realm_jump' | 'realm_drop';
  evidence: string;
  advice: string;
}

export interface PowerProgressLedgerResult {
  /** 当前境界名册：各角色最近已知境界（跨集进阶监控池） */
  tracked: { name: string; realm: number; realmLabel: string; realmLabelEn: string; lastEp: number }[];
  issues: PowerProgressIssue[];
}

/** 文本最短触发长度（防空白/超短文本误判） */
const MIN_TEXT = 6;
/** 名字最短长度（防单字误伤） */
const MIN_NAME = 2;
/** 名字最长长度（防整段设定误当人名） */
const MAX_NAME = 24;
/** zh 信号词与人名的共现窗口（字符） */
const WINDOW_ZH = 6;

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// —— 境界阶梯（索引即等级；zh 单一事实源，en 逐级对译） ——
export const REALM_STAIRS: { id: string; zh: string; en: string; zhRe: RegExp; enRe: RegExp }[] = [
  { id: 'qi', zh: '炼气', en: 'Qi Refining', zhRe: /(炼气期?|练气期?)/g, enRe: /\b(?:qi (?:refining|condensation)|qi cultivation)\b/gi },
  { id: 'foundation', zh: '筑基', en: 'Foundation Establishment', zhRe: /(筑基期?)/g, enRe: /\bfoundation establishment\b/gi },
  { id: 'core', zh: '金丹', en: 'Golden Core', zhRe: /(金丹期?|结丹期?)/g, enRe: /\b(?:golden core|core formation)\b/gi },
  { id: 'nascent', zh: '元婴', en: 'Nascent Soul', zhRe: /(元婴期?)/g, enRe: /\bnascent soul\b/gi },
  { id: 'soul', zh: '化神', en: 'Soul Formation', zhRe: /(化神期?)/g, enRe: /\b(?:soul formation|spirit transformation)\b/gi },
  { id: 'void', zh: '炼虚', en: 'Void Refinement', zhRe: /(炼虚期?)/g, enRe: /\bvoid refinement\b/gi },
  { id: 'integration', zh: '合体', en: 'Body Integration', zhRe: /(合体期?)/g, enRe: /\bbody integration\b/gi },
  { id: 'ascension', zh: '大乘', en: 'Great Ascension', zhRe: /(大乘期?)/g, enRe: /\bgreat ascension\b/gi },
  { id: 'tribulation', zh: '渡劫', en: 'Tribulation', zhRe: /(渡劫期?)/g, enRe: /\btribulation (?:crossing|stage)\b/gi },
];
const TOP_REALM = REALM_STAIRS.length - 1;

// —— 突破/进阶信号词 ——
const BROKE_ZH_G = /(突破|晋阶|破境|进阶|修为大进|修为突破|修为精进|境界突破|境界提升|境界跃升|结丹成功|丹成|凝婴|连破.{0,3}境|成功筑基)/g;
// —— 合法降级交代词 ——
const DOWN_ZH_G = /(废功|散功|修为尽废|修为被废|自废武功|跌境|境界跌落|修为倒退|丹田碎裂|丹田被毁|封印修为|自封修为|走火入魔)/g;
// —— 身份洗牌豁免词（重置追踪） ——
const EXEMPT_ZH_G = /(夺舍|转世|重生|前世|来世|隐藏修为|深藏不露|扮猪吃虎|恢复修为|修为恢复|解封|封印解除|附身|夺体重生|涅槃)/g;

// —— 英文层（零中文） ——
const BROKE_EN_G = /\b(?:breakthrough|broke through|breakthrough to|advanced to|power surge|realm breakthrough|ascended to)\b/gi;
const DOWN_EN_G = /\b(?:crippled (?:his|her|their) cultivation|cultivation crippled|lost (?:his|her|their) cultivation|cultivation destroyed|sealed (?:his|her|their) (?:power|cultivation)|power sealed|cultivation regressed)\b/gi;
const EXEMPT_EN_G = /\b(?:possessed|reincarnat(?:ed|ion)|reborn|second life|past life|hidden (?:his|her|their) (?:true )?(?:power|cultivation)|unsealed|seal broken|regained (?:his|her|their) power)\b/gi;

/** zh 共现判定：信号词每个命中位置取前后窗口测人名；"差点/险些"前缀的命中跳过（没成） */
function cooccurZh(line: string, name: string, sig: RegExp): boolean {
  const nameRe = new RegExp(escapeRe(name));
  sig.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = sig.exec(line)) !== null) {
    if (/差点|险些|几乎|没能/.test(line.slice(Math.max(0, m.index - 4), m.index))) continue;
    const start = Math.max(0, m.index - WINDOW_ZH);
    const end = Math.min(line.length, m.index + m[0].length + WINDOW_ZH);
    if (nameRe.test(line.slice(start, end))) return true;
  }
  return false;
}

/** en 双向窄窗命中：名字在前（"Wang is a / has reached the ..." 允许冠词助动词隔开）或在后；almost/nearly 前缀跳过 */
function enSignalHit(line: string, name: string, sig: RegExp): boolean {
  const nm = `\\b${escapeRe(name)}\\b`;
  const FILLER = '(?:[\\s,]+(?:is|was|are|were|a|an|the|has|have|had|reached|at|in|to|now|already|finally|been|become|became))*';
  sig.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = sig.exec(line)) !== null) {
    if (/almost|nearly/i.test(line.slice(Math.max(0, m.index - 7), m.index))) continue;
    const before = line.slice(Math.max(0, m.index - 24), m.index);
    if (new RegExp(`${nm}${FILLER}\\s*$`, 'i').test(before)) return true;
    const after = line.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (new RegExp(`^[,\\s]{0,6}${nm}`, 'i').test(after)) return true;
  }
  return false;
}

/**
 * 单集单角色境界信号提取。
 * @returns { realm, broke, down, exempted }；realm 为同行最高境界索引，无境界词 = null。
 * 空文本/超短名字安全返回 { realm: null, broke: false, down: false, exempted: false }。
 */
export function derivePowerSignal(text: string, name: string): { realm: number | null; broke: boolean; down: boolean; exempted: boolean } {
  const n = (name ?? '').trim();
  const none = { realm: null as number | null, broke: false, down: false, exempted: false };
  if (!text || text.trim().length < MIN_TEXT || n.length < MIN_NAME || n.length > MAX_NAME) return none;
  const isZh = isZhText(text);
  let realm: number | null = null;
  let broke = false;
  let down = false;
  let exempted = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (realm === null || realm < TOP_REALM) {
      const stairs = REALM_STAIRS;
      for (let i = stairs.length - 1; i >= (realm === null ? 0 : realm + 1); i--) {
        const hit = isZh ? cooccurZh(line, n, stairs[i].zhRe) : enSignalHit(line, n, stairs[i].enRe);
        if (hit) { realm = i; break; }
      }
    }
    if (!broke && (isZh ? cooccurZh(line, n, BROKE_ZH_G) : enSignalHit(line, n, BROKE_EN_G))) broke = true;
    if (!down && (isZh ? cooccurZh(line, n, DOWN_ZH_G) : enSignalHit(line, n, DOWN_EN_G))) down = true;
    if (!exempted && (isZh ? cooccurZh(line, n, EXEMPT_ZH_G) : enSignalHit(line, n, EXEMPT_EN_G))) exempted = true;
    if (realm === TOP_REALM && broke && down && exempted) break;
  }
  return { realm, broke, down, exempted };
}

/** 落库摘要 → PowerRow（规范化容错：ep/name 非法丢弃、realm 越界归 null、布尔仅认 true） */
export function normalizePowerRow(raw: unknown): PowerRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string') return null;
  const name = r.name.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  const realm = (r.realm === null || r.realm === undefined || r.realm === '')
    ? null
    : (Number.isFinite(Math.round(Number(r.realm))) && Number(r.realm) >= 0 && Number(r.realm) <= TOP_REALM ? Math.round(Number(r.realm)) : null);
  return { ep, name, realm, broke: r.broke === true, down: r.down === true, exempted: r.exempted === true };
}

/**
 * 境界跨集记账：按集升序，身份洗牌重置 / 废功合法降级 / 境界比对出穿帮。
 * @param rows    前集境界摘要序列（乱序安全，内部按 ep 升序，同集同名以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function powerProgressLedger(rows: PowerRow[], curEpNo: number): PowerProgressLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, PowerRow>();
  for (const raw of rows ?? []) {
    const r = normalizePowerRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${r.name}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { name: string; realm: number; lastEp: number }>();
  const reported = new Set<string>();
  const issues: PowerProgressIssue[] = [];
  const once = (r: PowerRow, type: PowerProgressIssue['type'], severity: 'high' | 'mid', evidence: string, advice: string): void => {
    const key = `${r.name}\u0000${type}`;
    if (reported.has(key)) return;
    reported.add(key);
    issues.push({ severity, type, evidence, advice });
  };
  for (const r of sorted) {
    const held = pool.get(r.name);
    // ① 身份洗牌豁免：夺舍/转世/隐藏修为…重置追踪（境界以下一集明确交代为新基线）
    if (held && r.exempted) {
      pool.delete(r.name);
      continue;
    }
    if (!held) {
      if (r.realm !== null) pool.set(r.name, { name: r.name, realm: r.realm, lastEp: r.ep });
      continue; // 无基线不判定（首见境界可能是圣经既定）
    }
    // ② 合法降级交代（废功/散功/跌境…）：有明确境界词用之，否则跌 1 级
    if (r.down) {
      pool.set(r.name, { name: r.name, realm: r.realm ?? Math.max(0, held.realm - 1), lastEp: r.ep });
      continue;
    }
    if (r.realm === null) {
      // 仅突破无境界词 = 阶梯 +1
      if (r.broke) pool.set(r.name, { name: r.name, realm: Math.min(TOP_REALM, held.realm + 1), lastEp: r.ep });
      continue;
    }
    // ③ 有境界词：与池中比对
    const delta = r.realm - held.realm;
    if (delta > 1 && !r.broke) {
      once(r, 'skip_realm_jump', 'high',
        `${r.name}（第 ${held.lastEp} 集为「${REALM_STAIRS[held.realm].zh}」境）在第 ${r.ep} 集凭空成为「${REALM_STAIRS[r.realm].zh}」境，连升 ${delta} 级且无突破交代`,
        '境界跳级是升级流最大穿帮：要么补突破场景（闭关/顿悟/丹药/机缘），要么借台词交代（"那一战后我侥幸破境"），不许凭空连跳');
    } else if (delta === 1 && !r.broke) {
      once(r, 'soft_realm_jump', 'mid',
        `${r.name}（第 ${held.lastEp} 集为「${REALM_STAIRS[held.realm].zh}」境）在第 ${r.ep} 集已是「${REALM_STAIRS[r.realm].zh}」境，但无突破/进阶场景`,
        '升境建议给一场突破戏（哪怕一句"闭关三月终于破境"），升级有据读者才有爽感');
    } else if (delta < 0) {
      once(r, 'realm_drop', 'high',
        `${r.name}（第 ${held.lastEp} 集为「${REALM_STAIRS[held.realm].zh}」境）在第 ${r.ep} 集凭空跌为「${REALM_STAIRS[r.realm].zh}」境，无废功/散功交代`,
        '境界倒退必被骂穿帮：补废功/散功/走火入魔/封印修为等明确交代，或修正境界口径');
    }
    pool.set(r.name, { name: r.name, realm: r.realm, lastEp: r.ep });
  }
  const tracked = [...pool.values()].map((t) => ({
    name: t.name,
    realm: t.realm,
    realmLabel: REALM_STAIRS[t.realm].zh,
    realmLabelEn: REALM_STAIRS[t.realm].en,
    lastEp: t.lastEp,
  }));
  return { tracked, issues };
}

/**
 * 境界连续性调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名/境界英文名按对译透传）。
 */
export function powerDirective(rows: PowerRow[]): { zh: string; en: string } {
  const r = powerProgressLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.tracked.length) return { zh: '', en: '' };
  const listZh = r.tracked.map((t) => `${t.name}＝${t.realmLabel}（第${t.lastEp}集）`).join('、');
  const listEn = r.tracked.map((t) => `${t.name} = ${t.realmLabelEn} (ep${t.lastEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode cultivation ladder — realm continuity]'] : ['【跨集境界·进阶连续性】'];
    lines.push(isEn
      ? `  - Registered realms: ${listEn}. Any realm change this episode MUST show an on-screen breakthrough (seclusion / epiphany / pill / fortuitous encounter) or a crippling/sealing explanation; never jump two or more stages, never regress without cause. Using abilities beyond the registered realm requires a cheat/fortune setup (covered by the cheat-rule check).`
      : `  - 已入册境界：${listZh}。本集任何境界变化必须给突破场景（闭关/顿悟/丹药/机缘）或废功/封印交代；严禁连跳两级、严禁无因倒退；施展超出当前境界的神通需有金手指/机缘铺垫（能力合法性由开挂规则检查另查）。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
