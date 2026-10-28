"""Build the photo-refined CLRV game asset. Run with Blender 4.5+ in background mode.
Logical coordinates: +X door side, +Y up, +Z front (metres in exported glTF).
All photographic references are used as modelling references, not textures.
"""
import bpy, bmesh, math, json, os, sys, tempfile
from mathutils import Vector
from pathlib import Path
P=Path(__file__).resolve().parent.parent
temporary_root=P.parent/'.streetcar-build-temp';temporary_root.mkdir(exist_ok=True)
tempfile.tempdir=str(temporary_root)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=30
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
for data in bpy.data.materials: bpy.data.materials.remove(data)
def V(v): return Vector((v[0],-v[2],v[1]))
def material(name,color,metal=0,rough=.45,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=color
    s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough
    if emission:s.inputs['Emission Color'].default_value=color;s.inputs['Emission Strength'].default_value=emission
    if color[3]<1:
        s.inputs['Alpha'].default_value=color[3];m.surface_render_method='DITHERED';m.use_transparency_overlap=False
    return m
red=material('TTC_Vermilion',(.55,.012,.019,1),0,.31)
cream=material('Warm_Ivory',(.83,.80,.70,1),0,.34)
charcoal=material('Window_Rubber',(.009,.012,.013,1),0,.58)
silver=material('Brushed_Skirt',(.55,.59,.61,1),.88,.42)
chrome=material('Polished_Trim',(.62,.66,.68,1),.95,.26)
bumper_metal=material('Bumper_Satin_Chrome',(.54,.58,.60,1),.9,.42)
wheel_metal=material('Wheel_Steel',(.24,.27,.28,1),.85,.46)
vent_dark=material('Vent_Recess',(.022,.028,.029,1),.25,.68)
dark=material('Undercarriage',(.06,.075,.071,1),.45,.52)
glass=material('Tinted_Glass',(.065,.095,.100,.32),0,.095)
seat=material('Burgundy_Seats',(.285,.018,.024,1),0,.55)
seat_edge=material('Seat_Edging',(.10,.016,.019,1),0,.6)
ceiling_mat=material('Interior_Ceiling',(.73,.71,.65,1),0,.68)
laminate=material('Interior_Laminate',(.14,.10,.065,1),0,.67)
floor=material('Interior_Floor',(.095,.105,.10,1),.02,.91)
yellow=material('Safety_Yellow',(.95,.55,.055,1),.3,.38)
def finish_maps(mat,roughness_file,normal_file,normal_strength,coat=0):
    tree=mat.node_tree;shader=tree.nodes.get('Principled BSDF')
    for filename,input_name in ((roughness_file,'Roughness'),(normal_file,'Normal')):
        tex=tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(P/'source'/filename),check_existing=True)
        tex.image.colorspace_settings.name='Non-Color';tex.image.pack();tex.extension='REPEAT'
        if input_name=='Normal':
            node=tree.nodes.new('ShaderNodeNormalMap');node.inputs['Strength'].default_value=normal_strength
            tree.links.new(tex.outputs['Color'],node.inputs['Color']);tree.links.new(node.outputs['Normal'],shader.inputs['Normal'])
        else:tree.links.new(tex.outputs['Color'],shader.inputs[input_name])
    shader.inputs['Coat Weight'].default_value=coat;shader.inputs['Coat Roughness'].default_value=.16 if coat else 0
    shader.inputs['IOR'].default_value=1.48
for paint in (red,cream):finish_maps(paint,'paint-roughness.png','paint-normal.png',.065,.55)
finish_maps(silver,'steel-roughness.png','steel-normal.png',.09)
finish_maps(floor,'floor-roughness.png','floor-normal.png',.32)
finish_maps(seat,'vinyl-roughness.png','vinyl-normal.png',.12)
finish_maps(laminate,'wood-roughness.png','wood-normal.png',.12)
# Albedo is baked into these two compact textures, including broad, subtle wear.
for surface,filename in ((seat,'vinyl-albedo.png'),(laminate,'wood-albedo.png'),(floor,'floor-albedo.png')):
    tree=surface.node_tree;shader=tree.nodes.get('Principled BSDF')
    texture=tree.nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(P/'source'/filename));texture.image.pack()
    tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
    surface.diffuse_color=(1,1,1,1)
white=material('Headlamps',(.72,.70,.62,1),.35,.16,.8)
tail=material('Tail_Lamps',(.65,.015,.01,1),.05,.22,1.3)
green=material('Green_Markers',(.08,.59,.31,1),.1,.24,.9)
amber=material('Amber_Indicators',(.95,.29,.018,1),.1,.26,1)
warm=material('Interior_Lamps',(.90,.76,.45,1),.1,.3,.6)
# Shared moulded-lens pattern: compact texture supplies reflector facets and fluting.
for lens in (white,):
    tree=lens.node_tree;shader=tree.nodes.get('Principled BSDF')
    tex=tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(P/'source/lamp-optics.png'),check_existing=True);tex.image.pack()
    tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    # The texture remains visible with emission disabled, and modulates the lit reflector.
    tree.links.new(tex.outputs['Color'],shader.inputs['Emission Color'])
    shader.inputs['Coat Weight'].default_value=.25;shader.inputs['Coat Roughness'].default_value=.10
atlas=material('Markings_Atlas',(1,1,1,1),0,.65)
n=atlas.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(P/'source/markings-refined.png'));n.image.pack()
atlas.node_tree.links.new(n.outputs['Color'],atlas.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
atlas.node_tree.links.new(n.outputs['Alpha'],atlas.node_tree.nodes.get('Principled BSDF').inputs['Alpha']);atlas.surface_render_method='DITHERED'
def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=V(loc);o.parent=parent;return o
root=empty('Streetcar_Root'); root['asset']='TTC CLRV 4039 photo-refined game asset';root['revision']='photo-refined-v2';root['headlamp_layout']='single central lamp with corner markers';root['units']='metres';root['front_axis']='+Z';root['door_side']='+X';root['wheel_radius_m']=.335
static=empty('Body_Static',parent=root)
def finish(o,name,mat,parent=static,bevel=0):
    o.name=name;o.data.materials.append(mat);o.parent=parent
    if bevel:
        m=o.modifiers.new('Manufactured edge radii','BEVEL');m.width=bevel
        m.segments=3 if bevel>=.06 and mat not in (seat,dark) else 2
        m.harden_normals=True
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
        weighted_shading(o)
    return o
def weighted_shading(o):
    for face in o.data.polygons:face.use_smooth=True
    m=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');m.mode='FACE_AREA_WITH_ANGLE';m.weight=50;m.keep_sharp=True
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
def box(name,loc,scale,mat,parent=static,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=V(loc));o=bpy.context.object;o.dimensions=V((scale[0],scale[1],-scale[2]))
    o.dimensions=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,bevel)
