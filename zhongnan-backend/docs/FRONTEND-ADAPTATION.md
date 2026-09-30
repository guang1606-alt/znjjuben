# 前端适配文档（FRONTEND-ADAPTATION）

> 面向前端（`web/` 原生 JS 站点及后续独立前端/移动端）的后端 API 契约与适配说明。
> 后端每次破坏性契约变更都会在此登记：变更内容 → 迁移对照 → 前端已同步点。
> 版本对齐 `package.json`，当前基线：**v2.233.0**。

---

## 一、分页统一契约（v2.215.0，本次核心）

所有**参数式分页端点**统一为同一套请求/响应契约（家族铁律，新端点必须遵守）：

### 请求参数（双风格，混给时 `page` 优先）

| 风格 | 参数 | 说明 |
|---|---|---|
| 页码式（主风格） | `page`、`pageSize` | `page` 从 1 起；`pageSize` 为每页条数 |
| 偏移式（别名） | `limit`、`offset` | `offset` 从 0 起；与页码式等价换算 |

- 两者混给时 **page 优先**，`offset` 由 `(page-1)*pageSize` 推导，显式 offset 被忽略
- 无效值（NaN / 0 / 负数）走该端点默认值；`limit/pageSize` 封顶各端点 `maxLimit`
- 共享实现：`src/lib/pagination.ts` 的 `parsePageParams()`

### 响应形状（六键全回显）

```json
{
  "items": [],        // 唯一列表键（不再使用 healths 等旧键）
  "total": 123,       // 过滤后真总数（不是本页条数）
  "page": 1,          // 当前页码（偏移式请求也会换算回显）
  "pageSize": 50,     // 实际每页条数
  "limit": 50,        // 回显别名，恒等于 pageSize
  "offset": 0         // 实际起始偏移
}
```

### 端点参数默认值 / 上限

| 端点 | 默认 pageSize | maxLimit | 备注 |
|---|---|---|---|
| `GET /api/admin/users` | 20 | 100 | 支持关键词 `q` 搜索 |
| `GET /api/generate/character-assets/health` | 50 | 200 | 支持 `q`/`lang`；`conflicts` 跑全量库不受分页影响 |
| `GET /api/generate/prop-assets/health` | 50 | 200 | 同上 |
| `GET /api/generate/scene-assets/health` | 50 | 200 | 同上 |
| `GET /api/market/listings` | 50 | 100 | 支持 `section`/`sort`；默认 50 保持橱窗观感 |
| `GET /api/community/posts` | 50 | 100 | 支持 `section` 过滤（空串=全部分区）；v2.230 纳入契约 |

### 不在本契约范围的端点（维持原语义）

| 端点 | 形态 | 说明 |
|---|---|---|
| `GET /api/market/board` | `{ type, total, items }` | top-N 榜单；v2.215 修复 `total` 为过滤后真总数（`limit` 只裁 items，take 500 截断硬帽）；**v2.231 前端消费 total**（默认 20 → `limit=50` 拉满 + `#mkBoardMeta` 共 X 条/截断提示） |
| `GET /api/tags/search`、`/api/tags/leaves` | 裸数组 | top-N 搜索/热榜，无翻页需求 |
| `GET /api/generate/*-assets`（列表） | `{ assets, total }` | 硬帽列表（take 200 + total 截断提示铁律），非分页端点 |

---

## 二、迁移对照（旧 → 新）

| 变更点 | 旧 | 新 |
|---|---|---|
| 体检列表键 | `resp.healths` | `resp.items`（`healths` 键已退役） |
| 体检响应分页元信息 | `{ total, limit, offset }` | 补齐 `page`、`pageSize`（limit/offset 保留） |
| 广场列表 `GET /api/market/listings` | **裸数组** `[{...}]`，take 50 静默截断 | `{ items, total, page, pageSize, limit, offset }`，可传 `limit/offset` 翻页 |
| 交流广场列表 `GET /api/community/posts`（v2.230） | **裸数组** `[{...}]`，take 50 静默截断 | `{ items, total, page, pageSize, limit, offset }`，可传 `page/pageSize`（或 `limit/offset`）翻页；`section` 过滤保留 |
| admin 用户列表响应 | `{ items, total, page, pageSize }` | 补齐 `limit`、`offset` 回显（旧字段全保留） |

