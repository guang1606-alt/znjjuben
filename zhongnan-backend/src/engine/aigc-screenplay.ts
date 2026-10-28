/**
 * Z-AIGC 流畅制作本格式引擎（v2.33，终南独创流派）
 * ------------------------------------------------------------------
 * 用户核心判断：
 *  1) 真人实拍本字数少，是因为导演/演员现场有发挥空间；AIGC 本要喂给语言/图片/
 *     视频/音频大模型，人物、场景、内心、氛围必须被精准理解，所以字数更多；
 *  2) 但 AIGC 本仍然是“剧本”——人要读着通畅，不能被场口标签、【景别】【运镜】
 *     之类标记打断、跳戏，更不能写成提示词手册/关键词堆砌；
 *  3) 同时工具（及 libtv 这类自动化工作流）必须能按 集/场 确定性地读取、拆分、
 *     先自动成分镜，再由制作人员补镜头。
 *
 * 解法（双层）：
 *  - 阅读层（canonical text）：短场标行 + 流畅自然段，视听/内心/音效写进完整句子，
 *    语义只通过剧本惯例的自然括号承载（内心/OS/音效/配乐），台词保持“角色（情绪）：…”；
 *  - 机器层（buildShotManifest）：确定性解析器按集→场→叙事块/台词块拆分，启发式
 *    推断景别/运镜/光影，输出结构化分镜清单供下游工具消费。正文不被机器标记污染。
 * 纯函数、确定性、双语（英文输出零中文）、不依赖大模型。
 */

// ---------- 阅读层：规范 ----------

/** 中文场标行：内景/外景 地点·时间（兼容 场N｜… 写法），单行不超过 24 个汉字以免打断阅读 */
const SCENE_HEAD_RE = /^(内景|外景|场\s*[0-9一二三四五六七八九十]+\s*[｜|])\s*(.+?)\s*$/;
/** 英文场标行：INT./EXT. PLACE - TIME（兼容 INT/EXT、INT./EXT. 与 –— 分隔） */
const SCENE_HEAD_EN_RE = /^(INT\.?\/EXT\.?|INT\.?|EXT\.?)\s+(.+?)\s*$/i;
/** 英文场末时间词（用于从 PLACE - TIME 中切出时间） */
const TIME_EN_RE = /^(DAY|NIGHT|DAWN|DUSK|SUNRISE|SUNSET|MORNING|AFTERNOON|EVENING|NIGHTFALL|CONTINUOUS|LATER|SAME\s+TIME)\.?$/i;
const TITLE_RE = /(^|\n)\s*[《]?.{0,30}?第\s*[0-9一二三四五六七八九十]+\s*集[^\n]*/;
const TITLE_EN_RE = /(^|\n)\s*[^\n]{0,40}?\b(?:EP|EPISODE)\s*\d+\b[^\n]*/i;
/** 中文角色名（1-6 汉字） */
const NAME_ZH = `[一-龥·]{1,6}`;
/** 英文角色名：首字母大写的多词（可含数字、撇号、连字符），允许多词（Lin Wan / ZHAO MINGYU / JUNIOR ANALYST 2），挡掉 “She said:”（said 非大写词头） */
const NAME_EN = `[A-Z][A-Za-z0-9.'-]*(?:\\s+[A-Z][A-Za-z0-9.'-]*)*`;
/** 台词行：角色名（情绪/动作提示，可省略；中文全角括号、英文半角括号都认）：内容。英文模型爱写长动作 cue，给 160 */
const DIALOGUE_RE = new RegExp(`^(?:(${NAME_ZH})\\s*（([^）]{0,24})）|(${NAME_ZH})|(${NAME_EN})\\s*(?:\\(([^)]{0,160})\\))?)\\s*[：:]\\s*(.+)$`);
/** 自然段中夹带台词的句首切分点（中英双分支，仅在句末标点/段首后切） */
const EMBED_SPLIT_RE = new RegExp(`(?<=^|[。！？!?…\\n])(?=(?:${`[一-龥·]{2,6}`}\\s*(?:（[^）]{0,24}）)?|${NAME_EN}\\s*(?:\\([^)]{0,160}\\))?)\\s*[：:])`);
const EMBED_LINE_RE = new RegExp(`^(?:([一-龥·]{2,6})\\s*（([^）]{0,24})）|([一-龥·]{2,6})|(${NAME_EN})\\s*(?:\\(([^)]{0,160})\\))?)\\s*[：:]([\\s\\S]+)$`);
/** 行业标准两行式台词的"角色提示行"：NAME（cue）: 后无正文，台词在下一行 */
const CUE_ONLY_RE = new RegExp(`^(?:([一-龥·]{1,6})\\s*（([^）]{0,24})）|([一-龥·]{1,6})|(${NAME_EN})\\s*(?:\\(([^)]{0,160})\\))?)\\s*[：:]\\s*$`);
/** 自然括号语义（中）：内心/OS/画外音/音效/配乐/环境音 */
const INLINE_CUE_RE = /（(内心|OS|画外音|音效|配乐|环境音)[：:][^）]*）/g;
/** 自然括号语义（英）：(inner: …) (V.O.: …) (SFX: …) (MUSIC: …) (AMBIENT: …) */
const INLINE_CUE_EN_RE = /\((?:INNER|V\.?O\.?|O\.?S\.?|SFX|SOUND\s?EFFECT|MUSIC|AMBIENT|AMBIENCE)[^)]*\)/gi;
const SFX_CUE_RE = /（(?:音效|配乐|环境音)[：:]([^）]*)）/;
const SFX_CUE_EN_RE = /\((?:SFX|SOUND\s?EFFECT|MUSIC|AMBIENT|AMBIENCE)[^:)]*:?\s*([^)]*)\)/i;
const INNER_CUE_RE = /（(?:内心|OS|画外音)[：:]?([^）]*)）/;
const INNER_CUE_EN_RE = /\((?:INNER|V\.?O\.?|O\.?S\.?)[^:)]*:?\s*([^)]*)\)/i;

