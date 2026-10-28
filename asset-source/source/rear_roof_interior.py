"""Reference-based rear end, roof fittings and CLRV saloon. Metres, +Z forward.

Loaded by the asset builder with its geometry and material helpers. Everything
is batched by material afterwards; small fittings do not add draw calls.
"""
from mathutils import Matrix

stainless=material('Interior_Stainless',(.53,.56,.57,1),.86,.29)

def reverse_end(obj):
    obj.matrix_basis=Matrix.Rotation(math.pi,4,'Z')@obj.matrix_basis
    return obj

def rear_patch(*args,**kwargs):
    return reverse_end(front_patch(*args,**kwargs))

def rear_attach(obj,x,y,offset):
    return reverse_end(front_attachment(obj,x,y,offset))

def back_point(q,y,offset=.018):
    x,h,z=glass_point(q,y,offset)
    # The rear glass is more upright than the driver's windscreen.
    z+=.12*max(0,min(1,(y-1.78)/1.16))*(cab_z(x)-6.65)
    return (-x,h,-z)

def build_curved_rear():
    columns=64;rows=5;vertices=[];faces=[]
    for i in range(columns+1):
        q=-1+2*i/columns;lo,hi=glass_bounds(q)
        for j in range(rows+1):vertices.append(V(back_point(q,lo+(hi-lo)*j/rows)))
    for i in range(columns):
        for j in range(rows):
            a=i*(rows+1)+j;faces.append((a,a+rows+1,a+rows+2,a+1))
    mesh=bpy.data.meshes.new('Swept_rear_glazing');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('Rounded_wraparound_rear_window',mesh);bpy.context.collection.objects.link(obj);finish(obj,obj.name,glass)
    for f in mesh.polygons:f.use_smooth=True
    for edge in (0,1):
        curved_tube('Rear_window_gasket',[back_point(-1+2*i/64,glass_bounds(-1+2*i/64)[edge],.029) for i in range(65)],.027,charcoal)
    for q in (-1,-.76,0,.76,1):
        lo,hi=glass_bounds(q)
        curved_tube('Rear_window_mullion',[back_point(q,lo+(hi-lo)*i/6,.03) for i in range(7)],.018 if q==0 else .025,charcoal)
    rear_patch('Rear_integrated_destination_mask',0,3.18,2.12,.50,.105,cream,.028,cap_top=True)
    rear_patch('Rear_destination_gasket',0,3.115,1.91,.285,.065,charcoal,.043)
    rear_patch('Rear_route_number',0,3.115,1.78,.235,.04,atlas,.050,(1540,710,2040,850))
    rear_patch('Rear_roof_number',0,3.345,.30,.085,.003,atlas,.036,(1650,40,1855,125),segments=12,rows=2)
    for side in (-1,1):
        rear_attach(cyl('Rear_roof_marker_bezel',(0,0,0),.048,.025,chrome,'Z',vertices=20),side*.86,3.308,.047)
        rear_attach(domed_lens('Rear_roof_marker',(0,0,0),.034,1,tail),side*.86,3.308,.065)
        # Two perforated ventilation panels, as opposed to one generic grille.
        rear_patch('Rear_grille_frame',side*.49,1.285,.57,.535,.016,red,.024,segments=16,rows=2)
        rear_patch('Rear_perforated_grille',side*.49,1.285,.505,.475,.006,atlas,.031,(1280,710,1536,1000),segments=16,rows=2)
        rear_attach(box('Rear_lamp_recess',(0,0,0),(.175,.55,.026),charcoal,bevel=.065),side*.96,1.27,.033)
        for y in (1.075,1.27,1.465):
            rear_attach(cyl('Rear_tail_bezel',(0,0,0),.069,.018,chrome,'Z',vertices=20),side*.96,y,.056)
            rear_attach(domed_lens('Rear_tail_lens',(0,0,0),.053,1,tail),side*.96,y,.073)
        rear_patch('Rear_belt_fleet',side*.47,1.695,.42,.085,.002,atlas,.012,(1650,40,1855,125),segments=12,rows=2)
    rear_attach(cyl('Trolley_retriever_housing',(0,0,0),.135,.075,red,'Z',vertices=24),0,1.43,.049)
    rear_attach(cyl('Retriever_lower_socket',(0,0,0),.064,.027,dark,'Z',vertices=16),0,1.18,.060)
    for height in (.87,.925,.98):
        curved_tube('Rear_curved_anti_climber',[(-x,y,-z) for x,y,z in cab_arc(height,.039)],.020,charcoal)
    for height in (.28,.65):
        curved_tube('Rear_curved_skirt_bead',[(-x,y,-z) for x,y,z in cab_arc(height,.014)],.012,bumper_metal)
    # Retriever cord climbs the centre of the rear glazing to the pole guard.
    curved_tube('Trolley_retriever_cord',[(0,1.51,-7.77),(.015,2.0,-7.74),(.024,2.75,-7.68),(.025,3.37,-7.60),(.025,3.53,-7.30)],.006,dark,sides=6)
    for y in (1.03,1.56):
        rear_attach(cyl('Rear_centre_fastener',(0,0,0),.008,.012,silver,'Z',vertices=8),0,y,.027)
    root['rear_revision']='rounded-lounge-v4'

