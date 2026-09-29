import { isSceneHeaderLine } from './script-scenes';
/**
 * v2.80 对白直呼名检测（Dialogue Name-Call / Vocative Overuse）
 * ------------------------------------------------------------------
 * 创作能力类引擎：AI 剧本通病——一对一对白句句叫对方名字
 * （"林棠，你听我说""沈知远，我知道"），真人面对已知交谈对象极少直呼其名。
 *
 * 规则（按场景在场人数分级，纯确定性）：
 *  - 两人戏：称呼对方名字的台词占比 >25% 即判过密（情绪爆发点偶有叫名是正常的，故限比例）；
 *  - 三人及以上：叫名用于锁定具体对象，>50% 才判过密；
 *  - 只检测台词里出现的**别人**名字（不含说话人自己）。
 *
 * 查重：voice-print / dialogue-water / dialogue-ai-taste 均不涉及称呼密度，无重叠。
 *
 * 零 LLM、零 IO；中英双语；zh 名字用 includes（2-4字角色名），en 用 \b 词界；en 层零中文。
 */

export interface NameCallHit {
  sceneHeader: string;
  speaker: string;
  line: string;
  called: string;
}

export interface NameCallScene {
  sceneHeader: string;
  speakerCount: number;
  lineCount: number;
  callCount: number;
  ratio: number;
  threshold: number;
  overused: boolean;
}

export interface DialogueNameCallResult {
  score: number;
  hits: NameCallHit[];
  scenes: NameCallScene[];
  callCount: number;
  totalDialogueLines: number;
  issues: string[];
  advice: string;
}

const isZhText = (t: string): boolean => /[\u4e00-\u9fff]/.test(t);


interface DLine { speaker: string; speech: string }

function parseScene(header: string, body: string): DLine[] {
  const lines: DLine[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^\s：:]{1,12})\s*[：:]\s*(.+)$/);
    if (m) {
      const speech = m[2].trim();
      if (speech) lines.push({ speaker: m[1].trim(), speech });
    }
  }
  return lines;
}

function splitScenes(draft: string, isZh: boolean): { header: string; lines: DLine[] }[] {
  const scenes: { header: string; lines: DLine[] }[] = [];
  let curHeader = isZh ? '(开场)' : '(opening)';
  let curBody: string[] = [];
  for (const raw of draft.split(/\r?\n/)) {
    const line = raw.trim();
    if (isSceneHeaderLine(line)) {
      if (curBody.length) scenes.push({ header: curHeader, lines: parseScene(curHeader, curBody.join('\n')) });
      curHeader = line;
      curBody = [];
    } else {
      curBody.push(raw);
    }
  }
  if (curBody.length) scenes.push({ header: curHeader, lines: parseScene(curHeader, curBody.join('\n')) });
  return scenes;
}

function nameInSpeech(speech: string, name: string, isZh: boolean): boolean {
  if (isZh) return speech.includes(name);
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(speech);
}

export function dialogueNameCall(draft: string, castNames: string[] = []): DialogueNameCallResult {
  if (!draft || !draft.trim()) {
    return { score: 100, hits: [], scenes: [], callCount: 0, totalDialogueLines: 0, issues: [], advice: '' };
  }
  const isZh = isZhText(draft);
  const scenes = splitScenes(draft, isZh);

  // 名字池：外部 cast 名 + 各场说话人；过滤过短名字（中文≥2字，英文按词）
  const speakerSet = new Set<string>();
  let totalLines = 0;
  for (const sc of scenes) for (const dl of sc.lines) { speakerSet.add(dl.speaker); totalLines++; }
  const namePool = [...new Set([...castNames, ...speakerSet])]
    .filter((n) => n && n.trim().length >= 2 && !isSceneHeaderLine(n));

  const hits: NameCallHit[] = [];
  const sceneReports: NameCallScene[] = [];

  for (const sc of scenes) {
    const speakers = new Set(sc.lines.map((l) => l.speaker));
    let callCount = 0;
    for (const dl of sc.lines) {
      for (const name of namePool) {
        if (name === dl.speaker) continue;
        if (speakers.size > 1 && !speakers.has(name)) continue; // 只统计在场角色间的称呼
        if (nameInSpeech(dl.speech, name, isZh)) {
          callCount++;
          hits.push({ sceneHeader: sc.header, speaker: dl.speaker, line: dl.speech, called: name });
          break; // 同一句只记一次
        }
      }
    }
    const lineCount = sc.lines.length;
    const ratio = lineCount ? callCount / lineCount : 0;
    const threshold = speakers.size <= 2 ? 0.25 : 0.5;
    const overused = lineCount >= 4 && ratio > threshold;
    sceneReports.push({ sceneHeader: sc.header, speakerCount: speakers.size, lineCount, callCount, ratio: Math.round(ratio * 100) / 100, threshold, overused });
  }

  const overScenes = sceneReports.filter((s) => s.overused);
  const score = Math.max(0, 100 - overScenes.length * 25 - Math.max(0, hits.length - 2) * 2);

  const issues = overScenes.map((s) =>
    isZh
      ? `场景「${s.sceneHeader}」仅${s.speakerCount}人，却有${s.callCount}/${s.lineCount}句直呼对方名字（${Math.round(s.ratio * 100)}%）——对已知对象句句叫名是AI痕迹`
      : `Scene "${s.sceneHeader}" (${s.speakerCount} speakers) calls the other by name in ${s.callCount}/${s.lineCount} lines (${Math.round(s.ratio * 100)}%) — a classic AI tell in known-person dialogue`,
  );

  const advice = isZh
    ? overScenes.length > 0
      ? '删掉大部分句首称呼，两人对话默认知道在跟谁说；只在"开口引起注意、情绪爆发、话锋转向、多人中锁定对象"时保留名字，一场不超过1-2次。'
      : '称呼密度自然，保持。'
    : overScenes.length > 0
      ? 'Cut most address names: in a two-person talk both know who is speaking. Keep a name only to open contact, spike emotion, pivot topic, or single someone out in a group — at most 1-2 per scene.'
      : 'Address-name density is natural; keep it.';

  return { score, hits, scenes: sceneReports, callCount: hits.length, totalDialogueLines: totalLines, issues, advice };
}
