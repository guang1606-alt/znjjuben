import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 自怜连祷检测（Self-Pity Litany / 卖惨独白）
 * ============================================================
 * 治什么病：
 *   观众同情弱者，但追随有脊梁的人。AI 写低谷戏最爱让角色
 *   跪在原地开一场个人苦难报告会：
 *     林晚（哭）：我这辈子怎么这么苦……从小没爹没妈，长大
 *     被丈夫打，老天爷你为什么这么不公平？我到底做错了什么？
 *   四重套路一次上齐：苦命陈述、问天控诉、自我定罪、苦难罗列。
 *   惨事是别人讲出来的事实时有力，自己跪着数给观众听就廉价——
 *   角色在乞求观众的同情，而不是带着伤口做下一个动作。
 *
 * 判定（只扫台词/心声行；同一话者的连续发言合并为发言段）：
 *   四族信号，同族计多次：
 *    1) doom    苦命陈述：我这辈子/从小到大…没好过；命苦/贱命
 *    2) heaven  问天控诉：老天爷为什么/上天不公/why me
 *    3) blame   自我定罪乞怜：我做错了什么/是不是我活该/可怜可怜我
 *    4) list    苦难罗列：一个发言段内 ≥2 个苦难事实短语
 *    charged：≥2 族共现，或任一族 ≥2 次；且段长达标
 *   （单族单次的短口语"我这是造的什么孽"放行——人可以叹一口气）
 *
 * rescued（卖惨被角色自己掐断，变成脊梁）：
 *   - 段内或紧邻下一拍出现行动转向：擦干泪/站起来/眼神变硬
 *     + 具体决定（查/告/签/辞职/拿回/离开/明天就去）；
 *   - 惨转攻击：冷笑/突然笑了/走着瞧/血债血偿；
 *   - 注意："求求你别走/不要离开我"仍是乞怜，不算 rescue；
 *     别人心软来哄也不算——转折必须是人物自己给的。
 *
 * 边界（查重后确认）：
 *   - show-dont-tell 管"他心想/她很伤心"标记词单点，不管发言内容；
 *   - emotion-vent-cliche 管痛哭嘶吼跪求自扇的动作音量（管动作），
 *     本引擎管跪着说什么（管语言），互补；
 *   - rhetorical-barrage 管向外攻击的反问倾泻（凭什么/你配/how dare），
 *     本引擎管向内的问天与自我定罪；
 *   - 叙述行客观苦难（"她三岁丧母"）是事实不是自怜，不扫。
 *
 * 计分：bad=0 → 100；1 → 80；≥2 → max(30, 100-n*22)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

