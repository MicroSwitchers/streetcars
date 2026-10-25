"""Original people-free streetscape kit. Metres, game +Y up / +Z forward.

Blender 4.5: --background --factory-startup --python this_file -- --skip-render
The export has local-zero prototypes; the native file opens as a review lineup.
"""
import bpy, math, json, shutil, runpy, sys, tempfile
from pathlib import Path
from mathutils import Vector

P=Path(__file__).resolve().parent.parent
OUT=P/'streetscape';OUT.mkdir(exist_ok=True)
TEMP=P.parent/'.prop-build-temp';TEMP.mkdir(exist_ok=True);tempfile.tempdir=str(TEMP)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene.unit_settings.system='METRIC'
def V(p):return Vector((p[0],-p[2],p[1]))
def material(name,color,rough=.7,metal=0):
    m=bpy.data.materials.new('Prop_'+name);m.use_nodes=True;m.diffuse_color=(*color,1)
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1)
    s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal
    return m
iron=material('Iron',(.045,.065,.061),.62,.65)
wood=material('Cedar',(.25,.13,.065),.76)
red=material('PostalRed',(.47,.025,.035),.48,.2)
ochre=material('HydrantOchre',(.68,.43,.055),.54,.3)
zinc=material('Zinc',(.38,.43,.44),.46,.75)
stone=material('PlanterStone',(.40,.41,.37),.92)
soil=material('Soil',(.055,.043,.026),1)
black=material('Recess',(.016,.024,.027),.79)
blue=material('RecyclingBlue',(.04,.15,.24),.53,.25)
cream=material('Lettering',(.83,.78,.65),.73)
screen=material('MeterScreen',(.055,.12,.13),.23,.25)
paper=material('Paper',(.70,.65,.49),.91)
book_mats=[red,blue,ochre,iron,cream]
pastry=material('BakedBread',(.48,.24,.075),.88)
leafgreen=material('ProduceGreen',(.16,.29,.075),.86)
lamp=material('ShopLamp',(.90,.72,.42),.5)
roots=[]
def root(name):
    o=bpy.data.objects.new('Prop_'+name,None);bpy.context.collection.objects.link(o)
    o['asset']='street-prop';o['people_free']=True;roots.append(o);return o
def finish(o,name,mat,parent,r=0):
    o.name=name;o.data.materials.append(mat);o.parent=parent
    if r:
        bevel=o.modifiers.new('Rounded manufactured edges','BEVEL');bevel.width=r;bevel.segments=2
        bevel.harden_normals=True;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
        for f in o.data.polygons:f.use_smooth=True
        normal=o.modifiers.new('Weighted hard-surface normals','WEIGHTED_NORMAL');normal.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return o
def box(name,p,s,mat,parent,r=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(p));o=bpy.context.object
    o.dimensions=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,r)
def cyl(name,p,r,h,mat,parent,axis=(0,1,0),vertices=12,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=h,location=V(p))
    o=bpy.context.object;o.rotation_euler=V(axis).to_track_quat('Z','Y').to_euler()
    finish(o,name,mat,parent)
    for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
    return o
def tube(name,points,r,mat,parent,sides=6):
    for a,b in zip(points,points[1:]):
        delta=Vector(b)-Vector(a);cyl(name,(Vector(a)+Vector(b))/2,r,delta.length,mat,parent,delta.normalized(),sides)
def text(body,p,size,mat,parent):
    curve=bpy.data.curves.new('Small engraved lettering','FONT');curve.body=body;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.resolution_u=1
    o=bpy.data.objects.new(body,curve);bpy.context.collection.objects.link(o);o.location=V(p);o.rotation_euler.x=math.pi/2;o.parent=parent;curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')

# Long axis X, front +Z. Individual seat/back slats and shaped iron armrests.
p=root('bench')
for x in [-.68,.68]:
    tube('Cast bench leg',[(x,.03,.28),(x,.42,.20),(x,.47,-.20),(x,.05,-.32)],.033,iron,p,8)
    tube('Back support',[(x,.38,-.18),(x,.70,-.28),(x,.95,-.33)],.025,iron,p,8)
    tube('Curved armrest',[(x,.46,.24),(x,.65,.24),(x,.70,.15),(x,.70,-.18),(x,.65,-.25)],.022,iron,p,8)
    for z in [-.31,.28]:box('Foot casting',(x,.025,z),(.14,.05,.13),iron,p)
