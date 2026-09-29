import { isSceneHeaderLine } from './script-scenes'; // c213：场头判定单一事实源
/**
 * 人物行为逻辑校验（PRD 2.1.3 人物工具人化治理）
 * 离线启发式扫描，抓四类硬伤：
 *  1) 悬空人物：人物卡声明的主要角色本集零出场 / 只被提及没有台词（背景板）
 *  2) 人设在台词上崩塌：声明的说话风格与实际台词矛盾（寡言者长篇大论、粗犷者满口书面词）
 *  3) 情绪无过渡跳变：同一角色相邻台词情绪正负极性硬切，缺动作/情绪缓冲
 *  4) 配角工具人：功能性龙套只有一句推进剧情的台词、没有任何独立反应
 * 全部只做可解释的诊断与修改建议，不替用户改稿。
 */

export interface CharProfile {
  voice?: string;       // 说话风格标签，如“少言/粗犷市井/文雅”
  arc?: string;
  hidden?: string[];
}
export type CastMap = Record<string, CharProfile>;

export interface LogicIssue {
  severity: 'high' | 'mid' | 'low';
  type: 'missing' | 'background' | 'voice_break' | 'emotion_jump' | 'tool_support';
  character: string;
  evidence: string;
  advice: string;
}

interface DLine { name: string; emotion: string; text: string }

const WRITTEN_WORDS = ['因此', '然而', '不仅', '而且', '综上所述', '换言之', '与此同时', '之所以', '由于', '显然'];
const TOOL_NAMES = ['路人', '服务员', '前台', '保安', '护士', '店员', '司机', '保洁', '助理', '秘书', '邻居'];
const POS = /笑|喜|开心|温柔|轻松|得意|释然|娇|甜|暖/;
const NEG = /怒|哭|吼|冷|恨|颤|怕|急|厉|酸|哽咽|咬|瞪/;

export function parseDialogue(text: string): DLine[] {
  const out: DLine[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^([一-龥A-Za-z·]{1,6})(?:（([^）]*)）)?[：:](.+)$/);
    if (m && !line.startsWith('△') && !isSceneHeaderLine(line)) {
      out.push({ name: m[1], emotion: m[2] || '', text: m[3].trim() });
    }
  }
  return out;
}

function polarity(emotion: string, text: string): 1 | -1 | 0 {
  const s = emotion + text;
  const p = POS.test(s), n = NEG.test(s);
  if (p && !n) return 1;
  if (n && !p) return -1;
  return 0;
}

export function characterLogicScan(cast: CastMap, text: string): { issues: LogicIssue[]; score: number } {
  const issues: LogicIssue[] = [];
  const dialogues = parseDialogue(text);
  const byName = new Map<string, DLine[]>();
  dialogues.forEach((d) => {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name)!.push(d);
  });

  // 1) 悬空 / 背景板主要人物
  for (const name of Object.keys(cast || {})) {
    const lines = byName.get(name);
    const mentioned = text.includes(name);
    if (!lines || lines.length === 0) {
      issues.push({
        severity: mentioned ? 'mid' : 'high',
        type: mentioned ? 'background' : 'missing',
        character: name,
        evidence: mentioned ? `人物「${name}」仅在动作/叙述中被提及，没有一句台词` : `人物卡有「${name}」，但本集完全未出场`,
        advice: mentioned ? `给「${name}」至少一次带个人立场的反应，避免沦为背景板` : `要么让「${name}」出场，要么从本集人物表移除，避免人设悬空`,
      });
    }
  }

  // 2) 人设在台词上崩塌
  for (const [name, profile] of Object.entries(cast || {})) {
    const lines = byName.get(name) || [];
    const voice = profile.voice || '';
    for (const d of lines) {
      if (/寡言|少言|沉默|话少/.test(voice) && d.text.replace(/[，。、…]/g, '').length > 30) {
        issues.push({ severity: 'mid', type: 'voice_break', character: name, evidence: `「${name}」设定少言，却说了长句：“${d.text.slice(0, 18)}…”`, advice: '压缩成短句或用动作代替，符合寡言人设' });
      }
      if (/粗犷|市井|大老粗|口语|接地气/.test(voice) && WRITTEN_WORDS.some((w) => d.text.includes(w))) {
        issues.push({ severity: 'mid', type: 'voice_break', character: name, evidence: `「${name}」设定粗犷口语，却用了书面词：${d.text}`, advice: '换成大白话，去掉连接词和书面腔' });
      }
    }
    // 3) 情绪无过渡跳变
    let prev = 0;
    for (const d of lines) {
      const cur = polarity(d.emotion, d.text);
      if (prev !== 0 && cur !== 0 && prev + cur === 0) {
        issues.push({ severity: 'low', type: 'emotion_jump', character: name, evidence: `「${name}」相邻台词情绪正负极硬切，缺少过渡`, advice: '中间补一个动作/停顿/心理缓冲，让情绪转折可信' });
      }
      if (cur !== 0) prev = cur;
    }
  }

  // 4) 配角工具人
  for (const [name, lines] of byName.entries()) {
    const isTool = TOOL_NAMES.includes(name) || TOOL_NAMES.some((t) => name.includes(t));
    if (isTool && lines.length === 1) {
      const hasOwnAction = new RegExp(`△[^\\n]*${name}[^\\n]*[。…]`).test(text);
      if (!hasOwnAction) {
        issues.push({ severity: 'low', type: 'tool_support', character: name, evidence: `「${name}」只说了一句推进剧情的话，无独立反应`, advice: '给配角一个符合其身份的小动作/态度，配角也应是活人，不是传声筒' });
      }
    }
  }

  const deduct = issues.reduce((s, i) => s + (i.severity === 'high' ? 18 : i.severity === 'mid' ? 9 : 4), 0);
  return { issues, score: Math.max(0, 100 - deduct) };
}
