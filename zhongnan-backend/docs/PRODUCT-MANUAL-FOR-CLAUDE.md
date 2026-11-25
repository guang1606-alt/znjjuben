# 终南集 · AGI 编剧大师 —— 产品开发手册（交付给 Claude / 任意实现方）

> 版本基线：v2.688（2026-11-25）。本手册只描述**已在线上验证存在**的能力与契约，供另一位实现者从零复刻或接手开发。
> 仓库边界：本产品独占一个 Git 仓库（`zhongnan/`，代码在 `zhongnan-backend/`）。**禁止写入父目录的 K12 产品仓库**（`/Users/a123/Desktop/养正`）。
> 权威代码位置：后端 `src/`，前端 `web/`（原生 HTML/CSS/JS，无框架）、测试 `test/`、文档 `docs/`。

---

## 一、产品定位（一句话）

给短剧创作者一支「AI 编剧团队」：用户用最低门槛把想法交出来，系统按 8 种创作入口 + 10 种成品形态 + 10 种输出语言，生成**可直接拍摄**的竖屏短剧剧本；全流程可见、可取消、可退款，并按算力真实计费。

三条不可妥协的产品底线：

1. **不抄表达，只借方法**：素材改编必须做侵权重合度检测，公版/平台免费区/侵权黑名单三档授权判定。
2. **不撒谎**：额度、余额、扣费、退款、失败原因都必须真实展示；不得出现「敬请期待」式占位承诺。
3. **不偷换上下文**：任何全局操作（切语言、切主题、开面板）都不能把用户眼前的内容顶掉。

---

## 二、核心概念模型（必须先建对，否则后面全歪）

旧版把「怎么开始写」与「写成什么」混成一个枚举，导致模式膨胀。v2.329 起拆成三个**正交维度**（实现时不要合并）：

| 维度 | 数量 | 取值 |
| --- | --- | --- |
| 创作模式 `mode`（怎么把想法交出来） | 8 | `tag` 标签创建 · `interview` 采访式 · `diary` 日记式 · `spark` 灵感式 · `hot` 实时热点 · `persona` 角色自述 · `duel` 双人对撞 · `multiverse` 世界线推演 |
| 剧本类型 `scriptType`（成品形态） | 10 | 真人实拍短剧 · AIGC短剧/漫剧 · 爆款短视频脚本 · 广告/软广 · 宣传片 · 电视剧/多集网剧 · 互动剧 · 互动影游 · 电影剧本 · 长系列 IP 连载 |
| 输出语言 `language` | 10 | 中文 · 英语 · 日语 · 韩语 · 西班牙语 · 葡萄牙语 · 泰语 · 印尼语 · 越南语 · 阿拉伯语 |

另有三个横切维度：

- **引擎档 `engine`**：`ECONOMY` 经济 / `STANDARD` 标准 / `FLAGSHIP` 旗舰（成本与售价不同，见第五节）。
- **灵感式子轨道 `sparkTrack`**（仅 `mode=spark`）：`material_rewrite` 素材改编 / `signature_scene` 名场面拓展 / `hit_reverse` 爆款逆向批量。
- **项目 `project`**：一次创作 = 一个项目，含简报、集数、正文、版本、诊断、导出物。

档位门槛（单一事实源 `src/config/modes.ts`）：

| 资源 | FREE | BASIC | ADVANCED | PRO |
| --- | --- | --- | --- | --- |
| 创作模式 | tag | +interview, diary, spark | +hot, persona, duel | +multiverse |
| 剧本类型 | 真人实拍短剧 | +AIGC、短视频、广告、宣传片 | +电视剧、互动剧、互动影游 | +电影、长系列 |
| 灵感轨道 | — | material_rewrite | +signature_scene | +hit_reverse |
| 引擎 | ECONOMY | +STANDARD | +FLAGSHIP | +FLAGSHIP |

> 旧 wire-id 必须仍能落地（旧项目打开不丢模式、不降级、不清空原文）：保留 `canonicalSparkTrack` / `canonicalScriptTypeId` 的别名映射。

---

## 三、必须实现的功能清单

