# 终南集（zhongnan）剧本域 · 相悖与不一致审查报告 V1

- 审查范围：仅 zhongnan 剧本域内部互查（创作技能包文档 × 引擎/交易/合规代码 × 交付说明）。**不引用养正教育域任何规则或结论**。
- 审查方式：逐条只记录"可在文件:行复核"的事实；区分【文档要求】【代码现状】【推断】，凡推断一律标注"待裁定"。
- 取证时间基线：后端 `package.json` version = **2.79.0**；内置技能包 `craft-pack.json` appVersion = **2.78.0**（builtAt 2026-09-11）。
- 说明：本报告只做检查，**未改动任何代码**。

---

## A. 文档 / 命名内部自相矛盾

### A1.「五层钩子」名、数、实三处漂移（核心问题）

同一"钩子分层"概念在文档、常量、注释、测试里出现 **四层 / 五层 / 七个名称** 三种口径：

| 出处 | 表述 | 实际 |
|---|---|---|
| `references/02-hooks.md:1` | 标题"29 个装置 · **五层**体系" | — |
| `references/02-hooks.md:3` | "五层钩子=开篇/集尾/场/**动作/氛围/语言**/微钩" | 一口气列出 **7 个**名称 |
| `src/engine/creation-spec.ts:28` | 注释"五层钩子（场/集/动作/氛围/语言）" | 括号内仅 **5 个**，且不含"开篇""微" |
| `src/engine/creation-spec.ts:29-37` | `HOOK_TAXONOMY` 常量 | 数组实有 **7 个**元素（open/episode/scene/action/atmosphere/language/micro） |
| `src/engine/skill-pack.ts:83` | 注释"**四层**钩子（开篇/集尾/场间/微钩）" | 同一句后半又列"场/集/动作/氛围/语言体系"，一句内自相矛盾 |
| `src/engine/skill-pack.ts:311,320,343,346` | 生成的技能文案 | 一律写"**五层**钩子" |
| `src/engine/hook-system.ts:5` | 引擎设计注释 | 明确写 **4 层**（开场/集/场/微） |
| `src/engine/hook-system.ts:12` | `HookLayer` 类型 | 仅 `open | episode | scene | micro` **4 值** |

测试把上述矛盾当成"正确"同时锁死：
- `test/skill-pack.test.cjs:15` 用例描述写"钩子**四层**齐全"、`:17-18` 断言 layers 恰为 `episode/micro/open/scene` 4 组、`:19` 断言总数 29；
- 同文件 `:56` 又断言 02-hooks.md 必须含"**五层**体系"，`:62-64` 断言 SKILL 文案含"五层钩子"。

→ 结论：**"五层"是对外文档口径，"四组"是数据层事实，二者从未在任何一处被正式定义清楚如何对应**；测试反而让两边都不能改。

### A2. 文档为圆"五层"给出的归属关系，与代码相反

`references/02-hooks.md:3` 解释："底层按 open/episode/scene/micro 四组存放，其中**场钩进一步细分为动作钩、氛围钩、语言钩**"。

代码现状恰好相反：
- 动作/氛围/语言钩全部属于 **micro（微钩）层**：`hook-system.ts:53` `micro_action`、`:54` `micro_line`、`:55` `micro_atmos`，其 `layer` 字段均为 `'micro'`；
- 场钩 `SCENE_HOOKS`（`hook-system.ts:45-49`）只有 `scene_goal_block / scene_info_drop / scene_cut_question` 三个，**没有**动作/氛围/语言。

而且按文档自己的算术：4 组中把 scene 拆成动作/氛围/语言 3 类，得到的是 open/episode/动作/氛围/语言/micro = **6**，仍不等于"五"。

→ 该解释既不符合数据层，也推不出 5。属文档为迁就命名而写出的失实说明。

### A3. 微钩"八种质感"注释失修，实际 9 个、风味 6 类

- `src/engine/hook-system.ts:51` 注释："微钩…**八种质感**（动作/语言/氛围/情绪/信息差/伏笔/感官/反转）"；
- `MICRO_HOOKS`（`:52-62`）实有 **9 个**——注释所列 8 个之外多出 `micro_chain` 连环钩（`:61`）；
- 风味实际只归 **6 类** `HookFlavor`（`:69`：action/line/atmos/emotion/gap/foreshadow），感官/微反转/连环被并入其它风味（`:79-86`）。

→ 8 / 9 / 6 三个数字并存，属代码注释随迭代未同步。

### A4. 创作模式"第 N 种"序号与数组真实位次错位

`src/config/modes.ts` 的 `CREATION_MODES`（`:66-79`，共 12 项）：

