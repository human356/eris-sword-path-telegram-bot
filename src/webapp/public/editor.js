(async function () {
  const { api, toast, drawPreview, currentGroup, tg } = window.Eris;
  const P = CharParts;
  const groupId = currentGroup();
  const canvas = document.getElementById('preview');
  const tabsEl = document.getElementById('tabs');
  const panel = document.getElementById('panel');
  const saveBtn = document.getElementById('btnSave');

  if (!groupId) { location.replace('/app'); return; }

  let state = null;      // { appearance, outfit }
  let saved = null;      // last saved JSON (for reset)
  let owned = new Set();
  let layers = [];
  let tab = 'body';

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const redraw = () => drawPreview(canvas, state.appearance, state.outfit, layers, 10);

  const LABELS = {
    gender: 'جنسیت', skin: 'رنگ پوست', face: 'حالت صورت', ears: 'حالت گوش', eyes: 'حالت چشم', eyeColor: 'رنگ چشم',
    eyebrow: 'نوع ابرو', eyebrowColor: 'رنگ ابرو', nose: 'حالت دماغ', mouth: 'حالت دهن',
    hair: 'نوع مو', hairColor: 'رنگ مو', mustache: 'نوع سیبیل / ریش', mustacheColor: 'رنگ سیبیل',
  };
  const TABS = [
    { id: 'body', label: '🧍 بدن', keys: ['gender', 'skin', 'face', 'ears'] },
    { id: 'face', label: '🙂 چهره', keys: ['eyes', 'eyeColor', 'eyebrow', 'eyebrowColor', 'nose', 'mouth'] },
    { id: 'hair', label: '💇 مو و سیبیل', keys: ['hair', 'hairColor', 'mustache', 'mustacheColor'] },
    { id: 'outfit', label: '👕 لباس‌ها' },
  ];

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function optionGroup(key) {
    const g = el('div', 'group');
    g.appendChild(el('h3', '', LABELS[key]));
    const wrap = el('div', P.OPTION_LISTS[key] ? 'chips' : 'swatches');
    if (P.OPTION_LISTS[key]) {
      for (const o of P.OPTION_LISTS[key]) {
        const b = el('button', 'chip' + (state.appearance[key] === o.id ? ' active' : ''), o.label);
        b.onclick = () => {
          if (key === 'gender' && state.appearance.gender !== o.id) {
            // switching gender swaps the base look but keeps colours the player already picked
            const next = Object.assign({}, P.DEFAULT_APPEARANCE[o.id], pickColors(state.appearance));
            state.appearance = next;
          } else state.appearance[key] = o.id;
          render();
        };
        wrap.appendChild(b);
      }
    } else {
      for (const c of P.COLOR_LISTS[key]) {
        const b = el('button', 'swatch' + (state.appearance[key] === c ? ' active' : ''));
        b.style.background = c;
        b.setAttribute('aria-label', c);
        b.onclick = () => { state.appearance[key] = c; render(); };
        wrap.appendChild(b);
      }
    }
    g.appendChild(wrap);
    return g;
  }

  function pickColors(a) {
    const out = {};
    for (const k of Object.keys(P.COLOR_LISTS)) out[k] = a[k];
    return out;
  }

  function outfitGroup(slot) {
    const g = el('div', 'group');
    g.appendChild(el('h3', '', slot.label));
    const wrap = el('div', 'chips');
    const required = ['top', 'bottom', 'shoes'].indexOf(slot.id) !== -1;
    if (!required) {
      const none = el('button', 'chip' + (!state.outfit[slot.id] ? ' active' : ''), 'هیچ');
      none.onclick = () => { state.outfit[slot.id] = null; render(); };
      wrap.appendChild(none);
    }
    for (const [id, gear] of Object.entries(P.GEAR)) {
      if (gear.slot !== slot.id) continue;
      const has = gear.free || owned.has(id);
      const b = el('button', 'chip' + (state.outfit[slot.id] === id ? ' active' : '') + (has ? '' : ' locked'));
      b.textContent = (has ? '' : '🔒 ') + gear.label + (gear.free ? ' (پیش‌فرض)' : '');
      if (!has) {
        const s = el('small', '', 'از فروشگاه بخرید');
        b.appendChild(s);
        b.onclick = () => toast('این مورد را اول از فروشگاه ربات بخرید 🛒');
      } else {
        b.onclick = () => { state.outfit[slot.id] = id; render(); };
      }
      wrap.appendChild(b);
    }
    g.appendChild(wrap);
    return g;
  }

  function render() {
    tabsEl.innerHTML = '';
    for (const t of TABS) {
      const b = el('button', 'tab' + (tab === t.id ? ' active' : ''), t.label);
      b.onclick = () => { tab = t.id; render(); };
      tabsEl.appendChild(b);
    }
    panel.innerHTML = '';
    const cur = TABS.find((t) => t.id === tab);
    if (cur.keys) cur.keys.forEach((k) => panel.appendChild(optionGroup(k)));
    else P.SLOTS.forEach((s) => panel.appendChild(outfitGroup(s)));
    redraw();
  }

  async function save() {
    saveBtn.disabled = true;
    try {
      const res = await api('/character?g=' + encodeURIComponent(groupId), { method: 'POST', body: JSON.stringify(state) });
      state = { appearance: res.appearance, outfit: res.outfit };
      saved = clone(state);
      toast('✅ شخصیت ذخیره شد');
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      render();
    } catch (e) {
      toast(e.status === 403 ? 'برای این گروه هنوز عروسک ندارید.' : 'ذخیره نشد، دوباره تلاش کنید.');
    } finally {
      saveBtn.disabled = false;
    }
  }

  function randomize() {
    const rnd = (list) => list[Math.floor(Math.random() * list.length)];
    const a = Object.assign({}, state.appearance);
    for (const k of ['face', 'ears', 'eyes', 'mouth', 'nose', 'eyebrow', 'hair', 'mustache']) a[k] = rnd(P.OPTION_LISTS[k]).id;
    for (const k of Object.keys(P.COLOR_LISTS)) a[k] = rnd(P.COLOR_LISTS[k]);
    if (a.gender === 'female') a.mustache = 'none';
    state.appearance = a;
    render();
  }

  try {
    const data = await api('/character?g=' + encodeURIComponent(groupId));
    state = { appearance: data.appearance, outfit: data.outfit };
    saved = clone(state);
    owned = new Set(data.ownedGear);
    layers = data.layers || [];
  } catch (e) {
    panel.innerHTML = '';
    panel.appendChild(el('p', 'note', e.status === 403
      ? 'برای باز شدن شخصیت، «عروسک» را از ابتدای فروشگاه همین گروه با ۴۰۰ سکه بخرید.'
      : e.status === 401 ? 'این صفحه فقط داخل تلگرام باز می‌شود.' : 'خطا در بارگذاری. دوباره تلاش کنید.'));
    saveBtn.hidden = true;
    return;
  }

  document.getElementById('btnBack').onclick = () => { location.href = '/app?g=' + encodeURIComponent(groupId); };
  document.getElementById('btnReset').onclick = () => { state = clone(saved); render(); };
  document.getElementById('btnRandom').onclick = randomize;
  saveBtn.onclick = save;
  render();
})();
