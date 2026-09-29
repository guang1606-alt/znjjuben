import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 反派不打自招检测（Villain Over-Confession）
 * ============================================================
 * 治什么病：
 *   现实里的坏人抵赖、反问、只认无关紧要的；AI 写的反派像被编剧
 *   附身——受害者一句空泛试探，他立刻把卷宗背给观众听：
 *     林晚：公司的事，是不是你做的？
 *     沈志国（冷笑）：是我又怎么样？你爸的药是我换的，遗嘱是我
 *     伪造的，你妈也是我逼死的。明天董事会一结束，我连你一起送走。
 *   一句"是不是你"，免费换来手法 + 旧案 + 同伙 + 时间表 + 下一步。
 *   悬疑戏最贵的资产是"信息差"，反派一次倾销，主角的追查线全废。
 *
 * 判定（台词配对检测，只在同场连续发言内）：
 *   1) probe（试探方台词）：短问句（zh≤24字/en≤16词），指向罪行/
 *      背叛的空泛质问，不含具体证据事实；
 *   2) confession（下一发言行，允许夹 1 行叙述）：
 *      - kind=confess：承认词（是我/我干的/没错/I did it…）；
 *      - kind=freebie：免费加料框架（我不妨再告诉你/让你死个明白）；
 *      - 且机密 payload ≥2 族（手法/同伙/旧案时间/动机/下一步），
 *        长度达标——单族短认（"是我。你能怎样。"）放行。
 *
 * rescued（承认是博弈，不是送）：
 *   - evidence：试探前的窗口（≤4行）已摆证据（录音/监控/鉴定/流水，
 *     或主角已说出具体事实），且对方没有继续交代"下一步"——
 *     被逼到墙角的确认合法，主动交代杀人计划仍蠢；
 *   - deal：附交换条件（你先放了她/if I tell you, you let…）；
 *   - trap：±2 行明示是诈供/套话/将计就计；
 *   - legal：在警察/法庭/审讯语境下的供认。
 *
 * 边界（查重后确认）：
 *   - plot-armor.monologue_delay 管"刀架脖子+完全控制+自白+逃脱窗口"
 *     四件套（管主角光环），本引擎不要求物理控制，管信息倾销本身；
 *   - exposition-dialogue.shared_memory 管双方共知旧事互相讲
 *     （as-you-know），本引擎管受害方不知道、反派主动送出的新机密；
 *   - info-delivery 管设备/广播/信使投喂，本引擎管当面对话自爆。
 *
 * 计分：bad=0 → 100；1 → 75；≥2 → max(25, 100-n*24)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^([一-鿿A-Za-z0-9·]{1,4})(?:（[^）]{0,12}）)?\s*[：:]\s*(.+)$/;
