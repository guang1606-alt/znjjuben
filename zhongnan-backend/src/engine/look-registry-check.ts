/**
 * v2.356 AIGC 外观登记台账检测（候选池 D：镜头间视觉连贯的判定半边）
 * ------------------------------------------------------------------
 * 缺口：v2.355 给 Z-AIGC 稿式引入外观槽（（外观：角色=描述）/(LOOK:)/(WARDROBE:)），
 *       MachineShot.looks + resolveLooksByShot 提供逐镜台账——但全引擎体系无人判定
 *       「该登记的角色有没有登记、登记有没有矛盾」：
 *       - 主角全程零登记：生图/视频模型对主角跨镜无据，同一角色脸/服装镜间漂移的第一源头；
 *       - 登记晚于首次出场：前面已经开口的镜头没有外观依据（裸奔窗口）；
 *       - 同场重复登记且描述不同：换装不可能同场瞬换，必为笔误。
 * 分工边界：aigc-shot-feasibility 管单镜可生成性（秒数/台词句数/有无画面）；
 *           address-drift-check 管同一角色台词标签漂移；character-presence-check 管全稿人数；
 *           本引擎管「AIGC 稿外观登记台账的覆盖与矛盾」。
 * 制式门控：仅 AIGC 稿式有外观槽机制，LIVE 真人稿演员服化道由服装组管——checked=false 放行。
 * 纯函数、确定性、双语（英文输出零中文）、不依赖大模型。
 */
import { parseAigcEpisode } from './aigc-screenplay';

export type LookIssueType = 'look_missing_lead' | 'look_missing_support' | 'look_late_register' | 'look_conflict_scene';
export interface LookIssue {
  type: LookIssueType;
  severity: 'high' | 'mid';
  message: string;
  advice: string;
  evidence: string;
}
export interface LookRegistryResult {
  checked: boolean;      // false=放行（LIVE 制式/短稿/无场标），不进入扣分体系
  score: number;         // 100 - Σ扣分，clamp [0,100]
  speakers: number;      // 有台词的角色数（豁免旁白/群体后）
  registered: number;    // 外观台账有登记的角色数
  issues: LookIssue[];
}

/** 豁免清单与 scene-crowd-check 同源（镜像常量，避免动其模块内导出面） */
const GROUP_ZH = /^(?:众人|群众|大家|同学们|同事们|朋友们|亲友们|宾客们|员工们|记者们|围观者|吃瓜群众)$/i;
const GROUP_EN = /^(?:crowd|everyone|everybody|all|group|audience|people|onlookers|bystanders|reporters|guests|students|colleagues|friends|relatives|shareholders)$/i;
const NARRATOR_ZH = /^(?:旁白|解说|画外音|旁述|叙述|narrator|voiceover|vo)$/i;
const NARRATOR_EN = /^(?:narrator|voiceover|vo|narration)$/i;
function isExempt(name: string): boolean {
  return GROUP_ZH.test(name) || GROUP_EN.test(name) || NARRATOR_ZH.test(name) || NARRATOR_EN.test(name);
}

/** 名归一：trim + 小写（CJK 无大小写不受影响；en 登记与台词的大小写差异归一） */
function normName(s: string): string {
  return (s || '').trim().toLowerCase();
}

interface SpeakerAgg { name: string; lines: number; firstScene: number }
interface LookAgg { name: string; firstScene: number; byScene: Map<number, string[]> }

