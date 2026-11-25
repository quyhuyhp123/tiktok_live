"use strict";
const {test}=require("node:test");const assert=require("node:assert/strict");const {ClubState,MAX_ON_FLOOR}=require("./engine");
const event=(event,extra={})=>({event,data:{uniqueId:"alice",nickname:"Ánh <script>",...extra}});
test("only join commands enter the floor; Vietnamese commands work",()=>{
 const c=new ClubState();assert.equal(c.event(event("chat",{comment:"hello"})),false);
 c.event(event("chat",{comment:"hey"}));assert.equal(c.snapshot().users.length,1);
 const variant=c.users.get("alice").variant;c.event(event("chat",{comment:"đổi nv"}));assert.equal(c.users.get("alice").variant,(variant+1)%require('./character-catalog').count);
 c.event(event("chat",{comment:"zoom"}));assert.equal(c.focus.id,"alice");
});
test("gift streaks score once on completion, repeated message IDs are ignored",()=>{
 const c=new ClubState();const g={giftType:1,giftId:1,diamondCount:2,repeatCount:5,msgId:"x",repeatEnd:false,giftName:"Rose"};
 c.event(event("gift",g));assert.equal(c.users.size,0);
 c.event(event("gift",{...g,repeatEnd:true}));c.event(event("gift",{...g,repeatEnd:true}));
 assert.equal(c.users.get("alice").coins,10);assert.equal(c.effect.type,"rose");
});
test("nested payloads, VIP, walking gifts, follow wings, party effects",()=>{
 const c=new ClubState();c.event({event:"gift",data:{user:{uniqueId:"vip",nickname:"VIP"},gift:{name:"Finger Heart",diamond_count:5,repeat_count:2,gift_type:0}}});
 assert.equal(c.users.get("vip").coins,10);assert.equal(c.users.get("vip").vip,true);
 c.event(event("gift",{giftName:"TikTok",diamondCount:1}));assert.ok(c.users.get("alice").walkUntil>Date.now());
 c.event(event("follow"));assert.equal(c.users.get("alice").wings,true);
 c.event(event("gift",{giftName:"Galaxy",diamondCount:1000}));assert.equal(c.effect.type,"party");
});
test("floor capacity does not delete gift balances",()=>{
 const c=new ClubState();c.event(event("gift",{diamondCount:500}));c.users.get("alice").lastSeen=1;
 for(let i=0;i<MAX_ON_FLOOR;i++)c.event({event:"chat",data:{uniqueId:"u"+i,comment:"1"}});
 assert.equal(c.snapshot().users.length,MAX_ON_FLOOR);assert.equal(c.users.get("alice").onFloor,false);assert.equal(c.snapshot().top[0].coins,500);
});
test("demo cleanup and persistence preserve real coins and settings",()=>{
 const c=new ClubState();c.event(event("gift",{diamondCount:99}));c.control("demo");c.control("galaxy");assert.equal(c.snapshot().users.length,37);
 const saved=c.save();assert.equal(saved.users.length,1);c.control("clearDemo");assert.equal(c.snapshot().users.length,1);assert.equal(c.users.get("alice").coins,99);
 c.control("settings",{name:"BAR ĐÊM",theme:"rose"});const restored=new ClubState(c.save());assert.equal(restored.users.get("alice").coins,99);assert.equal(restored.settings.name,"BAR ĐÊM");assert.equal(restored.snapshot().users.length,0);
});
test("invalid values cannot poison coin totals and unknown events are ignored",()=>{
 const c=new ClubState();assert.equal(c.event(null),false);assert.equal(c.event({event:"chat",data:null}),false);assert.equal(c.event({event:"gift",data:{}}),false);
 c.event(event("gift",{diamondCount:"Infinity",repeatCount:-2}));assert.equal(c.users.get("alice").coins,1);
 assert.equal(c.control("event",event("gift")),false);
 c.event(event("like",{likeCount:20}));assert.ok(c.snapshot().heatUntil>Date.now());assert.equal(c.users.get("alice").coins,1);
});
test("HTTP server serves assets, syncs SSE, persists real settings and restricts file access",async()=>{
 const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawn}=require("node:child_process"),net=require("node:net");
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"neon-room-test-"));
 for(const file of ["server.js","engine.js","tikfinity-bridge.js","source-monitor.js","camera.js","wing-catalog.js","sword-catalog.js","character-catalog.js","dance-motion.js","dancer-catalog.js","dancer-controls.js","dancers-3d.js","dancers.css","app.js","index.html","style.css","dance-controls.css","wings.css"])fs.copyFileSync(path.join(__dirname,file),path.join(temp,file));
 fs.mkdirSync(path.join(temp,"assets"));fs.copyFileSync(path.join(__dirname,"assets","stage-dancers.png"),path.join(temp,"assets","stage-dancers.png"));fs.copyFileSync(path.join(__dirname,"assets","fantasy-wings-extra.png"),path.join(temp,"assets","fantasy-wings-extra.png"));fs.copyFileSync(path.join(__dirname,"assets","fantasy-wings.png"),path.join(temp,"assets","fantasy-wings.png"));fs.copyFileSync(path.join(__dirname,"assets","meme-heads.png"),path.join(temp,"assets","meme-heads.png"));
 fs.copyFileSync(path.join(__dirname,"assets","stage-dancers-roll.png"),path.join(temp,"assets","stage-dancers-roll.png"));
 fs.mkdirSync(path.join(temp,'assets','characters'));for(const c of require('./character-catalog').characters)if(c.asset)fs.copyFileSync(path.join(__dirname,'assets','characters',c.asset),path.join(temp,'assets','characters',c.asset));
 const isolatedUpstream=path.join(temp,'no-live-upstream.cjs');fs.writeFileSync(isolatedUpstream,'globalThis.WebSocket=class extends EventTarget{close(){}};');
 const probe=net.createServer();await new Promise(r=>probe.listen(0,"127.0.0.1",r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['--require',isolatedUpstream,path.join(temp,"server.js")],{env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"],windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("server timeout")),5000);child.stdout.once("data",()=>{clearTimeout(timer);resolve();});child.once("error",reject);});
  const root=`http://127.0.0.1:${port}`;
  for(const route of ['/','/index.html','/#tiktok.studio']){const response=await fetch(root+route,{headers:{Origin:'null'}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'*');}
  for(const route of ['/api/state','/app.js'])assert.equal((await fetch(root+route,{headers:{Origin:'null'}})).headers.get('access-control-allow-origin'),null);
  for(const route of ["/","/app.js","/camera.js","/wing-catalog.js","/style.css","/dance-controls.css","/assets/meme-heads.png","/assets/fantasy-wings.png","/assets/fantasy-wings-extra.png","/assets/stage-dancers.png","/wings.css"]){const r=await fetch(root+route);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>100);}
  const stageRoll=await fetch(root+"/assets/stage-dancers-roll.png");assert.equal(stageRoll.status,200);assert.ok((await stageRoll.arrayBuffer()).byteLength>100);
  assert.equal((await fetch(root+"/sword-catalog.js")).status,200);
  assert.equal((await fetch(root+"/character-catalog.js")).status,200);for(const c of require('./character-catalog').characters)if(c.asset)assert.equal((await fetch(root+'/assets/characters/'+c.asset)).status,200);
  for(const route of ["/server.js","/engine.js","/live-state.json","/../tiktok_live_backup/private.txt","/%ZZ"]){const r=await fetch(root+route);assert.ok([400,404].includes(r.status),route);}
  const post=(body,origin=root)=>fetch(root+"/api/control",{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(body)});
  assert.equal((await post({action:"demo"},"https://example.com")).status,403);
  assert.equal((await post({action:"demo"},"null")).status,403);
  const controller=new AbortController(),stream=await fetch(root+"/api/events",{signal:controller.signal});const reader=stream.body.getReader();
  const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/data:/);
  assert.equal((await post({action:"demo"})).status,200);
  const chunk=await reader.read();assert.match(new TextDecoder().decode(chunk.value),/demo_crowd/);controller.abort();
  let state=await (await fetch(root+"/api/state")).json();assert.equal(state.users.length,36);
  await post({action:"settings",value:{name:"TEST CLUB",theme:"emerald"}});
  await post({action:"clearDemo"});state=await (await fetch(root+"/api/state")).json();assert.equal(state.users.length,0);assert.equal(state.settings.name,"TEST CLUB");
  await new Promise(r=>setTimeout(r,900));const saved=JSON.parse(fs.readFileSync(path.join(temp,"live-state.json")));assert.equal(saved.settings.name,"TEST CLUB");assert.equal(saved.users.length,0);
 }finally{child.kill();await new Promise(r=>child.once("exit",r));fs.rmSync(temp,{recursive:true,force:true});}
});

