#!/usr/bin/env node
/**
 * Generate 1242x2208 Dealish splash PNG using pngjs
 * Logo: globe with map-grid lines + location pin, orange segments on white circle
 */
const { PNG } = require('/workspace/dealish/node_modules/pngjs/lib/png.js');
const fs = require('fs');

const W = 1242, H = 2208;
const png = new PNG({ width: W, height: H, filterType: -1 });

// Fill background #FE902A
const BG = [254, 144, 42];
for (let i = 0; i < W * H; i++) {
  png.data[i * 4 + 0] = BG[0];
  png.data[i * 4 + 1] = BG[1];
  png.data[i * 4 + 2] = BG[2];
  png.data[i * 4 + 3] = 255;
}

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  if (a < 255) {
    const br = png.data[i], bg2 = png.data[i+1], bb = png.data[i+2];
    png.data[i]   = ((r * a) + (br * (255 - a))) >> 8;
    png.data[i+1] = ((b * a) + (bg2 * (255 - a))) >> 8; // note: intentional g/b swap fix below
    png.data[i+1] = ((g * a) + (bg2 * (255 - a))) >> 8;
    png.data[i+2] = ((b * a) + (bb  * (255 - a))) >> 8;
  } else {
    png.data[i]   = r;
    png.data[i+1] = g;
    png.data[i+2] = b;
  }
  png.data[i+3] = 255;
}

function fillCircleAA(cx, cy, radius, r, g, b) {
  const ri = Math.ceil(radius) + 2;
  for (let y = cy - ri; y <= cy + ri; y++) {
    for (let x = cx - ri; x <= cx + ri; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const alpha = Math.max(0, Math.min(255, Math.round((radius - dist + 1) * 255)));
      if (alpha > 0) setPixel(x, y, r, g, b, alpha);
    }
  }
}

function fillRingAA(cx, cy, outerR, innerR, r, g, b) {
  const ri = Math.ceil(outerR) + 2;
  for (let y = cy - ri; y <= cy + ri; y++) {
    for (let x = cx - ri; x <= cx + ri; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const outerAlpha = Math.max(0, Math.min(1, outerR - dist + 1));
      const innerAlpha = Math.max(0, Math.min(1, dist - innerR + 1));
      const alpha = Math.round(Math.min(outerAlpha, innerAlpha) * 255);
      if (alpha > 0) setPixel(x, y, r, g, b, alpha);
    }
  }
}

function fillPoly(pts, r, g, b, clipCx, clipCy, clipR) {
  if (pts.length < 3) return;
  const minY = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...pts.map(p => p[1]))));
  const n = pts.length;
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
        xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      for (let x = Math.max(0, Math.floor(xs[i])); x <= Math.min(W - 1, Math.ceil(xs[i+1])); x++) {
        if (clipR !== undefined) {
          const dx = x - clipCx, dy = y - clipCy;
          if (dx*dx + dy*dy > clipR * clipR) continue;
        }
        setPixel(x, y, r, g, b);
      }
    }
  }
}

function drawThickLine(x0, y0, x1, y1, thickness, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len === 0) return;
  const px = -dy / len, py = dx / len;
  const h = thickness / 2;
  fillPoly([
    [x0 + px*h, y0 + py*h],
    [x1 + px*h, y1 + py*h],
    [x1 - px*h, y1 - py*h],
    [x0 - px*h, y0 - py*h],
  ], r, g, b);
}

// ── Logo dimensions ──────────────────────────────────────────────────────────
const LOGO_SIZE = 500;
const cx = Math.round(W / 2);
const cy = Math.round(H / 2);
const R = LOGO_SIZE / 2;

// Colors
const ORANGE  = [255, 120, 0];
const O_MID   = [255, 165, 60];
const O_LITE  = [255, 195, 130];
const WHITE   = [255, 255, 255];

// 1. White base circle
fillCircleAA(cx, cy, R, ...WHITE);