for z in [-.22,-.11,0,.11,.22]:box('Cedar seat slat',(0,.46,z),(1.80,.045,.092),wood,p)
for y in [.62,.75,.88]:
    slat=box('Cedar back slat',(0,y,-.25-(y-.62)*.18),(1.80,.105,.04),wood,p);slat.rotation_euler.x=.18
    for x in [-.68,.68]:cyl('Slat bolt',(x,y,-.223-(y-.62)*.18),.010,.008,zinc,p,(0,0,1),6)

p=root('bins')
for x,mat in [(-.255,iron),(.255,blue)]:
    box('Steel bin body',(x,.48,0),(.47,.82,.48),mat,p,.045)
    box('Lid overhang',(x,.925,0),(.50,.10,.52),mat,p,.035)
    box('Recessed opening',(x,.945,.265),(.30,.07,.008),black,p,.018)
    box('Door seam',(x,.45,.244),(.37,.60,.008),black,p,.012)
    box('Hinged door',(x,.45,.252),(.35,.58,.012),mat,p,.012)
    box('Handle',(x+.13,.69,.269),(.035,.10,.025),zinc,p,.008)
    text('WASTE' if x<0 else 'RECYCLE',(x,.77,.267),.045,cream,p)
    for z in [-.18,.18]:box('Raised bin foot',(x,.05,z),(.35,.10,.055),iron,p)

p=root('hydrant')
cyl('Base flange',(0,.065,0),.19,.13,iron,p,vertices=16)
cyl('Barrel',(0,.42,0),.115,.63,ochre,p,vertices=16)
for y in [.18,.66]:cyl('Barrel flange',(0,y,0),.145,.045,ochre,p,vertices=16)
cyl('Bonnet',(0,.78,0),.15,.18,red,p,vertices=16,r2=.045)
cyl('Bonnet nut',(0,.89,0),.035,.055,zinc,p,vertices=6)
for side in [-1,1]:
    cyl('Hose outlet',(side*.16,.56,0),.065,.16,ochre,p,(1,0,0))
    cyl('Threaded outlet cap',(side*.245,.56,0),.078,.055,red,p,(1,0,0))
    cyl('Cap wrench lug',(side*.28,.56,0),.026,.025,zinc,p,(1,0,0),6)
    tube('Hanging cap tether',[(side*.25,.50,0),(side*.23,.27,.05),(side*.12,.26,.08),(side*.10,.45,.08)],.006,iron,p)
for i in range(4):
    a=i*math.tau/4;cyl('Base fixing',(.145*math.cos(a),.138,.145*math.sin(a)),.018,.018,zinc,p,vertices=6)

p=root('postbox')
box('Raised plinth',(0,.10,0),(.49,.20,.43),iron,p,.025)
box('Red postal cabinet',(0,.67,0),(.62,1.02,.50),red,p,.05)
box('Sloping rain hood',(0,1.18,.02),(.66,.11,.56),red,p,.04)
box('Mail aperture',(0,.94,.257),(.45,.075,.012),black,p,.018)
box('Letter flap',(0,.925,.278),(.45,.025,.05),zinc,p,.008)
box('Collection panel',(0,.65,.258),(.26,.23,.008),cream,p,.008)
text('POST',(0,1.075,.261),.10,cream,p)
for y in [.61,.65,.69]:box('Collection schedule',(0,y,.265),(.19,.008,.005),iron,p,0)
box('Collection door seam',(0,.33,.256),(.49,.31,.008),black,p,.015)
box('Collection door',(0,.33,.264),(.47,.29,.012),red,p,.015)
cyl('Door lock',(.19,.42,.278),.017,.013,zinc,p,(0,0,1),8)

