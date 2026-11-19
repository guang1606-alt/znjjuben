/** 媒体读取：/media/:id 返回落库的生成图片，长缓存（内容不可变）。 */
import { Router } from 'express';
import { prisma as defaultPrisma } from '../lib/prisma';

export function createMediaRouter(db: any = defaultPrisma): Router {
  const r = Router();
  r.get('/:id', async (req, res) => {
    try {
      const asset = await db.mediaAsset.findUnique({ where: { id: req.params.id } });
      if (!asset) return res.status(404).json({ error: 'NOT_FOUND' });
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
      return res.send(Buffer.from(asset.bytes));
    } catch {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });
  return r;
}

export const mediaRouter = createMediaRouter();