test("dance settings persist and DROP does not change gift scores",()=>{
 const c=new ClubState();assert.equal(c.settings.bpm,148);assert.equal(c.settings.autoCamera,false);
 assert.equal(c.settings.broadcastMode,'clear');c.control('settings',{broadcastMode:'full'});assert.equal(new ClubState(c.save()).settings.broadcastMode,'full');c.control('settings',{broadcastMode:'invalid'});assert.equal(c.settings.broadcastMode,'full');
 assert.equal(c.settings.handProps,'mixed');c.control('settings',{handProps:'none'});assert.equal(new ClubState(c.save()).settings.handProps,'none');c.control('settings',{handProps:'invalid'});assert.equal(c.settings.handProps,'none');
 c.control("settings",{bpm:999,energy:999,autoCamera:false});assert.equal(c.settings.bpm,180);assert.equal(c.settings.energy,1.8);
 c.control("settings",{bpm:NaN,energy:"wrong"});assert.equal(c.settings.bpm,180);assert.equal(c.settings.energy,1.8);
 c.event(event("gift",{diamondCount:10}));c.control("drop");assert.equal(c.effect.type,"party");assert.equal(c.effect.userId,null);assert.equal(c.users.get("alice").coins,10);
 const restored=new ClubState(c.save());assert.equal(restored.settings.bpm,180);assert.equal(restored.settings.autoCamera,false);
});

