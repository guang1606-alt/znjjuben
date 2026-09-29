import { isSceneHeaderLine } from './script-scenes';
/**
 * 吐真剂秒招 / 药物解锁真话检测（v2.103 块111，创作能力类）
 * ------------------------------------------------------------------
 * 病象：审讯戏本该是全剧智力密度最高的场面——证据博弈、交易筹码、
 *   心理拉锯，嫌疑人每吐一个字都要被剥一层皮。AI 却把审讯简化成
 *   一针药剂：针管扎进胳膊、药水推进静脉，嫌疑人眼皮发沉、意识
 *   模糊，下一拍问什么答什么，同伙、地点、计划、旧案一口气打包
 *   出库。审讯室不是实验室，意志不该有化学开关；一针见效的供词
 *   免掉了所有调查成本，也免掉了供词的可信度成本——真实世界里
 *   "吐真剂"从来换不来可质证的真相。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - drunk-truth：酒精解锁真话（酒桌/聚会，半推半就自己喝下去）；
 *    child-blurt：年幼解锁真话；soft-interrogation：权威/暴力解锁
 *    真话；deathbed-confession：死亡解锁真话；本引擎：药物解锁
 *    真话——"免费真心话"家族第五员（酒精→年幼→权威→死亡→
 *    药物）；
 *  - drunk-truth 与本引擎是"意识失控双通道"镜像兄弟：一个靠酒，
 *    一个靠针。词表硬隔离——本引擎锚注射/药剂，不含任何酒桌词，
 *    防止双计；
 *  - soft-interrogation：物理暴力/拍桌施压仍在"人扛不扛得住"的
 *    博弈范围内，本引擎直接用化学手段绕过博弈，连"扛"的资格都
 *    被取消；
 *  - poison-ledger：跨集毒物账本（谁中过什么毒、后果连续性），
 *    本引擎管单集"给药→生效→全招"的密度病；
 *  - instant-hack：电子锁秒破，本引擎是"人形锁秒开"，同属零成本
 *    获取家族但渠道不同（化学渠道）。
 *
 * 判定（三锚，缺一不可）：
 *  - DRUG 给药锚（场景头不参与匹配）：
 *    ①STRONG 药剂名——吐真剂/实话针/诚实剂/真言水/硫喷妥钠/
 *      东莨菪碱/蒙汗药/迷魂药 + truth serum/sodium pentothal/
 *      thiopental/scopolamine/veritaserum，见名即锚；
 *    ②WEAK 注射行为——打针/注射/针管/针头/药水推注 + syringe/
 *      injection/injected/needle，必须同行有"让他说实话/招供/
 *      问什么答什么"意图语境才成立（防退烧针/麻醉手术/胰岛素
 *      等正常医疗注射误判）；
 *  - EFFECT 药效锚：给药之后 0..5 行（同场景）出现意识失控锚
 *    （眼皮发沉/意识模糊/浑身发软/管不住嘴/问什么答什么/没法
 *    撒谎/一股脑全说 + eyes grew heavy/drowsy/couldn't resist/
 *    couldn't lie/answered every question/words poured out…）；
 *  - PAYLOAD 实质情报五族（与 deathbed-confession 同构）：deed
 *    指认罪行 / accomplice 同伙 / evidence 证据位置 / location
 *    藏匿地点 / oldcase 旧案；纯情感倾诉（"我对不起老婆"）放行；
 *  - 顺序闸门：先给药后吐货（payload 首行 ≥ 给药行、相距 ≤6 行，
 *    同场景）；先招后打针不成立；跨场景不配对；一针只配对其后
 *    第一组情报（多个 payload 组必须各自有给药锚）；
 *  - 相邻 ≤2 行的情报行合并为同一事件（跨场景头不合并）；
 *  - rescue（窗口 start−2…payloadEnd+2，含事件自身，仅跳过
 *    场景头）：
 *    ①FAKE 假招/抗药——提前服了解药、抗药性、给假名字、胡乱
 *    攀扯、说的是暗号，吐出来的情报不可信，针就白打了；
 *    ②FRAGMENT 混乱片段——语无伦次、只言片语、答非所问、没说
 *    两句就昏死过去，情报不可直接消费；
 *    ③COST 代价与来路——药剂是黑市抢来的、为这针绑了医生、
 *    下药本身是重罪、全程录像反成罪证、主角自己也挨了一针，
 *    用药这场戏本身有重量；
 *  - 第 1 次豁免（一次药剂审讯是类型片桥段），第 2 次起每次
 *    1 hit；
 *  - 计分（密度病）：n=0 → 100；n≥1 → max(20, 90 - n*20)。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface TruthSerumHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  snippet: string;
  marker: string;
  /** 是否有假招抗药/混乱片段/用药代价（放行不扣分） */
  rescued: boolean;
  reason: string;
}

