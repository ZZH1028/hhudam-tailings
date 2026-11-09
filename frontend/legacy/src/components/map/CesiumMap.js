import * as CesiumLib from 'cesium';

export async function initCesium(containerId, token, assetId = null) {
  document.querySelectorAll('.disaster-info-box').forEach(el => el.remove());

  let validToken = null;
  if (token && token.startsWith('ey')) {
    validToken = token;
    CesiumLib.Ion.defaultAccessToken = validToken;
    console.log('[Cesium] Ion 令牌已设置');
  }

  let terrainProvider = undefined;

  if (validToken) {
    try {
      terrainProvider = await CesiumLib.createWorldTerrainAsync({
        requestVertexNormals: true,
        requestWaterMask: true
      });
    } catch (err) {
      console.error('[Cesium] World Terrain 加载失败，回退为默认椭球：', err);
    }
  }

  const viewer = new CesiumLib.Viewer(containerId, {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    terrainProvider,
    scene3DOnly: true,
    shouldAnimate: true
  });

  // ===== 场景基础设置 =====
  viewer.scene.backgroundColor = CesiumLib.Color.fromCssColorString('#06101d');

  // 地球相关
  viewer.scene.globe.showGroundAtmosphere = false;
  viewer.scene.globe.depthTestAgainstTerrain = false;

  // 关键：关闭太阳光照影响，让地球整体亮度一致
  viewer.scene.globe.enableLighting = false;

  // 如果影像没加载时的兜底底色，设成深蓝灰而不是纯黑
  viewer.scene.globe.baseColor = CesiumLib.Color.fromCssColorString('#10263f');

  // 关闭会影响明暗的环境项
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = false;
  }
  if (viewer.scene.fog) {
    viewer.scene.fog.enabled = false;
  }
  if (viewer.scene.skyBox) {
    viewer.scene.skyBox.show = false;
  }
  if (viewer.scene.sun) {
    viewer.scene.sun.show = false;
  }
  if (viewer.scene.moon) {
    viewer.scene.moon.show = false;
  }

  // 提高地形显示质量
  viewer.scene.globe.maximumScreenSpaceError = 2;
  viewer.scene.globe.tileCacheSize = 300;

  // ===== 清空默认底图，手动叠加世界影像 =====
  try {
    viewer.imageryLayers.removeAll();

    let imageryProvider = null;

    if (validToken && typeof CesiumLib.createWorldImageryAsync === 'function') {
      try {
        imageryProvider = await CesiumLib.createWorldImageryAsync({
          style: CesiumLib.IonWorldImageryStyle.AERIAL
        });
      } catch (err) {
        console.error('[Cesium] World Imagery (Ion) 加载失败：', err);
      }
    }

    if (!imageryProvider) {
      const tileUrls = [
        'https://tile.openstreetmap.org/',
        'https://a.tile.openstreetmap.org/',
        'https://b.tile.openstreetmap.org/'
      ];

      for (const url of tileUrls) {
        try {
          imageryProvider = new CesiumLib.OpenStreetMapImageryProvider({
            url: url
          });
          break;
        } catch (err) {
          console.warn(`[Cesium] OpenStreetMap (${url}) 加载失败，尝试下一个...`);
        }
      }
    }

    if (!imageryProvider) {
      try {
        imageryProvider = new CesiumLib.UrlTemplateImageryProvider({
          url: 'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
        });
      } catch (err) {
        console.warn('[Cesium] 高德影像加载失败');
      }
    }

    if (!imageryProvider) {
      try {
        imageryProvider = new CesiumLib.TileMapServiceImageryProvider({
          url: CesiumLib.buildModuleUrl('Assets/Textures/NaturalEarthII')
        });
      } catch (err) {
        console.warn('[Cesium] 默认影像加载失败');
      }
    }

    const imageryLayer = viewer.imageryLayers.addImageryProvider(imageryProvider);

    // 相当于 ion 里 Opacity 拉满
    imageryLayer.alpha = 1.0;

    // 统一亮度与观感
    imageryLayer.brightness = 1.08;
    imageryLayer.contrast = 1.08;
    imageryLayer.saturation = 1.0;
    imageryLayer.gamma = 1.0;
    imageryLayer.hue = 0.0;
    imageryLayer.sharpness = 1.0;

    console.log('[Cesium] Imagery layer added:', imageryLayer);
  } catch (err) {
    console.error('[Cesium] World Imagery 加载失败：', err);
  }

  // 防止镜头钻地
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100.0;

  if (viewer.terrainProvider && viewer.terrainProvider.errorEvent) {
    viewer.terrainProvider.errorEvent.addEventListener((error) => {
      console.error('[Cesium] terrainProvider error:', error);
    });
  }

  const resizeHandler = () => {
    if (!viewer.isDestroyed()) {
      viewer.resize();
      viewer.scene.requestRender();
    }
  };

  viewer.__appResizeHandler = resizeHandler;
  window.addEventListener('resize', resizeHandler);

  if (assetId && validToken) {
    try {
      console.log(`[Cesium] 正在加载资产 ID: ${assetId}`);

      const resource = await CesiumLib.IonResource.fromAssetId(assetId);

      let loaded = false;
      let loadedType = null;

      // 1. 直接尝试 3D Tiles
      try {
        const tileset = await CesiumLib.Cesium3DTileset.fromIonAssetId(assetId);
        console.log('[Cesium] fromIonAssetId 3D Tileset 创建成功');
        viewer.scene.primitives.add(tileset);
        await viewer.zoomTo(tileset);
        loaded = true;
        loadedType = '3D Tiles (fromIonAssetId)';
      } catch (ionTilesetError) {
        console.warn('[Cesium] fromIonAssetId 3D Tiles 加载失败：', ionTilesetError);
      }

      if (!loaded) {
        try {
          const tileset = await CesiumLib.Cesium3DTileset.fromResource(resource);
          console.log('[Cesium] fromResource 3D Tileset 创建成功');
          viewer.scene.primitives.add(tileset);
          await viewer.zoomTo(tileset);
          loaded = true;
          loadedType = '3D Tiles (fromResource)';
        } catch (tilesetError) {
          console.warn('[Cesium] fromResource 3D Tiles 加载失败：', tilesetError);
        }
      }

      if (!loaded && resource.url) {
        try {
          const tileset = await CesiumLib.Cesium3DTileset.fromUrl(resource.url);
          console.log('[Cesium] fromUrl 3D Tileset 创建成功');
          viewer.scene.primitives.add(tileset);
          await viewer.zoomTo(tileset);
          loaded = true;
          loadedType = '3D Tiles (fromUrl)';
        } catch (urlTilesetError) {
          console.warn('[Cesium] fromUrl 3D Tiles 加载失败：', urlTilesetError);
        }
      }

      if (!loaded && CesiumLib.IonImageryProvider) {
        try {
          const imageryProvider = new CesiumLib.IonImageryProvider({ assetId });
          const imageryLayer = viewer.imageryLayers.addImageryProvider(imageryProvider);
          imageryLayer.alpha = 1.0;
          viewer.camera.flyTo({
            destination: CesiumLib.Cartesian3.fromDegrees(118.754, 32.045, 20000),
            orientation: {
              heading: CesiumLib.Math.toRadians(0.0),
              pitch: CesiumLib.Math.toRadians(-55.0),
              roll: 0.0
            },
            duration: 2.5
          });
          loaded = true;
          loadedType = 'Imagery';
        } catch (imageryError) {
          console.warn('[Cesium] IonImageryProvider 加载失败：', imageryError);
        }
      }

      if (!loaded && CesiumLib.CesiumTerrainProvider) {
        try {
          let terrainProviderFromAsset = null;
          if (typeof CesiumLib.CesiumTerrainProvider.fromIonAssetId === 'function') {
            terrainProviderFromAsset = CesiumLib.CesiumTerrainProvider.fromIonAssetId(assetId);
          } else if (resource.url) {
            terrainProviderFromAsset = new CesiumLib.CesiumTerrainProvider({ url: resource.url });
          }
          if (terrainProviderFromAsset) {
            viewer.terrainProvider = terrainProviderFromAsset;
            viewer.camera.flyTo({
              destination: CesiumLib.Cartesian3.fromDegrees(118.754, 32.045, 20000),
              orientation: {
                heading: CesiumLib.Math.toRadians(0.0),
                pitch: CesiumLib.Math.toRadians(-55.0),
                roll: 0.0
              },
              duration: 2.5
            });
            loaded = true;
            loadedType = 'Terrain';
          }
        } catch (terrainError) {
          console.warn('[Cesium] 地形资产加载失败：', terrainError);
        }
      }

      if (loaded) {
        console.log(`[Cesium] 资产 ${assetId} 加载成功，类型：${loadedType}`);
      } else {
        throw new Error('未能识别或加载 Cesium Ion 资产');
      }
    } catch (err) {
      console.error(`[Cesium] 资产 ${assetId} 加载失败:`, err);
      console.error('[Cesium] 错误详情:', err.message, err.statusCode);
      viewer.camera.flyTo({
        destination: CesiumLib.Cartesian3.fromDegrees(118.754, 32.045, 2000),
        orientation: {
          heading: CesiumLib.Math.toRadians(0.0),
          pitch: CesiumLib.Math.toRadians(-55.0),
          roll: 0.0
        },
        duration: 2.5
      });
    }
  } else if (assetId && !validToken) {
    console.warn(`[Cesium] 未设置有效令牌，无法加载资产 ${assetId}`);
  }

  return viewer;
}

