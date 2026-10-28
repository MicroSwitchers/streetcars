// A moving object must keep moving even when only the fading-out view is visible.
export async function checkLiveTransitions(api,check,gameWindow,reduceMotion=false){
 const THREE=await gameWindow.eval('import("three")');
 const {renderer,graphics}=api,gl=renderer.getContext();
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x15191b);
 const box=new THREE.Mesh(new THREE.BoxGeometry(1.8,2,1.8),new THREE.MeshBasicMaterial({color:0xec1810}));
 box.position.y=1;scene.add(box);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshBasicMaterial({color:0x666666}));
 floor.rotation.x=-Math.PI/2;scene.add(floor);
 const size=renderer.getDrawingBufferSize(new THREE.Vector2());
 const from=new THREE.PerspectiveCamera(48,size.x/size.y,.5,100);
 from.position.set(0,3,14);from.lookAt(0,1,0);
 const to=from.clone();to.position.x=3;to.lookAt(0,1,0);
 const transition={id:987654,from,progress:0};
 const read=()=>{
  renderer.getDrawingBufferSize(size);
  const pixels=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  return pixels;
 };
 const centroid=pixels=>{
  let sum=0,count=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]>60&&pixels[i]>pixels[i+1]*1.7&&pixels[i]>pixels[i+2]*1.7){sum+=(i/4)%size.x;count++;}
  check('Moving object remains visible during the fade',count>100);
  return sum/count;
 };
 const reports=[];
 try{
  // Seed the last frame: a snapshot-based dissolve would keep showing this pose.
  box.position.x=-3;graphics.render(scene,from);
  for(const progress of [0,.15,.5,.85]){
   transition.progress=progress;
   box.position.x=-2;graphics.render(scene,to,transition);const left=centroid(read());
   box.position.x=2;graphics.render(scene,to,transition);const right=centroid(read());
   reports.push({progress,pixelTravel:right-left});
   check(`Streetcar-style motion continues at fade progress ${progress}`,right-left>size.x*.08);
  }
  const first=read();graphics.render(scene,to,transition);const second=read();
  check('Paused scene and fade remain stable',first.every((v,i)=>v===second[i]));
  transition.progress=1;graphics.render(scene,to,transition);const complete=read();
  graphics.render(scene,to);const direct=read();
  check('Dissolve finishes on the live incoming view',complete.every((v,i)=>Math.abs(v-direct[i])<=1));
 }finally{box.geometry.dispose();box.material.dispose();floor.geometry.dispose();floor.material.dispose();}

 // Exercise the actual ride through a sidewalk station change, including wheels.
 api.updateSettings({camera:'sidewalk',mode:'watch',reduceMotion,alwaysGreen:true,stopAtLights:false,cruise:20});api.restart();
 const passEnd=18;
 api.state.z=api.view.sidewalkStops[0]+passEnd-.6;api.state.speed=20/3.6;api.state.phase='travelling';
 api.step(0);api.view.reset();api.view.update(api.state.z,0);api.view.transition=null;
 graphics.render(api.scene,api.camera);
 let fadeId=null,startZ=null,startWheel=null,minimumSpeed=Infinity,minimumTravel=Infinity,maximumPoseError=0,fadeFrames=0,rendered=0,finished=false;
 for(let frame=0;frame<70;frame++){
  const previous=api.state.z;
  api.step(.1);api.view.update(api.state.z,.1,api.state.paused);
  const fade=api.view.transition;
  if(!fadeId&&fade){fadeId=fade.id;startZ=api.state.z;startWheel=api.rig.axles[0].rotation.x;}
  if(fadeId){
   minimumTravel=Math.min(minimumTravel,api.state.z-previous);
   maximumPoseError=Math.max(maximumPoseError,Math.abs(api.car.position.z-api.state.z));
   minimumSpeed=Math.min(minimumSpeed,api.state.speed);fadeFrames++;
   if(fade&&fade.id===fadeId&&fade.progress>=rendered*.3&&rendered<4){graphics.render(api.scene,api.camera,fade);rendered++;}
   if(!fade){finished=true;break;}
  }
 }
 check('Ride advances on every transition frame',minimumTravel>0);
 check('World position advances with the ride during the transition',maximumPoseError<1e-8);
 check('Actual sidewalk dissolve completes while travelling',finished&&fadeFrames>20&&minimumSpeed>1);
 check('Streetcar travels through the entire fade',api.state.z-startZ>12);
 check('Wheels keep rotating during the fade',Math.abs(api.rig.axles[0].rotation.x-startWheel)>.1);
 gameWindow.__transitionMotionReport={pixels:reports,ride:{reduceMotion,fadeFrames,metres:api.state.z-startZ,minimumSpeed}};
 api.setPaused(true);graphics.render(api.scene,api.camera);
}
