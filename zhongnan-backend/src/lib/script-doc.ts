/**
 * 剧本导出文档模型（PRD 2.5 / 用户硬性要求）。
 * 纯数据、纯函数，不依赖 docx/pdfkit，便于单测：
 *  - 下载文件必须自带：封面、故事大纲、人物小传、分集目录、完整分集正文
 *  - 页脚必须有“第 X 页 共 Y 页”（由 docx/pdf 渲染器落地，分页逻辑在本文件 paginate）
 *  - 水印按会员等级：ADVANCED 及以上可去水印，其余带「平台 · 笔名」水印
 */
import { MemberLevel } from '../config/pricing';
import { BRAND } from '../config/brand';
import { latestScripts } from './latest-scripts';
import { buildShotManifest } from '../engine/aigc-screenplay';
import { analyzeAigcComposition } from '../engine/aigc-screenplay';
import { resolveVisualStyle, buildVisualStylePrompt } from '../engine/visual-style-library'; // v2.148 视觉画风编码库（分镜附录画风锚点注入）
import { resolveCameraStyle, buildCameraStylePrompt } from '../engine/camera-language-library'; // v2.149 镜头语言编码库（分镜附录镜头锚点注入）
import { buildEmotionWave, dominantEmotionOf } from '../engine/emotion-wave';
import { normalizeBeatPref } from '../engine/beat-system';
import { waveTextLines, describeRhythm, type ChartWave } from './wave-chart';
import { buildHookMap, formatHookMapLines } from './hook-map';
import { buildBeatChain, formatBeatChainLines } from './beat-chain';
import { buildCastArcPage, formatCastArcLines, normalizeBibleCharacters } from './cast-arc';
import { buildProductionMaterials, formatMaterialsLines } from '../engine/production-materials'; // v2.154 制作物料清单（制片交付页）
import { normalizeCuePref } from '../agents/pipeline';

export type ExportFormat = 'docx' | 'pdf' | 'txt';

/** 导出文档内的波形块（纯数据、可序列化，docx/pdf 渲染器各自画图） */
export type ExportWave = ChartWave & { lang: 'zh' | 'en'; textLines: string[] };

export type DocBlock =
  | { kind: 'cover'; title: string; meta: string[] }
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'toc'; items: { ep: number; title: string; synopsis: string }[] }
  | { kind: 'waveChart'; wave: ExportWave }
  | { kind: 'epStart'; ep: number; title: string }
  | { kind: 'para'; text: string };

export interface ScriptDoc {
  title: string;
  blocks: DocBlock[];
  watermark: string | null;
  epCount: number;
}

/** 等级序数，用于门控比较 */
export const LEVEL_RANK: Record<MemberLevel, number> = {
  [MemberLevel.FREE]: 0, [MemberLevel.BASIC]: 1, [MemberLevel.ADVANCED]: 2, [MemberLevel.PRO]: 3,
};
/** 各格式所需最低会员等级（txt 登录即可） */
export const EXPORT_MIN_LEVEL: Record<ExportFormat, MemberLevel> = {
  txt: MemberLevel.FREE, docx: MemberLevel.BASIC, pdf: MemberLevel.ADVANCED,
};
export function canExport(level: MemberLevel | string | undefined, fmt: ExportFormat): boolean {
  const lv = (level ?? MemberLevel.FREE) as MemberLevel;
  return LEVEL_RANK[lv] >= LEVEL_RANK[EXPORT_MIN_LEVEL[fmt]];
}
/** 去水印最低 ADVANCED */
export function canRemoveWatermark(level: MemberLevel | string | undefined): boolean {
  return LEVEL_RANK[(level ?? MemberLevel.FREE) as MemberLevel] >= LEVEL_RANK[MemberLevel.ADVANCED];
}
/** v2.36 机器分镜附录导出：ADVANCED+（创收点，免费/基础仅给构成概览） */
export function canExportShotList(level: MemberLevel | string | undefined): boolean {
  return LEVEL_RANK[(level ?? MemberLevel.FREE) as MemberLevel] >= LEVEL_RANK[MemberLevel.ADVANCED];
}

