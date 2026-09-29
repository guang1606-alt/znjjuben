import { isSceneHeaderLine } from './script-scenes';
/**
 * 闲玩道具标签检测（v2.80 块80，创作能力类）
 * ------------------------------------------------------------------
 * 病象：写不出人物的当下选择，就往指尖塞一个固定道具当性格标签——
 *   谈判桌上他永远转着钢笔；她紧张就摩挲婚戒；老爷子盘着核桃不说话。
 *   The CEO twirled his pen. / She spun the wedding band on her finger.
 * 第一次是人物细节（好的外化），病在：
 *  1) 全片万能复用——同一件道具第 3 次出场，观众知道编剧又找不到
 *     动作了，道具从"人的延伸"退化成贴纸；
 *  2) 道具零参与情节——不签字、不拍桌、不送出、不摔碎、不点燃，
 *     转完整场戏，局势跟它毫无关系，纯装饰；
 *  3) 闲玩冒充城府——大佬转笔、狠人转打火机、怨妇转戒指，
 *     人物的"深不可测"全靠道具转圈圈，手一停就没戏。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - emotion-prop-crutch：管情绪宣泄型道具（摔杯/买醉/淋雨/撕信物/
 *    捏碎杯子），本引擎管安静闲玩型道具（转/摩挲/盘/捻/把玩）；
 *  - hollow-action：管无道具的空身调度（站坐叹气踱步），本引擎管
 *    手里那件被反复转的小东西；
 *  - prop-ledger：管道具跨集连续性（埋了必须用），不管同动作复用。
 *
 * 判定（只扫叙述行；台词行/场景头跳过）：
 *  - FIDGET 词表按道具家族归一（pen 笔 / lighter 打火机 / ring 戒指 /
 *    beads 手串核桃佛珠 / coin 硬币 / watch 腕表 / cup 酒杯）；
 *  - rescue（±3 行同场道具参与情节）：签字/拍在桌上/递出/扔还/摔/
 *    夺/点燃文件/摘下戒指/signed/slid across/hurled/flung/flicked…
 *    ——道具干事了，闲玩升级成动作；
 *  - 同家族未兑现使用第 1、2 次不罚（正当外化），第 3 次起每处 −12，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export type FidgetFamily = 'pen' | 'lighter' | 'ring' | 'beads' | 'coin' | 'watch' | 'cup';

export interface FidgetPropHit {
  line: number;
  family: FidgetFamily;
  familyLabel: string;
  snippet: string;
  /** 该家族这是第几次出现（1 基） */
  occurrence: number;
  /** ±3 行内道具是否参与情节（签字/递出/摔/点燃…） */
  rescued: boolean;
  reason: string;
}

