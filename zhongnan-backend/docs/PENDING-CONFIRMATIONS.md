# 待用户确认清单

> 单一事实源：所有需要用户拍板的事项登记于此，每日复盘报告自动回显；开发中不打断用户，用户上手操作时统一提醒处理。

## 1.【高】远程分支 `剧本1` 是否合并进 master
- 来源：gitee 远程新分支（他人推送），领先 master 2 个提交
  - `2fee59d` 同步 2026-09-29 本地修改：界面显示、移动端布局与演示数据修复
  - `05d1002` 完善剧本交易交付与查看链路
- 建议：内容为界面/交易链路完善，大概率无冲突；请确认后执行 `git merge gitee/剧本1` 并跑 `npm test` 全量

## 2.【高】火山方舟模型名/接入点核验（实调 404）
- 现象：`doubao-seed-2-1-pro` 实调报 404 InvalidEndpointOrModel.NotFound
- 原因：方舟部分模型需填接入点 ID（`ep-xxx`）而非模型名
- 操作：到火山方舟控制台核对「豆包 Seed 2.1 Pro」的接入点，在超管后台「供应商池」把该供应商的 model 字段改成接入点即可，无需改代码；其余 12 个供应商建议实跑创作逐个验证

## 3.【中】海外档（GPT-5/Claude/Gemini）API 未提供
- 现状：三档引擎（经济/标准/旗舰）已全国产化、可正常售卖；海外档不在售卖列，自然拒售，不影响业务
- 如需开通海外档：提供对应 API Key，在超管后台「五档密钥」填入即可

## 4.【低】多人与省 token 协作约定（请过目，默认生效）
1. 每日开工先跑 `node scripts/daily-review.cjs`（或直接看 `docs/daily-review/` 最新报告）——看完报告即掌握仓库全景，不重扫代码
2. 测试默认单文件先行（`npm test test/xxx.test.cjs`；注意 `npm test` 本身已含 `test/`，追加文件名会变成全量双跑）
3. 需要用户确认的事项一律登记本清单，开发中不打断；用户上手时统一处理
4. 新会话先读最近一份 daily-review 报告 + 本清单，再动手，避免重复性探索
5. 供应商等敏感配置只在超管后台/API 操作：密钥加密落库、不入 git、不下发前端

## 5.【低】多人协作的 git 身份区分
- 现状：本机所有提交作者均为 `123 <a123@yangguangdeMacBook-Pro.local>`（自动生成），多位协作者共用一台机器时无法从提交记录区分是谁做的
- 建议：为每位协作者配置独立 `git config user.name/user.email`（或至少给本机配一个正式身份），每日复盘报告的"协作动态"才能按人统计

## 6.【中】支付接口接入（order.ts 占位符）
- 现状：`src/routes/order.ts` 的下单接口返回 `payParams: 'TODO_CALL_PROVIDER'`，未对接微信/支付宝
- 如需上线收款：提供商户号/密钥，在 order.ts 注入真实下单逻辑

## 7.【中】投稿渠道联系方式核验（12 个平台）
- 现状：`src/config/submission-channels.ts` 中 12 个投稿平台的 `contact.detail` 均为空，前端已显式标注"联系方式待核验"
- 操作：运营到各平台官方入口核验对接方式后，在该文件填入 `detail` 并写 `verifiedAt`（ISO 时间）；前端自动切换为"已核验"徽章
- 说明：投稿渠道匹配功能已上线（v2.195），即使联系方式未核验，题材适配推荐也可用

## 8.【已完成】养正主仓库每日复盘机制
- 现状：已移植 `scripts/daily-review.cjs` 到养正主仓库（适配 Python 后端 + TS 前端结构），每日产出 `docs/daily-review/YYYY-MM-DD.md`
- 用法：`node scripts/daily-review.cjs`
- 说明：待确认清单仍以本文件为单一事实源，养正报告自动回显
- 自动化（2026-09-30 落地）：macOS launchd 任务 `com.yangzheng.daily-review` 每天 08:25 自动生成两仓库报告（plist：`~/Library/LaunchAgents/com.yangzheng.daily-review.plist`；日志：`~/Library/Logs/repo-daily-review.log`）；日期按北京时间归属。只生成不提交，开发会话中顺手 commit，避免机器自动提交误纳入他人在途改动；如希望连提交推送也全自动，告知后可加

## 9.【中】WorkshopEnrollment 缺唯一键导致并发报名重复
- 现状：`workshop_service.enroll` 用 check-then-insert，但 `workshop_enrollments` 表无 `(student_id, course_id)` 唯一约束
- 已缓解（2026-09-29）：enroll 改为先 `SELECT ... FOR UPDATE` 锁课程行再查再插，同课程并发报名在行锁上序列化，重复行与 student_count 双倍递增已消除；测试 `test_workshop_enroll_concurrent_lock`（真并发 gather）验证通过
- 残留建议（仍待确认）：行锁是代码级缓解，唯一约束才是数据级兜底；确认后加迁移 `UniqueConstraint("student_id", "course_id", name="uq_enrollment_student_course")`（加前需先清理历史重复行）

## 10.【低】养正 test_password_policy.py 全量运行时偶发计数不足（时间敏感 flaky）
- 现象：全量跑 893 测试时 4 条密码策略用例偶发 `assert 2 == 3`（登录失败计数少 1）；同文件单跑全过，双跑也全过，无改动全量跑全过，带改动复跑也全过
- 分析：失败登录计数存 Redis，全量运行时受前置用例耗时影响，疑似撞上登录限流窗口导致个别请求未走到计数分支；非功能缺陷
- 建议（可选）：密码策略测试前显式清限流键，或将 3 次失败登录的断言改为「计数 ≥2 且 ≤3」+ 单独校验递增逻辑；不阻塞业务
- 更新（2026-09-30）：实测另一类诱因是**两个 pytest 进程并行**（多会话同机各跑各的）：真并发/行锁用例会互等 DB 锁甚至挂起十余分钟，期间 Redis 计数用例也会被拖入异常时序。已在养正 backend 加 `conftest.py` 会话级 flock 串行锁，后启动的测试自动排队；再观察 #10 是否复现，若仍复现再按上面的建议改断言
- 更新（2026-09-30 晚）：代码核查确认登录路径**不存在独立限流器**，唯一计数键就是 `_fail_key`，且测试手机号本文件专用、fixture 前后都清键——并行互扰即为唯一实证诱因（flock 已根治）。同时按建议完成断言加固：两处错密循环逐次断言 HTTP 400 并带响应体，若再 flake 将直接显示是哪一次请求返回了非预期状态码（而非神秘的 2==3）。连跑 3 遍 13 条全过，转为观察项，无需用户操作
