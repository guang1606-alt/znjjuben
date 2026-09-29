/**
 * 视觉画风编码库（v2.148）
 * ------------------------------------------------------------------
 * 灵感来源：抖音"261种手绘插画风做成编码直接生图"——把海量画风压缩成
 * "编号 + 可执行 prompt 模板"的索引库，使用时"编号 + 内容"即可调用。
 * 本库按竖屏短剧 AIGC（漫剧/动态漫）场景收敛为 12 个画风族系，每个编号不是空标签，
 * 而是可执行参数：画材质感、线条、色彩、渲染关键词（英文 prompt 段，拼进生图/视频提示词）。
 * 与 style-library.ts（文字风格：台词语言层）平行，互不替代——
 * 文字层管"怎么说"，视觉层管"长什么样"。
 *
 * 能力：
 *  - resolveVisualStyle：编号 → 画风节点（含适配/禁配题材）
 *  - buildVisualStylePrompt：编号 → 完整英文画风 prompt 段（供分镜导出附录/海报生图注入）
 *  - recommendVisualStyle：按剧题材 genre ids 打分推荐（命中适配 +1，命中禁配 -2）
 *  - listVisualStyles：全量清单（前端选择器 /modes 式契约）
 */
export interface VisualStyleNode {
  id: string;              // 编号，VS01~VS12
  label: string;           // 中文名
  enPrompt: string;        // 英文画风 prompt 段（拼接用，不含镜头内容）
  suitedGenres: string[];  // 适配题材（genre-compensate 的 genre id）
  bannedGenres: string[];  // 禁配题材（视觉气质与题材错配）
  keywords: string[];      // 质感关键词（中文，供 UI 展示与质检对齐）
  note: string;            // 使用建议（一句话）
}

