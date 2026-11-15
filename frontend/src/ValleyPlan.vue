<template>
  <canvas ref="canvas" class="valley-plan" aria-label="计算网格地形平面" @click="pick"></canvas>
  <div class="plan-caption" role="status">地形平面 · 三维渲染不可用</div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { assetUrl } from './browserData.js';
import { geographicPoint, gridCoordinates } from './depthData.js';

const props = defineProps({
  data: Object,
  snapshot: Object,
  view: String,
  style: String,
  water: Boolean,
  sample: Object,
});
const emit = defineEmits(['pick']);
const canvas = ref(null);
let context, fieldCanvas, fieldContext, terrain, resize, rect;
let motion;
const depthColors = [[139, 219, 237], [77, 184, 217], [34, 141, 208], [48, 103, 199], [96, 69, 185], [156, 72, 183]];
const thresholds = [0.25, 0.5, 1, 2, 4, Infinity];
const focuses = {
  overview: [0.52, 0.47, 1],
  top: [0.5, 0.5, 1],
  front: [0.39, 0.51, 1.92],
  side: [0.36, 0.58, 1.48],
  upstream: [0.22, 0.48, 1.55],
  downstream: [0.71, 0.43, 1.42],
};
let focus = focuses.overview;

function pixel(data, index, pixels, offset) {
  const h = props.water && data.valid[index] ? props.snapshot.depth[index] : 0;
  const height = props.snapshot.bed[index];
  if (h < 0.018) {
    if (!props.data.bedIndices) {
      const tone = Math.max(25, Math.min(107, 55 + height * 0.60));
      pixels.set([tone * 0.62, tone, tone * 0.93, 255], offset);
    } else if (height > 5 && breachCells.has(index)) {
      pixels.set([153 + height * 0.7, 138 + height * 0.6, 114 + height * 0.44, 180], offset);
    }
    return;
  }
  if (props.style === 'depth') {
    pixels.set([...depthColors[thresholds.findIndex(limit => h <= limit)], 210], offset);
    return;
  }
  const u = index % data.grid.nx;
  const v = Math.floor(index / data.grid.nx);
  const speed = props.snapshot.speed?.[index] || 0;
  const fast = Math.min(1, speed / 7);
  const t = props.snapshot.time;
  const curl = Math.sin(v * 0.72 + u * 0.89 - t * 0.47);
  const ripple = Math.cos(v * 1.13 - u * 0.41 + curl * 2 - t * (0.7 + speed / 30));
  const foam = Math.max(0, ripple - 0.68) * 100 * fast;
  pixels.set([51 + 73 * fast + foam + 7 * ripple, 85 + 20 * fast + foam + 7 * curl,
    83 - 19 * fast + foam + 5 * ripple, 108 + 136 * Math.min(1, h / 1.1)], offset);
}

let breachCells = new Set();

function redraw() {
  if (!canvas.value || !context || !props.data || !props.snapshot) return;
  const { width, height } = canvas.value;
  if (!width || !height) return;
  const { nx, ny, x0, y0, dx, dy } = props.data.grid;
  const plotWidth = Math.min(width * 0.94, height * 0.91 * (nx - 1) * dx / ((ny - 1) * dy)) * focus[2];
  const plotHeight = plotWidth * (ny - 1) * dy / ((nx - 1) * dx);
  rect = { x: width / 2 - focus[0] * plotWidth, y: height / 2 - focus[1] * plotHeight, width: plotWidth, height: plotHeight };
  const { x, y } = rect;
  context.fillStyle = '#0e1b1b';
  context.fillRect(0, 0, width, height);
  if (terrain.complete && terrain.naturalWidth && props.data.bedIndices) {
    context.drawImage(terrain, x, y, plotWidth, plotHeight);
  }
  if (fieldCanvas.width !== nx || fieldCanvas.height !== ny) {
    fieldCanvas.width = nx;
    fieldCanvas.height = ny;
  }
  const image = fieldContext.createImageData(nx, ny);
  for (let j = 0; j < ny; j++) {
    const start = j * nx;
    const row = (ny - j - 1) * nx;
    for (let i = 0; i < nx; i++) pixel(props.data, start + i, image.data, (row + i) * 4);
  }
  fieldContext.putImageData(image, 0, 0);
  context.drawImage(fieldCanvas, x, y, plotWidth, plotHeight);
  context.strokeStyle = '#d9e4dd42';
  context.strokeRect(x, y, plotWidth, plotHeight);

  if (props.sample?.depth != null) {
    const [u, v] = gridCoordinates(props.sample.longitude, props.sample.latitude, props.data.origin, props.data.yaw);
    const px = x + (u - x0) / (dx * (nx - 1)) * plotWidth;
    const py = y + (1 - (v - y0) / (dy * (ny - 1))) * plotHeight;
    const size = Math.max(width / canvas.value.clientWidth, 1);
    context.beginPath();
    context.arc(px, py, 6 * size, 0, 2 * Math.PI);
    context.fillStyle = '#effcfa';
    context.strokeStyle = '#297f87';
    context.lineWidth = 3 * size;
    context.fill();
    context.stroke();
  }
}

function pick(event) {
  if (!rect || !props.data) return;
  const viewport = canvas.value.getBoundingClientRect();
  const u = ((event.clientX - viewport.left) * canvas.value.width / viewport.width - rect.x) / rect.width;
  const v = ((event.clientY - viewport.top) * canvas.value.height / viewport.height - rect.y) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return;
  const { x0, y0, nx, ny, dx, dy } = props.data.grid;
  emit('pick', ...geographicPoint(x0 + u * (nx - 1) * dx, y0 + (1 - v) * (ny - 1) * dy, props.data));
}

watch(() => props.data, data => {
  breachCells = new Set(data?.bedIndices);
  redraw();
}, { immediate: true });
watch(() => [props.snapshot, props.style, props.water, props.sample], redraw);
watch(() => props.view, view => {
  cancelAnimationFrame(motion);
  const target = focuses[view] || focuses.overview;
  const start = [...focus];
  const first = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - first) / 460);
    const eased = progress * progress * (3 - 2 * progress);
    focus = start.map((value, i) => value + (target[i] - value) * eased);
    redraw();
    if (progress < 1) motion = requestAnimationFrame(step);
  }
  motion = requestAnimationFrame(step);
});

onMounted(() => {
  context = canvas.value.getContext('2d');
  fieldCanvas = document.createElement('canvas');
  fieldContext = fieldCanvas.getContext('2d');
  terrain = new Image();
  terrain.onload = redraw;
  terrain.src = assetUrl('models/valley-relief.png');
  resize = new ResizeObserver(() => {
    const scale = Math.min(devicePixelRatio, 2);
    canvas.value.width = Math.round(canvas.value.clientWidth * scale);
    canvas.value.height = Math.round(canvas.value.clientHeight * scale);
    redraw();
  });
  resize.observe(canvas.value);
});
onBeforeUnmount(() => { resize?.disconnect(); cancelAnimationFrame(motion); });
</script>
