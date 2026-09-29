import { isSceneOrTitleLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 节奏曲线与呼吸感校验（PRD 2.1.4）
 * 单集必须具备「钩子-冲突-转折-留白」完整节奏弧，避免 AI 式全程高密度平铺。
 * 离线启发式：
 *  - hook   开场约120字内是否有冲突/悬念（黄金三秒）
 *  - conflict 全片是否有足够对抗信号
 *  - turn   是否存在转折/反转信号
 *  - blank  结尾是否留白/留钩（悬念、戛然而止、动作收束）
 *  - density 动作行与台词行比例，检测“全程对词无呼吸”或“全是描述不推进”
 */

export interface RhythmReport {
  arc: { hook: boolean; conflict: boolean; turn: boolean; blank: boolean };
  dialogueLines: number;
  actionLines: number;
  actionRatio: number;
  issues: { severity: 'high' | 'mid' | 'low'; type: string; evidence: string; advice: string }[];
  score: number;
}

const HOOK_SIGNAL = /[？?！]|摔|踹|冲|跪|撕|滚|离婚|背叛|突然|竟然|居然|一巴掌|撞|掀|甩|瞪|冷笑|怀孕|出轨|解雇|开除|遗嘱|遗产/;
const CONFLICT_SIGNAL = /吵|争|骂|怼|反驳|不|凭什么|你敢|凭|拦|挡|推|抢|怒|吼|冷笑|凭什么|休想|做梦|对峙|摔/;
const TURN_SIGNAL = /没想到|谁知|就在这时|然而|下一秒|突然|转身|竟然|原来|偏偏|就在此刻|岂料|结果|谁知道|话音刚落/;
const BLANK_SIGNAL = /[？…]|没再回头|沉默|愣住|僵住|戛然|悬念|本集完|黑屏|欲知|到底|究竟|还没|未完/;

export function rhythmScan(text: string): RhythmReport {
  const issues: RhythmReport['issues'] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const dialogueLines = lines.filter((l) => /^[一-龥A-Za-z·]{1,6}(?:（[^）]*）)?[：:]/.test(l) && !l.startsWith('△')).length;
  const actionLines = lines.filter((l) => l.startsWith('△')).length;
  const total = Math.max(1, dialogueLines + actionLines);
  const actionRatio = Number((actionLines / total).toFixed(2));

  // 开场：跳过场景标题行，取前若干有效行拼成开头
  // c213：跳过非正文行（共享切分器全格式场头 + 剧名页）
  const body = lines.filter((l) => !isSceneOrTitleLine(l));
  const head = body.slice(0, 6).join('').slice(0, 120);
  const tail = body.slice(-6).join('').slice(-140);

  const hook = HOOK_SIGNAL.test(head);
  const conflictCount = (text.match(new RegExp(CONFLICT_SIGNAL, 'g')) || []).length;
  const conflict = conflictCount >= 2;
  const turn = TURN_SIGNAL.test(text);
  const blank = BLANK_SIGNAL.test(tail);

  if (!hook) issues.push({ severity: 'high', type: 'flat_open', evidence: '开场前120字未见冲突/悬念信号', advice: '黄金三秒内抛出冲突或反常画面，别用铺垫开场' });
  if (!conflict) issues.push({ severity: 'high', type: 'no_conflict', evidence: `对抗信号仅${conflictCount}处`, advice: '增加人物正面对抗，单集至少2-3个冲突点' });
  if (!turn) issues.push({ severity: 'mid', type: 'no_turn', evidence: '未检测到转折/反转信号', advice: '在中后段安排一次意料之外的转折，避免一条直线讲到底' });
  if (!blank) issues.push({ severity: 'mid', type: 'no_blank', evidence: '结尾没有留白或钩子', advice: '结尾用悬念/未解/动作收束，勾住下一集' });
  if (actionRatio < 0.15) issues.push({ severity: 'mid', type: 'no_breath', evidence: `动作行占比仅${actionRatio}，全程对词`, advice: '插入动作、神态、环境行制造呼吸感，避免大段台词墙' });
  if (actionRatio > 0.7) issues.push({ severity: 'low', type: 'over_describe', evidence: `动作行占比${actionRatio}偏高`, advice: '描述过多会拖节奏，用台词推进冲突' });

  // 得分：四节拍各20 + 呼吸20
  let score = (hook ? 20 : 0) + (conflict ? 20 : 0) + (turn ? 20 : 0) + (blank ? 20 : 0);
  if (actionRatio >= 0.15 && actionRatio <= 0.7) score += 20;
  else if (actionRatio > 0.7) score += 8;
  score -= issues.filter((i) => i.severity === 'high').length * 0; // 已体现在节拍分
  return { arc: { hook, conflict, turn, blank }, dialogueLines, actionLines, actionRatio, issues, score: Math.max(0, Math.min(100, score)) };
}
