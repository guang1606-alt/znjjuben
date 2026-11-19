/** 媒体读取：/media/:id 返回落库的生成图片，长缓存（内容不可变）。 */
import { Router } from 'express';
import { prisma as defaultPrisma } from '../lib/prisma';

export function createMediaRouter(db: any = defaultPrisma): Router {
  const r = Router();
  r.get('/:id', async (req, res) => {
    try {
      const asset = await db.mediaAsset.findUnique({ where: { id: req.params.id } });
      if (!asset) return res.status(404).json({ error: 'NOT_FOUND' });
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
