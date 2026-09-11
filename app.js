(()=>{
'use strict';
const $=s=>document.querySelector(s), code=$('#code'), canvas=$('#canvas'), ctx=canvas.getContext('2d');
const state={mode:'milling',result:null,step:0,running:false,paused:false,timer:null,selectedLine:null,selectedPoint:null,view:null};
const TOOL_COLORS=['#35a9ff','#35d39b','#f3c65b','#f47777','#b78cff','#ff8cbd','#65d6d6','#f59e0b'];
const dimColor='rgba(205,214,223,.38)', dimText='rgba(218,225,232,.52)', extColor='rgba(177,188,199,.24)';
function lines(){return code.value.replace(/\r/g,'').split('\n')}
function fmt(v){return Number(v||0).toFixed(3)}
function trim(v){return Number(Number(v||0).toFixed(3)).toString()}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function updateLines(){const ls=lines();$('#lineNumbers').innerHTML=ls.map((_,i)=>`<div class="${state.selectedLine===i+1?'active':''}">${i+1}</div>`).join('')}
function selectLine(n){if(!n)return;const ls=lines();let pos=0;for(let i=1;i<n;i++)pos+=ls[i-1].length+1;const len=ls[n-1]?.length||0;code.focus();code.setSelectionRange(pos,pos+len);state.selectedLine=n;updateLines();const lh=parseFloat(getComputedStyle(code).lineHeight)||20;code.scrollTop=Math.max(0,(n-4)*lh);$('#lineNumbers').scrollTop=code.scrollTop;draw()}
function parse(){
 clearInterval(state.timer);state.timer=null;state.running=false;state.paused=false;state.step=0;
 state.result=CNCEngine.parse(code.value,{mode:state.mode,controller:'FANUC'});state.selectedLine=null;state.selectedPoint=null;hideInfo();updateLines();draw();
}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.max(1,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw()}
function geometryBounds(){
 const segs=(state.result?.segments||[]).filter(s=>s.g!=='G00');
 const use=segs.length?segs:state.result?.segments||[];
 if(!use.length)return null;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const s of use){minX=Math.min(minX,s.x,s.x2);maxX=Math.max(maxX,s.x,s.x2);minY=Math.min(minY,s.y,s.y2);maxY=Math.max(maxY,s.y,s.y2)}
 if(!Number.isFinite(minX))return null;
 if(Math.abs(maxX-minX)<1e-9){minX-=1;maxX+=1} if(Math.abs(maxY-minY)<1e-9){minY-=1;maxY+=1}
 return {minX,maxX,minY,maxY};
}
function setupView(){
 const w=canvas.clientWidth,h=canvas.clientHeight,b=geometryBounds(); if(!b){state.view=null;return}
 const left=Math.min(110,Math.max(55,w*.12)), right=Math.min(55,Math.max(28,w*.06)), top=Math.min(78,Math.max(48,h*.10)), bottom=Math.min(70,Math.max(42,h*.09));
 const sx=b.maxX-b.minX,sy=b.maxY-b.minY,scale=Math.max(.001,Math.min((w-left-right)/sx,(h-top-bottom)/sy));
 const ox=left+(w-left-right-sx*scale)/2, oy=top+(h-top-bottom-sy*scale)/2;
 state.view={b,scale,ox,oy,w,h};
}
function world(x,y){const v=state.view;if(!v)return[0,0];return[v.ox+(x-v.b.minX)*v.scale,v.oy+(v.b.maxY-y)*v.scale]}
function colorForTool(t){const n=Math.max(1,Math.round(Number(t)||1));return TOOL_COLORS[(n-1)%TOOL_COLORS.length]}
function lineInfo(seg){
 const st=seg?.meta?.state||{};return {x:seg?.x2??0,y:seg?.y2??0,z:seg?.z??0,tool:st.tool??1,g:seg?.g||'',line:seg?.line||0,feed:st.feed??0,spindle:st.spindle??0};
}
function drawArrow(x1,y1,x2,y2){const a=Math.atan2(y2-y1,x2-x1),s=5;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-s*Math.cos(a-.45),y2-s*Math.sin(a-.45));ctx.moveTo(x2,y2);ctx.lineTo(x2-s*Math.cos(a+.45),y2-s*Math.sin(a+.45));ctx.stroke()}
function drawDimH(x1,x2,y,refY,label){ctx.save();ctx.strokeStyle=dimColor;ctx.fillStyle=dimText;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x1,refY);ctx.lineTo(x1,y);ctx.moveTo(x2,refY);ctx.lineTo(x2,y);ctx.stroke();ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();drawArrow(x1,y,x2,y);drawArrow(x2,y,x1,y);ctx.font='12px Consolas,monospace';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(label,(x1+x2)/2,y-5);ctx.restore()}
function drawDimV(x,y1,y2,refX,label){ctx.save();ctx.strokeStyle=dimColor;ctx.fillStyle=dimText;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(refX,y1);ctx.lineTo(x,y1);ctx.moveTo(refX,y2);ctx.lineTo(x,y2);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x,y2);ctx.stroke();drawArrow(x,y1,x,y2);drawArrow(x,y2,x,y1);ctx.font='12px Consolas,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.translate(x-7,(y1+y2)/2);ctx.rotate(-Math.PI/2);ctx.fillText(label,0,0);ctx.restore()}
function dimensions(){
 const v=state.view;if(!v)return;const b=v.b;const p1=world(b.minX,b.maxY),p2=world(b.maxX,b.minY);
 const top=Math.max(22,p1[1]-32), left=Math.max(28,p1[0]-46), bottom=Math.min(v.h-18,p2[1]+30), right=Math.min(v.w-18,p2[0]+34);
 drawDimH(p1[0],p2[0],top,p1[1],trim(b.maxX-b.minX));
 drawDimV(left,p1[1],p2[1],p1[0],trim(b.maxY-b.minY));
 // A second bottom/right dimension is only shown when it fits outside and is useful for a non-square profile.
 if(Math.abs((b.maxX-b.minX)-(b.maxY-b.minY))>1e-6 && bottom-p2[1]>12) drawDimH(p1[0],p2[0],bottom,p2[1],trim(b.maxX-b.minX));
}
function drawArc(s){
 const m=s.meta;if(!m?.arcCenter)return false;
 const c=world(m.arcCenter.x,m.arcCenter.y),sp=world(m.arcStartPoint.x,m.arcStartPoint.y),ep=world(m.arcEndPoint.x,m.arcEndPoint.y);
 const r=Math.hypot(sp[0]-c[0],sp[1]-c[1]);if(!Number.isFinite(r)||r<.5)return false;
 const a0=Math.atan2(sp[1]-c[1],sp[0]-c[0]),a1=Math.atan2(ep[1]-c[1],ep[0]-c[0]);
 // Canvas Y is down, so a machine-clockwise G02 becomes canvas counter-clockwise.
 const anticlockwise=!!m.cw;
 const tau=Math.PI*2;let end=a1;
 if(anticlockwise){while(end>a0)end-=tau}else{while(end<a0)end+=tau}
 const sweep=Math.abs(m.arcSweep||0);if(sweep>1e-8)end=a0+(anticlockwise?-sweep:sweep);
 ctx.beginPath();ctx.arc(c[0],c[1],r,a0,end,anticlockwise);ctx.stroke();return true;
}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d12';ctx.fillRect(0,0,w,h);state.view=null;
 const r=state.result;if(!r||!r.segments.length){$('#emptyHint').classList.remove('hidden');return}$('#emptyHint').classList.add('hidden');setupView();
 const seen=new Set();let i=0;
 while(i<r.segments.length){
   const s=r.segments[i], selected=state.selectedLine===s.line, tool=s.meta?.state?.tool??1;
   ctx.strokeStyle=selected?'#fff':colorForTool(tool);ctx.lineWidth=selected?2.8:1.7;ctx.globalAlpha=s.g==='G00'?.55:1;ctx.setLineDash(s.g==='G00'?[6,5]:[]);
   if(s.meta?.arc&&s.meta.arcCenter){const line=s.line;let j=i+1;while(j<r.segments.length&&r.segments[j].line===line&&r.segments[j].meta?.arc)j++;drawArc(s);i=j;ctx.globalAlpha=1;continue}
   const a=world(s.x,s.y),b=world(s.x2,s.y2);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
   if(!seen.has(`${s.x2}|${s.y2}|${s.line}`)){ctx.globalAlpha=1;ctx.fillStyle=selected?'#fff':colorForTool(tool);ctx.beginPath();ctx.arc(b[0],b[1],2.1,0,Math.PI*2);ctx.fill();seen.add(`${s.x2}|${s.y2}|${s.line}`)}
   i++;
 }
 ctx.globalAlpha=1;ctx.setLineDash([]);dimensions();
 if(state.selectedPoint) drawSelectedPoint();
}
function drawSelectedPoint(){const p=world(state.selectedPoint.x,state.selectedPoint.y);ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#31a8ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p[0],p[1],5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
function hideInfo(){$('#pointInfo').classList.add('hidden');state.selectedPoint=null}
function showInfo(seg,x,y){
 const inf=lineInfo(seg);state.selectedPoint={x,y};const plane=state.mode==='turning'?'X / Z':'X / Y';
 $('#pointInfo').innerHTML=`<div class="title">${escapeHtml(inf.g)} • dòng ${inf.line}</div><div>X: <b>${fmt(inf.x)}</b></div><div>${state.mode==='turning'?'Z':'Y'}: <b>${fmt(inf.y)}</b></div><div>Z: <b>${fmt(inf.z)}</b></div><div>G-code: <b>${escapeHtml(inf.g)}</b></div><div>Dao: <b>T${Math.round(inf.tool)}</b></div>`;
 const wrap=$('.canvas-wrap'),rect=wrap.getBoundingClientRect(),p=world(x,y);let px=p[0]+12,py=p[1]+12;const box=$('#pointInfo');box.classList.remove('hidden');const bw=box.offsetWidth,bh=box.offsetHeight;if(px+bw>rect.width)px=p[0]-bw-12;if(py+bh>rect.height)py=p[1]-bh-12;box.style.left=Math.max(4,px)+'px';box.style.top=Math.max(4,py)+'px';selectLine(inf.line)
}
function nearest(mx,my){const r=state.result;if(!r)return null;let best=null,bestD=Infinity,bestPoint=null;
 for(const s of r.segments){const a=world(s.x,s.y),b=world(s.x2,s.y2);const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;let t=l2?((mx-a[0])*dx+(my-a[1])*dy)/l2:0;t=Math.max(0,Math.min(1,t));const px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(mx-px,my-py);if(d<bestD){bestD=d;best=s;bestPoint={x:s.x+(s.x2-s.x)*t,y:s.y+(s.y2-s.y)*t}}}
 return best?{seg:best,d:bestD,point:bestPoint}:null;
}
function clickCanvas(e){const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const hit=nearest(mx,my);if(!hit){hideInfo();draw();return}const {seg,d,point}=hit;if(d<=9){showInfo(seg,point.x,point.y)}else{hideInfo();selectLine(seg.line)}}
function run(){parse();if(!state.result.segments.length)return;state.running=true;state.step=0;state.selectedLine=null;state.paused=false;clearInterval(state.timer);state.timer=setInterval(()=>{if(state.paused)return;state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;updateLines();draw();if(state.step>=state.result.segments.length){clearInterval(state.timer);state.timer=null;state.running=false}},35)}
function reset(){clearInterval(state.timer);state.timer=null;state.running=false;state.paused=false;state.step=0;state.selectedLine=null;hideInfo();draw()}
function newFile(){clearInterval(state.timer);code.value='';state.step=0;state.selectedLine=null;hideInfo();updateLines();draw();code.focus()}
function download(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([code.value],{type:'text/plain'}));a.download='program.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
code.addEventListener('input',()=>{state.selectedLine=null;hideInfo();updateLines();parse()});code.addEventListener('scroll',()=>$('#lineNumbers').scrollTop=code.scrollTop);
$('#newBtn').onclick=newFile;$('#openBtn').onclick=()=>$('#fileInput').click();$('#saveBtn').onclick=download;$('#runBtn').onclick=run;$('#pauseBtn').onclick=()=>{state.paused=!state.paused};$('#stopBtn').onclick=reset;$('#resetBtn').onclick=reset;$('#stepBtn').onclick=()=>{if(!state.result)parse();if(state.step<state.result.segments.length)state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;updateLines();draw()};$('#millingBtn').onclick=()=>{state.mode='milling';$('#millingBtn').classList.add('active');$('#turningBtn').classList.remove('active');parse()};$('#turningBtn').onclick=()=>{state.mode='turning';$('#turningBtn').classList.add('active');$('#millingBtn').classList.remove('active');parse()};$('#fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{code.value=rd.result||'';updateLines();parse();};rd.readAsText(f);e.target.value=''};
canvas.addEventListener('click',clickCanvas);canvas.addEventListener('mouseleave',()=>{});window.addEventListener('resize',resize);new ResizeObserver(resize).observe($('.canvas-wrap'));window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();download()}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();run()}});
updateLines();parse();resize();
})();
