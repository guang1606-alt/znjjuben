import { isSceneHeaderLine } from './script-scenes';
/**
 * 无因馈赠 / 贵人随手给资源检测（v2.128 块136，创作能力类）
 * ------------------------------------------------------------------
 * 病象：陌生人一开口就把关键资源白送——五百万、一套房、一辆车、
 *   一个职位、一个工作室、全部股份、一笔启动资金：
 *     △老板（走过来）：初次见面，这五百万你拿去用。
 *     △老人：我们刚认识，这房子空着也是空着，你住吧。
 *     △局长：我恰好有个职位空缺，你来。
 *     MAN: We just met. Here's a check. Consider it yours.
 *   资源是戏的硬通货：钱、房、车、职位、股份的戏剧价值在于挣得——
 *   共过事、救过命、查过底、付过代价。零过程的馈赠等于把关键资源
 *   当一次性道具——观众不担心主角会不会还、会不会被反悔，因为
 *   编剧连"为什么给你"都懒得问。馈赠越重（巨款/房产/股份），零
 *   过程越廉价。第一次是类型片彩蛋，第三次起贵人就成了编剧的
 *   提款机——主角不再需要挣资源，张张嘴就有。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - help-on-demand：管"主角开口要→对方秒答应"（有求助动作），
 *    本引擎管"对方主动给"（无求助动作）——前者是主角开口的
 *    免费人力，本引擎是对方主动的免费资源；
 *  - instant-trust：管"初识→托付信任"（关系层：把公章/孩子/
 *    命脉交给陌生人），本引擎管"初识→馈赠资源"（事务层：把
 *    钱/房/车/职位给陌生人）——一个管关系层的信任白给，
 *    一个管事务层的馈赠白给；
 *  - cheap-empathy：管倾听方咨询师话术共情（语言层：我理解
 *    你的感受），本引擎管行为层的资源馈赠（事务层：给你一笔钱）
 *    ——一个管语言层假共情，一个管行为层假慷慨；
 *  - cheap-forgiveness：管"重伤→受害者秒原谅"（情感账：伤害
 *    被一句话免单），本引擎管"无因→对方秒馈赠"（事务账：资源
 *    被一句话白给）——一个管情感账清零，一个管事务账白给；
 *  - records-on-demand：管"档案库随查随有"（信息层免费资料），
 *    本引擎管"陌生人随见随给"（物资层免费资源）——一个罚情报
 *    库当许愿池，一个罚贵人当许愿池。
 *
 * "免费渠道"家族第十三员（免费人力/免费信任/免费亲情/免费爱情/
 * 免费悔悟/免费赦免/免费破防/免费武技/免费推理/免费查档/免费
 * 语言/免费逃脱/免费医术之后，免费资源第十三维）。本引擎让位
 * instant-repentance 入池（免费悔悟镜像兄弟退役：悔悟白给 vs
 * 资源白给，结构同构语义同向——都是加害/施予方零成本输出）。
 *
 * 判定（镜像 instant-trust 单型双锚）：
 *  - GIVE 锚（给一笔钱/送套房/给个职位/留套房/送辆车/股份/
 *    遗产/启动资金/一点心意 + here's a check/i'll give you/
 *    take this/consider it yours/you can stay here/i want
 *    you to have this…）与 STRANGER 锚（初次见面/刚认识/萍水
 *    相逢/素不相识/一面之缘/才认识几天 + we just met/first
 *    time we met/stranger to you/barely know each other…）
 *    ±2 行窗口同场景共现 → 构成一次"无因馈赠"事件；双条件缺一
 *    不可——纯 GIVE 无 STRANGER 放行（合法馈赠：故友给的、家人
 *    给的、雇员按合同给的），纯 STRANGER 无 GIVE 放行（初识场景
 *    本身是戏）；
 *  - 相邻 2 行内的 GIVE 表述视为同一次馈赠（"给你一笔钱"→下一行
 *    "先拿去用"），不重复计；跨场景头重置，各算一次馈赠使用；
 *  - 第 1 次豁免（一次巧合馈赠是类型片彩蛋），第 2 次起每次 1 hit；
 *  - rescue（±2 行扫描全窗口，含锚行）：
 *    ① 关系铺垫锚（救过命/恩人之子/故人之子/老朋友的儿子/你父亲
 *       救过我/当年你爸/救命之恩/欠你父亲的 + saved my life/owed
 *       your father/knew your dad/old friend's son…）——馈赠有
 *       来路，恩情报恩、故友之子是合理人情；
 *    ② 交换条件锚（作为交换/有个条件/你帮我/只要你/得有个条件
 *       + in exchange/on one condition/there's a catch/you have
 *       to…）——馈赠有价码，不是白给，是交易；
 *    ③ 拒绝摩擦锚（不能收/太多了/我不敢当/我不能要/无功不受禄
 *       + i can't accept/this is too much/i couldn't/wouldn't
 *       feel right…）——受赠方挣扎过，馈赠没被秒接，写了摩擦；
 *  - 场景头行不参与任何词表匹配（防"初次见面会"类误中）；
 *  - 计分（密度病）：n=0 → 100；n=1 → 70；每多 1 处 −20，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantEndowmentHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（关系铺垫/交换条件/拒绝摩擦，馈赠没白给） */
  rescued: boolean;
  reason: string;
}

