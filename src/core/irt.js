// 6.6 Bloom 적응형 퀴즈 + IRT (3PL, EAP, Fisher 정보 최대화, Sympson-Hetter 노출 제어) + SM-2 복습
const GRID = Array.from({ length: 81 }, (_, i) => -4 + i * 0.1);
const prior = (q) => Math.exp(-(q * q) / 2); // N(0,1) 비정규화

// P(정답|θ) = c + (1−c)/(1+exp(−a(θ−b)))
export const p3pl = (theta, { a, b, c = 0.25 }) => c + (1 - c) / (1 + Math.exp(-a * (theta - b)));

// EAP: θ̂ = Σ q·L(q)·g(q) / Σ L(q)·g(q)
export function eap(responses) {
  let num = 0, den = 0, sq = 0;
  const w = GRID.map((q) => {
    let L = 1;
    for (const r of responses) { const p = p3pl(q, r.item); L *= r.correct ? p : 1 - p; }
    return L * prior(q);
  });
  GRID.forEach((q, i) => { num += q * w[i]; den += w[i]; });
  const theta = num / den;
  GRID.forEach((q, i) => { sq += (q - theta) ** 2 * w[i]; });
  return { theta: +theta.toFixed(3), se: +Math.sqrt(sq / den).toFixed(3) };
}

// Fisher 정보: I(θ) = a²·(P−c)²/(1−c)² · (1−P)/P
export function info(theta, item) {
  const c = item.c ?? 0.25, P = p3pl(theta, item);
  return (item.a ** 2 * (P - c) ** 2) / (1 - c) ** 2 * ((1 - P) / P);
}

// Bloom 단계 배분: θ 구간별 (기억·이해 / 적용·분석 / 평가·창의)
export const BLOOM = ['기억', '이해', '적용', '분석', '평가', '창의'];
export function bloomMix(theta) {
  if (theta < -0.5) return [0.6, 0.3, 0.1];
  if (theta < 0.7) return [0.4, 0.4, 0.2];
  return [0.2, 0.45, 0.35];
}
const band = (lvl) => (lvl <= 1 ? 0 : lvl <= 3 ? 1 : 2);

// 다음 문항: 목표 Bloom 밴드 가중 × Fisher 정보 최대, Sympson-Hetter 확률 k_i로 노출 억제
export function nextItem(bank, { theta, used = [], rng = Math.random, exposure = {} }) {
  const mix = bloomMix(theta);
  const pool = bank.filter((it) => !used.includes(it.id));
  if (!pool.length) return null;
  const ranked = pool.map((it) => ({ it, s: info(theta, it) * (0.5 + mix[band(it.bloom)]) })).sort((a, b) => b.s - a.s);
  for (const { it } of ranked) {
    const k = exposure[it.id] ?? it.shK ?? 1; // SH 노출 파라미터
    if (rng() <= k) return it;
  }
  return ranked[0].it;
}

// 파일럿 응답이 n<200인 신규 문항: 사전값(a=1, b=Bloom 기반)과 관측 정답률을 베이지안 가중
export function calibratedItem(item) {
  const n = item.pilotN ?? 0;
  if (n >= 200) return item;
  const priorB = -1 + 0.45 * item.bloom;
  const obsB = item.pilotCorrect != null && n ? -Math.log((Math.max(0.26, Math.min(0.97, item.pilotCorrect / n)) - 0.25) / (1 - Math.max(0.26, Math.min(0.97, item.pilotCorrect / n)))) : priorB;
  const w = n / (n + 200);
  return { ...item, a: item.a ?? 1, b: +(w * obsB + (1 - w) * priorB).toFixed(2), calibrated: false };
}

// SM-2 간격 반복 (q: 0~5)
export function sm2(card = { ef: 2.5, reps: 0, interval: 0 }, q) {
  let { ef, reps, interval } = card;
  if (q < 3) { reps = 0; interval = 1; }
  else { reps += 1; interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef); }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ef: +ef.toFixed(2), reps, interval };
}

// 오답 개념 → 지식그래프 선수 개념 역탐색 (BFS)
export function prereqChain(conceptId, concepts, depth = 2) {
  const out = [];
  let frontier = [conceptId];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const id of frontier) for (const p of concepts.find((c) => c.id === id)?.prereq ?? []) if (!out.includes(p)) { out.push(p); next.push(p); }
    frontier = next;
  }
  return out;
}

// CAT 온보딩: 7~12문항, SE < 0.45 이면 조기 종료
export function catShouldStop(responses, { minItems = 7, maxItems = 12, seTarget = 0.45 } = {}) {
  if (responses.length >= maxItems) return true;
  if (responses.length < minItems) return false;
  return eap(responses).se < seTarget;
}
