/**
 * 真人实拍·可拍性 / 制片可行性闸门（v2.337）
 * ------------------------------------------------------------------
 * 缺口：LIVE 侧此前只有「三要素版式 + 800-1000 字」，场次数、内外景标注、
 * 说话角色数、场景复用、群演/特效/高危动作这些**制片维度**无人把关；
 * 成稿到了制片手里才发现要 12 个景、9 个演员、一场爆破。
 * AIGC 侧已有微节拍 + 镜头清单的结构化约束，真人侧在此对称补上"能不能拍"。
 *
 * 纪律（与全仓引擎一致）：
 *  - 纯确定性、零 LLM、零 IO，可直接离线对拍，同输入同输出；
 *  - 场头切分复用 script-scenes（全仓唯一场头真相源），不私写场头正则；
 *  - 说话人复用 character-logic.parseDialogue（与角色逻辑/物料表同口径）；
 *  - high = 制片不可行（进 violations 拦截），mid = 成本提示，low = 提醒；
 *  - 中英双语，英文链路零中文。
 */
import { splitScriptScenes } from './script-scenes';
import { parseDialogue } from './character-logic';

export type FeasibilitySeverity = 'high' | 'mid' | 'low';
export type FeasibilityKind =
  | 'scene_overload' | 'cast_overload' | 'location_spread'
  | 'night_heavy' | 'int_ext_unlabeled'
  | 'vfx_risk' | 'crowd_risk' | 'stunt_risk';

export interface FeasibilityIssue {
  kind: FeasibilityKind;
  severity: FeasibilitySeverity;
  /** 已按 lang 出好的文案（zh 中文 / en 英文） */
  message: string;
  /** 命中证据（风险词/场头原文），便于前端定位 */
  evidence: string[];
}

export interface LiveFeasibilityStats {
  sceneCount: number;
  castCount: number;
  distinctLocations: number;
  unlabeledScenes: number;
  nightScenes: number;
  vfxHits: string[];
  crowdHits: string[];
  stuntHits: string[];
}

export interface LiveFeasibilityReport {
  /** ok=无 mid/high；watch=有成本提示；over=存在不可拍硬伤 */
  level: 'ok' | 'watch' | 'over';
  /** 0-100，满分=制片无压力；high -25 / mid -8 / low -3 */
  score: number;
  stats: LiveFeasibilityStats;
  issues: FeasibilityIssue[];
}

/** 阈值集中在此，改口径只动一处（PRD 2.5.1：竖屏真人单集 2-3 分钟、3-4 场） */
export const LIVE_FEASIBILITY_LIMITS = {
  /** 超过即提示（建议 ≤5 场） */
  sceneMid: 5,
  /** 超过即拦截（硬上限 8 场） */
  sceneHigh: 8,
  /** 超过即提示（建议 ≤6 个说话角色） */
  castMid: 6,
  /** 超过即拦截（硬上限 8 个说话角色） */
  castHigh: 8,
  /** 场景数达到该值且零复用 → 提示置景/转场成本 */
  locationSpreadMin: 5,
  /** 夜戏占比达到该值且夜戏 ≥3 场 → 提醒夜拍成本 */
  nightRatio: 0.8,
  nightMin: 3,
};

// 内外景标注识别：与 scene-header-convention 的 INDOOR_OUTDOOR_ZH/EN 同口径（该常量模块私有，此处照抄口径）
const INT_EXT_RE = /(内景|外景|室内|室外|\bINT\.|\bEXT\.)/i;
// 夜景时间标注：只认场头里的时间词，避免把"晚饭""晚间新闻"这类剧情词算成夜戏
const NIGHT_RE = /[·\s:：](夜|深夜|凌晨|晚间|晚上|傍晚)(?:$|[·\s])|NIGHT|MIDNIGHT|EVENING|DUSK/i;

/** 制片风险词典（短剧现场真实要钱/要人的元素；与围读席 HIGH_COST_WORDS 各司其职：这里按类别分桶） */
const VFX_WORDS = ['爆炸', '爆破', '大火', '火灾', '洪水', '地震', '雪崩', '巨兽', '怪兽', '灾难', '战争', '千军万马', '空战', '陨石', '外星', '特效'];
const VFX_WORDS_EN = ['explosion', 'detonation', 'wildfire', 'flood', 'earthquake', 'avalanche', 'monster', 'disaster', 'war', 'army', 'airstrike', 'meteor', 'alien', 'vfx'];
const CROWD_WORDS = ['群演', '群众演员', '人山人海', '千人', '万人', '百人', '仪仗', '红毯', '满座', '锣鼓'];
const CROWD_WORDS_EN = ['extras', 'crowd of', 'thousands', 'hundreds of', 'red carpet', 'full house', 'ceremonial guard'];
const STUNT_WORDS = ['车祸', '撞车', '追车', '坠楼', '跳楼', '跳崖', '跳海', '枪战', '枪击', '打斗', '武打', '吊威亚', '高空', '水下', '潜水'];
const STUNT_WORDS_EN = ['car crash', 'car chase', 'falls from', 'jumps off', 'gunfight', 'gun battle', 'fight scene', 'wire work', 'high altitude', 'underwater', 'diving'];

