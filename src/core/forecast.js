// 6.8 수요 예측 및 물류 최적화
// 앙상블: Holt-Winters(계절성) + 외생변수 회귀(학사일정·신간·미디어) + 계절 나이브, 가중 = 롤링 검증 sMAPE 역수
// 확률 예측: 잔차 분위수로 P10/P50/P90, 구매: 예산 제약 정수 knapsack(분야 하한), 이동도서관: NN + 2-opt (용량·시간창)
import { quantile, haversineLike } from './forecast-util.js';

export function smape(y, f) {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - f[i]) / ((Math.abs(y[i]) + Math.abs(f[i])) / 2 || 1);
  return (100 * s) / y.length;
}

export function holtWinters(y, { m = 12, alpha = 0.35, beta = 0.05, gamma = 0.3, h = 6 } = {}) {
  const n = y.length;
  let L = y.slice(0, m).reduce((a, b) => a + b, 0) / m;
  let T = (y.slice(m, 2 * m).reduce((a, b) => a + b, 0) - y.slice(0, m).reduce((a, b) => a + b, 0)) / (m * m);
  const S = y.slice(0, m).map((v) => v - L);
  const fitted = [];
  for (let t = 0; t < n; t++) {
    const s = S[t % m];
    fitted.push(L + T + s);
    const Lp = L;
    L = alpha * (y[t] - s) + (1 - alpha) * (L + T);
    T = beta * (L - Lp) + (1 - beta) * T;
    S[t % m] = gamma * (y[t] - L) + (1 - gamma) * s;
  }
  const fc = Array.from({ length: h }, (_, i) => L + (i + 1) * T + S[(n + i) % m]);
  return { fitted, forecast: fc };
}

export function seasonalNaive(y, { m = 12, h = 6 } = {}) {
  return { fitted: y.map((_, t) => (t >= m ? y[t - m] : y[t])), forecast: Array.from({ length: h }, (_, i) => y[y.length - m + (i % m)]) };
}

// 외생변수 선형회귀(정규방정식, 릿지): X = [1, t, 학기중, 방학, 신간, 미디어]
export function exoRegression(y, X, Xf, lambda = 0.5) {
  const d = X[0].length;
  const XtX = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0)));
  const Xty = Array.from({ length: d }, (_, i) => X.reduce((s, r, t) => s + r[i] * y[t], 0));
  const w = solve(XtX, Xty);
  const pred = (r) => r.reduce((s, v, i) => s + v * w[i], 0);
  return { w, fitted: X.map(pred), forecast: Xf.map(pred) };
}
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) x[i] = (M[i][n] - M[i].slice(i + 1, n).reduce((s, v, j) => s + v * x[i + 1 + j], 0)) / M[i][i];
  return x;
}

export function exoMatrix(len, start, calendar) {
  return Array.from({ length: len }, (_, i) => {
    const t = start + i, mo = t % 12;
    return [1, t / 12, calendar.semester.includes(mo) ? 1 : 0, calendar.vacation.includes(mo) ? 1 : 0, calendar.newRelease?.[t] ?? 0, calendar.media?.[t] ?? 0];
  });
}

// 롤링 원점 검증으로 모델별 sMAPE → 가중치(역수)
export function ensembleForecast(y, { m = 12, h = 6, calendar, folds = 3 } = {}) {
  const models = {
    holtWinters: (tr, hh) => holtWinters(tr, { m, h: hh }).forecast,
    seasonalNaive: (tr, hh) => seasonalNaive(tr, { m, h: hh }).forecast,
    exoRegression: (tr, hh) => exoRegression(tr, exoMatrix(tr.length, 0, calendar), exoMatrix(hh, tr.length, calendar)).forecast,
  };
  const errs = {}, resid = [];
  for (const [name, fn] of Object.entries(models)) {
    const e = [];
    for (let f = folds; f >= 1; f--) {
      const cut = y.length - f * 3;
      const pred = fn(y.slice(0, cut), 3);
      e.push(smape(y.slice(cut, cut + 3), pred));
    }
    errs[name] = e.reduce((a, b) => a + b, 0) / e.length;
  }
  const inv = Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, 1 / Math.max(v, 0.5)]));
  const tot = Object.values(inv).reduce((a, b) => a + b, 0);
  const weights = Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, +(v / tot).toFixed(3)]));
  const fcs = Object.fromEntries(Object.entries(models).map(([k, fn]) => [k, fn(y, h)]));
  const p50 = Array.from({ length: h }, (_, i) => Object.keys(models).reduce((s, k) => s + weights[k] * fcs[k][i], 0));
  // 잔차 분위수(1-step 앙상블 검증 오차) → horizon √h 확장
  for (let t = Math.max(14, y.length - 20); t < y.length; t++) {
    const tr = y.slice(0, t);
    const one = Object.keys(models).reduce((s, k) => s + weights[k] * models[k](tr, 1)[0], 0);
    resid.push(y[t] - one);
  }
  // 분할 컨포멀 보정: 유한 표본에서 80% 구간 적중을 지키도록 분위 수준을 ⌈(n+1)·0.9⌉/n 으로 올림
  const n = resid.length, hi = Math.min(1, Math.ceil((n + 1) * 0.9) / n), lo = 1 - hi;
  const q10 = quantile(resid, lo), q90 = quantile(resid, hi);
  const band = p50.map((v, i) => ({ p10: Math.max(0, v + q10 * Math.sqrt(i + 1)), p50: Math.max(0, v), p90: Math.max(0, v + q90 * Math.sqrt(i + 1)) }));
  return { weights, errs, band, resid };
}

