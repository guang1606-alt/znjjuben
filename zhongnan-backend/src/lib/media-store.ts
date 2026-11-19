/**
 * 生成图片的永久留存：优先 TOS；未配置 TOS（或转存失败）时把二进制落库（MediaAsset），
 * 由 /media/:id 稳定读取，避免模型返回的临时 URL 过期后海报变裂图。
 * v2.542：TOS 成功也落一条元数据（不存字节），两种模式共用列表/删除/用量口径。
 */
import { prisma } from './prisma';
import { tosEnabled, uploadImageToTos, fetchImageBytes } from './tos';
import { logInternal } from './http-errors';

/** 单张图片体积极限（运行时读取，便于运维与测试调整） */
function maxBytes(): number {
  return Number(process.env.MEDIA_MAX_BYTES || 12 * 1024 * 1024);
}

/**
 * 把图片模型返回的临时 URL / data URI 转成永久地址。
 * 任何一步失败都回退原地址，不让海报生成整体失败。
 * ownerId 传入时同步记一条 StorageObject（refId=媒体 id），让「存储用量」真实反映生成物；
 * 记账失败不影响出图（图片已落库，只是不计入配额视图）。
 */
export async function persistImage(input: string, kind = 'poster', db: any = prisma, ownerId?: string): Promise<string> {
  if (!input) return input;
  if (tosEnabled()) {
    const stored = await uploadImageToTos(input, kind);
    // v2.541 转存成功才用 TOS 地址；失败继续走落库，不能把会过期的临时地址当永久地址返回
    // v2.542 TOS 成功也落一条元数据（不存字节）：两种存储模式共享「我的海报」列表、删除释放与用量口径，
    //         /media/:id 对无字节行 302 到对象地址，前端拿到的地址结构始终统一。
    if (stored) {
      if (!db?.mediaAsset?.create) return stored.url;
      try {
        const asset = await db.mediaAsset.create({
          data: { kind, mime: stored.mime, size: stored.size, externalUrl: stored.url, ...(ownerId ? { userId: ownerId } : {}) },
        });
        if (ownerId && db?.storageObject?.create) {
          // v2.573 记账失败不阻断出图，但必须可观测：静默会让存储用量少计（用户白拿容量）且无从排查
          try { await db.storageObject.create({ data: { userId: ownerId, kind, bytes: stored.size, refId: asset.id } }); } catch (e) { logInternal(e, 'media.accounting'); }
        }
        return `/media/${asset.id}`;
      } catch {
        return stored.url; // 元数据落库失败：退回直链，至少图打得开
      }
    }
  }
  try {
    const { buf, mime } = await fetchImageBytes(input);
    if (!buf.length || buf.length > maxBytes()) return input;
    if (!db?.mediaAsset?.create) return input;
    const asset = await db.mediaAsset.create({ data: { kind, mime, size: buf.length, bytes: buf, ...(ownerId ? { userId: ownerId } : {}) } });
    if (ownerId && db?.storageObject?.create) {
      // v2.573 同上：记不上账要留痕，否则配额口径长期偏低且无迹可查
      try {
        await db.storageObject.create({ data: { userId: ownerId, kind, bytes: buf.length, refId: asset.id } });
      } catch (e) { logInternal(e, 'media.accounting'); }
    }
    return `/media/${asset.id}`;
  } catch {
    return input;
  }
}