| 数组真实位次(从1) | id | desc 自称 |
|---|---|---|
| 8 | `video_short` | "**第9种**"（`:74`） |
| 9 | `branded_skit` | "**第10种**"（`:75`） |
| 10 | `mature_x` | "**第11种**"（`:76`） |
| 11 | `long_ip` | 文件头 `:3` 称其为"新增**第12席**" |
| 12 | `film` | （真正的第 12 位，`:78`） |

- 对外"第 N 种"比真实位次统一 **+1**；`src/config/pricing.ts:99` 的 `X_SCRIPT` 注释"**第11模式**"与 mature_x desc 一致，但同样与数组位次（10）不符。
- 文件头 `:3`"第 12 席 long_ip"张冠李戴：第 12 席实际是 film。

→ 模式数量（12）本身正确，错的是人工序号与"第几席"表述。

---

## B. 技能包 / 文档 vs 引擎代码

### B1. 版本号三方不一致，且代码注释已超前多个版本

- `package.json:3` = **2.79.0**；
- `references/craft-pack.json:3` appVersion = **2.78.0**，`:5` builtAt 2026-09-11；
- 技能 `SKILL.md:5` version = **2.78.0**；
- 但代码注释已出现更高版本：`script-length.ts:122,202` 与 `aigc-screenplay.ts:274` 的 **v2.80**、`mode-craft.ts:44` 的 **v2.83 / v2.86 / v2.87**、`modes.ts:3,8` 的 **v2.86**。

→ 运行代码已是 2.79 并内含 v2.80~v2.87 特性，随包分发、给模型读的技能资产仍停在 2.78。

### B2."参考资产随版本同步"实为手动一次性脚本，且存在双 root 副本

`scripts/regen-skill-pack.cjs`：
- `:5` 版本号直接取 `package.json.version`；
- `:4` `require('../dist/engine/skill-pack.js')` —— 必须先 `npm run build` 才能生成；
- `:1` 自述"双 root 活副本"，`:11-14` 同时清空并写入 `.user_skills/zhongnan-shortdrama-craft` 与 `zhongnan-shortdrama-craft` 两个目录。

脚本无自动化触发钩子，需构建后人工执行；当前两副本停在 2.78、代码 2.79，即同步**没有发生**。一旦只改其一，双活副本还会互相漂移。

### B3. 标注"v2.86 上线"的电影剧本模式，在 2.79 已无开关即生效

- `modes.ts:3,8` 与 `mode-craft.ts:44` 均称电影剧本 **v2.86 上线**；
- 但 `CREATION_MODES` 中 `film`（`modes.ts:78`）`minLevel=PRO`、**未设** `status:'coming_soon'`；
- `modeAvailable`（`:88-92`）对其直接返回"可用"。

→ 相对 2.79 属"未来版本"的功能，在当前构建已对专业版开放，缺 feature flag / 版本门控。

### B4. SKILL 模式枚举沿用旧名，与 modes 规范 id / 拆分不一致

- `SKILL.md:3` 枚举仍写"X剧本 / 电影灰度"，而后端规范名为 `mature_x`（成年向分级剧本，`modes.ts:76`）、`film`（电影剧本创作，`:78`）；
- 旧模式 `scene / reverse` 已整合归一到 `hit_lab`（`modes.ts:15-27`），hit_lab 内部是一个模式、两条轨道（`signature_scene / hit_reverse`，`:38-45`）；SKILL 描述却把它对外讲成"名场面 / 爆款逆向"两个并列功能。

→ 数量都是 12（不矛盾），但对外名称、"一个模式两轨道"的结构与后端规范不一致，易在工具端按旧名传参（虽有 alias 兜底）。

### B0. 经核对"已对齐"的项（无冲突，列出以示公允）

- 21 套类型引擎 × 每套 10 装置 = 210：`craft-registry.ts` CRAFT_ENGINES 21 个、`references/01-devices.md` 恰 21 个引擎标题、`skill-pack.ts` DEVICE_SOURCE 21 映射，测试断言 21/210；
- 节拍 8 反转 / 10 爽点 / 8 情绪 = 26：`beat-system.ts:21-57`，`test/skill-pack.test.cjs:15` 断言 26，与 `references/03-beats.md` 一致；
- 字数闸门 LIVE 800–1000 / AIGC 1200–1500（AIGC 按成片时长缩放、英文按单词折算）：`src/engine/script-format.ts:10-13,29-37,68-71`，与 `04-formats.md` 一致；
- 四阶段 / 六维评分 / 六语种、英文零中文：`creation-spec.ts:11-52`，与 `05-unified-spec.md` 一致；
- 成年向授权：全法域 `explicitSexual` 类型锁死 `false`、授权 30 天有效：`mature-gating.ts:11-21,37`；
- 担保交易资金安全：放款/退款用状态条件翻转做并发抢占、全程幂等键、原扣款不存在拒退，设计严谨：`src/lib/escrow.ts:30-59`、`src/routes/market.ts:193-295`、`src/lib/billing.ts:58-145`；
- "售价 ≥ 成本×2"启动自检 `assertNoLoss()`：`pricing.ts:117-137`，交付说明记录结果为 `[]`。

