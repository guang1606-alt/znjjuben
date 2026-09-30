const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromeAvailable = fs.existsSync(chromePath);
const layoutTest = (name, fn) => test(name, { skip: !chromeAvailable }, fn);
const webRoot = path.join(__dirname, '..', 'web');
let chrome;
let cdp;
let userDataDir;
let server;
let serverPort;
const textareaCases = [
  ['sqBody', '交流广场 · 正文'],
  ['pitchIdea', '选题会 · 一句话创意'],
  ['readScript', '剧本围读 · 剧本文本'],
  ['tdText', '拆爆款 · 正文 / 字幕'],
  ['brGraph', '互动分支 · JSON 视图'],
  ['tbHeat', '热点简报 · 热点内容'],
  ['tbAngle', '热点简报 · 切入角度'],
  ['brMain', '分支简报 · 主线起点'],
  ['brChoice', '分支简报 · 关键选择'],
  ['sourceText', '素材改编 · 原始文本'],
  ['fbContent', '反馈弹窗 · 具体内容'],
  ['listSample', '剧本上架 · 示例文本'],
  ['castLibEditPersona', '动态角色资产 · 人设'],
  ['castLibEditSigs', '动态角色资产 · 标志性台词'],
  ['propLibEditMeaning', '动态道具资产 · 含义'],
  ['sceneLibEditMeaning', '动态场景资产 · 含义'],
];
const spacingCases = [
  ['square', '交流广场：标题 / 正文 / 发布按钮', 'sqBody', ['#sqTitle','#sqBody','#sqSubmit']],
  ['teardown', '拆爆款：来源 / 链接 / 正文', 'tdText', ['#tdSource','#tdUrl','#tdText']],
  ['read', '剧本围读：选择已有作品 / 剧本文本', 'readScript', ['#readPickBtn','#readScript']],
  ['result', '拆解结果：标签 / 改编方向', 'tdTags', ['#tdTags','#tdDirs']],
];
const catalogFixture = {
  items: [
    {sku:'BASIC_M',kind:'MEMBER',level:'BASIC',months:1,points:null,amountFen:3900,amountYuan:39},
    {sku:'BASIC_Y',kind:'MEMBER',level:'BASIC',months:12,points:null,amountFen:36500,amountYuan:365},
    {sku:'ADVANCED_M',kind:'MEMBER',level:'ADVANCED',months:1,points:null,amountFen:9900,amountYuan:99},
    {sku:'ADVANCED_Y',kind:'MEMBER',level:'ADVANCED',months:12,points:null,amountFen:99900,amountYuan:999},
    {sku:'PRO_M',kind:'MEMBER',level:'PRO',months:1,points:null,amountFen:29900,amountYuan:299},
    {sku:'PRO_Y',kind:'MEMBER',level:'PRO',months:12,points:null,amountFen:299900,amountYuan:2999},
    {sku:'PT_10',kind:'POINTS',level:null,months:null,points:100,amountFen:1000,amountYuan:10},
    {sku:'XSCRIPT_M',kind:'VALUE_ADDED',level:null,months:null,points:null,amountFen:9900,amountYuan:99},
  ],
  plans: [
    {level:'FREE',monthlyFen:0,freeEpsPerDay:2,overagePerEp:12,quotaMonthly:0,commission:0,engines:['ECONOMY'],label:'免费版',maxActiveProjects:2},
    {level:'BASIC',monthlyFen:3900,yearlyFen:36500,quotaMonthly:0,package100Fen:10000,overagePerEp:10,commission:15,engines:['ECONOMY','STANDARD'],label:'基础会员',maxActiveProjects:10},
    {level:'ADVANCED',monthlyFen:9900,yearlyFen:99900,quotaMonthly:300,overagePerEp:8,commission:10,engines:['ECONOMY','STANDARD','FLAGSHIP'],label:'高级会员',maxActiveProjects:30},
    {level:'PRO',monthlyFen:29900,yearlyFen:299900,quotaMonthly:1000,overagePerEp:5,commission:5,engines:['ECONOMY','STANDARD','FLAGSHIP'],label:'专业会员',maxActiveProjects:100},
  ],
  xScript: {monthlyFen:9900,perEpPoints:15,gating:'实名问卷+责任承诺+授权后开通',note:'按用户所在法域分级管控，违规内容一律拦截'},
  pointsPerYuan: 10,
  paymentAvailable: false,
};

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForJson(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  const ready = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  return {
    ready,
    close: () => socket.close(),
    async send(method, params = {}) {
      await ready;
      const requestId = ++id;
      const result = new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
      socket.send(JSON.stringify({ id: requestId, method, params }));
      return result;
    },
  };
}

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function setViewport(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Emulation.setVisibleSize', { width, height });
}

