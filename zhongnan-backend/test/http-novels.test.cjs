const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
process.env.JWT_ACCESS_SECRET = 'novels-secret';
process.env.JWT_REFRESH_SECRET = 'novels-refresh';
const { createApp } = require('../dist/server/app.js');
const { createNovelSourcesRouter } = require('../dist/routes/novel-sources.js');

const app = createApp({ novels: createNovelSourcesRouter() });
let base;
const server = app.listen(0);
before(() => new Promise((res) => server.once('listening', () => { base = `http://127.0.0.1:${server.address().port}`; res(); })));
after(async () => { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); await require('../dist/lib/prisma.js').prisma.$disconnect().catch(() => {}); });

const M = '/api/novels';

describe('免费合法小说源 HTTP 纵切', { concurrency: 1 }, () => {
  it('GET / 全量：≥19源、含语言聚合与授权标签，全部https', async () => {
    const j = await (await fetch(base + M)).json();
    assert.ok(j.total >= 19);
    assert.ok(j.languages.includes('ko') && j.languages.includes('es'));
    assert.ok(j.sources.every((s) => s.url.startsWith('https://')));
    assert.ok(j.licenseLabels.public_domain.length > 0);
  });

  it('按语言+仅可改编筛选：韩文只命中含ko/multi且全部公版可改编', async () => {
    const j = await (await fetch(base + M + '?lang=ko&adapt=1')).json();
    assert.ok(j.total >= 1);
    assert.ok(j.sources.every((s) => s.adapt === true && s.license === 'public_domain'));
    assert.ok(j.sources.some((s) => s.id === 'wikisource-ko'));
  });

  it('关键词检索与 /languages、/validate 正常', async () => {
    const q = await (await fetch(base + M + '?q=' + encodeURIComponent('青空'))).json();
    assert.ok(q.sources.some((s) => s.id === 'aozora'));
    const langs = await (await fetch(base + M + '/languages')).json();
    assert.ok(Array.isArray(langs.languages) && langs.languages.find((x) => x.lang === 'zh').count >= 1);
    const v = await (await fetch(base + M + '/validate')).json();
    assert.strictEqual(v.ok, true);
    assert.deepStrictEqual(v.errors, []);
  });
});
