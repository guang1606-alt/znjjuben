/**
 * v2.133 配角工具人/群像质量检测器（Supporting Character Check）
 *
 * 竖屏短剧人物驱动的暗病：主角立住了，配角全是道具。四类纸片人：
 * 1. echo_sidekick（high）捧哏型：多句台词全是"嗯/真的吗/天哪/然后呢/你说得对"，
 *    零自我欲望，只负责给主角递话筒
 * 2. info_dispenser（mid）信息播报员：一张嘴就是"告诉你个消息/报告/董事长说/这是你要的文件"，
 *    存在的唯一意义是送情报，没有自己的事
 * 3. desireless_supporter（mid）无欲望保姆："我陪你/我帮你/你没事吧/别担心"连篇，
 *    全天候为主角情绪服务，自己没有想要的东西
 * 4. offstage_mouthpiece（low）只动嘴的纸片人：多句台词却从未在动作描写里出现，
 *    没有一个属于自己的动作
 * 另有全局型 praise_chorus（low）夸夸群像：配角排着队"不愧是你/真厉害"
 *
 * 与现有引擎的分工：
 * - character-logic.tool_support：单句功能性龙套（只有一句）
 * - character-balance-check：戏份比例/龙套计数（量的均衡）
 * - voice-print：角色声口是否雷同（说法像不像）
 * - supporting-character-check（本引擎）：有名有姓、多句台词的配角有没有自己的欲望与动作（质）
 *
 * 离线启发式（纯函数、零 IO、可离线对拍）：中英双语，中文层为单一事实源。
 */
import { parseDialogue, type CastMap } from './character-logic';
import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源

export type ScLang = 'zh' | 'en';

export interface SupportingIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'echo_sidekick' | 'info_dispenser' | 'desireless_supporter' | 'praise_chorus' | 'offstage_mouthpiece';
  evidence: string;
  advice: string;
}

export type CharFlag = 'echo_sidekick' | 'info_dispenser' | 'desireless_supporter' | 'offstage_mouthpiece';

/** 单个配角的工具人画像 */
export interface SupportingCharReport {
  name: string;
  lineCount: number;
  /** 纯承接反应句数（嗯/真的吗/天哪/然后呢） */
  reactLines: number;
  /** 信息播报句数 */
  infoLines: number;
  /** 服务主角句数（陪/帮/安慰） */
  serveLines: number;
  /** 吹捧主角句数 */
  praiseLines: number;
  /** 反应句占比 0-1 */
  reactRatio: number;
  /** 自我欲望/立场/能动性信号数 */
  desireHits: number;
  /** 非对白行（动作/叙述）中名字出现次数 */
  actionMentions: number;
  flags: CharFlag[];
}

export interface SupportingCharacterResult {
  score: number;
  /** 有台词的角色数 */
  speakingChars: number;
  /** 主角名（cast 首位或台词最多者） */
  protagonist: string;
  /** 参检配角数（≥3 句且非主角） */
  supportingChars: number;
  /** 命中任一问题的配角数 */
  toolChars: number;
  echoCount: number;
  dispenserCount: number;
  desirelessCount: number;
  offstageCount: number;
  praiseChorus: boolean;
  /** 全部参检配角画像（按台词数降序） */
  characters: SupportingCharReport[];
  issues: SupportingIssue[];
}

