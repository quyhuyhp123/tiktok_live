import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

const catalog=globalThis.DancerCatalog;let TILE=256;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(2*Math.atan(640/1060)*180/Math.PI,720/1280,5,18000);
const canvas=document.createElement('canvas');
const api={ready:false,error:'',loaded:0,total:5,actors:[],frames:0,canvas,diagnostics:[],choreography:'freestyle-6-v2'};
globalThis.Dancer3D=api;
let renderer,clip,frameActors=[],lastTime=0;
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
 const entry={model,actor,root,bones,rest,poseRest,legs,footHeight,auto,trail:[[],[]],motion:[],handLight:createHandLight(actor)};actor.visible=false;api.loaded++;
 await bakeMotion(entry);
 api.diagnostics.push({id:model.id,autoRig:auto,bones:rest.length,footHeight,limbs:Object.fromEntries(Object.entries(bones).filter(([,b])=>b).map(([k,b])=>[k,b.name]))});
 return entry;
}

function rawPose(time){
 time=(time+catalog.duration)%catalog.duration;
 const at=time*clip.fps,a=Math.floor(at)%clip.frames.length,b=(a+1)%clip.frames.length,p=at-Math.floor(at);
 const seam=THREE.MathUtils.smoothstep(time,catalog.duration-.26,catalog.duration);
 return clip.frames[a].map((v,i)=>vector(v[0]+(clip.frames[b][i][0]-v[0])*p,v[1]+(clip.frames[b][i][1]-v[1])*p,v[2]+(clip.frames[b][i][2]-v[2])*p).lerp(vector(...clip.frames[0][i].slice(0,3)),seam));
}
function samplePose(time){
 // Symmetric filtering removes capture jitter without lagging behind the music.
 const frames=[-.09,-.045,0,.045,.09].map(dt=>rawPose(time+dt)),weights=[1,2,4,2,1];
 return frames[0].map((_,i)=>frames.reduce((sum,frame,j)=>sum.addScaledVector(frame[i],weights[j]/10),vector()));
}
function solveArms(entry,points,phase){
 const {actor,bones}=entry;
 const local=bone=>actor.worldToLocal(bone.getWorldPosition(vector()));
 // Stop below the shoulder line: treating the neck/shoulders as a wide box
 // incorrectly pushed even overhead gestures forwards.
 const torso=(p,margin=0)=>p.y>catalog.height*.42&&p.y<catalog.height*.75&&Math.abs(p.x)<35+margin;
 for(const [side,s,e,w] of [['left',11,13,15],['right',12,14,16]]){
  const upper=bones[side+'Upper'],elbow=bones[side+'Elbow'],wrist=bones[side+'Wrist'],a=local(upper),original=local(elbow),end=local(wrist),l1=a.distanceTo(original),l2=original.distanceTo(end),sign=a.x>=0?1:-1;
  const d1=points[e].clone().sub(points[s]),d2=points[w].clone().sub(points[e]);
  d1.z=THREE.MathUtils.clamp(d1.z,-.12,.24);d2.z=THREE.MathUtils.clamp(d2.z,-.12,.3);
  const desiredElbow=a.clone().addScaledVector(d1.normalize(),l1),target=desiredElbow.clone().addScaledVector(d2.normalize(),l2);
  const modelIndex=catalog.models.findIndex(m=>m.id===entry.model.id),phrase=phase/catalog.duration*6+modelIndex,step=Math.floor(phrase),fraction=phrase-step;
  const beat=phase/catalog.duration*Math.PI*2*32,reach=l1+l2;
  const gesture=mode=>{
   const wave=Math.sin(beat+(side==='left'?0:Math.PI)),punch=.5+.5*wave;
   if(mode===0)return {hand:vector(a.x+sign*reach*(.32+.13*wave),a.y+reach*(.67+.1*Math.cos(beat)),a.z+reach*.15),elbow:vector(a.x+sign*l1*.8,a.y+l1*.4,a.z+15)};
   if(mode===1)return {hand:vector(a.x+sign*reach*.86,a.y+reach*.24*wave,a.z+reach*.12),elbow:vector(a.x+sign*l1*.85,a.y+l1*.15*wave,a.z+12)};
   // Windmill: large circles beside the shoulders, outside the torso.
   if(mode===3)return {hand:vector(a.x+sign*reach*(.62+.24*Math.cos(beat*.5)),a.y+reach*.58*Math.sin(beat*.5),a.z+25+reach*.13*Math.cos(beat*.5)),elbow:vector(a.x+sign*l1*.9,a.y+l1*.35*Math.sin(beat*.5),a.z+25)};
   // Alternating disco reach: one hand overhead while the other sweeps towards the hip.
   if(mode===4)return {hand:vector(a.x+sign*reach*(.3+.38*(1-punch)),a.y+reach*(-.58+1.38*punch),a.z+32),elbow:vector(a.x+sign*l1*.8,a.y+l1*(-.4+.8*punch),a.z+25)};
   // Bent-elbow shoulder pumps, hands up beside the head rather than in front of it.
   if(mode===5)return {hand:vector(a.x+sign*reach*.55,a.y+reach*(.35+.23*wave),a.z+30),elbow:vector(a.x+sign*l1*.9,a.y-l1*.15,a.z+20)};
   return {hand:vector(a.x-sign*reach*(.18+.18*punch),a.y-reach*(.12+.22*(1-punch)),a.z+reach*(.48+.3*punch)),elbow:vector(a.x+sign*l1*.65,a.y-l1*.45,a.z+l1*.45)};
  };
  // Six full phrases, with a smooth transition and a different start for each dancer.
  const current=gesture((step%6+6)%6),previous=gesture(((step-1)%6+6)%6),mix=THREE.MathUtils.smoothstep(fraction,0,.18);
  target.copy(previous.hand).lerp(current.hand,mix);desiredElbow.copy(previous.elbow).lerp(current.elbow,mix);
  // Cross-body gestures stay in front of the chest; elbows open out from the ribs.
  if(torso(target,14))target.z=Math.max(target.z,62);
  if(torso(desiredElbow,8)){desiredElbow.x=sign*Math.max(Math.abs(desiredElbow.x),51);desiredElbow.z=Math.max(desiredElbow.z,42);}
  let knee;
  for(let pass=0;pass<5;pass++){
   const delta=target.clone().sub(a),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+2,(l1+l2)*.96),axis=delta.normalize();
   target.copy(a).addScaledVector(axis,distance);
   const pole=desiredElbow.clone().sub(a),bend=pole.addScaledVector(axis,-pole.dot(axis));
   if(bend.lengthSq()<.01)bend.set(sign,0,1).addScaledVector(axis,-vector(sign,0,1).dot(axis));bend.normalize();
   const along=(l1*l1-l2*l2+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,l1*l1-along*along));
   knee=a.clone().addScaledVector(axis,along).addScaledVector(bend,rise);
   let blocked=false;
   for(const [from,to,start] of [[a,knee,.35],[knee,target,0]])for(let t=start;t<=1;t+=.1){const p=from.clone().lerp(to,t);if(torso(p)&&p.z<48)blocked=true;}
   if(!blocked)break;
   target.z+=24;desiredElbow.z+=35;desiredElbow.x=sign*Math.max(55,Math.abs(desiredElbow.x));
  }
  aim(upper,elbow,knee.clone().sub(a),actor);aim(elbow,wrist,target.clone().sub(local(elbow)),actor);
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
 const {actor,bones,poseRest,legs}=entry,points=samplePose(phase),hip=points[23].clone().add(points[24]).multiplyScalar(.5),shoulder=points[11].clone().add(points[12]).multiplyScalar(.5);
 for(const item of poseRest){item.bone.quaternion.copy(item.quaternion);item.bone.position.copy(item.position);}
 const tilt=THREE.MathUtils.clamp(Math.atan2(shoulder.x-hip.x,shoulder.y-hip.y),-.22,.22);
 const groove=phase/catalog.duration*Math.PI*2*16;
 const seam=THREE.MathUtils.smoothstep(phase,catalog.duration-.26,catalog.duration),yaw=Math.sin(phase*2)*.045*(1-seam)+Math.sin(groove)*.1,yawQ=new THREE.Quaternion().setFromAxisAngle(up,yaw);
 actor.position.set(Math.sin(groove)*5,-8-THREE.MathUtils.clamp((.5-shoulder.distanceTo(hip))*15,0,5),0);actor.rotation.set(0,yaw,-tilt*.3+Math.sin(groove)*.055);actor.updateMatrixWorld(true);
 worldRotate(bones.spine,up,THREE.MathUtils.clamp((points[11].z-points[12].z)*.35,-.16,.16));
 // Stable two-bone leg IK. Keep the knee bending forward and the planted boot flat.
 const centerX=(legs.left.base.x+legs.right.base.x)/2,stance=THREE.MathUtils.clamp(Math.abs(points[27].x-points[28].x)*catalog.height*.45,30,88),targets={};
 let lowerBody=0;
 for(const [side,index,other,sign] of [['left',27,28,1],['right',28,27,-1]]){
  const leg=legs[side],lift=THREE.MathUtils.clamp((points[index].y-points[other].y-.025)*catalog.height*.65,0,34);
  const target=vector(centerX+sign*stance*.5,leg.base.y+lift,leg.base.z+THREE.MathUtils.clamp((points[index].z-hip.z)*25,-16,16)).applyQuaternion(yawQ);
  const hipPoint=leg.upper.getWorldPosition(vector()),reach=(leg.upperLength+leg.lowerLength)*.985,horizontal=(hipPoint.x-target.x)**2+(hipPoint.z-target.z)**2;
  lowerBody=Math.max(lowerBody,hipPoint.y-target.y-Math.sqrt(Math.max(1,reach*reach-horizontal)));targets[side]=target;
 }
 actor.position.y-=Math.max(0,lowerBody);actor.updateMatrixWorld(true);
 for(const side of ['left','right']){
  const leg=legs[side],hipPoint=leg.upper.getWorldPosition(vector()),target=targets[side],delta=target.clone().sub(hipPoint),distance=THREE.MathUtils.clamp(delta.length(),Math.abs(leg.upperLength-leg.lowerLength)+.1,(leg.upperLength+leg.lowerLength)*.999),axis=delta.normalize();
  const pole=vector(side==='left'?.16:-.16,0,1).applyQuaternion(yawQ),bend=pole.addScaledVector(axis,-pole.dot(axis)).normalize(),along=(leg.upperLength**2-leg.lowerLength**2+distance**2)/(2*distance),rise=Math.sqrt(Math.max(0,leg.upperLength**2-along**2));
  const knee=hipPoint.clone().addScaledVector(axis,along).addScaledVector(bend,rise);
  aim(leg.upper,leg.knee,knee.clone().sub(hipPoint));aim(leg.knee,leg.ankle,target.clone().sub(leg.knee.getWorldPosition(vector())));
  const parent=leg.ankle.parent.getWorldQuaternion(new THREE.Quaternion()).invert();leg.ankle.quaternion.copy(parent.multiply(yawQ.clone().multiply(leg.neutral)));leg.ankle.updateWorldMatrix(false,false);
 }
 solveArms(entry,points,phase);
 actor.updateMatrixWorld(true);
 entry.handRange??={min:Infinity,max:-Infinity};for(const side of ['left','right']){const y=actor.worldToLocal(bones[side+'Wrist'].getWorldPosition(vector())).y;entry.handRange.min=Math.min(entry.handRange.min,y);entry.handRange.max=Math.max(entry.handRange.max,y);}
 return {position:actor.position.clone(),quaternion:actor.quaternion.clone(),bones:poseRest.map(r=>r.bone.quaternion.clone())};
}
async function bakeMotion(entry){
 for(let i=0;i<=clip.frames.length;i++){
  entry.motion.push(solvePose(entry,i===clip.frames.length?0:i/clip.fps));
  if(i%32===31)await new Promise(r=>setTimeout(r,0));
 }
 entry.actor.visible=false;
}
function poseActor(entry,placement,time,paused){
 entry.placement=placement;
 const {actor,bones,poseRest,motion}=entry,at=placement.phase*clip.fps,index=Math.floor(at),a=motion[index],b=motion[index+1],blend=at-index;
 actor.position.copy(a.position).lerp(b.position,blend).add(vector(placement.x,placement.y,placement.z));actor.quaternion.copy(a.quaternion).slerp(b.quaternion,blend);
 for(let i=0;i<poseRest.length;i++)poseRest[i].bone.quaternion.copy(a.bones[i]).slerp(b.bones[i],blend);
 actor.updateMatrixWorld(true);
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
 const desired=Math.max(...placements.map(p=>globalThis.ClubCamera.project([p.x,p.y,p.z],pose).scale*390*1.5)),tile=desired>1100?1024:desired<280?256:desired>320||TILE>256?384:256;
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
  poseActor(entry,{...placement,phase},time,config.pausedAt!==null);entry.actor.visible=true;
  const beat=time/1000*148/60,color=new THREE.Color(colors[Math.floor(beat)%colors.length]),pulse=.65+.35*Math.pow(1-beat%1,2);
  entry.handLight.tube.material.color.copy(color).lerp(new THREE.Color(0xffffff),.25*pulse);entry.handLight.halo.material.color.copy(color);entry.handLight.halo.material.opacity=.12+.16*pulse;
  camera.setViewOffset(720,1280,x-(pose.shiftX||0),y+140,w,h);camera.updateProjectionMatrix();
  renderer.setViewport(index*TILE,0,TILE,TILE);renderer.setScissor(index*TILE,0,TILE,TILE);renderer.render(scene,camera);
  entry.actor.visible=false;
  frameActors.push({entry,placement,index,bounds:{x,y,w,h},point:p});
 }
 renderer.setScissorTest(false);api.frames++;lastTime=time;
};
api.draw=(c,id)=>{
 const frame=frameActors.find(f=>f.placement.id===id);if(!frame)return false;
 const {entry,placement,index,bounds:{x,y,w,h},point:p}=frame;
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
 return true;
};
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
api.bounds=id=>{const frame=frameActors.find(f=>f.placement.id===id);return frame?{x:frame.bounds.x-8,y:frame.bounds.y-16,width:frame.bounds.w+16,height:frame.bounds.h+32}:undefined;};
api.inspectLegs=()=>api.actors.flatMap(entry=>Object.entries(entry.legs).map(([side,leg])=>{
 const hip=leg.upper.getWorldPosition(vector()),knee=leg.knee.getWorldPosition(vector()),foot=leg.ankle.getWorldPosition(vector()),a=knee.clone().sub(hip).normalize(),b=foot.clone().sub(knee).normalize();
 const desired=new THREE.Quaternion().setFromAxisAngle(up,entry.actor.rotation.y).multiply(leg.neutral),actual=leg.ankle.getWorldQuaternion(new THREE.Quaternion());
 return {id:entry.model.id,side,ground:foot.y-(entry.placement?.y||0)-leg.base.y,knee:Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1))*180/Math.PI,tilt:desired.angleTo(actual)*180/Math.PI};
}));
const prepare=api.prepare;api.prepare=(pose,...args)=>{api.pose=pose;try{prepare(pose,...args);}catch(error){api.error=error.message;console.error('Dancer 3D render:',error);}};

(async()=>{
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(TILE*5,TILE,false);renderer.setClearColor(0x000000,0);renderer.autoClear=false;renderer.outputColorSpace=THREE.SRGBColorSpace;
  clip=await (await fetch('/assets/dance/reference-402b-motion.json')).json();
  // Sequential decoding limits simultaneous model/texture allocations.
  for(const model of catalog.models)api.actors.push(await loadActor(model));
  scene.updateMatrixWorld(true);scene.matrixWorldAutoUpdate=false;
  api.ready=true;
 }catch(error){api.error=error.message;console.error('Không tải được đội hình 3D:',error);}
})();
