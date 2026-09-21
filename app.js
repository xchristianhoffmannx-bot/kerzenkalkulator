'use strict';
// ---------- Rechenlogik (rein, ohne DOM — von test.js geprüft) ----------
const OIL_G_PER_ML = 0.95; // ponytail: typische Duftöl-Dichte, nur für g→ml; Preis rechnet pro ml
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r05 = n => Math.round(n * 2) / 2;

function vesselMl(v) {
  if (num(v.ml) > 0) return num(v.ml); // ml hat Vorrang vor Maßen
  const h = num(v.h);
  return v.shape === 'rect' ? num(v.l) * num(v.w) * h : Math.PI * (num(v.d) / 2) ** 2 * h;
}

function calc(S, c) {
  const v = S.vessels.find(x => x.id === c.vesselId);
  const w = S.waxes.find(x => x.id === c.waxId);
  const o = S.oils.find(x => x.id === c.oilId);
  const vol = v ? vesselMl(v) : 0;
  const waxG = vol * num(c.fill) / 100 * (w ? num(w.density) : 0);
  const oilG = waxG * num(c.pct) / 100;
  const oilMl = oilG / OIL_G_PER_ML;
  const parts = {
    wax: w ? waxG / 1000 * num(w.price) : 0,
    oil: o ? oilMl * num(o.price) : 0,
    vessel: v ? num(v.price) : 0,
    extras: c.extras.reduce((s, e) => s + num(e.price), 0),
  };
  const material = parts.wax + parts.oil + parts.vessel + parts.extras;
  const price = r05(material * (S.set.markupOn ? 1 + num(S.set.markupPct) / 100 : 1));
  const warn = [];
  if (w && num(c.pct) > num(w.max)) warn.push(`Duftöl ${num(c.pct)} % liegt über dem Maximum von ${num(w.max)} % für ${w.name} (Rußgefahr, verstopfter Docht).`);
  if (w && !num(w.price)) warn.push('Wachspreis fehlt (Reiter „Zutaten“).');
  if (o && !num(o.price)) warn.push('Duftölpreis fehlt (Reiter „Zutaten“).');
  if (v && !num(v.price)) warn.push('Gefäßpreis fehlt (Reiter „Gefäße“).');
  return { vol, waxG, oilG, oilMl, parts, material, price, warn };
}

const defaults = () => ({
  waxes: [
    ['Sojawachs (Container)', '0.88', '8', '12'],
    ['Kokos-Soja-Mischung', '0.89', '9', '12'],
    ['Rapswachs', '0.905', '8', '10'],
    ['Paraffin (Container)', '0.88', '8', '12'],
    ['Gelwachs', '0.97', '2', '6'],
  ].map(([name, density, pct, max]) => ({ id: uid(), name, density, price: '', pct, max })),
  oils: [], vessels: [], recipes: [],
  calc: { vesselId: '', waxId: '', oilId: '', fill: '75', pct: '', qty: '1', extras: [] },
  set: { markupOn: false, markupPct: '150' },
});
function uid() { return Math.random().toString(36).slice(2, 9); }

if (typeof module !== 'undefined') module.exports = { calc, vesselMl, r05, defaults };