export interface InstantEndowmentResult {
  score: number;
  /** 无因馈赠总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantEndowmentHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* GIVE 锚：陌生人主动给关键资源（钱/房/车/职位/股份/遗产/启动资金/心意） */
const GIVE_ZH = /(?:给(?:了|你|他|她)?(?:一)?(?:笔|个|套|辆|份|箱|张|把|包)?(?:钱|股份|工作|职位|房子|住所|车|卡|存折|资源|资金|遗产|期权|工作室|岗位|部门|启动资金|启动费|心意))|(?:这|那)(?:[0-9一二三四五六七八九十百千万两]{1,8})?(?:万|元)?(?:钱|股份|房子|住所|车|卡|存折|资源|资金|遗产|期权)你(?:先|就)?(?:拿着|用|收下|拿去|住|住着|住下)?|(?:这|那)(?:笔钱|套房子|辆车|张卡|个职位|点心意|五百万|一百万|三百万)你(?:先|就)?(?:拿着|用|收下|拿去|住|住着|住下|收下吧)?|(?:留|送|塞|递|掏)给(?:你|他|她)(?:一)?(?:笔|个|套|辆|箱|份|包|张)?(?:钱|股份|工作|职位|房子|住所|车|卡|存折|资源|资金|遗产|期权|心意)?|拿去用|送你(?:一辆|一套|一间)?(?:车|房|公寓)|一点心意你(?:先)?(?:拿着|收下|拿去)?|给你(?:一)?个(?:职位|岗位|工作|机会|工作室)|留给你(?:一)?(?:套|间|个)?(?:房|房子|公寓|住所)/;

const GIVE_EN = /\b(?:here(?:'?s|s|\s+is|\s+are)?\s+(?:a|the|some)\s+(?:check|gift|money|keys?|deposit|token|something)|(?:i'?ll|i\s+will)\s+give\s+you|take\s+this|consider\s+it\s+yours|this\s+is\s+yours|i\s+want\s+you\s+to\s+have\s+(?:this|it|the\s+(?:money|house|car|keys))|take\s+the\s+(?:keys|car|house|money)|you\s+can\s+(?:stay|live|use)\s+(?:here|in\s+the\s+(?:apartment|house))|keep\s+(?:it|the\s+(?:money|keys|car|house))|it'?s\s+yours\s+now|let\s+me\s+(?:cover|pay\s+for|give\s+you)|a\s+(?:gift|token|small\s+something)\s+from\s+me|i'?ll\s+pay|i\s+have\s+an?\s+(?:opening|position|job|spot)\s+for\s+you)\b/i;

/* STRANGER 锚：陌生人语境（初次见面/刚认识/萍水相逢） */
const STRANGER_ZH = /初次见面|初次相识|刚认识(?:一)?天?|才认识(?:一)?天?|萍水相逢|素不相识|素未谋面|一面之缘|头一回见|第一次见|头一次见|初次见到|头一次见面|才见(?:一)?面|才见第一面/;

const STRANGER_EN = /\b(?:we\s+(?:just\s+)?met|just\s+met|we\s+barely\s+know(?:\s+each\s+other)?|complete\s+stranger|first\s+time\s+we'?ve\s+(?:met|seen|spoken)|never\s+(?:met|seen)\s+you\s+before|first\s+time\s+meeting|haven'?t\s+known\s+you\s+(?:long|well)|only\s+just\s+met|i'?m\s+a\s+stranger|am\s+a\s+stranger|stranger\s+to\s+you)\b/i;

/* rescue 三路：① 关系铺垫（馈赠有来路）② 交换条件（馈赠有价码）③ 拒绝摩擦（受赠方挣扎） */
const RESCUE_ZH = /救过(?:我的)?命|恩人之子|故人之子|故友之(?:子|女)|老朋友的儿子|你(?:的)?父亲救过我|当年你(?:爸|父)|救命之恩|欠你(?:父亲|爸爸|家)的|作为交换|有个条件|你帮我(?:做)?(?:个|件事)?|只要你|得有个条件|不能收|太多了|我不敢当|我不能要|这怎么好意思|我不能接受|无功不受禄/;

const RESCUE_EN = /\b(?:saved\s+my\s+life|owe[sd]?\s+(?:your|his|her)\s+(?:father|dad|family)|knew\s+your\s+(?:father|dad|mother|mom)|old\s+friend'?s\s+(?:son|daughter)|in\s+exchange|on\s+one\s+condition|there'?s\s+a\s+catch|you\s+(?:have\s+to|must)\s+(?:do|help|give)|i\s+(?:can'?t|cannot)\s+accept|this\s+is\s+too\s+much|i\s+couldn'?t|wouldn'?t\s+feel\s+right)\b/i;

/**
 * 纯函数：检测"陌生人无因馈赠关键资源"式免费资源白给。
 */
export function instantEndowment(draft: string): InstantEndowmentResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const giveRe = zh ? GIVE_ZH : GIVE_EN;
  const strangerRe = zh ? STRANGER_ZH : STRANGER_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: InstantEndowmentHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevGiveLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevGiveLine = -10; return; }
    const m = line.match(giveRe);
    if (!m) return;
    /* 相邻 2 行内的 GIVE 表述 = 同一次馈赠（"给你一笔钱"→"先拿去用"），不重复计 */
    if (i - prevGiveLine <= 2) { prevGiveLine = i; return; }
    prevGiveLine = i;

    /* STRANGER 检查：±2 行窗口内须出现陌生人语境，纯馈赠无初识放行 */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    const win = rawLines.slice(lo, hi + 1).join('\n');
    if (!strangerRe.test(win)) return;

    hitCount += 1;
    if (hitCount >= 2) {
      hits.push({
        line: i + 1,
        sceneIndex: Math.max(0, sceneIdx),
        sceneHeader: header,
        snippet: line.slice(0, 30),
        marker: (m[0] ?? '').slice(0, 28),
        rescued: rescueRe.test(win),
        reason: zh
          ? '又在用陌生人无因馈赠——一开口就给钱/房/车/职位，关键资源的锁被简化为萍水相逢'
          : 'unprompted gift from a stranger again — money, house, car, or job handed over on first meeting; the lock on critical resources reduced to a chance encounter',
      });
    }
  });

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"无因馈赠"式资源白给（${n} 处未救）——关键资源从陌生人手里零成本漏出。`
      : `${hitCount} unprompted-gift beats (${n} unrescued) — critical resources leak from strangers for free.`);
    advice.push(zh
      ? '陌生人不能当许愿池——真贵人给东西是有理由的：救过你爸的命所以留套房给你、故友之子所以给个职位、欠你人情所以塞笔钱。第一次萍水相逢递张支票是类型片彩蛋，第三次陌生人随手给资源就成了编剧的提款机。让资源贵起来：要么让馈赠有来路（恩人之子/救过命的故人），要么让馈赠有价码（"给你可以，但你得帮我做件事"），要么让受赠方挣扎过（"这怎么好意思收"——拒绝了两句才接下，馈赠没被秒接）。要真有贵人随手给的桥段，让他给的不是关键资源——一杯热茶、一句指引、一个电话号码可以白给，五百万、一套房、一个职位不行。'
      : 'Strangers are not wishing wells — real patrons give for reasons: he saved your father so he leaves you a flat; she is an old friend\'s son so she gives you a job; he owes you a debt so he hands you cash. The first time a stranger offers a check is a genre Easter egg, the third time it happens strangers become the writer\'s ATM. Make resources cost something: give the gift a provenance (savior of your father / old friend\'s son), or give it a price ("I\'ll give it to you, but you must do something for me"), or let the recipient struggle ("I couldn\'t possibly" — refused twice before accepting, the gift isn\'t taken in one beat). If you must have a patron hand things out for free, have them give non-critical resources — a cup of tea, a piece of advice, a phone number can be free; five million, an apartment, a job cannot.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