### 3.1 账号与会员（P0）

- 手机号 + 密码注册/登录；密码至少 8 位含字母数字；登录成功回到创作区。
- 邀请码（选填）；登录态持久化；退出登录先弹确认，确认后才清本地态。
- 会员四档：FREE / BASIC(39 元/月) / ADVANCED(99) / PRO(299)，年付另价；升级/续费走订单，微信/支付宝回调。
- 积分账本：充值、扣费、冻结、解冻、退款全部落账，**余额永不允许靠前端文案推算**。
- 每日免费额度：FREE 每日 2 集（每日 0 点重置），界面必须显示真实剩余，而不是硬编码「每日前 2 集免费」。
- 交易门槛 `MIN_TRADE_LEVEL = BASIC`：FREE 不能挂牌卖本，但可以买/创作。

### 3.2 创作入口与创作前简报（P0，本产品的门面）

进入方式：创作专区 8 张模式卡 → 点卡进入「二级界面」（模式详情 + 创作前简报）。

简报必须包含（缺一即视为未完成）：

1. **一句话想法**输入框（主输入，必填校验给可执行提示）。
2. **剧本类型**选择（按档位加锁，锁住的项显示所需等级而不是静默隐藏）。
3. **集数 / 引擎**：集数预设（如 20/40/60）+ 自定义；引擎按档位可选。
4. **实时成本提示**（`#genCostHint`）：单价 × 集数 ≈ 总额，并区分：
   - 付费档且有月度赠送集 → 「优先抵扣本月赠送集（剩 N 集），超出按 X 积分/集」；
   - FREE 有剩余免费集 → 「今日免费还剩 N 集，超出 M 集约 K 积分」；若本单全部落进免费额度，明确说「本单全部落在免费额度内」；
   - FREE 免费额度用完 → 「今日免费 N 集已用完（每日 0 点重置），当前余额 Z 积分」；余额不足时给出**可执行**建议。
5. **一键修正按钮**（`#genCostFix`，仅在额度受阻时出现）：
   - 还有免费剩额 → 「先写 N 集（免费）」，点击把集数改成 N；
   - 用完且余额不足 → 「开通会员继续创作」，点击直达会员页。
   - `data-mode="free" | "vip"` 驱动文案与跳转，二者不可混。
6. **成本提示不得吓人**：余额足够时禁止出现「余额不足」字样。
7. 简报里的可选项（按模式/类型出现）：灵感三轨道、素材上传（仅素材改编）、采访会话、品牌简报（广告/软广）、热点简报（热点）、互动分支简报（互动剧/互动影游）、原文参考（灵感式，用于 n-gram 重合度检测）。

### 3.3 生成链路与 SSE 契约（P0）

主端点：`POST /api/generate/episodes`（SSE）。前端必须按下列事件序列渲染，不得自造状态：

| 事件 `stage` | 关键字段 | 前端责任 |
| --- | --- | --- |
| `frozen` | `taskId, points, free, viaQuota, staff, quotaRemainAfter` | 展示本次冻结积分；提供取消入口 |
| `context` | `xiaonanLines, directions, complianceWarnings` | 展示小南判断/方向/合规提示 |
| `progress` | `pipelineStage, role, status, note` | 逐岗进度可见（角色 = 九大岗位） |
| `done` | `pointsCharged, realCostFen, fellbacks, free, viaQuota, taskId, antiAi, market, audience, hooks, beats, sandbox, aiLabel` | 落稿、展示去 AI 化与市场评估 |
| `failed_refunded` | `error`（已脱敏）+ 退款说明 | 明确「已退款」，不谎报成功 |
| `cancelled` | — | 取消即解冻退款 |

硬性要求：

- `frozen` 帧必须带 `taskId`，前端据此调 `POST /api/generate/tasks/:id/cancel`。
- 失败与取消必须二选一，不能把异常吞成「静默成功」。
- 同一用户并发任务要有上限；重复点击生成要防抖。

### 3.4 工作台（P0，18 个面板）

面板以覆盖层（layer）呈现，同一时刻只允许一个「当前面板」；开新面板必须收起旧面板。

