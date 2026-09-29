import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 廉价原谅 / 无成本和解检测（Cheap Forgiveness）
 * ============================================================
 * 治什么病：
 *   冲突是观众攒了一整集的火气，兑付方式有两种：让加害者付代价
 *   （伏法/赔偿/自首/长年弥补），或者让受害者在拒绝之后重新挣回
 *   原谅。AI 最爱写第三种——加害者一句"我也是一时糊涂"，受害者
 *   一句"算了，都过去了"，旁边人再补一句"他毕竟是你爸"，三行
 *   之内血海深仇一键清零：
 *     沈知夏：当年是你害死我妈的！
 *     沈建国（跪下）：爸一时糊涂，你就原谅爸吧。
 *     沈知夏（哭着点头）：……爸，我们回家。
 *   人命、冤狱、出卖、抛弃的账，一句话就免了——观众的火气没有
 *   兑付，只收到一纸退款通知。
 *
 * 判定（先立重伤，再抓赦免）：
 *   1) HARM：赦免点之前 120 行内有"重伤"信号（背叛/陷害/冤狱/
 *      害死人命/卖孩子/家暴/出轨卷款/抛妻弃子/扫地出门…），
 *      分 grave（人命/冤狱/骨肉/暴力，道歉赎不回）与 heavy（其余
 *      原则性伤害）；无重伤前提的"对不起/没关系"日常客气放行。
 *
 *   2) 赦免点（三种）：
 *      - grant：明示原谅（我原谅你/算了都过去了/翻篇/I forgive you）；
 *      - accept：身体或名分回归（抱住/握手点头/喊爸妈/一起回家），
 *        且前 6 行内有道歉、借口或旁人施压，防日常拥抱误伤；
 *      - coerce：旁人施压（他毕竟是你爸/血浓于水/孩子不能没有爸），
 *        需 3 行内出现 accept 才成立——施压了但受害者走开不算和解。
 *
 *   3) 代价核验窗口 [f-14, f+3]：
 *      - consequence：自首/报警/警察带走/判刑/净身出户/全数退还/
 *        放弃继承/公开认罪 → 任何伤害等级均豁免；
 *      - self_liberation："我不是原谅你，我是放过我自己"式表达
 *        → 任何等级均豁免（那是受害者的自救，不是给加害者的免单）；
 *      - grave 仅靠具体、不找借口的道歉？不豁免——人命冤狱不能靠
 *        一句 sorry 兑付；还需 time（多年后+道歉）或 earned
 *        （先拒、间隔≥8行、之后有实际代价）；
 *      - heavy 在不找借口、说清具体罪行的道歉后原谅 → 合法和解；
 *        借口式道歉（一时糊涂/我也是没办法/为了这个家）阻断豁免。
 *
 * 廉价加压项（不改变豁免，只加重扣分与证据）：
 *   excuse 加害者借口式道歉 / pressure 旁人按头 / instant 仅有的
 *   道歉距赦免≤2行且之前无任何代价节拍。
 *
 * 边界（查重后确认）：
 *  - relationship-progression-check：恋爱递进经济（心动→阻碍→升级），
 *    不管"重伤→原谅"的代价；
 *  - emotional-aftermath-check：强情绪事件后的情绪余波（秒清零），
 *    不管关系和解的价格；
 *  - misunderstanding-drag-check：误会"拖太久"，且明示"一场误会
 *    一场解"放行——本引擎只管真实重伤被一次性赦免（"我错怪你了"
 *    不入赦免信号）；
 *  - payoff-rhythm/humiliation-ledger：当众受辱的同场加倍兑付，
 *    是复仇线 IOUs；本引擎管私人和解，不要求同场同众。
 *
 * 计分：100 起，每未豁免 hit：heavy −35 / grave −45，
 * excuse +10 / pressure +10，floor 20。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^([一-鿿A-Za-z0-9·]{1,4})(?:（[^）]{0,12}）)?\s*[：:]\s*(.+)$/;
