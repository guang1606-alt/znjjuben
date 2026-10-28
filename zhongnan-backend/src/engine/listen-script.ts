/**
 * v2.55 「听剧本」朗读脚本引擎（确定性、零模型调用、不耗积分）
 * 把标准剧本（真人实拍本 / AIGC 制作本）解析为 TTS 可直接消费的音轨片段：
 *  - scene    场标（内景/外景·地点·时间）→ 旁白口播
 *  - action   动作/环境/心理描写 → 旁白口播（去掉镜头提示词式标记，避免机器念出"特写镜头"）
 *  - dialogue 角色台词（角色名（情绪）：内容）→ 分角色音轨
 * 设计原则：只做文本结构化与时长估算；真实音频合成由后台配置的 TTS 基础设施完成（未配置时返回朗读文本，绝不伪造音频）。
 */

export type ListenKind = 'scene' | 'action' | 'dialogue';
export interface ListenSegment {
  idx: number;
  kind: ListenKind;
  /** dialogue 时为角色名，其余为“旁白” */
  speaker: string;
  /** 括号内的情绪/动作提示（dialogue 可能有） */
  cue?: string;
  /** 真正要朗读的纯文本（已剥离提示词噪声） */
  text: string;
  /** 该片段估算秒数（按朗读语速） */
  estSeconds: number;
}
/** v2.342 逐角色配音/台词清单：把台词段按角色聚合，供真人排通告与 AIGC TTS 配音排期 */
export interface SpeakerWorkload {
  /** 角色名（与 parseScriptLine 的 speaker 同口径，旁白不计入） */
  name: string;
  /** 台词句数 */
  lines: number;
  /** 台词字符数（含标点，纯文本口径） */
  chars: number;
  /** 该角色发声估算秒数（台词段 estSeconds 合计） */
  estSeconds: number;
  /** 占全集台词发声时长的百分比（0-100，整数） */
  share: number;
  /** 首次开口所在的朗读段号（前端点击定位） */
  firstIdx: number;
}

export interface ListenScript {
  segments: ListenSegment[];
  totalChars: number;
  /** 全场估算时长（秒，含句间停顿） */
  estSeconds: number;
  dialogueCount: number;
  sceneCount: number;
  speakerSet: string[];
  /** v2.342 逐角色台词量与发声时长（按 estSeconds 降序；无台词时为空数组） */
  speakerSheet: SpeakerWorkload[];
  /** v2.342 全集台词发声估算秒数（＝speakerSheet 合计，不含旁白） */
  dialogueSeconds: number;
  /** 拼接好的纯朗读稿（旁白/角色前缀，供直接 TTS 或用户试听） */
  narration: string;
}

// 场标：内景/外景/场N｜，以及 AIGC 本常见「第X场」
const SCENE_RE = /^(?:第?\s*[0-9一二三四五六七八九十百]+\s*场[·\s:：｜|-]?\s*)?(内景|外景|室内|室外|INT\.?|EXT\.?)[\s.·:：-]+(.+?)\s*$/i;
// 台词：角色名（可含情绪/动作提示）+ ：/:。
// c207：英文剧本标准对白 slug 是"名+姓"且常带称谓（LI WEI / MR. SMITH），旧正则不允许空格导致整句误判动作；
// 全名支要求每个词首字母大写（2-3 词），"She said:/He thought:" 这类含小写动词的叙述句被形态挡住。
const DIALOGUE_RE = /^((?:[A-Z][A-Za-z]*\.?(?:\s+[A-Z][A-Za-z]*\.?){1,2})|[\u4e00-\u9fa5A-Za-z·\.]{1,12}?)\s*(?:[（(]([^）)]{0,24})[）)])?\s*[：:]\s*(.+?)\s*$/;
// 镜头/技术提示行（AIGC 本），朗读时剔除，不念给观众听
const TECH_RE = /^(镜头|景别|运镜|光影|音效|配乐|BGM|画面|时长|分镜|声效)[：:]/;
// c205：场记台账行（拍摄元数据，不是画面动作也不是任何角色的台词）。
// 旧口径下"时间：夜""LOCATION: ..."会被台词正则误判成角色"时间/LOCATION"的对白——
// TTS 把台账念出声、speakerSet 混入假角色、版本摘要"台词N句"虚高。一律归 other（不朗读）。
// 词表只收纯元数据名词："时光/小时/安静"等可用作真人角色名的词严禁入表（见 c205 不误杀用例）。
const META_SLATE_RE = /^(?:时间|地点|日期|场次|场景|人物|出场|角色|道具|服装|备注|注释|提要|片头|片尾|字幕|转场|TIME|LOCATION|PLACE|DATE|CAST|CHARACTERS?|PROPS?|WARDROBE|COSTUME|NOTES?)\s*[:：]/i;
// 集标题行
const EP_TITLE_RE = /^第\s*[0-9一二三四五六七八九十百]+\s*集/;
// 角色名白名单外的常见前缀动作符号
const ACTION_PREFIX_RE = /^[△▲◆◇※*•\-—\s]+/;

