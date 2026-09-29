import { isSceneHeaderLine } from './script-scenes';
/**
 * 初见托付 / 信任白给检测（v2.84 块92，创作能力类）
 * ------------------------------------------------------------------
 * 病象：信任像水龙头，一拧就开——初次见面（或才认识几天）就把
 *   公章、账本、孩子、密码、全部身家托付给陌生人：
 *     周莹：我们才认识三天，你就把公章全交给你了？
 *     陈总：李姐第一次来，账本就交给你保管吧。
 *     MARK: We met an hour ago and you're handing me the keys?
 * 信任的戏剧价值在于挣得：共过事、救过命、查过底、付过代价。
 * 零过程的托付等于把人物关系当一次性道具——观众不担心托付对象
 * 会不会背叛，因为编剧连"为什么要信他"都懒得问。托付越重
 * （孩子/命脉/全部身家），零过程越廉价。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - cheap-forgiveness：管"伤害方秒被原谅"（重伤前提下的情感账
 *    清零），本引擎管"初识方秒被托付"（信任建立零过程）；
 *  - cheap-empathy：管倾听方咨询师腔共情话术（回应层），本引擎
 *    管行为层的信任托付（关系结构层）；
 *  - help-on-demand：管求助白给（开口要→对方白给行动），本引擎
 *    管信任白给（初见面→对方白给信任）——免费渠道家族第三员；
 *  - relationship-ledger / alliance-ledger：跨集情感/联盟状态翻转
 *    连续性，不测单集内信任建立的摩擦成本；
 *  - item-ownership-ledger：管信物归属权跨集连续性，不测归属
 *    转移发生的信任前提；
 *  - betrayal-ledger：管信任破裂后的连续性，本引擎管破裂前
 *    信任建立是否白给。
 *
 * 判定：
 *  - 初见信号（初次见面/才认识/刚认识/不熟/素不相识/we just met/
 *    we barely know each other/complete stranger…）与托付锚点
 *    （托付/交给你/性命相托/把后背交给你/交个底/告诉你一个秘密/
 *    trust you with/keep this between us/i leave everything to
 *    you…）同句或 ±2 行共现 → 构成一次"信任白给"事件；
 *  - rescue：窗口内有信任建立过程（救过命/过命交情/共事多年/
 *    背调/担保/saved my life/known each other for years/
 *    background check）或托付被拒（我不能收/不敢接/i can't
 *    accept this）——信任有来路或有摩擦，放行；
 *  - 场景头行不参与任何词表匹配（防"初次见面会"类误中）；
 *  - 相邻 ≤2 行的托付行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次速热是类型片惯例），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantTrustHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有信任建立过程/拒绝摩擦（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantTrustResult {
  score: number;
  /** 信任白给事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantTrustHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 初见信号：信任建立零过程 */
const FIRST_ZH = /初次见面|第一次见面|第一次见|头一回见|才认识|刚认识|刚见面|素不相识|一面之缘|不熟|没什么交情|还不知道你叫什么|连(?:你|他|她)姓(?:什|啥)么都不知道|什么底细都不知道|今天刚(?:来|到|入职)/;

const FIRST_EN = /\b(?:we (?:just )?met (?:an hour|two days|three days|a week|yesterday|recently)|we just met|first time (?:we|i) (?:met|saw)|we barely know (?:each other|you|him|her)|i hardly know (?:you|him|her)|a (?:total|complete) stranger|who are you again|we'?re not exactly (?:close|friends)|you'?re a stranger to me)\b/i;

/* 托付锚点：信任像水龙头一拧就开 */
const ENTRUST_ZH = /托付|交给你|性命相托|把后背交给你|交个底|(?:告诉|跟你说)个秘密|告诉你一个秘密|全(?:都)?交给你|就靠你了|交给你保管|交给你照顾|账本交给你|公章交给你/;

const ENTRUST_EN = /\b(?:i'?ll trust you with|trust you with (?:this|my|the)|keep this between us|here(?:'s| is) the key|watch my back|i(?:'m| am) entrusting (?:this|you|everything)|confide in you|tell(?:ing)? you a secret|my life is in your hands|it'?s all yours now|i leave (?:it|this|everything|my) (?:to|with|in)|take care of (?:my|the) (?:daughter|son|kid)|in your hands now)\b/i;