const SPEAKER_EN_RE = /^([A-Z][A-Z .'’-]{0,18}?)(?:\s*\([^)]{0,20}\))?\s*:\s*(.+)$/;

const snippet = (s: string, n = 40): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/* ───────── 1) 重伤 ───────── */

const HARM_ZH = /(?:背叛|出卖|栽赃(?:嫁祸)?|陷害|嫁祸|冤枉(?:了)?(?:我|他|她|你)?|做(?:了)?(?:个)?局害|设局害|害(?:了|得)?(?:我|他|她|你)?(?:坐牢|蹲监狱|蹲大牢|进监狱|进看守所)|把(?:我|他|她|你)(?:送|弄)进(?:了)?(?:监狱|大牢|看守所)|让(?:我|他|她|你)(?:替[^。！？\n]{0,4})?(?:背黑锅|顶罪)|背(?:了)?黑锅|害死|逼死|见死不救|眼睁睁(?:地)?(?:看着|瞧着)|拔了?氧气管|拔管|弄(?:没|掉)(?:了)?(?:孩子|娃|胎儿)|(?:害|导致)(?:她|他|我|你)?(?:流产|小产)|赶(?:我|他|她|你)?(?:出|走)(?:了)?(?:家门|公司|家)|扫地出门|(?:抛弃|丢下|扔下)(?:了)?(?:我|他|她|你|孩子|女儿|儿子|家庭|母女|父子)|抛妻(?:弃子)?|出轨|搞外遇|在外面(?:有人|养)|卷走(?:了)?(?:公司|项目|账上|家里|集团)?(?:所有|全部)?(?:的)?(?:钱|家产|资产|公款|资金|积蓄)|挪用(?:了)?(?:公款|资金|公司的?钱)|吞(?:了|下)?(?:家产|遗产|公司)|夺(?:走|了)(?:家产|公司|一切|继承权)|伪造(?:遗嘱|证据)|逼(?:我|他|她|你)(?:签字|离婚|打胎|辍学)|打(?:断|残|伤)|家暴|虐待|卖(?:了|掉)?(?:女儿|儿子|孩子|媳妇)|毁(?:了)?(?:我|他|她|你)(?:一辈子|一生|半辈子|三年|五年|人生|名声|前途|这个家)|身败名裂|家破人亡|赶尽杀绝|让(?:我|他|她|你)(?:一无所有|流落街头))/;
const HARM_EN = /\b(?:betrayed|sold (?:me|him|her|us|you) out|set (?:me|him|her|you) up|framed(?: me| him| her| you)?|wrongfully(?: imprisoned| convicted)?|put (?:me|him|her|you) (?:in(?:to)?|behind) (?:jail|prison|bars)|behind bars|took the fall(?: for)?|took the blame|killed (?:my|your|his|her|their)?\s?(?:mother|father|brother|sister|son|daughter|wife|husband|family|child|parents)|murdered|caused (?:his|her|the|their) death|drove (?:her|him|them) to (?:death|suicide|an early grave)|let (?:her|him|them) die|left (?:her|him|them) to die|watched (?:her|him|them) die|pulled the plug|lost the baby because|forced (?:her|him) (?:into )?(?:an )?abortion|kicked (?:me|him|her|you) out(?: of the (?:house|family|home|company))?|disowned(?: me| him| her)?|abandoned|walked out on|left (?:me|him|her|us) (?:with nothing|alone|pregnant)|cheated on|had an affair|ran off with|embezzled|stole (?:the|all (?:the|our) )?money|made off with|took (?:everything|the company|the inheritance|everything (?:she|he) had)|forged (?:the will|the evidence)|forced (?:me|him|her) to sign|beat(?:en)? (?:me|him|her)\b|domestic violence?|abused(?: me| him| her)?|sold (?:her|his) (?:daughter|child)|ruined (?:my|his|her|your) (?:life|name|reputation|family|future)|destroyed (?:my|his|her) life|left (?:me|him|her) (?:with nothing|homeless))\b/i;

// grave：人命/冤狱/骨肉/暴力——道歉赎不回，必须付实际代价或经年月
const GRAVE_ZH = /(?:害死|逼死|见死不救|眼睁睁|氧气管|拔管|弄(?:没|掉)(?:了)?(?:孩子|娃|胎儿)|流产|小产|卖(?:了|掉)?(?:女儿|儿子|孩子|媳妇)|打断|打残|家暴|虐待|坐(?:了)?(?:[一二两三四五六七八九十\d]+年)?牢|蹲监狱|蹲大牢|进监狱|看守所|背黑锅|顶罪)/;
const GRAVE_EN = /\b(?:killed|murdered|caused .* death|drove .* to (?:death|suicide)|let (?:her|him|them) die|left .* to die|watched .* die|pulled the plug|lost the baby|forced (?:her|him) (?:into )?(?:an )?abortion|sold (?:her|his) (?:daughter|child)|beat(?:en)?|domestic violence?|abused|behind bars|wrongfully|took the fall|took the blame)\b/i;

/* ───────── 2) 赦免点 ───────── */

const GRANT_ZH = /(?:我原谅(?:你|他|她)(?:了|吧)|我不怪你(?:了|吧)?|不怪(?:他|她)(?:了|吧)|我不恨你(?:了)?|不恨(?:他|她)(?:了)?|既往不咎|我不计较(?:了|吧)?|我不追究(?:了|吧)?|这一页(?:翻过去|揭过去|翻篇)|翻篇(?:了|吧)|算了[，,。][^。！？\n]{0,10}(?:都过去了|不怪|不追究|翻篇|回家|原谅)|都过去了|我放下了|放下(?:了|吧)|别怪(?:他|她)(?:了|吧)|他也不容易|她也不容易|我认(?:你|他|她)?(?:这个)?(?:爸|妈|哥|姐)(?:了|吧))/;
const GRANT_EN = /\b(?:i forgive (?:you|him|her)(?:\b|[,.;])|i don'?t blame you|i can'?t stay mad at you|i'?m not angry (?:anymore|at you)|let it go(?:,|$)|let bygones be bygones|water under the bridge|it'?s all in the past|move on from it|moved past it|i'?ve let it go|i'?m over it now|i won'?t press charges|we'?re good now|you'?re still my (?:father|mother|dad|mom|brother))\b/i;

const ACCEPT_ZH = /(?:扑(?:进|到|入)[^。！？\n]{0,6}怀里|一把抱(?:住|紧)|抱(?:住|紧)(?:了)?(?:他|她|爸|妈|我|你)?|握(?:住|紧)(?:了)?(?:他|她)?的?手|(?:哭着|含泪|抹着泪|哽咽着?)?点了?点头|点了?点头|喊了?(?:一声|了声)?(?:爸|妈|爷爷|奶奶|哥|姐)|叫了?(?:一声|声)?(?:爸|妈|爷爷|奶奶)|(?:跟|和)(?:你|他|她)(?:一起)?回家(?:吧|了|！|!|。)?|我们回家|回家吧|带(?:我|他|她)回家|端(?:来|上)?(?:一碗|一杯)?(?:茶|姜汤|热水))/;
const ACCEPT_EN = /\b(?:threw (?:herself|himself) into (?:his|her) arms|into (?:his|her) arms|hugged (?:him|her) (?:back|tight)?|held (?:him|her) (?:close|tight)|took (?:his|her) hand|reached for (?:his|her) hand|nodded (?:through|with) tears|tearfully nodded|called him (?:dad|father)|called her (?:mom|mother)|["']?dad["']?(?:,|$| she said)|come home(?: with me)?\??$|we'?re going home|brought him home)\b/i;

const COERCE_ZH = /(?:毕竟(?:是|他是|她是)(?:你)?(?:爸|妈|爹|娘|父亲|母亲|爷爷|奶奶)|血浓于水|父子?哪有隔夜仇|他都(?:跪下|这样)了?你还要(?:怎样|怎么样)|得饶人处且饶人|大人有大量|(?:孩子|小孩)不能没有(?:爸|妈|爹|娘)|他(?:毕竟|都)(?:老了|年纪大了|知道错了)|再怎么(?:说|样)(?:他|她)?也是你(?:爸|妈)|一笔写不出两个)/;
const COERCE_EN = /\b(?:he'?s still your (?:father|dad)|she'?s still your (?:mother|mom)|blood is thicker(?: than water)?|he'?s family|what more do you want(?: from him)?|he'?s on his knees|for the (?:child|kids|children)'?s sake|they need their (?:father|mother|dad|mom)|he'?s an old man now|be the bigger person|find it in your heart to)\b/i;

/* ───────── 3) 代价 ───────── */

const CONSEQUENCE_ZH = /(?:去?自首|我已经(?:让人)?报警|报了?警(?:抓我)?|警察(?:已经)?(?:来|在|到|带走|拘捕)|警笛|手铐|戴上手铐|被(?:警察)?(?:逮捕|拘捕|抓走|带走)|判刑|判了[一二两三四五六七八九十\d]+年|入狱|坐牢|净身出户|放弃(?:了)?(?:继承权|家产|股权|股份)|把[^。！？\n]{0,14}(?:还你|还给你|退还|捐给|捐了?|转回你名下)|转回(?:了)?(?:你|他|她|我)?名下|股权(?:转让书?|过户书?)?[^。！？\n]{0,6}(?:我签|签了字|签了?)|(?:我)?签了?股权(?:转让|过户)|登报(?:道歉|澄清)|我赔(?:你|偿)?(?:罪|损失|金)?|辞职|签了?(?:离婚协议|放弃继承)|公开(?:道歉|认罪))/;
const CONSEQUENCE_EN = /\b(?:turn(?:ed)? myself in|i called the police(?: on myself)?|police (?:came|arrived|took|handcuffed)|handcuffed|put the cuffs on|under arrest|arrested him|was sentenced|sentenced to \d+ years|went to prison|doing time|jail time|left with nothing|signed away (?:everything|my rights|the inheritance)|gave (?:it|the company|everything) back|returned (?:it|the money|everything)|paid (?:you|her|him) back|paid restitution|paid compensation|public(?:ly)? apolog\w+|resigned from|dropped out of the succession)\b/i;

const SELF_LIB_ZH = /(?:我不是(?:要)?原谅你?|原谅?你?[^。！？\n]{0,6}放过我自己|我是放过我自己|为了?我自己(?:好过|放下|解脱)|放下(?:是为了|不是为了?你)|不拿(?:别人|你)的错(?:误)?惩罚自己)/;
const SELF_LIB_EN = /\b(?:i'?m not forgiving you|i don'?t forgive you for (?:your sake|you)|this is for me(?:, not for you)?|i forgive you for myself|letting go for (?:my own sake|myself)|not punishing myself for (?:what )?you did)\b/i;

const TIME_ZH = /(?:[一二两三四五六七八九十\d]+年(?:后|以后)|多年(?:后|以后)|数年(?:后|以后)|几年(?:后|以后))/;
const TIME_EN_YEARS = /\b(?:a year|one year|two years|three years|\d+ years|years)\s+later\b/i;
const TIME_EN_MONTHS = /\b(?:months|several months|\d+ months)\s+later\b/i;

const REFUSAL_ZH = /(?:我绝不?原谅|我不(?:会|可能)原谅|不可能(?:原谅|和解|认)|太晚了|来不及了|你走(?:吧|！|!|。)?|滚(?:出去|开)?|我不想(?:再)?见(?:到)?你|我没有你这样的(?:爸|妈|爹|娘|父亲|母亲|哥|姐)|我不认识你|我没你这个)/;
const REFUSAL_EN = /\b(?:i ?(?:will|would) never forgive|i can ?(?:never|not) forgive|i don'?t forgive you|impossible,? i won'?t|it'?s too late|get out(?: of my house)?|leave me alone|i never want to see you (?:again)?|you'?re dead to me|i don'?t have a (?:father|mother|dad|mom))\b/i;

const APO_ZH = /(?:对不起|抱歉|我错了|我有罪|原谅我|是我对不起你?)/;
const APO_EN = /\b(?:i'?m sorry|i am sorry|i apologize|please forgive me|i was wrong|i owe you an apology)\b/i;
const ACT_ZH = /(?:换药|伪造|害死|逼死|害(?:你|他|她)?(?:坐牢|蹲监狱)|送(?:你|他|她)进监狱|陷害|栽赃|冤枉|出轨|外遇|卷走|挪用|偷(?:了)?(?:钱|家产)?|抛弃|丢下|赶(?:你|他|她)出|顶罪|黑锅|卖(?:了)?(?:女儿|孩子|儿子)|打(?:断|伤|残)?|虐待|吞了?家产|夺走?一切|拔管|孩子(?:没|是我弄没)|流产|见死不救)/;
const ACT_EN = /\b(?:switched the pills|forged|killed|caused (?:his|her) death|drove (?:her|him) to|framed|wrongfully|behind bars|cheated|had an affair|embezzled|stole|abandoned|walked out|kicked (?:you|him|her) out|took the fall|took the blame|sold (?:her|his)|beat(?:en)?|abused|took everything|pulled the plug|lost the baby|let (?:her|him) die)\b/i;

const EXCUSE_ZH = /(?:我也是没办法|我也?是被逼(?:无奈|的)?|一时糊涂|鬼迷心窍|一时冲动|为了这个家|都是为了?(?:你|这个家|你们)|为了你好|我有(?:我的)?苦衷|当时(?:年轻|糊涂)|我当时(?:也是|真的)?没办法|不知者不怪|我都这样(?:道歉|求你)了?|过去这么久了你还)/;
const EXCUSE_EN = /\b(?:i had no choice|there was no other way|i was weak|one moment of weakness|i lost my head|i did it for the family|it was for your own good|i had my reasons|i was young(?: and stupid)?|i'?ve already apologized|after all this time you'?re still|how was i supposed to know)\b/i;

export interface ForgivenessHit {
  /** 重伤成立行（1 基） */
  harmLine: number;
  /** 赦免点行（1 基，accept 被施压触发时取身体回归行） */
  line: number;
  /** grant 明示原谅 / accept 身体名分回归 / coerce 旁人按头后回归 */
  kind: 'grant' | 'accept' | 'coerce';
  /** grave 人命冤狱骨肉暴力 / heavy 其余原则性伤害 */
  severity: 'grave' | 'heavy';
  /** 廉价加压项 */
  boosters: ('excuse' | 'pressure' | 'instant')[];
  snippet: string;
  rescued: boolean;
  rescueLine: number | null;
  reason: string;
}

export interface CheapForgivenessResult {
  score: number;
  hits: ForgivenessHit[];
  issues: string[];
  advice: string;
}

type Parsed =
  | { kind: 'header' }
  | { kind: 'blank' }
  | { kind: 'dialogue'; speaker: string; text: string }
  | { kind: 'narration'; text: string };

function parseLine(raw: string, isZh: boolean): Parsed {
  const t = raw.trim();
  if (!t) return { kind: 'blank' };
  if (isSceneHeaderLine(t)) return { kind: 'header' };
  const m = t.match(isZh ? SPEAKER_RE : SPEAKER_EN_RE);
  if (m) {
    const text = m[2].trim();
    if (isZh || /[a-z]/.test(text)) return { kind: 'dialogue', speaker: m[1].trim(), text };
  }
  return { kind: 'narration', text: t };
}

const lineText = (p: Parsed): string => (p.kind === 'blank' || p.kind === 'header' ? '' : p.text);

export function cheapForgiveness(draft: string): CheapForgivenessResult {
  const isZh = isZhText(draft);
  const parsed = draft.split(/\r?\n/).map((l) => parseLine(l, isZh));
  const n = parsed.length;

  const harmRe = isZh ? HARM_ZH : HARM_EN;
  const graveRe = isZh ? GRAVE_ZH : GRAVE_EN;
  const grantRe = isZh ? GRANT_ZH : GRANT_EN;
  const acceptRe = isZh ? ACCEPT_ZH : ACCEPT_EN;
  const coerceRe = isZh ? COERCE_ZH : COERCE_EN;
  const consequenceRe = isZh ? CONSEQUENCE_ZH : CONSEQUENCE_EN;
  const selfLibRe = isZh ? SELF_LIB_ZH : SELF_LIB_EN;
  const refusalRe = isZh ? REFUSAL_ZH : REFUSAL_EN;
  const apoRe = isZh ? APO_ZH : APO_EN;
  const actRe = isZh ? ACT_ZH : ACT_EN;
  const excuseRe = isZh ? EXCUSE_ZH : EXCUSE_EN;

  // ── 预扫：重伤行（含 grave 判定）与赦免候选行 ──
  const harmLines: { line: number; text: string; grave: boolean }[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = lineText(parsed[i]);
    if (!t || !harmRe.test(t)) continue;
    harmLines.push({ line: i, text: t, grave: graveRe.test(t) });
  }

  type Beat = { line: number; kind: ForgivenessHit['kind']; pressure: boolean };
  const beats: Beat[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = lineText(parsed[i]);
    if (!t) continue;
    if (grantRe.test(t)) {
      beats.push({ line: i, kind: 'grant', pressure: coerceRe.test(t) });
      continue;
    }
    if (coerceRe.test(t)) {
      // 施压后 3 行内出现身体/名分回归才算按头成功
      for (let j = i + 1; j <= Math.min(n - 1, i + 3); j += 1) {
        const tj = lineText(parsed[j]);
        if (tj && acceptRe.test(tj)) {
          beats.push({ line: j, kind: 'coerce', pressure: true });
          break;
        }
      }
      continue;
    }
    if (acceptRe.test(t)) {
      // 日常拥抱防误伤：前 6 行内必须有道歉/借口/施压/明示原谅
      let leadIn = false;
      for (let j = Math.max(0, i - 6); j < i; j += 1) {
        const tj = lineText(parsed[j]);
        if (tj && (apoRe.test(tj) || excuseRe.test(tj) || coerceRe.test(tj) || grantRe.test(tj))) {
          leadIn = true;
          break;
        }
      }
      if (leadIn) beats.push({ line: i, kind: 'accept', pressure: false });
    }
  }
  // 同一和解簇（±4行）去重，保留最前赦免点；两簇之间若出现新重伤则切簇
  beats.sort((a, b) => a.line - b.line);
  const clustered: Beat[] = [];
  for (const b of beats) {
    const last = clustered[clustered.length - 1];
    if (!last || b.line - last.line > 4) {
      clustered.push(b);
      continue;
    }
    let harmBetween = false;
    for (let i = last.line + 1; i <= b.line; i += 1) {
      const tj = lineText(parsed[i]);
      if (tj && harmRe.test(tj)) harmBetween = true;
    }
    if (harmBetween) clustered.push(b);
    else if (b.pressure) last.pressure = true;
  }

  const inRange = (i: number, lo: number, hi: number) => i >= lo && i <= hi;

  const hits: ForgivenessHit[] = [];
  for (const beat of clustered) {
    const f = beat.line;
    // 配对：赦免点前 120 行内（含同行）最近的重伤；若中途有多桩，取最近一桩
    let harm: { line: number; text: string; grave: boolean } | null = null;
    for (let i = f; i >= Math.max(0, f - 120); i -= 1) {
      const t = lineText(parsed[i]);
      if (t && harmRe.test(t)) {
        harm = { line: i, text: t, grave: graveRe.test(t) };
        break;
      }
    }
    if (!harm) continue;

    const lo = Math.max(0, f - 14);
    const hi = Math.min(n - 1, f + 3);

    // ── 加压项 ──
    const boosters: ForgivenessHit['boosters'] = [];
    let pressure = beat.pressure;
    for (let i = lo; i <= hi; i += 1) {
      const t = lineText(parsed[i]);
      if (!t) continue;
      if (coerceRe.test(t)) pressure = true;
    }
    if (pressure) boosters.push('pressure');
    let excuseLine = -1;
    for (let i = Math.max(0, f - 4); i <= f; i += 1) {
      const t = lineText(parsed[i]);
      if (t && excuseRe.test(t) && !apoSpecific(t)) {
        excuseLine = i;
        break;
      }
    }
    if (excuseLine >= 0) boosters.push('excuse');

    // ── 代价扫描 ──
    let rescued = false;
    let rescueLine: number | null = null;
    let reason = '';

    // 1) 自我解放：受害者为自己放下
    for (let i = Math.max(0, f - 2); i <= hi; i += 1) {
      const t = lineText(parsed[i]);
      if (t && selfLibRe.test(t)) {
        rescued = true;
        rescueLine = i;
        reason = isZh ? '自我解放式放下（放过自己，不是给加害者免单）' : 'self-liberation (letting go for herself, not absolution for him)';
        break;
      }
    }

    // 2) 实际代价：伏法/自首/赔偿/放弃财产
    if (!rescued) {
      for (let i = lo; i <= hi; i += 1) {
        const t = lineText(parsed[i]);
        if (t && consequenceRe.test(t)) {
          rescued = true;
          rescueLine = i;
          reason = isZh ? '实际代价已兑付（伏法/自首/赔偿/放弃财产）' : 'concrete consequence paid (surrender / arrest / restitution)';
          break;
        }
      }
    }

    // 3) 时间流逝（grave 需年级且伴随具体道歉；heavy 月级+道歉亦可）
    if (!rescued) {
      let timeLine = -1;
      let years = false;
      let months = false;
      for (let i = lo; i <= f; i += 1) {
        const t = lineText(parsed[i]);
        if (!t) continue;
        if (isZh && TIME_ZH.test(t)) { timeLine = i; years = true; }
        if (!isZh && TIME_EN_YEARS.test(t)) { timeLine = i; years = true; }
        if (!isZh && !years && TIME_EN_MONTHS.test(t)) { timeLine = i; months = true; }
      }
      const apoLine = findSpecificApology(parsed, lo, hi);
      if (timeLine >= 0 && apoLine >= 0 && (years || (!harm.grave && months))) {
        rescued = true;
        rescueLine = apoLine;
        reason = isZh ? '时间流逝后具体道歉，原谅经过沉淀' : 'time passed and the deed was named before forgiveness';
      }
    }

    // 4) earned：先明确拒绝，间隔≥8行，之后付出代价或具体道歉
    if (!rescued) {
      let refuseLine = -1;
      for (let i = lo; i <= f - 3; i += 1) {
        const t = lineText(parsed[i]);
        if (t && refusalRe.test(t)) {
          refuseLine = i;
          break;
        }
      }
      if (refuseLine >= 0 && f - refuseLine >= 8) {
        let paidAfter = -1;
        for (let i = refuseLine + 1; i <= hi; i += 1) {
          const t = lineText(parsed[i]);
          if (t && (consequenceRe.test(t) || apoSpecific(t))) {
            paidAfter = i;
            break;
          }
        }
        // grave：拒绝后仅靠嘴道歉仍不够，必须是实际后果
        if (paidAfter >= 0 && (!harm.grave || consequenceRe.test(lineText(parsed[paidAfter])))) {
          rescued = true;
          rescueLine = paidAfter;
          reason = isZh ? '拒绝后重新挣回的原谅（有间隔、有代价）' : 'forgiveness re-earned after refusal (gap + payment)';
        }
      }
    }

    // 5) heavy 专属：不找借口、说清罪行的具体道歉可独立豁免
    if (!rescued && !harm.grave) {
      const apoLine = findSpecificApology(parsed, lo, hi);
      if (apoLine >= 0) {
        rescued = true;
        rescueLine = apoLine;
        reason = isZh ? '具体且不找借口的道歉，原则性伤害可由此和解' : 'specific, excuse-free apology naming the deed';
      }
    }

    // ── instant 加压：唯一道歉/借口距赦免≤2行，之前无代价节拍 ──
    if (!rescued) {
      let closeApo = false;
      for (let i = Math.max(0, f - 2); i <= f; i += 1) {
        const t = lineText(parsed[i]);
        if (t && (apoRe.test(t) || excuseRe.test(t))) closeApo = true;
      }
      let earlierBeat = false;
      for (let i = lo; i <= Math.max(lo, f - 3); i += 1) {
        const t = lineText(parsed[i]);
        if (t && (consequenceRe.test(t) || apoSpecific(t) || refusalRe.test(t))) earlierBeat = true;
      }
      if (closeApo && !earlierBeat) boosters.push('instant');
    }

    if (rescued) continue;

    hits.push({
      harmLine: harm.line + 1,
      line: f + 1,
      kind: beat.kind,
      severity: harm.grave ? 'grave' : 'heavy',
      boosters,
      snippet: snippet(lineText(parsed[f]) || ''),
      rescued: false,
      rescueLine: null,
      reason: reason || (harm.grave
        ? (isZh ? '人命/冤狱/骨肉级伤害无实际代价，仅靠情绪节拍赦免' : 'grave harm (life/freedom/blood) absolved without real payment')
        : (isZh ? '原则性伤害未付代价即和解（无具体道歉/赔偿/伏法）' : 'serious harm reconciled without named apology or payment')),
    });
  }

  // ── 计分 ──
  let score = 100;
  for (const h of hits) {
    let penalty = h.severity === 'grave' ? 45 : 35;
    if (h.boosters.includes('excuse')) penalty += 10;
    if (h.boosters.includes('pressure')) penalty += 10;
    score -= penalty;
  }
  score = Math.max(20, score);

  const issues: string[] = hits.map((h) => isZh
    ? `第${h.line}行廉价原谅（${h.severity === 'grave' ? '人命冤狱级' : '原则性伤害'}，伤在第${h.harmLine}行）：${h.boosters.join('+') || '无代价'}——${h.reason}`
    : `L${h.line} cheap forgiveness (${h.severity}, harm at L${h.harmLine}): ${h.boosters.join('+') || 'no cost'} — ${h.reason}`);

  const advice = isZh
    ? '和解必须有价：加害者伏法/自首/净身出户/全数退赔，或说出具体罪行且不找借口、经时间与拒绝后重新挣回；受害者也可以说"我不原谅，我只是放过自己"。删掉"一时糊涂+他毕竟是你爸+算了都过去了"三连。'
    : 'Reconciliation must be paid for: surrender, arrest, restitution, signing away the gains; or an excuse-free apology naming the exact deed, across time, after a real refusal. Or let her say: "I am not forgiving you — I am letting go for me." Cut the "one mistake / he is still your father / water under the bridge" triple.';

  return { score, hits, issues, advice };
}

/** 一行同时含道歉词与具体罪行，且无借口——才算"具体道歉" */
function apoSpecific(t: string): boolean {
  if (!t) return false;
  const zh = isZhLine(t);
  const apo = zh ? APO_ZH.test(t) : APO_EN.test(t);
  const act = zh ? ACT_ZH.test(t) : ACT_EN.test(t);
  const excuse = zh ? EXCUSE_ZH.test(t) : EXCUSE_EN.test(t);
  return apo && act && !excuse;
}

function findSpecificApology(parsed: Parsed[], lo: number, hi: number): number {
  for (let i = lo; i <= hi; i += 1) {
    const t = lineText(parsed[i]);
    if (t && apoSpecific(t)) return i;
  }
  return -1;
}

const isZhLine = (t: string): boolean => /[一-鿿]/.test(t);
