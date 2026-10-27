"""Small, reusable facade reliefs. Local +Z faces out; sizes are in metres."""

def build(c):
    root, box, cyl, profile, mesh = (c[k] for k in ('root','box','cyl','profile','mesh'))
    stone, edge, iron, terra, dark = (c[k] for k in ('stone','edge','iron','terra','dark'))
    p=root('flathead')
    profile('Drip moulding',[(-.10,.015),(-.10,.15),(-.045,.15),(-.015,.23),(.065,.23),(.065,.19),(.13,.19),(.13,.015)],1,stone,p)
    for x in [-.49,.49]:box('Head console',(x,-.16,.095),(.08,.14,.15),stone,p,0)

    p=root('spandrel')
    box('Recessed terracotta field',(0,0,.035),(.94,.40,.07),terra,p,0)
    for x in [-.48,.48]:box('Panel stile',(x,0,.075),(.055,.48,.15),stone,p,0)
    for y in [-.215,.215]:box('Panel rail',(0,y,.075),(.92,.05,.15),stone,p,0)
    mesh('Raised lozenge',[(-.12,0,.075),(0,.12,.075),(.12,0,.075),(0,-.12,.075),(0,0,.13)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],stone,p)

    p=root('frieze')
    box('Shadowed frieze field',(0,0,.028),(.98,.40,.055),terra,p,0)
    for y in [-.22,.22]:box('Frieze border',(0,y,.08),(1,.055,.16),terra,p,0)
    for x in [-.44,0,.44]:box('Recess divider',(x,0,.07),(.055,.38,.14),terra,p,0)

    p=root('wallvent')
    box('Louvre shadow',(0,0,.025),(.46,.40,.05),iron,p,0)
    for x in [-.25,.25]:box('Vent frame',(x,0,.06),(.04,.48,.12),iron,p,0)
    for y in [-.22,.22]:box('Vent frame',(0,y,.06),(.48,.04,.12),iron,p,0)
    for j in range(5):box('Angled weather louvre',(0,-.16+j*.08,.09),(.43,.024,.12),iron,p,0)

    p=root('downpipe')
    cyl('Cast rainwater pipe',(0,1.4,.12),.034,2.8,iron,p,vertices=8)
    for y in [.34,2.40]:
        cyl('Pipe collar',(0,y,.12),.045,.07,iron,p,vertices=8)
        box('Wall stand off',(0,y,.055),(.11,.075,.11),iron,p,0)

    p=root('pilaster')
    box('Recessed pier',(0,0,.04),(.28,1,.08),stone,p,0)
    for x in [-.125,.125]:box('Pier edge',(x,0,.075),(.035,1,.15),stone,p,0)

    p=root('stringcourse')
    profile('Weathered stone belt',[(-.08,.005),(-.08,.13),(-.02,.13),(.015,.19),(.075,.19),(.075,.005)],1,stone,p)
