import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 情绪宣泄套路检测（Emotion-Vent Cliche）
 * ============================================================
 * 治什么病：
 *   所有情感顶点都推到最大档生理宣泄，演员在嚎，人物没在选——
 *   眼泪夺眶而出、失声痛哭、泪流满面；歇斯底里、嘶吼咆哮；
 *   扑通跪下、磕头哀求；扇自己耳光、扯头发撞墙。
 *   第一次哭是人心，第三次嚎是音轨；观众对"最大音量"迅速
 *   免疫，真正的绝境反而没人信。
 *
 * 判定（只扫叙述行；台词行/场景头跳过），四族：
 *   cry 痛哭 / shout 嘶吼 / kneel 跪求 / selfharm 自虐。
 *   A. repeat：同族全片第 1、2 次不罚（正当爆发），第 3 次起
 *      charged 计入扣分；
 *   B. chain：同一行连用 ≥2 个不同族，单次即 charged。
 *   rescued（宣泄后人物自己做出选择，不扣分）：本句或后 2 个
 *   非空行、换场前出现主动决定（擦掉泪拿起电话/签字/报警/
 *   甩出证据/起身离开/再不求他）；别人心软递纸巾、靠哭闹
 *   换来的让步不算 rescue——那是更糟的写法。
 *
 * 边界（查重后确认）：
 *   - reaction-cliche 管微反应零件（愣/皱眉/咬唇/眼眶红），
 *     本引擎管爆发档（痛哭/嘶吼/下跪/自虐）；
 *   - emotion-prop-crutch 管人借道具发泄（摔杯/灌酒/淋雨），
 *     本引擎管无道具的身体宣泄；
 *   - show-dont-tell 管情绪标签（她很伤心），本引擎管情绪
 *     音量键被拧死在最大档；
 *   - 客观生理（打了个哈欠/疼得龇牙）不判。
 *
 * 计分：bad=0 → 100；1 → 75；≥2 → max(25, 100-n*25)。
 * ============================================================
 */

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^[一-鿿A-Za-z0-9·]{1,4}(?:（[^）]{0,12}）)?\s*[：:]\s*\S/;
const QUOTE_RE = /^[「“"']/;

const FAM_ZH: { family: VentFamily; re: RegExp }[] = [
  { family: 'cry', re: /(?:眼泪(?:夺眶而出|忍不住|不争气)|泪水(?:夺眶而出|模糊|涌出)|泪如雨下|泪流满面|热泪盈眶|失声痛哭|嚎啕大哭|号啕大哭|痛哭流涕|泣不成声|哭成(?:了)?泪人|哭红(?:了)?(?:双)?眼|哭(?:得|到)撕心裂肺|哽咽(?:不(?:已|止)|地说)?|抽泣(?:着|不(?:已|止))?|捂着脸哭|抱头痛哭|眼泪一[滴滴串])(?:[^\n。！？]{0,4})?/g },
  { family: 'shout', re: /(?:歇斯底里|声嘶力竭|撕心裂肺(?:地)?(?:喊|吼|叫)|嘶吼(?:着|道)?|咆哮(?:着|道)?|大吼(?:大叫)?|尖叫(?:着|出声|道)?|发狂似的(?:喊|吼|叫)|近乎疯狂(?:地)?(?:喊|吼|叫)|(?:喊|吼|叫)得(?:嗓子|喉咙)(?:都)?(?:哑|沙哑)|疯了(?:一样|似的)(?:喊|吼))/g },
  { family: 'kneel', re: /(?:扑通(?:一声)?跪下|双膝(?:一软|跪地)|跪倒在地|跪(?:在|到)(?:地|他|她)[^\n。！？]{0,4}?(?:哀求|求|哭)|跪下来(?:哀求|求|磕头)|磕(?:头|响头)(?:哀求|求饶|谢恩)?|砰砰(?:磕头|磕了)|苦苦跪(?:求|在))/g },
  { family: 'selfharm', re: /(?:(?:狠狠)?(?:扇|抽|打)了?自己(?:一|两|几)?(?:记|个)?耳光|自扇(?:耳光|嘴巴)?|扯(?:着|住)?自己的头发|抓花(?:了)?自己的脸|(?:拿|用)头(?:去)?撞墙|一拳砸在(?:墙上|镜子)|咬(?:破|碎)(?:了)?(?:自己的)?嘴唇[^\n。！？]{0,4}?(?:渗|流)?(?:血)?)/g },
];

const FAM_EN: { family: VentFamily; re: RegExp }[] = [
  { family: 'cry', re: /\b(?:tears\s+(?:streamed|rolled|gushed|welled|cascaded)\s+down|tears\s+spilled\s+over|burst\s+into\s+tears|broke\s+down\s+(?:sobbing|crying|in tears)|sobbed\s+uncontrollably|wept\s+bitterly|cried\s+(?:her|his)\s+eyes\s+out|tears\s+flowed\s+freely|face\s+streaked\s+with\s+tears|sobbing\s+hysterically)\b/gi },
  { family: 'shout', re: /\b(?:screamed?\s+at\s+the\s+top\s+of\s+(?:her|his)\s+lungs|shouted\s+hysterically|hysterical\s+(?:scream|shout)|bellowed\s+(?:at|in\s+rage)|roared\s+with\s+(?:rage|fury)|shrieked|wailed|howled\s+in\s+(?:anger|fury|rage)|voice\s+raw\s+from\s+shouting)\b/gi },
  { family: 'kneel', re: /\b(?:dropped\s+to\s+(?:her|his)\s+knees|fell\s+on\s+(?:her|his)\s+knees|collapsed\s+to\s+(?:her|his)\s+knees|knelt\s+(?:down\s+)?begging|knelt\s+and\s+(?:begged|pleaded)|kowtowed|bowed\s+her\s+head\s+to\s+the\s+floor\s+begging)\b/gi },
  { family: 'selfharm', re: /\b(?:slapped\s+herself\s+(?:across|on)\s+the\s+face|punched\s+the\s+wall|smashed\s+her\s+fist\s+into\s+the\s+mirror|pulled\s+(?:at\s+)?her\s+(?:own\s+)?hair|raked\s+her\s+nails\s+down\s+her\s+(?:own\s+)?face|bit\s+(?:her|his)\s+lip\s+until\s+it\s+bled)\b/gi },
];

// 宣泄后人物自己做出选择（rescue）；他人心软不算
const RESCUE_ZH = /(?:擦(?:干|掉)(?:了)?(?:眼)?泪|抹了把脸)[^\n。！？]{0,10}?(?:拿起|拨通|签字|起身|站起|转身|走|离开|报警|证据|录音|U盘)|(?:拿起|抓起|拨通|签(?:下|字)|报警|甩出|拍在|夺门|转身(?:就)?(?:走|离开)|头也不回|再没回头|再也不求)[^\n。！？]{0,10}?(?:电话|手机|合同|协议|证据|录音|U盘|名字|门外)?|当场[^\n。！？]{0,8}?(?:签字|宣布|报警|决定)/;
const RESCUE_EN = /\b(?:wiped\s+(?:her|his)\s+tears|dried\s+(?:her|his)\s+eyes)\s+and\s+(?:picked\s+up|called|signed|walked|stood|left|dialed)|\b(?:picked\s+up\s+the\s+phone|called\s+the\s+cops|signed\s+(?:the|his|her)\s+papers|slammed\s+down\s+the\s+evidence|turned\s+and\s+walked\s+out|walked\s+away\s+without\s+looking\s+back|never\s+begged\s+again)\b/i;

type VentFamily = 'cry' | 'shout' | 'kneel' | 'selfharm';

export interface EmotionVentHit {
  line: number;
  kind: 'repeat' | 'chain';
  families: VentFamily[];
  phrase: string;
  snippet: string;
  charged: boolean;
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface EmotionVentResult {
  score: number;
  narrationLines: number;
  familyCounts: Record<VentFamily, number>;
  hits: EmotionVentHit[];
  issues: string[];
  advice: string;
}

const snippet = (s: string, n = 30): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 检测情绪宣泄套路。
 */
export function emotionVentCliche(draft: string): EmotionVentResult {
  const emptyCounts: Record<VentFamily, number> = { cry: 0, shout: 0, kneel: 0, selfharm: 0 };
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, familyCounts: emptyCounts, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const lines = draft.split(/\r?\n/);
  const fams = isZh ? FAM_ZH : FAM_EN;
  const hits: EmotionVentHit[] = [];
  const seen: Record<VentFamily, number> = { cry: 0, shout: 0, kneel: 0, selfharm: 0 };
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line) || SPEAKER_RE.test(line) || QUOTE_RE.test(line)) return;
    narrationLines++;

    const found: { family: VentFamily; phrase: string }[] = [];
    for (const { family, re } of fams) {
      re.lastIndex = 0;
      const m = line.match(re);
      if (m) found.push({ family, phrase: m[0] });
    }
    if (found.length === 0) return;

    let rescued = (isZh ? RESCUE_ZH : RESCUE_EN).test(line);
    let rescueLine: number | undefined;
    if (rescued) rescueLine = i + 1;
    if (!rescued) {
      for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        if ((isZh ? RESCUE_ZH : RESCUE_EN).test(near)) {
          rescued = true;
          rescueLine = k + 1;
          break;
        }
      }
    }

    if (found.length >= 2) {
      for (const f of found) seen[f.family]++;
      hits.push({
        line: i + 1,
        kind: 'chain',
        families: found.map((f) => f.family),
        phrase: found.map((f) => f.phrase).join(' / '),
        snippet: snippet(line),
        charged: true,
        rescued,
        rescueLine,
        reason: isZh
          ? '一行连用多档最大音量宣泄，嚎得越响人物越没有选择'
          : 'Peak-volume vents stacked in one line — the louder the cry, the less the character chooses',
      });
    } else {
      const f = found[0];
      seen[f.family]++;
      const charged = seen[f.family] >= 3;
      hits.push({
        line: i + 1,
        kind: 'repeat',
        families: [f.family],
        phrase: f.phrase,
        snippet: snippet(line),
        charged,
        rescued,
        rescueLine,
        reason: isZh
          ? '同一档宣泄反复使用，第三次起观众对最大音量免疫'
          : 'The same peak-volume vent repeats — by the third, the audience is deaf to it',
      });
    }
  });

  const bad = hits.filter((h) => h.charged && !h.rescued);
  const n = bad.length;
  const score = n === 0 ? 100 : n === 1 ? 75 : Math.max(25, 100 - n * 25);
  const labelZh: Record<VentFamily, string> = {
    cry: '痛哭', shout: '嘶吼', kneel: '跪求', selfharm: '自虐',
  };
  const labelEn: Record<VentFamily, string> = {
    cry: 'sobbing', shout: 'screaming', kneel: 'kneeling to beg', selfharm: 'self-harm',
  };
  const issues = bad.map((h) => (isZh
    ? `第${h.line}行：${h.kind === 'chain' ? '多档宣泄连用' : labelZh[h.families[0]]}「${h.snippet}」——${h.reason}；把音量降下来，给一个只能二选一的具体行动`
    : `L${h.line}: ${h.kind === 'chain' ? 'stacked peak vents' : labelEn[h.families[0]]} "${h.snippet}" — ${h.reason}; turn the volume down and force a concrete either-or action`));
  const advice = isZh
    ? '情绪的最高档每集只准用一次，且必须换来一个不可逆的动作：哭完擦掉泪拿起电话，而不是等他心软。跪求、嘶吼、自扇同理——观众对"最大音量"三次就免疫。真正狠的戏往往是安静的：她没有哭，只是把戒指放在桌上，轻轻带上门。'
    : 'Allow one peak-volume vent per episode, and it must buy an irreversible action — she wipes her eyes and makes the call, she does not wait for him to soften. Kneeling, screaming and self-slapping obey the same law: an audience goes deaf to maximum volume by the third time. The cruelest scenes are usually quiet: no tears, just the ring set on the table and the door closed gently.';

  return { score, narrationLines, familyCounts: seen, hits, issues, advice };
}
