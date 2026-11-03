'use strict';
// ---------- Rechenlogik (rein, ohne DOM — von test.js geprüft) ----------
const OIL_G_PER_ML = 0.95; // ponytail: typische Duftöl-Dichte, nur für g→ml; Preis rechnet pro ml
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r05 = n => Math.round(n * 2) / 2;

function vesselMl(v) {
  const h = num(v.h);
  const dim = v.shape === 'rect' ? num(v.l) * num(v.w) * h : Math.PI * (num(v.d) / 2) ** 2 * h;
  return dim || num(v.ml); // ponytail: ml nur noch Fallback für früher gespeicherte Gefäße
}

// Wachs-Mischung: Die erste Sorte (c.waxId) bekommt den Rest auf 100 %, weitere Sorten (c.mix) haben feste Anteile am Wachsgewicht.
function waxMix(S, c) {
  const extra = c.mix || [];
  const sum = extra.reduce((s, m) => s + num(m.share), 0);
  const raw = [{ id: c.waxId, share: Math.max(0, 100 - sum) }, ...extra.map(m => ({ id: m.waxId, share: num(m.share) }))]
    .map(x => ({ w: S.waxes.find(w => w.id === x.id), share: x.share })).filter(x => x.w && x.share > 0);
  const total = raw.reduce((s, x) => s + x.share, 0);
  const list = raw.map(x => ({ ...x, f: x.share / total })); // f = Massenanteil, auf 100 % normiert
  const inv = list.reduce((s, x) => s + (num(x.w.density) > 0 ? x.f / num(x.w.density) : NaN), 0);
  // ponytail: ideale Mischung, Dichte = 1 / Σ(Massenanteil / Dichte); bei fehlender Dichte 0
  return { list, rest: Math.max(0, 100 - sum), over: sum > 100, density: inv > 0 && isFinite(inv) ? 1 / inv : 0 };
}
// Standard-Duftöl-% der Mischung (gewichtet); ohne gewähltes Wachs bleibt der Wert unverändert
function stdPct(S, c) {
  const m = waxMix(S, c);
  if (!m.list.length) return c.pct;
  return String(Math.round(m.list.reduce((s, x) => s + x.f * num(x.w.pct), 0) * 10) / 10);
}

function calc(S, c) {
  const v = S.vessels.find(x => x.id === c.vesselId);
  const mix = waxMix(S, c);
  const o = S.oils.find(x => x.id === c.oilId);
  const byWeight = c.mode === 'weight'; // Gesamtgewicht = Wachs + Duftöl, Duftöl-% bezieht sich aufs Wachs
  const vol = !byWeight && v ? vesselMl(v) : 0;
  const waxG = byWeight ? num(c.total) / (1 + num(c.pct) / 100)
    : vol * num(c.fill) / 100 * mix.density;
  const oilG = byWeight ? num(c.total) - waxG : waxG * num(c.pct) / 100;
  const oilMl = oilG / OIL_G_PER_ML;
  const parts = {
    wax: mix.list.reduce((s, x) => s + waxG * x.f / 1000 * num(x.w.price), 0),
    oil: o ? oilMl * num(o.price) : 0,
    vessel: v ? num(v.price) : 0,
    extras: c.extras.reduce((s, e) => s + num(e.price), 0),
  };
  const material = parts.wax + parts.oil + parts.vessel + parts.extras;
  const price = r05(material * (S.set.markupOn ? 1 + num(S.set.markupPct) / 100 : 1));
  const warn = [];
  const lim = mix.list.reduce((a, x) => !a || num(x.w.max) < num(a.w.max) ? x : a, null); // strengstes Maximum der Mischung
  if (lim && num(c.pct) > num(lim.w.max)) warn.push(`Duftöl ${num(c.pct)} % liegt über dem Maximum von ${num(lim.w.max)} % für ${lim.w.name} (Rußgefahr, verstopfter Docht).`);
  mix.list.forEach(x => { if (!num(x.w.price)) warn.push(`Wachspreis fehlt${mix.list.length > 1 ? ` (${x.w.name})` : ''} (unter „Zubehör“).`); });
  if (mix.over) warn.push('Die Anteile der weiteren Wachssorten ergeben über 100 %. Die Mischung wird auf 100 % umgerechnet.');
  if (o && !num(o.price)) warn.push('Duftölpreis fehlt (unter „Zubehör“).');
  if (v && !num(v.price)) warn.push('Gefäßpreis fehlt (unter „Zubehör“).');
  const waxes = mix.list.map(x => ({ name: x.w.name, share: x.f * 100, g: waxG * x.f }));
  // Nachgewogen: fertige Kerze minus leeres Glas = tatsächlich verbrauchtes Wachs + Öl (Öl-% gilt fürs Wachs)
  let actual = null;
  if (num(c.finished) > 0 && v && num(v.weight) > 0) {
    const used = num(c.finished) - num(v.weight);
    if (used > 0) { const wax = used / (1 + num(c.pct) / 100); actual = { total: used, waxG: wax, oilG: used - wax, diff: byWeight ? used - num(c.total) : wax - waxG }; }
  }
  return { vol, waxG, waxes, oilG, oilMl, parts, material, price, warn, actual };
}

