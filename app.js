(()=>{
'use strict';
const $=s=>document.querySelector(s), code=$('#code'), canvas=$('#canvas'), ctx=canvas.getContext('2d');
const state={result:null,selectedLine:null};
const C={G00:'#f87171',G01:'#38a9ff',G02:'#34d399',G03:'#f5c451'};
const lines=()=>code.value.replace(/\r/g,'').split('\n');
function updateLines(){const a=lines();$('#lineNumbers').innerHTML=a.map((_,i)=>`<div>${i+1}</div>`).join('');}
function parse(){state.result=CNCEngine.parse(code.value,{mode:'milling',controller:'FANUC'});draw();}
function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0);draw();}
function bounds(){return state.result?.bounds||{minX:0,maxX:100,minY:0,maxY:100};}
function world(x,y){const b=bounds(),w=canvas.clientWidth,h=canvas.clientHeight;const sx=Math.max(1,b.maxX-b.minX),sy=Math.max(1,b.maxY-b.minY);const pad=90;const s=Math.min((w-pad*2)/sx,(h-pad*2)/sy);return [w/2+(x-(b.minX+b.maxX)/2)*s,h/2-(y-(b.minY+b.maxY)/2)*s]}
function arrow(x1,y1,x2,y2,size=7){const a=Math.atan2(y2-y1,x2-x1);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-size*Math.cos(a-.48),y2-size*Math.sin(a-.48));ctx.lineTo(x2-size*Math.cos(a+.48),y2-size*Math.sin(a+.48));ctx.closePath();ctx.fill();}
function dimH(x1,x2,y,refY,label){const a=world(x1,refY),b=world(x2,refY),ya=world(x1,y)[1],xA=a[0],xB=b[0];ctx.strokeStyle='#f5d76e';ctx.fillStyle='#f5d76e';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(xA,a[1]);ctx.lineTo(xA,ya);ctx.moveTo(xB,b[1]);ctx.lineTo(xB,ya);ctx.moveTo(xA,ya);ctx.lineTo(xB,ya);ctx.stroke();arrow(xA,ya,xA+1,ya);arrow(xB,ya,xB-1,ya);ctx.font='15px Arial';ctx.textAlign='center';ctx.fillText(label,(xA+xB)/2,ya-7);}
function dimV(y1,y2,x,refX,label){const a=world(refX,y1),b=world(refX,y2),xa=world(x,y1)[0],yA=a[1],yB=b[1];ctx.strokeStyle='#f5d76e';ctx.fillStyle='#f5d76e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a[0],yA);ctx.lineTo(xa,yA);ctx.moveTo(b[0],yB);ctx.lineTo(xa,yB);ctx.moveTo(xa,yA);ctx.lineTo(xa,yB);ctx.stroke();arrow(xa,yA,xa,yA+1);arrow(xa,yB,xa,yB-1);ctx.font='15px Arial';ctx.textAlign='center';ctx.save();ctx.translate(xa-9,(yA+yB)/2);ctx.rotate(-Math.PI/2);ctx.fillText(label,0,0);ctx.restore();}
function radiusDim(seg){const m=seg.meta;if(!m?.arcCenter||!m.arcRadius)return;const c=world(m.arcCenter.x,m.arcCenter.y),p=world(m.arcStartPoint.x,m.arcStartPoint.y);ctx.strokeStyle='#ff5b62';ctx.fillStyle='#ff5b62';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c[0],c[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();arrow(c[0],c[1],p[0],p[1]);ctx.font='16px Arial';ctx.textAlign='left';ctx.fillText(`R${Number(m.arcRadius.toFixed(3))}`,p[0]+8,p[1]-6);}
function drawDims(){const r=state.result;if(!r?.segments.length)return;const b=r.bounds;
 // Overall width/height outside the profile. Diagonal moves are intentionally not dimensioned.
 dimH(b.minX,b.maxX,b.minY- Math.max(12,(b.maxY-b.minY)*.10),b.minY,Number((b.maxX-b.minX).toFixed(3)));
 dimV(b.minY,b.maxY,b.minX- Math.max(12,(b.maxX-b.minX)*.10),b.minX,Number((b.maxY-b.minY).toFixed(3)));
 // Unique horizontal/vertical feature distances, placed on alternating outer lanes.
 const seen=new Set(), hs=[],vs=[], arcs=[];
 for(const s of r.segments){if(s.meta?.arc){if(!arcs.some(a=>a.line===s.line))arcs.push(s);continue}const dx=s.x2-s.x,dy=s.y2-s.y;if(Math.abs(dx)>1e-7&&Math.abs(dy)<1e-7){const key=`h${Math.min(s.x,s.x2).toFixed(3)},${Math.max(s.x,s.x2).toFixed(3)},${s.y.toFixed(3)}`;if(!seen.has(key)&&Math.abs(dx)>1){seen.add(key);hs.push(s)}}else if(Math.abs(dy)>1e-7&&Math.abs(dx)<1e-7){const key=`v${s.x.toFixed(3)},${Math.min(s.y,s.y2).toFixed(3)},${Math.max(s.y,s.y2).toFixed(3)}`;if(!seen.has(key)&&Math.abs(dy)>1){seen.add(key);vs.push(s)}}}
 hs.slice(0,5).forEach((s,i)=>dimH(s.x,s.x2,s.y+(i%2?10:-10),s.y,Math.abs(s.x2-s.x).toFixed(3)));
 vs.slice(0,5).forEach((s,i)=>dimV(s.y,s.y2,s.x+(i%2?10:-10),s.x,Math.abs(s.y2-s.y).toFixed(3)));
 arcs.slice(0,6).forEach(radiusDim);
}
function axes(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.strokeStyle='#30404d';ctx.fillStyle='#718394';ctx.lineWidth=1;ctx.setLineDash([]);const o=world(0,0);if(o[1]>0&&o[1]<h){ctx.beginPath();ctx.moveTo(0,o[1]);ctx.lineTo(w,o[1]);ctx.stroke()}if(o[0]>0&&o[0]<w){ctx.beginPath();ctx.moveTo(o[0],0);ctx.lineTo(o[0],h);ctx.stroke()}if(o[0]>0&&o[0]<w&&o[1]>0&&o[1]<h){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(o[0],o[1],4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9aa9b8';ctx.font='11px Consolas';ctx.fillText('X0 Y0',o[0]+8,o[1]-8)}}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d12';ctx.fillRect(0,0,w,h);const r=state.result;if(!r?.segments.length)return;ctx.lineCap='round';let i=0;while(i<r.segments.length){const s=r.segments[i],sel=state.selectedLine===s.line;ctx.strokeStyle=sel?'#fff':(C[s.g]||'#dbe4ec');ctx.lineWidth=sel?3:2;ctx.setLineDash(s.rapid?[6,5]:[]);if(s.meta?.arc&&s.meta.arcCenter){const m=s.meta,c=world(m.arcCenter.x,m.arcCenter.y),sp=world(m.arcStartPoint.x,m.arcStartPoint.y),rr=Math.hypot(sp[0]-c[0],sp[1]-c[1]);let a0=Math.atan2(sp[1]-c[1],sp[0]-c[0]),a1=a0+(m.cw?1:-1)*Math.abs(m.arcSweep||0);ctx.beginPath();ctx.arc(c[0],c[1],rr,a0,a1,m.cw?false:true);ctx.stroke();let j=i+1;while(j<r.segments.length&&r.segments[j].line===s.line&&r.segments[j].meta?.arc)j++;i=j;continue}const a=world(s.x,s.y),b=world(s.x2,s.y2);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();i++}ctx.setLineDash([]);drawDims();axes();}
function selectLine(n){state.selectedLine=n;const a=lines(),p=a.slice(0,n-1).reduce((x,v)=>x+v.length+1,0);code.focus();code.setSelectionRange(p,p+(a[n-1]||'').length);code.scrollTop=Math.max(0,(n-3)*parseFloat(getComputedStyle(code).lineHeight||20));$('#lineNumbers').scrollTop=code.scrollTop;draw()}
canvas.addEventListener('click',e=>{const rect=canvas.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top,r=state.result;if(!r)return;let best=null,bd=10;for(const s of r.segments){const a=world(s.x,s.y),b=world(s.x2,s.y2);const vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((mx-a[0])*vx+(my-a[1])*vy)/(vx*vx+vy*vy||1))),px=a[0]+t*vx,py=a[1]+t*vy,d=Math.hypot(mx-px,my-py);if(d<bd){bd=d;best=s.line}}if(best)selectLine(best)});
code.addEventListener('input',()=>{updateLines();parse()});code.addEventListener('scroll',()=>$('#lineNumbers').scrollTop=code.scrollTop);

window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([code.value],{type:'text/plain'}));a.download='program.nc';a.click()}});
const demo=`%\nN00 G54 G90 S500 M03\nN01 G00 X40 Y40\nN02 G01 Z-2 F50\nN03 G01 X40 Y145\nN04 G01 X65 Y170\nN05 G01 X140 Y170\nN06 G02 X140 Y120 I0 J-25\nN07 G03 X140 Y80 I0 J-20\nN08 G01 X115 Y80\nN09 G01 X140 Y40\nN10 G01 X40 Y40\nN11 G00 Z5\nN12 M05\nN13 M02\n%`;
code.value=demo;updateLines();parse();
})();
