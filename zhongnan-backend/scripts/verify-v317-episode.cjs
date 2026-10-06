const { PrismaClient } = require('@prisma/client');
const pid = process.argv[2];
const tid = process.argv[3];
async function main() {
  const p = new PrismaClient();
  const s = await p.$queryRawUnsafe('SELECT "epNo","version","title",length("content") AS len, left("content",500) AS head, "content" LIKE \'%林晚%\' AS has_linwan, "content" LIKE \'%陈总%\' AS has_chenzong, "content" LIKE \'%保洁%\' AS has_baojie FROM "Script" WHERE "projectId"=$1 ORDER BY "version" DESC LIMIT 2', pid);
  for (const r of s) {
    console.log('--- SCRIPT ep', r.epNo, 'v', r.version, r.title, 'len=', r.len, '沙盘痕迹 林晚=', r.has_linwan, '陈总=', r.has_chenzong, '保洁=', r.has_baojie);
    console.log(r.head);
  }
  const logs = await p.$queryRawUnsafe('SELECT "role","engineTier","modality","tokensIn","tokensOut","costFen","createdAt" FROM "ModelCallLog" WHERE "taskId"=$1 ORDER BY "createdAt"', tid);
  console.log('--- ModelCallLog rows=', logs.length);
  for (const l of logs) console.log(l.role, l.engineTier, l.modality, 'in=', l.tokensIn, 'out=', l.tokensOut, 'costFen=', l.costFen, l.createdAt?.toISOString?.());
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
