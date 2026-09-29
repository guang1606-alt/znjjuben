import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 情绪硬切无铺垫检测（Emotion Whiplash）
 * ------------------------------------------------
 * 创作能力类引擎：上一句还在吼/哭，下一句立刻笑/原谅——中间没有
 * 新信息、事件或缓冲动作。情绪转折是要"付价格"的：观众需要看到
 * 他为什么转变。硬切让人物像开关，是 AI/快手剧本高频假感。
 *
 * 与既有引擎边界（查重结论）：
 *  - character-logic.emotion_jump：依赖人物表、只看同一角色相邻台词、
 *    不看中间铺垫、severity=low；本引擎不依赖 cast、触发感知（有铺垫即赦免）、
 *    同时抓叙述句里的"转怒为喜/瞬间笑了"瞬时翻转套路；
 *  - emotional-aftermath：管受伤后恢复过快（账本/后果链），不管单场情绪对跳；
 *  - scene-emotion-flat：相反问题——单场情绪无对比；本引擎治对比来得没代价。
 *
 * 赦免规则（有铺垫）：两条相反极性台词之间，出现
 *  ① 揭示性关键词（原来/告诉/手机/证据/化验单/合同/跪/道歉…），或
 *  ② ≥20字（英≥10词）的实质动作/叙述句；
 * 则认为情绪转折付了价格，不判。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface WhiplashHit {
  type: 'bare_flip' | 'instant_phrase';
  speaker?: string;
  from: string;
  to: string;
  prevSnippet: string;
  nextSnippet?: string;
  line: number;
  reason: string;
}

