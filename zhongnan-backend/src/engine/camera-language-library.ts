/**
 * 导演镜头语言编码库（v2.149）
 * ------------------------------------------------------------------
 * 灵感来源：抖音"不同等级编导AI做漫剧"——L3 高手编导的核心是"人定标准、AI 量产"：
 * 把镜头语言（景别节奏/运镜性格/转场逻辑/情绪压缩）沉淀成强约束编码，AI 在约束内生产。
 * 本库与 visual-style-library.ts（画面层：长什么样）平行互补——
 * 文字层管"怎么说"（style-library），画面层管"长什么样"（visual-style-library），
 * 镜头层管"怎么拍"（本库）。三库共同构成 AIGC 漫剧的制作标准层。
 *
 * 能力：
 *  - resolveCameraStyle：编号 → 镜头语言节点（含镜头语法/适配/禁配题材）
 *  - buildCameraStylePrompt：编号 → 完整英文镜头语言 prompt 段（供分镜导出附录/视频生成注入）
 *  - recommendCameraStyle：按剧题材 genre ids 打分推荐（命中适配 +1，命中禁配 -2）
 *  - listCameraStyles：全量清单（前端选择器契约，与 /visual-styles 同风格）
 */
export interface CameraStyleNode {
  id: string;              // 编号，CL01~CL12
  label: string;           // 中文名
  enPrompt: string;        // 英文镜头语言 prompt 段（拼接用，描述节奏/运镜/转场）
  grammar: string;         // 中文镜头语法：景别节奏 × 运镜 × 转场 × 情绪压缩（一句话强约束）
  suitedGenres: string[];  // 适配题材（genre-compensate 的 genre id）
  bannedGenres: string[];  // 禁配题材（镜头气质与题材节奏错配）
  keywords: string[];      // 镜头语言关键词（中文，供 UI 展示与质检对齐）
  note: string;            // 使用建议（一句话）
}

