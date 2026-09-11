(()=>{
'use strict';
const $=s=>document.querySelector(s);
const code=$('#code'), canvas=$('#canvas'), ctx=canvas.getContext('2d');
const state={result:null,mode:'milling',controller:'FANUC',selectedLine:null,selectedPoint:null,zoom:1,panX:0,panY:0,drag:false,lx:0,ly:0,running:false,paused:false,timer:null,step:0,autoFit:true};
const COLORS={G00:'#f87171',G01:'#38a9ff',G02:'#34d399',G03:'#f5c451'};
const TOOL_COLORS=['#38a9ff','#34d399','#f5c451','#f87171','#a78bfa','#fb7185','#22d3ee','#f59e0b'];
const lines=()=>code.value.replace(/\r/g,'').split('\n');
const fmt=v=>Number(v||0).toFixed(3).replace(/\.000$/,'').replace(/(\.\d*[1-9])0+$/,'$1');
function updateLines(){const a=lines();$('#lineNumbers').innerHTML=a.map((_,i)=>`<div class="${state.selectedLine===i+1?'active':''}">${i+1}</div>`).join('');cursor();}
function cursor(){const n=code.value.slice(0,code.selectionStart).split('\n').length;$('#cursorInfo').textContent=`Dòng ${n} / ${lines().length}`;}
function parse(resetView=true){
 clearInterval(state.timer);state.running=false;state.paused=false;state.step=0;
 state.result=CNCEngine.parse(code.value,{mode:state.mode,controller:state.controller});
 state.selectedPoint=null;
 if(resetView){state.zoom=1;state.panX=0;state.panY=0;state.autoFit=true;}
 const r=state.result;
 $('#emptyHint').hidden=!!r.segments.length;
 $('#statusText').textContent=r.errors.length?`Có ${r.errors.length} lỗi`:`Sẵn sàng • ${r.segments.length} đoạn`;
 updateCoords(r.state||{});updateLines();draw();
}
function updateCoords(s){
 $('#xPos').textContent=fmt(s.x);$('#yPos').textContent=fmt(s.y);$('#zPos').textContent=fmt(s.z);
 $('#yLabel').textContent=state.mode==='turning'?'Z':'Y';
 $('#viewTitle').textContent='2D';
}
function bounds(){return state.result?.bounds||{minX:0,maxX:100,minY:0,maxY:100};}
function fit(){const w=canvas.clientWidth,h=canvas.clientHeight,b=bounds();const sx=Math.max(1,b.maxX-b.minX),sy=Math.max(1,b.maxY-b.minY);const marginX=Math.min(220,w*.30),marginY=Math.min(180,h*.30);state.zoom=Math.max(.001,Math.min((w-marginX)/sx,(h-marginY)/sy));state.panX=0;state.panY=0;state.autoFit=false;draw();}
function world(x,y){const b=bounds(),w=canvas.clientWidth,h=canvas.clientHeight;const sx=Math.max(1,b.maxX-b.minX),sy=Math.max(1,b.maxY-b.minY);const base=Math.min((w-150)/sx,(h-150)/sy);const s=Math.max(.001,base*state.zoom);return[w/2+(x-(b.minX+b.maxX)/2)*s+state.panX,h/2-(y-(b.minY+b.maxY)/2)*s+state.panY];}
function screenToWorld(px,py){const b=bounds(),w=canvas.clientWidth,h=canvas.clientHeight;const sx=Math.max(1,b.maxX-b.minX),sy=Math.max(1,b.maxY-b.minY);const base=Math.min((w-150)/sx,(h-150)/sy);const s=Math.max(.001,base*state.zoom);return{x:(px-w/2-state.panX)/s+(b.minX+b.maxX)/2,y:(h/2-py+state.panY)/s+(b.minY+b.maxY)/2};}
function arrow(x1,y1,x2,y2,size=6){const a=Math.atan2(y2-y1,x2-x1);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-size*Math.cos(a-.5),y2-size*Math.sin(a-.5));ctx.lineTo(x2-size*Math.cos(a+.5),y2-size*Math.sin(a+.5));ctx.closePath();ctx.fill();}
function dimH(x1,x2,y,refY,label){const a=world(x1,refY),b=world(x2,refY),yy=world(x1,y)[1],xa=a[0],xb=b[0];ctx.strokeStyle='#d8c45f';ctx.fillStyle='#e5cf65';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(xa,a[1]);ctx.lineTo(xa,yy);ctx.moveTo(xb,b[1]);ctx.lineTo(xb,yy);ctx.moveTo(xa,yy);ctx.lineTo(xb,yy);ctx.stroke();arrow(xa,yy,xa+1,yy,5);arrow(xb,yy,xb-1,yy,5);ctx.font='12px Segoe UI,Arial';ctx.textAlign='center';ctx.fillText(label,(xa+xb)/2,yy-6);}
function dimV(y1,y2,x,refX,label){const a=world(refX,y1),b=world(refX,y2),xx=world(x,y1)[0],ya=a[1],yb=b[1];ctx.strokeStyle='#d8c45f';ctx.fillStyle='#e5cf65';ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(a[0],ya);ctx.lineTo(xx,ya);ctx.moveTo(b[0],yb);ctx.lineTo(xx,yb);ctx.moveTo(xx,ya);ctx.lineTo(xx,yb);ctx.stroke();arrow(xx,ya,xx,ya+1,5);arrow(xx,yb,xx,yb-1,5);ctx.save();ctx.translate(xx-7,(ya+yb)/2);ctx.rotate(-Math.PI/2);ctx.font='12px Segoe UI,Arial';ctx.textAlign='center';ctx.fillText(label,0,0);ctx.restore();}
function radiusDim(s){const m=s.meta;if(!m?.arcCenter||!m.arcRadius)return;const c=world(m.arcCenter.x,m.arcCenter.y);const p=world(m.arcStartPoint.x,m.arcStartPoint.y);const dx=p[0]-c[0],dy=p[1]-c[1],L=Math.hypot(dx,dy)||1;const ex=p[0]+dx/L*18,ey=p[1]+dy/L*18;ctx.strokeStyle='#ef626a';ctx.fillStyle='#ef626a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(c[0],c[1]);ctx.lineTo(ex,ey);ctx.stroke();arrow(c[0],c[1],p[0],p[1],5);ctx.font='12px Segoe UI,Arial';ctx.textAlign='left';ctx.fillText(`R ${fmt(m.arcRadius)}`,ex+4,ey-4);}
function isArc(s){return !!s.meta?.arc&&!!s.meta?.arcCenter;}
function drawDimensions(){
 const r=state.result;if(!r?.segments.length)return;const b=r.bounds;const padX=Math.max(18,(b.maxX-b.minX)*.12),padY=Math.max(18,(b.maxY-b.minY)*.12);
 // Overall dimensions always live outside the geometry.
 dimH(b.minX,b.maxX,b.maxY+padY,b.maxY,fmt(b.maxX-b.minX));
 dimV(b.minY,b.maxY,b.minX-padX,b.minX,fmt(b.maxY-b.minY));
 const hs=[],vs=[],arcs=[];const seenH=new Set(),seenV=new Set(),seenA=new Set();
 for(const s of r.segments){
  if(isArc(s)){if(!seenA.has(s.line)){seenA.add(s.line);arcs.push(s)}continue;}
  const dx=s.x2-s.x,dy=s.y2-s.y;
  if(Math.abs(dx)>1e-6&&Math.abs(dy)<1e-6&&Math.abs(dx)>2){const a=Math.min(s.x,s.x2),b2=Math.max(s.x,s.x2),k=`${a.toFixed(3)}|${b2.toFixed(3)}|${s.y.toFixed(3)}`;if(!seenH.has(k)){seenH.add(k);hs.push(s)}}
  if(Math.abs(dy)>1e-6&&Math.abs(dx)<1e-6&&Math.abs(dy)>2){const a=Math.min(s.y,s.y2),b2=Math.max(s.y,s.y2),k=`${s.x.toFixed(3)}|${a.toFixed(3)}|${b2.toFixed(3)}`;if(!seenV.has(k)){seenV.add(k);vs.push(s)}}
 }
 // Feature dimensions are put into external lanes, never inside the profile.
 hs.slice(0,8).forEach((s,i)=>{const above=s.y>=(b.minY+b.maxY)/2;const y=above?b.maxY+padY+(i+1)*22:b.minY-padY-(i+1)*22;dimH(s.x,s.x2,y,s.y,fmt(Math.abs(s.x2-s.x)));});
 vs.slice(0,8).forEach((s,i)=>{const right=s.x>=(b.minX+b.maxX)/2;const x=right?b.maxX+padX+(i+1)*22:b.minX-padX-(i+1)*22;dimV(s.y,s.y2,x,s.x,fmt(Math.abs(s.y2-s.y)));});
 arcs.slice(0,8).forEach(radiusDim);
}
function vertexPoints(){
 const r=state.result;if(!r)return[];const out=[],seen=new Set();
 for(const s of r.segments){
  const pts=isArc(s)?[[s.x,s.y,s.line,s.g,s.meta?.state?.tool,s.z],[s.x2,s.y2,s.line,s.g,s.meta?.state?.tool,s.z]]:[[s.x,s.y,s.line,s.g,s.meta?.state?.tool,s.z],[s.x2,s.y2,s.line,s.g,s.meta?.state?.tool,s.z]];
  for(const p of pts){const k=`${p[0].toFixed(4)}|${p[1].toFixed(4)}`;if(seen.has(k))continue;seen.add(k);out.push({x:p[0],y:p[1],line:p[2],g:p[3],tool:p[4]??1,z:p[5]??0});}
 }
 return out;
}
function drawPoints(){
 for(const p of vertexPoints()){const q=world(p.x,p.y),sel=state.selectedPoint&&Math.abs(state.selectedPoint.x-p.x)<1e-6&&Math.abs(state.selectedPoint.y-p.y)<1e-6;ctx.fillStyle=sel?'#fff':'#c9d5df';ctx.beginPath();ctx.arc(q[0],q[1],sel?4:2.5,0,Math.PI*2);ctx.fill();}
}
function drawOrigin(){const q=world(0,0);if(q[0]<-30||q[0]>canvas.clientWidth+30||q[1]<-30||q[1]>canvas.clientHeight+30)return;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q[0],q[1],3,0,Math.PI*2);ctx.fill();ctx.font='10px Consolas,monospace';ctx.fillStyle='#8fa1b1';ctx.fillText(state.mode==='turning'?'X0 Z0':'X0 Y0',q[0]+7,q[1]-7);}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d12';ctx.fillRect(0,0,w,h);const r=state.result;if(!r?.segments.length)return;
 ctx.lineCap='round';let i=0;while(i<r.segments.length){const s=r.segments[i];const sel=state.selectedLine===s.line;const tool=Number(s.meta?.state?.tool??1);const toolColor=TOOL_COLORS[(Math.max(1,tool)-1)%TOOL_COLORS.length];ctx.strokeStyle=sel?'#fff':toolColor;ctx.lineWidth=sel?3:2;ctx.setLineDash(s.rapid?[6,5]:[]);
  if(isArc(s)){const m=s.meta,c=world(m.arcCenter.x,m.arcCenter.y),sp=world(m.arcStartPoint.x,m.arcStartPoint.y),ep=world(m.arcEndPoint.x,m.arcEndPoint.y),rr=Math.hypot(sp[0]-c[0],sp[1]-c[1]);let a0=Math.atan2(sp[1]-c[1],sp[0]-c[0]),a1=Math.atan2(ep[1]-c[1],ep[0]-c[0]);const anticlock=!m.cw;if(anticlock){while(a1>a0)a1-=Math.PI*2}else{while(a1<a0)a1+=Math.PI*2}const desired=Math.abs(m.arcSweep||0);if(desired>0)a1=a0+(anticlock?-1:1)*Math.min(desired,Math.PI*2);ctx.beginPath();ctx.arc(c[0],c[1],rr,a0,a1,anticlock);ctx.stroke();let j=i+1;while(j<r.segments.length&&r.segments[j].line===s.line&&isArc(r.segments[j]))j++;i=j;continue;}
  const a=world(s.x,s.y),b=world(s.x2,s.y2);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();if(i===state.step-1){ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b[0],b[1],4,0,Math.PI*2);ctx.fill();}i++;
 }
 ctx.setLineDash([]);drawDimensions();drawPoints();drawOrigin();
}
function resize(){const r=canvas.getBoundingClientRect(),d=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw();}
function selectLine(n){if(!n)return;state.selectedLine=n;const ls=lines();let pos=0;for(let i=1;i<n;i++)pos+=ls[i-1].length+1;code.focus();code.setSelectionRange(pos,pos+(ls[n-1]||'').length);const lh=parseFloat(getComputedStyle(code).lineHeight)||20;code.scrollTop=Math.max(0,(n-3)*lh);$('#lineNumbers').scrollTop=code.scrollTop;updateLines();draw();}
function showPoint(p,clientX,clientY){state.selectedPoint=p;selectLine(p.line);const el=$('#pointInfo');const wrap=$('.canvas-wrap');const rr=wrap.getBoundingClientRect();el.innerHTML=`<b>X</b> ${fmt(p.x)}<br><b>${state.mode==='turning'?'Z':'Y'}</b> ${fmt(p.y)}<br><span class="line">L${p.line} • ${p.g||'MOVE'} • T${fmt(p.tool)}</span>`;el.hidden=false;const x=Math.min(wrap.clientWidth-155,Math.max(8,clientX-rr.left+12)),y=Math.min(wrap.clientHeight-75,Math.max(8,clientY-rr.top+12));el.style.left=x+'px';el.style.top=y+'px';draw();}
function nearestPoint(mx,my){let best=null,bd=9;for(const p of vertexPoints()){const q=world(p.x,p.y),d=Math.hypot(mx-q[0],my-q[1]);if(d<bd){bd=d;best=p;}}return best;}
function distToSegment(px,py,a,b){const vx=b[0]-a[0],vy=b[1]-a[1],den=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((px-a[0])*vx+(py-a[1])*vy)/den));return[Math.hypot(px-(a[0]+t*vx),py-(a[1]+t*vy)),t];}
function nearestLine(mx,my){let best=null,bd=10;for(const s of state.result?.segments||[]){if(isArc(s)){const c=world(s.meta.arcCenter.x,s.meta.arcCenter.y),sp=world(s.meta.arcStartPoint.x,s.meta.arcStartPoint.y),rr=Math.hypot(sp[0]-c[0],sp[1]-c[1]);const d=Math.abs(Math.hypot(mx-c[0],my-c[1])-rr);if(d<bd){bd=d;best=s.line}}else{const d=distToSegment(mx,my,world(s.x,s.y),world(s.x2,s.y2))[0];if(d<bd){bd=d;best=s.line}}}return best;}
function run(){parse(false);if(!state.result.segments.length)return;state.running=true;state.paused=false;state.step=0;state.selectedLine=null;$('#statusText').textContent='Đang mô phỏng';clearInterval(state.timer);state.timer=setInterval(()=>{if(state.paused)return;state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;if(state.selectedLine)selectLineNoFocus(state.selectedLine);draw();if(state.step>=state.result.segments.length){clearInterval(state.timer);state.running=false;$('#statusText').textContent='Mô phỏng hoàn tất';}},35);}
function selectLineNoFocus(n){state.selectedLine=n;updateLines();}
function reset(){clearInterval(state.timer);state.running=false;state.paused=false;state.step=0;state.selectedLine=null;state.selectedPoint=null;$('#statusText').textContent='Sẵn sàng';updateLines();draw();}
function download(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([code.value],{type:'text/plain'}));a.download=state.mode==='turning'?'turning.nc':'program.nc';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
function openFile(){ $('#fileInput').click(); }
function menu(msg){$('#statusText').textContent=msg;setTimeout(()=>{if(!state.running)$('#statusText').textContent=state.result?.segments.length?`Sẵn sàng • ${state.result.segments.length} đoạn`:'Sẵn sàng';},1200);}
code.addEventListener('input',()=>{state.selectedLine=null;$('#dirty').textContent='● Chưa lưu';parse(true);});
code.addEventListener('keyup',cursor);code.addEventListener('click',cursor);code.addEventListener('scroll',()=>$('#lineNumbers').scrollTop=code.scrollTop);
canvas.addEventListener('click',e=>{if(state.drag)return;const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const p=nearestPoint(mx,my);if(p){showPoint(p,e.clientX,e.clientY);return;}const n=nearestLine(mx,my);if(n)selectLine(n);else $('#pointInfo').hidden=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const before=screenToWorld(mx,my);const factor=e.deltaY<0?1.12:.89;state.zoom=Math.max(.05,Math.min(20,state.zoom*factor));const after=world(before.x,before.y);state.panX+=mx-after[0];state.panY+=my-after[1];draw();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;state.drag=true;state.lx=e.clientX;state.ly=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',e=>{if(!state.drag)return;state.panX+=e.clientX-state.lx;state.panY+=e.clientY-state.ly;state.lx=e.clientX;state.ly=e.clientY;$('#pointInfo').hidden=true;draw();});
canvas.addEventListener('pointerup',()=>{state.drag=false;canvas.classList.remove('dragging');});
canvas.addEventListener('pointercancel',()=>{state.drag=false;canvas.classList.remove('dragging');});
$('#newBtn').onclick=()=>{clearInterval(state.timer);code.value='';state.selectedLine=null;state.autoFit=true;$('#dirty').textContent='● Chưa lưu';parse(true);code.focus();};
$('#openBtn').onclick=openFile;$('#fileInput').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{code.value=String(rd.result||'');$('#dirty').textContent='● Đã mở '+f.name;parse(true);};rd.readAsText(f);e.target.value='';};
$('#saveBtn').onclick=download;$('#runBtn').onclick=run;$('#pauseBtn').onclick=()=>{if(!state.running)return;state.paused=!state.paused;$('#statusText').textContent=state.paused?'Tạm dừng':'Đang mô phỏng';};$('#stopBtn').onclick=reset;$('#resetBtn').onclick=reset;
$('#stepBtn').onclick=()=>{if(!state.result)parse(true);if(state.step>=state.result.segments.length)state.step=0;state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;if(state.selectedLine)selectLineNoFocus(state.selectedLine);$('#statusText').textContent='Bước '+state.step;draw();};
$('#fitBtn').onclick=fit;$('#millingBtn').onclick=()=>{state.mode='milling';state.autoFit=true;$('#millingBtn').classList.add('active');$('#turningBtn').classList.remove('active');parse(true);};$('#turningBtn').onclick=()=>{state.mode='turning';state.autoFit=true;$('#turningBtn').classList.add('active');$('#millingBtn').classList.remove('active');parse(true);};
$('#menuFile').onclick=()=>menu('Tệp: dùng Mới, Mở, Tải');$('#menuEdit').onclick=()=>{code.focus();menu('Chỉnh sửa: con trỏ đang ở vùng G-code');};$('#menuView').onclick=()=>{fit();menu('Đã Fit khung hình');};$('#menuSim').onclick=run;$('#menuCheck').onclick=()=>menu(state.result?.errors.length?`Có ${state.result.errors.length} lỗi`:'G-code không có lỗi nghiêm trọng');$('#menuLearn').onclick=()=>menu('CNC Studio • học G-code trực tiếp trên mô phỏng');
window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();download();}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();run();}if(e.key==='F5'){e.preventDefault();parse(true);}});
new ResizeObserver(resize).observe($('.canvas-wrap'));
// Không nạp chương trình mẫu: ô G-code khởi đầu hoàn toàn trống.
code.value='';updateLines();parse(true);resize();
})();
