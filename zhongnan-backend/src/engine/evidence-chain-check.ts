import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.142 翻盘证据链公平性检测（PRD 2.1.39 翻盘靠证据，证据必须先于结论埋好——契诃夫之枪）
 * ------------------------------------------------------------------
 * 竖屏短剧的顶格爽点是"打脸时刻当众甩出证据"，顶格差评是"证据想要就有"——
 * 最终对峙时凭空播放录音、一集甩出录音/监控/亲子鉴定/合同/流水五份铁证、
 * 角色连喊三集"我有证据"却从不掏出来、本该死去的人证推门而入且毫无安排。
 * 本引擎专管**翻盘/定罪/打脸时刻实物证据与人证的铺垫公平性**。
 *
 * 分工（近邻引擎边界）：
 *  - causal-logic / deus_ex_machina：救"人"的外部救兵（救兵/贵人/援兵天降解围）
 *  - causal-logic / unsourced_knowledge：脑子里的信息空降（"我早就知道"无获知来源）
 *  - foreshadow-ledger：信件/玉佩等器物的跨集关键词松散记账（对象不在翻盘时刻判定）
 *  - continuity(v2.139)：被毁/已用道具的状态复原
 *  - v2.142（本引擎）：事件级——翻盘当场出示的物证是否此前已埋、人证是否此前已请、
 *    证据雨堆叠、光喊"有证据"不掏
 *
 * 四类问题：
 *  1) unplanted_evidence    物证无铺垫：当场播放/甩出录音、监控、鉴定、合同、流水、照片，
 *                           但在此之前的任何一行都没有获取/布置信号（同行补一句"我早有准备"不算）
 *  2) evidence_overkill     证据雨：一集当场出示 ≥3 种不同铁证（编剧堆叠奇迹），3 种 low、≥4 种 mid
 *  3) verbal_evidence_only  空口证据：≥2 次"我有证据/我手里有你的录音"，本集一次都没有真出示
 *  4) airdropped_witness    人证空降：关键时刻推门而入/死者复生作证，此前无"已安排/去接/答应作证"
 *
 * 正信号：物证先埋后打（plant 行严格早于 show 行，跨场或同场早些时候均可）→ fairShow +2/次 cap6
 */

export type EcLang = 'zh' | 'en';

export interface EvidenceChainIssue {
  severity: 'high' | 'mid' | 'low';
  type:
    | 'unplanted_evidence'
    | 'evidence_overkill'
    | 'verbal_evidence_only'
    | 'airdropped_witness';
  evidence: string;
  advice: string;
  scene: number;
  key: string;
}

export interface EvidenceChainSceneReport {
  index: number;
  header: string;
  flagCount: number;
}

export interface EvidenceChainResult {
  score: number;
  sceneCount: number;
  /** 证据信号总数（铺垫/出示/空口宣称/人证到场行） */
  signalCount: number;
  issueCount: number;
  /** 当场出示事件数（行×证据种类） */
  showCount: number;
  /** 铺垫行数量 */
  plantCount: number;
  /** "我有证据"宣称行数量 */
  claimCount: number;
  /** 人证到场次数 */
  witnessCount: number;
  /** 本集当场出示的不同证据种类数（recording/footage/report/contract/records/photo） */
  distinctEvidenceKinds: number;
  /** 先埋后打的公平出示次数（正信号） */
  fairShowCount: number;
  scenes: EvidenceChainSceneReport[];
  issues: EvidenceChainIssue[];
}

// —— 场景切分（复用 v2.132 起标题约定）——

