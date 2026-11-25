"use strict";
class SourceMonitor{
 constructor(){this.clients=new Map();}
 report(value,time=Date.now()){
  if(!value||typeof value.id!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id)||!["studio","browser"].includes(value.kind))return false;
  for(const key of ["width","height","renderWidth","renderHeight","stageWidth","stageHeight"])
   if(!Number.isFinite(value[key])||value[key]<1||value[key]>16384)return false;
  if(!Number.isFinite(value.dpr)||value.dpr<.5||value.dpr>4)return false;
  this.snapshot(time);if(!this.clients.has(value.id)&&this.clients.size>=16)return false;
  const {id,kind,width,height,renderWidth,renderHeight,stageWidth,stageHeight,dpr}=value;
  this.clients.set(id,{id,kind,width,height,renderWidth,renderHeight,stageWidth,stageHeight,dpr,seenAt:time,
   fullHd:stageWidth*dpr>=1079&&stageHeight*dpr>=1919&&renderWidth>=1080&&renderHeight>=1920,
   portrait:Math.abs(width/height-9/16)<.01});return true;
 }
 snapshot(time=Date.now()){for(const[id,s]of this.clients)if(time-s.seenAt>35000)this.clients.delete(id);return [...this.clients.values()].map(s=>({...s}));}
}
module.exports={SourceMonitor};
