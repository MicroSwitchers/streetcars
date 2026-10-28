"""Matching Cycles views of the saved Blender asset, before and after a revision."""
import bpy, sys, argparse, json
from pathlib import Path
from mathutils import Vector

P=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--stage',choices=['before','after'],required=True)
parser.add_argument('--review',choices=['streetcar-review','door-review'],default='streetcar-review')
parser.add_argument('--views',nargs='+',default=['lounge','partition','front','rear','roof','interior'])
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
out=P/args.review/args.stage;out.mkdir(parents=True,exist_ok=True)
native=P/args.review/'before'/'ttc-clrv-game-ready.blend' if args.stage=='before' else P.parent.parent/'ttc-clrv-game-ready.blend'
bpy.ops.wm.open_mainfile(filepath=str(native))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True;scene.cycles.adaptive_threshold=.04
scene.render.resolution_x=1440;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
def V(p):return Vector((p[0],-p[2],p[1]))
views={
 'lounge':((0,2.35,-4.35),(0,2.05,-7.1),22,None),
 'partition':((-.15,2.28,-.45),(.94,1.83,-3.75),25,None),
 'front':((13,5.5,18),(0,1.8,.4),None,18.6),
 'rear':((-13,5.5,-18),(0,1.8,-.4),None,18.6),
 'roof':((5.8,14,-9),(0,3.2,-.7),None,17.5),
 'interior':((0,2.48,4.85),(0,2.05,-5.5),19,None),
 'nose':((4.8,3.3,11.4),(0,2,6.5),None,5.7),
 'rear-door-inside':((-.55,2.05,-2.68),(1.28,1.5,-2.68),18,None),
 'rear-door-open':((-.55,2.05,-2.68),(1.28,1.5,-2.68),18,None),
 'front-door-inside':((-.75,2.45,5.9),(1.28,1.5,5.9),18,None),
 'doors-through-windows':((-4.4,2.5,-2.68),(1.28,1.7,-2.68),40,None),
}
for z in (-6.2,-3,0,3,5.5):
 data=bpy.data.lights.new('Review_saloon_fill','AREA');data.energy=22;data.shape='RECTANGLE';data.size=.8;data.size_y=2
 obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=V((0,3,z))
cam=scene.camera;cam.data.clip_start=.025
for name in args.views:
 for door in ['Front','Rear']:
  for part,sign in [('A',1),('B',-1)]:
   outer=bpy.data.objects['Door_'+door+'_'+part];inner=bpy.data.objects[outer.name+'_Fold']
   outer.rotation_euler.z=sign*1.448623279 if name.endswith('-open') else 0
   inner.rotation_euler.z=-sign*2.897246558 if name.endswith('-open') else 0
 bpy.context.view_layer.update()
 position,target,lens,ortho=views[name]
 cam.location=V(position);cam.rotation_euler=(V(target)-cam.location).to_track_quat('-Z','Y').to_euler()
 cam.data.type='ORTHO' if ortho else 'PERSP'
 if ortho:cam.data.ortho_scale=ortho
 else:cam.data.lens=lens
 scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
 print('PROGRESS_SCREENSHOT',args.stage,name,flush=True)
(out/'views.json').write_text(json.dumps({k:v for k,v in views.items() if k in args.views},indent=2)+'\n')
