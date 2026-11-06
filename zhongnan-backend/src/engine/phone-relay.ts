import { isSceneHeaderLine } from './script-scenes';
/**
 * 电话传话机检测（v2.80 块75，创作能力类）
 * ------------------------------------------------------------------
 * 病象：关键事件发生在画面之外，编剧懒得切过去拍，就让主角举着手机
 * 把对方的话一句句"复读"给观众听：
 *   林晚：（接起）喂？……什么？！他死了？在哪家医院？……你们别动，我马上到！
 *   "你说……沈总把合同签了？"
 *   英文：VICTOR: What?! He's dead? Say that again. I'll be right there.
 * 观众听见的不是一场戏，是一条新闻播报。事故/死亡/反转全靠问号和
 * 复述转述，信息没有动作、没有面孔、没有现场，悬念在电话接通那一刻
 * 就已经泄完了。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - character-presence：管【挂断后还在通话】的幽灵对答，不管通话内容；
 *  - exposition-dialogue / info-delivery：管面对面台词倾倒，不针对
 *    单边电话+复读回声这个特定套路；
 *  - action-echo：管动作被台词复述（"你打我？"），不管画外事件。
 *
 * 判定（只在电话语境窗口内）：
 *  - ≥3 条复读式回声（什么？/你确定？/再说一遍/我马上到……），或
 *  - ≥2 条回声且至少 1 条内容复读（"你说他死了？"把新闻原样念回）。
 * 豁免：
 *  - INTERCUT/切到另一边/电话那头出声（V.O. 台词）——观众能看到现场；
 *  - 非电话语境的"什么！"（当面震惊）不判。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface PhoneRelayHit {
  anchorLine: number;
  speaker: string;
  lines: number[];
  echoes: number;
  contentEchoes: number;
  snippets: string[];
  reason: string;
}

export interface PhoneRelayResult {
  score: number;
  calls: number;
  hits: PhoneRelayHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const SPEAKER_RE_ZH = /^([一-鿿A-Za-z0-9·]{1,6})(?:（([^）]{0,24})）)?\s*[：:]\s*(.+)$/;
const SPEAKER_RE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\(([^()]{0,40})\))?\s*:\s*(.+)$/;

/* 电话语境锚点（动作行或台词行） */
const CUE_ZH = /(?:电话|手机)(?:响(?:起|了)?|震(?:动|了)?|亮(?:起|了)?|打来|来电)|接(?:起|通|过)?(?:电话|手机)|按下(?:接听|通话键)|(?:贴|放|举)到耳边|听筒|来电显示|视频电话|正在(?:通话|呼叫)|电话那头|喂[，,。？?]|电话里(?:说|传来)|冲(?:着|向)手机|对着电话/;
const CUE_EN = /\b(?:phone(?: (?:rang|buzzed|lit up|rings|call|started ringing))?|cell(?:\s?phone)? (?:rang|buzzed|lit up|started ringing)|incoming call|answered (?:the|his|her|their )?phone|picked up(?: the phone)?|put(?:ting)? (?:the|his|her) phone to (?:his|her) ear|on the(?: other end of the)? line|said into the phone|hello[,.?]?\s|held the phone|faceTime|video call|voice on the phone)\b/i;