// —— 物证当场出示（名词 + 出示/证明动作同行；按种类分别建库，长串在前）——
// 录音
const SHOW_RECORDING_ZH = /(?:录音笔|录音|那段话)[^，。；？！\n]{0,14}?(?:播放|放出|公放|响起|传出(?:来|他的声音|她的声音)|里面(?:说|是|传来)|按下播放)|(?:播放|放出|点开|按下)[^，。；？！\n]{0,6}?录音|录音里(?:传)?(?:出|来|是|说)/;
const SHOW_RECORDING_EN = /\b(?:played|plays|playing|put on|aired|blared|broadcast(?:ed)?|clicked play on)[^.\n]{0,16}?(?:recording|tape|audio(?: clip)?|voice message)|the (?:recording|tape|audio) (?:played|began|went|blared|started|said|filled)|played (?:him|her|them) the (?:recording|tape)\b/i;
// 监控/视频
const SHOW_FOOTAGE_ZH = /(?:监控|录像|视频|摄像头)[^，。；？！\n]{0,18}?(?:画面)?(?:显示|拍到|录(?:下|到)|播放|放出|调出|投在|公放)|(?:监控|录像|视频)(?:画面)?里(?:面)?(?:是|显示|出现|能看到)|大屏(?:幕|上)?[^，。；？！\n]{0,8}?(?:监控|录像|视频)|(?:播放|放出|点开|打开|调出|投出|公放)[^，。；？！\n]{0,6}?(?:那段)?(?:视频|录像|监控)/;
const SHOW_FOOTAGE_EN = /\b(?:security )?(?:footage|CCTV|video|surveillance (?:tape|video))[^.\n]{0,22}?(?:showed|shows|displayed|revealed|played|on (?:the )?(?:screen|monitor)|captured|caught)|(?:the )?(?:footage|video|CCTV) (?:showed|played|revealed)|on[- ]screen footage\b/i;
// 鉴定/报告类
const SHOW_REPORT_ZH = /(?:亲子鉴定|DNA鉴定|DNA报告|鉴定报告|尸检报告|体检报告|诊断书|检验报告|化验(?:单|结果)|鉴定结果)[^，。；？！\n]{0,14}?(?:显示|证明|表明|写着|结论|公布|宣读|甩|拍|摆|放|摊|递|举|打开|大屏)|(?:甩|拍|摆|放|摊|递|举|打开|公布|宣读)[^，。；？！\n]{0,8}?(?:亲子鉴定|鉴定|DNA|尸检|体检)(?:报告|结果|书)?/;
const SHOW_REPORT_EN = /\b(?:DNA|paternity|autopsy|medical|diagnostic|forensic|lab) (?:report|results|test)[^.\n]{0,20}?(?:showed|proved|confirmed|stated|read|revealed|slammed|placed|held up|presented|on (?:the )?screen)|(?:slammed|held up|presented|read (?:out|aloud))[^.\n]{0,12}?(?:paternity|DNA|autopsy|medical|forensic) (?:report|results)\b/i;
// 合同/文书类
const SHOW_CONTRACT_ZH = /(?:股权转让(?:协议|书)?|股份代持协议|转让协议|合同|协议书|遗嘱|授权书|委任状)[^，。；？！\n]{0,14}?(?:甩|拍|摆|放|摊|递|举|打开|翻到|签字|盖(?:了|上)?章|白纸黑字|条款|当众|公布|显示|证明)|(?:甩|拍|摆|放|摊|递|举|打开|翻出)[^，。；？！\n]{0,8}?(?:合同|协议|遗嘱|授权书)/;
const SHOW_CONTRACT_EN = /\b(?:contract|agreement|share transfer|transfer papers|the will|authorization letter|power of attorney)[^.\n]{0,20}?(?:proved|slammed|threw|placed|laid|held up|signed|in black and white|presented|revealed|showed|clause)|(?:slammed|held up|presented|laid out)[^.\n]{0,12}?(?:contract|agreement|will)\b/i;
// 记录/流水类
const SHOW_RECORDS_ZH = /(?:转账记录|银行流水|流水(?:单|明细)|交易明细|通话(?:记录|清单)|聊天记录|消费记录|开房记录|出入记录)[^，。；？！\n]{0,14}?(?:显示|证明|甩|拍|摆|放|摊|递|打印|调出|翻开|翻出|明细)|(?:甩|拍|摆|放|摊|递|打印|调出|翻开|翻出)[^，。；？！\n]{0,8}?(?:流水|记录|明细|清单)/;
const SHOW_RECORDS_EN = /\b(?:bank(?:ing)?|transfer|transaction|payment|call(?: log)?|phone records|chat logs?|text messages?|expense|hotel) records?[^.\n]{0,22}?(?:showed|proved|printed|pulled up|displayed|revealed|slammed|placed|presented)|(?:pulled up|printed|slammed)[^.\n]{0,14}?(?:bank|transfer|transaction|call|phone|chat) records?\b/i;
// 照片类
const SHOW_PHOTO_ZH = /(?:照片|相片|图片|合影)[^，。；？！\n]{0,12}?(?:甩|拍|摆|放|摊|递|举|亮|冲(?:着|向)|传(?:阅|看)|显示|证明)|(?:甩|拍|摆|放|摊|递|举|亮出)[^，。；？！\n]{0,6}?(?:照片|相片|图片)|这(?:张|份)[^，。；？！\n]{0,4}?(?:照片|相片)/;
const SHOW_PHOTO_EN = /\b(?:photo(?:graph)?|picture|image|selfie)[^.\n]{0,18}?(?:slammed|threw|held up|flashed|showed|presented|shoved|handed around|revealed|proved)|(?:slammed|held up|flashed|shoved)[^.\n]{0,10}?(?:photo(?:graph)?|picture)\b/i;