def formed_seat(x,z,heading=0,rise=0,support=True):
    """One curved pressed seat, a rolled stainless surround and a pedestal.

    Its section follows the dip in the cushion and a gently reclined back.
    The rotation allows the very same construction in the inward-facing nook.
    """
    before=set(bpy.data.objects)
    profile=[(.225,1.565),(.215,1.583),(.18,1.59),(.07,1.565),(-.07,1.555),
             (-.16,1.575),(-.20,1.61),(-.218,1.68),(-.233,1.78),
             (-.254,1.94),(-.274,2.095),(-.277,2.135),(-.268,2.16)]
    vertices=[];faces=[];cols=5
    for j,(zz,y) in enumerate(profile):
        for i in range(cols):
            u=-1+2*i/(cols-1)
            width=.211-(.020 if j in (0,len(profile)-1) else .004 if j in (1,len(profile)-2) else 0)
            # Small dish across the back and cushion keeps highlights from looking flat.
            vertices.append(V((u*width,y+.012*u*u,z+zz)))
    for j in range(len(profile)-1):
        for i in range(cols-1):
            a=j*cols+i;faces.append((a,a+1,a+cols+1,a+cols))
    me=bpy.data.meshes.new('Formed_burgundy_seat');me.from_pydata(vertices,[],faces);me.update()
    obj=bpy.data.objects.new('Formed_vinyl_seat',me);bpy.context.collection.objects.link(obj);finish(obj,obj.name,seat)
    for p in me.polygons:p.use_smooth=True
    mod=obj.modifiers.new('Seat shell thickness','SOLIDIFY');mod.thickness=.027
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    # One continuous rolled frame: no disconnected handhold or pinched metal
    # corners. Keep more of the cushion/back outline instead of heavy decimation.
    edge_section=[profile[i] for i in (0,2,4,5,6,8,10,11)]
    outline=[(-.218,y+.005,z+zz-.011) for zz,y in edge_section]
    outline += [(-.213,2.165,z-.288),(-.193,2.18,z-.287),(.193,2.18,z-.287),(.213,2.165,z-.288)]
    outline += [(.218,y+.005,z+zz-.011) for zz,y in reversed(edge_section)]
    curved_tube('Continuous_rolled_seat_frame',outline,.012,stainless,sides=6)
    rod('Seat_front_rolled_edge',(-.19,1.545,z+.215),(.19,1.545,z+.215),.011,stainless)
    if support:box('Seat_support',(0,1.31,z-.025),(.09,.42,.25),dark,bevel=.012)
    # Move the complete assembly about the seat centre without new scene nodes.
    from mathutils import Vector
    centre=V((0,0,z));rotation=Matrix.Rotation(heading,4,'Z')
    for part in set(bpy.data.objects)-before:
        part.matrix_basis=Matrix.Translation(V((x,rise,z)))@rotation@Matrix.Translation(-centre)@part.matrix_basis
        if part.active_material in (seat,stainless):part['seat_clearance_part']=True