p=root('meter')
box('Meter foot',(0,.03,0),(.21,.06,.18),iron,p)
cyl('Meter post',(0,.58,0),.042,1.1,iron,p)
box('Parking pay head',(0,1.33,0),(.27,.49,.21),iron,p,.045)
box('Display bezel',(0,1.40,.110),(.20,.16,.012),zinc,p,.012)
box('LCD screen',(0,1.40,.119),(.165,.12,.008),screen,p,.008)
box('Coin slot',(.06,1.22,.111),(.012,.075,.006),black,p,0)
for x in [-.06,0]:cyl('Payment button',(x,1.25,.117),.017,.013,ochre,p,(0,0,1),8)
panel=box('Solar canopy',(0,1.61,-.015),(.31,.035,.27),blue,p);panel.rotation_euler.x=.22

p=root('planter')
# Separate hollow rim and dirt; foliage is shared with the runtime vegetation.
box('Planter foot',(0,.045,0),(.99,.09,.61),iron,p,.018)
box('Cast planter',(0,.28,0),(1.14,.49,.74),stone,p,.04)
box('Inset soil',(0,.531,0),(.98,.025,.58),soil,p,.02)
for x in [-.54,.54]:box('Long raised rim',(x,.55,0),(.085,.075,.78),stone,p,.018)
for z in [-.35,.35]:box('Short raised rim',(0,.55,z),(1.04,.075,.085),stone,p,.018)

p=root('aboard')
for z in [-1,1]:
    board=box('Chalkboard panel',(0,.60,z*.16),(.53,.72,.035),black,p,.014);board.rotation_euler.x=-z*.22
    for x in [-.29,.29]:tube('A frame leg',[(x,.015,z*.30),(x,1.01,z*.075)],.022,wood,p)
    for y in [.24,.99]:box('Chalkboard cross rail',(0,y,z*(.30-y*.225)),(.62,.045,.045),wood,p)
box('Top hinge',(0,1.015,0),(.59,.035,.12),zinc,p)
text('OPEN',(0,.75,.151),.10,cream,p)
text('CAFE',(0,.56,.193),.085,cream,p)
for x in [-.28,.28]:tube('Hinge stay',[(x,.38,-.22),(x,.38,.22)],.008,iron,p)

p=root('table')
cyl('Cafe tabletop',(0,.74,0),.37,.045,wood,p,vertices=24)
cyl('Rolled table rim',(0,.73,0),.385,.04,iron,p,vertices=24)
cyl('Single pedestal',(0,.40,0),.038,.64,iron,p)
for i in range(3):
    a=i*math.tau/3;tube('Splayed table foot',[(0,.10,0),(.28*math.sin(a),.025,.28*math.cos(a))],.025,iron,p)

p=root('chair')
for x in [-.19,.19]:
    for z in [-.18,.18]:tube('Cafe chair leg',[(x*1.1,.02,z*1.1),(x,.45,z)],.016,iron,p)
    tube('Chair back rail',[(x,.45,-.18),(x,.83,-.21)],.017,iron,p)
for z in [-.15,-.05,.05,.15]:box('Chair seat slat',(0,.46,z),(.43,.035,.08),wood,p)
for y in [.65,.77]:box('Chair back slat',(0,y,-.20),(.43,.08,.025),wood,p)

p=root('crate')
for x in [-.29,.29]:
    for z in [-.22,.22]:box('Corner upright',(x,.17,z),(.045,.34,.045),wood,p,.003)
for y in [.07,.17,.27]:
    for z in [-.24,.24]:box('Crate long slat',(0,y,z),(.64,.075,.027),wood,p,.003)
    for x in [-.31,.31]:box('Crate end slat',(x,y,0),(.027,.075,.46),wood,p,.003)
box('Crate bottom',(0,.025,0),(.60,.04,.46),wood,p,.003)

p=root('hvac')
box('Roof equipment curb',(0,.08,0),(1.65,.16,1.08),iron,p,.018)
box('Galvanized HVAC case',(0,.46,0),(1.56,.64,1.0),zinc,p,.024)
box('Access panel seam',(.789,.47,0),(.012,.48,.72),black,p,.008)
box('Access panel',(.798,.47,0),(.012,.45,.69),zinc,p,.008)
for x in [-.40,.40]:
    cyl('Fan shroud',(x,.805,0),.285,.065,iron,p,vertices=20)
    cyl('Fan recess',(x,.843,0),.24,.012,black,p,vertices=20)
    for z in [-.16,-.08,0,.08,.16]:box('Fan safety grille',(x,.86,z),(.42,.012,.012),zinc,p,.003)
    cyl('Fan motor',(x,.864,0),.05,.03,zinc,p)
