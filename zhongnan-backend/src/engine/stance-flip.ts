import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 无因立场横跳检测器（v2.80 块71，创作能力类）
 * ------------------------------------------------------------------
 * 病象：角色刚把决定钉死（"我绝不签字""我不会回去""谁爱管谁管"），
 * 没过几句，没人逼、没证据、没代价，自己就反着做（"我签。""走吧。""行，我帮。"）。
 * 观众读出的不是人物弧光，是作者在后面掰人——人物沦为提线木偶。
 *
 * 与现有引擎的分工（查重后确认的空白点）：
 *  - emotion-whiplash：抓相邻台词情绪极性对跳（怒→笑），不抓决定反转；
 *  - cheap-forgiveness：专抓血海深仇→原谅，本引擎不碰原谅/道歉域；
 *  - twist-density：只数反转密度且反转越多越好，不判反转是否挣来；
 *  - causal-logic：抓巧合/降神/誓言烂尾（不兑付），不抓"兑付得太便宜"；
 *  - stance-flip（本引擎）：同一角色同一议题，死誓立场在 ≤10 行内反做，
 *    且中间没有施压/证据/交易/条件，即为无因横跳。
 *
 * 豁免（rescue，立场转变必须挣来）：
 *  - 对方亮硬筹码：证据/合同/录像/亲子牌/病情/遗嘱/钱/股份/下跪/报警/记者会（强 cue 1 句即够，弱 cue 要 2 句）；
 *  - 动作叙述给出新信息：△递上/甩出/屏幕亮起/电话响（每拍计 1）；
 *  - 反做台词自带交换条件："好，我签，但你必须把她接回来"/"只要……我就……"（计 2）；
 *  rescue 分 ≥2 即视为有因，记录 rescued=true 但不扣分。
 */

export interface StanceFlipHit {
  speaker: string;
  family: StanceFamily;
  fromLine: number;
  toLine: number;
  /** 跨度（起止之间非空行数） */
  span: number;
  /** 被推翻的立场原文 */
  fromText: string;
  /** 反做的决定原文 */
  toText: string;
  snippet: string;
  rescued: boolean;
  rescueScore: number;
  boosters: string[];
  reason: string;
}

export type StanceFamily = 'goto' | 'sign' | 'wedlock' | 'divorce' | 'handover' | 'cooperate' | 'leave';

export interface StanceFlipResult {
  score: number;
  dialogueTurns: number;
  hits: StanceFlipHit[];
  issues: string[];
  advice: string[];
}

/* ───────── 语言判定（全文含汉字即中文，与既有引擎一致） ───────── */

function isZhText(draft: string): boolean {
  return /[一-鿿]/.test(draft);
}

/* ───────── 台词解析 ───────── */

interface Turn {
  line: number;
  speaker: string;
  parenthetical: string;
  text: string;
  raw: string;
  narration: boolean;
}

const SPEAKER_RE = /^([一-鿿A-Za-z0-9·]{1,6})(?:（([^）]{0,24})）)?\s*[：:]\s*(.+)$/;
const SPEAKER_EN_RE = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\(([^()]{0,40})\))?\s*:\s*(.+)$/;

function parseTurns(draft: string, zh: boolean): Turn[] {
  const out: Turn[] = [];
  draft.split('\n').forEach((rawLine, idx) => {
    const raw = rawLine.trim();
    if (!raw) return;
    if (zh) {
      const m = raw.match(SPEAKER_RE);
      if (m && !raw.startsWith('△') && !isSceneHeaderLine(raw, 'zh')) {
        out.push({ line: idx + 1, speaker: m[1], parenthetical: m[2] || '', text: m[3].trim(), raw, narration: false });
      } else {
        out.push({ line: idx + 1, speaker: '', parenthetical: '', text: raw, raw, narration: true });
      }
    } else {
      const m = raw.match(SPEAKER_EN_RE);
      if (m) {
        out.push({ line: idx + 1, speaker: m[1].trim().replace(/\s+/g, ' '), parenthetical: m[2] || '', text: m[3].trim(), raw, narration: false });
      } else {
        out.push({ line: idx + 1, speaker: '', parenthetical: '', text: raw, raw, narration: true });
      }
    }
  });
  return out;
}

