import * as THREE from 'three';

// The imported models have no facial blend shapes. A smile is synthesised as a
// morph target: front-facing vertices around the painted mouth line are lifted at
// the corners and slightly widened. The delta is computed in actor space (rest
// pose) and converted back into each mesh's bind space, so it follows the head
// bone while dancing.
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
function smileDelta(p,mouth,front){
 const hw=mouth.w,u=(p.x-mouth.x)/hw,dy=p.y-mouth.y,au=Math.abs(u);
 const fu=1-smooth(1.25,1.9,au),fy=1-smooth(0,dy>0?2.6:2.1,Math.abs(dy)),fz=smooth(front-3.4,front-2.4,p.z),f=fu*fy*fz;
 if(f<=0)return null;
 const s=smooth(.08,1.05,au),lift=(mouth.lift??.36)*hw;
 // Corners up, centre a touch down: the mouth line bends into a curve.
 return new THREE.Vector3(.11*hw*THREE.MathUtils.clamp(u,-1.25,1.25)*f,(lift*s*s-.12*lift*(1-s))*f,.08*hw*s*f);
}
function skinMatrix(mesh,i){
 const result=new THREE.Matrix4();
 if(!mesh.isSkinnedMesh)return result;
 const index=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight,sum=new Array(16).fill(0),bone=new THREE.Matrix4();
 for(let k=0;k<4;k++){
  const w=weight.getComponent(i,k);if(!w)continue;const b=index.getComponent(i,k);
  bone.multiplyMatrices(mesh.skeleton.bones[b].matrixWorld,mesh.skeleton.boneInverses[b]);
  for(let e=0;e<16;e++)sum[e]+=bone.elements[e]*w;
 }
 result.fromArray(sum);return result.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
}
export function addSmile(actor,root,mouth){
 if(!mouth)return [];
 actor.updateMatrixWorld(true);
 const toActor=actor.matrixWorld.clone().invert(),meshes=[],p=new THREE.Vector3();let front=-Infinity;
 root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const near=q=>Math.abs(q.x-mouth.x)<mouth.w*2&&q.y>mouth.y-2.4&&q.y<mouth.y+2.9;
 const found=[];
 for(const mesh of meshes){
  if(mesh.isSkinnedMesh)mesh.skeleton.update();
  const position=mesh.geometry.attributes.position,toLocal=toActor.clone().multiply(mesh.matrixWorld),list=[];
  for(let i=0;i<position.count;i++){mesh.getVertexPosition(i,p);p.applyMatrix4(toLocal);if(near(p)){list.push([i,p.clone()]);front=Math.max(front,p.z);}}
  if(list.length)found.push({mesh,toLocal,list});
 }
 const result=[];
 for(const {mesh,toLocal,list} of found){
  const local=new THREE.Matrix3().setFromMatrix4(toLocal).invert(),deltas=new Float32Array(mesh.geometry.attributes.position.count*3);let used=0;
  for(const [i,q] of list){
   const d=smileDelta(q,mouth,front);if(!d)continue;
   d.applyMatrix3(local).applyMatrix3(new THREE.Matrix3().setFromMatrix4(skinMatrix(mesh,i)).invert());
   if(!Number.isFinite(d.x+d.y+d.z))continue;deltas.set([d.x,d.y,d.z],i*3);used++;
  }
  if(!used)continue;
  const geometry=mesh.geometry.clone();geometry.morphAttributes.position=[new THREE.BufferAttribute(deltas,3)];geometry.morphTargetsRelative=true;
  mesh.geometry=geometry;mesh.updateMorphTargets();mesh.morphTargetInfluences[0]=0;result.push(mesh);
 }
 return result;
}

// A spotlight standing on the floor in front of the dancer: works for both lit
// and unlit (KHR_materials_unlit) materials because it is applied in the shader.
export function addGlow(root,height){
 const uniforms={uGlow:{value:0},uGlowFloor:{value:0},uGlowHeight:{value:height},uGlowColor:{value:new THREE.Color(0xfff1de)},uGlowTint:{value:new THREE.Color(0xffffff)}};
 const seen=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(seen.has(material))continue;seen.add(material);
   material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying float vGlowY;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvGlowY=(modelMatrix*vec4(transformed,1.0)).y;');
    shader.fragmentShader='uniform float uGlow,uGlowFloor,uGlowHeight;uniform vec3 uGlowColor,uGlowTint;varying float vGlowY;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
 if(uGlow>0.001){
  float h=clamp((vGlowY-uGlowFloor)/uGlowHeight,0.0,1.2);
  float face=smoothstep(0.66,0.84,h)*(1.0-smoothstep(0.98,1.1,h));
  float low=1.0-smoothstep(0.0,0.45,h);
  gl_FragColor.rgb=gl_FragColor.rgb*(1.0+uGlow*(0.08+0.2*face+0.25*low))+uGlowColor*uGlow*(0.02+0.035*face)+uGlowTint*uGlow*0.16*low;
 }`);
   };
   material.customProgramCacheKey=()=>'dancer-glow';material.needsUpdate=true;
  }
 });
 return uniforms;
}
