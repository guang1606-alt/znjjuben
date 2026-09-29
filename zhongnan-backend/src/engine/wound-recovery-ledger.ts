/**
 * v2.80 创伤恢复账本（Wound Recovery Ledger）
 * ------------------------------------------------------------------
 * 查重分工（五个近邻引擎）：
 *  - continuity-supervision-check（v2.139）：单集内镜头间物理状态（受伤/毁物/束缚）
 *  - character-state-ledger（v2.80）：跨集"大状态"（怀孕/坐牢/昏迷/失忆…状态维度不分人名）
 *  - cost-ledger（v2.80）：单集"付没付代价"布尔记账（不跟踪具体伤势跨集恢复）
 *  - death-ledger（v2.80）：跨集"确认死亡"人名级连续性
 *  - villain-fate-ledger（v2.80）：跨集"非死下场"（入狱/被逐/下台…）人名级连续性
 *  - 本引擎：跨集"创伤恢复节奏"人名级连续性——具名角色本集受重创（重伤/断臂/
 *    吐血/奄奄一息…）入创伤名册，后续集同名角色高强度行动（出手/挥剑/开枪/狂奔…）
 *    且无痊愈交代 = 伤势凭空消失穿帮（high）；
 *    豁免：痊愈/伤愈/静养交代/断肢重生/灵药救治（与创伤同集出现即不入册）。
 *    与死亡账本的关键差异：active 判定不是"说话/行动"而是"高强度行动"——
 *    重伤者卧床说话/被搀扶是合法戏份，提剑杀人才是穿帮。
 *
 * 记账模型（与死亡/下场账本同构，纯确定性）：
 *   每集摘要 { ep, name, wounded, healed, strained }（具名角色逐个提取）：
 *   信号 = 名字与信号词共现（zh 前后 6 字符窗口，"差点/险些"前缀跳过；
 *   en 双向窄窗 + almost/nearly 前缀跳过）；
 *   死亡行不收创伤（同行命中死亡词 → 归 death-ledger 管，防双册双报）；
 *   strained = 人名与高强度动作词共现（台词/△/叙述均可，动作词本身就是硬证据）。
 *   按集升序过账：wounded && !healed 入册；healed 出册；册中者后续集 strained
 *   （该行未同时命中创伤/痊愈）→ 伤势穿帮（每名字只报 1 次即出册）。
 * 输出：创伤名册 + 穿帮 issue + 架构师"伤势维持"指令（注入同构）。
 * 纯确定性、零 LLM、零 IO；中英双语。en 层系统文案零中文（人名按原名透传）。
 */

export interface WoundRow {
  /** 集号 */
  ep: number;
  /** 角色名（具名，≥2 字符） */
  name: string;
  /** 本集受重创（重伤/断臂/吐血…与名字共现） */
  wounded: boolean;
  /** 本集痊愈豁免（痊愈/伤愈/断肢重生…与名字共现） */
  healed: boolean;
  /** 本集高强度行动（出手/挥剑/开枪/狂奔…与名字共现） */
  strained: boolean;
}

export interface WoundRecoveryIssue {
  severity: 'high';
  type: 'wounded_but_fighting';
  evidence: string;
  advice: string;
}

