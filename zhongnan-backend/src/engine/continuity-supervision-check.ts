import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * v2.139 场记连续性 / 物理状态穿帮检测（PRD 2.1.36 物理状态连续性过硬线）
 * ------------------------------------------------------------------
 * 分工：
 *  - causal-logic：宏观因果（巧合过载/机械降神/誓言烂尾/信息空降）
 *  - timeline-consistency v2.138：时钟（倒计时/昼夜/跳时/关系时长）
 *  - scene-header-convention：标题格式
 *  - v2.139（本引擎）：镜头之间的物理状态连续性——"场记"那支笔
 *
 * 四类穿帮：
 *  1) injury_vanish      伤势无痕：中刀/流血/晕倒之后，没有养伤/跳时交代就活蹦乱跳
 *  2) object_restored    毁物复原：撕碎/烧毁的文件合同，后文又完好地签字递出
 *  3) device_resurrection 设备复活：摔烂/没电/被没收的手机，无修复交代又拨通电话
 *  4) restraint_vanish   束缚消失：被绑/被关，无挣脱/被救交代就出现在别处
 *
 * 正信号：毁伤后出现合法桥接（痊愈/跳时/复印件/修好/挣脱），奖励"穿帮被接住"。
 */

export type CsLang = 'zh' | 'en';

export interface ContinuityIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'injury_vanish'
    | 'object_restored'
    | 'device_resurrection'
    | 'restraint_vanish';
  /** 人类可读证据（已按语言本地化） */
  evidence: string;
  /** 修改建议（已按语言本地化） */
  advice: string;
  /** 出现的场景序号（1 基） */
  scene: number;
  /** 状态键：伤势=injury / 束缚=restraint / 设备=phone / 物件=物件归一化名 */
  key: string;
}

export interface ContinuitySceneReport {
  index: number;
  header: string;
  contradictionCount: number;
}

export interface ContinuitySupervisionResult {
  score: number;
  sceneCount: number;
  /** 检测到的"物理状态变更"总数（受伤/毁物/失机/被绑） */
  stateChangeCount: number;
  /** 穿帮总数 */
  contradictionCount: number;
  injuryVanishCount: number;
  objectRestoredCount: number;
  deviceResurrectionCount: number;
  restraintVanishCount: number;
  /** 合法桥接次数（养好伤/复印件/修好手机/挣脱） */
  bridgedCount: number;
  scenes: ContinuitySceneReport[];
  issues: ContinuityIssue[];
}

// c213：场景切分收口共享切分器 script-scenes（单一事实源，含室内/室外/方括号/转场等全格式）

// —— 中文：伤势 ——
const INJURY_ZH = /(?:流着?血|淌血|渗血|出血|中了?(?:一刀|一枪|一枪弹?)|枪伤|刀伤|挨了?一枪|骨折|骨裂|扭伤|崴了脚|晕倒|昏倒|昏迷(?:不醒|过去)?|头破血流|缠着?绷带|包扎(?:了|着)|打着?石膏|吊着?(?:胳膊|手臂|绷带)|嘴角(?:溢|淌|流|渗)血|流鼻血|一瘸一拐)/g;
const RECOVER_ZH = /(?:活蹦乱跳|健步如飞|生龙活虎|跟没事人(?:一样|似的)?|和没事人(?:一样|似的)?|毫发无伤|毫发无损|活动自如|行动自如|若无其事(?:地)?(?:站起|站起来|走|跑|离开)|(?:一把|猛地|奋力|用力)(?:推开|抓住|拽住|拉起|抱住)|(?:飞奔|狂奔|奔跑|拔腿就追|拔腿就跑|翻身跃起|腾地(?:站|跳)起)|又(?:能|可以)(?:跑|跳|走)了)/g;
const HEAL_ZH = /(?:痊愈|康复|养好(?:了)?伤|养好了?|伤势(?:痊愈|好转|恢复|无碍)|伤口[^，。；？！\n]{0,4}(?:愈合|拆线|结疤)|拆了?(?:石膏|绷带)|伤势不重|皮外伤|歇了?(?:几天|几天几夜|一周|半个月))/;