test("arrival starts only when entering the floor, including returning users",()=>{
 const c=new ClubState();const u=c.ensure({uniqueId:'arrival',nickname:'New viewer'});
 c.join(u);assert.ok(u.joinedAt>0);const first=u.joinedAt;
 u.joinedAt=123;c.join(u);assert.equal(u.joinedAt,123);
 c.event({event:'follow',data:{uniqueId:'arrival'}});assert.equal(u.joinedAt,123);
 u.onFloor=false;c.join(u);assert.ok(u.joinedAt>=first);assert.equal(u.onFloor,true);
});

test("paid wings unlock at all six cumulative thresholds",()=>{
 const c=new ClubState();const give=n=>c.event(event("gift",{diamondCount:n}));
 give(29);assert.equal(c.users.get("alice").wingTier,0);
 c.event(event("follow"));c.event(event("like",{likeCount:100}));assert.equal(c.users.get("alice").wingTier,0);
 give(1);assert.equal(c.users.get("alice").wingTier,1);assert.equal(c.wingUnlock.tier,1);assert.equal(c.users.get("alice").vip,true);
 give(19);assert.equal(c.users.get("alice").wingTier,1);give(1);assert.equal(c.users.get("alice").wingTier,2);
 give(49);assert.equal(c.users.get("alice").wingTier,2);give(1);assert.equal(c.users.get("alice").wingTier,3);
 give(49);assert.equal(c.users.get("alice").wingTier,3);give(1);assert.equal(c.users.get("alice").wingTier,4);
 give(49);assert.equal(c.users.get("alice").wingTier,4);give(1);assert.equal(c.users.get("alice").wingTier,5);
 give(99);assert.equal(c.users.get("alice").wingTier,5);give(1);assert.equal(c.users.get("alice").wingTier,6);
 give(1);assert.equal(c.users.get("alice").coins,301);
 const restored=new ClubState(c.save());assert.equal(restored.users.get("alice").wingTier,6);
 const migrated=new ClubState({users:[{id:'old',coins:50}]});assert.equal(migrated.users.get('old').wingTier,2);
});
test("streaks and duplicate packets cannot grant early or duplicate wings",()=>{
 const c=new ClubState();const packet={diamondCount:1,repeatCount:30,giftType:1,msgId:'wing-streak',repeatEnd:false};
 c.event(event('gift',packet));assert.equal(c.users.size,0);
 c.event(event('gift',{...packet,repeatEnd:true}));assert.equal(c.users.get('alice').wingTier,1);
 const unlock=c.wingUnlock.id;c.event(event('gift',{...packet,repeatEnd:true}));assert.equal(c.users.get('alice').coins,30);assert.equal(c.wingUnlock.id,unlock);
 c.control('reset');assert.equal(c.wingUnlock,null);assert.equal(c.users.size,0);
 c.control('wingPreview',100);assert.equal(c.snapshot().users[0].wingTier,3);assert.equal(c.save().users.length,0);
});

