"""Five complete, reusable Dundas buildings with ray-baked vertex contacts.
Blender 4.5 --background --factory-startup --python this_file -- --skip-render
Game coordinates: metres, +Y up, facade at Z=0 facing +Z.
"""
from pathlib import Path
import math,json,runpy,shutil,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

# Reuse the architecture modelling helpers, without running its export stage.
prefix=(Path(__file__).with_name('build_architecture.py')).read_text(encoding='utf8').split('# One-metre module:')[0]
exec(compile(prefix,'building_helpers','exec'),globals())
OUT=P/'dundas-buildings';OUT.mkdir(exist_ok=True)
roots=[]
def root(name):
    o=bpy.data.objects.new('Building_'+name,None);bpy.context.collection.objects.link(o);roots.append(o)
    o['people_free']=True;return o

bricks=[material('BuildingBrick'+str(i),col,.94) for i,col in enumerate([(.40,.20,.14),(.49,.30,.20),(.56,.45,.31)])]
stucco=material('BuildingPlaster',(.64,.66,.53),.93)
office=material('OfficeGlass',(.25,.38,.43),.25,.18)
inside=material('BlockInterior',(.54,.48,.36),.93)
shopglass=material('ShopGlass',(.55,.65,.65),.18,.08)
shopglass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.18
shopglass.surface_render_method='DITHERED'
layouts={}

