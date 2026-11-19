/**
 * 生成图片的永久留存：优先 TOS；未配置 TOS 时把二进制落库（MediaAsset），
 * 由 /media/:id 稳定读取，避免模型返回的临时 URL 过期后海报变裂图。
 */
import { prisma } from './prisma';
import { tosEnabled, uploadImageToTos, fetchImageBytes } from './tos';

/** 单张图片体积极限（运行时读取，便于运维与测试调整） */
function maxBytes(): number {
  return Number(process.env.MEDIA_MAX_BYTES || 12 * 1024 * 1024);
}

/**
 * 把图片模型返回的临时 URL / data URI 转成永久地址。
 * 任何一步失败都回退原地址，不让海报生成整体失败。
 */
export async function persistImage(input: string, kind = 'poster', db: any = prisma): Promise<string> {
  if (!input) return input;
  if (tosEnabled()) return uploadImageToTos(input, kind);
  try {
    const { buf, mime } = await fetchImageBytes(input);
    if (!buf.length || buf.length > maxBytes()) return input;
    if (!db?.mediaAsset?.create) return input;
    const asset = await db.mediaAsset.create({ data: { kind, mime, size: buf.length, bytes: buf } });
    return `/media/${asset.id}`;
  } catch {
    return input;
  }
}
