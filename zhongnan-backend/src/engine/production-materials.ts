/**
 * 制作物料清单引擎（v2.154 编导分级协作法 L2"熟手清单法"落地：剧本清单→分镜清单→素材清单）
 * ------------------------------------------------------------------
 * 痛点：成稿之后，制片/置景/通告（真人实拍）与场景库/角色资产组织（AIGC）都还需要
 * 一份跨集聚合的"物料清单"，而导出文档只有逐集正文与逐镜表，没有跨集总表。
 * 职责（与 location-ledger/prop-ledger 同构：纯确定性、零 LLM、零 IO，可离线对拍）：
 *  从成稿聚合三张表——
 *   1. 场景总表：地点×日/夜×出现集次（场头解析，一手源 scene-header-convention）
 *   2. 角色出场表：说话人×台词量×出场集（一手源 parseDialogue，与角色逻辑引擎同口径）
 *   3. 道具总表：关键信物×出现集×封禁态（一手源 prop-ledger 的信物词典提取）
 *  v2.155 纵深两件——
 *   4. 场景明细（逐集逐场）：场头 lineIndex 切分场块，块内角色/信物/字数 + AIGC 场景生图提示词
 *      （画风段由调用方注入，英文段置前，v2.148 注入顺序约定）
 *   5. 场景×角色通告矩阵：跨集按场景聚合角色台词量/信物/集次（真人实拍通告单与 AIGC 场景库共用）
 * 消费方：导出文档"制作物料清单（制片交付页）" + GET /api/export/:id/materials + 前端预览弹窗 + 导演交付包。
 */
import { sceneHeaderConvention } from './scene-header-convention';
import { extractPropMentions } from './prop-ledger';
import { parseDialogue } from './character-logic';

export interface MaterialScene {
  /** 内外景标识：内/外/''（AIGC 场头可能无） */
  intExt: string;
  /** 地点名（场头提取原样） */
  location: string;
  /** 时间标注（日/夜/晨…；未标注兜底） */
  timeOfDay: string;
  /** 出现集号列表（升序） */
  eps: number[];
  /** 场次总数 */
  count: number;
}

export interface MaterialCast {
  /** 角色名（台词说话人前缀） */
  name: string;
  /** 出场集号列表（升序） */
  eps: number[];
  /** 台词句数（含情绪提示行，与 parseDialogue 口径一致） */
  lines: number;
}

export interface MaterialProp {
  /** 信物名（词典原样） */
  name: string;
  /** 提及集号列表（升序） */
  eps: number[];
  /** 是否已在某集封禁（销毁/丢失） */
  closed: boolean;
}

export interface ProductionMaterials {
  /** 场景总表：按场次总数降序，同场次按首现集升序 */
  scenes: MaterialScene[];
  /** 角色出场表：按台词量降序 */
  cast: MaterialCast[];
  /** 道具总表：按提及集数降序，同数按首现集升序 */
  props: MaterialProp[];
  stats: {
    epCount: number;
    sceneCount: number;
    uniqueLocations: number;
    castCount: number;
    propCount: number;
    /** 场头总数（sceneHeaderConvention 识别口径，v2.157） */
    headerTotal: number;
    /** 合规场头数（编号/地点/时间/长度全过） */
    headerValid: number;
    /** 场头合规率 0-100 整数（无场头时为 0；置景/通告排期风险预警） */
    headerRate: number;
  };
}

/** 非演出角色的说话人噪音（不计入出场表） */
const CAST_STOPLIST = new Set(['旁白', '画外音', 'OS', '内心', '众人']);

const asc = (a: number, b: number) => a - b;
const epsKey = (set: Map<number, Set<number>>, ep: number) => {
  if (!set.has(ep)) set.set(ep, new Set());
  return set.get(ep)!;
};

/**
 * 从逐集成稿聚合制作物料三表。对缺场头/无台词/异常结构完全容错（老项目也能聚合）。
 */
