(()=>{"use strict";
const EPS=1e-9;
const num=v=>Number.isFinite(+v)?+v:null;
const strip=s=>String(s).replace(/\([^)]*\)/g,"").replace(/;.*$/,"").trim();
const tokens=s=>{const a=[];const re=/([A-Z])\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+\-]?\d+)?)/gi;let m;while((m=re.exec(s)))a.push([m[1].toUpperCase(),m[2]]);return a};
const val=(ws,k)=>{const x=ws.find(t=>t[0]===k);return x?num(x[1]):null};
const has=(ws,k)=>ws.some(t=>t[0]===k);
const gc=ws=>ws.filter(t=>t[0]==="G").map(t=>"G"+Number(t[1]));
const mc=ws=>ws.filter(t=>t[0]==="M").map(t=>"M"+Number(t[1]));
function arcCenter(a,b,ws,cw){
  let I=val(ws,"I"),J=val(ws,"J"),K=val(ws,"K");
  if(I!==null||J!==null){I=I||0;J=J||0;return {x:a.x+I,y:a.y+J}}
  let r=val(ws,"R"); if(r===null){
    const cr=strip(ws.raw||"").match(/\bCR\s*=\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+))/i); if(cr)r=+cr[1];
  }
  if(r===null)return null;
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d< EPS||d>2*Math.abs(r)+EPS)return null;
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,h=Math.sqrt(Math.max(0,r*r-d*d/4));
  const nx=-dy/d,ny=dx/d;
  const c1={x:mx+nx*h,y:my+ny*h},c2={x:mx-nx*h,y:my-ny*h};
  const sweep=c=>{let s=Math.atan2(a.y-c.y,a.x-c.x),e=Math.atan2(b.y-c.y,b.x-c.x),q=e-s;if(cw){while(q>=0)q-=Math.PI*2}else{while(q<=0)q+=Math.PI*2}return q};
  const q1=sweep(c1),q2=sweep(c2);
  const want=Math.abs(q1)<=Math.PI+EPS;
  return want?c1:c2;
}
function addLine(out,a,b,g,line,meta={}){out.push({x:a.x,y:a.y,x2:b.x,y2:b.y,g,line,rapid:g==="G00",meta})}
function addArc(out,a,b,ws,cw,g,line){
  const c=arcCenter(a,b,{...ws,raw:ws.raw},cw);
  if(!c){addLine(out,a,b,g,line,{arcFallback:true});return}
  const r=Math.hypot(a.x-c.x,a.y-c.y),sa=Math.atan2(a.y-c.y,a.x-c.x),ea=Math.atan2(b.y-c.y,b.x-c.x);
  let sweep=ea-sa;if(cw){while(sweep>=0)sweep-=Math.PI*2}else{while(sweep<=0)sweep+=Math.PI*2}
  const steps=Math.max(8,Math.ceil(Math.abs(sweep)*r/2));
  for(let i=0;i<steps;i++){
    const t1=sa+sweep*i/steps,t2=sa+sweep*(i+1)/steps;
    addLine(out,{x:c.x+Math.cos(t1)*r,y:c.y+Math.sin(t1)*r},{x:c.x+Math.cos(t2)*r,y:c.y+Math.sin(t2)*r},g,line,{arc:true,arcCenter:c,arcRadius:r,arcStartPoint:a,arcSweep:sweep,arcStart:sa});
  }
}
function parse(text,opt={}){
  const mode=opt.mode||"milling",controller=opt.controller||"FANUC",ls=String(text||"").replace(/\r/g,"").split("\n");
  const r={segments:[],diagnostics:[],errors:[],warnings:[],lines:ls.length,totalLength:0,bounds:null,state:null,mode,controller};
  const s={x:0,y:0,z:mode==="turning"?0:5,f:0,spindle:0,tool:1,distance:"G90",plane:mode==="turning"?"G18":"G17",units:"G21",motion:"G00",coord:"G54",feedMode:"G94"};
  const vars={}; let lastG="";
  function diag(line,severity,message,code=""){r.diagnostics.push({line,severity,message,code});if(severity==="error")r.errors.push(message);if(severity==="warning")r.warnings.push(message)}
  for(let i=0;i<ls.length;i++){
    const raw=ls[i],clean=strip(raw);if(!clean||clean==="%")continue;const line=i+1;
    if(/\bCR\s*(?!\=)/i.test(clean)){diag(line,"error","CR phải có dấu =, ví dụ CR=20. CR20/CR-20 không hợp lệ.","CR=");continue}
    const ws=tokens(clean);ws.raw=clean;if(!ws.length)continue;
    const g=gc(ws),m=mc(ws);
    for(const q of g){
      if(["G00","G01","G02","G03"].includes(q))s.motion=q;
      if(q==="G90")s.distance=q;if(q==="G91")s.distance=q;
      if(["G17","G18","G19"].includes(q))s.plane=q;if(["G20","G21"].includes(q))s.units=q;
      if(/^G5[4-9]$/.test(q))s.coord=q;
      if(!["G00","G01","G02","G03","G17","G18","G19","G20","G21","G40","G41","G42","G43","G49","G54","G55","G56","G57","G58","G59","G73","G80","G81","G82","G83","G84","G85","G86","G87","G88","G89","G90","G91","G92","G94","G95","G96","G97","G98","G99","G28","G30","G33","G70","G71","G72","G74","G75","G76"].includes(q))diag(line,"info",`${q}: được ghi nhận ở trạng thái parser.`,""+q);
    }
    const f=val(ws,"F"),sp=val(ws,"S"),tt=val(ws,"T");if(f!==null)s.f=f;if(sp!==null)s.spindle=sp;if(tt!==null)s.tool=tt;
    let tx=s.x,ty=s.y,tz=s.z;
    for(const k of ["X","Y","Z"]){const v=val(ws,k);if(v===null)continue;if(s.distance==="G90")({X:()=>tx=v,Y:()=>ty=v,Z:()=>tz=v}[k])();else ({X:()=>tx+=v,Y:()=>ty+=v,Z:()=>tz+=v}[k])()}
    const a={x:s.x,y:s.y,z:s.z},b={x:tx,y:ty,z:tz};
    if(has(ws,"X")||has(ws,"Y")||has(ws,"Z")){
      const motion=s.motion||lastG||"G00";
      if(motion==="G02"||motion==="G03")addArc(r.segments,a,b,ws,motion==="G02",motion,line);
      else addLine(r.segments,a,b,motion,line,{});
    }
    lastG=s.motion;Object.assign(s,b);
    if(["G81","G82","G83"].some(x=>g.includes(x)))diag(line,"info",`${g.find(x=>/^G8[123]$/.test(x))}: chu kỳ khoan được ghi nhận.`,"G81");
    if(["G70","G71","G72","G74","G75","G76"].some(x=>g.includes(x)))diag(line,"info",`${g.find(x=>/^G7[012456]$/.test(x))}: chu kỳ tiện được ghi nhận.`,"LATHE");
    if(m.includes("M03")||m.includes("M04")){} if(m.includes("M05")){}
  }
  if(r.segments.length){
    const xs=[],ys=[];for(const q of r.segments){xs.push(q.x,q.x2);ys.push(q.y,q.y2)}
    r.bounds={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
    r.totalLength=r.segments.reduce((n,q)=>n+Math.hypot(q.x2-q.x,q.y2-q.y),0);
  }else diag(1,"info","Chưa có chuyển động X/Y hợp lệ để vẽ.");
  r.state={...s};return r;
}
window.CNCEngine={parse};
})();