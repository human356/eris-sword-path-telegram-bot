(async function () {
  const { api, toast, drawPreview, currentGroup, tg } = window.Eris;
  const hello = document.getElementById('hello');
  const sel = document.getElementById('groupSel');
  const box = document.getElementById('groupBox');
  const btn = document.getElementById('btnCustomize');
  const note = document.getElementById('note');
  const canvas = document.getElementById('preview');
  let groups = [];

  async function refresh() {
    const g = groups.find((x) => String(x.id) === sel.value);
    try { localStorage.setItem('eris_group', sel.value); } catch (e) {}
    btn.disabled = !g || !g.unlocked;
    note.hidden = !!(g && g.unlocked);
    if (!g) note.textContent = 'هنوز در هیچ گروهی بازی نکرده‌اید. داخل گروه /profile را بزنید.';
    else if (!g.unlocked) note.textContent = 'برای باز شدن شخصیت در این گروه، «عروسک» را از ابتدای فروشگاه با ۴۰۰ سکه بخرید.';
    if (g && g.unlocked) {
      try {
        const c = await api('/character?g=' + encodeURIComponent(g.id));
        drawPreview(canvas, c.appearance, c.outfit, c.layers, 8);
      } catch (e) { /* preview is optional */ }
    } else {
      drawPreview(canvas, CharParts.DEFAULT_APPEARANCE.male, CharParts.DEFAULT_OUTFIT, [], 8);
    }
  }

  try {
    const me = await api('/me');
    groups = me.groups;
    hello.textContent = 'سلام ' + me.user.name + ' 👋';
    if (groups.length) {
      const wanted = currentGroup();
      sel.innerHTML = '';
      groups.forEach((g) => { const o = document.createElement('option'); o.value = g.id; o.textContent = (g.unlocked ? '🎭 ' : '🔒 ') + g.name; sel.appendChild(o); });
      const pick = groups.find((g) => String(g.id) === wanted) || groups.find((g) => g.unlocked) || groups[0];
      sel.value = String(pick.id);
      box.hidden = groups.length < 2;
    }
    await refresh();
  } catch (e) {
    hello.textContent = e.status === 401 ? 'این صفحه فقط داخل تلگرام باز می‌شود.' : 'خطا در بارگذاری. دوباره تلاش کنید.';
    return;
  }

  sel.addEventListener('change', refresh);
  btn.addEventListener('click', () => { location.href = '/app/character?g=' + encodeURIComponent(sel.value); });
})();
