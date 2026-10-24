// Reduced depth precision must not turn a flat surface into striped shading.
// Compare the former single-pixel depth normal with explicit geometry normals.
export async function checkDepthNormalRegression(api,check,gameWindow){
 const THREE=await gameWindow.eval('import("three")');
 const source=(await(await fetch('../dist/rendering.js')).text()).replace("'three'",JSON.stringify(new URL('../dist/vendor/three.module.js',location.href).href));
 const oldNormal=`
   vec3 left=p-viewPosition(clamp(uv-vec2(pixel.x,0.),pixel,1.-pixel));
   vec3 right=viewPosition(clamp(uv+vec2(pixel.x,0.),pixel,1.-pixel))-p;
   vec3 down=p-viewPosition(clamp(uv-vec2(0.,pixel.y),pixel,1.-pixel));
   vec3 up=viewPosition(clamp(uv+vec2(0.,pixel.y),pixel,1.-pixel))-p;
   vec3 dx=abs(left.z)<abs(right.z)?left:right,dy=abs(down.z)<abs(up.z)?down:up;
   vec3 normal=cross(dx,dy);normal*=inversesqrt(max(dot(normal,normal),1.e-16));
   if(dot(normal,-p)<0.)normal=-normal;
 `;
 const create=async(legacy,bits)=>{
  let code=source.replaceAll('float d=texture2D(depth,uv).x;',`float d=texture2D(depth,uv).x;d=floor(d*${2**bits-1}.+.5)/${2**bits-1}.;`);
  if(legacy)code=code.replace(/   vec4 geometryNormal[\s\S]*?   float radius=/,oldNormal+'   float radius=');
  const {createSceneRenderer}=await gameWindow.eval('import('+JSON.stringify('data:text/javascript;base64,'+btoa(code))+')');
  return createSceneRenderer(api.renderer);
 };
 const scene=new THREE.Scene(),plane=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshBasicMaterial());scene.add(plane);
 const camera=new THREE.PerspectiveCamera(40,api.camera.aspect,.1,1000);
 camera.position.set(4.7,1.65,8);camera.lookAt(1.6,1.3,-2.4);
 camera.setViewOffset(gameWindow.innerWidth,gameWindow.innerHeight,0,Math.round(gameWindow.innerHeight*.12),gameWindow.innerWidth,gameWindow.innerHeight);
 const reports=[];
 try{
  for(const bits of [16,18,20]){
   const legacy=await create(true,bits),fixed=await create(false,bits);
   try{
    for(const mode of ['floor','wall'])for(const near of [.5,.1,.025]){
     camera.near=near;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
     if(mode==='floor'){plane.rotation.set(-Math.PI/2,0,0);plane.position.set(0,0,0);}
     else{plane.rotation.set(0,Math.PI/2,0);plane.position.set(1.27,0,0);}
     const measure=graphics=>{
      graphics.render(scene,camera);const buffer=graphics.ambientOcclusion.filtered;
      const pixels=new Uint8Array(buffer.width*buffer.height*4);api.renderer.readRenderTargetPixels(buffer,0,0,buffer.width,buffer.height,pixels);
      let sum=0,dirty=0,min=255;
      for(let i=0;i<pixels.length;i+=4){const v=pixels[i];sum+=v;if(v<251)dirty++;min=Math.min(min,v);}
      return {min,average:sum/(pixels.length/4),dirtyFraction:dirty/(pixels.length/4)};
     };
     reports.push({bits,mode,near,legacy:measure(legacy),fixed:measure(fixed)});
    }
   }finally{legacy.dispose();fixed.dispose();}
  }
  gameWindow.__depthNormalReports=reports;
  const worst=reports.reduce((a,b)=>a.legacy.average<b.legacy.average?a:b);
  check('Reduced-precision test reproduces bands with the previous normal reconstruction',worst.legacy.average<253);
  // Check every case: actual normals must keep both the wall and pavement clean.
  for(const report of reports)check(`Geometry normals keep ${report.mode} clean at ${report.bits} bits, near ${report.near}`,report.fixed.average>254.8&&report.fixed.dirtyFraction<.005);
 }finally{
  plane.geometry.dispose();plane.material.dispose();api.graphics.render(api.scene,api.camera);
 }
}
