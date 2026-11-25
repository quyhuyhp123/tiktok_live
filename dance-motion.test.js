"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),motion=require('./dance-motion'),catalog=require('./character-catalog');
const settings={bpm:120,energy:1.35};
const geometry=p=>[p.hip,p.bounce,p.sway,p.tilt,p.turn,...p.leftArm.flat(),...p.rightArm.flat(),...p.legs.flat(2)];
test('all characters have finite bounded movement, with asynchronous freestyle phrases',()=>{
 for(const character of catalog.characters)for(let t=0;t<36;t+=.17){const values=geometry(motion.pose({variant:character.id,seed:17.3},t,settings));assert.ok(values.every(v=>Number.isFinite(v)&&Math.abs(v)<250));}
 const modes=new Set();for(let t=0;t<70;t+=.5)modes.add(motion.pose({variant:0,seed:0},t,settings).mode);
 for(const mode of [11,12,13,14,15,16,17,18,19,20])assert.ok(modes.has(mode));
 const a=motion.pose({variant:0,seed:1},8,settings),b=motion.pose({variant:0,seed:5},8,settings);assert.notDeepEqual(a.leftArm,b.leftArm);
});
test('new meme choreography moves arms and feet and keeps each named dance distinct',()=>{
 const modes=[];
 for(const name of ['nam xanh','nam hong','nam meme']){
  const character=catalog.forCommand(name),u={variant:character.id,seed:0},frames=Array.from({length:16},(_,i)=>motion.pose(u,i/16,settings));
  modes.push(frames[0].mode);assert.ok(new Set(frames.map(p=>JSON.stringify(p.leftArm))).size>8);assert.ok(new Set(frames.map(p=>JSON.stringify(p.legs))).size>8);
 }
 assert.deepEqual(modes,[11,12,14]);
 const cross=catalog.forCommand('nam hong').id,left=motion.pose({variant:cross,seed:0},.125,settings),right=motion.pose({variant:cross,seed:0},.375,settings);
 assert.ok(left.legs[0][2][0]>0);assert.ok(right.legs[1][2][0]<0);
});
test('freestyle changes blend continuously across a phrase boundary',()=>{
 const u={variant:0,seed:0},before=geometry(motion.pose(u,3.999,settings)),after=geometry(motion.pose(u,4.001,settings));
 assert.ok(Math.max(...before.map((v,i)=>Math.abs(v-after[i])))<2);
});
test('Neuvillette and Zhongli use distinct energetic combos with smooth transitions',()=>{
 const modes=[];
 for(const key of ['neuvillette','zhongli']){
  const u={variant:catalog.forCommand(key).id,seed:0},frames=Array.from({length:240},(_,i)=>motion.pose(u,i/40,settings));
  const seen=[...new Set(frames.map(p=>p.mode))];assert.equal(seen.length,3);modes.push(seen);
  assert.ok(Math.min(...frames.map(p=>p.bounce))<-24);assert.ok(Math.max(...frames.map(p=>p.hip))-Math.min(...frames.map(p=>p.hip))>40);
  for(const time of [2,4,6]){const a=geometry(motion.pose(u,time-.0001,settings)),b=geometry(motion.pose(u,time+.0001,settings));assert.ok(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<.5);}
 }
 assert.notDeepEqual(modes[0],modes[1]);
});
test('four new meme outfits have separate full-body dances and persistent character IDs',()=>{
 const ids=[],modes=[];
 for(const name of ['gau dai ca','gau cuoi dien','gau mit uot','nam bao']){
  const c=catalog.forCommand(name);ids.push(c.id);assert.ok(c.meme&&c.canvas&&Number.isInteger(c.headFrame));
  const frames=Array.from({length:40},(_,i)=>motion.pose({variant:c.id,seed:0},i/40,settings));modes.push(frames[0].mode);
  assert.ok(new Set(frames.map(p=>JSON.stringify(p.leftArm))).size>20);assert.ok(new Set(frames.map(p=>JSON.stringify(p.legs))).size>20);
  assert.ok(Math.min(...frames.map(p=>p.bounce))<-20);
 }
 assert.deepEqual(ids,[17,18,19,20]);assert.equal(new Set(modes).size,4);
});
test('hand props are stable and optional, and sword riders balance without props',()=>{
 const people=Array.from({length:100},(_,i)=>({variant:i%5,seed:i*1.7})),count=people.filter(u=>motion.hasBatons(u)).length;
 assert.ok(count>0&&count<50);
 for(const u of people){assert.equal(motion.hasBatons(u,'none'),false);assert.equal(motion.hasBatons(u,'all'),true);assert.equal(motion.hasBatons({...u}),motion.hasBatons(u));assert.equal(motion.hasBatons({...u,riding:true},'all'),false);}
 for(const character of catalog.characters.filter(c=>c.dance))assert.equal(motion.hasBatons({variant:character.id,seed:0}),false);
});
test('Klee keeps playful movement and riders bypass dance jumps and signatures',()=>{
 for(let t=0;t<80;t+=.11){const p=motion.pose({variant:6,seed:2},t,settings);assert.equal(p.hip,0);assert.notEqual(p.mode,5);}
 for(const character of catalog.characters){const p=motion.pose({variant:character.id,seed:0,riding:true},.2,settings);assert.equal(p.bounce,0);assert.equal(p.mode,0);}
});
