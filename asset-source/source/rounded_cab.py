"""Continuous CLRV cab surfaces. Loaded with the builder's material/mesh helpers.

The plan is a smooth rounded rectangle: a gently bowed centre flows into round
shoulders, rather than a flat face meeting two bevelled panels.
"""
import math
from mathutils import Vector,Matrix

CAB_WIDTH=1.27
CAB_BASE=6.65
CAB_DEPTH=1.0
CAB_POWER=2.6

def cab_plan(theta):
    s,c=math.sin(theta),max(0.,math.cos(theta))
    return (CAB_WIDTH*math.copysign(abs(s)**(2/CAB_POWER),s),CAB_BASE+CAB_DEPTH*c**(2/CAB_POWER))

def cab_z(x):
    return CAB_BASE+CAB_DEPTH*max(0.,1-(abs(x)/CAB_WIDTH)**CAB_POWER)**(1/CAB_POWER)

def cab_normal(x):
    dz=max(.00001,cab_z(x)-CAB_BASE)
    return Vector((math.copysign((abs(x)/CAB_WIDTH)**(CAB_POWER-1)/CAB_WIDTH,x),0.,(dz/CAB_DEPTH)**(CAB_POWER-1)/CAB_DEPTH)).normalized()

def cab_roof_width(z):
    return max(.02,CAB_WIDTH*max(0.,1-((z-CAB_BASE)/CAB_DEPTH)**CAB_POWER)**(1/CAB_POWER))

def cab_arc(height,offset=0.,segments=64):
    points=[]
    # End the trim just ahead of the door jamb, outside the opening.
    for i in range(segments+1):
        theta=math.radians(-88+176*i/segments);x,z=cab_plan(theta);n=cab_normal(x)
        points.append((x+n.x*offset,height,z+n.z*offset))
    return points

def curved_tube(name,points,radius,mat,sides=8,closed=False):
    vertices=[];faces=[];count=len(points)
    for i,point in enumerate(points):
        a=Vector(points[(i-1)%count] if closed or i>0 else point)
        b=Vector(points[(i+1)%count] if closed or i<count-1 else point)
        tangent=(b-a).normalized();axis=tangent.cross(Vector((0,1,0)))
        if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
        axis.normalize();other=tangent.cross(axis).normalized()
        for k in range(sides):
            q=Vector(point)+radius*(math.cos(k*math.tau/sides)*axis+math.sin(k*math.tau/sides)*other)
            vertices.append(V(q))
    for i in range(count if closed else count-1):
        j=(i+1)%count
        for k in range(sides):faces.append((i*sides+k,i*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k))
    if not closed:faces.extend((tuple(range(sides-1,-1,-1)),tuple((count-1)*sides+k for k in range(sides))))
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(obj);finish(obj,name,mat)
    for face in me.polygons:face.use_smooth=len(face.vertices)==4
    return obj

def rounded_bounds(x,width,height,radius):
    edge=abs(x)-(width/2-radius)
    inset=radius-math.sqrt(max(0.,radius*radius-max(0.,edge)**2)) if edge>0 else 0
    return -height/2+inset,height/2-inset

def front_patch(name,cx,cy,width,height,radius,mat,offset=.025,rect=None,segments=32,rows=4,cap_top=False):
    vertices=[];faces=[];coords=[]
    columns={-width/2+width*i/segments for i in range(segments+1)}
    # Extra samples follow the actual corner arc rather than chamfering it.
    for sign in (-1,1):
        for k in range(7):columns.add(sign*(width/2-radius+radius*math.cos(k*math.pi/12)))
    columns=sorted(columns);segments=len(columns)-1
    for local in columns:
        lo,hi=rounded_bounds(local,width,height,radius)
        x=cx+local;n=cab_normal(x)
        if cap_top:
            roof=3.315+.115*(1-(x/1.27)**2)-.018*max(0.,(cab_z(x)-6.6)/1.05)
            hi=min(hi,roof+.002-cy)
        for j in range(rows+1):
            y=cy+lo+(hi-lo)*j/rows
            vertices.append(V((x+n.x*offset,y,cab_z(x)+n.z*offset)))
            coords.append((local/width+.5,j/rows))
    for i in range(segments):
        for j in range(rows):
            a=i*(rows+1)+j;faces.append((a,a+rows+1,a+rows+2,a+1))
    if cap_top:
        back=[]
        for local in columns:
            x=cx+local
            roof=3.315+.115*(1-(x/1.27)**2)-.018*max(0.,(cab_z(x)-6.6)/1.05)
            back.append(len(vertices));vertices.append(V((x,roof,cab_z(x))));coords.append((0,0))
        for i in range(segments):faces.append((i*(rows+1)+rows,(i+1)*(rows+1)+rows,back[i+1],back[i]))
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(obj);finish(obj,name,mat)
    for face in me.polygons:face.use_smooth=True
    if rect:
        u0,v0,u1,v1=rect;layer=me.uv_layers.new(name='UVMap')
        for face in me.polygons:
            for li in face.loop_indices:
                u,v=coords[me.loops[li].vertex_index]
                layer.data[li].uv=((u0+(u1-u0)*u)/2048,1-(v1+(v0-v1)*v)/1024)
    return obj

def glass_point(q,y,offset=.012):
    theta=q*math.pi/2;x,z=cab_plan(theta);n=cab_normal(x)
    amount=max(0.,min(1.,(y-1.78)/1.16))
    setback=.19*amount*(z-CAB_BASE)/CAB_DEPTH
    return (x+n.x*offset,y,z-setback+n.z*offset)

