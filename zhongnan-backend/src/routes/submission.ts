/**
 * 投稿与变现通道（PRD 商业闭环：剧本→推荐适配投稿平台）。
 * 数据来源：src/config/submission-channels.ts（运营核验后补 contact.verifiedAt）。
 * 诚信铁律：未核验联系方式的通道返回 verified=false，前端必须显式标注"待核验"，不得冒充已确认。
 */
import { asyncRouter } from '../lib/async-router';
import { matchChannels, SUBMISSION_CHANNELS, unverifiedCount, type ChannelRegion } from '../config/submission-channels';

export function createSubmissionRouter() {
  const r = asyncRouter();

  // GET /api/submission/channels — 全量通道（含 verified 标记，前端按地区/题材筛选）
  r.get('/channels', (_req, res) => {
    res.json({ channels: SUBMISSION_CHANNELS, unverified: unverifiedCount() });
  });

  // GET /api/submission/match?tags=情感,逆袭&genre=女频&region=domestic&count=5 — 按剧本标签匹配推荐
  r.get('/match', (req, res) => {
    const tags = (req.query.tags as string || '').split(',').map((s) => s.trim()).filter(Boolean);
    const genre = (req.query.genre as string) || undefined;
    const region = (req.query.region as ChannelRegion | 'all') || 'all';
    const count = Math.min(parseInt(req.query.count as string || '5', 10) || 5, 12);
    const matches = matchChannels({ tags, genre, region: region === 'all' ? 'all' : region, count });
    res.json({ matches, query: { tags, genre, region, count } });
  });

  return r;
}

export const submissionRouter = createSubmissionRouter();