def build_rear_lounge():
    # The existing full-length saloon floor continues into the rear nook.
    # There is no additional platform, step or change in passenger-seat height.
    # Three forward-facing seats at the rear, plus two facing inward on each side.
    for x in (-.46,0,.46):formed_seat(x,-7.055,support=False)
    # A shallow heater/kick panel below the rear bench, not a raised platform.
    box('Rear_bench_heater', (0,1.285,-7.28),(1.49,.29,.16),dark,bevel=.012)
    rod('Rear_bench_support_beam',(-.69,1.46,-7.07),(.69,1.46,-7.07),.026,stainless)
    for x in (-.53,.53):box('Rear_bench_leg',(x,1.28,-7.07),(.065,.35,.09),dark,bevel=.008)
    for x in (-.56,-.28,0,.28,.56):box('Rear_heater_outlet',(x,1.30,-7.192),(.18,.038,.008),vent_dark,bevel=.004)
    for side in (-1,1):
        # The original .925 m centres put the reclined backs through the liner.
        # Recess the wall once and leave clearance behind both the vinyl and rail.
        for z in (-5.68,-6.29):formed_seat(side*.855,z,-side*math.pi/2)
        curved_tube('Lounge_grab_rail',[(side*.71,1.11,-5.34),(side*.71,2.79,-5.34),(side*.70,2.86,-5.34),(side*.64,2.94,-5.34),(side*.54,3.04,-5.34)],.018,stainless)
        cyl('Lounge_pole_floor_flange',(side*.71,1.113,-5.34),.045,.015,stainless,vertices=12)
        rod('Rear_side_seat_support',(side*.88,1.46,-5.44),(side*.88,1.46,-6.52),.023,stainless)
    # The bulkhead follows the end rather than blocking the back window.
    rear_patch('Rear_interior_lower_liner',0,1.53,2.34,.55,.025,laminate,-.12,segments=32,rows=2)
    rear_patch('Rear_interior_upper_bulkhead',0,3.00,2.30,.24,.025,ceiling_mat,-.34,segments=32,rows=2)
    number=rear_patch('Rear_interior_fleet_number',0,2.994,.63,.14,.002,atlas,-.349,(1580,410,2030,540),segments=16,rows=2)
    for uv in number.data.uv_layers.active.data:uv.uv.x=(1580+2030)/2048-uv.uv.x
    root['rear_lounge_seats']=7;root['rear_platform_height_m']=1.10
    root['rear_seat_rise_m']=0.0
    root['rear_side_seat_centre_m']=.855
    root['interior_revision']='clearance-and-fittings-v5'

def roof_height(x,z=0):
    return 3.315+.115*(1-(x/1.27)**2)-.018*max(0,(abs(z)-6.6)/1.05)

