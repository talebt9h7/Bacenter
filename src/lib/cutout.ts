import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { media } from '@/db/schema';
/**
 * Automatic background removal for product photos shot on a plain studio background
 * (white, grey, beige — even with a soft light gradient). Used for the homepage ring.
 *
 * How it works, on a copy at most 900 px wide:
 *  1. The photo border tells us the background colour; a background that isn't plain
 *     (a street, a desk) is refused, so we never ship a bad cut.
 *  2. A first flood fill from the border finds the background roughly; a smooth surface is
 *     fitted to it so a light gradient (bright centre, darker corners) is understood.
 *  3. A second flood fill, against that surface, may only cross *smooth* changes: soft shadows
 *     pass, the crisp outline of the product stops it. So a grey leather panel on a grey
 *     background is kept.
 *  4. Background turns transparent, shadows become a soft translucent shadow near the product,
 *     enclosed background (a handle loop) is opened, dust specks are dropped, edges are
 *     feathered and cleaned of background colour.
 *  5. We report which sides the product touches (a hand coming in from the bottom), so the
 *     ring can fade those sides instead of showing a cut line.
 */

export type Edges = { top: boolean; right: boolean; bottom: boolean; left: boolean };
export type CutoutFailure = 'busy-background' | 'no-background' | 'no-subject';
export type CutoutCore = { ok: true; data: Uint8ClampedArray; width: number; height: number; edges: Edges } | { ok: false; reason: CutoutFailure };

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

function median(values: Float32Array) { const s = Float32Array.from(values).sort(); return s[s.length >> 1] ?? 0; }

/** Box blur (3×3) of a single-channel image, for noise-free neighbour comparisons. */
function box3(src: Float32Array, w: number, h: number) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; s += src[yy * w + xx]; n++; } }
    out[y * w + x] = s / n;
  }
  return out;
}

/** Local standard deviation (window (2r+1)²): smooth shadows have almost none, leather grain has some. */
/** In-place separable box blur, radius r (two passes look close to a Gaussian). */
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length), span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0; const row = y * w;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[row + x] = sum / span; sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { src[y * w + x] = sum / span; sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
}

function localStd(src: Float32Array, w: number, h: number, r: number) {
  const W = w + 1, s1 = new Float64Array(W * (h + 1)), s2 = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let a = 0, b = 0; for (let x = 0; x < w; x++) { const v = src[y * w + x]; a += v; b += v * v; s1[(y + 1) * W + x + 1] = s1[y * W + x + 1] + a; s2[(y + 1) * W + x + 1] = s2[y * W + x + 1] + b; } }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1), n = (x1 - x0) * (y1 - y0);
    const sum = s1[y1 * W + x1] - s1[y0 * W + x1] - s1[y1 * W + x0] + s1[y0 * W + x0];
    const sq = s2[y1 * W + x1] - s2[y0 * W + x1] - s2[y1 * W + x0] + s2[y0 * W + x0];
    out[y * w + x] = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
  }
  return out;
}

/** Least-squares quadratic surface z = c0 + c1x + c2y + c3x² + c4xy + c5y² over normalised coords. */
function fitQuadratic(xs: Float32Array, ys: Float32Array, zs: Float32Array, count: number) {
  const M = Array.from({ length: 6 }, () => new Float64Array(7));
  for (let i = 0; i < count; i++) {
    const x = xs[i], y = ys[i], t = [1, x, y, x * x, x * y, y * y];
    for (let r = 0; r < 6; r++) { for (let c = 0; c < 6; c++) M[r][c] += t[r] * t[c]; M[r][6] += t[r] * zs[i]; }
  }
  for (let r = 0; r < 6; r++) M[r][r] += 1e-6; // keep it solvable on thin samples
  for (let col = 0; col < 6; col++) {
    let piv = col; for (let r = col + 1; r < 6; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let c = col; c < 7; c++) M[col][c] /= d;
    for (let r = 0; r < 6; r++) if (r !== col) { const k = M[r][col]; if (k) for (let c = col; c < 7; c++) M[r][c] -= k * M[col][c]; }
  }
  return M.map(row => row[6]);
}

/**
 * Removes a plain background from straight (not premultiplied) RGBA pixels.
 * Returns a cropped RGBA image with transparency, or why it couldn't.
 */
