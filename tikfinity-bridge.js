"use strict";
const {normalizeUser,chatCommand}=require("./engine");
const supported=new Set(["chat","gift","follow","share","like","subscribe","member","roomuser"]);
function decodePacket(raw){
 let packet=raw;
 if(raw instanceof ArrayBuffer)packet=Buffer.from(raw).toString("utf8");
 else if(ArrayBuffer.isView(raw))packet=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength).toString("utf8");
 if(typeof packet==="string")packet=JSON.parse(packet.replace(/^\uFEFF/,""));
 if(!packet||typeof packet!=="object"||Array.isArray(packet))throw Error("Gói sự kiện không hợp lệ");
 const event=String(packet.event??packet.type??"").trim().toLowerCase();
 let data=packet.data;
 if(typeof data==="string")data=JSON.parse(data);
 if(!supported.has(event))return {event,data:null};
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Thiếu dữ liệu sự kiện");
 data={...data};
 if(event==="chat")data.comment=data.comment??data.text??data.message??"";
 return {event,data};
}
function sourceTiming(data,receivedAt=Date.now()){
 const value=data.createTime??data.common?.createTime;
 if(!["number","string"].includes(typeof value)||typeof value==="string"&&!/^\d+(?:\.\d+)?$/.test(value))return null;
 let createdAt=Number(value);if(createdAt<1e11)createdAt*=1000;
 const age=receivedAt-createdAt;
 // This is an estimate from the upstream timestamp, not a video latency measurement.
 if(!Number.isFinite(age)||age<0||age>600000)return null;
 return {createdAt:Math.round(createdAt),sourceAgeMs:Math.round(age)};
}
class TikfinityBridge{
 constructor({club,onChange=()=>{},onAccepted=()=>{},WebSocketClass=globalThis.WebSocket,url=process.env.TIKFINITY_WS_URL||"ws://127.0.0.1:21213/?service=NEON_ROOM&version=16",retryMs=3000,timeoutMs=7000}){
  const endpoint=new URL(url);
  if(endpoint.protocol!=="ws:"||!["127.0.0.1","localhost","[::1]"].includes(endpoint.hostname)||endpoint.username||endpoint.password)throw Error("Event API phải chạy trên máy này");
  Object.assign(this,{club,onChange,onAccepted,WebSocketClass,url,retryMs,timeoutMs});
  this.socket=null;this.retry=null;this.deadline=null;this.stopped=true;
  this.health={connected:false,connectedAt:0,packets:0,chats:0,handled:0,invalid:0,lastPacketAt:0,lastHandledAt:0,lastEventType:"",lastChat:null,lastTiming:null,lastError:""};
 }
 snapshot(){return {...this.health,lastChat:this.health.lastChat?{...this.health.lastChat}:null,lastTiming:this.health.lastTiming?{...this.health.lastTiming}:null};}
 start(){if(!this.stopped)return;this.stopped=false;this.connect();}
 connect(){
  if(this.stopped)return;
  clearTimeout(this.retry);let socket;
  try{socket=new this.WebSocketClass(this.url);socket.binaryType="arraybuffer";this.socket=socket;}
  catch{this.fail(null,"Không mở được kết nối TikFinity");return;}
  this.deadline=setTimeout(()=>this.fail(socket,"TikFinity không phản hồi kết nối"),this.timeoutMs);this.deadline.unref?.();
  socket.addEventListener("open",()=>{if(this.socket!==socket)return;clearTimeout(this.deadline);Object.assign(this.health,{connected:true,connectedAt:Date.now(),lastError:""});this.onChange();});
  socket.addEventListener("message",e=>{if(this.socket===socket)this.receive(e.data);});
  socket.addEventListener("error",()=>this.fail(socket,"Chưa nối được TikFinity Desktop ở cổng 21213"));
  socket.addEventListener("close",()=>this.fail(socket,"Kết nối TikFinity đã đóng"));
 }
 receive(raw){
  const receivedAt=Date.now(),started=performance.now();let urgent=false;
  this.health.packets++;this.health.lastPacketAt=receivedAt;
  try{
   const packet=decodePacket(raw);this.health.lastEventType=packet.event.slice(0,40);
   if(!packet.data){this.onChange();return;}
   const user=normalizeUser(packet.data),accepted=this.club.event(packet);
   const timing=sourceTiming(packet.data,receivedAt);
   this.health.lastTiming={event:packet.event,receivedAt,sourceAgeMs:timing?.sourceAgeMs??null,processingMs:Math.round((performance.now()-started)*100)/100};
   if(packet.event==="chat"){
    this.health.chats++;
    this.health.lastChat={nickname:user.nickname.slice(0,48),comment:String(packet.data.comment).slice(0,100),receivedAt:Date.now(),accepted,hasUser:!!user.id,command:chatCommand(packet.data.comment)};
   }
   if(accepted){this.health.handled++;this.health.lastHandledAt=Date.now();urgent=packet.event!=="like";this.onAccepted();}
  }catch{this.health.invalid++;this.health.lastError="Có gói sự kiện không đọc được; xem bộ đếm chẩn đoán";}
  this.onChange(urgent);
 }
 fail(socket,message){
  if(this.stopped||socket!==this.socket)return;
  clearTimeout(this.deadline);this.socket=null;this.health.connected=false;this.health.lastError=message;
  try{socket?.close();}catch{}
  clearTimeout(this.retry);this.retry=setTimeout(()=>this.connect(),this.retryMs);this.retry.unref?.();this.onChange();
 }
 reconnect(){this.stop();this.start();}
 stop(){this.stopped=true;clearTimeout(this.retry);clearTimeout(this.deadline);const socket=this.socket;this.socket=null;this.health.connected=false;try{socket?.close();}catch{}}
}
module.exports={TikfinityBridge,decodePacket,sourceTiming};
