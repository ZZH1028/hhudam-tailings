import * as C from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { buildSurface, gridMatrix, waterMaterial } from './floodSurface.js';

const valleyViews = {
  overview: [[112, 0, 10], 38, -38, 985],
  top: [[138, 0, 0], 0, -90, 1030],
  front: [[15, -2, 16], -82, -17, 285],
  side: [[22, 0, 19], -154, -25, 410],
  upstream: [[-179, -38, 13], 71, -31, 470],
  downstream: [[290, -6, 5], -68, -41, 650],
};

const modelViews = {
  overview: [32, -39, 2.9],
  top: [0, -90, 2.75],
  front: [-90, -17, 2.3],
  side: [174, -24, 2.45],
  upstream: [90, -24, 2.6],
  downstream: [-70, -34, 3.3],
};

export class PlatformScene {
  constructor(container,onPick,onMeasure,onRenderError){
    this.viewer=new C.Viewer(container,{baseLayer:false,animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,infoBox:false,selectionIndicator:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,shouldAnimate:false,showRenderLoopErrors:false,requestRenderMode:true,maximumRenderTimeChange:Infinity});
    const v=this.viewer;
    v.scene.renderError.addEventListener((_scene, error) => onRenderError?.(error));
    v.scene.backgroundColor=C.Color.fromCssColorString('#071321');
    v.scene.globe.baseColor=C.Color.fromCssColorString('#142c3d');
    v.scene.globe.showGroundAtmosphere=false;v.scene.globe.enableLighting=false;
    v.scene.globe.depthTestAgainstTerrain=false;
    v.scene.screenSpaceCameraController.minimumZoomDistance=1;
    if(v.scene.skyAtmosphere)v.scene.skyAtmosphere.show=false;
    if(v.scene.fog)v.scene.fog.enabled=false;
    this.model=null;this.breachModel=null;this.floodSurface=null;this.pickMarker=null;this.generation=0;this.mode='probe';this.points=[];this.measureEntities=[];
    C.TileMapServiceImageryProvider.fromUrl(new URL('Assets/Textures/NaturalEarthII/', window.CESIUM_BASE_URL).href).then(p=>{if(!v.isDestroyed())v.imageryLayers.addImageryProvider(p)}).catch(()=>{});
    v.scene.preRender.addEventListener(() => this.updateEyeOffset());
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
  async load(model, token = '') {
    const version = ++this.generation;
    let object, matrix;
    if (model.kind === 'ion') {
      if (!token) throw new Error('请填写有权读取此资产的 Cesium ion Token。');
      C.Ion.defaultAccessToken = token;
      object = await C.Cesium3DTileset.fromIonAssetId(Number(model.url));
    } else if (model.kind === 'tileset') {
      object = await C.Cesium3DTileset.fromUrl(model.url, { maximumScreenSpaceError: 7 });
    } else {
      matrix = gridMatrix({ origin: model, yaw: model.heading });
      object = await C.Model.fromGltfAsync({
        url: model.url, modelMatrix: matrix, scale: Number(model.scale || 1),
        forwardAxis: model.valley ? C.Axis.X : C.Axis.Z,
      });
    }
    if (version !== this.generation || this.viewer.isDestroyed()) {
      object.destroy();
      return;
    }
    const { scene } = this.viewer;
    this.clearBreach();
    if (this.model) scene.primitives.remove(this.model);
    this.model = scene.primitives.add(object);
    this.active = model;
    this.valleyMatrix = model.valley ? matrix : null;
    scene.globe.show = !model.valley;
    if (model.valley) {
      const direction = C.Matrix4.multiplyByPointAsVector(matrix, new C.Cartesian3(0.56, 0.42, -0.73), new C.Cartesian3());
      scene.light = new C.DirectionalLight({ direction, intensity: 1.8 });
      this.setBreach(0);
    } else {
      scene.light = new C.SunLight();
      if (!object.ready && object.readyEvent) {
        object.readyEvent.addEventListener(() => {
          if (this.model === object) this.view(this.cameraPreset || 'overview');
        });
      }
    }
    this.view('overview');
    scene.requestRender();
  }
  clearBreach() {
    this.breachStage = null;
    if (this.breachModel) this.viewer.scene.primitives.remove(this.breachModel);
    this.breachModel = null;
  }
  async setBreach(stage) {
    if (!this.valleyMatrix) return;
    const index = Math.max(0, Math.min(12, Math.round(stage * 12)));
    if (index === this.breachStage) return;
    this.breachStage = index;
    const matrix = this.valleyMatrix;
    try {
      const model = await C.Model.fromGltfAsync({
        url: new URL('models/valley-dam/' + String(index).padStart(2, '0') + '.glb', document.baseURI).href,
        modelMatrix: matrix, forwardAxis: C.Axis.X,
      });
      if (this.viewer.isDestroyed() || matrix !== this.valleyMatrix || this.breachStage !== index) {
        model.destroy();
        return;
      }
      if (this.breachModel) this.viewer.scene.primitives.remove(this.breachModel);
      this.breachModel = this.viewer.scene.primitives.add(model);
      this.viewer.scene.requestRender();
    } catch (error) {
      if (!this.viewer.isDestroyed() && this.breachStage === index) this.breachStage = null;
      console.error('坝体网格加载失败', error);
    }
  }
  view(kind) {
    this.cameraPreset = kind;
    let sphere, heading, pitch, range;
    if (this.valleyMatrix) {
      const [target, azimuth, elevation, distance] = valleyViews[kind] || valleyViews.overview;
      const center = C.Matrix4.multiplyByPoint(this.valleyMatrix, new C.Cartesian3(...target), new C.Cartesian3());
      sphere = new C.BoundingSphere(center, 0.5);
      heading = azimuth;
      pitch = elevation;
      range = distance;
    } else {
      if (!this.model || (this.active.kind === 'glb' && !this.model.ready)) return;
      sphere = this.model.boundingSphere;
      const [azimuth, elevation, distance] = modelViews[kind] || modelViews.overview;
      heading = azimuth + Number(this.active.heading || 0);
      pitch = elevation;
      range = Math.max(20, sphere.radius * distance);
    }
    const camera = this.viewer.camera;
    camera.cancelFlight();
    camera.flyToBoundingSphere(sphere, {
      duration: 1.35,
      offset: new C.HeadingPitchRange(C.Math.toRadians(heading), C.Math.toRadians(pitch), range),
      easingFunction: C.EasingFunction.CUBIC_IN_OUT,
    });
    this.viewer.scene.requestRender();
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
  clearFlood() {
    if (this.floodSurface) this.viewer.scene.primitives.remove(this.floodSurface);
    this.floodSurface = null;
    this.viewer.scene.requestRender();
  }
  drawFlood(dataset, snapshot, style) {
    this.clearFlood();
    if (!dataset || !snapshot) return;
    if (this.floodDataset !== dataset) {
      this.floodDataset = dataset;
      this.waterMatrix = gridMatrix(dataset);
      this.waterOrigin = C.Matrix4.getTranslation(this.waterMatrix, new C.Cartesian3());
      this.palette = waterMaterial(this.waterMatrix);
    }
    const palette = this.palette;
    palette.uniforms.depthPalette = style === 'depth' ? 1 : 0;
    palette.uniforms.clockSeconds = snapshot.time;
    this.updateEyeOffset();
    const surface = buildSurface(dataset, snapshot, this.waterMatrix, palette);
    if (surface) this.floodSurface = this.viewer.scene.primitives.add(surface);
    this.viewer.scene.requestRender();
  }
  updateEyeOffset() {
    if (!this.palette) return;
    C.Cartesian3.subtract(this.viewer.camera.positionWC, this.waterOrigin, this.palette.uniforms.eyeOffset);
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
  destroy(){this.generation++;this.handler.destroy();this.viewer.destroy()}
}
