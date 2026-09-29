/**
 * 类型机制引擎统一注册表（v2.18）
 * ------------------------------------------------------------------
 * 目的（用户 v2.18 诉求）：把此前沉淀的全部“剧本创作技能”收敛为唯一、可被任意窗口调用的入口，
 * 杜绝“某套引擎只接了管线、没接立项会/别的窗口”这类遗漏；新增引擎只需在 CRAFT_ENGINES 登记一次，
 * 管线（pipeline）、立项会（writers-room）及未来任何创作窗口自动全部获得，天然不遗漏。
 *
 * 约定：每个引擎都是纯函数 (text, lang) => 命中返回非空指令串、不命中返回 ''；互不依赖、可叠加。
 * 顺序即注入顺序（从早期 v2.06 喜剧到 v2.17 男频玄幻的演进顺序，稳定可对拍）。
 */
import { buildComedyDirective } from './comedy-craft';
import { buildMysteryDirective } from './mystery-craft';
import { buildTourismDirective } from './tourism-craft';
import { buildTransmigrateDirective } from './transmigrate-craft';
import { buildRomanceDirective } from './romance-craft';
import { buildUnderdogDirective } from './underdog-craft';
import { buildRuleLoopDirective } from './ruleloop-craft';
import { buildCourtDirective } from './courtintrigue-craft';
import { buildFamilyDirective } from './family-craft';
import { buildProDirective } from './professional-craft';
import { buildXuanDirective } from './xuanhuan-craft';
import { buildSpyDirective } from './spy-craft';
import { buildApocalypseDirective } from './apocalypse-craft';
import { buildMilitaryDirective } from './military-craft';
import { buildEsportsDirective } from './esports-craft';
import { buildMetaDirective } from './meta-craft';
import { buildInvDirective } from './investigation-craft';
import { buildTenderDirective } from './tender-craft';
import { buildRuralDirective } from './rural-craft';
import { buildSisterhoodDirective } from './sisterhood-craft';
import { buildNationDirective } from './nation-craft';

export type CraftLang = 'zh' | 'en';
export interface CraftEngine {
  id: string;
  /** 中文名（仅用于后台/日志/可观测，不进英文 prompt） */
  name: string;
  build: (text: string, lang: CraftLang) => string;
}

/** 全量类型机制引擎（新增引擎只在此登记一次，全窗口自动生效） */
export const CRAFT_ENGINES: CraftEngine[] = [
  { id: 'comedy', name: '喜剧机制', build: buildComedyDirective },
  { id: 'mystery', name: '悬疑烧脑机制', build: buildMysteryDirective },
  { id: 'tourism', name: '文旅机制', build: buildTourismDirective },
  { id: 'transmigrate', name: '穿书穿越机制', build: buildTransmigrateDirective },
  { id: 'romance', name: '甜宠虐恋机制', build: buildRomanceDirective },
  { id: 'underdog', name: '下沉爽剧机制', build: buildUnderdogDirective },
  { id: 'ruleloop', name: '无限流规则怪谈机制', build: buildRuleLoopDirective },
  { id: 'court', name: '宅斗宫斗权谋复仇机制', build: buildCourtDirective },
  { id: 'family', name: '家庭伦理年代情感机制', build: buildFamilyDirective },
  { id: 'professional', name: '职业行业剧机制', build: buildProDirective },
  { id: 'xuanhuan', name: '男频玄幻修仙升级机制', build: buildXuanDirective },
  { id: 'spy', name: '年代谍战民国潜伏机制', build: buildSpyDirective },
  { id: 'apocalypse', name: '科幻末世废土求生机制', build: buildApocalypseDirective },
  { id: 'military', name: '军旅特战现代军事机制', build: buildMilitaryDirective },
  { id: 'esports', name: '游戏电竞体育竞技机制', build: buildEsportsDirective },
  { id: 'meta', name: '戏中戏元叙事结构机制（结构型，可叠加任意题材）', build: buildMetaDirective },
  { id: 'investigation', name: '刑侦法医罪案程序机制', build: buildInvDirective },
  { id: 'tender', name: '萌宝银发亲情治愈机制', build: buildTenderDirective },
  { id: 'rural', name: '乡村乡土地域年代机制', build: buildRuralDirective },
  { id: 'sisterhood', name: '女性群像女性互助机制', build: buildSisterhoodDirective },
  { id: 'nation', name: '国运秘境全民觉醒机制', build: buildNationDirective },
];

const BY_ENGINE_ID = new Map(CRAFT_ENGINES.map((e) => [e.id, e]));

/** 返回命中的引擎指令片段列表（保持注册顺序，去空），供需要逐条 push 的窗口使用 */
export function buildCraftParts(text: string, lang: CraftLang = 'zh'): { id: string; directive: string }[] {
  const out: { id: string; directive: string }[] = [];
  for (const e of CRAFT_ENGINES) {
    const d = e.build(text || '', lang);
    if (d) out.push({ id: e.id, directive: d });
  }
  return out;
}

/** 命中的引擎 id 列表（可观测/测试用） */
export function detectCraftStack(text: string, lang: CraftLang = 'zh'): string[] {
  return buildCraftParts(text, lang).map((x) => x.id);
}

/** 拼成一整段可直接注入 prompt 的技能指令（片段间换行；无命中返回空串） */
export function buildCraftStackDirective(text: string, lang: CraftLang = 'zh'): { ids: string[]; directive: string } {
  const parts = buildCraftParts(text, lang);
  return { ids: parts.map((p) => p.id), directive: parts.map((p) => p.directive).join('\n') };
}

/** 引擎总数（别的窗口可用于健康自检：应与已沉淀引擎数一致） */
export function craftEngineCount(): number { return CRAFT_ENGINES.length; }

export function getCraftEngine(id: string): CraftEngine | undefined { return BY_ENGINE_ID.get(id); }
