/**
 * 戏中戏 / 元叙事结构引擎（v2.24）
 * ------------------------------------------------------------------
 * 第十六套“类型机制引擎”，也是第一套【结构型】引擎（不绑定题材，可与任意题材引擎叠加）。
 * AI 写戏中戏的通病：层级混乱观众分不清在戏里还是现实、双层情节各说各话互不映照、
 * 跳层无规则随心所欲、戏中戏喧宾夺主、第四堵墙乱打破、道具伏笔不穿层、嵌套高潮对不齐、
 * 纯炫技没有主题。本模块沉淀 10 套装置（机理+技法+风险）；非该结构返回空串。纯函数、确定性、双语。
 */
export type MetaLang = 'zh' | 'en';
export interface MetaDevice {
  id: string;
  name: string; nameEn: string;
  principle: string; principleEn: string;
  technique: string; techniqueEn: string;
  risk: string; riskEn: string;
  kw: string[];
}
export const META_DEVICES: MetaDevice[] = [
  {
    id: 'layer_map', name: '双层地图清晰', nameEn: 'A clear two-layer map',
    principle: '戏中戏的第一前提是观众永远知道自己在哪一层：现实层与戏内层各有独立的人物、目标与规则，层级越清楚，跳层时的化学反应越强', principleEn: 'The precondition is that the audience always knows which layer it is in: reality and the inner play each have their own people, goals and rules, and clearer layers make crossing them hit harder',
    technique: '大纲阶段先画一张双层对照表：现实层有谁、要什么；戏内层演谁、演什么；两层共用哪些演员。开篇用一个明确信号（登台、喊开机、翻到剧本某页）建立入层规则，之后每次切层都复用同类信号', techniqueEn: 'In the outline build a two-layer table: who exists and wants what in reality, who is played and what happens in the inner play, and which actors are shared; open with one clear entry signal (taking the stage, “action”, turning to a script page) and reuse that family of signal for every layer switch',
    risk: '层数最多两层为主，三层嵌套观众必然迷路，非必要不叠三层', riskEn: 'Keep mainly two layers; a third nesting loses the audience—avoid unless essential',
    kw: ['戏中戏', '剧中剧', '元叙事', '双层', '嵌套', '台上台下', 'play within a play', 'story within a story', 'meta narrative', 'nested story', 'layers'],
  },
  {
    id: 'mirror_structure', name: '双层镜像互文', nameEn: 'Mirroring across layers',
    principle: '戏中戏不是两段无关故事的拼接：戏内层的情节必须像镜子一样照见现实层人物的处境与心结，观众在“对照”中获得双倍意味', principleEn: 'The inner story is not an unrelated second plot: it must mirror the reality characters’ predicament and inner knot, so contrast yields double meaning',
    technique: '为现实层每个核心困境在戏内层设计一个“变奏对应”（现实里不敢表白，戏里角色替他说；现实里背叛了兄弟，戏里恰好演一场出卖），并在关键集让两层处境形成对仗剪辑或并置台词；对应关系要让观众自己品出来，不靠角色解释', techniqueEn: 'Give each core real-world dilemma a variation inside the play (too shy to confess in life, his character says it; having betrayed a friend, he acts a betrayal on stage), and at key episodes place the two in parallel editing or paired lines; let the audience catch the mirror rather than explaining it',
    risk: '镜像要神似而非复刻，完全重复会显得偷懒，要有错位与变化', riskEn: 'Mirror in spirit, not shot-for-shot; exact repetition feels lazy—add displacement and variation',
    kw: ['镜像', '互文', '对照', '映照', '呼应', 'parallel', 'mirror', 'echo', 'foil', 'intertext'],
  },
  {
    id: 'boundary_leak', name: '边界渗漏与反讽', nameEn: 'Boundary leakage and irony',
    principle: '戏中戏最高级的张力来自“漏”：戏里一句台词意外说中现实真相、戏里动作戳到戏外的人，层与层之间的渗漏制造反讽、尴尬与钩子', principleEn: 'Its finest tension comes from leakage: an inner line accidentally nails a real-world truth or an inner gesture wounds someone offstage, producing irony, awkwardness and hooks at the seam',
    technique: '每 2-3 集安排一次受控渗漏：演员把现实情绪带进台词（对手演员一愣）、台下某人听到戏里台词脸色大变、道具被拿错导致戏词成了真话；渗漏后必须引发现实层的具体后果，不能只是抖机灵', techniqueEn: 'Stage one controlled leak every 2-3 episodes: an actor pours real feeling into a line (the scene partner freezes), someone offstage blanches at a line, a swapped prop turns stage dialogue into truth; each leak must trigger a concrete real-world consequence, not just a clever wink',
    risk: '渗漏要稀有才有力，每句台词都双关会让观众疲劳', riskEn: 'Leaks stay rare to stay powerful; double meanings in every line exhaust the audience',
    kw: ['说中', '穿帮', '双关', '反讽', '假戏真做', 'irony', 'leak', 'double meaning', 'art imitates life'],
  },
  {
    id: 'role_displacement', name: '选角即命运的错位', nameEn: 'Casting as fate',
    principle: '谁演谁本身就是戏：演员与角色在性格、经历、关系上的反差或重合，会让排练过程变成人物面对自我的过程，选角就是埋钩子', principleEn: 'Who plays whom is itself drama: the contrast or overlap between actor and role in personality, history and relationship turns rehearsal into self-confrontation; casting is a planted hook',
    technique: '选角时刻意制造一组张力关系（让闹矛盾的两人演情侣、让胆小的人演英雄、让真有隐情的人演凶手），用排练中的摩擦推动现实关系变化；终局让“角色的选择”倒逼演员做出自己的选择', techniqueEn: 'Cast for tension (two people in a feud play lovers, a coward plays the hero, someone hiding a secret plays the culprit), let rehearsal friction move the real relationship, and at the finale let the character’s choice force the actor’s own choice',
    risk: '错位要服务人物成长，不能只靠选角噱头撑完全剧', riskEn: 'Displacement serves growth; a casting gimmick alone cannot carry the show',
    kw: ['选角', '扮演', '演员', '角色与本人', '谁演谁', 'casting', 'playing a role', 'actor and character', 'cast as'],
  },
  {
    id: 'prop_crossing', name: '道具穿层伏笔', nameEn: 'Props that cross layers',
    principle: '一件在两层之间流转的道具是最省力的黏合剂：现实里的信物被带上台、戏里的道具被带回生活，道具每过一层就叠加一层意义，终局回收时格外有力', principleEn: 'A prop moving between layers is the leanest glue: a real token brought onstage or a stage prop carried into life gains meaning each crossing, paying off powerfully at the end',
    technique: '选 1-2 件核心道具做“穿层线”，在大纲标注它每次出现在哪层、含义如何变化（定情信物→戏里信物→被误会的证物→终局物归原主）；道具每次跨层都要被人物看见并产生反应', techniqueEn: 'Pick 1-2 core props as crossing threads and mark in the outline where each appears and how its meaning shifts (love token → stage token → mistaken evidence → finally returned); every crossing is noticed and reacted to',
    risk: '穿层道具不超过两件，多了线索散乱、回收不动', riskEn: 'Use at most two crossing props or the threads scatter and cannot pay off',
    kw: ['道具', '信物', '信物流转', '伏笔道具', 'prop', 'token', 'chekhov prop', 'recurring object'],
  },
  {
    id: 'rehearsal_setup', name: '排练即铺垫', nameEn: 'Rehearsal as setup',
    technique: '关键戏码先在排练里“不完美地来一遍”（忘词、笑场、改了台词、某人说这段演不出来），埋下它正式上演时会出什么变数；正式演出以变体重现，排练时的缺口正是高潮的引爆点', techniqueEn: 'Run the key scene imperfectly in rehearsal first (a forgotten line, corpsing, a rewritten beat, someone saying they cannot play it), seeding how it may vary in performance; the real show repeats it as a variation where the rehearsal gap becomes the ignition point',
    principle: '排练是天然的伏笔场：观众提前看过这段戏“应该怎么演”，正式上演时任何偏差都会被立刻察觉，张力不需要额外解释', principleEn: 'Rehearsal is a natural setup: having seen how the scene “should” go, the audience spots every deviation at once, with no extra explanation needed',
    risk: '排练片段要短，点到关键动作即可，避免整段重演拖节奏', riskEn: 'Keep rehearsal fragments short, hitting only the key beat to avoid pacing drag',
    kw: ['排练', '彩排', '对戏', '走台', 'rehearsal', 'dress rehearsal', 'run-through', 'blocking'],
  },
  {
    id: 'fourth_wall_rule', name: '第四堵墙有规则', nameEn: 'A rule-bound fourth wall',
    principle: '元叙事可以让角色“看见观众”，但打破第四堵墙必须有固定规则与次数上限：谁能打破、什么时候打破、打破后谁记得，规则一致才高级，随意出戏只会出戏', principleEn: 'Meta stories may let characters address the audience, but breaking the fourth wall needs fixed rules and a cap: who may break it, when, and who remembers afterward—consistent rules read as craft, random asides read as sloppiness',
    technique: '若用打破第四堵墙，开篇就立规则（只有主角能对镜头说话、且只在撒谎/揭秘时），全剧不超过 3-4 次，每次都推进信息或反转；不用则坚决不用，戏中戏本身已足够元，不必叠加旁白吐槽', techniqueEn: 'If used, set the rule up front (only the lead addresses camera, only when lying or revealing), cap it at 3-4 times, and each must advance information or a twist; otherwise do without—the play-within is already meta enough without running commentary',
    risk: '打破第四堵墙与戏中戏叠加要极度克制，两层元手法互相抢戏', riskEn: 'Combining fourth-wall breaks with a play-within is risky because two meta devices compete',
    kw: ['第四堵墙', '对镜头说话', '旁白', '打破次元', '观众', 'fourth wall', 'address the audience', 'meta wink', 'aside'],
  },
  {
    id: 'nested_climax', name: '嵌套高潮同频引爆', nameEn: 'Synchronized nested climaxes',
    principle: '戏中戏的高潮要“双响”：戏内层演到最高潮的同一刻，现实层的矛盾也必须到达顶点，两条线在同一个动作或同一句台词上同时引爆，情绪叠加而非轮流', principleEn: 'The climax fires twice at once: as the inner play peaks, the real-world conflict peaks too, both detonating on the same action or line so emotions stack rather than take turns',
    technique: '提前在大纲对齐两层的高潮时间点，设计一个“共用时刻”（戏里角色举枪的瞬间，台下真正的冲突方站起来；最后一句台词同时是戏的结尾和现实的告白）；高潮前让两条线各自逼近临界，最后用一个跨层动作合并', techniqueEn: 'Align both climax timelines in the outline and design a shared moment (as the stage character raises the prop gun, the real antagonist stands; the final line ends the play and delivers a real confession); drive both threads to criticality, then merge them with one cross-layer action',
    risk: '两条线高潮错开就会泄气，宁可删一条支线也要对齐', riskEn: 'Staggered climaxes deflate both; cut a subplot if needed to align them',
    kw: ['高潮', '同台引爆', '最后一幕', '公演', '首演', 'climax', 'opening night', 'final act', 'synchronized payoff'],
  },
  {
    id: 'transition_signal', name: '出入层信号统一', nameEn: 'Consistent layer-transition signals',
    principle: '观众的安全感来自可预期的转层语法：灯光、锣鼓、幕布、字体、音效中选定一套固定信号，入层与出层信号互为呼应，观众不用费力判断“现在是真是假”', principleEn: 'Audience security comes from a predictable grammar: choose one fixed family of signals (lighting, percussion, curtain, typeface, sound), make entry and exit mirror each other, so nobody struggles to tell real from staged',
    technique: '定一套转层词典并全剧复用（入层=追光+场记板声，出层=灯光大亮+嘈杂人声；AIGC 剧本则用统一镜头提示标注【戏内】【现实】）；每次转层只持续一个明确动作，不在一句话里来回跳', techniqueEn: 'Fix a transition vocabulary and reuse it all season (enter: spotlight + clapperboard; exit: lights up + ambient chatter; in AIGC scripts tag [INNER PLAY]/[REALITY] consistently); each switch lasts one clear action, never flickers within a single line',
    risk: '信号一旦确立不能中途换，换语法等于让观众重新学一遍', riskEn: 'Once set, never change the signal grammar mid-story or the audience must relearn it',
    kw: ['转场', '入戏', '出戏', '灯光', '幕布', 'transition', 'cut between layers', 'stage light', 'curtain'],
  },
  {
    id: 'theme_fold', name: '主题折叠归一', nameEn: 'Folding into one theme',
    principle: '戏中戏是容器不是目的：无论层与层怎么绕，最终都要折叠回同一个主题（什么是真、我是谁、戏如人生），形式花活必须让位于人物与主题，否则就是炫技空转', principleEn: 'The device is a vessel, not the point: however the layers twist, they fold back into one theme (what is real, who am I, life as theater); formal play serves character and theme or it spins empty',
    technique: '动笔前先用一句话写清“双层故事共同回答的问题”，每集自检戏内层情节是否在推进这个问题；终局让现实层人物用行动给出回答，戏中戏落幕，两层在主题上合二为一', techniqueEn: 'Before writing, state in one sentence the question both layers answer; each episode check the inner play advances it; at the end the real character answers through action, the inner play closes, and the layers merge thematically',
    risk: '若拿掉戏中戏结构后故事不成立，说明主题没立住，只是在靠结构遮羞', riskEn: 'If the story collapses without the meta structure, the theme was never strong enough',
    kw: ['主题', '戏如人生', '真假', '归一', '表达', 'theme', 'life as theater', 'real vs performed', 'meaning'],
  },
];