export function buildProductionMaterials(episodes: { ep: number; content: string }[]): ProductionMaterials {
  const eps = [...episodes]
    .filter((e) => typeof e?.ep === 'number' && Number.isFinite(e.ep))
    .sort((a, b) => a.ep - b.ep);

  // —— 场景总表：场头解析 → (内外景|地点|时间) 聚合 ——
  const sceneEps = new Map<string, Map<number, number>>(); // key → ep → 场次数
  const sceneMeta = new Map<string, { intExt: string; location: string; timeOfDay: string }>();
  let sceneCount = 0;
  const uniqueLocations = new Set<string>();
  // v2.157 场头合规率：合规场头/识别场头（置景排期风险预警，与 convention 判分同口径）
  let headerTotal = 0;
  let headerValid = 0;
  for (const { ep, content } of eps) {
    if (!content) continue;
    let parsed: ReturnType<typeof sceneHeaderConvention> | null = null;
    try { parsed = sceneHeaderConvention(content); } catch { parsed = null; }
    if (!parsed) continue;
    headerTotal += parsed.headers.length;
    headerValid += parsed.headers.filter((h) => h.valid).length;
    for (const h of parsed.headers) {
      // extractLocation 不剥"内景/外景"前缀（location="内景 餐厅"），在此归一：前缀入 intExt，地点单独成列
      let location = (h.location || '').trim();
      let intExt = '';
      const io = location.match(/^(内景|外景|室内|室外)\s*/);
      if (io) { intExt = io[1].startsWith('内') ? '内' : '外'; location = location.slice(io[0].length).trim(); }
      if (!location) continue; // 仅"内景/外景"无具体地点 → 不进总表（与 convention 的 missing_location 口径一致）
      const timeOfDay = (h.timeOfDay || '').trim() || '未标注';
      const key = `${intExt}|${location}|${timeOfDay}`;
      sceneMeta.set(key, { intExt, location, timeOfDay });
      if (!sceneEps.has(key)) sceneEps.set(key, new Map());
      const perEp = sceneEps.get(key)!;
      perEp.set(ep, (perEp.get(ep) || 0) + 1);
      sceneCount++;
      uniqueLocations.add(location);
    }
  }
  const scenes: MaterialScene[] = [...sceneEps.entries()].map(([key, perEp]) => {
    const meta = sceneMeta.get(key)!;
    const epsList = [...perEp.keys()].sort(asc);
    return { intExt: meta.intExt, location: meta.location, timeOfDay: meta.timeOfDay, eps: epsList, count: [...perEp.values()].reduce((s, n) => s + n, 0) };
  }).sort((a, b) => b.count - a.count || a.eps[0] - b.eps[0]);

  // —— 角色出场表：台词说话人前缀聚合（与 character-logic 同口径）——
  const castEps = new Map<string, Set<number>>();
  const castLines = new Map<string, number>();
  for (const { ep, content } of eps) {
    if (!content) continue;
    let lines: ReturnType<typeof parseDialogue> = [];
    try { lines = parseDialogue(content); } catch { lines = []; }
    for (const d of lines) {
      const name = (d.name || '').trim();
      if (!name || CAST_STOPLIST.has(name)) continue;
      if (!castEps.has(name)) castEps.set(name, new Set());
      castEps.get(name)!.add(ep);
      castLines.set(name, (castLines.get(name) || 0) + 1);
    }
  }
  const cast: MaterialCast[] = [...castEps.entries()].map(([name, epSet]) => ({
    name, eps: [...epSet].sort(asc), lines: castLines.get(name) || 0,
  })).sort((a, b) => b.lines - a.lines || a.eps[0] - b.eps[0]);

  // —— 道具总表：信物词典提取聚合（与 prop-ledger 同词典同口径）——
  const propEps = new Map<string, Set<number>>();
  const propClosed = new Map<string, boolean>();
  for (const { ep, content } of eps) {
    if (!content) continue;
    let items: ReturnType<typeof extractPropMentions> = [];
    try { items = extractPropMentions(content); } catch { items = []; }
    for (const it of items) {
      const name = (it?.name || '').trim();
      if (!name) continue;
      if (!propEps.has(name)) propEps.set(name, new Set());
      propEps.get(name)!.add(ep);
      if (it.closed) propClosed.set(name, true);
    }
  }
  const props: MaterialProp[] = [...propEps.entries()].map(([name, epSet]) => ({
    name, eps: [...epSet].sort(asc), closed: propClosed.get(name) || false,
  })).sort((a, b) => b.eps.length - a.eps.length || a.eps[0] - b.eps[0]);

  return {
    scenes,
    cast,
    props,
    stats: {
      epCount: eps.length,
      sceneCount,
      uniqueLocations: uniqueLocations.size,
      castCount: cast.length,
      propCount: props.length,
      headerTotal,
      headerValid,
      headerRate: headerTotal ? Math.round((headerValid / headerTotal) * 100) : 0,
    },
  };
}