export function toggleMapInteraction(viewer, isInteractive) {
  if (!viewer) return;
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableRotate = isInteractive;
  controller.enableZoom = isInteractive;
  controller.enableTilt = isInteractive;
  controller.enableTranslate = isInteractive;
}

export async function loadIonAsset(viewer, assetId) {
  if (!viewer) {
    console.error('[Cesium] Viewer 未初始化');
    return null;
  }

  if (!assetId) {
    console.error('[Cesium] 资产ID无效');
    return null;
  }

  try {
    console.log(`[Cesium] 正在加载资产: ${assetId}`);

    const resource = await CesiumLib.IonResource.fromAssetId(assetId);

    let loaded = false;
    let loadedType = null;

    try {
      const tileset = await CesiumLib.Cesium3DTileset.fromIonAssetId(assetId);
      viewer.scene.primitives.add(tileset);
      await viewer.zoomTo(tileset);
      loaded = true;
      loadedType = '3D Tiles (fromIonAssetId)';
    } catch (ionTilesetError) {
      console.warn('[Cesium] fromIonAssetId 3D Tiles 加载失败：', ionTilesetError);
    }

    if (!loaded) {
      try {
        const tileset = await CesiumLib.Cesium3DTileset.fromResource(resource);
        viewer.scene.primitives.add(tileset);
        await viewer.zoomTo(tileset);
        loaded = true;
        loadedType = '3D Tiles (fromResource)';
      } catch (tilesetError) {
        console.warn('[Cesium] fromResource 3D Tiles 加载失败：', tilesetError);
      }
    }

    if (!loaded && resource.url) {
      try {
        const tileset = await CesiumLib.Cesium3DTileset.fromUrl(resource.url);
        viewer.scene.primitives.add(tileset);
        await viewer.zoomTo(tileset);
        loaded = true;
        loadedType = '3D Tiles (fromUrl)';
      } catch (urlTilesetError) {
        console.warn('[Cesium] fromUrl 3D Tiles 加载失败：', urlTilesetError);
      }
    }

    if (!loaded && CesiumLib.IonImageryProvider) {
      try {
        const imageryProvider = new CesiumLib.IonImageryProvider({ assetId });
        viewer.imageryLayers.addImageryProvider(imageryProvider);
        loaded = true;
        loadedType = 'Imagery';
      } catch (imageryError) {
        console.warn('[Cesium] IonImageryProvider 加载失败：', imageryError);
      }
    }

    if (!loaded && CesiumLib.CesiumTerrainProvider) {
      try {
        let terrainProvider = null;
        if (typeof CesiumLib.CesiumTerrainProvider.fromIonAssetId === 'function') {
          terrainProvider = CesiumLib.CesiumTerrainProvider.fromIonAssetId(assetId);
        } else if (resource.url) {
          terrainProvider = new CesiumLib.CesiumTerrainProvider({ url: resource.url });
        }
        if (terrainProvider) {
          viewer.terrainProvider = terrainProvider;
          loaded = true;
          loadedType = 'Terrain';
        }
      } catch (terrainError) {
        console.warn('[Cesium] 地形资产加载失败：', terrainError);
      }
    }

    if (loaded) {
      console.log(`[Cesium] 资产 ${assetId} 加载成功，类型：${loadedType}`);
      return loadedType;
    }

    throw new Error('未能识别或加载 Cesium Ion 资产');
  } catch (err) {
    console.error(`[Cesium] 资产 ${assetId} 加载失败:`, err);
    return null;
  }
}

