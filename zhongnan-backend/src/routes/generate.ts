import { asyncRouter } from '../lib/async-router';
import { z } from 'zod';
import { authRequired, AuthRequest } from '../middleware/auth';
import { isAdminUser } from '../middleware/admin';
import { prisma as defaultPrisma } from '../lib/prisma';
import { parsePageParams } from '../lib/pagination';
import { EngineTier, MemberLevel, MEMBERSHIP, episodePoints, FEN_PER_POINT, resolveEpisodeCharge, activeProjectLimit, VALUE_ADDED, vaPointsForLevel } from '../config/pricing';
import { freeze, settle, unfreeze, consumeFlexible, refundFlexible } from '../lib/billing';
import { withBillingTransaction } from '../lib/prisma-tx';
import { runEpisode, Bible } from '../agents/pipeline';
import { resolveEpisodeSourceText, SOURCE_TEXT_LIMIT } from '../engine/mode-gate'; // v2.319 episodes 原文统一取数（body 优先 + bible 兜底，版权闸门不中断）
import { latestScripts } from '../lib/latest-scripts';
import { hooksByLayer, ALL_HOOKS, CueMode, Strength, VALID_FLAVORS, HOOK_FLAVORS, FLAVOR_META, describeHook } from '../engine/hook-system';
import { BEAT_LIBRARY, localizeBeat, PAYOFF_FLAVORS, PAYOFF_FLAVOR_META, VALID_PAYOFF_FLAVORS, REVERSAL_FLAVORS, REVERSAL_FLAVOR_META, VALID_REVERSAL_FLAVORS, EMOTION_FLAVORS, EMOTION_FLAVOR_META, VALID_EMOTION_FLAVORS, normalizeBeatPref } from '../engine/beat-system';
import { buildEmotionWave, adviseWavePoint } from '../engine/emotion-wave';
import { isValidVisualStyleId, listVisualStyles } from '../engine/visual-style-library'; // v2.148 视觉画风编码库（AIGC 漫剧画风编号 → 可执行 prompt 模板）
import { isValidCameraStyleId, listCameraStyles } from '../engine/camera-language-library'; // v2.149 镜头语言编码库（AIGC 漫剧镜头语言编号 → 可执行 prompt 模板）
import { buildCastAssetDirective, extractCastAssetDrafts, type CastAssetSeed } from '../engine/character-asset'; // v2.151 角色资产库（L3 角色可资产化：跨剧复用强约束 + 沉淀草稿提取）
import { scoreCastAsset, detectCastAssetConflicts, autoFillCastAsset } from '../engine/asset-health'; // v2.152 资产体检（五维完整度 + 库级冲突预警）+ v2.181 规则模板补全
import { buildAssetUsageMap } from '../engine/asset-usage'; // v2.165 资产引用统计（当前被哪些项目引用，与 usedCount 历史累计口径互补）
import { extractPropAssetDrafts, type PropAssetSeed } from '../engine/prop-asset'; // v2.159 道具资产库（L3 道具可资产化：关键信物跨集沉淀）
import { scorePropAsset, detectPropAssetConflicts, normalizeEps, autoFillPropAsset } from '../engine/prop-health'; // v2.159 道具体检（五维完整度 + 库级冲突预警）+ v2.181 规则模板补全
import { buildSceneAssetDirective, extractSceneAssetDrafts, type SceneAssetSeed } from '../engine/scene-asset'; // v2.161 场景资产库（L3 场景可资产化：关键舞台跨剧沉淀）
import { scoreSceneAsset, detectSceneAssetConflicts, autoFillSceneAsset } from '../engine/scene-health'; // v2.161 场景体检（五维完整度 + 库级冲突预警）+ v2.181 规则模板补全
import { buildQcEngineDigest } from '../engine/qc-digest'; // v2.150 复盘修复：QC 引擎摘要落库，恢复前端质检聚合卡数据源
import { deviceFatigue } from '../engine/device-fatigue'; // v2.80 全剧装置疲劳分析
import { derivePairBits } from '../engine/pair-bond-ledger'; // v2.80 关系线保鲜台账（同场位派生）
import { deriveSubplotBits, type SubplotBit } from '../engine/subplot-weave'; // v2.80 支线编织台账（支线声明位派生）
import { normalizeWaveEp, type WaveEpInput } from '../engine/gratification-wave'; // v2.80 憋爽波浪台账（逐集爽感摘要派生）
import { deriveHookBit, type HookBit } from '../engine/cliffhanger-payoff'; // v2.80 集尾钩子跨集兑现账本（前集钩子位派生）
import { scoreCliffhangerForStorage, cliffhangerDigest } from '../engine/cliffhanger-score'; // c209 集尾钩落库统一形态（片段≤100/问题≤4）+ /fix 按新正文重算，旧结论整体沿用会使跨集钩子账本读到错误钩子位
import { arcTracker, arcTrackerDigest } from '../engine/arc-tracker'; // c210 角色弧光：批量/SSE/修复三处共用限界 digest（角色四字段/列表封顶），/fix 按新正文带上集 prevArc 重算
import { sceneSoftEndingDigest, sceneSoftEndingForStorage } from '../engine/scene-soft-ending'; // c211 软收尾：批量/SSE/修复三处共用限界 digest（hits≤8/issues≤6），/fix 按新正文重算
import { showDontTellDigest, showDontTellForStorage } from '../engine/show-dont-tell'; // c211 展示而非叙述：issues 形态引擎补落库（此前只进 SSE 刷新即丢），三处共用 digest，/fix 自动语种重算
import { structuralRescan } from '../engine/structural-rescan'; // c212 结构维度 32 键：批量落库走 buildQcEngineDigest 通用 issues 路径，/fix 无 pipeline 上下文时纯函数重跑覆盖（健康壳清 v1 旧账）
import { villainStall } from '../engine/villain-stall'; // c214 /fix 重算：hits 形态（string[] issues）不进 structuralRescan（shapeEntry 只收对象 issues 会产假健康壳），走 buildQcEngineDigest 路径 A 同形态覆盖
import { batchCreativeDigest } from '../engine/creative-batch-rescan'; // c215 /fix 重算：102 个纯函数创作引擎（对白/叙事/阀门家族）批量重扫，覆盖语义健康壳清 v1 旧账
import { shapeLedgerDiagnoses, rescanLedgerDiagnosisBundle } from '../engine/ledger-diagnosis-rescan'; // c216 跨集诊断台账六键（掉钩/欠账/干旱/疲劳/反派空转）：无 score 旧版三处全丢，落库+SSE+/fix 补齐
import { shapeContinuityLedgers, rescanContinuityBundle } from '../engine/continuity-ledger-rescan'; // c217 跨集连续性台账 24 键（信物/时间线/代价/死亡/下场/伤势/境界/归属/关系/阵营/地点/泄密/伪装/人情债/联盟/记忆/冒充/背叛/牺牲/诅咒/附身/穿越/变身/中毒）：无 score 四点全盲，落库+SSE+/fix 补齐；villainFate 与短名 rows 行合流
import { shapeGateEngines, rescanGateEngines } from '../engine/gate-engine-rescan'; // c218 闸门引擎四键（反套路/口语化/落地感/字数闸门）：无 score 被通用 digest 硬过滤四点全盲，落库+SSE+/fix 补齐；rhythm/character/styleCheck/propMotifRhythm 半盲键复用 buildQcEngineDigest 形态零分叉
import { rhythmScan } from '../engine/rhythm'; // c218 /fix 重算：节奏曲线有 score，走 buildQcEngineDigest 路径 B 同形态覆盖
import { characterLogicScan } from '../engine/character-logic'; // c218 /fix 重算：人物行为逻辑同上
import { teamBriefing } from '../engine/team-briefing'; // c214 同上
import { deadlineStretch } from '../engine/deadline-stretch'; // c214 同上
import { openingContinuityCheck } from '../engine/opening-continuity-check'; // c214 /fix 重算：整集重写会改开场，焊点结论需按新正文+前集结尾重算；前集结尾 <20 字不写空壳
import { extractHumiliationBits, normalizeDebtEp, type DebtEpInput } from '../engine/humiliation-ledger'; // v2.80 屈辱-打脸跨集账本（羞辱雷提取+摘要规范化）
import { mysteryAdvanceCheck, deriveMysteryHook, normalizeMysteryRow, type MysteryRow } from '../engine/mystery-drought'; // v2.80 多集悬念干旱账本（线词派生+摘要规范化）
import { normalizeHookTypeRow, type HookTypeRow } from '../engine/hook-fatigue'; // v2.80 跨集钩型疲劳账本（摘要规范化）
import { extractPropMentions, normalizePropRow, type PropRow } from '../engine/prop-ledger'; // v2.80 信物跨集连续性账本（信物提取+摘要规范化）
import { derivePromiseLine, promiseAdvanceCheck, normalizePromiseRow, type PromiseRow } from '../engine/promise-ledger'; // v2.80 承诺欠账账本（誓言线派生+摘要规范化）
import { detectVillainAction, normalizeVillainRow, type VillainRow } from '../engine/villain-threat'; // v2.80 反派威胁升级账本（动作分档+摘要规范化）
import { deriveTimelineMark, normalizeTimelineRow, type TimelineRow } from '../engine/timeline-ledger'; // v2.80 时间线跨集账本（锚点提取+摘要规范化）
import { deriveCostSignal, normalizeCostRow, type CostRow } from '../engine/cost-ledger'; // v2.80 代价跨集账本（信号提取+摘要规范化）
import { deriveDeathSignal, normalizeDeathRow, type DeathRow } from '../engine/death-ledger'; // v2.80 死亡穿帮账本（信号提取+摘要规范化）
import { deriveFateSignal, normalizeFateRow, type FateRow } from '../engine/villain-fate-ledger'; // v2.80 反派下场账本（信号提取+摘要规范化）
import { deriveWoundSignal, normalizeWoundRow, type WoundRow } from '../engine/wound-recovery-ledger'; // v2.80 创伤恢复账本（信号提取+摘要规范化）
import { derivePowerSignal, normalizePowerRow, type PowerRow } from '../engine/power-progress-ledger'; // v2.80 境界进阶账本（信号提取+摘要规范化）
import { deriveOwnershipRows, normalizeItemRow, type ItemRow } from '../engine/item-ownership-ledger'; // v2.80 信物归属账本（信号提取+摘要规范化）
import { deriveRelationRows, normalizeRelRow, type RelRow } from '../engine/relationship-ledger'; // v2.80 关系翻转账本（信号提取+摘要规范化）
import { deriveAffiliationRows, normalizeAffRow, type AffRow } from '../engine/affiliation-ledger'; // v2.80 阵营归属账本（信号提取+摘要规范化）
import { deriveLocationRows, normalizeLocRow, type LocRow } from '../engine/location-ledger'; // v2.80 地点跨集账本（信号提取+摘要规范化）
import { deriveLeakRows, normalizeLeakRow, type LeakRow } from '../engine/secret-leak-ledger'; // v2.80 秘密泄露账本（信号提取+摘要规范化）
import { deriveDisguiseRows, normalizeDisguiseRow, type DisguiseRow } from '../engine/disguise-ledger'; // v2.80 伪装身份账本（信号提取+摘要规范化）
import { deriveDebtRows, normalizeDebtRow, type DebtRow } from '../engine/debt-ledger'; // v2.80 人情债账本（信号提取+摘要规范化）
import { deriveAllianceRows, normalizeAllianceRow, type AllianceRow } from '../engine/alliance-ledger'; // v2.80 联盟账本（信号提取+摘要规范化）
import { deriveMemoryRows, normalizeMemoryRow, type MemoryRow } from '../engine/memory-ledger'; // v2.80 记忆账本（信号提取+摘要规范化）
import { deriveImpersonationRows, normalizeImpersonationRow, type ImpersonationRow } from '../engine/impersonation-ledger'; // v2.80 冒充账本
import { deriveBetrayalRows, normalizeBetrayalRow, type BetrayalRow } from '../engine/betrayal-ledger'; // v2.80 背叛账本
import { deriveSacrificeRows, normalizeSacrificeRow, type SacrificeRow } from '../engine/sacrifice-ledger'; // v2.80 牺牲账本
import { deriveCurseRows, normalizeCurseRow, type CurseRow } from '../engine/curse-ledger'; // v2.80 诅咒账本
import { derivePossessionRows, normalizePossessionRow, type PossessionRow } from '../engine/possession-ledger'; // v2.80 附身账本
import { deriveTimeTravelRows, normalizeTimeTravelRow, type TimeTravelRow } from '../engine/time-travel-ledger'; // v2.80 穿越账本
import { deriveTransformationRows, normalizeTransformationRow, type TransformationRow } from '../engine/transformation-ledger'; // v2.80 变身账本
import { derivePoisonRows, normalizePoisonRow, type PoisonRow } from '../engine/poison-ledger'; // v2.80 中毒账本
import { recommendFlavorProfile } from '../engine/flavor-recommender';
import { listStrategies, recommendStrategy, isValidHookStrategy } from '../engine/hook-strategy';
import { buildHookPalette, palettePicksToManual } from '../engine/hook-palette';
import { buildBeatPalette, palettePicksToManual as beatPicksToManual } from '../engine/beat-palette';
import { buildWaveDirector, WAVE_INTENTS } from '../engine/wave-director';
import { listPace, listDialogue, recommendPace, recommendDialogue, isValidPace, isValidDialogue, listEmotion, recommendEmotion, isValidEmotion, listCharacter, recommendCharacter, isValidCharacter } from '../engine/creation-strategy';
import { normalizeUiLang, localizeList, localizeReason } from '../engine/strategy-i18n';
import { localizeFlavor, localizeLabel } from '../engine/flavor-i18n';
import { localizeHookList } from '../engine/hook-catalog-i18n';
import { localizeBeatCatalogList } from '../engine/beat-catalog-i18n';
import { localizeFlavorReasons } from '../engine/flavor-reason-i18n';
import { localizeEmotionWave, localizeWaveAdviceList } from '../engine/wave-i18n';
import { localizeDiagnosis } from '../engine/diagnosis-i18n';
import { assertMargin, callText } from '../lib/model-proxy';
import { buildCreationContext } from '../engine/creation-context';
import { normalizeBrandBrief, scanBrandBrief, BrandBriefError, BrandBriefInput } from '../engine/brand-brief';
import { normalizeTrendBrief, scanTrendRisk, TrendBriefError, TrendBriefInput } from '../engine/trend-brief';
import { normalizeBranchBrief, validateBranchStructure, BranchBriefError, BranchBriefInput } from '../engine/branch-brief';
import { progressSnapshot, roleEventToStage } from '../engine/generation-progress';
import { opportunityRadar } from '../engine/opportunity-radar';
import { aiDisclaimer, classifyFiling } from '../lib/content-safety';
import { scanWithStore } from '../lib/safety-store';
import { diagnoseFull } from '../engine/full-diagnosis';
import { pickEpisodeForFix, buildFixPrompt, isUsableRewrite } from '../engine/polish-fix';
import { diffScripts, assessRewrite, summarizeChanges } from '../engine/script-diff'; // c202 版本对比纯引擎（零 token、确定性）；c204 变更摘要
import { modeAvailable, unlockLevel, canonicalModeId, CREATION_MODES as CREATION_MODE_LIST, MODE_ALIASES, trackAvailable, trackUnlockLevel, canonicalHitLabTrack, HIT_LAB_TRACKS } from '../config/modes';
import { requiresMatureConsent } from '../lib/auth-policy';
import { evaluateConsent, GATING_VALID_DAYS, type Region } from '../engine/mature-gating';
import { buildSampleScript } from '../engine/sample-script';
import { extractDocument } from '../lib/doc-extract';
import { assistantGate, assistantCapabilitiesOf, fixActionByDim } from '../config/assistant-capability';
import { sanitizeClientError } from '../lib/blackbox';
import { buildListenScript, listenEntitleNote } from '../engine/listen-script';
import { buildVoiceCast } from '../engine/listen-voice-cast';
import { buildShotManifest, planAigcVolume, analyzeAigcSceneCurve } from '../engine/aigc-screenplay'; // c219 AIGC 构成仪表盘数据落库：生成期/fix 期持久化到 qcReport._aigc，刷新后可重渲染
import { validateScript } from '../engine/script-format'; // c219 _aigc.format 复用 pipeline 同口径 validateScript（非 validateAigcScreenplay）
import { buildScriptDoc, normalizeBibleDoc } from '../lib/script-doc';
import { extractBibleCastNames, extractBibleCastArcs } from '../lib/cast-arc'; // v2.193 c193 在场台账名表三形态归一；v2.194 c194 prevArc 回退名→弧光三形态归一
import { buildScriptValue } from '../lib/script-value';
import { buildSmartDefaults } from '../lib/smart-defaults';
import { boardStore } from '../services/board-store';
import { toEngineUserProfile } from '../lib/profile-mapping';
import { setActiveAbort, getActiveAbort, deleteActiveAbort } from '../lib/active-tasks';

type PrismaLike = typeof defaultPrisma;
export function createGenerateRouter(prisma: PrismaLike | any) {
const generateRouter = asyncRouter();

// v2.190 用户显式取消 / v2.318 管理台干预：AbortController 注册表迁至共享模块 src/lib/active-tasks.ts，
// 生成路由负责注册/删除/abort，制作中管理台凭同一份事实做 live 标记与跨端取消

// v2.54 小南能力矩阵：前端按此灰显/引导升级，服务端各能力点独立硬校验
generateRouter.get('/assistant/capabilities', authRequired, async (req: AuthRequest, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
  const level = (u?.level as MemberLevel) ?? MemberLevel.FREE;
  res.json({ level, capabilities: assistantCapabilitiesOf(level) });
});

// v2.18 X剧本成年分级授权（mature-gating 技能接线）：以数据库签署记录 + 已支付开通订单做服务端核验，前端自报布尔值不可信
async function verifyMatureAdmission(userId: string, now = Date.now()) {
  const [user, consent, paidOrder] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { level: true } }),
    prisma.matureConsent.findFirst({ where: { userId, revokedAt: null }, orderBy: { signedAt: 'desc' } }),
    prisma.order.findFirst({ where: { userId, kind: 'VALUE_ADDED', remark: 'X_SCRIPT', status: 'PAID' }, orderBy: { paidAt: 'desc' } }),
  ]);
  if (!consent) return { pass: false, reasons: ['尚未完成成年分级问卷与免责授权'], expireAt: null };
  return evaluateConsent({
    memberPro: user?.level === MemberLevel.PRO,
    paid: !!paidOrder?.paidAt && now - new Date(paidOrder.paidAt).getTime() < GATING_VALID_DAYS * 864e5,
    ageConfirmed: consent.ageConfirmed, age: consent.age, region: consent.region as Region,
    purposePersonal: consent.purposePersonal, noMinorDistribution: consent.noMinorDistribution,
    boundaryAccepted: consent.boundaryAccepted, legalSelfResponsible: consent.legalSelfResponsible,
    signedAt: new Date(consent.signedAt).getTime(),
  }, now);
}

const MATURE_REGIONS = ['CN', 'HK', 'TW', 'US', 'JP', 'KR', 'EU', 'OTHER'] as const;
const consentSchema = z.object({
  age: z.number().int().min(1).max(120),
  region: z.enum(MATURE_REGIONS),
  purposePersonal: z.literal(true),
  noMinorDistribution: z.literal(true),
  boundaryAccepted: z.literal(true),
  legalSelfResponsible: z.literal(true),
});
/** 提交成年分级问卷与免责授权：服务端按法域/专业会员/单独开通订单综合判定，通过才落库（30天有效，全程留痕） */
generateRouter.post('/mature/consent', authRequired, async (req: AuthRequest, res) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '问卷信息不完整，请逐项确认后再提交', issues: parsed.error.issues.map((i) => i.message) });
  const d = parsed.data;
  // 落问卷签署记录（付费/会员资格由 evaluateConsent 统一判定，不满足会明确告知原因）
  const signedAt = new Date();
  const record = await prisma.matureConsent.create({ data: {
    userId: req.userId!, ageConfirmed: true, age: d.age, region: d.region,
    purposePersonal: d.purposePersonal, noMinorDistribution: d.noMinorDistribution,
    boundaryAccepted: d.boundaryAccepted, legalSelfResponsible: d.legalSelfResponsible,
    signedAt, expireAt: new Date(signedAt.getTime() + GATING_VALID_DAYS * 864e5),
  } });
  const admission = await verifyMatureAdmission(req.userId!);
  res.json({ ok: admission.pass, pass: admission.pass, reasons: admission.reasons, consentId: record.id, signedAt: record.signedAt, recordExpireAt: record.expireAt, admissionExpireAt: admission.expireAt });
});
/** 离线达标样例（新用户试用/黄金回归基线）：返回通过格式闸门的标准剧本样例，AIGC 制式自动补视听行
 *  v2.185.14 c194：lang=en 透传英文样例（白名单，非 en 一律回落 zh，绝不透传任意 query 值） */
generateRouter.get('/sample-script', (req, res) => {
  const fmt = String(req.query.format ?? 'LIVE').toUpperCase() === 'AIGC' ? 'AIGC' : 'LIVE';
  const lang = String(req.query.lang ?? 'zh').toLowerCase() === 'en' ? 'en' : 'zh';
  res.json({ format: fmt, lang, script: buildSampleScript(fmt, lang) });
});
/** 查询当前授权状态（前端据此决定是否放行 X 剧本入口及剩余有效期） */
generateRouter.get('/mature/consent', authRequired, async (req: AuthRequest, res) => {
  const admission = await verifyMatureAdmission(req.userId!);
  const latest = await prisma.matureConsent.findFirst({ where: { userId: req.userId!, revokedAt: null }, orderBy: { signedAt: 'desc' } });
  res.json({ ...admission, latest: latest ? { signedAt: latest.signedAt, expireAt: latest.expireAt, region: latest.region } : null });
});
/** 主动撤销授权（用户随时可撤回） */
generateRouter.post('/mature/consent/revoke', authRequired, async (req: AuthRequest, res) => {
  await prisma.matureConsent.updateMany({ where: { userId: req.userId!, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});

// v2.319 结构化标签入库前统一清洗：trim → 去空 → 去重 → 单项截 24 字 → 封顶 60 个。
// 标签是 tags 模式的一类输入（不再只拼进自然语言 brief），消费端（creation-context/海报/克隆）
// 与审核端（scanWithStore）都按结构化字段使用，故必须在入口净化而非依赖前端自觉。
function sanitizeProjectTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim().slice(0, 24);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 60) break;
  }
  return out;
}

// 创建项目（发起 SSE 生成的前置，作品库数据源）
const projectSchema = z.object({
  title: z.string().min(1, '项目名不能为空').max(120),
  mode: z.string().min(1).max(40),
  track: z.string().min(1).max(40).optional(), // v2.14 名场面工作台内部轨道 signature_scene/hit_reverse
  totalEps: z.number().int().min(1).max(500).optional(),
  engineTier: z.nativeEnum(EngineTier).optional(),
  // v2.319 入参上限放宽到 100 防恶意大包，静默清洗到 60（不阻断建项目）；落库恒为 string[]
  tags: z.array(z.string()).max(100).optional().transform(sanitizeProjectTags),
  // v2.319 立项即持久化原文（adapt/novel/hit_lab）：刷新续写/草稿恢复时 n-gram 版权闸门不依赖前端框状态
  sourceText: z.string().max(SOURCE_TEXT_LIMIT).optional(),
  format: z.enum(['LIVE_ACTION', 'AIGC']).optional(),
  investWan: z.number().min(0).max(100000).optional(),     // 预估投资额（万），用于三类分级备案
  specialTopic: z.boolean().optional(),                   // 特殊题材（政治/军事/民族宗教等）一律一类
  visualStyleId: z.string().max(8).optional(),            // v2.148 视觉画风编号（VS01~VS12，AIGC 项目；合法性入库前校验）
  cameraStyleId: z.string().max(8).optional(),            // v2.149 镜头语言编号（CL01~CL12，AIGC 项目；合法性入库前校验）
  castAssetIds: z.array(z.string().max(40)).max(10).optional(), // v2.151 引用角色资产 id（归属校验后快照进 project.bible.castAssets，全剧沿用）
  propAssetIds: z.array(z.string().max(40)).max(10).optional(), // v2.159 引用道具资产 id（归属校验后快照进 project.bible.propAssets，全剧沿用）
  sceneAssetIds: z.array(z.string().max(40)).max(10).optional(), // v2.161 引用场景资产 id（归属校验后快照进 project.bible.sceneAssets，全剧沿用）
  matureConsented: z.boolean().optional(),                // X剧本：已完成成年分级问卷与免责授权
  // 四层钩子编排偏好（用户选项 vs 系统默认）：随项目落库，续写/重生成自动沿用；非法钩子id入库前清洗
  hookPref: z.object({
    mode: z.enum(['auto', 'manual', 'hybrid']).optional(),
    strength: z.enum(['relax', 'balanced', 'tight']).optional(),
    preferred: z.array(z.string().max(40)).max(40).optional(),
    avoid: z.array(z.string().max(40)).max(40).optional(),
    microFlavors: z.array(z.string().max(20)).max(6).optional(),
    manual: z.record(z.any()).optional(),
  }).passthrough().optional(),
  // 反转/爽点/情绪节拍偏好（与钩子同构，举一反三）：随项目落库、续写沿用、白名单清洗
  beatPref: z.object({
    mode: z.enum(['auto', 'manual', 'hybrid']).optional(),
    strength: z.enum(['relax', 'balanced', 'tight']).optional(),
    preferred: z.array(z.string().max(40)).max(40).optional(),
    avoid: z.array(z.string().max(40)).max(40).optional(),
    manual: z.record(z.any()).optional(),
  }).passthrough().optional(),
});
generateRouter.post('/projects', authRequired, async (req: AuthRequest, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? '参数不合法' });
  const d = parsed.data;
  // 三级审核第一级：项目名+标签生成前机器拦截（硬拦截直接 422，不建项目、不计费）
  const projScan = await scanWithStore([d.title, ...(d.tags ?? [])].join('\n'), prisma);
  if (projScan.level === 'block') return res.status(422).json({ error: projScan.blockReason!, hits: projScan.blocked });
  // 会员等级决定“同时可进行的项目数”：统计未归档项目，超限拦截并引导升级（用户可删除/归档旧项目释放额度）
  const owner = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true, phone: true, isAdmin: true } });
  // 内部账户（超级管理员/杨光指定的管理员）：创作全免费且不受会员权益墙限制（成年分级授权除外，见下）
  const isStaff = isAdminUser(owner as { phone?: string | null; isAdmin?: boolean } | null);
  // 模式闭环闸门（P0）：未知模式拒绝；会员等级不足拒绝并给升级方向；成年向必须已完成分级授权
  const ownerLevel = (owner?.level ?? MemberLevel.FREE) as MemberLevel;
  const canonMode = canonicalModeId(d.mode);
  if (!canonMode) return res.status(400).json({ error: `未知创作模式：${d.mode}` });
  // 合规红线：X剧本成年分级授权对任何身份都不豁免（内部账户也必须完成问卷与免责授权）
  if (requiresMatureConsent(d.mode)) {
    const admission = await verifyMatureAdmission(req.userId!);
    if (!admission.pass) {
      return res.status(403).json({ error: 'MATURE_CONSENT_REQUIRED', reasons: admission.reasons, message: 'X剧本需专业会员、单独开通并完成成年分级问卷与免责授权（授权30天有效）' });
    }
  }
  if (!isStaff && !modeAvailable(canonMode, ownerLevel)) {
    const need = unlockLevel(canonMode);
    return res.status(403).json({
      error: 'MODE_LOCKED', needLevel: need,
      message: `当前会员等级不可用该创作模式，升级到${need ?? '更高等级'}后解锁`,
    });
  }
  // v2.14 轨道级闸门：名场面工作台的“爆款逆向批量”轨道需专业版（名场面拓展高级即可）
  const canonTrack = d.track ? canonicalHitLabTrack(d.track) : undefined;
  if (!isStaff && canonMode === 'hit_lab' && !trackAvailable(canonMode, canonTrack, ownerLevel)) {
    const needTrack = trackUnlockLevel(canonMode, canonTrack);
    return res.status(403).json({
      error: 'TRACK_LOCKED', needLevel: needTrack, track: 'hit_reverse',
      message: '「爆款逆向批量」为专业版轨道，升级专业会员后解锁；名场面拓展当前等级可用',
    });
  }
  const projLimit = activeProjectLimit(owner?.level);
  const mine = await prisma.project.findMany({ where: { userId: req.userId! }, select: { status: true } });
  const activeCount = mine.filter((x: any) => x.status !== 'archived').length;
  if (!isStaff && activeCount >= projLimit) {
    return res.status(403).json({
      error: 'REACH_PROJECT_LIMIT', activeCount, limit: projLimit,
      message: `当前会员最多同时进行 ${projLimit} 个剧本项目，升级会员可解锁更多，或先删除/归档旧项目`,
    });
  }
  const fmt = d.format ?? 'LIVE_ACTION';
  // 9·1《办法》三类分级备案：题材优先于投资额，随项目落库并回传前端提示
  const filing = classifyFiling({ specialTopic: d.specialTopic ?? false, isAI: fmt === 'AIGC', investWan: d.investWan });
  // 偏好入库前清洗通用器：只保留白名单内id，未知值丢弃；preferred/avoid 冲突时 preferred 优先
  const sanitizeCuePref = (pref: { mode?: string; strength?: string; preferred?: string[]; avoid?: string[]; microFlavors?: string[]; payoffFlavors?: string[]; reversalFlavors?: string[]; emotionFlavors?: string[]; manual?: Record<string, unknown> } | undefined, validIds: Set<string>, withFlavors = false, maxManual = 400) => {
    if (!pref) return undefined;
    const clean = (arr?: string[]) => (arr ?? []).filter((x) => validIds.has(x)).slice(0, 40);
    const preferred = clean(pref.preferred);
    const avoid = clean(pref.avoid).filter((x) => !preferred.includes(x));
    // v2.56 逐点 manual 不再被吞：键必须为整数位、值必须是合法 id；v2.57 节拍分层键（10000/20000/30000 段）上限放宽到 900 位防刷
    const manual: Record<number, string> = {};
    if (pref.manual && typeof pref.manual === 'object') {
      for (const [k, v] of Object.entries(pref.manual)) {
        const pos = Number(k);
        if (!Number.isInteger(pos) || typeof v !== 'string' || !validIds.has(v)) continue;
        manual[pos] = v;
        if (Object.keys(manual).length >= maxManual) break;
      }
    }
    const microFlavors = withFlavors ? (pref.microFlavors ?? []).filter((x) => VALID_FLAVORS.has(x)).slice(0, 6) : [];
    const payoffFlavors = withFlavors ? (pref.payoffFlavors ?? []).filter((x) => VALID_PAYOFF_FLAVORS.has(x)).slice(0, 5) : [];
    const reversalFlavors = withFlavors ? (pref.reversalFlavors ?? []).filter((x) => VALID_REVERSAL_FLAVORS.has(x)).slice(0, 4) : [];
    const emotionFlavors = withFlavors ? (pref.emotionFlavors ?? []).filter((x) => VALID_EMOTION_FLAVORS.has(x)).slice(0, 5) : [];
    const out: Record<string, unknown> = {
      ...(pref.mode ? { mode: pref.mode } : {}),
      ...(pref.strength ? { strength: pref.strength } : {}),
      ...(preferred.length ? { preferred } : {}),
      ...(avoid.length ? { avoid } : {}),
      ...(Object.keys(manual).length ? { manual } : {}),
      ...(microFlavors.length ? { microFlavors } : {}),
      ...(payoffFlavors.length ? { payoffFlavors } : {}),
      ...(reversalFlavors.length ? { reversalFlavors } : {}),
      ...(emotionFlavors.length ? { emotionFlavors } : {}),
    };
    return Object.keys(out).length ? out : undefined;
  };
  const hookPrefs = sanitizeCuePref(d.hookPref, new Set(ALL_HOOKS.map((h) => h.id)), true);
  const beatIds = new Set((['reversal', 'payoff', 'emotion'] as const).flatMap((k) => BEAT_LIBRARY[k].map((b) => b.id)));
  const beatPrefs = sanitizeCuePref(d.beatPref, beatIds, true, 900);
  // v2.151 角色资产引用：仅接受本人资产，快照进 project.bible.castAssets（生成时注入三岗位强约束）；非法/他人 id 静默丢弃，引用计数+
  const castAssetsSnapshot: CastAssetSeed[] = [];
  if (d.castAssetIds?.length) {
    const uniqIds = [...new Set(d.castAssetIds)].slice(0, 10);
    const ownedRows = await prisma.characterAsset.findMany({ where: { userId: req.userId! } }).catch(() => [] as any[]);
    const picked = ownedRows.filter((r: any) => uniqIds.includes(r.id)).slice(0, 10);
    for (const r of picked) {
      castAssetsSnapshot.push({
        id: r.id, name: r.name, persona: r.persona, voice: r.voice ?? null,
        signatureLines: Array.isArray(r.signatureLines) ? r.signatureLines.slice(0, 3) : [],
        visualAnchor: r.visualAnchor ?? null, voicePrintDigest: r.voicePrint ?? null,
      });
    }
  }
  // v2.159 道具资产引用：仅接受本人资产，快照进 project.bible.propAssets（生成时注入架构师/撰写师强约束）；非法/他人 id 静默丢弃，引用计数+
  const propAssetsSnapshot: PropAssetSeed[] = [];
  if (d.propAssetIds?.length) {
    const uniqPropIds = [...new Set(d.propAssetIds)].slice(0, 10);
    const ownedPropRows = await prisma.propAsset.findMany({ where: { userId: req.userId! } }).catch(() => [] as any[]);
    const pickedProps = ownedPropRows.filter((r: any) => uniqPropIds.includes(r.id)).slice(0, 10);
    for (const r of pickedProps) {
      propAssetsSnapshot.push({
        id: r.id, name: r.name, meaning: r.meaning, taboo: r.taboo ?? null,
        visualAnchor: r.visualAnchor ?? null,
      });
    }
  }
  // v2.161 场景资产引用：仅接受本人资产，快照进 project.bible.sceneAssets（生成时注入架构师/撰写师强约束）；非法/他人 id 静默丢弃，引用计数+
  const sceneAssetsSnapshot: SceneAssetSeed[] = [];
  if (d.sceneAssetIds?.length) {
    const uniqSceneIds = [...new Set(d.sceneAssetIds)].slice(0, 10);
    const ownedSceneRows = await prisma.sceneAsset.findMany({ where: { userId: req.userId! } }).catch(() => [] as any[]);
    const pickedScenes = ownedSceneRows.filter((r: any) => uniqSceneIds.includes(r.id)).slice(0, 10);
    for (const r of pickedScenes) {
      sceneAssetsSnapshot.push({
        id: r.id, name: r.name, meaning: r.meaning, mood: r.mood ?? null,
        taboo: r.taboo ?? null, visualAnchor: r.visualAnchor ?? null,
      });
    }
  }
  // v2.319 原文仅三模式持久化（其余模式即使夹带也不入库，防越权注入提示词）；trim 后不足 10 字忽略
  // v2.325 novel 已并入 adapt（canonicalModeId 归一为 adapt），这里不再单独判断
  const projectSourceText = (canonMode === 'adapt' || canonMode === 'hit_lab')
    && typeof d.sourceText === 'string' ? d.sourceText.trim().slice(0, SOURCE_TEXT_LIMIT) : '';
  const bibleCue = {
    ...(projectSourceText.length >= 10 ? { sourceText: projectSourceText } : {}),
    ...(hookPrefs ? { hookPrefs } : {}),
    ...(beatPrefs ? { beatPrefs } : {}),
    // v2.148 视觉画风编号：仅 AIGC 项目接受，非法编号静默丢弃（不阻断建项目）
    ...(fmt === 'AIGC' && isValidVisualStyleId(d.visualStyleId) ? { visualStyleId: d.visualStyleId } : {}),
    // v2.149 镜头语言编号：仅 AIGC 项目接受，非法编号静默丢弃（不阻断建项目）
    ...(fmt === 'AIGC' && isValidCameraStyleId(d.cameraStyleId) ? { cameraStyleId: d.cameraStyleId } : {}),
    // v2.151 角色资产快照：立项即锁定（全剧沿用，续写/重生成自动读取）
    ...(castAssetsSnapshot.length ? { castAssets: castAssetsSnapshot } : {}),
    // v2.159 道具资产快照：立项即锁定（全剧沿用，续写/重生成自动读取）
    ...(propAssetsSnapshot.length ? { propAssets: propAssetsSnapshot } : {}),
    // v2.161 场景资产快照：立项即锁定（全剧沿用，续写/重生成自动读取）
    ...(sceneAssetsSnapshot.length ? { sceneAssets: sceneAssetsSnapshot } : {}),
  };
  const project = await prisma.project.create({
    data: {
      userId: req.userId!, title: d.title, mode: d.mode, totalEps: d.totalEps ?? 0,
      engineTier: d.engineTier ?? EngineTier.STANDARD, tags: d.tags ?? [],
      format: fmt, status: 'draft',
      investWan: d.investWan ?? null, specialTopic: d.specialTopic ?? false, filing: filing as object,
      ...(Object.keys(bibleCue).length ? { bible: bibleCue as object } : {}),
    },
  });
  // v2.153 复盘修复：引用计数在项目创建成功后再 +1——create 失败不再白加计数（先加后建的时序账目漂移）
  if (castAssetsSnapshot.length) {
    await prisma.characterAsset.updateMany({
      where: { id: { in: castAssetsSnapshot.map((a) => a.id).filter(Boolean) as string[] } },
      data: { usedCount: { increment: 1 } },
    }).catch(() => null);
  }
  // v2.159 道具资产引用计数：同上，创建成功后再 +1
  if (propAssetsSnapshot.length) {
    await prisma.propAsset.updateMany({
      where: { id: { in: propAssetsSnapshot.map((a) => a.id).filter(Boolean) as string[] } },
      data: { usedCount: { increment: 1 } },
    }).catch(() => null);
  }
  // v2.161 场景资产引用计数：同上，创建成功后再 +1
  if (sceneAssetsSnapshot.length) {
    await prisma.sceneAsset.updateMany({
      where: { id: { in: sceneAssetsSnapshot.map((a) => a.id).filter(Boolean) as string[] } },
      data: { usedCount: { increment: 1 } },
    }).catch(() => null);
  }
  res.json(project);
});
// 四层钩子选项契约：前端据此渲染“系统智能/我来指定/混合”三模式 + 强度档 + 各层钩子偏好/禁用
// 十二模式权威清单（前端据此做等级软拦截，与后端强校验同一来源；含前端 wire-id 别名）
generateRouter.get('/modes', authRequired, async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
  const level = (me?.level ?? MemberLevel.FREE) as MemberLevel;
  res.json({
    modes: CREATION_MODE_LIST.map((m) => ({
      id: m.id, wireIds: Object.keys(MODE_ALIASES).filter((w) => MODE_ALIASES[w] === m.id),
      name: m.name, desc: m.desc, minLevel: m.minLevel, status: m.status ?? 'available',
      mature: !!m.mature, unlocked: modeAvailable(m.id, level),
      // v2.14 名场面工作台两轨道及其解锁态（前端据此渲染轨道切换与专业版引导）
      ...(m.id === 'hit_lab' ? {
        tracks: HIT_LAB_TRACKS.map((tk) => ({
          id: tk.id, name: tk.name, nameEn: tk.nameEn, desc: tk.desc, descEn: tk.descEn,
          minLevel: tk.minLevel, unlocked: trackAvailable('hit_lab', tk.id, level),
        })),
      } : {}),
    })),
  });
});
// v2.148 视觉画风编码库契约：前端 AIGC 画风选择器数据源（编号/中文名/质感关键词/适配说明/题材推荐）
generateRouter.get('/visual-styles', authRequired, async (req: AuthRequest, res) => {
  // 支持按题材 ids（逗号分隔 genre id）返回按适配度排序的清单；无题材时按库序
  const genreIds = String(req.query.genres || '').split(',').map((s) => s.trim()).filter(Boolean);
  let ordered = listVisualStyles();
  if (genreIds.length) {
    const { recommendVisualStyle } = await import('../engine/visual-style-library');
    ordered = recommendVisualStyle(genreIds);
  }
  res.json({
    styles: ordered.map((s) => ({
      id: s.id, label: s.label, keywords: s.keywords, note: s.note,
      suitedGenres: s.suitedGenres, bannedGenres: s.bannedGenres,
    })),
    ...(genreIds.length ? { recommended: ordered[0]?.id ?? null } : {}),
  });
});
// v2.149 镜头语言编码库契约：前端 AIGC 镜头语言选择器数据源（编号/中文名/镜头语法/适配说明/题材推荐），与 /visual-styles 同构
generateRouter.get('/camera-languages', authRequired, async (req: AuthRequest, res) => {
  // 支持按题材 ids（逗号分隔 genre id）返回按适配度排序的清单；无题材时按库序
  const genreIds = String(req.query.genres || '').split(',').map((s) => s.trim()).filter(Boolean);
  let ordered = listCameraStyles();
  if (genreIds.length) {
    const { recommendCameraStyle } = await import('../engine/camera-language-library');
    ordered = recommendCameraStyle(genreIds);
  }
  res.json({
    styles: ordered.map((s) => ({
      id: s.id, label: s.label, grammar: s.grammar, keywords: s.keywords, note: s.note,
      suitedGenres: s.suitedGenres, bannedGenres: s.bannedGenres,
    })),
    ...(genreIds.length ? { recommended: ordered[0]?.id ?? null } : {}),
  });
});
// —— v2.163 资产库检索：三族 list/health 共用关键词过滤（跨剧按标签/题材/关键词搜资产）——
// 匹配方式 = 大小写不敏感子串；字段集分族（同语义同口径，分族字段见 *_SEARCH_FIELDS）；
// 内存过滤（列表已 take 200 硬帽，DB-level contains 收益为零）；q 空缺 = 全量（完全向后兼容）。
// v2.164 复盘修复：①数组分支从 tags 特判泛化为任意数组字段（signatureLines 也是数组；Json 字段
// 历史污染教训——污染成字符串时走 String 分支天然兜底）；②三族字段集补 visualAnchor（外观锚点
// 是"跨剧可辨识"核心维度，搜"青砖黛瓦/左眉一道疤"必须能命中），cast 另补 signatureLines（标志性台词气质锚）。
function matchAssetQuery(row: any, ql: string, fields: readonly string[]): boolean {
  for (const f of fields) {
    const v = row?.[f];
    if (Array.isArray(v)) {
      if (v.some((x: any) => String(x ?? '').toLowerCase().includes(ql))) return true;
    } else if (String(v ?? '').toLowerCase().includes(ql)) return true;
  }
  return false;
}
const CAST_SEARCH_FIELDS = ['name', 'persona', 'voice', 'signatureLines', 'visualAnchor', 'tags'] as const;
const PROP_SEARCH_FIELDS = ['name', 'meaning', 'taboo', 'visualAnchor', 'tags'] as const;
const SCENE_SEARCH_FIELDS = ['name', 'meaning', 'mood', 'taboo', 'visualAnchor', 'tags'] as const;
/** q 参数归一：trim + 截 50 字符（六端点同口径） */
const assetSearchQ = (req: AuthRequest) => String(req.query.q ?? '').trim().slice(0, 50);

/** v2.186 c181 复盘防护：patches 客户端篡改防护——三族 batch-complete 端点 token 化路径的字段名白名单 + 值类型校验
 * 防 patches 注入任意字段（如 id/userId）或错型值（如 string 字段传对象）。白名单 = 三族 autoFill 实际可补字段。
 * v2.190 c190 值域防线（c189 BUG-1/BUG-2）：白名单从"字段名→类型"升级为"字段名→带值域约束规则"，
 * 约束数字与手动建档 zod schema 同源引用（禁两处手抄漂移），由 normalizePatchValue 统一执行三关校验。 */
type PatchFieldRule = { type: 'string'; max: number } | { type: 'string[]'; arrMax: number; itemMax: number };
const PATCH_FIELDS_CAST = {
  voice: { type: 'string', max: 200 },
  signatureLines: { type: 'string[]', arrMax: 5, itemMax: 60 },
  visualAnchor: { type: 'string', max: 200 },
} as const satisfies Record<string, PatchFieldRule>;
const PATCH_FIELDS_PROP = {
  visualAnchor: { type: 'string', max: 200 },
  taboo: { type: 'string', max: 200 },
  tags: { type: 'string[]', arrMax: 8, itemMax: 20 },
} as const satisfies Record<string, PatchFieldRule>;
const PATCH_FIELDS_SCENE = {
  visualAnchor: { type: 'string', max: 200 },
  mood: { type: 'string', max: 100 },
  tags: { type: 'string[]', arrMax: 8, itemMax: 20 },
} as const satisfies Record<string, PatchFieldRule>;
/** 查 patches 白名单字段规则（三族共用）；undefined = 非白名单字段 */
const patchRule = (table: Record<string, PatchFieldRule>, field: string): PatchFieldRule | undefined => table[field];

/** v2.190 c190 patches 单字段归一化（三族 batch-complete 共用，c189 两个 P1 缺陷的统一点）：
 * 关①类型壳：typeof / Array.isArray / 元素全 string（口径同 c181/c188，含非字符串元素整字段拒绝、不做部分写入）；
 * 关②内容非空（BUG-1）：string trim 后非空；数组剔除 trim 后空白元素后非空——旧代码只校验库内旧值 cur 不校验补丁新值 val，
 *   ''/'   '/[]/['','  '] 会脏写落库且 filledFields 谎报"已补全"，与资产体检端点口径矛盾；
 * 关③长度/数量（BUG-2）：上限与手动建档 zod 同源——旧 patches 路径无 zod，任意长度可落库并随资产注入生成 prompt。
 * 返回 null = 该字段静默跳过（保持批量补全"部分成功"语义，不引入 400）；返回归一化值（trim 后）方可写入。
 * 幂等：dry-run 返回的 patch 再走实际补全时 trim/清洗结果不变（autoFill 产出本就无首尾空白）。 */
function normalizePatchValue(rule: PatchFieldRule, raw: unknown): string | string[] | null {
  if (rule.type === 'string') {
    if (typeof raw !== 'string') return null;
    const v = raw.trim();
    if (!v || v.length > rule.max) return null;
    return v;
  }
  if (!Array.isArray(raw) || !raw.every((x) => typeof x === 'string')) return null;
  const items = (raw as string[]).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  if (items.length > rule.arrMax || items.some((s) => s.length > rule.itemMax)) return null;
  return items;
}

// —— v2.151 角色资产库：L3 编导"角色可资产化"跨剧沉淀/复用闭环 ——
// 列表：当前用户全部角色资产（前端立项引用多选 + 角色库管理面板数据源）
// v2.156 复盘修复：take 100→200 与体检分页上限对齐（沉淀按项目累积可超 100，原硬帽静默截断立项下拉）+ 响应带 total 供前端截断提示
// v2.163 检索：q 关键词过滤（命中人设/声音/标签），total 返回过滤后计数（前端可显示命中数）
generateRouter.get('/character-assets', authRequired, async (req: AuthRequest, res) => {
  const where = { userId: req.userId! };
  const q = assetSearchQ(req);
  const rows = await prisma.characterAsset.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 200,
  }).catch(() => [] as any[]);
  const filtered = q ? rows.filter((r: any) => matchAssetQuery(r, q.toLowerCase(), CAST_SEARCH_FIELDS)) : rows;
  const total = q ? filtered.length : await prisma.characterAsset.count({ where }).catch(() => rows.length);
  res.json({ assets: filtered, total });
});
// v2.152 资产体检：库级五维完整度 + 冲突预警（零 token 确定性，体检不耗模型）
// v2.155 分页：limit（1-200，默认 50）/offset 控健康列表体量；conflicts 必须跑全量库（分页页内查重会漏跨页同名/同人设冲突）
// v2.163 检索：q 过滤 rows 后再分页/体检/冲突——total=过滤后计数，conflicts=搜索视角的冲突报告（自洽且不违全量铁律）
generateRouter.get('/character-assets/health', authRequired, async (req: AuthRequest, res) => {
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  // v2.215 分页统一契约：parsePageParams 归一化；列表键 healths→items，补 page/pageSize 回显
  const { limit, offset, page, pageSize } = parsePageParams(req.query, { defaultLimit: 50, maxLimit: 200 });
  const q = assetSearchQ(req);
  const where = { userId: req.userId! };
  const rows = await prisma.characterAsset.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 500, // 全量硬帽：冲突预警跑全量库
  }).catch(() => [] as any[]);
  const filtered = q ? rows.filter((r: any) => matchAssetQuery(r, q.toLowerCase(), CAST_SEARCH_FIELDS)) : rows;
  const total = q ? filtered.length : await prisma.characterAsset.count({ where }).catch(() => rows.length);
  res.json({
    total, limit, offset, page, pageSize,
    items: filtered.slice(offset, offset + limit).map((r: any) => ({ id: r.id, name: r.name, ...scoreCastAsset(r, lang) })),
    conflicts: detectCastAssetConflicts(filtered, lang),
  });
});
// v2.165 引用统计：扫描当前用户项目的 bible 快照，按 asset id 聚合"当前被哪些项目引用"
// （usedCount=历史累计立项次数，项目删除不减；usage=实时在用明细——两口径互补，不改写 usedCount）
generateRouter.get('/character-assets/usage', authRequired, async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    select: { id: true, title: true, status: true, bible: true },
    orderBy: { updatedAt: 'desc' }, take: 500, // 扫描上限：单人项目量级内全量，scannedProjects 供前端提示覆盖面
  }).catch(() => [] as any[]);
  res.json({ usage: buildAssetUsageMap(projects, 'castAssets'), scannedProjects: projects.length });
});
// 手动编辑以记录 id 为准；同名创建或改名冲突均不覆盖已有资产。
async function saveManualAsset(modelName: 'characterAsset' | 'propAsset' | 'sceneAsset', id: string | undefined, userId: string, data: { name: string }, prefix: string, res: any) {
  try {
    const result = await withBillingTransaction(prisma, userId, async (tx) => {
      // 复用账户行锁，让同用户的资产查重与写入原子完成；不扣积分。
      await tx.lockAccount(userId);
      const model = (tx.raw as any)[modelName];
      const existing = id ? await model.findUnique({ where: { id } }) : null;
      if (id && (!existing || existing.userId !== userId)) return { status: 404, body: { error: `${prefix}_ASSET_NOT_FOUND`, message: '资产不存在或无权编辑' } };
      const conflict = await model.findFirst({ where: { userId, name: data.name } });
      if (conflict && conflict.id !== id) return { status: 409, body: { error: `${prefix}_ASSET_NAME_CONFLICT`, message: '已有同名资产，请换一个名称后再保存' } };
      const row = id
        ? await model.update({ where: { id }, data })
        : await model.create({ data: { ...data, userId } });
      return { status: 200, body: { asset: row, updated: !!id } };
    });
    // 事务可能重试，提交完成后才能回复，避免发送成功后又回滚。
    return res.status(result.status).json(result.body);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: `${prefix}_ASSET_NAME_CONFLICT`, message: '已有同名资产，请换一个名称后再保存' });
    throw error;
  }
}
const castAssetSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(20),
  persona: z.string().trim().min(1).max(200),
  voice: z.string().trim().max(PATCH_FIELDS_CAST.voice.max).optional().nullable(),
  signatureLines: z.array(z.string().trim().min(1).max(PATCH_FIELDS_CAST.signatureLines.itemMax)).max(PATCH_FIELDS_CAST.signatureLines.arrMax).optional(),
  visualAnchor: z.string().trim().max(PATCH_FIELDS_CAST.visualAnchor.max).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(20)).max(8).optional(),
});
generateRouter.post('/character-assets', authRequired, async (req: AuthRequest, res) => {
  const parsed = castAssetSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_CAST_ASSET', field: parsed.error.issues[0]?.path?.[0] });
  const d = parsed.data;
  const data = {
    name: d.name, persona: d.persona, voice: d.voice ?? null,
    signatureLines: d.signatureLines ?? [], visualAnchor: d.visualAnchor ?? null, tags: d.tags ?? [],
  };
  return saveManualAsset('characterAsset', d.id, req.userId!, data, 'CAST', res);
});
// 删除（归属校验，静默防越权探测）
generateRouter.delete('/character-assets/:id', authRequired, async (req: AuthRequest, res) => {
  const row = await prisma.characterAsset.findUnique({ where: { id: req.params.id } }).catch(() => null as any);
  if (!row || row.userId !== req.userId) return res.status(404).json({ error: 'CAST_ASSET_NOT_FOUND' });
  await prisma.characterAsset.delete({ where: { id: row.id } }).catch(() => null);
  res.json({ ok: true });
});
// 一键沉淀：项目全局圣经 + 最近成稿 → 确定性提取草稿（零 token），同名覆盖保留 usedCount
generateRouter.post('/character-assets/from-project/:projectId', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.projectId, userId: req.userId!, status: { not: 'deleted' } } }).catch(() => null as any);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  // bible.characters 三形态归一（字符串/数组/对象）——立项解析与 pipeline 回写形态不同；
  // c157 复盘修复：键名统一 trim（与 extractCastAssetDrafts 的键归一同口径，保证 chars[dft.name] 一手源判定可命中）
  let chars: Record<string, { traits?: string; arc?: string; voice?: string }> = {};
  try {
    const c = typeof (project.bible as any)?.characters === 'string' ? JSON.parse((project.bible as any).characters) : (project.bible as any)?.characters;
    const asBibleString = (v: unknown): string => (typeof v === 'string' ? v : '');
    const put = (k: unknown, v: any) => {
      const nk = String(k ?? '').trim();
      // v2.191 c191 沉淀入口字段类型壳：bible 是 LLM 裸 JSON 落库（无 zod），值字段非字符串时
      // 视同缺失——防 hasPersonaSource 的裸 .trim() TypeError（与引擎 asBibleString 双保险）
      if (nk && !chars[nk]) chars[nk] = { traits: asBibleString(v?.traits), arc: asBibleString(v?.arc), voice: asBibleString(v?.voice) };
    };
    if (Array.isArray(c)) {
      for (const item of c) {
        if (item && typeof item === 'object' && typeof item.name === 'string') put(item.name, item);
      }
    } else if (c && typeof c === 'object') {
      for (const [k, v] of Object.entries(c)) put(k, v);
    }
  } catch { chars = {}; }
  const latest = await prisma.script.findFirst({ where: { projectId: project.id }, orderBy: { epNo: 'desc' } }).catch(() => null as any);
  const drafts = extractCastAssetDrafts(chars, latest?.content ?? null, lang);
  // v2.192 c192 P3 闭环（c191 记名）：沉淀 persona/voice 是 bible 全文快照语义，与手动建档 zod 的
  // 200 字"短摘要"口径不同，不做 200 截断；但 Json 列无库级上限，LLM 异常产出极端巨串会拖慢
  // 资产列表接口并撑爆卡片——设异常护栏宽硬帽（正常 bible 单角色 traits+arc 远低于此），
  // 超宽只截尾部不报错。1000 为手填上限的 5 倍，两个口径都在本注释可查（c190 同源铁律）。
  const SEDIMENT_TEXT_CAP = 1000;
  const capText = (s: string | null | undefined): string | null | undefined => (typeof s === 'string' && s.length > SEDIMENT_TEXT_CAP ? s.slice(0, SEDIMENT_TEXT_CAP) : s);
  let created = 0, updated = 0;
  const assets: any[] = [];
  for (const dft of drafts) {
    const existing = await prisma.characterAsset.findFirst({ where: { userId: req.userId!, name: dft.name } }).catch(() => null as any);
    // v2.153 复盘修复：更新只增强不降级——空值不覆盖，手动精修的 voice/signatureLines/声纹不被沉淀稿静默回退清空
    // （与沉淀不触碰 visualAnchor/tags 的保护语义对称）；新建仍全量落库。
    // v2.160 复盘修复：bible 角色只有 voice（traits/arc 全空）时草稿 persona 是占位文案（"人设待补"），
    // 不得覆盖既有档的手动精修 persona——只有 bible 有一手源（traits/arc 至少一项非空）才刷新 persona。
    const srcChar = chars[dft.name];
    const hasPersonaSource = !!((srcChar?.traits ?? '').trim() || (srcChar?.arc ?? '').trim());
    const updateData = {
      ...(hasPersonaSource ? { persona: capText(dft.persona) } : {}), // 人设内核以一手源（bible）刷新，属沉淀本体语义；占位稿不降级
      ...(dft.voice ? { voice: capText(dft.voice) } : {}),
      ...(dft.signatureLines?.length ? { signatureLines: dft.signatureLines } : {}),
      ...(dft.voicePrint ? { voicePrint: dft.voicePrint } : {}),
      sourceProjectId: project.id, sourceProjectTitle: (project as any).title ?? null,
    };
    const createData = {
      persona: capText(dft.persona), voice: capText(dft.voice), signatureLines: dft.signatureLines, voicePrint: dft.voicePrint,
      sourceProjectId: project.id, sourceProjectTitle: (project as any).title ?? null,
    };
    const row = existing
      ? await prisma.characterAsset.update({ where: { id: existing.id }, data: updateData }).catch(() => null)
      : await prisma.characterAsset.create({ data: { ...createData, name: dft.name, userId: req.userId! } }).catch(() => null);
    if (row) { assets.push(row); if (existing) updated++; else created++; }
  }
  res.json({ created, updated, skipped: drafts.length - created - updated, assets });
});
// v2.181 thin 视图批量补全：零 token 规则模板补全缺项（voice/visualAnchor/signatureLines），
// voicePrint 必须从成稿沉淀、persona 必填不替编导捏——只补占位级，编导后续逐条精修
// v2.183 dry-run 预检：?dry-run=1 只跑 autoFill 不写库，返回 willUpdate/willSkip/fieldsUnion
//   闭环：前端先 dry-run 弹 confirm 显示补 N 条/跳过 M 条/涉及字段 X/Y，用户确认后再实际补全
// v2.185 c180 token 化延迟优化：dry-run 返回 patches（每条的 updateData 完整内容），实际补全请求带 patches 跳过 autoFill 重算
//   字段筛选：实际补全请求可带 fields 数组，只补选中字段（默认全选）；dry-run 也可带 fields 预检筛选后的结果
generateRouter.post('/character-assets/batch-complete', authRequired, async (req: AuthRequest, res) => {
  const ids: string[] = Array.isArray((req.body as any)?.ids) ? (req.body as any).ids.filter((x: any) => typeof x === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'IDS_REQUIRED' });
  if (ids.length > 200) return res.status(400).json({ error: 'IDS_TOO_MANY' }); // 与 list 端点 take 200 同口径
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  const dryRun = String((req.query['dry-run'] as string) || '') === '1';
  // c180 字段筛选：实际补全/dry-run 都可带 fields 数组，只补选中字段（默认全选）
  const fieldsFilter: string[] | null = Array.isArray((req.body as any)?.fields) ? (req.body as any).fields.filter((x: any) => typeof x === 'string') : null;
  // c180 token 化：实际补全请求可带 patches（dry-run 返回的 updateData），跳过 autoFill 重算
  const patchesInput: { id: string; patch: Record<string, any> }[] | null = Array.isArray((req.body as any)?.patches) ? (req.body as any).patches.filter((x: any) => x && typeof x.id === 'string' && x.patch && typeof x.patch === 'object') : null;
  const patchesMap = patchesInput ? new Map(patchesInput.map((p) => [p.id, p.patch])) : null;
  const rows = await prisma.characterAsset.findMany({ where: { id: { in: ids }, userId: req.userId! } }).catch(() => [] as any[]);
  const updated: any[] = []; const skipped: { id: string; name: string; reason: string }[] = [];
  const fieldsSet = new Set<string>(); // dry-run 并集字段
  for (const r of rows) {
    let updateData: any = {};
    let filledFields: string[] = [];
    if (patchesMap && patchesMap.has(r.id)) {
      // c180 token 化路径：直接用 patches，跳过 autoFill——按 fieldsFilter 筛选 patch 字段
      // c181 复盘防护：字段名白名单 + 值类型校验——防客户端篡改 patches 注入任意字段（如 id/userId）或错型值
      const patch = patchesMap.get(r.id)!;
      const fields = fieldsFilter ? fieldsFilter : Object.keys(patch);
      for (const f of fields) {
        if (!(f in patch)) continue;
        const rule = patchRule(PATCH_FIELDS_CAST, f);
        if (!rule) continue; // 不在白名单内的字段直接跳过
        const norm = normalizePatchValue(rule, patch[f]); // c190：类型壳 + 内容非空 + 长度同源三关（归一化后 trim）
        if (norm === null) continue;
        // 再次校验"只填空格不覆盖"——防 dry-run 后编导手动改了字段，patches 旧值覆盖
        const cur = (r as any)[f];
        const isArr = Array.isArray(cur);
        const isEmpty = isArr ? !cur.filter((s: any) => s && s.trim()).length : (cur == null || !String(cur).trim());
        if (isEmpty) updateData[f] = norm;
      }
      filledFields = Object.keys(updateData);
      if (!filledFields.length) { skipped.push({ id: r.id, name: r.name, reason: lang === 'zh' ? '选中字段已全部手动补全或不在 patch 内或类型不符' : 'Selected fields all filled manually, not in patch, or type-mismatched' }); continue; }
    } else {
      // 兼容旧路径：跑 autoFill
      const af = autoFillCastAsset(r as any, lang);
      if (!af.filled.filledFields?.length) {
        if (af.skipped.length) skipped.push({ id: r.id, name: r.name, reason: af.skipped.map((s) => `[${s.field}] ${s.reason}`).join('; ') });
        continue;
      }
      // 只填空格（不覆盖手动精修）——与 from-project 的"只增强不降级"语义同构
      // c177 复盘修复：与 scoreCastAsset 的 `!a.X?.trim()` 同构，覆盖 null/undefined/""/全空白 四种"缺失"口径
      if (af.filled.voice && (r.voice == null || !String(r.voice).trim())) updateData.voice = af.filled.voice;
      if (af.filled.signatureLines?.length && !(Array.isArray(r.signatureLines) ? r.signatureLines : []).filter((s: any) => s && s.trim()).length) updateData.signatureLines = af.filled.signatureLines;
      if (af.filled.visualAnchor && (r.visualAnchor == null || !String(r.visualAnchor).trim())) updateData.visualAnchor = af.filled.visualAnchor;
      // c180 字段筛选：按 fieldsFilter 筛选 updateData
      if (fieldsFilter) {
        for (const k of Object.keys(updateData)) if (!fieldsFilter.includes(k)) delete updateData[k];
      }
      filledFields = Object.keys(updateData);
      if (!filledFields.length) { skipped.push({ id: r.id, name: r.name, reason: lang === 'zh' ? '选中字段已全部手动补全或不可规则补全' : 'Selected fields all filled or not rule-completable' }); continue; }
    }
    // c178 dry-run：只计算不写库——返回结构化预览 + patch（c180 token 化）
    if (dryRun) {
      filledFields.forEach((f) => fieldsSet.add(f));
      updated.push({ id: r.id, name: r.name, fields: filledFields, patch: { ...updateData } });
      continue;
    }
    const row = await prisma.characterAsset.update({ where: { id: r.id }, data: updateData }).catch(() => null);
    if (row) updated.push({ id: r.id, name: r.name, filled: filledFields });
    else skipped.push({ id: r.id, name: r.name, reason: 'UPDATE_FAILED' });
  }
  if (dryRun) {
    res.json({ dryRun: true, willUpdate: updated, willSkip: skipped, fieldsUnion: [...fieldsSet], total: rows.length });
  } else {
    res.json({ updated, skipped, total: rows.length });
  }
});
// —— v2.159 道具资产库：L3 编导"道具可资产化"跨剧沉淀/复用闭环（与 character-assets 家族同构）——
// 列表：当前用户全部道具资产（前端立项引用多选 + 道具库管理面板数据源）；take 200 硬帽 + total 截断提示（c151/c156 家族铁律）
// v2.163 检索：q 关键词过滤（命中含义/禁忌/标签）
generateRouter.get('/prop-assets', authRequired, async (req: AuthRequest, res) => {
  const where = { userId: req.userId! };
  const q = assetSearchQ(req);
  const rows = await prisma.propAsset.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 200,
  }).catch(() => [] as any[]);
  const filtered = q ? rows.filter((r: any) => matchAssetQuery(r, q.toLowerCase(), PROP_SEARCH_FIELDS)) : rows;
  const total = q ? filtered.length : await prisma.propAsset.count({ where }).catch(() => rows.length);
  res.json({ assets: filtered, total });
});
// 道具体检：五维完整度 + 冲突预警（零 token 确定性）；limit（1-200，默认 50）/offset 分页，conflicts 必须跑全量库（页内查重会漏跨页冲突）
// v2.163 检索：q 过滤 rows 后再分页/体检/冲突（与 cast health 同口径）
generateRouter.get('/prop-assets/health', authRequired, async (req: AuthRequest, res) => {
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  // v2.215 分页统一契约：parsePageParams 归一化；列表键 healths→items，补 page/pageSize 回显
  const { limit, offset, page, pageSize } = parsePageParams(req.query, { defaultLimit: 50, maxLimit: 200 });
  const q = assetSearchQ(req);
  const where = { userId: req.userId! };
  const rows = await prisma.propAsset.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 500, // 全量硬帽：冲突预警跑全量库
  }).catch(() => [] as any[]);
  const filtered = q ? rows.filter((r: any) => matchAssetQuery(r, q.toLowerCase(), PROP_SEARCH_FIELDS)) : rows;
  const total = q ? filtered.length : await prisma.propAsset.count({ where }).catch(() => rows.length);
  res.json({
    total, limit, offset, page, pageSize,
    items: filtered.slice(offset, offset + limit).map((r: any) => ({ id: r.id, name: r.name, ...scorePropAsset(r, lang) })),
    conflicts: detectPropAssetConflicts(filtered, lang),
  });
});
// v2.165 引用统计：与 character-assets/usage 同口径（家族同构）
generateRouter.get('/prop-assets/usage', authRequired, async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    select: { id: true, title: true, status: true, bible: true },
    orderBy: { updatedAt: 'desc' }, take: 500,
  }).catch(() => [] as any[]);
  res.json({ usage: buildAssetUsageMap(projects, 'propAssets'), scannedProjects: projects.length });
});
// 手动建/改：新建不传 id，编辑必须传原记录 id。
const propAssetSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(30),
  meaning: z.string().trim().min(1).max(200),
  taboo: z.string().trim().max(PATCH_FIELDS_PROP.taboo.max).optional().nullable(),
  eps: z.array(z.number()).max(500).optional(),      // 数值合法性交给 normalizeEps 清洗（越界/重复/非法项剔除），类型错仍 400
  closedEps: z.array(z.number()).max(500).optional(),
  visualAnchor: z.string().trim().max(PATCH_FIELDS_PROP.visualAnchor.max).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(PATCH_FIELDS_PROP.tags.itemMax)).max(PATCH_FIELDS_PROP.tags.arrMax).optional(),
});
generateRouter.post('/prop-assets', authRequired, async (req: AuthRequest, res) => {
  const parsed = propAssetSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_PROP_ASSET', field: parsed.error.issues[0]?.path?.[0] });
  const d = parsed.data;
  const data = {
    name: d.name, meaning: d.meaning, taboo: d.taboo ?? null,
    eps: normalizeEps(d.eps), closedEps: normalizeEps(d.closedEps),
    visualAnchor: d.visualAnchor ?? null, tags: d.tags ?? [],
  };
  return saveManualAsset('propAsset', d.id, req.userId!, data, 'PROP', res);
});
// 删除（归属校验，静默防越权探测）
generateRouter.delete('/prop-assets/:id', authRequired, async (req: AuthRequest, res) => {
  const row = await prisma.propAsset.findUnique({ where: { id: req.params.id } }).catch(() => null as any);
  if (!row || row.userId !== req.userId) return res.status(404).json({ error: 'PROP_ASSET_NOT_FOUND' });
  await prisma.propAsset.delete({ where: { id: row.id } }).catch(() => null);
  res.json({ ok: true });
});
// 一键沉淀：全部分集成稿 × 信物词典（与信物账本/物料道具总表同词典）→ 确定性聚合草稿（零 token），
// 同名合并：meaning 属本体语义以一手源刷新；eps/closedEps 跨项目沉淀取并集（v2.160 只增强不降级，历史不丢）；taboo/visualAnchor/tags 不触碰（手动精修不降级）
generateRouter.post('/prop-assets/from-project/:projectId', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.projectId, userId: req.userId!, status: { not: 'deleted' } } }).catch(() => null as any);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  const allEps = await prisma.script.findMany({
    where: { projectId: project.id }, select: { epNo: true, content: true }, orderBy: { epNo: 'asc' }, take: 500,
  }).catch(() => [] as any[]);
  const drafts = extractPropAssetDrafts(allEps.map((s: any) => ({ ep: s.epNo, content: s.content ?? '' })));
  let created = 0, updated = 0;
  const assets: any[] = [];
  for (const dft of drafts) {
    // c157 复盘：沉淀名 trim 归一（与手动 upsert 的 schema trim 同口径，防孤儿档 + dup_name 分组漏检）
    const name = String(dft.name ?? '').trim();
    if (!name) continue;
    const existing = await prisma.propAsset.findFirst({ where: { userId: req.userId!, name } }).catch(() => null as any);
    const commonData = {
      sourceProjectId: project.id, sourceProjectTitle: (project as any).title ?? null,
    };
    const row = existing
      ? await prisma.propAsset.update({
          where: { id: existing.id },
          data: {
            meaning: dft.meaning || existing.meaning, // 本体语义：一手源刷新；一手源空句不覆盖旧含义
            // v2.160 复盘修复：eps/closedEps 跨项目沉淀改并集（只增强不降级铁律）——
            // 原覆盖语义下，B 剧沉淀会抹掉 A 剧的出现/封禁历史（closedEps 丢失 = "已销毁"红线失真，
            // 体检查不出封禁态、架构师失去连续性约束依据）；normalizeEps 合并去重防污染。
            eps: normalizeEps([...(Array.isArray(existing.eps) ? existing.eps : []), ...dft.eps]),
            closedEps: normalizeEps([...(Array.isArray(existing.closedEps) ? existing.closedEps : []), ...dft.closedEps]),
            ...commonData,
          },
        }).catch(() => null)
      : await prisma.propAsset.create({
          data: {
            name, meaning: dft.meaning || (String((req.query.lang as string) || 'zh') === 'en' ? 'meaning pending' : '含义待补'),
            eps: dft.eps, closedEps: dft.closedEps, ...commonData, userId: req.userId!,
          },
        }).catch(() => null);
    if (row) { assets.push(row); if (existing) updated++; else created++; }
  }
  res.json({ created, updated, skipped: drafts.length - created - updated, assets });
});
// v2.181 thin 视图批量补全（道具家族同构）：规则模板补 visualAnchor/taboo/tags，eps 不可补
// v2.183 dry-run 预检（家族同构）：?dry-run=1 不写库，返回 willUpdate/willSkip/fieldsUnion
// v2.185 c180 token 化延迟优化 + 字段筛选（家族同构）：dry-run 返回 patches，实际补全请求带 patches 跳过 autoFill + fields 筛选
generateRouter.post('/prop-assets/batch-complete', authRequired, async (req: AuthRequest, res) => {
  const ids: string[] = Array.isArray((req.body as any)?.ids) ? (req.body as any).ids.filter((x: any) => typeof x === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'IDS_REQUIRED' });
  if (ids.length > 200) return res.status(400).json({ error: 'IDS_TOO_MANY' });
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  const dryRun = String((req.query['dry-run'] as string) || '') === '1';
  // c180 字段筛选 + token 化（与 cast 家族同构）
  const fieldsFilter: string[] | null = Array.isArray((req.body as any)?.fields) ? (req.body as any).fields.filter((x: any) => typeof x === 'string') : null;
  const patchesInput: { id: string; patch: Record<string, any> }[] | null = Array.isArray((req.body as any)?.patches) ? (req.body as any).patches.filter((x: any) => x && typeof x.id === 'string' && x.patch && typeof x.patch === 'object') : null;
  const patchesMap = patchesInput ? new Map(patchesInput.map((p) => [p.id, p.patch])) : null;
  const rows = await prisma.propAsset.findMany({ where: { id: { in: ids }, userId: req.userId! } }).catch(() => [] as any[]);
  const updated: any[] = []; const skipped: { id: string; name: string; reason: string }[] = [];
  const fieldsSet = new Set<string>();
  for (const r of rows) {
    let updateData: any = {};
    let filledFields: string[] = [];
    if (patchesMap && patchesMap.has(r.id)) {
      // c180 token 化路径（与 cast 同构）+ c181 复盘防护：字段名白名单 + 值类型校验
      const patch = patchesMap.get(r.id)!;
      const fields = fieldsFilter ? fieldsFilter : Object.keys(patch);
      for (const f of fields) {
        if (!(f in patch)) continue;
        const rule = patchRule(PATCH_FIELDS_PROP, f);
        if (!rule) continue;
        const norm = normalizePatchValue(rule, patch[f]); // c190：类型壳 + 内容非空 + 长度同源三关（与 cast 同构）
        if (norm === null) continue;
        const cur = (r as any)[f];
        const isArr = Array.isArray(cur);
        const isEmpty = isArr ? !cur.filter((s: any) => s && s.trim()).length : (cur == null || !String(cur).trim());
        if (isEmpty) updateData[f] = norm;
      }
      filledFields = Object.keys(updateData);
      if (!filledFields.length) { skipped.push({ id: r.id, name: r.name, reason: lang === 'zh' ? '选中字段已全部手动补全或不在 patch 内或类型不符' : 'Selected fields all filled manually, not in patch, or type-mismatched' }); continue; }
    } else {
      // 兼容旧路径：跑 autoFill
      const af = autoFillPropAsset(r as any, lang);
      if (!af.filled.filledFields?.length) {
        if (af.skipped.length) skipped.push({ id: r.id, name: r.name, reason: af.skipped.map((s) => `[${s.field}] ${s.reason}`).join('; ') });
        continue;
      }
      // c177 复盘修复：与 scorePropAsset 的 `!a.X?.trim()` 同构（覆盖 null/undefined/""/全空白）
      if (af.filled.visualAnchor && (r.visualAnchor == null || !String(r.visualAnchor).trim())) updateData.visualAnchor = af.filled.visualAnchor;
      if (af.filled.taboo && (r.taboo == null || !String(r.taboo).trim())) updateData.taboo = af.filled.taboo;
      if (af.filled.tags?.length && !(Array.isArray(r.tags) ? r.tags : []).filter((s: any) => s && s.trim()).length) updateData.tags = af.filled.tags;
      // c180 字段筛选：按 fieldsFilter 筛选 updateData
      if (fieldsFilter) {
        for (const k of Object.keys(updateData)) if (!fieldsFilter.includes(k)) delete updateData[k];
      }
      filledFields = Object.keys(updateData);
      if (!filledFields.length) { skipped.push({ id: r.id, name: r.name, reason: lang === 'zh' ? '选中字段已全部手动补全或不可规则补全' : 'Selected fields all filled or not rule-completable' }); continue; }
    }
    if (dryRun) {
      filledFields.forEach((f) => fieldsSet.add(f));
      updated.push({ id: r.id, name: r.name, fields: filledFields, patch: { ...updateData } });
      continue;
    }
    const row = await prisma.propAsset.update({ where: { id: r.id }, data: updateData }).catch(() => null);
    if (row) updated.push({ id: r.id, name: r.name, filled: filledFields });
    else skipped.push({ id: r.id, name: r.name, reason: 'UPDATE_FAILED' });
  }
  if (dryRun) {
    res.json({ dryRun: true, willUpdate: updated, willSkip: skipped, fieldsUnion: [...fieldsSet], total: rows.length });
  } else {
    res.json({ updated, skipped, total: rows.length });
  }
});
// —— v2.161 场景资产库：L3 编导"场景可资产化"跨剧沉淀/复用闭环（与 prop-assets 家族同构，第三资产家族）——
// 列表：当前用户全部场景资产（前端立项引用多选 + 场景库管理面板数据源）；take 200 硬帽 + total 截断提示（家族铁律）
// v2.163 检索：q 关键词过滤（命中功能/氛围/禁忌/标签）
generateRouter.get('/scene-assets', authRequired, async (req: AuthRequest, res) => {
  const where = { userId: req.userId! };
  const q = assetSearchQ(req);
  const rows = await prisma.sceneAsset.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 200,
  }).catch(() => [] as any[]);
  const filtered = q ? rows.filter((r: any) => matchAssetQuery(r, q.toLowerCase(), SCENE_SEARCH_FIELDS)) : rows;
  const total = q ? filtered.length : await prisma.sceneAsset.count({ where }).catch(() => rows.length);
  res.json({ assets: filtered, total });
});
// 场景体检：五维完整度 + 冲突预警（零 token 确定性）；limit（1-200，默认 50）/offset 分页，conflicts 必须跑全量库（页内查重会漏跨页冲突）
// v2.163 检索：q 过滤 rows 后再分页/体检/冲突（与 cast/prop health 同口径）
generateRouter.get('/scene-assets/health', authRequired, async (req: AuthRequest, res) => {
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  // v2.215 分页统一契约：parsePageParams 归一化；列表键 healths→items，补 page/pageSize 回显
  const { limit, offset, page, pageSize } = parsePageParams(req.query, { defaultLimit: 50, maxLimit: 200 });
  const q = assetSearchQ(req);
  const where = { userId: req.userId! };
  const rows = await prisma.sceneAsset.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 500, // 全量硬帽：冲突预警跑全量库
  }).catch(() => [] as any[]);
  const filtered = q ? rows.filter((r: any) => matchAssetQuery(r, q.toLowerCase(), SCENE_SEARCH_FIELDS)) : rows;
  const total = q ? filtered.length : await prisma.sceneAsset.count({ where }).catch(() => rows.length);
  res.json({
    total, limit, offset, page, pageSize,
    items: filtered.slice(offset, offset + limit).map((r: any) => ({ id: r.id, name: r.name, ...scoreSceneAsset(r, lang) })),
    conflicts: detectSceneAssetConflicts(filtered, lang),
  });
});
// v2.165 引用统计：与 character-assets/usage 同口径（家族同构）
generateRouter.get('/scene-assets/usage', authRequired, async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    select: { id: true, title: true, status: true, bible: true },
    orderBy: { updatedAt: 'desc' }, take: 500,
  }).catch(() => [] as any[]);
  res.json({ usage: buildAssetUsageMap(projects, 'sceneAssets'), scannedProjects: projects.length });
});
// v2.167 资产看板：L3"资产化运营"能力的运营决策面（沉淀→引用→体检→usage→运营决策闭环最后一块）
// 痛点：编导沉淀了一堆资产，但不知道"哪些是明星资产（多剧引用）/ 哪些是冷门待激活 / 空壳档该先补哪个"。
// 本端点聚合三族：热度榜（按 usedCount 降序 top10）+ 空壳补全优先级队列（score<55，缺失维度越少越优先——
// 投入产出比：补全维度的成本固定，缺 1 维的离"可用"最近、缺 5 维的等于从零写，故缺失维度数升序）。
// 零 token 确定性：基于已有 usedCount 字段 + health 体检数据聚合，无新增 IO 路径；Promise.all 三族并行扫描。
// v2.168 复盘修复：原 take:50 + orderBy usedCount desc 把 usedCount=0 的真空壳截断了（空壳资产天然没人引用，
// 排在 usedCount desc 末尾被 take 50 切掉）——thinQueue 实际只看到"top 50 热门里的空壳"，漏掉真正最需要补全的真空壳。
// 改为 take:200（与家族 list/health 端点铁律同口径：list take 200 + total 截断提示、health take 500 全量体检），
// 让空壳资产能完整进入 thinQueue；热度榜 top10 仍从 take 200 里 slice(0,10)，因 orderBy usedCount desc 已排序，
// 前 10 即为最高热度，take 200 留有余量不丢数据。
generateRouter.get('/asset-dashboard', authRequired, async (req: AuthRequest, res) => {
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  // v2.173 复盘修复（c169）：take 200→500，与 health 端点同口径（c155"查重必须全量"铁律复发）
  // 痛点：c168 加的 buildStats conflicts/stats 跑 take 200，编导 >200 条资产时漏第 201+ 条的空壳/冲突
  // dash 端点加 stats 后已是运营决策面板，conflicts 必须跑全量（与 health 端点 take 500 同口径），否则编导在 dashboard 看到"3 条冲突"去 health 却看到"5 条冲突"数字不一致
  const [castRows, propRows, sceneRows] = await Promise.all([
    prisma.characterAsset.findMany({ where: { userId: req.userId! }, orderBy: { usedCount: 'desc' }, take: 500 }).catch(() => [] as any[]),
    prisma.propAsset.findMany({ where: { userId: req.userId! }, orderBy: { usedCount: 'desc' }, take: 500 }).catch(() => [] as any[]),
    prisma.sceneAsset.findMany({ where: { userId: req.userId! }, orderBy: { usedCount: 'desc' }, take: 500 }).catch(() => [] as any[]),
  ]);
  // v2.173 复盘修复：真实总数（prisma.count），>500 时告诉编导"共 600 条，展示前 500"——c156"截断必须可见"铁律
  // 痛点：c168 的 castStats.total = castRows.length = 500（达到硬帽时编导看到"总数 500"实际可能是 600），hotCastTotal 同理
  // castStats.total 与 hotCastTotal 都用真实总数，>500 时前端 dashStatsCard 显示截断提示
  const [castTotalTrue, propTotalTrue, sceneTotalTrue] = await Promise.all([
    prisma.characterAsset.count({ where: { userId: req.userId! } }).catch(() => castRows.length),
    prisma.propAsset.count({ where: { userId: req.userId! } }).catch(() => propRows.length),
    prisma.sceneAsset.count({ where: { userId: req.userId! } }).catch(() => sceneRows.length),
  ]);
  // 热度榜 top10：每个资产带 usedCount + 五维体检（编导看"明星资产是否也在退化"——热度高但 score<55 = 明星空壳，最危险）
  const hotCast = castRows.slice(0, 10).map((r: any) => ({ id: r.id, name: r.name, usedCount: r.usedCount ?? 0, ...scoreCastAsset(r, lang) }));
  const hotProp = propRows.slice(0, 10).map((r: any) => ({ id: r.id, name: r.name, usedCount: r.usedCount ?? 0, ...scorePropAsset(r, lang) }));
  const hotScene = sceneRows.slice(0, 10).map((r: any) => ({ id: r.id, name: r.name, usedCount: r.usedCount ?? 0, ...scoreSceneAsset(r, lang) }));
  // 空壳补全优先级队列：三族合并 score<55 的资产，按 (missing 长度 asc, score asc, id asc) 排序 top20
  // family 字段供前端跳转对应资产面板；missing 维度越少=离"可用"越近，补全 ROI 越高
  // v2.168 加 id 稳定 tiebreaker：missing 长度与 score 都相同时，sort 不稳定会让多次刷新顺序变化，加 id 保证一致
  // v2.169 补全闭环：thinQueue 行带 sourceProjectTitle（沉淀来源剧）+ updatedAt（上次编辑时间），
  // 编导看 thinQueue 时能回溯"这个空壳是从哪个剧沉淀的、多久没动了"，并在前端"去补全"按钮跳转对应资产面板
  const thinCast = castRows.map((r: any) => ({ id: r.id, name: r.name, family: 'cast' as const, usedCount: r.usedCount ?? 0, sourceProjectTitle: r.sourceProjectTitle ?? null, updatedAt: r.updatedAt ?? null, ...scoreCastAsset(r, lang) }));
  const thinProp = propRows.map((r: any) => ({ id: r.id, name: r.name, family: 'prop' as const, usedCount: r.usedCount ?? 0, sourceProjectTitle: r.sourceProjectTitle ?? null, updatedAt: r.updatedAt ?? null, ...scorePropAsset(r, lang) }));
  const thinScene = sceneRows.map((r: any) => ({ id: r.id, name: r.name, family: 'scene' as const, usedCount: r.usedCount ?? 0, sourceProjectTitle: r.sourceProjectTitle ?? null, updatedAt: r.updatedAt ?? null, ...scoreSceneAsset(r, lang) }));
  const thinQueue = [...thinCast, ...thinProp, ...thinScene]
    .filter((a) => a.score < 55)
    .sort((a, b) => (a.missing.length - b.missing.length) || (a.score - b.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, 20);
  // v2.171 冷门待激活：usedCount=0 且 score≥55 的资产（完整/可用但 0 次引用，编导决定是否激活到新剧）
  // 痛点：编导只看热度榜和空壳队列，会漏掉"养熟但没用过"的资产——这些资产已具备约束力但闲置，
  // 编导可在新剧立项时引用它们提升角色一致性（与 thinQueue 互补：thinQueue 管"该补的"，coldQueue 管"该用的"）。
  // 排序 score desc（最有约束力的优先展示），take 5/族避免列表过长；无 sourceProjectTitle 时为手动创建档。
  // v2.172 复盘修复：c156"截断必须可见"铁律复发——pickCold take 5 静默截断，编导资产 ≥5 时漏掉次级候选。
  // 改返回 { items, total } 结构：items 是 take 5 截断后的，total 是全量计数，前端 sec 函数显示"+N 条未展示"提示。
  // 同时 items 加 updatedAt 字段（编导决定激活时也想知道"沉淀后多久没用过"，长时间闲置的更该激活——与 thinQueue 的 updatedAt 同口径）。
  const pickCold = (rows: any[], family: 'cast' | 'prop' | 'scene', scoreFn: any) => {
    const all = rows
      .filter((r: any) => (r.usedCount ?? 0) === 0)
      .map((r: any) => ({ id: r.id, name: r.name, family, sourceProjectTitle: r.sourceProjectTitle ?? null, updatedAt: r.updatedAt ?? null, ...scoreFn(r, lang) }))
      .filter((a: any) => a.score >= 55)
      .sort((a: any, b: any) => b.score - a.score);
    return { items: all.slice(0, 5), total: all.length };
  };
  const coldCast = pickCold(castRows, 'cast', scoreCastAsset);
  const coldProp = pickCold(propRows, 'prop', scorePropAsset);
  const coldScene = pickCold(sceneRows, 'scene', scoreSceneAsset);
  // v2.172 复盘补强：hotCast/hotProp/hotScene 也加 total（三族总资产数）——告诉编导"在 N 条资产里选了 top 10 展示"，
  // 编导资产 >10 时知道还有更多明星资产可去族库面板翻找。与 coldXxx.total 同口径，sec 函数统一显示截断提示。
  // v2.173 dashboard 资产健康总览：三族 stats + 冲突数——编导打开 dashboard 第一眼看到"我的资产库整体健康度"，
  // 而非直接跳到 hot/thin/cold 列表。宏观信号：总数/平均分/空壳率/完整率/冲突数，编导据此决定"今天该补哪族、该消冲突、还是该激活冷门"。
  // 复用 scoreCast/scoreProp/scoreScene 纯函数（已在 hot/thin/cold 用过），不引入新正则；conflicts 跑全量库（与 health 端点同口径）。
  // v2.173 复盘修复（c169）：buildStats 加 totalTrue（真实总数）+ truncated（>500 时为 true，前端显示截断提示）
  // 痛点：c168 的 total = castRows.length = 500（达到硬帽时编导看到"总数 500"实际可能是 600），违反 c156"截断必须可见"
  // totalTrue 用 prisma.count（真实总数），truncated = totalTrue > rows.length（>500 时 true）；empty/usable/complete/conflicts 仍用 take 500 数据（与 health 端点同口径，>500 是极端情况）
  const buildStats = (rows: any[], scoreFn: any, conflictsFn: any, totalTrue: number) => {
    const scored = rows.map((r: any) => scoreFn(r, lang));
    const total = scored.length;
    const sumScore = scored.reduce((s: number, a: any) => s + (a.score || 0), 0);
    const empty = scored.filter((a: any) => a.score < 55).length;
    const usable = scored.filter((a: any) => a.score >= 55 && a.score < 85).length;
    const complete = scored.filter((a: any) => a.score >= 85).length;
    const conflicts = conflictsFn(rows, lang).length;
    const truncated = totalTrue > total;
    return { total: totalTrue, scanned: total, avgScore: total ? Math.round(sumScore / total) : 0, empty, usable, complete, conflicts, truncated };
  };
  const castStats = buildStats(castRows, scoreCastAsset, detectCastAssetConflicts, castTotalTrue);
  const propStats = buildStats(propRows, scorePropAsset, detectPropAssetConflicts, propTotalTrue);
  const sceneStats = buildStats(sceneRows, scoreSceneAsset, detectSceneAssetConflicts, sceneTotalTrue);
  res.json({
    hotCast, hotProp, hotScene, thinQueue,
    hotCastTotal: castTotalTrue, hotPropTotal: propTotalTrue, hotSceneTotal: sceneTotalTrue,
    coldCast, coldProp, coldScene,
    castStats, propStats, sceneStats,
  });
});
// 手动建/改：新建不传 id，编辑必须传原记录 id。
const sceneAssetSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(30),
  meaning: z.string().trim().min(1).max(200),
  mood: z.string().trim().max(PATCH_FIELDS_SCENE.mood.max).optional().nullable(),
  taboo: z.string().trim().max(200).optional().nullable(),
  eps: z.array(z.number()).max(500).optional(),      // 数值合法性交给 normalizeEps 清洗（与道具家族同口径），类型错仍 400
  visualAnchor: z.string().trim().max(PATCH_FIELDS_SCENE.visualAnchor.max).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(PATCH_FIELDS_SCENE.tags.itemMax)).max(PATCH_FIELDS_SCENE.tags.arrMax).optional(),
});
generateRouter.post('/scene-assets', authRequired, async (req: AuthRequest, res) => {
  const parsed = sceneAssetSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_SCENE_ASSET', field: parsed.error.issues[0]?.path?.[0] });
  const d = parsed.data;
  const data = {
    name: d.name, meaning: d.meaning, mood: d.mood ?? null, taboo: d.taboo ?? null,
    eps: normalizeEps(d.eps),
    visualAnchor: d.visualAnchor ?? null, tags: d.tags ?? [],
  };
  return saveManualAsset('sceneAsset', d.id, req.userId!, data, 'SCENE', res);
});
// 删除（归属校验，静默防越权探测）
generateRouter.delete('/scene-assets/:id', authRequired, async (req: AuthRequest, res) => {
  const row = await prisma.sceneAsset.findUnique({ where: { id: req.params.id } }).catch(() => null as any);
  if (!row || row.userId !== req.userId) return res.status(404).json({ error: 'SCENE_ASSET_NOT_FOUND' });
  await prisma.sceneAsset.delete({ where: { id: row.id } }).catch(() => null);
  res.json({ ok: true });
});
// 一键沉淀：全部分集成稿 × 场头解析（与物料场景总表同口径同源）→ 确定性聚合草稿（零 token），
// 同名合并：eps 跨项目沉淀取并集（只增强不降级，历史不丢）；meaning/mood/taboo/visualAnchor/tags 不触碰——
// 场景无"功能"一手源（场头只有地点结构），沉淀稿不臆造语义（创建占位"功能待补"，更新不碰手动精修档）
generateRouter.post('/scene-assets/from-project/:projectId', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.projectId, userId: req.userId!, status: { not: 'deleted' } } }).catch(() => null as any);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  const allEps = await prisma.script.findMany({
    where: { projectId: project.id }, select: { epNo: true, content: true }, orderBy: { epNo: 'asc' }, take: 500,
  }).catch(() => [] as any[]);
  const drafts = extractSceneAssetDrafts(allEps.map((s: any) => ({ ep: s.epNo, content: s.content ?? '' })));
  let created = 0, updated = 0;
  const assets: any[] = [];
  for (const dft of drafts) {
    // c157 复盘：沉淀名 trim 归一（与手动 upsert 的 schema trim 同口径，防孤儿档 + dup_name 分组漏检）
    const name = String(dft.name ?? '').trim();
    if (!name) continue;
    const existing = await prisma.sceneAsset.findFirst({ where: { userId: req.userId!, name } }).catch(() => null as any);
    const commonData = {
      sourceProjectId: project.id, sourceProjectTitle: (project as any).title ?? null,
    };
    const row = existing
      ? await prisma.sceneAsset.update({
          where: { id: existing.id },
          data: {
            // eps 并集（v2.160 家族铁律：跨项目沉淀只增强不降级，A 剧置景复用历史不因 B 剧再沉淀丢失）
            eps: normalizeEps([...(Array.isArray(existing.eps) ? existing.eps : []), ...dft.eps]),
            ...commonData,
          },
        }).catch(() => null)
      : await prisma.sceneAsset.create({
          data: {
            name, meaning: String((req.query.lang as string) || 'zh') === 'en' ? 'function pending' : '功能待补',
            eps: dft.eps, ...commonData, userId: req.userId!,
          },
        }).catch(() => null);
    if (row) { assets.push(row); if (existing) updated++; else created++; }
  }
  res.json({ created, updated, skipped: drafts.length - created - updated, assets });
});
// v2.181 thin 视图批量补全（场景家族同构）：规则模板补 visualAnchor/mood/tags，eps 不可补
// v2.183 dry-run 预检（家族同构）：?dry-run=1 不写库，返回 willUpdate/willSkip/fieldsUnion
// v2.185 c180 token 化延迟优化 + 字段筛选（家族同构）：dry-run 返回 patches，实际补全请求带 patches 跳过 autoFill + fields 筛选
generateRouter.post('/scene-assets/batch-complete', authRequired, async (req: AuthRequest, res) => {
  const ids: string[] = Array.isArray((req.body as any)?.ids) ? (req.body as any).ids.filter((x: any) => typeof x === 'string') : [];
  if (!ids.length) return res.status(400).json({ error: 'IDS_REQUIRED' });
  if (ids.length > 200) return res.status(400).json({ error: 'IDS_TOO_MANY' });
  const lang = String((req.query.lang as string) || 'zh') === 'en' ? 'en' as const : 'zh' as const;
  const dryRun = String((req.query['dry-run'] as string) || '') === '1';
  // c180 字段筛选 + token 化（与 cast/prop 家族同构）
  const fieldsFilter: string[] | null = Array.isArray((req.body as any)?.fields) ? (req.body as any).fields.filter((x: any) => typeof x === 'string') : null;
  const patchesInput: { id: string; patch: Record<string, any> }[] | null = Array.isArray((req.body as any)?.patches) ? (req.body as any).patches.filter((x: any) => x && typeof x.id === 'string' && x.patch && typeof x.patch === 'object') : null;
  const patchesMap = patchesInput ? new Map(patchesInput.map((p) => [p.id, p.patch])) : null;
  const rows = await prisma.sceneAsset.findMany({ where: { id: { in: ids }, userId: req.userId! } }).catch(() => [] as any[]);
  const updated: any[] = []; const skipped: { id: string; name: string; reason: string }[] = [];
  const fieldsSet = new Set<string>();
  for (const r of rows) {
    let updateData: any = {};
    let filledFields: string[] = [];
    if (patchesMap && patchesMap.has(r.id)) {
      // c180 token 化路径（与 cast/prop 同构）+ c181 复盘防护：字段名白名单 + 值类型校验
      const patch = patchesMap.get(r.id)!;
      const fields = fieldsFilter ? fieldsFilter : Object.keys(patch);
      for (const f of fields) {
        if (!(f in patch)) continue;
        const rule = patchRule(PATCH_FIELDS_SCENE, f);
        if (!rule) continue;
        const norm = normalizePatchValue(rule, patch[f]); // c190：类型壳 + 内容非空 + 长度同源三关（与 cast/prop 同构）
        if (norm === null) continue;
        const cur = (r as any)[f];
        const isArr = Array.isArray(cur);
        const isEmpty = isArr ? !cur.filter((s: any) => s && s.trim()).length : (cur == null || !String(cur).trim());
        if (isEmpty) updateData[f] = norm;
      }
      filledFields = Object.keys(updateData);
      if (!filledFields.length) { skipped.push({ id: r.id, name: r.name, reason: lang === 'zh' ? '选中字段已全部手动补全或不在 patch 内或类型不符' : 'Selected fields all filled manually, not in patch, or type-mismatched' }); continue; }
    } else {
      // 兼容旧路径：跑 autoFill
      const af = autoFillSceneAsset(r as any, lang);
      if (!af.filled.filledFields?.length) {
        if (af.skipped.length) skipped.push({ id: r.id, name: r.name, reason: af.skipped.map((s) => `[${s.field}] ${s.reason}`).join('; ') });
        continue;
      }
      // c177 复盘修复：与 scoreSceneAsset 的 `!a.X?.trim()` 同构（覆盖 null/undefined/""/全空白）
      if (af.filled.visualAnchor && (r.visualAnchor == null || !String(r.visualAnchor).trim())) updateData.visualAnchor = af.filled.visualAnchor;
      if (af.filled.mood && (r.mood == null || !String(r.mood).trim())) updateData.mood = af.filled.mood;
      if (af.filled.tags?.length && !(Array.isArray(r.tags) ? r.tags : []).filter((s: any) => s && s.trim()).length) updateData.tags = af.filled.tags;
      // c180 字段筛选：按 fieldsFilter 筛选 updateData
      if (fieldsFilter) {
        for (const k of Object.keys(updateData)) if (!fieldsFilter.includes(k)) delete updateData[k];
      }
      filledFields = Object.keys(updateData);
      if (!filledFields.length) { skipped.push({ id: r.id, name: r.name, reason: lang === 'zh' ? '选中字段已全部手动补全或不可规则补全' : 'Selected fields all filled or not rule-completable' }); continue; }
    }
    if (dryRun) {
      filledFields.forEach((f) => fieldsSet.add(f));
      updated.push({ id: r.id, name: r.name, fields: filledFields, patch: { ...updateData } });
      continue;
    }
    const row = await prisma.sceneAsset.update({ where: { id: r.id }, data: updateData }).catch(() => null);
    if (row) updated.push({ id: r.id, name: r.name, filled: filledFields });
    else skipped.push({ id: r.id, name: r.name, reason: 'UPDATE_FAILED' });
  }
  if (dryRun) {
    res.json({ dryRun: true, willUpdate: updated, willSkip: skipped, fieldsUnion: [...fieldsSet], total: rows.length });
  } else {
    res.json({ updated, skipped, total: rows.length });
  }
});
// 源文档上传解析（改编/小说模式）：base64 上传，本地解析不耗模型 token；限 8MB、提取上限 20 万字
const extractSchema = z.object({
  filename: z.string().min(1).max(260),
  dataBase64: z.string().min(1).max(12_000_000),
  maxChars: z.number().int().min(1000).max(500_000).optional(),
});
generateRouter.post('/extract-source', authRequired, async (req: AuthRequest, res) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '文件参数不合法或超出 8MB 上限' });
  const { filename, dataBase64, maxChars } = parsed.data;
  let buf: Buffer;
  try { buf = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64'); }
  catch { return res.status(400).json({ error: '文件编码无法识别，请重新选择' }); }
  if (!buf.length) return res.status(400).json({ error: '文件内容为空' });
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: '文件超过 8MB 上限，请拆分或转为 txt' });
  try {
    const r = extractDocument(buf, filename, maxChars);
    res.json(r);
  } catch (e: any) {
    res.status(422).json({ error: `解析失败：${String(e?.message ?? e).replace(/^[A-Z_]+:/, '').trim() || '格式不受支持'}，可改为直接粘贴正文` });
  }
});
generateRouter.get('/hook-options', authRequired, async (req: AuthRequest, res) => {
  // v1.95 钩子/节拍目录；v2.44 策略卡六语，v2.45 四轴风味/层/模式/强度/节拍类名六语（29 钩/26 节拍完整释义仍 zh/en，四语回退英文）
  const lang = normalizeUiLang(req.query.lang);
  const en = lang !== 'zh';
  const baseL = en ? 'en' : 'zh';
  const brief = (layer: 'open' | 'episode' | 'scene' | 'micro') => {
    const labelPair: Record<string, [string, string]> = {
      open: ['开场钩（黄金3秒）', 'Opening hooks (golden 3 seconds)'],
      episode: ['集钩（集首承接/集尾卡点促追更）', 'Episode hooks (cold open / end-of-episode cliff)'],
      scene: ['场钩（场景之间牵引）', 'Scene hooks (pull between scenes)'],
      micro: ['微钩（句子级：动作/语言/氛围/情绪/信息差/伏笔/感官/微反转）', 'Micro hooks (sentence-level: action/dialogue/atmosphere/emotion/info-gap/foreshadow/sensory/mini-twist)'],
    };
    const zhEnLabel = { name: en ? labelPair[layer][1] : labelPair[layer][0] };
    return {
      layer, label: localizeLabel('layer', layer, lang, zhEnLabel).name,
      hooks: localizeHookList(hooksByLayer(layer, baseL).map((h) => ({ id: h.id, name: h.name, definition: h.definition, example: h.example, bestFor: h.bestFor })), lang),
    };
  };
  const flavorOf = (axis: 'micro' | 'payoff' | 'reversal' | 'emotion', f: string, meta: { name: string; nameEn: string; desc: string; descEn: string }) =>
    localizeFlavor(axis, f, lang, { name: en ? meta.nameEn : meta.name, desc: en ? meta.descEn : meta.desc });
  res.json({
    lang,
    // v2.27 钩子策略：用户看得懂的 5 个预设（系统智能默认 + 用户自选），每个带一句话定位、适用题材、强度
    strategies: localizeList('hook', listStrategies(baseL), lang),
    layers: (['open', 'episode', 'scene', 'micro'] as const).map((l) => brief(l)),
    flavors: HOOK_FLAVORS.map((f) => ({ id: f, ...flavorOf('micro', f, FLAVOR_META[f]) })),
    payoffFlavors: PAYOFF_FLAVORS.map((f) => ({ id: f, ...flavorOf('payoff', f, PAYOFF_FLAVOR_META[f]) })),
    reversalFlavors: REVERSAL_FLAVORS.map((f) => ({ id: f, ...flavorOf('reversal', f, REVERSAL_FLAVOR_META[f]) })),
    emotionFlavors: EMOTION_FLAVORS.map((f) => ({ id: f, ...flavorOf('emotion', f, EMOTION_FLAVOR_META[f]) })),
    modes: (['auto', 'manual', 'hybrid'] as const).map((m) => {
      const zhEn = m === 'auto'
        ? { name: en ? 'Smart Auto' : '系统智能', desc: en ? 'The system arranges and rotates by genre and rhythm to avoid fatigue (default)' : '系统按题材与节奏自动排布、轮换，防疲劳（默认）' }
        : m === 'manual'
          ? { name: en ? 'I Choose' : '我来指定', desc: en ? 'You specify the hook type at every position, one by one' : '每个位置由你逐点指定钩子类型' }
          : { name: en ? 'Hybrid' : '混合', desc: en ? 'Your picks come first; the system fills the rest intelligently' : '你指定的优先，其余位置系统智能补齐' };
      return { id: m as CueMode, ...localizeLabel('cueMode', m, lang, zhEn) };
    }),
    strengths: (['relax', 'balanced', 'tight'] as const).map((g) => {
      const zhEn = g === 'relax'
        ? { name: en ? 'Sparse & Breathable' : '舒缓留白', desc: en ? 'Few hooks, emphasis on mood and breathing room' : '钩子稀疏，重氛围与呼吸感' }
        : g === 'balanced'
          ? { name: en ? 'Balanced' : '均衡', desc: en ? 'Alternate tension and release; the universal pick' : '张弛有度，通用推荐' }
          : { name: en ? 'High-Density Hooks' : '强钩高密度', desc: en ? 'A hook in every scene, dense micro hooks, strong binge pull' : '每场带钩、微钩密集，强追更' };
      return { id: g as Strength, ...localizeLabel('strength', g, lang, zhEn) };
    }),
    total: ALL_HOOKS.length,
    beats: (['reversal', 'payoff', 'emotion'] as const).map((kind) => ({
      kind,
      label: localizeLabel('beatKind', kind, lang, {
        name: en ? (kind === 'reversal' ? 'Reversal beats' : kind === 'payoff' ? 'Payoff beats' : 'Emotion beats') : kind === 'reversal' ? '反转节拍' : kind === 'payoff' ? '爽点节拍' : '情绪节拍',
      }).name,
      items: localizeBeatCatalogList(BEAT_LIBRARY[kind].map((b0) => { const b = localizeBeat(b0, baseL); return { id: b.id, name: b.name, definition: b.definition, technique: b.technique, example: b.example, bestFor: b.bestFor }; }), lang),
    })),
  });
});
// v2.04 按题材标签/梗概智能推荐四轴叙事风味（不生成剧本、不耗积分，仅给推荐与理由）
generateRouter.post('/flavor-recommend', authRequired, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const lang = normalizeUiLang(body.lang); // v2.45 六语：推荐算法仍跑 zh/en，结果名按目标语本地化
    const baseL = lang === 'zh' ? 'zh' : 'en';
    const tags = Array.isArray(body.tags) ? body.tags.filter((x: unknown) => typeof x === 'string').slice(0, 60) : [];
    const brief = typeof body.brief === 'string' ? body.brief.slice(0, 2000) : '';
    const p = recommendFlavorProfile({ tags, brief, locale: baseL });
    const nameOf = {
      micro: (id: string) => localizeFlavor('micro', id, lang, { name: (FLAVOR_META as any)[id]?.[baseL === 'en' ? 'nameEn' : 'name'] ?? id, desc: '' }).name,
      payoff: (id: string) => localizeFlavor('payoff', id, lang, { name: (PAYOFF_FLAVOR_META as any)[id]?.[baseL === 'en' ? 'nameEn' : 'name'] ?? id, desc: '' }).name,
      reversal: (id: string) => localizeFlavor('reversal', id, lang, { name: (REVERSAL_FLAVOR_META as any)[id]?.[baseL === 'en' ? 'nameEn' : 'name'] ?? id, desc: '' }).name,
      emotion: (id: string) => localizeFlavor('emotion', id, lang, { name: (EMOTION_FLAVOR_META as any)[id]?.[baseL === 'en' ? 'nameEn' : 'name'] ?? id, desc: '' }).name,
    };
    res.json({
      lang,
      microFlavors: p.microFlavors.map((id) => ({ id, name: nameOf.micro(id) })),
      payoffFlavors: p.payoffFlavors.map((id) => ({ id, name: nameOf.payoff(id) })),
      reversalFlavors: p.reversalFlavors.map((id) => ({ id, name: nameOf.reversal(id) })),
      emotionFlavors: p.emotionFlavors.map((id) => ({ id, name: nameOf.emotion(id) })),
      matched: p.matched,
      reasons: localizeFlavorReasons(p.matched, p.reasons, lang),
    });
  } catch (e: any) {
    res.status(400).json({ error: `风味推荐失败：${String(e?.message ?? e)}` });
  }
});
// v2.27 钩子策略推荐（不生成剧本、不耗积分）：按梗概/标签/模式返回系统默认策略与“为什么”，也可校验用户自选
generateRouter.post('/hook-strategy/recommend', authRequired, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const lang = normalizeUiLang(body.lang);
    const baseLang = lang === 'zh' ? 'zh' : 'en';
    const tags = Array.isArray(body.tags) ? body.tags.filter((x: unknown) => typeof x === 'string').slice(0, 80) : [];
    const text = typeof body.brief === 'string' ? body.brief.slice(0, 3000) : '';
    const mode = typeof body.mode === 'string' ? body.mode : '';
    // 用户显式选了合法策略则尊重，并给出该策略说明；否则系统智能推荐
    const wanted = typeof body.strategy === 'string' ? body.strategy : '';
    if (wanted && !isValidHookStrategy(wanted)) return res.status(400).json({ error: lang === 'en' ? 'Unknown hook strategy' : (lang === 'zh' ? '未知钩子策略' : 'Unknown hook strategy') });
    const rec = wanted ? null : recommendStrategy({ text, tags, mode });
    const id = (wanted || rec!.id) as any;
    const baseCard = listStrategies(lang === 'zh' ? 'zh' : 'en').find((x) => x.id === id)!;
    const card = localizeList('hook', [baseCard], lang)[0];
    const reason = rec ? (lang === 'en' ? rec.reasonEn : (lang === 'zh' ? rec.reason : localizeReason(lang, card, rec.auto))) : '';
    res.json({ lang, strategy: card, auto: !wanted, reason });
  } catch (e: any) {
    res.status(400).json({ error: `钩子策略推荐失败：${String(e?.message ?? e)}` });
  }
});
// v2.56 钩子调色板：逐结构位给出「系统默认+2备选+双语理由」，并可把用户点选转成合法 manual（纯本地确定性，不耗积分）
generateRouter.post('/hooks/palette', authRequired, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const lang = normalizeUiLang(body.lang);
    const episodeCount = Number(body.episodeCount ?? 1);
    const scenesPerEp = Number(body.scenesPerEp ?? 4);
    if (!Number.isFinite(episodeCount) || !Number.isFinite(scenesPerEp)) return res.status(400).json({ error: '集数/场次数值不合法' });
    const tags = Array.isArray(body.tags) ? body.tags.filter((x: unknown) => typeof x === 'string').slice(0, 80) : [];
    const strategy = typeof body.strategy === 'string' && isValidHookStrategy(body.strategy) ? body.strategy : undefined;
    const strength = ['relax', 'balanced', 'tight'].includes(body.strength) ? body.strength as Strength : undefined;
    const palette = buildHookPalette({ episodeCount, scenesPerEp, tags, strategy, strength });
    // 可选：同时提交用户点选，返回清洗后的 manual（供前端直接塞进 hookPref）
    let manual: Record<number, string> | undefined; let rejected: string[] = [];
    if (body.picks && typeof body.picks === 'object') {
      const r = palettePicksToManual(palette, body.picks as Record<string, string>);
      manual = r.manual; rejected = r.rejected;
    }
    // 英文输出：把位置标签/理由/微钩风味本地化为英文（id 不动）
    if (lang === 'en') {
      res.json({
        lang, strategy: { id: palette.strategy.id, auto: palette.strategy.auto, reason: palette.strategy.reason.en }, strength: palette.strength,
        positions: palette.positions.map((p) => ({
          pos: p.pos, kind: p.kind, ep: p.ep, scene: p.scene,
          label: p.label.en,
          systemDefault: locOpt(p.systemDefault),
          alternatives: p.alternatives.map(locOpt),
          validIds: p.validIds,
        })),
        microFlavors: palette.microFlavors.map((f) => ({ id: f.id, name: f.nameEn, desc: f.descEn })),
        note: palette.note.en,
        ...(manual ? { manual, rejected } : {}),
      });
      return;
    }
    res.json({
      lang, strategy: palette.strategy, strength: palette.strength,
      positions: palette.positions.map((p) => ({
        pos: p.pos, kind: p.kind, ep: p.ep, scene: p.scene,
        label: p.label.zh,
        systemDefault: { ...p.systemDefault, reason: p.systemDefault.reason.zh },
        alternatives: p.alternatives.map((a) => ({ ...a, reason: a.reason.zh })),
        validIds: p.validIds,
      })),
      microFlavors: palette.microFlavors.map((f) => ({ id: f.id, name: f.name, desc: f.desc })),
      note: palette.note.zh,
      ...(manual ? { manual, rejected } : {}),
    });
  } catch (e: any) {
    res.status(400).json({ error: `钩子调色板生成失败：${String(e?.message ?? e)}` });
  }
});
function locOpt(o: { id: string; layer: string; score: number; name: string; nameEn: string; definition: string; definitionEn: string; example: string; reason: { zh: string; en: string } }) {
  const enExample = describeHook(o.id, 'en')?.example ?? o.example;
  return { id: o.id, layer: o.layer, score: o.score, name: o.nameEn, definition: o.definitionEn, example: enExample, reason: o.reason.en };
}
// v2.57 逐集反转/爽点/情绪节拍调色板（与钩子调色板同构：系统默认+2备选、双语、确定性、不耗积分）
generateRouter.post('/beats/palette', authRequired, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const lang = normalizeUiLang(body.lang);
    const episodeCount = Number(body.episodeCount ?? 1);
    if (!Number.isFinite(episodeCount)) return res.status(400).json({ error: '集数数值不合法' });
    const tags = Array.isArray(body.tags) ? body.tags.filter((x: unknown) => typeof x === 'string').slice(0, 80) : [];
    const strength = ['relax', 'balanced', 'tight'].includes(body.strength) ? body.strength as Strength : undefined;
    // 透传用户已选的偏好/风味（manual 永不从客户端透传，只由本接口的 picks 现算）
    const inPref = body.pref && typeof body.pref === 'object' ? body.pref as Record<string, unknown> : {};
    const pref = {
      preferred: Array.isArray(inPref.preferred) ? (inPref.preferred as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
      avoid: Array.isArray(inPref.avoid) ? (inPref.avoid as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
      payoffFlavors: Array.isArray(inPref.payoffFlavors) ? inPref.payoffFlavors as string[] : [],
      reversalFlavors: Array.isArray(inPref.reversalFlavors) ? inPref.reversalFlavors as string[] : [],
      emotionFlavors: Array.isArray(inPref.emotionFlavors) ? inPref.emotionFlavors as string[] : [],
    };
    const palette = buildBeatPalette({ episodeCount, tags, strength, pref });
    let manual: Record<number, string> | undefined; let rejected: string[] = [];
    if (body.picks && typeof body.picks === 'object') {
      const r = beatPicksToManual(palette, body.picks as Record<string, string>);
      manual = r.manual; rejected = r.rejected;
    }
    const locSlotOpt = (o: typeof palette.episodes[0]['slots'][0]['systemDefault']) => ({
      id: o.id, kind: o.kind, score: o.score,
      name: lang === 'en' ? o.nameEn : o.name,
      definition: lang === 'en' ? o.definitionEn : o.definition,
      technique: lang === 'en' ? o.techniqueEn : o.technique,
      example: lang === 'en' ? o.exampleEn : o.example,
      reason: lang === 'en' ? o.reason.en : o.reason.zh,
    });
    res.json({
      lang, strength: palette.strength, mode: palette.mode,
      episodes: palette.episodes.map((ep) => ({
        ep: ep.ep,
        slots: ep.slots.map((s) => ({
          pos: s.pos, kind: s.kind, ep: s.ep, slot: s.slot,
          label: lang === 'en' ? s.label.en : s.label.zh,
          systemDefault: locSlotOpt(s.systemDefault),
          alternatives: s.alternatives.map(locSlotOpt),
          validIds: s.validIds,
        })),
      })),
      note: lang === 'en' ? palette.note.en : palette.note.zh,
      ...(manual ? { manual, rejected } : {}),
    });
  } catch (e: any) {
    res.status(400).json({ error: `节拍调色板生成失败：${String(e?.message ?? e)}` });
  }
});

// v2.58 全剧情绪波形事前编排器：生成前预览曲线 + 区间框选连改（确定性、不耗积分）
generateRouter.post('/emotion/director', authRequired, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const lang = normalizeUiLang(body.lang);
    const episodeCount = Number(body.episodeCount ?? 1);
    if (!Number.isFinite(episodeCount)) return res.status(400).json({ error: '集数数值不合法' });
    const strength = ['relax', 'balanced', 'tight'].includes(body.strength) ? body.strength as Strength : undefined;
    const inPref = body.pref && typeof body.pref === 'object' ? body.pref as Record<string, unknown> : {};
    // 客户端既有定点只经白名单清洗（normalizeBeatPref 校验键区间与合法 id），不直接信任
    const pinsIn = body.pins && typeof body.pins === 'object' ? body.pins as Record<string, unknown> : {};
    const manual: Record<number, string> = {};
    for (const [k, v] of Object.entries(pinsIn)) if (typeof v === 'string') manual[Number(k)] = v;
    const pref = {
      mode: 'hybrid' as const,
      preferred: Array.isArray(inPref.preferred) ? (inPref.preferred as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
      avoid: Array.isArray(inPref.avoid) ? (inPref.avoid as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
      payoffFlavors: Array.isArray(inPref.payoffFlavors) ? inPref.payoffFlavors as string[] : [],
      reversalFlavors: Array.isArray(inPref.reversalFlavors) ? inPref.reversalFlavors as string[] : [],
      emotionFlavors: Array.isArray(inPref.emotionFlavors) ? inPref.emotionFlavors as string[] : [],
      manual,
    };
    const intent = typeof body.intent === 'string' && (WAVE_INTENTS as string[]).includes(body.intent) ? body.intent as never : null;
    const from = Number(body.from); const to = Number(body.to);
    const result = buildWaveDirector({
      episodeCount, strength, pref, intent,
      from: Number.isFinite(from) ? from : undefined,
      to: Number.isFinite(to) ? to : undefined,
    }, lang === 'en' ? 'en' : 'zh');
    const locWave = (w: NonNullable<typeof result.waveAfter>) => localizeEmotionWave(w, lang);
    res.json({
      lang,
      episodeCount: result.episodeCount,
      strength: result.strength,
      intents: result.intents.map((m) => ({ id: m.id, name: lang === 'en' ? m.nameEn : m.name, desc: lang === 'en' ? m.descEn : m.desc, triple: m.triple })),
      waveBefore: locWave(result.waveBefore),
      waveAfter: result.waveAfter ? locWave(result.waveAfter) : null,
      patch: result.patch ? {
        intent: result.patch.intent, from: result.patch.from, to: result.patch.to,
        manual: result.patch.manual, affectedEps: result.patch.affectedEps, overwritten: result.patch.overwritten,
      } : null,
      note: lang === 'en' ? result.note.en : result.note.zh,
    });
  } catch (e: any) {
    res.status(400).json({ error: `情绪波形编排失败：${String(e?.message ?? e)}` });
  }
});
// v2.28 节奏/台词策略目录（用户选项 vs 系统默认，不耗积分）
generateRouter.get('/creation-strategies', authRequired, async (req: AuthRequest, res) => {
  const lang = normalizeUiLang(req.query.lang);
  const base = lang === 'zh' ? 'zh' : 'en';
  res.json({
    lang,
    pace: localizeList('pace', listPace(base), lang),
    dialogue: localizeList('dialogue', listDialogue(base), lang),
    emotion: localizeList('emotion', listEmotion(base), lang),
    character: localizeList('character', listCharacter(base), lang),
  });
});
generateRouter.post('/creation-strategy/recommend', authRequired, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const lang = normalizeUiLang(body.lang);
    const baseLang = lang === 'zh' ? 'zh' : 'en';
    const tags = Array.isArray(body.tags) ? body.tags.filter((x: unknown) => typeof x === 'string').slice(0, 80) : [];
    const text = typeof body.brief === 'string' ? body.brief.slice(0, 3000) : '';
    const mode = typeof body.mode === 'string' ? body.mode : '';
    const ctx = { text, tags, mode };
    // 用户显式选择则校验并尊重，否则系统推荐
    const paceWanted = typeof body.pace === 'string' ? body.pace : '';
    const dlgWanted = typeof body.dialogue === 'string' ? body.dialogue : '';
    const emoWanted = typeof body.emotion === 'string' ? body.emotion : '';
    const charWanted = typeof body.character === 'string' ? body.character : '';
    if (paceWanted && !isValidPace(paceWanted)) return res.status(400).json({ error: lang === 'en' ? 'Unknown pacing strategy' : '未知节奏策略' });
    if (dlgWanted && !isValidDialogue(dlgWanted)) return res.status(400).json({ error: lang === 'en' ? 'Unknown dialogue strategy' : '未知台词策略' });
    if (emoWanted && !isValidEmotion(emoWanted)) return res.status(400).json({ error: lang === 'en' ? 'Unknown emotion strategy' : '未知情绪策略' });
    if (charWanted && !isValidCharacter(charWanted)) return res.status(400).json({ error: lang === 'en' ? 'Unknown character strategy' : '未知人物策略' });
    const paceRec = recommendPace(ctx), dlgRec = recommendDialogue(ctx), emoRec = recommendEmotion(ctx), charRec = recommendCharacter(ctx);
    const paceId = paceWanted || paceRec.id, dlgId = dlgWanted || dlgRec.id, emoId = emoWanted || emoRec.id, charId = charWanted || charRec.id;
    const pick = (arr: any[], id: string) => arr.find((x) => x.id === id);
    const rsn = (rec: { auto: boolean; reason: string; reasonEn: string }, card: any) =>
      rec ? (lang === 'en' ? rec.reasonEn : (lang === 'zh' ? rec.reason : localizeReason(lang, card, rec.auto))) : '';
    const paceCard = localizeList('pace', [pick(listPace(baseLang), paceId)!], lang)[0];
    const dlgCard = localizeList('dialogue', [pick(listDialogue(baseLang), dlgId)!], lang)[0];
    const emoCard = localizeList('emotion', [pick(listEmotion(baseLang), emoId)!], lang)[0];
    const charCard = localizeList('character', [pick(listCharacter(baseLang), charId)!], lang)[0];
    res.json({
      lang,
      pace: { card: paceCard, auto: !paceWanted, reason: paceWanted ? '' : rsn(paceRec, paceCard) },
      dialogue: { card: dlgCard, auto: !dlgWanted, reason: dlgWanted ? '' : rsn(dlgRec, dlgCard) },
      emotion: { card: emoCard, auto: !emoWanted, reason: emoWanted ? '' : rsn(emoRec, emoCard) },
      character: { card: charCard, auto: !charWanted, reason: charWanted ? '' : rsn(charRec, charCard) },
    });
  } catch (e: any) {
    res.status(400).json({ error: `创作策略推荐失败：${String(e?.message ?? e)}` });
  }
});
// 我的项目列表（作品库）
generateRouter.get('/projects', authRequired, async (req: AuthRequest, res) => {
  const where: any = { userId: req.userId!, status: { not: 'deleted' } };
  const q = (req.query.q as string | undefined)?.trim();
  if (q) where.title = { contains: q, mode: 'insensitive' };
  const status = req.query.status as string | undefined;
  if (status && ['active', 'archived', 'draft'].includes(status)) where.status = status;
  const mode = req.query.mode as string | undefined;
  if (mode) where.mode = mode;
  const list = await prisma.project.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(list);
});

// 重命名项目（仅本人）
generateRouter.put('/projects/:id', authRequired, async (req: AuthRequest, res) => {
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  if (title.length > 80) return res.status(400).json({ error: '标题不超过 80 字' });
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const updated = await prisma.project.update({ where: { id: project.id }, data: { title } });
  res.json({ id: updated.id, title: updated.title });
});

// v2.199 归档/取消归档：归档项目不占 active 额度，可随时恢复（不删数据）
generateRouter.post('/projects/:id/archive', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const toArchived = req.body?.archive !== false; // 默认归档；传 archive:false 则恢复
  const updated = await prisma.project.update({ where: { id: project.id }, data: { status: toArchived ? 'archived' : 'active' } });
  res.json({ id: updated.id, status: updated.status });
});

// 软删除项目（status=deleted，列表过滤；可后续加恢复端点）
generateRouter.delete('/projects/:id', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  // v2.293 删除竞态防线：有在途生成任务的项目拒绝删除——在途任务已冻结积分，
  // 跑完 settle 实扣后成果落进已删项目（列表过滤永远看不到），用户钱扣了成果也看不到。
  // 要么等任务完成，要么先调 /tasks/:id/cancel 取消（取消即解冻退款）再删。
  // 35 分钟窗口与 v2.292 同口径自愈：全局硬超时 30 分钟 + 收尾余量，
  // 进程崩溃残留的 RUNNING 行（进程已死永远不会再收尾）不得永久锁死删除。
  const inflightSince = new Date(Date.now() - 35 * 60_000);
  const inflight = await prisma.generationTask.count({
    where: { projectId: project.id, status: { in: ['QUEUED', 'RUNNING'] }, createdAt: { gte: inflightSince } },
  });
  if (inflight > 0) {
    return res.status(409).json({ code: 'PROJECT_HAS_RUNNING_TASK', error: '有剧集正在生成中，请等待生成完成或先取消任务后再删除项目' });
  }
  await prisma.project.update({ where: { id: project.id }, data: { status: 'deleted' } });
  res.json({ ok: true, id: project.id });
});

// v2.198 项目克隆：复制源项目的 bible/tags/mode/format 等创作骨架，开新项目（不复制成稿分集/消耗记录）
generateRouter.post('/projects/:id/clone', authRequired, async (req: AuthRequest, res) => {
  const src = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!src) return res.status(404).json({ error: '源项目不存在' });
  const newTitle = (req.body?.title || '').trim() || `${src.title} - 副本`;
  if (newTitle.length > 80) return res.status(400).json({ error: '标题不超过 80 字' });
  // 项目数量限制（内部账户不限项目数）
  const owner = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true, phone: true, isAdmin: true } });
  const limit = activeProjectLimit(owner?.level);
  const mine = await prisma.project.findMany({ where: { userId: req.userId! }, select: { status: true } });
  const activeCount = mine.filter((x: any) => x.status !== 'archived').length;
  if (!isAdminUser(owner as { phone?: string | null; isAdmin?: boolean } | null) && activeCount >= limit) {
    return res.status(403).json({ error: 'REACH_PROJECT_LIMIT', activeCount, limit, message: `当前会员最多同时进行 ${limit} 个剧本项目` });
  }
  // 分级备案沿用源项目判定（format/mode 不变）
  const fmt = (src.format as string) || 'LIVE_ACTION';
  const filing = classifyFiling({ specialTopic: (src as any).specialTopic ?? false, isAI: fmt === 'AIGC', investWan: (src as any).investWan });
  // 仅复制创作骨架：bible/tags/mode/format/画风/镜头，不复制 scripts/tokens/feedback
  const cloned = await prisma.project.create({
    data: {
      userId: req.userId!,
      title: newTitle,
      synopsis: (req.body?.synopsis as string) || src.synopsis || '',
      mode: src.mode,
      format: fmt,
      tags: src.tags || [],
      bible: src.bible || {},
      status: 'active',
      filing,
    },
    select: { id: true, title: true, mode: true, format: true, tags: true },
  });
  res.json({ ...cloned, clonedFrom: src.id });
});
// 某项目下全部剧本（仅本人可读全文；作品库点进去看分集）
generateRouter.get('/projects/:id/scripts', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const scripts = await prisma.script.findMany({
    where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
  });
  res.json(scripts);
});

// c202 改写前后版本对比：行级 LCS 只读端点（零扣费、确定性，不调模型）。
// 用户为 /fix 付了积分，旧版行也一直保留，必须能逐行看到小南改了什么，而不是只拿到一个新文本。
// 权限与 /scripts 一致（仅本人）；to 省略时默认该集最新版；对比结果本就是用户自己的两版文本，无新增信息泄露面。
generateRouter.get('/projects/:id/scripts/diff', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const epNo = Number(req.query.epNo);
  const fromV = Number(req.query.from);
  // to 缺省（undefined 或空串）→ 取该集最新版；显式给了就必须是正整数
  const toRaw = req.query.to;
  const toV = toRaw === undefined || toRaw === '' ? null : Number(toRaw);
  if (!Number.isInteger(epNo) || epNo < 1
    || !Number.isInteger(fromV) || fromV < 1
    || (toV !== null && (!Number.isInteger(toV) || toV < 1))) {
    return res.status(400).json({ error: '参数不合法' });
  }
  const rows = await prisma.script.findMany({ where: { projectId: project.id, epNo }, orderBy: { version: 'asc' } });
  if (!rows.length) return res.status(400).json({ error: 'VERSION_NOT_FOUND', message: '该分集不存在' });
  const targetTo = toV === null ? rows[rows.length - 1].version : toV;
  if (fromV === targetTo) return res.status(400).json({ error: 'SAME_VERSION', message: 'from 与 to 不能是同一版本' });
  const fromRow = rows.find((s: any) => s.version === fromV);
  const toRow = rows.find((s: any) => s.version === targetTo);
  if (!fromRow || !toRow) return res.status(400).json({ error: 'VERSION_NOT_FOUND', message: '指定版本不存在' });
  // c203 D4：O(nm) DP 有行数硬上限，超限时给可识别 400（只读、零扣费），前端改走全文查看
  let segments: any[], stats: any;
  try {
    ({ segments, stats } = diffScripts(fromRow.content, toRow.content));
  } catch (e: any) {
    if (e?.code === 'SCRIPT_TOO_LARGE') {
      return res.status(400).json({ error: 'SCRIPT_TOO_LARGE', message: '剧本过长，暂不支持在线逐行对比，可直接查看最新版全文' });
    }
    throw e;
  }
  res.json({
    epNo,
    from: { version: fromRow.version, wordCount: fromRow.wordCount },
    to: { version: toRow.version, wordCount: toRow.wordCount },
    segments, stats,
    span: assessRewrite(fromRow.content, toRow.content),
    // c204：零 token 变更摘要（台词/动作分类计数 + 亮点），纯函数对脏 segments 不抛错
    summary: summarizeChanges(segments),
  });
});

// v2.64 导演交付包预览：导出前先看情绪波形/钩子地图/兑现链/人物成长四页，登录即可（鼓励下载正式 docx/pdf）
generateRouter.get('/projects/:id/director-pack', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const scripts = await prisma.script.findMany({
    where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
  });
  if (!scripts.length) return res.status(400).json({ error: '还没有分集，先生成至少一集再预览导演交付包' });
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true, penName: true } });
  const level = ((me?.level ?? MemberLevel.FREE) as MemberLevel);
  const doc = buildScriptDoc(project, scripts, { penName: me?.penName, level });
  // v2.155 物料清单页进导演交付包（同块流过滤，零结构改动）
  const DIRECTOR_TITLES = ['情绪节奏图', '钩子地图', '兑现链', '人物表与成长弧', '制作物料清单', 'Emotion Rhythm', 'Hook Map', 'Payoff', 'Cast & Growth', 'Production Materials'];
  const pages: { title: string; type: string; lines: string[]; wave?: unknown }[] = [];
  let cur: { title: string; type: string; lines: string[]; wave?: unknown } | null = null;
  const typeOf = (t: string) =>
    t.includes('情绪') || t.includes('Emotion') ? 'wave'
    : t.includes('钩子') || t.includes('Hook') ? 'hook'
    : t.includes('兑现') || t.includes('Payoff') ? 'chain'
    : t.includes('人物') || t.includes('Cast') ? 'cast'
    : t.includes('物料') || t.includes('Materials') ? 'materials' : 'other';
  for (const b of doc.blocks) {
    if (b.kind === 'epStart') { cur = null; continue; }
    if (b.kind === 'h1') {
      if (DIRECTOR_TITLES.some((k) => b.text.includes(k))) {
        cur = { title: b.text, type: typeOf(b.text), lines: [] };
        pages.push(cur);
      } else {
        cur = null;
      }
      continue;
    }
    if (!cur) continue;
    if (b.kind === 'p') cur.lines.push(b.text);
    else if (b.kind === 'waveChart') cur.wave = b.wave;
  }
  res.json({ projectId: project.id, episodeCount: scripts.length, pages });
});

/**
 * 剧本价值证书（v2.69）：纯本地确定性评估，查看免费、零 token 边际成本。
 * 融合六维创作分 + 资方视角分 → 价值指数/等级/参考价值区间/亮点/风险/可分享梗概文案。
 * 明确标注算法参考、非成交承诺；分享文案不含剧本全文。
 */
generateRouter.get('/projects/:id/value-card', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const scripts = await prisma.script.findMany({
    where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
  });
  if (!scripts.length) return res.status(400).json({ error: '还没有分集，先生成至少一集再生成价值证书' });
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { penName: true } });
  const bible = (project as any).bible;
  const synopsis = normalizeBibleDoc(bible).timeline[0] || scripts[0]?.synopsis || null; // v2.193 c193：timeline 字符串/数组同源归一，防首字符污染
  const lang = (req.query.lang === 'en' ? 'en' : 'zh') as 'zh' | 'en';
  const card = buildScriptValue({
    title: project.title,
    penName: me?.penName ?? null,
    tags: project.tags ?? [],
    contents: scripts.map((s: any) => s.content || ''),
    synopsis,
    lang,
  });
  res.json({ ok: true, projectId: project.id, card });
});

// v2.70 立项前「智能默认」预览：零 LLM、免费，让用户在付费生成前看到系统默认了什么、为什么（可改）
const smartDefaultsSchema = z.object({
  tags: z.array(z.string().max(30)).max(24).optional(),
  mode: z.string().max(40).optional(),
  scriptMode: z.enum(['LIVE', 'AIGC']).optional(),
  lang: z.enum(['zh', 'en']).optional(),
  personalized: z.boolean().optional(),
  boardRegion: z.enum(['domestic', 'overseas', 'all']).optional(),
});
generateRouter.post('/smart-defaults', authRequired, async (req: AuthRequest, res) => {
  const p = smartDefaultsSchema.safeParse(req.body ?? {});
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? '参数不合法' });
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: '请先登录' });
  // 画像：简介（可推断地域/年龄/性别）+ 历史创作标签（越用越懂），不做越权画像
  const myProjects = await prisma.project.findMany({ where: { userId: user.id }, select: { tags: true }, take: 20 });
  const pastTags = myProjects
    .flatMap((pr: any) => (Array.isArray(pr.tags) ? pr.tags : []))
    .map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 12);
  const freshBoard = boardStore.getFresh(); // 仅用保鲜期内真实榜单；空仓诚实不倾斜
  const personalized = p.data.personalized ?? ((user as any).personalized !== false);
  const defaults = buildSmartDefaults({
    tags: p.data.tags ?? [],
    mode: p.data.mode,
    scriptMode: p.data.scriptMode,
    lang: p.data.lang ?? 'zh',
    personalized,
    boardRegion: p.data.boardRegion ?? 'all',
    board: freshBoard as never,
    profile: toEngineUserProfile({ ...(user as any), personalized }, pastTags),
  });
  res.json({ ok: true, defaults, boardStatus: boardStore.status() });
});
// 单集正文（校验项目归属本人）
generateRouter.get('/scripts/:id', authRequired, async (req: AuthRequest, res) => {
  const sc = await prisma.script.findUnique({ where: { id: req.params.id } });
  if (!sc) return res.status(404).json({ error: '剧本不存在' });
  const project = await prisma.project.findFirst({ where: { id: sc.projectId, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(403).json({ error: '无权查看该剧本' });
  res.json(sc);
});

// c208：取项目下"每集最新版本"中真正有可朗读正文的集（口径与 /diagnosis、作品页 latestEps 一致：
// epNo 升序、同 epNo 取最大 version），供连播邻接与全本片单共用。纯本地确定性构建，零模型零扣费。
// 空正文/纯台账集直接排除——自动连播绝不能把用户带进一个返回 400 的死集。
async function buildPlayableEpisodes(projectId: string, lang: 'zh' | 'en') {
  const rows = await prisma.script.findMany({
    where: { projectId }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
  });
  const latest = new Map<number, any>();
  for (const s of rows) latest.set(s.epNo, s); // version 升序，后者（最新版）覆盖旧版
  const out: { script: any; listen: ReturnType<typeof buildListenScript> }[] = [];
  for (const script of [...latest.values()].sort((a, b) => a.epNo - b.epNo)) {
    const listen = buildListenScript(script.content || '', { lang });
    if (listen.segments.length) out.push({ script, listen });
  }
  return out;
}

// v2.55 听剧本：高级会员及以上权益，本地确定性生成 TTS 朗读脚本，不额外扣积分
generateRouter.get('/scripts/:id/listen', authRequired, async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
  const level = ((me?.level ?? MemberLevel.FREE) as MemberLevel);
  const gate = assistantGate(level, 'listen_script');
  if (!gate.allowed) return res.status(403).json({ error: 'ASSISTANT_LEVEL_REQUIRED', needLevel: gate.needLevel, upsell: gate.upsell });
  const sc = await prisma.script.findUnique({ where: { id: req.params.id } });
  if (!sc) return res.status(404).json({ error: '剧本不存在' });
  const project = await prisma.project.findFirst({ where: { id: sc.projectId, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(403).json({ error: '无权查看该剧本' });
  const outLang = normalizeUiLang(typeof req.query.lang === 'string' ? req.query.lang : 'zh');
  const listenLang = outLang === 'en' ? 'en' : 'zh';
  const listen = buildListenScript(sc.content || '', { lang: listenLang });
  if (!listen.segments.length) return res.status(400).json({ error: '该集暂无可朗读正文' });
  // c208：同片单邻接（只含可播放最新版集）。增强查询任何意外都不得拖垮单集朗读稿主交易。
  let neighbors: { prevScriptId: string | null; nextScriptId: string | null; epPos: number; epCount: number } = {
    prevScriptId: null, nextScriptId: null, epPos: 1, epCount: 1,
  };
  try {
    const playable = await buildPlayableEpisodes(project.id, listenLang);
    const pos = playable.findIndex((e) => e.script.id === sc.id);
    if (pos >= 0) {
      neighbors = {
        prevScriptId: pos > 0 ? playable[pos - 1].script.id : null,
        nextScriptId: pos < playable.length - 1 ? playable[pos + 1].script.id : null,
        epPos: pos + 1, epCount: playable.length,
      };
    }
  } catch { /* 邻接是连播增强：失败时退化为单集模式，前端 nextScriptId=null 即不自动跨集 */ }
  // c207：cast 是挂在朗读稿主交易上的观测增强，构建器虽已全容错，挂载点仍兜底 try/catch——
  // 声线表任何意外都不得拖垮整篇朗读稿（㉜ 增强自身零抛错），前端对 cast=null 有旁白声线回退
  let cast = null;
  try { cast = buildVoiceCast(listen.speakerSet, { lang: listenLang }); } catch { cast = null; }
  res.json({
    scriptId: sc.id, epNo: sc.epNo, title: sc.title || '',
    ...listen,
    // c206：确定性多角色声线（音高/语速/选声语言），供前端浏览器原生 TTS 分角色播放，零模型零扣费
    cast,
    note: listenEntitleNote(listenLang),
    // c208：整剧连播所需的项目归属与片单邻接
    projectId: project.id, neighbors,
    // c206：播放改由前端浏览器内置 speechSynthesis 完成（是否可用以浏览器特性检测为准）；
    // 云端真人 TTS 仍未配置，ttsReady 语义不变（false），保留给旧前端展示提示
    ttsReady: false,
  });
});

// c208 整剧连播片单：仅返回每集最新版、有可朗读正文的集元信息（不内嵌正文 segments——
// 播放器逐集懒加载 /scripts/:id/listen，片单再大也轻；选集下拉/续听定位/总时长展示用）。
// 权益与归属闸门同单集听剧本；只读、零扣费、不调模型。
generateRouter.get('/projects/:id/listen/playlist', authRequired, async (req: AuthRequest, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
  const level = ((me?.level ?? MemberLevel.FREE) as MemberLevel);
  const gate = assistantGate(level, 'listen_script');
  if (!gate.allowed) return res.status(403).json({ error: 'ASSISTANT_LEVEL_REQUIRED', needLevel: gate.needLevel, upsell: gate.upsell });
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const outLang = normalizeUiLang(typeof req.query.lang === 'string' ? req.query.lang : 'zh');
  const listenLang = outLang === 'en' ? 'en' : 'zh';
  // 与 /listen 邻接同一口径（最新版 + 有可朗读正文），另查总数只为给出被跳过集数
  const [allLatest, playable] = await Promise.all([
    prisma.script.findMany({
      where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
    }),
    buildPlayableEpisodes(project.id, listenLang),
  ]);
  const latestCount = new Set(allLatest.map((s: any) => s.epNo)).size;
  if (!playable.length) return res.status(400).json({ error: '还没有可朗读的分集，请先生成至少一集' });
  const episodes = playable.map(({ script, listen }) => ({
    scriptId: script.id, epNo: script.epNo, title: script.title || '', version: script.version,
    segCount: listen.segments.length, dialogueCount: listen.dialogueCount,
    totalChars: listen.totalChars, estSeconds: listen.estSeconds,
  }));
  const totalSeconds = playable.reduce((sum, e) => sum + e.listen.estSeconds, 0);
  res.json({
    projectId: project.id, title: project.title || '', lang: listenLang,
    episodes, totalEps: episodes.length, skippedEps: latestCount - episodes.length,
    totalSeconds: Math.round(totalSeconds * 10) / 10,
  });
});
// 全本质量诊断：对项目下已生成集统一跑 craft/emotion/webnovel/去AI 四套尺子，归一六维评分+优先修改清单
// 只读、不调用模型、不消耗积分；逐集修改后可重复调用刷新
generateRouter.get('/projects/:id/diagnosis', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const scripts = await prisma.script.findMany({
    where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
  });
  if (!scripts.length) return res.status(400).json({ error: '还没有可诊断的分集，请先生成至少一集' });
  // 每集只取最新版本参与全本诊断（已按 version 升序，后者覆盖前者）
  const latest = new Map<number, { epNo: number; title: string; content: string }>();
  scripts.forEach((s: any) => latest.set(s.epNo, { epNo: s.epNo, title: s.title || '', content: s.content || '' }));
  const dlang = normalizeUiLang(typeof req.query.lang === 'string' ? req.query.lang : 'zh');
  const joined = [...latest.values()].map((x) => x.content).join('');
  const lintLang = /[\u4e00-\u9fff]/.test(joined) ? 'zh' : 'en'; // 检测词随正文语言，展示标签随输出语言
  const diagnosis = localizeDiagnosis(diagnoseFull([...latest.values()], {}, lintLang), dlang);
  res.json({ projectId: project.id, ...diagnosis });
});

// v2.38 全剧情绪曲线波形（确定性，与管线逐集节拍同源；不耗积分）
generateRouter.get('/projects/:id/emotion-wave', authRequired, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const scriptCount = await prisma.script.count({ where: { projectId: project.id } });
  const planned = (project as { totalEps?: number }).totalEps ?? 0;
  const n = Math.max(1, planned || scriptCount || 1);
  let storedPref: unknown = undefined;
  try { storedPref = (project.bible as { beatPrefs?: unknown } | null)?.beatPrefs; } catch { storedPref = undefined; }
  const wave0 = buildEmotionWave(n, normalizeBeatPref(storedPref as never));
  const wlang = normalizeUiLang(typeof req.query.lang === 'string' ? req.query.lang : 'zh');
  const baseL = wlang === 'en' ? 'en' : 'zh';
  const advices0 = wave0.points.map((p) => adviseWavePoint(wave0, p.ep, baseL)).filter(Boolean) as NonNullable<ReturnType<typeof adviseWavePoint>>[];
  const wave = localizeEmotionWave(wave0, wlang);
  const advices = localizeWaveAdviceList(advices0, wave0, wlang);
  // v2.80 全剧装置疲劳：复现逐集节拍点（与波形同源、确定性）喂给疲劳分析，输出连用/单调/种类不足预警
  const fatigue = deviceFatigue(
    wave0.points.map((pt) => ({ ep: pt.ep, reversalId: pt.reversal?.id ?? null, payoffIds: pt.payoffs.map((x) => x.id), emotionPath: pt.path.map((x) => x.id) })),
    baseL,
  );
  res.json({ projectId: project.id, ...wave, advices, fatigue });
});

// 诊断→一键针对性优化：按一条诊断问题自动定位最差集，只重写该集并落新版本（增值计费，失败自动退款）
const fixSchema = z.object({
  fix: z.object({
    rule: z.string().min(1).max(60),
    dimLabel: z.string().max(20),
    advice: z.string().min(1).max(500),
  }),
  epNo: z.number().int().min(1).max(500).optional(), // v2.39 波形点集改稿：用户显式指定要改哪一集
  // 安全：幂等键一律由服务端按 用户+目标版本+规则 确定性生成，不接受客户端传入（防重放套利）
});
generateRouter.post('/projects/:id/fix', authRequired, async (req: AuthRequest, res) => {
  const parsed = fixSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '参数不合法' });
  const { fix, epNo: wantedEp } = parsed.data;
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId!, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  const scripts = await prisma.script.findMany({
    where: { projectId: project.id }, orderBy: [{ epNo: 'asc' }, { version: 'asc' }],
  });
  if (!scripts.length) return res.status(400).json({ error: '还没有可优化的分集，请先生成至少一集' });
  // 每集最新版
  const latestMap = new Map<number, any>();
  scripts.forEach((s: any) => latestMap.set(s.epNo, s));
  const latestList = [...latestMap.values()];
  if (wantedEp !== undefined && !latestMap.has(wantedEp)) {
    return res.status(400).json({ error: '指定的分集不存在，请刷新后重试' });
  }
  // 自动定位该问题最严重的一集；v2.39 用户从波形点集显式指定时尊重用户选择
  const target = wantedEp !== undefined
    ? { epNo: wantedEp, score: null }
    : pickEpisodeForFix(latestList.map((s) => ({ epNo: s.epNo, title: s.title, content: s.content })), fix.rule);
  const targetScript = latestMap.get(target.epNo);
  if (!targetScript) return res.status(400).json({ error: '定位不到可优化的分集' });
  // 会员等级差异化定价（永不跌破成本×2）
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true, phone: true, isAdmin: true } });
  const level = (user?.level as MemberLevel) ?? MemberLevel.FREE;
  // 内部账户（超管/杨光指定的管理员）：小南全部能力免费可用，等级门直接放行
  const isStaff = isAdminUser(user as { phone?: string | null; isAdmin?: boolean } | null);
  // v2.54 小南能力硬闸门：台词/格式润色需基础会员，人设/剧情/节奏等深度优化需高级会员。
  // 安全：能力判定只信服务端规则号 fix.rule（dimLabel 仅展示用，可被客户端伪造，不参与降级判定）。
  if (!isStaff) {
    const fixGate = assistantGate(level, fixActionByDim(fix.dimLabel || '', fix.rule));
    if (!fixGate.allowed) {
      return res.status(403).json({ error: 'ASSISTANT_LEVEL_REQUIRED', needLevel: fixGate.needLevel, upsell: fixGate.upsell });
    }
  }
  const points = isStaff ? 0 : vaPointsForLevel('TARGETED_FIX', level);
  const costFen = VALUE_ADDED.TARGETED_FIX.costFen;
  // 人物名（尽量从圣经取，取不到也不阻塞）
  // v2.194 c196：旧码读 bible.cast——该字段生产从不落库（人物字段是 characters，pipeline
  // 回写为对象形态），导致 /fix 人物名恒空：buildFixPrompt 失名 + c217 二十四本连续性台账
  // 重放对角色键整体空跑（死者复活/下场反派再行动等穿帮 /fix 后永久失明）。
  // 与主生成路径同口径走 extractBibleCastNames（对象/数组/JSON 字符串三形态、cap 20），
  // 历史 cast 数组仅作回退；去重。
  let castNames: string[] = [];
  try {
    const b: any = project.bible;
    const fromCharacters = extractBibleCastNames(b?.characters);
    const fromLegacyCast = Array.isArray(b?.cast) ? extractBibleCastNames(b.cast) : [];
    castNames = [...new Set([...fromCharacters, ...fromLegacyCast])];
  } catch { castNames = []; }
  // 服务端确定性幂等：键由 用户+目标版本+规则+尝试序号 构成。
  //  - 序号=该目标版本上已提交次数(含已退款失败尝试)+1，在事务内计数：失败退款后允许再试（新键），
  //    成功后版本已更新（目标脚本变化）；并发重复请求在 Serializable 下取到同一序号→同键，只有一笔扣款成功。
  //  - 幂等命中(false)直接 409 短路，绝不再次调用模型/落库/退款（此前重放可免费反复跑模型+骗取退款）。
  let idemKey: string;
  if (isStaff) {
    // 内部账户 0 元通道：不碰余额/冻结、不校验毛利，只写一条 amount=0 的 STAFF_FREE 审计流水。
    // 幂等计数与付费路径同构（同目标版本+规则，按已存在尝试数递增）：重放 409，失败尝试后换新键可再试。
    const staffCharge = await withBillingTransaction(prisma, req.userId!, async (tx) => {
      const raw = tx.raw as any;
      const prior = await raw.ledgerEntry.findMany({
        where: { userId: req.userId!, reason: 'STAFF_FREE', refType: 'value_added', refId: `fix:${targetScript.id}` },
      });
      const key = `staff-fix:${req.userId}:${targetScript.id}:${fix.rule}:v${targetScript.version}:a${prior.length + 1}`;
      if (await tx.ledgerExists(key)) return { charged: false, idemKey: key };
      const acc = await tx.getAccount(req.userId!);
      await tx.writeLedger({
        userId: req.userId!, direction: 'OUT', bucket: 'RECHARGE', amount: 0,
        reason: 'STAFF_FREE', refType: 'value_added', refId: `fix:${targetScript.id}`,
        idempotencyKey: key, balanceAfter: acc?.balance ?? 0,
      });
      return { charged: true, idemKey: key };
    });
    if (!staffCharge.charged) {
      return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '该版本的这一项优化正在处理或已处理，请勿重复提交' });
    }
    idemKey = staffCharge.idemKey;
  } else {
    const baseIdem = `fix:${req.userId}:${targetScript.id}:${fix.rule}:v${targetScript.version}`;
    const chargeResult = await withBillingTransaction(prisma, req.userId!, async (tx) => {
      const raw = tx.raw as any;
      const prior = await raw.ledgerEntry.findMany({
        where: { userId: req.userId!, reason: 'TARGETED_FIX', refType: 'value_added', refId: `fix:${targetScript.id}` },
      });
      const key = `${baseIdem}:a${prior.length + 1}`;
      const charged = await consumeFlexible(tx, req.userId!, points, costFen, 'TARGETED_FIX', `fix:${targetScript.id}`, key);
      return { charged, idemKey: key };
    });
    if (!chargeResult.charged) {
      return res.status(409).json({ error: 'IDEMPOTENT_REPLAY', message: '该版本的这一项优化正在处理或已处理，请勿重复提交' });
    }
    idemKey = chargeResult.idemKey;
  }
  // 调用润色岗（黑盒模型，用户看不到具体API）
  let result;
  try {
    const prompt = buildFixPrompt(targetScript.content, fix, {
      scriptMode: project.format === 'AIGC' ? 'aigc' : 'live',
      castNames,
    });
    result = await callText(project.engineTier || EngineTier.STANDARD, 'polisher', prompt, { maxTokens: 2200 });
  } catch (e: any) {
    // 内部账户 0 元通道无款可退（STAFF_FREE 流水留存即失败尝试计数，换新键可重试）
    if (!isStaff) {
      await withBillingTransaction(prisma, req.userId!, (tx) =>
        refundFlexible(tx, req.userId!, points, 'TARGETED_FIX', `fix:${targetScript.id}`, idemKey));
    }
    return res.status(502).json({ error: 'MODEL_FAIL', message: isStaff ? '模型服务暂时不可用，请稍后重试' : '模型服务暂时不可用，已退回积分，请稍后重试' });
  }
  const rewritten = (result?.text || '').trim();
  // 沙盘（未配密钥）或结果不可用：不产出假文本，自动退款
  if (!result || result.sandbox || !isUsableRewrite(rewritten, targetScript.content)) {
    if (!isStaff) {
      await withBillingTransaction(prisma, req.userId!, (tx) =>
        refundFlexible(tx, req.userId!, points, 'TARGETED_FIX', `fix:${targetScript.id}`, idemKey));
    }
    return res.status(503).json({ error: result?.sandbox ? 'SANDBOX' : 'UNUSABLE', message: result?.sandbox
      ? (isStaff ? '当前为无密钥沙盘，配置模型后即可一键优化' : '当前为无密钥沙盘，配置模型后即可一键优化，积分已原路退回')
      : '本次改写未达可用标准，已退回积分，请重试' });
  }
  // 落新版本，旧版保留用于对比
  // c203 D1（资金 P0）：幂等键含 rule+尝试序号，拦不住跨规则并发——两笔请求都已扣款、都调完模型，
  // 但同一集只能有一个 targetScript.version+1。扣费事务在模型调用（秒级）之前提交，
  // 模型返回期间另一笔改写可能已经落了新版本。若仍用陈旧 version 落库，必撞
  // @@unique([projectId,epNo,version])（P2002）裸 500：败者扣了钱、没交付、无退款路径。
  // 铁律：扣费之后、模型成功之后的任何落库失败，只要交付物唯一性无法保证，一律退款 + 明确错误码，绝不 500 吞钱。
  const refundCharge = () => isStaff
    ? Promise.resolve() // 内部账户 0 元通道无款可退
    : withBillingTransaction(prisma, req.userId!, (tx) =>
      refundFlexible(tx, req.userId!, points, 'TARGETED_FIX', `fix:${targetScript.id}`, idemKey));
  const newest = await prisma.script.findFirst({
    where: { projectId: project.id, epNo: targetScript.epNo },
    orderBy: { version: 'desc' }, select: { version: true },
  });
  if (!newest || newest.version !== targetScript.version) {
    await refundCharge();
    return res.status(409).json({
      error: 'VERSION_ADVANCED',
      message: '该集刚被另一项优化更新为新版本，本次改写未生效，积分已原路退回。请刷新后基于最新版重试。',
      currentVersion: newest?.version ?? null,
    });
  }
  const newVersion = targetScript.version + 1;
  // c209 集尾钩重算（纯函数零成本零异常）：改写可能换掉结尾，旧 qcReport.cliffhanger 的
  // score/type/endingSnippet 与新正文不符，下一集 deriveHookBit 会读到错误钩子位，跨集兑现账本失明。
  // 仅覆盖 cliffhanger；beats/outline/payoffRhythm 等无正文依赖的台账仍按旧版保留。
  // 此处无规划上下文，planAlignment 一律 null（表示"未比对"，不是 false）。
  const freshCliffhanger = scoreCliffhangerForStorage(rewritten);
  // c210 角色弧光重算：改写会改变情绪轨迹/阶段，旧 arcTrack 与新正文不符会导致（1）质检面板读到
  // 旧停滞/跳变台账（2）下一集 prevArc 基于错误的本集状态再对比，误差跨集累积。
  // 名表取并集：圣经 cast ∪ 本集旧台账角色 ∪ 上集台账角色（旧项目圣经无 cast 也能重算）。
  // prevArc 精确读上一集最新版 qcReport（digest 四字段即跨集输入所需）；首集/读不到则 null：
  // 停滞与跳变自然为空，绝不凭旧台账伪造。任何异常退回 null = 保留旧台账（不阻断付费交付）。
  let freshArc: ReturnType<typeof arcTrackerDigest> | null = null;
  let prevEpContent = ''; // c214：顺带存前集正文，供 openingWeld 焊点重算提取结尾段（与生成路径同规则），避免二次查询
  try {
    const arcNameSet = new Set<string>(castNames);
    const collectNames = (qcr: any) => {
      const cs = qcr?.arcTrack?.characters;
      if (Array.isArray(cs)) for (const c of cs) if (c?.name) arcNameSet.add(String(c.name));
    };
    collectNames(targetScript.qcReport);
    let prevArc: { characters: any[]; epNo: number } | null = null;
    if (targetScript.epNo > 1) {
      const prevSc = await prisma.script.findFirst({
        where: { projectId: project.id, epNo: targetScript.epNo - 1 },
        orderBy: { version: 'desc' },
        select: { epNo: true, qcReport: true, content: true }, // c214 补 content：openingWeld 重算需要前集结尾文本
      });
      prevEpContent = prevSc?.content ?? '';
      const prevChars = (prevSc?.qcReport as any)?.arcTrack?.characters;
      if (prevSc && Array.isArray(prevChars) && prevChars.length) {
        prevArc = { characters: prevChars, epNo: prevSc.epNo };
        collectNames(prevSc.qcReport);
      }
    }
    if (arcNameSet.size > 0) {
      const castMap: Record<string, string> = {};
      for (const n of arcNameSet) castMap[n] = '';
      freshArc = arcTrackerDigest(arcTracker(castMap, rewritten, prevArc));
    }
  } catch { freshArc = null; }
  // c211 软收尾/展示而非叙述重算：同 cliffhanger/arcTrack 一族——改写后旧软收尾与直说情绪
  // 结论不重算就会让质检面板读到 v1 残留。两引擎均为纯函数、内部自探测语种、基本无异常路径，
  // 仍包 try/catch：任何意外退回保留旧台账（与 freshArc 同纪律），不阻断付费交付。
  let freshSoft: ReturnType<typeof sceneSoftEndingForStorage> | null = null;
  let freshSdt: ReturnType<typeof showDontTellForStorage> | null = null;
  try {
    freshSoft = sceneSoftEndingForStorage(rewritten);
    freshSdt = showDontTellForStorage(rewritten);
  } catch { freshSoft = null; freshSdt = null; }
  // c212 结构维度 32 键重算：同 cliff/arc/soft/sdt 族——v2.113-v2.147 结构引擎无顶层 hits，
  // 旧版根本不落库；c212 批量落库补盲后，/fix 也必须按新正文重算，否则改写修好了因果/注水/
  // 连续性问题，质检卡仍挂 v1 旧分。纯函数零 LLM，逐引擎 try/catch（异常键保留旧值，非空才覆盖）；
  // 健康引擎输出 issueCount:0 空壳，清掉 v1 残留问题。timeline/payoffRhythm 台账不在其中；openingWeld 由下方 c214 单独重算。
  let freshStructural: Record<string, unknown> = {};
  try {
    freshStructural = structuralRescan(rewritten, castNames) as Record<string, unknown>;
  } catch { freshStructural = {}; }
  // c214 hits 形态三引擎（反派拖刀/开会式推进/假倒计时）重算：score+hits+string[] issues，
  // 不进 structuralRescan（其 shapeEntry 只收对象 issues，string[] 会被滤成 issueCount:0 假健康壳
  // 清掉真问题，且前端 extraRows 也要求对象 issues，会整体隐形）。统一复用 buildQcEngineDigest
  // 路径 A——与生成落库同一函数同一形态，前端通用 chips 卡直读零分叉。健康稿 digest 不出键，
  // 显式写 score:100/hits:[] 健康壳清掉 v1 残留；逐引擎 try/catch，异常键保留旧值不阻断付费交付。
  const freshHitsEngines: Record<string, unknown> = {};
  for (const [engKey, engFn] of [
    ['villainStall', villainStall],
    ['teamBriefing', teamBriefing],
    ['deadlineStretch', deadlineStretch],
  ] as const) {
    try {
      const r = engFn(rewritten);
      const dig = buildQcEngineDigest({ [engKey]: r }) as Record<string, unknown>;
      freshHitsEngines[engKey] = dig[engKey] ?? { score: r.score, hits: [], unrescuedCount: 0 };
    } catch { /* 异常键保留旧值 */ }
  }
  // c214 焊点承接重算：整集重写会改开场，旧 openingWeld 的承接结论会过期（structural-rescan 头注
  // "同集改写不改变它"对整集重写不成立）。前集结尾按生成路径同规则提取（去尾空白→末行→≤400 字）；
  // 引擎在前集结尾 <20 字时返回 checked=false——无输入不写空壳，保留旧台账（同 freshArc 纪律）；
  // checked=true 时按 buildQcEngineDigest 路径 B 同形态覆盖（健康稿写 score:100/issueCount:0 壳清旧账）。
  let freshWeld: Record<string, unknown> | null = null;
  try {
    if (targetScript.epNo > 1 && prevEpContent) {
      const trimmed = prevEpContent.replace(/\s+$/, '');
      const lastNl = trimmed.lastIndexOf('\n');
      const prevEnding = (lastNl >= 0 ? trimmed.slice(lastNl + 1) : trimmed).trim().slice(0, 400);
      const weldLang = /[一-鿿]/.test(rewritten) ? 'zh' : 'en';
      const w = openingContinuityCheck(prevEnding, rewritten, weldLang);
      if (w.checked) {
        const dig = buildQcEngineDigest({ openingWeld: w }) as Record<string, unknown>;
        freshWeld = (dig.openingWeld as Record<string, unknown>) ?? { score: w.score, issueCount: 0, issues: [] };
      }
    }
  } catch { freshWeld = null; }
  // c215 创作引擎批量重算：v2.80 对白/叙事家族 + v2.81-v2.133 阀门家族共 102 个纯函数引擎
  // 此前 /fix 后仍挂 v1 旧值——改写修好了回声对白/模糊词/阀门巧合，质检卡仍挂旧账。
  // 统一走 creative-batch-rescan（与生成落库同一 buildQcEngineDigest 形态，零 LLM、逐引擎
  // try/catch，健康引擎显式写健康壳清旧账）。不含 structuralRescan 32 键与 c214 已重算键，
  // 键集互斥可安全并列展开。整体 try/catch：模块自身异常退回 {} 保留全部旧值，不阻断付费交付。
  let freshCreative: Record<string, unknown> = {};
  try {
    freshCreative = batchCreativeDigest(rewritten, castNames);
  } catch { freshCreative = {}; }
  // c216 跨集诊断台账六键 /fix 重算：整集重写后掉钩/欠账/干旱/疲劳/反派空转结论须按新正文重放，
  // 否则旧版诊断只活在 v1 内存、刷新后本就失明，修没修好都无反馈。前序行从各集 qcReport 短名摘要
  // 重建（与生成路径同一 normalize* 规则、同一 8 集读取窗），本集行规则对齐 pipeline 终稿块；
  // 开场钩规划 ID 改写不变（读 targetScript.qcReport.openHook），集尾钩用 freshCliffhanger 实测。
  // 整体 try/catch：查询或重算任何异常退回 {} 保留全部旧值，不阻断付费交付。
  let freshLedgerDiag: Record<string, unknown> = {};
  let freshContinuity: Record<string, unknown> = {};
  // c197：两个 bundle 另出本集短名摘要行（humiliation/mystery/promise/villain + 24 连续性短名键），
  // /fix 必须随改写稿回写——否则 v1 旧稿摘要行残留，后续集仍按旧状态记账（死人没死/埋的道具没埋）。
  let freshDiagCurRows: Record<string, unknown> = {};
  let freshContCurRows: Record<string, unknown> = {};
  try {
    // 与生成路径同规则：epNo 降序 + version 降序 take 40，再按 epNo 去重（每集只认最新版）取最近 8 集；
    // 直接 take 8 会在多版本集上漏集，不去重会让同一集摘要行双计虚增欠账/干旱/连段
    const ledgerRows = await prisma.script.findMany({
      where: { projectId: project.id, epNo: { lt: targetScript.epNo } },
      orderBy: [{ epNo: 'desc' }, { version: 'desc' }],
      take: 40,
      select: { epNo: true, qcReport: true },
    });
    const seenLedgerEps = new Set<number>();
    const ledgerPrevs = ledgerRows.filter((s: { epNo: number }) => {
      if (seenLedgerEps.has(s.epNo) || seenLedgerEps.size >= 8) return false;
      seenLedgerEps.add(s.epNo);
      return true;
    });
    const diagBundle = rescanLedgerDiagnosisBundle({
      text: rewritten,
      epNo: targetScript.epNo,
      prevScripts: ledgerPrevs.map((s: { epNo: number; qcReport: unknown }) => ({ epNo: s.epNo, qcReport: s.qcReport })),
      cliffhanger: freshCliffhanger,
      openHookRaw: (targetScript.qcReport as Record<string, unknown> | null)?.openHook,
    });
    freshLedgerDiag = diagBundle.diagnoses;
    freshDiagCurRows = diagBundle.curRows;
    // c217 二十四本跨集连续性台账同批重放：前序短名行复用同一 take40/去重8 查询，
    // 角色表与 c212/c215 /fix 同口径（bible.characters 名表，c196 修，旧 bible.cast 仅历史回退）；逐引擎异常已在模块内隔离。
    // c197：引擎按 cur+1 评估改写集（已完成集语义），本集穿帮当场判 + 24 短名摘要行随包回写。
    const contBundle = rescanContinuityBundle({
      text: rewritten,
      epNo: targetScript.epNo,
      castNames,
      prevScripts: ledgerPrevs.map((s: { epNo: number; qcReport: unknown }) => ({ epNo: s.epNo, qcReport: s.qcReport })),
    });
    freshContinuity = contBundle.ledgers;
    freshContCurRows = contBundle.curRows;
  } catch { freshLedgerDiag = {}; freshContinuity = {}; freshDiagCurRows = {}; freshContCurRows = {}; }
  // c218 闸门引擎四键 + 节奏/人物逻辑 /fix 重算：cliche/tongue/grounded/lengthPlan 无 score 被通用
  // digest 排除，走 gate-engine-rescan 限界形态（覆盖语义，健康壳清旧账）；rhythm/character 有 score，
  // 复用 buildQcEngineDigest 路径 B 同形态（与落库/SSE 零分叉，健康稿 digest 不出键时显式写健康壳）。
  // c222 档位同口径：antiStrength/colloquialLevel 从旧 qcReport._profile 读档重放（normalize 白名单
  // 校验，旧项目无 _profile/脏数据回退默认档 balanced/mid）；scriptFormat 从 project.format 重建；
  // styleCheck 缺 styleProfile（不落库）不重放，保留旧值。
  let freshGate: Record<string, unknown> = {};
  try {
    const prevProfile = (targetScript.qcReport as Record<string, unknown> | undefined)?._profile as Record<string, unknown> | undefined;
    // c223 修复：lengthPlan 重放缺 aigcDurationMin——gate-engine-rescan 模块注释声明「调用方从旧
    // qcReport._aigc.durationMin 读取」（c219 口径），但本调用点漏传，AIGC 项目（如 3 分钟片）重放
    // 一律按默认 1 分钟算 target/range，ready/status 误判。脏数据（非正数）不传，回退默认 1。
    const prevAigcGate = (targetScript.qcReport as Record<string, unknown> | undefined)?._aigc as Record<string, unknown> | undefined;
    const prevAigcDur = typeof prevAigcGate?.durationMin === 'number' && prevAigcGate.durationMin > 0 ? prevAigcGate.durationMin : undefined;
    freshGate = rescanGateEngines(rewritten, {
      scriptFormat: (project as Record<string, unknown>).format === 'AIGC' ? 'AIGC' : 'LIVE',
      aigcDurationMin: prevAigcDur,
      antiStrength: prevProfile?.antiStrength,
      colloquialLevel: prevProfile?.colloquialLevel,
    }) as Record<string, unknown>;
  } catch { freshGate = {}; }
  for (const [engKey, engFn] of [
    ['rhythm', (t: string) => rhythmScan(t)],
    ['character', (t: string) => characterLogicScan(Object.fromEntries(castNames.filter(Boolean).map((n) => [n, {}])), t)],
  ] as const) {
    try {
      const r = engFn(rewritten);
      const dig = buildQcEngineDigest({ [engKey]: r }) as Record<string, unknown>;
      freshGate[engKey] = dig[engKey] ?? { score: r.score, issueCount: 0, issues: [] };
    } catch { /* 异常键保留旧值 */ }
  }
  // c219 AIGC 构成仪表盘 /fix 重算：整集改写后正文变了，aigcManifest/curve/format 须按新正文重放，
  // 否则仪表盘仍挂 v1 旧稿数据。仅 AIGC 格式项目重算（LIVE 实拍本 _aigc 为 null）；
  // 纯函数零 LLM，整体 try/catch 异常退回 null 保留旧值，不阻断付费交付。
  let freshAigc: Record<string, unknown> | null = null;
  try {
    const fmt = (project as Record<string, unknown>).format === 'AIGC' ? 'AIGC' : 'LIVE';
    if (fmt === 'AIGC') {
      // c219 从前一版 _aigc 读取成片时长（无则默认 1 分钟），保证 /fix 重算 volumePlan/format 与生成期口径一致
      const prevAigc = (targetScript.qcReport as Record<string, unknown> | undefined)?._aigc as Record<string, unknown> | undefined;
      const dur = typeof prevAigc?.durationMin === 'number' ? (prevAigc.durationMin as number) : 1;
      const m = buildShotManifest(rewritten);
      freshAigc = {
        durationMin: dur,
        manifest: { shotCount: m.shotCount, title: m.title }, // 只存仪表盘需要的 shotCount/title，避免 shots[] 撑爆 qcReport
        volumePlan: planAigcVolume(dur),
        curve: analyzeAigcSceneCurve(rewritten),
        format: validateScript(rewritten, fmt, dur),
      };
    }
  } catch { freshAigc = null; }
  // c217 villainFate 同名碰撞：诊断（felled/issueCount/issues）必须与短名摘要行 rows 合流，
  // 不能整体展开覆盖。其余 23 键独立长名键直接展开。
  const freshContinuityVf = (freshContinuity.villainFate as Record<string, unknown> | undefined);
  const freshContinuityRest: Record<string, unknown> = { ...freshContinuity };
  delete freshContinuityRest.villainFate;
  // c197：本集短名摘要行同法拆 villainFate（rows 与诊断同名碰撞，落库时合流，rows 以新正文整集替换
  // v1 旧稿行——这正是修复点：旧 /fix 不回写短名行，后续集 prev 读到的还是旧稿状态）。
  const freshVfCurRows = (freshContCurRows.villainFate as Record<string, unknown> | undefined);
  const freshContCurRest: Record<string, unknown> = { ...freshContCurRows };
  delete freshContCurRest.villainFate;
  let saved;
  try {
    saved = await prisma.script.create({
      data: {
        projectId: project.id, epNo: targetScript.epNo, title: targetScript.title,
        synopsis: targetScript.synopsis || '', content: rewritten, wordCount: rewritten.length,
        qcPassed: true, version: newVersion,
        // v2.80 沿用旧版 qcReport 再叠加 targetedFix：新版每集取最新版读取，若整体覆盖会蒸发
        // beats/outline.subplots/payoffRhythm/cliffhanger 等台账数据，令全部跨集台账失明
        qcReport: {
          ...((targetScript.qcReport as Record<string, unknown>) ?? {}),
          targetedFix: { rule: fix.rule, dimLabel: fix.dimLabel, fromVersion: targetScript.version, targetScore: target.score },
          cliffhanger: freshCliffhanger,
          ...(freshArc ? { arcTrack: freshArc } : {}), // c210 重算成功才覆盖；无 cast/异常时保留旧台账，不写空壳
          ...(freshSoft ? { sceneSoftEnding: freshSoft } : {}), // c211 按新正文重算（hits/issues/advice 统一 digest 形态）
          ...(freshSdt ? { showDontTell: freshSdt } : {}), // c211 自动语种探测；健康稿也覆盖（清空 v1 残留问题）
          ...(Object.keys(freshStructural).length ? freshStructural : {}), // c212 32 结构键按新正文覆盖；健康壳 issueCount:0 清旧账；不含 timeline/payoffRhythm 台账键
          ...freshHitsEngines, // c214 villainStall/teamBriefing/deadlineStretch 按新正文覆盖（digest 路径 A 同形态；健康壳清 v1 残留）
          ...(freshWeld ? { openingWeld: freshWeld } : {}), // c214 焊点承接按新正文+前集结尾重算；checked=false（前集结尾 <20 字/读不到）保留旧台账不写空壳
          ...freshCreative, // c215 102 个纯函数创作引擎按新正文覆盖（digest 同形态；健康壳清 v1 旧账；与 structural32/c214 键集互斥）
          ...(Object.keys(freshLedgerDiag).length ? freshLedgerDiag : {}), // c216 跨集诊断六键按新正文+前序摘要重放（无 score 不进 digest；异常/无前序时保留旧值）
          ...(Object.keys(freshContinuityRest).length ? freshContinuityRest : {}), // c217 跨集连续性 23 长名诊断键按新正文+前序短名行重放（覆盖语义；异常时保留旧值）
          ...(Object.keys(freshDiagCurRows).length ? freshDiagCurRows : {}), // c197 c216 四短名摘要行（humiliation/mystery/promise/villain）随改写稿回写，本集新埋雷/新承诺当集入账
          ...(Object.keys(freshContCurRest).length ? freshContCurRest : {}), // c197 c217 其余 23 短名摘要行随改写稿回写，后续集 prev 读新稿账面（死亡/信物/时间线/境界…）
          ...(Object.keys(freshGate).length ? freshGate : {}), // c218 闸门四键（cliche/tongue/grounded/lengthPlan）+ rhythm/character 按新正文重放；styleCheck 缺 styleProfile 保留旧值
          ...(((freshContinuityVf || freshVfCurRows) ? { villainFate: { ...(freshVfCurRows ?? {}), ...(freshContinuityVf ?? {}) } } : {})), // c197 rows 整集替换为新正文短名行 + 诊断覆盖（felled/issueCount/issues）；bundle 异常时两者皆空，base 展开保留 v1 旧值
          _aigc: freshAigc, // c219 AIGC 构成仪表盘按新正文重算（AIGC 格式项目）；LIVE 格式为 null
        },
      },
    });
  } catch (e: any) {
    // 重读与 create 之间仍有竞态窗，P2002 与“版本已推进”语义相同：退款 + 409；
    // 其他落库异常同样退款（502），任何失败形态都不得让已扣积分悬挂。
    await refundCharge();
    if (e?.code === 'P2002') {
      return res.status(409).json({
        error: 'VERSION_ADVANCED',
        message: isStaff
          ? '该集刚被另一项优化更新为新版本，本次改写未生效。请刷新后基于最新版重试。'
          : '该集刚被另一项优化更新为新版本，本次改写未生效，积分已原路退回。请刷新后基于最新版重试。',
      });
    }
    return res.status(502).json({ error: 'SAVE_FAILED', message: isStaff ? '新版本保存失败，请稍后重试' : '新版本保存失败，积分已原路退回，请稍后重试' });
  }
  res.json({
    epNo: targetScript.epNo, oldVersion: targetScript.version, newVersion,
    pointsCharged: points, staff: isStaff, targetScore: target.score, wordCount: rewritten.length,
    script: { id: saved.id, content: rewritten },
    // c202 改写幅度观测（零成本纯函数）：让前端能告诉用户“这次是微调还是大幅重写”，并引导看逐行对比；只观测不阻断
    rewriteSpan: assessRewrite(targetScript.content, rewritten),
  });
});

const genSchema = z.object({
  projectId: z.string(),
  engineTier: z.nativeEnum(EngineTier).optional(),
  brief: z.string().min(1).max(8000),
  track: z.string().min(1).max(40).optional(), // v2.14 名场面工作台轨道（与建项目一致，二次校验权限）
  // v1.95 输出语言：钩子指令/钩子选项按语言下发，默认 zh
  lang: z.enum(['zh', 'en']).optional(),
  // 四层钩子偏好：auto系统智能(默认)/manual用户逐点指定/hybrid用户优先其余系统补；非法/未知id在 pipeline 内清洗
  hookPref: z.object({
    mode: z.enum(['auto', 'manual', 'hybrid']).optional(),
    strength: z.enum(['relax', 'balanced', 'tight']).optional(),
    preferred: z.array(z.string().max(40)).max(40).optional(),
    avoid: z.array(z.string().max(40)).max(40).optional(),
    manual: z.record(z.any()).optional(),
  }).passthrough().optional(),
  // v2.27 钩子策略 id（balanced/dense/suspense/emotion/premium）；hookPref 缺省时生效，非法值由 pipeline 回退系统推荐
  hookStrategy: z.string().min(1).max(20).optional(),
  paceStrategy: z.string().min(1).max(20).optional(),
  dialogueStrategy: z.string().min(1).max(20).optional(),
  emotionStrategy: z.string().min(1).max(20).optional(),
  characterStrategy: z.string().min(1).max(20).optional(), // v2.37 第五套策略层：人物与关系
  // c223 请求级反套路档位：pipeline（L626 options.antiStrength）与 /fix 重放（_profile 读档）三层
  // 全支持，但此前路由 schema 无此字段 = 能力无入口，请求永远走默认 balanced。
  antiStrength: z.enum(['classic', 'balanced', 'innovative']).optional(),
  // v2.32 用户自带参考剧本学风格（只学节奏/语感不抄内容）；仅 BASIC 及以上，上限2万字
  customStyleText: z.string().min(100).max(20000).optional(),
  aigcDurationMin: z.number().min(0.5).max(5).optional(), // v2.33 AIGC 成片时长，按分钟精算字数/台词配比
  visualStyleId: z.string().max(8).optional(),            // v2.148 视觉画风编号（AIGC 项目；传入即落库 project.bible，供分镜导出/海报注入）
  cameraStyleId: z.string().max(8).optional(),            // v2.149 镜头语言编号（AIGC 项目；传入即落库 project.bible，供分镜导出注入）
  scenesPerEp: z.number().int().min(1).max(8).optional(),
  // 反转/爽点/情绪节拍偏好（与钩子同构），非法/未知id在 pipeline 内清洗
  beatPref: z.object({
    mode: z.enum(['auto', 'manual', 'hybrid']).optional(),
    strength: z.enum(['relax', 'balanced', 'tight']).optional(),
    preferred: z.array(z.string().max(40)).max(40).optional(),
    avoid: z.array(z.string().max(40)).max(40).optional(),
    manual: z.record(z.any()).optional(),
  }).passthrough().optional(),
  // v2.93 剧情软广·结构化品牌简报（仅 branded_skit 生效；品牌名/卖点必填，广告词在扣费前预检）
  brandBrief: z.object({
    brand: z.string().optional(),
    product: z.string().optional(),
    sellingPoint: z.string().optional(),
    audience: z.string().optional(),
    storyShell: z.string().optional(),
    memorySymbol: z.string().optional(),
    cta: z.string().optional(),
    softness: z.string().optional(),
  }).passthrough().optional(),
  // v2.94 热点追更·结构化热点简报（仅 hot 生效；热点名/爆点必填，隐私硬信息扣费前拦截）
  trendBrief: z.object({
    trendName: z.string().optional(),
    trendKind: z.string().optional(),
    approach: z.string().optional(),
    heatCore: z.string().optional(),
    userAngle: z.string().optional(),
    avoidElements: z.string().optional(),
  }).passthrough().optional(),
  // v2.95 互动分支·结构化分支简报（仅 interactive 生效；主线/选择点必填，结局数闭环校验）
  branchBrief: z.object({
    mainLine: z.string().optional(),
    choicePoints: z.string().optional(),
    endingsMain: z.number().optional(),
    endingsHidden: z.number().optional(),
    endingsBad: z.number().optional(),
    branchStyle: z.string().optional(),
    stakesLevel: z.string().optional(),
    customEnding: z.string().optional(),
  }).passthrough().optional(),
  // v2.96 原作/小说/名场面原文（仅 adapt/novel/hit_lab 生效；用于 n-gram 重合度侵权检测，上限 5 万字）
  sourceText: z.string().min(10).max(50000).optional(),
});

function startOfToday(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

/** SSE 创作一集：免费档每日2集补贴；付费档冻结→协作→结算/退款，成本落库并校验毛利 */
generateRouter.post('/episodes', authRequired, async (req: AuthRequest, res) => {
  const parsed = genSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { projectId, brief } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(401).json({ error: '用户不存在' });
  if (user.banned) return res.status(403).json({ error: '账号已封禁' });

  const level = user.level as MemberLevel;
  // 内部账户（超级管理员杨光本人 / 杨光指定的管理员）：全链路创作免费，
  // 不读积分余额、不依赖 Membership 赠送额度、不走毛利熔断——身份判定函数层直接短路。
  const isStaff = isAdminUser(user);
  const tier = parsed.data.engineTier ?? EngineTier.ECONOMY;
  const allowed = (MEMBERSHIP[level] as { engines: readonly EngineTier[] }).engines;
  if (!isStaff && !allowed.includes(tier)) return res.status(403).json({ error: '当前会员等级不可用该引擎，请升级' });

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id, status: { not: 'deleted' } } });
  if (!project) return res.status(404).json({ error: '项目不存在' });
  // v2.14 归一模式 + 轨道二次校验（防止建项目后越权调用专业轨道）
  const projCanonMode = canonicalModeId((project as Record<string, unknown>).mode as string);
  // v2.319 原文统一取数：body 优先，缺失时从立项/拆爆款承接持久化的 bible 兜底（仅三原文模式）
  const effectiveSourceText = resolveEpisodeSourceText({
    bodySourceText: parsed.data.sourceText,
    project: project as { bible?: unknown },
    canonMode: projCanonMode,
  });
  const epTrack = parsed.data.track ? canonicalHitLabTrack(parsed.data.track) : undefined;
  if (!isStaff && projCanonMode === 'hit_lab' && !trackAvailable(projCanonMode, epTrack, level)) {
    return res.status(403).json({ error: 'TRACK_LOCKED', needLevel: trackUnlockLevel(projCanonMode, epTrack), track: 'hit_reverse', message: '「爆款逆向批量」为专业版轨道' });
  }
  // 三级审核第一级：创意 brief 生成前机器拦截，必须在免费额度判定与冻结积分之前，避免误扣/误耗
  const briefScan = await scanWithStore(brief, prisma);
  if (briefScan.level === 'block') return res.status(422).json({ error: briefScan.blockReason!, hits: briefScan.blocked });
  // 受限题材只预警不拦截，随进度事件由小南提示改写法
  const complianceWarnings = briefScan.warnings;
  // v2.93 剧情软广：结构化品牌简报规范化 + 广告词合规预检（必须在冻结积分之前拦截，命中不扣费）
  let brandBrief: BrandBriefInput | null = null;
  // v2.325 branded_skit 已并入 video_short（canonicalModeId 归一），此处用 video_short
  if (projCanonMode === 'video_short' && parsed.data.brandBrief) {
    try {
      brandBrief = normalizeBrandBrief(parsed.data.brandBrief);
    } catch (e) {
      if (e instanceof BrandBriefError) return res.status(400).json({ error: e.message, field: e.field });
      throw e;
    }
    const adHits = scanBrandBrief(brandBrief, parsed.data.lang === 'en' ? 'en' : 'zh');
    if (adHits.length) {
      return res.status(422).json({
        error: 'AD_CLAIM_BLOCKED',
        message: '品牌信息含绝对化用语、医疗/投资功效承诺等违禁广告词，请修改后再生成',
        hits: adHits,
      });
    }
  }
  // v2.94 热点追更：结构化热点简报规范化 + 侵权/舆情风险预检（隐私硬信息扣费前拦截；高危题材只预警，转强制虚构化指令）
  let trendBrief: TrendBriefInput | null = null;
  let trendRisk: ReturnType<typeof scanTrendRisk> | null = null;
  if (projCanonMode === 'hot' && parsed.data.trendBrief) {
    let tb: TrendBriefInput;
    try {
      tb = normalizeTrendBrief(parsed.data.trendBrief);
    } catch (e) {
      if (e instanceof TrendBriefError) return res.status(400).json({ error: e.message, field: e.field });
      throw e;
    }
    trendBrief = tb;
    trendRisk = scanTrendRisk(tb, parsed.data.lang === 'en' ? 'en' : 'zh');
    if (trendRisk.piiBlocks.length) {
      return res.status(422).json({
        error: 'TREND_PII_BLOCKED',
        message: '热点信息含手机号/身份证号等个人隐私内容，创作简报中禁止出现，请删除后再生成',
        hits: trendRisk.piiBlocks,
      });
    }
    // 高危题材信号并入既有合规预警流（context 阶段小南提示），不拦截、不扣费影响
    trendRisk.signals.forEach((sg) => complianceWarnings.push({
      ruleId: `trend_risk_${sg.type}`, category: 'trend_ip_risk', label: `热点风险·${sg.label}`,
      severity: 'WARN', matched: tb.trendName, advice: sg.advice,
    }));
  }
  // v2.95 互动分支：结构化分支简报规范化 + 闭环预检（扣费前拦截，命中不扣费）
  let branchBrief: BranchBriefInput | null = null;
  if (projCanonMode === 'interactive' && parsed.data.branchBrief) {
    let bb: BranchBriefInput;
    try {
      bb = normalizeBranchBrief(parsed.data.branchBrief);
    } catch (e) {
      if (e instanceof BranchBriefError) return res.status(400).json({ error: e.message, field: e.field });
      throw e;
    }
    const branchErrs = validateBranchStructure(bb);
    if (branchErrs.length) {
      return res.status(422).json({ error: 'BRANCH_VALIDATION_FAILED', message: branchErrs[0].message, field: branchErrs[0].field, errors: branchErrs });
    }
    branchBrief = bb;
  }
  const isAIGC = (project as Record<string, unknown>).format === 'AIGC';

  // 免费档：每日2集免费补贴（跨项目计数），超过引导付费；不扣积分
  const isFree = level === MemberLevel.FREE;
  // v2.32 私有风格学习（上传参考剧本）为付费能力：免费档引导升级（内部账户免费放行）
  if (isFree && !isStaff && parsed.data.customStyleText)
    return res.status(402).json({ error: '上传参考剧本学习风格为会员能力，开通基础会员即可使用', needPay: true, upgrade: 'BASIC' });
  // 免费额度的原子占坑移到 generationTask 建单之后（行锁+计数+占坑行同事务），见下方 FREE_LIMIT 检查
  // 每月赠送集只抵【经济档】；标准/旗舰必须扣积分（不赔钱铁律，resolveEpisodeCharge 纯函数锁死）
  // 内部账户：points 恒 0、不查 Membership，赠送额度/余额/Membership 数据存在与否都不影响免费
  const listPoints = (isFree || isStaff) ? 0 : episodePoints(level, tier);
  const activeMembership = (isFree || isStaff) ? null : await prisma.membership.findFirst({
    where: { userId: user.id, level, expireAt: { gt: new Date() } },
    orderBy: { expireAt: 'desc' },
  });
  const charge = resolveEpisodeCharge(level, tier, activeMembership
    ? { level: activeMembership.level as MemberLevel, quotaTotal: activeMembership.quotaTotal, quotaUsed: activeMembership.quotaUsed, expireAt: activeMembership.expireAt }
    : null);
  let points = isStaff ? 0 : (isFree ? 0 : charge.points);
  let paidViaQuota = false; // 事务内原子占赠送集成功后置 true（staff 恒 false）

  // v2.292 同项目在途防线：同一项目的分集创作严格串行。集序取 max(epNo)+1 且连续性
  // 注入依赖前集成稿，并发双发必然撞 @@unique([projectId,epNo,version])——败者白烧整条
  // LLM 流水线（分钟级真实成本）后才走退款，用户白等。这里把「在途检查 + 建单」收进
  // 账户行锁事务：同用户请求在行锁上串行，封死「双请求同时看到无在途」的 TOCTOU；
  // 在途即 409，零冻结零模型调用。崩溃残留自愈：只统计 35 分钟内的在途任务
  // （全局硬超时 30 分钟 + 收尾余量），进程崩溃残留的 RUNNING 行至多阻塞 35 分钟，
  // 绝不永久锁死项目。粒度为单项目：跨项目并行创作是合法场景，不受影响。
  const STALE_IN_FLIGHT_MS = 35 * 60_000;
  let task: { id: string };
  try {
    task = await withBillingTransaction(prisma, user.id, async (tx) => {
      await tx.lockAccount(user.id);
      const raw = tx.raw as any;
      const inFlight = await raw.generationTask.count({
        where: { projectId, status: { in: ['QUEUED', 'RUNNING'] }, createdAt: { gte: new Date(Date.now() - STALE_IN_FLIGHT_MS) } },
      });
      if (inFlight > 0) throw new Error('PROJECT_GENERATION_IN_FLIGHT');
      return raw.generationTask.create({
        data: { projectId, stage: 'draft', engineTier: tier, status: 'QUEUED', pointsCost: points },
      });
    });
  } catch (e) {
    if ((e as Error).message === 'PROJECT_GENERATION_IN_FLIGHT') {
      return res.status(409).json({ code: 'PROJECT_GENERATION_IN_FLIGHT', error: '该项目有正在进行的创作，完成后（或稍等片刻）再发起下一集' });
    }
    throw e;
  }

  // 免费档每日补贴原子占坑：行锁串行化同用户并发 → 计数（已完成剧本 + 在途任务）→ 超限拒绝。
  // 在途 QUEUED/RUNNING 任务即“占坑行”，保证两个并发请求不会同时看到 used=1 而各自放行（刷第3集）；
  // 生成失败任务置 FAILED 后自动释放占坑（FAILED 不参与计数），不误伤用户正常重试。
  if (isFree && !isStaff) {
    const FREE_LIMIT_ERR = 'FREE_DAILY_LIMIT';
    try {
      await withBillingTransaction(prisma, user.id, async (tx) => {
        await tx.lockAccount(user.id);
        const raw = tx.raw as any;
        const doneToday = await raw.script.count({
          where: { project: { userId: user.id }, createdAt: { gte: startOfToday() } },
        });
        const inFlightToday = await raw.generationTask.count({
          where: {
            project: { userId: user.id },
            status: { in: ['QUEUED', 'RUNNING'] },
            createdAt: { gte: startOfToday() },
          },
        });
        if (doneToday + inFlightToday >= MEMBERSHIP.FREE.freeEpsPerDay) throw new Error(FREE_LIMIT_ERR);
      });
    } catch (e) {
      if ((e as Error).message === FREE_LIMIT_ERR || (e as { code?: string }).code === FREE_LIMIT_ERR) {
        await prisma.generationTask.update({ where: { id: task.id }, data: { status: 'FAILED', errorMsg: '免费每日额度已用完' } });
        return res.status(402).json({ error: `今日免费${MEMBERSHIP.FREE.freeEpsPerDay}集已用完，开通会员无限创作`, needPay: true });
      }
      throw e;
    }
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // 客户端可能在生成中途关闭页面（SSE 断连）。此时后台应继续跑完、正常结算并入库（断网不丢），
  // 因此 send 必须是安全写入：连接已关就静默跳过，绝不让 write 抛错被外层 catch 误判为“生成失败”而错误退款。
  let clientAborted = false;
  req.on('close', () => { clientAborted = true; });
  const send = (e: unknown) => {
    if (clientAborted || res.writableEnded || res.destroyed) return;
    try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch { clientAborted = true; }
  };
  // SSE 心跳：模型调用期间无事件发出，每 10s 发注释帧保活，防止网关空闲断连
  const heartbeat = setInterval(() => {
    if (clientAborted || res.writableEnded || res.destroyed) return;
    try { res.write(': keepalive\n\n'); } catch { clientAborted = true; }
  }, 10000);

  // v2.190 用户显式取消信号：注册到全局 map，取消端点 abort() 后停止后续 LLM 调用
  const abortController = new AbortController();
  setActiveAbort(task.id, abortController);
  // v2.191 全局硬超时 30 分钟：防止候选链×重试×10 岗位叠加导致最坏 180 分钟无法中断
  const GLOBAL_TIMEOUT_MS = 30 * 60_000;
  const globalTimeout = setTimeout(() => abortController.abort(), GLOBAL_TIMEOUT_MS);

  try {
    if (!isFree && !isStaff) {
      await withBillingTransaction(prisma, user.id, async (tx) => {
        if (charge.useQuota && activeMembership) {
          // 原子占坑：仅当仍有剩余赠送集时 +1，防并发超发；抢不到则回落为正常积分计费
          const got = await tx.takeQuota(activeMembership.id, activeMembership.quotaTotal);
          if (got) { paidViaQuota = true; return; }
          points = listPoints; // 并发抢光，本集改扣积分
        }
        if (points > 0) await freeze(tx, user.id, points, task.id, `freeze:${task.id}`);
      });
    }
    await prisma.generationTask.update({ where: { id: task.id }, data: { status: 'RUNNING' } });
    // v2.233 端点对齐：frozen 帧携带 taskId——前端据此前调 POST /tasks/:id/cancel（v2.190 取消能力此前无前端入口）
    send({ stage: 'frozen', taskId: task.id, points, free: isFree, viaQuota: paidViaQuota, staff: isStaff, quotaRemainAfter: paidViaQuota ? charge.quotaRemainBefore - 1 : charge.quotaRemainBefore });

    const fallbackBible: Bible = { worldview: '', characters: {}, timeline: [], foreshadow: [] };
    const bible = (project.bible as unknown as Bible) ?? fallbackBible;
    // 创作上下文：时令/平台爆款/用户画像/地域文化/官方方法论 → 小南先播报，再作为取向注入流水线
    const u = user as Record<string, unknown>; const p = project as Record<string, unknown>;
    const creationCtx = buildCreationContext({
      profile: toEngineUserProfile({
        bio: user.bio as string, region: u.region as string, ageBand: u.ageBand as string,
        gender: u.gender as string, personalized: u.personalized as boolean,
      }, ((p.preferredTags as string[]) ?? undefined)),
      personalized: u.personalized !== false,
      board: ((p.trendingBoard as never[]) ?? boardStore.getFresh() as never[]), // v2.70：优先项目自带榜单，否则取榜单仓保鲜期内真实快照（空仓诚实不倾斜）
      tagBrief: (p.tagBrief as string) ?? undefined,
      tags: ((p.tags as string[]) ?? (p.preferredTags as string[])) ?? undefined,
      historyAnchor: (p.historyAnchor as string) ?? undefined,
      scriptMode: isAIGC ? 'AIGC' : 'LIVE',
    });
    send({ stage: 'context', xiaonanLines: creationCtx.xiaonanLines, directions: creationCtx.directions, complianceWarnings });
    // v2.85：创作上下文不再拼进 brief（会混淆模型对"用户原始 brief"的理解），改为通过 creationContextInput 传入管线，由各岗位独立注入
    const enrichedBrief = brief;
    // 每个岗位事件 → 游戏化进度（百分比/趣味阶段名/小南陪伴/创作彩蛋），前端据此渲染不枯燥的等待
    const progTier = String(level).toLowerCase() as 'free' | 'basic' | 'high' | 'pro';
    // v2.88 修复：Project 表字段名是 totalEps（schema/build 一致），此前误读不存在的 totalEpisodes/
    // episodeCount 导致恒 undefined → episodeCount 恒 1：电影三幕定位永不注入、跨集钩子/节拍规划退化为单集。
    const totalEps = (p.totalEps as number) ?? undefined;
    const emitWithProgress = (e: { role: string; status: string; note: string }) => {
      const stage = roleEventToStage(e.role, e.note);
      const pg = progressSnapshot({ stage, tier: progTier, totalEpisodes: totalEps });
      send({ stage: 'progress', pipelineStage: stage, role: e.role, status: e.status, note: e.note,
        percent: pg.percent, label: pg.label, xiaonanLine: pg.xiaonanLine, tip: pg.tip, stageKind: pg.stageKind });
    };
    // 修订版不增加集数；下一集序号由现有最大 epNo 决定，兼容删集留下的空号。
    const lastEpisode = await prisma.script.findFirst({ where: { projectId }, orderBy: { epNo: 'desc' }, select: { epNo: true } });
    const epIndex = lastEpisode?.epNo ?? 0;
    // v2.106 跨集连续性：拉取前集正文摘要（角色状态/伏笔/集尾钩子），注入架构师/撰写师
    // 此前多集生成时管线完全不知道前集内容——人物状态/伏笔/剧情线全靠 LLM 凭空衔接
    let prevEpisode: { epNo: number; title: string; summary: string; ending?: string } | null = null;
    let prevScript: { epNo: number; title: string; content: string; qcReport: any } | null = null;
    if (epIndex > 0) {
      prevScript = await prisma.script.findFirst({
        where: { projectId, epNo: epIndex },
        orderBy: { version: 'desc' },
        select: { epNo: true, title: true, content: true, qcReport: true },
      }).catch(() => null) as any;
      if (prevScript && prevScript.content) {
        // 取前集正文前2000字作为摘要（足够 LLM 理解角色状态和集尾钩子，不占过多 token）
        // v2.80 另取结尾段（≤400字，从段首起）作为跨集焊点：下一集开场必须从此瞬间无缝接起
        const trimmedContent = prevScript.content.replace(/\s+$/, '');
        const lastNl = trimmedContent.lastIndexOf('\n');
        const ending = (lastNl >= 0 ? trimmedContent.slice(lastNl + 1) : trimmedContent).trim().slice(0, 400) || undefined;
        prevEpisode = {
          epNo: prevScript.epNo,
          title: prevScript.title || '',
          summary: prevScript.content.slice(0, 2000),
          ending,
        };
      }
    }
    // v2.80 装置防疲劳生成侧注入：收集前集 qcReport.beats（最近~8集、每集取最新版本、按 ep 升序），
    // 疲劳信号将在管线内转成架构师布点约束，修复"波形端点能看见、架构师看不见"的检测/生成脱节
    let prevDevices: { ep: number; reversalId: string | null; payoffIds: string[]; emotionPath: string[] }[] = [];
    // v2.80 配角在场防遗忘：同批去重行顺便收集（epNo, content），供圣经角色名的跨集 includes 匹配
    const trackedRows: { epNo: number; content: string }[] = [];
    // v2.80 支线编织台账：同批去重行顺便收集前集大纲的活跃支线声明（支线名×声明集号）
    const prevSubplots: SubplotBit[] = [];
    // v2.80 憋爽波浪台账：同批去重行顺便收集前集爽感摘要四元组（受压/释放/强释放/首爽位置）
    const prevWaves: WaveEpInput[] = [];
    // v2.80 集尾钩子跨集兑现：只取最近一个已完成集的钩子位（观众只记上一集结尾的钩）
    let prevHook: HookBit | null = null;
    // v2.80 屈辱-打脸跨集账本：按集收集前集羞辱雷摘要（升序记账在引擎内做）
    const prevHumDebt: DebtEpInput[] = [];
    // v2.80 多集悬念干旱账本：按集收集前集悬念线摘要（升序记账在引擎内做）
    const prevMystery: MysteryRow[] = [];
    // v2.80 跨集钩型疲劳账本：按集收集前集钩型摘要（开场规划ID/集尾实测型，升序记账在引擎内做）
    const prevHookTypes: HookTypeRow[] = [];
    // v2.80 信物跨集连续性账本：按集收集前集信物提及摘要（name/closed，升序记账在引擎内做）
    const prevProps: PropRow[] = [];
    // v2.80 承诺欠账账本：按集收集前集承诺摘要（line/advanced，升序记账在引擎内做）
    const prevPromises: PromiseRow[] = [];
    // v2.80 反派威胁升级账本：按集收集前集反派威胁摘要（line/acted/level，升序记账在引擎内做）
    const prevVillains: VillainRow[] = [];
    // v2.80 时间线跨集账本：按集收集前集时间锚摘要（mark/spanDays，升序记账在引擎内做）
    const prevTimelineMarks: TimelineRow[] = [];
    // v2.80 代价跨集账本：按集收集前集代价摘要（won/paid，升序记账在引擎内做）
    const prevCostRows: CostRow[] = [];
    // v2.80 死亡穿帮账本：按集收集前集死亡摘要（name/dead/revived/active，升序记账在引擎内做）
    const prevDeathRows: DeathRow[] = [];
    // v2.80 反派下场账本：按集收集前集下场摘要（name/removed/exempted/active，升序记账在引擎内做）
    const prevFateRows: FateRow[] = [];
    // v2.80 创伤恢复账本：按集收集前集创伤摘要（name/wounded/healed/strained，升序记账在引擎内做）
    const prevWoundRows: WoundRow[] = [];
    // v2.80 境界进阶账本：按集收集前集境界摘要（name/realm/broke/down/exempted，升序记账在引擎内做）
    const prevPowerRows: PowerRow[] = [];
    // v2.80 信物归属账本：按集收集前集归属摘要（name/item/handed/regain/touched，升序记账在引擎内做）
    const prevItemRows: ItemRow[] = [];
    // v2.80 关系翻转账本：按集收集前集关系摘要（name/other/rift/reconciled/close，升序记账在引擎内做）
    const prevRelRows: RelRow[] = [];
    // v2.80 阵营归属账本：按集收集前集归属摘要（name/org/left/rejoined/loyal，升序记账在引擎内做）
    const prevAffRows: AffRow[] = [];
    // v2.80 地点跨集账本：按集收集前集地点摘要（name/place/left/arrived/stranded/rescued，升序记账在引擎内做）
    const prevLocRows: LocRow[] = [];
    // v2.80 秘密泄露账本：按集收集前集知情摘要（a/b/told/knows/witness，升序记账在引擎内做）
    const prevLeakRows: LeakRow[] = [];
    // v2.80 伪装身份账本：按集收集前集伪装摘要（name/alias/disguised/revealed，升序记账在引擎内做）
    const prevDisguiseRows: DisguiseRow[] = [];
    // v2.80 人情债账本：按集收集前集债务摘要（debtor/creditor/owed/repaid/betrayed，升序记账在引擎内做）
    const prevDebtRows: DebtRow[] = [];
    // v2.80 联盟账本：按集收集前集联盟摘要（a/b/allied/dissolved/hostile，升序记账在引擎内做）
    const prevAllianceRows: AllianceRow[] = [];
    // v2.80 记忆账本：按集收集前集记忆摘要（name/lost/restored/recalled，升序记账在引擎内做）
    const prevMemoryRows: MemoryRow[] = [];
    // v2.80 冒充账本：按集收集前集冒充摘要（imposter/victim/impersonated/exposed/recognized，升序记账在引擎内做）
    const prevImpersonationRows: ImpersonationRow[] = [];
    // v2.80 背叛账本：按集收集前集背叛摘要（betrayer/victim/betrayed/reconciled/cooperated，升序记账在引擎内做）
    const prevBetrayalRows: BetrayalRow[] = [];
    // v2.80 牺牲账本：按集收集前集牺牲摘要（giver/receiver/sacrificed/thanked/mistreated，升序记账在引擎内做）
    const prevSacrificeRows: SacrificeRow[] = [];
    // v2.80 诅咒账本：按集收集前集诅咒摘要（name/cursed/lifted/unaffected，升序记账在引擎内做）
    const prevCurseRows: CurseRow[] = [];
    // v2.80 附身账本：按集收集前集附身摘要（name/possessed/freed/self_willed，升序记账在引擎内做）
    const prevPossessionRows: PossessionRow[] = [];
    // v2.80 穿越账本：按集收集前集穿越摘要（name/traveled/returned/native，升序记账在引擎内做）
    const prevTimeTravelRows: TimeTravelRow[] = [];
    // v2.80 变身账本：按集收集前集变身摘要（name/transformed/reverted/original，升序记账在引擎内做）
    const prevTransformationRows: TransformationRow[] = [];
    // v2.80 中毒账本：按集收集前集中毒摘要（name/poisoned/cured/healthy，升序记账在引擎内做）
    const prevPoisonRows: PoisonRow[] = [];
    if (epIndex > 0) {
      const prevRows = await prisma.script.findMany({
        where: { projectId, epNo: { lte: epIndex } },
        select: { epNo: true, version: true, qcReport: true, content: true },
        orderBy: [{ epNo: 'desc' }, { version: 'desc' }], // epNo 降序取最近，version 降序保证每集先读到最新版
      }).catch(() => [] as { epNo: number; version: number; qcReport: any; content: string }[]);
      const seenEps = new Set<number>();
      for (const s of latestScripts<any>(prevRows).slice(-8).reverse()) {
        if (seenEps.has(s.epNo) || seenEps.size >= 8) continue;
        seenEps.add(s.epNo);
        trackedRows.push({ epNo: s.epNo, content: typeof s.content === 'string' ? s.content : '' });
        const b = (s.qcReport as any)?.beats;
        // v2.80 支线编织台账：提取前集大纲 subplots 声明（规范化容错，非数组/超长/单字一律丢弃）
        prevSubplots.push(...deriveSubplotBits((s.qcReport as any)?.outline, s.epNo));
        // v2.80 憋爽波浪台账：提取前集 payoffRhythm 摘要（缺字段按 0/null 规范化）
        const wRaw = (s.qcReport as any)?.payoffRhythm;
        if (wRaw && typeof wRaw === 'object') {
          const w = normalizeWaveEp({ ...(wRaw as Record<string, unknown>), ep: s.epNo });
          if (w) prevWaves.push(w);
        }
        // v2.80 集尾钩子跨集兑现：prevRows 按 epNo 降序去重，首个接受行=最近已完成集，只认它的钩子位
        if (seenEps.size === 1) {
          prevHook = deriveHookBit((s.qcReport as any)?.cliffhanger, s.epNo);
        }
        // v2.80 屈辱-打脸跨集账本：提取前集羞辱雷摘要（planted/paid/strong/markers），全序列收集供欠账记账
        const hRaw = (s.qcReport as any)?.humiliation;
        if (hRaw && typeof hRaw === 'object') {
          const h = normalizeDebtEp({ ...(hRaw as Record<string, unknown>), ep: s.epNo });
          if (h) prevHumDebt.push(h);
        }
        // v2.80 多集悬念干旱账本：提取前集悬念线摘要（line/advanced/hooked），全序列收集供干旱记账
        const mRaw = (s.qcReport as any)?.mystery;
        if (mRaw && typeof mRaw === 'object') {
          const m = normalizeMysteryRow({ ...(mRaw as Record<string, unknown>), ep: s.epNo });
          if (m) prevMystery.push(m);
        }
        // v2.80 跨集钩型疲劳账本：提取前集钩型摘要（开场 openHook.id / 集尾 cliffhanger.type），全序列收集供 run-length 记账
        const htRow = normalizeHookTypeRow({
          ep: s.epNo,
          openId: ((s.qcReport as any)?.openHook as any)?.id,
          endType: (s.qcReport as any)?.cliffhanger?.type,
        });
        if (htRow) prevHookTypes.push(htRow);
        // v2.80 信物跨集账本：提取前集信物提及摘要（name/closed），全序列收集供连续性记账
        const pRaw = (s.qcReport as any)?.props;
        if (pRaw && typeof pRaw === 'object') {
          const p = normalizePropRow({ ...(pRaw as Record<string, unknown>), ep: s.epNo });
          if (p) prevProps.push(p);
        }
        // v2.80 承诺欠账账本：提取前集承诺摘要（line/advanced），全序列收集供欠账记账
        const prmRaw = (s.qcReport as any)?.promise;
        if (prmRaw && typeof prmRaw === 'object') {
          const p = normalizePromiseRow({ ...(prmRaw as Record<string, unknown>), ep: s.epNo });
          if (p) prevPromises.push(p);
        }
        // v2.80 反派威胁升级账本：提取前集反派威胁摘要（line/acted/level），全序列收集供威胁记账
        const vtRaw = (s.qcReport as any)?.villain;
        if (vtRaw && typeof vtRaw === 'object') {
          const v = normalizeVillainRow({ ...(vtRaw as Record<string, unknown>), ep: s.epNo });
          if (v) prevVillains.push(v);
        }
        // v2.80 时间线跨集账本：提取前集时间锚摘要（mark/spanDays），全序列收集供时序记账
        const tlRaw = (s.qcReport as any)?.timeline;
        if (tlRaw && typeof tlRaw === 'object') {
          const t = normalizeTimelineRow({ ...(tlRaw as Record<string, unknown>), ep: s.epNo });
          if (t) prevTimelineMarks.push(t);
        }
        // v2.80 代价跨集账本：提取前集代价摘要（won/paid），全序列收集供连胜记账
        const ctRaw = (s.qcReport as any)?.cost;
        if (ctRaw && typeof ctRaw === 'object') {
          const c = normalizeCostRow({ ...(ctRaw as Record<string, unknown>), ep: s.epNo });
          if (c) prevCostRows.push(c);
        }
        // v2.80 死亡穿帮账本：提取前集死亡摘要（rows[]：name/dead/revived/active），全序列收集供复活记账
        const dRaw = (s.qcReport as any)?.death;
        if (dRaw && typeof dRaw === 'object' && Array.isArray((dRaw as any).rows)) {
          for (const dr of (dRaw as any).rows) {
            const d = normalizeDeathRow({ ...(dr as Record<string, unknown>), ep: s.epNo });
            if (d) prevDeathRows.push(d);
          }
        }
        // v2.80 反派下场账本：提取前集下场摘要（rows[]：name/removed/exempted/active），全序列收集供下场记账
        const vfRaw = (s.qcReport as any)?.villainFate;
        if (vfRaw && typeof vfRaw === 'object' && Array.isArray((vfRaw as any).rows)) {
          for (const vr of (vfRaw as any).rows) {
            const vf = normalizeFateRow({ ...(vr as Record<string, unknown>), ep: s.epNo });
            if (vf) prevFateRows.push(vf);
          }
        }
        // v2.80 创伤恢复账本：提取前集创伤摘要（rows[]：name/wounded/healed/strained），全序列收集供伤势记账
        const wrRaw = (s.qcReport as any)?.wound;
        if (wrRaw && typeof wrRaw === 'object' && Array.isArray((wrRaw as any).rows)) {
          for (const wrr of (wrRaw as any).rows) {
            const wr = normalizeWoundRow({ ...(wrr as Record<string, unknown>), ep: s.epNo });
            if (wr) prevWoundRows.push(wr);
          }
        }
        // v2.80 境界进阶账本：提取前集境界摘要（rows[]：name/realm/broke/down/exempted），全序列收集供境界记账
        const pwRaw = (s.qcReport as any)?.power;
        if (pwRaw && typeof pwRaw === 'object' && Array.isArray((pwRaw as any).rows)) {
          for (const pwr of (pwRaw as any).rows) {
            const pr = normalizePowerRow({ ...(pwr as Record<string, unknown>), ep: s.epNo });
            if (pr) prevPowerRows.push(pr);
          }
        }
        // v2.80 信物归属账本：提取前集归属摘要（rows[]：name/item/handed/regain/touched），全序列收集供归属记账
        const itRaw = (s.qcReport as any)?.item;
        if (itRaw && typeof itRaw === 'object' && Array.isArray((itRaw as any).rows)) {
          for (const itr of (itRaw as any).rows) {
            const ir = normalizeItemRow({ ...(itr as Record<string, unknown>), ep: s.epNo });
            if (ir) prevItemRows.push(ir);
          }
        }
        // v2.80 关系翻转账本：提取前集关系摘要（rows[]：name/other/rift/reconciled/close），全序列收集供关系记账
        const rlRaw = (s.qcReport as any)?.relation;
        if (rlRaw && typeof rlRaw === 'object' && Array.isArray((rlRaw as any).rows)) {
          for (const rlr of (rlRaw as any).rows) {
            const rr = normalizeRelRow({ ...(rlr as Record<string, unknown>), ep: s.epNo });
            if (rr) prevRelRows.push(rr);
          }
        }
        // v2.80 阵营归属账本：提取前集归属摘要（rows[]：name/org/left/rejoined/loyal），全序列收集供归属记账
        const afRaw = (s.qcReport as any)?.affiliation;
        if (afRaw && typeof afRaw === 'object' && Array.isArray((afRaw as any).rows)) {
          for (const afr of (afRaw as any).rows) {
            const ar = normalizeAffRow({ ...(afr as Record<string, unknown>), ep: s.epNo });
            if (ar) prevAffRows.push(ar);
          }
        }
        // v2.80 地点跨集账本：提取前集地点摘要（rows[]：name/place/left/arrived/stranded/rescued），全序列收集供地点记账
        const lcRaw = (s.qcReport as any)?.location;
        if (lcRaw && typeof lcRaw === 'object' && Array.isArray((lcRaw as any).rows)) {
          for (const lcr of (lcRaw as any).rows) {
            const lr = normalizeLocRow({ ...(lcr as Record<string, unknown>), ep: s.epNo });
            if (lr) prevLocRows.push(lr);
          }
        }
        // v2.80 秘密泄露账本：提取前集知情摘要（rows[]：a/b/told/knows/witness），全序列收集供泄露记账
        const lkRaw = (s.qcReport as any)?.secretLeak;
        if (lkRaw && typeof lkRaw === 'object' && Array.isArray((lkRaw as any).rows)) {
          for (const lkr of (lkRaw as any).rows) {
            const lr = normalizeLeakRow({ ...(lkr as Record<string, unknown>), ep: s.epNo });
            if (lr) prevLeakRows.push(lr);
          }
        }
        // v2.80 伪装身份账本：提取前集伪装摘要（rows[]：name/alias/disguised/revealed），全序列收集供伪装记账
        const dgRaw = (s.qcReport as any)?.disguise;
        if (dgRaw && typeof dgRaw === 'object' && Array.isArray((dgRaw as any).rows)) {
          for (const dgr of (dgRaw as any).rows) {
            const dr = normalizeDisguiseRow({ ...(dgr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevDisguiseRows.push(dr);
          }
        }
        // v2.80 人情债账本：提取前集债务摘要（rows[]：debtor/creditor/owed/repaid/betrayed），全序列收集供债务记账
        const dbRaw = (s.qcReport as any)?.debt;
        if (dbRaw && typeof dbRaw === 'object' && Array.isArray((dbRaw as any).rows)) {
          for (const dbr of (dbRaw as any).rows) {
            const dr = normalizeDebtRow({ ...(dbr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevDebtRows.push(dr);
          }
        }
        // v2.80 联盟账本：提取前集联盟摘要（rows[]：a/b/allied/dissolved/hostile），全序列收集供联盟记账
        const alRaw = (s.qcReport as any)?.alliance;
        if (alRaw && typeof alRaw === 'object' && Array.isArray((alRaw as any).rows)) {
          for (const alr of (alRaw as any).rows) {
            const dr = normalizeAllianceRow({ ...(alr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevAllianceRows.push(dr);
          }
        }
        // v2.80 记忆账本：提取前集记忆摘要（rows[]：name/lost/restored/recalled），全序列收集供记忆记账
        const memRaw = (s.qcReport as any)?.memory;
        if (memRaw && typeof memRaw === 'object' && Array.isArray((memRaw as any).rows)) {
          for (const memr of (memRaw as any).rows) {
            const dr = normalizeMemoryRow({ ...(memr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevMemoryRows.push(dr);
          }
        }
        // v2.80 冒充账本：提取前集冒充摘要（rows[]：imposter/victim/impersonated/exposed/recognized），全序列收集供冒充记账
        const impRaw = (s.qcReport as any)?.impersonation;
        if (impRaw && typeof impRaw === 'object' && Array.isArray((impRaw as any).rows)) {
          for (const impr of (impRaw as any).rows) {
            const dr = normalizeImpersonationRow({ ...(impr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevImpersonationRows.push(dr);
          }
        }
        // v2.80 背叛账本：提取前集背叛摘要（rows[]：betrayer/victim/betrayed/reconciled/cooperated），全序列收集供背叛记账
        const btrRaw = (s.qcReport as any)?.betrayal;
        if (btrRaw && typeof btrRaw === 'object' && Array.isArray((btrRaw as any).rows)) {
          for (const btr of (btrRaw as any).rows) {
            const dr = normalizeBetrayalRow({ ...(btr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevBetrayalRows.push(dr);
          }
        }
        // v2.80 牺牲账本：提取前集牺牲摘要（rows[]：giver/receiver/sacrificed/thanked/mistreated），全序列收集供牺牲记账
        const sacRaw = (s.qcReport as any)?.sacrifice;
        if (sacRaw && typeof sacRaw === 'object' && Array.isArray((sacRaw as any).rows)) {
          for (const sr of (sacRaw as any).rows) {
            const dr = normalizeSacrificeRow({ ...(sr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevSacrificeRows.push(dr);
          }
        }
        // v2.80 诅咒账本：提取前集诅咒摘要（rows[]：name/cursed/lifted/unaffected），全序列收集供诅咒记账
        const curRaw = (s.qcReport as any)?.curse;
        if (curRaw && typeof curRaw === 'object' && Array.isArray((curRaw as any).rows)) {
          for (const cr of (curRaw as any).rows) {
            const dr = normalizeCurseRow({ ...(cr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevCurseRows.push(dr);
          }
        }
        // v2.80 附身账本：提取前集附身摘要（rows[]：name/possessed/freed/self_willed），全序列收集供附身记账
        const posRaw = (s.qcReport as any)?.possession;
        if (posRaw && typeof posRaw === 'object' && Array.isArray((posRaw as any).rows)) {
          for (const pr of (posRaw as any).rows) {
            const dr = normalizePossessionRow({ ...(pr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevPossessionRows.push(dr);
          }
        }
        // v2.80 穿越账本：提取前集穿越摘要（rows[]：name/traveled/returned/native），全序列收集供穿越记账
        const ttRaw = (s.qcReport as any)?.timeTravel;
        if (ttRaw && typeof ttRaw === 'object' && Array.isArray((ttRaw as any).rows)) {
          for (const tr of (ttRaw as any).rows) {
            const dr = normalizeTimeTravelRow({ ...(tr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevTimeTravelRows.push(dr);
          }
        }
        // v2.80 变身账本：提取前集变身摘要（rows[]：name/transformed/reverted/original），全序列收集供变身记账
        const tfRaw = (s.qcReport as any)?.transformation;
        if (tfRaw && typeof tfRaw === 'object' && Array.isArray((tfRaw as any).rows)) {
          for (const fr of (tfRaw as any).rows) {
            const dr = normalizeTransformationRow({ ...(fr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevTransformationRows.push(dr);
          }
        }
        // v2.80 中毒账本：提取前集中毒摘要（rows[]：name/poisoned/cured/healthy），全序列收集供中毒记账
        const poiRaw = (s.qcReport as any)?.poison;
        if (poiRaw && typeof poiRaw === 'object' && Array.isArray((poiRaw as any).rows)) {
          for (const pr of (poiRaw as any).rows) {
            const dr = normalizePoisonRow({ ...(pr as Record<string, unknown>), ep: s.epNo });
            if (dr) prevPoisonRows.push(dr);
          }
        }
        const payIds = Array.isArray(b?.payoffIds) ? b.payoffIds.filter((x: unknown): x is string => typeof x === 'string') : [];
        const emoPath = Array.isArray(b?.emotionPath) ? b.emotionPath.filter((x: unknown): x is string => typeof x === 'string') : [];
        const revId = typeof b?.reversalId === 'string' ? b.reversalId : null;
        if (revId || payIds.length || emoPath.length) {
          prevDevices.push({ ep: s.epNo, reversalId: revId, payoffIds: payIds, emotionPath: emoPath });
        }
      }
      prevDevices.sort((a, b) => a.ep - b.ep); // 疲劳引擎按 ep 升序判连续段
      prevMystery.sort((a, b) => a.ep - b.ep); // 干旱账本按 ep 升序记账
    }
    // v2.80 配角在场台账：圣经角色名 × 前集正文 includes 匹配出在场位
    // v2.193 c193 复盘修复：旧 IIFE 只认数组形态，而 pipeline 主路径（pipeline.ts
    // bible.characters[name]={...}）回写对象形态 → 第 2 集起名表恒空、在场/关系线台账静默失效。
    // 统一走 extractBibleCastNames（对象/数组/JSON 字符串三形态；≥2≤12 字、去重、cap 20）。
    const castNameList: string[] = extractBibleCastNames((bible as { characters?: unknown } | null)?.characters);
    const prevPresence = castNameList.map((name) => ({
      name,
      presentIn: trackedRows.filter((r) => r.content.includes(name)).map((r) => r.epNo),
    }));
    const prevPairs = derivePairBits(prevPresence); // v2.80 角色两两同场位 → 关系线保鲜台账 → 架构师同场调度约束
    // 请求未显式带钩子偏好时，沿用建项目时落库的偏好（边写边更/重生成保持一致）
    const storedHookPref = (() => { try { const b: any = project.bible; return b?.hookPrefs ?? undefined; } catch { return undefined; } })();
    const storedBeatPref = (() => { try { const b: any = project.bible; return b?.beatPrefs ?? undefined; } catch { return undefined; } })();
    // v2.151 角色资产：立项时快照进 project.bible.castAssets，生成时整段读出注入三岗位（全剧沿用，跨集一致）
    const storedCastAssets: CastAssetSeed[] | null = (() => {
      try {
        const b = bible as any;
        if (!Array.isArray(b?.castAssets)) return null;
        return b.castAssets.filter((x: any) => x && typeof x === 'object' && typeof x.name === 'string' && typeof x.persona === 'string').slice(0, 10);
      } catch { return null; }
    })();
    // v2.159 道具资产：立项时快照进 project.bible.propAssets，生成时整段读出注入双岗位（架构师信物埋设/撰写师提及约束，全剧沿用）
    const storedPropAssets: PropAssetSeed[] | null = (() => {
      try {
        const b = bible as any;
        if (!Array.isArray(b?.propAssets)) return null;
        return b.propAssets.filter((x: any) => x && typeof x === 'object' && typeof x.name === 'string' && typeof x.meaning === 'string').slice(0, 10);
      } catch { return null; }
    })();
    // v2.161 场景资产：立项时快照进 project.bible.sceneAssets，生成时整段读出注入双岗位（架构师节拍适配/撰写师场头氛围提及，全剧沿用）
    const storedSceneAssets: SceneAssetSeed[] | null = (() => {
      try {
        const b = bible as any;
        if (!Array.isArray(b?.sceneAssets)) return null;
        return b.sceneAssets.filter((x: any) => x && typeof x === 'object' && typeof x.name === 'string' && typeof x.meaning === 'string').slice(0, 10);
      } catch { return null; }
    })();
    const hp = parsed.data.hookPref ?? storedHookPref;
    const bp = parsed.data.beatPref ?? storedBeatPref;
    // v2.84 自主学习知识库：拉取已生效知识（高分剧本技法/市场趋势/政策规则），按 brief 相关性注入各岗位
    const knowledgeRows = await prisma.knowledgeItem.findMany({
      where: { status: 'APPROVED' },
      select: { title: true, content: true, category: true },
      orderBy: { approvedAt: 'desc' }, take: 30,
    }).catch(() => [] as { title: string; content: string; category: string }[]);
    const knowledgeHints = knowledgeRows.length
      ? knowledgeRows.map((k: { title: string; content: string; category: string }) => ({ title: k.title, content: k.content, category: k.category }))
      : null;
    const result = await runEpisode(tier, bible, enrichedBrief, emitWithProgress as never, {
      signal: abortController.signal,
      hookPref: hp ? {
        mode: hp.mode, strength: hp.strength, preferred: hp.preferred, avoid: hp.avoid,
        manual: hp.manual as Record<number, string> | undefined,
      } : undefined,
      beatPref: bp ? {
        mode: bp.mode, strength: bp.strength, preferred: bp.preferred, avoid: bp.avoid,
        manual: bp.manual as Record<number, string> | undefined,
      } : undefined,
      // v2.151 角色资产注入三岗位（架构师欲望链约束/人设师人物卡/撰写师声音特征）
      ...(storedCastAssets?.length ? { castAssets: storedCastAssets } : {}),
      // v2.159 道具资产注入双岗位（架构师信物埋设回收节拍/撰写师提及方式约束）
      ...(storedPropAssets?.length ? { propAssets: storedPropAssets } : {}),
      // v2.161 场景资产注入双岗位（架构师节拍适配与状态红线/撰写师场头氛围提及）
      ...(storedSceneAssets?.length ? { sceneAssets: storedSceneAssets } : {}),
      // v2.148 视觉画风编号：生成请求显式传入且合法时落库 project.bible（项目级配置，供分镜导出附录/海报注入读取）
      ...(isAIGC && isValidVisualStyleId(parsed.data.visualStyleId) && parsed.data.visualStyleId !== (project.bible as any)?.visualStyleId
        ? await (async () => {
            const raw = project.bible as unknown;
            const curBible = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
            const nextBible = { ...curBible, visualStyleId: parsed.data.visualStyleId };
            await prisma.project.update({ where: { id: project.id }, data: { bible: nextBible as object } });
            (project as any).bible = nextBible;
            return {};
          })()
        : {}),
      // v2.149 镜头语言编号：生成请求显式传入且合法时落库 project.bible（项目级配置，供分镜导出附录注入读取）
      ...(isAIGC && isValidCameraStyleId(parsed.data.cameraStyleId) && parsed.data.cameraStyleId !== (project.bible as any)?.cameraStyleId
        ? await (async () => {
            const raw = project.bible as unknown;
            const curBible = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
            const nextBible = { ...curBible, cameraStyleId: parsed.data.cameraStyleId };
            await prisma.project.update({ where: { id: project.id }, data: { bible: nextBible as object } });
            (project as any).bible = nextBible;
            return {};
          })()
        : {}),
      episodeIndex: epIndex,
      episodeCount: totalEps && totalEps > 0 ? totalEps : 1,
      scenesPerEp: parsed.data.scenesPerEp,
      ...(parsed.data.hookStrategy ? { hookStrategy: parsed.data.hookStrategy } : {}),
      ...(parsed.data.paceStrategy ? { paceStrategy: parsed.data.paceStrategy } : {}),
      ...(parsed.data.dialogueStrategy ? { dialogueStrategy: parsed.data.dialogueStrategy } : {}),
      ...(parsed.data.emotionStrategy ? { emotionStrategy: parsed.data.emotionStrategy } : {}),
      ...(parsed.data.characterStrategy ? { characterStrategy: parsed.data.characterStrategy } : {}),
      ...(parsed.data.customStyleText ? { customStyleText: parsed.data.customStyleText } : {}),
      ...(parsed.data.aigcDurationMin ? { aigcDurationMin: parsed.data.aigcDurationMin } : {}),
      // c223 请求级反套路档位透传（classic/balanced/innovative，缺省走 pipeline 默认 balanced）；
      // 实际生效档位随 result._profile 落库，/fix 重放同档（c222 闭环）
      ...(parsed.data.antiStrength ? { antiStrength: parsed.data.antiStrength } : {}),
      // v2.35 补漏：项目制式（真人实拍/AIGC制作）必须真正传入创作管线，此前 AIGC 只落库未生效
      ...(isAIGC ? { scriptFormat: 'AIGC' as const } : { scriptFormat: 'LIVE' as const }),
      ...(projCanonMode ? { mode: projCanonMode } : {}),
      ...(epTrack ? { modeTrack: epTrack } : {}),
      ...(parsed.data.lang ? { lang: parsed.data.lang } : {}),
      ...(knowledgeHints ? { knowledgeHints } : {}),
      // v2.93 剧情软广·结构化品牌简报（已过广告词预检），作为事实源注入架构师/撰写师/观众岗位
      ...(brandBrief ? { brandBrief } : {}),
      // v2.94 热点追更·结构化热点简报（已过隐私预检）+ 风险报告（转强制虚构化指令）
      ...(trendBrief ? { trendBrief, trendRisk: trendRisk ?? undefined } : {}),
      // v2.95 互动分支·结构化分支简报（已过闭环校验），注入架构师/撰写师
      ...(branchBrief ? { branchBrief } : {}),
      // v2.96 原作/小说/名场面原文：adapt/novel/hit_lab 模式启用 n-gram 重合度侵权检测
      // v2.319 body 缺原文（刷新续写/草稿恢复/前端框被清空）时从 project.bible 兜底，闸门不静默失效
      ...(effectiveSourceText ? { sourceText: effectiveSourceText } : {}),
      // v2.99 项目标题，用于传播端前13字公式校验
      title: project.title,
      prevEpisode,
      // v2.108→v2.109 跨集伏笔账本+角色弧光：优先从 DB qcReport 读取管线精确计算值，
      // 回退到从前集正文重算（v2.108 方式，qcReport 为空时兼容旧数据）
      prevForeshadow: prevEpisode ? (() => {
        try {
          const qcr = prevScript?.qcReport as any;
          if (qcr?.foreshadow?.plants) return { plants: qcr.foreshadow.plants, payoffs: qcr.foreshadow.payoffs ?? [], epNo: prevEpisode.epNo };
        } catch {}
        const { foreshadowLedger } = require('../engine/foreshadow-ledger');
        const r = foreshadowLedger(prevEpisode.summary);
        return { plants: r.plants, payoffs: r.payoffs, epNo: prevEpisode.epNo };
      })() : null,
      prevArc: prevEpisode ? (() => {
        try {
          const qcr = prevScript?.qcReport as any;
          if (qcr?.arcTrack?.characters) return { characters: qcr.arcTrack.characters, epNo: prevEpisode.epNo };
        } catch {}
        // v2.194 c194：旧 for...of 对对象形态圣经（pipeline 主回写形态）抛 not iterable，
        // 被 try/catch 吞掉后回退恒 null——前集弧光在 qcReport 缺失时静默不跟踪。
        // 统一走 extractBibleCastArcs（对象/数组/JSON 字符串三形态，函数自身不抛错）。
        const castNames: Record<string, string> = extractBibleCastArcs((bible as { characters?: unknown } | null)?.characters);
        if (Object.keys(castNames).length === 0) return null;
        const r = arcTracker(castNames, prevEpisode.summary);
        return { characters: r.characters, epNo: prevEpisode.epNo };
      })() : null,
      // v2.80 跨集信息差台账+人物状态台账：优先读 qcReport 精确值，回退从前集正文重算（与 prevForeshadow 同构）
      prevSecrets: prevEpisode ? (() => {
        try {
          const qcr = prevScript?.qcReport as any;
          if (qcr?.secretLedger?.nextState?.plants) return { ...qcr.secretLedger.nextState, epNo: prevEpisode.epNo };
        } catch {}
        const { secretLedger } = require('../engine/secret-ledger');
        const r = secretLedger(prevEpisode.summary);
        return { ...r.nextState, epNo: prevEpisode.epNo };
      })() : null,
      prevStates: prevEpisode ? (() => {
        try {
          const qcr = prevScript?.qcReport as any;
          if (qcr?.stateLedger?.nextState?.onsets) return { ...qcr.stateLedger.nextState, epNo: prevEpisode.epNo };
        } catch {}
        const { characterStateLedger } = require('../engine/character-state-ledger');
        const r = characterStateLedger(prevEpisode.summary);
        return { ...r.nextState, epNo: prevEpisode.epNo };
      })() : null,
      prevDevices, // v2.80 前集逐集装置布点 → 疲劳引擎 → 架构师防疲劳轮换约束
      prevPresence, // v2.80 配角跨集在场位 → 在场台账 → 架构师防遗忘调度约束
      prevPairs, // v2.80 跨集同场位 → 关系线保鲜台账 → 架构师同场调度约束
      prevSubplots, // v2.80 前集支线声明位 → 支线编织台账 → 架构师接续调度约束
      prevWaves, // v2.80 前集逐集爽感摘要 → 憋爽波浪台账 → 架构师跨集节奏布点约束
      prevHook, // v2.80 前集集尾钩子位 → 跨集兑现账本 → 架构师接钩约束 + 终稿兑现检测
      prevHumDebt, // v2.80 前集羞辱雷摘要 → 欠账引擎 → 架构师还账约束
      prevMystery, // v2.80 前集悬念线摘要 → 干旱账本 → 架构师部分答案约束
      prevHookTypes, // v2.80 前集钩型摘要 → 疲劳账本 → 架构师换型约束
      prevProps, // v2.80 前集信物摘要 → 连续性账本 → 架构师封禁/回收约束
      prevPromises, // v2.80 前集承诺摘要 → 欠账账本 → 架构师兑现约束
      prevVillainThreats: prevVillains, // v2.80 前集反派威胁摘要 → 威胁账本 → 架构师升压约束
      prevTimelineMarks, // v2.80 前集时间锚摘要 → 时序账本 → 架构师校准/补锚约束
      prevCostRows, // v2.80 前集代价摘要 → 代价账本 → 架构师先付代价约束
      prevDeathRows, // v2.80 前集死亡摘要 → 死亡账本 → 架构师复活预警约束
      prevFateRows, // v2.80 前集反派下场摘要 → 下场账本 → 架构师下场维持约束
      prevWoundRows, // v2.80 前集创伤摘要 → 创伤账本 → 架构师伤势维持约束
      prevPowerRows, // v2.80 前集境界摘要 → 境界账本 → 架构师境界连续性约束
      prevItemRows, // v2.80 前集信物归属摘要 → 归属账本 → 架构师归属连续性约束
      prevRelRows, // v2.80 前集关系摘要 → 关系账本 → 架构师关系维持约束
      prevAffRows, // v2.80 前集阵营归属摘要 → 归属账本 → 架构师阵营连续性约束
      prevLocRows, // v2.80 前集地点摘要 → 地点账本 → 架构师地点连续性约束
      prevLeakRows, // v2.80 前集知情摘要 → 泄露账本 → 架构师秘密知情范围约束
      prevDisguiseRows, // v2.80 前集伪装摘要 → 伪装账本 → 架构师身份连续性约束
      prevDebtRows, // v2.80 前集债务摘要 → 债务账本 → 架构师人情债约束
      prevAllianceRows, // v2.80 前集联盟摘要 → 联盟账本 → 架构师联盟连续性约束
      prevMemoryRows, // v2.80 前集记忆摘要 → 记忆账本 → 架构师失忆连续性约束
      prevImpersonationRows,
          prevBetrayalRows,
          prevSacrificeRows,
          prevCurseRows,
          prevPossessionRows,
          prevTimeTravelRows,
          prevTransformationRows,
          prevPoisonRows, // v2.80 前集冒充摘要 → 冒充账本 → 架构师身份重叠约束
      // v2.85 创作上下文（时令/爆款/画像/地域文化/历史脑洞/AIGC制作规范）→ 管线独立注入，不再拼进 brief
      creationContextInput: {
        profile: toEngineUserProfile({
          bio: user.bio as string, region: u.region as string, ageBand: u.ageBand as string,
          gender: u.gender as string, personalized: u.personalized as boolean,
        }, ((p.preferredTags as string[]) ?? undefined)),
        personalized: u.personalized !== false,
        board: ((p.trendingBoard as never[]) ?? boardStore.getFresh() as never[]),
        tagBrief: (p.tagBrief as string) ?? undefined,
        tags: ((p.tags as string[]) ?? (p.preferredTags as string[])) ?? undefined,
        historyAnchor: (p.historyAnchor as string) ?? undefined,
        scriptMode: isAIGC ? 'AIGC' : 'LIVE',
      } as any,
    });
    const { draft, totalCostFen, antiAi } = result;
    // 三级审核第三级：成稿机器抽检（生成前已拦 brief，此处防御性复核模型产出，后台覆写规则同样生效）
    const postScan = await scanWithStore(draft, prisma);
    const postBlocked = postScan.blocked.map((h) => ({ label: h.label, matched: h.matched, advice: h.advice }));
    const postWarns = postScan.warnings.map((h) => ({ label: h.label, advice: h.advice }));
    if (postScan.level === 'block') throw new Error('COMPLIANCE_REJECTED:终稿未通过内容审核，请调整创意后重试');
    // v2.325 mature_x 已移除，原 X 剧本露骨内容硬线不再需要
    // v2.92 模式级硬闸门：video_short/hot 命中 blocked 即不入库、不交付（走 catch 原路退还冻结积分）
    if (result.modeGate && !result.modeGate.allowed) {
      throw new Error(`MODE_HARD_BLOCK:${result.modeGate.mode}:${result.modeGate.blocked.map((b) => b.rule).join('|')}`);
    }
    // 全局圣经存回项目：下一集读到已立人物/时间线/伏笔（跨集联动）
    // JSON 序列化反序列化清理 undefined（Prisma 不允许 JSON 数组含 undefined）
    const storedBible = project.bible && typeof project.bible === 'object' && !Array.isArray(project.bible) ? project.bible : {};
    await prisma.project.update({ where: { id: projectId }, data: { bible: JSON.parse(JSON.stringify({ ...storedBible, ...result.bible })) as object } });
    // v2.84 自主学习引用追踪：更新本轮被使用知识的 lastReferencedAt，供 pruneKnowledge 判过时
    if (knowledgeHints && knowledgeHints.length) {
      const hintTitles = knowledgeHints.map((k: { title: string; content: string; category: string }) => k.title);
      await prisma.knowledgeItem.updateMany({
        where: { title: { in: hintTitles }, status: 'APPROVED' },
        data: { lastReferencedAt: new Date() },
      }).catch(() => null);
    }

    // 付费档毛利熔断；免费档为获客补贴（单日3集封顶），只记成本不熔断；
    // 内部账户由杨光承担成本做测试/运营，不熔断（realCostFen 照常落 ModelCallLog 可观测烧钱）
    if (!isStaff && !isFree && !paidViaQuota && totalCostFen > 0) assertMargin(points * FEN_PER_POINT, totalCostFen);

    const epNo = epIndex;
    // v2.80 屈辱-打脸跨集账本：终稿提取本集羞辱雷（供 qcReport.humiliation 落库，下一集欠账记账）
    const curHumBits = extractHumiliationBits(draft, epNo + 1);
    // v2.80 多集悬念干旱账本：终稿提取本集悬念线状态（供 qcReport.mystery 落库，下一集干旱记账）；集尾悬念钩定线词，无钩继承前集活跃线
    const mysPrevLast = prevMystery.length ? prevMystery[prevMystery.length - 1] : null;
    const mysHook = deriveMysteryHook(result.cliffhanger, epNo + 1);
    const mysLine = mysHook?.line || mysPrevLast?.line || '';
    const curMysteryRow = { ep: epNo + 1, line: mysLine, advanced: mysLine ? mysteryAdvanceCheck(mysLine, draft) : false, hooked: !!mysHook?.hooked };
    // v2.80 承诺欠账账本：终稿提取本集承诺线（供 qcReport.promise 落库，下一集欠账记账）；无新誓继承前集活跃承诺——债务不断链
    const prmPrevLast = prevPromises.length ? [...prevPromises].sort((a, b) => a.ep - b.ep)[prevPromises.length - 1] : null;
    const curPrmLine = derivePromiseLine(draft) || prmPrevLast?.line || '';
    const curPromiseRow = { ep: epNo + 1, line: curPrmLine, advanced: curPrmLine ? promiseAdvanceCheck(curPrmLine, draft) : false };
    // v2.80 反派威胁升级账本：终稿提取本集反派威胁动作（供 qcReport.villain 落库，下一集威胁记账）
    const curVillainAction = detectVillainAction(draft);
    // v2.80 时间线跨集账本：终稿提取本集时间锚（供 qcReport.timeline 落库，下一集时序记账）
    const curTimelineMark = deriveTimelineMark(draft);
    // v2.80 代价跨集账本：终稿提取本集胜利/代价信号（供 qcReport.cost 落库，下一集连胜记账）
    const curCostSignal = deriveCostSignal(draft);
    // v2.80 死亡穿帮账本：终稿提取本集具名角色死亡/豁免/活动信号（供 qcReport.death 落库，下一集复活记账）
    const curDeathRows: { name: string; dead: boolean; revived: boolean; active: boolean }[] = castNameList
      .map((nm) => ({ name: nm, ...deriveDeathSignal(draft, nm) }));
    // v2.80 反派下场账本：终稿提取本集具名角色下场/豁免/活动信号（供 qcReport.villainFate 落库，下一集下场记账）
    const curFateRows: { name: string; removed: boolean; exempted: boolean; active: boolean }[] = castNameList
      .map((nm) => ({ name: nm, ...deriveFateSignal(draft, nm) }));
    // v2.80 创伤恢复账本：终稿提取本集具名角色创伤/痊愈/高强度行动信号（供 qcReport.wound 落库，下一集伤势记账）
    const curWoundRows: { name: string; wounded: boolean; healed: boolean; strained: boolean }[] = castNameList
      .map((nm) => ({ name: nm, ...deriveWoundSignal(draft, nm) }));
    // v2.80 境界进阶账本：终稿提取本集具名角色境界/突破/降级/洗牌信号（供 qcReport.power 落库，下一集境界记账）
    const curPowerRows: { name: string; realm: number | null; broke: boolean; down: boolean; exempted: boolean }[] = castNameList
      .map((nm) => ({ name: nm, ...derivePowerSignal(draft, nm) }));
    // v2.80 信物归属账本：终稿提取本集具名角色让渡/拿回/经手信号（一人可多信物，flatMap 展平；供 qcReport.item 落库，下一集归属记账）
    const curItemRows: { name: string; item: string; handed: boolean; regain: boolean; touched: boolean }[] = castNameList
      .flatMap((nm) => deriveOwnershipRows(draft, nm).map((row) => ({ name: nm, ...row })));
    // v2.80 关系翻转账本：终稿提取本集句内两人名配对的决裂/修复/亲密信号（单次调用无需 flatMap；供 qcReport.relation 落库，下一集关系记账）
    const curRelRows: { name: string; other: string; rift: boolean; reconciled: boolean; close: boolean }[] = deriveRelationRows(draft, castNameList);
    // v2.80 阵营归属账本：终稿提取本集句内人名×组织名×脱离/回归/效忠信号（供 qcReport.affiliation 落库，下一集归属记账）
    const curAffRows: { name: string; org: string; left: boolean; rejoined: boolean; loyal: boolean }[] = deriveAffiliationRows(draft, castNameList);
    // v2.80 地点跨集账本：终稿提取本集句内人名×地点名×被困/到达/离开/脱困信号（供 qcReport.location 落库，下一集地点记账）
    const curLocRows: { name: string; place: string; left: boolean; arrived: boolean; stranded: boolean; rescued: boolean }[] = deriveLocationRows(draft, castNameList);
    // v2.80 秘密泄露账本：终稿提取本集句内人名×透露/知道动词×秘密词（供 qcReport.secretLeak 落库，下一集泄露记账）
    const curLeakRows: { a: string; b: string; told: boolean; knows: boolean; witness: boolean }[] = deriveLeakRows(draft, castNameList);
    // v2.80 伪装身份账本：终稿提取本集句内人名×伪装/揭穿动词（供 qcReport.disguise 落库，下一集伪装记账）
    const curDisguiseRows: { name: string; alias: string; disguised: boolean; revealed: boolean }[] = deriveDisguiseRows(draft, castNameList);
    // v2.80 人情债账本：终稿提取本集句内人名对×施恩/偿还/背叛动词（供 qcReport.debt 落库，下一集债务记账）
    const curDebtRows: { debtor: string; creditor: string; owed: boolean; repaid: boolean; betrayed: boolean }[] = deriveDebtRows(draft, castNameList);
    // v2.80 联盟账本：终稿提取本集句内人名对×结盟/瓦解/敌对动词（供 qcReport.alliance 落库，下一集联盟记账）
    const curAllianceRows: { a: string; b: string; allied: boolean; dissolved: boolean; hostile: boolean }[] = deriveAllianceRows(draft, castNameList);
    // v2.80 记忆账本：终稿提取本集句内人名×失忆/恢复/回忆动词（供 qcReport.memory 落库，下一集记忆记账）
    const curMemoryRows: { name: string; lost: boolean; restored: boolean; recalled: boolean }[] = deriveMemoryRows(draft, castNameList);
    // v2.80 冒充账本：终稿提取本集句内人名对×冒充/揭穿动词 + 人名×认出动词（供 qcReport.impersonation 落库，下一集冒充记账）
    const curImpersonationRows: { imposter: string; victim: string; impersonated: boolean; exposed: boolean; recognized: boolean }[] = deriveImpersonationRows(draft, castNameList);
    const curBetrayalRows: { betrayer: string; victim: string; betrayed: boolean; reconciled: boolean; cooperated: boolean }[] = deriveBetrayalRows(draft, castNameList);
    const curSacrificeRows: { giver: string; receiver: string; sacrificed: boolean; thanked: boolean; mistreated: boolean }[] = deriveSacrificeRows(draft, castNameList);
    const curCurseRows: { name: string; cursed: boolean; lifted: boolean; unaffected: boolean }[] = deriveCurseRows(draft, castNameList);
    const curPossessionRows: { name: string; possessed: boolean; freed: boolean; self_willed: boolean }[] = derivePossessionRows(draft, castNameList);
    const curTimeTravelRows: { name: string; traveled: boolean; returned: boolean; native: boolean }[] = deriveTimeTravelRows(draft, castNameList);
    const curTransformationRows: { name: string; transformed: boolean; reverted: boolean; original: boolean }[] = deriveTransformationRows(draft, castNameList);
    const curPoisonRows: { name: string; poisoned: boolean; cured: boolean; healthy: boolean }[] = derivePoisonRows(draft, castNameList);
    // c217 跨集连续性台账 24 键：pipeline 终稿已逐集重算但无 score 被通用摘要跳过（与 c216 六键同族病），
    // 旧版刷新即丢、/fix 不重算、前端无渲染。统一限界形态（标量状态+名册≤30+issueCount+issues≤5），
    // 落库与 SSE 共用同一份；villainFate 与短名 rows 摘要行同名碰撞，落库处单独合流（见下）。
    const continuityLedgersShaped = shapeContinuityLedgers({
      propLedger: result.propLedger,
      timelineLedger: result.timelineLedger,
      costLedger: result.costLedger,
      deathLedger: result.deathLedger,
      villainFate: result.villainFate,
      woundRecovery: result.woundRecovery,
      powerProgress: result.powerProgress,
      itemOwnership: result.itemOwnership,
      relLedger: result.relLedger,
      affLedger: result.affLedger,
      locLedger: result.locLedger,
      leakLedger: result.leakLedger,
      disguiseLedger: result.disguiseLedger,
      debtLedger: result.debtLedger,
      allianceLedger: result.allianceLedger,
      memoryLedger: result.memoryLedger,
      impersonationLedger: result.impersonationLedger,
      betrayalLedger: result.betrayalLedger,
      sacrificeLedger: result.sacrificeLedger,
      curseLedger: result.curseLedger,
      possessionLedger: result.possessionLedger,
      timeTravelLedger: result.timeTravelLedger,
      transformationLedger: result.transformationLedger,
      poisonLedger: result.poisonLedger,
    });
    const continuityVillainFateDiag = continuityLedgersShaped.villainFate as Record<string, unknown> | undefined;
    const continuityLedgersRest: Record<string, unknown> = { ...continuityLedgersShaped };
    delete continuityLedgersRest.villainFate;
    await prisma.script.create({
      data: {
        projectId, epNo: epNo + 1, title: `第${epNo + 1}集`, synopsis: brief.slice(0, 120),
        content: draft, wordCount: draft.length, qcPassed: antiAi.pass,
        // v2.109 持久化伏笔账本+角色弧光到 qcReport，供下一集精确读取（此前在前集正文2000字上重算，不够准）
        // v2.150 复盘修复：展开 QC 引擎摘要（score+hits 轻量摘要，台账键已排除），恢复 v2.129 质检聚合卡数据源；
        // 台账键字面量后写优先，双保险防覆盖
        qcReport: {
          ...buildQcEngineDigest(result as unknown as Record<string, unknown>),
          // c216 跨集诊断台账六键：pipeline 终稿已重算但无 score 被通用摘要跳过，旧版刷新即丢；
          // 长名诊断键与下方短名摘要行（供下一集 prev）零碰撞，统一限界形态（状态字段+issueCount+issues≤5）
          ...shapeLedgerDiagnoses({
            hookPayoff: result.hookPayoff,
            humiliationDebt: result.humiliationDebt,
            mysteryDrought: result.mysteryDrought,
            hookFatigue: result.hookFatigue,
            promiseDrought: result.promiseDrought,
            villainThreat: result.villainThreat,
          }),
          // c217 跨集连续性台账 23 键（villainFate 同名碰撞在下方短名行处合流）：
          // 长名诊断键与短名摘要行零碰撞，统一限界形态，旧版无 score 被通用摘要整体跳过
          ...continuityLedgersRest,
          // c218 闸门引擎四键（反套路/口语化/落地感/字数闸门）：无顶层 score 被通用摘要硬过滤，
          // QC 重试耗尽后的失败态此前静默出货；限界削形（pass/ready+issueCount+hits≤8）落库。
          // rhythm/character/styleCheck/propMotifRhythm 半盲键已由上方 buildQcEngineDigest 覆盖，不重复写
          ...shapeGateEngines(result as unknown as Record<string, unknown>),
          foreshadow: { plants: result.foreshadow.plants, payoffs: result.foreshadow.payoffs, score: result.foreshadow.score },
          // c210：统一走限界 digest（旧写法裸存 characters，含无界 emotionTrack/relations，且丢 stalled/jumpCut/issues）
          arcTrack: arcTrackerDigest(result.arcTrack),
          // c211：sceneSoftEnding 统一限界 digest（旧路径走通用摘要，advice 字符串被丢、issues 截断口径与 SSE 不一致）；
          // showDontTell 是 issues 形态无顶层 hits，旧通用摘要整体漏掉、只在 SSE 流里出现，刷新后质检卡永久失明
          sceneSoftEnding: sceneSoftEndingDigest(result.sceneSoftEnding),
          showDontTell: showDontTellDigest(result.showDontTell),
          // v2.80 跨集信息差/人物状态台账（nextState 供下一集精确读取）+ 本集节拍 plan + 上集回顾
          secretLedger: { nextState: result.secretLedger.nextState, score: result.secretLedger.score },
          stateLedger: { nextState: result.stateLedger.nextState, score: result.stateLedger.score },
          // v2.132 修复闭环对比面板：闸门前→终稿六维对比落库，全本诊断面板持久渲染
          fixLoop: result.fixLoop,
          beats: { reversalId: result.beats?.plan?.reversalId ?? null, payoffIds: result.beats?.plan?.payoffIds ?? [], emotionPath: result.beats?.plan?.emotionPath ?? [] },
          // v2.80 支线编织台账：落库本集大纲的活跃支线声明，供下一集接续调度（断线检测→生成闭环）
          outline: { subplots: deriveSubplotBits(result.outline, epNo + 1).map((b) => b.thread) },
          // v2.80 憋爽波浪台账：落库本集爽感摘要四元组，供下一集跨集节奏调度（只虐不爽/一路平推检测→生成闭环）
          payoffRhythm: { suppressCount: result.payoffRhythm.suppressCount, releaseCount: result.payoffRhythm.releaseCount, strongReleaseCount: result.payoffRhythm.strongReleaseCount, firstReleasePosition: result.payoffRhythm.firstReleasePosition },
          // v2.80 集尾钩子跨集兑现：落库本集钩子位（此前 cliffhanger 只进 SSE 不进 qcReport，下一集读不到）+ 本集兑现检测结果
          // c209：issues/planAlignment 一并落库（此前只在 SSE 流，刷新即丢，前端质检卡无数据源），统一走 digest 限界
          cliffhanger: cliffhangerDigest(result.cliffhanger),
          // v2.80 跨集钩型疲劳账本：落库本集开场钩规划 ID，供下一集 run-length 记账（与 cliffhanger.type 配对成完整钩型行）
          openHook: { id: result.hooks.plan.openHookId },
          // v2.80 信物跨集账本：落库本集信物提及（name/closed），供下一集连续性记账（检测→生成闭环）
          props: { items: extractPropMentions(draft) },
          // v2.80 屈辱-打脸跨集账本：落库本集羞辱雷摘要，供下一集欠账记账（检测→生成闭环）
          humiliation: { planted: curHumBits.length, paid: result.payoffRhythm.humiliationPaidCount, strong: result.payoffRhythm.strongReleaseCount, markers: [...new Set(curHumBits.map((b) => b.marker))].slice(0, 5) },
          // v2.80 多集悬念干旱账本：落库本集悬念线摘要（line/advanced/hooked），供下一集干旱记账（检测→生成闭环）
          mystery: { line: curMysteryRow.line, advanced: curMysteryRow.advanced, hooked: curMysteryRow.hooked },
          // v2.80 承诺欠账账本：落库本集承诺线摘要（line/advanced），供下一集欠账记账（检测→生成闭环）
          promise: { line: curPromiseRow.line, advanced: curPromiseRow.advanced },
          // v2.80 反派威胁升级账本：落库本集反派威胁动作摘要（line/acted/level），供下一集威胁记账（检测→生成闭环）
          villain: { line: curVillainAction.line, acted: curVillainAction.level > 0, level: curVillainAction.level },
          // v2.80 时间线跨集账本：落库本集时间锚摘要（mark/spanDays），供下一集时序记账（检测→生成闭环）
          timeline: { mark: curTimelineMark.mark, spanDays: curTimelineMark.spanDays },
          // v2.80 代价跨集账本：落库本集代价摘要（won/paid），供下一集连胜记账（检测→生成闭环）
          cost: { won: curCostSignal.won, paid: curCostSignal.paid },
          // v2.80 死亡穿帮账本：落库本集具名角色死亡摘要（rows[]），供下一集复活记账（检测→生成闭环）
          death: { rows: curDeathRows },
          // v2.80 反派下场账本：落库本集具名角色下场摘要（rows[]），供下一集下场维持记账（检测→生成闭环）
          // c217：rows 摘要行与 villainFate 长名诊断（felled/issueCount/issues）合流——同名键不得互相覆盖，
          // 下一集 prev 读 rows，前端质检卡读 issueCount/issues
          villainFate: { rows: curFateRows, ...(continuityVillainFateDiag ?? {}) },
          // v2.80 创伤恢复账本：落库本集具名角色创伤摘要（rows[]），供下一集伤势维持记账（检测→生成闭环）
          wound: { rows: curWoundRows },
          // v2.80 境界进阶账本：落库本集具名角色境界摘要（rows[]），供下一集境界连续性记账（检测→生成闭环）
          power: { rows: curPowerRows },
          // v2.80 信物归属账本：落库本集具名角色归属摘要（rows[]），供下一集归属连续性记账（检测→生成闭环）
          item: { rows: curItemRows },
          // v2.80 关系翻转账本：落库本集关系摘要（rows[]），供下一集关系连续性记账（检测→生成闭环）
          relation: { rows: curRelRows },
          // v2.80 阵营归属账本：落库本集阵营归属摘要（rows[]），供下一集归属连续性记账（检测→生成闭环）
          affiliation: { rows: curAffRows },
          // v2.80 地点跨集账本：落库本集地点摘要（rows[]），供下一集地点连续性记账（检测→生成闭环）
          location: { rows: curLocRows },
          // v2.80 秘密泄露账本：落库本集知情摘要（rows[]），供下一集秘密知情范围记账（检测→生成闭环）
          secretLeak: { rows: curLeakRows },
          // v2.80 伪装身份账本：落库本集伪装摘要（rows[]），供下一集伪装身份连续性记账（检测→生成闭环）
          disguise: { rows: curDisguiseRows },
          // v2.80 人情债账本：落库本集债务摘要（rows[]），供下一集人情债连续性记账（检测→生成闭环）
          debt: { rows: curDebtRows },
          // v2.80 联盟账本：落库本集联盟摘要（rows[]），供下一集联盟连续性记账（检测→生成闭环）
          alliance: { rows: curAllianceRows },
          // v2.80 记忆账本：落库本集记忆摘要（rows[]），供下一集失忆连续性记账（检测→生成闭环）
          memory: { rows: curMemoryRows },
          // v2.80 冒充账本：落库本集冒充摘要（rows[]），供下一集身份重叠连续性记账（检测→生成闭环）
          impersonation: { rows: curImpersonationRows },
        betrayal: { rows: curBetrayalRows },
        sacrifice: { rows: curSacrificeRows },
        curse: { rows: curCurseRows },
        possession: { rows: curPossessionRows },
        timeTravel: { rows: curTimeTravelRows },
        transformation: { rows: curTransformationRows },
        poison: { rows: curPoisonRows },
          recap: result.recap,
          // c219 AIGC 构成仪表盘数据落库：aigcManifest/aigcVolumePlan/aigcCurve/format 此前只走 SSE done，
          // 刷新后仪表盘消失（失明）。统一存 qcReport._aigc，前端 refreshResultScripts 读取重渲染。
          // 非 AIGC 格式（LIVE 实拍本）aigcManifest 为 null，_aigc 存 null，前端隐藏仪表盘。
          _aigc: result.aigcManifest ? {
            durationMin: parsed.data.aigcDurationMin ?? 1, // c219 持久化成片时长，供 /fix 重算 volumePlan/format 时复用（默认 1 分钟）
            manifest: { shotCount: result.aigcManifest.shotCount, title: result.aigcManifest.title }, // 只存仪表盘需要的 shotCount/title，避免 shots[] 数组（≈30-50KB）撑爆 qcReport
            volumePlan: result.aigcVolumePlan,
            curve: result.aigcCurve,
            format: result.format,
          } : null,
          // c222 请求级档位随 qcReport 落库：antiStrength/colloquialLevel 影响闸门 pass 阈值
          // （classic≤4/balanced≤2、low≤5/mid≤2.5/high≤1），不落库则 /fix 重放只能用默认档
          // （错档重放比旧值更有害，见 SKILL #82②）；_profile 持久化供 /fix 与生成期同口径重放。
          _profile: result._profile,
        },
      },
    });
    await prisma.modelCallLog.create({
      data: { taskId: task.id, role: 'writer', engineTier: tier, costFen: totalCostFen, priceFen: points * FEN_PER_POINT },
    });
    if (!isStaff && !isFree && !paidViaQuota && points > 0) {
      await withBillingTransaction(prisma, user.id, (tx) => settle(tx, user.id, points, task.id, `settle:${task.id}`));
    }
    await prisma.generationTask.update({ where: { id: task.id }, data: { status: 'DONE', finishedAt: new Date() } });
    // 立项机会评估（红蓝海/稀缺/激励/系列化），随完成事件给用户“剧本值不值钱”的判断
    const opportunity = opportunityRadar({
      tags: ((p.tags as string[]) ?? (p.preferredTags as string[])) ?? [],
      board: ((p.trendingBoard as never[]) ?? boardStore.getFresh() as never[]),
      seriesSeason: (p.seriesSeason as 2 | 3) ?? undefined,
    });
    send({ stage: 'done', pointsCharged: points, realCostFen: totalCostFen, fellbacks: result.fellbacks, free: isFree, viaQuota: paidViaQuota, staff: isStaff, taskId: task.id, antiAi, market: result.market, audience: result.audience, hooks: result.hooks, beats: result.beats, sandbox: result.sandbox, opportunity, aiLabel: isAIGC ? aiDisclaimer('zh') : null,
      postScan: { level: postScan.level, blocked: postBlocked, warnings: postWarns },
      modeGate: result.modeGate ? { mode: result.modeGate.mode, score: result.modeGate.score, blocked: result.modeGate.blocked, warnings: result.modeGate.warnings } : null,
      craftLint: result.craftLint ? { avg: result.craftLint.avg, p0: result.craftLint.p0, p1: result.craftLint.p1, issues: result.craftLint.issues.map((i) => ({ rule: i.rule, dim: i.dim, level: i.level, score: i.score, advice: i.advice })) } : null,
      hitTeardown: result.hitTeardown ? { hookType: result.hitTeardown.hookType, personaContrast: result.hitTeardown.personaContrast, coolDensity: result.hitTeardown.coolDensity, tensionCurve: result.hitTeardown.tensionCurve, boomReasons: result.hitTeardown.boomReasons, techniques: result.hitTeardown.techniques } : null,
      craftDepth: result.craftDepth ? { avg: result.craftDepth.avg, p1: result.craftDepth.p1.map((i) => ({ dim: i.dim, advice: i.advice, level: i.level, rule: i.rule })), p2: result.craftDepth.p2.map((i) => ({ dim: i.dim, advice: i.advice, level: i.level, rule: i.rule })), emotion: result.craftDepth.emotion, webnovel: result.craftDepth.webnovel, archetype: result.craftDepth.archetype, narrative: result.craftDepth.narrative } : null,
      track: result.track,
      titlePitch: result.titlePitch,
      epThreeQ: result.epThreeQ,
      openingCheck: result.openingCheck,
      scorecard: result.scorecard,
      fixLoop: result.fixLoop,
      genres: result.genres,
      investor: result.investor,
      aigcBeatPlan: result.aigcBeatPlan,
      foreshadow: { score: result.foreshadow.score, plants: result.foreshadow.plants.length, payoffs: result.foreshadow.payoffs.length, dangling: result.foreshadow.dangling, issues: result.foreshadow.issues },
      arcTrack: arcTrackerDigest(result.arcTrack), // c210：SSE 与批量落库同形态（限界、字段集一致），前端 arcTrackTip/弧光卡零改动
      // v2.80 跨集信息差台账（悬空秘密/揭示失忆/节奏失衡）+ 人物状态台账（状态悬空/凭空恢复）+ 上集回顾
      secretLedger: { score: result.secretLedger.score, plantCount: result.secretLedger.plants.length, revealCount: result.secretLedger.reveals.length, dangling: result.secretLedger.dangling, amnesia: result.secretLedger.amnesia, issues: result.secretLedger.issues },
      stateLedger: { score: result.stateLedger.score, unresolved: result.stateLedger.unresolved, issues: result.stateLedger.issues },
      recap: result.recap,
      voicePrint: { score: result.voicePrint.score, similarPairs: result.voicePrint.similarPairs.slice(0, 5), homogeneousAll: result.voicePrint.homogeneousAll, prints: result.voicePrint.prints.map((p: any) => ({ name: p.name, lineCount: p.lineCount, signature: p.signature })), issues: result.voicePrint.issues },
      dialogueAiTaste: { score: result.dialogueAiTaste.score, issues: result.dialogueAiTaste.issues.slice(0, 10).map((i: any) => ({ line: i.line, type: i.type, severity: i.severity, advice: i.advice })), breakdown: result.dialogueAiTaste.breakdown },
      sceneEmotionFlat: { score: result.sceneEmotionFlat.score, totalScenes: result.sceneEmotionFlat.totalScenes, flatCount: result.sceneEmotionFlat.flatScenes.length, flatScenes: result.sceneEmotionFlat.flatScenes.slice(0, 5).map((s: any) => ({ sceneHeader: s.sceneHeader, reason: s.reason, advice: s.advice })), issues: result.sceneEmotionFlat.issues },
      sensoryDetail: { score: result.sensoryDetail.score, covered: result.sensoryDetail.covered, missing: result.sensoryDetail.missing, counts: result.sensoryDetail.counts, nonVisualCount: result.sensoryDetail.nonVisualCount, issues: result.sensoryDetail.issues, advice: result.sensoryDetail.advice },
      vagueWord: { score: result.vagueWord.score, totalCount: result.vagueWord.totalCount, counts: result.vagueWord.counts, densityPer100: result.vagueWord.densityPer100, hits: result.vagueWord.hits.slice(0, 8).map((h: any) => ({ word: h.word, type: h.type, snippet: h.snippet })), issues: result.vagueWord.issues, advice: result.vagueWord.advice },
      dialogueNameCall: { score: result.dialogueNameCall.score, callCount: result.dialogueNameCall.callCount, totalDialogueLines: result.dialogueNameCall.totalDialogueLines, overusedScenes: result.dialogueNameCall.scenes.filter((s: any) => s.overused).map((s: any) => ({ sceneHeader: s.sceneHeader, speakerCount: s.speakerCount, callCount: s.callCount, lineCount: s.lineCount, ratio: s.ratio })), hits: result.dialogueNameCall.hits.slice(0, 8).map((h: any) => ({ speaker: h.speaker, called: h.called, line: h.line })), issues: result.dialogueNameCall.issues, advice: result.dialogueNameCall.advice },
      dialoguePingpong: { score: result.dialoguePingpong.score, overusedScenes: result.dialoguePingpong.scenes.filter((s: any) => s.overused).map((s: any) => ({ sceneHeader: s.sceneHeader, questionCount: s.questionCount, directAnswerCount: s.directAnswerCount, maxChain: s.maxChain, evidence: s.evidence })), issues: result.dialoguePingpong.issues, advice: result.dialoguePingpong.advice },
      hollowAction: { score: result.hollowAction.score, actionSentences: result.hollowAction.actionSentences, densityPer10: result.hollowAction.densityPer10, gestureCounts: result.hollowAction.gestureCounts, repeatedGestures: result.hollowAction.repeatedGestures, hits: result.hollowAction.hits.slice(0, 8).map((h: any) => ({ line: h.line, gesture: h.gesture, snippet: h.snippet })), issues: result.hollowAction.issues, advice: result.hollowAction.advice },
      emotionWhiplash: { score: result.emotionWhiplash.score, flips: result.emotionWhiplash.flips, pardoned: result.emotionWhiplash.pardoned, hits: result.emotionWhiplash.hits.slice(0, 8).map((h: any) => ({ type: h.type, line: h.line, speaker: h.speaker, from: h.from, to: h.to, prevSnippet: h.prevSnippet, nextSnippet: h.nextSnippet })), issues: result.emotionWhiplash.issues, advice: result.emotionWhiplash.advice },
      echoDialogue: { score: result.echoDialogue.score, dialogueTurns: result.echoDialogue.dialogueTurns, parrotCount: result.echoDialogue.parrotCount, restateCount: result.echoDialogue.restateCount, hits: result.echoDialogue.hits.slice(0, 8).map((h: any) => ({ type: h.type, line: h.line, speaker: h.speaker, echoed: h.echoed, source: h.source, snippet: h.snippet })), issues: result.echoDialogue.issues, advice: result.echoDialogue.advice },
      expositionDialogue: { score: result.expositionDialogue.score, dialogueLines: result.expositionDialogue.dialogueLines, dumpRate: result.expositionDialogue.dumpRate, hits: result.expositionDialogue.hits.slice(0, 8).map((h: any) => ({ type: h.type, line: h.line, speaker: h.speaker, length: h.length, snippet: h.snippet, reason: h.reason })), issues: result.expositionDialogue.issues, advice: result.expositionDialogue.advice },
      sceneSoftEnding: sceneSoftEndingDigest(result.sceneSoftEnding), // c211：与批量落库同形态（hits≤8/字段截断/advice 保留），避免流里与刷新后两份数据
      emotionLabelDialogue: { score: result.emotionLabelDialogue.score, dialogueLines: result.emotionLabelDialogue.dialogueLines, rate: result.emotionLabelDialogue.rate, hits: result.emotionLabelDialogue.hits.slice(0, 8).map((h: any) => ({ line: h.line, speaker: h.speaker, emotion: h.emotion, snippet: h.snippet })), issues: result.emotionLabelDialogue.issues, advice: result.emotionLabelDialogue.advice },
      roundRobinDialogue: { score: result.roundRobinDialogue.score, sceneCount: result.roundRobinDialogue.sceneCount, hits: result.roundRobinDialogue.hits.slice(0, 8).map((h: any) => ({ sceneHeader: h.sceneHeader, speakers: h.speakers, turnCount: h.turnCount, minLen: h.minLen, maxLen: h.maxLen, evidence: h.evidence, reason: h.reason })), issues: result.roundRobinDialogue.issues, advice: result.roundRobinDialogue.advice },
      rhetoricalBarrage: { score: result.rhetoricalBarrage.score, dialogueLines: result.rhetoricalBarrage.dialogueLines, hits: result.rhetoricalBarrage.hits.slice(0, 8).map((h: any) => ({ sceneHeader: h.sceneHeader, speaker: h.speaker, startLine: h.startLine, endLine: h.endLine, questionCount: h.questionCount, evidence: h.evidence, reason: h.reason })), issues: result.rhetoricalBarrage.issues, advice: result.rhetoricalBarrage.advice },
      mirrorVisualDialogue: { score: result.mirrorVisualDialogue.score, dialogueLines: result.mirrorVisualDialogue.dialogueLines, hits: result.mirrorVisualDialogue.hits.slice(0, 8).map((h: any) => ({ line: h.line, speaker: h.speaker, narration: h.narration, dialogue: h.dialogue, shared: h.shared, reason: h.reason })), issues: result.mirrorVisualDialogue.issues, advice: result.mirrorVisualDialogue.advice },
      mindReadingNarration: { score: result.mindReadingNarration.score, narrationLines: result.mindReadingNarration.narrationLines, hits: result.mindReadingNarration.hits.slice(0, 8).map((h: any) => ({ line: h.line, verb: h.verb, snippet: h.snippet, reason: h.reason })), issues: result.mindReadingNarration.issues, advice: result.mindReadingNarration.advice },
      crowdReaction: { score: result.crowdReaction.score, narrationLines: result.crowdReaction.narrationLines, hits: result.crowdReaction.hits.slice(0, 8).map((h: any) => ({ line: h.line, crowd: h.crowd, reaction: h.reaction, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.crowdReaction.issues, advice: result.crowdReaction.advice },
      patheticFallacy: { score: result.patheticFallacy.score, narrationLines: result.patheticFallacy.narrationLines, hits: result.patheticFallacy.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, subject: h.subject, emotion: h.emotion, snippet: h.snippet, reason: h.reason })), issues: result.patheticFallacy.issues, advice: result.patheticFallacy.advice },
      omniscientTease: { score: result.omniscientTease.score, narrationLines: result.omniscientTease.narrationLines, hits: result.omniscientTease.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, phrase: h.phrase, snippet: h.snippet, reason: h.reason })), issues: result.omniscientTease.issues, advice: result.omniscientTease.advice },
      effortGloss: { score: result.effortGloss.score, narrationLines: result.effortGloss.narrationLines, hits: result.effortGloss.hits.slice(0, 8).map((h: any) => ({ line: h.line, phrase: h.phrase, result: h.result, snippet: h.snippet, reason: h.reason })), issues: result.effortGloss.issues, advice: result.effortGloss.advice },
      reactionCliche: { score: result.reactionCliche.score, narrationLines: result.reactionCliche.narrationLines, hits: result.reactionCliche.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, tokens: h.tokens, snippet: h.snippet, reason: h.reason })), overusedTokens: result.reactionCliche.overusedTokens, issues: result.reactionCliche.issues, advice: result.reactionCliche.advice },
      infoDelivery: { score: result.infoDelivery.score, narrationLines: result.infoDelivery.narrationLines, hits: result.infoDelivery.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, channel: h.channel, snippet: h.snippet, reason: h.reason })), issues: result.infoDelivery.issues, advice: result.infoDelivery.advice },
      atmosphereTell: { score: result.atmosphereTell.score, narrationLines: result.atmosphereTell.narrationLines, hits: result.atmosphereTell.hits.slice(0, 8).map((h: any) => ({ line: h.line, subject: h.subject, mood: h.mood, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.atmosphereTell.issues, advice: result.atmosphereTell.advice },
      confrontationDodge: { score: result.confrontationDodge.score, sceneCount: result.confrontationDodge.sceneCount, hits: result.confrontationDodge.hits.slice(0, 8).map((h: any) => ({ line: h.line, imminent: h.imminent, interrupt: h.interrupt, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.confrontationDodge.issues, advice: result.confrontationDodge.advice },
      selfIntroDump: { score: result.selfIntroDump.score, hits: result.selfIntroDump.hits.slice(0, 8).map((h: any) => ({ line: h.line, snippet: h.snippet, elements: h.elements, reason: h.reason })), issues: result.selfIntroDump.issues, advice: result.selfIntroDump.advice },
      moralNarration: { score: result.moralNarration.score, narrationLines: result.moralNarration.narrationLines, hits: result.moralNarration.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, phrase: h.phrase, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.moralNarration.issues, advice: result.moralNarration.advice },
      emptyThreat: { score: result.emptyThreat.score, sceneCount: result.emptyThreat.sceneCount, hits: result.emptyThreat.hits.slice(0, 8).map((h: any) => ({ line: h.line, phrase: h.phrase, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.emptyThreat.issues, advice: result.emptyThreat.advice },
      timeJumpPayoff: { score: result.timeJumpPayoff.score, hits: result.timeJumpPayoff.hits.slice(0, 8).map((h: any) => ({ line: h.line, jump: h.jump, payoff: h.payoff, snippet: h.snippet, reason: h.reason })), issues: result.timeJumpPayoff.issues, advice: result.timeJumpPayoff.advice },
      emotionPropCrutch: { score: result.emotionPropCrutch.score, narrationLines: result.emotionPropCrutch.narrationLines, familyCounts: result.emotionPropCrutch.familyCounts, hits: result.emotionPropCrutch.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, families: h.families, phrase: h.phrase, snippet: h.snippet, charged: h.charged, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.emotionPropCrutch.issues, advice: result.emotionPropCrutch.advice },
      emotionVentCliche: { score: result.emotionVentCliche.score, narrationLines: result.emotionVentCliche.narrationLines, familyCounts: result.emotionVentCliche.familyCounts, hits: result.emotionVentCliche.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, families: h.families, phrase: h.phrase, snippet: h.snippet, charged: h.charged, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.emotionVentCliche.issues, advice: result.emotionVentCliche.advice },
      actionEcho: { score: result.actionEcho.score, dialogueLines: result.actionEcho.dialogueLines, hits: result.actionEcho.hits.slice(0, 8).map((h: any) => ({ line: h.line, speaker: h.speaker, kind: h.kind, action: h.action, narration: h.narration, dialogue: h.dialogue, charged: h.charged, rescued: h.rescued, reason: h.reason })), issues: result.actionEcho.issues, advice: result.actionEcho.advice },
      eavesdropDump: { score: result.eavesdropDump.score, narrationLines: result.eavesdropDump.narrationLines, hits: result.eavesdropDump.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, snippet: h.snippet, events: h.events, charged: h.charged, rescued: h.rescued, reason: h.reason })), issues: result.eavesdropDump.issues, advice: result.eavesdropDump.advice },
      selfPity: { score: result.selfPity.score, dialogueLines: result.selfPity.dialogueLines, hits: result.selfPity.hits.slice(0, 8).map((h: any) => ({ startLine: h.startLine, endLine: h.endLine, speaker: h.speaker, families: h.families, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.selfPity.issues, advice: result.selfPity.advice },
      villainConfession: { score: result.villainConfession.score, dialogueLines: result.villainConfession.dialogueLines, hits: result.villainConfession.hits.slice(0, 8).map((h: any) => ({ probeLine: h.probeLine, line: h.line, speaker: h.speaker, kind: h.kind, families: h.families, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.villainConfession.issues, advice: result.villainConfession.advice },
      cheapForgiveness: { score: result.cheapForgiveness.score, hits: result.cheapForgiveness.hits.slice(0, 8).map((h: any) => ({ harmLine: h.harmLine, line: h.line, kind: h.kind, severity: h.severity, boosters: h.boosters, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.cheapForgiveness.issues, advice: result.cheapForgiveness.advice },
      witnessGratuity: { score: result.witnessGratuity.score, dialogueLines: result.witnessGratuity.dialogueLines, hits: result.witnessGratuity.hits.slice(0, 8).map((h: any) => ({ line: h.line, endLine: h.endLine, speaker: h.speaker, families: h.families, prompted: h.prompted, boosters: h.boosters, snippet: h.snippet, rescued: h.rescued, rescueLine: h.rescueLine, reason: h.reason })), issues: result.witnessGratuity.issues, advice: result.witnessGratuity.advice },
      previewVoiceover: { score: result.previewVoiceover.score, tailLines: result.previewVoiceover.tailLines, hits: result.previewVoiceover.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, narrator: h.narrator, beats: h.beats, snippet: h.snippet, reason: h.reason })), issues: result.previewVoiceover.issues, advice: result.previewVoiceover.advice },
      stanceFlip: { score: result.stanceFlip.score, dialogueTurns: result.stanceFlip.dialogueTurns, hits: result.stanceFlip.hits.slice(0, 8).map((h: any) => ({ speaker: h.speaker, family: h.family, fromLine: h.fromLine, toLine: h.toLine, span: h.span, snippet: h.snippet, rescued: h.rescued, rescueScore: h.rescueScore, boosters: h.boosters, reason: h.reason })), issues: result.stanceFlip.issues, advice: result.stanceFlip.advice },
      // v2.80 后手空降：制胜道具/资源首次出现即翻盘（反向契诃夫之枪），创作能力类
      unplantedAsset: { score: result.unplantedAsset.score, hits: result.unplantedAsset.hits.slice(0, 8).map((h: any) => ({ line: h.line, marker: h.marker, asset: h.asset, snippet: h.snippet, planted: h.planted, plantedLine: h.plantedLine, boosters: h.boosters, reason: h.reason })), issues: result.unplantedAsset.issues, advice: result.unplantedAsset.advice },
      // v2.80 旁白翻译机：叙述行紧邻台词注解潜台词（"这话分明是在警告她"），创作能力类
      subtextErase: { score: result.subtextErase.score, hits: result.subtextErase.hits.slice(0, 8).map((h: any) => ({ line: h.line, anchorLine: h.anchorLine, marker: h.marker, snippet: h.snippet, reason: h.reason })), issues: result.subtextErase.issues, advice: result.subtextErase.advice },
      // v2.80 强离场收尾依赖：多场末拍都靠摔门/夺门硬切，创作能力类
      exitCliche: { score: result.exitCliche.score, sceneCount: result.exitCliche.sceneCount, checkedScenes: result.exitCliche.checkedScenes, hits: result.exitCliche.hits.slice(0, 8).map((h: any) => ({ sceneHeader: h.sceneHeader, sceneIndex: h.sceneIndex, endLine: h.endLine, closer: h.closer, repeatedPhrase: h.repeatedPhrase, reason: h.reason })), issues: result.exitCliche.issues, advice: result.exitCliche.advice },
      // v2.80 电话传话机：单边电话复读画外事件（什么！他死了？我马上到），创作能力类
      phoneRelay: { score: result.phoneRelay.score, calls: result.phoneRelay.calls, hits: result.phoneRelay.hits.slice(0, 8).map((h: any) => ({ anchorLine: h.anchorLine, speaker: h.speaker, lines: h.lines, echoes: h.echoes, contentEchoes: h.contentEchoes, snippets: h.snippets, reason: h.reason })), issues: result.phoneRelay.issues, advice: result.phoneRelay.advice },
      // v2.80 假选择：两难零挣扎秒答、放弃项零代价，创作能力类
      fakeChoice: { score: result.fakeChoice.score, hits: result.fakeChoice.hits.slice(0, 8).map((h: any) => ({ line: h.line, answerLine: h.answerLine, speaker: h.speaker, dilemma: h.dilemma, answer: h.answer, gapLines: h.gapLines, instant: h.instant, reason: h.reason })), issues: result.fakeChoice.issues, advice: result.fakeChoice.advice },
      // v2.80 括注导演：每句台词挂情绪条、长导演讲括注，创作能力类
      parenOverdirect: { score: result.parenOverdirect.score, cueCount: result.parenOverdirect.cueCount, directedCount: result.parenOverdirect.directedCount, hits: result.parenOverdirect.hits.slice(0, 8).map((h: any) => ({ line: h.line, kind: h.kind, token: h.token, paren: h.paren, ratio: h.ratio, cueCount: h.cueCount, directedCount: h.directedCount, reason: h.reason })), issues: result.parenOverdirect.issues, advice: result.parenOverdirect.advice },
      // v2.80 全称指控：吵架只甩从来/总是/never/always 零事实，创作能力类
      abstractAccusation: { score: result.abstractAccusation.score, universalCount: result.abstractAccusation.universalCount, unrescuedCount: result.abstractAccusation.unrescuedCount, hits: result.abstractAccusation.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, anchored: h.anchored, marker: h.marker, reason: h.reason })), issues: result.abstractAccusation.issues, advice: result.abstractAccusation.advice },
      // v2.80 廉价共情：咨询师式即时共情话术，创作能力类
      cheapEmpathy: { score: result.cheapEmpathy.score, hitCount: result.cheapEmpathy.hitCount, unrescuedCount: result.cheapEmpathy.unrescuedCount, hits: result.cheapEmpathy.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, speaker: h.speaker, snippet: h.snippet, marker: h.marker, rescued: h.rescued, professional: h.professional, reason: h.reason })), issues: result.cheapEmpathy.issues, advice: result.cheapEmpathy.advice },
      fidgetProp: { score: result.fidgetProp.score, fidgetCount: result.fidgetProp.fidgetCount, familyCounts: result.fidgetProp.familyCounts, overusedFamilies: result.fidgetProp.overusedFamilies, hits: result.fidgetProp.hits.slice(0, 8).map((h: any) => ({ line: h.line, family: h.family, familyLabel: h.familyLabel, snippet: h.snippet, occurrence: h.occurrence, rescued: h.rescued, reason: h.reason })), issues: result.fidgetProp.issues, advice: result.fidgetProp.advice },
      emptyVow: { score: result.emptyVow.score, hitCount: result.emptyVow.hitCount, unrescuedCount: result.emptyVow.unrescuedCount, hits: result.emptyVow.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, speaker: h.speaker, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.emptyVow.issues, advice: result.emptyVow.advice },
      flashbackCrutch: { score: result.flashbackCrutch.score, flashbackCount: result.flashbackCrutch.flashbackCount, repeatCount: result.flashbackCrutch.repeatCount, hits: result.flashbackCrutch.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, blockLines: h.blockLines, repeated: h.repeated, rescued: h.rescued, reason: h.reason })), issues: result.flashbackCrutch.issues, advice: result.flashbackCrutch.advice },
      accidentalSpark: { score: result.accidentalSpark.score, hitCount: result.accidentalSpark.hitCount, unrescuedCount: result.accidentalSpark.unrescuedCount, hits: result.accidentalSpark.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.accidentalSpark.issues, advice: result.accidentalSpark.advice },
      // v2.80 通讯失灵拐杖（创作能力：没信号/没电/打不通当剧情阀门反复用）
      commFailCrutch: { score: result.commFailCrutch.score, hitCount: result.commFailCrutch.hitCount, unrescuedCount: result.commFailCrutch.unrescuedCount, hits: result.commFailCrutch.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.commFailCrutch.issues, advice: result.commFailCrutch.advice },
      drunkTruth: { score: result.drunkTruth.score, hitCount: result.drunkTruth.hitCount, unrescuedCount: result.drunkTruth.unrescuedCount, hits: result.drunkTruth.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.drunkTruth.issues, advice: result.drunkTruth.advice },
      tearBait: { score: result.tearBait.score, hitCount: result.tearBait.hitCount, unrescuedCount: result.tearBait.unrescuedCount, hits: result.tearBait.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.tearBait.issues, advice: result.tearBait.advice },
      instantDeduction: { score: result.instantDeduction.score, hitCount: result.instantDeduction.hitCount, unrescuedCount: result.instantDeduction.unrescuedCount, hits: result.instantDeduction.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantDeduction.issues, advice: result.instantDeduction.advice },
      recordsOnDemand: { score: result.recordsOnDemand.score, hitCount: result.recordsOnDemand.hitCount, unrescuedCount: result.recordsOnDemand.unrescuedCount, hits: result.recordsOnDemand.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.recordsOnDemand.issues, advice: result.recordsOnDemand.advice },
      // v2.81 说曹操曹操到：谈论→无铺垫登场 timing 巧合，创作能力类
      walkInTiming: { score: result.walkInTiming.score, hitCount: result.walkInTiming.hitCount, unrescuedCount: result.walkInTiming.unrescuedCount, hits: result.walkInTiming.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.walkInTiming.issues, advice: result.walkInTiming.advice },
      // v2.82 随叫随到工具人：求助→零摩擦应允，免费人力渠道，创作能力类
      helpOnDemand: { score: result.helpOnDemand.score, hitCount: result.helpOnDemand.hitCount, unrescuedCount: result.helpOnDemand.unrescuedCount, hits: result.helpOnDemand.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.helpOnDemand.issues, advice: result.helpOnDemand.advice },
      // v2.83 信息容器延迟开启：信息在手却用"不敢拆"拖延释放，容器当悬念阀门，创作能力类
      delayedReveal: { score: result.delayedReveal.score, hitCount: result.delayedReveal.hitCount, unrescuedCount: result.delayedReveal.unrescuedCount, hits: result.delayedReveal.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.delayedReveal.issues, advice: result.delayedReveal.advice },
      // v2.84 初见托付：初见面就把公章/孩子/命脉交给陌生人，信任白给，免费的信任撑不起背叛，创作能力类
      instantTrust: { score: result.instantTrust.score, hitCount: result.instantTrust.hitCount, unrescuedCount: result.instantTrust.unrescuedCount, hits: result.instantTrust.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantTrust.issues, advice: result.instantTrust.advice },
      // v2.85 认亲白给：血缘揭露三行内被零成本接纳，亲情速热，免费的亲情撑不起二十年寻找，创作能力类
      instantKinship: { score: result.instantKinship.score, hitCount: result.instantKinship.hitCount, unrescuedCount: result.instantKinship.unrescuedCount, hits: result.instantKinship.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantKinship.issues, advice: result.instantKinship.advice },
      faintOnCue: { score: result.faintOnCue.score, hitCount: result.faintOnCue.hitCount, unrescuedCount: result.faintOnCue.unrescuedCount, hits: result.faintOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.faintOnCue.issues, advice: result.faintOnCue.advice },
      // v2.86 每次都晚一步：抵达就刚走，错过当剧情阀门，错过要有真代价或被行动接住，创作能力类
      alwaysLate: { score: result.alwaysLate.score, hitCount: result.alwaysLate.hitCount, unrescuedCount: result.alwaysLate.unrescuedCount, hits: result.alwaysLate.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.alwaysLate.issues, advice: result.alwaysLate.advice },
      // v2.88 初见白给：第一次见面三行内就以身相许，爱情速热，深情要有来路不是初见特效，创作能力类
      instantLove: { score: result.instantLove.score, hitCount: result.instantLove.hitCount, unrescuedCount: result.instantLove.unrescuedCount, hits: result.instantLove.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantLove.issues, advice: result.instantLove.advice },
      // v2.89 转角偶遇：世界太小，旧人零铺垫高频撞见，相遇靠轨迹或预谋挣来，创作能力类
      convenientEncounter: { score: result.convenientEncounter.score, hitCount: result.convenientEncounter.hitCount, unrescuedCount: result.convenientEncounter.unrescuedCount, hits: result.convenientEncounter.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.convenientEncounter.issues, advice: result.convenientEncounter.advice },
      // v2.90 黑客秒破：高安全系统零成本零失败崩塌，突破靠设备/过程/内应/代价挣来，创作能力类
      instantHack: { score: result.instantHack.score, hitCount: result.instantHack.hitCount, unrescuedCount: result.instantHack.unrescuedCount, hits: result.instantHack.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantHack.issues, advice: result.instantHack.advice },
      // v2.91 神枪手开挂：枪枪上靶弹弹咬要害，枪法由来路/失手/代价挣来，创作能力类
      instantMarksman: { score: result.instantMarksman.score, hitCount: result.instantMarksman.hitCount, unrescuedCount: result.instantMarksman.unrescuedCount, hits: result.instantMarksman.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantMarksman.issues, advice: result.instantMarksman.advice },
      // v2.92 语言秒精通：零学费零口音从听不懂到流利只隔三行，语言由来路/过程/代价挣来，创作能力类
      instantLanguage: { score: result.instantLanguage.score, hitCount: result.instantLanguage.hitCount, unrescuedCount: result.instantLanguage.unrescuedCount, hits: result.instantLanguage.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantLanguage.issues, advice: result.instantLanguage.advice },
      // v2.93 一句话点醒：多年心结被单句台词瞬间治愈，松动要有挣扎/代价/时间，创作能力类
      wakeUpCall: { score: result.wakeUpCall.score, hitCount: result.wakeUpCall.hitCount, unrescuedCount: result.wakeUpCall.unrescuedCount, hits: result.wakeUpCall.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.wakeUpCall.issues, advice: result.wakeUpCall.advice },
      // v2.94 呼唤即醒检测：昏迷多年的人被一声呼唤唤醒，苏醒要有医学、渐变、守候或代价挣来
      wakeOnCue: { score: result.wakeOnCue.score, hitCount: result.wakeOnCue.hitCount, unrescuedCount: result.wakeOnCue.unrescuedCount, hits: result.wakeOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.wakeOnCue.issues, advice: result.wakeOnCue.advice },
      // v2.95 带伤开挂检测：重伤未愈的人当剧情需要时全力输出，伤势要有医学许可、当场代价或有人代劳
      woundOnCue: { score: result.woundOnCue.score, hitCount: result.woundOnCue.hitCount, unrescuedCount: result.woundOnCue.unrescuedCount, hits: result.woundOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.woundOnCue.issues, advice: result.woundOnCue.advice },
      // v2.96 束缚秒脱检测：五花大绑锁进仓库下一拍就自己走出来，脱身要有工具铺垫、当场代价或外援挣来
      instantEscape: { score: result.instantEscape.score, hitCount: result.instantEscape.hitCount, unrescuedCount: result.instantEscape.unrescuedCount, hits: result.instantEscape.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantEscape.issues, advice: result.instantEscape.advice },
      // v2.97 武器哑火检测：关键时刻枪必没子弹——哑火要有来路、当场处理或有备选方案
      weaponJam: { score: result.weaponJam.score, hitCount: result.weaponJam.hitCount, unrescuedCount: result.weaponJam.unrescuedCount, hits: result.weaponJam.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.weaponJam.issues, advice: result.weaponJam.advice },
      evidenceBlank: { score: result.evidenceBlank.score, hitCount: result.evidenceBlank.hitCount, unrescuedCount: result.evidenceBlank.unrescuedCount, hits: result.evidenceBlank.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.evidenceBlank.issues, advice: result.evidenceBlank.advice },
      // v2.99 萌宝泄密检测：大人死守的秘密被奶声奶气的娃一句话当众拆封且满座采信——泄密要有来路授意、采信代价或童言代价
      childBlurt: { score: result.childBlurt.score, hitCount: result.childBlurt.hitCount, unrescuedCount: result.childBlurt.unrescuedCount, hits: result.childBlurt.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.childBlurt.issues, advice: result.childBlurt.advice },
      // v2.100 假倒计时检测：立了"期限+后果"的赌注却没人赶时间、到期不兑付——要么演赶时间，要么认罚兑付，宽限必须挣来
      deadlineStretch: { score: result.deadlineStretch.score, hitCount: result.deadlineStretch.hitCount, unrescuedCount: result.deadlineStretch.unrescuedCount, hits: result.deadlineStretch.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.deadlineStretch.issues, advice: result.deadlineStretch.advice },
      // v2.101 审讯秒招检测：关押+施压两句话就挤出同伙/地点/计划/旧案等实质情报——要么甩证据、谈交易，要么演出抵抗与时间消耗
      softInterrogation: { score: result.softInterrogation.score, hitCount: result.softInterrogation.hitCount, unrescuedCount: result.softInterrogation.unrescuedCount, hits: result.softInterrogation.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.softInterrogation.issues, advice: result.softInterrogation.advice },
      // v2.102 临终全招检测：血泊中流利报完真凶全名/同伙/证据地点/旧案真相后准时咽气——遗言给线索不给答案、情报不可直接消费、守口要有挣扎、说全了要接受质证
      deathbedConfession: { score: result.deathbedConfession.score, hitCount: result.deathbedConfession.hitCount, unrescuedCount: result.deathbedConfession.unrescuedCount, hits: result.deathbedConfession.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.deathbedConfession.issues, advice: result.deathbedConfession.advice },
      // v2.103 吐真剂秒招检测：针管一推眼皮发沉，同伙地点旧案问什么答什么——让针失效/药效打折/用药有罪/写出拉锯，意志不能有化学开关
      truthSerum: { score: result.truthSerum.score, hitCount: result.truthSerum.hitCount, unrescuedCount: result.truthSerum.unrescuedCount, hits: result.truthSerum.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.truthSerum.issues, advice: result.truthSerum.advice },
      // v2.104 妊娠剧情阀门检测：一推就见红、干呕一次立刻两道杠——撞击见红要真实医疗/危机兑付，干呕确诊要化验过程/既存孕期/乌龙，肚子不能当关系遥控器
      pregnancyOnCue: { score: result.pregnancyOnCue.score, hitCount: result.pregnancyOnCue.hitCount, unrescuedCount: result.pregnancyOnCue.unrescuedCount, hits: result.pregnancyOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.pregnancyOnCue.issues, advice: result.pregnancyOnCue.advice },
      // v2.105 失忆剧情阀门检测：撞头秒失忆、老歌项链秒读档——撞击秒失忆要真实医学/永久代价/被利用成本，廉价秒恢复要治疗过程/碎片恢复/创伤价格，脑子不能当编剧开关
      amnesiaOnCue: { score: result.amnesiaOnCue.score, hitCount: result.amnesiaOnCue.hitCount, unrescuedCount: result.amnesiaOnCue.unrescuedCount, hits: result.amnesiaOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.amnesiaOnCue.issues, advice: result.amnesiaOnCue.advice },
      // v2.106 绝症剧情阀门检测：宣判秒翻转、误诊秒痊愈——宣判要复查第二诊断/治疗过程/代价真兑付，痊愈要漫长救治/带瘤生存尾巴/经济身体代价，死亡判决书不能当编剧撤回键
      terminalDiagnosisOnCue: { score: result.terminalDiagnosisOnCue.score, hitCount: result.terminalDiagnosisOnCue.hitCount, unrescuedCount: result.terminalDiagnosisOnCue.unrescuedCount, hits: result.terminalDiagnosisOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.terminalDiagnosisOnCue.issues, advice: result.terminalDiagnosisOnCue.advice },
      // v2.107 过敏剧情阀门检测：接触秒发作（一口虾三行进急诊）、一针秒解除（拔针就活蹦乱跳不留观不忌口）——发作要既存过敏史/急救过程/濒死代价，解除要留观随访/慢性尾巴/社交代价，免疫系统不能当编剧扳手
      allergyOnCue: { score: result.allergyOnCue.score, hitCount: result.allergyOnCue.hitCount, unrescuedCount: result.allergyOnCue.unrescuedCount, hits: result.allergyOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.allergyOnCue.issues, advice: result.allergyOnCue.advice },
      // v2.108 失明复明剧情阀门检测：撞击秒失明（车祸耳光滚楼梯三行宣布永久失明无视网膜无视神经）、拆纱布秒复明（角膜捐献者凭空出现/神医偏方/头再撞一下当场2.0）——失明要器质损伤/规范就医/永久代价（"拆纱布复明"不救发作），复明要术后渐进/部分恢复/手术代价，视觉不能当编剧电灯开关
      blindnessOnCue: { score: result.blindnessOnCue.score, hitCount: result.blindnessOnCue.hitCount, unrescuedCount: result.blindnessOnCue.unrescuedCount, hits: result.blindnessOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.blindnessOnCue.issues, advice: result.blindnessOnCue.advice },
      // v2.109 中毒秒解毒剧情阀门检测：接触秒中毒（喝杯毒酒三行七窍流血无中毒语境）、解药秒回魂（药丸一灌当场活蹦乱跳无救治过程）——中毒要毒理化验/规范抢救/永久代价，解毒要救治过程/余毒尾巴/解药代价，毒物不能当编剧电灯开关
      poisonOnCue: { score: result.poisonOnCue.score, hitCount: result.poisonOnCue.hitCount, unrescuedCount: result.poisonOnCue.unrescuedCount, hits: result.poisonOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.poisonOnCue.issues, advice: result.poisonOnCue.advice },
      // v2.110 失声复声剧情阀门检测：惊吓秒失声（灭门/哑药/高烧/掐脖子三行再也开不了口无喉镜无诊断）、金针秒复声（神医金针/孩子哭喊/情急一喊当场字正腔圆无言语治疗）——失声要器质心理机制/规范就医/永久代价（"扎一针开口"不救发作），复声要康复过程/部分恢复/求治代价，嗓子不能当编剧电灯开关
      muteOnCue: { score: result.muteOnCue.score, hitCount: result.muteOnCue.hitCount, unrescuedCount: result.muteOnCue.unrescuedCount, hits: result.muteOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.muteOnCue.issues, advice: result.muteOnCue.advice },
      // v2.111 耳聋复聪剧情阀门检测：爆震秒耳聋（耳边炸响/耳光/高烧/耳毒药三行双耳失聪无鼓膜诊断无听力师）、银针耳蜗秒复聪（神医银针耳穴/滴耳灵药/耳蜗开机/情急当场 hi-fi 无调机语训）——耳聋要器质机制/规范就医/永久代价（"扎一针听见"不救发作），复聪要调机语训/部分恢复/求治代价，听觉不能当编剧电灯开关
      deafOnCue: { score: result.deafOnCue.score, hitCount: result.deafOnCue.hitCount, unrescuedCount: result.deafOnCue.unrescuedCount, hits: result.deafOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.deafOnCue.issues, advice: result.deafOnCue.advice },
      // v2.112 瘫痪秒愈剧情阀门检测：事故秒瘫痪（脚手架房顶马背坠落/车祸/钢梁砸后腰/刀刺后腰/枪中脊梁三行高位截瘫终身轮椅无脊柱诊断无核磁）、银针正骨秒健步（神医银针沿脊柱/正骨咔嚓一扳/偏方膏药/后腰拍掌/情急孩子坠楼当场扔下轮椅健步如飞无康复训练）——瘫痪要脊髓损伤/规范就医/永久代价（"扎一针站起来"不救发作），健步要康复训练（先动脚趾/步态平衡）/部分恢复（双拐拖腿回轮椅）/求治代价，双腿不能当编剧电灯开关；型B 独有长期瘫痪 STATE 门控（健康人也会站，无多年轮椅/瘫痪前提放行）
      paralysisOnCue: { score: result.paralysisOnCue.score, hitCount: result.paralysisOnCue.hitCount, unrescuedCount: result.paralysisOnCue.unrescuedCount, hits: result.paralysisOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, kind: h.kind, rescued: h.rescued, reason: h.reason })), issues: result.paralysisOnCue.issues, advice: result.paralysisOnCue.advice },
      fatigueOverdrive: { score: result.fatigueOverdrive.score, hitCount: result.fatigueOverdrive.hitCount, unrescuedCount: result.fatigueOverdrive.unrescuedCount, hits: result.fatigueOverdrive.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.fatigueOverdrive.issues, advice: result.fatigueOverdrive.advice },
      apologyLoop: { score: result.apologyLoop.score, hitCount: result.apologyLoop.hitCount, unrescuedCount: result.apologyLoop.unrescuedCount, hits: result.apologyLoop.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.apologyLoop.issues, advice: result.apologyLoop.advice },
      forcedProximity: { score: result.forcedProximity.score, hitCount: result.forcedProximity.hitCount, unrescuedCount: result.forcedProximity.unrescuedCount, hits: result.forcedProximity.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.forcedProximity.issues, advice: result.forcedProximity.advice },
      rescueRomance: { score: result.rescueRomance.score, hitCount: result.rescueRomance.hitCount, unrescuedCount: result.rescueRomance.unrescuedCount, hits: result.rescueRomance.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.rescueRomance.issues, advice: result.rescueRomance.advice },
      fightReconcile: { score: result.fightReconcile.score, hitCount: result.fightReconcile.hitCount, unrescuedCount: result.fightReconcile.unrescuedCount, hits: result.fightReconcile.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.fightReconcile.issues, advice: result.fightReconcile.advice },
      instantRepentance: { score: result.instantRepentance.score, hitCount: result.instantRepentance.hitCount, unrescuedCount: result.instantRepentance.unrescuedCount, hits: result.instantRepentance.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantRepentance.issues, advice: result.instantRepentance.advice },
      // v2.119 嘴炮退敌：对峙白给命中（枪口刀锋下的说降被三句劝降词解压）
      talkDown: { score: result.talkDown.score, hitCount: result.talkDown.hitCount, unrescuedCount: result.talkDown.unrescuedCount, hits: result.talkDown.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.talkDown.issues, advice: result.talkDown.advice },
      // v2.120 野战手术：医术白给命中（客厅仓库里取子弹缝合零资质零代价零失败）
      instantSurgery: { score: result.instantSurgery.score, hitCount: result.instantSurgery.hitCount, unrescuedCount: result.instantSurgery.unrescuedCount, hits: result.instantSurgery.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantSurgery.issues, advice: result.instantSurgery.advice },
      // v2.121 当众倒戈：群体忠诚白给命中（一场揭露全场齐刷刷翻转零质疑零分裂零代价）
      crowdFlip: { score: result.crowdFlip.score, hitCount: result.crowdFlip.hitCount, unrescuedCount: result.crowdFlip.unrescuedCount, hits: result.crowdFlip.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.crowdFlip.issues, advice: result.crowdFlip.advice },
      // v2.122 丑闻秒传遍：舆论扩散白给命中（消息一夜传遍全城零时间零载体零对抗）
      rumorSpeed: { score: result.rumorSpeed.score, hitCount: result.rumorSpeed.hitCount, unrescuedCount: result.rumorSpeed.unrescuedCount, hits: result.rumorSpeed.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.rumorSpeed.issues, advice: result.rumorSpeed.advice },
      // v2.123 化验秒出：官方流程掐点白给命中（该等一周的鉴定当场就拿，公家钟表被剧情拨快）
      resultsOnCue: { score: result.resultsOnCue.score, hitCount: result.resultsOnCue.hitCount, unrescuedCount: result.resultsOnCue.unrescuedCount, hits: result.resultsOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.resultsOnCue.issues, advice: result.resultsOnCue.advice },
      // v2.124 路况掐点：交通阀门白给命中（追凶就堵车、逃命就一路绿灯，马路被剧情当自动门）
      trafficOnCue: { score: result.trafficOnCue.score, hitCount: result.trafficOnCue.hitCount, unrescuedCount: result.trafficOnCue.unrescuedCount, hits: result.trafficOnCue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.trafficOnCue.issues, advice: result.trafficOnCue.advice },
      vehicleJam: { score: result.vehicleJam.score, hitCount: result.vehicleJam.hitCount, unrescuedCount: result.vehicleJam.unrescuedCount, hits: result.vehicleJam.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.vehicleJam.issues, advice: result.vehicleJam.advice },
      // v2.126 梦呓泄密：睡眠情报口白给命中（一句呓语吐出藏匿点/密码/身世，睡眠被当免费情报口）
      sleepTalk: { score: result.sleepTalk.score, hitCount: result.sleepTalk.hitCount, unrescuedCount: result.sleepTalk.unrescuedCount, hits: result.sleepTalk.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.sleepTalk.issues, advice: result.sleepTalk.advice },
      // v2.127 高烧谵妄吐真言：病床情报口白给命中（一场谵妄吐出藏匿点/密码/隐情，发烧被当编剧万能钥匙）
      feverTruth: { score: result.feverTruth.score, hitCount: result.feverTruth.hitCount, unrescuedCount: result.feverTruth.unrescuedCount, hits: result.feverTruth.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.feverTruth.issues, advice: result.feverTruth.advice },
      // v2.128 无因馈赠检测：陌生人三行内白给资源（钱/房/车/职位/遗产/启动资金），馈赠要靠关系铺垫/交换条件/拒绝摩擦挣来
      instantEndowment: { score: result.instantEndowment.score, hitCount: result.instantEndowment.hitCount, unrescuedCount: result.instantEndowment.unrescuedCount, hits: result.instantEndowment.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.instantEndowment.issues, advice: result.instantEndowment.advice },
      // v2.129 救兵天降：绝境中救兵最后一秒无因赶到，救援要靠铺垫/求救/代价挣来，生死关头不许只等踹门声
      lastSecondRescue: { score: result.lastSecondRescue.score, hitCount: result.lastSecondRescue.hitCount, unrescuedCount: result.lastSecondRescue.unrescuedCount, hits: result.lastSecondRescue.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, sceneHeader: h.sceneHeader, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.lastSecondRescue.issues, advice: result.lastSecondRescue.advice },
      // v2.130 反派拖刀：处决执行中临场拖延不落锤，威胁兑付不许白给时间窗口——拖延要有理由/被打断/主角自救
      villainStall: { score: result.villainStall.score, hitCount: result.villainStall.hitCount, unrescuedCount: result.villainStall.unrescuedCount, hits: result.villainStall.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, sceneHeader: h.sceneHeader, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.villainStall.issues, advice: result.villainStall.advice },
      // v2.131 开会式推进：群像部署写成排班表，分派即诺零摩擦执行——分工要有异议/变数/赌注，群像不许当任务编排仪表盘
      teamBriefing: { score: result.teamBriefing.score, hitCount: result.teamBriefing.hitCount, unrescuedCount: result.teamBriefing.unrescuedCount, hits: result.teamBriefing.hits.slice(0, 8).map((h: any) => ({ line: h.line, sceneIndex: h.sceneIndex, sceneHeader: h.sceneHeader, snippet: h.snippet, marker: h.marker, rescued: h.rescued, reason: h.reason })), issues: result.teamBriefing.issues, advice: result.teamBriefing.advice },
      showDontTell: showDontTellDigest(result.showDontTell), // c211：与批量落库同形态（issues≤6/evidence/advice 截断 + 四类计数）；旧扁平字段 tellEmotionCount 前端无消费方
      // v2.113 集尾钩子效力：类型/强度/规划对齐/问题清单——短剧留存生死线
      // c209：与落库形态完全一致（cliffhangerDigest 统一限界），避免 SSE 与刷新后看到两份不同数据
      cliffhanger: cliffhangerDigest(result.cliffhanger),
      // c216 跨集诊断台账六键：与落库 qcReport 完全同形态（shapeLedgerDiagnoses 限界），
      // 掉钩/屈辱欠账/悬念干旱/钩型疲劳/承诺欠账/反派空转刷新后不再失明
      ...shapeLedgerDiagnoses({
        hookPayoff: result.hookPayoff,
        humiliationDebt: result.humiliationDebt,
        mysteryDrought: result.mysteryDrought,
        hookFatigue: result.hookFatigue,
        promiseDrought: result.promiseDrought,
        villainThreat: result.villainThreat,
      }),
      // c217 跨集连续性台账 24 键：与落库 qcReport 同形态（SSE 无 villainFate 短名行，整键直出无碰撞），
      // 封禁信物再现/死者复活/下场穿帮/伤势秒愈/境界跳级等 24 类硬伤实时面板不再失明
      ...continuityLedgersShaped,
      // c218 闸门引擎四键（反套路/口语化/落地感/字数闸门）：与落库同一份 shapeGateEngines 限界形态，
      // 实时面板即可见 QC 闸门结论（含重试耗尽后的失败态），不再静默出货
      ...shapeGateEngines(result as unknown as Record<string, unknown>),
      // c218 半盲四键补 SSE：rhythm/character/styleCheck（路径 B）与 propMotifRhythm（路径 A）
      // 落库✓但 SSE done 此前遗漏；复用 buildQcEngineDigest 与落库零分叉（styleCheck 为 null 时自动跳过）
      ...buildQcEngineDigest({
        rhythm: result.rhythm, character: result.character,
        styleCheck: result.styleCheck, propMotifRhythm: result.propMotifRhythm,
      } as unknown as Record<string, unknown>),
      // v2.114 爽点密度：数量/分布/多样性/蓄力/问题清单——短剧爽感生死线
      coolMoment: { score: result.coolMoment.score, count: result.coolMoment.count, variety: result.coolMoment.variety, distribution: result.coolMoment.distribution, hasBuildup: result.coolMoment.hasBuildup, hits: result.coolMoment.hits.slice(0, 8).map((h: any) => ({ type: h.type, typeLabel: h.typeLabel, position: h.position, strength: h.strength })), issues: result.coolMoment.issues },
      // v2.115 台词水分：水分率/水分台词数/命中台词/问题清单——短剧信息密度生死线
      dialogueWater: { score: result.dialogueWater.score, totalLines: result.dialogueWater.totalLines, waterCount: result.dialogueWater.waterCount, waterRatio: result.dialogueWater.waterRatio, hits: result.dialogueWater.hits.slice(0, 8).map((h: any) => ({ line: h.line, character: h.character, waterType: h.waterType, waterLevel: h.waterLevel, lineIndex: h.lineIndex })), issues: result.dialogueWater.issues },
      // v2.116 冲突密度：数量/强度/分布/升级/多样性/问题清单——短剧驱动力生死线
      conflictDensity: { score: result.conflictDensity.score, count: result.conflictDensity.count, maxLevel: result.conflictDensity.maxLevel, variety: result.conflictDensity.variety, distribution: result.conflictDensity.distribution, hasEscalation: result.conflictDensity.hasEscalation, strengthCurve: result.conflictDensity.strengthCurve.slice(0, 12), hits: result.conflictDensity.hits.slice(0, 8).map((h: any) => ({ level: h.level, levelLabel: h.levelLabel, category: h.category, categoryLabel: h.categoryLabel, position: h.position, strength: h.strength })), issues: result.conflictDensity.issues },
      // v2.117 金句密度：数量/强度/分布/多样性/结尾高潮/弱金句/问题清单——短剧传播力生死线
      punchlineDensity: { score: result.punchlineDensity.score, count: result.punchlineDensity.count, variety: result.punchlineDensity.variety, distribution: result.punchlineDensity.distribution, avgStrength: result.punchlineDensity.avgStrength, hasClimaxPunch: result.punchlineDensity.hasClimaxPunch, hits: result.punchlineDensity.hits.slice(0, 8).map((h: any) => ({ type: h.type, typeLabel: h.typeLabel, snippet: h.snippet, speaker: h.speaker, position: h.position, strength: h.strength, device: h.device })), issues: result.punchlineDensity.issues },
      // v2.118 场景密度：场景数/长度分布/静态/碎片/拖沓/情绪推进/问题清单——短剧节奏生死线
      sceneDensity: { score: result.sceneDensity.score, count: result.sceneDensity.count, staticCount: result.sceneDensity.staticCount, fragmentCount: result.sceneDensity.fragmentCount, draggingCount: result.sceneDensity.draggingCount, maxSceneRatio: result.sceneDensity.maxSceneRatio, avgSceneLength: result.sceneDensity.avgSceneLength, lengthStdDev: result.sceneDensity.lengthStdDev, hasEmotionProgression: result.sceneDensity.hasEmotionProgression, scenes: result.sceneDensity.scenes.slice(0, 10).map((s: any) => ({ index: s.index, header: s.header, position: s.position, lineCount: s.lineCount, dialogueLines: s.dialogueLines, actionLines: s.actionLines, wordCount: s.wordCount, conflictSignals: s.conflictSignals, type: s.type, dialogueRatio: s.dialogueRatio })), lengthDistribution: result.sceneDensity.lengthDistribution, issues: result.sceneDensity.issues },
      // v2.119 重复感：近似重复台词组数/重复句式/重复情绪/重复动作词/重复场景开头/扣分/问题清单——短剧新鲜感生死线
      repetition: { score: result.repetition.score, exactLineGroups: result.repetition.exactLineGroups, patternCount: result.repetition.patternCount, emotionRepeats: result.repetition.emotionRepeats, actionRepeats: result.repetition.actionRepeats, sceneOpenerRepeats: result.repetition.sceneOpenerRepeats, totalPenalty: result.repetition.totalPenalty, hits: result.repetition.hits.slice(0, 8).map((h: any) => ({ type: h.type, typeLabel: h.typeLabel, pattern: h.pattern, count: h.count, snippets: h.snippets.slice(0, 4) })), issues: result.repetition.issues },
      // v2.120 角色戏份均衡：主角占比/戏份悬殊/龙套过场/对手戏多样性/问题清单——短剧人物驱动生死线
      characterBalance: { score: result.characterBalance.score, protagonist: result.characterBalance.protagonist, protagonistShare: result.characterBalance.protagonistShare, topBottomRatio: result.characterBalance.topBottomRatio, cameoCount: result.characterBalance.cameoCount, totalLines: result.characterBalance.totalLines, totalWords: result.characterBalance.totalWords, speakingChars: result.characterBalance.speakingChars, shares: result.characterBalance.shares.slice(0, 10).map((s: any) => ({ name: s.name, lineCount: s.lineCount, wordCount: s.wordCount, share: s.share, firstAppear: s.firstAppear, lastAppear: s.lastAppear, span: s.span, coSceneChars: s.coSceneChars, avgLen: s.avgLen })), issues: result.characterBalance.issues },
      // v2.121 反转密度：数量/最高强度/多样性/分布/平均强度/弱反转比例/结尾高潮/强度曲线/命中列表含类型/问题清单——短剧反转生死线
      twistDensity: { score: result.twistDensity.score, count: result.twistDensity.count, maxStrength: result.twistDensity.maxStrength, variety: result.twistDensity.variety, distribution: result.twistDensity.distribution, avgStrength: result.twistDensity.avgStrength, weakRatio: result.twistDensity.weakRatio, hasClimaxTwist: result.twistDensity.hasClimaxTwist, strengthCurve: result.twistDensity.strengthCurve.slice(0, 12), hits: result.twistDensity.hits.slice(0, 8).map((h: any) => ({ type: h.type, typeLabel: h.typeLabel, snippet: h.snippet, position: h.position, strength: h.strength })), issues: result.twistDensity.issues },
      // v2.122 对白长度与速度感：长度分布/平均长度/最长对白/超长占比/台词墙/独白戏/节奏感/问题清单——短剧节奏生死线
      dialogueLength: { score: result.dialogueLength.score, totalLines: result.dialogueLength.totalLines, distribution: result.dialogueLength.distribution, ratios: result.dialogueLength.ratios, avgLength: result.dialogueLength.avgLength, maxLength: result.dialogueLength.maxLength, maxLine: result.dialogueLength.maxLine, overLongCount: result.dialogueLength.overLongCount, overLongRatio: result.dialogueLength.overLongRatio, wallHits: result.dialogueLength.wallHits.slice(0, 5).map((w: any) => ({ character: w.character, text: w.text.slice(0, 60), wordCount: w.wordCount, lineIndex: w.lineIndex })), overLongHits: result.dialogueLength.overLongHits.slice(0, 8).map((o: any) => ({ character: o.character, text: o.text.slice(0, 60), wordCount: o.wordCount, lineIndex: o.lineIndex })), monologueHits: result.dialogueLength.monologueHits.slice(0, 5).map((m: any) => ({ character: m.character, consecutiveCount: m.consecutiveCount, totalWords: m.totalWords, startLineIndex: m.startLineIndex, snippet: m.snippet.slice(0, 80) })), hasRhythm: result.dialogueLength.hasRhythm, issues: result.dialogueLength.issues },
      informationDensity: { score: result.informationDensity.score, totalScenes: result.informationDensity.totalScenes, totalInfoPushes: result.informationDensity.totalInfoPushes, avgInfoPerScene: result.informationDensity.avgInfoPerScene, waterSceneCount: result.informationDensity.waterSceneCount, waterRatio: result.informationDensity.waterRatio, overloadSceneCount: result.informationDensity.overloadSceneCount, hasInfoInFirstThird: result.informationDensity.hasInfoInFirstThird, hasInfoInLastThird: result.informationDensity.hasInfoInLastThird, hasRisingProgression: result.informationDensity.hasRisingProgression, scenes: result.informationDensity.scenes.slice(0, 8).map((s: any) => ({ index: s.index, header: s.header.slice(0, 40), infoCount: s.infoCount, wordCount: s.wordCount, type: s.type, hits: s.hits.slice(0, 4).map((h: any) => ({ type: h.type, typeLabel: h.typeLabel, evidence: h.evidence.slice(0, 60), lineIndex: h.lineIndex })) })), issues: result.informationDensity.issues },
      // v2.124 悬念张力曲线：张力曲线/形态/平铺/极值/跳转/开场/收尾——短剧悬念生死线
      suspenseTension: { score: result.suspenseTension.score, totalScenes: result.suspenseTension.totalScenes, totalSignals: result.suspenseTension.totalSignals, avgSignalsPerScene: result.suspenseTension.avgSignalsPerScene, curve: result.suspenseTension.curve.map((p: any) => ({ sceneIndex: p.sceneIndex, header: p.header.slice(0, 40), tension: p.tension, signalCount: p.signalCount, position: p.position, wordCount: p.wordCount, hitTypes: p.hitTypes })), avgTension: result.suspenseTension.avgTension, maxTension: result.suspenseTension.maxTension, minTension: result.suspenseTension.minTension, tensionRange: result.suspenseTension.tensionRange, climaxSceneIndex: result.suspenseTension.climaxSceneIndex, valleySceneIndex: result.suspenseTension.valleySceneIndex, hasFlatStretch: result.suspenseTension.hasFlatStretch, flatStretchStart: result.suspenseTension.flatStretchStart, hasStrongOpening: result.suspenseTension.hasStrongOpening, hasStrongEnding: result.suspenseTension.hasStrongEnding, curveShape: result.suspenseTension.curveShape, issues: result.suspenseTension.issues },
      // v2.125 场景标题规范：格式一致性/编号连续/地点时间标注/重复/过长——短剧格式生死线
      sceneHeader: { score: result.sceneHeader.score, totalHeaders: result.sceneHeader.totalHeaders, dominantFormat: result.sceneHeader.dominantFormat, inconsistentFormatCount: result.sceneHeader.inconsistentFormatCount, missingNumberCount: result.sceneHeader.missingNumberCount, discontinuousCount: result.sceneHeader.discontinuousCount, missingLocationCount: result.sceneHeader.missingLocationCount, missingTimeCount: result.sceneHeader.missingTimeCount, tooLongCount: result.sceneHeader.tooLongCount, duplicatePairCount: result.sceneHeader.duplicatePairCount, hasContinuousNumbering: result.sceneHeader.hasContinuousNumbering, hasConsistentFormat: result.sceneHeader.hasConsistentFormat, headers: result.sceneHeader.headers.slice(0, 8).map((h: any) => ({ lineIndex: h.lineIndex, raw: h.raw.slice(0, 40), number: h.number, format: h.format, location: h.location.slice(0, 20), timeOfDay: h.timeOfDay, length: h.length, valid: h.valid, reasons: h.reasons })), issues: result.sceneHeader.issues },
      // v2.126 对白功能性：五维功能分布/角色功能单一/场景信息倾倒/冲突真空/无功能对白——短剧人物与节奏生死线
      dialogueFunction: { score: result.dialogueFunction.score, totalDialogueLines: result.dialogueFunction.totalDialogueLines, functionDistribution: result.dialogueFunction.functionDistribution, functionRatio: result.dialogueFunction.functionRatio, isBalanced: result.dialogueFunction.isBalanced, characterBreakdowns: result.dialogueFunction.characterBreakdowns.slice(0, 8).map((c: any) => ({ name: c.name, lineCount: c.lineCount, plot: c.plot, character: c.character, conflict: c.conflict, info: c.info, other: c.other, isMonotone: c.isMonotone, dominantFunction: c.dominantFunction })), sceneBreakdowns: result.dialogueFunction.sceneBreakdowns.map((s: any) => ({ sceneIndex: s.sceneIndex, sceneTitle: s.sceneTitle.slice(0, 40), lineCount: s.lineCount, plot: s.plot, character: s.character, conflict: s.conflict, info: s.info, other: s.other, isInfoDump: s.isInfoDump, isConflictVacuum: s.isConflictVacuum })), issues: result.dialogueFunction.issues },
      // v2.127 因果逻辑链：巧合依赖/机械降神/因果稀薄/誓言烂尾/信息空降——短剧剧情可信度生死线
      causalLogic: { score: result.causalLogic.score, coincidenceCount: result.causalLogic.coincidenceCount, coincidenceHits: result.causalLogic.coincidenceHits.map((h: any) => ({ marker: h.marker, snippet: h.snippet.slice(0, 60), position: h.position, inTail: h.inTail })), deusExMachinaHits: result.causalLogic.deusExMachinaHits.map((h: any) => ({ snippet: h.snippet.slice(0, 60), position: h.position })), suddenCount: result.causalLogic.suddenCount, causationCount: result.causalLogic.causationCount, sequenceCount: result.causalLogic.sequenceCount, oathCount: result.causalLogic.oathCount, payoffCount: result.causalLogic.payoffCount, unsourcedCount: result.causalLogic.unsourcedCount, issues: result.causalLogic.issues },
      // v2.128 主角目标与行动链：欲望可见度/被动主角/目标-障碍-行动闭环/中段失焦——短剧主角驱动生死线
      protagonistGoal: { score: result.protagonistGoal.score, desireCount: result.protagonistGoal.desireCount, headDesireCount: result.protagonistGoal.headDesireCount, desireHits: result.protagonistGoal.desireHits.map((h: any) => ({ marker: h.marker, snippet: h.snippet.slice(0, 60), position: h.position })), obstacleCount: result.protagonistGoal.obstacleCount, actionCount: result.protagonistGoal.actionCount, passiveCount: result.protagonistGoal.passiveCount, payoffCount: result.protagonistGoal.payoffCount, tailPayoffCount: result.protagonistGoal.tailPayoffCount, hasGoalObstacleActionChain: result.protagonistGoal.hasGoalObstacleActionChain, agencyRatio: result.protagonistGoal.agencyRatio, issues: result.protagonistGoal.issues },
      // v2.129 对手/反派质量：反派缺席/纸老虎/无动机/不登场/弱威胁/纸片化——短剧压迫感生死线
      antagonistQuality: { score: result.antagonistQuality.score, pressureCount: result.antagonistQuality.pressureCount, competenceCount: result.antagonistQuality.competenceCount, motiveCount: result.antagonistQuality.motiveCount, leverageCount: result.antagonistQuality.leverageCount, layerCount: result.antagonistQuality.layerCount, confrontationCount: result.antagonistQuality.confrontationCount, hasDirectConfrontation: result.antagonistQuality.hasDirectConfrontation, issues: result.antagonistQuality.issues },
      // v2.130 压抑-释放节奏：只虐不爽/一路平推/憋太久/羞辱欠账/尾段烂尾——短剧憋爽兑现生死线
      payoffRhythm: { score: result.payoffRhythm.score, suppressCount: result.payoffRhythm.suppressCount, releaseCount: result.payoffRhythm.releaseCount, strongReleaseCount: result.payoffRhythm.strongReleaseCount, humiliationCount: result.payoffRhythm.humiliationCount, humiliationPaidCount: result.payoffRhythm.humiliationPaidCount, firstReleasePosition: result.payoffRhythm.firstReleasePosition, maxSuppressionStretch: result.payoffRhythm.maxSuppressionStretch, paidCycles: result.payoffRhythm.paidCycles, tailSuppressionCount: result.payoffRhythm.tailSuppressionCount, tailStrongReleaseCount: result.payoffRhythm.tailStrongReleaseCount, suppressHits: result.payoffRhythm.suppressHits.map((h: any) => ({ marker: h.marker, snippet: h.snippet.slice(0, 60), position: h.position })).slice(0, 8), releaseHits: result.payoffRhythm.releaseHits.map((h: any) => ({ marker: h.marker, snippet: h.snippet.slice(0, 60), position: h.position, strong: h.strong })).slice(0, 8), issues: result.payoffRhythm.issues },
      // v2.131 情感关系递进：有名无实/突飞猛进/一路糖水/暧昧原地踏步/告知式爱情——短剧 CP 关系生死线
      relationship: { score: result.relationship.score, hasRomanceLine: result.relationship.hasRomanceLine, anchorCount: result.relationship.anchorCount, strongCount: result.relationship.strongCount, weakCount: result.relationship.weakCount, obstacleCount: result.relationship.obstacleCount, upgradeCount: result.relationship.upgradeCount, interactionCount: result.relationship.interactionCount, tellingCount: result.relationship.tellingCount, firstStrongPosition: result.relationship.firstStrongPosition, weakBeforeStrongCount: result.relationship.weakBeforeStrongCount, strongHits: result.relationship.strongHits.map((h: any) => ({ marker: h.marker, snippet: h.snippet.slice(0, 60), position: h.position, strong: h.strong })).slice(0, 8), weakHits: result.relationship.weakHits.map((h: any) => ({ marker: h.marker, snippet: h.snippet.slice(0, 60), position: h.position })).slice(0, 8), issues: result.relationship.issues },
      // v2.132 场景注水/空转：三无场景/复述注水/闪回注水/寒暄开场/结尾拖堂——短剧节奏密度生死线
      scenePadding: { score: result.scenePadding.score, sceneCount: result.scenePadding.sceneCount, deadSceneCount: result.scenePadding.deadSceneCount, recapCount: result.scenePadding.recapCount, flashbackCount: result.scenePadding.flashbackCount, newInfoCount: result.scenePadding.newInfoCount, fillerCount: result.scenePadding.fillerCount, slowOpen: result.scenePadding.slowOpen, draggyTail: result.scenePadding.draggyTail, deadScenes: result.scenePadding.deadScenes.slice(0, 5), issues: result.scenePadding.issues },
      // v2.133 配角工具人/群像：捧哏型/信息播报员/无欲望保姆/夸夸群像/只动嘴纸片人——配角必须有自己的欲望
      supporting: { score: result.supporting.score, speakingChars: result.supporting.speakingChars, protagonist: result.supporting.protagonist, supportingChars: result.supporting.supportingChars, toolChars: result.supporting.toolChars, echoCount: result.supporting.echoCount, dispenserCount: result.supporting.dispenserCount, desirelessCount: result.supporting.desirelessCount, offstageCount: result.supporting.offstageCount, praiseChorus: result.supporting.praiseChorus, characters: result.supporting.characters.slice(0, 8), issues: result.supporting.issues },
      // v2.134 冲突升级阶梯：原地踏步/无高潮/开局即顶格/跳台阶/手段贫乏——冲突是爬坡不是平移
      conflictEscalation: { score: result.conflictEscalation.score, windowCount: result.conflictEscalation.windowCount, levels: result.conflictEscalation.levels, l1Hits: result.conflictEscalation.l1Hits, l2Hits: result.conflictEscalation.l2Hits, l3Hits: result.conflictEscalation.l3Hits, maxLevel: result.conflictEscalation.maxLevel, firstWindowLevel: result.conflictEscalation.firstWindowLevel, abruptIndex: result.conflictEscalation.abruptIndex, actionKinds: result.conflictEscalation.actionKinds, actionFrequency: result.conflictEscalation.actionFrequency.slice(0, 8), issues: result.conflictEscalation.issues },
      // v2.135 台词潜台词：底牌直给/反派自曝/知情者科普/问答喂信息/情绪直报——底牌只能让观众看出来
      subtext: { score: result.subtext.score, dialogueLineCount: result.subtext.dialogueLineCount, onTheNoseCount: result.subtext.onTheNoseCount, villainExpoCount: result.subtext.villainExpoCount, asYouKnowCount: result.subtext.asYouKnowCount, qaExpoCount: result.subtext.qaExpoCount, namedEmotionCount: result.subtext.namedEmotionCount, deflectionCount: result.subtext.deflectionCount, issues: result.subtext.issues },
      // v2.136 配角弧光：零变化跟班/无铺垫倒戈/纯应答无选择——配角结束时不能和开场时是同一个人
      supportingArc: { score: result.supportingArc.score, speakingChars: result.supportingArc.speakingChars, protagonist: result.supportingArc.protagonist, supportingChars: result.supportingArc.supportingChars, arcChars: result.supportingArc.arcChars, staticChars: result.supportingArc.staticChars, abruptChars: result.supportingArc.abruptChars, passiveChars: result.supportingArc.passiveChars, characters: result.supportingArc.characters.slice(0, 8), issues: result.supportingArc.issues },
      // v2.137 场景目的效率：一场多目的稀释/跨场重复/目的迟到/软收尾——一场只打一拳
      scenePurpose: { score: result.scenePurpose.score, sceneCount: result.scenePurpose.sceneCount, purposefulSceneCount: result.scenePurpose.purposefulSceneCount, multiPurposeCount: result.scenePurpose.multiPurposeCount, duplicatePairCount: result.scenePurpose.duplicatePairCount, latePurposeCount: result.scenePurpose.latePurposeCount, weakExitCount: result.scenePurpose.weakExitCount, focusedLandedCount: result.scenePurpose.focusedLandedCount, scenes: result.scenePurpose.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, lineCount: s.lineCount, purposes: s.purposes, dominant: s.dominant, firstPurposeRatio: s.firstPurposeRatio, lands: s.lands })), issues: result.scenePurpose.issues },
      // v2.138 时间线一致性：倒计时反转/昼夜矛盾/独立转场偷懒/关系时长压扁——时间只会往前走
      timeline: { score: result.timeline.score, sceneCount: result.timeline.sceneCount, deadlineCount: result.timeline.deadlineCount, skipMarkerCount: result.timeline.skipMarkerCount, standaloneSkipCount: result.timeline.standaloneSkipCount, reversalCount: result.timeline.reversalCount, mismatchCount: result.timeline.mismatchCount, squashCount: result.timeline.squashCount, anchoredSceneCount: result.timeline.anchoredSceneCount, scenes: result.timeline.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, phase: s.phase, mismatch: s.mismatch })), issues: result.timeline.issues },
      // v2.139 场记连续性：伤势无痕/毁物复原/设备复活/束缚消失——物理状态不穿帮
      continuity: { score: result.continuity.score, sceneCount: result.continuity.sceneCount, stateChangeCount: result.continuity.stateChangeCount, contradictionCount: result.continuity.contradictionCount, injuryVanishCount: result.continuity.injuryVanishCount, objectRestoredCount: result.continuity.objectRestoredCount, deviceResurrectionCount: result.continuity.deviceResurrectionCount, restraintVanishCount: result.continuity.restraintVanishCount, bridgedCount: result.continuity.bridgedCount, scenes: result.continuity.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, contradictionCount: s.contradictionCount })), issues: result.continuity.issues },
      // v2.140 误会拖延：拒绝倾听/误会跨场不解/有嘴不说/偷听半句定罪——冲突不能靠按头误会硬撑
      misunderstanding: { score: result.misunderstanding.score, sceneCount: result.misunderstanding.sceneCount, signalCount: result.misunderstanding.signalCount, issueCount: result.misunderstanding.issueCount, refusalCount: result.misunderstanding.refusalCount, repeatCount: result.misunderstanding.repeatCount, forcedSilenceCount: result.misunderstanding.forcedSilenceCount, halfTruthCount: result.misunderstanding.halfTruthCount, resolvedCount: result.misunderstanding.resolvedCount, scenes: result.misunderstanding.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, contradictionCount: s.contradictionCount })), issues: result.misunderstanding.issues },
      // v2.141 反派降智/主角光环：占优放人/刀下自白/看守空转/致命无伤——翻盘必须靠主角挣来
      plotArmor: { score: result.plotArmor.score, sceneCount: result.plotArmor.sceneCount, signalCount: result.plotArmor.signalCount, issueCount: result.plotArmor.issueCount, sparesCount: result.plotArmor.sparesCount, monologueCount: result.plotArmor.monologueCount, restraintCount: result.plotArmor.restraintCount, armorCount: result.plotArmor.armorCount, cleverEscapeCount: result.plotArmor.cleverEscapeCount, scenes: result.plotArmor.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.plotArmor.issues },
      // v2.142 翻盘证据链公平性：物证无铺垫/证据雨/空口证据/人证空降——契诃夫之枪，证据必须先埋后打
      evidenceChain: { score: result.evidenceChain.score, sceneCount: result.evidenceChain.sceneCount, signalCount: result.evidenceChain.signalCount, issueCount: result.evidenceChain.issueCount, showCount: result.evidenceChain.showCount, plantCount: result.evidenceChain.plantCount, claimCount: result.evidenceChain.claimCount, witnessCount: result.evidenceChain.witnessCount, distinctEvidenceKinds: result.evidenceChain.distinctEvidenceKinds, fairShowCount: result.evidenceChain.fairShowCount, scenes: result.evidenceChain.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.evidenceChain.issues },
      // v2.143 金手指规则一致性（题材门控）：先用后立规/临时觉醒/零代价万能/许愿机/重生全知——外挂必须戴着镣铐跳舞
      cheatRule: { gate: result.cheatRule.gate, score: result.cheatRule.score, sceneCount: result.cheatRule.sceneCount, signalCount: result.cheatRule.signalCount, issueCount: result.cheatRule.issueCount, useCount: result.cheatRule.useCount, ruleCount: result.cheatRule.ruleCount, unlockCount: result.cheatRule.unlockCount, foreseeCount: result.cheatRule.foreseeCount, costCount: result.cheatRule.costCount, finishCount: result.cheatRule.finishCount, rebirthUseCount: result.cheatRule.rebirthUseCount, fluxCount: result.cheatRule.fluxCount, ruleFirstCount: result.cheatRule.ruleFirstCount, costPaidCount: result.cheatRule.costPaidCount, fairUnlockCount: result.cheatRule.fairUnlockCount, scenes: result.cheatRule.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.cheatRule.issues },
      // v2.144 闪回与梦境幻觉结构公平性：无标记梦醒假反转/幻觉无收束/闪回堆砌/同一记忆无新信息重复——记忆手法不许诈骗观众
      memoryFakeout: { score: result.memoryFakeout.score, sceneCount: result.memoryFakeout.sceneCount, signalCount: result.memoryFakeout.signalCount, issueCount: result.memoryFakeout.issueCount, dreamEnterCount: result.memoryFakeout.dreamEnterCount, wakeCount: result.memoryFakeout.wakeCount, markedDreamCount: result.memoryFakeout.markedDreamCount, fakeoutCount: result.memoryFakeout.fakeoutCount, imagineCount: result.memoryFakeout.imagineCount, hallucinationCount: result.memoryFakeout.hallucinationCount, flashbackCount: result.memoryFakeout.flashbackCount, flashExitCount: result.memoryFakeout.flashExitCount, repeatedMemoryKinds: result.memoryFakeout.repeatedMemoryKinds, fairRecallCount: result.memoryFakeout.fairRecallCount, boundedFlashCount: result.memoryFakeout.boundedFlashCount, scenes: result.memoryFakeout.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.memoryFakeout.issues },
      // v2.145 情绪余波连续性（无门控）：创伤后秒清零/丧亡无消化/鸡汤秒治愈——重大情绪必须有涟漪
      emotionalAftermath: { score: result.emotionalAftermath.score, sceneCount: result.emotionalAftermath.sceneCount, signalCount: result.emotionalAftermath.signalCount, issueCount: result.emotionalAftermath.issueCount, traumaCount: result.emotionalAftermath.traumaCount, lossCount: result.emotionalAftermath.lossCount, breakdownCount: result.emotionalAftermath.breakdownCount, resetCount: result.emotionalAftermath.resetCount, comfortCount: result.emotionalAftermath.comfortCount, recoverCount: result.emotionalAftermath.recoverCount, carryCount: result.emotionalAftermath.carryCount, instantResetCount: result.emotionalAftermath.instantResetCount, unprocessedLossCount: result.emotionalAftermath.unprocessedLossCount, quickComfortCount: result.emotionalAftermath.quickComfortCount, griefCarryCount: result.emotionalAftermath.griefCarryCount, timeHealCount: result.emotionalAftermath.timeHealCount, healthyComfortCount: result.emotionalAftermath.healthyComfortCount, scenes: result.emotionalAftermath.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.emotionalAftermath.issues },
      // v2.146 空间位移连续性（无门控）：跨城瞬移/同场房间瞬移/内外景矛盾——换城市必须有交通或时间交代
      locationContinuity: { score: result.locationContinuity.score, sceneCount: result.locationContinuity.sceneCount, signalCount: result.locationContinuity.signalCount, issueCount: result.locationContinuity.issueCount, citySceneCount: result.locationContinuity.citySceneCount, travelPairCount: result.locationContinuity.travelPairCount, fairTravelCount: result.locationContinuity.fairTravelCount, locationAnchorCount: result.locationContinuity.locationAnchorCount, jumpCount: result.locationContinuity.jumpCount, transitionCount: result.locationContinuity.transitionCount, intExtSceneCount: result.locationContinuity.intExtSceneCount, conflictCount: result.locationContinuity.conflictCount, instantTravelCount: result.locationContinuity.instantTravelCount, locationJumpCount: result.locationContinuity.locationJumpCount, setConflictCount: result.locationContinuity.setConflictCount, scenes: result.locationContinuity.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.locationContinuity.issues },
      // v2.147 角色在场感连续性（无门控）：离场后仍说话/亡者开口/挂断后对空气说话——人得真的在场才能开口
      characterPresence: { score: result.characterPresence.score, sceneCount: result.characterPresence.sceneCount, signalCount: result.characterPresence.signalCount, issueCount: result.characterPresence.issueCount, speakerCount: result.characterPresence.speakerCount, exitCount: result.characterPresence.exitCount, deathCount: result.characterPresence.deathCount, hangupCount: result.characterPresence.hangupCount, reenterCount: result.characterPresence.reenterCount, ghostCount: result.characterPresence.ghostCount, deadAliveCount: result.characterPresence.deadAliveCount, phantomCallCount: result.characterPresence.phantomCallCount, fairReenterCount: result.characterPresence.fairReenterCount, scenes: result.characterPresence.scenes.slice(0, 12).map((s) => ({ index: s.index, header: s.header, flagCount: s.flagCount })), issues: result.characterPresence.issues },
      // v2.80 焊点承接（无门控）：前集结尾说话人没接住/零词汇衔接/开场直接跳时间——跨集结尾焊点的检测半边
      openingWeld: { score: result.openingWeld.score, checked: result.openingWeld.checked, prevEndingChars: result.openingWeld.prevEndingChars, speakers: result.openingWeld.speakers, lastSpeaker: result.openingWeld.lastSpeaker, overlapCount: result.openingWeld.overlapCount, issueCount: result.openingWeld.issueCount, issues: result.openingWeld.issues },
      aigcManifest: result.aigcManifest,
      aigcVolumePlan: result.aigcVolumePlan,
      aigcCurve: result.aigcCurve,
      format: result.format,
      filing: (project as Record<string, unknown>).filing ?? null });
  } catch (err) {
    // v2.542 isCancelled 判定增强：abort 发生在 HTTP 请求进行中时错误消息是 MODEL_ABORTED 而非 CANCELLED，
    // 用 abortController.signal.aborted 作为权威判定（不依赖错误消息字符串匹配）
    const isCancelled = abortController.signal.aborted || (err as Error).message === 'CANCELLED';
    console.error('[generate] episode failed:', (err as Error).message, (err as Error).stack?.split('\n').slice(0, 3).join(' | '));
    if (!isStaff && !isFree) {
      await withBillingTransaction(prisma, user.id, async (tx) => {
        if (paidViaQuota && activeMembership) {
          // 生成失败/取消：退还已占赠送集（条件 decrement 防减成负数）
          await tx.returnQuota(activeMembership.id);
        } else if (points > 0) {
          await unfreeze(tx, user.id, points, task.id, `unfreeze:${task.id}`);
        }
      }).catch(() => undefined);
    }
    await prisma.generationTask.update({ where: { id: task.id }, data: { status: isCancelled ? 'CANCELLED' : 'FAILED', errorMsg: (err as Error).message } });
    send({ stage: isCancelled ? 'cancelled' : 'failed_refunded', error: sanitizeClientError((err as Error).message) });
  } finally {
    deleteActiveAbort(task.id);
    clearTimeout(globalTimeout);
    clearInterval(heartbeat);
    if (!res.writableEnded && !res.destroyed) res.end();
  }
});

// v2.190 用户显式取消生成：abort 当前 task 的 AbortController，pipeline 在下一岗位调用前抛 CANCELLED
// v2.318 回归修复：GenerationTask 表本无 userId 字段，旧码判 task.userId 恒 undefined → 用户取消线上必 404；
// 改为 include project 判 project.userId（项目主人即任务归属人），行为测试锁定
generateRouter.post('/tasks/:id/cancel', authRequired, async (req: AuthRequest, res) => {
  const taskId = req.params.id;
  const task = await prisma.generationTask.findUnique({
    where: { id: taskId },
    include: { project: { select: { userId: true } } },
  }).catch(() => null);
  if (!task || task.project?.userId !== req.userId) return res.status(404).json({ error: '任务不存在' });
  if (task.status !== 'RUNNING') return res.status(409).json({ error: '任务不在运行中' });
  const ctrl = getActiveAbort(taskId);
  if (ctrl) {
    ctrl.abort();
    deleteActiveAbort(taskId); // v2.318 取消即出表：管理台 live 归零，管线收尾自行翻 CANCELLED 并解冻
  }
  res.json({ ok: true, taskId });
});

return generateRouter;
}

export const generateRouter = createGenerateRouter(defaultPrisma);