async function loadPage(width, height) {
  await setViewport(width, height);
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/index.html` });
  await delay(700);
}

async function mountAssetEditor(family) {
  await evaluate(`(() => {
    Api.isAuthed = () => true;
    Api.getUser = () => ({id:'layout-test-user'});
    Api.getToken = () => 'layout-test-token';
    const originalRequest = Api.request;
    Api.request = async (url, options) => {
      if (!url.startsWith('/api/generate/')) return originalRequest(url, options);
      const asset = {id:'layout-test-asset',name:'布局测试资产',persona:'用于验证输入框边界的人设',meaning:'用于验证输入框边界的含义',signatureLines:['布局测试台词'],tags:[],eps:[],closedEps:[],usedCount:0};
      const data = url.includes('/health') ? {healths:[{id:asset.id,score:60,level:'usable',advice:[]}],conflicts:[],total:1}
        : url.includes('/usage') ? {usage:{}} : {assets:[asset],total:1};
      return new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}});
    };
    document.querySelector('#${family}LibBtn').click();
  })()`);
  await delay(150);
  assert.ok(await evaluate(`!!document.querySelector('.${family}-lib-edit')`), `${family} library must render its real edit button`);
  await evaluate(`document.querySelector('.${family}-lib-edit').click()`);
}

async function revealTextarea(id) {
  await evaluate(`(() => {
    const el=document.getElementById(${JSON.stringify(id)});
    if (!el) throw new Error('Missing textarea: ${id}');
    document.querySelectorAll('main > [id^="view-"]').forEach(view=>view.classList.add('hidden'));
    if (el.closest('#workbenchLayer')) document.getElementById('view-studio').classList.remove('hidden');
    for (let p=el; p; p=p.parentElement) {
      p.classList.remove('hidden');
      if (p.tagName==='DETAILS') p.open=true;
    }
    const mask=el.closest('.modal-mask');
    if (mask) document.body.appendChild(mask);
  })()`);
  await delay(350);
  await evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({block:'center'})`);
  await delay(100);
}

async function dragTextarea(id, dx = 120, dy = 60) {
  const before = await evaluate(`(() => { const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return {x:r.right-3,y:r.bottom-3,width:r.width,height:r.height}; })()`);
  assert.ok(before.width > 0 && before.height > 0, `${id} must be visible`);
  // CDP mobile emulation suppresses the native desktop resize handle. Assign the
  // exact post-drag dimensions so before/after evidence stays deterministic.
  await evaluate(`(() => {
    const el=document.getElementById(${JSON.stringify(id)});
    el.style.width='${before.width + dx}px';
    el.style.height='${before.height + dy}px';
  })()`);
  return evaluate(`(() => { const el=document.getElementById(${JSON.stringify(id)}), r=el.getBoundingClientRect(), p=el.parentElement.getBoundingClientRect(), s=getComputedStyle(el.parentElement); return {id:${JSON.stringify(id)},resize:getComputedStyle(el).resize,beforeWidth:${before.width},width:r.width,beforeHeight:${before.height},height:r.height,overflow:r.right-p.right+parseFloat(s.paddingRight)+parseFloat(s.borderRightWidth)}; })()`);
}