export interface WoundRecoveryLedgerResult {
  /** 当前创伤名册：受重创且未痊愈（跨集伤势维持监控池） */
  wounded: { name: string; woundEp: number }[];
  issues: WoundRecoveryIssue[];
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

// —— 重创信号词（持续性身体创伤：不含"昏迷"——归 state-ledger；不含"死亡"——归 death-ledger）——
const WOUND_ZH_G = /(重伤|身受重创|断臂|断腿|断手|断脚|吐血|咯血|呕血|奄奄一息|气若游丝|身中数刀|经脉尽断|筋脉尽断|伤势恶化)/g;

// —— 痊愈豁免信号词 ——
const HEAL_ZH_G = /(痊愈|伤愈|伤势全好|伤势痊愈|伤势恢复|伤势稳定|伤已无碍|断肢重生|重新长出|灵丹|灵药|药到病除|妙手回春|静养数日|疗伤数日)/g;

// —— 高强度动作词（册中伤者命中=带伤硬打）——
const STRAIN_ZH_G = /(出手|动手|一拳|一掌|挥剑|拔剑|挥刀|开枪|搏斗|交手|迎战|冲杀|厮杀|狂奔|跃起|翻墙|追击|硬闯|杀入)/g;

// —— 死亡词（同行共现则不收创伤，死亡归 death-ledger 管）——
const DEATH_OVERLAP_ZH_G = /(咽(?:了)?气|断气|气绝|毙命|身亡|丧命|殒命|命丧|不治身亡|当场死亡|去世|离世|死于非命|中弹身亡|倒地身亡)/g;

// —— 英文：重创/痊愈/高强度动作 ——
const WOUND_EN_G = /\b(?:seriously wounded|severely injured|badly hurt|lost an arm|lost a leg|broken arm|coughing up blood|vomiting blood|barely alive|on the brink of death|bleeding heavily|stabbed multiple times)\b/gi;
const HEAL_EN_G = /\b(?:fully recovered|made a full recovery|fully healed|wounds healed|back to full strength|miracle cure|limb regenerated)\b/gi;
const STRAIN_EN_G = /\b(?:fought|attacked|struck|punched|swung|fired|shot|chased|sprinted|leaped|leapt|stormed|broke into|dueled)\b/gi;
// —— 英文：死亡重叠词 ——
const DEATH_OVERLAP_EN = /\b(?:died|perished|killed|slain|passed away)\b/i;

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

/** en 双向窄窗命中：名字在前（允许 was/got 等助动词隔开："Wang was wounded"）或在后（"They wounded Wang"）；almost/nearly 前缀跳过 */
function enSignalHit(line: string, name: string, sig: RegExp): boolean {
  const nm = `\\b${escapeRe(name)}\\b`;
  sig.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = sig.exec(line)) !== null) {
    if (/almost|nearly/i.test(line.slice(Math.max(0, m.index - 7), m.index))) continue;
    const before = line.slice(Math.max(0, m.index - 12), m.index);
    if (new RegExp(`${nm}\\s*(?:was|were|got|had\\s+been|is|are|been)?\\s*$`, 'i').test(before)) return true;
    const after = line.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (new RegExp(`^[,\\s]{0,6}${nm}`, 'i').test(after)) return true;
  }
  return false;
}

/** 死亡重叠判定：该行死亡词与人名共现 → 创伤信号让位（死亡归 death-ledger 管） */
function deathOverlap(line: string, name: string, isZh: boolean): boolean {
  return isZh ? cooccurZh(line, name, DEATH_OVERLAP_ZH_G) : DEATH_OVERLAP_EN.test(line) && new RegExp(`\\b${escapeRe(name)}\\b`, 'i').test(line);
}

/**
 * 单集单角色创伤信号提取：创伤/痊愈（共现窗口）+ 高强度行动（动作词共现）。
 * @returns { wounded, healed, strained }；空文本/超短名字安全返回三 false。
 */
export function deriveWoundSignal(text: string, name: string): { wounded: boolean; healed: boolean; strained: boolean } {
  const n = (name ?? '').trim();
  if (!text || text.trim().length < MIN_TEXT || n.length < MIN_NAME || n.length > MAX_NAME) {
    return { wounded: false, healed: false, strained: false };
  }
  const isZh = isZhText(text);
  let wounded = false;
  let healed = false;
  let strained = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // 死亡行不收创伤：同行死亡词与人名共现 → 该行信号让位给 death-ledger
    if (!wounded && (isZh ? cooccurZh(line, n, WOUND_ZH_G) : enSignalHit(line, n, WOUND_EN_G)) && !deathOverlap(line, n, isZh)) wounded = true;
    if (!healed && (isZh ? cooccurZh(line, n, HEAL_ZH_G) : enSignalHit(line, n, HEAL_EN_G))) healed = true;
    if (!strained && (isZh ? cooccurZh(line, n, STRAIN_ZH_G) : enSignalHit(line, n, STRAIN_EN_G))) strained = true;
    if (wounded && healed && strained) break;
  }
  return { wounded, healed, strained };
}

