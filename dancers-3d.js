import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { addSmile, addGlow } from './dancer-expression.js?v=club-8count-1';

const catalog=globalThis.DancerCatalog;let TILE=256;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(2*Math.atan(640/1060)*180/Math.PI,720/1280,5,18000);
const canvas=document.createElement('canvas');
const api={ready:false,error:'',loaded:0,total:5,actors:[],frames:0,canvas,diagnostics:[],choreography:'club-8count-1'};
globalThis.Dancer3D=api;
let renderer,frameActors=[],lastTime=0;
const vector=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),up=vector(0,1,0);
// Soft portrait key, cool fill and a restrained stage rim preserve facial detail.
const light=new THREE.DirectionalLight(0xffeee3,1.65);light.position.set(450,1000,1800);scene.add(light,new THREE.HemisphereLight(0xe6f1ff,0x504366,1.5));
const fill=new THREE.DirectionalLight(0xc5e4ff,.65);fill.position.set(-1000,600,1500);scene.add(fill);
const rim=new THREE.DirectionalLight(0xb6a4ff,1.1);rim.position.set(-1100,700,-500);scene.add(rim);
const loader=new GLTFLoader();
const wandGripGeometry=new THREE.CylinderGeometry(2,2.3,6,8),wandTubeGeometry=new THREE.CylinderGeometry(1.7,1.7,16,10),wandHaloGeometry=new THREE.CylinderGeometry(3.2,3.2,17,10);
function createHandLight(actor){
 const group=new THREE.Group(),grip=new THREE.Mesh(wandGripGeometry,new THREE.MeshBasicMaterial({color:0x182337})),tube=new THREE.Mesh(wandTubeGeometry,new THREE.MeshBasicMaterial({color:0x55ddff})),halo=new THREE.Mesh(wandHaloGeometry,new THREE.MeshBasicMaterial({color:0x55ddff,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending}));
 grip.position.y=1;tube.position.y=12;halo.position.y=12;group.add(grip,tube,halo);actor.add(group);return {group,tube,halo};
}

function autoRig(sceneRoot){
 sceneRoot.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(sceneRoot,true),size=bounds.getSize(vector()),center=bounds.getCenter(vector()),height=catalog.height;
 const normalize=new THREE.Matrix4().makeScale(height/size.y,height/size.y,height/size.y);
 normalize.setPosition(-center.x*height/size.y,-bounds.min.y*height/size.y,-center.z*height/size.y);
 const definitions=[
  ['hips',null,0,.54,0],['spine','hips',0,.63,0],['chest','spine',0,.76,0],['neck','chest',0,.84,0],['head','neck',0,.90,0],
  ['leftUpper','chest',.105,.79,0],['leftElbow','leftUpper',.225,.67,0],['leftWrist','leftElbow',.33,.55,0],
  ['rightUpper','chest',-.105,.79,0],['rightElbow','rightUpper',-.225,.67,0],['rightWrist','rightElbow',-.33,.55,0],
  ['leftThigh','hips',.055,.53,0],['leftKnee','leftThigh',.06,.30,0],['leftAnkle','leftKnee',.065,.065,.01],
  ['rightThigh','hips',-.055,.53,0],['rightKnee','rightThigh',-.06,.30,0],['rightAnkle','rightKnee',-.065,.065,.01]
 ];
 const root=new THREE.Group(),bones={},points={},list=[];
 for(const [name,parent,x,y,z] of definitions){const bone=new THREE.Bone();bone.name='Auto_'+name;points[name]=vector(x*height,y*height,z*height);bone.position.copy(points[name]).sub(parent?points[parent]:vector());bones[name]=bone;list.push(bone);(parent?bones[parent]:root).add(bone);}
 root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(list),segments=definitions.filter(d=>d[1]).map(([name,parent])=>({name:parent,index:list.indexOf(bones[parent]),a:points[parent],b:points[name]}));
 const meshes=[];sceneRoot.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){
  const geometry=mesh.geometry.clone();geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize,mesh.matrixWorld));
  const positions=geometry.attributes.position,indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4),p=vector();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);let candidates;
   if(p.y>height*.845)candidates=[{index:list.indexOf(bones.head),distance:0}];
   else{
    const arm=Math.abs(p.x)>height*.13&&p.y>height*.48;
    candidates=segments.filter(s=>arm?/Upper|Elbow|Wrist/.test(s.name)&&((p.x>0)===s.name.startsWith('left')):p.y<height*.51?/Thigh|Knee|Ankle/.test(s.name)&&((p.x>0)===s.name.startsWith('left')):!/(Upper|Elbow|Wrist|Thigh|Knee|Ankle)/.test(s.name)).map(s=>{
     const ab=s.b.clone().sub(s.a),along=THREE.MathUtils.clamp(p.clone().sub(s.a).dot(ab)/ab.lengthSq(),0,1);return {index:s.index,distance:p.distanceToSquared(s.a.clone().addScaledVector(ab,along))};
    }).sort((a,b)=>a.distance-b.distance).slice(0,3);
   }
   const values=candidates.map(c=>1/Math.pow(c.distance+height*height*.0001,2)),total=values.reduce((a,b)=>a+b,0);
   for(let j=0;j<candidates.length;j++){indices[i*4+j]=candidates[j].index;weights[i*4+j]=values[j]/total;}
   if(p.y<height*.12){
    // The OBJ has no original foot weights. Bind soles to the ankle, not the calf.
    const footWeight=1-THREE.MathUtils.smoothstep(p.y,height*.065,height*.12),ankle=bones[p.x>=0?'leftAnkle':'rightAnkle'];
    for(let j=0;j<3;j++)weights[i*4+j]*=1-footWeight;
    indices[i*4+3]=list.indexOf(ankle);weights[i*4+3]=footWeight;
   }
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const skinned=new THREE.SkinnedMesh(geometry,mesh.material);skinned.name=mesh.name;skinned.frustumCulled=false;skinned.bind(skeleton);root.add(skinned);
 }
 return {root,bones,autoRig:true};
}

