/**
 * 悬疑诡计级创作引擎（v2.07）
 * ------------------------------------------------------------------
 * 与 v2.06 喜剧机制同构：光有“悬疑/烧脑”标签不够，AI 需要知道**谜底结构怎么搭、线索怎么埋、反转怎么公平**。
 * 沉淀 10 类经典悬疑诡计/叙事装置，每条含：机理（为什么成立）、可执行技法、风险（防作弊/防烂尾/防故弄玄虚）。
 * - detectMystery：从标签/梗概识别悬疑/推理/犯罪意图
 * - pickMysteryTricks：关键词命中优先 + 通用三件套兜底，确定性、永不空、不重复
 * - buildMysteryDirective：生成给架构师/编剧岗的双语悬疑执行指令；非悬疑返回空串
 * 硬性创作底线（写进指令）：线索公平（观众/侦探同源）、反转必须可由前文推出、不靠角色突然降智或超自然兜底。
 */
export type MysteryLang = 'zh' | 'en';
export interface MysteryTrick {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const MYSTERY_TRICKS: MysteryTrick[] = [
  {
    id: 'locked_room', name: '密室/不可能犯罪', nameEn: 'Locked room / impossible crime',
    principle: '在看似物理不可能的条件下发生案件，谜底是一个被观众忽略的空间/时间/机械漏洞', principleEn: 'A crime occurs under seemingly impossible physical conditions; the answer is one overlooked spatial, temporal or mechanical loophole',
    technique: '先完整交代密室条件（门窗、目击者、时间），再用一条不起眼的细节（门锁结构、通风、声音延迟）给出唯一解；所有诡计部件在前半段都出现过', techniqueEn: 'Establish the locked conditions fully (doors, witnesses, timing), then solve via one easy-to-miss detail (lock mechanism, vent, sound delay); every trick component appeared earlier',
    risk: '谜底用了从未展示的道具或巧合等于作弊；密室解法不能依赖超自然', riskEn: 'Solving with an unshown device or coincidence is cheating; no supernatural escape',
    kw: ['密室', '不可能', 'locked room', 'impossible', 'sealed'],
  },
  {
    id: 'alibi', name: '不在场证明拆解', nameEn: 'Breaking the alibi',
    principle: '嫌疑人有铁证般的不在场证明，突破口是时间感、距离或“证明人认知”里的一个误差', principleEn: 'The suspect has an ironclad alibi; the crack is an error in perceived time, distance or the witness’s cognition',
    technique: '把不在场证明拆成可验证的时间轴（几点几分在哪、谁看见、耗时多少），在其中埋一个“看似连续实则有缺口”的环节，用交通工具/录音/习惯动作制造时间差', techniqueEn: 'Break the alibi into a verifiable timeline (where/who/how long each minute), embed one gap that looks continuous, manufacture the time gap via transport, recording or habit',
    risk: '时间误差必须经得起观众按计算器，不能靠模糊带过', riskEn: 'The time gap must survive the audience checking the clock; never hand-wave it',
    kw: ['不在场', '时间差', 'alibi', 'timeline gap', 'time difference'],
  },
  {
    id: 'narrator_trick', name: '叙述性诡计', nameEn: 'Narrative trick (unreliable narration)',
    principle: '利用叙述视角天然省略/歧义误导观众（隐去身份、时间、人称），揭晓时回看处处成立', principleEn: 'Mislead through omissions or ambiguity inherent in the POV (hidden identity, time or person); on reveal every earlier line still holds',
    technique: '选定一个被默认却没明说的假设（叙述者性别/与死者关系/现在与回忆），全程只给“为真但有歧义”的表述，揭晓时用原句回放证明没说谎', techniqueEn: 'Pick an assumed-but-never-stated fact (narrator’s gender, tie to victim, present vs memory), write only true-but-ambiguous lines, then replay original lines on reveal to prove no lie was told',
    risk: '不能靠隐瞒关键信息硬骗；回看必须严丝合缝，否则观众觉得被耍', riskEn: 'Do not cheat by hiding crucial facts; a re-read must fit perfectly or the audience feels tricked',
    kw: ['叙述性诡计', '叙述诡计', '不可靠叙述', 'narrative trick', 'unreliable narrator', 'perspective trick'],
  },
  {
    id: 'identity_swap', name: '身份替换/伪装', nameEn: 'Identity swap / disguise',
    principle: '某人以另一重身份存在，反差来自身份错位带来的信息与权力差', principleEn: 'Someone operates under another identity; the tension comes from the information and power gap of the mismatch',
    technique: '提前埋三个只有“知道真身才懂”的细节（习惯、旧伤、知情度），让替身/真身各有合理动机，揭晓靠细节闭环而非口头解释', techniqueEn: 'Plant three details only understandable with the true identity (habit, old scar, privileged knowledge); give both identities sound motives; close the loop through details, not exposition',
    risk: '易和“真假千金”套路撞车；伪装必须有成本与破绽，不能全程无敌', riskEn: 'Easily collides with the swapped-heiress cliché; disguise needs cost and cracks, not invincibility',
    kw: ['身份替换', '伪装', '真假', '冒名', 'identity swap', 'impostor', 'disguise', 'doppelganger'],
  },
  {
    id: 'multi_turn', name: '多重反转/套娃', nameEn: 'Multi-layer reversal',
    principle: '每一层“真相”都推翻上一层，但反转次数越多越需要清晰主线，否则观众疲劳', principleEn: 'Each layer of truth overturns the last; the more turns, the clearer the spine must be or the audience burns out',
    technique: '反转不超过三次且层层升级（以为是A→其实是B→真正主使是C），每次反转都改变“谁受益”；提前为每层埋一个专属伏笔，最后一次反转回扣开场', techniqueEn: 'Cap turns at three and escalate each (seems A → actually B → C is the real hand); each turn changes who benefits; plant a distinct clue per layer and let the final turn callback the opening',
    risk: '为反转而反转、动机撑不住会崩；反转后人物行为仍要自洽', riskEn: 'Twists without supporting motives collapse; behavior must stay consistent after each turn',
    kw: ['多重反转', '套娃', '高能反转', '反转再反转', 'multiple twist', 'layered reveal', 'double cross'],
  },
  {
    id: 'fair_play', name: '伏线公平回收', nameEn: 'Fair-play foreshadowing',
    principle: '悬疑的爽感来自“原来早就告诉我了”，所有关键线索必须在揭晓前公平出现', principleEn: 'The thrill is “it was shown all along”; every key clue must appear fairly before the reveal',
    technique: '列一张线索清单：破案所需的每条信息标注首次出现的集/场，确保都在谜底前；用生活场景把关键线索“藏”在无关信息里（一次带过、不强调）', techniqueEn: 'Keep a clue ledger: mark the first scene of every fact needed to solve it, all before the reveal; hide key clues in plain sight inside mundane beats, mentioned once without emphasis',
    risk: '关键证据临时空降=作弊；线索也不能反复特写提示到没悬念', riskEn: 'Last-minute evidence is cheating; over-flagging clues kills suspense',
    kw: ['伏线', '伏笔回收', '线索', '公平', 'foreshadow', 'fair play', 'clue', 'chekhov'],
  },
  {
    id: 'social_motive', name: '社会派动机', nameEn: 'Social-school motive',
    principle: '重点不在“怎么作案”而在“为什么走到这一步”，用社会结构/人性困境制造后劲', principleEn: 'The focus is not how but why it came to this; social structure and human dilemma create the aftertaste',
    technique: '案件只是入口，沿动机倒推人物处境（阶层、家庭、制度性伤害），让凶手逻辑可被理解但不被认同；用一个具体生活场景承载社会议题，不喊口号', techniqueEn: 'Treat the case as an entrance, reverse-engineer the character’s situation (class, family, systemic harm); make the logic understandable yet not endorsed; carry the issue in one concrete life scene, no slogans',
    risk: '议题先行、推理让位会变成说教；动机再值得同情也不能替代证据链', riskEn: 'Message-first, mystery-second becomes preaching; a sympathetic motive never replaces the evidence chain',
    kw: ['社会派', '动机', '人性', 'social school', 'motive', 'whydunit', 'social realism'],
  },
  {
    id: 'rashomon', name: '罗生门多视角', nameEn: 'Rashomon / multi-POV',
    principle: '同一事件由不同利益方各说各话，真相在矛盾证词的交集处', principleEn: 'Different stakeholders recount the same event differently; truth lies in the intersection of conflicting testimony',
    technique: '给每个视角一个“对自己有利的偏差”，让证词两两矛盾但各自自洽；用一个无法作伪的客观物证（监控时间、伤情）当锚点，逐步对齐出真相', techniqueEn: 'Give each POV a self-serving bias so testimonies conflict yet each feels coherent; use one unfakeable anchor (camera timestamp, injury) to align the truth step by step',
    risk: '视角太多观众记不住；每个撒谎者都要有可理解的理由，不能全员为反而反', riskEn: 'Too many POVs confuse; each liar needs an understandable reason, not contradiction for its own sake',
    kw: ['罗生门', '多视角', '证词', 'rashomon', 'multiple pov', 'contradicting testimony', 'he-said'],
  },
  {
    id: 'countdown', name: '倒计时/时限压迫', nameEn: 'Countdown / ticking clock',
    principle: '给侦查设一个硬性截止时间，时间压力把推理和动作拧成一股绳', principleEn: 'Impose a hard deadline on the investigation; time pressure fuses deduction and action into one line',
    technique: '开场明确时限与代价（几点前找不到会发生什么），每个侦查动作都消耗可见时间，在临近截止处安排一次错误方向，最后用省下来的一个时间缝隙翻盘', techniqueEn: 'State the deadline and its cost up front, make every investigative move cost visible time, send the lead down a wrong path near the deadline, then turn it on a saved sliver of time',
    risk: '时限若不影响角色决策就是假倒计时；要让观众随时知道还剩多少时间', riskEn: 'A clock that never changes decisions is fake; the audience must always know the time left',
    kw: ['倒计时', '时限', '争分夺秒', 'countdown', 'ticking clock', 'deadline', 'race against time'],
  },
  {
    id: 'armchair', name: '安乐椅/信息拼图', nameEn: 'Armchair deduction / info puzzle',
    principle: '侦探不必亲临险境，靠把散落的公开信息重新排列组合推出结论，凸显智力快感', principleEn: 'The detective need not face danger; rearranging scattered public information yields the answer, foregrounding intellectual pleasure',
    technique: '把破案信息拆成多份分别给到不同角色/渠道（新闻、闲聊、账单），让观众和侦探同步拿到碎片，在揭晓前给一次“拼图蒙太奇”让观众能抢先一步', techniqueEn: 'Split case information across characters and channels (news, chatter, receipts); give the audience the same fragments, and run a puzzle montage before the reveal so viewers can beat the detective to it',
    risk: '信息不能藏在观众看不到处；拼图结论必须是碎片的唯一合理解', riskEn: 'Information cannot hide off-screen; the assembled conclusion must be the fragments’ only sound reading',
    kw: ['安乐椅', '拼图', '推理', 'deduction', 'armchair', 'piece together', 'logic puzzle'],
  },
];
export const VALID_MYSTERY_TRICKS = new Set(MYSTERY_TRICKS.map((t) => t.id));
const BY_ID = new Map(MYSTERY_TRICKS.map((t) => [t.id, t]));

const MYSTERY_HINT = ['悬疑', '推理', '刑侦', '破案', '侦探', '犯罪', '凶案', '命案', '烧脑', '探案', 'mystery', 'detective', 'crime', 'homicide', 'murder', 'thriller investigation', 'whodunit', 'noir'];
export function detectMystery(text: string): boolean {
  const t = (text || '').toLowerCase();
  return MYSTERY_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickMysteryTricks(text: string, n = 3): MysteryTrick[] {
  const t = (text || '').toLowerCase();
  const hit = MYSTERY_TRICKS.filter((m) => m.kw.some((k) => t.includes(k.toLowerCase())));
  const out: MysteryTrick[] = [];
  hit.forEach((m) => { if (out.length < n) out.push(m); });
  // 通用三件套兜底：伏线公平（底线）+ 多重反转（短剧追更）+ 身份替换（竖屏高频）
  const fallback = ['fair_play', 'multi_turn', 'identity_swap'];
  for (const id of fallback) { if (out.length >= n) break; const m = BY_ID.get(id)!; if (!out.includes(m)) out.push(m); }
  MYSTERY_TRICKS.forEach((m) => { if (out.length < n && !out.includes(m)) out.push(m); });
  return out.slice(0, n);
}

export function buildMysteryDirective(text: string, lang: MysteryLang = 'zh', n = 3): string {
  if (!detectMystery(text)) return '';
  const ts = pickMysteryTricks(text, n);
  if (lang === 'en') {
    const body = ts.map((m) => `· ${m.nameEn} — ${m.techniqueEn} (risk: ${m.riskEn})`).join('\n');
    return `This is a MYSTERY / INVESTIGATION story. Engineer the puzzle honestly. Use these structures this episode:\n${body}\nHard rules: fair play (the audience and detective get the same clues), every twist must be derivable from earlier scenes, no last-minute unshown evidence, no character suddenly acting dumb, no supernatural cop-out.`;
  }
  const body = ts.map((m) => `· ${m.name}——${m.technique}（风险：${m.risk}）`).join('\n');
  return `本剧为悬疑/推理，谜题要被“公平地设计”。本集重点使用以下悬疑装置：\n${body}\n硬性要求：线索公平（观众与侦探拿到的信息同源）、每个反转都必须能从前文推出、关键证据不得临时空降、不靠角色突然降智推进、不用超自然强行兜底。`;
}