### `web/` 已同步点（与后端同仓库同版本发布）

- `web/app.js` 三处资产体检面板：`health.healths` → `health.items`（6 处读取）
- `web/app.js` `loadListings()`：`Array.isArray(j)` → `Array.isArray(j.items)` + `list = j.items`
- 体检面板调用已固定 `limit=200` 拉满（v2.156 铁律），契约变更不影响该用法
- **v2.230 交流广场消费侧翻页**：`loadFeed()` 传 `page/pageSize`（`SQ_PAGE_SIZE=50` 对齐后端 defaultLimit，`section` 恒传、空串=全部分区）+ 消费 `items/total`（>50 帖不再静默截断）；`renderSqPager()` 翻页器与 market 橱窗 `renderMkPager` 同构（复用 `znPagerState`，上/下一页 disabled 态），分区切换重置第 1 页；`#sqEmpty` 失败/空态收口 `znErrorHtml/znEmptyHtml` 并移除 `notice`/`data-i`（v2.229 `#mkEmpty` 同族），index.html 新增 `#sqPager` 容器
- **v2.229 消费侧翻页补全**：`loadListings()` 传 `page/pageSize`（`MK_PAGE_SIZE=50` 对齐后端 defaultLimit）+ 消费 `total` 渲染 `#mkPager` 上/下一页翻页器（此前只看第一页，>50 条静默截断）；`mkSort` 切换重置回第 1 页；榜单 Tab 模式隐藏翻页器；admin 用户表 `renderAdmUserPager()` 纯文本页码升级为可交互上/下一页（`admPage` 此前恒为 1）

---

## 三、既有 API 约定速查（前端需持续遵守）

### 错误响应

- 所有错误均为 JSON：`{ "error": "ERROR_CODE" | "人类可读文案" }`，绝不返回 HTML 或堆栈
- 未知 `/api/*` 路由：`404 { "error": "NOT_FOUND" }`（v2.213 起）
- **请求体客户端错误**（v2.218 起）：POST 坏 JSON → `400 { "error": "请求体格式错误" }`；超过 12mb 上限 → `413 { "error": "请求体过大" }`（此前一律 500 INTERNAL_ERROR，契约失真已修正）
- **500 一律 `{ "error": "INTERNAL_ERROR" }`**（v2.216 起）：内部异常详情（Prisma/路径/供应商错误）只进服务端日志（`failInternal()` 统一出口），前端遇到 `INTERNAL_ERROR` 应显示本地友好文案而非错误码本身
- 统一兜底：`500 { "error": "INTERNAL_ERROR" }`
- `/api/*` 响应带 `Cache-Control: no-store`（防 token/个人信息落中间缓存）

### 部署变量（v2.218 起）

- `TRUST_PROXY_HOPS`：反向代理跳数，默认 `1`（nginx/veFaaS 单层网关标准形态）。多层网关设实际跳数；**直连部署（无代理）设 `0`**。影响 `req.ip` → 注册/登录/邀请码三类 IP 维度限流的准确性：不解析 XFF 时全体用户共享代理 IP，注册限流（5 个/15min/IP）必误伤

### 超管后台与运营能力入口（v2.219.0 前后端能力对齐）

对齐审计补齐 4 处「后端有能力、前端无入口」，后端 API 零变更：

