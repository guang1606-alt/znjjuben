/**
 * 甜宠/虐恋情感节拍机制引擎（v2.10）
 * ------------------------------------------------------------------
 * 第五套“类型机制引擎”（喜剧/悬疑/文旅/穿书之后）。情感剧 AI 通病：关系跳步、误会硬拖、
 * 为虐而虐、工业糖精、靠台词说“我爱你”而非行动。本模块沉淀 10 套情感节拍装置（机理+技法+风险），
 * 自动识别言情/甜宠/虐恋意图并下发给架构师/编剧岗；非情感剧返回空串。纯函数、确定性、双语。
 */
export type RomanceLang = 'zh' | 'en';
export interface RomanceDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const ROMANCE_DEVICES: RomanceDevice[] = [
  {
    id: 'heart_ladder', name: '心动阶梯', nameEn: 'Heartbeat ladder',
    principle: '感情只能一阶一阶升温，每一次靠近都让观众明确“关系又进了一步”，跳步则工业糖精', principleEn: 'Feelings advance one rung at a time; each step closer must read clearly — skipping rungs feels artificial',
    technique: '开局先定关系起点与终点，中间排一条可见的升温阶梯（注意→好奇→试探→心动→在意→确认→相守），每 2-3 集只上一级并用一个具体事件承载，越级必须有强事件催化', techniqueEn: 'Fix the relationship start and end, then lay a visible ladder (notice → curious → testing → flutter → care → confirm → commit); climb only one rung every 2–3 episodes via one concrete event, with a strong catalyst for any leap',
    risk: '一上来就深爱、靠 BGM 硬凑都不可信；每一级都要有行为证据', riskEn: 'Instant deep love or music-masked bonding is unconvincing; each rung needs behavioral evidence',
    kw: ['心动', '升温', '感情线', '阶梯', 'fall for', 'chemistry build', 'slow burn', 'develop feelings'],
  },
  {
    id: 'push_pull', name: '极限拉扯', nameEn: 'Push-pull tension',
    principle: '靠近与退缩交替制造张力，观众追的是“到底什么时候在一起”的悬而未决', principleEn: 'Alternating approach and withdrawal creates tension; viewers chase the unresolved “when will they get together”',
    technique: '用“进一步—外部或内心阻碍退半步”的节律推进：每次靠近后给一个合理的退缩理由（责任、误会、身份），退缩时留一个舍不得的小动作，让希望不断绝；拉扯次数有上限，临近确认减少退缩', techniqueEn: 'Use a step-forward / half-step-back rhythm: after each approach give a sound reason to pull back (duty, misunderstanding, status), but leave one reluctant micro-action so hope survives; cap the cycles and reduce withdrawal near confirmation',
    risk: '为拉扯而反复横跳会让角色显得渣/作；每次退缩动机必须成立', riskEn: 'Endless back-and-forth makes a character seem toxic; every withdrawal needs a valid motive',
    kw: ['拉扯', '推拉', '欲擒故纵', '暧昧', 'push pull', 'tension', 'will they', 'ambiguous'],
  },
  {
    id: 'mis_ceiling', name: '误会不过夜', nameEn: 'Misunderstanding has a ceiling',
    principle: '情感剧可以有误会，但不能靠“就是不听解释”硬拖，误会长度与烈度必须受控', principleEn: 'Romance allows misunderstanding, but not a refusal-to-listen drag; its length and intensity must be controlled',
    technique: '误会当集或次集给一次解释机会，阻碍解释的是信息结构（没碰上、被第三方打断、有难言之隐）而非角色降智；解开时让双方各自承担一部分责任，避免一方全错', techniqueEn: 'Offer a chance to clarify within the episode or next; block clarification through information structure (missed timing, third-party interruption, a secret), not stupidity; on resolution assign each side some responsibility',
    risk: '超过三集的低级误会招黑；不能用“你听我解释/我不听”凑时长', riskEn: 'A low-level misunderstanding past three episodes alienates viewers; never pad runtime with “let me explain / I won’t listen”',
    kw: ['误会', '解释', '误解', 'misunderstand', 'miscommunication', 'clear the air', 'false assumption'],
  },
  {
    id: 'crush_gap', name: '暗恋视角差', nameEn: 'Secret-crush POV gap',
    principle: '让观众比剧中一方更早知道心意，全知视角制造“替他着急”的高甜与高虐', principleEn: 'Let the audience know the feelings before one character does; omniscience creates sweet-anxious and painful anticipation',
    technique: '用镜头/独白/细节只对观众揭示一方心意（偷看、下意识维护、记得小事），另一方误读成友情/责任；在关键节点让观众以为要戳破又收住，最后由一个积累已久的细节引爆表白', techniqueEn: 'Reveal one side’s feelings only to the audience (glances, instinctive protection, remembering small things) while the other misreads it as friendship; near a reveal pull back, then detonate the confession through a long-accumulated detail',
    risk: '视角差不能建立在一方迟钝到失真；细节要前后一致', riskEn: 'The gap cannot rely on implausible denseness; details must stay consistent',
    kw: ['暗恋', '单向', '默默守护', '心意', 'secret crush', 'unrequited', 'pining', 'hidden feelings'],
  },
  {
    id: 'jealous_bound', name: '吃醋与占有边界', nameEn: 'Jealousy with boundaries',
    principle: '适度吃醋是在意的证明、是糖；越界成控制与 PUA 就是雷点，必须划线', principleEn: 'Light jealousy proves care and is sweet; crossing into control or manipulation is a red flag — draw the line',
    technique: '吃醋用“嘴硬+小动作”表现（阴阳怪气一句、默默清掉情敌机会），随后用主动沟通或自我克制收尾；明确区分“在乎”与“限制社交/查岗/否定价值”，后者要被剧情当作问题指出并改正', techniqueEn: 'Show jealousy through gruff words plus small actions (a sarcastic line, quietly removing a rival’s opening), then resolve by communication or self-restraint; clearly separate caring from controlling social life, surveillance or belittling — the story must flag and correct the latter',
    risk: '绝不能把控制欲、跟踪、精神操控包装成“深情/霸总魅力”', riskEn: 'Never package control, stalking or manipulation as “deep love / CEO charm”',
    kw: ['吃醋', '占有', '醋意', '情敌', 'jealous', 'possessive', 'rival', 'envy'],
  },
  {
    id: 'sweet_knife', name: '糖刀配比', nameEn: 'Sweet-to-angst ratio',
    principle: '先给够糖，刀才疼；先虐够，甜才爽。甜虐需要被设计成有比例的曲线而非随机', principleEn: 'Earn the knife with enough sweetness first, and the sweetness with enough pain; design sweet/angst as a ratio curve, not randomness',
    technique: '排一张情感节拍表：高甜后紧跟的刀要回扣之前的糖（同一细节由暖变刺），大虐之前至少铺垫两段甜；单集内部也做“小甜—小挫—回暖”的呼吸，避免全程发刀或全程工业撒糖', techniqueEn: 'Chart an emotional beat sheet: the knife after high sweetness callbacks an earlier sweet detail (warm turns sharp); lay at least two sweet beats before a big angst; within each episode do small-sweet / small-setback / warm-up so it is neither all pain nor all saccharine',
    risk: '没糖铺垫的虐是无病呻吟，没冲突的糖会腻；比例失衡观众弃剧', riskEn: 'Angst without sweet setup feels hollow; sweetness without conflict bores; imbalance causes drop-off',
    kw: ['糖刀', '先甜后刀', '虐中带甜', '高甜', 'sweet angst', 'fluff and hurt', 'bittersweet', 'angst ratio'],
  },
  {
    id: 'angst_three', name: '虐点三拍', nameEn: 'Three-beat angst',
    principle: '有效虐点=误解/压力（起因）—具体伤害（爆发）—真相/代价（收束），缺一拍都是为虐而虐', principleEn: 'Effective angst = pressure/misunderstanding (cause) → concrete hurt (burst) → truth/cost (close); missing a beat is angst for its own sake',
    technique: '先让观众理解双方各自的处境与难处（上帝视角），伤害场景要具体到一句话/一个动作而非泛泛争吵，收束拍给出真相或让一方付出可见代价；虐点推动人物成长或关系认知，不能原地打转', techniqueEn: 'First let the audience understand both sides (omniscience); make the hurt concrete (one line, one action) rather than vague arguing; the closing beat reveals truth or extracts a visible cost; angst must drive growth or new understanding, not loop in place',
    risk: '靠绝症、车祸、家仇等强塞悲剧属于廉价虐；伤害不能违背已立人设', riskEn: 'Cheap tragedies (terminal illness, crash, family feud out of nowhere) feel manipulative; hurt must not betray established character',
    kw: ['虐点', '虐恋', '伤害', '破防', 'angst', 'hurt comfort', 'emotional blow', 'heartbreak'],
  },
  {
    id: 'reunion', name: '破镜重圆修复', nameEn: 'Reunion & repair',
    principle: '复合不是一句“我原谅你”，裂痕必须被正视、道歉要有具体行动、信任要重新挣回', principleEn: 'Reunion is not one line of forgiveness; the crack must be faced, the apology acted out, and trust re-earned',
    technique: '分开阶段让双方各自成长并暴露上次分手的真正问题；重逢后不立刻复合，先用 2-3 个事件证明改变（说到做到、改掉旧毛病），复合仪式回扣定情信物/承诺，完成情感闭环', techniqueEn: 'During separation let both grow and expose the real cause of the breakup; after reunion do not reconcile instantly — prove change over 2–3 events (words matched by action, old flaws fixed), then callback the token/promise to close the loop',
    risk: '出轨/原则性伤害不能被轻描淡写洗白；复合要让观众觉得“值得”而非“将就”', riskEn: 'Betrayal of principle must not be whitewashed; reunion must feel earned, not settled-for',
    kw: ['破镜重圆', '复合', '重逢', '和好', 'reunion', 'second chance', 'get back together', 'repair'],
  },
  {
    id: 'micro_body', name: '肢体微进度', nameEn: 'Physical micro-progress',
    principle: '情感浓度更多靠眼神、距离、触碰的细微变化传递，比直白告白更有代入感', principleEn: 'Emotional intensity travels through micro-changes in gaze, distance and touch more immersively than explicit declarations',
    technique: '设计一条身体距离递进线（并肩→不经意触碰→刻意靠近→牵手→拥抱），每次升级对应关系阶梯一级；用“想碰又收回”“指尖停顿”等动作替代“我喜欢你”，关键告白前先让身体诚实', techniqueEn: 'Design a physical-distance line (side by side → accidental touch → deliberate closeness → handhold → embrace), each upgrade matching a relationship rung; replace “I love you” with reach-and-pull-back or a paused fingertip; let the body be honest before the verbal confession',
    risk: '亲密戏要服务情感且把握尺度，不为撩而撩、不违背人物意愿（明确同意）', riskEn: 'Intimacy must serve emotion, stay appropriate, and never override consent',
    kw: ['肢体', '触碰', '眼神', '牵手', '拥抱', 'touch', 'body language', 'physical proximity', 'gaze'],
  },
  {
    id: 'he_payoff', name: 'HE情绪兑付', nameEn: 'Happy-ending emotional payoff',
    principle: '结局的爽/甜来自把前期欠观众的承诺、遗憾、伏笔逐项兑现，兑付清单越完整越满足', principleEn: 'Ending satisfaction comes from cashing every earlier promise, regret and foreshadow one by one; the fuller the payoff list, the greater the fulfillment',
    technique: '前期建一张“情感欠条”：未说出口的话、错过的约定、被误解的人、立过的 flag；结局按清单逐项兑付并尽量回扣原场景/原台词，主 CP 之外给重要副线一个交代', techniqueEn: 'Keep an emotional-IOU list: unspoken words, missed plans, misunderstood people, planted flags; cash each at the ending, ideally recreating the original scene/line, and give key side-couples closure too',
    risk: '开放式结局要留给希望而非烂尾；不能临时空降完美结局解决一切', riskEn: 'An open ending should leave hope, not abandonment; no last-minute perfect fix that resolves everything out of nowhere',
    kw: ['he', '结局', '圆满', '兑现', '在一起', 'happy ending', 'payoff', 'fulfillment', 'endgame'],
  },
];
export const VALID_ROMANCE_DEVICES = new Set(ROMANCE_DEVICES.map((d) => d.id));
const BY_ID = new Map(ROMANCE_DEVICES.map((d) => [d.id, d]));

