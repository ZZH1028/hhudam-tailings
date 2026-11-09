"""Read OpenFOAM / PVD / VTU / legacy VTK and rasterize explicitly defined depths.

For 3D VOF, sum alpha.water * cell volume over horizontal bins. This is
volume-equivalent column depth at the selected resolution, not cell pressure,
z-coordinate or a solver-provided free-surface elevation.
"""
from __future__ import annotations
import json,math,re,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
from flood import validate_dataset,safe_extract

def vtk_modules():
    try:
        import vtk
        return vtk
    except ImportError as e:
        raise ValueError('此格式需要VTK扩展。请先运行“安装OpenFOAM导入扩展.bat”，或在终端运行 python -m pip install vtk numpy；JSON和规则CSV导入不需要此扩展。') from e

def datasets(obj,vtk):
    if isinstance(obj,vtk.vtkDataSet):
        yield obj
    elif isinstance(obj,vtk.vtkMultiBlockDataSet):
        selected=[]
        for i in range(obj.GetNumberOfBlocks()):
            b=obj.GetBlock(i)
            if b is None:continue
            meta=obj.GetMetaData(i);name=meta.Get(vtk.vtkCompositeDataSet.NAME()) if meta else ''
            selected.append((name or '',b))
        internal=[b for n,b in selected if 'internal' in n.lower()]
        for b in (internal or [b for n,b in selected]):yield from datasets(b,vtk)
    elif hasattr(obj,'NewIterator'):
        it=obj.NewIterator();it.InitTraversal()
        while not it.IsDoneWithTraversal():
            yield from datasets(it.GetCurrentDataObject(),vtk);it.GoToNextItem()

def read_mesh(path,vtk):
    suffix=path.suffix.lower()
    if suffix=='.vtu':reader=vtk.vtkXMLUnstructuredGridReader()
    elif suffix=='.vtp':reader=vtk.vtkXMLPolyDataReader()
    elif suffix=='.vti':reader=vtk.vtkXMLImageDataReader()
    elif suffix=='.vts':reader=vtk.vtkXMLStructuredGridReader()
    elif suffix=='.vtm':reader=vtk.vtkXMLMultiBlockDataReader()
    elif suffix=='.vtk':reader=vtk.vtkGenericDataObjectReader()
    else:raise ValueError('支持VTK、VTU、VTP、VTI、VTS、VTM、PVD或完整OpenFOAM算例ZIP')
    reader.SetFileName(str(path));reader.Update();out=reader.GetOutputDataObject(0)
    meshes=list(datasets(out,vtk))
    if not meshes or all(m.GetNumberOfPoints()==0 for m in meshes):raise ValueError('文件不含可读网格')
    return meshes

def case_frames(path,vtk):
    marker=path
    if path.is_dir():
        # reconstructed mesh only; processors must be reconstructed first.
        roots=[path]+[p.parent.parent for p in path.rglob('controlDict') if p.parent.name=='system']
        root=next((p for p in roots if (p/'constant/polyMesh').is_dir()),None)
        if not root:raise ValueError('ZIP中未找到constant/polyMesh。请上传完整、已重构的OpenFOAM算例，或PVD/VTU结果ZIP。')
        marker=root/'platform_reader.foam';marker.touch(exist_ok=True)
    elif not (path.parent/'constant/polyMesh').is_dir():raise ValueError('.foam是算例标记，必须同时保留constant/polyMesh与时间目录；请压缩完整算例导入。')
    reader=vtk.vtkOpenFOAMReader();reader.SetFileName(str(marker));reader.SetCreateCellToPoint(False)
    reader.SetSkipZeroTime(False)
    reader.UpdateInformation()
    for i in range(reader.GetNumberOfPatchArrays()):
        name=reader.GetPatchArrayName(i)
        reader.SetPatchArrayStatus(name,int('internal' in name.lower()))
    reader.EnableAllCellArrays()
    values=reader.GetTimeValues()
    times=[values.GetValue(i) for i in range(values.GetNumberOfTuples())] if values else [0.]
    if len(times)>2000:raise ValueError('超过2000个时间步，请先选取时间范围导出')
    for t in times:
        reader.UpdateTimeStep(t);obj=reader.GetOutputDataObject(0)
        meshes=[m.NewInstance() for m in datasets(obj,vtk)]
        source=list(datasets(obj,vtk))
        for a,b in zip(meshes,source):a.DeepCopy(b)
        yield float(t),meshes