/** 题材 id 对齐 genre-compensate.ts GENRE_COMPENSATION */
export const CAMERA_STYLES: CameraStyleNode[] = [
  {
    id: 'CL01', label: '快切直给爽点流',
    enPrompt: 'rapid cutting rhythm, quick push-in on emotional peaks, punchy close-ups for reactions, whip transitions between beats, high-energy pacing with escalating tension',
    grammar: '近景高频直给，情绪峰值秒级推镜，硬切转场，每 15 秒一次爽点压缩',
    suitedGenres: ['rebirth', 'invincible', 'cutTies'], bannedGenres: ['farming', 'tragedyTurn', 'metaDrama'],
    keywords: ['快切', '秒推情绪', '硬切'], note: '复仇/战神/断亲的节奏引擎，治愈与虐心向禁配（节奏错位）',
  },
  {
    id: 'CL02', label: '长镜压迫悬疑流',
    enPrompt: 'slow creeping camera movement, prolonged unbroken shots building dread, gradual zoom-in on details, heavy silence before reveals, suffocating atmosphere',
    grammar: '长镜缓推不剪，细节渐近放大，留白压情绪，揭底前静默一拍',
    suitedGenres: ['tragedyTurn', 'mindRead'], bannedGenres: ['metaDrama', 'farming', 'invincible'],
    keywords: ['长镜', '缓推', '静默压场'], note: '黑化/读心的压迫感来源，快节奏喜剧禁配（会闷场）',
  },
  {
    id: 'CL03', label: '手持纪实临场流',
    enPrompt: 'handheld documentary camera feel, subtle natural shake, following shots behind characters, immediate on-the-ground perspective, raw immersive framing',
    grammar: '手持跟拍微晃，过肩跟进入事件，临场感优先于构图美感',
    suitedGenres: ['mindRead', 'lowProfile', 'system'], bannedGenres: ['cutTies', 'metaDrama'],
    keywords: ['手持跟拍', '临场感', '纪实框'], note: '都市异能/扮猪吃虎的网感来源，宅斗对称构图题材禁配',
  },
  {
    id: 'CL04', label: '推拉戏剧变交流',
    enPrompt: 'dramatic fast push-in and pull-out, punch zoom on emotional outbursts, exaggerated perspective shifts, theatrical camera accents on dialogue hits',
    grammar: '台词重音即急推急拉，变焦打点，把每句狠话拍成重锤',
    suitedGenres: ['saneMadman', 'invincible'], bannedGenres: ['farming', 'lowProfile'],
    keywords: ['急推急拉', '变焦打点', '戏剧重音'], note: '发疯流/战神爆发的情绪放大器，慢节奏治愈禁配',
  },
  {
    id: 'CL05', label: '环绕高光展示流',
    enPrompt: 'orbiting camera around hero at reveal moments, slow-motion showcase with rotating angle, dramatic low-to-high sweep, spotlight composition for power displays',
    grammar: '高光时刻环绕运镜+慢速展示，仰角上摇把气势顶满',
    suitedGenres: ['invincible', 'system', 'rebirth'], bannedGenres: ['tragedyTurn', 'lowProfile'],
    keywords: ['环绕运镜', '慢速展示', '仰角上摇'], note: '战神/系统打脸高光的标配，扮猪吃虎前期禁用（提前泄实力）',
  },
  {
    id: 'CL06', label: '静帧情绪定格流',
    enPrompt: 'still frame with subtle micro-motion, frozen emotional moments, held silence on faces, minimal camera breathing, painterly composition in pauses',
    grammar: '情绪顶点定格一拍，画面微动不死板，留白交给表情与呼吸',
    suitedGenres: ['cutLover', 'tragedyTurn'], bannedGenres: ['metaDrama', 'saneMadman'],
    keywords: ['情绪定格', '微动', '留白'], note: '虐恋/黑化的情绪定格杀，元叙事喜剧禁配（节奏会断）',
  },
  {
    id: 'CL07', label: '跳切元喜剧流',
    enPrompt: 'jump cuts with comedic timing, fourth-wall aware framing glances to camera, abrupt scene transitions as gags, playful rhythm breaking expectations',
    grammar: '跳切当包袱用，突兀转场即笑点，节奏永远快观众半拍',
    suitedGenres: ['metaDrama', 'saneMadman'], bannedGenres: ['tragedyTurn', 'cutTies', 'cutLover'],
    keywords: ['跳切', '突兀转场', '包袱节奏'], note: '元叙事/发疯喜剧的呼吸方式，虐心宅斗禁配',
  },
  {
    id: 'CL08', label: '慢摇治愈长镜流',
    enPrompt: 'slow gentle panning shots, unhurried ambient pacing, wide establishing shots of daily life, warm lingering frames, meditative rhythm',
    grammar: '缓摇全景开场，日常长镜不催，暖光停留，情绪按分钟发酵',
    suitedGenres: ['farming', 'cutLover'], bannedGenres: ['invincible', 'saneMadman', 'tragedyTurn'],
    keywords: ['缓摇全景', '日常长镜', '暖光停留'], note: '种田基建/清新恋爱的底节奏，强对抗题材禁配',
  },
  {
    id: 'CL09', label: '第一人称代入流',
    enPrompt: 'first-person POV shots, subjective camera as character eyes, direct immersive perspective during key reveals, intimate close proximity framing',
    grammar: '关键揭底切主观视角，镜头即角色之眼，近距离代入感拉满',
    suitedGenres: ['mindRead', 'system'], bannedGenres: ['cutTies', 'metaDrama'],
    keywords: ['主观视角', 'POV', '近距离代入'], note: '读心/系统面板的体验感来源，对称构图题材禁配',
  },
  {
    id: 'CL10', label: '俯仰权势镜头流',
    enPrompt: 'low-angle shots for dominance, high-angle shots for vulnerability, power-dynamic camera tilt on status shifts, hierarchical framing in confrontations',
    grammar: '地位反转即俯仰反转：仰拍压人、俯拍示弱，构图即权力关系',
    suitedGenres: ['cutTies', 'rebirth', 'invincible'], bannedGenres: ['farming', 'metaDrama'],
    keywords: ['仰拍俯拍', '权力构图', '地位反转'], note: '宅斗/复仇的地位语言，平视治愈系禁配',
  },
  {
    id: 'CL11', label: '蒙太奇时间压缩流',
    enPrompt: 'montage sequences compressing time, rhythmic parallel editing across scenes, growth and change shown in rapid vignettes, musical pacing across cuts',
    grammar: '成长/布局用蒙太奇压缩，平行剪辑跨线推进，踩点成段',
    suitedGenres: ['system', 'rebirth', 'cutLover'], bannedGenres: ['tragedyTurn'],
    keywords: ['蒙太奇', '平行剪辑', '时间压缩'], note: '系统升级/重逢回忆杀的效率工具，重度虐心沉浸段禁配',
  },
  {
    id: 'CL12', label: '稳定对称仪式流',
    enPrompt: 'stable symmetrical composition, formal centered framing, ritual-like static camera, ceremonial pacing for authority scenes, precise geometric blocking',
    grammar: '居中对称构图，机位稳如仪轨，正式场合零晃动，秩序感即压迫感',
    suitedGenres: ['cutTies', 'lowProfile'], bannedGenres: ['saneMadman', 'metaDrama', 'invincible'],
    keywords: ['对称构图', '仪式机位', '秩序感'], note: '宅斗宫斗/扮猪吃虎的礼法底色，爆发戏切回 CL01/CL04',
  },
];

const CAMERA_MAP = new Map(CAMERA_STYLES.map((s) => [s.id, s]));

/** 编号 → 镜头语言节点；非法编号返回 null（调用方决定兜底） */
export function resolveCameraStyle(id: string): CameraStyleNode | null {
  return CAMERA_MAP.get(id) ?? null;
}

/** 编号 → 完整英文镜头语言 prompt 段（供分镜导出附录/视频生成注入）；非法编号返回空串 */
export function buildCameraStylePrompt(id: string): string {
  const s = CAMERA_MAP.get(id);
  return s ? `${s.enPrompt}. Consistent camera language across all shots, unified shot-size rhythm and movement logic` : '';
}

/**
 * 按剧题材 genre ids 打分推荐：命中适配 +1，命中禁配 -2，其余按库序。
 * 返回按分数降序的节点列表（前端可取首个为默认推荐）。
 */
export function recommendCameraStyle(genreIds: string[]): CameraStyleNode[] {
  const g = new Set((genreIds || []).filter(Boolean));
  const scored = CAMERA_STYLES.map((s) => {
    let score = 0;
    for (const id of g) {
      if (s.suitedGenres.includes(id)) score += 1;
      if (s.bannedGenres.includes(id)) score -= 2;
    }
    return { s, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.s);
}

/** 全量清单（前端选择器契约，与 /visual-styles 同风格） */
export function listCameraStyles(): CameraStyleNode[] {
  return CAMERA_STYLES;
}

/** 前端请求体校验：合法镜头语言编号（含 undefined/null 直通，由调用方决定可选性） */
export function isValidCameraStyleId(id: unknown): id is string {
  return typeof id === 'string' && CAMERA_MAP.has(id);
}
