const assert = require('node:assert/strict');
global.window = global;
require('../cnc-engine.js');
const parse = (code, options = {}) => CNCEngine.parse(code, {mode: 'turning', ...options});
for (const controller of ['FANUC', 'HAAS', 'LINUXCNC']) {
  const r = parse('G18 G00 X40 Z0\nG01 X20 Z-10', {controller});
  assert.equal(r.state.x, 10);
  assert.equal(r.segments.at(-1).x2, 10);
  assert.equal(r.segments.at(-1).y2, -10);
  assert.equal(r.segments.at(-1).meta.state.diameterMode, true);
  const arc = parse('G18 G00 X40 Z0\nG03 X20 Z-10 CR=10', {controller});
  assert(arc.segments.some(s => s.meta.arc));
  for (const s of arc.segments.filter(s => s.meta.arc)) {
    assert(Math.abs(s.meta.arcRadius - 10) < 1e-9);
    assert(Math.abs(Math.hypot(s.x2-s.meta.arcCenter.x, s.y2-s.meta.arcCenter.y)-10) < 1e-9);
  }
  assert(Math.abs(arc.segments.at(-1).x2-10)<1e-9);
  const circle = parse('G18 G00 X40 Z0\nG02 I-10 K0', {controller});
  const parts = circle.segments.filter(s=>s.meta.arc);
  assert(parts.length>8);
  assert(Math.abs(parts[0].meta.arcSweep + Math.PI*2)<1e-9);
  assert(Math.abs(parts.at(-1).x2-20)<1e-9);
  assert(Math.abs(parts.at(-1).y2)<1e-9);
}
assert.equal(parse('G00 X40\nG91 G01 X-10', {controller:'LINUXCNC'}).state.x,15);
assert.equal(parse('G8 G00 X40\nG7 G01 X40').state.x,20);
assert.equal(parse('G00 X40\nG01 X20',{mode:'milling'}).state.x,20);
console.log('PASS: turning X/2, incremental X, G7/G8, CR radius, full I/K circles, milling unchanged');