/**
 * 物料清单文本行（导出文档 p 块与前端复制共用同一渲染口径）。
 * @param cap 各表渲染行数上限（控导出页篇幅；JSON 端点始终返回全量）
 */
export function formatMaterialsLines(m: ProductionMaterials, lang: 'zh' | 'en' = 'zh', cap = { scenes: 40, cast: 20, props: 30 }): string[] {
  const lines: string[] = [];
  const zh = lang === 'zh';
  const epsStr = (eps: number[]) => eps.map((e) => `第${e}集`).join('/');

  lines.push(zh
    ? `▸ 场景总表（${m.stats.sceneCount} 场 / ${m.stats.uniqueLocations} 个地点，场头合规率 ${m.stats.headerRate}%，按场次降序）`
    : `▸ Scene Sheet (${m.stats.sceneCount} scenes / ${m.stats.uniqueLocations} locations, header pass rate ${m.stats.headerRate}%, by scene count)`);
  if (!m.scenes.length) lines.push(zh ? '（无合规场头，建议逐集补「内景/外景 地点 时间」）' : '(No valid scene headers)');
  m.scenes.slice(0, cap.scenes).forEach((s) => {
    // 内外景标识为中文口径（内/外），en 场头（INT./EXT.）不产出该字段，仅渲染地点
    const head = [zh && s.intExt ? `${s.intExt}景` : '', s.location, s.timeOfDay].filter(Boolean).join('·');
    lines.push(zh ? `${head} — 共${s.count}场（${epsStr(s.eps)}）` : `${head} — ${s.count} scene(s) (${s.eps.join('/')})`);
  });
  if (m.scenes.length > cap.scenes) lines.push(zh ? `（其余 ${m.scenes.length - cap.scenes} 条场景详见 JSON 端点）` : `(+${m.scenes.length - cap.scenes} more via JSON endpoint)`);

  lines.push(zh ? `▸ 角色出场表（${m.stats.castCount} 人，按台词量降序）` : `▸ Cast Sheet (${m.stats.castCount}, by line count)`);
  if (!m.cast.length) lines.push(zh ? '（无台词行，建议检查「角色名：台词」格式）' : '(No dialogue lines)');
  m.cast.slice(0, cap.cast).forEach((c) => {
    lines.push(zh ? `${c.name} — ${c.lines}句台词，出场${epsStr(c.eps)}` : `${c.name} — ${c.lines} line(s), eps ${c.eps.join('/')}`);
  });
  if (m.cast.length > cap.cast) lines.push(zh ? `（其余 ${m.cast.length - cap.cast} 人详见 JSON 端点）` : `(+${m.cast.length - cap.cast} more via JSON endpoint)`);

  lines.push(zh ? `▸ 道具总表（${m.stats.propCount} 类关键信物）` : `▸ Prop Sheet (${m.stats.propCount} key props)`);
  if (!m.props.length) lines.push(zh ? '（无关键信物记录）' : '(No key props)');
  m.props.slice(0, cap.props).forEach((p) => {
    const tail = p.closed ? (zh ? `（已封禁：销毁/丢失后再现场景需复核）` : ' (closed — verify re-appearances)') : '';
    lines.push(zh ? `${p.name} — ${epsStr(p.eps)}提及${tail}` : `${p.name} — eps ${p.eps.join('/')}${tail}`);
  });
  if (m.props.length > cap.props) lines.push(zh ? `（其余 ${m.props.length - cap.props} 类详见 JSON 端点）` : `(+${m.props.length - cap.props} more via JSON endpoint)`);

  return lines;
}

