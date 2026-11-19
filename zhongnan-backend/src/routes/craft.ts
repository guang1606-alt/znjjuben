/**
 * craft.ts —— 叙事工艺「小南递招」只读路由（PRD 2.2/导演钩子体系/v1.70 43张方法卡+10类钩子的前端出口）
 * 纯本地确定性计算，不连数据库、不耗大模型 token、免费：把 narrative-craft 沉淀的方法卡与钩子，
 * 按用户当前一句话创意/标签实时匹配，给「系统默认推荐」，同时支持用户自行浏览/增删（钩子不是僵硬办法）。
 */
import { asyncRouter } from '../lib/async-router';
import {
  HOOK_TAXONOMY, HOOK_EN, recommendHooks, openingHookAudit, matchCraftCards,
  CHARACTER_DEPTH_CARDS, NARRATIVE_DEVICE_CARDS, RELATIONSHIP_CARDS, GENRE_TOOLKIT_CARDS,
  localizeHook, localizeCard,
} from '../engine/narrative-craft';
import { pickDiverseSeeds, diversityAudit, type VersionInput } from '../engine/multi-version';
import { validateBranches, buildBranchSkeleton, applyMutator, autoLayout, validateClueGraph, type BranchGraph, type MutateOp } from '../engine/interactive-branch';
import { normalizeClues, BranchBriefError, type ClueSpec } from '../engine/branch-brief';
import { matchArchetype, archetypeLint, PROTAG_EN, VILLAIN_EN, SYSTEM_EN } from '../engine/archetype-craft';
import { emotionCraftLint } from '../engine/emotion-craft';
import { webnovelLint } from '../engine/webnovel-craft';
import type { LintIssue } from '../engine/craft-lint';
import { craftLint } from '../engine/craft-lint';
import { narrativeLint } from '../engine/narrative-craft';

/** 体检正文上限：只读工具，超出部分截断而不是拒绝，避免用户粘贴长剧本时空白报错 */
const LINT_MAX_CHARS = 20000;
const LEVEL_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
const sortIssues = (list: LintIssue[]): LintIssue[] =>
  [...list].sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.score - b.score);

const CARD_GROUPS = [
  { key: 'character', name: '人物内驱·缺陷·弧光', nameEn: 'Character drive · flaw · arc', cards: CHARACTER_DEPTH_CARDS },
  { key: 'device', name: '叙事装置·结构·反转', nameEn: 'Narrative device · structure · reversal', cards: NARRATIVE_DEVICE_CARDS },
  { key: 'relation', name: '关系·情感·双雄', nameEn: 'Relationship · emotion · dual leads', cards: RELATIONSHIP_CARDS },
  { key: 'genre', name: '分类型工具箱', nameEn: 'Genre toolkits', cards: GENRE_TOOLKIT_CARDS },
] as const;

