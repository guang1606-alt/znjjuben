import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 气氛直述检测（Atmosphere Tell）
 * -----------------------------------------------------------
 * 创作能力类引擎：镜头拍得出一个人攥皱请帖，拍不出"气氛很尴尬"。
 * 编剧一旦写
 *   气氛顿时变得尴尬。
 *   空气仿佛凝固了。
 *   场面一度十分安静。
 *   时间仿佛静止。
 *   一股暧昧的气息在两人之间弥漫。
 * 就是用一句抽象判断，替观众给整场戏下情绪结论——没有可拍的脸，
 * 没有可拍的动作，导演只能靠后期硬塞 BGM 救场。
 *
 * 判定：
 *  1) 只扫叙述/动作行（台词里说"气氛别这么僵"不算）；
 *  2) 气氛主体（气氛/空气/场面/时间/气息）+ 抽象情绪结论（尴尬/凝固/
 *     凝固/暧昧/剑拔弩张…）近距离共现，或"沉默/尴尬在……蔓延"；
 *  3) 不管群体静默（鸦雀无声/众人安静下来）——那归 crowd-reaction。
 * 专业豁免（rescue）：命中行内逗号之后或之后 2 行内，出现具体的人的
 *  具体动作或开口打破（"林棠先笑了，端起茶杯"/"他咳了一声：走吧"），
 *  说明气氛判断后面紧跟着可拍的戏——记 rescued，不扣分。换场清空。
 *
 * 边界：
 *  - pathetic-fallacy 管天气/景物替人演情绪（雨在哭、风在嘲讽）；
 *  - crowd-reaction 管群体反应（众人愣住、鸦雀无声、全场安静）；
 *  - show-dont-tell 管人物情绪直述（她很伤心）；本引擎管"整场戏的
 *    抽象情绪结论"，是场景级的 tell。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface AtmosphereHit {
  line: number;
  subject: string;
  mood: string;
  snippet: string;
  /** 命中后是否落到了具体人的动作/开口上（落到则不扣分） */
  rescued: boolean;
  rescueLine?: number;
  reason: string;
}

export interface AtmosphereTellResult {
  score: number;
  narrationLines: number;
  hits: AtmosphereHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// 气氛主体 + 抽象情绪结论
const LABEL_ZH = /(气氛|氛围|空气|场面|满室|满屋|一室|周遭|周围)[^。！？\n]{0,12}?(?:尴尬|紧张|凝重|压抑|沉重|暧昧|微妙|诡异|古怪|僵硬|凝滞|窒息|肃杀|焦灼|剑拔弩张|一触即发|凝固|紧绷|僵住|沉了下来)|(?:时间|空气)(?:仿佛|似乎|好像|在这一刻|一瞬间)?(?:静止|停止|凝固|慢了下来|凝滞)|(?:沉默|寂静|尴尬|紧张|暧昧|压抑|恐慌)(?:在[^。！？\n]{0,12}|的[^。！？\n]{0,10}在[^。！？\n]{0,10})?(?:蔓延|扩散|流淌|弥漫|弥散)/;
const LABEL_EN = /\b(?:the atmosphere|the mood|the air|the vibe|the silence)(?:\s+(?:grew|turned|went|became|was|felt|thickened|tightened|hung|settled|froze|stretched(?:\s+on)?))?[^.\n]{0,40}?\b(?:awkward|tense|heavy|thick|stifling|oppressive|strained|weird|strange|frosty|frozen|froze|suffocating|electric)\b|\b(?:an?|the)\s+(?:awkward|tense|heavy|stunned|dead|long|prolonged)\s+silence\b|\btime(?:\s+seemed to|\s+appeared to|\s+stood)?\s+(?:freeze|froze|stand still|stopped|stood still)\b|\b(?:awkwardness|tension|unease)\s+(?:hung|filled|thickened in|settled over|spread through)\b/i;

// rescue：具体的人 + 具体动作/生理细节（镜头给得出特写），或有人开口打破
const RESCUE_ZH = /(?:林|顾|沈|傅|陆|江|苏|陈|老|小|男|女|他|她|那人|对方|管家|秘书|助理|保镖|佣人|司机|客人|股东|董事|男人|女人|老人|孩子|小伙|姑娘)[^。！？\n]{0,14}(?:先笑|笑了笑|失笑|笑出声|咳了一声|清了清嗓子|端起|放下|推开|站起身|起身|挪开|别过脸|转过头|低下头|喉结|指尖|攥|握紧|捏紧|收紧|后退|顿了顿|张了张嘴|开口|打破|岔开|圆场|打圆场|叹气|吸了口气)/;
const RESCUE_EN = /\b(?:he|she|they|[A-Z][a-z]+)(?:\s+\w+){0,8}?\s(?:chuckled|laughed|cleared (?:his|her) throat|coughed|picked up|set down|put down|stood up|rose|looked away|looked down|swallowed|clenched|tightened|stepped back|hesitated|opened (?:his|her) mouth|broke the silence|broke in|cut in|sighed|took a breath)\b/;

const snippet = (s: string, n = 28): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function atmosphereTell(draft: string): AtmosphereTellResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const labelRe = isZh ? LABEL_ZH : LABEL_EN;
  const rescueRe = isZh ? RESCUE_ZH : RESCUE_EN;
  const dialogueRe = DIALOGUE_RE;

