/**
 * 家庭伦理 / 年代情感机制引擎（v2.15）
 * ------------------------------------------------------------------
 * 第九套“类型机制引擎”。家庭伦理/年代剧 AI 通病：矛盾靠吵架和误会硬推、长辈/儿媳脸谱化为纯恶、
 * 狗血堆砌（绝症/车祸/偷孩子）、年代细节穿越失真、和解靠一句对不起强行大团圆、消费苦难。
 * 本模块沉淀 10 套装置（机理+技法+风险），自动识别意图并下发；非该类型返回空串。纯函数、确定性、双语。
 */
export type FamilyLang = 'zh' | 'en';
export interface FamilyDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const FAMILY_DEVICES: FamilyDevice[] = [
  {
    id: 'grievance_ledger', name: '积怨账本', nameEn: 'Ledger of accumulated grievances',
    principle: '家庭矛盾从来不是一次爆发，而是一件件具体小事层层积压，爆发时观众能逐条回溯，才真实不突兀', principleEn: 'Family conflict never erupts from one event; concrete small wrongs pile up, so the outburst can be traced item by item and feels earned',
    technique: '开局建一本“积怨账”：每个家庭成员被亏欠/被误解/被牺牲的具体事件各列 2-3 件并标注时间；每次冲突只翻其中一两件，总爆发时多条旧账一起收口；避免凭空冒出此前毫无铺垫的怨恨', techniqueEn: 'Open a grievance ledger: list 2–3 concrete events per family member of being wronged/misunderstood/sacrificed with timing; each clash reopens one or two, and the final outburst closes several threads at once; never invent resentment with no prior setup',
    risk: '旧账要靠剧情自然带出，不能用大段独白讲家史', riskEn: 'Old grievances surface through action, not exposition monologues',
    kw: ['积怨', '旧账', '委屈', '亏欠', 'grievance', 'years of resentment', 'unspoken debt'],
  },
  {
    id: 'generation_gap', name: '代际立场双面', nameEn: 'Two-sided generational standoff',
    principle: '彩礼、养老、生育、职业选择等代际冲突，双方都要写出可理解的立场与恐惧，不把任何一代写成纯反派', principleEn: 'In bride-price, eldercare, childbearing or career clashes, both generations need understandable stances and fears; neither side is a pure villain',
    technique: '每场代际冲突先写“老一辈为什么这么想”（贫穷记忆/面子/怕子女走弯路）和“年轻一代为什么抗拒”（边界/自我实现），让观众在双方之间摇摆；用具体行为而非标签化台词呈现分歧，最终不简单判一方对错', techniqueEn: 'Before each clash write why the elders think so (memory of poverty, face, fear the child will suffer) and why the young resist (boundaries, self-fulfillment), letting viewers waver between them; show disagreement through behavior not labels, and avoid declaring one side simply right or wrong',
    risk: '和稀泥不等于无立场，涉及违法与原则问题（家暴/侵占）不能各打五十大板', riskEn: 'Balance is not neutrality on illegality or principle (abuse/embezzlement), which must not be treated as equally valid',
    kw: ['代际', '婆媳', '彩礼', '养老', '催婚', 'generation gap', 'mother-in-law', 'eldercare', 'in-laws'],
  },
  {
    id: 'daily_texture', name: '烟火日常承载', nameEn: 'Daily-life texture carries emotion',
    principle: '家庭情感藏在柴米油盐里：做饭、递水、收拾、攒钱等生活动作承载关系与态度，比直白说爱更有力', principleEn: 'Family emotion lives in groceries and chores — cooking, handing water, tidying, saving money — actions that carry relationship and attitude more powerfully than declaring love',
    technique: '每场情感戏配一个“正在做的家务/生活动作”：和解从一碗面开始、偏心从多夹一筷子菜体现、疏远从各吃各的体现；用具体物价、工资、家用补贴等数字增强年代与生活质感', techniqueEn: 'Give each emotional scene an ongoing household action: reconciliation starts with a bowl of noodles, favoritism shows in an extra chopstick of food, distance in eating separately; use concrete prices, wages and household allowances for era and life texture',
    risk: '细节服务情感与人物，不堆砌菜谱和流水账', riskEn: 'Details serve emotion and character, not recipe-like padding',
    kw: ['烟火气', '日常', '柴米油盐', '做饭', '家常', 'daily life', 'household', 'cooking', 'ordinary warmth'],
  },
  {
    id: 'kin_tangle', name: '血缘与边界', nameEn: 'Blood ties vs boundaries',
    principle: '家庭戏的核心张力是“血缘捆绑”与“个体边界”的拉扯：爱、控制、牺牲、亏欠缠在一起，值得被认真呈现而非简单歌颂或割裂', principleEn: 'The core tension is blood-tie bonding versus individual boundaries — love, control, sacrifice and debt intertwined, portrayed honestly rather than simply glorified or severed',
    technique: '给主角设一条边界线（不做扶弟魔/不被安排人生/要离婚），让家人用“为你好/一家人”反复施压，呈现主角从内疚到坚定的过程；亲情最终以“尊重边界后的重新靠近”收口，而非以主角彻底顺从或断绝关系收口', techniqueEn: 'Give the hero a boundary line (won’t endlessly fund a brother, won’t accept an arranged life, wants divorce), let family press with “it’s for your own good / we’re family,” and show the move from guilt to firmness; close on reconnection after boundaries are respected, not on total submission or estrangement',
    risk: '不美化以爱为名的控制与索取，也不鼓吹六亲不认', riskEn: 'Neither glorify control disguised as love nor advocate cutting off all kin',
    kw: ['边界', '扶弟', '为你好', '道德绑架', '一家人', 'boundary', 'family obligation', 'guilt trip', 'emotional blackmail'],
  },
  {
    id: 'misread_payoff', name: '误解与翻案', nameEn: 'Misunderstanding and vindication',
    principle: '家庭剧的强泪点来自“被最亲的人误解”再到真相大白，翻案要靠证据与时间，不靠外人突然说破', principleEn: 'A strong tear-jerker is being misunderstood by those closest then vindicated; vindication comes through evidence and time, not a stranger blurting it out',
    technique: '先让主角被家人误解（偏心/偷钱/忘恩负义）并承担后果，埋一个只有观众知道的真相（汇款单/病历/默默付出），在关键节点由当事人自己发现、逐条对照旧账完成翻案；翻案后给误解者一个“带着羞愧的补偿动作”', techniqueEn: 'First let the hero be misunderstood (favoritism, theft, ingratitude) and bear consequences; plant a truth only the audience knows (remittance slip, medical record, quiet sacrifice); at the key moment the family member discovers it and cross-checks the ledger for vindication, followed by an ashamed, reparative action',
    risk: '误解期不能太长太憋屈，中段要给观众“主角没被压垮”的小动作', riskEn: 'Don’t prolong misunderstanding into pure misery; mid-section needs small acts showing the hero isn’t broken',
    kw: ['误解', '翻案', '冤枉', '真相大白', 'misunderstood', 'vindication', 'wrongly blamed'],
  },
  {
    id: 'family_stage', name: '中国式家庭舞台', nameEn: 'Chinese-family stage scenes',
    principle: '饭桌、客厅、医院病房、老家堂屋是家庭冲突的天然舞台，多人在场时的“站队、打圆场、拉偏架”让群像活起来', principleEn: 'The dinner table, living room, hospital ward and old-home hall are natural stages; with many present, taking sides, peacemaking and biased mediation make the ensemble come alive',
    technique: '重要冲突安排在多人在场的家庭场合，给每个在场者一个符合其立场的反应（和事佬/拱火的/装没听见的/暗中帮主角的），用座次、添饭、离席等调度表现亲疏；避免两个人从头吵到尾的封闭对话', techniqueEn: 'Stage key clashes at multi-person family occasions; give everyone present a stance-consistent reaction (peacemaker, provocateur, one who pretends not to hear, secret ally), and use seating, serving food and leaving the table to show closeness and distance; avoid closed two-person shouting matches',
    risk: '群像反应要点到为止，避免支线喧宾夺主', riskEn: 'Keep ensemble beats concise so side plots don’t hijack the scene',
    kw: ['饭桌', '团圆饭', '病房', '堂屋', '一大家子', 'dinner table', 'family gathering', 'reunion dinner', 'ward'],
  },
  {
    id: 'reconcile_cost', name: '和解有代价', nameEn: 'Reconciliation carries a cost',
    principle: '真实的家庭和解不是一句“对不起”，而是让步、补偿、遗憾与接受“有些伤口回不去”，过程比结局动人', principleEn: 'Real reconciliation is not a single “sorry” but concession, compensation, regret and accepting that some scars remain; the process matters more than the ending',
    technique: '和解分三步：先有一方低头的具体行动（认错/还债/让出利益），再有一次把话说开的长谈（各自承认自己的难处与过错），最后保留一处无法完全弥补的遗憾作为余味；拒绝“所有矛盾一集清零”的悬浮大团圆', techniqueEn: 'Reconcile in three steps: a concrete first move (admission, repaying, yielding an interest), a real talk where each side admits hardship and fault, and one irreparable regret left as aftertaste; reject floating happy endings where every conflict clears in one episode',
    risk: '涉及家暴/重大伤害时，和解需谨慎，不能用亲情绑架受害者原谅', riskEn: 'For abuse or grave harm, handle reconciliation carefully — never pressure a victim to forgive through family guilt',
    kw: ['和解', '原谅', '大团圆', '低头', 'reconcile', 'forgive', 'make amends', 'family reunion'],
  },
  {
    id: 'era_mark', name: '年代印记推动命运', nameEn: 'Era markers drive fate',
    principle: '年代剧的个人命运要被时代节点真实推动（知青下乡、恢复高考、下岗、下海、拆迁、买房），道具与事件必须考据准确、不穿越', principleEn: 'In era dramas, personal fate is genuinely moved by historical turning points (sent-down youth, restored college entrance exams, layoffs, going into business, demolition, home buying); props and events must be era-accurate, never anachronistic',
    technique: '先做一张“年代时间轴”：把人物年龄、家庭大事与真实历史节点对齐；每个命运转折都由一个时代事件触发（顶替上岗、单位分房、国企改制），道具（粮票/BB机/万元户/筒子楼）服务剧情而非猎奇；用词、物价、观念严格符合年代', techniqueEn: 'Build an era timeline aligning character ages and family events with real historical nodes; each fate turn is triggered by an era event (assigned job, work-unit housing, SOE reform), with props (grain coupons, pagers, “ten-thousand-yuan household”, shared corridor housing) serving plot, word choices, prices and values strictly period-accurate',
    risk: '历史节点只做背景推动，不歪曲重大历史、不出现年代硬伤', riskEn: 'Historical nodes only drive background; never distort major history or leave anachronisms',
    kw: ['年代', '知青', '下岗', '下海', '拆迁', '恢复高考', '筒子楼', 'era drama', 'sent-down youth', 'laid off', 'reform era'],
  },
  {
    id: 'suppress_burst', name: '隐忍到总爆发链', nameEn: 'Endurance-to-outburst chain',
    principle: '家庭主角的情绪遵循“日常隐忍—小事试探—再被踩线—总爆发”的递进链，爆发才有分量，且爆发后关系被永久改变', principleEn: 'The hero’s emotion follows endure → small probe → line crossed again → total outburst; staged escalation gives the outburst weight and permanently changes the relationship afterward',
    technique: '排一条四级情绪链并分布到多集：第一级忍（沉默做事）、第二级试探（委婉表达被无视）、第三级警告（明确说不仍被逼迫）、第四级总爆发（掀桌/摊牌/离开）；每级给不同的生理与语言反应，总爆发后写清谁的态度因此改变', techniqueEn: 'Lay a four-level chain across episodes: endure (silent work), probe (polite words ignored), warn (clear refusal still pressured), outburst (showdown/leaving); give each level distinct physical and verbal reactions, and after the outburst make clear whose attitude changed',
    risk: '隐忍期要有主角的主动性与小反击，避免窝囊感堆积', riskEn: 'During endurance keep agency and small counter-moves to avoid helpless grimness',
    kw: ['隐忍', '爆发', '摊牌', '忍无可忍', 'endure', 'breaking point', 'finally snaps', 'showdown'],
  },
  {
    id: 'grounded_conflict', name: '去狗血底线', nameEn: 'Anti-melodrama grounding',
    principle: '靠真实的利益、性格、观念差异制造冲突，而不是靠绝症车祸抱错孩子等狗血巧合；能沟通的误会不靠“就是不听”硬拖', principleEn: 'Conflict arises from real interests, temperament and value differences, not terminal illness, car crashes or switched-at-birth coincidences; resolvable misunderstandings aren’t dragged out by characters refusing to listen',
    technique: '每设计一个冲突先问“现实中这样的家庭会不会这样发展”，剔除无动机使坏的恶亲、连环巧合和硬误会；冲突根源落到钱、房子、赡养分工、教育理念、旧伤等现实议题；误会若本可一句话说清，就改为“说了但没人信/说了更糟”的现实障碍', techniqueEn: 'For every conflict ask whether a real family would develop this way; strip unmotivated evil relatives, chained coincidences and forced misunderstandings; root conflict in money, housing, caregiving division, parenting philosophy or old wounds; if a misunderstanding could be cleared in one line, replace it with the realistic barrier of “said it, but nobody believed / it made things worse”',
    risk: '可以有戏剧夸张但不能悬浮失真，更不能靠丑化疾病/残障/某群体制造冲突', riskEn: 'Dramatic heightening is fine, floating unreality is not; never build conflict by mocking illness, disability or any group',
    kw: ['现实', '不狗血', '家长里短', '一地鸡毛', 'grounded', 'slice of life', 'realistic family', 'domestic realism'],
  },
];
export const VALID_FAMILY_DEVICES = new Set(FAMILY_DEVICES.map((d) => d.id));
const BY_ID = new Map(FAMILY_DEVICES.map((d) => [d.id, d]));

