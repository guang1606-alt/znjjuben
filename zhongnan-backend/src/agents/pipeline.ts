/**
 * 多智能体协同创作管线 v2（真实联动，不是摆设定）
 * ------------------------------------------------------------------
 * 一中枢(Showrunner) + 七岗位 + 双校验。岗位之间用【结构化交接物】串联：
 *   架构师→Outline(大纲/节拍/钩子)  人设师→Cast(人物卡) 写入全局圣经
 *   撰写师强制消费 Outline+Cast 写本集；观众代言官预判划走点倒逼强化
 *   润色师在原稿上“整稿修订”(替换而非堆叠)；双校验真实比对后更新圣经供下一集。
 * 未配置模型密钥时进入沙盘模式：按同一交接协议本地协作，保证流程可跑、可测、可演示。
 */
import { EngineTier } from '../config/pricing';
import { callText, extractJson, Role } from '../lib/model-proxy';
import { buildRoleDirective, antiAiScan, EPISODE_ARC, EPISODE_ARC_EN, RoleId } from '../engine/playbook';
import { clicheScan, buildStyleDirective, AntiStrength, CLICHE_TROPES } from '../engine/creativity';
import { dialogueScan, buildVoiceDirective, levelFromStyle, ColloquialLevel } from '../engine/dialogue';
import { lifeDetailDirective, groundedScan } from '../engine/lifelike';
import { validateScript, ScriptMode, scriptFormatDirective } from '../engine/script-format';
import { buildShotManifest, planAigcVolume, analyzeAigcSceneCurve, validateAigcScreenplay, boostSpokenRatio, analyzeAigcComposition } from '../engine/aigc-screenplay';
import { planAigcBeats, type AigcBeatPlan } from '../engine/aigc-beat';
import { adaptScriptLength, planTrim, hardTrimToRange } from '../engine/script-length';
import { buildSampleScript } from '../engine/sample-script';
import { resolveStyleByHint, buildDirective as buildStyleProfileDirective, styleConsistencyScan, type StyleProfile } from '../engine/style-library';
import { buildCustomStyleDirective } from '../engine/custom-style';
import { screenMatureText } from '../engine/mature-gating';
import { characterLogicScan, CastMap } from '../engine/character-logic';
import { rhythmScan } from '../engine/rhythm';
import { craftArchitectBrief, craftWriterBrief, craftAudienceBrief, craftMarketBrief, genericReactionScan, titlePitchCheck } from '../engine/craft-insights';
import { firstAppearanceCheck } from '../engine/writers-room';
import { aggregateScorecard, type DimInput } from '../engine/scorecard';
import {
  planHooks, auditHooks, hookName, describeHook, DEFAULT_PREF,
  CuePref, Strength, CueMode, HookPlan, EpisodePlan, ALL_HOOKS,
  VALID_FLAVORS, flavorName, type HookFlavor,
} from '../engine/hook-system';
import {
  planBeats, auditBeats, normalizeBeatPref, buildBeatDirective,
  BeatPlan, EpisodeBeat,
} from '../engine/beat-system';
import { auditNarrativeCoherence, episodeCoherenceNote, alignBeatsToHooks } from '../engine/narrative-orchestrator';
import { buildCraftStackDirective } from '../engine/craft-registry';
import { buildHitLabDirective, buildLongIpDirective, buildModeCraftDirective, buildMethodTraceDirective, buildFilmActDirective, buildPurposeGateDirective, buildRangeLensDirective } from '../engine/mode-craft';
import { canonicalModeId, craftKeyOf, canonicalSparkTrack, isSourceTextMode, scriptTypeCraftKeyOf, OUTPUT_LANGUAGES, type ScriptTypeId, type LanguageCode } from '../config/modes'; // v2.327 历史 raw 模式归一；v2.329 8 模式×剧本类型×输出语言三维；v2.331 类型补位方法论
import { buildBrandDirective, type BrandBriefInput } from '../engine/brand-brief';
import { buildTrendDirective, type TrendBriefInput, type TrendRiskReport } from '../engine/trend-brief';
import { buildBranchDirective, type BranchBriefInput } from '../engine/branch-brief';
import { buildCastAssetDirective, type CastAssetSeed } from '../engine/character-asset'; // v2.151 角色资产三岗位强约束
import { buildPropAssetDirective, type PropAssetSeed } from '../engine/prop-asset'; // v2.159 道具资产双岗位强约束（架构师/撰写师）
import { buildSceneAssetDirective, type SceneAssetSeed } from '../engine/scene-asset'; // v2.161 场景资产双岗位强约束（架构师/撰写师）
import { buildKnowledgeDirective, KnowledgeHint } from '../engine/knowledge-directive';
import { screenModeGate, type ModeGateReport } from '../engine/mode-gate';
import { craftLint, type CraftLintResult } from '../engine/craft-lint';
import { teardown, type TeardownReport } from '../engine/hit-teardown';
import { emotionCraftLint, type EmotionCraftResult } from '../engine/emotion-craft';
import { webnovelLint, type WebnovelLintResult } from '../engine/webnovel-craft';
import { archetypeLint, type ArchetypeLintResult } from '../engine/archetype-craft';
import { narrativeLint, type NarrativeLintResult } from '../engine/narrative-craft';
import { recommendStrategy, strategyToCuePref, strategyBeatHints, isValidHookStrategy } from '../engine/hook-strategy';
import { resolvePaceId, resolveDialogueId, paceDirective, dialogueDirective, getDialogueStrategy, resolveEmotionId, emotionBeatHints, emotionDirective, getPaceStrategyRange, resolveCharacterId, characterDirective } from '../engine/creation-strategy';
import { buildCreationContext, type CreationContextInput } from '../engine/creation-context';
import { recommendTrack, TRACK_STRATEGY, OVERSEA_PLAYBOOK, CROSS_CULTURE_PRINCIPLE, perEpisodeThreeQ } from '../engine/market-playbook';
import { matchGenreByPain, FAMILIAR_TWIST, GENRE_EN } from '../engine/genre-compensate';
import { investorLens } from '../engine/investor-lens';
import { foreshadowLedger, type ForeshadowLedgerResult } from '../engine/foreshadow-ledger';
import { arcTracker, type ArcTrackerResult, type CharacterArc } from '../engine/arc-tracker';
import { secretLedger, type SecretLedgerResult } from '../engine/secret-ledger'; // v2.80 跨集信息差台账
import { characterStateLedger, type CharacterStateLedgerResult } from '../engine/character-state-ledger'; // v2.80 人物状态跨集台账
import { buildRecap, type RecapResult } from '../engine/recap-builder'; // v2.80 上集回顾生成器
import { continuityBrief } from '../engine/continuity-brief'; // v2.80 生成侧跨集连续性简报（台账进提示词）
import { fatigueDirective, type DeviceEpInput } from '../engine/device-fatigue'; // v2.80 装置防疲劳生成侧注入
import { presenceDirective, type PresenceBit } from '../engine/cast-presence-ledger'; // v2.80 配角在场防遗忘生成侧注入
import { pairBondDirective, type PairBit } from '../engine/pair-bond-ledger'; // v2.80 关系线保鲜台账生成侧注入
import { subplotWeaveDirective, type SubplotBit } from '../engine/subplot-weave'; // v2.80 支线编织台账生成侧注入
import { gratificationDirective, type WaveEpInput } from '../engine/gratification-wave'; // v2.80 憋爽波浪台账生成侧注入
import { openingContinuityCheck, type OpeningContinuityResult } from '../engine/opening-continuity-check'; // v2.80 焊点承接检测（跨集结尾焊点的"检测"半边）
import { voicePrint, type VoicePrintResult } from '../engine/voice-print';
import { showDontTellScan, type ShowDontTellResult } from '../engine/show-dont-tell';
import { cliffhangerScore, type CliffhangerScoreResult } from '../engine/cliffhanger-score';
import { hookPayoffCheck, hookPayoffDirective, type HookBit, type HookPayoffResult } from '../engine/cliffhanger-payoff'; // v2.80 集尾钩子跨集兑现账本
import { humiliationDebtLedger, humiliationDirective, extractHumiliationBits, normalizeDebtEp, type DebtEpInput, type HumiliationDebtResult } from '../engine/humiliation-ledger'; // v2.80 屈辱-打脸跨集账本
import { mysteryDroughtLedger, mysteryDroughtDirective, mysteryAdvanceCheck, deriveMysteryHook, type MysteryRow, type MysteryDroughtResult } from '../engine/mystery-drought'; // v2.80 多集悬念干旱账本
import { hookFatigueLedger, hookFatigueDirective, deriveEndHookType, type HookTypeRow, type HookFatigueResult } from '../engine/hook-fatigue'; // v2.80 跨集钩型疲劳账本
import { propLedger, propDirective, extractPropMentions, type PropRow, type PropLedgerResult } from '../engine/prop-ledger'; // v2.80 信物跨集连续性账本
import { promiseDroughtLedger, promiseDroughtDirective, derivePromiseLine, promiseAdvanceCheck, type PromiseRow, type PromiseDroughtResult } from '../engine/promise-ledger'; // v2.80 承诺欠账账本
import { villainThreatLedger, villainThreatDirective, detectVillainAction, type VillainRow, type VillainThreatResult } from '../engine/villain-threat'; // v2.80 反派威胁升级账本
import { timelineLedger, timelineDirective, deriveTimelineMark, type TimelineRow, type TimelineLedgerResult } from '../engine/timeline-ledger'; // v2.80 时间线跨集账本
import { costLedger, costDirective, deriveCostSignal, type CostRow, type CostLedgerResult } from '../engine/cost-ledger'; // v2.80 代价跨集账本
import { deathLedger, deathDirective, deriveDeathSignal, type DeathRow, type DeathLedgerResult } from '../engine/death-ledger'; // v2.80 死亡穿帮账本（跨集复活监控）
import { villainFateLedger, fateDirective, deriveFateSignal, type FateRow, type VillainFateLedgerResult } from '../engine/villain-fate-ledger'; // v2.80 反派下场账本（跨集下场维持监控）
import { woundRecoveryLedger, woundDirective, deriveWoundSignal, type WoundRow, type WoundRecoveryLedgerResult } from '../engine/wound-recovery-ledger'; // v2.80 创伤恢复账本（跨集伤势维持监控）
import { powerProgressLedger, powerDirective, derivePowerSignal, type PowerRow, type PowerProgressLedgerResult } from '../engine/power-progress-ledger'; // v2.80 境界进阶账本（跨集境界阶梯连续性）
import { itemOwnershipLedger, ownershipDirective, deriveOwnershipRows, type ItemRow, type ItemOwnershipLedgerResult } from '../engine/item-ownership-ledger'; // v2.80 信物归属账本（跨集人名级所有权转移连续性）
import { relationshipLedger, relationshipDirective, deriveRelationRows, type RelRow, type RelLedgerResult } from '../engine/relationship-ledger'; // v2.80 关系翻转账本（跨集人名对关系翻转连续性）
import { affiliationLedger, affiliationDirective, deriveAffiliationRows, type AffRow, type AffiliationLedgerResult } from '../engine/affiliation-ledger'; // v2.80 阵营归属账本（跨集人名×组织名归属翻转连续性）
import { locationLedger, locationDirective, deriveLocationRows, type LocRow, type LocationLedgerResult } from '../engine/location-ledger'; // v2.80 地点跨集账本（跨集人名×地点名滞留连续性）
import { secretLeakLedger, secretLeakDirective, deriveLeakRows, type LeakRow, type SecretLeakLedgerResult } from '../engine/secret-leak-ledger'; // v2.80 秘密泄露账本（跨集人名×秘密知情范围扩散连续性）
import { disguiseLedger, disguiseDirective, deriveDisguiseRows, type DisguiseRow, type DisguiseLedgerResult } from '../engine/disguise-ledger'; // v2.80 伪装身份账本（跨集人名×伪装身份揭穿/维持连续性）
import { debtLedger, debtDirective, deriveDebtRows, type DebtRow, type DebtLedgerResult } from '../engine/debt-ledger'; // v2.80 人情债账本（跨集施恩/偿还/背叛连续性）
import { allianceLedger, allianceDirective, deriveAllianceRows, type AllianceRow, type AllianceLedgerResult } from '../engine/alliance-ledger'; // v2.80 联盟账本（跨集利益联盟建立/瓦解连续性）
import { memoryLedger, memoryDirective, deriveMemoryRows, type MemoryRow, type MemoryLedgerResult } from '../engine/memory-ledger'; // v2.80 记忆账本（跨集失忆/恢复/回忆连续性）
import { impersonationLedger, impersonationDirective, deriveImpersonationRows, type ImpersonationRow, type ImpersonationLedgerResult } from '../engine/impersonation-ledger'; // v2.80 冒充账本（跨集冒充真人/身份重叠连续性）
import { betrayalLedger, betrayalDirective, deriveBetrayalRows, type BetrayalRow, type BetrayalLedgerResult } from '../engine/betrayal-ledger'; // v2.80 背叛账本（跨集背叛/和解/合作信任连续性）
import { sacrificeLedger, sacrificeDirective, deriveSacrificeRows, type SacrificeRow, type SacrificeLedgerResult } from '../engine/sacrifice-ledger'; // v2.80 牺牲账本（跨集牺牲/感恩/轻慢忘恩连续性）
import { curseLedger, curseDirective, deriveCurseRows, type CurseRow, type CurseLedgerResult } from '../engine/curse-ledger'; // v2.80 诅咒账本（跨集中咒/解除/不受影响连续性）
import { possessionLedger, possessionDirective, derivePossessionRows, type PossessionRow, type PossessionLedgerResult } from '../engine/possession-ledger'; // v2.80 附身账本（跨集附身/解除/本人意志连续性）
import { timeTravelLedger, timeTravelDirective, deriveTimeTravelRows, type TimeTravelRow, type TimeTravelLedgerResult } from '../engine/time-travel-ledger'; // v2.80 穿越账本（跨集穿越/回归/原时间线连续性）
import { transformationLedger, transformationDirective, deriveTransformationRows, type TransformationRow, type TransformationLedgerResult } from '../engine/transformation-ledger'; // v2.80 变身账本（跨集变身/恢复/原形连续性）
import { poisonLedger, poisonDirective, derivePoisonRows, type PoisonRow, type PoisonLedgerResult } from '../engine/poison-ledger'; // v2.80 中毒账本（跨集中毒/解毒/无恙连续性）
import { dialogueAiTaste, type DialogueAiTasteResult } from '../engine/dialogue-ai-taste'; // v2.80 对白AI味检测（排比/说教/书面语/解释性/金句，创作能力类）
import { sceneEmotionFlat, type SceneEmotionFlatResult } from '../engine/scene-emotion-flat'; // v2.80 场景情绪平检测（单场情绪对比度，创作能力类）
import { sensoryDetail, type SensoryResult } from '../engine/sensory-detail'; // v2.80 感官细节密度（五感覆盖/非视觉密度，创作能力类）
import { vagueWord, type VagueWordResult } from '../engine/vague-word'; // v2.80 模糊词/空心词检测（对冲/空心名词/模糊量词，创作能力类）
import { dialogueNameCall, type DialogueNameCallResult } from '../engine/dialogue-name-call'; // v2.80 对白直呼名过密检测（两人戏句句叫名=AI痕迹，创作能力类）
import { dialoguePingpong, type DialoguePingpongResult } from '../engine/dialogue-pingpong'; // v2.80 机械问答乒乓检测（问即直答/无回避反问沉默，创作能力类）
import { hollowAction, type HollowActionResult } from '../engine/hollow-action'; // v2.80 空心动作调度检测（站坐叹气深呼吸纯调度填充，创作能力类）
import { emotionWhiplash, type EmotionWhiplashResult } from '../engine/emotion-whiplash'; // v2.80 情绪硬切无铺垫检测（极性对跳无触发事件/瞬时翻转短语，创作能力类）
import { echoDialogue, type EchoDialogueResult } from '../engine/echo-dialogue'; // v2.80 对白回声复述检测（短问句鹦鹉学舌/叙述复述台词，创作能力类）
import { expositionDialogue, type ExpositionDialogueResult } from '../engine/exposition-dialogue'; // v2.80 保姆式对白检测（共知旧事宣讲/规矩说明书，创作能力类）
import { sceneSoftEnding, type SceneSoftEndingResult } from '../engine/scene-soft-ending'; // v2.80 场景软收尾检测（冲突后叹气转身泄气，要硬切，创作能力类）
import { emotionLabelDialogue, type EmotionLabelDialogueResult } from '../engine/emotion-label-dialogue'; // v2.80 台词情绪点名检测（我对你太失望/我很难过，情绪要压进事实，创作能力类）
import { roundRobinDialogue, type RoundRobinResult } from '../engine/round-robin-dialogue'; // v2.80 会议体轮转对白检测（群戏按人头轮流读稿、句长整齐零抢话，创作能力类）
import { rhetoricalBarrage, type BarrageResult } from '../engine/rhetorical-barrage'; // v2.80 反问连珠检测（同一人质问倾泻、气势代替事实，创作能力类）
import { mirrorVisualDialogue, type MirrorVisualResult } from '../engine/mirror-visual-dialogue'; // v2.80 台词复述画面检测（把镜头已演的眼前画面用完整句再念一遍，创作能力类）
import { mindReadingNarration, type MindReadingResult } from '../engine/mind-reading-narration'; // v2.80 叙述者读心检测（她知道/他明白式抽象结论直给，不可拍，创作能力类）
import { crowdReaction, type CrowdReactionResult } from '../engine/crowd-reaction'; // v2.80 群体反应偷懒检测（众人哗然/全场愣住，群体要落到具体一张脸，创作能力类）
import { patheticFallacy, type PatheticFallacyResult } from '../engine/pathetic-fallacy'; // v2.80 环境共情/天气替演检测（暴雨仿佛在为她哭泣，天气不替人演情绪，创作能力类）
import { omniscientTease, type OmniscientTeaseResult } from '../engine/omniscient-tease'; // v2.80 全知预告/伪悬念检测（她不知道的是/命运的齿轮，钩子要可拍不要预告，创作能力类）
import { effortGloss, type EffortGlossResult } from '../engine/effort-gloss'; // v2.80 努力过程概述/场外达成检测（几经周折终于签下，对抗过程不能打包给旁白，创作能力类）
import { reactionCliche, type ReactionClicheResult } from '../engine/reaction-cliche'; // v2.80 面部反应公式检测（愣+皱眉+咬唇三连/瞳孔一缩万能复用，反应要专属并接动作，创作能力类）
import { infoDelivery, type InfoDeliveryResult } from '../engine/info-delivery'; // v2.80 被动信息投喂检测（手机短信/下属汇报推送剧情，信息要靠人物行动抢来，创作能力类）
import { atmosphereTell, type AtmosphereTellResult } from '../engine/atmosphere-tell'; // v2.80 气氛直述检测（气氛尴尬/空气凝固，场景情绪要演不能宣布，创作能力类）
import { confrontationDodge, type ConfrontationDodgeResult } from '../engine/confrontation-dodge'; // v2.80 关键时刻打断逃场检测（刚要摊牌就敲门，冲突必须当场打满，创作能力类）
import { selfIntroDump, type SelfIntroDumpResult } from '../engine/self-intro-dump'; // v2.80 简历式自我介绍检测（我叫X今年X岁是XX，身份要靠麻烦带出来，创作能力类）
import { moralNarration, type MoralNarrationResult } from '../engine/moral-narration'; // v2.80 道理升华旁白检测（她终于明白/原来从来都是，主题靠动作点不靠金句，创作能力类）
import { emptyThreat, type EmptyThreatResult } from '../engine/empty-threat'; // v2.80 空口威胁检测（你给我等着/你会后悔的，狠话当场兑现，创作能力类）
import { timeJumpPayoff, type TimeJumpPayoffResult } from '../engine/time-jump-payoff'; // v2.80 时间跳转兑付检测（三天后她已经签好字，跳转只换场不兑付，创作能力类）
import { emotionPropCrutch, type EmotionPropCrutchResult } from '../engine/emotion-prop-crutch'; // v2.80 情绪道具拐杖检测（摔杯灌酒淋雨撕照片，情绪不靠固定道具充值，创作能力类）
import { emotionVentCliche, type EmotionVentResult } from '../engine/emotion-vent-cliche'; // v2.80 情绪宣泄套路检测（痛哭嘶吼跪求自扇，最大音量不超一次且要换动作，创作能力类）
import { actionEchoDialogue, type ActionEchoResult } from '../engine/action-echo-dialogue'; // v2.80 动作回声台词检测（你打我？你把合同撕了？镜头演过的不再用嘴确认，创作能力类）
import { eavesdropDump, type EavesdropDumpResult } from '../engine/eavesdrop-dump'; // v2.80 撞听秘密检测（走到门口反派就用完整句子宣讲密谋套餐，真相必须有代价，创作能力类）
import { selfPityLitany, type SelfPityResult } from '../engine/self-pity-litany'; // v2.80 自怜连祷检测（跪着开苦难报告会问天乞怜，惨而不倒才是脊梁，创作能力类）
import { villainOverconfession, type VillainOverconfessionResult } from '../engine/villain-overconfession'; // v2.80 反派不打自招检测（一句空问换卷宗，信息差是悬疑戏的金库，创作能力类）
import { cheapForgiveness, type CheapForgivenessResult } from '../engine/cheap-forgiveness'; // v2.80 廉价原谅检测（血海深仇三行清零，和解必须付清代价，创作能力类）
import { witnessGratuity, type WitnessGratuityResult } from '../engine/witness-gratuity'; // v2.80 证人无动机倾倒检测（管家一句空问端出冷案套餐，每条情报都要付代价，创作能力类）
import { previewVoiceover, type PreviewVoiceoverResult } from '../engine/preview-voiceover'; // v2.80 集尾预告口播检测（下集预告/求关注/旁白将来时排播，剧本只写正在发生的戏，创作能力类）
import { stanceFlip, type StanceFlipResult } from '../engine/stance-flip'; // v2.80 无因立场横跳检测（死誓几句内无施压无代价就反做决定，立场转变必须挣来，创作能力类）
import { unplantedAsset, type UnplantedAssetResult } from '../engine/unplanted-asset'; // v2.80 后手空降检测（录音/报警/律师第一次出现就是掏出来翻盘那一刻，反向契诃夫之枪，创作能力类）
import { propMotifRhythm, type PropMotifResult } from '../engine/prop-motif-rhythm'; // v2.133 物象母题节奏检测（聚焦即弃/冷枪远隔/情感漂移，契诃夫之枪三现法，创作能力类）
import { subtextErase, type SubtextEraseResult } from '../engine/subtext-erase'; // v2.80 旁白翻译机检测（叙述行紧邻台词做阅读理解，"这话分明是在警告她"，潜台词不许旁白报答案，创作能力类）
import { exitCliche, type ExitClicheResult } from '../engine/exit-cliche'; // v2.80 强离场收尾依赖检测（每场吵完都摔门夺门硬切，末拍要落在牌桌上不是人走光，创作能力类）
import { phoneRelay, type PhoneRelayResult } from '../engine/phone-relay'; // v2.80 电话传话机检测（单边电话复读"什么！他死了？我马上到"，画外事件不许只靠电话播报，创作能力类）
import { fakeChoice, type FakeChoiceResult } from '../engine/fake-choice'; // v2.80 假选择检测（两难零挣扎秒答、放弃项零代价，"孩子和公司只能保一个""我签"，选择必须有重量，创作能力类）
import { parenOverdirect, type ParenOverdirectResult } from '../engine/paren-overdirect'; // v2.80 括注导演检测（每句台词挂（冷笑）（挑眉）情绪条，表演指导塞进 cue 行，信任演员与动作行，创作能力类）
import { abstractAccusation, type AbstractAccusationResult } from '../engine/abstract-accusation'; // v2.80 全称指控检测（"你从来都这样""you never care"零事实吵架，冲突必须用具体事件当刀子，创作能力类）
import { cheapEmpathy, type CheapEmpathyResult } from '../engine/cheap-empathy'; // v2.80 廉价共情检测（"我理解你的感受/That must have been hard"咨询师话术，安慰要笨拙行动或自我暴露，创作能力类）
import { fidgetProp, type FidgetPropResult } from '../engine/fidget-prop'; // v2.80 闲玩道具标签检测（转钢笔/摩挲婚戒/盘核桃/twirling pen，道具第3次出场必须做功，创作能力类）
import { emptyVow, type EmptyVowResult } from '../engine/empty-vow'; // v2.80 空转誓言检测（我要让他付出代价/revenge will be mine 无筹码无期限预告片台词，誓言要落到刀与死线，创作能力类）
import { apologyLoop, type ApologyLoopResult } from '../engine/apology-loop'; // v2.114 道歉循环检测（对不起/我错了/原谅我反复念无自首无赔偿无退股，道歉要落到赎罪行动，创作能力类）
import { forcedProximity, type ForcedProximityResult } from '../engine/forced-proximity'; // v2.115 困处阀门检测（电梯故障/暴雨停电/密室反锁一困就心动一困就靠近，物理困境当关系开关，创作能力类）
import { rescueRomance, type RescueRomanceResult } from '../engine/rescue-romance'; // v2.116 英雄救美必生情检测（救命挡刀两拍内心跳漏拍"就是他了"，恩情当爱情开关，创作能力类）
import { fightReconcileCrutch, type FightReconcileResult } from '../engine/fight-reconcile-crutch'; // v2.117 吵架秒和好检测（摔门走人又回头"算了都过去了"，跳过反思与道歉，和解当万能缓冲阀，创作能力类）
import { instantRepentance, type InstantRepentanceResult } from '../engine/instant-repentance'; // v2.118 加害者秒悔悟检测（作恶行凶后一句"我错了"，跳过反思与赎罪，悔悟当万能赎罪阀，创作能力类）
import { talkDownCrutch, type TalkDownResult } from '../engine/talk-down-crutch'; // v2.119 嘴炮退敌检测（枪口刀锋下的对峙被三句劝降词解压，跳过博弈与代价，说降当万能对峙阀，创作能力类）
import { instantSurgery, type InstantSurgeryResult } from '../engine/instant-surgery'; // v2.120 野战手术秒成功检测（客厅仓库里取子弹缝合零资质零代价零失败，医学门槛当纸糊，创作能力类）
import { crowdFlip, type CrowdFlipResult } from '../engine/crowd-flip'; // v2.121 当众倒戈白给检测（一场揭露全场齐刷刷翻转零质疑零分裂零代价，群体忠诚当开关拨，创作能力类）
import { rumorSpeed, type RumorSpeedResult } from '../engine/rumor-speed'; // v2.122 丑闻秒传遍检测（消息一夜传遍全城零时间零载体零对抗，舆论不是点菜单是森林大火，创作能力类）
import { resultsOnCue, type ResultsOnCueResult } from '../engine/results-on-cue'; // v2.123 化验秒出检测（该等一周的鉴定当场就拿，官方流程耗时白给，公家钟表被剧情拨快，创作能力类）
import { trafficOnCue, type TrafficOnCueResult } from '../engine/traffic-on-cue'; // v2.124 路况掐点检测（追凶就堵车、逃命就一路绿灯，城市交通被剧情当水龙头拨快拨慢，创作能力类）
import { flashbackCrutch, type FlashbackCrutchResult } from '../engine/flashback-crutch'; // v2.80 回忆杀拐杖检测（同一闪回整段重播/超三行蒙太奇不接当下动作，记忆要当扳机别当床垫，创作能力类）
import { accidentalSpark, type AccidentalSparkResult } from '../engine/accidental-spark'; // v2.80 事故心动检测（摔进怀里/意外之吻批发，火花必须来自选择不靠地心引力，创作能力类）
import { commFailCrutch, type CommFailCrutchResult } from '../engine/comm-fail-crutch'; // v2.80 通讯失灵拐杖检测（没信号/没电/打不通当剧情阀门反复用，创作能力类）
import { drunkTruth, type DrunkTruthResult } from '../engine/drunk-truth'; // v2.80 灌醉吐真言检测（灌醉当万能钥匙批量解锁机密，创作能力类）
import { tearBait, type TearBaitResult } from '../engine/tear-bait'; // v2.80 泪点开关检测（弱档眼泪高频复用当共情快捷键，创作能力类）
import { instantDeduction, type InstantDeductionResult } from '../engine/instant-deduction'; // v2.80 看一眼破案检测（观察×解谜强断言零物证，零成本破案当人形答案机，创作能力类）
import { recordsOnDemand, type RecordsOnDemandResult } from '../engine/records-on-demand'; // v2.80 万能档案检测（一查必中密度病，档案库当许愿池，创作能力类）
import { walkInTiming, type WalkInTimingResult } from '../engine/walk-in-timing'; // v2.81 说曹操曹操到检测（谈论→无铺垫登场 timing 巧合，创作能力类）
import { helpOnDemand, type HelpOnDemandResult } from '../engine/help-on-demand'; // v2.82 随叫随到工具人检测（求助→零摩擦应允，免费人力渠道，创作能力类）
import { delayedReveal, type DelayedRevealResult } from '../engine/delayed-reveal'; // v2.83 信息容器延迟开启检测（信息在手却用不敢拆拖延释放，悬念阀门，创作能力类）
import { instantTrust, type InstantTrustResult } from '../engine/instant-trust'; // v2.84 初见托付检测（初见面就把公章/孩子/命脉交给陌生人，信任白给，创作能力类）
import { instantKinship, type InstantKinshipResult } from '../engine/instant-kinship'; // v2.85 认亲白给检测（血缘揭露三行内被零成本接纳，亲情速热，创作能力类）
import { faintOnCue, type FaintOnCueResult } from '../engine/faint-on-cue'; // v2.86 晕倒阀门检测（关键时刻就晕倒掐断关键信息，生理当剧情阀门，创作能力类）
import { alwaysLate, type AlwaysLateResult } from '../engine/always-late'; // v2.86 每次都晚一步检测（抵达就刚走，错过当剧情阀门，创作能力类）
import { instantLove, type InstantLoveResult } from '../engine/instant-love'; // v2.88 初见白给检测（第一次见面三行内就以身相许，爱情速热，创作能力类）
import { convenientEncounter, type ConvenientEncounterResult } from '../engine/convenient-encounter'; // v2.89 转角偶遇检测（世界太小，旧人零铺垫高频撞见，创作能力类）
import { instantHack, type InstantHackResult } from '../engine/instant-hack'; // v2.90 黑客秒破检测（键盘敲三下黑进公安内网，高安全系统零成本崩塌，创作能力类）
import { instantMarksman, type InstantMarksmanResult } from '../engine/instant-marksman'; // v2.91 神枪手开挂检测（零训练零失手弹弹咬要害，技能精准零成本，创作能力类）
import { instantLanguage, type InstantLanguageResult } from '../engine/instant-language'; // v2.92 语言秒精通检测（零学费零口音从听不懂到流利只隔三行，语言习得零成本，创作能力类）
import { wakeUpCall, type WakeUpCallResult } from '../engine/wake-up-call'; // v2.93 一句话点醒检测（多年心结被单句台词瞬间治愈，说教治愈零成本，创作能力类）
import { wakeOnCue, type WakeOnCueResult } from '../engine/wake-on-cue'; // v2.94 呼唤即醒检测（昏迷多年的人被一声呼唤唤醒，病床当剧情阀门，创作能力类）
import { woundOnCue, type WoundOnCueResult } from '../engine/wound-on-cue'; // v2.95 带伤开挂检测（重伤未愈的人当剧情需要时全力输出，伤势当编剧开关，创作能力类）
import { instantEscape, type InstantEscapeResult } from '../engine/instant-escape'; // v2.96 束缚秒脱检测（五花大绑锁进仓库下一拍就自己走出来，束缚当编剧开关，创作能力类）
import { weaponJam, type WeaponJamResult } from '../engine/weapon-jam'; // v2.97 武器哑火检测（关键时刻枪必没子弹卡壳空膛，武器当编剧阀门，创作能力类）
import { vehicleJam, type VehicleJamResult } from '../engine/vehicle-jam'; // v2.125 载具掐点故障检测（正要追人就打不着火、逃命半路必爆胎，车当编剧阀门，创作能力类）
import { sleepTalk, type SleepTalkResult } from '../engine/sleep-talk'; // v2.126 梦呓泄密检测（睡梦中一句呓语吐出藏匿点/密码/身世，睡眠当编剧免费情报口，创作能力类）
import { feverTruth, type FeverTruthResult } from '../engine/fever-truth'; // v2.127 高烧谵妄吐真言检测（一场谵妄吐出藏匿点/密码/隐情，发烧当编剧万能钥匙，创作能力类）
import { instantEndowment, type InstantEndowmentResult } from '../engine/instant-endowment'; // v2.128 无因馈赠检测（初次见面就给钱/房/车/职位，萍水相逢当编剧许愿池，创作能力类）
import { lastSecondRescue, type LastSecondRescueResult } from '../engine/last-second-rescue'; // v2.129 救兵天降检测（绝境中救兵最后一秒无因赶到，生死关头不许只等救援，创作能力类）
import { villainStall, type VillainStallResult } from '../engine/villain-stall'; // v2.130 反派拖刀检测（处决执行中临场拖延不落锤，威胁兑付不许白给时间窗口，创作能力类）
import { teamBriefing, type TeamBriefingResult } from '../engine/team-briefing'; // v2.131 开会式推进检测（部署写成排班表、分派即诺零摩擦执行，群像不许当任务编排仪表盘，创作能力类）
import { evidenceBlank, type EvidenceBlankResult } from '../engine/evidence-blank'; // v2.98 证据恰好失灵检测（剧情需要黑时监控就坏内存卡就满，取证载体当编剧阀门，创作能力类）
import { childBlurt, type ChildBlurtResult } from '../engine/child-blurt'; // v2.99 萌宝泄密检测（大人死守的秘密被奶声奶气的娃一句话当众拆封且满座采信，孩童当编剧拆信刀，创作能力类）
import { deadlineStretch, type DeadlineStretchResult } from '../engine/deadline-stretch'; // v2.100 假倒计时检测（"三天之内还不上就收房"喊完没人赶时间、到点不收账或零成本宽限，期限当编剧空喇叭，创作能力类）
import { softInterrogation, type SoftInterrogationResult } from '../engine/soft-interrogation'; // v2.101 审讯秒招检测（拍桌吼一句嫌疑人立刻全招，同伙地点计划免费打包，审讯室当真话提款机，创作能力类）
import { deathbedConfession, type DeathbedConfessionResult } from '../engine/deathbed-confession'; // v2.102 临终全招检测（血泊中报完真凶同伙证据地点准时咽气，死亡当真相快递柜，创作能力类）
import { truthSerum, type TruthSerumResult } from '../engine/truth-serum'; // v2.103 吐真剂秒招检测（针管一推眼皮发沉同伙地点旧案问什么答什么，药物当意志开关，创作能力类）
import { pregnancyOnCue, type PregnancyOnCueResult } from '../engine/pregnancy-on-cue'; // v2.104 妊娠剧情阀门检测（一推就见红一吐就两道杠，孕妇身体当关系遥控器，生殖身体通道阀门，创作能力类）
import { amnesiaOnCue, type AmnesiaOnCueResult } from '../engine/amnesia-on-cue'; // v2.105 失忆剧情阀门检测（撞头秒失忆老歌秒读档，脑子当编剧暂停键快进键，颅脑记忆通道阀门，创作能力类）
import { terminalDiagnosisOnCue, type TerminalDiagnosisOnCueResult } from '../engine/terminal-diagnosis-on-cue'; // v2.106 绝症剧情阀门检测（宣判秒翻转误诊秒痊愈，死亡判决书当编剧撤回键，生死期限通道阀门，创作能力类）
import { allergyOnCue, type AllergyOnCueResult } from '../engine/allergy-on-cue'; // v2.107 过敏剧情阀门检测（接触秒发作一针秒解除，免疫系统当编剧一键引爆一键拆除扳手，急性免疫通道阀门，创作能力类）
import { blindnessOnCue, type BlindnessOnCueResult } from '../engine/blindness-on-cue'; // v2.108 失明复明剧情阀门检测（撞击秒失明拆纱布秒复明，视觉当编剧电灯开关一拉全灭一拉全亮，感官视觉通道阀门，创作能力类）
import { poisonOnCue, type PoisonOnCueResult } from '../engine/poison-on-cue'; // v2.109 中毒秒解毒剧情阀门检测（喝杯毒酒三行七窍流血、解药一灌当场活蹦乱跳，毒物当编剧电灯开关一拉夺命一拉回魂，身体毒理通道阀门，创作能力类）
import { muteOnCue, type MuteOnCueResult } from '../engine/mute-on-cue'; // v2.110 失声复声剧情阀门检测（一场惊吓三行再也开不了口、神医金针孩子哭喊当场字正腔圆，嗓子当编剧电灯开关一拉全灭一拉全亮，身体言语通道阀门，创作能力类）
import { deafOnCue, type DeafOnCueResult } from '../engine/deaf-on-cue'; // v2.111 耳聋复聪剧情阀门检测（耳边炸响三行双耳失聪、银针耳穴/耳蜗开机当场 hi-fi 复聪，听觉当编剧电灯开关一拉全灭一拉全亮，身体听觉通道阀门，创作能力类）
import { paralysisOnCue, type ParalysisOnCueResult } from '../engine/paralysis-on-cue'; // v2.112 瘫痪秒愈剧情阀门检测（塌房坠车三行高位截瘫、银针脊柱/咔嚓正骨当场健步如飞，双腿当编剧电灯开关一拉全灭一拉全亮，身体肢体移动通道阀门，创作能力类）
import { fatigueOverdrive, type FatigueOverdriveResult } from '../engine/fatigue-overdrive'; // v2.113 疲劳透支开挂检测（三天三夜没合眼的人当剧情需要时神采奕奕全力输出，精力当编剧开关，身体精力通道阀门，创作能力类）
import { coolMomentScore, type CoolMomentScoreResult } from '../engine/cool-moment-score';
import { dialogueWaterCheck, type DialogueWaterResult } from '../engine/dialogue-water-check';
import { conflictDensityCheck, type ConflictDensityResult } from '../engine/conflict-density-check';
import { punchlineDensityScore, type PunchlineDensityResult } from '../engine/punchline-density-score';
import { sceneDensityScore, type SceneDensityResult } from '../engine/scene-density-score';
import { repetitionCheck, type RepetitionResult } from '../engine/repetition-check';
import { characterBalanceCheck, type CharacterBalanceResult } from '../engine/character-balance-check';
import { twistDensityScore, type TwistDensityResult } from '../engine/twist-density-score';
import { dialogueLengthScore, type DialogueLengthResult } from '../engine/dialogue-length-score';
import { informationDensityScore, type InformationDensityResult } from '../engine/information-density-score';
import { suspenseTensionCurve, type SuspenseTensionResult } from '../engine/suspense-tension-curve';
import { sceneHeaderConvention, buildSceneHeaderDirective, type SceneHeaderResult } from '../engine/scene-header-convention';
import { dialogueFunctionalityCheck, type DialogueFunctionResult } from '../engine/dialogue-functionality-check';
import { causalLogicCheck, type CausalLogicResult } from '../engine/causal-logic-check';
import { protagonistGoalCheck, type ProtagonistGoalResult } from '../engine/protagonist-goal-check';
import { antagonistQualityCheck, type AntagonistQualityResult } from '../engine/antagonist-quality-check';
import { payoffRhythmCheck, type PayoffRhythmResult } from '../engine/payoff-rhythm-check';
import { relationshipProgressionCheck, type RelationshipResult } from '../engine/relationship-progression-check';
import { scenePaddingCheck, type ScenePaddingResult } from '../engine/scene-padding-check';
import { supportingCharacterCheck, type SupportingCharacterResult } from '../engine/supporting-character-check';
import { conflictEscalationCheck, type ConflictEscalationResult } from '../engine/conflict-escalation-check';
import { subtextCheck, type SubtextResult } from '../engine/subtext-check';
import { supportingArcCheck, type SupportingArcResult } from '../engine/supporting-arc-check';
import { scenePurposeCheck, type ScenePurposeResult } from '../engine/scene-purpose-check';
import { timelineConsistencyCheck, type TimelineConsistencyResult } from '../engine/timeline-consistency-check';
import { continuitySupervisionCheck, type ContinuitySupervisionResult } from '../engine/continuity-supervision-check';
import { misunderstandingDragCheck, type MisunderstandingDragResult } from '../engine/misunderstanding-drag-check';
import { plotArmorCheck, type PlotArmorResult } from '../engine/plot-armor-check';
import { evidenceChainCheck, type EvidenceChainResult } from '../engine/evidence-chain-check';
import { cheatRuleCheck, type CheatRuleResult } from '../engine/cheat-rule-check';
import { memoryFakeoutCheck, type MemoryFakeoutResult } from '../engine/memory-fakeout-check';
import { emotionalAftermathCheck, type EmotionalAftermathResult } from '../engine/emotional-aftermath-check';
import { locationContinuityCheck, type LocationContinuityResult } from '../engine/location-continuity-check';
import { characterPresenceCheck, type CharacterPresenceResult } from '../engine/character-presence-check';

// 确定性伪随机：同一项目同一集钩子排布稳定（可复现/可测），跨集用不同种子自然轮换，避免 Math.random 抖动
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const VALID_HOOK_IDS = new Set(ALL_HOOKS.map((h) => h.id));
const VALID_MODES: CueMode[] = ['auto', 'manual', 'hybrid'];
const VALID_STRENGTH: Strength[] = ['relax', 'balanced', 'tight'];
/** 归一化用户钩子偏好：缺省补默认、非法枚举回退、未知钩子id剔除、manual 键转数字，保证下游永不收到脏数据 */
export function normalizeCuePref(p?: Partial<CuePref> | null): CuePref {
  if (!p) return { ...DEFAULT_PREF, preferred: [], avoid: [], manual: {} };
  const cleanIds = (arr?: string[]) => (Array.isArray(arr) ? arr.filter((x) => VALID_HOOK_IDS.has(x)) : []);
  const manualIn = (p.manual ?? {}) as Record<string, string>;
  const manual: Record<number, string> = {};
  Object.entries(manualIn).forEach(([k, v]) => {
    const idx = Number(k);
    if (Number.isInteger(idx) && VALID_HOOK_IDS.has(v)) manual[idx] = v;
  });
  return {
    mode: VALID_MODES.includes(p.mode as CueMode) ? (p.mode as CueMode) : DEFAULT_PREF.mode,
    strength: VALID_STRENGTH.includes(p.strength as Strength) ? (p.strength as Strength) : DEFAULT_PREF.strength,
    preferred: cleanIds(p.preferred),
    avoid: cleanIds(p.avoid),
    microFlavors: (Array.isArray(p.microFlavors) ? p.microFlavors.filter((x) => VALID_FLAVORS.has(x)) : []) as HookFlavor[],
    manual,
  };
}
/**
 * 把某一集的四层钩子计划翻译成给岗位模型的明确指令（不是僵硬模板，而是规定“用哪类钩+怎么用+示例”，
 * 具体台词/情节仍由模型创作）。导演思路落地：场钩/集钩/动作/氛围/语言等钩子分层、按强度留呼吸。
 */
export function buildEpisodeHookDirective(ep: EpisodePlan, lang: 'zh' | 'en' = 'zh', flavors?: HookFlavor[]): string {
  const en = lang === 'en';
  const lines: string[] = [];
  const fav = (flavors ?? []).filter(Boolean);
  if (fav.length) {
    const names = fav.map((f) => flavorName(f, lang)).join(en ? ', ' : '、');
    lines.push(en
      ? `Creator-preferred micro-hook flavor(s): ${names}. Lean on these for sentence-level hooks where natural, but never force one where it does not fit; the system still balances variety.`
      : `创作者偏好的微钩风味：${names}。句子级微钩在自然前提下优先使用这些风味，但不合适处绝不硬塞，系统仍保证多样性轮换。`);
  }
  const open = ALL_HOOKS.find((h) => h.id === ep.openHookId);
  const end = ALL_HOOKS.find((h) => h.id === ep.endHookId);
  if (open) {
    if (en) {
      const oe = describeHook(open.id, 'en')!;
      lines.push(`The golden first-3-seconds opening MUST use “${oe.name}”: ${oe.definition}; technique: ${oe.technique} (reference: ${oe.example}); enter with zero setup.`);
    } else {
      lines.push(`开场黄金3秒必须用「${open.name}」：${open.definition}；手法：${open.technique}（参考：${open.example}），0铺垫直接进`);
    }
  }
  ep.scenes.forEach((sc) => {
    const micros = sc.microHookIds.map((id) => {
      const h = describeHook(id, lang);
      return h ? (en ? `“${h.name}” (${h.technique})` : `「${h.name}」(${h.technique})`) : '';
    }).filter(Boolean);
    const sceneEnd = sc.endHookId ? describeHook(sc.endHookId, lang) : undefined;
    let s = en ? `Scene ${sc.scene}` : `第${sc.scene}场`;
    if (micros.length) s += en ? ` naturally place ${micros.length} sentence-level micro hook(s): ${micros.join('; ')}` : `场内自然落 ${micros.length} 个句子级微钩：${micros.join('、')}`;
    if (sceneEnd) s += en ? `; end the scene with “${sceneEnd.name}” to pull into the next: ${sceneEnd.technique}` : `；场末用「${sceneEnd.name}」牵引下一场：${sceneEnd.technique}`;
    if (micros.length || sceneEnd) lines.push(s);
  });
  if (end) {
    if (en) {
      const ee = describeHook(end.id, 'en')!;
      lines.push(`The episode-end MUST use the “${ee.name}” cliff to drive binge-watching: ${ee.definition}; technique: ${ee.technique} (reference: ${ee.example}); cut at the peak and do NOT resolve it within this episode.`);
    } else {
      lines.push(`本集集尾必须用「${end.name}」卡点促追更：${end.definition}；手法：${end.technique}（参考：${end.example}），在峰值处切断、不要在本集内解决`);
    }
  }
  lines.push(en
    ? 'Hooks must serve plot and character and grow naturally; never paste labels or hook for hook’s sake; never place the same hook type back-to-back — alternate tension and release.'
    : '钩子要服务剧情与人物、自然生长，禁止生硬贴标签或为钩而钩；同类钩子不紧邻连用，张弛有度留呼吸');
  return lines.join('\n');
}

/**
 * v2.331 成品形态方法论补位（纯函数·零 IO）。
 * v2.329 把互动剧/短视频/软广/电影/长系列从「模式」下沉为「剧本类型」后，新路径（8 模式 + 类型）
 * 不再经过 LEGACY_CRAFT_KEY：tag + 互动剧拿不到真选择/分支闭环，spark + 广告脚本拿不到 3 秒钩子/每镜口播/CTA。
 * 此处按类型补回该形态的方法论；与模式方法论叠加而非替换，且同 key 不重复注入。
 */
export function buildTypeCraftDirective(
  scriptType: string | undefined,
  craftModeKey: string,
  episodeIndex: number,
  episodeCount: number,
  lang: 'zh' | 'en',
): string {
  const key = scriptTypeCraftKeyOf(scriptType);
  if (!key || key === craftModeKey) return '';
  if (key === 'film') return buildFilmActDirective(key, episodeIndex, episodeCount, lang);
  if (key === 'long_ip') return buildLongIpDirective(key, lang);
  return buildModeCraftDirective(key, lang);
}

export interface Bible {
  worldview: string;
  characters: Record<string, { traits: string; arc: string; voice: string; visualAnchor?: string }>;
  timeline: string[];
  foreshadow: string[];
}
export interface PipelineEvent { role: Role | 'dispatcher' | 'done'; status: 'running' | 'done' | 'retry'; note: string; }

interface Outline { hookType: string; logline: string; beats: string[]; payoffs: string[]; cliffhanger: string; subplots?: string[] } // v2.80 subplots=本集活跃支线名（支线编织台账载体）
interface Cast { [name: string]: { want: string; voice: string; arc: string; hidden: string[] } }
interface AudienceReport { riskPoints: { at: string; reason: string }[]; cravingScore: number; wantNext: string }
interface ComplianceReport { pass: boolean; risks: string[] }
interface MarketReport { scores: Record<string, number>; overall: number; advice: string[] }

const ROLE_MAP: Record<string, RoleId> = {
  architect: 'architect', designer: 'character', writer: 'writer', audience: 'audience',
  polisher: 'polish', compliance: 'compliance', market: 'market',
};

// —— 沙盘产出（无密钥时按同一协议协作；干净无AI腔，保证去AI闸门通过）——
const SANDBOX_OUTLINE: Outline = {
  hookType: 'face_slap_pre', logline: '被当众羞辱的保洁工，实为占股51%的隐藏大股东',
  beats: ['开场羞辱钩子', '矛盾升级:被诬偷看合同', '反转:亮出控股权', '结尾钩子:董事长来电'],
  payoffs: ['当众反杀打脸'], cliffhanger: '董事长为何亲自来电？林晚的股权从何而来？', subplots: [],
};
const SANDBOX_CAST: Cast = {
  林晚: { want: '隐姓埋名查清公司内鬼', voice: '平静、短句、不怒自威', arc: '从隐忍保洁到亮明身份', hidden: ['原生家庭:白手起家', '习惯:动手不空谈', '禁忌:被人冤枉', '思维:后发制人', '欲望:掌控局面'] },
  陈总: { want: '掩盖自己掏空公司的事实', voice: '色厉内荏、爱摆架子', arc: '从嚣张到崩溃', hidden: ['欲望:自保', '思维:先声夺人'] },
};
// v1.98 英文沙盘兜底（与中文沙盘逐字段对齐，保证英文演示/测试端到端零中文且人物名与成稿一致）
const SANDBOX_OUTLINE_EN: Outline = {
  hookType: 'face_slap_pre', logline: 'A cleaner humiliated in public is secretly the majority shareholder who owns 51%.',
  beats: ['Opening humiliation hook', 'Escalation: accused of peeking at the contract', 'Reversal: she reveals controlling equity', 'End hook: the chairman calls'],
  payoffs: ['Public face-slap counter'], cliffhanger: 'Why does the chairman call personally? Where did Lin Wan’s equity come from?', subplots: [],
};
const SANDBOX_CAST_EN: Cast = {
  'Lin Wan': { want: 'Stay undercover to root out the company mole', voice: 'Calm, short sentences, quiet authority', arc: 'From a restrained cleaner to revealing who she is', hidden: ['Roots: self-made from nothing', 'Habit: acts rather than talks', 'Taboo: being framed', 'Mindset: strike second, win last', 'Desire: stay in control'] },
  'Mr. Chen': { want: 'Hide that he has been hollowing out the company', voice: 'Blustery, fond of throwing rank around', arc: 'From arrogance to collapse', hidden: ['Desire: self-preservation', 'Mindset: strike first to intimidate'] },
};
const SANDBOX_DRAFT = `第1集 保洁工是大股东

内景 陈氏集团一楼大厅·日
△ 早上八点半，旋转门一开一合，高跟鞋声满地乱响。林晚穿着洗得发白的保洁服，蹲在前台脚边擦咖啡渍，抹布拧了三遍，水还是黑的。
小刘（压低声音）：林姐，你快走吧，陈总今天心情不好，专挑人骂，刚才行政部俩姑娘都被骂哭了。
林晚（没抬头）：没事，这地脏了，总得有人擦。
△ 皮鞋声停在她面前。陈总把一份文件摔在前台上，纸页滑出去半截。
陈总：这份合同谁动过？保洁，是不是你偷看了？
林晚（站起身，平静）：我看不懂字面上的局，但我知道，摔文件的人，通常心里没底。
陈总（气笑）：你一个扫地的，还教训起我来了？
林晚：地我会扫干净，您的文件，我一页没碰。
小刘（着急）：林姐，合同是昨晚丢的，你昨晚一直在负一层做保洁，调个监控不就说清了吗？
林晚（把拖把换了只手）：监控不用我去调。做贼的人，尾巴迟早自己露出来。
△ 前台电话响了，小刘接起来嗯嗯两声，脸色越来越白，挂了电话只顾着摇头。
△ 她把抹布叠成方块搁回桶沿，手上的动作没乱一分。

内景 集团总部电梯厅·日
△ 陈总追到电梯口，一把拦住她，胸卡被他扯得翻了个面。
陈总：今天这事没完。你一个临时工，赔得起合同泄密的损失吗？
小刘（追过来，小声）：陈总，查过了，昨晚监控里进办公室的，是张副总。
△ 陈总脸上一僵，拦人的手悬在半空。林晚从兜里掏出一张黑卡，轻轻搁在前台台面上。
林晚：这张卡，能刷开你楼上那间办公室。因为这间公司，我占股五十一。
△ 陈总的脸一下白了，捏着卡的手抖个不停。小刘捂住嘴，拖把哐当倒在地上。
陈总（声音发颤）：你……你是？
陈总（嗓门矮了半截）：可就算是张副总进过我办公室，你一个保洁，凭什么刷得开总裁层的电梯？
△ 林晚没接话，当着他的面把黑卡往感应器上一贴，电梯叮的一声，直达顶楼的按键自己亮了。
林晚：就凭这个。还有，这几年公司少的那几笔账，我手里，也有一份。
林晚（重新拿起拖把）：先把地擦完。账，我们慢慢算。

外景 集团大楼门口·日
△ 黑色商务车无声滑到台阶下，穿黑西装的老管家下车，躬身拉开后门，手搭在门框上。
管家：大小姐，董事会的人都到齐了，就等您主持。
△ 林晚把拖把递给小刘，脱下保洁服叠好搭在臂弯，露出里面一身剪裁利落的黑西装。
林晚（微笑）：以后这地，不用我擦了；有些人掉地上的脸，得自己捡。
△ 陈总冲到玻璃门里，眼睁睁看着车门合上。他口袋里的手机突然响了，来电显示：董事长。（本集完）`;
// v1.98 英文沙盘兜底样例：无真实模型密钥时，英文链路也产出零中文的标准剧本（结构与中文样例对齐）
// v2.80 补齐为 800-1000 字当量级（约480-600词）完整三场，SCENE: 场标可被英文闸门识别
const SANDBOX_DRAFT_EN = `Episode 1 The Cleaner Who Owns the Company

SCENE: CHEN GROUP HEADQUARTERS LOBBY - DAY INT.
△ At eight thirty the revolving door keeps spinning and high heels click across the marble floor. Lin Wan, in a faded cleaner uniform, kneels beside the reception desk scrubbing a coffee stain; she wrings the rag three times and the water still comes up black.
Liu (lowering her voice): Lin, you should get going. Mr. Chen is out for blood today. Two girls from admin walked out of his office in tears.
Lin Wan (not looking up): It is fine. A dirty floor still needs someone to clean it.
△ Leather shoes stop right in front of her. Mr. Chen slams a folder on the reception desk and half the pages slide out across the glass.
Mr. Chen: Who touched this contract? Cleaner, were you snooping around my desk?
Lin Wan (standing up, calm): I cannot read the kind of game printed on paper. But a man who slams folders around is usually the one with nothing solid to stand on.
Mr. Chen (laughing angrily): A floor washer is lecturing me now?
Lin Wan: I will get this floor clean. Your papers, I never touched a single page.
△ She folds the rag into a neat square and sets it on the bucket rim. Her hands do not shake for even a second.

SCENE: HEADQUARTERS ELEVATOR LOBBY - DAY INT.
△ Mr. Chen chases after her and blocks the elevator bank, flipping her staff badge over with one finger.
Mr. Chen: This is not over. A temp like you, can you even pay for the damage of a leaked contract?
Liu (catching up, whispering): Mr. Chen, I checked the footage. Last night it was Vice President Zhang who walked into your office.
△ Mr. Chen freezes with his arm still raised. Lin Wan pulls a black card from her pocket and lays it gently on the reception desk.
Lin Wan: This card opens your office upstairs. Because I own fifty-one percent of this company.
△ The color drains from Mr. Chen's face and the card keeps trembling in his fingers. Liu covers her mouth, and the mop clatters onto the floor.
Mr. Chen (voice shaking): You... who are you?
Lin Wan (picking the mop back up): Let me finish the floor first. We will settle every account, slowly.

SCENE: OUTSIDE THE HEADQUARTERS BUILDING - DAY EXT.
△ A black sedan glides silently up to the front steps. An old butler in a dark suit steps out, bows slightly, and opens the rear door with one hand resting on the frame.
Butler: Miss Lin, the entire board is upstairs in the conference room. They are waiting for you to chair the meeting.
△ Lin Wan hands the mop to Liu, takes off the cleaner uniform and folds it over her arm, revealing a sharp black suit underneath.
Lin Wan (smiling): I will not need to clean this floor anymore. As for some people, they will have to pick their own faces up off the ground.
△ Mr. Chen rushes to the glass doors and watches the sedan pull away. His phone suddenly rings in his pocket. The caller ID says: Chairman. (End of episode)`;

function directive(role: Role, lang: 'zh' | 'en' = 'zh') {
  const base = ROLE_MAP[role] ? buildRoleDirective(ROLE_MAP[role], undefined, lang) : '';
  // v2.80 英文链路强制全英文输出：真实模型即使收到英文指令也可能默认写中文，必须在每个岗位开头显式锁语言
  const langLock = lang === 'en'
    ? 'LANGUAGE LOCK: You MUST produce ALL output (outline, character cards, dialogue, narration, parentheticals, scene headings, every field) in ENGLISH only. No Chinese characters anywhere. Even character names should be romanized or kept as-is but the surrounding text must be English.\n'
    : '';
  return `${langLock}${base}`;
}

/** v2.80 剥离模型在成稿末尾附加的自我报告式元注释（字数统计/合规自检/格式说明等），不污染正文 */
function stripModelMetaComments(text: string): string {
  const lines = text.split(/\r?\n/);
  // 从末尾往前删：匹配括号包裹的、含 "character count"/"word count"/"spoken"/"total" 等元报告关键词的行；
  // v2.91 补充：“（全文947字）”式纯字数自注（不含关键词）也按元注释剥离
  const WORD_COUNT_ONLY = /^[（(]\s*(?:全文|正文|全篇|约|共|合计|总计|字数[：:]?)?\s*\d+\s*字\s*[）)]$/;
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (!last) { lines.pop(); continue; }
    const isMeta = (/[（(]/.test(last) && /(character\s*count|word\s*count|spoken|total\s*(?:chars?|words)|plot\s*beats?|sequential\s*scenes?|no\s*(?:AI\s*)?clich|production\s*jargon|字数|台词|发声|场景|五维|无AI|提示词)/i.test(last))
      || WORD_COUNT_ONLY.test(last);
    if (isMeta) { lines.pop(); continue; }
    break;
  }
  return lines.join('\n').trim();
}

/** v2.80 归一化人物卡：解包 {"cast":{…}} / {"characters":[{name,…}]} / 顶层数组，统一成扁平 {名字: 人物卡} */
function normalizeCast(raw: unknown): Cast {
  const CHAR_FIELDS = ['want', 'voice', 'arc', 'hidden', 'desire', 'goal', 'motivation', 'objective', 'personality', 'tone', 'speakingStyle', 'dialogueStyle', 'bio', 'summary'];
  const looksLikeChar = (v: unknown) => !!v && typeof v === 'object'
    && Object.keys(v as object).some((k) => CHAR_FIELDS.includes(k) || k === 'name' || k === 'characterName');
  const nameOf = (rec: Record<string, unknown>) => String(rec.name ?? rec.characterName ?? rec.roleName ?? rec.role ?? '').trim();
  const flattenArray = (arr: unknown[]): Cast => {
    const flat: Cast = {};
    for (const item of arr) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        const name = nameOf(rec);
        if (name && (looksLikeChar(item) || Object.keys(rec).length >= 2)) {
          const rest: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(rec)) if (k !== 'name' && k !== 'characterName' && k !== 'roleName' && k !== 'role') rest[k] = v;
          flat[name] = rest as Cast[string];
        }
      }
    }
    return flat;
  };
  if (!raw || typeof raw !== 'object') return {};
  // 顶层就是数组 [{name,…}]
  if (Array.isArray(raw)) return flattenArray(raw);
  const obj = raw as Record<string, unknown>;
  // 已是扁平人物卡：值含人物字段
  const vals = Object.values(obj);
  if (vals.length && vals.every((v) => v && typeof v === 'object' && !Array.isArray(v) && looksLikeChar(v))) return obj as Cast;
  // 解包常见包装键（对象或数组）
  for (const wrapKey of ['cast', 'castList', 'castMembers', 'characters', 'roles', 'characterCards', 'protagonists', 'leads', 'dramatisPersonae']) {
    const inner = obj[wrapKey];
    if (inner && typeof inner === 'object') {
      if (Array.isArray(inner)) {
        const flat = flattenArray(inner);
        if (Object.keys(flat).length) return flat;
      } else if (Object.values(inner as object).some(looksLikeChar)) {
        return inner as Cast;
      }
    }
  }
  // 通用扫描：任一键的值是"含 name 的人物对象数组"即解包（应对 castList/characterRoster 等任意命名）
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      const flat = flattenArray(v);
      if (Object.keys(flat).length) return flat;
    }
  }
  // 兜底：对象本身（可能键就是名字、值是字符串简介）
  return obj as Cast;
}

/** 结构化岗位。
 *  v2.317 语义彻底分离：
 *  - 零端点沙盘（r.sandbox===true，开发/演示/自动化测试）：走静态 fallback 并标 sandbox，是唯一允许静态资产的分支；
 *  - 真实模型故障（HTTP 空响应 MODEL_EMPTY_CONTENT、网络耗尽等）：callText 直接抛错向上传播，整集失败退款，
 *       绝不静默套 fallback——否则真人稿会与静态沙盘人物（林晚/陈总）拼成真假混合稿；
 *  - 真模型返回非 JSON 文本：同岗立即重试 1 次（强化 JSON-only 约束），仍坏抛 MODEL_BAD_JSON 失败退款，不无底限烧钱。 */
async function jsonRole<T>(tier: EngineTier, role: Role, prompt: string, fallback: T, cost: { n: number; fellbacks?: string[] }, signal?: AbortSignal): Promise<{ data: T; sandbox: boolean }> {
  if (signal?.aborted) throw new Error('CANCELLED');
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryPrompt = attempt === 0
      ? prompt
      : `${prompt}\n只输出JSON本体：不要寒暄、不要解释、不要代码块围栏，首个字符必须是 { 或 [`;
    // v2.317 结构化岗 16384 预算：DeepSeek-V4-Pro/Qwen3.8-Max 等思考模型 completion_tokens 由 reasoning+content 共享，
    // 默认 4096 曾被思维链全部吃光（finish_reason=length、content 为空或 JSON 截断）。按真实 usage 计费，成本可控。
    const r = await callText(tier, role, retryPrompt, { signal, maxTokens: 16384 }); // 模型故障由此直接上抛
    cost.n += r.costFen;
    if (r.fellback) (cost.fellbacks ??= []).push(role);
    if (r.sandbox) return { data: fallback, sandbox: true }; // 零配置沙盘：唯一允许静态资产的分支
    const data = extractJson<T>(r.text);
    if (data !== null) return { data, sandbox: false };
    if (attempt === 0) continue; // 首次坏 JSON：同岗重试 1 次
    throw new Error(`MODEL_BAD_JSON:${role}:模型连续2次未返回合法JSON，末段输出=${String(r.text).slice(0, 120)}`);
  }
  throw new Error('MODEL_BAD_JSON:unreachable');
}
/** 文本岗位：真实模型返回正文；沙盘返回空（润色岗据此保留撰写稿）；模型故障由 callText 抛错上传播出失败退款 */
async function textRole(tier: EngineTier, role: Role, prompt: string, cost: { n: number; fellbacks?: string[] }, signal?: AbortSignal): Promise<{ text: string; sandbox: boolean }> {
  if (signal?.aborted) throw new Error('CANCELLED');
  const r = await callText(tier, role, prompt, { signal });
  cost.n += r.costFen;
  if (r.fellback) (cost.fellbacks ??= []).push(role);
  if (r.sandbox) return { text: '', sandbox: true };
  if (!r.text) throw new Error(`MODEL_EMPTY_CONTENT:${role}:文本岗位返回空正文`); // v2.317 防御：非沙盘空文本不得静默
  return { text: r.text, sandbox: false };
}

/** 一致性校验（规则版）：本集是否成稿、已立人物是否登场联动 */
function consistencyCheck(draft: string, cast: Cast, lang: 'zh' | 'en' = 'zh'): { pass: boolean; misses: string[] } {
  const misses: string[] = [];
  const named = Object.keys(cast);
  if (draft.length < 200) misses.push(lang === 'en' ? 'Episode too short, likely missing outline beats' : '成稿过短，疑似未覆盖大纲节拍');
  if (named.length && !named.some((n) => draft.includes(n))) misses.push(lang === 'en' ? 'None of the established characters appear in this episode' : '本集未出现任何已立人物，人物联动断裂');
  return { pass: misses.length === 0, misses };
}

export interface EpisodeOptions {
  style?: string; antiStrength?: AntiStrength; scriptFormat?: ScriptMode;
  lang?: 'zh' | 'en'; // v1.95 输出语言：钩子指令/钩子相关进度按语言下发，默认 zh 逐字不变
  hookPref?: Partial<CuePref> | null; // 用户钩子偏好（auto/manual/hybrid、强度、偏好/禁用/逐点指定），缺省系统智能
  hookStrategy?: string | null; // v2.27 用户选择的钩子策略 id（balanced/dense/suspense/emotion/premium）；hookPref 缺省时按策略兜底，仍缺省则系统按题材推荐
  paceStrategy?: string | null;    // v2.28 节奏曲线策略 id；缺省系统按题材推荐
  dialogueStrategy?: string | null; // v2.28 台词风格策略 id；缺省系统按题材推荐
  emotionStrategy?: string | null;  // v2.29 情绪/爽点曲线策略 id；缺省系统按题材推荐
  characterStrategy?: string | null; // v2.37 人物与关系策略 id；缺省系统按题材推荐
  customStyleText?: string | null;  // v2.32 用户自带参考剧本（只学风格不抄内容），BASIC+ 可用，缺省不注入
  aigcDurationMin?: number;  // v2.33 AIGC 本成片时长（分钟，0.5-5，缺省1），用于按分钟精算字数与台词/叙述配比
  episodeIndex?: number;  // 本集在全剧中的0基序号，用于跨集钩子轮换；缺省0
  episodeCount?: number;  // 全剧集数，缺省按单集规划
  scenesPerEp?: number;   // 每集场景数，缺省3（决定场钩/微钩密度）
  beatPref?: Partial<CuePref> | null; // 反转/爽点/情绪节拍偏好（auto/manual/hybrid、强度、偏好/禁用），缺省系统智能
  mode?: string;        // v2.14 归一后的创作模式 id（hit_lab/long_ip 等），用于模式级方法论注入
  modeTrack?: string;   // v2.14 名场面工作台内部轨道：signature_scene | hit_reverse（v2.329 起归 spark 轨道）
  scriptType?: ScriptTypeId; // v2.329 剧本类型（真人实拍/AIGC/电影/电视剧/短视频/广告/宣传片/互动剧/长系列）；v2.332 新增互动影游
  outputLang?: LanguageCode; // v2.329 输出语言（10 种），缺省中文
  depthTier?: 'speed' | 'balanced' | 'depth'; // v2.326 思考深度档位：speed=极速（极简 Method Trace + 跳过 Purpose Gate/Range Lens）/ balanced=标准（Method Trace 全量，跳过另外两者）/ depth=深度（三者全开）；缺省 balanced
  knowledgeHints?: KnowledgeHint[] | null; // v2.84 自主学习引擎沉淀的已生效知识（高分剧本技法/市场趋势/政策规则），按 brief 相关性注入各岗位
  creationContextInput?: CreationContextInput; // v2.85 创作上下文（时令/爆款/画像/地域文化/历史脑洞/AIGC制作规范）
  brandBrief?: BrandBriefInput | null; // v2.93 剧情软广结构化品牌简报（品牌事实源，注入架构师/撰写师/观众岗位）
  trendBrief?: TrendBriefInput | null; // v2.94 热点追更结构化热点简报（热点事实源，注入架构师/撰写师/打回重写）
  trendRisk?: TrendRiskReport | null;  // v2.94 热点风险预检报告（高危信号转强制虚构化指令）
  branchBrief?: BranchBriefInput | null; // v2.95 互动分支结构化分支简报（分支事实源，注入架构师/撰写师/打回重写）
  sourceText?: string | null; // v2.96 原作/小说/名场面原文（adapt/novel/hit_lab 模式启用 n-gram 重合度侵权检测）
  title?: string | null; // v2.99 项目标题，用于传播端前13字公式校验（身份+冲突+反差）
  prevEpisode?: { epNo: number; title: string; summary: string; ending?: string } | null; // v2.106 前集摘要（角色状态/伏笔/集尾钩子）+ v2.80 结尾原句（跨集焊点），注入架构师/撰写师保证跨集连续性
  prevForeshadow?: { plants: ForeshadowLedgerResult['plants']; payoffs: ForeshadowLedgerResult['payoffs']; epNo: number } | null; // v2.108 前集伏笔账本
  prevArc?: { characters: CharacterArc[]; epNo: number } | null; // v2.108 前集角色弧光状态
  prevSecrets?: SecretLedgerResult['nextState'] | null; // v2.80 前集信息差台账状态（秘密账本：植入池/已揭示主题/集号）
  prevStates?: CharacterStateLedgerResult['nextState'] | null; // v2.80 前集人物状态台账状态（onset 池/已桥接/集号）
  prevDevices?: DeviceEpInput[] | null; // v2.80 前集逐集装置布点（反转/爽点/情绪头），喂疲劳引擎后仅注入架构师做防疲劳轮换
  prevPresence?: PresenceBit[] | null; // v2.80 配角跨集在场位（圣经角色名×前集正文 includes），喂在场台账后仅注入架构师做防遗忘调度
  prevPairs?: PairBit[] | null; // v2.80 跨集同场位（角色两两共同出场集号），喂关系线保鲜台账后仅注入架构师做同场调度
  prevSubplots?: SubplotBit[] | null; // v2.80 前集支线声明位（支线名×声明集号，来自 qcReport.outline.subplots），喂支线编织台账后仅注入架构师做接续调度
  prevWaves?: WaveEpInput[] | null; // v2.80 前集逐集憋爽摘要（受压/释放/强释放/首爽位置，来自 qcReport.payoffRhythm），喂爽感波浪台账后仅注入架构师做布点约束
  prevHook?: HookBit | null; // v2.80 前集集尾钩子位（类型/效力/结尾片段，来自 qcReport.cliffhanger），喂跨集兑现账本：注入架构师接钩约束 + 终稿兑现检测落库
  prevHumDebt?: DebtEpInput[] | null; // v2.80 前集羞辱雷摘要（新埋/兑付/强释放/雷词，来自 qcReport.humiliation），喂欠账引擎后仅注入架构师做还账调度
  prevMystery?: MysteryRow[] | null; // v2.80 前集悬念线摘要（活跃线/正文推进/集尾重吊，来自 qcReport.mystery），喂干旱账本后仅注入架构师给部分答案调度
  prevHookTypes?: HookTypeRow[] | null; // v2.80 前集钩型摘要（开场规划ID/集尾实测型，来自 qcReport.openHook+cliffhanger），喂疲劳账本后仅注入架构师换型调度
  prevProps?: PropRow[] | null; // v2.80 前集信物提及摘要（name/closed，来自 qcReport.props），喂信物连续性账本后仅注入架构师封禁/回收调度
  prevPromises?: PromiseRow[] | null; // v2.80 前集承诺摘要（誓言句/正文兑现，来自 qcReport.promise），喂欠账账本后仅注入架构师兑现调度
  prevVillainThreats?: VillainRow[] | null; // v2.80 前集反派威胁摘要（动作词/档位，来自 qcReport.villain），喂威胁账本后仅注入架构师升压调度
  prevTimelineMarks?: TimelineRow[] | null; // v2.80 前集时间锚摘要（mark/spanDays，来自 qcReport.timeline），喂时序账本后仅注入架构师校准/补锚调度
  prevCostRows?: CostRow[] | null; // v2.80 前集代价摘要（won/paid，来自 qcReport.cost），喂代价账本后仅注入架构师先付代价调度
  prevDeathRows?: DeathRow[] | null; // v2.80 前集死亡摘要（name/dead/revived/active，来自 qcReport.death），喂死亡账本后仅注入架构师复活预警调度
  prevFateRows?: FateRow[] | null; // v2.80 前集反派下场摘要（name/removed/exempted/active，来自 qcReport.villainFate），喂下场账本后仅注入架构师下场维持调度
  prevWoundRows?: WoundRow[] | null; // v2.80 前集创伤摘要（name/wounded/healed/strained，来自 qcReport.wound），喂创伤账本后仅注入架构师伤势维持调度
  prevPowerRows?: PowerRow[] | null; // v2.80 前集境界摘要（name/realm/broke/down/exempted，来自 qcReport.power），喂境界账本后仅注入架构师境界连续性调度
  prevItemRows?: ItemRow[] | null; // v2.80 前集信物归属摘要（name/item/handed/regain/touched，来自 qcReport.item），喂归属账本后仅注入架构师归属连续性调度
  prevRelRows?: RelRow[] | null; // v2.80 前集关系摘要（name/other/rift/reconciled/close，来自 qcReport.relation），喂关系账本后仅注入架构师关系维持调度
  prevAffRows?: AffRow[] | null; // v2.80 前集阵营归属摘要（name/org/left/rejoined/loyal，来自 qcReport.affiliation），喂归属账本后仅注入架构师阵营连续性调度
  prevLocRows?: LocRow[] | null; // v2.80 前集地点摘要（name/place/left/arrived/stranded/rescued，来自 qcReport.location），喂地点账本后仅注入架构师地点连续性调度
  prevLeakRows?: LeakRow[] | null; // v2.80 前集秘密泄露摘要（a/b/told/knows/witness，来自 qcReport.secretLeak），喂泄露账本后仅注入架构师知情范围约束
  prevDisguiseRows?: DisguiseRow[] | null; // v2.80 前集伪装身份摘要（name/alias/disguised/revealed，来自 qcReport.disguise），喂伪装账本后仅注入架构师身份连续性约束
  prevDebtRows?: DebtRow[] | null; // v2.80 前集人情债摘要（debtor/creditor/owed/repaid/betrayed，来自 qcReport.debt），喂债务账本后仅注入架构师人情债约束
  prevAllianceRows?: AllianceRow[] | null; // v2.80 前集联盟摘要（a/b/allied/dissolved/hostile，来自 qcReport.alliance），喂联盟账本后仅注入架构师联盟连续性约束
  prevMemoryRows?: MemoryRow[] | null; // v2.80 前集记忆摘要（name/lost/restored/recalled，来自 qcReport.memory），喂记忆账本后仅注入架构师失忆连续性约束
  prevImpersonationRows?: ImpersonationRow[] | null; // v2.80 前集冒充摘要（imposter/victim/impersonated/exposed/recognized，来自 qcReport.impersonation），喂冒充账本后仅注入架构师身份重叠约束
  prevBetrayalRows?: BetrayalRow[] | null; // v2.80 前集背叛摘要（betrayer/victim/betrayed/reconciled/cooperated，来自 qcReport.betrayal），喂背叛账本后仅注入架构师信任连续性约束
  prevSacrificeRows?: SacrificeRow[] | null; // v2.80 前集牺牲摘要（giver/receiver/sacrificed/thanked/mistreated，来自 qcReport.sacrifice），喂牺牲账本后仅注入架构师忘恩连续性约束
  prevCurseRows?: CurseRow[] | null; // v2.80 前集诅咒摘要（name/cursed/lifted/unaffected，来自 qcReport.curse），喂诅咒账本后仅注入架构师诅咒连续性约束
  prevPossessionRows?: PossessionRow[] | null; // v2.80 前集附身摘要（name/possessed/freed/self_willed，来自 qcReport.possession），喂附身账本后仅注入架构师附身连续性约束
  prevTimeTravelRows?: TimeTravelRow[] | null; // v2.80 前集穿越摘要（name/traveled/returned/native，来自 qcReport.timeTravel），喂穿越账本后仅注入架构师穿越连续性约束
  prevTransformationRows?: TransformationRow[] | null; // v2.80 前集变身摘要（name/transformed/reverted/original，来自 qcReport.transformation），喂变身账本后仅注入架构师变身连续性约束
  prevPoisonRows?: PoisonRow[] | null; // v2.80 前集中毒摘要（name/poisoned/cured/healthy，来自 qcReport.poison），喂中毒账本后仅注入架构师中毒连续性调度
  castAssets?: CastAssetSeed[] | null; // v2.151 角色资产：立项引用的跨剧可复用人设（人设内核/声音特征/声纹指纹），三岗位强约束注入
  propAssets?: PropAssetSeed[] | null; // v2.159 道具资产：立项引用的跨剧关键信物（剧情含义/连续性禁忌），架构师/撰写师强约束注入
  sceneAssets?: SceneAssetSeed[] | null; // v2.161 场景资产：立项引用的跨剧关键场景（剧情功能/氛围基调/状态禁忌），架构师/撰写师强约束注入
  signal?: AbortSignal; // v2.190 用户显式取消信号：abort 后下一岗位调用前抛 CANCELLED，停止后续 LLM 扣费（断网不触发，仅显式取消）
}
export interface EpisodeHooks { plan: EpisodePlan; issues: ReturnType<typeof auditHooks>; strength: Strength; mode: CueMode }
export interface EpisodeBeats { plan: EpisodeBeat; issues: ReturnType<typeof auditBeats>; strength: Strength; mode: CuePref['mode'] }
export async function runEpisode(
  tier: EngineTier, bible: Bible, brief: string,
  emit: (e: PipelineEvent) => void,
  options: EpisodeOptions = {},
): Promise<{ draft: string; totalCostFen: number; fellbacks: string[]; antiAi: ReturnType<typeof antiAiScan>; cliche: ReturnType<typeof clicheScan>; tongue: ReturnType<typeof dialogueScan>; grounded: ReturnType<typeof groundedScan>; format: ReturnType<typeof validateScript>; aigcManifest: ReturnType<typeof buildShotManifest> | null; aigcVolumePlan: ReturnType<typeof planAigcVolume> | null; aigcCurve: ReturnType<typeof analyzeAigcSceneCurve> | null; lengthPlan: ReturnType<typeof adaptScriptLength>; styleCheck: ReturnType<typeof styleConsistencyScan> | null; modeGate: ReturnType<typeof screenModeGate>; craftLint: CraftLintResult; craftDepth: { avg: number; p1: { dim: string; advice: string; level: string; rule: string }[]; p2: { dim: string; advice: string; level: string; rule: string }[]; emotion: { avg: number; p1Count: number }; webnovel: { avg: number; p1Count: number }; archetype: { avg: number; p1Count: number }; narrative: { avg: number; p2Count: number } }; hitTeardown: TeardownReport | null; track: string; titlePitch: { first13: string; hasIdentity: boolean; hasConflict: boolean; hasContrast: boolean; score: number; advice: string[] } | null; epThreeQ: { want: boolean; block: boolean; whyNext: boolean }; openingCheck: { trouble: boolean; oppressor: boolean; counterPlan: boolean; mustWatch: boolean; missing: string[]; score: number }; scorecard: { dimensions: { key: string; label: string; score: number; level: string; advice: string }[]; total: number; level: string; weakest: { key: string; label: string; score: number }; priorityActions: { key: string; label: string; score: number; advice: string }[] }; fixLoop: { before: { dims: { character: number; plot: number; dialogue: number; market: number; format: number; deai: number }; total: number }; after: { dims: { character: number; plot: number; dialogue: number; market: number; format: number; deai: number }; total: number }; aiTaste: { before: number; after: number } }; genres: string[]; investor: { overall: number; verdict: string; verdictLabel: string; vetoes: string[]; pitchTips: string[] }; aigcBeatPlan: AigcBeatPlan | null; foreshadow: ForeshadowLedgerResult; arcTrack: ArcTrackerResult; secretLedger: SecretLedgerResult; stateLedger: CharacterStateLedgerResult; recap: RecapResult; character: ReturnType<typeof characterLogicScan>; rhythm: ReturnType<typeof rhythmScan>; voicePrint: VoicePrintResult; dialogueAiTaste: DialogueAiTasteResult; sceneEmotionFlat: SceneEmotionFlatResult; sensoryDetail: SensoryResult; vagueWord: VagueWordResult; dialogueNameCall: DialogueNameCallResult; dialoguePingpong: DialoguePingpongResult; hollowAction: HollowActionResult; emotionWhiplash: EmotionWhiplashResult; echoDialogue: EchoDialogueResult; expositionDialogue: ExpositionDialogueResult; sceneSoftEnding: SceneSoftEndingResult; emotionLabelDialogue: EmotionLabelDialogueResult; roundRobinDialogue: RoundRobinResult; rhetoricalBarrage: BarrageResult; mirrorVisualDialogue: MirrorVisualResult; mindReadingNarration: MindReadingResult; crowdReaction: CrowdReactionResult; patheticFallacy: PatheticFallacyResult; omniscientTease: OmniscientTeaseResult; effortGloss: EffortGlossResult; reactionCliche: ReactionClicheResult; infoDelivery: InfoDeliveryResult; atmosphereTell: AtmosphereTellResult; confrontationDodge: ConfrontationDodgeResult; selfIntroDump: SelfIntroDumpResult; moralNarration: MoralNarrationResult; emptyThreat: EmptyThreatResult; timeJumpPayoff: TimeJumpPayoffResult; emotionPropCrutch: EmotionPropCrutchResult; emotionVentCliche: EmotionVentResult; actionEcho: ActionEchoResult; eavesdropDump: EavesdropDumpResult; selfPity: SelfPityResult; villainConfession: VillainOverconfessionResult; cheapForgiveness: CheapForgivenessResult; witnessGratuity: WitnessGratuityResult; previewVoiceover: PreviewVoiceoverResult; stanceFlip: StanceFlipResult; unplantedAsset: UnplantedAssetResult; subtextErase: SubtextEraseResult; exitCliche: ExitClicheResult; phoneRelay: PhoneRelayResult; fakeChoice: FakeChoiceResult; parenOverdirect: ParenOverdirectResult; abstractAccusation: AbstractAccusationResult; cheapEmpathy: CheapEmpathyResult; fidgetProp: FidgetPropResult; emptyVow: EmptyVowResult; flashbackCrutch: FlashbackCrutchResult; accidentalSpark: AccidentalSparkResult; commFailCrutch: CommFailCrutchResult; drunkTruth: DrunkTruthResult; tearBait: TearBaitResult; instantDeduction: InstantDeductionResult; recordsOnDemand: RecordsOnDemandResult; walkInTiming: WalkInTimingResult; helpOnDemand: HelpOnDemandResult; delayedReveal: DelayedRevealResult; instantTrust: InstantTrustResult; instantKinship: InstantKinshipResult; faintOnCue: FaintOnCueResult; alwaysLate: AlwaysLateResult; instantLove: InstantLoveResult; convenientEncounter: ConvenientEncounterResult; instantHack: InstantHackResult; instantMarksman: InstantMarksmanResult; instantLanguage: InstantLanguageResult; wakeUpCall: WakeUpCallResult; wakeOnCue: WakeOnCueResult; woundOnCue: WoundOnCueResult; instantEscape: InstantEscapeResult; weaponJam: WeaponJamResult; evidenceBlank: EvidenceBlankResult; propMotifRhythm: PropMotifResult; childBlurt: ChildBlurtResult; deadlineStretch: DeadlineStretchResult; softInterrogation: SoftInterrogationResult; deathbedConfession: DeathbedConfessionResult; truthSerum: TruthSerumResult; pregnancyOnCue: PregnancyOnCueResult;
  amnesiaOnCue: AmnesiaOnCueResult;
  terminalDiagnosisOnCue: TerminalDiagnosisOnCueResult;
  allergyOnCue: AllergyOnCueResult;
  blindnessOnCue: BlindnessOnCueResult;
  poisonOnCue: PoisonOnCueResult;
  muteOnCue: MuteOnCueResult;
  deafOnCue: DeafOnCueResult;
  paralysisOnCue: ParalysisOnCueResult;
  fatigueOverdrive: FatigueOverdriveResult; apologyLoop: ApologyLoopResult; forcedProximity: ForcedProximityResult; rescueRomance: RescueRomanceResult; fightReconcile: FightReconcileResult; instantRepentance: InstantRepentanceResult; talkDown: TalkDownResult; instantSurgery: InstantSurgeryResult; crowdFlip: CrowdFlipResult; rumorSpeed: RumorSpeedResult; resultsOnCue: ResultsOnCueResult; trafficOnCue: TrafficOnCueResult; vehicleJam: VehicleJamResult; sleepTalk: SleepTalkResult; feverTruth: FeverTruthResult; instantEndowment: InstantEndowmentResult; lastSecondRescue: LastSecondRescueResult; villainStall: VillainStallResult; teamBriefing: TeamBriefingResult; showDontTell: ShowDontTellResult; cliffhanger: CliffhangerScoreResult; coolMoment: CoolMomentScoreResult; dialogueWater: DialogueWaterResult; conflictDensity: ConflictDensityResult; punchlineDensity: PunchlineDensityResult; sceneDensity: SceneDensityResult; repetition: RepetitionResult; characterBalance: CharacterBalanceResult; twistDensity: TwistDensityResult; dialogueLength: DialogueLengthResult; informationDensity: InformationDensityResult; suspenseTension: SuspenseTensionResult; sceneHeader: SceneHeaderResult; dialogueFunction: DialogueFunctionResult; causalLogic: CausalLogicResult; protagonistGoal: ProtagonistGoalResult; antagonistQuality: AntagonistQualityResult; payoffRhythm: PayoffRhythmResult; relationship: RelationshipResult; scenePadding: ScenePaddingResult; supporting: SupportingCharacterResult; conflictEscalation: ConflictEscalationResult; subtext: SubtextResult; supportingArc: SupportingArcResult; scenePurpose: ScenePurposeResult; timeline: TimelineConsistencyResult; continuity: ContinuitySupervisionResult; misunderstanding: MisunderstandingDragResult; plotArmor: PlotArmorResult; evidenceChain: EvidenceChainResult; cheatRule: CheatRuleResult;
  memoryFakeout: MemoryFakeoutResult; emotionalAftermath: EmotionalAftermathResult; locationContinuity: LocationContinuityResult; characterPresence: CharacterPresenceResult; openingWeld: OpeningContinuityResult; hookPayoff: HookPayoffResult; humiliationDebt: HumiliationDebtResult; mysteryDrought: MysteryDroughtResult; hookFatigue: HookFatigueResult; propLedger: PropLedgerResult; promiseDrought: PromiseDroughtResult; villainThreat: VillainThreatResult; timelineLedger: TimelineLedgerResult; costLedger: CostLedgerResult; deathLedger: DeathLedgerResult; villainFate: VillainFateLedgerResult; woundRecovery: WoundRecoveryLedgerResult; powerProgress: PowerProgressLedgerResult; itemOwnership: ItemOwnershipLedgerResult; relLedger: RelLedgerResult; affLedger: AffiliationLedgerResult; locLedger: LocationLedgerResult; leakLedger: SecretLeakLedgerResult; disguiseLedger: DisguiseLedgerResult; debtLedger: DebtLedgerResult; allianceLedger: AllianceLedgerResult; memoryLedger: MemoryLedgerResult; impersonationLedger: ImpersonationLedgerResult; betrayalLedger: BetrayalLedgerResult; sacrificeLedger: SacrificeLedgerResult; curseLedger: CurseLedgerResult; possessionLedger: PossessionLedgerResult; timeTravelLedger: TimeTravelLedgerResult; transformationLedger: TransformationLedgerResult; poisonLedger: PoisonLedgerResult; hooks: EpisodeHooks; beats: EpisodeBeats; outline: Outline; cast: Cast; audience: AudienceReport; market: MarketReport; sandbox: boolean; bible: Bible; _profile: { antiStrength: AntiStrength; colloquialLevel: ColloquialLevel } }> {
  // v2.151 修复：cue-only bible（立项带 hookPrefs/castAssets 等偏好键时 bible 真值但缺 characters/timeline/foreshadow，
  // 上游 `??` 兜底不触发）在此归一化，防止首集生成在人物卡回写/时间线追加/伏笔追加处 TypeError。项目 bible 缺键补空结构是无害新增。
  if (!bible.characters || typeof bible.characters !== 'object') (bible as { characters?: Record<string, unknown> }).characters = {};
  if (!Array.isArray((bible as unknown as { timeline?: unknown[] }).timeline)) (bible as unknown as { timeline: unknown[] }).timeline = [];
  if (!Array.isArray((bible as unknown as { foreshadow?: unknown[] }).foreshadow)) (bible as unknown as { foreshadow: unknown[] }).foreshadow = [];
  // v2.190 用户取消信号绑定到所有 LLM 岗位调用（abort 后下一岗位前抛 CANCELLED，停止扣费）
  const _abortSig = options.signal;
  const _jsonRole = <T>(t: EngineTier, r: Role, p: string, f: T, c: { n: number }) => jsonRole<T>(t, r, p, f, c, _abortSig);
  const _textRole = (t: EngineTier, r: Role, p: string, c: { n: number }) => textRole(t, r, p, c, _abortSig);
  const strength: AntiStrength = options.antiStrength ?? 'balanced';
  const hookLang: 'zh' | 'en' = options.lang === 'en' ? 'en' : 'zh';
  // v2.327 别名归一：runEpisode 可能收到历史 raw 模式（novel/branded_skit/xscript），
  // 下游只认 canonical，避免旧项目因 12→9 合并拿不到方法论/评分口径（mode-craft 内部仍用 raw 判成年护栏，故不替换其入参）
  const canonMode = canonicalModeId(options.mode) ?? options.mode;
  // —— 四层钩子工程：先于架构师规划全剧钩子排布（开场/集尾必有，场钩/微钩按强度），用户偏好优先、其余系统补 ——
  // v2.27 钩子策略：用户显式 hookPref 最高优先；否则用用户选定策略；都没有则系统按题材智能推荐默认（确定性、可解释）
  let chosenStrategy: string;
  if (options.hookPref) {
    chosenStrategy = 'balanced'; // 用户已逐类指定，策略不再覆盖
  } else if (options.hookStrategy && isValidHookStrategy(options.hookStrategy)) {
    chosenStrategy = options.hookStrategy;
  } else {
    chosenStrategy = recommendStrategy({ text: `${brief} ${options.style ?? ''}`, mode: canonMode }).id;
  }
  const cuePref = options.hookPref
    ? normalizeCuePref(options.hookPref)
    : strategyToCuePref(chosenStrategy, 'auto');
  const episodeCount = Math.max(1, options.episodeCount ?? 1);
  // v2.28/v2.29 四套创作策略统一在此解析（用户显式 > 题材确定性推荐 > 默认），供后续场景规划/钩子/节拍/撰写共用
  const strategyCtx = { text: `${brief} ${options.style ?? ''}`, mode: canonMode };
  const resolvedPaceId = resolvePaceId(options.paceStrategy, strategyCtx);
  const resolvedDialogueId = resolveDialogueId(options.dialogueStrategy, strategyCtx);
  const resolvedEmotionId = resolveEmotionId(options.emotionStrategy, strategyCtx);
  const resolvedCharacterId = resolveCharacterId(options.characterStrategy, strategyCtx);
  // v2.29 节奏策略数值级硬绑定：用户未显式指定每集场景数时，由节奏策略区间确定性取中位（不再恒定 3）
  const paceRange = getPaceStrategyRange(resolvedPaceId);
  const paceDefaultScenes = Math.round((paceRange[0] + paceRange[1]) / 2);
  const scenesPerEp = Math.min(8, Math.max(1, options.scenesPerEp ?? paceDefaultScenes));
  const episodeIndex = Math.min(episodeCount - 1, Math.max(0, options.episodeIndex ?? 0));
  const hookPlanAll: HookPlan = planHooks(episodeCount, scenesPerEp, cuePref, mulberry32(0x9e3779b1 ^ (episodeIndex * 2654435761)));
  const epHook = hookPlanAll.episodes[episodeIndex];
  const hookDirective = buildEpisodeHookDirective(epHook, hookLang, cuePref.microFlavors);
  const hookIssues = auditHooks(hookPlanAll, true, hookLang);
  // —— 节拍工程（钩子的举一反三）：反转/爽点/情绪曲线同样按用户偏好+系统默认事前排布 ——
  // v2.27：钩子策略给出风味兜底；v2.29：情绪/爽点策略在非均衡时覆盖风味（用户显式 beatPref 仍最高优先）
  const strategyHints = options.hookPref ? {} : strategyBeatHints(chosenStrategy);
  const emotionHints = emotionBeatHints(resolvedEmotionId);
  const mergedHints: Record<string, string[]> = { ...strategyHints };
  if (resolvedEmotionId !== 'balanced') {
    if (emotionHints.payoffFlavors.length) mergedHints.payoffFlavors = emotionHints.payoffFlavors;
    if (emotionHints.reversalFlavors.length) mergedHints.reversalFlavors = emotionHints.reversalFlavors;
    if (emotionHints.emotionFlavors.length) mergedHints.emotionFlavors = emotionHints.emotionFlavors;
  }
  const beatPref = normalizeBeatPref(options.beatPref ?? mergedHints);
  // 四套策略的事前执行指令（节奏给架构师，台词/情绪给撰写师）
  const paceDir = paceDirective(resolvedPaceId, hookLang);
  const dialogueDir = dialogueDirective(resolvedDialogueId, hookLang);
  const emotionDir = emotionDirective(resolvedEmotionId, hookLang);
  const characterDir = characterDirective(resolvedCharacterId, hookLang);
  const beatPlanAll: BeatPlan = planBeats(episodeCount, beatPref, mulberry32(0x5bd1e995 ^ (episodeIndex * 40503)));
  // v1.97 规划层对齐：集尾是反转卡点的集，节拍表必须有反转（两份独立规划约半数会脱配），确定性补齐、不重型
  alignBeatsToHooks(hookPlanAll, beatPlanAll, mulberry32(0x1b873593 ^ (episodeIndex * 2246822519)));
  const epBeat = beatPlanAll.episodes[episodeIndex];
  const beatDirective = buildBeatDirective(epBeat, hookLang, {
    payoffFlavors: beatPref.payoffFlavors,
    reversalFlavors: beatPref.reversalFlavors,
    emotionFlavors: beatPref.emotionFlavors,
  });
  const beatIssues = auditBeats(beatPlanAll, hookLang);
  // v2.18 全部类型机制引擎统一走注册表（新增引擎只在 craft-registry 登记一次，管线自动获得、绝不遗漏）
  const craftStack = buildCraftStackDirective(`${brief} ${options.style ?? ''}`, hookLang);
  const craftDirective = craftStack.directive ? craftStack.directive + '\n' : '';
  // v2.14 模式级方法论：名场面工作台两轨道 + 长系列IP（仅对应模式注入，其余空串）
  // v2.329：内部一律以 craftKeyOf(旧 raw → 旧方法论 key) 归一，8 模式合并后旧项目一字不改
  const craftModeKey = craftKeyOf(options.mode ?? canonMode, options.modeTrack);
  const hitLabDirective = buildHitLabDirective(options.mode ?? canonMode, options.modeTrack, hookLang);
  const longIpDirective = buildLongIpDirective(craftModeKey, hookLang);
  // v2.83 其余模式方法论（采访/日记/灵感/标签/热点/角色自述/双人对撞/世界线推演），与上面两个专属指令互斥
  // v2.87 电影模式三幕片段定位：按 episodeIndex/episodeCount 推导幕次与幕内段落，兑现 film 指令的标注承诺
  const filmActDirective = buildFilmActDirective(craftModeKey, episodeIndex, episodeCount, hookLang);
  // v2.331 成品形态补位：类型为互动剧/短视频/软广/电影/长系列时，补回该形态专属方法论（与模式方法论叠加）
  const typeCraftDirective = buildTypeCraftDirective(options.scriptType, craftModeKey, episodeIndex, episodeCount, hookLang);
  const modeCraftDirective = (((!hitLabDirective && !longIpDirective) ? buildModeCraftDirective(options.mode ?? canonMode, hookLang, options.modeTrack) : '') + filmActDirective + typeCraftDirective).trim();
  // v2.326 Method Trace：成稿末尾显式输出"本集创作方法论"清单（对应视频"深度维度"——AI 不只给结果，还要把用了什么方法显式化）
  const depthTier = options.depthTier ?? 'balanced';
  const methodTraceDirective = buildMethodTraceDirective(options.mode ?? canonMode, hookLang, depthTier, options.modeTrack);
  // v2.326 Purpose Gate：架构师动笔前先写"一句话核心目的"（对应视频"高度维度"——先追问"为什么做"再问"怎么做"）
  const purposeGateDirective = buildPurposeGateDirective(options.mode ?? canonMode, hookLang, depthTier, options.modeTrack);
  // v2.326 Range Lens：audience 角色追加跨界视角改进建议（对应视频"范围维度"——同一个成稿借多双眼睛看）
  const rangeLensDirective = buildRangeLensDirective(options.mode ?? canonMode, hookLang, depthTier, options.modeTrack);
  // v2.93 剧情软广·结构化品牌简报：品牌事实源（逐字品牌名/单一卖点/记忆符号/软性度/合规红线），三岗位共用
  const brandDirective = options.brandBrief ? buildBrandDirective(options.brandBrief, hookLang) : '';
  // v2.94 热点追更·结构化热点简报：四借法指令+强制虚构化要求（风险预检驱动），架构师/撰写师/打回重写共用
  const trendDirective = options.trendBrief ? buildTrendDirective(options.trendBrief, options.trendRisk ?? null, hookLang) : '';
  // v2.95 互动分支·结构化分支简报：分支规格+闭环铁律，架构师/撰写师/打回重写共用
  const branchDirective = options.branchBrief ? buildBranchDirective(options.branchBrief, hookLang) : '';
  // v2.96 原作/原文：adapt/hit_lab 模式把原文作为事实源注入（novel 已于 v2.325 别名至 adapt，此处已不存在 raw 'novel'），
  // 明确要求改编/压缩/逆向而非照抄（mode-gate 的 n-gram 重合检测会复核）
  const sourceTextDirective = options.sourceText && isSourceTextMode(options.mode ?? canonMode, options.modeTrack)
    ? (hookLang === 'en'
        ? `SOURCE TEXT (for reference only, DO NOT copy wording — the n-gram overlap gate will flag copied passages):\n${options.sourceText}\nAdapt/compress/reverse-engineer the underlying method only; rewrite every sentence in your own expression.\n`
        : `【原作/原文（仅供参考，严禁照抄措辞——n-gram 重合闸门会标记抄袭片段）】\n${options.sourceText}\n只借底层方法（人设关系/节奏/兑付逻辑），每一句都须用自己的表达重写。\n`)
    : '';
  // v2.97 名场面工作台·爆款逆向轨道：有源文本时用 hit-teardown 引擎做结构化拆解，
  // 把"为什么爆/可取技法/钩子类型/人设反差/爽点密度/张力曲线"作为可执行方法论喂给架构师与撰写师，
  // 而非只让模型凭感觉"抽骨架"。仅 hit_lab + hit_reverse + sourceText 同时满足时生效。
  let hitTeardown: TeardownReport | null = null;
  let hitTeardownDirective = '';
  if (craftModeKey === 'hit_lab' && canonicalSparkTrack(options.modeTrack) === 'hit_reverse' && options.sourceText) {
    hitTeardown = teardown(options.sourceText, { type: 'text' }, hookLang);
    const t = hitTeardown;
    const techLines = t.techniques.map((tc) => `· ${tc.point}（为什么有效：${tc.why}；怎么复用：${tc.reuse}`).join('\n');
    hitTeardownDirective = hookLang === 'en'
      ? `[HIT REVERSE-ENGINEERING · structured teardown of the source]
Why it works:
${t.boomReasons.map((b) => `· ${b.dim}: ${b.conclusion}`).join('\n')}
Reusable techniques (borrow the method, never the wording):
${techLines}
Hook type to reuse at the same structural position: ${t.hookType}
Persona-contrast model: ${t.personaContrast}
Payoff density: ${t.coolDensity.toFixed(2)} per 100 chars (mirror this rhythm, not the original beats)
Tension curve (per-episode): ${JSON.stringify(t.tensionCurve)}
Abstract method to absorb: ${t.absorbIntoSkill.join('; ')}
Replace ALL persona/setting/worldview; the n-gram gate will flag copied wording.\n`
      : `【爆款逆向·源文本结构化拆解】
为什么爆：
${t.boomReasons.map((b) => `· ${b.dim}：${b.conclusion}`).join('\n')}
可取技法（只借方法、不借表达）：
${techLines}
同结构位置复用的钩子类型：${t.hookType}
人设反差模型：${t.personaContrast}
爽点密度：每百字${t.coolDensity.toFixed(2)}个（镜像这个节奏，不抄原桥段）
逐集张力曲线：${JSON.stringify(t.tensionCurve)}
可吸收的抽象方法论：${t.absorbIntoSkill.join('；')}
人设/背景/世界观全部替换；n-gram 闸门会标记抄袭措辞。\n`;
  }
  // v2.84 自主学习知识库注入：把已生效的高分剧本技法/市场趋势/政策规则按 brief 相关性注入各岗位
  const knowledgeDirective = buildKnowledgeDirective(options.knowledgeHints, hookLang, brief);
  // v2.85 创作上下文注入：时令/爆款/画像/地域文化/历史脑洞/AIGC制作规范 → 取向指令（不是硬设定）
  const creationCtx = options.creationContextInput ? buildCreationContext(options.creationContextInput) : null;
  const creationContextDirective = creationCtx?.contextBrief ?? '';
  // v2.103 AIGC 微节拍计划：按实际 aigcDurationMin 生成逐30秒微叙事单元骨架，
  // 此前 planAigcBeats 完全闲置——creation-context 用默认90秒的 aigcProductionBrief()，
  // 既不按实际时长、也不把逐拍 arcPrompt + productionHints 下发给撰写师
  const isAigcFmt = (options.scriptFormat ?? 'LIVE') === 'AIGC';
  const aigcBeatPlan: AigcBeatPlan | null = isAigcFmt
    ? planAigcBeats(Math.round((options.aigcDurationMin ?? 1) * 60))
    : null;
  const aigcBeatDirective = aigcBeatPlan ? (hookLang === 'en'
    ? `[AIGC micro-beats: ~${aigcBeatPlan.totalSeconds}s total, ${aigcBeatPlan.beatCount} x 30s units]\n` + aigcBeatPlan.beats.map((b) => `  Beat ${b.no} (${b.startSec}-${b.endSec}s${b.isTail ? ' tail' : ''}): micro-arc = set a small goal, create a small obstacle, deliver a small result, end with a hook pulling to the next unit\n  Hints: ${b.productionHints.map(h => h.replace(/[^\x00-\x7F]/g, '')).join('; ')}`).join('\n') + '\n'
    : `【AIGC微节拍：约${aigcBeatPlan.totalSeconds}秒，${aigcBeatPlan.beatCount}个30秒单元】\n` + aigcBeatPlan.beats.map((b) => `  第${b.no}拍（${b.startSec}-${b.endSec}秒${b.isTail ? '·尾拍' : ''}）：${b.arcPrompt}\n  制作提示：${b.productionHints.join('；')}`).join('\n') + '\n')
    : '';
  // v2.106 跨集连续性指令：把前集摘要（角色状态/伏笔/集尾钩子）注入架构师/撰写师，
  // 此前多集生成时管线完全不知道前集内容——人物状态/伏笔/剧情线全靠 LLM 凭空衔接
  const prevEp = options.prevEpisode;
  const prevEpisodeDirective = prevEp ? (hookLang === 'en'
    ? `[Previous episode continuity — MUST honor]\n  Ep ${prevEp.epNo} "${prevEp.title}": ${prevEp.summary}\n  Rules: this episode MUST continue from the above; character states/relationships carry over; resolve or advance any cliffhanger; never contradict established facts; callback earlier moments naturally.\n`
    : `【前集连续性·必须承接】\n  第${prevEp.epNo}集《${prevEp.title}》：${prevEp.summary}\n  规则：本集必须承接上文；人物状态/关系延续；集尾钩子要回应或推进；不得与前文矛盾；前文名场面自然回扣。\n`)
  : '';
  // v2.80 生成侧跨集连续性简报：秘密/状态/伏笔/弧光台账在【生成前】进岗位提示词，修复"检测与生成脱节"
  const continuity = continuityBrief({
    curEpNo: episodeIndex + 1,
    prevSecrets: options.prevSecrets ?? null,
    prevStates: options.prevStates ?? null,
    prevForeshadow: options.prevForeshadow ?? null,
    prevArc: options.prevArc ?? null,
    prevEnding: options.prevEpisode?.ending ?? null, // v2.80 前集结尾原句（跨集焊点）
  });
  // v2.80 焊点块按层拼接进 continuityDirective：架构师/撰写师/打回重写三处注入点零改动全覆盖
  const continuityDirective = hookLang === 'en'
    ? continuity.directiveEn + continuity.endingBlockEn
    : continuity.directiveZh + continuity.endingBlockZh;
  // v2.80 装置防疲劳：前集装置布点喂疲劳引擎，有疲劳信号才注入架构师布点约束（检测与生成闭环的"生成"半边）
  const fd = fatigueDirective(options.prevDevices ?? []);
  const fatigueDir = hookLang === 'en' ? fd.en : fd.zh;
  // v2.80 配角在场防遗忘：前集在场位喂台账引擎，有缺席信号才注入架构师调度约束（与疲劳注入同构）
  const pd = presenceDirective(options.prevPresence ?? [], episodeIndex + 1);
  const presenceDir = hookLang === 'en' ? pd.en : pd.zh;
  // v2.80 关系线保鲜：前集同场位喂台账引擎，有失联信号才注入架构师同场调度约束（与在场注入同构）
  const pb = pairBondDirective(options.prevPairs ?? [], options.prevPresence ?? [], episodeIndex + 1);
  const pairDir = hookLang === 'en' ? pb.en : pb.zh;
  // v2.80 支线编织：前集支线声明位喂台账引擎；schema 要求恒注入（subplots 字段是闭环载体，第1集起建立），冷线块按需追加
  const sw = subplotWeaveDirective(options.prevSubplots ?? [], episodeIndex + 1);
  const subplotDir = hookLang === 'en' ? sw.en : sw.zh;
  // v2.80 憋爽波浪：前集逐集爽感摘要喂台账引擎，有跨集疲劳信号才注入架构师布点约束（与装置疲劳注入同构）
  const gw = gratificationDirective(options.prevWaves ?? [], episodeIndex + 1);
  const gratDir = hookLang === 'en' ? gw.en : gw.zh;
  // v2.80 集尾钩子跨集兑现：前集钩子位喂兑现账本，有硬钩才注入架构师接钩约束（与憋爽波浪注入同构）
  const hpay = hookPayoffDirective(options.prevHook ?? null);
  const hookPayDir = hookLang === 'en' ? hpay.en : hpay.zh;
  // v2.80 屈辱-打脸跨集账本：前集羞辱雷摘要喂欠账引擎，欠账≥3才注入架构师还账约束（与钩子兑现注入同构）
  const hum = humiliationDirective(options.prevHumDebt ?? []);
  const humDebtDir = hookLang === 'en' ? hum.en : hum.zh;
  // v2.80 多集悬念干旱账本：前集悬念线摘要喂干旱引擎，干旱≥2才注入架构师部分答案约束（与屈辱欠账注入同构）
  const mys = mysteryDroughtDirective(options.prevMystery ?? []);
  const mysDir = hookLang === 'en' ? mys.en : mys.zh;
  // v2.80 跨集钩型疲劳账本：前集钩型摘要喂疲劳引擎，连续≥2集同型即预防式注入架构师换型约束（与悬念干旱注入同构）
  const hfat = hookFatigueDirective(options.prevHookTypes ?? []);
  const hfatDir = hookLang === 'en' ? hfat.en : hfat.zh;
  // v2.80 信物跨集连续性账本：前集信物摘要喂连续性引擎，有封禁名单/悬空预警即注入架构师信物调度约束（与钩型疲劳注入同构）
  const pdir = propDirective(options.prevProps ?? []);
  const propDir = hookLang === 'en' ? pdir.en : pdir.zh;
  // v2.80 承诺欠账账本：前集承诺摘要喂欠账引擎，挂账≥2才注入架构师兑现约束（与悬念干旱注入同构）
  const prmd = promiseDroughtDirective(options.prevPromises ?? []);
  const prmdDir = hookLang === 'en' ? prmd.en : prmd.zh;
  // v2.80 反派威胁升级账本：前集反派摘要喂威胁账本，连续缺席/同档复用达阈值才注入架构师升压约束（与承诺欠账注入同构）
  const vtd = villainThreatDirective(options.prevVillainThreats ?? []);
  const vtdDir = hookLang === 'en' ? vtd.en : vtd.zh;
  // v2.80 时间线跨集账本：前集时间锚摘要喂时序账本，倒流/干旱达阈值才注入架构师校准约束（与反派威胁注入同构）
  const tld = timelineDirective(options.prevTimelineMarks ?? []);
  const tldDir = hookLang === 'en' ? tld.en : tld.zh;
  // v2.80 代价跨集账本：前集代价摘要喂代价账本，零代价连胜达阈值才注入架构师先付代价约束（与时间线注入同构）
  const cld = costDirective(options.prevCostRows ?? []);
  const cldDir = hookLang === 'en' ? cld.en : cld.zh;
  // v2.80 死亡穿帮账本：前集死亡摘要喂死亡账本，死亡名册非空才注入架构师复活预警约束（与代价注入同构）
  const dld = deathDirective(options.prevDeathRows ?? []);
  const dldDir = hookLang === 'en' ? dld.en : dld.zh;
  // v2.80 反派下场账本：前集下场摘要喂下场账本，下场名册非空才注入架构师下场维持约束（与死亡账本注入同构）
  const vfd = fateDirective(options.prevFateRows ?? []);
  const vfdDir = hookLang === 'en' ? vfd.en : vfd.zh;
  // v2.80 创伤恢复账本：前集创伤摘要喂创伤账本，创伤名册非空才注入架构师伤势维持约束（与下场账本注入同构）
  const wrd = woundDirective(options.prevWoundRows ?? []);
  const wrdDir = hookLang === 'en' ? wrd.en : wrd.zh;
  // v2.80 境界进阶账本：前集境界摘要喂境界账本，名册非空才注入架构师境界连续性约束（与创伤账本注入同构）
  const pwr = powerDirective(options.prevPowerRows ?? []);
  const pwrDir = hookLang === 'en' ? pwr.en : pwr.zh;
  // v2.80 信物归属账本：前集归属摘要喂归属账本，让渡名册非空才注入架构师归属连续性约束（与境界账本注入同构）
  const itm = ownershipDirective(options.prevItemRows ?? []);
  const itmDir = hookLang === 'en' ? itm.en : itm.zh;
  // v2.80 关系翻转账本：前集关系摘要喂关系账本，翻转账本名册非空才注入架构师关系维持约束（与归属账本注入同构）
  const rel = relationshipDirective(options.prevRelRows ?? []);
  const relDir = hookLang === 'en' ? rel.en : rel.zh;
  // v2.80 阵营归属账本：前集归属摘要喂归属账本，已脱离名册非空才注入架构师阵营连续性约束（与关系账本注入同构）
  const aff = affiliationDirective(options.prevAffRows ?? []);
  const affDir = hookLang === 'en' ? aff.en : aff.zh;
  // v2.80 地点跨集账本：前集地点摘要喂地点账本，滞留名册非空才注入架构师地点连续性约束（与阵营账本注入同构）
  const loc = locationDirective(options.prevLocRows ?? []);
  const locDir = hookLang === 'en' ? loc.en : loc.zh;
  // v2.80 秘密泄露账本：前集知情摘要喂泄露账本，非知情者声称知道秘密才注入架构师知情范围约束（与阵营账本注入同构）
  const leak = secretLeakDirective(options.prevLeakRows ?? []);
  const leakDir = hookLang === 'en' ? leak.en : leak.zh;
  // v2.80 伪装身份账本：前集伪装摘要喂伪装账本，揭穿后又伪装才注入架构师身份连续性约束（与阵营账本注入同构）
  const disg = disguiseDirective(options.prevDisguiseRows ?? []);
  const disgDir = hookLang === 'en' ? disg.en : disg.zh;
  // v2.80 人情债账本：前集债务摘要喂债务账本，欠债后恩将仇报才注入架构师人情债约束（与阵营账本注入同构）
  const debt = debtDirective(options.prevDebtRows ?? []);
  const debtDir = hookLang === 'en' ? debt.en : debt.zh;
  // v2.80 联盟账本：前集联盟摘要喂联盟账本，结盟状态下无交代敌对才注入架构师联盟连续性约束
  const ally = allianceDirective(options.prevAllianceRows ?? []);
  const allyDir = hookLang === 'en' ? ally.en : ally.zh;
  // v2.80 记忆账本：前集失忆摘要喂记忆账本，失忆状态下无交代却回忆才注入架构师失忆连续性约束
  const mem = memoryDirective(options.prevMemoryRows ?? []);
  const memDir = hookLang === 'en' ? mem.en : mem.zh;
  // v2.80 冒充账本：前集冒充摘要喂冒充账本，冒充状态下真 B 被认出才注入架构师身份重叠约束
  const imp = impersonationDirective(options.prevImpersonationRows ?? []);
  const impDir = hookLang === 'en' ? imp.en : imp.zh;
  // v2.80 背叛账本：前集背叛摘要喂背叛账本，背叛后无和解却合作才注入架构师信任连续性约束
  const btr = betrayalDirective(options.prevBetrayalRows ?? []);
  const btrDir = hookLang === 'en' ? btr.en : btr.zh;
  // v2.80 牺牲账本：前集牺牲摘要喂牺牲账本，牺牲后无感恩却轻慢才注入架构师忘恩连续性约束
  const sac = sacrificeDirective(options.prevSacrificeRows ?? []);
  const sacDir = hookLang === 'en' ? sac.en : sac.zh;
  // v2.80 诅咒账本：前集诅咒摘要喂诅咒账本，中咒状态下无解除却不受影响才注入架构师诅咒连续性约束
  const cur = curseDirective(options.prevCurseRows ?? []);
  const curDir = hookLang === 'en' ? cur.en : cur.zh;
  // v2.80 附身账本：前集附身摘要喂附身账本，被附身状态下无解除却本人意志才注入架构师附身连续性约束
  const pos = possessionDirective(options.prevPossessionRows ?? []);
  const posDir = hookLang === 'en' ? pos.en : pos.zh;
  // v2.80 穿越账本：前集穿越摘要喂穿越账本，已穿越状态下无回归却原时间线行动才注入架构师穿越连续性约束
  const tt = timeTravelDirective(options.prevTimeTravelRows ?? []);
  const ttDir = hookLang === 'en' ? tt.en : tt.zh;
  // v2.80 变身账本：前集变身摘要喂变身账本，已变身状态下无恢复却原形行动才注入架构师变身连续性约束
  const tf = transformationDirective(options.prevTransformationRows ?? []);
  const tfDir = hookLang === 'en' ? tf.en : tf.zh;
  // v2.80 中毒账本：前集中毒摘要喂中毒账本，已中毒状态下无解毒却无恙行动才注入架构师中毒连续性约束
  const poi = poisonDirective(options.prevPoisonRows ?? []);
  const poiDir = hookLang === 'en' ? poi.en : poi.zh;
  const trackId = recommendTrack(brief);
  const track = TRACK_STRATEGY[trackId];
  // v2.99 英文链路必须零中文：赛道策略用硬编码英文（engine 的 TRACK_STRATEGY 是中文源）
  const trackEn: Record<string, { name: string; gratification: string; core: string; rhythm: string; payoffWindow: string; compete: string; taboo: string }> = {
    mass: {
      name: 'Mass track (high-burst)', gratification: 'Instant gratification',
      core: 'Emotional pressure: block the protagonist\'s escape completely, suffocate the audience, then slap back hard; monetize at the paywall.',
      rhythm: 'Hook density first: advance within three lines, villain kneels within three lines of the slap, no time to think.',
      payoffWindow: 'Instant payoff after pressure, constant small wins',
      compete: 'Hook density and emotional intensity',
      taboo: 'Do NOT write mass-market with premium slow pacing; dragging = instant bounce',
    },
    premium: {
      name: 'Premium track (high-floor)', gratification: 'Delayed gratification',
      core: 'High-IQ contrast: identity mismatch + unexpected brain-twist reversal; stretch the frustration for high-quality emotional aftertaste.',
      rhythm: 'Hold back the trump card after pressure, build tension via identity mismatch / environment, but reversal never drags past three lines, face-slap under two minutes.',
      payoffWindow: 'One high-IQ payoff after buildup, prioritize character arc',
      compete: 'Character arc and reversal IQ',
      taboo: 'Do NOT write premium with mass-market crude logic; mindless power-fantasy kills polish',
    },
  };
  const te = trackEn[trackId];
  const trackDirective = hookLang === 'en'
    ? `[Market track: ${te.name}]\n- Gratification: ${te.gratification}\n- Core: ${te.core}\n- Rhythm: ${te.rhythm}\n- Payoff window: ${te.payoffWindow}\n- Compete on: ${te.compete}\n- Taboo: ${te.taboo}\n`
    : `【市场赛道：${track.name}】\n- 满足方式：${track.gratification}\n- 核心：${track.core}\n- 节奏：${track.rhythm}\n- 兑付窗口：${track.payoffWindow}\n- 比拼：${track.compete}\n- 禁忌：${track.taboo}\n`;
  // v2.100 海外本地化：brief 出现海外/跨文化关键词时注入 WEST 区域打法 + 跨文化创新原则，
  // 此前 OVERSEA_PLAYBOOK 和 CROSS_CULTURE_PRINCIPLE 完全闲置——国内公式出海必败但管线无人把关
  const overseaKeywords = /狼人|吸血鬼|女巫|werewolf|vampire|witch|海外|欧美|王室|贵族|强制爱|命运婚约|带球跑|跨文化|west|overseas/i;
  const isOversea = overseaKeywords.test(brief);
  const westPb = OVERSEA_PLAYBOOK['WEST'];
  const overseasDirective = isOversea ? (hookLang === 'en'
    ? `[Overseas localization — WEST market]\n- Audience wants: fateful attraction + competitive romance (forced love / destiny bond), NOT "underdog looked down upon"\n- Hot topics: werewolf awakening, vampire/witch, elite competition, secret baby, forced love, fate marriage contract, royalty/aristocracy\n- Line style: direct & fiery, emotions on the surface\n- Open rhythm: conflict maxed in the first second, slow 3-ep setup = instant swipe\n- Avoid: copy-pasting the CN "despised -> face-slap" formula (Western audiences cannot relate); this is NOT translating Chinese to English, it is cultural dimension reduction\n[Cross-culture principle] Turn cultural elements into persona / power / payoff, NOT exposition or lecture\n  e.g. Western witch is actually a Ming-dynasty female physician / Vampire bite suppressed by Eastern talisman bloodline\n`
    : `【海外本地化——欧美市场】\n- 观众想要：${westPb.want}\n- 热门题材：${westPb.hotTopics.join('、')}\n- 台词风格：${westPb.lineStyle}\n- 开篇节奏：${westPb.openRhythm}\n- 避免：${westPb.avoid}\n【跨文化创新原则】${CROSS_CULTURE_PRINCIPLE.rule}\n  示例：${CROSS_CULTURE_PRINCIPLE.examples.slice(0, 2).join('；')}\n`)
    : '';
  // v2.102 流派痛点代偿：按 brief 关键词匹配最契合的流派（现实痛点→情绪代偿→核心技法→短剧迁移要点→禁忌），
  // 此前 matchGenreByPain 只在 writers-room 用，主管线不接入——架构师/撰写师拿不到流派方法论
  const genreMatches = matchGenreByPain(`${brief} ${options.style ?? ''}`, 2, hookLang === 'en' ? 'en' : 'zh');
  const genreDirective = genreMatches.length > 0 ? (hookLang === 'en'
    ? genreMatches.map((g) => {
        const en = GENRE_EN[g.id];
        if (!en) return '';
        return `[Genre: ${en.name}] Pain: ${en.pain} -> Compensate: ${en.comp}\n  Technique: ${en.tech}\n  Short-drama fit: ${en.fit}\n  Avoid: ${en.avoid}`;
      }).filter(Boolean).join('\n') + '\n' + `[Familiar-twist rule] 80% familiar classic setup + 20% radical twist: lure viewers with a well-known premise, then deliver a surprising reversal; complex worldbuilding is a barrier, not sophistication.\n`
    : genreMatches.map((g) => `【流派：${g.name}】痛点：${g.realityPain} → 代偿：${g.compensation}\n  核心技法：${g.coreTechnique}\n  短剧迁移：${g.shortDramaFit}\n  禁忌：${g.avoid}`).join('\n') + '\n' + `【旧瓶新酒】${FAMILIAR_TWIST.ratio}：${FAMILIAR_TWIST.principle}\n`)
    : '';
  // v2.329 输出语言锁定：非中文时要求台词/旁白/场景描述使用该语言，结构标记与字数闸门不变
  const outputLangDirective = (() => {
    const code = options.outputLang;
    if (!code || code === 'zh') return '';
    const l = OUTPUT_LANGUAGES.find((x) => x.code === code);
    if (!l) return '';
    if (code === 'en') {
      return '[OUTPUT LANGUAGE: English] Every scene heading, action line, parenthetical and spoken line must be natural English; keep the screenplay layout markers (scene heads, △ action lines, NAME (emotion): dialogue) unchanged. Do not mix Chinese into the body except proper nouns without an English equivalent.\n';
    }
    return `【输出语言锁定：${l.name}（${l.native}）】本集所有台词、旁白、场景描述、动作行必须使用${l.name}书写，符合该语言母语者的自然表达与口语习惯；剧本结构标记（场景行、△动作行、角色名（情绪）：台词行）与字数区间要求保持不变；除无对应译名的专有名词外，正文不得混排其他语言。\n`;
  })();
  const formatDirective = scriptFormatDirective(options.scriptFormat ?? 'LIVE', hookLang)
    + '\n' + buildSceneHeaderDirective(options.scriptFormat ?? 'LIVE', hookLang) // v2.157 场头前置教学：一次写对，省 QC retry 轮次
    + '\n' + outputLangDirective;
  // v2.80 润色各环节共用的“版式保持语”：LIVE 保 △分行，AIGC 保流畅自然段（两种版式哲学相反，严禁混用指令）
  const fmtMode = options.scriptFormat ?? 'LIVE';
  const layoutKeepRule = fmtMode === 'AIGC'
    ? (hookLang === 'en'
      ? 'Revise in place and KEEP the Z-AIGC flowing production-script layout: body text stays smooth readable prose paragraphs (never △ markers, never [shot-size]/camera-move tag stacks, never prompt-sheet keyword lists); each scene head on its own line as INT./EXT. PLACE - TIME; inner voice and sound only as natural parentheticals in the prose ((inner: …), (V.O.: …), (SFX: …), (MUSIC: …)); every spoken line stays its own NAME (emotion): dialogue line; spoken content stays 18-28% of total.'
      : '在原稿上整稿修订并保持Z-AIGC流畅制作本版式：正文始终是好读的流畅自然段（不加△、不堆【景别】【运镜】等技术标签、不写提示词式关键词罗列）；场标独占一行（内景/外景 地点·时间）；内心/音效/配乐只用自然段里的自然括号承载（内心：/OS/画外音/音效：/配乐：）；每句台词保持“角色名（情绪）：台词”独立行；发声内容（台词+OS+内心）占比保持18%-28%。')
    : (hookLang === 'en'
      ? 'Revise in place: keep the screenplay layout (△ action lines, NAME: dialogue lines); never merge lines into prose paragraphs.'
      : '在原稿版式上整稿修订：必须保留剧本分行版式（△动作行、角色名：台词行），严禁合并成小说式自然段。');
  // v2.18 真人编剧风格库（PRD 2.2）接线：自由风格文本→可执行风格画像；英文链路不注入中文风格串
  const styleProfile: StyleProfile | null = hookLang === 'zh'
    ? resolveStyleByHint(`${options.style ?? ''} ${brief}`.slice(0, 400))
    : null;
  const styleProfileDirective = styleProfile ? buildStyleProfileDirective(styleProfile) + '\n' : '';
  // v2.32 用户私有参考剧本风格（只学节奏/语感，不抄情节原句）；样本不足自动忽略
  const customStyleDirective = options.customStyleText ? buildCustomStyleDirective(options.customStyleText, hookLang) + '\n' : '';
  // v1.97 钩子×节拍跨模块一致性质检（安全网）：反转卡点脱配(对齐后应趋零)、全剧爽点缺情感沉淀
  const coherenceIssues = auditNarrativeCoherence(hookPlanAll, beatPlanAll, hookLang);
  beatIssues.push(...coherenceIssues); // 并入既有 beats.issues 质量面，统一回传评分卡，不改返回结构
  const coherenceNote = episodeCoherenceNote(epHook, epBeat, hookLang);
  // v1.99 八岗位提示词内联骨架双语（默认中文逐字不变；英文链路整段零中文）
  const G = hookLang === 'en' ? {
    hookEng: '[Four-layer hook engineering for this episode — MUST land; the opening-hook and episode-end cliff types are specified]',
    beatEng: '[Reversal / payoff / emotion-beat engineering for this episode — MUST land]',
    arc: 'Episode arc:',
    antiCliché: `[Anti-cliché · ${strength}] Avoid overused, stale setups; give characters and reversals a fresh angle.`,
    brief: 'Brief:',
    outlineOnly: 'Output ONLY JSON Outline; hookType must be the specified opening-hook type name.',
    outlineColon: 'Outline:',
    bibleExisting: 'Existing series bible:',
    castOnly: 'Output ONLY JSON character-card Cast',
    followOutline: '[Outline you MUST follow]',
    landHooks: '[Four-layer hook layout you MUST land — weave into concrete action and dialogue; never echo the type names]',
    landBeats: '[Reversal/payoff/emotion beats you MUST land naturally; never echo the type names]',
    followCast: '[Cast you MUST follow]',
    voiceHeader: '[Per-character voice — every line must be speakable as written]',
    colloquial: 'Colloquial level:',
    episodeColon: 'Episode:',
    jsonAudience: 'Output ONLY JSON {riskPoints,cravingScore,wantNext}',
    viewerMust: 'Viewer feedback (must address):',
    rewriteStronger: 'Strengthen hooks and payoffs on the same structure and rewrite this episode.',
    draftToRevise: 'Draft to revise:',
    removeAiTells: 'Remove these AI tells:',
    replaceCliche: 'Replace these cliché beats:',
    makeSpeakable: 'Turn these written-sounding lines into speakable speech:',
    filmable: 'Turn abstract narration into filmable concrete actions/props.',
    genericReaction: 'At identity/truth reveals, replace lazy generic reactions with words/actions only this character would use.',
    keepChars: 'Keep characters:',
    originalDraft: 'Original draft:',
    jsonCompliance: 'Output ONLY JSON {pass,risks}',
    detailEn: 'Add 1-2 concrete environment/action/prop/sound details that serve plot or character; do not pile them on.',
  } : {
    hookEng: '【本集四层钩子工程·必须落实，开场钩与集尾卡点类型已指定】',
    beatEng: '【本集反转/爽点/情绪节拍工程·必须落实】',
    arc: '节奏弧:',
    antiCliché: `【反套路·${strength}】避开这些烂大街桥段:${CLICHE_TROPES.map((t) => t.keywords[0]).join('、')}；人设/反转要换新鲜角度`,
    brief: '需求:',
    outlineOnly: '只输出JSON Outline，hookType 必须填指定的开场钩类型名',
    outlineColon: '大纲:',
    bibleExisting: '圣经既有:',
    castOnly: '只输出JSON人物卡Cast',
    followOutline: '【必须遵循的大纲】',
    landHooks: '【必须落实的四层钩子排布·写进具体情节与台词，不要复述类型名】',
    landBeats: '【必须落实的反转/爽点/情绪节拍·自然落地，不要复述类型名】',
    followCast: '【必须遵循的人物卡】',
    voiceHeader: '【各角色说话方式·台词必须能直接念出口】',
    colloquial: '口语化程度:',
    episodeColon: '本集:',
    jsonAudience: '只输出JSON {riskPoints,cravingScore,wantNext}',
    viewerMust: '观众意见(必须解决):',
    rewriteStronger: '在原结构上强化钩子与爽点，重写本集',
    draftToRevise: '待修订原稿:',
    removeAiTells: '必须删除AI腔:',
    replaceCliche: '必须替换老套桥段:',
    makeSpeakable: '必须把书面腔改成能念出口的人话:',
    filmable: '把抽象叙述改成可拍摄的具体动作/道具',
    genericReaction: '',
    keepChars: '保持人物:',
    originalDraft: '原稿:',
    jsonCompliance: '只输出JSON {pass,risks}',
    detailEn: '',
  };
  const cost = { n: 0, fellbacks: [] as string[] };
  let sandbox = false;
  // v2.151 角色资产：立项引用的跨剧资产编译成三岗位强约束指令（架构师欲望链/人设师人物卡/撰写师声音）
  const castAssetDirective = options.castAssets?.length ? buildCastAssetDirective(options.castAssets, hookLang) : '';
  // v2.159 道具资产：立项引用的跨剧关键信物编译成双岗位强约束指令（道具是剧情事实源非人设，人设师人物卡不含道具）
  const propAssetDirective = options.propAssets?.length ? buildPropAssetDirective(options.propAssets, hookLang) : '';
  // v2.161 场景资产：立项引用的跨剧关键场景编译成双岗位强约束指令（场景是舞台事实源非人设，人设师人物卡不含场景）
  const sceneAssetDirective = options.sceneAssets?.length ? buildSceneAssetDirective(options.sceneAssets, hookLang) : '';
  emit({ role: 'dispatcher', status: 'running', note: hookLang === 'en' ? 'Dispatcher breaking down the task and loading the series bible and craft core' : '中央调度拆解任务，载入全局圣经与创作内核' });

  // ① 架构师 → 大纲（选钩子型、排节拍）
  emit({ role: 'architect', status: 'running', note: hookLang === 'en'
    ? `Plotting the golden-3-seconds “${hookName(epHook.openHookId, 'en')}” opening and the “${hookName(epHook.endHookId, 'en')}” episode-end cliff`
    : `排布黄金三秒「${hookName(epHook.openHookId)}」与集尾卡点「${hookName(epHook.endHookId)}」` });
  const { data: outline, sandbox: s1 } = await _jsonRole<Outline>(tier, 'architect',
    `${directive('architect', hookLang)}\n${craftArchitectBrief(hookLang)}\n${buildStyleDirective(options.style, hookLang)}\n${G.hookEng}\n${hookDirective}\n${G.beatEng}\n${beatDirective}\n${craftDirective}${formatDirective}\n${styleProfileDirective}${customStyleDirective}${hitLabDirective ? hitLabDirective + '\n' : ''}${longIpDirective ? longIpDirective + '\n' : ''}${modeCraftDirective ? modeCraftDirective + '\n' : ''}${methodTraceDirective ? methodTraceDirective + '\n' : ''}${purposeGateDirective ? purposeGateDirective + '\n' : ''}${castAssetDirective ? castAssetDirective + '\n' : ''}${propAssetDirective ? propAssetDirective + '\n' : ''}${sceneAssetDirective ? sceneAssetDirective + '\n' : ''}${brandDirective ? brandDirective + '\n' : ''}${trendDirective ? trendDirective + '\n' : ''}${branchDirective ? branchDirective + '\n' : ''}${sourceTextDirective ? sourceTextDirective + '\n' : ''}${hitTeardownDirective ? hitTeardownDirective + '\n' : ''}${trackDirective}${overseasDirective ? overseasDirective + '\n' : ''}${genreDirective ? genreDirective + '\n' : ''}${aigcBeatDirective ? aigcBeatDirective + '\n' : ''}${prevEpisodeDirective ? prevEpisodeDirective + '\n' : ''}${continuityDirective ? continuityDirective + '\n' : ''}${fatigueDir ? fatigueDir + '\n' : ''}${presenceDir ? presenceDir + '\n' : ''}${pairDir ? pairDir + '\n' : ''}${subplotDir ? subplotDir + '\n' : ''}${gratDir ? gratDir + '\n' : ''}${hookPayDir ? hookPayDir + '\n' : ''}${humDebtDir ? humDebtDir + '\n' : ''}${mysDir ? mysDir + '\n' : ''}${hfatDir ? hfatDir + '\n' : ''}${propDir ? propDir + '\n' : ''}${prmdDir ? prmdDir + '\n' : ''}${vtdDir ? vtdDir + '\n' : ''}${tldDir ? tldDir + '\n' : ''}${cldDir ? cldDir + '\n' : ''}${dldDir ? dldDir + '\n' : ''}${vfdDir ? vfdDir + '\n' : ''}${wrdDir ? wrdDir + '\n' : ''}${pwrDir ? pwrDir + '\n' : ''}${itmDir ? itmDir + '\n' : ''}${relDir ? relDir + '\n' : ''}${affDir ? affDir + '\n' : ''}${locDir ? locDir + '\n' : ''}${leakDir ? leakDir + '\n' : ''}${disgDir ? disgDir + '\n' : ''}${debtDir ? debtDir + '\n' : ''}${allyDir ? allyDir + '\n' : ''}${memDir ? memDir + '\n' : ''}${impDir ? impDir + '\n' : ''}${btrDir ? btrDir + '\n' : ''}${sacDir ? sacDir + '\n' : ''}${curDir ? curDir + '\n' : ''}${posDir ? posDir + '\n' : ''}${ttDir ? ttDir + '\n' : ''}${tfDir ? tfDir + '\n' : ''}${poiDir ? poiDir + '\n' : ''}${knowledgeDirective ? knowledgeDirective : ''}${creationContextDirective ? creationContextDirective + '\n' : ''}${coherenceNote ? coherenceNote + '\n' : ''}${G.arc}${(hookLang === 'en' ? EPISODE_ARC_EN : EPISODE_ARC).join(hookLang === 'en' ? ' → ' : '→')}\n${paceDir}\n${characterDir}\n${G.antiCliché}\n${G.brief}${brief}\n${G.outlineOnly}`, hookLang === 'en' ? SANDBOX_OUTLINE_EN : SANDBOX_OUTLINE, cost);
  sandbox = sandbox || s1;

  // ② 人设师 → 人物卡（消费大纲），写入全局圣经
  emit({ role: 'designer', status: 'running', note: hookLang === 'en' ? 'Building characters from the outline and filling hidden dimensions' : '依据大纲立人物、补隐性设定' });
  const { data: castRaw, sandbox: s2 } = await _jsonRole<Cast>(tier, 'designer',
    `${directive('designer', hookLang)}\n${characterDir}\n${G.outlineColon}${JSON.stringify(outline)}\n${castAssetDirective ? castAssetDirective + '\n' : ''}${G.bibleExisting}${JSON.stringify(bible.characters)}\n${G.castOnly}`, hookLang === 'en' ? SANDBOX_CAST_EN : SANDBOX_CAST, cost);
  sandbox = sandbox || s2;
  // v2.80 模型常返回 {"cast":{...}} / {"characters":[...]} 包装层，归一化成扁平 {名字: 人物卡}
  const cast: Cast = normalizeCast(castRaw);
  Object.entries(cast).forEach(([name, c]) => {
    // 模型返回的人物卡 hidden 可能缺失/不是数组，归一化防止 .join 崩溃
    const hidden = Array.isArray((c as { hidden?: unknown }).hidden)
      ? ((c as { hidden: unknown[] }).hidden.filter((h) => typeof h === 'string') as string[])
      : [];
    bible.characters[name] = { traits: hidden.join('/'), arc: c.arc, voice: c.voice };
  });
  emit({ role: 'designer', status: 'done', note: hookLang === 'en' ? `Cast ready: ${Object.keys(cast).join(', ')}; synced to the series bible` : `人物卡就绪：${Object.keys(cast).join('、')}，已同步全局圣经` });

  // ③ 撰写师：强制消费 大纲+人物卡 写本集
  emit({ role: 'writer', status: 'running', note: hookLang === 'en' ? 'Writing this episode from the outline beats and character voices' : '依据大纲节拍与人物说话风格写本集' });
  // v2.28 口语化档位以台词策略为准（用户显式 > 题材推荐 > natural=mid），风格文本推断仅作历史兜底
  const colloquialLevel: ColloquialLevel = getDialogueStrategy(resolvedDialogueId).colloquial ?? levelFromStyle(options.style);
  const voiceDirectives = Object.entries(cast)
    .map(([n, c]) => buildVoiceDirective({ name: n, voice: (c as { voice?: string }).voice }, hookLang)).join('\n');
  const w = await _textRole(tier, 'writer',
    `${directive('writer', hookLang)}\n${craftWriterBrief(hookLang)}\n${G.followOutline}${JSON.stringify(outline)}\n${G.landHooks}\n${hookDirective}\n${G.landBeats}\n${beatDirective}\n${craftDirective}${formatDirective}\n${styleProfileDirective}${customStyleDirective}${hitLabDirective ? hitLabDirective + '\n' : ''}${longIpDirective ? longIpDirective + '\n' : ''}${modeCraftDirective ? modeCraftDirective + '\n' : ''}${methodTraceDirective ? methodTraceDirective + '\n' : ''}${purposeGateDirective ? purposeGateDirective + '\n' : ''}${castAssetDirective ? castAssetDirective + '\n' : ''}${propAssetDirective ? propAssetDirective + '\n' : ''}${sceneAssetDirective ? sceneAssetDirective + '\n' : ''}${brandDirective ? brandDirective + '\n' : ''}${trendDirective ? trendDirective + '\n' : ''}${branchDirective ? branchDirective + '\n' : ''}${sourceTextDirective ? sourceTextDirective + '\n' : ''}${hitTeardownDirective ? hitTeardownDirective + '\n' : ''}${trackDirective}${overseasDirective ? overseasDirective + '\n' : ''}${genreDirective ? genreDirective + '\n' : ''}${aigcBeatDirective ? aigcBeatDirective + '\n' : ''}${prevEpisodeDirective ? prevEpisodeDirective + '\n' : ''}${continuityDirective ? continuityDirective + '\n' : ''}${knowledgeDirective ? knowledgeDirective : ''}${creationContextDirective ? creationContextDirective + '\n' : ''}${coherenceNote ? coherenceNote + '\n' : ''}${G.followCast}${JSON.stringify(cast)}\n${G.voiceHeader}\n${voiceDirectives}\n${dialogueDir}\n${emotionDir}\n${characterDir}\n${G.colloquial}${colloquialLevel}\n${G.brief}${brief}`, cost);
  // 沙盘兜底稿按制式+语言选择：AIGC 必须用流畅本（△分镜稿过不了 AIGC 闸门），LIVE 沿用分镜体
  const sandboxFallback = (options.scriptFormat ?? 'LIVE') === 'AIGC'
    ? buildSampleScript('AIGC', hookLang)
    : (hookLang === 'en' ? SANDBOX_DRAFT_EN : SANDBOX_DRAFT);
  let draft = w.text || sandboxFallback;
  if (w.sandbox) sandbox = true;
  emit({ role: 'writer', status: 'done', note: hookLang === 'en' ? 'First draft of this episode complete' : '本集初稿完成' });

  // ④ 观众代言官：预判划走点，追更欲/转化欲不足则打回撰写师强化（1次），并对终稿复评
  // v2.90 模式适配：单条带货/种草评“转化欲”而非“追更欲”；v2.329 改按成品形态（剧本类型）判断，短视频/广告/宣传片一律转化导向
  const convIntent = options.scriptType
    ? (options.scriptType === 'short_video' || options.scriptType === 'ad_script' || options.scriptType === 'promo_script')
    : craftModeKey === 'video_short'; // 历史项目无 scriptType 时按旧方法论 key 兜底
  emit({ role: 'audience', status: 'running', note: hookLang === 'en'
    ? (convIntent ? 'Stress-testing swipe-away points and conversion intent from the target viewer’s lens' : 'Stress-testing retention and binge-craving from the target viewer’s lens')
    : (convIntent ? '以目标观众视角压测划走点与转化欲' : '以目标观众视角压测留存与追更欲') });
  let audience = (await _jsonRole<AudienceReport>(tier, 'audience',
    `${directive('audience', hookLang)}\n${craftAudienceBrief(hookLang)}\n${brandDirective ? brandDirective + '\n' : ''}${rangeLensDirective ? rangeLensDirective + '\n' : ''}${G.episodeColon}${draft.slice(0, 6000)}\n${G.jsonAudience}`,
    { riskPoints: [], cravingScore: 82, wantNext: outline.cliffhanger }, cost)).data;
  // 模型 JSON 形状容错：riskPoints 非数组时归一，避免 [0] 取值与重写提示崩溃
  if (!Array.isArray(audience.riskPoints)) audience.riskPoints = [];
  if (audience.cravingScore < 70) {
    emit({ role: 'writer', status: 'retry', note: hookLang === 'en'
      ? `Audience advocate: ${audience.riskPoints[0]?.reason ?? 'sagging middle'} — rewrite with stronger beats`
      : `观众代言官：${audience.riskPoints[0]?.reason ?? '中段疲软'}，强化后重写` });
    const rw = await _textRole(tier, 'writer',
      `${directive('writer', hookLang)}\n${G.viewerMust}${JSON.stringify(audience)}\n${G.outlineColon}${JSON.stringify(outline)}\n${G.rewriteStronger}\n${formatDirective}\n${brandDirective ? brandDirective + '\n' : ''}${trendDirective ? trendDirective + '\n' : ''}${branchDirective ? branchDirective + '\n' : ''}${sourceTextDirective ? sourceTextDirective + '\n' : ''}${hitTeardownDirective ? hitTeardownDirective + '\n' : ''}${trackDirective}${overseasDirective ? overseasDirective + '\n' : ''}${genreDirective ? genreDirective + '\n' : ''}${aigcBeatDirective ? aigcBeatDirective + '\n' : ''}${prevEpisodeDirective ? prevEpisodeDirective + '\n' : ''}${continuityDirective ? continuityDirective + '\n' : ''}`, cost);
    if (rw.text.length > 100) {
      draft = rw.text;
      // 复评终稿：done 事件汇报的分数必须是终稿真实分，而非被打回的初稿分
      const re = await _jsonRole<AudienceReport>(tier, 'audience',
        `${directive('audience', hookLang)}\n${craftAudienceBrief(hookLang)}\n${brandDirective ? brandDirective + '\n' : ''}${rangeLensDirective ? rangeLensDirective + '\n' : ''}${G.episodeColon}${draft.slice(0, 6000)}\n${G.jsonAudience}`,
        audience, cost);
      audience = re.data;
      if (!Array.isArray(audience.riskPoints)) audience.riskPoints = [];
    }
  }
  emit({ role: 'audience', status: 'done', note: hookLang === 'en'
    ? (convIntent ? `Conversion-intent score ${audience.cravingScore}/100` : `Binge-craving score ${audience.cravingScore}/100`)
    : (convIntent ? `转化欲评分 ${audience.cravingScore}/100` : `追更欲评分 ${audience.cravingScore}/100`) });

  // ⑤ 润色师：在原稿上整稿修订（替换，不堆叠）
  emit({ role: 'polisher', status: 'running', note: hookLang === 'en' ? 'Injecting lifelike detail and polishing to remove AI tells' : '注入烟火气细节、去AI化整稿润色' });
  // v2.80 创作能力闭环：润色前先扫AI味，把top问题定向喂给润色师（检测→定向润色）
  const prePolishAiTaste = dialogueAiTaste(draft);
  const aiTasteHint = prePolishAiTaste.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[AI-taste fixes] Rewrite these flagged lines: ${prePolishAiTaste.issues.slice(0, 5).map((i) => `"${i.line}" -> ${i.advice}`).join('; ')}\n`
      : `\n[AI味定向修复] 改写以下被标记台词：${prePolishAiTaste.issues.slice(0, 5).map((i) => `"${i.line}" → ${i.advice}`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：场景情绪平检测，平场景加情绪反差
  const prePolishEmoFlat = sceneEmotionFlat(draft);
  const emoFlatHint = prePolishEmoFlat.flatScenes.length > 0
    ? (hookLang === 'en'
      ? `\n[Emotional flatness] Add emotional contrast to these scenes: ${prePolishEmoFlat.flatScenes.slice(0, 3).map((s) => `"${s.sceneHeader}" -> ${s.advice}`).join('; ')}\n`
      : `\n[情绪平场景修复] 给以下场景加情绪反差：${prePolishEmoFlat.flatScenes.slice(0, 3).map((s) => `"${s.sceneHeader}" → ${s.advice}`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：感官细节检测，缺非视觉感官则定向补写
  const prePolishSensory = sensoryDetail(draft);
  const sensoryHint = prePolishSensory.missing.length > 0
    ? (hookLang === 'en'
      ? `\n[Sensory enrichment] ${prePolishSensory.advice}\n`
      : `\n[感官细节补写] ${prePolishSensory.advice}\n`)
    : '';
  // v2.80 创作能力闭环：模糊词/空心词检测，逼叙述落到具体所指
  const prePolishVague = vagueWord(draft);
  const vagueHint = prePolishVague.totalCount > 0 && prePolishVague.score < 85
    ? (hookLang === 'en'
      ? `\n[Concrete prose] ${prePolishVague.advice}\n`
      : `\n[具体落笔] ${prePolishVague.advice}\n`)
    : '';
  // v2.80 创作能力闭环：对白直呼名过密检测，两人戏删称呼
  const prePolishNameCall = dialogueNameCall(draft, Object.keys(cast));
  const nameCallHint = prePolishNameCall.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Vocative trim] ${prePolishNameCall.advice} Offending scenes: ${prePolishNameCall.scenes.filter((s) => s.overused).map((s) => `"${s.sceneHeader}"`).join(', ')}\n`
      : `\n[称呼精简] ${prePolishNameCall.advice} 涉及场景：${prePolishNameCall.scenes.filter((s) => s.overused).map((s) => `「${s.sceneHeader}」`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：机械问答乒乓检测，逼对白出现回避/反问/沉默
  const prePolishPingpong = dialoguePingpong(draft);
  const pingpongHint = prePolishPingpong.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Break the Q&A rail] ${prePolishPingpong.advice} Offending scenes: ${prePolishPingpong.scenes.filter((s) => s.overused).map((s) => `"${s.sceneHeader}"`).join(', ')}\n`
      : `\n[拆掉接球式问答] ${prePolishPingpong.advice} 涉及场景：${prePolishPingpong.scenes.filter((s) => s.overused).map((s) => `「${s.sceneHeader}」`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：空心动作调度检测，逼动作带戏
  const prePolishHollow = hollowAction(draft);
  const hollowHint = prePolishHollow.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Cut empty blocking] ${prePolishHollow.advice} Hollow beats: ${prePolishHollow.hits.slice(0, 4).map((h) => `"${h.snippet}"`).join('; ')}${prePolishHollow.repeatedGestures.length ? `; repeated: ${prePolishHollow.repeatedGestures.join(', ')}` : ''}\n`
      : `\n[删掉空心调度] ${prePolishHollow.advice} 空心动作：${prePolishHollow.hits.slice(0, 4).map((h) => `「${h.snippet}」`).join('；')}${prePolishHollow.repeatedGestures.length ? `；重复调度：${prePolishHollow.repeatedGestures.join('、')}` : ''}\n`)
    : '';
  // v2.80 创作能力闭环：情绪硬切检测，逼转折带触发事件
  const prePolishWhiplash = emotionWhiplash(draft);
  const whiplashHint = prePolishWhiplash.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Earn every emotional turn] ${prePolishWhiplash.advice} Problems: ${prePolishWhiplash.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[情绪转折要付价格] ${prePolishWhiplash.advice} 问题位置：${prePolishWhiplash.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：对白回声复述检测，逼回应带立场增量
  const prePolishEcho = echoDialogue(draft);
  const echoHint = prePolishEcho.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No parroting, no restating] ${prePolishEcho.advice} Echoes: ${prePolishEcho.hits.slice(0, 4).map((h) => `L${h.line} "${h.echoed}"`).join('; ')}\n`
      : `\n[别替观众复述] ${prePolishEcho.advice} 回声位置：${prePolishEcho.hits.slice(0, 4).map((h) => `第${h.line}行「${h.echoed}」`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：保姆式对白检测，逼背景信息拆进当下冲突
  const prePolishExpo = expositionDialogue(draft);
  const expoHint = prePolishExpo.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No exposition lectures] ${prePolishExpo.advice} Dumps: ${prePolishExpo.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[别跟观众科普] ${prePolishExpo.advice} 宣讲位置：${prePolishExpo.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：场景软收尾检测，逼冲突后硬切
  const prePolishSoftEnd = sceneSoftEnding(draft);
  const softEndHint = prePolishSoftEnd.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Cut on the tension, never exhale] ${prePolishSoftEnd.advice} Soft endings: ${prePolishSoftEnd.hits.slice(0, 4).map((h) => `"${h.sceneHeader}" L${h.endLine}`).join('; ')}\n`
      : `\n[冲突后硬切，别泄气] ${prePolishSoftEnd.advice} 软收尾：${prePolishSoftEnd.hits.slice(0, 4).map((h) => `「${h.sceneHeader}」第${h.endLine}行`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：台词情绪点名检测，逼情绪压进具体事实
  const prePolishEmoLabel = emotionLabelDialogue(draft);
  const emoLabelHint = prePolishEmoLabel.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never announce the emotion] ${prePolishEmoLabel.advice} Labeled lines: ${prePolishEmoLabel.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[别让角色自我介绍情绪] ${prePolishEmoLabel.advice} 点名位置：${prePolishEmoLabel.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：会议体轮转对白检测，群戏要有主次、抢话与长短
  const prePolishRoundRobin = roundRobinDialogue(draft);
  const roundRobinHint = prePolishRoundRobin.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Ensemble scenes are not board meetings] ${prePolishRoundRobin.advice} Read-through scenes: ${prePolishRoundRobin.hits.slice(0, 3).map((h) => `"${h.sceneHeader}" (${h.turnCount} turns)`).join('; ')}\n`
      : `\n[群戏不是圆桌会议] ${prePolishRoundRobin.advice} 读稿场次：${prePolishRoundRobin.hits.slice(0, 3).map((h) => `「${h.sceneHeader}」${h.turnCount}句`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：反问连珠检测，质问必须每问钉新事实
  const prePolishBarrage = rhetoricalBarrage(draft);
  const barrageHint = prePolishBarrage.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Interrogation is not a shouting contest] ${prePolishBarrage.advice} Barrages: ${prePolishBarrage.hits.slice(0, 3).map((h) => `${h.speaker} L${h.startLine}${h.endLine > h.startLine ? `-${h.endLine}` : ''} (${h.questionCount}Q)`).join('; ')}\n`
      : `\n[质问不是比嗓门] ${prePolishBarrage.advice} 反问连珠：${prePolishBarrage.hits.slice(0, 3).map((h) => `${h.speaker}第${h.startLine}${h.endLine > h.startLine ? `-${h.endLine}` : ''}行(${h.questionCount}问)`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：台词复述画面检测，台词不替镜头说话
  const prePolishMirror = mirrorVisualDialogue(draft);
  const mirrorHint = prePolishMirror.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Dialogue must not do the camera's job] ${prePolishMirror.advice} Restated shots: ${prePolishMirror.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[台词不替镜头说话] ${prePolishMirror.advice} 复述画面位置：${prePolishMirror.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：叙述者读心检测，脑子里的结论必须外化
  const prePolishMind = mindReadingNarration(draft);
  const mindHint = prePolishMind.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[There is no "she knew", only what she does] ${prePolishMind.advice} Mind-reading lines: ${prePolishMind.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[剧本里没有"她知道"，只有她做了什么] ${prePolishMind.advice} 读心结论位置：${prePolishMind.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：群体反应偷懒检测，群体必须落到具体一张脸
  const prePolishCrowd = crowdReaction(draft);
  const crowdHint = prePolishCrowd.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[The camera cannot film "everyone" — film one face] ${prePolishCrowd.advice} Lazy crowd lines: ${prePolishCrowd.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[镜头拍不了"所有人"，只能拍一张脸] ${prePolishCrowd.advice} 偷懒群体反应位置：${prePolishCrowd.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：环境共情检测，天气不替角色演情绪
  const prePolishFallacy = patheticFallacy(draft);
  const fallacyHint = prePolishFallacy.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Weather is a prop, not a performer] ${prePolishFallacy.advice} Personified-environment lines: ${prePolishFallacy.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[天气是道具，不是演员] ${prePolishFallacy.advice} 环境替演位置：${prePolishFallacy.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：全知预告检测，钩子必须此刻可拍
  const prePolishTease = omniscientTease(draft);
  const teaseHint = prePolishTease.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No "little did she know" — a hook is something we can film now] ${prePolishTease.advice} Omniscient-tease lines: ${prePolishTease.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[不许"她不知道的是"，钩子是此刻就能拍到的东西] ${prePolishTease.advice} 全知预告位置：${prePolishTease.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：努力过程概述检测，对抗必须当场演
  const prePolishGloss = effortGloss(draft);
  const glossHint = prePolishGloss.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No "after much effort she finally" — the struggle itself is the scene] ${prePolishGloss.advice} Glossed-struggle lines: ${prePolishGloss.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[不许"几经周折终于"，过程就是戏，不能打包给旁白] ${prePolishGloss.advice} 过程概述位置：${prePolishGloss.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：面部反应公式检测，反应必须专属且接动作
  const prePolishReaction = reactionCliche(draft);
  const reactionHint = prePolishReaction.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No "froze, frowned, bit her lip" kits — one tell per beat, then an action] ${prePolishReaction.advice} Reaction-formula lines: ${prePolishReaction.hits.filter((h) => h.kind === 'chain').slice(0, 4).map((h) => `L${h.line}`).join(', ')}${prePolishReaction.overusedTokens.length ? `; overused: ${prePolishReaction.overusedTokens.slice(0, 4).join(', ')}` : ''}\n`
      : `\n[不许"愣住+皱眉+咬唇"三件套，一个刺激只给一个专属反应，马上接动作] ${prePolishReaction.advice} 反应公式位置：${prePolishReaction.hits.filter((h) => h.kind === 'chain').slice(0, 4).map((h) => `第${h.line}行`).join('、')}${prePolishReaction.overusedTokens.length ? `；万能复用：${prePolishReaction.overusedTokens.slice(0, 4).join('、')}` : ''}\n`)
    : '';
  // v2.80 创作能力闭环：被动信息投喂检测，信息必须靠行动获得
  const prePolishDelivery = infoDelivery(draft);
  const deliveryHint = prePolishDelivery.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No plot arriving by text/call/messenger — information is seized, not received] ${prePolishDelivery.advice} Fed-by-channel lines: ${prePolishDelivery.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[不许剧情靠手机短信/新闻/下属汇报送上门，信息要靠人物行动撞破或抢来] ${prePolishDelivery.advice} 投喂位置：${prePolishDelivery.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：气氛直述检测，场景情绪只能靠人物演出来
  const prePolishAtmosphere = atmosphereTell(draft);
  const atmosphereHint = prePolishAtmosphere.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never announce the mood of a scene — make the most uncomfortable person act it out] ${prePolishAtmosphere.advice} Atmosphere-tell lines: ${prePolishAtmosphere.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[不许直接宣布"气氛尴尬/空气凝固"，写在场最不自在那个人的一个具体动作] ${prePolishAtmosphere.advice} 气氛直述位置：${prePolishAtmosphere.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：关键时刻打断逃场检测，冲突不许靠敲门声撤退
  const prePolishDodge = confrontationDodge(draft);
  const dodgeHint = prePolishDodge.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never kill a rising confrontation with a knock or a ringing phone — play it out in the same scene] ${prePolishDodge.advice} Dodge lines: ${prePolishDodge.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[关键对峙不许靠敲门声/电话铃撤退，要么当场打满，要么闯入者把冲突升级] ${prePolishDodge.advice} 打断逃场位置：${prePolishDodge.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：简历式自我介绍检测，身份不许靠嘴报
  const prePolishIntro = selfIntroDump(draft);
  const introHint = prePolishIntro.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never open with a résumé readout — no "my name is, I am N years old, the …"; reveal name and job through live trouble] ${prePolishIntro.advice} Résumé-intro lines: ${prePolishIntro.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[开场不许念简历——禁止"我叫X、今年X岁、是XX"，名字靠人喊，身份靠她正在处理的麻烦显出来] ${prePolishIntro.advice} 简历式介绍位置：${prePolishIntro.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：道理升华旁白检测，主题不许靠金句喊
  const prePolishMoral = moralNarration(draft);
  const moralHint = prePolishMoral.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never announce the theme — no "she finally understood" or standalone aphorisms; make the next action carry the lesson] ${prePolishMoral.advice} Moral-narration lines: ${prePolishMoral.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[主题不许靠旁白喊——禁止"她终于明白/原来从来都是"式金句，把领悟翻译成一个拦不住的具体动作] ${prePolishMoral.advice} 道理升华位置：${prePolishMoral.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：空口威胁检测，狠话必须当场兑现
  const prePolishThreat = emptyThreat(draft);
  const threatHint = prePolishThreat.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[A threat is a strike, not an IOU — cut "you will regret this / this is not over"; either the threatener moves in the same beat or names an exact consequence with a deadline] ${prePolishThreat.advice} Empty-threat lines: ${prePolishThreat.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[狠话不许打欠条——删掉"你给我等着/你会后悔的"，要么出口同一拍就动手，要么把后果和死线说死] ${prePolishThreat.advice} 空口威胁位置：${prePolishThreat.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：时间跳转兑付检测，跳转只换场不替冲突结账
  const prePolishJump = timeJumpPayoff(draft);
  const jumpHint = prePolishJump.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[A time jump changes scenes, never cashes out results — no "three days later, the papers were signed"; stage the decisive scene itself] ${prePolishJump.advice} Time-jump-payoff lines: ${prePolishJump.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[跳转不许替冲突结账——删掉"三天后她已经签好字/一年后公司上市"，签字决裂翻盘必须正面写，跳转后第一拍是人物在做事] ${prePolishJump.advice} 跳转兑付位置：${prePolishJump.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：情绪道具拐杖检测，摔杯灌酒淋雨不许当情绪快捷键
  const prePolishCrutch = emotionPropCrutch(draft);
  const crutchHint = prePolishCrutch.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Props are not emotion ATMs — no third smashed glass / drinking binge / rain walk; every prop move must force an irreversible change] ${prePolishCrutch.advice} Emotion-crutch lines: ${prePolishCrutch.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[道具不是情绪提款机——摔杯/灌酒/淋雨/撕照片/捏杯子全片各最多两次，每次都要让局势不可逆地变掉] ${prePolishCrutch.advice} 道具拐杖位置：${prePolishCrutch.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：情绪宣泄套路检测，最大音量每集只准一次且必须换动作
  const prePolishVent = emotionVentCliche(draft);
  const ventHint = prePolishVent.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Maximum volume is rationed — no third sobbing/screaming/kneeling burst; one peak vent per episode and it must force an irreversible action] ${prePolishVent.advice} Emotion-vent lines: ${prePolishVent.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[情绪最高档每集只准一次——痛哭/嘶吼/跪求/自扇第三次观众就免疫，且宣泄后人物必须自己做出不可逆的选择，不是等人来哄] ${prePolishVent.advice} 宣泄套路位置：${prePolishVent.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：动作回声台词检测，镜头演过的不许再用嘴确认
  const prePolishActionEcho = actionEchoDialogue(draft);
  const actionEchoHint = prePolishActionEcho.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never read the action back — no "You hit me?" right after the slap; one reality-check beat per script max, otherwise silence or a demand beyond the frame] ${prePolishActionEcho.advice} Action-echo lines: ${prePolishActionEcho.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[动作不复读——巴掌扇完不许接"你打我？"，合同撕完不许接"你撕了？"；全片最多一次确认现实的节拍，其余要么沉默要么直接要价/宣布下一步] ${prePolishActionEcho.advice} 动作回声位置：${prePolishActionEcho.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：撞听秘密检测，白捡的真相不抓人
  const prePolishEavesdrop = eavesdropDump(draft);
  const eavesdropHint = prePolishEavesdrop.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Secrets must cost something — no walking to a door and receiving the full conspiracy (names, method, timetable) in one spoken package; make her stake it out, nearly get caught, or record at risk, else let the conspirators speak in half-sentences] ${prePolishEavesdrop.advice} Eavesdrop-dump lines: ${prePolishEavesdrop.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[真相不许白捡——主角走到门口，反派不许用完整句子把人名/手法/时间表打包宣讲；要么提前蹲守、屏住呼吸、差点被发现、冒险录音，要么让屋里只说半句黑话，剩下的靠她去诈去换去赌] ${prePolishEavesdrop.advice} 撞听位置：${prePolishEavesdrop.hits.filter((h) => h.charged && !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：自怜连祷检测，观众追随有脊梁的人，不追诉苦的人
  const prePolishSelfPity = selfPityLitany(draft);
  const selfPityHint = prePolishSelfPity.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No kneeling suffering-report — no "my whole life / why me / what did I do wrong" litanies; keep one hardest fact, then a costly decision or a cold turn; pity is cheap, a broken-but-standing protagonist is not] ${prePolishSelfPity.advice} Self-pity lines: ${prePolishSelfPity.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.startLine}`).join(', ')}\n`
      : `\n[不许跪着开苦难报告会——"我这辈子苦/老天爷为什么/我做错了什么"不许连祷；留一个最硬的事实，立刻接一个有代价的决定或冷笑转身；惨而不倒，不是惨给人看] ${prePolishSelfPity.advice} 自怜连祷位置：${prePolishSelfPity.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.startLine}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：反派不打自招检测，真相比主角的追查线便宜就全废
  const prePolishVillain = villainOverconfession(draft);
  const villainHint = prePolishVillain.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No villain narrator in disguise — a vague accusation ("was it you?") must never buy a full file: method, accomplices, cold cases, motive AND the next move in one speech. Make him deny, deflect, counter-attack; admit only what is already proven on the table, never volunteer the next move] ${prePolishVillain.advice} Over-confession lines: ${prePolishVillain.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[反派不许替编剧发卷宗——一句空泛的"是不是你"不许换来手法/同伙/旧案/动机/下一步打包招供；让他抵赖、反问、倒打一耙，只认已经拍在桌上的证据，"下一步"半个字不许主动交代] ${prePolishVillain.advice} 不打自招位置：${prePolishVillain.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：廉价原谅检测，血海深仇不能三行清零
  const prePolishCheapForgive = cheapForgiveness(draft);
  const cheapForgiveHint = prePolishCheapForgive.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No three-line reconciliation after blood debt — a death, prison frame, abandoned child or betrayal cannot be wiped by "I was weak" + a hug + "I forgive you". Grave harm requires actual payment (turn himself in, jail, restitution, signed away assets) or years plus a named-deed apology; heavy harm at minimum needs a specific excuse-free apology. Forgiveness after family pressure only lands when the victim has first refused and later collected the price] ${prePolishCheapForgive.advice} Cheap-forgiveness lines: ${prePolishCheapForgive.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[血海深仇不许三行清零——人命/冤狱/骨肉/暴力级伤害，不能用"一时糊涂"+一个拥抱+"我原谅你"兑付；必须先付实际代价（自首/判刑/退赔/净身出户/放弃继承），或经年累月后指名罪行的道歉。施压式和解（他毕竟是你爸）必须先拒绝、拉开时间、收够代价才能回头] ${prePolishCheapForgive.advice} 廉价原谅位置：${prePolishCheapForgive.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：证人无动机倾倒检测，知情者不能一句空问端出冷案套餐
  const prePolishGratuity = witnessGratuity(draft);
  const gratuityHint = prePolishGratuity.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No free data dump from a witness — a butler, an old nurse or a fired employee must not hand over the whole cold-case bundle (the deed, where the proof is hidden, the code, the next move, the accomplice) just because the protagonist asks "what happened" once, or with no ask at all. The protagonist must earn each fact: press and confront, name a price, promise protection, or give the witness a real grudge, a debt or a fear of being silenced. A fearful pause only excuses one grudged fact, never the whole bundle] ${prePolishGratuity.advice} Gratuitous-dump lines: ${prePolishGratuity.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[知情人不许零成本倒货——管家/老护士/离职员工不能因为一句"当年怎么回事"、甚至没人问，就把冷案套餐（罪行+证据位置+密码+下一步+同伙）一锅端出；每条情报都要主角付代价：逼问到墙角、亮证据开价、给安全承诺，或让证人有真旧债/复仇/将被灭口的动机。迟疑压低声音只能放过一条挤出来的线索，套餐照端照样判] ${prePolishGratuity.advice} 无动机倾倒位置：${prePolishGratuity.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：集尾预告口播检测，剧本正文不是节目导视
  const prePolishPreview = previewVoiceover(draft);
  const previewHint = prePolishPreview.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[No TV-guide voiceover inside the script — delete every "next episode preview", "to be continued", "stay tuned" card and every subscribe/like/follow pitch; no character in the scene can address the feed. Closing narration must never pre-announce next episode's plot in future tense: end on one filmable present-tense action or an interrupted line, and let the audience wonder what happens next] ${prePolishPreview.advice} Preview-voiceover lines: ${prePolishPreview.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[剧本正文不许出现节目导视——删掉所有"下集预告/未完待续/敬请期待"卡片，删掉关注/点赞/订阅/追更口播，戏里的人不可能对着观众喊话；集尾叙述也不许用将来时提前播报下一集的剧情，停在一个正在发生、能拍的强动作或被打断的台词上，把"接下来会怎样"留给观众] ${prePolishPreview.advice} 预告口播位置：${prePolishPreview.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：无因立场横跳检测，改口必须挣来
  const prePolishStance = stanceFlip(draft);
  const stanceHint = prePolishStance.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[A reversed decision must be earned — after a character nails a choice shut ("I'm not signing", "I won't go back", "I'm not helping you"), they must not flip a few lines later on a bare "fine" with no pressure in between. Put a real clash between the vow and the reversal: evidence slammed on the table, a named price, a threat that lands, or new information; and let the reversal line carry the terms ("I'll sign, but first you have to…"). Do not reverse offscreen or on one weak plea] ${prePolishStance.advice} Unearned flips: ${prePolishStance.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `L${h.fromLine}→L${h.toLine} ${h.speaker}`).join(', ')}\n`
      : `\n[立场反转必须挣来——角色刚把决定钉死（"我绝不签字""我不回去""我不帮你"），没过几句不许凭一个干巴巴的"好吧"就反做。死誓与改口之间必须有一场真正的交锋：证据拍上桌、代价谈清楚、威胁落地、或新信息当场砸到；反做的台词要带着交换条件（"我签，但你必须先……"），不能在场外或一句轻描淡写的求情里转弯] ${prePolishStance.advice} 无因横跳位置：${prePolishStance.hits.filter((h) => !h.rescued).slice(0, 4).map((h) => `第${h.fromLine}→${h.toLine}行${h.speaker}`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：后手空降检测，制胜道具必须提前挂枪
  const prePolishUnplanted = unplantedAsset(draft);
  const unplantedHint = prePolishUnplanted.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[A winning backup cannot appear for the first time at the moment it wins — no "luckily I recorded everything", "I already called the police, they are here", "my lawyer is downstairs with the contract you signed" unless the audience saw the setup earlier (a thumb on record, a phone call stepped away for, a folder packed in advance). Plant the asset, let the opponent nearly spot or break it, then pay it off; if it cannot be planted, it must not wipe the board in one move — leave a gap that forces one more hard choice] ${prePolishUnplanted.advice} Unplanted assets: ${prePolishUnplanted.hits.filter((h) => !h.planted).slice(0, 4).map((h) => `L${h.line} ${h.asset}`).join(', ')}\n`
      : `\n[决定胜负的后手不许在翻盘那一刻才第一次出现——"幸好我录了音""我已经报警了，警察马上到""我的律师就在楼下，这份合同你签过字"，除非观众此前亲眼见过铺垫（按下录音键、躲出去打电话、提前把文件塞进包里）。先挂枪、最好让对手差点发现或毁掉、再打响；来不及埋线就别让后手一键清场，留个破绽逼主角再做一个选择] ${prePolishUnplanted.advice} 空降后手位置：${prePolishUnplanted.hits.filter((h) => !h.planted).slice(0, 4).map((h) => `第${h.line}行(${h.asset})`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：旁白翻译机检测，潜台词不许叙述者报答案
  const prePolishSubtextErase = subtextErase(draft);
  const subtextEraseHint = prePolishSubtextErase.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never let narration translate the line just spoken — no "his words were a warning", "the message was clear", "she heard the threat underneath his tone" right after dialogue. When the line hides its meaning, cut the footnote: let the silence, the unheld gaze, the wrong answer, or the other character's physical reaction (a hand stopping over the cup) do all the work; the audience must decode it themselves] ${prePolishSubtextErase.advice} Footnote lines: ${prePolishSubtextErase.hits.slice(0, 4).map((h) => `L${h.line}`).join(', ')}\n`
      : `\n[台词把意思藏好后，叙述不许跟上去做阅读理解——台词旁边禁写"这话分明是在警告她""她听出了话里的逐客令""意思再明白不过"。让停顿、没接住的眼神、答非所问、或对方的动作反应（端茶的手停了半拍）自己生效，潜台词要让观众自己听出来，不许旁白报答案] ${prePolishSubtextErase.advice} 翻译机位置：${prePolishSubtextErase.hits.slice(0, 4).map((h) => `第${h.line}行`).join('、')}\n`)
    : '';
  // v2.80 创作能力闭环：强离场收尾依赖检测，末拍留在牌桌上
  const prePolishExit = exitCliche(draft);
  const exitHint = prePolishExit.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Do not let a slammed door end every fight — multiple scenes already close on someone storming/slamming/marching out. End the scene on the table instead: evidence flung out, an unanswered question, a line cut off, a new threat; if the character must leave, pin them at the door with one line or open it on the wrong person. At most one hard exit per episode] ${prePolishExit.advice} Exit-ending scenes: ${prePolishExit.hits.slice(0, 4).map((h) => `${h.sceneHeader} L${h.endLine}`).join('; ')}\n`
      : `\n[别让每场吵架都靠摔门打句号——本集已有多场末拍落在摔门/夺门/拂袖离场。末拍要留在牌桌上：甩出来的物证、没人回答的问题、被打断的半句话、新出现的威胁；人要走就让他走到门口被一句话钉住，或开门看见不该出现的人。同集强离场最多一次] ${prePolishExit.advice} 离场收尾场：${prePolishExit.hits.slice(0, 4).map((h) => `${h.sceneHeader}(第${h.endLine}行)`).join('；')}\n`)
    : '';
  // v2.80 创作能力闭环：电话传话机检测，画外事件不许只靠电话转述
  const prePolishPhone = phoneRelay(draft);
  const phoneRelayHint = prePolishPhone.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[Never deliver an offscreen event through a one-sided relay call — no "What?! He is dead? Which hospital? I will be right there!" and no parroting the news back ("So he signed the papers?"). Cut to the event and show it; if the call must stay, give one shard ("He is gone.") and hang up so the character moves with the question unasked] ${prePolishPhone.advice} Relay calls: L${prePolishPhone.hits.map((h) => h.anchorLine).join(', ')}\n`
      : `\n[重要事件不许只在单边电话里转述——禁写"什么？！他死了？在哪家医院？我马上到！"三连，禁写"你说……他把合同签了？"把新闻念回。直接切到现场拍；必须保留通话就只给半句话（"人没了。"）然后挂断，让主角带着没问完的问题行动] ${prePolishPhone.advice} 传话电话：第${prePolishPhone.hits.map((h) => h.anchorLine).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：假选择检测，两难必须有挣扎和代价
  const prePolishChoice = fakeChoice(draft);
  const fakeChoiceHint = prePolishChoice.issues.length > 0
    ? (hookLang === 'en'
      ? `\n[A staged dilemma must hurt both ways — never let a "choose A or B" ultimatum get an instant "Fine, I will sign" with no struggle and no loss shown afterward. Before the answer stage one beat of cost (long silence, whitened knuckles, pen set down); after it, pay the loss (the recital missed, the empty bed); or have the character flip the board ("I will take both", "Why should I have to choose?"). Leaving the choice unanswered as a hook beats a weightless answer] ${prePolishChoice.advice} Weightless choices: L${prePolishChoice.hits.map((h) => h.line).join(', ')}\n`
      : `\n[两难必须"怎么选都疼"——禁写"孩子和公司只能保一个"紧跟一句毫不犹豫的"我签"，中间无挣扎、之后无代价。拍板前给一个挣扎节拍（沉默/攥到发白的手/放下又拿起的笔），拍板后兑付失去（没赶到的家长会/空着的病床）；高级写法是掀棋盘（"我两个都要""凭什么只能我选？"）。当场不答、把选择悬成钩子也比轻飘飘秒答强] ${prePolishChoice.advice} 假选择：第${prePolishChoice.hits.map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：括注导演检测，情绪条不许挂满 cue 行
  const prePolishParen = parenOverdirect(draft);
  const parenHint = prePolishParen.hits.length > 0
    ? (hookLang === 'en'
      ? `\n[Stop directing every line from a parenthetical — (coldly) (smirking) (raising an eyebrow) are not emotion hotkeys. Keep wrylies to a handful per script and only where delivery contradicts the line; put the feeling into word choice or one concrete action (push the invitation back, do not write "smirk coldly"); when two acting cues stack in one parenthetical, split them into an action beat] ${prePolishParen.advice.join(' ')} Over-directed cues: L${prePolishParen.hits.map((h) => h.line).join(', ')}\n`
      : `\n[台词别每句挂表演指导括注——（冷笑）（挑眉）（勾唇）不是情绪快捷键。全片括注控制在个位数，只留给"笑着说狠话"这种台词与表演相反的节拍；把情绪写进用词选择和一个具体动作（把请帖推回去，而不是写"冷笑"）；一个括注挤两三个表情语气时，拆成独立动作行] ${prePolishParen.advice.join(' ')} 过度指导括注：第${prePolishParen.hits.map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：全称指控检测，吵架必须用具体事件当刀子
  const prePolishAccusation = abstractAccusation(draft);
  const accusationHint = prePolishAccusation.unrescuedCount >= 2
    ? (hookLang === 'en'
      ? `\n[Fights cannot be conducted in universal verdicts — "You never care", "All you ever think about is work", "Every single time" cannot be proven or disproven, so the scene only allows denial or apology and spins in place. Replace the verdict with one specific event as the knife (a time, a place, an object): not "you never care about this family" but "last Wednesday at the recital, your seat was empty again"; let the accused answer with a fact, not a denial, so the argument moves] ${prePolishAccusation.advice.join(' ')} Fact-free accusations: L${prePolishAccusation.hits.filter((h) => !h.anchored).map((h) => h.line).join(', ')}\n`
      : `\n[吵架不许只甩全称判断——"你从来不管家""你心里只有公司""每次都是我让步"无法证实也无法反驳，对方只能否认或道歉，戏原地打转。把全称句换成一次具体事件当刀子（时间/地点/物件任选其一）：不是"你从来不管家"，而是"上周三家长会，座位上又是空的"；让被指责方用事实回击而不是干巴巴否认，吵架才能往前推] ${prePolishAccusation.advice.join(' ')} 零事实全称指控：第${prePolishAccusation.hits.filter((h) => !h.anchored).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：廉价共情检测，安慰要笨拙或掏自己的伤口
  const prePolishEmpathy = cheapEmpathy(draft);
  const empathyHint = prePolishEmpathy.unrescuedCount >= 2
    ? (hookLang === 'en'
      ? `\n[Comforters must not talk like therapists — "I understand how you feel", "That must have been hard", "It is okay to cry", "Your feelings are valid" dispensed with zero awkwardness turn the speaker into an emotional vending machine. Make the comfort clumsy (the wrong tissue, water that is too hot, sitting in silence with nothing to say), or have the comforter pay with a wound of their own ("When my father died, I fell asleep at the funeral home"). One concrete action beats three empathy lines] ${prePolishEmpathy.advice.join(' ')} Therapist scripts: L${prePolishEmpathy.hits.filter((h) => !h.rescued && !h.professional).map((h) => h.line).join(', ')}\n`
      : `\n[安慰不许写成心理咨询师话术——"我理解你的感受""你一定很难受""想哭就哭""你有权难过"零磕绊地派发，说话人就成了情绪按摩椅。让安慰变笨拙（递错纸巾、水太烫、沉默半天只憋出一句"我不会说"），或让安慰者掏自己的旧伤（"我爸走那年，我在殡仪馆睡着的"）。一个具体动作胜过三句共情] ${prePolishEmpathy.advice.join(' ')} 咨询师式共情：第${prePolishEmpathy.hits.filter((h) => !h.rescued && !h.professional).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：闲玩道具标签检测，指尖道具第3次出场必须做功
  const prePolishFidget = fidgetProp(draft);
  const fidgetHint = prePolishFidget.overusedFamilies.length > 0
    ? (hookLang === 'en'
      ? `\n[Idle props are character stickers, not depth — the CEO twirling his pen, the wife spinning her wedding band, the patriarch working his beads read as detail the first time, but by the third idle appearance the audience knows you could not find an action. A prop either works or gets cut: the spinning pen slams onto the contract next beat, gets snatched, or stops above the signature line; the worried ring comes off and gets thrown back. Give each character at most one or two idle props in the whole script, and the second appearance must change the scene. Put the power into choices and speech rhythm, not into the fingers] ${prePolishFidget.advice.join(' ')} Over-recycled idle props: L${prePolishFidget.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[闲玩道具是性格贴纸不是城府——大佬转钢笔、怨妇摩挲婚戒、老爷子盘核桃，第一次是细节，第三次观众就知道你找不到动作了。道具要么干事要么删：转着的钢笔下一拍拍在合同上、被夺走、在签名处停住；摩挲的戒指要么摘下扔还，要么被一把攥住。同一人物全片只允许一两件闲玩物，第二次出场必须改变局面。把深写进选择和台词节奏，别写进手指] ${prePolishFidget.advice.join(' ')} 空转道具：第${prePolishFidget.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：空转誓言检测，复仇宣言必须落到刀与死线
  const prePolishVow = emptyVow(draft);
  const vowHint = prePolishVow.unrescuedCount >= 2
    ? (hookLang === 'en'
      ? `\n[Trailer vows are not scenes — "I will make him pay", "revenge will be mine", "I will take back everything he stole" announce hatred with no weapon, no arena, and no deadline, so the line can never be proven false and the character grows hatred instead of a brain. Cut the slogan: name the leverage inside the line ("Tomorrow at the board meeting, he signs in front of every shareholder"), or keep her silent and let the first move carry it — calling the lawyer, pulling the recording, sealing the report in an envelope. One vow in the whole script, at the moment she actually stakes a cost; end episodes on an action or a choice, never on a slogan] ${prePolishVow.advice.join(' ')} Plan-less vows: L${prePolishVow.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[预告片誓言不是戏——"我要让他付出代价""此仇不报誓不为人""我失去的会亲手拿回来"只宣告恨意，没有刀、没有战场、没有死线，这句话永远不会被证伪，人物只长恨意不长脑子。删掉口号：要么台词里点出筹码和期限（"明天董事会，我要他当着所有股东的面签字"），要么让她闭嘴，用第一步动作承担——约律师、调录音、把报告封进信封。全片最多留一次誓言，放在她真的押上代价的节点；集尾用动作和选择钩，不用口号钩] ${prePolishVow.advice.join(' ')} 空转誓言：第${prePolishVow.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.114 创作能力闭环：道歉循环检测，加害方反复道歉必须落到具体赎罪
  const prePolishApology = apologyLoop(draft);
  const apologyHint = prePolishApology.unrescuedCount >= 2
    ? (hookLang === 'en'
      ? `\n[Apology loops are not atonement — "I'm sorry", "I was wrong", "please forgive me" repeated three or more times in a single scene with no surrender, no restitution, no return of shares, no confession — the loop drains dramatic tension with empty words, the audience stops believing the apology will ever cost him anything. Cut the repetition: name the cost inside the line ("I'll turn myself in tomorrow", "I'll return the shares by Friday"), or keep him silent — watching him pack for surrender, sign over the equity, write the confession hits harder than a hundred "I'm sorry". One apology per scene, at the moment he actually bears the cost] ${prePolishApology.advice.join(' ')} Apology loops: L${prePolishApology.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[道歉循环不是赎罪——"对不起""我错了""原谅我"同场景反复念三遍以上，没有自首、没有赔偿、没有退股、没有认罪声明，把戏剧张力用空话掏空，观众再也不信他会真的付出代价。删掉重复道歉：要么台词里点出代价（"我明天去派出所自首""周五前把股权全部退还给你"），要么让他闭嘴——观众看见他收拾行李去自首、把股权过户、写认罪声明，比听见一百遍"对不起"都重。同场景内道歉最多留一次，放在他真的承担代价的节点] ${prePolishApology.advice.join(' ')} 道歉循环：第${prePolishApology.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：回忆杀拐杖检测，记忆要当扳机别当床垫
  const prePolishFlash = flashbackCrutch(draft);
  const flashHint = prePolishFlash.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Flashbacks are shortcuts, not scenes — the first is information, the second is a rerun, the third and the audience reaches for the skip button. A wholesale replay of the same flashback is unforgivable, and a 4+ line montage that never lands on a present-day action is memory doing the work the scene should do. Replace the replay with something playable now: let the past ferment in the present scene — she freezes touching the same wedding contract, the antagonist re-enacts the old cruelty — or compress it to one line and one prop ("This dress — same as three years ago"). Never replay the same flashback twice; after every flashback cut back to the present and land a concrete action. Memory must be a trigger, not a mattress] ${prePolishFlash.advice.join(' ')} Idle flashbacks: L${prePolishFlash.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[回忆是快捷方式不是戏——第一次闪回是信息，第二次是复习，第三次观众就去拖进度条了。同一回忆整段重播不可原谅，超过三行的蒙太奇却不接当下动作，就是记忆替场景干活。把重播换成当下可演的戏：让往事在现场景发酵——她摸到同款婚书当场僵住、对手复刻当年的施害动作——或压成一句台词一个道具（"这裙子，和三年前那件一样"）。同一回忆全剧只播一次；每次闪回后必须切回当下、立刻落地一个具体动作。让记忆当扳机，别当床垫] ${prePolishFlash.advice.join(' ')} 空转闪回：第${prePolishFlash.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：事故心动检测，火花必须来自选择不靠地心引力
  const prePolishSpark = accidentalSpark(draft);
  const sparkHint = prePolishSpark.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Attraction cannot be batch-produced by physical accidents — stumble into arms, spin into his chest, brake into her embrace. The first is a trope, the third is embarrassment. Keep one accident as comedy if you must, but sparks must come from choices: she falls for something he did, not something gravity did. After an accident, write awkwardness and distance — she pushes off, both step back and straighten their jackets — never lingering eye contact and a skipped heartbeat. If someone must catch her, hand the next beat to a concrete action: she stands on his foot, throws his jacket back at him, and moves] ${prePolishSpark.advice.join(' ')} Accident sparks: L${prePolishSpark.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[心动不许靠物理事故批发——摔倒必被接住、转身必撞进怀里、刹车必扑入怀，第一次是桥段，第三次观众替你尴尬。事故可以留一次当喜剧调味，但火花必须来自选择：她看清他做的某件事才心动，他为她挡下什么才靠近。事故发生后写尴尬与拉开距离（她推开他、两人后退半步整理衣角），别写四目相对心跳漏拍；实在要用接住，下一拍就交给具体动作——她踩着他的脚站起来、把外套扔回给他，别在怀里多待一秒] ${prePolishSpark.advice.join(' ')} 事故心动：第${prePolishSpark.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：通讯失灵拐杖检测，关键信息不许靠联系不上来扣押
  const prePolishCommFail = commFailCrutch(draft);
  const commHint = prePolishCommFail.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Comm failure is not a plot valve — no signal the moment she dials her lawyer, dead battery the moment he tries to call an ambulance, the line cuts the second the truth is due. The audience sees the author parking the information. Give the characters a plan B: send a text, leave a voicemail, send word with someone, go in person — the message must get out. Or make the failure cost something real: because the call never connected, she missed the last goodbye, he carried the blame for three years. Failure must change the story, not stretch the misunderstanding into next episode. A dead zone is allowed if it is established as a rule up front — never "conveniently" right when the plot needs it] ${prePolishCommFail.advice.join(' ')} Comm-fail beats: L${prePolishCommFail.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[通讯失灵不许当万能剧情阀门——正要打给律师就没信号、正要报警就没电、正要说真相就断线，观众看穿这是作者扣押信息的快捷方式。要么给角色换方案的动作：发短信、留语音、托人带话、当面说、亲自跑一趟，信息必须送出去；要么让失灵付出真代价：因为联系不上，她错过了最后一面、他背了三年黑锅——失灵必须改变故事走向，而不只是把误会拖到下一集。深山断网可以有，但要在一开始就立成规则，别等剧情要用时才"恰好没信号"] ${prePolishCommFail.advice.join(' ')} 通讯失灵：第${prePolishCommFail.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：灌醉吐真言检测，机密不许靠酒精度数批量解锁
  const prePolishDrunk = drunkTruth(draft);
  const drunkHint = prePolishDrunk.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Getting someone drunk is not a master key — ply the witness with three drinks and the decade-old secret pours out in neat bullet points. Real drunk people ramble, resist, pass out; they do not deliver an organized debrief. Make the truth cost something: trade for it, or have him choose to speak. Drunk talk is a lead at best — next day he denies it. If you must use drink, write resistance: he clamps down on the one thing that matters even while plastered] ${prePolishDrunk.advice.join(' ')} Drunk-truth beats: L${prePolishDrunk.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[灌醉不许当万能钥匙——三杯下肚，藏了十年的秘密条理清晰地全交代了，情报的锁扣被简化为酒精度数。真实的人醉了语无伦次、抵抗、昏睡，唯独不会做完整汇报。让真话贵起来：要么靠筹码交换，要么让当事人自己选择开口；醉话最多当线索——第二天他矢口否认。非要写酒，就写抵抗：他一边醉一边死咬关键的那一句，说漏的全是边角料] ${prePolishDrunk.advice.join(' ')} 灌醉吐真言：第${prePolishDrunk.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：看一眼破案检测，推理的价值在路径不在终点
  const prePolishDeduce = instantDeduction(draft);
  const deduceHint = prePolishDeduce.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A glance is not an argument — the detective sweeps the room and instantly announces the killer with zero evidence and zero reasoning steps shown. Brilliance is the path, not the verdict: stop him at a concrete clue, let a wrong hypothesis get overturned, land the conclusion in an uncertain voice, and make every solution cost something — a wasted trip, a wrongful arrest. Keep the flash of insight only if you show its trigger] ${prePolishDeduce.advice.join(' ')} Instant-deduction beats: L${prePolishDeduce.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[看一眼不是论证——主角扫一圈现场就当场宣布凶手，零物证零推理步骤，聪明全靠嘴宣布。推理的价值在路径不在终点：让他在具体物证前停下，让错误假设被推翻一次，让结论以不确定的语气落地，让每次破案都付出代价——跑一趟、错抓一个人；灵光一现要写清触发物] ${prePolishDeduce.advice.join(' ')} 看一眼破案：第${prePolishDeduce.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：万能档案检测，档案库不是许愿池
  const prePolishRecords = recordsOnDemand(draft);
  const recordsHint = prePolishRecords.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The archive is not a vending machine — every lookup lands exactly the needed fact, with no dead end, no wait, no clearance wall. Make every fact cost something: a failed search, a three-day transfer window during which the evidence moves, a sealed file she can only get by conning the clerk; sometimes let the search return the wrong thing] ${prePolishRecords.advice.join(' ')} Records-on-demand beats: L${prePolishRecords.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[档案库不是许愿池——每次调取都精确命中所需情报，没有查空、没有等待、没有权限碰壁，情报随要随有。让每条情报付出代价：一次查空、一次排期等待（就在等待里证据被转移）、一道只能靠智取闯过的权限墙；偶尔让查到的不是想要的——查转账记录翻出弟弟的住院单] ${prePolishRecords.advice.join(' ')} 一查必中：第${prePolishRecords.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.81 创作能力闭环：说曹操曹操到检测，登场要有迹可循
  const prePolishWalkIn = walkInTiming(draft);
  const walkHint = prePolishWalkIn.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Characters must not materialize the moment they are mentioned — no summons, no appointment, no doorbell between the talk and the arrival. Give every entrance a trail: summon them a beat early, plant a physical cue (doorbell, knock, front-desk announcement), or give the arrival a motive — already outside, overheard the talk, came at the appointed hour] ${prePolishWalkIn.advice.join(' ')} Walk-in timing beats: L${prePolishWalkIn.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[人物不能刚被谈起就凭空出现——谈论与登场之间没有召唤、没有预约、没有门铃，登场全靠巧合而非剧情的原因。让每一次登场有迹可循：提前一拍写召唤，给物理前奏（门铃、敲门、前台通报），给登场者动机——本来就在门外、听到了谈话、按约定时间赴约] ${prePolishWalkIn.advice.join(' ')} 巧合登场：第${prePolishWalkIn.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.82 创作能力闭环：随叫随到工具人检测，帮忙要有代价
  const prePolishHelp = helpOnDemand(draft);
  const helpHint = prePolishHelp.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Every ask must meet friction — no more instant unconditional yes. Allies have limits, experts have rates, and even a yes carries a debt or a deadline. Make the favor cost something, or let the favor breed new trouble] ${prePolishHelp.advice.join(' ')} Help-on-demand beats: L${prePolishHelp.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[求助不能秒答应——朋友有难处，专家有报价，就算答应也要挂上人情债或时间账。让每次帮忙都有代价，或让帮忙本身制造新麻烦；援兵不是随叫随到的自动售货机，观众揪的正是"他还能不能撑到下一援"这口气] ${prePolishHelp.advice.join(' ')} 零摩擦援兵：第${prePolishHelp.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.83 创作能力闭环：信息容器延迟开启检测，容器里的信息要按时释放
  const prePolishDeferred = delayedReveal(draft);
  const deferredHint = prePolishDeferred.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A container's secret has a shelf life — no re-hesitating over the same letter, tape or drive. Open it and let the contents detonate the plot, or give the fear a concrete price and cash it within two or three scenes] ${prePolishDeferred.advice.join(' ')} Deferred-reveal beats: L${prePolishDeferred.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[容器里的信息要按时释放——同一封信、同一盘录音不许反复犹豫。要么让角色当场拆开把内容炸出来推动剧情，要么给"不敢拆"一个具体代价并在两三场内兑现；观众等的是信封里的雷，不是看角色围着信封打转] ${prePolishDeferred.advice.join(' ')} 容器拖延：第${prePolishDeferred.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.84 创作能力闭环：初见托付检测，信任要有来路，不许一拧就开
  const prePolishTrust = instantTrust(draft);
  const trustHint = prePolishTrust.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Trust has a checkout counter — a near-stranger holding your ledger, your kid or your life makes every betrayal free. Give each handoff a pedigree: history, verification or collateral, or let a third character voice the doubt] ${prePolishTrust.advice.join(' ')} Instant-trust beats: L${prePolishTrust.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[信任要有收银台——认识几天就托付公章、孩子、命脉，背叛就不值钱。给每次托付补来路：历史、验证或抵押，或者让第三方替观众问一句"你们认识才几天"] ${prePolishTrust.advice.join(' ')} 初见托付：第${prePolishTrust.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.85 创作能力闭环：认亲白给检测，血缘揭露要有成本，不许三行内秒被接纳
  const prePolishKinship = instantKinship(draft);
  const kinshipHint = prePolishKinship.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Blood reveals need a checkout counter too — a twenty-year search cannot end in a hug three lines later with DNA, keepsakes and doubt all waived. Make the claim earn its acceptance: verification, resistance or an impossible choice before the embrace] ${prePolishKinship.advice.join(' ')} Instant-kinship beats: L${prePolishKinship.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[血缘揭露也要有收银台——二十年的寻找不能三行内用一个拥抱结账，DNA、信物、挣扎全免。认亲要么先过求证关，要么先过心理关：让"我不信"至少停一拍，让接纳伴随代价或选择，而不是眼泪一出来户口本就自动生效] ${prePolishKinship.advice.join(' ')} 认亲白给：第${prePolishKinship.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.86 创作能力闭环：晕倒阀门检测，生理突发要有来路有代价，不许反复掐断关键信息
  const prePolishFaint = faintOnCue(draft);
  const faintHint = prePolishFaint.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Fainting is not a plot valve — a collapse exactly when the truth is due is the author parking information. Give the faint a medical pedigree or a real cost: she wakes days later to find the world moved on; or let her finish the sentence and make the listeners carry it] ${prePolishFaint.advice.join(' ')} Faint-on-cue beats: L${prePolishFaint.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[晕倒不是剧情阀门——每次都昏在关键词出口前的半秒，观众就开始掐表等她倒。给晕倒生理来路（旧疾铺垫、医生诊断、身体超支）或真代价（再睁眼已是三天后，世界已经变了），或者让她把话说完再倒——听见的人从此背负信息，比沉默更重] ${prePolishFaint.advice.join(' ')} 晕倒阀门：第${prePolishFaint.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.86 创作能力闭环：每次都晚一步检测，错过要有真代价或立即被行动接住，不许反复用"刚走"拖延
  const prePolishLate = alwaysLate(draft);
  const lateHint = prePolishLate.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Near-miss is not a plot valve — every arrival lands moments after the person left, the train pulled out, the bed was stripped. Make the miss cost something real, or catch it with action: chase out, leave a note, call ahead; never let the character just sigh and move on] ${prePolishLate.advice.join(' ')} Always-late beats: L${prePolishLate.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[错过不是剧情阀门——每次赶到人刚走、冲到站台车刚开，观众就看穿作者在按秒表拖戏。错过要么付出真代价（晚一步证据被销毁、人没救回来），要么立即被行动接住（追出去、留字条、托人转告、打电话确认），不许干叹气进下一场] ${prePolishLate.advice.join(' ')} 晚一步阀门：第${prePolishLate.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.88 创作能力闭环：初见白给检测，深情要有来路，不许第一次见面三行内就以身相许
  const prePolishLove = instantLove(draft);
  const loveHint = prePolishLove.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Free love can't carry lifelong vows - first meeting, three lines, "marry me" already said. Heart-flutter may be instant, but a vow needs a pedigree: time spent, friction, someone asking "you've known him a week?"] ${prePolishLove.advice.join(' ')} Instant-love beats: L${prePolishLove.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[免费的爱情撑不起海誓山盟——第一次见面三行内就"非你不嫁"，深情要有来路：要么有时间铺垫（认识多久、相处这些日子才看清自己），要么有人戳破（"你才认识他几天？"替观众发问），要么让心动咽回去不敢说——咽回去的那句比当场说出口更值钱] ${prePolishLove.advice.join(' ')} 初见白给：第${prePolishLove.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.89 创作能力闭环：转角偶遇检测，相遇不许靠世界太小充值
  const prePolishEnc = convenientEncounter(draft);
  const encHint = prePolishEnc.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The world does not shrink to seat two old ties together - corner collisions, "of all coffee shops", same elevator, third time running. Meetings are earned: premeditation, a shared daily track, or a cost. If it must look like fate, let someone say "keep colliding like this and I will believe in fate"] ${prePolishEnc.advice.join(' ')} Convenient-encounter beats: L${prePolishEnc.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[世界不会为两个人缩小——转角撞怀里、全世界就这一家咖啡店、同一部电梯，第三次观众就看穿是作者按计算器安排相遇。相遇要有来路：要么有预谋（打听到行程、堵在楼下三小时），要么有轨迹（同一条地铁线上下班、同一家医院），要么有代价（这次撞见赔上三年布局）] ${prePolishEnc.advice.join(' ')} 转角偶遇：第${prePolishEnc.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.115 创作能力闭环：困处阀门检测，电梯故障/暴雨停电/密室反锁一困就心动不许靠物理困境充值
  const prePolishFP = forcedProximity(draft);
  const fpHint = prePolishFP.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[An elevator breakdown or a sudden downpour is not a love spark - a flat tire, a power cut, a locked storeroom: physical traps pressed into romance duty. Closeness is earned: a prior affection, a refusal, or a real friction. If the trap must kindle, let the body react before the heart does] ${prePolishFP.advice.join(' ')} Forced-proximity beats: L${prePolishFP.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[电梯故障、暴雨停电、密室反锁——物理困境当关系开关，一困就心动一困就靠近，身体先于情感反应。心动要有来路：要么本就暗恋已久、要么有人挣脱/拒绝、要么让靠近咽回去不发生——咽回去的那次比发生更值钱] ${prePolishFP.advice.join(' ')} 困处阀门：第${prePolishFP.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.116 创作能力闭环：英雄救美必生情检测，救命挡刀两拍内就"就是他了"，恩情不是爱情开关
  const prePolishRR = rescueRomance(draft);
  const rrHint = prePolishRR.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[One save does not insert a love coin - he pulls her from the truck, takes the knife, and two beats later her heart skips and "he was the one". Gratitude and safety are not love yet: give the feeling a history (a crush long before the save), a boundary ("I'm just grateful - gratitude isn't love"), or a real price (blood, stitches, hospital, and the wound keeps costing). Better: let her pull away after being saved, and let love grow after the debt no longer explains it] ${prePolishRR.advice.join(' ')} Rescue-romance beats: L${prePolishRR.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[救一次命不等于投币出爱——冲过去拉开、替她挡刀，两拍内心跳漏拍"就是他了"，感激和安全感还不是爱情。心动要有来路：要么暗恋已久（救险只是临门一脚）、要么自己划界（"我只是感激他，感激不是爱"）、要么代价真实可见（中刀流血缝合住院，且伤势拖到后面几场持续影响他）。更好用的写法：救完反而疏远，等这笔债还清之后还想不想见他，爱情从那里长出来] ${prePolishRR.advice.join(' ')} 救美生情：第${prePolishRR.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.117 创作能力闭环：吵架秒和好检测，摔门走人又回头"算了都过去了"跳过反思与道歉
  const prePolishFRC = fightReconcileCrutch(draft);
  const frcHint = prePolishFRC.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Instant reconcile is not resolution — slammed the door, stormed out, came back three lines later with "fine, we're good, water under the bridge", skipping why he was angry, why she was hurt, what the fight was even about. Reconciliation handed out like tap water drains every fight it ends. Earn the makeup: a real apology that names the specific wrong ("I shouldn't have made that call for you - it's your life"), a time gap that lets the feeling cool (three days of silence before they're in the same room again), or a mediator (auntie comes by to broker peace). Better still, let the makeup hesitate — he chases out but stands there three seconds before muttering "fine"; that hesitation tells the audience more than the reconciliation itself. If the plot needs fast peace, have a third character ask "You're fine already?" — voicing the doubt turns a freebie into a conscious concession] ${prePolishFRC.advice.join(' ')} Fight-reconcile beats: L${prePolishFRC.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[吵架秒和不是和解——摔门走人又三行内回头"算了，都过去了"，跳过他为什么生气、她为什么委屈、这场仗到底为什么打。和解像水龙头一拧就开，撑不起冲突的分量。给每次和好补一道来路：要么真诚道歉且点出具体错在哪（"我不该替你做主，这是你的私事"），要么时间跨度让情感磨化（三天两头不说话，再见面时火气已冷），要么第三方劝和（老娘舅上门撮合）。更好用的写法是让和好带犹豫——他追出去又站三秒才说"算了"，这个犹豫比和好本身更让观众记住"他其实也没想通"。如果剧情就是需要速和搭档，让第三方质疑一句"你们刚吵完就好成这样？"——替观众把疑问说出口，白给就变成了有意识的妥协] ${prePolishFRC.advice.join(' ')} 吵架秒和：第${prePolishFRC.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.118 创作能力闭环：加害者秒悔悟检测，作恶行凶后一句"我错了"跳过反思与赎罪
  const prePolishIR = instantRepentance(draft);
  const irHint = prePolishIR.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Instant repentance is not redemption — slapped her, threw him out, threatened to ruin them, and three lines later "I was wrong, forgive me". No inner process, no external trigger, no concrete amends. Repentance handed out like a reset button drains every wrong it closes. Earn the remorse: an inner struggle that plays out in real time (hand frozen mid-air, two voices pulling inside, three seconds of silence before lowering it), an external trigger that cracks the denial (saw her crying in the corner, found the old photograph), or concrete amends that costs something (return the shares, withdraw the suit, turn himself in). Better still, let the remorse come out half — he starts "I..." and stops, the audience filling in the rest. If the plot needs fast remorse, have a witness ask "You're sorry? After what you did?" — voicing the doubt turns a freebie into a negotiated surrender] ${prePolishIR.advice.join(' ')} Instant-repentance beats: L${prePolishIR.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[秒悔悟不是救赎——上一秒扇耳光、赶出门、威胁要毁人，下一秒"我错了，原谅我"。没有反思过程，没有外部触发，没有具体赎罪。悔悟像复位键一按就清零，撑不起作恶的分量。给每次悔悟补一道来路：要么内心过场演出来（手停在半空，天人交战，三秒沉默才放下），要么外部触发击穿否认（看见女儿在角落流泪，翻出旧照片旧物），要么具体赎罪有代价（退股、撤案、自首）。更好用的写法是让悔悟只出一半——他开口"我……"又停下，让观众把后半句补出来。如果剧情就是需要速悔悟，让在场的人质疑一句"你知错？你刚做了什么？"——替观众把疑问说出口，白给就变成有妥协的认错] ${prePolishIR.advice.join(' ')} 加害者秒悔悟：第${prePolishIR.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.119 创作能力闭环：嘴炮退敌检测，枪口刀锋下的对峙被三句劝降词解压
  const prePolishTD = talkDownCrutch(draft);
  const tdHint = prePolishTD.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A standoff is not a doorbell — a gun at a hostage's head, a knife on her throat, a bomb in his hand, and three soothing lines later the thug lowers everything: "Put it down. Think about your daughter. It's not worth it." Zero rounds of bargaining, zero external pressure, zero time cost. The standoff is the story's pressure vessel — it holds the fear the audience just invested; talk-down drains it through a straw. Earn the surrender: a real bargain (he wants terms first — "You put yours down, then we talk"), external pressure that forces the hand (police surrounding the block, a sniper's red dot on his chest, backup dragging the hostage away), or time that grinds (three hours of stalemate, night falling, voices going hoarse). Better still, let the surrender cost something — he frees the hostage but keeps the detonator; a standoff that ends in one gentle speech was never a standoff, just a cue] ${prePolishTD.advice.join(' ')} Talk-down beats: L${prePolishTD.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[对峙不是门铃——枪顶着人质的头、刀架在她脖子上、引爆器攥在手里，主角三句好话之后歹徒就全放下了："把枪放下""想想你女儿""不值得"。零回合讨价还价，零外力压制，零时间消耗。对峙是故事的承压舱——它装着观众刚投进去的恐惧，嘴炮等于拿吸管把恐惧抽干。让放下挣来：要么真博弈（他要先谈条件——"你先把枪搁了，咱们再谈"），要么外力压手（警察包围整条街，狙击红点落在他胸口，支援把人质拖走），要么时间磨（僵持三个小时，夜色渐深，嗓子喊哑）。更好用的写法是让放下有代价——他放了人质但引爆器还攥在手里；一句温柔话就能收场的对峙从来不是对峙，只是走位] ${prePolishTD.advice.join(' ')} 嘴炮退敌：第${prePolishTD.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.120 创作能力闭环：野战手术秒成功检测，客厅仓库里取子弹缝合零资质零代价零失败
  const prePolishSur = instantSurgery(draft);
  const surHint = prePolishSur.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Medicine is a threshold, not a prop — digging the bullet out on a kitchen table, stitching with fishing line by flashlight, and the patient is up and walking next scene. No training, no anesthesia, no infection, no failure. A surgery that cannot fail carries no fear, and a wound that costs nothing means nothing. Earn the medicine: credentials on scene (an army medic does the cutting while the hero holds the lamp), a real cost (the patient spikes a fever that night, the wound goes septic, the scar stays for the rest of the story), or guidance in the loop (they call a doctor and follow instructions step by step, hands shaking). Better still, let the operation half-fail — the bullet comes out but the bleeding will not stop, and the next scene is a race to a real hospital] ${prePolishSur.advice.join(' ')} Instant-surgery beats: L${prePolishSur.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[手术台不是茶几——客厅茶几上取子弹、缝衣针鱼线缝伤口、就着手电筒操作，下一个场景病人就满地跑了。零资质、零麻药、零感染、零失败，一场不会失败的手术没有恐惧，一道不付代价的伤口没有分量。让医术挣来：要么资质在场（军医卫生员主刀，主角只打手电递器械），要么过程有代价（当夜伤口感染发高烧、大出血止不住、疤痕留到后面几场），要么求助在途（打电话问医生视频连线，照着一步一步来，手还在抖）。更好用的写法是让手术半成——子弹取出来了血止不住，下一场是一场往真医院跑的生死时速] ${prePolishSur.advice.join(' ')} 野战手术：第${prePolishSur.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.121 创作能力闭环：当众倒戈白给检测，一场揭露全场齐刷刷翻转零质疑零分裂零代价
  const prePolishCf = crowdFlip(draft);
  const cfHint = prePolishCf.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The crowd is not a switch — one revelation and the whole room flips in unison, zero doubt, zero division, zero cost. A crowd that turns as one feels like a prop, not a verdict. Earn the flip: hard evidence on the table (the tape, the ledger, the DNA report — let people see it for themselves), a divided crowd (some still cursing, some walking out, someone calling the cops), or a real price paid (reputation burned, enemies made, kneeling in public). Better still, flip only seventy percent — let thirty percent stay resentful and seed the backlash for next episode] ${prePolishCf.advice.join(' ')} Crowd-flip beats: L${prePolishCf.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[人群不是开关——一场揭露就让全场齐刷刷倒戈，零质疑、零分裂、零代价，群体的忠诚像被编剧拧开的灯。让倒戈挣来：要么证据在场（铁证/录像/亲子鉴定甩出去，让众人自己看），要么人群有分裂（有人仍骂、有人拂袖离场、有人当场报警），要么揭露者付出代价（身败名裂、得罪权贵、当众下跪）。更狠的写法是倒戈不完全——七成倒戈三成记恨，给下一集埋反扑的种子] ${prePolishCf.advice.join(' ')} 当众倒戈：第${prePolishCf.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.122 创作能力闭环：丑闻秒传遍检测，消息传播零时间零载体零对抗
  const prePolishRs = rumorSpeed(draft);
  const rsHint = prePolishRs.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Scandal is not a rocket - one leak and by nightfall the whole city knows, zero time, zero carrier, zero pushback. News travels on legs, not rockets. Earn the spread: show the carrier and the mover (someone filmed it, a troll farm fanned it, an insider sold it), show the slow burn (half a year before it crept out, three years sealed until the paper could not wrap the fire), or show the pushback (posts deleted overnight, PR killing the story, lawyer letters flying). Better still, let it distort - by the third retelling the story is unrecognizable, seeding the backlash] ${prePolishRs.advice.join(' ')} Rumor-rocket beats: L${prePolishRs.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[消息不是光速是腿跑的——一条丑闻刚泄露，下一拍就一夜传遍全城，零时间、零载体、零对抗，全城的耳朵像被编剧焊在剧情需要上。让传播挣来：要么写出载体与主使（有人偷拍了视频/营销号收钱带节奏/内鬼放料），要么写出时间发酵（半年才慢慢传开/捂了三年纸包不住火），要么写出对抗（连夜删帖/公关压热搜/律师函满天飞）。更狠的写法是传走样——传到第三个人耳朵里版本已经离谱，埋谣言反噬的种子] ${prePolishRs.advice.join(' ')} 丑闻秒传遍：第${prePolishRs.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.123 创作能力闭环：化验秒出检测，官方流程不许靠剧情掐点充值
  const prePolishRoc = resultsOnCue(draft);
  const rocHint = prePolishRoc.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Labs do not run on plot speed - the week-long DNA report is ready on the spot and the paperwork clears before lunch, official process time given away for free, the public clock rewound into a plot metronome. Earn the turnaround: state the real window (three days for the blood panel, a week for the DNA, the permit queued for next month), pay for the rush (a bribe, a pulled string, double the expedite fee), or ground the speed in a field test (a rapid strip, a handheld scanner, a pharmacy kit). Better still, make the wait dramatic - in the three days before the report lands, the suspect moves again, the wait itself breeding new trouble] ${prePolishRoc.advice.join(' ')} Results-on-cue beats: L${prePolishRoc.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[化验不是微波炉——该等一周的亲子鉴定当场就拿，该走流程的审批今天就要，官方流程的耗时白给，公家的钟表被剧情拨快成跑马灯。让等待挣来：要么写出真实周期（血检要三天/鉴定一周后出/立案排到下个月），要么写出加急代价（塞了红包/托了关系/花双倍走加急），要么给出快检依据（现场快检试纸/便携检测仪/验孕棒）。更狠的写法是让等待成为戏——报告没出的三天里嫌疑人又动了一步，等待本身制造新的麻烦] ${prePolishRoc.advice.join(' ')} 化验秒出：第${prePolishRoc.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.124 创作能力闭环：路况掐点检测，马路不许当剧情的自动门
  const prePolishToc = trafficOnCue(draft);
  const tocHint = prePolishToc.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Roads are not automatic doors - the chase hits a traffic jam, the escape runs every green light, and the only taxi in town pulls away the moment it is needed, city traffic rewired by the plot like a faucet. Make the jam cost something: give it a cause (rush hour, an accident, a storm, construction, a police escort), give the hero an alternative (a detour, the subway, on foot, a bike), or pay the delay (late, missed, the suspect already gone when they arrive)] ${prePolishToc.advice.join(' ')} Traffic-on-cue beats: L${prePolishToc.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[马路不是自动门——追凶就堵车、逃命就一路绿灯、要错过出租车抬脚就走，城市交通成了编剧的水龙头，堵和顺都按剧情需要供水。让堵塞有来路：要么写出成因（早高峰/前头出了事故/暴雨/施工/警车开道），要么写出替代方案（绕路/换地铁/骑车/干脆跑过去），要么让延误付代价（迟到了/没赶上/赶到时人已经没了）。更狠的写法是让堵车本身成为戏——堵死的高架上一场撕破脸的摊牌，寸步难行反而逼出真话] ${prePolishToc.advice.join(' ')} 路况掐点：第${prePolishToc.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.125 创作能力闭环：载具掐点故障检测，车不许在该走的时候必走不动
  const prePolishVj = vehicleJam(draft);
  const vjHint = prePolishVj.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Cars do not die on cue - the engine will not turn over exactly when the chase starts, a tire blows halfway whenever someone flees, and the vehicle becomes a valve the writer steps on. Toll every breakdown: a cause (a beat-up taxi with 300,000 miles, a clunker that should have been scrapped, flood-damaged salvage, bad gas), a fix on the spot (changing the spare with grease-stained hands, waiting for a jump-start, queuing for a tow), or a plan B right away (hailing a cab, borrowing a car, abandoning it and running on foot)] ${prePolishVj.advice.join(' ')} Vehicle-jam beats: L${prePolishVj.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[车不会在该走的时候必走不动——正要开车追凶手拧钥匙就是哒哒哒，逃命半路必爆胎，一到关键时刻车必抛锚，载具成了编剧脚下的阀门。让故障有来路：要么写出车况（跑了三十万公里的老爷车/早该报废的破车/泡过水的事故车/加了来路不明的劣质油），要么当场处理（蹲在路边换备胎满手油污/搭电等待/叫拖车排队——排障费时间，这时间就是戏），要么立刻换方案（拦出租车/借邻居的车/弃车跑步追——门关了，人从窗户走）] ${prePolishVj.advice.join(' ')} 载具掐点故障：第${prePolishVj.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.126 创作能力闭环：梦呓泄密检测，睡眠不许当免费情报口
  const prePolishSt = sleepTalk(draft);
  const stHint = prePolishSt.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Sleep-talk is not a free intel chute - one murmur must not hand over the hiding spot, the code, or the whole secret; the lock on key information is reduced to a sleeping posture. Make the leak earn itself: garbled fragments that have to be pieced together over three nights of watching, words the sleeper denies the next morning, or intel the listener already half-suspected - and if the sleep-talk must land on the truth, spend it once, on the one thing no one else could give] ${prePolishSt.advice.join(' ')} Sleep-talk beats: L${prePolishSt.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[说梦话不是免费情报口——一句呓语就吐出藏匿点/密码/身世，关键信息的锁被简化为睡姿。让泄密有代价：要么呓语含糊要拼（守了三夜才拼出半句、语无伦次没人听得懂），要么第二天不认账（说的人矢口否认、听的人将信将疑，逼主角去验证），要么听的人本来就起疑（呓语只是压垮骆驼的最后一根稻草，不是从零到一的情报）。真要让梦话砸中要害，全场只此一次] ${prePolishSt.advice.join(' ')} 梦呓泄密：第${prePolishSt.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.127 创作能力闭环：高烧谵妄吐真言检测，发烧不许当免费情报口
  const prePolishFt = feverTruth(draft);
  const ftHint = prePolishFt.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A fever is not a truth serum - one bout of delirium must not hand over the hiding spot, the code, or the whole secret; the lock on key information is reduced to a thermometer reading. Make the leak earn itself: garbled fragments that have to be pieced together over days of bedside watching, words the patient denies after the fever breaks, or intel the listener already half-suspected - and if the delirium must land on the truth, spend it once, on the one thing no one else could give] ${prePolishFt.advice.join(' ')} Fever-delirium beats: L${prePolishFt.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[高烧不是吐真剂——一场谵妄就吐出藏匿点/密码/隐情，关键信息的锁被简化为体温刻度。让泄密有代价：要么谵语含糊要拼（守了几天病床才拼出半句、语无伦次没人听得懂），要么退烧后不认账（说的人什么都不记得、听的人将信将疑，逼主角去验证），要么听的人本来就起疑（谵语只是压垮骆驼的最后一根稻草，不是从零到一的情报）。真要让谵语砸中要害，全场只此一次] ${prePolishFt.advice.join(' ')} 高烧谵妄：第${prePolishFt.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.128 创作能力闭环：无因馈赠检测，萍水相逢不许当许愿池
  const prePolishIe = instantEndowment(draft);
  const ieHint = prePolishIe.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Strangers are not wishing wells - one meeting must not hand over money, a house, a car, or a job; the lock on critical resources is reduced to a chance encounter. Make the gift earn itself: a provenance (saved my father / owed your family), a price ("in exchange, you must do something for me"), or refusal friction ("I couldn't possibly" refused twice before accepting, the gift isn't taken in one beat). If one breezy gift is truly needed, save it for the single moment] ${prePolishIe.advice.join(' ')} Unprompted-gift beats: L${prePolishIe.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[萍水相逢不是许愿池——一开口就给五百万、一套房、一个职位，关键资源的锁被简化为一面之缘。让馈赠有代价：要么有来路（救过命/恩人之子/故友之子），要么有价码（作为交换/有个条件/你帮我做件事），要么有拒绝摩擦（不能收/这怎么好意思/无功不受禄，挣扎两句才接下）。真要写贵人随手给的桥段，全场只此一次] ${prePolishIe.advice.join(' ')} 无因馈赠：第${prePolishIe.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.129 创作能力闭环：救兵天降检测，绝境不许只等踹门声
  const prePolishLsr = lastSecondRescue(draft);
  const lsrHint = prePolishLsr.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Peril only works when help might not come - a knife at the throat followed by the door kicked down drains the scene of tension. Make the rescue earn itself: a setup (the rescuer was already following her, a capped figure planted scenes ago), a distress call (she sent her location before being bound, triggered the alarm), or a price (he takes the knife, goes down bleeding). Better: help arrives too late or into the same trap, so the hero lands the final blow in the peril itself. If one last-second rescue is truly needed, save it for the single moment] ${prePolishLsr.advice.join(' ')} Last-second-rescue beats: L${prePolishLsr.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[危机的价值在于"可能没人来"——刀刚架上脖子门就被踹开，绝境就泄了劲。让救援有来路：要么有铺垫（他一直暗中跟着，咖啡馆窗外那个鸭舌帽背影就是他），要么有求救（她被绑前把定位发了出去、谈判时悄悄按下报警器），要么有代价（替她挡了一刀、硬扛三个打手、倒在血泊里）。更高级：救兵来晚一步或也陷入绝境，主角在绝境里完成最后一击。真要写千钧一发，全场只此一次] ${prePolishLsr.advice.join(' ')} 救兵天降：第${prePolishLsr.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.130 创作能力闭环：反派拖刀检测，处决窗口不许白给
  const prePolishVs = villainStall(draft);
  const vsHint = prePolishVs.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The kill only works when the audience believes the blade will fall - a gun to the head followed by a victory speech or a phone call hands the hero a free escape window. Make every stall pay: a reason (he needs the vault code first, waits for the boss's order, wants to expose her in front of the board), an interruption (sirens cut the speech short, the door bursts open before the call ends), or a struggle (she saws at the rope until her wrist bleeds and lunges for the detonator). Better: the stall accomplishes something - the signature is signed, the burial site forced out. If one villain stall is truly needed, save it for the single moment] ${prePolishVs.advice.join(' ')} Villain-stall beats: L${prePolishVs.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[处决的价值在于"这一锤真的会落下"——枪刚顶上头就开始发表胜利宣言、接无关电话、说明天再处理，翻盘窗口是反派亲手留的。让每一次拖延有账可算：要么有理由（先问出金库密码、等头儿的指令、要在董事会上当众揭穿），要么拖到一半就被掐断（宣言说到一半警笛响起、电话还没接完正门已被踹开），要么主角在拖延里拿命换时间（磨着绳索手腕磨出血、咬断绳子扑向引爆器）。更高级：拖刀拖出了结果（签了字、逼出藏尸地点），每一拍拖延都承载剧情。真要写胜利宣言，全场只此一次] ${prePolishVs.advice.join(' ')} 反派拖刀：第${prePolishVs.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.131 创作能力闭环：开会式推进检测，群像不许当任务编排仪表盘
  const prePolishTb = teamBriefing(draft);
  const tbHint = prePolishTb.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[An ensemble deployment is not a duty roster - assignments announced and accepted in unison ("listen up, you take point, roger that") flatten the team into a pipeline. Make the plan argued into existence: dissent (why me on door duty? you know he and Liu have history), disruption (the guard rotation just moved up, reshuffle everything), or stakes on the table (one shot at this - anyone slips, they get left inside). The drama is in the people receiving the plan, not the plan itself. If one briefing beat is truly needed, save it for the single moment] ${prePolishTb.advice.join(' ')} Team-briefing beats: L${prePolishTb.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[群像部署不是排班表——"都听好了/你负责/明白收到"一宣读一领命，人物就成了流水线上的工位。让分工是吵出来的：给分派补一道摩擦，三选其一——异议（凭什么我守后门？他跟老三有过节你不知道吗）、变数（话音未落警卫提前换班的消息到了，全体重新洗牌）、赌注（都记住，这次只有一次机会，谁掉链子谁留在里面）。戏不在任务本身，在领任务的人。真要写一次战前部署，留给全场唯一的高光] ${prePolishTb.advice.join(' ')} 开会式推进：第${prePolishTb.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.90 创作能力闭环：黑客秒破检测，高安全系统不许靠三下键盘充值
  const prePolishHack = instantHack(draft);
  const hackHint = prePolishHack.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[High-security systems do not fall to three keystrokes - police networks, bank vaults, military firewalls have weight. Breaches are earned: equipment, nights of trial and failure, an inside man, or a price paid (the logs caught his IP). If one breezy breach is truly needed, save it for the single moment] ${prePolishHack.advice.join(' ')} Instant-hack beats: L${prePolishHack.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[高安全系统不会向三下键盘投降——公安内网、银行金库、军方防火墙都有重量。突破要有成本：设备与专业感、一夜一夜的试错与失败、内应的门、或反追踪的代价（日志记下了他的IP）。真要一次爽快秒破，留给全场唯一一次] ${prePolishHack.advice.join(' ')} 黑客秒破：第${prePolishHack.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.91 创作能力闭环：神枪手开挂检测，技能精准不许靠枪枪自带制导充值
  const prePolishMarks = instantMarksman(draft);
  const markHint = prePolishMarks.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Every shot does not find its mark - zero training, zero misses, rounds biting vitals on cue means the guns are guided by the plot. Precision is earned: a pedigree, a first shot that went wide, a price paid, or a professional routine. Save the one true dead-eye shot for the single moment it matters] ${prePolishMarks.advice.join(' ')} Instant-marksman beats: L${prePolishMarks.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[枪枪上靶不是技能——零训练零失手、弹弹咬要害，等于枪装了制导。精准要有来路：专业背景、第一枪的失手、暴露位置的代价、或测风装表尺的过程。全片只留一枪真的百步穿杨，留给最不能再失手的那次] ${prePolishMarks.advice.join(' ')} 神枪手开挂：第${prePolishMarks.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.92 创作能力闭环：语言秒精通检测，语言流利不许靠剧情白送充值
  const prePolishLang = instantLanguage(draft);
  const languageHint = prePolishLang.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Language is not a free coupon - from understanding nothing to fluent negotiation in three lines means the learning curve bends for the plot. Fluency is earned: a pedigree (exchange student, a decade abroad, a local parent), a clumsy process (subtitled TV, months of flashcards, an accent that still slips), or stay in the barrier - not understanding is often the better scene] ${prePolishLang.advice.join(' ')} Instant-language beats: L${prePolishLang.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[语言不是免费优惠券——上一场还听不懂，下一场流利谈判，等于学习曲线为剧情弯折。流利要有来路：留学生、在国外住了十年、父母一方是本地人；要有狼狈过程：跟着字幕学、背了三个月单词、至今还带口音；或者干脆留在障碍里——听不懂常常是更好的戏] ${prePolishLang.advice.join(' ')} 语言秒精通：第${prePolishLang.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.93 创作能力闭环：一句话点醒检测，多年心结不许被单句台词瞬间治愈
  const prePolishWake = wakeUpCall(draft);
  const wakeUpHint = prePolishWake.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A knot of twenty years does not dissolve in one line - when a single sentence unties what trauma tied, the weight is gone and the scene is a sermon. Loosening is earned: a struggle (long silence, clenched fists, a shaking voice - the body softens first), a cost (time paid, something lost by understanding), or only half-way (she never announces the breakthrough; she just pockets the watch)] ${prePolishWake.advice.join(' ')} Wake-up-call beats: L${prePolishWake.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[二十年的心结不会被一句话解开——单句台词瞬间治愈多年创伤，等于心结的重量被台词音量碾过去，顿悟成了编剧的开关。松动力要有来路：挣扎（沉默良久、攥紧拳头、声音发抖——身体先于语言松动）、代价（想通伴随新的失去）、或只松一半（她不宣告想通，只是把怀表放进口袋）] ${prePolishWake.advice.join(' ')} 一句话点醒：第${prePolishWake.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.94 创作能力闭环：呼唤即醒检测，昏迷多年的人不许被一声呼唤唤醒
  const prePolishComa = wakeOnCue(draft);
  const comaHint = prePolishComa.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Years of coma do not end on a single call - when the vegetative patient opens her eyes the moment the plot needs the vault opened, the coma is a lock and the voice a master key. Waking is earned: a medical path (brain activity returns, sedatives weaned, signs after rounds), a gradient (fingers first, eyelids later, days of aphasia and faces she cannot place), time paid (three years of vigil, reading to him nightly), or a price (she wakes to a world that moved on)] ${prePolishComa.advice.join(' ')} Wake-on-cue beats: L${prePolishComa.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[昏迷三年的人不会因为一声呼唤就睁眼——当沉睡多年的人恰好在剧情需要时醒来，昏迷就成了锁信息的保险柜，呼唤成了万能钥匙。苏醒要有来路：医学过程（脑电波好转、撤了镇静剂、会诊后的苏醒迹象）、渐变（手指先动、眼皮颤了三天、睁眼后失语认不出人）、时间成本（守了三年天天念）、或代价（醒来面对已被改写的一切）] ${prePolishComa.advice.join(' ')} 呼唤即醒：第${prePolishComa.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.95 创作能力闭环：带伤开挂检测，重伤未愈的人不许当剧情需要时就全力输出
  const prePolishWound = woundOnCue(draft);
  const woundHint = prePolishWound.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Broken ribs do not chase three blocks - when the walking wounded fight at full strength the moment the plot needs it, the injury is a switch and the bandage is set dressing. Toll every charge: medical clearance (a painkiller shot, fresh bandages, the doctor finally nodding), a price paid on the spot (stitches tear, he staggers to a knee), someone stepping in (she presses him down: I go), or write the failure (three tries and he cannot stand)] ${prePolishWound.advice.join(' ')} Wound-on-cue beats: L${prePolishWound.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[肋骨断着的人不会追出三条街——当重伤未愈的人恰好在剧情需要时恢复战力，伤势就成了编剧的开关，绷带成了摆设。带伤上阵要有来路：医学许可（打了封闭、绷带一缠、医生点头放行）、代价（伤口崩开、缝线撕裂、踉跄跪倒——爆发当场付费）、代劳（被拦下由兄弟出手）、或干脆写"起不来"（挣扎三次没站起来）] ${prePolishWound.advice.join(' ')} 带伤开挂：第${prePolishWound.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.113 创作能力闭环：疲劳透支开挂检测，三天没睡的人不许当剧情需要时就神采奕奕
  const prePolishFatigue = fatigueOverdrive(draft);
  const fatigueHint = prePolishFatigue.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Three sleepless days do not vanish on cue - when the dead-on-their-feet character performs at full strength the moment the plot needs it, exhaustion is a switch and the strain was just dialogue. Toll every charge: a supply line (strong tea, caffeine pills, a glucose drip), a price paid on the spot (vision tunnels at the top of the stairs, hands too shaky to grip the wheel), someone taking the shift (she takes the wheel: rest, I drive), or write the failure (third time his eyelids win)] ${prePolishFatigue.advice.join(' ')} Fatigue-overdrive beats: L${prePolishFatigue.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[三天三夜没合眼的人不会因为剧情需要就神采奕奕——透支了还中气十足地审一夜嫌犯，精力就成了编剧的开关，疲劳成了背景交代。透支上阵要有来路：补给来源（灌下三杯浓茶、嗑了提神药、葡萄糖吊着）、当场付费（冲上顶楼眼前一黑、手抖得握不稳方向盘）、有人接力（她接过方向盘：剩下我来）、或干脆写"扛不住"（第三次眼皮打架终于睡着）] ${prePolishFatigue.advice.join(' ')} 疲劳透支开挂：第${prePolishFatigue.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.96 创作能力闭环：束缚秒脱检测，五花大绑不许下一拍就自己走出来
  const prePolishEscape = instantEscape(draft);
  const escapeHint = prePolishEscape.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Ropes do not slip on cue - when the bound captive walks free a beat later with no source, restraint is a switch and the lock is a prop. Toll every escape: a planted tool (the hairpin up her sleeve, the stolen key, the knot loosened a notch earlier), a price paid on the spot (hours of grinding, wrists raw, a dislocated thumb), outside help (an accomplice unlocks the door), or write the failure (three tries and the knots hold)] ${prePolishEscape.advice.join(' ')} Instant-escape beats: L${prePolishEscape.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[绳子不会自己松——被五花大绑锁进密室的人下一拍就自己走出来，束缚就成了编剧的开关，锁成了道具。脱身要有来路：工具铺垫（袖中藏的发夹、偷来的钥匙、进门前松过一扣的绳结）、当场付费（磨了半夜、手腕渗血、肩膀脱臼——脱身是疼出来的）、外援（同伙开门、看守放水）、或干脆写"脱不了"（挣了三次绳结纹丝不动）] ${prePolishEscape.advice.join(' ')} 束缚秒脱：第${prePolishEscape.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.97 创作能力闭环：武器哑火检测，枪不许在该响的时候必不响
  const prePolishJam = weaponJam(draft);
  const jamHint = prePolishJam.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The gun does not run dry on cue - when the weapon jams, clicks empty or runs out of bullets exactly when the plot needs a rescue, the trigger is a switch the writer flips. Toll every failure: a source (a zip gun, damp powder, a barrel full of sand, a revolver that has never been cleaned), a fix on the spot (clearing the jam, ejecting the round, racking the slide, swapping in the spare magazine), or a fallback (drawing the knife, grabbing the second gun, charging bare-handed)] ${prePolishJam.advice.join(' ')} Weapon-jam beats: L${prePolishJam.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[枪不会在该响的时候必不响——凶手枪口顶着人扳机一扣哑火，追杀到天台弹匣偏偏打空，武器失灵成了编剧的阀门，该死的人永远死不成。哑火要有来路：土造私枪、受潮的子弹、进沙进水的枪管、从没保养过的老枪；要当场处理：退壳拉栓、换上备用弹匣；要么换方案：拔出匕首、掏出第二把枪、徒手扑上去] ${prePolishJam.advice.join(' ')} 武器哑火：第${prePolishJam.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.98 创作能力闭环：证据恰好失灵检测，取证设备不许在该黑的时候才黑
  const prePolishBlank = evidenceBlank(draft);
  const prePolishPropMotif = propMotifRhythm(draft); // v2.133 物象母题节奏（初扫基线）
  const blankHint = prePolishBlank.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The recorder does not go dark on cue - when the camera is broken, the memory card is full or the photo is blurred exactly when the truth needs hiding, the surveillance system is a switch the writer flips. Toll every outage: a human cause (someone cut the wire, smashed the camera, deleted the footage, stole the card), a fallback (the cloud backup, the camera across the street, another angle still rolling), or a price (a week of repairs, a paid data-recovery guy)] ${prePolishBlank.advice.join(' ')} Evidence-blank beats: L${prePolishBlank.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[取证设备不会在该黑的时候才黑——剧情需要藏真相时监控就恰好坏了三天、内存卡就恰好满了、照片就恰好糊了看不清车牌，取证载体成了编剧的阀门。失灵要有主使：被人剪了线、砸了摄像头、删了录像、偷走内存卡、提前关掉——人主动毁证是行动，还会留下追查的线头；要有兜底：云端有备份、对面路口也拍到了、别的角度还录着一段——门关了窗还开着；要有代价：维修要等一周、数据恢复要花钱找人——真相不是被顺走的，是要抢时间换的] ${prePolishBlank.advice.join(' ')} 证据恰好失灵：第${prePolishBlank.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.133 创作能力闭环：物象母题节奏检测，契诃夫之枪三现法——聚焦即弃/冷枪远隔/情感漂移
  const pmHint = prePolishPropMotif.hitCount >= 1
    ? (hookLang === 'en'
      ? `\n[Props obey the rule of three - a gun hung in act one must fire in act three. Every solemnly focused object needs a second interaction before the payoff; every decisive use in the finale needs a mention in between; a keepsake is never tossed aside without a flinch. Fix: give focused-but-forgotten props one mid-draft beat (taken out at a low moment, asked about, noticed by the rival), re-cock cold guns with one mention between plant and payoff or pay off in layers (fail once, then decide everything), and charge every disposal of a memento with hesitation - one second longer, one last look, a whispered apology] ${prePolishPropMotif.advice.join(' ')} Prop-rhythm beats: L${prePolishPropMotif.hits.map((h) => h.line).join(', ')}\n`
      : `\n[物件守三现法则——第一幕挂的枪，第三幕必须响。郑重聚焦过的物件，兑现前要再互动一次；终幕一锤定音的物件，中间要有提及回响；信物不许被随手处置而无反应。修法：聚焦即弃的给一个中段互动拍（低谷时拿出来看一眼、配角问起来历、对手留意到它）；冷枪远隔的在挂枪点与兑现点之间插一次提及，或让兑现分层——先让它失败一次、再让它一锤定音；情感漂移的给处置加痛苦决断——多攥一秒、最后一眼、轻声说句对不起] ${prePolishPropMotif.advice.join(' ')} 物象节奏断点：第${prePolishPropMotif.hits.map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.99 创作能力闭环：萌宝泄密检测，大人死守的秘密不许被奶声奶气的娃一句话当众拆封
  const prePolishBlurt = childBlurt(draft);
  const blurtHint = prePolishBlurt.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A lisping kid is not a free truth courier - bloodline, affairs and murder the adults guard for years get read aloud by a toddler and believed on the spot; the child becomes the writer's letter opener. Toll every blurt: show the source (a half-sentence overheard through a door and misheard, a photo found, an adult coaching the kid to announce it in public - coaching is an action and turns the PA into a pawn), make belief costly (the room shuts it down as kids' talk, the listener doubts, the adult verifies and takes a loss while verifying), and let the blurt cost a child's price (scolded, silenced, targeted, learns to go quiet)] ${prePolishBlurt.advice.join(' ')} Child-blurt beats: L${prePolishBlurt.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[奶声奶气不是免费真相快递——大人死守多年的血缘、奸情、命案，被一个娃一句话当众拆封，满座听完就变色定案，孩子成了编剧的拆信刀。每一次童言都要补门槛：来路要演（躲在门后听见半句还听错了、捡到过照片、被大人教好当众宣布——授意是行动，孩子就从广播变回棋子）；采信要付代价（满座一句"小孩子懂什么"压下去、听者将信将疑、大人拿这话去对质验证，验证时再吃一次亏）；让童言付出童言的代价（被训斥、被封口、被反派盯上，下次学会了沉默）] ${prePolishBlurt.advice.join(' ')} 萌宝泄密：第${prePolishBlurt.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.100 创作能力闭环：假倒计时检测，期限不许是橡皮筋——立了期限和后果就要赶、就要兑付
  const prePolishDeadline = deadlineStretch(draft);
  const deadlineHint = prePolishDeadline.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A deadline is not a rubber band - "find the money in three days or she walks" announced, then nobody races the clock and nothing happens on day three; the countdown becomes a wall clock the writer ignores. Toll every ticking clock: show the race (all-night runs, every favor called in, red lights run, arriving with seconds to spare), or honor the forfeit (time runs out, the foreclosure happens, the wedding is called off - an extension must be earned, begged, negotiated or bought, never granted for free)] ${prePolishDeadline.advice.join(' ')} Deadline-stretch beats: L${prePolishDeadline.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[期限不是橡皮筋——"三天之内凑不出钱她就离婚"撂下了，镜头一转没人赶时间，三天到了什么也没发生，倒计时成了编剧不看的挂钟。每一个滴答作响的钟都要兑付：要么演赶（连夜奔走、人情用尽、连闯红灯、踩着最后一秒赶到），要么认罚（期限真的到了，真的收房、真的被扫地出门、婚礼真的取消——宽限只能是跪求来的、谈妥的、拿东西换来的，不许白给）] ${prePolishDeadline.advice.join(' ')} 假倒计时：第${prePolishDeadline.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.101 创作能力闭环：审讯秒招检测，审讯室不许是真话提款机——真话要靠证据、交易、拉锯一口一口挣出来
  const prePolishInterrogation = softInterrogation(draft);
  const interrogationHint = prePolishInterrogation.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[An interrogation room is not a free-truth ATM - one table-slam and a "talk!" or "last chance", and the suspect breaks at once, handing over accomplices, hostage locations, burial spots and the whole next move with no evidence on the table, no deal and no resistance. Make it a two-way chess game: deal the detective's three hands first (what he actually knows, what he is bluffing, what he does not know); break the suspect with landed evidence, not volume (footage, bank records, DNA, one detail only the killer would know); write resistance and cost (silence, a lawyer demanded, counter-accusations, hours passing and detectives rotating, a beating that actually lasts); and if he talks, make the confession a bargained chip with something held back] ${prePolishInterrogation.advice.join(' ')} Soft-interrogation beats: L${prePolishInterrogation.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[审讯室不是真话提款机——警察一拍桌子、一句"最后一次机会"，嫌疑人立刻崩溃，同伙是谁、人质关在哪、赃款埋何处、下一步计划，一五一十全吐出来：没证据上桌、没交易、没沉默拉锯。让审讯回到双向棋局：先亮审方的三张牌（掌握什么、在诈什么、其实不知道什么）；突破靠证据落地不靠嗓门（监控、流水、DNA、一个只有真凶知道的细节，认一件挤一件）；写出抵抗和消耗（沉默、要律师、倒打一耙、审几小时换三拨人、用刑也得真打出过程）；真要开口，供词是谈好的筹码，且留一手掺半句假] ${prePolishInterrogation.advice.join(' ')} 审讯秒招：第${prePolishInterrogation.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.102 创作能力闭环：临终全招检测，死亡不许是真相快递柜——遗言给线索不给答案，完整真相要付代价
  const prePolishDeathbed = deathbedConfession(draft);
  const deathbedHint = prePolishDeathbed.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A deathbed is not a free-truth drop box - the moment a character lies in a pool of blood he speaks in perfect paragraphs: the killer's full name, the accomplices, where the ledger is buried, what happened all those years ago, then his hand goes limp and the monitor flatlines on cue. Once is an emotional peak; by the third, death is just the writer's answer-delivery machine and fifty episodes of investigation are worth five minutes at a bedside. Give the truth a price equal to the weight of the death: a clue, not the answer (half a name, a voice that fails at the key word, a token that still needs explaining); intelligence that cannot be spent directly (half a ledger, a torn page, only the first digits, "find the rest yourself"); the inertia of a secret kept for decades (hesitation, a bargain, a refusal, then only half); and if he does say everything, put the confession under cross-examination - he survives and must face it, or verification proves the dead man lied] ${prePolishDeathbed.advice.join(' ')} Deathbed-confession beats: L${prePolishDeathbed.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[临终不是真相快递柜——人一倒在血泊里就口齿清晰，真凶全名、同伙是谁、账本埋在哪、当年还有谁在场，一口气报完，说完手一松、心电图准时拉直。第一次是情感高潮，第三次观众就发现：谁死谁就是答案投放机，几十集的调查不如病床前站五分钟。让真相的价格配得上死亡：遗言给线索不给答案（名字只吐一半、关键处声音断了、留下还要解释的信物）；情报不可直接消费（半本账、缺一页、密码只给前三位，"剩下的你要自己去查"）；写出守口的惯性（守了三十年、犹豫、讲条件、不肯说，松口也只认一半）；真说全了就让遗言接受质证——人没死成要面对自己的话，或查证发现死者撒了谎] ${prePolishDeathbed.advice.join(' ')} 临终全招：第${prePolishDeathbed.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.103 创作能力闭环：吐真剂秒招检测，药物不许是意志的化学开关——审讯要靠证据博弈、交易筹码和心理拉锯
  const prePolishTruth = truthSerum(draft);
  const truthHint = prePolishTruth.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A syringe is not an interrogation - needle in, eyelids drop, and the suspect hands over accomplices, burial spots, the old case and the whole plan on demand; no evidence duel, no deal, no psychological wrestling. A chemical switch that bypasses human will also bypasses the confession's credibility. Make the serum fail (antidote in advance, tolerance, a false name and code words that lead the dosing side into a trap); make it under-deliver (incoherent fragments, he blacks out mid-sentence, half an address that must be verified); make the dosing itself a crime with weight (black-market vial, doctor blackmailed through family, kidnapping plus drugging, the recording later becomes evidence against the interrogators); and write the real wrestling match - evidence on the table, a bargain over family and sentence, the full arc from silence through denial to release] ${prePolishTruth.advice.join(' ')} Truth-serum beats: L${prePolishTruth.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[针管不是审讯——药水推进静脉、眼皮发沉、意识模糊，同伙是谁、东西埋在哪、当年旧案、整个计划，问什么答什么：没证据上桌、没交易、没心理拉锯。化学药剂绕过了人的意志，也就绕过了供词的可信度。让针失效（提前服解药、抗药体质、给的是假名字和暗号，下药方反被带进沟里）；让药效打折（语无伦次只言片语、没说两句就昏死，半串地址还得去拼凑验证）；让用药本身成为重罪重戏（黑市抢来的药剂、医生被拿家人胁迫、绑架下药罪加一等、全程录像后来反成呈堂证供）；根本之道是写出拉锯——证据甩在桌上算账、用家人和刑期交易、从沉默否认还价到松口走完整个过程] ${prePolishTruth.advice.join(' ')} 吐真剂秒招：第${prePolishTruth.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.104 创作能力闭环：妊娠剧情阀门检测，孕妇的身体不许是随取随用的剧情开关——撞击见红要真实医疗或危机真兑付，干呕确诊要化验过程
  const prePolishPreg = pregnancyOnCue(draft);
  const pregHint = prePolishPreg.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The pregnant body is not a plot switch - a shove in an argument, a fall down the stairs, a car crash lands on her on cue, and the next beat is a hand to the belly, blood, "we might lose the baby", and every relationship in the room flips; then she gags once and a test instantly reads two pink lines. Once is genre grammar; by the third, the baby is obviously never a life in this story, only a wrench, and when "we almost lost it" always ends well even the scare loses its value. For collision beats let real medicine in (the ER, fetal monitoring, progesterone, ordered bed rest, waiting in the corridor for actual results) or let the crisis cash out for real (miscarriage, grief, a cost paid in the body and a relationship permanently changed); decouple the shove from the bleeding. For diagnosis beats give it a process (a tentative first test, an HCG blood draw, a repeat days later, an ultrasound dating the pregnancy), let an established pregnancy's morning sickness stay daily life instead of a plot announcement, and earn any false alarm] ${prePolishPreg.advice.join(' ')} Pregnancy-on-cue beats: L${prePolishPreg.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[孕妇的身体不是剧情开关——争吵里一把推开、滚下楼梯、一场车祸精准落在她身上，下一拍捂肚子、见血、"孩子可能保不住"，满屋关系当场翻转；又或者她恶心一回，验孕棒立刻两道杠。第一次是类型桥段，第三次观众就发现：这个剧里孩子从来不是一条命，只是情节的扳手；每回"差点保不住"最后都保得住，连惊吓都跟着贬值。撞击见红要让真实医疗进场（急诊、胎心监测、黄体酮、卧床医嘱、走廊里等检查结果），要么让危机真兑付（流产、哀悼、身体和关系被永久改写），更要把推搡和见红脱钩；干呕确诊要给过程（初筛可疑、抽血验HCG、隔几天复查、B超确认周数），既存孕妇的孕吐是日常生活不是剧情宣告，乌龙也要演足] ${prePolishPreg.advice.join(' ')} 妊娠剧情阀门：第${prePolishPreg.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.105 创作能力闭环：失忆剧情阀门检测，脑子不许是随取随用的剧情开关——撞击秒失忆要真实医学/永久代价/被利用成本，廉价秒恢复要治疗过程/碎片恢复/创伤价格
  const prePolishAmnesia = amnesiaOnCue(draft);
  const amnesiaHint = prePolishAmnesia.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Memory is not a plot switch - a fall down the stairs, a car crash, a blow to the head, and she wakes remembering everyone except exactly the person the plot needs her to forget; no CT, no neurologist, no observation period, one knock formats the past. Then a second bump, an old song, a familiar necklace, and every memory floods back at once; no therapy, no rehabilitation, no fragment phase, the mind is a load-game button pressed whenever the reunion is due. Once is genre grammar; by the third, memory is obviously never identity in this story, only a wrench, and both the loss and the cure lose their value. For bump-to-amnesia beats let real medicine in (the ER, a brain scan, a neurology consult, overnight observation, the family waiting for actual findings) or let the loss leave a real cost (the memory never returns, permanent gaps, the amnesiac exploited and impersonated, unable to function, not recognizing her own child), and stop tailoring the forgetting so it spares everyone except the one person the plot requires forgotten. For instant-recall beats give recovery a process (therapy, clinical hypnosis, months of rehabilitation, memory reassembled piece by piece), allow fragmented recovery (a scent and an image return first while names stay blank), and if it must flood back at once make it cost something (an agonizing headache, a breakdown, nothing but trauma returning)] ${prePolishAmnesia.advice.join(' ')} Amnesia-on-cue beats: L${prePolishAmnesia.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[记忆不是剧情开关——摔下楼梯、车祸、一棍闷头，醒来她谁都记得，唯独不记得男主或自己犯下的罪，失忆范围精准服务剧情；没有CT、没有神经科、没有观察期，磕一下头过去立刻被格式化。等需要大团圆了，再撞一下脑袋、听到一首老歌、看见一条旧项链，记忆瞬间全部涌回；没有治疗、没有康复、没有碎片期，脑子是编剧的暂停键与快进键：需要误会时失忆，需要和解时恢复。第一次是类型桥段，第三次观众就看穿：这个剧里记忆从来不是人格，只是情节的扳手，失忆和痊愈双双贬值。撞击秒失忆要让真实医学进场（急诊、脑部CT、神经科会诊、留院观察，家属等的是检查结论），要么让失忆真留下代价（最终没恢复、永久性记忆缺失、被人冒名利用、生活失能、连亲生孩子都不认），失忆范围别再精准跳过所有人只忘该忘的那一个；廉价秒恢复要给治疗过程（心理治疗、催眠疗程、数月康复，记忆一点点拼回来），允许碎片恢复（气味画面先回来、名字仍空白），如果必须一次涌回就让它带价格（头痛欲裂、崩溃痛哭、涌回的全是创伤画面）] ${prePolishAmnesia.advice.join(' ')} 失忆剧情阀门：第${prePolishAmnesia.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.106 创作能力闭环：绝症剧情阀门检测，死亡判决书不许是随取随用的剧情开关——宣判秒翻转要复查第二诊断/治疗过程/代价真兑付，误诊秒痊愈要漫长救治/未愈尾巴/经济身体代价
  const prePolishTerminal = terminalDiagnosisOnCue(draft);
  const terminalHint = prePolishTerminal.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[A death sentence is not a plot switch - the doctor hands down "advanced cancer, three months to live" and every grudge, every relationship flips that same day; no re-test, no second opinion, no biopsy, and the patient stays perfectly healthy except for coughing on cue. Then when a reunion is due the chart was wrong, it was a misdiagnosis, a foreign wonder drug, a miracle, a donor appears out of nowhere, and the cancer vanishes on the spot; no long treatment, no transplant rejection, no ruined finances, the terminal verdict is an undo button pressed whenever the ending needs it. Once is genre grammar; by the third, death is obviously never death in this story, only a reversible wrench, and both the illness and the cure lose their value. For instant-verdict beats let re-testing in (another hospital, a biopsy with pathology, a specialist panel, a second opinion) or let treatment in (chemotherapy, targeted therapy, radiation, surgery, session after session - no more healthy patients coughing only when the scene needs tears), or let the price be paid in full (metastasis, deterioration, hospice, even an actual death; "stay positive, there might still be hope" is empty comfort and does not rescue it). For instant-reprieve beats give recovery a long fight (months of chemo, a bone marrow transplant, post-surgical rehab, years of follow-up), allow endings that are not fully cured (living with the tumor, regular scans, recurrence risk, maintenance therapy), and if it must end well make it cost something (life savings gone, bankruptcy, brutal trial-drug side effects, the donor's price)] ${prePolishTerminal.advice.join(' ')} Terminal-diagnosis-on-cue beats: L${prePolishTerminal.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[死亡判决书不是剧情开关——医生递出"癌症晚期，只剩三个月"，全家态度、情侣关系、仇人恩怨当天全部翻转；没有复查、没有第二意见、没有活检会诊，病人活蹦乱跳，只在需要煽情时咳两口血。等需要大团圆了，报告拿错了、误诊了、国外新药、奇迹出现、配型突然成功，癌细胞当场消失；没有漫长治疗、没有移植排异、没有经济代价，绝症是编剧的撤回键：需要悲剧时下发，需要圆满时收回。第一次是类型桥段，第三次观众就看穿：这个剧里死亡从来不是死亡，只是可以撤销的情节扳手，绝症和痊愈双双贬值。宣判秒翻转要让复查兑付（第二家医院、活检病理、专家会诊、第二意见，死刑不该是一张纸当天下的），让治疗进场（化疗、靶向、放疗、手术、一个个疗程，别再让病人活蹦乱跳只在煽情时咳血），要么让代价真兑付（转移、恶化、临终关怀，甚至真的死去；"保持乐观可能有转机"是空话不救场）；误诊秒痊愈要给漫长救治（数月化疗、骨髓移植、术后康复、长期随访，命是一点点抢回来的），允许未痊愈的结局（带瘤生存、仍需复查、随时复发、维持治疗，撤回键要留着尾巴），如果必须圆满就让它带价格（倾家荡产、花光积蓄、试药的巨大副作用、捐献者的代价，团圆是全家拿命和钱换来的）] ${prePolishTerminal.advice.join(' ')} 绝症剧情阀门：第${prePolishTerminal.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.107 创作能力闭环：过敏剧情阀门检测，免疫系统不许是随取随用的剧情开关——接触秒发作要既存过敏史/急救过程/濒死代价，一针秒解除要留观随访/慢性尾巴/社交代价
  const prePolishAllergy = allergyOnCue(draft);
  const allergyHint = prePolishAllergy.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The immune system is not a plot switch - one shrimp at the banquet, one slice of mango at the party, two strokes of a cat, and within three lines the throat is swelling, anaphylactic shock hits and the ambulance is called; no prior allergy history, nobody asked about the ingredients, nobody carries an EpiPen. Then when a happy ending is due the shot goes in and she is instantly fine, lively as ever, no observation, no follow-up, no lifelong avoidance, the banquet ends and the deal is signed; next episode the same character reaches for another shrimp. Once is genre grammar; by the third, allergy is obviously never an illness in this story, only a wrench that arms and disarms on command, and both the attack and the cure lose their value. For bite-to-the-ER beats let the history in (a known allergy, years of knowing, an EpiPen already carried, asking about ingredients, reading the label, avoiding the food since childhood) or let the emergency take a process (ER observation, oxygen, IV steroids, hours of resuscitation, admission and monitoring; "a shot fixed it" does not rescue an attack beat), or let the price be paid in full (the ICU, an intubation, nearly dying, one minute later and it would have been too late). For one-shot-cure beats give recovery a tail of care (overnight observation, hours in the ER, days of steroids, follow-up visits), leave the pause button a tail (still carrying an EpiPen, recurrence risk, lifelong avoidance, chronic asthma, the awkward "I can't eat that" at the next banquet), and if it must end fine make it cost something (the banquet ruined, the deal dead, the trauma and fear of eating out, the social cost of special diets)] ${prePolishAllergy.advice.join(' ')} Allergy-on-cue beats: L${prePolishAllergy.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[免疫系统不是剧情开关——寿宴上夹一只虾、聚会上尝一口芒果、撸两下猫，三行之内喉头水肿、过敏性休克直接送医；没有既存过敏史、没人提前问过食材、没人随身带急救针。等需要大团圆了，急救针一打瞬间没事、活蹦乱跳，不留观不随访不忌口，宴席散场合同照签；下一集主角又自己夹起一只虾。第一次是类型桥段，第三次观众就看穿：这个剧里过敏从来不是病，只是一键引爆又一键拆除的扳手，发作和痊愈双双贬值。接触秒发作要让既往史兑付（过敏史、早就知道对X过敏、随身带急救针、聚餐前问过食材、翻配料表、从小忌口，"怎么不早说"本身就是戏），让急救有过程（急诊留观、吸氧、激素输液、抢救数小时、住院监护，过敏性休克是鬼门关；"打了一针就好"不救发作戏，它本身就是秒解除病象），要么让代价真兑付（ICU、气管切开插管、差点死、再晚一步就没救过来）；一针秒解除要给后续处置（留观一夜、留观数小时、激素吃几天、随访复查，拔针不等于散场），给暂停键留尾巴（随身带急救针、随时可能复发、终身忌口、远离海鲜芒果猫、哮喘慢性化，下一桌宴席要有"这个我不能吃"的尴尬），如果必须圆满就让它带价格（寿宴婚宴搞砸、合同合作黄了、心理阴影再不敢外食、社交场合的忌口代价，虚惊一场也该留下账单）] ${prePolishAllergy.advice.join(' ')} 过敏剧情阀门：第${prePolishAllergy.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.108 创作能力闭环：失明复明剧情阀门检测，视觉通道不许是随取随用的剧情开关——撞击秒失明要器质损伤/规范就医/永久代价，拆纱布秒复明要术后过程/部分恢复/手术代价
  const prePolishBlindness = blindnessOnCue(draft);
  const blindnessHint = prePolishBlindness.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Sight is not a light switch - a car crash, a slap, a fall down the stairs, a beating about the face, an explosion flash, a chemical splash or toxic fumes, and within three lines the doctor announces she is permanently blind, the world goes black and she will never see again; no ruptured eyeball, no detached retina, no optic-nerve contusion, no ophthalmologist, no fundus scan, one knock to the head and the eyes simply switch off. Then when a reunion is due a cornea donor appears out of nowhere, a famed doctor or herbal remedy works, she bumps her head again, cries one storm, the bandages come off and she sees perfectly on the spot; no anti-rejection drugs, no vision training, no months of light-sense before shapes, no astigmatism or photophobia tail, sight is a load-game button pressed whenever the ending needs it. Once is genre grammar; by the third, blindness is obviously never blindness in this story, only a reversible wrench, and both the loss and the cure lose their value. For impact-to-blindness beats let real injury in (a ruptured globe, a detached retina, an optic-nerve contusion, a perforated cornea, intracranial bleeding pressing the nerve), let real medicine in (an ophthalmology consult, fundus angiography, CT and MRI, transfer to a bigger hospital, the diagnosis coming days later, not handed down at the crash scene), or let the loss leave a real price (lifelong blindness, braille, a white cane, a guide dog, a school for the blind, learning to live in the dark; "the bandages came off and she saw" does not rescue an onset beat, it is itself the cheap-cure disease). For bandages-off-cure beats give recovery a process (anti-rejection medication, vision rehabilitation, light perception before outlines, months before faces clear, stitches removed in stages), allow sight that does not fully return (low vision, astigmatism, photophobia, visual-field defects, light perception only, the threat of worsening), and if she must see again make it cost something (the donor died, years on the waiting list, an empty eye bank, life savings gone, the surgical-risk consent she had to sign)] ${prePolishBlindness.advice.join(' ')} Blindness-on-cue beats: L${prePolishBlindness.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[视觉不是电灯开关——一场车祸、一记耳光、滚下楼梯、殴打脸眼、爆炸灼眼、化学品溅入、毒气熏到、一场高烧，三行之内医生宣布她永久失明、眼前漆黑、再也看不见；没有眼球破裂、没有视网膜脱落、没有视神经损伤，没看眼科没做眼底造影，撞一下眼睛就被拉了闸。等需要大团圆了，角膜捐献者凭空出现、神医偏方见效、脑袋又被撞一下、大哭一场，纱布一拆当场看得清清楚楚；没有抗排异药、没有视力训练、没有数月从光感到轮廓的过程，也没有弱视散光畏光的尾巴，视力是编剧的读档键：需要虐恋时拉闸，需要和解时拉亮。第一次是类型桥段，第三次观众就看穿：这个剧里失明从来不是失明，只是可以撤销的情节扳手，失明和复明双双贬值。撞击秒失明要让器质损伤兑付（眼球破裂、视网膜脱落、视神经挫伤、角膜穿孔、颅内出血压迫视神经，眼睛是精密器官不是电灯），让规范就医进场（眼科会诊、眼底造影、CT核磁、转上级医院、数天后才拿到的确诊，而不是车祸现场当场宣判），要么让失明真留下代价（终身失明、盲文、白手杖、导盲犬、上盲校、重新适应黑暗；"拆了纱布她看见了"不救发作戏，它本身就是秒复明病象）；拆纱布秒复明要给术后过程（抗排异药、视力训练、先有光感再辨轮廓、数月才看清人脸、分期拆线，命里的光是一点点渗进来的），允许没完全恢复的视力（弱视、散光、畏光、视野缺损、只有光感、随时可能恶化，复明键要留着尾巴），如果必须重见光明就让它带价格（捐献者去世、排队等了多年、角膜库枯竭、倾家荡产、签字的手术风险同意书，光明是拿命和钱等来的）] ${prePolishBlindness.advice.join(' ')} 失明复明剧情阀门：第${prePolishBlindness.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.109 创作能力闭环：中毒秒解毒剧情阀门检测，毒理通道不许是随取随用的剧情开关——接触秒中毒要毒理化验/规范抢救/永久代价，解药秒回魂要救治过程/余毒尾巴/解药代价
  const prePolishPoison = poisonOnCue(draft);
  const poisonHint = prePolishPoison.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Poison is not a light switch - one toast, a cup of wine, a bowl of soup, a needle in the dark, a snakebite in the garden, and within three lines blood is bursting from her seven orifices, foam crests on her lips, she convulses and collapses, and the doctor is already preparing the funeral; no toxicology panel, no named toxin, no dose, no liver or kidney failure, poison is just the writer flipping a switch to kill on command. Then when the plot needs her alive an antidote vial, a divine doctor's pill, an internal-power purge, venom sucked from the wound, and she is instantly back on her feet, good as new; no gastric lavage, no dialysis, no antivenom course, no days unconscious, no residual toxin, no price on the cure. Once is genre grammar; by the third, poison is obviously never poison in this story, only a reversible wrench, and both the kill and the cure lose their value. For onset beats let real toxicology in (a named toxin and dose, lab confirmation, toxin in the liver and kidneys, respiratory failure), let real rescue in (induced vomiting, gastric lavage, activated charcoal, dialysis, antivenom, the ICU, days of observation), or let the price be paid in full (a real death, never waking, permanent damage, lifelong medication; "the doctor said it was touch and go" does not rescue it). For instant-cure beats give recovery a process (lavage and dialysis, days in a coma, months of recuperation), allow a cure that is not complete (residual toxin, a weak body, relapse risk, months of bitter medicine ahead), and if the antidote must work on the spot make it cost something (the only vial in existence, a life traded for the pill, the brewer of the antidote dies, a fortune spent, brutal side effects)] ${prePolishPoison.advice.join(' ')} Poison-on-cue beats: L${prePolishPoison.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[毒物不是电灯开关——一杯敬酒、一盏毒酒、一碗汤、暗处一针、园子里一口蛇咬，三行之内七窍流血、口吐白沫、抽搐倒地，大夫已经在交代后事；没有毒理化验、没有毒素名称剂量、没有肝肾损伤，毒是编剧说夺命就夺命的开关。等剧情需要她活了，解药一瓶、神医一丸、运功逼毒、嘴吸毒血，她当场活蹦乱跳、毒全解了；没有催吐洗胃、没有透析、没有抗毒血清疗程、没有数日昏迷、没有余毒未清，解药也没有价格。第一次是类型桥段，第三次观众就看穿：这个剧里毒从来不是毒，只是可以撤销的情节扳手，夺命和解毒双双贬值。接触秒中毒要让毒理兑付（具体毒素与剂量、化验确诊、毒素侵肝肾、呼吸衰竭），让规范抢救进场（催吐洗胃、活性炭、透析、抗毒血清、ICU、留观数日，"大夫说差点没救过来"不救场），要么让代价真兑付（真的死去、再没醒、永久损伤、终身服药）；廉价秒解毒要给救治过程（洗胃透析、数日昏迷、数月恢复），允许没解干净（余毒未清、身体虚弱、可能复发、还要喝数月苦药），如果解药必须当场见效就让它带价格（世间唯一一瓶、以命换药、炼药者牺牲、倾家荡产、巨大毒副作用，回魂不能比下毒还便宜）] ${prePolishPoison.advice.join(' ')} 中毒秒解毒剧情阀门：第${prePolishPoison.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.110 创作能力闭环：失声复声剧情阀门检测，言语通道不许是随取随用的剧情开关——惊吓秒失声要器质/心理机制/规范就医/永久代价，金针秒复声要康复过程/部分恢复/求治代价
  const prePolishMute = muteOnCue(draft);
  const muteHint = prePolishMute.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The voice is not a light switch - her family slaughtered overnight, a bowl of mute-draught, a high fever, one hand around her throat, and within three lines she cannot utter a single word and never speaks again; no laryngoscopy, no named diagnosis of vocal-cord palsy or hysterical aphonia, no speech therapist, the silence is simply announced at the scene. Then when a reunion is due a famed doctor drives a golden needle into the mute point, a herbal elixir works, her child cries "Mama" in the fire, and in desperation she suddenly shouts - flawless speech on the spot; no speech therapy, no whisper-before-sentence rehab, no hoarse tail, no price paid, and next episode she talks more than anyone. Once is genre grammar; by the third, muteness is obviously never an injury in this story, only a wrench that silences and restores on command, and both the silence and the recovery lose their value. For shock-to-muteness beats let a real mechanism in (functional or hysterical aphonia, conversion disorder, vocal-cord palsy or nodules or edema, a damaged recurrent laryngeal nerve, a torn throat lining - the doctor must name a medical cause), let real medicine in (an ENT consult, a laryngoscopy, a psychiatrist, a speech-language evaluation, admission and observation, a diagnosis days later), or let the loss leave a real price (she never speaks again, notes and sign language only, the voice never returns, she accepts the silence; "one needle and she spoke" does not rescue an onset beat, it is itself the cheap-cure disease). For instant-cure beats give recovery a process (speech therapy, voice training, months of acupuncture, trauma treatment, first a whisper then single sounds then sentences), allow a voice that does not fully return (whisper only, still hoarse, a throat that aches after two sentences, good days and bad days, the risk of losing it again), and if she must speak on the spot make it cost something (years of doctors, bills that bankrupt the family, the healer's price, and the trauma, memories and truth flooding back the moment she opens her mouth)] ${prePolishMute.advice.join(' ')} Mute-on-cue beats: L${prePolishMute.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[嗓子不是电灯开关——一夜家破人亡、一碗哑药、一场高烧、被掐一次脖子，三行之内她一个字都说不出来、再也没有开口；没有喉镜、没有声带麻痹或癔症性失声这样的诊断、没有言语治疗师，失声在现场一句话就宣判。等需要大团圆了，神医一根金针扎向哑穴、偏方灵药见效、孩子火场哭喊一声娘、情急之下她猛地喊出住手，金口一开字正腔圆；没有言语治疗、没有从气声到短句的康复、没有沙哑的尾巴、没有开口的价格，下一集她比谁都能说。第一次是类型桥段，第三次观众就看穿：这个剧里失声从来不是伤，只是一键失声又一键复声的扳手，失声和复声双双贬值。惊吓秒失声要让机制真兑付（功能性/癔症性失声、转换障碍、声带麻痹小结水肿、喉返神经损伤、咽喉撕裂，医生嘴里要有具体诊断），让规范就医进场（耳鼻喉科、喉镜检查、心理科精神科、言语治疗师评估、住院观察、数天后才确诊），要么让代价真留下（终身再没开口、只能靠纸笔手语交流、嗓音始终没回来、接受失声；"扎一针开口"不救发作戏，它本身就是秒复声病象）；廉价秒复声要给康复过程（言语治疗、嗓音训练、数月针灸理疗、心理创伤干预、先气声单字再连成句子），允许没完全恢复的嗓子（只能耳语气声、依旧沙哑、说久了喉咙疼、时好时坏、容易再次失声），如果必须当场开口就让它带价格（经年求医、倾家荡产的医药费、神医的条件、开口那一刻创伤记忆真相一齐涌回来）] ${prePolishMute.advice.join(' ')} 失声复声剧情阀门：第${prePolishMute.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.111 创作能力闭环：耳聋复聪剧情阀门检测，听觉通道不许是随取随用的剧情开关——爆震秒耳聋要器质机制/规范就医/永久代价，银针耳蜗秒复聪要调机语训/部分恢复/求治代价
  const prePolishDeaf = deafOnCue(draft);
  const deafHint = prePolishDeaf.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Hearing is not a light switch - a shell screams past her ear, a shotgun goes off beside her head, one slap across the ear, a high fever, ototoxic drops forced into her, and after that night she is stone-deaf, can no longer hear a sound; no perforated eardrum named, no ossicular chain or cochlear hair-cell damage, no audiologist, no pure-tone test, deafness is simply announced at the scene. Then when the plot needs sound back a famed doctor drives a silver needle behind the ear, miracle ear drops work, the cochlear implant is switched on and the world has hi-fi sound at once, a slap to the back of the head, and in desperation she suddenly hears his voice again; no mapping sessions, no auditory verbal therapy, no robotic-beeping first weeks, no residual tinnitus, no price paid, and next episode she hears a whisper across a crowded room. Once is genre grammar; by the third, deafness is obviously never an injury in this story, only a wrench that cuts and restores sound on command, and both the silence and the recovery lose their value. For blast-to-deafness beats let a real mechanism in (a perforated or ruptured eardrum, a fractured ossicular chain, destroyed cochlear hair cells, auditory-nerve damage, acoustic trauma, noise-induced or ototoxic sensorineural hearing loss, a temporal bone fracture - the ENT doctor must name a medical cause), let real medicine in (an ENT specialist, otoscopy, pure-tone audiometry, tympanometry, an auditory brainstem response, an audiologist's evaluation, admission and tests), or let the loss leave a real price (she never hears again, sign language and lip-reading and notes only, even hearing aids are useless, deaf school, she accepts the deafness; bare "she could not hear at all" restated is not a price, and "one needle and she heard" does not rescue an onset beat - it is itself the cheap-cure disease). For instant-cure beats give recovery a process (cochlear implant mapping sessions, auditory verbal therapy, months of aural rehab, first electronic buzzing then learning to decode voices, day by day clearer), allow hearing that does not fully return (only loud noises, a shout pressed to the ear, muffled in crowds, constant tinnitus, good days and bad days, a metallic electronic timbre), and if she must hear on the spot make it cost something (years of doctors, bills that bankrupt the family, the implant's astronomical price, surgical consent and risk, the healer's price)] ${prePolishDeaf.advice.join(' ')} Deaf-on-cue beats: L${prePolishDeaf.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[听觉不是电灯开关——炮弹擦着耳边炸响、猎枪贴着头走火、一耳光扇在耳侧、一场高烧、被灌了毁耳的药，从那夜以后她双耳失聪、一点声音都听不见了；没有鼓膜穿孔这样的诊断、没有听骨链断裂或耳蜗毛细胞坏死、没有听力师、没有纯音测听，耳聋在现场一句话就宣判。等剧情需要声音回来了，神医一根银针扎向耳后听宫、滴耳灵药见效、人工耳蜗一开机世界当场 hi-fi、脑后一巴掌、情急之下她突然听见他的声音；没有调机、没有听觉口语法语训、没有先电流嗡嗡再分辨人声的头几周、没有残余耳鸣、没有复聪的价格，下一集她隔着一屋子人声都能听见耳语。第一次是类型桥段，第三次观众就看穿：这个剧里耳聋从来不是伤，只是一键静音又一键复聪的扳手，失聪和复聪双双贬值。爆震秒耳聋要让机制真兑付（鼓膜/耳膜穿孔破裂、听骨链断裂骨折、耳蜗毛细胞坏死脱落、听神经损伤、爆震性或耳毒性感音神经性耳聋、颞骨骨折，耳鼻喉科医生嘴里要有具体诊断），让规范就医进场（耳鼻喉专科、耳镜检查、纯音测听、声导抗、脑干诱发电位、听力师评估、住院检查），要么让代价真留下（终身再没听见、只能靠手语唇语纸条交流、助听器都没用、进聋校、接受失聪；裸复述"一点都听不见"不是代价，"扎一针听见"也不救发作戏，它本身就是秒复聪病象）；廉价秒复聪要给康复过程（耳蜗多次调机、听觉口语法、数月听觉康复言语训练、先只有电流嗡嗡声再学着分辨人声、一天比一天听得清），允许没完全恢复的听觉（只听得见巨响、贴耳喊才听见、嘈杂里依旧听不清、耳鸣不止、时好时坏、带着电子金属音），如果必须当场听见就让它带价格（经年求医、倾家荡产的医药费、人工耳蜗的天价、手术风险与同意书、神医的条件）] ${prePolishDeaf.advice.join(' ')} 耳聋复聪剧情阀门：第${prePolishDeaf.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.112 创作能力闭环：瘫痪秒愈剧情阀门检测，肢体移动通道不许是随取随用的剧情开关——事故秒瘫痪要脊髓损伤/规范就医/永久代价，银针正骨秒健步要康复训练/部分恢复/求治代价
  const prePolishParalysis = paralysisOnCue(draft);
  const paralysisHint = prePolishParalysis.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[The legs are not a light switch - a fall from the scaffolding, the roof or a horse, a car crash, a steel beam or slab of concrete crashing onto his lower back, a bullet in the spine, and after that day he is paralyzed, paraplegic, can never walk again, confined to a wheelchair; no fractured vertebra or burst fracture named, no spinal-cord or nerve damage, no MRI, no spine surgeon, paralysis is simply announced at the scene. Then when the plot needs him on his feet a famed doctor needles down the spine, a chiropractor gives one sharp twist and the spine clicks into place, a herbal plaster goes on, a miracle is worked, a hand pats his lower back, and in desperation he suddenly stands and chases after her, walking perfectly on the spot; no rehab center, no months of physical therapy, no learning to move one toe first, no crutches or dragged-leg tail, no price paid, and next episode he runs and jumps. Once is genre grammar; by the third, paralysis is obviously never an injury in this story, only a wrench that cuts and restores movement on command, and both the loss and the cure lose their value. For accident-to-paralysis beats let a real injury in (a spinal-cord injury, a fractured or burst vertebra, lumbar spondylolisthesis, a ruptured or compressed nerve, a herniated disc, stroke-induced hemiplegia, decompression and steel screws - the orthopedist or neurosurgeon must name a medical cause), let real medicine in (MRI and CT and X-ray, a neurosurgery or orthopedics or spine or rehab department, a consult, a confirmed diagnosis, admission, surgery days later, not a verdict at the crash scene), or let the loss leave a real price (lifelong paralysis, wheelchair ramps, bedsores, catheter and incontinence, being fed and washed by family, learning to steer the chair, a disability certificate; bare "he was paralyzed for life" restated is not a price, and "one needle and he stood" does not rescue an onset beat - it is itself the cheap-cure disease). For instant-cure beats give recovery a process (rehab training, physical therapy, months or years at a rehab center, first rolling over and sitting up, first moving one big toe, standing and balance and gait training, braces and orthotics), allow movement that does not fully return (crutches or a walker, two or three shaky steps and he is gasping, a dragged leg and a limp, good days and bad days, back into the wheelchair), and if he must walk on the spot make it cost something (years of doctors, bills that bankrupt the family, imported steel screws, an astronomical surgery, the consent form, the healer's price)] ${prePolishParalysis.advice.join(' ')} Paralysis-on-cue beats: L${prePolishParalysis.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[双腿不是电灯开关——脚手架上、房顶上、马背上摔下来，一场车祸撞倒，钢梁水泥板塌方砸在后腰背上，一刀刺向后腰，一枪打中脊梁，那场车祸以后他高位截瘫、半身不遂、双腿都不能动、再也站不起来、终身坐轮椅；没有脊柱骨折、没有椎体爆裂、没有脊髓神经压迫断裂这样的诊断，没做核磁没看神经外科，瘫痪在现场一句话就宣判。等剧情需要他站起来了，神医老中医银针沿着脊柱扎下去、正骨推拿咔嚓一扳、偏方膏药一贴、活佛发功奇迹、后腰上拍一掌、情急之下孩子坠楼，他猛地站起就追、又能走路了，扔下轮椅健步如飞；没有康复中心、没有数月康复训练、没有先翻身坐起先动大脚趾，没有双拐拖腿的尾巴、没有站起来的价格，下一集他跑跳如常。第一次是类型桥段，第三次观众就看穿：这个剧里瘫痪从来不是伤，只是一键失能又一键健步的扳手，瘫痪和痊愈双双贬值。事故秒瘫痪要让器质损伤兑付（脊髓损伤、脊柱骨折、椎体爆裂骨折、腰椎滑脱、神经压迫断裂、椎间盘突出、中风偏瘫、减压手术打钢钉，骨科神经外科医生嘴里要有具体诊断），让规范就医进场（核磁MRI、CT、X光、神经外科骨科脊柱科康复科、会诊、确诊、住院、手术后才有的结论，而不是车祸现场当场宣判），要么让代价真留下（终身瘫痪、轮椅坡道、褥疮、导尿失禁、家人喂饭擦洗、推着轮椅、学操控轮椅、残疾证；裸复述"终身瘫痪"不是代价，"扎一针站起来"也不救发作戏，它本身就是秒愈病象）；廉价秒健步要给康复过程（康复训练、理疗、康复中心数月数年、先翻身坐起先动大脚趾、步态站立平衡训练、支具矫形器，腿是一点点练回来的），允许没完全恢复的腿脚（双拐助行器、走两三步就喘、拖腿跛行、时好时坏、还得回轮椅，站起来的键要留着尾巴），如果必须当场走路就让它带价格（经年求医、倾家荡产、进口钢钉、天价手术、手术同意书、神医的条件，健步如飞不能比砸断脊梁还便宜）] ${prePolishParalysis.advice.join(' ')} 瘫痪秒愈剧情阀门：第${prePolishParalysis.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  // v2.80 创作能力闭环：泪点开关检测，共情不许靠弱档眼泪充值
  const prePolishTear = tearBait(draft);
  const tearHint = prePolishTear.unrescuedCount >= 1
    ? (hookLang === 'en'
      ? `\n[Tears are not an empathy coupon — welling eyes, misty looks, a single rolling tear deployed every time the audience is supposed to feel. Soft tears are rationed: one moment per episode at the heaviest beat, everywhere else the character holds it back and goes to work. Build the grief with events first; if a tear must fall, write resistance — she forces them down and her voice stays steady] ${prePolishTear.advice.join(' ')} Tear-valve beats: L${prePolishTear.hits.filter((h) => !h.rescued).map((h) => h.line).join(', ')}\n`
      : `\n[眼泪不是共情优惠券——眼眶一红、泪水打转、一滴滑落，每次需要观众感动就拧一次开关。弱档眼泪要限量：全片只在最重的一拍落一次，其余时刻让人物把泪憋回去、擦干了去办事。悲情先靠事件攒，泪是压到极限后自己漏出来的那一滴；真要落泪，写抵抗——她仰头把泪逼回去，声音稳得可怕] ${prePolishTear.advice.join(' ')} 泪点开关：第${prePolishTear.hits.filter((h) => !h.rescued).map((h) => h.line).join('、')}行\n`)
    : '';
  const polished = (await _textRole(tier, 'polisher', `${directive('polisher', hookLang)}\n${G.draftToRevise}${draft.slice(0, 8000)}\n${formatDirective}\n${layoutKeepRule}${knowledgeDirective ? knowledgeDirective : ''}${aiTasteHint}${emoFlatHint}${sensoryHint}${vagueHint}${nameCallHint}${pingpongHint}${hollowHint}${whiplashHint}${echoHint}${expoHint}${softEndHint}${emoLabelHint}${roundRobinHint}${barrageHint}${mirrorHint}${mindHint}${crowdHint}${fallacyHint}${teaseHint}${glossHint}${reactionHint}${deliveryHint}${atmosphereHint}${dodgeHint}${introHint}${moralHint}${threatHint}${jumpHint}${crutchHint}${ventHint}${actionEchoHint}${eavesdropHint}${selfPityHint}${villainHint}${cheapForgiveHint}${gratuityHint}${previewHint}${stanceHint}${unplantedHint}${subtextEraseHint}${exitHint}${phoneRelayHint}${fakeChoiceHint}${parenHint}${accusationHint}${empathyHint}${fidgetHint}${vowHint}${flashHint}${sparkHint}${commHint}${drunkHint}${tearHint}${deduceHint}${recordsHint}${walkHint}${helpHint}${deferredHint}${trustHint}${kinshipHint}${faintHint}${lateHint}${loveHint}${encHint}${fpHint}${rrHint}${frcHint}${irHint}${tdHint}${surHint}${cfHint}${rsHint}${rocHint}${tocHint}${vjHint}${stHint}${ftHint}${ieHint}${lsrHint}${vsHint}${tbHint}${hackHint}${markHint}${languageHint}${wakeUpHint}${comaHint}${woundHint}${fatigueHint}${escapeHint}${jamHint}${blankHint}${pmHint}${blurtHint}${deadlineHint}${interrogationHint}${deathbedHint}${truthHint}${pregHint}${amnesiaHint}${terminalHint}${allergyHint}${blindnessHint}${poisonHint}${muteHint}${deafHint}${paralysisHint}`, cost)).text;
  if (polished.length > 100) draft = polished;
  emit({ role: 'polisher', status: 'done', note: hookLang === 'en' ? 'Polishing complete' : '润色完成' });

  // ⑥ 五校验闸门：一致性 + 去AI化 + 反套路 + 口语化 + 一线编剧改稿尺子（craft-lint）+ 四套进阶创作尺子，最多2轮
  // v2.104 节奏曲线 + 人物行为逻辑也纳入闸门：high 级问题触发重试，mid/low 仅评分卡回显
  // v2.105 风格一致性也纳入闸门：high 级问题（时代/风格禁用词）触发重试
  let antiAi = antiAiScan(draft);
  let cliche = clicheScan(draft, strength);
  let tongue = dialogueScan(draft, colloquialLevel);
  let craft: CraftLintResult = craftLint({ text: draft, lang: hookLang });
  let styleCheckRes = styleProfile ? styleConsistencyScan(draft, styleProfile) : null;
  let emotionLint: EmotionCraftResult = emotionCraftLint({ text: draft, lang: hookLang });
  let webnovelLintRes: WebnovelLintResult = webnovelLint({ text: draft, lang: hookLang });
  let archetypeLintRes: ArchetypeLintResult = archetypeLint({ text: draft, opening: draft.slice(0, 500), lang: hookLang });
  let narrativeLintRes: NarrativeLintResult = narrativeLint({ text: draft, lang: hookLang });
  let rhythmRes = rhythmScan(draft);
  let charLogic = characterLogicScan(cast, draft);
  let foreshadowRes = foreshadowLedger(draft, options.prevForeshadow ?? null);
  let arcRes = arcTracker(Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v.arc])), draft, options.prevArc ?? null);
  let secretRes = secretLedger(draft, options.prevSecrets ?? null, hookLang); // v2.80 跨集信息差台账（悬空/失忆/节奏三检）
  let stateRes = characterStateLedger(draft, options.prevStates ?? null, hookLang, Object.keys(cast)); // v2.80 人物状态跨集台账（悬空/凭空恢复两检）
  let voicePrintRes = voicePrint(cast, draft, hookLang);
  let dialogueAiTasteRes = dialogueAiTaste(draft); // v2.80 对白AI味检测（创作能力：定位AI生成对白痕迹，喂polisher定向润色）
  let sceneEmotionFlatRes = sceneEmotionFlat(draft); // v2.80 场景情绪平检测（创作能力：单场情绪对比度）
  let sensoryDetailRes = sensoryDetail(draft); // v2.80 感官细节密度（创作能力：补听/触/嗅/味非视觉意象）
  let vagueWordRes = vagueWord(draft); // v2.80 模糊词/空心词检测（创作能力：逼叙述落到具体所指）
  let dialogueNameCallRes = dialogueNameCall(draft, Object.keys(cast)); // v2.80 对白直呼名过密检测（创作能力：两人戏去称呼）
  let dialoguePingpongRes = dialoguePingpong(draft); // v2.80 机械问答乒乓检测（创作能力：问了不直答才有对抗）
  let hollowActionRes = hollowAction(draft); // v2.80 空心动作调度检测（创作能力：动作必须带心理/关系/物件）
  let emotionWhiplashRes = emotionWhiplash(draft); // v2.80 情绪硬切无铺垫检测（创作能力：转折必须有触发事件）
  let echoDialogueRes = echoDialogue(draft); // v2.80 对白回声复述检测（创作能力：回应要有立场增量，旁白不复述台词）
  let expositionDialogueRes = expositionDialogue(draft); // v2.80 保姆式对白检测（创作能力：背景信息拆进冲突，不做说明书）
  let sceneSoftEndingRes = sceneSoftEnding(draft); // v2.80 场景软收尾检测（创作能力：冲突后不松气，硬切在张力上）
  let emotionLabelDialogueRes = emotionLabelDialogue(draft); // v2.80 台词情绪点名检测（创作能力：情绪压进具体指控与动作，不报情绪名）
  let roundRobinDialogueRes = roundRobinDialogue(draft); // v2.80 会议体轮转对白检测（创作能力：群戏有主次、抢话、长短差）
  let rhetoricalBarrageRes = rhetoricalBarrage(draft); // v2.80 反问连珠检测（创作能力：每问钉新事实，不靠气势）
  let mirrorVisualDialogueRes = mirrorVisualDialogue(draft); // v2.80 台词复述画面检测（创作能力：画面给的不再说，台词给画面之外的信息）
  let mindReadingNarrationRes = mindReadingNarration(draft); // v2.80 叙述者读心检测（创作能力：认知结论外化成选择/动作/台词/物证）
  let crowdReactionRes = crowdReaction(draft); // v2.80 群体反应偷懒检测（创作能力：群体趋势后立刻落到一个具体人的特写反应）
  let patheticFallacyRes = patheticFallacy(draft); // v2.80 环境共情检测（创作能力：环境给压力不给情绪，情绪只从人的动作长出来）
  let omniscientTeaseRes = omniscientTease(draft); // v2.80 全知预告检测（创作能力：只拍人物此刻所知，假预告改成此刻可拍的未解动作）
  let effortGlossRes = effortGloss(draft); // v2.80 努力过程概述检测（创作能力：结果必须由人物当场动作换来，不接受场外打包）
  let reactionClicheRes = reactionCliche(draft); // v2.80 面部反应公式检测（创作能力：每个刺激一个专属生理瞬间并立刻接动作决定）
  let infoDeliveryRes = infoDelivery(draft); // v2.80 被动信息投喂检测（创作能力：转折靠人物追查/撞破获得，渠道只制造麻烦不替主角推进）
  let atmosphereTellRes = atmosphereTell(draft); // v2.80 气氛直述检测（创作能力：场景情绪压进具体人物的小动作，不写抽象气氛结论）
  let confrontationDodgeRes = confrontationDodge(draft); // v2.80 关键时刻打断逃场检测（创作能力：对峙当场打满，外部信号只能添柴不能踩刹车）
  let selfIntroDumpRes = selfIntroDump(draft); // v2.80 简历式自我介绍检测（创作能力：名字靠人喊、身份靠事显，开场不递名片）
  let moralNarrationRes = moralNarration(draft); // v2.80 道理升华旁白检测（创作能力：领悟翻译成动作，不写朋友圈金句）
  let emptyThreatRes = emptyThreat(draft); // v2.80 空口威胁检测（创作能力：狠话当场兑现，不打欠条）
  let timeJumpPayoffRes = timeJumpPayoff(draft); // v2.80 时间跳转兑付检测（创作能力：跳转只换场，冲突结果不许场外报账）
  let emotionPropCrutchRes = emotionPropCrutch(draft); // v2.80 情绪道具拐杖检测（创作能力：道具动作要改变局势，不做情绪快捷键）
  let emotionVentClicheRes = emotionVentCliche(draft); // v2.80 情绪宣泄套路检测（创作能力：最大档宣泄限量，嚎完要有自己的选择）
  let actionEchoRes = actionEchoDialogue(draft); // v2.80 动作回声台词检测（创作能力：动作不复读，回声后必须是沉默或画面外的要价）
  let eavesdumpRes = eavesdropDump(draft); // v2.80 撞听秘密检测（创作能力：真相靠代价到手，密谋者惜字如金）
  let selfPityRes = selfPityLitany(draft); // v2.80 自怜连祷检测（创作能力：惨而不倒，诉苦换不来追随）
  let villainConfRes = villainOverconfession(draft); // v2.80 反派不打自招检测（创作能力：真相按主角付掉的代价分期兑付）
  let cheapForgiveRes = cheapForgiveness(draft); // v2.80 廉价原谅检测（创作能力：和解按加害者付清的代价兑付）
  let gratuityRes = witnessGratuity(draft); // v2.80 证人无动机倾倒检测（创作能力：每条情报按逼问/交易/旧债兑付）
  let previewRes = previewVoiceover(draft); // v2.80 集尾预告口播检测（创作能力：正文只写正在发生的戏，不发节目导视）
  let stanceRes = stanceFlip(draft); // v2.80 无因立场横跳检测（创作能力：立场转变按施压/证据/交易兑付）
  let unplantedRes = unplantedAsset(draft); // v2.80 后手空降检测（创作能力：制胜道具按提前铺垫兑付，反向契诃夫之枪）
  let subtextEraseRes = subtextErase(draft); // v2.80 旁白翻译机检测（创作能力：潜台词由观众解码，叙述不注解台词）
  let exitClicheRes = exitCliche(draft); // v2.80 强离场收尾依赖检测（创作能力：场景末拍落在牌桌上，不靠摔门打句号）
  let phoneRelayRes = phoneRelay(draft); // v2.80 电话传话机检测（创作能力：画外事件直接切现场，不靠单边电话复读播报）
  let fakeChoiceRes = fakeChoice(draft); // v2.80 假选择检测（创作能力：两难要有挣扎节拍与代价兑付，或被第三条路掀翻）
  let parenOverdirectRes = parenOverdirect(draft); // v2.80 括注导演检测（创作能力：表演交给动作行与演员，cue 行不挂情绪条）
  let abstractAccusationRes = abstractAccusation(draft); // v2.80 全称指控检测（创作能力：吵架用具体事件当刀子，不甩从来/总是/never/always）
  let cheapEmpathyRes = cheapEmpathy(draft); // v2.80 廉价共情检测（创作能力：安慰要笨拙行动或自我暴露，不派心理咨询师话术）
  let fidgetPropRes = fidgetProp(draft); // v2.80 闲玩道具标签检测（创作能力：转钢笔/盘核桃第三次必须让道具做功）
  let emptyVowRes = emptyVow(draft); // v2.80 空转誓言检测（创作能力：复仇宣言无筹码无期限，誓言要落到刀与死线）
  let apologyLoopRes = apologyLoop(draft); // v2.114 道歉循环检测（创作能力：道歉循环无自首无赔偿无退股，道歉要落到赎罪行动）
  let flashbackCrutchRes = flashbackCrutch(draft); // v2.80 回忆杀拐杖检测（创作能力：同一闪回重播/超三行蒙太奇不接当下动作）
  let accidentalSparkRes = accidentalSpark(draft); // v2.80 事故心动检测（创作能力：摔进怀里/意外之吻批发，火花要来自选择）
  let commFailRes = commFailCrutch(draft); // v2.80 通讯失灵拐杖检测（创作能力：没信号/没电/打不通当剧情阀门反复用）
  let drunkTruthRes = drunkTruth(draft); // v2.80 灌醉吐真言检测（创作能力：灌醉当万能钥匙批量解锁机密）
  let tearBaitRes = tearBait(draft); // v2.80 泪点开关检测（创作能力：弱档眼泪高频复用当共情快捷键）
  let instantDeductionRes = instantDeduction(draft); // v2.80 看一眼破案检测（创作能力：观察×解谜强断言零物证，零成本破案当人形答案机）
  let recordsRes = recordsOnDemand(draft); // v2.80 万能档案检测（创作能力：一查必中密度病，档案库当许愿池）
  let walkInRes = walkInTiming(draft); // v2.81 说曹操曹操到检测（创作能力：谈论→无铺垫登场 timing 巧合，登场要有迹可循）
  let helpOnDemandRes = helpOnDemand(draft); // v2.82 随叫随到工具人检测（创作能力：求助→零摩擦应允，帮忙要有代价）
  let delayedRevealRes = delayedReveal(draft); // v2.83 信息容器延迟开启检测（创作能力：信息在手却用不敢拆拖延释放，悬念阀门不许反复拧）
  let instantTrustRes = instantTrust(draft); // v2.84 初见托付检测（创作能力：初见面就托付命脉，信任白给，免费的信任撑不起背叛）
  let instantKinshipRes = instantKinship(draft); // v2.85 认亲白给检测（创作能力：血缘揭露三行内被零成本接纳，亲情速热，免费的亲情撑不起二十年寻找）
  let faintOnCueRes = faintOnCue(draft); // v2.86 晕倒阀门检测（创作能力：关键时刻就晕倒掐断关键信息，晕倒是生理事件不是编剧的信息扣押）
  let alwaysLateRes = alwaysLate(draft); // v2.86 每次都晚一步检测（创作能力：抵达就刚走，错过要有真代价或被行动接住，不是编剧按秒表拖戏）
  let instantLoveRes = instantLove(draft); // v2.88 初见白给检测（创作能力：第一次见面就以身相许，深情要有来路不是初见特效）
  let convenientEncounterRes = convenientEncounter(draft); // v2.89 转角偶遇检测（创作能力：世界太小，相遇靠轨迹或预谋挣来，不是作者发缘分）
  let forcedProximityRes = forcedProximity(draft); // v2.115 困处阀门检测（创作能力：电梯故障/暴雨停电/密室反锁一困就心动，物理困境当关系开关，困处要催化已有关系或遇到拒绝摩擦）
  let rescueRomanceRes = rescueRomance(draft); // v2.116 英雄救美必生情检测（创作能力：救命挡刀两拍内就心跳漏拍"就是他了"，恩情不是爱情开关，心动要有来路/划界/真代价）
  let fightReconcileRes = fightReconcileCrutch(draft); // v2.117 吵架秒和好检测（创作能力：摔门走人又回头"算了都过去了"，跳过反思与道歉，和解当万能缓冲阀，和解要靠真诚道歉/时间跨度/第三方调解挣来）
  let instantRepentanceRes = instantRepentance(draft); // v2.118 加害者秒悔悟检测（创作能力：作恶行凶后一句"我错了"，跳过反思与赎罪，悔悟当万能赎罪阀，悔悟要靠内心过场/外部触发/具体赎罪挣来）
  let talkDownRes = talkDownCrutch(draft); // v2.119 嘴炮退敌检测（创作能力：枪口刀锋下的对峙被三句劝降词解压，放下武器要靠博弈来回/外力压制/时间消耗挣来）
  let instantSurgeryRes = instantSurgery(draft); // v2.120 野战手术秒成功检测（创作能力：客厅仓库里取子弹缝合零资质零代价零失败，医术要靠资质来路/过程代价/专业求助挣来，不是手术刀自带圣光）
  let crowdFlipRes = crowdFlip(draft); // v2.121 当众倒戈白给检测（创作能力：一场揭露全场齐刷刷翻转零质疑零分裂零代价，群体忠诚要靠证据在场/人群分裂/揭露代价挣来，人群不是捧场背景板）
  let instantHackRes = instantHack(draft); // v2.90 黑客秒破检测（创作能力：高安全系统的突破要靠设备、过程、内应或代价挣来，不是三下键盘）
  let instantMarksmanRes = instantMarksman(draft); // v2.91 神枪手开挂检测（创作能力：零训练零失手弹弹咬要害，精准要靠来路、失手、代价或过程挣来，不是枪枪自带制导）
  let instantLanguageRes = instantLanguage(draft); // v2.92 语言秒精通检测（创作能力：零学费零口音从听不懂到流利只隔三行，语言要有来路、过程、代价，或干脆留在障碍里）
  let wakeUpRes = wakeUpCall(draft); // v2.93 一句话点醒检测（创作能力：多年心结被单句台词瞬间治愈，松动要有挣扎、代价、时间，或只松一半）
  let wakeOnCueRes = wakeOnCue(draft); // v2.94 呼唤即醒检测（创作能力：昏迷多年的人被一声呼唤唤醒，苏醒要有医学、渐变、守候或代价挣来）
  let woundOnCueRes = woundOnCue(draft); // v2.95 带伤开挂检测（创作能力：重伤未愈的人当剧情需要时全力输出，伤势要有医学许可、当场代价或有人代劳）
  let fatigueRes = fatigueOverdrive(draft); // v2.113 疲劳透支开挂检测（创作能力：三天没睡水米未进的人当剧情需要时全力输出，透支要有补给来源、当场代价或有人接力）
  let instantEscapeRes = instantEscape(draft); // v2.96 束缚秒脱检测（创作能力：五花大绑锁进仓库下一拍就自己走出来，脱身要有工具铺垫、当场代价或外援挣来）
  let weaponJamRes = weaponJam(draft); // v2.97 武器哑火检测（创作能力：关键时刻枪必没子弹——哑火要有来路、当场处理或有备选方案）
  let evidenceBlankRes = evidenceBlank(draft); // v2.98 证据恰好失灵检测（创作能力：失灵要有主使、替代兜底或代价挣来）
  let propMotifRhythmRes = propMotifRhythm(draft); // v2.133 物象母题节奏检测（创作能力：聚焦即弃/冷枪远隔/情感漂移，契诃夫之枪三现法）
  let blurtRes = childBlurt(draft); // v2.99 萌宝泄密检测（创作能力：童言泄密要有来路授意、采信代价或童言代价，孩子不能当移动真相广播）
  let rumorSpeedRes = rumorSpeed(draft); // v2.122 丑闻秒传遍检测（创作能力：消息一夜传遍全城零时间零载体零对抗，传播要靠载体主使/时间发酵/封口对抗挣来，舆论不是点菜单是森林大火）
  let resultsOnCueRes = resultsOnCue(draft); // v2.123 化验秒出检测（创作能力：该等一周的鉴定当场就拿，官方流程耗时白给，等待要靠真实周期/加急代价/现场快检挣来，公家钟表不能当剧情跑马灯）
  let trafficOnCueRes = trafficOnCue(draft); // v2.124 路况掐点检测（创作能力：追凶就堵车、逃命就一路绿灯，城市交通被剧情当水龙头，堵塞要靠成因/替代方案/延误后果挣来，马路不是自动门）
  let vehicleJamRes = vehicleJam(draft); // v2.125 载具掐点故障检测（创作能力：正要追人就打不着火、逃命半路必爆胎——失灵要有来路、当场处理或有替代方案，车不是编剧脚下的阀门）
  let sleepTalkRes = sleepTalk(draft); // v2.126 梦呓泄密检测（创作能力：睡梦中一句呓语吐出藏匿点/密码/身世——泄密要有含糊拼接/事后否认/听者已有疑心，睡眠不是免费情报口）
  let feverTruthRes = feverTruth(draft); // v2.127 高烧谵妄吐真言检测（创作能力：一场谵妄吐出藏匿点/密码/隐情——谵语要含糊拼接/退烧不认账/听者已有疑心，发烧不是万能钥匙）
  let instantEndowmentRes = instantEndowment(draft); // v2.128 无因馈赠检测（创作能力：萍水相逢就给钱/房/车/职位——馈赠要有来路/有价码/有拒绝摩擦，贵人不是许愿池）
  let lastSecondRescueRes = lastSecondRescue(draft); // v2.129 救兵天降检测（创作能力：绝境中救兵最后一秒无因赶到——救援要有铺垫/有求救/有代价，生死关头不许只等踹门声）
  let villainStallRes = villainStall(draft); // v2.130 反派拖刀检测（创作能力：处决执行中临场拖延不落锤——拖延要有理由/有打断/有自救，威胁兑付不许白给时间窗口）
  let teamBriefingRes = teamBriefing(draft); // v2.131 开会式推进检测（创作能力：部署写成排班表、分派即诺零摩擦执行——分派要有异议/有变数/有赌注，群像不许当任务编排仪表盘）
  let deadlineRes = deadlineStretch(draft); // v2.100 假倒计时检测（创作能力：期限+后果的赌注要么演赶时间，要么兑付代价，宽限必须挣来）
  let interrogationRes = softInterrogation(draft); // v2.101 审讯秒招检测（创作能力：高压下秒供要有证据博弈、交易筹码或拉锯消耗，审讯室不是真话提款机）
  let deathbedRes = deathbedConfession(draft); // v2.102 临终全招检测（创作能力：血泊中流利报完真凶同伙证据准时咽气——遗言给线索不给答案，完整真相要付求证代价）
  let truthRes = truthSerum(draft); // v2.103 吐真剂秒招检测（创作能力：一针药剂问什么答什么——让针失效/药效打折/用药有罪/写出拉锯，意志不能有化学开关）
  let pregRes = pregnancyOnCue(draft); // v2.104 妊娠剧情阀门检测（创作能力：一推就见红一吐就两道杠——真实医疗/危机兑付/化验过程/既存孕期/乌龙，肚子不能当关系遥控器）
  let amnesiaRes = amnesiaOnCue(draft); // v2.105 失忆剧情阀门检测（创作能力：撞头秒失忆、老歌项链秒读档——真实医学/永久代价/被利用成本/治疗过程/碎片恢复/创伤价格，脑子不能当编剧开关）
  let terminalRes = terminalDiagnosisOnCue(draft); // v2.106 绝症剧情阀门检测（创作能力：宣判秒翻转、误诊秒痊愈——复查第二诊断/治疗过程/代价真兑付/漫长救治/未愈尾巴/经济身体代价，死亡判决书不能当编剧撤回键）
  let allergyRes = allergyOnCue(draft); // v2.107 过敏剧情阀门检测（创作能力：接触秒发作、一针秒解除——既存过敏史/急救过程/濒死代价/留观随访/慢性尾巴/社交代价，免疫系统不能当编剧一键引爆一键拆除扳手）
  let blindnessRes = blindnessOnCue(draft); // v2.108 失明复明剧情阀门检测（创作能力：撞击秒失明、廉价秒复明——器质损伤/规范就医/永久代价/术后过程/部分恢复/手术代价，视觉不能当编剧电灯开关一拉全灭一拉全亮）
  let poisonRes = poisonOnCue(draft); // v2.109 中毒秒解毒剧情阀门检测（创作能力：接触秒中毒、解药秒回魂——毒理化验/规范抢救/永久代价/救治过程/余毒尾巴/解药代价，毒物不能当编剧电灯开关一拉夺命一拉回魂）
  let muteRes = muteOnCue(draft); // v2.110 失声复声剧情阀门检测（创作能力：惊吓秒失声、金针秒复声——器质心理机制/规范就医/永久代价/康复过程/部分恢复/求治代价，嗓子不能当编剧电灯开关一拉全灭一拉全亮）
  let deafRes = deafOnCue(draft); // v2.111 耳聋复聪剧情阀门检测（创作能力：爆震秒耳聋、银针/耳蜗秒复聪——器质机制/规范就医/永久代价/调机语训/部分恢复/求治代价，听觉不能当编剧电灯开关一拉全灭一拉全亮）
  let paralysisRes = paralysisOnCue(draft); // v2.112 瘫痪秒愈剧情阀门检测（创作能力：事故秒瘫痪、银针/正骨秒健步——脊髓损伤/规范就医/永久代价/康复训练/部分恢复/求治代价，双腿不能当编剧电灯开关一拉全灭一拉全亮）
  let showDontTellRes = showDontTellScan(draft, hookLang);
  // v2.113 集尾钩子效力评分（PRD 2.1.10 短剧留存生死线）：评估集尾钩子"够不够硬"，类型对不对
  let cliffhangerRes = cliffhangerScore(draft, hookLang, outline.cliffhanger);
  // v2.114 爽点密度评分（PRD 2.1.11 短剧爽感生死线）：评估爽点数量/分布/强度/蓄力/多样性
  let coolMomentRes = coolMomentScore(draft, hookLang);
  // v2.115 台词水分检测（PRD 2.1.12 短剧信息密度生死线）：检测寒暄/不推进/重复/过长铺垫/无功能台词
  let dialogueWaterRes = dialogueWaterCheck(draft, hookLang);
  // v2.116 冲突密度与升级检测（PRD 2.1.13 短剧驱动力生死线）：评估冲突数量/强度/分布/升级/多样性
  let conflictDensityRes = conflictDensityCheck(draft, hookLang);
  // v2.117 金句密度检测（PRD 2.1.14 短剧传播力生死线）：评估金句数量/强度/分布/多样性/结尾高潮/弱金句比例
  let punchlineDensityRes = punchlineDensityScore(draft, hookLang);
  // v2.118 场景密度与节奏分析（PRD 2.1.15 短剧节奏生死线）：评估场景数/长度分布/对白动作比/静态场景/碎片场景/拖沓场景/跨场情绪推进
  let sceneDensityRes = sceneDensityScore(draft, hookLang);
  // v2.119 重复感检测（PRD 2.1.16 短剧新鲜感生死线）：检测近似重复台词/重复句式模板/重复情绪beat/重复动作词/重复场景开头
  let repetitionRes = repetitionCheck(draft, hookLang);
  // v2.120 角色戏份均衡检测（PRD 2.1.17 短剧人物驱动生死线）：检测主角戏份不足/工具人独白/戏份悬殊/对手戏缺失/龙套过场
  let characterBalanceRes = characterBalanceCheck(draft, cast, hookLang);
  // v2.121 反转密度检测（PRD 2.1.18 短剧反转生死线）：检测反转数量/强度/分布/多样性/结尾高潮/弱反转比例
  let twistDensityRes = twistDensityScore(draft, hookLang);
  // v2.122 对白长度与速度感检测（PRD 2.1.19 短剧节奏生死线）：检测台词墙/独白戏/超长对白/无节奏
  let dialogueLengthRes = dialogueLengthScore(draft, hookLang);
  // v2.123 信息密度检测（PRD 2.1.20 短剧信息推进生死线）：检测每场戏信息推进量/水戏/信息过载/钩子高潮区
  let informationDensityRes = informationDensityScore(draft, hookLang);
  // v2.124 悬念张力曲线检测（PRD 2.1.21 短剧悬念生死线）：检测张力曲线形态/连续平铺/极值缺失/张力跳转/开场收尾悬念
  let suspenseTensionRes = suspenseTensionCurve(draft, hookLang);
  let sceneHeaderRes = sceneHeaderConvention(draft, hookLang);
  let dialogueFunctionRes = dialogueFunctionalityCheck(draft, hookLang);
  // v2.127 因果逻辑链检测（PRD 2.1.24 剧情可信度过硬线）：巧合依赖/机械降神/因果稀薄/誓言烂尾/信息空降
  let causalLogicRes = causalLogicCheck(draft, hookLang);
  // v2.128 主角目标与行动链检测（PRD 2.1.25 主角驱动过硬线）：欲望可见度/被动主角/目标-障碍-行动闭环/中段失焦
  let protagonistGoalRes = protagonistGoalCheck(draft, hookLang);
  // v2.129 对手/反派质量检测（PRD 2.1.26 反派压迫感过硬线）：反派缺席/纸老虎/无动机/不登场/弱威胁/纸片化
  let antagonistQualityRes = antagonistQualityCheck(draft, hookLang);
  // v2.130 压抑-释放节奏检测（PRD 2.1.27 憋爽节奏过硬线）：只虐不爽/一路平推/憋太久/羞辱欠账/尾段烂尾
  let payoffRhythmRes = payoffRhythmCheck(draft, hookLang);
  // v2.131 情感关系递进检测（PRD 2.1.28 CP 关系过硬线）：有名无实/突飞猛进/一路糖水/暧昧原地踏步/告知式爱情
  let relationshipRes = relationshipProgressionCheck(draft, hookLang);
  // v2.132 场景注水/空转检测（PRD 2.1.29 场景效率过硬线）：三无场景/复述注水/闪回注水/寒暄开场/结尾拖堂
  let scenePaddingRes = scenePaddingCheck(draft, hookLang);
  // v2.133 配角工具人/群像检测（PRD 2.1.30 配角有欲望过硬线）：捧哏型/信息播报员/无欲望保姆/夸夸群像/只动嘴纸片人
  let supportingRes = supportingCharacterCheck(draft, cast, hookLang);
  // v2.134 冲突升级阶梯检测（PRD 2.1.31 冲突爬坡过硬线）：原地踏步/全程无高潮/开局即顶格/跳台阶/手段贫乏
  let conflictEscalationRes = conflictEscalationCheck(draft, hookLang);
  // v2.135 台词潜台词检测（PRD 2.1.32 底牌不能说破过硬线）：底牌直给/反派自曝/知情者科普/问答喂信息/情绪直报
  let subtextRes = subtextCheck(draft, hookLang);
  // v2.136 配角弧光检测（PRD 2.1.33 群像要变化过硬线）：零变化跟班/无铺垫倒戈/纯应答无选择
  let supportingArcRes = supportingArcCheck(draft, cast, hookLang);
  // v2.137 场景目的效率检测（PRD 2.1.34 一场一事过硬线）：一场多目的稀释/跨场重复/目的迟到/软收尾
  let scenePurposeRes = scenePurposeCheck(draft, hookLang);
  // v2.138 时间线一致性检测（PRD 2.1.35 时间只往前走过硬线）：倒计时反转/昼夜矛盾/跳时间偷懒/关系时长压扁
  let timelineConsistencyRes = timelineConsistencyCheck(draft, hookLang);
  // v2.139 场记连续性检测（PRD 2.1.36 物理状态不穿帮过硬线）：伤势无痕/毁物复原/设备复活/束缚消失
  let continuitySupervisionRes = continuitySupervisionCheck(draft, hookLang);
  // v2.140 误会拖延检测（PRD 2.1.37 冲突不能靠"按头误会"硬撑）：拒绝倾听/误会跨场不解/有嘴不说/偷听半句定罪
  let misunderstandingDragRes = misunderstandingDragCheck(draft, hookLang);
  // v2.141 反派降智/主角光环检测（PRD 2.1.38 翻盘必须靠主角挣来）：占优放人/刀下自白/看守空转/致命无伤
  let plotArmorRes = plotArmorCheck(draft, hookLang);
  // v2.142 翻盘证据链公平性检测（PRD 2.1.39 契诃夫之枪）：物证无铺垫/证据雨/空口证据/人证空降
  let evidenceChainRes = evidenceChainCheck(draft, hookLang);
  // v2.143 金手指规则一致性检测（题材门控）：先用后立规/临时觉醒/零代价万能/许愿机/重生全知零误差
  let cheatRuleRes = cheatRuleCheck(draft, hookLang);
  // v2.144 闪回与梦境幻觉结构公平性：梦醒假反转/幻觉无收束/闪回堆砌/同一记忆无新信息重复
  let memoryFakeoutRes = memoryFakeoutCheck(draft, hookLang);
  // v2.145 情绪余波连续性（无题材门控）：创伤后秒清零/丧亡无消化/鸡汤秒治愈
  let emotionalAftermathRes = emotionalAftermathCheck(draft, hookLang);
  // v2.146 空间位移连续性（无题材门控）：跨城瞬移/同场房间瞬移/内外景矛盾
  let locationContinuityRes = locationContinuityCheck(draft, hookLang);
  // v2.147 角色在场感连续性（无题材门控）：离场后仍说话/亡者开口/挂断后对空气说话
  let characterPresenceRes = characterPresenceCheck(draft, hookLang);
  // v2.80 焊点承接检测（无题材门控）：前集结尾说话人没接住/零词汇衔接/开场直接跳时间——endingBlock 焊点的"检测"半边
  let openingWeldRes = openingContinuityCheck(options.prevEpisode?.ending ?? '', draft, hookLang);
  // v2.132 修复闭环对比面板：六维分数公式收敛为 buildDims 单一闭包——闸门前快照（early=true，市场岗未跑用 fallback）与终稿 scorecard 同源同公式，
  // 闸门内打回重写只更新上列 let 扫描结果，before/after 差值即修复闭环增益。注意：权重演进注释与公式本体在文末 scorecardInput 处有镜像副本，改动任一处必须同步另一处
  const buildDims = (early: boolean): DimInput => {
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const cdEmotion = emotionLint.avg;
    const cdWebnovel = webnovelLintRes.avg;
    const cdArchetype = archetypeLintRes.avg;
    const cdNarrative = narrativeLintRes.avg;
    return {
      character: clamp(Math.round((craft.avg * 0.177 + cdEmotion * 0.2092 + cdArchetype * 0.0804 + cdNarrative * 0.0804 + characterBalanceRes.score * 0.1206 + protagonistGoalRes.score * 0.0644 + antagonistQualityRes.score * 0.0724 + relationshipRes.score * 0.0605 + supportingRes.score * 0.0651 + supportingArcRes.score * 0.07))),
      plot: clamp(Math.round(cdEmotion * 0.042 + cdWebnovel * 0.028 + cdArchetype * 0.0211 + cdNarrative * 0.0211 + cliffhangerRes.score * 0.0211 + coolMomentRes.score * 0.0315 + conflictDensityRes.score * 0.0211 + twistDensityRes.score * 0.028 + informationDensityRes.score * 0.0492 + suspenseTensionRes.score * 0.0525 + causalLogicRes.score * 0.0351 + payoffRhythmRes.score * 0.039 + scenePaddingRes.score * 0.0293 + conflictEscalationRes.score * 0.0315 + scenePurposeRes.score * 0.0339 + timelineConsistencyRes.score * 0.0365 + continuitySupervisionRes.score * 0.0392 + misunderstandingDragRes.score * 0.0421 + plotArmorRes.score * 0.0453 + evidenceChainRes.score * 0.0487 + cheatRuleRes.score * 0.0524 + memoryFakeoutRes.score * 0.0563 + emotionalAftermathRes.score * 0.0605 + locationContinuityRes.score * 0.0651 + characterPresenceRes.score * 0.07)),
      dialogue: clamp(Math.round(craft.avg * 0.1435 + cdArchetype * 0.0957 + cdNarrative * 0.0637 + voicePrintRes.score * 0.0797 + dialogueWaterRes.score * 0.0797 + punchlineDensityRes.score * 0.0957 + repetitionRes.score * 0.0797 + dialogueLengthRes.score * 0.0797 + dialogueFunctionRes.score * 0.0797 + subtextRes.score * 0.06 + sceneEmotionFlatRes.score * 0.0549 + roundRobinDialogueRes.score * 0.048 + rhetoricalBarrageRes.score * 0.04)),
      market: early ? clamp(Math.round(craft.avg * 0.6 + cdEmotion * 0.4)) : clamp(market.overall || Math.round(craft.avg * 0.6 + cdEmotion * 0.4)),
      format: clamp(Math.round(craft.avg * 0.40 + showDontTellRes.score * 0.2 + sceneDensityRes.score * 0.15 + sceneHeaderRes.score * 0.2 + crowdReactionRes.score * 0.05)),
      deai: clamp(Math.round(100 - antiAi.hitCount * 6) * 0.02 + craft.avg * 0.02 + (100 - dialogueAiTasteRes.score) * 0.02 + feverTruthRes.score * 0.04 + instantEndowmentRes.score * 0.04 + crowdFlipRes.score * 0.04 + trafficOnCueRes.score * 0.04 + rescueRomanceRes.score * 0.04 + forcedProximityRes.score * 0.04 + instantHackRes.score * 0.04 + instantSurgeryRes.score * 0.04 + instantLanguageRes.score * 0.04 + lastSecondRescueRes.score * 0.04 + vehicleJamRes.score * 0.04 + propMotifRhythmRes.score * 0.04 + sleepTalkRes.score * 0.04 + villainStallRes.score * 0.04 + teamBriefingRes.score * 0.04 + fightReconcileRes.score * 0.04 + pregRes.score * 0.04 + resultsOnCueRes.score * 0.04 + terminalRes.score * 0.04 + allergyRes.score * 0.04 + poisonRes.score * 0.04 + paralysisRes.score * 0.04 + fatigueRes.score * 0.04 + wakeUpRes.score * 0.02),
    };
  };
  const beforeDims = buildDims(true); // v2.132 闸门修复前基线（此后闸门打回重写会覆盖上列 let 扫描结果，终稿复算即 after）
  emit({ role: 'consistency', status: 'running', note: hookLang === 'en' ? 'QC gate scanning: consistency / anti-AI / cliche / dialogue / format, one ruler at a time' : '质检闸门开筛：一致性/反AI/俗套/台词/格式，逐把过尺' });
  for (let round = 0; round < 2; round++) {
    const consist = consistencyCheck(draft, cast, hookLang);
    antiAi = antiAiScan(draft);
    cliche = clicheScan(draft, strength);
    tongue = dialogueScan(draft, colloquialLevel);
    craft = craftLint({ text: draft, lang: hookLang });
    emotionLint = emotionCraftLint({ text: draft, lang: hookLang });
    webnovelLintRes = webnovelLint({ text: draft, lang: hookLang });
    archetypeLintRes = archetypeLint({ text: draft, opening: draft.slice(0, 500), lang: hookLang });
    narrativeLintRes = narrativeLint({ text: draft, lang: hookLang });
    rhythmRes = rhythmScan(draft);
    charLogic = characterLogicScan(cast, draft);
    styleCheckRes = styleProfile ? styleConsistencyScan(draft, styleProfile) : null;
    foreshadowRes = foreshadowLedger(draft, options.prevForeshadow ?? null);
    arcRes = arcTracker(Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v.arc])), draft, options.prevArc ?? null);
    secretRes = secretLedger(draft, options.prevSecrets ?? null, hookLang);
    stateRes = characterStateLedger(draft, options.prevStates ?? null, hookLang, Object.keys(cast));
    voicePrintRes = voicePrint(cast, draft, hookLang);
  dialogueAiTasteRes = dialogueAiTaste(draft);
  sceneEmotionFlatRes = sceneEmotionFlat(draft);
  sensoryDetailRes = sensoryDetail(draft);
  vagueWordRes = vagueWord(draft);
  dialogueNameCallRes = dialogueNameCall(draft, Object.keys(cast));
  dialoguePingpongRes = dialoguePingpong(draft);
  hollowActionRes = hollowAction(draft);
  emotionWhiplashRes = emotionWhiplash(draft);
  echoDialogueRes = echoDialogue(draft);
  expositionDialogueRes = expositionDialogue(draft);
  sceneSoftEndingRes = sceneSoftEnding(draft);
  emotionLabelDialogueRes = emotionLabelDialogue(draft);
  roundRobinDialogueRes = roundRobinDialogue(draft);
  rhetoricalBarrageRes = rhetoricalBarrage(draft);
  mirrorVisualDialogueRes = mirrorVisualDialogue(draft);
  mindReadingNarrationRes = mindReadingNarration(draft);
  crowdReactionRes = crowdReaction(draft);
  patheticFallacyRes = patheticFallacy(draft);
  omniscientTeaseRes = omniscientTease(draft);
  effortGlossRes = effortGloss(draft);
  reactionClicheRes = reactionCliche(draft);
  infoDeliveryRes = infoDelivery(draft);
  atmosphereTellRes = atmosphereTell(draft);
  confrontationDodgeRes = confrontationDodge(draft);
  selfIntroDumpRes = selfIntroDump(draft);
  moralNarrationRes = moralNarration(draft);
  emptyThreatRes = emptyThreat(draft);
  timeJumpPayoffRes = timeJumpPayoff(draft);
  emotionPropCrutchRes = emotionPropCrutch(draft);
  emotionVentClicheRes = emotionVentCliche(draft);
  actionEchoRes = actionEchoDialogue(draft);
  eavesdumpRes = eavesdropDump(draft);
  selfPityRes = selfPityLitany(draft);
  villainConfRes = villainOverconfession(draft);
  cheapForgiveRes = cheapForgiveness(draft);
  gratuityRes = witnessGratuity(draft);
  previewRes = previewVoiceover(draft);
  stanceRes = stanceFlip(draft);
  unplantedRes = unplantedAsset(draft);
  subtextEraseRes = subtextErase(draft);
  exitClicheRes = exitCliche(draft);
  phoneRelayRes = phoneRelay(draft);
  fakeChoiceRes = fakeChoice(draft);
  parenOverdirectRes = parenOverdirect(draft);
  abstractAccusationRes = abstractAccusation(draft);
  cheapEmpathyRes = cheapEmpathy(draft);
  fidgetPropRes = fidgetProp(draft);
  emptyVowRes = emptyVow(draft);
  apologyLoopRes = apologyLoop(draft);
  flashbackCrutchRes = flashbackCrutch(draft);
  accidentalSparkRes = accidentalSpark(draft);
  commFailRes = commFailCrutch(draft);
  drunkTruthRes = drunkTruth(draft);
  tearBaitRes = tearBait(draft);
  instantDeductionRes = instantDeduction(draft);
  recordsRes = recordsOnDemand(draft);
  walkInRes = walkInTiming(draft);
  helpOnDemandRes = helpOnDemand(draft);
  delayedRevealRes = delayedReveal(draft);
  instantTrustRes = instantTrust(draft);
  instantKinshipRes = instantKinship(draft);
  faintOnCueRes = faintOnCue(draft);
  alwaysLateRes = alwaysLate(draft);
  instantLoveRes = instantLove(draft);
  convenientEncounterRes = convenientEncounter(draft);
  forcedProximityRes = forcedProximity(draft);
  rescueRomanceRes = rescueRomance(draft);
  fightReconcileRes = fightReconcileCrutch(draft);
  instantRepentanceRes = instantRepentance(draft);
  talkDownRes = talkDownCrutch(draft);
  instantSurgeryRes = instantSurgery(draft);
  crowdFlipRes = crowdFlip(draft);
  instantHackRes = instantHack(draft);
  instantMarksmanRes = instantMarksman(draft);
  instantLanguageRes = instantLanguage(draft);
  wakeUpRes = wakeUpCall(draft);
  wakeOnCueRes = wakeOnCue(draft);
  woundOnCueRes = woundOnCue(draft);
  fatigueRes = fatigueOverdrive(draft);
  instantEscapeRes = instantEscape(draft);
  weaponJamRes = weaponJam(draft);
  evidenceBlankRes = evidenceBlank(draft);
  propMotifRhythmRes = propMotifRhythm(draft); // v2.133 物象母题节奏（重扫）
  blurtRes = childBlurt(draft);
  rumorSpeedRes = rumorSpeed(draft);
  resultsOnCueRes = resultsOnCue(draft);
  trafficOnCueRes = trafficOnCue(draft);
  vehicleJamRes = vehicleJam(draft);
  sleepTalkRes = sleepTalk(draft);
  feverTruthRes = feverTruth(draft);
  instantEndowmentRes = instantEndowment(draft);
  lastSecondRescueRes = lastSecondRescue(draft);
  villainStallRes = villainStall(draft);  teamBriefingRes = teamBriefing(draft);  deadlineRes = deadlineStretch(draft);
  interrogationRes = softInterrogation(draft);
  deathbedRes = deathbedConfession(draft);
  truthRes = truthSerum(draft);
  pregRes = pregnancyOnCue(draft);
  amnesiaRes = amnesiaOnCue(draft);
  terminalRes = terminalDiagnosisOnCue(draft);
  allergyRes = allergyOnCue(draft);
  blindnessRes = blindnessOnCue(draft);
  poisonRes = poisonOnCue(draft); // v2.109
  muteRes = muteOnCue(draft); // v2.110
  deafRes = deafOnCue(draft); // v2.111
  paralysisRes = paralysisOnCue(draft); // v2.112
    showDontTellRes = showDontTellScan(draft, hookLang);
    cliffhangerRes = cliffhangerScore(draft, hookLang, outline.cliffhanger);
    coolMomentRes = coolMomentScore(draft, hookLang);
    dialogueWaterRes = dialogueWaterCheck(draft, hookLang);
    conflictDensityRes = conflictDensityCheck(draft, hookLang);
    punchlineDensityRes = punchlineDensityScore(draft, hookLang);
    sceneDensityRes = sceneDensityScore(draft, hookLang);
    repetitionRes = repetitionCheck(draft, hookLang);
    characterBalanceRes = characterBalanceCheck(draft, cast, hookLang);
    twistDensityRes = twistDensityScore(draft, hookLang);
    dialogueLengthRes = dialogueLengthScore(draft, hookLang);
    informationDensityRes = informationDensityScore(draft, hookLang);
    suspenseTensionRes = suspenseTensionCurve(draft, hookLang);
    sceneHeaderRes = sceneHeaderConvention(draft, hookLang);
    dialogueFunctionRes = dialogueFunctionalityCheck(draft, hookLang);
    causalLogicRes = causalLogicCheck(draft, hookLang);
    protagonistGoalRes = protagonistGoalCheck(draft, hookLang);
    antagonistQualityRes = antagonistQualityCheck(draft, hookLang);
    payoffRhythmRes = payoffRhythmCheck(draft, hookLang);
    relationshipRes = relationshipProgressionCheck(draft, hookLang);
    scenePaddingRes = scenePaddingCheck(draft, hookLang);
    supportingRes = supportingCharacterCheck(draft, cast, hookLang);
    conflictEscalationRes = conflictEscalationCheck(draft, hookLang);
    subtextRes = subtextCheck(draft, hookLang);
    supportingArcRes = supportingArcCheck(draft, cast, hookLang);
    scenePurposeRes = scenePurposeCheck(draft, hookLang);
    timelineConsistencyRes = timelineConsistencyCheck(draft, hookLang);
    continuitySupervisionRes = continuitySupervisionCheck(draft, hookLang);
    misunderstandingDragRes = misunderstandingDragCheck(draft, hookLang);
    plotArmorRes = plotArmorCheck(draft, hookLang);
    evidenceChainRes = evidenceChainCheck(draft, hookLang);
    cheatRuleRes = cheatRuleCheck(draft, hookLang);
    memoryFakeoutRes = memoryFakeoutCheck(draft, hookLang);
    emotionalAftermathRes = emotionalAftermathCheck(draft, hookLang);
    locationContinuityRes = locationContinuityCheck(draft, hookLang);
    characterPresenceRes = characterPresenceCheck(draft, hookLang);
    openingWeldRes = openingContinuityCheck(options.prevEpisode?.ending ?? '', draft, hookLang); // v2.80 焊点承接随轮重算
    // craft-lint + 进阶尺子 P1 硬伤触发重试；P2 仅作评分卡回显，不打断流程
    // v2.104 节奏 high 级问题（平开场/无冲突）+ 人物 high 级问题（悬空人物）也触发重试
    // v2.105 风格 high 级问题（时代/风格禁用词）也触发重试
    // v2.110 伏笔悬空(high) + 弧光情绪跳变(high) 也触发重试
    // v2.111 对白同质化(high) 也触发重试——短剧第一差评点"所有角色一个味儿"
    const depthP1 = [...emotionLint.p1, ...webnovelLintRes.p1, ...archetypeLintRes.p1];
    const rhythmHigh = rhythmRes.issues.filter((i) => i.severity === 'high');
    const charHigh = charLogic.issues.filter((i) => i.severity === 'high');
    const styleHigh = styleCheckRes ? styleCheckRes.issues.filter((i) => i.severity === 'high') : [];
    const foreshadowHigh = foreshadowRes.issues.filter((i) => i.severity === 'high');
    const arcHigh = arcRes.issues.filter((i) => i.severity === 'high');
    const voiceHigh = voicePrintRes.issues.filter((i) => i.severity === 'high');
    const sdtHigh = showDontTellRes.issues.filter((i) => i.severity === 'high');
    // v2.113 集尾钩子 high 级问题（无钩子/弱钩子）触发重试——短剧留存生死线
    const cliffhangerHigh = cliffhangerRes.issues.filter((i) => i.severity === 'high');
    // v2.114 爽点密度 high 级问题（无爽点/爽点不足3个）触发重试——短剧爽感生死线
    const coolMomentHigh = coolMomentRes.issues.filter((i) => i.severity === 'high');
    // v2.115 台词水分 high 级问题（水分率>40%/寒暄过多）触发重试——短剧信息密度生死线
    const dialogueWaterHigh = dialogueWaterRes.issues.filter((i) => i.severity === 'high');
    // v2.116 冲突密度 high 级问题（无冲突/冲突不足3个）触发重试——短剧驱动力生死线
    const conflictDensityHigh = conflictDensityRes.issues.filter((i) => i.severity === 'high');
    // v2.117 金句密度 high 级问题（无金句/金句不足2个）触发重试——短剧传播力生死线
    const punchlineDensityHigh = punchlineDensityRes.issues.filter((i) => i.severity === 'high');
    // v2.118 场景密度 high 级问题（单场景/静态场景过多）触发重试——短剧节奏生死线
    const sceneDensityHigh = sceneDensityRes.issues.filter((i) => i.severity === 'high');
    // v2.119 重复感 high 级问题（3+近似重复台词）触发重试——短剧新鲜感生死线
    const repetitionHigh = repetitionRes.issues.filter((i) => i.severity === 'high');
    // v2.120 角色戏份均衡 high 级问题（主角戏份不足/独白剧/戏份悬殊）触发重试——短剧人物驱动生死线
    const characterBalanceHigh = characterBalanceRes.issues.filter((i) => i.severity === 'high');
    // v2.121 反转密度 high 级问题（无反转/反转不足2个）触发重试——短剧反转生死线
    const twistDensityHigh = twistDensityRes.issues.filter((i) => i.severity === 'high');
    // v2.122 对白长度 high 级问题（台词墙/超长占比过高/严重独白）触发重试——短剧节奏生死线
    const dialogueLengthHigh = dialogueLengthRes.issues.filter((i) => i.severity === 'high');
    // v2.123 信息密度 high 级问题（水戏过多/钩子区空白/高潮区空白）触发重试——短剧信息推进生死线
    const informationDensityHigh = informationDensityRes.issues.filter((i) => i.severity === 'high');
    // v2.124 悬念张力 high 级问题（连续平铺/曲线平铺/开场弱/收尾弱）触发重试——短剧悬念生死线
    const suspenseTensionHigh = suspenseTensionRes.issues.filter((i) => i.severity === 'high');
    const sceneHeaderHigh = sceneHeaderRes.issues.filter((i) => i.severity === 'high');
    const dialogueFunctionHigh = dialogueFunctionRes.issues.filter((i) => i.severity === 'high');
    // v2.127 因果逻辑 high 级问题（巧合过载/巧合解决/机械降神）触发重试——短剧可信度生死线
    const causalLogicHigh = causalLogicRes.issues.filter((i) => i.severity === 'high');
    // v2.128 主角目标 high 级问题（欲望隐形/被动主角）触发重试——短剧主角驱动生死线
    const protagonistGoalHigh = protagonistGoalRes.issues.filter((i) => i.severity === 'high');
    // v2.129 反派质量 high 级问题（反派缺席）触发重试——短剧压迫感生死线
    const antagonistQualityHigh = antagonistQualityRes.issues.filter((i) => i.severity === 'high');
    // v2.130 憋爽节奏 high 级问题（只虐不爽/憋太久）触发重试——短剧爽感兑现生死线
    const payoffRhythmHigh = payoffRhythmRes.issues.filter((i) => i.severity === 'high');
    // v2.131 情感关系 high 级问题（有名无实/突飞猛进）触发重试——短剧 CP 关系生死线
    const relationshipHigh = relationshipRes.issues.filter((i) => i.severity === 'high');
    // v2.132 场景注水 high 级问题（三无场景）触发重试——短剧节奏密度生死线
    const scenePaddingHigh = scenePaddingRes.issues.filter((i) => i.severity === 'high');
    // v2.133 配角工具人 high 级问题（捧哏型配角）触发重试——短剧群像质量生死线
    const supportingHigh = supportingRes.issues.filter((i) => i.severity === 'high');
    // v2.134 冲突原地踏步 high 级问题（烈度平台不爬坡）触发重试——短剧冲突升级生死线
    const conflictEscalationHigh = conflictEscalationRes.issues.filter((i) => i.severity === 'high');
    // v2.135 底牌直给 high 级问题（≥2 处目的/秘密被台词说破）触发重试——短剧潜台词生死线
    const subtextHigh = subtextRes.issues.filter((i) => i.severity === 'high');
    // v2.136 配角弧光 high 级问题（群像集体零变化/集体无铺垫倒戈）触发重试——短剧群像弧光生死线
    const supportingArcHigh = supportingArcRes.issues.filter((i) => i.severity === 'high');
    // v2.137 场景目的 high 级问题（多场目的稀释/多对重复目的场）触发重试——短剧场景经济学生死线
    const scenePurposeHigh = scenePurposeRes.issues.filter((i) => i.severity === 'high');
    // v2.138 时间线 high 级问题（倒计时多处反转）触发重试——短剧时间逻辑生死线
    const timelineHigh = timelineConsistencyRes.issues.filter((i) => i.severity === 'high');
    // v2.139 场记连续性 high 级问题（伤势反复无痕）触发重试——短剧物理状态穿帮生死线
    const continuityHigh = continuitySupervisionRes.issues.filter((i) => i.severity === 'high');
    // v2.140 误会拖延 high 级问题（重复拒绝倾听硬造误会）触发重试——短剧"为了误会而误会"生死线
    const misunderstandingHigh = misunderstandingDragRes.issues.filter((i) => i.severity === 'high');
    // v2.141 反派降智/主角光环 high 级问题（翻盘靠对手拆台/致命无伤）触发重试——短剧胜利可信度生死线
    const plotArmorHigh = plotArmorRes.issues.filter((i) => i.severity === 'high');
    // v2.142 证据链 high 级问题（重复物证空降/重复人证空降）触发重试——翻盘公平性生死线
    const evidenceChainHigh = evidenceChainRes.issues.filter((i) => i.severity === 'high');
    // v2.143 金手指 high 级问题（重复先用后立规/重复无规则觉醒/重复许愿机）触发重试——外挂公平性生死线
    const cheatRuleHigh = cheatRuleRes.issues.filter((i) => i.severity === 'high');
    // v2.144 梦境假反转 high 级问题（重复无标记梦醒诈骗）触发重试——记忆手法公平性生死线
    const memoryFakeoutHigh = memoryFakeoutRes.issues.filter((i) => i.severity === 'high');
    // v2.145 情绪秒清零 high 级问题（重复创伤后立刻有说有笑）触发重试——情绪连续性生死线
    const emotionalAftermathHigh = emotionalAftermathRes.issues.filter((i) => i.severity === 'high');
    // v2.146 跨城瞬移 high 级问题（重复无交通/时间交代换城市）触发重试——空间连续性生死线
    const locationContinuityHigh = locationContinuityRes.issues.filter((i) => i.severity === 'high');
    // v2.147 在场感 high 级问题（第 2 次离场幽灵/亡者开口）触发重试——角色在场连续性生死线
    const characterPresenceHigh = characterPresenceRes.issues.filter((i) => i.severity === 'high');
    // v2.80 焊点断裂 high 级问题（前集结尾说话人全灭且零词汇衔接）触发重试——跨集焊点生死线
    const openingWeldHigh = openingWeldRes.issues.filter((i) => i.severity === 'high');
    const craftPass = craft.p1.length === 0 && depthP1.length === 0 && rhythmHigh.length === 0 && charHigh.length === 0 && styleHigh.length === 0 && foreshadowHigh.length === 0 && arcHigh.length === 0 && voiceHigh.length === 0 && sdtHigh.length === 0 && cliffhangerHigh.length === 0 && coolMomentHigh.length === 0 && dialogueWaterHigh.length === 0 && conflictDensityHigh.length === 0 && punchlineDensityHigh.length === 0 && sceneDensityHigh.length === 0 && repetitionHigh.length === 0 && characterBalanceHigh.length === 0 && twistDensityHigh.length === 0 && dialogueLengthHigh.length === 0 && informationDensityHigh.length === 0 && suspenseTensionHigh.length === 0 && sceneHeaderHigh.length === 0 && dialogueFunctionHigh.length === 0 && causalLogicHigh.length === 0 && protagonistGoalHigh.length === 0 && antagonistQualityHigh.length === 0 && payoffRhythmHigh.length === 0 && relationshipHigh.length === 0 && scenePaddingHigh.length === 0 && supportingHigh.length === 0 && conflictEscalationHigh.length === 0 && subtextHigh.length === 0 && supportingArcHigh.length === 0 && scenePurposeHigh.length === 0 && timelineHigh.length === 0 && continuityHigh.length === 0 && misunderstandingHigh.length === 0 && plotArmorHigh.length === 0 && evidenceChainHigh.length === 0 && cheatRuleHigh.length === 0 && memoryFakeoutHigh.length === 0 && emotionalAftermathHigh.length === 0 && locationContinuityHigh.length === 0 && characterPresenceHigh.length === 0 && openingWeldHigh.length === 0;
    if (antiAi.pass && consist.pass && cliche.pass && tongue.pass && craftPass) break;
    const reason = hookLang === 'en'
      ? (!antiAi.pass
        ? `De-AI flagged: ${antiAi.hits.slice(0, 3).join(', ')}`
        : !cliche.pass
          ? `Anti-cliché gate: stale beats ${cliche.hits.slice(0, 2).map((h) => h.found).join(', ')}; novelty ${cliche.noveltyScore}`
          : !tongue.pass
            ? `Written-sounding dialogue: ${tongue.hits.slice(0, 3).map((h) => h.word).join(', ')}; colloquial ${tongue.colloquialScore}`
            : !craftPass
              ? `Craft yardstick (P1): ${craft.p1.concat(depthP1).slice(0, 3).map((i) => i.dim).join(', ')}`
              : `Consistency: ${consist.misses[0]}`)
      : (!antiAi.pass
        ? `去AI化抓到：${antiAi.hits.slice(0, 3).join('、')}`
        : !cliche.pass
          ? `反套路闸门：老套桥段 ${cliche.hits.slice(0, 2).map((h) => h.found).join('、')}，新颖度${cliche.noveltyScore}`
          : !tongue.pass
            ? `台词书面腔：${tongue.hits.slice(0, 3).map((h) => h.word).join('、')}，口语度${tongue.colloquialScore}`
            : !craftPass
              ? `创作尺子(P1)：${craft.p1.concat(depthP1).slice(0, 3).map((i) => i.dim).join('、')}`
              : `一致性：${consist.misses[0]}`);
    emit({ role: 'polisher', status: 'retry', note: hookLang === 'en' ? `${reason} — sent back for revision` : `${reason}，打回修订` });
    // craft-lint + 进阶尺子 P1 建议逐字注入润色师重试提示词，让模型按一线编剧尺子修
    const allCraftP1 = [...craft.p1, ...depthP1];
    const craftAdvice = allCraftP1.length
      ? (hookLang === 'en'
          ? `\n[Frontline craft revision yardsticks — MUST address]\n${allCraftP1.map((i) => `- ${i.dim}: ${i.advice}`).join('\n')}`
          : `\n【一线编剧改稿尺子·必须解决】\n${allCraftP1.map((i) => `- ${i.dim}：${i.advice}`).join('\n')}`)
      : '';
    // v2.104 节奏 + 人物问题建议注入重试提示词（英文链路用 type 映射英文描述，避免中文泄漏）
    const RHYTHM_EN: Record<string, string> = {
      flat_open: 'Opening lacks hook/conflict in first 120 chars — open with conflict or startling image, not setup',
      no_conflict: 'Not enough conflict signals — add at least 2-3 confrontation points',
      no_turn: 'No reversal/turn detected — arrange an unexpected twist in the mid-to-late section',
      no_blank: 'Ending has no hook or breathing room — end on a question/cliffhanger/action cut',
      no_breath: 'Action-line ratio too low — insert action/expression/environment beats to break dialogue walls',
      over_describe: 'Action-line ratio too high — use dialogue to push conflict, trim over-description',
    };
    const CHAR_EN: Record<string, string> = {
      missing: 'Character declared in cast but never appears this episode — either bring them on or remove from cast',
      background: 'Character only mentioned, has no dialogue — give them at least one line with personal stance',
      voice_break: 'Character voice inconsistent with declared profile — adjust dialogue to match persona',
      emotion_jump: 'Emotion polarity hard-cuts without transition — add action/pause buffer',
      tool_support: 'Minor character is a pure plot device — give them a small independent reaction',
    };
    const rhythmAdvice = rhythmHigh.length
      ? (hookLang === 'en'
          ? `\n[Rhythm issues — MUST address]\n${rhythmHigh.map((i) => `- ${i.type}: ${RHYTHM_EN[i.type] ?? i.type}`).join('\n')}`
          : `\n【节奏问题·必须解决】\n${rhythmHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    const charAdvice = charHigh.length
      ? (hookLang === 'en'
          ? `\n[Character logic issues — MUST address]\n${charHigh.map((i) => `- ${i.type} (${i.character}): ${CHAR_EN[i.type] ?? i.type}`).join('\n')}`
          : `\n【人物逻辑问题·必须解决】\n${charHigh.map((i) => `- ${i.type}（${i.character}）：${i.advice}`).join('\n')}`)
      : '';
    // v2.105 风格一致性问题建议注入重试提示词
    const STYLE_EN: Record<string, string> = {
      anachronism: 'Anachronism / style-breaking word detected — remove and replace with era-appropriate expression',
      too_long: 'Dialogue sentences exceed the style profile length limit — break into shorter sentences',
      not_colloquial: 'Dialogue lacks colloquial particles for this high-colloquial style — add natural tone particles',
      region_missing: 'Regional flavor words missing — sprinkle a few naturally, do not over-stack',
    };
    const styleAdvice = styleHigh.length
      ? (hookLang === 'en'
          ? `\n[Style consistency issues — MUST address]\n${styleHigh.map((i) => `- ${i.type}: ${STYLE_EN[i.type] ?? i.type}`).join('\n')}`
          : `\n【风格一致性问题·必须解决】\n${styleHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.110 伏笔+弧光问题建议注入重试提示词
    const FORESHADOW_EN: Record<string, string> = {
      dangling_foreshadow: 'Foreshadowing planted but never paid off — add a payoff/reveal this episode to resolve the dangling thread',
      empty_payoff: 'Payoff signal appears but no corresponding plant — either add a setup earlier or soften the reveal language',
      no_foreshadow: 'No foreshadow plants or payoffs this episode — add at least one cross-episode thread (object/hint)',
    };
    const foreshadowAdvice = foreshadowHigh.length
      ? (hookLang === 'en'
          ? `\n[Foreshadow issues — MUST address]\n${foreshadowHigh.map((i) => `- ${i.type}: ${FORESHADOW_EN[i.type] ?? i.advice}`).join('\n')}`
          : `\n【伏笔问题·必须解决】\n${foreshadowHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    const ARC_EN: Record<string, string> = {
      arc_stalled: 'Character arc stalled — no emotion/stage change from last episode; give them a new challenge or turning point',
      emotion_jump: 'Emotion jumps from calm/hope to despair without fear transition — add intermediate fear/hesitation beats',
    };
    const arcAdvice = arcHigh.length
      ? (hookLang === 'en'
          ? `\n[Character arc issues — MUST address]\n${arcHigh.map((i) => `- ${i.type}: ${ARC_EN[i.type] ?? i.advice}`).join('\n')}`
          : `\n【角色弧光问题·必须解决】\n${arcHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.111 对白同质化问题建议注入重试提示词（advice 字段已按 hookLang 本地化，无需额外映射表）
    const voiceAdvice = voiceHigh.length
      ? (hookLang === 'en'
          ? `\n[Voice homogenization issues — MUST address]\n${voiceHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【对白同质化问题·必须解决】\n${voiceHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.112 "展示而非叙述"问题建议注入重试提示词
    const sdtAdvice = sdtHigh.length
      ? (hookLang === 'en'
          ? `\n[Show Don't Tell issues — MUST address]\n${sdtHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【展示而非叙述·必须解决】\n${sdtHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.113 集尾钩子问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const cliffhangerAdvice = cliffhangerHigh.length
      ? (hookLang === 'en'
          ? `\n[Cliffhanger issues — MUST address]\n${cliffhangerHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【集尾钩子·必须解决】\n${cliffhangerHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.114 爽点密度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const coolMomentAdvice = coolMomentHigh.length
      ? (hookLang === 'en'
          ? `\n[Cool moment density issues — MUST address]\n${coolMomentHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【爽点密度·必须解决】\n${coolMomentHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.115 台词水分问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const dialogueWaterAdvice = dialogueWaterHigh.length
      ? (hookLang === 'en'
          ? `\n[Dialogue water issues — MUST address]\n${dialogueWaterHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【台词水分·必须解决】\n${dialogueWaterHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.116 冲突密度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const conflictDensityAdvice = conflictDensityHigh.length
      ? (hookLang === 'en'
          ? `\n[Conflict density issues — MUST address]\n${conflictDensityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【冲突密度·必须解决】\n${conflictDensityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.117 金句密度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const punchlineDensityAdvice = punchlineDensityHigh.length
      ? (hookLang === 'en'
          ? `\n[Punchline density issues — MUST address]\n${punchlineDensityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【金句密度·必须解决】\n${punchlineDensityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.118 场景密度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const sceneDensityAdvice = sceneDensityHigh.length
      ? (hookLang === 'en'
          ? `\n[Scene density issues — MUST address]\n${sceneDensityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【场景密度·必须解决】\n${sceneDensityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.119 重复感问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const repetitionAdvice = repetitionHigh.length
      ? (hookLang === 'en'
          ? `\n[Repetition issues — MUST address]\n${repetitionHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【重复感·必须解决】\n${repetitionHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.120 角色戏份均衡问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const characterBalanceAdvice = characterBalanceHigh.length
      ? (hookLang === 'en'
          ? `\n[Character balance issues — MUST address]\n${characterBalanceHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【角色戏份均衡·必须解决】\n${characterBalanceHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.121 反转密度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const twistDensityAdvice = twistDensityHigh.length
      ? (hookLang === 'en'
          ? `\n[Twist density issues — MUST address]\n${twistDensityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【反转密度·必须解决】\n${twistDensityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.122 对白长度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const dialogueLengthAdvice = dialogueLengthHigh.length
      ? (hookLang === 'en'
          ? `\n[Dialogue length issues — MUST address]\n${dialogueLengthHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【对白长度·必须解决】\n${dialogueLengthHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.123 信息密度问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const informationDensityAdvice = informationDensityHigh.length
      ? (hookLang === 'en'
          ? `\n[Information density issues — MUST address]\n${informationDensityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【信息密度·必须解决】\n${informationDensityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.124 悬念张力问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const suspenseTensionAdvice = suspenseTensionHigh.length
      ? (hookLang === 'en'
          ? `\n[Suspense tension issues — MUST address]\n${suspenseTensionHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【悬念张力·必须解决】\n${suspenseTensionHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.125 场景标题规范问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const sceneHeaderAdvice = sceneHeaderHigh.length
      ? (hookLang === 'en'
          ? `\n[Scene header issues — MUST address]\n${sceneHeaderHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【场景标题·必须解决】\n${sceneHeaderHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.126 对白功能性问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const dialogueFunctionAdvice = dialogueFunctionHigh.length
      ? (hookLang === 'en'
          ? `\n[Dialogue function issues — MUST address]\n${dialogueFunctionHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【对白功能·必须解决】\n${dialogueFunctionHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.127 因果逻辑链问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const causalLogicAdvice = causalLogicHigh.length
      ? (hookLang === 'en'
          ? `\n[Causal logic issues — MUST address]\n${causalLogicHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【因果逻辑·必须解决】\n${causalLogicHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.128 主角目标与行动链问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const protagonistGoalAdvice = protagonistGoalHigh.length
      ? (hookLang === 'en'
          ? `\n[Protagonist goal & agency issues — MUST address]\n${protagonistGoalHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【主角目标与能动性·必须解决】\n${protagonistGoalHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.129 对手/反派质量问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const antagonistQualityAdvice = antagonistQualityHigh.length
      ? (hookLang === 'en'
          ? `\n[Antagonist quality issues — MUST address]\n${antagonistQualityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【对手/反派质量·必须解决】\n${antagonistQualityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.130 压抑-释放节奏问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const payoffRhythmAdvice = payoffRhythmHigh.length
      ? (hookLang === 'en'
          ? `\n[Payoff rhythm issues — MUST address]\n${payoffRhythmHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【憋爽节奏·必须解决】\n${payoffRhythmHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.131 情感关系递进问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const relationshipAdvice = relationshipHigh.length
      ? (hookLang === 'en'
          ? `\n[Romance/relationship issues — MUST address]\n${relationshipHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【情感关系递进·必须解决】\n${relationshipHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.132 场景注水问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const scenePaddingAdvice = scenePaddingHigh.length
      ? (hookLang === 'en'
          ? `\n[Scene padding/dead scenes — MUST address]\n${scenePaddingHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【场景注水/空转·必须解决】\n${scenePaddingHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.133 配角工具人问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const supportingAdvice = supportingHigh.length
      ? (hookLang === 'en'
          ? `\n[Cardboard supporting characters — MUST address]\n${supportingHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【配角工具人·必须解决】\n${supportingHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.134 冲突升级阶梯问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const conflictEscalationAdvice = conflictEscalationHigh.length
      ? (hookLang === 'en'
          ? `\n[Conflict escalation plateau — MUST address]\n${conflictEscalationHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【冲突原地踏步·必须解决】\n${conflictEscalationHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.135 底牌直给问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const subtextAdvice = subtextHigh.length
      ? (hookLang === 'en'
          ? `\n[On-the-nose dialogue / no subtext — MUST address]\n${subtextHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【台词直给·没有潜台词·必须解决】\n${subtextHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.136 配角弧光问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const supportingArcAdvice = supportingArcHigh.length
      ? (hookLang === 'en'
          ? `\n[Static ensemble / unearned conversion — MUST address]\n${supportingArcHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【配角零变化/突变倒戈·必须解决】\n${supportingArcHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.137 场景目的效率问题建议注入重试提示词（advice 字段已按 hookLang 本地化）
    const scenePurposeAdvice = scenePurposeHigh.length
      ? (hookLang === 'en'
          ? `\n[Scene purpose bloat / duplicated scenes — MUST address]\n${scenePurposeHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【一场多事/重复目的场·必须解决】\n${scenePurposeHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.138 时间线问题建议注入重试提示词（advice 字段已按 hookLang 本地化；high 仅倒计时多处反转）
    const timelineAdvice = timelineHigh.length
      ? (hookLang === 'en'
          ? `\n[Countdown reversal / timeline contradiction — MUST address]\n${timelineHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【倒计时越等越多/时间线矛盾·必须解决】\n${timelineHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.139 场记连续性问题建议注入重试提示词（advice 字段已按 hookLang 本地化；high 仅伤势反复无痕）
    const continuityAdvice = continuityHigh.length
      ? (hookLang === 'en'
          ? `\n[Physical state continuity error — MUST address]\n${continuityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【伤势/道具状态穿帮·必须解决】\n${continuityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.140 误会拖延问题建议注入重试提示词（advice 字段已按 hookLang 本地化；high 仅重复拒绝倾听）
    const misunderstandingAdvice = misunderstandingHigh.length
      ? (hookLang === 'en'
          ? `\n[Forced misunderstanding / refusal to communicate — MUST address]\n${misunderstandingHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【误会硬拖/拒绝沟通·必须解决】\n${misunderstandingHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.141 反派降智/主角光环问题建议注入重试提示词（advice 字段已按 hookLang 本地化；high 仅重复翻盘靠对手拆台/致命无伤）
    const plotArmorAdvice = plotArmorHigh.length
      ? (hookLang === 'en'
          ? `\n[Villain stupidity / plot armor — MUST address]\n${plotArmorHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【反派降智/主角光环·必须解决】\n${plotArmorHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.142 证据链公平性问题建议注入重试提示词（advice 字段已按 hookLang 本地化；high 仅重复物证/人证空降）
    const evidenceChainAdvice = evidenceChainHigh.length
      ? (hookLang === 'en'
          ? `\n[Unplanted evidence / airdropped witness — MUST address]\n${evidenceChainHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【翻盘证据链不公平·必须解决】\n${evidenceChainHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.143 金手指规则一致性问题建议注入重试提示词（advice 字段已按 hookLang 本地化；high 仅重复先用后立规/无规则觉醒/许愿机）
    const cheatRuleAdvice = cheatRuleHigh.length
      ? (hookLang === 'en'
          ? `\n[Cheat ability without rules — MUST address]\n${cheatRuleHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【金手指无规则/临时觉醒·必须解决】\n${cheatRuleHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.144 梦境/记忆手法问题建议注入重试提示词（advice 已按 hookLang 本地化；high 仅重复无标记梦醒假反转）
    const memoryFakeoutAdvice = memoryFakeoutHigh.length
      ? (hookLang === 'en'
          ? `\n[Dream fake-out / unmarked flashback — MUST address]\n${memoryFakeoutHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【梦醒假反转/记忆手法失范·必须解决】\n${memoryFakeoutHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.145 情绪余波问题建议注入重试提示词（advice 已按 hookLang 本地化；high 仅重复创伤后秒清零）
    const emotionalAftermathAdvice = emotionalAftermathHigh.length
      ? (hookLang === 'en'
          ? `\n[Instant emotional reset after trauma — MUST address]\n${emotionalAftermathHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【情绪秒清零·创伤后立刻有说有笑·必须解决】\n${emotionalAftermathHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.146 空间位移问题建议注入重试提示词（advice 已按 hookLang 本地化；high 仅重复跨城瞬移）
    const locationContinuityAdvice = locationContinuityHigh.length
      ? (hookLang === 'en'
          ? `\n[Instant travel / unmarked location jump — MUST address]\n${locationContinuityHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【跨城瞬移/空间无交代·必须解决】\n${locationContinuityHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.147 角色在场感问题建议注入重试提示词（high 仅第 2 次离场幽灵/亡者开口）
    const characterPresenceAdvice = characterPresenceHigh.length
      ? (hookLang === 'en'
          ? `\n[Ghost action after exit / presence continuity — MUST address]\n${characterPresenceHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}`
          : `\n【角色离场后仍活动/在场感断裂·必须解决】\n${characterPresenceHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}`)
      : '';
    // v2.80 焊点断裂建议注入重试提示词（high 仅"前集结尾说话人全灭+零词汇衔接"），并附前集结尾原句让润色师有的放矢
    const openingWeldAdvice = openingWeldHigh.length
      ? (hookLang === 'en'
          ? `\n[Episode weld broken — the opening ignores the previous ending — MUST address]\n${openingWeldHigh.map((i) => `- ${i.type}: ${i.advice}`).join('\n')}${options.prevEpisode?.ending ? `\n[Previous ending to pick up from]\n  "${(options.prevEpisode.ending ?? '').slice(0, 200)}"` : ''}`
          : `\n【跨集焊点断裂·开场无视前集结尾·必须解决】\n${openingWeldHigh.map((i) => `- ${i.type}：${i.advice}`).join('\n')}${options.prevEpisode?.ending ? `\n【必须承接的前集结尾原句】\n  「${(options.prevEpisode.ending ?? '').slice(0, 200)}」` : ''}`)
      : '';
    const fixed = (await _textRole(tier, 'polisher',
      `${hookLang === 'en'
        ? `${directive('polisher', 'en')}\n${G.removeAiTells}${antiAi.hits.join(', ')}\n${G.replaceCliche}${cliche.hits.map((h) => `${h.found}->${h.alt}`).join('; ')}\n${G.makeSpeakable}${tongue.hits.map((h) => `${h.word}->${h.fix}`).join('; ')}\n${lifeDetailDirective(draft, 'en')} ${G.filmable} ${G.genericReaction}${craftAdvice}${rhythmAdvice}${charAdvice}${styleAdvice}${foreshadowAdvice}${arcAdvice}${voiceAdvice}${sdtAdvice}${cliffhangerAdvice}${coolMomentAdvice}${dialogueWaterAdvice}${conflictDensityAdvice}${punchlineDensityAdvice}${sceneDensityAdvice}${repetitionAdvice}${characterBalanceAdvice}${twistDensityAdvice}${dialogueLengthAdvice}${informationDensityAdvice}${suspenseTensionAdvice}${sceneHeaderAdvice}${dialogueFunctionAdvice}${causalLogicAdvice}${protagonistGoalAdvice}${antagonistQualityAdvice}${payoffRhythmAdvice}${relationshipAdvice}${scenePaddingAdvice}${supportingAdvice}${conflictEscalationAdvice}${subtextAdvice}${supportingArcAdvice}${scenePurposeAdvice}${timelineAdvice}${continuityAdvice}${misunderstandingAdvice}${plotArmorAdvice}${evidenceChainAdvice}${cheatRuleAdvice}${memoryFakeoutAdvice}${emotionalAftermathAdvice}${locationContinuityAdvice}${characterPresenceAdvice}${openingWeldAdvice}\n${G.keepChars}${Object.keys(cast).join(', ')}\n${formatDirective}\n${layoutKeepRule}\n${G.originalDraft}${draft.slice(0, 8000)}`
        : `${directive('polisher')}\n必须删除AI腔:${antiAi.hits.join('、')}\n必须替换老套桥段:${cliche.hits.map((h) => `${h.found}→${h.alt}`).join('；')}\n必须把书面腔改成能念出口的人话:${tongue.hits.map((h) => `${h.word}→${h.fix}`).join('；')}\n${lifeDetailDirective(draft)}；把抽象叙述改成可拍摄的具体动作/道具${(() => { const g = genericReactionScan(draft); return g.hits.length ? `；身份/真相揭晓处把这些偷懒的通用反应(${g.hits.join('、')})改成只有此人物才会说的专属反应/动作` : ''; })()}${craftAdvice}${rhythmAdvice}${charAdvice}${styleAdvice}${foreshadowAdvice}${arcAdvice}${voiceAdvice}${sdtAdvice}${cliffhangerAdvice}${coolMomentAdvice}${dialogueWaterAdvice}${conflictDensityAdvice}${punchlineDensityAdvice}${sceneDensityAdvice}${repetitionAdvice}${characterBalanceAdvice}${twistDensityAdvice}${dialogueLengthAdvice}${informationDensityAdvice}${suspenseTensionAdvice}${sceneHeaderAdvice}${dialogueFunctionAdvice}${causalLogicAdvice}${protagonistGoalAdvice}${antagonistQualityAdvice}${payoffRhythmAdvice}${relationshipAdvice}${scenePaddingAdvice}${supportingAdvice}${conflictEscalationAdvice}${subtextAdvice}${supportingArcAdvice}${scenePurposeAdvice}${timelineAdvice}${continuityAdvice}${misunderstandingAdvice}${plotArmorAdvice}${evidenceChainAdvice}${cheatRuleAdvice}${memoryFakeoutAdvice}${emotionalAftermathAdvice}${locationContinuityAdvice}${characterPresenceAdvice}${openingWeldAdvice}\n保持人物:${Object.keys(cast).join('、')}\n${formatDirective}\n${layoutKeepRule}\n原稿:${draft.slice(0, 8000)}`}`, cost)).text;
    if (fixed.length > 100) draft = fixed;
  }
  // v2.18 双制式字数闭环（PRD 2.5 刚性）：闸门判 → 离线无损压缩/润色岗精修，超标先删叙述填充绝不动台词，不足按场景补视听细节不编造剧情
  // 字数不足/超限时最多重试 3 次（弱模型常不达 800 字下限或严重超标，需多轮精修）
  let lengthPlan = adaptScriptLength(draft, options.scriptFormat ?? 'LIVE', options.aigcDurationMin ?? 1);
  if (!lengthPlan.ready && lengthPlan.status === 'over' && lengthPlan.compressed && !lengthPlan.need) {
    draft = lengthPlan.compressed.text; // 超标且无损压缩可解决：直接用压缩稿
    lengthPlan = adaptScriptLength(draft, options.scriptFormat ?? 'LIVE', options.aigcDurationMin ?? 1);
  }
  let lenRetry = 0;
  // 记录距目标字数最近的版本，防止多轮修复间字数振荡（如 656→777→656 回落）
  let bestDraft = draft;
  let bestDist = Math.abs(lengthPlan.current - lengthPlan.target);
  while (!lengthPlan.ready && lenRetry < 3) {
    lenRetry += 1;
    emit({ role: 'polisher', status: 'retry', note: hookLang === 'en'
      ? `Length gate: ~${lengthPlan.current} chars now, must hit ${lengthPlan.range[0]}-${lengthPlan.range[1]} (target ${lengthPlan.target}) — revision ${lenRetry}`
      : `制式字数闸门：当前约${lengthPlan.current}字，需落在${lengthPlan.range[0]}-${lengthPlan.range[1]}字（目标${lengthPlan.target}），第${lenRetry}次精修` });
    // 字数不足时把逐场景扩写计划（缺口/补写类型）下发，模型按场景精确补写而非盲目重写
    const expandTypeEn: Record<string, string> = {
      '环境与烟火气细节': 'environment & life-detail',
      '人物微表情/小动作': 'micro-expression & small action',
      '内心活动外化': 'externalized inner state',
      '一个短台词回合': 'one short dialogue beat',
      '音效与氛围': 'sound effect & atmosphere',
    };
    const expansionPlan = lengthPlan.status === 'under' && lengthPlan.expansion?.length
      ? (hookLang === 'en'
        ? `\nAdd exactly as follows per scene (no new plot, only audiovisual/action/dialogue detail):\n${lengthPlan.expansion.map((s) => `- scene #${s.scene}: now ~${s.current} chars, add ~${s.targetAdd} via ${s.types.map((t) => expandTypeEn[t] ?? t).join(', ')}`).join('\n')}`
        : `\n逐场景精确补写（只补视听/动作/台词细节，不得编造新剧情）：\n${lengthPlan.expansion.map((s) => `- 场景「${s.head.slice(0, 20)}」：现约${s.current}字，补约${s.targetAdd}字，补写方向：${s.types.join('、')}`).join('\n')}`)
      : '';
    const monotoneRule = lengthPlan.status === 'under'
      ? (hookLang === 'en' ? '\nCRITICAL: only ADD content, never delete existing scenes/dialogue; the output must be LONGER than the input.' : '\n硬性要求：只许增补不许删减已有场景与台词，输出必须比原稿更长。')
      : '';
    // v2.80 AIGC 超限：给逐场硬预算表（真实模型只看总数会拒绝砍半），明确砍叙述保台词、必要时并场
    const trimPlan = lengthPlan.status === 'over' && (options.scriptFormat ?? 'LIVE') === 'AIGC'
      ? planTrim(draft, 'AIGC', options.aigcDurationMin ?? 1)
      : null;
    const trimDirective = trimPlan
      ? (hookLang === 'en'
        ? `\nHARD per-scene budget for the ${options.aigcDurationMin ?? 1}-min cut (total ~${trimPlan.target} character-equivalents), obey each row:\n${trimPlan.scenes.map((s) => s.drop
          ? `- scene #${s.scene} "${s.head}": MERGE this scene into a neighboring scene or delete it (do not keep it as its own scene)`
          : `- scene #${s.scene} "${s.head}": now ~${s.current}, keep AT MOST ~${s.targetKeep} (cut ~${s.cutUnits} of narration, keep every existing spoken line; spoken content is ${Math.round(s.spokenRatio * 100)}%${s.addDialogueUnits > 0 ? `, add ~${s.addDialogueUnits} units of short dialogue or (inner: ...) beats` : ''})`).join('\n')}\nCut secondary business, redundant atmosphere and repeated reactions; do NOT cut the opening hook, the ending cliffhanger, or any character dialogue.`
        : `\n${options.aigcDurationMin ?? 1}分钟成片逐场硬预算（全集约${trimPlan.target}字），必须逐场执行：\n${trimPlan.scenes.map((s) => s.drop
          ? `- 第${s.scene}场「${s.head}」：并入邻场或整组删掉，不得再作为独立场保留`
          : `- 第${s.scene}场「${s.head}」：现约${s.current}字，最多保留约${s.targetKeep}字（砍约${s.cutUnits}字叙述，台词一句不删；当前发声约占${Math.round(s.spokenRatio * 100)}%${s.addDialogueUnits > 0 ? `，需补约${s.addDialogueUnits}字短句台词或（内心：…）` : ''}）`).join('\n')}\n砍次要动作、重复氛围与同义反应；开头钩子、集尾卡点和人物台词不许删。`)
      : '';
    const lenTask = hookLang === 'en'
      ? `Length/format repair. The episode is about ${lengthPlan.current} character-equivalents but this ${options.scriptFormat === 'AIGC' ? `AIGC production script must be ${lengthPlan.range[0]}-${lengthPlan.range[1]} for its runtime; when UNDER, enrich audiovisual/micro-emotion/sound detail per scene (spoken dialogue+V.O. only 18-28%) without inventing new plot, when OVER, cut narration to the per-scene budget below and never pad` : `live-action shooting script must be 800-1000 characters, currently ${lengthPlan.current - lengthPlan.range[1]} OVER: keep only 3-4 scenes (~250 chars each), cut environment descriptions to one △ line each, merge or drop minor dialogue rounds, keep the opening hook and ending cliffhanger intact`}. Target around ${lengthPlan.target}. Keep every character consistent with: ${Object.keys(cast).join(', ')}.${expansionPlan}${trimDirective}${monotoneRule} Original:\n${draft.slice(0, 8000)}`
      : `制式字数修正：当前约${lengthPlan.current}字，本集为${options.scriptFormat === 'AIGC' ? `AIGC制作剧本，按成片时长须落在${lengthPlan.range[0]}-${lengthPlan.range[1]}字：不足时按场景补足视听/微情绪/音效细节（台词+OS仅占18%-28%），超限时严格按下面逐场预算只砍叙述不砍台词，均不得编造新剧情` : `真人实拍剧本必须800-1000字，当前超${lengthPlan.current - lengthPlan.range[1]}字：只保留3-4个场景（每场景压到约250字），环境/心理描写每处只留一条△动作行，合并或删掉次要台词回合，开头钩子与集尾卡点必须保留`}，目标约${lengthPlan.target}字；人物不得走样（${Object.keys(cast).join('、')}）。${expansionPlan}${trimDirective}${monotoneRule}原稿：\n${draft.slice(0, 8000)}`;
    const fixedLen = (await _textRole(tier, 'polisher', `${directive('polisher', hookLang)}\n${lenTask}\n${formatDirective}`, cost)).text;
    if (fixedLen.length > 100) draft = fixedLen;
    lengthPlan = adaptScriptLength(draft, options.scriptFormat ?? 'LIVE', options.aigcDurationMin ?? 1);
    const dist = Math.abs(lengthPlan.current - lengthPlan.target);
    if (dist < bestDist) { bestDist = dist; bestDraft = draft; }
  }
  // 修复后仍不达标：取回距目标最近的一版（振荡兜底），再重算闸门
  if (!lengthPlan.ready && bestDraft !== draft) {
    draft = bestDraft;
    lengthPlan = adaptScriptLength(draft, options.scriptFormat ?? 'LIVE', options.aigcDurationMin ?? 1);
  }
  // v2.80 AIGC 确定性硬剪兜底：真实模型多轮拒绝砍半时，只剪叙述句/必要时并场、台词全保，机械保证落入时长区间
  if (fmtMode === 'AIGC' && !lengthPlan.ready && lengthPlan.status === 'over') {
    const aigcDur0 = options.aigcDurationMin ?? 1;
    const ht = hardTrimToRange(draft, 'AIGC', aigcDur0);
    if (ht.after < ht.before) {
      draft = ht.text;
      lengthPlan = adaptScriptLength(draft, 'AIGC', aigcDur0);
      emit({ role: 'polisher', status: 'retry', note: hookLang === 'en'
        ? `Length ceiling enforced deterministically: ${ht.before} -> ${ht.after} character-equivalents (narration-only trim${ht.droppedScenes.length ? `, merged scene(s) #${ht.droppedScenes.join(', #')}` : ''}); all dialogue kept`
        : `超限硬剪兜底：${ht.before}→${ht.after}字（只剪叙述句${ht.droppedScenes.length ? `，并入第${ht.droppedScenes.join('、')}场` : ''}），台词一句未删` });
    }
  }
  // v2.79 版式修复轮（LIVE）：字数达标后若缺 △动作行/规范台词行，说明成稿小说化，润色岗按强制版式重排（最多2轮，不改剧情只改行式）
  // v2.338 同一轮兼修制片硬伤：场次/说话角色超上限时，连同诊断一起下发重排任务（并场、删减过场角色），修不掉就如实报错
  if ((options.scriptFormat ?? 'LIVE') === 'LIVE') {
    let fmtReport = validateScript(draft, 'LIVE');
    let fmtRetry = 0;
    // v2.338 制片硬伤同样触发重排：v2.337 的闸门只会报「不可拍」，不驱动重写等于只报错不救稿
    const productionHigh = () => (fmtReport.feasibility?.issues ?? []).filter((x) => x.severity === 'high');
    while ((!fmtReport.hasAction || !fmtReport.hasDialogue || productionHigh().length > 0) && fmtRetry < 2) {
      fmtRetry += 1;
      const missingAction = !fmtReport.hasAction;
      const missingDialogue = !fmtReport.hasDialogue;
      const prodHigh = productionHigh();
      const layoutEn = `Layout gate: missing${missingAction ? ' △ action lines' : ''}${missingAction && missingDialogue ? ' and' : ''}${missingDialogue ? ' NAME: dialogue lines' : ''}`;
      const layoutZh = `剧本版式闸门：缺${missingAction ? '△动作提示行' : ''}${missingAction && missingDialogue ? '、' : ''}${missingDialogue ? '规范角色台词行' : ''}`;
      emit({ role: 'polisher', status: 'retry', note: hookLang === 'en'
        ? `${prodHigh.length ? `Production gate: ${prodHigh.length} blocking issue(s) — ${prodHigh.map((i) => i.message).join('; ')}; ` : ''}${missingAction || missingDialogue ? `${layoutEn}; ` : ''}re-flow into a schedulable screenplay without changing plot (round ${fmtRetry}/2)`
        : `${prodHigh.length ? `制片闸门：${prodHigh.map((i) => i.message).join('；')}；` : ''}${missingAction || missingDialogue ? `${layoutZh}；` : ''}按可拍摄规模重排（不改主线剧情，第${fmtRetry}/2轮）` });
      const fmtTask = hookLang === 'en'
        ? `${missingAction || missingDialogue ? 'The draft below was written as prose fiction. WITHOUT changing the plot or adding/removing events, re-flow it into the standard short-drama screenplay layout: (1) split every filmable action into its own △ line (one action per line, under 40 chars); (2) turn every spoken line into its own "NAME (emotion): dialogue" line; (3) start each scene with "SCENE: location time INT./EXT."; (4) keep 800-1000 characters total. ' : ''}${prodHigh.length ? `PRODUCTION REPAIR: the draft cannot be scheduled as written (${prodHigh.map((i) => i.message).join('; ')}). Keep the main plot, but merge scenes that share a location, drop or fold minor walk-on speakers into existing characters, and land back at 3-5 scenes and at most 6 speaking roles; every scene must still carry its own △ action line(s) and "NAME (emotion): dialogue" line(s), and the total must stay 800-1000 characters. Characters allowed: ${Object.keys(cast).join(', ')}. ` : ''}Draft:\n${draft.slice(0, 8000)}`
        : `${missingAction || missingDialogue ? '下面的成稿被写成了小说式叙述，请不改剧情、不增删情节，只重排成标准短剧剧本版式：①把每个可拍摄动作拆成独立的△行（每行一个动作，≤40字）；②把所有对白改写成“角色名（情绪）：台词”的独立行；③场景以“场景：地点 时间 内景/外景”开头；④总字数仍控制在800-1000字。' : ''}${prodHigh.length ? `制片重排：这份稿子按现在的规模排不出通告（${prodHigh.map((i) => i.message).join('；')}）。请保留主线剧情，把同一地点的相邻场合并、把非关键过场角色的台词并入已有角色或删去，压回3-5场、说话角色不超过6人；合并后每场仍要有△动作行与“角色名（情绪）：台词”行，总字数仍控制在800-1000字。可用人物：${Object.keys(cast).join('、')}。` : ''}原稿：\n${draft.slice(0, 8000)}`;
      const reformatted = (await _textRole(tier, 'polisher', `${directive('polisher', hookLang)}\n${fmtTask}\n${formatDirective}`, cost)).text;
      if (reformatted.length > 100) draft = reformatted;
      fmtReport = validateScript(draft, 'LIVE');
      lengthPlan = adaptScriptLength(draft, 'LIVE', options.aigcDurationMin ?? 1);
    }
  } else if (fmtMode === 'AIGC') {
    // v2.80 版式修复轮（AIGC）：字数达标后若场数/五维/流畅度/发声构成不合格（小说化、提示词化、台词嵌段落），
    // 润色岗只按 Z-AIGC 流畅本重排，不改剧情；issue 由机器诊断给出，英文链路全部英文（零中文）
    const aigcDur = options.aigcDurationMin ?? 1;
    let cov = validateAigcScreenplay(draft, hookLang === 'en' ? 'en' : 'zh');
    let aigcFmtRetry = 0;
    const maxFmtRetry = 3;
    while (!cov.pass && aigcFmtRetry < maxFmtRetry) {
      aigcFmtRetry += 1;
      const issueList = [...cov.sceneIssues, ...cov.smoothnessIssues, ...cov.compositionIssues].slice(0, 10);
      const comp = cov.composition;
      const spokenGap = comp && comp.spokenRatio < 0.18
        ? Math.max(80, Math.round((0.22 * comp.totalCjk) - comp.spokenCjk))
        : 0;
      const spokenDirective = spokenGap > 0
        ? (hookLang === 'en'
          ? `\nMANDATORY SPOKEN-RATIO FIX: current spoken content is ${Math.round(comp.spokenRatio * 100)}% (~${comp.spokenCjk} units), must reach 18-28%. Add about ${spokenGap} character-equivalents of short dialogue or (inner: ...) beats across the scenes (especially scenes with no dialogue). Cut an equal amount of atmosphere description to keep total length in range. Every non-transition scene MUST have at least one spoken line.`
          : `\n【硬指标·发声占比必须达标】当前台词+OS占比仅${Math.round(comp.spokenRatio * 100)}%（约${comp.spokenCjk}字），必须补到18%-28%。请在全场（尤其无台词的场次）增补约${spokenGap}字的短句台词或（内心：…）独白，同时删掉等量的环境/氛围描写以保持总字数不变。每个非过场短场都至少要有一句人物发声。`)
        : '';
      emit({ role: 'polisher', status: 'retry', note: hookLang === 'en'
        ? `AIGC layout gate (round ${aigcFmtRetry}/${maxFmtRetry}): ${issueList.length} standard issue(s); re-flowing into the Z-AIGC flowing script without changing plot`
        : `AIGC制式闸门（第${aigcFmtRetry}/${maxFmtRetry}轮）：${issueList.length}项场/五维/流畅度/构成问题，按Z-AIGC流畅本重排（不改剧情）` });
      const fmtTask = hookLang === 'en'
        ? `AIGC FORMAT REPAIR. The episode below fails the Z-AIGC flowing production-script standard. WITHOUT changing the plot, events, characters or total length (stay within ${lengthPlan.range[0]}-${lengthPlan.range[1]} character-equivalents for the ${aigcDur}-min cut), fix ONLY layout and texture:\n`
          + '1. Body text must be smooth, human-readable prose paragraphs: never △ markers, never prompt-sheet wording, never stacked [shot-size]/camera-move tags or keyword lists.\n'
          + '2. Every scene head on its own line as INT./EXT. PLACE - TIME; 3-5 scenes; no text lines outside a scene head.\n'
          + '3. Inner voice and sound are carried ONLY by natural parentheticals inside prose: (inner: ...), (V.O.: ...), (SFX: ...), (MUSIC: ...), (AMBIENT: ...).\n'
          + '4. Every spoken line is its own line as NAME (emotion): dialogue with short lines; spoken dialogue+V.O.+inner monologue totals 18-28% of text, the other 72-82% is non-spoken visual/action/atmosphere narrative.\n'
          + '5. Every scene renders five dimensions: environment/light/space, character action, micro-emotion, sound atmosphere, dialogue (only a very short transition beat may omit dialogue).\n'
          + spokenDirective
          + '\nMachine-detected issues to fix:\n- ' + issueList.join('\n- ')
          + `\nCharacters: ${Object.keys(cast).join(', ')}. Draft:\n${draft.slice(0, 8000)}`
        : `AIGC制式修复：下面的成稿未通过Z-AIGC流畅制作本标准。请不改剧情、不增删情节、不改人设，总字数仍保持在${lengthPlan.range[0]}-${lengthPlan.range[1]}字（${aigcDur}分钟成片）区间，只修正版式与肌理：\n`
          + '①正文必须是好读的流畅自然段：不加△、不写提示词式文字、不堆【景别】【运镜】等技术标签或关键词罗列；\n'
          + '②每个场标独占一行，格式为“内景/外景 地点·时间”，全集3-5场，不允许有游离在场标之外的文本行；\n'
          + '③内心/OS/画外音/音效/配乐/环境音只能用自然段内的自然括号承载，如（内心：…）（OS：…）（音效：…）（配乐：…）；\n'
          + '④每句台词独占一行，格式为“角色名（情绪）：台词”，用短句；台词+OS+内心独白只占全片18%-28%，其余72%-82%必须是不发声的环境/动作/氛围画面叙述；\n'
          + '⑤每场都要写足五个维度：环境光影空间、人物动作、微情绪、声音氛围、台词（极短过场短场可豁免台词）。\n'
          + spokenDirective
          + '\n机器诊断出的具体问题：\n- ' + issueList.join('\n- ')
          + `\n人物：${Object.keys(cast).join('、')}。原稿：\n${draft.slice(0, 8000)}`;
      const reformatted = (await _textRole(tier, 'polisher', `${directive('polisher', hookLang)}\n${fmtTask}\n${formatDirective}`, cost)).text;
      if (reformatted.length > 100) draft = reformatted;
      // 修复轮可能把字数推回超限：再做一次只剪叙述的硬剪，保证版式修复不冲破时长闸门
      const lpAfter = adaptScriptLength(draft, 'AIGC', aigcDur);
      if (!lpAfter.ready && lpAfter.status === 'over') draft = hardTrimToRange(draft, 'AIGC', aigcDur).text;
      cov = validateAigcScreenplay(draft, hookLang === 'en' ? 'en' : 'zh');
      lengthPlan = adaptScriptLength(draft, 'AIGC', aigcDur);
    }
    // v2.80 发声比兜底：3 轮修复后仍 <18%，确定性把叙述中的内心句转为 (inner:…) 独白
    if (!cov.pass && cov.composition && cov.composition.spokenRatio < 0.18) {
      const needUnits = Math.max(60, Math.round(0.22 * cov.composition.totalCjk) - cov.composition.spokenCjk);
      const before = draft;
      draft = boostSpokenRatio(draft, needUnits);
      if (draft !== before) {
        cov = validateAigcScreenplay(draft, hookLang === 'en' ? 'en' : 'zh');
        lengthPlan = adaptScriptLength(draft, 'AIGC', aigcDur);
        emit({ role: 'polisher', status: 'retry', note: hookLang === 'en'
          ? `Spoken-ratio floor enforced: converted inner-thought narration to (inner: ...) beats (~${needUnits} units)`
          : `发声比兜底：把叙述中的内心活动转为（内心：…）独白（约${needUnits}字）` });
      }
    }
    // v2.80 发声下限外科兜底：确定性转换无果（模型写纯外部动作 / 反复整稿重排把台词写残）后，
    // 让模型"只增不改"地给每个无声场各补一句极短发声，并把总占比补进 18-28%；任何回归一律拒收
    if (!cov.pass && cov.composition && cov.composition.spokenRatio < 0.18) {
      const curve = analyzeAigcSceneCurve(draft);
      const comp0 = cov.composition;
      const langEn = hookLang === 'en';
      // 补到 21% 的需求量；设微补硬上限（英 96 词 / 中 160 字），并保证不越过 26%（给括号词留余量到 28%）
      const addUnits = Math.min(langEn ? 96 : 160,
        Math.round(0.26 * comp0.totalCjk - comp0.spokenCjk),
        Math.max(langEn ? 10 : 16, Math.round(0.21 * comp0.totalCjk - comp0.spokenCjk)));
      // 分配补句配额：完全无声场各先补 1 句，再按发声从少到多追加，每场至多 2 句
      const perBeat = langEn ? 13 : 20;
      const order = [...curve].filter((c) => c.head).sort((a, b) => {
        const av = a.spokenCjk === 0 ? 0 : 1, bv = b.spokenCjk === 0 ? 0 : 1;
        return av - bv || a.spokenCjk - b.spokenCjk;
      });
      const beatsNeed = Math.max(curve.filter((c) => c.head && c.spokenCjk === 0).length,
        Math.min(order.length * 2, Math.ceil(addUnits / perBeat)));
      const beatsByNo = new Map<number, number>();
      for (const c of order) { if (beatsByNo.size >= Math.min(beatsNeed, order.length)) break; beatsByNo.set(c.scene, 1); }
      let extra = beatsNeed - beatsByNo.size;
      for (const c of order) { if (extra <= 0) break; beatsByNo.set(c.scene, (beatsByNo.get(c.scene) || 0) + 1); extra--; }
      const targetList = order.filter((c) => beatsByNo.get(c.scene)).map((c) => `"${c.head}" — ${beatsByNo.get(c.scene)} beat(s)`).join('; ');
      const prevIssueCount = cov.sceneIssues.length + cov.smoothnessIssues.length + cov.compositionIssues.length;
      const microTask = langEn
        ? `SPOKEN-BEAT INSERTION (strictly additive). The episode is only ${Math.round(comp0.spokenRatio * 100)}% spoken (floor is 18%).\n`
          + `Do NOT rewrite, paraphrase, reorder or delete ANY existing word, line or scene. ONLY ADD new spoken beats, distributed EXACTLY as listed:\n`
          + `- ${targetList}. Each beat is one short 6-${perBeat + 2}-word line; total new voice about ${addUnits} words.\n`
          + `Each beat is either a spoken line on its OWN line "NAME: line" or an "(inner: ...)" monologue (cue and text on the SAME line, never split across two lines), in the character's established voice and consistent with the action shown.\n`
          + `Stay within ${lengthPlan.range[0]}-${lengthPlan.range[1]} character-equivalents total; if near the ceiling, cut an equal amount of pure atmosphere description, never existing dialogue. Output the COMPLETE script verbatim with only the additions.\nCharacters: ${Object.keys(cast).join(', ')}.\nScript:\n${draft.slice(0, 8000)}`
        : `发声补写（严格只增不改）：下面成稿发声占比仅${Math.round(comp0.spokenRatio * 100)}%（下限18%）。\n`
          + `禁止改写、转述、调序或删除任何已有字句、场标与场次。只许按下面的场次配额新增发声：\n`
          + `- ${targetList}。每处补 1 句 ${Math.round(perBeat * 0.6)}-${perBeat + 4} 字短句；新增发声合计约${addUnits}字。\n`
          + `每句要么独占一行写成"角色名（情绪）：台词"，要么写成"（内心：…）"独白；角色名与内容必须在同一行、不得拆两行；贴合人物口吻与当下动作。\n`
          + `总字数仍须在${lengthPlan.range[0]}-${lengthPlan.range[1]}字区间；若接近上限，删减等量纯环境氛围描写，但不得删已有台词。请输出完整成稿，除新增发声外其余一字不动。\n人物：${Object.keys(cast).join('、')}。\n成稿：\n${draft.slice(0, 8000)}`;
      const micro = await _textRole(tier, 'polisher', `${directive('polisher', hookLang)}\n${microTask}\n${formatDirective}`, cost);
      const cand = micro.text || '';
      if (!micro.sandbox && cand.length > 100) {
        const ncov = validateAigcScreenplay(cand, langEn ? 'en' : 'zh');
        const nLen = adaptScriptLength(cand, 'AIGC', aigcDur);
        const nIssueCount = ncov.sceneIssues.length + ncov.smoothnessIssues.length + ncov.compositionIssues.length;
        if (ncov.composition && ncov.composition.spokenRatio >= 0.18 && ncov.composition.spokenRatio <= 0.28
          && nLen.ready && nIssueCount <= prevIssueCount) {
          draft = cand; cov = ncov; lengthPlan = nLen;
          emit({ role: 'polisher', status: 'retry', note: langEn
            ? `Spoken floor micro-patch: added ~${addUnits} words across quiet scenes, now ${Math.round(ncov.composition.spokenRatio * 100)}% spoken`
            : `发声下限微补：按场次配额补约${addUnits}字发声，现发声比${Math.round(ncov.composition.spokenRatio * 100)}%` });
        }
      }
    }
  }
  // 所有改稿与元注释清理必须先完成；下方完整复扫及跨集台账只读取实际交付稿。
  draft = stripModelMetaComments(draft);
  lengthPlan = adaptScriptLength(draft, options.scriptFormat ?? 'LIVE', options.aigcDurationMin ?? 1);
  antiAi = antiAiScan(draft);
  cliche = clicheScan(draft, strength);
  tongue = dialogueScan(draft, colloquialLevel);
  craft = craftLint({ text: draft, lang: hookLang });
  emotionLint = emotionCraftLint({ text: draft, lang: hookLang });
  webnovelLintRes = webnovelLint({ text: draft, lang: hookLang });
  archetypeLintRes = archetypeLint({ text: draft, opening: draft.slice(0, 500), lang: hookLang });
  narrativeLintRes = narrativeLint({ text: draft, lang: hookLang });
  rhythmRes = rhythmScan(draft);
  charLogic = characterLogicScan(cast, draft);
  styleCheckRes = styleProfile ? styleConsistencyScan(draft, styleProfile) : null;
  foreshadowRes = foreshadowLedger(draft, options.prevForeshadow ?? null);
  arcRes = arcTracker(Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v.arc])), draft, options.prevArc ?? null);
  secretRes = secretLedger(draft, options.prevSecrets ?? null, hookLang); // v2.80 终稿重算，保持台账数据新鲜
  stateRes = characterStateLedger(draft, options.prevStates ?? null, hookLang, Object.keys(cast));
  voicePrintRes = voicePrint(cast, draft, hookLang);
  dialogueAiTasteRes = dialogueAiTaste(draft);
  sceneEmotionFlatRes = sceneEmotionFlat(draft);
  sensoryDetailRes = sensoryDetail(draft);
  vagueWordRes = vagueWord(draft);
  dialogueNameCallRes = dialogueNameCall(draft, Object.keys(cast));
  dialoguePingpongRes = dialoguePingpong(draft);
  hollowActionRes = hollowAction(draft);
  emotionWhiplashRes = emotionWhiplash(draft);
  echoDialogueRes = echoDialogue(draft);
  expositionDialogueRes = expositionDialogue(draft);
  sceneSoftEndingRes = sceneSoftEnding(draft);
  emotionLabelDialogueRes = emotionLabelDialogue(draft);
  roundRobinDialogueRes = roundRobinDialogue(draft);
  rhetoricalBarrageRes = rhetoricalBarrage(draft);
  mirrorVisualDialogueRes = mirrorVisualDialogue(draft);
  mindReadingNarrationRes = mindReadingNarration(draft);
  crowdReactionRes = crowdReaction(draft);
  patheticFallacyRes = patheticFallacy(draft);
  omniscientTeaseRes = omniscientTease(draft);
  effortGlossRes = effortGloss(draft);
  reactionClicheRes = reactionCliche(draft);
  infoDeliveryRes = infoDelivery(draft);
  atmosphereTellRes = atmosphereTell(draft);
  confrontationDodgeRes = confrontationDodge(draft);
  selfIntroDumpRes = selfIntroDump(draft);
  moralNarrationRes = moralNarration(draft);
  emptyThreatRes = emptyThreat(draft);
  timeJumpPayoffRes = timeJumpPayoff(draft);
  emotionPropCrutchRes = emotionPropCrutch(draft);
  emotionVentClicheRes = emotionVentCliche(draft);
  actionEchoRes = actionEchoDialogue(draft);
  eavesdumpRes = eavesdropDump(draft);
  selfPityRes = selfPityLitany(draft);
  villainConfRes = villainOverconfession(draft);
  cheapForgiveRes = cheapForgiveness(draft);
  gratuityRes = witnessGratuity(draft);
  previewRes = previewVoiceover(draft);
  stanceRes = stanceFlip(draft);
  unplantedRes = unplantedAsset(draft);
  subtextEraseRes = subtextErase(draft);
  exitClicheRes = exitCliche(draft);
  phoneRelayRes = phoneRelay(draft);
  fakeChoiceRes = fakeChoice(draft);
  parenOverdirectRes = parenOverdirect(draft);
  abstractAccusationRes = abstractAccusation(draft);
  cheapEmpathyRes = cheapEmpathy(draft);
  fidgetPropRes = fidgetProp(draft);
  emptyVowRes = emptyVow(draft);
  apologyLoopRes = apologyLoop(draft);
  flashbackCrutchRes = flashbackCrutch(draft);
  accidentalSparkRes = accidentalSpark(draft);
  commFailRes = commFailCrutch(draft);
  drunkTruthRes = drunkTruth(draft);
  tearBaitRes = tearBait(draft);
  instantDeductionRes = instantDeduction(draft);
  recordsRes = recordsOnDemand(draft);
  walkInRes = walkInTiming(draft);
  helpOnDemandRes = helpOnDemand(draft);
  delayedRevealRes = delayedReveal(draft);
  instantTrustRes = instantTrust(draft);
  instantKinshipRes = instantKinship(draft);
  faintOnCueRes = faintOnCue(draft);
  alwaysLateRes = alwaysLate(draft);
  instantLoveRes = instantLove(draft);
  convenientEncounterRes = convenientEncounter(draft);
  forcedProximityRes = forcedProximity(draft);
  rescueRomanceRes = rescueRomance(draft);
  fightReconcileRes = fightReconcileCrutch(draft);
  instantRepentanceRes = instantRepentance(draft);
  talkDownRes = talkDownCrutch(draft);
  instantSurgeryRes = instantSurgery(draft);
  crowdFlipRes = crowdFlip(draft);
  instantHackRes = instantHack(draft);
  instantMarksmanRes = instantMarksman(draft);
  instantLanguageRes = instantLanguage(draft);
  wakeUpRes = wakeUpCall(draft);
  wakeOnCueRes = wakeOnCue(draft);
  woundOnCueRes = woundOnCue(draft);
  fatigueRes = fatigueOverdrive(draft);
  instantEscapeRes = instantEscape(draft);
  weaponJamRes = weaponJam(draft);
  evidenceBlankRes = evidenceBlank(draft);
  propMotifRhythmRes = propMotifRhythm(draft); // v2.133 物象母题节奏（重扫）
  blurtRes = childBlurt(draft);
  rumorSpeedRes = rumorSpeed(draft);
  resultsOnCueRes = resultsOnCue(draft);
  trafficOnCueRes = trafficOnCue(draft);
  vehicleJamRes = vehicleJam(draft);
  sleepTalkRes = sleepTalk(draft);
  feverTruthRes = feverTruth(draft);
  instantEndowmentRes = instantEndowment(draft);
  lastSecondRescueRes = lastSecondRescue(draft);
  villainStallRes = villainStall(draft);  teamBriefingRes = teamBriefing(draft);  deadlineRes = deadlineStretch(draft);
  interrogationRes = softInterrogation(draft);
  deathbedRes = deathbedConfession(draft);
  truthRes = truthSerum(draft);
  pregRes = pregnancyOnCue(draft);
  amnesiaRes = amnesiaOnCue(draft);
  terminalRes = terminalDiagnosisOnCue(draft);
  allergyRes = allergyOnCue(draft);
  blindnessRes = blindnessOnCue(draft);
  poisonRes = poisonOnCue(draft); // v2.109
  muteRes = muteOnCue(draft); // v2.110
  deafRes = deafOnCue(draft); // v2.111
  paralysisRes = paralysisOnCue(draft); // v2.112
  showDontTellRes = showDontTellScan(draft, hookLang);
  cliffhangerRes = cliffhangerScore(draft, hookLang, outline.cliffhanger);
  coolMomentRes = coolMomentScore(draft, hookLang);
  dialogueWaterRes = dialogueWaterCheck(draft, hookLang);
  conflictDensityRes = conflictDensityCheck(draft, hookLang);
  punchlineDensityRes = punchlineDensityScore(draft, hookLang);
  sceneDensityRes = sceneDensityScore(draft, hookLang);
  repetitionRes = repetitionCheck(draft, hookLang);
  characterBalanceRes = characterBalanceCheck(draft, cast, hookLang);
  twistDensityRes = twistDensityScore(draft, hookLang);
  dialogueLengthRes = dialogueLengthScore(draft, hookLang);
  // v2.123-v2.147 终稿重算：信息密度/悬念张力/场景标题/对白功能/因果逻辑/主角目标/反派质量/憋爽节奏/情感关系/场景注水/配角工具人/冲突升级阶梯/台词潜台词/配角弧光/场景目的效率/时间线一致性/场记连续性/误会拖延/反派降智主角光环/翻盘证据链公平性/金手指规则一致性/闪回梦境幻觉公平性/情绪余波连续性/空间位移连续性/角色在场感连续性（保持终稿数据新鲜）
  informationDensityRes = informationDensityScore(draft, hookLang);
  suspenseTensionRes = suspenseTensionCurve(draft, hookLang);
  sceneHeaderRes = sceneHeaderConvention(draft, hookLang);
  dialogueFunctionRes = dialogueFunctionalityCheck(draft, hookLang);
  causalLogicRes = causalLogicCheck(draft, hookLang);
  protagonistGoalRes = protagonistGoalCheck(draft, hookLang);
  antagonistQualityRes = antagonistQualityCheck(draft, hookLang);
  payoffRhythmRes = payoffRhythmCheck(draft, hookLang);
  relationshipRes = relationshipProgressionCheck(draft, hookLang);
  scenePaddingRes = scenePaddingCheck(draft, hookLang);
  supportingRes = supportingCharacterCheck(draft, cast, hookLang);
  conflictEscalationRes = conflictEscalationCheck(draft, hookLang);
  subtextRes = subtextCheck(draft, hookLang);
  supportingArcRes = supportingArcCheck(draft, cast, hookLang);
  scenePurposeRes = scenePurposeCheck(draft, hookLang);
  timelineConsistencyRes = timelineConsistencyCheck(draft, hookLang);
  continuitySupervisionRes = continuitySupervisionCheck(draft, hookLang);
  misunderstandingDragRes = misunderstandingDragCheck(draft, hookLang);
  plotArmorRes = plotArmorCheck(draft, hookLang);
  evidenceChainRes = evidenceChainCheck(draft, hookLang);
  cheatRuleRes = cheatRuleCheck(draft, hookLang);
  memoryFakeoutRes = memoryFakeoutCheck(draft, hookLang);
  emotionalAftermathRes = emotionalAftermathCheck(draft, hookLang);
  locationContinuityRes = locationContinuityCheck(draft, hookLang);
  characterPresenceRes = characterPresenceCheck(draft, hookLang);
  openingWeldRes = openingContinuityCheck(options.prevEpisode?.ending ?? '', draft, hookLang); // v2.80 焊点承接终稿重算，保持检测数据新鲜
  const hookPayoffRes = hookPayoffCheck(options.prevHook ?? null, draft, hookLang); // v2.80 集尾钩子跨集兑现：终稿重算落库（观测+诊断；下一集钩子位走 cliffhanger 通道）
  const curHumBits = extractHumiliationBits(draft, episodeIndex + 1);
  const humDebtRes = humiliationDebtLedger([...(options.prevHumDebt ?? []), { ep: episodeIndex + 1, planted: curHumBits.length, paid: payoffRhythmRes.humiliationPaidCount, strong: payoffRhythmRes.strongReleaseCount, markers: [...new Set(curHumBits.map((b) => b.marker))].slice(0, 5) }], episodeIndex + 1); // v2.80 屈辱-打脸跨集账本：终稿重算落库
  // v2.80 多集悬念干旱账本：终稿重算落库（换线重置/正文推进清零/集尾重吊加重）；本集线词取集尾悬念钩，无钩则继承前集活跃线
  const curMysHook = deriveMysteryHook(cliffhangerRes, episodeIndex + 1);
  const mysPrevRows = options.prevMystery ?? [];
  const mysPrevLast = mysPrevRows.length ? [...mysPrevRows].sort((a, b) => a.ep - b.ep)[mysPrevRows.length - 1] : null;
  const curMysLine = (curMysHook?.line) || mysPrevLast?.line || '';
  const mysteryDroughtRes = mysteryDroughtLedger([...mysPrevRows, { ep: episodeIndex + 1, line: curMysLine, advanced: curMysLine ? mysteryAdvanceCheck(curMysLine, draft) : false, hooked: !!curMysHook?.hooked }], episodeIndex + 1);
  // v2.80 跨集钩型疲劳账本：终稿重算落库（开场=本集规划 ID，集尾=终稿实测钩型；弱钩/无钩断段）
  const hookFatigueRes = hookFatigueLedger([...(options.prevHookTypes ?? []), { ep: episodeIndex + 1, openId: epHook.openHookId, endType: deriveEndHookType(cliffhangerRes) ?? '' }], episodeIndex + 1);
  // v2.80 信物跨集连续性账本：终稿重算落库（本集信物提及+销毁动作；封禁再现=凭空再用、长期未提=悬空）
  const propLedgerRes = propLedger([...(options.prevProps ?? []), { ep: episodeIndex + 1, items: extractPropMentions(draft) }], episodeIndex + 1);
  // v2.80 承诺欠账账本：终稿重算落库（本集新誓言句定线，无新誓继承前集活跃承诺——债务不断链；兑现/推进清零，挂账逐集加重）
  const curPrmNew = derivePromiseLine(draft);
  const prmPrevRows = options.prevPromises ?? [];
  const prmPrevLast = prmPrevRows.length ? [...prmPrevRows].sort((a, b) => a.ep - b.ep)[prmPrevRows.length - 1] : null;
  const curPrmLine = curPrmNew || prmPrevLast?.line || '';
  const promiseDroughtRes = promiseDroughtLedger([...prmPrevRows, { ep: episodeIndex + 1, line: curPrmLine, advanced: curPrmLine ? promiseAdvanceCheck(curPrmLine, draft) : false }], episodeIndex + 1);
  // v2.80 反派威胁升级账本：终稿重算落库（本集反派威胁动作分档；连续缺席=工具人化、同档复用=威胁不升级）
  const villainAction = detectVillainAction(draft);
  const villainThreatRes = villainThreatLedger([...(options.prevVillainThreats ?? []), { ep: episodeIndex + 1, line: villainAction.line, acted: villainAction.level > 0, level: villainAction.level }], episodeIndex + 1);
  // v2.80 时间线跨集账本：终稿重算落库（本集首个时间锚提取归一化；跨集倒流=硬伤 high、连续无锚=时间感悬置）
  const curTimeline = deriveTimelineMark(draft);
  const timelineLedgerRes = timelineLedger([...(options.prevTimelineMarks ?? []), { ep: episodeIndex + 1, mark: curTimeline.mark, spanDays: curTimeline.spanDays }], episodeIndex + 1);
  // v2.80 代价跨集账本：终稿重算落库（本集胜利/代价信号提取；零代价连胜=金手指通胀、爽点贬值）
  const curCost = deriveCostSignal(draft);
  const costLedgerRes = costLedger([...(options.prevCostRows ?? []), { ep: episodeIndex + 1, won: curCost.won, paid: curCost.paid }], episodeIndex + 1);
  // v2.80 死亡穿帮账本：终稿重算（人物卡具名角色逐个提取死亡/豁免/活动信号；前集死者本集再开口/行动=复活穿帮）
  const dldRows: DeathRow[] = (options.prevDeathRows ?? []).slice();
  for (const nm of Object.keys(cast)) {
    dldRows.push({ ep: episodeIndex + 1, name: nm, ...deriveDeathSignal(draft, nm) });
  }
  const deathLedgerRes = deathLedger(dldRows, episodeIndex + 1);
  // v2.80 反派下场账本：终稿重算（具名角色逐个提取下场/豁免/活动信号；已下场角色本集再行动=下场穿帮）
  const vfdRows: FateRow[] = (options.prevFateRows ?? []).slice();
  for (const nm of Object.keys(cast)) {
    vfdRows.push({ ep: episodeIndex + 1, name: nm, ...deriveFateSignal(draft, nm) });
  }
  const villainFateRes = villainFateLedger(vfdRows, episodeIndex + 1);
  // v2.80 创伤恢复账本：终稿重算（具名角色逐个提取创伤/痊愈/高强度行动信号；册中伤者本集高强度行动=伤势穿帮）
  const wrdRows: WoundRow[] = (options.prevWoundRows ?? []).slice();
  for (const nm of Object.keys(cast)) {
    wrdRows.push({ ep: episodeIndex + 1, name: nm, ...deriveWoundSignal(draft, nm) });
  }
  const woundRecoveryRes = woundRecoveryLedger(wrdRows, episodeIndex + 1);
  // v2.80 境界进阶账本：终稿重算（具名角色逐个提取境界/突破/降级/洗牌信号；凭空跳级/降级=境界穿帮）
  const pwrRows: PowerRow[] = (options.prevPowerRows ?? []).slice();
  for (const nm of Object.keys(cast)) {
    pwrRows.push({ ep: episodeIndex + 1, name: nm, ...derivePowerSignal(draft, nm) });
  }
  const powerProgressRes = powerProgressLedger(pwrRows, episodeIndex + 1);
  // v2.80 信物归属账本：终稿重算（具名角色×信物词典逐句提取让渡/拿回/经手信号；让渡后再经手=归属穿帮）
  const itmRows: ItemRow[] = (options.prevItemRows ?? []).slice();
  for (const nm of Object.keys(cast)) {
    for (const row of deriveOwnershipRows(draft, nm)) itmRows.push({ ep: episodeIndex + 1, name: nm, ...row });
  }
  const itemOwnershipRes = itemOwnershipLedger(itmRows, episodeIndex + 1);
  // v2.80 关系翻转账本：终稿重算（句内两人名×信号词两两配对提取决裂/修复/亲密；决裂后再亲密=关系穿帮）
  const relRows: RelRow[] = (options.prevRelRows ?? []).slice();
  for (const row of deriveRelationRows(draft, Object.keys(cast))) relRows.push({ ep: episodeIndex + 1, ...row });
  const relRes = relationshipLedger(relRows, episodeIndex + 1);
  // v2.80 阵营归属账本：终稿重算（句内人名×组织名×脱离/回归/效忠信号共现；脱离后仍效忠=阵营穿帮）
  const affRows: AffRow[] = (options.prevAffRows ?? []).slice();
  for (const row of deriveAffiliationRows(draft, Object.keys(cast))) affRows.push({ ep: episodeIndex + 1, ...row });
  const affRes = affiliationLedger(affRows, episodeIndex + 1);
  // v2.80 地点跨集账本：终稿重算（句内人名×地点名×被困/到达/离开/脱困信号共现；被困后无脱困出现在别处=空间穿帮）
  const locRows: LocRow[] = (options.prevLocRows ?? []).slice();
  for (const row of deriveLocationRows(draft, Object.keys(cast))) locRows.push({ ep: episodeIndex + 1, ...row });
  const locRes = locationLedger(locRows, episodeIndex + 1);
  // v2.80 秘密泄露账本：终稿重算（句内人名×透露动词×秘密词共现建立知情圈，非知情者声称知道秘密=信息穿帮）
  const leakRows: LeakRow[] = (options.prevLeakRows ?? []).slice();
  for (const row of deriveLeakRows(draft, Object.keys(cast))) leakRows.push({ ep: episodeIndex + 1, ...row });
  const leakRes = secretLeakLedger(leakRows, episodeIndex + 1);
  // v2.80 伪装身份账本：终稿重算（句内人名×伪装/揭穿动词；揭穿后无交代又伪装同一身份=身份复穿帮）
  const disgRows: DisguiseRow[] = (options.prevDisguiseRows ?? []).slice();
  for (const row of deriveDisguiseRows(draft, Object.keys(cast))) disgRows.push({ ep: episodeIndex + 1, ...row });
  const disgRes = disguiseLedger(disgRows, episodeIndex + 1);
  // v2.80 人情债账本：终稿重算（句内人名对×施恩/偿还/背叛动词；欠债后无交代恩将仇报=人情穿帮）
  const debtRows: DebtRow[] = (options.prevDebtRows ?? []).slice();
  for (const row of deriveDebtRows(draft, Object.keys(cast))) debtRows.push({ ep: episodeIndex + 1, ...row });
  const debtRes = debtLedger(debtRows, episodeIndex + 1);
  // v2.80 联盟账本：终稿重算（句内人名对×结盟/瓦解/敌对动词；结盟后无交代敌对=联盟穿帮）
  const allyRows: AllianceRow[] = (options.prevAllianceRows ?? []).slice();
  for (const row of deriveAllianceRows(draft, Object.keys(cast))) allyRows.push({ ep: episodeIndex + 1, ...row });
  const allyRes = allianceLedger(allyRows, episodeIndex + 1);
  // v2.80 记忆账本：终稿重算（句内人名×失忆/恢复/回忆动词；失忆后无交代回忆=记忆穿帮）
  const memRows: MemoryRow[] = (options.prevMemoryRows ?? []).slice();
  for (const row of deriveMemoryRows(draft, Object.keys(cast))) memRows.push({ ep: episodeIndex + 1, ...row });
  const memRes = memoryLedger(memRows, episodeIndex + 1);
  // v2.80 冒充账本：终稿重算（句内人名对×冒充/揭穿动词 + 人名×认出动词；冒充中真 B 被认出=身份重叠）
  const impRows: ImpersonationRow[] = (options.prevImpersonationRows ?? []).slice();
  for (const row of deriveImpersonationRows(draft, Object.keys(cast))) impRows.push({ ep: episodeIndex + 1, ...row });
  const impRes = impersonationLedger(impRows, episodeIndex + 1);
  // v2.80 背叛账本：终稿重算（句内人名对×背叛/和解/合作动词；背叛后无和解合作=信任穿帮）
  const btrRows: BetrayalRow[] = (options.prevBetrayalRows ?? []).slice();
  for (const row of deriveBetrayalRows(draft, Object.keys(cast))) btrRows.push({ ep: episodeIndex + 1, ...row });
  const btrRes = betrayalLedger(btrRows, episodeIndex + 1);
  // v2.80 牺牲账本：终稿重算（句内人名对×牺牲/感恩/轻慢动词；牺牲后无感恩轻慢=忘恩穿帮）
  const sacRows: SacrificeRow[] = (options.prevSacrificeRows ?? []).slice();
  for (const row of deriveSacrificeRows(draft, Object.keys(cast))) sacRows.push({ ep: episodeIndex + 1, ...row });
  const sacRes = sacrificeLedger(sacRows, episodeIndex + 1);
  // v2.80 诅咒账本：终稿重算（句内人名×中咒/解除/不受影响动词；中咒无解除不受影响=诅咒穿帮）
  const curRows: CurseRow[] = (options.prevCurseRows ?? []).slice();
  for (const row of deriveCurseRows(draft, Object.keys(cast))) curRows.push({ ep: episodeIndex + 1, ...row });
  const curRes = curseLedger(curRows, episodeIndex + 1);
  // v2.80 附身账本：终稿重算（句内人名×附身/解除/本人意志动词；被附身无解除本人意志=附身穿帮）
  const posRows: PossessionRow[] = (options.prevPossessionRows ?? []).slice();
  for (const row of derivePossessionRows(draft, Object.keys(cast))) posRows.push({ ep: episodeIndex + 1, ...row });
  const posRes = possessionLedger(posRows, episodeIndex + 1);
  // v2.80 穿越账本：终稿重算（句内人名×穿越/回归/原时间线动词；已穿越无回归原时间线=穿越穿帮）
  const ttRows: TimeTravelRow[] = (options.prevTimeTravelRows ?? []).slice();
  for (const row of deriveTimeTravelRows(draft, Object.keys(cast))) ttRows.push({ ep: episodeIndex + 1, ...row });
  const ttRes = timeTravelLedger(ttRows, episodeIndex + 1);
  // v2.80 变身账本：终稿重算（句内人名×变身/恢复/原形动词；已变身无恢复原形=变身穿帮）
  const tfRows: TransformationRow[] = (options.prevTransformationRows ?? []).slice();
  for (const row of deriveTransformationRows(draft, Object.keys(cast))) tfRows.push({ ep: episodeIndex + 1, ...row });
  const tfRes = transformationLedger(tfRows, episodeIndex + 1);
  // v2.80 中毒账本：终稿重算（句内人名×中毒/解毒/无恙动词；已中毒无解毒无恙=中毒穿帮）
  const poiRows: PoisonRow[] = (options.prevPoisonRows ?? []).slice();
  for (const row of derivePoisonRows(draft, Object.keys(cast))) poiRows.push({ ep: episodeIndex + 1, ...row });
  const poiRes = poisonLedger(poiRows, episodeIndex + 1);
  // 四套进阶尺子聚合为 craftDepth 评分卡（avg 为四套均值，p1 为三套硬伤合集，p2 含 narrative 建议项）
  const craftDepth = {
    avg: Math.round((emotionLint.avg + webnovelLintRes.avg + archetypeLintRes.avg + narrativeLintRes.avg) / 4),
    p1: [...emotionLint.p1, ...webnovelLintRes.p1, ...archetypeLintRes.p1],
    p2: [...narrativeLintRes.p2],
    emotion: { avg: emotionLint.avg, p1Count: emotionLint.p1.length },
    webnovel: { avg: webnovelLintRes.avg, p1Count: webnovelLintRes.p1.length },
    archetype: { avg: archetypeLintRes.avg, p1Count: archetypeLintRes.p1.length },
    narrative: { avg: narrativeLintRes.avg, p2Count: narrativeLintRes.p2.length },
  };
  // v2.99 标题传播力校验：短剧标题前13字=身份+冲突+反差（点击第一生死线），仅当传了 title 时跑
  const titlePitch = options.title ? titlePitchCheck(options.title) : null;
  // v2.100 每集三问诊断：对终稿跑 perEpisodeThreeQ——主角想要什么/谁在阻拦/为什么追下一集，
  // 三个布尔位缺一即为结构缺陷（此前此函数只被 craft-lint 间接引用，从不对终稿自检）
  const epThreeQ = perEpisodeThreeQ(draft);
  // v2.101 开场四要素诊断：对终稿前260字跑 firstAppearanceCheck——
  // 麻烦/施压者/反击意图/必看理由，四要素缺一即开场不够硬（此前此函数只在 writers-room 独立路由用，管线从不自检）
  const openingCheck = firstAppearanceCheck(draft.slice(0, 260), hookLang === 'en' ? 'en' : 'zh');
  // v2.101 六维统一评分卡在 market 评分完成后计算（见下方）

  emit({ role: 'consistency', status: 'done', note: hookLang === 'en' ? 'QC gate converged: final draft cleared for compliance & market review' : '质检闸门收敛：终稿过筛，转合规与市场评估' });
  // styleCheckRes 已在闸门循环后计算完毕，不再重复计算
  const styleCheck = styleCheckRes;
  // v2.325 mature_x / 成年向分级剧本模式已移除，原露骨内容硬禁闸不再需要；若需类似闸门，统一由下方 screenModeGate 承载
  // v2.92 模式级成稿硬闸门：video_short/hot 模式的差异化合规校验
  // 命中 blocked 即拦截交付（走 catch 原路退还冻结积分），命中 warnings 只入 SSE 提示不拦截
  const modeGate = screenModeGate(options.mode, draft, hookLang, options.sourceText ?? undefined);
  if (!modeGate.allowed) {
    emit({ role: 'compliance', status: 'retry', note: hookLang === 'en'
      ? `Mode hard line hit (${modeGate.mode}): ${modeGate.blocked.map((b) => b.rule).join(', ')} — delivery blocked`
      : `模式硬线命中（${modeGate.mode}）：${modeGate.blocked.map((b) => b.rule).join('、')}，已拦截交付` });
  } else if (modeGate.warnings.length) {
    emit({ role: 'compliance', status: 'done', note: hookLang === 'en'
      ? `Mode warnings (${modeGate.mode}): ${modeGate.warnings.map((w) => w.rule).join(', ')} — passed with notes`
      : `模式提示（${modeGate.mode}）：${modeGate.warnings.map((w) => w.rule).join('、')}，已通过但有提示` });
  }

  // ⑦ 合规审核（不达标打回，沙盘默认通过）
  emit({ role: 'compliance', status: 'running', note: hookLang === 'en' ? 'Checking platform rules and content safety' : '平台尺度与内容安全校验' });
  const { data: comp } = await _jsonRole<ComplianceReport>(tier, 'compliance',
    `${directive('compliance', hookLang)}\n${G.episodeColon}${draft.slice(0, 6000)}\n${G.jsonCompliance}`, { pass: true, risks: [] }, cost);
  if (!Array.isArray(comp.risks)) comp.risks = [];
  if (!comp.pass) {
    emit({ role: 'compliance', status: 'retry', note: hookLang === 'en' ? `Compliance risk: ${comp.risks[0] ?? 'content risk'}` : `合规风险：${comp.risks[0] ?? '内容风险'}` });
    throw new Error('COMPLIANCE_REJECTED');
  }
  else emit({ role: 'compliance', status: 'done', note: hookLang === 'en' ? 'Compliance passed' : '合规通过' });

  // ⑧ 市场评分（不阻塞，记录供优化建议）
  const { data: market } = await _jsonRole<MarketReport>(tier, 'market',
    `${directive('market', hookLang)}\n${craftMarketBrief(hookLang)}\n${G.episodeColon}${draft.slice(0, 4000)}\n${hookLang === 'en' ? 'Output ONLY JSON {scores:{character,plot,dialogue,market,format,deai},overall,advice}' : '只输出JSON {scores:{character,plot,dialogue,market,format,deai},overall,advice}'}`,
    { scores: { character: 85, plot: 82, dialogue: 80, market: 83, format: 90, deai: 88 }, overall: 85, advice: hookLang === 'en' ? ['The ending hook could be slightly stronger'] : ['结尾钩子可再强半分'] }, cost);
  // 模型 JSON 形状容错：overall/scores 各维必须归一为 0-100 整数（防止模型把评语整段塞进 overall）
  const normScore = (v: unknown, fb: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fb; };
  market.overall = normScore((market as unknown as Record<string, unknown>).overall, 85);
  if (market.scores && typeof market.scores === 'object') {
    for (const k of Object.keys(market.scores)) market.scores[k] = normScore(market.scores[k], 80);
  }
  emit({ role: 'market', status: 'done', note: hookLang === 'en' ? `Six-dimension overall score ${market.overall}/100` : `六维评分综合 ${market.overall}/100` });

  // v2.101 六维统一评分卡：把已有各分扫描器结果归一为 人物/剧情/台词/市场/格式/去AI化 总评，
    // 用户此前只能看到分散的子分，看不到统一质量总览与优先修整清单
    // v2.112 dialogue 维度纳入 voicePrint 分数（对白独特度占25%权重）
    // v2.113 plot 维度纳入 cliffhanger 分数（集尾钩子效力占20%权重——短剧留存生死线）
    // v2.114 plot 维度调整：爽点密度纳入15%权重（短剧爽感生死线），cliffhanger 降为15%
    // v2.115 dialogue 维度纳入台词水分分（20%权重，voicePrint 降为20%）——短剧信息密度生死线
    // v2.116 plot 维度纳入冲突密度分（15%权重，coolMoment 降为20%，cliffhanger 降为10%）——短剧驱动力生死线
    // v2.117 dialogue 维度纳入金句密度分（15%权重，craft 降为30%，voicePrint/dialogueWater 各降为15%）——短剧传播力生死线
    // v2.118 format 维度纳入场景密度分（20%权重，craft 降为55%，showDontTell 降为25%）——短剧节奏生死线
    // v2.119 dialogue 维度纳入重复感分（15%权重，craft 降为25%，voicePrint/dialogueWater 各降为10%）——短剧新鲜感生死线
    // v2.120 character 维度纳入角色戏份均衡分（20%权重，craft 降为30%，emotion 降为30%，archetype 降为12%，narrative 降为8%）——短剧人物驱动生死线
    // v2.121 plot 维度纳入反转密度分（10%权重，coolMoment 降为15%，conflictDensity 降为10%）——短剧反转生死线
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const scorecardInput: DimInput = {
      // v2.128 人物维度纳入主角目标与能动性分（10%权重），降低单点权重以避免单引擎主导
      // v2.133 人物维度纳入配角工具人/群像分（7%权重），原有各项整体×0.93：craft0.1903+emotion0.2249+archetype0.0865+narrative0.0865+characterBalance0.1297+protagonistGoal0.0692+antagonist0.0778+relationship0.0651+supporting0.07=1
      // v2.136 人物维度纳入配角弧光分（7%权重），原有各项整体×0.93：craft0.177+emotion0.2092+archetype0.0804+narrative0.0804+characterBalance0.1206+protagonistGoal0.0644+antagonist0.0724+relationship0.0605+supporting0.0651+supportingArc0.07=1
      character: clamp(Math.round((craft.avg * 0.177 + craftDepth.emotion.avg * 0.2092 + craftDepth.archetype.avg * 0.0804 + craftDepth.narrative.avg * 0.0804 + characterBalanceRes.score * 0.1206 + protagonistGoalRes.score * 0.0644 + antagonistQualityRes.score * 0.0724 + relationshipRes.score * 0.0605 + supportingRes.score * 0.0651 + supportingArcRes.score * 0.07))),
      // v2.134 plot 维度纳入冲突升级阶梯分（7%权重），原有各项整体×0.93
      // v2.139 plot 维度纳入场记连续性分（7%权重），原有各项整体×0.93
      // v2.140 plot 维度纳入误会拖延分（7%权重），原有各项整体×0.93
      // v2.141 plot 维度纳入反派降智/主角光环分（7%权重），原有各项整体×0.93
      // v2.142 plot 维度纳入翻盘证据链公平性分（7%权重），原有各项整体×0.93
      // v2.143 plot 维度纳入金手指规则一致性分（7%权重，题材门控：现实/非外挂稿自动满分），原有各项整体×0.93
      // v2.144 plot 维度纳入闪回梦境幻觉公平性分（7%权重，无记忆类信号自动满分），原有各项整体×0.93
      // v2.145 plot 维度纳入情绪余波连续性分（7%权重，无门控：无创伤/丧亡/崩溃信号自动满分），原有22项整体×0.93：emotion0.0486+webnovel0.0324+archetype0.0244+narrative0.0244+cliffhanger0.0244+coolMoment0.0365+conflict0.0244+twist0.0324+info0.0569+suspense0.0608+causal0.0405+payoffRhythm0.0451+scenePadding0.0339+escalation0.0365+scenePurpose0.0392+timeline0.0421+continuity0.0453+misunderstanding0.0487+plotArmor0.0524+evidenceChain0.0563+cheatRule0.0605+memoryFakeout0.0651+emotionalAftermath0.07≈1（四舍五入漂移0.0008）
      // v2.146 plot 维度纳入空间位移连续性分（7%权重，无门控：无城市/场所/内外景信号自动满分），原有23项整体×0.93：emotion0.0452+webnovel0.0301+archetype0.0227+narrative0.0227+cliffhanger0.0227+coolMoment0.0339+conflict0.0227+twist0.0301+info0.0529+suspense0.0565+causal0.0377+payoffRhythm0.0419+scenePadding0.0315+escalation0.0339+scenePurpose0.0365+timeline0.0392+continuity0.0421+misunderstanding0.0453+plotArmor0.0487+evidenceChain0.0524+cheatRule0.0563+memoryFakeout0.0605+emotionalAftermath0.0651+locationContinuity0.07≈1（四舍五入漂移0.0006）
      // v2.147 plot 维度纳入角色在场感连续性分（7%权重，无门控：无离场/死亡/挂断信号自动满分），原有24项整体×0.93：emotion0.042+webnovel0.028+archetype0.0211+narrative0.0211+cliffhanger0.0211+coolMoment0.0315+conflict0.0211+twist0.028+info0.0492+suspense0.0525+causal0.0351+payoffRhythm0.039+scenePadding0.0293+escalation0.0315+scenePurpose0.0339+timeline0.0365+continuity0.0392+misunderstanding0.0421+plotArmor0.0453+evidenceChain0.0487+cheatRule0.0524+memoryFakeout0.0563+emotionalAftermath0.0605+locationContinuity0.0651+characterPresence0.07≈1（四舍五入漂移0.0005）
      plot: clamp(Math.round((craftDepth.emotion.avg * 0.042 + craftDepth.webnovel.avg * 0.028 + craftDepth.archetype.avg * 0.0211 + craftDepth.narrative.avg * 0.0211 + cliffhangerRes.score * 0.0211 + coolMomentRes.score * 0.0315 + conflictDensityRes.score * 0.0211 + twistDensityRes.score * 0.028 + informationDensityRes.score * 0.0492 + suspenseTensionRes.score * 0.0525 + causalLogicRes.score * 0.0351 + payoffRhythmRes.score * 0.039 + scenePaddingRes.score * 0.0293 + conflictEscalationRes.score * 0.0315 + scenePurposeRes.score * 0.0339 + timelineConsistencyRes.score * 0.0365 + continuitySupervisionRes.score * 0.0392 + misunderstandingDragRes.score * 0.0421 + plotArmorRes.score * 0.0453 + evidenceChainRes.score * 0.0487 + cheatRuleRes.score * 0.0524 + memoryFakeoutRes.score * 0.0563 + emotionalAftermathRes.score * 0.0605 + locationContinuityRes.score * 0.0651 + characterPresenceRes.score * 0.07))),
      // v2.126 对白维度纳入对白功能性分（10%），降低单点权重以避免单引擎主导
      // v2.135 台词潜台词检测重写为底牌不能说破五路检测（PRD 2.1.32，引擎定义见 L1996 上方，单测 subtext-check.test.cjs），权重沿用 v2.80 清单：subtext 0.06，对白维度合计仍=1（下方公式行为准，无 ×0.93 缩放）
      // v2.80 dialogue 维度纳入反问连珠分（4%权重，创作能力：质问靠事实不靠气势），上一版12项整体×0.96：craft0.1435+archetype0.0957+narrative0.0637+voicePrint0.0797+dialogueWater0.0797+punchline0.0957+repetition0.0797+dialogueLength0.0797+dialogueFunction0.0797+subtext0.06+sceneEmotionFlat0.0549+roundRobin0.048+barrage0.04=1
      dialogue: clamp(Math.round(craft.avg * 0.1435 + craftDepth.archetype.avg * 0.0957 + craftDepth.narrative.avg * 0.0637 + voicePrintRes.score * 0.0797 + dialogueWaterRes.score * 0.0797 + punchlineDensityRes.score * 0.0957 + repetitionRes.score * 0.0797 + dialogueLengthRes.score * 0.0797 + dialogueFunctionRes.score * 0.0797 + subtextRes.score * 0.06 + sceneEmotionFlatRes.score * 0.0549 + roundRobinDialogueRes.score * 0.048 + rhetoricalBarrageRes.score * 0.04)),
      market: clamp(market.overall || Math.round(craft.avg * 0.6 + craftDepth.emotion.avg * 0.4)),
      // v2.80 format 维度纳入群体反应分（5%权重，创作能力：群体要落到具体面孔），craft 0.45→0.40 配平：craft0.40+showDontTell0.2+sceneDensity0.15+sceneHeader0.2+crowd0.05=1
      format: clamp(Math.round(craft.avg * 0.40 + showDontTellRes.score * 0.2 + sceneDensityRes.score * 0.15 + sceneHeaderRes.score * 0.2 + crowdReactionRes.score * 0.05)),
      // v2.84 deai 维度纳入初见托付分（4%权重，创作能力：初见面就把公章/孩子/命脉交给陌生人，信任白给，免费的信任撑不起背叛），cheapForgive/cheapEmpathy/helpOnDemand/gratuity 各 0.02→0.01 让位（免费关系与免费渠道家族内让位）；v2.85 deai 维度纳入认亲白给分（4%权重，创作能力：血缘揭露三行内被零成本接纳，亲情速热，免费的亲情撑不起二十年寻找），stanceFlip/tearBait/selfPity/fidgetProp 各 0.02→0.01 让位（情感与关系家族内让位）；v2.86 deai 维度纳入晕倒阀门分（4%权重，创作能力：关键时刻就晕倒掐断关键信息，生理当剧情阀门），emotionVentCliche（生理外化家族）/emptyVow（空转信息）/accidentalSpark（意外事件家族）/drunkTruth（信息扣押家族）各 0.02→0.01 让位；v2.86b deai 维度纳入晚一步阀门分（4%权重，创作能力：抵达就刚走，错过当剧情阀门），echoDialogue（信息复述家族）/previewVoiceover（信息预告家族）/unplantedAsset（藏牌空降家族）/walkInTiming（timing巧合镜像家族）各 0.02→0.01 让位；v2.88 deai 维度纳入初见白给分（4%权重，创作能力：第一次见面三行内就以身相许，爱情速热，免费的爱情撑不起海誓山盟），emoLabel/hollow/whiplash/softEnd 各 0.02→0.01 让位（情感表达与节奏家族内让位）；v2.89 deai 维度纳入转角偶遇分（4%权重，创作能力：世界太小，旧人零铺垫高频撞见，相遇靠轨迹或预谋挣来，不是作者发缘分），phoneRelay/fakeChoice/abstractAccusation/instantDeduction 各 0.02→0.01 让位（作者强安排家族内让位）；63项核算（16×.02+40×.01+7×.04=1）：.02×16=antiAi,craft,narrative,vague,nameCall,pingpong,mirror,gloss,reaction,crutch,actionEcho,exitCliche,parenOverdirect,sensory,aiTaste,subtextErase；.01×40=atmosphere,moral,fallacy,selfIntro,mind,delivery,eavesdrop,expo,dodge,threat,villainConf,records,tease,jumpPayoff,flashbackCrutch,commFailCrutch,cheapForgive,cheapEmpathy,helpOnDemand,gratuity,stanceFlip,tearBait,selfPity,fidgetProp,emotionVentCliche,emptyVow,accidentalSpark,drunkTruth,echo,previewVoiceover,unplantedAsset,walkInTiming,emoLabel,hollow,whiplash,softEnd,phoneRelay,fakeChoice,abstractAccusation,instantDeduction；.04×7=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter；v2.90 deai 维度纳入黑客秒破分（4%权重，创作能力：高安全系统零成本零失败崩塌，突破要靠设备、过程、内应或代价挣来，不是三下键盘），effortGloss/actionEcho/reactionCliche/exitCliche 各 0.02→0.01 让位（过程压缩与公式化套路域内让位——黑客秒破是努力蒙太奇的极速版，都是把过程的重量跳过去）；64项核算（12×.02+44×.01+8×.04=1）：.02×12=antiAi,craft,narrative,vague,nameCall,pingpong,mirror,crutch,parenOverdirect,sensory,aiTaste,subtextErase；.01×44=atmosphere,moral,fallacy,selfIntro,mind,delivery,eavesdrop,expo,dodge,threat,villainConf,records,tease,jumpPayoff,flashbackCrutch,commFailCrutch,cheapForgive,cheapEmpathy,helpOnDemand,gratuity,stanceFlip,tearBait,selfPity,fidgetProp,emotionVentCliche,emptyVow,accidentalSpark,drunkTruth,echo,previewVoiceover,unplantedAsset,walkInTiming,emoLabel,hollow,whiplash,softEnd,phoneRelay,fakeChoice,abstractAccusation,instantDeduction,effortGloss,actionEcho,reactionCliche,exitCliche；.04×8=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack；v2.91 deai 维度纳入神枪手开挂分（4%权重，创作能力：零训练零失手弹弹咬要害，技能精准要靠来路、失手、代价或过程挣来，不是枪枪自带制导），nameCall/mirror/crutch/parenOverdirect 各 0.02→0.01 让位（表演与调度公式化域内让位——v2.90 已让反应公式/动作回声/努力蒙太奇/离场套路，本块轮到台词复述画面/情绪道具拐杖/括号表演指令/直呼名公式）；65项核算（8×.02+48×.01+9×.04=1）：.02×8=antiAi,craft,narrative,vague,pingpong,sensory,aiTaste,subtextErase；.01×48=atmosphere,moral,fallacy,selfIntro,mind,delivery,eavesdrop,expo,dodge,threat,villainConf,records,tease,jumpPayoff,flashbackCrutch,commFailCrutch,cheapForgive,cheapEmpathy,helpOnDemand,gratuity,stanceFlip,tearBait,selfPity,fidgetProp,emotionVentCliche,emptyVow,accidentalSpark,drunkTruth,echo,previewVoiceover,unplantedAsset,walkInTiming,emoLabel,hollow,whiplash,softEnd,phoneRelay,fakeChoice,abstractAccusation,instantDeduction,effortGloss,actionEcho,reactionCliche,exitCliche,nameCall,mirror,crutch,parenOverdirect；.04×9=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman；v2.92 deai 维度纳入语言秒精通分（4%权重，创作能力：零学费零口音从听不懂到流利只隔三行，语言要有来路、过程、代价，或干脆留在障碍里），narrative/vague/pingpong/subtextErase 各 0.02→0.01 让位（叙述与对白公式化域内让位）；66项核算（4×.02+52×.01+10×.04=1）：.02×4=antiAi,craft,sensory,aiTaste；.01×52=narrative,vague,pingpong,subtextErase+其余48项；.04×10=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage；v2.93 deai 维度纳入一句话点醒分（2%权重，创作能力：多年心结被单句台词瞬间治愈，说教治愈零成本——松动要有挣扎、代价、时间，或只松一半）。02池耗尽改退役策略：moralNarration（叙述层说教，与本引擎台词层说教治愈语义最近）/patheticFallacy（天气拟情最边缘）两项 0.01 退役（检测器保留运行仅退出加权），wakeUp 0.02 新入；65项核算（5×.02+50×.01+10×.04=1）：.02×5=antiAi,craft,sensory,aiTaste,wakeUp；.01×50=其余50项（moral,fallacy 已退役）；.04×10=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage；v2.94 deai 维度纳入呼唤即醒分（2%权重，创作能力：昏迷多年的人被一声呼唤唤醒，病床当剧情阀门——苏醒要有医学、渐变、守候或代价挣来），tearBait（身体当开关家族，与病床阀门共用"生理信号当叙事开关"语义）/accidentalSpark（意外事件家族，已两次让位）两项 0.01 退役（检测器保留运行仅退出加权），wakeOnCue 0.02 新入；64项核算（6×.02+48×.01+10×.04=1）：.02×6=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue；.01×48=其余48项（tearBait,accidentalSpark 已退役）；.04×10=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage；v2.95 deai 维度纳入带伤开挂分（2%权重，创作能力：重伤未愈的人当剧情需要时全力输出，伤势当编剧开关——爆发要有医学许可、当场代价或有人代劳），cheapEmpathy（身体苦难外化域，安慰话术与本引擎身体代价语义最近）/selfPity（苦难自怜外化域，已多次让位）两项 0.01 退役（检测器保留运行仅退出加权），woundOnCue 0.02 新入；63项核算（7×.02+46×.01+10×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×46=其余46项（moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity 已退役）；.04×10=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage；v2.96 deai 维度纳入束缚秒脱分（4%权重，创作能力：五花大绑锁进仓库下一拍就自己走出来，束缚当道具开关——脱身要有工具铺垫、当场代价或外援挣来），unplantedAsset（藏牌空降白给域）/previewVoiceover（信息预告白给域）/fakeChoice（作者强安排域）/walkInTiming（timing巧合镜像域）四项 0.01 退役（检测器保留运行仅退出加权），instantEscape 0.04 新入（零成本获取家族第6员，.04对齐）；60项核算（7×.02+42×.01+11×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×42=其余42项（moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming 已退役）；.04×11=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape；v2.97 deai 维度纳入武器哑火分（4%权重，创作能力：关键时刻枪必没子弹卡壳空膛，武器当编剧阀门——哑火要有来路、当场处理或有备选方案），commFailCrutch（通讯失灵域，与本引擎工具当阀门语义最近——镜像兄弟）/gratuity（证人白给域，已多次让位）/fidgetProp（道具小动作域，已让位）/stanceFlip（立场横跳域，已让位）四项 0.01 退役（检测器保留运行仅退出加权），weaponJam 0.04 新入（阀门家族第六员，.04对齐）；57项核算（7×.02+38×.01+12×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×38=其余38项（moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip 已退役）；.04×12=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam；v2.98 deai 维度纳入证据恰好失灵分（4%权重，创作能力：关键时刻监控必坏、内存卡必满，取证载体当编剧阀门——失灵要有主使、替代兜底或代价挣来），recordsRes（取证便利镜像域——"一查必中"的反向兄弟，语义最近，按镜像兄弟惯例退役）/phoneRelayRes（信息渠道域，已让位两次）/timeJumpPayoffRes（时间直给域，已多次让位）/echoDialogueRes（信息复述域，已两次让位）四项 0.01 退役（检测器保留运行仅退出加权），evidenceBlank 0.04 新入（阀门家族第七员：通讯→生理→地理→病床→伤势→武器→证据载体，.04对齐）；54项核算（7×.02+34×.01+13×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×34=其余34项（moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo 已退役）；.04×13=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank；v2.99 deai 维度纳入萌宝泄密分（4%权重，创作能力：大人死守的血缘/奸情/命案秘密被奶声奶气的娃一句话当众拆封且满座采信，孩童当编剧拆信刀——泄密要有来路授意、采信代价或童言代价挣来），drunkTruth（灌醉真心话——"免费真心话"同龄兄弟，年幼解锁真话与灌醉解锁真话镜像，语义最近，按镜像兄弟惯例退役）/eavesdropDump（偷听直给——非常规渠道免费获秘兄弟）/infoDelivery（弹窗广播投喂——信息免费送达域）/instantDeduction（秒推理——真相结论免费兑付域）四项 0.01 退役（检测器保留运行仅退出加权），childBlurt 0.04 新入（"免费真心话"家族新员，.04对齐）；51项核算（7×.02+30×.01+14×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×30=其余30项（累计退役22：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction）；.04×14=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt；v2.100 deai 维度纳入假倒计时分（4%权重，创作能力：立了"期限+后果"的赌注却没人赶时间、到期不兑付，期限当橡皮筋——要么演赶时间，要么认罚兑付，宽限必须跪求/谈妥/拿东西换来），emptyThreat（台词层狠话不兑付——结构化赌注不兑付的最近兄弟，镜像退役）/emptyVow（承诺义务宣告不兑付同族）/flashbackCrutch（信息拖延容器，已多次让位）/emotionPropCrutch（道具拐杖，已让位）四项 0.01 退役（检测器保留运行仅退出加权），deadlineStretch 0.04 新入（阀门家族第八员：通讯→生理→地理→病床→伤势→武器→证据载体→期限，.04对齐）；48项核算（7×.02+26×.01+15×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×26=其余26项（累计退役26：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch）；.04×15=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch；v2.101 deai 维度纳入审讯秒招分（4%权重，创作能力：关押审讯中拍桌一吼嫌疑人立刻崩溃全招，同伙地点计划免费打包——突破要靠证据落地、交易筹码或拉锯消耗挣来，审讯室不是真话提款机），villainConf（不打自招——审讯室外炫耀式泄露与审讯室内高压秒招镜像互补，语义最近，按镜像兄弟惯例退役）/cheapForgive（免费宽恕——免费兑付家族远亲）/abstractAccusation（空泛质问——审讯压力台词的空泛质问族）/helpOnDemand（随叫随到——免费渠道族，已多次让位）四项 0.01 退役（检测器保留运行仅退出加权），softInterrogation 0.04 新入（"免费真心话"家族第三员：灌醉→年幼→权威/暴力，.04对齐）；45项核算（7×.02+22×.01+16×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×22=其余22项（累计退役30：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch,villainConf,cheapForgive,abstractAccusation,helpOnDemand）；.04×16=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation；v2.102 deai 维度纳入临终全招分（4%权重，创作能力：血泊中流利报完真凶全名/同伙/证据地点/旧案真相后准时咽气，死亡当真相快递柜——遗言给线索不给答案、情报不可直接消费、守口要有挣扎惯性、说全了要接受质证），confrontationDodge（对质回避——本该拉锯回避的对质被临终直给兑付，零成本对质的镜像兄弟，按镜像兄弟惯例退役）/effortGloss（努力蒙太奇——遗言跳过全部调查过程，过程压缩同族，v2.90曾让位一次）/sceneSoftEnding（软绵绵收尾——临终全招常落在集尾情绪软收，结构近）/emotionLabelDialogue（情绪直给台词——情感遗言催泪直给同族）四项 0.01 退役（检测器保留运行仅退出加权），deathbedConfession 0.04 新入（"免费真心话"家族第四员：灌醉→年幼→权威/暴力→死亡，.04对齐；注：witnessGratuity 镜像兄弟已在 v2.97 退役）；42项核算（7×.02+18×.01+17×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×18=其余18项（累计退役34：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch,villainConf,cheapForgive,abstractAccusation,helpOnDemand,confrontationDodge,effortGloss,sceneSoftEnding,emotionLabelDialogue）；.04×17=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession；v2.103 deai 维度纳入吐真剂秒招分（4%权重，创作能力：针管一推眼皮发沉，同伙地点旧案问什么答什么，药物当意志的化学开关——让针失效/药效打折/用药有罪/写出拉锯，供词可信度不能被药剂跳过），mindReadingNarration（读心旁白——超自然手段绕过意志直接读真话，与化学药剂绕过意志取真话是镜像兄弟，语义最近，按镜像兄弟惯例退役）/omniscientTease（全知预告——叙述层免费投递真相秘密）/expositionDialogue（说明对白——对白层免费倾倒关键信息）/selfIntroDump（自报家门——身份信息免费倾倒）四项 0.01 退役（检测器保留运行仅退出加权），truthSerum 0.04 新入（"免费真心话"家族第五员：灌醉→年幼→权威/暴力→死亡→药物，.04对齐）；39项核算（7×.02+14×.01+18×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×14=narrative,vague,nameCall,pingpong,hollow,whiplash,mirror,reaction,atmosphere,emotionVentCliche,actionEcho,subtextErase,exitCliche,parenOverdirect（累计退役38：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch,villainConf,cheapForgive,abstractAccusation,helpOnDemand,confrontationDodge,effortGloss,sceneSoftEnding,emotionLabelDialogue,mind,tease,expo,selfIntro）；.04×18=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,truthSerum；v2.104 deai 维度纳入妊娠剧情阀门分（4%权重，创作能力：一推就见红、干呕一次验孕棒立刻两道杠，孕妇的身体当关系遥控器——撞击见红要真实医疗进场或危机真兑付、干呕确诊要化验过程/既存孕期/乌龙演足，身体阀门家族晕倒→病床→伤势→妊娠四员齐），hollowActionRes（动作空转——身体反应零成本外化的最近兄弟，捂肚子与捂脸同构）/reactionClicheRes（反应公式——撞完捂肚见红是身体反应公式，按镜像兄弟惯例退役）/atmosphereTellRes（气氛直给——产房走廊催命气氛直给同族）/emotionVentClicheRes（情绪宣泄套路——见红即满屋哭嚎宣泄同族）四项 0.01 退役（mind 同族四项全退，检测器保留运行仅退出加权），pregnancyOnCue 0.04 新入（.04对齐）；36项核算（7×.02+10×.01+19×.04=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×10=narrative,vague,nameCall,pingpong,whiplash,mirror,actionEcho,subtextErase,exitCliche,parenOverdirect（累计退役42：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch,villainConf,cheapForgive,abstractAccusation,helpOnDemand,confrontationDodge,effortGloss,sceneSoftEnding,emotionLabelDialogue,mind,tease,expo,selfIntro,hollow,reaction,atmosphere,emotionVentCliche）；.04×19=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,truthSerum,pregnancyOnCue；v2.105 deai 维度纳入失忆剧情阀门分（4%权重，创作能力：撞头秒失忆、老歌项链秒读档，脑子当编剧暂停键快进键——撞击秒失忆要真实医学进场或永久代价/被利用成本、廉价秒恢复要治疗过程/碎片恢复/创伤价格，失忆范围别精准服务剧情，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆五员齐），emotionWhiplashRes（情绪秒横跳——与记忆秒切换是镜像兄弟：情绪开关与记忆开关同属"内在状态随取随用"，语义最近，按镜像兄弟惯例退役）/actionEchoRes（动作回声公式——表演调度域 v2.90/v2.91 已两次让位的老将）/exitClicheRes（离场套路——表演调度域同老将，历史已多次让位）/parenOverdirectRes（括号表演指令——表演调度域同老将）四项 0.01 退役（检测器/return/hint 全部保留仅退出加权），amnesiaOnCue 0.04 新入（.04对齐）；33项核算（7×.02+6×.01+20×.04=1，0.14+0.06+0.80=1）：.02×7=antiAi,craft,sensory,aiTaste,wakeUp,wakeOnCue,woundOnCue；.01×6=narrative,vague,nameCall,pingpong,mirror,subtextErase（累计退役46：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch,villainConf,cheapForgive,abstractAccusation,helpOnDemand,confrontationDodge,effortGloss,sceneSoftEnding,emotionLabelDialogue,mind,tease,expo,selfIntro,hollow,reaction,atmosphere,emotionVentCliche,emotionWhiplash,actionEcho,exitCliche,parenOverdirect）；.04×20=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,truthSerum,pregnancyOnCue,amnesiaOnCue；v2.106 deai 维度纳入绝症剧情阀门分（4%权重，创作能力：医生宣判"癌症晚期只剩三个月"全家关系当天翻转、需要团圆时误诊奇迹新药当场痊愈，死亡判决书当编剧撤回键——宣判秒翻转要复查第二诊断/规范治疗过程/代价真兑付，误诊秒痊愈要漫长救治/带瘤生存尾巴/经济身体代价，病人别活蹦乱跳只在煽情时咳血，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症六员齐），vagueWordRes（模糊措辞——措辞域老将 v2.91/v2.92 已两次让位）/dialogueNameCallRes（直呼名公式——表演调度域同老将 v2.91 已让位）/dialoguePingpongRes（乒乓对白——对白调度域同老将 v2.91/v2.92 已两次让位）/mirrorVisualDialogueRes（台词复述画面——表演调度域同老将 v2.91 已让位）四项 0.01 退役（检测器/return/hint 全部保留仅退出加权；表演调度/措辞域让位给身体阀门新员），terminalDiagnosisOnCue 0.04 新入（.04对齐）；30项核算（7×.02+2×.01+21×.04=1，0.14+0.02+0.84=1）：.02×7=antiAi,craft,dialogueAiTaste,sensoryDetail,wakeUp,wakeOnCue,woundOnCue；.01×2=narrative,subtextErase（累计退役50：moral,patheticFallacy,tearBait,accidentalSpark,cheapEmpathy,selfPity,unplantedAsset,previewVoiceover,fakeChoice,walkInTiming,commFailCrutch,gratuity,fidgetProp,stanceFlip,records,phoneRelay,jumpPayoff,echo,drunkTruth,eavesdropDump,infoDelivery,instantDeduction,emptyThreat,emptyVow,flashbackCrutch,emotionPropCrutch,villainConf,cheapForgive,abstractAccusation,helpOnDemand,confrontationDodge,effortGloss,sceneSoftEnding,emotionLabelDialogue,mind,tease,expo,selfIntro,hollow,reaction,atmosphere,emotionVentCliche,emotionWhiplash,actionEcho,exitCliche,parenOverdirect,vagueWord,dialogueNameCall,dialoguePingpong,mirrorVisualDialogue）；.04×21=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,truthSerum,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue；v2.107 deai 维度纳入过敏剧情阀门分（4%权重，创作能力：寿宴夹一只虾、聚会尝一口芒果三行内喉头水肿休克送医、急救针一针瞬间没事不留观不随访不忌口，免疫系统当编剧一键引爆一键拆除扳手——接触秒发作要既存过敏史/急救过程/濒死代价，一针秒解除要留观随访/慢性尾巴/社交代价，"打了一针就好"不救发作戏，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫七员齐），.01 池仅余 narrative/subtextErase 两项共 0.02 已无米下锅，本块首次启动 .02 老将退役：craftDepth.narrative.avg（叙述深度老将）/subtextEraseRes（潜台词擦除老将）两项 0.01 连同 sensoryDetailRes（感官细节老将）0.02 一并退役（检测器/return/hint 全部保留仅退出加权；让位 0.04 给急性免疫阀门新员），allergyOnCue 0.04 新入（.04对齐）；28项核算（6×.02+0×.01+22×.04=1，0.12+0+0.88=1）：.02×6=antiAi,craft,dialogueAiTaste,wakeUp,wakeOnCue,woundOnCue；.01×0=.01 池耗尽清零（累计退役53：v2.106 前50项+narrative,subtextErase,sensoryDetail）；.04×22=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,truthSerum,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue；v2.108 deai 维度纳入失明复明剧情阀门分（4%权重，创作能力：车祸耳光滚楼梯三行内医生宣布永久失明、需要团圆时角膜捐献者凭空出现/神医偏方/头再撞一下拆纱布当场2.0，视觉当编剧电灯开关一拉全灭一拉全亮——撞击秒失明要器质损伤/规范就医/永久代价，"拆纱布复明"不救 onset，拆纱布秒复明要术后渐进/部分恢复/手术代价，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫→视觉八员齐），.01 池已清零无米下锅，本块继续退 .02 老将：wakeOnCueRes（呼唤即醒 v2.94，同为身体当开关家族病床阀门——给新身体阀门让位语义最近）/woundOnCueRes（带伤开挂 v2.95，身体阀门伤势同族老将）两项 0.02 退役（检测器/return/hint 全部保留仅退出加权；让位 0.04 给视觉阀门新员），blindnessOnCue 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役55：v2.107 前53项+wakeOnCue,woundOnCue）；.04×23=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,truthSerum,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,blindnessOnCue；v2.109 deai 维度纳入中毒秒解毒剧情阀门分（4%权重，创作能力：喝杯毒酒三行七窍流血、解药一灌当场活蹦乱跳，毒物当编剧电灯开关一拉夺命一拉回魂——接触秒中毒要毒理化验/规范抢救/永久代价，廉价秒解毒要救治过程/余毒尾巴/解药代价，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫→视觉→毒理九员齐），.01 池清零、.02 池四项不可动，本块首次 .04 池内镜像让位：truthSerum（吐真剂秒招 v2.103，同为"化学药剂当开关"家族——药物绕意志取真话与毒物绕生理夺命回魂是化学开关镜像兄弟，语义最近，按镜像兄弟惯例退役；检测器/return/hint 全部保留仅退出加权）单项 0.04 退役，poisonOnCue 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役56：v2.108 前55项+truthSerum）；.04×23=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,blindnessOnCue,poisonOnCue；v2.110 deai 维度纳入失声复声剧情阀门分（4%权重，创作能力：一场惊吓三行内再也开不了口、神医金针孩子哭喊当场字正腔圆，嗓子当编剧电灯开关一拉全灭一拉全亮——惊吓秒失声要器质/心理机制/规范就医/永久代价，金针秒复声要康复过程/部分恢复/求治代价，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫→视觉→毒理→言语十员齐），.01 池清零、.02 池四项不可动，本块继续 .04 池内镜像让位：blindnessOnCue（失明复明 v2.108，同为身体当开关家族视觉阀门——视觉通道失与得和言语通道失与得是最直接的通道镜像兄弟，眼与嗓两套词表正交，语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，muteOnCue 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役57：v2.109 前56项+blindnessOnCue）；.04×23=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,muteOnCue；v2.111 deai 维度纳入耳聋复聪剧情阀门分（4%权重，创作能力：耳边炸响三行双耳失聪、银针耳穴/人工耳蜗开机当场 hi-fi 复聪，听觉当编剧电灯开关一拉全灭一拉全亮——爆震秒耳聋要器质机制/规范就医/永久代价，银针耳蜗秒复聪要调机语训/部分恢复/求治代价，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫→视觉→毒理→言语→听觉十一员齐，感官通道三件套视觉失明/言语失声/听觉失聪补齐），.01 池清零、.02 池四项不可动，本块继续 .04 池内镜像让位：muteOnCue（失声复声 v2.110，同为身体当开关家族言语阀门——言语通道失与得和听觉通道失与得是通道镜像兄弟，嗓与耳两套词表正交，语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，deafOnCue 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役58：v2.110 前57项+muteOnCue）；.04×23=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,deafOnCue；v2.112 deai 维度纳入瘫痪秒愈剧情阀门分（4%权重，创作能力：脚手架房顶马背坠落/车祸/钢梁砸后腰三行内高位截瘫终身轮椅、银针沿脊柱一扎/正骨咔嚓一扳/偏方膏药当场扔下轮椅健步如飞，双腿当编剧电灯开关一拉全灭一拉全亮——事故秒瘫痪要脊髓损伤/规范就医/永久代价，"扎一针站起来"不救 onset，银针正骨秒健步要康复训练/部分恢复/求治代价，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫→视觉→毒理→言语→听觉→肢体十二员齐，感官三件套后补入肢体移动大件通道），.01 池清零、.02 池四项不可动，本块继续 .04 池内镜像让位：deafOnCue（耳聋复聪 v2.111，同为身体当开关家族听觉阀门——听觉通道失与得和肢体移动通道失与得是通道镜像兄弟，耳与腿两套词表正交，且同属"事故/神医两型"结构、语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，paralysisOnCue 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役59：v2.111 前58项+deafOnCue）；.04×23=delayedReveal,instantTrust,instantKinship,faintOnCue,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue；v2.113 deai 维度纳入疲劳透支开挂剧情阀门分（4%权重，创作能力：三天三夜没合眼的人当剧情需要时神采奕奕全力输出，精力当编剧开关——透支要有补给来源、当场付费或有人接力，身体阀门家族晕倒→病床→伤势→妊娠→颅脑记忆→绝症→急性免疫→视觉→毒理→言语→听觉→肢体→精力十三员齐），.01 池清零、.02 池四项不可动，本块继续 .04 池内镜像让位：faintOnCue（晕倒阀门 v2.86，同为身体当开关家族晕倒阀门——"关键时刻倒下掐断信息流"与"该倒不倒照常输出"是同一身体的两面，精力阀门引擎注释自述镜像，语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，fatigueOverdrive 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役60：v2.112 前59项+faintOnCue）；.04×23=delayedReveal,instantTrust,instantKinship,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,deathbedConfession,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.114 deai 维度纳入道歉循环分（4%权重，创作能力：加害方对同一受害人反复道歉却无具体赎罪行动——"对不起/我错了/原谅我"反复念三遍以上，没有自首、赔偿、退股、撤案等具体代价，道歉要落到赎罪行动，与 empty-vow 空转誓言结构镜像情感指向相反：被伤害方宣言复仇无兑付 vs 加害方宣言道歉无赎罪），.01 池已清零、.02 池四项不可动，本块继续 .04 池内镜像让位：deathbedConfession（临终全招 v2.102，同为"加害方情感压力下兑付"族——临终招供是压力下一次性全部招供、反复道歉招供是压力下反复小招供不付行动，结构同构，语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，apologyLoop 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役61：v2.113 前60项+deathbedConfession）；.04×23=delayedReveal,instantTrust,instantKinship,alwaysLate,instantLove,convenientEncounter,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,apologyLoop,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.115 deai 维度纳入困处阀门分（4%权重，创作能力：电梯故障/暴雨停电/密室反锁一困就心动一困就靠近，物理困境当关系开关——困处要催化已有关系（之前就暗恋/早就认识）或遇到拒绝摩擦（推开/退后/别碰我），身体先于情感反应，与 convenientEncounter 转角偶遇同属"物理接近推进关系"族——相遇巧合与困处巧合是关系阀门的两面，按镜像兄弟惯例退役），.01 池已清零、.02 池四项不可动，本块继续 .04 池内镜像让位：convenientEncounter（转角偶遇 v2.89，同为"物理接近推进关系"族——相遇巧合与困处巧合是关系阀门的两面，结构同构语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，forcedProximity 0.04 新入（.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役62：v2.114 前61项+convenientEncounter）；.04×23=delayedReveal,instantTrust,instantKinship,alwaysLate,instantLove,forcedProximity,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,apologyLoop,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.116 deai 维度纳入英雄救美必生情分（4%权重，创作能力：冲过去拉开/替她挡刀两拍内心跳漏拍"就是他了"，救险当恩情牌爱情开关——心动要靠关系来路、报恩划界或救险真代价挣来，感激不是爱情快捷键，与 forcedProximity 困处阀门同属关系阀门家族：被动困处推进关系与主动救险催生认定是关系阀门两面，按镜像兄弟惯例退役），.01 池清零、.02 池四项不可动，本块继续 .04 池内镜像让位：instantLove（初见白给 v2.88，同为"关系零成本建立"族——初见三行内许诺与救险两拍内心动认定是关系开关的两面，一个管嘴快一个管心快，语言层承诺与行动层心动结构同构，语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，rescueRomance 0.04 新入（关系阀门家族第二员，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役63：v2.115 前62项+instantLove）；.04×23=delayedReveal,instantTrust,instantKinship,alwaysLate,rescueRomance,forcedProximity,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,apologyLoop,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.117 deai 维度纳入吵架秒和好分（4%权重，创作能力：男女主这一场还拍桌子摔门、冷战赌气，同场几行之内就"算了，都过去了"——摔门走人又回头，跳过反思与道歉，和解当万能缓冲阀，和解要靠真诚道歉且点出具体错在哪/时间跨度让情感磨化/第三方劝和挣来，与 apologyLoop 道歉循环互为正反面——一个过度道歉一个跳过道歉，都是冲突解决不当的密度病，按镜像兄弟惯例退役），.01 池已清零、.02 池四项不可动，本块继续 .04 池内镜像让位：apologyLoop（道歉循环 v2.114，同为"冲突解决"族——过度道歉与跳过道歉是冲突解决的两面，一个反复念"对不起"无赎罪、一个摔门走人又回头"算了都过去了"无反思，结构同构语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，fightReconcile 0.04 新入（"冲突解决"家族第二员，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役64：v2.116 前63项+apologyLoop）；.04×23=delayedReveal,instantTrust,instantKinship,alwaysLate,rescueRomance,forcedProximity,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,fightReconcile,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.118 deai 维度纳入加害者秒悔悟分（4%权重，创作能力：加害方上一秒作恶行凶下一秒"我错了"，悔悟当万能赎罪阀——悔悟要靠内心过场/外部触发/具体赎罪挣来，与 instantTrust 初见托付同属"免费情感白给"族：信任白给与悔悟白给是情感零成本建立的两面，结构同构，按镜像兄弟惯例退役），.01 池已清零、.02 池四项不可动，本块继续 .04 池内镜像让位：instantTrust（初见托付 v2.84，同为"免费情感白给"族——信任白给与悔悟白给是情感零成本建立的两面，一个把公章孩子命脉白给陌生人一个把"我错了"白给被伤害方，结构同构语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，instantRepentance 0.04 新入（"冲突解决"家族第三员：apologyLoop 过度道歉+fightReconcile 吵架秒和+instantRepentance 加害方秒悔悟三维互补，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役65：v2.117 前64项+instantTrust）；.04×23=delayedReveal,instantRepentance,instantKinship,alwaysLate,rescueRomance,forcedProximity,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,softInterrogation,fightReconcile,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.119 deai 维度纳入嘴炮退敌分（4%权重，创作能力：枪口刀锋下的生死对峙被三句劝降词解压，说降当万能对峙阀——放下要靠博弈来回/外力压制/时间消耗挣来，与 softInterrogation 审讯秒招同属"高烈度博弈白给"族——审讯博弈白给与对峙博弈白给是博弈解压的两面，场景不同结构同构，按镜像兄弟惯例退役），.01 池已清零、.02 池四项不可动，本块继续 .04 池内镜像让位：softInterrogation（审讯秒招 v2.101，同为"高烈度博弈白给"族——审讯高压三句全招与对峙高压三句放下是博弈解压的两面，一个管关押后审讯室一个管持枪持刀现场对峙，台词词表同为高压劝降语义，语义最近，按镜像兄弟惯例退役；检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，talkDown 0.04 新入（"冲突解决"家族第四员：apologyLoop 过度道歉+fightReconcile 吵架秒和+instantRepentance 加害方秒悔悟+talkDown 嘴炮退敌四维互补，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役66：v2.118 前65项+softInterrogation）；.04×23=delayedReveal,instantRepentance,instantKinship,alwaysLate,rescueRomance,forcedProximity,instantHack,instantMarksman,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.120（c128 野战手术秒成功检测：instantMarksman 神枪手开挂 v2.91 让位——同为"零成本专技"族，零训练零失手与零资质零失败是技能白给的一体两面，语义最近按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，instantSurgery 0.04 新入（"零成本专技"家族第七员：instantDeduction 零成本推理+recordsOnDemand 零成本查档+instantHack 零成本破防+instantMarksman 零成本武技+instantLanguage 零成本语言+instantEscape 零成本逃脱+instantSurgery 零成本医术七维互补，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役67：v2.119 前66项+instantMarksman）；.04×23=delayedReveal,instantRepentance,instantKinship,alwaysLate,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.121（c129 当众倒戈白给检测：instantKinship 认亲白给 v2.85 让位——同为"免费关系"族，血缘揭露秒被接纳与群体忠诚秒被翻转同属"关系白给"，把亲情/民心当零成本兑付的编剧开关，结构同构语义最近，按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，crowdFlip 0.04 新入（"免费关系"家族第六员：recordsOnDemand 免费情报+helpOnDemand 免费人力+instantTrust 免费信任+instantKinship 免费亲情+instantLove 免费爱情+crowdFlip 免费群众六维互补，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役68：v2.120 前67项+instantKinship）；.04×23=delayedReveal,instantRepentance,crowdFlip,alwaysLate,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,weaponJam,evidenceBlank,childBlurt,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.122（c130 丑闻秒传遍检测：childBlurt 萌宝泄密 v2.99 让位——同为"免费信息扩散"族，萌宝一句话拆封秘密与消息一夜传遍全城同属"信息白给"，把孩子的嘴/全城的耳朵当零成本兑付的编剧开关，结构同构语义最近，按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，rumorSpeed 0.04 新入（"免费信息扩散"家族第二员：childBlurt 萌宝拆封+rumorSpeed 消息火箭两维互补覆盖信息白给扩散，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役69：v2.120 前67项+instantKinship+childBlurt）；.04×23=delayedReveal,instantRepentance,crowdFlip,alwaysLate,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,weaponJam,evidenceBlank,rumorSpeed,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,amnesiaOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.123（c131 化验秒出检测：amnesiaOnCue 失忆身体掐点 v2.105 让位——同为"掐点白给"族，撞头秒失忆是"该记的记不起"、化验秒出是"该等的等不了"，同为身体/流程阀门被剧情拨快拨慢，结构同构语义最近，按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，resultsOnCue 0.04 新入（"掐点白给"家族：amnesiaOnCue 身体掐点+resultsOnCue 流程掐点两维互补覆盖掐点白给，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役70：v2.122 前69项+amnesiaOnCue）；.04×23=delayedReveal,instantRepentance,crowdFlip,alwaysLate,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,weaponJam,evidenceBlank,rumorSpeed,resultsOnCue,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.124（c132 路况掐点检测：alwaysLate 晚一步 v2.86b 让位——同为"地理时机被剧情拨动"族，晚一步是"该赶上的没赶上"的结果层、路况掐点是"该堵的堵该顺的顺"的原因层，同一地理阀门的因果两面，结构同构语义最近，按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，trafficOnCue 0.04 新入（"环境阀门"家族：patheticFallacy 天气掐点+trafficOnCue 路况掐点，天气与路况同属"环境随剧情供水"，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役71：v2.123 前70项+alwaysLate）；.04×23=delayedReveal,instantRepentance,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,weaponJam,evidenceBlank,rumorSpeed,resultsOnCue,trafficOnCue,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.125（c133 载具掐点故障检测：weaponJam 武器哑火 v2.97 让位——同为"工具失灵当阀门"族，枪在该响时必不响与车在该走时必走不动是装备阀门的镜像兄弟，通讯→武器→载具三件工具阀门补齐，结构同构语义最近，按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，vehicleJam 0.04 新入（"工具阀门"家族：commFailCrutch 通讯加权已退+weaponJam 武器本块退役+vehicleJam 载具新入，工具阀门三件套齐，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役72：v2.124 前71项+weaponJam）；.04×23=delayedReveal,instantRepentance,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,vehicleJam,evidenceBlank,rumorSpeed,resultsOnCue,trafficOnCue,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.126（c134 梦呓泄密检测：rumorSpeed 丑闻秒传遍 v2.122 让位——同为"信息白给"族，消息一夜传遍全城是信息的白给通道、梦呓吐出机密是信息的白给出口，萌宝泄密与梦呓泄密是"不经意的嘴泄露机密"的最近兄弟而萌宝 v2.122 已让位退役，信息白给族内按镜像兄弟惯例轮替，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，sleepTalk 0.04 新入（"意识失守吐真言"家族：drunkTruth 灌醉加权已退+sleepTalk 睡眠新入，酒与睡两套意识失守通道词表正交，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役73：v2.125 前72项+rumorSpeed）；.04×23=delayedReveal,instantRepentance,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,vehicleJam,evidenceBlank,sleepTalk,resultsOnCue,trafficOnCue,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.127（c135 高烧谵妄吐真言检测：delayedReveal 信息容器延迟开启 v2.83 让位——同为"信息流速"族，遗书三个月没敢拆是信息出不去的阀门、一场谵妄吐出机密是信息免费出去的出口，信息扣押与信息白给是信息流速的方向镜像兄弟，语义最近按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，feverTruth 0.04 新入（"意识失守吐真言"家族：drunkTruth 灌醉加权已退+sleepTalk 睡眠 v2.126 刚入+feverTruth 病新入，酒/睡/烧三套意识失守通道词表正交，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役74：v2.126 前73项+delayedReveal）；.04×23=instantRepentance,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,instantEscape,vehicleJam,evidenceBlank,sleepTalk,feverTruth,resultsOnCue,trafficOnCue,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrivev2.128（c136 无因馈赠检测：instantRepentance 加害者秒悔悟 v2.118 让位——同为"免费兑付"族，加害方零成本悔悟与萍水相逢零成本给钱/房/车/职位同属编剧免费兑付开关，情感白给与资源白给是免费兑付的镜像兄弟，语义最近按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，instantEndowment 0.04 新入（"免费资源"家族：helpOnDemand 免费人力加权已退+instantEndowment 免费资源新入，.04对齐）；v2.129（c137 救兵天降检测：instantEscape 束缚秒脱 v2.96 让位——同为"绝境零成本解除"族，被绑下一拍自己脱身与绝境中救兵最后一秒踹门是绝境解除的自救/被救镜像兄弟，词表一个锁自救动作一个锁绝境×救兵双锚共现，语义最近按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，lastSecondRescue 0.04 新入（"绝境阀门"家族首员，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役76：v2.127 前74项+instantRepentance+instantEscape）；.04×23=instantEndowment,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,lastSecondRescue,vehicleJam,evidenceBlank,sleepTalk,feverTruth,resultsOnCue,trafficOnCue,deadlineStretch,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.130（c138 反派拖刀检测：deadlineStretch 假倒计时 v2.100 让位——同为"威胁兑付"族，假死线到点不收账是时钟层威胁兑付白给、处决执行中临场拖延不落锤是行动层威胁兑付白给，时钟拖延与行动拖延是威胁兑付的镜像兄弟，语义最近按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，villainStall 0.04 新入（"威胁兑付"家族行动层首员，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役77：v2.129 前76项+deadlineStretch）；.04×23=instantEndowment,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,lastSecondRescue,vehicleJam,evidenceBlank,sleepTalk,feverTruth,resultsOnCue,trafficOnCue,villainStall,talkDown,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.131（c139 开会式推进检测：talkDown 嘴炮退敌 v2.119 让位——同为"服从白给"族，个体对峙被劝即放下武器与群体分派即诺零摩擦领命是服从白给的个体/群体镜像兄弟，语义最近按镜像兄弟惯例退役，检测器/import/调用/return/hint 全部保留仅退出加权）单项 0.04 退役，teamBriefing 0.04 新入（"服从白给"家族第二员，.04对齐）；27项核算（4×.02+0×.01+23×.04=1，0.08+0+0.92=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0=.01 池持续清零（累计退役78：v2.130 前77项+talkDown）；.04×23=instantEndowment,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,lastSecondRescue,vehicleJam,evidenceBlank,sleepTalk,feverTruth,resultsOnCue,trafficOnCue,villainStall,teamBriefing,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive；v2.133 deai 维度纳入物象母题节奏分（4%权重，创作能力：契诃夫之枪三现法——聚焦即弃/冷枪远隔/情感漂移），evidenceBlank（证据恰好失灵·取证载体当阀门 v2.98）单项 0.04 退役，propMotifRhythm 0.04 新入（与 unplanted-asset 镜像补全：一个管"零铺垫后手"planted 豁免区、一个管"铺垫了但节奏断链"恰是前者豁免辖区，物件承载叙事功能域内让位）；27项核算不变（4×.02+0×.01+23×.04=1）：.02×4=antiAi,craft,dialogueAiTaste,wakeUp；.01×0（累计退役79：v2.131 前78项+evidenceBlank）；.04×23=instantEndowment,crowdFlip,rescueRomance,forcedProximity,instantHack,instantSurgery,instantLanguage,lastSecondRescue,vehicleJam,propMotifRhythm,sleepTalk,feverTruth,resultsOnCue,trafficOnCue,villainStall,teamBriefing,fightReconcile,pregnancyOnCue,terminalDiagnosisOnCue,allergyOnCue,poisonOnCue,paralysisOnCue,fatigueOverdrive
      deai: clamp(Math.round(100 - antiAi.hitCount * 6) * 0.02 + craft.avg * 0.02 + (100 - dialogueAiTasteRes.score) * 0.02 + feverTruthRes.score * 0.04 + instantEndowmentRes.score * 0.04 + crowdFlipRes.score * 0.04 + trafficOnCueRes.score * 0.04 + rescueRomanceRes.score * 0.04 + forcedProximityRes.score * 0.04 + instantHackRes.score * 0.04 + instantSurgeryRes.score * 0.04 + instantLanguageRes.score * 0.04 + lastSecondRescueRes.score * 0.04 + vehicleJamRes.score * 0.04 + propMotifRhythmRes.score * 0.04 + sleepTalkRes.score * 0.04 + villainStallRes.score * 0.04 + teamBriefingRes.score * 0.04 + fightReconcileRes.score * 0.04 + pregRes.score * 0.04 + resultsOnCueRes.score * 0.04 + terminalRes.score * 0.04 + allergyRes.score * 0.04 + poisonRes.score * 0.04 + paralysisRes.score * 0.04 + fatigueRes.score * 0.04 + wakeUpRes.score * 0.02),
    };
  const scorecard = aggregateScorecard(scorecardInput);
  // v2.132 修复闭环对比面板：闸门前基线（润色后初扫）→ 终稿六维对比，随 qcReport 落库 + done 事件下发，前端全本诊断面板渲染；润色师自身效果用 aiTaste 单指标（零公式重复）
  const fixLoop = {
    before: { dims: beforeDims, total: aggregateScorecard(beforeDims).total },
    after: { dims: { character: scorecardInput.character, plot: scorecardInput.plot, dialogue: scorecardInput.dialogue, market: scorecardInput.market, format: scorecardInput.format, deai: scorecardInput.deai }, total: scorecard.total },
    aiTaste: { before: prePolishAiTaste.score, after: dialogueAiTasteRes.score },
  };
  emit({ role: 'polisher', status: 'done', note: hookLang === 'en'
    ? `Repair loop closed: pre-gate ${fixLoop.before.total} → final ${fixLoop.after.total} /100, AI-taste ${fixLoop.aiTaste.before} → ${fixLoop.aiTaste.after}`
    : `修复闭环：闸门前 ${fixLoop.before.total} 分 → 终稿 ${fixLoop.after.total} 分，AI味 ${fixLoop.aiTaste.before} → ${fixLoop.aiTaste.after}` });
  // v2.102 资方视角评估：从出钱人视角看本集（赛道确定性/成本与回收/可投流性/内容合格线），
  // 此前 investorLens 只在 routes/market.ts 独立路由用，管线不接入——创作时看不到资方视角
  const investor = investorLens({ text: brief, episodes: episodeCount }, hookLang === 'en' ? 'en' : 'zh');

  // v2.108→v2.110 伏笔账本+角色弧光已在闸门循环中计算完毕，复用结果
  const foreshadow = foreshadowRes;
  const arcTrack = arcRes;
  // v2.80 两本跨集台账 + 上集回顾（从节拍 plan 与台账确定性拼装，供连载页/分享卡/导出用，不占剧内时长）
  const secret = secretRes;
  const stateLedger = stateRes;
  const recap = buildRecap({
    epNo: episodeIndex + 1,
    reversalId: epBeat.reversalId ?? null,
    payoffIds: epBeat.payoffIds,
    emotionId: epBeat.emotionPath[0] ?? null,
    cliffhanger: cliffhangerRes.endingSnippet ?? null,
    revealedTopics: secret.reveals.map((r) => r.topic),
    bridgedStates: stateLedger.bridges.map((b) => b.state),
  });

  // ⑨ 中央调度更新全局圣经：时间线/伏笔，供下一集联动（跨集一致性的根基）
  bible.timeline.push(outline.logline);
  if (outline.cliffhanger) bible.foreshadow.push(outline.cliffhanger);

  emit({ role: 'done', status: 'done', note: hookLang === 'en'
    ? (antiAi.pass ? 'Seven-role collaboration complete; de-AI gate passed' : 'Done (manual touch-up of residual AI tells recommended)')
    : (antiAi.pass ? '七岗协作完成，去AI化通过' : '完成（建议手动精修残余AI腔）') });
  emit({ role: 'compliance', status: 'running', note: hookLang === 'en' ? 'Dual check: character behavior logic + rhythm/breathing scan' : '双校验：人物行为逻辑 + 节奏呼吸感扫描' });
  // rhythmRes 和 charLogic 已在闸门循环后计算完毕，不再重复计算
  const rhythm = rhythmRes;
  const character = charLogic;
  const hooks: EpisodeHooks = { plan: epHook, issues: hookIssues, strength: cuePref.strength, mode: cuePref.mode };
  const beats: EpisodeBeats = { plan: epBeat, issues: beatIssues, strength: beatPref.strength, mode: beatPref.mode };
  // v2.33 AIGC 流畅制作本：同步产出机器分镜层（供 libtv 类工作流/导出按集场拆分），LIVE 本为 null
  // isAigcFmt 已在 beatDirective 构建处声明
  const aigcManifest = isAigcFmt ? buildShotManifest(draft) : null;
  const aigcVolumePlan = isAigcFmt ? planAigcVolume(options.aigcDurationMin ?? 1) : null;
  const aigcCurve = isAigcFmt ? analyzeAigcSceneCurve(draft) : null;
  return { draft, totalCostFen: cost.n, fellbacks: cost.fellbacks ?? [], _profile: { antiStrength: strength, colloquialLevel }, antiAi, cliche, tongue, grounded: groundedScan(draft), format: validateScript(draft, options.scriptFormat ?? 'LIVE', options.aigcDurationMin ?? 1), aigcManifest, aigcVolumePlan, aigcCurve, lengthPlan, styleCheck, modeGate, craftLint: craft, craftDepth, hitTeardown, track: trackId, titlePitch, epThreeQ, openingCheck, scorecard, fixLoop, genres: genreMatches.map((g) => g.id), investor: { overall: investor.overall, verdict: investor.verdict, verdictLabel: investor.verdictLabel, vetoes: investor.vetoes, pitchTips: investor.pitchTips }, aigcBeatPlan, foreshadow, arcTrack, secretLedger: secret, stateLedger, recap, character, rhythm, voicePrint: voicePrintRes, dialogueAiTaste: dialogueAiTasteRes, sceneEmotionFlat: sceneEmotionFlatRes, sensoryDetail: sensoryDetailRes, vagueWord: vagueWordRes, dialogueNameCall: dialogueNameCallRes, dialoguePingpong: dialoguePingpongRes, hollowAction: hollowActionRes, emotionWhiplash: emotionWhiplashRes, echoDialogue: echoDialogueRes, expositionDialogue: expositionDialogueRes, sceneSoftEnding: sceneSoftEndingRes, emotionLabelDialogue: emotionLabelDialogueRes, roundRobinDialogue: roundRobinDialogueRes, rhetoricalBarrage: rhetoricalBarrageRes, mirrorVisualDialogue: mirrorVisualDialogueRes, mindReadingNarration: mindReadingNarrationRes, crowdReaction: crowdReactionRes, patheticFallacy: patheticFallacyRes, omniscientTease: omniscientTeaseRes, effortGloss: effortGlossRes, reactionCliche: reactionClicheRes, infoDelivery: infoDeliveryRes, atmosphereTell: atmosphereTellRes, confrontationDodge: confrontationDodgeRes, selfIntroDump: selfIntroDumpRes, moralNarration: moralNarrationRes, emptyThreat: emptyThreatRes, timeJumpPayoff: timeJumpPayoffRes, emotionPropCrutch: emotionPropCrutchRes, emotionVentCliche: emotionVentClicheRes, actionEcho: actionEchoRes, eavesdropDump: eavesdumpRes, selfPity: selfPityRes, villainConfession: villainConfRes, cheapForgiveness: cheapForgiveRes, witnessGratuity: gratuityRes, previewVoiceover: previewRes, stanceFlip: stanceRes, unplantedAsset: unplantedRes, subtextErase: subtextEraseRes, exitCliche: exitClicheRes, phoneRelay: phoneRelayRes, fakeChoice: fakeChoiceRes, parenOverdirect: parenOverdirectRes, abstractAccusation: abstractAccusationRes, cheapEmpathy: cheapEmpathyRes, fidgetProp: fidgetPropRes, emptyVow: emptyVowRes, flashbackCrutch: flashbackCrutchRes, accidentalSpark: accidentalSparkRes, commFailCrutch: commFailRes, drunkTruth: drunkTruthRes, tearBait: tearBaitRes, instantDeduction: instantDeductionRes, recordsOnDemand: recordsRes, walkInTiming: walkInRes, helpOnDemand: helpOnDemandRes, delayedReveal: delayedRevealRes, instantTrust: instantTrustRes, instantKinship: instantKinshipRes, faintOnCue: faintOnCueRes, alwaysLate: alwaysLateRes, instantLove: instantLoveRes, convenientEncounter: convenientEncounterRes, instantHack: instantHackRes, instantMarksman: instantMarksmanRes, instantLanguage: instantLanguageRes, wakeUpCall: wakeUpRes, wakeOnCue: wakeOnCueRes, woundOnCue: woundOnCueRes, instantEscape: instantEscapeRes, weaponJam: weaponJamRes, evidenceBlank: evidenceBlankRes, propMotifRhythm: propMotifRhythmRes, childBlurt: blurtRes, deadlineStretch: deadlineRes, softInterrogation: interrogationRes, deathbedConfession: deathbedRes, truthSerum: truthRes,
    pregnancyOnCue: pregRes,
    amnesiaOnCue: amnesiaRes,
    terminalDiagnosisOnCue: terminalRes,
    allergyOnCue: allergyRes,
    blindnessOnCue: blindnessRes,
    poisonOnCue: poisonRes,
    muteOnCue: muteRes,
    deafOnCue: deafRes,
    paralysisOnCue: paralysisRes,
    fatigueOverdrive: fatigueRes,
    apologyLoop: apologyLoopRes,
    forcedProximity: forcedProximityRes,
    rescueRomance: rescueRomanceRes,
    fightReconcile: fightReconcileRes,
    instantRepentance: instantRepentanceRes,
    talkDown: talkDownRes,
    instantSurgery: instantSurgeryRes,
    crowdFlip: crowdFlipRes,
    rumorSpeed: rumorSpeedRes,
    resultsOnCue: resultsOnCueRes,
    trafficOnCue: trafficOnCueRes,
    vehicleJam: vehicleJamRes,
    sleepTalk: sleepTalkRes,
    feverTruth: feverTruthRes,
    instantEndowment: instantEndowmentRes,
    lastSecondRescue: lastSecondRescueRes,
    villainStall: villainStallRes,
    teamBriefing: teamBriefingRes,
    showDontTell: showDontTellRes, cliffhanger: cliffhangerRes, coolMoment: coolMomentRes, dialogueWater: dialogueWaterRes, conflictDensity: conflictDensityRes, punchlineDensity: punchlineDensityRes, sceneDensity: sceneDensityRes, repetition: repetitionRes, characterBalance: characterBalanceRes, twistDensity: twistDensityRes, dialogueLength: dialogueLengthRes, informationDensity: informationDensityRes, suspenseTension: suspenseTensionRes, sceneHeader: sceneHeaderRes, dialogueFunction: dialogueFunctionRes, causalLogic: causalLogicRes, protagonistGoal: protagonistGoalRes, antagonistQuality: antagonistQualityRes, payoffRhythm: payoffRhythmRes, relationship: relationshipRes, scenePadding: scenePaddingRes, supporting: supportingRes, conflictEscalation: conflictEscalationRes, subtext: subtextRes, supportingArc: supportingArcRes, scenePurpose: scenePurposeRes, timeline: timelineConsistencyRes, continuity: continuitySupervisionRes, misunderstanding: misunderstandingDragRes, plotArmor: plotArmorRes, evidenceChain: evidenceChainRes, cheatRule: cheatRuleRes, memoryFakeout: memoryFakeoutRes, emotionalAftermath: emotionalAftermathRes, locationContinuity: locationContinuityRes, characterPresence: characterPresenceRes, openingWeld: openingWeldRes, hookPayoff: hookPayoffRes, humiliationDebt: humDebtRes, mysteryDrought: mysteryDroughtRes, hookFatigue: hookFatigueRes, propLedger: propLedgerRes, promiseDrought: promiseDroughtRes, villainThreat: villainThreatRes, timelineLedger: timelineLedgerRes, costLedger: costLedgerRes, deathLedger: deathLedgerRes, villainFate: villainFateRes, woundRecovery: woundRecoveryRes, powerProgress: powerProgressRes, itemOwnership: itemOwnershipRes, relLedger: relRes, affLedger: affRes, locLedger: locRes, leakLedger: leakRes, disguiseLedger: disgRes, debtLedger: debtRes, allianceLedger: allyRes, memoryLedger: memRes, impersonationLedger: impRes, betrayalLedger: btrRes, sacrificeLedger: sacRes, curseLedger: curRes, possessionLedger: posRes, timeTravelLedger: ttRes, transformationLedger: tfRes, poisonLedger: poiRes, hooks:hooks, beats, outline, cast, audience, market, sandbox, bible };
}
