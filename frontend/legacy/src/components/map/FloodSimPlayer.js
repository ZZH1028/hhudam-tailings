// src/components/map/FloodSimPlayer.js
import * as Cesium from 'cesium';

export class FloodSimPlayer {
  constructor(viewer, frames = null, options = {}) {
    if (!viewer) throw new Error('[FloodSimPlayer] viewer is required');
    this.viewer = viewer;

    this.options = {
      durationSeconds: 20,
      fps: 20,

      baseHeight: 0,
      bottomOffset: -20,

      // demo 演示参数
      demoCenter: { lon: 111.123, lat: 30.123 },
      demoMaxRadiusMeters: 1500,
      demoMaxDepthMeters: 25,
      demoGridStepMeters: 80,

      // Water 真材质
      water: {
        normalMap: Cesium.buildModuleUrl('Assets/Textures/waterNormals.jpg'),
        frequency: 1700.0,
        animationSpeed: 0.06,
        amplitude: 8.0,
        specularIntensity: 0.95,
        baseWaterColor: new Cesium.Color(0.02, 0.22, 0.35, 0.92),
        blendColor: new Cesium.Color(0.0, 0.78, 0.98, 0.38),
      },
      alphaTop: 0.80,

      sideColor: new Cesium.Color(0.02, 0.18, 0.28, 0.55),

      // 容错
      maxPointsPerFrame: 200000,
      minGridCoverage: 0.55,
      log: true,


      mode: 'prebuild',

      ...options
    };

    // 播放状态
    this._playing = false;
    this._pausedAt = 0;        // 暂停时刻（秒）
    this._startPerf = null;    // performance.now() 基准
    this._tickHandler = null;

    // ✅ 倍速：UI slider 调用 setSpeed
    this._speed = 1;

    // 帧数据：[{t, grid}]
    this._frames = [];
    this._currentIndex = -1;

    // prebuild：每帧 {top,side}
    this._built = [];

    // doubleBuffer：当前 {top,side}
    this._active = { top: null, side: null };

    // 初始化数据：有外部 frames 就用，否则用 demo
    if (frames && Array.isArray(frames) && frames.length) {
      this.setFramesFromDepthGridFrames(frames);
    } else {
      const demo = this._buildDemoDepthFrames();
      this.setFramesFromDepthGridFrames(demo);
    }
  }


  play() {
    if (this._playing) return;
    if (!this._frames.length) return;

    // 预构建
    if (this.options.mode === 'prebuild' && !this._built.length) {
      this._prebuildAllFrames();
    }

    // 从暂停处继续：把 startPerf 往回推
    this._playing = true;
    this._startPerf = performance.now() - (this._pausedAt * 1000) / this._speed;

    this._bindTick();
  }

  pause() {
    if (!this._playing) return;
    // 记录暂停时刻
    this._pausedAt = this._getElapsedSeconds();
    this._playing = false;
    this._unbindTick();
  }

  stop() {
    // 停止并回到第 0 帧（不清理 prebuild）
    this.pause();
    this._pausedAt = 0;
    this._showFrame(0);
  }

  replay() {
    // 彻底从头播放
    this.pause();
    this._pausedAt = 0;
    this._showFrame(0);
    this.play();
  }

  stopAndClear() {
    // 清理所有 primitive
    this.pause();
    this._pausedAt = 0;
    this._clearAllPrimitives();
    this._built = [];
    this._active = { top: null, side: null };
    this._currentIndex = -1;
  }

  destroy() {
    this.stopAndClear();
  }


  setSpeed(speed) {
    const s = Number(speed);
    if (!Number.isFinite(s) || s <= 0) return;

    // 改速时保持“当前播放进度不跳”
    const elapsed = this._getElapsedSeconds();
    this._speed = s;

    if (this._playing) {
      // 重新对齐 startPerf，使得 elapsed 不变
      this._startPerf = performance.now() - (elapsed * 1000) / this._speed;
    } else {
      // 暂停状态：只更新 pausedAt，不动画面
      this._pausedAt = elapsed;
    }
  }

  getSpeed() {
    return this._speed;
  }

  isPlaying() {
    return this._playing;
  }

  // =========================
  // ✅ 未来真实数据入口（每点水深）
  // =========================

  setFramesFromDepthGridFrames(frames) {
    const normalized = this._normalizeFrames(frames);
    const parsed = [];

    for (const f of normalized) {
      const grid = this._tryBuildGrid(f.points);
      if (!grid) continue; // 跳过异常帧，避免报错/黑屏
      parsed.push({ t: f.t, grid });
    }

    this._frames = parsed;

    // 切换数据后清理旧画面（保守最稳）
    this.stopAndClear();

    if (this.options.log) {
      console.log('[FloodSimPlayer] frames ready:', this._frames.length);
    }
  }

