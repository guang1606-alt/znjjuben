/**
 * craft.ts —— 叙事工艺「小南递招」只读路由（PRD 2.2/导演钩子体系/v1.70 43张方法卡+10类钩子的前端出口）
 * 纯本地确定性计算，不连数据库、不耗大模型 token、免费：把 narrative-craft 沉淀的方法卡与钩子，
 * 按用户当前一句话创意/标签实时匹配，给「系统默认推荐」，同时支持用户自行浏览/增删（钩子不是僵硬办法）。
 */
import { asyncRouter } from '../lib/async-router';
import {
  HOOK_TAXONOMY, recommendHooks, openingHookAudit, matchCraftCards,
  CHARACTER_DEPTH_CARDS, NARRATIVE_DEVICE_CARDS, RELATIONSHIP_CARDS, GENRE_TOOLKIT_CARDS,
} from '../engine/narrative-craft';
import { pickDiverseSeeds, diversityAudit, type VersionInput } from '../engine/multi-version';
import { validateBranches, buildBranchSkeleton, applyMutator, autoLayout, type BranchGraph, type MutateOp } from '../engine/interactive-branch';

const CARD_GROUPS = [
  { key: 'character', name: '人物内驱·缺陷·弧光', cards: CHARACTER_DEPTH_CARDS },
  { key: 'device', name: '叙事装置·结构·反转', cards: NARRATIVE_DEVICE_CARDS },
  { key: 'relation', name: '关系·情感·双雄', cards: RELATIONSHIP_CARDS },
  { key: 'genre', name: '分类型工具箱', cards: GENRE_TOOLKIT_CARDS },
] as const;

export function createCraftRouter() {
  const r = asyncRouter();
  const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

  // 全量工艺分类浏览：10类钩子 + 4组方法卡（标题/公式层，点开才看步骤，避免信息过载）
  r.get('/taxonomy', (_req, res) => {
    res.json({
      hooks: HOOK_TAXONOMY.map((h) => ({ id: h.id, name: h.name, layer: h.layer, definition: h.definition, how: h.how, example: h.example, fit: h.fit })),
      cardGroups: CARD_GROUPS.map((g) => ({
        key: g.key, name: g.name, count: g.cards.length,
        cards: g.cards.map((c) => ({ id: c.id, title: c.title, formula: c.formula, fit: c.fit })),
      })),
      totals: { hooks: HOOK_TAXONOMY.length, cards: CARD_GROUPS.reduce((n, g) => n + g.cards.length, 0) },
    });
  });

  // 按当前创意/标签实时递招：匹配方法卡 + 系统默认钩子组合 + 开篇300字钩子审计
  r.post('/recommend', (req, res) => {
    const b = req.body ?? {};
    const text = String(b.text ?? '').slice(0, 6000);
    const tags = asStrArr(b.tags).slice(0, 40);
    if (!text.trim() && !tags.length) return res.status(400).json({ error: '请提供一句话创意、简介或标签' });
    const limit = Math.min(12, Math.max(1, Number(b.limit ?? 6) || 6));
    const cards = matchCraftCards({ text, tags, limit });
    const hooks = recommendHooks({ text, tags });
    const opening = b.opening ? openingHookAudit(String(b.opening).slice(0, 1200)) : null;
    res.json({
      cards: cards.map((c) => ({ id: c.id, title: c.title, formula: c.formula, steps: c.steps, fit: c.fit })),
      hooks: hooks.map((h) => ({ id: h.id, name: h.name, layer: h.layer, definition: h.definition, how: h.how, example: h.example })),
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
    res.json({ graph: g, report: validateBranches(g, lang), layout: autoLayout(g) });
  });
  // 互动短剧：可视化编辑器单次结构增删改（纯函数、自动维护边一致性），返回新图+校验+布局
  r.post('/branch-mutate', (req, res) => {
    const lang = req.body?.lang === 'en' ? 'en' : 'zh';
    const g = req.body?.graph as BranchGraph | undefined;
    const op = req.body?.op as MutateOp | undefined;
    if (!g || typeof g.start !== 'string' || !g.nodes || typeof g.nodes !== 'object') return res.status(400).json({ error: lang === 'en' ? 'Provide a valid branch graph' : '请提供合法分支图' });
    if (!op || typeof op.op !== 'string') return res.status(400).json({ error: lang === 'en' ? 'Missing edit op' : '缺少编辑操作 op' });
    try {
      const graph = applyMutator(g, op, lang);
      res.json({ graph, report: validateBranches(graph, lang), layout: autoLayout(graph) });
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
  return r;
}
export const craftRouter = createCraftRouter();