export function createCraftRouter() {
  const r = asyncRouter();
  const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  // v2.334 线索 × 分支图联合校验：clues 选填，非法线索规格按 400 拒绝（不静默丢）
  const parseClues = (raw: unknown, lang: 'zh' | 'en'): ClueSpec[] | { error: string; field: string } => {
    if (raw === undefined || raw === null) return [];
    try { return normalizeClues(raw); }
    catch (e) {
      const err = e as BranchBriefError;
      return { error: err.message || (lang === 'en' ? 'Invalid clue spec' : '线索规格不合法'), field: 'clues' };
    }
  };

  // 全量工艺分类浏览：10类钩子 + 4组方法卡（标题/公式层，点开才看步骤，避免信息过载）。v2.524 按 lang 返回英文字段
  r.get('/taxonomy', (req, res) => {
    const lang: 'zh' | 'en' = req.query.lang === 'en' ? 'en' : 'zh';
    res.json({
      hooks: HOOK_TAXONOMY.map((h) => {
        if (lang !== 'en') return { id: h.id, name: h.name, layer: h.layer, definition: h.definition, how: h.how, example: h.example, fit: h.fit };
        const e = localizeHook(h, 'en');
        return { id: h.id, name: e.name, layer: e.layer, definition: e.definition, how: e.how, example: e.example, fit: e.fit };
      }),
      cardGroups: CARD_GROUPS.map((g) => ({
        key: g.key, name: lang === 'en' ? g.nameEn : g.name, count: g.cards.length,
        cards: g.cards.map((c) => {
          if (lang !== 'en') return { id: c.id, title: c.title, formula: c.formula, fit: c.fit };
          const e = localizeCard(c, 'en');
          return { id: c.id, title: e.title, formula: e.formula, fit: e.fit };
        }),
      })),
      totals: { hooks: HOOK_TAXONOMY.length, cards: CARD_GROUPS.reduce((n, g) => n + g.cards.length, 0) },
    });
  });

  // 按当前创意/标签实时递招：匹配方法卡 + 系统默认钩子组合 + 开篇300字钩子审计。v2.524 响应卡片/钩子整套本地化
  r.post('/recommend', (req, res) => {
    const b = req.body ?? {};
    const lang: 'zh' | 'en' = b.lang === 'en' ? 'en' : 'zh';
    const text = String(b.text ?? '').slice(0, 6000);
    const tags = asStrArr(b.tags).slice(0, 40);
    if (!text.trim() && !tags.length) return res.status(400).json({ error: lang === 'en' ? 'Provide a one-line idea, synopsis or tags' : '请提供一句话创意、简介或标签' });
    const limit = Math.min(12, Math.max(1, Number(b.limit ?? 6) || 6));
    const cards = matchCraftCards({ text, tags, limit }, lang);
    const hooks = recommendHooks({ text, tags }, lang);
    let opening = b.opening ? openingHookAudit(String(b.opening).slice(0, 1200)) : null;
    // 审计规则与建议文案为中文；英文界面只替换建议句，已用钩子名取英文库，避免中英混排
    if (opening && lang === 'en') {
      const names = opening.used.map((id) => HOOK_EN[id]?.name || id).filter(Boolean);
      opening = {
        ...opening,
        advice: names.length
          ? `Hooks already present in the opening: ${names.join(', ')}. Keep the second line as the thunder: drop the lead into concrete trouble within 300 characters, no background first.`
          : 'No clear hook in the first 300 characters (no uncanny action, crisis, countdown or overturning line). Break it open with one of three: an uncanny action, a line that flips common sense, or deadpan endurance with a revenge countdown. Cut weather, waking up and world-building.',
      };
    }
    res.json({
      cards: cards.map((c) => {
        const e = lang === 'en' ? localizeCard(c, 'en') : c;
        return { id: e.id, title: e.title, formula: e.formula, steps: e.steps, fit: e.fit };
      }),
      hooks: hooks.map((h) => {
        const e = lang === 'en' ? localizeHook(h, 'en') : h;
        return { id: e.id, name: e.name, layer: e.layer, definition: e.definition, how: e.how, example: e.example };
      }),
      openingAudit: opening,
    });
  });

  // 多版本反同质化（PRD 2.1.1）：生成前为第 N 版分配正交创作种子（主角原型×冲突×反转×基调），从源头避免一个模子
  r.get('/diverse-seeds', (req, res) => {
    const n = Math.min(6, Math.max(2, Number(req.query.n ?? 3) || 3));
    const lang = req.query.lang === 'en' ? 'en' : 'zh';
    res.json({ n, seeds: pickDiverseSeeds(n, lang) });
  });
  // 多版本反同质化：生成后两两体检，判"伪多版本/换汤不换药"，指出哪两版撞在哪、怎么拉开
  r.post('/diversity-audit', (req, res) => {
    const lang = req.body?.lang === 'en' ? 'en' : 'zh';
    const raw = Array.isArray(req.body?.versions) ? req.body.versions : [];
    const versions: VersionInput[] = raw.slice(0, 6).map((x: Record<string, unknown>, i: number) => ({
      id: (x.id ?? i + 1) as string | number,
      logline: String(x.logline ?? '').slice(0, 3000),
      archetype: x.archetype ? String(x.archetype) : undefined,
      conflictTags: asStrArr(x.conflictTags).slice(0, 30),
      plotTags: asStrArr(x.plotTags).slice(0, 30),
    })).filter((v: VersionInput) => v.logline.trim() || v.archetype || (v.conflictTags ?? []).length || (v.plotTags ?? []).length);
    if (versions.length < 2) return res.status(400).json({ error: lang === 'en' ? 'Provide at least 2 versions to compare' : '请至少提供 2 个版本用于比对' });
    const report = diversityAudit(versions, lang);
    res.json({ ...report, verdict: report.pseudoVersion ? 'pseudo' : (report.score >= 80 ? 'diverse' : 'borderline') });
  });
  // 互动短剧：分支逻辑校验（PRD 3.5）——闭环/死胡同/伪选择/自环/死循环/悬空边/概率权重/多结局齐全度
  r.post('/branch-validate', (req, res) => {
    const lang = req.body?.lang === 'en' ? 'en' : 'zh';
    const g = req.body?.graph as BranchGraph | undefined;
    if (!g || typeof g.start !== 'string' || !g.nodes || typeof g.nodes !== 'object') {
      return res.status(400).json({ error: lang === 'en' ? 'Provide a valid branch graph {start, nodes}' : '请提供合法分支图 {start, nodes}' });
    }
    if (!g.nodes[g.start]) return res.status(400).json({ error: lang === 'en' ? 'Start node is missing from nodes' : '起点 start 在 nodes 中不存在' });
    if (Object.keys(g.nodes).length > 400) return res.status(400).json({ error: lang === 'en' ? 'At most 400 nodes per graph' : '单图节点不能超过 400 个' });
    const clues = parseClues(req.body?.clues, lang);
    if (!Array.isArray(clues)) return res.status(400).json(clues);
    res.json({ graph: g, report: validateBranches(g, lang), layout: autoLayout(g), clueIssues: validateClueGraph(clues, g, lang) });
  });
  // 互动短剧：可视化编辑器单次结构增删改（纯函数、自动维护边一致性），返回新图+校验+布局
  r.post('/branch-mutate', (req, res) => {
    const lang = req.body?.lang === 'en' ? 'en' : 'zh';
    const g = req.body?.graph as BranchGraph | undefined;
    const op = req.body?.op as MutateOp | undefined;
    if (!g || typeof g.start !== 'string' || !g.nodes || typeof g.nodes !== 'object') return res.status(400).json({ error: lang === 'en' ? 'Provide a valid branch graph' : '请提供合法分支图' });
    if (!op || typeof op.op !== 'string') return res.status(400).json({ error: lang === 'en' ? 'Missing edit op' : '缺少编辑操作 op' });
    const clues = parseClues(req.body?.clues, lang);
    if (!Array.isArray(clues)) return res.status(400).json(clues);
    try {
      const graph = applyMutator(g, op, lang);
      res.json({ graph, report: validateBranches(graph, lang), layout: autoLayout(graph), clueIssues: validateClueGraph(clues, graph, lang) });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  // 互动短剧：生成保证合法的多结局分支骨架（快速起稿），同时回自动布局
  r.get('/branch-skeleton', (req, res) => {
    const choicePoints = Math.min(6, Math.max(1, Number(req.query.choicePoints ?? 2) || 2));
    const withBad = req.query.withBad !== '0';
    const withHidden = req.query.withHidden !== '0';
    const lang = req.query.lang === 'en' ? 'en' : 'zh';
    const graph = buildBranchSkeleton({ choicePoints, withBad, withHidden, lang });
    res.json({ graph, report: validateBranches(graph, lang), layout: autoLayout(graph) });
  });

  /* ---------- 免费剧本体检（不登录、不连库、不耗 token） ---------- */
  // 把已实现的五组工艺尺子（原型/情绪/网文/改稿/叙事，约38条）跑在用户粘贴的正文上，产出与项目诊断同口径的问题单
  r.post('/lint', (req, res) => {
    const b = req.body ?? {};
    const lang: 'zh' | 'en' = b.lang === 'en' ? 'en' : 'zh';
    const rawText = String(b.text ?? '');
    // 超限截断而不是拒绝，但必须回报，否则用户以为整篇都检了
    const truncated = rawText.length > LINT_MAX_CHARS;
    const text = rawText.slice(0, LINT_MAX_CHARS);
    const episodes = (Array.isArray(b.episodes) ? b.episodes : [])
      .slice(0, 10).map((x: unknown) => String(x ?? '').slice(0, LINT_MAX_CHARS)).filter(Boolean);
    if (!text.trim() && !episodes.length) {
      return res.status(400).json({ error: lang === 'en' ? 'Provide the script text to review' : '请提供需要体检的剧本正文' });
    }
    const ending = String(b.ending ?? '').slice(0, 2000) || undefined;
    const outline = String(b.outline ?? '').slice(0, 6000) || undefined;
    // 剧名选填：填了才跑剧名尺子（不给就用正文首行冒充剧名，会报假阳性）
    const title = String(b.title ?? '').trim().slice(0, 60) || undefined;
    const isIntrigue = b.isIntrigue === undefined ? undefined : Boolean(b.isIntrigue);
    const groups = [
      { key: 'archetype', name: lang === 'en' ? 'Character & tension' : '人物原型·张力', r: archetypeLint({ text, opening: text.slice(0, 600), lang }) },
      { key: 'emotion', name: lang === 'en' ? 'Emotion & payoff' : '情绪·爽点兑付', r: emotionCraftLint({ text, episodes, isIntrigue, lang }) },
      { key: 'webnovel', name: lang === 'en' ? 'Serial & hook craft' : '网文·钩子工艺', r: webnovelLint({ text, outline, ending, lang }) },
      // v2.520 补齐：改稿尺子与叙事逻辑此前只在生成结果页（要花积分）才跑，免费体检看不到
      { key: 'craft', name: lang === 'en' ? 'Line-edit rulers' : '一线改稿尺子', r: craftLint({ text, episodes, lang, title }) },
      { key: 'narrative', name: lang === 'en' ? 'Narrative logic' : '叙事逻辑', r: narrativeLint({ text, ending, lang }) },
    ];
    const issues = sortIssues(groups.flatMap((g) => g.r.issues));
    const counts = {
      p0: issues.filter((i) => i.level === 'P0').length,
      p1: issues.filter((i) => i.level === 'P1').length,
      p2: issues.filter((i) => i.level === 'P2').length,
      total: issues.length,
    };
    const scored = groups.map((g) => g.r.avg).filter((n) => n > 0);
    res.json({
      lang, chars: text.length, truncated,
      groups: groups.map((g) => ({ key: g.key, name: g.name, avg: g.r.avg, p1Count: g.r.issues.filter((i) => i.level === 'P1').length, issues: g.r.issues })),
      issues, counts,
      avg: scored.length ? Math.round(scored.reduce((s, n) => s + n, 0) / scored.length) : 0,
    });
  });

  // 免费原型选型：按一句话创意/标签匹配 6型主角 + 6型反派，含系统流时附 3 套高级机制（中文创作知识库单一事实来源）
  r.post('/archetype-match', (req, res) => {
    const b = req.body ?? {};
    const lang: 'zh' | 'en' = b.lang === 'en' ? 'en' : 'zh';
    const text = String(b.text ?? '').slice(0, 6000);
    const tags = asStrArr(b.tags).slice(0, 40);
    if (!text.trim() && !tags.length) return res.status(400).json({ error: lang === 'en' ? 'Provide a one-line idea, synopsis or tags' : '请提供一句话创意、简介或标签' });
    const m = matchArchetype({ text, tags }, lang);
    // 引擎用英文关键词匹配但仍返回中文条目；英文界面按 id 覆盖名称/公式/用法，避免中英混排
    const localize = <T extends { id: string }>(list: T[], dict: Record<string, object>) =>
      list.map((x) => ({ ...x, ...(dict[x.id] || {}) }));
    const en = lang === 'en';
    // 系统机制只有「名称+机制」两栏，英文库无 formula；只取这两栏，避免把中文公式带进英文界面
    const sys = en
      ? m.system.map((s) => { const e = SYSTEM_EN[s.id]; return e ? { id: s.id, name: e.name, tip: e.tip } : { id: s.id, name: s.name, tip: s.tip }; })
      : m.system;
    res.json({
      protag: en ? localize(m.protag, PROTAG_EN) : m.protag,
      villain: en ? localize(m.villain, VILLAIN_EN) : m.villain,
      system: sys,
      hasSystem: m.system.length > 0,
    });
  });

  return r;
}
export const craftRouter = createCraftRouter();