export function makeCutout(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, strict = false): CutoutCore {
  const n = w * h;
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = LIN[rgba[p]], g = LIN[rgba[p + 1]], b = LIN[rgba[p + 2]];
    const X = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), Y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), Z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    L[i] = 116 * Y - 16; A[i] = 500 * (X - Y); B[i] = 200 * (Y - Z);
  }
  const Ls = box3(L, w, h), As = box3(A, w, h), Bs = box3(B, w, h);
  const texture = localStd(L, w, h, 2);

  // ---- 1. Background colour from the photo border ---------------------------------------
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  const border: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < band || y < band || x >= w - band || y >= h - band) border.push(y * w + x);
  const pick = (arr: Float32Array) => { const v = new Float32Array(border.length); border.forEach((idx, k) => { v[k] = arr[idx]; }); return v; };
  const mL = median(pick(Ls)), mA = median(pick(As)), mB = median(pick(Bs));
  let plain = 0;
  for (const i of border) if (Math.hypot(As[i] - mA, Bs[i] - mB) < 12 && Math.abs(Ls[i] - mL) < 22) plain++;
  if (plain / border.length < 0.55) return { ok: false, reason: 'busy-background' };
  const light = mL > 55;

  // Flood fill from the border through pixels accepted by `ok`, crossing only smooth steps.
  const queue = new Int32Array(n);
  const flood = (ok: (i: number) => boolean, stepL: number, stepAB: number) => {
    const seen = new Uint8Array(n); let head = 0, tail = 0;
    for (const i of border) if (!seen[i] && ok(i)) { seen[i] = 1; queue[tail++] = i; }
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j < 0 || seen[j]) continue;
        if (Math.abs(Ls[j] - Ls[i]) > stepL || Math.hypot(As[j] - As[i], Bs[j] - Bs[i]) > stepAB) continue;
        if (!ok(j)) continue;
        seen[j] = 1; queue[tail++] = j;
      }
    }
    return { seen, size: tail };
  };

  // ---- 2. Rough background, then a smooth model of it ------------------------------------
  const rough = flood(i => Math.hypot(As[i] - mA, Bs[i] - mB) < 12 && Ls[i] > Math.max(22, mL * 0.45) && Ls[i] < mL + 20, 6, 4);
  if (rough.size < n * 0.12) return { ok: false, reason: 'no-background' };
  const maxSamples = 8000, stride = Math.max(1, Math.floor(rough.size / maxSamples));
  const sx = new Float32Array(maxSamples + 8), sy = new Float32Array(maxSamples + 8), sL = new Float32Array(maxSamples + 8), sA = new Float32Array(maxSamples + 8), sB = new Float32Array(maxSamples + 8);
  let count = 0, k = 0;
  for (let i = 0; i < n && count < maxSamples; i++) {
    if (!rough.seen[i] || Ls[i] < mL - 12) continue; // leave shadows out of the background model
    if (k++ % stride) continue;
    const x = i % w, y = (i - x) / w;
    sx[count] = (x / (w - 1)) * 2 - 1; sy[count] = (y / (h - 1)) * 2 - 1; sL[count] = Ls[i]; sA[count] = As[i]; sB[count] = Bs[i]; count++;
  }
  if (count < 200) return { ok: false, reason: 'no-background' };
  const cL = fitQuadratic(sx, sy, sL, count), cA = fitQuadratic(sx, sy, sA, count), cB = fitQuadratic(sx, sy, sB, count);
  const surf = (c: number[], x: number, y: number) => c[0] + c[1] * x + c[2] * y + c[3] * x * x + c[4] * x * y + c[5] * y * y;
  const bgL = new Float32Array(n), bgA = new Float32Array(n), bgB = new Float32Array(n);
  for (let y = 0; y < h; y++) { const ny = (y / (h - 1)) * 2 - 1; for (let x = 0; x < w; x++) { const nx = (x / (w - 1)) * 2 - 1, i = y * w + x; bgL[i] = surf(cL, nx, ny); bgA[i] = surf(cA, nx, ny); bgB[i] = surf(cB, nx, ny); } }

  // ---- 3. Precise background + shadows against the model ---------------------------------
  const dL = (i: number) => Ls[i] - bgL[i];
  const dAB = (i: number) => Math.hypot(As[i] - bgA[i], Bs[i] - bgB[i]);
  const isBg = (i: number) => dAB(i) < 8 && dL(i) > -6 && dL(i) < 9;
  // Shadows: darker than the background but not much (a grey leather panel is darker still),
  // near-neutral, and smooth (no leather grain). Strict mode keeps only light shadows.
  const shadowFloor = strict ? 0.14 : 0.33;
  const isShadow = (i: number) => light && dL(i) <= -6 && dL(i) > -bgL[i] * shadowFloor && dAB(i) < 4.5 + 0.06 * -dL(i) && texture[i] < 2.4;
  const region = flood(i => isBg(i) || isShadow(i), 5.5, 3.5).seen;
  // Light background and light shadow next to it joins even across a steeper (penumbra) step.
  {
    let head = 0, tail = 0;
    for (let i = 0; i < n; i++) if (region[i]) queue[tail++] = i;
    const light2 = (i: number) => isBg(i) || (isShadow(i) && dL(i) > -20);
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || region[j] || !light2(j)) continue;
        region[j] = 1; queue[tail++] = j;
      }
    }
  }
  // Enclosed background or light shadow (between a hand and the product, inside a handle) opens too.
  {
    const open = (i: number) => !region[i] && (isBg(i) || (isShadow(i) && dL(i) > -15));
    const seenHole = new Uint8Array(n), holeMin0 = Math.round(n * 0.0015);
    for (let s0 = 0; s0 < n; s0++) {
      if (seenHole[s0] || !open(s0)) continue;
      let head = 0, tail = 0; queue[tail++] = s0; seenHole[s0] = 1;
      while (head < tail) {
        const i = queue[head++], x = i % w, y = (i - x) / w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0 || seenHole[j] || !open(j) || Math.abs(Ls[j] - Ls[i]) > 5.5) continue;
          seenHole[j] = 1; queue[tail++] = j;
        }
      }
      if (tail >= holeMin0) for (let q = 0; q < tail; q++) region[queue[q]] = 1;
    }
  }

  // Alpha: 0 background, partial shadow, 1 product.
  const alpha = new Float32Array(n);
  const shadowStrength = new Float32Array(n);
  let subject = 0;
  for (let i = 0; i < n; i++) {
    if (!region[i]) { alpha[i] = 1; subject++; continue; }
    if (isBg(i)) continue;
    const s = Math.min(1, Math.max(0, (-dL(i) - 4) / (bgL[i] * 0.55)));
    shadowStrength[i] = Math.pow(s, 0.85) * 0.78;
  }
  if (subject < n * 0.01) return { ok: false, reason: 'no-subject' };
  // A "shadow" larger than the product itself means part of the product was taken for shadow
  // (a grey panel): try again, keeping only light shadows.
  if (!strict) { let shade = 0; for (let i = 0; i < n; i++) if (shadowStrength[i] > 0.12) shade++; if (shade > subject * 0.55) return makeCutout(rgba, w, h, true); }

  // ---- 4a. Open enclosed background (a handle loop) --------------------------------------
  const strictBg = (i: number) => dAB(i) < 5 && Math.abs(dL(i)) < 5;
  const comp = new Int32Array(n).fill(-1);
  const holeMin = Math.round(n * 0.0015);
  for (let s0 = 0; s0 < n; s0++) {
    if (region[s0] || comp[s0] !== -1 || !strictBg(s0)) continue;
    let head = 0, tail = 0; queue[tail++] = s0; comp[s0] = s0;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || region[j] || comp[j] !== -1 || !strictBg(j)) continue;
        comp[j] = s0; queue[tail++] = j;
      }
    }
    if (tail >= holeMin) for (let q = 0; q < tail; q++) { alpha[queue[q]] = 0; subject--; }
  }

  // ---- 4b. Keep the product, drop specks -------------------------------------------------
  const label = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (alpha[s0] < 1 || label[s0] !== -1) continue;
    const id = sizes.length; let head = 0, tail = 0; queue[tail++] = s0; label[s0] = id;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || alpha[j] < 1 || label[j] !== -1) continue;
        label[j] = id; queue[tail++] = j;
      }
    }
    sizes.push(tail);
  }
  if (!sizes.length) return { ok: false, reason: 'no-subject' };
  const biggest = Math.max(...sizes);
  const keepMin = Math.max(Math.round(n * 0.002), Math.round(biggest * 0.015));
  for (let i = 0; i < n; i++) if (alpha[i] === 1 && sizes[label[i]] < keepMin) alpha[i] = 0;

  // ---- 4c. Shadows only near the product (no dark corners from a vignette) ----------------
  const INF = 1e9, dist = new Float32Array(n);
  for (let i = 0; i < n; i++) dist[i] = alpha[i] === 1 ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; let d = dist[i]; if (x > 0) d = Math.min(d, dist[i - 1] + 1); if (y > 0) { d = Math.min(d, dist[i - w] + 1); if (x > 0) d = Math.min(d, dist[i - w - 1] + 1.414); if (x < w - 1) d = Math.min(d, dist[i - w + 1] + 1.414); } dist[i] = d; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let d = dist[i]; if (x < w - 1) d = Math.min(d, dist[i + 1] + 1); if (y < h - 1) { d = Math.min(d, dist[i + w] + 1); if (x < w - 1) d = Math.min(d, dist[i + w + 1] + 1.414); if (x > 0) d = Math.min(d, dist[i + w - 1] + 1.414); } dist[i] = d; }
  const reach = Math.max(w, h) * 0.12;
  for (let i = 0; i < n; i++) {
    if (alpha[i] === 1 || !shadowStrength[i]) continue;
    const t = Math.min(1, Math.max(0, (dist[i] - reach * 0.55) / (reach * 0.45)));
    alpha[i] = shadowStrength[i] * (1 - t * t * (3 - 2 * t));
  }

  // Shadows are soft light: blur the shadow layer so its outline never looks cut out. Product
  // pixels are left out of the average, so the shadow stays full right up to the product.
  {
    const sh = new Float32Array(n), weight = new Float32Array(n);
    for (let i = 0; i < n; i++) if (alpha[i] !== 1) { sh[i] = alpha[i]; weight[i] = 1; }
    const r = Math.max(2, Math.round(Math.min(w, h) * 0.008));
    boxBlur(sh, w, h, r); boxBlur(sh, w, h, r); boxBlur(weight, w, h, r); boxBlur(weight, w, h, r);
    for (let i = 0; i < n; i++) if (alpha[i] !== 1) alpha[i] = weight[i] > 0.05 ? Math.min(0.8, sh[i] / weight[i]) : 0;
  }

  // ---- 4d. Clean, feathered edges ---------------------------------------------------------
  const out = new Uint8ClampedArray(n * 4);
  const isEdge = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (alpha[i] !== 1) continue;
    for (let dy = -1; dy <= 1 && !isEdge[i]; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; if (alpha[yy * w + xx] < 0.5) { isEdge[i] = 1; break; } }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = i * 4;
    if (alpha[i] === 1) {
      let r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      if (isEdge[i]) { // borrow colour from solid neighbours: no light halo from the old background
        let sr = 0, sg = 0, sb = 0, c = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (alpha[j] === 1 && !isEdge[j]) { sr += rgba[j * 4]; sg += rgba[j * 4 + 1]; sb += rgba[j * 4 + 2]; c++; } }
        if (c) { r = sr / c; g = sg / c; b = sb / c; }
      }
      out[p] = r; out[p + 1] = g; out[p + 2] = b;
    } else { out[p] = 28; out[p + 1] = 20; out[p + 2] = 14; } // shadow tone
  }
  // Soften the outline: average alpha across the edge only.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let a = alpha[i];
    if (isEdge[i] || (alpha[i] < 1 && alpha[i] > 0 && dist[i] < 2)) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; s += alpha[yy * w + xx]; c++; }
      a = (a + s / c) / 2;
    }
    out[i * 4 + 3] = Math.round(a * 255);
  }

  // ---- 5. Which sides does the product touch? -------------------------------------------
  const solid = (x: number, y: number) => alpha[y * w + x] >= 0.9;
  let top = 0, bottom = 0, left = 0, right = 0;
  for (let x = 0; x < w; x++) { if (solid(x, 0)) top++; if (solid(x, h - 1)) bottom++; }
  for (let y = 0; y < h; y++) { if (solid(0, y)) left++; if (solid(w - 1, y)) right++; }
  const edges: Edges = { top: top / w > 0.03, bottom: bottom / w > 0.03, left: left / h > 0.03, right: right / h > 0.03 };
  const done = finish(out, w, h, edges);
  return done ? { ok: true, ...done, edges } : { ok: false, reason: 'no-subject' };
}