for x in [-.63,-.45,-.27,-.09,.09,.27,.45,.63]:box('Intake louvre',(x,.48,.512),(.11,.40,.025),iron,p,.005)

p=root('aircon')
box('Air conditioner',(0,.27,0),(.72,.50,.42),zinc,p,.015)
box('Aircon fan recess',(0,.27,.217),(.60,.37,.012),black,p,.012)
for x in [-.25,-.17,-.09,0,.09,.17,.25]:box('Aircon louvre',(x,.27,.23),(.023,.34,.016),zinc,p,.003)
for x in [-.24,.24]:tube('Wall mounting bracket',[(x,.05,-.19),(x,.05,.20),(x,.17,.20)],.015,iron,p)

p=root('picnic')
for x in [-.61,.61]:
    tube('A frame picnic leg',[(x,.02,-.62),(x,.72,-.18),(x,.72,.18),(x,.02,.62)],.043,iron,p,8)
    tube('Seat bearer',[(x,.40,-.73),(x,.40,.73)],.032,iron,p,8)
for z in [-.20,-.067,.067,.20]:box('Picnic top slat',(0,.76,z),(1.85,.055,.115),wood,p)
for side in [-1,1]:
    for z in [.55,.68]:box('Picnic seat slat',(0,.45,side*z),(1.85,.055,.11),wood,p)

def sphere(name,pos,size,mat,parent,segments=12,rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=V(pos))
    o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,mat,parent)
    for f in o.data.polygons:f.use_smooth=True
    return o

# Storefront merchandise is genuine shallow geometry, viewed through glazing.
p=root('bookshelf')
box('Bookcase back',(0,.97,-.18),(1.20,1.94,.055),wood,p)
for x in [-.61,.61]:box('Bookcase stile',(x,.97,0),(.055,1.94,.42),wood,p)
for y in [.08,.52,.96,1.40,1.91]:box('Bookcase shelf',(0,y,0),(1.23,.045,.44),wood,p)
for row,y in enumerate([.12,.56,1.0,1.44]):
    for j in range(11):
        x=-.52+j*.102;h=.26+((j*7+row*3)%9)*.013;w=.067+((j+row)%3)*.008
        box('Bound book',(x,y+h/2,.055),(w,h,.25),book_mats[(j+row*2)%5],p,0)
        box('Book spine label',(x,y+h*.25,.184),(w*.68,.025,.004),paper,p,0)

p=root('recordbin')
box('Record cabinet',(0,.42,0),(1.22,.78,.60),wood,p,.018)
for x in [-.63,.63]:box('Raised record bin side',(x,.88,0),(.05,.28,.64),wood,p)
for z in [-.30,.30]:box('Record bin lip',(0,.81,z),(1.22,.13,.045),wood,p)
for j in range(7):
    z=-.22+j*.07
    for x in [-.31,.31]:
        box('LP jacket',(x,.98,z),(.48,.46,.018),book_mats[(j+int(x>0)*2)%5],p,0)
        cyl('Record cover disc',(x,.99,z+.012),.145,.004,black,p,(0,0,1),16)
        cyl('Record centre label',(x,.99,z+.016),.042,.004,cream,p,(0,0,1),12)

p=root('bakerycase')
box('Bakery counter base',(0,.40,0),(1.35,.80,.59),wood,p,.025)
box('Stone counter',(0,.83,0),(1.42,.08,.68),cream,p,.015)
for y in [.89,1.19]:
    box('Pastry tray',(0,y,.02),(1.24,.018,.45),zinc,p,.005)
    for j in range(7):
        x=-.51+j*.17
        sphere('Baked loaf',(x,y+.07,.02),(.073,.053,.13),pastry,p)
        tube('Bread score',[(x-.022,y+.105,-.04),(x+.022,y+.12,.035)],.005,paper,p)
for x in [-.68,.68]:
    for z in [-.28,.28]:cyl('Display case upright',(x,1.15,z),.015,.57,zinc,p)
