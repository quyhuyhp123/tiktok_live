(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.ClubCamera=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const presets=[
  {name:"Chính diện rộng",yaw:0,height:1350,distance:2350},
  {name:"Chéo trái",yaw:-Math.PI/3,height:1480,distance:2550},
  {name:"Bên trái",yaw:-Math.PI/2,height:1500,distance:2650},
  {name:"Phía sau sân khấu",yaw:Math.PI,height:1580,distance:2750},
  {name:"Bên phải",yaw:Math.PI/2,height:1500,distance:2650},
  {name:"Chéo phải",yaw:Math.PI/3,height:1480,distance:2550},
  {name:"Toàn sàn từ trên cao",yaw:Math.PI/4,height:2350,distance:1900},
  {name:"Siêu rộng toàn cảnh",yaw:-Math.PI/5,height:1850,distance:2850}
 ];
 const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
 const sweepPeriod=200000;
 function migrateSweep(settings,previousPeriod,time=Date.now()){
  if(Number.isFinite(settings.cameraSweepStartedAt)){
   const reference=settings.cameraMotion==="fixed"&&Number.isFinite(settings.cameraSweepPausedAt)?settings.cameraSweepPausedAt:time;
   const phase=Math.max(0,reference-settings.cameraSweepStartedAt)/previousPeriod;
   settings.cameraSweepStartedAt=reference-phase*sweepPeriod;
  }
  settings.cameraSweepPeriod=sweepPeriod;
 }
 function view(settings,time){
  const sweeping=settings.cameraMotion==="sweep";
  const override=sweeping&&settings.cameraOverrideUntil>time;
  const index=Number.isInteger(settings.camera)&&presets[settings.camera]?settings.camera:0,target={...presets[sweeping?0:index]};
  if(sweeping){
   // Cross the center continuously; only the two 60-degree limits reverse direction.
   const clock=settings.cameraSweepPausedAt??time,elapsed=Math.max(0,clock-(settings.cameraSweepStartedAt??clock));
   target.yaw=Math.sin(elapsed/(settings.cameraSweepPeriod||sweepPeriod)*Math.PI*2)*Math.PI/3;
  }else if(Number.isFinite(settings.cameraYaw))target.yaw=settings.cameraYaw;
  let from=settings.cameraFrom||target,elapsed=Math.max(0,(time-(settings.cameraChangedAt??time))/1000),duration=sweeping?12:1.25;
  if(override){
   const returnAt=settings.cameraOverrideUntil-12000;
   if(time<returnAt){Object.assign(target,presets[index]);duration=1.25;}
   else{from=presets[index];elapsed=(time-returnAt)/1000;duration=12;}
  }
  const p=Math.min(1,elapsed/duration),ease=p*p*(3-2*p);
  return {yaw:from.yaw+angle(target.yaw-from.yaw)*ease,height:from.height+(target.height-from.height)*ease,distance:from.distance+(target.distance-from.distance)*ease,zoom:settings.cameraZoom||1,targetX:0,targetZ:450,targetY:55};
 }
 function select(settings,index,time=Date.now()){
  if(!Number.isInteger(index)||!presets[index])return false;
  const current=view(settings,time);current.yaw=angle(current.yaw);
  const sweeping=settings.cameraMotion==="sweep";
  settings.cameraFrom=current;settings.cameraChangedAt=time;settings.camera=index;settings.cameraMotion=sweeping?"sweep":"fixed";settings.autoCamera=false;
  if(sweeping)settings.cameraOverrideUntil=time+20000;else delete settings.cameraOverrideUntil;
  delete settings.cameraYaw;return true;
 }
 function setMotion(settings,mode,time=Date.now()){
  if(!["sweep","fixed"].includes(mode))return false;
  if(settings.cameraMotion===mode&&!(settings.cameraOverrideUntil>time)){delete settings.cameraOverrideUntil;return true;}
  const wasSweeping=settings.cameraMotion==="sweep";
  const current=view(settings,time);
  delete settings.cameraOverrideUntil;
  settings.cameraFrom=current;settings.cameraChangedAt=time;settings.cameraMotion=mode;settings.autoCamera=false;
  if(mode==="sweep"){
   settings.camera=0;
   if(Number.isFinite(settings.cameraSweepPausedAt)&&Number.isFinite(settings.cameraSweepStartedAt))settings.cameraSweepStartedAt+=time-settings.cameraSweepPausedAt;
   else if(!wasSweeping||!Number.isFinite(settings.cameraSweepStartedAt)){
    const yaw=Math.max(-1,Math.min(1,angle(current.yaw)/(Math.PI/3))),phase=Math.PI-Math.asin(yaw);
    settings.cameraSweepStartedAt=time-phase/(Math.PI*2)*(settings.cameraSweepPeriod||sweepPeriod);
   }
   delete settings.cameraSweepPausedAt;delete settings.cameraYaw;
  }else{settings.cameraYaw=current.yaw;if(wasSweeping)settings.cameraSweepPausedAt=time;}
  return true;
 }
 const projectionCache=new WeakMap();
 function project(point,pose){
  const {yaw,height,distance}=pose,targetX=pose.targetX||0,targetY=pose.targetY??55,targetZ=pose.targetZ??450;
  let basis=projectionCache.get(pose);
  if(!basis||basis.yaw!==yaw||basis.height!==height||basis.distance!==distance||basis.tx!==targetX||basis.ty!==targetY||basis.tz!==targetZ){
   const s=Math.sin(yaw),c=Math.cos(yaw),pitch=Math.atan2(height-targetY,distance),sp=Math.sin(pitch),cp=Math.cos(pitch);
   basis={yaw,height,distance,tx:targetX,ty:targetY,tz:targetZ,s,c,sp,cp,ox:targetX+s*distance,oz:targetZ+c*distance};projectionCache.set(pose,basis);
  }
  const {s,c,sp,cp,ox,oz}=basis,dx=point[0]-ox,dy=point[1]-height,dz=point[2]-oz;
  const right=dx*c-dz*s,up=-dx*s*sp+dy*cp-dz*c*sp,depth=-dx*s*cp-dy*sp-dz*c*cp;
  const scale=1060*(pose.zoom||1)/Math.max(80,depth);
  return {x:360+(pose.shiftX||0)+right*scale,y:500-up*scale,scale,depth};
 }
 return {presets,view,select,setMotion,migrateSweep,sweepPeriod,project};
});