| 能力 | 前端入口 | 端点 |
|---|---|---|
| 广告位管理 | 超管后台「广告位」标签页（slot 动态下拉、新建/编辑/删除、uiConfirm 确认） | `GET /api/ads/admin/list`、`POST /admin/create`、`POST /admin/:id/update`、`POST /admin/:id/delete`（slot ∈ AD_SLOTS 四档：home_hero_roll / create_done / square_feed / user_side） |
| 全量投稿渠道 | 投稿面板「查看全部投稿渠道」展开（含未核验计数，二次点击收起） | `GET /api/submission/channels` → `{ channels, unverified }` |
| 副管理员授予/回收 | 用户管理行操作「授予副管理员 / 摘管理员帽」按钮 | `POST /api/admin/users/:id/admin-flag`（body `{ isAdmin }`；仅主账号可授） |
| 知识条目归档/恢复 | 学习窗口行操作「归档（可填原因）/ 恢复（转待审）」按钮 | `POST /api/admin/knowledge/:id/archive`（body `{ reason? }` → ARCHIVED）、`/:id/restore` → PENDING |

### 市场交易定价（`/api/market/listings`，v2.228 前端预检对齐）

- 价格契约（`market.ts` `validatePriceFen`）：`priceFen ≥ 100`（最低 1 元）且为 `10` 的整数倍（1 积分 = 0.1 元），违者 400「价格不低于 1 元，且需为 0.1 元(1积分)的整数倍」
- 前端上架（`listSubmit`）与重新上架（relist）均经 `priceFenFromYuan()` 本地同口径预检，未选剧本/价格非法按后端顺序分支提示；`listPrice` 输入框 `step=0.1`

### 鉴权与会话（`web/api.js` API 层）

- `Authorization: Bearer <accessToken>`；access 过期用 refresh 静默续期并重试一次
- token 持久化键：`zn_token` / `zn_refresh` / `zn_user`（localStorage）
- 自助修改密码：`POST /api/auth/change-password`（v2.214，前端资料页入口）
- **统一密码策略**（后端 v2.212，前端 v2.227 全对齐）：注册 / 改密 / 管理员开号 / 管理员重置共用「8-64 位 + 必含字母和数字 + 弱口令黑名单」（登录不校验强度，存量用户不受影响）；前端四个入口的本地校验同口径（弱口令黑名单仍在服务端，避免双源漂移），`authPwd`/`inNewPw` 输入框 `maxlength=64` 对齐后端 `max(64)`
- **429 限流响应**（v2.217 起）：登录 / 注册 / 改密三类端点在触发暴力防护时返回 `429 { "error": "<中文提示>" }`——前端无需按状态码分支，`jsonOrThrow` 统一展示 error 文案即可
- **错误信息脱敏回落层**（v2.226 起）：`jsonOrThrow` 对内部裸码（`INTERNAL_ERROR` / `SERVER_BUSY` / 无 body 的 5xx）统一回落本地双语友好文案，用户不再看到错误码原文；原码始终保留在 `e.error`（无 body 5xx 补 `e.error='SERVER_BUSY'`）、状态码在 `e.httpStatus`，调用方按码分支不受影响；业务错误码、`IDEMPOTENT_REPLAY` 后端提示、4xx `HTTP xxx` 语义均未变更

### 版本历史（前端相关变更登记）