// —— 中文：束缚 ——
const CONFINE_ZH = /(?:被绑(?:在|住|了)?|五花大绑|捆(?:在|得)(?:椅子|柱子|床|栏杆)?(?:上)?|绑在椅子上|手脚(?:被)?绑|反锁(?:在|了)?(?:屋里|房间|仓库|地下室|办公室|衣柜|车里)?|关(?:进|在)(?:了)?(?:房间|仓库|地下室|衣柜|车里|密室|冷库)|被困(?:在)?(?:电梯|车里|密室|冷库|废墟)|锁在(?:屋里|房间|仓库|地下室))/g;
const FREE_ZH = /(?:大摇大摆(?:地)?(?:走|离开|走出)|已经(?:坐|站|等)(?:在)?(?:门口|咖啡厅|咖啡馆|客厅|公司|会场)|出现在(?:门口|会场|发布会现场|宴会上)|推门(?:而)?(?:入|进)|从容(?:地)?(?:走进|走入|步入))/g;
const ESCAPE_ZH = /(?:挣脱(?:了)?(?:绳子|束缚)?|解开(?:了)?(?:绳子|绑)?|松了绑|挣开(?:绳子|绑)?|踹开(?:了)?(?:门)?|破门(?:而)?出|被(?:人)?(?:放了?|救出|救了出来)|撬开(?:了)?(?:锁|门)?|割开(?:了)?绳子|咬断(?:了)?绳子|砸开(?:了)?(?:门|锁))/;

// —— 中文：设备（手机/电话）——
const DISABLE_PHONE_ZH = /(?:手机|电话)(?:被)?(?:摔(?:烂|坏|碎|成两半|成两截)|砸(?:了|烂|碎)|没收|掉进(?:水里|马桶|河里)|泡了水)|(?:手机|电话)被(?:拿走|抢走|夺走|没收)|(?:手机|电话)(?:也|已经|早就)?(?:没)?电(?:了|量)?(?:关机|耗尽)?|手机关机/g;
const USE_PHONE_ZH = /(?:拿起手机|抓起手机|拨通(?:了)?(?:电话|手机)|打(?:了个|通)?电话|接(?:起|听)(?:电话|手机)|手机(?:突然)?(?:响了|响起|震动|亮了)|电话(?:突然)?(?:响了|响起)|(?:给|跟).{0,8}(?:打个?电话|打电话)|手机上(?:显示|弹出))/g;
const REPAIR_PHONE_ZH = /(?:换了?(?:一部)?新手机|新手机|新的(?:一部)?手机|修好(?:了)?手机|手机修好|充(?:好|上|了)电|充(?:了一)?会儿电|拿回(?:了)?(?:手机|电话)|借了?(?:个|部)?(?:手机|电话)|用店里的电话|备用手机)/;

