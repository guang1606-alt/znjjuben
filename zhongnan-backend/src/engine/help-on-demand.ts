import { isSceneHeaderLine } from './script-scenes';
/**
 * 随叫随到工具人检测（v2.82 块90，创作能力类）
 * ------------------------------------------------------------------
 * 病象：主角的资源获取零摩擦——开口求助，对方无条件秒答应：
 *   陆沉：我需要你帮我查一个人。
 *   老周：没问题，包在我身上。
 *   苏黎：能不能帮我混进拍卖行？
 *   阿凯：小事一桩，今晚就办。
 * 第一次是人情，第二次起"万能朋友"就成了编剧的提款机：求助
 * 无成本、帮忙无难处、专家无报价。帮忙的戏剧价值在于代价——
 * 朋友有朋友的难处，专业人士有专业报价，就算答应，也要让主角
 * 付出人情、筹码或等一个期限。零摩擦的援兵越多，主角越不像
 * 在孤军奋战，观众也就越不替他揪心。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - records-on-demand：管"档案/监控/记录"随查随有（免费资料），
 *    本引擎管人力/技能随叫随到（免费行动）；
 *  - eavesdrop-dump / phone-relay / drunk-truth / villain-
 *    overconfession：其他免费情报渠道（信息泄露），本引擎是
 *    免费人力渠道（应允行动）；
 *  - causal-logic-check：管"正发愁谁来救，救兵就出现了"的巧合
 *    空降（无人求助），本引擎收"主角开口要、对方白给"的零摩擦
 *    应允（有求助动作）；
 *  - plot-armor：管危险时刻的物理放水，不管日常求助；
 *  - cheap-forgiveness：管情感原谅，不管事务性帮忙。
 *
 * 判定：
 *  - 求助锚点（帮个忙/帮我/求你/我需要你/能不能帮/ask a favor/
 *    need your help…）命中后 ≤3 行、同场之内出现应允锚点
 *    （没问题/包在我身上/小事一桩/交给我就行/no problem/
 *    consider it done…）→ 构成一次"白给"事件；
 *  - rescue：窗口内有代价/为难信号（什么好处/多少钱/得想想/
 *    难办/in exchange/let me think）或明确拒绝（帮不了/
 *    无能为力/can't help）——帮忙有成本，放行；
 *  - 职责豁免：雇佣/本职语境（这是你的工作/收了钱/拿工资办事/
 *    that's your job/I'm paid to）——布置任务不是求人白给；
 *  - 相邻求助行视为同一次开口（"帮帮我"+"求你了"），求助与
 *    应允跨场不算（应允须在同场）；一次应允只结算一次事件；
 *  - 第 1 次豁免（一次朋友相助是人之常情），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface HelpOnDemandHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有代价/拒绝/职责豁免（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface HelpOnDemandResult {
  score: number;
  /** 白给事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: HelpOnDemandHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 求助锚点：开口要资源/要行动 */
const ASK_ZH = /帮(?:个)?(?:忙|助)|帮我|帮帮我|求你(?:了)?|拜托(?:你|了)?|我需要(?:你|有人|帮手|人手)|能不能(?:帮我|帮)|可以帮(?:我)?(?:吗|么)|求(?:助于|人)|托你(?:去|办)|只能靠你(?:了)?|非你不可/;

