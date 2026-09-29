/**
 * 信息密度检测器（PRD 2.1.18 短剧信息推进生死线）
 * ------------------------------------------------------------------
 * 短剧的另一个致命伤是"水戏"——场景有冲突、有对白，但没推进剧情。
 * 观众看完一场戏后问"这场戏讲了什么？"，如果答不出，就是水戏。
 *
 * 现有引擎覆盖：
 *  - scene-density-score.ts: 检测场景数/长度/静态/碎片（结构层面），不看信息推进
 *  - conflict-density-check: 检测冲突信号（情绪层面），不看冲突是否推进剧情
 *  - dialogue-water-check: 检测对白水分（功能层面），但不看场景整体信息推进
 *  - twist-density-score: 检测反转密度（剧情层面），但反转只是信息推进的一种
 *
 * 本引擎专注于：
 *  1) 单场信息推进数：每场戏有几种"新信息"（身份/动机/真相/关系/目标/反转）
 *  2) 信息推进分布：信息是否集中在一两场，其他场是水戏
 *  3) 信息密度过低场景：占整集比例 >40% 触发 high 级问题（"水戏"过多）
 *  4) 信息密度过高场景：单场信息推进数 ≥4 触发 mid 级问题（信息过载）
 *  5) 全剧信息推进曲线：是否符合"渐进揭示-高潮揭示-收束"
 *  6) 关键信息位置：关键信息是否放在前 1/3（钩子区）和末 1/3（高潮区）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */

import { isSceneHeaderLine } from './script-scenes';

export type IdsLang = 'zh' | 'en';

export interface InformationIssue {
  severity: 'high' | 'mid' | 'low';
  type: string;
  evidence: string;
  advice: string;
}

/** 单场信息推进命中 */
export interface InfoHit {
  /** 场景序号（1-based） */
  sceneIndex: number;
  /** 信息类型 */
  type: 'identity' | 'motive' | 'truth' | 'relation' | 'goal' | 'reversal' | 'evidence';
  /** 信息类型中文名 */
  typeLabel: string;
  /** 命中行原文 */
  evidence: string;
  /** 行号 */
  lineIndex: number;
}

export interface SceneInfoDensity {
  /** 场景序号（1-based） */
  index: number;
  /** 场景标题 */
  header: string;
  /** 信息推进数 */
  infoCount: number;
  /** 信息命中详情 */
  hits: InfoHit[];
  /** 场景字数 */
  wordCount: number;
  /** 信息密度（信息推进数/字数*1000） */
  density: number;
  /** 场景类型 */
  type: 'normal' | 'water' | 'overload';
}

export interface InformationDensityResult {
  /** 信息密度分 0-100（越高越好） */
  score: number;
  /** 场景总数 */
  totalScenes: number;
  /** 信息推进总数 */
  totalInfoPushes: number;
  /** 平均每场信息推进数 */
  avgInfoPerScene: number;
  /** 水戏（信息推进=0）数量 */
  waterSceneCount: number;
  /** 水戏占比 0-1 */
  waterRatio: number;
  /** 信息过载场景数（≥4 推进） */
  overloadSceneCount: number;
  /** 前 1/3 场景是否有信息推进 */
  hasInfoInFirstThird: boolean;
  /** 末 1/3 场景是否有信息推进 */
  hasInfoInLastThird: boolean;
  /** 信息推进曲线是否渐进上升 */
  hasRisingProgression: boolean;
  /** 各场景详情 */
  scenes: SceneInfoDensity[];
  /** 所有信息命中（按场景顺序） */
  allHits: InfoHit[];
  issues: InformationIssue[];
}

// —— 场景切分 ——
// c213：场头判定统一走 engine/script-scenes.ts 单一事实源（历史缺陷：漏切
// AIGC「内景/外景」与英文 INT./EXT.，导致规范稿整场误判为水戏）。
const DIALOGUE_RE_ZH = /^[一-龥A-Za-z·]{1,6}(?:（[^）]*）)?[：:]\s*\S/;
// 说话人兼容两种剧本格式：全大写 slug（JANE:）与首字母大写（Jane:）；c213 起与 dialogue-functionality 引擎对齐
const DIALOGUE_RE_EN = /^[A-Z](?:[A-Z]{1,19}|[a-z]{1,15})(?:\s*\([^)]*\))?\s*[:：]\s*\S/;
const ACTION_PREFIX = /^[△▲*✦]/;

