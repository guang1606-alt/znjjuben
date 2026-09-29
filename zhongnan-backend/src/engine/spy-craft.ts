/**
 * 年代谍战 / 民国潜伏机制引擎（v2.21）
 * ------------------------------------------------------------------
 * 第十二套“类型机制引擎”。谍战短剧 AI 通病：身份伪装说崩就崩、情报全靠主角口述、
 * 反派降智、反转无伏笔、审讯像念口供、巧合推动剧情、酷刑渲染血腥、历史立场含糊甚至歪楼。
 * 本模块沉淀 10 套装置（机理+技法+风险），自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type SpyLang = 'zh' | 'en';
export interface SpyDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const SPY_DEVICES: SpyDevice[] = [
  {
    id: 'cover_identity', name: '身份面具双层行为', nameEn: 'Dual-layer cover behavior',
    principle: '潜伏者的张力来自“公开身份”与“真实任务”每时每刻的撕扯：他必须先用伪装身份的逻辑行动，再在缝隙里完成任务，观众盯着面具会不会裂', principleEn: 'An undercover operative’s tension comes from the constant clash between public cover and real mission: he must first act by the cover’s logic, then squeeze the mission into the cracks while the audience watches for the mask to crack',
    technique: '给主角定死一套公开身份的行为习惯（口头禅、社交关系、能力短板），每次执行任务都设计一个“差点穿帮”的具体动作（熟人突然出现、习惯动作露馅、说错称呼），并让他用符合伪装身份的方式当场圆过去；绝不让周围人集体降智来配合潜伏', techniqueEn: 'Fix the cover’s habits (pet phrases, relationships, weaknesses); on each mission design one near-blow moment (an acquaintance appears, a tell slips, a wrong form of address) that he covers using only what the cover identity would know; never make everyone around him stupid to protect the cover',
    risk: '伪装规则不能朝令夕改，前面说不识字后面却看懂密电就是穿帮', riskEn: 'Cover rules cannot shift on demand; being illiterate in episode 1 and reading a cipher later blows the cover',
    kw: ['潜伏', '伪装', '卧底', '身份', '面具', '地下党', '掩护身份', 'undercover', 'cover identity', 'mole', 'infiltrate', 'double agent'],
  },
  {
    id: 'info_asymmetry', name: '信息差反讽', nameEn: 'Dramatic information gap',
    principle: '谍战的高级悬念来自信息分层：让观众比场上某个角色多知道一层（或反过来被瞒一层），同一场戏就同时有表面意思和潜台词，张力不靠喊出来', principleEn: 'Espionage suspense runs on layered information: letting the audience know one layer more (or less) than a character gives the same scene a surface meaning and a subtext at once, without shouting the tension',
    technique: '写戏前先列“谁知道什么”对照表（观众/主角/对手/旁观者各知道哪一层），关键场景故意让一方在信息盲区里说客气话、另一方话里有话；用一个只有观众和当事人懂的细节（茶杯朝向、窗台上的花）完成暗语，不写内心独白解释', techniqueEn: 'Before each scene make a who-knows-what table (audience/hero/foes/bystanders); play polite dialogue across the gap and encode meaning in a detail only the audience and insider understand (a turned teacup, a flower on the sill) instead of explaining via inner monologue',
    risk: '信息差必须对观众公平，靠藏关键镜头制造的“反转”是作弊', riskEn: 'The gap must be fair to the audience; hiding a key shot to fake a twist is cheating',
    kw: ['信息差', '潜台词', '暗语', '观众知道', '话里有话', 'dramatic irony', 'information gap', 'subtext', 'audience knows'],
  },
  {
    id: 'contact_protocol', name: '接头流程可信度', nameEn: 'Credible contact tradecraft',
    principle: '谍战的“专业感”来自情报传递的流程细节：暗号、信物、死信箱、撤离路线环环相扣，流程越具体，世界越真', principleEn: 'The genre’s sense of professionalism comes from tradecraft detail: code phrase, token, dead drop and extraction route interlock; the more concrete the procedure, the more real the world',
    technique: '每场接头先定三件套：识别暗号（上句下句，且设一个“错半句即终止”的安全阀）、信物（可被掉包制造危机）、撤离预案；让至少一个环节出意外（暗号被无关者无心对上、信物被雨水弄花），主角按预案而不是靠急智硬闯', techniqueEn: 'For every contact fix three things: a challenge-and-password with an abort trigger on any mismatch, a token (that can be swapped to create crisis), and an extraction plan; then break one link (a bystander accidentally returns the password, rain ruins the token) and have the hero follow the plan rather than improvise blindly',
    risk: '暗号不能万能，反复用同一种传递方式而对手毫无察觉不真实', riskEn: 'No method is foolproof; reusing one channel forever without the enemy noticing rings false',
    kw: ['接头', '暗号', '情报', '死信箱', '信物', '联络', '交通站', 'dead drop', 'code phrase', 'safe house', 'courier', 'tradecraft'],
  },
  {
    id: 'interrogation_chess', name: '审讯双向博弈', nameEn: 'Two-way interrogation chess',
    principle: '好看的审讯是互相试探的棋局：审的人在套话，被审的人也在反推对方掌握了多少，胜负在信息边界上，而不是比谁嗓门大、谁先崩溃', principleEn: 'A gripping interrogation is mutual probing: the questioner fishes while the suspect reverse-engineers how much they actually know; victory lies at the information boundary, not in volume or an instant breakdown',
    technique: '审讯前写明审方“已掌握/在诈/不知道”三张牌，被审方据此决定哪句认、哪句反咬；每一轮问答都让一方的认知被更新一点，用一个对方没料到的细节（天气、人名、时间差）打破平衡；禁止一上来就竹筒倒豆子', techniqueEn: 'List the interrogator’s three hands—known, bluffing, unknown—and let the suspect decide what to admit or throw back; each exchange updates one side’s knowledge and a surprise detail (weather, a name, a time gap) shifts the balance; never empty the whole story in the first minute',
    risk: '酷刑只能点到为止并服务心理博弈，渲染血腥既违规也拉低格调', riskEn: 'Torture is only hinted at and serves the psychological duel; graphic cruelty both violates policy and cheapens the scene',
    kw: ['审讯', '审问', '逼供', '盘问', '心理博弈', '诈', 'interrogation', 'interrogate', 'good cop', 'psychological duel'],
  },
  {
    id: 'mole_paranoia', name: '内鬼疑云公平布点', nameEn: 'Fair-play mole paranoia',
    principle: '内鬼悬念靠“受控的怀疑”：每个嫌疑人都要有动机、有机会、也有一条看似洗清的证据，怀疑在几人间有序转移，观众参与推理', principleEn: 'A mole mystery runs on controlled suspicion: every suspect needs motive, opportunity and seemingly exculpating evidence, so doubt moves between candidates in an orderly way and the audience plays detective',
    technique: '开局埋3个以上嫌疑人并给每人一个“可疑点+反证”，每集只推进或排除一个，所有指向真凶的线索在揭晓前都已出现过（公平推理）；用一次“错误指控”消耗观众的确定性，再让真内鬼因一个他自己都没注意的习惯暴露', techniqueEn: 'Seed 3+ suspects each with a tell and a counter-proof, advance or clear only one per episode, and ensure every clue to the real mole appeared before the reveal; burn the audience’s certainty with one false accusation, then expose the mole through a habit he himself did not notice',
    risk: '嫌疑不能靠角色突然黑化，内鬼动机必须在前史里立得住', riskEn: 'A suspect cannot turn evil out of nowhere; the mole’s motive must stand on earlier backstory',
    kw: ['内鬼', '叛徒', '谁是卧底', '怀疑', '奸细', 'mole', 'traitor', 'whos the rat', 'suspicion'],
  },
  {
    id: 'camp_reversal', name: '阵营反转有据', nameEn: 'Earned camp reversals',
    principle: '谍战最炸的是阵营反转（自己人是敌特、敌人是同志），但反转的力量全部来自此前被误读的细节，而不是临时宣布', principleEn: 'The biggest jolt is a camp reversal (an ally is enemy, a foe is a comrade), yet its power comes entirely from earlier misread details, never from a last-minute announcement',
    technique: '反转前至少埋三条“当时合理、事后另解”的线索（一句双关、一次迟到、一个多余动作），反转集用闪回把旧镜头重新解释一遍但不新增设定；被反转人物的行为在两种身份下都必须说得通', techniqueEn: 'Before the reversal plant at least three clues that read one way then and another now (a double meaning, a delay, a redundant move); in the reveal episode re-cut earlier moments without adding new facts, so the character’s actions make sense under both identities',
    risk: '为反转而反转会让此前所有人物关系失真，一个人物最多一次核心阵营反转', riskEn: 'Twist-for-twist’s-sake invalidates prior relationships; give any character at most one core camp reversal',
    kw: ['反转', '阵营', '真实身份', '同志', '敌特', '双面', 'reveal', 'double identity', 'switch sides', 'true allegiance'],
  },
  {
    id: 'trust_cost', name: '信任背叛的代价', nameEn: 'The cost of trust and betrayal',
    principle: '情报线之外必须有情感线托底：信任是用命换来的，背叛要同时损失任务与关系，观众心疼的是人而不是情报', principleEn: 'Beyond the intelligence plot runs an emotional line: trust is earned with lives and a betrayal must cost both the mission and a relationship, so the audience grieves a person, not a document',
    technique: '给主角配一段需要长期经营的信任关系（上线、战友、被争取对象），先用一两场戏把这份信任“存”起来（替对方挡过事、交过底），再让任务迫使他对这个人说谎或牺牲这段关系；背叛者也要给他自己相信的理由，不写成纯坏', techniqueEn: 'Give the hero a trust relationship built over time (handler, comrade, a convert); “deposit” that trust in a scene or two (taking a risk for them, sharing a secret), then let the mission force a lie or sacrifice; give even the betrayer a reason he believes in rather than pure villainy',
    risk: '情感不能拖慢情报主线，每场感情戏都要同时推进任务或暴露风险', riskEn: 'Emotion must not slow the mission; every emotional beat should also advance the task or expose risk',
    kw: ['信任', '背叛', '战友', '上线', '牺牲', '情感', 'trust', 'betrayal', 'comrade', 'handler', 'sacrifice'],
  },
  {
    id: 'ticking_mission', name: '高压任务时限', nameEn: 'Ticking-clock missions',
    principle: '谍战靠“时限+后果”制造窒息感：情报几点前必须送出、名单几点后就会被抓，明确的时钟让每个选择都有代价', principleEn: 'Espionage creates suffocation through deadline plus consequence: the intelligence must move by a set hour, arrests follow after it, and a visible clock makes every choice costly',
    technique: '每两到三集设一个可见倒计时（列车发车、全城戒严、电报窗口），并让倒计时与另一条线冲突（送情报就救不了人）；倒计时只减不增，临近节点用具体动作（对表、剪线、换哨）让观众感到时间在流走，而不是字幕报时', techniqueEn: 'Set a visible countdown every 2-3 episodes (a train departure, a citywide curfew, a radio window) that conflicts with another thread (deliver the intel or save the person); let the clock only tick down and show its passage through concrete actions (checking a watch, cutting a line, a guard rotation) rather than on-screen timecards',
    risk: '时限不能反复延后，否则观众不再相信紧迫感', riskEn: 'Never keep extending a deadline or the urgency loses all credibility',
    kw: ['时限', '倒计时', '任务', '最后期限', '戒严', 'deadline', 'countdown', 'against the clock', 'time window'],
  },
  {
    id: 'planted_payoff', name: '情报伏笔闭环', nameEn: 'Planted-and-paid intelligence',
    principle: '谍战的智力快感来自“草蛇灰线”：前期一个不起眼的名字、号码、习惯，后期成为破局关键，回收时观众能想起它出现过', principleEn: 'The genre’s intellectual payoff is a planted thread: an early throwaway name, number or habit becomes the key later, and the audience remembers seeing it',
    technique: '大纲阶段就列“伏笔登记表”：每条伏笔写清埋设集、误导含义、真实含义、回收集；关键破局必须用至少一条三集以前埋下的伏笔，回收时给一个与埋设时呼应的镜头/台词；不允许靠新冒出来的巧合脱困', techniqueEn: 'In the outline keep a plant ledger: for each thread note plant episode, misleading meaning, true meaning and payoff episode; the decisive break must use a thread planted at least three episodes earlier, echoed by a matching shot or line at payoff; never escape via a fresh coincidence',
    risk: '伏笔密度要克制，埋十个只回收两三个会显得故弄玄虚', riskEn: 'Restrain plant density; seeding ten and paying off two or three feels pretentious',
    kw: ['伏笔', '回收', '线索', '密码', '细节', '铺垫', 'foreshadow', 'payoff', 'planted clue', 'chekhov'],
  },
  {
    id: 'faith_gray', name: '信仰立得住与人性灰度', nameEn: 'Earned faith and moral gray',
    principle: '年代谍战有明确历史立场：信仰要靠一次次具体选择立起来，而不是喊口号；可以写人性的犹豫与灰色，但底色不虚无、不歪曲历史、不美化侵略', principleEn: 'Period espionage carries a clear historical stance: conviction is built through concrete choices, not slogans; human hesitation and gray areas are allowed, but the baseline is never nihilistic, history is not distorted and aggression is never glorified',
    technique: '给主角一次真正艰难的立场选择（保全自己还是保全同志/任务），让他付出代价后仍选择信仰，比十句口号有力；反派也写其能力与逻辑，但在大是大非上不含糊；年代细节（货币、报刊、称谓、街景）查证后再写，避免穿越感', techniqueEn: 'Give the hero one genuinely hard choice (save himself or the comrade/mission) in which he pays a price yet chooses his convictions—stronger than ten slogans; write the antagonist as capable and logical while staying unambiguous on right and wrong; verify period detail (currency, newspapers, forms of address, streets) to avoid anachronism',
    risk: '灰色不等于立场摇摆，核心人物在历史方向上不能模糊；暴力与酷刑点到为止', riskEn: 'Gray does not mean wavering stance; core characters stay clear on historical direction, and violence stays non-graphic',
    kw: ['信仰', '立场', '年代', '民国', '革命', '民族大义', '历史', 'conviction', 'period drama', 'moral gray', '1930s', '1940s', 'republican era'],
  },
];

export const VALID_SPY_DEVICES = new Set(SPY_DEVICES.map((d) => d.id));
const BY_ID = new Map(SPY_DEVICES.map((d) => [d.id, d]));

const SPY_HINT = ['谍战', '间谍', '特工', '潜伏', '卧底', '地下党', '情报站', '军统', '中统', '特高课', '特务', '暗号', '接头', '民国谍', '敌后', '情报员', '密码本', '敌营', 'spy thriller', 'espionage', 'undercover agent', 'secret agent', 'intelligence', 'resistance cell', 'period spy', 'wartime spy'];
export function detectSpy(text: string): boolean {
  const t = (text || '').toLowerCase();
  return SPY_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickSpyDevices(text: string, n = 3): SpyDevice[] {
  const t = (text || '').toLowerCase();
  const hit = SPY_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: SpyDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：身份面具（类型地基）+ 信息差（悬念来源）+ 伏笔闭环（智力快感）
  const fallback = ['cover_identity', 'info_asymmetry', 'planted_payoff'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  SPY_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildSpyDirective(text: string, lang: SpyLang = 'zh', n = 3): string {
  if (!detectSpy(text)) return '';
  const ds = pickSpyDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a PERIOD ESPIONAGE / UNDERCOVER thriller. Engineer suspicion and tradecraft deliberately. Use these devices this episode:\n${body}\nHard rules: the cover identity behaves consistently and nobody around the operative is dumbed down; interrogations are two-way information duels with no instant confessions and no graphic torture; mole suspicion and camp reversals must be fair-play with clues planted beforehand; deadlines only tick down and escapes never rely on fresh coincidence; keep period detail accurate, never distort history or glorify aggression, ground the protagonists’ convictions in concrete choices, and keep moral grayness from sliding into nihilism.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为年代谍战/民国潜伏剧，悬念与专业感要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：伪装身份的行为逻辑前后一致，绝不让周围人集体降智配合潜伏；审讯是双向信息博弈，不秒招、不渲染酷刑血腥；内鬼怀疑与阵营反转必须公平、伏笔线索提前埋设；倒计时只减不增，破局不靠临时巧合；年代细节查证准确，不歪曲历史、不美化侵略，主角信仰靠具体选择立住，人性灰度但底色不虚无。`;
}
