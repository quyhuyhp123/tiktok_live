"use strict";
const ClubCamera=require("./camera");
const WingCatalog=require("./wing-catalog");
const SwordCatalog=require("./sword-catalog");
const CharacterCatalog=require("./character-catalog");
const DancerCatalog=require("./dancer-catalog");
const MAX_ON_FLOOR = 120;
const IDLE_TIMEOUT_MS=5*60*1000;
const DEMO_NAMES=["Mèo Mun","Thỏ Ngọc","Mây Hồng","Nắng Mai","Trà Sữa","Bánh Bao","Chanh Dây","Bông Gòn","Sương Mai","Hạ Vy","Minh Anh","An Nhiên","Tinh Tú","Kim Ngân","Hải Đăng","Thanh Trúc","Gấu Mật","Cáo Nhỏ","Mochi","Bé Bông","Mây Nhỏ","Nắng Ấm","Hoa Mộc","Ngọc Lan","Tú Anh","Gia Hân","Khánh Linh","Hoàng Nam","Bảo Ngọc","Linh Chi","Hạ Mi","Quỳnh Anh","Thiên An","Hồng Trà","Dâu Tây","Kẹo Bông","Cún Bông","Mèo Mướp","Thỏ Bông","Sóc Nâu","Cá Heo","Mây Trắng","Trăng Non","Sao Mai","Mộc Miên","Thanh Tú","Tuệ Nhi","Nhật Minh","Hải Yến","Ngọc Nhi","Khánh Vy","Bảo An","Thiên Hà","Ánh Dương","Lam Ngọc","Hương Giang","Tường Vy","Mai Chi","Gia Bảo","Phương Nhi","Đậu Đỏ","Kem Dâu","Bánh Flan","Bún Bò"];
const WING_TIERS=WingCatalog.tiers;
const wingTierFor=WingCatalog.tierFor;
const text = (v, fallback = "") => String(v ?? fallback).slice(0, 150);
const positive = (v, fallback = 1) => Number.isFinite(Number(v)) ? Math.max(0, Math.min(1e7, Number(v))) : fallback;
const plain = s => text(s).normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200d\u2060\ufeff]/g, "").replace(/đ/g, "d").toLowerCase().trim();
const joinCommands=["hey","1","nhay","dance","zoom","doi nv","doi nhan vat","to len","nho lai","di vong","camera"];
function chatCommand(comment){const value=plain(comment),command=/^hey[!,.?…]*$/.test(value)?"hey":value;return CharacterCatalog.forCommand(command)||joinCommands.includes(command)?command:null;}
function normalizeUser(data = {}) {
  const u = data.user || data.userInfo || {};
  return {id: text(u.uniqueId || data.uniqueId || u.unique_id || data.unique_id || u.userId || data.userId || u.user_id || data.user_id || u.id || data.id || data.nickname || u.nickname), nickname: text(u.nickname || data.nickname || u.uniqueId || data.uniqueId || u.unique_id || data.unique_id || "Khách")};
}
class ClubState {
  constructor(saved = {}) {
    this.users = new Map((saved.users || []).filter(u => u && u.id && !u.demo).map(u => {const tier=wingTierFor(u.coins);return [u.id, {...u,swordFlight:null,wingTier:tier,vip:!!u.vip||tier>0,wings:!!u.wings||tier>0,onFloor:false}];}));
    this.settings = {name:"NEON ROOM", theme:"violet", camera:0, cameraZoom:1,cameraChangedAt:Date.now(),cameraMotion:"sweep",cameraSweepStartedAt:Date.now(),cameraSweepPeriod:ClubCamera.sweepPeriod,bpm:148, energy:1.4,broadcastMode:"clear",handProps:"mixed", ...saved.settings,autoCamera:false};
    if(!["clear","full"].includes(this.settings.broadcastMode))this.settings.broadcastMode="clear";
    if(!["mixed","none","all"].includes(this.settings.handProps))this.settings.handProps="mixed";
    this.settings.idleCleanup=this.settings.idleCleanup!==false;
    if(Number.isFinite(saved.settings?.cameraSweepStartedAt)&&saved.settings.cameraSweepPeriod!==ClubCamera.sweepPeriod){const previous=Number.isFinite(saved.settings.cameraSweepPeriod)&&saved.settings.cameraSweepPeriod>0?saved.settings.cameraSweepPeriod:240000;ClubCamera.migrateSweep(this.settings,previous);}
    this.lastEvent = "✦ Chào mừng đến với NEON ROOM";
    this.dancers=DancerCatalog.defaults(Date.now(),saved.dancers);
    this.focus = null; this.effect = null; this.wingUnlock=null; this.heatUntil = 0; this.eventCount = 0; this.lastLiveEvent = 0;
    this.seen = new Map(); this.cooldowns = new Map(); this.serial = 0;
    this.demoCandidates=[];
    for(let variant=0;variant<5;variant++)this.demoCandidates.push({id:`demo_choice_${variant}`,nickname:this.demoName(),variant,seed:Math.random()*1000});
  }
  ensure(data, demo = false) {
    const user = normalizeUser(data);
    if (!user.id) return null;
    let u = this.users.get(user.id);
    if (!u) {
      if (this.users.size >= 2000) {
        const inactive = [...this.users.values()].filter(v => !v.onFloor).sort((a,b)=>a.lastSeen-b.lastSeen)[0];
        if (inactive) this.users.delete(inactive.id); else return null;
      }
      u = {...user, variant:Math.floor(Math.random()*CharacterCatalog.count), coins:0, score:0, wings:false, wingTier:0, vip:false, demo, onFloor:false, seed:Math.random()*1000};
      this.users.set(u.id,u);
    }
    u.nickname = user.nickname; u.lastSeen = Date.now();
    return u;
  }
  demoName() {
    const used=new Set([...this.users.values(),...(this.demoCandidates||[])].map(u=>u.nickname)),available=DEMO_NAMES.filter(name=>!used.has(name));
    if(available.length)return available[Math.floor(Math.random()*available.length)];
    const base=DEMO_NAMES[Math.floor(Math.random()*DEMO_NAMES.length)];let suffix=2;
    while(used.has(`${base} ${suffix}`))suffix++;
    return `${base} ${suffix}`;
  }
  demoRecipient(id) {
    const existing=this.users.get(id);if(existing)return existing.demo?existing:null;
    const candidate=this.demoCandidates.find(u=>u.id===id);if(!candidate)return null;
    const u=this.ensure({uniqueId:candidate.id,nickname:candidate.nickname},true);
    if(u){u.variant=candidate.variant;u.seed=candidate.seed;}return u;
  }
  join(u) {
    if (!u || u.onFloor) return;
    if ([...this.users.values()].filter(v=>v.onFloor).length >= MAX_ON_FLOOR) {
      const oldest = [...this.users.values()].filter(v=>v.onFloor).sort((a,b)=>a.lastSeen-b.lastSeen)[0];
      if (oldest) oldest.onFloor = false;
    }
    u.onFloor = true;
    u.joinedAt = Date.now();
  }
  touchPresence(data,time=Date.now()){
    if(!data||typeof data!=='object')return false;
    const user=normalizeUser(data),known=this.users.get(user.id);
    if(!known)return false;known.lastSeen=time;return true;
  }
  pruneIdle(time=Date.now()){
    if(!this.settings.idleCleanup)return 0;
    const expired=[];
    for(const u of this.users.values())if(u.onFloor&&!u.demo&&time-(u.lastSeen??u.joinedAt??time)>=IDLE_TIMEOUT_MS){u.onFloor=false;u.swordFlight=null;expired.push(u.id);}
    if(expired.includes(this.focus?.id))this.focus=null;
    if(expired.includes(this.wingUnlock?.userId))this.wingUnlock=null;
    if(expired.length)this.lastEvent=`✦ ${expired.length} người rời sàn sau 5 phút không hoạt động · Chat hey để vào lại`;
    return expired.length;
  }
  zoom(u,mode="floor",duration=4000) {
    const startedAt=Date.now();
    if(mode==="floor"&&this.focus?.mode==="wing"&&this.focus.until>startedAt)return;
    if(mode==="floor"&&this.focus?.mode==="floor"&&this.focus.id===u.id&&this.focus.until>startedAt){this.focus.until=startedAt+duration;return;}
    if(mode==="wing"&&u.swordFlight)u.swordFlight=SwordCatalog.pause(u.swordFlight,duration,startedAt);
    this.focus = {id:u.id,mode,startedAt,until:startedAt+duration};
  }
  fx(type,u) {this.effect={type,userId:u.id,id:++this.serial,until:Date.now()+6500};}
  event(message, demo = false, options = {}) {
    if (!message || typeof message !== "object" || !message.data || typeof message.data !== "object") return false;
    const event = text(message.event).toLowerCase(), d = message.data;
    if(event==='member'){this.touchPresence(d);return false;}
    if(event==='roomuser'){
      const viewers=d.topViewers??d.top_viewers;
      if(Array.isArray(viewers))for(const viewer of viewers)this.touchPresence(viewer?.user?{user:viewer.user}:viewer);
      return false;
    }
    if (!["chat","gift","follow","share","like","subscribe"].includes(event)) return false;
    // The closing streak frame is the one that awards coins; interim frames never score.
    const g = d.gift || {};
    if (event === "gift" && Number(d.giftType ?? g.giftType ?? g.gift_type) === 1 && [false,0,"false"].includes(d.repeatEnd ?? g.repeatEnd ?? g.repeat_end)) return false;
    const user = normalizeUser(d);
    if (!user.id) return false;
    const msgId = d.msgId || d.messageId;
    if (msgId) {
      const key = `${event}:${user.id}:${d.giftId ?? g.id ?? ""}:${msgId}`;
      if (this.seen.has(key)) return false;
      this.seen.set(key,Date.now());
      if (this.seen.size > 5000) this.seen.delete(this.seen.keys().next().value);
    }
    const command = chatCommand(d.comment);
    const requestedCharacter=CharacterCatalog.forCommand(command);
    if(event==='chat')this.touchPresence(d);
    if (event === "chat" && !command) return false;
    if (event === "chat") {
      const key = `${user.id}:${command}`, now = Date.now();
      if (now - (this.cooldowns.get(key) || 0) < 1800) return false;
      this.cooldowns.set(key,now);
      if (this.cooldowns.size > 5000) this.cooldowns.delete(this.cooldowns.keys().next().value);
    }
    const u = this.ensure(d,demo); if (!u) return false;
    this.eventCount++;
    if (!demo) this.lastLiveEvent=Date.now();
    if (event === "like") {u.score += Math.min(20,positive(d.likeCount ?? d.count));this.heatUntil=Date.now()+4500;return true;}
    this.join(u);
    if (event === "chat") {
      if (["zoom","to len"].includes(command)) this.zoom(u);
      if (command === "nho lai" && this.focus?.id === u.id) this.focus=null;
      if (["doi nv","doi nhan vat"].includes(command)) u.variant=(u.variant+1)%CharacterCatalog.count;
      if(requestedCharacter)u.variant=requestedCharacter.id;
      if (command === "di vong") u.walkUntil=Date.now()+10000;
      if (command === "camera") {ClubCamera.select(this.settings,(this.settings.camera+1)%ClubCamera.presets.length);this.focus=null;this.wingUnlock=null;}
      u.danceUntil=Date.now()+5000; u.score+=5;
      this.lastEvent=`💬 ${u.nickname}: ${text(d.comment)}`;
    }
    if (event === "gift") {
      const name = text(d.giftName || g.name || g.giftName || "Gift");
      const count = Math.max(1,positive(d.repeatCount ?? g.repeatCount ?? g.repeat_count));
      const coins = Math.max(1,positive(d.diamondCount ?? g.diamondCount ?? g.diamond_count))*count;
      const unitCoins=Math.max(1,positive(d.diamondCount ?? g.diamondCount ?? g.diamond_count)),giftId=text(d.giftId??g.id??g.giftId);
      const dancerSlot=DancerCatalog.matchGift(this.dancers,{coins:unitCoins,giftId,name});
      if(unitCoins===5){this.dancers.recentGifts=[{giftId,name},...this.dancers.recentGifts.filter(v=>giftId?v.giftId!==giftId:plain(v.name)!==plain(name))].slice(0,20);}
      const previousTier=wingTierFor(u.coins);
      u.coins+=coins;u.score+=coins;u.wingTier=wingTierFor(u.coins);
      if(u.wingTier>0){u.wings=true;u.vip=true;}
      const n=plain(name);
      if(/rose|hoa hong/.test(n))this.zoom(u);
      if (/finger heart|fingerheart|trai tim ngon tay/.test(n)) {u.vip=true;if(!CharacterCatalog.definition(u.variant)?.custom)u.variant=4;}
      if (/tik\s?tok/.test(n)) u.walkUntil=Date.now()+10000;
      this.fx(coins>=100?"party":/rose|hoa hong/.test(n)?"rose":"gift",u);
      this.lastEvent=`${coins>=100?"🌌":"🎁"} ${u.nickname} tặng ${name} ×${count} · ${coins.toLocaleString("vi-VN")} ◆`;
      const sword=dancerSlot?null:SwordCatalog.forGift(coins);
      const skipReveal=!!sword&&!(demo&&options.previewWing);
      if(skipReveal){if(this.focus?.id===u.id)this.focus=null;if(this.wingUnlock?.userId===u.id)this.wingUnlock=null;}
      if(u.wingTier>previousTier&&!skipReveal){const duration=WING_TIERS[u.wingTier-1].seconds*1000;this.zoom(u,"wing",duration);this.wingUnlock={userId:u.id,tier:u.wingTier,id:++this.serial,startedAt:this.focus.startedAt,until:this.focus.until};this.lastEvent=`🪽 ${u.nickname} mở khóa cánh ${WING_TIERS[u.wingTier-1].name} · Tổng ${u.coins.toLocaleString("vi-VN")} xu quà`;}
      if(sword){
        const time=Date.now(),reveal=this.focus?.mode==="wing"&&this.focus.id===u.id&&this.focus.until>time;
        const startedAt=reveal?this.focus.until:time;
        u.swordFlight=SwordCatalog.enqueue(u.swordFlight,coins,startedAt,time);
        this.lastEvent+=` · ⚔ ${sword.name} · Bay 1 vòng quanh sàn`;
      }
      if(dancerSlot){const time=Date.now(),startedAt=this.focus?.until>time?this.focus.until:time;this.dancers.focus={slot:dancerSlot,startedAt,until:startedAt+5000,gifter:u.nickname};this.lastEvent+=` · ✦ Dancer ${dancerSlot}`;}
    }
    if (event === "follow") {u.wings=true;u.score+=10;this.lastEvent=`♡ ${u.nickname} đã follow · Đôi cánh dành cho bạn!`;this.fx("wings",u);}
    if (event === "share") {u.score+=15;u.danceUntil=Date.now()+6000;this.lastEvent=`↗ ${u.nickname} chia sẻ LIVE · Cùng vào sàn!`;}
    if (event === "subscribe") {u.vip=true;u.variant=4;this.fx("party",u);this.lastEvent=`♛ ${u.nickname} đăng ký · Chào mừng VIP!`;}
    return true;
  }
  control(action, value) {
    const demoUser=(targetId)=>{
      const u=targetId?this.demoRecipient(targetId):[...this.users.values()].find(u=>u.demo && u.onFloor);
      return u?{uniqueId:u.id,nickname:u.nickname}:{uniqueId:`demo_${Date.now()}_${++this.serial}`,nickname:this.demoName()};
    };
    if (action==="demo") {
      for(let i=0;i<36;i++){const id=`demo_crowd_${i}`;this.event({event:"chat",data:{uniqueId:id,nickname:this.users.get(id)?.nickname||this.demoName(),comment:"hey"}},true);}
      this.lastEvent="✦ Sàn thử 36 người · Chat hey để tham gia";
    } else if (action==="join") {
      const u=value?.recipientId?this.demoRecipient(value.recipientId):this.ensure({uniqueId:`demo_${Date.now()}_${++this.serial}`,nickname:this.demoName()},true);
      if(!u)return false;this.event({event:"chat",data:{uniqueId:u.id,nickname:u.nickname,comment:"hey"}},true);this.lastAddedId=u.id;
    }
    else if (action==="zoom") {if(value?.recipientId&&!this.demoRecipient(value.recipientId))return false;const u=this.ensure(demoUser(value?.recipientId),true);this.join(u);this.zoom(u);}
    else if (["rose","galaxy","follow"].includes(action)) {if(value?.recipientId&&!this.demoRecipient(value.recipientId))return false;this.event({event:action==="follow"?"follow":"gift",data:{...demoUser(value?.recipientId),giftName:action==="rose"?"Rose":"Galaxy",giftType:0,diamondCount:action==="galaxy"?1000:1,repeatCount:1}},true);}
    else if (action==="wingPreview"&&WING_TIERS.some(tier=>tier.coins===value)) {
      this.event({event:"gift",data:{uniqueId:`demo_wing_${value}_${Date.now()}_${++this.serial}`,nickname:this.demoName(),giftName:`Quà thử ${value} xu`,diamondCount:value,giftType:0,repeatCount:1}},true,{previewWing:true});
    }
    else if (action==="sword"){
      const selected=value&&typeof value==="object"&&!Array.isArray(value),coins=selected?value.coins:value===undefined?50:value;
      if(!SwordCatalog.forGift(coins))return false;
      const target=selected?this.demoRecipient(value.recipientId):null;if(selected&&!target)return false;
      const uniqueId=target?.id||`demo_sword_${Date.now()}_${++this.serial}`,nickname=target?.nickname||this.demoName();
      const accepted=this.event({event:"gift",data:{uniqueId,nickname,giftName:`Phi kiếm ${coins} xu`,diamondCount:coins,giftType:0,repeatCount:1}},true);
      if(accepted)this.lastSwordId=uniqueId;return accepted;
    }
    else if(action==="character"){
      const character=CharacterCatalog.definition(value?.variant);if(!character)return false;
      const target=value.recipientId?this.users.get(value.recipientId):null;if(value.recipientId&&!target?.demo)return false;
      const u=target||this.ensure({uniqueId:`demo_character_${Date.now()}_${++this.serial}`,nickname:character.name},true);
      if(!u)return false;u.variant=character.id;this.join(u);u.danceUntil=Date.now()+5000;this.lastCharacterId=u.id;this.lastEvent=`✦ ${character.name} đã vào sàn`;
    }
    else if (action==="simulateGift") {
      if(!value||!Number.isInteger(value.coins)||value.coins<1||value.coins>10000||!Number.isInteger(value.count)||value.count<1||value.count>100)return false;
      const target=value.recipientId?this.demoRecipient(value.recipientId):null;
      if(value.recipientId&&(!target||!target.demo))return false;
      const id=target?.id||`demo_sim_${Date.now()}_${++this.serial}`;
      const accepted=this.event({event:"gift",data:{uniqueId:id,nickname:target?.nickname||text(value.nickname).trim().slice(0,32)||this.demoName(),giftName:`Quà mô phỏng ${value.coins} xu`,diamondCount:value.coins,repeatCount:value.count,giftType:0,repeatEnd:true}},true);
      if(accepted)this.lastSimulatedId=id;
      return accepted;
    }
    else if (action==="clearDemo") {
      for(const [id,u] of this.users) if(u.demo) this.users.delete(id);
      if(!this.users.has(this.focus?.id))this.focus=null;
      if(!this.users.has(this.wingUnlock?.userId))this.wingUnlock=null;
      this.effect=null;this.lastEvent="✦ Đã xóa người thử · Sẵn sàng đón khán giả";
    } else if(action==="dancerSettings") {if(!DancerCatalog.settings(this.dancers,value))return false;}
    else if(action==="dancerPlayback"){
      if(!value||typeof value.playing!=="boolean"||value.seek!==undefined&&(!Number.isFinite(value.seek)||value.seek<0||value.seek>DancerCatalog.duration))return false;
      const time=Date.now();
      if(value.restart||value.seek!==undefined)this.dancers.startedAt=time-(value.seek||0)*1000;
      else if(value.playing&&this.dancers.pausedAt)this.dancers.startedAt+=time-this.dancers.pausedAt;
      this.dancers.pausedAt=value.playing?null:time;
    }
    else if(action==="dancerTest"){
      if(!Number.isInteger(value)||value<1||value>5)return false;
      this.dancers.focus={slot:value,startedAt:Date.now(),until:Date.now()+5000,gifter:"Mô phỏng 5 xu"};
    }
    else if (action==="settings") {
      if(typeof value?.idleCleanup==='boolean')this.settings.idleCleanup=value.idleCleanup;
      if(typeof value?.name==="string")this.settings.name=value.name.trim().slice(0,28)||"NEON ROOM";
      if(["violet","emerald","rose"].includes(value?.theme))this.settings.theme=value.theme;
      if(["clear","full"].includes(value?.broadcastMode))this.settings.broadcastMode=value.broadcastMode;
      if(["mixed","none","all"].includes(value?.handProps))this.settings.handProps=value.handProps;
      if(typeof value?.bpm==="number"&&Number.isFinite(value.bpm))this.settings.bpm=Math.round(Math.max(90,Math.min(180,value.bpm)));
      if(typeof value?.energy==="number"&&Number.isFinite(value.energy))this.settings.energy=Math.max(.6,Math.min(1.8,value.energy));
      if(["sweep","fixed"].includes(value?.cameraMotion))ClubCamera.setMotion(this.settings,value.cameraMotion);
      this.settings.autoCamera=false;
      if(typeof value?.cameraZoom==="number"&&Number.isFinite(value.cameraZoom))this.settings.cameraZoom=Math.max(.7,Math.min(1.3,value.cameraZoom));
    } else if (action==="camera") {if(!ClubCamera.select(this.settings,value===undefined?(this.settings.camera+1)%ClubCamera.presets.length:value))return false;this.focus=null;this.wingUnlock=null;}
    else if (action==="drop") {this.effect={type:"party",userId:null,id:++this.serial,until:Date.now()+8000};this.lastEvent="⚡ BASS DROP · CẢ SÀN CÙNG QUẨY!";}
    else if (action==="reset") {this.users.clear();this.focus=null;this.effect=null;this.wingUnlock=null;this.dancers.focus=null;this.seen.clear();this.cooldowns.clear();this.eventCount=0;this.lastLiveEvent=0;this.lastEvent="✦ Phiên mới · Đêm nay bạn là tâm điểm";}
    else return false;
    return true;
  }
  snapshot() {
    const users=[...this.users.values()];
    const top=users.filter(u=>u.coins>0).sort((a,b)=>b.coins-a.coins).slice(0,3).map(({id,nickname,coins,demo,variant,seed,vip,wings,wingTier,joinedAt,swordFlight,onFloor})=>({id,nickname,coins,demo,variant,seed,vip,wings,wingTier,joinedAt,swordFlight,onFloor}));
    const demoCandidates=this.demoCandidates.map(candidate=>{const u=this.users.get(candidate.id);return {...candidate,demo:true,nickname:u?.nickname||candidate.nickname,variant:u?.variant??candidate.variant,coins:u?.coins||0,onFloor:!!u?.onFloor};});
    return {users:users.filter(u=>u.onFloor),top,demoCandidates,dancers:this.dancers,settings:this.settings,focus:this.focus,effect:this.effect,wingUnlock:this.wingUnlock,heatUntil:this.heatUntil,lastEvent:this.lastEvent,eventCount:this.eventCount,lastLiveEvent:this.lastLiveEvent,serverTime:Date.now()};
  }
  save() {return {users:[...this.users.values()].filter(u=>!u.demo).map(({swordFlight,...u})=>u),settings:this.settings,dancers:{enabled:this.dancers.enabled,autoSwap:this.dancers.autoSwap,order:this.dancers.order,gifts:this.dancers.gifts,giftPresetVersion:this.dancers.giftPresetVersion}};}
}
module.exports={ClubState,normalizeUser,chatCommand,MAX_ON_FLOOR,IDLE_TIMEOUT_MS,wingTierFor,WING_TIERS};
