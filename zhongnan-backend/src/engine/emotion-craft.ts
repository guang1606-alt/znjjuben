/**
 * emotion-craft.ts —— 情绪与爽感“进阶上限”引擎（2026-08 一线编剧视频沉淀）
 * 与 craft-lint 分工：craft-lint 管“过稿红线/基础避坑”，本文件管“情绪密度与爽感上限”。
 * v1.92：全规则中英双语（lang='en' 用英文检测词与 dim/advice），默认中文逐字不变。
 */
import { LintIssue, LintLevel, LintLang } from './craft-lint';
const has = (t: string, words: string[]) => words.filter((w) => t.includes(w));
const count = (t: string, words: string[]) => words.reduce((n, w) => n + (t.split(w).length - 1), 0);
/* ---------- 1. 情绪大纲：每集单一主调 + 观众情绪 + 变化密度 ---------- */
const EMOTION_CLASS: Record<string, string[]> = {
  憋屈虐: ['委屈', '憋屈', '欺负', '辱', '压迫', '陷害', '踩', '忍', '羞辱', '逼'],
  爽: ['打脸', '反击', '翻盘', '解气', '碾压', '跪', '赢', '反杀', '清算', '夺回'],
  甜: ['心动', '脸红', '宠溺', '温柔', '吻', '暖', '笑', '害羞'],
  悬疑: ['秘密', '到底', '究竟', '谜', '隐藏', '谁是', '真相', '伏笔'],
  悲恐: ['哭', '泪', '怕', '绝望', '死', '崩', '颤抖'],
};
const EMOTION_CLASS_EN: Record<string, string[]> = {
  Angst: ['grievance', 'bully', 'humiliat', 'oppress', 'frame', 'step on', 'endure', 'force'],
  Payoff: ['comeuppance', 'fight back', 'turn the tables', 'cathartic', 'crush', 'kneel', 'win', 'reckoning', 'reclaim'],
  Sweet: ['heart flutter', 'blush', 'adore', 'gentle', 'kiss', 'warm', 'smile', 'shy'],
  Mystery: ['secret', 'on earth', 'riddle', 'hidden', 'who is', 'truth', 'foreshadow'],
  Sorrow: ['cry', 'tear', 'afraid', 'despair', 'die', 'break down', 'tremble'],
};
export function emotionOutlineCheck(episodeText: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? episodeText.toLowerCase() : episodeText;
  const classes = en ? EMOTION_CLASS_EN : EMOTION_CLASS;
  const present = Object.entries(classes).filter(([, ws]) => count(probe, en ? ws.map((w) => w.toLowerCase()) : ws) > 0).map(([k]) => k);
  const roleOnly = en ? /she cried|he cried|(he|she) won|was (sad|happy)/i.test(episodeText) : /她哭了|他哭了|男主赢了|女主赢了|她很伤心|他很高兴/.test(episodeText);
  const flat = present.length === 0;
  const tooMixed = present.length >= 4;
  const level: LintLevel = flat ? 'P1' : 'P2';
  return {
    rule: 'emotionOutline', dim: en ? 'Emotion outline' : '情绪大纲', level,
    hit: present,
    advice: tooMixed
      ? (en
        ? `One episode carries ${present.length} emotions (${present.join(', ')}); too many mixed tones confuse viewers. Keep one dominant tone (payoff/sweet/angst/mystery) stated at the top, and arrange an immerse→build→turn/payoff curve.`
        : `一集塞了 ${present.length} 种情绪（${present.join('、')}），主调太杂观众会乱。本集只保留一个情绪主调（爽/甜/憋/悬择一）写在开头，并安排“入戏→蓄力→反转/爽点”的变化曲线。`)
      : (en
        ? 'Write the viewer’s emotion, not the character’s: she cries ≠ the viewer aches, he wins ≠ the viewer feels payoff. Each beat must land what the viewer feels right now — wronged on her behalf, catharsis, or hunger for the counter. If a scene yields none of the four viewer emotions, cut it.'
        : '写的是“观众情绪”不是“角色情绪”：女主哭≠观众心疼，男主赢≠观众爽。每个情绪点都要落到观众此刻是替她委屈、解气、还是想看反击；一段戏若四种观众情绪都给不出，就该删。'),
    score: flat ? 35 : tooMixed ? 55 : roleOnly ? 65 : 88,
  };
}
/* ---------- 2. 爽点三步链路：压 → 站队 → 行动赢（拒绝只写结果） ---------- */
const RESULT_ONLY = ['突然逆袭', '一下子就', '直接赢了', '瞬间翻盘', '一举击败', '从此走上', '轻松解决', '轻轻松松就'];
const RESULT_ONLY_EN = ['suddenly rose', 'in one shot', 'won directly', 'instantly turned', 'easily defeated', 'from then on', 'effortlessly solved'];
export function payoffChainCheck(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const pressure = count(probe, en ? ['bully', 'humiliat', 'oppress', 'snatch', 'force', 'frame', 'step on', 'mock', 'betray', 'kick'] : ['欺负', '辱', '压', '抢', '逼', '陷害', '踩', '嘲讽', '背叛', '赶']);
  const side = count(probe, en ? ['wrongly accused', 'innocent', 'rightfully hers', 'worked hard', 'kind', 'bottom line', 'why should', 'unwilling', 'should have been'] : ['被冤枉', '无辜', '本属于', '努力', '善良', '底线', '凭什么', '不甘心', '本该']);
  const actionWin = count(probe, en ? ['slammed out', 'on the spot', 'counter', 'evidence', 'scheme', 'step by step', 'pulled out', 'exposed', 'calmly', 'record', 'clause'] : ['甩出', '当场', '反手', '证据', '布局', '一步步', '拿出', '揭穿', '淡淡', '记录', '条款']);
  const resultOnly = has(probe, (en ? RESULT_ONLY_EN : RESULT_ONLY).map((w) => (en ? w.toLowerCase() : w)));
  const missing: string[] = [];
  if (pressure === 0) missing.push(en ? 'Press the lead first (who humiliates, how, why she cannot counter yet)' : '先压住主角（写清谁羞辱、怎么压、为何此刻不能反击）');
  if (side === 0) missing.push(en ? 'Make viewers side with the lead (wronged / what is rightfully hers / why she deserves to win)' : '让观众站到主角这边（被冤枉/本属于他/他为什么值得赢）');
  if (actionWin === 0) missing.push(en ? 'Let the lead win back through concrete actions, not by announcing the result' : '让主角用“具体行动”赢回来，而不是宣告结果');
  const onlyResult = resultOnly.length > 0 && pressure === 0;
  return {
    rule: 'payoffChain', dim: en ? 'Payoff chain' : '爽点链路', level: onlyResult || missing.length >= 2 ? 'P1' : 'P2',
    hit: resultOnly,
    advice: onlyResult
      ? (en
        ? 'Only the result (rise/win) is written with no buildup, so viewers feel nothing. Payoff = hold a breath for them first then let her win: ① press the lead ② make viewers side with her (why she deserves it, why the villain deserves it) ③ win back step by step through action. Payoff is built, not shouted.'
        : '只写了“逆袭/赢了”的结果，没写压抑过程，观众无感。爽=先替他憋一口气再让他赢：①压住主角 ②让观众站队（主角为何值得赢、反派为何欠打）③用行动一步步赢回来。爽是前面铺出来的，不是吼出来的。')
      : missing.length
        ? (en
          ? `The three-step payoff is incomplete: ${missing.join('; ')}. Before the comeuppance, show how arrogant the villain is and why the lead deserves to win, or the strike lands empty.`
          : `爽点三步不完整：${missing.join('；')}。打脸前要先写反派多嚣张、主角为何值得赢，否则打脸是空的。`)
        : (en
          ? 'Pressure–alignment–action-win all present; keep payoff scale matched — the longer the hold, the sweeter the win.'
          : '压迫-站队-行动赢三步齐备，保持“憋得越久、赢得越爽”的量级匹配。'),
    score: Math.max(20, Math.min(100, 30 + pressure * 8 + side * 8 + actionWin * 8 - resultOnly.length * 15)),
  };
}
/* ---------- 3. 顶级反派三角：合理动机 + 超前布局 + 人性碎片 ---------- */
export function villainDepthCheck(text: string, hasAntagonist?: boolean, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const autoAntag = en ? /(villain|rival|enemy|antagonist|boss|foe)/i.test(text) : /反派|对手|敌人|恶人|boss|反派|仇人/.test(text);
  if (hasAntagonist === undefined) hasAntagonist = autoAntag;
  const motive = count(probe, en ? ['in order to', 'conviction', 'justice', 'protect', 'revenge', 'ideal', 'believes he', 'original intent', 'hidden pain', 'faith', 'save the world'] : ['为了', '信念', '正义', '保护', '复仇', '理想', '认为自己', '初衷', '苦衷', '信仰', '救世']);
  const plan = count(probe, en ? ['scheme', 'long before', 'plan', 'step by step', 'calculat', 'deliberately showed', 'chessboard', 'pawn', 'waiting for him', 'ahead'] : ['布局', '早已', '计划', '一步步', '算计', '故意露出', '棋局', '棋子', '等着他', '领先']);
  const wound = count(probe, en ? ['back then', 'once', 'wound', 'lost', 'originally', 'also a victim', 'regret', 'unhealable', 'tragedy'] : ['当年', '曾经', '伤口', '失去', '原本', '也是受害者', '遗憾', '无法愈合', '悲剧']);
  const dims = [motive > 0, plan > 0, wound > 0].filter(Boolean).length;
  if (!hasAntagonist) {
    return { rule: 'villainDepth', dim: en ? 'Villain depth' : '反派厚度', level: 'P2', hit: [], advice: en ? 'No antagonist detected in this passage.' : '本段落未识别到反派。', score: 80 };
  }
  const miss: string[] = [];
  if (!motive) miss.push(en ? 'a plausible, even “more righteous than the hero” motive (an idealist true-believer convinced he is right)' : '合理甚至“比主角更正义”的目标/动机（理想主义寻道者，坚信自己没错）');
  if (!plan) miss.push(en ? 'a half-step-ahead scheme (already running at the start; the hero only sees the tip deliberately shown)' : '超前半步的布局（计划开局已启动，主角发现的只是他故意露出的冰山一角）');
  if (!wound) miss.push(en ? 'a shard of humanity (an unhealable wound, twisted yet self-consistent principles that make readers think “in his place…”)' : '人性碎片（无法愈合的伤口、扭曲但自洽的原则，让读者一秒“如果我是他”）');
  return {
    rule: 'villainDepth', dim: en ? 'Villain depth' : '反派厚度', level: dims === 0 ? 'P1' : 'P2', hit: [],
    advice: miss.length
      ? (en
        ? `A top villain = sound motive + ahead-of-curve scheme + shard of humanity; now missing: ${miss.join('; ')}. The more hopeless the villain makes things, the more the hero’s victory is worth; a pure demon is not scary — understanding why he became one is.`
        : `顶级反派三角=合理动机+超前布局+人性碎片，当前缺：${miss.join('；')}。反派越让人绝望，主角胜利的价值翻十倍；纯粹的恶魔不可怕，让人理解他为何成为恶魔才可怕。`)
      : (en
        ? 'Motive/scheme/humanity all present, forming spiritual pressure; avoid degrading into a mere strutting tool villain.'
        : '反派动机/布局/人性碎片齐备，形成精神压制，避免退化为单纯嚣张的工具反派。'),
    score: Math.round((dims / 3) * 100),
  };
}
/* ---------- 4. 权谋“权力语法”三法则 ---------- */
const BLUNT_POWER = ['我要赢', '我要搞', '给我杀', '我要上位', '我要让他死', '我要弄死', '等着瞧我'];
const BLUNT_POWER_EN = ['i will win', 'i will take', 'kill him', 'i will rise', 'i want him dead', 'just you watch'];
export function powerGrammarCheck(text: string, isIntrigue?: boolean, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  if (isIntrigue === undefined) isIntrigue = en ? /(court|palace|business war|power|faction|throne|succession)/i.test(text) : /权谋|宫斗|商战|朝堂|夺嫡|势力/.test(text);
  const blunt = has(probe, (en ? BLUNT_POWER_EN : BLUNT_POWER).map((w) => (en ? w.toLowerCase() : w)));
  const hideSubject = count(probe, en ? ['scheme', 'balance', 'arbiter', 'let them fight', 'sit above', 'not personally', 'borrow the knife', 'two factions'] : ['布局', '制衡', '裁判', '让他们互', '坐在上面', '不亲自', '借刀', '两派']);
  const suspended = count(probe, en ? ['an offer he can’t refuse', 'unresolved', 'lightly', 'did not say', 'blade not drawn', 'gaze', 'placed', 'handed'] : ['无法拒绝', '悬而', '轻轻', '没说', '刀没拔', '眼神', '放在', '递']);
  const conscript = count(probe, en ? ['borrow you', 'let him himself', 'for the greater good', 'willingly', 'be my blade', 'use his own logic', 'conscript'] : ['借你', '让他自己', '为了大局', '无法拒绝', '心甘情愿', '替我', '用他的逻辑', '征用']);
  const laws = [hideSubject > 0, suspended > 0, conscript > 0].filter(Boolean).length;
  if (!isIntrigue) {
    return { rule: 'powerGrammar', dim: en ? 'Power grammar' : '权谋权力语法', level: 'P2', hit: [], advice: en ? 'Not a court/palace/business-war genre; power grammar is optional.' : '非权谋/宫斗/商战题材，权力语法为可选项。', score: 80 };
  }
  return {
    rule: 'powerGrammar', dim: en ? 'Power grammar' : '权谋权力语法', level: blunt.length >= 2 ? 'P1' : 'P2', hit: blunt,
    advice: blunt.length
      ? (en
        ? 'Power players don’t say “I’ll win / I’ll destroy you”. Three laws: ① hide the subject — the ruler never says “I want”, only schemes two factions into fighting while arbitrating; ② forethought — never voice the threat, an unresolved threat is scariest (offer one that cannot be refused); ③ conscript — don’t grab or force, let the other side willingly become your blade using their own logic.'
        : '权谋人物不要张口“我要赢/我要搞死你”。三法则：①主语隐义——上位者不说“我要”，只布局让两派互斗、自己当裁判；②未雨绸缪——狠话不说出口，悬而未决的威胁最吓人（给一个无法拒绝的条件）；③征用——不抢不逼，让对方用他自己的逻辑心甘情愿成为你的刀。')
      : laws < 3
        ? (en
          ? `Power grammar applied ${laws}/3: hide the subject (scheme/balance), forethought (unresolved threat), conscript (let the other complete your aim with their own logic). Top-tier intrigue is “the grammar that defines reality” — not one cruel word, yet domination everywhere.`
          : `权力语法三法则当前用到 ${laws}/3：主语隐义（布局/制衡）、未雨绸缪（悬而未决的威胁）、征用（让对方用自己的逻辑完成你的目的）。顶级权谋是“定义事实的语法”，没有一个字写狠，却处处是支配。`)
        : (en
          ? 'All three laws present; power comes from structure and restraint, not threats. Keep it.'
          : '三法则齐备，权力感靠结构与留白而非狠话，保持。'),
    score: Math.max(30, Math.min(100, laws * 28 + 16 - blunt.length * 12)),
  };
}
/* ---------- 5. 爽感四寄生虫 + 分层见证（拒绝“众人震惊”偷懒） ---------- */
const LAZY_CROWD = ['众人震惊', '全场震惊', '所有人都惊呆了', '大家都惊呆了', '一片震惊', '众人哗然', '全场哗然'];
const LAZY_CROWD_EN = ['everyone was shocked', 'the whole room was stunned', 'all were stunned', 'a collective gasp', 'the crowd erupted'];
export function payoffTaxonomy(text: string, lang: LintLang = 'zh'): { worms: string[]; lazyWitness: string[]; issue: LintIssue } {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const order = en ? /(slowly|step by step|tame|into place|process|gradually|one by one)/i.test(text) : /一丝|慢慢|一步步|驯服|归位|过程|逐渐|逐条/.test(text);
  const contrast = en ? /(hide strength|hidden identity|real identity|nobody knew|on the surface|disguise|down and out|hidden master)/i.test(text) : /扮猪|隐藏身份|真实身份|没人知道|表面上|伪装|马甲|落魄|扫地僧/.test(text);
  const layeredWitness = en ? /(gritted teeth|breath caught|eyes reddened|pupils|stepped back|gasped|clenched|fingernails)/i.test(text) : /(后槽牙|咬碎|呼吸一停|眼眶|核桃|瞳孔|后退|倒吸|攥紧|指甲)/.test(text);
  const breakRule = en ? /(against the odds|of all things|break the rules|flip the table|reckless|go wild|drop the act)/i.test(text) : /不按常理|偏偏|不守规矩|掀桌|不讲道理|横冲直撞|疯|不装了/.test(text);
  const worms = en ? ([
    order && 'Order control (the pleasure of chaos being restored step by step)',
    contrast && 'Identity contrast (drag the high down, lift the low; write the physical reaction at the reveal)',
    layeredWitness && 'Layered recognition (different characters react differently, forming a chorus)',
    breakRule && 'Rule-breaking (safely lose control within a believable world)',
  ].filter(Boolean) as string[]) : [
    order && '秩序控制（写混乱被一步步归位的过程快感）',
    contrast && '身份反差（把高的拽下来、把低的捧上天，写揭晓瞬间的生理反应）',
    layeredWitness && '分层认同（不同角色不同震惊反应组成合唱团）',
    breakRule && '规则破坏（在合理世界里安全地失控、发癫）',
  ].filter(Boolean) as string[];
  const lazyWitness = has(probe, (en ? LAZY_CROWD_EN : LAZY_CROWD).map((w) => (en ? w.toLowerCase() : w)));
  return {
    worms, lazyWitness,
    issue: {
      rule: 'payoffTaxonomy', dim: en ? 'Payoff taxonomy' : '爽感类型学', level: lazyWitness.length ? 'P1' : 'P2', hit: lazyWitness,
      advice: lazyWitness.length
        ? (en
          ? 'Don’t lazily write “everyone was shocked” — awe must be amplified in layers by different people: the rival grinds teeth until blood shows but dares not spit; the love interest’s breath catches first, eyes reddening; the elder’s ten-year-old walnut cracks. Each different shocked face scratches a different itch, making payoff three-dimensional.'
          : '别用“众人震惊/全场惊呆了”偷懒——读者的惊叹需要被不同的人“分层放大”：死对头是后槽牙咬碎、血丝渗出却不敢吐；红颜是呼吸先停、眼眶发红；老者是盘了十年的核桃啪地裂开。每张不同的震惊脸挠不同的痒处，爽感才立体轰鸣。')
        : (en
          ? `Payoff is a 3D emotion system; ${worms.length}/4 parasites used (order control / identity contrast / layered recognition / rule-breaking). Face-slapping is only the surface; add process pleasure, contrast physiology, layered witnesses or safe rule-breaking by genre.`
          : `爽是立体情绪系统，当前用到 ${worms.length}/4 条情绪寄生虫（秩序控制/身份反差/分层认同/规则破坏）。装逼打脸只是最表层，按题材补过程快感、反差生理反应、分层见证或安全破坏欲。`),
      score: Math.max(30, Math.min(100, worms.length * 22 + (lazyWitness.length ? 0 : 20))),
    },
  };
}
/* ---------- 6. 前10集留存 ---------- */
export function earlyRetention(episodes: string[], lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const eps = (episodes || []).slice(0, 10);
  if (!eps.length) return { rule: 'earlyRetention', dim: en ? 'First-10 retention' : '前10集留存', level: 'P2', hit: [], advice: en ? 'No episode content.' : '无分集内容。', score: 70 };
  let bgOnly = 0; let noHook = 0;
  eps.forEach((e, i) => {
    const trouble = en ? /(bully|snatch|force|kick|betray|divorce|called off|insult|deceive|expose|crash|crisis|misunderstand|fire|debt)/i.test(e) : /欺负|抢|逼|赶|背叛|离婚|退婚|辱|骗|曝光|撞|出事|误会|裁|债/.test(e);
    const want = en ? /(want|need|goal|reclaim|prove|leave|fight back|take back|rise)/i.test(e) : /要|想|目标|夺回|证明|离开|反击|拿回|翻身/.test(e);
    const isBg = en ? /(background|grew up|for years|origin|introduc|came from|all along)/i.test(e) && !trouble : /背景|从小|多年来|身世|介绍|原来.*?出身|一直以来/.test(e) && !trouble;
    if (isBg && i < 3) bgOnly++;
    if (!trouble && !want) noHook++;
  });
  const level: LintLevel = bgOnly > 0 ? 'P1' : noHook >= 2 ? 'P1' : 'P2';
  return {
    rule: 'earlyRetention', dim: en ? 'First-10 retention' : '前10集留存', level, hit: [],
    advice: bgOnly
      ? (en
        ? 'Spending the first 3 episodes on backstory/origin drives viewers away. The first-10 job is not to explain but to grab: every episode shows the lead’s trouble, goal, and why watch her rise; give a goal right after the wrong (fight/leave/prove/reclaim) and end each episode on a small hook.'
        : '前3集还在铺背景/讲身世=劝退。前10集的任务不是讲清楚而是抓住：每集让观众知道“主角遇到什么麻烦、想要什么、为什么要看他翻身”，被欺负后立刻给目标（反击/离开/证明/拿回），每集结尾留小钩子。')
      : noHook
        ? (en
          ? `${noHook} of the first 10 episodes have neither trouble nor a clear goal. Conflict and choices must be fast, every episode ends on a hook — short drama won’t wait for you to get good slowly.`
          : `前10集有 ${noHook} 集既无麻烦也无明确目标，冲突要快、选择要快、集集尾钩，短剧不等你慢慢好看。`)
        : (en ? 'Trouble/goal/watch-hook are on across the first 10; keep the pace fast.' : '前10集麻烦/目标/追看钩在线，保持快节奏。'),
    score: Math.max(20, 100 - bgOnly * 25 - noHook * 8),
  };
}
/* ---------- 7. 圣母化（过度善良、反派不付代价） ---------- */
export function sainthoodCheck(text: string, lang: LintLang = 'zh'): LintIssue {
  const en = lang === 'en';
  const probe = en ? text.toLowerCase() : text;
  const forgive = count(probe, en ? ['let it go', 'forgive him', 'spare him', 'return good for evil', 'also pitiful', 'no need to pursue', 'softened and let', 'magnanimous'] : ['算了', '原谅他', '放他一马', '以德报怨', '也是可怜', '不必追究', '心软放过', '不跟你计较', '大度']);
  const price = count(probe, en ? ['pay the price', 'punished', 'reap what', 'jail', 'bankrupt', 'karma', 'pressed charges', 'ruined reputation', 'never dare again'] : ['付出代价', '受到惩罚', '自食', '坐牢', '破产', '报应', '立案', '身败名裂', '再也不敢']);
  const bad = forgive > 0 && price === 0;
  return {
    rule: 'sainthood', dim: en ? 'Lead sainthood' : '主角圣母化', level: bad ? 'P1' : 'P2', hit: [],
    advice: bad
      ? (en
        ? 'Boundless forgiveness with the villain paying no price leaves the viewer’s held breath unredeemed (“excessive kindness” is the original sin of payoff). Kindness is allowed, but it must have teeth: forgiveness only after the villain has paid an equal price, otherwise it is indulgence and viewers drop the show.'
        : '主角无底线原谅、反派没付代价=观众憋的气没兑付（“过度善良”是爽感原罪）。可以善良，但善良要带牙齿：原谅必须建立在反派已付出对等代价之后，否则就是纵容，观众会弃剧。')
      : (en ? 'Kindness and counter are roughly balanced; keep “kind but not weak”.' : '善良与反击的尺度基本平衡，保持“善良但不软弱”。'),
    score: bad ? 35 : 88,
  };
}
export interface EmotionCraftResult { issues: LintIssue[]; avg: number; p1: LintIssue[] }
export function emotionCraftLint(input: { text?: string; episodes?: string[]; isIntrigue?: boolean; lang?: LintLang }): EmotionCraftResult {
  const lang: LintLang = input.lang === 'en' ? 'en' : 'zh';
  const text = input.text || (input.episodes || []).join('\n') || '';
  const issues: LintIssue[] = [];
  if (text) {
    issues.push(payoffChainCheck(text, lang), villainDepthCheck(text, undefined, lang), powerGrammarCheck(text, input.isIntrigue, lang),
      payoffTaxonomy(text, lang).issue, sainthoodCheck(text, lang));
  }
  (input.episodes || []).slice(0, 10).forEach((e) => issues.push(emotionOutlineCheck(e, lang)));
  if (input.episodes && input.episodes.length) issues.push(earlyRetention(input.episodes, lang));
  const scored = issues.filter((i) => typeof i.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : 0;
  return { issues, avg, p1: issues.filter((i) => i.level === 'P1') };
}