test("custom simulated gifts multiply quantities and accumulate on the same demo user",()=>{
 const c=new ClubState();assert.equal(c.control('simulateGift',{coins:10,count:3,nickname:'Tester'}),true);
 const u=c.snapshot().users[0];assert.equal(u.coins,30);assert.equal(u.wingTier,1);assert.equal(u.demo,true);
 assert.equal(c.control('simulateGift',{recipientId:u.id,coins:20,count:1}),true);
 assert.equal(c.users.get(u.id).coins,50);assert.equal(c.users.get(u.id).wingTier,2);assert.equal(c.snapshot().users.length,1);
 assert.equal(c.save().users.length,0);assert.equal(c.lastLiveEvent,0);
});
test("five named candidates join by identity and receive only their own simulated gifts",()=>{
 const c=new ClubState(),choices=c.snapshot().demoCandidates;
 assert.equal(choices.length,5);assert.equal(new Set(choices.map(u=>u.id)).size,5);assert.equal(new Set(choices.map(u=>u.nickname)).size,5);
 assert.deepEqual(choices.map(u=>u.variant),[0,1,2,3,4]);assert.equal(c.users.size,0);
 const [first,second]=choices;
 assert.equal(c.control('join',{recipientId:first.id}),true);assert.equal(c.lastAddedId,first.id);
 assert.equal(c.control('join',{recipientId:first.id}),true);assert.equal(c.users.size,1);assert.equal(c.users.get(first.id).nickname,first.nickname);
 assert.equal(c.control('simulateGift',{recipientId:second.id,coins:30,count:1}),true);
 assert.equal(c.lastSimulatedId,second.id);assert.equal(c.users.size,2);assert.equal(c.users.get(second.id).variant,second.variant);
 assert.equal(c.users.get(first.id).coins,0);assert.equal(c.users.get(second.id).coins,30);
 c.control('simulateGift',{recipientId:first.id,coins:10,count:2});assert.equal(c.users.get(first.id).coins,20);assert.equal(c.users.get(second.id).coins,30);
 c.control('rose',{recipientId:second.id});assert.equal(c.users.get(second.id).coins,31);assert.equal(c.users.get(first.id).coins,20);
 assert.equal(c.save().users.length,0);assert.equal(c.lastLiveEvent,0);
});
test("clearing samples resets candidate balances and selected actions reject real or unknown viewers",()=>{
 const c=new ClubState(),candidate=c.snapshot().demoCandidates[4];c.event(event('gift',{diamondCount:77}));
 for(const action of ['join','zoom','rose','galaxy','follow'])for(const recipientId of ['alice','missing'])assert.equal(c.control(action,{recipientId}),false);
 assert.equal(c.control('simulateGift',{recipientId:'missing',coins:30,count:1}),false);assert.equal(c.users.get('alice').coins,77);
 c.control('simulateGift',{recipientId:candidate.id,coins:100,count:1});assert.equal(c.snapshot().demoCandidates[4].coins,100);
 c.control('clearDemo');assert.equal(c.snapshot().demoCandidates[4].onFloor,false);assert.equal(c.snapshot().demoCandidates[4].coins,0);
 c.control('join',{recipientId:candidate.id});assert.equal(c.users.get(candidate.id).nickname,candidate.nickname);assert.equal(c.users.get(candidate.id).variant,4);assert.equal(c.users.get('alice').coins,77);
});
test("simulation rejects real viewers, missing recipients and invalid gift amounts",()=>{
 const c=new ClubState();c.event(event('gift',{diamondCount:1}));
 assert.equal(c.control('simulateGift',{recipientId:'alice',coins:100,count:1}),false);assert.equal(c.users.get('alice').coins,1);
 assert.equal(c.control('simulateGift',{recipientId:'missing',coins:30,count:1}),false);
 for(const value of [{coins:0,count:1},{coins:-1,count:1},{coins:30.5,count:1},{coins:Infinity,count:1},{coins:10001,count:1},{coins:30,count:0},{coins:30,count:101},{coins:'30',count:1},null])assert.equal(c.control('simulateGift',value),false);
 assert.equal(c.users.size,1);
});

test('camera cycles eight presets and projects opposite sides and overhead views',()=>{
 const camera=require('./camera'),c=new ClubState();
 for(let i=0;i<8;i++){assert.equal(c.control('camera',i),true);assert.equal(c.settings.camera,i);assert.equal(c.settings.autoCamera,false);}
 c.control('camera');assert.equal(c.settings.camera,0);assert.equal(c.control('camera',99),false);
 const front={...camera.presets[0],zoom:1},rear={...camera.presets[3],zoom:1};
 assert.ok(camera.project([200,0,0],front).x>360);assert.ok(camera.project([200,0,0],rear).x<360);
 assert.ok(camera.presets[6].height>camera.presets[0].height);
 const s={camera:0,autoCamera:false,cameraChangedAt:1000};camera.select(s,6,1000);
 const mid=camera.view(s,1625),end=camera.view(s,3000);assert.ok(mid.height>front.height&&mid.height<end.height);assert.equal(end.height,camera.presets[6].height);
 c.control('settings',{cameraZoom:99});assert.equal(c.settings.cameraZoom,1.3);
 c.control('settings',{cameraZoom:0});assert.equal(c.settings.cameraZoom,.7);
});


test('fixed camera mode stays still, including legacy saved auto settings',()=>{
 const camera=require('./camera');const c=new ClubState({settings:{autoCamera:true,cameraMotion:'fixed'}});assert.equal(c.settings.autoCamera,false);assert.equal(c.settings.cameraMotion,'fixed');
 c.control('settings',{autoCamera:true});assert.equal(c.settings.autoCamera,false);
 const old={camera:2,autoCamera:true,cameraChangedAt:1000};assert.deepEqual(camera.view(old,10000),camera.view(old,100000));
 camera.select(old,6,100000);assert.notEqual(camera.view(old,100000).height,camera.view(old,102000).height);assert.deepEqual(camera.view(old,102000),camera.view(old,200000));
});

