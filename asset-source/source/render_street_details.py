"""Render the five added models from the saved editable street furniture file."""
import bpy
from pathlib import Path
from mathutils import Vector

def V(p):return Vector((p[0],-p[2],p[1]))
positions={'utilitycabinet':(-1.6,0,0),'newsbox':(0,0,0),'bikestand':(1.5,0,0),'treegrate':(-.9,0,1.7),'stormdrain':(.8,0,1.7)}
for o in bpy.data.objects:
    if o.name.startswith('Prop_'):
        root=o
        while root.parent:root=root.parent
        o.hide_render=root.name.removeprefix('Prop_') not in positions
for name,p in positions.items():bpy.data.objects['Prop_'+name].location=V(p)
scene=bpy.context.scene;scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.camera.location=V((4.5,4.0,6.5));scene.camera.rotation_euler=(V((0,.55,.7))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=5.4;scene.render.resolution_x=1200;scene.render.resolution_y=900
scene.render.filepath=str(Path(__file__).resolve().parent.parent/'streetscape/street-details-kit.png')
bpy.ops.render.render(write_still=True)
