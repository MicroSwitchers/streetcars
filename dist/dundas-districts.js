// Representative geography along the normal eastbound 505 itinerary. Indices
// interpolate between stops; scenery remains compressed and the track straight.
export const DUNDAS_DISTRICTS=Object.freeze([
 {id:'west',name:'Roncesvalles and the west-end rail corridor',from:0,to:4.5,height:11,shops:['WEST END COFFEE','RONCESVALLES BOOKS','WORKSHOP & STUDIO']},
 {id:'portugal',name:'Little Portugal',from:4.5,to:12.25,height:8,shops:['PADARIA · BAKERY','CAFÉ PORTUGAL','FLORES & MERCADO']},
 {id:'bellwoods',name:'Trinity Bellwoods and Toronto Western',from:12.25,to:15.5,height:9,shops:['BELLWOODS COFFEE','NEIGHBOURHOOD BOOKS','FLOWERS & GARDEN']},
 {id:'chinatown',name:'Chinatown',from:15.5,to:18.5,height:9,shops:['水果蔬菜 · PRODUCE','清香茶店 · TEA','麵包店 · BAKERY']},
 {id:'culture',name:'Art Gallery of Ontario and University Avenue',from:18.5,to:20.5,height:16,shops:['GALLERY SHOP','PRINT & DESIGN','CAFÉ & BOOKS']},
 {id:'core',name:'Downtown and Sankofa Square',from:20.5,to:24.5,height:24,shops:['DUNDAS · CITY CENTRE','TORONTO · ARTS & CULTURE','MUSIC · FILM · DESIGN']},
 {id:'garden',name:'Garden District and Cabbagetown edge',from:24.5,to:27.5,height:10,shops:['GARDEN DISTRICT CAFÉ','CORNER BOOKSHOP','NEIGHBOURHOOD MARKET']},
 {id:'regent',name:'Regent Park',from:27.5,to:30.25,height:27,shops:['REGENT PARK','COMMUNITY & CULTURE','DANIELS SPECTRUM']},
 {id:'don',name:'Don Valley crossing',from:30.25,to:30.82,height:6,shops:['DON VALLEY','RIVERSIDE','LOWER DON TRAIL']},
 {id:'riverside',name:'Riverside and East Chinatown',from:30.82,to:33.7,height:9,shops:['RIVERSIDE MARKET','東區 · EAST CHINATOWN','TEA & BAKERY']},
 {id:'riverdale',name:'Riverdale Park and Broadview',from:33.7,to:36.65,height:8,shops:['RIVERDALE PARK','BROADVIEW COFFEE','EAST END BOOKS']},
 {id:'terminal',name:'Broadview Station approach',from:36.65,to:38,height:9,shops:['BROADVIEW STATION','BROADVIEW MARKET','NEIGHBOURHOOD CAFÉ']},
].map(d=>Object.freeze({...d,shops:Object.freeze(d.shops)})));

export function dundasIndexAtZ(route,z){return Math.max(0,Math.min(38,(route.stopOffset||0)+(z+124)/200));}
export function dundasDistrictAt(index){
 const clamped=Math.max(0,Math.min(38,Number.isFinite(index)?index:0));
 return DUNDAS_DISTRICTS.find(d=>clamped<d.to)||DUNDAS_DISTRICTS.at(-1);
}