function isSceneHeader(line: string, lang: IdsLang): boolean {
  return isSceneHeaderLine(line, lang);
}

function isDialogueLine(line: string, lang: IdsLang): boolean {
  const trimmed = line.trim();
  if (!trimmed || ACTION_PREFIX.test(trimmed)) return false;
  if (lang === 'en') return DIALOGUE_RE_EN.test(trimmed);
  return DIALOGUE_RE_ZH.test(trimmed);
}

// —— 信息推进关键词（六类） ——
const INFO_PATTERNS_ZH: { type: InfoHit['type']; label: string; re: RegExp }[] = [
  // 身份揭示
  { type: 'identity', label: '身份揭示', re: /我(其实)?是|你(才|就)?是|原来你是|真正的|其实我是|身份|你(到底)?是谁/ },
  // 动机揭示
  { type: 'motive', label: '动机揭示', re: /因为|为了|之所以|目的是|动机|打算|想要|图什么|为了什么/ },
  // 真相揭示
  { type: 'truth', label: '真相揭示', re: /真相|其实|原来(如此)?|没想到|竟(然)?|居然|发现|得知|明白了|才知道/ },
  // 关系变化
  { type: 'relation', label: '关系变化', re: /从今以后|不再(是)?|分手|和好|合作|背叛|联合|分裂|断绝|绝交|在一起/ },
  // 目标转向
  { type: 'goal', label: '目标转向', re: /现在我要|下一步|计划|目标|打算|重新|接下来|新目标/ },
  // 反转关键词
  { type: 'reversal', label: '反转信号', re: /但是|然而|可是|没想到|谁知|不料|岂料|偏偏|谁知(道)?/ },
  // c213：实证揭示——"用证据演出来"的硬信息（物证/账目/录音/法律动作），与显性关键词同等计为信息推进
  { type: 'evidence', label: '实证揭示', re: /(录音|录像|录音笔|监控(?:录像|画面|里)?|转账|汇款|银行流水|流水|收款人|空壳(?:公司)?|账目?|账本|台账|凭证|发票|收据|合同附件|抵押物?|保证人|手印|脚印|指纹|复印件?|律师(?:函|事务所)?|经侦|公安|报案|举报|检举|报社|媒体|记者|亲子鉴定|遗嘱|U盘|硬盘|名单)/ },
];

