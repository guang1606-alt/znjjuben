import { isSceneHeaderLine } from './script-scenes';
/**
 * 通讯失灵拐杖检测（v2.80 块84，创作能力类）
 * ------------------------------------------------------------------
 * 病象：关键信息要传递时，通讯恰好失灵——正要打给律师，没信号；
 * 正要报警，手机没电；正要说真相，电话断了。编剧把"联系不上"
 * 当万能剧情阀门，反复用它扣押关键信息、拖延误会、制造假紧张：
 *   △她正要打给林总，手机却没了信号。
 *   △再拨，依然是无法接通。
 *   "这山里没有信号。"她盯着黑掉的屏幕说。
 *   She tries to call for help — no signal. Again.
 * 一次是紧张感，第二次观众就开始盘算"你为什么不发短信"。通讯
 * 失灵必须改变故事走向（因为联系不上而真的付出代价），而不是
 * 白嫖观众的耐心；角色必须有换方案的动作，不能干等信号。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - continuitySupervision：管跨集"设备复活"穿帮（前文手机摔烂
 *    后文又能打，device_resurrection），本引擎管同稿创作套路——
 *    失灵本身被当阀门反复使用，场景相反；
 *  - misunderstandingDrag：管人物主动拒听挂断（hung up/我不听），
 *    本引擎只收技术性失灵（没信号/没电/无法接通/占线），主动
 *    挂断不判；
 *  - confrontationDodge：管对峙被外部信号掐断，本引擎管信息传递
 *    通道被通讯故障反复掐断；
 *  - phoneRelay：管电话单边复读转述，与故障无关。
 *
 * 判定：
 *  - 通讯失灵短语命中（没信号/打不通/无法接通/没电/关机/占线/
 *    busy tone/no signal/call dropped…），且 ±2 行窗口内出现
 *    信息传递语境（打给/报警/求救/真相/证据/trying to call/
 *    warn/the truth…）——纯环境描写（深山没信号）无语境放行；
 *  - 相邻 2 行内的失灵表述视为同一事件（"没信号"+"再拨还是
 *    打不通"只计 1 次）；跨场景头重置，各自算一次阀门使用；
 *  - 第 1 次豁免（一次性故障是合法紧张感），第 2 次起每次 1 hit；
 *  - rescue（±2 行出现换方案补救）：发短信/留言/当面说/亲自去/
 *    托人带话/借手机/座机/sends a text/leaves a voicemail/in
 *    person/borrows a phone——角色在解决问题，不是干等信号；
 *  - 计分（结构性病，命中即成立）：n=1 → 70，每多 1 处 −20，
 *    封底 20；n=0 → 100。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface CommFailCrutchHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否被救援（失灵后角色换方案补救，没干等信号） */
  rescued: boolean;
  reason: string;
}

export interface CommFailCrutchResult {
  score: number;
  /** 通讯失灵阀门总次数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: CommFailCrutchHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* 失灵分两档：SELF 自带传递语境（"打不通"本身就是一次失败的传递尝试）；
   STATE 仅设备状态（"没信号/没电"），必须 ±2 行内出现传递语境才算阀门。
   主动挂断/拒接归 misunderstandingDrag，不在此列。 */
const FAIL_SELF_ZH = /打不通|拨不通|拨不出去|无法接通|占线|忙音|断线|掉线|电话断了|通话中断/;
const FAIL_STATE_ZH = /没(?:有|了)?信号|信号不好|信号很差|信号中断|信号消失|不在服务区|无服务|手机(?:自动)?关机|电量耗尽|没电了|手机坏了|手机黑屏/;

const FAIL_SELF_EN = /\b(?:can(?:no)?'?t (?:get through|connect)|call(?:s)? (?:won'?t go through|drops?|dropped|failed)|the line (?:went dead|cut out)|busy tone|engaged tone)\b/i;
const FAIL_STATE_EN = /\b(?:no signal|no reception|no bars|out of (?:range|coverage)|dead zone|no service|unreachable|phone (?:is |'s )?dead|phone dies|battery(?:'s| is)? dead|dead battery|disconnected|switched off|powered off)\b/i;

/* 信息传递语境：失灵必须卡在"正要传递"上才算阀门，纯环境描写放行 */
const CONTEXT_ZH = /打给|拨(?:通|号|出去)|打电话|再拨|重拨|报警|求救|救命|急着(?:告诉|通知|联系)|要告诉|必须告诉|马上告诉|通知|真相|证据|秘密|出事|地址|行踪|下落|联系不|告诉她|告诉他|告诉他们|救援|急救/;

