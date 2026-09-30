const { it, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_ACCESS_SECRET = 'asset-concurrency-access';
process.env.JWT_REFRESH_SECRET = 'asset-concurrency-refresh';
const { createApp } = require('../dist/server/app.js');
const { createGenerateRouter } = require('../dist/routes/generate.js');
const { signAccess } = require('../dist/lib/auth.js');
const { createMemoryPrisma } = require('./helpers/memory-prisma.cjs');

// The shared memory adapter has no row locks. Emulate PostgreSQL account locks
// here, while leaving writes outside a transaction concurrent and unprotected.
const mem = createMemoryPrisma();
const transaction = mem.$transaction.bind(mem);
const lockTails = new Map();
const kinds = [['character', 'persona', '_characterAssets'], ['prop', 'meaning', '_propAssets'], ['scene', 'meaning', '_sceneAssets']];
const delegates = Object.fromEntries(kinds.map(([kind]) => [kind + 'Asset', mem[kind + 'Asset']]));
let race;
function startRace() {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const timer = setTimeout(() => release(), 1000);
  race = { ready, arrivals: 0, arrive() { if (++this.arrivals === 2) { clearTimeout(timer); release(); } } };
  return race;
}
function delegate(model, insideTransaction) {
  return { ...model, async findFirst(args) {
    const snapshot = structuredClone(await model.findFirst(args));
    if (race) {
      if (!insideTransaction) race.arrive();
      await race.ready;
    }
    return snapshot;
  } };
}
for (const [name, model] of Object.entries(delegates)) mem[name] = delegate(model, false);
mem.$transaction = async (fn, options) => transaction(async tx => {
  assert.equal(options.isolationLevel, 'Serializable');
  const releases = [];
  const raw = { ...tx, ...Object.fromEntries(Object.entries(delegates).map(([name, model]) => [name, delegate(model, true)])),
    async $queryRaw(strings, userId) {
      assert.match(strings.join('?'), /PointsAccount.*FOR UPDATE/);
      race?.arrive();
      const previous = lockTails.get(userId) || Promise.resolve();
      let release;
      const next = new Promise(resolve => { release = resolve; });
      lockTails.set(userId, next);
      await previous;
      releases.push(() => { release(); if (lockTails.get(userId) === next) lockTails.delete(userId); });
      return [];
    },
  };
  try { return await fn(raw); } finally { for (const release of releases) release(); }
});

const server = createApp({ generate: createGenerateRouter(mem) }).listen(0);
let base;
before(() => new Promise(resolve => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); })));
after(async () => { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); await require('../dist/lib/prisma.js').prisma.$disconnect(); });
async function save(kind, uid, body) {
  const response = await fetch(`${base}/api/generate/${kind}-assets`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${signAccess({ sub: uid, level: 'BASIC' })}`,
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function seed(uid) { mem._seedUser({ id: uid, level: 'BASIC', balance: 100 }); }

for (const [kind, field, store] of kinds) {
  it(`${kind}: simultaneous same-name creates return one success and one conflict without overwriting`, async () => {
    const uid = `${kind}-create`; seed(uid);
    startRace();
    let results;
    try {
      results = await Promise.all([
        save(kind, uid, { name: '并发新建', [field]: '第一份设定' }),
        save(kind, uid, { name: '并发新建', [field]: '第二份设定' }),
      ]);
    } finally { race = null; }
    assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
    const rows = mem[store].filter(x => x.userId === uid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][field], results.find(x => x.status === 200).body.asset[field]);
    assert.match(results.find(x => x.status === 409).body.error, /_ASSET_NAME_CONFLICT$/);
    assert.equal(mem._accounts.get(uid).balance, 100, 'asset saves must not charge points');
  });

  it(`${kind}: simultaneous renames preserve both IDs and the losing asset contents`, async () => {
    const uid = `${kind}-rename`; seed(uid);
    const a = (await save(kind, uid, { name: '原名甲', [field]: '原稿甲' })).body.asset;
    const b = (await save(kind, uid, { name: '原名乙', [field]: '原稿乙' })).body.asset;
    startRace();
    let results;
    try {
      results = await Promise.all([
        save(kind, uid, { id: a.id, name: '共同新名', [field]: '甲修订' }),
        save(kind, uid, { id: b.id, name: '共同新名', [field]: '乙修订' }),
      ]);
    } finally { race = null; }
    assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
    const winner = results.find(x => x.status === 200).body.asset;
    const loser = winner.id === a.id ? b : a;
    const rows = mem[store].filter(x => x.userId === uid);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter(x => x.name === '共同新名').length, 1);
    assert.equal(rows.find(x => x.id === loser.id).name, loser.name);
    assert.equal(rows.find(x => x.id === loser.id)[field], loser[field]);
    const revised = await save(kind, uid, { id: winner.id, name: winner.name, [field]: '原记录再次修订' });
    assert.equal(revised.status, 200);
    assert.equal(revised.body.updated, true);
    assert.equal(revised.body.asset.id, winner.id);
  });

  it(`${kind}: same names across users remain valid while foreign and missing IDs return 404`, async () => {
    const owner = `${kind}-owner`, other = `${kind}-other`; seed(owner); seed(other);
    const a = (await save(kind, owner, { name: '各自同名', [field]: '所有者内容' })).body.asset;
    const b = await save(kind, other, { name: '各自同名', [field]: '另一用户内容' });
    assert.equal(b.status, 200);
    assert.notEqual(a.id, b.body.asset.id);
    assert.equal((await save(kind, other, { id: a.id, name: '越权改名', [field]: '不能覆盖' })).status, 404);
    assert.equal((await save(kind, owner, { id: 'missing-id', name: '不存在', [field]: '不能新建' })).status, 404);
    const row = mem[store].find(x => x.id === a.id);
    assert.equal(row.name, '各自同名');
    assert.equal(row[field], '所有者内容');
  });
}