const ROMANCE_HINT = ['甜宠', '恋爱', '爱情', '婚恋', '言情', '暗恋', '撒糖', '虐恋', '情感', 'cp', '感情线', '先婚后爱', '破镜重圆', '双向奔赴', 'romance', 'romantic', 'love story', 'romcom', 'sweet drama', 'couple', 'relationship drama', 'fluff'];
export function detectRomance(text: string): boolean {
  const t = (text || '').toLowerCase();
  return ROMANCE_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickRomanceDevices(text: string, n = 3): RomanceDevice[] {
  const t = (text || '').toLowerCase();
  const hit = ROMANCE_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: RomanceDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：心动阶梯（不跳步）+ 糖刀配比（节奏）+ HE兑付（满足感），情感剧最普适骨架
  const fallback = ['heart_ladder', 'sweet_knife', 'he_payoff'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  ROMANCE_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildRomanceDirective(text: string, lang: RomanceLang = 'zh', n = 3): string {
  if (!detectRomance(text)) return '';
  const ds = pickRomanceDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a ROMANCE / sweet-or-angst love story. Engineer the emotional beats deliberately. Use these devices this episode:\n${body}\nHard rules: feelings advance one visible rung at a time with behavioral evidence, misunderstandings are blocked by information structure not stupidity (resolve fast), never frame control/stalking/PUA as love, earn both angst and sweetness, and show intimacy through consent and micro-actions rather than declarations alone.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为甜宠/虐恋情感剧，情感节拍要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：感情一阶一阶升温且每级有行为证据，不跳步、不工业撒糖；误会靠信息结构而非角色降智、尽快解开；绝不能把控制欲/跟踪/PUA 包装成深情；虐与甜都要先铺垫、有因果；亲密戏把握尺度、尊重意愿，多用肢体微动作而非只靠台词告白。`;
}