let coordinateHandler = null;
let coordinateEntity = null;

export function enableCoordinatePicking(viewer, callback) {
  if (!viewer) {
    console.error('[Cesium] Viewer 未初始化');
    return;
  }

  disableCoordinatePicking(viewer);

  console.log('[Cesium] 启用坐标拾取');

  viewer.scene.globe.depthTestAgainstTerrain = true;

  coordinateHandler = new CesiumLib.ScreenSpaceEventHandler(viewer.scene.canvas);

  coordinateHandler.setInputAction((click) => {
    console.log('[Cesium] 点击位置:', click.position);

    let cartesian = null;

    const pickedObject = viewer.scene.pick(click.position);
    console.log('[Cesium] pickedObject:', pickedObject);

    if (CesiumLib.defined(pickedObject)) {
      console.log('[Cesium] 拾取到对象，类型:', pickedObject.primitive?.constructor?.name);

      const primitiveType = pickedObject.primitive?.constructor?.name;

      if (pickedObject.primitive && pickedObject.primitive.position) {
        cartesian = pickedObject.primitive.position;
        console.log('[Cesium] 从 primitive 获取坐标');
      } else if (pickedObject.content && pickedObject.content.boundingSphere) {
        const position = pickedObject.content.boundingSphere.center;
        if (position) {
          cartesian = position.clone();
          console.log('[Cesium] 从 3D Tiles content 获取坐标');
        }
      } else if (primitiveType === 'Cesium3DTileset' || pickedObject.primitive?.root) {
        console.log('[Cesium] 检测到 Cesium3DTileset，尝试使用 scene.pickPosition');
        const scenePickPosition = viewer.scene.pickPosition(click.position);
        if (scenePickPosition) {
          cartesian = scenePickPosition;
          console.log('[Cesium] 从 scene.pickPosition 获取坐标');
        }
      } else if (pickedObject.id && pickedObject.id.position) {
        const position = pickedObject.id.position.getValue(viewer.clock.currentTime);
        if (position) {
          cartesian = position;
          console.log('[Cesium] 从 entity 获取坐标');
        }
      }
    }

    if (!cartesian) {
      const ray = viewer.camera.getPickRay(click.position);
      cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      console.log('[Cesium] 从 globe.pick 获取坐标');
    }

    console.log('[Cesium] 拾取结果:', cartesian);

    if (cartesian) {
      const cartographic = CesiumLib.Cartographic.fromCartesian(cartesian);
      const longitude = CesiumLib.Math.toDegrees(cartographic.longitude);
      const latitude = CesiumLib.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      console.log('[Cesium] 坐标:', longitude, latitude, height);

      if (coordinateEntity) {
        viewer.entities.remove(coordinateEntity);
      }

      coordinateEntity = viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 10,
          color: CesiumLib.Color.fromCssColorString('#00ff88'),
          outlineColor: CesiumLib.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: `经度: ${longitude.toFixed(6)}°\n纬度: ${latitude.toFixed(6)}°\n高程: ${height.toFixed(2)}m`,
          font: '14px monospace',
          fillColor: CesiumLib.Color.WHITE,
          outlineColor: CesiumLib.Color.BLACK,
          outlineWidth: 2,
          style: CesiumLib.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new CesiumLib.Cartesian2(15, -15),
          showBackground: true,
          backgroundColor: new CesiumLib.Color(0, 0, 0, 0.7)
        }
      });

      if (callback) {
        callback({ longitude, latitude, height });
      }
    } else {
      console.warn('[Cesium] 无法获取点击位置的坐标');
    }
  }, CesiumLib.ScreenSpaceEventType.LEFT_CLICK);

  console.log('[Cesium] 坐标拾取已启用');
}

