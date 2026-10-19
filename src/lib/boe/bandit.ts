// 맥락 밴딧 추천. 설계서 6.1절.
// 후보 → Linear Thompson Sampling 재랭킹 → MMR 다양성 재정렬.
import { cosine, identity, inverse, matVec, sampleMvn, dot, type Mat, type Vec } from './math';

export const FEATURES = ['기본', '문체 유사', '난이도 적합', '가까움', '대출 가능', '지금 길이', '밤 시간대 깊은 책'] as const;
export const D = FEATURES.length;

export type BanditState = { A: Mat; b: Vec; n: number };
export const freshBandit = (lambda = 1): BanditState => ({
  A: identity(D, lambda),
  // 아무 데이터가 없을 때도 말이 되는 순서가 나오게 약한 사전 선호를 넣는다 (콜드스타트 폴백)
  b: [0, 0.6, 0.5, 0.3, 0.3, 0.2, 0.1],
  n: 0,
});

export type Context = { hour: number; readiness: number; theta: number; taste: Vec; minutes: number };
export type Candidate = { id: string; style: Vec; difficulty: number; etaMin: number | null; p: number; chunkMin: number; deep: number };

/** φ(x, b): 맥락과 책을 합친 특징 벡터 */
export function features(x: Context, c: Candidate): Vec {
  const night = Math.max(0, -Math.cos((2 * Math.PI * x.hour) / 24)); // 자정에 1, 정오에 0
  return [
    1,
    Math.max(0, cosine(x.taste, c.style)),
    Math.exp(-((c.difficulty - x.theta) ** 2) / 2),
    c.etaMin == null ? 0 : Math.exp(-c.etaMin / 20),
    c.p,
    Math.exp(-(((c.chunkMin - x.minutes) / x.minutes) ** 2)),
    night * x.readiness * c.deep,
  ];
}

export type Scored = { id: string; score: number; mean: number; phi: Vec; reasons: { label: string; value: number }[] };

export function score(state: BanditState, x: Context, cands: Candidate[], rand: () => number): Scored[] {
  const Ainv = inverse(state.A);
  const mu = matVec(Ainv, state.b);
  const v2 = 0.25; // 탐색 세기
  const theta = sampleMvn(mu, Ainv.map((r) => r.map((x) => x * v2)), rand);
  return cands.map((c) => {
    const phi = features(x, c);
    const contrib = phi.map((f, i) => ({ label: FEATURES[i], value: f * mu[i] }));
    const reasons = contrib.slice(1).filter((r) => r.value > 0.05).sort((a, b) => b.value - a.value).slice(0, 3);
    return { id: c.id, score: dot(phi, theta), mean: dot(phi, mu), phi, reasons };
  });
}

/** MMR: λ·관련도 − (1−λ)·이미 고른 것과의 최대 유사도 */
export function mmr(scored: Scored[], styleOf: (id: string) => Vec, k: number, lambda = 0.7) {
  const pool = [...scored];
  const out: Scored[] = [];
  const lo = Math.min(...pool.map((s) => s.score)), hi = Math.max(...pool.map((s) => s.score));
  const rel = (s: Scored) => (hi === lo ? 1 : (s.score - lo) / (hi - lo));
  while (out.length < k && pool.length) {
    let best = 0, bestV = -Infinity;
    pool.forEach((s, i) => {
      const sim = out.length ? Math.max(...out.map((o) => cosine(styleOf(s.id), styleOf(o.id)))) : 0;
      const v = lambda * rel(s) - (1 - lambda) * sim;
      if (v > bestV) { bestV = v; best = i; }
    });
    out.push(pool.splice(best, 1)[0]);
  }
  return out;
}

/** 보상 반영: A ← A + φφᵀ, b ← b + rφ */
export function update(state: BanditState, phi: Vec, reward: number): BanditState {
  const A = state.A.map((row, i) => row.map((v, j) => v + phi[i] * phi[j]));
  const b = state.b.map((v, i) => v + reward * phi[i]);
  return { A, b, n: state.n + 1 };
}

/** 보상 r = 0.2·클릭 + 0.3·(30초 넘게 봄) + 0.5·(예약 또는 읽기 시작) */
export const REWARD = { click: 0.2, dwell: 0.3, commit: 0.5 } as const;
