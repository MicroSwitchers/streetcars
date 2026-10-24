// Measure real light received by the existing asphalt, not just lens brightness.
export async function checkNightLamps(api,check,gameWindow){
 const THREE=await gameWindow.eval('import("three")');
 const {rig,renderer,graphics}=api,lights=rig.exteriorEmitters;
 const previous={...rig.lights},savedNight=rig.nightAmount,savedBrake=rig.brakeAmount;
 rig.setBrake(0);
 api.setPaused(true);
 const side=lights.filter(l=>l.userData.lightRole==='markers'),rear=lights.filter(l=>l.userData.lightRole==='tail');
 check('Six amber marker lamps and two rear light pools',side.length===6&&rear.length===2);
 check('Exterior lights use short reach without extra shadow maps',lights.every(l=>!l.castShadow&&l.distance<=4.8));
 rig.setNight(0);
 check('Side markers and pavement spill stay off in daylight',rig.materials.get('Amber_Indicators').emissiveIntensity===0&&lights.every(l=>l.intensity===0));
 rig.setNight(.45);const dusk=side[0].intensity;
 rig.setNight(1);
 check('Amber lenses glow steadily at night',rig.materials.get('Amber_Indicators').emissiveIntensity>3&&side.every(l=>l.intensity>0));
 check('Exterior light fades up smoothly through dusk',dusk>0&&dusk<side[0].intensity);
 rig.setLights({markers:false});check('Marker control switches off amber lenses and their spill',side.every(l=>l.intensity===0)&&rig.materials.get('Amber_Indicators').emissiveIntensity===0);
 rig.setLights({markers:true,tail:false});check('Rear control switches off red pavement lighting',rear.every(l=>l.intensity===0));
 rig.setLights({tail:true});
 const intensities=lights.map(l=>l.intensity),camera=new THREE.PerspectiveCamera(80,api.camera.aspect,.5,1000);
 const reports=[];gameWindow.__nightLampReport=reports;
 const world=(x,y,z)=>rig.root.localToWorld(new THREE.Vector3(x,y,z));
 const sample=(localX,localZ)=>{
  const point=world(localX,0,localZ);point.y=.005;point.project(camera);const target=graphics.target;
  check(`Pavement sample ${localX}, ${localZ} lies in the rendered view`,Math.abs(point.x)<.95&&Math.abs(point.y)<.95);
  const px=Math.round((point.x*.5+.5)*(target.width-1)),py=Math.round((point.y*.5+.5)*(target.height-1));
  const hdr=target.texture.type===THREE.HalfFloatType,pixels=hdr?new Uint16Array(36):new Uint8Array(36),result=[0,0,0];
  renderer.readRenderTargetPixels(target,px-1,py-1,3,3,pixels);
  for(let i=0;i<36;i+=4)for(let c=0;c<3;c++)result[c]+=(hdr?THREE.DataUtils.fromHalfFloat(pixels[i+c]):pixels[i+c]/255)/9;
  return result;
 };
 try{
  for(const location of ['right','left','rear']){
   const sign=location==='right'?1:-1;
   const points=location==='rear'?[[-1.18,-9.5],[1.18,-9.5]]:side.filter(l=>Math.sign(l.position.x)===sign).map(l=>[sign*2.75,l.position.z]);
   if(location==='rear'){camera.position.copy(world(0,3.5,-15));camera.lookAt(world(0,.6,-8.5));}
   else{camera.position.copy(world(sign*8,5.5,.6));camera.lookAt(world(0,.8,0));}
   camera.updateMatrixWorld(true);
   lights.forEach(l=>l.intensity=0);graphics.render(api.scene,camera);const dark=points.map(p=>sample(...p));
   lights.forEach((l,i)=>l.intensity=intensities[i]);graphics.render(api.scene,camera);const lit=points.map(p=>sample(...p));
   const delta=lit.map((rgb,i)=>rgb.map((v,c)=>v-dark[i][c]));reports.push({location,delta});
   for(const rgb of delta)check('Existing pavement receives '+(location==='rear'?'red rear':'amber '+location)+' light',
    location==='rear'?rgb[0]>.008&&rgb[0]>Math.max(rgb[1],rgb[2])*3:
      rgb[0]>.006&&rgb[1]>.002&&rgb[0]>rgb[1]*1.1&&rgb[1]>rgb[2]*1.2);
  }
  const before=lights.map(l=>l.getWorldPosition(new THREE.Vector3()));api.car.position.z+=5;api.car.updateMatrixWorld(true);
  check('Light pools travel with the streetcar',lights.every((l,i)=>Math.abs(l.getWorldPosition(new THREE.Vector3()).z-before[i].z-5)<1e-8));
  api.car.position.z-=5;api.car.updateMatrixWorld(true);
  const button=gameWindow.document.getElementById('lights');button.click();
  check('Lights off removes all exterior glow while paused',!api.state.lights&&lights.every(l=>l.intensity===0)&&rig.materials.get('Amber_Indicators').emissiveIntensity===0);
  button.click();check('Lights on restores nighttime markers and red spill',api.state.lights&&lights.every(l=>l.intensity>0));
  gameWindow.__nightLampReport=reports;
 }finally{
  lights.forEach((l,i)=>l.intensity=intensities[i]);rig.setNight(savedNight);rig.setLights(previous);rig.setBrake(savedBrake);
  graphics.render(api.scene,api.camera);
 }
}