// 严格话者：≤4字，心声/画外音括号也认
const SPEAKER_RE = /^([一-鿿A-Za-z0-9·]{1,4})(?:（[^）]{0,12}）)?\s*[：:]\s*(.+)$/;
const SPEAKER_EN_RE = /^([A-Z][A-Z .'’-]{0,18}?)(?:\s*\([^)]{0,20}\))?\s*:\s*(.+)$/;

const snippet = (s: string, n = 36): string => (s.length > n ? `${s.slice(0, n)}…` : s);
const stripLen = (s: string): number => s.replace(/[，。！？、…：；""''（）()【】《》\s,.!?:;'"()\[\]<>\n-]/g, '').length;

/* ───────── 四族信号 ───────── */

const DOOM_ZH = /(?:我(?:这|那|一)?辈子|我这一生|我这前半生|从小到大|长这么大|这些年|打小|自幼)[^。！？\n]{0,14}(?:苦|惨|难|没(?:过)?(?:一天)?好日子|没享过福|没被人疼|受够|熬|不容易|没过过)|命(?:真|太|怎么|就)?(?:苦|不好|贱|硬)|天生(?:就)?(?:贱|苦|倒霉)|生来(?:就)?(?:低|苦|欠)|我怎么这么(?:苦|惨|倒霉|可怜)/g;

const HEAVEN_ZH = /(?:老天爷|老天|上天|苍天|上帝|佛祖|菩萨|天)[^。！？\n]{0,10}?(?:为什么|为何|怎么|凭什么|不公|不公平|瞎了?眼|不开眼|没长眼|要这样|如此对我)|为什么(?:受|遭|轮到|是)我|凭什么(?:受|遭|轮到|是)我/g;

const BLAME_ZH = /(?:我到底?|我是)?(?:做错了什么|错在哪(?:里|儿)|哪里不好|哪儿不好|哪里对不起|配不上|活该|我不配|我不该活着|我是不是多余|没有人(?:爱|要|疼)我|没人(?:爱|要|疼)我|可怜可怜我|求求你们?[^。！？\n]{0,6}(?:原谅|收留|别赶|让我留)|都怪我(?:不好|没用|是个灾星)|我真是个(?:废物|灾星|累赘|拖油瓶))/g;

// 苦难事实短语：段内 ≥2 个才算罗列
const SUFFER_ZH = [
  /没爹没妈|没了爹娘|爹娘死得早|从小(?:就)?(?:被扔|被丢|成了孤儿|是孤儿|没人管|没吃过饱饭)/,
  /被(?:赶|撵)出(?:门|家)|扫地出门|无家可归|睡(?:过)?(?:桥洞|马路|街头|公园)/,
  /三天[^。！？\n]{0,3}(?:没吃|没合眼|饿着)|饿了?\d+天|吃了上顿没下顿|捡(?:过)?破烂|捡垃圾(?:吃|长大)/,
  /被人(?:骗|打|欺负|唾|踩|辱)|受尽(?:欺负|白眼|凌辱|屈辱|折磨)|人人都可以踩|谁都能欺负|往(?:我|她)身上(?:泼|吐|泼脏水)/,
  /卖了?(?:身|血|肾)|当(?:过)?(?:佣人|保姆|苦力|歌女)|给人(?:下跪|磕头|当牛做马)/,
  /丈夫(?:打|家暴|出轨|赌)|前夫|被(?:婆家|夫家)(?:磋磨|折磨|嫌)|孩子(?:没了|保不住|被抢走)/,
  /欠了?(?:一屁股)?(?:债|高利贷)|讨债的堵门|被债(?:主|务)逼/,
  /住(?:过)?(?:地下室|城中村|工棚)|穿不暖|冬天[^。！？\n]{0,4}(?:单衣|没鞋|光脚)/,
];

const DOOM_EN = /\b(?:my whole life|all my life|my entire life|ever since i was (?:a child|little|born)|i'?ve never had it easy|never gotten a break|born (?:unlucky|to lose|poor)|i was born (?:cursed|to suffer)|why is my life so (?:hard|miserable))\b/gi;

const HEAVEN_EN = /\b(?:why me|why is this happening to me|why does (?:this )?always happen to me|god why|dear god why|life is so unfair|the world is against me|what did i do to deserve this)\b/gi;

const BLAME_EN = /\b(?:what did i do wrong|what'?s wrong with me|maybe i deserve this|i don'?t deserve|i'?m not good enough|nobody (?:loves?|wants?) me|no one (?:loves?|wants?) me|please (?:just )?love me|i'?m such a (?:failure|burden|disappointment)|i shouldn'?t even be alive|i bring bad luck)\b/gi;

const SUFFER_EN = [
  /\b(?:grew up (?:without|an orphan)|orphan(?:ed)?|never knew (?:my|his|her) (?:father|mother|parents))\b/i,
  /\b(?:thrown out|kicked out|evicted|homeless|slept (?:on|in) the (?:street|streets|car|shelter))\b/i,
  /\b(?:hadn'?t eaten for days|went hungry|ate from (?:the )?trash|starv(?:ed|ing))\b/i,
  /\b(?:everyone (?:used|bullied|walked all over|stepped on) me|(?:bullied|beaten|beat (?:me|her|him)|spit at|humiliated))\b/i,
  /\b(?:sold (?:my|her) body|sold blood|worked (?:as|like) a slave|begged for money)\b/i,
  /\b(?:my husband (?:beat|cheated)|abusive husband|lost the baby|they took my baby)\b/i,
  /\b(?:owed money|loan ?sharks|debt collectors)\b/i,
];

/* ───────── rescue：惨被自己掐断成脊梁 ───────── */

const TURN_ZH = /(?:擦干?眼泪|抹掉泪|擦了?擦脸|站(?:起身|起来)|猛地站|抬起头|抬起脸|眼神(?:突然)?(?:变|一凛|变硬|冷下来)|目光一沉|攥紧(?:拳|手)|咬(?:紧牙|了咬牙)|冷笑(?:一声)?|突然(?:笑|笑了)|笑了(?:出来|一声)|从今天起|从今往后|从现在起|这一次|我不会再|我受够了|那我就|走着瞧|血债血偿|一个都跑不了|让他们(?:付出|等着)|明天(?:一早就)?(?:去|就去)?(?:查|告|找|离|签|辞职|报警|起诉|拿回|要回)|我要(?:亲手|亲自|自己)?(?:查|告|拿回|夺|让他们|离婚|辞职|离开|报警|起诉|翻案|讨回)|等着瞧|记住今天)/;

const TURN_EN = /\b(?:wiped (?:her|his) (?:tears|eyes)|stood (?:up|tall)|lifted (?:her|his) chin|eyes (?:turned|hardened|went cold)|jaw tightened|fist(?:s)? clenched|a cold smile|suddenly (?:smiled|laughed)|laughed coldly|from today|not anymore|that'?s it|then i'?ll|i'?m going to make them|i will take (?:it )?back|tomorrow i(?:['']?ll| will)? (?:file|sue|quit|leave|find|report)|i(?:['']?ll| will)? (?:sue|report|divorce|quit|leave|find out|take back)|they'?ll pay|just (?:you )?wait)\b/i;

export interface SelfPityHit {
  startLine: number;
  endLine: number;
  speaker: string;
  families: string[];
  snippet: string;
  rescued: boolean;
  rescueLine: number | null;
  reason: string;
}

export interface SelfPityResult {
  score: number;
  dialogueLines: number;
  hits: SelfPityHit[];
  issues: string[];
  advice: string;
}

interface Seg {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

function collect(text: string, res: RegExp[]): string[] {
  const out: string[] = [];
  res.forEach((re) => {
    const m = text.match(re);
    if (m) out.push(m[0].slice(0, 12));
  });
  return out;
}

export function selfPityLitany(draft: string): SelfPityResult {
  if (!draft || !draft.trim()) {
    return { score: 100, dialogueLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const speakerRe = isZh ? SPEAKER_RE : SPEAKER_EN_RE;
  const doomRe = isZh ? DOOM_ZH : DOOM_EN;
  const heavenRe = isZh ? HEAVEN_ZH : HEAVEN_EN;
  const blameRe = isZh ? BLAME_ZH : BLAME_EN;
  const sufferRes = isZh ? SUFFER_ZH : SUFFER_EN;
  const turnRe = isZh ? TURN_ZH : TURN_EN;

  const lines = draft.split(/\r?\n/);

  // —— 合并同一话者连续发言（场景头/他人发言/叙述行断段） ——
  const segs: Seg[] = [];
  let dialogueLines = 0;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isSceneHeaderLine(line)) return;
    const m = line.match(speakerRe);
    if (!m) return;
    dialogueLines++;
    const speaker = m[1].trim();
    const text = m[2].trim();
    const last = segs[segs.length - 1];
    if (last && last.speaker === speaker && last.end === i) {
      last.text += `\n${text}`;
      last.end = i + 1;
    } else {
      segs.push({ speaker, start: i + 1, end: i + 1, text });
    }
  });

  const hits: SelfPityHit[] = [];
  segs.forEach((seg) => {
    const doom = seg.text.match(doomRe) || [];
    const heaven = seg.text.match(heavenRe) || [];
    const blame = seg.text.match(blameRe) || [];
    const suffer = collect(seg.text, sufferRes);

    const fam: string[] = [];
    if (doom.length) fam.push('doom');
    if (heaven.length) fam.push('heaven');
    if (blame.length) fam.push('blame');
    if (suffer.length >= 2) fam.push('list');
    const repeatFamily = doom.length >= 2 || heaven.length >= 2 || blame.length >= 2;
    const longEnough = isZh ? stripLen(seg.text) >= 14 : seg.text.split(/\s+/).filter(Boolean).length >= 10;
    const charged = longEnough && (fam.length >= 2 || repeatFamily);
    if (!charged) return;

    // rescue：段内自带转向，或紧邻下一拍（遇场景头/他人发言即止）
    let rescued = turnRe.test(seg.text);
    let rescueLine: number | null = rescued ? seg.start : null;
    if (!rescued) {
      for (let k = seg.end; k < Math.min(lines.length, seg.end + 3); k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        if (speakerRe.test(near)) break; // 别人发言：靠人哄不算自己转身
        if (turnRe.test(near)) { rescued = true; rescueLine = k + 1; break; }
        break;
      }
    }

    hits.push({
      startLine: seg.start,
      endLine: seg.end,
      speaker: seg.speaker,
      families: fam,
      snippet: snippet(seg.text.replace(/\n/g, ' ')),
      rescued,
      rescueLine,
      reason: isZh
        ? '角色跪着开苦难报告会：苦命陈述/问天控诉/自我定罪/苦难罗列，用嘴向观众乞讨同情，没有带伤行动'
        : 'the character holds a kneeling suffering-report — doom statements, accusations at heaven, self-blame, a list of miseries — begging the audience for pity instead of moving while wounded',
    });
  });

  const bad = hits.filter((h) => !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 80 : Math.max(30, 100 - n * 22);
  const issues = bad.map((h) => (isZh
    ? `第${h.startLine}${h.endLine > h.startLine ? `-${h.endLine}` : ''}行 ${h.speaker}【自怜连祷】「${h.snippet}」——${h.reason}；删掉苦难排比，留一个最硬的事实，把"为什么是我"换成一个带代价的动作：擦干泪做决定、冷笑转身、明天就去查；观众给行动者买单，不给诉苦者眼泪`
    : `L${h.startLine}${h.endLine > h.startLine ? `-${h.endLine}` : ''} ${h.speaker} [self-pity litany] "${h.snippet}" — ${h.reason}; cut the miseries down to one hardest fact and replace "why me" with a costly action — wipe tears and decide, turn away with a cold smile, go find out tomorrow; audiences pay off people who move, not people who report their pain`));
  const advice = isZh
    ? '卖惨是最便宜的眼泪。惨要让别人演、让对手说、让物件露出，唯独不能让当事人自己跪着数。低谷戏的写法：一句话交代伤口（别排比），立刻让人物做一件有尊严的小事——洗把脸、把破衣服叠好、对着镜子练习微笑，然后做出一个会让她付出代价的决定。最大的虐点是"惨而不倒"，不是"惨给你看"。'
    : 'Self-pity is the cheapest tear. Let the wound be shown by others, by the antagonist, by objects — never itemized by the wounded on their knees. The low-point beat: one line for the wound (no list), then a small act of dignity — washing the face, folding the torn clothes, practicing a smile in the mirror — followed by a decision that will cost her. The deepest cruelty beat is "broken but standing", not "watch me suffer".';

  return { score, dialogueLines, hits, issues, advice };
}
