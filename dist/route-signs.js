import * as THREE from 'three';
// Repaint the existing UV regions; fleet numbers, crests and door notices remain.
export function createRouteSigns(rig,opposite=false){
 const material=rig.materials.get('Markings_Atlas'),original=material?.map;
 if(!original?.image)return {setRoute(){},dispose(){}};
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.flipY=original.flipY;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;material.map=texture;
 function setRoute(route){
  ctx.clearRect(0,0,2048,1024);ctx.drawImage(original.image,0,0,2048,1024);
  const label=route.number+'  '+(opposite?route.oppositeDestination:route.destination).toUpperCase();
  for(const [y,h] of [[0,160],[170,105]]){
   ctx.fillStyle='#18201e';ctx.fillRect(0,y,1024,h);ctx.fillStyle='#f3ecd0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+Math.round(h*.77)+'px Arial Narrow, Arial, sans-serif';
   ctx.fillText(label,512,y+h*.52,970);
  }
  // The compact rear rollsign occupies its own atlas island.
  ctx.fillStyle='#18201e';ctx.fillRect(1540,710,500,140);ctx.fillStyle='#f3ecd0';
  ctx.font='bold 112px Arial Narrow, Arial, sans-serif';ctx.fillText(route.number,1790,782,470);
  texture.needsUpdate=true;
 }
 return {setRoute,dispose(){material.map=original;texture.dispose();}};
}