export function lookRegistryCheck(text: string, format: 'LIVE' | 'AIGC' = 'LIVE', lang: 'zh' | 'en' = 'zh'): LookRegistryResult {
  const pass: LookRegistryResult = { checked: false, score: 100, speakers: 0, registered: 0, issues: [] };
  if (format !== 'AIGC') return pass; // 真人实拍稿无外观槽机制
  if (!text || text.length < 20) return pass;
  const parsed = parseAigcEpisode(text);
  if (!parsed.sceneCount) return pass;

  const en = lang === 'en';
  const speakers = new Map<string, SpeakerAgg>();
  const looks = new Map<string, LookAgg>();

  for (const sc of parsed.scenes) {
    for (const b of sc.blocks) {
      if (b.type === 'dialogue' && b.speaker) {
        const name = b.speaker.trim();
        if (!name || isExempt(name)) continue;
        const key = normName(name);
        const agg = speakers.get(key) || { name, lines: 0, firstScene: sc.no };
        agg.lines += 1;
        if (sc.no < agg.firstScene) agg.firstScene = sc.no;
        speakers.set(key, agg);
      } else if (b.type === 'look' && b.speaker) {
        const name = b.speaker.trim();
        if (!name) continue;
        const key = normName(name);
        const agg = looks.get(key) || { name, firstScene: sc.no, byScene: new Map() };
        if (sc.no < agg.firstScene) agg.firstScene = sc.no;
        const arr = agg.byScene.get(sc.no) || [];
        arr.push(b.text.trim());
        agg.byScene.set(sc.no, arr);
        looks.set(key, agg);
      }
    }
  }

  const issues: LookIssue[] = [];
  let deduct = 0;

  // 覆盖判定：有台词的角色必须有外观登记（≥3 句=主角 high；1-2 句=配角 mid）；登记晚于首次出场=迟到 mid
  for (const [key, sp] of speakers) {
    const reg = looks.get(key);
    if (!reg) {
      if (sp.lines >= 3) {
        deduct += 22;
        issues.push({
          type: 'look_missing_lead', severity: 'high',
          message: en ? `Lead "${sp.name}" has no wardrobe registry` : `主角「${sp.name}」全程零外观登记`,
          advice: en
            ? `Register the lead's look once in their first scene: (LOOK: ${sp.name}=wardrobe/hair/signature prop) — it persists and is inherited for the whole episode.`
            : `主角全程无外观登记，生图/视频模型跨镜无据——在其首次出场那场用（外观：${sp.name}=服装/发型/标志性道具）登记一次，全集默认沿用继承`,
          evidence: en
            ? `"${sp.name}" speaks ${sp.lines} lines (first in scene ${sp.firstScene}) with zero wardrobe registry`
            : `「${sp.name}」全集 ${sp.lines} 句台词（首次出场：场${sp.firstScene}），外观台账无任何登记`,
        });
      } else {
        deduct += 10;
        issues.push({
          type: 'look_missing_support', severity: 'mid',
          message: en ? `Supporting role "${sp.name}" has no wardrobe registry` : `配角「${sp.name}」零外观登记`,
          advice: en
            ? `Register a look for "${sp.name}" in their first scene — otherwise their appearance drifts across shared shots.`
            : `配角零登记，同框镜头外观漂移——在其首次出场那场补一条（外观：${sp.name}=…）登记`,
          evidence: en
            ? `"${sp.name}" speaks ${sp.lines} line(s) (first in scene ${sp.firstScene}) with zero wardrobe registry`
            : `「${sp.name}」全集 ${sp.lines} 句台词（首次出场：场${sp.firstScene}），零外观登记`,
        });
      }
    } else if (reg.firstScene > sp.firstScene) {
      deduct += 10;
      issues.push({
        type: 'look_late_register', severity: 'mid',
        message: en ? `"${sp.name}" registered too late (scene ${reg.firstScene})` : `「${sp.name}」外观登记迟到（场${reg.firstScene}）`,
        advice: en
          ? `The registry appears after the character's first lines — earlier shots have no look to inherit. Move the registry to their first scene (scene ${sp.firstScene}).`
          : `登记晚于首次出场，前面已开口的镜头没有外观依据——把登记挪到该角色首次出场的场${sp.firstScene}`,
        evidence: en
          ? `"${sp.name}" already speaks in scene ${sp.firstScene}, but the wardrobe registry only appears in scene ${reg.firstScene}`
          : `「${sp.name}」场${sp.firstScene} 已有台词，外观登记迟至场${reg.firstScene}`,
      });
    }
  }

  // 矛盾判定：同一场同角色重复登记且描述不同（换装不可能同场瞬换，必为笔误）——与是否有台词无关
  for (const [, reg] of looks) {
    for (const [sceneNo, arr] of reg.byScene) {
      const distinct = [...new Set(arr)];
      if (distinct.length > 1) {
        deduct += 10;
        issues.push({
          type: 'look_conflict_scene', severity: 'mid',
          message: en ? `Conflicting registries for "${reg.name}" in scene ${sceneNo}` : `场${sceneNo}「${reg.name}」重复登记且描述互斥`,
          advice: en
            ? `A costume change cannot happen inside one scene — this is a slip. Keep the correct registry and delete the other.`
            : `换装不可能同场瞬换，两次登记互斥必为笔误——保留正确的一条，删掉另一条`,
          evidence: en
            ? `Scene ${sceneNo} registers "${reg.name}" twice with conflicting descriptions ("${distinct[0]}" vs "${distinct[1]}")`
            : `场${sceneNo} 内「${reg.name}」两次登记互斥（${distinct[0]} vs ${distinct[1]}）`,
        });
      }
    }
  }

  return {
    checked: true,
    score: Math.max(0, 100 - deduct),
    speakers: speakers.size,
    registered: looks.size,
    issues,
  };
}

