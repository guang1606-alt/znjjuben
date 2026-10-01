/**
 * 剧本导出（PRD 2.5 / 用户硬性要求）：docx / pdf / txt
 *  - 内容：封面 + 故事大纲 + 人物小传 + 分集目录 + 完整分集；docx/pdf 页脚“第 X 页 共 Y 页”
 *  - 会员门控：txt 登录即可；docx 需 BASIC+；pdf 需 ADVANCED+；去水印需 ADVANCED+
 *  - 只能导出本人项目；文件名走 RFC5987 编码，兼容中文
 */
import { asyncRouter } from '../lib/async-router';
import { failInternal } from '../lib/http-errors';
import { prisma as defaultPrisma } from '../lib/prisma';
import { authRequired, AuthRequest } from '../middleware/auth';
import { MemberLevel } from '../config/pricing';
import { buildScriptDoc, canExport, canRemoveWatermark, canExportShotList, type ExportFormat } from '../lib/script-doc';
import { buildProductionMaterials, buildSceneBreakdown } from '../engine/production-materials'; // v2.154 制作物料清单 JSON 端点；v2.155 场景明细矩阵
import { buildVisualStylePrompt } from '../engine/visual-style-library'; // v2.155 场景生图提示词组装
import { buildExportDocument } from '../engine/export-doc';
import { normalizeBibleCharacters } from '../lib/cast-arc'; // v2.192 c192 人物表归一同源复用
import { renderDocx } from '../lib/export-docx';
import { renderPdf } from '../lib/export-pdf';
import { latestScripts } from '../lib/latest-scripts';

type PrismaLike = typeof defaultPrisma;

