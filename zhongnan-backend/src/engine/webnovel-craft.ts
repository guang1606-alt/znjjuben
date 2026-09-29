/**
 * webnovel-craft.ts —— 网文技法向短剧的可迁移结构引擎（2026-08，26条视频沉淀）
 * 只收“可执行、可检验、且与短剧不冲突”的结构技法；纯理念（如“用血压写”）不做成校验。
 * v1.93：全规则中英双语（lang='en' 用英文检测词与 dim/advice），默认中文逐字不变。
 */
import { LintIssue, LintLevel, LintLang } from './craft-lint';
const has = (t: string, ws: string[]) => ws.filter((w) => t.includes(w));
const count = (t: string, ws: string[]) => ws.reduce((n, w) => n + (t.split(w).length - 1), 0);
/* 1. 断章点质量：卡在“报应降临前1秒”，而不是“开打前放狠话” */
const FAKE_CLIFF = ['今天就是你的死期', '拿命来', '你找死', '受死吧', '纳命来', '我要动手了', '准备受死', '你完了'];
const FAKE_CLIFF_EN = ['today you die', 'prepare to die', 'you’re dead', 'say your prayers', 'i’m going to kill you'];
const REAL_CLIFF = ['免死', '特权', '背后', '密信', '更大的', '原来', '谁知', '竟然', '秘密', '身份', '证据', '底牌', '刚要', '就在这时'];
const REAL_CLIFF_EN = ['immunity', 'privilege', 'behind', 'secret letter', 'bigger', 'turns out', 'little did', 'secret', 'identity', 'evidence', 'trump card', 'just as', 'at that moment'];
export function cliffhangerQuality(endingText: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? (endingText || '').toLowerCase().slice(-240) : (endingText || '').slice(-120);
  const fake = has(probe, (en ? FAKE_CLIFF_EN : FAKE_CLIFF).map((w) => (en ? w.toLowerCase() : w)));
  const real = has(probe, (en ? REAL_CLIFF_EN : REAL_CLIFF).map((w) => (en ? w.toLowerCase() : w)));
  const level: LintLevel = fake.length && !real.length ? 'P1' : 'P2';
  return {
    rule: 'cliffhanger', dim: en ? 'Episode-end cliffhanger' : '集尾断章点', level, hit: fake,
    advice: fake.length && !real.length
      ? (en
        ? 'Cutting on “today you die / prepare to die” before a fight annoys viewers (emotion not yet maxed). Correct cut: press the real-world pain to its extreme first (the smug villain flashes immunity), then cut one second before reckoning, at the instant the lead moves. Formula = pain pushed to the limit + one second before payoff.'
        : '断在“今天就是你死期/受死吧”这种开打前=恶心观众（情绪还没压满）。正确断法：先把现实痛点压到极致（反派嚣张掏出免死金牌），在报应降临前1秒、主角出手的一瞬断开。公式=现实痛点极致投射+报应前1秒。')
      : real.length
        ? (en ? 'Cut one second before reckoning / as a bigger secret drops; the open-loop anxiety holds. Keep it.' : '断在报应前1秒/更大秘密抛出的位置，未完成焦虑成立，保持。')
        : (en ? 'The ending lacks a strong cut-point: snatch the “bowl away” at the emotional peak to create open-loop anxiety; don’t wrap a matter up head to tail.' : '集尾缺强断章点：在情绪最高点把“碗端走”，制造未完成焦虑，别把一件事首尾交代干净。'),
    score: fake.length && !real.length ? 35 : real.length ? 90 : 60,
  };
}
/* 2. 金手指必须带等价代价，拒绝新手大礼包 */
export function goldenFingerCost(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const hasGift = en ? /(system|cheat ability|golden finger|panel|superpower|rebirth gift|hud)/i.test(text) : /系统|金手指|外挂|面板|异能|重生金手指|超能力/.test(text);
  if (!hasGift) return { rule: 'goldenFinger', dim: en ? 'Cheat ability & its cost' : '金手指代价', level: 'P2', hit: [], advice: en ? 'No cheat ability / system detected.' : '未识别到金手指/系统设定。', score: 80 };
  const cost = count(probe, en ? ['lifespan', 'overdraw', 'price', 'backlash', 'sacrifice', 'each time', 'shorten life', 'tightrope', 'mortgage', 'exchange', 'already priced'] : ['寿命', '透支', '代价', '反噬', '献祭', '每次', '折寿', '走钢丝', '抵押', '交换', '暗中标好']);
  const freebie = has(probe, (en ? ['starter pack', 'free reward', 'no cost', 'effortlessly gained', 'handed directly'] : ['新手大礼包', '免费获得', '无代价', '轻松获得', '直接送']).map((w) => (en ? w.toLowerCase() : w)));
  const bad = cost === 0;
  return {
    rule: 'goldenFinger', dim: en ? 'Cheat ability & its cost' : '金手指代价', level: bad ? 'P1' : 'P2', hit: freebie,
    advice: bad
      ? (en
        ? 'A cheat ability must not be a gift-dispensing vending machine. Give it an equivalent exchange (half a lifespan, overdraw on every use) and seed a three-layer conspiracy (“every reward is secretly priced”). The steeper the cost, the more compelling the will it takes to wield it.'
        : '金手指不能是发礼包的客服机。给它等价交换的代价（如用一半寿命换、每次使用都透支），并可埋“系统每次奖励都暗中标价”的三层阴谋；代价越狠，主角驾驭它的疯狂意志越有魅力。')
      : (en ? 'The cheat carries cost/backlash and every use is a tightrope; tension holds. Keep it.' : '金手指带代价/反噬，使用即走钢丝，悬念成立，保持。'),
    score: bad ? (freebie.length ? 30 : 45) : Math.min(100, 60 + cost * 12),
  };
}
/* 3. 用绝境选择立人，而不是堆形容词 */
const TELL_ADJ = ['杀伐果断', '冷酷无情', '重情重义', '眼神冰冷', '冷酷', '果决', '心狠手辣', '气场强大', '不怒自威'];
const TELL_ADJ_EN = ['ruthlessly decisive', 'cold and ruthless', 'loyal to a fault', 'icy gaze', 'cold-hearted', 'resolute', 'vicious', 'powerful aura', 'commanding presence'];
export function showByChoice(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const adj = has(probe, (en ? TELL_ADJ_EN : TELL_ADJ).map((w) => (en ? w.toLowerCase() : w)));
  const dilemma = en ? /(or else|either|forced|desperate|choose between|with (his|her) own hands|had no choice|gritted teeth|eyes closed|even .*? had to)/i.test(text) : /还是|要么|要么|逼|绝境|二选一|亲手|不得不|咬着牙|闭眼|连.*?都/.test(text);
  const extremeAction = count(probe, en ? ['on the spot', 'with his own hands', 'turned and', 'without hesitation', 'directly', 'flip', 'smash', 'sever'] : ['一剑', '当场', '亲手', '转身就', '毫不犹豫', '直接', '掀', '砸', '斩断']) >= 1;
  const bad = adj.length >= 2 && !dilemma;
  return {
    rule: 'showByChoice', dim: en ? 'Character through choices' : '以选择立人设', level: bad ? 'P1' : 'P2', hit: adj,
    advice: bad
      ? (en
        ? '“Ruthlessly decisive / cold-hearted” are adjectives readers won’t buy. Throw the character into a two-way dilemma and define them by choices and actions under extreme pressure (ruthless to enemies, harsher to self), leaving a sliver of humanity after the extreme act. Build character through action; adjectives are only seasoning.'
        : '“杀伐果断/冷酷无情”是形容词，读者不信。把角色扔进两难绝境，用极端压力下的选择和动作立人（对敌人狠、对自己更狠），可在极端行动后留一丝人性温情。用行动立人设，形容词只做点缀。')
      : dilemma || extremeAction
        ? (en ? 'Character is shown through action/choices rather than labels. Keep it.' : '有用行动/抉择呈现人物，避免只贴标签，保持。')
        : (en ? 'Give a key character a “choice under desperation” scene — it establishes them better than any personality description.' : '关键人物建议补一场“绝境中的选择”戏，比任何性格描述都立得住。'),
    score: bad ? 40 : dilemma ? 88 : 65,
  };
}
/* 4. 人设情绪提款铁三角：现实特权反派 + 被摧毁的老实人 + 降维清算主角 */
export function characterEcosystem(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const privileged = count(probe, en ? ['steal credit', 'rich heir', 'privilege', 'connections', 'back door', 'nepotism hire', 'supervisor', 'boss', 'domineering', 'backer', 'power'] : ['抢功劳', '富二代', '特权', '关系', '走后门', '关系户', '主管', '老板', '跋扈', '靠山', '权势']);
  const honestVictim = count(probe, en ? ['honest', 'hard-working', 'diligent', 'ordinary', 'worked hard', 'law-abiding', 'wage worker', 'shouldered everything', 'thought they had'] : ['老实', '兢兢业业', '普通', '努力', '安分', '打工', '任劳任怨', '本以为']);
  const payoffHit = count(probe, en ? ['reckoning', 'smash', 'take back', 'fight back', 'expose', 'uproot', 'turn the tables', 'make .*? pay the price'] : ['清算', '砸', '拿回', '反击', '揭穿', '连根拔起', '翻盘', '让.*?付出代价']);
  const dims = [privileged > 0, honestVictim > 0, payoffHit > 0].filter(Boolean).length;
  return {
    rule: 'charEcosystem', dim: en ? 'Character emotional triangle' : '人设情绪铁三角', level: 'P2', hit: [],
    advice: dims < 3
      ? (en
        ? `The most profitable character ecosystem = a privileged real-world antagonist (stitches real unfairness into hatred) + a destroyed honest underdog (most like the viewer, ignites grievance) + a lead who settles scores dimensionally (avenges for the viewer when rules won’t). Only ${dims}/3 present — add real-world specificity and payoff.`
        : `最赚钱的人设生态=现实特权反派（缝合现实不公拉仇恨）+ 被摧毁的老实人配角（最像观众、引爆委屈）+ 降维清算的主角（规矩管不了时替观众完成复仇）。当前仅具备 ${dims}/3，补齐现实针对性与清算爽感。`)
      : (en ? 'The privileged antagonist stokes hatred, the honest underdog ignites grievance, the lead settles scores — the emotional withdrawal chain is complete.' : '特权反派拉仇恨、老实人引爆委屈、主角降维清算，情绪提款链路完整。'),
    score: Math.round((dims / 3) * 100),
  };
}
/* 5. 终局倒推大纲：先锁终极高潮，再步步倒推前置条件，避免顺写卡文 */
export function backcastOutline(outline: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const t = en ? (outline || '').toLowerCase() : (outline || '');
  const hasEnding = en ? /(finale|final|ultimate|ending|climax|reach the top|become)/i.test(t) : /大结局|终局|最终|结局|最高潮|登顶|成为/.test(t);
  const causal = count(t, en ? ['because', 'in order to', 'need', 'must', 'to be able', 'so', 'precondition', 'obtain', 'infiltrate', 'thereby'] : ['因为', '为了', '需要', '必须', '才能', '于是', '前提', '拿到', '潜伏', '借此']);
  const flat = en ? /(then|the next day|afterward|later)/i.test(t) : /然后|接着|第二天|后来|之后/.test(t);
  const bad = !hasEnding || causal < 2;
  return {
    rule: 'backcast', dim: en ? 'Ending-backcast outline' : '大纲终局倒推', level: bad ? 'P1' : 'P2', hit: [],
    advice: bad
      ? (en
        ? 'Writing forward leads to dead ends and a choppy log. Lock the ultimate climax first, then backcast step by step: how the lead pulls it off → what they need → how to get it → what the opening wound is, so every scene serves the ending in a closed causal loop.'
        : '顺着写容易走进死胡同、满篇流水账。先死死锁定终极高潮画面，再步步倒推“主角凭什么做到→需要什么→怎么得到→开局痛点是什么”，让每个情节都为终局铺路，形成逻辑闭环。')
      : (en ? 'A clear ending with a front-loaded causal chain matches ending-backcast; keep the logic airtight.' : '有明确终局且因果前置链清晰，符合终局倒推，保持逻辑严丝合缝。'),
    score: Math.max(30, Math.min(100, (hasEnding ? 40 : 0) + causal * 12 + (flat ? -10 : 8))),
  };
}
/* 6. 情绪债链：一次兑付后立刻抛出更大的不公（新债盖旧债），别把读者喂太饱 */
export function emotionDebtChain(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const payoff = count(probe, en ? ['avenged', 'got revenge', 'took down', 'won', 'succeeded', 'reclaimed', 'settled'] : ['报了仇', '大仇得报', '砍死', '拿下', '赢了', '成功', '夺回', '清算完']);
  const biggerDebt = count(probe, en ? ['secret letter', 'behind', 'bigger', 'only turned out', 'the real', 'mastermind', 'never expected', 'someone else', 'a bigger game', 'cover up'] : ['密信', '背后', '更大的', '原来只是', '真正的', '幕后', '没想到', '另有', '一盘大棋', '掩盖']);
  const endsFull = payoff > 0 && biggerDebt === 0;
  return {
    rule: 'debtChain', dim: en ? 'Emotional debt chain' : '情绪债链', level: 'P2', hit: [],
    advice: endsFull
      ? (en
        ? 'If suspense resets to zero after one payoff, readers leave “full”. The instant an old score is settled, drop a bigger injustice (a secret letter falls from the enemy — someone else is behind it): new debt covers old so the pull never breaks.'
        : '一次兑付后若悬念归零，读者就“吃饱离开”。在兑现旧仇的瞬间抛出更大的不公（如仇人怀里掉出密信，背后另有主使），新债盖旧债，让追看欲不断档。')
      : (en ? 'Payoff and new hooks connect well; the emotional debt keeps rolling. Keep it.' : '兑付与新钩子衔接得当，情绪债滚动，保持。'),
    score: endsFull ? 55 : 85,
  };
}
/* 7. 死亡催泪：死亡本身不值钱，遗憾（未来债+痕迹债）才催泪 */
export function deathEmotion(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  if (!(en ? /(die|died|death|passed away|sacrific|gone|killed)/i.test(text) : /死|去世|牺牲|离世|没了/.test(text))) return { rule: 'death', dim: en ? 'Death as tear-jerker' : '死亡催泪', level: 'P2', hit: [], advice: en ? 'No death scene detected.' : '未识别到死亡场景。', score: 80 };
  const gory = has(probe, (en ? ['pierced by arrows', 'severed hand', 'coughed blood', 'last words', 'stabbed repeatedly', 'gruesome death', 'bloodied'] : ['万箭穿心', '断手', '吐血', '遗言', '身中数刀', '惨死', '血肉模糊']).map((w) => (en ? w.toLowerCase() : w)));
  const futureDebt = count(probe, en ? ['promise', 'was going to', 'tomorrow', 'agreed', 'we said', 'once .*? then', 'blossom', 'kite', 'commitment'] : ['答应', '本来', '明天', '约定', '说好', '等.*?就', '桃花', '风筝', '承诺']);
  const traceDebt = count(probe, en ? ['instinctively', 'out of habit', 'set an extra', 'never again', 'as usual', 'empty', 'no one answered', 'routine'] : ['下意识', '习惯性', '多摆', '再也', '照常', '空了', '没有人回答', '惯性']);
  const regret = futureDebt + traceDebt;
  const bad = regret === 0;
  return {
    rule: 'death', dim: en ? 'Death as tear-jerker' : '死亡催泪', level: bad ? 'P1' : 'P2', hit: gory,
    advice: bad
      ? (en
        ? 'Readers don’t cry at a corpse’s gore. Owe two emotional debts before the death: ① future debt — first give the most ordinary hope (“I’ll fly kites with my daughter when the blossoms open”), then tear it up in front of them; ② trace debt — after death write the quiet routine (mother instinctively sets an extra bowl, calls “I’m home” to silence). Formula = most ordinary hope + an abrupt quiet stop.'
        : '读者不会为一具尸体的惨状流泪。死亡前欠下两笔情绪债：①未来债——先给一个最平凡的期待（答应桃花开了就带女儿放风筝），再当面撕碎；②痕迹债——死后写安静的惯性（母亲下意识多摆一副碗筷、推门喊我回来了再无人应）。公式=最平凡期待+戛然而止的安静。')
      : (en ? 'Uses future-debt/trace-debt to earn grief rather than gore. Keep it.' : '用“未来债/痕迹债”制造遗憾催泪，而非渲染血腥，保持。'),
    score: bad ? 40 : Math.min(100, 55 + regret * 15),
  };
}
/* 8. 灵魂共犯：搭档/女主不是花瓶，而是道德盲区+提前半步+共享深渊 */
const VASE = ['好棒', '哥哥你', '我好怕', '躲在.*?身后', '花瓶', '嘤嘤', '你真厉害', '别丢下我'] as string[];
const VASE_EN = ['you’re amazing', 'i’m so scared', 'hid behind', 'arm candy', 'don’t leave me'] as string[];
export function partnerInCrime(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const vase = (en ? VASE_EN : VASE).filter((p) => new RegExp(en ? p.toLowerCase() : p).test(probe));
  const accomplice = count(probe, en ? ['hand', 'way out', 'ahead of', 'right or wrong', 'accomplice', 'secret', 'already .*? handled', 'exchanged a look', 'executioner', 'block'] : ['递', '退路', '提前', '不问对错', '共犯', '秘密', '已经.*?处理', '相视', '刽子手', '挡住']);
  const bad = vase.length >= 1 && accomplice === 0;
  return {
    rule: 'partner', dim: en ? 'Partner / co-lead depth' : '搭档/女主深度', level: 'P2', hit: vase,
    advice: bad
      ? (en
        ? 'A vase partner who only says “you’re amazing / I’m scared” breaks immersion. Write a “partner in crime”: takes your side regardless of right and wrong (hands you the knife), cuts off the exit half a step ahead, and shares one fragile secret only the two of you know.'
        : '只会喊“好棒/哥哥”的花瓶搭档让人出戏。写成“灵魂共犯”：不问对错地站边（你想杀谁我递刀）、提前半步替对方切断退路、共享一个只有彼此知道的脆弱秘密。')
      : accomplice ? (en ? 'The partner has conspiring agency and emotional depth, not an ornament. Keep it.' : '搭档具备共谋能力与情感纵深，不是挂件，保持。')
        : (en ? 'If there is an important partner, give them independent agency and a co-conspirator bond rather than a protected-object role.' : '若有重要搭档，建议赋予其独立行动力与共谋关系，而非被保护对象。'),
    score: bad ? 45 : accomplice ? 88 : 65,
  };
}
export interface WebnovelLintResult { issues: LintIssue[]; avg: number; p1: LintIssue[] }
export function webnovelLint(input: { text?: string; outline?: string; ending?: string; lang?: LintLang }): WebnovelLintResult {
  const lang: LintLang = input.lang === 'en' ? 'en' : 'zh';
  const text = input.text || '';
  const issues: LintIssue[] = [];
  if (input.ending) issues.push(cliffhangerQuality(input.ending, lang));
  if (text) {
    issues.push(goldenFingerCost(text, lang), showByChoice(text, lang), characterEcosystem(text, lang),
      emotionDebtChain(text, lang), deathEmotion(text, lang), partnerInCrime(text, lang));
  }
  if (input.outline) issues.push(backcastOutline(input.outline, lang));
  const scored = issues.filter((i) => typeof i.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : 0;
  return { issues, avg, p1: issues.filter((i) => i.level === 'P1') };
}
