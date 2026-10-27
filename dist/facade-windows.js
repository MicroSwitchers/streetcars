import * as THREE from 'three';

export const WINDOW_DEPTH=.24;

// Ray/box interior mapping supplies perspective behind the glass without room
// meshes or texture downloads. It also gives distant tower panes visible depth.
export const roomDepthGLSL=`
 float qsRoomShade(vec2 paneUv,vec3 ray){
   vec3 origin=vec3(clamp(paneUv,vec2(.002),vec2(.998))*2.-1.,1.);
   vec3 safeRay=mix(vec3(-1.),vec3(1.),step(vec3(0.),ray))*max(abs(ray),vec3(.0001));
   vec3 farWall=(sign(safeRay)-origin)/safeRay;
   float travel=min(min(farWall.x,farWall.y),farWall.z);
   vec3 hit=origin+ray*travel;
   float back=1.-step(.015,abs(hit.z+1.));
   float shade=mix(.56,.94,back);
   shade=mix(shade,.74,step(.985,hit.y));
   shade=mix(shade,.36,step(hit.y,-.985));
   shade*=.90+.10*smoothstep(-1.,.8,hit.y);
   return shade;
 }
`;

export function addWindowInterior(material){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   const varying='varying vec3 vRoomWorld;varying vec3 vRoomNormal;varying vec2 vRoomUv;varying float vRoomSeed;\n';
   shader.vertexShader=varying+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
     vec4 roomWorld=vec4(transformed,1.),roomOrigin=vec4(0.,0.,0.,1.);vec3 roomNormal=normal;
     #ifdef USE_INSTANCING
       roomWorld=instanceMatrix*roomWorld;roomNormal=mat3(instanceMatrix)*roomNormal;roomOrigin=instanceMatrix*roomOrigin;
     #endif
     vRoomWorld=(modelMatrix*roomWorld).xyz;vRoomNormal=normalize(mat3(modelMatrix)*roomNormal);vRoomUv=uv;
     vRoomSeed=fract(sin(dot((modelMatrix*roomOrigin).xyz,vec3(12.9898,78.233,37.719)))*43758.5453);
     #include <project_vertex>`);
   shader.fragmentShader=varying+roomDepthGLSL+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     #include <map_fragment>
     vec3 roomN=normalize(vRoomNormal),roomView=normalize(cameraPosition-vRoomWorld);
     vec3 roomT=abs(roomN.y)>.8?vec3(1.,0.,0.):normalize(cross(vec3(0.,1.,0.),roomN));
     vec3 roomUp=cross(roomN,roomT);
     float roomForward=max(.18,abs(dot(roomView,roomN)));
     float roomShade=qsRoomShade(vRoomUv,vec3(-dot(roomView,roomT)*1.7/roomForward,-dot(roomView,roomUp)*1.2/roomForward,-1.));
     roomShade=mix(roomShade,.8,smoothstep(.12,.4,max(fwidth(vRoomUv.x),fwidth(vRoomUv.y))));
     float roomBlindHeight=step(.58,vRoomSeed)*(.08+fract(vRoomSeed*7.3)*.24);
     float roomBlind=smoothstep(1.-roomBlindHeight-max(.0001,fwidth(vRoomUv.y)),1.-roomBlindHeight+max(.0001,fwidth(vRoomUv.y)),vRoomUv.y);
     diffuseColor.rgb*=mix(.72,1.05,roomShade);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.29,.25),roomBlind*.7);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=roomShade*mix(1.,.25,roomBlind);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.78,roomBlind);');
 };
 material.customProgramCacheKey=()=>key+'-perspective-window-rooms-v1';
}

// A wall with rectangular apertures, expressed as non-overlapping masonry
// rectangles. It works with both the static Queen batches and Dundas pools.
export function facadeRectangles(width,bottom,top,openings){
 const left=-width/2,right=width/2;
 const holes=openings.map(w=>({left:Math.max(left,w.u-w.width/2),right:Math.min(right,w.u+w.width/2),bottom:Math.max(bottom,w.y-w.height/2),top:Math.min(top,w.y+w.height/2)})).filter(w=>w.right>w.left&&w.top>w.bottom);
 const levels=[...new Set([bottom,top,...holes.flatMap(w=>[w.bottom,w.top])])].sort((a,b)=>a-b).filter((y,i,all)=>i===0||y-all[i-1]>.00001),rects=[],last=new Map();
 for(let row=0;row<levels.length-1;row++){
  const lo=levels[row],hi=levels[row+1],middle=(lo+hi)/2;
  const blocked=holes.filter(w=>w.bottom<middle&&w.top>middle).sort((a,b)=>a.left-b.left);let edge=left;
  const fill=(a,b)=>{
   if(b-a<.0001)return;
   const key=a.toFixed(5)+'/'+b.toFixed(5),previous=last.get(key);
   if(previous&&Math.abs(previous.top-lo)<.00001)previous.top=hi;
   else{const r={left:a,right:b,bottom:lo,top:hi};rects.push(r);last.set(key,r);}
  };
  for(const w of blocked){fill(edge,w.left);edge=Math.max(edge,w.right);}
  fill(edge,right);
 }
 return rects;
}

// Local +X points into the wall, local Z spans the window. The outer ring
// meets the actual wall plane; the glazing sits behind the tapered reveals.
export function windowGeometries({bevel=true}={}){
 const p=[],n=[],uv=[];
 function quad(points,wanted){
  const a=new THREE.Vector3(...points[0]),b=new THREE.Vector3(...points[1]),c=new THREE.Vector3(...points[2]);
  const normal=b.sub(a).cross(c.sub(a)).normalize(),reverse=normal.dot(new THREE.Vector3(...wanted))<0;
  if(reverse)normal.negate();
  for(const i of reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3]){p.push(...points[i]);n.push(...normal);uv.push(points[i][2]+.5,points[i][1]+.5);}
 }
 const corners=[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]];
 for(let i=0;i<4;i++){
  const a=corners[i],b=corners[(i+1)%4],c=b.map(v=>v*.92),d=a.map(v=>v*.92);
  if(bevel){
   quad([[0,...a],[0,...b],[.025,...c],[.025,...d]],[-1,0,0]);
   quad([[.025,...d],[.025,...c],[WINDOW_DEPTH,...c],[WINDOW_DEPTH,...d]],[0,-(c[0]+d[0]),-(c[1]+d[1])]);
  }else{
   // A continuous tapered jamb preserves the full recess and silhouette with
   // half the triangles. Useful for the much longer resident Dundas blocks.
   quad([[0,...a],[0,...b],[WINDOW_DEPTH,...c],[WINDOW_DEPTH,...d]],[0,-(c[0]+d[0]),-(c[1]+d[1])]);
  }
 }
 const reveal=new THREE.BufferGeometry();reveal.setAttribute('position',new THREE.Float32BufferAttribute(p,3));reveal.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));reveal.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 const pane=new THREE.PlaneGeometry(.925,.925);pane.rotateY(-Math.PI/2);pane.translate(WINDOW_DEPTH-.005,0,0);
 const sash=new THREE.BufferGeometry(),s=[];
 const face=(y0,y1,z0,z1)=>s.push(.20,y0,z0,.20,y0,z1,.20,y1,z1,.20,y0,z0,.20,y1,z1,.20,y1,z0);
 face(-.46,.46,-.016,.016);face(-.012,.012,-.46,.46);
 sash.setAttribute('position',new THREE.Float32BufferAttribute(s,3));sash.computeVertexNormals();
 return {reveal,pane,sash};
}
