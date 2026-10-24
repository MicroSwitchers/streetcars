// Test actual AO output using a box on an evenly lit floor: contacts should
// darken, while open paving and a floor without occluders should stay clean.
export async function checkAmbientOcclusion(api,check,gameWindow){
 // Create GPU buffers in the same JavaScript realm as the game's renderer.
 const THREE=await gameWindow.eval('import("three")');
 const {graphics,renderer}=api,{raw,filtered}=graphics.ambientOcclusion;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x8899aa);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:0xb0b0b0}));
 floor.rotation.x=-Math.PI/2;scene.add(floor);
 const box=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial({color:0xb0b0b0}));
 box.position.y=1;scene.add(box);
 const camera=new THREE.PerspectiveCamera(50,graphics.target.width/graphics.target.height,.5,100);
 camera.position.set(5,5,8);camera.lookAt(0,.5,0);camera.updateMatrixWorld(true);
 const read=()=>{const pixels=new Uint8Array(filtered.width*filtered.height*4);renderer.readRenderTargetPixels(filtered,0,0,filtered.width,filtered.height,pixels);return pixels;};
 const sample=(pixels,x,z)=>{
   const p=new THREE.Vector3(x,0,z).project(camera);
   const px=Math.round((p.x*.5+.5)*(filtered.width-1)),py=Math.round((p.y*.5+.5)*(filtered.height-1));
   let value=0;
   for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)value+=pixels[((py+y)*filtered.width+px+x)*4];
   return value/9;
 };
 try{
   graphics.render(scene,camera);const first=read();
   check('AO renders at half resolution',raw.width===Math.ceil(graphics.target.width/2)&&raw.height===Math.ceil(graphics.target.height/2));
   const contact=sample(first,1.12,.55),open=sample(first,3.4,.55);
   check(`AO darkens the floor beside a box (${contact.toFixed(1)} versus ${open.toFixed(1)})`,contact<247&&open>250&&open-contact>8);
   graphics.render(scene,camera);const second=read();
   check('Stationary AO has no temporal noise',first.every((value,i)=>value===second[i]));
   scene.remove(box);graphics.render(scene,camera);const flat=read();
   check('AO leaves an unoccluded flat floor clean',sample(flat,1.12,.55)>253&&sample(flat,3.4,.55)>253);
   const sky=(Math.floor(filtered.height*.95)*filtered.width+Math.floor(filtered.width*.5))*4;
   check('AO does not darken the sky',flat[sky]>253);
   check('Pavement and masonry have independent roughness detail',['road','concrete','brick0','roof'].every(name=>api.city.materials[name].roughnessMap?.colorSpace===THREE.NoColorSpace));
 }finally{
   graphics.render(api.scene,api.camera);
   floor.geometry.dispose();floor.material.dispose();box.geometry.dispose();box.material.dispose();
 }
}