/** 题材 id 对齐 genre-compensate.ts GENRE_COMPENSATION */
export const VISUAL_STYLES: VisualStyleNode[] = [
  {
    id: 'VS01', label: '水墨国风',
    enPrompt: 'Chinese ink wash painting style, flowing ink gradients, rice paper texture, expressive brush strokes, muted ink tones with occasional vermilion accent, generous negative space, misty atmosphere',
    suitedGenres: ['system'], bannedGenres: ['cutLover', 'saneMadman'],
    keywords: ['宣纸质感', '墨色晕染', '留白'], note: '仙侠玄幻气质首选，现代都市题材慎用（易出戏）',
  },
  {
    id: 'VS02', label: '韩漫厚涂',
    enPrompt: 'Korean webtoon semi-realistic style, rich digital painting, soft volumetric lighting, detailed skin rendering, dramatic rim light, cinematic color grading, high contrast emotional lighting',
    suitedGenres: ['rebirth', 'cutTies', 'cutLover', 'invincible'], bannedGenres: ['farming'],
    keywords: ['厚涂质感', '电影打光', '情绪高对比'], note: '都市复仇/情感冲突的视觉重炮，情绪戏冲击力最强',
  },
  {
    id: 'VS03', label: '日系赛璐璐',
    enPrompt: 'Japanese anime cel-shading style, clean line art, flat colors with two-tone shading, bright expressive eyes, crisp highlights, nostalgic 90s anime palette, clean backgrounds',
    suitedGenres: ['mindRead', 'metaDrama'], bannedGenres: ['tragedyTurn'],
    keywords: ['赛璐璐上色', '清晰勾线', '平涂二分'], note: '青春感强、台词驱动题材友好；重度黑化虐文慎用（气质偏轻）',
  },
  {
    id: 'VS04', label: '手绘绘本蜡笔',
    enPrompt: 'Hand-drawn picture book illustration, crayon and colored pencil texture, warm naive art style, soft rounded shapes, visible paper grain, childlike warmth, gentle imperfect lines',
    suitedGenres: ['farming'], bannedGenres: ['cutTies', 'saneMadman'],
    keywords: ['蜡笔颗粒', '童趣线条', '纸纹'], note: '种田基建/治愈向的暖感来源，强冲突题材禁配',
  },
  {
    id: 'VS05', label: '美漫硬朗',
    enPrompt: 'American comic book style, bold ink outlines, dynamic hatching, strong muscle and fabric definition, halftone dot accents, punchy saturated colors, heroic dramatic angles',
    suitedGenres: ['invincible', 'saneMadman'], bannedGenres: ['farming', 'mindRead'],
    keywords: ['粗描边', '排线阴影', '高饱和'], note: '战神/发疯流的力量感放大器，适合爆发场面多的剧',
  },
  {
    id: 'VS06', label: '3D 皮克斯风',
    enPrompt: 'Pixar-style 3D animation render, soft global illumination, rounded stylized character proportions, expressive squash-and-stretch feel, subsurface scattering skin, warm cinematic depth of field',
    suitedGenres: ['metaDrama', 'system'], bannedGenres: ['tragedyTurn', 'cutTies'],
    keywords: ['3D 渲染', '柔和全局光', 'Q弹比例'], note: '合家欢/轻喜剧气质，虐心题材禁配（观感违和）',
  },
  {
    id: 'VS07', label: '国潮插画',
    enPrompt: 'Modern Chinese neo-traditional guochao illustration, flat vector shapes with traditional motifs, auspicious cloud and wave patterns, red-gold-teal palette, contemporary composition with classical elements',
    suitedGenres: ['rebirth', 'system'], bannedGenres: ['tragedyTurn'],
    keywords: ['国潮配色', '传统纹样', '现代构图'], note: '国风与现代混搭题材的中间档，古装都市都压得住',
  },
  {
    id: 'VS08', label: '暗黑哥特线稿',
    enPrompt: 'Dark gothic ink illustration, heavy cross-hatching, deep black shadows with single dramatic light source, desaturated palette with blood-red accent, unsettling fine details, etching texture',
    suitedGenres: ['tragedyTurn'], bannedGenres: ['farming', 'metaDrama', 'cutLover', 'saneMadman'],
    keywords: ['交叉排线', '深黑阴影', '单光源'], note: '黑化/悬疑惊悚的视觉底色，亮度低的场景表现力最佳',
  },
  {
    id: 'VS09', label: '水彩淡彩',
    enPrompt: 'Soft watercolor illustration, translucent washes, blooming pigment edges, warm daylight palette, delicate ink linework underneath, dreamy soft focus, paper texture showing through',
    suitedGenres: ['farming', 'cutLover'], bannedGenres: ['saneMadman', 'tragedyTurn'],
    keywords: ['水彩晕染', '通透叠色', '淡彩'], note: '慢节奏治愈与清新恋爱向；强对抗场面易显轻飘',
  },
  {
    id: 'VS10', label: '赛博霓虹',
    enPrompt: 'Cyberpunk neon illustration, rain-slicked streets reflecting magenta and cyan glow, volumetric haze, high-tech low-life atmosphere, chromatic aberration, dark background with luminous accents',
    suitedGenres: ['system', 'saneMadman'], bannedGenres: ['farming', 'cutTies'],
    keywords: ['霓虹反射', '体积雾', '暗底发光'], note: '都市异能/未来感题材专属，年代剧禁用',
  },
  {
    id: 'VS11', label: '工笔重彩',
    enPrompt: 'Traditional Chinese gongbi fine brush painting, meticulous detailed linework, rich mineral pigment colors, ornate silk texture, formal symmetrical composition, imperial gold and jade accents',
    suitedGenres: ['cutTies'], bannedGenres: ['saneMadman', 'lowProfile'],
    keywords: ['工笔勾线', '矿物重彩', '绢本质感'], note: '宅斗宫斗的华贵底色，正式感强、节奏快的爽剧慎用',
  },
  {
    id: 'VS12', label: '极简线条',
    enPrompt: 'Minimalist line art illustration, single-weight clean lines, limited two-color palette, generous white space, geometric composition, flat modern editorial style',
    suitedGenres: ['metaDrama'], bannedGenres: ['tragedyTurn'],
    keywords: ['单线描边', '极简构图', '大留白'], note: '元叙事/快节奏喜剧的轻装上阵，情绪戏不宜',
  },
];

const STYLE_MAP = new Map(VISUAL_STYLES.map((s) => [s.id, s]));

/** 编号 → 画风节点；非法编号返回 null（调用方决定兜底） */
export function resolveVisualStyle(id: string): VisualStyleNode | null {
  return STYLE_MAP.get(id) ?? null;
}

/** 编号 → 完整英文画风 prompt 段（供分镜导出附录/海报生图注入）；非法编号返回空串 */
export function buildVisualStylePrompt(id: string): string {
  const s = STYLE_MAP.get(id);
  return s ? `${s.enPrompt}. Consistent art style across all shots, unified palette and linework` : '';
}

/**
 * 按剧题材 genre ids 打分推荐：命中适配 +1，命中禁配 -2，其余按库序。
 * 返回按分数降序的节点列表（前端可取首个为默认推荐）。
 */
export function recommendVisualStyle(genreIds: string[]): VisualStyleNode[] {
  const g = new Set((genreIds || []).filter(Boolean));
  const scored = VISUAL_STYLES.map((s) => {
    let score = 0;
    for (const id of g) {
      if (s.suitedGenres.includes(id)) score += 1;
      if (s.bannedGenres.includes(id)) score -= 2;
    }
    return { s, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.s);
}

/** 全量清单（前端选择器契约，与 /modes 同风格） */
export function listVisualStyles(): VisualStyleNode[] {
  return VISUAL_STYLES;
}

/** 前端请求体校验：合法画风编号（含 undefined/null 直通，由调用方决定可选性） */
export function isValidVisualStyleId(id: unknown): id is string {
  return typeof id === 'string' && STYLE_MAP.has(id);
}