test('slow front sweep stays within 60 degrees, eases at the limits and can freeze or resume',()=>{
 const camera=require('./camera'),c=new ClubState();assert.equal(c.settings.cameraMotion,'sweep');
 const s={camera:0,cameraMotion:'sweep',cameraSweepStartedAt:1000,cameraChangedAt:1000,cameraZoom:.9};
 assert.equal(camera.sweepPeriod,240000/1.2);
 for(const [elapsed,expected] of [[0,0],[50000,Math.PI/3],[100000,0],[150000,-Math.PI/3],[200000,0]])assert.ok(Math.abs(camera.view(s,1000+elapsed).yaw-expected)<1e-10);
 let maxStep=0;
 for(let t=13000;t<481000;t+=100){const a=camera.view(s,t),b=camera.view(s,t+100);assert.ok(Math.abs(a.yaw)<=Math.PI/3+1e-10);assert.equal(a.height,camera.presets[0].height);assert.equal(a.distance,camera.presets[0].distance);assert.equal(a.zoom,.9);maxStep=Math.max(maxStep,Math.abs(b.yaw-a.yaw));}
 assert.ok(maxStep<=Math.PI/3*2*Math.PI/2000+1e-10);
 assert.ok(Math.abs(camera.view(s,51000).yaw-camera.view(s,50900).yaw)<1e-5);
 const before=camera.view(s,50000);camera.setMotion(s,'fixed',50000);assert.deepEqual(camera.view(s,50000),before);assert.deepEqual(camera.view(s,51000),camera.view(s,90000));
 camera.setMotion(s,'sweep',100000);assert.deepEqual(camera.view(s,100000),before);assert.equal(s.cameraSweepStartedAt,51000);assert.ok(camera.view(s,160000).yaw<0);
 const beforePreset=camera.view(s,160000);camera.select(s,2,160000);assert.equal(s.cameraMotion,'sweep');const selectedAt=camera.view(s,160000);assert.ok(Math.abs(selectedAt.yaw-beforePreset.yaw)<1e-12);assert.deepEqual({...selectedAt,yaw:0},{...beforePreset,yaw:0});
 assert.deepEqual(camera.view(s,162000),camera.view(s,167000));assert.equal(camera.view(s,162000).height,camera.presets[2].height);
 assert.ok(Math.abs(camera.view(s,180000).yaw)<=Math.PI/3+1e-10);assert.notDeepEqual(camera.view(s,200000),camera.view(s,210000));
 assert.ok(Math.abs(camera.view(s,179999).yaw-camera.view(s,180000).yaw)<.001);
 camera.setMotion(s,'fixed',190000);assert.equal(s.cameraOverrideUntil,undefined);assert.deepEqual(camera.view(s,192000),camera.view(s,250000));
 camera.setMotion(s,'sweep',260000);const resumedStart=s.cameraSweepStartedAt;camera.select(s,3,261000);camera.setMotion(s,'sweep',262000,true);assert.equal(s.cameraOverrideUntil,undefined);assert.equal(s.cameraSweepStartedAt,resumedStart);
 c.control('settings',{bpm:150,cameraZoom:.8});assert.equal(c.settings.cameraMotion,'sweep');
 c.control('settings',{cameraMotion:'fixed'});assert.equal(c.settings.cameraMotion,'fixed');
 assert.equal(new ClubState(c.save()).settings.cameraMotion,'fixed');
 c.control('settings',{cameraMotion:'sweep'});assert.equal(c.settings.camera,0);assert.equal(c.settings.cameraMotion,'sweep');
 c.event({event:'chat',data:{uniqueId:'camera-viewer',comment:'camera'}});assert.equal(c.settings.cameraMotion,'sweep');assert.ok(c.settings.cameraOverrideUntil>Date.now());
 c.control('settings',{cameraMotion:'sweep',restartCameraSweep:true});assert.equal(c.settings.cameraOverrideUntil,undefined);assert.equal(c.settings.camera,0);
 const restored=new ClubState(c.save()),checkTime=Date.now()+60000;assert.deepEqual(camera.view(restored.settings,checkTime),camera.view(c.settings,checkTime));
});

