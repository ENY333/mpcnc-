(()=>{
'use strict';
const $=s=>document.querySelector(s), code=$('#code'), canvas=$('#canvas'), ctx=canvas.getContext('2d');
const state={mode:'milling',controller:'FANUC',result:null,step:0,running:false,paused:false,timer:null,autoFit:true,selectedLine:null,panX:0,panY:0};
const COLORS={G00:'#f87171',G01:'#38a9ff',G02:'#34d399',G03:'#f5c451'};
const TAU=Math.PI*2;
const unitName=()=>state.result?.state?.units==='G20'?'in':'mm';
function lines(){return code.value.replace(/\r/g,'').split('\n')}
function fmt(v){return Number(v||0).toFixed(3)}
function trim(v){let n=Number(v);if(!Number.isFinite(n))return '';if(Math.abs(n)<1e-9)n=0;return Number(n.toFixed(3)).toString()}
function updateLines(){const ls=lines();$('#lineNumbers').innerHTML=ls.map((_,i)=>`<div class="${state.selectedLine===i+1?'active':''}">${i+1}</div>`).join('');const ml=$('#metricLines');if(ml)ml.textContent=ls.length;cursor()}
function cursor(){const n=code.value.slice(0,code.selectionStart).split('\n').length;const c=$('#cursorInfo');if(c)c.textContent=`Dòng ${n} / ${lines().length}`}
function parse(){
 clearInterval(state.timer);state.running=false;state.paused=false;
 state.result=CNCEngine.parse(code.value,{mode:state.mode,controller:state.controller});state.step=0;
 if(state.autoFit){state.panX=0;state.panY=0}
 const r=state.result,s=r.state;
 const ml=$('#metricLength'),mt=$('#metricTime'),ms=$('#metricState');
 if(ml)ml.textContent=fmt(r.totalLength)+' '+unitName();
 if(mt)mt.textContent=s.f>0?`${Math.floor(r.totalLength/s.f/60)}:${String(Math.floor(r.totalLength/s.f)%60).padStart(2,'0')}`:'0:00';
 ['x','y','z'].forEach(k=>{const a=$('#m'+k),b=$('#'+k+'Pos');if(a)a.textContent=fmt(s[k]);if(b)b.textContent=fmt(s[k])});
 ['f','s','t'].forEach((k,i)=>{const id=['mf','ms','mt'][i],el=$('#'+id);if(el)el.textContent=fmt([s.f,s.spindle,s.tool][i])});
 const mb=$('#modeBadge');if(mb)mb.textContent='';const cb=$('#controllerBadge');if(cb)cb.textContent='';
 const st=$('#statusText');if(st)st.textContent=r.errors.length?`Có ${r.errors.length} lỗi`:`Sẵn sàng • ${r.segments.length} đoạn`;
 const hint=$('#emptyHint');if(hint)hint.classList.toggle('hidden',!r.segments.length);
 draw();diagnostics();updateLines();
}
function diagnostics(){const d=state.result?.diagnostics||[],count=$('#diagCount'),list=$('#diagList');if(count)count.textContent=d.length;if(list)list.innerHTML=d.length?d.slice(-40).map(x=>`<button class="diag ${x.severity}" data-line="${x.line}"><b>L${x.line}</b> ${escapeHtml(x.message)} ${x.code?`<span>${x.code}</span>`:''}</button>`).join(''):'<div class="diag empty">Không có cảnh báo</div>';list?.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>gotoLine(Number(b.dataset.line)))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function gotoLine(n){const ls=lines();let p=0;for(let i=1;i<n;i++)p+=ls[i-1].length+1;code.focus();code.setSelectionRange(p,p+(ls[n-1]?.length||0));state.selectedLine=n;keepCodeLineVisible(n);updateLines();draw()}
function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw()}
function getFit(){
 const w=canvas.clientWidth,h=canvas.clientHeight,b=state.result?.bounds;
 if(!b)return {scale:1,left:w/2,top:h/2};
 const margin=Math.max(55,Math.min(110,Math.min(w,h)*.12));
 const sx=Math.max(1e-6,b.maxX-b.minX),sy=Math.max(1e-6,b.maxY-b.minY);
 const scale=Math.max(.001,Math.min((w-margin*2)/sx,(h-margin*2)/sy));
 const usedW=sx*scale,usedH=sy*scale;
 return {scale,left:(w-usedW)/2,top:(h-usedH)/2};
}
// Correct Y transform kept separate to avoid operator-precedence mistakes.
function W(x,y){const f=getFit(),b=state.result?.bounds;if(!b)return[canvas.clientWidth/2,canvas.clientHeight/2];return[f.left+(x-b.minX)*f.scale+state.panX,f.top+(b.maxY-y)*f.scale+state.panY]}
function drawArrow(x,y,a,size=5){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-size*Math.cos(a-Math.PI/6),y-size*Math.sin(a-Math.PI/6));ctx.lineTo(x-size*Math.cos(a+Math.PI/6),y-size*Math.sin(a+Math.PI/6));ctx.closePath();ctx.fill()}
function textBox(text,x,y,angle=0,font='12px Arial'){ctx.save();ctx.font=font;const m=ctx.measureText(text),ww=m.width+10,hh=18;ctx.restore();const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));return{x:x-(ww*c+hh*s)/2,y:y-(ww*s+hh*c)/2,w:ww*c+hh*s,h:ww*s+hh*c}}
function dimText(text,x,y,angle=0,color='#f5c451'){ctx.save();ctx.font='12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.translate(x,y);ctx.rotate(angle);const m=ctx.measureText(text),ww=m.width+8,hh=18;ctx.fillStyle='rgba(8,13,18,.97)';ctx.fillRect(-ww/2,-hh/2,ww,hh);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore()}
function overlap(a,b,g=6){return !(a.x+a.w+g<b.x||b.x+b.w+g<a.x||a.y+a.h+g<b.y||b.y+b.h+g<a.y)}
function addIfFree(occupied,q,w,h){if(!q||q.x<4||q.y<4||q.x+q.w>w-4||q.y+q.h>h-4)return false;if(occupied.some(o=>overlap(o,q,4)))return false;occupied.push(q);return true}
function drawDimH(p1,p2,y,label,occupied,side){
 const a=Math.min(p1,p2),b=Math.max(p1,p2);if(b-a<20)return false;const w=canvas.clientWidth,h=canvas.clientHeight;
 ctx.save();ctx.strokeStyle='rgba(224,232,239,.82)';ctx.fillStyle='#e3eaf0';ctx.lineWidth=1;ctx.setLineDash([]);
 ctx.beginPath();ctx.moveTo(a,side==='top'?currentBox.top:currentBox.bottom);ctx.lineTo(a,y);ctx.moveTo(b,side==='top'?currentBox.top:currentBox.bottom);ctx.lineTo(b,y);ctx.moveTo(a,y);ctx.lineTo(b,y);ctx.stroke();
 drawArrow(a,y,0,5);drawArrow(b,y,Math.PI,5);const q=textBox(label,(a+b)/2,y);const ok=addIfFree(occupied,q,w,h);if(ok)dimText(label,(a+b)/2,y,0,'#f5c451');ctx.restore();return ok;
}
let currentBox={top:0,bottom:0,left:0,right:0};
function drawDimV(p1,p2,x,label,occupied,side){const a=Math.min(p1,p2),b=Math.max(p1,p2);if(b-a<20)return false;const w=canvas.clientWidth,h=canvas.clientHeight;ctx.save();ctx.strokeStyle='rgba(224,232,239,.82)';ctx.fillStyle='#e3eaf0';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(side==='left'?currentBox.left:currentBox.right,a);ctx.lineTo(x,a);ctx.moveTo(side==='left'?currentBox.left:currentBox.right,b);ctx.lineTo(x,b);ctx.moveTo(x,a);ctx.lineTo(x,b);ctx.stroke();drawArrow(x,a,Math.PI/2,5);drawArrow(x,b,-Math.PI/2,5);const q=textBox(label,x,(a+b)/2,-Math.PI/2);const ok=addIfFree(occupied,q,w,h);if(ok)dimText(label,x,(a+b)/2,-Math.PI/2,'#f5c451');ctx.restore();return ok}
function unique(vals){return [...new Set(vals.map(v=>Number(v.toFixed(3))))].sort((a,b)=>a-b)}
function drawDimensions(){
 const r=state.result,b=r?.bounds;if(!r||!b||!r.segments.length)return;const w=canvas.clientWidth,h=canvas.clientHeight;
 const p1=W(b.minX,b.minY),p2=W(b.maxX,b.maxY);currentBox={left:p1[0],right:p2[0],top:p2[1],bottom:p1[1]};
 const occ=[];const spanX=b.maxX-b.minX,spanY=b.maxY-b.minY;const gap=Math.max(24,Math.min(38,Math.min(w,h)*.055));
 // Overall dimensions first.
 let y=currentBox.top-gap;let ok=false;for(let i=0;i<4&&!ok;i++,y-=gap)ok=drawDimH(currentBox.left,currentBox.right,y,trim(spanX),occ,'top');
 let x=currentBox.left-gap;ok=false;for(let i=0;i<4&&!ok;i++,x-=gap)ok=drawDimV(currentBox.top,currentBox.bottom,x,trim(spanY),occ,'left');
 // Dimension significant horizontal/vertical machining moves, not diagonal lengths.
 const hs=[],vs=[],arc=[];
 for(const s of r.segments){if(s.rapid||s.g==='G00')continue;const x1=Number(s.x),y1=Number(s.y),x2=Number(s.x2),y2=Number(s.y2);if(![x1,y1,x2,y2].every(Number.isFinite))continue;
   if(s.meta?.arc){if(Number.isFinite(s.meta.arcRadius)&&s.meta.arcRadius>0)arc.push(s);continue}
   const dx=Math.abs(x2-x1),dy=Math.abs(y2-y1);if(dy<1e-7&&dx>=8)hs.push({a:x1,b:x2,y:y1,d:dx});else if(dx<1e-7&&dy>=8)vs.push({a:y1,b:y2,x:x1,d:dy});
 }
 // De-duplicate repeated lengths/coordinates and keep only the most useful few.
 const hseen=new Set(),vseen=new Set();const hsel=[];for(const q of hs){const k=[Math.min(q.a,q.b).toFixed(3),Math.max(q.a,q.b).toFixed(3)].join('|');if(!hseen.has(k)){hseen.add(k);hsel.push(q)}}
 const vsel=[];for(const q of vs){const k=[Math.min(q.a,q.b).toFixed(3),Math.max(q.a,q.b).toFixed(3)].join('|');if(!vseen.has(k)){vseen.add(k);vsel.push(q)}}
 hsel.sort((a,b)=>b.d-a.d);vsel.sort((a,b)=>b.d-a.d);
 // At most three detail dimensions per side; this is deliberately sparse like a technical drawing.
 let topLane=2,bottomLane=2;for(const q of hsel.slice(0,6)){const A=W(q.a,q.y)[0],B=W(q.b,q.y)[0];const nearTop=q.y>(b.minY+b.maxY)/2;const side=nearTop?'top':'bottom';const yy=side==='top'?currentBox.top-gap*topLane:currentBox.bottom+gap*bottomLane;const placed=drawDimH(A,B,yy,trim(q.d),occ,side);if(placed)(side==='top'?topLane++:bottomLane++)}
 let leftLane=2,rightLane=2;for(const q of vsel.slice(0,6)){const A=W(q.x,q.a)[1],B=W(q.x,q.b)[1];const nearLeft=q.x<(b.minX+b.maxX)/2;const side=nearLeft?'left':'right';const xx=side==='left'?currentBox.left-gap*leftLane:currentBox.right+gap*rightLane;const placed=drawDimV(A,B,xx,trim(q.d),occ,side);if(placed)(side==='left'?leftLane++:rightLane++)}
 // Arc radius labels are leaders outside the contour. Only one label per distinct radius.
 const radii=[];const rs=new Set();for(const s of arc){const rr=Number(s.meta.arcRadius);const key=rr.toFixed(3);if(!rs.has(key)){rs.add(key);radii.push(s)}}
 for(const s of radii.slice(0,4)){const m=s.meta,c=W(m.arcCenter.x,m.arcCenter.y),ep=W(m.arcEndPoint.x,m.arcEndPoint.y);const vx=ep[0]-c[0],vy=ep[1]-c[1],L=Math.hypot(vx,vy)||1;const tx=ep[0]+vx/L*30,ty=ep[1]+vy/L*30;const label=`R${trim(m.arcRadius)}`;if(tx>currentBox.left&&tx<currentBox.right&&ty>currentBox.top&&ty<currentBox.bottom){const candidates=[[currentBox.right+42,ty],[currentBox.left-42,ty],[(currentBox.left+currentBox.right)/2,currentBox.top-42],[(currentBox.left+currentBox.right)/2,currentBox.bottom+42]];for(const cnd of candidates){if(cnd[0]<4||cnd[1]<4||cnd[0]>w-4||cnd[1]>h-4)continue;tx=cnd[0];ty=cnd[1];break}}const q=textBox(label,tx,ty);if(!addIfFree(occ,q,w,h))continue;ctx.save();ctx.strokeStyle='rgba(224,232,239,.82)';ctx.fillStyle='#e3eaf0';ctx.beginPath();ctx.moveTo(ep[0],ep[1]);ctx.lineTo(tx,ty);ctx.stroke();drawArrow(ep[0],ep[1],Math.atan2(ep[1]-ty,ep[0]-tx),5);ctx.restore();dimText(label,tx,ty,0,'#ff5b64')}
}
function drawTriad(){const w=canvas.clientWidth;const x=w-90,y=52;ctx.save();ctx.lineWidth=2;ctx.fillStyle='#e9f0f4';ctx.strokeStyle='#e9f0f4';ctx.beginPath();ctx.arc(x,y,6,0,TAU);ctx.fill();ctx.strokeStyle='#ff5b64';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+45,y);ctx.stroke();drawArrow(x+45,y,0,8);ctx.fillStyle='#ff7b83';ctx.font='14px Arial';ctx.fillText('X',x+52,y+5);ctx.strokeStyle='#24d7aa';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-42);ctx.stroke();drawArrow(x,y-42,-Math.PI/2,8);ctx.fillStyle='#40e0b7';ctx.fillText('Y',x-5,y-50);ctx.fillStyle='#cbd6df';ctx.font='11px Consolas,monospace';ctx.fillText(state.mode==='turning'?'X0 Z0':'X0 Y0',x-4,y+20);ctx.restore()}
function drawAxes(){const b=state.result?.bounds;if(!b)return;const w=canvas.clientWidth,h=canvas.clientHeight;const o=W(0,0);ctx.save();ctx.strokeStyle='#334654';ctx.lineWidth=1;ctx.setLineDash([]);if(o[1]>=0&&o[1]<=h){ctx.beginPath();ctx.moveTo(0,o[1]);ctx.lineTo(w,o[1]);ctx.stroke()}if(o[0]>=0&&o[0]<=w){ctx.beginPath();ctx.moveTo(o[0],0);ctx.lineTo(o[0],h);ctx.stroke()}if(o[0]>=0&&o[0]<=w&&o[1]>=0&&o[1]<=h){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(o[0],o[1],4,0,TAU);ctx.fill();ctx.strokeStyle='#38a9ff';ctx.beginPath();ctx.moveTo(o[0]-9,o[1]);ctx.lineTo(o[0]+9,o[1]);ctx.moveTo(o[0],o[1]-9);ctx.lineTo(o[0],o[1]+9);ctx.stroke()}ctx.fillStyle='#718394';ctx.font='10px Consolas,monospace';ctx.fillText('X',w-18,Math.max(12,Math.min(h-6,o[1]-6)));ctx.fillText(state.mode==='turning'?'Z':'Y',Math.min(w-12,Math.max(4,o[0]+7)),13);ctx.restore();drawTriad()}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d12';ctx.fillRect(0,0,w,h);const r=state.result;if(!r)return;let i=0;while(i<r.segments.length){const s=r.segments[i],sel=state.selectedLine===s.line;ctx.strokeStyle=sel?'#ffffff':(COLORS[s.g]||'#d8e2ea');ctx.lineWidth=sel?3:2;ctx.setLineDash(s.rapid?[6,5]:[]);if(s.meta?.arc&&s.meta.arcCenter){const m=s.meta;const c=W(m.arcCenter.x,m.arcCenter.y),sp=W(m.arcStartPoint.x,m.arcStartPoint.y),ep=W(m.arcEndPoint.x,m.arcEndPoint.y),rr=Math.hypot(sp[0]-c[0],sp[1]-c[1]);let a0=Math.atan2(sp[1]-c[1],sp[0]-c[0]),a1=Math.atan2(ep[1]-c[1],ep[0]-c[0]);const anti=!m.cw;let d=a1-a0;if(anti){while(d>0)d-=TAU}else{while(d<0)d+=TAU}const want=Math.abs(Number(m.arcSweep)||0);if(want>0)d=(anti?-1:1)*Math.min(want,TAU);ctx.setLineDash([]);ctx.beginPath();ctx.arc(c[0],c[1],rr,a0,a0+d,anti);ctx.stroke();const line=s.line;while(i<r.segments.length&&r.segments[i].line===line&&r.segments[i].meta?.arc)i++;continue}const a=W(s.x,s.y),bb=W(s.x2,s.y2);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(bb[0],bb[1]);ctx.stroke();i++}ctx.setLineDash([]);drawAxes();drawDimensions()}
function setMode(m){state.mode=m;state.autoFit=true;const t=$('#viewTitle');if(t)t.textContent='2D';parse()}
function reset(){clearInterval(state.timer);state.running=false;state.paused=false;state.step=0;state.selectedLine=null;const m=$('#metricState');if(m)m.textContent='Sẵn sàng';draw();updateLines()}
function keepCodeLineVisible(n){const lh=parseFloat(getComputedStyle(code).lineHeight)||19,top=(n-1)*lh,bottom=top+lh,vt=code.scrollTop,vb=vt+code.clientHeight,mg=lh*3;if(top<vt+mg)code.scrollTop=Math.max(0,top-mg);else if(bottom>vb-mg)code.scrollTop=Math.max(0,bottom-code.clientHeight+mg);$('#lineNumbers').scrollTop=code.scrollTop}
function run(){parse();if(!state.result.segments.length)return;state.running=true;state.step=0;state.selectedLine=null;const m=$('#metricState');if(m)m.textContent='Đang chạy';clearInterval(state.timer);state.timer=setInterval(()=>{state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;if(state.selectedLine){keepCodeLineVisible(state.selectedLine);updateLines()}draw();if(state.step>=state.result.segments.length){clearInterval(state.timer);state.running=false;if(m)m.textContent='Hoàn tất'}},35)}
function dl(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function findSegmentAt(px,py){const r=state.result;if(!r)return null;let best=null,bestD=Infinity;const threshold=Math.max(7,Math.min(14,canvas.clientWidth*.018));for(const s of r.segments){if(s.g==='G00'||s.rapid)continue;let d=Infinity;if(s.meta?.arc&&s.meta.arcCenter){const m=s.meta,c=W(m.arcCenter.x,m.arcCenter.y),p=[px,py],rr=Math.hypot(W(m.arcStartPoint.x,m.arcStartPoint.y)[0]-c[0],W(m.arcStartPoint.x,m.arcStartPoint.y)[1]-c[1]);const radial=Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1])-rr);d=radial}else{const a=W(s.x,s.y),b=W(s.x2,s.y2),dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,t=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/(L*L)));d=Math.hypot(px-(a[0]+dx*t),py-(a[1]+dy*t))}if(d<bestD){bestD=d;best=s}}return bestD<=threshold?best:null}
code.addEventListener('input',()=>{state.autoFit=true;state.selectedLine=null;updateLines();$('#dirty').textContent='● Chưa lưu';parse()});code.addEventListener('keyup',cursor);code.addEventListener('click',cursor);code.addEventListener('scroll',()=>$('#lineNumbers').scrollTop=code.scrollTop);
$('#runBtn')?.addEventListener('click',run);$('#pauseBtn')?.addEventListener('click',()=>{state.paused=!state.paused});$('#stopBtn')?.addEventListener('click',reset);$('#resetBtn')?.addEventListener('click',reset);$('#stepBtn')?.addEventListener('click',()=>{if(!state.result)parse();state.step=Math.min(state.step+1,state.result.segments.length);state.selectedLine=state.result.segments[state.step-1]?.line||null;if(state.selectedLine){gotoLine(state.selectedLine)}draw()});$('#millingBtn')?.addEventListener('click',()=>setMode('milling'));$('#turningBtn')?.addEventListener('click',()=>setMode('turning'));$('#fitBtn')?.addEventListener('click',()=>{state.autoFit=true;state.panX=state.panY=0;parse()});$('#newBtn')?.addEventListener('click',()=>{code.value='';state.autoFit=true;parse()});$('#saveBtn')?.addEventListener('click',()=>dl(state.mode==='turning'?'turning.nc':'program.nc',code.value));$('#openBtn')?.addEventListener('click',()=>$('#fileInput')?.click());$('#fileInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{code.value=rd.result;state.autoFit=true;parse();$('#dirty').textContent='● Đã tải '+f.name};rd.readAsText(f)});
let drag=false,lx=0,ly=0;canvas.addEventListener('pointerdown',e=>{if(e.shiftKey||e.button===1||e.button===2){e.preventDefault();state.autoFit=false;drag=true;lx=e.clientX;ly=e.clientY;canvas.classList.add('panning')}});window.addEventListener('pointerup',()=>{drag=false;canvas.classList.remove('panning')});window.addEventListener('pointermove',e=>{if(!drag)return;state.panX+=e.clientX-lx;state.panY+=e.clientY-ly;lx=e.clientX;ly=e.clientY;draw()});canvas.oncontextmenu=e=>e.preventDefault();canvas.addEventListener('click',e=>{if(drag)return;const s=findSegmentAt(e.offsetX,e.offsetY);if(s){state.selectedLine=s.line;keepCodeLineVisible(s.line);updateLines();draw()}});canvas.addEventListener('dblclick',()=>{$('#fitBtn')?.click()});window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();$('#saveBtn')?.click()}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();run()}if(e.key==='F5'){e.preventDefault();parse()}});new ResizeObserver(resize).observe($('.canvas-wrap'));updateLines();parse();resize();
})();

(()=>{const q=s=>document.querySelector(s),map=(a,b)=>{const x=q(a),y=q(b);if(x&&y)x.onclick=()=>y.click()};map('#mNew','#newBtn');map('#mOpen','#openBtn');map('#mSave','#saveBtn');map('#mClear','#newBtn');map('#mReset','#resetBtn');map('#mFit','#fitBtn');map('#mMilling','#millingBtn');map('#mTurning','#turningBtn');map('#mRun','#runBtn');map('#mPause','#pauseBtn');map('#mStop','#stopBtn');map('#mStep','#stepBtn');map('#mCheck','#mFit');const btns=[...document.querySelectorAll('.menu-btn')],drops=[...document.querySelectorAll('.dropdown')];btns.forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const id='menu-'+b.dataset.menu;drops.forEach(d=>d.classList.toggle('open',d.id===id&&!d.classList.contains('open')));btns.forEach(x=>x.classList.toggle('active',x===b&&q('#'+id)?.classList.contains('open')))}));document.addEventListener('click',()=>{drops.forEach(d=>d.classList.remove('open'));btns.forEach(b=>b.classList.remove('active'))})})();
