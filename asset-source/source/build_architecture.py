"""Original modular Queen West architecture, metres, +Y up / +Z faces street.

Blender 4.5 --background --factory-startup --python this_file [-- --skip-render]
Exports local-zero prototypes; the native file opens as a labelled review kit.
"""
import bpy, bmesh, math, json, shutil, runpy, sys, tempfile
from pathlib import Path
from mathutils import Vector

P=Path(__file__).resolve().parent.parent
OUT=P/'architecture';OUT.mkdir(exist_ok=True)
TEMP=P.parent/'.architecture-build-temp';TEMP.mkdir(exist_ok=True);tempfile.tempdir=str(TEMP)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene.unit_settings.system='METRIC'
def V(p):return Vector((p[0],-p[2],p[1]))
def material(name,color,rough=.8,metal=0):
    m=bpy.data.materials.new('Architecture_'+name);m.use_nodes=True;m.diffuse_color=(*color,1)
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1)
    s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal
    return m
stone=material('Limestone',(.55,.48,.36),.89)
edge=material('CarvedStone',(.65,.59,.47),.84)
iron=material('Iron',(.038,.055,.052),.57,.65)
zinc=material('Zinc',(.34,.40,.40),.44,.78)
copper=material('PatinatedCopper',(.14,.27,.23),.62,.68)
slate=material('Slate',(.065,.085,.083),.83,.1)
paint=material('Sash',(.40,.42,.35),.66,.08)
glass=material('WindowGlass',(.045,.090,.10),.22,.3)
terra=material('Clay',(.29,.125,.065),.92)
dark=material('Recess',(.026,.033,.029),1)
roots=[]
def root(name):
    o=bpy.data.objects.new('Architecture_'+name,None);bpy.context.collection.objects.link(o)
    o['asset']='modular-architecture';o['people_free']=True;roots.append(o);return o
def finish(o,name,mat,parent,r=0):
    o.name=name;o.parent=parent;o.data.materials.append(mat)
    if r:
        b=o.modifiers.new('Small worn edge','BEVEL');b.width=r;b.segments=2;b.harden_normals=True
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
        for f in o.data.polygons:f.use_smooth=True
        n=o.modifiers.new('Weighted architectural normals','WEIGHTED_NORMAL');n.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=n.name)
    return o
def box(name,p,s,mat,parent,r=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(p));o=bpy.context.object;o.dimensions=(s[0],s[2],s[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,parent,r)
def cyl(name,p,r,h,mat,parent,axis=(0,1,0),vertices=10,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=h,location=V(p))
    o=bpy.context.object;o.rotation_euler=V(axis).to_track_quat('Z','Y').to_euler();finish(o,name,mat,parent)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o
def tube(name,points,r,mat,parent,sides=6):
    for a,b in zip(points,points[1:]):
        d=Vector(b)-Vector(a);cyl(name,(Vector(a)+Vector(b))/2,r,d.length,mat,parent,d.normalized(),sides)
def mesh(name,verts,faces,mat,parent):
    g=bpy.data.meshes.new(name);g.from_pydata([V(p) for p in verts],[],faces);g.update()
    if len(faces)>1:
        bm=bmesh.new();bm.from_mesh(g);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(g);bm.free()
    o=bpy.data.objects.new(name,g);bpy.context.collection.objects.link(o);return finish(o,name,mat,parent)
def profile(name,points,width,mat,parent):
    n=len(points);v=[(x,y,z) for x in [-width/2,width/2] for y,z in points]
    return mesh(name,v,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat,parent)
def pane(name,a,b,y,h,mat,parent):
    # A real canted slab; local +Z is always outside the facade.
    d=Vector((b[0]-a[0],0,b[1]-a[1]));o=box(name,((a[0]+b[0])/2,y,(a[1]+b[1])/2),(d.length,h,.025),mat,parent,.002)
    o.rotation_euler.z=-math.atan2(d.z,d.x)

# One-metre module: profiled stone courses, shadow recess, dentils and corbels.
p=root('cornice')
profile('Ogee crown',[(-.46,0),(-.46,.18),(-.34,.18),(-.30,.25),(-.24,.27),(-.18,.34),(-.14,.43),(-.08,.47),(-.08,.55),(.04,.55),(.04,-.025)],.992,stone,p)
for y,z,h,d in [(-.45,.22,.055,.42),(-.17,.38,.045,.42),(.045,.28,.055,.60)]:box('Crisp moulding',(0,y,z),(.992,h,d),edge,p,.004)
for x in [-.36,-.12,.12,.36]:box('Dentil block',(x,-.37,.31),(.105,.13,.22),edge,p,0)
for x in [-.34,.34]:
    for y,z,w,d in [(-.65,.11,.13,.17),(-.56,.16,.11,.20),(-.49,.23,.16,.29)]:box('Console bracket',(x,y,z),(w,.09,d),stone,p,0)

# Separate voussoirs and projecting keystone; the rectangular sash stays visible.
p=root('archedhood')
for j in range(11):
    a=j*math.pi/11+.012;b=(j+1)*math.pi/11-.012
    v=[(r*math.cos(t),.82+r*math.sin(t),z) for z in [.055,.23] for r,t in [(.67,a),(.67,b),(.86,b),(.86,a)]]
    mesh('Radial limestone voussoir',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],stone if j%2 else edge,p)