def build_reference_roof():
    # Dark anti-slip walkway occupies the trolley half of the crowned roof.
    xs=[-.88+i*1.76/16 for i in range(17)];zs=[-6.70,-6.40,-3.0,-.58]
    verts=[V((x,roof_height(x,z)+.006,z)) for z in zs for x in xs]
    faces=[(r*17+i,r*17+i+1,(r+1)*17+i+1,(r+1)*17+i) for r in range(len(zs)-1) for i in range(16)]
    me=bpy.data.meshes.new('Roof_walkway');me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new('Rear_roof_anti_slip_walkway',me);bpy.context.collection.objects.link(ob);finish(ob,ob.name,charcoal)
    for p in me.polygons:p.use_smooth=True
    # A single equipment tray around the functional trolley pivot. All existing
    # pivot coordinates and the 5.2 m contact reach are retained for the game.
    box('Trolley_equipment_gasket',(0,3.43,-1.80),(.98,.025,2.42),charcoal,bevel=.035)
    box('Trolley_equipment_tray',(0,3.48,-1.80),(.94,.075,2.38),cream,bevel=.035)
    box('Pole_base_turntable',(0,3.55,-1.0),(.49,.10,.52),dark,bevel=.035)
    for side in (-1,1):
        for z in (-1.02,-2.70):
            cyl('Porcelain_roof_insulator',(side*.34,3.50,z),.065,.13,cream,vertices=16)
            for y in (3.46,3.50,3.54):cyl('Insulator_shed',(side*.34,y,z),.08,.014,cream,vertices=16)
        rod('Equipment_guard_rail',(side*.52,3.55,-2.93),(side*.52,3.55,-.62),.013,stainless)
        for z in (-2.93,-.62):rod('Equipment_guard_foot',(side*.52,3.43,z),(side*.52,3.55,z),.013,stainless)
        rod('Trolley_spring_guide',(side*.16,3.56,-1.20),(side*.16,3.56,-2.10),.013,dark)
        points=[]
        for i in range(65):
            a=i*math.tau*10/64;points.append((side*.16+.044*math.cos(a),3.57+.044*math.sin(a),-1.24-i*.72/64))
        curved_tube('Coiled_trolley_return_spring',points,.009,dark,sides=5)
    box('Trolley_control_cover',(0,3.55,-2.09),(.29,.13,.30),cream,bevel=.025)
    # A low louvred cabinet at the back of the tray replaces the repeated boxes.
    box('Roof_control_intake',(0,3.535,-2.42),(.82,.15,.29),vent_dark,bevel=.015)
    for i in range(12):box('Control_intake_louvre',(-.38+i*.069,3.62,-2.42),(.023,.018,.27),cream,bevel=.004)
    # Front half is mostly a smooth shell, a modest access hatch and seams.
    cyl('Roof_access_seal',(0,3.434,.45),.31,.014,charcoal,vertices=32)
    cyl('Roof_access_hatch',(0,3.447,.45),.293,.016,cream,vertices=32)
    box('Roof_hatch_handle',(0,3.465,.45),(.11,.024,.025),silver,bevel=.005)
    for side in (-1,1):
        for z in (-5.55,5.10):
            # Sloped shoulder grilles follow the roof, not vertical floating slabs.
            for k in range(24):
                zz=z-.76+k*.066
                rod('Roof_shoulder_vent', (side*1.03,roof_height(1.03,zz)+.007,zz),
                    (side*1.23,roof_height(1.23,zz)+.007,zz),.007,vent_dark)
        rod('Roof_drain',(side*1.255,3.10,-6.64),(side*1.255,3.10,6.61),.012,bumper_metal)
    for z in (-6.25,-3.0,.05,3.05,6.1):
        curved_tube('Roof_panel_joint',[(x,roof_height(x,z)+.003,z) for x in [-1.22+i*2.44/20 for i in range(21)]],.0022,silver,sides=5)
    root['roof_layout']='single trolley tray, rear anti-slip walkway, clear crowned front roof'
    # Raised cable clips and the protected conduit stay on the equipment side.
    curved_tube('Roof_power_conduit',[(.29,3.54,-2.16),(.35,3.55,-2.30),(.35,3.55,-2.65),(.28,3.52,-2.78)],.014,dark,sides=6)
    for z in (-2.66,-2.37):box('Conduit_retainer',(.35,3.56,z),(.06,.018,.024),silver,bevel=.003)
    for side in (-1,1):
        rod('Walkway_edge', (side*.89,roof_height(.89,-6.5)+.01,-6.5),(side*.89,roof_height(.89,-3.1)+.01,-3.1),.008,silver)
        for z in (-2.87,-.72):cyl('Equipment_tray_bolt',(side*.40,3.524,z),.014,.012,silver,vertices=8)

