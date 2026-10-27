"""Closed two-storey corner shop, plus inexpensive facade accents."""
import math

def build(c):
    root,box,mesh,cyl,material=(c[k] for k in ('root','box','mesh','cyl','material'))
    profile=c['profile']
    stone,paint,iron,glass,terra,dark=(c[k] for k in ('stone','paint','iron','glass','terra','dark'))
    brick=material('BlockBrick',(.46,.23,.16),.95)
    shopglass=material('ShopGlass',(.55,.65,.65),.18,.08)
    shopglass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.18
    shopglass.surface_render_method='DITHERED'
    room=material('BlockInterior',(.45,.38,.28),.92)
    p=root('cornerblock');corner=p

    def wall(width,holes,point):
        levels=sorted(set([.0,7.4]+[v for h in holes for v in (h[1]-h[3]/2,h[1]+h[3]/2)]))
        rects=[];last={}
        for lo,hi in zip(levels,levels[1:]):
            middle=(lo+hi)/2;edge=-width/2
            blocked=sorted((u-w/2,u+w/2) for u,y,w,h,g in holes if y-h/2<middle<y+h/2)
            for a,b in blocked+[(width/2,width/2)]:
                if a>edge:
                    key=(edge,a);old=last.get(key)
                    if old is not None and abs(rects[old][3]-lo)<.0001:rects[old][3]=hi
                    else:last[key]=len(rects);rects.append([edge,a,lo,hi])
                edge=max(edge,b)
        for l,r,b,t in rects:mesh('Corner masonry panel',[point(l,b,0),point(r,b,0),point(r,t,0),point(l,t,0)],[(0,1,2,3)],brick,p)
        for u,y,w,h,g in holes:
            outer=[(u-w/2,y-h/2),(u+w/2,y-h/2),(u+w/2,y+h/2),(u-w/2,y+h/2)]
            inner=[(u+(a-u)*.94,y+(b-y)*.96) for a,b in outer]
            for i in range(4):
                j=(i+1)%4
                mesh('Deep stone jamb',[point(*outer[i],0),point(*outer[j],0),point(*inner[j],.235),point(*inner[i],.235)],[(0,1,2,3)],stone,p)
            mesh('Recessed corner glazing',[point(a,b,.23) for a,b in inner],[(0,1,2,3)],g,p)
            if g==glass:
                # Thin actual sash strips, no overlapping duplicate glazing.
                for a,b,ww,hh in [(u,y,.045,h*.95),(u,y,w*.94,.045)]:
                    mesh('Corner sash',[point(a-ww/2,b-hh/2,.215),point(a+ww/2,b-hh/2,.215),point(a+ww/2,b+hh/2,.215),point(a-ww/2,b+hh/2,.215)],[(0,1,2,3)],paint,p)

    wall(6,[(-.85,1.63,3.45,2.48,shopglass),(2.07,1.57,1.08,2.46,shopglass)]+[(u,5.25,1.42,2.08,glass) for u in [-1.5,1.5]],lambda u,y,d:(u,y,-d))
    for side in [-1,1]:wall(12.9,[(u,5.25,1.65,2.08,glass) for u in [-3.8,3.8]],lambda u,y,d,s=side:(s*(3-d),y,-6.45-s*u))
    mesh('Closed rear wall',[(-3,0,-12.9),(-3,7.4,-12.9),(3,7.4,-12.9),(3,0,-12.9)],[(0,1,2,3)],brick,p)
    box('Corner roof',(0,7.43,-6.45),(6.0,.16,12.9),c['slate'],p,0)
    for z in [-.055,-12.845]:box('Front and rear coping',(0,7.57,z),(6.0,.12,.22),stone,p,0)
    for x in [-2.94,2.94]:box('Returned roof coping',(x,7.57,-6.45),(.12,.12,12.57),stone,p,0)
    for u in [-1.5,1.5]:
        head=profile('Profiled corner window hood',[(-.07,.005),(-.07,.13),(.015,.13),(.06,.22),(.12,.22),(.12,.005)],1.68,stone,p)
        head.location=c['V']((u,6.37,0))
        box('Projecting corner sill',(u,4.15,.06),(1.68,.11,.25),stone,p,0)
    box('Shop fascia',(0,3.33,.08),(5.84,.48,.16),paint,p,0)
    box('Fascia cap',(0,3.63,.11),(6.05,.10,.25),stone,p,0)
    box('Timber stall riser',(-.85,.33,.07),(3.56,.24,.14),paint,p,0)
    box('Shop floor',(-.85,.29,-1.28),(3.50,.08,2.4),room,p,0)
    box('Shop interior back',(-.85,1.62,-2.5),(3.50,2.65,.08),room,p,0)
    for x in [-2.56,.88]:box('Interior returned wall',(x,1.62,-1.3),(.08,2.65,2.4),room,p,0)
    for y in [.75,1.35,1.95]:box('Display shelf',(-.85,y,-2.22),(3.18,.055,.36),paint,p,0)
    for j in range(6):box('Display parcel',(-2.08+j*.49,1.58 if j%2 else 1.0,-2.19),(.30,.38,.25),terra if j%2 else stone,p,0)
    box('Recessed door', (2.07,1.57,-.28),(1.0,2.4,.06),paint,p,0)
    box('Door glazing',(2.07,1.91,-.24),(.77,1.35,.015),glass,p,0)
    box('Door pull',(2.41,1.40,-.17),(.035,.30,.08),iron,p,0)

    p=root('roundel')
    cyl('Terracotta roundel',(0,0,.065),.25,.13,terra,p,(0,0,1),12)
    cyl('Inset dark medallion',(0,0,.135),.18,.012,dark,p,(0,0,1),12)
    for j in range(4):
        a=j*math.pi/2
        box('Medallion stone stud',(.14*math.sin(a),.14*math.cos(a),.15),(.055,.055,.04),stone,p,0)

    for source in list(p.children):
        ornament=source.copy();ornament.data=source.data.copy();c['bpy'].context.collection.objects.link(ornament);ornament.parent=corner
        ornament.location+=c['V']((0,5.28,.025))

    p=root('shutters')
    for side in [-1,1]:
        x=side*.69
        box('Shutter backing',(x,0,.035),(.25,2.0,.07),paint,p,0)
        for y in [-.94,0,.94]:box('Shutter raised rail',(x,y,.085),(.27,.055,.10),paint,p,0)
        for off in [-.105,.105]:box('Shutter stile',(x+off,0,.08),(.04,2.0,.09),paint,p,0)
