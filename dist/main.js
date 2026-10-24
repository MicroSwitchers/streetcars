import {loadStreetcar,yieldToBrowser} from './loading.js';
import {initialQuality,QUALITY,renderRatio} from './performance.js';
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
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'default'});}
catch(error){$('load-message').textContent='This browser could not start WebGL. Try a browser with hardware acceleration enabled.';$('reload-game').hidden=false;throw error;}
try{
const initial=QUALITY[initialQuality({coarse:matchMedia('(pointer: coarse)').matches,memory:navigator.deviceMemory})];
renderer.setPixelRatio(renderRatio(initial,innerWidth,innerHeight,devicePixelRatio));
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.5,1000);
const lighting=createDaylight(renderer,scene),{sky,sun}=lighting;
$('load-message').textContent='Loading the streetcar and neighbourhood...';
const [trafficCars,streetProps,architecture,gltf]=await Promise.all([loadTrafficCars(),loadStreetProps(),loadArchitecture(),loadStreetcar()]);
$('load-message').textContent='Building Queen Street...';await yieldToBrowser();
const city=buildEnvironment(scene,trafficCars,streetProps,architecture);
finishSurfaces(city.materials,renderer,ROUTE);
const graphics=createSceneRenderer(renderer);graphics.setQuality(initial);
$('load-message').textContent='Preparing lighting and graphics...';await yieldToBrowser();
await startGame({scene,renderer,graphics,camera,sky,sun,lighting,city,route:ROUTE,canvas,gltf});
}catch(error){$('load-message').textContent='The game could not finish loading. Please reload to try again.';$('reload-game').hidden=false;throw error;}
