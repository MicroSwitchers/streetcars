"""Read-only checks for the saved editable model's rest pose and entry clearance."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(P.parent.parent/'ttc-clrv-game-ready.blend'))
checks=[]
def check(label,value):
    assert value,label
    checks.append(label)
if bpy.data.objects['Streetcar_Root'].get('door_interior_revision')=='red-enamel-inner-seals-v1':
    bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
    def V(p):return Vector((p[0],-p[2],p[1]))
    for door in ['Front','Rear']:
        for part,sign in [('A',1),('B',-1)]:
            for suffix in ['', '_Fold']:
                pivot=bpy.data.objects['Door_'+door+'_'+part+suffix];c=-sign*.18
                for label,y,z,material in [('waist',1.36,c,'TTC_Vermilion'),('upper frame',2.15,c+.145,'TTC_Vermilion'),('window seal',2.15,c+.122,'Window_Rubber'),('glazing',2.15,c,'Tinted_Glass'),('kick plate',.39,c,'Brushed_Skirt')]:
                    origin=pivot.matrix_world@V((-.30,y,z));direction=(pivot.matrix_world.to_3x3()@V((1,0,0))).normalized()
                    hit,point,normal,index,obj,matrix=bpy.context.scene.ray_cast(dg,origin,direction,distance=.5)
                    check(pivot.name+' cabin '+label,hit and obj.active_material.name==material)
for name,z in [('Front',5.90),('Rear',-2.68)]:
    group=bpy.data.objects['Door_'+name]
    check(name+' group position',(group.location-Vector((0,-z,0))).length<.00001)
    for part,sign in [('A',1),('B',-1)]:
        outer=bpy.data.objects['Door_'+name+'_'+part];inner=bpy.data.objects[outer.name+'_Fold']
        check(outer.name+' canonical rest position',(outer.location-Vector((1.275,-sign*.72,0))).length<.00001)
        check(inner.name+' canonical rest position',(inner.location-Vector((0,sign*.36,0))).length<.00001)
        check(outer.name+' closed pose',outer.rotation_euler.to_quaternion().angle<.00001)
        check(inner.name+' closed pose',inner.rotation_euler.to_quaternion().angle<.00001)
        check(outer.name+' stored animation muted',all(t.mute for t in outer.animation_data.nla_tracks))
        outer.rotation_euler.z=sign*math.radians(83)
        inner.rotation_euler.z=-sign*math.radians(166)
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
for name,z in [('Front',5.90),('Rear',-2.68)]:
    for offset in [-.3,0,.3]:
        for height in [.89,1.66]:
            hit=bpy.context.scene.ray_cast(dg,Vector((2,-z-offset,height)),Vector((-1,0,0)),distance=.85)[0]
            check(name+' doorway clear at '+str((offset,height)),not hit)
for z in (-5.7,-6.55):
    hit,point,normal,index,obj,matrix=bpy.context.scene.ray_cast(dg,Vector((0,-z,1.35)),Vector((0,0,-1)))
    check('Rear floor matches saloon level at '+str(z),hit and abs(point.z-1.10)<.01)
def cushion_height(x,z):
    hit,point,normal,index,obj,matrix=bpy.context.scene.ray_cast(dg,Vector((x,-z,1.95)),Vector((0,0,-1)))
    check('Cushion ray hits upholstery at '+str((x,z)),hit and obj.active_material.name=='Burgundy_Seats')
    return point.z
reference=cushion_height(-.49,3.55)
side_centre=bpy.data.objects['Streetcar_Root'].get('rear_side_seat_centre_m',.925)
for x,z in [(-.46,-7.055),(0,-7.055),(.46,-7.055),(-side_centre,-5.68),(-side_centre,-6.29),(side_centre,-5.68),(side_centre,-6.29)]:
    check('Rear seat level matches normal seating '+str((x,z)),abs(cushion_height(x,z)-reference)<.02)
result={'pass':True,'checks':checks}
(P/'native-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print('NATIVE_ASSET_VALIDATED',len(checks),flush=True)