def file_frames(path,vtk):
    if path.suffix.lower()=='.foam' or path.is_dir():yield from case_frames(path,vtk);return
    if path.suffix.lower()=='.pvd':
        root=path.parent.resolve();tree=ET.parse(path)
        grouped={}
        for e in tree.iter('DataSet'):
            p=(root/e.attrib['file'].replace('\\','/')).resolve()
            if not p.is_relative_to(root):raise ValueError('PVD文件引用了压缩包之外的路径')
            grouped.setdefault(float(e.attrib.get('timestep',0)),[]).append(p)
        for t,paths in sorted(grouped.items()):
            meshes=[]
            for p in paths:meshes.extend(read_mesh(p,vtk))
            yield t,meshes
    else:yield 0.,read_mesh(path,vtk)

def cells_for(mesh,vtk):
    mesh.ComputeBounds();cd=mesh.GetCellData()
    alpha=next((cd.GetArray(s) for s in ['alpha.water','alpha1','alpha_water','alpha.liquid'] if cd.GetArray(s) is not None),None)
    depth=next((cd.GetArray(s) for s in ['depth','h','waterDepth','water_depth'] if cd.GetArray(s) is not None),None)
    if alpha is None and depth is None:
        pd=mesh.GetPointData()
        available=[pd.GetArrayName(i) for i in range(pd.GetNumberOfArrays())]
        if any(s in available for s in ['alpha.water','alpha1','depth','h','waterDepth','water_depth']):
            f=vtk.vtkPointDataToCellData();f.SetInputData(mesh);f.PassPointDataOn();f.Update();mesh=f.GetOutput();cd=mesh.GetCellData()
            alpha=next((cd.GetArray(s) for s in ['alpha.water','alpha1','alpha_water'] if cd.GetArray(s) is not None),None)
            depth=next((cd.GetArray(s) for s in ['depth','h','waterDepth','water_depth'] if cd.GetArray(s) is not None),None)
    if alpha is None and depth is None:raise ValueError('网格没有alpha.water/alpha1体积分数，也没有depth/h水深字段；不能从压力或z坐标推测水深。')
    size=vtk.vtkCellSizeFilter();size.SetInputData(mesh);size.ComputeVolumeOn();size.Update();vol=size.GetOutput().GetCellData().GetArray('Volume')
    for i in range(mesh.GetNumberOfCells()):
        cell=mesh.GetCell(i);bounds=cell.GetBounds();x0,x1,y0,y1,z0,z1=bounds
        if not all(math.isfinite(v) for v in bounds):continue
        area=(x1-x0)*(y1-y0)
        if area<=1e-12:continue
        if alpha is not None:
            v=vol.GetTuple1(i) if vol is not None else 0
            if v<=0:continue
            a=alpha.GetTuple1(i)
            if not math.isfinite(a) or a<-.001 or a>1.001:raise ValueError('体积分数超出0—1范围')
            yield bounds,max(0,min(1,a))*v,'volume'
        else:
            h=depth.GetTuple1(i)
            if not math.isfinite(h) or h<0:raise ValueError('网格水深包含非有限值或负值')
            yield bounds,h,'depth'

def rasterize(records,bounds,nx,ny):
    xmin,xmax,ymin,ymax=bounds;dx=(xmax-xmin)/nx;dy=(ymax-ymin)/ny
    if dx<=0 or dy<=0:raise ValueError('计算域的平面范围必须非零')
    size=nx*ny;water=[0.]*size;weights=[0.]*size;beds=[float('inf')]*size;valid=[False]*size;method=None
    for b,value,kind in records:
        x0,x1,y0,y1,z0,z1=b;area=(x1-x0)*(y1-y0)
        ia=max(0,int((x0-xmin)/dx));ib=min(nx-1,int(math.ceil((x1-xmin)/dx)-1))
        ja=max(0,int((y0-ymin)/dy));jb=min(ny-1,int(math.ceil((y1-ymin)/dy)-1))
        for j in range(ja,jb+1):
            hy=max(0,min(y1,ymin+(j+1)*dy)-max(y0,ymin+j*dy))
            for i in range(ia,ib+1):
                hx=max(0,min(x1,xmin+(i+1)*dx)-max(x0,xmin+i*dx));over=hx*hy
                if over<=0:continue
                k=j*nx+i;valid[k]=True;beds[k]=min(beds[k],z0)
                if kind=='volume':water[k]+=value*over/area
                else:water[k]+=value*over;weights[k]+=over
                if method and method!=kind:raise ValueError('同一数据集不能混合水深与体积分数字段')
                method=kind
    if not method:raise ValueError('没有可以投影的有效体单元或水深单元')
    depth=[water[k]/(dx*dy if method=='volume' else weights[k]) if valid[k] else 0 for k in range(size)]
    bed=[beds[k] if valid[k] else 0 for k in range(size)]
    # Values live at raster-cell centres, not at outer domain corners.
    grid={'nx':nx,'ny':ny,'x0':xmin+dx/2,'y0':ymin+dy/2,'dx':dx,'dy':dy}
    return grid,bed,valid,depth,method

