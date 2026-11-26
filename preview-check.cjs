// Headless visual smoke check of our local app. No user browser/profile is accessed.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const APP_ORIGIN=process.env.APP_ORIGIN||'http://127.0.0.1:8080';
const PREVIEW_DIR=process.env.PREVIEW_OUTPUT_DIR||__dirname;fs.mkdirSync(PREVIEW_DIR,{recursive:true});
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'neon-preview-'));
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const child=spawn(chrome,['--headless','--no-sandbox','--mute-audio',...(process.env.QA_USE_GPU==='1'?[]:['--disable-gpu']),'--no-first-run','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=${temp}`,'about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
  let targets;for(let i=0;i<50;i++){try{targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();break;}catch{await new Promise(r=>setTimeout(r,100));}}
  if(!targets)throw Error('Headless browser did not start');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let serial=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async(expression,timeout=3000)=>{const until=Date.now()+timeout;do{if(await evaluate(expression))return true;await new Promise(r=>setTimeout(r,100));}while(Date.now()<until);return !!await evaluate(expression);};
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:APP_ORIGIN+'/#tiktok.studio'});await new Promise(r=>setTimeout(r,1600));
  const studioXhr=await evaluate(`(async()=>{const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.style.display='none';const result=await new Promise(resolve=>{const timeout=setTimeout(()=>finish({status:0,timeout:true}),3500);function finish(result){clearTimeout(timeout);window.removeEventListener('message',onMessage);resolve(result)}function onMessage(event){if(event.source===frame.contentWindow&&event.data?.type==='studio-source-probe')finish({status:event.data.status,origin:event.origin})}window.addEventListener('message',onMessage);frame.srcdoc='<script>const r=new XMLHttpRequest();r.open("GET",'+JSON.stringify(location.origin+'/#tiktok.studio')+');r.onload=()=>parent.postMessage({type:"studio-source-probe",status:r.status},"*");r.onerror=()=>parent.postMessage({type:"studio-source-probe",status:0},"*");r.send();<'+ '/script>';document.body.append(frame)});frame.remove();return result})()`);
  if(studioXhr.status!==200||studioXhr.origin!=='null')throw Error('Studio-style cross-origin source check failed: '+JSON.stringify(studioXhr));
  await evaluate('memeHeads.decode()');
  await evaluate('fantasyWings.decode()');
  await evaluate('extraWings.decode()');
  await evaluate('stageDancers.decode()');
  await evaluate('stageDancersRoll.decode()');
  await evaluate('Promise.all([...characterArt.values()].map(atlas=>atlas.decode()))');
  if(process.env.PROFILE_STAGE==='1'){
   if(!await waitFor('globalThis.Dancer3D?.ready||globalThis.Dancer3D?.error',60000))throw Error('Models did not load for profiling');
   const results=await evaluate(`(async()=>{
    if(Dancer3D.error)throw Error(Dancer3D.error);const native=window.requestAnimationFrame,saved={users:state.users,top:state.top,focus:state.focus,settings:state.settings},offset=clockOffset;window.requestAnimationFrame=fn=>fn===render?0:native.call(window,fn);
    await new Promise(r=>native.call(window,()=>native.call(window,r)));const results=[];
    try{state.top=[];state.focus=null;state.settings={...state.settings,camera:0,cameraMotion:'fixed',cameraFrom:undefined,cameraChangedAt:now()-10000,cameraYaw:0};
     for(const count of [0,36,120]){state.users=Array.from({length:count},(_,i)=>({id:'profile-'+i,nickname:'Viewer '+i,variant:i%CharacterCatalog.count,seed:i*7,joinedAt:now()-10000,coins:0}));const cpu=[],intervals=[];let last;for(let frame=0;frame<22;frame++){const at=await new Promise(r=>native.call(window,r));if(last)intervals.push(at-last);last=at;const start=performance.now();lastFrame=start-100;render(start);cpu.push(performance.now()-start);}cpu.sort((a,b)=>a-b);intervals.sort((a,b)=>a-b);results.push({count,cpuMedian:+cpu[Math.floor(cpu.length/2)].toFixed(2),cpuP95:+cpu[Math.floor(cpu.length*.95)].toFixed(2),intervalMedian:+intervals[Math.floor(intervals.length/2)].toFixed(2)});}
     return results;
    }finally{Object.assign(state,saved);clockOffset=offset;window.requestAnimationFrame=native;native.call(window,render);}
   })()`);
   console.log(JSON.stringify({profile:results,jsErrors:errors},null,2));return;
  }
  if(process.env.CHECK_3D_DANCERS==='1'){
   if(!await waitFor('globalThis.Dancer3D?.ready||globalThis.Dancer3D?.error',60000))throw Error('3D loading timed out');
   const ready=await evaluate('({ready:Dancer3D.ready,error:Dancer3D.error,loaded:Dancer3D.loaded,diagnostics:Dancer3D.diagnostics.map(({id,autoRig,bones,footHeight})=>({id,autoRig,bones,footHeight}))})');
   if(!ready.ready)throw Error(JSON.stringify(ready));
   if(!await evaluate('Dancer3D.actors.every(a=>a.handRange.max-a.handRange.min>80)'))throw Error('A dancer did not perform wide overhead-to-hip gestures across the full cycle');
   if(!await evaluate('Dancer3D.choreography==="club-8count-1"'))throw Error('The browser loaded outdated dancer choreography');
   const presetNotes=await evaluate('({ids:state.dancers.gifts.map(g=>g.giftId),names:state.dancers.gifts.map(g=>g.name),note:document.getElementById("dancerGiftNoteList").textContent})');
   if(JSON.stringify(presetNotes.ids)!==JSON.stringify(['5487','7412','8635','10961','19445'])||!presetNotes.names.every(name=>presetNotes.note.includes(name)))throw Error('Default five-coin gifts did not appear in the LIVE notes');
   const result=await evaluate(`(()=>{
    const saved={users:state.users,top:state.top,focus:state.focus,settings:state.settings,dancers:state.dancers},sheet=document.createElement('canvas');sheet.width=1080;sheet.height=1280;const out=sheet.getContext('2d'),hands=[],legs=[];
    try{state.users=[];state.top=[];state.focus=null;state.settings={...saved.settings,camera:0,cameraMotion:'fixed',cameraFrom:undefined,cameraChangedAt:now()-10000,cameraZoom:1};
     for(const [index,time] of [1,6,12,18,26.55,27.2].entries()){
      state.dancers={...saved.dancers,pausedAt:null,startedAt:now()-time*1000};render(lastFrame+100);
      hands.push(Dancer3D.actors.map(a=>({id:a.model.id,hands:a.hands})));legs.push(...Dancer3D.inspectLegs());out.drawImage(canvas,index%3*360,Math.floor(index/3)*640,360,640);out.fillStyle='#fff';out.font='14px Arial';out.fillText(time+'s',index%3*360+12,Math.floor(index/3)*640+25);
     }
     const pixels=Dancer3D.canvas.getContext('webgl2').drawingBufferWidth;
     return {sheet:sheet.toDataURL('image/png').split(',')[1],atlas:Dancer3D.canvas.toDataURL('image/png').split(',')[1],hands,legs,frames:Dancer3D.frames,width:pixels,notes:document.querySelectorAll('#dancerGiftNoteList li').length};
    }finally{Object.assign(state,saved);}
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-3d-dancers.png'),Buffer.from(result.sheet,'base64'));fs.writeFileSync(path.join(PREVIEW_DIR,'preview-3d-atlas.png'),Buffer.from(result.atlas,'base64'));delete result.sheet;delete result.atlas;
   for(let actor=0;actor<5;actor++){
    const origin=result.hands[0][actor].hands,delta=Math.max(...result.hands.slice(1).flatMap(frame=>frame[actor].hands.map((p,side)=>Math.hypot(...p.map((n,i)=>n-origin[side][i])))));
    if(delta<20)throw Error('A model did not move its hands: '+result.hands[0][actor].id);
    const heights=result.hands.flatMap(frame=>frame[actor].hands.map(p=>p[1]));
    if(Math.max(...heights)-Math.min(...heights)<50)throw Error('Dancer hands stayed in a narrow forward pose: '+result.hands[0][actor].id+' '+JSON.stringify(heights));
   }
   delete result.hands;
   const soleSkin=await evaluate(`(()=>{const entry=Dancer3D.actors.find(a=>a.model.id==='childe');let samples=0,minWeight=1;entry.root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,ankles=new Set(mesh.skeleton.bones.flatMap((bone,i)=>/Auto_(left|right)Ankle/.test(bone.name)?[i]:[]));for(let i=0;i<g.attributes.position.count;i++)if(g.attributes.position.getY(i)<DancerCatalog.height*.06){let weight=0;for(let j=0;j<4;j++)if(ankles.has(g.attributes.skinIndex.array[i*4+j]))weight+=g.attributes.skinWeight.array[i*4+j];samples++;minWeight=Math.min(minWeight,weight)}});return {samples,minWeight}})()`);
   if(soleSkin.samples<50||soleSkin.minWeight<.99)throw Error('Childe soles are still bound to the calf: '+JSON.stringify(soleSkin));
   const badLeg=result.legs.find(p=>!Number.isFinite(p.ground+p.knee+p.tilt)||p.ground< -1.25||p.knee>115||p.tilt>4);
   if(badLeg)throw Error('Unstable model leg: '+JSON.stringify(badLeg));
   result.legCheck={samples:result.legs.length,minGround:+Math.min(...result.legs.map(p=>p.ground)).toFixed(3),maxKnee:+Math.max(...result.legs.map(p=>p.knee)).toFixed(2),maxFootTilt:+Math.max(...result.legs.map(p=>p.tilt)).toFixed(2),soleSkin};delete result.legs;
   const media=await fetch(APP_ORIGIN+'/assets/dance/reference-402b.mp3',{headers:{Range:'bytes=0-99'}});if(media.status!==206||(await media.arrayBuffer()).byteLength!==100)throw Error('Dance audio seeking failed');
   await call('Page.navigate',{url:APP_ORIGIN+'/?control=1'});
   if(!await waitFor('typeof state!=="undefined"&&state.features?.dancers3D&&globalThis.Dancer3D?.ready',60000))throw Error('Control did not load its models');
   await evaluate('document.getElementById("idleCleanup").checked=false;document.getElementById("idleCleanup").dispatchEvent(new Event("change"))');
   if(!await waitFor('state.settings.idleCleanup===false'))throw Error('Idle cleanup could not be disabled');
   await evaluate('document.getElementById("idleCleanup").checked=true;document.getElementById("idleCleanup").dispatchEvent(new Event("change"))');
   if(!await waitFor('state.settings.idleCleanup===true'))throw Error('Idle cleanup could not be enabled');
   await evaluate(`(()=>{const fields=[...document.querySelectorAll('.dancer-gift-field')];if(fields.length!==5)throw Error('Five gift fields missing');fields.forEach((row,i)=>{const inputs=row.querySelectorAll('input');inputs[0].value='QA Gift '+(i+1);inputs[1].value=String(9001+i);inputs[0].dispatchEvent(new Event('input',{bubbles:true}))});document.getElementById('dancerGiftForm').requestSubmit()})()`);
   if(!await waitFor('state.dancers.gifts[4].giftId==="9005"&&document.getElementById("dancerGiftNoteList").textContent.includes("QA Gift 5")'))throw Error('Dancer gift form or LIVE notes did not update');
   await evaluate('document.querySelectorAll(".dancer-gift-field button")[2].click()');
   if(!await waitFor('state.dancers.focus?.slot===3'))throw Error('Dancer test selected the wrong slot');
   const camera=await evaluate(`(()=>{const time=state.dancers.focus.startedAt+1500,point=DancerCatalog.formation(state.dancers,time).find(p=>p.slot===3),base=frameStageCamera(ClubCamera.view(state.settings,time)),pose=dancerCamera(base,state,time);return {x:ClubCamera.project([point.x,point.y,point.z],pose).x,zoom:pose.distance/base.distance}})()`);
   if(Math.abs(camera.x-360)>1||camera.zoom>.7)throw Error('Dancer gift did not zoom the current slot');
   const frontViews=await evaluate(`(()=>{const time=now(),positions=DancerCatalog.formation(state.dancers,time);let checked=0;for(const preset of ClubCamera.presets)for(let slot=1;slot<=5;slot++){
    const base=frameStageCamera({...preset,zoom:1,targetX:0,targetY:55,targetZ:450}),wideSnapshot={...state,focus:null,dancers:{...state.dancers,focus:{slot,startedAt:time-1500,until:time+3500}}},widePose=dancerCamera(base,wideSnapshot,time),snapshot={...state,focus:null,dancers:{...state.dancers,focus:{slot,startedAt:time-3800,until:time+1200}}},pose=dancerCamera(base,snapshot,time),point=positions.find(p=>p.slot===slot),head=ClubCamera.project([point.x,point.y+DancerCatalog.height,point.z],pose),feet=ClubCamera.project([point.x,point.y,point.z],pose);
    const waist=ClubCamera.project([point.x,point.y+DancerCatalog.height*.5,point.z],pose);
    // The focus opens on the full body (floor uplight visible) before pushing in to the face.
    const wideHead=ClubCamera.project([point.x,point.y+DancerCatalog.height,point.z],widePose),wideFeet=ClubCamera.project([point.x,point.y,point.z],widePose);
    if(Math.abs(wideHead.x-360)>.01||wideHead.y<30||wideFeet.y>1240)throw Error('Dancer camera did not open on the full body: '+JSON.stringify({preset:preset.name,slot,widePose,wideHead,wideFeet}));
    if(Math.abs(Math.atan2(Math.sin(pose.yaw),Math.cos(pose.yaw)))>.001||pose.targetZ+Math.cos(pose.yaw)*pose.distance<=point.z||Math.abs(pose.height-pose.targetY)>50||Math.abs(head.x-360)>.01||head.y<30||head.y>250||waist.y<800||waist.y>1100||feet.y<1280)throw Error('Dancer camera did not frame the upper body from the front: '+JSON.stringify({preset:preset.name,slot,pose,head,waist,feet}));
    const first={...snapshot,dancers:{...snapshot.dancers,focus:{slot,startedAt:time,until:time+5000}}},start=dancerCamera(base,first,time);if(Math.abs(start.distance-base.distance)>.001||Math.abs(start.height-base.height)>.001)throw Error('Dancer camera jumped at the start');
    first.dancers.focus.until=time;if(dancerCamera(base,first,time)!==base)throw Error('Dancer camera did not return after focus');checked++;
   }return {checked}})()`);
   const portraits=await evaluate(`(()=>{const saved=state.dancers,sheet=document.createElement('canvas');sheet.width=1080;sheet.height=1280;const c=sheet.getContext('2d'),time=now();let width=0;try{for(let slot=1;slot<=5;slot++){state.dancers={...saved,focus:{slot,startedAt:time-1500,until:time+3500}};render(lastFrame+100);width=Dancer3D.canvas.width;c.drawImage(canvas,(slot-1)%3*360,Math.floor((slot-1)/3)*640,360,640);}return {image:sheet.toDataURL('image/png').split(',')[1],width};}finally{state.dancers=saved;}})()`);
   if(portraits.width!==5120)throw Error('Portrait rendering did not use high resolution');fs.writeFileSync(path.join(PREVIEW_DIR,'preview-dancer-portraits.png'),Buffer.from(portraits.image,'base64'));
   await call('Runtime.evaluate',{expression:'document.getElementById("btnDancerStart").click()',userGesture:true});
   if(!await waitFor('!document.getElementById("dancerMusic").paused&&state.dancers.pausedAt===null'))throw Error('Dance audio did not play');
   await evaluate('document.getElementById("dancerMusic").pause()');
   if(!await waitFor('state.dancers.pausedAt!==null'))throw Error('Dance audio pause did not pause the shared choreography');
   if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({...ready,...result,camera,frontViews,media:true,giftForm:true,music:true,jsErrors:errors.length},null,2));return;
  }
  if(process.env.RECORD_TOP_CRESTS==='1'){
   const png=await evaluate(`(()=>{
    const saved={users:state.users,top:state.top,focus:state.focus},sheet=document.createElement('canvas');sheet.width=1200;sheet.height=1120;const out=sheet.getContext('2d'),t=now()/1000;
    try{state.users=[];state.focus=null;state.top=[12500,8600,4200].map((coins,rank)=>({id:'crest-'+rank,nickname:['Top One','Top Two','Top Three'][rank],variant:[11,12,20][rank],seed:rank*3,coins,joinedAt:now()-10000}));
     for(const [index,angle] of [-60,0,60].entries()){
      const frame=document.createElement('canvas');frame.width=720;frame.height=1280;const c=frame.getContext('2d'),pose=frameStageCamera({yaw:angle*Math.PI/180,height:1480,distance:2550,zoom:1,targetX:0,targetY:55,targetZ:450});const objects=drawWorldScene(c,pose,t,false);objects.sort((a,b)=>b.depth-a.depth).forEach(o=>o.draw());out.drawImage(frame,0,0,720,1050,index*400,0,400,700);
     }
     out.fillStyle='#091020';out.fillRect(0,700,1200,420);for(let rank=0;rank<3;rank++)topCrest(out,200+rank*400,900,2,rank,t,state.top[rank].coins);
     return sheet.toDataURL('image/png').split(',')[1];
    }finally{Object.assign(state,saved);}
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-top-crests.png'),Buffer.from(png,'base64'));
  }
  if(process.env.CHECK_SWORD_CAMERA==='1'){
   const result=await evaluate(`(()=>{
    const saved={users:state.users,top:state.top,focus:state.focus},previousTarget=swordCameraTarget,checks=[];
    const base=frameStageCamera({yaw:Math.PI/4,height:1480,distance:2550,zoom:1,targetX:0,targetY:55,targetZ:450}),start=now();
    const make=(id,coins,at=start)=>({id,nickname:id,variant:11,seed:7,coins,swordFlight:{rides:[{coins,startedAt:at,until:at+12000}]}});
    const sheet=document.createElement('canvas');sheet.width=1080;sheet.height=1280;const out=sheet.getContext('2d');
    try{
     for(const top of [false,true])for(const [index,coins] of [10,20,50].entries()){
      const u=make('rider-'+coins,coins),snapshot={users:top?[]:[u],top:top?[u]:[],focus:null},anchor=top?PODIUMS[0]:{x:-850,y:0,z:1550};
      const positions=time=>top?[]:[{u,base:anchor,...swordPosition(u,anchor,time)}];swordCameraTarget=null;
      if(JSON.stringify(swordCamera(base,snapshot,start,positions(start)))!==JSON.stringify(base))throw Error('Flight zoom jumped at takeoff');
      for(const offset of [2000,4500,8000,10800]){const time=start+offset,pose=swordCamera(base,snapshot,time,positions(time)),p=swordPosition(u,anchor,time),projected=ClubCamera.project([p.x,p.y,p.z],pose);if(Math.abs(projected.x-360)>.001||pose.distance>=base.distance*.7)throw Error('Camera lost the rider');}
      const landing=swordCamera(base,snapshot,start+11999,positions(start+11999));if(Math.abs(landing.distance-base.distance)>.01)throw Error('Flight camera did not ease back');
      if(JSON.stringify(swordCamera(base,snapshot,start+12000,positions(start+12000)))!==JSON.stringify(base))throw Error('Flight camera remained active after landing');
      swordCameraTarget=null;swordCamera(base,snapshot,start,positions(start));const time=start+6000,pose=swordCamera(base,snapshot,time,positions(time)),world={u,base:anchor,...swordPosition(u,anchor,time)},frame=document.createElement('canvas');frame.width=720;frame.height=1280;const c=frame.getContext('2d');Object.assign(state,{users:snapshot.users,top:snapshot.top,focus:null});const objects=drawWorldScene(c,pose,time/1000,false);objects.push({depth:ClubCamera.project([world.x,world.y,world.z],pose).depth,draw:()=>drawSwordRider(c,pose,u,world,time/1000)});objects.sort((a,b)=>b.depth-a.depth).forEach(o=>o.draw());out.drawImage(frame,index*360,top?640:0,360,640);
      out.fillStyle='#fff';out.font='15px Arial';out.fillText(coins+' coins / '+(top?'TOP':'floor'),index*360+10,(top?640:0)+25);checks.push({coins,top,tracked:true});
     }
     const a=make('a',10),b=make('b',20,start+1000),snapshot={users:[b,a],top:[],focus:null},positions=time=>snapshot.users.map(u=>({u,base:{x:-850,y:0,z:1550},...swordPosition(u,{x:-850,y:0,z:1550},time)}));
     swordCameraTarget=null;swordCamera(base,snapshot,start+2000,positions(start+2000));if(swordCameraTarget.key!=='a:'+start)throw Error('Concurrent flights switched priority');
     swordCamera(base,snapshot,start+12000,positions(start+12000));if(swordCameraTarget.key!=='b:'+(start+1000))throw Error('The next active rider was not selected');
     for(const mode of ['wing','floor']){snapshot.focus={id:'other',mode,until:start+20000};if(swordCamera(base,snapshot,start+3000,positions(start+3000))!==base)throw Error('Flight interrupted an explicit reveal');}
     snapshot.focus=null;snapshot.users=[make('queued',50,start+5000)];if(swordCamera(base,snapshot,start,[])!==base)throw Error('Queued flight zoomed before takeoff');
     return {checks,concurrent:true,priority:true,queued:true,png:sheet.toDataURL('image/png').split(',')[1]};
    }finally{Object.assign(state,saved);swordCameraTarget=previousTarget;}
   })()`);
   const output=path.join(os.tmpdir(),'neon-sword-camera-check.png');fs.writeFileSync(output,Buffer.from(result.png,'base64'));delete result.png;if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({...result,output,jsErrors:errors.length},null,2));return;
  }
  if(process.env.RECORD_RAVE_DANCES==='1'){
   const result=await evaluate(`(()=>{
    const keys=['neuvillette','zhongli','gau dai ca','gau cuoi dien','gau mit uot','nam bao'],times=[.15,.55,4.35,8.75],sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1400;const g=sheet.getContext('2d'),changes=[];
    g.fillStyle='#091020';g.fillRect(0,0,sheet.width,sheet.height);
    for(const [i,key] of keys.entries()){
     const character=CharacterCatalog.forCommand(key),signatures=[];
     for(const [row,beats] of times.entries()){
      const frame=document.createElement('canvas');frame.width=300;frame.height=310;const c=frame.getContext('2d');
      dancer(c,150,260,1.1,{variant:character.id,seed:0,nickname:'',coins:0},beats*60/state.settings.bpm,false);
      signatures.push(frame.toDataURL());g.drawImage(frame,i*300,row*350+20);
      g.textAlign='center';g.font='700 17px Segoe UI';g.fillStyle=character.trim;g.fillText(character.name,i*300+150,row*350+22);
      g.font='13px Segoe UI';g.fillStyle='#a4b9d3';g.fillText(CharacterCatalog.motion.styles[dancePose({variant:character.id,seed:0},beats*60/state.settings.bpm).mode],i*300+150,row*350+333);
     }
     if(new Set(signatures).size<4)throw Error('Dance frames did not change: '+key);changes.push({key,frames:4});
    }return {png:sheet.toDataURL('image/png').split(',')[1],changes};
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-rave-dances.png'),Buffer.from(result.png,'base64'));console.log(JSON.stringify({raveDances:result.changes}));
  }
  if(process.env.CHECK_CENTER_STAGE==='1'){
   const result=await evaluate(`(()=>{
    const saved={users:state.users,top:state.top,focus:state.focus,settings:state.settings},rows=[];
    const people=Array.from({length:120},(_,i)=>({id:'qa-center-'+i,nickname:'Dancer '+(i+1),variant:i%CharacterCatalog.count,seed:i*137+9,joinedAt:now()-10000,coins:0}));
    const slots=CENTER_STAGE_SLOTS;
    if(slots.length!==5||new Set(slots.map(s=>s.id)).size!==5)throw Error('The central stage needs five distinct anchors');
    for(const a of slots){if(outsideCenterStage(a,-75)||a.y!==CENTER_STAGE.height+2)throw Error('Anchor outside the stage');for(const b of slots)if(a!==b&&Math.hypot(a.x-b.x,a.z-b.z)<250)throw Error('Anchors too close');}
    for(const count of [1,36,120]){const users=people.slice(0,count),positions=floorPositions(users,[],5);if(positions.some(p=>!outsideCenterStage(p)))throw Error('Crowd entered the central stage');const stable=JSON.stringify(positions)===JSON.stringify(floorPositions(users,[],5));if(!stable)throw Error('Layout is unstable');rows.push({count,clear:true});}
    const walkers=people.slice(0,8).map(u=>({...u,walkUntil:now()+100000}));
    for(let t=0;t<60;t+=.1)if(floorPositions(walkers,[],t).some(p=>!outsideCenterStage(p)))throw Error('A walking guest crossed the central stage');
    const sheet=document.createElement('canvas');sheet.width=1080;sheet.height=1280;const out=sheet.getContext('2d');
    try{state.top=[];state.focus=null;for(const [index,count] of [0,0,0,36,36,36].entries()){
     state.users=people.slice(0,count);const angle=[-60,0,60][index%3];state.settings={...saved.settings,camera:0,cameraYaw:angle*Math.PI/180,cameraMotion:'fixed',cameraFrom:undefined,cameraChangedAt:now()-10000,cameraZoom:1};render(lastFrame+100);
     const x=index%3*360,y=Math.floor(index/3)*640;out.drawImage(canvas,x,y,360,640);out.fillStyle='#eefaff';out.font='12px Arial';out.fillText(angle+' deg / '+count+' dancers',x+8,y+266);
    }return {slots,layouts:rows,walkingSamples:600*walkers.length,png:sheet.toDataURL('image/png').split(',')[1]};}finally{Object.assign(state,saved);}
   })()`);
   const output=path.join(os.tmpdir(),'neon-center-stage-check.png');fs.writeFileSync(output,Buffer.from(result.png,'base64'));delete result.png;
   if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({...result,output,jsErrors:errors.length},null,2));return;
  }
  if(process.env.CHECK_STAGE_DANCERS==='1'){
   const result=await evaluate(`(()=>{
    const saved={users:state.users,top:state.top,focus:state.focus};state.users=[];state.top=[];state.focus=null;
    const original=stagePerformer,angles=[-90,-60,-45,0,45,60,90,135,180],sheet=document.createElement('canvas');sheet.width=1080;sheet.height=1215;const out=sheet.getContext('2d'),rows=[];
    function layer(pose,side){const a=document.createElement('canvas');a.width=720;a.height=1280;const g=a.getContext('2d');if(side)original(g,pose,3.2,side);return a;}
    function scene(pose,omit){const a=layer(pose);stagePerformer=(g,p,t,side)=>{if(side!==omit)original(g,p,t,side)};const objects=drawWorldScene(a.getContext('2d'),pose,3.2,false);objects.sort((a,b)=>b.depth-a.depth).forEach(o=>o.draw());stagePerformer=original;return a;}
    try{angles.forEach((angle,index)=>{const pose=frameStageCamera({yaw:angle*Math.PI/180,height:1480,distance:2550,zoom:1,targetX:0,targetY:55,targetZ:450}),full=scene(pose),pixels=full.getContext('2d').getImageData(0,0,720,1280).data,ratios=[];for(const side of [-1,1]){const mask=layer(pose,side).getContext('2d').getImageData(0,0,720,1280).data,without=scene(pose,side).getContext('2d').getImageData(0,0,720,1280).data;let opaque=0,visible=0;for(let i=0;i<mask.length;i+=4)if(mask[i+3]>180){opaque++;if(Math.abs(pixels[i]-without[i])+Math.abs(pixels[i+1]-without[i+1])+Math.abs(pixels[i+2]-without[i+2])>12)visible++;}ratios.push({side,opaque,visible,ratio:opaque?Math.round(visible/opaque*1000)/1000:0});}rows.push({angle,ratios});const x=index%3*360,y=Math.floor(index/3)*405;out.drawImage(full,0,0,720,760,x,y,360,380);out.fillStyle='#fff';out.font='14px Arial';out.fillText(angle+' deg  L '+ratios[0].ratio+' / R '+ratios[1].ratio,x+6,y+399);});return {rows,png:sheet.toDataURL('image/png').split(',')[1]};}finally{stagePerformer=original;Object.assign(state,saved);}
   })()`);
   const file=process.env.STAGE_PREVIEW_NAME||'preview-stage-angles.png';fs.writeFileSync(path.join(__dirname,file),Buffer.from(result.png,'base64'));
   if(result.rows.some(row=>row.ratios.some(r=>r.opaque<600||r.ratio<.95)))throw Error('A stage performer was clipped or occluded: '+JSON.stringify(result.rows));
   const framing=await evaluate(`(()=>{let checked=0;function check(base){const pose=frameStageCamera(base);for(const side of [-1,1]){const p=ClubCamera.project(stageDancerPoint(side),pose);if(p.depth<100||p.x-190*p.scale<21.9||p.x+190*p.scale>698.1||p.y-340*p.scale<35.9||p.y+16*p.scale>1248.1)throw Error('Performer outside frame: '+JSON.stringify({base,side,p}));}checked++;}for(const preset of ClubCamera.presets)for(const zoom of [.7,1,1.3])check({...preset,zoom,targetX:0,targetY:55,targetZ:450});for(let time=1000;time<=201000;time+=500)check(ClubCamera.view({camera:0,cameraMotion:'sweep',cameraSweepStartedAt:1000,cameraChangedAt:0,cameraZoom:1.3},time));return {checked}})()`);
   console.log(JSON.stringify({angles:result.rows,framing},null,2));return;
  }
  if(process.env.RECORD_DISCO==='1'||process.env.RECORD_LIGHTS==='1'){
   const png=await evaluate(`(()=>{state.settings={...state.settings,camera:0,cameraMotion:'fixed',cameraZoom:1,cameraFrom:undefined,cameraChangedAt:now()-5000};render(performance.now()+100);return canvas.toDataURL('image/png').split(',')[1]})()`);
   const file=process.env.RECORD_LIGHTS==='1'?'preview-wide-spotlights.png':'preview-disco-centered.png';fs.writeFileSync(path.join(__dirname,file),Buffer.from(png,'base64'));console.log('Saved '+file);return;
  }
  if(!await evaluate(`(()=>{for(const atlas of characterArt.values()){const a=document.createElement('canvas');a.width=atlas.naturalWidth;a.height=atlas.naturalHeight;const g=a.getContext('2d');g.drawImage(atlas,0,0);const pixels=g.getImageData(0,0,a.width,a.height).data;let clear=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>200)solid++}if(clear<a.width*a.height*.15||solid<a.width*a.height*.1)return false}return customCharacter({variant:7})?.character.canvas===true})()`))throw Error('New character art did not load with transparent components');
  if(!await evaluate('(()=>{for(let t=0;t<30;t+=.25){const pose=dancePose({variant:6,seed:17},t);if(pose.mode===5||pose.hip!==0)return false}return true})()'))throw Error('Klee movement did not use the intended hopping and waving choreography');
  const signature=await evaluate(`(()=>{const beat=60/state.settings.bpm,at=(key,n,riding=false)=>dancePose({variant:CharacterCatalog.forCommand(key).id,seed:0,riding},n*beat),furina=[at('furina',.25),at('furina',.75)],cross=['neuvillette','zhongli'].map(key=>Array.from({length:96},(_,i)=>at(key,i/8))),venti=Array.from({length:80},(_,i)=>at('venti',i/8).tilt);return {furina:furina.every(p=>p.mode===8&&p.leftArm[1][1]===-43&&p.rightArm[1][1]===-43)&&furina[0].leftArm[2][1]<furina[0].rightArm[2][1]&&furina[1].leftArm[2][1]>furina[1].rightArm[2][1],cross:cross.every(frames=>new Set(frames.map(p=>p.mode)).size===3&&Math.min(...frames.map(p=>p.bounce))<-20&&Math.max(...frames.map(p=>p.hip))-Math.min(...frames.map(p=>p.hip))>30),venti:Math.min(...venti)<-.2&&Math.max(...venti)>.2,riding:['furina','neuvillette','zhongli','venti'].every(key=>at(key,.25,true).mode<8&&at(key,.25,true).bounce===0)}})()`);
  if(Object.values(signature).some(ok=>!ok))throw Error('Signature dance choreography or sword-riding override failed: '+JSON.stringify(signature));
  if(!await evaluate(`(()=>{const base={camera:0,cameraMotion:'sweep',cameraSweepStartedAt:1000,cameraChangedAt:1000,cameraSweepPeriod:state.settings.cameraSweepPeriod},s=structuredClone(base),right=ClubCamera.view(s,51000).yaw,left=ClubCamera.view(s,151000).yaw;for(let time=100000;time<=115000;time+=1000)ClubCamera.setMotion(s,'sweep',time,true);return state.settings.cameraSweepPeriod===200000&&Math.abs(right-Math.PI/3)<1e-9&&Math.abs(left+Math.PI/3)<1e-9&&s.cameraSweepStartedAt===1000&&ClubCamera.view(s,115000).yaw<0})()`))throw Error('Camera did not keep its phase through center and reach both sides at the faster speed');
  if(!await evaluate(`(()=>{const a=document.createElement('canvas');a.width=stageDancersRoll.naturalWidth;a.height=stageDancersRoll.naturalHeight;const g=a.getContext('2d');g.drawImage(stageDancersRoll,0,0);const pixels=g.getImageData(0,0,a.width,a.height).data;let transparent=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent++;if(pixels[i]>200)solid++}return transparent>a.width*a.height*.4&&solid>a.width*a.height*.1&&pixels[3]===0})()`))throw Error('New stage dance atlas is missing transparent cutouts');
  if(!await evaluate('(()=>{const bpm=state.settings.bpm||148;const s=Array.from({length:40},(_,i)=>wingMotion(i/40*120/bpm)),spreads=s.map(m=>m.spread);return Math.max(...spreads)-Math.min(...spreads)>.6&&s.filter(m=>m.down).length<s.length/2})()'))throw Error('Wing flap does not visibly open and close');
  const atlas=await evaluate('({width:memeHeads.naturalWidth,height:memeHeads.naturalHeight})');
  if(atlas.width<512||atlas.height<512)throw Error('Meme atlas did not load at usable resolution');
  const entry=await evaluate('(()=>{const u={joinedAt:100000};return {start:entryPose(u,100000),mid:entryPose(u,100200),land:entryPose(u,100420),settled:entryPose(u,100820)}})()');
  if(entry.start.y!==-1250||!entry.mid.falling||entry.land.impact!==1||entry.settled.y!==0)throw Error('Arrival animation timeline is incorrect');
  const motionPixels=await evaluate(`(()=>{const a=document.createElement('canvas');a.width=400;a.height=400;const g=a.getContext('2d');const u={variant:0,seed:0,nickname:''};dancer(g,200,330,1.6,u,.02,true);const before=g.getImageData(0,0,400,400).data;g.clearRect(0,0,400,400);dancer(g,200,330,1.6,u,.2,true);const after=g.getImageData(0,0,400,400).data;let changed=0;for(let i=0;i<before.length;i+=4)if(Math.abs(before[i+3]-after[i+3])>50)changed++;return changed})()`);
  if(motionPixels<500)throw Error('Dance pose did not visibly change between beats');
  const info=await evaluate('({count:document.getElementById("viewerCount").textContent,canvas:!!document.querySelector("canvas"),panelHidden:document.getElementById("controlPanel").hidden})');
  if(!info.canvas||!info.panelHidden)throw Error('Live layout incorrect');
  const fullHd=await evaluate(`(()=>{const previous=state.focus;try{state.focus={id:'__hd-selected__',mode:'floor',startedAt:now()-1000,until:now()+5000};function sample(scale,blur){const a=document.createElement('canvas');a.width=1080;a.height=1920;renderPixelScales.set(a,scale);const g=a.getContext('2d');g.setTransform(scale,0,0,scale,0,0);const user={id:'__hd-trail__'},draw=c=>{c.translate(123,345);c.scale(.7,.7);emitWingTrail(c,user,-1,100,120,142,3,'#8eeaff')};if(blur)withViewerFocus(g,user,draw,{x:50,y:200,width:300,height:300});else draw(g);const store=wingTrailStores.get(a);return {...store.emitters.get('__hd-trail__:-1'),size:store.particles[0].size}}const base=sample(1,false),sharp=sample(1.5,false),blurred=sample(1.5,true),aligned=[sharp,blurred].every(p=>Math.abs(p.x-base.x)<1e-8&&Math.abs(p.y-base.y)<1e-8&&Math.abs(p.size-base.size)<1e-8);return {width:canvas.width,height:canvas.height,scale:renderScale,aligned}}finally{state.focus=previous}})()`);
  if(fullHd.width!==1080||fullHd.height!==1920||fullHd.scale!==1.5||!fullHd.aligned)throw Error('Full HD rendering changed wing trail alignment: '+JSON.stringify(fullHd));
  const leaderboard=await evaluate(`(()=>{const list=document.getElementById('liveLeaderboardList'),board=document.getElementById('liveLeaderboard'),banner=document.getElementById('wingUnlock'),hidden=banner.hidden,original=state.top;try{updateLeaderboards([]);const empty=list.querySelector('.empty-top')?.textContent==='Chưa có người tặng quà';const top=[{id:'rank-a',nickname:'Nguyễn Minh Anh tên rất dài <b>VIP</b>',coins:12345678},{id:'rank-b',nickname:'Fan Cứng',coins:1250},{id:'rank-c',nickname:'Mèo Nhỏ',coins:300}];updateLeaderboards(top);const rows=[...list.children],box=board.getBoundingClientRect(),safe=rows[0].querySelector('.top-name').textContent===top[0].nickname&&!list.querySelector('b,img'),amount=rows[0].querySelector('.coins').textContent==='12.345.678 xu',fit=rows.every(row=>row.scrollWidth<=row.clientWidth+1)&&rows[0].querySelector('.top-name').scrollWidth>rows[0].querySelector('.top-name').clientWidth;banner.hidden=false;const wing=banner.getBoundingClientRect(),separate=wing.right<box.left;updateLeaderboards([top[2],top[0],top[1]]);const reordered=list.firstElementChild.dataset.userId==='rank-c'&&document.getElementById('leaderboardList').firstElementChild.dataset.userId==='rank-c';return {empty,safe,amount,fit,separate,reordered,corner:box.x>400&&box.right<=700&&box.y===28&&box.bottom<230}}finally{banner.hidden=hidden;updateLeaderboards(original)}})()`);
  if(Object.values(leaderboard).some(ok=>!ok))throw Error('LIVE coin ranking layout or updates failed: '+JSON.stringify(leaderboard));
  if(!await evaluate('!document.querySelector(".stage-ui .brand,.stage-ui .info-grid,.stage-ui .wing-rewards,.stage-ui .top-gifters")'))throw Error('Information cards still cover the LIVE stage');
  if(!await evaluate('(()=>{const p=floorPositions(state.users,state.top,now()/1000);return Math.max(...p.map(v=>v.z))-Math.min(...p.map(v=>v.z))>1100&&Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x))>1000})()'))throw Error('Crowd did not spread across the expanded floor');
  let shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-live.png'),Buffer.from(shot.data,'base64'));
  if(process.env.RECORD_FULLHD==='1'){
   await call('Emulation.setDeviceMetricsOverride',{width:1080,height:1920,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,350));
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-fullhd.png'),Buffer.from(shot.data,'base64'));
   await call('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1,mobile:false});
  }
  if(process.env.RECORD_DANCE==='1'||process.env.RECORD_ENTRY==='1'){
   const recordingEntry=process.env.RECORD_ENTRY==='1';
   const recording=await evaluate(`(async()=>{
    const stream=document.getElementById('club').captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const done=new Promise(r=>recorder.onstop=r);recorder.start();
    ${recordingEntry?"[400,2000,3600].forEach(ms=>setTimeout(()=>document.getElementById('btnJoin').click(),ms));":"setTimeout(()=>document.getElementById('btnDrop').click(),3000);"}
    await new Promise(r=>setTimeout(r,6500));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(blob)});
   })()`);
   fs.writeFileSync(path.join(__dirname,recordingEntry?'preview-entry.webm':'preview-dance.webm'),Buffer.from(recording,'base64'));
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:APP_ORIGIN+'/?control=1'});await new Promise(r=>setTimeout(r,900));
  if(!await evaluate('!document.getElementById("controlPanel").hidden'))throw Error('Control panel hidden');
  if(!await evaluate('document.getElementById("realChatCount").textContent==="0"&&document.getElementById("chatConnectionSummary").textContent.includes("chưa nhận chat")'))throw Error('Desktop connection was incorrectly reported as verified LIVE chat');
  await evaluate(`(()=>{globalThis.qaSourceId=state.sources?.find(s=>s.kind==='studio')?.id||'qa-studio';return fetch('/api/source-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:qaSourceId,kind:'studio',width:800,height:600,stageWidth:337.5,stageHeight:600,renderWidth:1080,renderHeight:1920,dpr:1})})})()`);
  if(!await waitFor('document.getElementById("sourceQualitySummary").textContent.includes("thu nhỏ")'))throw Error('Undersized LIVE source did not produce a quality warning');
  await evaluate(`fetch('/api/source-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:qaSourceId,kind:'studio',width:1080,height:1920,stageWidth:1080,stageHeight:1920,renderWidth:1080,renderHeight:1920,dpr:1})})`);
  if(!await waitFor('document.getElementById("sourceQualitySummary").dataset.level==="ok"'))throw Error('Full HD LIVE source did not clear the quality warning');
  await evaluate('document.getElementById("broadcastMode").value="full";document.getElementById("broadcastMode").dispatchEvent(new Event("change"))');
  if(!await waitFor('state.settings.broadcastMode==="full"&&!clearBroadcast()'))throw Error('Full background effects control failed');
  await evaluate('document.getElementById("broadcastMode").value="clear";document.getElementById("broadcastMode").dispatchEvent(new Event("change"))');
  if(!await waitFor('state.settings.broadcastMode==="clear"&&clearBroadcast()'))throw Error('Clear broadcasting control failed');
  shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-connection-quality.png'),Buffer.from(shot.data,'base64'));
  if(!await evaluate('document.getElementById("studioUrl").value===location.origin+"/#tiktok.studio"&&document.getElementById("obsUrl").value===location.origin+"/"&&!new URL(document.getElementById("studioUrl").value).searchParams.has("control")'))throw Error('Studio and OBS source URLs were not configured correctly');
  const demoStart=await evaluate(`(()=>{globalThis.qaDemoIds=state.demoCandidates.map(u=>u.id);globalThis.qaDemoStartCount=state.users.length;document.querySelectorAll('#demoChoices button')[1].click();return {choices:qaDemoIds.length,cards:document.querySelectorAll('#demoChoices button').length,selected:document.getElementById('simRecipient').value,notJoined:!state.users.some(u=>qaDemoIds.includes(u.id))}})()`);
  if(demoStart.choices!==5||demoStart.cards!==5||!demoStart.notJoined||!await evaluate('document.getElementById("simRecipient").value===qaDemoIds[1]'))throw Error('Five character choices did not share the gift selection');
  await evaluate('document.getElementById("btnAddSelectedDemo").click()');
  if(!await waitFor('state.users.some(u=>u.id===qaDemoIds[1])&&document.getElementById("btnAddSelectedDemo").disabled'))throw Error('Adding a selected character did not use the selected identity');
  await evaluate('document.querySelectorAll("#demoChoices button")[2].click();document.getElementById("simCoins").value="10";document.getElementById("simCount").value="3";document.getElementById("simGiftForm").requestSubmit()');
  if(!await waitFor('state.users.find(u=>u.id===qaDemoIds[2])?.coins===30'))throw Error('A gift did not join and reward the selected character');
  await evaluate('document.getElementById("simRecipient").value=qaDemoIds[1];document.getElementById("simRecipient").dispatchEvent(new Event("change"));document.getElementById("simCoins").value="20";document.getElementById("simCount").value="1";document.getElementById("simGiftForm").requestSubmit()');
  if(!await waitFor('state.users.find(u=>u.id===qaDemoIds[1])?.coins===20'))throw Error('Changing the recipient did not redirect the next gift');
  const demoSelection=await evaluate(`({firstCoins:state.users.find(u=>u.id===qaDemoIds[1]).coins,secondCoins:state.users.find(u=>u.id===qaDemoIds[2]).coins,onlyTwoAdded:state.users.length===qaDemoStartCount+2,highlight:document.querySelector('#demoChoices button[aria-pressed="true"]').dataset.userId===qaDemoIds[1],sameRecipient:document.getElementById('simRecipient').value===qaDemoIds[1]})`);
  if(demoSelection.secondCoins!==30||!demoSelection.onlyTwoAdded||!demoSelection.highlight||!demoSelection.sameRecipient)throw Error('Gift selection changed another character or created a duplicate: '+JSON.stringify(demoSelection));
  await evaluate('document.getElementById("btnSword10").click()');
  if(!await waitFor('state.users.find(u=>u.id===qaDemoIds[1])?.coins===30&&!swordRequestPending'))throw Error('10-coin sword did not target the selected character');
  await evaluate('document.querySelectorAll("#demoChoices button")[2].click();document.getElementById("btnSword20").click()');
  if(!await waitFor('state.users.find(u=>u.id===qaDemoIds[2])?.coins===50&&!swordRequestPending'))throw Error('20-coin sword did not follow the changed selection');
  await evaluate('document.getElementById("simRecipient").value=qaDemoIds[1];document.getElementById("simRecipient").dispatchEvent(new Event("change"));document.getElementById("btnSword").click()');
  if(!await waitFor('state.users.find(u=>u.id===qaDemoIds[1])?.coins===80&&!swordRequestPending',8000))throw Error('50-coin sword did not follow the gift recipient dropdown: '+JSON.stringify(await evaluate('({selected:simDesiredRecipient,pending:swordRequestPending,feedback:document.getElementById("swordFeedback").textContent,people:state.users.filter(u=>qaDemoIds.includes(u.id)).map(u=>({id:u.id,coins:u.coins})),disabled:document.getElementById("btnSword").disabled})')));
  const swordSelection=await evaluate(`(()=>{const a=state.users.find(u=>u.id===qaDemoIds[1]),b=state.users.find(u=>u.id===qaDemoIds[2]);return {firstCoins:a.coins,secondCoins:b.coins,onlyTwoAdded:state.users.length===qaDemoStartCount+2,firstSwords:a.swordFlight.rides.map(r=>r.coins),secondSwords:b.swordFlight.rides.map(r=>r.coins),sameRecipient:document.getElementById('simRecipient').value===a.id,labelMatches:document.getElementById('swordRecipientStatus').textContent.includes(a.nickname),feedbackMatches:document.getElementById('swordFeedback').textContent.includes(a.nickname)}})()`);
  if(!swordSelection.onlyTwoAdded||!swordSelection.sameRecipient||!swordSelection.labelMatches||!swordSelection.feedbackMatches||swordSelection.firstSwords.at(-1)!==50||swordSelection.secondSwords.at(-1)!==20)throw Error('Sword selection created another person or changed their name: '+JSON.stringify(swordSelection));
  await evaluate('document.getElementById("demoChoices").scrollIntoView({block:"center"})');
  shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-demo-selection.png'),Buffer.from(shot.data,'base64'));
  await evaluate('command("clearDemo")');
  if(!await waitFor('state.users.length===0&&state.demoCandidates.every(u=>!u.onFloor&&u.coins===0)'))throw Error('Clearing demos did not reset the five choices');
  await evaluate('command("demo");window.scrollTo(0,0)');
  if(!await waitFor('state.users.length===36'))throw Error('Could not restore the isolated demo crowd');
  if(!await evaluate('document.querySelectorAll("#characterButtons button").length===CharacterCatalog.characters.filter(c=>c.custom).length'))throw Error('New character controls are missing');
  for(const key of await evaluate('CharacterCatalog.characters.filter(c=>c.custom).map(c=>c.key)')){await evaluate('document.getElementById("btnCharacter_'+key+'").click()');if(!await waitFor('state.users.some(u=>u.demo&&u.variant===CharacterCatalog.forCommand("'+key+'").id)&&state.users.find(u=>u.id===document.getElementById("simRecipient").value)?.variant===CharacterCatalog.forCommand("'+key+'").id'))throw Error('Character button did not create and select '+key);}
  if(!await evaluate('state.users.find(u=>u.id===document.getElementById("simRecipient").value)?.variant===CharacterCatalog.characters.filter(c=>c.custom).at(-1).id'))throw Error('New character was not selected for gifts and swords');
  for(const value of ['none','all','mixed']){
   await evaluate('document.getElementById("handProps").value="'+value+'";document.getElementById("handProps").dispatchEvent(new Event("change"))');
   if(!await waitFor('state.settings.handProps==="'+value+'"'))throw Error('Hand props selection did not sync: '+value);
  }
  if(!await evaluate('state.settings.cameraMotion==="sweep"&&document.getElementById("cameraMotion").value==="sweep"'))throw Error('Slow camera sweep is not enabled by default');
  await evaluate('document.getElementById("cameraMotion").value="fixed";document.getElementById("cameraMotion").dispatchEvent(new Event("change"))');await new Promise(r=>setTimeout(r,200));
  if(!await evaluate('state.settings.cameraMotion==="fixed"'))throw Error('Camera freeze control did not sync');
  await evaluate('document.getElementById("cameraMotion").value="sweep";document.getElementById("cameraMotion").dispatchEvent(new Event("change"))');await new Promise(r=>setTimeout(r,200));
  if(!await evaluate('state.settings.cameraMotion==="sweep"'))throw Error('Camera sweep control did not sync');
  await evaluate('command("camera",2)');await new Promise(r=>setTimeout(r,200));
  if(!await evaluate('state.settings.cameraMotion==="sweep"&&state.settings.cameraOverrideUntil>now()&&Math.abs(ClubCamera.view(state.settings,now()+25000).yaw)<=Math.PI/3+.001'))throw Error('Changing presets permanently stopped automatic camera movement');
  await evaluate('document.getElementById("btnResumeCamera").click()');await new Promise(r=>setTimeout(r,200));
  if(!await evaluate('state.settings.cameraMotion==="sweep"&&!state.settings.cameraOverrideUntil&&state.settings.camera===0'))throw Error('Camera resume button did not restart movement');
  await evaluate('document.getElementById("simCoins").value="10";document.getElementById("simCount").value="3";document.getElementById("simGiftForm").requestSubmit()');
  if(!await waitFor('state.users.find(u=>u.id===document.getElementById("simRecipient").value)?.coins===30'))throw Error('Simulated gift did not create and select a demo viewer: '+JSON.stringify(await evaluate('({selected:document.getElementById("simRecipient").value,feedback:document.getElementById("simFeedback").textContent,status:document.getElementById("statusText").textContent})')));
  await evaluate('document.getElementById("simCoins").value="20";document.getElementById("simCount").value="1";document.getElementById("simGiftForm").requestSubmit()');
  if(!await waitFor('state.users.find(u=>u.id===document.getElementById("simRecipient").value)?.wingTier===2'))throw Error('Simulated gifts did not accumulate to the 50-coin wing');
  await evaluate('document.getElementById("bpm").value="154";document.getElementById("bpm").dispatchEvent(new Event("change"));document.getElementById("energy").value="155";document.getElementById("energy").dispatchEvent(new Event("change"));');
  await new Promise(r=>setTimeout(r,200));
  if(!await evaluate('state.settings.bpm===154&&state.settings.energy===1.55'))throw Error('Dance controls did not sync');
  await evaluate('command("camera",0)');await new Promise(r=>setTimeout(r,100));
  await evaluate('document.getElementById("btnGift").click()');await new Promise(r=>setTimeout(r,900));
  const zoom=await evaluate('({focusVisible:!document.getElementById("focusLabel").hidden,mode:document.querySelector("canvas").dataset.focusMode,top:document.getElementById("leaderboardList").textContent,toast:document.getElementById("lastEvent").textContent})');
  if(zoom.focusVisible||zoom.mode!=='floor'||!zoom.toast.includes('Rose'))throw Error('Rose did not zoom in place: '+JSON.stringify({zoom,errors:errors.slice(0,3)}));
  const blurProbe=await evaluate(`(()=>{const other=state.users.find(u=>u.id!==state.focus.id),selected=state.users.find(u=>u.id===state.focus.id),drawImage=ctx.drawImage;let blurred,sharp;try{ctx.drawImage=function(){blurred={filter:this.filter,alpha:this.globalAlpha}};withViewerFocus(ctx,other,g=>g.fillRect(0,0,1,1),{x:0,y:0,width:10,height:10});withViewerFocus(ctx,selected,g=>sharp=g===ctx&&g.filter==='none'&&g.globalAlpha===1)}finally{ctx.drawImage=drawImage}return {blurred,sharp,amount:focusAmount(now()),remaining:state.focus.until-now()}})()`);
  if(!blurProbe.blurred?.filter.includes('blur')||blurProbe.blurred.alpha>=.5||!blurProbe.sharp||blurProbe.amount<.95)throw Error('Rose did not soften other viewers while keeping the sender sharp: '+JSON.stringify(blurProbe));
  if(!await evaluate('(()=>{const id=state.focus.id,time=state.focus.startedAt+1000,positions=floorPositions(state.users,state.top,time/1000),rank=state.top.findIndex(u=>u.id===id),point=rank>=0?swordPosition(state.top[rank],PODIUMS[rank],time):positions.find(p=>p.u.id===id),pose=roseCamera(frameStageCamera(ClubCamera.view(state.settings,time)),state,time,positions);return Math.abs(ClubCamera.project([point.x,point.y,point.z],pose).x-360)<1})()'))throw Error('Rose camera did not center the sender at their world position');
  shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-control.png'),Buffer.from(shot.data,'base64'));
  if(process.env.RECORD_MEME_DANCES==='1'){
   const result=await evaluate(`(async()=>{
    const a=document.createElement('canvas');a.width=1080;a.height=650;const g=a.getContext('2d'),characters=[14,15,16].map(id=>CharacterCatalog.definition(id)),saved=state.settings;state.settings={...saved,bpm:120,energy:1.15,handProps:'none'};
    const labels=['GROOVE NGANG','BƯỚC CHÉO','BẬT MỞ TAY'];
    function paint(t){const bg=g.createLinearGradient(0,0,1080,650);bg.addColorStop(0,'#0a1930');bg.addColorStop(.55,'#151127');bg.addColorStop(1,'#25102a');g.fillStyle=bg;g.fillRect(0,0,1080,650);g.textAlign='center';g.fillStyle='#e5faff';g.font='800 28px Segoe UI';g.fillText('NEON ROOM / MEME FREESTYLE',540,54);g.fillStyle='#a8bacb';g.font='16px Segoe UI';g.fillText('Nhảy tay không · Mỗi nhân vật một phong cách',540,88);characters.forEach((character,i)=>{const x=180+i*360;g.fillStyle=character.trim+'22';g.beginPath();g.ellipse(x,489,114,18,0,0,Math.PI*2);g.fill();dancer(g,x,475,1.8,{id:'meme-preview-'+i,variant:character.id,seed:i*2,nickname:'',coins:0},t,true);g.fillStyle=character.trim;g.font='800 26px Segoe UI';g.fillText(character.name,x,556);g.fillStyle='#b5b6c9';g.font='15px Segoe UI';g.fillText(labels[i],x,586)})}
    const nativeRAF=window.requestAnimationFrame;window.requestAnimationFrame=fn=>fn===render?0:nativeRAF.call(window,fn);a.style.cssText='position:fixed;inset:0;z-index:999;width:1080px;height:650px';document.body.append(a);await new Promise(r=>nativeRAF.call(window,()=>nativeRAF.call(window,r)));paint(.35);const png=a.toDataURL('image/png').split(',')[1],stream=a.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:2200000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r),start=performance.now();let frame;function tick(ms){paint((ms-start)/1000);frame=requestAnimationFrame(tick)}recorder.start();frame=requestAnimationFrame(tick);await new Promise(r=>setTimeout(r,6500));recorder.stop();await done;cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());state.settings=saved;window.requestAnimationFrame=nativeRAF;a.remove();nativeRAF.call(window,render);const webm=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});return {png,webm};
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-meme-freestyle.png'),Buffer.from(result.png,'base64'));fs.writeFileSync(path.join(PREVIEW_DIR,'preview-meme-freestyle.webm'),Buffer.from(result.webm,'base64'));
  }
  // Compare all five sticker faces at the same scale, without changing LIVE data.
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:560,deviceScaleFactor:1,mobile:false});
  await evaluate(`(()=>{
   const gallery=document.createElement('canvas');gallery.id='characterGallery';gallery.width=1280;gallery.height=560;gallery.style.cssText='position:fixed;inset:0;z-index:999;width:1280px;height:560px';document.body.append(gallery);
   const g=gallery.getContext('2d');g.fillStyle='#12101d';g.fillRect(0,0,1280,560);g.textAlign='center';g.fillStyle='#f7ecff';g.font='600 27px Segoe UI';g.fillText('NEON ROOM / MEME FACES',640,65);g.fillStyle='#b4a5ca';g.font='15px Segoe UI';g.fillText('Gấu trúc cười đểu · Cười lớn · Khóc cười · Đầu nấm · VIP',640,98);
   ['GẤU TRÚC CƯỜI ĐỂU','GẤU TRÚC CƯỜI LỚN','GẤU TRÚC KHÓC CƯỜI','ĐẦU NẤM MEME','GẤU TRÚC VIP'].forEach((label,i)=>{dancer(g,128+i*256,425,1.85,{variant:i,seed:0,nickname:'',vip:false},.4,true);g.font='600 13px Segoe UI';g.fillStyle='#dbcaee';g.fillText(label,128+i*256,490);});
  })()`);
  shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-characters.png'),Buffer.from(shot.data,'base64'));
  await evaluate('document.getElementById("characterGallery").remove()');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1040,deviceScaleFactor:1,mobile:false});
  await evaluate(`(()=>{
   const a=document.createElement('canvas');a.id='wingGallery';a.width=1280;a.height=1040;a.style.cssText='position:fixed;inset:0;z-index:999;width:1280px;height:1040px';document.body.append(a);
   const g=a.getContext('2d');globalThis.paintWingGallery=time=>{g.fillStyle='#100d1c';g.fillRect(0,0,1280,1040);g.textAlign='center';g.fillStyle='#fbf3ff';g.font='600 30px Segoe UI';g.fillText('NEON ROOM / LEGENDARY WINGS',640,62);g.font='15px Segoe UI';g.fillStyle='#a89bbf';g.fillText('6 bậc cánh · Phượng Hoàng mở khóa tại 300 xu',640,98);
   drawWingTrails(g,time);WingCatalog.tiers.forEach((wing,i)=>{const x=215+(i%3)*425,y=430+Math.floor(i/3)*440;dancer(g,x,y,1.05,{id:'preview_wing_'+i,variant:i%5,seed:0,nickname:'',vip:true,wingTier:i+1,coins:wing.coins},time,true);g.fillStyle=wing.color;g.font='700 28px Segoe UI';g.fillText(wing.coins+' XU',x,y+70);g.font='600 14px Segoe UI';g.fillText(wing.name.toLocaleUpperCase('vi-VN'),x,y+100);});};paintWingGallery(.18);
  })()`);
  shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-wings.png'),Buffer.from(shot.data,'base64'));
  if(process.env.RECORD_WINGS==='1'){
   const data=await evaluate(`(async()=>{
    const stream=document.getElementById('wingGallery').captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);
    let frame;const start=performance.now();function animate(ms){paintWingGallery((ms-start)/1000+.18);frame=requestAnimationFrame(animate)}frame=requestAnimationFrame(animate);
    recorder.start();await new Promise(r=>setTimeout(r,5000));recorder.stop();await done;cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());
    return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-wings-motion.webm'),Buffer.from(data,'base64'));
  }
  await evaluate('document.getElementById("wingGallery").remove()');
  for(const [coins,tier] of [[30,1],[50,2],[100,3],[150,4],[200,5],[300,6]]){
   await evaluate('document.getElementById("btnWing'+coins+'").click()');await new Promise(r=>setTimeout(r,450));
   if(!await evaluate('state.wingUnlock?.tier==='+tier+'&&state.focus.mode==="wing"&&!document.getElementById("focusLabel").hidden&&state.focus.until-state.focus.startedAt===WingCatalog.definition('+tier+').seconds*1000'))throw Error('Wing reward '+coins+' did not reveal with the expected duration');
  }
  await evaluate('document.getElementById("btnBigGift").click()');await new Promise(r=>setTimeout(r,250));
  if(!await evaluate('document.querySelector("canvas").style.filter.includes("hue-rotate")'))throw Error('Party lighting did not start');
  if(!await evaluate('state.top.length===3&&state.top.every(u=>u.id&&Number.isFinite(u.seed)&&Number.isInteger(u.variant))'))throw Error('Podium winners do not include their character identities');
  await call('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:APP_ORIGIN+'/'});await new Promise(r=>setTimeout(r,400));
  for(let ready=0;ready<40;ready++){if(await evaluate('typeof command==="function"&&state.users.length>0'))break;await new Promise(r=>setTimeout(r,200));}
  for(const [index,name] of [[0,'front'],[2,'left'],[3,'rear'],[6,'overhead']]){
   await evaluate('command("camera",'+index+')');await new Promise(r=>setTimeout(r,1450));
   if(index===0)await new Promise(r=>setTimeout(r,5200));
   if(!await evaluate('state.settings.camera==='+index+'&&state.settings.autoCamera===false'))throw Error('Camera preset did not sync');
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-camera-'+name+'.png'),Buffer.from(shot.data,'base64'));
   if(index===0)fs.writeFileSync(path.join(PREVIEW_DIR,'preview-podium.png'),Buffer.from(shot.data,'base64'));
   if(index===0&&process.env.RECORD_ROOM==='1'){
    await evaluate('command("settings",{cameraMotion:"fixed"})');await evaluate('command("camera",0)');
    await evaluate('(async()=>{for(let i=state.users.length;i<82;i++)await command("join")})()');await new Promise(r=>setTimeout(r,1600));
    shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-led-room.png'),Buffer.from(shot.data,'base64'));
    const data=await evaluate(`(async()=>{
     const stream=canvas.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});
     recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);
     recorder.start();setTimeout(()=>command('settings',{cameraMotion:'sweep',restartCameraSweep:true}),2000);await new Promise(r=>setTimeout(r,8000));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
     return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});
    })()`);
    fs.writeFileSync(path.join(PREVIEW_DIR,'preview-led-room.webm'),Buffer.from(data,'base64'));
   }
   if(index===0&&process.env.RECORD_EFFECTS==='1'){
    const data=await evaluate(`(async()=>{
     const source=document.getElementById('club'),a=document.createElement('canvas');a.width=900;a.height=1000;const g=a.getContext('2d');
     const paint=()=>g.drawImage(source,0,360,720,800,0,0,900,1000);paint();const timer=setInterval(paint,33),stream=a.captureStream(30),chunks=[];
     const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);
     recorder.start();setTimeout(()=>command('drop'),4200);await new Promise(r=>setTimeout(r,8500));recorder.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());
     return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});
    })()`);
    fs.writeFileSync(path.join(PREVIEW_DIR,'preview-floor-effects.webm'),Buffer.from(data,'base64'));
   }
   if(index===0&&(process.env.RECORD_DJ==='1'||process.env.RECORD_STAGE_DANCE==='1')){
    const data=await evaluate(`(async()=>{
     const source=document.getElementById('club'),a=document.createElement('canvas');a.width=1280;a.height=810;const g=a.getContext('2d');
     const paint=()=>g.drawImage(source,60,490,600,380,0,0,1280,810);paint();const timer=setInterval(paint,33),stream=a.captureStream(30),chunks=[];
     const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);
     recorder.start();await new Promise(r=>setTimeout(r,${process.env.RECORD_STAGE_DANCE==='1'?8000:5000}));recorder.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());
     return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});
    })()`);
    fs.writeFileSync(path.join(__dirname,process.env.RECORD_STAGE_DANCE==='1'?'preview-stage-arm-roll.webm':'preview-dj-stage.webm'),Buffer.from(data,'base64'));
   }
  }
  if(process.env.RECORD_CAMERA==='1'){
   const data=await evaluate(`(async()=>{
    const stream=document.getElementById('club').captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);
    recorder.start();[0,2,3,4,6,7].forEach((index,i)=>setTimeout(()=>command('camera',index),i*1700));
    await new Promise(r=>setTimeout(r,10500));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-camera-orbit.webm'),Buffer.from(data,'base64'));
  }
  const trails=await evaluate('wingTrailStores.get(document.getElementById("club"))?.particles.length||0');
  if(trails<1||trails>900)throw Error('Wing trails are missing or unbounded');
  if(process.env.RECORD_SHOWCASE==='1'){
   await evaluate('command("camera",0)');await new Promise(r=>setTimeout(r,1400));
   const data=await evaluate(`(async()=>{
    const person=await command('simulateGift',{nickname:'Rose Floor',coins:1,count:1});
    await new Promise(r=>setTimeout(r,1600));
    const stream=document.getElementById('club').captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);
    recorder.start();setTimeout(()=>command('rose',{recipientId:person.userId}),2000);setTimeout(()=>command('simulateGift',{recipientId:person.userId,coins:28,count:1}),8000);
    await new Promise(r=>setTimeout(r,12000));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});
   })()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-stage-showcase.webm'),Buffer.from(data,'base64'));
  }
  if(process.env.RECORD_EXPANDED==='1'){
   await evaluate('command("camera",1)');await new Promise(r=>setTimeout(r,1500));
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-expanded-floor.png'),Buffer.from(shot.data,'base64'));
   await evaluate('command("camera",0)');await new Promise(r=>setTimeout(r,1500));
   await evaluate(`(()=>{const stream=canvas.captureStream(30),chunks=[];globalThis.swordRecording={stream,chunks,recorder:new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3000000})};swordRecording.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};swordRecording.done=new Promise(r=>swordRecording.recorder.onstop=r);swordRecording.recorder.start()})()`);
   await evaluate('command("sword")');await new Promise(r=>setTimeout(r,6600));
   if(!await evaluate(`(()=>{const u=state.users.find(u=>u.id.startsWith('demo_sword_')&&u.coins===50),rank=state.top.findIndex(p=>p.id===u.id),base=rank>=0?PODIUMS[rank]:scatterFloor(state.users,state.top).get(u.id),p=swordPosition(u,base,now()),start=swordPosition(u,base,u.swordFlight.startedAt),end=swordPosition(u,base,u.swordFlight.until);globalThis.testSwordId=u.id;return Number(canvas.dataset.swordRiders)>=1&&p.flight&&p.y>180&&start.x===base.x&&end.x===base.x&&Math.abs(end.y-(base.y||0))<.01})()`))throw Error('Sword rider did not take off and return to their own position');
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-sword.png'),Buffer.from(shot.data,'base64'));
   await evaluate('command("rose",{recipientId:testSwordId})');await new Promise(r=>setTimeout(r,1000));
   if(!await evaluate(`(()=>{const time=now(),positions=floorPositions(state.users,state.top,time/1000),rank=state.top.findIndex(u=>u.id===state.focus.id),u=state.top[rank],p=rank>=0?swordPosition(u,PODIUMS[rank],time):positions.find(p=>p.u.id===state.focus.id),pose=roseCamera(frameStageCamera(ClubCamera.view(state.settings,time)),state,time,positions);return Math.abs(ClubCamera.project([p.x,p.y,p.z],pose).x-360)<1&&focusAmount(time)>.95})()`))throw Error('Rose did not follow the actual sword rider');
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-rose-blur.png'),Buffer.from(shot.data,'base64'));
   await new Promise(r=>setTimeout(r,10400));
   if(!await evaluate('Number(canvas.dataset.swordRiders)===0'))throw Error('Sword flight did not finish');
   const data=await evaluate(`(async()=>{swordRecording.recorder.stop();await swordRecording.done;swordRecording.stream.getTracks().forEach(t=>t.stop());return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(swordRecording.chunks,{type:'video/webm'}))})})()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-sword-flight.webm'),Buffer.from(data,'base64'));
   await call('Emulation.setDeviceMetricsOverride',{width:1000,height:570,deviceScaleFactor:1,mobile:false});
   await evaluate(`(()=>{const a=document.createElement('canvas');a.id='newDanceGallery';a.width=1000;a.height=570;a.style.cssText='position:fixed;inset:0;z-index:999;width:1000px;height:570px';document.body.append(a);const g=a.getContext('2d');g.fillStyle='#10101f';g.fillRect(0,0,1000,570);g.textAlign='center';g.fillStyle='#f4f8ff';g.font='700 26px Segoe UI';g.fillText('ĐỘNG TÁC MỚI / NEON ROOM',500,65);['XOAY TAY','LẮC HÔNG','NHẢY DÂY'].forEach((label,i)=>{dancer(g,170+i*330,455,2.1,{seed:i+4,variant:i,nickname:''},.12,true);g.fillStyle='#9eefff';g.font='600 17px Segoe UI';g.fillText(label,170+i*330,520)})})()`);
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-new-dances.png'),Buffer.from(shot.data,'base64'));
   await evaluate('document.getElementById("newDanceGallery").remove()');
  }
  if(process.env.RECORD_SWORD_TIERS==='1'){
   await evaluate('command("clearDemo")');await evaluate('command("demo")');await evaluate('command("settings",{cameraMotion:"fixed",cameraZoom:1})');await evaluate('command("camera",0)');await new Promise(r=>setTimeout(r,1600));
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-full-stage.png'),Buffer.from(shot.data,'base64'));
   await evaluate(`(()=>{const stream=canvas.captureStream(30),chunks=[];globalThis.swordRecording={stream,chunks,recorder:new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000})};swordRecording.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};swordRecording.done=new Promise(r=>swordRecording.recorder.onstop=r);swordRecording.recorder.start()})()`);
   for(const coins of [10,20,50])await evaluate('command("sword",'+coins+')');
   await new Promise(r=>setTimeout(r,6500));
   if(!await evaluate('Number(canvas.dataset.swordRiders)===3&&state.users.filter(u=>swordFlying(u,now())).length===3'))throw Error('All three sword tiers did not fly together');
   if(!await evaluate(`(()=>{const u=state.users.find(u=>SwordCatalog.rideAt(u.swordFlight,now())?.coins===50),ride=SwordCatalog.rideAt(u.swordFlight,now()),base={x:50,y:0,z:700},first=swordPosition(u,base,ride.startedAt+SwordCatalog.takeoff),last=swordPosition(u,base,ride.until-SwordCatalog.landing),middle=swordPosition(u,base,ride.startedAt+SwordCatalog.takeoff+4800),end=swordPosition(u,base,ride.until);return Math.hypot(first.x-last.x,first.z-last.z)<.01&&first.orbit===0&&last.orbit===1&&middle.orbit===.5&&end.x===base.x&&end.z===base.z&&!end.flight})()`))throw Error('Sword flight did not make exactly one orbit and return home');
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-sword-tiers-live.png'),Buffer.from(shot.data,'base64'));
   await new Promise(r=>setTimeout(r,11500));
   if(!await evaluate('Number(canvas.dataset.swordRiders)===0'))throw Error('Sword tier flights did not land');
   const data=await evaluate(`(async()=>{swordRecording.recorder.stop();await swordRecording.done;swordRecording.stream.getTracks().forEach(t=>t.stop());return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(swordRecording.chunks,{type:'video/webm'}))})})()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-three-swords.webm'),Buffer.from(data,'base64'));
   await call('Emulation.setDeviceMetricsOverride',{width:1200,height:600,deviceScaleFactor:1,mobile:false});
   await evaluate(`(()=>{const a=document.createElement('canvas');a.id='swordGallery';a.width=1200;a.height=600;a.style.cssText='position:fixed;inset:0;z-index:999;width:1200px;height:600px';document.body.append(a);const g=a.getContext('2d');g.fillStyle='#080d1b';g.fillRect(0,0,1200,600);g.textAlign='center';g.fillStyle='#f0faff';g.font='700 26px Segoe UI';g.fillText('PHI KIẾM / MỖI LƯỢT QUÀ MỘT VÒNG',600,65);SwordCatalog.tiers.forEach((s,i)=>{g.save();g.translate(170+i*400,365);g.scale(1.4,1.4);drawSwordBlade(g,s,.5);dancer(g,0,-8,1.05,{seed:1,variant:i,nickname:'',coins:s.coins,riding:true},.5,true,true);g.restore();g.fillStyle=s.color;g.font='700 26px Segoe UI';g.fillText(s.coins+' XU',200+i*400,480);g.font='600 18px Segoe UI';g.fillText(s.name.toLocaleUpperCase('vi-VN'),200+i*400,515)})})()`);
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-sword-tiers.png'),Buffer.from(shot.data,'base64'));
   await evaluate('document.getElementById("swordGallery").remove()');
  }
  if(process.env.RECORD_CHARACTERS==='1'){
   await evaluate('command("settings",{cameraMotion:"fixed",cameraZoom:1.15})');await evaluate('command("camera",0)');await new Promise(r=>setTimeout(r,1600));
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-disco-characters.png'),Buffer.from(shot.data,'base64'));
   await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1800,deviceScaleFactor:1,mobile:false});
   await evaluate(`(()=>{const a=document.createElement('canvas');a.id='newCharacterGallery';a.width=1280;a.height=1800;a.style.cssText='position:fixed;inset:0;z-index:999;width:1280px;height:1800px';document.body.append(a);const g=a.getContext('2d');globalThis.paintNewCharacters=time=>{g.fillStyle='#090f20';g.fillRect(0,0,1280,1800);g.textAlign='center';g.font='700 26px Segoe UI';g.fillStyle='#edf9ff';g.fillText('NEON ROOM / NHÂN VẬT CHIBI',640,62);CharacterCatalog.characters.filter(c=>c.custom).forEach((character,i)=>{const x=213+(i%3)*427,y=395+Math.floor(i/3)*420;dancer(g,x,y,1.55,{variant:character.id,seed:i*2+.4,nickname:'',coins:0},time,true);g.font='600 22px Segoe UI';g.fillStyle=character.trim;g.fillText(character.name,x,y+60)})};paintNewCharacters(.12)})()`);
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-new-characters.png'),Buffer.from(shot.data,'base64'));
   const data=await evaluate(`(async()=>{const a=document.getElementById('newCharacterGallery'),stream=a.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);let frame;const start=performance.now();function animate(ms){paintNewCharacters(.12+(ms-start)/1000);frame=requestAnimationFrame(animate)}frame=requestAnimationFrame(animate);recorder.start();await new Promise(r=>setTimeout(r,6500));recorder.stop();await done;cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))})})()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-new-characters.webm'),Buffer.from(data,'base64'));await evaluate('document.getElementById("newCharacterGallery").remove()');
  }
  if(process.env.RECORD_GENSHIN==='1'){
   await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
   await evaluate(`(()=>{const a=document.createElement('canvas');a.id='genshinGallery';a.width=1280;a.height=1000;a.style.cssText='position:fixed;inset:0;z-index:999;width:1280px;height:1000px';document.body.append(a);const g=a.getContext('2d'),keys=['wanderer','mitya','furina','neuvillette','zhongli','venti'],labels=['Nhảy ngẫu nhiên','Nhảy ngẫu nhiên','Đấm xen kẽ trên / dưới','Đấm chéo xuống + lắc hông','Đấm chéo xuống + lắc hông','Nhảy say rượu / lảo đảo'];globalThis.paintGenshin=time=>{g.fillStyle='#090f20';g.fillRect(0,0,1280,1000);g.textAlign='center';g.font='700 26px Segoe UI';g.fillStyle='#edf9ff';g.fillText('NEON ROOM / GENSHIN DANCE',640,55);keys.forEach((key,i)=>{const character=CharacterCatalog.forCommand(key),x=213+i%3*427,y=385+Math.floor(i/3)*440;g.strokeStyle='#26334b';g.lineWidth=1;g.strokeRect(x-195,y-292,390,394);dancer(g,x,y,1.5,{variant:character.id,seed:0,nickname:'',coins:0},time,true);g.font='700 23px Segoe UI';g.fillStyle=character.trim;g.fillText(character.name,x,y+48);g.font='15px Segoe UI';g.fillStyle='#a4b9d3';g.fillText(labels[i],x,y+78)})};paintGenshin(.12)})()`);
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-genshin-dances.png'),Buffer.from(shot.data,'base64'));
   const data=await evaluate(`(async()=>{const a=document.getElementById('genshinGallery'),stream=a.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const done=new Promise(r=>recorder.onstop=r);let frame;const start=performance.now();function animate(ms){paintGenshin(.12+(ms-start)/1000);frame=requestAnimationFrame(animate)}frame=requestAnimationFrame(animate);recorder.start();await new Promise(r=>setTimeout(r,8000));recorder.stop();await done;cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(chunks,{type:'video/webm'}))})})()`);
   fs.writeFileSync(path.join(PREVIEW_DIR,'preview-genshin-dances.webm'),Buffer.from(data,'base64'));await evaluate('document.getElementById("genshinGallery").remove()');
  }
  if(process.env.RECORD_LEADERBOARD==='1'){
   await call('Emulation.setDeviceMetricsOverride',{width:720,height:1280,deviceScaleFactor:1,mobile:false});
   await call('Page.navigate',{url:APP_ORIGIN+'/'});await new Promise(r=>setTimeout(r,1200));
   await evaluate('command("settings",{cameraMotion:"fixed"})');await evaluate('command("camera",0)');
   await evaluate('command("simulateGift",{nickname:"Fan Cứng",coins:1250,count:1})');await new Promise(r=>setTimeout(r,1200));
   if(!await evaluate('(()=>{const rows=[...document.querySelectorAll("#liveLeaderboardList li")];return rows.length===3&&rows.every((row,i)=>row.dataset.userId===state.top[i].id)&&rows[0].querySelector(".coins").textContent===state.top[0].coins.toLocaleString("vi-VN")+" xu"})()'))throw Error('LIVE coin ranking did not follow real gift updates');
   shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(PREVIEW_DIR,'preview-leaderboard.png'),Buffer.from(shot.data,'base64'));
  }
  await call('Page.navigate',{url:APP_ORIGIN+'/?control=1'});await new Promise(r=>setTimeout(r,200));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,200));
  const mobile=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');if(mobile.scroll>mobile.width+1)throw Error('Mobile horizontal overflow');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({live:info,fullHd,studioXhr,leaderboard,demoSelection,swordSelection,gift:zoom,mobile,motionPixels,jsErrors:errors.length},null,2));
 }finally{if(ws)ws.close();child.kill();await new Promise(r=>setTimeout(r,250));try{fs.rmSync(temp,{recursive:true,force:true});}catch{}}
}
main().catch(e=>{console.error(e);process.exitCode=1;});



