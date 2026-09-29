/**
 * 伏笔账本引擎（PRD 2.1.6）
 * 跨集伏笔追踪：扫描正文中植入/回收信号，维护伏笔账本，检测悬空伏笔（种了没收）和空回收（收了没种）。
 *
 * 离线启发式：
 *  - plant   植入信号：暗示、埋下、暗藏、留下、注意到、特写、悄悄、似乎、隐约
 *  - payoff  回收信号：原来、难怪、真相、揭晓、应验、果然、其实、真相大白
 *  - 器物锚点：信件、遗嘱、照片、玉佩、项链、日记、手机、录音
 *
 * 用法：
 *   1. 生成第N集后调用 foreshadowLedger(draft, prevLedger?) 获取本集账本
 *   2. prevLedger 从前集结果累积，用于检测悬空伏笔
 *  3. 返回 plant/paid/dangling/emptyPayoff 四类条目
 */

export interface ForeshadowItem {
  type: 'plant' | 'payoff';
  /** 在正文中匹配到的关键短语 */
  signal: string;
  /** 信号类别：暗示/揭示/器物/对话/动作 */
  category: 'hint' | 'reveal' | 'object' | 'dialogue' | 'action';
  /** 所在行号（近似） */
  lineNo: number;
  /** 原文片段（前后30字） */
  snippet: string;
}

export interface ForeshadowLedgerResult {
  /** 本集新植入的伏笔 */
  plants: ForeshadowItem[];
  /** 本集回收的伏笔 */
  payoffs: ForeshadowItem[];
  /** 悬空伏笔：前集植入但本集及之前均未回收 */
  dangling: { signal: string; plantedInEp: number; ageEp: number; snippet: string }[];
  /** 空回收：本集有回收信号但之前无对应植入 */
  emptyPayoff: ForeshadowItem[];
  /** 伏笔健康度 0-100：回收率越高越健康，悬空扣分 */
  score: number;
  /** 问题列表 */
  issues: { severity: 'high' | 'mid' | 'low'; type: string; advice: string }[];
}

// 植入信号词
const PLANT_SIGNALS = [
  // 暗示类
  /暗示/g, /埋下/g, /暗藏/g, /隐约/g, /似乎(?!.*其实)/g, /悄悄/g, /不动声色/g,
  // 器物锚点
  /信件/g, /遗嘱/g, /照片/g, /玉佩/g, /项链/g, /日记/g, /录音/g, /手机(?!.*(打|接|挂))/g, /文件/g, /合同/g,
  // 对话暗示
  /欲言又止/g, /话到嘴边/g, /没有说完/g, /欲知/g, /且听/g,
  // 动作暗示
  /特写/g, /注意到/g, /瞥了/g, /皱眉/g, /若有所思/g, /意味深长/g,
];

// 回收信号词
const PAYOFF_SIGNALS = [
  /原来/g, /难怪/g, /真相(?!大白)/g, /真相大白/g, /揭晓/g, /应验/g, /果然/g,
  /其实/g, /事实上/g, /谁知道/g, /谁料/g, /岂料/g, /没想到/g,
  /答案/g, /水落石出/g, /浮出水面/g, /原委/g,
];

// 器物关键词（用于匹配 plant 和 payoff 的对应关系）
const OBJECT_KEYWORDS = ['信件', '遗嘱', '照片', '玉佩', '项链', '日记', '录音', '文件', '合同', '手机'];

/**
 * 扫描正文，提取伏笔植入/回收信号
 */
