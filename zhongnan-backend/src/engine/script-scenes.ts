/**
 * c213：剧本场头识别 / 场景切分的**单一事实源**。
 *
 * 背景：c213 复盘发现 scene-density / information-density / suspense-tension /
 * emotional-aftermath / memory-fakeout 五个引擎各自维护场头正则，互不认账——
 * 工具教学（pipeline.buildSceneHeaderDirective）教的三种规范格式里，
 * LIVE 中文「场景N：」被 sceneDensity 漏切，AIGC「内景/外景」与英文「INT./EXT.」
 * 被其余四引擎漏切，规范稿被集体误判为单场 / 水戏。
 *
 * 规则（c213 方法论 63：切分器单点真相，场头格式教学与检测必须同源同正则）：
 * - 本文件是全仓唯一允许判定「这一行是不是场头」的地方；
 * - 新引擎一律用 isSceneHeaderLine / splitScriptScenes，禁止再私写场头正则；
 * - 教学端（pipeline.ts buildSceneHeaderDirective）改动格式时，本文件必须同步。
 *
 * 支持格式（与教学一致）：
 * 中文（LIVE 竖屏 + AIGC）：
 *   场景 / 场景1： / 场景 2:        ——「场景」带不带编号都算
 *   场12： / 第一场： / 第三场       ——第N场
 *   第N集 / 第N幕                    ——集/幕边界
 *   【场景3】/【第一场】             ——方括号变体（要求括号内含场/集标记，防误伤普通强调）
 *   内景 / 外景 / 室内 / 室外 / 内. / 外.  ——AIGC 制式
 * 英文（SCENE 与 INT./EXT. 双制式）：
 *   INT. / EXT. / INTERIOR / EXTERIOR（后跟空白/句点/冒号/连字符）
 *   SCENE / SCENE 1: / SCENE 3 -
 *   CHAPTER / SEQUENCE
 *   FADE IN: / CUT TO: / INTERCUT
 *   [SCENE 2: ...]
 */

export type ScriptLang = 'zh' | 'en';

const NUM_ZH = '0-9０-９一二三四五六七八九十百千零两';
const NUM_ZH_EXT = '0-9０-９一二三四五六七八九十百千零两';

const HEADER_RE_ZH = new RegExp(
  '^(?:' +
    // 场景 / 场景1： / 场景 2: / 场景:（编号可有可无）
    `场景\\s*[${NUM_ZH}]*\\s*[：:.、．]?` +
    // 场12： / 场3:
    `|场\\s*[${NUM_ZH}]+\\s*[：:.、．]?` +
    // 第一场 / 第3场 / 第十二集 / 第一幕
    `|第\\s*[${NUM_ZH_EXT}]+\\s*[集场幕](?:\\s*[：:])?` +
    // 【场景3】/【第一场 客厅】（括号内必须有场/集标记，避免普通【强调】误伤）
    `|【[^】]{0,24}?(?:场景|第\\s*[${NUM_ZH_EXT}]+\\s*[集场幕])[^】]{0,24}?】` +
    // AIGC 制式：内景/外景/室内/室外/内./外.
    '|(?:内景|外景|室内|室外|内\\.|外\\.)' +
  ')',
);

const HEADER_RE_EN = new RegExp(
  '^(?:' +
    // INT. / EXT. / INTERIOR / EXTERIOR，词边界后必须是空白或分隔符，排除 Interesting/She extended 等
    '(?:INT|EXT|INTERIOR|EXTERIOR)\\.?\\b(?:[\\s.:\\-/]|$)' +
    // SCENE / SCENE 1: / SCENE 3 - OFFICE
    '|SCENE\\b\\s*(?:[0-9IVXivx]+)?\\s*(?::|#|\\.|-|—)?(?:\\s|$)' +
    '|CHAPTER\\b|SEQUENCE\\b' +
    // 转场口行
    '|FADE\\s+IN\\b|CUT\\s+TO\\b|INTERCUT\\b' +
    // [SCENE 2: KITCHEN]
    '|\\[SCENE\\b' +
    ')',
  'i', // 英文场头大小写不敏感（Scene: / scene: / INT. / int. 都算），词边界已排除 Interesting 等误判
);

