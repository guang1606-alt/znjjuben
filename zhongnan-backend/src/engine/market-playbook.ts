/**
 * market-playbook.ts —— 市场赛道与海外本地化打法（来自2026-08一线编剧复盘，抽象为可复用策略）
 *  - 下沉 vs 精品：两条赛道的情绪反射机制不同，节奏不能混用
 *  - 海外本地化：国内公式出海失效，按地区匹配爽点/题材/台词节奏；跨文化创新=把文化变成人设/能力/爽点
 *  - 每集三问拆解法：主角想要什么 / 谁在阻拦 / 观众为什么想看下一集
 */

export type TrackId = 'mass' | 'premium';
export interface TrackStrategy {
  id: TrackId;
  name: string;
  gratification: string;          // 即时/延迟满足
  core: string;
  rhythm: string;
  payoffWindow: string;
  compete: string;
  taboo: string;
}

export const TRACK_STRATEGY: Record<TrackId, TrackStrategy> = {
  mass: {
    id: 'mass', name: '下沉剧（高爆发）', gratification: '即时满足',
    core: '情绪压迫感：把主角退路彻底堵死，让观众憋气到极限再狠狠一巴掌扇回去，明码标价卡付费点',
    rhythm: '钩子与密度优先：三句内推进、被扇三句台词内反派就要跪，不给观众思考时间',
    payoffWindow: '受压后极速兑付，小爽点不断',
    compete: '拼钩子密度与情绪强度',
    taboo: '忌用精品剧的慢节奏写下沉，拖沓=秒退',
  },
  premium: {
    id: 'premium', name: '精品剧（高保底）', gratification: '延迟满足',
    core: '智商高反差：身份错位 + 意料之外的脑洞反转，拉长憋屈换取高质量情绪后劲',
    rhythm: '受压后不急亮底牌，用身份错位/环境压迫蓄势，但反转绝不拖过三句话、打脸不超过两分钟',
    payoffWindow: '蓄力后一次高智商兑付，重人物弧光',
    compete: '拼人物弧光与反转智商',
    taboo: '忌用下沉剧的粗暴逻辑写精品，无脑爽会拉低质感',
  },
};

export function recommendTrack(text: string): TrackId {
  // 身份错位/脑洞/强人设复杂关系偏精品；极致压迫、密集打脸、家庭伦理偏下沉
  const t = text || '';
  const premiumHit = /身份错位|隐藏身份|局中局|高智商|商战|权谋|层层反转|认知差/.test(t);
  const massHit = /打脸|下跪|婆媳|赶出家门|净身出户|逼婚|离婚|复仇|逆袭|欺负/.test(t);
  return premiumHit && !massHit ? 'premium' : 'mass';
}

/* ---------------- 海外本地化 ---------------- */
export interface RegionPlaybook {
  region: string;
  want: string;
  hotTopics: string[];
  lineStyle: string;
  openRhythm: string;
  avoid: string;
}
export const OVERSEA_PLAYBOOK: Record<string, RegionPlaybook> = {
  CN: {
    region: '国内', want: '阶级逆袭、底层打脸、翻身感',
    hotTopics: ['战神归来', '婆媳关系', '重生复仇', '真假千金', '赘婿逆袭', '离婚翻盘'],
    lineStyle: '大白话、刀刀见血', openRhythm: '3秒钩子、持续压迫',
    avoid: '慢铺垫、讲道理',
  },
  WEST: {
    region: '欧美', want: '极致宿命感 + 竞技虐恋（强制爱/命运牵引），而非底层被看不起',
    hotTopics: ['狼人觉醒', '吸血鬼/女巫', '豪门竞技', '带球跑', '强制爱', '命运婚约', '王室/贵族'],
    lineStyle: '直白火辣、情绪外显', openRhythm: '冲突第一秒拉满，前3集慢铺垫即划走',
    avoid: '把国内“被看不起→打脸”公式硬搬（欧美观众难共情）；不是把中文翻译成英文，要做文化降维理解',
  },
};

/** 跨文化创新原则：不是硬讲/科普文化，而是把文化直接变成人设、能力、爽点 */
export const CROSS_CULTURE_PRINCIPLE = {
  rule: '文化元素人设化 / 能力化 / 爽点化，而非说教或科普',
  examples: ['西方女巫真实身份是大明女医', '吸血鬼咬人被东方黄符血脉压制', '西方屠龙，东方男主：这是老祖宗食谱里的东西', '夏娃实为女娲后人'],
  check: (idea: string) => ({
    isPersonaOrPower: /身份|后人|血脉|能力|法术|功法|克制|压制/.test(idea),
    advice: '确认文化点是否直接变成了人物底牌/能力反杀/爽点，而不是停下来讲解文化背景',
  }),
};

/** 每集三问（拆片/自检通用）：把“看热闹”变成“拆门道” */
export function perEpisodeThreeQ(episodeText: string) {
  const t = episodeText || '';
  return {
    want: /想|要|目标|夺回|证明|离开|保护|拿到|翻身/.test(t),       // 主角想要什么
    block: /拦|阻止|不让|刁难|抢|逼|陷害|对手|反目|阻挠/.test(t),    // 谁在阻拦
    whyNext: /\?|？|秘密|没想到|谁知|竟然|到底|悬|伏笔|藏|未|下集|突然/.test(t), // 为什么追下一集
  };
}
