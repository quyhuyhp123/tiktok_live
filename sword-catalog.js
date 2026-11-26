(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.SwordCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const duration=12000,takeoff=1200,landing=1200;
 const tiers=[
  // Artwork cut-outs are vertical (pommel up); centerX/guardY are pixels in the 1024 px tall image.
  {coins:10,tier:1,name:"Tử Lôi",color:"#a77bff",accent:"#e6dcff",blade:108,trailMs:2600,ghosts:2,image:"sword-10.png",centerX:130,guardY:238,length:290},
  {coins:20,tier:2,name:"Bạch Phượng",color:"#ffe7a8",accent:"#a8eeff",blade:134,trailMs:3400,ghosts:3,image:"sword-20.png",centerX:120,guardY:193,length:315},
  {coins:50,tier:3,name:"Long Vương",color:"#ffc15a",accent:"#ff6f9a",blade:160,trailMs:4400,ghosts:5,image:"sword-50.png",centerX:145,guardY:262,length:355}
 ];
 const forGift=coins=>tiers.find(tier=>tier.coins===coins)||null;
 const definition=coins=>forGift(coins)||tiers[2];
 function rideAt(flight,time){if(!flight)return null;return (flight.rides||[flight]).find(ride=>ride.startedAt<=time&&ride.until>time)||null;}
 function enqueue(flight,coins,earliest,time){
  const rides=(flight?.rides||(flight?[flight]:[])).filter(ride=>ride.until>time).map(ride=>({...ride,coins:ride.coins||50}));
  const startedAt=Math.max(earliest,rides.at(-1)?.until||time);
  rides.push({coins,startedAt,until:startedAt+duration});
  return {coins:rides[0].coins,startedAt:rides[0].startedAt,until:rides.at(-1).until,rides};
 }
 function pause(flight,delay,time){
  if(!flight)return null;
  const rides=(flight.rides||[flight]).filter(ride=>ride.until>time).map(ride=>({...ride,coins:ride.coins||50,startedAt:ride.startedAt+delay,until:ride.until+delay}));
  return rides.length?{coins:rides[0].coins,startedAt:rides[0].startedAt,until:rides.at(-1).until,rides}:null;
 }
 return {tiers,duration,takeoff,landing,forGift,definition,rideAt,enqueue,pause};
});
