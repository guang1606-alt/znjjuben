import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 证人无动机倾倒检测（Witness Gratuity / The Helpful Stranger）
 * ============================================================
 * 治什么病：
 *   块67 治"反派自己开口"，本引擎治"知证人替编剧开口"——主角刚
 *   坐下、问了句"当年到底怎么回事"，老管家/老护士/离职员工就用
 *   第三人称把情报套餐免费端上桌：
 *     林晚：福伯，当年我妈是怎么走的？
 *     福伯：是你继父换了太太的药！那本换药记录就锁在他书房
 *     保险柜里，密码是你生日。他明晚还要去码头，把保姆也做
 *     掉灭口，当年是他买通的护工张姐！
 *   一句话五样货：罪行、证据位置、密码、时间表、下一步、同伙。
 *   说话的人不怕、不躲、不还价、不给理由——知道这种秘密的人
 *   守了十年嘴，见到女主角五分钟就开记者会，这不是人物，是
 *   编剧戴着证人的假发在替主角跑调查线。
 *
 * 判定（只扫台词，按连续同人发言合并 turn）：
 *   1) 套餐：同一 turn 命中 ≥2 类情报族，且必含 deed（罪行）或
 *      evidence（证据）；族类：deed 罪行 / evidence 证据位置 /
 *      whenWhere 时间地点 / next 下一步 / accomplice 同伙动机；
 *   2) 第三人称：内容指向"他/她/老板/老爷/Mr."——第一人称认罪
 *      （是我害死的/I killed）归 villain-overconfession，此处不收；
 *   3) 取证成本核验（turn 前 10 行 + turn 后 3 行）：
 *      - 无成本开口（reluctance）：犹豫/压低声音/关门/我发过誓；
 *      - 主角施压或付费（extract）：逼问/亮证据/塞钱/开价/堵门；
 *      - 证人给动机（motive）：他也害过我女儿/我欠你妈一条命/
 *        我快不行了/他连我也要灭口；
 *      - 安全承诺（promise）：我保证不说是你/我保护你；
 *      - 职务行为（duty）：警察/检察官/律师/法庭作证；
 *      - 说完付代价（riskAfter）：被跟踪/被开除/被灭口。
 *      豁免规则：motive / extract / duty / riskAfter 任一成立即
 *      豁免；promise 单独成立即豁免（谈判已发生）；reluctance 只
 *      有在"仅 2 族小漏口"时豁免（冒险挤出一条），大套餐不豁免。
 *
 * 廉价加压（证据，不改变豁免）：
 *   bundle：≥3 族（套餐越大越离谱）；
 *   volunteer：前 6 行连别的角色台词都没有，自己主动开讲；
 *   emptyAsk：前 6 行最近一句他人台词是空问（怎么回事/告诉我/
 *   what happened/tell me）。
 *
 * 边界（查重后确认）：
 *   - villain-overconfession：反派第一人称自爆，本引擎管第三人称；
 *   - eavesdrop-dump：说话人不知有第三者（叙述行撞听），本引擎
 *     管知情者当面对主角说；
 *   - info-delivery：手机/广播/信使"通知到了"（叙述行），本引擎
 *     管面对面的人证口述；
 *   - exposition-dialogue：两个在场人互讲已知背景（as you know），
 *     本引擎要求新情报含罪行或证据族。
 *
 * 计分：100 起，每未豁免 hit −28，bundle 额外 −6，volunteer 额外
 * −4，floor 20。
 * 零 LLM、零 IO；中英双语；en 层零中文。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^([一-鿿A-Za-z0-9·]{1,4})(?:（([^）]{0,16})）)?\s*[：:]\s*(.+)$/;