test('camera continues through center to the left even when resume is pressed repeatedly',()=>{
 const camera=require('./camera'),s={camera:0,cameraMotion:'sweep',cameraSweepStartedAt:1000,cameraSweepPeriod:200000,cameraChangedAt:1000};
 assert.ok(camera.view(s,100000).yaw>0);
 for(let t=100000;t<=115000;t+=1000)camera.setMotion(s,'sweep',t,true);
 assert.equal(s.cameraSweepStartedAt,1000);assert.ok(camera.view(s,115000).yaw<0);
 assert.ok(camera.view(s,101100).yaw<camera.view(s,100900).yaw);
 s.cameraOverrideUntil=100000;camera.setMotion(s,'sweep',120000,true);assert.equal(s.cameraOverrideUntil,undefined);assert.equal(s.cameraSweepStartedAt,1000);
 camera.setMotion(s,'fixed',125000);const pausedYaw=camera.view(s,127000).yaw;camera.setMotion(s,'sweep',140000);assert.equal(s.cameraSweepStartedAt,16000);assert.equal(camera.view(s,140000).yaw,pausedYaw);
 const legacy={camera:0,cameraMotion:'sweep',cameraSweepStartedAt:1000,cameraChangedAt:1000},time=91000,oldYaw=Math.sin((time-1000)/240000*Math.PI*2)*Math.PI/3;
 camera.migrateSweep(legacy,240000,time);assert.equal(legacy.cameraSweepPeriod,200000);assert.ok(Math.abs(camera.view(legacy,time).yaw-oldYaw)<1e-10);
});

test('named characters join, cycle through all twenty-one models and retain their look with VIP gifts',()=>{
 const catalog=require('./character-catalog');assert.equal(catalog.count,21);
 for(const name of catalog.characters.flatMap(c=>c.aliases||[])){
  const c=new ClubState(),character=catalog.forCommand(name);assert.equal(c.event(event('chat',{comment:name})),true);
  const u=c.users.get('alice');assert.equal(u.variant,character.id);assert.equal(u.onFloor,true);
  c.event(event('gift',{giftName:'Finger Heart',diamondCount:1}));assert.equal(u.vip,true);assert.equal(u.variant,character.id);
  c.event(event('gift',{diamondCount:50}));assert.equal(u.variant,character.id);assert.equal(c.snapshot().top[0].variant,character.id);
  assert.equal(new ClubState(c.save()).users.get('alice').variant,character.id);
 }
 const c=new ClubState();assert.equal(catalog.characters.filter(x=>x.custom).length,16);for(const character of catalog.characters.filter(x=>x.custom)){assert.equal(c.control('character',{variant:character.id}),true);assert.ok(c.snapshot().users.some(u=>u.variant===character.id&&u.demo));assert.equal(c.users.get(c.lastCharacterId).variant,character.id);}
 const real=c.ensure({uniqueId:'real',nickname:'Real viewer'});real.coins=77;const previous=real.variant;
 assert.equal(c.control('character',{variant:5,recipientId:'real'}),false);assert.equal(real.variant,previous);assert.equal(real.coins,77);
 for(const variant of [-1,catalog.count,'5',null])assert.equal(c.control('character',{variant}),false);
 const first=c.snapshot().users.find(u=>u.demo);assert.equal(c.control('character',{variant:8,recipientId:first.id}),true);assert.equal(c.users.get(first.id).variant,8);
 c.control('clearDemo');assert.equal(c.users.size,1);
});

test('Phoenix requires 300 coins and all three new styles have separate rewards',()=>{
 const catalog=require('./wing-catalog');assert.equal(catalog.tiers.length,6);
 assert.equal(catalog.definition(catalog.tierFor(100)).name,catalog.tiers[2].name);
 assert.equal(catalog.tierFor(299),5);assert.equal(catalog.tierFor(300),6);
 assert.equal(catalog.definition(6).frame,3);assert.equal(catalog.definition(6).atlas,'classic');
 assert.deepEqual([3,4,5].map(t=>catalog.definition(t).frame),[0,1,2]);
 const migrated=new ClubState({users:[{id:'old100',coins:100,wingTier:3},{id:'old300',coins:300,wingTier:3}]});
 assert.equal(migrated.users.get('old100').wingTier,3);assert.equal(migrated.users.get('old300').wingTier,6);
});

test('top-three podium identifies the highest gift totals and follows rank changes',()=>{
 const c=new ClubState();const gift=(id,coins)=>c.event({event:'gift',data:{uniqueId:id,nickname:id,diamondCount:coins}});
 gift('silver',50);gift('gold',300);gift('bronze',30);gift('fourth',20);
 assert.deepEqual(c.snapshot().top.map(u=>u.id),['gold','silver','bronze']);
 for(const winner of c.snapshot().top){assert.ok(Number.isInteger(winner.variant));assert.ok(Number.isFinite(winner.seed));assert.equal(winner.coins,c.users.get(winner.id).coins);}
 gift('fourth',400);assert.deepEqual(c.snapshot().top.map(u=>u.id),['fourth','gold','silver']);
 c.users.get('gold').onFloor=false;assert.equal(c.snapshot().top[1].id,'gold');
 const restored=new ClubState(c.save());assert.deepEqual(restored.snapshot().top.map(u=>u.id),['fourth','gold','silver']);
 c.control('reset');assert.equal(c.snapshot().top.length,0);
});