def cyl(name,loc,r,depth,mat,axis='Y',parent=static,vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=V(loc));o=bpy.context.object
    if axis=='X':o.rotation_euler[1]=math.pi/2
    if axis=='Z':o.rotation_euler[0]=math.pi/2
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return finish(o,name,mat,parent,min(.004,depth*.10) if r>.075 and depth>.025 else 0)
def rod(name,a,b,r,mat,parent=static):
    a,b=V(a),V(b);vec=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=8 if r>=.01 else 6,radius=r,depth=vec.length,location=(a+b)/2);o=bpy.context.object
    for face in o.data.polygons:face.use_smooth=len(face.vertices)==4
    o.rotation_euler=vec.to_track_quat('Z','Y').to_euler();return finish(o,name,mat,parent)

def ring(name,loc,radius,thickness,mat,axis='X',parent=static):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,
        major_radius=radius,minor_radius=thickness,location=V(loc))
    obj=bpy.context.object
    if axis=='X':obj.rotation_euler.y=math.pi/2
    elif axis=='Z':obj.rotation_euler.x=math.pi/2
    for f in obj.data.polygons:f.use_smooth=True
    return finish(obj,name,mat,parent)

def railway_wheel(side,parent):
    # A lathed wheel has a flange, running tread, dished web, and projecting hub.
    # This keeps the .335 m rolling radius used by the game's wheel controller.
    profile=[(.635,.36),(.666,.36),(.674,.335),(.770,.335),(.796,.318),
             (.803,.265),(.787,.239),(.790,.169),(.825,.145),(.850,.137),(.854,.05)]
    vertices=[];faces=[];n=32
    for x,r in profile:
        for k in range(n):
            angle=k*math.tau/n;vertices.append(V((side*x,r*math.cos(angle),r*math.sin(angle))))
    for i in range(len(profile)-1):
        for k in range(n):faces.append((i*n+k,i*n+(k+1)%n,(i+1)*n+(k+1)%n,(i+1)*n+k))
    faces += [tuple(range(n-1,-1,-1)),tuple(range((len(profile)-1)*n,len(profile)*n))]
    mesh=bpy.data.meshes.new('Dished_wheel');mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('Dished_railway_wheel',mesh);bpy.context.collection.objects.link(obj)
    finish(obj,obj.name,wheel_metal,parent);mesh.materials.append(silver)
    for f in mesh.polygons:
        f.use_smooth=len(f.vertices)==4
        if f.index//n==2:f.material_index=1
    ring('Machined_wheel_rim',(side*.804,0,0),.292,.006,silver,parent=parent)
    ring('Hub_retaining_ring',(side*.855,0,0),.135,.008,silver,parent=parent)
    cyl('Axle_end_cap',(side*.86,0,0),.065,.016,wheel_metal,'X',parent,24)
    return obj
def panel(name,verts,mat,parent=static,uv=None):
    me=bpy.data.meshes.new(name);me.from_pydata([V(v) for v in verts],[],[list(range(len(verts)))]);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,mat,parent)
    if uv:
        layer=me.uv_layers.new()
        for p in me.polygons:
            for i,li in enumerate(p.loop_indices):layer.data[li].uv=uv[i]
    return o

def rounded_loop(width,height,radius,steps=5):
    points=[];r=min(radius,width/2-.0001,height/2-.0001)
    for cx,cy,angle in ((width/2-r,height/2-r,0),(-width/2+r,height/2-r,90),(-width/2+r,-height/2+r,180),(width/2-r,-height/2+r,270)):
        for j in range(steps+1):
            a=math.radians(angle+j*90/steps)
            points.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return points

def glazed_aperture(name,x,y,z,width,height,radius,parent=static,outer=None,back_depth=None):
    # The opaque surround and its rounded aperture share an exact boundary.
    # Points are in the Y/Z side plane, so all door parts follow their pivots.
    inner=rounded_loop(width,height,radius)
    if outer:
        ow,oh,orr,metal=outer;outside=rounded_loop(ow,oh,orr)
        vertices=[(x,y+v,z+u) for loop in (outside,inner) for u,v in loop];n=len(inner)
        faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh=bpy.data.meshes.new(name+'_surround');mesh.from_pydata([V(v) for v in vertices],[],faces);mesh.update()
        obj=bpy.data.objects.new(name+'_surround',mesh);bpy.context.collection.objects.link(obj);finish(obj,obj.name,metal,parent)
        # A thin returned edge is enough at game distance; no subdivision.
        mod=obj.modifiers.new('Aperture return','SOLIDIFY');mod.thickness=back_depth if back_depth is not None else .022
        if back_depth is not None:
            # A door surround returns to the cabin face of the same metal leaf,
            # rather than floating in front of a separate silver back surface.
            mod.offset=1 if mesh.polygons[0].normal.x<0 else -1
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        if back_depth is not None:
            bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return panel(name+'_glass',[(x+.003,y+v,z+u) for u,v in inner],glass,parent)

def paint_door_cabin_faces(obj):
    """Assign real inward-facing metal polygons to the existing red batch.

    Splitting the faces before material batching preserves the exterior silver,
    custom normals and leaf pivots without overlay planes or extra draw calls.
    """
    source=obj.data;normal_matrix=obj.matrix_basis.to_3x3().inverted().transposed()
    inside=[p for p in source.polygons if (normal_matrix@p.normal).normalized().x<-.5]
    if not inside:return
    ids={p.index for p in inside};outside=[p for p in source.polygons if p.index not in ids]
    normals=[n.vector.copy() for n in source.corner_normals]
    def subset(polygons,name):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([v.co[:] for v in source.vertices],[],[p.vertices[:] for p in polygons]);mesh.update()
        for face,old in zip(mesh.polygons,polygons):face.use_smooth=old.use_smooth
        mesh.normals_split_custom_set([normals[i] for p in polygons for i in p.loop_indices]);return mesh
    inner_mesh=subset(inside,obj.name+'_cabin');inner_mesh.materials.append(red)
    painted=bpy.data.objects.new(obj.name+'_Cabin_Enamel',inner_mesh);bpy.context.collection.objects.link(painted)
    painted.parent=obj.parent;painted.matrix_parent_inverse=obj.matrix_parent_inverse.copy();painted.matrix_basis=obj.matrix_basis.copy()
    if outside:
        obj.data=subset(outside,obj.name+'_exterior');obj.data.materials.append(silver)
    else:bpy.data.objects.remove(obj,do_unlink=True)
    if source.users==0:bpy.data.meshes.remove(source)