async function screenshot(name, selectors, clip) {
  const folder = name.startsWith('vip-') ? process.env.VIP_SCREENSHOTS : name.startsWith('spacing-') ? process.env.SPACING_SCREENSHOTS : process.env.LAYOUT_SCREENSHOTS;
  if (!folder) return;
  await evaluate(`(() => {
    document.querySelectorAll('[data-layout-marker]').forEach(el => el.remove());
    for (const selector of ${JSON.stringify(selectors)}) {
      const rect = document.querySelector(selector).getBoundingClientRect();
      const marker = document.createElement('div');
      marker.dataset.layoutMarker = 'true';
      Object.assign(marker.style, {position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',border:'2px solid #e02035',boxSizing:'border-box',zIndex:'9999',pointerEvents:'none'});
      document.body.appendChild(marker);
    }
  })()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip ? {clip} : {}) });
  fs.mkdirSync(folder, { recursive: true });
  const phase = name.startsWith('vip-') ? process.env.VIP_PHASE : name.startsWith('spacing-') ? process.env.SPACING_PHASE : process.env.LAYOUT_PHASE;
  fs.writeFileSync(path.join(folder, `${phase || 'current'}-${name}.png`), Buffer.from(data, 'base64'));
  await evaluate("document.querySelectorAll('[data-layout-marker]').forEach(el => el.remove())");
}

before(async () => {
  if (!chromeAvailable) return;
  server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    if (relative === 'api/order/catalog') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(catalogFixture));
      return;
    }
    const filename = path.resolve(webRoot, relative);
    if (!filename.startsWith(path.resolve(webRoot)) || !fs.existsSync(filename)) {
      response.writeHead(404).end(); return;
    }
    const ext = path.extname(filename);
    response.setHeader('Content-Type', ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html');
    if (ext === '.css' && process.env.TEXTAREA_LEGACY === '1') {
      response.end(fs.readFileSync(filename, 'utf8')
        .replace('textarea { box-sizing: border-box; max-width: 100%; resize: vertical; background:', 'textarea { background:')
        .replace('.subpanel{min-width:0;', '.subpanel{'));
      return;
    }
    if (ext === '.css' && process.env.LAYOUT_LEGACY === '1') {
      // Reconstruct only the CSS changed by this fix for before/after evidence.
      const legacy = fs.readFileSync(filename, 'utf8')
        .replace('textarea { box-sizing: border-box; max-width: 100%; resize: vertical; background:', 'textarea { background:')
        .replace('  #modeGrid, .tool-grid { margin-right: 64px; }', '')
        .replace('.field label.chk-line, .field label.fb-check { display: flex; white-space: normal; }', '')
        .replace('.chk-line > span, .fb-check > span { min-width: 0; overflow-wrap: anywhere; }', '')
        .replace(/\.field input:is\(\[type="checkbox"\], \[type="radio"\]\), \.configbar input:is\(\[type="checkbox"\], \[type="radio"\]\) \{[^}]*\}/, '')
        .replace('var(--workbench-top, 78px)', '78px')
        .replace('var(--workbench-top, 70px)', '70px');
      response.end(legacy); return;
    }
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  serverPort = server.address().port;
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zn-layout-test-'));
  const port = 9333 + Math.floor(Math.random() * 300);
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, 'about:blank',
  ], { stdio: 'ignore' });
  const pages = await waitForJson(`http://127.0.0.1:${port}/json`);
  cdp = connectCdp(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
});

after(async () => {
  if (!chromeAvailable) return;
  if (process.env.SPACING_SCREENSHOTS && process.env.SPACING_PHASE === 'after') {
    const folder=process.env.SPACING_SCREENSHOTS;
    const sections=[];
    for(const width of [1440,390]) for(const [key,title] of spacingCases) {
      const name=`spacing-${key}-${width}`;
      const beforeImage=fs.readFileSync(path.join(folder,`before-${name}.png`)).toString('base64');
      const afterImage=fs.readFileSync(path.join(folder,`after-${name}.png`)).toString('base64');
      await setViewport(1200,900);
      await cdp.send('Page.navigate',{url:'about:blank'});
      await evaluate(`document.documentElement.innerHTML=${JSON.stringify(`<html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#f4f5f7;color:#17202b;font-family:"Microsoft YaHei",sans-serif}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;margin:0 0 12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}h2{font-size:16px;margin:0 0 8px}img{display:block;max-width:100%;height:auto;margin:auto;border:1px solid #ccd1d8}</style><h1>${title}</h1><p>${width}px 视口，红框标记相邻控件；原有页面真实渲染，无拉伸模拟。</p><div class="pair"><section><h2>修复前：表单项间距 0px</h2><img src="data:image/png;base64,${beforeImage}"></section><section><h2>修复后：表单项间距 16px</h2><img src="data:image/png;base64,${afterImage}"></section></div></html>`)}`);
      await delay(150);
      const height=await evaluate("Math.ceil(document.querySelector('.pair').getBoundingClientRect().bottom)");
      await setViewport(1200,height+16);
      const {data}=await cdp.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(folder,`comparison-${name}.png`),Buffer.from(data,'base64'));
      sections.push(`<section><h2>${title} · ${width}px</h2><a href="comparison-${name}.png"><img src="comparison-${name}.png" alt="${title}前后对照"></a><p><a href="before-${name}.png">修复前原图</a> · <a href="after-${name}.png">修复后原图</a></p></section>`);
    }
    fs.writeFileSync(path.join(folder,'spacing-comparisons.html'),`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>表单间距修复对照</title><style>body{margin:24px;background:#f4f5f7;color:#17202b;font-family:"Microsoft YaHei",sans-serif}h1{font-size:24px}h2{font-size:18px}section{margin:24px 0;padding-top:16px;border-top:1px solid #ccd1d8}img{max-width:100%;height:auto}</style><h1>6处贴边间距：4组页面，桌面与手机对照</h1><p>交流广场2处、拆爆款输入区2处、围读1处、拆解结果1处；修复前0px，修复后16px。红框标记控件。截图为本地源码的真实浏览器渲染，拆解结果使用测试API响应，不请求付费服务、不修改真实数据。</p>${sections.join('')}</html>`,'utf8');
  }
  if (process.env.LAYOUT_SCREENSHOTS && process.env.LAYOUT_PHASE === 'after') {
    for (const [name, title, note] of [
      ['workbench-390', '工作台返回按钮被导航遮挡', '修复后随导航实际高度避让，返回按钮可点击'],
      ['checkbox', '反馈弹窗复选框被拉宽', '修复后保持原生尺寸，说明文字正常排列'],
      ['floating', '小南悬浮入口覆盖卡片箭头', '修复后卡片右侧保留避让区，两个入口不再重叠'],
    ]) {
      const folder = process.env.LAYOUT_SCREENSHOTS;
      const beforeImage = fs.readFileSync(path.join(folder, `before-${name}.png`)).toString('base64');
      const afterImage = fs.readFileSync(path.join(folder, `after-${name}.png`)).toString('base64');
      await setViewport(830, 970);
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await delay(100);
      await evaluate(`document.documentElement.innerHTML = ${JSON.stringify(`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#f4f5f7;color:#17202b;font-family:"Microsoft YaHei",sans-serif}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;margin:0 0 12px}.pair{display:flex;gap:16px}.pair section{width:390px}h2{font-size:15px;margin:0 0 8px}img{display:block;width:390px;height:844px}</style></head><body><h1>${title}</h1><p>${note}。390 × 844 视口，红框标记问题位置。</p><div class="pair"><section><h2>修复前 · 原有 CSS 复现</h2><img src="data:image/png;base64,${beforeImage}"></section><section><h2>修复后 · 当前源码</h2><img src="data:image/png;base64,${afterImage}"></section></div></body>`)}`);
      await delay(100);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(folder, `comparison-${name}.png`), Buffer.from(data, 'base64'));
    }
    for (const [id, title] of textareaCases) {
      const name = `textarea-${id}`;
      const note = '等效模拟相同拖拽结果：向右 120px，向下 60px；红框为输入框边界';
      const folder = process.env.LAYOUT_SCREENSHOTS;
      const beforeImage = fs.readFileSync(path.join(folder, `before-${name}.png`)).toString('base64');
      const afterImage = fs.readFileSync(path.join(folder, `after-${name}.png`)).toString('base64');
      await setViewport(1472, 560);
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await delay(100);
      await evaluate(`document.documentElement.innerHTML = ${JSON.stringify(`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#f4f5f7;color:#17202b;font-family:"Microsoft YaHei",sans-serif}h1{font-size:20px;margin:0 0 5px}p{font-size:13px;margin:0 0 10px}.pair{display:flex;gap:16px}.pair section{width:712px}h2{font-size:14px;margin:0 0 6px}img{display:block;width:712px;height:445px;border:1px solid #ccd1d8}</style></head><body><h1>${title}</h1><p>${note}。</p><div class="pair"><section><h2>修复前：宽度随鼠标横向增大</h2><img src="data:image/png;base64,${beforeImage}"></section><section><h2>修复后：宽度保持不变，仅高度增加</h2><img src="data:image/png;base64,${afterImage}"></section></div></body>`)}`);
      await delay(100);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(folder, `comparison-${name}.png`), Buffer.from(data, 'base64'));
    }
    const gallery = `<html lang="zh"><meta charset="utf-8"><title>输入框越界修复对照</title><style>body{margin:24px;background:#f4f5f7;color:#17202b;font-family:"Microsoft YaHei",sans-serif}h1{font-size:24px}h2{font-size:18px}img{display:block;max-width:100%;height:auto}section{margin:24px 0;border-top:1px solid #ccd1d8;padding-top:16px}</style><h1>${textareaCases.length} 处输入框横向拉伸越界：修复前后对照</h1><p>每组采用同一桌面视口（1440 × 900），等效模拟同一拖拽结果（向右120px、向下60px）。动态资产使用本地测试数据，不修改真实账户或数据库。</p><p>全部文本域统一只允许纵向调整，并限制最大宽度；另外在1440/1024/390/320宽度下检查静态与动态文本域。采访回答框原先也允许双向调整，但flex布局限制了其横向增长，因此列入自动检查，不作为越界截图。</p>${textareaCases.map(([id,title])=>`<section><h2>${title} · #${id}</h2><a href="comparison-textarea-${id}.png"><img src="comparison-textarea-${id}.png" alt="${title}修复前后对照"></a><p><a href="before-textarea-${id}.png">修复前原图</a> · <a href="after-textarea-${id}.png">修复后原图</a></p></section>`).join('')}</html>`;
    fs.writeFileSync(path.join(process.env.LAYOUT_SCREENSHOTS, 'textarea-comparisons.html'), gallery, 'utf8');
  }
  cdp?.close();
  chrome?.kill();
  await new Promise(resolve => server?.close(resolve));
  if (userDataDir) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 4) throw error; await delay(200); }
    }
  }
});

