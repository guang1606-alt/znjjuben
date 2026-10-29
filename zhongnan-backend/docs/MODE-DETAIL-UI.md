# 终南集 · 创作模式二级界面 — 交互逻辑与开发文档

版本：v2.344（配合 v3.1 Cinematic Editorial Journal 视觉系统）
适用文件：`web/index.html`、`web/app.js`、`web/styles.css`、`web/i18n.js`

---

## 1. 信息架构

```
创作专区（view-studio）
├── 一级界面（默认）：Hero + 公告位 + 模式网格（9 张模式卡）
│   └─ 只承担「选模式」一件事；不出現任何配置表单
└── 二级界面（点卡进入）：模式工作台
    ├── 头部：← 返回模式选择 ｜ 模式名 + 描述 ｜ 成本徽章
    ├── 主栏（mode-detail-main）：该模式的创作面板
    └── 侧栏（mode-detail-side，320px）：
        ├── ① 剧本类型（scriptTypeBar，侧栏顶部）
        ├── ② 模式说明块（side-block × N，方法论提示）
        ├── ③ 出本配置（genConfigBar：剧集/平台/语言/引擎/制式/资产/生成按钮，sticky 吸底）
        └── ④ 钩子编排（hookConsole）
```

设计原则：**一级纯净，二级按需**。配置项只在做创作决策的場景出现；每个模式二级界面的主栏内容由模式自己决定（`_MODE_PANEL_MAP` + `_renderModeBody`），侧栏配置字段也可按模式过滤（`_MODE_CONFIG_HIDE`）。

## 2. 跳转逻辑（showModeDetail / backToGrid）

### 进入二级：`showModeDetail(modeId)`（app.js L2477 起）

1. 隐藏一级主区：`section-title`、`#modeGrid`（`#scriptTypeBar` 一级默认已隐藏）
2. `closeWorkbench()` 关闭工作台浮层（panel 仍在 workbenchBody）
3. 所有模式 panel 防御性放回 workbenchBody（防上次异常残留）
4. `_restoreLevel2Config()` 还原出本配置（**必须在 step 5 之前**，否则 `innerHTML=''` 会销毁残留在 body 里的配置元素）
5. 清空 `modeDetailBody`，创建 `main` / `side` 两栏容器
6. `_MODE_PANEL_MAP[modeId]` 的既有 panel 移入 main（DOM move 保留事件绑定）
7. `_level2Remember()` 记录三配置原始挂载点 → `scriptTypeBar` 移入 side（顶部）
8. `_renderModeBody[modeId](modeId, main, side)`：无既有 panel 的模式动态渲染表单（diary/persona/duel/multiverse），所有模式渲染 side-block 说明
9. `genConfigBar`、`hookConsole` 移入 side（底部）→ `_applyModeConfigFilter(modeId)` 按模式隐藏无关字段
10. 注入模式名/描述/成本，`data-mode` 上 accent 色，`_modeDetailOpen = true`，焦点移到返回键

### 返回一级：`backToGrid()`

- 180ms 退出动画（`prefers-reduced-motion` 时同步完成）后 `_finish()`：
  - 模式 panel 放回 workbenchBody 并隐藏
  - `_restoreLevel2Config()`：三配置插回 `view-studio` 原始位置（`insertBefore` 原 nextSibling）**并保持 hidden**，清除全部 `mode-hidden` 过滤态
  - 恢复一级网格显示，重跑 `renderModes/renderScriptTypes/syncTagBench/syncModeBrief`

### Esc 优先级（capture 阶段）

`_modeDetailEsc` 在 document capture 拦截：二级界面打开时 Esc → `backToGrid()` 并 stopPropagation，优先级高于 workbench → modal → 导航栈返回。

## 3. 出本配置挂载机制

```js
const _LEVEL2_CONFIG_IDS = ['scriptTypeBar', 'genConfigBar', 'hookConsole'];
const _level2Homes = {};        // 首次移动前记录 {parent, next}，还原时原样插回
const _MODE_CONFIG_HIDE = {     // 按模式隐藏 genConfigBar 内字段（容器 id 或内部控件 id）
  auto:      ['engine'],        // 全自动：引擎档位交给意图路由
  interview: ['engine'],        // 采访式：先聊出东西，引擎由系统定
};
```

- 过滤用独立类 `.mode-hidden`（`display:none!important`），**不碰**字段自有 `hidden` 逻辑（如 AIGC 时长/画风字段按制式显隐由 `applyScriptTypeFormat` 管）
- 新增模式的过滤：往 `_MODE_CONFIG_HIDE` 加一行即可，key 是 `.field` 容器 id 或其内部第一个带 id 控件的 id
- 已知降级：后端离线时 `SCRIPT_TYPES` 为空，`renderScriptTypes` 会隐藏 `scriptTypeBar`，二级界面同样不显示剧本类型块 —— 属正常降级

## 4. 视觉系统（v3.1 Cinematic Editorial Journal）

| 层 | 规则 |
|---|---|
| 三主题 | `[data-theme='light'/'dark'/'eye']` 宣纸 / 影院墨 / 米黄卷宗；模式 accent 通过 `--mode-accent` / `--mode-accent-soft` 随主题沉郁化 |
| 二级头部 | 顶边 3px `--mode-accent` 色条 + 标题同色 |
| 侧栏配置卡 | 去 configbar 渐变外壳，单列 `gap:12px`；`#scriptTypeBar` 用 mode-accent-soft 底色区别于生成配置 |
| 生成按钮区 | `#genConfigBar` `position:sticky; bottom:12px`，滚动时常驻可视 |
| 动效 | 模式卡金色扫光 hover；二级 main/side 子元素 45ms 递进 `zn-fade-up` 错峰入场；全部 `@media (prefers-reduced-motion: reduce)` 关闭 |

## 5. 响应式断点

| 断点 | 行为 |
|---|---|
| ≤900px | 二级界面单列堆叠：main 在上、side 在下；`genConfigBar` 取消 sticky；头部 `flex-wrap` 允许换行；配置卡内边距收窄 |
| ≤768px | topbar 回退全宽浮条（既有规则）；`.field` 控件 100% 宽、字号 16px 防 iOS 缩放（既有规则） |

## 6. 开发指南

- **新增模式**：`I18N.MODES` 加条目 → `_MODE_PANEL_MAP` 指定既有 panel（或留空）→ `_renderModeBody` 加渲染器 → `styles.css` 加一行 `.mode-detail[data-mode="xxx"]` accent → （可选）`_MODE_CONFIG_HIDE` 配过滤
- **新增出本配置字段**：直接加进 `#genConfigBar`，一级界面不会出现；如需某模式隐藏，把字段容器/控件 id 加进该模式的 `_MODE_CONFIG_HIDE` 数组
- **不要**把配置元素的显隐逻辑再写回一级界面；一级只认 `hidden`
- vm 测试环境防御：任何引用 `_modeDetailOpen` 的外部函数必须用 `typeof _modeDetailOpen !== 'undefined'` 守卫（Observer 回调里已有先例）

## 7. 测试

- 回归测试：`test/web-mode-detail-config.test.cjs`（5 例：一级纯净 / 二级挂载 / 还原顺序 / 按模式过滤 / 连切不丢元素），AST 抽取 + 迷你 DOM 沙箱，形态同 `web-workbench-navigation.test.cjs`
- 全量：`NODE_ENV=test node scripts/run-tests.cjs` → 6236 pass / 0 fail（6250 total, 14 skipped）
