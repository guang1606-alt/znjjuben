# 终南编剧AI · 后端服务（可上线主链路版）

配套前端 v0.95.x。完整上线步骤见 [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)，架构见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。

## 已实现（真实代码，非占位）
- **定价** `config/pricing.ts`：严格对齐 PRD（月卡39/99/299、100集=100元=1000积分、超量1/0.8/0.5元、佣金15/10/5%）；引擎档位升级补差价，保证任何组合“售价≥成本×2”，启动机器校验
- **积分账本** `lib/billing.ts` + `lib/prisma-tx.ts`：复式流水、冻结/结算/失败退款、幂等防多扣、赠送上限、Serializable 事务+行锁防并发超扣
- **模型黑盒** `lib/model-proxy.ts`：OpenAI 兼容（火山方舟/GPT-image），密钥仅服务端、按 usage 算真实成本、毛利熔断
- **创作管线** `agents/pipeline.ts`：六岗位+双校验，SSE 进度
- **路由**：认证(注册/登录/刷新/邀请绑定)、创作(免费每日3集/付费冻结结算)、增值(海报/PK/小南)、订单(下单+支付回调验签+幂等发货)、反馈工单
- **数据模型** `prisma/schema.prisma`：20+ 表

## 自检
```bash
npm ci && npx prisma generate
npm run build                 # 类型0错误
node --test test/             # 金钱逻辑 9/9 通过
```

## 上线还需你提供（代码无法替代）
1. 各档模型密钥（文本+GPT-image，填 .env，后台黑盒）
2. 服务器（约1000–1500元/月）+ 域名
3. 微信/支付宝商户号与证书

## 待 Codex 同构补全
社区、交易担保、后台RBAC、三方OAuth、OSS、任务队列、敏感词审核（数据模型与规范已备好，见 DEPLOYMENT 第0/7节）。