`_WORKBENCH_PANEL_IDS`（18）：`tagBench, craftBench, novelSrcBench, branchPanel, branchBriefPanel, diversityPanel, lintPanel, stageLadder, roomPanel, teardownPanel, interviewPanel, brandPanel, trendPanel, sourceTextPanel, taskQueuePanel, progressPanel, resultPanel, failPanel`。

每个面板必须有：标题（中英双语）、返回按钮、关闭方式、键盘可达、`aria-*` 语义。
面板显隐由两层守卫保护：

- `_initSyncing`：初始化同步期间不主动 `openWorkbench`；
- `_langSyncing`（v2.688）：**切语言期间只刷新文案，不改任何面板显隐、不打开面板**；切完刷新工作台标题。

### 3.5 素材库（P0）

- 30 个合法来源（Project Gutenberg、Internet Archive、Wikisource 多语、Aozora、Gallica、Feb-web、Domínio Público、NDL、好读、青空等），全部 https、id/url 唯一。
- 授权三档：`public_domain`（可改编）/ `platform_free`（只能阅读，默认不可改编）/ 其他受限；盗版词黑名单 `PIRACY_BLACKLIST` 命中即拒绝收录。
- 功能：语言筛选条、公版仅看、关键词搜索（**中英双语字段都要检索**）、结果计数（`已收录 N 个来源 · 当前显示 M 个`，空态也要给总数）。
- 双语：站名、简介、改编提示全部提供英文对照；英文界面不得残留中文（专有名词除外，但中文修饰语必须替换）。
- 每张卡：来源名、语种、授权徽章、简介、改编提示、「打开原站 ↗」。

### 3.6 工具箱（P0，7 件）

1. 选题会（多席位评估，给立项/缓议/否决）
2. 剧本围读（责编/导演/制片/观众立场挑问题，形成修改清单）
3. 拆爆款（拆方法论 + 大纲，确认即进改编）
4. 多版本去重体检（写前差异化种子 + 写后两两比对）
5. 互动分支校验/起稿（生死胡同、伪选择、自环、死循环、悬空连线、概率权重）
6. 剧本体检（五组逐条，标 P0/P1/P2）
7. 打磨阶梯（大纲→初稿→润色→定稿，判定能否进下一阶）

免费件必须真的免费（不耗积分），文案里不得写「免费」却扣费。

### 3.7 作品与资产（P1）

- 作品库：项目列表、归档、克隆、脚本版本与 diff、续写。
- 导演包（director-pack）、价值卡（value-card）、诊断（diagnosis）、情绪曲线（emotion-wave）、听稿/ TTS 播放列表。
- 角色/道具/场景资产库：增删查、健康度、用量、从项目反哺、批量补全。
- 导出：`GET /api/export/:projectId` 与 `/:projectId/materials`（导出物必须带 AI 标识 `aiLabel`，AIGC 类型强制）。
- 市场：挂牌/购买/确认/退款、卖家面板；广场与社区。

### 3.8 管理后台（P1）

知识库、模型配置、安全策略、交接（handoff）、生产控制台（`production-console.html`）。所有管理端点只允许超管。

### 3.9 多语言 / 主题 / 可访问性 / 离线（P1）

- 中英双语由 `web/i18n.js` 统一驱动；**切语言只刷新文案，不改布局与面板显隐**（v2.688 修复）。
- 四套主题：`tech`（默认深色科技）/ `light` 宣纸 / `dark` 影院墨 / `eye` 护眼米黄；主题变量集中在 `:root` 与 `[data-theme]`，不得在 JS 里写死颜色。
- 对比度：正文小字 ≥ 4.5:1，图形 ≥ 3:1；语义色统一走 `--danger-text/--warn-text/--ok-text/--info-text`。
- 可访问性：skip-link、焦点可见、`role=status/alert`、`aria-live`、`aria-current`、`aria-pressed`。
- PWA：`manifest.webmanifest` + `sw.js` 离线壳 + 安装按钮 + 断网常驻提示。

---

## 四、接口契约（最小可实现集）