layoutTest('workbench header remains above the navigation hit area at tablet and mobile widths', async () => {
  const failures = [];
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 700]]) {
    await loadPage(width, height);
    await evaluate("document.querySelector('#interviewPanel').classList.remove('hidden')");
    await delay(450);
    const result = await evaluate(`(() => {
      const button = document.querySelector('#workbenchBack');
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { clickable: !!hit?.closest('#workbenchBack'), top: rect.top, navBottom: document.querySelector('.topbar').getBoundingClientRect().bottom };
    })()`);
    await screenshot(`workbench-${width}`, ['#workbenchBack', '.topbar']);
    if (!result.clickable || result.top < result.navBottom) failures.push({width,...result});
    if (result.clickable) {
      const rect = await evaluate("(() => { const r = document.querySelector('#workbenchBack').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()");
      await cdp.send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...rect});
      await cdp.send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...rect});
      await delay(300);
      assert.equal(await evaluate("document.querySelector('#workbenchLayer').classList.contains('hidden')"), true, 'back button must close the workbench');
    }
  }
  assert.deepEqual(failures, [], 'workbench back buttons must be below the navigation and clickable');
});

layoutTest('mobile checkbox controls keep intrinsic width and their labels do not overflow', async () => {
  await loadPage(390, 844);
  await evaluate(`(() => {
    const modal = document.querySelector('#feedbackModal');
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
  })()`);
  await delay(350);
  await screenshot('checkbox', ['#fbUrgentField']);
  const result = await evaluate(`(() => ['specialTopic', 'fbUrgent'].map(id => {
    const input = document.getElementById(id);
    const label = input.closest('label');
    return { id, inputWidth: input.getBoundingClientRect().width, overflow: label.scrollWidth - label.clientWidth };
  }))()`);
  for (const item of result) {
    assert.ok(item.inputWidth > 0, `${item.id} checkbox must be visible`);
    assert.ok(item.inputWidth <= 24, `${item.id} checkbox width is ${item.inputWidth}px`);
    assert.ok(item.overflow <= 1, `${item.id} label overflows by ${item.overflow}px`);
  }
});

