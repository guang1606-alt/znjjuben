import { isSceneHeaderLine } from './script-scenes';
/**
 * 认亲白给 / 血缘速热检测（v2.85 块93，创作能力类）
 * ------------------------------------------------------------------
 * 病象：血缘是短剧最强的钩子，也是被白给得最狠的兑付——二十三年
 *   的寻找，三行内和解，DNA、信物、挣扎全免：
 *     沈知夏：你是我爸爸？
 *     沈父：当年我把你放在福利院门口，我找了你二十三年。
 *     沈知夏（扑上去）：爸——！
 *     （下一场）全家福，其乐融融。
 * 认亲的戏剧价值在于难：真实的相认是漫长的——怀疑、求证、抗拒、
 * 试探、刺痛。零过程的接纳等于把身世当一次性烟花，观众知道这层
 * 关系随时会变、也随时会再白给一次。血缘揭露越重（二十三年/亲子
 * 鉴定级），零挣扎的拥抱越廉价。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - cheap-forgiveness：管"重伤方秒被原谅"（必须有 HARM 重伤前提
 *    的情感账清零），本引擎管"血缘揭露秒被接纳"（认亲零求证零
 *    挣扎）——认亲场景没有加害者，HARM 前提不成立，是独立空白；
 *  - stance-flip：管同一角色死誓立场 ≤10 行内无因反做（决定层），
 *    本引擎管关系身份的零成本接纳（关系层），不碰立场域；
 *  - family-craft：类型技法下发装置（积怨账本/血缘与边界等装置的
 *    机理论述），不检测单稿内认亲事件的摩擦成本；
 *  - unplanted-asset：管后手空降（"幸好我留了 DNA 报告"），本引擎
 *    管揭露后的接纳速度；twist-density 只数反转密度，不判挣没挣来；
 *  - instant-trust：管"初识方秒被托付"（把公章/孩子交给陌生人），
 *    本引擎管"血缘关系秒被认下"——免费渠道家族第四员（免费情报/
 *    免费人力/免费信任/免费亲情）；
 *  - prop-ledger / impersonation-ledger：信物归属与冒充身份的跨集
 *    连续性，不测认亲当场的接纳节拍。
 *
 * 判定：
 *  - 血缘揭露（你是我爸/我是你的生母/失散多年/当年把你抱走/
 *    you're my father/my long-lost daughter/gave you up…）±2 行内
 *    出现零成本接纳动作（扑进怀里/抱住痛哭/喊了声妈/一家人团聚/
 *    hugged/welcome home）→ 构成一次"认亲白给"事件；双条件缺一
 *    不可——揭露后无接纳动作（悬置的认亲钩子）放行，无揭露的
 *    拥抱亲情戏放行；
 *  - rescue：①求证锚（亲子鉴定/DNA 比对/胎记/信物对上/dna test/
 *    birthmark）——血缘有证据链，接纳挣得；揭露行自身带求证
 *    （"DNA 报告出来了，你是我女儿"）也算有据；②挣扎锚（我不信/
 *    怎么证明/让我缓缓/I don't believe it/give me time）出现在
 *    揭露行之外的行——先怀疑再相认，摩擦付过费；揭露行自身的
 *    "不可能"是惊吓反射台词不作数（否则几乎所有认亲戏自带豁免）；
 *  - 场景头行不参与任何词表匹配；rescue 扫描跳过揭露行与接纳行
 *    自身；
 *  - 相邻 ≤2 行的血缘揭露行合并为同一事件（跨场景头不合并）；
 *  - 第 1 次豁免（一次速认是类型片惯例），第 2 次起每次 1 hit；
 *  - 计分（密度病）：n=1 → 70，每多 1 处 −20，封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface InstantKinshipHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有求证锚/挣扎锚（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface InstantKinshipResult {
  score: number;
  /** 认亲白给事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: InstantKinshipHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 血缘揭露：身世的钩子被抛出 */