test('Rose focuses the real floor position while ordinary gifts and follows never create a hero overlay',()=>{
 const c=new ClubState();c.event(event('gift',{giftName:'TikTok',diamondCount:1}));assert.equal(c.focus,null);
 c.event(event('follow'));assert.equal(c.focus,null);c.event(event('subscribe'));assert.equal(c.focus,null);
 c.event(event('gift',{giftName:'Rose',diamondCount:1}));assert.equal(c.focus.mode,'floor');assert.equal(c.focus.id,'alice');assert.equal(c.focus.until-c.focus.startedAt,4000);
 const started=c.focus.startedAt;c.event(event('gift',{giftName:'Rose',diamondCount:1}));assert.equal(c.focus.startedAt,started);
});
test('new wing reveals last 5 seconds except Phoenix at 15 seconds and do not replay within the same tier',()=>{
 const catalog=require('./wing-catalog');
 for(const [i,seconds] of [5,5,5,5,5,15].entries()){
  const c=new ClubState(),coins=catalog.tiers[i].coins;
  c.event(event('gift',{giftName:'Gift',diamondCount:coins-1}));c.event(event('gift',{giftName:'Gift',diamondCount:1}));assert.equal(c.focus.mode,'wing');assert.equal(c.focus.until-c.focus.startedAt,seconds*1000);assert.equal(c.wingUnlock.until-c.wingUnlock.startedAt,seconds*1000);
  const previous=c.focus;c.event(event('gift',{giftName:'Rose',diamondCount:1}));assert.equal(c.focus,previous);
  c.focus.until=Date.now()-1;c.wingUnlock.until=Date.now()-1;c.event(event('gift',{giftName:'Gift',diamondCount:1}));assert.equal(c.focus,previous);assert.ok(c.focus.until<Date.now());
 }
});

test('a 50-coin gift grants an immediate 12-second sword flight and equips its earned wings',()=>{
 const c=new ClubState(),before=Date.now();c.event(event('gift',{giftName:'Sword',diamondCount:25,repeatCount:2,msgId:'sword-1'}));
 const u=c.users.get('alice'),flight={...u.swordFlight};
 assert.equal(u.coins,50);assert.equal(c.focus,null);assert.equal(c.wingUnlock,null);assert.equal(u.wingTier,2);assert.equal(u.wings,true);assert.ok(flight.startedAt>=before&&flight.startedAt<=Date.now());assert.equal(flight.until-flight.startedAt,12000);
 assert.deepEqual(c.snapshot().top[0].swordFlight,flight);
 c.event(event('gift',{giftName:'Sword',diamondCount:25,repeatCount:2,msgId:'sword-1'}));assert.equal(u.coins,50);assert.deepEqual(u.swordFlight,flight);
 assert.equal(c.save().users[0].swordFlight,undefined);assert.equal(new ClubState(c.save()).users.get('alice').swordFlight,null);
 for(const coins of [1,30,49,51,100,300]){const other=new ClubState();other.event(event('gift',{diamondCount:coins}));assert.equal(other.users.get('alice').swordFlight,undefined);}
 const streak=new ClubState();streak.event(event('gift',{giftType:1,repeatEnd:false,diamondCount:50}));assert.equal(streak.users.size,0);
 streak.event(event('gift',{giftType:1,repeatEnd:true,diamondCount:50}));assert.ok(streak.users.get('alice').swordFlight);
 c.focus=null;u.coins=300;u.swordFlight={startedAt:Date.now()-4000,until:Date.now()+1000};const start=u.swordFlight.startedAt;
 c.event(event('gift',{diamondCount:50}));assert.equal(u.swordFlight.startedAt,start);assert.ok(u.swordFlight.until>=Date.now()+11950);
 const demo=new ClubState();assert.equal(demo.control('sword'),true);assert.equal(demo.snapshot().users.length,1);assert.equal(demo.snapshot().users[0].demo,true);assert.ok(demo.snapshot().users[0].swordFlight);demo.control('clearDemo');assert.equal(demo.snapshot().users.length,0);
});