const FAMILY_HINT = ['家庭伦理', '婆媳', '翁婿', '养老', '啃老', '扶弟', '重男轻女', '家产', '拆迁', '妯娌', '亲子', '中年婚姻', '重组家庭', '全职妈妈', '黄昏恋', '隔代', '年代', '知青', '下岗', '下海', '大院', '老家', '一家人', '娘家', '婆家', 'family drama', 'domestic drama', 'mother-in-law', 'in-laws', 'eldercare', 'generation gap', 'family saga', 'era drama', 'sent-down', 'household conflict', 'family reunion'];
export function detectFamily(text: string): boolean {
  const t = (text || '').toLowerCase();
  return FAMILY_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickFamilyDevices(text: string, n = 3): FamilyDevice[] {
  const t = (text || '').toLowerCase();
  const hit = FAMILY_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: FamilyDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：积怨账本（矛盾有来处）+ 烟火日常（质感）+ 去狗血底线（不失真）
  const fallback = ['grievance_ledger', 'daily_texture', 'grounded_conflict'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  FAMILY_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildFamilyDirective(text: string, lang: FamilyLang = 'zh', n = 3): string {
  if (!detectFamily(text)) return '';
  const ds = pickFamilyDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This is a FAMILY-ETHICS / ERA-DRAMA emotional story. Build the domestic conflict deliberately. Use these devices this episode:\n${body}\nHard rules: both generations must have understandable stances (no cartoonishly evil in-laws/parents), never glorify filial piety pressure, son preference or domestic violence — portray them critically, conflicts come from real interests/values rather than terminal-illness/switched-baby melodrama, era props/prices/values must be historically accurate with no anachronism, reconciliation is earned step by step with real cost (never force a victim to forgive), and suffering is shown with dignity rather than milked for cheap tears.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧为家庭伦理/年代情感题材，家长里短的矛盾要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：代际冲突双方都要有可理解的立场，不把公婆/父母/任何一方脸谱化为纯恶；不美化愚孝、重男轻女与家暴，要批判性呈现；矛盾来自真实的利益与观念差异，不靠绝症/车祸/抱错孩子等狗血巧合；年代道具、物价、观念严格考据、不穿越；和解要分步骤、有代价，绝不用亲情绑架受害者强行原谅；苦难要有尊严地呈现，不消费苦难、不煽情卖惨。`;
}
