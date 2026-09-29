/**
 * 创作等待游戏化进度 / 小南共创陪伴（纯函数、可对拍）
 * ----------------------------------------------------------------
 * 用户诉求：生成剧本的等待不能枯燥，要有进度条、互动感、游戏感、小南参与感。
 * 设计铁律：
 *  1) 阶段不另造——唯一从 pipeline-order 的 PIPELINE_ORDER 动态派生，岗位增并时进度自动跟随，
 *     且用 coverage 自检强制“每个阶段都必须配文案”，新增岗位漏配会被测试打回；
 *  2) 进度单调不减：门岗回退是质量动作，不把进度条往回拉，只用小南文案体现“又把了一道关”；
 *  3) 台词确定性：按阶段+集数哈希取文案，避免同一次生成前后闪烁、也便于测试；
 *  4) 免费用户也有基础陪伴，高阶会员解锁更密的“创作冷知识彩蛋”，权益可感知地拉开。
 */
import { orderedStages, PipelineStage, StageKind } from '../agents/pipeline-order';
import { Tier } from './stage-workflow';

export interface StageMeta {
  fun: string;                 // 给用户看的轻松阶段名（游戏感）
  lines: string[];             // 小南陪伴台词池（≥2，轮换不重复感）
  tipFree: string;             // 全用户可见的创作小贴士
  tipPro?: string;             // 高级/专业会员额外彩蛋
}
// 外层（非岗位）阶段
const OUTER: Record<string, StageMeta> = {
  context: { fun: '小南正在摸清楚你的口味', lines: ['小南：我先看看时令热点和你的偏好，马上开工～', '小南：把你的习惯和当下爆款都捋一遍，方向更准。'], tipFree: '好方向胜过急着动笔。' },
  done: { fun: '新鲜剧本出炉', lines: ['小南：搞定！快看看这一版，哪里想改随时喊我～', '小南：交付啦，记得看我的评分和优化建议哦。'], tipFree: '好剧本是改出来的，多打磨几轮更出彩。', tipPro: '专业版可一键自动优化并保留版本对比。' },
};
// 十个岗位阶段的文案（key 必须与 PIPELINE_ORDER 一一对应，缺一个 coverage 测试就失败）
const STAGE_META: Record<string, StageMeta> = {
  market_pre: { fun: '先看看市场吃不吃这套', lines: ['小南：我先去市场岗转一圈，这个题材最近火不火、对谁的胃口～', '小南：定方向啦，先确认这条路子对不对，免得白写。'], tipFree: '动笔前先定受众和爽点方向。', tipPro: '市场前置会结合实时榜单与稀缺题材给蓝海判断。' },
  architect: { fun: '剧情架构师在搭骨架', lines: ['小南：架构师正在排黄金三秒和每集钩子，骨架要稳～', '小南：起承转合、爽点反转排兵布阵中。'], tipFree: '每集都要有钩子-冲突-转折-留白。', tipPro: '分层钩子（场/集/动作/氛围/语言）已按你的设置排布。' },
  character: { fun: '人设设计师在捏人物', lines: ['小南：给主角填隐性设定呢，原生家庭、口头禅、小心思都安排上～', '小南：配角也要有自己的主意，不当工具人。'], tipFree: '人物立不立得住，看他有没有“隐性设定”。', tipPro: '人物行为逻辑校验会全程盯防人设崩塌。' },
  writer: { fun: '单集撰写师正在写本集', lines: ['小南：撰写师落笔啦，台词尽量说人话、有烟火气～', '小南：这一集的冲突和结尾钩子正在成型。'], tipFree: '台词要像真人说话，别端着、别对仗。', tipPro: '多模型异构协作，中文成稿走中文语感最强的模型。' },
  audience: { fun: '观众代言官在挑刺', lines: ['小南：我扮成挑剔观众，哪里想划走我就喊停～', '小南：站在观众角度先骂一遍，扛住划走点才放行。'], tipFree: '前3秒代入不了，后面再好也没人看。', tipPro: '观众代言官预判划走点并倒逼强化。' },
  polish: { fun: '细节润色师在添烟火气', lines: ['小南：润色师在补生活细节、去AI腔，让它更像人写的～', '小南：动作、表情、氛围再磨细一点。'], tipFree: '细节要为叙事和情绪服务，不堆字数。', tipPro: '润色后还要过去AI化校验门。' },
  consistency: { fun: '一致性校验门把关中', lines: ['小南：把一道一致性关，人设剧情不能打架（不合格我让它重写）～', '小南：逻辑自洽检查中，进度不退、质量不退。'], tipFree: '前后矛盾是剧本硬伤，必须堵。' },
  deai: { fun: '去AI化校验门扫痕迹', lines: ['小南：扫一遍AI味，套路句、工整腔统统揪出来～', '小南：再像人一点，再像人一点点。'], tipFree: 'AI痕迹越少，越像真人编剧。', tipPro: '去AI化分低于阈值会自动打回润色。' },
  compliance: { fun: '合规审核师排雷', lines: ['小南：合规排雷，平台尺度、敏感点都过一遍，保你能过审～', '小南：把风险点提前拆掉，省得投稿被打回。'], tipFree: '先合规，再谈爆。' },
  market_post: { fun: '市场终评+匹配投稿', lines: ['小南：最后打个分、估个商业价值，再帮你找合适的投稿路子～', '小南：成稿体检完成，评分和变现建议马上来。'], tipFree: '写完看评分和优化建议，针对性再改。', tipPro: '自动匹配国内外投稿/分账/IP合作通道。' },
};