const CONTEXT_EN = /\b(?:call(?:s|ed|ing)? (?:him|her|them|the police|for help|back|again)|about to (?:call|dial|tell)|trying to (?:call|reach|warn|tell|get through)|need to (?:call|tell|warn|reach)|warn(?:s|ed|ing)?|the truth|the evidence|the secret|emergency|for help|the address|the location|call (?:an )?ambulance)\b/i;

/* 救援：失灵后角色换方案补救——问题在被解决，不是干等信号 */
const RESCUE_ZH = /发了?(?:条|个)?短信|发消息|发了?微信|语音留言|留言|发邮件|写信|托人|当面(?:把|说|告诉)|亲自(?:去|跑|上门|赶)|跑去|开车(?:去|赶)|赶过去|爬上高处|走上山顶|找(?:到)?信号|借(?:了)?(?:部|个)?手机|用(?:了)?座机|公用电话|固定电话|充上电|修好(?:了)?手机/;

const RESCUE_EN = /\b(?:sends? (?:a )?(?:text|message|an email)|leaves? (?:a )?voicemail|writes? (?:a|her|his) (?:note|letter)|in person|goes? (?:there|over)|drives? over|runs? over|borrows? (?:a|another|her|his) phone|the landline|a payphone|finds? (?:a spot with )?signal|charges? (?:the|his|her) phone)\b/i;

/**
 * 纯函数：检测"没信号/没电/打不通"式通讯失灵当剧情阀门的套路。
 */
export function commFailCrutch(draft: string): CommFailCrutchResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const failSelfRe = zh ? FAIL_SELF_ZH : FAIL_SELF_EN;
  const failStateRe = zh ? FAIL_STATE_ZH : FAIL_STATE_EN;
  const contextRe = zh ? CONTEXT_ZH : CONTEXT_EN;
  const rescueRe = zh ? RESCUE_ZH : RESCUE_EN;

  const hits: CommFailCrutchHit[] = [];
  let hitCount = 0;
  let sceneIdx = -1;
  let header = '';
  let prevFailLine = -10;

  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { sceneIdx += 1; header = line; prevFailLine = -10; return; }
    const m = line.match(failSelfRe) || line.match(failStateRe);
    if (!m) return;
    const selfContained = failSelfRe.test(line);
    /* 相邻 2 行内的失灵表述 = 同一事件（"没信号"+"再拨不通"），不重复计 */
    if (i - prevFailLine <= 2) { prevFailLine = i; return; }
    prevFailLine = i;

    /* 语境检查：设备状态类需 ±2 行内有信息传递意图，"打不通"类自带语境 */
    const lo = Math.max(0, i - 2);
    const hi = Math.min(rawLines.length - 1, i + 2);
    const win = rawLines.slice(lo, hi + 1).join('\n');
    if (!selfContained && !contextRe.test(win)) return;

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
          ? '通讯失灵又在卡关键信息——联系不上的紧张感被白嫖，角色既不换方案也不付出代价'
          : 'the connection fails again right when the news matters — borrowed tension, no plan B, no cost',
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
      ? `${hitCount} 处"没信号/没电/打不通"式通讯失灵当剧情阀门（${n} 处未救）——关键信息靠联系不上来扣押，一次是紧张感，第二次观众就开始盘算你为什么不发短信。`
      : `${hitCount} comm-fail beats (${n} unrescued) — no signal, dead battery, can't get through, always exactly when the news matters. Once is tension; twice, the audience starts asking why nobody sends a text.`);
    advice.push(zh
      ? '通讯失灵不许当万能剧情阀门——正要打给律师就没信号、正要报警就没电、正要说真相就断线，观众看穿这是作者扣押信息的快捷方式。要么给角色换方案的动作：发短信、留语音、托人带话、当面说、亲自跑一趟，信息必须送出去；要么让失灵付出真代价：因为联系不上，她错过了最后一面、他背了三年黑锅——失灵必须改变故事走向，而不只是把误会拖到下一集。深山断网可以有，但要在一开始就立成规则（她进山前把手机锁进柜子），别等剧情要用时才"恰好没信号"。'
      : 'Comm failure is not a plot valve — no signal the moment she dials her lawyer, dead battery the moment he tries to call an ambulance, the line cuts the second the truth is due. The audience sees the author parking the information. Give the characters a plan B: send a text, leave a voicemail, send word with someone, go in person — the message must get out. Or make the failure cost something real: because the call never connected, she missed the last goodbye, he carried the blame for three years. Failure must change the story, not stretch the misunderstanding into next episode. A dead zone is allowed if it is established as a rule up front — she locked her phone in the locker before entering the mountains — never "conveniently" right when the plot needs it.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
