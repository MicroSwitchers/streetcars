"""Remove unused vertex streams and preserve Blender's colour x vertex-tint material.

Uses plain glTF buffers, no decoder extension. Does not modify geometry or animation.
"""
import json,struct
from pathlib import Path

def optimize(path,base_colors=None):
    path=Path(path);data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length]);offset=20+length
    bin_length=struct.unpack_from('<I',data,offset)[0];binary=data[offset+8:offset+8+bin_length]
    for mat in doc['materials']:
        if base_colors and mat['name'] in base_colors:
            mat.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=list(base_colors[mat['name']])
    def textured(value):
        if isinstance(value,dict):return any('Texture' in k or textured(v) for k,v in value.items())
        if isinstance(value,list):return any(textured(v) for v in value)
        return False
    refs=[]
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            assert not primitive.get('targets'),'Morph targets need explicit handling'
            mat=doc['materials'][primitive['material']]
            if 'normalTexture' not in mat:primitive['attributes'].pop('TANGENT',None)
            if not textured(mat):
                for key in list(primitive['attributes']):
                    if key.startswith('TEXCOORD_'):primitive['attributes'].pop(key)
            refs.extend((primitive['attributes'],key) for key in primitive['attributes'])
            if 'indices' in primitive:refs.append((primitive,'indices'))
    assert not doc.get('skins'),'Skins need explicit handling'
    for animation in doc.get('animations',[]):
        for sampler in animation['samplers']:refs.extend([(sampler,'input'),(sampler,'output')])
    used=sorted({obj[key] for obj,key in refs});mapping={old:new for new,old in enumerate(used)}
    doc['accessors']=[doc['accessors'][i] for i in used]
    for obj,key in refs:obj[key]=mapping[obj[key]]
    view_refs=[]
    for accessor in doc['accessors']:
        assert 'sparse' not in accessor,'Sparse accessors need explicit handling'
        if 'bufferView' in accessor:view_refs.append((accessor,'bufferView'))
    for image in doc.get('images',[]):
        if 'bufferView' in image:view_refs.append((image,'bufferView'))
    used=sorted({obj[key] for obj,key in view_refs});mapping={old:new for new,old in enumerate(used)}
    new_binary=bytearray();views=[]
    for old in used:
        view=doc['bufferViews'][old].copy();assert view['buffer']==0
        new_binary.extend(b'\x00'*((-len(new_binary))%4));start=view.get('byteOffset',0)
        new_offset=len(new_binary);new_binary.extend(binary[start:start+view['byteLength']]);view['byteOffset']=new_offset;views.append(view)
    for obj,key in view_refs:obj[key]=mapping[obj[key]]
    doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(new_binary)}]
    new_binary.extend(b'\x00'*((-len(new_binary))%4))
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(new_binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new_binary),0x004e4942)+new_binary
    path.write_bytes(output);return {'before':len(data),'after':len(output)}

if __name__=='__main__':
    import sys
    print(optimize(sys.argv[1],json.loads(Path(sys.argv[2]).read_text()) if len(sys.argv)>2 else None))
