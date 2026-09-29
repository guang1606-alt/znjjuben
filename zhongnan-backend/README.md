# 终南编剧AI · 后端服务（可上线主链路版）

配套前端 v0.95.x。完整上线步骤见 [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)，架构见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。

## 已实现（真实代码，非占位）
- **定价** `config/pricing.ts`：严格对齐 PRD（月卡39/99/299、100集=100元=1000积分、超量1/0.8/0.5元、佣金15/10/5%）；引擎档位升级补差价，保证任何组合“售价≥成本×2”，启动机器校验
- **积分账本** `lib/billing.ts` + `lib/prisma-tx.ts`：复式流水、冻结/结算/失败退款、幂等防多扣、赠送上限、Serializable 事务+行锁防并发超扣
- **模型黑盒** `lib/model-proxy.ts`：OpenAI 兼容（火山方舟/GPT-image），密钥仅服务端、按 usage 算真实成本、毛利熔断
- **创作管线** `agents/pipeline.ts`：六岗位+双校验，SSE 进度
- **路由**：认证(注册/登录/刷新/邀请绑定)、创作(免费每日3集/付费冻结结算)、增值(海报/PK/小南)、订单(下单+支付回调验签+幂等发货)、反馈工单
- **数据模型** `prisma/schema.prisma`：20+ 表

## 协作者本地启动（从仓库拉代码后照此走通）
前置：Node.js 20+（推荐 22）、PostgreSQL 16（本地空库即可）。
```bash
cp .env.example .env          # 至少填：DATABASE_URL、JWT_ACCESS_SECRET、JWT_REFRESH_SECRET、CONFIG_SECRET（均≥16位）
npm ci
npx prisma generate
npx prisma db push            # 本仓库无 migrate 历史，用 db push 对齐 schema
npm run build                 # tsc 编译，类型零错误
npm test                      # 全量回归（node scripts/run-tests.cjs test/，5000+ 用例须全绿）
PORT=8899 node dist/index.js  # 勿用默认 8080（易端口占用）；浏览器开 http://localhost:8899
```
- 前端为 `web/` 纯静态站，由服务同源托管，**零构建**；改 `web/app.js`/`styles.css` 刷新即生效。
- 首次启动自动引导创建唯一超级管理员主账号（手机号硬编码，见 `.env.example` 说明；密码可用 `SUPER_ADMIN_INIT_PASSWORD` 指定）。
- 测试用 `NODE_ENV=test`，`.cjs` 用例引用 `dist/`，故改 TS 后须先 `npm run build` 再跑测试；严禁 `--test-force-exit`。

## 自检
```bash
npm run build && npm test     # 类型零错误 + 全量用例通过，是提交前的硬门槛
```

## 上线还需你提供（代码无法替代）
1. 各档模型密钥（文本+图片，填 .env，后台黑盒）
2. 服务器 + 域名
3. 微信/支付宝商户号与证书（支付回调验签当前为内置占位，上线前须换官方 SDK）

## 尚未接入的能力
三方 OAuth、OSS（海报图片转存永久 URL）、外部任务队列、敏感词审核（数据模型与规范已备好，见 DEPLOYMENT 第0/7节）。社区、剧本市场与担保放款、管理后台 RBAC 均已在 `src/routes/` 落地，勿重复建设。
