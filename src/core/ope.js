// 6.1 오프라인 정책 평가: 로깅 정책의 기록(성향점수 포함)으로 새 추천 정책의 가치를 배포 전에 추정
// IPS · SNIPS · Direct Method · Doubly-Robust. 시뮬레이션이므로 실제 가치(ground truth)와 오차까지 보여준다.
import { mulberry32, sigmoid, dot } from './math.js';
import { featurize, buildContext, LinearTS, D } from './mab.js';

// 보상 모델(DM)용 릿지 회귀: r̂ = φ·w
function ridge(X, y, lambda = 1) {
  const d = X[0].length;
  const A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => X.reduce((s, x) => s + x[i] * x[j], 0) + (i === j ? lambda : 0)));
  const b = Array.from({ length: d }, (_, i) => X.reduce((s, x, k) => s + x[i] * y[k], 0));
  // 가우스 소거
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < d; c++) {
    let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < d; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= d; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r, i) => r[d] / r[i]);
}

export function simulateLog({ books, tastes, n = 3000, k = 6, eps = 0.3, seed = 42, trueW = [-3.4, 2.4, 1.3, 0.6, 0.8, 0.4, 0.5] }) {
  const rng = mulberry32(seed);
  const pop = Object.fromEntries(books.map((b, i) => [b.isbn, 1 - i / books.length])); // 카탈로그 앞쪽이 인기
  const log = [];
  for (let t = 0; t < n; t++) {
    const date = new Date(2026, 9, 1 + (t % 28), 6 + Math.floor(rng() * 17), Math.floor(rng() * 60));
    const ctx = buildContext({ date, readiness: rng(), availableMin: [15, 30, 60][Math.floor(rng() * 3)] });
    const user = { tasteVec: tastes[Math.floor(rng() * tastes.length)], theta: rng() * 3 - 1.5 };
    const cands = [...books].sort(() => rng() - 0.5).slice(0, k).map((b) => ({ ...b, nearbyAvailProb: rng() < 0.5 ? 0.9 : 0.2 }));
    const popBest = cands.reduce((a, b) => (pop[b.isbn] > pop[a.isbn] ? b : a));
    const ai = rng() < eps ? Math.floor(rng() * k) : cands.indexOf(popBest);
    const a = cands[ai];
    const p = (1 - eps) * (a === popBest ? 1 : 0) + eps / k;
    const phis = cands.map((c) => featurize(ctx, c, user));
    const pr = (phi) => sigmoid(dot(trueW, phi));
    const r = rng() < pr(phis[ai]) ? 1 : 0;
    log.push({ ctx, user, cands, phis, a: ai, p, r, trueP: phis.map(pr) });
  }
  return log;
}

// 평가할 정책들: (log 항목) → 선택 인덱스
export function makePolicies(train, seed = 3) {
  const model = new LinearTS({ rng: mulberry32(seed), v: 0.2 });
  // 공유 모델로 학습(팔 하나 'shared'): 로그의 (φ, r)로 업데이트 — 성향 가중치 역수로 편향 보정
  for (const e of train) model.update('shared', e.phis[e.a], e.r / Math.max(0.05, e.p * e.cands.length));
  const { mean } = model.posterior('shared');
  return {
    'LinTS (학습된 맥락 밴딧)': (e) => argmax(e.phis.map((f) => dot(mean, f))),
    '콘텐츠 기반 (문체 유사도)': (e) => argmax(e.phis.map((f) => f[1])),
    '인기순 (현재 로깅 정책의 탐욕 부분)': (e) => argmax(e.cands.map((c) => c.rank)),
    '무작위': (e) => Math.floor((e.phis[0][1] * 997) % e.cands.length),
  };
}
const argmax = (xs) => xs.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);

export function evaluate(test, policy, rewardModel) {
  let ips = 0, wsum = 0, snipsNum = 0, dm = 0, dr = 0, truth = 0;
  const chosen = new Map();
  for (const e of test) {
    const pi = policy(e);
    chosen.set(e.cands[pi].isbn, (chosen.get(e.cands[pi].isbn) || 0) + 1);
    const match = pi === e.a ? 1 : 0;
    const w = match / e.p;
    const rhatPi = dot(rewardModel, e.phis[pi]);
    const rhatA = dot(rewardModel, e.phis[e.a]);
    ips += w * e.r; wsum += w; snipsNum += w * e.r;
    dm += rhatPi;
    dr += rhatPi + w * (e.r - rhatA);
    truth += e.trueP[pi];
  }
  const n = test.length;
  const coverage = chosen.size; // 다양성 가드레일: 추천된 서로 다른 책 수
  return { ips: ips / n, snips: wsum ? snipsNum / wsum : 0, dm: dm / n, dr: dr / n, truth: truth / n, coverage };
}

export function runOpe({ books, tastes, n = 3000, seed = 42 }) {
  const ranked = books.map((b, i) => ({ ...b, rank: books.length - i }));
  const log = simulateLog({ books: ranked, tastes, n, seed });
  const half = Math.floor(log.length / 2);
  const train = log.slice(0, half), test = log.slice(half);
  const rm = ridge(train.map((e) => e.phis[e.a]), train.map((e) => e.r), 1);
  const policies = makePolicies(train);
  const logging = test.reduce((s, e) => s + e.r, 0) / test.length;
  const rows = Object.entries(policies).map(([name, pol]) => ({ name, ...evaluate(test, pol, rm) }));
  const base = rows.find((r) => r.name.startsWith('인기순'));
  return { n, logging, rows: rows.map((r) => ({ ...r, liftDR: base ? (r.dr - base.dr) / base.dr : 0, drErr: Math.abs(r.dr - r.truth), ipsErr: Math.abs(r.ips - r.truth) })), d: D };
}
