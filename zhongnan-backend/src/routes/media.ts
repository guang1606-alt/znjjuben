/** 媒体读取：/media/:id 返回落库的生成图片，长缓存（内容不可变）。 */
import { Router } from 'express';
import { prisma as defaultPrisma } from '../lib/prisma';

function extOf(mime: unknown): string {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('webp')) return '.webp';
  return '.bin';
}

export function createMediaRouter(db: any = defaultPrisma): Router {
  const r = Router();
  r.get('/:id', async (req, res) => {
    try {
      const asset = await db.mediaAsset.findUnique({ where: { id: req.params.id } });
      if (!asset) return res.status(404).json({ error: 'NOT_FOUND' });
      // v2.558 下载原图：?download=1 让浏览器走保存而不是内联打开。
      // 前端 <a download> 在站内同源下已能生效，但 TOS 模式是 302 到跨域对象地址、
      // download 属性会被丢弃，因此字节直出分支额外补 Content-Disposition。
      const wantDownload = req.query.download === '1';
      // v2.542 TOS 模式的元数据行没有字节：302 到对象存储地址。
      // 重定向不设长缓存——对象地址若迁移/改名，短缓存可自然纠偏。
      if (!asset.bytes) {
        if (!asset.externalUrl) return res.status(404).json({ error: 'NOT_FOUND' });
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.redirect(302, String(asset.externalUrl));
      }
      res.setHeader('Content-Type', asset.mime || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (wantDownload) {
        const safeId = String(asset.id).replace(/[^A-Za-z0-9_-]/g, '');
        res.setHeader('Content-Disposition', `attachment; filename="poster-${safeId}${extOf(asset.mime)}"`);
      }
      return res.send(Buffer.from(asset.bytes));
    } catch {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });
  return r;
}

export const mediaRouter = createMediaRouter();