export interface FidgetPropResult {
  score: number;
  /** 扫描到的闲玩动作总数 */
  fidgetCount: number;
  /** 各家族未兑现出现次数（≥3 即依赖） */
  familyCounts: Record<string, number>;
  overusedFamilies: string[];
  hits: FidgetPropHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

/* 闲玩动作词 × 道具家族（只收"转/摩挲/盘/捻/把玩"这类零做功动作） */
const FIDGET_ZH: { re: RegExp; family: FidgetFamily; label: string }[] = [
  { re: /(?:指尖|手指|指节)?(?:转|旋|捻|把玩|摆弄)[着了过起]?(?:一[转圈下])?(?:那|这)?(?:支)?(?:钢笔|签字笔|金笔|碳素笔|水笔|笔)(?![记迹])/g, family: 'pen', label: '转笔' },
  { re: /(?:钢笔|签字笔|金笔)(?:在[^，。；]{0,10}?)?(?:不?停地)?(?:转了?(?:一?圈又一?圈)?|旋)[着了过]?/g, family: 'pen', label: '转笔' },
  { re: /(?:指尖|手指|指节)?(?:转|旋|把玩|摆弄|叩|敲|按)[着了过]?(?:一[下转])?(?:枚|个|只)?(?:打火机|zippo|ZIPPO)(?![声机])/g, family: 'lighter', label: '转打火机' },
  { re: /打火机(?:啪(?:嗒|的)?(?:一声)?)?(?:开?了?又?合|开合|翻着)[着了过]?/g, family: 'lighter', label: '打火机开合' },
  { re: /(?:摩挲|抚摸|捻|转|转动|旋转|拨弄|搓)[着了过]?(?:一[圈转下])?(?:手上的?)?(?:婚戒|戒指|指环|戒圈)/g, family: 'ring', label: '摩挲戒指' },
  { re: /(?:戒指|婚戒|指环)(?:在(?:他|她)?(?:指尖|手指|指节))?(?:不?停地)?(?:转|旋)[着了过]?/g, family: 'ring', label: '转戒指' },
  { re: /(?:盘|捻|转|摩挲|揉|搓|转着玩)[着了过]?(?:一[串下])?(?:核桃|佛珠|手串|念珠|木珠)/g, family: 'beads', label: '盘核桃佛珠' },
  { re: /(?:指尖|手指|指节)?(?:弹|转|抛|把玩|立)[着了过]?(?:一[枚下])?(?:枚|个)?(?:硬币|钢镚)/g, family: 'coin', label: '转硬币' },
  { re: /(?:摩挲|抚摸|捻|擦|转|把玩|叩)[着了过]?(?:一[下])?(?:腕上的?)?(?:腕表|手表|表壳|表盘)/g, family: 'watch', label: '摩挲腕表' },
  { re: /(?:指尖|手指)(?:沿|划过|摩挲|在|贴着)[着了过]?(?:杯|碗)(?:沿|壁|口|边)/g, family: 'cup', label: '摩挲杯沿' },
];

const FIDGET_EN: { re: RegExp; family: FidgetFamily; label: string }[] = [
  { re: /\b(?:twirl(?:ed|ing)?|spin(?:ning)?|spun|roll(?:ed|ing)?|turn(?:ed|ing)?|fidget(?:ed|ing)?|toy(?:ed|ing)?)\s+(?:a |the |his |her )?(?:fountain )?pen\b|\b(?:a |the |his |her )?(?:fountain )?pen\s+(?:rolled|spinning|twirling|turning|between (?:his|her) fingers|in (?:his|her) fingers)\b/gi, family: 'pen', label: 'twirling pen' },
  { re: /\b(?:flick(?:ed|ing)?|flip(?:ped|ping)?|snap(?:ped|ping)?|open(?:ed|ing)? and (?:shut|closed)|click(?:ed|ing)?)\s+(?:a |the |his |her )?lighter\b|\b(?:a |the |his |her )?lighter\s+(?:flipped|clicked|snapped)\b/gi, family: 'lighter', label: 'flipping lighter' },
  { re: /\b(?:twirl(?:ed|ing)?|spin(?:ning)?|spun|turn(?:ed|ing)?|roll(?:ed|ing)?|worried|fidget(?:ed|ing)?|twist(?:ed|ing)?)\s+(?:the |a |his |her )?(?:wedding )?(?:band|ring)\b|\b(?:the |his |her )?(?:wedding )?(?:band|ring)\s+(?:on (?:his|her) finger|around (?:his|her) finger)\b/gi, family: 'ring', label: 'spinning ring' },
  { re: /\b(?:work(?:ed|ing)?|roll(?:ed|ing)?|finger(?:ed|ing)?|thumb(?:ed|ing)?)\s+(?:the |his |her )?(?:prayer beads|worry beads|mala beads|beads)\b/gi, family: 'beads', label: 'working beads' },
  { re: /\b(?:flip(?:ped|ping)?|toss(?:ed|ing)?|spin(?:ning)?|spun|roll(?:ed|ing)?|fidget(?:ed|ing)?)\s+(?:a |the |his |her )?coin\b/gi, family: 'coin', label: 'flipping coin' },
  { re: /\b(?:adjust(?:ed|ing)?|touch(?:ed|ing)?|brush(?:ed|ing)?|smooth(?:ed|ing)?|rub(?:bed|bing)?)\s+(?:his |her |the )?(?:wrist)?watch\b/gi, family: 'watch', label: 'touching watch' },
  { re: /\b(?:trace[ds]?|tracing|ran (?:a |his |her )?finger (?:around|along) (?:the |his |her )?(?:rim|edge))\s*(?:of (?:the |his |her )?(?:glass|cup))?\b/gi, family: 'cup', label: 'tracing glass rim' },
];

/* 道具做功：闲玩之后同窗口让道具参与情节，即兑现 */
const PAYOFF_ZH_PARTS = [
  '签(?:下|上)?(?:名字?|姓名)|签了?字(?!笔)',
  '落(?:下|了)?签名',
  '钢笔(?:尖|锋)',
  '(?:拍|甩|砸|墩|摁|压)(?:在|到)(?:桌|台面|文件|合同|协议)',
  '(?:递|塞|推|送|还)(?:了|过|给|回|出|到)',
  '(?:扔|摔|砸|折|撕|夺|抢|掰)(?:掉|了|过)?',
  '捏断|折断',
  '(?:按|拨)(?:燃|着|火)',
  '点燃|打火(?:焰|苗)|点(?:起|了)?(?:烟|雪茄)',
  '(?:点|燃)(?:起|了)?(?:文件|合同|纸|照片)',
  '火苗|火焰',
  '(?:戒指|婚戒|指环)(?:摘|褪|撸)(?:下|掉)?',
  '(?:摘|褪|撸)(?:下|掉)?(?:戒指|婚戒|指环)',
  '(?:戴|套)(?:上|回)',
  '(?:硬币|杯子?|笔|打火机|核桃|佛珠)(?:掉|落|碎|裂|滚到|飞出)',
  '(?:钢笔|签字笔|笔)(?:写|划|戳)',
];
const PAYOFF_ZH = new RegExp(PAYOFF_ZH_PARTS.join('|'));
const PAYOFF_EN = /\b(?:sign(?:ed|ing)? (?:his|her|the)?\s?(?:name|the papers|the contract|the document)|set (?:the )?pen to paper|(?:slid|slammed|banged|pressed|dropped) (?:the |a |his |her )?(?:pen|lighter|ring|coin|glass) (?:on|onto|across|down)|(?:hand(?:ed)?|passed|tossed|threw|flung|hurled|snatched|grabbed|seized|broke|snapped|crushed) (?:the |a |his |her )?(?:pen|lighter|ring|coin|beads|wedding band)|(?:slid|slammed|banged|pressed|put|set|laid|dropped) it (?:down|on|onto|across|back|aside)|flick(?:ed|ing)? (?:the |a )?lighter(?: (?:open|alive|on))?\s*(?:and )?(?:lit|ignited|set fire|fired|burned)|flick(?:ed|ing)? it (?:open|alive)?\s*(?:and )?(?:lit|ignited)|lit (?:a |the )?(?:cigarette|cigar|paper|document|file|photo|contract)|(?:slipped|pulled|tore|wrenched|yanked) (?:the |his |her )?(?:wedding )?(?:band|ring) off|put (?:the |his |her )?ring back on|(?:pen|lighter|ring|coin|glass) (?:fell|dropped|slipped|shattered|broke|rolled (?:off|away|across|onto|under|to the|out of)))\b/i;

const FAMILY_LABEL_ZH: Record<FidgetFamily, string> = {
  pen: '转笔', lighter: '转打火机', ring: '摩挲戒指', beads: '盘核桃/佛珠', coin: '转硬币', watch: '摩挲腕表', cup: '摩挲杯沿',
};
const FAMILY_LABEL_EN: Record<FidgetFamily, string> = {
  pen: 'twirling pen', lighter: 'flipping lighter', ring: 'spinning ring', beads: 'worry beads', coin: 'flipping coin', watch: 'adjusting watch', cup: 'tracing rim',
};

interface SceneLine { lineNo: number; text: string; isDialogue: boolean; sceneIndex: number }

/**
 * 纯函数：检测指尖闲玩道具的全片复用。
 */
export function fidgetProp(draft: string): FidgetPropResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, fidgetCount: 0, familyCounts: {}, overusedFamilies: [], hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const fidgets = zh ? FIDGET_ZH : FIDGET_EN;
  const payoffRe = zh ? PAYOFF_ZH : PAYOFF_EN;
  const labels = zh ? FAMILY_LABEL_ZH : FAMILY_LABEL_EN;