const ASK_EN = /\b(?:do me a favor|ask(?:ing)? (?:you|him|her) for (?:help|a favor)|need (?:your|his|her) help|need a favor|need someone to|could you (?:help|get|find)|can you (?:help|get|find)|help me (?:out|with)|beg(?:ging)? you|please help|you'?re my only (?:hope|chance))\b/i;

/* 应允锚点：无摩擦答应 */
const GRANT_ZH = /没问题|包在(?:我|我们)身上|交给(?:我|我们)|交给我|小事一桩|小意思|一言为定|就(?:这么|这)定了|我(?:去|来)(?:办|搞定|解决|弄)|保证(?:办到|办好|完成|搞定)|这事(?:包|算)我(?:身上|上)|明天就(?:办|去)|今晚就(?:办|去)|立马(?:去|办|安排)|马上给你(?:办|弄)/;

const GRANT_EN = /\b(?:no problem|consider it done|leave it to (?:me|us)|i'?m on it|say no more|done deal|you got it|count on me|i'?ll (?:handle|take care of) it|easy(?: one)?)\b/i;

/* rescue：代价/为难/拒绝——帮忙有成本，放行 */
const RESCUE_ZH = /(?:什么)?(?:交换)?条件|报答|好处费?|收(?:费|钱)|多少钱|帮不了|无能为力|做不到|爱莫能助|让我(?:考虑|想想)|这(?:个|事)?(?:很)?难办|得(?:想想|研究|筹备)|可?不(?:是|能)白(?:干|帮)|没那么简单|没那么容易|得花(?:点|些)|要(?:等|排队|托关系)/;

const RESCUE_EN = /\b(?:in exchange|what'?s in it for me|for a price|not free|can'?t help (?:you|with)|no can do|i can'?t do that|let me think|it'?s complicated|need something first|not that (?:simple|easy)|take some time|might take a while|pull some strings)\b/i;

/* 职责豁免：雇佣/本职——布置任务不是求人白给 */
const JOB_ZH = /(?:这|那)(?:是|可是)(?:你|我)(?:的)?(?:工作|职责|本分|任务)|职责所在|分内之事|收了钱|按合同|拿(?:钱|工资|薪水)(?:办事)?|你(?:就是|是)干这行的|雇(?:你|了)你|你是(?:我)?(?:请|雇)(?:来|的)/;

const JOB_EN = /\b(?:that'?s|that is) (?:your|my) job|it'?s (?:my|your) job|i'?m paid to|on the clock|doing my job|part of the (?:job|service)|you'?re the expert here|it'?s what i do\b/i;

/**
 * 纯函数：检测"求助零摩擦、援兵随叫随到"的工具人密度病。
 */
export function helpOnDemand(draft: string): HelpOnDemandResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const askRe = zh ? ASK_ZH : ASK_EN;
  const grantRe = zh ? GRANT_ZH : GRANT_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;
  const jobRe = zh ? JOB_ZH : JOB_EN;

  const hits: HelpOnDemandHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let pendingAskLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; pendingAskLine = -10; return; }

    /* 应允锚点：与最近求助 ≤3 行且同场 → 结算一次事件 */
    if (pendingAskLine >= 0 && i - pendingAskLine <= 3 && grantRe.test(line)) {
      const lo = pendingAskLine;
      const win = rawLines.slice(lo, i + 1).filter((l) => !isSceneHeaderLine(l.trim())).join('\n');
      const rescued = rescueRe.test(win) || jobRe.test(win);
      const m = line.match(grantRe);
      hitCount += 1;
      if (hitCount >= 2) {
        hits.push({
          line: i + 1,
          sceneIndex: Math.max(0, sceneIdx),
          sceneHeader: header,
          snippet: line.slice(0, 30),
          marker: (m?.[0] ?? '').slice(0, 28),
          rescued,
          reason: zh
            ? '又是"随叫随到"——开口就有人无条件白给，帮忙零成本零难处，援兵成了编剧的提款机'
            : 'help on demand again — the ask is met with an instant, unconditional yes; allies are ATM machines with no cost, no friction, no lives of their own',
        });
      }
      pendingAskLine = -10; /* 一次应允只结算一次事件 */
      return;
    }

    if (askRe.test(line)) pendingAskLine = i;
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"求助秒答应"式零摩擦援兵（${n} 处未救）——帮忙没有代价，主角的资源获取全靠编剧开绿灯。`
      : `${hitCount} instant-ally beats (${n} unrescued) — every ask is met with a free yes; resources arrive with zero cost or friction.`);
    advice.push(zh
      ? '帮忙的戏剧价值在于代价。给每一次援兵设一道门槛：朋友有朋友的难处（"这次真不行，上回帮你我差点丢了执照"），专业人士有报价（"这价钱，我只帮你查到门牌"），就算答应了也要挂上人情债或时间账（"三天，就三天"）。更好用的做法是让帮忙本身制造新麻烦——老周答应得痛快，但他查到的东西把主角拖进了更大的坑。援兵可以出现，但不能是随叫随到的自动售货机：观众揪的正是"他还能不能撑到下一援"这口气。'
      : 'A favor is only dramatic if it costs something. Put a toll on every rescue: friends have their own limits ("Not this time - last favor nearly cost me my license"), professionals have rates ("For that price, I can get you the street name, nothing more"), and even a yes should carry a debt or a deadline ("Three days. That\'s all you get."). Better still, let the favor breed new trouble - Zhou agrees instantly, but what he digs up drags the hero deeper. Allies may appear, but never as vending machines: the audience grips precisely because the next helping hand might not come.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