/**
 * v2.373 前置教学指令：AIGC 稿外观登记台账怎么写才不漂
 * ----------------------------------------------------------------------
 * 与 lookRegistryCheck 同文件同源（v2.157 同源铁律）。
 * 既有 aigcScreenplayDirective 规则 5 只给泛化承诺；本指令把检测口径反向前置：
 * 只算有台词角色 / 旁白与群体豁免 / 主角 ≥3 句 high 22 / 配角 1-2 句 mid 10 /
 * 登记迟到 mid 10 / 同场互斥 mid 10 / 名归一只算一个 / 首次出场登记一次全集继承。
 * LIVE 真人稿无外观槽机制（演员服化道由服装组管）→ 空串。en 层零中文。
 */
export function buildLookRegistryDirective(
  format: 'LIVE' | 'AIGC' = 'LIVE',
  lang: 'zh' | 'en' = 'zh',
): string {
  if (format !== 'AIGC') return '';
  if (lang === 'en') {
    return [
      '◆ AIGC wardrobe registry: every speaking character must register a look once, so image/video models inherit it shot by shot.',
      '  Only characters with dialogue lines are counted; narrator, voice-over, and group names (crowd, everyone, people, audience, onlookers, etc.) are exempt and need no registry.',
      "  Register in the character's first scene: (LOOK: Name=wardrobe/hair/signature prop; Other=…) — separate multiple characters with semicolons, written inside a flowing paragraph, not as a tag wall.",
      '  Lead (≥3 dialogue lines in the episode) with zero registry → high, 22 points off — cross-shot faces and costumes drift with no anchor.',
      '  Supporting character (1-2 lines) with zero registry → mid, 10 points off — shared shots drift in the same way.',
      "  Late registry: the registry appears in a scene after the character's first appearance → mid, 10 points off; earlier shots have no look to inherit, so move it to the first scene.",
      '  Same-scene conflict: the same character registered twice in one scene with different descriptions → mid, 10 points off — a costume change cannot happen inside one scene, so it is a slip; keep one and delete the other.',
      '  Name normalization: registration and dialogue use the same spelling (trimmed, case-insensitive), so one character counts once.',
      '  Register once and inherit it for the whole episode; re-register only on a real costume change — otherwise do not repeat.',
      '  The slot is a registry, not a replacement: keep the natural wardrobe description in the body prose.',
    ].join('\n');
  }
  return [
    '◆ AIGC 外观登记台账：有台词的角色必须在台账里登记一次外观，供逐镜生图/生视频继承。',
    '  只统计有台词的角色；旁白、解说、画外音与群体（众人/群众/大家/人群等）豁免，不要求登记。',
    '  登记写法：在该角色首次出场那场，用（外观：角色名=服装/发型/标志性道具；另一角色=…）登记；多角色用分号分隔，写在自然段里，不写成标签墙。',
    '  主角（全集 ≥3 句台词）零登记：high 扣 22 分——生图模型跨镜无据，脸与服装在镜头间漂移。',
    '  配角（1-2 句台词）零登记：mid 扣 10 分——同框镜头同样会漂移。',
    '  登记迟到：登记所在场晚于该角色首次出场那场（已开口的镜头裸奔）→ mid 扣 10 分；把登记挪到首次出场那场。',
    '  同场互斥：同一场同一角色登记两次且描述不同 → mid 扣 10 分；换装不可能同场瞬换，必为笔误，保留正确的一条、删掉另一条。',
    '  名归一：登记与台词统一写法（去首尾空格、英文统一大小写），同一个角色只算一个。',
    '  登记一次全集沿用继承，只有换装剧情才当场重新登记；没换装不要重复写。',
    '  括号槽是登记台账不是替代品：正文里该有的穿着描写照常自然带出。',
  ].join('\n');
}
