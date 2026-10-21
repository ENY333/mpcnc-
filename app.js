(()=>{
'use strict';
const $=s=>document.querySelector(s), code=$('#code'), canvas=$('#canvas'), ctx=canvas.getContext('2d');
const state={mode:'milling',result:null,step:0,running:false,paused:false,timer:null,selectedLine:null,selectedPoint:null,view:null,displaySegments:[]};
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
 state.result=canvasResult(CNCEngine.parse(code.value,{mode:state.mode,controller:$('#controller').value}));state.selectedLine=cursorLine();state.selectedPoint=null;hideInfo();updateLines();draw();
}
// Engine coordinates remain physical radii. Only rotate the lathe display to Z horizontal / X vertical.
function canvasResult(result){
 if(state.mode!=='turning')return result;
 return {...result,segments:result.segments.map(s=>{
  if(s.meta?.state?.plane!=='G18')return s;
  const meta={...s.meta};
  if(meta.arcCenter){meta.arcCenter={x:meta.arcCenter.y,y:meta.arcCenter.x};meta.arcStart=Math.PI/2-meta.arcStart;meta.arcSweep=-meta.arcSweep;
   for(const key of ['arcStartPoint','arcEndPoint'])if(meta[key])meta[key]={x:meta[key].y,y:meta[key].x};}
  return {...s,x:s.y,y:s.x,x2:s.y2,y2:s.x2,meta};
 })};
}
function planeAxes(plane){return plane==='G18'?(state.mode==='turning'?['Z','X']:['X','Z']):plane==='G19'?['Y','Z']:['X','Y']}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.max(1,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw()}
function geometryBounds(){
 const use=state.displaySegments;
 if(!use.length)return {minX:-10,maxX:10,minY:-10,maxY:10};
 let minX=0,maxX=0,minY=0,maxY=0;
 const add=(x,y)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)};
 for(const s of use){
   add(s.x,s.y); add(s.x2,s.y2);
   const m=s.meta;
   if(m?.arcCenter){
     const c=m.arcCenter, r=Math.abs(m.arcRadius||Math.hypot(s.x-c.x,s.y-c.y));
     const a0=m.arcStart??Math.atan2(s.y-c.y,s.x-c.x), sweep=m.arcSweep||0;
     const angles=[a0,a0+sweep];
     for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
       let t=a-a0;
       if(sweep>=0){while(t<0)t+=Math.PI*2; if(t<=sweep+1e-9)add(c.x+r*Math.cos(a),c.y+r*Math.sin(a));}
       else {while(t>0)t-=Math.PI*2; if(t>=sweep-1e-9)add(c.x+r*Math.cos(a),c.y+r*Math.sin(a));}
     }
     for(const a of angles)add(c.x+r*Math.cos(a),c.y+r*Math.sin(a));
   }
 }
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
 const v=state.view;if(!v)return; const b=v.b;
 const pTL=world(b.minX,b.maxY), pBR=world(b.maxX,b.minY);
 const gap=18;
 // Only draw dimensions in the reserved outer margins. Never place a dimension line through the part.
 const topY=Math.max(12,pTL[1]-30);
 const leftX=Math.max(16,pTL[0]-42);
 const bottomY=Math.min(v.h-12,pBR[1]+30);
 const rightX=Math.min(v.w-12,pBR[0]+42);
 if(pTL[1]-topY>=gap) drawDimH(pTL[0],pBR[0],topY,pTL[1],trim(b.maxX-b.minX));
 if(pTL[0]-leftX>=gap) drawDimV(leftX,pTL[1],pBR[1],pTL[0],trim(b.maxY-b.minY));
 if(bottomY-pBR[1]>=gap && Math.abs((b.maxX-b.minX)-(b.maxY-b.minY))>1e-6) drawDimH(pTL[0],pBR[0],bottomY,pBR[1],trim(b.maxX-b.minX));
 if(rightX-pBR[0]>=gap && Math.abs((b.maxX-b.minX)-(b.maxY-b.minY))>1e-6) drawDimV(rightX,pTL[1],pBR[1],pBR[0],trim(b.maxY-b.minY));
}
function drawArc(s){
 const m=s.meta;
 if(!m?.arcCenter)return false;
 const line=s.line, r=state.displaySegments;
 const parts=[];
 for(const q of r){if(q.line===line&&q.meta?.arc&&q.meta.arcCenter)parts.push(q)}
 if(!parts.length)return false;
 ctx.beginPath();
 let first=true;
 for(const q of parts){
   const a=world(q.x,q.y), b=world(q.x2,q.y2);
   if(first){ctx.moveTo(a[0],a[1]);first=false}
   ctx.lineTo(b[0],b[1]);
 }
 ctx.stroke();
 return true;
}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#080d12';ctx.fillRect(0,0,w,h);state.view=null;
 const all=state.result?.segments||[];state.displaySegments=all;const r={segments:state.displaySegments};updateStatus();setupView();drawCoordinateScale();
 const seen=new Set();let i=0;
 while(i<r.segments.length){
   const s=r.segments[i], selected=state.selectedLine===s.line, tool=s.meta?.state?.tool??1;
   ctx.strokeStyle=selected?'#fff':colorForTool(tool);ctx.lineWidth=selected?2.8:1.7;ctx.globalAlpha=s.g==='G00'?.55:1;ctx.setLineDash(s.g==='G00'?[6,5]:[]);
   if(s.meta?.arc&&s.meta.arcCenter){const line=s.line;let j=i+1;while(j<r.segments.length&&r.segments[j].line===line&&r.segments[j].meta?.arc)j++;drawArc(s);ctx.globalAlpha=1;const end=r.segments[j-1];const ep=world(end.x2,end.y2);ctx.fillStyle=selected?'#fff':colorForTool(tool);ctx.beginPath();ctx.arc(ep[0],ep[1],2.1,0,Math.PI*2);ctx.fill();i=j;continue}
   const a=world(s.x,s.y),b=world(s.x2,s.y2);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
   if(!seen.has(`${s.x2}|${s.y2}|${s.line}`)){ctx.globalAlpha=1;ctx.fillStyle=selected?'#fff':colorForTool(tool);ctx.beginPath();ctx.arc(b[0],b[1],2.1,0,Math.PI*2);ctx.fill();seen.add(`${s.x2}|${s.y2}|${s.line}`)}
   i++;
 }
 ctx.globalAlpha=1;ctx.setLineDash([]);
 if($('#dims').checked){dimensions();const active=state.displaySegments.filter(s=>s.line===state.selectedLine).at(-1);if(active?.meta?.arcCenter){const c=active.meta.arcCenter,a=world(c.x,c.y),b=world(active.x2,active.y2);ctx.strokeStyle='#f1c85b';ctx.fillStyle='#f1c85b';ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.font='12px monospace';ctx.fillText('R '+trim(active.meta.arcRadius),(a[0]+b[0])/2+6,(a[1]+b[1])/2-6)}}
 if(state.selectedPoint) drawSelectedPoint();
}
function drawCoordinateScale(){
 const v=state.view;if(!v)return;
 const origin=world(0,0),plane=state.result?.state?.plane||(state.mode==='turning'?'G18':'G17'),axes=planeAxes(plane);
 ctx.save();ctx.globalAlpha=1;ctx.setLineDash([]);ctx.font='11px Consolas,monospace';
 const raw=60/v.scale,power=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].map(n=>n*power).find(n=>n>=raw);
 ctx.lineWidth=1;ctx.strokeStyle='rgba(130,160,190,.12)';
 const xMin=(0-origin[0])/v.scale,xMax=(v.w-origin[0])/v.scale,yMin=(origin[1]-v.h)/v.scale,yMax=origin[1]/v.scale;
 for(let x=Math.ceil(xMin/step)*step;x<=xMax;x+=step){const px=world(x,0)[0];ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,v.h);ctx.stroke();if(Math.abs(x)>step/100){ctx.fillStyle='#8299ad';ctx.textAlign='center';ctx.fillText(trim(x),px,Math.min(v.h-8,Math.max(15,origin[1]+17)))}}
 for(let y=Math.ceil(yMin/step)*step;y<=yMax;y+=step){const py=world(0,y)[1];ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(v.w,py);ctx.stroke();if(Math.abs(y)>step/100){ctx.fillStyle='#8299ad';ctx.textAlign='left';ctx.fillText(trim(y),Math.min(v.w-50,Math.max(5,origin[0]+7)),py-4)}}
 ctx.lineWidth=1.5;ctx.strokeStyle='#f08080';ctx.beginPath();ctx.moveTo(8,origin[1]);ctx.lineTo(v.w-14,origin[1]);ctx.stroke();drawArrow(v.w-28,origin[1],v.w-14,origin[1]);ctx.fillStyle='#f08080';ctx.textAlign='right';ctx.fillText('+'+axes[0],v.w-16,Math.max(14,origin[1]-8));
 ctx.strokeStyle='#65d6a0';ctx.beginPath();ctx.moveTo(origin[0],v.h-8);ctx.lineTo(origin[0],14);ctx.stroke();drawArrow(origin[0],28,origin[0],14);ctx.fillStyle='#65d6a0';ctx.textAlign='left';ctx.fillText('+'+axes[1],origin[0]+8,20);
 ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(...origin,3,0,Math.PI*2);ctx.fill();ctx.fillText(axes[0]+'0 / '+axes[1]+'0',origin[0]+8,Math.min(v.h-8,origin[1]+32));ctx.restore();
}
function drawSelectedPoint(){const p=world(state.selectedPoint.x,state.selectedPoint.y);ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#31a8ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p[0],p[1],5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
function hideInfo(){$('#pointInfo').classList.add('hidden');state.selectedPoint=null}
function showInfo(seg,x,y){
 const inf=lineInfo(seg);state.selectedPoint={x,y};const plane=seg.meta?.state?.plane||'G17';
 $('#pointInfo').innerHTML=`<div class="title">${escapeHtml(inf.g)} • dòng ${inf.line}</div><div>${planeAxes(plane)[0]}: <b>${fmt(inf.x)}</b></div><div>${planeAxes(plane)[1]}: <b>${fmt(inf.y)}${state.mode==='turning'&&plane==='G18'?' · code X'+fmt(inf.y*(seg.meta.state.diameterMode?2:1)):''}</b></div><div>Plan: <b>${escapeHtml(seg.meta?.state?.plane||'G17')}</b></div><div>G-code: <b>${escapeHtml(inf.g)}</b></div><div>Dao: <b>T${Math.round(inf.tool)}</b></div>`;
 const wrap=$('.canvas-wrap'),rect=wrap.getBoundingClientRect(),p=world(x,y);let px=p[0]+12,py=p[1]+12;const box=$('#pointInfo');box.classList.remove('hidden');const bw=box.offsetWidth,bh=box.offsetHeight;if(px+bw>rect.width)px=p[0]-bw-12;if(py+bh>rect.height)py=p[1]-bh-12;box.style.left=Math.max(4,px)+'px';box.style.top=Math.max(4,py)+'px';selectLine(inf.line)
}
function nearest(mx,my){const r={segments:state.displaySegments};if(!state.view)return null;let best=null,bestD=Infinity,bestPoint=null;
 for(const s of r.segments){const a=world(s.x,s.y),b=world(s.x2,s.y2);const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;let t=l2?((mx-a[0])*dx+(my-a[1])*dy)/l2:0;t=Math.max(0,Math.min(1,t));const px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(mx-px,my-py);if(d<bestD){bestD=d;best=s;bestPoint={x:s.x+(s.x2-s.x)*t,y:s.y+(s.y2-s.y)*t}}}
 return best?{seg:best,d:bestD,point:bestPoint}:null;
}
function clickCanvas(e){if(!state.view)return;const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;const hit=nearest(mx,my);if(!hit){hideInfo();draw();return}const {seg,d,point}=hit;if(d<=9){showInfo(seg,point.x,point.y)}else{hideInfo();selectLine(seg.line)}}
function run(){parse();if(!state.result.segments.length)return;state.running=true;state.step=0;state.selectedLine=null;state.paused=false;clearInterval(state.timer);state.timer=setInterval(()=>{if(state.paused)return;state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;if(s)state.selectedPoint={x:s.x2,y:s.y2};updateLines();draw();if(state.step>=state.result.segments.length){clearInterval(state.timer);state.timer=null;state.running=false;draw()}},35)}
function reset(){clearInterval(state.timer);state.timer=null;state.running=false;state.paused=false;state.step=0;state.selectedLine=null;hideInfo();draw()}
function newFile(){if(code.value&&!confirm('Xóa nội dung hiện tại để tạo chương trình mới?'))return;clearInterval(state.timer);code.value='';parse();code.focus()}
function download(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([code.value],{type:'text/plain'}));a.download='program.nc';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
code.addEventListener('input',()=>{state.selectedLine=null;hideInfo();updateLines();parse()});code.addEventListener('scroll',()=>$('#lineNumbers').scrollTop=code.scrollTop);
$('#newBtn').onclick=newFile;$('#openBtn').onclick=()=>$('#fileInput').click();$('#saveBtn').onclick=download;$('#runBtn').onclick=run;$('#pauseBtn').onclick=()=>{state.paused=!state.paused;updateStatus()};$('#stopBtn').onclick=reset;$('#resetBtn').onclick=reset;$('#stepBtn').onclick=()=>{clearInterval(state.timer);state.running=false;if(!state.result)parse();if(state.step<state.result.segments.length)state.step++;const s=state.result.segments[state.step-1];state.selectedLine=s?.line||null;updateLines();draw()};$('#millingBtn').onclick=()=>{state.mode='milling';$('#millingBtn').classList.add('active');$('#turningBtn').classList.remove('active');parse()};$('#turningBtn').onclick=()=>{state.mode='turning';$('#turningBtn').classList.add('active');$('#millingBtn').classList.remove('active');parse()};$('#fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{code.value=rd.result||'';updateLines();parse();};rd.readAsText(f);e.target.value=''};
canvas.addEventListener('click',clickCanvas);canvas.addEventListener('mouseleave',()=>{});window.addEventListener('resize',resize);new ResizeObserver(resize).observe($('.canvas-wrap'));window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();download()}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();run()}});

