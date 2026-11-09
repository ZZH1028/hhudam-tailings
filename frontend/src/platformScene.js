import * as C from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export const depthColors=['#8bdbed','#4db8d9','#228dd0','#3067c7','#6045b9','#9c48b7'];
const thresholds=[.25,.5,1,2,4,Infinity];
export class PlatformScene {
  constructor(container,onPick,onMeasure){
    this.viewer=new C.Viewer(container,{baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,infoBox:false,selectionIndicator:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,shouldAnimate:true,requestRenderMode:true,maximumRenderTimeChange:Infinity});
    const v=this.viewer;
    v.scene.backgroundColor=C.Color.fromCssColorString('#071321');
    v.scene.globe.baseColor=C.Color.fromCssColorString('#142c3d');
    v.scene.globe.showGroundAtmosphere=false;v.scene.globe.enableLighting=false;
    v.scene.globe.depthTestAgainstTerrain=false;
    v.scene.screenSpaceCameraController.minimumZoomDistance=1;
    if(v.scene.skyAtmosphere)v.scene.skyAtmosphere.show=false;
    if(v.scene.fog)v.scene.fog.enabled=false;
    this.model=null;this.floods=[];this.pickMarker=null;this.generation=0;this.mode='probe';this.points=[];this.measureEntities=[];
    C.TileMapServiceImageryProvider.fromUrl(new URL('Assets/Textures/NaturalEarthII/', window.CESIUM_BASE_URL).href).then(p=>{if(!v.isDestroyed())v.imageryLayers.addImageryProvider(p)}).catch(()=>{});
    this.handler=new C.ScreenSpaceEventHandler(v.scene.canvas);
    this.handler.setInputAction(event=>{
      let point;
      try{if(v.scene.pickPositionSupported)point=v.scene.pickPosition(event.position)}catch{}
      if(!C.defined(point))point=v.camera.pickEllipsoid(event.position,v.scene.globe.ellipsoid);
      if(!point)return;
      const ll=C.Cartographic.fromCartesian(point);const lon=C.Math.toDegrees(ll.longitude),lat=C.Math.toDegrees(ll.latitude);
      if(this.mode==='probe'){onPick?.(lon,lat);return}
      this.points.push(point);
      this.measureEntities.push(v.entities.add({position:point,point:{pixelSize:7,color:C.Color.CYAN,disableDepthTestDistance:Infinity}}));
      if(this.points.length>=2){
        this.measureEntities.push(v.entities.add({polyline:{positions:[...this.points],width:3,material:C.Color.CYAN,clampToGround:false}}));
        let length=0;for(let i=1;i<this.points.length;i++)length+=C.Cartesian3.distance(this.points[i-1],this.points[i]);
        onMeasure?.({mode:this.mode,distance:length,points:this.points.length});
      }
      if(this.mode==='area'&&this.points.length>=3){
        if(this.areaEntity)v.entities.remove(this.areaEntity);
        this.areaEntity=v.entities.add({polygon:{hierarchy:this.points,material:C.Color.CYAN.withAlpha(.16),outline:true,outlineColor:C.Color.CYAN,perPositionHeight:true}});
        const frame=C.Transforms.eastNorthUpToFixedFrame(this.points[0]);const inv=C.Matrix4.inverseTransformation(frame,new C.Matrix4());
        const xy=this.points.map(p=>C.Matrix4.multiplyByPoint(inv,p,new C.Cartesian3()));let area=0;
        xy.forEach((p,i)=>{const q=xy[(i+1)%xy.length];area+=p.x*q.y-p.y*q.x});
        onMeasure?.({mode:'area',area:Math.abs(area)/2,points:this.points.length});
      }
    },C.ScreenSpaceEventType.LEFT_CLICK);
  }
  async load(model,token=''){
    const id=++this.generation;let obj;
    if(model.kind==='ion'){
      if(!token)throw new Error('请在网页设置中填写有权读取此资产的 Cesium ion Token。');
      C.Ion.defaultAccessToken=token;obj=await C.Cesium3DTileset.fromIonAssetId(Number(model.url));
    }else if(model.kind==='tileset')obj=await C.Cesium3DTileset.fromUrl(model.url,{maximumScreenSpaceError:8});
    else{
      const position=C.Cartesian3.fromDegrees(Number(model.longitude),Number(model.latitude),Number(model.height||0));
      const matrix=C.Transforms.eastNorthUpToFixedFrame(position);
      C.Matrix4.multiply(matrix,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(C.Math.toRadians(Number(model.heading||0)))),matrix);
      obj=await C.Model.fromGltfAsync({url:model.url,modelMatrix:matrix,scale:Number(model.scale||1),minimumPixelSize:0});
    }
    if(id!==this.generation){obj.destroy();return}
    if(this.model)this.viewer.scene.primitives.remove(this.model);
    this.model=this.viewer.scene.primitives.add(obj);this.active=model;
    this.viewer.scene.globe.show=true;
    this.view('overview');
  }
  view(kind){
    const sphere=this.model?.boundingSphere;
    if(!sphere)return;
    const settings={overview:[.35,-.52,3.0],top:[0,-Math.PI/2,2.8],front:[Math.PI/2,-.15,2.5],side:[Math.PI,-.25,2.8]};
    const [heading,pitch,range]=settings[kind]||settings.overview;
    this.viewer.camera.flyToBoundingSphere(sphere,{duration:1.1,offset:new C.HeadingPitchRange(heading,pitch,Math.max(20,sphere.radius*range))});
    this.viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
  }
  gridCenterPosition(d){
    const g=d.grid,origin=d.origin;
    const width=(g.nx-1)*g.dx,height=(g.ny-1)*g.dy;
    const x=g.x0+width/2,y=g.y0+height/2,angle=C.Math.toRadians(d.yaw||0);
    const originMatrix=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(origin.longitude,origin.latitude,origin.height||0));
    const center=C.Matrix4.multiplyByPoint(originMatrix,new C.Cartesian3(x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),0),new C.Cartesian3());
    return {center, radius:Math.hypot(width,height)/2};
  }
  gridCenter(d){
    const position=C.Cartographic.fromCartesian(this.gridCenterPosition(d).center);
    return [C.Math.toDegrees(position.longitude),C.Math.toDegrees(position.latitude)];
  }
  flyGrid(d){
    const {center,radius}=this.gridCenterPosition(d);
    this.viewer.camera.flyToBoundingSphere(new C.BoundingSphere(center,radius),{duration:1.2,offset:new C.HeadingPitchRange(0,-Math.PI/2,Math.max(25,radius*2.65))});
  }
  setMode(mode){this.mode=mode;this.clearMeasure()}
  clearMeasure(){for(const e of this.measureEntities)this.viewer.entities.remove(e);this.measureEntities=[];this.points=[];if(this.areaEntity){this.viewer.entities.remove(this.areaEntity);this.areaEntity=null}}
  clearFlood(){for(const p of this.floods)this.viewer.scene.primitives.remove(p);this.floods=[]}
  drawFlood(d,frame){
    this.clearFlood();if(!d?.frames?.length)return;
    const g=d.grid,h=d.frames[frame].depth,bed=d.bed,groups=depthColors.map(()=>({positions:[],indices:[]}));
    const matrix=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(d.origin.longitude,d.origin.latitude,d.origin.height||0));
    const yaw=C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(C.Math.toRadians(d.yaw||0)));
    C.Matrix4.multiply(matrix,yaw,matrix);
    for(let j=0;j<g.ny-1;j++)for(let i=0;i<g.nx-1;i++){
      const ids=[j*g.nx+i,j*g.nx+i+1,(j+1)*g.nx+i+1,(j+1)*g.nx+i];
      if(ids.some(k=>!d.valid[k])||Math.max(...ids.map(k=>h[k]))<.01)continue;
      const mean=ids.reduce((s,k)=>s+h[k],0)/4;const b=thresholds.findIndex(x=>mean<=x);const group=groups[Math.max(0,b)],start=group.positions.length/3;
      const xy=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]];
      ids.forEach((k,n)=>group.positions.push(g.x0+xy[n][0]*g.dx,g.y0+xy[n][1]*g.dy,bed[k]+h[k]+.05));
      group.indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    groups.forEach((group,b)=>{
      if(!group.indices.length)return;
      const values=new Float64Array(group.positions);
      const geom=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values})},indices:new Uint32Array(group.indices),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromVertices(values)});
      const instance=new C.GeometryInstance({geometry:geom,modelMatrix:matrix,attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString(depthColors[b]).withAlpha(.76))}});
      const primitive=new C.Primitive({geometryInstances:instance,appearance:new C.PerInstanceColorAppearance({flat:true,translucent:true,closed:false}),asynchronous:false,allowPicking:false});
      this.floods.push(this.viewer.scene.primitives.add(primitive));
    });
    this.viewer.scene.requestRender();
  }
  clearMarker(){
    if(this.pickMarker){
      this.viewer.entities.remove(this.pickMarker);
      this.pickMarker=null;
    }
  }
  marker(probe){
    this.clearMarker();
    const label=probe.depth==null?(probe.status==='outside'?'超出范围':'无数据'):Number(probe.depth).toFixed(3)+' m';
    this.pickMarker=this.viewer.entities.add({position:C.Cartesian3.fromDegrees(probe.longitude,probe.latitude,(probe.water_surface||0)+2),point:{pixelSize:11,color:C.Color.WHITE,outlineColor:C.Color.fromCssColorString('#3dd9df'),outlineWidth:3,disableDepthTestDistance:Infinity},label:{text:label,font:'14px sans-serif',pixelOffset:new C.Cartesian2(0,-24),fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#102534'),disableDepthTestDistance:Infinity}});
  }
  destroy(){this.handler.destroy();this.viewer.destroy()}
}
