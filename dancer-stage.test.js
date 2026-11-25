"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),catalog=require('./dancer-catalog'),{ClubState}=require('./engine');
const gift=(extra={})=>({event:'gift',data:{uniqueId:'fan',nickname:'Fan',giftId:101,giftName:'Quà thử A',diamondCount:5,giftType:0,...extra}});
const mappings=()=>Array.from({length:5},(_,i)=>({name:'Quà thử '+String.fromCharCode(65+i),giftId:String(101+i)}));

test('five verified default gifts select their slots by ID and retain explicit custom or empty mappings',()=>{
 const c=new ClubState();assert.deepEqual(c.dancers.gifts.map(g=>g.giftId),['5487','7412','8635','10961','19445']);
 for(const preset of catalog.giftPresets){c.event(gift({giftId:Number(preset.giftId),giftName:'Localized gift name'}));assert.equal(c.dancers.focus.slot,preset.slot);}
 c.event(gift({giftId:5880,giftName:'Finger Heart'}));assert.equal(c.dancers.focus.slot,1);
 assert.equal(catalog.matchGift(c.dancers,{coins:5,name:'FingerHeart'}),1);assert.equal(catalog.matchGift(c.dancers,{coins:4,giftId:5487,name:'Finger Heart'}),null);
 const migrated=catalog.defaults(100,{gifts:mappings().map(()=>({name:'',giftId:''}))});assert.equal(migrated.gifts[0].giftId,'5487');
 c.control('dancerSettings',{gifts:mappings().map(()=>({name:'',giftId:''}))});assert.ok(new ClubState(c.save()).dancers.gifts.every(g=>!g.name&&!g.giftId));
 c.control('dancerSettings',{gifts:mappings()});assert.deepEqual(new ClubState(c.save()).dancers.gifts,c.dancers.gifts);
});

test('five model slots keep the front pair fixed and rotate only the back three each song',()=>{
 const config=catalog.defaults(1000);
 for(let round=0;round<4;round++){
  const poses=catalog.formation(config,1000+(round*catalog.duration+1)*1000);
  assert.equal(poses.find(p=>p.slot===1).id,'neuvillette');assert.equal(poses.find(p=>p.slot===2).id,'zhongli');assert.equal(new Set(poses.map(p=>p.slot)).size,5);
  assert.equal(poses.find(p=>p.id==='flins').slot,3+round%3);
 }
 for(let time=26000;time<29000;time+=7)for(const p of catalog.formation(config,time)){assert.ok([p.x,p.y,p.z].every(Number.isFinite));assert.ok(Math.abs(p.x)<=520&&p.z>=560&&p.z<=1140);}
 config.autoSwap=false;assert.deepEqual(catalog.formation(config,1000).map(p=>p.slot),catalog.formation(config,90000).map(p=>p.slot));
});
test('gift mappings require the right gift identity and a unit cost of five coins',()=>{
 const config=catalog.defaults();assert.equal(catalog.matchGift(config,{coins:5,name:'Any gift'}),null);
 assert.equal(catalog.settings(config,{gifts:mappings()}),true);
 assert.equal(catalog.matchGift(config,{coins:5,giftId:103,name:'Different display name'}),3);
 assert.equal(catalog.matchGift(config,{coins:10,giftId:103,name:'Quà thử C'}),null);
 assert.equal(catalog.matchGift(config,{coins:5,giftId:999,name:'Quà thử C'}),null);
 const before=JSON.stringify(config);const duplicate=mappings();duplicate[4]=duplicate[0];assert.equal(catalog.settings(config,{gifts:duplicate,enabled:false}),false);assert.equal(JSON.stringify(config),before);
 config.gifts[0].giftId='';assert.equal(catalog.matchGift(config,{coins:5,name:'quà thử a'}),1);
});
test('mapped five-coin gifts zoom the correct dancer, preserve coins and do not accidentally grant swords for multiples',()=>{
 const c=new ClubState();assert.equal(c.control('dancerSettings',{gifts:mappings()}),true);
 c.event(gift({repeatCount:2}));assert.equal(c.users.get('fan').coins,10);assert.equal(c.users.get('fan').swordFlight,undefined);assert.equal(c.dancers.focus.slot,1);assert.equal(c.dancers.focus.until-c.dancers.focus.startedAt,5000);
 c.event(gift({giftId:105,repeatCount:3}));assert.equal(c.users.get('fan').coins,25);assert.equal(c.dancers.focus.slot,5);assert.equal(c.dancers.recentGifts.length,2);
 c.event(gift({giftId:103,diamondCount:4}));assert.equal(c.dancers.focus.slot,5);
 assert.equal(c.control('dancerTest',3),true);assert.equal(c.dancers.focus.slot,3);assert.equal(c.control('dancerTest',6),false);
});
test('gift streaks and duplicate packets cannot replay dancer selections or score twice',()=>{
 const c=new ClubState();c.control('dancerSettings',{gifts:mappings()});
 assert.equal(c.event(gift({giftType:1,repeatEnd:false,msgId:'dancer-streak',repeatCount:2})),false);assert.equal(c.dancers.focus,null);
 c.event(gift({giftType:1,repeatEnd:true,msgId:'dancer-streak',repeatCount:2}));const focus=c.dancers.focus;
 assert.equal(c.event(gift({giftType:1,repeatEnd:true,msgId:'dancer-streak',repeatCount:2})),false);assert.equal(c.users.get('fan').coins,10);assert.equal(c.dancers.focus,focus);
});
test('model order and gift configuration persist while temporary gift focus is cleared on restart',()=>{
 const c=new ClubState(),order=['zhongli','neuvillette','childe','flins','wriothesley'];
 assert.equal(c.control('dancerSettings',{order,gifts:mappings(),autoSwap:false}),true);c.control('dancerTest',2);
 const restored=new ClubState(c.save());assert.deepEqual(restored.dancers.order,order);assert.deepEqual(restored.dancers.gifts,c.dancers.gifts);assert.equal(restored.dancers.autoSwap,false);assert.equal(restored.dancers.focus,null);
 assert.equal(c.control('dancerSettings',{order:['flins','flins','childe','neuvillette','zhongli']}),false);
});
test('playback pause and seek hold a shared clock for source and control views',()=>{
 const c=new ClubState();assert.equal(c.control('dancerPlayback',{playing:false,seek:8}),true);const before=catalog.clock(c.dancers,Date.now());assert.equal(catalog.clock(c.dancers,Date.now()+10000).phase,before.phase);
 assert.equal(c.control('dancerPlayback',{playing:true}),true);assert.ok(Math.abs(catalog.clock(c.dancers,Date.now()).phase-8)<.1);
 assert.equal(c.control('dancerPlayback',{playing:true,seek:NaN}),false);assert.equal(c.control('dancerPlayback',{playing:true,seek:30}),false);
 c.control('dancerPlayback',{playing:true,restart:true});assert.ok(catalog.clock(c.dancers,Date.now()).phase<.1);
});
