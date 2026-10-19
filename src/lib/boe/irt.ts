// 문항반응이론(3PL)과 적응형 출제. 설계서 6.6절.
// P(정답|θ) = c + (1-c) / (1 + exp(-a(θ-b)))
export type Item = { id: string; a: number; b: number; c: number };
export type Answer = { id: string; correct: boolean };

export const prob = (theta: number, it: Item) => it.c + (1 - it.c) / (1 + Math.exp(-it.a * (theta - it.b)));

/** 피셔 정보량: I(θ) = a² (P-c)² / (1-c)² · (1-P)/P */
export function info(theta: number, it: Item) {
  const p = prob(theta, it);
  return ((it.a * it.a * (p - it.c) ** 2) / (1 - it.c) ** 2) * ((1 - p) / p);
}

const GRID = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);
const prior = (q: number, mu = 0, sd = 1) => Math.exp(-((q - mu) ** 2) / (2 * sd * sd));

/** EAP 추정. 사전분포 N(mu, sd²). 답이 하나도 없으면 사전 평균을 돌려준다. */
export function eap(answers: Answer[], bank: Map<string, Item>, mu = 0, sd = 1) {
  let num = 0, den = 0, sq = 0;
  for (const q of GRID) {
    let l = prior(q, mu, sd);
    for (const a of answers) {
      const it = bank.get(a.id);
      if (!it) continue;
      const p = prob(q, it);
      l *= a.correct ? p : 1 - p;
    }
    num += q * l; den += l; sq += q * q * l;
  }
  if (den === 0) return { theta: mu, se: sd };
  const theta = num / den;
  return { theta, se: Math.sqrt(Math.max(sq / den - theta * theta, 0)) };
}

/**
 * 정보량이 가장 큰 문항을 고른다. 노출 제어(Sympson-Hetter)를 흉내 내어
 * 많이 나온 문항은 exposure 확률로 건너뛴다.
 */
export function nextItem<T extends Item>(theta: number, pool: T[], used: Set<string>, rand = Math.random, exposure: Record<string, number> = {}) {
  const ranked = pool.filter((it) => !used.has(it.id)).sort((x, y) => info(theta, y) - info(theta, x));
  for (const it of ranked) {
    const k = exposure[it.id] ?? 1;
    if (rand() < k) return it;
  }
  return ranked[0];
}

/** CAT 종료 규칙: 최소 7문항, 최대 12문항, 그 사이엔 표준오차 0.45 이하면 끝. */
export const shouldStop = (n: number, se: number) => n >= 12 || (n >= 7 && se <= 0.45);

/** θ(-4~4)를 사람이 읽을 0~100 점수로. */
export const thetaToScore = (t: number) => Math.round(Math.min(100, Math.max(0, ((t + 3) / 6) * 100)));