for x in [-.76,.76]:box('Arch springer',(x,.81,.16),(.28,.16,.33),edge,p)
box('Projecting keystone',(0,1.59,.21),(.18,.30,.25),edge,p,.01)

# Complete replacement for the old intersecting box bay. Three canted sashes,
# panelled apron, mullions and a standing-seam copper cap.
p=root('baywindow')
segments=[((-1.02,.02),(-.59,.65)),((-.59,.65),(.59,.65)),((.59,.65),(1.02,.02))]
for a,b in segments:
    pane('Bay glazing',a,b,.03,1.54,glass,p)
    pane('Panelled apron',a,b,-.91,.30,paint,p)
    for y in [-.76,.03,.82]:tube('Sash horizontal',[(a[0],y,a[1]+.025),(b[0],y,b[1]+.025)],.025,paint,p,8)
    for x,z in [a,b]:tube('Bay jamb',[(x,-1.10,z+.02),(x,.93,z+.02)],.035,paint,p,8)
    mx=(a[0]+b[0])/2;mz=(a[1]+b[1])/2
    tube('Fine sash vertical',[(mx,-.73,mz+.025),(mx,.80,mz+.025)],.016,paint,p)
    for y in [-1.09,.94]:tube('Bay moulding',[(a[0],y,a[1]+.05),(b[0],y,b[1]+.05)],.065,edge,p,8)
mesh('Copper bay roof',[(-1.11,.99,-.015),(-.65,.99,.77),(.65,.99,.77),(1.11,.99,-.015),(-1.02,1.22,-.04),(1.02,1.22,-.04)],[(0,1,2,3),(0,4,1),(1,4,5,2),(2,5,3),(3,5,4,0)],copper,p)
for x in [-.50,-.25,0,.25,.50]:tube('Raised copper roof seam',[(x,1.225,-.03),(x,1.005,.76)],.008,copper,p)
for x in [-.68,.68]:tube('Bay support console',[(x,-1.55,.025),(x,-1.17,.55),(x,-1.08,.59)],.045,stone,p,8)

# French doors open onto a true shallow iron balcony, no floating flower boxes.
p=root('balcony')
box('Door masonry surround',(0,0,.03),(1.53,2.25,.18),stone,p)
box('French door glass',(0,0,.135),(1.25,2.08,.025),glass,p,.002)
for x in [-.65,0,.65]:box('Door jamb',(x,0,.165),(.055,2.16,.055),paint,p)
for y in [-1.055,0,1.055]:box('Door sash',(0,y,.165),(1.35,.055,.055),paint,p)
box('Balcony stone threshold',(0,-1.13,.40),(1.94,.13,.92),stone,p)
for x in [-.92,.92]:
    tube('Balcony side rail',[(x,-1.04,.04),(x,.02,.04),(x,.02,.84),(x,-1.04,.84)],.022,iron,p)
    tube('Balcony support',[(x,-1.52,.03),(x,-1.13,.73)],.025,iron,p)