---

## C. 商业合规 / 交付风险

### C1. 同一"经济引擎单集·零售"存在两个价格（定价事实源内部双口径）

【代码现状】
- `EP_PRICE.FREE.ECONOMY = 12` 积分，`pricing.ts:21` 注释"零售 **1.2 元**/集"；
- `VALUE_ADDED.SCRIPT_EP_ECONOMY = { points: 20, ... }`，`:61` 描述"生成1集·经济引擎(**零售**)"——即 **2 元/集**。

两条都自称"零售"、都是经济引擎单集，价格 12 vs 20 积分。`assertNoLoss()`（`:117-137`）只校验"售价 ≥ 成本×2"，**不校验两条零售路径彼此一致**。

→ 免费用户超出每日免费额度后单集究竟扣 12 还是 20 积分，取决于走哪条购买路径。【推断：需业务裁定以哪个为准，再让另一处对齐或明确场景区分。】

### C2. 声明"全平台唯一合规事实源"，X剧本却仍跑独立词表（双轨）

- `src/lib/content-safety.ts:4-5` 明确批评"一处一个正则、口径相悖"的历史问题，并声明社区/知识/剧本/互动/**X剧本**"全部走本模块"，是"全平台唯一事实源"；
- 但 `src/engine/mature-gating.ts:83,88` 仍用自带 `words[]` + `text.includes` 独立做露骨筛查，**该文件未 import content-safety**。

→ 声称已统一的 X剧本路径上，两套词表并存——正是 content-safety 想消除的局面。【待裁定：是让 mature-gating 复用 scanContent，还是在两处显式声明分工与优先级。】

### C3. 合规词表自我违背"只拦导向、不误杀题材名词"原则

- `content-safety.ts:7-8,50` 声明：BLOCK 只收"明确违法违规的导向/教程/煽动短语"，普通题材名词归 WARN；
- 但 B05 的 `patterns`（`:79-83`）里混入纯名词 **`'制毒'`、`'贩毒渠道'`、`'偷税漏税'`、`'逃避监管'`**（与"制毒教程/偷税漏税教程"并列）。

匹配是裸子串 `text.includes`（`:200`），于是"制毒窝点被警方端掉""他因偷税漏税被捕"这类**正面叙事台词也会被硬拦截（block）**，直接违反该模块自己定的误杀原则。

### C4. 机审为裸子串匹配，存在绕过面（实现局限）

`content-safety.ts:200` 与 `mature-gating.ts:83,88` 均为 `text.includes(词)`。拆字、插符号、谐音、英文/其它语种露骨词可绕过；模块注释也承认语义级判断留给合规审核师 Agent（`content-safety.ts:12`）。

→ 建议至少在产品层明确"机审仅第一道、非合规终局"；是否补归一化/多语词表【待裁定】。

### C5. 海外标签本地化仅 zh/en，与"六语种"覆盖宣称不一致

- `src/config/overseas-taxonomy.ts:13` `Locale = 'zh' | 'en'`，全部文化转译（CULTURE_REMAP）、海外热度标签只覆盖英文；
- 而创作规范宣称六语种 zh/en/**ja/ko/es/ar**（`creation-spec.ts:11-52`、`05-unified-spec.md`）。

→ 日/韩/西/阿用户选海外平台时，没有对应的标签本地化与文化改写，"出海/多语言"在标签层只做到中英。【功能覆盖缺口，非崩溃】

### C6. 赠送积分或可流入 C2C 交易变现，与"平台全程不垫资"存在张力（待裁定，暂不定性）

【代码现状】
- `market.ts:6` 声明"平台全程不垫资"；
- 赠送积分 `grantBonus()` 直接累加进用户 `balance`（`billing.ts:195-197`），与充值余额混在同一个数字里；
- 买家在市场付款只按 `balance` 总额扣（`market.ts:218-221`），扣款流水统一记 `bucket:'RECHARGE'`，**不区分该余额来自充值还是赠送**；
- 卖家放款得到 `sellerGainPoints` 进自身余额（`escrow.ts:47-52`）。

【推断】若赠送（补贴）积分可用于购买他人剧本，则获客补贴可能在 C2C 市场里被"变现/转账"，与"不垫资"的资金口径冲突。是否真实可套利，取决于充值/赠款在提现与交易场景是否另有隔离——本次未读支付/提现模块，**列为待财务与代码联合核实，不作为已确认漏洞**。

### C7. 交付说明：当版全量回归"待回填"，却已宣称完成度 96.5%、综合 9.7

`zhongnan-v2.78-交付说明.md`：
- `:89` "全量回归 | 见下方回填"；版本轨迹表 `:111` v2.78 全量回归 = "**待回填**"；
- 同表历史版本都有精确数字：v2.75 1167 例 / v2.76 1176 例 / v2.77 1185 例，均 0 失败（`:108-110`）；
- 但 `:101` 已写"距产品化上市 96.5%"，`:103` "综合评分 9.7/10"。

→ 当前交付版本缺最关键的全量回归实数，却给出比历版更高的完成度/评分结论，**证据链与宣称不匹配**；应先补回归数字或撤回完成度表述。

### C8. 小瑕疵：节拍 id 中英混排

`身份压制` 的 id 为 `pay_id压制`（中英混排），散见 `beat-system.ts:37,79,139`、`emotion-wave.ts:67`、`beat-catalog-i18n.ts:72`；其余节拍 id 均为纯英文。作为对象键 / 跨端 wire 字段，中英混排有规范性与潜在编码/匹配风险（功能当前正常）。

---

## D. 修复优先级建议（仅供决策，未获授权不改码）

**P0（对外口径/证据硬伤，成本低）**
1. A1+A2：先由产品裁定钩子到底是"4 层（数据事实）"还是"5 层（产品口径）"，二选一后统一 `02-hooks.md / creation-spec.ts:28-37 / skill-pack.ts:83,311-346 / test 描述`，并修正"场钩细分动作/氛围/语言"的失实归属。
2. C7：补 v2.78 全量回归实数，或暂撤回 96.5% / 9.7 的完成度表述。
3. B1+B2：执行 build + `regen-skill-pack.cjs`，使技能包、双 root 副本、SKILL 版本与 `package.json` 一致；评估给 regen 加构建后自动触发。

**P1**
4. A3：微钩注释"八种"改"九种"，并标注 6 类风味归并。
5. A4：修正模式"第 9/10/11 种""第 12 席 long_ip"等错位序号。
6. B3：给 `film` 加版本门控/coming_soon，或正式宣告其已上线。
7. B4：SKILL 模式枚举对齐 modes 规范 id，并把 hit_lab 表述为"一个工作台两条轨道"。
8. C2：统一合规入口（mature-gating 复用 content-safety 或写明分工）。
9. C3：把 B05 中纯名词（制毒/偷税漏税等）移 WARN 或改为导向短语，消除误杀。
10. C1：裁定经济单集"零售"唯一价格后归一。

**P2**
11. C4：机审归一化/多语，或 UI 明示"机审非终局"。
12. C5：补齐 ja/ko/es/ar 海外标签本地化。
13. C6：联合财务核 BONUS 积分能否进 C2C，必要时在交易扣款侧隔离赠送余额。
14. C8：`pay_id压制` 等中英混排 id 英文化（需配套数据/键迁移）。

---

## E. 证据索引（文件 : 行）

**钩子分层**
- `references/02-hooks.md:1,3`
- `src/engine/creation-spec.ts:28-37,90-91`
- `src/engine/skill-pack.ts:83,311,320,343,346`
- `src/engine/hook-system.ts:5,12,20-32(开场11),35-42(集6),45-49(场3),51-62(微9),64,69,79-86`
- `test/skill-pack.test.cjs:15-19,54,56,62-64`
- `references/craft-pack.json:3,5,9(hooks=29)`

**模式 / 版本**
- `src/config/modes.ts:2-8,11-27,38-45,66-79,88-92`
- `src/config/pricing.ts:21,61,99-100,117-137`
- `package.json:3`
- `scripts/regen-skill-pack.cjs:1,4,5,11-14`
- `src/engine/script-length.ts:122,202`；`src/engine/aigc-screenplay.ts:274`；`src/engine/mode-craft.ts:44`

**交易 / 合规**
- `src/routes/market.ts:4-6,19,88,121,203,218-221,283`
- `src/lib/escrow.ts:30-59`
- `src/lib/billing.ts:58-145,187-203`
- `src/lib/content-safety.ts:4-12,50,79-83,200`
- `src/engine/mature-gating.ts:11-21,37,83,88`
- `src/config/overseas-taxonomy.ts:13`

**节拍 / 交付**
- `src/engine/beat-system.ts:21-57,37,79,139`；`src/engine/emotion-wave.ts:67`；`src/engine/beat-catalog-i18n.ts:72`
- `zhongnan-v2.78-交付说明.md:89,101,103,108-111`
