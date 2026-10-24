// Render untextured receivers with zero constant/normal bias. A fix must clean
// up their self-shadows without removing the shadow of the separate test box.
export async function checkShadowSurfaces(api,check,gameWindow){
 const THREE=await gameWindow.eval('import("three")');
 const {stabilizeSurfaceShadows}=await gameWindow.eval('import(new URL("shadow-bias.js",document.baseURI))');
 const renderer=api.renderer,target=new THREE.WebGLRenderTarget(640,640),pixels=new Uint8Array(640*640*4);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.5,100);
 const sun=new THREE.DirectionalLight(0xffffff,2);sun.castShadow=true;
 sun.position.set(17,24,19);sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:70});
 sun.shadow.bias=0;sun.shadow.normalBias=0;scene.add(sun,sun.target);
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide});
 const floor=new THREE.Mesh(new THREE.BoxGeometry(30,.10,30),material);floor.position.y=-.05;floor.castShadow=floor.receiveShadow=true;scene.add(floor);
 const box=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial({color:0xffffff}));
 box.position.y=1;box.castShadow=true;scene.add(box);
 // Look straight down so the box cannot hide the shadow probe from the camera.
 camera.position.set(0,15,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const luminance=(x,z)=>{
   const q=new THREE.Vector3(x,.001,z).project(camera),px=Math.round((q.x*.5+.5)*639),py=Math.round((q.y*.5+.5)*639);
   let sum=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const i=((py+dy)*640+px+dx)*4;sum+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
   }
   return sum/9;
 };
 const reports={};
 try{
  for(const mode of ['legacy','fixed']){
   if(mode==='fixed')stabilizeSurfaceShadows(material);
   const values=[];
   for(const move of [0,.017,.041,.078]){
    sun.position.set(17+move,24,19);sun.target.position.x=move;
    renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,640,640,pixels);
    for(let x=2;x<=4;x+=.125)for(let z=1;z<=3;z+=.125)values.push(luminance(x,z));
   }
   const mean=values.reduce((a,b)=>a+b,0)/values.length;
   reports[mode]={mean,min:Math.min(...values),max:Math.max(...values),range:Math.max(...values)-Math.min(...values),
     shadow:luminance(-1.1,-1.2),open:luminance(3,2)};
  }
  gameWindow.__shadowReports=reports;
  check('Stress fixture exposes legacy self-shadow banding',reports.legacy.range>8);
  check('Slope-aware comparison cleans flat receivers',reports.fixed.range<3&&reports.fixed.range<reports.legacy.range*.15);
  check('Separate objects still cast real shadows',reports.fixed.open-reports.fixed.shadow>40);
 }finally{
  renderer.setRenderTarget(null);target.dispose();sun.shadow.map?.dispose();floor.geometry.dispose();box.geometry.dispose();material.dispose();box.material.dispose();
  api.graphics.render(api.scene,api.camera);
 }
}