const PRE_END = 4;       // context 占 0-4%
const POST_START = 96;   // done 从 96 到 100
export interface ProgressInput { stage: string; episodeIndex?: number; totalEpisodes?: number; tier?: Tier; seed?: number }
export interface ProgressSnapshot {
  percent: number; label: string; xiaonanLine: string; tip?: string;
  stageKind: StageKind | 'outer'; isGateRework?: boolean;
}

function hashPick<T>(arr: T[], seed: number): T {
  if (!arr.length) throw new Error('台词池不能为空');
  let h = seed >>> 0;
  for (let i = 0; i < arr.length; i++) h = (h * 1103515245 + 12345) >>> 0;
  return arr[h % arr.length];
}

/** 覆盖率自检：PIPELINE_ORDER 每个阶段都必须配文案（新增岗位漏配即报错，机制防脱节） */
export function progressCoverageErrors(): string[] {
  return orderedStages()
    .filter((s) => !STAGE_META[s.key])
    .map((s) => `阶段${s.key}缺少游戏化进度文案`);
}

export function progressSnapshot(inp: ProgressInput): ProgressSnapshot {
  const errs = progressCoverageErrors();
  if (errs.length) throw new Error(errs.join('；'));
  const stages = orderedStages();
  const seed = (inp.seed ?? 0) + (inp.episodeIndex ?? 0);

  if (inp.stage === 'context') return outer('context', 2, seed, inp.tier);
  if (inp.stage === 'done' || inp.stage === 'frozen') return outer('done', 100, seed, inp.tier);

  const idx = stages.findIndex((s) => s.key === inp.stage);
  if (idx === -1) {
    // 未知阶段安全降级：不崩、给中性进度（取中段），并保留继续推进
    return { percent: 50, label: '小南和团队正在创作中…', xiaonanLine: '小南：多岗位协作中，稍等一下下～', stageKind: 'llm' };
  }
  const stage = stages[idx];
  const meta = STAGE_META[stage.key];
  const span = (POST_START - PRE_END) / stages.length;
  let base = PRE_END + idx * span;
  // 撰写/润色类阶段内部随集数推进，长剧本也能看到进度在走
  if (inp.totalEpisodes && inp.totalEpisodes > 1 && ['writer', 'polish', 'audience'].includes(stage.key)) {
    const ratio = Math.min(1, Math.max(0, (inp.episodeIndex ?? 0) / inp.totalEpisodes));
    base += span * ratio;
  } else {
    base += span * 0.5;
  }
  const percent = Math.round(Math.min(99, Math.max(PRE_END, base)));
  const isPro = inp.tier === 'high' || inp.tier === 'pro';
  return {
    percent,
    label: meta.fun,
    xiaonanLine: hashPick(meta.lines, seed + stage.order),
    tip: isPro && meta.tipPro ? meta.tipPro : meta.tipFree,
    stageKind: stage.kind,
  };
}

function outer(key: string, percent: number, seed: number, tier: Tier | undefined): ProgressSnapshot {
  const meta = OUTER[key];
  const isPro = tier === 'high' || tier === 'pro';
  return { percent, label: meta.fun, xiaonanLine: hashPick(meta.lines, seed + percent), tip: isPro && meta.tipPro ? meta.tipPro : meta.tipFree, stageKind: 'outer' };
}

/** 整条流水线的进度时间线（前端可直接渲染阶段条），保证单调不减、终点100 */
export function progressTimeline(tier?: Tier): { stage: string; label: string; percent: number }[] {
  const seq = [
    { stage: 'context', p: 2 },
    ...orderedStages().map((s, i) => ({ stage: s.key, p: progressSnapshot({ stage: s.key, tier }).percent })),
    { stage: 'done', p: 100 },
  ];
  return seq.map((x) => ({ stage: x.stage, label: labelOf(x.stage), percent: x.p }));
}
function labelOf(key: string): string {
  if (OUTER[key]) return OUTER[key].fun;
  const s: PipelineStage | undefined = orderedStages().find((q) => q.key === key);
  return s ? STAGE_META[key].fun : key;
}

/**
 * 流水线事件角色 → 顺序表阶段 key 的映射（pipeline 用 designer 表示人设岗、
 * 校验循环以 polisher retry 承载一致性/去AI门，这里统一翻译，供 SSE 层直接出进度）。
 */
export function roleEventToStage(role: string, note = ''): string {
  switch (role) {
    case 'dispatcher': return 'context';
    case 'architect': return 'architect';
    case 'designer': return 'character';
    case 'writer': return 'writer';
    case 'audience': return 'audience';
    case 'polisher':
      if (/去AI|AI腔|AI味/.test(note)) return 'deai';
      if (/一致|逻辑|硬伤/.test(note)) return 'consistency';
      return 'polish';
    case 'compliance': return 'compliance';
    case 'market': return 'market_post';
    case 'done': return 'done';
    default: return role; // 未知交给 progressSnapshot 安全降级
  }
}