/**
 * c204：剧本行分类（听剧本/版本变更摘要共用同一套口径，禁止各引擎复制正则各判各的）。
 *  - scene    集标题、内景/外景/INT./EXT. 场标；
 *  - dialogue 角色名（可带情绪提示）+ 冒号 + 台词，名位含句读的叙述句不算台词；
 *  - action   △ 动作行与普通叙述行；
 *  - other    空行、镜头/配乐等技术提示行、场记台账行（时间/地点/人物等，不朗读）。
 */
export type ScriptLineKind = 'scene' | 'action' | 'dialogue' | 'other';
export interface ScriptLineInfo {
  kind: ScriptLineKind;
  /** dialogue 时为角色名 */
  speaker?: string;
  /** dialogue 括号内情绪/动作提示 */
  cue?: string;
  /** dialogue 纯台词内容（不含角色名前缀） */
  content?: string;
}

export function parseScriptLine(rawLine: unknown): ScriptLineInfo {
  const line = String(rawLine ?? '').trim();
  if (!line) return { kind: 'other' };
  if (TECH_RE.test(line)) return { kind: 'other' };
  if (META_SLATE_RE.test(line)) return { kind: 'other' };
  if (EP_TITLE_RE.test(line)) return { kind: 'scene' };
  if (SCENE_RE.test(line)) return { kind: 'scene' };
  const dM = line.match(DIALOGUE_RE);
  if (dM && dM[3].length >= 1) {
    const name = dM[1].trim();
    // c207：中文与单词英文名位不得含句读（防"你好，我说：…"叙述句）；
    // 英文"名 姓"全名支允许缩写点（MR. SMITH / DR. LI），但逗号/分号/叹号等仍是叙述信号
    const punctOk = /[\u4e00-\u9fa5]/.test(name)
      ? !/[。！？，、；,.!?]/.test(name)
      : !/[,，;；!？]/.test(name);
    if (punctOk) return { kind: 'dialogue', speaker: name, cue: dM[2]?.trim() || undefined, content: dM[3] };
  }
  return { kind: 'action' };
}

/** 只取行类型（场景/动作/台词/其他） */
export function classifyScriptLine(rawLine: unknown): ScriptLineKind {
  return parseScriptLine(rawLine).kind;
}

