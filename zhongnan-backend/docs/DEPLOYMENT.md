# 终南集·AGI编剧大师 v2.78.0 · 部署与运维手册

> Express 4 + TypeScript（CommonJS，编译到 dist/）+ Prisma 5 + PostgreSQL 生产 / 内存桩 demo；前端为零构建原生 JS，由后端**同源托管** web/。改 `src/*.ts` 后必须 `npm run build`（demo 跑 dist）。

## 0. 当前能力与安全基线（v2.78.0）
- 认证：argon2id、JWT 短访问+刷新；**生产环境缺 JWT 密钥直接拒绝启动**；bannedGuard 30 秒缓存封禁拦截（含持旧令牌）。
- 金钱：积分复式账本、Serializable+行锁、冻结/结算/退款；会员发货时长叠加/同卡复用/只升不降；所有付费动作（创作/PK/海报/小南/选题会/围读/拆爆款/管理调分）支持 `Idempotency-Key` 头或 `clientToken` 幂等，撞车返回 409 且不重复扣费。
- 交易：担保托管、确认收货放款、24h 自动放款（每小时幂等 cron）、佣金；上架/详情/购买全程归属校验（IDOR 已修）。
- 支付尚未接通：有效商品的下单请求返回 `503 PAYMENT_NOT_CONFIGURED`，不创建待支付订单；微信/支付宝回调保持拒绝状态。上线收款前必须完成渠道下单、官方验签/解密和金额核验（见第 7 节）。
- 创作：SSE 六岗位流式进度；免费档每日 2 集原子占坑（含在途 QUEUED/RUNNING）；模型网关重试每次新建 AbortController、图片供应商返回结构异常可识别并退款。
- 测试入口：先 `npm run build` 再 `npm test`；统一入口兼容 Windows，并设置测试环境。通过数量以当次输出为准，内存桩/沙盘回归不等于生产数据库、真实模型或支付链路验证。

