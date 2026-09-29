/**
 * 统一内容合规中台（三级审核的第一级：生成/发布前机器拦截）
 *
 * 设计原则（避免“一处一个正则、口径相悖”的历史问题）：
 *  1) 全平台唯一事实源：社区发帖、知识上传、剧本生成、互动分支、X剧本 全部走本模块，不再各自维护词表。
 *  2) 两级处置：
 *     - BLOCK 硬拦截：只收录“明确违法违规的行为导向短语”（如“赌博技巧/制作毒品/诈骗教程”），
 *       绝不把普通题材词（如剧情里出现“赌博/自杀/鬼”）误杀——后者归 WARN，提示改写法。
 *     - WARN 风险预警：受限题材/需要正向处理的内容，不拦截，但返回修改建议与备案提示。
 *  3) 对接 2026-09-01 施行的《微短剧发展管理办法》（广电总局令第16号）：
 *     - 11 项内容禁令；- 真人/AI 三类分级备案；- AI 生成显著标注；- 特殊题材一律一类。
 *  4) 纯函数、零 IO，词表与判定可对拍、可单测；语义级判断（如“诋毁传统文化”）保留给合规审核师 Agent。
 */

// ───────────────────────── 类型 ─────────────────────────
export type Severity = 'BLOCK' | 'WARN';

export interface SafetyRule {
  id: string;
  /** 禁令大类（对应《办法》11 项 / 平台六大零容忍 / 3 类禁拍 / 13 类受限） */
  category: string;
  label: string;
  severity: Severity;
  /** 命中词/短语：子串 includes 匹配（导向短语，避免单字误伤） */
  patterns: string[];
  advice: string;
  /** 对应法规依据（可空） */
  statute?: string;
}

export interface SafetyHit {
  ruleId: string;
  category: string;
  label: string;
  severity: Severity;
  matched: string;
  advice: string;
  statute?: string;
}

export interface ScanResult {
  level: 'safe' | 'warn' | 'block';
  blocked: SafetyHit[];
  warnings: SafetyHit[];
  /** 首个 BLOCK 的对外提示（无则 null），保持与历史接口“内容含违规导向「xx」，已拦截”一致 */
  blockReason: string | null;
}

// ───────────────────────── BLOCK：硬拦截规则 ─────────────────────────
// 仅收录明确违法违规“导向/教程/煽动”短语；普通题材名词放 WARN。
export const BLOCK_RULES: SafetyRule[] = [
  {
    id: 'B01-state-security', category: '危害国家安全', label: '国家安全', severity: 'BLOCK',
    statute: '《微短剧发展管理办法》11项禁令第1-3项',
    patterns: ['分裂国家', '颠覆国家政权', '推翻社会主义制度', '煽动颠覆', '破坏国家统一', '危害国家主权', '煽动分裂'],
    advice: '不得出现危害国家主权、政权与统一的内容，请删除相关表述。',
  },
  {
    id: 'B02-terrorism', category: '恐怖极端主义', label: '恐怖极端', severity: 'BLOCK',
    statute: '《办法》11项禁令第4项；刑法涉恐条款',
    patterns: ['恐怖主义', '极端主义', '制作炸弹', '制造爆炸物', '教制爆炸物', '暴恐教程'],
    advice: '严禁宣扬、教授恐怖主义与极端主义，删除相关内容。',
  },
  {
    id: 'B03-ethnic', category: '民族宗教伤害', label: '民族宗教', severity: 'BLOCK',
    statute: '《办法》11项禁令第5项',
    patterns: ['煽动民族仇恨', '民族歧视', '歪曲民族历史', '破坏民族团结', '伤害民族感情'],
    advice: '不得煽动民族仇恨、歧视或歪曲民族历史，请删除。',
  },
  {
    id: 'B04-porn', category: '淫秽色情', label: '淫秽色情', severity: 'BLOCK',
    statute: '《办法》11项禁令第7项；网络视听内容审核通则',
    patterns: ['色情淫秽', '淫秽色情', '卖淫教程', '嫖娼教程', '儿童色情', '未成年人色情', '邪典'],
    advice: '严禁淫秽色情与涉未成年人色情内容；成熟向情欲张力可用分级叙事，不得露骨。',
  },
  {
    id: 'B05-crime-tutorial', category: '违法犯罪教程', label: '犯罪教程', severity: 'BLOCK',
    statute: '《办法》11项禁令第7/10项',
    // 只拦「可操作/可复制」的导向短语；制毒/偷税漏税/逃避监管等题材名词下沉到 WARN(W10/W11)，避免误杀“被查处/受严惩”等正面叙事
    patterns: [
      '教唆犯罪', '犯罪教程', '制作毒品', '制毒教程', '赌博技巧', '赌博教程', '诈骗教程', '诈骗手法教学',
      '非法集资教程', '洗钱教程', '私造枪支', '买卖公民信息', '买卖身份证',
      '偷税漏税教程', '偷税漏税操作', '偷税漏税手法',
      '逃避监管教程', '逃避监管办法', '逃避监管方法',
      '黑客入侵教程', '贩毒渠道',
    ],
    advice: '不得提供可复制的违法犯罪方法/教程；如为反诈、反赌题材，只展示后果与法律制裁，不展示操作步骤。',
  },
  {
    id: 'B06-social-unrest', category: '扰乱社会秩序', label: '社会稳定', severity: 'BLOCK',
    statute: '《办法》11项禁令第10项',
    patterns: ['煽动暴乱', '煽动非法集会', '造谣传谣教程', '煽动暴力对抗', '煽动颠覆社会制度'],
    advice: '不得煽动扰乱社会秩序、传播违法造谣方法，请删除。',
  },
  {
    id: 'B07-fraud-finance', category: '非法金融', label: '非法金融', severity: 'BLOCK',
    patterns: ['非法集资', '传销教程', '非法吸收存款', '资金盘拉人头'],
    advice: '不得为非法集资、传销等做引流或教程化表达。',
  },
];

