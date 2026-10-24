import * as THREE from 'three';

export const FRONT_DOOR_MARKER_Z=4.95;

// Mirror the vehicle's handedness for right-hand traffic, retaining readable
// lettering. Atlas islands are independent labels, including curved panels.
function reverseLabelUVs(geometry){
 const position=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index;
 if(!uv)return;
 const parent=Array.from({length:position.count},(_,i)=>i),shared=new Map();
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[root(a)]=root(b);};
 for(let i=0;i<position.count;i++){
  const key=[position.getX(i),position.getY(i),position.getZ(i),uv.getX(i),uv.getY(i)].map(v=>Math.round(v*1e5)).join('/');
  if(shared.has(key))join(i,shared.get(key));else shared.set(key,i);
 }
 for(let i=0;i<(index?index.count:position.count);i+=3){
  const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
  join(a,b);join(a,c);
 }
 const bounds=new Map();
 for(let i=0;i<position.count;i++){
  const id=root(i),u=uv.getX(i),b=bounds.get(id)??[Infinity,-Infinity];
  b[0]=Math.min(b[0],u);b[1]=Math.max(b[1],u);bounds.set(id,b);
 }
 for(let i=0;i<position.count;i++){const b=bounds.get(root(i));uv.setX(i,b[0]+b[1]-uv.getX(i));}
 uv.needsUpdate=true;
}

export function prepareRoadsideAsset(model){
 if(model.userData.roadsidePrepared)return model;
 const root=model.getObjectByName('Streetcar_Root');model.updateMatrixWorld(true);
 const inverseRoot=root.matrixWorld.clone().invert(),point=new THREE.Vector3();
 model.traverse(object=>{
  if(!object.isMesh)return;
  if(object.material.name==='Markings_Atlas'){
   object.geometry=object.geometry.clone();reverseLabelUVs(object.geometry);
  }
  if(object.material.name!=='Amber_Indicators')return;
  object.geometry=object.geometry.clone();
  const toRoot=new THREE.Matrix4().multiplyMatrices(inverseRoot,object.matrixWorld),toMesh=toRoot.clone().invert();
  const position=object.geometry.attributes.position;
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i).applyMatrix4(toRoot);
   if(point.x>1.2&&point.z>6.3&&point.z<6.5){
    point.z+=FRONT_DOOR_MARKER_Z-6.4;point.applyMatrix4(toMesh);position.setXYZ(i,point.x,point.y,point.z);
   }
  }
  position.needsUpdate=true;object.geometry.computeBoundingBox();object.geometry.computeBoundingSphere();
 });
 model.scale.x=-Math.abs(model.scale.x);model.userData.roadsidePrepared=true;
 root.userData.marker_revision='fixed-body-panel';
 return model;
}
