// 작은 선형대수 도구. 차원이 10 안팎이라 단순한 구현으로 충분하다.
export type Vec = number[];
export type Mat = number[][];

export const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
export const norm = (a: Vec) => Math.sqrt(dot(a, a));
export const cosine = (a: Vec, b: Vec) => {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
};
export const identity = (d: number, s = 1): Mat =>
  Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? s : 0)));
export const matVec = (m: Mat, v: Vec): Vec => m.map((row) => dot(row, v));
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** 대칭 양의 정부호 행렬의 촐레스키 분해 (A = L Lᵀ). */
export function cholesky(a: Mat): Mat {
  const n = a.length;
  const l: Mat = identity(n, 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j];
      for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
      l[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / l[j][j];
    }
  }
  return l;
}

/** 역행렬 (가우스-요르단). */
export function inverse(a: Mat): Mat {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    const pv = m[c][c] || 1e-12;
    for (let k = 0; k < 2 * n; k++) m[c][k] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c];
      if (f !== 0) for (let k = 0; k < 2 * n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row) => row.slice(n));
}

/** 시드를 줄 수 있는 난수 (테스트에서 같은 결과를 보려고). */
export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** 표준정규 난수 (박스-뮬러). */
export function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** N(mean, cov)에서 한 번 뽑는다. */
export function sampleMvn(mean: Vec, cov: Mat, rand: () => number): Vec {
  const l = cholesky(cov);
  const z = mean.map(() => gauss(rand));
  return mean.map((m, i) => m + dot(l[i], z));
}

/** 표준정규 누적분포 Φ (Abramowitz–Stegun 근사). */
export function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