export function disableCoordinatePicking(viewer) {
  if (coordinateHandler) {
    coordinateHandler.destroy();
    coordinateHandler = null;
  }
  if (coordinateEntity && viewer) {
    viewer.entities.remove(coordinateEntity);
    coordinateEntity = null;
  }
  if (viewer && viewer.scene && viewer.scene.globe) {
    viewer.scene.globe.depthTestAgainstTerrain = false;
  }
  console.log('[Cesium] 坐标拾取已禁用');
}

let measurementHandler = null;
let measurementPoints = [];
let measurementEntities = [];
let measurementCallback = null;

export function startMeasurement(viewer, callback) {
  if (!viewer) {
    console.error('[Cesium] Viewer 未初始化');
    return;
  }

  stopMeasurement(viewer);

  console.log('[Cesium] 启动测量模式');

  viewer.scene.globe.depthTestAgainstTerrain = true;

  measurementHandler = new CesiumLib.ScreenSpaceEventHandler(viewer.scene.canvas);
  measurementCallback = callback;

  measurementHandler.setInputAction((click) => {
    console.log('[Cesium] 测量点击位置:', click.position);

    let cartesian = null;

    const pickedObject = viewer.scene.pick(click.position);

    if (CesiumLib.defined(pickedObject)) {
      const primitiveType = pickedObject.primitive?.constructor?.name;

      if (pickedObject.primitive && pickedObject.primitive.position) {
        cartesian = pickedObject.primitive.position;
      } else if (primitiveType === 'Cesium3DTileset' || pickedObject.primitive?.root) {
        const scenePickPosition = viewer.scene.pickPosition(click.position);
        if (scenePickPosition) {
          cartesian = scenePickPosition;
        }
      }
    }

    if (!cartesian) {
      const ray = viewer.camera.getPickRay(click.position);
      cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    }

    if (cartesian) {
      const cartographic = CesiumLib.Cartographic.fromCartesian(cartesian);
      const longitude = CesiumLib.Math.toDegrees(cartographic.longitude);
      const latitude = CesiumLib.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      const pointData = { longitude, latitude, height, cartesian };
      measurementPoints.push(pointData);

      const pointNum = measurementPoints.length;
      const pointEntity = viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 14,
          color: CesiumLib.Color.fromCssColorString('#ffaa00'),
          outlineColor: CesiumLib.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: `P${pointNum}\n${longitude.toFixed(4)}°\n${latitude.toFixed(4)}°\n${(height - 16.5).toFixed(1)}m`,
          font: '12px monospace',
          fillColor: CesiumLib.Color.WHITE,
          outlineColor: CesiumLib.Color.BLACK,
          outlineWidth: 2,
          style: CesiumLib.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new CesiumLib.Cartesian2(20, -30),
          showBackground: true,
          backgroundColor: new CesiumLib.Color(0.2, 0.1, 0, 0.85),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
      measurementEntities.push(pointEntity);

      if (measurementPoints.length > 1) {
        const prevPoint = measurementPoints[measurementPoints.length - 2];
        const lineEntity = viewer.entities.add({
          polyline: {
            positions: [prevPoint.cartesian, cartesian],
            width: 3,
            material: new CesiumLib.PolylineDashMaterialProperty({
              color: CesiumLib.Color.fromCssColorString('#ffcc00')
            })
          }
        });
        measurementEntities.push(lineEntity);
      }

      console.log('[Cesium] 添加测量点:', longitude, latitude, height);

      if (measurementCallback) {
        measurementCallback({
          points: measurementPoints.map(p => ({ longitude: p.longitude, latitude: p.latitude, height: p.height })),
          totalDistance: calculateTotalDistance()
        });
      }
    }
  }, CesiumLib.ScreenSpaceEventType.LEFT_CLICK);

  console.log('[Cesium] 测量模式已启用');
}

