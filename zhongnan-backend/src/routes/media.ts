/** 媒体读取：/media/:id 返回落库的生成图片，长缓存（内容不可变）。 */
import { Router } from 'express';
import { Readable } from 'node:stream';
import { prisma as defaultPrisma } from '../lib/prisma';
import { isOwnTosObjectUrl } from '../lib/tos';

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
        const external = String(asset.externalUrl);
        // v2.559 TOS 模式的「下载原图」闭环：302 到跨域对象会把 <a download> 的附件语义丢掉，
        // 生产模式下点击只是新标签打开图片、存下来仍是 UUID 文件名。download=1 时由服务端代理
        // 本桶对象字节并补附件头；只代理本桶域名，非本桶外链与上游异常一律回退 302，
        // 既不把下载变成 500，也不让站内路由沦为任意 URL 代理。
        if (wantDownload && isOwnTosObjectUrl(external)) {
          try {
            const upstream = await fetch(external, { signal: AbortSignal.timeout(15000) });
            if (upstream.ok && upstream.body) {
              const safeId = String(asset.id).replace(/[^A-Za-z0-9_-]/g, '');
              res.setHeader('Content-Type', upstream.headers.get('content-type') || asset.mime || 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="poster-${safeId}${extOf(asset.mime)}"`);
              res.setHeader('Cache-Control', 'private, max-age=0');
              res.setHeader('X-Content-Type-Options', 'nosniff');
              return Readable.fromWeb(upstream.body as any).pipe(res);
            }
          } catch { /* 代理失败回退 302，下载至少还能打开图片 */ }
        }
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.redirect(302, external);
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