/** 非角色说话人（电话音/旁白等会被 parseDialogue 当成人名） */
const NON_CHARACTERS = ['旁白', '画外音', '字幕', '新闻', '电视', '广播', '系统', '提示音', '电话音', 'NARRATOR', 'V.O.', 'O.S.'];

/** 集/幕边界行（第1集 标题、EP1、CHAPTER …）——是分集标记不是场，不能计入场次 */
const EPISODE_RE = /^(?:第\s*[0-9一二三四五六七八九十百千两]+\s*[集幕]|EP\.?\s*\d|EPISODE\s*\S+|CHAPTER\s*\S+)/i;

function hitsOf(text: string, words: string[], lang: 'zh' | 'en'): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => (lang === 'en' ? lower.includes(w.toLowerCase()) : text.includes(w)));
}

/**
 * 可拍性检查：只看"制片能不能落地"，不评价剧情好坏（剧情由其它引擎负责）。
 * 空稿/无场头文本返回 ok/100，把判定权留给版式闸门，避免双重报错。
 */
export function checkLiveFeasibility(text: string, lang: 'zh' | 'en' = 'zh'): LiveFeasibilityReport {
  const L = LIVE_FEASIBILITY_LIMITS;
  const scenes = splitScriptScenes(text, lang).filter((s) => s.header.trim().length > 0 && !EPISODE_RE.test(s.header.trim()));
  const issues: FeasibilityIssue[] = [];
  const en = lang === 'en';

  const sceneCount = scenes.length;
  const locations = scenes
    .map((s) => s.header.replace(/^(?:场景|第\s*[一二三四五六七八九十百千\d]+\s*场)\s*\d*\s*[:：]?/, '').replace(INT_EXT_RE, '').replace(NIGHT_RE, '').replace(/[·\-\|\s]+$/g, '').trim())
    .filter(Boolean);
  const distinctLocations = new Set(locations).size;
  const unlabeledScenes = scenes.filter((s) => !INT_EXT_RE.test(s.header)).length;
  const nightScenes = scenes.filter((s) => NIGHT_RE.test(s.header)).length;

  const castNames = Array.from(new Set(
    parseDialogue(text).map((d) => d.name.trim()).filter((n) => n && !NON_CHARACTERS.some((x) => n.toUpperCase() === x.toUpperCase())),
  ));
  const castCount = castNames.length;

  const vfxHits = hitsOf(text, en ? VFX_WORDS_EN : VFX_WORDS, lang);
  const crowdHits = hitsOf(text, en ? CROWD_WORDS_EN : CROWD_WORDS, lang);
  const stuntHits = hitsOf(text, en ? STUNT_WORDS_EN : STUNT_WORDS, lang);

  // 1) 场次：真人竖屏单集 800-1000 字，场越多每场越薄，8 场以上无法给出可拍调度
  if (sceneCount > L.sceneHigh) {
    issues.push({
      kind: 'scene_overload', severity: 'high', evidence: [`${sceneCount}`],
      message: en
        ? `Unshootable: ${sceneCount} scenes in one 800-1000 character episode (hard cap ${L.sceneHigh}); merge locations and keep 3-5 scenes`
        : `不可拍：单集 ${sceneCount} 场（硬上限 ${L.sceneHigh} 场），800-1000 字摊到每场已排不出完整调度，请合并场景、压回 3-5 场`,
    });
  } else if (sceneCount > L.sceneMid) {
    issues.push({
      kind: 'scene_overload', severity: 'mid', evidence: [`${sceneCount}`],
      message: en
        ? `Scene count high: ${sceneCount} scenes (recommended <=${L.sceneMid}); each extra location adds set-up and turnaround cost`
        : `场次偏多：${sceneCount} 场（建议 ≤${L.sceneMid} 场），每多一个景就多一次置景与转场成本`,
    });
  }

  // 2) 说话角色：演员/妆造/通告按人头计费
  if (castCount > L.castHigh) {
    issues.push({
      kind: 'cast_overload', severity: 'high', evidence: castNames,
      message: en
        ? `Unshootable cast: ${castCount} speaking roles (hard cap ${L.castHigh}); merge walk-ons into existing characters`
        : `不可拍：${castCount} 个说话角色（硬上限 ${L.castHigh} 人），演员/妆造/通告按人头计费，请合并或删减到 6 人内`,
    });
  } else if (castCount > L.castMid) {
    issues.push({
      kind: 'cast_overload', severity: 'mid', evidence: castNames,
      message: en
        ? `Large cast: ${castCount} speaking roles (recommended <=${L.castMid}); every extra actor adds a call sheet slot`
        : `角色偏多：${castCount} 个说话角色（建议 ≤${L.castMid} 人），每多一人就多一份通告与妆造`,
    });
  }

  // 3) 场景零复用：N 场 N 个地点 = 置景/转场/勘景成本最高形态
  if (sceneCount >= L.locationSpreadMin && distinctLocations >= sceneCount) {
    issues.push({
      kind: 'location_spread', severity: 'mid', evidence: locations,
      message: en
        ? `Zero location reuse: ${distinctLocations} locations for ${sceneCount} scenes; reuse one existing set for at least one scene`
        : `场景零复用：${sceneCount} 场用了 ${distinctLocations} 个地点，置景与转场成本最高，建议至少让一场回到已有场景`,
    });
  }

  // 4) 夜戏占比：夜拍要布灯、要许可、要加班费
  if (nightScenes >= L.nightMin && nightScenes / Math.max(1, sceneCount) >= L.nightRatio) {
    issues.push({
      kind: 'night_heavy', severity: 'low', evidence: [`${nightScenes}/${sceneCount}`],
      message: en
        ? `Night-heavy: ${nightScenes}/${sceneCount} scenes at night; night shoots need lighting rigs and permits`
        : `夜戏偏多：${nightScenes}/${sceneCount} 场在夜里，夜拍要布灯、要场地许可，成本高于日戏`,
    });
  }

  // 5) 场头未标内外景：置景/道具无法排景，只能靠猜
  if (sceneCount > 0 && unlabeledScenes === sceneCount) {
    issues.push({
      kind: 'int_ext_unlabeled', severity: 'low', evidence: scenes.slice(0, 3).map((s) => s.header.slice(0, 24)),
      message: en
        ? `No scene is marked INT./EXT.; the set department cannot schedule without knowing indoor or outdoor`
        : `所有场头都没标内景/外景，置景与道具部门排不了景，请在每场场头写明「内景/外景」`,
    });
  }

  // 6) 制片风险元素：特效 / 群演 / 高危动作
  if (vfxHits.length) {
    issues.push({
      kind: 'vfx_risk', severity: 'mid', evidence: vfxHits,
      message: en
        ? `VFX/crowd-scale element: ${vfxHits.join(', ')}; each adds budget and schedule risk — confirm before locking`
        : `高成本特效元素：${vfxHits.join('、')}，需额外预算与工期，落地前请确认能否用现有素材替代`,
    });
  }
  if (crowdHits.length) {
    issues.push({
      kind: 'crowd_risk', severity: 'mid', evidence: crowdHits,
      message: en
        ? `Crowd scene: ${crowdHits.join(', ')}; extras cost per head per day — reduce to a few named faces`
        : `群演场面：${crowdHits.join('、')}，群演按人头按天计费，建议收到几个有名有姓的具体面孔`,
    });
  }
  if (stuntHits.length) {
    issues.push({
      kind: 'stunt_risk', severity: 'low', evidence: stuntHits,
      message: en
        ? `Stunt/high-risk action: ${stuntHits.join(', ')}; needs a stunt coordinator and safety plan — consider a cutaway`
        : `高危动作：${stuntHits.join('、')}，需要武行与安全方案，建议改为画外/切镜交代`,
    });
  }

  const high = issues.filter((i) => i.severity === 'high').length;
  const mid = issues.filter((i) => i.severity === 'mid').length;
  const low = issues.filter((i) => i.severity === 'low').length;
  const score = Math.max(0, Math.min(100, 100 - high * 25 - mid * 8 - low * 3));

  return {
    level: high ? 'over' : mid ? 'watch' : 'ok',
    score,
    stats: { sceneCount, castCount, distinctLocations, unlabeledScenes, nightScenes, vfxHits, crowdHits, stuntHits },
    issues,
  };
}
