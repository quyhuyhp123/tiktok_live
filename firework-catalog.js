(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.FireworkCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 // 1-coin gift that fires fireworks over the floor. VN catalogue (livefinity.pro,
 // checked 2026-11-26): Thumbs Up, id 6246, 1 coin. Rose and TikTok (also 1 coin)
 // already have their own effects; Rose additionally gets a single burst from the
 // gifter's character.
 const gift={name:"Thumbs Up",giftId:"6246",coins:1,icon:"👍"};
 // Each gift fires a salvo of five different shells spread across the screen.
 const kinds=["peony","ring","willow","palm","crossette","heart"],salvoOffsets=[0,170,340,520,700];
 const salvoSpacing=900,maxSalvosPerGift=6,maxQueued=90,lifetime=5200;
 const plain=s=>String(s??"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g,"");
 const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 // Prefer the gift id; fall back to the name only when the event carries no id.
 function matches({coins,giftId,name}){
  if(Number(coins)!==gift.coins)return false;
  const id=String(giftId??"");
  return id?id===gift.giftId:plain(name)===plain(gift.name);
 }
 const active=(queue,time)=>(queue||[]).filter(f=>f.at>time-lifetime);
 // One salvo per gift in a combo (capped), queued after any salvo still waiting.
 function schedule(queue,count,time,nextId){
  const list=active(queue,time),lastSalvo=list.reduce((m,f)=>f.salvo?Math.max(m,f.salvo):m,-Infinity);
  let start=Math.max(time,lastSalvo+salvoSpacing);
  const salvos=Math.min(maxSalvosPerGift,Math.max(1,count));
  for(let s=0;s<salvos;s++,start+=salvoSpacing){
   const lanes=shuffle([0,1,2,3,4]),picked=shuffle(kinds);
   salvoOffsets.forEach((offset,i)=>list.push({id:nextId(),at:start+offset+Math.round(Math.random()*60),salvo:start,lane:lanes[i],kind:picked[i],seed:Math.random()}));
  }
  return list.sort((a,b)=>a.at-b.at).slice(-maxQueued);
 }
 // A single rose-coloured burst that blooms out of the gifter's character.
 function roseBurst(queue,userId,at,nextId,time=at){
  return [...active(queue,time),{id:nextId(),at,kind:"rose",userId,seed:Math.random()}].sort((a,b)=>a.at-b.at).slice(-maxQueued);
 }
 return {gift,kinds,salvoOffsets,maxSalvosPerGift,matches,schedule,roseBurst,active,lifetime};
});