interface ScriptLike { epNo: number; version?: number; title: string; synopsis?: string | null; content: string; wordCount?: number }
interface ProjectLike {
  title: string; mode?: string; format?: string; totalEps?: number;
  bible?: unknown; createdAt?: Date | string;
}

interface NormalizedBible {
  worldview?: string;
  timeline: string[]; foreshadow: string[];
  characters: Record<string, { traits?: string; arc?: string; voice?: string; visualAnchor?: string }>;
}

// v2.193 c193 复盘：旧 asBible 只验顶层是对象就强转（注释声称"完全容错"实为谎言），
// 故事大纲/人物小传段在 try 之外裸读子字段——foreshadow 为字符串时 .filter TypeError（导出 500）、
// characters 数组形态产出"0/1"索引名、null 元素 c.traits 炸、非字符串字段模板强转污染（123/[object Object]）。
// 归一器逐字段兑现契约：worldview 仅接受非空 string；timeline/foreshadow 接受 string（视为单条，
// 保留信息不截首字）或 string[]（非字符串元素丢弃）；characters 同源复用 normalizeBibleCharacters。
// 供 generate.ts/market.ts 的 timeline synopsis 读取同源复用（c191 同口径同源铁律）。
export function normalizeBibleDoc(input: unknown): NormalizedBible {
  const o = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const asStringList = (v: unknown): string[] => {
    if (typeof v === 'string') { const s = v.trim(); return s ? [v] : []; }
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  };
  const worldview = typeof o.worldview === 'string' && o.worldview.trim() ? o.worldview : undefined;
  return {
    worldview,
    timeline: asStringList(o.timeline),
    foreshadow: asStringList(o.foreshadow),
    characters: normalizeBibleCharacters(o.characters),
  };
}

// 仅用于读取归一契约外的自由偏好字段（beatPrefs/hookPrefs），保持 unknown 不信任读取
function asBibleRaw(b: unknown): Record<string, unknown> {
  return b && typeof b === 'object' ? b as Record<string, unknown> : {};
}

/**
 * 组装导出文档模型。对 bible 缺字段/异常结构完全容错（老项目也能导出）。
 */