// —— 中文信号库 ——
// 纯承接反应：零信息、零立场、零推进，只会给主角递话筒
const REACT_ZH = /(?:嗯+|嗯嗯|哦哦?|啊？|啊！|哇+|哇塞|天哪|天啊|我的天|真的(?:吗|假的)|不会吧|不是吧|然后呢|后来呢|所以呢|你说什么|太棒了|太好了|太过分了|怎么会|不可能吧|好厉害|真厉害|厉害啊|牛逼|牛啊|666|对哦|是哦|有道理|你说得对|说得也是|我就知道|加油|别难过|抱抱|诶？|哎？|我的妈呀|啧啧)/;
// 自我欲望/立场/能动性：配角"是个人"而不是道具的证据
const DESIRE_ZH = /(?:我要|我想|我打算|我决定|我绝(?:不|要)|我偏|我必须|我不愿|我拒绝|我答应|我保证|我的(?:梦想|人生|公司|未来|孩子|儿子|女儿|账|事)|凭什么|该我|轮到我|我受够了|我不干了|我辞职|我退出|我同意|我反对|我怀疑|我查到|我发现|我去查|我查过|我调查过|让我来|交给我|我来处理|我来想办法|我选择|我偏不|这是我的)/g;
// 服务型：存在的全部意义是围着主角转
const SERVE_ZH = /(?:我帮你|帮帮你|我陪你|我送你|我接你|我给你|我替你|我带你|我等你|我支持你|我相信你|你没事吧|你还好吗|你别吓我|喝点(?:水|汤|茶)|先坐下|别冲动|冷静点|别担心|别害怕|有我在|我这就去|需要我.{0,6}吗|有什么.{0,4}需要|我扶你|我背你|我守着你)/;
// 信息播报：人形喇叭
const INFO_ZH = /(?:告诉你个?消息|跟你说个事|报告(?:一下|！|!|，|,|：|:|\s|$)|禀报|查到了|调查结果|根据.{0,12}(?:显示|记录|资料|报告)|文件(?:上|里)写|通知你一声|让我转告|董事长说|老板说|医生说|刚收到消息|新闻(?:说|报道)|据我所知|我听说|把这个给你|这是你要的|来电说|电话里说)/;
// 吹捧：夸夸群像
const PRAISE_ZH = /(?:不愧是|佩服佩服|实在是高|你是最棒的|还是你行|就知道你最|大神|大佬|高，?实在是高)/;

