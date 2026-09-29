import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 集尾预告口播检测（Preview Voiceover）
 * ------------------------------------------------
 * 创作能力类引擎：剧本正文是"正在发生的戏"，不是节目导视。
 * AI 写竖屏短剧最常见的收尾偷懒有三种：
 *   A. 直接插入预告段落——「下集预告：」「未完待续」「To be continued」
 *      「且听下回分解」，把连续剧排播单塞进剧本；
 *   B. 主播口播穿帮——「关注我，下集更精彩」「记得点赞追更」
 *      「subscribe and hit the bell」，成片人物不可能说这种话；
 *   C. 旁白/叙述在集尾用将来时连端具体剧情节拍——「第二天，他将带着
 *      合同上门，她会在所有人面前被揭穿」，把下一集的戏提前播报。
 *
 * 与既有引擎边界（查重结论）：
 *  - omniscient-tease：抓"她不知道的是+更大的风暴"式抽象全知悬念，
 *    空词无动作；本引擎抓具体的"将/会+可拍动作"排播单，且 marker/
 *    pitch 两类它完全不管；
 *  - cliffhanger-score：给集尾钩子打分（越具体在场越高分），不判违规；
 *    本引擎只罚脱离场景的导视体，在场的现在时钩子不受影响；
 *  - witness-gratuity：知情者当面倒情报，是人物对白内的问题；
 *    本引擎 future_dump 只罚叙述/旁白，角色当场做的计划豁免。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export type PreviewHitKind = 'marker' | 'pitch' | 'future_dump';

export interface PreviewVoiceoverHit {
  line: number;            // 1 基行号
  kind: PreviewHitKind;
  narrator: boolean;       // 是否由旁白/解说类说话人发出
  beats: number;           // future_dump 命中的将来时节拍数
  snippet: string;
  reason: string;
}