export interface TruthSerumResult {
  score: number;
  /** 吐真剂秒招事件总数（含豁免的第 1 次） */
  hitCount: number;
  /** 计入扣分的命中数（未 rescued） */
  unrescuedCount: number;
  hits: TruthSerumHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


/* ① STRONG 药剂名：见名即锚 */
const DRUG_STRONG_ZH_RE = /吐真剂|吐真药|吐真针|真话药?剂?|实话针|实话剂?|诚实剂|诚实针|自白剂|真言水|真言散?|真言药|硫喷妥钠|戊硫巴比妥钠?|东莨菪碱|异戊巴比妥|阿米妥钠?|蒙汗药|迷魂药|迷魂汤|失魂散/;

const DRUG_STRONG_EN_RE = /\btruth\s+serum\b|\bsodium\s+pentothal\b|\bpentothal\b|\bthiopental(?:\s+sodium)?\b|\bscopolamine\b|\bsodium\s+amytal\b|\bamobarbital\b|\bveritaserum\b|\btruth\s+drug\b/i;

/* ② WEAK 注射行为：必须同行有"让他说实话/招供"意图语境（防退烧针/麻醉/胰岛素） */
const DRUG_WEAK_ZH_RE = new RegExp(
  /(?:静脉(?:推注|注射)|注射(?:了|剂|入)?|打了?一针|打针|扎了?一针|这?针[^。！？\n]{0,6}(?:扎|推|打)(?:下去|进去|入)?|针管|针头(?:扎|刺|进|入)|药水[^。！？\n]{0,4}(?:推|注)入?|药剂)/.source
  + '[^。！？\n]{0,16}'
  + /(?:吐真|实话|真话|说(?:出)?(?:秘密|真相|实情)|招(?:供|了|出)?|交代(?:一切|全部)?|问什么[^。！？\n]{0,4}(?:都|就)?答|让他开(?:口|口说话))/.source
  + '|'
  + /(?:吐真|实话|真话|让他说(?:出)?(?:秘密|真相|实话|实情)|逼他招(?:供)?|撬开(?:他)?的?嘴)/.source
  + '[^。！？\n]{0,16}'
  + /(?:静脉(?:推注|注射)|注射|一针|打针|针管|针头|药水|药剂)/.source,
);

const DRUG_WEAK_EN_RE = new RegExp(
  /\b(?:injected\s+(?:him|her|them)\s+with|gave\s+(?:him|her|them)\s+(?:an?\s+)?(?:shot|injection)|slid\s+the\s+needle|needle\s+(?:slid|went|pressed|sank)\s+into|syringe\s+(?:pressed|went|slid)|pressed\s+the\s+syringe|IV\s+(?:drip|line)|intravenous(?:\s+shot)?)\b/.source
  + '[^.?!\n]{0,24}'
  + /\b(?:truth|make\s+(?:him|her|them)\s+talk|make\s+(?:him|her|them)\s+confess|serum|answers?|everything)\b/.source
  + '|'
  + /\b(?:truth\s+serum|make\s+(?:him|her|them)\s+talk|make\s+(?:him|her|them)\s+confess|force\s+(?:him|her|them)\s+to\s+answer)\b/.source
  + '[^.?!\n]{0,24}'
  + /\b(?:inject(?:ed|ion)?|shot|syringe|needle|serum|drip)\b/.source,
  'i',
);

/* EFFECT 药效/意识失控锚 */
const EFFECT_ZH_RE = new RegExp(
  /眼皮(?:直)?(?:发)?沉|一阵?眩晕|头晕目眩|意识(?:开始)?模糊|神志(?:开始)?不清|昏昏沉沉|迷迷糊糊|恍恍惚惚|浑身发软|四肢无力|身子一软|身体不受(?:自己|大脑)?控制|不受控制|管不住(?:自己的?)?嘴|嘴巴不受(?:大脑)?控制/.source
  + '|' + /有问必答|问什么答什么|问(?:一|他什么)[^。！？\n]{0,2}答一?|没法?撒谎|无法?撒谎|不能撒谎|只会?说实话|必须说实话|不由自主(?:地)?(?:说|交代|开口)|不知不觉(?:地)?(?:说|交代)|脱口而出/.source
  + '|' + /一股脑(?:儿)?(?:全|都)?说(?:了|出来)?|竹筒倒豆子|和盘托出|什么都招了?|全招了?|全(?:都)?交代了?|老(?:老)?实(?:实)?交代|把(?:什么|所有|一切)(?:都|全)说了?/.source,
);

const EFFECT_EN_RE = new RegExp(
  /\beyes\s+(?:grew|got|felt|went)\s+heavy\b|\bdrows(?:y|iness)\b|\bgroggy\b|\bvision\s+(?:blurred|went\s+blurry)\b|\bhead\s+(?:began\s+to\s+)?spun\b|\bsedated\b|\bunder\s+the\s+(?:influence|serum|drug)\b|\bwent\s+limp\b|\blimbs?\s+(?:turned|went)\s+(?:to\s+)?jelly\b|\bcouldn'?t\s+control\s+(?:himself|herself|his\s+mouth|her\s+mouth)\b/.source
  + '|' + /\bcouldn'?t\s+(?:resist|help\s+it|lie|stop\s+(?:himself|herself)(?:\s+talking)?)\b|\bunable\s+to\s+lie\b|\bcompelled\s+to\s+(?:tell|answer|speak|confess)\b|\banswered\s+every\s+question\b|\bwhatever\s+(?:they|he|she)\s+asked,?\s+he\s+answered\b|\bhad\s+to\s+answer\b/.source
  + '|' + /\bwords?\s+(?:just\s+)?poured\s+out\b|\bspilled\s+(?:it\s+)?all\b|\bconfessed\s+(?:it\s+)?all\b|\btold\s+them\s+everything\b|\bbegan?\s+to\s+talk\b|\bcouldn'?t\s+stop\s+talking\b|\bit\s+all\s+came\s+out\b/.source,
  'i',
);

/* 实质情报 payload 五族：罪行指认/同伙/证据位置/藏匿地点/旧案（纯情感倾诉不收） */
const PAYLOAD_ZH =
  /(?:凶手|真凶|杀(?:你|他|她|爹|爸|妈|父亲|母亲|哥|姐|夫|妻|子|女)[^。！？\n]{0,4}的人|幕后(?:主使|黑手|的人)|主谋)(?:就|是|叫|姓)[^。！？\n]{0,14}|是[^。！？\n]{1,10}(?:害死|杀(?:了|死|害)?|做掉(?:了)?|灭口(?:了)?|指使(?:的)?|买凶|换药(?:的)?|纵火|放(?:的)?火|推下(?:去|楼)?(?:的)?|掉包|栽赃(?:的)?|嫁祸(?:的)?|逼死|挪用|卷走)/.source
  + '|' + /人是我杀的|是我(?:干|做|杀|害|放火|换的药|推下去的|害死的|掉的包)|我(?:杀|害|做掉|灭口|放火|换药|掉包|栽赃|嫁祸)(?:了|死)?/.source
  + '|' + /同伙(?:是|叫|还有)[^。！？\n]{0,10}|帮凶(?:是|叫)?|同谋(?:是|叫)?|内鬼(?:是|叫)?|接应(?:他)?(?:的人)?(?:是|叫)|(?:指使|命令|买通|收买|胁迫)我(?:们)?(?:的人)?(?:是|叫)[^。！？\n]{0,8}|还有(?:一个|个)(?:人|同伙|帮手|内鬼)|跟(?:他|她)(?:一伙|接应|联手)的是/.source
  + '|' + /(?:账本|账簿|账册|录音(?:笔|带|文件)?|录像|监控|视频|U盘|硬盘|日记|遗嘱|合同|亲子鉴定|DNA报告?|书信|密信|股权转让|收据|银行流水|通话记录|证据|换药记录)[^。！？\n]{0,10}(?:藏|放|锁|埋|塞|压)(?:在|到|进|于)[^。！？\n]{0,14}/.source
  + '|' + /(?:人质|孩子|女儿|儿子|钱|赃款|货款|现金|尸体|货|毒品)(?:被)?(?:藏|关|扣|埋|放)(?:在|到)[^。！？\n]{0,14}/.source
  + '|' + /[一二两三四五六七八九十\d]+年前(?:那)?(?:桩|起)?[^。！？\n]{0,6}(?:火|命案|案子|绑架|抢劫|车祸|纵火)(?:也是我|是我(?:干|做|策划|放)的?)?|当年(?:的)?[^。！？\n]{0,8}(?:也是我(?:干|做)的?|我也有份)/;

const PAYLOAD_ZH_RE = new RegExp(PAYLOAD_ZH);

const PAYLOAD_EN =
  /\b(?:the\s+)?(?:killer|murderer|man\s+who\s+killed(?:\s+him|\s+her)?|person\s+who\s+did\s+it|one\s+behind\s+it\s+all)\s+(?:is|was)\s+[A-Z][\w'’-]*|\bthe\s+(?:killer|murderer)\s+(?:is|was)\s*(?:\.\.\.|…)/.source
  + '|' + /\bit\s+was\s+[A-Z][\w'’-]+\s+(?:who\s+)?(?:killed|murdered|poisoned|pushed|framed|set\s+fire|switched|ordered)\b|\bi\s+killed\b|\bi\s+was\s+the\s+one\s+who\b|\bthat\s+was\s+me\s+too\b/.source
  + '|' + /\bmy\s+(?:accomplice|partner(?:\s+in\s+crime)?|boss|contact)\s+(?:is|was)\b|\bthe\s+inside\s+(?:man|job)\s+(?:is|was)\b|\b(?:he|she|they)\s+(?:ordered|made|forced|paid|threatened)\s+me\s+to\b|\bthere\s+was\s+(?:another\s+guy|someone\s+else|two\s+of\s+us)\b/.source
  + '|' + /\b(?:the\s+)?(?:ledger|recording|tape|footage|diary|will|contract|letter|paternity\s+report|DNA\s+report|evidence|usb\s+drive|hard\s+drive|medical\s+records)\s+(?:is|was)\s+(?:hidden|buried|locked|kept|stashed|taped)\s+(?:at|in|under|inside|behind)\b/.source
  + '|' + /\b(?:the\s+)?(?:money|drugs|body|cash|stash|girl|kid|hostage)\s+(?:is|was|are)\s+(?:hidden|held|buried|kept|locked)(?:\s+(?:at|in|under)\b|\s*(?:\.\.\.|…|……)[\s.]*(?:at|in|under)\b)|\bwe\s+(?:hid|buried|stashed)\s+(?:it\s+)?(?:at|in|under)\b/.source
  + '|' + /\b\d+\s+years?\s+ago\s+i\s+(?:also\s+)?(?:killed|did|burned|set)\b|\bi\s+also\s+(?:killed|did|burned|took)\s+(?:the|that|him|her)\b/;

const PAYLOAD_EN_RE = new RegExp(PAYLOAD_EN, 'i');

/* rescue A：假招/抗药——情报不可信，针白打了 */
const FAKE_ZH_RE = new RegExp(
  /抗药(?:性|体质)?|(?:提前|事先)(?:服|吃|注(?:射)?打?)了?解药|早就防着这一(?:手|针)|留了?个?心眼|事先有(?:了)?防备/.source
  + '|' + /说的?(?:全|都)是假(?:话|的|名字|情报)?|给(?:了)?(?:他|她|对方)?(?:个)?假名(?:字)?|假名(?:字)?|胡乱攀扯|乱咬(?:一气|好人)|胡(?:乱)?编(?:的|造)?|瞎编(?:的)?|信口胡(?:说|诌)|故意(?:说假|反咬|栽赃|乱招)|半真半假|(?:说|答)的?(?:全|都)?是暗(?:号|语)|说的(?:全|都)?是废(?:话|情报)/.source,
);

const FAKE_EN_RE = new RegExp(
  /\bbuilt\s+(?:up\s+)?(?:a\s+)?tolerance\b|\btook\s+the\s+antidote\b|\btook\s+an?\s+antidote\b|\b(?:already\s+)?braced\s+(?:for|against)\s+the\s+serum\b|\bknew\s+the\s+serum\s+was\s+coming\b|\bpretended\s+to\s+be\s+under\b|\bfaked\s+(?:being\s+)?under\b/.source
  + '|' + /\blied\s+(?:through|under)\s+(?:the\s+)?(?:serum|drug|influence)\b|\bgave\s+(?:them|him|her)\s+a\s+false\s+name\b|\bfalse\s+name\b|\bfed\s+(?:them|him|her)\s+disinformation\b|\bmade\s+it\s+(?:all\s+)?up\b|\bhalf[- ]truths?\b|\bcode\s+words?\b|\bnamed\s+(?:an\s+)?innocent\s+man\b|\bthrew\s+out\s+random\s+names\b/.source,
  'i',
);

/* rescue B：混乱片段——情报不可直接消费 */
const FRAGMENT_ZH_RE = new RegExp(
  /语无伦次|断断续续|含糊不清|含混不清|口齿不清|只(?:会|能)?蹦(?:出)?(?:几个)?(?:单)?字|只言片语|不成(?:句|整句)|答非所问|前后不搭|胡话|梦话(?:似)的?/.source
  + '|' + /(?:没说(?:完|几句|两个字)|话音未落|刚开口)[^。！？\n]{0,8}(?:昏|晕|睡)(?:了|过去|死过去|过去)?|眼皮一翻[^。！？\n]{0,6}(?:昏|晕|倒)|又(?:昏|晕)(?:睡|死)?过去|声音越来越低[^。！？\n]{0,8}(?:昏|睡|晕|没了)/.source,
);

const FRAGMENT_EN_RE = new RegExp(
  /\bincoherent\b|\bslurred\s+(?:his|her)?\s*speech\b|\bslurred\b|\bnonsens(?:e|ical)\b|\bfragments?\s+of\s+sentences?\b|\bunintelligible\b|\bdrifted\s+in\s+and\s+out\b|\bkept\s+drifting\s+off\b|\bmumbled\s+incomplete\b/.source
  + '|' + /\bpassed\s+out\b|\bblacked\s+out\b|\bfell\s+unconscious\b|\bmid[- ]sentence\b|\bsank\s+into\s+unconsciousness\b|\bfaded\s+out\s+mid[- ]word\b/.source,
  'i',
);

/* rescue C：用药的代价与来路——这场戏本身有重量 */
const COST_ZH_RE = new RegExp(
  /(?:药剂|吐真剂|针剂|药水)(?:是)?[^。！？\n]{0,8}(?:抢|偷|弄|搞)来的?|黑(?:市|渠道)[^。！？\n]{0,8}(?:买|弄|搞)|为(?:了|这)针?[^。！？\n]{0,10}(?:杀(?:了|人)?|死(?:了)?|绑(?:架)?|劫)/.source
  + '|' + /绑架(?:后)?(?:用药|注射|打针)|非法(?:用药|注射|拘禁)|(?:胁迫|要挟|逼)医生|拿[^。！？\n]{0,8}(?:家人|老婆|孩子|女儿)要挟/.source
  + '|' + /全程(?:被)?录(?:像|音|下)|录(?:像|音)[^。！？\n]{0,8}(?:成了|就是)?(?:罪证|证据|呈堂证供)|反过来(?:被|挨)(?:下药|打针|一针)|自己(?:也|反倒)?挨了?一针|(?:被|遭)反?将一军/.source,
);

const COST_EN_RE = new RegExp(
  /\bstole\s+the\s+serum\b|\bstolen\s+(?:serum|drug|vial)\b|\brobbed\s+a\s+(?:lab|pharmacy|clinic)\b|\bblack[- ]market\s+serum\b|\bpaid\s+a\s+fortune\s+for\s+the\s+vial\b/.source
  + '|' + /\bkidnapping\s+and\s+drugging\b|\bforced\s+the\s+doctor\s+at\s+gunpoint\b|\bblackmailed\s+the\s+doctor\b|\bunlawful\s+injection\b|\bhis\s+(?:family|daughter|wife)\s+was\s+threatened\b/.source
  + '|' + /\bthe\s+(?:whole\s+thing|session|interrogation)\s+was\s+(?:secretly\s+)?recorded\b|\brecording\s+(?:later\s+)?became\s+evidence\b|\bthey\s+dosed\s+him\s+too\b|\bended\s+up\s+with\s+a\s+needle\s+in\s+(?:his|her)\s+own\s+arm\b|\bthe\s+serum\s+was\s+used\s+against\s+them\b/.source,
  'i',
);

const EFFECT_LOOKAHEAD = 5;
const PAYLOAD_LOOKAHEAD = 6;
const RESCUE_PAD = 2;

/**
 * 纯函数：检测"吐真剂秒招/药物解锁真话"密度病。
 */
export function truthSerum(draft: string): TruthSerumResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);
  const strongRe = zh ? DRUG_STRONG_ZH_RE : DRUG_STRONG_EN_RE;
  const weakRe = zh ? DRUG_WEAK_ZH_RE : DRUG_WEAK_EN_RE;
  const effectRe = zh ? EFFECT_ZH_RE : EFFECT_EN_RE;
  const payloadRe = zh ? PAYLOAD_ZH_RE : PAYLOAD_EN_RE;
  const fakeRe = zh ? FAKE_ZH_RE : FAKE_EN_RE;
  const fragmentRe = zh ? FRAGMENT_ZH_RE : FRAGMENT_EN_RE;
  const costRe = zh ? COST_ZH_RE : COST_EN_RE;

  /* 场景映射（场景头不参与词表匹配） */
  let sceneIdx = -1;
  let header = '';
  const sceneOf: number[] = new Array(rawLines.length).fill(0);
  const headerOf: string[] = new Array(rawLines.length).fill('');
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      sceneIdx += 1;
      header = line;
    }
    sceneOf[i] = Math.max(0, sceneIdx);
    headerOf[i] = header;
  });

  /* pass1：逐行标记（场景头行不参与匹配） */
  const hasDrug: boolean[] = new Array(rawLines.length).fill(false);
  const drugStrong: boolean[] = new Array(rawLines.length).fill(false);
  const hasEffect: boolean[] = new Array(rawLines.length).fill(false);
  const hasPayload: boolean[] = new Array(rawLines.length).fill(false);
  rawLines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    drugStrong[i] = strongRe.test(line);
    hasDrug[i] = drugStrong[i] || weakRe.test(line);
    hasEffect[i] = effectRe.test(line);
    hasPayload[i] = payloadRe.test(line);
  });

  /* pass2：情报行成组（相邻 ≤2 行合并、跨场景头不合并） */
  const groups: { start: number; end: number }[] = [];
  rawLines.forEach((raw, i) => {
    if (!hasPayload[i]) return;
    const last = groups[groups.length - 1];
    if (last && i - last.end <= 2) {
      const between = rawLines.slice(last.end + 1, i);
      if (!between.some((l) => isSceneHeaderLine(l.trim()))) {
        last.end = i;
        return;
      }
    }
    groups.push({ start: i, end: i });
  });

  /* 配对：组前 0..6 行（同场景、含同行）找给药锚（先药后招，一针配一组），
     给药行与组之间 0..5 行内须有药效锚（含给药行/供词行自身） */
  interface Ev { start: number; end: number; drugLine: number; anchorEnd: number; marker: string; }
  const usedDrug = new Set<number>();
  const events: Ev[] = [];
  for (const g of groups) {
    let drugLine = -1;
    for (let j = g.start; j >= Math.max(0, g.start - PAYLOAD_LOOKAHEAD); j -= 1) {
      if (sceneOf[j] !== sceneOf[g.start]) break;
      if (hasDrug[j] && !usedDrug.has(j)) { drugLine = j; break; }
    }
    if (drugLine < 0) continue; /* 无给药：正常审讯/主动招供，不归本引擎 */
    let effectOk = false;
    for (let j = drugLine; j <= Math.min(g.end, drugLine + EFFECT_LOOKAHEAD); j += 1) {
      if (sceneOf[j] !== sceneOf[drugLine]) break;
      if (hasEffect[j]) { effectOk = true; break; }
    }
    if (!effectOk) continue; /* 打了针但没演出药效/失控——不成立 */

    let drugM = '';
    const sm = rawLines[drugLine].match(strongRe);
    if (sm) drugM = sm[0].replace(/^\s+/, ''); /* STRONG：药剂名原样保留（如 sodium pentothal） */
    if (!drugM) {
      const wm = rawLines[drugLine].match(weakRe);
      drugM = wm ? wm[0].replace(/^\s+/, '').slice(0, 14) : (zh ? '注射' : 'injection');
    }
    const payloadBudget = Math.max(6, 27 - drugM.length);
    const payloadM = (rawLines[g.start].match(payloadRe)?.[0] ?? '').replace(/^\s+/, '').slice(0, payloadBudget);
    usedDrug.add(drugLine);
    events.push({
      start: drugLine,
      end: g.end,
      drugLine,
      anchorEnd: g.start,
      marker: `${drugM}→${payloadM}`.slice(0, 28),
    });
  }

  /* pass3：rescue 检测（假招抗药/混乱片段/用药代价三路；窗口含事件自身，仅跳过场景头行） */
  const hits: TruthSerumHit[] = [];
  let hitCount = 0;

  for (const ev of events) {
    hitCount += 1;
    if (hitCount < 2) continue; /* 首次豁免（一次药剂审讯是类型片桥段） */
    const lo = Math.max(0, ev.start - RESCUE_PAD);
    const hi = Math.min(rawLines.length - 1, ev.end + RESCUE_PAD);
    const winLines: string[] = [];
    for (let j = lo; j <= hi; j += 1) {
      if (isSceneHeaderLine(rawLines[j].trim())) continue;
      winLines.push(rawLines[j]);
    }
    const win = winLines.join('\n');
    const rescued = fakeRe.test(win) || fragmentRe.test(win) || costRe.test(win);
    hits.push({
      line: ev.anchorEnd + 1,
      sceneIndex: sceneOf[ev.anchorEnd],
      sceneHeader: headerOf[ev.anchorEnd],
      snippet: rawLines[ev.anchorEnd].trim().slice(0, 30),
      marker: ev.marker,
      rescued,
      reason: zh
        ? '又是吐真剂秒招——针管一推眼皮就沉，没有证据博弈、没有交易筹码、没有心理拉锯，同伙、地点、旧案问什么答什么，化学药剂替编剧省掉了整场审讯戏，也省掉了供词的可信度'
        : 'truth-serum dump again - one push of the syringe and the eyelids drop; no evidence duel, no deal, no psychological wrestling, just accomplice, location and the old case on demand; a chemical shortcut saves the writer the entire interrogation scene and costs the confession all credibility',
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n === 0 ? 100 : Math.max(20, 90 - n * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 1) {
    issues.push(zh
      ? `${hitCount} 处"吐真剂秒招"（${n} 处未救）——审讯戏被简化成一针药水：扎针、眼皮发沉、问什么答什么，同伙地点旧案三行打包。第一次是类型片猎奇，第三次观众就发现：这个剧里最难的从不是查案，是谁兜里有针。意志被化学开关接管，所有角色的守密能力瞬间清零。`
      : `${hitCount} truth-serum beats (${n} unrescued) - the interrogation collapses into one vial: needle in, eyelids drop, accomplice and location and the cold case handed over in three lines. Once is genre novelty; by the third, the audience sees that the hardest thing in this story is never detective work, it is who owns a syringe. A chemical switch takes over human will and zeros out every character's ability to keep a secret.`);
    advice.push(zh
      ? '把审讯戏的智力密度还给审讯：①让针失效——他提前服了解药、有抗药体质、早防着这一手，吐出来的是假名字、暗号和反咬，下药方反倒被供词带进沟里，化学万能第一次破产；②让药效打折——语无伦次、只言片语、答非所问，没说两句就昏死过去，听见的人只捡到半串地址和一个对不上的日期，情报必须拼凑、验证、甚至被证伪；③让用药本身成为一场重戏——药剂是黑市抢来的、医生被拿家人胁迫、绑架下药罪加一等、全程录像后来反成呈堂证供、主角自己也挨了一针，用药者先犯罪再取证，供词在法庭上一文不值，这场戏要付代价、有反噬；④根本之道是写出拉锯——把证据甩在桌上让他算账，用家人和刑期跟他交易，让他从沉默、冷笑、否认、还价到松口走完整个过程，供词越难撬越值钱。最忌讳一集三回"扎针→发沉→全招→昏倒"。真要用药，就让这针改变用药者的命运，而不是只改变剧情的进度。'
      : 'Give the interrogation its intelligence back. (1) Make the serum fail - he took an antidote in advance, has a tolerance, braced for the needle; what comes out is a false name, code words and a counter-accusation that leads the dosing side into a trap; chemical omnipotence goes bankrupt on screen. (2) Make the drug under-deliver - incoherent, fragmentary, off-point answers, then he blacks out after two sentences; the listeners salvage half an address and a date that does not check out, and the intelligence must be assembled, verified and possibly disproved. (3) Make the dosing itself a heavy scene - the serum was robbed from a black-market lab, the doctor was blackmailed through his family, kidnapping plus drugging is a felony stack, the secret recording later becomes court evidence against the interrogators, the protagonist ends up with a needle in his own arm; the users commit a crime before they extract a word, and the confession is worthless in court. (4) The real fix is the wrestling match - evidence slid across the table so he can do the math, a deal built on family and sentence length, the full arc from silence and scorn through denial and bargaining to release; the harder a confession is pried open, the more it is worth. The unforgivable pattern is three "needle -> drowsy -> full dump -> blackout" beats per episode. If the drug must appear, let it change the fate of whoever used it - not merely the progress of the plot.');
  }
  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
