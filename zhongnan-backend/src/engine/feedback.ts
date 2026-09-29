/**
 * 用户意见/Bug 反馈的管理员三态处理（用户最新需求）
 *  - 一键执行：先梳理诉求 → 管理员确认（可手改文字）→ 执行，并经小南给用户暖心回复
 *  - 待办：进入管理员待办后台，可按时间 / 会员等级归纳查询
 *  - 否定：不采纳，也给用户被尊重的情绪化回复，不让人失落
 * 三种处理一旦选定，都通过用户的小南自动反馈。
 */

export type FeedbackAction = 'execute' | 'todo' | 'reject';
export type FeedbackStatus = 'executing' | 'todo' | 'rejected';

export function nextStatus(action: FeedbackAction): FeedbackStatus {
  return action === 'execute' ? 'executing' : action === 'todo' ? 'todo' : 'rejected';
}

/** 一键执行前先梳理诉求：粗分类 + 一句话摘要，供管理员确认/修改 */
export function organizeRequest(text: string): { category: string; summary: string } {
  const t = (text || '').trim();
  const category = /bug|报错|崩溃|卡|闪退|错误|异常/i.test(t) ? '缺陷修复'
    : /收费|积分|会员|价格|扣费|充值/.test(t) ? '计费会员'
    : /建议|希望|能不能|加个|功能/.test(t) ? '功能建议'
    : '其他反馈';
  const summary = t.length > 40 ? `${t.slice(0, 40)}…` : t;
  return { category, summary };
}

interface ReplyCtx {
  penName?: string | null;
  summary?: string;
  manualText?: string | null; // 管理员手动改过的回复优先
}

/** 小南对用户的情绪化自动回复（被看见、被尊重） */
export function xiaonanReply(action: FeedbackAction, ctx: ReplyCtx = {}): string {
  if (ctx.manualText && ctx.manualText.trim()) return ctx.manualText.trim();
  const you = ctx.penName ? `亲爱的${ctx.penName}` : '亲爱的创作者';
  if (action === 'execute') {
    return `${you}，你反馈的「${ctx.summary || '这条建议'}」我们已经安排上啦，团队正在加急处理，做好第一时间通知你，谢谢你帮终南变得更好，比心～`;
  }
  if (action === 'todo') {
    return `${you}，你的声音我们认真记下了，已经列入产品待办按计划推进，有进展小南第一个来告诉你，有你这样的用户真的很暖心～`;
  }
  return `${you}，谢谢你花时间写下这些，我们反复评估了，这条暂时和当前规划不太一致所以先保留观察，但你的每条意见团队都会看，也欢迎你继续随时拍砖，终南和你一起成长～`;
}

export interface TodoItem {
  id: string;
  content: string;
  level?: string;
  createdAt: string | number | Date;
}

/** 待办后台：按时间或会员等级归纳排序 */
export function queryTodos(
  list: TodoItem[],
  opt: { sortBy?: 'time' | 'level'; level?: string; order?: 'asc' | 'desc' } = {},
): TodoItem[] {
  let r = [...list];
  if (opt.level) r = r.filter((x) => x.level === opt.level);
  // 默认降序：等级高者/时间新者在前；asc 时反转
  const dir = opt.order === 'asc' ? -1 : 1;
  const rank: Record<string, number> = { PRO: 4, ADVANCED: 3, BASIC: 2, FREE: 1 };
  r.sort((a, b) => {
    if (opt.sortBy === 'level') return ((rank[b.level || 'FREE'] ?? 0) - (rank[a.level || 'FREE'] ?? 0)) * dir;
    return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * dir;
  });
  return r;
}

/**
 * 一键执行后的解决路径路由（用户最新需求）
 *  - tool_auto：知识/标签/敏感词/文案/规则/评分等“配置与知识类”，工具端学习窗口可自动适配解决
 *  - doubao：代码/前后端功能缺陷，需回到豆包端改代码后重新部署
 *  - manual：涉钱/法务/投诉等，需人工或外部路径处理
 * 优先级：manual（资金法务）> doubao（代码）> tool_auto（配置知识）
 */
export type FixRoute = 'tool_auto' | 'doubao' | 'manual';

const MANUAL_KW = /扣费|退款|发票|合同|版权纠纷|投诉|起诉|隐私泄露|资金|转账/;
const DOUBAO_KW = /报错|崩溃|闪退|bug|按钮|页面|下载|登录|支付|接口|卡顿|无响应|排版|样式|部署/;
const TOOL_AUTO_KW = /标签|敏感词|关键词|文案|话术|知识库|规则|评分标准|题材|提示词|套路|审核尺度|平台规则/;

export function resolveFixPath(text: string): { route: FixRoute; autoFixable: boolean; label: string; suggestion: string } {
  const t = text || '';
  if (MANUAL_KW.test(t)) {
    return { route: 'manual', autoFixable: false, label: '人工/外部处理', suggestion: '涉及资金、合同或投诉，建议人工跟进或走法务/客服路径。' };
  }
  if (DOUBAO_KW.test(t) && !TOOL_AUTO_KW.test(t)) {
    return { route: 'doubao', autoFixable: false, label: '回豆包端修复', suggestion: '属于前后端代码/功能问题，工具端无法自愈，请回到豆包端改代码并重新构建部署。' };
  }
  if (TOOL_AUTO_KW.test(t)) {
    return { route: 'tool_auto', autoFixable: true, label: '工具端自动适配', suggestion: '属于知识/规则/文案类，可在后台学习窗口更新技能包后自动生效。' };
  }
  return { route: 'doubao', autoFixable: false, label: '回豆包端评估', suggestion: '默认转豆包端评估是否需要改代码；若实为知识类可改走学习窗口。' };
}