def building(name,width,height,depth,kind,wallmat,variant):
    p=root(name);windows=[]
    roomW=5.2 if kind=='modern' else 5.4 if kind=='loft' else 4.9
    roomU=-width*(.25 if kind=='modern' else .10 if kind=='loft' else .12)
    doorU=width*(.24 if kind=='modern' else .36 if kind=='loft' else .34)
    layout={'width':width,'height':height,'depth':depth,'kind':kind,'windows':windows,'room':{'u':roomU,'width':roomW,'depth':2.3},'doorU':doorU}
    layouts[name]=layout;p['layout']=json.dumps(layout)

    def panel_wall(span,top,holes,point,mat=wallmat):
        # Cut real portals, then add returns and one inset pane per opening.
        levels=sorted(set([0,top]+[v for h in holes for v in (h[1]-h[3]/2,h[1]+h[3]/2)]))
        rects=[];last={}
        for lo,hi in zip(levels,levels[1:]):
            edge=-span/2;middle=(lo+hi)/2
            blocked=sorted((max(-span/2,u-w/2),min(span/2,u+w/2)) for u,y,w,h,g in holes if y-h/2<middle<y+h/2)
            for a,b in blocked+[(span/2,span/2)]:
                if a>edge:
                    key=(edge,a);old=last.get(key)
                    if old is not None and abs(rects[old][3]-lo)<1e-5:rects[old][3]=hi
                    else:last[key]=len(rects);rects.append([edge,a,lo,hi])
                edge=max(edge,b)
        for l,r,b,t in rects:
            cuts=sorted(set([b,t]+[v for v in [.32,top-.42] if b+.02<v<t-.02]))
            for lo,hi in zip(cuts,cuts[1:]):mesh('Masonry with real openings',[point(l,lo,0),point(r,lo,0),point(r,hi,0),point(l,hi,0)],[(0,1,2,3)],mat,p)
        for u,y,w,h,g in holes:
            outer=[(u-w/2,y-h/2),(u+w/2,y-h/2),(u+w/2,y+h/2),(u-w/2,y+h/2)]
            inner=[(u+(a-u)*.94,y+(b-y)*.96) for a,b in outer]
            for i in range(4):
                j=(i+1)%4
                mesh('Recessed limestone reveal',[point(*outer[i],0),point(*outer[j],0),point(*inner[j],.24),point(*inner[i],.24)],[(0,1,2,3)],stone,p)
            # A 3x3 pane gives the contact bake interior vertices, so the glass
            # centre stays open while the frame corners receive subtle shading.
            for row in range(3):
                for col in range(3):
                    l=u+(col/3-.5)*w*.94;r=u+((col+1)/3-.5)*w*.94
                    b=y+(row/3-.5)*h*.96;t=y+((row+1)/3-.5)*h*.96
                    paneObject=mesh('Inset glazing',[point(l,b,.235),point(r,b,.235),point(r,t,.235),point(l,t,.235)],[(0,1,2,3)],g,p)
                    paneUV=paneObject.data.uv_layers.new(name='UVMap')
                    for loop,coord in zip(paneObject.data.polygons[0].loop_indices,[(col/3,row/3),((col+1)/3,row/3),((col+1)/3,(row+1)/3),(col/3,(row+1)/3)]):paneUV.data[loop].uv=coord
            if g==glass:
                for a,b,ww,hh in [(u,y,.045,h*.95),(u,y,w*.94,.045)]:
                    mesh('Fine sash',[point(a-ww/2,b-hh/2,.215),point(a+ww/2,b-hh/2,.215),point(a+ww/2,b+hh/2,.215),point(a-ww/2,b+hh/2,.215)],[(0,1,2,3)],paint,p)
                normal=Vector(point(0,0,0))-Vector(point(0,0,.1));normal.normalize()
                windows.append({'point':list(point(u,y,0)),'normal':list(normal),'width':w,'height':h})

    front=[]
    if kind=='modern':
        for y in [5.07,8.37]:
            for u in [-11.5,-5.75,0,5.75,11.5]:front.append((u,y,4.7,2.55,glass))
    else:
        ys=[5.37,8.07] if variant=='victorian' else [5.37] if variant=='cafe' else [5.22,8.32,11.42] if variant=='factory' else [5.37,8.07,10.77,13.47]
        cols=4 if variant=='factory' else 3
        pitch=(width-1.5)/cols
        for y in ys:
            for j in range(cols):front.append(((j-(cols-1)/2)*pitch,y,2.35 if variant=='factory' else 1.55,2.15 if variant=='factory' else 1.95,glass))
    front += [(roomU,1.54,roomW,2.45,shopglass),(doorU,1.48,2.25 if kind=='modern' else 1.08,2.60,glass)]
    if kind=='modern':front += [(-12,1.54,3,2.45,glass),(0,1.54,4.2,2.45,glass),(11.7,1.54,4,2.45,glass)]
    podium=9.77 if kind=='modern' else height
    # The cafe's clipped corner gives a genuinely different footprint.
    clip=1.1 if variant=='cafe' else 0
    frontSpan=width-clip
    panel_wall(frontSpan,podium,[(u-clip/2,y,w,h,g) for u,y,w,h,g in front],lambda u,y,d:(u+clip/2,y,-d))
    for side in [-1,1]:
        sideDepth=depth-(clip if side==-1 else 0);start=clip if side==-1 else 0
        holes=[]
        for y in ([5.07,8.37] if kind=='modern' else ys):
            for u in [-sideDepth*.25,sideDepth*.25]:holes.append((u,y,1.65,1.95,glass))
        panel_wall(sideDepth,podium,holes,lambda u,y,d,s=side,sd=sideDepth,st=start:(s*(width/2-d),y,-st-sd/2-s*u))
    if clip:
        # Angled corner wall/glazing, with its own inset opening and upright trim.
        span=clip*math.sqrt(2)
        panel_wall(span,height,[(0,1.60,.96,2.30,shopglass),(0,5.37,.90,1.95,glass)],lambda u,y,d:(-width/2+clip/2+u/math.sqrt(2)+d/math.sqrt(2),y,-clip/2+u/math.sqrt(2)-d/math.sqrt(2)))
    mesh('Closed rear',[(-width/2,0,-depth),(-width/2,podium,-depth),(width/2,podium,-depth),(width/2,0,-depth)],[(0,1,2,3)],wallmat,p)
    # Recessed entrance, threshold, real handle, glazed transom and panelled door.
    box('Recessed entrance door',(doorU,1.48,-.28),(2.18 if kind=='modern' else 1.01,2.52,.06),paint,p,0)
    box('Door upper glass',(doorU,1.75,-.24),(1.82 if kind=='modern' else .78,1.64,.02),glass,p,0)
    box('Entrance handle',(doorU+.34,1.35,-.17),(.035,.34,.09),iron,p,0)
    box('Entrance threshold',(doorU,.12,.11),(2.5 if kind=='modern' else 1.34,.18,.54),stone,p,0)
    # An authored 2.3 m display recess; runtime merchandise uses its metadata.
    box('Display floor',(roomU,.16,-1.15),(roomW,.08,2.3),inside,p,0)
    box('Display ceiling',(roomU,2.94,-1.15),(roomW,.08,2.3),inside,p,0)
    box('Display back wall',(roomU,1.54,-2.34),(roomW,2.74,.08),inside,p,0)
    for edgeX in [-1,1]:box('Display return',(roomU+edgeX*(roomW/2+.02),1.54,-1.2),(.08,2.74,2.3),inside,p,0)
    box('Shop fascia',(0,3.32,.09),(width-.30,.70,.18),paint,p,0)
    for y in [2.94,3.70]:box('Fascia moulding',(0,y,.12),(width-.20,.10,.26),edge,p,0)
    box('Stall riser',(roomU,.27,.05),(roomW+.1,.18,.14),paint,p,0)

    if kind=='modern':
        box('Closed podium roof',(0,9.80,-depth/2),(width,.12,depth),slate,p,0)
        tw=width*.68;td=depth-5
        box('Setback office tower',(0,(height+9.9)/2,-depth/2),(tw,height-9.9,td),office,p,0)
        box('Tower roof',(0,height+.10,-depth/2),(tw+.2,.20,td+.2),slate,p,0)
        box('Smaller glazed crown',(0,height+1.9,-depth/2),(tw-4,3.6,td-3),office,p,0)
        box('Crown coping',(0,height+3.8,-depth/2),(tw-3.8,.20,td-2.8),slate,p,0)
        for y in [3.72,6.52,9.82]:box('Podium floor course',(0,y,.15),(width,.18,.34),edge,p,0)
        for u in [-width/2+.15,-8.625,-2.875,2.875,8.625,width/2-.15]:box('Stone podium pier',(u,4.88,.10),(.24,9.77,.20),stone,p,0)
    else:
        box('Closed flat roof',(0,height-.02,-depth/2),(width,.16,depth),slate,p,0)
        profile('Shaped crown',[(-.38,.02),(-.38,.18),(-.22,.18),(-.16,.33),(-.06,.42),(.10,.42),(.10,-.06)],width,stone,p).location=V((0,height,0))
        for j in range(math.ceil(width/.45)):
            u=-width/2+(j+.5)*width/math.ceil(width/.45)
            box('Cornice dentil',(u,height-.28,.18),(.13,.12,.20),edge,p,0)
        for u,y,w,h,g in front:
            if y<4:continue
            box('Individual deep sill',(u,y-h/2-.10,.10),(w+.22,.12,.34),edge,p,0)
            box('Window drip head',(u,y+h/2+.14,.10),(w+.28,.13,.26),stone,p,0)
        for edgeX in [-1,1]:
            for y in [4.2+j*.88 for j in range(int((height-4.5)/.88))]:box('Alternating corner quoin',(edgeX*(width/2-.19)+(clip if edgeX==-1 else 0),y,.08),(.36 if int(y/.88)%2 else .25,.38,.16),stone,p,0)
        if variant=='victorian':
            # Gabled centre above a three-storey shop and paired relief panels.
            mesh('Stone pediment',[(-1.35,height+.1,0),(1.35,height+.1,0),(0,height+1.35,0),(-1.35,height+.1,.2),(1.35,height+.1,.2),(0,height+1.35,.2)],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],stone,p)
            for u in [-(width-1.5)/3,0,(width-1.5)/3]:box('Terracotta spandrel',(u,6.70,.055),(1.6,.45,.11),terra,p,0)
        elif variant=='cafe':
            # Broad canvas canopy and solid return wall change the street silhouette.
            box('Cafe canopy',(roomU,2.89,.59),(roomW+.25,.13,1.2),paint,p,0)
            box('Cafe valance',(roomU,2.76,1.16),(roomW+.25,.18,.08),paint,p,0)
            for x in [roomU-roomW*.4,roomU+roomW*.4]:box('Canopy bracket',(x,2.75,.28),(.05,.40,.06),iron,p,0)
        elif variant=='factory':
            for u in [-7.45,-3.475,0,3.475,7.45]:box('Raised factory pier',(u,8.35,.08),(.24,10.3,.16),bricks[2],p,0)
            for y in [3.91,7.02,10.12,13.22]:box('Industrial stone belt',(0,y,.10),(width-.20,.12,.25),stone,p,0)
            for u in [-4,4]:
                mesh('Sawtooth roof',[(u-2,height,-1.3),(u+2,height,-1.3),(u+2,height+1.4,-10.8),(u-2,height+1.4,-10.8)],[(0,1,2,3)],slate,p)
                mesh('Factory northlight glass',[(u-2,height,-10.8),(u-2,height+1.4,-10.8),(u+2,height+1.4,-10.8),(u+2,height,-10.8)],[(0,1,2,3)],office,p)
                for edgeX in [-2,2]:mesh('Closed sawtooth cheek',[(u+edgeX,height,-1.3),(u+edgeX,height,-10.8),(u+edgeX,height+1.4,-10.8)],[(0,1,2)] if edgeX<0 else [(2,1,0)],slate,p)
        elif variant=='apartment':
            for y in [5.37,8.07,10.77]:
                box('Balcony slab',(0,y-1.02,.48),(2.8,.12,1.05),stone,p,0)
                for u in [-1.30,-.65,0,.65,1.30]:box('Balcony uprights',(u,y-.48,.94),(.035,.96,.035),iron,p,0)
                box('Balcony handrail',(0,y+.02,.94),(2.72,.045,.045),iron,p,0)
    layout['height']=height+(3.9 if kind=='modern' else 1.35 if variant=='victorian' else 1.4 if variant=='factory' else .15)
    p['layout']=json.dumps(layout)
    return p