const SPEAKER_EN_RE = /^([A-Z][A-Z .'’-]{0,18}?)(?:\s*\([^)]{0,20}\))?\s*:\s*(.+)$/;

const snippet = (s: string, n = 40): string => (s.length > n ? `${s.slice(0, n)}…` : s);
const stripLen = (s: string): number => s.replace(/[，。！？、…：；""''（）()【】《》\s,.!?:;'"()\[\]<>\n-]/g, '').length;
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/* ───────── probe：空泛罪行质问 ───────── */

const PROBE_ZH = /(?:是不是你|是你(?:干|做|搞|弄)的|你(?:干|做|搞)的|你为什么(?:要|这么做|这样对|要害)|你到底(?:做了|干了|搞了)?什么|你把(?:他|她|爸|妈|哥|姐)[^。！？\n]{0,6}(?:怎么了|藏哪|弄哪)|你(?:和|跟)(?:他|她|[一-鿿]{1,4})[^。！？\n]{0,6}(?:什么关系|勾结|联手)|(?:公司|遗嘱|合同|药|账|钱|项目|孩子)[^。！？\n]{0,10}(?:是不是|怎么回事|你解释)|你(?:凭什么|有什么资格)|你(?:骗|瞒)了我多久|你说(?:啊|清楚)|你说话呀|你敢做不敢当)/;

const PROBE_EN = /\b(?:was it you|did you do (?:this|it)|did you kill|why did you (?:do it|kill|betray|lie)|what did you do to (?:him|her|them|my)|how could you do this|you'?ve been lying to me|how long have you been|tell me the truth|you and (?:him|her) .{0,20}working together|explain (?:this|yourself))\b/i;

/* ───────── 承认 / 免费加料 ───────── */

const ADMIT_ZH = /(?:是我(?:干的|做的|弄的|[一-鿿]{0,4}的)?(?:[，,。]|又怎么样|又如何|$)|没错[，,]|^对[，,]|我不否认|我承认|不装了|摊牌了|事到如今[^。！？\n]{0,8}(?:告诉|不瞒|也没什么好瞒)|既然你[^。！？\n]{0,6}(?:快死|要死|活不过)|反正你[^。！？\n]{0,6}(?:要死|活不过|走不出))/;
const ADMIT_EN = /\b(?:it was me|i did (?:it|this)|that'?s right(?:[,]| i did)?|yes,? i did|i don'?t deny it|i admit it|no more lies|fine,? i did it|might as well admit it|since you'?re going to die|you'?re not leaving (?:here|this room) alive)\b/i;

const FREEBIE_ZH = /(?:我(?:不妨|就)?再?告诉你|让(?:你|我给你)死个明白|你(?:还|是不是)(?:不知道|想知道)|你不是一直想知道|我(?:干脆|就)把话说清楚|实话跟你说)/;
const FREEBIE_EN = /\b(?:might as well tell you|let me tell you (?:one more thing|something else)|what you don'?t know|let you die knowing|you might as well know the whole truth|since you asked)\b/i;

/* ───────── 机密 payload 五族 ───────── */

const FAMILIES: { id: string; zh: RegExp; en: RegExp }[] = [
  {
    id: 'method',
    zh: /(?:换药|药是我换的|换了?[^。！？\n]{0,4}药|伪造(?:遗嘱|签名|合同|文件)?|篡改|做假账|账是我做的|纵火|放(?:了)?火|火也?是我放的|买凶|雇凶|找人(?:做掉|解决|绑)|下毒|毒死|逼死|推下(?:楼|去|山崖)|制造意外|动了?刹车|剪了?刹车|刹车[^。！？\n]{0,6}(?:动的?手脚|做的?手脚)|动(?:了|的)?手脚|做(?:了|的)?手脚|嫁祸|栽赃|灭口|掉包|转移(?:资产|财产)|挪用|绑(?:架|了)|绑架|逼(?:她|他)签|伪造的?)/,
    en: /\b(?:switched (?:the|his|her) (?:pills|medicine)|forged (?:the|his|her)?\s?(?:will|signature|documents?)|altered (?:the|his|her) (?:records|books)|set (?:the )?(?:fire|house) on fire|arson|hired (?:a )?(?:killer|hitman|gunman)|paid (?:a )?(?:hitman|killer)|paid (?:someone|him) to (?:kill|do it)|poisoned(?: him| her| them)?|pushed (?:him|her) (?:off|down|from)|staged (?:the accident|an accident|it)|cut the brakes|framed (?:him|her)|embezzled|diverted (?:the )?funds|kidnapped|forced (?:him|her) to sign)\b/i,
  },
  {
    id: 'accomplice',
    zh: /(?:勾结|串通|联手|里应外合|同伙|内鬼|帮凶|买通(?:了)?|被我收买|收了?我[^。！？\n]{0,4}钱|你的(?:好)?(?:闺蜜|兄弟|老公|老婆|妻子|丈夫|秘书|助理|徒弟|干爹)[^。！？\n]{0,8}(?:也|早就|一直)?(?:是|帮我|跟我|有份)|(?:他|她)(?:也|早就|一直)(?:是我的人|跟我一伙|在帮我))/,
    en: /\b(?:working (?:with|for) me|helped me (?:do it|all along)|your own (?:best friend|husband|wife|secretary|assistant|partner)|accomplice|inside (?:man|job)|conspired with|in league with|(?:he|she) was mine all along|we planned it together)\b/i,
  },
  {
    id: 'coldcase',
    zh: /(?:[一二两三四五六七八九十\d]+年前|那天晚上|出事那天|当年|当初|你爸(?:爸)?(?:死|住院|出事)|你妈(?:妈)?(?:死|住院|出事)|那年(?:的)?(?:火灾|车祸|意外))/,
    en: /\b(?:\d+ years? ago|years? ago|that night|the night (?:he|she|it) died|back then|the (?:fire|crash|accident) (?:that|which))\b/i,
  },
  {
    id: 'motive',
    zh: /(?:为了[^。！？\n]{0,12}(?:钱|股份|家产|遗产|公司|权力|位置|上位|报复|出口气|赔偿|保险金)|就因为[^。！？\n]{0,12}|谁让(?:他|她)[^。！？\n]{0,10}(?:挡路|碍事|不识|不肯)|都是(?:他|她)逼我的|我等这?天等了?)/,
    en: /\b(?:all for (?:the )?(?:money|shares|company|inheritance|power|insurance)|for (?:the )?(?:money|shares|company|inheritance|insurance payout)|to get (?:the|your) (?:money|shares|company|inheritance)|because (?:he|she|you) (?:deserved|crossed me|got in my way|wouldn'?t)|(?:he|she) made me do it|i waited years? for this)\b/i,
  },
  {
    id: 'next',
    zh: /(?:明天|今晚|今晚之前|后天|董事会|股东大会|葬礼|轮到你|送你(?:上路|下去|见他|一程)|接下来[^。！？\n]{0,8}(?:你|轮到)|你(?:也|马上)?(?:走不出|活不过|见不到)[^。！？\n]{0,6}|已经安排(?:好|了)人|外面(?:都|全)是我的人|在去[^。！？\n]{0,6}的?路上|人已经(?:在|到))/,
    en: /\b(?:tonight|tomorrow|by (?:sunrise|morning)|the board meeting|your turn|you'?ll never (?:leave|see)|(?:my )?men are (?:already|outside|everywhere)|already taken care of (?:it|everything)|next is (?:you|your))\b/i,
  },
];

/* ───────── rescue ───────── */

const EVIDENCE_ZH = /(?:录音|录像|监控|照片|视频|亲子鉴定|鉴定报告|银行流水|流水账?|U[盘盤]|优盘|邮件|短信|聊天记录|证据|拍到|录到|我查(?:到|清)|我已经(?:知道|查明|查清|查到)|白纸黑字|公章|指纹|目击证人|作证|证据确凿)/;
const EVIDENCE_EN = /\b(?:the recording|footage|cctv|the photo(?:s|graph)?|dna (?:test|evidence|report)|forensic|bank records|the (?:emails?|texts?|messages?)|i already know|i'?ve (?:already )?(?:found|proved|confirmed)|evidence|witness|fingerprints|on tape)\b/i;

const DEAL_ZH = /(?:我(?:可以)?(?:告诉你|说)[^。！？\n]{0,6}(?:但|不过|条件是)|你先(?:放了|答应)|放了(?:他|她|我)[^。！？\n]{0,8}我就|条件是|我只说一次[^。！？\n]{0,8}(?:条件|你保证))/;
const DEAL_EN = /\b(?:if i tell you[^.!\n]{0,20}(?:let|promise|go free)|let (?:him|her|them) go first|you have to (?:promise|let)|only if you|my terms first|i talk only after)\b/i;

const TRAP_ZH = /(?:故意(?:说|认|这么说)|骗(?:他|她|你)的|将计就计|诈(?:他|她|你)|套(?:他|她|你)?的话|引(?:他|她)说话|诈唬|激将|戴罪立功|戴着手铐|戴罪)/;
const TRAP_EN = /\b(?:(?:it|this) was a bluff|trick(?:ed)? (?:him|her) into|fishing for a confession|goading him|provoke(?:d)? him into|wired (?:for sound)|hidden (?:mic|recorder)|false confession)\b/i;

const LEGAL_ZH = /(?:警察|警官|民警|审讯|做笔录|录口供|法庭|法院|自首|逮捕|拘捕|看守所)/;
const LEGAL_EN = /\b(?:police|detective|officer|in court|miranda|under arrest|pressing charges|at the station|confess(?:ing)? to (?:the|a) (?:cop|detective))\b/i;

export interface OverconfessionHit {
  probeLine: number;
  line: number;
  speaker: string;
  kind: 'confess' | 'freebie';
  families: string[];
  snippet: string;
  rescued: boolean;
  rescueLine: number | null;
  reason: string;
}

export interface VillainOverconfessionResult {
  score: number;
  dialogueLines: number;
  hits: OverconfessionHit[];
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
    // 英文全大写台词行（如 INT. OFFICE: …）已被场景头挡掉；再防"FAQ: …"式名词行
    const text = m[2].trim();
    if (isZh || /[a-z]/.test(text)) return { kind: 'dialogue', speaker: m[1].trim(), text };
  }
  return { kind: 'narration', text: t };
}

export function villainOverconfession(draft: string): VillainOverconfessionResult {
  const isZh = isZhText(draft);
  const rawLines = draft.split(/\r?\n/);
  const parsed = rawLines.map((l) => parseLine(l, isZh));
  let dialogueLines = 0;
  for (const p of parsed) if (p.kind === 'dialogue') dialogueLines += 1;

  const hits: OverconfessionHit[] = [];

  for (let i = 0; i < parsed.length; i += 1) {
    const probe = parsed[i];
    if (probe.kind !== 'dialogue') continue;
    const text = probe.text;

    // probe 必须是短问句且指向罪行/背叛
    const isQuestion = isZh
      ? /[？?]/.test(text) || /(?:是不是|为什么|凭什么|怎么|什么|哪|吗|呢|啊|呀)/.test(text)
      : /\?\s*$/.test(text) || /\b(?:did|was|why|how|what|who|when|are you|have you)\b/i.test(text);
    if (!isQuestion) continue;
    if (isZh ? stripLen(text) > 24 : wordCount(text) > 16) continue;
    const probeRe = isZh ? PROBE_ZH : PROBE_EN;
    if (!probeRe.test(text)) continue;

    // probe 自身含证据词也在第二遍扫描中处理（真探方台词计入证据）
    const evidenceRe = isZh ? EVIDENCE_ZH : EVIDENCE_EN;

    // 向下找 confession：允许夹 1 行叙述；空行跳过；场景头/任何台词断
    let target = -1;
    let narrationBetween = 0;
    for (let j = i + 1; j < Math.min(i + 4, parsed.length); j += 1) {
      const p = parsed[j];
      if (p.kind === 'blank') continue;
      if (p.kind === 'header') break;
      if (p.kind === 'narration') {
        narrationBetween += 1;
        if (narrationBetween > 1) break;
        continue;
      }
      if (p.kind === 'dialogue') {
        if (p.speaker !== probe.speaker) target = j;
        break;
      }
    }
    if (target < 0) continue;
    const conf = parsed[target];
    if (conf.kind !== 'dialogue') continue;
    const ctext = conf.text;
    if (isZh ? stripLen(ctext) < 14 : wordCount(ctext) < 9) continue;

    const admitHit = (isZh ? ADMIT_ZH : ADMIT_EN).test(ctext);
    const freebieHit = (isZh ? FREEBIE_ZH : FREEBIE_EN).test(ctext);
    // 附交换条件才开口（"我可以告诉你，但你先放了她/If I tell you, you promise…"）
    // 本身即默示知情，视为准承认，rescue 阶段再凭交易词豁免
    const dealInConf = (isZh ? DEAL_ZH : DEAL_EN).test(ctext);
    const kind: OverconfessionHit['kind'] | null = admitHit || dealInConf ? 'confess' : freebieHit ? 'freebie' : null;
    if (!kind) continue;

    const families: string[] = [];
    for (const fam of FAMILIES) {
      if ((isZh ? fam.zh : fam.en).test(ctext)) families.push(fam.id);
    }
    if (families.length < 2) continue;

    // ── rescue 判定 ──
    let rescued = false;
    let rescueLine: number | null = null;

    // 窗口：probe 前 ≤4 行 + 配对夹行 + confession 后 ≤2 行
    const winLo = Math.max(0, i - 4);
    const winHi = Math.min(parsed.length - 1, target + 2);
    const winTextAt = (k: number): { text: string; speaker: string | null } => {
      const p = parsed[k];
      if (p.kind === 'dialogue') return { text: p.text, speaker: p.speaker };
      if (p.kind === 'narration') return { text: p.text, speaker: null };
      return { text: '', speaker: null };
    };

    // 第一遍：交易条件 / 诈供圈套 / 执法语境——任何位置都豁免
    for (let k = winLo; k <= winHi && !rescued; k += 1) {
      const { text: wtext } = winTextAt(k);
      if (wtext && ((isZh ? DEAL_ZH : DEAL_EN).test(wtext) || (isZh ? TRAP_ZH : TRAP_EN).test(wtext) || (isZh ? LEGAL_ZH : LEGAL_EN).test(wtext))) {
        rescued = true;
        rescueLine = k + 1;
      }
    }
    // 第二遍：证据已摆上桌（叙述行任意位置；台词只认真探方自己说的，
    // 不认反派嘴里的"你没证据"）；但若反派仍主动交代"下一步"，照样蠢
    if (!rescued && !families.includes('next')) {
      for (let k = winLo; k <= winHi && !rescued; k += 1) {
        const { text: wtext, speaker: wspeaker } = winTextAt(k);
        if (!wtext || !evidenceRe.test(wtext)) continue;
        if (wspeaker === null || wspeaker === probe.speaker) {
          rescued = true;
          rescueLine = k + 1;
        }
      }
    }

    const famLabel = isZh
      ? { method: '作案手法', accomplice: '同伙', coldcase: '旧案时间', motive: '动机', next: '下一步计划' }
      : { method: 'method', accomplice: 'accomplice', coldcase: 'cold case', motive: 'motive', next: 'next move' };
    const reason = isZh
      ? `${kind === 'confess' ? '一句空问就秒认' : '主动加料'}，且免费交代${families.map((f) => famLabel[f as keyof typeof famLabel]).join('、')}（${families.length} 族机密）`
      : `${kind === 'confess' ? 'confesses to a vague probe' : 'volunteers extra intel'} across ${families.length} secret categories (${families.join(', ')})`;

    hits.push({
      probeLine: i + 1,
      line: target + 1,
      speaker: conf.speaker,
      kind,
      families,
      snippet: snippet(ctext),
      rescued,
      rescueLine,
      reason,
    });
  }

  const bad = hits.filter((h) => !h.rescued).length;
  const score = bad === 0 ? 100 : bad === 1 ? 75 : Math.max(25, 100 - bad * 24);

  const issues: string[] = hits
    .filter((h) => !h.rescued)
    .map((h) =>
      isZh
        ? `第${h.probeLine}行试探 → 第${h.line}行${h.speaker}：${h.reason}。把信息拆进追查戏：让他抵赖、只承认可被证实的部分，其余靠主角自己找证据拼出来。`
        : `probe L${h.probeLine} → ${h.speaker} L${h.line}: ${h.reason}. Make him deny or admit only what is already provable; let the hero earn the rest through investigation.`,
    );

  const advice = isZh
    ? '反派的嘴是悬疑戏的金库。空手试探换来的全盘招供，等于替编剧给观众发说明书。让他抵赖、反问、倒打一耙；真相按主角付掉的代价分期兑付——证据拍到一件，他才认一件，且绝不主动交代"下一步"。真想写摊牌，先把录音、流水、证人摆上桌，让承认变成被逼到墙角的博弈。'
    : 'A villain who confesses everything to a vague accusation is the narrator in disguise. Make him deny, deflect, or counter-attack; dole out truth in proportion to the evidence the hero has earned — one confirmed fact per piece of proof, never the next move for free. If a confession scene is needed, put the recording, records or witness on the table first so admitting is a forced move, not a gift.';

  return { score, dialogueLines, hits, issues, advice };
}
