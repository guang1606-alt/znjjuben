import { isSceneHeaderLine } from './script-scenes';
/**
 * 空转誓言检测（v2.80 块81，创作能力类）
 * ------------------------------------------------------------------
 * 病象：冲突或受害之后，角色独处、对盟友、对遗像念一段预告片台词——
 *   林晚（望着窗外）：我要让他付出代价。
 *   沈知远（对遗像）：此仇不报，誓不为人。
 *   林晚：我失去的，会亲手一件件拿回来。
 *   LINA (staring out the window): I will make him pay.
 *   VICTOR (at the grave): Revenge will be mine.
 * 第一次是集尾情绪锤，病在它被当成万能收尾：
 *  1) 只宣告情绪，不宣告打法——观众早知道她恨他，台词零新信息，
 *     没有时间、没有筹码、没有第一步动作；
 *  2) 无法证伪、无法失败——"付出代价""拿回一切"什么都算，后面
 *     随便演都不违约，戏剧悬念被一句话掏空；
 *  3) 替身脸宣言——反派每坏一次，主角必念一段，人物不长脑子只长
 *     恨意，戏靠口号续气。
 *
 * 与既有引擎的分工（查重后确认的空白点）：
 *  - empty-threat：管冲突现场第二人称当面放话（"你给我等着/
 *    you will regret this/mark my words"），是对敌人的攻击动作；
 *    本引擎只收第一/第三人称誓言（让他/him/them/对遗像/对盟友），
 *    词表严格排除"你/you"句式；
 *  - villain-confession：管反派当着敌人的面自爆阴谋细节，本引擎管
 *    主角方空喊复仇，恰恰相反的病（一个说太多计划，一个没有计划）；
 *  - moral-narration：管叙述行直接下结论，本引擎只管 cue 台词。
 *
 * 判定：
 *  - VOW 词表命中 cue speech 句（我要让他付出代价/此仇不报/拿回属于
 *    我的一切/血债血偿/I will make him pay/revenge will be mine/
 *    I will not rest until…）；
 *  - rescue（±2 行同场任意文本出现具体打法锚点）：律师/证据/录音/
 *    董事会/股份/亲子鉴定/合同/发布会/法院/冻结账户/明天/lawyer/
 *    evidence/recording/board meeting/shares/DNA test/contract/
 *    press conference/court/freeze/tomorrow…——誓言落到了具体的刀、
 *    时间或战场，是战书不是口号；
 *  - 单次不判（集尾一次合法情绪锤），未兑现 ≥2 起判。
 * 计分：n=2 → 70；每多 1 句 −20，封底 20。
 *
 * 零 LLM、零 IO；中英双语；en 层零中文。
 */

export interface EmptyVowHit {
  line: number;
  sceneIndex: number;
  sceneHeader: string;
  speaker: string;
  snippet: string;
  marker: string;
  /** 是否被救援（誓言带具体打法/筹码/期限） */
  rescued: boolean;
  reason: string;
}

export interface EmptyVowResult {
  score: number;
  hitCount: number;
  /** 计入计分的命中（未救援） */
  unrescuedCount: number;
  hits: EmptyVowHit[];
  issues: string[];
  advice: string[];
}

const isZhText = (t: string): boolean => /[一-鿿]/.test(t);


const CUE_ZH = /^([一-鿿A-Za-z0-9·]{1,8})(?:（[^）]{0,40}）)?\s*[：:]\s*(.+)$/;
const CUE_EN = /^([A-Z][A-Z0-9 .'-]{0,30}[A-Z0-9.])(?:\s*\((?:V\.?O\.?|O\.?S\.?|CONT(?:'?D)?|OFFSCREEN|FILTERED|ON THE PHONE|[^()]{0,40})\))?\s*:\s*(.+)$/;