export function buildScriptDoc(
  project: ProjectLike,
  scripts: ScriptLike[],
  opts: { penName?: string | null; noWatermark?: boolean; level?: MemberLevel | string; now?: Date; includeShotList?: boolean; visualStyleId?: string; cameraStyleId?: string } = {},
): ScriptDoc {
  const eps = latestScripts(scripts);
  const bible = normalizeBibleDoc(project.bible); // v2.193 c193 真归一：契约内字段恒为声明类型
  const bibleRaw = asBibleRaw(project.bible);    // 归一契约外的自由偏好（beatPrefs/hookPrefs）
  const level = (opts.level ?? MemberLevel.FREE) as MemberLevel;
  const pen = (opts.penName || '').trim();
  const watermark = opts.noWatermark && canRemoveWatermark(level)
    ? null
    : [BRAND.fullName, pen].filter(Boolean).join(' · ');
  const now = opts.now ?? new Date();
  const blocks: DocBlock[] = [];

  // ① 封面
  blocks.push({
    kind: 'cover', title: project.title,
    meta: [
      `创作模式：${project.mode ?? '-'}　剧本制式：${project.format ?? 'LIVE_ACTION'}`,
      `共 ${eps.length || project.totalEps || 0} 集　总字数：${eps.reduce((s, e) => s + (e.wordCount || (e.content || '').length), 0)}`,
      `导出时间：${now.toLocaleString('zh-CN')}`,
      ...(watermark ? [`水印：${watermark}`] : []),
    ],
  });

  // ② 故事大纲（字段均已归一：string / string[]，无裸读炸点）
  blocks.push({ kind: 'h1', text: '故事大纲' });
  const logline = bible.timeline[0] || eps[0]?.synopsis || '';
  blocks.push({ kind: 'p', text: logline || '（暂无一句话梗概）' });
  if (bible.worldview) blocks.push({ kind: 'p', text: `世界观：${bible.worldview}` });
  if (bible.foreshadow.length) {
    blocks.push({ kind: 'p', text: `主线伏笔：${bible.foreshadow.join('；')}` });
  }

  // ③ 人物小传（v2.193 c193：归一后恒为对象形态 Record<string,{string?}>，无索引名/错型污染）
  blocks.push({ kind: 'h1', text: '人物小传' });
  const chars = Object.entries(bible.characters);
  if (!chars.length) {
    blocks.push({ kind: 'p', text: '（人物设定随创作过程沉淀，详见分集正文）' });
  } else {
    chars.forEach(([name, c]) => {
      blocks.push({ kind: 'h2', text: name });
      const lines: string[] = [];
      if (c.traits) lines.push(`性格特质：${c.traits}`);
      if (c.arc) lines.push(`成长弧线：${c.arc}`);
      if (c.voice) lines.push(`语言风格：${c.voice}`);
      if (c.visualAnchor) lines.push(`视觉锚点：${c.visualAnchor}`);
      blocks.push({ kind: 'p', text: lines.join('\n') || '（详见正文）' });
    });
  }

  // ④ 分集目录
  blocks.push({ kind: 'h1', text: '分集目录' });
  blocks.push({
    kind: 'toc',
    items: eps.map((e) => ({ ep: e.epNo, title: e.title || `第${e.epNo}集`, synopsis: e.synopsis || '' })),
  });

  // ④.5 全剧情绪节奏·导演页（v2.59）：与创作管线同源的确定性波形，让出品方/买家一眼看到节奏设计
  try {
    const joined = eps.map((e) => e.content || '').join('');
    const wlang: 'zh' | 'en' = /[\u4e00-\u9fff]/.test(joined) ? 'zh' : 'en';
    let beatPrefs: unknown = undefined;
    try { beatPrefs = bibleRaw.beatPrefs; } catch { beatPrefs = undefined; }
    const wn = eps.length || project.totalEps || 1;
    const em = buildEmotionWave(wn, normalizeBeatPref(beatPrefs as never));
    const exportWave: ExportWave = {
      episodeCount: em.episodeCount,
      avgIntensity: em.avgIntensity,
      peakEp: em.peakEp,
      flatWarn: em.flatWarn,
      range: em.range,
      lang: wlang,
      points: em.points.map((p) => {
        const dom = dominantEmotionOf(p);
        return { ep: p.ep, intensity: p.intensity, valence: p.valence, emoZh: dom?.shortZh, emoEn: dom?.shortEn };
      }),
      textLines: [],
    };
    exportWave.textLines = waveTextLines(exportWave, wlang);
    const rhythmLines = describeRhythm(exportWave, wlang);
    blocks.push({ kind: 'h1', text: wlang === 'en' ? 'Emotion Rhythm Chart (Director Page)' : '全剧情绪节奏图（导演页）' });
    blocks.push({
      kind: 'p',
      text: wlang === 'en'
        ? 'Deterministic series-wide tension curve, same engine as generation. Intensity 0-100: red ≥80 peak, amber 60-79 drive, blue <60 breathing room; the tag on each point is its dominant emotion beat.'
        : '本图与实际创作管线同源、确定性可复现：纵轴为情绪张力（0-100），红点≥80为高能峰值、琥珀60-79为推进段、蓝点<60为呼吸留白段；点旁标注本集主导情绪拍；逐集压放交替、有压必放。',
    });
    blocks.push({ kind: 'waveChart', wave: exportWave });
    // v2.60 节奏体检结论先行，再给火花线与逐集张力/主情绪
    rhythmLines.forEach((t) => blocks.push({ kind: 'p', text: t }));
    exportWave.textLines.forEach((t) => blocks.push({ kind: 'p', text: t }));
  } catch {
    // 波形页任何异常都不得阻断导出主流程
  }

  // ④.6 逐集钩子地图·钩子编排页（v2.61）：四层钩子同源排布，与情绪页相邻，构成完整导演交付包
  try {
    const joined2 = eps.map((e) => e.content || '').join('');
    const hlang: 'zh' | 'en' = /[一-鿿]/.test(joined2) ? 'zh' : 'en';
    let hookPrefs: unknown = undefined;
    try { hookPrefs = bibleRaw.hookPrefs; } catch { hookPrefs = undefined; }
    // 无显式每集场景数时，取默认「标准张弛流」区间[3,5]中位 4，与管线缺省口径一致
    const hn = eps.length || project.totalEps || 1;
    const hookMap = buildHookMap(hn, 4, normalizeCuePref(hookPrefs as never));
    blocks.push({ kind: 'h1', text: hlang === 'en' ? 'Episode Hook Map (Hook Design Page)' : '逐集钩子地图（钩子编排页）' });
    blocks.push({
      kind: 'p',
      text: hlang === 'en'
        ? 'Four hook layers planned deterministically from the same engine as generation: golden-3-seconds opening hook, end-of-scene pulls, sentence-level micro hooks (action/line/atmosphere/emotion/information-gap/foreshadow), and the episode-end cliff.'
        : '四层钩子与实际创作管线同源、确定性可复现：黄金3秒开场钩、场末牵引、句子级微钩（动作/语言/氛围/情绪/信息差/伏笔）、集尾卡点；逐集排布、轮换防疲劳。',
    });
    formatHookMapLines(hookMap, hlang).forEach((t) => blocks.push({ kind: 'p', text: t }));
  } catch {
    // 钩子页异常同样不阻断导出
  }

  // ④.7 爽点-反转兑现链时间线（v2.62）：逐集反转/爽点/情绪弧 + 兑现体检
  try {
    const joined3 = eps.map((e) => e.content || '').join('');
    const clang: 'zh' | 'en' = /[一-鿿]/.test(joined3) ? 'zh' : 'en';
    let beatPrefs: unknown = undefined; let hookPrefs2: unknown = undefined;
    try { beatPrefs = bibleRaw.beatPrefs; } catch { beatPrefs = undefined; }
    try { hookPrefs2 = bibleRaw.hookPrefs; } catch { hookPrefs2 = undefined; }
    const cn = eps.length || project.totalEps || 1;
    const chain = buildBeatChain(cn, 4, beatPrefs as never, hookPrefs2 as never);
    blocks.push({ kind: 'h1', text: clang === 'en' ? 'Payoff & Reversal Chain (Beat Timeline)' : '爽点-反转兑现链（节拍时间线）' });
    blocks.push({
      kind: 'p',
      text: clang === 'en'
        ? 'Episode-by-episode reversal beats, instant-payoff beats and the press-release emotion arc, from the same deterministic engine as generation; the closing check flags payoff gaps and unclosed foreshadows.'
        : '逐集列出反转卡点、即时爽点与「压抑→释放」情绪弧，与创作管线同源、确定性可复现；末尾体检自动识别爽点空窗与未兑现伏笔。',
    });
    formatBeatChainLines(chain, clang).forEach((t) => blocks.push({ kind: 'p', text: t }));
  } catch {
    // 兑现链页异常不阻断导出
  }

  // ④.8 人物表与成长弧一页纸（v2.63）：真实圣经人物卡 + 成稿出场/对手戏解析 + 五段成长阶段线
  try {
    const joined4 = eps.map((e) => e.content || '').join('');
    const alang: 'zh' | 'en' = /[一-鿿]/.test(joined4) ? 'zh' : 'en';
    let beatPrefs3: unknown = undefined; let hookPrefs3: unknown = undefined;
    try { beatPrefs3 = bibleRaw.beatPrefs; } catch { beatPrefs3 = undefined; }
    try { hookPrefs3 = bibleRaw.hookPrefs; } catch { hookPrefs3 = undefined; }
    const castPage = buildCastArcPage({
      characters: bible.characters,
      epTexts: eps.map((e) => e.content || ''),
      totalEps: eps.length || project.totalEps || 1,
      beatPref: beatPrefs3,
      hookPref: hookPrefs3,
    });
    if (castPage.characterCount > 0) {
      blocks.push({ kind: 'h1', text: alang === 'en' ? 'Cast & Growth Sheet' : '人物表与成长弧（一页纸）' });
      blocks.push({
        kind: 'p',
        text: alang === 'en'
          ? 'Character cards come from the series bible; screen time and scene-sharing are parsed from the actual drafts; the five-stage protagonist arc follows the same deterministic reversal plan as generation — nothing fabricated.'
          : '人物卡取自全局圣经，出场集数与对手戏轴由成稿正文真实解析，主角五段成长阶段与创作管线同源，不凭空编造。',
      });
      const castLines = formatCastArcLines(castPage, alang);
      castLines.cards.forEach((t) => blocks.push({ kind: 'p', text: t }));
      castLines.relations.forEach((t) => blocks.push({ kind: 'p', text: t }));
      blocks.push({ kind: 'p', text: alang === 'en' ? 'Protagonist five-stage growth curve:' : '主角五段成长曲线：' });
      castLines.growth.forEach((t) => blocks.push({ kind: 'p', text: t }));
    }
  } catch {
    // 人物页异常不阻断导出
  }

  // ④.9 制作物料清单（v2.154）：场景总表/角色出场表/道具总表，从成稿确定性聚合的制片交付页
  //     服务真人实拍（通告单/置景/道具准备）与 AIGC（场景库/角色资产组织）；聚合概览层全等级可见
  try {
    const joined5 = eps.map((e) => e.content || '').join('');
    const mlang: 'zh' | 'en' = /[一-鿿]/.test(joined5) ? 'zh' : 'en';
    const mats = buildProductionMaterials(eps.map((e) => ({ ep: e.epNo, content: e.content || '' })));
    if (mats.stats.epCount > 0 && (mats.scenes.length || mats.cast.length || mats.props.length)) {
      blocks.push({ kind: 'h1', text: mlang === 'en' ? 'Production Materials Sheet' : '制作物料清单（制片交付页）' });
      blocks.push({
        kind: 'p',
        text: mlang === 'en'
          ? 'Scene sheet / cast sheet / prop sheet aggregated deterministically from the actual drafts — for call sheets, set dressing and prop prep (live action), or scene-library and character-asset organization (AIGC).'
          : '场景总表/角色出场表/道具总表均由成稿正文确定性聚合（场头解析+说话人解析+信物词典），不凭空编造；可直接用于真人实拍的通告单/置景/道具准备，或 AIGC 的场景库与角色资产组织。',
      });
      formatMaterialsLines(mats, mlang).forEach((t) => blocks.push({ kind: 'p', text: t }));
    }
  } catch {
    // 物料页异常不阻断导出
  }

  // ⑤ 完整分集正文
  eps.forEach((e) => {
    blocks.push({ kind: 'epStart', ep: e.epNo, title: e.title || `第${e.epNo}集` });
    const paras = (e.content || '')
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean);
    (paras.length ? paras : ['（本集正文为空）']).forEach((text) => blocks.push({ kind: 'para', text }));
  });

  // ⑥ Z-AIGC 机器分镜附录（v2.36）：AIGC 项目专属，正文与机器层分页，可直接交付 AI 视频工作流
  if (project.format === 'AIGC') {
    blocks.push({ kind: 'h1', text: '附录·Z-AIGC 机器分镜层（供 AI 视频自动化工作流拆分镜使用）' });
    // v2.148 画风锚点：opts 显式传入优先，回退 project.bible.visualStyleId；非法编号静默跳过（老项目零影响）
    const styleId = (opts.visualStyleId || (project.bible as { visualStyleId?: unknown } | null)?.visualStyleId) as string | undefined;
    const styleNode = typeof styleId === 'string' ? resolveVisualStyle(styleId) : null;
    if (styleNode) {
      blocks.push({ kind: 'h2', text: `画风锚点 ${styleNode.id} · ${styleNode.label}（全部镜头统一画风，禁止逐镜漂移）` });
      blocks.push({ kind: 'p', text: [
        `质感关键词：${styleNode.keywords.join('、')}`,
        `英文画风提示词（喂入生图/视频模型时置于每个镜头提示词最前，镜头内容随后）：${buildVisualStylePrompt(styleNode.id)}`,
        `适配说明：${styleNode.note}`,
      ].join('\n') });
    }
    // v2.149 镜头语言锚点：opts 显式传入优先，回退 project.bible.cameraStyleId；非法编号静默跳过（老项目零影响）
    const camId = (opts.cameraStyleId || (project.bible as { cameraStyleId?: unknown } | null)?.cameraStyleId) as string | undefined;
    const camNode = typeof camId === 'string' ? resolveCameraStyle(camId) : null;
    if (camNode) {
      blocks.push({ kind: 'h2', text: `镜头语言锚点 ${camNode.id} · ${camNode.label}（全部镜头统一镜头语法，禁止逐镜漂移）` });
      blocks.push({ kind: 'p', text: [
        `镜头语法：${camNode.grammar}`,
        `镜头关键词：${camNode.keywords.join('、')}`,
        `英文镜头语言提示词（跟在画风提示词之后、镜头内容之前，约束每个镜头的节奏/运镜/转场）：${buildCameraStylePrompt(camNode.id)}`,
        `适配说明：${camNode.note}`,
      ].join('\n') });
    }
    const withShotList = opts.includeShotList !== false && canExportShotList(level);
    eps.forEach((e) => {
      let comp: ReturnType<typeof analyzeAigcComposition> | null = null;
      try { comp = analyzeAigcComposition(e.content || ''); } catch { comp = null; }
      let m: ReturnType<typeof buildShotManifest> | null = null;
      if (withShotList) { try { m = buildShotManifest(e.content || ''); } catch { m = null; } }
      blocks.push({ kind: 'h2', text: `第${e.epNo}集 ${e.title || ''}${m ? `（机器分镜 ${m.shotCount} 镜）` : ''}` });
      if (comp && comp.totalCjk > 0) {
        blocks.push({ kind: 'p', text: `构成概览：总字数${comp.totalCjk}｜画面叙述${comp.narrativeCjk}字｜台词+OS ${comp.spokenCjk}字（发声占比${Math.round(comp.spokenRatio * 100)}%，目标18%-28%）｜台词${comp.dialogueLines}句、单句均${comp.avgDialogueLen}字${comp.compositionIssues.length ? '｜提示：' + comp.compositionIssues.join('；') : ''}` });
      }
      if (m) {
        m.shots.forEach((s) => {
          const segs = [
            `镜${s.shot}（场${s.scene}）｜景别：${s.size}｜运镜：${s.move}｜光影：${s.light}`,
            s.visual ? `画面：${s.visual}` : '',
            s.lines.length ? `台词：${s.lines.map((l) => `${l.speaker}${l.cue ? `（${l.cue}）` : ''}：${l.text}`).join(' / ')}` : '',
            s.inner.length ? `内心/OS：${s.inner.join(' / ')}` : '',
            s.audio.length ? `声音：${s.audio.join(' / ')}` : '',
          ].filter(Boolean);
          blocks.push({ kind: 'p', text: segs.join('\n') });
        });
      } else if (!withShotList) {
        blocks.push({ kind: 'p', text: '完整逐镜分镜表（景别/运镜/光影/画面/台词/声音逐镜拆分）为高级会员及以上导出权益，升级后本附录将自动展开为可直接喂入 AI 视频流水线的分镜清单。' });
      }
    });
  }

  return { title: project.title, blocks, watermark, epCount: eps.length };
}

/* ------------------------------------------------------------------ */
/* 固定行高分页（供 PDF 精确计算“共 Y 页”；docx 由 Word 域自动计页）      */
/* ------------------------------------------------------------------ */
export interface PaginatedPage { lines: string[]; pageNo: number }
/**
 * 把“已按宽度折行的文本行”按每页可容纳行数切页。
 * @param lines      已折好行的文本行（渲染器负责按字号字宽折行）
 * @param linesPerPage 每页正文最大行数
 */
export function paginate(lines: string[], linesPerPage: number): PaginatedPage[] {
  const per = Math.max(1, Math.floor(linesPerPage));
  const pages: PaginatedPage[] = [];
  for (let i = 0; i < lines.length; i += per) {
    pages.push({ lines: lines.slice(i, i + per), pageNo: pages.length + 1 });
  }
  if (!pages.length) pages.push({ lines: [], pageNo: 1 });
  return pages;
}
