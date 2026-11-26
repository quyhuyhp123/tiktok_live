"use strict";
const http=require("http"),fs=require("fs"),path=require("path");
const {ClubState,AVATAR_HOST}=require("./engine");
const {TikfinityBridge}=require("./tikfinity-bridge"),{SourceMonitor}=require("./source-monitor");
if(typeof WebSocket!=="function"){console.error("Can Node.js 22 tro len. Cai dat tu https://nodejs.org");process.exit(1);}
const PORT=Number(process.env.PORT)||8080, ROOT=__dirname, STATE_FILE=path.join(ROOT,"live-state.json");
let saved={};
try{saved=JSON.parse(fs.readFileSync(STATE_FILE,"utf8").replace(/^\uFEFF/,""));}catch(e){if(e.code!=="ENOENT")console.warn("Khong doc duoc live-state.json; tao phien moi:",e.message);}
const club=new ClubState(saved), clients=new Set();
let saveTimer=null,broadcastTimer=null;
const sourceMonitor=new SourceMonitor(),bridge=new TikfinityBridge({club,onChange:broadcast,onAccepted:persist});
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{fs.writeFileSync(STATE_FILE+".tmp",JSON.stringify(club.save()));fs.renameSync(STATE_FILE+".tmp",STATE_FILE);}catch(e){console.error("Khong luu duoc diem:",e.message);}},700);}
function snapshot(){return {...club.snapshot(),version:"18.8",features:{dancers3D:true,selectedSword:true,handProps:true,characterCount:require("./character-catalog").count},tikfinity:bridge.health.connected,connection:bridge.snapshot(),sources:sourceMonitor.snapshot()};}
// TikTok profile pictures are fetched here so the stage canvas stays same-origin.
// Only URLs the engine already accepted from TikFinity (TikTok CDNs) are fetched.
const avatarCache=new Map(),avatarPending=new Map();
async function loadAvatar(src){
  if(avatarCache.has(src))return avatarCache.get(src);
  if(avatarPending.has(src))return avatarPending.get(src);
  const job=(async()=>{
    let result=null;
    try{
      // Follow at most three redirects, and only to other TikTok image hosts.
      let next=src,r=null;
      for(let hop=0;hop<4&&next;hop++){
        const target=new URL(next);if(target.protocol!=="https:"||!AVATAR_HOST.test(target.hostname))return null;
        r=await fetch(target,{signal:AbortSignal.timeout(6000),redirect:"manual",headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}});
        next=r.status>=300&&r.status<400&&r.headers.get("location")?new URL(r.headers.get("location"),target).href:null;
      }
      if(!r||next)return null;
      const type=(r.headers.get("content-type")||"").split(";")[0].trim();
      if(r.ok&&/^image\/(jpeg|png|webp|gif|avif)$/.test(type)){const data=Buffer.from(await r.arrayBuffer());if(data.length&&data.length<=600000)result={type,data};}
    }catch{}
    avatarCache.set(src,result);if(avatarCache.size>500)avatarCache.delete(avatarCache.keys().next().value);
    return result;
  })();
  avatarPending.set(src,job);try{return await job;}finally{avatarPending.delete(src);}
}
async function serveAvatar(res,id){
  const src=club.users.get(id)?.avatar,hit=src?await loadAvatar(src):null;
  if(!hit){res.writeHead(404,{"Cache-Control":"no-store"});res.end();return;}
  res.writeHead(200,{"Content-Type":hit.type,"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"});res.end(hit.data);
}
function send(res){res.write(`data: ${JSON.stringify(snapshot())}\n\n`);}
function flushBroadcast(){broadcastTimer=null;const data=`data: ${JSON.stringify(snapshot())}\n\n`;for(const res of clients){if(res.writableLength>1e6){res.destroy();clients.delete(res);}else res.write(data);}}
function broadcast(urgent=false){if(urgent){clearTimeout(broadcastTimer);flushBroadcast();return;}if(!broadcastTimer)broadcastTimer=setTimeout(flushBroadcast,70);}
const files={"/":"index.html","/index.html":"index.html","/app.js":"app.js","/camera.js":"camera.js","/wing-catalog.js":"wing-catalog.js","/assets/fantasy-wings-extra.png":"assets/fantasy-wings-extra.png","/assets/stage-dancers.png":"assets/stage-dancers.png","/style.css":"style.css","/wings.css":"wings.css","/assets/fantasy-wings.png":"assets/fantasy-wings.png","/dance-controls.css":"dance-controls.css","/assets/meme-heads.png":"assets/meme-heads.png"};
files["/assets/stage-dancers-roll.png"]="assets/stage-dancers-roll.png";
files["/sword-catalog.js"]="sword-catalog.js";for(const sword of require("./sword-catalog").tiers)files["/assets/swords/"+sword.image]="assets/swords/"+sword.image;files["/firework-catalog.js"]="firework-catalog.js";
files["/character-catalog.js"]="character-catalog.js";
for(const file of ["dancer-catalog.js","dancer-controls.js","dancers-3d.js","dancer-expression.js","dancers.css"])files["/"+file]=file;
for(const file of ["three.module.js","three.core.js","GLTFLoader.js","BufferGeometryUtils.js","SkeletonUtils.js"])files["/vendor/three/"+file]="vendor/three/"+file;
for(const model of require("./dancer-catalog").models)files["/model_3d/Nam/"+model.file]="model_3d/Nam/"+model.file;
for(const file of ["reference-402b.mp3","reference-402b-motion.json"])files["/assets/dance/"+file]="assets/dance/"+file;
for(const character of require("./character-catalog").characters)if(character.asset)files["/assets/characters/"+character.asset]="assets/characters/"+character.asset;
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".glb":"model/gltf-binary",".mp3":"audio/mpeg",".json":"application/json; charset=utf-8"};
const server=http.createServer(async(req,res)=>{
  let url;try{url=new URL(req.url,`http://127.0.0.1:${PORT}`);decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end("Bad request");return;}
  if(req.method==="GET"&&url.pathname==="/api/events"){
    req.socket.setNoDelay(true);
    res.writeHead(200,{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"});
    res.write("retry: 2000\n\n");clients.add(res);send(res);req.on("close",()=>clients.delete(res));return;
  }
  if(req.method==="GET"&&url.pathname==="/api/avatar"){serveAvatar(res,url.searchParams.get("id")||"");return;}
  if(req.method==="GET"&&url.pathname==="/api/state"){res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(snapshot()));return;}
  if(req.method==="POST"&&url.pathname==="/api/source-status"){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end("Forbidden origin");return;}
    if(!(req.headers["content-type"]||"").startsWith("application/json")){res.writeHead(415);res.end("JSON required");return;}
    let body="";try{for await(const chunk of req){body+=chunk;if(body.length>2048){res.writeHead(413);res.end("Too large");return;}}
      if(!sourceMonitor.report(JSON.parse(body))){res.writeHead(400);res.end("Invalid source status");return;}broadcast();res.writeHead(204);res.end();
    }catch{res.writeHead(400);res.end("Invalid JSON");}return;
  }
  if(req.method==="POST"&&url.pathname==="/api/control"){
    const origin=req.headers.origin;
    if(origin&&origin!==`http://${req.headers.host}`){res.writeHead(403);res.end("Forbidden origin");return;}
    if(!(req.headers["content-type"]||"").startsWith("application/json")){res.writeHead(415);res.end("JSON required");return;}
    let body="";
    try{
      for await(const chunk of req){body+=chunk;if(body.length>16384){res.writeHead(413);res.end("Too large");return;}}
      const {action,value}=JSON.parse(body);
      if(action==="reconnectTikfinity")bridge.reconnect();
      else if(!club.control(action,value)){res.writeHead(400);res.end("Unknown action");return;}
      persist();broadcast(true);const userId=action==="simulateGift"?club.lastSimulatedId:action==="join"?club.lastAddedId:action==="sword"?club.lastSwordId:action==="character"?club.lastCharacterId:null;
      res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({ok:true,...(userId?{userId,nickname:club.users.get(userId)?.nickname}:{})}));
    }catch{res.writeHead(400);res.end("Invalid JSON");}return;
  }
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);res.end("Method not allowed");return;}
  const file=files[url.pathname];if(!file){res.writeHead(404);res.end("Not found");return;}
  if(file.endsWith('.mp3')){
    fs.stat(path.join(ROOT,file),(err,stat)=>{
      if(err){res.writeHead(404);res.end('Not found');return;}
      const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/),start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;
      if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return;}
      res.writeHead(range?206:200,{'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${stat.size}`}:{})});
      if(req.method==='HEAD'){res.end();return;}fs.createReadStream(path.join(ROOT,file),{start,end}).pipe(res);
    });return;
  }
  fs.readFile(path.join(ROOT,file),(err,data)=>{if(err){res.writeHead(500);res.end("Read error");return;}
    // LIVE Studio checks the stage page with XHR before adding its web source.
    // Only the static entry page is readable across origins; API access is unchanged.
    res.writeHead(200,{"Content-Type":mime[path.extname(file)],"Cache-Control":"no-store",...(file==="index.html"?{"Access-Control-Allow-Origin":"*"}:{})});
    res.end(req.method==="HEAD"?undefined:data);
  });
});
const heartbeat=setInterval(()=>{for(const res of clients)res.write(": heartbeat\n\n");},15000);
const idleCleanup=setInterval(()=>{if(club.pruneIdle()){persist();broadcast(true);}},5000);idleCleanup.unref();
const autoFirework=setInterval(()=>{const fired=club.autoFireworkTick(),blazed=club.autoBlazeTick();if(fired||blazed){persist();broadcast(true);}},250);autoFirework.unref();
server.on("error",err=>{console.error(err.code==="EADDRINUSE"?`Cong ${PORT} dang duoc su dung. Mo http://127.0.0.1:${PORT}/?control=1 hoac dong server cu.`:err.message);process.exit(1);});
server.listen(PORT,"127.0.0.1",()=>{console.log(`\nNEON ROOM - TikTok LIVE\nBang dieu khien: http://127.0.0.1:${PORT}/?control=1\nLIVE Studio 1080x1920: http://127.0.0.1:${PORT}/#tiktok.studio\nOBS 1080x1920: http://127.0.0.1:${PORT}/\nGiu cua so nay va TikFinity Desktop dang chay.\n`);bridge.start();});
function shutdown(){clearInterval(heartbeat);clearInterval(autoFirework);clearInterval(idleCleanup);bridge.stop();clearTimeout(saveTimer);try{fs.writeFileSync(STATE_FILE,JSON.stringify(club.save()));}catch{}process.exit(0);}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);



