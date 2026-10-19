import test from 'node:test';
import assert from 'node:assert/strict';
import { inverse, cholesky, mulberry32, normCdf } from '../src/core/math.js';
import { LinearTS, recommend, buildContext, mmr, reward } from '../src/core/mab.js';
import { analyze, koreanLix, splitSentences } from '../src/core/nlp.js';
import { knapsack01, groupKnapsack, planSessions, readiness, chronotype } from '../src/core/scheduler.js';
import { haversine, availabilityProb, rankLibraries, toHex, hexDistance } from '../src/core/gis.js';
import { buildIndex, summarize, entailment, rrf, answer } from '../src/core/rag.js';
import { p3pl, eap, info, nextItem, sm2 } from '../src/core/irt.js';
import { chooseK, robustScale, cusum } from '../src/core/cluster.js';
import { smape, ensembleForecast, optimizePurchase, routeMobileLibrary } from '../src/core/forecast.js';
import { ConsentLedger, kAnonymize, authorize, dpCount } from '../src/core/privacy.js';

test('math: inverse·cholesky 골든 값', () => {
  const A = [[4, 2], [2, 3]];
  const I = inverse(A);
  assert.ok(Math.abs(I[0][0] - 0.375) < 1e-9 && Math.abs(I[0][1] + 0.25) < 1e-9);
  const L = cholesky(A);
  assert.ok(Math.abs(L[0][0] - 2) < 1e-9 && Math.abs(L[1][0] - 1) < 1e-9);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-3);
});

test('MAB: 보상식과 학습 후 선호 팔 우선', () => {
  assert.equal(reward({ click: true, dwellMs: 40000, reserved: true }), 1);
  assert.equal(reward({ click: true }), 0.2);
  const rng = mulberry32(1);
  const model = new LinearTS({ rng, v: 0.1 });
  const user = { tasteVec: [1, 0, 0], theta: 0 };
  const books = [
    { isbn: 'A', styleVec: [1, 0, 0], difficultyTheta: 0, avgChunkMin: 30, nearbyAvailProb: 0.9, cognitiveLoad: 0.5 },
    { isbn: 'B', styleVec: [0, 1, 0], difficultyTheta: 2, avgChunkMin: 90, nearbyAvailProb: 0.1, cognitiveLoad: 0.5 },
  ];
  const ctx = buildContext({ date: new Date('2026-10-19T08:00:00'), readiness: 0.7 });
  const rec = recommend({ model, books, user, context: ctx, k: 2 });
  assert.equal(rec[0].isbn, 'A');
  assert.ok(rec[0].reasons.length >= 1);
});

test('MMR: 동일 문체 중복을 뒤로 민다', () => {
  const c = [
    { id: 1, score: 1, styleVec: [1, 0] }, { id: 2, score: 0.95, styleVec: [1, 0] }, { id: 3, score: 0.8, styleVec: [0, 1] },
  ];
  const r = mmr(c, 2, 0.5);
  assert.deepEqual(r.map((x) => x.id), [1, 3]);
});

test('NLP: 쉬운 글 < 어려운 글 (인지부하·LIX)', () => {
  const easy = '나는 집에 갔다. 엄마가 밥을 주었다. 우리는 같이 먹었다. 밤에 별을 보았다.';
  const hard = '항성 내부의 핵융합 반응은 수소를 헬륨으로 전환하며, 이 과정에서 방출되는 에너지는 중력 수축과 균형을 이루어 항성의 구조적 안정성을 유지한다. 초신성 폭발은 철보다 무거운 원소의 합성을 가능하게 하는 극단적 현상이다.';
  const a = analyze(easy), b = analyze(hard);
  assert.ok(a.cl < b.cl, `cl ${a.cl} < ${b.cl}`);
  assert.ok(koreanLix(easy) < koreanLix(hard));
  assert.equal(splitSentences(easy).length, 4);
  for (const v of Object.values(b.scores)) assert.ok(v >= 0 && v <= 100);
});

