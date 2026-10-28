import * as THREE from 'three';
export const CONTACT_SHADING={value:1};

// Material-local contact visibility. It only attenuates indirect light, leaving
// sunlit surfaces, emissive windows and the existing lamp budget intact.
export function contactShading(material){
 if(material.userData.contactShading)return material;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.defaultAttributeValues={...material.defaultAttributeValues,contactOcclusion:[0],contactBand:[0,0]};
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.uniforms.contactStrength=CONTACT_SHADING;
  shader.vertexShader='attribute float contactOcclusion;attribute vec2 contactBand;varying float vContactOcclusion;varying vec3 vContactBand;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 contactP=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    contactP=instanceMatrix*contactP;
   #endif
   vContactOcclusion=contactOcclusion;
   vContactBand=vec3((modelMatrix*contactP).y,contactBand);
   #include <project_vertex>`);
  shader.fragmentShader='uniform float contactStrength;varying float vContactOcclusion;varying vec3 vContactBand;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`
   #include <aomap_fragment>
   float contactAmount=clamp(vContactOcclusion,0.,1.)*.32;
   if(vContactBand.z>1.){
    float foot=exp(-max(0.,vContactBand.x-vContactBand.y)/.24)*.20;
    float crown=exp(-max(0.,vContactBand.z-vContactBand.x)/.24)*.21;
    contactAmount=max(contactAmount,max(foot,crown));
   }
   float contactVisibility=1.-min(.32,contactAmount)*contactStrength;
   reflectedLight.indirectDiffuse*=contactVisibility;
   reflectedLight.indirectSpecular*=sqrt(contactVisibility);
  `);
 };
 material.customProgramCacheKey=()=>key+'-local-contact-v1';
 material.userData.contactShading=true;material.needsUpdate=true;return material;
}

export function shadeWindowReveals(geometry){
 const p=geometry.attributes.position,values=new Float32Array(p.count);
 for(let i=0;i<p.count;i++)values[i]=THREE.MathUtils.clamp(p.getX(i)/.24,0,1)*.82;
 geometry.setAttribute('contactOcclusion',new THREE.BufferAttribute(values,1));
 return geometry;
}

export function createBuildingContacts(group){
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=64;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(32,64);
 for(let y=0;y<64;y++)for(let x=0;x<32;x++){
  const u=x/31,v=y/63,edge=Math.min(1,Math.min(u,1-u)*12),i=(y*32+x)*4;
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=30;
  // Canvas top maps to v=1: this edge touches the wall, then fades out.
  pixels.data[i+3]=Math.round(255*.19*Math.exp(-v*5)*edge);
 }
 ctx.putImageData(pixels,0,0);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false});
 const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.InstancedMesh(geometry,material,512),dummy=new THREE.Object3D();mesh.name='Dundas_Soft_Wall_Contacts';mesh.count=0;mesh.renderOrder=1;mesh.frustumCulled=false;group.add(mesh);
 const stats={instances:0,triangles:0,texturePixels:32*64,overflow:0};
 return {mesh,stats,shading:CONTACT_SHADING,begin(){mesh.count=0;stats.instances=stats.triangles=stats.overflow=0;},
  place(x,z,width,rotation){
   if(mesh.count>=512){stats.overflow++;return;}
   dummy.position.set(x,.183,z);dummy.rotation.set(0,rotation,0);dummy.scale.set(width,1,.64);dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix);
  },finish(){mesh.instanceMatrix.needsUpdate=true;stats.instances=mesh.count;stats.triangles=mesh.count*2;}};
}
