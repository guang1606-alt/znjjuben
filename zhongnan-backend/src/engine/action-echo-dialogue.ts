import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 动作回声台词检测（Action-Echo Dialogue）
 * ============================================================
 * 治什么病：
 *   物理动作/关系决裂刚在镜头前演完，角色偏要用台词把这件事
 *   再念一遍确认——把冲击稀释成问答，给慢半拍的观众发字幕：
 *     他一巴掌甩在她脸上。
 *     林晚：你打我？你居然打我？
 *     她把戒指摘下搁在桌上。
 *     顾母：你要跟他离婚？
 *     He tore the contract in two.
 *     LILY: You ripped up the contract?
 *   镜头的力量靠"发生"成立，一旦被复述成问句，狠劲泄掉一半。
 *
 * 判定（只认真回声，求精度）：
 *  1) 当前行为台词（话者≤4字），上一拍为紧邻叙述行（换场即清空）；
 *  2) 台词为动作回声：
 *     question 型——问号结尾，含回声动作（打/扇/撕/扔/摔/推/摘/
 *       跪/签/离/带走… 或 hit/slap/tear/throw/leave/divorce…）；
 *     confirm 型——≤12字短句、无问号、"你真把X撕了"式确认；
 *  3) 叙述行确实刚演出同一动作：按动作家族归并同义词（一巴掌甩
 *       ↔打↔扇↔slap↔hit；扔进火里↔烧）；强家族直接认定，宽
 *       动作必须在 ±10 字窗口带物理/决裂语境，并排除假朋友
 *      （打电话/推门/亲自/离开/告诉…）；
 *     另有道具映射：叙述行推来离婚协议/辞职信/传票，台词问
 *     "离婚？/辞职？/告我？"也算回声。
 *  豁免/接住：
 *   - 全片第一次回声不罚（人物确认现实是合法节拍），第 2 次起 charged；
 *   - rescued：问句之后带画面之外的新信息（律师/抚养权/董事会/
 *     净身出户/明天见，lawyer/custody/board/tomorrow…），或下一
 *     非空行立即落实决定——复述+要价是真冲突，只复述才是病；
 *   - 长台词（zh>22字/en>16词）默认在表达观点，放行。
 *
 * 边界（查重后确认）：
 *   - mirror-visual 管"陈述句+这/那开头"复述眼前静物，本引擎管
 *     疑问句/确认句回声刚发生的动作（mirror 明确豁免"你居然打我？"）；
 *   - echo-dialogue 管"叙述行复述台词"，方向相反；
 *   - empty-threat 管不兑现的狠话，与本引擎正交。
 *
 * 计分：bad=0 → 100；1 → 80；≥2 → max(30, 100-n*22)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^[一-鿿A-Za-z0-9·]{1,4}(?:（[^）]{0,12}）)?\s*[：:]\s*(.+)$/;