// 五维可理解性词表（机器判断正文是否把“画面/动作/微情绪/声音”写足）
const VISUAL_WORDS = ['灯', '光', '影', '天色', '墙', '地', '桌', '窗', '门', '风', '雾', '雨', '雪', '街', '楼道', '走廊', '房间', '车', '树', '天空', '暖', '冷', '昏暗', '明亮', '逆光', '阴影', '空间', '巷', '楼'];
const ACTION_WORDS = ['走', '站', '坐', '蹲', '转', '抬', '低', '握', '攥', '放', '推', '拉', '靠', '退', '回', '弯腰', '点头', '摇头', '盯', '擦', '搁', '抖', '递', '扑', '闪', '迈', '蜷', '抚', '扣', '垂', '吸', '迈'];
const EMOTION_WORDS = ['笑', '哭', '泪', '皱眉', '眼神', '脸色', '嘴角', '沉默', '咬', '红', '僵', '怔', '顿', '颤', '哽', '叹', '睨', '瞥', '舒', '紧绷', '苍白'];
const SOUND_WORDS = ['声', '响', '音', '嗡', '砰', '咔', '嗒', '吱', '哗', '咚', '嘶', '鸣', '脚步', '呼吸', '寂静', '回声'];
// 英文五维词表（英文 AIGC 本同标准判定；与中文表同属启发式，宽松子串匹配）
const VISUAL_WORDS_EN = ['light', 'lamp', 'shadow', 'dark', 'dim', 'bright', 'wall', 'floor', 'door', 'window', 'street', 'hallway', 'corridor', 'room', 'car', 'tree', 'sky', 'warm', 'cold', 'neon', 'glow', 'beam', 'alley', 'stair', 'rain', 'fog', 'wind', 'dusk', 'ceiling'];
const ACTION_WORDS_EN = ['walk', 'step', 'stand', 'sit', 'crouch', 'turn', 'raise', 'lower', 'grip', 'clench', 'push', 'pull', 'lean', 'back away', 'nod', 'shake', 'stare', 'wipe', 'tremble', 'hand', 'rush', 'lunge', 'bend', 'freeze', 'flinch', 'grab', 'slam', 'kneel', 'finger', 'breath'];
const EMOTION_WORDS_EN = ['smile', 'cry', 'tear', 'frown', 'brow', 'gaze', 'eyes', 'face', 'lips', 'silent', 'bite', 'flush', 'stiff', 'froze', 'pause', 'sigh', 'glance', 'jaw', 'pale', 'wince'];
const SOUND_WORDS_EN = ['sound', 'noise', 'voice', 'buzz', 'bang', 'click', 'thud', 'creak', 'crash', 'knock', 'footstep', 'breath', 'silence', 'echo', 'hum', 'ring', 'snap', 'roar', 'beep'];
/** 检测正文主语言：拉丁字母数多于 CJK 即按英文本处理 */
function isEnglishText(text: string): boolean {
  const cjkN = (text.match(/[一-鿿]/g) || []).length;
  const latN = (text.match(/[a-z]/gi) || []).length;
  return latN > cjkN;
}
// 流畅度红线：一行 ≥2 个方括号技术标签即判“提示词手册化”
const BRACKET_STACK_RE = /【[^】]{1,8}】[^【\n]*【[^】]{1,8}】/;
// 关键词堆砌：顿号分隔 ≥4 段且整段没有动作动词
const KEYWORD_STACK_RE = /、[^、\n]{1,10}、[^、\n]{1,10}、[^、\n]{1,10}、/;

export type AigcBlockType = 'narrate' | 'dialogue' | 'inner' | 'sfx';
export interface AigcBlock { type: AigcBlockType; speaker?: string; cue?: string; text: string }
export interface AigcScene {
  no: number; head: string; place: string; time: string;
  interior: '内' | '外' | null; blocks: AigcBlock[]; cjk: number;
}
export interface AigcParse {
  title: string; scenes: AigcScene[]; sceneCount: number;
  dialogueCount: number; orphanLines: string[]; // 场标前的游离叙述（解析异常信号）
}

