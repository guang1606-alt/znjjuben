/**
 * craft-lint.ts —— 一线编剧“实战改稿尺子”合集（2026-08，25条一线视频去重沉淀）
 * 与既有引擎分工：rhythm 管节奏曲线、dialogue 管口语文法、lifelike 管生活细节、character-logic 管人设一致；
 * 本文件补的是“能不能过稿、爽不爽、假不假、像不像小说/降智”的一线市场改稿判断，全部为可执行纯函数。
 * 每条问题给 rule/level(P0-P2)/命中/可落地改法，供围读、评分、去AI化、拆爆款复用。
 * v1.92：全规则中英双语（lang='en' 时使用英文检测词与英文 dim/advice），默认中文逐字不变。
 */
import { perEpisodeThreeQ, TrackId, TRACK_STRATEGY } from './market-playbook';
export type LintLevel = 'P0' | 'P1' | 'P2';
export type LintLang = 'zh' | 'en';
export interface LintIssue {
  rule: string; dim: string; level: LintLevel;
  hit: string[]; advice: string; score: number; // score 0-100，越高越好
}
const count = (text: string, words: string[]) => words.reduce((n, w) => n + (text.split(w).length - 1), 0);
const hitWords = (text: string, words: string[]) => words.filter((w) => text.includes(w));
/* 1. 反派高级度：拒绝歇斯底里/无缘无故的低级反派，要“理所当然的降维剥夺” */
const CHEAP_VILLAIN = ['歇斯底里', '泼妇', '穷鬼', '贱', '给我打', '叫保安', '保安把他', '无缘无故', '破口大骂', '大吵大闹', '嘲讽他穷', '看不起穷人'];
const CHEAP_VILLAIN_EN = ['hysterical', 'you poor', 'trash', 'call security', 'get him', 'for no reason', 'screamed at', 'look down on the poor'];
const CLASS_DEPRIVE = ['署名权', '名额', '资格', '职位', '合同', '股权', '继承权', '保送', '转正', '立项', '判给', '过户', '给了别人', '轻描淡写'];
const CLASS_DEPRIVE_EN = ['credit', 'quota', 'eligibility', 'position', 'contract', 'equity', 'inheritance', 'recommendation', 'probation', 'awarded to someone else'];
export function villainLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const cheap = hitWords(probe, en ? CHEAP_VILLAIN_EN.map((w) => w.toLowerCase()) : CHEAP_VILLAIN);
  const advanced = hitWords(probe, en ? CLASS_DEPRIVE_EN.map((w) => w.toLowerCase()) : CLASS_DEPRIVE);
  const score = Math.max(0, 100 - cheap.length * 18 + advanced.length * 8);
  const issue: LintIssue = {
    rule: 'villain', dim: en ? 'Villain sophistication' : '反派高级度', level: 'P2', hit: cheap,
    advice: en
      ? 'A villain should not rant or be evil for no reason. Use matter-of-fact “dimensional deprivation”: calmly, even caringly, strip the lead of what is theirs via rules/class (credit, quota, position). Quiet suffocation ignites anger far more than a shrieking villain — then the counter-strike lands.'
      : '反派不靠骂街/无缘无故使坏。用“理所当然的降维剥夺”：平静甚至带关怀地，用规则/阶层剥夺本该属于主角的东西（署名权、名额、职位），平静下的窒息比泼妇骂街更能点燃怒火，主角反击才响。',
    score: Math.min(100, score),
  };
  if (cheap.length >= 2 && advanced.length === 0) issue.level = 'P1';
  if (cheap.length === 0) issue.advice = en
    ? 'The oppression logic holds — keep the villain “bad at the level of interest/rules” and avoid sliding into ranting later.'
    : '反派压迫逻辑成立，保持“利益/规则层面的坏”，避免后续滑向骂街。';
  return issue;
}
/* 2. 中式废话/零价值铺垫：前三行就要塞情绪筹码，删心理委屈长段与骂街长段 */
const EMPTY_FILLER = ['心中五味杂陈', '一股.*?涌上心头', '不禁', '脑海里', '暗自想', '心想', '久久不能平静', '仿佛.*?一般', '说不出的', '复杂的情绪', '陷入了回忆', '空气仿佛凝固'];
const EMPTY_FILLER_EN = ['mixed feelings', 'a wave of .*? washed over', 'couldn’t help', 'in her mind', 'thought to himself', 'could not calm down', 'as if .*? ', 'indescribable', 'complicated emotion', 'sank into memories'];
export function fillerLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const head = text.slice(0, en ? 320 : 160);
  const chipEn = count(head.toLowerCase(), ['slap', 'slam', 'snatch', 'kick', 'force', 'kneel', 'tear', 'throw', 'block', 'grab', 'sneer', 'on the spot', 'little did']) + (/"[^"]{6,}"/.test(head) ? 1 : 0);
  const chip = en ? chipEn : count(head, ['甩', '拍', '砸', '抢', '赶', '逼', '跪', '撕', '摔', '拦', '夺', '冷笑', '当场', '竟然', '谁知']) +
    (/[“"][^”"]{4,}[”"]/.test(head) ? 1 : 0); // 开场即冲突动作/强对话=情绪筹码
  const fillerWords = en ? EMPTY_FILLER_EN : EMPTY_FILLER;
  const fillerHit = fillerWords.filter((p) => new RegExp(p, 'i').test(text));
  const score = Math.max(0, Math.min(100, chip * 25 + 20 - fillerHit.length * 12));
  return {
    rule: 'filler', dim: en ? 'Opening information density' : '开场信息密度', level: chip === 0 ? 'P1' : 'P2', hit: fillerHit,
    advice: en
      ? 'Put an “emotional chip” (conflict action / cutting line / a deprivation event) in the first three lines. Cut hundreds of words describing inner grievance or the villain’s rant — short drama competes on information and payoff chips, not florid setup.'
      : '前三行就要塞“情绪筹码”（冲突动作/扎心台词/被剥夺事件），删掉几百字写“心里多委屈、反派骂得多难听”的零价值哑弹；短剧拼信息量与爽点筹码，不拼辞藻铺垫。',
    score,
  };
}
/* 3. 小说化：短剧是给镜头拍的视觉语言，心理/氛围/小说腔要转成可见动作与画面 */
const NOVEL_MARKER = ['眼角闪过', '三分讥笑', '四分', '薄唇', '勾起一抹', '勾起弧度', '心中一紧', '暗自', '眸', '眼底闪过', '俊美的', '修长的手指', '心里很', '内心深处', '旁白'];
const NOVEL_MARKER_EN = ['a flicker in .*? eyes', 'thin lips', 'curved into a', 'heart tightened', 'silently to herself', 'orbs', 'flashed in his gaze', 'slender fingers', 'deep inside', 'narrator'];
export function novelisticLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const hit = hitWords(probe, (en ? NOVEL_MARKER_EN : NOVEL_MARKER).map((w) => (en ? w.toLowerCase() : w)));
  const score = Math.max(0, 100 - hit.length * 14);
  return {
    rule: 'novelistic', dim: en ? 'De-novelization (visual)' : '去小说化（可视化）', level: hit.length >= 3 ? 'P1' : 'P2', hit,
    advice: en
      ? 'Don’t write short drama like a novel: cut “a flicker of mockery in his eyes / inner anger / long narration”. Turn “he was angry” into “he smashed the cup”; turn “she was miserable” into a visible action. Convert all inner life into actable, filmable action, dialogue and confrontation.'
      : '别把短剧写成小说：删“眼角闪过三分讥笑/心中气愤/大段旁白渲染”。写“他很气愤”→改成“他一把砸碎杯子”；写“她很惨”→改成“大冬天她跪在雪地里给人擦鞋”。心理活动全部转成演员能演、镜头能拍的动作、台词、对抗。',
    score,
  };
}
/* 4. 降智爽点：淘汰下跪磕头耳光/反派强行降智/主角无脑开挂，要“智商在线·认知打击” */
const DUMB = ['下跪', '磕头', '巴掌', '耳光', '叫保安', '强行降智', '无脑', '大佬老公', '天呐', '求求你', '饶命'];
const DUMB_EN = ['kneel down', 'kowtow', 'slap', 'call security', 'suddenly stupid', 'brainless', 'ceo husband', 'please spare me'];
const SMART = ['规则', '合同', '证据', '条款', '认知', '布局', '连环', '知识产权', '股权', '法律', '反将', '记录', '账号', '复盘会'];
const SMART_EN = ['rule', 'contract', 'evidence', 'clause', 'leverage knowledge', 'scheme', 'chain of', 'ip', 'equity', 'law', 'counter', 'record', 'account', 'review meeting'];
export function dumbPayoffLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const dumb = hitWords(probe, (en ? DUMB_EN : DUMB).map((w) => (en ? w.toLowerCase() : w)));
  const smart = hitWords(probe, (en ? SMART_EN : SMART).map((w) => (en ? w.toLowerCase() : w)));
  const score = Math.max(0, Math.min(100, 60 - dumb.length * 10 + smart.length * 10));
  return {
    rule: 'dumbPayoff', dim: en ? 'Payoff intelligence' : '爽点智商', level: dumb.length >= 3 && smart.length === 0 ? 'P1' : 'P2', hit: dumb,
    advice: en
      ? 'Retire dated payoffs (triple slaps, kneeling, calling security, suddenly-stupid villains, brainless power fantasy). Upgrade to “smart, cognitive strikes”: the lead stays calm and uses industry rules, contract clauses and an evidence chain to make the villain self-destruct — respecting the viewer’s intelligence deepens immersion.'
      : '别再写三巴掌/下跪/叫保安/反派强行降智/主角无脑开挂的过时爽点。升级为“智商在线·认知打击”：主角不哭不闹，用行业规则、商业条款、证据链布下连环套，让反派自己破产——观众智商被尊重，代入感才强。',
    score,
  };
}
/* 5. 主角能动性：拒绝老好人/只讲道理/温顺解释，要情绪兑现、被压必反击 */
const PASSIVE = ['讲道理', '解释道', '委屈地说', '默默忍', '忍让', '求你', '不与你计较', '深吸一口气忍', '转身离开没有', '含泪'];
const PASSIVE_EN = ['let me explain', 'explained', 'said meekly', 'endured in silence', 'held back', 'i beg you', 'took a deep breath and tolerated', 'tearfully'];
const ACTIVE = ['甩', '当场', '反手', '取消', '证据', '拿回', '反击', '亮出', '布', '起诉', '解约', '转身嫁给', '让.*?后悔', '淡淡'];
const ACTIVE_EN = ['on the spot', 'counter', 'cancel', 'evidence', 'take back', 'fight back', 'revealed', 'sue', 'terminate the contract', 'make .*? regret', 'calmly'];
export function agencyLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const passive = hitWords(probe, (en ? PASSIVE_EN : PASSIVE).map((w) => (en ? w.toLowerCase() : w)));
  const active = (en ? ACTIVE_EN : ACTIVE).filter((p) => new RegExp(p, en ? 'i' : '').test(probe));
  const score = Math.max(0, Math.min(100, 40 + active.length * 12 - passive.length * 10));
  return {
    rule: 'agency', dim: en ? 'Lead agency / emotional payoff' : '主角能动性/情绪兑现', level: passive.length >= 2 && active.length === 0 ? 'P1' : 'P2', hit: passive,
    advice: en
      ? 'The lead can be kind but not weak, can reason but not only reason. Short drama is emotional payoff at its core: when pressed, fight back; when the villain struts, make them pay. Cut explaining and enduring; add actions — present evidence on the spot, call off the engagement, counter-scheme, make doubters regret it.'
      : '主角可以善良但不能软弱、可以讲理但不能只讲理。短剧不是家庭调解会，底层是情绪兑现：被压就要反击、反派嚣张就要付代价。少写解释与忍让，多写“当场甩证据/取消婚约/反手布局/让看不起她的人后悔”的动作。',
    score,
  };
}
/* 6. 压迫-反击兑付：被压多狠反击多痛快，情绪不能掉地上（狗血是外壳，爽是内核） */
export function parityLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const pressureWords = en ? ['bully', 'humiliat', 'oppress', 'snatch', 'force', 'kick', 'insult', 'step on', 'betray', 'grievance', 'frame'] : ['欺负', '羞辱', '压', '抢', '逼', '赶', '辱', '踩', '背叛', '委屈', '陷害'];
  const counterWords = en ? ['fight back', 'comeuppance', 'take back', 'turn the tables', 'reckoning', 'outplay', 'expose', 'prove', 'reclaim', 'win', 'regret'] : ['反击', '打脸', '拿回', '翻盘', '清算', '反杀', '揭穿', '证明', '夺回', '赢', '后悔'];
  const pressure = count(probe, pressureWords);
  const counter = count(probe, counterWords);
  const ok = counter > 0 || pressure === 0;
  return {
    rule: 'parity', dim: en ? 'Pressure-counter payoff' : '压迫-反击兑付', level: ok ? 'P2' : 'P1', hit: [],
    advice: ok
      ? (en
        ? 'Pressure and counter roughly match. Remember: the harder the pressure, the more satisfying the counter; the louder the villain, the clearer the price. Once emotion is raised it must not be dropped — familiar beats are fine if they carry a fresh emotion.'
        : '压迫与反击基本对应。记住：被压得越狠反击要越痛快，反派越嚣张代价越明确，情绪抬起来就不能掉地上；老桥段可以用，但一定要写出“新情绪”。')
      : (en
        ? 'Pressure/grievance accumulates with no matching counter or payoff — the emotion is dropped. Add a counter-strike equal in scale to the pressure.'
        : '检测到压迫/委屈累积，却缺少对应的反击与兑付，情绪掉在了地上。补一个与压迫量级匹配的反击动作。'),
    score: ok ? Math.min(100, 60 + counter * 12) : Math.max(0, 50 - pressure * 6),
  };
}
/* 7. 三直接（土但有效）：冲突直接、情绪直接、目标直接，先有效再高级 */
export function directnessLint(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const head = text.slice(0, en ? 400 : 200);
  const probe = en ? head.toLowerCase() : head;
  const vagueWords = en ? ['seemingly', 'perhaps', 'maybe', 'slowly', 'gradually learned', 'setup', 'for some reason'] : ['似乎', '好像', '也许', '慢慢', '逐渐了解', '铺垫', '不知道为什么'];
  const vague = hitWords(probe, vagueWords.map((w) => (en ? w.toLowerCase() : w)));
  const clear = en ? /(bully|snatch|force|kick|betray|divorce|called off|take|deceive|oppress)/i.test(head) : /欺负|抢|逼|赶|背叛|离婚|退婚|夺|骗|压/.test(head);
  const score = (clear ? 60 : 30) - vague.length * 8 + 40;
  return {
    rule: 'directness', dim: en ? 'Three directness (conflict/emotion/goal)' : '三直接（冲突/情绪/目标）', level: clear ? 'P2' : 'P1', hit: vague,
    advice: en
      ? 'Viewers give only seconds: the opening must instantly show who bullies whom, who fights back, and what the lead wants. Conflict, emotion and goal all direct; be “effective” before being “sophisticated” — the worst is neither.'
      : '观众只给几秒：开场要一眼看懂“谁在欺负谁、谁要反击、主角图什么”。冲突直接、情绪直接、目标直接；先做到“有效”再追求“高级”，最怕不够高级又不够直接。',
    score: Math.max(0, Math.min(100, score)),
  };
}
/* 8. 前三集节奏：EP1出事给钩、EP2继续加压+期待、EP3给小反击/反击希望 */
export function firstThreeLint(episodes: string[], lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const eps = (episodes || []).slice(0, 3);
  const marks = eps.map((e) => {
    const probe = en ? e.toLowerCase() : e;
    const trouble = en ? /(bully|snatch|force|kick|betray|divorce|called off|insult|deceive|expose|crash|crisis|misunderstand)/i.test(e) : /欺负|抢|逼|赶|背叛|离婚|退婚|辱|骗|曝光|撞|出事|误会/.test(e);
    const press = en ? /(again|once more|keep|escalat|tighten|force|block|cut off|threat)/i.test(e) : /又|再|继续|步步紧|加码|逼|堵|断|威胁/.test(e);
    const counter = en ? /(fight back|evidence|reveal|take back|counter|win|solve|expose|plan|decide)/i.test(e) : /反击|证据|亮|拿回|反|赢|解|揭|计划|决定/.test(e);
    return { trouble, press, counter };
  });
  const e1 = marks[0]?.trouble, e2 = marks[1]?.press, e3 = marks[2]?.counter;
  const done = [e1, e2, e3].filter(Boolean).length;
  return {
    rule: 'firstThree', dim: en ? 'First-three-episode rhythm' : '前三集节奏', level: done < 2 ? 'P1' : 'P2', hit: [],
    advice: en
      ? 'The first three episodes decide survival: EP1 puts the lead in trouble and hooks (no backstory first); EP2 keeps escalating and builds anticipation; EP3 gives a small counter or a clear hope of one — don’t slow-burn.'
      : '前三集定生死：第1集直接让主角出事、给钩子（别先介绍背景）；第2集继续加压、让观众期待；第3集给一个小反击或明确的反击希望，别慢热。',
    score: Math.round((done / 3) * 100),
  };
}
/* 9. 剧名/一句话“一眼想看”：直接告诉谁被欺负、谁翻身、靠什么逆袭、爽在哪，拒绝散文式标题 */
export function titleLint(title: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = (title || '').trim();
  const hasConflict = en ? /(revenge|rebirth|return|comeback|reclaim|ceo|heiress|divorce|comeuppance|hidden|secret|tycoon|rise)/i.test(t) : /逆袭|复仇|重生|归来|翻身|夺回|总裁|千金|战神|离婚|退婚|打脸|翻盘|替嫁|隐|大佬/.test(t);
  const tooAbstract = t.length > (en ? 60 : 18) || /[，。、；：""'']/.test(t) && !hasConflict;
  return {
    rule: 'title', dim: en ? 'Title at-a-glance appeal' : '剧名一眼想看', level: hasConflict ? 'P2' : 'P1', hit: [],
    advice: en
      ? 'It’s not novelty but at-a-glance appeal: no essayistic, guesswork titles. State directly who is wronged, who rises, by what means, and where the satisfaction is. Answer one line: who cornered the lead and how does she strike back hard?'
      : '拼的不是题材新，是“一眼想看”：标题别写散文、别让观众猜，直接给出“谁被欺负/谁要翻身/靠什么逆袭/爽在哪”。先想通一句话：主角被谁逼到绝路、又靠什么狠狠翻身。',
    score: hasConflict ? 85 : tooAbstract ? 40 : 55,
  };
}
/* 10. 每集三问：想要什么/谁阻拦/为什么追下一集（拆片与自检通用） */
export function threeQLint(episodeText: string, lang: LintLang = 'zh'): { want: boolean; block: boolean; whyNext: boolean; issue: LintIssue } {
  if (lang === 'en') {
    const probe = episodeText.toLowerCase();
    const want = /(want|need|goal|decide to|plan to|must|going to|determined)/i.test(probe);
    const block = /(block|stop|refuse|oppose|rival|boss|mother-in-law|enemy|against|forbid)/i.test(probe);
    const whyNext = /(secret|little did|turns out|but|however|cliffhang|next|suddenly|reveal|mystery|twist)/i.test(probe);
    const missing = [!want && 'Lead goal', !block && 'Blocking force', !whyNext && 'Episode-end hook'].filter(Boolean) as string[];
    return {
      want, block, whyNext,
      issue: {
        rule: 'threeQ', dim: 'Three questions per episode', level: missing.length >= 2 ? 'P1' : 'P2', hit: missing,
        advice: 'Every episode must answer three questions: what the lead wants, who blocks it, and why the viewer must watch the next (end hook / information gap / secret). Missing one and the episode drifts.',
        score: Math.round(((3 - missing.length) / 3) * 100),
      },
    };
  }
  const q = perEpisodeThreeQ(episodeText);
  const missing = [!q.want && '主角目标', !q.block && '阻拦力量', !q.whyNext && '集尾追看钩'].filter(Boolean) as string[];
  return {
    ...q,
    issue: {
      rule: 'threeQ', dim: '每集三问', level: missing.length >= 2 ? 'P1' : 'P2', hit: missing,
      advice: '每集都要答清三问：主角想要什么、谁在阻拦、观众为什么想看下一集（集尾钩子/信息差/秘密）。缺一项这集就容易散。',
      score: Math.round(((3 - missing.length) / 3) * 100),
    },
  };
}
export interface CraftLintResult { issues: LintIssue[]; avg: number; p0: LintIssue[]; p1: LintIssue[]; trackTip?: string }
/** 聚合：一次跑完所有一线尺子；可传赛道给节奏提示 */
export function craftLint(input: { title?: string; text?: string; episodes?: string[]; track?: TrackId; lang?: LintLang }): CraftLintResult {
  const lang: LintLang = input.lang === 'en' ? 'en' : 'zh';
  const text = input.text || (input.episodes || []).join('\n') || '';
  const issues: LintIssue[] = [];
  if (input.title) issues.push(titleLint(input.title, lang));
  if (text) {
    issues.push(villainLint(text, lang), fillerLint(text, lang), novelisticLint(text, lang), dumbPayoffLint(text, lang),
      agencyLint(text, lang), parityLint(text, lang), directnessLint(text, lang));
  }
  if (input.episodes && input.episodes.length) issues.push(firstThreeLint(input.episodes, lang));
  if (text) issues.push(threeQLint(text.slice(0, lang === 'en' ? 2400 : 1200), lang).issue);
  const scored = issues.filter((i) => typeof i.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : 0;
  return {
    issues, avg,
    p0: issues.filter((i) => i.level === 'P0'),
    p1: issues.filter((i) => i.level === 'P1'),
    trackTip: input.track ? TRACK_STRATEGY[input.track].rhythm : undefined,
  };
}