  const lines = draft.split(/\r?\n/);
  const hits: AtmosphereHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (dialogueRe.test(line)) return; // 台词中点破"气氛尴尬"是人物语言，不算
    narrationLines++;

    const m = line.match(labelRe);
    if (!m) return;

    // rescue ① 同行命中点之后已有具体人的动作（"气氛一时尴尬，林棠先笑了，端起茶"）
    const tail = line.slice(Math.min(line.length, (m.index ?? 0) + m[0].length));
    let rescued = /[，,、]/.test(tail) && rescueRe.test(tail);
    let rescueLine: number | undefined;
    // rescue ② 之后 2 行内（不跨场景）：具体人的动作，或有人开口
    if (!rescued) {
      for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
        const near = lines[k].trim();
        if (!near) continue;
        if (isSceneHeaderLine(near)) break;
        if (dialogueRe.test(near) || rescueRe.test(near)) { rescued = true; rescueLine = k + 1; break; }
      }
    }
    const matched = m[0];
    const subj = isZh
      ? (matched.match(/^(气氛|氛围|空气|场面|满室|满屋|一室|周遭|周围|时间|沉默|寂静|尴尬|紧张|暧昧|压抑|恐慌)/)?.[0] ?? '气氛')
      : (matched.match(/^(the atmosphere|the mood|the air|the vibe|the silence|time|awkwardness|tension|unease)/i)?.[0] ?? 'atmosphere');
    hits.push({
      line: i + 1,
      subject: subj,
      mood: matched,
      snippet: snippet(line),
      rescued,
      ...(rescueLine ? { rescueLine } : {}),
      reason: isZh
        ? '用抽象判断给整场戏下情绪结论：没有可拍的脸、没有可拍的动作，气氛只能靠后期 BGM 硬凑'
        : 'an abstract verdict hands the scene its mood — no face, no action the camera can shoot; only a music cue is left to fake it',
    });
  });

  const badHits = hits.filter((h) => !h.rescued);
  const score = Math.max(25, 100 - badHits.length * 12);

  const issues = badHits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」直接宣布了"${h.mood}"——删掉结论，写在场最不自在的那个人的一个具体动作：端起茶杯又放下、假笑一声先移开视线、用钥匙声把话头盖过去`
      : `L${h.line} "${h.snippet}" announces the mood ("${h.mood}") — cut the verdict and write one concrete beat from the least comfortable person in the room: lifting a cup then setting it down, laughing first and looking away, covering the pause with the sound of keys`);

  const advice = isZh
    ? badHits.length > 0
      ? '气氛不是写出来的，是演出来的。先判断这场戏里谁最不自在、谁想先走、谁在假装没事，把那股劲压进他的一个小动作或一句岔开的话里；删掉"气氛/空气/场面+情绪结论"，观众自己会感到气压。'
      : '气氛都落在了具体人物动作上，保持。'
    : badHits.length > 0
      ? 'Mood is acted, not announced. Decide who is most uncomfortable, who wants to leave, who is pretending everything is fine — compress that pressure into one small action or one deflecting line; cut the "atmosphere/air + mood verdict" and the audience will feel the pressure drop themselves.'
      : 'The mood lands on concrete human behavior; keep it.';

  return { score, narrationLines, hits, issues, advice };
}