const INFO_PATTERNS_EN: { type: InfoHit['type']; label: string; re: RegExp }[] = [
  { type: 'identity', label: 'Identity reveal', re: /\bI (?:actually )?am\b|\byou (?:really|actually) are\b|\bthe real\b|\btruth is\b|\bwho (?:are|is) (?:you|he|she)\b/i },
  { type: 'motive', label: 'Motive reveal', re: /\bbecause\b|\bin order to\b|\bthe reason\b|\bpurpose\b|\bmotive\b|\bintend\b|\bplan to\b/i },
  { type: 'truth', label: 'Truth reveal', re: /\btruth\b|\bactually\b|\bturns out\b|\bdiscovered\b|\bfound out\b|\brealize[ds]?\b|\bnow I know\b/i },
  { type: 'relation', label: 'Relation shift', re: /\bfrom now on\b|\bno longer\b|\bbreakup\b|\breconcile\b|\bcooperate\b|\bbetray\b|\btogether\b|\bnever again\b/i },
  { type: 'goal', label: 'Goal shift', re: /\bnow I(?:'m| will)\b|\bnext step\b|\bplan\b|\bgoal\b|\bnew target\b|\bgoing to\b/i },
  { type: 'reversal', label: 'Reversal signal', re: /\bbut\b|\bhowever\b|\byet\b|\bunexpectedly\b|\bnever thought\b|\bwho knew\b|\bturns out\b/i },
  // c213：实证揭示——物证/账目/录音/法律动作等"演出来"的硬信息
  { type: 'evidence', label: 'Evidence reveal', re: /\b(transfer(?:s|red)?|shell compan|bank records?|ledger|receipts?|footage|surveillance|record(?:ing|ed|s)|fingerprints?|collateral|guarantor|copies|lawyer|economic crimes|pressed charges|reported (?:him|her|them) to)\b/i },
];

function sceneWordCount(text: string, lang: IdsLang): number {
  if (lang === 'en') {
    const m = text.match(/[A-Za-z][A-Za-z'-]*/g);
    return m ? Math.round(m.length * 1.67) : 0;
  }
  const m = text.match(/[一-鿿]/g);
  return m ? m.length : 0;
}

function parseScenes(text: string, lang: IdsLang): { header: string; body: string; startIdx: number }[] {
  const lines = text.split('\n');
  const scenes: { header: string; body: string; startIdx: number }[] = [];
  let currentHeader: string | null = null;
  let currentBody: string[] = [];
  let currentStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSceneHeader(line, lang)) {
      if (currentHeader !== null) {
        scenes.push({ header: currentHeader, body: currentBody.join('\n'), startIdx: currentStart });
      }
      currentHeader = line.trim();
      currentBody = [];
      currentStart = i;
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeader !== null) {
    scenes.push({ header: currentHeader, body: currentBody.join('\n'), startIdx: currentStart });
  }
  if (scenes.length === 0) {
    scenes.push({ header: '', body: text, startIdx: 0 });
  }
  return scenes;
}

/** 检测单场信息推进 */
function detectSceneInfo(sceneIdx: number, body: string, lang: IdsLang): InfoHit[] {
  const patterns = lang === 'en' ? INFO_PATTERNS_EN : INFO_PATTERNS_ZH;
  const lines = body.split('\n');
  const hits: InfoHit[] = [];
  const seenTypes = new Set<string>(); // 每类只计一次，避免重复扣分
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // 只在对白行和动作行中检测信息推进
    const isDialogue = isDialogueLine(line, lang);
    const isAction = ACTION_PREFIX.test(line.trim());
    if (!isDialogue && !isAction) continue;
    for (const p of patterns) {
      const key = `${p.type}:${i}`;
      if (seenTypes.has(p.type + ':' + i)) continue;
      if (p.re.test(line)) {
        hits.push({
          sceneIndex: sceneIdx,
          type: p.type,
          typeLabel: p.label,
          evidence: line.trim().slice(0, 80),
          lineIndex: i,
        });
        seenTypes.add(p.type + ':' + i);
      }
    }
  }
  return hits;
}

const TYPE_LABEL_ZH: Record<InfoHit['type'], string> = {
  identity: '身份揭示',
  motive: '动机揭示',
  truth: '真相揭示',
  relation: '关系变化',
  goal: '目标转向',
  reversal: '反转信号',
  evidence: '实证揭示',
};

/**
 * 主函数：评估信息密度
 * @param text 成稿全文
 * @param lang 中英文
 */
export function informationDensityScore(text: string, lang: IdsLang = 'zh'): InformationDensityResult {
  const parsed = parseScenes(text, lang);
  const total = parsed.length;

  const scenes: SceneInfoDensity[] = parsed.map((s, i) => {
    const hits = detectSceneInfo(i + 1, s.body, lang);
    const wc = sceneWordCount(s.body, lang);
    const infoCount = hits.length;
    const density = wc > 0 ? Number(((infoCount / wc) * 1000).toFixed(2)) : 0;
    let type: SceneInfoDensity['type'] = 'normal';
    // c213：过载需"数量 + 浓度"双条件——4+ 推进且密度≥30/千字，或集中在≤2 行（灌输式独白）。
    // 高潮对质场多 beat 逐句摊牌（4 行 4 牌、密度低）属戏剧递进，不是信息灌输。
    const hitLineCount = new Set(hits.map((h) => h.lineIndex)).size;
    const isOverload = infoCount >= 4 && (density >= 30 || hitLineCount <= 2);
    if (infoCount === 0) type = 'water';
    else if (isOverload) type = 'overload';
    return {
      index: i + 1,
      header: s.header,
      infoCount,
      hits,
      wordCount: wc,
      density,
      type,
    };
  });

  const allHits = scenes.flatMap((s) => s.hits);
  const totalInfoPushes = allHits.length;
  const avgInfoPerScene = total > 0 ? Number((totalInfoPushes / total).toFixed(2)) : 0;
  const waterSceneCount = scenes.filter((s) => s.type === 'water').length;
  const waterRatio = total > 0 ? Number((waterSceneCount / total).toFixed(2)) : 0;
  const overloadSceneCount = scenes.filter((s) => s.type === 'overload').length;

  // 前 1/3 和末 1/3 是否有信息推进
  const firstThirdEnd = Math.max(1, Math.ceil(total / 3));
  const lastThirdStart = Math.max(0, total - firstThirdEnd);
  const firstThirdScenes = scenes.slice(0, firstThirdEnd);
  const lastThirdScenes = scenes.slice(lastThirdStart);
  const hasInfoInFirstThird = firstThirdScenes.some((s) => s.infoCount > 0);
  const hasInfoInLastThird = lastThirdScenes.some((s) => s.infoCount > 0);

  // 信息推进曲线是否渐进上升（前段 < 中段 < 后段，至少非递减）
  const thirdSize = Math.max(1, Math.ceil(total / 3));
  const firstThirdSum = scenes.slice(0, thirdSize).reduce((s, x) => s + x.infoCount, 0);
  const midThirdSum = scenes.slice(thirdSize, thirdSize * 2).reduce((s, x) => s + x.infoCount, 0);
  const lastThirdSum = scenes.slice(thirdSize * 2).reduce((s, x) => s + x.infoCount, 0);
  // 渐进上升：前 <= 中 <= 后（理想是上升，至少非递减）
  // 或中段最高（高潮在中间）也算合理
  const hasRisingProgression = lastThirdSum >= firstThirdSum || midThirdSum >= firstThirdSum;

  const issues: InformationIssue[] = [];
  let penalty = 0;

  // 1. 水戏过多
  if (total >= 3) {
    if (waterRatio > 0.4) {
      issues.push({
        severity: 'high',
        type: 'too_many_water_scenes',
        evidence: lang === 'en'
          ? `${waterSceneCount}/${total} scenes have zero information push (ratio ${Math.round(waterRatio * 100)}%)`
          : `${waterSceneCount}/${total} 场戏信息推进为 0（占比 ${Math.round(waterRatio * 100)}%）`,
        advice: lang === 'en'
          ? 'Each scene must reveal new info: identity/motive/truth/relation/goal/reversal. Cut or merge water scenes'
          : '每场戏必须揭示新信息：身份/动机/真相/关系/目标/反转。删减或合并水戏',
      });
      penalty += 15;
    } else if (waterRatio > 0.25) {
      issues.push({
        severity: 'mid',
        type: 'too_many_water_scenes',
        evidence: lang === 'en'
          ? `${waterSceneCount}/${total} scenes have zero information push (ratio ${Math.round(waterRatio * 100)}%)`
          : `${waterSceneCount}/${total} 场戏信息推进为 0（占比 ${Math.round(waterRatio * 100)}%）`,
        advice: lang === 'en'
          ? 'Reduce water scenes below 25%; each scene should push at least one piece of new info'
          : '水戏占比应低于 25%；每场至少推进一条新信息',
      });
      penalty += 8;
    }
  }

  // 2. 单场水戏（识别每个水戏，至少 15 字才算有效场景）
  for (const s of scenes) {
    if (s.type === 'water' && s.wordCount >= 15) {
      issues.push({
        severity: 'mid',
        type: 'water_scene',
        evidence: lang === 'en'
          ? `Scene ${s.index} "${s.header.slice(0, 30)}" has no information push (${s.wordCount} words)`
          : `场景 ${s.index} "${s.header.slice(0, 30)}" 无信息推进（${s.wordCount} 字）`,
        advice: lang === 'en'
          ? 'Add at least one new info: identity reveal / motive / truth / relation shift / goal change'
          : '加入至少一条新信息：身份揭示/动机/真相/关系变化/目标转向',
      });
      penalty += 5;
    }
  }

  // 3. 信息过载场景
  for (const s of scenes) {
    if (s.type === 'overload') {
      issues.push({
        severity: 'mid',
        type: 'info_overload',
        evidence: lang === 'en'
          ? `Scene ${s.index} has ${s.infoCount} info pushes (overload)`
          : `场景 ${s.index} 有 ${s.infoCount} 条信息推进（过载）`,
        advice: lang === 'en'
          ? 'Split overloaded scene into 2 scenes; audience cannot digest 4+ info pushes at once'
          : '将过载场景拆分为 2 场；观众一次消化不了 4+ 条信息推进',
      });
      penalty += 3;
    }
  }

  // 4. 前 1/3 无信息推进
  if (total >= 3 && !hasInfoInFirstThird) {
    issues.push({
      severity: 'high',
      type: 'no_info_in_hook_zone',
      evidence: lang === 'en'
        ? 'First 1/3 of scenes have zero information push — hook zone is empty'
        : '前 1/3 场景无信息推进——钩子区空白',
      advice: lang === 'en'
        ? 'Open with a revelation: identity/motive/truth in scene 1-2 to hook viewers'
        : '开场即揭示：身份/动机/真相在前 1-2 场出现以钩住观众',
    });
    penalty += 10;
  }

  // 5. 末 1/3 无信息推进
  if (total >= 3 && !hasInfoInLastThird) {
    issues.push({
      severity: 'high',
      type: 'no_info_in_climax_zone',
      evidence: lang === 'en'
        ? 'Last 1/3 of scenes have zero information push — climax zone is empty'
        : '末 1/3 场景无信息推进——高潮区空白',
      advice: lang === 'en'
        ? 'Place the biggest revelation in the last 1-2 scenes: identity/truth/reversal'
        : '把最大揭示放在最后 1-2 场：身份/真相/反转',
    });
    penalty += 10;
  }

  // 6. 信息推进无渐进
  if (total >= 4 && !hasRisingProgression) {
    issues.push({
      severity: 'mid',
      type: 'no_rising_progression',
      evidence: lang === 'en'
        ? `Info distribution: first=${firstThirdSum}, mid=${midThirdSum}, last=${lastThirdSum} (declining)`
        : `信息分布：前 ${firstThirdSum} / 中 ${midThirdSum} / 后 ${lastThirdSum}（递减）`,
      advice: lang === 'en'
        ? 'Front-load small reveals, save big reveals for climax; progression should rise'
        : '前段小揭示，后段大揭示；信息推进应渐进上升',
    });
    penalty += 5;
  }

  // 7. 整体信息推进过少（2 场以上才检查）
  if (total >= 2 && totalInfoPushes < total) {
    issues.push({
      severity: 'mid',
      type: 'low_total_info',
      evidence: lang === 'en'
        ? `Only ${totalInfoPushes} info pushes across ${total} scenes (avg ${avgInfoPerScene}/scene)`
        : `全剧仅 ${totalInfoPushes} 条信息推进，分摊到 ${total} 场（均 ${avgInfoPerScene}/场）`,
      advice: lang === 'en'
        ? 'Target ≥1 info push per scene; add reveals (identity/motive/truth/relation/goal/reversal)'
        : '目标：每场 ≥1 条信息推进；增加揭示（身份/动机/真相/关系/目标/反转）',
    });
    penalty += 8;
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {
    score,
    totalScenes: total,
    totalInfoPushes,
    avgInfoPerScene,
    waterSceneCount,
    waterRatio,
    overloadSceneCount,
    hasInfoInFirstThird,
    hasInfoInLastThird,
    hasRisingProgression,
    scenes,
    allHits,
    issues,
  };
}