后端挂载前缀（`src/server/app.ts`）：

```
/api/auth  /api/generate  /api/va  /api/room  /api/interview  /api/teardown
/api/ads   /api/order     /api/feedback  /api/market  /api/community
/api/export  /api/tags    /api/craft  /api/novels  /api/submission
/api/admin/{knowledge,model,safety,handoff,production}  /api/admin
/api/updates
```

关键端点（必须一致）：

| 方法与路径 | 用途 |
| --- | --- |
| `POST /api/auth/register` / `login` / `GET /api/auth/me` | 账号；`me` 返回 `level, points, freeToday{used,remain,cap}, quota` |
| `GET /api/generate/modes` | 模式/类型/语言/引擎/轨道 + 档位与价格（前端不抄价格） |
| `POST /api/generate/projects` | 建项目 |
| `POST /api/generate/episodes` | **SSE 生成**（见 3.3） |
| `POST /api/generate/tasks/:id/cancel` | 取消并解冻退款 |
| `GET /api/generate/projects/:id` / `/scripts` / `/scripts/diff` | 项目与版本 |
| `POST /api/generate/projects/:id/fix` | 按诊断改稿 |
| `GET /api/order/catalog` | 单集价矩阵 `epPrice`（由 `EP_PRICE` 派生） |
| `POST /api/order/create` / `notify/wechat` / `notify/alipay` | 下单与回调 |
| `GET /api/novels` | 素材库来源列表（含 `nameEn/descEn/adaptNoteEn`） |
| `GET /api/export/:projectId` | 导出 |
| `POST /api/market/listings` / `buy` / `confirm` / `refund` | 交易闭环 |

约定：

- 一律 `Authorization: Bearer <token>`；未登录返回 401，越档返回 403 + 所需等级。
- 错误信息必须可展示给用户（中文），不得泄露内部堆栈。
- 前端只拼文案，不复制价格表；新增档位只改后端矩阵。

---

## 五、计费规则（必须与后端矩阵一致）

单集积分价 `EP_PRICE`（`src/config/pricing.ts`）：

| 档位 | ECONOMY | STANDARD | FLAGSHIP |
| --- | --- | --- | --- |
| FREE | 12 | — | — |
| BASIC | 10 | 15 | — |
| ADVANCED | 8 | 12 | 28 |
| PRO | 5 | 9 | 24 |

会员矩阵：

| 档位 | 月费 | 年费 | 每月赠送（经济档集数） | 抽成 | 并发项目上限 |
| --- | --- | --- | --- | --- | --- |
| FREE | 0 | — | 0（每日 2 集免费） | —（不可交易） | 2 |
| BASIC | 39 元 | 365 元 | 0（可买 100 集/100 元包） | 15% | 10 |
| ADVANCED | 99 元 | 999 元 | 300 | 10% | 30 |
| PRO | 299 元 | 2999 元 | 1000 | 5% | 100 |

铁律：

- 每档每引擎售价 ≥ 真实成本 × 2（`assertMargin` 启动即校验，否则拒售）。
- 冻结 → 成功扣费 / 失败退款；退款必须在 SSE 与账本同时可见。
- 赠送集优先于积分余额；免费日额度优先于一切。

---

## 六、交互与体验规范（与本轮走查结论对齐）

1. **面板不被偷换**：任何同步类函数（语言、主题、账号刷新）不得 `classList.toggle('hidden')` 打开别的面板；守卫要机械可测。
2. **标题随语言走**：切语言后工作台标题、计数、占位符、语种名、站名全部换语言，不能半中半英。
3. **二级界面不露半截大标题**：进入模式详情时隐藏 studio 品牌 hero，返回时恢复；否则吸顶导航会把 hero 切出半截残字。
4. **toast 克制**：自动补全/后台建议不得弹 toast 盖内容；提示只在相关面板可见时出现；390px 下同屏不超过 2 条。
5. **成本提示三态**：安全（正常文案）/ 警示（额度用完，红棕色 + 一键修正）/ 无误导（余额够时不许说不足）。
6. **移动端 390 优先**：无横向滚动、按钮 ≥ 34px 高、关键 CTA 不被 toast 遮挡、键盘弹出不遮挡输入。
7. **键盘可达**：所有面板可用 Tab/Enter 操作，Esc 关闭；焦点不落进隐藏面板。
8. **数据诚实**：余额、剩余额度、价格全部来自接口；离线时给常驻提示而不是假装成功。

