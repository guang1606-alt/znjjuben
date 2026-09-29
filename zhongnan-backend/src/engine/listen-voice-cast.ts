/**
 * c206 「听剧本」多角色声线分配（确定性、零模型、零积分）。
 * 浏览器原生 speechSynthesis 没有"角色"概念，只能用 pitch（音高）/rate（语速）区分说话者；
 * 本引擎把 buildListenScript.speakerSet（已按首次发言顺序排列）映射到一张固定声线网格：
 *  - 旁白固定独立声线（略慢、中音），不与任何角色槽重合；
 *  - 角色按出场顺序占槽，新增角色只追加在尾部——老角色声线绝不因新角色加入而重排
 *    （听众对"林晚的声音"建立的预期一旦形成就不能变）；
 *  - 超出网格长度（配角多于 10 个）显式循环复用 0 号槽，是确定性契约而非哈希碰撞；
 *  - 所有参数卡在 speechSynthesis 安全可懂区间（pitch 0.5–1.5、rate 0.8–1.2），
 *    语速差异只做 ±3% 的微调层，主要靠音高区分，避免"怪声"伤害可懂度。
 * 选声语言提示用 BCP-47（zh-CN / en-US），前端据此在 getVoices() 里挑同语言语音。
 */

export interface VoiceProfile {
  /** 音高 0–2（常用安全区 0.5–1.5） */
  pitch: number;
  /** 语速倍率（1=正常；可懂区 0.8–1.2） */
  rate: number;
}

/** 5 个音高层 × 2 个语速微调层 = 10 个可区分角色槽 */
const PITCH_STEPS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;
const RATE_LAYERS = [1.0, 1.03] as const;

export const VOICE_PROFILE_GRID: VoiceProfile[] = RATE_LAYERS.flatMap((rate) =>
  PITCH_STEPS.map((pitch) => ({ pitch, rate })),
);

/** 旁白独立声线：略慢、中音，刻意不同于 0 号角色槽 */
export const NARRATOR_PROFILE: VoiceProfile = { pitch: 0.9, rate: 0.95 };

export interface VoiceCast {
  lang: 'zh' | 'en';
  /** 前端选 SpeechSynthesisVoice 用的 BCP-47 提示 */
  voiceLang: string;
  narrator: VoiceProfile;
  /** 角色名 → 声线（键为 trim 后的原名） */
  characters: Record<string, VoiceProfile>;
}

/**
 * @param speakers buildListenScript.speakerSet（首次发言顺序）；容忍任意脏输入
 */
export function buildVoiceCast(speakers: unknown, opts: { lang?: 'zh' | 'en' } = {}): VoiceCast {
  const lang: 'zh' | 'en' = opts.lang === 'en' ? 'en' : 'zh';
  const characters: Record<string, VoiceProfile> = {};
  const list = Array.isArray(speakers) ? speakers : [];
  let slot = 0;
  for (const raw of list) {
    if (raw === null || raw === undefined) continue;
    const name = String(raw).trim();
    if (!name || Object.prototype.hasOwnProperty.call(characters, name)) continue; // 空串剔除、重复保首次出场
    characters[name] = VOICE_PROFILE_GRID[slot % VOICE_PROFILE_GRID.length];
    slot += 1;
  }
  return {
    lang,
    voiceLang: lang === 'en' ? 'en-US' : 'zh-CN',
    narrator: NARRATOR_PROFILE,
    characters,
  };
}