// 구간 커버리지(P10~P90 적중률) 백테스트
export function coverage(y, opts) {
  let hit = 0, n = 0;
  for (let t = y.length - 12; t < y.length; t++) {
    const { band } = ensembleForecast(y.slice(0, t), { ...opts, h: 1 });
    if (y[t] >= band[0].p10 && y[t] <= band[0].p90) hit++;
    n++;
  }
  return hit / n;
}

// 구매 최적화: max Σ u_j·q_j  s.t. Σ p_j·q_j ≤ Budget, q_j ≤ P90_j, 분야 하한 → 하한 선배정 후 bounded knapsack DP
export function optimizePurchase(items, budget, { unit = 1000, minPerCategory = {} } = {}) {
  const q = Object.fromEntries(items.map((it) => [it.id, 0]));
  let left = budget;
  for (const [cat, minQ] of Object.entries(minPerCategory)) {
    const best = items.filter((i) => i.category === cat).sort((a, b) => b.utility / b.price - a.utility / a.price);
    let need = minQ;
    for (const it of best) {
      while (need > 0 && q[it.id] < it.cap && left >= it.price) { q[it.id]++; need--; left -= it.price; }
    }
  }
  const C = Math.floor(left / unit);
  const flat = [];
  for (const it of items) for (let k = q[it.id]; k < it.cap; k++) flat.push({ id: it.id, w: Math.ceil(it.price / unit), v: it.utility * Math.pow(0.9, k) });
  const dp = new Float64Array(C + 1), keep = Array.from({ length: flat.length }, () => new Uint8Array(C + 1));
  flat.forEach((f, i) => { for (let c = C; c >= f.w; c--) if (dp[c - f.w] + f.v > dp[c]) { dp[c] = dp[c - f.w] + f.v; keep[i][c] = 1; } });
  for (let i = flat.length - 1, c = C; i >= 0; i--) if (keep[i][c]) { q[flat[i].id]++; c -= flat[i].w; }
  const spent = items.reduce((s, it) => s + q[it.id] * it.price, 0);
  return { q, spent, utility: +items.reduce((s, it) => s + it.utility * q[it.id], 0).toFixed(1) };
}

// 이동도서관 경로: 수요 가중 정류장, 용량·시간창 확인 + 최근접 이웃 → 2-opt
export function routeMobileLibrary(depot, stops, { capacity = 600, speedKmh = 35, dwellMin = 40, startHour = 9 } = {}) {
  const d = (a, b) => haversineLike(a, b) / 1000 / speedKmh * 60; // 분
  const chosen = [...stops].sort((a, b) => b.demand - a.demand).filter((s, i, arr) => arr.slice(0, i + 1).reduce((x, y) => x + y.books, 0) <= capacity);
  const route = [depot];
  const rest = [...chosen];
  while (rest.length) {
    const cur = route.at(-1);
    rest.sort((a, b) => d(cur, a) - d(cur, b));
    route.push(rest.shift());
  }
  route.push(depot);
  const len = (r) => r.slice(1).reduce((s, p, i) => s + d(r[i], p), 0);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 2; i++) for (let j = i + 1; j < route.length - 1; j++) {
      const nr = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
      if (len(nr) + 1e-9 < len(route) && feasible(nr)) { route.splice(0, route.length, ...nr); improved = true; }
    }
  }
  function feasible(r) { return schedule(r).every((s) => !s.window || (s.arrive >= s.window[0] && s.arrive <= s.window[1])); }
  function schedule(r) {
    let t = startHour * 60;
    return r.map((p, i) => { if (i) t += d(r[i - 1], p) + (i > 1 ? dwellMin : 0); return { ...p, arrive: Math.round(t), window: p.window }; });
  }
  const sched = schedule(route);
  return { route: sched, minutes: Math.round(len(route) + dwellMin * (route.length - 2)), books: chosen.reduce((s, c) => s + c.books, 0), feasible: feasible(route) };
}