function countReadable(text: string): { cjk: number; latinWords: number } {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (text.match(/[A-Za-z']+/g) || []).length;
  return { cjk, latinWords };
}

/** 朗读时长估算：中文约 4.3 字/秒（含自然停顿），英文约 2.6 词/秒；句间停顿 0.35s */
export function estimateSpeechSeconds(text: string): number {
  const { cjk, latinWords } = countReadable(text);
  const raw = cjk / 4.3 + latinWords / 2.6;
  const pauses = (text.match(/[。！？!?…]/g) || []).length * 0.35 + (text.match(/[，、；,;]/g) || []).length * 0.15;
  return Math.round((raw + pauses) * 10) / 10;
}

// c208：LLM 成稿/改写稿偶发残留 Markdown 排版。这些符号不是创作内容也不是表演信息
// （与 c207 舞台括号的区分：舞台括号只剥非台词；markdown 对所有行类型统一净化），
// TTS 会逐字念"星号/井号/减号"。配对标记只删符号保文字，避免误删合法内容：
// 年份连字符 2019-2021、破折号——、省略号……、比分 3:1 均不匹配下列规则（见不误伤用例）。
const MD_HEADING_RE = /^\s{0,3}#{1,6}[ \t]+/;          // 行首 ATX 标题号
const MD_QUOTE_RE = /^\s*>+\s?/;                       // 行首引用符
const MD_HR_RE = /^\s*[-*_=]{3,}\s*$/;                 // 整行水平分隔线（含 =====）
const MD_BOLD_RE = /\*\*([^*\n]{1,80}?)\*\*/g;
const MD_UNDERLINE_BOLD_RE = /__([^_\n]{1,80}?)__/g;
const MD_STRIKE_RE = /~~([^~\n]{1,80}?)~~/g;
const MD_CODE_RE = /`+([^`\n]{1,80}?)`+/g;

/** 剥离不适合朗读的技术标记与舞台符号 */
function cleanForSpeech(line: string): string {
  let out = line
    .replace(/【[^】]{0,20}(镜头|景别|运镜|参数|提示词)[^】]{0,20}】/g, '')
    .replace(/\[(特写|近景|中景|远景|全景|俯拍|仰拍|推镜|拉镜|跟拍|摇镜|景深|慢镜头)[^\]]{0,16}\]/g, '')
    .replace(MD_HEADING_RE, '')
    .replace(MD_QUOTE_RE, '');
  if (MD_HR_RE.test(out)) return ''; // 纯分隔线：清空后由 push 的空段保护丢弃，不成段
  out = out
    .replace(MD_BOLD_RE, '$1')
    .replace(MD_UNDERLINE_BOLD_RE, '$1')
    .replace(MD_STRIKE_RE, '$1')
    .replace(MD_CODE_RE, '$1')
    .replace(ACTION_PREFIX_RE, '')
    // 配对处理后仍残留的孤立星号/反引号必是排版残渣（剧本正文没有合法裸星号用法）
    .replace(/[*`]/g, '')
    // c208：重复叹/问号让 TTS 机械拖音，归一为单个；省略号……与连续逗号不在此列
    .replace(/！{2,}/g, '！').replace(/？{2,}/g, '？')
    .replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return out;
}

