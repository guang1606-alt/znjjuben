/**
 * 后手空降检测器（v2.80 块72，创作能力类）
 * ------------------------------------------------------------------
 * 病象：被逼到墙角的角色突然掏出一件决定胜负的"后手"——
 *  "幸好我留了一手，录音在这里"
 *  "我早就报警了，警察十分钟前就该到了"
 *  "我的律师已经在楼下，这份股权转让书你签过字"
 * 紧张感当场清零：主角不是靠选择和行动赢的，是靠作者临时塞的道具赢的。
 * 这是反向契诃夫之枪——枪只在开火那一刻才第一次出现。
 *
 * 与现有引擎的分工（查重后确认的空白点）：
 *  - causal-logic#deus_ex_machina：抓外部救兵赶到（天降一队人/神秘人），不抓角色自备后手；
 *  - causal-logic#unsourced_knowledge：抓"我早就知道"式信息空降，不抓实物后手；
 *  - foreshadow/prop-ledger：跨集记账道具归属，不做"本集首次出现即制胜"的单稿判定；
 *  - twist-density：身份/证据反转是正当揭晓（"这是亲子鉴定，你看清楚"），本引擎只抓
 *    带【幸好/我早就/我已经报警/留了一手】等"事先准备"框架词的安全网式后手；
 *  - unplanted-asset（本引擎）：后手框架词 + 具体制胜道具 + 全稿此前零提及，三者齐备才判。
 *
 * 豁免（planted）：该道具/资源在揭晓行之前的任何位置出现过
 * （哪怕只是"她悄悄按下手机录音键"），视为枪已挂上墙，不扣分。
 */

export interface UnplantedAssetHit {
  line: number;
  /** 命中的后手框架词 */
  marker: string;
  /** 制胜道具/资源 */
  asset: string;
  snippet: string;
  /** 此前提及位置（planted 时给出） */
  plantedLine: number | null;
  planted: boolean;
  boosters: string[];
  reason: string;
}

export interface UnplantedAssetResult {
  score: number;
  hits: UnplantedAssetHit[];
  issues: string[];
  advice: string[];
}

function isZhText(draft: string): boolean {
  return /[一-鿿]/.test(draft);
}

/* ───────── 后手框架词（必须带"事先准备/侥幸解围"语气） ───────── */

const FRAME_ZH = /(?:幸好|幸亏|好在|还好|我早就|我早有|我早已|我早在|留了一手|留过后手|留个后手|防的就是|早防着|我有准备|早有准备|来之前我(?:就|已)|我已经(?:报警|录|备份|通知|联系|安排|让人|叫|请)|我提前|我事先|我备了|我让人(?:查|跟|盯|录|报)|警察(?:已经|马上|这就|十分钟|五分钟)[^\n。！？!?]{0,4}(?:到|来)|保镖(?:已经|马上|就在|都在)|律师(?:已经|马上|就在)[^\n。！？!?]{0,6}(?:到|来|楼|门口))/;
const FRAME_EN = /\b(?:luckily|fortunately|good thing|thank god i|i came prepared|just in case|i had already|i'?ve already|i already (?:called|recorded|told|contacted|arranged|sent|had|made|asked)|i (?:had|have) it (?:all )?recorded|i recorded (?:it|everything|the whole thing)|i'?ve recorded|i called (?:the police|my lawyer|security)|before i came(?: here)?(?: i|,)|i made sure to|i kept a copy|i saved (?:it|everything)|i had (?:a camera|them followed|him followed|her followed|a backup|backup)|the police are (?:on their way|already here|on the way)|security is (?:on (?:their|the) way|already here)|my lawyer is (?:on the (?:way|his way)|already here|downstairs|waiting))\b/i;

/* ───────── 制胜道具/资源词表（命中框架词的同一窗口内必须有其一） ───────── */

const ASSETS_ZH: { re: RegExp; label: string }[] = [
  { re: /录音笔|录音|录了音|录下(?:了|来)|音频/, label: '录音' },
  { re: /录像|监控|摄像头|摄影机|视频|拍下(?:了|来)/, label: '录像/监控' },
  { re: /备份|拷贝|副本/, label: '备份' },
  { re: /警察|警方|报警/, label: '警察' },
  { re: /保镖|保安|打手/, label: '保镖' },
  { re: /律师(?:函|事务所)?|法律顾问/, label: '律师' },
  { re: /股权转让(?:书|协议)?|转让合同/, label: '股权转让书' },
  { re: /亲子鉴定/, label: '亲子鉴定' },
  { re: /合同|协议(?:书)?|保单|遗嘱/, label: '合同/协议' },
  { re: /指纹|DNA|血迹|证据/, label: '物证' },
];
const ASSETS_EN: { re: RegExp; label: string }[] = [
  { re: /\b(?:recording|audio(?: tape)?|voice recorder|recorded (?:it|everything|the whole thing)|tape(?:d)?|taps? record|hits? record)\b/i, label: 'recording' },
  { re: /\b(?:camera(?:s)?|security footage|surveillance|(?:video )?footage|video(?: tape)?|filmed (?:it|everything))\b/i, label: 'footage' },
  { re: /\b(?:copy|copies|backup|back-up)\b/i, label: 'backup copy' },
  { re: /\b(?:police|cops|called the cops)\b/i, label: 'police' },
  { re: /\b(?:bodyguard|bodyguards|security(?: guards| team)?)\b/i, label: 'security' },
  { re: /\b(?:lawyer|attorney|legal team|counsel)\b/i, label: 'lawyer' },
  { re: /\b(?:signed (?:the )?contract|contract you signed|share transfer|transfer agreement)\b/i, label: 'signed contract' },
  { re: /\b(?:paternity (?:report|test)|dna (?:report|test))\b/i, label: 'paternity report' },
  { re: /\b(?:fingerprints?|dna evidence|blood(?:stain)?|the evidence|proof)\b/i, label: 'physical evidence' },
];

