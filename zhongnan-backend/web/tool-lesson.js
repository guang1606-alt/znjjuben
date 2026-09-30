/**
 * 小南课堂 · 工具方法论卡片（v2.200，B 任务）
 *
 * 把 progress-view.js 的碎碎念 waitTips 升级为费曼式方法论讲解：
 * 每个工具配 SVG mini-diagram + 白话讲解（用自己的话讲一遍），
 * 让用户在等待生成期间学到方法论，而不是干等。
 *
 * 纯函数 + 静态数据，浏览器与 Node 单测共用。
 * 不依赖任何运行时态，下轮由 progress-view.js 接入在进度页轮播。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZnToolLesson = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 工具方法论卡片数据。
   * 每个卡片含：
   *   - id: 工具 id（与 i18n tbCardXxx 对齐）
   *   - title: 卡片标题
   *   - oneLiner: 一句话核心方法论（费曼式白话）
   *   - steps: 步骤数组（每步含 name + explain）
   *   - diagram: SVG 字符串（mini-diagram，inline 可渲染）
   *   - plainExplain: 完整白话讲解（用自己的话讲一遍，不超过 200 字）
   */
  const LESSONS = {
    // 选题会：四席位评估
    tbCardPitch: {
      id: 'tbCardPitch',
      title: { zh: '选题会 · 四席位评估法', en: 'Pitch · Four-Seat Review' },
      oneLiner: {
        zh: '一个选题要过四关：市场要、故事能、制作轻、观众爱。',
        en: 'A pitch passes four gates: market wants, story can, production light, audience loves.',
      },
      steps: [
        { name: { zh: '市场席位', en: 'Market' }, explain: { zh: '这题材现在有没有热度？同质化多不多？', en: 'Is the topic hot now? Saturated?' } },
        { name: { zh: '故事席位', en: 'Story' }, explain: { zh: '人物关系和冲突空间够不够撑 80 集？', en: 'Enough relation/conflict for 80 eps?' } },
        { name: { zh: '制作席位', en: 'Production' }, explain: { zh: '场景和道具能不能轻装上阵？', en: 'Can scenes/props be light?' } },
        { name: { zh: '观众席位', en: 'Audience' }, explain: { zh: '前 3 秒钩子够不够狠？', en: 'Is the 3-sec hook sharp enough?' } },
      ],
      diagram: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="四席位评估雷达图">
  <polygon points="100,20 180,80 140,150 60,150 20,80" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>
  <circle cx="100" cy="80" r="40" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
  <text x="100" y="14" text-anchor="middle" font-size="10" fill="currentColor">市场</text>
  <text x="190" y="84" text-anchor="middle" font-size="10" fill="currentColor">故事</text>
  <text x="148" y="160" text-anchor="middle" font-size="10" fill="currentColor">制作</text>
  <text x="52" y="160" text-anchor="middle" font-size="10" fill="currentColor">观众</text>
  <text x="10" y="84" text-anchor="middle" font-size="10" fill="currentColor">钩子</text>
  <circle cx="100" cy="80" r="3" fill="currentColor"/>
</svg>`,
      plainExplain: {
        zh: '选题不是拍脑袋。把它摆到四个席位前拷问：市场席位看热度与同质化，故事席位看人物关系和冲突空间能不能撑 80 集，制作席位看场景道具能不能轻装，观众席位看前 3 秒钩子够不够狠。四关都过的才立项，任何一关卡住就缓议或否决。',
        en: 'A pitch is not a gut call. Put it through four seats: market checks heat/saturation, story checks if relations/conflicts sustain 80 eps, production checks if scenes/props stay light, audience checks if the 3-sec hook bites. Pass all four to greenlight; any block → hold or pass.',
      },
    },

    // 剧本围读：四位责编站位
    tbCardRead: {
      id: 'tbCardRead',
      title: { zh: '剧本围读 · 责编站位挑刺法', en: 'Table Read · Stance Critique' },
      oneLiner: {
        zh: '围读不是念稿，是四个责编各自站位挑问题。',
        en: 'A table read is not reciting — it is four editors raising issues by stance.',
      },
      steps: [
        { name: { zh: '编辑视角', en: 'Editor' }, explain: { zh: '台词承不承担动作？有没有说教？', en: 'Does dialogue carry action? Any preaching?' } },
        { name: { zh: '导演视角', en: 'Director' }, explain: { zh: '这场戏调度得了吗？景别切换顺不顺？', en: 'Is the scene blockable? Are cuts smooth?' } },
        { name: { zh: '制片视角', en: 'Producer' }, explain: { zh: '这场戏贵不贵？能不能省？', en: 'Is the scene expensive? Can it be cut?' } },
        { name: { zh: '观众视角', en: 'Audience' }, explain: { zh: '这里我会刷走吗？钩子还在不在？', en: 'Would I swipe away here? Is the hook alive?' } },
      ],
      diagram: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="围读四站位流程">
  <rect x="20" y="20" width="50" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="45" y="40" text-anchor="middle" font-size="9" fill="currentColor">编辑</text>
  <rect x="80" y="20" width="50" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="105" y="40" text-anchor="middle" font-size="9" fill="currentColor">导演</text>
  <rect x="140" y="20" width="50" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="165" y="40" text-anchor="middle" font-size="9" fill="currentColor">制片</text>
  <rect x="80" y="80" width="50" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="105" y="100" text-anchor="middle" font-size="9" fill="currentColor">观众</text>
  <line x1="45" y1="50" x2="45" y2="65" stroke="currentColor" stroke-width="0.8" marker-end="url(#arr)"/>
  <line x1="105" y1="50" x2="105" y2="80" stroke="currentColor" stroke-width="0.8" marker-end="url(#arr)"/>
  <line x1="165" y1="50" x2="165" y2="65" stroke="currentColor" stroke-width="0.8"/>
  <line x1="165" y1="65" x2="105" y2="80" stroke="currentColor" stroke-width="0.8"/>
  <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="currentColor"/></marker></defs>
</svg>`,
      plainExplain: {
        zh: '围读不是把稿子念一遍，是让四个责编各自站位挑刺：编辑看台词是否承担动作、有没有说教；导演看这场戏调度得了吗、景别切换顺不顺；制片看这场戏贵不贵、能不能省；观众看这里我会不会刷走、钩子还在不在。每个站位形成一条修改清单，最后合并去重，按"必须改/可以改/不必改"三档分级。',
        en: 'A read is not reciting — four editors raise issues by stance: editor checks if dialogue carries action; director checks blockability and cuts; producer checks cost and cuttability; audience checks swipe-risk and hook. Each stance yields a fix list, merged and graded must-fix / nice-to-fix / skip.',
      },
    },

    // 拆爆款：五步法
    tbCardTd: {
      id: 'tbCardTd',
      title: { zh: '拆爆款 · 五步提炼法', en: 'Hit Teardown · Five Steps' },
      oneLiner: {
        zh: '拆片不是抄片，是抽出为什么爆、为什么好、可取什么。',
        en: 'Teardown is not copying — it is extracting why it blew up, why it works, what to borrow.',
      },
      steps: [
        { name: { zh: '爆点定位', en: 'Locate hook' }, explain: { zh: '前 3 秒、每集开头、结尾钩子在哪？', en: 'Where are the 3-sec/episode-start/end hooks?' } },
        { name: { zh: '结构拆解', en: 'Structural map' }, explain: { zh: '主线节奏曲线、副线如何穿插？', en: 'Main arc rhythm, subplot weave?' } },
        { name: { zh: '技法提炼', en: 'Technique' }, explain: { zh: '用了哪些可复用技法（误会、伪装、反转）？', en: 'Reusable techniques (misunderstand/disguise/twist)?' } },
        { name: { zh: '多标签', en: 'Multi-tags' }, explain: { zh: '题材/类型/情绪/反转/人设标签组合？', en: 'Tags across topic/genre/emotion/twist/role?' } },
        { name: { zh: '改编方向', en: 'Adaptation' }, explain: { zh: '保留什么、替换什么、再加什么？', en: 'Keep what, swap what, add what?' } },
      ],
      diagram: `<svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="拆解五步流程">
  <rect x="6" y="20" width="34" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="23" y="33" text-anchor="middle" font-size="8" fill="currentColor">爆点</text>
  <line x1="40" y1="30" x2="48" y2="30" stroke="currentColor" stroke-width="0.8" marker-end="url(#a2)"/>
  <rect x="48" y="20" width="34" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="65" y="33" text-anchor="middle" font-size="8" fill="currentColor">结构</text>
  <line x1="82" y1="30" x2="90" y2="30" stroke="currentColor" stroke-width="0.8" marker-end="url(#a2)"/>
  <rect x="90" y="20" width="34" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="107" y="33" text-anchor="middle" font-size="8" fill="currentColor">技法</text>
  <line x1="124" y1="30" x2="132" y2="30" stroke="currentColor" stroke-width="0.8" marker-end="url(#a2)"/>
  <rect x="132" y="20" width="34" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="149" y="33" text-anchor="middle" font-size="8" fill="currentColor">标签</text>
  <line x1="166" y1="30" x2="174" y2="30" stroke="currentColor" stroke-width="0.8" marker-end="url(#a2)"/>
  <rect x="174" y="20" width="40" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="194" y="33" text-anchor="middle" font-size="8" fill="currentColor">改编</text>
  <defs><marker id="a2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="currentColor"/></marker></defs>
</svg>`,
      plainExplain: {
        zh: '拆片不是抄片。第一步定位爆点：前 3 秒、每集开头、结尾钩子在哪。第二步拆结构：主线节奏曲线怎么走、副线怎么穿插。第三步提炼技法：用了哪些可复用招式（误会/伪装/反转/对比）。第四步打多标签：题材+类型+情绪+反转+人设的组合画像。第五步定改编方向：保留核心、替换表层、再加差异化。这样拆完，你能拿到的是"为什么爆"的骨架，不是"爆了什么"的皮肉。',
        en: 'Teardown is not copying. Step 1: locate hooks (3-sec/episode-start/end). Step 2: map structure (main rhythm + subplot weave). Step 3: extract reusable techniques (misunderstand/disguise/twist/contrast). Step 4: multi-tag (topic+genre+emotion+twist+role). Step 5: set adaptation direction (keep core, swap surface, add diff). You walk away with the skeleton of "why it blew up", not the skin of "what blew up".',
      },
    },

    // 多版本去重：正交种子
    tbCardDv: {
      id: 'tbCardDv',
      title: { zh: '多版本去重 · 正交种子法', en: 'Multi-version De-dup · Orthogonal Seeds' },
      oneLiner: {
        zh: '多版本不是换皮，是从四维正交种子出发再比对。',
        en: 'Multi-version is not reskinning — start from four orthogonal seed axes, then audit.',
      },
      steps: [
        { name: { zh: '原型轴', en: 'Archetype' }, explain: { zh: '主角原型（逆袭/复仇/重生）', en: 'Protagonist archetype (rise/revenge/reborn)' } },
        { name: { zh: '冲突轴', en: 'Conflict' }, explain: { zh: '核心冲突类型（人际/社会/内心）', en: 'Conflict type (inter/social/inner)' } },
        { name: { zh: '反转轴', en: 'Turn' }, explain: { zh: '反转时机与方式', en: 'Twist timing and method' } },
        { name: { zh: '基调轴', en: 'Tone' }, explain: { zh: '情感基调（爽/虐/甜/燃）', en: 'Emotional tone (payoff/angst/sweet/burn)' } },
      ],
      diagram: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="正交种子四维空间">
  <line x1="100" y1="20" x2="100" y2="140" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
  <line x1="20" y1="80" x2="180" y2="80" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
  <line x1="40" y1="40" x2="160" y2="120" stroke="currentColor" stroke-width="0.8" opacity="0.3" stroke-dasharray="3 3"/>
  <line x1="160" y1="40" x2="40" y2="120" stroke="currentColor" stroke-width="0.8" opacity="0.3" stroke-dasharray="3 3"/>
  <text x="100" y="14" text-anchor="middle" font-size="9" fill="currentColor">原型</text>
  <text x="100" y="155" text-anchor="middle" font-size="9" fill="currentColor">冲突</text>
  <text x="184" y="84" text-anchor="middle" font-size="9" fill="currentColor">反转</text>
  <text x="16" y="84" text-anchor="middle" font-size="9" fill="currentColor">基调</text>
  <circle cx="60" cy="55" r="3" fill="currentColor"/>
  <circle cx="140" cy="105" r="3" fill="currentColor"/>
  <circle cx="120" cy="60" r="3" fill="currentColor" opacity="0.5"/>
  <line x1="60" y1="55" x2="120" y2="60" stroke="currentColor" stroke-width="1.5"/>
  <text x="100" y="80" text-anchor="middle" font-size="8" fill="currentColor">伪多版本 → 揪出</text>
</svg>`,
      plainExplain: {
        zh: '同一创意出多版不是换皮。先从四个正交维度领种子：原型轴（逆袭/复仇/重生）、冲突轴（人际/社会/内心）、反转轴（时机+方式）、基调轴（爽/虐/甜/燃）。四个轴像四维空间里的坐标，每个版本占一个独特坐标点。写完后两两比对：如果两个版本的坐标点离得太近，就是"换汤不换药"的伪多版本，立刻揪出来给改法。这样保证多版本是真差异，不是换背景换名字。',
        en: 'Multiple versions of one idea is not reskinning. First claim orthogonal seeds across four axes: archetype, conflict, turn, tone. Each axis is a coordinate in 4D space; each version takes a unique point. After writing, pairwise audit: if two versions sit too close in 4D, they are fake reskins — flag and fix. This guarantees true divergence, not just renamed backgrounds.',
      },
    },

    // 互动分支校验
    tbCardBr: {
      id: 'tbCardBr',
      title: { zh: '互动分支 · 合法骨架校验', en: 'Interactive Branch · Valid Skeleton' },
      oneLiner: {
        zh: '互动短剧先有合法骨架，再填内容，避免死胡同与悬空。',
        en: 'Interactive drama: build a valid skeleton first, then fill content — no dead ends or danglers.',
      },
      steps: [
        { name: { zh: '主结局', en: 'Main ending' }, explain: { zh: '默认走到的结局', en: 'Default reached ending' } },
        { name: { zh: '坏结局', en: 'Bad ending' }, explain: { zh: '错误选择导致的失败结局', en: 'Failure from wrong choices' } },
        { name: { zh: '隐藏结局', en: 'Hidden ending' }, explain: { zh: '特定组合触发的彩蛋', en: 'Easter egg from specific combo' } },
        { name: { zh: '校验项', en: 'Checks' }, explain: { zh: '死胡同/伪选择/自环/死循环/悬空连线/概率权重', en: 'dead-end/fake-choice/self-loop/cycle/dangling/weight' } },
      ],
      diagram: `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="分支骨架树">
  <circle cx="100" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="100" y="24" text-anchor="middle" font-size="8" fill="currentColor">起点</text>
  <line x1="100" y1="28" x2="50" y2="60" stroke="currentColor" stroke-width="0.8"/>
  <line x1="100" y1="28" x2="100" y2="60" stroke="currentColor" stroke-width="0.8"/>
  <line x1="100" y1="28" x2="150" y2="60" stroke="currentColor" stroke-width="0.8"/>
  <circle cx="50" cy="68" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="50" y="72" text-anchor="middle" font-size="7" fill="currentColor">主</text>
  <circle cx="100" cy="68" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="100" y="72" text-anchor="middle" font-size="7" fill="currentColor">坏</text>
  <circle cx="150" cy="68" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text x="150" y="72" text-anchor="middle" font-size="7" fill="currentColor">隐</text>
  <line x1="50" y1="74" x2="50" y2="100" stroke="currentColor" stroke-width="0.8" marker-end="url(#a3)"/>
  <line x1="100" y1="74" x2="100" y2="100" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 2"/>
  <text x="100" y="115" text-anchor="middle" font-size="7" fill="red" opacity="0.7">死胡同!</text>
  <defs><marker id="a3" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="currentColor"/></marker></defs>
</svg>`,
      plainExplain: {
        zh: '互动短剧别先写内容。先画骨架树：一个起点，三个结局（主/坏/隐藏），中间是选择节点。骨架画完，机器自动检查六类问题：死胡同（走到一半没下文）、伪选择（两条路其实殊途同归）、自环（选项绕回自己）、死循环（A→B→A）、悬空连线（指向不存在的节点）、概率权重失衡（隐藏结局永远触发不了）。骨架合法了再填内容，这样不会写一半才发现要返工。',
        en: 'Don\'t write content first for interactive drama. Draw the skeleton: one start, three endings (main/bad/hidden), choice nodes in between. Then auto-check six issues: dead-end, fake-choice (paths converge), self-loop, cycle (A→B→A), dangling link, weight imbalance (hidden never triggers). Fill content only after the skeleton validates — avoids mid-write rework.',
      },
    },
  };

  /**
   * 取工具方法论卡片。
   * @param {string} toolId 工具 id（如 'tbCardPitch'）
   * @param {boolean} en true=英文，false=中文
   * @returns {object|null} 卡片数据或 null（未知工具）
   */
  function getLesson(toolId, en) {
    const lesson = LESSONS[toolId];
    if (!lesson) return null;
    const pick = (v) => (v && typeof v === 'object' ? (en ? v.en : v.zh) : v);
    return {
      id: lesson.id,
      title: pick(lesson.title),
      oneLiner: pick(lesson.oneLiner),
      steps: (lesson.steps || []).map((s) => ({ name: pick(s.name), explain: pick(s.explain) })),
      diagram: lesson.diagram,
      plainExplain: pick(lesson.plainExplain),
    };
  }

  /** 列出所有可用工具 id */
  function listLessons() { return Object.keys(LESSONS); }

  /** 工具箱静态卡 id → 方法论卡片 id 映射（A3 卡片分层） */
  const CARD_TO_LESSON = {
    toolPitch: 'tbCardPitch',
    toolRead: 'tbCardRead',
    toolTeardown: 'tbCardTd',
    toolDiversity: 'tbCardDv',
    toolBranch: 'tbCardBr',
  };

  /**
   * 工具箱卡片分层提示行：卡片 → 一句话方法论 → 进工作台。
   * @param {string} cardId 工具箱静态卡 id（如 'toolTeardown'）
   * @param {boolean} en true=英文，false=中文
   * @returns {string|null} HTML 提示行；未知卡返回 null
   */
  function hintLine(cardId, en) {
    const lessonId = CARD_TO_LESSON[cardId];
    if (!lessonId) return null;
    const c = getLesson(lessonId, en);
    if (!c || !c.oneLiner) return null;
    const prefix = en ? 'Method: ' : '方法论：';
    return `<div class="tb-hint" data-for="${cardId}"><span class="tb-hint-icon" aria-hidden="true">🎓</span><span class="tb-hint-text">${prefix}${c.oneLiner}</span></div>`;
  }

  return { getLesson, listLessons, hintLine };
});
