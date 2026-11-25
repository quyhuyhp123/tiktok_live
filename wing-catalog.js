(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.WingCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const basic={coins:0,name:"Thiên Thần",atlas:"classic",frame:0,color:"#d9eaff",icon:"🪽"};
 const tiers=[
  {coins:30,name:"Băng Lam",seconds:5,atlas:"classic",frame:1,color:"#60e7ff",icon:"🧊"},
  {coins:50,name:"Tử Tinh",seconds:5,atlas:"classic",frame:2,color:"#c069ff",icon:"💜"},
  {coins:100,name:"Lục Bảo",seconds:5,atlas:"extra",frame:0,color:"#65f6ad",icon:"💚"},
  {coins:150,name:"Lôi Đình",seconds:5,atlas:"extra",frame:1,color:"#7ba7ff",icon:"⚡"},
  {coins:200,name:"Thiên Hà",seconds:5,atlas:"extra",frame:2,color:"#ffafe5",icon:"🌠"},
  {coins:300,name:"Phượng Hoàng",seconds:15,atlas:"classic",frame:3,color:"#ffc75b",icon:"🔥"}
 ];
 const tierFor=coins=>tiers.reduce((tier,entry,i)=>Number(coins)>=entry.coins?i+1:tier,0);
 const definition=tier=>tiers[tier-1]||basic;
 return {basic,tiers,tierFor,definition};
});
