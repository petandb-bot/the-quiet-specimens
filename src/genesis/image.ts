import { clamp, hashBytes, hexSeed } from '../core/random';
import type { Palette } from '../core/model';

export interface ImageFeatures {
  seed: string;
  palette: Palette;
  brightness: number;
  contrast: number;
  saturation: number;
  edges: number;
  orientation: number;
  distribution: number;
  complexity: number;
}
type Bucket = { count: number; rgb: number[] };

function color(rgb: number[]): string {
  return '#' + rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
}

export function imageFeatures(pixels: Uint8ClampedArray, width: number, height: number): ImageFeatures {
  const count = width * height;
  if (width < 2 || height < 2 || pixels.length !== count * 4) throw new Error('The image has no usable pixels.');
  const light = new Float32Array(count);
  const bands = [0, 0, 0, 0];
  const regionCounts = [0, 0, 0, 0];
  const bins = new Map<number, Bucket>();
  let sum = 0, square = 0, saturation = 0, dx = 0, dy = 0, edgeCount = 0;
  for (let i = 0; i < count; i++) {
    const [r, g, b] = pixels.subarray(i * 4, i * 4 + 3);
    const luma = (0.213 * r + 0.715 * g + 0.072 * b) / 255;
    const max = Math.max(r, g, b);
    saturation += max ? (max - Math.min(r, g, b)) / max : 0;
    light[i] = luma;
    sum += luma;
    square += luma * luma;
    const region = Number(i % width >= width / 2) + 2 * Number(i >= width * Math.ceil(height / 2));
    bands[region] += luma;
    regionCounts[region]++;
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bucket = bins.get(key) ?? { count: 0, rgb: [0, 0, 0] };
    bucket.count++;
    [r, g, b].forEach((channel, c) => bucket.rgb[c] += channel);
    bins.set(key, bucket);
  }
  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const i = y * width + x;
      const horizontal = Math.abs(light[i] - light[i - 1]);
      const vertical = Math.abs(light[i] - light[i - width]);
      dx += horizontal;
      dy += vertical;
      edgeCount += Number(horizontal + vertical > 0.17);
    }
  }
  const dominant = [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 3)
    .map(bucket => bucket.rgb.map(v => v / bucket.count));
  const base = dominant[0];
  const brightness = sum / count;
  const distribution = bands.map((value, i) => value / regionCounts[i]);
  return {
    seed: hexSeed(hashBytes(pixels)),
    palette: [
      color(base),
      color(dominant[1] ?? base.map(v => v * .60)),
      color(dominant[2] ?? base.map(v => v * .48 + 132.6)),
    ],
    brightness, contrast: clamp(Math.sqrt(Math.max(0, square / count - brightness ** 2)) * 2.8),
    saturation: saturation / count,
    edges: edgeCount / ((width - 1) * (height - 1)),
    orientation: dx / Math.max(dx + dy, .001),
    distribution: Math.max(...distribution) - Math.min(...distribution),
    complexity: clamp((dx + dy) / count * 3 + bins.size / 288),
  };
}

export async function analyzeImage(file: File): Promise<ImageFeatures> {
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.');
  if (file.type === 'image/svg+xml' || /\.svgz?$/i.test(file.name)) throw new Error('Choose a JPEG, PNG, WebP, or another raster image.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error('This image format could not be opened. Try JPEG, PNG, or WebP.'); }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image analysis is unavailable in this browser.');
    context.fillStyle = '#20252b';
    context.fillRect(0, 0, 64, 64);
    const scale = Math.min(64 / image.naturalWidth, 64 / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.drawImage(image, Math.floor((64 - width) / 2), Math.floor((64 - height) / 2), width, height);
    return imageFeatures(context.getImageData(0, 0, 64, 64).data, 64, 64);
  } finally {
    URL.revokeObjectURL(url);
  }
}