export const VALID_META_DEVICES = new Set(META_DEVICES.map((d) => d.id));
const BY_ID = new Map(META_DEVICES.map((d) => [d.id, d]));

const META_HINT = ['戏中戏', '剧中剧', '台上台下', '元叙事', '嵌套叙事', '戏里戏外', '排练演出', '话剧社', '剧团', '拍戏的戏', '片场真假', '演员演演员', 'play within a play', 'story within a story', 'meta narrative', 'metafiction', 'nested narrative', 'play-within', 'stage play inside', 'actors putting on a play'];
export function detectMeta(text: string): boolean {
  const t = (text || '').toLowerCase();
  return META_HINT.some((k) => t.includes(k.toLowerCase()));
}

export function pickMetaDevices(text: string, n = 3): MetaDevice[] {
  const t = (text || '').toLowerCase();
  const hit = META_DEVICES.filter((d) => d.kw.some((k) => t.includes(k.toLowerCase())));
  const out: MetaDevice[] = [];
  hit.forEach((d) => { if (out.length < n) out.push(d); });
  // 通用三件套兜底：层级地图（地基）+ 镜像互文（类型魂）+ 主题归一（不炫技）
  const fallback = ['layer_map', 'mirror_structure', 'theme_fold'];
  for (const id of fallback) { if (out.length >= n) break; const d = BY_ID.get(id)!; if (!out.includes(d)) out.push(d); }
  META_DEVICES.forEach((d) => { if (out.length < n && !out.includes(d)) out.push(d); });
  return out.slice(0, n);
}