const REVEAL_ZH = /你是我(?:亲生)?(?:的)?亲?(?:爸|妈妈?|爹|娘|儿子|女儿|闺女|哥|姐|弟|妹)|我是你的?(?:亲生)?(?:爸|妈妈?|爹|娘|生父|生母|儿子|女儿)|(?:失散|离散|走失)[^。！？\n]{0,8}年|亲生的|亲生(?:儿子|女儿|父亲|母亲|爸妈|父母|骨肉|闺女)|我的亲(?:儿子|女儿|闺女)|当年[^。！？\n]{0,6}把(?:你|孩子|女儿|儿子)[^。！？\n]{0,8}(?:丢|送|抱走|遗弃|放|扔)|你是我(?:的)?(?:亲生)?(?:骨肉|血脉)|流着(?:你|我|他|她)的血/;

const REVEAL_EN = /\b(?:you(?:'re| are) my (?:son|daughter|father|mother|dad|mom|brother|sister)|i(?:'m| am) your (?:father|mother|dad|mom|son|daughter|biological (?:father|mother))|my (?:long-?lost|lost) (?:son|daughter|brother|sister|child)|(?:long-?lost|biological) (?:father|mother|son|daughter|brother|sister)|i gave (?:you|him|her) up|left (?:you|him|her) (?:at|in|behind)|put (?:you|him|her) up for adoption|you'?re my (?:blood|own (?:son|daughter))|my own (?:son|daughter))\b/i;

/* 零成本接纳：拥抱/相认/团聚像水龙头一拧就开 */
const GRANT_ZH = /扑(?:进|到|入)[^。！？\n]{0,6}(?:怀里|怀中)|一把抱(?:住|紧)|抱(?:住|紧)(?:了)?(?:他|她|爸|妈|我|你)?|紧紧(?:抱|搂)住|相拥(?:而泣|痛哭|大哭)?|抱头(?:痛哭|大哭)|拥抱(?:着|了)?|(?:父女|母子|母女|父子|兄妹|姐弟|兄弟|姐妹)(?:相认|重逢)|喊了?(?:一声|了声)?(?:爸|妈妈?|爹|娘|哥|姐|弟|妹)(?:啊|呀)?|(?:^|[：:，,])\s*(?:爸|妈妈?|爹|娘|哥|姐|弟|妹)(?:啊|呀)?[—-]*[！!。]?\s*$|我的(?:儿子|女儿|儿|闺女|孩子)(?:啊|呀)?[！!，,。]|(?:一家人|全家)(?:终于)?(?:团聚|团圆)|认(?:祖)?归宗|跟我回家|我们回家|带(?:你|他|她)回家/;

const GRANT_EN = /\b(?:hug(?:s|ged)?|embrac(?:e|ed)|held (?:him|her|me) (?:tight|close)|pulled (?:him|her|me) close|in (?:his|her) arms now)\b|\b(?:father and (?:son|daughter)|mother and (?:son|daughter)) (?:reunited|embraced)\b|\breunion\b|\bwelcome home\b|\bwe'?re family\b|\bcalled (?:him|her) (?:dad|father|mom|mother)\b|\bmy (?:son|daughter|child)\b|(?:^|[：:,.!?])\s*(?:dad|mom|papa)(?:!|\.)?\s*$/i;

/* rescue A：求证锚——血缘有证据链，接纳是挣来的 */
const VERIFY_ZH = /亲子鉴定|鉴定报告|DNA|比对(?:结果)?|血型|胎记|信物|玉佩(?:对上)?|出生证明|查过(?:户籍|出生记录|档案)|长(?:得)?(?:很像|一模一样|像极了)|眉眼像|做(?:过)?鉴定/;

const VERIFY_EN = /\b(?:dna (?:test|report|results?)|paternity (?:test|report)|birthmark|birth certificate|locket|records match|it'?s confirmed|the scar matches|checked the records)\b/i;

/* rescue B：挣扎锚——先怀疑再相认，摩擦付过费 */
const STRUGGLE_ZH = /我不信|我不敢信|不可能|你别骗我|你在骗我|怎么(?:证明|会是你)|凭什么信你|让我缓缓|缓一缓|我需要时间|给我点时间|我不敢认|太突然了|好突然|我还没(?:有)?准备好/;

const STRUGGLE_EN = /\b(?:i don'?t believe (?:it|you)|this is impossible|it can'?t be|how do i know you'?re telling the truth|prove it|give me (?:some )?time|i need time|this is too sudden|i'?m not ready for this|let me catch my breath)\b/i;

/**
 * 纯函数：检测"血缘揭露秒被接纳"的认亲白给密度病。
 */
export function instantKinship(draft: string): InstantKinshipResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const revealRe = zh ? REVEAL_ZH : REVEAL_EN;
  const grantRe = zh ? GRANT_ZH : GRANT_EN;
  const verifyRe = zh ? VERIFY_ZH : VERIFY_EN;
  const struggleRe = zh ? STRUGGLE_ZH : STRUGGLE_EN;

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasR: boolean[] = new Array(rawLines.length).fill(false);
  const hasG: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    hasR[i] = revealRe.test(line);
    hasG[i] = grantRe.test(line);
  });

  /* pass2：血缘揭露行与 ±2 行内的接纳动作配对成事件（相邻 ≤2 行揭露合并） */
  interface Ev { start: number; end: number; marker: string; }
  const events: Ev[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasR[i]) return;
    const m = raw.match(revealRe);
    const marker = (m?.[0] ?? '').slice(0, 28);
    const last = events[events.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i; /* 相邻 ≤2 行的血缘揭露合并为同一事件（跨场景头不合并） */
        return;
      }
    }
    const win = [i - 2, i - 1, i, i + 1, i + 2].filter(
      (j) => j >= 0 && j < rawLines.length && hasG[j],
    );
    if (win.length === 0) return; /* 无接纳动作不构成事件（悬置的认亲钩子放行） */
    events.push({ start: Math.min(i, win[0]), end: i, marker });
  });

  /* pass3：rescue 检测（求证锚/挣扎锚；跳过揭露行与接纳行自身） */
  const hits: InstantKinshipHit[] = [];
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
    if (hitCount < 2) continue; /* 首次豁免（一次速认是类型惯例） */
    /* 揭露行自身带求证（"DNA 报告出来了，你是我女儿"）算有据接纳 */
    let selfVerified = false;
    for (let j = ev.start; j <= ev.end; j += 1) {
      if (hasR[j] && verifyRe.test(rawLines[j])) { selfVerified = true; break; }
    }
    const lo = Math.max(0, ev.start - 2);
    const hi = Math.min(rawLines.length - 1, ev.end + 2);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      if (hasR[j] || hasG[j]) continue; /* 揭露行与接纳行自身不作 rescue 证据 */
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = selfVerified || verifyRe.test(win) || struggleRe.test(win);
    hits.push({
      line: ev.end + 1,
      sceneIndex: sceneOf[ev.end],
      sceneHeader: headerOf[ev.end],
      snippet: rawLines[ev.end].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是"认亲白给"——血缘揭露三行内秒接纳，没有求证、没有挣扎，二十三年的身世像一次性烟花放完了'
        : 'instant kinship again - a life-defining blood reveal is fully accepted within lines, with no verification and no struggle',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"认亲白给"式血缘速热（${n} 处未救）——血缘揭露零求证零挣扎，三行内秒接纳。`
      : `${hitCount} instant-kinship beats (${n} unrescued) - blood reveals are fully accepted with zero verification and zero struggle.`);
    advice.push(zh
      ? '认亲的戏剧价值在于难。给每一次相认补一道来路：要么有求证（DNA 比对要等三天、胎记对上之前她先看了十遍）、要么有抗拒（"你二十三年前在哪儿？"先拒绝再试探）、要么有代价（认下了爸，就要面对抛下她们母女的旧账）。更好用的做法是"认而不亲"——血缘认了，喊不出口：她肯收下那半张照片，却整集叫不出口那声"爸"；这一声的迟到比二十三场寻找戏更让观众揪心。如果剧情就是需要速认，让第三方戳一句"你就不怕认错人？"——替观众把疑问说出口，白给就变成了有意识的冒险。'
      : 'Kinship is only dramatic when it is hard. Give every recognition a pedigree: verification (the DNA match takes three days; she reads the birthmark ten times before she speaks), resistance ("Where were you twenty-three years ago?" - reject first, probe later), or cost (accepting the father means facing the family he walked out on). Better still, let them claim the blood but not the word: she takes the torn photograph yet cannot say "Dad" for the whole episode - that overdue word aches more than twenty-three years of searching. If the plot needs a fast reunion, have a third character ask "Aren\'t you afraid you\'ve got the wrong man?" - voicing the doubt turns a freebie into a conscious gamble.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
