/* Shared helpers of the Mini App pages. */
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('secondary_bg_color'); } catch (e) {} }

  async function api(path, options) {
    const res = await fetch('/api' + path, {
      ...(options || {}),
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': tg ? tg.initData : '', ...((options && options.headers) || {}) },
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !data || data.ok === false) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(text) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  const imgCache = {};
  function loadLayer(key) {
    if (!imgCache[key]) {
      imgCache[key] = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = '/webapp-static/layers/' + key + '.png';
      });
    }
    return imgCache[key];
  }

  /** Draws the character on `canvas`; `layers` = keys of artist PNGs that exist on the server. */
  let token = 0;
  async function drawPreview(canvas, appearance, outfit, layers, scale) {
    const my = ++token;
    const S = scale || 10;
    const pad = CharSprite.PAD;
    const overrides = {};
    for (const key of CharSprite.overrideKeys(appearance, outfit)) {
      if (layers && layers.indexOf(key) !== -1) { const img = await loadLayer(key); if (img) overrides[key] = img; }
    }
    if (my !== token) return;
    canvas.width = (CharSprite.GRID_W + pad * 2) * S;
    canvas.height = (CharSprite.GRID_H + pad * 2) * S;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    CharSprite.draw(ctx, appearance, outfit, { scale: S, x: pad * S, y: pad * S, overrides });
  }

  function currentGroup() {
    const q = new URLSearchParams(location.search).get('g');
    if (q) { try { localStorage.setItem('eris_group', q); } catch (e) {} return q; }
    try { return localStorage.getItem('eris_group'); } catch (e) { return null; }
  }

  window.Eris = { tg, api, toast, drawPreview, currentGroup };
})();