export interface PreviewVoiceoverResult {
  score: number;
  tailLines: number;       // 尾部扫描区行数（非空行计）
  hits: PreviewVoiceoverHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const SPEAKER_RE = /^([一-鿿A-Za-z0-9·]{1,4})(?:（([^）]{0,16})）)?\s*[：:]\s*(.+)$/;
const SPEAKER_EN_RE = /^([A-Z][A-Z .'’-]{0,18}?)(?:\s*\(([^)]{0,40})\))?\s*:\s*(.+)$/;

const NARRATOR_ZH_RE = /^(?:旁白|解说|解说员|讲述人|字幕|画外音)$/;
const NARRATOR_EN_RE = /^(?:NARRATOR|NARRATION|VOICE\s?OVER|V\.?\s?O\.?|SUBTITLES?|CAPTION)$/;

/* ───────── A. 预告段落标记（出现即判，位置不限） ───────── */

const MARKER_ZH = /(?:下集预告|精彩预告|预告抢先看|预告片花|本集预告|未完待续|待续[。.\s…]*$|下集见分晓|且听下回分解|预知后事如何|欲知后事如何|明天同一时间|敬请期待(?:下集)?|下一集(?:预告|见分晓)|第[一二三四五六七八九十百\d]+集(?:预告|见分晓))/;
const MARKER_EN = /\b(?:next episode(?:'s? preview)?|coming up(?: next| on [A-Z][a-z]+)?|to be continued|continued next (?:week|time|episode)|stay tuned(?: for more)?|don'?t miss (?:the )?next(?: episode)?|previously on|episode \d+ preview|season (?:finale )?preview|next time on)\b/i;

/* ───────── B. 主播求关注口播（出现即判，位置不限） ───────── */

const PITCH_ZH = /(?:关注(?:我|我们|账号|公众号|主页)|点个?关注|点关注|点个?赞|点赞关注|双击(?:屏幕)?|加关注|订阅(?:我|我们|频道)?|追(?:剧|更)(?:不迷路)?|别走开|不要走开|记得(?:准时)?(?:来看|收看|关注|追)|收藏转发|长按点赞|评论区(?:告诉我|留言)|一键三连|每日更新|持续更新中)/;
const PITCH_EN = /\b(?:subscribe(?: to (?:our|my) channel)?|follow (?:me|us|our channel) for|like and subscribe|smash that like|hit the (?:bell|like button)|ring the bell|turn on notifications|leave a (?:like|comment)(?: below)?(?: and)?|don'?t forget to (?:like|subscribe|follow)|drop a comment(?: below)?|new episodes (?:every|daily))\b/i;

/* ───────── C. 集尾旁白将来时排播单 ───────── */

// 将来时时间锚（开头或句中）
const FUT_TIME_ZH = /(?:明天|明晚|明早|明晨|次日|第二天|隔天|后天|几[天日]后|一周后|当晚稍后|稍后|婚礼(?:当天|那日)|葬礼(?:上)?)[，,]?/;
const FUT_TIME_EN = /\b(?:tomorrow(?: morning| night| evening)?|the next day|the following day|the day after|days later|a week later|that same night|at the (?:wedding|funeral|hearing))\b/i;

// 可拍的具体动作（必须有实体事件，"改变命运"式空词不算）
const FUT_VERB_ZH = /(?:签(?:字|下|合同|离婚协议)|跪(?:下|在)|拿出|掏出|宣布|公布|揭穿|戳穿|摊牌|结婚|离婚|开庭|登机|飞走|搬走|扫地出门|送进(?:监狱|大牢|派出所)|报警|抓(?:住|走|捕)?|逮(?:捕|住)|上门|带来|带走|召开(?:记者会|董事会)|发(?:布|表)|流产|被(?:赶|轰)出?|当众(?:下跪|认错|揭穿|羞辱)|退婚|抢婚|坠楼|车祸)/;
const FUT_VERB_EN = /\b(?:sign(?:s|ed)?(?: the)?(?: contract| papers| divorce)?|kneel(?:s|ed)? down|pull(?:s|ed)? out|announce(?:s|d)?|reveal(?:s|ed)?|expose(?:s|d)?|confront(?:s|ed)?|marry|divorce|court(?: date| hearing)?|board(?:s|ed)?(?: the)?(?: plane|flight)?|move(?:s|d)? out|kick(?:s|ed)? (?:him|her) out|sent to (?:jail|prison)|call(?:s|ed)? the police|arrest(?:s|ed)?|show(?:s|ed)? up|bring(?:s|ed)?|hand(?:s|ed)? over|press conference|lose the baby|kicked out|publicly (?:humiliate|expose)|call off the wedding)\b/i;

// 将来助词 + 12 字（英 30 字符）内出现具体动作
const FUT_AUX_ZH = /(?:将要|即将|就要|将会|会|将)[^。！？!?，,；;\n]{0,12}?(?:签|跪|拿|掏|宣布|公布|揭穿|戳穿|摊牌|结婚|离婚|开庭|登机|搬|扫地出门|送进|报警|抓|逮|上门|带|召开|发(?:布|表)|流产|被(?:赶|轰)|当众|退婚|抢婚|坠楼|车祸)/;
const FUT_AUX_EN = /\b(?:will|shall|is going to|are going to|would)[^.,;\n]{0,30}?(?:sign|kneel|pull out|announce|reveal|expose|confront|marry|divorce|court|board|move out|kick|sent to (?:jail|prison)|call the police|arrest|show up|bring|hand over|press conference|lose the baby|publicly|call off the wedding)\b/i;

const TAIL_ZONE = 12; // 集尾扫描区：最后 12 个非空行

const snippetOf = (s: string, n = 42): string => {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

interface ParsedLine {
  no: number;
  kind: 'header' | 'dialogue' | 'narration';
  speaker: string;
  text: string;
  raw: string;
}

function parse(rawLines: string[], isZh: boolean): ParsedLine[] {
  const out: ParsedLine[] = [];
  rawLines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t) return;
    if (isSceneHeaderLine(t)) {
      out.push({ no: i + 1, kind: 'header', speaker: '', text: t, raw: t });
      return;
    }
    const m = t.match(isZh ? SPEAKER_RE : SPEAKER_EN_RE);
    if (m) {
      const cue = m[2] ? `${isZh ? `（${m[2]}）` : `(${m[2]})`} ` : '';
      if (isZh || /[a-z]/.test(m[3])) {
        out.push({ no: i + 1, kind: 'dialogue', speaker: m[1].trim(), text: `${cue}${m[3].trim()}`, raw: t });
        return;
      }
    }
    out.push({ no: i + 1, kind: 'narration', speaker: '', text: t, raw: t });
  });
  return out;
}

// 按句段统计将来时具体动作节拍：每段一个，避免时间锚窗口贪吞多拍
function countClauses(text: string, isZh: boolean): number {
  const segs = text.split(isZh ? /[。！？!?，,；;\n]+/ : /[.,;!\n]+/).map((s) => s.trim()).filter(Boolean);
  let timeCarry = false;
  let n = 0;
  for (const seg of segs) {
    const timeHere = isZh
      ? FUT_TIME_ZH.test(seg.slice(0, 10))
      : FUT_TIME_EN.test(seg.slice(0, 24));
    const auxHit = isZh ? FUT_AUX_ZH.test(seg) : FUT_AUX_EN.test(seg);
    const verbHit = isZh ? FUT_VERB_ZH.test(seg) : FUT_VERB_EN.test(seg);
    if (auxHit) n += 1;
    else if ((timeHere || timeCarry) && verbHit) n += 1;
    // 裸时间锚（如"第二天，"）把时间语境带给下一段
    timeCarry = timeHere && !verbHit && !auxHit;
  }
  return n;
}

export function previewVoiceover(draft: string): PreviewVoiceoverResult {
  const lang = isZhText(draft) ? 'zh' : 'en';
  const isZh = lang === 'zh';
  const rawLines = draft.split('\n');
  const lines = parse(rawLines, isZh);
  const tailStartIdx = Math.max(0, lines.length - TAIL_ZONE);

  const hits: PreviewVoiceoverHit[] = [];

  const push = (h: PreviewVoiceoverHit) => {
    if (!hits.some((x) => x.line === h.line && x.kind === h.kind)) hits.push(h);
  };

  lines.forEach((ln, idx) => {
    const inTail = idx >= tailStartIdx;

    // A. 预告标记：任何位置都判（场景头除外）；说话人位也可能写"下集预告："，用整行原文匹配
    if (ln.kind !== 'header' && (isZh ? MARKER_ZH : MARKER_EN).test(ln.raw)) {
      push({
        line: ln.no,
        kind: 'marker',
        narrator: ln.kind === 'narration' || (ln.kind === 'dialogue' && (isZh ? NARRATOR_ZH_RE : NARRATOR_EN_RE).test(ln.speaker)),
        beats: 0,
        snippet: snippetOf(ln.text),
        reason: isZh
          ? '剧本正文里出现了节目导视标记（下集预告/未完待续/敬请期待类），剧本只写正在发生的戏'
          : 'A TV-guide marker (next-episode preview / to be continued / stay tuned) appears inside the script body; the script is only the scene happening now',
      });
    }

    // B. 主播口播：任何位置都判（用整行原文，含说话人位）
    if (ln.kind !== 'header' && (isZh ? PITCH_ZH : PITCH_EN).test(ln.raw)) {
      push({
        line: ln.no,
        kind: 'pitch',
        narrator: ln.kind === 'narration' || (ln.kind === 'dialogue' && (isZh ? NARRATOR_ZH_RE : NARRATOR_EN_RE).test(ln.speaker)),
        beats: 0,
        snippet: snippetOf(ln.text),
        reason: isZh
          ? '出现平台主播口播（关注/点赞/订阅/追更类），成片中的人物不可能对观众喊话求关注'
          : 'A platform host pitch (subscribe / like / follow / hit the bell) appears in the script; no character in the scene can address the feed',
      });
    }

    // C. 集尾旁白将来时排播单：仅尾部扫描区
    if (!inTail || ln.kind === 'header') return;
    const isNarratorVoice =
      ln.kind === 'narration' ||
      (ln.kind === 'dialogue' && (isZh ? NARRATOR_ZH_RE : NARRATOR_EN_RE).test(ln.speaker));
    if (!isNarratorVoice) return; // 角色当场做的计划归对白/情报引擎，不判
    const beats = countClauses(ln.text, isZh);
    if (beats >= 2) {
      push({
        line: ln.no,
        kind: 'future_dump',
        narrator: true,
        beats,
        snippet: snippetOf(ln.text),
        reason: isZh
          ? `集尾叙述用将来时连播 ${beats} 个下一集的具体动作，成了节目预告；钩子要停在正在发生的瞬间，不能替下一集播报剧情`
          : `The closing narration pre-announces ${beats} concrete beats from the next episode in future tense; end on the moment itself, do not narrate next episode's plot`,
      });
    }
  });

  // 计分：100 起；marker −45，pitch −20，future_dump −26；20 封底
  let score = 100;
  for (const h of hits) {
    if (h.kind === 'marker') score -= 45;
    else if (h.kind === 'pitch') score -= 20;
    else score -= 26;
  }
  if (score < 20) score = 20;
  if (hits.length === 0) score = 100;

  const issues = hits.map((h) =>
    isZh
      ? `第${h.line}行 ${h.kind === 'marker' ? '预告段落标记' : h.kind === 'pitch' ? '主播求关注口播' : '集尾将来时排播'}：${h.snippet}`
      : `Line ${h.line} ${h.kind === 'marker' ? 'preview marker' : h.kind === 'pitch' ? 'host pitch' : 'future-tense preview dump'}: ${h.snippet}`,
  );

  const advice = isZh
    ? '删掉全部导视体（下集预告/未完待续/关注点赞）。集尾停在一个正在发生、可拍的强动作或一句被打断的台词上，把"接下来会怎样"留给观众猜；要交代下一集信息，也只能通过本集人物此刻看到/听到的具体物件露出。'
    : 'Cut every TV-guide device (next-episode cards, to be continued, subscribe/like pitches). End on one filmable, present-tense action or an interrupted line; let the audience wonder what happens next. Any forward information must surface as a concrete object this episode\u2019s characters see or hear right now.';

  return {
    score,
    tailLines: lines.length - tailStartIdx,
    hits: hits.sort((a, b) => a.line - b.line),
    issues,
    advice,
  };
}
