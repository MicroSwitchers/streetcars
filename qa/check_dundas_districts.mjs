import assert from 'node:assert/strict';
import {ROUTES,createRouteSection} from '../dist/routes.js';
import {DUNDAS_DISTRICTS,dundasDistrictAt,dundasIndexAtZ} from '../dist/dundas-districts.js';

const stops=ROUTES.dundas.stops;
for(const [label,id] of [
 ['Dundas West Station','west'],['Lansdowne Avenue','portugal'],['Ossington Avenue','portugal'],
 ['Grace Street','bellwoods'],['Bathurst Street','bellwoods'],['Denison Avenue','chinatown'],
 ['Spadina Avenue','chinatown'],['McCaul Street','culture'],['University Avenue','culture'],
 ['Yonge Street','core'],['Jarvis Street','garden'],['Regent Park Boulevard','regent'],
 ['Mountstephen Street','riverside'],['Gerrard St East','riverside'],['Langley Avenue','riverdale'],
 ['Millbrook Crescent','riverdale'],['Broadview Station','terminal'],
]){
 const index=stops.findIndex(s=>s.label===label);assert.ok(index>=0,label);
 assert.equal(dundasDistrictAt(index).id,id,label+' belongs to the researched scenery region');
}
assert.equal(dundasDistrictAt(30.5).id,'don','Don Valley lies between River and Broadview');
assert.equal(dundasDistrictAt(-100).id,'west');assert.equal(dundasDistrictAt(100).id,'terminal');
assert.equal(DUNDAS_DISTRICTS[0].from,0);assert.equal(DUNDAS_DISTRICTS.at(-1).to,38);
for(let i=1;i<DUNDAS_DISTRICTS.length;i++)assert.equal(DUNDAS_DISTRICTS[i].from,DUNDAS_DISTRICTS[i-1].to,'no missing or ambiguous scenery regions');
for(let offset=0;offset<=36;offset+=2){
 const route=createRouteSection('dundas',offset);
 for(const stop of route.stops)assert.equal(dundasIndexAtZ(route,stop.z),stop.index,'same stop retains its region between sections');
}
console.log('PASS: 12 contiguous Dundas scenery regions match route stops, including Don crossing and shared section boundaries.');