  /* 建索引行（带场景号），供 ±3 行同场兑现窗口使用 */
  const rawLines = text.split(/\r?\n/);
  const rows: SceneLine[] = [];
  let sceneIndex = 0;
  rawLines.forEach((raw, idx) => {
    const t = raw.trim();
    if (isSceneHeaderLine(t)) {
      sceneIndex += 1;
      return;
    }
    rows.push({ lineNo: idx + 1, text: t, isDialogue: DIALOGUE_RE.test(t), sceneIndex });
  });

  const occ: Record<string, number> = {};
  const familyCountUnrescued: Record<string, number> = {};
  const hits: FidgetPropHit[] = [];
  let fidgetCount = 0;

  rows.forEach((row, i) => {
    if (row.isDialogue || !row.text) return;
    /* 同一句多家族各记一次（去重家族，避免一行内正则多次匹配） */
    const seenFamily = new Set<FidgetFamily>();
    for (const { re, family } of fidgets) {
      re.lastIndex = 0;
      if (!re.test(row.text) || seenFamily.has(family)) continue;
      seenFamily.add(family);
      fidgetCount += 1;
      occ[family] = (occ[family] ?? 0) + 1;
      const occurrence = occ[family];

      /* ±3 行同场窗口找道具做功 */
      let rescued = false;
      for (let j = Math.max(0, i - 3); j <= Math.min(rows.length - 1, i + 3); j += 1) {
        if (rows[j].sceneIndex !== row.sceneIndex) continue;
        if (payoffRe.test(rows[j].text)) {
          rescued = true;
          break;
        }
      }
      if (!rescued) familyCountUnrescued[family] = (familyCountUnrescued[family] ?? 0) + 1;

      hits.push({
        line: row.lineNo,
        family,
        familyLabel: labels[family],
        snippet: zh ? row.text.slice(0, 30) : row.text.slice(0, 60),
        occurrence,
        rescued,
        reason: rescued
          ? (zh ? '道具参与情节（签字/拍桌/点燃/扔还），闲玩兑现成动作' : 'the prop does plot work (sign/slam/ignite/hurl), the fidget pays off')
          : (zh
              ? `「${labels[family]}」第 ${occurrence} 次出场仍只转不做功，道具成了性格贴纸`
              : `"${labels[family]}" appearance #${occurrence} still does nothing — the prop is a character sticker`),
      });
    }
  });