export interface EmotionWhiplashResult {
  score: number;
  hits: WhiplashHit[];
  flips: number;
  pardoned: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


// 强极性词（只取高置信度的极端情绪，避免日常悲喜误判）
const NEG_ZH = ['暴怒', '狂怒', '怒吼', '吼道', '大吼', '嘶吼', '咆哮', '怒骂', '骂道', '滚出去', '我恨你', '恨死', '痛哭', '嚎啕', '大哭', '泣不成声', '崩溃', '绝望', '瑟瑟发抖', '吓得', '惊恐', '冷笑', '摔门', '拍桌', '怒吼着'];
const POS_ZH = ['大笑', '笑了起来', '笑着说', '开心', '高兴', '欣喜', '狂喜', '雀跃', '亲了', '拥抱', '抱住', '原谅你', '我原谅', '我爱你', '幸福', '欢天喜地', '扑哧一笑', '笑出声'];

const NEG_EN = ['furious', 'enraged', 'screams', 'yells', 'shouts', 'sobs', 'breaks down', 'i hate you', 'rages', 'snarls', 'scowls', 'terrified', 'desperate', 'storms out', 'slams'];
const POS_EN = ['laughs', 'smiles', 'grins', 'giggles', 'hugs', 'kisses', 'i love you', 'forgive you', 'you are forgiven', 'delighted', 'overjoyed', 'cheers', 'beams'];

// 瞬时翻转套路短语（叙述或台词里直接"宣布"情绪复位）
const INSTANT_ZH = /转怒为喜|转悲为喜|破涕为笑|怒气瞬间消|气一下子消|气顿时消|火气.{0,4}消|突然就笑了|忽然笑了|立刻换了副笑脸|瞬间.{0,5}(笑|开心|高兴)|马上又高兴|前一秒还在吵.{0,8}笑|立刻原谅/;
const INSTANT_EN = /\b(anger|rage|fury)\b[^.]{0,20}\b(instantly|immediately|suddenly|a second later)\b[^.]{0,20}(smil|laugh|grin)|broke into a smile|mood (instantly|immediately) (shifted|lifted)|suddenly (laughing|smiling|grinning)|face lit up (immediately|instantly)|forgave him (instantly|immediately)\b/i;

// 转折触发器：新信息/新事件
const TRIGGER_ZH = /原来|其实|告诉|通知|手机|短信|电话|消息|信|证据|化验单|报告|合同|DNA|鉴定|跪|道歉|对不起|认错|拿出|掏出|递过|亮出|宣布|新闻|录音|视频|监控|遗嘱|真相|查明|调查|医生|警察|律师/;
const TRIGGER_EN = /\b(reveal|tells?|shows?|phone|text(?: message)?|letter|evidence|report|contract|dna|kneels?|apologizes?|apolog(?:y|ised)|sorry|pulls? out|hands (?:him|her)|announces?|news|recording|video|footage|will|truth|doctor|police|lawyer|turns out|it turns out)\b/i;

interface Unit {
  idx: number;
  kind: 'dialogue' | 'action';
  speaker?: string;
  text: string;
}

function polarityOf(s: string, isZh: boolean): number {
  const neg = isZh ? NEG_ZH : NEG_EN;
  const pos = isZh ? POS_ZH : POS_EN;
  const lower = s.toLowerCase();
  const has = (arr: string[]) => arr.some((w) => (isZh ? s.includes(w) : lower.includes(w)));
  const n = has(neg);
  const p = has(pos);
  if (n && !p) return -1;
  if (p && !n) return 1;
  return 0;
}

function isDialogueLine(line: string): RegExpMatchArray | null {
  return line.trim().match(/^([^\s：:]{1,12})\s*[：:]\s*(.+)$/);
}

export function emotionWhiplash(draft: string): EmotionWhiplashResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], flips: 0, pardoned: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const instantRe = isZh ? INSTANT_ZH : INSTANT_EN;
  const triggerRe = isZh ? TRIGGER_ZH : TRIGGER_EN;

  // 按场切，避免跨场误判
  const scenes: Unit[][] = [];
  let cur: Unit[] = [];
  const pushScene = () => { if (cur.length) scenes.push(cur); cur = []; };
  draft.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (isSceneHeaderLine(line)) { pushScene(); return; }
    const dm = isDialogueLine(line);
    if (dm) cur.push({ idx: idx + 1, kind: 'dialogue', speaker: dm[1].trim(), text: dm[2].trim() });
    else cur.push({ idx: idx + 1, kind: 'action', text: line });
  });
  pushScene();

  const hits: WhiplashHit[] = [];
  let flips = 0;
  let pardoned = 0;

  const snippet = (s: string) => (s.length > 16 ? `${s.slice(0, 16)}…` : s);

  // ① 瞬时翻转套路短语（任意句）+ ② 同角色无铺垫极性对跳
  for (const scene of scenes) {
    for (const u of scene) {
      const m = u.text.match(instantRe);
      if (m) {
        hits.push({
          type: 'instant_phrase',
          ...(u.kind === 'dialogue' ? { speaker: u.speaker } : {}),
          from: isZh ? '极端负面' : 'strong negative',
          to: isZh ? '笑/原谅' : 'smile/forgiveness',
          prevSnippet: snippet(u.text),
          line: u.idx,
          reason: isZh
            ? '用短语直接宣布情绪复位，观众没看到转变过程——若转变有依据，把触发事件演出来，别用"瞬间/转怒为喜"概括'
            : 'Emotional reset announced by label instead of played out — if earned, dramatize the trigger; cut the "instantly/suddenly smiled" summary.',
        });
      }
    }

    // ② 同一角色无铺垫极性对跳
    const lastBySpeaker = new Map<string, { pol: number; unit: Unit }>();
    for (let i = 0; i < scene.length; i++) {
      const u = scene[i];
      if (u.kind !== 'dialogue') continue;
      const pol = polarityOf(u.text, isZh);
      const prev = lastBySpeaker.get(u.speaker!);
      if (!prev) { if (pol !== 0) lastBySpeaker.set(u.speaker!, { pol, unit: u }); continue; }
      if (pol === 0) continue;
      if (prev.pol === pol) { lastBySpeaker.set(u.speaker!, { pol, unit: u }); continue; }

      // 极性对跳：检查中间铺垫
      flips++;
      const between = scene.slice(scene.indexOf(prev.unit) + 1, i);
      const hasTrigger = between.some((b) => triggerRe.test(b.text));
      const hasBeats = between.some((b) => {
        const len = isZh ? b.text.replace(/[，。！？、\s（）()△]/g, '').length : b.text.split(/\s+/).length;
        return b.kind === 'action' && len >= (isZh ? 20 : 10);
      });
      if (hasTrigger || hasBeats) {
        pardoned++;
      } else {
        hits.push({
          type: 'bare_flip',
          speaker: u.speaker,
          from: prev.pol < 0 ? (isZh ? '怒/哭' : 'anger/tears') : (isZh ? '笑/热' : 'warmth'),
          to: pol < 0 ? (isZh ? '怒/哭' : 'anger/tears') : (isZh ? '笑/热' : 'warmth'),
          prevSnippet: snippet(prev.unit.text),
          nextSnippet: snippet(u.text),
          line: u.idx,
          reason: isZh
            ? '同一角色情绪正负极硬切，中间没有新信息、事件或实质缓冲动作。补一个让他不得不转变的具体刺激，或加过渡情绪（愣住→戒备→松动）'
            : 'Same character flips emotional polarity with no new information, event or substantive beat between. Give a concrete trigger that forces the shift, or stage a transition (stunned → guarded → softening).',
        });
      }
      lastBySpeaker.set(u.speaker!, { pol, unit: u });
    }
  }

  const deduct = hits.reduce((a, h) => a + (h.type === 'instant_phrase' ? 14 : 12), 0);
  const score = Math.max(0, 100 - deduct);

  const issues = hits.map((h) =>
    isZh
      ? `${h.type === 'instant_phrase' ? `第${h.line}行瞬时翻转` : `第${h.line}行「${h.speaker}」${h.from}→${h.to}`}：${h.reason}`
      : `Line ${h.line}${h.speaker ? ` "${h.speaker}"` : ''} ${h.type === 'instant_phrase' ? 'instant reset' : `${h.from} → ${h.to}`}: ${h.reason}`);

  const advice = isZh
    ? hits.length > 0
      ? '情绪转折必须付价格：在两极之间放一个"他无法忽略的新事实"（一条短信、一个下跪、一份化验单），或拆成三级过渡。别用副词和情绪名词宣布转变，让观众自己看见他是怎么被撬动的。'
      : '情绪转折均有铺垫，保持。'
    : hits.length > 0
      ? 'Emotional turns must be paid for: place an undeniable new fact between the poles (a message, a kneel, a lab report), or break the shift into three beats. Never announce a flip with adverbs and emotion labels — let the audience watch the leverage work.'
      : 'Emotional turns are earned with triggers; keep it.';

  return { score, hits, flips, pardoned, issues, advice };
}