function identifyBones(gltf,root,key){
 const all=[];root.traverse(o=>{if(o.isBone)all.push(o);});
 const named=regex=>all.find(b=>regex.test(b.name));
 const byIndex=index=>{let found;root.traverse(o=>{if(gltf.parser.associations.get(o)?.nodes===index)found=o;});return found;};
 if(key==='neuvillette')return {spine:byIndex(194),chest:byIndex(195),head:byIndex(197),leftUpper:byIndex(301),leftElbow:byIndex(303),leftWrist:byIndex(305),rightUpper:byIndex(339),rightElbow:byIndex(341),rightWrist:byIndex(343),leftThigh:byIndex(56),leftKnee:byIndex(57),leftAnkle:byIndex(58),rightThigh:byIndex(60),rightKnee:byIndex(61),rightAnkle:byIndex(62)};
 if(key==='flins'){
  const result={spine:named(/^Bip001[ _]Spine_/),chest:named(/^Bip001[ _]Spine2_/),head:named(/^Bip001[ _]Head_/)};
  for(const [side,label] of [['left','L'],['right','R']])for(const [part,name] of [['Upper','UpperArm'],['Elbow','Forearm'],['Wrist','Hand'],['Thigh','Thigh'],['Knee','Calf'],['Ankle','Foot']])result[side+part]=named(new RegExp('^Bip001[ _]'+label+'[ _]'+name+'_'));
  return result;
 }
 const result={spine:named(/^Spine_/),chest:named(/^Chest_/),head:named(/^Head_/)};
 for(const side of ['left','right'])for(const [part,name] of [['Upper','arm'],['Elbow','elbow'],['Wrist','wrist'],['Thigh','leg'],['Knee','knee'],['Ankle','ankle']])result[side+part]=named(new RegExp('^'+side[0].toUpperCase()+side.slice(1)+'[ _]'+name+'_'));
 return result;
}

function resizeTextures(root){
 const seen=new Set();root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(m.map&&!seen.has(m.map)){seen.add(m.map);const image=m.map.image;if(image?.width>2048||image?.height>2048){const scale=2048/Math.max(image.width,image.height),a=document.createElement('canvas');a.width=Math.round(image.width*scale);a.height=Math.round(image.height*scale);a.getContext('2d').drawImage(image,0,0,a.width,a.height);m.map.image=a;m.map.needsUpdate=true;}m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
   if(m.opacity>=.99){m.transparent=false;m.alphaTest=Math.max(m.alphaTest,.25);m.depthWrite=true;}
   m.side=THREE.DoubleSide;if(m.isMeshStandardMaterial){m.roughness=.85;m.metalness=0;}
  }
 });
}

async function loadActor(model){
 const gltf=await loader.loadAsync('/model_3d/Nam/'+model.file),actor=new THREE.Group();let root=gltf.scene,bones,auto=false;
 root.updateMatrixWorld(true);
 if(model.id==='childe'){const rig=autoRig(root);root=rig.root;bones=rig.bones;auto=true;actor.add(root);}
 else{
  root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  const bounds=new THREE.Box3().setFromObject(root,true),size=bounds.getSize(vector()),center=bounds.getCenter(vector());
  const normalized=new THREE.Group(),scale=catalog.height/size.y;normalized.scale.setScalar(scale);normalized.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);normalized.add(root);actor.add(normalized);bones=identifyBones(gltf,root,model.id);
 }
 resizeTextures(root);scene.add(actor);actor.updateMatrixWorld(true);
 const rest=[];root.traverse(o=>{if(o.isBone)rest.push({bone:o,quaternion:o.quaternion.clone(),position:o.position.clone()});});
 const missing=['leftUpper','leftElbow','leftWrist','rightUpper','rightElbow','rightWrist','leftThigh','leftKnee','leftAnkle','rightThigh','rightKnee','rightAnkle'].filter(k=>!bones[k]);
 if(missing.length)throw Error(model.name+': missing joints '+missing.join(', '));
 const feet=[bones.leftAnkle,bones.rightAnkle].map(b=>actor.worldToLocal(b.getWorldPosition(vector()))),footHeight=Math.min(...feet.map(p=>p.y));
 const poseRest=[...new Set(Object.values(bones).filter(Boolean))].map(bone=>({bone,quaternion:bone.quaternion.clone(),position:bone.position.clone()}));
 const legs={};for(const side of ['left','right']){
  const upper=bones[side+'Thigh'],knee=bones[side+'Knee'],ankle=bones[side+'Ankle'],a=upper.getWorldPosition(vector()),b=knee.getWorldPosition(vector()),p=ankle.getWorldPosition(vector());
  legs[side]={upper,knee,ankle,base:p.clone(),upperLength:a.distanceTo(b),lowerLength:b.distanceTo(p),neutral:ankle.getWorldQuaternion(new THREE.Quaternion())};
 }
 const animated=new Set(poseRest.map(r=>r.bone));root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=animated.has(o);});
 // Gift reaction: a synthetic smile morph and a floor uplight applied in the shader.
 const smile=addSmile(actor,root,model.mouth),glow=addGlow(root,catalog.height);glow.uGlowTint.value.set(model.color);
 const entry={model,actor,root,bones,rest,poseRest,legs,footHeight,auto,smile,glow,trail:[[],[]],motion:[],handLight:createHandLight(actor)};actor.visible=false;api.loaded++;
 await bakeMotion(entry);
 api.diagnostics.push({id:model.id,autoRig:auto,bones:rest.length,footHeight,limbs:Object.fromEntries(Object.entries(bones).filter(([,b])=>b).map(([k,b])=>[k,b.name]))});
 return entry;
}