// ───────────────────────── WARN：受限题材（提示改写法，不硬拦） ─────────────────────────
export const WARN_RULES: SafetyRule[] = [
  {
    id: 'W01-supernatural', category: '灵异迷信(3类禁拍)', label: '灵异迷信', severity: 'WARN',
    patterns: ['驱鬼做法', '招魂仪式', '阴间地府', '厉鬼索命', '神仙显灵改命'],
    advice: '灵异元素建议用“幻觉/梦境/心理投射/科学解释”合理化，避免封建迷信导向。',
  },
  {
    id: 'W02-north-myanmar', category: '缅北猎奇(3类禁拍)', label: '缅北猎奇', severity: 'WARN',
    patterns: ['缅北', '电诈园区', '绑架酷刑'],
    advice: '缅北猎奇/酷刑展示受限，如需呈现只做反诈警示，不渲染暴力过程。',
  },
  {
    id: 'W03-self-harm', category: '自杀自残(13类受限)', label: '自杀自残', severity: 'WARN',
    patterns: ['自杀方法', '自残方式', '割腕细节', '跳楼过程'],
    advice: '不得展示自伤方法细节，必须给正向引导与求助出口，镜头点到为止。',
  },
  {
    id: 'W04-school-bully', category: '校园霸凌(13类受限)', label: '校园霸凌', severity: 'WARN',
    patterns: ['校园霸凌过程', '围殴细节'],
    advice: '不详细展示霸凌施暴过程，聚焦受害者成长与问题解决。',
  },
  {
    id: 'W05-medical-detail', category: '医疗细节(13类受限)', label: '医疗血腥', severity: 'WARN',
    patterns: ['手术开膛', '血腥治疗细节'],
    advice: '避免手术/治疗的血腥细节特写，用光影、反应镜头替代。',
  },
  {
    id: 'W06-pua', category: '情感操控(13类受限)', label: 'PUA/操控', severity: 'WARN',
    patterns: ['精神控制教程', 'PUA话术教学'],
    advice: '不得美化控制欲与 PUA 操控，应呈现其危害与当事人觉醒。',
  },
  {
    id: 'W07-wealth-flaunt', category: '炫富拜金(13类受限)', label: '炫富拜金', severity: 'WARN',
    patterns: ['金钱至上', '有钱就能买到一切'],
    advice: '不宣扬拜金价值观，可用“反差/自省”替代炫富。',
  },
  {
    id: 'W08-real-event', category: '真实事件改编(13类受限)', label: '真实事件', severity: 'WARN',
    patterns: ['真实事件改编', '真人真事原型'],
    advice: '真实事件/人物改编需取得授权并做艺术化处理，避免影射、诽谤真实个人。',
  },
  {
    id: 'W09-lgbtq-cn', category: '跨性别/LGBTQ(国内受限)', label: 'LGBTQ', severity: 'WARN',
    patterns: ['同性恋情直白呈现'],
    advice: '国内平台对该题材受限，建议情感克制表达；海外版可按当地尺度放开。',
  },
  {
    id: 'W10-drug-theme', category: '涉毒题材(13类受限)', label: '涉毒题材', severity: 'WARN',
    patterns: ['制毒', '贩毒', '吸毒'],
    advice: '涉毒属受限题材，只呈现危害、查处与法律后果，不展示制作、交易、吸食的任何操作细节。',
  },
  {
    id: 'W11-financial-crime-theme', category: '涉税/规避监管题材', label: '财税违法题材', severity: 'WARN',
    patterns: ['偷税漏税', '逃避监管', '洗钱'],
    advice: '涉税违法/规避监管题材应聚焦违法后果与依法整改，不得提供规避监管、偷逃税款的具体操作方法。',
  },
];