/* rescue：信任建立过程——信任有来路，放行 */
const BUILD_ZH = /救过.{0,4}命|过命交情|生死之交|出生入死|共事(?:多|几|十|二|三|五)年|认识(?:多|几|十|二|三|五|二十)年|合作(?:多|几|三|五|十)年|跟了.{0,3}(?:多|几|十)年|背调|查过.{0,4}(?:底细|背景)|作保|担保人?|引荐/;

const BUILD_EN = /\b(?:saved (?:my|his|her|your) life|known (?:him|her|you|each other) for years|background check|did my homework on|vouched for|been through (?:a lot|war|hell) together|worked together for years|trusted (?:him|her) for (?:years|a decade)|old (?:friend|army buddy)|lifelong)\b/i;

/* rescue：拒绝摩擦——托付被推回来，放行 */
const REFUSE_ZH = /我不能收|我们不能收|不敢收|不敢接|还不熟,?我不能|这种事我做不到|没法收|收不得/;

const REFUSE_EN = /\b(?:i can'?t accept (?:this|that)|i won'?t take (?:this|that)|i can'?t take (?:this|that)|too soon for this|this is too much,? we just met)\b/i;

/**
 * 纯函数：检测"初见面就托付命脉"的信任白给密度病。
 */
export function instantTrust(draft: string): InstantTrustResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const firstRe = zh ? FIRST_ZH : FIRST_EN;
  const entrustRe = zh ? ENTRUST_ZH : ENTRUST_EN;
  const buildRe = zh ? BUILD_ZH : BUILD_EN;
  const refuseRe = zh ? REFUSE_ZH : REFUSE_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasF: boolean[] = new Array(rawLines.length).fill(false);
  const hasE: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasF[i] = firstRe.test(line);
    hasE[i] = entrustRe.test(line);
  });

  /* pass2：托付行与 ±2 行内的初见信号配对成事件（相邻 ≤2 行托付合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasE[i]) return;
    const m = rawLines[i].match(entrustRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的托付合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasF[j],
    );
    if (win.length === 0) return; /* 无初见信号不构成事件 */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（信任建立过程/拒绝摩擦；跳过托付行自身） */
  const hits: InstantTrustHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次速热是类型惯例） */
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasE[j]) continue; /* 托付行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = buildRe.test(win) || refuseRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"初见托付"——见面没多久就把秘密/命脉交给陌生人，信任建立零过程，白给的关系撑不起背叛的分量'
        : 'instant trust again - a near-stranger is handed secrets or lifelines with zero relationship-building; unearned trust cheapens every betrayal it sets up',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"初见托付"式信任白给（${n} 处未救）——信任建立零过程，命脉/秘密/孩子的托付像水龙头一拧就开。`
      : `${hitCount} instant-trust beats (${n} unrescued) - trust is handed to near-strangers with zero relationship-building behind it.`);
    advice.push(zh
      ? '信任的戏剧价值在于挣得。给每一次托付补一道来路：要么有历史（"跟了我八年，账本才敢放你那"），要么有验证（"我查过你的底，三年的账一分不差"），要么有代价（"我拿我闺女的名声给你作保"）。更好用的做法是让托付本身带犹豫——陈总把账本推过去又拿回来一次，才第三次真的松手；这个反复比托付本身更让观众记住"他其实也不确定"。如果剧情就是需要速热搭档，让第三方质疑一句"你们认识才几天？"——替观众把疑问说出口，白给就变成了有意识的冒险。'
      : 'Trust is only dramatic when it is earned. Give every handoff a pedigree: history ("Eight years running my books - that\'s why you get the ledger"), verification ("I pulled your file. Three years, not a cent off"), or collateral ("My daughter\'s name is on the line for you"). Better still, let the handoff hesitate - Chen pushes the ledger across, pulls it back once, and only on the third try lets go; that waver tells the audience more than the trust itself. If the plot needs fast partners, have a third character ask "You\'ve known him a week?" - voicing the doubt turns a freebie into a conscious gamble.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