box('Case canopy',(0,1.46,0),(1.40,.035,.65),cream,p)
# An open-front case avoids extra sorted transparent surfaces inside the window.
box('Display case rear',(0,1.14,-.29),(1.32,.52,.022),black,p,.003)

p=root('grocerstand')
for x in [-.62,.62]:box('Market rack upright',(x,.68,-.19),(.06,1.36,.06),wood,p)
for level,y in enumerate([.38,.88]):
    box('Produce shelf',(0,y,0),(1.36,.06,.63),wood,p)
    for x in [-.43,0,.43]:
        box('Produce tray',(x,y+.08,0),(.40,.10,.56),wood,p,.005)
        for ix in [-1,0,1]:
            for iz in [-1,0,1]:
                sphere('Fresh produce',(x+ix*.105,y+.17,iz*.14),(.052,.055,.052),[red,leafgreen,ochre][(level+int((x+.5)*4))%3],p,8,4)
        box('Price card',(x,y+.17,.305),(.15,.10,.012),cream,p,.002)

p=root('floriststand')
for x in [-.57,.57]:tube('Flower stand upright',[(x,.03,.23),(x,1.20,-.16)],.023,iron,p)
for level,y in enumerate([.33,.79]):
    box('Flower stand shelf',(0,y,0),(1.25,.045,.53),wood,p)
    for x in [-.42,0,.42]:
        cyl('Flower bucket',(x,y+.15,0),.105,.28,zinc,p,r2=.14)
        for j in range(5):
            a=j*2.4;dx=.09*math.sin(a);dz=.09*math.cos(a);top=y+.52+(j%2)*.09
            tube('Flower stem',[(x,y+.19,0),(x+dx,top,dz)],.008,leafgreen,p)
            sphere('Flower head',(x+dx,top,dz),(.055,.045,.055),[cream,red,ochre][(level+j)%3],p,8,4)

p=root('coffeecounter')
box('Cafe counter',(0,.44,0),(1.38,.88,.64),wood,p,.025)
box('Countertop',(0,.91,0),(1.46,.07,.73),black,p,.016)
box('Espresso machine',(-.18,1.14,-.10),(.73,.40,.35),zinc,p,.04)
box('Coffee machine fascia',(-.18,1.16,.085),(.65,.22,.018),black,p,.008)
for x in [-.37,-.03]:
    cyl('Pressure dial',(x,1.20,.101),.045,.012,cream,p,(0,0,1),12)
    tube('Portafilter',[(x,1.07,.10),(x,1.07,.24)],.018,iron,p)
cyl('Coffee grinder',(.47,1.14,-.10),.10,.38,iron,p)
cyl('Bean hopper',(.47,1.42,-.10),.13,.18,screen,p,r2=.10)
for x in [-.52,-.20,.12]:
    cyl('Cup saucer',(x,.963,.23),.067,.012,cream,p,vertices=16)
    cyl('Coffee cup',(x,1.003,.23),.043,.075,cream,p,vertices=12,r2=.05)
    cyl('Coffee surface',(x,1.044,.23),.039,.003,black,p,vertices=12)

p=root('pendant')
cyl('Ceiling rose',(0,.67,0),.075,.035,iron,p)
cyl('Lamp flex',(0,.39,0),.010,.54,iron,p,vertices=6)
cyl('Pendant shade',(0,.12,0),.24,.19,iron,p,vertices=20,r2=.065)
cyl('Warm lamp diffuser',(0,.018,0),.205,.012,lamp,p,vertices=20)

p=root('bicycle')
for x in [-.58,.58]:
    for radius,minor,mat in [(.31,.025,black),(.282,.010,zinc)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=minor,major_segments=24,minor_segments=6,location=V((x,.335,0)))
        o=bpy.context.object;o.rotation_euler.x=math.pi/2;finish(o,'Bicycle wheel',mat,p)
        for f in o.data.polygons:f.use_smooth=True
    cyl('Wheel hub',(x,.335,0),.031,.11,zinc,p,(0,0,1))
    for j in range(10):
        a=j*math.tau/10;tube('Wheel spoke',[(x,.335,.025),(x+.277*math.cos(a),.335+.277*math.sin(a),.025)],.004,zinc,p)