// ---------- Oberfläche ----------
if (typeof document !== 'undefined') (() => {
  const KEY = 'dessertkerzen.v1';
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.waxes) return s; } catch (e) {} return defaults(); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  let S = load(), tab = 'calc';
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
    if (!r.vol || !S.waxes.find(w => w.id === c.waxId)) return '<p class="hint">Gefäß und Wachs wählen, dann erscheint die Rechnung.</p>';
    const p = r.parts;
    return `<div class="price"><small>${S.set.markupOn ? 'Verkaufspreis' : 'Preis'} (auf 0,50 € gerundet)</small><b>${eur(r.price)}</b></div>` +
      row('Wachs', `${fmt(r.waxG)} g`) + row('Duftöl', `${fmt(r.oilG)} g · ${fmt(r.oilMl)} ml`) +
      `<hr>` + row('Wachs', eur(p.wax)) + row('Duftöl', eur(p.oil)) + row('Gefäß', eur(p.vessel)) + row('Extras', eur(p.extras)) +
      row('Materialkosten', eur(r.material), 'sum') +
      (q > 1 ? `<hr><h3>Für ${q} Kerzen</h3>` + row('Wachs', `${fmt(r.waxG * q / 1000, 2)} kg`) + row('Duftöl', `${fmt(r.oilMl * q)} ml`) +
        row('Materialkosten', eur(r.material * q)) + row('Verkauf', eur(r.price * q)) : '') +
      r.warn.map(w => `<p class="warn">⚠ ${esc(w)}</p>`).join('');
  };

  const views = {
    calc() {
      const c = S.calc;
      return `${S.vessels.length ? '' : '<p class="hint">Lege zuerst im Reiter <b>Gefäße</b> ein Gefäß an.</p>'}
      <section class="card"><h2>Kerze</h2>
        <label class="f"><span>Gefäß</span><select data-c="vesselId">${opts(S.vessels, c.vesselId, '– wählen –')}</select></label>
        <label class="f"><span>Wachs</span><select data-c="waxId">${opts(S.waxes, c.waxId, '– wählen –')}</select></label>
        <label class="f"><span>Duftöl</span><select data-c="oilId">${opts(S.oils, c.oilId, '– ohne –')}</select></label>
        <div class="g3">${inp('data-c="fill"', c.fill, 'Füllgrad', '%')}${inp('data-c="pct"', c.pct, 'Duftöl', '%')}${inp('data-c="qty"', c.qty, 'Stück', '')}</div>
        <h3>Extras pro Kerze</h3>
        ${c.extras.map(e => `<div class="ex"><input data-x="${e.id}" data-f="name" value="${esc(e.name)}" placeholder="z. B. Docht, Sahne-Deko">
          <div class="in"><input type="number" inputmode="decimal" step="any" min="0" data-x="${e.id}" data-f="price" value="${esc(e.price)}"><i>€</i></div>
          <button class="x" data-a="delx" data-id="${e.id}" aria-label="Löschen">✕</button></div>`).join('')}
        <button class="ghost" data-a="addx">+ Extra-Posten</button>
        <label class="sw"><input type="checkbox" data-s="markupOn" ${S.set.markupOn ? 'checked' : ''}> Prozentaufschlag auf Materialkosten</label>
        ${S.set.markupOn ? inp('data-s="markupPct"', S.set.markupPct, 'Aufschlag', '%') : ''}
      </section>
      <section class="card" id="result"></section>
      <button class="primary" data-a="saverec">Als Rezept speichern</button>`;
    },
    vessels() {
      return `<p class="hint">Entweder ml eintragen oder Maße (Innenmaße bis zur Füllhöhe). Steht ml drin, gilt ml.</p>` +
        S.vessels.map(v => `<section class="card">
          ${L('vessels', v.id, 'name', v.name, 'Name', '', 'text')}
          <label class="f"><span>Form</span><select data-l="vessels" data-id="${v.id}" data-f="shape">
            <option value="round"${v.shape !== 'rect' ? ' selected' : ''}>rund</option><option value="rect"${v.shape === 'rect' ? ' selected' : ''}>rechteckig</option></select></label>
          <div class="g2">${L('vessels', v.id, 'ml', v.ml, 'Volumen', 'ml')}${L('vessels', v.id, 'price', v.price, 'Preis', '€')}</div>
          <div class="g3">${v.shape === 'rect'
            ? L('vessels', v.id, 'l', v.l, 'Länge', 'cm') + L('vessels', v.id, 'w', v.w, 'Breite', 'cm')
            : L('vessels', v.id, 'd', v.d, 'Durchm.', 'cm') + '<span></span>'}${L('vessels', v.id, 'h', v.h, 'Höhe', 'cm')}</div>
          <p class="vol" data-id="${v.id}"></p>
          <button class="ghost" data-a="del" data-l="vessels" data-id="${v.id}">Löschen</button></section>`).join('') +
        `<button class="primary" data-a="add" data-l="vessels">+ Gefäß</button>`;
    },
    stock() {
      return `<h2>Wachs</h2><p class="hint">Dichte in g/ml. Duftöl-% ist deine Standard-Dosierung, Max. der Herstellerwert.</p>` +
        S.waxes.map(w => `<section class="card">${L('waxes', w.id, 'name', w.name, 'Name', '', 'text')}
          <div class="g2">${L('waxes', w.id, 'price', w.price, 'Preis', '€/kg')}${L('waxes', w.id, 'density', w.density, 'Dichte', 'g/ml')}</div>
          <div class="g2">${L('waxes', w.id, 'pct', w.pct, 'Duftöl Standard', '%')}${L('waxes', w.id, 'max', w.max, 'Duftöl Max.', '%')}</div>
          <button class="ghost" data-a="del" data-l="waxes" data-id="${w.id}">Löschen</button></section>`).join('') +
        `<button class="primary" data-a="add" data-l="waxes">+ Wachs</button><h2>Duftöl</h2>` +
        S.oils.map(o => `<section class="card">${L('oils', o.id, 'name', o.name, 'Name', '', 'text')}${L('oils', o.id, 'price', o.price, 'Preis', '€/ml')}
          <button class="ghost" data-a="del" data-l="oils" data-id="${o.id}">Löschen</button></section>`).join('') +
        `<button class="primary" data-a="add" data-l="oils">+ Duftöl</button>`;
    },
    rec() {
      if (!S.recipes.length) return '<p class="hint">Noch keine Rezepte. Im Kalkulator „Als Rezept speichern“ tippen.</p>';
      return S.recipes.map(r => {
        const vid = rv[r.id] || r.c.vesselId, c = { ...r.c, vesselId: vid };
        return `<section class="card">${L('recipes', r.id, 'name', r.name, 'Rezept', '', 'text')}
          <label class="f"><span>Umrechnen auf Gefäß</span><select data-rv="${r.id}">${opts(S.vessels, vid, '– wählen –')}</select></label>
          ${summary(c, 1)}
          <div class="g2"><button class="primary" data-a="loadrec" data-id="${r.id}">In Kalkulator</button>
          <button class="ghost" data-a="del" data-l="recipes" data-id="${r.id}">Löschen</button></div></section>`;
      }).join('');
    },
  };

  function updateLive() {
    const r = $('#result'); if (r) r.innerHTML = summary(S.calc, Math.max(1, num(S.calc.qty) || 1));
    document.querySelectorAll('.vol').forEach(p => {
      const v = S.vessels.find(x => x.id === p.dataset.id);
      p.textContent = v ? `Volumen: ${fmt(vesselMl(v), 0)} ml` : '';
    });
  }
  function render() {
    $('#app').innerHTML = views[tab]();
    document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    updateLive();
  }

  document.addEventListener('input', e => {
    const t = e.target, d = t.dataset, val = t.type === 'checkbox' ? t.checked : t.value;
    if (d.l) S[d.l].find(x => x.id === d.id)[d.f] = val;
    else if (d.c) {
      S.calc[d.c] = val;
      if (d.c === 'waxId') { const w = S.waxes.find(x => x.id === val); if (w) S.calc.pct = w.pct; }
    } else if (d.x) S.calc.extras.find(x => x.id === d.x)[d.f] = val;
    else if (d.s) S.set[d.s] = val;
    else if (d.rv) rv[d.rv] = val;
    else return;
    save();
    if (t.tagName === 'SELECT' || t.type === 'checkbox') render(); else updateLive();
  });

  const clone = o => JSON.parse(JSON.stringify(o));
  const blank = {
    vessels: () => ({ id: uid(), name: '', shape: 'round', ml: '', d: '', l: '', w: '', h: '', price: '' }),
    waxes: () => ({ id: uid(), name: '', density: '0.88', price: '', pct: '8', max: '10' }),
    oils: () => ({ id: uid(), name: '', price: '' }),
  };
  const act = {
    add: d => S[d.l].push(blank[d.l]()),
    del: d => { if (confirm('Wirklich löschen?')) S[d.l] = S[d.l].filter(x => x.id !== d.id); },
    addx: () => S.calc.extras.push({ id: uid(), name: '', price: '' }),
    delx: d => { S.calc.extras = S.calc.extras.filter(x => x.id !== d.id); },
    saverec: () => {
      const name = prompt('Name des Rezepts?'); if (!name) return;
      S.recipes.push({ id: uid(), name, c: clone(S.calc) }); tab = 'rec';
    },
    loadrec: d => { const r = S.recipes.find(x => x.id === d.id); S.calc = { ...clone(r.c), vesselId: rv[d.id] || r.c.vesselId }; tab = 'calc'; },
    info: () => $('#dlg').showModal(),
    close: () => $('#dlg').close(),
    export: () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
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
    rd.onload = () => {
      try {
        const s = JSON.parse(rd.result);
        if (!s.waxes || !s.calc) throw 0;
        if (confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) { S = s; save(); render(); $('#dlg').close(); }
      } catch (x) { alert('Diese Datei ist keine gültige Sicherung.'); }
    };
    rd.readAsText(f); e.target.value = '';
  });

  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
