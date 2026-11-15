import * as C from 'cesium';

const source = `
czm_material czm_getMaterial(czm_materialInput input) {
    czm_material material = czm_getDefaultMaterial(input);
    float depth = input.st.x;
    float speed = input.st.y;
    if (depth < 0.018) discard;
    if (depthPalette > 0.5) {
        vec3 color = vec3(0.545, 0.859, 0.929);
        if (depth > 0.25) color = vec3(0.302, 0.722, 0.851);
        if (depth > 0.50) color = vec3(0.133, 0.553, 0.816);
        if (depth > 1.00) color = vec3(0.188, 0.404, 0.780);
        if (depth > 2.00) color = vec3(0.376, 0.271, 0.725);
        if (depth > 4.00) color = vec3(0.612, 0.282, 0.718);
        material.diffuse = czm_gammaCorrect(color);
        material.alpha = 0.78;
        return material;
    }
    vec3 nearby = czm_inverseViewRotation * (-input.positionToEyeEC) + eyeOffset;
    vec2 p = vec2(dot(nearby, east), dot(nearby, north));
    float travel = clockSeconds * (1.0 + min(speed, 10.0) * 0.18);
    float curl = sin(0.082 * p.y + 0.095 * p.x - travel * 0.56);
    float streak = sin(0.29 * p.y + 0.045 * p.x + curl * 1.9 - travel * 0.49);
    float waveA = sin(p.x * 1.44 + p.y * 0.25 - travel * 1.7);
    float waveB = cos(p.y * 1.21 - p.x * 0.78 + travel * 0.65);
    vec3 normal = normalize(input.normalEC + czm_viewRotation * (east * waveA + north * waveB) * 0.12);
    vec3 eye = normalize(input.positionToEyeEC);
    float fresnel = pow(1.0 - clamp(dot(eye, normal), 0.0, 1.0), 3.0);
    float sparkle = pow(max(dot(normal, normalize(eye + czm_sunDirectionEC)), 0.0), 36.0);
    float fast = smoothstep(0.7, 6.3, speed);
    vec3 still = mix(vec3(0.17, 0.31, 0.28), vec3(0.26, 0.42, 0.41), fresnel);
    vec3 sediment = mix(vec3(0.42, 0.32, 0.21), vec3(0.54, 0.45, 0.31), 0.5 + 0.5 * curl);
    vec3 color = mix(still, sediment, 0.82 * fast);
    color += 0.15 * fresnel + 0.13 * sparkle + waveA * waveB * 0.024;
    float strands = smoothstep(0.78, 0.99, streak + 0.22 * waveA * waveB);
    float foam = clamp(strands * fast * 0.43 + (1.0 - smoothstep(0.06, 0.43, depth)) * fast * (0.1 + 0.26 * streak), 0.0, 0.68);
    material.diffuse = czm_gammaCorrect(mix(color, vec3(0.9, 0.86, 0.72), foam));
    material.alpha = mix(0.50, 0.95, smoothstep(0.01, 1.25, depth));
    return material;
}
`;

export function gridMatrix(dataset) {
  const { longitude, latitude, height } = dataset.origin;
  const enu = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(longitude, latitude, height));
  const rotation = C.Matrix3.fromRotationZ(C.Math.toRadians(dataset.yaw || 0));
  return C.Matrix4.multiplyByMatrix3(enu, rotation, enu);
}

export function buildSurface(dataset, snapshot, matrix, palette) {
  const { grid, valid } = dataset;
  const { nx, ny, dx, dy, x0, y0 } = grid;
  const stride = Math.max(1, Math.ceil(Math.sqrt(nx * ny / 100000)));
  const { bed, depth, speed } = snapshot;
  const positions = [];
  const normals = [];
  const attributes = [];
  const indices = [];
  const vertex = new Map();

  function index(x, y) {
    const key = y * nx + x;
    if (vertex.has(key)) return vertex.get(key);
    const slot = positions.length / 3;
    vertex.set(key, slot);
    positions.push(x0 + dx * x, y0 + dy * y, bed[key] + depth[key] + 0.05);
    normals.push(0, 0, 1);
    attributes.push(depth[key], speed?.[key] || 0);
    return slot;
  }

  for (let y = 0; y < ny - 1; y += stride) {
    const top = Math.min(ny - 1, y + stride);
    for (let x = 0; x < nx - 1; x += stride) {
      const right = Math.min(nx - 1, x + stride);
      const a = y * nx + x;
      const b = y * nx + right;
      const c = top * nx + x;
      const d = top * nx + right;
      if (!(valid[a] && valid[b] && valid[c] && valid[d])) continue;
      if (Math.max(depth[a], depth[b], depth[c], depth[d]) < 0.018) continue;
      let complete = true;
      for (let row = y; row <= top && complete && stride > 1; row++) {
        for (let column = x; column <= right; column++) {
          if (!valid[row * nx + column]) {
            complete = false;
            break;
          }
        }
      }
      if (!complete) continue;
      const lowLeft = index(x, y);
      const lowRight = index(right, y);
      const topLeft = index(x, top);
      const topRight = index(right, top);
      indices.push(lowLeft, lowRight, topRight, lowLeft, topRight, topLeft);
    }
  }
  if (!indices.length) return null;

  const positionValues = new Float64Array(positions);
  const makeAttribute = (values, size, type) => new C.GeometryAttribute({
    values, componentsPerAttribute: size, componentDatatype: type,
  });
  const geometry = new C.Geometry({
    attributes: {
      position: makeAttribute(positionValues, 3, C.ComponentDatatype.DOUBLE),
      normal: makeAttribute(new Float32Array(normals), 3, C.ComponentDatatype.FLOAT),
      st: makeAttribute(new Float32Array(attributes), 2, C.ComponentDatatype.FLOAT),
    },
    indices: C.IndexDatatype.createTypedArray(vertex.size, indices),
    primitiveType: C.PrimitiveType.TRIANGLES,
    boundingSphere: C.BoundingSphere.fromVertices(positionValues),
  });
  return new C.Primitive({
    geometryInstances: new C.GeometryInstance({ geometry, modelMatrix: matrix }),
    appearance: new C.MaterialAppearance({
      material: palette, materialSupport: C.MaterialAppearance.MaterialSupport.TEXTURED,
      flat: true, faceForward: true, translucent: true,
    }),
    asynchronous: false,
    allowPicking: false,
    compressVertices: false,
  });
}

export function waterMaterial(matrix) {
  return new C.Material({ fabric: {
    uniforms: {
      depthPalette: 0,
      clockSeconds: 0,
      east: C.Matrix4.multiplyByPointAsVector(matrix, C.Cartesian3.UNIT_X, new C.Cartesian3()),
      north: C.Matrix4.multiplyByPointAsVector(matrix, C.Cartesian3.UNIT_Y, new C.Cartesian3()),
      eyeOffset: new C.Cartesian3(),
    },
    source,
  }, translucent: true });
}