// ==================== v2.155 场景明细矩阵（场景生图提示词组装 + 场景×角色通告矩阵） ====================

/** 单场块明细（集×场粒度）：AIGC 场景库与真人实拍分场通告共用 */
export interface SceneDetail {
  /** 集号 */
  ep: number;
  /** 集内场号（仅计有效场头，1 起） */
  sceneNo: number;
  /** 内外景：内/外/''（与场景总表同口径归一） */
  intExt: string;
  /** 地点名 */
  location: string;
  /** 时间标注（未标注兜底） */
  timeOfDay: string;
  /** 场内角色台词量（台词数降序，旁白等噪音已剔除） */
  cast: { name: string; lines: number }[];
  /** 场内提及的关键信物（出现序） */
  props: string[];
  /** 场块净字符数（去空白，节奏/篇幅参考） */
  charCount: number;
  /** AIGC 场景生图提示词（英文画风段置前 + 中文场景空镜描述，v2.148 注入顺序约定） */
  prompt: string;
}

/** 场景×角色通告矩阵行（跨集按场景聚合） */
export interface SceneMatrixRow {
  intExt: string;
  location: string;
  timeOfDay: string;
  /** 跨集角色台词量合计（降序） */
  cast: { name: string; lines: number }[];
  /** 跨集出现过的信物合集 */
  props: string[];
  /** 出现集号（升序） */
  eps: number[];
  /** 场次总数 */
  count: number;
}

export interface SceneBreakdown {
  /** 逐集逐场明细 */
  details: SceneDetail[];
  /** 场景×角色通告矩阵（按场次降序，同数按首现集升序） */
  matrix: SceneMatrixRow[];
}

/**
 * 场景明细切分：用场头 lineIndex 切分场块（首场头之前的序章行跳过），
 * 每块独立跑 parseDialogue（角色）+ extractPropMentions（信物），零新正则、全一手源。
 * 行切分必须与 scene-header-convention 同口径（split('\n')），lineIndex 才能对齐。
 * 口径与 buildProductionMaterials 一致：非法集号丢弃；仅"内景/外景"无地点的场头不进明细。
 */