def build_cabin_fittings():
    # Cream roof panels and longitudinal recessed ventilation channels.
    for x in (-.44,.44):
        box('Ceiling_vent_recess',(x,3.112,-.10),(.038,.013,12.9),vent_dark,bevel=.004)
        for offset in (-.028,.028):rod('Ceiling_vent_edge',(x+offset,3.119,-6.55),(x+offset,3.119,6.35),.004,stainless)
    for z in (-6.55,-4.4,-2.25,-.1,2.05,4.2,6.35):
        curved_tube('Ceiling_panel_seam',[(x,3.126-.12*(x/1.17)**2,z) for x in [-1.15+i*2.3/20 for i in range(21)]],.003,laminate,sides=5)
        for x in (-1.05,-.62,0,.62,1.05):
            cyl('Ceiling_panel_fastener',(x,3.122-.12*(x/1.17)**2,z+.024),.006,.004,stainless,vertices=8)
    for side in (-1,1):
        for z in (-5.40,-2.10,1.20,4.5):
            box('Fluorescent_light_housing',(side*.84,3.035,z),(.137,.045,2.91),stainless,bevel=.012)
            box('Fluorescent_light_diffuser',(side*.84,3.005,z),(.101,.019,2.84),warm,bevel=.008)
            for zz in (z-1.44,z+1.44):box('Light_fixture_end_cap',(side*.84,3.008,zz),(.136,.038,.032),ceiling_mat,bevel=.006)
        # Swept upper wall coves, with original illustrated transit cards.
        for z in (-5.5,-3.95,-1.1,.45,2.,3.55):
            if side==1 and abs(z+2.68)<.9:continue
            verts=[(side*1.17,2.95,z-.65),(side*1.17,2.95,z+.65),(side*.90,3.043,z+.65),(side*.90,3.043,z-.65)]
            card=panel('Interior_advert_card',verts,atlas,uv=[(0/2048,1-980/1024),(1180/2048,1-980/1024),(1180/2048,1-710/1024),(0/2048,1-710/1024)])
            if side==-1:
                for uv in card.data.uv_layers.active.data:uv.uv.x=1180/2048-uv.uv.x
        curved_tube('Advert_lower_rail',[(side*1.17,2.945,-6.60),(side*1.17,2.945,6.35)],.010,stainless)
        curved_tube('Advert_upper_rail',[(side*.90,3.045,-6.60),(side*.90,3.045,6.35)],.009,stainless)
        for z in (-4.73,-1.05,1.71,3.55):
            if side==1 and abs(z+2.68)<.9:continue
            points=[(side*.29,1.11,z),(side*.29,2.68,z),(side*.30,2.77,z),
                    (side*.34,2.84,z),(side*.42,2.94,z),(side*.49,3.04,z)]
            curved_tube('Swept_stainless_stanchion',points,.018,stainless)
            for y in (1.12,2.73):cyl('Stanchion_collar',(side*.29,y,z),.023,.025,stainless,vertices=12)
            cyl('Stanchion_floor_socket',(side*.29,1.111,z),.043,.014,stainless,vertices=12)
        rod('Overhead_saloon_rail',(side*.49,3.005,-6.6),(side*.49,3.005,5.05),.017,stainless)
    # Dark wood entrance baffles and stainless caps seen around the rear steps.
    for z in (-3.57,-1.81):
        box('Rear_door_partition',(.88,1.70,z),(.58,1.17,.052),laminate,bevel=.018)
        rod('Partition_aisle_edge',(.585,1.12,z),(.585,2.30,z),.015,stainless)
        rod('Partition_top_edge',(.59,2.30,z),(1.17,2.30,z),.015,stainless)
    # Driver equipment cabinet and farebox occupy the front standing area.
    box('Driver_red_equipment_cabinet',(-.78,1.76,5.18),(.68,1.28,.30),red,bevel=.025)
    for y in (1.25,1.30,1.35,1.40):box('Driver_cabinet_louvre',(-.78,y,5.022),(.47,.012,.009),charcoal,bevel=.002)
    box('Driver_cabinet_latch',(-.52,1.90,5.015),(.025,.09,.012),chrome,bevel=.005)
    box('Farebox_pedestal',(.18,1.47,5.10),(.22,.70,.26),dark,bevel=.025)
    box('Farebox_head',(.18,1.91,5.10),(.29,.24,.35),dark,bevel=.025)
    box('Farebox_coin_plate',(.18,2.04,5.10),(.24,.023,.27),stainless,bevel=.01)
    box('Farebox_coin_slot',(.18,2.055,5.12),(.10,.004,.012),charcoal,bevel=.003)

def audit_seat_clearance():
    """Test the actual pre-batch triangles, not just seat-centre distances."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    wood=[o for o in bpy.data.objects if o.type=='MESH' and o.active_material==laminate]
    seats=[o for o in bpy.data.objects if o.type=='MESH' and o.get('seat_clearance_part')]
    def bounds(o):
        pts=[o.matrix_world@Vector(v) for v in o.bound_box]
        return [(min(p[k] for p in pts),max(p[k] for p in pts)) for k in range(3)]
    cache={};clashes=[]
    def tree(o):
        if o not in cache:
            me=o.evaluated_get(deps).to_mesh()
            cache[o]=BVHTree.FromPolygons([o.matrix_world@v.co for v in me.vertices],[p.vertices[:] for p in me.polygons])
            o.evaluated_get(deps).to_mesh_clear()
        return cache[o]
    for s in seats:
        a=bounds(s)
        for w in wood:
            b=bounds(w)
            if all(a[k][1]>b[k][0] and b[k][1]>a[k][0] for k in range(3)) and tree(s).overlap(tree(w)):clashes.append((s.name,w.name))
    report={'pass':not clashes,'seat_parts':len(seats),'wood_panels':len(wood),'triangle_intersections':clashes,'rear_seat_rise_m':0,'side_seat_centre_m':.855}
    (P/'streetcar-review').mkdir(parents=True,exist_ok=True)
    (P/'streetcar-review'/'clearance.json').write_text(json.dumps(report,indent=2)+'\n')
    assert not clashes, 'Seat/wood intersections: '+str(clashes)
    print('SEAT_CLEARANCE_VALIDATED',json.dumps(report),flush=True)

PUBLIC_REFINEMENTS=['build_curved_rear','formed_seat','build_rear_lounge','build_reference_roof','build_cabin_fittings','audit_seat_clearance','stainless']