// —— 中文：物件（双向：OBJ…毁 / 毁…OBJ）——
const OBJ_ZH = '文件|合同|遗嘱|照片|书信|信件|支票|协议书?|鉴定报告|亲子鉴定|钥匙|项链|戒指|玉佩|录音笔|档案|病历|邀请函|休书|婚书|地契|房产证';
const DESTROY_VERB_ZH = '摔碎|撕碎|撕得粉碎|撕烂|撕成碎片|砸烂|砸毁|烧毁|烧掉|烧了|踩碎|掰断|扯碎|扔进火里|丢进火里|扔到火里';
const DESTROY_OBJ_ZH = new RegExp(`(?:把|将)?(?:那|这)?(?:份|个|条|枚|封|张|串)?(${OBJ_ZH})[^，。；？！\\n]{0,10}(?:${DESTROY_VERB_ZH})`, 'g');
const DESTROY_VERB_FIRST_ZH = new RegExp(`(?:${DESTROY_VERB_ZH})(?:了|掉|成两截)?(?:那|这)?(?:份|个|条|枚|封|张|串)?(${OBJ_ZH})`, 'g');
// 物件完好使用（必须同句带动作，裸名词不算，避免"合同的事"误伤）
const USE_OBJ_RULES_ZH: { key: string; re: RegExp }[] = [
  { key: '文件', re: /(?:文件)[^，。；？！\n]{0,8}(?:签字|签名|盖章|递(?:给|过|来)|拿起|展开|翻开|出示|念(?:道|出|起来))|(?:拿起|接过|递过|掏出|展开|翻开|出示)(?:了)?(?:那份|这份)?文件/g },
  { key: '合同', re: /(?:合同)[^，。；？！\n]{0,8}(?:签字|签名|盖章|递(?:给|过|来)|拿起|笔签)|(?:在|把)(?:那份|这份)?合同上?(?:签了?字|签上名)|(?:拿起|接过|递过)(?:了)?(?:那份|这份)?合同/g },
  { key: '遗嘱', re: /(?:遗嘱)[^，。；？！\n]{0,8}(?:念|读|公布|公开|递|拿|展)|(?:拿起|接过|递过|念出|宣读)(?:了)?(?:那份)?遗嘱/g },
  { key: '照片', re: /(?:拿出|举起|递过|指着|盯着)(?:了)?(?:那张|这张)?照片|照片(?:里|上)(?:还|清晰|依然)/g },
  { key: '书信', re: /(?:拿起|展开|拆开|念着?)(?:了)?(?:那封|这封)?(?:书信|信)/g },
  { key: '信件', re: /(?:拿起|拆开|念着?)(?:了)?(?:那封|这封)?信件|信件(?:里|上)(?:写着?|提到)/g },
  { key: '支票', re: /(?:支票)[^，。；？！\n]{0,8}(?:签字|兑(?:现|换)|递|拿)|(?:接过|递过|掏出|兑现)(?:了)?(?:那张)?支票/g },
  { key: '协议', re: /(?:协议(?:书)?)(?:上)?[^，。；？！\n]{0,6}(?:签字|签了名|盖章|生效)|(?:拿起|接过|递过)(?:了)?(?:那份)?协议/g },
  { key: '鉴定报告', re: /(?:拿起|递过|展开|念出)(?:了)?(?:那份)?(?:亲子鉴定|鉴定报告)|(?:亲子鉴定|鉴定报告)(?:上|里)(?:写着?|显示)/g },
  { key: '亲子鉴定', re: /(?:拿起|递过|展开|念出)(?:了)?(?:那份)?亲子鉴定|亲子鉴定(?:上|里)(?:写着?|显示)/g },
  { key: '钥匙', re: /(?:用钥匙|拿起钥匙|掏出钥匙|钥匙)(?:[^，。；？！\n]{0,6})?(?:打开?了?(?:门|锁|抽屉)|拧开|发动(?:了)?(?:汽车|车子))/g },
  { key: '项链', re: /(?:戴上?|挂在|戴回|系回|摸了摸|攥着?)(?:了)?(?:那条)?项链|项链(?:依然|还)(?:挂|戴|在脖子上)/g },
  { key: '戒指', re: /(?:戴上?|套在|戴回|套回)(?:了)?(?:那枚)?戒指|戒指(?:依然|还)(?:戴|在(?:手指|无名指)上)/g },
  { key: '玉佩', re: /(?:戴上?|挂在|攥着?|摸了摸)(?:了)?(?:那块)?玉佩|玉佩(?:依然|还)(?:挂|在(?:脖子|腰间))/g },
  { key: '录音笔', re: /(?:按下|播放|掏出|拿起)(?:了)?(?:那支)?录音笔|录音笔(?:里|中)(?:传出|播放|响起)/g },
  { key: '档案', re: /(?:拿起|翻开|递过|调出)(?:了)?(?:那份)?档案|档案(?:里|袋)(?:的)?(?:资料|记录)/g },
  { key: '病历', re: /(?:拿起|翻开|递过)(?:了)?(?:那份)?病历|病历(?:上|里)(?:写着?|记录着?)/g },
  { key: '邀请函', re: /(?:拿起|递过|出示)(?:了)?(?:那张)?邀请函|邀请函(?:上|里)(?:写着?|印着?)/g },
  { key: '休书', re: /(?:拿起|递过|按下(?:了)?手印)(?:了)?(?:那张)?休书|休书(?:上|里)(?:写着?)/g },
  { key: '婚书', re: /(?:拿起|递过)(?:了)?(?:那张)?婚书|婚书(?:上|里)(?:写着?|印着?)/g },
  { key: '地契', re: /(?:拿起|递过|展开)(?:了)?(?:那张)?地契|地契(?:上|里)(?:写着?|印着?)/g },
  { key: '房产证', re: /(?:拿起|递过|展开)(?:了)?(?:那本)?房产证|房产证(?:上|里)(?:写着?|印着?)/g },
];
const REPAIR_OBJ_ZH = /(?:粘好|粘了起来|拼好|拼了回来|修复(?:了)?|修好(?:了)?|重新打印(?:了)?|复印件|备份(?:件|文件)?|副本|留了?底(?:稿|件)?|另一份|还有一份|新买(?:了)?|补了?(?:一)?份|重新拟(?:了|一份)?|仿造(?:了|一份)?|假的那份|调包)/;