/**
 * 判定一行（原始行，内部自行 trim）是否为剧本场头。
 * @param line 待判定行
 * @param lang 语种；不传时按行内字符自探测（zh/en）
 */
export function isSceneHeaderLine(line: string, lang?: ScriptLang): boolean {
  const t = (line ?? '').trim();
  if (!t) return false;
  const useLang: ScriptLang = lang ?? detectLang(t);
  return useLang === 'en' ? HEADER_RE_EN.test(t) : HEADER_RE_ZH.test(t);
}

/** 语种自探测：汉字占优 → zh，纯拉丁 → en，默认 zh（与全引擎 shortText lang 纪律一致） */
export function detectScriptLang(text: string): ScriptLang {
  return detectLang(text ?? '');
}

function detectLang(text: string): ScriptLang {
  let cjk = 0;
  let latin = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf)
    ) {
      cjk += 1;
    } else if (
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a)
    ) {
      latin += 1;
    }
  }
  return cjk > 0 && cjk >= latin ? 'zh' : latin > cjk ? 'en' : 'zh';
}

export interface ScriptScene {
  /** 0-based 场序（引子场也是 0） */
  index: number;
  /** 场头原文（trim）；场头前的引子场为空串 */
  header: string;
  /** 场正文（不含场头行；保留原文行） */
  body: string;
  /** 场头所在行号（0-based）；引子场为 0 */
  startLine: number;
  /** 本场最后一行（0-based，含）；单头无正文时等于 startLine */
  endLine: number;
}

// c213：非正文标题行（剧名页《…》/集标题占位）——只供"扫描时跳过非对白非动作行"的引擎，
// 不是场头，splitScriptScenes 不认它（避免误切）。
const TITLE_LINE_RE = /^(?:集标题|《)/;
// 英文收尾/转场淡出行（FADE OUT. 不参与切场，但对对白扫描引擎属于非正文行）
const NON_BODY_EN_RE = /^fade\s+(?:out|to)\b/i;

/**
 * 判定一行是否为"非正文行"：场头（共享切分器）或剧名/集标题/FADE OUT 行。
 * 供戏份/密度/水分等扫描引擎在统计对白与动作时跳过；**切场景仍只能用 isSceneHeaderLine**。
 */
export function isSceneOrTitleLine(line: string, lang?: ScriptLang): boolean {
  const t = (line ?? '').trim();
  if (!t) return false;
  const useLang: ScriptLang = lang ?? detectLang(t);
  return isSceneHeaderLine(t, useLang) || TITLE_LINE_RE.test(t) || (useLang === 'en' && NON_BODY_EN_RE.test(t));
}

/**
 * 把剧本全文切成场景。
 *
 * 语义约定：
 * - 空/纯空白文本 → []（调用方自行短路，与 emotionalAftermath 的 <20 字短路同纪律）；
 * - 首场场头之前的引子行（剧名、旁白等）归为 header='' 的开场，**不静默丢弃**；
 * - 全文无任何场头 → 单场，header=''、body=全文；
 * - 场头行永不进入 body。
 */
export function splitScriptScenes(text: string, lang?: ScriptLang): ScriptScene[] {
  const clean = (text ?? '').replace(/\r\n?/g, '\n');
  if (!clean.trim()) return [];
  const useLang: ScriptLang = lang ?? detectLang(clean);
  const lines = clean.split('\n');

  const scenes: ScriptScene[] = [];
  let body: string[] = [];
  let header = '';
  let startLine = 0;
  let started = false; // 是否已开第一场（引子场也算）

  const flush = (endLine: number) => {
    if (!started) return;
    scenes.push({
      index: scenes.length,
      header,
      body: body.join('\n'),
      startLine,
      endLine,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (isSceneHeaderLine(raw, useLang)) {
      flush(i - 1);
      header = raw.trim();
      body = [];
      startLine = i;
      started = true;
    } else {
      if (!started) {
        // 场头前的引子行：只有出现非空行才开引子场
        if (raw.trim()) {
          started = true;
          header = '';
          body = [];
          startLine = 0;
        } else {
          continue;
        }
      }
      body.push(raw);
    }
  }
  flush(lines.length - 1);

  // 纯空行极端情况兜底
  if (scenes.length === 0) {
    return [{ index: 0, header: '', body: clean, startLine: 0, endLine: lines.length - 1 }];
  }
  return scenes;
}
