const radians = value => value * Math.PI / 180;
const maxNodes = 800 * 800;
const maxValues = 12_000_000;

export function finiteNumber(value, label) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      String(value).trim() === '' || !Number.isFinite(Number(value))) {
    throw new Error(label + '必须是有效数值。');
  }
  return Number(value);
}

export function readOrigin(input) {
  const longitude = finiteNumber(input?.longitude, '原点经度');
  const latitude = finiteNumber(input?.latitude, '原点纬度');
  const height = finiteNumber(input?.height ?? 0, '原点高程');
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 85) {
    throw new Error('原点经度须在 ±180° 内，纬度须在 ±85° 内。');
  }
  return { longitude, latitude, height };
}

function ecef(longitude, latitude, height) {
  const lon = radians(longitude);
  const lat = radians(latitude);
  const eccentricity = 6.69437999014e-3;
  const radius = 6378137 / Math.sqrt(1 - eccentricity * Math.sin(lat) ** 2);
  return [
    (radius + height) * Math.cos(lat) * Math.cos(lon),
    (radius + height) * Math.cos(lat) * Math.sin(lon),
    (radius * (1 - eccentricity) + height) * Math.sin(lat),
  ];
}

export function gridCoordinates(longitude, latitude, origin, yaw = 0) {
  const at = ecef(longitude, latitude, origin.height);
  const base = ecef(origin.longitude, origin.latitude, origin.height);
  const [dx, dy, dz] = at.map((value, index) => value - base[index]);
  const lon = radians(origin.longitude);
  const lat = radians(origin.latitude);
  const angle = radians(yaw);
  const east = -Math.sin(lon) * dx + Math.cos(lon) * dy;
  const north = -Math.sin(lat) * Math.cos(lon) * dx - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz;
  return [
    east * Math.cos(angle) + north * Math.sin(angle),
    -east * Math.sin(angle) + north * Math.cos(angle),
  ];
}

export function validateDepth(input) {
  if (!input?.grid || !Array.isArray(input.frames)) {
    throw new Error('JSON 需要包含 origin、grid、bed 和 frames。');
  }
  const { grid, frames } = input;
  const nx = finiteNumber(grid.nx, '横向网格数');
  const ny = finiteNumber(grid.ny, '纵向网格数');
  const dx = finiteNumber(grid.dx, '横向间距');
  const dy = finiteNumber(grid.dy, '纵向间距');
  const x0 = finiteNumber(grid.x0, '网格起点 x');
  const y0 = finiteNumber(grid.y0, '网格起点 y');
  if (![nx, ny].every(n => Number.isInteger(n) && n >= 2 && n <= 800) || dx <= 0 || dy <= 0) {
    throw new Error('网格行列数须为 2–800 的整数，网格间距须大于零。');
  }
  const size = nx * ny;
  if (!frames.length || frames.length > 2000 || frames.length * size > maxValues) {
    throw new Error('最多导入 2,000 帧和 1,200 万个水深值，请拆分或降低分辨率。');
  }
  function valueArray(values, label) {
    if (!Array.isArray(values) || values.length !== size) throw new Error(label + '的长度必须等于 nx × ny。');
    return values.map(value => finiteNumber(value, label));
  }
  const bed = valueArray(input.bed, '底床高程');
  const valid = input.valid ?? Array(size).fill(true);
  if (!Array.isArray(valid) || valid.length !== size ||
      !valid.every(value => typeof value === 'boolean' || value === 0 || value === 1)) {
    throw new Error('有效网格掩码 valid 须为等长的布尔数组或 0/1 数组。');
  }
  let previousTime = -Infinity;
  const normalizedFrames = frames.map(frame => {
    const time = finiteNumber(frame?.time, '时刻');
    if (time <= previousTime) throw new Error('时间必须严格递增。');
    previousTime = time;
    const depth = valueArray(frame.depth, '水深').map(value => {
      if (value < -1e-8) throw new Error('水深必须是非负数。');
      return Math.max(0, value);
    });
    return { time, depth };
  });
  return {
    version: 1,
    name: String(input.name || '导入的水深数据').slice(0, 100),
    source_type: ['demonstration', 'format_example', 'openfoam'].includes(input.source_type) ? input.source_type : 'imported',
    method: String(input.method || '采用导入的水深字段').slice(0, 1000),
    vertical_datum: String(input.vertical_datum || '未声明').slice(0, 100),
    origin: readOrigin(input.origin),
    yaw: finiteNumber(input.yaw ?? 0, '坐标旋转角'),
    grid: { nx, ny, dx, dy, x0, y0 },
    bed,
    valid: valid.map(Boolean),
    frames: normalizedFrames,
  };
}

function regularSpacing(values) {
  const spacing = (values.at(-1) - values[0]) / (values.length - 1);
  if (values.length < 2 || spacing <= 0 ||
      values.some((value, i) => Math.abs(value - values[0] - i * spacing) > Math.max(0.002, spacing * 0.002))) {
    throw new Error('CSV 需包含至少 2 × 2 个点的规则网格。');
  }
  return spacing;
}

