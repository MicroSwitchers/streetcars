"""Analytic crown normals avoid highlights wavering with cross-section spacing."""
from mathutils import Vector

STATIONS=[(-7.65,.98),(-7.58,1.01),(-7.42,1.11),(-7.18,1.20),(-6.75,1.27)]
STATIONS += [(z,1.27) for z in (-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,6.65)]
STATIONS += [(7.05,1.22),(7.26,1.13),(7.48,.99),(7.65,.98)]

def crown_normal(x,z):
    dx=-.23*x/(1.27*1.27)
    dz=-.018/1.05*(1 if z>0 else -1) if abs(z)>6.6 else 0.
    return Vector((-dx,dz,1)).normalized()

def smooth_crown(obj,vertex_indices=None):
    mesh=obj.data
    # Keep every existing manufactured normal on the rest of a merged mesh.
    normals=[n.vector.copy() for n in mesh.corner_normals]
    transform=obj.matrix_world
    to_local=transform.to_3x3().transposed()
    for face in mesh.polygons:
        if vertex_indices is not None and not all(v in vertex_indices for v in face.vertices):continue
        for li in face.loop_indices:
            point=transform@mesh.vertices[mesh.loops[li].vertex_index].co
            x,z,height=point.x,-point.y,point.z
            width=min(STATIONS,key=lambda p:abs(p[0]-z))[1]
            expected=3.315+.115*(1-(x/1.27)**2)-.018*max(0,(abs(z)-6.6)/1.05)
            if abs(height-expected)<.0001 and face.use_smooth:
                normals[li]=(to_local@crown_normal(x,z)).normalized()
    mesh.normals_split_custom_set(normals)