/**
 * Last step for every ring picture: where the photo frame cut the product (a wrist, a strap),
 * that side fades out instead of ending in a straight line; then crop to the product.
 */
function finish(out: Uint8ClampedArray, w: number, h: number, edges: Edges) {
  const fade = Math.max(6, Math.round(Math.min(w, h) * 0.16));
  const ramp = (d: number) => { if (d >= fade) return 1; const t = d / fade; return t * t * (3 - 2 * t); };
  if (edges.top || edges.bottom || edges.left || edges.right) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let f = 1;
      if (edges.top) f *= ramp(y);
      if (edges.bottom) f *= ramp(h - 1 - y);
      if (edges.left) f *= ramp(x);
      if (edges.right) f *= ramp(w - 1 - x);
      if (f < 1) { const p = (y * w + x) * 4 + 3; out[p] = Math.round(out[p] * f); }
    }
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (out[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = Math.round(Math.max(w, h) * 0.03);
  x0 = edges.left ? 0 : Math.max(0, x0 - pad); y0 = edges.top ? 0 : Math.max(0, y0 - pad);
  x1 = edges.right ? w - 1 : Math.min(w - 1, x1 + pad); y1 = edges.bottom ? h - 1 : Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, cropped = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) cropped.set(out.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + cw) * 4), y * cw * 4);
  return { data: cropped, width: cw, height: ch };
}

