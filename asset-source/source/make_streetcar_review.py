"""Build a local screenshot comparison; images never enter the game's cache."""
from pathlib import Path
import argparse,json,shutil,struct
P=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--before-game',type=Path,required=True);parser.add_argument('--after-game',type=Path,required=True)
parser.add_argument('--doors',action='store_true')
args=parser.parse_args();out=P/('door-review' if args.doors else 'streetcar-review')
views=[{'key':k,'title':title,'note':note,'kind':'Blender Cycles render'} for k,title,note in [
 ('lounge','Rear seating','Duplicate wood liners removed. Seats and rolled frames clear the wall. The rear bench stays at the normal saloon height.'),
 ('partition','Rear entrance','Wood entrance baffles remain beside the stairwell, with a clear aisle and clear seat frames.'),
 ('front','Front exterior','Higher passenger-window transoms and aligned sash catches. The rounded cab, readable markings and body finish are retained.'),
 ('rear','Rear exterior','Rounded rear, seven-seat nook, ventilation panels and lamp clusters.'),
 ('roof','Roof equipment','Longer trolley equipment tray, porcelain supports, guard rails, cable conduit and walkway edges.'),
 ('interior','Full cabin','Continuous stainless seat surrounds, corrected wall/sill clearance and detailed floor access covers.'),
 ('nose','Cab fittings','Sprung wiper links, blade backing and washer jets on the curved windshield.')]]
if args.doors:
 views=[{'key':k,'title':title,'note':note,'kind':'Blender Cycles render'} for k,title,note in [
  ('rear-door-inside','Rear door interior','Red enamel cabin faces, black inner window seals, metal kick plates and full-depth window returns.'),
  ('rear-door-open','Rear door folded open','The inside is red and the outside retains the existing livery. Both faces move on the original folding pivots.'),
  ('front-door-inside','Front door interior','The same finish is applied consistently to all four front leaves.'),
  ('doors-through-windows','Through the opposite windows','The red inside surfaces remain visible from outside through the passenger glazing.')]]
scenarios=[('doorInside','In-game door interior'),('doorOpen','In-game door open'),('doorFront','In-game front door'),('doorThroughGlass','In-game through windows')] if args.doors else [('modelLounge','In-game rear seating'),('modelInterior','In-game cabin'),('modelRear','In-game exterior'),('modelRoof','In-game roof')]
for stage,path in [('before',args.before_game),('after',args.after_game)]:
 for scenario,_ in scenarios:
  shutil.copy2(path/(scenario+'.png'),out/stage/('game-'+scenario+'.png'))
for scenario,title in scenarios:
 views.append({'key':'game-'+scenario,'title':title,'kind':'Actual game screenshot · desktop','note':'Captured in Chrome using the same camera setup before and after the model revision.'})