function calculateTotalDistance() {
  let total = 0;
  for (let i = 1; i < measurementPoints.length; i++) {
    const from = CesiumLib.Cartesian3.fromDegrees(
      measurementPoints[i - 1].longitude,
      measurementPoints[i - 1].latitude,
      measurementPoints[i - 1].height
    );
    const to = CesiumLib.Cartesian3.fromDegrees(
      measurementPoints[i].longitude,
      measurementPoints[i].latitude,
      measurementPoints[i].height
    );
    total += CesiumLib.Cartesian3.distance(from, to);
  }
  return total;
}

export function stopMeasurement(viewer) {
  if (measurementHandler) {
    measurementHandler.destroy();
    measurementHandler = null;
  }

  if (viewer && viewer.scene && viewer.scene.globe) {
    viewer.scene.globe.depthTestAgainstTerrain = false;
  }

  measurementCallback = null;
  console.log('[Cesium] 测量模式已停止');
}

export function clearMeasurement(viewer) {
  if (measurementEntities.length > 0) {
    measurementEntities.forEach(entity => {
      viewer.entities.remove(entity);
    });
    measurementEntities = [];
  }

  measurementPoints = [];

  if (measurementCallback) {
    measurementCallback({
      points: [],
      totalDistance: 0
    });
  }

  console.log('[Cesium] 测量数据已清除');
}

let drawHandler = null;
let drawEntities = [];
let areaEntities = [];
let areaLabelEntities = [];
let currentPolygonPoints = [];
let currentPolygonEntity = null;
let drawingCallback = null;
let areaNumber = 1;
let currentEditingArea = null;

