(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.CharacterCatalog=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 const characters=[
  {id:0,key:"panda-smirk",name:"Gấu trúc cười đểu"},
  {id:1,key:"panda-laugh",name:"Gấu trúc cười lớn"},
  {id:2,key:"panda-tears",name:"Gấu trúc khóc cười"},
  {id:3,key:"bowl-cut",name:"Đầu nấm"},
  {id:4,key:"panda-vip",name:"Gấu trúc VIP"},
  {id:5,key:"furina",name:"Furina",custom:true,asset:"furina.png",aliases:["furina"],dance:"shoulder-punch",skin:"#f5ddd8",limb:"#dce8f7",glove:"#243a7e",boot:"#273465",trim:"#c6deff",headWidth:124,bodyWidth:76,armWidth:9,legWidth:9},
  {id:6,key:"klee",name:"Klee",custom:true,asset:"klee.png",aliases:["klee"],child:true,skin:"#f5d7bf",limb:"#bd3e42",glove:"#ecd7bf",boot:"#704b37",trim:"#fff1d7",headWidth:120,bodyWidth:72,armWidth:8,legWidth:9},
  {id:7,key:"ironman",name:"Iron Man",custom:true,canvas:true,aliases:["ironman","iron man"],skin:"#cc3946",limb:"#b72c3b",glove:"#d34a4f",boot:"#b12b39",trim:"#ffd57c",headWidth:122,bodyWidth:82,armWidth:12,legWidth:12},
  {id:8,key:"hulk",name:"Hulk",custom:true,asset:"hulk.png",aliases:["hulk"],skin:"#90c82f",limb:"#90c82f",glove:"#90c82f",boot:"#90c82f",trim:"#b5e15b",headWidth:132,bodyWidth:98,armWidth:18,legWidth:15},
  {id:9,key:"wanderer",name:"Wanderer",custom:true,asset:"wanderer.png",aliases:["wanderer"],skin:"#f6e1d7",limb:"#e7eef9",glove:"#233d78",boot:"#26386b",trim:"#8de9e7",headWidth:144,bodyWidth:78,armWidth:9,legWidth:9},
  {id:10,key:"mitya",name:"Mitya",custom:true,asset:"mitya.png",aliases:["mitya"],skin:"#f3ded7",limb:"#3d3965",glove:"#252b4b",boot:"#26263f",trim:"#b1eee9",headWidth:124,bodyWidth:80,armWidth:9,legWidth:9},
  {id:11,key:"neuvillette",name:"Neuvillette",custom:true,asset:"neuvillette.png",aliases:["neuvillette","neuvilette","neuvillete"],dance:"hydro-rave",skin:"#f4e0d9",limb:"#263e73",glove:"#e3eaff",boot:"#223252",trim:"#a3d8ff",headWidth:130,bodyWidth:82,armWidth:10,legWidth:10},
  {id:12,key:"zhongli",name:"Zhongli",custom:true,asset:"zhongli.png",aliases:["zhongli"],dance:"geo-rave",skin:"#f2dac5",limb:"#665141",glove:"#332c2a",boot:"#3b302b",trim:"#edc57b",headWidth:124,bodyWidth:80,armWidth:10,legWidth:10},
  {id:13,key:"venti",name:"Venti",custom:true,asset:"venti.png",aliases:["venti"],dance:"tipsy",skin:"#f4ded0",limb:"#e8ead6",glove:"#e1e4c8",boot:"#6a5039",trim:"#a6e3be",headWidth:130,bodyWidth:76,armWidth:9,legWidth:9},
  {id:14,key:"nam-xanh",name:"Nấm Xanh",custom:true,canvas:true,meme:true,headFrame:3,aliases:["nam-xanh","nam xanh","namxanh"],dance:"side-groove",body:"#25ad78",skin:"#f8e4d9",limb:"#40bc8c",glove:"#f8e4d9",boot:"#efffff",trim:"#a2ffe4",headWidth:128,bodyWidth:72,armWidth:8,legWidth:9,headphones:true},
  {id:15,key:"nam-hong",name:"Nấm Hồng",custom:true,canvas:true,meme:true,headFrame:3,aliases:["nam-hong","nam hong","namhong"],dance:"cross-step",body:"#ec6c9f",skin:"#f8e4d9",limb:"#f38fb6",glove:"#f8e4d9",boot:"#fff3f8",trim:"#ffcee8",headWidth:126,bodyWidth:72,armWidth:8,legWidth:9,headphones:true},
  {id:16,key:"nam-meme",name:"Nấm Meme",custom:true,canvas:true,meme:true,headFrame:3,aliases:["nam-meme","nam meme","nammeme"],dance:"open-bounce",body:"#252732",skin:"#fffdf8",limb:"#fffdf8",glove:"#fffdf8",boot:"#353540",trim:"#e8e5ff",headWidth:132,bodyWidth:74,armWidth:8,legWidth:9},
  {id:17,key:"gau-dai-ca",name:"Gấu Đại Ca",custom:true,canvas:true,meme:true,headFrame:0,accessory:"shades",outfit:"jacket",aliases:["gau-dai-ca","gau dai ca","dai ca"],dance:"hammer-jump",body:"#242533",skin:"#fffdf8",limb:"#292b39",glove:"#fffdf8",boot:"#ffd375",trim:"#ffce69",headWidth:132,bodyWidth:80,armWidth:10,legWidth:10},
  {id:18,key:"gau-cuoi-dien",name:"Gấu Cười Điên",custom:true,canvas:true,meme:true,headFrame:1,accessory:"cap",outfit:"suspenders",aliases:["gau-cuoi-dien","gau cuoi dien","cuoi dien"],dance:"windmill-stomp",body:"#fff1e6",skin:"#fffdf8",limb:"#fff1e6",glove:"#fffdf8",boot:"#ed658f",trim:"#ff679e",headWidth:134,bodyWidth:76,armWidth:9,legWidth:10},
  {id:19,key:"gau-mit-uot",name:"Gấu Mít Ướt",custom:true,canvas:true,meme:true,headFrame:2,headphones:true,outfit:"tracksuit",aliases:["gau-mit-uot","gau mit uot","mit uot"],dance:"hard-shuffle",body:"#5551be",skin:"#fffdf8",limb:"#7771e0",glove:"#fffdf8",boot:"#d5faff",trim:"#70e5ff",headWidth:130,bodyWidth:76,armWidth:9,legWidth:10},
  {id:20,key:"nam-bao",name:"Nấm Bão",custom:true,canvas:true,meme:true,headFrame:3,accessory:"headband",outfit:"jersey",aliases:["nam-bao","nam bao","nambao"],dance:"power-cross",body:"#d83d54",skin:"#fff1e6",limb:"#e95166",glove:"#fff1e6",boot:"#fff0ce",trim:"#ffdd78",headWidth:132,bodyWidth:78,armWidth:9,legWidth:10}
 ];
 const definition=id=>Number.isInteger(id)?characters[id]||null:null;
 const forCommand=command=>characters.find(c=>c.aliases?.includes(command))||null;
 const catalog={characters,count:characters.length,definition,forCommand};
 // Keep browser choreography in the existing catalog resource for running servers.
 catalog.motion=(function(characters){
 const pool=[17,0,18,1,19,2,20,3,4,5,6,7,11,12,13,14,15,16],childPool=[0,1,2,4,6,7,11,12,14,16];
 const styles=["Giơ tay theo nhịp","Lắc vai","Đấm tay xen kẽ","Nghiêng người","Xoay tay","Lắc hông","Nhảy dây","Cuộn tay","Đấm ngang vai","Đấm chéo xuống","Lảo đảo","Groove ngang","Bước chéo","Shuffle gót chân","Bật mở tay","Twist người","Đá chân đổi bên","Xoay tay bão + dậm chân","Shuffle bật gối","Đấm chéo lực + lắc hông","Bật nhảy nện tay"];
 function limbs(mode,phase,energy,child,riding){
  const step=Math.sin(phase),jump=Math.pow(Math.max(0,step),.7),hip=child?0:(mode===5?step*14:mode===7?Math.sin(phase*.5)*9:mode===4?step*3:0)*energy;
  let leftArm,rightArm;
  if(riding){leftArm=[[-16,-39],[-40,-50],[-58,-42+step*5]];rightArm=[[16,-39],[39,-48],[57,-43-step*5]];}
  else if(mode===0||mode===2){leftArm=[[-16,-39],[-48,-66-step*10],[-57+step*6,-119-(mode===0?jump*29:Math.max(0,step)*30)]];rightArm=[[16,-39],[48,-66+step*10],[57+step*6,-119-(mode===0?jump*29:Math.max(0,-step)*30)]];}
  else if(mode===1){leftArm=[[-16,-39],[-23+step*17,-37],[-10+step*35,-56]];rightArm=[[16,-39],[27+step*13,-38],[20+step*28,-57]];}
  else if(mode===3){leftArm=[[-16,-39],[-33,-45-step*16],[-39,-67-step*22]];rightArm=[[16,-39],[33,-45+step*16],[39,-67+step*22]];}
  else if(mode===4){leftArm=[[-16,-39],[-33+Math.cos(phase)*18,-55+step*25],[-42+Math.cos(phase)*36,-62+step*53]];rightArm=[[16,-39],[33+Math.cos(phase+Math.PI)*18,-55-step*25],[42+Math.cos(phase+Math.PI)*36,-62-step*53]];}
  else if(mode===5){leftArm=[[-16,-39],[-35,-34-step*8],[-52,-53-step*18]];rightArm=[[16,-39],[35,-34+step*8],[52,-53+step*18]];}
  else if(mode===6){leftArm=[[-16,-39],[-31,-37],[-45,-49+step*9]];rightArm=[[16,-39],[31,-37],[45,-49+step*9]];}
  else{const roll=phase*.5,rx=Math.sin(roll)*18,ry=Math.cos(roll)*9;leftArm=[[-16,-39],[-35,-39+Math.sin(roll)*5],[rx,-34+ry]];rightArm=[[16,-39],[35,-39-Math.sin(roll)*5],[-rx,-34-ry]];}
  const legs=riding?[[[-9,-20],[-18,-11],[-24,-5]],[[9,-20],[18,-11],[26,-5]]]:mode===6?[[[-9,-20],[-12,-8],[-13,-2]],[[9,-20],[12,-8],[13,-2]]]:[[[-9+hip,-20],[-16+hip*.8+step*10,-9],[-24+step*16,-3-Math.max(0,step)*13]],[[9+hip,-20],[16+hip*.8-step*10,-9],[24-step*16,-3-Math.max(0,-step)*13]]];
  return {mode,phase,step,energy,hip,leftArm,rightArm,legs,bounce:riding?0:mode===6?-Math.abs(step)*27*energy:-jump*(mode===0?19:mode===5||mode===7?4:11)*energy,sway:riding?0:Math.sin(phase*.5)*(mode===1?15:mode===5||mode===7?2:6)*energy,tilt:riding?step*.025:step*(mode===3?.22:mode===5||mode===7?.035:.12)*energy,turn:0};
 }
 function groove(p,mode,child){
  const {phase,step}=p,e=Math.min(1.6,p.energy),half=Math.sin(phase*.5),left=Math.max(0,step),right=Math.max(0,-step);
  if(mode===11){ // Loose wrists, shoulder hits and a side-to-side knee rock.
   p.leftArm=[[-16,-39],[-38,-45-step*13],[-64,-42-step*23]];p.rightArm=[[16,-39],[38,-45+step*13],[64,-42+step*23]];
   p.hip=child?0:step*7*e;p.sway=half*10*e;p.tilt=-step*.1*e;p.bounce=-Math.abs(step)*5*e;
   p.legs=[[[-9+p.hip,-20],[-20+step*8,-10],[-30+half*16,-3-left*10]],[[9+p.hip,-20],[20+step*8,-10],[30+half*16,-3-right*10]]];
  }else if(mode===12){ // Cross one foot in front, then open; forearms sweep in opposition.
   p.leftArm=[[-16,-39],[-34,-46],[-42+half*53,-57-step*9]];p.rightArm=[[16,-39],[34,-46],[42+half*53,-57+step*9]];
   p.hip=child?0:half*5*e;p.sway=half*9*e;p.bounce=-Math.abs(step)*6*e;p.tilt=-half*.07*e;
   p.legs=[[[-9+p.hip,-20],[-10+half*17,-8],[-21+left*48,-3-left*8]],[[9+p.hip,-20],[10+half*17,-8],[21-right*48,-3-right*8]]];
  }else if(mode===13){ // Heel-toe shuffle, with alternating knee lifts and relaxed hands.
   p.leftArm=[[-16,-39],[-32,-31-step*8],[-42,-17-step*18]];p.rightArm=[[16,-39],[32,-31+step*8],[42,-17+step*18]];
   p.hip=child?0:half*4*e;p.sway=half*5*e;p.bounce=-Math.abs(step)*7*e;p.tilt=half*.04*e;
   p.legs=[[[-9+p.hip,-20],[-18+left*18,-8-left*14],[-29+step*22,-3-left*15]],[[9+p.hip,-20],[18-right*18,-8-right*14],[29+step*22,-3-right*15]]];
  }else if(mode===14){ // Open both arms like the reference, spring up and land with knees apart.
   const open=(1-Math.cos(phase))*.5;
   p.leftArm=[[-16,-39],[-35-open*17,-48-open*7],[-42-open*35,-49-open*20]];p.rightArm=[[16,-39],[35+open*17,-48-open*7],[42+open*35,-49-open*20]];
   p.hip=0;p.sway=half*4*e;p.tilt=half*.09*e;p.bounce=-Math.pow(Math.max(0,Math.sin(phase)),.7)*21*e;
   p.legs=[[[-9,-20],[-15-open*11,-7],[-20-open*19,-2-left*9]],[[9,-20],[15+open*11,-7],[20+open*19,-2-left*9]]];
  }else if(mode===15){ // Small torso turns; the face remains toward the audience.
   p.leftArm=[[-16,-39],[-32,-43-step*12],[-30+half*25,-66-step*14]];p.rightArm=[[16,-39],[32,-43+step*12],[30+half*25,-66+step*14]];
   p.hip=child?0:half*8*e;p.sway=half*6*e;p.tilt=step*.08*e;p.turn=Math.sin(phase*.25)*.7;p.bounce=-Math.abs(step)*4*e;
   p.legs=[[[-9+p.hip,-20],[-19+p.hip,-8],[-26+half*15,-3-left*7]],[[9+p.hip,-20],[19+p.hip,-8],[26+half*15,-3-right*7]]];
  }else if(mode===16){ // Alternating little kicks and arm swings, with a soft hop.
   p.leftArm=[[-16,-39],[-33,-42-step*13],[-52,-41-step*27]];p.rightArm=[[16,-39],[33,-42+step*13],[52,-41+step*27]];
   p.hip=0;p.sway=half*5*e;p.tilt=-step*.1*e;p.bounce=-Math.abs(step)*10*e;
   p.legs=[[[-9,-20],[-17-left*9,-8-left*10],[-24-left*26,-3-left*26]],[[9,-20],[17+right*9,-8-right*10],[24+right*26,-3-right*26]]];
  }else if(mode===17){ // Large opposing arm circles and alternating planted stomps.
   const roll=phase*.5,rx=Math.cos(roll),ry=Math.sin(roll);
   p.leftArm=[[-16,-39],[-37+rx*15,-53+ry*21],[-34+rx*46,-67+ry*45]];p.rightArm=[[16,-39],[37-rx*15,-53-ry*21],[34-rx*46,-67-ry*45]];
   p.hip=step*13*e;p.sway=half*12*e;p.tilt=-step*.15*e;p.bounce=-Math.abs(step)*19*e;p.turn=half*.3;
   p.legs=[[[-9+p.hip,-20],[-25+step*10,-9-left*13],[-38+step*12,-3-left*25]],[[9+p.hip,-20],[25+step*10,-9-right*13],[38+step*12,-3-right*25]]];
  }else if(mode===18){ // Running-man shuffle with high knees and opposite arm drives.
   p.leftArm=[[-16,-39],[-38,-47-step*22],[-65,-55-step*39]];p.rightArm=[[16,-39],[38,-47+step*22],[65,-55+step*39]];
   p.hip=half*11*e;p.sway=half*11*e;p.tilt=-step*.13*e;p.bounce=-Math.abs(step)*18*e;p.turn=half*.28;
   p.legs=[[[-9+p.hip,-20],[-18+left*32,-9-left*26],[-32+step*40,-3-left*40]],[[9+p.hip,-20],[18-right*32,-9-right*26],[32+step*40,-3-right*40]]];
  }else if(mode===19){ // Wide wind-up, crossed downward punches and a deep hip rock.
   const hit=(1-Math.cos(phase))*.5;
   p.leftArm=[[-16,-39],[-47+hit*15,-36+hit*12],[-64+hit*108,-61+hit*70]];p.rightArm=[[16,-39],[47-hit*15,-36+hit*12],[64-hit*108,-61+hit*70]];
   p.hip=half*23*e;p.sway=half*8*e;p.tilt=step*.12*e;p.bounce=-Math.abs(step)*21*e;p.turn=half*.2;
   p.legs=[[[-9+p.hip,-20],[-25+p.hip*.5,-8-left*12],[-42+step*13,-3-left*23]],[[9+p.hip,-20],[25+p.hip*.5,-8-right*12],[42+step*13,-3-right*23]]];
  }else if(mode===20){ // Both fists overhead, a beat drop, then a springing stomp.
   const lift=(1+Math.cos(phase))*.5,hop=Math.max(0,step);
   p.leftArm=[[-16,-39],[-42-lift*8,-37-lift*40],[-30-lift*32,-15-lift*118]];p.rightArm=[[16,-39],[42+lift*8,-37-lift*40],[30+lift*32,-15-lift*118]];
   p.hip=half*12*e;p.sway=half*7*e;p.tilt=-step*.11*e;p.bounce=-hop*32*e;p.turn=half*.18;
   p.legs=[[[-9+p.hip,-20],[-25-hop*8,-8-hop*9],[-36-hop*16,-3-hop*17]],[[9+p.hip,-20],[25+hop*8,-8-hop*9],[36+hop*16,-3-hop*17]]];
  }
  return p;
 }
 function signature(p,style,seed){
  const {phase,step,energy}=p,e=Math.min(1.5,energy);
  if(style==="shoulder-punch"){
   p.mode=8;p.hip=step*3*e;p.leftArm=[[-16,-39],[-45,-43],[-66,-64-step*24]];p.rightArm=[[16,-39],[45,-43],[66,-64+step*24]];
   p.bounce=-Math.abs(step)*5*e;p.sway=Math.sin(phase*.5)*2*e;p.tilt=step*.035*e;
  }else if(style==="cross-down"){
   const strike=(1-Math.cos(phase))*.5;p.mode=9;p.hip=Math.sin(phase*.5)*13*e;
   p.leftArm=[[-16,-39],[-38,-28],[-40+65*strike,-25+27*strike]];p.rightArm=[[16,-39],[38,-28],[40-65*strike,-25+27*strike]];
   p.bounce=-Math.abs(step)*4*e;p.sway=Math.sin(phase*.5)*2*e;p.tilt=step*.025*e;
  }else if(style==="tipsy"){
   const wobble=phase*.32+seed*.11,lean=Math.sin(wobble),stagger=Math.sin(wobble*1.9);p.mode=10;p.hip=stagger*4*e;
   p.leftArm=[[-16,-39],[-45,-58+stagger*8],[-57,-99+lean*11]];p.rightArm=[[16,-39],[42,-30+lean*10],[67,-48+stagger*24]];
   p.bounce=-Math.abs(Math.sin(wobble*2))*7*e;p.sway=(lean*15+stagger*5)*e;p.tilt=(lean*.22+stagger*.08)*e;
   p.legs=[[[-9+p.hip,-20],[-25,-9],[-33+stagger*8,-3-Math.max(0,lean)*12]],[[9+p.hip,-20],[25,-9],[33+stagger*8,-3-Math.max(0,-lean)*12]]];return p;
  }else return p;
  p.legs=[[[-9+p.hip,-20],[-16+p.hip*.8+step*6,-9],[-24+step*9,-3-Math.max(0,step)*7]],[[9+p.hip,-20],[16+p.hip*.8-step*6,-9],[24-step*9,-3-Math.max(0,-step)*7]]];return p;
 }
 function blend(a,b,t){
  const p={...b};for(const k of ['hip','bounce','sway','tilt','turn'])p[k]=a[k]+(b[k]-a[k])*t;
  for(const k of ['leftArm','rightArm'])p[k]=b[k].map((v,i)=>v.map((n,j)=>a[k][i][j]+(n-a[k][i][j])*t));
  p.legs=b.legs.map((leg,l)=>leg.map((v,i)=>v.map((n,j)=>a.legs[l][i][j]+(n-a.legs[l][i][j])*t)));return p;
 }
 function pose(u,t,settings={}){
  const beats=t*(settings.bpm||148)/60,energy=(settings.energy||1.4)*(settings.boosted?1.2:1),seed=u.seed||0,offset=seed%8,character=characters.definition(u.variant),child=!!character?.child,choices=child?childPool:pool;
  const phrase=Math.floor((beats+offset)/8)+Math.floor(offset),sequence=((phrase%choices.length)+choices.length)%choices.length,phase=beats*Math.PI*2+seed*.017;
  if(u.riding)return limbs(0,phase,energy,child,true);
  const combo={"hydro-rave":[19,17,18],"geo-rave":[20,19,17]}[character?.dance];
  if(combo){
   const clock=beats+offset,index=((Math.floor(clock/4)%combo.length)+combo.length)%combo.length,part=((clock%4)+4)%4;
   const at=mode=>groove(limbs(mode,phase,energy,child,false),mode,child),p=at(combo[index]);
   if(part>=.55)return p;const ease=part/.55;
   return blend(at(combo[(index+combo.length-1)%combo.length]),p,ease*ease*(3-2*ease));
  }
  const specific={"side-groove":11,"cross-step":12,"open-bounce":14,"windmill-stomp":17,"hard-shuffle":18,"power-cross":19,"hammer-jump":20}[character?.dance];
  const mode=specific??choices[sequence];let p=groove(limbs(mode,phase,energy,child,false),mode,child);
  if(specific===undefined&&character?.dance)return signature(p,character.dance,seed);
  if(specific===undefined){
   const part=((beats+offset)%8+8)%8;
   if(part<.65){const previous=choices[(sequence+choices.length-1)%choices.length],a=groove(limbs(previous,phase,energy,child,false),previous,child),ease=part/.65;p=blend(a,p,ease*ease*(3-2*ease));}
  }
  return p;
 }
 function hasBatons(u,setting="mixed"){
  if(u.riding)return false;if(setting==="all")return true;if(setting==="none")return false;
  const character=characters.definition(u.variant);if(character?.dance||character?.child)return false;
  return ((Math.floor(u.seed||0)+u.variant)%4+4)%4===0;
 }
 return {pose,hasBatons,styles};
 })(catalog);
 return catalog;
});