export function foreshadowLedger(
  text: string,
  prevLedger?: { plants: ForeshadowItem[]; payoffs: ForeshadowItem[]; epNo: number } | null,
): ForeshadowLedgerResult {
  const lines = text.split('\n');
  const plants: ForeshadowItem[] = [];
  const payoffs: ForeshadowItem[] = [];

  // 扫描植入
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sig of PLANT_SIGNALS) {
      const matches = line.matchAll(sig);
      for (const m of matches) {
        if (!m.index) continue;
        const start = Math.max(0, m.index - 15);
        const snippet = line.slice(start, Math.min(line.length, m.index + 30));
        const category: ForeshadowItem['category'] = OBJECT_KEYWORDS.some((k) => m![0].includes(k)) ? 'object'
          : /暗示|隐约|似乎|悄悄|不动声色/.test(m[0]) ? 'hint'
          : /欲言|话到|没有说|欲知|且听/.test(m[0]) ? 'dialogue'
          : /特写|注意到|瞥|皱眉|若有所思|意味深长/.test(m[0]) ? 'action'
          : 'reveal';
        plants.push({ type: 'plant', signal: m[0], category, lineNo: i + 1, snippet });
      }
    }
  }

  // 扫描回收
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sig of PAYOFF_SIGNALS) {
      const matches = line.matchAll(sig);
      for (const m of matches) {
        if (!m.index) continue;
        const start = Math.max(0, m.index - 15);
        const snippet = line.slice(start, Math.min(line.length, m.index + 30));
        payoffs.push({ type: 'payoff', signal: m[0], category: 'reveal', lineNo: i + 1, snippet });
      }
    }
  }

  // 悬空伏笔：前集植入但从未回收
  const dangling: ForeshadowLedgerResult['dangling'] = [];
  if (prevLedger && prevLedger.plants.length > 0) {
    // 提取前集植入的器物关键词
    const prevPlantObjects = prevLedger.plants
      .filter((p) => p.category === 'object')
      .map((p) => ({ kw: OBJECT_KEYWORDS.find((k) => p.signal.includes(k)), item: p }))
      .filter((x) => x.kw);

    // 当前集和前集之前的回收中是否出现了该器物
    const allPayoffText = payoffs.map((p) => p.snippet).join('') + prevLedger.payoffs.map((p) => p.snippet).join('');

    for (const { kw, item } of prevPlantObjects) {
      if (kw && !allPayoffText.includes(kw)) {
        // 检查本集是否有对应回收
        const hasPayoffInThis = payoffs.some((p) => p.snippet.includes(kw) || p.signal.includes(kw));
        if (!hasPayoffInThis) {
          dangling.push({
            signal: item.signal,
            plantedInEp: prevLedger.epNo,
            ageEp: 1, // 至少悬空1集
            snippet: item.snippet,
          });
        }
      }
    }

    // 通用植入信号（非器物）的悬空检测：如果前集有"暗示/暗藏/埋下"但本集无"原来/真相/揭晓"
    const hasGenericPlant = prevLedger.plants.some((p) => p.category === 'hint');
    const hasGenericPayoff = payoffs.length > 0 || prevLedger.payoffs.length > 0;
    if (hasGenericPlant && !hasGenericPayoff) {
      // 只在有前集暗示但本集和之前都没有任何回收时报 mid 级
      const oldHints = prevLedger.plants.filter((p) => p.category === 'hint');
      for (const h of oldHints) {
        dangling.push({
          signal: h.signal,
          plantedInEp: prevLedger.epNo,
          ageEp: 1,
          snippet: h.snippet,
        });
      }
    }
  }

  // 空回收：本集有回收信号但无对应植入
  const emptyPayoff: ForeshadowItem[] = [];
  if (!prevLedger || prevLedger.plants.length === 0) {
    // 如果没有任何前集植入，本集的"原来/真相"可能是空回收
    for (const p of payoffs) {
      // 但排除首集自然揭示（首集允许揭示角色背景）
      if (!plants.some((pl) => pl.snippet.includes(p.snippet.slice(0, 5)))) {
        emptyPayoff.push(p);
      }
    }
  }

  // 计算健康度
  const totalPlants = plants.length + (prevLedger?.plants.length ?? 0);
  const totalPayoffs = payoffs.length + (prevLedger?.payoffs.length ?? 0);
  const resolvedRate = totalPlants > 0 ? Math.min(1, totalPayoffs / totalPlants) : 1;
  const danglingPenalty = Math.min(0.5, dangling.length * 0.15);
  const emptyPenalty = Math.min(0.2, emptyPayoff.length * 0.1);
  const score = Math.round(Math.max(0, Math.min(100, (resolvedRate * 100) * (1 - danglingPenalty - emptyPenalty))));

  // 问题列表
  const issues: ForeshadowLedgerResult['issues'] = [];
  if (dangling.length >= 2) {
    issues.push({
      severity: 'high',
      type: 'dangling_foreshadow',
      advice: `${dangling.length}个伏笔种了没收（${dangling.map((d) => d.signal).join('、')}），需要在后续集数中回收，否则观众会觉得挖坑不填`,
    });
  } else if (dangling.length === 1) {
    issues.push({
      severity: 'mid',
      type: 'dangling_foreshadow',
      advice: `1个悬空伏笔（${dangling[0].signal}），注意后续回收`,
    });
  }
  if (emptyPayoff.length >= 2) {
    issues.push({
      severity: 'mid',
      type: 'empty_payoff',
      advice: `${emptyPayoff.length}处回收信号但无对应植入，"原来/真相"等词用得太随意会显得生硬`,
    });
  }
  if (plants.length === 0 && payoffs.length === 0 && prevLedger) {
    issues.push({
      severity: 'mid',
      type: 'no_foreshadow',
      advice: '本集既无伏笔植入也无回收，连续剧需要跨集线索串联',
    });
  }

  return { plants, payoffs, dangling, emptyPayoff, score, issues };
}