/* ───────── 立场锚点：每族两极，撞到两极即成候选横跳 ───────── */

interface Anchor {
  family: StanceFamily;
  /** 0 = 拒绝/坚持原立场，1 = 反做（两极语义只用于 reason 展示，谁先谁后都算横跳） */
  pole: 0 | 1;
  re: RegExp;
}

// 拒绝前往 / 同意前往
const GOTO_A_ZH = /(?:我|咱|俺)(?:绝对|肯定|就|才|也|死都不|说不)?不(?:会|想|愿意|打算)?(?:回去|进(?:去|屋)|来|去)(?:了|的|这个家)?/;
const GOTO_B_ZH = /(?:走(?:吧|了|啊|。|！|，|$))|(?:我|咱)(?:这就|马上|现在就|跟你|这就)?(?:回去|进(?:去|屋)|去)(?:吧|了|啊)?|好(?:吧)?，?我们走/;
// 拒绝离开 / 决意离开（反向族，并入 leave）
const LEAVE_A_ZH = /(?:我|咱)(?:绝对|就|死都不|不|不会)(?:走|离开|滚)(?:的|了)?/;
const LEAVE_B_ZH = /(?:我|咱)(?:要|想|马上|这就|现在)?(?:离开|走(?:了|吧|啊)|滚(?:了|吧)?)(?:。|！|，|$)|这地方我(?:不待了|待不下去了)/;
// 同意离开后又留下（留 ↔ 走 反向）
const STAY_B_ZH = /(?:我|咱)(?:不(?:走|离开)了|留下|不走了)/;

const SIGN_A_ZH = /(?:我|咱)(?:绝不|死都不|绝对不|就不|才不|不会|不)(?:签|签字|签名)|想让我签(?:字|名)?[，,。!！]?\s*(?:没门|做梦|休想)/;
const SIGN_B_ZH = /(?:我|咱)(?:签|签字|签名)(?:还不行|吧|了|。|！|，|$)|给我笔|拿(?:笔|来)(?:吧)?，?我签|好(?:吧)?[，,]?\s*(?:我签|签)/;
const WEDLOCK_A_ZH = /(?:我|咱)(?:绝不|死都不|绝对不|就不|才不|不|不会)(?:嫁|娶|结婚|领证)|这婚(?:我)?(?:不结了|结不了)/;
const WEDLOCK_B_ZH = /(?:我|咱)(?:嫁|娶|结婚|领证)(?:吧|了|。|！|，|$)|好(?:吧)?[，,]?\s*(?:我嫁|我娶|我结)/;
const DIVORCE_INSIST_ZH = /这婚(?:我)?(?:离定了|必须离|离不了)|(?:我|咱)(?:要|想|必须|马上|现在就)(?:离婚|离)|必须离婚/;
const DIVORCE_DROP_ZH = /(?:我|咱)?(?:不(?:离了|离婚|离)|算了[，,]?\s*别离|这婚(?:先|暂)?不(?:离|离了))/;
const DIVORCE_REFUSE_ZH = /(?:我|咱)(?:绝不|死都不|就不|不)(?:离|离婚)/;
const DIVORCE_ACCEPT_ZH = /(?:我|咱)(?:离|离婚)(?:吧|了|。|！|，|$)|离就离|好(?:吧)?[，,]?\s*离/;
const HAND_A_ZH = /(?:我|咱)(?:绝不|绝对不|死都不|就不|才不|不会|不)(?:给|交|还)(?:你|他|她|你们)?|别想(?:拿到|得到|从我这)|你(?:们)?休想|门都没有/;
const HAND_B_ZH = /^(?:给(?:你|他|她)|还给(?:你|他|她)|交给(?:你|他|她))|拿(?:去|着|吧)|这是(?:你|他)要的|(?:我|咱)(?:给你|交|还)(?:你|他|她)?/;
const COOP_A_ZH = /(?:我|咱)(?:绝不|就不|才不|不|不会)(?:帮|管|参与|答应|同意|站队)(?:你|他|她|你们)?|谁爱管谁管|别找我|不关我事|凭什么(?:帮|管|答应)|想都别想/;
const COOP_B_ZH = /(?:我|咱)(?:帮你|管(?:了|定)?|答应(?:你|他)?|同意|站队)|这事我管(?:了|定)?|算我一个|成交|好(?:吧)?[，,]?\s*(?:我帮|我管|我答应)/;
// 干巴巴的全盘接受：可对销任何一族的未决拒绝
const TERSE_ACCEPT_ZH = /^(?:好|好的|好吧|行|行吧|成|成吧|嗯|可以|成交|没问题)[。.！!…]*$/;

