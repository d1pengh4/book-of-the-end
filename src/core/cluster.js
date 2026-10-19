// 6.7 교사 대시보드: RobustScaler → K-Means++ (K∈[3,6], silhouette) → 리스크 점수 + CUSUM 조기경보
import { quantile, mulberry32 } from './math.js';

export function robustScale(X) {
  const d = X[0].length;
  const med = [], iqr = [];
  for (let j = 0; j < d; j++) {
    const col = X.map((r) => r[j]);
    med[j] = quantile(col, 0.5);
    iqr[j] = quantile(col, 0.75) - quantile(col, 0.25) || 1;
  }
  return { Z: X.map((r) => r.map((v, j) => (v - med[j]) / iqr[j])), med, iqr };
}
const dist2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

export function kmeans(X, k, { seed = 11, iters = 60 } = {}) {
  const rng = mulberry32(seed);
  const C = [X[Math.floor(rng() * X.length)]];
  while (C.length < k) { // k-means++ 초기화
    const d = X.map((x) => Math.min(...C.map((c) => dist2(x, c))));
    const tot = d.reduce((a, b) => a + b, 0);
    let r = rng() * tot, i = 0;
    while (r > d[i] && i < d.length - 1) { r -= d[i]; i++; }
    C.push(X[i]);
  }
  let labels = new Array(X.length).fill(0);
  for (let it = 0; it < iters; it++) {
    const nl = X.map((x) => { let b = 0, bd = Infinity; C.forEach((c, j) => { const dd = dist2(x, c); if (dd < bd) { bd = dd; b = j; } }); return b; });
    const changed = nl.some((l, i) => l !== labels[i]);
    labels = nl;
    for (let j = 0; j < k; j++) {
      const m = X.filter((_, i) => labels[i] === j);
      if (m.length) C[j] = m[0].map((_, c) => m.reduce((s, r) => s + r[c], 0) / m.length);
    }
    if (!changed && it > 0) break;
  }
  return { labels, centroids: C };
}

export function silhouette(X, labels) {
  const k = Math.max(...labels) + 1;
  const s = X.map((x, i) => {
    const byC = Array.from({ length: k }, () => []);
    X.forEach((y, j) => { if (j !== i) byC[labels[j]].push(Math.sqrt(dist2(x, y))); });
    const avg = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
    const a = avg(byC[labels[i]]);
    const b = Math.min(...byC.map((c, j) => (j === labels[i] || !c.length ? Infinity : avg(c))));
    return byC[labels[i]].length ? (b - a) / Math.max(a, b) : 0;
  });
  return s.reduce((p, q) => p + q, 0) / s.length;
}

export function chooseK(X, range = [3, 6], seed = 11) {
  let best = null;
  const tries = [];
  for (let k = range[0]; k <= range[1]; k++) {
    const r = kmeans(X, k, { seed });
    const sil = silhouette(X, r.labels);
    tries.push({ k, sil: +sil.toFixed(3) });
    if (!best || sil > best.sil) best = { ...r, k, sil };
  }
  return { ...best, tries };
}

// 위험 가중(특성 방향): 정답률↓, 읽기속도↓, 어휘오답↑, 세션 규칙성(엔트로피)↑, 이탈↑
export const RISK_W = [-0.35, -0.2, 0.2, 0.1, 0.15];
export function riskScores(Z, labels, centroids) {
  const cRisk = centroids.map((c) => c.reduce((s, v, i) => s + v * RISK_W[i], 0));
  return Z.map((z, i) => {
    const indiv = z.reduce((s, v, j) => s + v * RISK_W[j], 0);
    return +(0.6 * cRisk[labels[i]] + 0.4 * indiv).toFixed(3);
  });
}

// CUSUM: 주별 정답률이 기준 대비 지속 하락하면 경보 (k=허용, h=임계)
export function cusum(series, { target, k = 0.03, h = 0.12 } = {}) {
  const base = target ?? series.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, series.length);
  let s = 0, alarmAt = null;
  const path = series.map((x, t) => { s = Math.max(0, s + (base - x) - k); if (s > h && alarmAt === null) alarmAt = t; return +s.toFixed(3); });
  return { path, alarmAt };
}

// 공정성: 그룹별 FNR 격차
export function fnrGap(rows, groupKey) {
  const g = {};
  for (const r of rows) {
    if (!r.trueRisk) continue;
    g[r[groupKey]] ??= { fn: 0, p: 0 };
    g[r[groupKey]].p++;
    if (!r.flagged) g[r[groupKey]].fn++;
  }
  const rates = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.p ? v.fn / v.p : 0]));
  const vals = Object.values(rates);
  return { rates, gap: vals.length ? Math.max(...vals) - Math.min(...vals) : 0 };
}