/* 对切/另一边可见 → 豁免 */
const INTERCUT_ZH = /(?:镜头|画面)?切(?:到|换)(?:电话)?(?:另一|对面|那)?(?:边|头|侧)|另一(?:边|头)(?:的声音|传来)|电话那(?:边|头)的声音|与此同时|画外(?:音)?[：:]|△.*(?:电话|听筒)那(?:边|头)/;
const INTERCUT_EN = /\b(?:INTERCUT|CUT TO|ANGLE ON|the other end of the line|on the other end|meanwhile[,:]? (?:at|in)|V\.?O\.?|O\.?S\.?|CALLER(?:\s*\()?|VOICE(?: ON (?:THE )?PHONE)?)\b/;

/* 复读式回声（不含实质内容，只表示"我在接收震惊消息"） */
const ECHO_ZH = /(?:^|[^一-鿿])(?:什么[？?！!…]*$|你说什么|你再说(?:一遍|一次)|再说一遍|你确定|真的吗|是真的吗|怎么会|不可能[。！？?？]?|谁(?:啊|干的)[？?]|在哪(?:里|儿)?(?:家医院|哪家医院)?[？?]?|什么(?:时候|时间)的事|你们?(?:先)?别(?:动|挂)|别挂|我马上(?:到|来|过去|安排)|怎么可能|你等(?:着|一下)|他人呢|送哪家医院|哪家医院)/;
const ECHO_EN = /\b(?:what[?!.]*|what did (?:you|she|he|they) say|say that again|come again|are you (?:sure|kidding|serious)|really[?!.]*|for real[?!.]*|who[?!.]*|who did|where[?!.]*|which hospital|when did this happen|how(?: is that possible| could this)|no way|impossible|don(?:'t| not) move|don(?:'t| not) hang up|stay there|i(?:'ll| will) be right (?:there|down|over)|i(?:'m| am) on my way|wait there|where is he)\b/i;

/* 内容复读：把对方刚说的事实原样念回来（最糟——新闻播报本体；1 句即触发） */
const CONTENT_ZH = /(?:你(?:是说|的意思是)|你给我说清楚|你是?说[……，,]?)(?:[^。！？!?]{0,20})(?:死了|没了|签了|跑了|逃了|自首|报警|抓(?:住|到|了)|怀孕|出轨|是他|回来了|输了|赢了|破产|结婚|离婚|失踪|绑架|车(?:祸)?|坠楼|跳(?:楼|河))|他(?:真的)?(?:死了|没了|出事了)[？?]?|沈?总把?[^。！？!?]{0,8}(?:签了|卖了|撤了)[？?]?/;
const CONTENT_EN = /\b(?:you(?:'re| are) telling me|you mean to tell me|let me get this straight|so (?:you(?:'re| are) saying|he's|she's|they(?:'re| are)|he is|she is)|he's dead\?*|she's dead\?*|he is dead\?*|she is dead\?*|he (?:actually )?(?:signed(?: the papers)?|turned himself in|escaped|is gone)\?*|she signed(?: the papers)?\?*|the deal went through\?*|you called the cops\?*)\b/i;

interface Line {
  no: number;
  text: string;
}

export function phoneRelay(draft: string): PhoneRelayResult {
  if (!draft || !draft.trim()) {
    return { score: 100, calls: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(draft);
  const cueRe = zh ? CUE_ZH : CUE_EN;
  const echoRe = zh ? ECHO_ZH : ECHO_EN;
  const contentRe = zh ? CONTENT_ZH : CONTENT_EN;
  const intercutRe = zh ? INTERCUT_ZH : INTERCUT_EN;
  const speakerRe = zh ? SPEAKER_RE_ZH : SPEAKER_RE_EN;

  const lines: Line[] = draft.split(/\r?\n/).map((t, i) => ({ no: i + 1, text: t.trim() }))
    .filter((l) => l.text.length > 0);

  const hits: PhoneRelayHit[] = [];
  let calls = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (!cueRe.test(lines[i].text)) continue;
    calls += 1;
    // 窗口：锚点起 12 个非空行，遇场景头截断
    const window: Line[] = [];
    for (let j = i; j < Math.min(lines.length, i + 13); j += 1) {
      if (j > i && isSceneHeaderLine(lines[j].text)) break;
      window.push(lines[j]);
    }
    // 豁免：对切/另一边出声（窗口内任何一行）
    if (window.some((l) => intercutRe.test(l.text))) continue;

    let anchorSpeaker = '';
    const echoLines: { no: number; text: string; content: boolean; n: number }[] = [];
    let echoTotal = 0;
    let contentTotalSeq = 0;
    for (const l of window) {
      const m = l.text.match(speakerRe);
      if (!m) continue;
      const speaker = m[1];
      const paren = m[2] ?? '';
      const speech = m[3];
      // 电话那头被写成台词（V.O./画外/对方）→ 双面对话，豁免
      if (/(?:画外|电话|听筒|对方|V\.?O|O\.?S|CALLER|VOICE)/i.test(speaker + paren)) {
        echoLines.length = 0;
        echoTotal = 0;
        contentTotalSeq = 0;
        break;
      }
      if (!anchorSpeaker) anchorSpeaker = speaker;
      // 按分句计回声（经典病象常是一行内"什么？！他死了？我马上到！"三连）
      const segs = speech.split(/[。！？!?…\n]+/).map((s) => s.trim()).filter(Boolean);
      let n = 0;
      let contentN = 0;
      for (const seg of segs) {
        if (echoRe.test(seg)) n += 1;
        if (contentRe.test(seg)) contentN += 1;
      }
      const isContentWhole = contentRe.test(speech);
      if (n > 0 || contentN > 0 || isContentWhole) {
        echoTotal += n;
        contentTotalSeq += contentN + (isContentWhole && contentN === 0 ? 1 : 0);
        echoLines.push({ no: l.no, text: speech.slice(0, 40), content: contentN > 0 || isContentWhole, n });
      }
    }

    const triggered = contentTotalSeq >= 1 || echoTotal >= 3;
    if (triggered) {
      hits.push({
        anchorLine: lines[i].no,
        speaker: anchorSpeaker,
        lines: echoLines.map((e) => e.no),
        echoes: echoTotal,
        contentEchoes: contentTotalSeq,
        snippets: echoLines.slice(0, 4).map((e) => e.text),
        reason: zh
          ? `第${lines[i].no}行起的单边电话（${anchorSpeaker}）连续 ${echoTotal} 句复读式回声${contentTotalSeq > 0 ? `，其中 ${contentTotalSeq} 句把对方的话原样念回（${echoLines.filter((e) => e.content).map((e) => `第${e.no}行`).join('、')}）` : ''}——画外事件被当成新闻播报`
          : `One-sided call from L${lines[i].no} (${anchorSpeaker}) strings ${echoTotal} relay echoes${contentTotalSeq > 0 ? `, ${contentTotalSeq} of them parroting the news back (${echoLines.filter((e) => e.content).map((e) => `L${e.no}`).join(', ')})` : ''} — an offscreen event delivered as a news bulletin`,
      });
    }
    // 无论是否命中，跳过已覆盖窗口，避免一通电话从"喂"重复计数
    i += window.length - 1;
  }

  const contentTotal = hits.reduce((s, h) => s + h.contentEchoes, 0);
  const score = Math.max(20, 100 - hits.length * 40 - contentTotal * 10);

  const issues = hits.map((h) => (zh
    ? `电话传话机：${h.reason}`
    : `Phone relay crutch: ${h.reason}`));

  const advice = zh
    ? [
        '重要事件不许只在电话里转述——直接切到现场拍：人在急诊门口、合同在桌上被推回去、抓捕时手机从口袋里响',
        '必须保留通话，就让信息带刺、不复读：只给半句话（"人没了。"）然后挂断，让主角带着没问完的问题行动',
        '禁止"什么？他死了？你再说一遍？我马上到！"三连——观众要的是看见事件发生，不是听角色替他们念新闻',
      ]
    : [
        'Never relay the big event only through a phone call — cut to the event itself: the ER entrance, the contract pushed back across the desk, the phone buzzing in a pocket during the arrest',
        'If the call must stay, give a shard and hang up: "He is gone." then silence, and let the character move with the question still unasked',
        'Ban the "What?! He is dead? Say that again! I will be right there!" triple relay — the audience must see the event, not hear it read aloud as a news bulletin',
      ];

  return { score, calls, hits, issues, advice };
}

/**
 * 前置教学：buildPhoneRelayDirective(_format='LIVE', lang='zh')
 * -------------------------------------------------------------
 * 同源铁律：教学函数与检测器 phoneRelay 同文件；format 不门控（LIVE/AIGC/缺省一致）。
 * 目的：撰写师/润色师首轮即拿到"单边电话 12 行窗口数复读回声"的检测口径，
 *       避免写完被 prePolish phoneRelayHint 与 craft/deai 复评打回。
 */
export function buildPhoneRelayDirective(_format: string = 'LIVE', lang: string = 'zh'): string {
  if (lang === 'en') {
    return [
      '【Phone Relay Pre-Writing Briefing (same source as phoneRelay: 12-line window after a phone cue; 40 per hit + 10 per content echo; floor 20)】',
      '- Trigger: a phone-context cue line first (phone ringing / buzzing / incoming call / answered the phone / picked up / held the phone to the ear / on the other end of the line / said into the phone / hello,), then count a 12 non-empty line window from it; stop at the next scene header.',
      '- Only "speaker: line" lines inside the window are counted; action lines and scene headers are ignored.',
      '- Relay echoes (no content, just "I am receiving shocking news"): what? / what did you say / say that again / come again / are you sure / really / for real / how could this / impossible / who / where / which hospital / when did this happen / do not move / do not hang up / I will be right there / I am on my way / wait there / where is he.',
      '- Content echo (parroting the fact back - the worst kind): you are telling me / you mean to tell me / let me get this straight / so you are saying + he is dead / she is dead / he signed / he escaped / he turned himself in / the deal went through; or "he is dead?" / "he actually signed?".',
      '- Count per clause: split each line on sentence punctuation - "What?! He is dead? I will be right there!" is 3 echoes, not 1.',
      '- Threshold: content echo >= 1, or echo count >= 3; either one records a hit.',
      '- Exemption 1: the window shows the other side (INTERCUT / CUT TO / ANGLE ON / voice on the other end / meanwhile / V.O. / O.S. / CALLER) - the audience can see the scene, so no hit.',
      '- Exemption 2: the speaker is written as VOICE / CALLER / V.O. / O.S. / the other end - that is a two-sided call, the whole call is exempt.',
      '- Exemption 3: a non-phone "What!" (shock in person) is not judged - there must be a real phone cue line.',
      '- Score: max(20, 100 - hits x 40 - contentEchoes x 10); empty draft = 100.',
      '- Rewrite direction: cut to the event itself (the ER entrance, the contract pushed back across the desk, the phone buzzing in a pocket during the arrest). If the call must stay, give a shard - "He is gone." - then hang up and let the character move with the question still unasked.',
      '- Division of labor: info-delivery owns narration where a channel pushes the event forward; this engine only judges one-sided phone dialogue echo. character-presence owns ghost answering after the hang-up; action-echo owns actions retold in dialogue.',
      '- Pipeline consumption: prePolish lists every hit into the polisher hint (phoneRelayHint); craft initial, craft re-eval and deai rescan the same result.',
      '- Self-check: does the audience SEE this news, or is it read out by a character? After deleting every "What?!", how many lines of this call still carry information?',
    ].join('\n');
  }
  return [
    '【电话传话机·前置教学（检测同源：phoneRelay 单边电话 12 行窗口数复读回声，每条命中扣 40 + 每句内容复读再扣 10，20 分封底）】',
    '- 触发条件：先要有电话语境锚点行（电话/手机响/震动/打来/来电/接起/接听/贴到耳边/听筒/来电显示/视频电话/电话那头/喂，/电话里说），再从该行起算 12 个非空行作为窗口；遇场头立即截断。',
    '- 窗口内只数「角色：台词」行；△ 动作行、场头不参与计数。',
    '- 复读回声（无语义、只表示“我在接收震惊消息”）：什么？/你说什么/你再说一遍/再说一遍/你确定/真的吗/是真的吗/怎么会/不可能/谁啊/在哪/哪家医院/什么时候的事/你们别动/别挂/我马上到/我马上来/我马上过去/怎么可能/你等着/他人呢/送哪家医院。',
    '- 内容复读（把对方刚说的事实原样念回，最糟）：你（是）说 + 死了/没了/签了/跑了/逃了/自首/报警/抓住/怀孕/出轨/是他/回来了/输了/赢了/破产/结婚/离婚/失踪/绑架/车祸/坠楼/跳楼/跳河；或「他真的死了？」「他出事了？」。',
    '- 分句计数：一行里按 。！？!?… 分句逐句数——「什么？！他死了？我马上到！」算 3 句回声，不是 1 句。',
    '- 判定阈值：内容复读 ≥1 句即中；或回声 ≥3 句即中。二者满足其一就记一条命中。',
    '- 豁免一：窗口内出现对切/另一边可见（切到电话另一边/电话那头的声音/与此同时/画外音：/INTERCUT/CUT TO/V.O./O.S./CALLER）——观众能看到现场，不判。',
    '- 豁免二：说话人写成「画外/电话/听筒/对方/V.O./O.S./CALLER/VOICE」——双面对话，整通电话不判。',
    '- 豁免三：非电话语境的「什么！」（当面震惊）不判，必须有上面那类电话锚点行。',
    '- 得分：score = max(20, 100 - 命中条数 × 40 - 内容复读总句数 × 10)；空稿 100。',
    '- 改写方向：重要事件直接切现场（急诊门口、合同被推回、抓捕时手机在口袋响）；必须留通话就只给半句「人没了。」然后挂断，让主角带着没问完的问题行动。',
    '- 与 info-delivery 分界：info-delivery 管叙述行里渠道把事件送到眼前；本引擎只判单边电话台词复读。character-presence 管挂断后还在通话的幽灵对答；action-echo 管动作被台词复述。',
    '- pipeline 消费：prePolish 逐条列命中注入润色师（phoneRelayHint）；craft 初评、craft 复评、deai 复扫同一结果。',
    '- 成稿自查：这条新闻观众是看见的，还是被角色念出来的？删掉所有「什么？！」这通电话还剩几句有信息？',
  ].join('\n');
}
