import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 环境共情/天气替演检测（Pathetic Fallacy）
 * -----------------------------------------------------------
 * 创作能力类引擎：小说思维改分镜本的典型残留——自己不会写人物情绪，
 * 就派天气替角色哭：
 *   暴雨仿佛在为她哭泣。
 *   风在窗外呜咽，连老天都看不下去了。
 *   月光同情地洒在她身上。
 *   The rain seemed to weep for her.
 * 天气没有情绪，"天也哭了"是写作者跳出来替场面定调；镜头能拍雨，
 * 拍不出"雨在同情谁"。情绪必须从人的选择与动作里长出来。
 *
 * 三类判定（只扫叙述行）：
 *  A. 拟人框架：仿佛/好像/像是/似乎/as if/like/seemed to + 情绪动作；
 *  B. 直接拟人：天气/无生命主语 + 人类情绪动词（哭/怒/嘲笑/怜悯/weep/mock）；
 *     单纯客观搭配不报（wind howled / 雷声滚滚 / 雨越下越大）；
 *  C. 天意代言：连老天都看不下去/上天也为她……/even heaven mourned。
 * 豁免：
 *  - 角色感知框架内的主观投射（"她觉得雨声像在哭"/she felt as if）：
 *    有明确感知主体，是角色视角而非叙述者定调；
 *  - 台词行、场景头。
 *
 * 边界：scene-padding 管"天气开场流水账"（结构空转），本引擎管
 * "天气替人演情绪"（修辞越权）。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface FallacyHit {
  line: number;
  kind: 'frame' | 'direct' | 'heaven';
  subject: string;
  emotion: string;
  snippet: string;
  reason: string;
}

export interface PatheticFallacyResult {
  score: number;
  narrationLines: number;
  hits: FallacyHit[];
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);

const DIALOGUE_RE = /^([^\s：:]{1,12})(?:（[^）]*）)?\s*[：:]\s*(.+)$/;

// A. 拟人框架词 + 人类情绪动作
const FRAME_ZH = /(?:仿佛|好像|像是|宛如|犹如|恍若|似乎)[^。！？\n]{0,12}(?:哭泣|哭了?|流泪|落泪|怒吼|咆哮|嘲笑|讥笑|嗤笑|叹息|叹气|呜咽|哀嚎|哀鸣|控诉|怒视|怜悯|同情|悲恸|默哀|不舍|低语|耳语|呢喃|呻吟|颤抖着?[说哭])/;
const FRAME_EN = /\b(?:as if|as though|like|seemed to|seemed almost to|almost as if)\b[^.\n]{0,24}\b(?:weep(?:ing)?|cri(?:ed|ing)|cry|mourn(?:ing)?|sigh(?:ed|ing)?|sob(bed|bing)?|whisper(?:ed|ing)?|roar(?:ed)? in anger|mock(?:ed|ing)?|laugh(?:ed|ing)? at|piti(?:ed|ying)|watch(?:ed)? over|griev(?:ed|ing)|wail(?:ed|ing)?)\b/i;

// B. 天气/无生命主语
const SUBJECT_ZH = /(雨水?|大雨|暴雨|细雨|冷雨|风|狂风|寒风|夜风|雷声?|天空|天|月亮|月光|太阳|阳光|云|乌云|海浪?|江水|河水|灯火?|灯光|烛火|城市|夜|夜色|雾气|雪)/;
const SUBJECT_EN = /\b(?:the rain|rain|the wind|wind|the thunder|thunder|the sky|the moon|moonlight|the sun|sunlight|the clouds?|the waves?|the city|the night|the light|the lamp|the snow|the fog)\b/i;
// 强人类情绪动词（客观搭配 howl/shine/fall 不算）
const EMOTION_ZH = /(?:在|正)?(?:哭泣|哭了?|流泪|落泪|怒吼|咆哮|嘲笑|讥笑|嗤笑|叹息|叹气|呜咽|哀嚎|哀鸣|控诉|怒视|怜悯地?|同情地?|悲泣|低语着?|耳语着?)/;
const EMOTION_EN = /\b(?:wept|was weeping|started to cry|cried|mourned|sighed|sobbed|whispered(?: sadly)?|mocked|pitied|grieved|wailed|watched (?:him|her|them) (?:with pity|sadly|in sorrow))\b/i;