def convert(path,metadata,nx=80,ny=60,progress=lambda m:None):
    vtk=vtk_modules();path=Path(path);temp=None
    if not 2<=nx<=300 or not 2<=ny<=300:raise ValueError('导入重采样网格应在2—300行列之间')
    if path.suffix.lower()=='.zip':
        temp=tempfile.TemporaryDirectory(prefix='foam_import_');base=safe_extract(path,temp.name)
        pvds=sorted(base.rglob('*.pvd'),key=lambda p:len(p.parts))
        if pvds:path=pvds[0]
        elif list(base.rglob('controlDict')):path=base
        else:
            vfiles=sorted([p for p in base.rglob('*') if p.suffix.lower() in ['.vtu','.vtk','.vtp','.vti','.vts','.vtm']])
            if not vfiles:raise ValueError('ZIP内未找到OpenFOAM算例或VTK/PVD文件')
            if len(vfiles)>1:raise ValueError('多时刻VTK文件请同时提供PVD时间索引；不按文件名猜测时间。')
            path=vfiles[0]
    try:
        frames=[];bed=None;valid=None;bounds=None;grid=None;method=None
        for t,meshes in file_frames(path,vtk):
            progress('读取计算时间 '+str(t)+' s')
            records=[]
            for mesh in meshes:records.extend(cells_for(mesh,vtk))
            if not records:raise ValueError('时间步没有可用的体积或水深数据')
            if bounds is None:bounds=(min(r[0][0] for r in records),max(r[0][1] for r in records),min(r[0][2] for r in records),max(r[0][3] for r in records))
            g,b,v,h,kind=rasterize(records,bounds,nx,ny)
            if bed is None:bed=b;valid=v;grid=g;method=kind
            elif v!=valid:raise ValueError('各时刻有效平面网格不一致，请先重采样到固定计算域；缺失区不能默认为干燥。')
            elif any(abs(x-y)>0.001 for x,y,is_valid in zip(b,bed,valid) if is_valid):raise ValueError('各时刻底床高程发生变化；请先用对应时刻地形计算水深，再导入统一水深结果。')
            if kind!=method:raise ValueError('各时刻物理字段不一致')
            if nx*ny*(len(frames)+1)>12_000_000:raise ValueError('重采样结果超过1200万个数值，请降低网格数或分时间段导入。')
            frames.append({'time':t,'depth':[round(x,6) for x in h]})
        if not frames:raise ValueError('没有有效时间步')
        text='体积分数×单元体积在水平栅格内分配后除以栅格面积，得到等效水柱深度；不等同于精确自由水面。斜交或多面体网格采用单元包围盒分配，精度受分辨率与单元形状影响。' if method=='volume' else '已有depth/h字段在水平网格内按投影面积加权；不从z坐标推断水深。'
        # Metadata labels must distinguish actual imported data from built-in demonstrations.
        out={**metadata,'source_type':metadata.get('source_type','openfoam'),'grid':grid,'bed':bed,'valid':valid,'frames':frames,'method':text,'spatial_approximation':'水平栅格投影；查询在有效栅格中心之间双线性插值','original_format':path.suffix.lower() or 'OpenFOAM case'}
        return validate_dataset(out)
    finally:
        if temp:temp.cleanup()

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='OpenFOAM/VTK结果转平台水深网格')
    parser.add_argument('input');parser.add_argument('output');parser.add_argument('--lon',type=float,required=True);parser.add_argument('--lat',type=float,required=True);parser.add_argument('--height',type=float,default=0);parser.add_argument('--yaw',type=float,default=0);parser.add_argument('--nx',type=int,default=80);parser.add_argument('--ny',type=int,default=60)
    a=parser.parse_args();d=convert(a.input,{'name':Path(a.input).stem,'source_type':'openfoam','origin':{'longitude':a.lon,'latitude':a.lat,'height':a.height},'yaw':a.yaw,'vertical_datum':'用户声明的局部原点'},a.nx,a.ny,print)
    Path(a.output).write_text(json.dumps(d,ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf-8');print('已导出',len(d['frames']),'个时间步')
