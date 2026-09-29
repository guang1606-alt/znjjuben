/* 指针交互动效：点击涟漪 + 极轻量轨迹光点；尊重 reduced-motion，可在设置关闭，不影响功能与性能 */
(function () {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (localStorage.getItem('zn_pointer_fx') === 'off') return;
  } catch { /* ignore */ }
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // 1) 点击涟漪（限定可交互元素，避免整页噪点）
  const RIPPLE_SEL = 'button, .mode-card, .tool-card, .chip, .rmode, .nav-item, .ep-item, .ad-card';
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest(RIPPLE_SEL);
    if (!el) return;
    const cs = getComputedStyle(el);
    // 仅在动画期间临时改写定位/裁剪，结束后还原，避免永久 overflow:hidden 裁掉下拉菜单、徽标等溢出内容
    const changedPos = cs.position === 'static';
    const changedOverflow = cs.overflow === 'visible';
    if (changedPos) el.style.position = 'relative';
    if (changedOverflow) el.style.overflow = 'hidden';
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'zn-ripple';
    const size = Math.max(r.width, r.height);
    s.style.width = s.style.height = size + 'px';
    s.style.left = (e.clientX - r.left - size / 2) + 'px';
    s.style.top = (e.clientY - r.top - size / 2) + 'px';
    el.appendChild(s);
    setTimeout(() => {
      s.remove();
      if (changedPos) el.style.position = '';
      if (changedOverflow) el.style.overflow = '';
    }, 620);
  }, true);

  // 2) 轨迹光点（仅精细指针设备，节流，自动回收）
  if (isTouch) return;
  let last = 0, alive = 0;
  document.addEventListener('mousemove', (e) => {
    const now = performance.now();
    if (now - last < 60 || alive > 14) return; // 节流 + 上限，保证性能
    last = now; alive++;
    const d = document.createElement('span');
    d.className = 'zn-trail';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.body.appendChild(d);
    setTimeout(() => { d.remove(); alive--; }, 560);
  }, { passive: true });
})();
