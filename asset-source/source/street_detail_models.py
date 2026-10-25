"""Small original street fittings, in metres. Shared kit materials, no textures."""
import bpy, math


def build(api):
    root, box, cyl, tube, text, finish, V = [api[k] for k in ('root','box','cyl','tube','text','finish','V')]
    iron, zinc, black, cream, paper, blue, red = [api[k] for k in ('iron','zinc','black','cream','paper','blue','red')]

    p = root('utilitycabinet')
    box('Precast equipment plinth',(0,.08,0),(.86,.16,.59),api['stone'],p,.025)
    box('Folded steel cabinet',(0,.78,0),(.76,1.25,.48),iron,p,.018)
    box('Rain shedding cap',(0,1.43,0),(.82,.075,.55),iron,p,.012)
    box('Inset door shadow',(0,.79,.247),(.66,1.12,.012),black,p,.005)
    box('Service door',(0,.79,.258),(.637,1.095,.018),iron,p,.009)
    for y in [.27,1.19]:
        cyl('Door hinge',(-.334,y,.259),.012,.11,zinc,p,vertices=8)
    box('Recessed latch',(.24,.75,.273),(.045,.13,.012),black,p,.006)
    cyl('Cabinet lock',(.24,.77,.285),.014,.008,zinc,p,(0,0,1),8)
    for y in [.40+i*.038 for i in range(7)]+[1.03+i*.038 for i in range(5)]:
        box('Ventilation slit',(0,y,.272),(.39,.014,.008),black,p,0)
        box('Louver lip',(0,y+.009,.278),(.41,.009,.018),iron,p,0)
    box('Service identification plate',(-.17,.78,.278),(.14,.085,.008),zinc,p,.004)
    for x in [-.32,.32]:
        for z in [-.19,.19]:cyl('Plinth anchor',(x,.17,z),.018,.025,zinc,p,vertices=6)

    p = root('newsbox')
    for x in [-.20,.20]:
        box('Dispenser foot',(x,.035,0),(.11,.07,.44),iron,p,.009)
        box('Support leg',(x,.20,0),(.065,.32,.31),blue,p,.009)
    box('Newspaper dispenser',(0,.72,0),(.56,.82,.41),blue,p,.025)
    box('Rounded overhanging hood',(0,1.17,.012),(.62,.10,.48),blue,p,.035)
    box('Front door surround',(0,.76,.218),(.48,.61,.025),zinc,p,.009)
    box('Dark recessed display',(0,.82,.236),(.40,.40,.012),black,p,.008)
    box('Visible newspaper',(0,.83,.245),(.34,.32,.006),paper,p,0)
    text('LOCAL',(0,.938,.251),.060,iron,p)
    box('Newspaper photo',(-.075,.84,.251),(.13,.095,.002),blue,p,0)
    for y in [.74,.761,.782,.803,.824,.845,.866]:
        box('Printed column',(.077,y,.251),(.13,.004,.002),iron,p,0)
    for y in [.708,.724]:box('Printed baseline',(0,y,.251),(.28,.004,.002),iron,p,0)
    box('Pickup opening',(0,.51,.241),(.38,.075,.013),black,p,.006)
    tube('Folded door handle',[(-.13,.60,.255),(-.13,.60,.29),(.13,.60,.29),(.13,.60,.255)],.011,zinc,p,8)
    for y in [.56,1.0]:cyl('Dispenser hinge',(-.25,y,.24),.012,.08,zinc,p,vertices=8)

    p = root('bikestand')
    cyl('Embedded post',(0,.51,0),.032,1.02,zinc,p,vertices=12)
    cyl('Post cap',(0,1.025,0),.038,.025,zinc,p,vertices=12)
    cyl('Mounting flange',(0,.022,0),.115,.044,zinc,p,vertices=16)
    for j in range(4):
        a=j*math.tau/4;cyl('Flange anchor',(.080*math.cos(a),.053,.080*math.sin(a)),.013,.020,iron,p,vertices=6)
    bpy.ops.mesh.primitive_torus_add(major_radius=.245,minor_radius=.021,major_segments=24,minor_segments=6,location=V((0,.82,0)))
    o=bpy.context.object;o.rotation_euler.x=math.pi/2;finish(o,'Cast bicycle locking ring',zinc,p)
    for face in o.data.polygons:face.use_smooth=True
    box('Ring central boss',(0,.82,.012),(.13,.11,.035),zinc,p,.012)
    box('Inlaid ring marker',(0,.82,.035),(.075,.035,.003),iron,p,0)

    p = root('treegrate')
    for edge in [-1,1]:
        box('Grate outer frame X',(0,.018,edge*.65),(1.34,.036,.04),iron,p,0)
        box('Grate outer frame Z',(edge*.65,.018,0),(.04,.036,1.26),iron,p,0)
        box('Trunk opening X',(0,.018,edge*.20),(.43,.036,.032),iron,p,0)
        box('Trunk opening Z',(edge*.20,.018,0),(.032,.036,.37),iron,p,0)
    for j in range(-6,7):
        z=j*.092
        if abs(z)<.22:
            for edge in [-1,1]:box('Split grate bar',(edge*.43,.015,z),(.40,.03,.028),iron,p,0)
        else:box('Grate bar',(0,.015,z),(1.26,.03,.028),iron,p,0)
    for x in [-.42,.42]:box('Cross brace',(x,.008,0),(.025,.016,1.25),iron,p,0)
    for x in [-.59,.59]:
        for z in [-.59,.59]:cyl('Grate fixing',(x,.040,z),.013,.008,zinc,p,vertices=6)

    p = root('stormdrain')
    box('Recessed drain well',(0,.006,0),(.40,.012,.74),black,p,0)
    for edge in [-1,1]:
        box('Cast drain frame',(edge*.19,.021,0),(.035,.028,.74),iron,p,0)
        box('Cast drain frame',(0,.021,edge*.35),(.35,.028,.04),iron,p,0)
    for j in range(-4,5):box('Slotted drain bar',(0,.026,j*.073),(.35,.027,.023),iron,p,0)
    for z in [-.30,.30]:cyl('Drain fixing',(.19,.039,z),.012,.007,zinc,p,vertices=6)