// ---------- Club choreography ----------
// One loop = 64 beats = eight 8-counts, one club move per 8-count. Every move is a
// pure function of the beat, so the loop is seamless and all dancers stay in sync.
const BEATS=64,BAKE_FPS=30,FRAMES=Math.round(catalog.duration*BAKE_FPS);
const clamp01=x=>Math.min(1,Math.max(0,x)),sm=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
// Fast attack with a little overshoot, then hold: moves "hit" the beat.
const outBack=x=>{x=clamp01(x);const c=1.5;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
const blend=(a,b,k)=>Array.isArray(a)?a.map((v,i)=>blend(v,b[i],k)):typeof a==='object'?Object.fromEntries(Object.keys(a).map(key=>[key,blend(a[key],b[key],k)])):a+(b-a)*k;
const wrap=(i,n)=>((i%n)+n)%n;
function hit(keys,t,attack=.4){const i=Math.floor(t);return blend(keys[wrap(i-1,keys.length)],keys[wrap(i,keys.length)],outBack((t-i)/attack));}
const onBeat=b=>Math.pow(.5+.5*Math.cos(b*Math.PI*2),1.6);
// Hand (h) and elbow hint (e) relative to the shoulder: [outwards, up, forwards],
// in units of arm reach (hand) and upper-arm length (elbow).
const ARM={
 fwd:{h:[-.02,-.3,.62],e:[.4,-.75,-.05]},back:{h:[.24,-.5,.2],e:[.35,-.5,-.7]},
 up:{h:[.14,.96,.18],e:[.75,.35,.1]},load:{h:[.34,.26,.22],e:[.9,-.25,0]},hip:{h:[.14,-.7,.04],e:[.9,-.35,-.25]},
 point:{h:[.5,.6,.56],e:[.75,.25,.25]},pull:{h:[.06,-.1,.52],e:[.8,-.45,-.1]},guard:{h:[.04,-.32,.56],e:[.55,-.7,-.1]},
 clap:{h:[-.3,-.08,.68],e:[.7,-.45,.05]},open:{h:[.46,.02,.46],e:[.85,-.3,0]},clapUp:{h:[-.27,.9,.26],e:[.8,.45,.15]},openUp:{h:[.44,.8,.2],e:[.9,.3,.1]},
 shimmy:{h:[.16,-.3,.52],e:[.75,-.6,0]},punch:{h:[.04,-.56,.46],e:[.65,-.5,.2]},vee:{h:[.56,.76,.2],e:[.9,.3,.1]}
};
// Club two-step: hips ride over the supporting foot while the other foot lifts on
// every beat. The left foot carries the weight on even beats.
function body(b,{dip=11,sway=9,lift=10,inward=.3,knee=0,hop=0,yaw=.1,planted=false}={}){
 const u=b-Math.floor(b),arc=Math.sin(Math.PI*u),even=wrap(Math.floor(b),2)===0,s=Math.sin(Math.PI*b),air=hop*arc;
 const still={o:1,l:air,f:0},free=planted?still:{o:1-inward*arc,l:(lift+knee)*arc+air,f:(knee?.5*knee:3)*arc};
 return {L:ARM.hip,R:ARM.hip,fL:even?still:free,fR:even?free:still,
  hip:{x:sway*s,y:-6-dip*onBeat(b)+air,z:0,roll:.045*s,yaw:yaw*s},
  sp:{pitch:.07*onBeat(b-.08),pitch2:0,roll:-.07*Math.sin(Math.PI*(b-.15)),twist:0},
  hd:{nod:.13*onBeat(b-.18)-.02,tilt:.07*Math.sin(Math.PI*(b-.35)),turn:0}};
}
const swapAt=b=>sm(3.7,4.15,b);
const MOVES=[
 // 1. Bounce groove: deep knee bounce, fists pumping like running arms.
 b=>{const f=body(b,{dip:17,sway:6,planted:true,yaw:.12});f.L=hit([ARM.fwd,ARM.back],b);f.R=hit([ARM.back,ARM.fwd],b);f.sp.twist=-.14*Math.sin(Math.PI*(b-.1));return f;},
 // 2. Fist pump: one fist punches the air on every beat, switching hands after four.
 b=>{const f=body(b,{dip:12,sway:10}),w=swapAt(b),pump=hit([ARM.up,ARM.load],b*2);f.L=blend(pump,ARM.hip,w);f.R=blend(ARM.hip,pump,w);f.sp.twist=.15*(1-2*w);f.hd.nod+=.04*onBeat(b-.2);return f;},
 // 3. Point & pull: point to the crowd, snap the fist back to the chest.
 b=>{const f=body(b,{dip:11,sway:9,yaw:.16}),w=swapAt(b),act=hit([ARM.point,ARM.pull],b);f.L=blend(act,ARM.guard,w);f.R=blend(ARM.guard,act,w);f.sp.twist=.12*(1-2*w)*(.6+.4*onBeat(b));return f;},
 // 4. Clap in front, then overhead.
 b=>{const f=body(b,{dip:11,sway:9}),w=sm(3.6,4.1,b),clap=blend(hit([ARM.clap,ARM.open],b*2,.32),hit([ARM.clapUp,ARM.openUp],b*2,.32),w);f.L=clap;f.R=clap;f.hd.nod-=.05*w;return f;},
 // 5. Hands up wave: both arms overhead, swinging with the hips.
 b=>{const f=body(b,{dip:9,sway:13,yaw:.06}),s=Math.sin(Math.PI*(b-.25));f.L={h:[.4+.22*s,.86,.14],e:[.8,.35,0]};f.R={h:[.4-.22*s,.86,.14],e:[.8,.35,0]};f.hip.roll*=1.6;f.hd.nod-=.06;return f;},
 // 6. Shimmy & body roll: shoulders shake twice per beat over a slow body wave.
 b=>{const f=body(b,{dip:0,sway:6,planted:true,yaw:.05}),roll=Math.sin(Math.PI*b);f.hip.y=-6-13*(.5+.5*Math.cos(Math.PI*b));f.hip.z=6*roll;f.sp.pitch=.12*Math.sin(Math.PI*(b-.2));f.sp.pitch2=.1*Math.sin(Math.PI*(b-.45));f.sp.twist=.11*Math.sin(Math.PI*4*b);f.hd.nod=.08*Math.sin(Math.PI*(b-.7));f.L=blend(ARM.shimmy,ARM.load,.25+.25*roll);f.R=blend(ARM.shimmy,ARM.load,.25-.25*roll);return f;},
 // 7. Knee lift: alternate knees on each beat, both fists punching down to the knee.
 b=>{const f=body(b,{dip:8,sway:7,lift:0,knee:38,inward:.12,yaw:.14}),arms=hit([ARM.punch,ARM.vee],b*2);f.L=arms;f.R=arms;f.sp.pitch=.15*onBeat(b);f.hd.nod+=.05*onBeat(b-.15);return f;},
 // 8. Jump: small hops on every beat, arms thrown up in a V in the air.
 b=>{const f=body(b,{dip:12,sway:3,planted:true,hop:10,yaw:.05}),arms=hit([ARM.load,ARM.vee],b*2,.35);f.L=arms;f.R=arms;f.hd.nod-=.04;return f;}
];
function mirrorFrame(f){return {...f,L:f.R,R:f.L,fL:f.fR,fR:f.fL,hip:{...f.hip,x:-f.hip.x,roll:-f.hip.roll,yaw:-f.hip.yaw},sp:{...f.sp,roll:-f.sp.roll,twist:-f.sp.twist},hd:{...f.hd,tilt:-f.hd.tilt,turn:-f.hd.turn}};}
function danceFrame(phase,mirror){
 const beats=phase/catalog.duration*BEATS,index=Math.floor(beats/8),b=beats-index*8;
 // Each new move takes over from the previous one during its first beats.
 const frame=blend(MOVES[wrap(index-1,MOVES.length)](b+8),MOVES[wrap(index,MOVES.length)](b),sm(0,.6,b));
 return mirror?mirrorFrame(frame):frame;
}
function solveArms(entry,frame){
 const {actor,bones}=entry,H=catalog.height;
 const local=bone=>actor.worldToLocal(bone.getWorldPosition(vector()));
 const left=local(bones.leftUpper),right=local(bones.rightUpper),cx=(left.x+right.x)/2,cz=(left.z+right.z)/2+3;
 // Chest/belly volume measured from the shoulders, so it fits each model's own depth.
 const inside=(p,m=0)=>p.y>H*.42&&p.y<H*.76&&Math.abs(p.x-cx)<20+m&&p.z<cz+18+m&&p.z>cz-22;
 for(const side of ['left','right']){
  const upper=bones[side+'Upper'],elbow=bones[side+'Elbow'],wrist=bones[side+'Wrist'],a=local(upper),l1=a.distanceTo(local(elbow)),l2=local(elbow).distanceTo(local(wrist)),sign=side==='left'?1:-1,reach=l1+l2;
  const pose=side==='left'?frame.L:frame.R;
  const target=vector(a.x+sign*pose.h[0]*reach,a.y+pose.h[1]*reach,a.z+pose.h[2]*reach),hint=vector(a.x+sign*pose.e[0]*l1,a.y+pose.e[1]*l1,a.z+pose.e[2]*l1);
  if(inside(target,6))target.z=cz+26;
  if(inside(hint,4)){hint.x=cx+sign*Math.max(32,Math.abs(hint.x-cx));hint.z=Math.max(hint.z,cz+8);}
  let joint;
  for(let pass=0;pass<5;pass++){
   const delta=target.clone().sub(a),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+2,reach*.97),axis=delta.normalize();
   target.copy(a).addScaledVector(axis,distance);
   const pole=hint.clone().sub(a),bend=pole.addScaledVector(axis,-pole.dot(axis));
   if(bend.lengthSq()<.01)bend.set(sign,-.5,.3).addScaledVector(axis,-vector(sign,-.5,.3).dot(axis));bend.normalize();
   const along=(l1*l1-l2*l2+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,l1*l1-along*along));
   joint=a.clone().addScaledVector(axis,along).addScaledVector(bend,rise);
   let blocked=false;
   for(const [from,to,startAt] of [[a,joint,.4],[joint,target,0]])for(let t=startAt;t<=1;t+=.1)if(inside(from.clone().lerp(to,t)))blocked=true;
   if(!blocked)break;
   target.z+=12;hint.z+=14;hint.x=cx+sign*Math.max(34,Math.abs(hint.x-cx));
  }
  aim(upper,elbow,joint.clone().sub(a),actor);aim(elbow,wrist,target.clone().sub(local(elbow)),actor);
  // A relaxed hand follows the forearm instead of retaining a rigid bind-pose twist.
  const rest=entry.poseRest.find(r=>r.bone===wrist);wrist.quaternion.copy(rest.quaternion);wrist.updateWorldMatrix(false,false);
 }
}
function worldRotate(bone,axis,angle){
 if(!bone)return;const current=bone.getWorldQuaternion(new THREE.Quaternion()),parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 bone.quaternion.copy(parent.multiply(new THREE.Quaternion().setFromAxisAngle(axis,angle).multiply(current)));bone.updateWorldMatrix(false,true,true);
}
function aim(bone,child,direction,actor){
 const from=child.getWorldPosition(vector()).sub(bone.getWorldPosition(vector())).normalize(),to=direction.clone().normalize();if(actor)to.applyQuaternion(actor.quaternion);
 if(!Number.isFinite(to.x)||from.lengthSq()<.1||to.lengthSq()<.1)return;
 // Imported rigs may contain reflected/scaled parent nodes. Transform directions
 // through the actual parent matrix instead of decomposing its world quaternion.
 const parentInverse=bone.parent.matrixWorld.clone().invert();from.transformDirection(parentInverse);to.transformDirection(parentInverse);
 bone.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));bone.updateWorldMatrix(false,true,true);
}
function solvePose(entry,phase){
 const {actor,bones,poseRest,legs}=entry,modelIndex=catalog.models.findIndex(m=>m.id===entry.model.id),f=danceFrame(phase,modelIndex%2===1);
 for(const item of poseRest){item.bone.quaternion.copy(item.quaternion);item.bone.position.copy(item.position);}
 const yaw=f.hip.yaw;
 actor.position.set(f.hip.x,-8+f.hip.y,f.hip.z);actor.rotation.set(0,yaw,f.hip.roll);actor.updateMatrixWorld(true);
 const right=vector(1,0,0).applyQuaternion(actor.quaternion),forward=vector(0,0,1).applyQuaternion(actor.quaternion);
 // Shoulders counter-rotate against the hips; the chest follows the spine a moment later.
 const chest=bones.chest&&bones.chest!==bones.spine?bones.chest:null;
 worldRotate(bones.spine,up,f.sp.twist-yaw*.6);
 worldRotate(bones.spine,right,f.sp.pitch);
 if(chest)worldRotate(chest,right,f.sp.pitch2);
 worldRotate(chest||bones.spine,forward,f.sp.roll);
 // Two-bone leg IK. Feet stay planted facing the audience while the hips twist above them.
 const longCoat=entry.model.id==='neuvillette';
 const centerX=(legs.left.base.x+legs.right.base.x)/2,centerZ=(legs.left.base.z+legs.right.base.z)/2,half=THREE.MathUtils.clamp(Math.abs(legs.left.base.x-legs.right.base.x)/2+13,23,28),targets={};
 let lowerBody=0;
 for(const side of ['left','right']){
  const leg=legs[side],foot=side==='left'?f.fL:f.fR,sign=side==='left'?1:-1;
  // Keep Neuvillette's boots outside the long coat even on the inward step.
  const target=vector(centerX+sign*(half*foot.o+(longCoat?18:0)),leg.base.y+foot.l,centerZ+foot.f);
  const hipPoint=leg.upper.getWorldPosition(vector()),reach=(leg.upperLength+leg.lowerLength)*.985,horizontal=(hipPoint.x-target.x)**2+(hipPoint.z-target.z)**2;
  lowerBody=Math.max(lowerBody,hipPoint.y-target.y-Math.sqrt(Math.max(1,reach*reach-horizontal)));targets[side]=target;
 }
 actor.position.y-=Math.max(0,lowerBody)+(longCoat?5:0);actor.updateMatrixWorld(true);
 for(const side of ['left','right']){
  const leg=legs[side],hipPoint=leg.upper.getWorldPosition(vector()),target=targets[side],delta=target.clone().sub(hipPoint),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(leg.upperLength-leg.lowerLength)+.1,(leg.upperLength+leg.lowerLength)*.999),axis=delta.normalize();
  // Knees track over the toes, opening slightly outwards like a real club bounce.
  const pole=vector((side==='left'?1:-1)*(longCoat?.75:.3),0,1),bend=pole.addScaledVector(axis,-pole.dot(axis)).normalize(),along=(leg.upperLength**2-leg.lowerLength**2+distance**2)/(2*distance),rise=Math.sqrt(Math.max(0,leg.upperLength**2-along**2));
  const knee=hipPoint.clone().addScaledVector(axis,along).addScaledVector(bend,rise);
  aim(leg.upper,leg.knee,knee.clone().sub(hipPoint));aim(leg.knee,leg.ankle,target.clone().sub(leg.knee.getWorldPosition(vector())));
  const parent=leg.ankle.parent.getWorldQuaternion(new THREE.Quaternion()).invert();leg.ankle.quaternion.copy(parent.multiply(leg.neutral));leg.ankle.updateWorldMatrix(false,false);
 }
 solveArms(entry,f);
 // The head nods just after the beat, tilts with the sway and keeps facing the audience.
 if(bones.head){
  worldRotate(bones.head,up,-yaw*.5-f.sp.twist*.7+f.hd.turn);
  worldRotate(bones.head,right,f.hd.nod);
  worldRotate(bones.head,forward,f.hd.tilt);
 }
 actor.updateMatrixWorld(true);
 entry.handRange??={min:Infinity,max:-Infinity};for(const side of ['left','right']){const y=actor.worldToLocal(bones[side+'Wrist'].getWorldPosition(vector())).y;entry.handRange.min=Math.min(entry.handRange.min,y);entry.handRange.max=Math.max(entry.handRange.max,y);}
 return {position:actor.position.clone(),quaternion:actor.quaternion.clone(),bones:poseRest.map(r=>r.bone.quaternion.clone())};
}
async function bakeMotion(entry){
 for(let i=0;i<=FRAMES;i++){
  entry.motion.push(solvePose(entry,i===FRAMES?0:i/FRAMES*catalog.duration));
  if(i%32===31)await new Promise(r=>setTimeout(r,0));
 }
 entry.actor.visible=false;
}
function poseActor(entry,placement,time,paused){
 entry.placement=placement;
 const {actor,bones,poseRest,motion}=entry,at=Math.min(FRAMES-1e-6,placement.phase/catalog.duration*FRAMES),index=Math.floor(at),a=motion[index],b=motion[index+1],blend=at-index;
 actor.position.copy(a.position).lerp(b.position,blend).add(vector(placement.x,placement.y,placement.z));actor.quaternion.copy(a.quaternion).slerp(b.quaternion,blend);
 for(let i=0;i<poseRest.length;i++)poseRest[i].bone.quaternion.copy(a.bones[i]).slerp(b.bones[i],blend);
 actor.updateMatrixWorld(true);
 // Gift reaction: smile and tilt the head playfully to the side.
 const glow=placement.glow||0;
 for(const mesh of entry.smile)mesh.morphTargetInfluences[0]=glow;
 entry.glow.uGlow.value=glow;entry.glow.uGlowFloor.value=actor.position.y;
 if(glow>0&&bones.head){
  const tilt=Math.sin(time/1000*Math.PI*148/60)*.03;
  worldRotate(bones.head,vector(1,0,0).applyQuaternion(actor.quaternion),.03*glow);
  worldRotate(bones.head,vector(0,0,1).applyQuaternion(actor.quaternion),(.11+tilt)*glow);
 }
 entry.hands=[bones.leftWrist,bones.rightWrist].map(b=>b.getWorldPosition(vector()).toArray());
 const hand=actor.worldToLocal(bones.rightWrist.getWorldPosition(vector())),forearm=actor.worldToLocal(bones.rightElbow.getWorldPosition(vector())),axis=hand.clone().sub(forearm).normalize();
 entry.handLight.group.position.copy(hand).addScaledVector(axis,5);entry.handLight.group.quaternion.setFromUnitVectors(up,axis);entry.handLight.group.updateMatrixWorld(true);
 if(paused)for(const trail of entry.trail)trail.length=0;
 if(!paused)for(let side=0;side<2;side++){
  const trail=entry.trail[side];if(time<(trail.at(-1)?.time||0)||time-(trail.at(-1)?.time||time)>1000)trail.length=0;
  if(!trail.length||time-trail.at(-1).time>=40)trail.push({point:entry.hands[side],time});
  while(trail.length&&time-trail[0].time>700)trail.shift();
 }
}