  // =========================
  // Tick / 播放
  // =========================

  _bindTick() {
    if (this._tickHandler) return;

    this._tickHandler = () => {
      if (!this._playing) return;

      const elapsed = this._getElapsedSeconds();
      const duration = this.options.durationSeconds;

      const p = Math.min(1, Math.max(0, elapsed / duration));
      const idx = Math.min(this._frames.length - 1, Math.floor(p * (this._frames.length - 1)));

      if (idx !== this._currentIndex) {
        this._showFrame(idx);
      }

      if (elapsed >= duration) {
        this.pause();
      }
      this.viewer.scene.requestRender();
    };

    // 确保 tick 一直走
    this.viewer.clock.shouldAnimate = true;
    this.viewer.clock.onTick.addEventListener(this._tickHandler);
  }

  _unbindTick() {
    if (this._tickHandler) {
      this.viewer.clock.onTick.removeEventListener(this._tickHandler);
      this._tickHandler = null;
    }
  }

  _getElapsedSeconds() {
    if (this._playing && this._startPerf != null) {
      const raw = (performance.now() - this._startPerf) / 1000;
      return raw * this._speed;
    }
    return this._pausedAt || 0;
  }

  _showFrame(idx) {
    if (!this._frames.length) return;
    idx = Math.max(0, Math.min(this._frames.length - 1, idx));

    if (this.options.mode === 'prebuild') {
      if (!this._built.length) return;

      if (this._currentIndex >= 0 && this._built[this._currentIndex]) {
        this._setPairShow(this._built[this._currentIndex], false);
      }
      if (this._built[idx]) {
        this._setPairShow(this._built[idx], true);
      }
      this._currentIndex = idx;
      return;
    }

    // doubleBuffer：先显示新，再移除旧（避免空帧闪）
    const frame = this._frames[idx];
    const nextPair = this._createFramePrimitives(frame.grid);
    if (!nextPair) return;

    this._setPairShow(nextPair, true);
    this._removePair(this._active);

    this._active = nextPair;
    this._currentIndex = idx;
  }

  // =========================
  // 预构建（演示推荐）
  // =========================

  _prebuildAllFrames() {
    this._clearAllPrimitives();
    this._built = [];

    for (let i = 0; i < this._frames.length; i++) {
      const pair = this._createFramePrimitives(this._frames[i].grid);
      if (!pair) continue;

      this._setPairShow(pair, false);
      this._built[i] = pair;
    }

    if (this._built[0]) {
      this._setPairShow(this._built[0], true);
      this._currentIndex = 0;
    }

    if (this.options.log) {
      console.log('[FloodSimPlayer] prebuilt primitives:', this._built.length);
    }
  }

  // =========================
  // Primitive 构建：真水 + 侧壁
  // =========================

  _createFramePrimitives(grid) {
    try {
      const topMesh = this._buildTopMesh(grid);
      const sideMesh = this._buildSideMesh(grid, topMesh.topPositions);

      const top = this._createTopPrimitive(topMesh);
      const side = this._createSidePrimitive(sideMesh);

      return { top, side };
    } catch (e) {
      // ✅ 绝不能把异常抛出去，否则 Cesium 渲染可能 stop -> 黑屏
      if (this.options.log) console.error('[FloodSimPlayer] createFrame failed:', e);
      return null;
    }
  }

