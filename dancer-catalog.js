(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.DancerCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const duration=26.7,swapSeconds=.48,height=290;
 // VN gift catalogue checked 2026-11-09. Incoming unit cost must still equal 5.
 const giftPresets=[
  {slot:1,name:"Finger Heart",giftId:"5487",icon:"💗",alternateIds:["5880"]},
  {slot:2,name:"Ice cream",giftId:"7412",icon:"🍦"},
  {slot:3,name:"Okay",giftId:"8635",icon:"👌"},
  {slot:4,name:"Peach",giftId:"10961",icon:"🍑"},
  {slot:5,name:"Name shoutout",giftId:"19445",icon:"📣"}
 ];
 const models=[
  {id:"neuvillette",name:"Neuvillette",file:"neuvillette.glb",color:"#83e6ff"},
  {id:"zhongli",name:"Zhongli",file:"zhongli_from_genshin_impact.glb",color:"#ffdb83"},
  {id:"flins",name:"Flins",file:"flins_rigged_free.glb",color:"#bea2ff"},
  {id:"wriothesley",name:"Wriothesley",file:"genshin_impact_-_wriothesley.glb",color:"#ff7eac"},
  {id:"childe",name:"Childe",file:"tartaglia__childe.glb",color:"#ffac76"}
 ];
 const slots=[{x:-225,z:1010},{x:225,z:1010},{x:-340,z:715},{x:0,z:675},{x:340,z:715}].map((p,i)=>({...p,y:127,slot:i+1}));
 const plain=s=>String(s??"").normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 function defaults(time=Date.now(),saved={}){
  const order=Array.isArray(saved.order)&&saved.order.length===5&&new Set(saved.order).size===5&&saved.order.every(id=>models.some(m=>m.id===id))?saved.order:[...models.map(m=>m.id)];
  const usePreset=!Array.isArray(saved.gifts)||!saved.gifts.some(g=>g?.name||g?.giftId)&&saved.giftPresetVersion!==1;
  const gifts=slots.map((p,i)=>{const g=usePreset?giftPresets[i]:saved.gifts[i];return {slot:p.slot,name:String(g?.name||"").slice(0,60),giftId:String(g?.giftId||"").replace(/\D/g,'').slice(0,20)};});
  return {enabled:saved.enabled!==false,autoSwap:saved.autoSwap!==false,order,gifts,giftPresetVersion:1,startedAt:time,pausedAt:null,focus:null,recentGifts:[]};
 }
 function clock(config,time){const elapsed=Math.max(0,((config.pausedAt??time)-(config.startedAt??time))/1000);return {elapsed,round:Math.floor(elapsed/duration),phase:elapsed%duration};}
 function formation(config,time){
  const {round,phase}=clock(config,time),order=config.order||models.map(m=>m.id),swapping=config.autoSwap!==false&&phase>duration-swapSeconds;
  const blend=swapping?smooth((phase-duration+swapSeconds)/swapSeconds):0;
  return order.map((id,index)=>{
   const current=index<2?index:2+(index-2+(config.autoSwap===false?0:round))%3,next=index<2?index:2+(index-2+round+1)%3;
   const a=slots[current],b=slots[next],moving=index>=2&&swapping,bow=moving?Math.sin(blend*Math.PI):0;
   return {...models.find(m=>m.id===id),actor:index,slot:(moving&&blend>.5?next:current)+1,x:a.x+(b.x-a.x)*(moving?blend:0),y:127+bow*23,z:a.z+(b.z-a.z)*(moving?blend:0)-bow*(index===4?85:25),moving,phase,round};
  });
 }
 function matchGift(config,gift){
  if(Number(gift.coins)!==5)return null;
  const id=String(gift.giftId??""),name=plain(gift.name);
  return config.gifts.find(g=>{
   if(g.giftId&&id){const preset=giftPresets.find(p=>p.giftId===g.giftId);return id===g.giftId||!!preset?.alternateIds?.includes(id);}
   return !!g.name&&plain(g.name).replace(/\s/g,'')===name.replace(/\s/g,'');
  })?.slot||null;
 }
 function settings(config,value){
  if(!value||typeof value!=="object")return false;
  if(value.gifts!==undefined){
   if(!Array.isArray(value.gifts)||value.gifts.length!==5)return false;
   const usedIds=new Set(),usedNames=new Set();
   for(const g of value.gifts){if(typeof g.name!=="string"||g.name.length>60||typeof g.giftId!=="string"||!/^[0-9]{0,20}$/.test(g.giftId))return false;const name=plain(g.name);if(g.giftId&&usedIds.has(g.giftId)||name&&usedNames.has(name))return false;if(g.giftId)usedIds.add(g.giftId);if(name)usedNames.add(name);}
  }
  if(value.order!==undefined&&(!Array.isArray(value.order)||value.order.length!==5||new Set(value.order).size!==5||!value.order.every(id=>models.some(m=>m.id===id))))return false;
  if(value.gifts)config.gifts=value.gifts.map((g,i)=>({slot:i+1,name:g.name.trim(),giftId:g.giftId}));
  if(value.order)config.order=[...value.order];
  if(typeof value.enabled==='boolean')config.enabled=value.enabled;
  if(typeof value.autoSwap==='boolean')config.autoSwap=value.autoSwap;
  return true;
 }
 return {duration,swapSeconds,height,models,slots,giftPresets,defaults,clock,formation,matchGift,settings};
});