export function startDrawingArea(viewer, callback) {
  document.querySelectorAll('.disaster-info-box').forEach(el => el.remove());

  if (!viewer) {
    console.error('[Cesium] Viewer 未初始化');
    return;
  }

  currentPolygonPoints = [];
  currentPolygonEntity = null;

  console.log('[Cesium] 启动受灾区域绘制模式');

  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.screenSpaceCameraController.enableRotate = false;
  viewer.scene.screenSpaceCameraController.enableZoom = false;
  viewer.scene.screenSpaceCameraController.enableTilt = false;
  viewer.scene.screenSpaceCameraController.enableTranslate = false;

  drawHandler = new CesiumLib.ScreenSpaceEventHandler(viewer.scene.canvas);
  drawingCallback = callback;

  drawHandler.setInputAction((click) => {
    const ray = viewer.camera.getPickRay(click.position);
    let cartesian = viewer.scene.globe.pick(ray, viewer.scene);

    if (cartesian) {
      if (!currentPolygonEntity) {
        currentPolygonEntity = viewer.entities.add({
          polygon: {
            hierarchy: new CesiumLib.CallbackProperty(() => {
              if (currentPolygonPoints.length < 3) return null;
              return new CesiumLib.PolygonHierarchy(currentPolygonPoints.map(p => p.position));
            }, false),
            material: CesiumLib.Color.fromCssColorString('#ff6600').withAlpha(0.3)
          }
        });
        drawEntities.push(currentPolygonEntity);
      }

      const pointEntity = viewer.entities.add({
        id: 'area_point_' + areaNumber + '_' + currentPolygonPoints.length,
        position: cartesian,
        point: {
          pixelSize: 10,
          color: CesiumLib.Color.fromCssColorString('#ff6600'),
          outlineColor: CesiumLib.Color.WHITE,
          outlineWidth: 2
        }
      });
      drawEntities.push(pointEntity);

      const cartographic = CesiumLib.Cartographic.fromCartesian(cartesian);
      currentPolygonPoints.push({
        position: cartesian,
        longitude: CesiumLib.Math.toDegrees(cartographic.longitude),
        latitude: CesiumLib.Math.toDegrees(cartographic.latitude),
        height: cartographic.height
      });

      console.log('[Cesium] 添加多边形点:', currentPolygonPoints.length);
    }
  }, CesiumLib.ScreenSpaceEventType.LEFT_CLICK);

  drawHandler.setInputAction((movement) => {
    if (currentPolygonPoints.length === 0) return;

    const ray = viewer.camera.getPickRay(movement.endPosition);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);

    if (cartesian && currentPolygonEntity) {
      const tempPoints = [...currentPolygonPoints, { position: cartesian }];
      currentPolygonEntity.polygon.hierarchy = new CesiumLib.PolygonHierarchy(tempPoints.map(p => p.position));
    }
  }, CesiumLib.ScreenSpaceEventType.MOUSE_MOVE);

  drawHandler.setInputAction(() => {
    if (currentPolygonPoints.length < 3) {
      console.log('[Cesium] 多边形需要至少3个点');
      return;
    }

    if (currentPolygonEntity) {
      const area = calculatePolygonArea(currentPolygonPoints);

      const existingPolygonEntity = currentPolygonEntity;
      try {
        viewer.entities.remove(existingPolygonEntity);
      } catch (e) {}

      const existingEntity = viewer.entities.getById('area_polygon_' + areaNumber);
      if (existingEntity) {
        try {
          viewer.entities.remove(existingEntity);
        } catch (e) {}
      }

      const finalPolygonEntity = viewer.entities.add({
        id: 'area_polygon_' + areaNumber,
        polygon: {
          hierarchy: new CesiumLib.PolygonHierarchy(currentPolygonPoints.map(p => p.position)),
          material: CesiumLib.Color.fromCssColorString('#ff6600').withAlpha(0.2)
        }
      });
      areaEntities.push(finalPolygonEntity);

      const drawingPointEntities = drawEntities.filter(e => e.id && e.id.startsWith('area_point_' + (areaNumber - 1) + '_'));
      drawingPointEntities.forEach(entity => {
        viewer.entities.remove(entity);
      });
      drawEntities = drawEntities.filter(e => !e.id || !e.id.startsWith('area_point_' + (areaNumber - 1) + '_'));

      currentPolygonEntity = null;

      const centerPoint = getPolygonCenter(currentPolygonPoints);
      const areaId = areaNumber;

      const labelEntity = viewer.entities.add({
        position: centerPoint,
        id: 'area_label_' + areaId,
        label: {
          text: `区域${areaId}`,
          font: 'bold 24px sans-serif',
          fillColor: CesiumLib.Color.WHITE,
          outlineColor: CesiumLib.Color.BLACK,
          outlineWidth: 4,
          style: CesiumLib.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new CesiumLib.Cartesian2(0, 0),
          showBackground: true,
          backgroundColor: new CesiumLib.Color(0.6, 0.3, 0, 0.9),
          heightReference: CesiumLib.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new CesiumLib.NearFarScalar(100, 1.0, 2000, 0.3)
        }
      });
      areaLabelEntities.push(labelEntity);

      const info = { 编号: '', 房屋数量: '' };
      const areaData = {
        id: areaId,
        points: currentPolygonPoints.map(p => ({ longitude: p.longitude, latitude: p.latitude, height: p.height })),
        area: area,
        info: info,
        centerPoint: centerPoint
      };

      if (drawingCallback) {
        drawingCallback({
          type: 'add',
          area: areaData
        });
      }

      areaNumber++;
      currentPolygonPoints = [];
      currentPolygonEntity = null;

      console.log('[Cesium] 多边形绘制完成，面积:', area, 'm²');
    }
  }, CesiumLib.ScreenSpaceEventType.RIGHT_CLICK);

  drawHandler.setInputAction(() => {
    if (currentPolygonPoints.length > 0 && currentPolygonEntity) {
      const area = calculatePolygonArea(currentPolygonPoints);

      const existingPolygonEntity = currentPolygonEntity;
      try {
        viewer.entities.remove(existingPolygonEntity);
      } catch (e) {}

      const existingEntity = viewer.entities.getById('area_polygon_' + areaNumber);
      if (existingEntity) {
        try {
          viewer.entities.remove(existingEntity);
        } catch (e) {}
      }

      const finalPolygonEntity = viewer.entities.add({
        id: 'area_polygon_' + areaNumber,
        polygon: {
          hierarchy: new CesiumLib.PolygonHierarchy(currentPolygonPoints.map(p => p.position)),
          material: CesiumLib.Color.fromCssColorString('#ff6600').withAlpha(0.2)
        }
      });
      areaEntities.push(finalPolygonEntity);

      const drawingPointEntities = drawEntities.filter(e => e.id && e.id.startsWith('area_point_' + (areaNumber - 1) + '_'));
      drawingPointEntities.forEach(entity => {
        viewer.entities.remove(entity);
      });
      drawEntities = drawEntities.filter(e => !e.id || !e.id.startsWith('area_point_' + (areaNumber - 1) + '_'));

      currentPolygonEntity = null;

      const centerPoint = getPolygonCenter(currentPolygonPoints);
      const areaId = areaNumber;

      const labelEntity = viewer.entities.add({
        position: centerPoint,
        id: 'area_label_' + areaId,
        label: {
          text: `区域${areaId}`,
          font: 'bold 24px sans-serif',
          fillColor: CesiumLib.Color.WHITE,
          outlineColor: CesiumLib.Color.BLACK,
          outlineWidth: 4,
          style: CesiumLib.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new CesiumLib.Cartesian2(0, 0),
          showBackground: true,
          backgroundColor: new CesiumLib.Color(0.6, 0.3, 0, 0.9),
          heightReference: CesiumLib.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new CesiumLib.NearFarScalar(100, 1.0, 2000, 0.3)
        }
      });
      areaLabelEntities.push(labelEntity);

      const info = { 编号: '', 房屋数量: '' };
      const areaData = {
        id: areaId,
        points: currentPolygonPoints.map(p => ({ longitude: p.longitude, latitude: p.latitude, height: p.height })),
        area: area,
        info: info,
        centerPoint: centerPoint
      };

      if (drawingCallback) {
        drawingCallback({
          type: 'add',
          area: areaData
        });
      }

      areaNumber++;
      currentPolygonPoints = [];
      currentPolygonEntity = null;

      console.log('[Cesium] 双击闭合多边形，面积:', area, 'm²');
    }
  }, CesiumLib.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  console.log('[Cesium] 绘制模式已启用，左键点击添加点，右键点击或双击闭合多边形');
}