for a,b in [((-.58,.335,0),(-.13,.80,0)),((-.13,.80,0),(.08,.335,0)),((.08,.335,0),(-.58,.335,0)),((-.13,.80,0),(.39,.79,0)),((.39,.79,0),(.08,.335,0)),((.39,.79,0),(.58,.335,0))]:tube('Bicycle frame',[a,b],.022,red,p)
tube('Saddle post',[(-.13,.80,0),(-.18,.94,0)],.019,zinc,p)
box('Bicycle saddle',(-.18,.95,0),(.25,.055,.14),black,p,.025)
tube('Handlebar stem',[(.39,.79,0),(.34,1.01,0),(.34,1.04,-.22),(.34,1.04,.22)],.017,zinc,p)
for z in [-.22,.22]:tube('Handlebar grip',[(.34,1.04,z),(.43,1.04,z)],.022,black,p)
cyl('Crank',(.08,.335,0),.10,.045,iron,p,(0,0,1),16)
tube('Pedal crank',[(.08,.335,-.07),(-.06,.27,-.07)],.012,zinc,p)
box('Pedal',(-.06,.27,-.13),(.08,.025,.14),black,p,.003)

p=root('hardware')
for x in [-.61,.61]:box('Shop rack side',(x,.86,0),(.045,1.72,.43),iron,p,.008)
for y in [.08,.59,1.10,1.66]:box('Shop rack shelf',(0,y,0),(1.24,.035,.46),zinc,p,.008)
for row,y in enumerate([.10,.61,1.12]):
    for j in range(6):
        x=-.49+j*.195;cyl('Paint tin',(x,y+.14,0),.078,.27,book_mats[(j+row)%5],p,vertices=12)
        cyl('Tin lid',(x,y+.281,0),.082,.016,zinc,p,vertices=12)
        box('Paint tin label',(x,y+.15,.076),(.10,.13,.008),paper,p,0)

# Original small curb fittings share the existing kit's PBR materials.
runpy.run_path(str(P/'source/street_detail_models.py'))['build'](globals())

# One mesh per prototype/material, no texture or runtime decoder dependencies.
report={}
for p in roots:
    groups={}
    for o in list(p.children):
        if o.type=='MESH':groups.setdefault(o.active_material,[]).append(o)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0];o.name=p.name+'__'+mat.name
        tri=o.modifiers.new('Game triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    report[p.name]={'triangles':sum(len(o.data.polygons) for o in p.children),'materials':len(p.children)}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'street-props.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_yup=True,export_tangents=False)
runpy.run_path(str(P/'source/optimize_glb.py'))['optimize'](OUT/'street-props.glb',{})
shutil.copy2(OUT/'street-props.glb',P.parent/'dist/street-props.glb')
report['glb_bytes']=(OUT/'street-props.glb').stat().st_size
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
asset_objects=list(bpy.data.objects)
for i,p in enumerate(roots):p.location=V(((i%6-2.5)*2.9,0,(i//6-2)*2.8))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.55,.62,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
box('Review floor',(0,-.065,0),(60,.1,60),material('Studio',(.10,.12,.12)),None,0)
for name,pos,power,size in [('Key',(0,10,4),1900,8),('Fill',(-7,5,0),1200,6)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=V(pos);o.rotation_euler=(V((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Street furniture review');o=bpy.data.objects.new('Street furniture review',data);scene.collection.objects.link(o);scene.camera=o
o.location=V((11,15,19));o.rotation_euler=(V((0,.4,0))-o.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=20
scene.render.resolution_x=1600;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'kit.png')
for label,objects in [('Game assets',asset_objects),('Review studio',[o for o in bpy.data.objects if o not in asset_objects])]:
    collection=bpy.data.collections.new(label);scene.collection.children.link(collection)
    for o in objects:
        for previous in list(o.users_collection):previous.objects.unlink(o)
        collection.objects.link(o)
bpy.ops.wm.save_as_mainfile(filepath=str(P.parent.parent/'street-furniture-game-ready.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('STREET_PROPS_COMPLETE',json.dumps(report),flush=True)