// —— 中文：跳时（合法养伤/解绑的时间交代）——
const TIME_SKIP_ZH = /(?:次日|翌日|第二天)|[0-9一二两三四五六七八九十半]+\s*(?:个)?(?:天|日|周|个月|年)(?:以后|之后|后)/;

// —— 英文词库 ——
const INJURY_EN = /\b(?:bleeding|blood (?:gushed|streamed|trickled) from|stabbed|stab wound|gunshot wound|shot (?:in|twice)|broken (?:arm|leg|rib|wrist)|fractured (?:arm|leg|rib|wrist)|sprained (?:ankle|wrist)|collapsed|passed out|unconscious|in a coma|bandaged|in a cast|sling on|limping|bruised badly)\b/gi;
const RECOVER_EN = /\b(?:leapt up|jumped up|sprinted|ran at full speed|dashed after|as if nothing (?:had )?happened|unharmed|unscathed|perfectly fine|moved (?:freely|effortlessly)|shoved him(?: hard)? (?:away|aside)|wrenched (?:him )?up|threw her arms around|back on his feet in seconds)\b/gi;
const HEAL_EN = /\b(?:fully recovered|healed|wounds? (?:healed|closed|scarred)|cast (?:was )?off|bandages? off|out of the coma|days later|weeks later|after (?:a week|days) of rest|only a scratch|minor injuries)\b/;

const CONFINE_EN = /\b(?:tied(?: up)?(?: to)?(?: the)?(?: chair|bed|post|railing)|bound(?: to)(?: the)?(?: chair|bed|post)|hands tied|zip-tied|locked(?: in| inside)(?: the)?(?: room|basement|trunk|closet|warehouse|cold room|elevator|car)|trapped(?: in)(?: the)?(?: elevator|car|vault|rubble)|chained to)\b/gi;
const FREE_EN = /\b(?:strolled (?:right )?(?:into|out|through)|walked in (?:calmly|as if nothing)|showed up at(?: the)?(?: door|venue|party|press conference)|appeared (?:calmly )?in(?: the)?(?: doorway|boardroom|ballroom)|pushed open the door(?: and walked in)?)\b/gi;
const ESCAPE_EN = /\b(?:broke free|slipped (?:the |his |her )?(?:ropes|bonds|zip ties)|untied (?:himself|herself|the ropes)|wriggled free|kicked the door(?: open)?|broke the door down|rescued by|let (?:him|her) go|pried (?:open )?the lock|cut through the ropes|chewed through)\b/;

const DISABLE_PHONE_EN = /\b(?:phone(?: was)?(?: smashed|cracked beyond repair|dead|destroyed|in pieces|taken(?: away)?|confiscated|submerged|in the toilet)|cell(?: phone)?(?: was)?(?: smashed|dead|taken away)|battery(?: was)? dead|phone died|no signal)\b/gi;
const USE_PHONE_EN = /\b(?:picked up (?:his|her|the) phone|grabbed (?:his|her|the) phone|dialed(?: his|her)?(?: number)?|made a call|called(?: him| her| them| an ambulance)?|answered(?: the phone| his phone| her phone)|phone(?: suddenly)? rang|phone buzzed|phone lit up|text popped up|on the phone)\b/gi;
const REPAIR_PHONE_EN = /\b(?:new phone|replacement phone|got (?:his|her) phone back|charged(?: up)?|borrowed(?: a)? phone|landline|office phone|backup phone|repaired(?: the)? phone|sim card|spare phone)\b/;

