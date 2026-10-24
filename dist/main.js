import {loadStreetcar,yieldToBrowser} from './loading.js';
import {initialQuality,qualityProfile,renderRatio,deviceGraphics,installGraphicsRecovery} from './performance.js';
import {startGame} from './app.js';
import * as THREE from 'three';
import {ROUTE,buildEnvironment} from './environment.js';
import {createDaylight} from './lighting.js';
import {finishSurfaces} from './surfaces.js';
import {createSceneRenderer} from './rendering.js';
import {loadTrafficCars} from './car-assets.js';
import {loadStreetProps} from './streetscape.js';
import {loadArchitecture} from './architecture.js';
const $=id=>document.getElementById(id),canvas=$('world');
const recovery=installGraphicsRecovery(canvas);
let storage;try{storage=localStorage;}catch{}
const device=deviceGraphics(navigator,matchMedia('(pointer: coarse)').matches,storage);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'default'});}
catch(error){$('load-message').textContent='This browser could not start WebGL. Try a browser with hardware acceleration enabled.';$('reload-game').hidden=false;throw error;}
try{
renderer.userData={compatibility:device.compatibility,device,recovery};
const initial=qualityProfile(initialQuality(device),device.compatibility);
renderer.setPixelRatio(renderRatio(initial,innerWidth,innerHeight,devicePixelRatio));
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.5,device.compatibility?180:1000);
const lighting=createDaylight(renderer,scene),{sky,sun}=lighting;
$('load-message').textContent='Loading the streetcar and neighbourhood...';
const [trafficCars,streetProps,architecture,gltf]=await Promise.all([loadTrafficCars(),loadStreetProps(),loadArchitecture(),loadStreetcar()]);
if(recovery.lost)throw Error('Graphics paused during loading');
$('load-message').textContent='Building Queen Street...';await yieldToBrowser();
const city=buildEnvironment(scene,trafficCars,streetProps,architecture);
finishSurfaces(city.materials,renderer,ROUTE);
const graphics=createSceneRenderer(renderer,{compatibility:device.compatibility});graphics.setQuality(initial);
$('load-message').textContent='Preparing lighting and graphics...';await yieldToBrowser();
recovery.api=await startGame({scene,renderer,graphics,camera,sky,sun,lighting,city,route:ROUTE,canvas,gltf});
}catch(error){$('reload-game').hidden=false;if(!recovery.lost){$('load-message').textContent='The game could not finish loading. Please reload to try again.';throw error;}}