  const overusedFamilies = Object.entries(familyCountUnrescued)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => labels[f as FidgetFamily]);
  const excess = Object.values(familyCountUnrescued).reduce((sum, n) => sum + Math.max(0, n - 2), 0);
  const score = excess === 0 ? 100 : Math.max(20, 100 - excess * 12);

  const issues: string[] = [];
  const advice: string[] = [];
  if (excess > 0) {
    issues.push(zh
      ? `闲玩道具依赖：${overusedFamilies.join('、')} 未兑现出现均 ≥3 次——人物的城府/紧张全靠指尖转圈圈，道具从不参与情节。`
      : `Fidget-prop crutch: ${overusedFamilies.join(', ')} each idles ≥3 times with zero payoff — depth is faked by spinning props that never touch the plot.`);
    advice.push(zh
      ? '道具要么干事要么删：转着的钢笔下一拍就拍在合同上、被对方夺走、在签名处停住；摩挲的戒指要么摘下扔还，要么被一把攥住。同一人物全片只允许一两件闲玩物，第二次出现就要让它做功。把"城府"写进选择和台词节奏，别写进手指。'
      : 'A prop either works or gets cut: the spinning pen slams onto the contract next beat, gets snatched, or stops above the signature line; the worried ring comes off and gets thrown back, or is seized in a fist. Allow one or two idle props per character total, and make the second appearance do plot work. Put the depth into choices and speech rhythm, not into the fingers.');
  }

  return { score, fidgetCount, familyCounts: familyCountUnrescued, overusedFamilies, hits, issues, advice };
}