building('victorian',30.8/3,10.1,10.8,'shop',bricks[0],'victorian')
building('cornercafe',30.8/3,8.1,12.9,'shop',stucco,'cafe')
building('factory',15.4,14.6,13,'loft',bricks[1],'factory')
building('apartment',30.8/3,16.1,13.4,'shop',bricks[2],'apartment')
building('office',30.8,35.8,17,'modern',stone,'office')

report={}
for p in roots:
    # Bake ambient visibility from the complete building using 20 fixed rays
    # per vertex. Glass does not block ambient light. No runtime ray casting.
    bpy.context.view_layer.update();verts=[];faces=[]
    for o in p.children:
        if o.active_material in [glass,shopglass,office]:continue
        offset=len(verts);verts += [o.matrix_world@v.co for v in o.data.vertices]
        faces += [tuple(offset+i for i in f.vertices) for f in o.data.polygons]
    bvh=BVHTree.FromPolygons(verts,faces)
    for o in p.children:
        g=o.data;g.update();attr=g.color_attributes.new(name='ContactShade',type='FLOAT_COLOR',domain='CORNER');g.color_attributes.active_color=attr
        # Supply deterministic planar UVs, with each glazed quad spanning 0..1.
        hadUV=bool(g.uv_layers.active);uv=g.uv_layers.active or g.uv_layers.new(name='UVMap')
        for poly in g.polygons:
            coords=[g.vertices[g.loops[i].vertex_index].co for i in poly.loop_indices]
            normal=poly.normal;axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
            bounds=[(min(v[a] for v in coords),max(v[a] for v in coords)) for a in axes]
            for loop in poly.loop_indices:
                v=g.vertices[g.loops[loop].vertex_index];point=o.matrix_world@v.co;n=(o.matrix_world.to_3x3()@poly.normal).normalized()
                tangent=n.cross(Vector((0,0,1)) if abs(n.z)<.8 else Vector((0,1,0))).normalized();bitangent=n.cross(tangent)
                blocked=0
                for j in range(20):
                    z=(j+.5)/20;r=math.sqrt(1-z*z);a=j*2.39996323
                    ray=(tangent*(r*math.cos(a))+bitangent*(r*math.sin(a))+n*z).normalized()
                    hit=bvh.ray_cast(point+n*.012,ray,.70)
                    if hit[0] is not None:blocked+=1-hit[3]/.9
                occlusion=min(.95,blocked/20);shade=1-.35*occlusion;attr.data[loop].color=(shade,shade,shade,1)
                if not hadUV:uv.data[loop].uv=tuple((v.co[a]-lo)/max(.001,hi-lo) for a,(lo,hi) in zip(axes,bounds))
    groups={}
    for o in list(p.children):groups.setdefault(o.active_material,[]).append(o)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0];o.name=p.name+'__'+mat.name
        tri=o.modifiers.new('Game triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    report[p.name]={'triangles':sum(len(o.data.polygons) for o in p.children),'parts':len(p.children)}

# Vertex colour x base colour is supported by the glTF material exporter.
baseColours={}
for m in bpy.data.materials:
    if not m.use_nodes:continue
    shader=m.node_tree.nodes.get('Principled BSDF')
    if not shader:continue
    base=shader.inputs['Base Color'].default_value[:]
    baseColours[m.name]=base
    vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='ContactShade'
    mul=m.node_tree.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=base
    m.node_tree.links.new(vc.outputs['Color'],mul.inputs[2]);m.node_tree.links.new(mul.outputs[0],shader.inputs['Base Color'])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'dundas-buildings.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True,export_yup=True,export_tangents=False,export_vertex_color='ACTIVE')
runpy.run_path(str(P/'source/optimize_glb.py'))['optimize'](OUT/'dundas-buildings.glb',baseColours,keep_uv_materials=['Architecture_WindowGlass','Architecture_ShopGlass'])
shutil.copy2(OUT/'dundas-buildings.glb',P.parent/'dist/dundas-buildings.glb')
report['glb_bytes']=(OUT/'dundas-buildings.glb').stat().st_size
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
for i,p in enumerate(roots):p.location=V(((i-2)*38,0,0))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
box('Review floor',(0,-.12,-8),(220,.20,60),material('ReviewFloor',(.21,.24,.23)),None,0)
light=bpy.data.lights.new('Soft daylight','AREA');light.energy=9000;light.size=75
o=bpy.data.objects.new('Soft daylight',light);scene.collection.objects.link(o);o.location=V((0,40,14));o.rotation_euler=(V((0,5,-5))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Building review');o=bpy.data.objects.new('Building review',cam);scene.collection.objects.link(o);scene.camera=o;o.location=V((60,70,120));o.rotation_euler=(V((0,9,-5))-o.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=205
scene.render.resolution_x=2000;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'kit.png')
bpy.ops.wm.save_as_mainfile(filepath=str(P.parent.parent/'dundas-buildings-game-ready.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('DUNDAS_BUILDINGS_COMPLETE',json.dumps(report),flush=True)