/** 落库摘要 → WoundRow（规范化容错：ep/name 非法丢弃、布尔仅认 true） */
export function normalizeWoundRow(raw: unknown): WoundRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ep = Math.round(Number(r.ep));
  if (!Number.isFinite(ep) || ep < 1) return null;
  if (typeof r.name !== 'string') return null;
  const name = r.name.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  return { ep, name, wounded: r.wounded === true, healed: r.healed === true, strained: r.strained === true };
}

/**
 * 创伤恢复跨集记账：按集升序，重创入册 / 痊愈出册 / 册中伤者高强度行动即穿帮。
 * @param rows    前集创伤摘要序列（乱序安全，内部按 ep 升序，同集同名以后到为准）
 * @param curEpNo 当前正在生成的集号（rows 应全部 < curEpNo，透传校验）
 */
export function woundRecoveryLedger(rows: WoundRow[], curEpNo: number): WoundRecoveryLedgerResult {
  const cur = Math.round(Number(curEpNo));
  const byKey = new Map<string, WoundRow>();
  for (const raw of rows ?? []) {
    const r = normalizeWoundRow(raw);
    if (r && Number.isFinite(cur) && r.ep < cur) byKey.set(`${r.ep}\u0000${r.name}`, r);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ep - b.ep);

  const pool = new Map<string, { name: string; woundEp: number }>();
  const issues: WoundRecoveryIssue[] = [];
  for (const r of sorted) {
    const held = pool.get(r.name);
    // ① 册中伤者本集高强度行动（该行未同时命中创伤/痊愈——同集剧情归集内引擎管）
    if (held && r.strained && !r.wounded && !r.healed) {
      issues.push({
        severity: 'high',
        type: 'wounded_but_fighting',
        evidence: `${r.name}（第 ${held.woundEp} 集受重创）在第 ${r.ep} 集高强度行动且无痊愈交代`,
        advice: '伤势凭空消失是连续性穿帮：本集让他保持伤势（带伤状态/他人搀扶/拒绝战斗），或先给痊愈交代（灵药救治/静养数日/断肢重生）再恢复行动',
      });
      pool.delete(r.name); // 每名字只报 1 次
      continue;
    }
    // ② 痊愈出册
    if (held && r.healed) {
      pool.delete(r.name);
      continue;
    }
    // ③ 重创入册（同集 strained 是受伤前有戏，正常）
    if (r.wounded && !r.healed) {
      pool.set(r.name, { name: r.name, woundEp: r.ep });
    }
  }
  return { wounded: [...pool.values()], issues };
}

/**
 * 创伤维持调度指令（双语齐备，pipeline 按 hookLang 取层）。
 * 名册为空/无输入返回空串。en 层系统文案零中文（人名按原名透传）。
 */
export function woundDirective(rows: WoundRow[]): { zh: string; en: string } {
  const r = woundRecoveryLedger(rows, Number.MAX_SAFE_INTEGER);
  if (!r.wounded.length) return { zh: '', en: '' };
  const listZh = r.wounded.map((d) => `${d.name}（第${d.woundEp}集）`).join('、');
  const listEn = r.wounded.map((d) => `${d.name} (ep${d.woundEp})`).join(', ');
  const build = (isEn: boolean): string => {
    const lines = isEn ? ['[Cross-episode wounds — keep injuries consistent]'] : ['【跨集创伤·伤势维持】'];
    lines.push(isEn
      ? `  - Characters gravely wounded with no recovery on record: ${listEn}. They must NOT fight, sprint, or exert force this episode; show them weakened/assisted/recovering, or grant an explicit recovery (medicine, days of rest, regenerated limb) BEFORE any strenuous action.`
      : `  - 以下角色已受重创且无痊愈交代：${listZh}。本集严禁让他们搏斗/狂奔/用力过度；请写他们带伤状态/他人搀扶/拒绝战斗，或先给痊愈交代（灵药救治/静养数日/断肢重生）再恢复行动。`);
    return lines.join('\n') + '\n';
  };
  return { zh: build(false), en: build(true) };
}
