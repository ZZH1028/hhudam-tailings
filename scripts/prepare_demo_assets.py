"""Regenerate the schematic scenes, synthetic flood data, and converter download."""
import json
import math
import struct
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend/public"


def make_glb(path,bed,g,with_dam=True):
    positions=[];indices=[];colors=[]
    def tri(a,b,c,color):
        k=len(positions);positions.extend([a,b,c]);indices.extend([k,k+1,k+2]);colors.extend([color]*3)
    def pt(i,j):
        # glTF uses Y up; Cesium rotates it into the local ENU Z-up frame.
        return [g['x0']+i*g['dx'],bed[j*g['nx']+i],-(g['y0']+j*g['dy'])]
    for j in range(g['ny']-1):
        for i in range(g['nx']-1):
            col=[.21,.32,.25] if abs(g['y0']+j*g['dy'])>160 else [.39,.43,.34]
            a,b,c,d=pt(i,j),pt(i+1,j),pt(i,j+1),pt(i+1,j+1)
            tri(a,c,b,col);tri(b,c,d,col)
    def box(x0,x1,y0,y1,z0,z1,color):
        p=[[x0,z0,-y0],[x1,z0,-y0],[x1,z0,-y1],[x0,z0,-y1],[x0,z1,-y0],[x1,z1,-y0],[x1,z1,-y1],[x0,z1,-y1]]
        for f in [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(0,3,2,1)]:tri(p[f[0]],p[f[1]],p[f[2]],color);tri(p[f[0]],p[f[2]],p[f[3]],color)
    if with_dam:
        box(-10,10,-280,-65,0,11,[.62,.65,.65]);box(-10,10,65,280,0,11,[.62,.65,.65])
        for y in [-260,-210,-160,-110,110,160,210,260]:box(-14,14,y-2,y+2,11,12.5,[.30,.46,.53])
    pdata=b''.join(struct.pack('<3f',*p) for p in positions)
    cdata=b''.join(struct.pack('<3f',*c) for c in colors)
    idata=struct.pack('<'+'I'*len(indices),*indices)
    blob=pdata+cdata+idata
    mins=[min(p[a] for p in positions) for a in range(3)];maxs=[max(p[a] for p in positions) for a in range(3)]
    gltf={'asset':{'version':'2.0','generator':'Tailings platform schematic geometry'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'COLOR_0':1},'indices':2,'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.9},'doubleSided':True}],'buffers':[{'byteLength':len(blob)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(pdata),'target':34962},{'buffer':0,'byteOffset':len(pdata),'byteLength':len(cdata),'target':34962},{'buffer':0,'byteOffset':len(pdata)+len(cdata),'byteLength':len(idata),'target':34963}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(positions),'type':'VEC3','min':mins,'max':maxs},{'bufferView':1,'componentType':5126,'count':len(colors),'type':'VEC3'},{'bufferView':2,'componentType':5125,'count':len(indices),'type':'SCALAR'}]}
    js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4)
    out=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
    path.write_bytes(out)

def generate():
    (PUBLIC / "data").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "models").mkdir(parents=True, exist_ok=True)
    origin={'longitude':118.754,'latitude':32.045,'height':0}
    g={'nx':66,'ny':34,'x0':-220.,'y0':-330.,'dx':20.,'dy':20.}
    bed=[round(max(0,(abs(g['y0']+j*g['dy'])-160)*.12),3) for j in range(g['ny']) for i in range(g['nx'])]
    frames=[];h0=5.;gravity=9.81;c0=math.sqrt(gravity*h0)
    for t in range(0,121,2):
        dep=[]
        for j in range(g['ny']):
            for i in range(g['nx']):
                x=g['x0']+i*g['dx'];b=bed[j*g['nx']+i]
                if b>0:h=0
                elif t==0:h=h0 if x<0 else 0
                elif x/t<=-c0:h=h0
                elif x/t>=2*c0:h=0
                else:h=((2*c0-x/t)/3)**2/gravity
                dep.append(round(h,4))
        frames.append({'time':t,'depth':dep})
    dataset={'version':1,'name':'理想矩形河槽瞬时溃坝示例','source_type':'demonstration','method':'Ritter一维干床理想解的可视化示例，非OpenFOAM结果；不代表上传工程的计算预测','origin':origin,'yaw':0,'vertical_datum':'示例局部高程','grid':g,'bed':bed,'valid':[True]*len(bed),'frames':frames}
    (PUBLIC/'data/flood_demo.json').write_text(json.dumps(dataset,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    make_glb(PUBLIC/'models/dam_schematic.glb',bed,g,True)
    make_glb(PUBLIC/'models/terrain_schematic.glb',bed,g,False)

    with ZipFile(PUBLIC / "openfoam_converter.zip", "w", ZIP_DEFLATED) as archive:
        for file in sorted((ROOT / "converter").iterdir()):
            if file.is_file():
                archive.write(file, file.name)


if __name__ == "__main__":
    generate()