test('Scheduler: knapsack 골든·그룹·순차 계획', () => {
  const r = knapsack01([{ w: 1, v: 1 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 7 }], 7);
  assert.equal(r.value, 9);
  const g = groupKnapsack([{ options: [{ w: 3, v: 2 }, { w: 6, v: 5 }] }, { options: [{ w: 4, v: 4 }] }], 8);
  assert.equal(g.value, 6);
  const chunks = Array.from({ length: 6 }, (_, i) => ({ id: i, chapter: i < 3 ? 1 : 2, eojeol: 900, load: 0.5, importance: 1 }));
  const { plan } = planSessions({ chunks, slots: [{ availableMin: 30, readiness: 1 }, { availableMin: 30, readiness: 1 }], wpm: 180 });
  assert.ok(plan[0].chunks.length >= 1);
  assert.ok(readiness(10.5, {}) > readiness(14, {}));
  assert.ok(readiness(10.5, {}) > readiness(3, {}));
  assert.equal(chronotype({ workdaySleep: ['23:00', '06:30'], freeSleep: ['23:00', '06:30'] }).label, '아침형');
});

test('GIS: haversine·hex·베타이항·정렬', () => {
  const d = haversine({ lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 });
  assert.ok(Math.abs(d / 1000 - 325) < 5);
  assert.equal(hexDistance(toHex({ lat: 35.9, lng: 127.05 }), toHex({ lat: 35.9, lng: 127.05 })), 0);
  assert.equal(availabilityProb({ availObs: 0, totalObs: 0 }), 0.5);
  const user = { lat: 35.91, lng: 127.06 };
  const libs = [{ code: 'near', lat: 35.915, lng: 127.065, hours: [0, 24] }, { code: 'far', lat: 35.95, lng: 127.12, hours: [0, 24] }, { code: 'x', lat: 35.92, lng: 127.07, hours: [0, 24] }];
  const inv = { near: { status: 'available', availObs: 8, totalObs: 10 }, far: { status: 'available', availObs: 8, totalObs: 10 }, x: { status: 'loaned' } };
  const r = rankLibraries({ user, libraries: libs, inventory: inv, now: new Date('2026-10-19T10:00:00') });
  assert.equal(r.rows[0].lib.code, 'near');
});

test('RAG: 인용 강제·검증·근거 부족 게이트', () => {
  const chapters = [{ id: 'ch1', title: '별', paragraphs: [
    '별은 수소를 태워 빛을 낸다. 별의 중심에서는 핵융합이 일어난다. 핵융합은 가벼운 원소를 무거운 원소로 바꾼다.',
    '무거운 별은 생의 끝에 초신성으로 폭발한다. 초신성은 무거운 원소를 우주로 흩뿌린다. 그 원소들은 새로운 별과 행성의 재료가 된다.',
    '지구의 탄소와 산소도 오래전 별에서 만들어졌다. 그래서 우리 몸은 별의 재료로 이루어져 있다.',
  ] }];
  const idx = buildIndex(chapters);
  assert.ok(idx.chunks.length >= 1);
  const s = summarize(idx, { chapter: 'ch1', query: '별 원소 핵융합' });
  assert.equal(s.status, 'ok');
  assert.ok(s.claims.every((c) => c.cite && c.entail >= 0.7));
  const q = answer(idx, '주식 시장 금리 전망', { tau: 0.35 });
  assert.equal(q.status, 'insufficient');
  assert.ok(entailment('별은 빛을 낸다', '별은 수소를 태워 빛을 낸다') >= 0.7);
  assert.equal(rrf([[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }]]).length, 2);
});