test('10, 20 and 50-coin gifts select distinct swords and queue one complete ride per gift',()=>{
 const swords=require('./sword-catalog');assert.deepEqual(swords.tiers.map(s=>s.coins),[10,20,50]);
 assert.equal(new Set(swords.tiers.map(s=>s.color)).size,3);assert.ok(swords.tiers[2].trailMs>swords.tiers[1].trailMs&&swords.tiers[1].trailMs>swords.tiers[0].trailMs);
 for(const coins of [10,20,50]){
  const c=new ClubState();c.event(event('gift',{diamondCount:coins}));const flight=c.users.get('alice').swordFlight;
  assert.equal(flight.coins,coins);assert.equal(flight.rides.length,1);assert.equal(flight.until-flight.startedAt,12000);
  assert.equal(swords.rideAt(flight,flight.startedAt+6000).coins,coins);assert.equal(swords.rideAt(flight,flight.until),null);
  const demo=new ClubState();assert.equal(demo.control('sword',coins),true);assert.equal(demo.snapshot().users[0].swordFlight.coins,coins);
 }
 const c=new ClubState();c.event(event('gift',{diamondCount:10,msgId:'ride-a'}));const firstRide={...c.users.get('alice').swordFlight.rides[0]};c.event(event('gift',{diamondCount:20,msgId:'ride-b'}));
 const rides=c.users.get('alice').swordFlight.rides;assert.equal(rides.length,2);assert.equal(rides[0].coins,10);assert.equal(rides[1].coins,20);assert.ok(rides[1].startedAt>=rides[0].until);assert.equal(rides[1].until-rides[1].startedAt,12000);
 assert.equal(rides[0].startedAt,firstRide.startedAt);assert.equal(rides[0].until,firstRide.until);assert.equal(c.users.get('alice').wingTier,1);assert.equal(c.focus,null);
 c.event(event('gift',{diamondCount:20,msgId:'ride-b'}));assert.equal(c.users.get('alice').swordFlight.rides.length,2);
 c.control('reset');assert.equal(c.users.size,0);assert.equal(new ClubState().control('sword',30),false);
});
test('swords skip or dismiss their own wing reveal while ordinary gifts and explicit wing previews still reveal',()=>{
 for(const [balance,coins,tier] of [[0,50,2],[29,10,1],[90,20,3],[290,10,6]]){
  const c=new ClubState();if(balance)c.event(event('gift',{diamondCount:balance}));
  c.event(event('gift',{diamondCount:coins}));const u=c.users.get('alice');
  assert.equal(u.coins,balance+coins);assert.equal(u.wingTier,tier);assert.equal(u.wings,true);assert.equal(u.vip,true);assert.equal(c.focus,null);assert.equal(c.wingUnlock,null);
  assert.ok(require('./sword-catalog').rideAt(u.swordFlight,Date.now()));
 }
 const c=new ClubState();c.event(event('gift',{diamondCount:29}));c.event(event('gift',{diamondCount:10}));c.event(event('gift',{diamondCount:11}));assert.equal(c.focus.mode,'wing');assert.equal(c.wingUnlock.tier,2);
 const preview=new ClubState();preview.control('wingPreview',50);assert.equal(preview.focus.mode,'wing');assert.equal(preview.wingUnlock.tier,2);assert.equal(preview.focus.until-preview.focus.startedAt,5000);
 const other=new ClubState();other.event(event('gift',{uniqueId:'other',diamondCount:300}));const reveal=other.focus;other.event(event('gift',{diamondCount:50}));assert.equal(other.focus,reveal);assert.equal(other.wingUnlock.userId,'other');
});
test('all sword buttons reward the selected identity, keep its name and never touch other viewers',()=>{
 const c=new ClubState(),[first,second]=c.snapshot().demoCandidates;
 c.control('join',{recipientId:first.id});
 for(const coins of [10,20,50]){
  assert.equal(c.control('sword',{coins,recipientId:first.id}),true);assert.equal(c.lastSwordId,first.id);
  assert.equal(c.users.size,1);assert.equal(c.users.get(first.id).nickname,first.nickname);
  assert.equal(c.users.get(first.id).swordFlight.rides.at(-1).coins,coins);
 }
 assert.equal(c.users.get(first.id).coins,80);assert.equal(c.users.get(first.id).swordFlight.rides.length,3);
 assert.equal(c.control('sword',{coins:20,recipientId:second.id}),true);assert.equal(c.users.size,2);
 assert.equal(c.users.get(second.id).nickname,second.nickname);assert.equal(c.users.get(second.id).variant,second.variant);
 assert.equal(c.users.get(second.id).coins,20);assert.equal(c.users.get(first.id).coins,80);
 c.event(event('gift',{diamondCount:77}));
 for(const value of [{coins:50,recipientId:'alice'},{coins:50,recipientId:'missing'},{coins:30,recipientId:first.id},{coins:'10',recipientId:first.id},{coins:10}])assert.equal(c.control('sword',value),false);
 assert.equal(c.users.size,3);assert.equal(c.users.get('alice').coins,77);assert.equal(c.users.get(first.id).coins,80);
 assert.equal(c.save().users.length,1);
});