function cursorLine(){return code.value.slice(0,code.selectionStart).split('\n').length}
function followCursor(){state.selectedLine=cursorLine();hideInfo();updateLines();draw()}
function updateStatus(){
 const line=state.selectedLine||cursorLine(),segs=state.result?.segments||[],current=segs.filter(s=>s.line===line),last=current.at(-1),plane=last?.meta?.state?.plane||(state.mode==='turning'?'G18':'G17'),axes=planeAxes(plane);
 $('#cursorInfo').textContent=`Dòng ${line} / ${lines().length}`;$('#planeTitle').textContent=`Canvas ${axes.join(' / ')}${state.mode==='turning'?' · X/2 bán kính':''}`;$('#hint').textContent=state.mode==='turning'?'Tiện: Z ngang, X dọc. X40 trong code → bán kính 20 trên hình (X/2, G7); G8 dùng X bán kính. CR= là bán kính cung, không chia đôi. Tròn kín dùng I/K theo bán kính.':'G02 / G03: CR= là bán kính cung; CR âm chọn cung lớn. Tròn kín dùng I/J.';document.querySelector('[data-insert="G02 I10 J0"]').textContent=state.mode==='turning'?'Tròn I/K':'Tròn I/J';
 $('#selectionTitle').textContent=`Dòng ${line} · ${last?.g||'Soạn thảo'}`;
 const length=current.reduce((n,s)=>n+Math.hypot(s.x2-s.x,s.y2-s.y),0),radius=last?.meta?.arcRadius;
 $('#segmentInfo').textContent=last?`${axes[0]} ${fmt(last.x2)} · ${axes[1]} ${fmt(last.y2)}${state.mode==='turning'&&plane==='G18'?' (code X'+fmt(last.y2*(last.meta.state.diameterMode?2:1))+', '+(last.meta.state.diameterMode?'X/2':'bán kính')+')':''} | Chiều dài ${fmt(length)} mm${radius?' | R '+fmt(Math.abs(radius)):''}`:'Dòng này chưa có đường chạy dao.';
 const ds=state.result?.diagnostics||[];$('#diagnostics').replaceChildren(...ds.slice(0,30).map(d=>{const b=document.createElement('button');b.className='diagnostic '+d.severity;b.textContent=`Dòng ${d.line}: ${d.message}`;b.onclick=()=>selectLine(d.line);return b}));
 $('#status').textContent=`${state.mode==='turning'?'TIỆN':'PHAY'} · ${$('#controller').value} · ${segs.length} đoạn · ${state.running?(state.paused?'Tạm dừng':'Đang chạy'):'Sẵn sàng'} · ${ds.length} thông báo`;
 try{localStorage.setItem('cnc-note',JSON.stringify({code:code.value,mode:state.mode,controller:$('#controller').value}))}catch{}
}
function insertText(text){const start=code.selectionStart;code.setRangeText(text,start,code.selectionEnd,'end');parse();code.focus()}
function calculate(){const r=Number($('#radius').value),c=Number($('#chord').value),a=Number($('#angle').value);if(!Number.isFinite(r)||r<=0||!Number.isFinite(c)||c<0||!Number.isFinite(a)){$('#calcResult').textContent='Nhập R > 0, dây cung ≥ 0 và góc hợp lệ.';return}$('#calcResult').textContent=`Ø ${fmt(2*r)} mm · Chu vi ${fmt(2*Math.PI*r)} mm · Cung ${fmt(Math.abs(a)*Math.PI*r/180)} mm · ${c>2*r?'Dây cung phải ≤ 2R':`Góc dây cung ${fmt(2*Math.asin(c/(2*r))*180/Math.PI)}° · Độ võng ${fmt(r-Math.sqrt(r*r-c*c/4))} mm`}`}
for(const event of ['click','keyup','select'])code.addEventListener(event,()=>{if(!state.running)followCursor()});
code.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();insertText('  ')}});
$('#controller').onchange=parse;$('#dims').onchange=draw;$('#fitBtn').onclick=resize;
document.querySelectorAll('[data-insert]').forEach(b=>b.onclick=()=>insertText((code.selectionStart&&code.value[code.selectionStart-1]!=='\n'?'\n':'')+(state.mode==='turning'?b.dataset.insert==='G00 X0 Y0 Z5'?'G00 X40 Z5':b.dataset.insert.replace(/Y/g,'Z').replace(/J/g,'K'):b.dataset.insert)+'\n'));
for(const id of ['radius','chord','angle'])$('#'+id).oninput=calculate;
$('#insertCircle').onclick=()=>{const r=Number($('#radius').value);if(Number.isFinite(r)&&r>0)insertText((code.selectionStart&&code.value[code.selectionStart-1]!=='\n'?'\n':'')+(state.mode==='turning'?'G18 G02 I':'G17 G02 I')+r+(state.mode==='turning'?' K0':' J0')+'\n')};
$('#insertRadius').onclick=()=>{if(Number($('#radius').value)>0)insertText('CR='+Number($('#radius').value))};
$('#sampleBtn').onclick=()=>{if(code.value&&!confirm('Thay nội dung hiện tại bằng chương trình mẫu?'))return;code.value=state.mode==='turning'?'G21 G18\nG00 X40 Z5\nG01 X40 Z0 F0.2\nG01 X30 Z-10\nG03 X20 Z-20 CR=10\nG01 Z-40\nG00 X60 Z5':'G21 G17 G90\nG00 X0 Y0 Z5\nG01 Z-2 F100\nG01 X40 Y0 F300\nG03 X50 Y10 CR=10\nG01 Y40\nG03 X40 Y50 CR=10\nG01 X0\nG01 Y0\nG00 Z5';code.setSelectionRange(code.value.length,code.value.length);parse()};
try{const saved=JSON.parse(localStorage.getItem('cnc-note'));if(saved&&typeof saved.code==='string'){code.value=saved.code;if(['milling','turning'].includes(saved.mode))state.mode=saved.mode;if(['FANUC','HAAS','LINUXCNC'].includes(saved.controller))$('#controller').value=saved.controller;$('#millingBtn').classList.toggle('active',state.mode==='milling');$('#turningBtn').classList.toggle('active',state.mode==='turning')}}catch{}
calculate();

updateLines();parse();resize();
})();
