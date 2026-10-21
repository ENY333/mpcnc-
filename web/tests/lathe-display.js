const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
global.window = global;
require('../cnc-engine.js');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const context = {state: {mode: 'turning'}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function canvasResult('), source.indexOf('function planeAxes(')), context);
const code = 'G18 G00 X40 Z0\nG01 Z-20\nG03 X20 Z-30 CR=10\nG02 I-5 K0';
const parsed = CNCEngine.parse(code, {mode: 'turning'});
const display = context.canvasResult(parsed);
const mirror = display.segments.map(context.mirrorLatheSegment);
const straight = display.segments.find(s=>s.line===2);
const opposite = mirror.find(s=>s.line===2);
assert.equal(straight.x2, -20); // Z is horizontal.
assert.equal(straight.y2, 20); // X40 diameter becomes +20 radius.
assert.equal(opposite.x2, -20);
assert.equal(opposite.y2, -20);
assert.equal(straight.line, opposite.line);
assert.equal(display.segments.length, parsed.segments.length); // Simulation is not doubled.
assert.equal(display.totalLength, parsed.totalLength);
for(let i=0;i<display.segments.length;i++){
 const a=display.segments[i],b=mirror[i];
 assert.equal(a.line,b.line);
 assert.equal(a.x2,b.x2);
 assert.equal(a.y2,-b.y2);
 if(a.meta.arc){
  assert.equal(a.meta.arcRadius,b.meta.arcRadius);
  assert.equal(a.meta.arcSweep,-b.meta.arcSweep);
  assert(Math.abs(Math.hypot(b.x2-b.meta.arcCenter.x,b.y2-b.meta.arcCenter.y)-b.meta.arcRadius)<1e-9);
 }
}
context.state.mode='milling';
assert.equal(context.canvasResult(parsed),parsed);
console.log('PASS: Ø40 shown at +20/-20, Z horizontal, mirrored arcs/circles, same source lines, original simulation metrics, milling unchanged');