## 1. 服务器与环境
- Ubuntu 22.04、Node.js 20、PostgreSQL 16、Nginx、pm2（当前无 Redis 强依赖；限流/队列接入时再装）
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx
sudo npm i -g pm2
```

## 2. 数据库
```bash
sudo -u postgres psql -c "CREATE USER zhongnan WITH PASSWORD '强密码';"
sudo -u postgres psql -c "CREATE DATABASE zhongnan OWNER zhongnan;"
git clone <repo> /opt/zhongnan-backend && cd /opt/zhongnan-backend
cp .env.example .env && chmod 600 .env   # 按第 3 节填写
npm ci
npx prisma generate
npx prisma db push      # 本仓库无 migrate 历史；PostLike 等表随 schema 一并建好
```
后续 schema 变更同样 `npx prisma db push`；**push 前先跑 `scripts/backup-db.sh`**。

## 3. 必填环境变量
以 [.env.example](../.env.example) 为准（已按代码实际读取整理），要点：
- `JWT_ACCESS_SECRET / JWT_REFRESH_SECRET`：`openssl rand -hex 32` 各一份（生产强制 ≥16 位）
- `CONFIG_SECRET`：落库供应商配置的加密密钥，`openssl rand -hex 32`
- `SUPER_ADMIN_INIT_PASSWORD`：首次创建超管或补设密码时必须显式提供，去除首尾空白后至少 12 位；没有内置默认口令。已有正常密码不会被覆盖，保留手机号不可公开注册。
- 模型：`MODEL_GATEWAY_BASE_URL`、`MODEL_TEXT_ECONOMY/STANDARD/FLAGSHIP_KEY` 与 `MODEL_ECONOMY/STANDARD/FLAGSHIP`；图片 `MODEL_IMAGE_STANDARD_KEY/_STANDARD`、`MODEL_IMAGE_FLAGSHIP_KEY/_FLAGSHIP`，图片网关可单独用 `MODEL_IMAGE_GATEWAY_BASE_URL`
- 支付：当前下单与回调关闭；仅填写支付环境变量不会启用收款，必须先完成第 7 节的渠道接入与联调。
- `CORS_ORIGINS`：同源托管可留空；跨域填前端来源白名单

## 4. 一键部署与守护
```bash
npm run build
pm2 start ecosystem.config.cjs          # 或直接 ./scripts/deploy.sh 走完整流水线
pm2 save && pm2 startup
```
- [ecosystem.config.cjs](../ecosystem.config.cjs)：cluster 2 实例、600M 重启、日志 logs/；实例数用 `PM2_INSTANCES=N` 覆盖
- [scripts/deploy.sh](../scripts/deploy.sh)：npm ci → prisma generate → tsc 编译 → npm test → db push → pm2 reload → 健康检查，任何一步失败即中止。测试使用当前源码的构建产物；脚本和健康探针成功不代表真实业务链路已经验证。
- 更新版本：拉代码后 `./scripts/deploy.sh`（pm2 reload 零停机）

## 5. Nginx + HTTPS（SSE 必须关缓冲）
```nginx
server {
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;          # SSE 必需
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```
前端零构建、API 与页面同端口同域，**不需要单独部署前端站点**。`sudo certbot --nginx -d your-domain.com` 上 HTTPS。

## 6. 健康检查与备份
- 健康探针：`GET /health` → `{ok:true,ts}`；[scripts/healthcheck.cjs](../scripts/healthcheck.cjs) 退出码 0/1，可挂 cron / 负载均衡 / 监控：
```bash
node scripts/healthcheck.cjs                 # 默认 127.0.0.1:8080
*/2 * * * * cd /opt/zhongnan-backend && node scripts/healthcheck.cjs >> logs/health.log 2>&1 || pm2 reload zhongnan-api
```
- 数据库备份：[scripts/backup-db.sh](../scripts/backup-db.sh)（pg_dump|gzip，默认保留 14 天，恢复命令写在脚本尾部）
```bash
17 3 * * * cd /opt/zhongnan-backend && ./scripts/backup-db.sh >> logs/backup.log 2>&1
```
- 模型成本监控：[scripts/cost-report.cjs](../scripts/cost-report.cjs) 基于 ModelCallLog 汇总成本/计价/token 与毛利倍数，自动揪出 `price<2×cost` 违约；`WARN_FEN` 超阈值退出码 2，可接告警：
```bash
npm run cost:report -- --json          # 近 1 天 JSON
DAYS=7 npm run cost:report             # 近 7 天
30 9 * * * cd /opt/zhongnan-backend && WARN_FEN=2000 node scripts/cost-report.cjs >> logs/cost.log 2>&1
```
- 业务侧运营数据：管理后台 `GET /api/admin/stats/overview`、`GET /api/admin/finance/overview`（需超管 JWT）。

## 7. 上线收款前必办
1. 在 [src/routes/order.ts](../src/routes/order.ts) 接入真实渠道下单、官方 SDK 验签/资源解密、订单归属与金额核验、幂等发货；验证完成前保持当前下单 `503` 与回调拒绝行为。回调地址 `https://域名/api/order/notify/*`
2. 火山方舟/OpenAI 各档密钥与模型名填 env，先小额沙箱验证：下单→支付→回调→积分到账→生成扣费/海报退款 全链路
3. 配置 CONFIG_SECRET 后不要轮换丢失（旧加密配置无法解密）

## 8. 上线检查清单
- [x] argon2id；登录不区分“用户不存在/密码错”；生产 JWT 强制密钥；banned 全 API 拦截
- [x] 账本事务/行锁/幂等；价格服务端 assertNoLoss 启动熔断；未接通支付保持关闭；IDOR 归属校验
- [ ] 生产数据库、真实模型和支付/退款链路完成实际联调与验收（本地演示及自动化回归不能代替）
- [x] zod 入参、Prisma 参数化、全局错误处理不泄漏堆栈、CORS 白名单、前端 XSS 转义与 javascript: 链接拦截
- [ ] 运维待补：全站接口限流（express-rate-limit，登录/下单更严）、注册密码强度策略、广告点击计数鉴权、refresh 令牌轮换、全局 12MB JSON 限额按路由细化、HTTPS 强制、日志脱敏、备份异地、WAF/告警（ModelCallLog 成本阈值、负载 >80%）

## 9. 日常运维速记
```bash
npm run build                          # 测试读取 dist，先构建当前源码
npm test                               # 发布前回归（Windows 也使用统一入口）
npm run typecheck                       # 类型检查
pm2 logs zhongnan-api                   # 实时日志（logs/err.log、logs/out.log）
node scripts/healthcheck.cjs            # 存活探针
./scripts/backup-db.sh                  # 手工备份
# 本地内存桩 demo（默认 8099 端口，先构建再启动）：
npm run demo
```
Windows PowerShell 如遇脚本执行策略限制，使用 `npm.cmd run build`、`npm.cmd test`、`npm.cmd run demo`。演示数据重启即清空；未配置模型供应商时，文字生成使用固定 SANDBOX 示例稿，仅可走查页面与本地链路，不能验证真实生成质量。
演示账号仅用于本地测试，登录信息见演示启动终端；生产超管必须按第 3 节单独配置，不能沿用演示凭据。
