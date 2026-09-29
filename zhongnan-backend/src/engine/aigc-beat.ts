/**
 * AIGC 单集叙事微节拍规划器（#059，吸收 Seedance 2.5 实测能力）
 *
 * 背景：AI 视频单生成单元由 15s 提升到约 30s，已能承载一个完整小节拍。
 * 作用：把一集 AIGC 剧本（默认竖屏约 90s）按约 30s 切成若干“微叙事单元”，
 *       每个单元自带“小目标—小阻碍—小结果”的微弧与制作提示，供单集撰写岗/细节润色岗使用。
 * 边界：本模块只做确定性的时间结构规划与制作规范输出，不做语义评判、不生成正文；
 *       属“取向与节拍骨架”，严禁把“镜头/提示词/节拍”等术语直接写进剧本台词正文。
 */

export const AIGC_BEAT_SECONDS = 30;

export interface AigcBeat {
  no: number;
  startSec: number;
  endSec: number;
  /** 是否为不足 30s 的收尾拍 */
  isTail: boolean;
  /** 该单元应完成的微叙事弧（撰写岗据此填具体内容） */
  arcPrompt: string;
  /** 与位置匹配的制作提示（口型/局部编辑/动作范式/钩子） */
  productionHints: string[];
}

export interface AigcBeatPlan {
  totalSeconds: number;
  beatCount: number;
  beats: AigcBeat[];
}

const ARC_PROMPT = '微叙事弧：建立一个小目标→制造一个小阻碍→给出一个小结果，并在结尾留引向下一单元的牵引';

/**
 * 按约 30s 规划单集微节拍。
 * @param totalSeconds 单集预计时长（秒），默认 90；非法/非正值兜底为 90，绝不抛错。
 */
export function planAigcBeats(totalSeconds: number = 90): AigcBeatPlan {
  const sec = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 90;
  const beatCount = Math.max(1, Math.ceil(sec / AIGC_BEAT_SECONDS));
  const beats: AigcBeat[] = [];
  for (let no = 1; no <= beatCount; no++) {
    const startSec = (no - 1) * AIGC_BEAT_SECONDS;
    const endSec = Math.min(no * AIGC_BEAT_SECONDS, sec);
    const isTail = no === beatCount && endSec - startSec < AIGC_BEAT_SECONDS;
    const productionHints: string[] = [];
    if (no === 1) {
      productionHints.push('开篇黄金3秒先声夺人；关键人物首次开口给正脸近景，单句台词长度可控以便口型对齐');
    } else {
      productionHints.push('动作/反应写清方向、力道与起止姿态，便于动作模仿复现，少用抽象形容词');
    }
    if (no === beatCount) {
      productionHints.push('收尾在本单元结果上再压一个集钩子（悬念/反转/情绪留白），引到下一集');
    } else {
      productionHints.push('可能后期微调的镜头标注“可局部替换道具/表情”，避免整片重生成');
    }
    beats.push({ no, startSec, endSec, isTail, arcPrompt: ARC_PROMPT, productionHints });
  }
  return { totalSeconds: sec, beatCount, beats };
}

/**
 * AIGC 制作剧本 5 条写作规范（#059 从 Seedance 2.5/2.0 实测反推，与 script-format 的 1200-1500 字标准配套）。
 */
export const AIGC_PRODUCTION_RULES: readonly string[] = [
  '30秒叙事单元：单集按每约30秒一个微节拍（小目标—小阻碍—小结果）组织镜头，与视频生成单元对齐，而非15秒一个碎镜',
  '为局部编辑留标：可能后期微调的镜头注明“可局部替换道具/表情”，减少整片重生成、降低成本',
  '台词匹配口型：关键情绪台词给正脸近景、单句长度可控，避免大段背身长台词，便于音画同步对口型',
  '视觉资产一次锁足：前置角色定妆、关键场景、核心道具视觉清单，用足参考位强化跨集一致性',
  '动作戏写可模仿范式：写清方向、力道、起止姿态等可被动作模仿复现的描述，少用抽象形容词',
];

/** 拼成可注入创作上下文的规范文本（AIGC 模式专用）。 */
export function aigcProductionBrief(plan?: AigcBeatPlan): string {
  const p = plan ?? planAigcBeats();
  const lines = [
    `【AIGC制作节拍（仅供镜头与节奏组织，术语不得写进台词正文）】本集约${p.totalSeconds}秒，按${AIGC_BEAT_SECONDS}秒切为${p.beatCount}个微叙事单元，逐单元落实“小目标—小阻碍—小结果”。`,
    ...AIGC_PRODUCTION_RULES.map((r, i) => `${i + 1}.${r}`),
  ];
  return lines.join('\n');
}