function calculatePolygonArea(points) {
  if (points.length < 3) return 0;

  let totalArea = 0;
  const radius = 6371000;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const lat1 = points[i].latitude * Math.PI / 180;
    const lat2 = points[j].latitude * Math.PI / 180;
    const lon1 = points[i].longitude * Math.PI / 180;
    const lon2 = points[j].longitude * Math.PI / 180;

    totalArea += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  totalArea = Math.abs(totalArea * radius * radius / 2);
  return totalArea;
}

function getPolygonCenter(points) {
  let x = 0, y = 0, z = 0;
  points.forEach(p => {
    x += p.position.x;
    y += p.position.y;
    z += p.position.z;
  });
  const count = points.length;
  return new CesiumLib.Cartesian3(x / count, y / count, z / count);
}

export function updateAreaInfo(viewer, areaId, field, value) {
  const labelEntity = viewer.entities.getById('area_label_' + areaId);
  if (labelEntity && field === '编号') {
    if (value && value.trim()) {
      labelEntity.label.text = `区域${areaId}-${value}`;
    } else {
      labelEntity.label.text = `区域${areaId}`;
    }
  }

  if (drawingCallback) {
    drawingCallback({
      type: 'update',
      areaId: areaId,
      field: field,
      value: value
    });
  }
}

export function stopDrawingArea(viewer) {
  if (drawHandler) {
    drawHandler.destroy();
    drawHandler = null;
  }

  if (viewer) {
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
  }

  if (currentPolygonEntity) {
    viewer.entities.remove(currentPolygonEntity);
    currentPolygonEntity = null;
  }

  drawEntities.forEach(entity => {
    viewer.entities.remove(entity);
  });
  drawEntities = [];

  currentPolygonPoints = [];

  console.log('[Cesium] 绘制模式已停止，区域标签已保留');
}

