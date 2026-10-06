-- Run once against the production database before deploying the v2.316 server.
-- v2.316：同一用户同一等级只允许一条「在保」会员行，堵支付并发回调双 create
-- （deliverPaidOrder 无在保行时两单并发都走 create → 重复行 → 额度重复计算/续费锚点歧义）。
-- 应用侧败者撞 P2002 后整事务回滚并重试，重跑走同档续期路径把时长追加到先建者行上。
--
-- 建索引前若历史上已产生同档重复在保行，本语句会失败；先执行以下查重，
-- 人工把重复行合并为一条（expireAt 取各行购买周期叠加后的最晚值，quota 取最新单）：
--   SELECT "userId", level, COUNT(*)::int AS n
--   FROM "Membership"
--   WHERE "expireAt" > now()
--   GROUP BY "userId", level
--   HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS membership_active_user_level_uniq
  ON "Membership" ("userId", "level")
  WHERE "expireAt" > now();