const ZH_ANCHORS: Anchor[] = [
  { family: 'goto', pole: 0, re: GOTO_A_ZH },
  { family: 'goto', pole: 1, re: GOTO_B_ZH },
  { family: 'sign', pole: 0, re: SIGN_A_ZH },
  { family: 'sign', pole: 1, re: SIGN_B_ZH },
  { family: 'wedlock', pole: 0, re: WEDLOCK_A_ZH },
  { family: 'wedlock', pole: 1, re: WEDLOCK_B_ZH },
  { family: 'divorce', pole: 0, re: DIVORCE_INSIST_ZH },
  { family: 'divorce', pole: 1, re: DIVORCE_DROP_ZH },
  { family: 'divorce', pole: 0, re: DIVORCE_REFUSE_ZH },
  { family: 'divorce', pole: 1, re: DIVORCE_ACCEPT_ZH },
  { family: 'handover', pole: 0, re: HAND_A_ZH },
  { family: 'handover', pole: 1, re: HAND_B_ZH },
  { family: 'cooperate', pole: 0, re: COOP_A_ZH },
  { family: 'cooperate', pole: 1, re: COOP_B_ZH },
  { family: 'leave', pole: 0, re: LEAVE_A_ZH },
  { family: 'leave', pole: 1, re: LEAVE_B_ZH },
  { family: 'leave', pole: 1, re: STAY_B_ZH },
];

/* ───────── 英文锚点 ───────── */