const SPEAKER_EN_RE = /^([A-Z][A-Z .'’-]{0,18}?)(?:\s*\(([^)]{0,40})\))?\s*:\s*(.+)$/;

const snippet = (s: string, n = 40): string => (s.length > n ? `${s.slice(0, n)}…` : s);
const stripLen = (s: string): number => s.replace(/\s/g, '').length;

/* ───────── 情报族 ───────── */

const DEED_ZH = /(?:害死|逼死|换药|换了?[^。！？\n]{0,3}药|做掉|灭口|杀(?:了|死|害)|害(?:死|了)|推下(?:楼|悬崖|水|阳台)|纵火|放火烧|掉包|调包|买凶|雇凶|栽赃|嫁祸|陷害|做(?:了)?(?:个)?局|伪造(?:遗嘱|证据|合同|签字)|挪用|卷走|吞(?:了|下)?(?:家产|遗产)|逼(?:她|他|你)?(?:签字|打胎|离婚)|见死不救|拔(?:了|的)?氧气管|拔管|弄没了?(?:孩子|娃)|放(?:了|的)?火|卖(?:了|掉)?(?:女儿|孩子)|把(?:他|她|你)?(?:送|弄)进(?:监狱|大牢)|让(?:他|她|你)?背黑锅|顶罪)/;
const DEED_EN = /\b(?:killed|murdered|poisoned|switched (?:the|her|his) pills|had (?:him|her) killed|whacked|done away with|pushed (?:him|her) (?:off|down|from)|set fire(?: to the house)?|swapped the|bought (?:a |the )?(?:hitman|killer)|hired (?:a |the )?(?:hitman|killer)|framed|set (?:him|her) up|forged(?: the| his| her)?|embezzled|made off with|forced (?:him|her) to sign|pulled the plug|let (?:him|her) die|took the fall|put (?:him|her) behind bars)\b/i;

const EVIDENCE_ZH = /(?:账本|账簿|账册|录音(?:笔|文件|带)?|录像|监控(?:录像|画面|记录|带)?|视频|备份|U\s*盘|硬盘|遗嘱(?:原件)?|合同(?:原件)?|日记|亲子鉴定|DNA报告|书信|密信|股权转让书?|保险柜|保险箱|密码|藏在|埋(?:在|了)|锁在|收据|发票|银行流水|通话记录|(?:护理|换药|用药|病历)?记录|护士站|抽屉)/;
const EVIDENCE_EN = /\b(?:the ledger|the recording|the tape|the footage|the surveillance(?: footage| tape)?|the video|the backup|the usb(?: drive)?|the hard drive|the will|the contract|the diary|the paternity (?:test|report)|the dna(?: report)?|the letter|the safe|the (?:pin )?code|hidden (?:in|at|under)|buried (?:in|at|under)|locked (?:in|away)|the receipts|the bank records|the (?:medical )?records?|the call log)\b/i;

const WHEN_ZH = /(?:明(?:天|晚|晨|早)|今(?:晚|夜|早)|昨(?:天|晚|夜)|下午[一二三四五六七八九十\d两点三四五六七八九十]+点|凌晨[一二三四五六七八九十\d两点三四五六七八九十]*|[\d一二两三四五六七八九十]+点(?:半|整)?|[\d一二两三四五六七八九十]+号(?:晚上|凌晨)?|码头|仓库|地下室|车库|机场|火车站|高铁站|医院|太平间|废弃(?:工厂|仓库|楼)|工地|酒店\s*\d{3,4}|后山|桥下|码头仓库)/;
const WHEN_EN = /\b(?:tomorrow(?: morning| night| evening)?|tonight|last night|at (?:three|3|midnight|noon|dusk|dawn)|3\s?pm|midnight|the docks?|the warehouse|the basement|the garage|the airport|the train station|the hospital|the morgue|the abandoned (?:factory|warehouse|building)|the construction site|room \d{3}|under the bridge)\b/i;

const NEXT_ZH = /(?:他(?:还|马上|明天|明晚|今晚|准备|打算|计划|想|要)[^。！？\n]{0,14}(?:动手|灭口|跑路|逃跑|转移|烧掉|毁掉|送走|做掉|签字|出国|取钱|开会|去|见|处理)|下一步|今晚就会|明晚(?:还|就|要)|正(?:要|在|准备)[^。！？\n]{0,10}(?:动手|烧|转|送|杀|灭)|准备把?[^。！？\n]{0,10}(?:烧掉|转走|送走|做掉)|打算把?[^。！？\n]{0,10}(?:害|杀|做掉|送走)|计划(?:在|于|明天|明晚|今晚)[^。！？\n]{0,10})/;
const NEXT_EN = /\b(?:he'?s (?:going|about|planning) to\b|he plans to|his next move|he'?ll (?:kill|silence|burn|transfer|flee|leave|sign)|he'?s about to|they'?re going to (?:kill|burn|move|silence)|planning to (?:kill|burn|flee|silence|move)|(?:tonight|tomorrow night) he'?ll|tomorrow night he (?:goes|is going))\b/i;

const ACCOMPLICE_ZH = /(?:同伙|帮凶|同谋|内应|指使|买通|收买|勾结|串通|那个女人|外面有人|还有(?:一个|个)(?:人|帮手|内鬼)|为了(?:遗产|家产|股权|上位|小三|私生子)|情(?:妇|夫)|二房|私生子)/;
const ACCOMPLICE_EN = /\b(?:accomplice|the inside man|paid (?:her|him|the nurse|them|everyone)?\s?off|bribed|colluded(?: with)?|worked with him|on his orders|the mistress|the other woman|for the inheritance|for the money|there (?:was|is) someone else|the illegitimate son)\b/i;

/* ───────── 第三人称框架 / 第一人称认罪排除 ───────── */

const THIRD_ZH = /(?:他|她|被告|原告|死者|老板|总裁|董事长|老爷|夫人|少爷|小姐|先生|太太|你们?(?:老爷|老板|爸|妈|爹|夫人|少爷|小姐|先生)|(?:沈|张|王|李|刘|陈|林|周|吴|郑|赵|黄|徐|孙|马|朱|胡|郭|何|高|罗|梁|谢|宋|唐|许|韩|冯|邓|曹|彭|曾)(?:总|董|先生|小姐|太太|经理|老板|氏))/;
const THIRD_EN = /\b(?:he|his|him|she|her|the defendant|the victim|your father|your mother|your stepfather|the boss|mr\.?|ms\.?|mrs\.?|sir|madam|the old man)\b/i;

const SELF_CRIME_ZH = /(?:人是我杀的|是我(?:害死|杀了?|换药|伪造|做掉|推)|我(?:害死|杀了?|换药|换了药|伪造了?|做掉了?|买凶|雇凶|挪用|卷走|放火烧)|我把(?:他|她))/;
const SELF_CRIME_EN = /\b(?:i killed|i murdered|i switched|i poisoned|i forged|i did it|it was me who|i had (?:him|her) killed|i embezzled|i set (?:him|her) up)\b/i;

/* ───────── 成本/动机 ───────── */

const RELUCT_ZH = /(?:犹豫|迟疑|踌躇|沉默良久|沉默了?很久|顿了?顿|压低声音|压着嗓子|凑近(?:他|她|我)?耳边|四下(?:看|张望|环顾)|环顾(?:四周)?|关上?门|把门关上|叹了?口气|长叹|攥紧|咬了?咬牙|欲言又止|张了?张嘴|我本(?:来)?不该说|我不该说|我答应过(?:你|他|她|太太|老爷)?|我发过誓|憋了?(?:我)?(?:十|\d+|多)?年|这话(?:我)?(?:本)?不该说)/;
const RELUCT_EN = /\b(?:hesitated|reluctantly|paused(?: for a long moment)?|lowered his voice|lowered her voice|leaned in|leaned close|glanced around|looked around|closed the door|with a sigh|sighed(?: heavily)?|clenched (?:his|her) (?:jaw|fist|hands)|gritted (?:his|her) teeth|i shouldn'?t be telling(?: you)?|i shouldn'?t say|i promised(?: him| her| the old man)?|i swore(?: an oath)?|i have kept this for years|i never told anyone)\b/i;

const MOTIVE_ZH = /(?:我欠(?:你|你妈|她|他|太太|老爷)[^。！？\n]{0,8}(?:命|人情|公道)|他(?:也|当年)(?:害|弄死|逼死)(?:过|了)?(?:我|我女儿|我儿子|我老婆|我丈夫|我家人|我们一家)|我(?:女儿|儿子|老婆|丈夫|妈|爸|孙女)(?:就是)?(?:也|都)?(?:死|没)在他手里|良心(?:不安|上过不去)|我这把老骨头|我快不行了|癌症晚期|临终|临死(?:前)?|将死|我没几天(?:好活|活头)?|他要(?:杀|灭)(?:我|我全家)?(?:灭口)?|他连我也要(?:杀|做掉|灭口)|他答应(?:给)?我(?:的)?(?:钱|好处)没给|我要(?:替|为)[^。！？\n]{0,6}(?:报仇|讨回(?:公道)?|赎罪))/;
const MOTIVE_EN = /\b(?:i owe (?:you|your mother|her|him) (?:my )?life|he killed (?:my(?: own)?|his own) (?:daughter|son|wife|husband|family)|he took (?:my everything|my daughter|my son)|my conscience(?: wouldn'?t let me)?|i'?m dying|i'?ve got months to live|terminal(?: illness)?|last wish|before i die|he'?s going to silence me too|he had me marked(?: too)?|he never paid me(?: what he owed)?|i want(?:ed)? (?:justice|revenge|to make it right))\b/i;

const EXTRACT_ZH = /(?:逼问|逼视|逼(?:着|到|上)|一把抓?住|揪住|扯住|拉住(?:他|她)(?:的)?(?:衣领|袖子|胳膊)?|堵(?:在|住了?门?)|拦住(?:他|她)?|拍(?:了)?(?:一下)?桌(?:子)?|亮出?|掏(?:出|来)|拿出(?:一沓|一叠)?(?:钱|支票|银行卡|证据|照片|录音|合同)|塞(?:给|到)(?:他|她)(?:手里)?(?:一沓|一叠)?钱|威胁|威逼|跪下|跪倒|哀求|苦求|堵住门|你不说?我就|你要多少钱|开个价|条件(?:是)?你提|我什么都答应|把(?:钱|支票)推到(?:他|她)面前)/;
const EXTRACT_EN = /\b(?:pressed (?:him|her)|pressed for(?: more)?|grabbed (?:him|her)(?: by| )|seized (?:him|her|by)|shoved (?:the|a) (?:money|photo|evidence|recording|check)|slammed (?:the|a) (?:money|photo|evidence)|blocked (?:the|his|her) (?:door|way)|cornered (?:him|her)|threatened(?: him| her)?|knelt(?: before)?|begged(?: him| her)?|how much do you want|name your price|i will do anything|talk or else|i can make it worth)\b/i;

const PROMISE_ZH = /(?:我保证|我发誓|绝不(?:会)?说(?:是你|出去)|不会(?:有|让)人知道|我会保护你|我保你(?:没事|安全|周全)?|带(?:你|您)走|你的名字不会出现|没人知道是你说的|我用人头担保|我用性命担?保)/;
const PROMISE_EN = /\b(?:i promise|i swear(?: to you)?|your name (?:stays|will stay) out(?: of this)?|no one will know|i will protect you|you have my word|i'?ll get you out|on my life)\b/i;

const DUTY_SPEAKER_ZH = /(?:警察|警官|民警|刑警|队长|局长|探长|法官|检察官|律师|法医)/;
const DUTY_SPEAKER_EN = /^(?:DETECTIVE|OFFICER|SARGE|SERGEANT|LIEUTENANT|CAPTAIN|AGENT|PROSECUTOR|D\.?A\.?|DISTRICT ATTORNEY|JUDGE|LAWYER|ATTORNEY|CORONER)\b/;
const COURT_ZH = /(?:法庭|庭审|法院|证人席|被告席|开庭)/;
const COURT_EN = /\b(?:court(?:room)?|witness stand|on the stand|sworn to tell the truth|under oath)\b/i;

const RISK_AFTER_ZH = /(?:被(?:人)?跟踪|发现(?:他|她)?(?:在)?(?:偷)?说|被听到|被开除|被辞退|丢了工作|被报复|遭(?:到)?报复|(?:杀|灭)口|被车撞|神秘(?:死亡|失踪)|第二天[^。！？\n]{0,8}(?:死|失踪|被开)|他(?:刚|一)说完[^。！？\n]{0,10}(?:死|枪|刀|倒)|被逮(?:捕)?|暴露了?身份)/;
const RISK_AFTER_EN = /\b(?:(?:was|got) followed|caught him talking|fired(?: him)? the next day|silenced(?: for talking)?|found dead(?: the next day)?|ran off the road|disappeared(?: after)?|his cover blown|witness killed)\b/i;

const EMPTY_ASK_ZH = /(?:到底(?:是)?怎么回事|当年(?:到底)?(?:发生了|出了)什么|你(?:都)?知道(?:些?什么|什么内情)|告诉我(?:真相|当年的事|实情|一切)?|你说吧|说吧|开口吧|怎么回事|什么情况|你倒是说啊?|(?:求|请)你告诉我|怎么走的|怎么(?:死|没|出事)的|发生了什么)/;
const EMPTY_ASK_EN = /\b(?:what (?:really )?happened|tell me(?: everything| the truth)?|what do you know|what did you see|i need to know|talk to me|come on, talk|spit it out|what went on(?: back then| that night)?)\b/i;

/* ───────── 类型与解析 ───────── */

export interface GratuityHit {
  /** 套餐起始行（1 基） */
  line: number;
  /** 倾倒结束行（1 基，连续同人多句时 > line） */
  endLine: number;
  speaker: string;
  families: string[];
  /** 前 6 行是否有他人发问 */
  prompted: boolean;
  boosters: ('bundle' | 'volunteer' | 'emptyAsk')[];
  snippet: string;
  rescued: boolean;
  rescueLine: number | null;
  reason: string;
}

export interface WitnessGratuityResult {
  score: number;
  dialogueLines: number;
  hits: GratuityHit[];
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
    // 保留括注表演动作（压低声音/一把揪住），迟疑与施压信号常藏在 cue 里
    const cue = m[2] ? `${isZh ? `（${m[2]}）` : `(${m[2]})`} ` : '';
    const text = `${cue}${m[3].trim()}`;
    if (isZh || /[a-z]/.test(text)) return { kind: 'dialogue', speaker: m[1].trim(), text };
  }
  return { kind: 'narration', text: t };
}

const lineText = (p: Parsed): string => (p.kind === 'blank' || p.kind === 'header' ? '' : p.text);

const FAMILY_IDS = ['deed', 'evidence', 'whenWhere', 'next', 'accomplice'] as const;

export function witnessGratuity(draft: string): WitnessGratuityResult {
  const isZh = isZhText(draft);
  const parsed = draft.split(/\r?\n/).map((l) => parseLine(l, isZh));
  const n = parsed.length;
  let dialogueLines = 0;
  for (const p of parsed) if (p.kind === 'dialogue') dialogueLines += 1;

  const deedRe = isZh ? DEED_ZH : DEED_EN;
  const evidenceRe = isZh ? EVIDENCE_ZH : EVIDENCE_EN;
  const whenRe = isZh ? WHEN_ZH : WHEN_EN;
  const nextRe = isZh ? NEXT_ZH : NEXT_EN;
  const accompliceRe = isZh ? ACCOMPLICE_ZH : ACCOMPLICE_EN;
  const thirdRe = isZh ? THIRD_ZH : THIRD_EN;
  const selfCrimeRe = isZh ? SELF_CRIME_ZH : SELF_CRIME_EN;
  const reluctRe = isZh ? RELUCT_ZH : RELUCT_EN;
  const motiveRe = isZh ? MOTIVE_ZH : MOTIVE_EN;
  const extractRe = isZh ? EXTRACT_ZH : EXTRACT_EN;
  const promiseRe = isZh ? PROMISE_ZH : PROMISE_EN;
  const courtRe = isZh ? COURT_ZH : COURT_EN;
  const riskAfterRe = isZh ? RISK_AFTER_ZH : RISK_AFTER_EN;
  const emptyAskRe = isZh ? EMPTY_ASK_ZH : EMPTY_ASK_EN;
  const dutySpeakerRe = isZh ? DUTY_SPEAKER_ZH : DUTY_SPEAKER_EN;

  const familyRes = { deed: deedRe, evidence: evidenceRe, whenWhere: whenRe, next: nextRe, accomplice: accompliceRe };

  // ── 合并连续同人发言为 turn（空行不断，叙述行/场头断，他人台词断）──
  type Turn = { start: number; end: number; speaker: string; text: string };
  const turns: Turn[] = [];
  for (let i = 0; i < n; i += 1) {
    const p = parsed[i];
    if (p.kind !== 'dialogue') continue;
    if (turns.length > 0) {
      const last = turns[turns.length - 1];
      let contiguous = true;
      for (let j = last.end + 1; j < i; j += 1) {
        if (parsed[j].kind !== 'blank') { contiguous = false; break; }
      }
      if (contiguous && last.speaker === p.speaker) {
        last.end = i;
        last.text += ` ${p.text}`;
        continue;
      }
    }
    turns.push({ start: i, end: i, speaker: p.speaker, text: p.text });
  }

  const scanText = (lo: number, hi: number): string => {
    const parts: string[] = [];
    for (let i = Math.max(0, lo); i <= Math.min(n - 1, hi); i += 1) {
      const t = lineText(parsed[i]);
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };

  const hits: GratuityHit[] = [];

  for (const turn of turns) {
    const text = turn.text;
    if (isZh ? stripLen(text) < 12 : text.split(/\s+/).filter(Boolean).length < 10) continue;

    // 第一人称认罪归 villain-overconfession
    if (selfCrimeRe.test(text)) continue;
    // 必须以第三人称指认加害者
    if (!thirdRe.test(text)) continue;

    const families: string[] = [];
    for (const id of FAMILY_IDS) {
      if (familyRes[id].test(text)) families.push(id);
    }
    if (families.length < 2) continue;
    if (!families.includes('deed') && !families.includes('evidence')) continue;

    // ── 取证成本核验 ──
    const before = scanText(turn.start - 10, turn.start - 1);
    const turnWithBefore = `${before} ${text}`;
    const after = scanText(turn.end + 1, turn.end + 3);

    const reluctant = reluctRe.test(turnWithBefore);
    const motivated = motiveRe.test(turnWithBefore);
    const extracted = extractRe.test(before);
    const promised = promiseRe.test(before);
    const riskAfter = riskAfterRe.test(after);
    const duty = dutySpeakerRe.test(turn.speaker) || courtRe.test(scanText(turn.start - 6, turn.start));

    let rescued = false;
    let rescueLine: number | null = null;
    let reason = '';
    if (motivated) { rescued = true; reason = isZh ? '证人给了开口的动机（旧债/复仇/自保/将死），情报是有理由才给的' : 'The witness has an explicit motive to talk (old debt, revenge, self-preservation, dying)'; }
    else if (extracted) { rescued = true; reason = isZh ? '主角先施压或付费才拿到情报，信息是逼出来/买来的' : 'The intel is extracted under pressure or payment, not volunteered'; }
    else if (promised) { rescued = true; reason = isZh ? '主角先给了安全承诺，开口经过谈判' : 'Safety was negotiated before the witness talked'; }
    else if (duty) { rescued = true; reason = isZh ? '司法/律师职务陈述或法庭作证，开口是职务行为' : 'Official duty or sworn testimony, not a private giveaway'; }
    else if (riskAfter) { rescued = true; reason = isZh ? '说完即付出代价（被跟踪/开除/灭口），情报不是白给' : 'Talking costs the witness immediately afterward'; }
    else if (reluctant && families.length === 2) { rescued = true; reason = isZh ? '先有害怕迟疑且只挤出一条，像冒险漏口而非情报套餐' : 'Fear and hesitation plus a single grudged fact reads as a risky slip, not a bundle'; }
    // 注意：reluctance 单独不豁免大套餐——光害怕最后还是把五样货全说了，照样白给

    if (rescued) {
      for (let i = Math.max(0, turn.start - 10); i <= Math.min(n - 1, turn.end + 3); i += 1) {
        const t = lineText(parsed[i]);
        if (t && (motiveRe.test(t) || extractRe.test(t) || promiseRe.test(t) || courtRe.test(t) || riskAfterRe.test(t))) { rescueLine = i + 1; break; }
      }
    }

    // ── 廉价加压 ──
    const boosters: GratuityHit['boosters'] = [];
    if (families.length >= 3) boosters.push('bundle');

    // 前 6 行最近的他人台词
    let prompted = false;
    let emptyAsk = false;
    for (let i = turn.start - 1; i >= Math.max(0, turn.start - 6); i -= 1) {
      if (parsed[i].kind === 'dialogue') {
        const pp = parsed[i] as Extract<Parsed, { kind: 'dialogue' }>;
        if (pp.speaker !== turn.speaker) {
          prompted = true;
          if (emptyAskRe.test(pp.text)) emptyAsk = true;
        }
        break;
      }
    }
    if (!prompted) boosters.push('volunteer');
    if (emptyAsk) boosters.push('emptyAsk');

    if (!rescued) {
      reason = isZh
        ? `知证人无害怕、无交换、无动机地倾倒${families.length}类情报`
        : `A witness hands over ${families.length} intel families with no fear, no bargain and no motive`;
    }

    hits.push({
      line: turn.start + 1,
      endLine: turn.end + 1,
      speaker: turn.speaker,
      families,
      prompted,
      boosters,
      snippet: snippet(text),
      rescued,
      rescueLine,
      reason,
    });
  }

  const bad = hits.filter((h) => !h.rescued);
  let score = 100;
  score -= bad.length * 28;
  score -= bad.filter((h) => h.boosters.includes('bundle')).length * 6;
  score -= bad.filter((h) => h.boosters.includes('volunteer')).length * 4;
  if (score < 20) score = 20;
  if (bad.length === 0) score = 100;

  const issues = bad.map((h) =>
    isZh
      ? `第${h.line}行 ${h.speaker} 无成本情报套餐（${h.families.join('+')}${h.boosters.length ? `，${h.boosters.join('+')}` : ''}）：知情人守了多年的秘密，不该一句话免费端出——先让主角付代价（逼问/交换/保护承诺），或给证人开口的动机与风险。`
      : `L${h.line} ${h.speaker} gives a free intel bundle (${h.families.join('+')}${h.boosters.length ? `, ${h.boosters.join('+')}` : ''}): a long-held secret needs extraction cost, a witness motive, or a price paid after talking.`,
  );

  const advice = isZh
    ? '情报按"取证成本"兑付：证人先躲、怕、还价，主角拿出交换或保护，证人才肯分批吐口；只给当下必需的一条，其余留到下一次付代价。'
    : 'Clue delivery must be earned: fear, a bargain or protection first, then one fact at a time; keep the rest of the bundle for the next price paid.';

  return { score, dialogueLines, hits, issues, advice };
}
