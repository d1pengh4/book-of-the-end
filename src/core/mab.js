// 6.1 Context-Aware 추천: Linear Thompson Sampling(팔별 A_a, b_a) → MMR 다양성 재정렬
import { identity, inverse, cholesky, matVec, gaussian, dot, cosine, clamp } from './math.js';

export const FEATURES = [
  { key: 'bias', label: null },
  { key: 'style', label: (v) => `문체 유사 ${v.toFixed(2)}` },
  { key: 'difficulty', label: () => '지금 난이도에 맞음' },
  { key: 'length', label: () => '지금 시간에 맞는 분량' },
  { key: 'nearby', label: () => '근처에서 바로 대출' },
  { key: 'timeOfDay', label: (v, x) => `${x.slotLabel} 시간대 선호` },
  { key: 'readiness', label: () => '집중하기 좋은 시간대(추정)' },
];
export const D = FEATURES.length;

// 맥락 x_t 구성: 시간대(sin/cos), 요일, 준비도 R_t, 날씨, 최근 7일 독서속도 z
export function buildContext({ date = new Date(), readiness = 0.5, weather = 'clear', speedZ = 0, availableMin = 30 } = {}) {
  const h = date.getHours() + date.getMinutes() / 60;
  const slotLabel = h < 11 ? '아침' : h < 17 ? '낮' : h < 21 ? '저녁' : '밤';
  return {
    hourSin: Math.sin((2 * Math.PI * h) / 24),
    hourCos: Math.cos((2 * Math.PI * h) / 24),
    weekend: [0, 6].includes(date.getDay()) ? 1 : 0,
    readiness, rainy: weather === 'rain' ? 1 : 0, speedZ, availableMin, slotLabel, hour: h,
  };
}

// φ(x_t, b) ∈ R^d
export function featurize(x, book, user) {
  const style = cosine(user.tasteVec, book.styleVec);
  const diffGap = (book.difficultyTheta ?? 0) - (user.theta ?? 0);
  const difficulty = Math.exp(-(diffGap * diffGap) / 2);
  const chunk = book.avgChunkMin ?? 30;
  const length = Math.exp(-Math.abs(chunk - x.availableMin) / 30);
  const nearby = clamp(book.nearbyAvailProb ?? 0, 0, 1);
  // 책의 시간대 성향(무거운 책=아침, 서사형=저녁)과 현재 시간 정합도
  const morningness = book.cognitiveLoad ?? 0.5;
  const timeOfDay = x.hour < 13 ? morningness : 1 - morningness;
  const readiness = x.readiness * morningness + (1 - x.readiness) * (1 - morningness);
  return [1, style, difficulty, length, nearby, timeOfDay, readiness];
}

export class LinearTS {
  constructor({ d = D, lambda = 1, v = 0.35, seed = 7, rng } = {}) {
    this.d = d; this.lambda = lambda; this.v = v;
    this.arms = new Map();
    this.rng = rng;
    this.seed = seed;
  }
  arm(id) {
    if (!this.arms.has(id)) {
      // 약한 사전지식: 문체·난이도 적합 쪽으로 b 초기화 (콜드스타트 = 인기+문체 유사도)
      const b = new Array(this.d).fill(0); b[1] = 0.6; b[2] = 0.4; b[4] = 0.2;
      this.arms.set(id, { A: identity(this.d, this.lambda), b, n: 0 });
    }
    return this.arms.get(id);
  }
  posterior(id) {
    const { A, b } = this.arm(id);
    const Ainv = inverse(A);
    return { mean: matVec(Ainv, b), Ainv };
  }
  sample(id) {
    const { mean, Ainv } = this.posterior(id);
    const cov = Ainv.map((row) => row.map((v) => v * this.v * this.v));
    const L = cholesky(cov);
    const z = Array.from({ length: this.d }, () => gaussian(this.rng));
    return mean.map((m, i) => m + L[i].reduce((s, l, k) => s + l * z[k], 0));
  }
  update(id, phi, reward) {
    const a = this.arm(id);
    for (let i = 0; i < this.d; i++) {
      for (let j = 0; j < this.d; j++) a.A[i][j] += phi[i] * phi[j];
      a.b[i] += reward * phi[i];
    }
    a.n += 1;
  }
  toJSON() { return { arms: [...this.arms.entries()] }; }
  load(json) { if (json?.arms) this.arms = new Map(json.arms); return this; }
}

// 보상 r = 0.2·click + 0.3·(dwell>30s) + 0.5·(reserve or start_reading)
export function reward({ click = false, dwellMs = 0, reserved = false, started = false }) {
  return 0.2 * (click ? 1 : 0) + 0.3 * (dwellMs > 30000 ? 1 : 0) + 0.5 * (reserved || started ? 1 : 0);
}

// MMR: score = λ·Rel(b) − (1−λ)·max_{b2∈S} Sim(b,b2)
export function mmr(cands, k, lambda = 0.7, sim = (a, b) => cosine(a.styleVec, b.styleVec)) {
  const pool = [...cands];
  const S = [];
  const maxRel = Math.max(...pool.map((c) => c.score), 1e-9);
  const minRel = Math.min(...pool.map((c) => c.score));
  const rel = (c) => (c.score - minRel) / (maxRel - minRel || 1);
  while (S.length < k && pool.length) {
    let best = -Infinity, bi = 0;
    pool.forEach((c, i) => {
      const red = S.length ? Math.max(...S.map((s) => sim(c, s))) : 0;
      const sc = lambda * rel(c) - (1 - lambda) * red;
      if (sc > best) { best = sc; bi = i; }
    });
    S.push({ ...pool[bi], mmr: best });
    pool.splice(bi, 1);
  }
  return S;
}

// 추천 근거 코드: 사후평균 θ̂ 기준 각 피처 기여도 상위 2개
export function reasonCodes(meanTheta, phi, x) {
  return FEATURES.map((f, i) => ({ f, i, c: meanTheta[i] * phi[i] }))
    .filter((r) => r.f.label && r.c > 0.02)
    .sort((a, b) => b.c - a.c)
    .slice(0, 2)
    .map((r) => ({ code: r.f.key, text: r.f.label(phi[r.i], x), weight: +r.c.toFixed(3) }));
}

// 전체 파이프라인: 후보 → LinTS 점수 → 상위 20 → MMR 5
export function recommend({ model, books, user, context, k = 5, candidateN = 20, lambda = 0.7 }) {
  const scored = books
    .filter((b) => !user.finished?.includes(b.isbn))
    .map((b) => {
      const phi = featurize(context, b, user);
      const th = model.sample(b.isbn);
      const { mean } = model.posterior(b.isbn);
      return { ...b, phi, score: dot(phi, th), expected: dot(phi, mean), reasons: reasonCodes(mean, phi, context) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, candidateN);
  return mmr(scored, k, lambda);
}

// Intra-List Similarity (다양성 지표, 낮을수록 다양)
export function ils(list) {
  let s = 0, n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { s += cosine(list[i].styleVec, list[j].styleVec); n++; }
  return n ? s / n : 0;
}