// c207：舞台技术括号（音效/配乐/画外音标记）只对场标与动作叙述剥离，绝不动台词正文。
// 封闭词表 + 提示词后必须紧接冒号/空白/书名号等连接符或空括号（V.O./OS 标记），
// 所以"（音效师走过来）""（配乐老师点头）"这类合法动作描写不会误杀——与 c205 台账词表同原则：宁放勿错杀。
const STAGE_CUE_PAREN_RE =
  /[（(]\s*(?:BGM|背景音乐|配乐|音效|声效|画外音|OS|O\.S\.|V\.O\.|V\/O|SFX)(?:(?:[:：\s《【"'])[^）)]{0,30})?\s*[）)]/gi;
// c207：英文场标 INT./EXT. 直接朗读会念成裸字母"int/ext"，口播为 Interior/Exterior
const INT_SLATE_RE = /\bINT\./gi;
const EXT_SLATE_RE = /\bEXT\./gi;

/** 剥舞台技术括号 + 收干净残留的连续逗号/空白（仅用于非台词朗读文本） */
function cleanStageCues(line: string): string {
  return line
    .replace(STAGE_CUE_PAREN_RE, '')
    .replace(/[，,](\s*[，,])+/g, (m) => m[0])
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function buildListenScript(raw: string, opts: { lang?: 'zh' | 'en' } = {}): ListenScript {
  const lang = opts.lang === 'en' ? 'en' : (/[\u4e00-\u9fff]/.test(raw) ? 'zh' : 'en');
  const narrator = lang === 'en' ? 'Narrator' : '旁白';
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const segments: ListenSegment[] = [];
  const speakers = new Set<string>();
  let sceneCount = 0; let dialogueCount = 0; let totalChars = 0; let idx = 0;

  const push = (kind: ListenKind, speaker: string, text: string, cue?: string) => {
    let clean = cleanForSpeech(text);
    if (kind === 'scene') clean = clean.replace(INT_SLATE_RE, 'Interior').replace(EXT_SLATE_RE, 'Exterior');
    // c207：舞台音效/配乐/画外音括号只从场标与动作叙述里剥；台词正文内的情绪/动作括号是表演信息，原样保留
    if (kind !== 'dialogue') clean = cleanStageCues(clean);
    if (!clean) return;
    segments.push({ idx: idx++, kind, speaker, cue: cue || undefined, text: clean, estSeconds: estimateSpeechSeconds(clean) });
    totalChars += clean.length;
    if (kind === 'dialogue') { dialogueCount += 1; speakers.add(speaker); }
    if (kind === 'scene') sceneCount += 1;
  };

  for (const line of lines) {
    // c204：分类口径统一走 parseScriptLine（听剧本/变更摘要同一出处），本函数只负责朗读化
    const info = parseScriptLine(line);
    if (info.kind === 'other') continue;            // 技术提示不朗读
    if (info.kind === 'scene') { push('scene', narrator, line); continue; }
    if (info.kind === 'dialogue') {
      push('dialogue', info.speaker!, info.content!, info.cue);
    } else {
      push('action', narrator, line);
    }
  }

  const estSeconds = Math.round(segments.reduce((acc, s) => acc + s.estSeconds, 0) * 10) / 10;
  // v2.342 逐角色清单：直接聚合台词段（单一事实源），旁白/场标不参与
  const sheetMap = new Map<string, { name: string; lines: number; chars: number; estSeconds: number; firstIdx: number }>();
  for (const s of segments) {
    if (s.kind !== 'dialogue') continue;
    let e = sheetMap.get(s.speaker);
    if (!e) { e = { name: s.speaker, lines: 0, chars: 0, estSeconds: 0, firstIdx: s.idx }; sheetMap.set(s.speaker, e); }
    e.lines += 1;
    e.chars += s.text.length;
    e.estSeconds += s.estSeconds;
  }
  const dialogueSeconds = Math.round([...sheetMap.values()].reduce((acc, e) => acc + e.estSeconds, 0) * 10) / 10;
  const speakerSheet: SpeakerWorkload[] = [...sheetMap.values()]
    .map((e) => ({
      name: e.name,
      lines: e.lines,
      chars: e.chars,
      estSeconds: Math.round(e.estSeconds * 10) / 10,
      share: dialogueSeconds > 0 ? Math.round((e.estSeconds / dialogueSeconds) * 100) : 0,
      firstIdx: e.firstIdx,
    }))
    .sort((a, b) => b.estSeconds - a.estSeconds || b.lines - a.lines || a.name.localeCompare(b.name));
  const narration = segments
    .map((s) => (s.kind === 'dialogue' ? `${s.speaker}${s.cue ? `（${s.cue}）` : ''}：${s.text}` : s.text))
    .join('\n');
  return {
    segments, totalChars, estSeconds,
    dialogueCount, sceneCount,
    speakerSet: [...speakers],
    speakerSheet, dialogueSeconds,
    narration,
  };
}

/** 单集朗读额度：高级/专业会员权益内，不另扣积分；返回权益说明（前端展示用，双语） */
export function listenEntitleNote(lang: 'zh' | 'en'): { title: string; lines: string[] } {
  return lang === 'en'
    ? { title: 'Listen mode (Advanced+)', lines: [
      'Narration script is generated locally with no extra points.',
      'Audio playback uses the configured TTS service; without a TTS key you still get the reading script.',
    ] }
    : { title: '听剧本（高级会员及以上）', lines: [
      '朗读脚本由本地确定性引擎生成，不额外消耗积分。',
      '真人语音播放走后台配置的 TTS 服务；未配置时仍可查看/复制分段朗读稿。',
    ] };
}
