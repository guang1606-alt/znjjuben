/* 首页多滚动广告位：拉取 home_hero_roll，多条自动轮播；无广告自动隐藏；点击计次并跳转 */
(function () {
  let list = [], idx = 0, timer = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 广告内容来自后台，链接只允许 http(s)，杜绝 javascript: 注入
  const safeUrl = (u) => { const s = String(u || ''); return /^https?:\/\//i.test(s) ? s : ''; };
  const safeImg = (u) => { const s = String(u || ''); return (/^https?:\/\//i.test(s) || s.startsWith('data:image/')) ? s : ''; };

  function render() {
    const box = document.getElementById('adRoll');
    if (!box || !list.length) { box && box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const cur = list[idx];
    const href = safeUrl(cur.linkUrl);
    const img = safeImg(cur.imageUrl);
    box.innerHTML = `
      <a class="ad-card" ${href ? `href="${esc(href)}" target="_blank" rel="noopener"` : 'role="link" aria-disabled="true"'} data-ad="${esc(cur.id)}">
        ${img ? `<img src="${esc(img)}" alt="${esc(cur.title || '')}"/>` : ''}
        <span class="ad-body"><b>${esc(cur.title || '')}</b>${cur.sponsorName ? `<small>${esc(cur.sponsorName)}</small>` : ''}</span>
        <em class="ad-badge">${esc(cur.badge || '广告')}</em>
      </a>
      ${list.length > 1 ? `<div class="ad-dots">${list.map((_, i) => `<i data-i="${i}" class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
    const card = box.querySelector('.ad-card');
    card?.addEventListener('click', () => {
      window.Api?.request(`/api/ads/${cur.id}/click`, { method: 'POST' }).catch(() => {});
    });
    box.querySelectorAll('.ad-dots i').forEach((d) => d.addEventListener('click', (e) => {
      e.preventDefault(); idx = +d.dataset.i; restart(); render();
    }));
  }
  function next() { if (list.length > 1) { idx = (idx + 1) % list.length; render(); } }
  function restart() { if (timer) clearInterval(timer); timer = setInterval(next, 4200); }

  async function load() {
    try {
      const res = await window.Api.request('/api/ads?slot=home_hero_roll');
      const d = await res.json();
      list = d.list || []; idx = 0; render(); restart();
    } catch { /* 广告加载失败不影响主功能 */ }
  }
  document.addEventListener('DOMContentLoaded', load);
  window.AdRoll && (window.AdRoll.reload = load);
})();
