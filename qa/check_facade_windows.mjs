import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const threeUrl=new URL('../dist/vendor/three.module.js',import.meta.url);
const THREE=await import(threeUrl);
const source=(await readFile(new URL('../dist/facade-windows.js',import.meta.url),'utf8')).replace("'three'",JSON.stringify(threeUrl.href));
const {facadeRectangles,windowGeometries,WINDOW_DEPTH}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const holes of [[],[{u:0,y:3,width:2,height:2}],[{u:-.5,y:3,width:2,height:2},{u:.5,y:3,width:2,height:2}],[{u:-5,y:0,width:3,height:3},{u:5,y:6,width:3,height:3}]]){
 const rects=facadeRectangles(10,0,6,holes);
 for(let y=.025;y<6;y+=.05)for(let u=-4.975;u<5;u+=.05){
  const hole=holes.some(w=>Math.abs(u-w.u)<w.width/2&&Math.abs(y-w.y)<w.height/2);
  const covers=rects.filter(r=>u>r.left&&u<r.right&&y>r.bottom&&y<r.top).length;
  assert.equal(covers,hole?0:1,'Masonry must fill exactly the wall outside the aperture union');
 }
}
for(const bevel of [true,false]){
const kit=windowGeometries({bevel});
assert.equal(kit.reveal.attributes.position.count/3,bevel?16:8,'Simplified jambs halve triangles without losing the recess');
for(const geometry of Object.values(kit))assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide});
let checks=0;
for(const rotation of [0,Math.PI,Math.PI/2,-Math.PI/2])for(const width of [.7,1.4,4.9])for(const height of [1.9,2.7]){
 const transform=new THREE.Matrix4().makeRotationY(rotation),scale=new THREE.Matrix4().makeScale(1,height,width);transform.multiply(scale);
 const group=new THREE.Group(),pane=new THREE.Mesh(kit.pane,material),reveal=new THREE.Mesh(kit.reveal,material);
 group.add(pane,reveal);group.applyMatrix4(transform);group.updateMatrixWorld(true);
 const origin=new THREE.Vector3(-.5,.12*height,.22*width).applyMatrix4(new THREE.Matrix4().makeRotationY(rotation));
 const direction=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),rotation);
 const hits=new THREE.Raycaster(origin,direction,0,2).intersectObject(group,true);
 assert.equal(hits[0]?.object,pane,'Glazing is visible through the correctly wound opening');
 assert.ok(Math.abs(hits[0].distance-(.5+WINDOW_DEPTH-.005))<1e-6,'Glazing is physically inset 235 mm');checks++;
}
console.log('PASS: Aperture unions, non-overlapping wall coverage, finite shared geometry and '+checks+' inset glazing rays in all facade orientations.');
}
