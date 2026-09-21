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
console.log('ok');