const OBJ_EN = 'document|contract|will|photograph|photo|letter|check|agreement|paternity report|dna report|key|necklace|ring|jade pendant|recorder|file|medical record|invitation|deed|property deed';
const DESTROY_VERB_EN = 'tore up|shredded|ripped to pieces|smashed|burned|burnt|set fire to|crushed|snapped in half|threw into the fire';
const DESTROY_OBJ_EN = new RegExp(`(?:${DESTROY_VERB_EN})[^.\\n]{0,24}?(?:${OBJ_EN})`, 'gi');
const DESTROY_VERB_FIRST_EN = new RegExp(`(?:${OBJ_EN.replace('document', 'the document')})[^.\\n]{0,18}?(?:${DESTROY_VERB_EN})`, 'gi');
const USE_OBJ_RULES_EN: { key: string; re: RegExp }[] = [
  { key: 'document', re: /\b(?:signed|initialed|stamped|handed(?: over| back)?|picked up|unfolded|presented|read aloud)(?: the| his| her)? document|the document (?:was signed|read)\b/gi },
  { key: 'contract', re: /\b(?:signed(?: the| his| her)? contract|signed (?:on|at) the (?:dotted line|contract)|handed(?: over| back)? the contract|picked up the contract)\b/gi },
  { key: 'will', re: /\b(?:read (?:out|aloud) the will|presented the will|the will (?:was read|stated|revealed))\b/gi },
  { key: 'photo', re: /\b(?:held up the photo|showed the photo|the photo (?:showed|in it|still))\b/gi },
  { key: 'letter', re: /\b(?:opened the letter|unfolded the letter|read the letter|the letter said)\b/gi },
  { key: 'check', re: /\b(?:signed the check|cashed the check|handed(?: over)? the check|the check (?:cleared|was good))\b/gi },
  { key: 'agreement', re: /\b(?:signed the agreement|handed(?: over)? the agreement|the agreement (?:was signed|took effect))\b/gi },
  { key: 'paternity report', re: /\b(?:the paternity report (?:said|showed|stated)|held up the paternity report|dna report (?:said|showed|stated))\b/gi },
  { key: 'key', re: /\b(?:used the key|turned the key|the key unlocked|started the car with the key)\b/gi },
  { key: 'necklace', re: /\b(?:put on the necklace|fastened the necklace|the necklace (?:still )?(?:hung|rested) on)\b/gi },
  { key: 'ring', re: /\b(?:put on the ring|slid the ring(?: onto| back)|the ring(?: still)?(?: sat|was) on (?:her|his) (?:finger|ring finger))\b/gi },
  { key: 'jade pendant', re: /\b(?:the jade pendant (?:still )?(?:hung|rested) on|gripped the jade pendant)\b/gi },
  { key: 'recorder', re: /\b(?:pressed play on the recorder|the recorder (?:played|blared))\b/gi },
  { key: 'file', re: /\b(?:opened the file|pulled (?:out|up) the file|the file (?:contained|read))\b/gi },
  { key: 'medical record', re: /\b(?:the medical record(?:s)? (?:showed|stated|read))\b/gi },
  { key: 'invitation', re: /\b(?:held up the invitation|the invitation (?:read|said))\b/gi },
  { key: 'deed', re: /\b(?:handed over the deed|the deed (?:read|showed))\b/gi },
];
const REPAIR_OBJ_EN = /\b(?:taped(?: it)? back|glued(?: it)? back(?: together)?|restored|repaired|reprinted|a copy|copies|backup|spare copy|another (?:copy|one)|duplicate|reissued|a new one|replacement|forged (?:a|the)|fake one|switched)\b/;
const TIME_SKIP_EN = /\b(?:the next day|the following day|that night|\d+(?:\.\d+)?\s*(?:days?|weeks?|months?|years?|hours?)\s*later)\b/i;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function* matchAll(line: string, re: RegExp): Generator<RegExpExecArray> {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    yield m;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

function pickObjZh(m: RegExpExecArray): string | null {
  for (let i = 1; i < m.length; i++) {
    if (m[i] && /文件|合同|遗嘱|照片|书信|信件|支票|协议|鉴定|钥匙|项链|戒指|玉佩|录音笔|档案|病历|邀请函|休书|婚书|地契|房产证/.test(m[i])) {
      if (m[i].includes('鉴定')) return '鉴定报告';
      if (m[i].includes('协议')) return '协议';
      return m[i];
    }
  }
  return null;
}

interface SplitScene { header: string; lines: string[] }

function splitScenes(text: string, isZh: boolean): SplitScene[] {
  const raw = text.split(/\r?\n/);
  const scenes: SplitScene[] = [];
  let cur: SplitScene = { header: isZh ? '开场' : 'Opening', lines: [] };
  for (const line of raw) {
    const t = line.trim();
    if (t && isSceneHeaderLine(t, isZh ? 'zh' : 'en')) {
      if (cur.lines.length || cur.header !== (isZh ? '开场' : 'Opening')) scenes.push(cur);
      cur = { header: t.slice(0, 30), lines: [] };
    } else if (t) {
      cur.lines.push(t);
    }
  }
  scenes.push(cur);
  return scenes;
}

/**
 * 场记连续性检测
 * @param text 剧本全文
 * @param lang zh | en
 */
export function continuitySupervisionCheck(text: string, lang: CsLang = 'zh'): ContinuitySupervisionResult {
  const isZh = lang !== 'en';
  const empty: ContinuitySupervisionResult = {
    score: 100, sceneCount: 0, stateChangeCount: 0, contradictionCount: 0,
    injuryVanishCount: 0, objectRestoredCount: 0, deviceResurrectionCount: 0,
    restraintVanishCount: 0, bridgedCount: 0, scenes: [], issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const scenes = splitScenes(text, isZh);
  if (!scenes.length) return empty;

  // 活动状态：kind + key → { fromScene }
  const activeInjury: { fromScene: number }[] = [];
  const activeRestraint: { fromScene: number }[] = [];
  const activeObjects = new Map<string, number>(); // key → 被毁所在场
  let phoneDisabledAt: number | null = null;

  const issues: ContinuityIssue[] = [];
  const sceneContradictions = new Map<number, number>();
  let stateChangeCount = 0;
  let bridgedCount = 0;

  const flag = (scene: number) => sceneContradictions.set(scene, (sceneContradictions.get(scene) ?? 0) + 1);

  scenes.forEach((sc, si) => {
    const sceneIdx = si + 1;
    for (const line of sc.lines) {
      // —— 跳时行：伤势/束缚状态合法失效（物理毁坏不会自愈，物件/手机保留）——
      if ((isZh ? TIME_SKIP_ZH : TIME_SKIP_EN).test(line)) {
        if (activeInjury.length || activeRestraint.length) {
          activeInjury.length = 0;
          activeRestraint.length = 0;
        }
        continue;
      }

      if (isZh) {
        // ① 伤势
        if (INJURY_ZH.test(line)) {
          stateChangeCount++;
          activeInjury.push({ fromScene: sceneIdx });
        }
        if (activeInjury.length) {
          if (HEAL_ZH.test(line)) {
            bridgedCount++;
            activeInjury.length = 0;
          } else if (RECOVER_ZH.test(line)) {
            issues.push({
              severity: issues.filter((i) => i.type === 'injury_vanish').length >= 1 ? 'high' : 'mid',
              type: 'injury_vanish', key: 'injury', scene: sceneIdx,
              evidence: `第${sceneIdx}场：${line.slice(0, 34)}`,
              advice: '前面有受伤/昏迷，这里人物却活动自如。补一笔伤势后果（包扎、疼痛、被人搀扶），或在两场之间加"几天后/养好了伤"的时间交代。',
            });
            flag(sceneIdx);
            activeInjury.length = 0;
          }
        }

        // ② 束缚
        if (CONFINE_ZH.test(line)) {
          stateChangeCount++;
          activeRestraint.push({ fromScene: sceneIdx });
        }
        if (activeRestraint.length) {
          if (ESCAPE_ZH.test(line)) {
            bridgedCount++;
            activeRestraint.length = 0;
          } else if (FREE_ZH.test(line)) {
            const sev = (issues.filter((i) => i.type === 'restraint_vanish').length + 1 >= 3) ? 'mid' : 'low';
            issues.push({
              severity: sev, type: 'restraint_vanish', key: 'restraint', scene: sceneIdx,
              evidence: `第${sceneIdx}场：${line.slice(0, 34)}`,
              advice: '前面人物被绑/被关，这里却自由行动。补一个逃脱动作（挣脱绳子、踹门、被人放出），否则观众会觉得"绳子自己开了"。',
            });
            flag(sceneIdx);
            activeRestraint.length = 0;
          }
        }

        // ③ 手机
        if (DISABLE_PHONE_ZH.test(line)) {
          stateChangeCount++;
          phoneDisabledAt = sceneIdx;
        }
        if (phoneDisabledAt !== null) {
          if (REPAIR_PHONE_ZH.test(line)) {
            bridgedCount++;
            phoneDisabledAt = null;
          } else if (USE_PHONE_ZH.test(line)) {
            const sev = issues.some((i) => i.type === 'device_resurrection') ? 'mid' : 'low';
            issues.push({
              severity: sev, type: 'device_resurrection', key: 'phone', scene: sceneIdx,
              evidence: `第${sceneIdx}场：${line.slice(0, 34)}`,
              advice: '手机此前被摔烂/没电/没收，这里却正常使用。交代一句"换了部新手机/充上电/借了个电话"，道具状态要接得上。',
            });
            flag(sceneIdx);
            phoneDisabledAt = null;
          }
        }

        // ④ 物件
        let dm: RegExpExecArray | null = null;
        for (const m of matchAll(line, DESTROY_OBJ_ZH)) { dm = m; break; }
        if (!dm) for (const m of matchAll(line, DESTROY_VERB_FIRST_ZH)) { dm = m; break; }
        if (dm) {
          const key = pickObjZh(dm);
          if (key && !activeObjects.has(key)) {
            stateChangeCount++;
            activeObjects.set(key, sceneIdx);
          }
        }
        if (activeObjects.size) {
          const bridged = REPAIR_OBJ_ZH.test(line);
          for (const rule of USE_OBJ_RULES_ZH) {
            if (!activeObjects.has(rule.key)) continue;
            if (rule.re.test(line)) {
              if (bridged) {
                bridgedCount++;
                activeObjects.delete(rule.key);
              } else {
                issues.push({
                  severity: 'mid', type: 'object_restored', key: rule.key, scene: sceneIdx,
                  evidence: `第${sceneIdx}场：${line.slice(0, 34)}`,
                  advice: `「${rule.key}」此前已被撕毁/烧毁，这里却完好使用。要么让人物用复印件/备份并点明，要么改成另立一份，毁物不能无痕复原。`,
                });
                flag(sceneIdx);
                activeObjects.delete(rule.key);
              }
            }
          }
          if (bridged) activeObjects.clear();
        }
      } else {
        // —— English ——
        if (INJURY_EN.test(line)) {
          stateChangeCount++;
          activeInjury.push({ fromScene: sceneIdx });
        }
        if (activeInjury.length) {
          if (HEAL_EN.test(line)) {
            bridgedCount++;
            activeInjury.length = 0;
          } else if (RECOVER_EN.test(line)) {
            issues.push({
              severity: issues.filter((i) => i.type === 'injury_vanish').length >= 1 ? 'high' : 'mid',
              type: 'injury_vanish', key: 'injury', scene: sceneIdx,
              evidence: `Scene ${sceneIdx}: ${line.slice(0, 60)}`,
              advice: 'The character was injured/unconscious earlier but moves freely here. Show a consequence (bandage, pain, help walking) or add a time bridge ("days later, fully recovered").',
            });
            flag(sceneIdx);
            activeInjury.length = 0;
          }
        }

        if (CONFINE_EN.test(line)) {
          stateChangeCount++;
          activeRestraint.push({ fromScene: sceneIdx });
        }
        if (activeRestraint.length) {
          if (ESCAPE_EN.test(line)) {
            bridgedCount++;
            activeRestraint.length = 0;
          } else if (FREE_EN.test(line)) {
            const sev = (issues.filter((i) => i.type === 'restraint_vanish').length + 1 >= 3) ? 'mid' : 'low';
            issues.push({
              severity: sev, type: 'restraint_vanish', key: 'restraint', scene: sceneIdx,
              evidence: `Scene ${sceneIdx}: ${line.slice(0, 60)}`,
              advice: 'The character was tied/locked up earlier but roams freely here. Add an escape beat (slipping the ropes, kicking the door, being released).',
            });
            flag(sceneIdx);
            activeRestraint.length = 0;
          }
        }

        if (DISABLE_PHONE_EN.test(line)) {
          stateChangeCount++;
          phoneDisabledAt = sceneIdx;
        }
        if (phoneDisabledAt !== null) {
          if (REPAIR_PHONE_EN.test(line)) {
            bridgedCount++;
            phoneDisabledAt = null;
          } else if (USE_PHONE_EN.test(line)) {
            const sev = issues.some((i) => i.type === 'device_resurrection') ? 'mid' : 'low';
            issues.push({
              severity: sev, type: 'device_resurrection', key: 'phone', scene: sceneIdx,
              evidence: `Scene ${sceneIdx}: ${line.slice(0, 60)}`,
              advice: 'The phone was smashed/dead/confiscated earlier but works here. Mention a new phone, a charge, or a borrowed landline.',
            });
            flag(sceneIdx);
            phoneDisabledAt = null;
          }
        }

        let dm: RegExpExecArray | null = null;
        for (const m of matchAll(line, DESTROY_OBJ_EN)) { dm = m; break; }
        if (!dm) for (const m of matchAll(line, DESTROY_VERB_FIRST_EN)) { dm = m; break; }
        if (dm) {
          const low = dm[0].toLowerCase();
          const key = USE_OBJ_RULES_EN.map((r) => r.key)
            .filter((k) => low.includes(k === 'paternity report' ? 'paternity' : k))
            .sort((a, b) => b.length - a.length)[0];
          if (key && !activeObjects.has(key)) {
            stateChangeCount++;
            activeObjects.set(key, sceneIdx);
          }
        }
        if (activeObjects.size) {
          const bridged = REPAIR_OBJ_EN.test(line);
          for (const rule of USE_OBJ_RULES_EN) {
            if (!activeObjects.has(rule.key)) continue;
            if (rule.re.test(line)) {
              if (bridged) {
                bridgedCount++;
                activeObjects.delete(rule.key);
              } else {
                issues.push({
                  severity: 'mid', type: 'object_restored', key: rule.key, scene: sceneIdx,
                  evidence: `Scene ${sceneIdx}: ${line.slice(0, 60)}`,
                  advice: `The ${rule.key} was destroyed earlier but is used intact here. Use a copy/backup on screen or replace it with a fresh document.`,
                });
                flag(sceneIdx);
                activeObjects.delete(rule.key);
              }
            }
          }
          if (bridged) activeObjects.clear();
        }
      }
    }
  });

  // —— 汇总打分 ——
  const injuryVanishCount = issues.filter((i) => i.type === 'injury_vanish').length;
  const objectRestoredCount = issues.filter((i) => i.type === 'object_restored').length;
  const deviceResurrectionCount = issues.filter((i) => i.type === 'device_resurrection').length;
  const restraintVanishCount = issues.filter((i) => i.type === 'restraint_vanish').length;
  const contradictionCount = issues.length;

  let penalty = 0;
  penalty += Math.min(injuryVanishCount * 12, 22);
  penalty += Math.min(objectRestoredCount * 11, 20);
  penalty += Math.min(deviceResurrectionCount === 1 ? 6 : deviceResurrectionCount * 9, 16);
  penalty += Math.min(restraintVanishCount * 5, 12);
  const bonus = Math.min(bridgedCount * 2, 6);

  issues.sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity] || a.scene - b.scene;
  });

  const sceneReports: ContinuitySceneReport[] = scenes.map((s, i) => ({
    index: i + 1,
    header: s.header,
    contradictionCount: sceneContradictions.get(i + 1) ?? 0,
  }));

  return {
    score: clamp(100 - penalty + bonus, 0, 100),
    sceneCount: scenes.length,
    stateChangeCount,
    contradictionCount,
    injuryVanishCount,
    objectRestoredCount,
    deviceResurrectionCount,
    restraintVanishCount,
    bridgedCount,
    scenes: sceneReports,
    issues,
  };
}
