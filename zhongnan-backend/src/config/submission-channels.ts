/**
 * 投稿与变现通道库（持续扩充国内外选择）。
 * 诚信铁律：这里只沉淀“平台/机构 + 通道类型 + 公开入口类型 + 适配题材”，
 * 不臆造任何对接人/电话/邮箱；具体联系方式必须由运营核验后填入并打 verifiedAt，
 * 未核验一律标注“待核验”，前端不得展示为已确认联系方式（用户会电话核实，造假即翻车）。
 */
export type ChannelRegion = 'domestic' | 'overseas';
export type ChannelKind = '分账投稿' | '版权买断' | '定制承制' | '编剧签约入驻' | 'IP合作改编' | '赛事征稿' | '制作方MCN';
export interface ContactInfo { type: string; detail: string; verifiedAt: string | null; note: string }
export interface SubmissionChannel {
  id: string; name: string; region: ChannelRegion; kinds: ChannelKind[];
  fitTags: string[];                 // 适配题材关键词（与标签库大类对齐）
  fitGenre?: ('女频' | '男频' | '全性别')[];
  contact: ContactInfo;
  highlight?: string;
}
const TODO_CONTACT = (type: string): ContactInfo => ({ type, detail: '', verifiedAt: null, note: '需运营核验官方入口/对接方式后填充，严禁臆造' });

export const SUBMISSION_CHANNELS: SubmissionChannel[] = [
  { id: 'hongguo', name: '红果短剧', region: 'domestic', kinds: ['分账投稿', 'IP合作改编'], fitTags: ['现代家庭', '情感', '悬疑', '逆袭', '现实'], fitGenre: ['全性别'], contact: TODO_CONTACT('官网/创作者中心分账入口'), highlight: '五大激励通道自动叠加、不设上限（见 platform-playbook.incentiveStack）' },
  { id: 'douyin_copyright', name: '抖音集团短剧版权中心', region: 'domestic', kinds: ['IP合作改编', '编剧签约入驻', '分账投稿'], fitTags: ['真人短剧', 'IP改编', '精品', '群像'], fitGenre: ['全性别'], contact: TODO_CONTACT('官方版权合作/编剧入驻通道'), highlight: '加强IP合作、激励编剧入驻；真人短剧精品化/系列化/群像化' },
  { id: 'fanqie', name: '番茄短剧/番茄小说', region: 'domestic', kinds: ['IP合作改编', '分账投稿'], fitTags: ['小说改编', '男频', '女频', '短故事'], fitGenre: ['全性别'], contact: TODO_CONTACT('番茄作家/改编合作入口'), highlight: '短故事体裁成为真人短剧IP改编新增长点' },
  { id: 'dianzhong', name: '点众科技', region: 'domestic', kinds: ['分账投稿', '版权买断', '制作方MCN'], fitTags: ['男频', '逆袭', '战神', '都市'], fitGenre: ['男频'], contact: TODO_CONTACT('官方商务/投稿入口') },
  { id: 'jiuzhou', name: '九州文化', region: 'domestic', kinds: ['分账投稿', '定制承制'], fitTags: ['女频', '虐恋', '甜宠', '豪门'], fitGenre: ['女频'], contact: TODO_CONTACT('官方投稿/商务入口') },
  { id: 'maiya', name: '麦芽传媒', region: 'domestic', kinds: ['制作方MCN', '定制承制', '编剧签约入驻'], fitTags: ['都市', '情感', '精品'], fitGenre: ['全性别'], contact: TODO_CONTACT('官方制作/签约入口') },
  { id: 'kuaishou_drama', name: '快手星芒短剧', region: 'domestic', kinds: ['分账投稿', '赛事征稿'], fitTags: ['现实', '乡土', '情感', '喜剧'], fitGenre: ['全性别'], contact: TODO_CONTACT('星芒计划官方入口') },
  { id: 'reelshort', name: 'ReelShort', region: 'overseas', kinds: ['分账投稿', 'IP合作改编', '定制承制'], fitTags: ['Werewolf', 'Billionaire', 'Mafia', 'Mate', '出海'], fitGenre: ['女频', '全性别'], contact: TODO_CONTACT('官方海外内容合作入口'), highlight: '北美霸总/狼人/命定伴侣强势题材' },
  { id: 'dramabox', name: 'DramaBox', region: 'overseas', kinds: ['分账投稿', '编剧签约入驻'], fitTags: ['Revenge', 'CEO', 'Marriage', '出海'], fitGenre: ['女频', '全性别'], contact: TODO_CONTACT('官方编剧/内容合作入口') },
  { id: 'goodshort', name: 'GoodShort', region: 'overseas', kinds: ['分账投稿', '定制承制'], fitTags: ['Romance', 'Werewolf', '出海'], fitGenre: ['女频'], contact: TODO_CONTACT('官方内容合作入口') },
  { id: 'shortmax', name: 'ShortMax', region: 'overseas', kinds: ['分账投稿', 'IP合作改编'], fitTags: ['Fantasy', 'Romance', '出海'], fitGenre: ['全性别'], contact: TODO_CONTACT('官方合作入口') },
];

export interface ChannelMatch extends SubmissionChannel { matched: string[]; verified: boolean }
/** 按标签/性别向/地区推荐最适配的 N 个通道；未核验联系方式的通道仍可推荐但明确 verified=false */
export function matchChannels(opts: { tags?: string[]; genre?: string; region?: ChannelRegion | 'all'; count?: number } = {}): ChannelMatch[] {
  const { tags = [], genre, region = 'all', count = 5 } = opts;
  const tagSet = new Set(tags);
  const scored = SUBMISSION_CHANNELS
    .filter((c) => region === 'all' || c.region === region)
    .filter((c) => !genre || !c.fitGenre || c.fitGenre.includes(genre as '女频') || c.fitGenre.includes('全性别'))
    .map((c) => {
      const matched = c.fitTags.filter((t) => tagSet.has(t));
      return { c, score: matched.length + (c.fitGenre?.includes(genre as '女频') ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ c }) => ({ ...c, matched: c.fitTags.filter((t) => tagSet.has(t)), verified: c.contact.verifiedAt != null }));
  return scored;
}
/** 待核验数量（后台运营看板用：督促把联系方式补齐） */
export function unverifiedCount(): number {
  return SUBMISSION_CHANNELS.filter((c) => c.contact.verifiedAt == null).length;
}