  _createTopPrimitive(topMesh) {
    const opt = this.options;
    const VERTEX_FORMAT_TOP = Cesium.VertexFormat.POSITION_AND_ST;

    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: topMesh.positions
        }),
        st: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: topMesh.st
        })
      },
      indices: topMesh.indices,
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      boundingSphere: Cesium.BoundingSphere.fromVertices(topMesh.positions),
      vertexFormat: VERTEX_FORMAT_TOP
    });

    const instance = new Cesium.GeometryInstance({ geometry });

    const waterMat = new Cesium.Material({
      fabric: {
        type: 'Water',
        uniforms: {
          normalMap: opt.water.normalMap,
          frequency: opt.water.frequency,
          animationSpeed: opt.water.animationSpeed,
          amplitude: opt.water.amplitude,
          specularIntensity: opt.water.specularIntensity,
          baseWaterColor: Cesium.Color.fromAlpha(opt.water.baseWaterColor, opt.alphaTop),
          blendColor: Cesium.Color.fromAlpha(opt.water.blendColor, opt.alphaTop)
        }
      }
    });

    // ✅ 必须：EllipsoidSurfaceAppearance，避免 compressedAttributes mismatch
    const appearance = new Cesium.EllipsoidSurfaceAppearance({
      material: waterMat,
      aboveGround: true,
      vertexFormat: VERTEX_FORMAT_TOP
    });

    return this.viewer.scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: instance,
        appearance,
        asynchronous: false
      })
    );
  }

  _createSidePrimitive(sideMesh) {
    const opt = this.options;
    const VERTEX_FORMAT_SIDE = Cesium.VertexFormat.POSITION_ONLY;

    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: sideMesh.positions
        })
      },
      indices: sideMesh.indices,
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      boundingSphere: Cesium.BoundingSphere.fromVertices(sideMesh.positions),
      vertexFormat: VERTEX_FORMAT_SIDE
    });

    const instance = new Cesium.GeometryInstance({
      geometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(opt.sideColor)
      }
    });

    const appearance = new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
      vertexFormat: VERTEX_FORMAT_SIDE
    });

    return this.viewer.scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: instance,
        appearance,
        asynchronous: false
      })
    );
  }

  _setPairShow(pair, show) {
    if (!pair) return;
    if (pair.top) pair.top.show = show;
    if (pair.side) pair.side.show = show;
  }

  _removePair(pair) {
    const s = this.viewer.scene.primitives;
    try { if (pair?.top) s.remove(pair.top); } catch (_) {}
    try { if (pair?.side) s.remove(pair.side); } catch (_) {}
  }

  _clearAllPrimitives() {
    for (const p of this._built) {
      if (p) this._removePair(p);
    }
    this._removePair(this._active);
  }

  // =========================
  // 网格 / 几何
  // =========================

  _buildTopMesh(grid) {
    const { rows, cols, lons, lats, depthMatrix } = grid;
    const opt = this.options;
    const baseH = Number(opt.baseHeight) || 0;

    const positions = new Float64Array(rows * cols * 3);
    const st = new Float32Array(rows * cols * 2);
    const topPositions = new Array(rows * cols);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const lon = lons[c];
        const lat = lats[r];
        const depth = depthMatrix[r][c] || 0;
        const h = baseH + depth;

        const cart = Cesium.Cartesian3.fromDegrees(lon, lat, h);
        topPositions[idx] = cart;

        positions[idx * 3 + 0] = cart.x;
        positions[idx * 3 + 1] = cart.y;
        positions[idx * 3 + 2] = cart.z;

        st[idx * 2 + 0] = cols === 1 ? 0 : c / (cols - 1);
        st[idx * 2 + 1] = rows === 1 ? 0 : r / (rows - 1);
      }
    }

    const quadCount = Math.max(0, (rows - 1) * (cols - 1));
    const indices = new Uint32Array(quadCount * 6);
    let k = 0;

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i0 = r * cols + c;
        const i1 = r * cols + (c + 1);
        const i2 = (r + 1) * cols + c;
        const i3 = (r + 1) * cols + (c + 1);

        indices[k++] = i0; indices[k++] = i2; indices[k++] = i1;
        indices[k++] = i1; indices[k++] = i2; indices[k++] = i3;
      }
    }

    return { positions, st, indices, topPositions };
  }

  _buildSideMesh(grid, topPositions) {
    const { rows, cols } = grid;
    const opt = this.options;
    const baseH = Number(opt.baseHeight) || 0;
    const bottom = baseH + (Number(opt.bottomOffset) || 0);

    const ring = [];
    for (let c = 0; c < cols; c++) ring.push(0 * cols + c);
    for (let r = 1; r < rows - 1; r++) ring.push(r * cols + (cols - 1));
    for (let c = cols - 1; c >= 0; c--) ring.push((rows - 1) * cols + c);
    for (let r = rows - 2; r >= 1; r--) ring.push(r * cols + 0);

    const n = ring.length;
    const positions = new Float64Array(n * 2 * 3);

    for (let i = 0; i < n; i++) {
      const idx = ring[i];
      const top = topPositions[idx];

      positions[(i * 2 + 0) * 3 + 0] = top.x;
      positions[(i * 2 + 0) * 3 + 1] = top.y;
      positions[(i * 2 + 0) * 3 + 2] = top.z;

      const carto = Cesium.Cartographic.fromCartesian(top);
      const bot = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, bottom);

      positions[(i * 2 + 1) * 3 + 0] = bot.x;
      positions[(i * 2 + 1) * 3 + 1] = bot.y;
      positions[(i * 2 + 1) * 3 + 2] = bot.z;
    }

    const indices = new Uint32Array(n * 6);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;

      const t0 = i * 2 + 0;
      const b0 = i * 2 + 1;
      const t1 = next * 2 + 0;
      const b1 = next * 2 + 1;

      indices[k++] = t0; indices[k++] = b0; indices[k++] = t1;
      indices[k++] = t1; indices[k++] = b0; indices[k++] = b1;
    }

    return { positions, indices };
  }

  // =========================
  // points -> 规则网格 depthMatrix
  // =========================

  _tryBuildGrid(points) {
    if (!Array.isArray(points) || !points.length) return null;

    const maxN = this.options.maxPointsPerFrame;
    const pts = points.length > maxN ? points.slice(0, maxN) : points;

    const round6 = (x) => Math.round(x * 1e6) / 1e6;

    const lonSet = new Set();
    const latSet = new Set();
    const cleaned = [];

    for (const p of pts) {
      const lon = Number(p.lon);
      const lat = Number(p.lat);
      const depth = Number(p.depth);
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(depth)) continue;

      const lo = round6(lon);
      const la = round6(lat);
      lonSet.add(lo);
      latSet.add(la);
      cleaned.push({ lo, la, depth: Math.max(0, depth) });
    }

    const lons = Array.from(lonSet).sort((a, b) => a - b);
    const lats = Array.from(latSet).sort((a, b) => a - b);
    if (lons.length < 2 || lats.length < 2) return null;

    const cols = lons.length;
    const rows = lats.length;

    const lonIndex = new Map();
    const latIndex = new Map();
    lons.forEach((v, i) => lonIndex.set(v, i));
    lats.forEach((v, i) => latIndex.set(v, i));

    const depthMatrix = Array.from({ length: rows }, () => Array(cols).fill(0));
    let filled = 0;

    for (const p of cleaned) {
      const r = latIndex.get(p.la);
      const c = lonIndex.get(p.lo);
      if (r == null || c == null) continue;
      depthMatrix[r][c] = p.depth;
      filled++;
    }

    const coverage = filled / (rows * cols);
    if (coverage < this.options.minGridCoverage) {
      if (this.options.log) {
        console.warn('[FloodSimPlayer] frame skipped: grid coverage too low', coverage);
      }
      return null;
    }

    return { rows, cols, lons, lats, depthMatrix };
  }

  _normalizeFrames(frames) {
    const out = (Array.isArray(frames) ? frames : [])
      .map((f, idx) => ({
        t: Number.isFinite(Number(f.t)) ? Number(f.t) : idx,
        points: Array.isArray(f.points) ? f.points : []
      }))
      .sort((a, b) => a.t - b.t);

    const t0 = out[0]?.t ?? 0;
    for (const f of out) f.t = f.t - t0;
    return out;
  }

  // =========================
  // Demo：20秒 水源扩散 + 抬升 + 波浪
  // =========================

  _buildDemoDepthFrames() {
    const opt = this.options;

    const duration = opt.durationSeconds;
    const fps = opt.fps;
    const nFrames = Math.max(20, Math.floor(duration * fps));

    const center = opt.demoCenter;
    const maxR = opt.demoMaxRadiusMeters;
    const maxD = opt.demoMaxDepthMeters;
    const step = opt.demoGridStepMeters;

    const half = maxR;
    const count = Math.max(10, Math.floor((half * 2) / step));

    const metersToLon = (m) => m / (111320 * Math.cos(center.lat * Math.PI / 180));
    const metersToLat = (m) => m / 110540;

    const lon0 = center.lon - metersToLon(half);
    const lat0 = center.lat - metersToLat(half);

    const dLon = metersToLon((half * 2) / (count - 1));
    const dLat = metersToLat((half * 2) / (count - 1));

    const frames = [];

    for (let fi = 0; fi <= nFrames; fi++) {
      const p = fi / nFrames;
      const t = p * duration;

      const ease = 1 - Math.pow(1 - p, 2.2);
      const R = 30 + maxR * ease;
      const baseDepth = maxD * ease;

      const pts = [];
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          const lon = lon0 + c * dLon;
          const lat = lat0 + r * dLat;

          const dx = (lon - center.lon) * (111320 * Math.cos(center.lat * Math.PI / 180));
          const dy = (lat - center.lat) * 110540;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let depth = 0;
          if (dist <= R) {
            const edge = 1 - dist / R;
            depth = baseDepth * (0.35 + 0.65 * edge);

            // 波浪（距离+时间）
            depth += 1.2 * Math.sin(dist / 55 + t * 3.2);
            depth = Math.max(0, depth);
          }

          pts.push({ lon, lat, depth });
        }
      }

      frames.push({ t, points: pts });
    }

    return frames;
  }
}

export function createFloodSimPlayer(viewer, frames, options) {
  return new FloodSimPlayer(viewer, frames, options);
}
