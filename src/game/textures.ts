import * as THREE from 'three';
import { LANE_COUNT, ROAD_WIDTH, SHOULDER_WIDTH, TOTAL_HIGHWAY_WIDTH } from './constants';

export function createHighwayAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base dark highway asphalt
  ctx.fillStyle = '#151926';
  ctx.fillRect(0, 0, width, height);

  // Subtle asphalt aggregate noise
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const v = 18 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgba(${v + 4}, ${v + 8}, ${v + 18}, 0.28)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const shoulderPx = (SHOULDER_WIDTH / TOTAL_HIGHWAY_WIDTH) * width;
  const roadPx = (ROAD_WIDTH / TOTAL_HIGHWAY_WIDTH) * width;
  const lanePx = roadPx / LANE_COUNT;

  // Slightly darker paved shoulders
  ctx.fillStyle = 'rgba(8, 11, 20, 0.52)';
  ctx.fillRect(0, 0, shoulderPx, height);
  ctx.fillRect(width - shoulderPx, 0, shoulderPx, height);

  // Subtle tire wear polish strips in each of the 6 equal lanes
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const laneLeft = shoulderPx + lane * lanePx;
    const laneCenter = laneLeft + lanePx * 0.5;

    const grad = ctx.createLinearGradient(laneLeft, 0, laneLeft + lanePx, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.24, 'rgba(130, 160, 210, 0.055)');
    grad.addColorStop(0.5, 'rgba(15, 20, 32, 0.06)');
    grad.addColorStop(0.76, 'rgba(130, 160, 210, 0.055)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(laneLeft, 0, lanePx, height);

    // Subtle reflective highway seam micro-strip
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.fillRect(laneCenter - 2, 0, 4, height);
  }

  // Solid bright outer highway boundary lines
  const edgeLineWidth = 10;
  ctx.fillStyle = '#e2ecff';
  ctx.fillRect(shoulderPx - edgeLineWidth * 0.5, 0, edgeLineWidth, height);
  ctx.fillRect(width - shoulderPx - edgeLineWidth * 0.5, 0, edgeLineWidth, height);

  // Outer subtle cyan neon shoulder reflection strip
  ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.fillRect(shoulderPx - 18, 0, 4, height);
  ctx.fillRect(width - shoulderPx + 14, 0, 4, height);

  // 5 Crisp dashed lane divider lines separating the 6 equal-width lanes
  const dashCount = 8;
  const dashPeriod = height / dashCount;
  const dashLength = dashPeriod * 0.52;
  const dashWidth = 8;

  for (let divider = 1; divider < LANE_COUNT; divider++) {
    const x = shoulderPx + divider * lanePx;
    const isCenterDivider = divider === LANE_COUNT / 2;

    for (let d = 0; d < dashCount; d++) {
      const y = d * dashPeriod + dashPeriod * 0.24;

      // Soft road paint halo
      ctx.fillStyle = isCenterDivider
        ? 'rgba(245, 195, 68, 0.24)'
        : 'rgba(215, 232, 255, 0.16)';
      ctx.fillRect(x - dashWidth * 0.9, y - 2, dashWidth * 1.8, dashLength + 4);

      // Crisp road dashed stripe
      ctx.fillStyle = isCenterDivider ? '#fde047' : '#f1f5f9';
      ctx.fillRect(x - dashWidth * 0.5, y, dashWidth, dashLength);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 7);
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

export function createAmbulanceRoofTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Clean bright white ambulance roof
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, size, size);

  // Fluorescent yellow-lime Czech emergency hi-vis border accents
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, size, 24);
  ctx.fillRect(0, size - 24, size, 24);

  // Bold red emergency cross emblem in center
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(size * 0.5 - 24, size * 0.5 - 68, 48, 136);
  ctx.fillRect(size * 0.5 - 68, size * 0.5 - 24, 136, 48);

  // Subtle metallic roof ribs
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 32, size - 20, size - 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
