// 공용 수학 유틸 — 시드 난수, 정규분포, 선형대수(소규모 행렬)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Abramowitz–Stegun 7.1.26 erf 근사 (오차 < 1.5e-7)
export function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
export function cosine(a, b) {
  const na = norm(a), nb = norm(b);
  return na && nb ? dot(a, b) / (na * nb) : 0;
}
export const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
export function std(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
export function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const identity = (n, scale = 1) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? scale : 0)));
export const matVec = (M, v) => M.map((row) => dot(row, v));

// Gauss-Jordan 역행렬 (d ≤ 16 정도의 소규모 행렬용)
export function inverse(M) {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('singular matrix');
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c];
    for (let j = 0; j < 2 * n; j++) A[c][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row) => row.slice(n));
}

// 대칭 양정치 행렬의 Cholesky 분해 (하삼각 L, M = L L^T)
export function cholesky(M) {
  const n = M.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][j] = Math.sqrt(Math.max(s, 1e-12));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}

// 32-bit FNV-1a 해시 (가명화·청크 ID 용, 암호학적 용도 아님)
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