// C. 天意代言
const HEAVEN_ZH = /(?:连)?(?:老天|老天爷|上天|苍天|老天爷他)[^。！？\n]{0,8}(?:也)?(?:看不下去|为[她他它]|替[她他它]|可怜|同情|哭|怒|叹息|动容|不公平|瞎了眼|落泪|悲鸣)/;
const HEAVEN_EN = /\b(?:even )?(?:heaven|the gods?|god|the sky above|fate itself)\b[^.\n]{0,24}\b(?:wept|cried|mourned|sighed|pitied|could(?:n'?t| not) bear to watch|was on (?:her|his|their) side|turned against|grieved)\b/i;

// 豁免：角色感知框架内的主观投射（有感知主体，是人物视角）
const PERCEIVE_ZH = /(?:她|他|它|我|你|林[\u4e00-\u9fff]{1,2}|沈[\u4e00-\u9fff]{1,2}|[\u4e00-\u9fff]{2,3})(?:心里|这时候|此刻)?(?:觉得|感觉|感到|听着|听上去|听起来|看着|看上去|看来|眼里?中?|耳里?|耳旁)/;
const PERCEIVE_EN = /\b(?:she|he|they|i)\s+(?:felt|thought|could hear|could see|imagined|fancied|wondered if)|in (?:her|his|their) (?:eyes|ears|mind)|to (?:her|him)\s+(?:it|the rain|the wind)\s+(?:sounded|looked|felt)\b/i;

const snippet = (s: string, n = 28): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function patheticFallacy(draft: string): PatheticFallacyResult {
  if (!draft || !draft.trim()) {
    return { score: 100, narrationLines: 0, hits: [], issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const frameRe = isZh ? FRAME_ZH : FRAME_EN;
  const subjRe = isZh ? SUBJECT_ZH : SUBJECT_EN;
  const emoRe = isZh ? EMOTION_ZH : EMOTION_EN;
  const heavenRe = isZh ? HEAVEN_ZH : HEAVEN_EN;
  const perceiveRe = isZh ? PERCEIVE_ZH : PERCEIVE_EN;

  const lines = draft.split(/\r?\n/);
  const hits: FallacyHit[] = [];
  let narrationLines = 0;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) return;
    if (DIALOGUE_RE.test(line)) return;
    narrationLines++;

    // 感知主体豁免优先（"她觉得雨声像在哭"是角色视角，不是叙述者定调）
    if (perceiveRe.test(line)) {
      // 但"连老天都看不下去"这种天意代言即使挂着感知动词也罕见；保守起见全免
      return;
    }

    // C. 天意代言
    const hm = line.match(heavenRe);
    if (hm) {
      hits.push({
        line: i + 1, kind: 'heaven', subject: hm[0].slice(0, 6), emotion: hm[0],
        snippet: snippet(line),
        reason: isZh
          ? '让天意替角色表态，是叙述者跳出来定调；"老天"没有反应，能反应的只有具体的人'
          : 'enlisting heaven to take sides is the narrator stepping in to set the tone; heaven cannot react, only people can',
      });
      return;
    }

    // A. 拟人框架
    const fm = line.match(frameRe);
    if (fm) {
      const sm = line.match(subjRe);
      hits.push({
        line: i + 1, kind: 'frame',
        subject: sm ? sm[0] : (isZh ? '环境' : 'the elements'),
        emotion: fm[0],
        snippet: snippet(line),
        reason: isZh
          ? '用"仿佛/像是"把人类情绪派给天气环境，情绪不是被演出来的，是被旁白宣布的'
          : 'projecting human emotion onto the weather through a simile frame tells the audience how to feel instead of showing it',
      });
      return;
    }

    // B. 天气主语 + 强情绪动词近距离共现
    const sm2 = line.match(subjRe);
    const em = line.match(emoRe);
    if (sm2 && em) {
      const gap = Math.abs((em.index ?? 0) - (sm2.index ?? 0));
      if (gap <= (isZh ? 12 : 50)) {
        hits.push({
          line: i + 1, kind: 'direct', subject: sm2[0], emotion: em[0],
          snippet: snippet(line),
          reason: isZh
            ? '无生命物直接做出人类情绪动作（哭/怒/怜悯），镜头拍得出物象，拍不出它的情绪'
            : 'an inhuman subject performs a human emotion; the camera can film the object but not its feelings',
        });
      }
    }
  });

  const score = Math.max(25, 100 - hits.length * 11);
  const issues = hits.slice(0, 10).map((h) =>
    isZh
      ? `第${h.line}行「${h.snippet}」让环境替角色演情绪——删掉拟人，把情绪改成人的外化动作：同样一场雨，写她把伞折断、写他没带钱却走进雨里`
      : `L${h.line} "${h.snippet}" makes the setting act the emotion — cut the personification and externalize it as behavior: in the same rain, have her snap the umbrella, or him walk into it though he cannot afford a cold`);

  const advice = isZh
    ? hits.length > 0
      ? '天气是道具，不是演员。雨就是雨，怒的是人。让环境参与戏（伞断了、路淹了赴不了约、雷声盖住关键一句），但永远别让环境替人哭、替人怒。'
      : '环境只做客观物象与情节压力，不替角色表态，保持。'
    : hits.length > 0
      ? 'Weather is a prop, not a performer. Rain is rain; the people are angry. Let the environment pressure the scene (a broken umbrella, a flooded road that blocks the meeting, thunder that drowns the key line) — never let it weep or rage on the character\'s behalf.'
      : 'The setting stays objective and pressures the plot without taking emotional sides; keep it.';

  return { score, narrationLines, hits, issues, advice };
}
