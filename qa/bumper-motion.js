// Move the car, camera and light together: the bumper should remain steady on
// screen. Reading the same chrome strip reveals flashing from self-shadowing.
export async function checkBumperMotion(api){
 const THREE=await import('../dist/vendor/three.module.js');
 const original=api.car.getObjectByName('Bumper_Chrome_Trim');
 if(!original)throw new Error('Separate bumper trim not found');
 const saved=api.scene.children.map(o=>[o,o.visible]);
 for(const [o] of saved)if(o!==api.car&&!o.isLight)o.visible=false;
 const originalMaterial=original.material,cast=original.castShadow,receive=original.receiveShadow;
 const material=originalMaterial.clone();original.material=material;
 const z=-205;api.setPaused(true);api.view.transition=null;
 const camera=new THREE.PerspectiveCamera(35,api.camera.aspect,.5,1000);
 camera.position.set(api.route.trackX,1.3,z+24);camera.lookAt(api.route.trackX,.55,z+7.65);
 api.car.position.set(api.route.trackX,.026,z);api.car.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const centre=api.rig.root.localToWorld(new THREE.Vector3(0,.65,7.676)).project(camera);
 const left=api.rig.root.localToWorld(new THREE.Vector3(-.58,.65,7.676)).project(camera);
 const right=api.rig.root.localToWorld(new THREE.Vector3(.58,.65,7.676)).project(camera);
 const size=api.renderer.getDrawingBufferSize(new THREE.Vector2());
 const x=Math.max(0,Math.floor((Math.min(left.x,right.x)+1)*.5*size.x)),y=Math.round((centre.y+1)*.5*size.y),width=Math.max(1,Math.floor(Math.abs(right.x-left.x)*.5*size.x));
 const gl=api.renderer.getContext(),buffer=new Uint8Array(width*4);
 const metrics={};
 for(const mode of ['legacy','fixed']){
   const appearance=mode==='legacy'?api.rig.materials.get('Polished_Trim'):originalMaterial;
   original.castShadow=mode==='legacy';original.receiveShadow=mode==='legacy';
   material.roughness=appearance.roughness;material.metalness=appearance.metalness;material.envMapIntensity=appearance.envMapIntensity;
   // Compare with the original glossy trim, even when the new asset's other
   // polished fittings have a softer finish of their own.
   if(mode==='legacy'){material.roughness=.14;material.metalness=1;}
   let previous=null,total=0,peak=0,frames=0,maximumPixelChange=0;
   const brightness=[];
   for(let i=0;i<32;i++){
     const offset=i*.01;api.car.position.z=z+offset;camera.position.z=z+24+offset;api.lighting.update(z+offset);
     api.graphics.render(api.scene,camera);
     gl.readPixels(x,y,width,1,gl.RGBA,gl.UNSIGNED_BYTE,buffer);
     let mean=0;for(let p=0;p<buffer.length;p+=4)mean+=(buffer[p]+buffer[p+1]+buffer[p+2])/3;
     brightness.push(mean/width);
     if(previous){let difference=0;for(let p=0;p<buffer.length;p+=4)for(let c=0;c<3;c++){
       const change=Math.abs(buffer[p+c]-previous[p+c]);difference+=change;maximumPixelChange=Math.max(maximumPixelChange,change);
     }difference/=width*3;total+=difference;peak=Math.max(peak,difference);frames++;}
     previous=buffer.slice();
   }
   const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(centre.x,centre.y),camera);
   const hits=ray.intersectObject(api.car,true);
   metrics[mode]={averageChange:total/frames,peakChange:peak,maximumPixelChange,
     brightnessRange:Math.max(...brightness)-Math.min(...brightness),
     sampleSurface:hits[0]?.object.name,roughness:material.roughness,cast:original.castShadow,receive:original.receiveShadow};
 }
 original.material=originalMaterial;original.castShadow=cast;original.receiveShadow=receive;material.dispose();
 for(const [o,visible] of saved)o.visible=visible;
 api.restart();return metrics;
}