const stripPunc = (s: string): string => s.replace(/[，。！？、…：；""''（）()【】《》\s,.!?:;'"()\[\]<>-]/g, '');
const snippet = (s: string, n = 24): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/* ─────────────── 中文动作家族 ───────────────
 * strong: 家族字在叙述行出现即可（过假朋友检查）；imply: 不出现
 * 家族字也认定（一巴掌甩↔打；扔进火里↔烧）。weak: 必须带语境。 */

interface ZhFamily {
  id: string;
  members: string[];
  strong: boolean;
  imply?: RegExp;
  falseFriend?: RegExp; // 以命中字为锚的假朋友复合词
}

const FAM_ZH: ZhFamily[] = [
  { id: 'strike', members: ['打', '扇', '抽', '捶', '砸'], strong: true, imply: /(?:一巴掌|一耳光|耳光|巴掌|拳头|一拳|挥拳)/, falseFriend: /打(?:电话|招呼|车|扰|算|发|听|开|工|扫|水|火|字|量|趣|扮|针|气|赌|捞|岔|探|劫|伞|猎|搅|磨|更|捞|猎|听)/ },
  { id: 'tear', members: ['撕', '扯'], strong: true, falseFriend: /扯(?:皮|淡|嗓子)/ },
  { id: 'throw', members: ['扔', '摔'], strong: true },
  { id: 'push', members: ['推', '拽'], strong: true, falseFriend: /推(?:门|开|辞|荐|迟|脱|翻|倒|测|广|进|子)/ },
  { id: 'kiss', members: ['亲', '吻'], strong: true, falseFriend: /亲(?:自|手|眼|生|属|戚|口?朋|密|和|政)/ },
  { id: 'burn', members: ['烧'], strong: true, imply: /(?:扔进火|丢进火|丢入火|付之一炬|点着了?火|火盆)/ },
  { id: 'splash', members: ['泼'], strong: true },
  { id: 'choke', members: ['掐'], strong: true },
  { id: 'bite', members: ['咬'], strong: true, falseFriend: /咬牙/ },
  { id: 'kneel', members: ['跪'], strong: true },
  { id: 'remove', members: ['摘'], strong: true, falseFriend: /摘(?:菜|要|录|抄|编)/ },
  { id: 'hold', members: ['抱'], strong: false },
  { id: 'sign', members: ['签'], strong: false },
  { id: 'divorce', members: ['离'], strong: false, falseFriend: /离(?:开|职|家|别|远|散|席|境|队|校|休|奇|愁|合)/ },
  { id: 'lock', members: ['锁'], strong: false },
  { id: 'del', members: ['删'], strong: false },
  { id: 'takeaway', members: ['带走'], strong: false },
  { id: 'cancel', members: ['取消'], strong: false },
  { id: 'sue', members: ['告'], strong: false, falseFriend: /告(?:诉|别|白|假|辞|一段|终|警|急)/ },
];

const CUE_ZH = ['当场', '戒指', '婚戒', '合同', '协议', '照片', '证据', '录音', 'U盘', '脸上', '嘴上', '门', '地上', '桌上', '怀里', '门外', '眼镜', '信', '手机', '孩子', '名字', '字', '锁', '怀里', '胳膊', '手腕', '公章', '账户'];

// 道具→台词事件词映射（道具刚被推/递/甩出来，台词确认事件）
const PROP_ZH: { prop: RegExp; event: RegExp }[] = [
  { prop: /(?:离婚协议|婚书|喜帖|聘礼)/, event: /(?:离婚|退婚|不结了|分手)/ },
  { prop: /辞职信/, event: /辞职/ },
  { prop: /(?:传票|律师函|法院通知)/, event: /(?:告我|起诉|坐牢|被告)/ },
  { prop: /(?:解约通知|终止合同|解除协议)/, event: /(?:解约|终止|解除)/ },
  { prop: /亲子鉴定/, event: /(?:孩子不是|不是你的|亲生)/ },
];

// 画面之外的新信息：问句带着要价/决定/转折
const RESCUE_ZH = /(?:律师|警察|报警|董事会|股东|股权|股份|条件|抚养|孩子|净身出户|法庭|法院|起诉|遗产|遗嘱|证据|录音|律师函|等着|后悔|明天|后天|下周|周[一二三四五六日天]|下个月|分手费|赔偿|登报|曝光|媒体|监护权|探视|财产|房贷|公司|公章|账户|冻结|亲子鉴定)/;
// 下一行立即落实决定
const RESCUE_NEXT_ZH = /(?:拿起(?:电话|手机)|拨通|当场(?:签|宣布|决定)|转身(?:就)?(?:走|离开)|甩门|摔门|头也不回)/;

const SUBJ_ZH = '(?:你|你们|他|她|他们|她们|咱|我们|我)';

/* ─────────────── English 动作家族 ─────────────── */

interface EnFamily {
  id: string;
  strong: boolean;
  re: RegExp;
}

const FAM_EN: EnFamily[] = [
  { id: 'strike', strong: true, re: /\b(?:hit|hits|hitting|slap|slaps|slapped|slapping|punch|punches|punched|punching|struck)\b/ },
  { id: 'tear', strong: true, re: /\b(?:tear|tears|tore|torn|tearing|rip|rips|ripped|ripping)\b/ },
  { id: 'throw', strong: true, re: /\b(?:throw|throws|threw|thrown|throwing|toss|tosses|tossed|tossing|fling|flung)\b/ },
  { id: 'push', strong: true, re: /\b(?:push|pushes|pushed|pushing|shove|shoves|shoved|shoving)\b/ },
  { id: 'kiss', strong: true, re: /\b(?:kiss|kisses|kissed|kissing)\b/ },
  { id: 'burn', strong: true, re: /\b(?:burn|burns|burned|burnt|burning|set (?:it|the \w+) on fire)\b/ },
  { id: 'strangle', strong: true, re: /\b(?:strangle|strangles|strangled|strangling|choke|choked|choking)\b/ },
  { id: 'bite', strong: true, re: /\b(?:bite|bites|bit|bitten|biting)\b/ },
  { id: 'drag', strong: true, re: /\b(?:drag|drags|dragged|dragging)\b/ },
  { id: 'grab', strong: true, re: /\b(?:grab|grabs|grabbed|grabbing|snatch|snatches|snatched|snatching|yank|yanks|yanked|yanking)\b/ },
  { id: 'kneel', strong: false, re: /\b(?:kneel|kneels|knelt|kneeling|drop(?:s|ped)? to (?:his|her|their) knees)\b/ },
  { id: 'lock', strong: false, re: /\b(?:lock|locks|locked|locking)\b/ },
  { id: 'leave', strong: false, re: /\b(?:leave|leaves|left|leaving|walk(?:s|ed)? out)\b/ },
  { id: 'divorce', strong: false, re: /\b(?:divorce|divorces|divorced|divorcing)\b/ },
  { id: 'cancel', strong: false, re: /\b(?:cancel|cancels|canceled|cancelled|canceling|cancelling)\b/ },
  { id: 'sign', strong: false, re: /\b(?:sign|signs|signed|signing)\b/ },
  { id: 'take', strong: false, re: /\b(?:take|takes|took|taken|taking)\b/ },
];

const EN_CUE = /\b(?:across the face|across his face|across her face|cheek|fist|swung|raised (?:his|her) hand|hard|snatched|grabbed|yanked|ripped|slammed|to the floor|on the desk|on the table|contract|papers|agreement|ring|photo|phone|door|wrist|arm|arms|lips|knees|name)\b/i;

const EN_PROP: { prop: RegExp; event: RegExp }[] = [
  { prop: /\bdivorce papers\b/i, event: /\bdivorc/ },
  { prop: /\bresignation letter\b/i, event: /\bresign/ },
  { prop: /\b(?:subpoena|summons|cease[ -]and[ -]desist)\b/i, event: /\b(?:sue|sued|charg(?:e|es|ing)|court)\b/ },
  { prop: /\btermination notice\b/i, event: /\bterminat/ },
  { prop: /\bpaternity test\b/i, event: /\b(?:not his|isn'?t his|biological)\b/ },
];

const RESCUE_EN = /\b(?:lawyer|attorney|police|custody|board|shareholder|shares|settlement|court|sue|sued|charges|evidence|recording|inheritance|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|press|expose|restraining order|prenup|alimony|freeze|account|company seal|paternity)\b/i;
const RESCUE_NEXT_EN = /\b(?:picked up the phone|called the cops|dialed (?:his|her) lawyer|signed (?:the|his|her) papers|turned and (?:walked|left)|slammed the door|without looking back)\b/i;

export interface ActionEchoHit {
  line: number;
  speaker: string;
  kind: 'question' | 'confirm' | 'prop';
  action: string;
  narration: string;
  dialogue: string;
  charged: boolean;
  rescued: boolean;
  reason: string;
}

export interface ActionEchoResult {
  score: number;
  dialogueLines: number;
  hits: ActionEchoHit[];
  issues: string[];
  advice: string;
}

/** 中文：字 c 在 s 中出现且不是假朋友复合词 */
function zhRealOccurrence(s: string, c: string, fake?: RegExp): boolean {
  let from = 0;
  for (;;) {
    const idx = s.indexOf(c, from);
    if (idx < 0) return false;
    const tail = s.slice(idx, idx + 6);
    const isFake = fake ? fake.test(tail) : false;
    // fake 正则可能不以 c 锚定，双重确认复合词确实从 c 开始
    if (!isFake) return true;
    from = idx + 1;
  }
}

/** 中文：家族是否在叙述行落地（强直接/imply，弱需 cue 窗口） */
function zhLanded(narration: string, fam: ZhFamily): boolean {
  const realMember = fam.members.some((m) => zhRealOccurrence(narration, m, fam.falseFriend));
  if (fam.strong && (realMember || (fam.imply && fam.imply.test(narration)))) return true;
  if (!fam.strong && realMember) {
    return fam.members.some((m) => {
      const idx = narration.indexOf(m);
      if (idx < 0) return false;
      const win = narration.slice(Math.max(0, idx - 10), idx + m.length + 10);
      return CUE_ZH.some((c) => win.includes(c));
    });
  }
  return false;
}

/** 中文：台词中命中的家族（且该字在台词里不是假朋友） */
function zhDialogueFamily(text: string): ZhFamily | null {
  for (const fam of FAM_ZH) {
    if (fam.members.some((m) => zhRealOccurrence(text, m, fam.falseFriend))) return fam;
  }
  return null;
}

/** English：在 line 中出现且（宽家族）带语境的家族 */
function enFamilies(line: string, requireCue: boolean): EnFamily[] {
  const out: EnFamily[] = [];
  for (const fam of FAM_EN) {
    const m = fam.re.exec(line);
    if (!m) continue;
    if (fam.strong) { out.push(fam); continue; }
    if (!requireCue) { out.push(fam); continue; }
    const win = line.slice(Math.max(0, m.index - 40), m.index + 41);
    if (EN_CUE.test(win)) out.push(fam);
  }
  return out;
}

export function actionEchoDialogue(draft: string): ActionEchoResult {
  if (!draft || !draft.trim()) {
    return { score: 100, dialogueLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const hits: ActionEchoHit[] = [];
  let dialogueLines = 0;
  let lastNarration = '';

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { lastNarration = ''; return; }
    const dm = line.match(SPEAKER_RE);
    if (!dm) { lastNarration = line.replace(/^（.+）\s*/, '').trim(); return; }
    if (!lastNarration) return;

    dialogueLines++;
    const sm = line.match(/^([一-鿿A-Za-z0-9·]{1,4})(?:（[^）]{0,12}）)?\s*[：:]/);
    const speaker = sm ? sm[1] : '';
    const text = dm[1].trim();
    const bare = isZh ? stripPunc(text) : text;
    // 疑问句看首个句段（"你打我？律师函明天就到。"是回声问+要价，不是陈述句）
    const firstSeg = text.split(/[。！.!]/)[0];
    const isQ = /[？?]/.test(firstSeg);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // 长台词：在表达观点/控诉，放行
    if (isZh ? bare.length > 22 : wordCount > 16) return;

    let kind: ActionEchoHit['kind'] | null = null;
    let action = '';

    if (isZh) {
      const dFam = zhDialogueFamily(bare);
      const landed = dFam ? zhLanded(lastNarration, dFam) : false;
      if (isQ) {
        const head = new RegExp(`^${SUBJ_ZH}(?:竟然|居然|竟敢|敢|真的?|这是|要|想|就|也|还)?(?:把|将|跟|和|向)?`);
        if (dFam && landed && head.test(bare)) { kind = 'question'; action = dFam.members.find((m) => bare.includes(m)) || dFam.id; }
        // 道具→事件映射
        if (!kind) {
          const pm = PROP_ZH.find((p) => p.prop.test(lastNarration) && p.event.test(bare));
          if (pm) { kind = 'prop'; action = (bare.match(pm.event) || [''])[0]; }
        }
      } else if (bare.length <= 12 && /(?:真的?|竟然|居然)/.test(bare)) {
        // confirm 型：你真把合同撕了
        if (dFam && landed) { kind = 'confirm'; action = dFam.members.find((m) => bare.includes(m)) || dFam.id; }
      }
    } else {
      const dFams = enFamilies(text, false);
      const nFams = enFamilies(lastNarration, true);
      const shared = dFams.find((d) => nFams.some((n) => n.id === d.id));
      if (isQ && /^(?:you|he|she|they|we|i)\b/i.test(text) && shared) {
        kind = 'question'; action = shared.id;
      } else if (!isQ && wordCount <= 8 && /\b(?:actually|really|did|just)\b/i.test(text) && shared) {
        kind = 'confirm'; action = shared.id;
      }
      if (!kind && isQ) {
        const pm = EN_PROP.find((p) => p.prop.test(lastNarration) && p.event.test(text));
        if (pm) { kind = 'prop'; action = 'papers'; }
      }
    }

    if (!kind) return;

    // rescued：问句带画面之外的新信息，或紧邻下一拍立即落实决定
    let rescued = isZh ? RESCUE_ZH.test(text) : RESCUE_EN.test(text);
    if (!rescued) {
      for (let k = i + 1; k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        rescued = isZh ? RESCUE_NEXT_ZH.test(near) : RESCUE_NEXT_EN.test(near);
        break;
      }
    }

    const charged = hits.length >= 1; // 全片第一次回声是合法节拍
    hits.push({
      line: i + 1,
      speaker,
      kind,
      action,
      narration: snippet(lastNarration, 30),
      dialogue: snippet(text, 30),
      charged,
      rescued,
      reason: isZh
        ? '动作刚在镜头前演完，台词立刻把它复述成问句/确认句，冲击被稀释成问答'
        : 'the action just played on screen and the line immediately restates it as a question, dissolving the blow into Q&A',
    });
  });

  const bad = hits.filter((h) => h.charged && !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 80 : Math.max(30, 100 - n * 22);
  const issues = bad.map((h) => (isZh
    ? `第${h.line}行${h.speaker ? `（${h.speaker}）` : ''}：「${h.dialogue}」回声了上一拍（${h.narration}）——${h.reason}；删掉确认句，或在回声后立刻跟画面之外的要价/决定（律师、抚养权、明天的局）`
    : `L${h.line}${h.speaker ? ` (${h.speaker})` : ''}: "${h.dialogue}" echoes the previous beat (${h.narration}) — ${h.reason}; cut the confirmation or follow it instantly with a demand the picture cannot show (lawyer, custody, tomorrow's trap)`));
  const advice = isZh
    ? '动作不复读。观众眼睛刚看见的事，角色不许再用嘴确认一遍——"你打我？"问出口，那巴掌就白打了。全片最多留一次确认现实的节拍；同样的力气，要么沉默（让动作自己砸下来），要么把台词花在画面之外：要价、翻旧账、宣布下一步。'
    : 'Never read the action back. What the eyes have just seen must not be confirmed aloud — ask "You hit me?" and the slap loses half its force. Allow one reality-check beat per script at most. Spend the line instead on what the picture cannot show: a price, an old debt, the next move — or say nothing and let the blow land.';

  return { score, dialogueLines, hits, issues, advice };
}