layoutTest('mobile floating assistant does not overlap the mode card action', async () => {
  await loadPage(390, 844);
  await evaluate(`(() => {
    const action = document.querySelector('#modeGrid .mode-go').getBoundingClientRect();
    window.scrollBy(0, action.top - 789);
  })()`);
  await delay(100);
  const overlap = await evaluate(`(() => {
    const action = document.querySelector('#modeGrid .mode-go').getBoundingClientRect();
    const floating = document.querySelector('#xnFloat').getBoundingClientRect();
    return Math.max(0, Math.min(action.right, floating.right) - Math.max(action.left, floating.left))
      * Math.max(0, Math.min(action.bottom, floating.bottom) - Math.max(action.top, floating.top));
  })()`);
  await screenshot('floating', ['#modeGrid .mode-go', '#xnFloat']);
  assert.equal(overlap, 0, `floating assistant overlaps mode action by ${overlap}px2`);
});

layoutTest('an open workbench tracks navigation height after a desktop to mobile resize', async () => {
  await loadPage(1440, 900);
  await evaluate("document.querySelector('#interviewPanel').classList.remove('hidden')");
  await delay(400);
  await setViewport(390, 844);
  await delay(200);
  const geometry = await evaluate(`(() => ({
    navBottom: document.querySelector('.topbar').getBoundingClientRect().bottom,
    headerTop: document.querySelector('.workbench-head').getBoundingClientRect().top
  }))()`);
  assert.ok(geometry.headerTop >= geometry.navBottom + 7, JSON.stringify(geometry));
});

layoutTest('mobile navigation, section headings and cards use the available width cleanly', async () => {
  for (const [width, height] of [[390, 844], [320, 700]]) {
    await loadPage(width, height);
    const studio = await evaluate(`(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
      const topbar = document.querySelector('.topbar');
      const nav = document.querySelector('.nav');
      const controls = [...document.querySelectorAll('.ctl button')];
      const title = document.querySelector('#view-studio > .section-title');
      const h2 = title.querySelector('h2');
      const eyebrow = title.querySelector('.eyebrow');
      const wrap = document.querySelector('.wrap');
      const wrapStyle = getComputedStyle(wrap);
      const modeGrid = document.querySelector('#modeGrid');
      const toolGrid = document.querySelector('.tool-grid');
      const textSizes = [...document.querySelectorAll('.mode-card p, .tool-card p')].map(el => parseFloat(getComputedStyle(el).fontSize));
      const brandText = document.querySelector('.brand b');
      const toolMeta = [...document.querySelectorAll('.tool-card')].map(card => {
        const titleRect = card.querySelector('h3').getBoundingClientRect();
        const costRect = card.querySelector('.tool-cost').getBoundingClientRect();
        return {id:card.id,titleBottom:titleRect.bottom,costTop:costRect.top};
      });
      return {
        topbar: rect(topbar), nav: rect(nav), title: rect(title), h2: rect(h2), eyebrow: rect(eyebrow),
        controls: controls.map(rect), wrap: rect(wrap), wrapContentRight:rect(wrap).right-parseFloat(wrapStyle.paddingRight), modeGrid: rect(modeGrid), toolGrid: rect(toolGrid), textSizes,
        navScrolls: nav.scrollWidth > nav.clientWidth, brandFits: brandText.scrollWidth <= brandText.clientWidth + 1, toolMeta,
      };
    })()`);
    assert.ok(studio.topbar.height <= 116, `mobile topbar is ${studio.topbar.height}px tall at ${width}px`);
    assert.ok(studio.nav.height <= 45, `navigation wraps to ${studio.nav.height}px at ${width}px`);
    assert.ok(studio.controls.every(item => item.height >= 38), `header controls are too small at ${width}px`);
    assert.ok(studio.eyebrow.width < 100, `eyebrow stretches to ${studio.eyebrow.width}px at ${width}px`);
    assert.ok(studio.h2.height <= 32, `studio heading wraps unexpectedly at ${width}px`);
    assert.ok(Math.abs(studio.modeGrid.right - studio.wrapContentRight) <= 2, `mode cards leave a right gutter at ${width}px`);
    assert.ok(Math.abs(studio.toolGrid.right - studio.wrapContentRight) <= 2, `tool cards leave a right gutter at ${width}px`);
    assert.ok(studio.textSizes.every(size => size >= 14), `card copy falls below 14px at ${width}px`);
    assert.equal(studio.brandFits, true, `brand text is clipped at ${width}px`);
    assert.ok(studio.toolMeta.every(item => item.costTop >= item.titleBottom + 5), `tool cost overlaps its title at ${width}px: ${JSON.stringify(studio.toolMeta)}`);

    await evaluate("document.querySelector('[data-view=\"vip\"]').click()");
    await delay(250);
    const vip = await evaluate(`(() => {
      const title = document.querySelector('#view-vip > .section-title');
      const h2 = title.querySelector('h2');
      const small = title.querySelector('small');
      const hr = h2.getBoundingClientRect(), sr = small.getBoundingClientRect();
      return {headingHeight:hr.height, subtitleBelow:sr.top >= hr.bottom - 1, perkSizes:[...document.querySelectorAll('.plan-perks')].map(el => parseFloat(getComputedStyle(el).fontSize))};
    })()`);
    assert.ok(vip.headingHeight <= 32, `VIP heading breaks across lines at ${width}px`);
    assert.equal(vip.subtitleBelow, true, `VIP subtitle stays squeezed beside its title at ${width}px`);
    assert.equal(vip.perkSizes.length, 4, `VIP plans did not render at ${width}px`);
    assert.ok(vip.perkSizes.every(size => size >= 14), `VIP perk copy falls below 14px at ${width}px`);
  }
});

