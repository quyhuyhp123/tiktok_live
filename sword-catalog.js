(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.SwordCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const duration=12000,takeoff=1200,landing=1200;
 const tiers=[
  {coins:10,tier:1,name:"Thanh Phong",color:"#76e8ff",accent:"#e8ffff",blade:108,trailMs:2600,ghosts:2},
  {coins:20,tier:2,name:"Tử Lôi",color:"#b28aff",accent:"#88f4ff",blade:134,trailMs:3400,ghosts:3},
  {coins:50,tier:3,name:"Long Vương",color:"#ffd477",accent:"#a6ffff",blade:160,trailMs:4400,ghosts:5}
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