/* ───────── 后手立刻制胜的泄气信号（booster） ───────── */

const DEFLATE_ZH = /(?:煞白|惨白|面如死灰|瘫(?:坐|倒|在)|后退(?:一步|两步|几步)|连退|踉跄|撒腿就跑|转身就跑|落荒|咬牙(?:切齿)?|你赢|我认栽|算你狠|没想到你|浑身发抖|脸都绿|冷汗|嘴唇哆嗦)/;
const DEFLATE_EN = /\b(?:(?:his|her|their) face (?:goes|drops|turns) (?:white|pale)|steps? back|stumbles? back|freezes?|frozen|turns? pale|backs? away|runs? (?:away|off)|you win|i concede|touche|cold sweat|jaw (?:clenches|drops)|trembling)\b/i;

interface ParsedLine { line: number; text: string }

/* ───────── 主函数 ───────── */

export function unplantedAsset(draft: string): UnplantedAssetResult {
  const zh = isZhText(draft);
  const frameRe = zh ? FRAME_ZH : FRAME_EN;
  const assets = zh ? ASSETS_ZH : ASSETS_EN;
  const deflateRe = zh ? DEFLATE_ZH : DEFLATE_EN;

  const lines: ParsedLine[] = draft
    .split('\n')
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter((l) => l.text.length > 0);

  // 每个道具词在全稿的最早出现行（揭晓行引用此前是否有铺垫）
  function firstMentionBefore(label_re: RegExp, beforeLine: number): number | null {
    for (const l of lines) {
      if (l.line >= beforeLine) break;
      if (label_re.test(l.text)) return l.line;
    }
    return null;
  }

  const hits: UnplantedAssetHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const frameM = l.text.match(frameRe);
    if (!frameM) continue;
    // 窗口：本行 + 后 1 行（后手台词常与道具同句或紧接甩在桌上）
    const windowText = [l.text, lines[i + 1]?.text ?? ''].join('\n');
    const found = assets.find((a) => a.re.test(windowText));
    if (!found) continue;

    const plantedLine = firstMentionBefore(found.re, l.line);
    const planted = plantedLine !== null;

    // 后 3 行内是否立刻泄气制胜
    const tail = lines.slice(i + 1, i + 4).map((x) => x.text).join('\n');
    const boosters: string[] = [];
    if (!planted && deflateRe.test(tail)) boosters.push('instant_win');

    const reason = zh
      ? `${l.line}行掏出后手「${found.label}」（框架词：${frameM[0]}），${planted ? `但第${plantedLine}行已提前铺垫` : '全稿此前从未出现过这件道具/资源，紧张感被作者的临时保险清零'}${boosters.includes('instant_win') ? '，且对手三行内当场泄气认输' : ''}`
      : `L${l.line} pulls out the decisive backup "${found.label}" (frame: "${frameM[0]}"), ${planted ? `but it was planted at L${plantedLine}` : 'which has never appeared anywhere earlier in the draft — the tension is erased by an author-issued insurance policy'}${boosters.includes('instant_win') ? ', and the opponent collapses within three lines' : ''}`;

    hits.push({
      line: l.line,
      marker: frameM[0],
      asset: found.label,
      snippet: l.text.slice(0, 60),
      plantedLine,
      planted,
      boosters,
      reason,
    });
  }

  const unplanted = hits.filter((h) => !h.planted);
  let score = 100;
  for (const h of unplanted) {
    score -= 35;
    if (h.boosters.includes('instant_win')) score -= 8;
  }
  if (score < 20) score = 20;

  const issues = unplanted.map((h) => (zh
    ? `后手空降：${h.reason}`
    : `Unplanted contingency asset: ${h.reason}`));

  const advice = zh
    ? [
        '决定胜负的后手必须提前挂枪：掏录音/报警/叫律师之前，先给一个铺垫镜头——悄悄按下录音键、躲出去打电话、把文件塞进包里',
        '铺垫不能只是台词提一句，最好让对手有机会发现/破坏它，后手在揭晓前先经历一次风险，观众才认',
        '如果来不及提前埋线，就别让后手"一键清场"：让录音只录到一半、警察来得没那么快、律师函有漏洞，逼主角再做一个选择',
        '主角脱困要靠他当场做的艰难决定，而不是靠"幸好我早有准备"；准备可以有，准备的内容必须让观众先看见',
      ]
    : [
        'Any decisive backup must be planted first: before the recording, the police call or the lawyer lands, show the setup beat — a thumb pressed on record, a phone call stepped away for, a folder slipped into the bag',
        'Do not let the planting pass unseen and untouched; give the opponent a chance to spot or break it so the asset survives real risk before it pays off',
        'If there is no room to plant it, do not let it wipe the board: the recording captured only half, the police are slow, the letter has a flaw — force one more hard choice',
        'The escape has to come from a choice made in the scene, not from "luckily I came prepared"; the preparation can exist, but the audience must see its contents first',
      ];

  return { score, hits, issues, advice };
}
