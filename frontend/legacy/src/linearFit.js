function number(value) {
  return value !== null && ['number', 'string'].includes(typeof value) && String(value).trim() !== ''
    ? Number(value) : NaN;
}

function parsePairs(text) {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) return [];
  if (/^[{\[]/.test(source)) {
    let data;
    try { data = JSON.parse(source); }
    catch { throw new Error('JSON 格式有误，请检查括号及逗号。'); }
    data = data?.data ?? data?.validation_data ?? data;
    if (Array.isArray(data?.x) && Array.isArray(data?.y) && data.x.length === data.y.length) {
      return data.x.map((value, i) => [value, data.y[i]]);
    }
    if (!Array.isArray(data)) throw new Error('请提供 [x, y] 数组或数量相同的 x、y 列。');
    return data.map(row => Array.isArray(row) ? row : [row?.x ?? row?.X, row?.y ?? row?.Y]);
  }
  const tokens = source.split(/[,|\s]+/).map(token => token.replace(/^"|"$/g, ''));
  const firstRow = source.split(/\r?\n/, 1)[0].split(/[,|\s]+/);
  if (source.includes('\n') && firstRow.length === 2 && firstRow.every(value => !Number.isFinite(number(value)))) {
    tokens.splice(0, 2);
  }
  if (tokens.length % 2 !== 0) throw new Error('请按两列输入 x 和 y。');
  const pairs = [];
  for (let i = 0; i < tokens.length; i += 2) pairs.push([tokens[i], tokens[i + 1]]);
  return pairs;
}

export async function regressionSamples(file, text) {
  if (file) {
    const bytes = await file.arrayBuffer();
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('gbk').decode(bytes); }
  }
  const pairs = parsePairs(text).map(pair => [number(pair[0]), number(pair[1])]);
  if (pairs.some(pair => !pair.every(Number.isFinite))) throw new Error('每个样本都需包含两个有效数值。');
  return pairs;
}

export function evaluateLinearModel(samples, model) {
  if (!samples.length) throw new Error('至少需要一个样本。');
  const predictions = samples.map(([x]) => model.coefficient * x + model.intercept);
  const mse = samples.reduce((sum, [, y], i) => sum + (predictions[i] - y) ** 2, 0) / samples.length;
  if (!Number.isFinite(mse) || !Number.isFinite(model.coefficient + model.intercept)) {
    throw new Error('样本数值超出可计算范围。');
  }
  return { ...model, predictions, mse };
}

export function trainLinearModel(samples) {
  const count = samples.length;
  if (count < 2) throw new Error('训练数据至少需要 2 个样本点。');
  const meanX = samples.reduce((sum, [x]) => sum + x / count, 0);
  const meanY = samples.reduce((sum, [, y]) => sum + y / count, 0);
  const variance = samples.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  if (variance === 0) throw new Error('无法拟合，x 值需包含不同取值。');
  const covariance = samples.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const coefficient = covariance / variance;
  return evaluateLinearModel(samples, { coefficient, intercept: meanY - coefficient * meanX });
}
