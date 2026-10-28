import assert from 'node:assert/strict';
import {deviceGraphics,initialQuality,AdaptiveQuality,qualityProfile,renderRatio,GRAPHICS_RECOVERY_KEY} from '../dist/performance.js';
for(const nav of [{userAgent:'Mozilla/5.0 (iPad; CPU OS 27_0_1 like Mac OS X)'},{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:5},{userAgent:'iPhone'}]){
 const device=deviceGraphics(nav,true);assert.ok(device.compatibility);assert.equal(initialQuality(device),'balanced');
}
assert.equal(deviceGraphics({platform:'MacIntel',maxTouchPoints:0}).compatibility,false);
assert.equal(deviceGraphics({userAgent:'Android',deviceMemory:8},true).compatibility,false);
assert.equal(initialQuality(deviceGraphics({userAgent:'Android',deviceMemory:8},true)),'balanced','portable devices start at the middle graphics level');
assert.equal(initialQuality(deviceGraphics({userAgent:'Android',deviceMemory:2},true)),'low','very small memory budgets retain the fallback');
assert.ok(deviceGraphics({},false,{getItem:key=>key===GRAPHICS_RECOVERY_KEY?'1':null}).compatibility);
assert.doesNotThrow(()=>deviceGraphics({},false,{getItem(){throw Error('Storage denied');}}));
const budget=new AdaptiveQuality('low','low');
for(const mode of ['high','balanced','auto','low']){budget.select(mode);for(let i=0;i<5000;i++)budget.sample(1/60);assert.equal(budget.level,'low');}
for(const [w,h,dpr] of [[1024,1366,2],[2160,1620,2],[390,844,3]])for(const level of ['low','balanced','high']){const profile=qualityProfile(level,true);assert.ok(w*h*renderRatio(profile,w,h,dpr)**2<=(level==='low'?400001:1100001));assert.equal(profile.shadow,level==='low'?512:1536);assert.equal(profile.spots,level==='low'?4:6);assert.equal(profile.points,level==='low'?2:3);}
const tablet=new AdaptiveQuality('balanced','balanced',30);for(let i=0;i<3000;i++)tablet.sample(1/30);assert.equal(tablet.level,'balanced','a healthy 30 fps tablet must not downgrade itself');
for(let i=0;i<500;i++)tablet.sample(.06);assert.equal(tablet.level,'low');for(let i=0;i<2000;i++)tablet.sample(1/30);assert.equal(tablet.level,'balanced');
assert.equal(initialQuality(deviceGraphics({platform:'MacIntel',maxTouchPoints:5},true,{getItem:()=> '1'})),'low','failed graphics start conservatively');
console.log('PASS: iPad and desktop-mode detection, persisted recovery, denied storage, sustained-fast-frame ceiling, saved High override and pixel/shadow budgets.');