function contentDisposition(filename: string) {
  return `attachment; filename="script.export"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
function toTxt(blocks: ReturnType<typeof buildScriptDoc>['blocks']): string {
  return blocks.map((b) => {
    switch (b.kind) {
      case 'cover': return `${b.title}\n${b.meta.join('\n')}`;
      case 'h1': return `\n\n${b.text}\n${'='.repeat(Math.max(4, b.text.length * 2))}`;
      case 'h2': return `\n【${b.text}】`;
      case 'p': return b.text;
      case 'toc': return b.items.map((it) => `第${it.ep}集 ${it.title}${it.synopsis ? ` — ${it.synopsis}` : ''}`).join('\n');
      case 'waveChart': return ''; // 波形统计文本由后续 p 块承载，避免重复
      case 'epStart': return `\n\n第${b.ep}集　${b.title}\n`;
      case 'para': return b.text;
    }
  }).join('\n');
}

export function createExportRouter(prisma: PrismaLike | any) {
  const exportRouter = asyncRouter();

  // v2.154 制作物料清单 JSON（登录即可，聚合概览层）：场景总表/角色出场表/道具总表，供前端预览弹窗与 API 消费
  exportRouter.get('/:projectId/materials', authRequired, async (req: AuthRequest, res) => {
    const owner = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!owner) return res.status(401).json({ error: '用户不存在' });
    if (owner.banned) return res.status(403).json({ error: '账号已封禁' });
    // v2.295：已删=不存在（与 v2.293 generate 面同口径，导出/物料不得穿透软删除）
    const project = await prisma.project.findFirst({ where: { id: req.params.projectId, userId: req.userId!, status: { not: 'deleted' } } });
    if (!project) return res.status(404).json({ error: '项目不存在或无权访问' });
    const scripts = latestScripts<any>(await prisma.script.findMany({ where: { projectId: project.id } }));
    if (!scripts.length) return res.status(400).json({ error: '该项目还没有成稿分集，暂无物料可聚合' });
    const episodes = scripts.map((s: { epNo: number; content: string }) => ({ ep: s.epNo, content: s.content || '' }));
    const materials = buildProductionMaterials(episodes);
    // v2.155 场景明细矩阵：画风提示词从项目 bible.visualStyleId 组装（非法编号静默跳过，英文画风段置前）
    const styleId = (() => { try { const b = project.bible as { visualStyleId?: unknown } | null; return typeof b?.visualStyleId === 'string' ? b.visualStyleId : undefined; } catch { return undefined; } })();
    const sb = buildSceneBreakdown(episodes, { stylePrompt: styleId ? buildVisualStylePrompt(styleId) : '' });
    res.json({
      projectId: project.id, title: project.title, episodeCount: scripts.length,
      ...materials,
      sceneBreakdown: { ...sb, details: sb.details.slice(0, 500) }, // details 防御性硬帽，控响应体量
    });
  });

  exportRouter.get('/:projectId', authRequired, async (req: AuthRequest, res) => {
    const fmt = String((req.query.format || 'docx')).toLowerCase() as ExportFormat;
    if (!['docx', 'pdf', 'txt'].includes(fmt)) return res.status(400).json({ error: '格式仅支持 docx / pdf / txt' });
    // 权益以数据库实时状态为准（JWT 可能滞后于到期/降级/封禁）
    const owner = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!owner) return res.status(401).json({ error: '用户不存在' });
    if (owner.banned) return res.status(403).json({ error: '账号已封禁' });
    const level = (owner.level ?? req.level ?? 'FREE') as MemberLevel;
    if (!canExport(level, fmt)) {
      return res.status(403).json({ error: fmt === 'pdf' ? 'PDF 导出为高级会员及以上权益，升级后即可使用' : 'docx 导出为基础会员及以上权益，升级后即可使用', needUpgrade: true, format: fmt });
    }
    const wantNoWm = req.query.noWatermark === '1' || req.query.noWatermark === 'true';
    const noWatermark = wantNoWm && canRemoveWatermark(level);

    // v2.295：已删=不存在（已删项目全剧正文不得再被打包下载）
    const project = await prisma.project.findFirst({ where: { id: req.params.projectId, userId: req.userId!, status: { not: 'deleted' } } });
    if (!project) return res.status(404).json({ error: '项目不存在或无权访问' });
    let scripts = latestScripts<any>(await prisma.script.findMany({ where: { projectId: project.id } }));
    if (!scripts.length) return res.status(400).json({ error: '该项目还没有成稿分集，暂无可导出内容' });
    // 单集导出：?ep=3 仅导出第 3 集（txt 免费，docx/pdf 仍走会员门控）
    const epParam = req.query.ep as string | undefined;
    let epOnly: number | null = null;
    if (epParam) {
      epOnly = parseInt(epParam, 10);
      if (!Number.isFinite(epOnly)) return res.status(400).json({ error: 'ep 参数必须是数字' });
      const filtered = scripts.filter((s: { epNo: number }) => s.epNo === epOnly);
      if (!filtered.length) return res.status(404).json({ error: `第 ${epOnly} 集不存在` });
      scripts = filtered;
    }

    // v2.148 画风锚点：AIGC 项目从 project.bible 读取视觉画风编号，随分镜附录注入统一画风提示词
    const storedStyleId = (() => { try { const b = project.bible as { visualStyleId?: unknown } | null; return typeof b?.visualStyleId === 'string' ? b.visualStyleId : undefined; } catch { return undefined; } })();
    // v2.149 镜头语言锚点：AIGC 项目从 project.bible 读取镜头语言编号，随分镜附录注入统一镜头语法提示词
    const storedCamId = (() => { try { const b = project.bible as { cameraStyleId?: unknown } | null; return typeof b?.cameraStyleId === 'string' ? b.cameraStyleId : undefined; } catch { return undefined; } })();
    const doc = buildScriptDoc(project, scripts, { penName: owner?.penName, noWatermark, level, includeShotList: canExportShotList(level), visualStyleId: storedStyleId, cameraStyleId: storedCamId });
    // v2.18 章节/页码估算模型接线：用结构化装配器核算预计总页数与目录锚点，随下载响应头返回，前端可展示“共N页/目录完整”
    // v2.192 c192 人物表与导出文档同源归一：数组形态/原始值/非字符串字段统一清洗，
    // 防海报人物清单出现数字索引名或把 number 拼成 desc（Json 读取不信任铁律）
    const bibleChars = (() => { try { return normalizeBibleCharacters((project.bible as { characters?: unknown } | null)?.characters); } catch { return {}; } })();
    const manifest = buildExportDocument({
      title: project.title,
      penName: owner?.penName,
      synopsis: (project as { synopsis?: string }).synopsis ?? '',
      characters: Object.entries(bibleChars).map(([name, c]) => ({ name, desc: [c.traits, c.arc].map((x) => (x || '').trim()).filter(Boolean).join('；') })),
      episodes: scripts.map((s: { epNo: number; title: string; content: string }) => ({ n: s.epNo, title: s.title, body: s.content })),
      createdAt: new Date().toISOString().slice(0, 10),
    });
    res.setHeader('X-Estimated-Pages', String(manifest.pageCount));
    res.setHeader('X-Episode-Count', String(scripts.length));
    const safeTitle = ((project.title || '剧本') + (epOnly ? `_第${epOnly}集` : '')).replace(/[\\/:*?"<>|]/g, '_');

    try {
      if (fmt === 'docx') {
        const buf = await renderDocx(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', contentDisposition(`${safeTitle}.docx`));
        return res.end(buf);
      }
      if (fmt === 'pdf') {
        const buf = await renderPdf(doc);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', contentDisposition(`${safeTitle}.pdf`));
        return res.end(buf);
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', contentDisposition(`${safeTitle}.txt`));
      return res.end('﻿' + toTxt(doc.blocks)); // BOM 保证 Windows 记事本中文不乱码
    } catch (e) {
      failInternal(res, e, 'export.render');
    }
  });

  return exportRouter;
}

export const exportRouter = createExportRouter(defaultPrisma);