def rounded_bead(name,x,y,z,width,height,radius,thickness,mat,parent=static):
    outer=rounded_loop(width,height,radius,4);inner=rounded_loop(width-2*thickness,height-2*thickness,max(.005,radius-thickness),4);n=len(outer)
    verts=[V((x,y+v,z+u)) for loop in (outer,inner) for u,v in loop]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);return finish(obj,name,mat,parent)
def decal(name,center,w,h,rect,side=1,parent=static,front=False):
    x,y,z=center
    if front:verts=[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)]
    else:verts=[(x,y-h/2,z+side*w/2),(x,y-h/2,z-side*w/2),(x,y+h/2,z-side*w/2),(x,y+h/2,z+side*w/2)]
    u0,v0,u1,v1=rect;uv=[(u0/2048,1-v1/1024),(u1/2048,1-v1/1024),(u1/2048,1-v0/1024),(u0/2048,1-v0/1024)]
    return panel(name,verts,atlas,parent,uv)
def domed_lens(name,center,radius,end,mat):
    x,y,z=center;segments=24;rings=3
    verts=[(x,y,z+end*.018)];uvs=[(.5,.5)]
    for j in range(1,rings+1):
        r=radius*j/rings
        for k in range(segments):
            a=k*math.tau/segments
            verts.append((x+r*math.cos(a),y+r*math.sin(a),z+end*.018*(1-(r/radius)**2)))
            uvs.append((.5+.5*r/radius*math.cos(a),.5+.5*r/radius*math.sin(a)))
    faces=[]
    for k in range(segments):faces.append((0,1+k,1+(k+1)%segments))
    for j in range(rings-1):
        for k in range(segments):
            a=1+j*segments+k;b=1+j*segments+(k+1)%segments;faces.append((a,a+segments,b+segments,b))
    me=bpy.data.meshes.new(name);me.from_pydata([V(v) for v in verts],[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,mat)
    layer=me.uv_layers.new(name='OpticsUV')
    for face in me.polygons:
        face.use_smooth=True
        for li in face.loop_indices:layer.data[li].uv=uvs[me.loops[li].vertex_index]
    return o

# Shared analytical cab surfaces and fittings.
import runpy
cab_module=runpy.run_path(str(P/'source/rounded_cab.py'),init_globals=globals())
for helper in cab_module['PUBLIC']:globals()[helper]=cab_module[helper]
root['cab_revision']='rounded-v3'
root['cab_plan_power']=2.6
refinements=runpy.run_path(str(P/'source/rear_roof_interior.py'),init_globals=globals())
for helper in refinements['PUBLIC_REFINEMENTS']:globals()[helper]=refinements[helper]

# Both end caps share the continuously bowed CLRV plan.
front_outline=[cab_plan(math.pi/2-i*math.pi/64) for i in range(65)]
outline=[(-x,-z) for x,z in front_outline]+front_outline

def band(name,y0,y1,mat,solid=False,end_inset=.007,outset=0):
    count=len(outline)
    outer=[(x*(1+outset/1.27),z*(1+outset/7.65)) for x,z in outline]
    inner=[(x*.955,z*(1-end_inset)) for x,z in outer]
    vs=[(x,y,z) for ring in ([outer] if solid else [outer,inner]) for y in (y0,y1) for x,z in ring]
    faces=[]
    for i in range(count):j=(i+1)%count;faces.append((i,j,j+count,i+count))
    if solid:faces+=[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]
    else:
        for i in range(count):
            j=(i+1)%count
            faces.extend([(i+2*count,j+2*count,j+3*count,i+3*count),(i,j,j+2*count,i+2*count),(i+count,j+count,j+3*count,i+3*count)])
    me=bpy.data.meshes.new(name);me.from_pydata([V(v) for v in vs],[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,mat)
band('Red_waist',.88,1.62,red);band('Cream_belt',1.62,1.77,cream)
band('Roof_cream_band',2.96,3.12,cream);band('Red_roof_ribbon',3.12,3.29,red)
def crowned_roof():
    # Cross sections create a real curved crown, rather than a flat cap with a
    # beveled perimeter. The shell meets the original red roof ribbon exactly.
    stations=[(-z,cab_roof_width(z)) for z in (7.65,7.64,7.60,7.50,7.35,7.15,6.9,6.65)]
    stations += [(z,1.27) for z in (-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,6.65)]
    stations += [(z,cab_roof_width(z)) for z in (6.9,7.15,7.35,7.50,7.60,7.64,7.65)]
    vertices=[];count=25
    for z,width in stations:
        for j in range(count):
            u=2*j/(count-1)-1
            height=3.315+.115*(1-(u*width/1.27)**2)-.018*max(0,(abs(z)-6.6)/1.05)
            vertices.append((u*width,height,z))
    faces=[]
    for i in range(len(stations)-1):
        for j in range(count-1):
            a=i*count+j;faces.append((a,a+1,a+count+1,a+count))
    # Side returns and end caps close the shell without affecting the crown normals.
    for edge in (0,count-1):
        for i in range(len(stations)-1):
            a=i*count+edge;b=(i+1)*count+edge
            k=len(vertices);vertices += [(vertices[a][0],3.29,vertices[a][2]),(vertices[b][0],3.29,vertices[b][2])]
            faces.append((a,b,k+1,k))
    for i in (0,len(stations)-1):
        ring=list(range(i*count,(i+1)*count));k=len(vertices)
        vertices += [(vertices[ring[-1]][0],3.29,stations[i][0]),(vertices[ring[0]][0],3.29,stations[i][0])]
        faces.append(tuple(ring+[k,k+1]))
    me=bpy.data.meshes.new('Crowned_roof_shell');me.from_pydata([V(v) for v in vertices],[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new('Rounded_ivory_roof',me);bpy.context.collection.objects.link(obj);finish(obj,obj.name,cream)
    for f in me.polygons:f.use_smooth=f.index<(len(stations)-1)*(count-1)
    import runpy
    bpy.context.view_layer.update()
    runpy.run_path(str(P/'source/roof_normals_refined.py'))['smooth_crown'](obj)
    return obj
roof=crowned_roof()
# A closed, continuous skirt follows the same plan as the upper body, including both noses.
# Only the four wheel wells and the two passenger entrances are removed.
doors=[('Front',5.90),('Rear',-2.68)]
wheel_z=[4.18,2.38,-3.78,-5.58]
cutouts=[(1.88,4.68),(-6.08,-3.28)]
skirt=band('Continuous_skirt',.22,.88,silver)
def subtract(target,cutter):
    mod=target.modifiers.new('Fitted aperture','BOOLEAN');mod.object=cutter;mod.operation='DIFFERENCE';mod.solver='EXACT'
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
for side in (-1,1):
    for a,b in cutouts:
        subtract(skirt,box('TEMP_wheel_well',(side*1.25,.10,(a+b)/2),(.6,1.14,b-a),dark,parent=None,bevel=.12))
        # Return flanges make the wheel-well edge a finished surface rather than a paper-thin cut.
        box('Wheelwell_upper_return',(side*1.20,.659,(a+b)/2),(.15,.028,b-a-.20),dark,bevel=.008)
    # Body trim ends at each jamb instead of crossing the passenger entrance.
    trim_intervals=[(-6.75,-3.48),(-1.88,5.10)] if side==1 else [(-6.75,6.65)]
    for a,b in trim_intervals:rod('Waist_trim',(side*1.283,.89,a),(side*1.283,.89,b),.016,chrome)
# Filled header under the roof overhang; its deep end return meets the sloping windscreen.
band('Continuous_black_header',2.915,2.96,charcoal,end_inset=.038,outset=.008)
# The floor follows the nose outline too, closing the previously exposed underside of the cab.
deck=band('Full_length_floor',1.02,1.10,floor,True)
deck.scale.x=.94;deck.scale.y=.99
root['floor_inset_complete']=True
bumper=band('Continuous_end_bumpers',.845,.955,charcoal,end_inset=.016,outset=.025)
subtract(bumper,box('TEMP_remove_side_bumper',(0,.90,0),(4,.5,13.34),dark,parent=None,bevel=0))
for height in (.28,.65):curved_tube('End_skirt_trim',cab_arc(height,.014),.012,bumper_metal)
build_curved_front()
build_curved_rear()
# Opaque window-band structure fills the strips between the separate glazing apertures.
for side in (-1,1):
    intervals=[(-6.66,-3.48),(-1.87,5.10)] if side==1 else [(-6.66,6.62)]
    for start,end in intervals:
        for height in (1.765,2.945):box('Window_band_rail',(side*1.264,height,(start+end)/2),(.085,.10,end-start+.025),charcoal,bevel=.008)
        count=max(1,round((end-start)/1.16));span=(end-start)/count
        for i in range(count+1):box('Window_band_pillar',(side*1.264,2.36,start+i*span),(.085,1.20,.105),charcoal,bevel=.008)
        for i in range(count):
            z=start+(i+.5)*span;w=span-.10
            # Each cell has an actual rounded aperture in its opaque black panel.
            glazed_aperture('Rounded_passenger_window',side*1.295,2.36,z,w-.045,1.065,.105,outer=(span,1.20,.012,charcoal))
            rounded_bead('Passenger_window_seal',side*1.305,2.36,z,w-.005,1.105,.12,.022,charcoal)
            rounded_bead('Aluminium_sash',side*1.311,2.36,z,w-.04,1.07,.105,.009,silver)
            rod('Window_divider',(side*1.320,2.55,z-w/2+.055),(side*1.320,2.55,z+w/2-.055),.014,charcoal)
            box('Sash_catch',(side*1.325,2.58,z),(.015,.032,.055),dark,bevel=.004)
    box('Rear_cab_side_post',(side*1.27,2.36,-6.70),(.09,1.20,.16),charcoal,bevel=.008)
    box('Front_cab_side_post',(side*1.27,2.36,6.64),(.09,1.20,.09),charcoal,bevel=.008)
    for z in [-6.6,-4.6,-.8,2.0,4.6]:
        if side==1 and any(abs(z-d)<.80 for _,d in doors):continue
        rod('Body_panel_joint',(side*1.282,.95,z),(side*1.282,1.60,z),.006,dark)
    decal('Side_TTC',(side*1.2725,1.23,1.34),.58,.235625,(0,310,320,440),side)
    decal('Side_fleet',(side*1.285,1.42,4.85),.47,.16,(1030,0,1450,160),side)
    decal('Toronto_lettering',(side*1.285,1.15,-5.6),.64,.12,(0,560,340,650),side)
    for z in (-6.4,.4,4.95 if side==1 else 6.4):box('Side_marker',(side*1.29,.98,z),(.035,.075,.13),amber,bevel=.02)
# Two independent FOUR leaf bi-fold door sets. Each assembly has two jamb hinges and two nested pivots.
door_rigs=[]
for name,z in doors:
    group=empty('Door_'+name,loc=(0,0,z),parent=root)
    # Window region was omitted above; cut waist panels in apertures below using a boolean.
    for target_name in ('Red_waist','Cream_belt','Continuous_skirt'):
        target=bpy.data.objects.get(target_name)
        subtract(target,box('TEMP_door_cut',(1.25,1.36,z),(.50,2.8,1.47),dark,parent=None,bevel=0))
    subtract(deck,box('TEMP_stairwell',(1.0,1.02,z),(.88,.45,1.44),dark,parent=None,bevel=0))
    for sign in (-1,1):
        outer=empty('Door_'+name+('_A' if sign==1 else '_B'),(1.275,0,sign*.72),group)
        inner=empty('Door_'+name+('_A_Fold' if sign==1 else '_B_Fold'),(0,0,-sign*.36),outer)
        door_rigs.append((outer,inner,sign))
        for pivot in (outer,inner):
            leaf_before=set(bpy.data.objects)
            c=-sign*.18
            # A complete metal leaf with two glazed holes. Every pane overlaps its gasket.
            for zz in (c-.155,c+.155):box('Door_leaf_stile',(0,1.50,zz),(.064,2.40,.048),silver,pivot,.010)
            for low,high in ((.30,.49),(1.10,1.70),(2.61,2.70)):
                box('Door_leaf_crosspanel',(0,(low+high)/2,c),(.064,high-low,.358),silver,pivot,.006)
            box('Door_red_waist',(.039,1.36,c),(.016,.52,.350),red,pivot,.004)
            for zz in (c-.155,c+.155):box('Door_red_stile',(.039,.99,zz),(.016,.22,.048),red,pivot,.004)
            box('Door_ivory_belt',(.040,1.655,c),(.016,.09,.350),cream,pivot,.004)
            for low,high,width in ((.49,1.10,.235),(1.70,2.61,.235)):
                mid=(low+high)/2
                glazed_aperture('Capsule_door_pane',.044,mid,c,width,high-low-.045,.112,pivot,outer=(.358,high-low+.015,.008,silver),back_depth=.076)
                rounded_bead('Door_capsule_gasket',.052,mid,c,width+.025,high-low-.02,.123,.018,charcoal,pivot)
                rounded_bead('Door_inner_window_seal',-.034,mid,c,width+.025,high-low-.02,.123,.018,charcoal,pivot)
            decal('Door_waist_stop',(.058,1.36,c),.19,.20,(400,335,540,480),1,pivot)
            for zz in (c-.179,c+.179):box('Door_compression_seal',(0,1.50,zz),(.074,2.40,.012),charcoal,pivot,bevel=0)
            decal('Door_stop',(.058,.39,c),.15,.15,(400,335,540,480),1,pivot)
            for part in set(bpy.data.objects)-leaf_before:
                if part.type!='MESH' or part.active_material!=silver:continue
                # The low kick plate remains brushed metal on both sides.
                if part.name.startswith('Door_leaf_crosspanel') and part.location.z<.5:continue
                paint_door_cabin_faces(part)
    # door header and steps remain attached to car body.
    box('Door_header',(1.28,2.85,z),(.08,.25,1.52),charcoal)
    box('Door_top_compression_seal',(1.28,2.713,z),(.09,.055,1.49),charcoal,bevel=.012)
    decal('Side_destination',(1.327,2.86,z),1.25,.13,(0,170,1024,275),1)
    for s in (-1,1):
        box('Door_fixed_jamb',(1.255,1.49,z+s*.757),(.12,2.48,.080),charcoal,bevel=.012)
        box('Stairwell_side_return',(.94,.51,z+s*.729),(.72,.62,.035),silver,bevel=.008)
    for k in range(4):
        top=.28+k*.26;x=1.20-k*.21
        box('Solid_entry_step',(x,(.19+top)/2,z),(.22,top-.19,1.43),silver,bevel=.006)
        rod('Yellow_step_nosing',(x+.102,top+.006,z-.70),(x+.102,top+.006,z+.70),.012,yellow)
    for s in (-1,1):rod('Entry_handrail',(.86,1.10,z+s*.63),(.86,2.58,z+s*.63),.020,silver)
root['door_interior_revision']='red-enamel-inner-seals-v1'
# Passenger saloon: high floor, transverse red vinyl pairs, narrow aisle,
# stainless stanchions, curved ceiling and the rear bench visible in references.
seat_count=0
# The inner ceiling follows the rounded rear crown without covering the glass.
ceiling_verts=[]
ceiling_sections=[(-7.50,.76),(-7.30,1.02),(-6.65,1.17),(6.4,1.17)]
for z,width in ceiling_sections:
    for i in range(17):
        x=-width+i*2*width/16;ceiling_verts.append((x,3.13-.12*(x/1.17)**2,z))
me=bpy.data.meshes.new('Saloon_ceiling');me.from_pydata([V(v) for v in ceiling_verts],[],[(r*17+i,r*17+i+1,(r+1)*17+i+1,(r+1)*17+i) for r in range(3) for i in range(16)]);me.update()
o=bpy.data.objects.new('Arched_interior_ceiling',me);bpy.context.collection.objects.link(o);finish(o,o.name,ceiling_mat)
for poly in me.polygons:poly.use_smooth=True
for side in (-1,1):
    for a,b in ([(-6.72,-3.45),(-1.91,5.10)] if side==1 else [(-6.72,6.60)]):
        box('Interior_wall_liner',(side*1.225,1.48,(a+b)/2),(.035,.69,b-a),laminate,bevel=.008)
        rod('Interior_window_sill',(side*1.215,1.81,a),(side*1.215,1.81,b),.012,silver)

# Leave a little standing space near the front entrance and the driver's cab.
rows=[-4.73+i*.92 for i in range(11)]
for side in (-1,1):
    for z in rows:
        if side==1 and (any(abs(z-d)<1.24 for _,d in doors) or z>4.0):continue
        positions=(.96,) if side==-1 and z>4.0 else (.49,.96)
        for x in positions:
            formed_seat(side*x,z);seat_count+=1
build_rear_lounge();seat_count+=7
build_cabin_fittings()
for z in (-6.10,-1.7,3.8):
    cyl('Floor_access_hatch',(0,1.103,z),.16,.008,dark,'Y',vertices=24)
    ring('Floor_hatch_rim',(0,1.109,z),.158,.003,silver,'Y')
# Glazed driver's screen and the operator's console.
box('Driver_console',(-.53,1.68,6.80),(.94,.34,.62),dark,bevel=.05)
box('Driver_seat',(-.48,1.55,6.17),(.49,.13,.47),seat,bevel=.06)
box('Driver_backrest',(-.48,1.88,5.98),(.48,.55,.09),seat,bevel=.05)
box('Cab_partition_lower',(-.56,1.48,5.55),(1.30,.74,.055),laminate,bevel=.025)
for x in (-1.17,.08):rod('Cab_partition_frame',(x,1.10,5.55),(x,3.02,5.55),.022,silver)
panel('Cab_partition_glass',[(-1.15,1.84,5.55),(.06,1.84,5.55),(.06,3.0,5.55),(-1.15,3.0,5.55)],glass)
rod('Cab_partition_top',(-1.15,3.01,5.55),(.06,3.01,5.55),.022,silver)
root['passenger_seats']=seat_count
root['floor_height_m']=1.10
# Two bogies with steering pivots and four axles; wheel spin is visible through skirt cutouts.
wheel_pivots=[]
for label,zcenter in [('Front',3.28),('Rear',-4.68)]:
    bogie=empty('Bogie_'+label,(0,0,zcenter),root)
    box('Bogie_frame',(0,.48,0),(1.70,.20,2.45),dark,bogie,.05)
    for i,offset in enumerate((-.9,.9)):
        axle=empty('Axle_'+label+'_'+str(i),(0,.335,offset),bogie);wheel_pivots.append(axle)
        cyl('Axle_shaft',(0,0,0),.071,1.65,dark,'X',axle)
        for side in (-1,1):
            railway_wheel(side,axle)
            for k in range(6):
                a=k*math.tau/6;cyl('Hub_bolt',(side*.861,.105*math.cos(a),.105*math.sin(a)),.014,.016,silver,'X',axle,8)
            rod('Wheel_rotation_mark',(side*.807,0,.18),(side*.807,0,.24),.010,cream,axle)
            box('Axlebox',(side*.96,.35,offset),(.19,.18,.29),silver,bogie,.035)
            box('Axlebox_cover',(side*1.066,.35,offset),(.03,.12,.21),wheel_metal,bogie,.025)
            rod('Brake_link',(side*.98,.17,offset-.29),(side*.98,.17,offset+.29),.025,dark,bogie)
            for zz in (offset-.31,offset+.31):box('Brake_shoe',(side*.81,.10,zz),(.17,.18,.065),dark,bogie,.018)
    for side in (-1,1):
        box('Bogie_side_frame',(side*.98,.45,0),(.12,.15,2.35),dark,bogie,.03)
        for z in (-.45,.45):
            cyl('Spring_pack',(side*.98,.55,z),.10,.26,dark,'Y',bogie,12)
            for k in range(5):cyl('Spring_rib',(side*.98,.44+k*.048,z),.12,.020,silver,'Y',bogie,12)
for z in (-1.5,.0,1.3):box('Underfloor_equipment',(0,.51,z),(1.45,.38,.70),dark,bevel=.045)
# Reference roof: rear walkway and one trolley equipment tray.
build_reference_roof()
yaw=empty('Trolley_Yaw',(0,3.61,-1.0),root)
tilt=empty('Trolley_Tilt',parent=yaw)
rod('Trolley_pole',(0,0,0),(0,0,-5.1),.034,dark,tilt)
rod('Trolley_base_sleeve',(0,0,0),(0,0,-.70),.065,silver,tilt)
rod('Trolley_tip_sleeve',(0,0,-4.85),(0,0,-5.15),.052,chrome,tilt)
contact=empty('Wire_Contact',(0,0,-5.20),tilt)
cyl('Collector_shoe',(0,0,-5.20),.081,.16,dark,'X',tilt)
for s in (-1,1):rod('Base_spring',(s*.16,0,-.10),(s*.16,0,-.70),.034,dark,tilt)
tilt.rotation_euler.x=math.radians(26)
root['trolley_base_m']=[0,3.61,-1];root['trolley_length_m']=5.20
# Mirrors mounted beside the front cab.
for side in (-1,1):
    rod('Mirror_arm',(side*1.13,2.79,7.12),(side*1.62,2.72,6.88),.025,dark)
    cyl('Round_mirror',(side*1.62,2.69,6.89),.145,.035,cream,'Z')
    cyl('Mirror_glass',(side*1.62,2.69,6.915),.121,.015,chrome,'Z')
# Final assembly fittings, all batched into existing material/pivot groups.
for side in (-1,1):
    # Flush lower access panels, consistent edge seams, quarter-turn latches and corner fasteners.
    for z,width in [(-2.10,1.55),(.05,1.45),(5.27,.64)]:
        if side==1 and any(abs(z-d)<(width/2+.85) for _,d in doors):continue
        for zz in (z-width/2,z+width/2):rod('Service_panel_seam',(side*1.279,.31,zz),(side*1.279,.80,zz),.0035,charcoal)
        rod('Service_panel_bottom',(side*1.279,.31,z-width/2),(side*1.279,.31,z+width/2),.0035,charcoal)
        box('Flush_latch_recess',(side*1.286,.72,z),(.009,.040,.095),charcoal,bevel=.008)
        rod('Flush_latch',(side*1.293,.72,z-.030),(side*1.293,.72,z+.030),.008,chrome)
        for zz in (z-width/2+.055,z+width/2-.055):
            for y in (.36,.76):cyl('Skirt_fastener',(side*1.284,y,zz),.008,.010,chrome,'X',vertices=8)
    # Window catches belong to the actual sash cells above; do not scatter a
    # second unrelated row of latches across glazing or door jambs.
    for z in (-6.4,-3.6,0,3.6,6.3):box('Gutter_bracket',(side*1.260,3.10,z),(.025,.045,.035),silver,bevel=.004)
    # Fine gasket beds under vents, instead of floating painted blocks.
for outer,inner,sign in door_rigs:
    for pivot in (outer,inner):
        for height in (.56,2.48):
            cyl('Door_hinge_barrel',(.044,height,0),.014,.10,silver,'Y',pivot,12)
        for zz in (-sign*.04,-sign*.32):
            cyl('Door_panel_screw',(.053,1.16,zz),.006,.008,chrome,'X',pivot,8)
for name,z in doors:
    decal('Entry_safety_notice',(1.329,2.745,z),.78,.062,(600,310,1300,395),1)
    for k in range(4):
        top=.28+k*.26;x=1.20-k*.21
        box('Anti_slip_tread',(x-.01,top+.006,z),(.13,.008,1.33),charcoal,bevel=.002)
# Dashboard gauge bezels and driver backrest, visible through the cab.

for x in (-.72,-.48,-.24):
    cyl('Dashboard_gauge_rim',(x,1.852,6.78),.057,.014,chrome,'Y',vertices=16)
    cyl('Dashboard_gauge_face',(x,1.862,6.78),.048,.012,charcoal,'Y',vertices=16)
    rod('Dashboard_needle',(x,1.870,6.78),(x+.025,1.870,6.80),.003,cream)
rod('Controller_lever',(-.16,1.85,6.92),(-.16,2.04,6.86),.012,silver)
cyl('Controller_grip',(-.16,2.04,6.86),.025,.09,charcoal,'X',vertices=12)

# Low-cost manufactured details: concentric access-cover grooves and screws,
# panel screw heads, washer jets and metal-backed articulated windscreen wipers.
for z in (-6.10,-1.7,3.8):
    for r in (.141,.148):ring('Floor_access_concentric_rim',(0,1.110,z),r,.0018,silver,'Y')
    for k in range(4):
        a=k*math.tau/4;x=.129*math.cos(a);zz=z+.129*math.sin(a)
        cyl('Floor_cover_screw',(x,1.112,zz),.006,.003,stainless,vertices=8)
for side in (-1,1):
    for z in (-5.95,-4.85,.10,1.65,3.20):
        if side==1 and any(abs(z-d)<.9 for _,d in doors):continue
        for y in (1.20,1.73):cyl('Wall_liner_fixing',(side*1.205,y,z),.005,.006,stainless,'X',vertices=8)
    def wipe_point(x,y,offset=.058):
        q=math.asin(math.copysign((abs(x)/1.27)**1.3,x))/(math.pi/2)
        return glass_point(q,y,offset)
    rod('Wiper_sprung_link',wipe_point(side*.59,1.84),wipe_point(side*.45,2.51),.0055,silver)
    rod('Wiper_blade_backing',wipe_point(side*.435,2.535),wipe_point(side*.275,2.805),.006,dark)
    front_attachment(cyl('Washer_jet',(0,0,0),.010,.018,charcoal,'Z',vertices=8),side*.24,1.805,.041)
audit_seat_clearance()

# Subtle vertex tint puts road film low down and variation on individual manufactured parts.
# It adds no material slots or extra texture lookups, and follows moving components.
import hashlib
for obj in list(bpy.data.objects):
    if obj.type!='MESH' or obj.active_material in (atlas,glass,white,tail,green,amber,warm):continue
    colors=obj.data.color_attributes.new(name='ServiceWear',type='BYTE_COLOR',domain='CORNER')
    obj.data.color_attributes.active_color=colors
    seed=int(hashlib.sha256(obj.name.encode()).hexdigest()[:8],16)/0xffffffff
    for loop in obj.data.loops:
        co=obj.matrix_basis@obj.data.vertices[loop.vertex_index].co;y=co.z
        value=.985-.025*seed
        if obj.name.startswith(('Continuous_skirt','Service_panel','Skirt_fastener')):
            value*=.82+.16*min(1,max(0,(y-.22)/.66))
        elif obj.name.startswith(('Steel_wheel','Wheel_flange','Wheel_hub','Bogie','Spring','Axlebox')):value*=.69+.10*seed
        elif obj.name.startswith(('Roof_vent','Grille','Roof_sheet')):value*=.90
        elif obj.name.startswith('Red_waist'):value*=.92+.08*min(1,max(0,(y-.88)/.74))
        colors.data[loop.index].color=(value,value*.997,value*.985,1)

for mat in (red,cream,charcoal,silver,chrome,dark,seat,floor,yellow,laminate,ceiling_mat,stainless):
    tree=mat.node_tree;shader=tree.nodes.get('Principled BSDF')
    vertex=tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='ServiceWear'
    multiply=tree.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
    if shader.inputs['Base Color'].is_linked:
        tree.links.new(shader.inputs['Base Color'].links[0].from_socket,multiply.inputs[1])
    else:multiply.inputs[1].default_value=shader.inputs['Base Color'].default_value
    tree.links.new(vertex.outputs['Color'],multiply.inputs[2]);tree.links.new(multiply.outputs[0],shader.inputs['Base Color'])

# Animation clips travel 0..1 or full wheel revolution. Controllers can sample directly.
# Small rounded panel edges and baked custom normals; no subdivision modifier is used.
for obj in list(bpy.data.objects):
    if obj.type!='MESH':continue
    if obj.name.startswith(('Red_waist','Cream_belt','Roof_cream_band','Red_roof_ribbon','Continuous_skirt','Continuous_end_bumpers','Rounded_ivory_roof')):
        if not obj.name.startswith('Rounded_ivory_roof'):
            mod=obj.modifiers.new('Fine panel edge radius','BEVEL');mod.width=.002;mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=math.radians(35);mod.harden_normals=True
            bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
        if not obj.name.startswith('Rounded_ivory_roof'):weighted_shading(obj)
    # Physical-scale planar UVs for the paint and the horizontal grain on exposed steel.
    if obj.active_material in (red,cream,silver,floor,seat,laminate):
        if obj.data.uv_layers:obj.data.uv_layers.active.name='FinishUV'
        else:obj.data.uv_layers.new(name='FinishUV')
        uv=obj.data.uv_layers.active
        density=(4,4) if obj.active_material==floor else (.65,.65) if obj.active_material==laminate else (8,8) if obj.active_material in (red,cream,seat) else (1.5,3)
        for poly in obj.data.polygons:
            normal=obj.matrix_basis.to_3x3()@poly.normal;dominant=max(range(3),key=lambda i:abs(normal[i]))
            for li in poly.loop_indices:
                co=obj.matrix_basis@obj.data.vertices[obj.data.loops[li].vertex_index].co
                logical=(co.x,co.z,-co.y)
                if dominant==0:pair=(logical[2],logical[1])
                elif dominant==2:pair=(logical[0],logical[2])
                else:pair=(logical[0],logical[1])
                uv.data[li].uv=(pair[0]*density[0],pair[1]*density[1])
def clip(name,objects,prop,values,duration):
    act=bpy.data.actions.new(name);act.use_fake_user=True
    for obj,start,end in zip(objects,values[0],values[1]):
        obj.animation_data_create();obj.animation_data.action=act
        setattr(obj,prop,start);obj.keyframe_insert(data_path=prop,frame=0,group=obj.name)
        setattr(obj,prop,end);obj.keyframe_insert(data_path=prop,frame=duration*30,group=obj.name)
    # NLA tracks on each target share action, exporter with action slot mode handles bindings.
    for obj in objects:
        track=obj.animation_data.nla_tracks.new();track.name=name
        strip=track.strips.new(name,0,act);obj.animation_data.action=None
    return act
# Use one action per object, same NLA track name combines them into one glTF clip.
def animate_set(name,entries,seconds=1):
    for obj,axis,end in entries:
        obj.animation_data_create();act=bpy.data.actions.new(name+'__'+obj.name);obj.animation_data.action=act
        initial=obj.rotation_euler.copy();obj.rotation_euler[axis]=0;obj.keyframe_insert('rotation_euler',frame=0)
        obj.rotation_euler[axis]=end;obj.keyframe_insert('rotation_euler',frame=seconds*30)
        # linear key interpolation for predictable sampled progress.
        for fc in act.fcurves:
            for key in fc.keyframe_points:key.interpolation='LINEAR'
        tr=obj.animation_data.nla_tracks.new();tr.name=name;tr.strips.new(name,0,act);obj.animation_data.action=None
        obj.rotation_euler=initial
for name,_ in doors:
    entries=[]
    for outer,inner,sign in door_rigs:
        if outer.name.startswith('Door_'+name+'_'):
            # Blender Z rotation maps to glTF +Y. The initial panel folds into the cabin.
            entries.extend([(outer,2,sign*math.radians(83)),(inner,2,-sign*math.radians(166))])
    animate_set('Doors_'+name,entries,1.2)
animate_set('Wheels_Roll',[(o,0,math.tau) for o in wheel_pivots],1)
# Four intermediate keys preserve the full revolution in quaternion export.
for obj in wheel_pivots:
    tr=obj.animation_data.nla_tracks[-1];act=tr.strips[0].action;obj.animation_data.action=act
    for f in (7.5,15,22.5):obj.rotation_euler.x=math.tau*f/30;obj.keyframe_insert('rotation_euler',frame=f)
    for fc in act.fcurves:
        for key in fc.keyframe_points:key.interpolation='LINEAR'
    obj.animation_data.action=None;obj.rotation_euler.x=0
animate_set('Trolley_Raise',[(tilt,0,math.radians(65))],1)
tilt.rotation_euler.x=math.radians(26)
# Merge static mesh components by material under each pivot, keeping named functional empties.
# Mesh operations must run in the rest pose; evaluating NLA while applying modifiers
# can bake a folded parent's transform into its child meshes.
for obj in bpy.data.objects:
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks:track.mute=True
bpy.context.scene.frame_set(0)
for outer,inner,sign in door_rigs:outer.rotation_euler.z=0;inner.rotation_euler.z=0
for axle in wheel_pivots:axle.rotation_euler.x=0
tilt.rotation_euler.x=math.radians(26)
bpy.context.view_layer.update()
groups={}
for o in list(bpy.data.objects):
    if o.type=='MESH':groups.setdefault((o.parent,o.active_material),[]).append(o)
for (parent,mat),objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    o=objects[0]
    o.name=(parent.name if parent else 'Mesh')+'__'+mat.name
    if mat==bumper_metal:o.name='Bumper_Chrome_Trim'
    if mat==seat:
        # Collapse redundant samples across the shallow cushion dish while
        # preserving the formed outline, back thickness, UVs and vertex tint.
        mod=o.modifiers.new('Game seat shell reduction','DECIMATE');mod.ratio=.90
        mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    if mat in (red,cream,silver,seat,floor,laminate):
        tri=o.modifiers.new('Portable normal-map triangulation','TRIANGULATE')
        if hasattr(tri,'keep_custom_normals'):tri.keep_custom_normals=True
        bpy.ops.object.modifier_apply(modifier=tri.name)
# Export ONLY the asset, before setting up the photographic studio.
bpy.context.scene.frame_set(0)
for o in bpy.data.objects:
    if o.animation_data:
        for tr in o.animation_data.nla_tracks:tr.mute=True
tilt.rotation_euler.x=math.radians(26)
asset_objects=list(bpy.data.objects)
asset_transforms={obj:(obj.matrix_basis.copy(),obj.matrix_parent_inverse.copy()) for obj in asset_objects}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(P/'ttc-clrv-refined.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_anim_slide_to_zero=True,export_extras=True,export_materials='EXPORT',export_yup=True,export_tangents=True,export_vertex_color='ACTIVE')
import runpy
runpy.run_path(str(P/'source/optimize_glb.py'))['optimize'](P/'ttc-clrv-refined.glb', {m.name:list(m.diffuse_color) for m in (red,cream,charcoal,silver,chrome,dark,seat,floor,yellow,bumper_metal,wheel_metal,vent_dark,seat_edge,laminate,ceiling_mat,stainless)})
for o,(basis,parent_inverse) in asset_transforms.items():
    o.matrix_parent_inverse=parent_inverse;o.matrix_basis=basis
for o in asset_objects:
    if o.animation_data:
        for tr in o.animation_data.nla_tracks:tr.mute=False
# Keep all clips muted in the editable Blender file until the user selects one.
for o in asset_objects:
    if o.animation_data:
        for tr in o.animation_data.nla_tracks:tr.mute=True
for outer,inner,sign in door_rigs:
    outer.rotation_euler.z=0;inner.rotation_euler.z=0
for axle in wheel_pivots:axle.rotation_euler.x=0
tilt.rotation_euler.x=math.radians(26)
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35)
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.40,.44,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
ground=material('Studio_ground',(.075,.105,.12,1),.1,.75)
box('Studio_Ground',(0,-.055,0),(200,.10,200),ground,parent=None,bevel=0)
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=V(loc);o.rotation_euler=(V((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(8,14,6),2200,10);area('Rim',(-8,8,-7),1900,8);area('Fill',(3,7,-10),1200,10)
data=bpy.data.cameras.new('Asset_preview_camera');cam=bpy.data.objects.new('Asset_preview_camera',data);scene.collection.objects.link(cam)
cam.location=V((16,9,20));cam.rotation_euler=(V((0,2,0))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=20;scene.camera=cam
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(P/'preview-refined.png')
asset_collection=bpy.data.collections.new('Streetcar_Asset');scene.collection.children.link(asset_collection)
studio_collection=bpy.data.collections.new('Preview_Studio');scene.collection.children.link(studio_collection)
for obj in list(bpy.data.objects):
    for collection in list(obj.users_collection):collection.objects.unlink(obj)
    (asset_collection if obj in asset_objects else studio_collection).objects.link(obj)
for screen in bpy.data.screens:
    for area_view in screen.areas:
        if area_view.type=='VIEW_3D':area_view.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(P.parent.parent/'ttc-clrv-game-ready.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('STREETCAR_BUILD_COMPLETE')
