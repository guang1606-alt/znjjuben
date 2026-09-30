# 终南编剧AI · 后端与同源前端

Express + TypeScript + Prisma；原生 JavaScript 前端位于 `web/`，由后端同源托管。部署说明见 [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)，架构见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。

## 当前实现与边界

- **认证与权限**：注册、登录、刷新令牌、邀请绑定及管理路由；生产环境需配置 JWT 密钥。
- **创作与编辑**：标签创作、采访式创作、SSE 进度、剧集版本、角色/道具/场景资产编辑及导出。
- **积分账本**：冻结、结算、失败退款、幂等流水与数据库事务；定价规则见 `src/config/pricing.ts`。
- **模型调用**：`src/lib/model-proxy.ts` 对接兼容网关；未配置供应商时走沙盘兜底，不能据此认定真实模型已接通。
- **支付未接通**：商品目录可查看；`POST /api/order/create` 在有效商品请求下返回 `503 PAYMENT_NOT_CONFIGURED`，不创建待支付订单；支付回调保持关闭。真实下单、官方验签/解密、金额核验与到账链路仍需接入并验证。

本地演示与自动化测试不能替代生产数据库、真实模型或支付渠道的联调。

## 安装与自检（Windows PowerShell）

在本目录执行；`.cmd` 后缀可避免 PowerShell 的脚本执行策略拦截：

```powershell
npm.cmd ci
npx.cmd prisma generate
npm.cmd run build
npm.cmd test
```

`npm test` 使用 `scripts/run-tests.cjs` 统一设置测试环境并展开测试目录，支持 Windows。测试读取 `dist/`，修改 TypeScript 后应先构建再运行；通过数量以当次测试输出为准。

## 本地演示

```powershell
npm.cmd run demo
```

该命令先构建再启动演示服务，默认地址为 `http://127.0.0.1:8099`（可用 `PORT` 环境变量覆盖）。演示使用内存数据，**重启即清空**，无需 PostgreSQL，仅供本地功能走查。

未配置模型供应商时，文字生成返回固定的 SANDBOX 示例稿，不代表系统已根据输入完成真实 AI 创作；图片等依赖外部服务的功能也不能据此验证。演示账号与数据不得用于生产。

## 生产配置要点

- 按 `.env.example` 配置 `DATABASE_URL`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`CONFIG_SECRET` 及模型网关。
- 创建超管账号或为其补设密码前，必须显式配置 `SUPER_ADMIN_INIT_PASSWORD`，去除首尾空白后至少 12 位。未配置或过短时拒绝创建/补设；已有正常密码不会被覆盖。生产超管没有内置默认口令，保留手机号也不能通过公开注册取得权限。
- 支付渠道仍需完成代码接入及实际联调，仅填写商户参数不会开启收款。发布前须分别验证生产数据库、真实模型、支付与退款链路。
