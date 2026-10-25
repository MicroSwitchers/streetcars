import assert from 'node:assert/strict';
import {ROUTES,createRouteSection,nextRouteSection,readRouteId} from '../dist/routes.js';
import {Ride} from '../dist/ride.js';
const rig=()=>({doors:{front:0,rear:0},setDoor(_,v){this.doors.front=this.doors.rear=v;},setDistance(){},setBrake(){},update(){}});
assert.equal(readRouteId({getItem:()=>'{bad'}),'queen');assert.equal(readRouteId({getItem:()=>' {"routeId":"dundas"}'}),'dundas');
const queen=ROUTES.queen.stops.map(s=>s.label),dundas=ROUTES.dundas.stops.map(s=>s.label);
assert.deepEqual(queen.slice(queen.indexOf('Bathurst Street'),queen.indexOf('Spadina Avenue')+1),['Bathurst Street','Augusta Avenue','Spadina Avenue']);
assert.deepEqual(dundas.slice(dundas.indexOf('Bathurst Street'),dundas.indexOf('Spadina Avenue')+1),['Bathurst Street','Denison Avenue','Spadina Avenue']);
assert.equal(queen[0],'Humber Loop');assert.equal(queen.at(-1),'Neville Park Boulevard');
assert.equal(dundas[0],'Dundas West Station');assert.equal(dundas.at(-1),'Broadview Station');
assert.ok(!ROUTES.queen.stops.some(s=>/Adelaide|Richmond|Portland/.test(s.name)));
assert.ok(ROUTES.dundas.stops.some(s=>s.name.includes('TMU Station')));
let trips=0;
for(const id of Object.keys(ROUTES))for(const every of [1,2]){
 let section=createRouteSection(id),visits=[],sections=0;
 while(section){
  const ride=new Ride(section,rig());ride.setDwellSeconds(0);ride.setStopEvery(every);ride.setAlwaysGreen(true);ride.go();
  for(let tick=0;tick<40000;tick++){
   ride.step(.1);
   if(['atStop','finished'].includes(ride.state.phase)){
    const i=ride.state.currentStop;
    if(i>=0&&visits.at(-1)!==section.stops[i].index)visits.push(section.stops[i].index);
    if(ride.state.phase==='finished')break;
    assert.ok(ride.go());
   }
   assert.ok(tick<39999,'section must finish');
  }
  assert.equal(section.stops.length,3,'constant resident neighbourhood size');sections++;section=nextRouteSection(section);
 }
 const expected=ROUTES[id].stops.map((_,i)=>i).filter(i=>i%every===0||i===ROUTES[id].stops.length-1);
 assert.deepEqual(visits,expected,id+' visits every scheduled stop once, including the terminus');trips++;
}
console.log(JSON.stringify({pass:true,trips,queenStops:queen.length,dundasStops:dundas.length,globalStopIntervals:true,boundedSections:true}));