for y in [-.97,-.08,.045]:tube('Balcony front rail',[(-.93,y,.84),(.93,y,.84)],.022,iron,p,8)
for j in range(13):
    x=-.85+j*1.7/12;tube('Slender iron baluster',[(x,-.97,.84),(x,-.08,.84)],.010,iron,p)
for x in [-.60,0,.60]:
    for mirror in [-1,1]:
        pts=[(x+mirror*.125*math.sin(t),-.49+.29*math.cos(t),.85) for t in [k*math.tau/16 for k in range(17)]]
        tube('Wrought iron oval scroll',pts,.009,iron,p)

p=root('pediment')
box('Stone pediment base',(0,0,.14),(2.15,.14,.34),edge,p)
mesh('Carved triangular tympanum',[(-1.02,.07,.02),(1.02,.07,.02),(0,.77,.02),(-1.02,.07,.22),(1.02,.07,.22),(0,.77,.22)],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],stone,p)
for a,b in [((-1.12,.05,.25),(0,.85,.25)),((0,.85,.25),(1.12,.05,.25))]:tube('Pediment raking moulding',[a,b],.065,edge,p,8)
cyl('Central carved rosette',(0,.31,.239),.15,.025,edge,p,(0,0,1),16)
cyl('Rosette inset',(0,.31,.256),.092,.014,stone,p,(0,0,1),12)

p=root('firelanding')
for z in [.06,.88]:box('Landing rim',(0,0,z),(2.36,.09,.07),iron,p)
for x in [-1.15,1.15]:
    box('Landing end',(x,0,.47),(.06,.09,.89),iron,p)
    tube('Landing side handrail',[(x,.04,.08),(x,1.02,.08),(x,1.02,.90),(x,.04,.90)],.021,iron,p)
    tube('Wall brace',[(x,-.62,.02),(x,-.05,.84)],.027,iron,p)
for j in range(26):box('Open grating slat',(-1.10+j*.088,.015,.47),(.027,.04,.80),iron,p,0)
for y in [.12,1.02]:tube('Front guardrail',[(-1.15,y,.90),(1.15,y,.90)],.021,iron,p)
for j in range(15):
    x=-1.10+j*2.2/14;tube('Landing baluster',[(x,.12,.90),(x,1.02,.90)],.009,iron,p)

p=root('escapeladder')
for x in [-.24,.24]:tube('Raised escape ladder side',[(x,0,.95),(x,2.7,.95)],.023,iron,p,8)
for j in range(10):tube('Ladder rung',[(-.25,.12+j*.27,.95),(.25,.12+j*.27,.95)],.015,iron,p,8)

p=root('rooflantern')
box('Flashed skylight curb',(0,.13,0),(2.12,.26,1.65),zinc,p)
box('Skylight dark reveal',(0,.29,0),(1.98,.10,1.49),dark,p)
for side in [-1,1]:
    # Low pitched glazing and separate standing mullions.
    mesh('Skylight glass',[(-.96,.34,side*.70),(.96,.34,side*.70),(.96,.83,0),(-.96,.83,0)],[(3,2,1,0)] if side<0 else [(0,1,2,3)],glass,p)
    for x in [-1,-.5,0,.5,1]:tube('Skylight glazing bar',[(x,.33,side*.74),(x,.85,0)],.022,zinc,p)
    tube('Skylight eave',[(-1,.33,side*.74),(1,.33,side*.74)],.028,zinc,p)
for side in [-1,1]:
    x=side*.96
    mesh('Triangular skylight end',[(x,.34,-.70),(x,.34,.70),(x,.83,0)],[(0,1,2)] if side<0 else [(2,1,0)],glass,p)
    tube('Skylight end sill',[(side, .33,-.74),(side,.33,.74)],.026,zinc,p)
    tube('Skylight end mullion',[(side,.33,0),(side,.85,0)],.020,zinc,p)
tube('Skylight ridge',[(-1.06,.86,0),(1.06,.86,0)],.035,zinc,p,10)

