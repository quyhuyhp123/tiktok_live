"use strict";
const $=id=>document.getElementById(id);
const control=new URLSearchParams(location.search).get("control")==="1";
document.body.classList.toggle("control-mode",control);$("controlPanel").hidden=!control;
const screen=document.querySelector(".screen");
new ResizeObserver(()=>{$("stage").style.transform=`scale(${screen.clientWidth/720})`;}).observe(screen);
const canvas=$("club"),ctx=canvas.getContext("2d",{alpha:false});
// Keep the 720 x 1280 layout, drawing 1.5 native pixels per layout unit for Full HD.
const renderScale=canvas.width/720,renderPixelScales=new WeakMap([[canvas,renderScale]]);
ctx.setTransform(renderScale,0,0,renderScale,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
// One local 2x2 head atlas; the same frames serve the crowd, DJ and spotlight.
const memeHeads=new Image();
memeHeads.src="/assets/meme-heads.png";
const fantasyWings=new Image();
fantasyWings.src="/assets/fantasy-wings.png";
const extraWings=new Image();
extraWings.src="/assets/fantasy-wings-extra.png";
const stageDancers=new Image();
stageDancers.src="/assets/stage-dancers.png";
const stageDancersRoll=new Image();
stageDancersRoll.src="/assets/stage-dancers-roll.png";
const characterArt=new Map(CharacterCatalog.characters.filter(c=>c.asset).map(character=>{const atlas=new Image();atlas.src="/assets/characters/"+character.asset;return [character.id,atlas];}));
memeHeads.onerror=()=>console.warn("Không tải được bộ mặt meme; dùng nhân vật dự phòng.");
const background=document.createElement("canvas");background.width=720;background.height=1280;
const bg=background.getContext("2d");
const worldBackground=document.createElement('canvas'),worldBackgroundCtx=worldBackground.getContext('2d',{alpha:false});
const themes={violet:["#ee38c8","#38dcff","#7650ff"],emerald:["#41ffc1","#ffd375","#227b9d"],rose:["#ff5b96","#a5eaff","#bd4fee"]};
let state={users:[],top:[],dancers:DancerCatalog.defaults(),settings:{name:"NEON ROOM",theme:"violet",camera:0},focus:null,effect:null},palette=themes.violet;
let particles=[],lastEffect=null,clockOffset=0,lastFrame=0,lastTheme="",lastCamera=-1;
let simDesiredRecipient="";
let simSelectionReady=false,simPendingRecipient=null,demoChoicesKey="",simOptionsKey="",swordRequestPending=false;
const wingTrailStores=new WeakMap();
const viewerLayer=document.createElement("canvas"),viewerLayerCtx=viewerLayer.getContext("2d"),viewerRenderTargets=new WeakMap();
viewerLayer.width=512;viewerLayer.height=512;
const now=()=>Date.now()+clockOffset;
const PODIUMS=[{x:0,y:145,z:-255},{x:-205,y:108,z:-255},{x:205,y:83,z:-255}];
const ROOM={left:-1120,right:1120,back:-900,front:2350,height:1900};
const FLOOR_RING_CENTER=[0,850];
const DISCO_BALL=[FLOOR_RING_CENTER[0],640,FLOOR_RING_CENTER[1]],DISCO_RADIUS=112;
// World-space feet anchors for five future 3D dancers; models are not loaded yet.
const CENTER_STAGE=Object.freeze({x:FLOOR_RING_CENTER[0],z:FLOOR_RING_CENTER[1],width:1040,depth:580,height:125,bevel:90});
const CENTER_STAGE_SLOTS=Object.freeze(DancerCatalog.slots.map(p=>Object.freeze({id:`center-${p.slot}`,x:p.x,y:p.y,z:p.z,rotationY:0})));
function outsideCenterStage(point,margin){
 // Extra room behind the raised deck keeps dancers visible from the front sweep.
 const side=margin??240,front=margin??240,back=margin??300,dz=point.z-CENTER_STAGE.z;
 return Math.abs(point.x-CENTER_STAGE.x)>CENTER_STAGE.width/2+side||dz>CENTER_STAGE.depth/2+front||dz<-(CENTER_STAGE.depth/2+back);
}
const stageDancerPoint=side=>[side*470,283,-440];
function frameStageCamera(base){
 const points=[-1,1].map(side=>ClubCamera.project(stageDancerPoint(side),base));
 const left=Math.min(...points.map(p=>p.x-190*p.scale)),right=Math.max(...points.map(p=>p.x+190*p.scale));
 const top=Math.min(...points.map(p=>p.y-340*p.scale)),bottom=Math.max(...points.map(p=>p.y+16*p.scale));
 const desired=left<22&&right>698?360-(left+right)/2:left<22?22-left:right>698?698-right:0;
 const shiftX=Math.max(-80,Math.min(80,desired));
 const factor=Math.min(1,right>360?(338-shiftX)/(right-360):1,left<360?(338+shiftX)/(360-left):1,top<500?464/(500-top):1,bottom>500?748/(bottom-500):1);
 return {...base,zoom:(base.zoom||1)*Math.max(.1,factor),shiftX};
}
const smooth=p=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p);};
function swordFlying(u,time){return !!SwordCatalog.rideAt(u.swordFlight,time);}
function swordPosition(u,base,time){
 const ride=SwordCatalog.rideAt(u.swordFlight,time);
 if(!ride)return {...base,y:base.y||0,flight:false};
 const age=time-ride.startedAt,remaining=ride.until-time,orbitTime=SwordCatalog.duration-SwordCatalog.takeoff-SwordCatalog.landing;
 const orbit=Math.max(0,Math.min(1,(age-SwordCatalog.takeoff)/orbitTime)),angle=orbit*Math.PI*2+(u.seed||0)*.01;
 const blend=smooth(Math.min(age/SwordCatalog.takeoff,remaining/SwordCatalog.landing));
 return {x:base.x+(Math.sin(angle)*560-base.x)*blend,y:(base.y||0)+(300+Math.sin(angle*2)*34-(base.y||0))*blend,z:base.z+(950+Math.cos(angle)*600-base.z)*blend,flight:true,blend,orbit,ride};
}
function focusAmount(time){const f=state.focus;return f?.mode==="floor"&&f.until>time?smooth(Math.min((time-f.startedAt)/450,(f.until-time)/600)):0;}
function withViewerFocus(c,u,draw,bounds={x:0,y:0,width:720,height:1280}){
 const amount=state.focus?.id===u.id?0:focusAmount(now());
 if(!amount){draw(c);return;}
 // Compose each viewer first, then blur their bitmap once instead of every limb.
 const x=Math.max(-14,Math.floor(bounds.x)),y=Math.max(-14,Math.floor(bounds.y)),right=Math.min(734,Math.ceil(bounds.x+bounds.width)),bottom=Math.min(1294,Math.ceil(bounds.y+bounds.height)),w=right-x,h=bottom-y;
 if(w<=0||h<=0)return;
 const scale=renderPixelScales.get(c.canvas)||1,pw=Math.ceil(w*scale),ph=Math.ceil(h*scale);
 if(viewerLayer.width<pw)viewerLayer.width=pw;if(viewerLayer.height<ph)viewerLayer.height=ph;
 const g=viewerLayerCtx;renderPixelScales.set(viewerLayer,scale);g.clearRect(0,0,pw,ph);g.save();g.setTransform(scale,0,0,scale,-x*scale,-y*scale);g.imageSmoothingQuality="high";
 viewerRenderTargets.set(viewerLayer,{canvas:c.canvas,x,y});draw(g);viewerRenderTargets.delete(viewerLayer);g.restore();
 c.save();c.filter=`blur(${(amount*3.2*scale).toFixed(2)}px)`;c.globalAlpha*=1-amount*.65;c.drawImage(viewerLayer,0,0,pw,ph,x,y,w,h);c.restore();
}
let floorLayoutKey="",floorLayout=new Map(),floorLayoutSeeds=new Map();
function scatterFloor(users,top){
 // Include podium viewers so a new TOP ranking does not rearrange the crowd.
 const people=[...new Map([...users,...top].map(u=>[u.id,u])).values()];
 const key=JSON.stringify(people.map(u=>[u.id,u.seed]));
 if(key===floorLayoutKey)return floorLayout;
 const layout=new Map(),seeds=new Map();
 for(const u of people)if(floorLayoutSeeds.get(u.id)===u.seed&&floorLayout.has(u.id))layout.set(u.id,floorLayout.get(u.id));
 const occupied=[...layout.values()];
 for(const u of people){
  seeds.set(u.id,u.seed);if(layout.has(u.id))continue;
  // Seeded sampling keeps the same arrangement in OBS and the control preview.
  let seed=2166136261;
  for(const char of `${u.id}:${u.seed}`)seed=Math.imul(seed^char.charCodeAt(0),16777619);
  const random=()=>{seed=(seed+0x6d2b79f5)|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return ((n^n>>>14)>>>0)/4294967296;};
  let best,bestSpace=-1;
  // Leave room around the central stage as well as the rear DJ stage.
  for(let i=0;i<80;i++){
   const angle=random()*Math.PI*2,radius=Math.sqrt(random());
   const point={x:Math.cos(angle)*radius*1000,z:1040+Math.sin(angle)*radius*1020};
   if(!outsideCenterStage(point))continue;
   const space=occupied.reduce((distance,p)=>Math.min(distance,(point.x-p.x)**2+((point.z-p.z)*1.25)**2),Infinity);
   if(space>bestSpace){best=point;bestSpace=space;}
  }
  if(!best)best={x:seed%2?-900:900,z:CENTER_STAGE.z};
  occupied.push(best);layout.set(u.id,best);
 }
 floorLayoutKey=key;floorLayout=layout;floorLayoutSeeds=seeds;return layout;
}
function floorPositions(users,top,t){
 const podiumIds=new Set(top.map(u=>u.id)),floor=users.filter(u=>!podiumIds.has(u.id)),layout=scatterFloor(users,top);
 return floor.map(u=>{
  let {x,z}=layout.get(u.id);
  if(u.walkUntil>now()){x=CENTER_STAGE.x+Math.sin(t*1.2+u.seed)*1020;z=CENTER_STAGE.z+Math.cos(t*1.2+u.seed)*940;}
  return {u,base:{x,y:0,z},...swordPosition(u,{x,y:0,z},t*1000)};
 });
}
function roseCamera(base,snapshot,time,positions){
 const focus=snapshot.focus;if(focus?.mode!=="floor"||focus.until<=time)return base;
 const rank=snapshot.top.findIndex(u=>u.id===focus.id),point=rank>=0?swordPosition(snapshot.top[rank],PODIUMS[rank],time):positions.find(p=>p.u.id===focus.id);
 if(!point)return base;
 const p=Math.max(0,Math.min(1,(time-focus.startedAt)/450,(focus.until-time)/600)),ease=p*p*(3-2*p),factor=1-.48*ease;
 return {...base,shiftX:(base.shiftX||0)*(1-ease),targetX:(base.targetX||0)+(point.x-(base.targetX||0))*ease,targetZ:(base.targetZ??450)+(point.z-(base.targetZ??450))*ease,targetY:55+(point.y+10)*ease,height:55+(base.height-55)*factor+(point.y+10)*ease,distance:base.distance*factor};
}
let swordCameraTarget=null;
function swordCamera(base,snapshot,time,positions){
 // Explicit Rose/wing reveals take priority. Follow an actual ride, never its queue.
 if(snapshot.focus?.until>time||snapshot.dancers?.focus?.until>time){swordCameraTarget=null;return base;}
 const riders=[...new Map([...snapshot.users,...snapshot.top].map(u=>[u.id,u])).values()].flatMap(u=>{const ride=SwordCatalog.rideAt(u.swordFlight,time);return ride?[{u,ride}]:[];});
 riders.sort((a,b)=>a.ride.startedAt-b.ride.startedAt||(a.u.id<b.u.id?-1:a.u.id>b.u.id?1:0));
 const selected=riders[0];
 if(!selected){swordCameraTarget=null;return base;}
 const {u,ride}=selected,rank=snapshot.top.findIndex(v=>v.id===u.id),point=rank>=0?swordPosition(u,PODIUMS[rank],time):positions.find(p=>p.u.id===u.id);
 if(!point){swordCameraTarget=null;return base;}
 const key=`${u.id}:${ride.startedAt}`;
 if(swordCameraTarget?.key!==key)swordCameraTarget={key,startedAt:time};
 const ease=smooth(Math.min((time-swordCameraTarget.startedAt)/1200,(ride.until-time)/1200)),factor=1-.42*ease;
 return {...base,shiftX:(base.shiftX||0)*(1-ease),targetX:(base.targetX||0)+(point.x-(base.targetX||0))*ease,targetZ:(base.targetZ??450)+(point.z-(base.targetZ??450))*ease,targetY:55+(point.y+45)*ease,height:55+(base.height-55)*factor+(point.y+45)*ease,distance:base.distance*factor};
}
function rhythm(t){const beats=t*(state.settings.bpm||148)/60;return {beats,pulse:Math.pow(1-(beats%1),3)};}
function dancerCamera(base,snapshot,time){
 const config=snapshot.dancers,focus=config?.focus;
 if(!config||!globalThis.Dancer3D?.ready||config.enabled===false||snapshot.focus?.until>time||!focus||focus.startedAt>time||focus.until<=time)return base;
 const point=DancerCatalog.formation(config,time).find(d=>d.slot===focus.slot);if(!point)return base;
 const ease=smooth(Math.min((time-focus.startedAt)/850,(focus.until-time)/850)),targetY=point.y+DancerCatalog.height*.78;
 const frontTurn=Math.atan2(Math.sin(-base.yaw),Math.cos(-base.yaw));
 return {...base,yaw:base.yaw+frontTurn*ease,zoom:(base.zoom||1)+(1-(base.zoom||1))*ease,shiftX:(base.shiftX||0)*(1-ease),targetX:(base.targetX||0)+(point.x-(base.targetX||0))*ease,targetZ:(base.targetZ??450)+(point.z-(base.targetZ??450))*ease,targetY:(base.targetY??55)+(targetY-(base.targetY??55))*ease,height:base.height+(targetY+8-base.height)*ease,distance:base.distance+(210-base.distance)*ease};
}
function clearBroadcast(){return state.settings.broadcastMode!=="full";}
function wingMotion(t,seed=0){
 const flap=.5+.5*Math.sin(rhythm(t).beats*Math.PI+seed*.015);
 return {spread:.56+flap*.56,lift:-.24+flap*.42,height:.91+flap*.13};
}
function wingStar(c,x,y,r,color,opacity){
 c.save();c.translate(x,y);c.globalAlpha*=opacity;c.fillStyle=color;
 c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,length=i%2?r*.22:r;i?c.lineTo(Math.cos(a)*length,Math.sin(a)*length):c.moveTo(Math.cos(a)*length,Math.sin(a)*length);}c.closePath();c.fill();
 ellipse(c,0,0,r*.22,r*.22,"#fffdf4");c.globalAlpha*=.15;ellipse(c,0,0,r*1.6,r*1.6,color);c.restore();
}
function emitWingTrail(c,u,side,t,w,h,tier,color){
 const target=viewerRenderTargets.get(c.canvas),destination=target?.canvas||c.canvas;
 let store=wingTrailStores.get(destination);if(!store){store={particles:[],emitters:new Map()};wingTrailStores.set(destination,store);}
 const key=`${u.id||"preview_"+tier}:${side}`,last=store.emitters.get(key);
 if(last&&t-last.time<.045)return;
 const scale=renderPixelScales.get(c.canvas)||1,m=c.getTransform(),sx=w*.82,sy=-h*.69,x=(m.a*sx+m.c*sy+m.e)/scale+(target?.x||0),y=(m.b*sx+m.d*sy+m.f)/scale+(target?.y||0);
 const size=Math.max(1.2,Math.min(5,Math.hypot(m.a,m.b)/scale*(2+tier*.55)));
 const velocity=last?Math.hypot(x-last.x,y-last.y):0;
 for(let i=0;i<(velocity>3?2:1);i++){
  const scatter=Math.sin(t*51+i*2+side)*5;
  store.particles.push({x:x+scatter,y:y+Math.cos(t*47+i)*4,born:t,life:.5+Math.min(tier,3)*.08,size,color,vx:last?(x-last.x)*-.7:0,vy:12+i*7});
 }
 store.emitters.set(key,{x,y,time:t});
 if(store.particles.length>900)store.particles.splice(0,store.particles.length-900);
}
function drawWingTrails(c,t){
 const store=wingTrailStores.get(c.canvas);if(!store)return;
 store.particles=store.particles.filter(p=>t-p.born<p.life&&t>=p.born);
 for(const [key,e] of store.emitters)if(t-e.time>2)store.emitters.delete(key);
 const scale=renderPixelScales.get(c.canvas)||1;
 c.save();c.setTransform(scale,0,0,scale,0,0);c.globalCompositeOperation="screen";
 for(const p of store.particles){const age=t-p.born,fade=1-age/p.life;wingStar(c,p.x+p.vx*age,p.y+p.vy*age,p.size*(.35+fade*.65),p.color,fade*fade*(.55+.45*Math.sin(age*24)**2));}
 c.restore();
}
function entryPose(user,time){
 const age=user.joinedAt?Math.max(0,time-user.joinedAt):Infinity;
 if(age<420){const p=age/420;return {age,falling:true,y:-1250*(1-p*p),sx:1,sy:1,impact:0};}
 const landed=age-420;
 if(landed<400){
  const squash=Math.max(0,1-landed/90),bounce=landed<90?0:-Math.sin(Math.min(1,(landed-90)/230)*Math.PI)*28;
  return {age,falling:false,y:bounce,sx:1+squash*.28,sy:1-squash*.25,impact:1-landed/400};
 }
 return {age,falling:false,y:0,sx:1,sy:1,impact:0};
}
function line(c,points,color,width=1,glow=0){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.shadowColor=color;c.shadowBlur=glow;c.stroke();c.shadowBlur=0;}
function poly(c,points,fill,stroke){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
function rect(c,x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,"transparent");c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function buildBackground(){
 const c=bg,[pink,cyan,purple]=palette;
 const sky=c.createLinearGradient(0,0,0,1280);sky.addColorStop(0,"#05060f");sky.addColorStop(.5,"#111026");sky.addColorStop(1,"#050711");rect(c,0,0,720,1280,sky);
 glow(c,360,540,420,purple+"32");glow(c,10,800,270,pink+"20");glow(c,700,850,300,cyan+"19");
 // Architecture: faceted side walls, recessed LED stage and ceiling trusses.
 poly(c,[[0,90],[128,210],[128,692],[0,870]],"#090b18");
 poly(c,[[720,90],[592,210],[592,692],[720,870]],"#090b18");
 for(let i=0;i<8;i++){
  const y=160+i*80;line(c,[[0,y],[128,230+i*56]],"#33304d",1);
  line(c,[[720,y],[592,230+i*56]],"#33304d",1);
  for(let j=0;j<3;j++){const x=j*43;line(c,[[x,y],[x+43,y+80],[x,y+160]],"#262039",1);line(c,[[720-x,y],[677-x,y+80],[720-x,y+160]],"#262039",1);}
 }
 for(let i=0;i<4;i++){const y=15+i*34;line(c,[[0,y+65],[360,y-48],[720,y+65]],"#202036",10);line(c,[[0,y+61],[360,y-52],[720,y+61]],"#353047",1);}
 line(c,[[0,330],[105,373],[105,728],[0,780]],pink,3,15);line(c,[[720,285],[616,335],[616,721],[720,768]],cyan,3,15);
 rect(c,132,360,456,286,"#050b1a");
 line(c,[[124,673],[124,350],[596,350],[596,673]],cyan,3,15);
 line(c,[[143,655],[143,372],[576,372],[576,655]],pink,2,12);
 for(let x=154;x<575;x+=13)for(let y=385;y<647;y+=13)rect(c,x,y,3,3,(x+y)%3?"#194078":"#275392");
 line(c,[[259,596],[360,400],[461,596],[259,596]],pink,5,23);
 line(c,[[280,583],[360,428],[440,583],[280,583]],purple,2,8);
 // Perspective floor with reflected neon seams.
 poly(c,[[0,760],[170,665],[550,665],[720,760],[720,1280],[0,1280]],"#0a0c1b");
 const floorGlow=c.createLinearGradient(0,685,0,1280);floorGlow.addColorStop(0,"#2b174330");floorGlow.addColorStop(.35,"#151d3c70");floorGlow.addColorStop(1,"#080914");rect(c,0,760,720,520,floorGlow);
 for(let x=-1600;x<2400;x+=160)line(c,[[360+(x-360)*.09,680],[x,1280]],"#3a285b",1);
 for(let i=0;i<13;i++){const y=688+Math.pow(i/12,2)*650;line(c,[[0,y],[720,y]],i%3===0?"#384569":"#242039",1);}
 for(let i=0;i<5;i++){glow(c,170+i*95,800+i%2*180,130,i%2?cyan+"18":pink+"20");}
 // Raised DJ console.
 poly(c,[[126,652],[593,652],[630,680],[90,680]],"#29253e");
 poly(c,[[90,680],[630,680],[610,754],[110,754]],"#070b17", "#234b67");
 line(c,[[92,682],[628,682]],cyan,3,15);line(c,[[110,754],[610,754]],pink,3,14);
 for(let i=0;i<25;i++){const x=130+i*19;line(c,[[x,698],[x-10,740]],i%2?pink+"28":cyan+"38",1);}
 line(c,[[320,733],[360,691],[400,733],[320,733]],cyan,2,9);
 [190,480].forEach(x=>{ellipse(c,x,651,45,10,"#0b0d18");ellipse(c,x,650,29,6,"#30384b");ellipse(c,x,650,18,4,"#090b12");line(c,[[x-45,644],[x+45,644]],pink,1,5);});
 rect(c,288,637,126,21,"#171928",4);for(let i=0;i<9;i++)rect(c,298+i*12,643,3,8,i%2?cyan:pink);
 // Speaker stacks.
 [42,620].forEach(x=>{rect(c,x,548,58,192,"#060813",3);line(c,[[x,548],[x+58,548],[x+58,740]],"#393447",2);for(let y=580;y<730;y+=55){ellipse(c,x+29,y,24,24,"#18182c");ellipse(c,x+29,y,19,19,"#080a18");ellipse(c,x+29,y,9,9,"#1d1c32");c.strokeStyle=purple+"88";c.lineWidth=1;c.beginPath();c.arc(x+29,y,24,0,Math.PI*2);c.stroke();}});
 // Elliptical overhead lighting rig.
 c.strokeStyle="#2b2c42";c.lineWidth=9;c.beginPath();c.ellipse(360,354,252,52,0,0,Math.PI*2);c.stroke();
 c.strokeStyle="#6b668133";c.lineWidth=1;c.beginPath();c.ellipse(360,348,252,52,0,0,Math.PI*2);c.stroke();
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=360+252*Math.cos(a),y=354+52*Math.sin(a);rect(c,x-9,y-3,18,15,"#191928",3);ellipse(c,x,y+11,6,3,i%2?pink:cyan);}
 const vignette=c.createRadialGradient(360,680,230,360,670,800);vignette.addColorStop(0,"transparent");vignette.addColorStop(1,"#000b");rect(c,0,0,720,1280,vignette);
}
// Original meme stickers: plush proportions, round faces and expressive bowl cuts.
function dancePose(u,t){return CharacterCatalog.motion.pose(u,t,{bpm:state.settings.bpm,energy:state.settings.energy,boosted:u.danceUntil>now()});}
function customCharacter(u){
 const character=CharacterCatalog.definition(u.variant),atlas=characterArt.get(u.variant);
 return character?.canvas?{character,atlas:null}:character?.asset&&atlas?.complete&&atlas.naturalWidth?{character,atlas}:null;
}
function drawIronMan(c,u,hip,phase,mode){
 const red=c.createLinearGradient(-40,-168,45,-15);red.addColorStop(0,"#ff6871");red.addColorStop(.4,"#cb2939");red.addColorStop(1,"#6a1d31");
 const gold=c.createLinearGradient(-25,-155,35,-45);gold.addColorStop(0,"#fff2a5");gold.addColorStop(.45,"#f5bd51");gold.addColorStop(1,"#c9842d");
 function panel(points,fill,outer=false){c.save();c.lineJoin="round";if(outer){c.lineWidth=7;poly(c,points,fill,"#fffdf8");}c.lineWidth=1.8;poly(c,points,fill,"#502f32");c.restore();}
 c.save();c.translate(hip*.55,0);
 panel([[-24,-62],[24,-62],[32,-47],[24,-19],[0,-13],[-24,-19],[-32,-47]],red,true);
 for(const side of [-1,1])panel([[side*7,-57],[side*24,-55],[side*27,-44],[side*12,-43]],gold);
 line(c,[[-19,-22],[0,-19],[19,-22]],"#f8c965",2);line(c,[[-13,-16],[13,-16]],"#f8c965",1.5);
 c.save();c.globalCompositeOperation="screen";glow(c,0,-31,11,"#80efff99");ellipse(c,0,-31,6,6,"#81ecff");ellipse(c,0,-31,3.8,3.8,"#f4ffff");c.restore();c.restore();
 c.save();c.rotate(Math.sin(phase+.7)*(mode===3?.12:.045));c.lineJoin="round";
 c.beginPath();c.moveTo(-38,-157);c.quadraticCurveTo(0,-174,38,-157);c.quadraticCurveTo(54,-147,53,-121);c.lineTo(47,-75);c.quadraticCurveTo(37,-43,0,-40);c.quadraticCurveTo(-37,-43,-47,-75);c.lineTo(-53,-121);c.quadraticCurveTo(-54,-147,-38,-157);c.closePath();c.lineWidth=8;c.strokeStyle="#fffdf8";c.stroke();c.fillStyle=red;c.fill();c.lineWidth=2;c.strokeStyle="#502f32";c.stroke();
 for(const side of [-1,1]){ellipse(c,side*48,-104,9,18,"#a62c3a");line(c,[[side*48,-116],[side*48,-92]],"#ffd78b",2);}
 panel([[-34,-149],[-10,-157],[10,-157],[34,-149],[40,-122],[32,-104],[30,-68],[16,-49],[-16,-49],[-30,-68],[-32,-104],[-40,-122]],gold);
 line(c,[[-28,-143],[-12,-147],[12,-147],[28,-143]],"#fff6c7",2);
 for(const side of [-1,1]){
  const eye=[[side*31,-111],[side*8,-105],[side*8,-98],[side*29,-102]];c.save();c.shadowColor="#77efff";c.shadowBlur=8;poly(c,eye,"#eaffff","#66d9ff");c.restore();
  line(c,[[side*29,-93],[side*24,-77]],"#b57a36",2);
 }
 line(c,[[-14,-72],[14,-72]],"#60443b",3);line(c,[[-17,-60],[17,-60]],"#ffe2a0",1.5);c.restore();
 if(u.vip)wingStar(c,30,-53,5,"#ffdb82",.9);
}
function drawClubMeme(c,character,u,hip,phase){
 const w=character.bodyWidth,ink="#292631";c.save();c.translate(hip*.55,0);c.lineJoin="round";
 c.beginPath();c.moveTo(-w*.31,-65);c.quadraticCurveTo(-w*.61,-60,-w*.46,-31);c.lineTo(-w*.35,-15);c.quadraticCurveTo(0,-9,w*.35,-15);c.lineTo(w*.46,-31);c.quadraticCurveTo(w*.61,-60,w*.31,-65);c.closePath();c.lineWidth=7;c.strokeStyle="#fffdf8";c.stroke();c.fillStyle=character.body;c.fill();c.lineWidth=2;c.strokeStyle=ink;c.stroke();
 if(character.key==="nam-meme"){
  poly(c,[[-10,-62],[10,-62],[6,-33],[-6,-33]],"#fffdf8");poly(c,[[-13,-60],[0,-55],[-11,-50]],"#34303f");poly(c,[[13,-60],[0,-55],[11,-50]],"#34303f");
  for(const y of [-43,-32,-22])ellipse(c,0,y,1.8,1.8,"#e9e3fa");
 }else if(character.outfit==="jacket"){
  poly(c,[[-9,-62],[9,-62],[12,-16],[-12,-16]],"#fff4d7");
  poly(c,[[-27,-61],[-9,-62],[-3,-48],[-14,-43],[-10,-17],[-28,-19]],"#3d3c4a",character.trim);
  poly(c,[[27,-61],[9,-62],[3,-48],[14,-43],[10,-17],[28,-19]],"#3d3c4a",character.trim);
  c.beginPath();c.ellipse(0,-52,13,12,0,0,Math.PI);c.strokeStyle=character.trim;c.lineWidth=3;c.stroke();ellipse(c,0,-39,4,5,character.trim);
 }else if(character.outfit==="suspenders"){
  for(const side of [-1,1]){line(c,[[side*16,-60],[side*12,-21]],"#2f3044",5);rect(c,side*12-3,-32,6,6,character.trim,1);}
  poly(c,[[-12,-59],[0,-55],[-12,-50]],character.trim);poly(c,[[12,-59],[0,-55],[12,-50]],character.trim);ellipse(c,0,-55,3,3,"#fff");
  for(const y of [-44,-35,-26])ellipse(c,0,y,1.5,1.5,"#484158");
 }else if(character.outfit==="tracksuit"){
  line(c,[[0,-60],[0,-16]],"#edfaff",2.5);
  for(const side of [-1,1]){line(c,[[side*23,-57],[side*26,-22]],character.trim,4);line(c,[[side*17,-57],[side*20,-22]],"#edfaff",1.5);}
  rect(c,5,-44,13,5,character.trim,2);
 }else if(character.outfit==="jersey"){
  line(c,[[-20,-60],[0,-51],[20,-60]],"#fff7dc",4);line(c,[[-25,-18],[25,-18]],character.trim,3);
  c.textAlign="center";c.fillStyle="#fff5de";c.font="900 22px Arial";c.fillText("99",0,-27);
 }else{
  line(c,[[-w*.25,-59],[0,-51],[w*.25,-59]],character.trim,2.5);line(c,[[-8,-52],[-8,-38]],character.trim,1.5);line(c,[[8,-52],[8,-38]],character.trim,1.5);
  rect(c,-w*.25,-32,w*.5,13,character.trim+"55",5);line(c,[[-w*.2,-23],[w*.2,-23]],character.trim,1.5);ellipse(c,0,-43,3,3,"#fff5");
 }c.restore();
 c.save();c.rotate(Math.sin(phase+.7)*.055);
 if(memeHeads.complete&&memeHeads.naturalWidth){const sw=memeHeads.naturalWidth/2,sh=memeHeads.naturalHeight/2,f=character.headFrame;c.drawImage(memeHeads,f%2*sw,Math.floor(f/2)*sh,sw,sh,-character.headWidth/2,-168,character.headWidth,132);}
 if(character.accessory==="shades"){
  for(const side of [-1,1]){rect(c,side<0?-34:4,-114,30,16,"#171b29",5);line(c,[[side<0?-30:8,-111],[side<0?-20:18,-111]],"#8ee7ed",2);}
  line(c,[[-5,-110],[5,-110]],"#e9be67",3);line(c,[[-45,-114],[-34,-110]],"#242735",3);line(c,[[34,-110],[45,-114]],"#242735",3);
 }else if(character.accessory==="cap"){
  c.beginPath();c.ellipse(0,-143,37,20,0,Math.PI,Math.PI*2);c.closePath();c.fillStyle=character.trim;c.fill();c.strokeStyle="#fff3e8";c.lineWidth=3;c.stroke();
  poly(c,[[-37,-143],[37,-143],[55,-134],[16,-133]],"#d83b83","#fff3e8");ellipse(c,-8,-151,5,5,"#fff4d9");
 }else if(character.accessory==="headband"){
  line(c,[[-53,-130],[0,-136],[53,-130]],"#fff5df",10);line(c,[[-53,-130],[0,-136],[53,-130]],"#ee455e",6);
  const flap=Math.sin(phase)*6;poly(c,[[49,-130],[70,-121+flap],[63,-116+flap],[49,-126]],character.trim);poly(c,[[49,-128],[64,-106-flap],[55,-109-flap],[46,-125]],"#f45c6c");
 }
 if(character.headphones){
  c.strokeStyle="#fffdf8";c.lineWidth=9;c.beginPath();c.ellipse(0,-115,character.headWidth*.43,52,0,Math.PI,Math.PI*2);c.stroke();c.strokeStyle="#2b2935";c.lineWidth=5;c.stroke();
  for(const side of [-1,1]){ellipse(c,side*character.headWidth*.43,-112,8,14,"#282630");ellipse(c,side*character.headWidth*.44,-112,4,9,character.trim);}
 }c.restore();
}
function drawCustomCharacter(c,custom,u,hip,phase,mode){
 const {character,atlas}=custom;if(character.meme){drawClubMeme(c,character,u,hip,phase);return;}if(character.canvas){drawIronMan(c,u,hip,phase,mode);return;}
 const sw=atlas.naturalWidth/2,sh=atlas.naturalHeight,w=character.bodyWidth;
 c.save();c.translate(hip*.55,0);c.drawImage(atlas,sw,0,sw,sh,-w/2,-64,w,54);c.restore();
 c.save();c.rotate(Math.sin(phase+.7)*(mode===3?.12:.045));c.drawImage(atlas,0,0,sw,sh,-character.headWidth/2,-168,character.headWidth,132);c.restore();
 if(u.vip)wingStar(c,w*.36,-53,5,"#ffdb82",.9);
}
function dancer(c,x,y,scale,u,t,focus=false,airborne=false){
 const {beats}=rhythm(t),{phase,step,mode,energy,hip,leftArm,rightArm,legs,bounce,sway,tilt,turn=0}=dancePose(u,t),hasBatons=CharacterCatalog.motion.hasBatons(u,state.settings.handProps||"mixed");
 const custom=customCharacter(u),outfit=custom?.character;
 c.save();c.translate(x,y);if(!airborne)ellipse(c,0,2,29*scale,8*scale,"#0008");
 if(u.vip||focus){c.save();c.globalCompositeOperation="screen";glow(c,0,-35*scale,85*scale,(u.vip?"#ffcf55":"#59e8ff")+"26");c.restore();}
 c.scale(scale,scale);c.translate(sway,bounce);c.rotate(tilt);
 c.scale(1-Math.abs(Math.sin(turn))*.24,1);
 c.scale(1+Math.max(0,-step)*.07*energy,1-Math.max(0,-step)*.09*energy);
 const color=["#fffdf8","#fffdf8","#ffe4eb","#e3f3ff","#ffe9a9"][u.variant%5];
 const tier=WingCatalog.tierFor(u.coins||0),wing=WingCatalog.definition(tier),atlas=wing.atlas==="extra"?extraWings:fantasyWings;
 if((u.wings||u.vip||tier>0)&&atlas.complete&&atlas.naturalWidth>0){
  const cellW=atlas.naturalWidth/2,cellH=atlas.naturalHeight/2;
  const rarity=Math.min(3,Math.ceil(tier/2)),w=tier?120+rarity*12:108,h=tier?142+rarity*12:132;
  const aura=wing.color;
  const flap=wingMotion(t,u.seed||0);
  for(const side of [-1,1]){
   c.save();c.translate(side*12,-43);c.scale(side*flap.spread,flap.height);c.rotate(flap.lift);
   c.drawImage(atlas,(wing.frame%2)*cellW,Math.floor(wing.frame/2)*cellH,cellW,cellH,-w*.12,-h*.83,w,h);
   if(!u.ghost)emitWingTrail(c,u,side,t,w,h,tier,aura);
   c.save();c.globalCompositeOperation="screen";for(let j=0;j<4+rarity*2;j++){
    const a=t*2.1+j*2.4+(u.seed||0)*.1;
    const along=(j+.5)/(4+rarity*2),drift=Math.sin(a*.7)*6;
    const px=w*(.24+along*.63)+Math.cos(a)*9,py=-h*(.22+along*.54)+drift;
    const twinkle=Math.pow(Math.max(0,Math.sin(a)),3);
    wingStar(c,px,py,2.3+twinkle*(3+rarity),aura,.2+twinkle*.8);
   }c.restore();
   c.restore();
  }
 }else if(u.wings){for(const side of [-1,1]){c.save();c.scale(side,1);c.rotate(Math.sin(phase)*.1);poly(c,[[10,-49],[47,-87],[52,-52],[35,-27],[12,-32]],"#edeeffcc","#a7dfff");line(c,[[16,-40],[44,-70],[36,-39]],"#ac9ddb",2);c.restore();}}
 c.lineCap="round";c.lineJoin="round";
 function limb(points,width=10,fill=outfit?.limb||"#f9f5ef"){line(c,points,"#f9f5ef",width+5);line(c,points,"#282633",width+2);line(c,points,fill,width-2);}
 function arm(points){
  const width=outfit?.armWidth||8;limb(points,width);
  if(outfit){line(c,[points[1],points[2]],outfit.glove,width-2);ellipse(c,...points[2],width*.48,width*.48,outfit.skin);if(outfit.key==="ironman")ellipse(c,...points[2],2.5,2.5,"#c9ffff");}
  if(!hasBatons){const [x,y]=points[2];ellipse(c,x,y,width*.6,width*.55,"#302b35");ellipse(c,x,y-1,width*.45,width*.43,outfit?.skin||"#fffdf8");}
 }
 if(outfit){leftArm[0][0]=-outfit.bodyWidth*.28;rightArm[0][0]=outfit.bodyWidth*.28;if(outfit.key==="hulk")for(let i=0;i<legs.length;i++)for(const point of legs[i])point[0]+=(i?1:-1)*7;}
 function rope(front){if(mode!==6||u.riding||front!==(Math.cos(phase)>=0))return;c.save();c.beginPath();c.moveTo(...leftArm[2]);const y=-55+Math.cos(phase)*135;c.bezierCurveTo(-102,y,102,y,...rightArm[2]);c.strokeStyle=palette[1];c.shadowColor=palette[1];c.shadowBlur=6;c.lineWidth=2.3;c.stroke();c.restore();}
 rope(false);for(const leg of legs){const width=outfit?.legWidth||9;limb(leg,width);if(outfit){line(c,[leg[1],leg[2]],outfit.boot,width-2);if(outfit.key==="hulk")line(c,[leg[0],leg[1]],"#79509e",width-1);if(outfit.key==="ironman")ellipse(c,...leg[1],4,3,outfit.trim);}}
 const frontArms=mode>=7&&!u.riding;
 if(!frontArms){arm(leftArm);arm(rightArm);}
 if(custom)drawCustomCharacter(c,custom,u,hip,phase,mode);
 else{
 const ink="#302b32",paper="#fffdf8",v=u.variant%5;
 function shape(draw,fill=paper){c.beginPath();draw();c.strokeStyle="#fff";c.lineWidth=7;c.stroke();c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();}
 function curve(a,width=2,color=ink){c.beginPath();c.moveTo(a[0],a[1]);c.quadraticCurveTo(...a.slice(2));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 function heart(x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);c.beginPath();c.moveTo(0,3);c.bezierCurveTo(-12,-5,-5,-12,0,-6);c.bezierCurveTo(5,-12,12,-5,0,3);c.fillStyle="#f29eb9";c.fill();c.restore();}
 // Pear-shaped onesie and small chest motif.
 shape(()=>{c.moveTo(-14,-48);c.quadraticCurveTo(0,-54,14,-48);c.quadraticCurveTo(23+hip,-32,17+hip,-18);c.quadraticCurveTo(hip,-12,-17+hip,-18);c.quadraticCurveTo(-23+hip,-32,-14,-48);},color);
 if(v===2)heart(hip*.5,-29,.6);else{curve([-6+hip*.4,-35,hip*.5,-30,6+hip*.4,-35],1.4,"#b6a9b2");ellipse(c,hip*.6,-25,1.5,1.5,"#d5c4cf");}
 c.save();c.rotate(Math.sin(phase+.7)*(mode===3?.2:.09));
 if(memeHeads.complete&&memeHeads.naturalWidth>0){
  const frame=[0,1,2,3,0][v],w=memeHeads.naturalWidth/2,h=memeHeads.naturalHeight/2;
  c.drawImage(memeHeads,(frame%2)*w,Math.floor(frame/2)*h,w,h,-55,-145,110,110);
 }else{
 if(v===1){ // Panda reaction sticker.
  ellipse(c,-27,-107,13,13,ink);ellipse(c,27,-107,13,13,ink);ellipse(c,-27,-107,6,6,"#615660");ellipse(c,27,-107,6,6,"#615660");
 }
 if(v===2){
  shape(()=>{c.moveTo(-33,-85);c.lineTo(-32,-121);c.quadraticCurveTo(-20,-119,-12,-107);c.lineTo(15,-107);c.quadraticCurveTo(24,-120,33,-121);c.lineTo(34,-83);});
  poly(c,[[-28,-112],[-26,-95],[-17,-103]],"#f8bacb");poly(c,[[28,-112],[26,-95],[17,-103]],"#f8bacb");
 }
 if(v!==1&&v!==2)shape(()=>{c.moveTo(-36,-66);c.bezierCurveTo(-53,-91,-31,-125,0,-125);c.bezierCurveTo(35,-125,49,-99,35,-66);c.quadraticCurveTo(0,-53,-36,-66);},ink);
 // Oversized squishy face, rounded cheeks and a soft chin.
 shape(()=>{c.moveTo(-33,-87);c.bezierCurveTo(-39,-75,-32,-49,-14,-46);c.quadraticCurveTo(0,-40,15,-46);c.bezierCurveTo(33,-50,39,-75,33,-87);c.quadraticCurveTo(0,-126,-33,-87);});
 if(v!==1&&v!==2){
  c.beginPath();c.moveTo(-36,-77);c.bezierCurveTo(-44,-106,-24,-122,0,-122);c.bezierCurveTo(26,-122,44,-103,36,-77);c.lineTo(29,-73);c.lineTo(27,-92);c.quadraticCurveTo(4,-85,-26,-94);c.lineTo(-28,-73);c.closePath();c.fillStyle=ink;c.fill();
  curve([-23,-109,-5,-118,13,-112],2,"#615961");
 }
 for(const side of [-1,1]){ellipse(c,side*23,-64,8,4,"#f6b7c1aa");for(let j=0;j<3;j++)line(c,[[side*23-4+j*3,-66],[side*23-5+j*3,-62]],"#dc8f9e99",.9);}
 const blink=Math.sin(t*1.3+u.seed)>.996;
 if(v===0){ // Relaxed eyelids and a cheeky little smirk.
  curve([-23,-82,-16,-87,-9,-82],2.6);curve([8,-83,16,-89,23,-84],2.6);
  curve([-23,-76,-15,-80,-8,-76],2.3);curve([8,-76,16,-80,23,-76],2.3);
  if(!blink){ellipse(c,-14,-74,2,2.2,ink);ellipse(c,16,-74,2,2.2,ink);}
  curve([-10,-60,0,-53,12,-64],2.4);curve([10,-65,14,-64,14,-61],1.4);
 }else if(v===1){
  for(const side of [-1,1]){c.save();c.translate(side*16,-78);c.rotate(side*.25);ellipse(c,0,0,9,7,"#403b43");c.restore();curve([side*16-5,-78,side*16,-81,side*16+5,-78],1.8,paper);}
  curve([-23,-88,-16,-91,-9,-87],2.4);curve([9,-87,16,-91,23,-88],2.4);
  ellipse(c,0,-68,3,2,ink);curve([-11,-61,0,-50,12,-62],2.7);curve([-6,-56,0,-53,6,-57],1.2,"#a3757e");
 }else if(v===2){
  for(const side of [-1,1]){if(blink)curve([side*14-4,-76,side*14,-73,side*14+4,-76],2);else{ellipse(c,side*14,-77,4,5.5,ink);ellipse(c,side*14-1,-79,1.3,1.7,"#fff");}}
  ellipse(c,0,-68,2,1.5,"#da9aa8");curve([-7,-63,-3,-57,0,-63],1.8);curve([0,-63,3,-57,7,-63],1.8);
  for(const side of [-1,1]){line(c,[[side*26,-70],[side*35,-73]],"#b4a4ab",1);line(c,[[side*27,-66],[side*36,-66]],"#b4a4ab",1);}
 }else if(v===3){
  curve([-23,-75,-16,-85,-9,-75],2.7);curve([9,-75,16,-85,23,-75],2.7);
  c.beginPath();c.moveTo(-11,-63);c.quadraticCurveTo(0,-58,12,-64);c.quadraticCurveTo(5,-43,-6,-52);c.closePath();c.fillStyle=ink;c.fill();ellipse(c,2,-53,5,3,"#f39daf");heart(36,-103,.65);
 }else{
  curve([-22,-80,-15,-86,-8,-80],2.5);curve([8,-76,15,-80,22,-76],2.4);
  if(!blink){ellipse(c,-14,-76,3,4,ink);ellipse(c,-15,-77,1,1.5,"#fff");}
  curve([-9,-60,0,-52,10,-63],2.5);
 }
 }
 if(v===4||u.vip){shape(()=>{c.moveTo(-20,-120);c.lineTo(-24,-139);c.lineTo(-10,-133);c.lineTo(0,-147);c.lineTo(10,-133);c.lineTo(24,-139);c.lineTo(20,-120);c.closePath();},"#ffdc77");ellipse(c,0,-128,3,3,"#f392ae");}
 c.restore();
 }
 if(frontArms){const arms=Math.cos(phase*.5)>0?[rightArm,leftArm]:[leftArm,rightArm];for(const points of arms)arm(points);}
 // Anchor each LED baton to its actual animated wrist, including shuffle poses.
 for(const [side,arm] of hasBatons?[[-1,leftArm],[1,rightArm]]:[]){
  const hand=arm[2],pulse=.25+.75*Math.pow((Math.cos(beats*Math.PI*2+(side<0?0:Math.PI))+1)/2,2);
  const color=palette[(Math.floor(beats/2)+(side<0?0:1))%2];
  const batonTilt=mode===9?side*(1.1+Math.sin(phase)*.2):mode===8?side*1.05:side*(frontArms?.85+Math.sin(phase*.5)*.5:.2+step*.16);
  c.save();c.translate(hand[0],hand[1]);c.rotate(batonTilt);
  rect(c,-3,-5,6,11,"#282636",2);line(c,[[-2,-2],[2,-2]],"#a8a6ba",1);
  c.globalAlpha*=pulse;
  line(c,[[0,-7],[0,-39]],color,9,11);
  line(c,[[0,-8],[0,-38]],"#f7fdff",2.5,0);
  ellipse(c,0,-39,3,3,color);c.restore();
 }
 rope(true);
 c.restore();
 if(!focus){c.save();c.textAlign="center";c.font=`700 ${Math.max(10,12*scale)}px 'Segoe UI',sans-serif`;c.lineWidth=3;c.strokeStyle="#080914";const name=u.nickname.length>13?u.nickname.slice(0,12)+"…":u.nickname,tagY=y-(custom?181:150)*scale;c.strokeText(name,x,tagY);c.fillStyle=u.vip?"#ffdf8e":"#e7e3f8";c.fillText(name,x,tagY);c.restore();}
}
function burst(effect){
 if(!effect||effect.id===lastEffect||effect.until<now())return;lastEffect=effect.id;
 const count=effect.type==="party"?150:75;
 for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=1.4+Math.random()*6;particles.push({x:effect.type==="party"?100+Math.random()*520:360,y:effect.type==="party"?420+Math.random()*220:760,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,hue:effect.type==="rose"?"#ff80b8":[palette[0],palette[1],"#ffe4aa"][i%3],size:1+Math.random()*3});}
 particles=particles.slice(-250);
}
function nearIntersection(a,b,da,db){const p=(100-da)/(db-da);return a.map((v,i)=>v+(b[i]-v)*p);}
function worldLine(c,pose,points,color,width=1,blur=0){
 c.beginPath();let visible=false;
 const projected=points.map(point=>ClubCamera.project(point,pose));
 for(let i=1;i<points.length;i++){
  let a=points[i-1],b=points[i],p=projected[i-1],q=projected[i],da=p.depth,db=q.depth;
  if(da<100&&db<100)continue;
  if(da<100)p=ClubCamera.project(nearIntersection(a,b,da,db),pose);else if(db<100)q=ClubCamera.project(nearIntersection(a,b,da,db),pose);
  if(p.x< -40&&q.x< -40||p.x>760&&q.x>760||p.y< -40&&q.y< -40||p.y>1320&&q.y>1320)continue;
  c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);visible=true;
 }
 if(visible){c.strokeStyle=color;c.lineWidth=width;c.shadowColor=color;c.shadowBlur=blur;c.stroke();c.shadowBlur=0;}
}
function worldQuad(c,pose,points,fill,stroke){
 const projected=points.map(point=>ClubCamera.project(point,pose));
 if(projected.every(p=>p.depth<100))return;
 if(projected.every(p=>p.depth>=100)){
  if(projected.every(p=>p.x< -30)||projected.every(p=>p.x>750)||projected.every(p=>p.y< -30)||projected.every(p=>p.y>1310))return;
  poly(c,projected.map(p=>[p.x,p.y]),fill,stroke);return;
 }
 const clipped=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],da=projected[i].depth,db=projected[(i+1)%points.length].depth;
  if(da>=100)clipped.push(a);if((da<100)!==(db<100))clipped.push(nearIntersection(a,b,da,db));
 }
 if(clipped.length>=3)poly(c,clipped.map(v=>{const p=ClubCamera.project(v,pose);return [p.x,p.y];}),fill,stroke);
}
function raisedStage(c,pose,x,z,w,d,h,color,base=0){
 const faces=[[[x-w,base,z-d],[x+w,base,z-d],[x+w,h,z-d],[x-w,h,z-d]],[[x-w,base,z+d],[x+w,base,z+d],[x+w,h,z+d],[x-w,h,z+d]],[[x-w,base,z-d],[x-w,base,z+d],[x-w,h,z+d],[x-w,h,z-d]],[[x+w,base,z-d],[x+w,base,z+d],[x+w,h,z+d],[x+w,h,z-d]]];
 faces.sort((a,b)=>ClubCamera.project(b.reduce((p,v)=>p.map((n,i)=>n+v[i]/4),[0,0,0]),pose).depth-ClubCamera.project(a.reduce((p,v)=>p.map((n,i)=>n+v[i]/4),[0,0,0]),pose).depth);
 for(const face of faces)worldQuad(c,pose,face,"#121c32",color+"66");
 worldQuad(c,pose,[[x-w,h,z-d],[x+w,h,z-d],[x+w,h,z+d],[x-w,h,z+d]],"#23283e",color+"99");
 worldLine(c,pose,[[x-w,h+1,z-d],[x+w,h+1,z-d],[x+w,h+1,z+d],[x-w,h+1,z+d],[x-w,h+1,z-d]],color,2,8);
 for(const y of [base+(h-base)*.3,base+(h-base)*.62])worldLine(c,pose,[[x-w,y,z+d+1],[x+w,y,z+d+1]],color+"55",1);
}
function centerStageOutline(y,inset=0){
 const {x,z,width,depth,bevel}=CENTER_STAGE,w=width/2-inset,d=depth/2-inset,b=bevel;
 return [[-w+b,-d],[w-b,-d],[w,-d+b],[w,d-b],[w-b,d],[-w+b,d],[-w,d-b],[-w,-d+b]].map(([dx,dz])=>[x+dx,y,z+dz]);
}
function centerDanceStage(c,pose,t){
 const {height:h}=CENTER_STAGE,{pulse}=rhythm(t),[pink,cyan]=palette,top=centerStageOutline(h),bottom=centerStageOutline(0);
 const faces=top.map((a,i)=>{const j=(i+1)%top.length,points=[bottom[i],bottom[j],top[j],a];return {points,index:i,depth:ClubCamera.project(points.reduce((sum,v)=>sum.map((n,k)=>n+v[k]/4),[0,0,0]),pose).depth};});
 faces.sort((a,b)=>b.depth-a.depth);
 for(const face of faces){
  const {points,index}=face,color=index%2?pink:cyan;
  worldQuad(c,pose,points,index%2?"#131a32":"#17233a",color+"50");
  const a=bottom[index],b=bottom[(index+1)%bottom.length];
  worldLine(c,pose,[[a[0],25,a[2]],[b[0],25,b[2]]],color+"80",2,5);
  for(let j=0;j<7;j++){
   const start=(j+.18)/7,end=(j+.73)/7,y=42+(j%3)*9+pulse*12;
   const point=(f,y)=>[a[0]+(b[0]-a[0])*f,y,a[2]+(b[2]-a[2])*f];
   worldQuad(c,pose,[point(start,40),point(end,40),point(end,y+18),point(start,y+18)],color+"70");
  }
 }
 worldQuad(c,pose,top,"#121b30",cyan+"b0");
 const edge=centerStageOutline(h+1),inner=centerStageOutline(h+2,18);
 worldLine(c,pose,[...edge,edge[0]],cyan,3,9);
 worldLine(c,pose,[...inner,inner[0]],pink+"80",1.6,4);
 for(const [index,slot] of CENTER_STAGE_SLOTS.entries()){
  const ring=[],inlay=[];
  for(let j=0;j<32;j++){const a=j*Math.PI/16;ring.push([slot.x+Math.cos(a)*72,slot.y,slot.z+Math.sin(a)*72]);inlay.push([slot.x+Math.cos(a)*63,slot.y-.3,slot.z+Math.sin(a)*63]);}
  const color=index%2?pink:cyan;
  worldQuad(c,pose,inlay,color+"12");worldLine(c,pose,[...ring,ring[0]],color+"a0",2,4);
  const p=ClubCamera.project([slot.x,slot.y+2,slot.z],pose);
  c.save();c.textAlign="center";c.textBaseline="middle";c.font=`700 ${Math.max(8,22*p.scale)}px Segoe UI`;c.fillStyle=color+"c0";c.fillText(String(index+1).padStart(2,"0"),p.x,p.y);c.restore();
 }
}
function djGesture(t){const beat=rhythm(t).beats*Math.PI*2;return {left:[-116+Math.sin(beat)*14,-102+Math.cos(beat)*3],right:[17+Math.sin(beat*.5)*12,-102+Math.sin(beat)*4]};}
function residentDJ(c,pose,t){
 const p=ClubCamera.project([0,283,-455],pose),{beats}=rhythm(t),beat=beats*Math.PI*2;
 c.save();c.translate(p.x,p.y);c.scale(p.scale,p.scale);c.lineCap="round";c.lineJoin="round";
 // A taller, tailored silhouette behind the equipment, with articulated DJ gestures.
 line(c,[[-15,-88],[-20,-38],[-24,0]],"#101725",18);line(c,[[15,-88],[20,-38],[25,0]],"#101725",18);
 rect(c,-36,-172,72,94,"#182235",12);
 poly(c,[[-16,-175],[0,-158],[17,-175],[22,-86],[-20,-86]],"#f0f6fb","#b6c3d0");
 poly(c,[[-35,-166],[-16,-176],[-5,-150],[-18,-138],[-10,-87],[-36,-83]],"#202c45","#52617b");
 poly(c,[[35,-166],[16,-176],[5,-150],[18,-138],[10,-87],[36,-83]],"#202c45","#52617b");
 poly(c,[[0,-156],[-6,-148],[-3,-115],[3,-108],[7,-146]],palette[1]);
 ellipse(c,7,-116,1.7,1.7,"#b6c6df");line(c,[[19,-152],[29,-150]],"#f6d9f4",2);
 const {left,right}=djGesture(t);
 function arm(points){line(c,points,"#91a1b9",17);line(c,points,"#1b2840",14);}
 arm([[-31,-161],[-57,-134],[left[0]+9,left[1]-1]]);arm([[31,-161],[46,-139],[right[0]+7,right[1]-1]]);
 for(const hand of [left,right]){ellipse(c,hand[0],hand[1],8,5,"#f5e2d4");line(c,[[hand[0]-5,hand[1]+1],[hand[0]+3,hand[1]+2]],"#a17f75",1);}
 c.save();c.translate(Math.sin(beat*.5)*3,-Math.abs(Math.sin(beat))*3);c.rotate(Math.sin(beat*.5)*.035);
 if(memeHeads.complete&&memeHeads.naturalWidth){c.drawImage(memeHeads,0,0,memeHeads.naturalWidth/2,memeHeads.naturalHeight/2,-43,-256,86,86);}
 // Over-ear headphones frame the familiar meme face.
 c.beginPath();c.ellipse(0,-215,35,32,0,Math.PI,Math.PI*2);c.strokeStyle="#b9cee6";c.lineWidth=5;c.stroke();
 rect(c,-38,-224,9,25,"#111d31",4);rect(c,29,-224,9,25,"#111d31",4);
 line(c,[[-36,-220],[-36,-204]],palette[0],2,3);line(c,[[36,-220],[36,-204]],palette[1],2,3);
 c.restore();c.restore();
}
function djHands(c,pose,t){
 const p=ClubCamera.project([0,283,-455],pose),{left,right}=djGesture(t);
 c.save();c.translate(p.x,p.y);c.scale(p.scale,p.scale);
 for(const hand of [left,right]){rect(c,hand[0]-7,hand[1]-7,14,5,"#e6effa",2);ellipse(c,hand[0],hand[1],8,5,"#f5e2d4");line(c,[[hand[0]-5,hand[1]+1],[hand[0]+3,hand[1]+2]],"#a17f75",1);}
 c.restore();
}
function djConsole(c,pose,t){
 const {beats,pulse}=rhythm(t),[pink,cyan]=palette;
 raisedStage(c,pose,0,-398,190,70,381,cyan,280);
 // Two spinning turntables, separate decks and a central mixer on the actual 3D tabletop.
 for(const side of [-1,1]){
  const x=side*112,z=-398;
  worldQuad(c,pose,[[x-64,383,z-54],[x+64,383,z-54],[x+64,383,z+54],[x-64,383,z+54]],"#0b1322",pink+"77");
  for(const [radius,color] of [[45,"#a5bdd3"],[39,"#111b2d"],[29,"#374760"],[12,side<0?pink:cyan]]){
   const pts=[];for(let j=0;j<28;j++){const a=j*Math.PI/14;pts.push([x+Math.cos(a)*radius,385,z+Math.sin(a)*radius]);}worldQuad(c,pose,pts,color);
  }
  const a=side<0?Math.sin(beats*Math.PI*2)*1.5:t*3;
  worldLine(c,pose,[[x,387,z],[x+Math.cos(a)*35,387,z+Math.sin(a)*35]],"#f0f7ff",1.4);
  worldLine(c,pose,[[x+50,389,z-38],[x+31,389,z-23],[x+25,389,z+4]],"#bbd5e9",1.6);
  for(let j=0;j<4;j++)worldQuad(c,pose,[[x-55+j*16,385,z+40],[x-45+j*16,385,z+40],[x-45+j*16,385,z+48],[x-55+j*16,385,z+48]],j%2?pink:cyan);
 }
 worldQuad(c,pose,[[-44,384,-458],[44,384,-458],[44,384,-340],[-44,384,-340]],"#060b16","#566c8a");
 for(let i=0;i<4;i++){
  const x=-30+i*20,p=ClubCamera.project([x,388,-440],pose);ellipse(c,p.x,p.y,2.2*p.scale,2.2*p.scale,i%2?cyan:pink);
  worldLine(c,pose,[[x,387,-424],[x,387,-362]],"#607994",1);
  const z=-385+Math.sin(t*2+i)*13;worldQuad(c,pose,[[x-5,389,z-4],[x+5,389,z-4],[x+5,389,z+4],[x-5,389,z+4]],"#e4edff");
 }
 const logo=ClubCamera.project([-125,335,-326],pose);c.save();c.textAlign="center";c.fillStyle=cyan;c.shadowColor=cyan;c.shadowBlur=8;c.font=`800 ${Math.max(10,21*logo.scale)}px Segoe UI`;c.fillText("NEON / DJ",logo.x,logo.y);c.restore();
 for(let i=0;i<14;i++){const x=-160+i*24,h=6+Math.sin(beats*2+i)*3+pulse*20;worldLine(c,pose,[[x,290,-326],[x,290+h,-326]],i%2?pink:cyan,2);}
}
function stageDanceMotion(t,side){
 const {beats}=rhythm(t),progress=beats*2+(side>0?4:0),phase=beats*Math.PI*2+(side>0?Math.PI:0),energy=Math.min(1.5,state.settings.energy||1);
 return {frame:Math.floor(progress)%8,blend:smooth(Math.max(0,(progress%1-.78)/.22)),hip:Math.sin(phase*.5)*9*energy,pop:Math.max(0,Math.sin(phase))**3,bob:Math.abs(Math.sin(phase))*2};
}
function stageRollFrame(c,atlas,index,w,h,motion){
 const sw=atlas.naturalWidth/4,sh=atlas.naturalHeight/4,sx=index%4*sw,sy=Math.floor(index/4)*sh;
 // Flex the waist while the head and boot baseline stay in place.
 for(let band=0;band<28;band++){
  const v=band/28,middle=(band+.5)/28,weight=Math.exp(-(((middle-.56)/.16)**2)),stretch=1+motion.pop*.045*weight;
  const sourceH=Math.min(sh-v*sh,sh/28+.3),offset=motion.hip*weight;
  c.drawImage(atlas,sx,sy+v*sh,sw,sourceH,-w*stretch/2+offset,-h*.97+v*h,w*stretch,sourceH*h/sh+.15);
 }
}
function stagePerformer(c,pose,t,side){
 const p=ClubCamera.project(stageDancerPoint(side),pose),{beats}=rhythm(t),light=side<0?palette[0]:palette[1];
 c.save();c.globalCompositeOperation="screen";glow(c,p.x,p.y-60*p.scale,90*p.scale,light+"25");c.restore();
 if(stageDancersRoll.complete&&stageDancersRoll.naturalWidth){
  const motion=stageDanceMotion(t,side),h=310*p.scale,w=h*stageDancersRoll.naturalWidth/stageDancersRoll.naturalHeight,start=side<0?0:8;
  c.save();c.translate(p.x,p.y-motion.bob*p.scale);c.scale(p.scale,p.scale);
  c.globalAlpha=1-motion.blend;stageRollFrame(c,stageDancersRoll,start+motion.frame,w/p.scale,h/p.scale,motion);
  if(motion.blend){c.globalAlpha=motion.blend;stageRollFrame(c,stageDancersRoll,start+(motion.frame+1)%8,w/p.scale,h/p.scale,motion);}
  c.restore();return;
 }
 if(!stageDancers.complete||!stageDancers.naturalWidth)return;
 const sw=stageDancers.naturalWidth/2,sh=stageDancers.naturalHeight/4,h=310*p.scale,w=h*sw/sh,progress=beats*1.4+(side>0?.4:0),frame=Math.floor(progress)%4,blend=Math.max(0,(progress%1-.65)/.35);
 c.save();c.translate(p.x,p.y-Math.abs(Math.sin(beats*Math.PI*2))*4*p.scale);c.rotate(Math.sin(beats*Math.PI+side)*.025);
 c.globalAlpha=1-blend;c.drawImage(stageDancers,side<0?0:sw,frame*sh,sw,sh,-w/2,-h*.985,w,h);
 if(blend>0){c.globalAlpha=blend;c.drawImage(stageDancers,side<0?0:sw,((frame+1)%4)*sh,sw,sh,-w/2,-h*.985,w,h);}c.restore();
}
function topCrest(c,x,y,scale,rank,t,coins){
 const color=["#ffd46a","#c5eeff","#f5b28b"][rank],deep=["#9b5a18","#526d91","#99523f"][rank];
 c.save();c.translate(x,y);c.scale(scale,scale);c.lineJoin="round";c.textAlign="center";
 // Metallic laurel leaves and a crown frame a large, readable rank shield.
 for(const side of [-1,1])for(let i=0;i<5;i++){
  c.save();c.translate(side*(65+i*3),19-i*12);c.rotate(side*(-.6+i*.12));ellipse(c,0,0,5,11,color);c.restore();
 }
 const metal=c.createLinearGradient(-65,-35,65,50);metal.addColorStop(0,"#fff8de");metal.addColorStop(.28,color);metal.addColorStop(.62,deep);metal.addColorStop(1,color);
 c.shadowColor=color;c.shadowBlur=12;
 poly(c,[[-62,-31],[62,-31],[66,12],[45,32],[0,44],[-45,32],[-66,12]],metal,color);c.shadowBlur=0;
 poly(c,[[-56,-25],[56,-25],[59,9],[40,26],[0,37],[-40,26],[-59,9]],"#101725",color+"99");
 poly(c,[[-33,-35],[-40,-58],[-19,-48],[0,-69],[19,-48],[40,-58],[33,-35]],metal,"#fff3d5");
 for(const [cx,cy] of [[-40,-58],[0,-69],[40,-58]])ellipse(c,cx,cy,3.5,3.5,"#fff5dd");
 line(c,[[-29,-40],[29,-40]],"#fff5db",2);
 c.font="900 34px 'Segoe UI',sans-serif";c.fillStyle="#fff7e8";c.fillText("TOP "+(rank+1),0,10);
 rect(c,-62,43,124,25,"#0b1020",8);c.strokeStyle=color+"99";c.lineWidth=1.2;c.stroke();
 c.font="700 15px 'Segoe UI',sans-serif";c.fillStyle=color;const amount=coins.toLocaleString("vi-VN")+" xu";
 c.fillText(amount,0,60,112);
 for(let i=0;i<3;i++)wingStar(c,-53+i*53,-29+(i%2)*8,3.2,color,.3+.6*Math.sin(t*2+i*2+rank)**2);
 c.restore();
}
function drawPodium(c,pose,t,rank,winner){
 const {x,y:h,z}=PODIUMS[rank],w=70,d=46;
 const color=["#ffd46a","#b6e9ff","#efa77c"][rank],base=["#483320","#203b52","#452e30"][rank];
 const faces=[
  [[x-w,0,z+d],[x+w,0,z+d],[x+w,h,z+d],[x-w,h,z+d]],
  [[x-w,0,z-d],[x+w,0,z-d],[x+w,h,z-d],[x-w,h,z-d]],
  [[x-w,0,z-d],[x-w,0,z+d],[x-w,h,z+d],[x-w,h,z-d]],
  [[x+w,0,z-d],[x+w,0,z+d],[x+w,h,z+d],[x+w,h,z-d]]
 ];
 faces.sort((a,b)=>ClubCamera.project(a.reduce((p,v)=>p.map((n,i)=>n+v[i]/4),[0,0,0]),pose).depth-ClubCamera.project(b.reduce((p,v)=>p.map((n,i)=>n+v[i]/4),[0,0,0]),pose).depth).reverse();
 for(const face of faces)worldQuad(c,pose,face,base,color+"66");
 worldQuad(c,pose,[[x-w,h,z-d],[x+w,h,z-d],[x+w,h,z+d],[x-w,h,z+d]],rank===0?"#7b592d":"#34445c",color);
 worldLine(c,pose,[[x-w,h+1,z-d],[x+w,h+1,z-d],[x+w,h+1,z+d],[x-w,h+1,z+d],[x-w,h+1,z-d]],color,2,7);
 const label=ClubCamera.project([x,h*.47,z+d+2],pose),foot=ClubCamera.project([x,h+3,z],pose);
 c.save();c.textAlign="center";c.fillStyle=color;c.shadowColor=color;c.shadowBlur=6;
 c.font=`900 ${Math.max(15,34*label.scale)}px Segoe UI`;c.fillText(String(rank+1),label.x,label.y);
 c.shadowBlur=0;c.font=`600 ${Math.max(8,12*label.scale)}px Segoe UI`;
 if(!winner)c.fillText("CHỜ TOP "+(rank+1),label.x,label.y+Math.max(13,16*label.scale));
 c.restore();
 if(!winner)return;
 const entry=entryPose(winner,now()),s=foot.scale*.95;
 const spotlight=state.focus?.mode==="wing"&&state.focus.id===winner.id&&state.focus.until>now();
 if(winner.onFloor!==false&&!spotlight&&!swordFlying(winner,now()))withViewerFocus(c,winner,g=>{
  g.save();g.translate(foot.x,foot.y+entry.y);g.scale(entry.sx,entry.sy);
  dancer(g,0,0,s,winner,t,false,entry.falling);g.restore();
 },{x:foot.x-210*s-14,y:foot.y+entry.y-235*s-14,width:420*s+28,height:300*s+28});
 if(!swordFlying(winner,now())&&state.focus?.mode==="floor"&&state.focus.id===winner.id&&state.focus.until>now()){c.save();c.strokeStyle="#ff98c7";c.lineWidth=3;c.shadowBlur=14;c.shadowColor="#ff70b5";c.beginPath();c.ellipse(foot.x,foot.y,42*foot.scale,12*foot.scale,0,0,Math.PI*2);c.stroke();c.restore();}
 const tag=ClubCamera.project([x,h+355,z],pose);
 topCrest(c,tag.x,tag.y,tag.scale,rank,t,winner.coins);
}
function drawSwordBlade(c,sword,t){
 const {tier,color,accent,blade}=sword,width=7+tier*2;
 glow(c,20,0,85+tier*22,color+(tier===3?"70":"40"));
 const metal=c.createLinearGradient(0,-width,0,width);metal.addColorStop(0,"#ffffff");metal.addColorStop(.38,accent);metal.addColorStop(.5,"#ffffff");metal.addColorStop(1,color);
 const outline=tier===1?[[-63,-width],[blade-30,-width],[blade,0],[blade-30,width],[-63,width]]:[[-63,-width],[blade-48,-width],[blade-34,-width-5],[blade,0],[blade-34,width+5],[blade-48,width],[-63,width]];
 poly(c,outline,metal,accent);line(c,[[-60,0],[blade-9,0]],"#ffffff",1.7,8);
 if(tier>=2){
  for(const side of [-1,1]){
   poly(c,[[-72,side*8],[-49,side*28],[-12,side*19],[-40,side*15],[-56,side*4]],tier===3?"#f8c85f":"#8060c8",accent);
   line(c,[[-50,side*24],[blade*.55,side*(width+8)],[blade-20,side*4]],color+"b0",1.5,5);
  }
 }
 const gold=tier===3?"#ffdf8c":tier===2?"#ba9bff":"#a4c9de";
 poly(c,[[-74,-15-tier*4],[-64,-11],[-57,0],[-64,11],[-74,15+tier*4],[-84,6],[-84,-6]],gold,accent);
 rect(c,-115,-5,31,10,tier===3?"#5a3518":"#35334e",3);for(let i=0;i<4;i++)line(c,[[-109+i*7,-5],[-113+i*7,5]],gold,1.6);
 ellipse(c,-120,0,5+tier,5+tier,color);wingStar(c,-120,0,3+tier,accent,.65+.35*Math.sin(t*7)**2);
 for(let i=0;i<2+tier;i++){const x=-40+i*(blade+20)/(tier+3);poly(c,[[x,-3],[x+5,0],[x,3],[x-4,0]],tier===3?"#ffdf8a":"#f1eaff");}
 if(tier===3){
  for(const side of [-1,1])poly(c,[[-87,side*6],[-102,side*18],[-88,side*29],[-62,side*31],[-44,side*21],[-69,side*22]],"#e4ac43","#fff0b0");
  ellipse(c,-71,0,7,7,"#67efff");glow(c,-71,0,18,"#8cffff99");
 }
}
function drawSwordFigure(c,pose,u,world,t,sword,facing,bank,ghost=false){
 const p=ClubCamera.project([world.x,world.y,world.z],pose);
 c.save();c.translate(p.x,p.y);c.rotate(bank);c.scale(p.scale*.95,p.scale*.95);
 c.save();c.scale(facing,1);drawSwordBlade(c,sword,t);c.restore();
 dancer(c,0,-8,1.05,{...u,riding:true,ghost},t,ghost,true);c.restore();
}
function drawSwordRider(c,pose,u,world,t){
 const time=t*1000,ride=world.ride||SwordCatalog.rideAt(u.swordFlight,time),sword=SwordCatalog.definition(ride.coins),color=sword.color;
 const p=ClubCamera.project([world.x,world.y,world.z],pose),future=swordPosition(u,world.base,Math.min(time+60,ride.until-1)),q=ClubCamera.project([future.x,future.y,future.z],pose);
 const speed=Math.hypot(q.x-p.x,q.y-p.y),facing=q.x>=p.x?1:-1,bank=Math.max(-.22,Math.min(.22,(q.y-p.y)*.035));
 c.save();c.globalCompositeOperation="screen";
 const segments=Math.ceil(sword.trailMs/48);
 for(let j=segments;j>0;j--){
  const age=j*48;if(time-age<ride.startedAt)continue;
  const a=swordPosition(u,world.base,time-age),b=swordPosition(u,world.base,time-age+48),fade=Math.pow(1-j/(segments+1),.8)*world.blend;
  const alpha=Math.round(fade*190).toString(16).padStart(2,"0");
  worldLine(c,pose,[[a.x,a.y-5,a.z],[b.x,b.y-5,b.z]],color+alpha,1+fade*(3+sword.tier),3+sword.tier);
  if(sword.tier>1){const wiggle=Math.sin(j*.43+t*7)*13;worldLine(c,pose,[[a.x+wiggle,a.y+8,a.z],[b.x+wiggle,b.y+8,b.z]],sword.accent+alpha,1+fade*2,3);}
  if(j%2===0){
   const sparkle=Math.sin(j*2.7+t*9),star=ClubCamera.project([a.x+Math.cos(j*4+t)*22,a.y+sparkle*24,a.z],pose);
   wingStar(c,star.x,star.y,(2+fade*(4+sword.tier))*star.scale,sword.accent,fade*(.35+.65*Math.abs(sparkle)));
  }
 }
 if(speed>2)for(let i=sword.ghosts;i>=1;i--){
  const ghostTime=time-i*100;if(ghostTime<ride.startedAt)continue;
  const ghost=swordPosition(u,world.base,ghostTime);c.save();c.globalAlpha*=Math.max(.035,.19-i*.025)*world.blend;
  drawSwordFigure(c,pose,u,ghost,ghostTime/1000,sword,facing,bank,true);c.restore();
 }
 c.restore();
 const shadow=ClubCamera.project([world.x,0,world.z],pose);c.save();c.globalAlpha*=.22;ellipse(c,shadow.x,shadow.y,57*shadow.scale,12*shadow.scale,color);c.restore();
 drawSwordFigure(c,pose,u,world,t,sword,facing,bank);
}
function showLights(t){
 const phase=(rhythm(t).beats/16)%4,step=Math.floor(phase),p=phase%1,blend=p*p*(3-2*p);
 const colors=[palette[0],palette[1],palette[2],"#ffe3a5"];
 const mix=(a,b)=>"#"+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-blend)+parseInt(b.slice(i,i+2),16)*blend).toString(16).padStart(2,"0")).join("");
 return [0,1,2].map(i=>mix(colors[(step+i)%4],colors[(step+i+1)%4]));
}
function roomWalls(){
 const {left:l,right:r,back:b,front:f}=ROOM;
 return [
  {id:0,a:[l,b],b:[r,b],normal:[0,1]},
  {id:1,a:[r,b],b:[r,f],normal:[-1,0]},
  {id:2,a:[r,f],b:[l,f],normal:[0,-1]},
  {id:3,a:[l,f],b:[l,b],normal:[1,0]}
 ];
}
function visibleRoomWalls(pose){
 const eye=[(pose.targetX||0)+Math.sin(pose.yaw)*pose.distance,(pose.targetZ??450)+Math.cos(pose.yaw)*pose.distance];
 return roomWalls().filter(w=>(eye[0]-(w.a[0]+w.b[0])/2)*w.normal[0]+(eye[1]-(w.a[1]+w.b[1])/2)*w.normal[1]>0);
}
function ledRoomWalls(c,pose,t,party){
 const colors=showLights(t),{beats,pulse}=rhythm(t),walls=visibleRoomWalls(pose);
 walls.sort((a,b)=>ClubCamera.project([(b.a[0]+b.b[0])/2,ROOM.height/2,(b.a[1]+b.b[1])/2],pose).depth-ClubCamera.project([(a.a[0]+a.b[0])/2,ROOM.height/2,(a.a[1]+a.b[1])/2],pose).depth);
 for(const wall of walls){
  const point=(u,y)=>[wall.a[0]+(wall.b[0]-wall.a[0])*u,y,wall.a[1]+(wall.b[1]-wall.a[1])*u];
  worldQuad(c,pose,[point(0,0),point(1,0),point(1,ROOM.height),point(0,ROOM.height)],"#070d1c");
  const clear=clearBroadcast(),columns=wall.id%2?(clear?20:28):(clear?18:24),rows=clear?10:14,stepY=(ROOM.height-140)/rows;
  for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
   const wave=(Math.sin(col*.54+row*.38-beats*.5+wall.id)*.5+.5),bars=3+(Math.sin(col*.5+beats*.85+wall.id)*.5+.5)*10;
   const active=row<bars,alpha=(active?.12+wave*.24+pulse*.05:.025+wave*.035)*(party?1.3:1);
   const color=colors[(Math.floor(col/4)+Math.floor(row/5)+wall.id)%3]+Math.round(Math.min(.7,alpha)*255).toString(16).padStart(2,"0"),u=(col+.1)/columns,v=(col+.86)/columns,y=75+row*stepY;
   worldQuad(c,pose,[point(u,y),point(v,y),point(v,y+stepY*.78),point(u,y+stepY*.78)],color);
  }
  for(const u of [0,.25,.5,.75,1])worldLine(c,pose,[point(u,25),point(u,ROOM.height)],colors[(wall.id+1)%3]+"40",2,5);
  worldLine(c,pose,[point(0,25),point(1,25)],colors[wall.id%3]+"88",2,7);
  worldLine(c,pose,[point(0,ROOM.height),point(1,ROOM.height)],colors[(wall.id+2)%3]+"70",2,6);
 }
}
function discoReflections(c,pose,t,party){
 const colors=showLights(t),{pulse}=rhythm(t);c.save();c.globalCompositeOperation="screen";
 for(let i=0;i<14;i++){
  const a=t*.3+i*Math.PI*2/14,point=[Math.sin(a)*(650+i%3*90),3,900+Math.cos(a)*(660+i%2*100)],p=ClubCamera.project(point,pose);
  if(p.depth>100){glow(c,p.x,p.y,(32+pulse*17)*p.scale,colors[i%3]+"80");ellipse(c,p.x,p.y,24*p.scale,9*p.scale,colors[i%3]+(party?"c0":"90"));wingStar(c,p.x,p.y,(5+pulse*5)*p.scale,"#edffff",.65);}
 }
 const walls=visibleRoomWalls(pose);
 const glitterCount=clearBroadcast()?10:20;
 for(const wall of walls)for(let i=0;i<glitterCount;i++){
  const u=(i/glitterCount+t*.045)%1,y=120+(i*197+t*80)%1550,point=[wall.a[0]+(wall.b[0]-wall.a[0])*u,y,wall.a[1]+(wall.b[1]-wall.a[1])*u],p=ClubCamera.project(point,pose);
  if(p.depth<100||p.x< -50||p.x>770||p.y< -50||p.y>1330)continue;
  const shine=Math.max(0,Math.sin(i*2.4+t*3+wall.id))**5;
  wingStar(c,p.x,p.y,(3+shine*9)*p.scale,colors[(i+wall.id)%3],.15+shine*.8);
 }
 c.restore();
}
function drawDiscoBall(c,pose,t){
 const p=ClubCamera.project(DISCO_BALL,pose),r=Math.max(24,DISCO_RADIUS*p.scale),colors=showLights(t),{pulse}=rhythm(t);
 worldLine(c,pose,[[DISCO_BALL[0],2650,DISCO_BALL[2]],[DISCO_BALL[0],DISCO_BALL[1]+DISCO_RADIUS+8,DISCO_BALL[2]]],"#8babc0",1.2);
 c.save();c.globalCompositeOperation="screen";
 glow(c,p.x,p.y,r*(2.8+pulse*.3),colors[1]+"65");glow(c,p.x,p.y,r*1.5,"#c5ffff88");
 for(let i=0;i<8;i++){const a=i*Math.PI/4+t*.18,d=r*1.2;glow(c,p.x+Math.cos(a)*d,p.y+Math.sin(a)*d,r*.3,colors[i%3]+"38");}
 c.restore();
 const g=c.createRadialGradient(p.x-r*.3,p.y-r*.3,1,p.x,p.y,r);g.addColorStop(0,"#ffffff");g.addColorStop(.45,"#a1d9f4");g.addColorStop(.8,"#557da5");g.addColorStop(1,"#15253f");ellipse(c,p.x,p.y,r,r,g);
 c.save();c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.clip();
 for(let row=-8;row<=8;row++)for(let col=0;col<28;col++){
  const a=col*Math.PI/14+t*.65,latitude=row*.17;if(Math.cos(a)<0)continue;
  const tw=Math.max(.7,r*.20*Math.cos(latitude)*Math.cos(a)),th=Math.max(.8,r*.17*Math.cos(latitude)),shine=Math.sin(t*3+col*.7+row*.8)*.5+.5;
  rect(c,p.x+Math.sin(a)*r*Math.cos(latitude),p.y+Math.sin(latitude)*r-th*.5,tw*.88,th*.88,(row+col)%2?colors[(col+row+30)%3]+Math.round((.3+shine*.55)*255).toString(16).padStart(2,"0"):"#f0ffff");
 }c.restore();
 c.save();c.globalCompositeOperation="screen";
 wingStar(c,p.x-r*.3,p.y-r*.4,8+pulse*7,"#ffffff",1);
 for(let i=0;i<3;i++){const a=t*.8+i*2.1;wingStar(c,p.x+Math.sin(a)*r*.78,p.y+Math.cos(a*.8)*r*.6,3+Math.max(0,Math.sin(t*5+i))*5,colors[i],.8);}
 c.restore();
}
function concertAtmosphere(c,pose,t,party,foreground=false){
 const colors=showLights(t),{pulse}=rhythm(t);c.save();c.globalCompositeOperation="screen";if(foreground)c.globalAlpha*=.16;
 // Broad moving spotlights have visible cones, lit haze and elliptical floor pools.
 for(let i=0;i<14;i++){
  if(foreground&&i%3)continue;
  const a=i*Math.PI*2/14,source=[Math.sin(a)*950,2800,700+Math.cos(a)*900];
  const aim=[Math.sin(t*.48+i*1.8)*760,2,950+Math.cos(t*.37+i)*850],top=ClubCamera.project(source,pose),base=ClubCamera.project(aim,pose);
  const color=i%7===0?"#effbff":colors[i%3],radius=100+(Math.sin(t*.7+i)*.5+.5)*90;
  const rim=[];let left,right,minX=Infinity,maxX=-Infinity;
  for(let j=0;j<24;j++){const b=j*Math.PI/12,point=[aim[0]+Math.cos(b)*radius,2,aim[2]+Math.sin(b)*radius],p=ClubCamera.project(point,pose);rim.push(point);if(p.x<minX){minX=p.x;left=point;}if(p.x>maxX){maxX=p.x;right=point;}}
  const beam=c.createLinearGradient(top.x,top.y,base.x,base.y);beam.addColorStop(0,color+(party?"a0":"65"));beam.addColorStop(.24,color+"3d");beam.addColorStop(1,color+"05");
  const dx=Math.cos(pose.yaw)*14,dz=-Math.sin(pose.yaw)*14;
  worldQuad(c,pose,[[source[0]-dx,source[1],source[2]-dz],[source[0]+dx,source[1],source[2]+dz],right,left],beam);
  if(base.depth>100){const pool=c.createRadialGradient(base.x,base.y,0,base.x,base.y,Math.max(15,radius*base.scale));pool.addColorStop(0,color+"75");pool.addColorStop(1,color+"00");worldQuad(c,pose,rim,pool);}
 }
 // Scattered shafts and glitter from the mirror ball make the volume feel occupied.
 for(let i=0;i<(foreground?0:clearBroadcast()?16:45);i++){
  const p=ClubCamera.project([Math.sin(i*3.17+t*.06)*900,40+(i*47+t*14)%700,900+Math.cos(i*2.13+t*.05)*900],pose);
  const shine=.1+Math.max(0,Math.sin(t*2+i))**6*.5;ellipse(c,p.x,p.y,Math.max(.6,p.scale*1.3),Math.max(.6,p.scale*1.3),"#e8f9ff"+Math.round(shine*255).toString(16).padStart(2,"0"));
 }
 c.restore();
}
function floorHaze(c,pose,t){
 const colors=showLights(t);c.save();c.globalCompositeOperation="screen";
 for(let i=0;i<8;i++){
  const p=ClubCamera.project([Math.sin(t*.12+i*1.7)*750,10,350+(i%4)*400+Math.cos(t*.18+i)*80],pose);
  c.save();c.translate(p.x,p.y);c.scale(2.7,.33);glow(c,0,0,Math.max(30,105*p.scale),colors[i%3]+"14");c.restore();
 }
 c.restore();
}
function ledEnvironment(c,pose,t){
 const colors=showLights(t),{beats,pulse}=rhythm(t);c.save();
 for(const side of [-1,1]){
  const x=side*900,w=145,z=-790;
  worldQuad(c,pose,[[x-w,150,z],[x+w,150,z],[x+w,720,z],[x-w,720,z]],"#07101d",colors[1]+"88");
  for(let col=0;col<5;col++)for(let row=0;row<11;row++){
   const xx=x-w+9+col*57,yy=157+row*50;
   const wave=(Math.sin(beats*.7+col*.75-row*.4+side)*.5+.5),alpha=.14+wave*.62+pulse*.18;
   const color=colors[(col+Math.floor(row/4))%3]+Math.round(Math.min(.95,alpha)*255).toString(16).padStart(2,"0");
   worldQuad(c,pose,[[xx,yy,z+2],[xx+47,yy,z+2],[xx+47,yy+40,z+2],[xx,yy+40,z+2]],color);
  }
 }
 // A moving LED fascia runs above the stage, clipped to its projected surface.
 const quad=[[-940,650,-790],[940,650,-790],[940,715,-790],[-940,715,-790]].map(v=>ClubCamera.project(v,pose));
 poly(c,quad.map(p=>[p.x,p.y]),colors[0]+"45",colors[1]+"88");
 c.beginPath();quad.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();
 const text=`${state.settings.name}  ·  SÀN NHẢY LIVE  ·  HEY ĐỂ VÀO SÀN  ·  `;
 for(let i=0;i<4;i++){
  const x=-1600+(t*100%850)+i*850,p=ClubCamera.project([x,672,-785],pose),q=ClubCamera.project([x+100,672,-785],pose);
  c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(q.y-p.y,q.x-p.x));c.font=`800 ${Math.max(8,27*p.scale)}px Segoe UI`;c.fillStyle="#effaff";c.fillText(text,0,0);c.restore();
 }
 c.restore();
}
function drawWorldBackground(c,pose,t,party){
 const [pink,cyan,purple]=palette,{pulse,beats}=rhythm(t);
 const sky=c.createLinearGradient(0,0,0,1280);sky.addColorStop(0,"#050710");sky.addColorStop(.55,"#10152b");sky.addColorStop(1,"#050812");rect(c,0,0,720,1280,sky);
 glow(c,160,260,500,pink+"0d");glow(c,650,420,550,cyan+"0c");
 glow(c,360,780,480,purple+"22");
 // Floor continues beyond the camera, with no near edge or enclosing neon box.
 worldQuad(c,pose,[[-12000,0,-12000],[12000,0,-12000],[12000,0,12000],[-12000,0,12000]],"#09101e");
 for(let v=-4800;v<=4800;v+=160){
  const alpha=Math.round(42*(1-Math.abs(v)/6000)).toString(16).padStart(2,"0");
  worldLine(c,pose,[[v,0,-4800],[v,0,4800]],(v%320?cyan:pink)+alpha);
  worldLine(c,pose,[[-4800,0,v],[4800,0,v]],(v%320?pink:cyan)+alpha);
 }
 // Soft reflections of the stage LED columns stretch onto the polished dance floor.
 const show=showLights(t);c.save();c.globalCompositeOperation="screen";
 for(let i=0;i<20;i++)for(let j=0;j<5;j++){
  const x=-620+i*65,z=100+j*290,wave=(Math.sin(beats*1.5+i*.6)*.5+.5);
  const alpha=Math.round((.04+wave*.10)*(1-j*.16)*255).toString(16).padStart(2,"0");
  worldQuad(c,pose,[[x,1,z],[x+35,1,z],[x+35,1,z+140],[x,1,z+140]],show[i%3]+alpha);
 }c.restore();
 ledRoomWalls(c,pose,t,party);discoReflections(c,pose,t,party);
 // Spacious ceiling trusses extend outside the frame instead of outlining the room.
 for(let v=-3000;v<=3000;v+=600){
  worldLine(c,pose,[[v,2650,-3600],[v,2650,3600]],"#252b4338",5);
  worldLine(c,pose,[[-3600,2650,v],[3600,2650,v]],"#252b4338",5);
  worldLine(c,pose,[[-3600,2645,v+8],[3600,2645,v+8]],purple+"18",1);
 }
 c.save();c.globalCompositeOperation="screen";
 for(let ring=0;ring<3;ring++)for(let j=0;j<14;j++){
  const a=j*Math.PI/7+t*(ring%2?.65:-.5),radius=350+ring*180+pulse*8;
  const pts=[];for(let k=0;k<5;k++){const b=a+k*.065;pts.push([FLOOR_RING_CENTER[0]+Math.cos(b)*radius,2,FLOOR_RING_CENTER[1]+Math.sin(b)*radius]);}
  worldLine(c,pose,pts,(ring%2?pink:cyan)+(party?"b0":"60"),ring===1?12:9,3);
 }
 for(let i=0;i<12;i++){
  const p=ClubCamera.project([Math.sin(i*3.1+t*.25)*750,2,900+Math.cos(i*2.4+t*.3)*750],pose);
  glow(c,p.x,p.y,Math.max(20,75*p.scale),(i%2?pink:cyan)+"30");
 }
 c.restore();
 ledEnvironment(c,pose,t);concertAtmosphere(c,pose,t,party);
}
function drawWorldScene(c,pose,t,party,backgroundReady=false){
 if(!backgroundReady)drawWorldBackground(c,pose,t,party);
 const [pink,cyan,purple]=palette,{pulse,beats}=rhythm(t),show=showLights(t),objects=[];
 const add=(point,draw)=>objects.push({depth:ClubCamera.project(point,pose).depth,draw});
 const performer=(id,point,draw)=>{const p=ClubCamera.project(point,pose),s=p.scale;withViewerFocus(c,{id},draw,{x:p.x-200*s-14,y:p.y-350*s-14,width:400*s+28,height:390*s+28});};
 // The wide backdrop and platform form the stage background, below its performers.
 (()=>{
  c.save();const behind=Math.cos(pose.yaw)<-.2;
  worldQuad(c,pose,[[-620,160,-735],[620,160,-735],[620,620,-735],[-620,620,-735]],behind?"#07102318":"#071023ca");
  if(behind)c.globalAlpha*=.3;
  worldLine(c,pose,[[-625,160,-733],[-625,625,-733],[625,625,-733],[625,160,-733]],cyan,3,10);
  worldLine(c,pose,[[-220,220,-730],[0,580,-730],[220,220,-730],[-220,220,-730]],pink,3,12);
  for(let i=0;i<24;i++){
   const height=25+pulse*65+(Math.sin(beats*3+i*.6)*.5+.5)*110,x=-525+i*44;
   for(let y=175;y<175+height;y+=12)worldQuad(c,pose,[[x,y,-728],[x+27,y,-728],[x+27,y+7,-728],[x,y+7,-728]],show[i%3]+"b0");
  }
  const p=ClubCamera.project([0,605,-725],pose);c.save();c.translate(p.x,p.y);c.textAlign="center";c.font=`900 ${Math.max(12,35*p.scale)}px Segoe UI`;c.fillStyle="#e7ffff";c.shadowColor=cyan;c.shadowBlur=15;c.fillText("NR",0,0);c.restore();c.restore();
 })();
 // One elevated rear stage carries the resident dancer and both guest performers.
 // The three gift-ranking podiums remain separate, lower, and in front of this stage.
 raisedStage(c,pose,0,-520,840,200,280,cyan);
 add([0,330,-398],()=>{performer("__resident_dj__",[0,283,-455],g=>residentDJ(g,pose,t));djConsole(c,pose,t);performer("__resident_dj__",[0,283,-455],g=>djHands(g,pose,t));});
 for(const side of [-1,1])add(stageDancerPoint(side),()=>performer("__stage_dancer_"+side,stageDancerPoint(side),g=>stagePerformer(g,pose,t,side)));
 for(const side of [-1,1])add([side*900,140,-520],()=>{
  const p=ClubCamera.project([side*900,0,-520],pose),s=p.scale;
  rect(c,p.x-25*s,p.y-280*s,50*s,280*s,"#070b16",3*s);
  for(let i=0;i<4;i++){ellipse(c,p.x,p.y-(36+i*65)*s,20*s,20*s,"#2a2142");ellipse(c,p.x,p.y-(36+i*65)*s,15*s,15*s,"#090e1b");ellipse(c,p.x,p.y-(36+i*65)*s,6*s,6*s,purple+"55");}
 });
 for(let rank=0;rank<3;rank++)add([PODIUMS[rank].x,200,PODIUMS[rank].z],()=>drawPodium(c,pose,t,rank,state.top[rank]));
 add([CENTER_STAGE.x,CENTER_STAGE.height/2,CENTER_STAGE.z],()=>{
  centerDanceStage(c,pose,t);
  // Render the deck before all five people on it, including the back row's feet.
  if(state.dancers?.enabled!==false&&globalThis.Dancer3D?.ready){
   const dancers=DancerCatalog.formation(state.dancers,t*1000).sort((a,b)=>ClubCamera.project([b.x,b.y,b.z],pose).depth-ClubCamera.project([a.x,a.y,a.z],pose).depth);
   for(const dancer of dancers)withViewerFocus(c,{id:'__stage3d_'+dancer.id},g=>Dancer3D.draw(g,dancer.id),Dancer3D.bounds(dancer.id));
  }
 });
 add(DISCO_BALL,()=>drawDiscoBall(c,pose,t));
 return objects;
}
function render(ms){
 requestAnimationFrame(render);if(control&&document.hidden||ms-lastFrame<(control?65:32))return;const dt=Math.min(2.5,(ms-lastFrame)/33.33||1);lastFrame=ms;
 // Wall-clock rhythm keeps control preview and OBS on the same musical beat.
 const t=now()/1000,c=ctx,n=now(),party=state.effect?.type==="party"&&state.effect.until>n;
 const {pulse}=rhythm(t),energy=state.settings.energy||1.4;
 if(lastTheme!==state.settings.theme||lastCamera!==state.settings.camera){palette=themes[state.settings.theme]||themes.violet;lastTheme=state.settings.theme;lastCamera=state.settings.camera;buildBackground();}
 canvas.style.filter=party?`hue-rotate(${Math.sin(t*.8)*55}deg)`:"none";
 c.save();
 const users=state.users,positions=floorPositions(users,state.top,t);
 const cameraPose=roseCamera(dancerCamera(swordCamera(frameStageCamera(ClubCamera.view(state.settings,n)),state,n,positions),state,n),state,n,positions);
 globalThis.Dancer3D?.prepare(cameraPose,n,state.dancers||DancerCatalog.defaults(n),palette);
 const worldScale=clearBroadcast()?1:renderScale;
 if(worldBackground.width!==720*worldScale||worldBackground.height!==1280*worldScale){worldBackground.width=720*worldScale;worldBackground.height=1280*worldScale;worldBackgroundCtx.setTransform(worldScale,0,0,worldScale,0,0);}
 drawWorldBackground(worldBackgroundCtx,cameraPose,t,party||state.heatUntil>n);
 c.drawImage(worldBackground,0,0,worldBackground.width,worldBackground.height,0,0,720,1280);
 const stageObjects=drawWorldScene(c,cameraPose,t,party||state.heatUntil>n,true);
 if(state.dancers?.enabled!==false&&globalThis.Dancer3D?.ready)$("welcome").hidden=true;
 drawWingTrails(c,t);
 const size=positions.length<=14?1.01:positions.length<=56?.86:.68;
 const focused=state.focus?.mode==="wing"&&state.focus.until>n?[...users,...state.top].find(u=>u.id===state.focus.id):null;
 const flyingTop=state.top.flatMap((u,rank)=>u.onFloor!==false&&swordFlying(u,n)?[{u,base:PODIUMS[rank],...swordPosition(u,PODIUMS[rank],n)}]:[]);
 const crowd=[...positions,...flyingTop].map(world=>{
  const {u,x,y,z}=world,projected=ClubCamera.project([x,y,z],cameraPose);
  return {u,world,x:projected.x,y:projected.y,s:size*projected.scale,depth:projected.depth,entry:world.flight?{falling:false}:entryPose(u,n)};
 });
 const drawViewer=(c,{u,world,x,y,s,entry})=>{
  if(focused?.id===u.id)return;
  c.save();c.globalAlpha*=focused ? .6 : 1;
  if(world.flight){drawSwordRider(c,cameraPose,u,world,t);c.restore();return;}
  // Personal light pools and slight side steps make the floor feel occupied.
  c.save();c.globalCompositeOperation="screen";ellipse(c,x,y+2,19*s+5*pulse,5*s,(u.variant%2?palette[0]:palette[1])+"40");c.restore();
  if(memeHeads.complete&&memeHeads.naturalWidth&&!entry.falling){
   c.save();c.globalAlpha*=.075;c.translate(x,y+4);c.scale(s,-s*.32);
   const custom=customCharacter(u);if(custom)drawCustomCharacter(c,custom,u,0,0,0);
   else{const frame=[0,1,2,3,0][u.variant%5],sw=memeHeads.naturalWidth/2,sh=memeHeads.naturalHeight/2;rect(c,-14,-43,28,29,"#dde7ff",8);c.drawImage(memeHeads,(frame%2)*sw,Math.floor(frame/2)*sh,sw,sh,-55,-145,110,110);}c.restore();
  }
  if(state.focus?.mode==="floor"&&state.focus.id===u.id&&state.focus.until>n){c.save();c.strokeStyle="#ff92c7";c.shadowColor="#ff72c0";c.shadowBlur=12;c.lineWidth=2;c.beginPath();c.ellipse(x,y,38*s,11*s,0,0,Math.PI*2);c.stroke();c.restore();}
  if(entry.falling){
   ellipse(c,x,y+2,Math.max(5,25*s*(1+entry.y/1600)),4*s,"#0009");
   c.save();c.globalAlpha*=.25;c.strokeStyle=palette[1];c.lineWidth=1.5;
   for(const side of [-1,1])line(c,[[x+side*31*s,y+entry.y-60*s],[x+side*31*s,y+entry.y-145*s]],palette[1]+"80",1.5);
   c.restore();
  }
  if(entry.impact>0){
   c.save();c.globalCompositeOperation="screen";c.globalAlpha*=entry.impact;
   c.strokeStyle=palette[1];c.lineWidth=2.5;c.beginPath();c.ellipse(x,y+3,(30+(1-entry.impact)*80)*s,(9+(1-entry.impact)*20)*s,0,0,Math.PI*2);c.stroke();
   for(let j=0;j<8;j++){const a=j*Math.PI/4,d=(1-entry.impact)*75*s;ellipse(c,x+Math.cos(a)*d,y-7+Math.sin(a)*d*.25,2*s,2*s,palette[j%2]);}
   c.restore();
  }
  c.save();c.translate(x,y+entry.y);c.scale(entry.sx,entry.sy);
  dancer(c,Math.sin(t*2.2+u.seed)*3*energy,0,s,u,t,false,entry.falling);c.restore();c.restore();
 };
 const ordered=[...stageObjects,...crowd.map(v=>({depth:v.depth,focus:state.focus?.mode==="floor"&&state.focus.id===v.u.id&&state.focus.until>n,falling:v.entry.falling,draw:()=>withViewerFocus(c,v.u,g=>drawViewer(g,v),v.world.flight?undefined:{x:v.x-210*v.s-14,y:v.y+(v.entry.y||0)-235*v.s-14,width:420*v.s+28,height:300*v.s+28})}))].sort((a,b)=>Number(!!a.focus)-Number(!!b.focus)||Number(!!a.falling)-Number(!!b.falling)||b.depth-a.depth);
 ordered.forEach(object=>object.draw());
 if(state.dancers?.enabled!==false&&globalThis.Dancer3D?.ready)for(const dancer of DancerCatalog.formation(state.dancers,n))withViewerFocus(c,{id:'__stage3d_'+dancer.id},g=>Dancer3D.drawLabel(g,dancer.id),Dancer3D.bounds(dancer.id));
 concertAtmosphere(c,cameraPose,t,party,true);
 floorHaze(c,cameraPose,t);
 if(focused){
  const g=c.createRadialGradient(360,880,20,360,880,230);g.addColorStop(0,palette[1]+"27");g.addColorStop(1,"transparent");rect(c,100,660,520,420,g);
  c.save();c.strokeStyle=palette[1]+"88";c.shadowBlur=18;c.shadowColor=palette[1];c.lineWidth=2;c.beginPath();c.ellipse(360,1000,115,23,0,0,Math.PI*2);c.stroke();c.restore();
  dancer(c,360,990,2.15,focused,t,true);
 }
 $("focusLabel").hidden=!focused;$("focusLabel").textContent=focused?`${focused.vip?"♛":"✦"} ${focused.nickname}`:"";
 const unlock=state.wingUnlock?.until>n;
 $("wingUnlock").hidden=!unlock;
 if(unlock){const owner=users.find(u=>u.id===state.wingUnlock.userId);$("wingUnlockName").textContent=WingCatalog.definition(state.wingUnlock.tier).name.toLocaleUpperCase("vi-VN");$("wingUnlockUser").textContent=`${owner?.nickname||""} · ${Math.max(0,Math.ceil((state.wingUnlock.until-n)/1000))}s`;}
 particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.045*dt;p.life-=.009*dt;c.globalAlpha=Math.max(0,p.life);rect(c,p.x,p.y,p.size,p.size*2,p.hue);}c.globalAlpha=1;
 c.restore();
 canvas.dataset.focusMode=state.focus?.until>n?state.focus.mode||"":"";
 canvas.dataset.focusBlur=focusAmount(n).toFixed(2);canvas.dataset.swordRiders=crowd.filter(v=>v.world.flight).length;
 $("lastEvent").style.opacity=state.lastEvent?"1":".4";
}
let leaderboardSignature="";
function updateLeaderboards(top){
 const signature=JSON.stringify(top.slice(0,3).map(u=>[u.id,u.nickname,u.coins,u.demo]));if(signature===leaderboardSignature)return;leaderboardSignature=signature;
 for(const [id,live] of [["leaderboardList",false],["liveLeaderboardList",true]]){
  const list=$(id);list.replaceChildren();
  if(!top.length){const li=document.createElement("li");li.className="empty-top";li.textContent=live?"Chưa có người tặng quà":"Tặng quà để lên ngôi đêm nay";list.append(li);}
  top.slice(0,3).forEach((u,i)=>{
   const li=document.createElement("li");li.dataset.userId=u.id;
   for(const [cls,txt] of [["rank",String(i+1).padStart(2,"0")],["top-name",u.nickname],[live?"coins":"diamonds",u.coins.toLocaleString("vi-VN")+(live?" xu":" ◆")]]){
    const span=document.createElement("span");span.className=cls;span.textContent=txt;if(cls!=="rank")span.title=txt;li.append(span);
   }
   list.append(li);
  });
 }
}
function update(next){
 state=next;clockOffset=next.serverTime-Date.now();
 const visiblePeople=new Set([...state.users,...state.top].map(u=>u.id)).size;
 $("brandName").textContent=state.settings.name;$("footerClubName").textContent=state.settings.name;$("viewerCount").textContent=visiblePeople;
 $("welcome").hidden=visiblePeople>0;$("demoBadge").hidden=![...state.users,...state.top].some(u=>u.demo);
 $("lastEvent").textContent=state.lastEvent;
 $("statusDot").classList.toggle("online",state.tikfinity);
 $("statusText").textContent=state.tikfinity?"TikFinity Desktop đã kết nối":"Chưa kết nối TikFinity Desktop";
 $("eventCount").textContent=`${state.eventCount} sự kiện đã xử lý${state.lastLiveEvent?" · Đã nhận tương tác thật":" · Chưa nhận tương tác thật"}`;
 updateLeaderboards(state.top);
 if(document.activeElement!==$("clubName"))$("clubName").value=state.settings.name;
 $("theme").value=state.settings.theme;burst(state.effect);
 if(document.activeElement!==$("bpm"))$("bpm").value=state.settings.bpm||148;
 if(document.activeElement!==$("energy"))$("energy").value=Math.round((state.settings.energy||1.4)*100);
 $("bpmValue").textContent=`${$("bpm").value} BPM`;$("energyValue").textContent=`${$("energy").value}%`;
 $("cameraPreset").value=state.settings.camera||0;
 $("cameraMotion").value=state.settings.cameraMotion==="sweep"?"sweep":"fixed";
 if(document.activeElement!==$("cameraZoom"))$("cameraZoom").value=Math.round((state.settings.cameraZoom||1)*100);
 $("cameraZoomValue").textContent=`${$("cameraZoom").value}%`;
 $("broadcastMode").value=state.settings.broadcastMode||"clear";
 $("handProps").value=state.settings.handProps||"mixed";
 $("idleCleanup").checked=state.settings.idleCleanup!==false;
 $("handProps").disabled=!state.features?.handProps;$("handProps").title=state.features?.handProps?"":"Chạy lại start.bat để dùng lựa chọn đạo cụ mới";
 for(const character of CharacterCatalog.characters.filter(c=>c.custom))$("btnCharacter_"+character.key).disabled=character.id>=(state.features?.characterCount||14);
 if(control)updateDiagnostics();
 if(control)syncSimRecipients();
 globalThis.DancerControls?.update(state);
}
function updateDiagnostics(){
 const health=state.connection,summary=$("chatConnectionSummary"),n=now();
 if(!health){summary.textContent="Cần chạy lại start.bat để nạp máy chủ mới.";summary.dataset.level="error";return;}
 $("packetCount").textContent=health.packets.toLocaleString("vi-VN");$("realChatCount").textContent=health.chats.toLocaleString("vi-VN");$("handledEventCount").textContent=health.handled.toLocaleString("vi-VN");
 summary.dataset.level=!health.connected?"error":health.chats&&n-health.lastChat.receivedAt<60000?"ok":"wait";
 summary.textContent=!health.connected?"Chưa nối TikFinity Desktop. Mở ứng dụng trên máy này; sàn sẽ thử lại tự động.":!health.chats?"Đã nối ứng dụng, nhưng chưa nhận chat. Kết nối TikFinity vào đúng phòng đang LIVE rồi thử hey.":`Đã nhận ${health.chats.toLocaleString("vi-VN")} tin chat từ TikFinity · tin gần nhất ${Math.max(0,Math.floor((n-health.lastChat.receivedAt)/1000))} giây trước.`;
 const chat=health.lastChat;
 $("lastChatStatus").textContent=chat?`Chat gần nhất: ${chat.nickname}: ${chat.comment} · ${chat.accepted?"Đã xử lý":!chat.hasUser?"Thiếu mã người xem":!chat.command?"Tin này không phải lệnh vào sàn":"Đã nhận, không đổi sàn (có thể là tin lặp)"}`:"Chưa có tin chat từ TikFinity. Mô phỏng trên máy không làm tăng bộ đếm TIN CHAT.";
 const timing=health.lastTiming;
 $("timingStatus").textContent=!timing?"Đo độ trễ sự kiện: cần chạy máy chủ mới và nhận tương tác mới.":`Sự kiện ${timing.event}: ${timing.sourceAgeMs===null?"không có mốc thời gian nguồn":`tuổi khi nhận ≈ ${(timing.sourceAgeMs/1000).toFixed(2)} giây`} · xử lý trong code ${timing.processingMs.toFixed(2)} ms. Tuổi sự kiện dựa trên đồng hồ nguồn; không đo độ trễ video TikTok.`;
 $("connectionError").hidden=!health.lastError&&!health.invalid;$("connectionError").textContent=[health.lastError,health.invalid?`${health.invalid} gói không đọc được`:""].filter(Boolean).join(" · ");
 const sources=(state.sources||[]).filter(s=>n-s.seenAt<35000),studio=sources.filter(s=>s.kind==="studio"),shown=studio.length?studio:sources;
 const quality=$("sourceQualitySummary"),ready=shown.filter(s=>s.fullHd&&s.portrait).length;quality.dataset.level=shown.length&&ready===shown.length?"ok":"wait";
 quality.textContent=!shown.length?"Chưa thấy trang sân khấu báo kích thước. Mở hoặc tải lại Link trong LIVE Studio.":ready===shown.length?"Các trang đang báo đủ kích thước Full HD dọc. Báo cáo có thể gồm cửa sổ xem trước; chưa xác nhận độ phân giải video phát ra TikTok.":ready?`Đang có ${shown.length} trang báo kích thước: ${ready} đủ Full HD, ${shown.length-ready} đang thu nhỏ hoặc sai tỷ lệ. Có thể gồm cửa sổ xem trước; cần đối chiếu nguồn đã áp dụng trong LIVE Studio.`:"Trang đang thu nhỏ hoặc sai tỷ lệ. Kiểm tra nguồn Link W 1080 / H 1920 và bấm Áp dụng trong LIVE Studio.";
 const list=$("sourceQualityList");list.replaceChildren();for(const source of shown){const card=document.createElement("div"),title=document.createElement("b"),detail=document.createElement("span");card.className="source-quality-card";card.dataset.ready=String(source.fullHd&&source.portrait);title.textContent=`${source.kind==="studio"?"Trang dùng Link LIVE Studio":"Trang sân khấu"} · ${source.id.slice(0,8)}: ${Math.round(source.width)} × ${Math.round(source.height)}`;detail.textContent=source.fullHd&&source.portrait?"Trang đủ kích thước Full HD; đối chiếu với nguồn đang lên sóng":"Kiểm tra Độ phân giải tùy chỉnh: W 1080 / H 1920";card.append(title,detail);list.append(card);}
}
const events=new EventSource("/api/events");
events.onmessage=e=>{try{update(JSON.parse(e.data));}catch(err){console.error("Dữ liệu sân khấu không hợp lệ",err);}};
events.onerror=()=>{$("statusText").textContent="Máy chủ đã dừng · Chạy lại start.bat";$("statusDot").classList.remove("online");};
async function command(action,value){
 try{const response=await fetch("/api/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,value})});if(!response.ok)throw new Error(await response.text());return await response.json();}
 catch(err){$("statusText").textContent="Thao tác thất bại: "+err.message;return null;}
}
function demoPerson(id=simDesiredRecipient){return state.users.find(u=>u.demo&&u.id===id)||(state.demoCandidates||[]).find(u=>u.id===id);}
function paintDemoChoices(){
 for(const a of $("demoChoices").querySelectorAll("canvas")){
  const g=a.getContext("2d");g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,a.width,a.height);g.save();g.scale(2,2);
  dancer(g,40,86,.49,{variant:Number(a.dataset.variant),seed:0,nickname:"",vip:false},.2,true);g.restore();
 }
}
function syncDemoChoices(){
 const candidates=state.demoCandidates||[],key=JSON.stringify(candidates.map(u=>[u.id,u.nickname,u.variant]));
 if(key!==demoChoicesKey){
  demoChoicesKey=key;$("demoChoices").replaceChildren();
  for(const u of candidates){
   const button=document.createElement("button"),avatar=document.createElement("canvas"),name=document.createElement("strong"),detail=document.createElement("small");
   button.type="button";button.className="demo-choice";button.dataset.userId=u.id;button.setAttribute("aria-label",`Chọn ${u.nickname}`);
   avatar.width=160;avatar.height=192;avatar.dataset.variant=u.variant;avatar.setAttribute("aria-hidden","true");name.textContent=u.nickname;
   button.append(avatar,name,detail);button.onclick=()=>{simSelectionReady=true;simDesiredRecipient=u.id;simPendingRecipient=null;syncSimRecipients();};$("demoChoices").append(button);
  }
  paintDemoChoices();
 }
 for(const button of $("demoChoices").children){const u=demoPerson(button.dataset.userId);button.setAttribute("aria-pressed",String(button.dataset.userId===simDesiredRecipient));button.querySelector("small").textContent=u?.onFloor?`${u.coins.toLocaleString("vi-VN")} xu · trên sàn`:"Chưa vào sàn";}
}
memeHeads.addEventListener("load",paintDemoChoices);
function updateSimTotal(){
 const total=(Number($("simCoins").value)||0)*(Number($("simCount").value)||0);
 $("simTotal").textContent=`${total.toLocaleString("vi-VN")} xu`;
 const user=demoPerson(),name=user?.nickname||simPendingRecipient?.nickname;
 $("simNameWrap").hidden=!!simDesiredRecipient;
 const current=user?.coins||0,after=current+total,tier=WingCatalog.tierFor(after);
 $("simProgress").textContent=`${name?name+": ":""}Đã có ${current.toLocaleString("vi-VN")} xu → sau lần tặng: ${after.toLocaleString("vi-VN")} xu · ${tier?"Cánh "+WingCatalog.definition(tier).name:"Chưa đủ 30 xu mở cánh"}`;
 $("btnSimGift").textContent=name?`🎁 Tặng xu cho ${name}`:"🎁 Tặng xu mô phỏng";
 const supported=Array.isArray(state.demoCandidates);
 $("btnAddSelectedDemo").disabled=!user||user.onFloor||!supported;
 $("btnAddSelectedDemo").textContent=user?.onFloor?`${name} đã ở trên sàn`:name?`+ Thêm ${name} vào sàn`:"+ Chọn nhân vật để thêm";
 $("btnJoin").disabled=!!user&&(user.onFloor||!supported);
 $("btnJoin").textContent=user?`+ Thêm ${name}`:"+ Thêm tên ngẫu nhiên";
 $("demoSelectionStatus").textContent=!supported?"Cần chạy lại máy chủ để tải 5 nhân vật mẫu.":user?`Đang chọn ${name} · ${user.onFloor?"đã vào sàn":"sẽ vào sàn khi bấm Thêm hoặc tặng xu"}. Quà mô phỏng sẽ tặng đúng người này.`:"Chọn một nhân vật ở trên hoặc chọn tên trong mục tặng xu.";
 for(const sword of SwordCatalog.tiers){const button=$(sword.coins===50?"btnSword":"btnSword"+sword.coins);button.disabled=swordRequestPending||!user||!state.features?.selectedSword;button.title=user?`${name} nhận phi kiếm ${sword.coins} xu`:"Chọn nhân vật ở trên";}
 $("swordRecipientStatus").textContent=!state.features?.selectedSword?"Cần chạy lại máy chủ để phi kiếm dùng người đang chọn.":user?`Người cưỡi phi kiếm: ${name} · Chọn mức 10, 20 hoặc 50 xu bên dưới.`:"Chọn nhân vật ở trên để nhận phi kiếm.";
}
function syncSimRecipients(){
 const select=$("simRecipient"),candidates=state.demoCandidates||[];
 if(!simSelectionReady&&candidates.length){simSelectionReady=true;simDesiredRecipient=candidates[0].id;}
 const people=new Map([...candidates,...state.users.filter(u=>u.demo)].map(u=>[u.id,u]));
 if(people.has(simPendingRecipient?.id))simPendingRecipient=null;
 if(simPendingRecipient&&Date.now()<simPendingRecipient.until)people.set(simPendingRecipient.id,simPendingRecipient);
 else simPendingRecipient=null;
 if(simDesiredRecipient&&!people.has(simDesiredRecipient))simDesiredRecipient=candidates[0]?.id||"";
 const optionsKey=JSON.stringify([...people.values()].map(u=>[u.id,u.nickname,u.onFloor,u.coins]));
 if(optionsKey!==simOptionsKey){
  simOptionsKey=optionsKey;select.replaceChildren();const first=document.createElement("option");first.value="";first.textContent="+ Tạo người thử mới";select.append(first);
  for(const u of people.values()){const option=document.createElement("option");option.value=u.id;option.textContent=`${u.nickname} · ${u.onFloor?u.coins.toLocaleString("vi-VN")+" xu":"chưa vào sàn"}`;select.append(option);}
 }
 select.value=simDesiredRecipient;syncDemoChoices();updateSimTotal();
}
function rememberDemoSelection(result,requested){
 if(!result?.userId||simDesiredRecipient!==requested)return;
 simDesiredRecipient=result.userId;simSelectionReady=true;simPendingRecipient={id:result.userId,nickname:result.nickname||"Đang đồng bộ…",coins:0,onFloor:true,until:Date.now()+5000};syncSimRecipients();
}
async function addSelectedDemo(){
 const recipientId=simDesiredRecipient,button=$("btnAddSelectedDemo");button.disabled=true;$("btnJoin").disabled=true;
 try{const result=await command("join",recipientId?{recipientId}:undefined);rememberDemoSelection(result,recipientId);}
 finally{updateSimTotal();}
}
$("btnAddSelectedDemo").onclick=addSelectedDemo;
$("simRecipient").onchange=()=>{simSelectionReady=true;simDesiredRecipient=$("simRecipient").value;simPendingRecipient=null;syncSimRecipients();};
$("simCoins").oninput=updateSimTotal;$("simCount").oninput=updateSimTotal;
for(const coins of [1,10,...WingCatalog.tiers.map(tier=>tier.coins)]){const button=document.createElement("button");button.type="button";button.textContent=`${coins} xu`;button.dataset.simCoins=coins;button.onclick=()=>{$("simCoins").value=coins;$("simCount").value="1";updateSimTotal();};$("simPresets").append(button);}
$("simGiftForm").onsubmit=async event=>{
 event.preventDefault();if(!$("simGiftForm").reportValidity())return;
 const coins=Number($("simCoins").value),count=Number($("simCount").value),recipientId=simDesiredRecipient;
 $("btnSimGift").disabled=true;$("simFeedback").textContent="Đang mô phỏng tặng quà…";
 try{const result=await command("simulateGift",{recipientId,nickname:$("simNickname").value,coins,count});
  if(result?.userId){rememberDemoSelection(result,recipientId);$("simFeedback").textContent=`Đã tặng ${result.nickname||"nhân vật đã chọn"} ${coins.toLocaleString("vi-VN")} xu × ${count} = ${(coins*count).toLocaleString("vi-VN")} xu mô phỏng. Có thể tặng tiếp để nâng cánh.`;}
  else $("simFeedback").textContent="Chưa tặng được. Kiểm tra máy chủ và người thử đã chọn.";
 }finally{$("btnSimGift").disabled=false;}
};
for(const [id,action] of Object.entries({btnDemo:"demo",btnJoin:"join",btnChat:"zoom",btnGift:"rose",btnBigGift:"galaxy",btnFollow:"follow",btnClearDemo:"clearDemo",btnCamera:"camera",btnDrop:"drop"}))$(id).onclick=()=>command(action);
$("btnJoin").onclick=addSelectedDemo;
$("btnClearDemo").onclick=async()=>{if(await command("clearDemo")){simPendingRecipient=null;syncSimRecipients();}};
for(const sword of SwordCatalog.tiers)$(sword.coins===50?"btnSword":"btnSword"+sword.coins).onclick=async()=>{
 if(swordRequestPending||!demoPerson()||!state.features?.selectedSword)return;
 const recipientId=simDesiredRecipient;swordRequestPending=true;updateSimTotal();
 try{
  const result=await command("sword",{coins:sword.coins,recipientId});rememberDemoSelection(result,recipientId);
  $("swordFeedback").textContent=result?.userId?`${result.nickname} nhận ${sword.name} · ${sword.coins} xu mô phỏng. Không khoe cánh khi nhận phi kiếm; vẫn nâng cánh nếu đủ xu. Các lượt bay diễn ra lần lượt.`:"Chưa gửi được phi kiếm. Kiểm tra nhân vật đang chọn và máy chủ.";
 }finally{swordRequestPending=false;updateSimTotal();}
};
for(const character of CharacterCatalog.characters.filter(c=>c.custom)){const button=document.createElement("button");button.id="btnCharacter_"+character.key;button.textContent="+ "+character.name;button.onclick=async()=>{const requested=simDesiredRecipient,result=await command("character",{variant:character.id});rememberDemoSelection(result,requested);};$("characterButtons").append(button);}
$("characterHint").textContent="Khán giả chat tên nhân vật để chọn; chat đổi nv để luân phiên "+CharacterCatalog.count+" mẫu. Mới: Gấu Đại Ca bật nhảy nện tay, Gấu Cười Điên xoay tay bão, Gấu Mít Ướt shuffle bật gối, Nấm Bão đấm chéo lực. Neuvillette đổi giữa đấm chéo, xoay tay và shuffle; Zhongli bật nhảy, nện tay và dậm chân. Mỗi người lệch nhịp riêng, mặc định các mẫu này nhảy tay không.";
for(const [id,action]of Object.entries({btnChat:"zoom",btnGift:"rose",btnBigGift:"galaxy",btnFollow:"follow"}))$(id).onclick=()=>command(action,{recipientId:simDesiredRecipient});
$("bpm").oninput=()=>$("bpmValue").textContent=`${$("bpm").value} BPM`;
$("energy").oninput=()=>$("energyValue").textContent=`${$("energy").value}%`;
$("bpm").onchange=()=>command("settings",{bpm:Number($("bpm").value)});
$("energy").onchange=()=>command("settings",{energy:Number($("energy").value)/100});
$("broadcastMode").onchange=()=>command("settings",{broadcastMode:$("broadcastMode").value});
$("handProps").onchange=()=>command("settings",{handProps:$("handProps").value});
$("idleCleanup").onchange=()=>command("settings",{idleCleanup:$("idleCleanup").checked});
$("btnReconnectTikfinity").onclick=()=>command("reconnectTikfinity");$("btnTestHey").onclick=()=>command("join");
for(const [i,preset] of ClubCamera.presets.entries()){const option=document.createElement("option");option.value=i;option.textContent=preset.name;$("cameraPreset").append(option);}
$("cameraPreset").onchange=()=>command("camera",Number($("cameraPreset").value));
$("cameraMotion").onchange=()=>command("settings",{cameraMotion:$("cameraMotion").value});
$("btnResumeCamera").onclick=()=>command("settings",{cameraMotion:"sweep"});
$("cameraZoom").oninput=()=>$("cameraZoomValue").textContent=`${$("cameraZoom").value}%`;
$("cameraZoom").onchange=()=>command("settings",{cameraZoom:Number($("cameraZoom").value)/100});
for(const tier of WingCatalog.tiers){
 const button=document.createElement("button");button.id="btnWing"+tier.coins;button.textContent=`${tier.icon} Thử ${tier.coins} xu`;button.onclick=()=>command("wingPreview",tier.coins);$("wingTestButtons").append(button);
}
$("wingRewardSummary").textContent=WingCatalog.tiers.map(tier=>`${tier.coins} xu: ${tier.name} (${tier.seconds}s)`).join(" · ")+". Chỉ khoe lớn khi mở cánh mới; giữ bậc cánh trong phiên.";
$("giftNoteMinWing").textContent=`Tổng từ ${WingCatalog.tiers[0].coins} xu`;
$("giftNoteSwordCoins").textContent=SwordCatalog.tiers.map(tier=>tier.coins).join(" / ")+" xu";
$("giftNoteWingTiers").textContent="Cánh: "+WingCatalog.tiers.map(tier=>tier.coins).join(" · ")+" xu";
$("btnName").onclick=()=>command("settings",{name:$("clubName").value});$("theme").onchange=()=>command("settings",{theme:$("theme").value});
$("btnReset").onclick=()=>{if(confirm("Bắt đầu phiên mới? Toàn bộ người xem và điểm quà của phiên hiện tại sẽ bị xóa."))command("reset");};
const liveUrl=location.origin+"/",studioUrl=liveUrl+"#tiktok.studio";
$("obsUrl").value=liveUrl;$("studioUrl").value=studioUrl;$("openLive").href=liveUrl;
function copySourceUrl(buttonId,inputId){return async()=>{try{await navigator.clipboard.writeText($(inputId).value);$(buttonId).textContent="Đã copy";setTimeout(()=>$(buttonId).textContent="Copy",1800);}catch{$(inputId).select();}};}
$("btnCopy").onclick=copySourceUrl("btnCopy","obsUrl");$("btnCopyStudio").onclick=copySourceUrl("btnCopyStudio","studioUrl");
let musicUrl=null;$("musicFile").onchange=()=>{const file=$("musicFile").files[0];if(!file)return;if(musicUrl)URL.revokeObjectURL(musicUrl);musicUrl=URL.createObjectURL(file);$("music").src=musicUrl;$("music").play().catch(()=>{});};
globalThis.DancerControls?.init(command,now,control);
requestAnimationFrame(render);
const sourceId=globalThis.crypto?.randomUUID?.()||"source_"+Math.random().toString(36).slice(2);
function reportSourceViewport(){
 if(control)return;const bounds=screen.getBoundingClientRect();
 fetch("/api/source-status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:sourceId,kind:location.hash.includes("tiktok.studio")?"studio":"browser",width:innerWidth,height:innerHeight,stageWidth:bounds.width,stageHeight:bounds.height,renderWidth:canvas.width,renderHeight:canvas.height,dpr:devicePixelRatio||1}),keepalive:true}).catch(()=>{});
}
reportSourceViewport();setInterval(()=>{if(control)updateDiagnostics();else reportSourceViewport();},10000);
let sourceResizeTimer;addEventListener("resize",()=>{clearTimeout(sourceResizeTimer);sourceResizeTimer=setTimeout(reportSourceViewport,400);});