layoutTest('desktop free plan stretches to the same height as the paid plans', async () => {
  await loadPage(1440, 900);
  await evaluate("document.querySelector('[data-view=\"vip\"]').click()");
  await delay(250);
  const cards = await evaluate(`(() => [...document.querySelectorAll('#plansGrid .plan-card')].map(card => ({
    height:card.getBoundingClientRect().height,
    state:card.querySelector('.plan-current-state')?.textContent.trim()
  })))()`);
  assert.equal(cards.length, 4);
  assert.ok(cards[0].state, 'free plan must keep its non-purchase state row');
  assert.ok(Math.max(...cards.map(card => card.height)) - Math.min(...cards.map(card => card.height)) <= 1, `plan cards have unequal heights: ${JSON.stringify(cards)}`);
});

layoutTest('payment notice stays separated from the plans on desktop and mobile', async () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await loadPage(width, height);
    await evaluate("document.querySelector('[data-view=\"vip\"]').click()");
    await delay(250);
    await screenshot(`vip-${width}`, ['#paymentNotice', '#plansGrid .plan-free']);
    const spacing = await evaluate(`(() => {
      const notice = document.querySelector('#paymentNotice');
      const grid = document.querySelector('#plansGrid');
      const visibleGap = grid.getBoundingClientRect().top - notice.getBoundingClientRect().bottom;
      notice.classList.add('hidden');
      const hiddenGap = grid.getBoundingClientRect().top - document.querySelector('#view-vip > .section-title').getBoundingClientRect().bottom;
      return {visibleGap, hiddenGap, pageWidth: document.documentElement.scrollWidth};
    })()`);
    assert.ok(spacing.visibleGap >= 16, `payment notice touches plans at ${width}px: ${spacing.visibleGap}px gap`);
    assert.ok(spacing.hiddenGap <= 24, `hidden payment notice leaves an extra gap at ${width}px: ${spacing.hiddenGap}px`);
    assert.ok(spacing.pageWidth <= width, `plans overflow at ${width}px`);
  }
});

layoutTest('narrow English section headings wrap without clipping or widening the page', async () => {
  await loadPage(320, 700);
  await evaluate("document.querySelector('#langBtn').click()");
  await delay(150);
  const result = await evaluate(`(() => ({
    pageWidth:document.documentElement.scrollWidth,
    headings:[...document.querySelectorAll('#view-studio > .section-title h2')].map(el => ({
      text:el.textContent.trim(), scrollWidth:el.scrollWidth, clientWidth:el.clientWidth
    }))
  }))()`);
  assert.ok(result.headings.length >= 2);
  assert.ok(result.headings.every(item => item.scrollWidth <= item.clientWidth + 1), JSON.stringify(result));
  assert.ok(result.pageWidth <= 320, `English page widens to ${result.pageWidth}px`);
});

layoutTest('a scrolled mobile tool opens one unobstructed workbench near the viewport top', async () => {
  await loadPage(390, 844);
  await evaluate(`(() => {
    const tool = document.querySelector('#toolTeardown');
    tool.scrollIntoView({block:'center'});
    tool.click();
  })()`);
  await delay(450);
  const state = await evaluate(`(() => {
    const layer = document.querySelector('#workbenchLayer');
    const panels = [...document.querySelectorAll('#workbenchBody > .panel')];
    const head = document.querySelector('.workbench-head').getBoundingClientRect();
    const assistant = getComputedStyle(document.querySelector('#xnFloat'));
    return {
      current: layer.dataset.current,
      visible: panels.filter(el => !el.classList.contains('hidden')).map(el => el.id),
      headTop: head.top,
      assistantDisplay: assistant.display,
    };
  })()`);
  assert.equal(state.current, 'teardownPanel');
  assert.deepEqual(state.visible, ['teardownPanel']);
  assert.ok(state.headTop <= 20, `workbench starts ${state.headTop}px below a scrolled-off navigation`);
  assert.equal(state.assistantDisplay, 'none');
});

