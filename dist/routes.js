import {ROUTES} from './routes-data.js';
export {ROUTES};
export function readRouteId(storage){try{return storage&&JSON.parse(storage.getItem('queen-street-ride-settings-v1')||'{}').routeId==='dundas'?'dundas':'queen';}catch{return 'queen';}}
// The complete itinerary is presented in small overlapping street sections.
// Only one detailed neighbourhood is resident, keeping tablet memory bounded.
export function createRouteSection(id='queen',offset=0,firstStop=0){
 const data=ROUTES[id]??ROUTES.queen;
 offset=Math.max(0,Math.min(data.stops.length-3,Math.trunc(offset)||0));
 firstStop=Math.max(0,Math.min(2,Math.trunc(firstStop)||0));
 const stops=data.stops.slice(offset,offset+3).map((s,i)=>({...s,z:-124+i*200,index:offset+i}));
 return {id:data.id,number:data.number,title:data.title,name:data.name,destination:data.destination,oppositeDestination:data.oppositeDestination,
  allStops:data.stops,totalStops:data.stops.length,stopOffset:offset,firstStop,hasNext:offset+3<data.stops.length,
  start:-205+firstStop*200,end:360,trackX:-1.8,sidewalkX:-7.85,gauge:1.495,wireY:5.8,stops,
  crossings:stops.map(s=>({z:s.z+24,name:s.sign,road:s.road,stopId:s.id}))};
}
export function nextRouteSection(route){
 const next=route.stopOffset+3;
 if(next>=route.totalStops)return null;
 const offset=Math.min(route.stopOffset+2,route.totalStops-3);
 return createRouteSection(route.id,offset,next-offset);
}
