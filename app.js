(()=>{"use strict";
const $=s=>document.querySelector(s),code=$("#code"),canvas=$("#canvas"),ctx=canvas.getContext("2d");
const state={mode:"milling",controller:"FANUC",result:null,selectedLine:null,step:0,running:false,paused:false,timer:null,grid:false,zoom:1};
const C={G00:"#f87171",G01:"#38a9ff",G02:"#34d399",G03:"#f5c451"};
const sample=`%
N00 G54 G90 S500 M03
N01 G00 X20 Y20
N02 G01 Z-2 F50
N03 G01 X20 Y145
N04 G01 X65 Y170
N05 G01 X140 Y170
N06 G02 X140 Y120 R25
N07 G03 X140 Y80 R20
N08 G01 X115 Y80
N09 G01 X140 Y40
N10 G01 X40 Y40
N11 G00 Z5
N12 M05
N13 M30
%`;
function lines(){return code.value.replace(/\r/g,"").split("\n")}
function fmt(v){return Number(v||0).toFixed(3)}
function updateLines(){const ls=lines();$("#lineNumbers").innerHTML=ls.map((_,i)=>`<div data-line="${i+1}">${i+1}</div>`).join("");$("#metricLines").textContent=ls.length;cursor()}
function cursor(){const n=code.value.slice(0,code.selectionStart).split("\n").length;$("#cursorInfo").textContent=`Dòng ${n} / ${lines().length}`}
function parse(){state.result=CNCEngine.parse(code.value,{mode:state.mode,controller:state.controller});state.selectedLine=null;state.step=0;updateStats();draw();diagnostics()}
function updateStats(){const r=state.result,s=r.state,u=s.units==="G20"?"inch":"mm";$("#metricLength").textContent=`${fmt(r.totalLength)} ${u}`;$("#metricTime").textContent=s.f?`${Math.floor(r.totalLength/s.f)}s`:"0:00";$("#metricState").textContent=r.errors.length?`Có ${r.errors.length} lỗi`:"Sẵn sàng";["x","y","z"].forEach(k=>{$("#m"+k).textContent=fmt(s[k]);$("#"+k+"Pos").textContent=fmt(s[k])});$("#mf").textContent=fmt(s.f);$("#ms").textContent=fmt(s.spindle);$("#mt").textContent=s.tool;$("#modeBadge").textContent=`${state.mode==="turning"?"TIỆN":"PHAY"} • ${s.plane} • ${s.distance} • ${u}`;$("#statusText").textContent=r.errors.length?"Có lỗi G-code":"Sẵn sàng • Live parser"}
function diagnostics(){const d=state.result?.diagnostics||[];$("#diagCount").textContent=d.length;$("#diagList").innerHTML=d.length?d.slice(-40).map(x=>`<button class="diag ${x.severity}" data-line="${x.line}"><b>L${x.line}</b>${x.message}<span>${x.code||""}</span></button>`).join(""):'<div class="diag empty">Không có cảnh báo</div>';$("#diagList").querySelectorAll("[data-line]").forEach(b=>b.onclick=()=>selectLine(+b.dataset.line))}
function selectLine(n){state.selectedLine=n;const ls=lines();let p=0;for(let i=1;i<n;i++)p+=ls[i-1].length+1;code.focus();code.setSelectionRange(p,p+(ls[n-1]||"").length);const el=$("#lineNumbers").querySelector(`[data-line="${n}"]`);if(el)el.scrollIntoView({block:"nearest"});draw()}
function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.max(1,r.width*d);canvas.height=Math.max(1,r.height*d);ctx.setTransform(d,0,0,d,0,0);draw()}
function world(x,y){
 const b=state.result?.bounds,w=canvas.clientWidth,h=canvas.clientHeight;if(!b)return[0,h];
 const sx=Math.max(1,b.maxX-b.minX),sy=Math.max(1,b.maxY-b.minY),padL=Math.max(60,w*.09),padR=Math.max(90,w*.11),padT=90,padB=70;
 const scale=Math.min((w-padL-padR)/sx,(h-padT-padB)/sy)*state.zoom,uw=sx*scale,uh=sy*scale,left=padL+(w-padL-padR-uw)/2,top=padT+(h-padT-padB-uh)/2;
 return[left+(x-b.minX)*scale,top+uh-(y-b.minY)*scale]
}
function arrow(x,y,a){
 const z=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-z*Math.cos(a-.45),y-z*Math.sin(a-.45));ctx.lineTo(x-z*Math.cos(a+.45),y-z*Math.sin(a+.45));ctx.closePath();ctx.fill()
}
function textBox(t,x,y,color="#f0f4f8"){ctx.font="bold 11px Consolas,monospace";const w=ctx.measureText(t).width+10;ctx.fillStyle="rgba(8,13,18,.96)";ctx.fillRect(x-w/2,y-9,w,18);ctx.fillStyle=color;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(t,x,y);return{x:x-w/2,y:y-9,w,h:18}}
function dimH(x1,x2,y,label,ey1,ey2,color="#e0e7ee"){
 if(Math.abs(x2-x1)<14)return;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,ey1);ctx.lineTo(x1,y);ctx.moveTo(x2,ey2);ctx.lineTo(x2,y);ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();arrow(x1,y,0);arrow(x2,y,Math.PI);textBox(label,(x1+x2)/2,y,color)
}
function dimV(y1,y2,x,label,ex1,ex2,color="#e0e7ee"){
 if(Math.abs(y2-y1)<14)return;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ex1,y1);ctx.lineTo(x,y1);ctx.moveTo(ex2,y2);ctx.lineTo(x,y2);ctx.moveTo(x,y1);ctx.lineTo(x,y2);ctx.stroke();arrow(x,y1,Math.PI/2);arrow(x,y2,-Math.PI/2);ctx.save();ctx.translate(x,(y1+y2)/2);ctx.rotate(-Math.PI/2);textBox(label,0,0,color);ctx.restore()
}
function drawDimensions(){
 const r=state.result,b=r?.bounds;if(!b)return;const w=canvas.clientWidth,h=canvas.clientHeight;
 const L=world(b.minX,b.minY)[0],R=world(b.maxX,b.minY)[0],T=world(b.minX,b.maxY)[1],B=world(b.minX,b.minY)[1],gap=28;
 ctx.save();ctx.setLineDash([]);
 if(b.maxX-b.minX>1)dimH(L,R,T-35,`X ${fmt(b.maxX-b.minX)}`,T,T,"#f5c451");
 if(b.maxY-b.minY>1)dimV(T,B,L-35,`Y ${fmt(b.maxY-b.minY)}`,L,L,"#f5c451");
 const hs=new Set(),vs=new Set(),rs=new Set(),segs=r.segments;
 let hn=1,vn=1;
 for(const s of segs){
   if(s.rapid)continue;const x1=s.x,y1=s.y,x2=s.x2,y2=s.y2,dx=Math.abs(x2-x1),dy=Math.abs(y2-y1);
   if(s.meta?.arc){
     const rr=s.meta.arcRadius;if(!rr||rs.has(s.line))continue;rs.add(s.line);
     const m=s.meta,mid=m.arcStart+m.arcSweep/2,q=world(m.arcCenter.x+Math.cos(mid)*rr,m.arcCenter.y+Math.sin(mid)*rr),c=world(m.arcCenter.x,m.arcCenter.y);
     let tx=q[0]+(q[0]-c[0])*0.8,ty=q[1]+(q[1]-c[1])*0.8;tx=Math.max(55,Math.min(w-55,tx));ty=Math.max(25,Math.min(h-25,ty));
     ctx.strokeStyle="#f87171";ctx.fillStyle="#f87171";ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(tx,ty);ctx.stroke();arrow(q[0],q[1],Math.atan2(q[1]-ty,q[0]-tx));textBox(`R ${fmt(rr)}`,tx,ty,"#f87171");continue;
   }
   const a=world(x1,y1),c=world(x2,y2);
   if(dy<1e-7&&dx>1){
     const key=`${Math.min(x1,x2)}-${Math.max(x1,x2)}`;if(hs.has(key))continue;hs.add(key);dimH(a[0],c[0],T-65-hn*28,`X ${fmt(dx)}`,a[1],c[1]);hn++;
   }else if(dx<1e-7&&dy>1){
     const key=`${Math.min(y1,y2)}-${Math.max(y1,y2)}`;if(vs.has(key))continue;vs.add(key);dimV(a[1],c[1],L-65-vn*28,`Y ${fmt(dy)}`,a[0],c[0]);vn++;
   }else{
     // Không đo chiều dài đường xiên: chỉ đo X/Y chiếu như bản vẽ kỹ thuật.
     if(dx>1){const y=B+45+hn*25;dimH(a[0],c[0],y,`X ${fmt(dx)}`,a[1],c[1]);hn++}
     if(dy>1){const x=R+45+vn*25;dimV(a[1],c[1],x,`Y ${fmt(dy)}`,a[0],c[0]);vn++}
   }
 }
 ctx.restore()
}
function axes(){
 const w=canvas.clientWidth,h=canvas.clientHeight;
 ctx.save();ctx.strokeStyle="#e7edf5";ctx.fillStyle="#e7edf5";ctx.lineWidth=1.4;
 const x0=w-105,y0=65;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+55,y0);ctx.stroke();ctx.fillStyle="#f87171";ctx.beginPath();ctx.moveTo(x0+65,y0);ctx.lineTo(x0+51,y0-6);ctx.lineTo(x0+51,y0+6);ctx.fill();ctx.fillStyle="#38a9ff";ctx.beginPath();ctx.moveTo(x0,y0-10);ctx.lineTo(x0-6,y0+4);ctx.lineTo(x0+6,y0+4);ctx.fill();ctx.fillStyle="#dbe5ed";ctx.font="11px Consolas";ctx.fillText("X",x0+70,y0+4);ctx.fillText(state.mode==="turning"?"Z":"Y",x0-4,y0-16);ctx.fillText(state.mode==="turning"?"X0 Z0":"X0 Y0",x0+8,y0+26);ctx.restore()
}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle="#080d12";ctx.fillRect(0,0,w,h);if(!state.result)return;
 if(state.grid){ctx.strokeStyle="rgba(100,130,150,.10)";ctx.lineWidth=1;for(let x=0;x<w;x+=35){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=35){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}}
 for(const s of state.result.segments){
   const a=world(s.x,s.y),b=world(s.x2,s.y2),sel=state.selectedLine===s.line;
   ctx.strokeStyle=sel?"#fff":C[s.g]||"#9aa7b5";ctx.lineWidth=sel?3:1.8;ctx.setLineDash(s.rapid?[6,5]:[]);
   ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
 }
 ctx.setLineDash([]);drawDimensions();axes()
}
function run(){if(!state.result)parse();state.step=0;state.running=true;state.paused=false;$("#metricState").textContent="Đang chạy";clearInterval(state.timer);state.timer=setInterval(()=>{if(state.paused)return;const s=state.result.segments[state.step++];if(s){selectLine(s.line)}else{clearInterval(state.timer);state.running=false;$("#metricState").textContent="Hoàn tất"}},35)}
function reset(){clearInterval(state.timer);state.running=false;state.paused=false;state.step=0;state.selectedLine=null;$("#metricState").textContent="Sẵn sàng";draw()}
function setMode(m){state.mode=m;$("#millingBtn").classList.toggle("active",m==="milling");$("#turningBtn").classList.toggle("active",m==="turning");$("#viewTitle").textContent="2D";$("#coordYLabel").textContent=m==="turning"?"Z":"Y";parse()}
function dl(name,data){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"text/plain"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
document.querySelectorAll(".menu-btn").forEach(b=>b.onclick=e=>{document.querySelectorAll(".menu-btn").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".dropdown").forEach(x=>x.classList.remove("open"));b.classList.add("active");$("#menu-"+b.dataset.menu).classList.add("open")});
document.addEventListener("click",e=>{if(!e.target.closest(".menubar")){document.querySelectorAll(".menu-btn").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".dropdown").forEach(x=>x.classList.remove("open"))}});
$("#controller").onchange=e=>{state.controller=e.target.value;parse()};
$("#newBtn").onclick=$("#mNew").onclick=()=>{code.value="";updateLines();parse()};
$("#openBtn").onclick=$("#mOpen").onclick=()=>$("#fileInput").click();
$("#fileInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{code.value=rd.result;updateLines();parse()};rd.readAsText(f)};
$("#saveBtn").onclick=$("#mSave").onclick=()=>dl("program.nc",code.value);
$("#runBtn").onclick=$("#mRun").onclick=run;$("#pauseBtn").onclick=$("#mPause").onclick=()=>{state.paused=!state.paused;$("#metricState").textContent=state.paused?"Tạm dừng":"Đang chạy"};
$("#stopBtn").onclick=$("#mStop").onclick=reset;$("#resetBtn").onclick=$("#mReset").onclick=reset;$("#stepBtn").onclick=$("#mStep").onclick=()=>{if(!state.result)parse();const s=state.result.segments[state.step++];if(s)selectLine(s.line);else state.step=state.result.segments.length};
$("#millingBtn").onclick=()=>setMode("milling");$("#turningBtn").onclick=()=>setMode("turning");$("#fitBtn").onclick=$("#mFit").onclick=()=>{state.zoom=1;draw()};$("#gridBtn").onclick=$("#mGrid").onclick=()=>{state.grid=!state.grid;$("#gridBtn").classList.toggle("active",state.grid);draw()};
$("#mClear").onclick=()=>{code.value="";updateLines();parse()};$("#mCheck").onclick=()=>diagnostics();
code.addEventListener("input",()=>{updateLines();parse();$("#dirty").textContent="● Chưa lưu"});code.addEventListener("keyup",cursor);code.addEventListener("click",cursor);code.addEventListener("scroll",()=>$("#lineNumbers").scrollTop=code.scrollTop);
canvas.addEventListener("click",e=>{const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;let best=null,bd=12;for(const s of state.result?.segments||[]){const a=world(s.x,s.y),b=world(s.x2,s.y2),dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((mx-a[0])*dx+(my-a[1])*dy)/(dx*dx+dy*dy||1))),px=a[0]+t*dx,py=a[1]+t*dy,d=Math.hypot(mx-px,my-py);if(d<bd){bd=d;best=s}}if(best)selectLine(best.line)});
window.addEventListener("resize",resize);
document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.key==="s"){e.preventDefault();dl("program.nc",code.value)}if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();run()}});
code.value=sample;updateLines();resize();parse();
})();