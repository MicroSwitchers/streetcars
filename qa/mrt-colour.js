// Recording normals must preserve HDR colour, sky and transparent glazing.
export async function checkMrtColour(api,check,gameWindow){
 const THREE=await gameWindow.eval('import("three")');
 const {renderer,graphics,scene,camera}=api;
 const baseline=new THREE.WebGLRenderTarget(graphics.target.width,graphics.target.height,{type:graphics.target.texture.type,samples:graphics.target.samples,depthBuffer:true});
 const hdr=graphics.target.texture.type===THREE.HalfFloatType;
 const samples=[[.5,.75],[.5,.95],[.2,.45],[.3,.35],[.5,.3],[.7,.2]];
 const read=target=>samples.map(([x,y])=>{
  const pixel=hdr?new Uint16Array(4):new Uint8Array(4);
  renderer.readRenderTargetPixels(target,Math.floor(x*target.width),Math.floor(y*target.height),1,1,pixel);
  return Array.from(pixel).slice(0,3).map(v=>hdr?THREE.DataUtils.fromHalfFloat(v):v/255);
 });
 try{
  graphics.render(scene,camera);const actual=read(graphics.target);
  renderer.setRenderTarget(baseline);renderer.render(scene,camera);renderer.setRenderTarget(null);
  const expected=read(baseline),delta=Math.max(...actual.flatMap((p,i)=>p.map((v,j)=>Math.abs(v-expected[i][j]))));
  check(`Normal attachment preserves rendered HDR colour, sky and glazing (difference ${delta.toFixed(5)})`,delta<.004);
 }finally{baseline.dispose();graphics.render(scene,camera);}
}
