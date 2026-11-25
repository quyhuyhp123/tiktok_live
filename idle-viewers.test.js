"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ClubState,IDLE_TIMEOUT_MS}=require('./engine'),{decodePacket}=require('./tikfinity-bridge');
const chat=(id,comment='hey')=>({event:'chat',data:{uniqueId:id,nickname:id,comment}});

test('real avatars leave the floor at five idle minutes without losing coins, wings or leaderboard rank',()=>{
 const c=new ClubState();c.event({event:'gift',data:{uniqueId:'donor',nickname:'Donor',diamondCount:31}});
 const u=c.users.get('donor'),time=Date.now();u.lastSeen=time;const variant=u.variant;
 assert.equal(c.pruneIdle(time+IDLE_TIMEOUT_MS-1),0);assert.equal(c.pruneIdle(time+IDLE_TIMEOUT_MS),1);
 assert.equal(c.snapshot().users.length,0);assert.equal(u.coins,31);assert.equal(u.wingTier,1);assert.equal(u.wings,true);assert.equal(u.swordFlight,null);assert.equal(c.focus,null);assert.equal(c.wingUnlock,null);
 assert.equal(c.snapshot().top[0].id,'donor');assert.equal(c.snapshot().top[0].onFloor,false);
 c.event(chat('donor'));assert.equal(u.onFloor,true);assert.equal(u.coins,31);assert.equal(u.variant,variant);
 assert.equal(c.pruneIdle(Date.now()+1000),0);
});
test('ordinary chat and presence refresh known viewers without adding unknown avatars or awarding points',()=>{
 const c=new ClubState();c.event(chat('viewer'));const u=c.users.get('viewer'),score=u.score;
 u.lastSeen=1;assert.equal(c.event(chat('viewer','hello everyone')),false);assert.ok(u.lastSeen>1);assert.equal(u.score,score);
 u.lastSeen=1;c.event(decodePacket({event:'member',data:{uniqueId:'viewer'}}));assert.ok(u.lastSeen>1);
 u.lastSeen=1;c.event(decodePacket({event:'roomUser',data:{topViewers:[{user:{uniqueId:'viewer'}},null,{user:{uniqueId:'stranger'}}]}}));assert.ok(u.lastSeen>1);assert.equal(c.users.size,1);
 c.event(chat('unknown','hello'));assert.equal(c.users.size,1);assert.equal(c.touchPresence(null),false);
});
test('cleanup does not remove test avatars or the five resident 3D dancers',()=>{
 const c=new ClubState();c.control('demo');for(const u of c.users.values())u.lastSeen=0;
 const config=c.dancers;assert.equal(c.pruneIdle(Date.now()+IDLE_TIMEOUT_MS),0);assert.equal(c.snapshot().users.length,36);assert.equal(c.dancers,config);assert.equal(c.dancers.enabled,true);
});
test('expired viewers remain absent until they use a join command or another supported action',()=>{
 const c=new ClubState();c.event(chat('viewer'));const u=c.users.get('viewer');u.lastSeen=0;c.pruneIdle();assert.equal(u.onFloor,false);
 c.event(chat('viewer','just watching'));assert.equal(u.onFloor,false);
 c.event({event:'like',data:{uniqueId:'viewer',likeCount:1}});assert.equal(u.onFloor,false);
 c.event({event:'gift',data:{uniqueId:'viewer',diamondCount:1}});assert.equal(u.onFloor,true);
});
test('the cleanup toggle persists and can retain inactive avatars when silent viewers should stay',()=>{
 const c=new ClubState();c.event(chat('viewer'));c.users.get('viewer').lastSeen=0;
 assert.equal(c.control('settings',{idleCleanup:false}),true);assert.equal(c.pruneIdle(),0);assert.equal(c.users.get('viewer').onFloor,true);assert.equal(new ClubState(c.save()).settings.idleCleanup,false);
 c.control('settings',{idleCleanup:true});assert.equal(c.pruneIdle(),1);
});