test('IRT: 3PL·EAP·정보량·문항선택·SM-2', () => {
  const it = { a: 1.2, b: 0, c: 0.25 };
  assert.ok(Math.abs(p3pl(0, it) - 0.625) < 1e-9);
  const up = eap([{ item: it, correct: true }, { item: { a: 1.2, b: 1 }, correct: true }]);
  const down = eap([{ item: it, correct: false }, { item: { a: 1.2, b: -1 }, correct: false }]);
  assert.ok(up.theta > 0 && down.theta < 0);
  assert.ok(info(0, { a: 2, b: 0 }) > info(0, { a: 0.6, b: 0 }));
  const bank = [{ id: 1, a: 1.5, b: 0, bloom: 1 }, { id: 2, a: 1.5, b: 3, bloom: 1 }];
  assert.equal(nextItem(bank, { theta: 0, rng: () => 0 }).id, 1);
  assert.deepEqual(sm2(undefined, 5), { ef: 2.6, reps: 1, interval: 1 });
});

test('Cluster: K 선택·CUSUM', () => {
  const rng = mulberry32(3);
  const X = [];
  for (const c of [[0, 0], [5, 5], [0, 5]]) for (let i = 0; i < 10; i++) X.push([c[0] + rng() * 0.5, c[1] + rng() * 0.5]);
  const { Z } = robustScale(X);
  const r = chooseK(Z, [3, 5]);
  assert.equal(r.k, 3);
  const cs = cusum([0.8, 0.8, 0.8, 0.7, 0.65, 0.6, 0.55]);
  assert.ok(cs.alarmAt !== null);
});

test('Forecast: sMAPE·앙상블·구매·경로', () => {
  assert.equal(smape([100], [100]), 0);
  const y = Array.from({ length: 36 }, (_, t) => 100 + 2 * t + 20 * Math.sin((2 * Math.PI * t) / 12));
  const cal = { semester: [2, 3, 4, 5, 8, 9, 10, 11], vacation: [0, 1, 6, 7] };
  const f = ensembleForecast(y, { calendar: cal, h: 6 });
  assert.equal(f.band.length, 6);
  assert.ok(f.band.every((b) => b.p10 <= b.p50 && b.p50 <= b.p90));
  const p = optimizePurchase([
    { id: 'a', category: 'sci', price: 15000, utility: 5, cap: 3 },
    { id: 'b', category: 'lit', price: 12000, utility: 3, cap: 3 },
  ], 50000, { minPerCategory: { lit: 1 } });
  assert.ok(p.spent <= 50000 && p.q.b >= 1);
  const route = routeMobileLibrary({ name: 'D', lat: 35.9, lng: 127.05 }, [
    { name: 'a', lat: 35.95, lng: 127.1, demand: 5, books: 100 }, { name: 'b', lat: 35.85, lng: 127.0, demand: 3, books: 100 },
  ]);
  assert.equal(route.route.length, 4);
});

test('Privacy: 해시체인·k-익명·ABAC·DP', () => {
  const L = new ConsentLedger();
  L.append({ userId: 'u', purpose: 'bio', scope: 'sleep', action: 'grant' });
  L.append({ userId: 'u', purpose: 'bio', scope: 'sleep', action: 'revoke' });
  assert.ok(L.verify());
  assert.equal(L.current('u').bio, false);
  L.entries[0].action = 'revoke';
  assert.equal(L.verify(), false);
  assert.equal(kAnonymize([{ n: 3 }], 5)[0].suppressed, true);
  assert.equal(authorize({ role: 'teacher' }, 'read', { kind: 'bio', granularity: 'individual' }).allow, false);
  assert.ok(dpCount(100, { rng: mulberry32(2) }) >= 0);
});

import { runOpe } from '../src/core/ope.js';
import { BOOKS, STYLE_CARDS } from '../src/api/data.js';
test('OPE: DR 추정이 실제 가치에 가깝고, 학습 정책이 인기순보다 낫다', () => {
  const r = runOpe({ books: BOOKS, tastes: STYLE_CARDS.map((c) => c.vec), n: 3000 });
  const lin = r.rows.find((x) => x.name.startsWith('LinTS')), pop = r.rows.find((x) => x.name.startsWith('인기순'));
  assert.ok(lin.truth > pop.truth);
  for (const x of r.rows) assert.ok(x.drErr < 0.06, `${x.name} DR 오차 ${x.drErr}`);
});