api.prepare=(pose,time,config,colors=['#ee38c8','#38dcff','#7650ff'])=>{
 if(!api.ready||config?.enabled===false){frameActors=[];return;}
 const placements=catalog.formation(config,time),phase=catalog.clock(config,time).phase;
 const desired=Math.max(...placements.map(p=>globalThis.ClubCamera.project([p.x,p.y,p.z],pose).scale*390*1.5)),need=desired*1.3,sizes=[256,384,512,768,1024],tile=need<=TILE&&need>=TILE*.7?TILE:sizes.find(s=>s>=need)||1024;
 if(tile!==TILE){TILE=tile;renderer.setSize(TILE*5,TILE,false);}
 camera.position.set((pose.targetX||0)+Math.sin(pose.yaw)*pose.distance,pose.height,(pose.targetZ??450)+Math.cos(pose.yaw)*pose.distance);
 camera.lookAt(pose.targetX||0,pose.targetY??55,pose.targetZ??450);camera.zoom=pose.zoom||1;
 renderer.setScissorTest(false);renderer.setViewport(0,0,TILE*5,TILE);renderer.clear(true,true,true);renderer.setScissorTest(true);
 frameActors=[];
 for(const actor of api.actors)actor.actor.visible=false;
 for(const [index,placement] of placements.entries()){
  const entry=api.actors.find(a=>a.model.id===placement.id);if(!entry)continue;
  const p=globalThis.ClubCamera.project([placement.x,placement.y,placement.z],pose),fullW=360*p.scale,fullH=390*p.scale;
  // Render only the visible crop: close-ups no longer stretch a tiny full-body sprite.
  const x=Math.max(-20,p.x-fullW/2),y=Math.max(-20,p.y-fullH*.88),w=Math.min(740,p.x+fullW/2)-x,h=Math.min(1300,p.y+fullH*.12)-y;
  if(p.depth<100||w<=0||h<=0){for(const trail of entry.trail)trail.length=0;continue;}
  const focus=config.focus,glow=focus&&focus.slot===placement.slot&&time>=focus.startedAt&&time<focus.until?THREE.MathUtils.smoothstep(Math.min((time-focus.startedAt)/700,(focus.until-time)/800),0,1):0;
  poseActor(entry,{...placement,phase,glow},time,config.pausedAt!==null);entry.actor.visible=true;
  const beat=time/1000*148/60,color=new THREE.Color(colors[Math.floor(beat)%colors.length]),pulse=.65+.35*Math.pow(1-beat%1,2);
  entry.handLight.tube.material.color.copy(color).lerp(new THREE.Color(0xffffff),.25*pulse);entry.handLight.halo.material.color.copy(color);entry.handLight.halo.material.opacity=.12+.16*pulse;
  camera.setViewOffset(720,1280,x-(pose.shiftX||0),y+140,w,h);camera.updateProjectionMatrix();
  renderer.setViewport(index*TILE,0,TILE,TILE);renderer.setScissor(index*TILE,0,TILE,TILE);renderer.render(scene,camera);
  entry.actor.visible=false;
  frameActors.push({entry,placement,index,glow,bounds:{x,y,w,h},point:p});
 }
 renderer.setScissorTest(false);api.frames++;lastTime=time;
};
api.draw=(c,id)=>{
 const frame=frameActors.find(f=>f.placement.id===id);if(!frame)return false;
 const {entry,placement,index,glow,bounds:{x,y,w,h},point:p}=frame;
 if(glow>0)drawUplight(c,frame,false);
 c.save();c.globalCompositeOperation='screen';
 const color=placement.color,gradient=c.createRadialGradient(p.x,p.y,1,p.x,p.y,Math.max(2,80*p.scale));gradient.addColorStop(0,color+'65');gradient.addColorStop(1,color+'00');c.fillStyle=gradient;c.beginPath();c.ellipse(p.x,p.y,80*p.scale,28*p.scale,0,0,Math.PI*2);c.fill();
 c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=12;c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,62*p.scale,18*p.scale,0,0,Math.PI*2);c.stroke();
 for(const trail of entry.trail)if(trail.length>1){
  for(let i=1;i<trail.length;i++){const a=globalThis.ClubCamera.project(trail[i-1].point,api.pose),b=globalThis.ClubCamera.project(trail[i].point,api.pose);c.globalAlpha=Math.max(0,1-(lastTime-trail[i].time)/700)*.65;c.lineWidth=2.5+3*p.scale;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();if(i%3===0){c.fillStyle=color;c.globalAlpha*=.5;c.beginPath();c.ellipse(b.x,b.y,3+2*p.scale,2+2*p.scale,0,0,Math.PI*2);c.fill();}}
  const hand=globalThis.ClubCamera.project(trail.at(-1).point,api.pose);c.globalAlpha=.85;c.fillStyle=color;c.shadowBlur=16;c.beginPath();c.arc(hand.x,hand.y,2.5+2*p.scale,0,Math.PI*2);c.fill();
 }
 c.restore();
 if(placement.moving){c.save();c.globalAlpha=.12;for(let i=1;i<=2;i++)c.drawImage(canvas,index*TILE,0,TILE,TILE,x-i*14,y+i*3,w,h);c.restore();}
 c.drawImage(canvas,index*TILE,0,TILE,TILE,x,y,w,h);
 if(glow>0)drawUplight(c,frame,true);
 return true;
};
// Floor spotlight in front of the gifted dancer, shining up onto the face.
function drawUplight(c,{placement,glow,point:p},front){
 const project=point=>globalThis.ClubCamera.project(point,api.pose),color=placement.color,t=lastTime/1000;
 const lamp=project([placement.x,placement.y,placement.z+46]),top=project([placement.x,placement.y+catalog.height*1.05,placement.z]),s=p.scale;
 c.save();c.globalCompositeOperation='screen';
 if(!front){
  // Wide cone behind the body, rising from the lamp and fading towards the head.
  const spread=95*s,cone=c.createLinearGradient(0,lamp.y,0,top.y);
  cone.addColorStop(0,`rgba(255,244,226,${.5*glow})`);cone.addColorStop(.55,color+Math.round(70*glow).toString(16).padStart(2,'0'));cone.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=cone;c.beginPath();c.moveTo(lamp.x-14*s,lamp.y);c.lineTo(top.x-spread,top.y);c.lineTo(top.x+spread,top.y);c.lineTo(lamp.x+14*s,lamp.y);c.closePath();c.fill();
  const pool=c.createRadialGradient(p.x,p.y,1,p.x,p.y,120*s);pool.addColorStop(0,`rgba(255,248,236,${.75*glow})`);pool.addColorStop(.45,color+Math.round(110*glow).toString(16).padStart(2,'0'));pool.addColorStop(1,color+'00');
  c.fillStyle=pool;c.beginPath();c.ellipse(p.x,p.y,120*s,38*s,0,0,Math.PI*2);c.fill();
  // Motes drifting up through the beam.
  c.fillStyle='#fff8ea';
  for(let i=0;i<14;i++){const k=(t*.35+i*.137)%1,side=Math.sin(i*12.9898)*.8,px=lamp.x+(top.x-lamp.x)*k+side*spread*k,py=lamp.y+(top.y-lamp.y)*k;c.globalAlpha=glow*Math.sin(k*Math.PI)*.8;c.beginPath();c.arc(px,py,(1.2+1.6*((i*7)%3)/2)*Math.max(.6,s),0,Math.PI*2);c.fill();}
 }else{
  // The lamp itself: a bright lens on the floor in front of the feet.
  c.globalAlpha=glow;c.shadowColor=color;c.shadowBlur=24*s;
  const lens=c.createRadialGradient(lamp.x,lamp.y,0,lamp.x,lamp.y,34*s);lens.addColorStop(0,'rgba(255,255,255,.95)');lens.addColorStop(.3,'rgba(255,240,215,.75)');lens.addColorStop(1,color+'00');
  c.fillStyle=lens;c.beginPath();c.ellipse(lamp.x,lamp.y,34*s,13*s,0,0,Math.PI*2);c.fill();
  c.fillStyle='#ffffff';c.beginPath();c.ellipse(lamp.x,lamp.y,9*s,3.5*s,0,0,Math.PI*2);c.fill();
 }
 c.restore();
}
api.drawLabel=(c,id)=>{
 const frame=frameActors.find(f=>f.placement.id===id);if(!frame||frame.point.depth<100)return;
 const {placement,point:p}=frame,color=placement.color;
 const label=globalThis.ClubCamera.project([placement.x,placement.y+catalog.height+23,placement.z],api.pose);
 label.y=Math.max(55,label.y);
 c.save();c.textAlign='center';c.lineJoin='round';c.strokeStyle='#06101c';c.lineWidth=3;c.font=`900 ${Math.min(30,Math.max(14,25*p.scale))}px Segoe UI`;
 const width=c.measureText('DANCER '+placement.slot).width+14;c.fillStyle='#081321db';c.beginPath();c.roundRect(label.x-width/2,label.y-23,width,35,6);c.fill();
 c.strokeText('DANCER '+placement.slot,label.x,label.y-6);c.fillStyle=color;c.fillText('DANCER '+placement.slot,label.x,label.y-6);
 c.font=`600 ${Math.min(18,Math.max(9,16*p.scale))}px Segoe UI`;c.strokeText(placement.name,label.x,label.y+6);c.fillStyle='#f3f8ff';c.fillText(placement.name,label.x,label.y+6);c.restore();
};
api.bounds=id=>{const frame=frameActors.find(f=>f.placement.id===id);if(!frame)return undefined;const pad=frame.glow>0?130*frame.point.scale:0;return {x:frame.bounds.x-8-pad,y:frame.bounds.y-16-pad,width:frame.bounds.w+16+pad*2,height:frame.bounds.h+32+pad*2};};
api.inspectLegs=()=>api.actors.flatMap(entry=>Object.entries(entry.legs).map(([side,leg])=>{
 const hip=leg.upper.getWorldPosition(vector()),knee=leg.knee.getWorldPosition(vector()),foot=leg.ankle.getWorldPosition(vector()),a=knee.clone().sub(hip).normalize(),b=foot.clone().sub(knee).normalize();
 const desired=leg.neutral.clone(),actual=leg.ankle.getWorldQuaternion(new THREE.Quaternion());
 return {id:entry.model.id,side,ground:foot.y-(entry.placement?.y||0)-leg.base.y,knee:Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1))*180/Math.PI,tilt:desired.angleTo(actual)*180/Math.PI};
}));
const prepare=api.prepare;api.prepare=(pose,...args)=>{api.pose=pose;try{prepare(pose,...args);}catch(error){api.error=error.message;console.error('Dancer 3D render:',error);}};

(async()=>{
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(TILE*5,TILE,false);renderer.setClearColor(0x000000,0);renderer.autoClear=false;renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Sequential decoding limits simultaneous model/texture allocations.
  for(const model of catalog.models)api.actors.push(await loadActor(model));
  scene.updateMatrixWorld(true);scene.matrixWorldAutoUpdate=false;
  api.ready=true;
 }catch(error){api.error=error.message;console.error('Không tải được đội hình 3D:',error);}
})();