export function buildMetaDirective(text: string, lang: MetaLang = 'zh', n = 3): string {
  if (!detectMeta(text)) return '';
  const ds = pickMetaDevices(text, n);
  if (lang === 'en') {
    const body = ds.map((d) => `· ${d.nameEn} — ${d.techniqueEn} (risk: ${d.riskEn})`).join('\n');
    return `This story uses a PLAY-WITHIN-A-PLAY / META-NARRATIVE structure (it stacks on top of any genre). Engineer the two layers deliberately. Use these devices this episode:\n${body}\nHard rules: the audience must always know which layer it is in (mainly two layers, consistent transition signals), the inner plot mirrors the real predicament rather than running unrelated, layer leaks and fourth-wall breaks are rare and rule-bound with real consequences, rehearsal and cross-layer props are planted before they pay off, the two climaxes detonate on the same shared moment, and every formal twist folds back to one theme instead of empty showing-off. Do not lift dialogue or plot from any real existing play or film.`;
  }
  const body = ds.map((d) => `· ${d.name}——${d.technique}（风险：${d.risk}）`).join('\n');
  return `本剧采用“戏中戏/元叙事”结构（结构型手法，可与任意题材叠加）。两层关系要被“设计”出来。本集重点使用以下装置：\n${body}\n硬性要求：观众任何时刻都分得清现实层与戏内层（以两层为主、转层信号全剧统一）；戏内层情节必须镜像映照现实困境，不能各说各话；边界渗漏与打破第四堵墙要稀有、有规则、有现实后果；排练与穿层道具必须先铺垫后回收；双层高潮在同一个共用时刻同频引爆；一切形式花活最终折叠回同一个主题，杜绝炫技空转；不照搬任何真实现有剧目/影视的台词与情节。`;
}