const defaults = () => ({
  waxes: [
    ['Sojawachs (Container)', '0.88', '8', '12'],
    ['Kokos-Soja-Mischung', '0.89', '9', '12'],
    ['Rapswachs', '0.905', '8', '10'],
    ['Paraffin (Container)', '0.88', '8', '12'],
    ['Gelwachs', '0.97', '2', '6'],
  ].map(([name, density, pct, max]) => ({ id: uid(), name, density, price: '', pct, max })),
  oils: [], vessels: [], recipes: [], photos: [],
  quick: { vesselId: '', total: '', pct: '', waxId: '', oilId: '' },
  calc: { mode: 'vessel', vesselId: '', waxId: '', oilId: '', fill: '75', total: '', finished: '', pct: '', qty: '1', extras: [] },
  set: { markupOn: false, markupPct: '150' },
});
const norm = s => { s.photos = s.photos || []; s.quick = s.quick || defaults().quick; return s; };
function uid() { return Math.random().toString(36).slice(2, 9); }

if (typeof module !== 'undefined') module.exports = { norm, calc, vesselMl, r05, defaults, waxMix, stdPct };

// ---------- Oberfläche ----------
if (typeof document !== 'undefined') (() => {
  const KEY = 'dessertkerzen.v1';
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.waxes) return norm(s); } catch (e) {} return defaults(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  let S = load(), tab = 'home', sub = 'vessels', imgs = {}; // imgs: Foto-Id -> JPEG-Datenurl (liegt in IndexedDB, nicht in localStorage)
  const TITLES = { home: 'Kerzenkalkulator', stock: 'Zubehör', quick: 'Schneller Preis', calc: 'Wachs & Duftöl', photos: 'Meine Kerzen', rec: 'Rezepte' };
  const openDb = () => new Promise((ok, no) => { const r = indexedDB.open('dk-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const withStore = (mode, fn) => openDb().then(db => new Promise((ok, no) => { const t = db.transaction('p', mode); const req = fn(t.objectStore('p')); t.oncomplete = () => ok(req && req.result); t.onerror = () => no(t.error); }));
  const putImg = (id, d) => withStore('readwrite', s => s.put(d, id));
  const delImg = id => withStore('readwrite', s => s.delete(id));
  const clearImgs = () => withStore('readwrite', s => s.clear());
  const loadImgs = async () => { const ks = await withStore('readonly', s => s.getAllKeys()), vs = await withStore('readonly', s => s.getAll()); return Object.fromEntries(ks.map((k, i) => [k, vs[i]])); };
  const shrink = f => new Promise((ok, no) => { // ponytail: max. 900 px, JPEG 75 %, damit viele Fotos ins Handy passen
    const im = new Image(), u = URL.createObjectURL(f);
    im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.75)); };
    im.onerror = no; im.src = u; });
  const rv = {}; // Gefäß-Umrechnung pro Rezept, nur Ansicht
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const fmt = (n, d = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: d });

  const opts = (list, sel, ph) => `<option value="">${ph}</option>` +
    list.map(x => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.name || '(ohne Name)')}</option>`).join('');
  const inp = (attrs, val, label, unit, type = 'number') =>
    `<label class="f"><span>${label}</span><div class="in"><input type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(val)}" ${attrs}>${unit ? `<i>${unit}</i>` : ''}</div></label>`;
  const L = (l, id, f, val, label, unit, type) => inp(`data-l="${l}" data-id="${id}" data-f="${f}"`, val, label, unit, type);
  const row = (k, v, cls = '') => `<div class="r ${cls}"><span>${k}</span><b>${v}</b></div>`;

  const summary = (c, q = 1) => {
    const r = calc(S, c);
    const byWeight = c.mode === 'weight';
    if (!(byWeight ? r.waxG : r.vol) || !r.waxes.length)
      return `<p class="hint">${byWeight ? 'Wachs wählen und Gesamtgewicht eintragen' : 'Gefäß und Wachs wählen'}, dann erscheint die Rechnung.</p>`;
    const p = r.parts;
    return `<div class="price"><small>${S.set.markupOn ? 'Verkaufspreis' : 'Preis'} (auf 0,50 € gerundet)</small><b>${eur(r.price)}</b></div>` +
      row('Wachs', `${fmt(r.waxG)} g`) +
      (r.waxes.length > 1 ? r.waxes.map(x => row(`· ${esc(x.name || 'Wachs')} (${fmt(x.share)} %)`, `${fmt(x.g)} g`, 'sub')).join('') : '') +
      row('Duftöl', `${fmt(r.oilG)} g · ${fmt(r.oilMl)} ml`) +
      (r.actual ? `<hr><h3>Nachgewogen</h3>` + row('Verbraucht Wachs', `${fmt(r.actual.waxG)} g`) + row('Verbraucht Duftöl', `${fmt(r.actual.oilG)} g`) +
        row(byWeight ? 'Abweichung Gesamtgewicht' : 'Abweichung Wachs', `${r.actual.diff > 0 ? '+' : ''}${fmt(r.actual.diff)} g`) : '') +
      `<hr>` + row('Wachs', eur(p.wax)) + row('Duftöl', eur(p.oil)) + row('Gefäß', eur(p.vessel)) + row('Extras', eur(p.extras)) +
      row('Materialkosten', eur(r.material), 'sum') +
      (q > 1 ? `<hr><h3>Für ${q} Kerzen</h3>` + row('Wachs', `${fmt(r.waxG * q / 1000, 2)} kg`) + row('Duftöl', `${fmt(r.oilMl * q)} ml`) +
        row('Materialkosten', eur(r.material * q)) + row('Verkauf', eur(r.price * q)) : '') +
      r.warn.map(w => `<p class="warn">⚠ ${esc(w)}</p>`).join('');
  };

  const views = {
    calc() {
      const c = S.calc, bw = c.mode === 'weight';
      return `${bw || S.vessels.length ? '' : '<p class="hint">Lege zuerst unter <b>Zubehör</b> ein Gefäß an.</p>'}
      <div class="seg"><button data-a="mode" data-m="vessel"${bw ? '' : ' class="on"'}>Nach Gefäß</button><button data-a="mode" data-m="weight"${bw ? ' class="on"' : ''}>Nach Gewicht</button></div>
      <section class="card"><h2>Kerze</h2>
        <label class="f"><span>${bw ? 'Gefäß (optional, nur für den Preis)' : 'Gefäß'}</span><select data-c="vesselId">${opts(S.vessels, c.vesselId, bw ? '– ohne –' : '– wählen –')}</select></label>
        <label class="f"><span>Wachs<span class="rest"></span></span><select data-c="waxId">${opts(S.waxes, c.waxId, '– wählen –')}</select></label>
        ${(c.mix || []).map(m => `<div class="ex"><select data-w="${m.id}" data-f="waxId">${opts(S.waxes, m.waxId, '– wählen –')}</select>
          <div class="in"><input type="number" inputmode="decimal" step="any" min="0" data-w="${m.id}" data-f="share" value="${esc(m.share)}" aria-label="Anteil in Prozent"><i>%</i></div>
          <button class="x" data-a="delm" data-id="${m.id}" aria-label="Wachssorte entfernen">✕</button></div>`).join('')}
        <button class="ghost" data-a="addm" style="margin-bottom:10px">+ Weitere Wachssorte</button>
        <label class="f"><span>Duftöl</span><select data-c="oilId">${opts(S.oils, c.oilId, '– ohne –')}</select></label>
        <div class="g3">${bw ? inp('data-c="total"', c.total, 'Gesamtgew.', 'g') : inp('data-c="fill"', c.fill, 'Füllgrad', '%')}${inp('data-c="pct"', c.pct, 'Duftöl', '%')}${inp('data-c="qty"', c.qty, 'Stück', '')}</div>
        <div class="g2">${inp('data-c="finished"', c.finished, 'Fertige Kerze gewogen', 'g')}</div>
        <p class="hint">Optional: Kerze samt Glas wiegen. Mit dem Leergewicht des Glases (Zubehör) zeigt die App, wie viel Wachs und Duftöl wirklich verbraucht wurde.</p>
        ${bw ? '<p class="hint">Gesamtgewicht = Wachs + Duftöl. Das Duftöl-% gilt wie überall in der App für das Wachsgewicht, nicht fürs Gesamtgewicht.</p>' : ''}
        <h3>Extras pro Kerze</h3>
        ${c.extras.map(e => `<div class="ex"><input data-x="${e.id}" data-f="name" value="${esc(e.name)}" placeholder="z. B. Docht, Sahne-Deko">
          <div class="in"><input type="number" inputmode="decimal" step="any" min="0" data-x="${e.id}" data-f="price" value="${esc(e.price)}"><i>€</i></div>
          <button class="x" data-a="delx" data-id="${e.id}" aria-label="Löschen">✕</button></div>`).join('')}
        <button class="ghost" data-a="addx">+ Extra-Posten</button>
        <label class="sw"><input type="checkbox" data-s="markupOn" ${S.set.markupOn ? 'checked' : ''}> Prozentaufschlag auf Materialkosten</label>
        ${S.set.markupOn ? inp('data-s="markupPct"', S.set.markupPct, 'Aufschlag', '%') : ''}
      </section>
      <section class="card" id="result"></section>
      <button class="primary" data-a="saverec">Als Rezept speichern</button>
      <button class="ghost" data-t="rec">Meine Rezepte</button>`;
    },
    vessels() {
      return `<p class="hint">Innenmaße bis zur Füllhöhe eintragen, daraus rechnet die App das Volumen. Leergewicht: das leere Glas auf der Waage.</p>` +
        S.vessels.map(v => `<section class="card">
          ${L('vessels', v.id, 'name', v.name, 'Name', '', 'text')}
          <label class="f"><span>Form</span><select data-l="vessels" data-id="${v.id}" data-f="shape">
            <option value="round"${v.shape !== 'rect' ? ' selected' : ''}>rund</option><option value="rect"${v.shape === 'rect' ? ' selected' : ''}>rechteckig</option></select></label>
          <div class="g2">${L('vessels', v.id, 'weight', v.weight, 'Leergewicht', 'g')}${L('vessels', v.id, 'price', v.price, 'Preis', '€')}</div>
          <div class="g3">${v.shape === 'rect'
            ? L('vessels', v.id, 'l', v.l, 'Länge', 'cm') + L('vessels', v.id, 'w', v.w, 'Breite', 'cm')
            : L('vessels', v.id, 'd', v.d, 'Durchm.', 'cm') + '<span></span>'}${L('vessels', v.id, 'h', v.h, 'Höhe', 'cm')}</div>
          <p class="vol" data-id="${v.id}"></p>
          <button class="ghost" data-a="del" data-l="vessels" data-id="${v.id}">Löschen</button></section>`).join('') +
        `<button class="primary" data-a="add" data-l="vessels">+ Gefäß</button>`;
    },
    waxes() {
      return `<p class="hint">Dichte in g/ml. Duftöl-% ist deine Standard-Dosierung, Max. der Herstellerwert.</p>` +
        S.waxes.map(w => `<section class="card">${L('waxes', w.id, 'name', w.name, 'Name', '', 'text')}
          <div class="g2">${L('waxes', w.id, 'price', w.price, 'Preis', '€/kg')}${L('waxes', w.id, 'density', w.density, 'Dichte', 'g/ml')}</div>
          <div class="g2">${L('waxes', w.id, 'pct', w.pct, 'Duftöl Standard', '%')}${L('waxes', w.id, 'max', w.max, 'Duftöl Max.', '%')}</div>
          <button class="ghost" data-a="del" data-l="waxes" data-id="${w.id}">Löschen</button></section>`).join('') +
        `<button class="primary" data-a="add" data-l="waxes">+ Wachs</button>`;
    },
    oils() {
      return         S.oils.map(o => `<section class="card">${L('oils', o.id, 'name', o.name, 'Name', '', 'text')}${L('oils', o.id, 'price', o.price, 'Preis', '€/ml')}
          <button class="ghost" data-a="del" data-l="oils" data-id="${o.id}">Löschen</button></section>`).join('') +
        `<button class="primary" data-a="add" data-l="oils">+ Duftöl</button>`;
    },
    stock() {
      const t = [['vessels', 'Gefäße'], ['waxes', 'Wachs'], ['oils', 'Duftöl']];
      return `<div class="seg s3">${t.map(([k, n]) => `<button data-a="sub" data-k="${k}"${sub === k ? ' class="on"' : ''}>${n}</button>`).join('')}</div>` + views[sub]();
    },
    home() {
      const t = [['stock', '🧺', 'Zubehör', 'Wachse, Düfte und Gefäße eintragen'], ['quick', '💶', 'Schneller Preis', 'Gefäß wählen, wiegen, Preis sehen'],
        ['calc', '⚖️', 'Wachs & Duftöl', 'Wie viel brauche ich für eine Kerze?'], ['photos', '📷', 'Meine Kerzen', 'Foto, Duft und Name speichern']];
      return `<div class="home">${t.map(([k, i, n, d]) => `<button class="tile" data-t="${k}"><b>${i}</b><span><strong>${n}</strong><small>${d}</small></span></button>`).join('')}</div>`;
    },
    quick() {
      const q = S.quick;
      return `${S.vessels.length ? '' : '<p class="hint">Lege zuerst unter <b>Zubehör</b> ein Gefäß an.</p>'}
      <section class="card">
        <label class="f"><span>Gefäß</span><select data-q="vesselId">${opts(S.vessels, q.vesselId, '– wählen –')}</select></label>
        <div class="g2">${inp('data-q="total"', q.total, 'Kerze mit Glas gewogen', 'g')}${inp('data-q="pct"', q.pct, 'Duftöl', '%')}</div>
        <label class="f"><span>Wachs</span><select data-q="waxId">${opts(S.waxes, q.waxId, '– wählen –')}</select></label>
        <label class="f"><span>Duftöl</span><select data-q="oilId">${opts(S.oils, q.oilId, '– ohne –')}</select></label>
        <label class="sw"><input type="checkbox" data-s="markupOn" ${S.set.markupOn ? 'checked' : ''}> Prozentaufschlag auf Materialkosten</label>
        ${S.set.markupOn ? inp('data-s="markupPct"', S.set.markupPct, 'Aufschlag', '%') : ''}
      </section>
      <section class="card" id="result"></section>`;
    },
    photos() {
      return `<button class="primary" data-a="addphoto">📷 Foto hinzufügen</button><input type="file" id="pic" accept="image/*" hidden>` +
        (S.photos.length ? S.photos.map(p => `<section class="card"><img class="pic" src="${imgs[p.id] || ''}" alt="${esc(p.name || 'Kerze')}">
          ${L('photos', p.id, 'name', p.name, 'Kerzenname (optional)', '', 'text')}
          <div class="g2"><label class="f"><span>Duftöl (optional)</span><select data-l="photos" data-id="${p.id}" data-f="oilId">${opts(S.oils, p.oilId, '– keins –')}</select></label>
          ${L('photos', p.id, 'pct', p.pct, 'Duftöl', '%')}</div>
          <p class="vol">${esc(p.date)}</p><button class="ghost" data-a="delphoto" data-id="${p.id}">Löschen</button></section>`).join('')
          : '<p class="hint">Noch keine Fotos. Tippe auf „Foto hinzufügen“, mache ein Foto oder wähle eins aus der Galerie.</p>');
    },
    rec() {
      if (!S.recipes.length) return '<p class="hint">Noch keine Rezepte. Im Kalkulator „Als Rezept speichern“ tippen.</p>';
      return S.recipes.map(r => {
        const vid = rv[r.id] || r.c.vesselId, c = { ...r.c, vesselId: vid };
        return `<section class="card">${L('recipes', r.id, 'name', r.name, 'Rezept', '', 'text')}
          ${r.c.mode === 'weight' ? '' : `<label class="f"><span>Umrechnen auf Gefäß</span><select data-rv="${r.id}">${opts(S.vessels, vid, '– wählen –')}</select></label>`}
          ${summary(c, 1)}
          <div class="g2"><button class="primary" data-a="loadrec" data-id="${r.id}">In Kalkulator</button>
          <button class="ghost" data-a="del" data-l="recipes" data-id="${r.id}">Löschen</button></div></section>`;
      }).join('');
    },
  };

  // Schnellpreis: Kerze mit Glas gewogen minus Leergewicht = Wachs + Duftöl, dann wie „Nach Gewicht“
  const quickC = () => { const q = S.quick, v = S.vessels.find(x => x.id === q.vesselId);
    return { mode: 'weight', vesselId: q.vesselId, waxId: q.waxId, oilId: q.oilId, total: String(Math.max(0, num(q.total) - (v ? num(v.weight) : 0))), pct: q.pct, extras: [], qty: '1' }; };
  const quickNote = () => { const q = S.quick, v = S.vessels.find(x => x.id === q.vesselId);
    if (v && !num(v.weight)) return '<p class="warn">⚠ Leergewicht fehlt (unter „Zubehör“ beim Gefäß eintragen).</p>';
    if (v && num(q.total) > 0 && num(q.total) <= num(v.weight)) return '<p class="warn">⚠ Das Gewicht ist kleiner als das leere Glas.</p>';
    return ''; };
  function updateLive() {
    const r = $('#result'); if (r) r.innerHTML = tab === 'quick' ? quickNote() + summary(quickC(), 1) : summary(S.calc, Math.max(1, num(S.calc.qty) || 1));
    const rest = $('.rest'); if (rest) rest.textContent = (S.calc.mix || []).length ? ` · Rest ${fmt(waxMix(S, S.calc).rest)} %` : ''; // Restanteil der ersten Sorte live halten
    document.querySelectorAll('.vol').forEach(p => {
      const v = S.vessels.find(x => x.id === p.dataset.id);
      p.textContent = v ? `Volumen: ${fmt(vesselMl(v), 0)} ml` : '';
    });
  }
  function render() {
    $('#app').innerHTML = views[tab]();
    $('#ttl').textContent = TITLES[tab]; $('#back').hidden = tab === 'home';
    updateLive();
  }

  document.addEventListener('input', e => {
    const t = e.target, d = t.dataset, val = t.type === 'checkbox' ? t.checked : t.value;
    if (d.l) S[d.l].find(x => x.id === d.id)[d.f] = val;
    else if (d.c) {
      S.calc[d.c] = val;
      if (d.c === 'waxId') S.calc.pct = stdPct(S, S.calc);
    } else if (d.w) {
      S.calc.mix.find(x => x.id === d.w)[d.f] = val;
      if (d.f === 'waxId') S.calc.pct = stdPct(S, S.calc);
    } else if (d.x) S.calc.extras.find(x => x.id === d.x)[d.f] = val;
    else if (d.q) {
      S.quick[d.q] = val;
      if (d.q === 'waxId') S.quick.pct = stdPct(S, S.quick);
    } else if (d.s) S.set[d.s] = val;
    else if (d.rv) rv[d.rv] = val;
    else return;
    save();
    if (t.tagName === 'SELECT' || t.type === 'checkbox') render(); else updateLive();
  });

  const clone = o => JSON.parse(JSON.stringify(o));
  const blank = {
    vessels: () => ({ id: uid(), name: '', shape: 'round', weight: '', d: '', l: '', w: '', h: '', price: '' }),
    waxes: () => ({ id: uid(), name: '', density: '0.88', price: '', pct: '8', max: '10' }),
    oils: () => ({ id: uid(), name: '', price: '' }),
  };
  const act = {
    add: d => S[d.l].push(blank[d.l]()),
    del: d => { if (confirm('Wirklich löschen?')) S[d.l] = S[d.l].filter(x => x.id !== d.id); },
    mode: d => { S.calc.mode = d.m; },
    addm: () => { S.calc.mix = [...(S.calc.mix || []), { id: uid(), waxId: '', share: String(Math.round(waxMix(S, S.calc).rest / 2)) }]; },
    delm: d => { S.calc.mix = (S.calc.mix || []).filter(x => x.id !== d.id); S.calc.pct = stdPct(S, S.calc); },
    addx: () => S.calc.extras.push({ id: uid(), name: '', price: '' }),
    delx: d => { S.calc.extras = S.calc.extras.filter(x => x.id !== d.id); },
    saverec: () => {
      const name = prompt('Name des Rezepts?'); if (!name) return;
      S.recipes.push({ id: uid(), name, c: clone(S.calc) }); tab = 'rec';
    },
    loadrec: d => { const r = S.recipes.find(x => x.id === d.id); S.calc = { ...clone(r.c), vesselId: r.c.mode === 'weight' ? r.c.vesselId : rv[d.id] || r.c.vesselId }; tab = 'calc'; },
    sub: d => { sub = d.k; },
    addphoto: () => $('#pic').click(),
    delphoto: d => { if (!confirm('Foto wirklich löschen?')) return; S.photos = S.photos.filter(x => x.id !== d.id); delete imgs[d.id]; delImg(d.id).catch(() => {}); },
    info: () => $('#dlg').showModal(),
    close: () => $('#dlg').close(),
    export: () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...S, _photos: imgs }, null, 1)], { type: 'application/json' }));
      a.download = `dessertkerzen-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    },
    import: () => $('#imp').click(),
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a],[data-t]'); if (!b) return;
    if (b.dataset.t) tab = b.dataset.t; else { act[b.dataset.a](b.dataset); if (['info', 'close', 'export', 'import'].includes(b.dataset.a)) return; }
    save(); render(); scrollTo(0, 0);
  });
  $('#imp').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      let s; try { s = JSON.parse(rd.result); if (!s.waxes || !s.calc) throw 0; } catch (x) { return alert('Diese Datei ist keine gültige Sicherung.'); }
      if (!confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) return;
      const ph = s._photos || {}; delete s._photos;
      S = norm(s); imgs = ph; save();
      try { await clearImgs(); for (const id in ph) await putImg(id, ph[id]); } catch (x) { alert('Die Fotos konnten nicht gespeichert werden.'); }
      render(); $('#dlg').close();
    };
    rd.readAsText(f); e.target.value = '';
  });

  document.addEventListener('change', async e => { // delegiert, weil #pic bei jedem Render neu entsteht
    if (e.target.id !== 'pic' || !e.target.files[0]) return;
    const f = e.target.files[0]; e.target.value = '';
    try {
      const data = await shrink(f), id = uid();
      await putImg(id, data); imgs[id] = data;
      S.photos.unshift({ id, name: '', oilId: '', pct: '', date: new Date().toLocaleDateString('de-DE') });
      save(); render();
    } catch (x) { alert('Das Foto konnte nicht gespeichert werden.'); }
  });

  render();
  loadImgs().then(m => { imgs = { ...m, ...imgs }; if (tab === 'photos') render(); }).catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
