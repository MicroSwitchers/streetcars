// A small architectural grammar shared by Queen, Dundas and their side streets.
// All coordinates are local: U runs along the wall and +Z faces outside.
export const FACADE_RELIEFS=Object.freeze(['flathead','spandrel','frieze','wallvent','downpipe','pilaster','stringcourse','roundel','shutters','brickheader','quoin']);

export function facadeReliefs({width,height,index=0,kind='shop',windows=[],roofClearance=.68,bottom=3.4,enriched=false}){
 const style=kind==='loft'?0:Math.abs(Math.floor(index))%4,details=[];
 const top=height-roofClearance,base=Math.max(3.9,bottom+.06),upper=windows.filter(w=>w.y>3.8&&w.y-w.height/2>bottom),rows=[...new Set(upper.map(w=>Math.round(w.y*100)/100))].sort((a,b)=>a-b);
 const emit=(kind,u,y,sx=1,sy=1)=>details.push({kind,u,y,sx,sy,sz:1,style});
 const clear=(u,y,w,h)=>upper.every(a=>Math.abs(u-a.u)>(w+a.width)/2+.035||Math.abs(y-a.y)>(h+a.height)/2+.035);
 if(kind==='modern'){
   const columns=[...new Set(upper.map(w=>w.u))].sort((a,b)=>a-b);
   for(let i=0;i<columns.length-1;i++){const u=(columns[i]+columns[i+1])/2;if(clear(u,(3.65+top)/2,.16,top-3.65))emit('pilaster',u,(3.65+top)/2,.55,top-3.65);}
   for(const y of [3.65,6.65,9.75])if(y<height)emit('stringcourse',0,y,width-.25);
   return {style:4,details};
 }
 for(const w of upper){
   if(w.feature)continue;
   const head=w.y+w.height/2+.10;
   if(head+.14<top)emit('flathead',w.u,head,w.width+.20);
   if(enriched&&(style===0||style===2)&&head+.47<top)emit('brickheader',w.u,head+.31,w.width+.22);
   if((kind==='house'&&style===2||kind==='shop'&&index%13===2)&&w.width<2)emit('shutters',w.u,w.y,w.width+.20,w.height/2);
   const lower=upper.filter(a=>Math.abs(a.u-w.u)<.25&&a.y<w.y-.2).sort((a,b)=>b.y-a.y)[0];
   if((style===1||style===2)&&lower){
     const lo=lower.y+lower.height/2+.26,hi=w.y-w.height/2-.04;
     if(hi-lo>.31){const y=(lo+hi)/2,h=Math.min(.48,hi-lo);if(clear(w.u,y,w.width,h))emit('spandrel',w.u,y,Math.min(2.4,w.width*.9),h/.48);}
   }
 }
 if(enriched&&kind!=='loft')for(const edge of [-1,1]){
   const u=edge*(width/2-.24);
   for(let y=base+.45;y+.45<top;y+=.9)if(clear(u,y,.42,.86))emit('quoin',u,y);
 }
 // Recessed terracotta panels occupy the empty parapet rather than windows.
 const highest=upper.length?Math.max(...upper.map(w=>w.y+w.height/2+(w.feature?.38:.23))):4.1;
 const bandBottom=Math.max(base+.25,highest+.13),bandTop=top-.12;
 if(style!==3&&bandTop-bandBottom>.52){
   const n=Math.max(1,Math.floor(width-1.0)),span=(width-.9)/n;
   for(let j=0;j<n;j++)emit('frieze',-width/2+.45+(j+.5)*span,(bandBottom+bandTop)/2,span);
 }
 // Wide industrial/side-street elevations get continuous raised piers between
 // window bays. Narrow shops keep their existing corner quoins instead.
 const columns=[...new Set(upper.map(w=>Math.round(w.u*100)/100))].sort((a,b)=>a-b);
 if(width>12||style===0&&width>9){
   for(let i=0;i<columns.length-1;i++){
     const u=(columns[i]+columns[i+1])/2,y=(base+.15+top)/2,h=top-base-.15;
     if(h>.7&&clear(u,y,.34,h))emit('pilaster',u,y,1,h);
   }
 }
 if(style===0){
   for(let i=0;i<rows.length-1;i++){
     const lower=upper.filter(w=>Math.abs(w.y-rows[i])<.02),higher=upper.filter(w=>Math.abs(w.y-rows[i+1])<.02);
     const lo=Math.max(...lower.map(w=>w.y+w.height/2))+.28,hi=Math.min(...higher.map(w=>w.y-w.height/2))-.12;
     if(hi-lo>.17)emit('stringcourse',0,(lo+hi)/2,width-.35);
   }
 }
 // Drainage is built from real short pipe sections, with collars and brackets.
 const pipeU=(index%2?-1:1)*(width/2-.43),pipeTop=height-.50;
 if(width>4&&clear(pipeU,(base+pipeTop)/2,.14,pipeTop-base)){
   for(let y=base;y<pipeTop-.1;y+=2.8)emit('downpipe',pipeU,y,1,Math.min(2.8,pipeTop-y)/2.8);
 }
 if(style!==1){
   const y=Math.min(top-.27,Math.max(4.55,height-1.05));
   for(const u of [-width*.32,width*.32])if(y-.26>bottom&&clear(u,y,.56,.52)&&details.every(d=>d.kind!=='frieze'||Math.abs(d.y-y)>.53))emit('wallvent',u,y);
   if(style===3&&y-.26>bottom&&clear(0,y,.56,.52))emit('roundel',0,y);
 }
 return {style,details};
}

export function reliefFacade(b){
 return {...b,origin:[b.side*b.front,0,b.z],rotation:-b.side*Math.PI/2,
   windows:(b.windows||[]).map(w=>({...w,u:b.side*(w.z-b.z)}))};
}
