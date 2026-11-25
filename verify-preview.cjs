const fs=require('fs'),path=require('path'),os=require('os'),net=require('net'),{spawn}=require('child_process');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'neon-preview-test-'));
 for(const f of ['server.js','engine.js','tikfinity-bridge.js','source-monitor.js','camera.js','wing-catalog.js','sword-catalog.js','character-catalog.js','dance-motion.js','dancer-catalog.js','dancer-controls.js','dancers-3d.js','dancers.css','index.html','app.js','style.css','dance-controls.css','wings.css'])fs.copyFileSync(path.join(__dirname,f),path.join(temp,f));
 fs.mkdirSync(path.join(temp,'assets'));for(const f of ['meme-heads.png','fantasy-wings.png','fantasy-wings-extra.png','stage-dancers.png','stage-dancers-roll.png'])fs.copyFileSync(path.join(__dirname,'assets',f),path.join(temp,'assets',f));
 fs.mkdirSync(path.join(temp,'assets','characters'));for(const c of require('./character-catalog').characters)if(c.asset)fs.copyFileSync(path.join(__dirname,'assets','characters',c.asset),path.join(temp,'assets','characters',c.asset));
 for(const directory of ['vendor','model_3d','assets/dance'])fs.cpSync(path.join(__dirname,directory),path.join(temp,directory),{recursive:true});
 // Keep visual QA independent from any real TikFinity room running on this PC.
 const isolatedUpstream=path.join(temp,'no-live-upstream.cjs');
 fs.writeFileSync(isolatedUpstream,'globalThis.WebSocket=class extends EventTarget{constructor(url){super();if(new URL(url).hostname!=="127.0.0.1")throw Error("Unexpected QA upstream");queueMicrotask(()=>this.dispatchEvent(new Event("open")));}close(){}};');
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const server=spawn(process.execPath,['--require',isolatedUpstream,path.join(temp,'server.js')],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Server startup timeout')),5000);server.stdout.once('data',()=>{clearTimeout(timer);r()});server.once('error',j)});
  const origin='http://127.0.0.1:'+port;
  await fetch(origin+'/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'demo'})});
  const test=spawn(process.execPath,[path.join(__dirname,'preview-check.cjs')],{env:{...process.env,APP_ORIGIN:origin},stdio:'inherit',windowsHide:true});
  const code=await new Promise(r=>test.once('exit',r));if(code)process.exitCode=code;
 }finally{server.kill();await new Promise(r=>server.once('exit',r));const resolved=path.resolve(temp);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unexpected temp path');fs.rmSync(resolved,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