export function finishCurrentArea(viewer) {
  if (!viewer || currentPolygonPoints.length < 3) {
    console.warn('[Cesium] 无法完成区域：点数不足');
    return;
  }

  const area = calculatePolygonArea(currentPolygonPoints);

  if (currentPolygonEntity) {
    try {
      viewer.entities.remove(currentPolygonEntity);
    } catch (e) {}
  }

  const existingEntity = viewer.entities.getById('area_polygon_' + areaNumber);
  if (existingEntity) {
    try {
      viewer.entities.remove(existingEntity);
    } catch (e) {}
  }

  const finalPolygonEntity = viewer.entities.add({
    id: 'area_polygon_' + areaNumber,
    polygon: {
      hierarchy: new CesiumLib.PolygonHierarchy(currentPolygonPoints.map(p => p.position)),
      material: CesiumLib.Color.fromCssColorString('#ff6600').withAlpha(0.2)
    }
  });
  areaEntities.push(finalPolygonEntity);

  const drawingPointEntities = drawEntities.filter(e => e.id && e.id.startsWith('area_point_' + (areaNumber - 1) + '_'));
  drawingPointEntities.forEach(entity => {
    viewer.entities.remove(entity);
  });
  drawEntities = drawEntities.filter(e => !e.id || !e.id.startsWith('area_point_' + (areaNumber - 1) + '_'));

  currentPolygonEntity = null;

  const centerPoint = getPolygonCenter(currentPolygonPoints);
  const areaId = areaNumber;

  const labelEntity = viewer.entities.add({
    position: centerPoint,
    id: 'area_label_' + areaId,
    label: {
      text: `区域${areaId}`,
      font: 'bold 24px sans-serif',
      fillColor: CesiumLib.Color.WHITE,
      outlineColor: CesiumLib.Color.BLACK,
      outlineWidth: 4,
      style: CesiumLib.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new CesiumLib.Cartesian2(0, 0),
      showBackground: true,
      backgroundColor: new CesiumLib.Color(0.6, 0.3, 0, 0.9),
      heightReference: CesiumLib.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new CesiumLib.NearFarScalar(100, 1.0, 2000, 0.3)
    }
  });
  areaLabelEntities.push(labelEntity);

  const info = { 编号: '', 房屋数量: '' };
  const areaData = {
    id: areaId,
    points: currentPolygonPoints.map(p => ({ longitude: p.longitude, latitude: p.latitude, height: p.height })),
    area: area,
    info: info,
    centerPoint: centerPoint
  };

  if (drawingCallback) {
    drawingCallback({
      type: 'add',
      area: areaData
    });
  }

  areaNumber++;
  currentPolygonPoints = [];
  currentPolygonEntity = null;

  console.log('[Cesium] 区域绘制完成，面积:', area, 'm²');
}

export function clearAllAreas(viewer) {
  if (drawEntities.length > 0) {
    drawEntities.forEach(entity => {
      viewer.entities.remove(entity);
    });
    drawEntities = [];
  }

  if (areaEntities.length > 0) {
    areaEntities.forEach(entity => {
      viewer.entities.remove(entity);
    });
    areaEntities = [];
  }

  if (areaLabelEntities.length > 0) {
    areaLabelEntities.forEach(entity => {
      viewer.entities.remove(entity);
    });
    areaLabelEntities = [];
  }

  currentPolygonPoints = [];
  currentPolygonEntity = null;
  areaNumber = 1;

  console.log('[Cesium] 所有区域已清除');
}

export function removeDisasterAreaEntity(viewer, areaId) {
  const entityIdsToRemove = [];

  areaEntities.forEach((entity, index) => {
    if (entity.id === 'area_polygon_' + areaId) {
      entityIdsToRemove.push(entity);
    }
  });

  entityIdsToRemove.forEach(entity => {
    viewer.entities.remove(entity);
    const idx = areaEntities.indexOf(entity);
    if (idx !== -1) {
      areaEntities.splice(idx, 1);
    }
  });

  areaLabelEntities.forEach((entity, index) => {
    if (entity.id === 'area_label_' + areaId) {
      entityIdsToRemove.push(entity);
    }
  });

  entityIdsToRemove.forEach(entity => {
    viewer.entities.remove(entity);
    const idx = areaLabelEntities.indexOf(entity);
    if (idx !== -1) {
      areaLabelEntities.splice(idx, 1);
    }
  });

  console.log('[Cesium] 区域 ' + areaId + ' 已删除');
}
