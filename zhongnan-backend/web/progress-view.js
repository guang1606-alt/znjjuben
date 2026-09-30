/**
 * 创作生成进度 —— 前端视图状态机（纯函数、零依赖，可在浏览器与 Node 单测中共用）。
 * 严格消费后端 /api/generate 的 SSE 事件，不在前端重算业务百分比（后端 progressSnapshot 是唯一来源），
 * 只做：单调递增、阶段时间线、小南陪伴、结果/失败归集，保证等待过程“有进度、有陪伴、不回退、不崩”。
 *
 * SSE 事件（后端约定）：
 *  {stage:'frozen', points, free}
 *  {stage:'context', xiaonanLines, directions}
 *  {stage:'progress', pipelineStage, role, status, note, percent, label, xiaonanLine, tip, stageKind}
 *  {stage:'done', pointsCharged, realCostFen, free, taskId, antiAi, market, audience, sandbox, opportunity}
 *  {stage:'failed_refunded', error}
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProgressView = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createProgress() {
    return {
      phase: 'idle',            // idle|frozen|context|running|done|failed
      percent: 0,               // 单调不减，终点 100
      activeStage: null,
      order: [],                // 已出现的岗位阶段 key（去重、保序）
      stages: {},               // key -> {key,label,kind,tip,status:'active'|'done'}
      label: '',
      xiaonanLine: '',
      tip: '',
      points: null,
      free: false,
      contextLines: [],
      directions: [],
      log: [],                  // {role,note,at}（at 由调用方注入序号，保持纯函数可测）
      result: null,
      error: null,
    };
  }

  function clampPct(prev, next) {
    const n = Number.isFinite(next) ? Math.round(next) : prev;
    return Math.max(0, Math.min(100, Math.max(prev, n))); // 单调不减
  }

  function reduceProgress(s, evt, seq) {
    if (!evt || typeof evt !== 'object') return s;
    const next = Object.assign({}, s, { stages: Object.assign({}, s.stages), order: s.order.slice(), log: s.log.slice() });
    const pushLog = () => { if (evt.note) next.log.push({ role: evt.role || evt.pipelineStage || '', note: String(evt.note), seq: seq ?? next.log.length }); };

    switch (evt.stage) {
      case 'frozen':
        next.phase = 'frozen';
        next.points = Number.isFinite(evt.points) ? evt.points : next.points;
        next.free = !!evt.free;
        next.staff = !!evt.staff; // 内部账户（超管/副管理员）免费短路
        return next;

      case 'context':
        next.phase = 'context';
        next.percent = clampPct(next.percent, 2);
        next.contextLines = Array.isArray(evt.xiaonanLines) ? evt.xiaonanLines.slice() : next.contextLines;
        next.directions = Array.isArray(evt.directions) ? evt.directions.slice() : next.directions;
        if (next.contextLines[0]) next.xiaonanLine = next.contextLines[0];
        return next;

      case 'progress': {
        next.phase = 'running';
        const key = evt.pipelineStage || evt.role || 'unknown';
        if (!next.order.includes(key)) next.order.push(key);
        // 进入新阶段：旧的活跃阶段标记完成，当前阶段活跃
        Object.keys(next.stages).forEach((k) => { if (next.stages[k].status === 'active' && k !== key) next.stages[k].status = 'done'; });
        next.stages[key] = {
          key,
          role: evt.role || next.stages[key]?.role || '',
          label: evt.label || next.stages[key]?.label || key,
          kind: evt.stageKind || next.stages[key]?.kind || 'llm',
          tip: evt.tip || next.stages[key]?.tip || '',
          status: 'active',
        };
        next.activeStage = key;
        next.percent = clampPct(next.percent, evt.percent);
        if (evt.label) next.label = evt.label;
        if (evt.xiaonanLine) next.xiaonanLine = evt.xiaonanLine;
        if (evt.tip) next.tip = evt.tip;
        pushLog();
        return next;
      }

      case 'done':
        // 全部阶段收尾为 done，进度拉满
        Object.keys(next.stages).forEach((k) => { next.stages[k].status = 'done'; });
        next.activeStage = null;
        next.phase = 'done';
        next.percent = 100;
        next.label = '新鲜剧本出炉';
        next.result = {
          taskId: evt.taskId, pointsCharged: evt.pointsCharged, realCostFen: evt.realCostFen,
          free: !!evt.free, sandbox: !!evt.sandbox, antiAi: evt.antiAi || null,
          market: evt.market || null, audience: evt.audience || null, opportunity: evt.opportunity || null,
        };
        if (evt.xiaonanLine) next.xiaonanLine = evt.xiaonanLine;
        return next;

      case 'failed_refunded':
        next.phase = 'failed';
        next.error = String(evt.error || '生成失败，已冻结积分将原路退回');
        return next;

      // v2.233 端点对齐：用户显式取消（后端 v2.190 abort → 发 cancelled 帧）；复用 failed 相位渲染
      case 'cancelled':
        next.phase = 'failed';
        next.cancelled = true;
        next.error = String(evt.error || '已取消生成，冻结积分将原路退回');
        return next;

      default:
        // 未知事件安全忽略，不崩状态机
        return s;
    }
  }

  /** 阶段时间线（按出现顺序 + 状态），供时间线 UI 渲染 */
  function stageList(s) {
    return s.order.map((key) => Object.assign({ key }, s.stages[key]));
  }

  /** 游戏化鼓励语（按进度区间），让等待有正反馈 */
  function milestone(percent, zh) {
    const Z = ['小南已就位，正在起笔…', '骨架搭起来了，人物陆续登场', '过半啦，好桥段正在成型', '收尾打磨中，马上就好', '完成，看看这一版吧'];
    const E = ['Xiaonan is ready, drafting…', 'Structure is up, characters stepping in', 'Over halfway, scenes taking shape', 'Polishing, almost there', 'Done, take a look'];
    const arr = zh === false ? E : Z;
    if (percent >= 100) return arr[4];
    if (percent >= 75) return arr[3];
    if (percent >= 50) return arr[2];
    if (percent >= 25) return arr[1];
    return arr[0];
  }

  /** 解析 SSE 文本流分帧：把 ReadableStream 读到的 chunk 按 data: 行切出事件对象 */
  function parseSseChunk(buffer, chunkText) {
    const events = [];
    buffer.text = (buffer.text || '') + chunkText;
    const frames = buffer.text.split(/\n\n/);
    buffer.text = frames.pop() || ''; // 最后一段可能不完整，留到下次
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try { events.push(JSON.parse(json)); } catch { /* 半包/非 JSON 跳过 */ }
    }
    return events;
  }

  /** 岗位元数据：图标/配色/中英文标签，用于进度页"多智能体协同"可视化 */
  const ROLE_META = {
    dispatcher: { icon: '🎛️', color: '#6b7280', zh: '中央调度', en: 'Dispatcher' },
    market_pre: { icon: '📈', color: '#0ea5e9', zh: '市场前置分析', en: 'Market Pre-analysis' },
    architect: { icon: '🏗️', color: '#4f46e5', zh: '剧情架构师', en: 'Architect' },
    designer: { icon: '🎭', color: '#db2777', zh: '人设设计师', en: 'Character Designer' },
    writer: { icon: '✍️', color: '#16a34a', zh: '单集撰写师', en: 'Episode Writer' },
    audience: { icon: '👀', color: '#f59e0b', zh: '观众视角压测', en: 'Audience Stress-test' },
    polisher: { icon: '✨', color: '#9333ea', zh: '细节润色师', en: 'Polisher' },
    consistency: { icon: '🚦', color: '#059669', zh: '质检闸门', en: 'QC Gate' },
    compliance: { icon: '🛡️', color: '#dc2626', zh: '合规审核师', en: 'Compliance' },
    market_post: { icon: '📊', color: '#0891b2', zh: '市场收口评估', en: 'Market Post-review' },
    market: { icon: '📈', color: '#0ea5e9', zh: '市场分析', en: 'Market Analysis' },
    done: { icon: '🎉', color: '#16a34a', zh: '交付完成', en: 'Delivered' },
  };
  function roleMeta(role) { return ROLE_META[role] || { icon: '🤖', color: '#6b7280', zh: role || '协同中', en: role || 'Working' }; }

  /** 等待彩蛋：短剧创作冷知识/小南碎碎念，生成期间轮播，让等待不枯燥 */
  const WAIT_TIPS_ZH = [
    '冷知识：竖屏短剧每集前 3 秒决定 70% 的留存，钩子要比台词先到。',
    '小南碎碎念：好的反转不是"没想到"，而是"早该想到"。',
    '创作贴士：配角也有自己的目标，别让他只为主角递刀。',
    '冷知识：台词越短，张力越大；真正的狠人说话不超过 12 个字。',
    '小南碎碎念：留白不是没写完，是把情绪交给观众。',
    '创作贴士：一场戏只推进一件事，多了就散。',
    '冷知识：爽点密度 ≠ 全程高能，张弛有度才让人追得下去。',
    '小南碎碎念：人物的"底层欲望"比"表面目标"更决定他会不会崩。',
  ];
  const WAIT_TIPS_EN = [
    'Trivia: the first 3 seconds decide 70% of retention — hook before dialogue.',
    'Xiaonan: a great twist is not "unexpected" but "should have seen it coming".',
    'Tip: supporting characters have their own goals; don\'t let them just hand the knife.',
    'Trivia: shorter lines mean more tension; a ruthless person says ≤12 chars.',
    'Xiaonan: a pause is not unfinished — it hands the emotion to the viewer.',
    'Tip: one scene advances one thing; more than that and it scatters.',
    'Trivia: payoff density ≠ nonstop highs; rhythm is what makes people binge.',
    'Xiaonan: a character\'s "deep desire" matters more than their "surface goal".',
  ];
  function waitTips(en) { return en ? WAIT_TIPS_EN : WAIT_TIPS_ZH; }

  function formatDisplayValue(value) {
    if (value == null || value === '') return '—';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) {
      const parts = value.map(formatDisplayValue).filter((v) => v !== '—');
      return parts.length ? parts.slice(0, 3).join(' / ') : '—';
    }
    const preferred = ['score', 'overall', 'cravingScore', 'value', 'label', 'name', 'text', 'title', 'grade', 'level'];
    for (const key of preferred) {
      const item = value[key];
      if (item != null && item !== '' && typeof item !== 'object') return String(item);
    }
    const parts = Object.values(value)
      .filter((item) => item != null && item !== '' && typeof item !== 'object')
      .map(String);
    return parts.length ? parts.slice(0, 3).join(' / ') : '—';
  }

  function formatIssueText(issue) {
    if (issue == null || issue === '') return '';
    if (typeof issue !== 'object') return String(issue);
    if (Array.isArray(issue)) return issue.map(formatIssueText).filter(Boolean).join(' / ');
    const scalar = (keys) => {
      for (const key of keys) {
        const value = issue[key];
        if (value != null && value !== '' && typeof value !== 'object') return String(value);
      }
      return '';
    };
    const type = scalar(['typeLabel', 'label', 'type']);
    const evidence = scalar(['evidence', 'snippet', 'line', 'reason', 'message']);
    const advice = scalar(['advice', 'suggestion', 'fix']);
    const finding = type && evidence ? `${type}: ${evidence}` : (evidence || type);
    if (finding && advice) return `${finding} → ${advice}`;
    return finding || advice || formatDisplayValue(issue);
  }

  function formatDateTime(value, lang) {
    if (value == null || value === '') return '—';
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN');
  }

  function formatVersion(value) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `v${n}` : '—';
  }

  /* B2 v2.200：小南课堂 · 工具方法论卡片接入（费曼式，让等待期间学方法论）
     通过 lazy lookup 访问全局 ZnToolLesson（web/tool-lesson.js 在浏览器侧已先于 progress-view.js 加载）。
     Node 单测中通过 global.ZnToolLesson = require('../web/tool-lesson.js') 模拟。 */
  const TOOL_LESSON_ORDER = ['tbCardPitch', 'tbCardRead', 'tbCardTd', 'tbCardDv', 'tbCardBr'];
  function _getZnToolLesson() {
    try { return (typeof ZnToolLesson !== 'undefined') ? ZnToolLesson : (typeof global !== 'undefined' ? global.ZnToolLesson : null); }
    catch { return null; }
  }
  /** 取所有 5 张方法论卡片简化版（含 oneLiner/plainExplain/diagram/toolId/steps） */
  function getXiaonanLessons(en) {
    const mod = _getZnToolLesson();
    if (!mod || typeof mod.getLesson !== 'function') return [];
    return TOOL_LESSON_ORDER.map((id) => {
      const c = mod.getLesson(id, en);
      if (!c) return null;
      return {
        toolId: c.id,
        title: c.title,
        oneLiner: c.oneLiner,
        steps: c.steps,
        diagram: c.diagram,
        plainExplain: c.plainExplain,
      };
    }).filter(Boolean);
  }
  /** 按 waitTips 序号 mod 5 取对应工具卡片（轮播对应） */
  function lessonForTip(tipIndex, en) {
    const arr = getXiaonanLessons(en);
    if (!arr.length) return null;
    const idx = ((Number(tipIndex) || 0) % arr.length + arr.length) % arr.length;
    return arr[idx];
  }

  return {
    createProgress, reduceProgress, stageList, milestone, parseSseChunk, roleMeta, waitTips,
    formatDisplayValue, formatIssueText, formatDateTime, formatVersion,
    getXiaonanLessons, lessonForTip,
  };
});