/* 空转誓言（严格只收第一/第三人称；第二人称当面威胁归 empty-threat） */
const VOW_ZH = [
  /我要让(?:他|她|他们|她们|那[个家群]|沈|顾|林|苏|陆|傅|霍)[^\n。！？]{0,12}(?:付出代价|身败名裂|后?悔|跪(?:下|在)|求我|爬着|好看|一无所有|粉身碎骨)/,
  /让(?:他|她|他们|她们)[^\n。！？]{0,10}(?:付出代价|身败名裂|后?悔(?:来到|活在)|跪(?:下|在)|一无所有|爬着)/,
  /我发誓[^\n。！？]{0,20}(?:一定|迟早|这辈子|要让|绝不会?让|这[笔口]段?仇|报?仇|讨回|拿回|付出代价|身败名裂)/,
  /此仇不报(?:誓不为人|非君子|枉为人|誓不甘休)?/,
  /血债(?:必须)?血偿/,
  /不共戴天/,
  /我要(?:亲手)?(?:报仇|复仇|讨回(?:公道|一切|属于我的)|拿回(?:属于)?(?:我|老娘|我们)的一切)/,
  /(?:欠我的|他欠我|她欠我|这笔账|这一?笔账|这笔血债)[^\n。！？]{0,10}(?:还|偿|加倍|奉还|清算|连本带利)/,
  /总有一天[，,]?\s*(?:我会|我要|让他|让她|让他们)/,
  /我不会放过(?:他|她|他们|她们)/,
  /我(?:所|曾)?失去的[^\n。！？]{0,12}(?:亲手)?(?:一)?(?:件件?|样样?)?(?:拿|夺|讨)回来?/,
  /(?:被(?:他|她|他们)?夺走|被抢走)的[^\n。！？]{0,8}(?:亲手)?(?:拿|夺|讨)回来?/,
  /从今天(?:起|开始)[^\n。！？]{0,16}(?:讨回|拿回|复仇|报仇|让他|让她|不再认输)/,
];

