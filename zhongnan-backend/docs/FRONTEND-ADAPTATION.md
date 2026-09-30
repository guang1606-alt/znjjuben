# 前端适配文档（FRONTEND-ADAPTATION）

> 面向前端（`web/` 原生 JS 站点及后续独立前端/移动端）的后端 API 契约与适配说明。
> 后端每次破坏性契约变更都会在此登记：变更内容 → 迁移对照 → 前端已同步点。
> 版本对齐 `package.json`，当前基线：**v2.216.0**。

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

### 不在本契约范围的端点（维持原语义）

| 端点 | 形态 | 说明 |
|---|---|---|
| `GET /api/market/board` | `{ type, total, items }` | top-N 榜单；v2.215 修复 `total` 为过滤后真总数（`limit` 只裁 items，take 500 截断硬帽） |
| `GET /api/tags/search`、`/api/tags/leaves` | 裸数组 | top-N 搜索/热榜，无翻页需求 |
| `GET /api/generate/*-assets`（列表） | `{ assets, total }` | 硬帽列表（take 200 + total 截断提示铁律），非分页端点 |
| `GET /api/community/posts` 等 | 裸数组 | 简单列表，暂未纳入统一 |

---

## 二、v2.215.0 迁移对照（旧 → 新）

| 变更点 | 旧 | 新 |
|---|---|---|
| 体检列表键 | `resp.healths` | `resp.items`（`healths` 键已退役） |
| 体检响应分页元信息 | `{ total, limit, offset }` | 补齐 `page`、`pageSize`（limit/offset 保留） |
| 广场列表 `GET /api/market/listings` | **裸数组** `[{...}]`，take 50 静默截断 | `{ items, total, page, pageSize, limit, offset }`，可传 `limit/offset` 翻页 |
| admin 用户列表响应 | `{ items, total, page, pageSize }` | 补齐 `limit`、`offset` 回显（旧字段全保留） |

### `web/` 已同步点（与后端同仓库同版本发布）

- `web/app.js` 三处资产体检面板：`health.healths` → `health.items`（6 处读取）
- `web/app.js` `loadListings()`：`Array.isArray(j)` → `Array.isArray(j.items)` + `list = j.items`
- 体检面板调用已固定 `limit=200` 拉满（v2.156 铁律），契约变更不影响该用法

---

## 三、既有 API 约定速查（前端需持续遵守）

### 错误响应

- 所有错误均为 JSON：`{ "error": "ERROR_CODE" | "人类可读文案" }`，绝不返回 HTML 或堆栈
- 未知 `/api/*` 路由：`404 { "error": "NOT_FOUND" }`（v2.213 起）
- **500 一律 `{ "error": "INTERNAL_ERROR" }`**（v2.216 起）：内部异常详情（Prisma/路径/供应商错误）只进服务端日志（`failInternal()` 统一出口），前端遇到 `INTERNAL_ERROR` 应显示本地友好文案而非错误码本身
- 统一兜底：`500 { "error": "INTERNAL_ERROR" }`
- `/api/*` 响应带 `Cache-Control: no-store`（防 token/个人信息落中间缓存）

### 鉴权与会话（`web/api.js` API 层）

- `Authorization: Bearer <accessToken>`；access 过期用 refresh 静默续期并重试一次
- token 持久化键：`zn_token` / `zn_refresh` / `zn_user`（localStorage）
- 自助修改密码：`POST /api/auth/change-password`（v2.214，前端资料页入口）

### 版本历史（前端相关变更登记）

| 版本 | 变更 |
|---|---|
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
