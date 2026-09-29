/**
 * 标签能力路由（PRD 3.3 标签创建模式 + 3.9.1 多语言标签重排）
 * 纯只读、不连数据库：标签检索 / 维度概览 / 智能随机（懂市场+懂时令+懂用户）/ 组合自检 / 互补推荐。
 * 免费用户也可使用基础标签能力（PRD：免费用户=基础标签模式），故不强制登录；个性化字段由请求体显式带入。
 */
import { asyncRouter } from '../lib/async-router';
import {
  searchTags, DIMENSIONS, leafCount, validateCombo, recommendNext, ALL_TAGS, type DimId,
} from '../config/tag-taxonomy';
import { directTags } from '../engine/smart-tag-director';
import type { BoardItem } from '../engine/context-personalization';
import { boardStore } from '../services/board-store';

const VALID_DIMS = new Set(DIMENSIONS.map((d) => d.id));

export function createTagsRouter() {
  const r = asyncRouter();

  // 毫秒级标签检索（名称/别名），前端标签选择器搜索框用
  r.get('/search', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20) || 20));
    if (!q) return res.json({ q: '', results: [] });
    const results = searchTags(q, limit).map((t) => ({ id: t.id, name: t.name, dim: t.dim, heat: t.heat, boost: t.boost ?? 0 }));
    res.json({ q, results });
  });

  // 12 维度概览（各维叶子数量），前端按维度折叠渲染、避免标签过多造成选择困难
  r.get('/dimensions', (_req, res) => {
    res.json({ total: leafCount(), dimensions: DIMENSIONS });
  });

  // 按维度列叶子标签（按市场热度降序），前端维度浏览用；dim 非法时返回空数组而非报错
  r.get('/leaves', (req, res) => {
    const dim = String(req.query.dim ?? '');
    const limit = Math.min(120, Math.max(1, Number(req.query.limit ?? 40) || 40));
    if (!VALID_DIMS.has(dim as DimId)) return res.status(400).json({ error: 'unknown dimension', dimensions: DIMENSIONS.map((d) => d.id) });
    const leaves = ALL_TAGS.filter((t) => t.level === 3 && t.dim === dim)
      .sort((a, b) => b.heat - a.heat).slice(0, limit)
      .map((t) => ({ id: t.id, name: t.name, parent: t.parentId, heat: t.heat, boost: t.boost ?? 0 }));
    res.json({ dim, leaves });
  });

  // 标签组合自检：未知/重复/互斥/缺必备维度 + 平台扶持
  r.post('/validate', (req, res) => {
    const names = Array.isArray(req.body?.names) ? req.body.names.map((x: unknown) => String(x)) : [];
    res.json(validateCombo(names));
  });

  // 互补推荐：补齐缺失维度、规避互斥重复
  r.post('/recommend', (req, res) => {
    const names = Array.isArray(req.body?.names) ? req.body.names.map((x: unknown) => String(x)) : [];
    const n = Math.min(14, Math.max(1, Number(req.body?.n ?? 8) || 8));
    res.json({ recommend: recommendNext(names, n).map((t) => ({ id: t.id, name: t.name, dim: t.dim, heat: t.heat })) });
  });

  // 榜单接入状态（透明告知：是否有保鲜期内真实榜单、更新时间、来源平台）；空仓时前端如实说明未做爆款倾斜
  r.get('/board-status', (_req, res) => {
    res.json(boardStore.status());
  });

  // 智能随机（核心）：时令/爆款/画像合流，中英文分别走国内/海外选片导演
  r.post('/random', (req, res) => {
    const b = req.body ?? {};
    const locale = b.locale === 'en' ? 'en' : 'zh';
    const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
    const dims = asStrArr(b.dims).filter((d) => VALID_DIMS.has(d as DimId)) as DimId[];
    // 榜单条目日期反序列化（前端/采集器传入 ISO 字符串）
    const board: BoardItem[] = Array.isArray(b.board) ? b.board.map((x: Record<string, unknown>) => ({
      title: String(x.title ?? ''), platform: String(x.platform ?? ''),
      tags: asStrArr(x.tags), heat: Number(x.heat ?? 50),
      date: x.date ? new Date(String(x.date)) : new Date(),
      region: x.region === 'overseas' ? 'overseas' : 'domestic',
    })).filter((x: BoardItem) => x.title || x.tags.length) : [];
    // 请求未显式带榜单时，自动注入服务端榜单仓中"保鲜期内"的真实在榜数据，实现昨日爆款自动倾斜；空仓/过期则不倾斜
    const refNow = b.date ? new Date(String(b.date)) : new Date();
    const effectiveBoard = board.length ? board : boardStore.getFresh(refNow);
    const result = directTags({
      locale,
      seed: asStrArr(b.seed),
      dims: dims.length ? dims : undefined,
      maxTags: Number.isFinite(Number(b.maxTags)) ? Number(b.maxTags) : undefined,
      personalized: b.personalized === false ? false : true,
      maxInjected: Number.isFinite(Number(b.maxInjected)) ? Number(b.maxInjected) : undefined,
      date: b.date ? new Date(String(b.date)) : undefined,
      board: effectiveBoard.length ? effectiveBoard : undefined,
      profile: b.profile && typeof b.profile === 'object' ? {
        region: b.profile.region ? String(b.profile.region) : undefined,
        age: Number.isFinite(Number(b.profile.age)) ? Number(b.profile.age) : undefined,
        gender: b.profile.gender ? String(b.profile.gender) : undefined,
        bio: b.profile.bio ? String(b.profile.bio) : undefined,
        pastTags: asStrArr(b.profile.pastTags),
        editPreferredTags: asStrArr(b.profile.editPreferredTags),
        chatKeywords: asStrArr(b.profile.chatKeywords),
      } : undefined,
      boardRegion: b.boardRegion === 'overseas' || b.boardRegion === 'domestic' || b.boardRegion === 'all' ? b.boardRegion : undefined,
      freq: b.freq && typeof b.freq === 'object' ? b.freq : undefined,
      pref: b.pref && typeof b.pref === 'object' ? b.pref : undefined,
    });
    res.json(result);
  });

  return r;
}

export const tagsRouter = createTagsRouter();