p=root('chimneypots')
box('Chimney roof flashing',(0,.03,0),(1.18,.06,.75),zinc,p)
box('Masonry chimney stack',(0,.48,0),(1.02,.90,.59),stone,p)
for y in [.22,.45,.68]:box('Chimney mortar bed',(0,y,.302),(1.01,.015,.008),edge,p,0)
box('Chimney coping',(0,.96,0),(1.18,.12,.75),edge,p)
for x in [-.31,.31]:
    cyl('Terracotta chimney pot',(x,1.23,0),.16,.45,terra,p,vertices=16,r2=.14)
    for y,r in [(1.045,.19),(1.41,.175)]:cyl('Pot collar',(x,y,0),r,.07,terra,p,vertices=16)
    cyl('Recessed flue',(x,1.449,0),.115,.005,dark,p,vertices=16)

p=root('cupola')
box('Cupola flashing',(0,.035,0),(1.08,.07,1.08),zinc,p)
box('Cupola dark louvres',(0,.48,0),(.80,.82,.80),dark,p)
for y in [.19,.32,.45,.58,.71,.84]:
    for side in [-1,1]:
        box('Cupola louvre',(0,y,side*.42),(.87,.045,.12),paint,p,0)
        box('Cupola louvre',(side*.42,y,0),(.12,.045,.87),paint,p,0)
for x in [-.43,.43]:
    for z in [-.43,.43]:box('Cupola corner post',(x,.49,z),(.06,.84,.06),paint,p)
mesh('Copper pyramidal cap',[(-.57,.94,-.57),(.57,.94,-.57),(.57,.94,.57),(-.57,.94,.57),(0,1.36,0)],[(0,4,1),(1,4,2),(2,4,3),(3,4,0),(3,2,1,0)],copper,p)
cyl('Copper finial',(0,1.42,0),.038,.18,copper,p,vertices=12,r2=.012)

# Low-cost reliefs break up blank masonry without new textures or lights.
runpy.run_path(str(P/'source/facade_detail_models.py'))['build'](globals())

# Bake bevels/normals, compact by material, triangulate for a decoder-free GLB.
report={}
for p in roots:
    groups={}
    for o in list(p.children):groups.setdefault(o.active_material,[]).append(o)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0];o.name=p.name+'__'+mat.name
        tri=o.modifiers.new('Game triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    report[p.name]={'triangles':sum(len(o.data.polygons) for o in p.children),'materials':len(p.children)}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'architecture.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_yup=True,export_tangents=False)
runpy.run_path(str(P/'source/optimize_glb.py'))['optimize'](OUT/'architecture.glb',{})
shutil.copy2(OUT/'architecture.glb',P.parent/'dist/architecture.glb')
report['glb_bytes']=(OUT/'architecture.glb').stat().st_size
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
asset_objects=list(bpy.data.objects)
rows=math.ceil(len(roots)/5)
for i,p in enumerate(roots):p.location=V(((i%5-2)*3.0,1.5,(i//5-(rows-1)/2)*4.4))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.55,.62,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
box('Review floor',(0,-.065,0),(60,.1,60),material('Studio',(.09,.11,.12)),None,0)
for name,pos,power,size in [('Key',(0,12,6),2100,8),('Fill',(-8,7,0),1400,6)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=V(pos);o.rotation_euler=(V((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Architecture review');o=bpy.data.objects.new('Architecture review',data);scene.collection.objects.link(o);scene.camera=o
o.location=V((10,13,20));o.rotation_euler=(V((0,1.6,0))-o.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=22 if len(roots)>10 else 18
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'kit.png')
for label,objects in [('Game assets',asset_objects),('Review studio',[o for o in bpy.data.objects if o not in asset_objects])]:
    collection=bpy.data.collections.new(label);scene.collection.children.link(collection)
    for o in objects:
        for previous in list(o.users_collection):previous.objects.unlink(o)
        collection.objects.link(o)
bpy.ops.wm.save_as_mainfile(filepath=str(P.parent.parent/'building-architecture-game-ready.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('ARCHITECTURE_COMPLETE',json.dumps(report),flush=True)