// —— 获取/布置铺垫（必须出现在"出示行"之前的某一行；同行事后补算无效）——
const PLANT_ZH = /(?:提前|事先|事前|预先|早就(?:准备|录|装|查|调|备|拍|拿到|布好)|早有准备|早留(?:了)?(?:一)?手|偷偷(?:把|将)?[^，。；？！\n]{0,6}?(?:录(?:下|好|音)|装(?:好|上)?|拍(?:下|好)?|藏(?:好|进|起)?|放(?:好|进)?|留(?:下|好)?(?:了)?(?:证据|一手)?|安(?:好|装))|暗中(?:录|装|跟踪|调查|布|安排)|私自(?:录|装)|备(?:好|了)份|留了?(?:一(?:手|个心眼)|备份|后手|证据|底)|装好(?:了)?(?:针孔|摄像头|监控|窃听器?|录音笔)|藏(?:好|起)(?:了)?(?:一份)?|托(?:人|朋友)|委托(?:了)?(?:律师|私家侦探|人)?|让(?:人|律师|助理|手下)(?:去)?(?:查|调|跟|取|录|拍|拿|办)|派人(?:调查|跟踪|调取|去查)|已经(?:拿到|取得|调出|查到|录好|录下|拍下|备份|保存|获取|掌握|采到)|录好(?:了|全程)?|录下(?:了)?(?:全程|证据|这段)|拍下(?:了)?(?:全过程)|保存(?:好|了)?(?:证据|录音|照片|记录|录像)|采(?:好|到)?(?:了)?血样|拿到(?:了)?(?:鉴定|体检|DNA|尸检)(?:报告|结果)?|做(?:好|了)?(?:两手)?准备)/;
const PLANT_EN = /\b(?:in advance|ahead of time|beforehand|had (?:it|the|everything) (?:recorded|prepared|ready|obtained|acquired|hidden|kept|covered)|secretly (?:recorded|filmed|taped|planted|kept)|hidden (?:camera|mic|recorder|wire)|planted (?:a|the) (?:camera|mic|recorder|bug)|kept a copy|made a copy|backup copy|saved (?:the|a) (?:footage|recording|copy|file)|asked my lawyer|hired a (?:private )?(?:investigator|detective|PI)|had someone (?:look into|follow|investigate|retrieve|obtain|get)|already (?:had|obtained|acquired|got|gotten|retrieved|secured|pulled|submitted)|recorded (?:it|the whole thing)|filmed (?:the whole thing|it all)|got (?:hold of )?the (?:paternity|DNA|medical|autopsy|forensic) (?:report|results)|blood sample|set (?:it|this) up ahead)\b/i;