// —— 英文信号库 ——
const REACT_EN = /\b(?:yeah+|yep|yup|uh-huh|mhm|hmm+|wow+|oh my god|omg|really\?|no way|then what\?|and then\?|you don't say|that's amazing|that's awesome|incredible|poor (?:thing|you)|are you ok(?:ay)?\?|you ok(?:ay)?\?|you're right|i know,? right|oh no|whoa|what\?)\b/i;
const DESIRE_EN = /\b(?:i want|i need|i'?m gonna|i am going to|i'?ve decided|i decided|i will|i won'?t|i refuse|i promise|my (?:dream|company|life|future|son|daughter)|enough is enough|i quit|i'?m done|i agree|i disagree|i suspect|i found out|let me (?:handle|do|talk|see|go|take|guess)|i'?ll handle|i'?m taking|i choose)\b/gi;
const SERVE_EN = /\b(?:let me help|i'?ll help|i can help|i'?ll come with|let me come|i'?ll (?:drive|take|walk) you|i'?ve got you|i'?m with you|i believe in you|are you (?:alright|okay)|you (?:alright|okay)\??|calm down|sit down|drink some|do you need (?:anything|me)|anything you need|i'?ll be (?:right )?here|don'?t worry|let it out)\b/i;
const INFO_EN = /\b(?:i have (?:some )?news|(?:i'?ve )?got news|the report says?|according to|the records? (?:show|say)|i was told to|mr\.? [a-z]+ (?:asked|told) me to|the doctor says?|just got word|word is|i heard that|asked me to (?:give|hand)|here(?:'s| are) the (?:documents?|files?|papers?))\b/i;
const PRAISE_EN = /\b(?:you'?re amazing|you'?re incredible|as expected of you|only you could|you'?re the best|that'?s our [a-z]+|impressive|brilliant|you never cease|so impressive|well done)\b/i;

function countMatches(text: string, re: RegExp): number {
  let n = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    n++;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return n;
}

/** 行级命中（每次重置 lastIndex，g 标志正则可安全复用） */
function lineHits(line: string, re: RegExp): boolean {
  re.lastIndex = 0;
  return re.test(line);
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

// c213：场头判定收口共享切分器 script-scenes（旧正则把任意【开头行当场头）

/**
 * v2.133 配角工具人/群像质量检测
 * @param text 剧本正文
 * @param cast 人物卡（可选，首位视为主角）
 * @param lang 语言
 */
export function supportingCharacterCheck(
  text: string,
  cast: CastMap | null | undefined,
  lang: ScLang = 'zh',
): SupportingCharacterResult {
  const empty: SupportingCharacterResult = {
    score: 100,
    speakingChars: 0,
    protagonist: '',
    supportingChars: 0,
    toolChars: 0,
    echoCount: 0,
    dispenserCount: 0,
    desirelessCount: 0,
    offstageCount: 0,
    praiseChorus: false,
    characters: [],
    issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const isZh = lang === 'zh';
  const REACT = isZh ? REACT_ZH : REACT_EN;
  const DESIRE = isZh ? DESIRE_ZH : DESIRE_EN;
  const SERVE = isZh ? SERVE_ZH : SERVE_EN;
  const INFO = isZh ? INFO_ZH : INFO_EN;
  const PRAISE = isZh ? PRAISE_ZH : PRAISE_EN;

  const dialogues = parseDialogue(text);
  if (dialogues.length < 6) return { ...empty };

  // —— 按角色聚合台词 ——
  const byName = new Map<string, typeof dialogues>();
  for (const d of dialogues) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name)!.push(d);
  }
  const nameLineCount = new Map<string, number>();
  for (const [name, dLines] of byName) nameLineCount.set(name, dLines.length);
  const namesDesc = Array.from(nameLineCount.keys()).sort((a, b) => nameLineCount.get(b)! - nameLineCount.get(a)!);

  const declaredLead = cast && Object.keys(cast).length > 0 ? Object.keys(cast)[0] : null;
  const protagonist = declaredLead ?? namesDesc[0] ?? '';
  const speakingChars = byName.size;
  if (speakingChars < 2) return { ...empty, speakingChars, protagonist };

  // —— 动作/叙述行中的名字出现（对白行、场景标题行除外）——
  const actionMentions = new Map<string, number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) continue;
    // 对白行归台词，不算动作（宽松匹配 "名字："/"名字（情绪）："/"Name:"）
    if (/^[一-龥A-Za-z·]{1,6}(?:（[^）]*\))?[：:]/.test(line)) continue;
    for (const name of byName.keys()) {
      if (line.includes(name)) actionMentions.set(name, (actionMentions.get(name) ?? 0) + 1);
    }
  }

  // —— 逐配角画像（≥3 句才参检，1-2 句的龙套归 character-balance 管）——
  const reports: SupportingCharReport[] = [];
  for (const name of namesDesc) {
    if (name === protagonist) continue;
    const dLines = byName.get(name)!;
    const lineCount = dLines.length;
    if (lineCount < 3) continue;

    let reactLines = 0;
    let infoLines = 0;
    let serveLines = 0;
    let praiseLines = 0;
    for (const d of dLines) {
      if (lineHits(d.text, REACT)) reactLines++;
      if (lineHits(d.text, INFO)) infoLines++;
      if (lineHits(d.text, SERVE)) serveLines++;
      if (lineHits(d.text, PRAISE)) praiseLines++;
    }
    const allText = dLines.map((d) => d.text).join(' ');
    const desireHits = countMatches(allText, DESIRE);
    const reactRatio = reactLines / lineCount;
    const infoRatio = infoLines / lineCount;
    const serveRatio = serveLines / lineCount;
    const functionalRatio = (reactLines + infoLines + serveLines) / lineCount;

    const flags: CharFlag[] = [];
    // echo 优先于 info/desireless：一个角色同一主导病根只记一条（互斥链）
    if (lineCount >= 4 && desireHits === 0 && reactRatio >= 0.6) {
      flags.push('echo_sidekick');
    } else if (desireHits === 0 && infoLines >= 2 && infoRatio >= 0.4) {
      flags.push('info_dispenser');
    } else if (
      lineCount >= 4 &&
      desireHits === 0 &&
      serveLines >= 2 &&
      (reactRatio >= 0.3 || serveRatio >= 0.4)
    ) {
      flags.push('desireless_supporter');
    }
    // 零动作是独立维度，可与功能病根叠加
    if (lineCount >= 4 && desireHits === 0 && (actionMentions.get(name) ?? 0) === 0 && functionalRatio >= 0.6) {
      flags.push('offstage_mouthpiece');
    }

    reports.push({
      name,
      lineCount,
      reactLines,
      infoLines,
      serveLines,
      praiseLines,
      reactRatio: Math.round(reactRatio * 100) / 100,
      desireHits,
      actionMentions: actionMentions.get(name) ?? 0,
      flags,
    });
  }

  // —— 全局：夸夸群像（两人各吹 ≥1 句，或一人吹 ≥3 句）——
  const praisers = reports.filter((r) => r.praiseLines >= 1);
  const totalPraise = praisers.reduce((s, r) => s + r.praiseLines, 0);
  // 不足 3 句未进 reports 的角色也要计入夸奖（一句话的"不愧是你"同样是群像噪声）
  for (const [name, dLines] of byName) {
    if (name === protagonist || reports.some((r) => r.name === name)) continue;
    const p = dLines.filter((d) => lineHits(d.text, PRAISE)).length;
    if (p > 0) praisers.push({ name, lineCount: dLines.length, reactLines: 0, infoLines: 0, serveLines: 0, praiseLines: p, reactRatio: 0, desireHits: 0, actionMentions: 0, flags: [] });
  }
  const praiseChorus = praisers.length >= 2 || totalPraise >= 3 || praisers.some((r) => r.praiseLines >= 3);

  const echoChars = reports.filter((r) => r.flags.includes('echo_sidekick'));
  const dispenserChars = reports.filter((r) => r.flags.includes('info_dispenser'));
  const desirelessChars = reports.filter((r) => r.flags.includes('desireless_supporter'));
  const offstageChars = reports.filter((r) => r.flags.includes('offstage_mouthpiece'));
  const toolChars = reports.filter((r) => r.flags.length > 0).length;

  const issues: SupportingIssue[] = [];
  let penalty = 0;

  if (echoChars.length) {
    penalty += Math.min(16 + (echoChars.length - 1) * 4, 24);
    const names = echoChars.map((c) => `「${c.name}」`).join('、');
    issues.push({
      severity: 'high',
      type: 'echo_sidekick',
      evidence: isZh
        ? `${names} ${echoChars.length} 个配角只剩捧哏功能——台词多为"嗯/真的吗/天哪/然后呢/你说得对"，零自我欲望`
        : `${echoChars.map((c) => `"${c.name}"`).join(', ')} — ${echoChars.length} supporting character(s) only echo ("yeah/really?/wow/then what?"), zero desires of their own`,
      advice: isZh
        ? '捧哏不是人，是个人形收音麦。给这个配角一句"我自己的事"：他有求于主角什么、他瞒着什么、他反对什么——哪怕只露半句。把第三句"真的吗"改成他带着自己的目的来递话，观众立刻觉得这人有戏。'
        : 'An echo is not a character, it\'s a human mic. Give this side character their own stake in one line: what they want from the lead, what they hide, what they oppose. Replace the third "really?" with dialogue that serves their own agenda — the audience instantly senses a real person.',
    });
  }

  if (dispenserChars.length) {
    penalty += Math.min(10 * dispenserChars.length, 16);
    const names = dispenserChars.map((c) => `「${c.name}」`).join('、');
    issues.push({
      severity: 'mid',
      type: 'info_dispenser',
      evidence: isZh
        ? `${names} 一张嘴就是播报——"告诉你个消息/报告/董事长说/这是你要的文件"，只为送情报存在`
        : `${dispenserChars.map((c) => `"${c.name}"`).join(', ')} only speaks to deliver intel ("I have news/the report says/according to/here are the documents")`,
      advice: isZh
        ? '情报不要让人"送"，要让人"抢"或"漏"。让播报员对这条情报有立场：他扣下一半、他添油加醋、他送完情报提一个自己的条件。同一条消息，经过他的欲望过滤，戏就长在他身上了。'
        : 'Intel should never be "delivered" — it gets seized or leaked. Give the messenger a stake in the message: they withhold half, slant it, or attach their own condition to it. The same news, filtered through their desire, gives them a scene of their own.',
    });
  }

  if (desirelessChars.length) {
    penalty += Math.min(8 * desirelessChars.length, 14);
    const names = desirelessChars.map((c) => `「${c.name}」`).join('、');
    issues.push({
      severity: 'mid',
      type: 'desireless_supporter',
      evidence: isZh
        ? `${names} 全程"我陪你/我帮你/你没事吧/别担心"——全天候服务主角，自己什么都不想要`
        : `${desirelessChars.map((c) => `"${c.name}"`).join(', ')} exists only to support the lead ("I'll help/are you okay/don't worry"), wanting nothing personally`,
      advice: isZh
        ? '闺蜜/兄弟不是主角的情绪保姆。给他一条与主角错位的小目标：他劝主角放手其实是怕事连累自己，他递来的鸡汤背后有自己的委屈。让他在一场戏里为自己的利益犹豫三秒，配角就活了。'
        : 'A best friend is not the lead\'s emotional nanny. Give them a goal that diverges from the hero: they urge caution because the fallout would hit them, their comfort speech hiding their own grievance. Let them hesitate three seconds over their own interest — the side character comes alive.',
    });
  }

  if (praiseChorus) {
    penalty += 6;
    issues.push({
      severity: 'low',
      type: 'praise_chorus',
      evidence: isZh
        ? `配角排着队夸主角：${praisers.map((c) => `「${c.name}」×${c.praiseLines}`).join('、')}——夸夸群像把爽点喊成了口号`
        : `Supporting characters queue to praise the lead: ${praisers.map((c) => `"${c.name}"×${c.praiseLines}`).join(', ')} — a cheering chorus turns the win into a slogan`,
      advice: isZh
        ? '爽不靠别人喊"不愧是你"，靠对手的反应反衬。把直白夸奖改成具体的后果：配角不说话，默默把合同改了；或者先不服、被打脸后才服。群像的态度有温差，主角的强才立得住。'
        : 'A win isn\'t proven by a chorus chanting "you\'re amazing" — it\'s proven by consequences. Replace direct praise with behavior: a rival quietly revises the contract, or a doubter won over only after being proven wrong. Temperature differences in the ensemble make the lead\'s strength real.',
    });
  }

  if (offstageChars.length) {
    penalty += Math.min(4 * offstageChars.length, 8);
    const names = offstageChars.map((c) => `「${c.name}」`).join('、');
    issues.push({
      severity: 'low',
      type: 'offstage_mouthpiece',
      evidence: isZh
        ? `${names} 有多句台词，动作/叙述描写中却从未出现——只动嘴不动身的纸片人`
        : `${offstageChars.map((c) => `"${c.name}"`).join(', ')} has multiple lines but never appears in any action/description line — a disembodied voice`,
      advice: isZh
        ? '让他的身体也上场：进门时带一个只属于他的动作（攥着手机/把钥匙拍在桌上/不敢坐），离场时再给一个反应镜头。有动作的台词才有重量，观众才记得住这张脸。'
        : 'Put their body onscreen: one character-specific action on entry (clutching the phone, slamming keys down, refusing to sit) and a reaction beat on exit. Dialogue with movement behind it has weight — and a face the audience remembers.',
    });
  }

  reports.sort((a, b) => b.lineCount - a.lineCount);
  issues.sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.severity] - { high: 0, mid: 1, low: 2 }[b.severity]));

  return {
    score: clamp(100 - penalty),
    speakingChars,
    protagonist,
    supportingChars: reports.length,
    toolChars,
    echoCount: echoChars.length,
    dispenserCount: dispenserChars.length,
    desirelessCount: desirelessChars.length,
    offstageCount: offstageChars.length,
    praiseChorus,
    characters: reports,
    issues,
  };
}