/** Sides where an already-transparent picture (an uploaded cut-out) has solid pixels on its border. */
export function edgesOfTransparent(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Edges | null {
  let clear = 0, total = 0;
  const a = (x: number, y: number) => rgba[(y * w + x) * 4 + 3];
  for (let x = 0; x < w; x++) { total += 2; if (a(x, 0) < 20) clear++; if (a(x, h - 1) < 20) clear++; }
  for (let y = 0; y < h; y++) { total += 2; if (a(0, y) < 20) clear++; if (a(w - 1, y) < 20) clear++; }
  if (clear / total < 0.3) return null; // not a cut-out: the border is solid all round
  let top = 0, bottom = 0, left = 0, right = 0;
  for (let x = 0; x < w; x++) { if (a(x, 0) > 230) top++; if (a(x, h - 1) > 230) bottom++; }
  for (let y = 0; y < h; y++) { if (a(0, y) > 230) left++; if (a(w - 1, y) > 230) right++; }
  return { top: top / w > 0.03, bottom: bottom / w > 0.03, left: left / h > 0.03, right: right / h > 0.03 };
}

/** "tb" style short form for storage. */
export const edgesCode = (e: Edges | null) => (e ? `${e.top ? 't' : ''}${e.right ? 'r' : ''}${e.bottom ? 'b' : ''}${e.left ? 'l' : ''}` : '');

const WORK_SIZE = 900;
/** Full pipeline with sharp: photo bytes in, transparent WebP out (or the reason it can't). */
export async function cutoutImage(input: Buffer): Promise<{ ok: true; webp: Buffer; edges: string; width: number; height: number } | { ok: false; reason: CutoutFailure }> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(input, { failOn: 'none' }).rotate().resize({ width: WORK_SIZE, height: WORK_SIZE, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const already = edgesOfTransparent(data, info.width, info.height);
  // Already cut out (an uploaded PNG): only the fade and the crop.
  const res = already ? { ok: true as const, edges: already, ...(finish(new Uint8ClampedArray(data), info.width, info.height, already) ?? { data: new Uint8ClampedArray(data), width: info.width, height: info.height }) } : makeCutout(data, info.width, info.height);
  if (!res.ok) return res;
  const webp = await sharp(Buffer.from(res.data.buffer, res.data.byteOffset, res.data.byteLength), { raw: { width: res.width, height: res.height, channels: 4 } }).webp({ quality: 90, alphaQuality: 95 }).toBuffer();
  return { ok: true, webp, edges: edgesCode(res.edges), width: res.width, height: res.height };
}

/** Edges of an uploaded picture, or '' when it isn't a cut-out (solid background). */
export async function analyzeUploadedCutout(input: Buffer): Promise<{ cutout: boolean; edges: string }> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(input, { failOn: 'none' }).resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const e = edgesOfTransparent(data, info.width, info.height);
  return { cutout: !!e, edges: edgesCode(e) };
}

/** The bytes behind an image URL used in the store (database media, a static file, or https). */
export async function loadStoreImage(url: string, origin: string): Promise<Buffer | null> {
  const id = /^\/api\/media\/(\d+)(?:\?.*)?$/.exec(url)?.[1];
  if (id) {
    const [row] = await db.select({ data: media.data }).from(media).where(eq(media.id, Number(id)));
    return row ? Buffer.from(row.data) : null;
  }
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('..')) {
    const local = await readFile(path.join(process.cwd(), 'public', url.split('?')[0])).catch(() => null);
    if (local) return local;
  }
  if (!url.startsWith('/') && !url.startsWith('https://')) return null;
  const response = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(15000), cache: 'no-store' }).catch(() => null);
  if (!response?.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) return null;
  const data = Buffer.from(await response.arrayBuffer());
  return data.length <= 15 * 1024 * 1024 ? data : null;
}