export function parseDepthCsv(text, metadata) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const fields = lines.shift().split(',').map(name => name.trim().toLowerCase().replace(/^"|"$/g, ''));
  const indexes = Object.fromEntries(fields.map((name, index) => [name, index]));
  const origin = readOrigin(metadata);
  const yaw = finiteNumber(metadata.yaw || 0, '坐标旋转角');
  const geographic = 'longitude' in indexes && 'latitude' in indexes;
  const bedIndex = indexes.bed ?? indexes.bed_elevation;
  const depthIndex = indexes.depth ?? indexes.h;
  if ((!geographic && !('x' in indexes && 'y' in indexes)) || bedIndex == null || depthIndex == null || !('time' in indexes)) {
    throw new Error('CSV 需要 time、x、y、bed、depth 列。坐标也可用 longitude、latitude，水深列可用 h。');
  }
  const rows = [];
  const xValues = new Set();
  const yValues = new Set();
  const times = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
    const lon = geographic ? finiteNumber(row[indexes.longitude], '经度') : 0;
    const lat = geographic ? finiteNumber(row[indexes.latitude], '纬度') : 0;
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error('CSV 经度或纬度超出范围。');
    const xy = geographic
      ? gridCoordinates(lon, lat, origin, yaw)
      : [finiteNumber(row[indexes.x], 'x 坐标'), finiteNumber(row[indexes.y], 'y 坐标')];
    const [x, y] = xy.map(value => Math.round(value * 10000) / 10000);
    const time = finiteNumber(row[indexes.time], '时刻');
    rows.push({ x, y, time, bed: finiteNumber(row[bedIndex], '底床高程'), depth: finiteNumber(row[depthIndex], '水深') });
    xValues.add(x);
    yValues.add(y);
    times.add(time);
  }
  const xs = [...xValues].sort((a, b) => a - b);
  const ys = [...yValues].sort((a, b) => a - b);
  const size = xs.length * ys.length;
  if (xs.length > 800 || ys.length > 800 || size > maxNodes || size * times.size > maxValues || times.size > 2000) {
    throw new Error('CSV 网格或时间步太多，请分段导出后导入。');
  }
  const dx = regularSpacing(xs);
  const dy = regularSpacing(ys);
  const xIndex = new Map(xs.map((value, index) => [value, index]));
  const yIndex = new Map(ys.map((value, index) => [value, index]));
  const frames = new Map([...times].sort((a, b) => a - b).map(time => [time, { time, depth: Array(size).fill(null) }]));
  const bed = Array(size).fill(null);
  for (const row of rows) {
    const index = yIndex.get(row.y) * xs.length + xIndex.get(row.x);
    const frame = frames.get(row.time);
    if (frame.depth[index] !== null) throw new Error('CSV 在同一时刻重复记录了同一个位置。');
    if (bed[index] !== null && Math.abs(bed[index] - row.bed) > 1e-6) {
      throw new Error('同一位置的底床高程应在各时刻一致。请先导出固定底床水深。');
    }
    frame.depth[index] = row.depth;
    bed[index] = row.bed;
  }
  if (rows.length !== size * times.size) throw new Error('每个时刻都需要完整网格，请补齐缺测或使用 JSON 的有效掩码。');
  return validateDepth({
    ...metadata, origin, yaw, bed, frames: [...frames.values()],
    grid: { nx: xs.length, ny: ys.length, x0: xs[0], y0: ys[0], dx, dy },
  });
}

export function queryDepth(dataset, longitude, latitude, frameIndex) {
  longitude = finiteNumber(longitude, '经度');
  latitude = finiteNumber(latitude, '纬度');
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) throw new Error('查询经纬度超出范围。');
  const [x, y] = gridCoordinates(longitude, latitude, dataset.origin, dataset.yaw);
  const { nx, ny, x0, y0, dx, dy } = dataset.grid;
  const fx = (x - x0) / dx;
  const fy = (y - y0) / dy;
  const point = { longitude, latitude };
  const tolerance = 1e-8;
  if (fx < -tolerance || fy < -tolerance || fx > nx - 1 + tolerance || fy > ny - 1 + tolerance) {
    return { ...point, status: 'outside', depth: null, message: '该点超出模拟网格范围。' };
  }
  const u = Math.min(nx - 1, Math.max(0, fx));
  const v = Math.min(ny - 1, Math.max(0, fy));
  const i = Math.min(Math.floor(u), nx - 2);
  const j = Math.min(Math.floor(v), ny - 2);
  const a = u - i;
  const b = v - j;
  const index = j * nx + i;
  const indices = [index, index + 1, index + nx, index + nx + 1];
  const weights = [(1 - a) * (1 - b), a * (1 - b), (1 - a) * b, a * b];
  if (indices.some((k, n) => weights[n] > 1e-10 && !dataset.valid[k])) {
    return { ...point, status: 'nodata', depth: null, message: '该点没有有效计算网格。' };
  }
  const interpolate = array => indices.reduce((sum, k, n) => sum + weights[n] * array[k], 0);
  const history = dataset.frames.map(frame => interpolate(frame.depth));
  const times = dataset.frames.map(frame => frame.time);
  const depth = history[frameIndex];
  return {
    ...point, depth, history, times, status: depth > 0.01 ? 'wet' : 'dry',
    water_surface: interpolate(dataset.bed) + dataset.origin.height + depth,
    maximum_depth: Math.max(...history),
    first_wet_time: times[history.findIndex(value => value > 0.01)] ?? null,
  };
}