def model_info(path):
 data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size])
 return {'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'materials':len(doc['materials']),'primitives':sum(len(m['primitives']) for m in doc['meshes']),'images':len(doc['images']),'bytes':len(data)}
before=model_info(out/'before'/'ttc-clrv.glb');after=model_info(P/'ttc-clrv-refined.glb');added=after['triangles']-before['triangles']
meta={'before':before,'after':after,'views':views}
if not args.doors:meta['clearance']=json.loads((out/'clearance.json').read_text())
(out/'review.json').write_text(json.dumps(meta,indent=2)+'\n')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Streetcar model — before and after</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#111c23;color:#eff4f2;font:16px/1.5 system-ui,sans-serif}main{max-width:1360px;margin:auto;padding:24px}h1{font-size:clamp(24px,4vw,38px);margin:0 0 8px}p{margin:8px 0;color:#c6d3d5}.chips{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.chips span{padding:6px 12px;border:1px solid #476069;border-radius:20px;font-size:14px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}button,a{color:#e9f4f0}button{font:inherit;cursor:pointer;background:#243943;border:1px solid #587680;border-radius:8px;padding:8px 12px}button[aria-pressed=true]{background:#e7c681;color:#18252b;border-color:#e7c681}button:focus-visible,input:focus-visible{outline:3px solid #e7c681;outline-offset:3px}.picture{position:relative;width:100%;aspect-ratio:1440/1024;background:#080e12;border:1px solid #45606a;overflow:hidden;border-radius:12px}.picture img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.picture img.before{clip-path:inset(0 50% 0 0)}.line{position:absolute;left:50%;top:0;bottom:0;border-left:2px solid #fff8dc;pointer-events:none}.tag{position:absolute;top:12px;padding:5px 10px;border-radius:5px;background:#111c23d9;font-weight:650}.tag.left{left:12px}.tag.right{right:12px}.control{display:flex;gap:16px;align-items:center;margin:16px 0}input{width:100%;accent-color:#e7c681}#kind{font-size:14px;letter-spacing:.02em}h2{font-size:22px;margin:20px 0 4px}.links{display:flex;gap:20px;flex-wrap:wrap}footer{margin:24px 0;color:#aebfc3;font-size:14px}
</style><main>
<h1>Streetcar model: before and after</h1><p>28 October 2026 · Move the divider to compare matching viewpoints.</p>
<div class="chips"><span>Wood/seat intersections: 0</span><span>Rear seats at normal height</span><span>+198 triangles (0.13%)</span><span>No new textures or materials</span></div>
<nav aria-label="Comparison views" id="views"></nav><h2 id="title"></h2><p id="kind"></p>
<div class="picture" id="picture"><img id="after" alt="Revised streetcar"><img id="before" class="before" alt="Previous streetcar"><div class="line" id="line"></div><span class="tag left">Before</span><span class="tag right">After</span></div>
<label class="control">Compare <input id="slider" type="range" min="0" max="100" value="50" aria-label="Before and after divider"></label>
<p id="note"></p><p class="links"><a id="open-before">Open before screenshot</a><a id="open-after">Open after screenshot</a><a href="../../../ttc-clrv-game-ready.blend">Editable Blender model</a></p>
<footer>Blender images are offline Cycles renders. The four “In-game” views show the real-time app. The model remains a reference-based reconstruction, rather than a surveyed replica. All screenshots are saved beside this page.</footer>
<script>
const views=__VIEWS__,nav=document.querySelector('#views'),slider=document.querySelector('#slider');
function select(v){for(const button of nav.children)button.setAttribute('aria-pressed',button.dataset.key===v.key);document.querySelector('#title').textContent=v.title;document.querySelector('#kind').textContent=v.kind;document.querySelector('#note').textContent=v.note;for(const stage of ['before','after']){document.querySelector('#'+stage).src=stage+'/'+v.key+'.png';document.querySelector('#open-'+stage).href=stage+'/'+v.key+'.png';}document.querySelector('#picture').style.aspectRatio=v.key.startsWith('game-')?'1440/960':'1440/1024';location.hash=v.key;}
for(const v of views){const b=document.createElement('button');b.textContent=v.title;b.dataset.key=v.key;b.onclick=()=>select(v);nav.append(b);}
slider.oninput=()=>{document.querySelector('#before').style.clipPath='inset(0 '+(100-slider.value)+'% 0 0)';document.querySelector('#line').style.left=slider.value+'%';};select(views.find(v=>v.key===location.hash.slice(1))||views[0]);
</script></main></html>'''
html=html.replace('+198 triangles (0.13%)',f'+{added:,} triangles ({added/before["triangles"]*100:.2f}%)')
if args.doors:
 html=html.replace('Streetcar model','Streetcar doors').replace('Wood/seat intersections: 0','Red enamel inside').replace('Rear seats at normal height','Black seals and metal kick plates')
(out/'index.html').write_text(html.replace('__VIEWS__',json.dumps(views)),encoding='utf8')
print(out/'index.html')