const VOW_EN = [
  /\bi(?:'ll| will| am going to) make (?:him|her|them)\b[^.!?]{0,20}pay\b/i,
  /\b(?:he|she|they) (?:is|are )?gonna pay\b|\bthey will pay\b/i,
  /\bi swear\b[^.!?]{0,44}\b(?:destroy|ruin|take down|bring down|pay|revenge|take back|regret|burn|never forget|exact)\b/i,
  /\bi(?:'ll| will| shall) have my revenge\b|\brevenge will be mine\b|\bi will (?:get|exact) my revenge\b/i,
  /\bi(?:'ll| will| am going to) (?:destroy|ruin|take down|bring down) (?:him|her|them)\b/i,
  /\btake back everything (?:that is |that'?s )?mine\b/i,
  /\bi will not rest until\b/i,
  /\b(?:he|she|they) will regret (?:this|the day|ever)\b/i,
  /\bthis time,? i(?:'ll| will) (?:take|get|make|win|burn|destroy|ruin)\b/i,
  /\b(?:everything|all) (?:he|she|they) (?:took|stole) from me\b/i,
  /\bpay for what (?:he|she|they) did\b/i,
];

/* 救援：誓言落到具体的刀（证据/筹码）、战场（机构/场合）或死线（时间） */
const PLAN_ZH = /(?:律师|证据|录音|录像|U盘|优盘|监控|董事会|股东大会|股份|股权|转让协议|亲子鉴定|遗嘱|合同|协议|记者会|发布会|找媒体|法院|法官|起诉|撤诉|报警|立案|账户|冻结|过户|抵押|查封|公章|招标|竞标|供应商|客户名单|税务|举报|明天|明早|今晚|今天|周五|周一|周三|下周|[一二两三四五六七八九十]+点|签字|盖章|担保|贷款|项目)/;
const PLAN_EN = /\b(?:lawyer|attorney|evidence|proof|recording|the tape|footage|USB|CCTV|surveillance|board meeting|shareholder meeting|shares|equity stake|DNA test|the will|contract|agreement|press conference|reporters?|media|court|judge|sue|lawsuit|press charges|police|freez\w*|bank account|transfer(?:red)?|sign(?:ed|ing)?|seal(?:ed)?|bid|supplier|client list|IRS|report (?:him|her|them)|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|at (?:three|nine|ten|noon)|by noon|next week)\b/i;

interface SceneBlock {
  index: number;
  header: string;
  /** 正文第一行在全文的 0 基行号 */
  bodyStart: number;
  lines: string[];
}

/**
 * 纯函数：检测无打法、无期限、无法证伪的复仇/逆袭空转誓言。
 */
export function emptyVow(draft: string): EmptyVowResult {
  const text = draft ?? '';
  if (!text.trim()) {
    return { score: 100, hitCount: 0, unrescuedCount: 0, hits: [], issues: [], advice: [] };
  }
  const zh = isZhText(text);
  const rawLines = text.split(/\r?\n/);

  const scenes: SceneBlock[] = [];
  let cur: SceneBlock = { index: 0, header: '', bodyStart: 0, lines: [] };
  rawLines.forEach((raw, idx) => {
    if (isSceneHeaderLine(raw.trim())) {
      if (cur.lines.length > 0 || cur.header) scenes.push(cur);
      cur = { index: scenes.length, header: raw.trim(), bodyStart: idx + 1, lines: [] };
    } else {
      cur.lines.push(raw);
    }
  });
  scenes.push(cur);

  const vowRes = zh ? VOW_ZH : VOW_EN;
  const planRe = zh ? PLAN_ZH : PLAN_EN;
  const cueRe = zh ? CUE_ZH : CUE_EN;

  const hits: EmptyVowHit[] = [];
  let hitCount = 0;

  for (const scene of scenes) {
    scene.lines.forEach((raw, localIdx) => {
      const line = raw.trim();
      if (!line) return;
      const cue = cueRe.exec(line);
      if (!cue) return;
      const speaker = cue[1] ?? '';
      const speech = cue[2] ?? '';
      if (!speech) return;

      /* 誓言可能跨逗号分句（"我失去的，会亲手一件件拿回来"），按整条 cue 匹配，每条 cue 计一次 */
      const re = vowRes.find((r) => r.test(speech));
      if (re) {
        const matched = speech.match(re);
        hitCount += 1;

        /* ±2 行同场任意文本：盟友接招、自己补计划、叙述行落实都算 */
        const lo = Math.max(0, localIdx - 2);
        const hi = Math.min(scene.lines.length - 1, localIdx + 2);
        const windowText = scene.lines.slice(lo, hi + 1).join('\n');
        const rescued = planRe.test(windowText);

        /* snippet 取命中断句；跨句时回退到 cue 前 30/60 字 */
        const sentenceList = zh
          ? speech.split(/[。！？!?…，,；;]+/).map((s) => s.trim()).filter(Boolean)
          : speech.split(/[.!?…,;]+/).map((s) => s.trim()).filter(Boolean);
        const hitSentence = sentenceList.find((s) => re.test(s)) ?? speech;

        hits.push({
          line: scene.bodyStart + localIdx + 1,
          sceneIndex: scene.index,
          sceneHeader: scene.header,
          speaker,
          snippet: zh ? hitSentence.slice(0, 30) : hitSentence.slice(0, 60),
          marker: (matched?.[0] ?? '').slice(0, 28),
          rescued,
          reason: rescued
            ? (zh ? '誓言落在了具体的刀/战场/死线上，是战书' : 'the vow lands on a concrete weapon, arena, or deadline — a declaration of war')
            : (zh ? '只有恨意没有打法：无筹码、无期限、无第一步，无法证伪的预告片台词' : 'hatred without a plan: no leverage, no deadline, no first move — an unfalsifiable trailer line'),
        });
      }
    });
  }

  const unrescued = hits.filter((h) => !h.rescued);
  const n = unrescued.length;
  const score = n <= 1 ? 100 : Math.max(20, 70 - (n - 2) * 20);

  const issues: string[] = [];
  const advice: string[] = [];
  if (n >= 2) {
    issues.push(zh
      ? `${n} 句"我要让他付出代价/此仇不报/拿回属于我的一切"式空转誓言——只宣告恨意，没有筹码、期限和第一步动作，无法证伪也无法失败。`
      : `${n} vows ("I will make him pay", "revenge will be mine", "I will take back everything") announce hatred with no leverage, no deadline, and no first move — they cannot be tested or broken.`);
    advice.push(zh
      ? '删掉口号，把恨意换成打法：要么这句台词里就点出刀和死线（"明天董事会，我要让他当着所有股东的面签字"），要么干脆别让人物说——观众看见她约律师、调录音、把亲子鉴定塞进信封，比听见一百遍"付出代价"都狠。誓言全片最多留一次，放在她真的押上代价的那个节点；集尾要钩子，用动作和选择钩，不用口号钩。'
      : 'Cut the slogan and replace hatred with a plan: either name the weapon and the deadline inside the line ("Tomorrow at the board meeting, he signs in front of every shareholder"), or keep her silent — watching her call a lawyer, pull the recording, and seal the DNA report in an envelope hits harder than a hundred "he will pay". Allow one vow in the whole script, at the moment she actually stakes a cost; end episodes on an action or a choice, never on a slogan.');
  }

  return { score, hitCount, unrescuedCount: n, hits, issues, advice };
}
