"""Validated ENU depth grids, explicit no-data masks and point interrogation."""
from __future__ import annotations
import bisect, csv, io, json, math, re, zipfile
from pathlib import Path

def geodetic_ecef(lon,lat,height=0):
    a=6378137.;e2=6.69437999014e-3
    lo,la=math.radians(lon),math.radians(lat)
    N=a/math.sqrt(1-e2*math.sin(la)**2)
    return ((N+height)*math.cos(la)*math.cos(lo),(N+height)*math.cos(la)*math.sin(lo),(N*(1-e2)+height)*math.sin(la))

def lonlat_to_grid(lon,lat,origin,yaw=0):
    a=geodetic_ecef(lon,lat,origin.get('height',0));b=geodetic_ecef(origin['longitude'],origin['latitude'],origin.get('height',0))
    dx,dy,dz=[a[i]-b[i] for i in range(3)]
    lo,la=math.radians(origin['longitude']),math.radians(origin['latitude'])
    east=-math.sin(lo)*dx+math.cos(lo)*dy
    north=-math.sin(la)*math.cos(lo)*dx-math.sin(la)*math.sin(lo)*dy+math.cos(la)*dz
    th=math.radians(yaw)
    return east*math.cos(th)+north*math.sin(th),-east*math.sin(th)+north*math.cos(th)

def grid_to_lonlat(x,y,origin,yaw=0):
    th=math.radians(yaw);east=x*math.cos(th)-y*math.sin(th);north=x*math.sin(th)+y*math.cos(th)
    lo=origin['longitude']+east/(111319.490793*math.cos(math.radians(origin['latitude'])))
    la=origin['latitude']+north/111132.954
    return lo,la

def validate_dataset(d):
    if not isinstance(d,dict) or 'grid' not in d or 'frames' not in d:raise ValueError('需要包含 grid、origin、bed、frames 的水深数据')
    g=d['grid'];nx=int(g['nx']);ny=int(g['ny'])
    if not 2<=nx<=800 or not 2<=ny<=800:raise ValueError('网格行列数应在2—800之间')
    for k in ('dx','dy','x0','y0'):
        v=float(g[k])
        if not math.isfinite(v):raise ValueError('网格参数必须为有限数')
        g[k]=v
    if g['dx']<=0 or g['dy']<=0:raise ValueError('dx、dy必须大于0')
    g['nx']=nx;g['ny']=ny;size=nx*ny
    o=d.get('origin',{})
    if not -180<=float(o['longitude'])<=180 or not -85<=float(o['latitude'])<=85:raise ValueError('原点经纬度无效')
    d['origin']={k:float(o.get(k,0)) for k in ('longitude','latitude','height')}
    d['yaw']=float(d.get('yaw',0))
    if not math.isfinite(d['origin']['height']) or not math.isfinite(d['yaw']):raise ValueError('原点高程和旋转角必须有限')
    if len(d.get('bed',[]))!=size:raise ValueError('bed长度必须等于nx×ny')
    d['bed']=[float(x) for x in d['bed']]
    if not all(math.isfinite(x) for x in d['bed']):raise ValueError('地面高程包含无效数')
    d['valid']=[bool(x) for x in d.get('valid',[True]*size)]
    if len(d['valid'])!=size:raise ValueError('valid掩码长度错误')
    if not 1<=len(d['frames'])<=2000:raise ValueError('时间帧数量应在1—2000之间')
    if len(d['frames'])*size>12_000_000:raise ValueError('结果超过1200万个数值，请分时段导入或降低网格分辨率')
    last=-float('inf')
    for f in d['frames']:
        f['time']=float(f['time'])
        if not math.isfinite(f['time']) or f['time']<=last:raise ValueError('时间必须严格递增且不重复')
        last=f['time']
        if len(f.get('depth',[]))!=size:raise ValueError('每帧水深长度必须等于nx×ny')
        values=[]
        for x in f['depth']:
            x=float(x)
            if not math.isfinite(x) or x < -1e-8:raise ValueError('水深必须为有限非负数')
            values.append(max(0,x))
        f['depth']=values
    d.setdefault('source_type','imported');d.setdefault('name','导入的水深数据')
    d.setdefault('vertical_datum','未声明');d.setdefault('method','输入水深字段')
    d['version']=1
    return d