layoutTest('all persistent textareas resize vertically and remain constrained by their containers', async () => {
  await loadPage(1440, 900);
  for (const family of ['cast','prop','scene']) {
    await mountAssetEditor(family);
    await evaluate(`document.getElementById('${family}LibModal').classList.add('hidden')`);
  }
  const result = await evaluate(`(() => {
    const host = document.createElement('div');
    host.id = 'runtimeTextareaHost';
    Object.assign(host.style, {width:'420px',padding:'18px',position:'fixed',left:'20px',top:'20px'});
    host.innerHTML = '<div class="field"><label>运行时文本域</label><textarea id="runtimeTextarea" rows="3"></textarea></div>';
    document.body.appendChild(host);
    const runtime = document.querySelector('#runtimeTextarea');
    runtime.style.width = '2000px';
    const textareas = [...document.querySelectorAll('textarea')];
    const resizeViolations = textareas
      .filter(el => !['vertical', 'none'].includes(getComputedStyle(el).resize))
      .map(el => el.id || el.className || '(anonymous)');
    const hostStyle = getComputedStyle(host);
    const hostRect = host.getBoundingClientRect();
    const runtimeRect = runtime.getBoundingClientRect();
    const contentRight = hostRect.right - parseFloat(hostStyle.paddingRight);
    return {
      count: textareas.length,
      resizeViolations,
      runtimeRight: runtimeRect.right,
      contentRight,
      runtimeBoxSizing: getComputedStyle(runtime).boxSizing,
    };
  })()`);
  assert.ok(result.count >= 30, `expected static and dynamic textareas, found ${result.count}`);
  assert.deepEqual(result.resizeViolations, [], `horizontal resize remains enabled: ${result.resizeViolations.join(', ')}`);
  assert.ok(result.runtimeRight <= result.contentRight + 1, JSON.stringify(result));
  assert.equal(result.runtimeBoxSizing, 'border-box');
});

layoutTest('captures representative textarea overflow locations', async () => {
  const metrics = [];
  for (const [id] of textareaCases) {
    await loadPage(1440, 900);
    const family = id.startsWith('castLib') ? 'cast' : id.startsWith('propLib') ? 'prop' : id.startsWith('sceneLib') ? 'scene' : null;
    if (family) await mountAssetEditor(family);
    await revealTextarea(id);
    const result = await dragTextarea(id);
    metrics.push(result);
    await screenshot(`textarea-${id}`, [`#${id}`]);
    if (process.env.LAYOUT_PHASE !== 'before') {
      assert.ok(result.width<=result.beforeWidth+1, `${id} grew horizontally: ${JSON.stringify(result)}`);
      assert.ok(result.height > result.beforeHeight + 30, `${id} should retain vertical resizing: ${JSON.stringify(result)}`);
      assert.ok(result.overflow<=1, `${id} overflowed its parent: ${JSON.stringify(result)}`);
    } else {
      assert.ok(result.width > result.beforeWidth + 50, `${id} before capture must reproduce horizontal resizing: ${JSON.stringify(result)}`);
    }
  }
  if (process.env.LAYOUT_SCREENSHOTS) {
    fs.writeFileSync(path.join(process.env.LAYOUT_SCREENSHOTS, `${process.env.LAYOUT_PHASE || 'current'}-textarea-metrics.json`), JSON.stringify(metrics, null, 2));
  }
});

layoutTest('static and runtime textareas stay within parent content width on desktop and mobile', async () => {
  const failures = [];
  for (const [width,height] of [[1440,900],[1024,768],[390,844],[320,700]]) {
    await loadPage(width,height);
    for (const family of ['cast','prop','scene']) {
      await mountAssetEditor(family);
      await evaluate(`document.getElementById('${family}LibModal').classList.add('hidden')`);
    }
    const result = await evaluate(`(() => {
      const failures=[];
      for(const el of document.querySelectorAll('textarea')) {
        const hidden=[], details=[];
        for(let p=el;p;p=p.parentElement) {
          if(p.classList.contains('hidden')) {hidden.push(p);p.classList.remove('hidden');}
          if(p.tagName==='DETAILS' && !p.open) {details.push(p);p.open=true;}
        }
        const oldStyle=el.getAttribute('style');
        const parent=el.parentElement, before=parent.getBoundingClientRect(), ps=getComputedStyle(parent);
        const right=before.right-parseFloat(ps.paddingRight)-parseFloat(ps.borderRightWidth);
        el.style.width='2000px';
        const rect=el.getBoundingClientRect();
        if(rect.width<=0 || rect.right>right+1) failures.push({id:el.id||el.className,width:rect.width,overflow:rect.right-right});
        if(oldStyle===null) el.removeAttribute('style'); else el.setAttribute('style',oldStyle);
        hidden.forEach(p=>p.classList.add('hidden')); details.forEach(p=>p.open=false);
      }
      return failures;
    })()`);
    failures.push(...result.map(item=>({viewport:width,...item})));
  }
  assert.deepEqual(failures, [], 'oversized textareas must stay within the original parent content area');
});