// 2. Colored segments (clipped to circle)
// Top-left (dark orange)
fillPoly([[cx,cy],[cx-R,cy-R],[cx,cy-R],[cx+R*0.12,cy-R]], ...ORANGE, cx, cy, R);
// Top-right (dark orange)
fillPoly([[cx,cy],[cx+R*0.12,cy-R],[cx+R,cy-R],[cx+R,cy-R*0.2]], ...ORANGE, cx, cy, R);
// Left (dark orange)
fillPoly([[cx,cy],[cx-R,cy-R],[cx-R,cy+R*0.25]], ...ORANGE, cx, cy, R);
// Bottom-left (dark orange)
fillPoly([[cx,cy],[cx-R,cy+R*0.25],[cx-R*0.05,cy+R],[cx+R*0.2,cy+R*0.55]], ...ORANGE, cx, cy, R);
// Top-right-upper (mid orange)
fillPoly([[cx,cy],[cx+R,cy-R*0.2],[cx+R,cy-R],[cx+R*0.12,cy-R]], ...O_MID, cx, cy, R);
// Right (light peach)
fillPoly([[cx,cy],[cx+R,cy+R*0.15],[cx+R,cy-R*0.2]], ...O_LITE, cx, cy, R);
// Bottom-right (light peach)
fillPoly([[cx,cy],[cx+R*0.2,cy+R*0.55],[cx+R*0.6,cy+R],[cx+R,cy+R],[cx+R,cy+R*0.15]], ...O_LITE, cx, cy, R);
// Bottom-center (light peach)
fillPoly([[cx,cy],[cx+R*0.2,cy+R*0.55],[cx-R*0.05,cy+R],[cx+R*0.6,cy+R]], ...O_LITE, cx, cy, R);

// 3. White grid lines
const LT = Math.round(R * 0.085);
const vx = cx + R * 0.07;
drawThickLine(vx, cy - R - 5, vx, cy + R + 5, LT, ...WHITE);
const hy = cy - R * 0.07;
drawThickLine(cx - R - 5, hy, cx + R + 5, hy, LT, ...WHITE);
// diagonals
drawThickLine(cx - R*0.55, cy - R - 5, cx + R*0.45, cy + R + 5, LT, ...WHITE);
drawThickLine(cx + R*0.55, cy - R - 5, cx - R*0.45, cy + R + 5, LT, ...WHITE);

// 4. Erase outside circle (restore BG)
const R2 = R * R;
for (let y = Math.max(0, cy - R - 5); y <= Math.min(H-1, cy + R + 5); y++) {
  for (let x = Math.max(0, cx - R - 5); x <= Math.min(W-1, cx + R + 5); x++) {
    const dx = x - cx, dy = y - cy;
    const d2 = dx*dx + dy*dy;
    if (d2 > R2) {
      // smooth edge
      const dist = Math.sqrt(d2);
      const alpha = Math.max(0, Math.min(255, Math.round((R - dist + 1) * 255)));
      const i = (y * W + x) * 4;
      png.data[i]   = Math.round((BG[0] * (255-alpha) + png.data[i]   * alpha) / 255);
      png.data[i+1] = Math.round((BG[1] * (255-alpha) + png.data[i+1] * alpha) / 255);
      png.data[i+2] = Math.round((BG[2] * (255-alpha) + png.data[i+2] * alpha) / 255);
      if (d2 > (R+2)*(R+2)) {
        png.data[i] = BG[0]; png.data[i+1] = BG[1]; png.data[i+2] = BG[2];
      }
    }
  }
}

// 5. Location pin
const pcx = Math.round(cx + R * 0.08);
const pcy = Math.round(cy + R * 0.06);
const PR  = Math.round(R * 0.21);
const PTAIL = Math.round(R * 0.32);
const HOLE = Math.round(R * 0.085);
const PLT  = Math.round(LT * 0.55);

// Pin circle body
fillCircleAA(pcx, pcy, PR, ...ORANGE);
// Pin tail triangle
fillPoly([
  [pcx - PR*0.72, pcy + PR*0.65],
  [pcx + PR*0.72, pcy + PR*0.65],
  [pcx, pcy + PR + PTAIL],
], ...ORANGE);
// White hole
fillCircleAA(pcx, pcy - PR*0.08, HOLE, ...WHITE);
// White outline ring
fillRingAA(pcx, pcy, PR + PLT, PR, ...WHITE);
// White outline on tail
drawThickLine(pcx - PR*0.72, pcy + PR*0.65, pcx, pcy + PR + PTAIL, PLT, ...WHITE);
drawThickLine(pcx + PR*0.72, pcy + PR*0.65, pcx, pcy + PR + PTAIL, PLT, ...WHITE);

// ── Write out ─────────────────────────────────────────────────────────────────
console.log('Writing PNG...');
const buf = PNG.sync.write(png);
fs.writeFileSync('/workspace/dealish/assets/images/splash-icon-new.png', buf);
console.log('Done! splash-icon-new.png written at 1242x2208');
