(function(){
 const $=id=>document.getElementById(id),catalog=globalThis.DancerCatalog,fields=[],notes=[];
 let command,now,snapshot,editing=false,audioLock=false,programmaticSeek=false,lastSignature='';
 const api={};globalThis.DancerControls=api;
 api.init=(send,clock,isControl)=>{
  command=send;now=clock;
  for(let i=0;i<5;i++){
   const row=document.createElement('div');row.className='dancer-gift-field';
   const title=document.createElement('b');title.textContent='Dancer '+(i+1)+' · Quà 5 xu';
   const select=document.createElement('select');select.setAttribute('aria-label','Model Dancer '+(i+1));for(const model of catalog.models){const option=document.createElement('option');option.value=model.id;option.textContent=model.name;select.append(option);}
   const name=document.createElement('input');name.type='text';name.maxLength=60;name.placeholder='Tên món quà 5 xu';name.setAttribute('list','dancerKnownGifts');name.setAttribute('aria-label','Tên quà Dancer '+(i+1));
   const giftId=document.createElement('input');giftId.type='text';giftId.inputMode='numeric';giftId.maxLength=20;giftId.placeholder='Mã quà (nếu có)';giftId.setAttribute('aria-label','Mã quà Dancer '+(i+1));
   const test=document.createElement('button');test.type='button';test.textContent='◎ Thử Dancer '+(i+1);test.onclick=()=>command('dancerTest',i+1);
   row.append(title,select,name,giftId,test);$('dancerGiftFields').append(row);fields.push({select,name,giftId,test});
   for(const input of [select,name,giftId])input.addEventListener('input',()=>editing=true);
   name.addEventListener('change',()=>{const known=snapshot?.dancers?.recentGifts?.find(g=>g.name===name.value);if(known)giftId.value=known.giftId;});
   const note=document.createElement('li'),label=document.createElement('b'),gift=document.createElement('span');label.textContent='Dancer '+(i+1);note.append(label,gift);$('dancerGiftNoteList').append(note);notes.push({note,gift});
  }
  $('dancersEnabled').onchange=()=>command('dancerSettings',{enabled:$('dancersEnabled').checked});
  $('dancersAutoSwap').onchange=()=>command('dancerSettings',{autoSwap:$('dancersAutoSwap').checked});
  $('dancerGiftForm').onsubmit=async event=>{
   event.preventDefault();const value={order:fields.map(f=>f.select.value),gifts:fields.map(f=>({name:f.name.value.trim(),giftId:f.giftId.value.trim()}))};
   if(new Set(value.order).size!==5){$('dancerGiftStatus').textContent='Mỗi vị trí cần một model khác nhau. Hãy đổi đủ hai ô khi hoán đổi người.';return;}
   const result=await command('dancerSettings',value);if(result?.ok){editing=false;$('dancerGiftStatus').textContent='Đã lưu đội hình và quà cho 5 vị trí. Các ô chưa gán quà sẽ không nhận nhầm quà khác.';}
   else $('dancerGiftStatus').textContent='Chưa lưu được. Kiểm tra tên/mã quà không trùng nhau và mã chỉ có chữ số.';
  };
  const audio=$('dancerMusic');
  const seekAudio=time=>{if(Math.abs(audio.currentTime-time)>.001){programmaticSeek=true;audio.currentTime=time;}};
  $('btnDancerStart').onclick=async()=>{
   audioLock=true;$('music')?.pause();seekAudio(0);const promise=audio.play();await command('dancerPlayback',{playing:true,restart:true});await promise.catch(error=>{$('dancerGiftStatus').textContent='Chưa phát được nhạc: '+error.message;});audioLock=false;
  };
  if(isControl){
   audio.onplay=()=>{$('music')?.pause();if(!audioLock)command('dancerPlayback',{playing:true,seek:Math.min(catalog.duration,audio.currentTime)});};
   audio.onpause=()=>{if(!audioLock)command('dancerPlayback',{playing:false});};
   audio.onseeked=()=>{if(programmaticSeek){programmaticSeek=false;return;}if(!audioLock)command('dancerPlayback',{playing:!audio.paused,seek:Math.min(catalog.duration,audio.currentTime)});};
  }
  if(isControl)setInterval(()=>{
   const model=globalThis.Dancer3D,config=snapshot?.dancers;
   $('dancerLoadStatus').textContent=!snapshot?.features?.dancers3D?'Chạy lại start.bat để dùng sân khấu 3D.':model?.error?'Model 3D: '+model.error:model?.ready?'Đã tải đủ 5 model 3D · Neuvillette / Zhongli phía trước · 3 người phía sau đổi chỗ cuối lượt.':`Đang tải model 3D ${model?.loaded||0}/5…`;
   if(config&&!audio.paused&&!audio.seeking&&config.pausedAt===null){const phase=catalog.clock(config,now()).phase,delta=Math.abs(phase-audio.currentTime);if(delta>.22&&delta<catalog.duration-1)seekAudio(phase);}
  },1000);
 };
 api.update=next=>{
  snapshot=next;const config=next.dancers;if(!config)return;
  $('dancerGiftNote').hidden=config.enabled===false;
  $('dancersEnabled').checked=config.enabled;$('dancersAutoSwap').checked=config.autoSwap;
  $('btnDancerStart').disabled=!next.features?.dancers3D;
  for(let i=0;i<5;i++){
   if(!editing){fields[i].select.value=config.order[i];fields[i].name.value=config.gifts[i].name;fields[i].giftId.value=config.gifts[i].giftId;}
   const preset=catalog.giftPresets.find(p=>p.giftId===config.gifts[i].giftId);
   notes[i].gift.textContent=(preset?preset.icon+' ':'')+(config.gifts[i].name|| (config.gifts[i].giftId?'Quà #'+config.gifts[i].giftId:'Chưa gán quà · 5 xu'));
   notes[i].note.style.setProperty('--dancer-color',catalog.models[i].color);
  }
  const signature=JSON.stringify(config.recentGifts);if(signature!==lastSignature){lastSignature=signature;$('dancerKnownGifts').replaceChildren();for(const gift of config.recentGifts){const option=document.createElement('option');option.value=gift.name;option.label='5 xu'+(gift.giftId?' · #'+gift.giftId:'');$('dancerKnownGifts').append(option);}}
 };
})();