---

## 七、质量门禁（每条都必须跑）

```bash
# 后端
npx tsc -p tsconfig.json              # 类型/编译
npm test                              # 全量（先 lsof -ti:8099 | xargs -r kill）
npm run typecheck
npm run verify:copy                   # 文案准确性/ i18n key / 离线壳 / 死引用 / 事件绑定
npm run preflight                     # 改动范围守卫
# 变异测试（证明测试真的能抓 bug）
node scripts/mutation-run.cjs --file <file> --find "<原文>" --replace "<变异>" --test <test> --allow-dirty --count 1
```

前端验收必须真机（Playwright + 真实 Chrome）覆盖：

- 视口 390×844 与 1440×900；
- 中/英双语 × 浅色/深色主题；
- 四档账号各走一遍：FREE 免费额度用完 / BASIC 无赠送 / ADVANCED 有 300 赠送 / PRO 旗舰引擎；
- 切语言时当前工作台面板保持不变（本轮回归项）；
- 素材库：计数、筛选、搜索、英文卡片零中文残留。

测试写法基线（沿用本仓库风格）：

- 静态契约测试：从 `web/app.js` 抽取函数源码断言关键守卫存在（防止回归时被顺手删掉）。
- 行为测试：用 `vm` 注入最小依赖运行函数，断言副作用（如「切语言期间零次 hidden toggle」）。
- 每条修复至少 1 条测试 + 1 轮变异；变异必须变红。

---

## 八、建议里程碑

| 里程碑 | 范围 | 完成标准 |
| --- | --- | --- |
| M1 可用 | 账号/会员/积分、8 模式、简报、SSE 生成、作品库 | FREE 能完整出一本 20 集短剧 |
| M2 可信 | 计费三态、取消退款、失败可见、成本提示、素材库双语 | 任意失败路径用户都能看懂钱去哪了 |
| M3 好用 | 18 面板、7 工具、资产库、导出/导演包、诊断 | 职业编剧一天能走完整流程 |
| M4 增长 | 市场/广场/社区、邀请码、管理后台、PWA | 可对外运营并结算 |

---

## 九、明确不要做的事

1. 不要把「模式 / 类型 / 语言」合并回一个下拉框。
2. 不要在前端复制价格表；不要用「每日前 2 集免费」这种硬编码掩盖真实剩余。
3. 不要收录盗版/侵权来源；不要让 `platform_free` 默认进入改编。
4. 不要用 toast 冒充状态；不要用「静默成功」掩盖失败。
5. 不要在切语言/切主题时改变页面结构或打开别的面板。
6. 不要跨仓库改动（父目录 K12 产品与 `zhongnan/` 是两个独立仓库）。
7. 不要提交未跟踪的截图/临时脚本/素材目录；只 `git add` 本任务文件。

---

## 十、接手第一天怎么跑起来

```bash
cd zhongnan/zhongnan-backend
npm install
npm run demo        # http://127.0.0.1:8099（内存数据，重启清空）
# 演示账号（密码均 demo123456）
# FREE 13900000001 / BASIC 13900000002 / ADVANCED 13900000003 / PRO 13900000004
# 超管 18891995171
```

前端没有构建步骤：改 `web/*.js|css|html` 刷新即生效；后端改 `src/` 需 `npm run build` 或重启 `npm run demo`。

先读这三份代码，再动手：

- `src/config/modes.ts`：三维模型与档位门槛（单一事实源）
- `src/config/pricing.ts`：价格矩阵与铁底校验
- `web/app.js`：工作台面板、简报、成本提示、语言同步（体量大，按函数名检索）

---

*本手册随版本演进；任何行为变更必须同步 `docs/USER-GUIDE-CRAFT.md` 与本文件的对应章节。*