const GOTO_A_EN = /\b(?:i'?m not going|i am not going|i won'?t go(?:ing)?|i will not go|i'?m not coming(?: back)?|i am not coming(?: back)?|i'?m not going back|there'?s no way i'?m going|i ain'?t going|nothing on earth (?:could|would) make me go)\b/i;
const GOTO_B_EN = /\b(?:let'?s go|fine,? i'?ll go|fine,? i will go|okay,? i'?ll go|okay,? i will go|i'?m going(?: back)?(?: now)?|i am going(?: back)?|i'?ll come(?: with you)?|i will come(?: with you)?|we'?re leaving|let me get my coat)\b/i;
const LEAVE_A_EN = /\b(?:i'?m not leaving|i am not leaving|i won'?t leave|i will not leave|i'?m staying|i am staying|i'?m not going anywhere)\b/i;
const LEAVE_B_EN = /\b(?:i'?m leaving|i am leaving|i'?m out of here|i have to go|i'?m going home|i can'?t stay here)\b/i;
const STAY_B_EN = /\b(?:i'?m not leaving|i am not leaving|i'?ll stay|i will stay|i'?m staying|i am staying)\b/i;
const SIGN_A_EN = /\b(?:i'?m not signing|i am not signing|i won'?t sign|i will not sign|you will never get my signature|like hell i'?ll sign)\b/i;
const SIGN_B_EN = /\b(?:i'?ll sign|i will sign|fine,? i'?ll sign|fine,? i will sign|give me the pen|here'?s my signature|i signed it)\b/i;
const WEDLOCK_A_EN = /\b(?:i won'?t marry(?: him| her| you)?|i will not marry(?: him| her| you)?|i'?m not marrying(?: him| her| you)?|i am not marrying(?: him| her| you)?|there will be no wedding)\b/i;
const WEDLOCK_B_EN = /\b(?:i'?ll marry(?: him| her| you)?|i will marry(?: him| her| you)?|fine,? i'?ll marry|fine,? i will marry|yes,? i'?ll marry)\b/i;
const DIVORCE_INSIST_EN = /\b(?:i want a divorce|i'?m divorcing(?: him| her| you)?|i am divorcing(?: him| her| you)?|file for divorce|i will divorce him)\b/i;
const DIVORCE_DROP_EN = /\b(?:never mind(?: the divorce)?|i'?m not divorcing(?: him| her)?|i am not divorcing(?: him| her)?|call off the divorce|tear up the papers)\b/i;
const DIVORCE_REFUSE_EN = /\b(?:i won'?t divorce(?: him| her| you)?|i will not divorce(?: him| her| you)?|i'?m not giving you a divorce)\b/i;
const DIVORCE_ACCEPT_EN = /\b(?:fine,? divorce me|i'?ll sign the divorce papers|i will sign the divorce papers|i agree to the divorce)\b/i;
const HAND_A_EN = /\b(?:i'?m not giving(?: it| you| this| them)?(?: to you)?|i am not giving(?: it| you| this)?(?: to you)?|you'?re not getting (?:it|this|them)|you are not getting (?:it|this|them)|over my dead body|you can'?t have it)\b/i;
const HAND_B_EN = /\b(?:here,? take it|it'?s yours|fine,? take it|i'?ll give it to you|i will give it to you|i'?m giving it to you)\b/i;
const COOP_A_EN = /\b(?:i'?m not helping(?: you| him| her)?|i am not helping(?: you| him)?|i won'?t help(?: you| him)?|i will not help(?: you| him)?|count me out|not my problem|like hell i will|do it yourself)\b/i;
const COOP_B_EN = /\b(?:fine,? i'?ll help|fine,? i will help|okay,? i'?ll do it|okay,? i will do it|i'?m in|you got me|deal|consider it done)\b/i;
const TERSE_ACCEPT_EN = /^(?:fine|okay|ok|deal|agreed|whatever you say)[.!]*$/i;

const EN_ANCHORS: Anchor[] = [
  { family: 'goto', pole: 0, re: GOTO_A_EN },
  { family: 'goto', pole: 1, re: GOTO_B_EN },
  { family: 'sign', pole: 0, re: SIGN_A_EN },
  { family: 'sign', pole: 1, re: SIGN_B_EN },
  { family: 'wedlock', pole: 0, re: WEDLOCK_A_EN },
  { family: 'wedlock', pole: 1, re: WEDLOCK_B_EN },
  { family: 'divorce', pole: 0, re: DIVORCE_INSIST_EN },
  { family: 'divorce', pole: 1, re: DIVORCE_DROP_EN },
  { family: 'divorce', pole: 0, re: DIVORCE_REFUSE_EN },
  { family: 'divorce', pole: 1, re: DIVORCE_ACCEPT_EN },
  { family: 'handover', pole: 0, re: HAND_A_EN },
  { family: 'handover', pole: 1, re: HAND_B_EN },
  { family: 'cooperate', pole: 0, re: COOP_A_EN },
  { family: 'cooperate', pole: 1, re: COOP_B_EN },
  { family: 'leave', pole: 0, re: LEAVE_A_EN },
  { family: 'leave', pole: 1, re: LEAVE_B_EN },
  { family: 'leave', pole: 1, re: STAY_B_EN },
];

/* ───────── rescue：立场是怎么被挣来的 ───────── */

// 强筹码：一句即够（≥2 分）；弱筹码单句只值 1 分
const STRONG_PRESSURE_ZH = /(?:亲子鉴定|合同|证据|录像|录音|遗嘱|股份|账户|病历|报警|抓你|记者会|曝光你|下跪|跪下|你妈(?:临终|死前|的遗言)|你爸(?:临终|死前)|孩子(?:是你的|没了|住院|发烧)|怀孕|流产|癌症|住院|病危|拿刀|鱼死网破)/;
const WEAK_PRESSURE_ZH = /(?:求你|求求|算我求|条件|只要你|你要是不|别怪我|给你钱|一笔钱|你不能这么做|良心|妈的遗言|你母亲|你父亲|孩子们?|病人)/;
const INFO_BEAT_ZH = /^△?.*(?:递(?:上|过|来)?|甩(?:在|到|出)|亮(?:出)?|拿(?:出|起|过|来)|屏幕(?:亮|闪)|电话(?:响|亮)|短信|照片|视频|监控|推门|摊开|打开)/;
const CONDITION_FLIP_ZH = /(?:只要[^\n。！？!?]{0,20}我就|我只有一个条件|但你必须|但你得|先[^\n。！？!?]{0,12}再|为了[^\n。！？!?]{0,16}(?:我|这)(?:就|才)|除非[^\n。！？!?]{0,16}[，,]\s*(?:我|这))/;

const STRONG_PRESSURE_EN = /\b(?:paternity (?:report|test)|the contract|the evidence|the recording|the tape|(?:his|her) will|the shares|the account|medical records|call the police|on (?:his|her|knees)|your mother'?s dying words|your father'?s dying words|the baby is yours|she'?s pregnant|miscarriage|cancer|hospital|dying|with a knife|mutual destruction|go to the press)\b/i;
const WEAK_PRESSURE_EN = /\b(?:please|begging you|i'?m begging|deal|your terms|if you don'?t|or i will|i'?ll pay you|the money|your mother|your father|the kids|conscience)\b/i;
const INFO_BEAT_EN = /\b(?:slides?|pushes?|holds? up|shoves?|tosses?|drops?|the screen (?:lights|flashes)|phone (?:rings|lights up)|text message|the photo|the video|surveillance|door bursts|opens? (?:the|his|her) (?:folder|envelope|bag))\b/i;
const CONDITION_FLIP_EN = /\b(?:only if|my one condition|but you have to|but you must|if it means|unless[^\n.?!]{0,24}i will|fine, but|okay, but)\b/i;

const FAMILY_LABEL_ZH: Record<StanceFamily, string> = {
  goto: '去留', sign: '签字', wedlock: '婚嫁', divorce: '离婚', handover: '交出东西', cooperate: '帮忙合作', leave: '离开',
};

function stripLen(s: string): number {
  return s.replace(/\s/g, '').length;
}

/* ───────── 主函数 ───────── */

export function stanceFlip(draft: string): StanceFlipResult {
  const zh = isZhText(draft);
  const turns = parseTurns(draft, zh);
  const anchors = zh ? ZH_ANCHORS : EN_ANCHORS;
  const terseRe = zh ? TERSE_ACCEPT_ZH : TERSE_ACCEPT_EN;
  const strongRe = zh ? STRONG_PRESSURE_ZH : STRONG_PRESSURE_EN;
  const weakRe = zh ? WEAK_PRESSURE_ZH : WEAK_PRESSURE_EN;
  const infoRe = zh ? INFO_BEAT_ZH : INFO_BEAT_EN;
  const condRe = zh ? CONDITION_FLIP_ZH : CONDITION_FLIP_EN;

  const dialogueTurns = turns.filter((t) => !t.narration).length;

  interface OpenAnchor {
    family: StanceFamily;
    pole: 0 | 1;
    turn: Turn;
  }
  // 每说话人每族只保留最近一个立场锚点
  const open = new Map<string, Map<StanceFamily, OpenAnchor>>();

  const hits: StanceFlipHit[] = [];

  function scoreRescue(from: Turn, to: Turn): { score: number; otherTurns: number } {
    let score = 0;
    let otherTurns = 0;
    for (const t of turns) {
      if (t.line <= from.line || t.line >= to.line) continue;
      if (t.narration) {
        if (infoRe.test(t.text)) score += 1;
        continue;
      }
      if (t.speaker !== from.speaker) {
        otherTurns += 1;
        if (strongRe.test(t.text)) score += 2;
        else if (weakRe.test(t.text)) score += 1;
      }
    }
    if (condRe.test(to.text)) score += 2;
    return { score, otherTurns };
  }

  function buildHit(from: Turn, to: Turn, family: StanceFamily, fromPole: 0 | 1, terse: boolean): void {
    const intervening = turns.filter((t) => t.line > from.line && t.line < to.line);
    const span = intervening.length;
    const { score: rescueScore, otherTurns } = scoreRescue(from, to);
    const boosters: string[] = [];
    // 中间连个对方插话的人都没有，或只有 ≤1 个非空行
    if (otherTurns === 0 || span <= 1) boosters.push('adjacent');
    if (terse || (zh ? stripLen(to.text) <= 6 : to.text.split(/\s+/).filter(Boolean).length <= 4)) boosters.push('terse');
    const rescued = rescueScore >= 2;
    const label = zh ? FAMILY_LABEL_ZH[family] : family;
    const reason = zh
      ? `第${from.line}行${from.speaker}刚把「${label}」的决定钉死（${from.text.slice(0, 22)}），第${to.line}行就反做（${to.text.slice(0, 22)}），中间${rescued ? '' : '没有'}施压/证据/交易${rescued ? `（rescue=${rescueScore}）` : '，立场没付代价'}`
      : `L${from.line} ${from.speaker} nails the ${label} decision shut (${from.text.slice(0, 28)}), then reverses at L${to.line} (${to.text.slice(0, 28)}) with ${rescued ? `earned pressure (rescue=${rescueScore})` : 'no pressure, proof or price in between'}`;
    hits.push({
      speaker: from.speaker,
      family,
      fromLine: from.line,
      toLine: to.line,
      span,
      fromText: from.text,
      toText: to.text,
      snippet: `${from.speaker}：${from.text} → ${to.speaker}：${to.text}`,
      rescued,
      rescueScore,
      boosters,
      reason,
    });
  }

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.narration) continue;
    let map = open.get(t.speaker);
    if (!map) {
      map = new Map();
      open.set(t.speaker, map);
    }

    const matched: { family: StanceFamily; pole: 0 | 1 }[] = [];
    // 疑问尾句不是决定（"我签？"是犹豫反问），整句不参与立场锚定
    const isQuestion = /[?？]\s*$/.test(t.text);
    if (!isQuestion) {
      for (const a of anchors) {
        if (a.re.test(t.text)) matched.push({ family: a.family, pole: a.pole });
      }
    }
    const isTerse = !isQuestion && terseRe.test(t.text);

    if (matched.length === 0 && isTerse) {
      // 干巴巴的"好。/行。/fine."：对销该说话人最近一个未决拒绝族（要求中间有对方至少一轮）
      let best: { family: StanceFamily; anchor: OpenAnchor } | null = null;
      for (const [family, anchor] of map) {
        const between = turns.filter((x) => x.line > anchor.turn.line && x.line < t.line);
        const otherTurn = between.some((x) => !x.narration && x.speaker !== t.speaker);
        if (otherTurn && (!best || anchor.turn.line > best.anchor.turn.line)) {
          best = { family, anchor };
        }
      }
      if (best && t.line - best.anchor.turn.line <= 12) {
        buildHit(best.anchor.turn, t, best.family, best.anchor.pole, true);
        map.delete(best.family);
      }
      continue;
    }

    for (const m of matched) {
      const prev = map.get(m.family);
      const nonEmptyGap = turns.filter((x) => x.line > (prev?.turn.line ?? -1) && x.line < t.line).length;
      if (prev && prev.pole !== m.pole && nonEmptyGap <= 10) {
        buildHit(prev.turn, t, m.family, prev.pole, false);
        map.delete(m.family);
      } else {
        map.set(m.family, { family: m.family, pole: m.pole, turn: t });
      }
    }
  }

  const unrescued = hits.filter((h) => !h.rescued);
  let score = 100;
  for (const h of unrescued) {
    score -= 30;
    if (h.boosters.includes('adjacent')) score -= 8;
    if (h.boosters.includes('terse')) score -= 5;
  }
  if (score < 20) score = 20;

  const issues = unrescued.map((h) => (zh
    ? `无因立场横跳：${h.reason}`
    : `Unearned stance flip: ${h.reason}`));

  const advice = zh
    ? [
        '立场反转必须挣来：死誓与反做之间，至少给一场真正的交锋——对方亮证据/开价/威胁，或新信息当场砸到桌上',
        '让反做的台词带着交换条件（"我签，但你必须先……"），人物是在谈判而不是被作者掰过去',
        '如果只是想让剧情转弯，改用动作逼人物转弯：门被堵、钱被冻、孩子出事，让外部压力先于改口',
        '刚发完誓的同一集里，改口前至少隔一个完整的施压回合；一句"好吧"接不住"我死都不签"',
      ]
    : [
        'A reversed decision must be earned: between the vow and the reversal put a real clash — evidence shown, a price named, a threat made, or new information landing on the table',
        'Let the reversal line carry the terms ("I will sign, but first you have to…") so the character is negotiating, not being puppeteered',
        'If the plot simply needs to turn, use action pressure first: a blocked door, a frozen account, a child in danger — make the world bend the character before the line bends',
        'Within the same episode, never let a vow reverse on a bare "fine" / "okay" — at least one full pressure beat must sit between them',
      ];

  return { score, dialogueTurns, hits, issues, advice };
}
