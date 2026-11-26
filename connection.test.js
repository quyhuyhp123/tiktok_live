"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ClubState,chatCommand}=require('./engine'),{TikfinityBridge,decodePacket,sourceTiming}=require('./tikfinity-bridge'),{SourceMonitor}=require('./source-monitor');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,timeout=5000){const end=Date.now()+timeout;do{if(await check())return;await pause(30)}while(Date.now()<end);throw Error('Condition not reached before timeout');}
async function freePort(){const net=require('node:net'),server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function fakeTikfinity(){
 const http=require('node:http'),crypto=require('node:crypto'),sockets=new Set(),server=http.createServer();let connections=0;
 server.on('upgrade',(req,socket)=>{const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');sockets.add(socket);connections++;socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));socket.on('data',frame=>{if((frame[0]&15)===8)socket.end(Buffer.from([0x88,0]));});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'ws://127.0.0.1:'+server.address().port,get connections(){return connections},send(packet,binary=false){const body=Buffer.from(typeof packet==='string'?packet:JSON.stringify(packet)),header=body.length<126?Buffer.from([binary?0x82:0x81,body.length]):Buffer.from([binary?0x82:0x81,126,body.length>>8,body.length&255]);for(const socket of sockets)socket.write(Buffer.concat([header,body]));},disconnect(){for(const socket of sockets)socket.destroy()},async close(){for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}};
}
test('chat accepts case, Unicode width and invisible formatting without joining unrelated text',()=>{
 for(const comment of ['hey','HEY',' hey ','hey\u200b','\ufeffhey','Ｈｅｙ','hey!']){const c=new ClubState();assert.equal(chatCommand(comment),'hey');assert.equal(c.event({event:'chat',data:{id:'viewer',comment}}),true);assert.equal(c.snapshot().users[0].id,'viewer');}
 for(const comment of ['they','hello','heyday','hey there'])assert.equal(chatCommand(comment),null);
 const c=new ClubState();c.event({event:'chat',data:{user:{unique_id:'snake-id',nickname:'Viewer'},comment:'hey'}});assert.equal(c.snapshot().users[0].id,'snake-id');
});
test('packet decoding handles text/binary payloads and preserves gift-streak identity',()=>{
 const packet={event:'chat',data:{uniqueId:'viewer',comment:'hey'}};
 assert.deepEqual(decodePacket(JSON.stringify(packet)),packet);assert.deepEqual(decodePacket(Buffer.from(JSON.stringify(packet))),packet);
 const binary=new TextEncoder().encode(JSON.stringify(packet));assert.deepEqual(decodePacket(binary.buffer),packet);
 assert.equal(decodePacket({type:'CHAT',data:JSON.stringify({id:'a',text:'hey'})}).data.comment,'hey');
 const gift={event:'gift',data:{uniqueId:'a',giftType:1,repeatEnd:false,msgId:'same',repeatCount:50}};assert.deepEqual(decodePacket(gift),gift);
 assert.throws(()=>decodePacket('{bad'));assert.throws(()=>decodePacket({event:'chat'}));
 assert.deepEqual(decodePacket({event:'roomUser',data:{}}),{event:'roomuser',data:{}});
});
test('upstream timestamps use explicit seconds or milliseconds and never fabricate a delay',()=>{
 const now=1794013343509;
 assert.deepEqual(sourceTiming({createTime:'1794013340580'},now),{createdAt:1794013340580,sourceAgeMs:2929});
 assert.deepEqual(sourceTiming({common:{createTime:'1794013340'}},now),{createdAt:1794013340000,sourceAgeMs:3509});
 for(const data of [{},{createTime:''},{createTime:null},{createTime:0},{createTime:'not a time'},{createTime:now+1},{createTime:now-600001},{msgId:String(now)}])assert.equal(sourceTiming(data,now),null);
});
test('accepted chat and gifts bypass the broadcast queue without changing streak scoring',()=>{
 const club=new ClubState(),changes=[],bridge=new TikfinityBridge({club,onChange:urgent=>changes.push(urgent)}),time=Date.now();
 bridge.receive({event:'chat',data:{uniqueId:'timing-viewer',comment:'hey',createTime:String(time-2300)}});
 assert.equal(changes.at(-1),true);assert.ok(bridge.health.lastTiming.sourceAgeMs>=2300);assert.ok(bridge.health.lastTiming.processingMs>=0);
 bridge.receive({event:'like',data:{uniqueId:'timing-viewer',likeCount:1}});assert.equal(changes.at(-1),false);assert.equal(bridge.health.lastTiming.sourceAgeMs,null);
 const gift={uniqueId:'timing-viewer',giftType:1,repeatCount:20,diamondCount:1,msgId:'urgent-streak'};
 bridge.receive({event:'gift',data:{...gift,repeatEnd:false}});assert.equal(changes.at(-1),false);assert.equal(club.users.get('timing-viewer').coins,0);
 bridge.receive({event:'gift',data:{...gift,repeatEnd:true}});assert.equal(changes.at(-1),true);assert.equal(club.users.get('timing-viewer').coins,20);
 bridge.receive({event:'gift',data:{...gift,repeatEnd:true}});assert.equal(changes.at(-1),false);assert.equal(club.users.get('timing-viewer').coins,20);
 const snapshot=bridge.snapshot();snapshot.lastTiming.processingMs=999;assert.notEqual(bridge.health.lastTiming.processingMs,999);
});
test('real WebSocket path receives hey, reports ignored chat, reconnects and rejects malformed packets',{timeout:12000},async()=>{
 const upstream=await fakeTikfinity(),club=new ClubState(),bridge=new TikfinityBridge({club,url:upstream.url,retryMs:40,timeoutMs:1000});
 try{
  bridge.start();await until(()=>bridge.health.connected);assert.equal(bridge.health.chats,0);assert.equal(club.lastLiveEvent,0);
  upstream.send({event:'chat',data:{user:{uniqueId:'socket-viewer',nickname:'Socket viewer'},comment:'hey',msgId:'hey-a'}});
  await until(()=>club.snapshot().users.length===1);assert.equal(bridge.health.chats,1);assert.equal(bridge.health.lastChat.accepted,true);assert.ok(club.lastLiveEvent>0);
  upstream.send({event:'chat',data:{uniqueId:'not-joining',comment:'hello'}});await until(()=>bridge.health.chats===2);assert.equal(club.snapshot().users.length,1);assert.equal(bridge.health.lastChat.command,null);
  upstream.send('{invalid');await until(()=>bridge.health.invalid===1);assert.equal(bridge.health.connected,true);
  upstream.send({event:'gift',data:{uniqueId:'socket-viewer',diamondCount:1,repeatCount:30,giftType:1,repeatEnd:false,msgId:'streak-a'}});
  upstream.send({event:'gift',data:{uniqueId:'socket-viewer',diamondCount:1,repeatCount:30,giftType:1,repeatEnd:true,msgId:'streak-a'}});
  upstream.send({event:'gift',data:{uniqueId:'socket-viewer',diamondCount:1,repeatCount:30,giftType:1,repeatEnd:true,msgId:'streak-a'}});
  await until(()=>club.users.get('socket-viewer').coins===30);assert.equal(club.users.get('socket-viewer').wingTier,1);
  upstream.disconnect();await until(()=>upstream.connections>=2&&bridge.health.connected);
  upstream.send({event:'chat',data:{id:'binary-viewer',comment:'hey\u200b'}},true);await until(()=>club.users.has('binary-viewer'));assert.equal(club.snapshot().users.length,2);
 }finally{bridge.stop();await upstream.close()}
});
test('source monitor detects undersized and landscape capture and expires closed sources',()=>{
 const monitor=new SourceMonitor(),base={id:'source-1',kind:'studio',width:1080,height:1920,stageWidth:1080,stageHeight:1920,renderWidth:1080,renderHeight:1920,dpr:1};
 assert.equal(monitor.report(base,1000),true);assert.equal(monitor.snapshot(1000)[0].fullHd,true);
 monitor.report({...base,width:800,height:600,stageWidth:337.5,stageHeight:600},2000);assert.equal(monitor.snapshot(2000)[0].fullHd,false);assert.equal(monitor.snapshot(2000)[0].portrait,false);
 monitor.report({...base,width:540,height:960,stageWidth:540,stageHeight:960,dpr:2},3000);assert.equal(monitor.snapshot(3000)[0].fullHd,true);
 assert.equal(monitor.report({...base,width:NaN},3000),false);assert.equal(monitor.report({...base,id:'../../file'},3000),false);assert.equal(monitor.snapshot(40000).length,0);
});
test('HTTP + TikFinity WebSocket + SSE delivers a real chat into the floor and monitors source quality',{timeout:12000},async()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'neon-wire-test-')),upstream=await fakeTikfinity(),port=await freePort();
 for(const file of ['server.js','engine.js','tikfinity-bridge.js','source-monitor.js','camera.js','wing-catalog.js','sword-catalog.js','firework-catalog.js','character-catalog.js','dance-motion.js','dancer-catalog.js','dancer-controls.js','dancers-3d.js','dancers.css'])fs.copyFileSync(path.join(__dirname,file),path.join(temp,file));
 const child=spawn(process.execPath,[path.join(temp,'server.js')],{env:{...process.env,PORT:String(port),TIKFINITY_WS_URL:upstream.url},windowsHide:true,stdio:['ignore','pipe','pipe']}),root='http://127.0.0.1:'+port,abort=new AbortController();let reader;
 try{
  await until(async()=>{try{return(await fetch(root+'/api/state')).ok}catch{return false}});await until(()=>upstream.connections===1);
  const stream=await fetch(root+'/api/events',{signal:abort.signal});reader=stream.body.getReader();await reader.read();
  upstream.send({event:'chat',data:{uniqueId:'wire-viewer',nickname:'Wire viewer',comment:'hey',msgId:'wire-hey'}});
  let state;await until(async()=>{state=await(await fetch(root+'/api/state')).json();return state.users.some(u=>u.id==='wire-viewer')});assert.equal(state.connection.chats,1);assert.equal(state.connection.lastChat.accepted,true);assert.equal(state.users[0].demo,false);
  let sse='';await until(async()=>{const chunk=await reader.read();sse+=new TextDecoder().decode(chunk.value);return sse.includes('wire-viewer')});
  const source={id:'studio-test',kind:'studio',width:800,height:600,stageWidth:337.5,stageHeight:600,renderWidth:1080,renderHeight:1920,dpr:1};
  const report=(value,origin=root)=>fetch(root+'/api/source-status',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(value)});
  assert.equal((await report(source)).status,204);state=await(await fetch(root+'/api/state')).json();assert.equal(state.sources[0].fullHd,false);
  assert.equal((await report({...source,width:1080,height:1920,stageWidth:1080,stageHeight:1920})).status,204);state=await(await fetch(root+'/api/state')).json();assert.equal(state.sources[0].fullHd,true);
  assert.equal((await report(source,'https://example.com')).status,403);assert.equal((await report({...source,width:-1})).status,400);
 }finally{abort.abort();reader?.releaseLock();child.kill();await new Promise(r=>child.once('exit',r));await upstream.close();const target=path.resolve(temp);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(target,{recursive:true,force:true});}
});
