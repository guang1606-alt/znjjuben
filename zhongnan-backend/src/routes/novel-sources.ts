/**
 * 合法免费小说素材来源路由（服务 3.4 小说改编 + 用户点名的"免费下载小说多语言链接版面"）
 * 纯只读、不连数据库、免费：列出来源 / 按语言·授权筛选 / 关键词检索 / 结构自检。
 * 合规底线：只暴露 free-novel-sources 中三类干净来源（公版/CC/平台正版免费），绝不做盗版导航。
 */
import { asyncRouter } from '../lib/async-router';
import {
  NOVEL_SOURCES, listSources, validateSources, type License,
} from '../engine/free-novel-sources';

const VALID_LICENSE = new Set<License>(['public_domain', 'cc', 'platform_free']);

export function createNovelSourcesRouter() {
  const r = asyncRouter();

  // 来源列表：?lang=zh|en|ja|ko|es|de|fr|it&license=public_domain|cc|platform_free&adapt=1&q=关键词
  r.get('/', (req, res) => {
    const lang = String(req.query.lang ?? '').trim().toLowerCase();
    const license = String(req.query.license ?? '').trim() as License;
    const adaptOnly = req.query.adapt === '1' || req.query.adapt === 'true';
    const q = String(req.query.q ?? '').trim().toLowerCase();
    let list = listSources();
    if (lang) list = list.filter((s) => s.langs.includes(lang) || s.langs.includes('multi'));
    if (license && VALID_LICENSE.has(license)) list = list.filter((s) => s.license === license);
    if (adaptOnly) list = list.filter((s) => s.adapt);
    if (q) list = list.filter((s) =>
      [s.name, s.desc, s.adaptNote, s.id].join(' ').toLowerCase().includes(q));
    const languages = Array.from(new Set(NOVEL_SOURCES.flatMap((s) => s.langs))).filter((l) => l !== 'multi').sort();
    res.json({
      total: list.length,
      languages,
      licenseLabels: { public_domain: '公版·可改编商用', cc: '作者授权(CC)·需遵协议', platform_free: '平台正版免费·仅限阅读' },
      sources: list,
    });
  });

  // 语言聚合：每个语言可用来源数（含 multi 计入）
  r.get('/languages', (_req, res) => {
    const counts = new Map<string, number>();
    NOVEL_SOURCES.forEach((s) => s.langs.forEach((l) => {
      if (l === 'multi') return;
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }));
    res.json({ languages: [...counts.entries()].map(([lang, count]) => ({ lang, count })).sort((a, b) => b.count - a.count) });
  });

  // 结构自检（无重复/无盗版域名/均https/授权说明齐全）
  r.get('/validate', (_req, res) => res.json(validateSources()));

  return r;
}

export const novelSourcesRouter = createNovelSourcesRouter();