| 版本 | 变更 |
|---|---|
| v2.233.0 | 端点全量对照审计 + 生成取消闭环（**additive 契约，无破坏性变更**）：后端 frozen SSE 帧**增发 `taskId`** 字段（`{stage:'frozen', taskId, points, ...}`，旧前端多收字段无影响）→ 前端 handleEvent 捕获存 `session.taskId`；SSE 新增 `cancelled` 帧语义（后端 abort+冻结积分退款后发出）→ progress-view 新增 cancelled 分支（复用 failed 相位 + `cancelled` 标记 + 默认文案「已取消生成，冻结积分将原路退回」）→ app.js handleEvent cancelled 分支（status=failed、`t('genCancelled')`、renderTaskQueue、active 时 showFail）；进度面板新增 `#genCancelBtn`（仅运行中且有 taskId 显示，点击置 cancelling 忙态 → `POST /api/generate/tasks/:id/cancel`，失败复位+toast），v2.190 取消能力首次有前端入口；采访面板新增 `#ivStopBtn`「⏹ 结束会话」（会话存在且未关闭时显示，调 `POST /api/interview/sessions/:id/close`）；i18n 新增 genCancel/genCancelling/genCancelled/genCancelFail/ivStop 双语；新增 web-endpoint-alignment 守卫 9 断言（先红后绿），全量 5560 条 0 fail |
| v2.232.0 | data-i 命名空间扫尾（纯前端，无 API 变更）：`renderStaticText` 的 `[data-i]` 循环把一切 data-i 当 i18n 键（`I18N.t` 未知键回落返回 key 本身），三处动态渲染复用 data-i 作索引 → 语言切换瞬间动态内容被洗成裸数字——app.js 快速搜索列表 `data-i="${i}"` 读写双处改 `data-idx`、branch-view.js 权重输入去残留（读侧按 `.br-w` class）、ad-roll.js 轮播圆点改 `data-idx`（读侧按 `.ad-dots i`）；`#subAllBtn` 展开态文案（`subHideAll`+计数多段 t() 拼接）挂静态 `data-i="subShowAll"`，展开后切语言按钮洗回「查看全部」而列表仍展开（状态错位）→ index.html 去 data-i + app.js 具名 `syncSubAllLabel()` 收口（`subAllCache` 缓存计数，`renderStaticText` 接入自愈，boot/切语言双时机复原）；新增 web-data-i-sweep 守卫 7 断言（先红后绿），全量 5551 条 0 fail |
| v2.231.0 | 市场榜单 total 消费（纯前端，无 API 变更）：`loadBoard()` 此前不传 `limit`（吃后端默认 20）也不消费 `total`（>20 条静默不可见、take 500 硬帽静默截断，v2.156 铁律漏网点）→ 请求补 `&limit=50`（`BOARD_LIMIT` 对齐后端 maxLimit）+ 消费 `data.total` 渲染 `#mkBoardMeta`（「共 X 条上榜」，total > 展示条数时追加「榜单仅展示前 X 条」截断提示）；`all` 分支/失败/空态隐藏 meta（all 走 loadListings 翻页器，空态由 `#mkEmpty` 承担）；i18n 新增 `boardTotal`/`boardTrunc` 双语、styles.css 新增 `.board-meta`、index.html 新增 `#mkBoardMeta` 容器（榜单 Tab 与网格之间，初始 hidden）；新增 web-market-board 守卫 5 断言（先红后绿），全量 5544 条 0 fail |
| v2.230.0 | 交流广场纳入分页统一契约（v2.215 六键，本轮唯一破坏性契约变更）：`GET /api/community/posts` 裸数组 + take 50 静默截断退役 → `{ items, total, page, pageSize, limit, offset }`（`parsePageParams` 默认 50/上限 100，`section` 过滤保留），total 为过滤后真总数；前端 `loadFeed` 消费侧翻页对齐（`SQ_PAGE_SIZE=50`、`renderSqPager` 复用 `znPagerState` 与 `renderMkPager` 同构、分区切换重置页码），失败/空态收口 `znErrorHtml/znEmptyHtml`，`#sqEmpty` 去 `notice`/`data-i`、新增 `#sqPager` 容器；http-community 契约断言改造 + 分页用例（六键/翻页/别名/无效值默认），新增 web-community-feed 守卫 4 断言（先红后绿） |
| v2.229.0 | 分页契约 v2.215 消费侧覆盖对齐（后端 API 零变更）：market 橱窗 `loadListings` 补 `page/pageSize` 参数并消费 `total`（>50 条不再静默截断），`mkPage` 状态 + `znPagerState` 纯函数 + `renderMkPager` 上/下一页翻页器（disabled 态），`mkSort` 切换重置第 1 页，榜单 Tab 隐藏翻页器；admin 用户表 `renderAdmUserPager` 纯文本页码升级可交互翻页（`admPage` 此前恒为 1）；顺带收口 loadListings/loadBoard 失败态混空态为 `znErrorHtml/znEmptyHtml`（v2.224 漏网点），`#mkEmpty` 移除 `notice`/`data-i`（防语言切换覆盖 innerHTML），新增 `.zn-pager` 样式；新增 web-pagination-coverage 守卫 5 断言（先红后绿） |
| v2.228.0 | 市场定价校验与后端 `validatePriceFen` 全对齐：新增 `priceFenFromYuan()`（≥1 元且 0.1 元整数倍），上架/重新上架两入口本地预检（粒度不符不再白跑后端 400），提示文案与后端逐字一致，未选剧本/价格非法按后端报错顺序拆分；`listPrice` `step=0.1` + placeholder 标注；新增 web-market-price 守卫 4 断言（先红后绿） |
| v2.227.0 | 鉴权表单校验与后端 v2.212 统一密码策略全对齐：注册表单补「必含字母和数字」本地校验（此前只查 8 位，弱密码须白跑后端且 4xx 中文提示无 en 本地化），与改密/admin 开号/admin 重置同口径；`authPwd`/`inNewPw` 补 `maxlength=64` 对齐后端 `max(64)`；`authPwd` placeholder 更新完整策略；i18n `authErrPwd` 双语更新（弱口令黑名单仍留服务端单源，避免双源漂移）；新增 web-auth-policy 守卫 5 断言（先红后绿） |
| v2.226.0 | `jsonOrThrow` 错误信息脱敏回落层（v2.216 后端 500 契约的前端配套补完）：内部裸码（`INTERNAL_ERROR`/`SERVER_BUSY`/无 body 5xx）回落本地双语友好文案（zh「服务开小差了，请稍后重试」/ en "Server hiccup — please retry later."），`e.error`/`e.httpStatus` 保留原码与状态码供分支；语言读取经 `znLangEn()` 直读 localStorage `zn_lang`（与 room-view 同源，零依赖 app.js）；业务错误码/IDEMPOTENT_REPLAY/4xx 语义零变更（`Object.assign(e,d)` 的 message 覆盖契约保留）；新增 web-api-sanitize 守卫 6 断言（先红后绿） |
| v2.225.0 | toast 三入口统一（纯前端，无 API 变更）：`znToast(msg, kind)` 重写为 v2.186 富版薄封装（kind 默认 info，签名向后兼容），`#znToastHost` 双 host 与 `.zn-toast` 样式退役（-14 行死样式）；`xnSay(line, tip, kind)` / `Xn.toast(m, kind)` 透传语义，view js 34 处分级——room-view 15 error、teardown-view 10 error+5 ok、diversity-view 3 error，**错误红条/成功绿条首次贯通独立视图**；window 新暴露 `toastError/toastOk/toastInfo`；`_syncTopbarOffset` Toast 分支改指 `#toastStack`（v2.191 让位只覆盖旧 host 的富版压顶缺口一并修复）；新增 web-toast-unify 守卫 8 断言 |
| v2.224.0 | 错误态第二轮扫尾（纯前端，无 API 变更）：app.js 9 处旧式失败态收口——loadCatalog×2 muted→znError、反馈箱 catch muted→znErrorHtml、买家详情 muted→znErrorHtml 并落实 **INTERNAL_ERROR 回落本地友好文案**（v2.216 契约速查首次在详情页落地）、listen 弹窗 3 处 segBox textContent→znErrorHtml（token 防竞态保留）、PK 榜→znErrorHtml、超管 API 目录 admApiDir→znError（骨架屏占位替换）；**三态统一体系勘察收口**：六个独立 view js（progress-view/tool-lesson/ad-roll/nav-stack/pointer-fx/staff-cost）逐一过筛——progress-view 为零依赖纯函数状态机（浏览器/Node 单测共用）刻意不接入 window 帮助函数，其余五文件无旧式三态写法，收口范围到此完备 |
| v2.223.0 | 错误态统一（纯前端，无 API 变更）：新增 `znErrorHtml/znError`（与 .zn-empty 同构：⚠+文案+可选细节 hint，`role=alert`，`_znEsc` 转义，window 暴露供 view js 复用）；14 处旧式错误/加载/空态收口——app.js 11 处（2 处 notice err、2 处 p.muted 当错误用、2 处内联 danger 边框 hack、2 处 muted 加载态改骨架屏、3 处旧空态改 znEmpty）、room-view 历史失败态不再冒充记录卡片（`histFail` 键首次接线）、teardown-view 2 处失败态收口；styles.css 新增 `.zn-error`（`--danger` 三主题令牌） |
| v2.222.0 | 独立 view js 接入统一加载/空态（纯前端，无 API 变更）：room-view（编剧室历史 骨架屏+znEmptyHtml）、teardown-view（拆解记录 骨架屏+znEmptyHtml）、diversity-view（多样性对比 骨架屏）、branch-view（节点检视空态 znEmptyHtml）共 6 处旧纯文本/muted 写法收口；run-tests.cjs 默认 `--test-concurrency=4` 根治高负载 flaky（PENDING #13） |
| v2.221.0 | 加载/空态统一（纯前端，无 API 变更）：新增 `znSkeletonHtml/znSkeleton/znEmptyHtml/znEmpty` 统一帮助函数（window 暴露，独立 view js 可复用）；14 处加载态改骨架屏（复活此前零使用的 `.skeleton/.sk-list` 体系，shimmer 改中性灰 light/dark 自适应）；10 处空态统一 `.zn-empty`（图标+文案+可选引导，`role=status`）；CSS 常量零变更、HTML 结构由帮助函数统一产出 |
| v2.220.0 | 模态统一收口（纯前端交互/a11y，无 API 变更）：18 个 `.modal-mask` 弹窗幂等补 `role=dialog`/`aria-modal`；openModal 焦点入模态、closeModalEl 焦点恢复；全局 Esc 关最上层可见模态（dpModal 专属 Esc 移除）；workbench ESC 退级对打开模态让位（hasOverlay 补 `.modal-mask:not(.hidden)`）；listenModal 关闭清理经 `setModalCloseHook` 钩子（listenFinish 只停播清态，旧双轨点击监听移除）；openAuth/closeAuth 走收口入口（登录弹窗开即聚焦） |
| v2.219.0 | 前后端能力对齐：web 端补齐 4 处「后端有、前端无入口」——广告位管理标签页（/api/ads/admin/* CRUD）、全量投稿渠道展开（/api/submission/channels）、用户行操作 admin-flag、知识条目归档/恢复；后端 API 无变更 |
| v2.218.0 | 请求体错误契约：坏 JSON 400「请求体格式错误」/ 超 12mb 413「请求体过大」（原 500 INTERNAL_ERROR）；新增 `TRUST_PROXY_HOPS` 部署变量（默认 1）解析 X-Forwarded-For 真实客户端 IP，保障 IP 维度限流准确 |
| v2.217.0 | 注册与改密暴力防护：`/register` 同 IP 15min 成功注册 5 个后 429「注册过于频繁」（失败探测不计数）；`/change-password` 当前密码连错 5 次 429「尝试过于频繁」，成功改密清零。前端无 API 变更，仅新增 429 场景 |
| v2.216.0 | 500 错误脱敏：12 处动态异常消息直回（admin-model×10/knowledge/export）统一为 `INTERNAL_ERROR`；详情只进服务端日志；前端导出失败提示对 `INTERNAL_ERROR` 回落本地文案 |
| v2.215.0 | 分页统一契约（见上）；`healths`→`items`；`/market/listings` 裸数组→包裹；board total 修复 |
| v2.214.0 | 自助修改密码端点 + 资料页入口 |
| v2.213.0 | 未知路由 404 JSON 化（`NOT_FOUND`） |
| v2.156 | 体检列表 `limit=200` 拉满铁律 + 响应带 total 截断提示 |

---

## 四、适配守则（新功能开发）

1. 新增列表端点一律用 `parsePageParams()`，响应六键齐全，列表键只用 `items`
2. `total` 必须是过滤后真总数；如必须截断，用 take 硬帽并在注释登记（家族铁律）
3. 前端消费分页响应一律走 `items` + `total`，禁止依赖响应键顺序或旧键名
4. 破坏性契约变更必须：同步 `web/` 调用点 + 同步测试 + 在本文件登记迁移对照