layoutTest('stacked form fields leave breathing room before the next field or action', async () => {
  const failures = [];
  const measurements = [];
  for (const [width,height] of [[1440,900],[1024,768],[390,844],[320,700]]) {
    await loadPage(width,height);
    for (const family of ['cast','prop','scene']) {
      await mountAssetEditor(family);
      await evaluate(`document.getElementById('${family}LibModal').classList.add('hidden')`);
    }
    const pairs = await evaluate(`(() => {
      const pairs=[];
      for (const field of document.querySelectorAll('.field')) {
        const hidden=[];
        for(let p=field;p;p=p.parentElement) {
          if(p.classList.contains('hidden')) {hidden.push(p);p.classList.remove('hidden');}
        }
        const parentStyle=getComputedStyle(field.parentElement);
        if(!['flex','inline-flex','grid','inline-grid'].includes(parentStyle.display)) {
          let next=field.nextElementSibling;
          while(next && getComputedStyle(next).display==='none') next=next.nextElementSibling;
          if(next && next.matches('.field, button, .configbar, .row-actions')) {
            const a=field.getBoundingClientRect(), b=next.getBoundingClientRect();
            if(a.width>0 && b.width>0 && b.top>=a.top) pairs.push({
              parent:field.parentElement.id || field.parentElement.className,
              from:field.querySelector('input,textarea,select')?.id || field.textContent.trim().slice(0,24),
              to:next.id || next.querySelector('input,textarea,select,button')?.id || next.className,
              gap:b.top-a.bottom,
            });
          }
        }
        hidden.forEach(p=>p.classList.add('hidden'));
      }
      return pairs;
    })()`);
    assert.ok(pairs.length >= 50, `expected broad form coverage, found ${pairs.length}`);
    measurements.push(...pairs.map(pair=>({viewport:width,...pair})));
    failures.push(...pairs.filter(pair=>pair.gap<9.5).map(pair=>({viewport:width,...pair})));
  }
  if(process.env.SPACING_SCREENSHOTS) {
    fs.mkdirSync(process.env.SPACING_SCREENSHOTS,{recursive:true});
    fs.writeFileSync(path.join(process.env.SPACING_SCREENSHOTS,`${process.env.SPACING_PHASE || 'current'}-spacing-metrics.json`),JSON.stringify(measurements,null,2));
  }
  assert.deepEqual(failures, [], 'stacked controls must not touch the following field or action');
});

layoutTest('captures every confirmed form spacing problem on desktop and mobile', async () => {
  if(!process.env.SPACING_SCREENSHOTS) return;
  for(const [width,height] of [[1440,900],[390,844]]) for(const [key,,anchor,selectors] of spacingCases) {
    await loadPage(width,height);
    if(key==='result') {
      await evaluate(`(() => {
        Api.request=async () => new Response(JSON.stringify({recordId:'spacing-test',points:0,report:{boomReasons:[],techniques:[],tagPool:[{label:'身份反转',category:'剧情'},{label:'代价选择',category:'冲突'}]},directions:[{id:'swap_persona',name:'人物身份置换',change:'更换身份关系，保留冲突逻辑'},{id:'setting_remix',name:'场景重构',change:'使用新的冲突空间'}]}),{headers:{'Content-Type':'application/json'}});
        document.getElementById('tdText').value='用于布局检查的本地测试剧本文本。'.repeat(10);
        document.getElementById('tdAnalyzeBtn').click();
      })()`);
      await delay(200);
      assert.ok(await evaluate("document.querySelector('#tdTags .td-tag')!==null"),'real teardown renderer must populate tags');
    }
    await revealTextarea(anchor);
    if(key==='square') await evaluate("document.getElementById('sqBody').style.height='240px'");
    await evaluate(`(() => {
      const items=${JSON.stringify(selectors)}.map(s=>document.querySelector(s));
      const root=items[0].closest('.workbench-body') || document.scrollingElement;
      const a=items[0].getBoundingClientRect(),b=items.at(-1).getBoundingClientRect();
      const top=root===document.scrollingElement ? 0 : root.getBoundingClientRect().top;
      const h=root===document.scrollingElement ? innerHeight : root.clientHeight;
      root.scrollTop+=(a.top+b.bottom)/2-(top+h/2);
    })()`);
    await delay(150);
    const clip=await evaluate(`(() => {
      const rects=${JSON.stringify(selectors)}.map(s=>document.querySelector(s).getBoundingClientRect());
      const x=Math.max(0,Math.min(...rects.map(r=>r.left))-20),y=Math.max(0,Math.min(...rects.map(r=>r.top))-32);
      return {x,y,width:Math.min(innerWidth-x,Math.max(...rects.map(r=>r.right))-x+20),height:Math.min(innerHeight-y,Math.max(...rects.map(r=>r.bottom))-y+24),scale:1};
    })()`);
    await screenshot(`spacing-${key}-${width}`,selectors,clip);
  }
});