def glass_bounds(q):
    # Rounded outer corners are real geometry, not an alpha cutout.
    edge=(abs(q)-.925)/.075
    inset=.105*(1-math.sqrt(max(0.,1-max(0.,edge)**2))) if edge>0 else 0
    return 1.785+inset,2.93-inset

def front_attachment(obj,x,y,offset):
    normal=cab_normal(x);angle=math.atan2(normal.x,normal.z)
    rotation=Matrix.Rotation(angle,4,'Z')@obj.rotation_euler.to_matrix().to_4x4()
    obj.rotation_euler=rotation.to_euler();obj.location=V((x+normal.x*offset,y,cab_z(x)+normal.z*offset))
    return obj

def build_curved_front():
    # Swept glazing provides continuously changing reflections over the cab.
    columns=64;rows=8;vertices=[];faces=[]
    for i in range(columns+1):
        q=-1+2*i/columns;lo,hi=glass_bounds(q)
        for j in range(rows+1):vertices.append(V(glass_point(q,lo+(hi-lo)*j/rows)))
    for i in range(columns):
        for j in range(rows):
            a=i*(rows+1)+j;faces.append((a,a+rows+1,a+rows+2,a+1))
    me=bpy.data.meshes.new('Swept_CLRV_windscreen');me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new('Curved_wraparound_windscreen',me);bpy.context.collection.objects.link(obj);finish(obj,obj.name,glass)
    for face in me.polygons:face.use_smooth=True
    lower=[glass_point(-1+2*i/64,glass_bounds(-1+2*i/64)[0],.020) for i in range(65)]
    upper=[glass_point(-1+2*i/64,glass_bounds(-1+2*i/64)[1],.020) for i in range(65)]
    curved_tube('Windscreen_lower_rubber',lower,.025,charcoal)
    curved_tube('Windscreen_upper_rubber',upper,.028,charcoal)
    for q in (-1.,-.73,0.,.73,1.):
        lo,hi=glass_bounds(q)
        curved_tube('Windscreen_pillar',[glass_point(q,lo+(hi-lo)*i/8,.021) for i in range(9)],.014 if q==0 else .022,charcoal)
    front_patch('Integrated_ivory_destination_mask',0,3.18,2.12,.50,.105,cream,.028,cap_top=True)
    front_patch('Curved_destination_seal',0,3.115,1.91,.285,.065,charcoal,.043)
    front_patch('Front_destination',0,3.115,1.78,.235,.04,atlas,.049,(0,0,1024,160))
    front_patch('End_roof_fleet',0,3.345,.30,.085,.003,atlas,.036,(1650,40,1855,125),segments=12,rows=2)
    for side in (-1,1):
        for name,radius,depth,mat,offset in (('Marker_bezel',.048,.025,chrome,.047),('Marker_lens',.035,.020,green,.066)):
            front_attachment(cyl(name,(0,0,0),radius,depth,mat,'Z',vertices=24),side*.86,3.308,offset)
        x=side*.96
        front_attachment(box('Corner_lamp_pocket',(0,0,0),(.18,.385,.065),red,bevel=.065),x,1.29,.023)
        front_attachment(box('Corner_lamp_recess',(0,0,0),(.140,.32,.012),charcoal,bevel=.06),x,1.29,.060)
        for y,rad,mat in ((1.40,.047,tail),(1.20,.062,white)):
            front_attachment(cyl('Corner_lamp_bezel',(0,0,0),rad+.010,.015,chrome,'Z',vertices=24),x,y,.071)
            front_attachment(domed_lens('Corner_lamp_lens',(0,0,0),rad,1,mat),x,y,.082)
        # Each wiper sits just in front of the raked, curved glass surface.
        def wiper(x,y):
            q=math.asin(math.copysign((abs(x)/CAB_WIDTH)**(CAB_POWER/2),x))/(math.pi/2)
            return glass_point(q,y,.042)
        rod('Wiper_arm',wiper(side*.57,1.81),wiper(side*.43,2.54),.012,dark)
        rod('Wiper_blade',wiper(side*.43,2.54),wiper(side*.27,2.81),.016,charcoal)
        front_attachment(cyl('Wiper_spindle',(0,0,0),.025,.030,dark,'Z',vertices=12),side*.57,1.80,.033)
    front_patch('Headlamp_mount',0,1.29,.34,.35,.025,red,.012,segments=16)
    for name,radius,depth,mat,offset in (('Central_headlamp_gasket',.139,.020,charcoal,.035),('Central_headlamp_bezel',.124,.025,chrome,.055)):
        cyl(name,(0,1.29,cab_z(0)+offset),radius,depth,mat,'Z',vertices=32)
    domed_lens('Central_headlight_Lens',(0,1.29,cab_z(0)+.080),.105,1,white)
    for x in (-.14,.14):
        for y in (1.15,1.43):front_attachment(cyl('Headlamp_mount_screw',(0,0,0),.007,.008,dark,'Z',vertices=8),x,y,.021)
    front_patch('Front_fleet',.54,1.35,.36,.14,.003,atlas,.012,(1030,0,1450,160),segments=12,rows=2)
    front_patch('Front_service_hatch',-.49,1.55,.56,.11,.015,red,.009,segments=20,rows=2)
    for x in (-.72,-.26):front_attachment(cyl('Hatch_fixing',(0,0,0),.008,.008,silver,'Z',vertices=8),x,1.55,.020)
    for height in (.87,.925,.98):curved_tube('Curved_rubber_anti_climber',cab_arc(height,.039),.020,charcoal)

PUBLIC=['cab_plan','cab_z','cab_normal','cab_roof_width','cab_arc','curved_tube','build_curved_front','front_patch','front_attachment','glass_point','glass_bounds']
