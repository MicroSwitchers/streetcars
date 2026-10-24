import * as THREE from 'three';
import {FRONT_DOOR_MARKER_Z} from './streetcar-asset.js';

/** Deterministic controls for ttc-clrv.glb. SI units; +Y up, +Z forward, +X doors. */
export class StreetcarController {
  constructor(model, {actualLights = true, cabinLights=true, exteriorLights=true, doorSeconds = 1.2} = {}) {
    this.model = model;
    this.root = model.getObjectByName('Streetcar_Root');
    if (!this.root) throw new Error('Expected Streetcar_Root in ttc-clrv.glb');
    this.radius = .335; this.poleLength = 5.2; this.doorSeconds = doorSeconds;
    this.distance = 0; this.speed = 0; this.doors = {front:0,rear:0}; this.targets = {...this.doors};
    this.nodes = {}; model.traverse(o => this.nodes[o.name] = o);
    this.axles = ['Front_0','Front_1','Rear_0','Rear_1'].map(s=>this.nodes['Axle_'+s]);
    this.yaw = this.nodes.Trolley_Yaw; this.tilt = this.nodes.Trolley_Tilt; this.contact = this.nodes.Wire_Contact;
    this.materials = new Map();
    model.traverse(o=>{
      if(!o.isMesh) return;
      o.castShadow = !(Array.isArray(o.material)?o.material.some(m=>m.transparent):o.material.transparent); o.receiveShadow = true;
      const clone = m => {
        if(!this.materials.has(m.name)) this.materials.set(m.name,m.clone());
        return this.materials.get(m.name);
      };
      o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
    });
    this.splitRearRoofMarkers();
    this.emitters = [];this.exteriorEmitters=[];this.nightAmount=0;this.brakeAmount=0;
    if(actualLights) {
      const centralLamp=this.root.userData.headlamp_layout==='single central lamp with corner markers';
      for(const x of centralLamp?[0]:[-.68,.68]) {
        const light=new THREE.SpotLight(0xffe4aa,18,20,.52,.6,1.5);
        light.name='Runtime_Headlight';light.position.set(x,centralLamp?1.29:1.28,centralLamp?7.81:7.73);
        light.target.position.set(x,.35,18);light.userData.nightIntensity=18;this.root.add(light,light.target);this.emitters.push(light);
      }
      for(const z of cabinLights?[-5.3,-.2,4.6]:[]) {
        const light=new THREE.PointLight(0xffefcf,2.4,5.3,2);
        light.name='Runtime_InteriorLight'; light.position.set(0,2.93,z);light.userData.nightIntensity=2.4;this.root.add(light);this.emitters.push(light);
      }
      // Short, soft beams at the real fittings light rough paving and curbs.
      // Keep them outside the body and pointing out/down to avoid cabin leaks.
      const exterior=(name,role,color,position,target,intensity,distance,angle)=>{
        const light=new THREE.SpotLight(color,0,distance,angle,.9,2);
        light.name=name;light.position.set(...position);light.target.position.set(...target);
        light.castShadow=false;light.userData.lightRole=role;light.userData.nightIntensity=intensity;
        this.root.add(light,light.target);this.exteriorEmitters.push(light);
      };
      for(const side of exteriorLights?[-1,1]:[])for(const z of [-6.4,.4,side===1?FRONT_DOOR_MARKER_Z:6.4])
        exterior('Runtime_Amber_Side_Marker','markers',0xff961c,[side*1.34,.98,z],[side*2.75,.02,z],2.8,4,1.05);
      for(const side of exteriorLights?[-1,1]:[])
        exterior('Runtime_Red_Tail_Spill','tail',0xff2014,[side*1.01,1.27,-7.51],[side*1.18,.02,-9.5],5.5,4.8,.95);
    }
    this.setLights({headlights:true,tail:true,markers:true,interior:false,indicators:false});
    this.setPoleAngles(THREE.MathUtils.degToRad(26),0);
  }
  splitRearRoofMarkers(){
    this.model.updateMatrixWorld(true);
    const inverse=this.root.matrixWorld.clone().invert(),point=new THREE.Vector3(),meshes=[];
    this.model.traverse(o=>{if(o.isMesh&&o.material.name==='Tail_Lamps')meshes.push(o);});
    for(const mesh of meshes){
      const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;
      const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),lower=[],roof=[];
      for(let i=0;i<(index?index.count:position.count);i+=3){
        const vertices=[0,1,2].map(k=>index?index.getX(i+k):i+k);
        const height=vertices.reduce((sum,v)=>sum+point.fromBufferAttribute(position,v).applyMatrix4(transform).y,0)/3;
        (height>2.5?roof:lower).push(...vertices);
      }
      if(!roof.length||!lower.length)continue;
      const lowerGeometry=geometry.clone(),roofGeometry=geometry.clone();lowerGeometry.setIndex(lower);roofGeometry.setIndex(roof);
      mesh.geometry=lowerGeometry;
      let material=this.materials.get('Rear_Roof_Markers');
      if(!material){material=mesh.material.clone();material.name='Rear_Roof_Markers';this.materials.set(material.name,material);}
      const markers=new THREE.Mesh(roofGeometry,material);markers.name='Rear_Roof_Markers';
      markers.position.copy(mesh.position);markers.quaternion.copy(mesh.quaternion);markers.scale.copy(mesh.scale);
      markers.castShadow=mesh.castShadow;markers.receiveShadow=mesh.receiveShadow;mesh.parent.add(markers);
    }
  }
  setDoor(which, progress, immediate = false) {
    if(!['front','rear','both'].includes(which)) throw new Error('Door must be front, rear, or both');
    for(const key of which==='both'?['front','rear']:[which]) {
      this.targets[key]=THREE.MathUtils.clamp(progress,0,1);
      if(immediate) { this.doors[key]=this.targets[key];this.applyDoor(key); }
    }
  }
  applyDoor(key) {
    const name=key==='front'?'Front':'Rear';
    const p=this.doors[key], eased=p*p*(3-2*p), a=THREE.MathUtils.degToRad(83)*eased;
    for(const [part,sign] of [['A',1],['B',-1]]) {
      this.nodes[`Door_${name}_${part}`].rotation.y=sign*a;
      this.nodes[`Door_${name}_${part}_Fold`].rotation.y=-sign*2*a;
    }
  }
  /** Signed cumulative distance in metres; use this when your game moves the car. */
  setDistance(metres) {
    this.distance=metres;
    const angle=(metres/this.radius) % (Math.PI*2);
    for(const axle of this.axles) axle.rotation.x=angle;
  }
  setBogieYaw(frontRadians, rearRadians) {
    this.nodes.Bogie_Front.rotation.y=frontRadians;this.nodes.Bogie_Rear.rotation.y=rearRadians;
  }
  /** No vehicle translation is performed; game physics owns movement. */
  update(dt, speedMetresPerSecond = this.speed) {
    dt=THREE.MathUtils.clamp(dt,0,.1);this.speed=speedMetresPerSecond;
    this.setDistance(this.distance + this.speed*dt);
    for(const key of ['front','rear']) {
      const delta=this.targets[key]-this.doors[key];
      this.doors[key]+=Math.sign(delta)*Math.min(Math.abs(delta),dt/this.doorSeconds);
      this.applyDoor(key);
    }
  }
  setPoleAngles(pitchRadians, yawRadians) {
    this.tilt.rotation.x=THREE.MathUtils.clamp(pitchRadians,THREE.MathUtils.degToRad(5),THREE.MathUtils.degToRad(78));
    this.yaw.rotation.y=THREE.MathUtils.clamp(yawRadians,-Math.PI*.45,Math.PI*.45);
    this.model.updateMatrixWorld(true);
  }
  getWireContactWorld(out = new THREE.Vector3()) {this.model.updateMatrixWorld(true);return this.contact.getWorldPosition(out);}
  /** Aim at a WORLD point. Rigid length remains unchanged; return error and reachability. */
  setWireContact(worldPoint) {
    this.model.updateMatrixWorld(true);
    const point=this.yaw.parent.worldToLocal(worldPoint.clone()).sub(this.yaw.position);
    const pitch=Math.atan2(point.y,Math.hypot(point.x,point.z)),yaw=Math.atan2(-point.x,-point.z);
    this.setPoleAngles(pitch,yaw);
    const error=this.getWireContactWorld().distanceTo(worldPoint);
    return {reachable:error<.015,errorMetres:error,contact:this.getWireContactWorld()};
  }
  /** Intersect the rigid pole's reach sphere with a WORLD-space straight wire segment.
   * Pick the feasible solution nearest the previous shoe to avoid jumping ends.
   * If there is no reachable intersection, aim at the nearest wire point and report failure.
   * Root transforms are supported; keep scale uniform for rigid-world-metre behaviour.
   */
  followWireSegment(worldA,worldB) {
    this.model.updateMatrixWorld(true);
    const a=this.yaw.parent.worldToLocal(worldA.clone()).sub(this.yaw.position);
    const b=this.yaw.parent.worldToLocal(worldB.clone()).sub(this.yaw.position);
    const d=b.clone().sub(a),A=d.lengthSq(),B=2*a.dot(d),C=a.lengthSq()-this.poleLength**2;
    if(A<1e-10) return this.setWireContact(worldA);
    const disc=B*B-4*A*C,old=this.getWireContactWorld(),choices=[];
    if(disc>=0) for(const t of [(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)]) {
      if(t<0||t>1) continue;
      const local=a.clone().addScaledVector(d,t),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z)),yaw=Math.atan2(-local.x,-local.z);
      if(pitch<THREE.MathUtils.degToRad(5)||pitch>THREE.MathUtils.degToRad(78)||Math.abs(yaw)>Math.PI*.45) continue;
      const point=worldA.clone().lerp(worldB,t);choices.push({point,t,score:point.distanceToSquared(old)});
    }
    if(choices.length) {
      choices.sort((a,b)=>a.score-b.score);const best=choices[0];
      return {...this.setWireContact(best.point),segmentT:best.t};
    }
    const closest=THREE.MathUtils.clamp(-a.dot(d)/A,0,1);
    const result=this.setWireContact(worldA.clone().lerp(worldB,closest));return {...result,reachable:false,segmentT:closest};
  }
  setLights(options) {
    this.lights={...this.lights,...options};
    const night=THREE.MathUtils.smoothstep(this.nightAmount,.1,.8);
    for(const [name,key,on] of [['Headlamps','headlights',.8*night],['Green_Markers','markers',.9*night],['Rear_Roof_Markers','tail',.9*night],['Interior_Lamps','interior',night]]) {
      const m=this.materials.get(name);if(m) m.emissiveIntensity=this.lights[key]?on:0;
    }
    const rear=this.materials.get('Tail_Lamps');if(rear)rear.emissiveIntensity=(this.lights.tail?night*.9:0)+this.brakeAmount*3.8;
    const amber=this.materials.get('Amber_Indicators');
    if(amber)amber.emissiveIntensity=night*Math.max(this.lights.indicators?1:0,this.lights.markers?3.6:0);
    // Zero power keeps the shader light list stable through dusk and dawn.
    this.emitters.forEach(l=>{l.visible=true;l.intensity=this.emitterIntensity(l);});
    for(const light of this.exteriorEmitters)light.intensity=night*((this.lights[light.userData.lightRole]?light.userData.nightIntensity:0)+(light.userData.lightRole==='tail'?this.brakeAmount*4:0));
  }
  emitterIntensity(light){return (this.lights[light.isSpotLight?'headlights':'interior']?THREE.MathUtils.smoothstep(this.nightAmount,.1,.8):0)*light.userData.nightIntensity;}
  setBrake(amount,dt=0){
    const target=THREE.MathUtils.clamp(amount,0,1),value=dt>0?THREE.MathUtils.damp(this.brakeAmount,target,16,dt):target;
    const next=Math.abs(value-target)<.001?target:value;
    if(Math.abs(next-this.brakeAmount)<.0001)return;
    this.brakeAmount=next;this.setLights({});
  }
  setNight(amount) {
    const night=THREE.MathUtils.clamp(amount,0,1);
    if(night===this.nightAmount)return;
    this.nightAmount=night;this.setLights({});
  }
  dispose() {
    for(const l of [...this.emitters,...this.exteriorEmitters]){if(l.target)l.target.removeFromParent();l.removeFromParent();}
    for(const m of this.materials.values())m.dispose();
  }
}