export const ALL_RULES: SafetyRule[] = [...BLOCK_RULES, ...WARN_RULES];

// ───────────────────────── 运营规则覆写（后台规则库） ─────────────────────────
/** 后台可持久化的覆写：新增自定义规则 + 按 id 停用默认规则 */
export interface SafetyOverrides {
  /** 运营新增的自定义规则（id 以 c_ 开头） */
  custom: SafetyRule[];
  /** 被停用的规则 id（含默认规则与自定义规则） */
  disabled: string[];
}
export const EMPTY_OVERRIDES: SafetyOverrides = { custom: [], disabled: [] };

/** 合并默认规则与运营覆写，得到当前生效规则集（纯函数，可对拍） */
export function mergeRules(ov: SafetyOverrides | null | undefined, base: SafetyRule[] = ALL_RULES): SafetyRule[] {
  if (!ov) return base;
  const disabled = new Set(ov.disabled ?? []);
  const kept = base.filter((r) => !disabled.has(r.id));
  const customs = (ov.custom ?? []).filter((r) => !disabled.has(r.id));
  return [...kept, ...customs];
}

/** 校验一条自定义规则（后台新增用），返回清洗后的规则或错误信息 */
export function buildCustomRule(input: {
  id?: string; severity: Severity; category: string; label: string;
  patterns: string[] | string; advice?: string; statute?: string;
}): { ok: true; rule: SafetyRule } | { ok: false; error: string } {
  const severity = input.severity === 'BLOCK' ? 'BLOCK' : input.severity === 'WARN' ? 'WARN' : null;
  if (!severity) return { ok: false, error: '处置级别必须是 BLOCK 或 WARN' };
  const label = (input.label ?? '').trim();
  const category = (input.category ?? '').trim() || (severity === 'BLOCK' ? '运营新增拦截' : '运营新增预警');
  if (!label) return { ok: false, error: '规则名称不能为空' };
  const rawPatterns = Array.isArray(input.patterns) ? input.patterns : String(input.patterns ?? '').split(/[,，\n]/);
  const patterns = [...new Set(rawPatterns.map((x) => x.trim()).filter(Boolean))];
  if (!patterns.length) return { ok: false, error: '至少需要 1 个命中词' };
  if (patterns.some((p) => p.length < 2)) return { ok: false, error: '命中词至少 2 个字符，避免单字误杀' };
  if (patterns.some((p) => p.length > 30)) return { ok: false, error: '单个命中词不超过 30 字' };
  const rule: SafetyRule = {
    id: input.id && /^c_[A-Za-z0-9_-]+$/.test(input.id) ? input.id : `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    category: category.slice(0, 40), label: label.slice(0, 40), severity,
    patterns: patterns.slice(0, 50),
    advice: (input.advice ?? '').trim().slice(0, 300) || (severity === 'BLOCK' ? '命中平台运营拦截规则，请调整表述后重试。' : '该题材需谨慎处理，建议正向表达、点到为止。'),
    statute: input.statute,
  };
  return { ok: true, rule };
}

// ───────────────────────── 核心扫描（纯函数） ─────────────────────────
function matchRules(text: string, rules: SafetyRule[]): SafetyHit[] {
  const hits: SafetyHit[] = [];
  if (!text) return hits;
  for (const rule of rules) {
    for (const p of rule.patterns) {
      if (p && text.includes(p)) {
        hits.push({
          ruleId: rule.id, category: rule.category, label: rule.label, severity: rule.severity,
          matched: p, advice: rule.advice, statute: rule.statute,
        });
        break; // 同一规则只报一次
      }
    }
  }
  return hits;
}

/**
 * 扫描单段文本。
 * @param text 待检测文本（创意 brief / 标题 / 正文 / 标签拼接 / 知识内容）
 * @param rules 可选生效规则集（传入 mergeRules 结果即应用后台覆写；缺省用内置默认规则，向后兼容）
 */
export function scanContent(text: string, rules: SafetyRule[] = ALL_RULES): ScanResult {
  const blocked = matchRules(text ?? '', rules.filter((r) => r.severity === 'BLOCK'));
  const warnings = matchRules(text ?? '', rules.filter((r) => r.severity === 'WARN'));
  const level: ScanResult['level'] = blocked.length ? 'block' : warnings.length ? 'warn' : 'safe';
  return {
    level,
    blocked,
    warnings,
    blockReason: blocked.length ? `内容含违规导向「${blocked[0].matched}」，已拦截` : null,
  };
}

/** 多段/互动分支全扫描：任一分支 BLOCK 即整体 BLOCK（互动短剧每个结局都要过审） */
export function scanMany(texts: Array<string | undefined | null>, rules: SafetyRule[] = ALL_RULES): ScanResult {
  const merged: ScanResult = { level: 'safe', blocked: [], warnings: [], blockReason: null };
  for (const t of texts) {
    const r = scanContent(t ?? '', rules);
    merged.blocked.push(...r.blocked);
    merged.warnings.push(...r.warnings);
  }
  merged.level = merged.blocked.length ? 'block' : merged.warnings.length ? 'warn' : 'safe';
  merged.blockReason = merged.blocked.length
    ? `内容含违规导向「${merged.blocked[0].matched}」，已拦截`
    : null;
  return merged;
}

/** 便捷判定：是否硬拦截（路由层用） */
export function isBlocked(text: string): boolean {
  return scanContent(text).level === 'block';
}

// ───────────────────────── 三级备案分类（《办法》分类分层） ─────────────────────────
export type FilingClass = 'I' | 'II' | 'III';
export interface FilingInput {
  /** 是否触碰特殊题材（政治/军事/外交/国安/统战/民族/宗教/司法/公安），无论投资额一律一类 */
  specialTopic?: boolean;
  /** 是否 AI 生成/制作（AI 门槛低于真人） */
  isAI?: boolean;
  /** 预估投资额（万元） */
  investWan?: number;
}
/** 播出前凭证类型（《办法》第十七条，三档完全不同，不可笼统称“许可证”） */
export type FilingCertType = 'LICENSE' | 'APPROVAL' | 'PROGRAM_NO';
export interface FilingResult {
  cls: FilingClass;
  name: string;
  process: string;
  reasons: string[];
  /** 是否需要发行许可证（仅一类为 true，向后兼容旧前端） */
  needLicense: boolean;
  /** 凭证类型：一类发行许可证 / 二类省级批准文件 / 三类平台节目编号 */
  certType: FilingCertType;
  /** 凭证法定名称 */
  certName: string;
  /** 申报主体是否须持《广播电视节目制作经营许可证》（仅一类强制） */
  qualRequired: boolean;
  /** 法定审核时限（天）：一类 20 日（含专家评审 10 日）；二类参照、三类平台自审为 null */
  reviewDays: number | null;
  /** 是否可自愿就高申报（第五十条，二三类均可） */
  canVoluntaryUp: boolean;
}

/**
 * 分类分层（题材优先级高于投资额）：
 *  真人：≥300万 一类；≥100万 二类；<100万 三类
 *  AI  ：≥80万  一类；≥30万  二类；<30万  三类
 *  特殊题材：一律一类
 */
export function classifyFiling(input: FilingInput): FilingResult {
  const { specialTopic = false, isAI = false, investWan } = input;
  const reasons: string[] = [];
  // 一类：总局备案公示 + 省级成片审核 +《微短剧发行许可证》；须持证、20 日时限
  const classI = (why: string): FilingResult => ({
    cls: 'I', name: '一类（重点）', needLicense: true,
    certType: 'LICENSE', certName: '《微短剧发行许可证》', qualRequired: true, reviewDays: 20, canVoluntaryUp: false,
    process: '总局备案公示 → 省级以上成片审核 → 颁发《微短剧发行许可证》（须持《广播电视节目制作经营许可证》，受理起约20日内决定）',
    reasons: [why],
  });
  // 二类：可参照一类备案，播出前省级审核发“批准文件”（非许可证）
  const classII = (why: string): FilingResult => ({
    cls: 'II', name: '二类（普通）', needLicense: false,
    certType: 'APPROVAL', certName: '省级广电主管部门批准文件（统一编号）', qualRequired: false, reviewDays: null, canVoluntaryUp: true,
    process: '可参照一类备案公示 → 播出前省级审核 → 颁发批准文件（编号规则总局统一制定，鼓励简化流程）',
    reasons: [why],
  });
  // 三类：播出单位播前审核 + 标注节目编号
  const classIII = (why: string, pending = false): FilingResult => ({
    cls: 'III', name: pending ? '待评估（暂按三类）' : '三类（其他）', needLicense: false,
    certType: 'PROGRAM_NO', certName: '播出单位节目编号（平台播前审核）', qualRequired: false, reviewDays: null, canVoluntaryUp: true,
    process: pending ? '暂由播出平台播前审核并标注节目编号；请补充预估投资额以精确判定' : '播出单位播前审核 + 标注本平台节目编号（仍须符合11项内容禁令）',
    reasons: [why],
  });
  if (specialTopic) {
    return classI('触碰政治/军事/外交/国安/统战/民族/宗教/司法/公安等特殊题材，无论投资额一律按一类管理');
  }
  const [t1, t2] = isAI ? [80, 30] : [300, 100];
  const kind = isAI ? 'AI微短剧' : '真人微短剧';
  if (investWan === undefined || investWan === null) {
    return classIII(`未提供投资额，暂按最低档处理；${kind}一类门槛≥${t1}万、二类≥${t2}万`, true);
  }
  if (investWan >= t1) return classI(`${kind}投资额 ${investWan}万 ≥ ${t1}万，按一类管理`);
  if (investWan >= t2) return classII(`${kind}投资额 ${investWan}万 处于 [${t2}万, ${t1}万)，按二类管理`);
  return classIII(`${kind}投资额 ${investWan}万 < ${t2}万，按三类管理`);
}

/** 已备案项目内容变更的影响（《办法》第十六条），用于“边写边更/续写改主线”合规提示 */
export interface FilingChange {
  /** 变更主要人物定位（主角身份/立场/核心人设根本改变） */
  changedMainCharacter?: boolean;
  /** 变更故事整体走向（主线结局/核心叙事方向根本改变） */
  changedStoryDirection?: boolean;
  /** 仅改剧名 */
  changedTitle?: boolean;
  /** 仅变更制作机构 */
  changedProducer?: boolean;
}
export type FilingChangeLevel = 'REFILE' | 'ALTER' | 'NONE';
export interface FilingChangeImpact {
  level: FilingChangeLevel;
  /** 是否需要重新备案（主要人物定位/故事整体走向变更） */
  refileRequired: boolean;
  message: string;
}
/**
 * 判定已公示/备案项目变更的合规后果：
 *  - 三类由平台自审，不走行政备案，返回 NONE（平台内部重审即可）；
 *  - 一/二类改动主角定位或整体走向 → 重新备案(REFILE)；仅改剧名/制作机构 → 办变更手续(ALTER)。
 */
export function filingChangeImpact(change: FilingChange, cls: FilingClass = 'I'): FilingChangeImpact {
  if (cls === 'III') {
    return { level: 'NONE', refileRequired: false, message: '三类微短剧由播出单位播前审核，内容调整后由平台重新审核即可，无需行政重新备案' };
  }
  if (change.changedMainCharacter || change.changedStoryDirection) {
    return {
      level: 'REFILE', refileRequired: true,
      message: '变更主要人物定位或故事整体走向，依据《办法》第十六条须重新履行备案/审核手续后再播出',
    };
  }
  if (change.changedTitle || change.changedProducer) {
    return {
      level: 'ALTER', refileRequired: false,
      message: '仅变更剧名或制作机构，办理备案变更手续即可，无需重新备案全片',
    };
  }
  return { level: 'NONE', refileRequired: false, message: '未涉及主要人物定位、整体走向、剧名或制作机构变更，无需重新备案' };
}

// ───────────────────────── AI 生成显著标注（《办法》强制） ─────────────────────────
/** AIGC 制作剧本必须在每集明显位置添加的提示标识文案 */
export function aiDisclaimer(lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'en'
    ? 'AI-Generated Content (for compliance with the Measures for the Development and Administration of Micro-short Dramas)'
    : '本集内容由人工智能技术生成/辅助生成（依据《微短剧发展管理办法》显著位置标注要求）';
}

/** 小说/IP 改编授权状态（9·1 新规禁止抄袭盗用小说 IP） */
export type AuthorizationStatus = 'ORIGINAL' | 'LICENSED' | 'UNDECLARED';
export function adaptationCopyrightCheck(status: AuthorizationStatus): { ok: boolean; reason: string | null } {
  if (status === 'UNDECLARED') {
    return { ok: false, reason: '小说/IP 改编须先勾选“已取得原著授权”，未授权改编不予生成（9·1 新规禁止抄袭盗用小说IP）' };
  }
  return { ok: true, reason: null };
}