def query_depth(d,lon,lat,frame=0):
    g=d['grid'];x,y=lonlat_to_grid(float(lon),float(lat),d['origin'],d.get('yaw',0))
    fx=(x-g['x0'])/g['dx'];fy=(y-g['y0'])/g['dy'];nx=g['nx'];ny=g['ny']
    common={'longitude':float(lon),'latitude':float(lat),'x':round(x,3),'y':round(y,3)}
    # Never extrapolate a nearby wet cell into an unmodelled region.
    eps=1e-8
    if fx< -eps or fy< -eps or fx>nx-1+eps or fy>ny-1+eps:return {**common,'status':'outside','depth':None,'message':'该点超出模拟网格范围'}
    fx=min(max(0,fx),nx-1);fy=min(max(0,fy),ny-1)
    ix=min(int(fx),nx-2);iy=min(int(fy),ny-2);u=fx-ix;v=fy-iy
    ids=[iy*nx+ix,iy*nx+ix+1,(iy+1)*nx+ix,(iy+1)*nx+ix+1]
    w=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]
    if any(weight>1e-10 and not d['valid'][ind] for ind,weight in zip(ids,w)):
        return {**common,'status':'nodata','depth':None,'message':'该点没有有效计算网格，不能解释为未淹没'}
    fi=max(0,min(int(frame),len(d['frames'])-1));f=d['frames'][fi]
    val=lambda a:sum(a[ind]*weight for ind,weight in zip(ids,w))
    depth=val(f['depth']);bed=val(d['bed'])+d['origin'].get('height',0)
    history=[round(val(fr['depth']),5) for fr in d['frames']]
    wet=[fr['time'] for fr,h in zip(d['frames'],history) if h>0.01]
    return {**common,'status':'wet' if depth>0.01 else 'dry','depth':round(depth,5),'bed':round(bed,5),'water_surface':round(bed+depth,5),'time':f['time'],'frame':fi,'maximum_depth':max(history),'first_wet_time':min(wet) if wet else None,'history':history,'times':[fr['time'] for fr in d['frames']],'method':'有效网格内双线性插值','source_type':d['source_type'],'vertical_datum':d['vertical_datum']}

def csv_to_dataset(text,metadata):
    reader=csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    rows=[]
    for r in reader:
        # WGS84 or ENU coordinates. Input z is bed elevation, never assumed to be depth.
        if r.get('longitude') is not None and r.get('latitude') is not None:
            x,y=lonlat_to_grid(float(r['longitude']),float(r['latitude']),metadata['origin'],metadata.get('yaw',0))
        else:x=float(r['x']);y=float(r['y'])
        h=r.get('depth',r.get('h'))
        if h in (None,''):raise ValueError('CSV需要明确的depth或h列，不能把z坐标当成水深')
        bed=r.get('bed',r.get('bed_elevation',r.get('z')))
        if bed in (None,''):raise ValueError('CSV需要bed（地面高程）列')
        rows.append((round(x,4),round(y,4),float(r.get('time',0)),float(h),float(bed)))
    if not rows:raise ValueError('CSV没有有效数据行')
    xs=sorted(set(r[0] for r in rows));ys=sorted(set(r[1] for r in rows));ts=sorted(set(r[2] for r in rows))
    if len(xs)<2 or len(ys)<2:raise ValueError('CSV必须包含至少2×2的规则平面网格')
    dx=(xs[-1]-xs[0])/(len(xs)-1);dy=(ys[-1]-ys[0])/(len(ys)-1)
    if any(abs(xs[i]-xs[0]-i*dx)>max(.002,dx*.002) for i in range(len(xs))) or any(abs(ys[i]-ys[0]-i*dy)>max(.002,dy*.002) for i in range(len(ys))):raise ValueError('CSV坐标不是规则网格；请先重采样或使用VTK导入')
    nx=len(xs);size=nx*len(ys);beds=[0.]*size;valid=[False]*size
    frames={t:{'time':t,'depth':[0.]*size} for t in ts};counts={t:set() for t in ts}
    xi={v:i for i,v in enumerate(xs)};yi={v:i for i,v in enumerate(ys)}
    for x,y,t,h,z in rows:
        ind=yi[y]*nx+xi[x]
        if ind in counts[t]:raise ValueError('CSV同一时刻、同一网格点存在重复记录')
        counts[t].add(ind);frames[t]['depth'][ind]=h;beds[ind]=z;valid[ind]=True
    expected=set(range(size))
    if any(v!=expected for v in counts.values()):raise ValueError('CSV每一时刻需要完整网格；缺测不能默认为干燥')
    return validate_dataset({**metadata,'grid':{'nx':nx,'ny':len(ys),'x0':xs[0],'y0':ys[0],'dx':dx,'dy':dy},'bed':beds,'valid':valid,'frames':list(frames.values()),'method':'CSV输入水深字段'})

def safe_extract(archive,destination,max_bytes=3_000_000_000):
    destination=Path(destination).resolve();total=0
    with zipfile.ZipFile(archive) as z:
        if len(z.infolist())>100000:raise ValueError('压缩包文件数量过多')
        for i in z.infolist():
            name=i.filename.replace('\\','/')
            if name.startswith('/') or re.match(r'^[a-zA-Z]:',name):raise ValueError('压缩包路径无效')
            p=(destination/name).resolve()
            if not p.is_relative_to(destination):raise ValueError('压缩包包含越界路径')
            if (i.external_attr>>16)&0o170000==0o120000:raise ValueError('不接受压缩包内的符号链接')
            total+=i.file_size
            if total>max_bytes:raise ValueError('解压后文件超过3GB限制')
            if i.is_dir():p.mkdir(parents=True,exist_ok=True)
            else:
                p.parent.mkdir(parents=True,exist_ok=True)
                with z.open(i) as src,p.open('wb') as dst:
                    import shutil;shutil.copyfileobj(src,dst)
    return destination
