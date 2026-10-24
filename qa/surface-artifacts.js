// A plane with no occluders must remain clean at every depth and viewing angle.
// This catches depth-reconstruction stripes that a box/contact AO test misses.
export async function checkSurfaceArtifacts(api,check,gameWindow){
 const THREE=await gameWindow.eval('import("three")');
 const {graphics,renderer}=api,buffer=graphics.ambientOcclusion.filtered;
 const scene=new THREE.Scene(),mat=new THREE.MeshBasicMaterial({color:0xaaaaaa});
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),mat);scene.add(plane);
 const camera=new THREE.PerspectiveCamera(40,graphics.target.width/graphics.target.height,.5,1000);
 const reports=[];
 try{
  for(const mode of ['floor','wall'])for(const near of [.5,.1]){
   if(mode==='floor'){plane.rotation.set(-Math.PI/2,0,0);plane.position.set(0,0,0);}
   else{plane.rotation.set(0,Math.PI/2,0);plane.position.set(1.27,0,0);}
   camera.near=near;camera.position.set(4.7,2.45,8);camera.lookAt(1.6,1.3,-2.4);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   graphics.render(scene,camera);
   const pixels=new Uint8Array(buffer.width*buffer.height*4);renderer.readRenderTargetPixels(buffer,0,0,buffer.width,buffer.height,pixels);
   let min=255,sum=0,dirty=0;
   for(let i=0;i<pixels.length;i+=4){const v=pixels[i];min=Math.min(min,v);sum+=v;if(v<251)dirty++;}
   const report={mode,near,min,average:sum/(pixels.length/4),dirtyFraction:dirty/(pixels.length/4)};reports.push(report);
  }
  console.log('Surface occlusion diagnostics',JSON.stringify(reports));
  gameWindow.__surfaceReports=reports;
  for(const report of reports)check('AO keeps an unoccluded '+report.mode+' clean at near '+report.near,report.average>254.99&&report.dirtyFraction<.0001);
 }finally{plane.geometry.dispose();mat.dispose();graphics.render(api.scene,api.camera);}
}