function countCjk(s: string): number { const m = s.match(/[一-鿿]/g); return m ? m.length : 0; }
function countEnWords(s: string): number { const m = s.match(/[a-z][a-z'-]*/gi); return m ? m.length : 0; }
/** 内容计量单位：中文按汉字、英文按单词；比例型指标对两种语言量纲自洽 */
function blockUnits(s: string, en: boolean): number { return en ? countEnWords(s) : countCjk(s); }

/** 集→场→块 的确定性拆分（libtv 类工作流的入口） */
export function parseAigcEpisode(text: string): AigcParse {
  const lines = (text || '').split(/\r?\n/);
  const titleM = text.match(TITLE_RE) || text.match(TITLE_EN_RE);
  const title = titleM ? titleM[0].trim() : '';
  const scenes: AigcScene[] = [];
  const orphanLines: string[] = [];
  let cur: AigcScene | null = null;
  // 两行式台词：暂存上一行的"角色（情绪）："提示，下一行作为台词正文
  let pendingCue: { speaker: string; cue: string } | null = null;

  const pushBlock = (b: AigcBlock) => { if (cur) { cur.blocks.push(b); cur.cjk += countCjk(b.text); } };

  for (const raw of lines) {
    // 去掉行首 markdown 标记（# 标题、* 加粗），纯分隔线 ---/*** 跳过
    const line = raw.trim().replace(/^#{1,6}\s*/, '').replace(/^\*+|\*+$/g, '').trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;
    // 集标题行、本集完收尾标记不属于任何场，但不算游离异常（中英两套写法；兼容 markdown、"剧名: EP1 The Board Seat" 在行中）
    const isEpTitle = (/第\s*[0-9一二三四五六七八九十]+\s*集/.test(line) && line.length <= 40)
      || (/^(?:EP|EPISODE)\s*\d+\b/i.test(line) && line.length <= 60)
      || (/\bEP(?:ISODE)?\s*\d+\b/i.test(line) && line.length <= 60 && !SCENE_HEAD_EN_RE.test(line));
    if (isEpTitle) continue;
    if (/^[（(]?本集完[)）]?$/.test(line) || /^(END\s+OF\s+EPISODE|TO\s+BE\s+CONTINUED)\.?$/i.test(line)) continue;
    // 两行式台词：若上一行是角色提示行，则本行在非场标/非另一个提示行时作为台词正文
    if (pendingCue) {
      const nextIsHead = SCENE_HEAD_RE.test(line) || SCENE_HEAD_EN_RE.test(line);
      const nextIsCue = CUE_ONLY_RE.test(line) || DIALOGUE_RE.test(line);
      if (!nextIsHead && !nextIsCue && cur) {
        pushBlock({ type: 'dialogue', speaker: pendingCue.speaker, cue: pendingCue.cue, text: line });
        pendingCue = null;
        continue;
      }
      // 提示行后没接到正文（换场/又一个提示）：把悬空提示退回当叙述
      if (cur) pushBlock({ type: 'narrate', text: pendingCue.cue ? `${pendingCue.speaker} (${pendingCue.cue}):` : `${pendingCue.speaker}:` });
      pendingCue = null;
    }
    const head = line.match(SCENE_HEAD_RE);
    const headEn = head ? null : line.match(SCENE_HEAD_EN_RE);
    if (head || headEn) {
      let interior: '内' | '外' | null;
      let place: string;
      let time: string;
      if (head) {
        interior = head[1] === '内景' ? '内' : head[1] === '外景' ? '外' : null;
        const rest = head[2];
        // 地点·时间（兼容 · / ／ / / 分隔；时间取末段常见词）
        const parts = rest.split(/[·／/]/).map((s) => s.trim()).filter(Boolean);
        time = parts.length > 1 ? parts[parts.length - 1] : '';
        place = parts.length > 1 ? parts.slice(0, -1).join('·') : rest;
      } else {
        const tag = String(headEn![1]).toUpperCase().replace(/\./g, '');
        interior = tag.includes('INT') && tag.includes('EXT') ? null : tag.startsWith('INT') ? '内' : '外';
        const rest = headEn![2];
        // 英文场标：PLACE - TIME，末段命中时间词才切分，否则整段当地点
        const seg = rest.split(/\s+[–—-]\s+/).map((s) => s.trim()).filter(Boolean);
        if (seg.length > 1 && TIME_EN_RE.test(seg[seg.length - 1])) {
          time = seg[seg.length - 1].replace(/\.$/, '');
          place = seg.slice(0, -1).join(' - ');
        } else { time = ''; place = rest; }
      }
      cur = { no: scenes.length + 1, head: line, place, time, interior, blocks: [], cjk: 0 };
      scenes.push(cur);
      continue;
    }
    if (!cur) { orphanLines.push(line); continue; }
    // 角色提示行独占一行（行业标准两行式）：暂存，下一行作为台词正文
    const cueOnly = line.match(CUE_ONLY_RE);
    if (cueOnly) {
      pendingCue = { speaker: cueOnly[1] ?? cueOnly[3] ?? cueOnly[4] ?? '', cue: cueOnly[2] ?? cueOnly[5] ?? '' };
      continue;
    }
    const dlg = line.match(DIALOGUE_RE);
    if (dlg) {
      pushBlock({ type: 'dialogue', speaker: dlg[1] ?? dlg[3] ?? dlg[4], cue: dlg[2] ?? dlg[5] ?? '', text: dlg[6] });
      continue;
    }
    // 自然段：先抽出括号语义块，剩余作为叙述；一段内允许夹带（内心：…）（音效：…）/(V.O.:…) (SFX:…)
    let rest = line;
    const cues = [...(line.match(INLINE_CUE_RE) || []), ...(line.match(INLINE_CUE_EN_RE) || [])];
    for (const c of cues) {
      rest = rest.replace(c, '');
      if (SFX_CUE_RE.test(c) || SFX_CUE_EN_RE.test(c)) pushBlock({ type: 'sfx', text: c.replace(/[（）()]/g, '') });
      else if (INNER_CUE_RE.test(c) || INNER_CUE_EN_RE.test(c)) pushBlock({ type: 'inner', text: c.replace(/[（）()]/g, '') });
    }
    rest = rest.trim();
    if (rest) {
      // 自然段中夹带的“角色（情绪）：台词”也拆成独立台词块（LLM 常把台词写进段落里）；
      // 仅在句首边界处切分，避免“屏幕跳着两个字：管家”这类叙述被误判为台词（中英括号都认）
      const embed = rest.split(EMBED_SPLIT_RE);
      let emitted = false;
      for (const seg of embed) {
        const m = seg.match(EMBED_LINE_RE);
        if (m) {
          const speaker = m[1] ?? m[3] ?? m[4];
          // 中文角色名要求 2+ 字（单字冒号多为叙述）；英文同样要求至少 2 个字符
          if (speaker && speaker.length >= 2) {
            pushBlock({ type: 'dialogue', speaker, cue: m[2] ?? m[5] ?? '', text: m[6].trim() });
            emitted = true;
          } else if (seg.trim()) { pushBlock({ type: 'narrate', text: seg.trim() }); emitted = true; }
        } else if (seg.trim()) {
          pushBlock({ type: 'narrate', text: seg.trim() });
          emitted = true;
        }
      }
      if (!emitted) pushBlock({ type: 'narrate', text: rest });
    }
  }
  // 收尾：最后一行恰为角色提示行却没有正文，退回当叙述，避免吞掉
  if (pendingCue && cur) pushBlock({ type: 'narrate', text: pendingCue.cue ? `${pendingCue.speaker} (${pendingCue.cue}):` : `${pendingCue.speaker}:` });
  const dialogueCount = scenes.reduce((s, x) => s + x.blocks.filter((b) => b.type === 'dialogue').length, 0);
  return { title, scenes, sceneCount: scenes.length, dialogueCount, orphanLines };
}

// ---------- 五维可理解性 + 流畅度诊断 ----------

// ---------- 单集容量与构成规划（v2.33：按成片时长精算，不是拍脑袋定字数） ----------

/**
 * 每分钟成片对应字数带（用户研判锁定）：1200-1500 汉字/分钟。
 * 物理依据：① 中文发声 4-5 字/秒，1 分钟最多 240-300 发声字（台词+OS+内心独白）；
 * ② 其余字数是给图片/视频/音频模型看的“非发声画面叙述”，所以 AIGC 本远多于发声量。
 */
export const AIGC_PER_MIN_RANGE: [number, number] = [1200, 1500];
/** 发声内容（台词+OS+内心独白）占全片比例合理带：18%-28%，理想约 22% */
export const SPOKEN_RATIO_BAND: [number, number] = [0.18, 0.28];
export interface AigcVolumePlan {
  durationMin: number;
  totalRange: [number, number];      // 全集总字数带
  spokenRange: [number, number];     // 台词+OS+内心独白字数带（受语速硬约束）
  narrativeRange: [number, number]; // 画面叙述（环境/动作/微情绪/氛围，不发声）
  dialogueLines: [number, number];   // 建议台词句数
  avgLineLen: [number, number];      // 单句台词建议长度
  noteZh: string; noteEn: string;
}
export function planAigcVolume(durationMin = 1): AigcVolumePlan {
  const d = Math.min(5, Math.max(0.5, Number(durationMin) || 1));
  const totalRange: [number, number] = [Math.round(AIGC_PER_MIN_RANGE[0] * d), Math.round(AIGC_PER_MIN_RANGE[1] * d)];
  // 发声硬上限：时长秒数 × 5字/秒（最快语速），下限 ×4字/秒并留 15% 停顿折损
  const secs = d * 60;
  const spokenRange: [number, number] = [Math.round(secs * 4 * 0.85), Math.round(secs * 5)];
  const narrativeRange: [number, number] = [totalRange[0] - spokenRange[1], totalRange[1] - spokenRange[0]];
  const dialogueLines: [number, number] = [Math.round(spokenRange[0] / 35), Math.max(8, Math.round(spokenRange[1] / 28))];
  const avgLineLen: [number, number] = [25, 38];
  const noteZh = `成片约${d}分钟：全集${totalRange[0]}-${totalRange[1]}字；台词+OS+内心独白约${spokenRange[0]}-${spokenRange[1]}字（占18%-28%，受4-5字/秒语速硬约束），其余为画面叙述；建议${dialogueLines[0]}-${dialogueLines[1]}句台词、单句25-38字。`;
  const noteEn = `~${d}-min cut: ${totalRange[0]}-${totalRange[1]} CJK chars total; spoken content (dialogue+V.O.+inner monologue) ${spokenRange[0]}-${spokenRange[1]} chars (18-28%, bounded by 4-5 chars/sec speech), the rest is non-spoken visual narrative; ${dialogueLines[0]}-${dialogueLines[1]} lines, 25-38 chars each.`;
  return { durationMin: d, totalRange, spokenRange, narrativeRange, dialogueLines, avgLineLen, noteZh, noteEn };
}

export interface AigcComposition {
  totalCjk: number; narrativeCjk: number; spokenCjk: number; sfxCjk: number;
  spokenRatio: number; dialogueLines: number; avgDialogueLen: number;
  compositionIssues: string[];
}
/** 构成体检：发声内容（台词+OS+内心）vs 画面叙述的比例是否合理 */
export function analyzeAigcComposition(text: string): AigcComposition {
  const p = parseAigcEpisode(text);
  const en = isEnglishText(text);
  let narrativeCjk = 0, spokenCjk = 0, sfxCjk = 0, dialogueLines = 0, dialogueLenSum = 0;
  for (const sc of p.scenes) for (const b of sc.blocks) {
    const n = blockUnits(b.text, en);
    if (b.type === 'narrate') narrativeCjk += n;
    else if (b.type === 'sfx') sfxCjk += n;
    else { spokenCjk += n; if (b.type === 'dialogue') { dialogueLines++; dialogueLenSum += n; } }
  }
  const totalCjk = narrativeCjk + spokenCjk + sfxCjk;
  const spokenRatio = totalCjk ? Math.round((spokenCjk / totalCjk) * 100) / 100 : 0;
  const compositionIssues: string[] = [];
  // 英文用单词计量，最低样本量与台词长度阈值相应换算（1 汉字 ≈ 0.6 英文词）
  const minSample = en ? 60 : 100;
  const longLineAvg = en ? 32 : 45;
  if (totalCjk >= minSample) {
    if (en) {
      if (spokenRatio > SPOKEN_RATIO_BAND[1]) compositionIssues.push(`Spoken content is ${Math.round(spokenRatio * 100)}% (>28%): dialogue crowds out visual material; convert some information into action and environment description`);
      if (spokenRatio < SPOKEN_RATIO_BAND[0]) compositionIssues.push(`Spoken content is ${Math.round(spokenRatio * 100)}% (<18%): too little human voice makes the episode flat; add dialogue or inner-monologue beats`);
      if (dialogueLines > 0 && dialogueLenSum / dialogueLines > longLineAvg) compositionIssues.push(`Dialogue lines average ${Math.round(dialogueLenSum / dialogueLines)} words, too long for vertical-screen viewers; split into short 15-25 word exchanges`);
    } else {
      if (spokenRatio > SPOKEN_RATIO_BAND[1]) compositionIssues.push(`台词+OS占比${Math.round(spokenRatio * 100)}%偏高（>28%），画面会被台词塞满、视频模型缺可生成内容，应把部分信息转成动作与环境描写`);
      if (spokenRatio < SPOKEN_RATIO_BAND[0]) compositionIssues.push(`台词+OS占比${Math.round(spokenRatio * 100)}%偏低（<18%），全片缺少人物发声容易闷，应补对话或内心独白节奏点`);
      if (dialogueLines > 0) {
        const avg = dialogueLenSum / dialogueLines;
        if (avg > longLineAvg) compositionIssues.push(`单句台词平均${Math.round(avg)}字过长，竖屏观众读不完，建议拆成25-38字短句回合`);
      }
    }
  }
  return { totalCjk, narrativeCjk, spokenCjk, sfxCjk, spokenRatio, dialogueLines, avgDialogueLen: dialogueLines ? Math.round(dialogueLenSum / dialogueLines) : 0, compositionIssues };
}

// ---------- v2.80 确定性发声比提升：把叙述中描写人物内心的句子转为 (inner: …) ----------

const INNER_KEYWORDS_EN = /\b(think|feels?|know|realiz|wonder|notic|understand|sense|recall|remember|hope|fear|doubt|believe|wish|regret|relief|anger|fury|grief|joy|panic|anxi|worr|heart|mind|soul|conscious|thought|memory|flashback)\b/i;
const INNER_KEYWORDS_ZH = /(想|觉得|知道|明白|意识|疑惑|注意|懂|感觉|回忆|记得|希望|害怕|怀疑|相信|但愿|后悔|释然|愤怒|怒火|悲伤|喜悦|慌张|焦虑|担心|心里|心中|心头|心底|脑海|意识|念头|回忆|闪回)/;

/**
 * 把叙述中描写人物内心状态的句子转为 (inner: …) 独白，机械提升发声占比。
 * 只改 attribution 不改内容：人物的内心活动本就该是发声内容，模型常把它写成叙述。
 * 流式预算控制：逐句转换，发声占比进入 19% 即停，单句会冲过 26% 上限就跳过（含 wrapper 词留足余量，避免越过 28% 硬线）。
 */
export function boostSpokenRatio(text: string, targetAdd: number): string {
  const en = isEnglishText(text);
  // 已在发声带内则不动
  const base = analyzeAigcComposition(text);
  if (base.spokenRatio >= 0.18) return text;
  const total = base.totalCjk || 1;
  const FLOOR = 0.19, CEIL = 0.26;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let curSpoken = base.spokenCjk;
  let added = 0;
  const innerKw = en ? INNER_KEYWORDS_EN : INNER_KEYWORDS_ZH;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(raw); continue; }
    // 跳过场标、台词、已有的括号语义块
    if (line.match(SCENE_HEAD_RE) || line.match(SCENE_HEAD_EN_RE) || line.match(DIALOGUE_RE) || /^(第\s*[0-9一二三四五六七八九十]+\s*集|EP\d|EPISODE)/i.test(line)) {
      out.push(raw); continue;
    }
    if (curSpoken / total >= FLOOR || added >= targetAdd) { out.push(raw); continue; }
    // 按句切分，把含内心关键词的句子转成 (inner: …)
    const sents = line.match(/[^。！？….!?]+[。！？….!?]*\s*/g) || [line];
    let converted = false;
    const rebuilt = sents.map((s) => {
      const t = s.trim();
      if (!t) return s;
      if (curSpoken / total >= FLOOR || added >= targetAdd) return s;
      if (innerKw.test(t) && t.length >= 8) {
        const units = blockUnits(t, en);
        // 加上这一句会冲过占比上限（或外层 targetAdd 上限）：跳过这句，找下一句更小的
        if ((curSpoken + units) / total > CEIL || added + units > targetAdd) return s;
        curSpoken += units;
        added += units;
        converted = true;
        // 去掉句末标点后包进 (inner: …)
        const clean = t.replace(/[。！？….!?]+$/, '');
        return en ? `(inner: ${clean}) ` : `（内心：${clean}）`;
      }
      return s;
    }).join('');
    out.push(converted ? rebuilt : raw);
  }
  return out.join('\n');
}

/** 逐场构成曲线（v2.35）：让用户看到哪场台词太满、哪场没人说话 */
export interface SceneCurvePoint {
  scene: number; head: string; cjk: number;
  narrativeCjk: number; spokenCjk: number; spokenRatio: number; dialogueLines: number;
  role: 'opening' | 'body' | 'climax' | 'ending'; // 开场/铺陈/高潮/集尾钩子
  inBand: boolean;
}
export function analyzeAigcSceneCurve(text: string): SceneCurvePoint[] {
  const p = parseAigcEpisode(text);
  const en = isEnglishText(text);
  const n = p.scenes.length;
  return p.scenes.map((sc, i) => {
    let narrativeCjk = 0, spokenCjk = 0, dialogueLines = 0;
    for (const b of sc.blocks) {
      const len = blockUnits(b.text, en);
      if (b.type === 'narrate' || b.type === 'sfx') narrativeCjk += len;
      else { spokenCjk += len; if (b.type === 'dialogue') dialogueLines++; }
    }
    const cjk = narrativeCjk + spokenCjk;
    const spokenRatio = cjk ? Math.round((spokenCjk / cjk) * 100) / 100 : 0;
    const role: SceneCurvePoint['role'] = i === 0 ? 'opening' : i === n - 1 ? 'ending' : (i === n - 2 ? 'climax' : 'body');
    // 开场/集尾允许台词更密（抓人/钩子），铺陈场允许更稀，带内放宽到 0.12-0.40
    const [lo, hi] = role === 'body' ? SPOKEN_RATIO_BAND : [0.08, 0.45];
    // 英文按单词计量，过场短场阈值相应降低
    const shortScene = en ? cjk < 25 : cjk < 60;
    return { scene: sc.no, head: sc.head, cjk, narrativeCjk, spokenCjk, spokenRatio, dialogueLines, role, inBand: shortScene ? true : spokenRatio >= lo && spokenRatio <= hi };
  });
}

export interface AigcCoverage {
  sceneIssues: string[];       // 场内缺维度
  smoothnessIssues: string[];  // 手册化/堆砌/场标过长
  compositionIssues: string[]; // 发声/叙述比例失调、台词过长
  dimensions: { visual: number; action: number; emotion: number; sound: number; dialogue: number }; // 覆盖场占比%
  composition: AigcComposition;
  sceneCount: number;
  score: number;               // 0-100
  pass: boolean;
}

const hasAny = (s: string, words: string[]) => words.some((w) => s.toLowerCase().includes(w.toLowerCase()));

/**
 * 五维 + 流畅度 + 构成 闸门。
 * lang 缺省按正文自动判定；英文本返回英文 issue（英文链路 prompt 零中文），词表与短场阈值同步切换。
 */
export function validateAigcScreenplay(text: string, lang: 'zh' | 'en' = isEnglishText(text || '') ? 'en' : 'zh'): AigcCoverage {
  const p = parseAigcEpisode(text);
  const en = lang === 'en';
  const sceneIssues: string[] = [];
  const smoothnessIssues: string[] = [];
  let vis = 0, act = 0, emo = 0, snd = 0, dlg = 0;
  const [VW, AW, EW, SW] = en
    ? [VISUAL_WORDS_EN, ACTION_WORDS_EN, EMOTION_WORDS_EN, SOUND_WORDS_EN]
    : [VISUAL_WORDS, ACTION_WORDS, EMOTION_WORDS, SOUND_WORDS];

  if (p.sceneCount < 2) sceneIssues.push(en
    ? `Only ${p.sceneCount} scene(s) parsed; an AIGC episode must be clearly split into scenes (use INT./EXT. heads, aim for 3-5 scenes)`
    : `全集仅解析出 ${p.sceneCount} 个场，AIGC本应按场清晰切分（建议3-5场）`);
  if (p.orphanLines.length) sceneIssues.push(en
    ? `${p.orphanLines.length} line(s) sit outside any scene head and cannot be assigned by the machine parser`
    : `存在 ${p.orphanLines.length} 行游离于场标之外的文本，机器无法归场`);

  for (const sc of p.scenes) {
    const body = sc.blocks.map((b) => b.text).join(' ');
    // 发声含台词与内心/OS/画外音独白（规格：发声=台词+OS+内心），任一即算该场有人声
    const hasDlg = sc.blocks.some((b) => b.type === 'dialogue' || b.type === 'inner');
    const sceneUnits = sc.blocks.reduce((s, b) => s + blockUnits(b.text, en), 0);
    const transition = sceneUnits < (en ? 25 : 60); // 极短过场场，豁免台词要求
    const S = en ? `Scene ${sc.no}` : `场${sc.no}`;
    if (hasAny(body, VW)) vis++; else sceneIssues.push(en ? `${S} lacks environment/light/space imagery; image models cannot establish the scene` : `${S}缺环境/光影/空间画面，图片模型无法定场`);
    if (hasAny(body, AW)) act++; else sceneIssues.push(en ? `${S} lacks character action; video models have no behavior to drive` : `${S}缺人物动作，视频模型无可驱动行为`);
    if (hasAny(body, EW)) emo++; else sceneIssues.push(en ? `${S} lacks facial expression or micro-emotion` : `${S}缺表情/微情绪刻画`);
    if (hasAny(body, SW) || sc.blocks.some((b) => b.type === 'sfx')) snd++;
    if (hasDlg) dlg++; else if (!transition) sceneIssues.push(en ? `${S} has no dialogue and is not a short transition beat` : `${S}无台词且非过场短场`);
    if (en ? sc.head.length > 56 : countCjk(sc.head) > 24) smoothnessIssues.push(en ? `${S} head is too long (>56 chars); keep it to INT./EXT. PLACE - TIME only` : `${S}场标过长（>24字），会打断阅读，应只留 内外景·地点·时间`);
    for (const b of sc.blocks) {
      if (BRACKET_STACK_RE.test(b.text)) smoothnessIssues.push(en ? `${S} stacks square-bracket technical tags like a prompt sheet` : `${S}出现连续技术标签【】堆叠，属提示词手册化`);
      if (!en && KEYWORD_STACK_RE.test(b.text) && !hasAny(b.text, ACTION_WORDS)) smoothnessIssues.push(`${S}出现关键词顿号堆砌且无动作句`);
    }
  }
  const n = Math.max(1, p.sceneCount);
  const dimensions = {
    visual: Math.round((vis / n) * 100), action: Math.round((act / n) * 100),
    emotion: Math.round((emo / n) * 100), sound: Math.round((snd / n) * 100),
    dialogue: Math.round((dlg / n) * 100),
  };
  // 分数：五维覆盖 70（每维14）+ 结构/流畅 30
  const coverScore = Object.values(dimensions).reduce((s, x) => s + x, 0) / 100 * 14;
  const structScore = p.sceneCount >= 2 ? 10 : Math.max(0, p.sceneCount * 5);
  const smoothScore = Math.max(0, 10 - smoothnessIssues.length * 5) + (p.orphanLines.length ? 0 : 10);
  const composition = analyzeAigcComposition(text);
  const compScore = Math.max(0, 10 - composition.compositionIssues.length * 5);
  const score = Math.round(Math.max(0, Math.min(100, coverScore + structScore + smoothScore + compScore)));
  const pass = sceneIssues.length === 0 && smoothnessIssues.length === 0 && composition.compositionIssues.length === 0;
  return { sceneIssues, smoothnessIssues, compositionIssues: composition.compositionIssues, dimensions, composition, sceneCount: p.sceneCount, score, pass };
}

// ---------- 机器层：分镜清单（供 libtv 类自动化工作流） ----------

export interface MachineShot {
  scene: number; shot: number;
  size: '特写' | '近景' | '中景' | '全景' | '远景';
  move: '固定' | '推' | '拉' | '摇' | '跟' | '横移';
  light: string;
  visual: string;
  lines: { speaker: string; cue: string; text: string }[];
  audio: string[];
  inner: string[];
}

const CLOSEUP_WORDS = ['指尖', '手', '眼', '眸', '嘴角', '泪', '指节', '睫毛', '唇', '手腕'];
const CLOSE_WORDS = ['脸', '表情', '眉头', '目光', '侧脸'];
const WIDE_WORDS = ['整个', '环顾', '全景', '远处', '整条', '整片', '空旷', '全貌'];
function inferSize(t: string): MachineShot['size'] {
  if (CLOSEUP_WORDS.some((w) => t.includes(w))) return '特写';
  if (CLOSE_WORDS.some((w) => t.includes(w))) return '近景';
  if (WIDE_WORDS.some((w) => t.includes(w))) return '全景';
  return '中景';
}
function inferMove(t: string): MachineShot['move'] {
  if (/跟在|追随|追着|跟着跑/.test(t)) return '跟';
  if (/横移|划过|扫过/.test(t)) return '横移';
  if (/推近|凑近|走近|靠近|逼近/.test(t)) return '推';
  if (/拉远|退成|后退|远去/.test(t)) return '拉';
  if (/环视|环顾|转头|转身/.test(t)) return '摇';
  return '固定';
}
function inferLight(scene: AigcScene, t: string): string {
  const mix = `${scene.time} ${t}`;
  if (/夜|深夜|凌晨|昏暗|昏黄|阴影|逆光/.test(mix)) return '低照度，明暗对比，光源方向随场景';
  if (/晨|清晨|微光/.test(mix)) return '清晨柔光，低对比暖调';
  if (/黄昏|傍晚|夕阳/.test(mix)) return '黄昏暖金色侧光';
  if (/昼|日|中午|午后|明亮/.test(mix)) return '日间自然光，均匀布光';
  return '随剧情情绪定光，保持同场一致';
}
// 中英文句界：中文按全角标点切；英文句号必须后接空白才切（避免 INT. / U.S. / 3.5 被误切）
const SENT_SPLIT = /(?<=[。！？!?…])|(?<=\.)(?=\s)/;

/** 由流畅正文确定性生成机器分镜清单（正文本身不写任何镜头术语） */
export function buildShotManifest(text: string): { title: string; shots: MachineShot[]; shotCount: number } {
  const p = parseAigcEpisode(text);
  const en = isEnglishText(text || '');
  // 分块按语言等量：中文 70 汉字；英文 42 词（≈70 汉字当量），避免英文一段一镜
  const chunkLimit = en ? 42 : 70;
  const shots: MachineShot[] = [];
  for (const sc of p.scenes) {
    let cur: MachineShot | null = null;
    // 场首若先出现音效/内心/台词（叙述在后），先缓存并并入下一个有画面的镜头
    const pending: { lines: MachineShot['lines']; audio: string[]; inner: string[] } = { lines: [], audio: [], inner: [] };
    const flushPending = (sh: MachineShot) => {
      sh.lines.unshift(...pending.lines); sh.audio.unshift(...pending.audio); sh.inner.unshift(...pending.inner);
      pending.lines = []; pending.audio = []; pending.inner = [];
    };
    const ensure = (visual: string): MachineShot => {
      if (!cur) {
        cur = { scene: sc.no, shot: shots.length + 1, size: inferSize(visual), move: inferMove(visual), light: inferLight(sc, visual), visual, lines: [], audio: [], inner: [] };
        shots.push(cur);
      }
      return cur;
    };
    for (const b of sc.blocks) {
      if (b.type === 'narrate') {
        // 长叙述段按句拆成多个镜头，保证单镜头信息密度可被视频模型执行；
        // 英文单句常超过分块上限，再按逗号切短句（仅英文，中文保持原句界）。
        const sents = b.text.split(SENT_SPLIT)
          .flatMap((s) => {
            const t = s.trim();
            if (!t) return [];
            if (!en || blockUnits(t, en) <= chunkLimit) return [t];
            return t.split(/(?<=,)\s+/).map((x) => x.trim()).filter(Boolean);
          });
        const chunks: string[] = [];
        let buf = '';
        // 合块上限：先判「再加一句会不会超太多」，避免两块相加后超限
        const cap = Math.round(chunkLimit * 1.25);
        for (const s of sents) {
          const joined = en && buf ? `${buf} ${s}` : buf + s;
          if (buf && blockUnits(joined, en) > cap) { chunks.push(buf); buf = s; continue; }
          buf = joined;
          if (blockUnits(buf, en) >= chunkLimit) { chunks.push(buf); buf = ''; }
        }
        if (buf) chunks.push(buf);
        for (const ch of chunks) {
          cur = null; // 每段叙述开新镜头
          const sh = ensure(ch);
          flushPending(sh);
        }
      } else if (b.type === 'dialogue') {
        const c = cur as MachineShot | null;
        if (c) c.lines.push({ speaker: b.speaker ?? '', cue: b.cue ?? '', text: b.text });
        else pending.lines.push({ speaker: b.speaker ?? '', cue: b.cue ?? '', text: b.text });
      } else if (b.type === 'sfx') {
        const c = cur as MachineShot | null;
        if (c) c.audio.push(b.text); else pending.audio.push(b.text);
      } else if (b.type === 'inner') {
        const c = cur as MachineShot | null;
        if (c) c.inner.push(b.text); else pending.inner.push(b.text);
      }
    }
    // 场末仍有残留（整场无叙述段，纯台词场）：兜底建一个镜头承载，保证信息不丢
    if (pending.lines.length || pending.audio.length || pending.inner.length) {
      const sh = ensure(''); flushPending(sh);
    }
  }
  return { title: p.title, shots, shotCount: shots.length };
}

// ---------- 生成前写作指令（下发架构师/撰写/润色岗） ----------

export function aigcScreenplayDirective(lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    return [
      '【OUTPUT FORMAT · Z-AIGC FLOWING PRODUCTION SCRIPT, 1200-1500 Chinese chars/episode (equivalent length in English)】',
      'It is first and foremost a readable screenplay, NEVER a prompt sheet: no bracket stacks like [shot][camera][lighting], no keyword comma lists, no model parameters.',
      'Layout that stays smooth to read yet is deterministically parsable scene by scene:',
      '1) Episode line: title + episode number. 2) A SHORT scene heading on its own line: INT./EXT. + place + time (under 24 chars).',
      '3) Body = flowing narrative paragraphs (no △ markers): weave environment, lighting, camera-worthy action, micro-expression and inner state INTO complete sentences; use natural screenplay parentheticals only: (inner: …), (V.O.: …), (SFX: …), (MUSIC: …). 4) Dialogue as NAME (emotion/action): line.',
      'Every scene must let downstream text/image/video/audio models see five dimensions: a visual environment that establishes the space, a concrete character action, a micro-emotion or expression, a sound or ambience cue, and dialogue (a sub-10-second transition scene may skip dialogue).',
      'Organize one micro narrative unit (small goal → small obstacle → small result) per ~30 seconds; the system will split paragraphs into shots automatically, so do NOT write shot-size or camera-move jargon in the text itself.',
      'Micro example of the correct texture: "She presses every crease of the shirt flat with her fingertips; the cold white tube light flickers, half her face sunk in shadow. (SFX: the lamp hums, a cardboard box scrapes the floor.) The door slams open and the frame jolts, warm hallway light cutting two silhouettes onto the floor."',
      'Volume is budgeted by finished runtime: 1200-1500 chars per on-screen minute (a ~2-min episode = 2400-2800). Spoken content (dialogue + V.O. + inner monologue) is only 18-28% — speech runs 4-5 chars/sec, so two minutes allow at most ~600 spoken chars, roughly 14-18 lines of 25-38 chars each; the other 72-82% MUST be non-spoken visual narrative (environment/action/micro-emotion/atmosphere). That extra bulk is exactly why an AIGC script is longer than a live-action one: the extra words are written for image/video/audio models to SEE, not for actors to say.',
    ].join('\n');
  }
  return [
    '【输出制式·Z-AIGC流畅制作本，单集1200-1500字】',
    '它首先是一部读着顺畅的剧本，绝不是提示词手册：禁止【景别】【运镜】【光影】这类方括号标签堆叠，禁止关键词顿号罗列，禁止任何模型参数。',
    '版式（人读顺畅，同时机器可按集/场确定性拆分）：',
    '1）集首行：剧名+集数标题。2）每场只占一行短场标：内景/外景+地点+时间（不超过24字）。',
    '3）正文用流畅自然段（不加△）：把环境空间、光影、可拍摄动作、表情微情绪、内心活动全部写进完整句子；语义只通过剧本惯例的自然括号承载：（内心：…）（OS/画外音：…）（音效：…）（配乐：…）。4）台词保持“角色名（情绪/动作）：台词”。',
    '每个场都必须让下游语言/图片/视频/音频模型看清五个维度：能定场的环境画面、具体的人物动作、表情或微情绪、声音/氛围线索、人物台词（10秒内过场短场可无台词）。',
    '约每30秒一个微叙事单元（小目标→小阻碍→小结果）；系统会自动把自然段拆成分镜，所以正文里不要写景别、运镜术语。',
    '正确质感示例：“她指尖把衬衫每一道折痕压平，冷白灯管一闪一闪，半边脸埋在阴影里。（音效：灯管滋滋电流声，纸箱蹭着地面。）门‘砰’地被踹开，画面跟着晃了一下，走廊暖光在地上切出两道人影。”',
    '单集容量按成片时长精算：每分钟成片对应1200-1500字（两分钟单集约2400-2800字）；其中台词+OS+内心独白只占18%-28%——中文语速4-5字/秒，两分钟最多约600发声字、约14-18句、单句25-38字；其余72%-82%必须是环境、动作、微情绪、氛围的画面叙述。AIGC本比真人实拍本厚的根本原因就在这里：多出来的字不是台词，是写给图片/视频/音频模型“看”的。',
  ].join('\n');
}
