import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 被动信息投喂检测（Info Delivery / Plot Fed by Device）
 * -----------------------------------------------------------
 * 创作能力类引擎：戏是人物"撞"出来的，不是"收"到的。
 * AI/网文推进剧情最省事的一招——主角什么都不用做，世界主动给她喂信息：
 *   手机弹出一条消息：母亲病危。
 *   电话那头传来声音："人已经跑了。"
 *   助理快步进来汇报，合同被对方截胡了。
 *   电视新闻正在播报：林氏董事长当场去世。
 *   Her phone buzzed. A text read: the wedding was off.
 * 问题：
 *  1) 主角零能动性——转折凭空送达，她没有选择、没有代价、没有动作，
 *     观众代入的是一个被剧情推着走的人；
 *  2) 戏剧动作变成通知动作——本该正面拍的撞破/对峙/追查，被一条短信替代；
 *  3) 投喂成瘾——每次要推进就响手机，人物从此不长脑子也不长腿。
 *
 * 判定（只扫叙述行）：同一窗口内三者共现才判
 *   渠道（手机/短信/电话/新闻广播/下属来报）
 *   + 内容投递标记（：/显示/写着/传来…说/播报/发来/汇报/read/said/reported…）
 *   + 剧情事件词（病危/跑了/合同/遗嘱/地址/dead/escaped/contract…）
 *
 * 豁免：
 *  - 主角主动取证（抢过手机/逼问/翻聊天记录/黑入/跟踪）——信息是抢来的；
 *  - 只给物件不给内容（一个未接来电/屏幕亮了一下）——那是悬念钩子，归 cliffhanger；
 *  - 配角当面亲口送情报的"信息播报员"纸片人——归 supporting-character；
 *  - 群体转述反应归 crowd-reaction。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface DeliveryHit {
  line: number;
  kind: 'device' | 'broadcast' | 'messenger';
  channel: string;
  snippet: string;
  reason: string;
}

export interface InfoDeliveryResult {
  score: number;
  narrationLines: number;
  hits: DeliveryHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

// 台词行：说话人前缀必须像人名/角色（中文≤4字，避免"手机弹出一条消息："被当成说话人）
const DIALOGUE_ZH_RE = /^[一-鿿A-Za-z0-9·]{1,4}(?:（[^）]{0,12}）)?\s*[：:]\s*\S/;
const DIALOGUE_EN_RE = /^[A-Z][A-Z .'’-]{0,18}?(?:\s*\([^)]{0,20}\))?\s*:\s*\S/;

// 信息到达渠道
const CHANNEL_ZH = [
  { re: /手机(?:弹出|震动?了?|响了?|亮了?|屏幕亮|收到|提示音)|电话(?:响了?|接通|那头|里传来)|来(?:了个)?电|微信(?:消息|弹出|提示)?|短(?:信|信消息)|消息提示|语音留言|未接来电|一条消息/, kind: 'device' as const },
  { re: /(?:电视)?新闻(?:里|中|正在|频道)?(?:播报|报道|插播)|电视(?:里|中|正在)(?:播报|报道|放)|广播(?:里|中)?(?:正在)?(?:播报|报道)|热搜(?:弹出|显示|爆出)/, kind: 'broadcast' as const },
  { re: /(?:助理|秘书|手下|保镖|佣人|保姆|管家|司机|护士|下属|随从|探子)(?:快步|匆匆|急忙|连忙|推门)?(?:进来|上前|靠近|凑过来|低声)?(?:汇报|禀报|报告|来报|通报|传话|耳语)/, kind: 'messenger' as const },
];
// 内容投递标记：渠道之后真的把事件内容说了出来
const CONTENT_MARK_ZH = /[：:][^。！？\n]{2,}|显示|写着|传来[^。！？\n]{0,8}(?:声音|话|嗓音)|开(?:口|了口)|说[，,]|播报|报道|告知|汇报|禀报|报告|来报|通报|传话|通知|发(?:来|送|过来|了过来)|留言|字幕/;
// 被投喂的必须是剧情事件，不是寒暄
const EVENT_ZH = /(病危|去世|死了|死亡|身亡|跑了|逃了|逃走|失踪|被抓|抓到|被捕|出事|真相|地址|位置|下落|行踪|现身|露面|合同|协议|亲子鉴定|遗嘱|遗产|录音|录像|视频|证据|照片|身份|怀孕|住院|病历|车祸|绑架|绑匪|报警|撤诉|起诉|离婚|结婚|取消(?:婚礼|婚约)?|股份|股权|转让|破产|收购|开除|解雇|名单|密码|监控|出轨|偷人|私情|勾结|背叛|陷害|翻盘|反转|败露|曝光|灭口|追杀|复仇|身世)/;
// 主角主动把信息抢到手：有动作能动性，不判
const ACTIVE_ZH = /(抢过|夺过|一把(?:夺|抢)|追问|逼问|质问|套(?:话|出)|翻(?:遍|出|到)|查(?:到|了|遍|实)|黑(?:进|入)|跟踪|蹲守|撬开|偷听|偷看|录(?:下|音取证)|顺藤摸瓜|诈(?:他|她|出)|诈话|钓(?:出|鱼)|设局|埋伏|假装|冒充|比对|核实|当面(?:戳穿|对质)|堵(?:住|在))/;

const CHANNEL_EN = [
  { re: /\b(?:phone(?:\s+screen)?(?:\s+buzz(?:ed|ing)?|\s+rang|\s+lit up|\s+ping(?:ed|ing)?)|(?:her|his|their) phone|text(?:\s+message)?(?:\s+from|\s+popped up)?|notification popped up|voicemail|missed call)\b/i, kind: 'device' as const },
  { re: /\b(?:news(?:\s+(?:anchor|report|broadcast|channel))?(?:\s+reported|\s+was reporting)?|tv(?:\s+was)?\s+reporting|breaking news|broadcast(?:\s+announced)?)\b/i, kind: 'broadcast' as const },
  { re: /\b(?:assistant|bodyguard|maid|butler|chauffeur|driver|nurse|aide|subordinate|henchman)(?:\s+rushed|\s+hurried|\s+burst|\s+came|\s+stepped|\s+appeared)?(?:\s+in|\s+up|\s+over|\s+inside)?[^.]{0,24}?(?:report(?:ed)?|announced|informed|whispered|notified)\b/i, kind: 'messenger' as const },
];
const CONTENT_MARK_EN = /:[^.\n]{2,}|"[^"]{2,}"|“[^”]{2,}”|\b(?:read|said|saying|announced|reported|report|reporting|informed|notified|showed|revealed|voicemail(?:\s+said)?)\b/i;
const EVENT_EN = /\b(?:dead|died|death|killed|ran away|escaped|gone missing|missing|arrested|caught|the truth|address|location|whereabouts|contract|deal|dna(?:\s+test)?|will|inheritance|recording|footage|evidence|photo(?:s|graph)?|identity|pregnant|hospital|medical record|car crash|kidnapped|called the police|dropped the charges|sued|divorce|wedding(?:\s+(?:is|was))?\s+(?:off|called off)|called off the wedding|shares|stake|transferred|bankrupt|acquisition|fired|cctv|cheating|affair|colluded|betrayed|framed|exposed|silenced|real identity)\b/i;
const ACTIVE_EN = /\b(?:grabbed|snatched|seized|demanded(?:\s+answers)?|pressed(?:\s+him|\s+her)?|interrogated|dug through|scrolled through|hacked(?:\s+into)?|tracked|staked out|broke into|eavesdropped|confronted(?:\s+him|\s+her)?\s+with|tricked(?:\s+him|\s+her)?\s+into|fished for|set a trap|ambushed|pretended to be|cross-checked|verified)\b/i;

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function infoDelivery(draft: string): InfoDeliveryResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const channels = isZh ? CHANNEL_ZH : CHANNEL_EN;
  const contentRe = isZh ? CONTENT_MARK_ZH : CONTENT_MARK_EN;
  const eventRe = isZh ? EVENT_ZH : EVENT_EN;
  const activeRe = isZh ? ACTIVE_ZH : ACTIVE_EN;
  const dialogueRe = isZh ? DIALOGUE_ZH_RE : DIALOGUE_EN_RE;
  const WIN = isZh ? 34 : 120;