export function buildSceneBreakdown(episodes: { ep: number; content: string }[], opts: { stylePrompt?: string } = {}): SceneBreakdown {
  const stylePrompt = (opts.stylePrompt || '').trim();
  const details: SceneDetail[] = [];
  const matrixMap = new Map<string, { intExt: string; location: string; timeOfDay: string; cast: Map<string, number>; props: Set<string>; eps: Set<number>; count: number }>();
  const eps = [...episodes]
    .filter((e) => typeof e?.ep === 'number' && Number.isFinite(e.ep))
    .sort((a, b) => a.ep - b.ep);

  for (const { ep, content } of eps) {
    if (!content) continue;
    const lines = content.split('\n');
    let parsed: ReturnType<typeof sceneHeaderConvention> | null = null;
    try { parsed = sceneHeaderConvention(content); } catch { parsed = null; }
    if (!parsed || !parsed.headers.length) continue;
    const headers = [...parsed.headers].sort((a, b) => a.lineIndex - b.lineIndex);
    let sceneNo = 0;
    headers.forEach((h, i) => {
      // 场块范围：本场头行 → 下一场头行前（首场头之前的序章行不进任何块）
      const start = h.lineIndex;
      const end = i + 1 < headers.length ? headers[i + 1].lineIndex : lines.length;
      const block = lines.slice(start, end).join('\n');
      // 内外景归一（与场景总表同口径：extractLocation 不剥前缀，在此拆）
      let location = (h.location || '').trim();
      let intExt = '';
      const io = location.match(/^(内景|外景|室内|室外)\s*/);
      if (io) { intExt = io[1].startsWith('内') ? '内' : '外'; location = location.slice(io[0].length).trim(); }
      if (!location) return; // 仅"内景/外景"无具体地点 → 不进明细（与总表口径一致）
      sceneNo += 1;
      const timeOfDay = (h.timeOfDay || '').trim() || '未标注';
      // 场块角色：说话人×台词数（噪音剔除，台词数降序）
      let dlines: ReturnType<typeof parseDialogue> = [];
      try { dlines = parseDialogue(block); } catch { dlines = []; }
      const castMap = new Map<string, number>();
      for (const d of dlines) {
        const name = (d.name || '').trim();
        if (!name || CAST_STOPLIST.has(name)) continue;
        castMap.set(name, (castMap.get(name) || 0) + 1);
      }
      const cast = [...castMap.entries()].map(([name, n]) => ({ name, lines: n })).sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));
      // 场块信物：词典提取（出现序）
      let items: ReturnType<typeof extractPropMentions> = [];
      try { items = extractPropMentions(block); } catch { items = []; }
      const props = items.map((it) => (it?.name || '').trim()).filter(Boolean);
      // AIGC 场景生图提示词：英文画风段置前 + 场景空镜描述
      const head = [intExt ? `${intExt}景` : '', timeOfDay].filter(Boolean).join('，');
      const sceneDesc = `${location}${head ? `（${head}）` : ''}，空镜环境参考图`;
      const prompt = [stylePrompt, sceneDesc].filter(Boolean).join(', ');
      details.push({ ep, sceneNo, intExt, location, timeOfDay, cast, props, charCount: block.replace(/\s+/g, '').length, prompt });
      // 矩阵聚合：场景 × 角色/信物/集次
      const key = `${intExt}|${location}|${timeOfDay}`;
      if (!matrixMap.has(key)) matrixMap.set(key, { intExt, location, timeOfDay, cast: new Map(), props: new Set(), eps: new Set(), count: 0 });
      const m = matrixMap.get(key)!;
      for (const c of cast) m.cast.set(c.name, (m.cast.get(c.name) || 0) + c.lines);
      for (const p of props) m.props.add(p);
      m.eps.add(ep);
      m.count += 1;
    });
  }

  const matrix: SceneMatrixRow[] = [...matrixMap.values()].map((m) => ({
    intExt: m.intExt, location: m.location, timeOfDay: m.timeOfDay,
    cast: [...m.cast.entries()].map(([name, n]) => ({ name, lines: n })).sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name)),
    props: [...m.props],
    eps: [...m.eps].sort(asc),
    count: m.count,
  })).sort((a, b) => b.count - a.count || a.eps[0] - b.eps[0]);

  return { details, matrix };
}

/**
 * 场景×角色通告矩阵文本行（前端弹窗与后续导出共用渲染口径）。
 * 形如：内景·餐厅·夜 — 2场｜角色：林昭(3)/陈默(2)｜道具：玉佩
 */
export function formatMatrixLines(matrix: SceneMatrixRow[], lang: 'zh' | 'en' = 'zh', cap = 40): string[] {
  const zh = lang === 'zh';
  const lines: string[] = [];
  lines.push(zh ? `▸ 场景×角色通告矩阵（${matrix.length} 个场景，按场次降序）` : `▸ Scene×Cast Matrix (${matrix.length} scenes, by scene count)`);
  if (!matrix.length) { lines.push(zh ? '（无合规场头，无法生成矩阵）' : '(No valid scene headers)'); return lines; }
  matrix.slice(0, cap).forEach((r) => {
    // 内外景标识为中文口径，en 场头（INT./EXT.）不产出该字段，仅渲染地点（与 formatMaterialsLines 同规则）
    const head = [zh && r.intExt ? `${r.intExt}景` : '', r.location, r.timeOfDay].filter(Boolean).join('·');
    const segs = [`${head} — ${zh ? `${r.count}场` : `${r.count} scene(s)`}`];
    if (r.cast.length) segs.push(`${zh ? '角色：' : 'Cast: '}${r.cast.map((c) => `${c.name}(${c.lines})`).join('/')}`);
    if (r.props.length) segs.push(`${zh ? '道具：' : 'Props: '}${r.props.join(zh ? '、' : ', ')}`);
    lines.push(segs.join(zh ? '｜' : ' | '));
  });
  if (matrix.length > cap) lines.push(zh ? `（其余 ${matrix.length - cap} 个场景详见 JSON 端点）` : `(+${matrix.length - cap} more via JSON endpoint)`);
  return lines;
}