// —— 空口宣称持有证据 ——
const CLAIM_ZH = /(?:我有(?:你|他|她)?[^，。；？！\n]{0,8}?(?:证据|把柄|黑料|内幕|录音|录像|照片)|我手里(?:有|握着)(?:你)?(?:的)?(?:证据|把柄|黑料|内幕|录音|录像|照片|合同|报告|记录)|证据(?:就在)?我(?:手|这)(?:里|儿)|我(?:已经)?掌握(?:了)?(?:你)?(?:的)?(?:证据|把柄|黑料|内幕|犯罪事实)|(?:你)?(?:的)?把柄(?:就)?在我(?:手|这)(?:里|儿)?|铁证在我这|我手上有铁证)/;
const CLAIM_EN = /\b(?:i have (?:the |hard |irrefutable |all the )?(?:evidence|proof|dirt)|i'?ve got (?:the |all the |hard |irrefutable )?(?:evidence|proof|footage|recording|dirt)|i hold (?:all )?the (?:cards|evidence|proof)|the evidence is (?:right )?here in my hands|i have everything (?:i need|on you)|i own (?:you|him|her) now|just wait until you see the evidence)\b/i;

// —— 人证到场（强到场结构，避免误伤普通进门）——
const WITNESS_ZH = /(?:就在(?:这|此)时|话音刚落|正(?:在|要)这(?:时|会))[^。；\n]{0,26}?(?:(?:大|房|办公室|会议)?门被?(?:推|撞)开|推(?:开)?(?:大|房)?门|撞开(?:大|房)?门|走(?:进|来|到)|出现(?:在)?(?:门口|众人面前)|站(?:在|到)(?:门口|众人面前))|(?:人证|证人)(?:到场|出庭|来了|出现|亲自(?:到场|来|作证))|(?:她|他)(?:竟然|居然|原来)?(?:没有死|还活着)[^。；\n]{0,16}?(?:出现|走(?:进|来)|站(?:在|到)|到场)|(?:亲自|当面)作证/;
const WITNESS_EN = /\b(?:just then|at that(?: very)? moment|as (?:she|he) spoke)[^.\n]{0,40}?(?:doors? (?:burst|flew|slid|swung)? ?open|walked (?:in|into)|appeared (?:at|in)|stood in (?:the )?doorway|took the stand)|the doors? (?:burst|flew|swung) open[^.\n]{0,30}?(?:walked in|appeared|stood)|(?:the )?witness (?:arrived|appeared|walked in|took the stand|stepped forward)|(?:walked in|appeared|arrived|stood (?:up)?|stepped forward)[^.\n]{0,28}?to testify|(?:she|he) was (?:still )?alive[^.\n]{0,30}?(?:walked in|appeared|stood|arrived)\b/i;
// —— 人证已安排（豁免：必须严格早于到场行）——
const WITNESS_ARRANGE_ZH = /(?:我)?(?:已经)?(?:安排|请|找|通知|接)(?:了|过)?(?:人证|证人|目击者|人|她|他)(?:来|到场|出庭|作证|去接)?|去(?:接|请)(?:了)?(?:人证|证人|目击者|她|他)|让(?:人|助理|律师)(?:去)?(?:接|请|找|通知)(?:了)?(?:她|他|证人|目击者)|(?:她|他|证人)(?:已经|早就)?(?:愿意|答应|同意)?(?:来|出庭|到场|作证)|约(?:了)?(?:她|他)(?:来|到场)|请(?:她|他)(?:来|到场)作证|人证(?:我)?(?:已经|早就)?(?:安排|请|接)(?:好|了|到)?/;
const WITNESS_ARRANGE_EN = /\b(?:already )?(?:arranged|asked|called|invited|brought|prepared for|sent for) (?:the |a )?(?:witness|her|him) to (?:come|testify)|(?:she|he|the witness) had (?:already )?(?:agreed|consented) to testify|i(?: have|'ve) (?:a )?witness (?:ready|waiting|lined up|prepared)|witness is (?:already )?(?:here|waiting|outside)|arranged for (?:her|him) to (?:come|appear)|brought (?:her|him) (?:here|in) to testify\b/i;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

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

const adviceZh = {
  unplanted: '翻盘时刻突然掏出来的铁证，观众此前一无所知，等于作者临时发牌。把证据的获取提前演出来：上一场偷偷录下、托人查到、装好针孔、备份留底——先让观众看见枪，结尾枪响才过瘾。',
  overkill: '一集之内当众甩出三四种铁证，像是编剧怕观众不信而疯狂加码。一场翻盘只打一张最狠的牌，其余证据拆散到后续集数，或让对方先抵赖再被第二证据补刀。',
  verbal: '角色反复宣称"我有证据/我手里有你的录音"，本集却一次都没有真出示，威胁沦为空话。要么本集就放出来完成打脸，要么删掉虚张声势，用具体行动表现把握。',
  witness: '关键人证在最后一刻推门而入、甚至死者复生，前文却毫无安排，这是换了人形的机械降神。至少提前一场交代：已经派人去接、证人答应出庭、有人在保护她。',
};
const adviceEn = {
  unplanted: 'Decisive evidence appears at the reversal with no earlier trace — the writer is dealing cards at the last minute. Stage the acquisition earlier: a secret recording, an investigator, a hidden camera, a saved copy. Show the gun first; the shot lands later.',
  overkill: 'Three or four different ironclad exhibits rain down in one episode, as if stacking proof would buy belief. Play one strongest card at the climax; spread the rest across later episodes or use a second exhibit only after denial.',
  verbal: 'Characters claim "I have the evidence / I\'ve got the recording" at least twice but never produce anything, so the threats are hot air. Either play the evidence this episode for the face-slap, or cut the boasting and show confidence through action.',
  witness: 'A decisive witness walks in at the last second — even a presumed-dead relative — with zero arrangement: a deus ex machina in human form. Set it up a scene earlier: someone sent to bring her, she agreed to testify, she was under protection.',
};

interface ShowHit { line: number; scene: number; kind: string; text: string }

/**
 * 翻盘证据链公平性检测
 * @param text 剧本全文
 * @param lang zh | en
 */
export function evidenceChainCheck(text: string, lang: EcLang = 'zh'): EvidenceChainResult {
  const isZh = lang !== 'en';
  const empty: EvidenceChainResult = {
    score: 100, sceneCount: 0, signalCount: 0, issueCount: 0,
    showCount: 0, plantCount: 0, claimCount: 0, witnessCount: 0,
    distinctEvidenceKinds: 0, fairShowCount: 0, scenes: [], issues: [],
  };
  if (!text || text.trim().length < 20) return empty;

  const scenes = splitScenes(text, isZh);
  if (!scenes.length) return empty;

  const SHOWS: { kind: string; re: RegExp }[] = isZh
    ? [
      { kind: 'recording', re: SHOW_RECORDING_ZH },
      { kind: 'footage', re: SHOW_FOOTAGE_ZH },
      { kind: 'report', re: SHOW_REPORT_ZH },
      { kind: 'contract', re: SHOW_CONTRACT_ZH },
      { kind: 'records', re: SHOW_RECORDS_ZH },
      { kind: 'photo', re: SHOW_PHOTO_ZH },
    ]
    : [
      { kind: 'recording', re: SHOW_RECORDING_EN },
      { kind: 'footage', re: SHOW_FOOTAGE_EN },
      { kind: 'report', re: SHOW_REPORT_EN },
      { kind: 'contract', re: SHOW_CONTRACT_EN },
      { kind: 'records', re: SHOW_RECORDS_EN },
      { kind: 'photo', re: SHOW_PHOTO_EN },
    ];
  const PLANT = isZh ? PLANT_ZH : PLANT_EN;
  const CLAIM = isZh ? CLAIM_ZH : CLAIM_EN;
  const WITNESS = isZh ? WITNESS_ZH : WITNESS_EN;
  const WITNESS_ARRANGE = isZh ? WITNESS_ARRANGE_ZH : WITNESS_ARRANGE_EN;
  const A = isZh ? adviceZh : adviceEn;

  const issues: EvidenceChainIssue[] = [];
  const sceneFlags = new Map<number, number>();
  const flag = (scene: number) => sceneFlags.set(scene, (sceneFlags.get(scene) ?? 0) + 1);

  // —— 全局行扫描：铺垫必须严格早于出示（跨场或同场早些时候均可）——
  const plantLines: number[] = [];
  const arrangeLines: number[] = [];
  const claimHits: { line: number; scene: number }[] = [];
  const showHits: ShowHit[] = [];
  const witnessHits: { line: number; scene: number; text: string }[] = [];
  let globalLine = 0;
  let signalCount = 0;

  scenes.forEach((sc, si) => {
    for (const raw of sc.lines) {
      const line = globalLine++;
      if (PLANT.test(raw)) { plantLines.push(line); signalCount++; }
      if (WITNESS_ARRANGE.test(raw)) { arrangeLines.push(line); signalCount++; }
      if (CLAIM.test(raw)) { claimHits.push({ line, scene: si + 1 }); signalCount++; }
      for (const s of SHOWS) {
        if (s.re.test(raw)) { showHits.push({ line, scene: si + 1, kind: s.kind, text: raw }); signalCount++; }
      }
      if (WITNESS.test(raw)) { witnessHits.push({ line, scene: si + 1, text: raw }); signalCount++; }
    }
  });

  const pushed = { unplanted: 0, overkill: false, verbal: false, witness: 0 };

  // —— ① 物证无铺垫 / 正信号先埋后打 ——
  let unplantedCount = 0;
  let fairShowCount = 0;
  for (const h of showHits) {
    const plantedBefore = plantLines.some((p) => p < h.line);
    if (!plantedBefore) {
      unplantedCount++;
      if (pushed.unplanted < 2) {
        pushed.unplanted++;
        issues.push({
          severity: unplantedCount >= 2 ? 'high' : 'mid',
          type: 'unplanted_evidence', key: 'unplanted', scene: h.scene,
          evidence: isZh ? `第${h.scene}场：${h.text.slice(0, 34)}` : `Scene ${h.scene}: ${h.text.slice(0, 60)}`,
          advice: A.unplanted,
        });
        flag(h.scene);
      }
    } else {
      fairShowCount++;
    }
  }

  // —— ② 证据雨：≥3 种不同铁证只报 1 条 ——
  const kinds = [...new Set(showHits.map((h) => h.kind))];
  if (kinds.length >= 3) {
    pushed.overkill = true;
    const seen = new Set<string>();
    let thirdHit: ShowHit | undefined;
    for (const h of showHits) {
      seen.add(h.kind);
      if (seen.size >= 3) { thirdHit = h; break; }
    }
    const at = thirdHit ?? showHits[showHits.length - 1];
    issues.push({
      severity: kinds.length >= 4 ? 'mid' : 'low',
      type: 'evidence_overkill', key: 'overkill', scene: at.scene,
      evidence: isZh
        ? `第${at.scene}场：本集当场出示 ${kinds.length} 种铁证（${kinds.join('、')}）`
        : `Scene ${at.scene}: ${kinds.length} kinds of decisive evidence produced in one episode (${kinds.join(', ')})`,
      advice: A.overkill,
    });
    flag(at.scene);
  }

  // —— ③ 空口证据：≥2 次宣称且零出示 ——
  if (claimHits.length >= 2 && showHits.length === 0) {
    pushed.verbal = true;
    const h = claimHits[0];
    issues.push({
      severity: 'low',
      type: 'verbal_evidence_only', key: 'verbal', scene: h.scene,
      evidence: isZh
        ? `第${h.scene}场：${claimHits.length} 次宣称持有证据，本集 0 次真出示`
        : `Scene ${h.scene}: evidence claimed ${claimHits.length} times, produced 0 times`,
      advice: A.verbal,
    });
    flag(h.scene);
  }

  // —— ④ 人证空降：到场行之前必须有安排行 ——
  let witnessAirCount = 0;
  for (const h of witnessHits) {
    if (arrangeLines.some((a) => a < h.line)) continue;
    witnessAirCount++;
    if (pushed.witness < 2) {
      pushed.witness++;
      issues.push({
        severity: witnessAirCount >= 2 ? 'high' : 'mid',
        type: 'airdropped_witness', key: 'witness', scene: h.scene,
        evidence: isZh ? `第${h.scene}场：${h.text.slice(0, 34)}` : `Scene ${h.scene}: ${h.text.slice(0, 60)}`,
        advice: A.witness,
      });
      flag(h.scene);
    }
  }

  // —— 汇总打分 ——
  let penalty = 0;
  penalty += Math.min(unplantedCount * 12, 24);
  if (pushed.overkill) penalty += kinds.length >= 4 ? 10 : 6;
  if (pushed.verbal) penalty += 7;
  penalty += Math.min(witnessAirCount * 11, 20);
  const bonus = Math.min(fairShowCount * 2, 6);

  issues.sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 } as const;
    return order[a.severity] - order[b.severity] || a.scene - b.scene;
  });

  const sceneReports: EvidenceChainSceneReport[] = scenes.map((s, i) => ({
    index: i + 1,
    header: s.header,
    flagCount: sceneFlags.get(i + 1) ?? 0,
  }));

  return {
    score: clamp(Math.round(100 - penalty + bonus), 0, 100),
    sceneCount: scenes.length,
    signalCount,
    issueCount: issues.length,
    showCount: showHits.length,
    plantCount: plantLines.length,
    claimCount: claimHits.length,
    witnessCount: witnessHits.length,
    distinctEvidenceKinds: kinds.length,
    fairShowCount,
    scenes: sceneReports,
    issues,
  };
}
