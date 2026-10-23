// Ausführen: node test.js
const assert = require('assert');
const { calc, vesselMl, r05, defaults } = require('./app.js');

const S = defaults();
S.vessels = [{ id: 'v', shape: 'round', ml: '', d: '8', h: '8', price: '1.2' }];
S.oils = [{ id: 'o', name: 'Vanille', price: '0.30' }];
S.waxes[0].price = '10'; // Soja 0,88 g/ml, 8 %
const soja = S.waxes[0].id;
const c = { vesselId: 'v', waxId: soja, oilId: 'o', fill: '75', pct: '8', qty: '1', extras: [{ id: 'e', name: 'Docht', price: '0.40' }] };

// Volumen rund: pi*4²*8 = 402,1 ml; ml hat Vorrang; rechteckig: l*w*h
assert.ok(Math.abs(vesselMl(S.vessels[0]) - 402.12) < 0.1);
assert.equal(vesselMl({ ml: '200', d: '8', h: '8' }), 200);
assert.equal(vesselMl({ shape: 'rect', l: '10', w: '5', h: '4' }), 200);

const r = calc(S, c);
assert.ok(Math.abs(r.waxG - 402.12 * 0.75 * 0.88) < 0.01);       // ≈ 265,4 g
assert.ok(Math.abs(r.oilG - r.waxG * 0.08) < 1e-9);               // 8 % vom Wachsgewicht
assert.ok(Math.abs(r.parts.wax - r.waxG / 1000 * 10) < 1e-9);
assert.ok(Math.abs(r.material - (r.parts.wax + r.parts.oil + 1.2 + 0.4)) < 1e-9);
assert.equal(r.price, r05(r.material));                            // ohne Aufschlag
S.set.markupOn = true; S.set.markupPct = '150';
assert.equal(calc(S, c).price, r05(r.material * 2.5));             // mit Aufschlag
assert.equal(r05(3.24), 3); assert.equal(r05(3.26), 3.5); assert.equal(r05(3.75), 4);
assert.equal(calc(S, { ...c, pct: '15' }).warn.length, 1);         // über Herstellermaximum (12 %)

// Modus „Nach Gewicht“: Gesamtgewicht = Wachs + Öl, Öl-% vom Wachs
const w = calc(S, { ...c, mode: 'weight', total: '270', pct: '8', vesselId: '' });
assert.ok(Math.abs(w.waxG - 250) < 1e-9);                          // 270 / 1,08
assert.ok(Math.abs(w.oilG - 20) < 1e-9);
assert.ok(Math.abs(w.waxG + w.oilG - 270) < 1e-9);
assert.equal(w.parts.vessel, 0);                                   // ohne Gefäß kein Gefäßpreis
assert.ok(Math.abs(w.parts.wax - 2.5) < 1e-9);                     // 250 g à 10 €/kg
assert.ok(Math.abs(w.parts.oil - 20 / 0.95 * 0.3) < 1e-9);
assert.equal(calc(S, { ...c, mode: 'weight', total: '270', pct: '8' }).parts.vessel, 1.2); // optionales Gefäß
assert.equal(calc(S, { ...c, mode: 'weight', total: '', pct: '8' }).waxG, 0);              // leere Eingabe

// Mehrere Wachssorten: erste Sorte = Rest auf 100 %, weitere Sorten mit festem Anteil
const raps = S.waxes[2].id, kokos = S.waxes[1].id;
S.waxes[2].price = '8'; // Rapswachs 0,905 g/ml, 8 %, Max. 10 %
const mixW = { ...c, mode: 'weight', total: '270', pct: '8', vesselId: '', mix: [{ id: 'm1', waxId: raps, share: '40' }] };
const m1 = calc(S, mixW);
assert.ok(Math.abs(m1.waxG - 250) < 1e-9);                         // Gesamtgewicht gleich, nur andere Aufteilung
assert.equal(m1.waxes.length, 2);
assert.ok(Math.abs(m1.waxes[0].g - 150) < 1e-9 && Math.abs(m1.waxes[1].g - 100) < 1e-9); // 60 % Soja / 40 % Raps
assert.ok(Math.abs(m1.parts.wax - (0.15 * 10 + 0.1 * 8)) < 1e-9);   // Kosten je Sorte
assert.equal(m1.warn.length, 0);
// Dichte im Gefäßmodus: 1 / Σ(Anteil / Dichte)
const mv = calc(S, { ...c, mix: [{ id: 'm1', waxId: raps, share: '40' }], pct: '8' });
assert.ok(Math.abs(mv.waxG - 402.12 * 0.75 / (0.6 / 0.88 + 0.4 / 0.905)) < 0.01);
// Ohne weitere Sorten bleibt alles wie vorher; leere Auswahl in einer Zeile wird ignoriert
assert.equal(calc(S, { ...c, mix: [] }).waxG, calc(S, c).waxG);
assert.equal(calc(S, { ...c, mix: [{ id: 'm1', waxId: '', share: '50' }] }).waxes.length, 1);
// Strengstes Duftöl-Maximum der Mischung (Soja 12 %, Raps 10 %)
const mw = calc(S, { ...mixW, pct: '11' });
assert.equal(mw.warn.length, 1); assert.ok(mw.warn[0].includes('10 %'));
assert.equal(calc(S, { ...mixW, pct: '9' }).warn.length, 0);
// Anteile über 100 %: normiert und gewarnt; Rest 0 → erste Sorte entfällt
const over = calc(S, { ...mixW, mix: [{ id: 'a', waxId: raps, share: '70' }, { id: 'b', waxId: kokos, share: '50' }] });
assert.equal(waxMixShareSum(over), 100); assert.ok(over.warn.some(x => x.includes('über 100')));
function waxMixShareSum(r) { return Math.round(r.waxes.reduce((s, x) => s + x.share, 0)); }
assert.equal(calc(S, { ...mixW, mix: [{ id: 'a', waxId: raps, share: '100' }] }).waxes.length, 1);
// Standard-Duftöl-% der Mischung gewichtet (Soja 8 %, Kokos-Soja 9 %)
const { stdPct, waxMix } = require('./app.js');
assert.equal(stdPct(S, { ...c, mix: [{ id: 'a', waxId: kokos, share: '50' }] }), '8.5');
assert.equal(stdPct(S, { ...c, mix: [] }), '8');
assert.equal(stdPct(S, { ...c, waxId: '', mix: [] }), c.pct);       // ohne Wachs unverändert
assert.equal(waxMix(S, { ...c, mix: [{ id: 'a', waxId: kokos, share: '30' }] }).rest, 70);
console.log('ok');