  const lines = draft.split(/\r?\n/);
  const hits: DeliveryHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (dialogueRe.test(line)) return;
    narrationLines++;

    if (activeRe.test(line)) return; // 主角主动取证，信息是抢来的

    for (const { re, kind } of channels) {
      const m = line.match(re);
      if (!m || m.index === undefined) continue;
      const hi = Math.min(line.length, m.index + m[0].length + WIN);
      const window = line.slice(Math.max(0, m.index - 8), hi);
      if (contentRe.test(window) && eventRe.test(window)) {
        hits.push({
          line: i + 1, kind, channel: m[0].slice(0, 12), snippet: snippet(line),
          reason: isZh
            ? '剧情转折由渠道主动送达、主角当场接收——她没有为这条信息付出任何动作或代价，本该正面拍的追查/撞破变成了通知'
            : 'the plot turn is delivered by a channel and passively received — the character pays no action or cost for it; investigation or discovery that should be played on screen becomes a notification',
        });
        break;
      }
    }
  });

  const score = Math.max(25, 100 - hits.length * 11);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」靠${h.kind === 'device' ? '手机/短信/电话' : h.kind === 'broadcast' ? '新闻广播' : '他人来报'}投喂信息——改成主角自己撞破：让她为这条信息走错门、翻错东西、付一笔代价，或让送信息的人当面扣住一半，逼她出手抢`
      : `L${h.line} "${h.snippet}" is fed by ${h.kind === 'device' ? 'a device' : h.kind === 'broadcast' ? 'a broadcast' : 'a messenger'} — let the character discover it herself: make her walk into the wrong room, search the wrong thing, pay a price; or have the messenger withhold half of it so she has to seize the rest`);

  const advice = isZh
    ? hits.length > 0
      ? '好剧本里信息是"抢"来的或"撞破"的：追查、对峙、偷看、设局，人物必须为知道付出代价。手机只负责让事情更麻烦（电话在最不该响时响、内容真假难辨），不负责替她推进剧情。必须送的信息，让送信人带着自己的立场当面给。'
      : '信息都由人物行动获得，无装置投喂，保持。'
    : hits.length > 0
      ? 'In a good script, information is seized or stumbled on: investigation, confrontation, snooping, a trap — the character pays to know. A phone should make things harder (ringing at the worst moment, a message whose truth is uncertain), never advance the plot for her. If news must arrive, have the messenger bring it face to face, with their own agenda.'
      : 'Information is earned through character action with no device-feeding; keep it.';

  return { score, narrationLines, hits, issues, advice };
}
