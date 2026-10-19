// BFF 서비스 계층 (8.1 API 계약 데모 구현). 외부 API(정보나루·카카오·HealthKit·LLM)는 데모 어댑터로 대체.
import { Gateway } from './gateway.js';
import * as D from './data.js';
import { mulberry32, mean, fnv1a } from '../core/math.js';
import { LinearTS, recommend, featurize, reward, buildContext, ils } from '../core/mab.js';
import { analyze, formatMinutes } from '../core/nlp.js';
import { readinessCurve, declaredCurve, suggestSlots, planSessions, chronotype, readiness, fmt } from '../core/scheduler.js';
import { rankLibraries, etaFallback, haversine, interLibraryOptions } from '../core/gis.js';
import { buildIndex, summarize, answer, buildGraph, retrieve } from '../core/rag.js';
import { eap, nextItem, calibratedItem, sm2, prereqChain, catShouldStop, p3pl, BLOOM } from '../core/irt.js';
import { robustScale, chooseK, riskScores, cusum, fnrGap } from '../core/cluster.js';
import { ensembleForecast, coverage, optimizePurchase, routeMobileLibrary } from '../core/forecast.js';
import { authorize, kAnonymize, dpCount, ConsentLedger } from '../core/privacy.js';
import { runOpe } from '../core/ope.js';

export const gw = new Gateway();
const rng = mulberry32(20261019);

// ── 모델/인덱스 상태 ─────────────────────────────────────────
export const mabModel = new LinearTS({ rng, v: 0.3 });
export const ragIndex = buildIndex(D.DEMO_TEXT.chapters);
export const graph = buildGraph(ragIndex, D.CONCEPTS);
export const quizBank = D.QUIZ_BANK.map(calibratedItem);
const bookAnalysis = new Map(D.BOOKS.map((b) => [b.isbn, analyze(b.sample, { totalEojeol: b.totalEojeol })]));
export const bookByIsbn = (isbn) => D.BOOKS.find((b) => b.isbn === isbn);
export const getAnalysis = (isbn) => bookAnalysis.get(isbn);

// ── 온보딩 ──────────────────────────────────────────────────
export const Onboarding = {
  tasteFromCards(picked) {
    const vecs = picked.map((i) => D.STYLE_CARDS[i].vec);
    if (!vecs.length) return D.STYLE_AXES.map(() => 1 / Math.sqrt(D.STYLE_AXES.length));
    return D.STYLE_AXES.map((_, j) => +mean(vecs.map((v) => v[j])).toFixed(3));
  },
  tasteFromGenres(genres) { // 폴백: 장르 선택 UI
    const map = { 소설: [0.6, 0.5, 0, 0.3, 0.2, 0.2], 과학: [0.1, 0.1, 1, 0.6, 0.1, 0.1], 역사: [0.1, 0.3, 0.9, 0.5, 0.2, 0.1], 에세이: [0.4, 0, 0.2, 0.5, 1, 0.4], 철학: [0.1, 0.2, 0.6, 1, 0.2, 0], 고전: [0.6, 0.2, 0, 0.8, 0.2, 0.1] };
    const vs = genres.map((g) => map[g]).filter(Boolean);
    return D.STYLE_AXES.map((_, j) => +mean(vs.map((v) => v[j])).toFixed(3));
  },
  catNext(responses) {
    return gw.call('Onboarding.Cat', async () => {
      const used = responses.map((r) => r.item.id);
      const est = responses.length ? eap(responses) : { theta: 0, se: 1 };
      const done = catShouldStop(responses);
      const item = done ? null : nextItem(D.CAT_BANK, { theta: est.theta, used, rng });
      return { item, est, done };
    }, { meanMs: 25 });
  },
};

// ── 추천 (Reco.GetFeed) ────────────────────────────────────
function nearbyProb(isbn, loc) {
  const inv = D.demoInventory(isbn);
  return Math.max(0, ...D.LIBRARIES.filter((l) => haversine(loc, l) < 8000).map((l) => (inv[l.code].status === 'available' ? 0.9 : inv[l.code].status === 'reservable' ? 0.35 : 0)));
}
export const Reco = {
  getFeed({ user, readinessNow = 0.5, availableMin = 30, date = new Date(), weather = 'clear', locationGranted = true }) {
    return gw.call('Reco.GetFeed', async () => {
      const ctx = buildContext({ date, readiness: readinessNow, weather, speedZ: user.speedZ ?? 0, availableMin });
      const loc = locationGranted ? user.loc ?? D.USER_LOC : null;
      const books = D.BOOKS.map((b) => ({ ...b, nearbyAvailProb: loc ? nearbyProb(b.isbn, loc) : 0, avgChunkMin: b.avgChunkMin }));
      const items = recommend({ model: mabModel, books, user, context: ctx, k: 5 }).map((b) => ({
        ...b, minutes: Math.round(analyze(b.sample, { totalEojeol: b.totalEojeol, wpm: user.wpm ?? 180 }).minutes),
      }));
      items.forEach((b, i) => gw.bus.emit('impression', { isbn13: b.isbn, position: i, score: +b.score.toFixed(3) }, { userId: user.id }));
      return { items, context: ctx, ils: +ils(items).toFixed(2), fallback: loc ? null : '위치 권한 없음: 시간대·최근 독서만 사용' };
    }, { meanMs: 90 });
  },
  feedback({ user, isbn, context, ...signal }) {
    const book = bookByIsbn(isbn);
    const phi = featurize(context, { ...book, nearbyAvailProb: nearbyProb(isbn, user.loc ?? D.USER_LOC) }, user);
    const r = reward(signal);
    mabModel.update(isbn, phi, r);
    const topic = signal.reserved ? 'loan_reserve' : signal.started ? 'session_start' : 'click';
    gw.bus.emit(topic, { isbn13: isbn, reward: r, dwell_ms: signal.dwellMs ?? 0 }, { userId: user.id });
    return r;
  },
};

// ── 도서관 (Library.FindAvailability) ────────────────────────
const PRICE = (b) => ({ 알라딘: Math.round(b.price * 0.9 / 10) * 10, 교보문고: Math.round(b.price * 0.9 / 10) * 10, 정가: b.price });
export const Library = {
  findAvailability({ isbn, loc = D.USER_LOC, now = new Date() }) {
    return gw.call('Library.FindAvailability', async () => {
      const key = `inv:${isbn}`;
      let invMeta = { source: '정보나루(데모)', cached: false, needsCheck: false };
      const inv = await gw.external('정보나루', async () => { const v = D.demoInventory(isbn); gw.cache.set(key, v, 15 * 60000); return v; }, async () => {
        const c = gw.cache.get(key);
        invMeta = { source: c ? '캐시' : '최근 관측 이력', cached: true, needsCheck: true };
        return c ? c.value : D.demoInventory(isbn);
      });
      if (inv.degraded) invMeta.degraded = inv.degraded;
      let etaSource = 'Kakao Mobility(데모)';
      const etas = {};
      for (const l of D.LIBRARIES) {
        const e = await gw.external('Kakao Mobility', async () => { const f = etaFallback(loc, l); return { ...f, minutes: Math.max(2, Math.round(f.minutes * 0.92)), source: 'kakao' }; }, async () => { etaSource = 'Haversine×1.3 근사'; return etaFallback(loc, l); });
        etas[l.code] = e;
      }
      const ranked = rankLibraries({ user: loc, libraries: D.LIBRARIES, inventory: inv, now, eta: (u, l) => etas[l.code] });
      const anyAvailable = ranked.rows.some((r) => r.inv.status === 'available');
      const holders = D.LIBRARIES.filter((l) => inv[l.code]?.status !== 'loaned');
      const lola = anyAvailable ? [] : interLibraryOptions({ user: loc, libraries: D.LIBRARIES.slice(0, 3), holders: holders.length ? holders : [{ name: '전북 공동보존서고(데모)' }] });
      return { ...ranked, invMeta, etaSource, lola, prices: PRICE(bookByIsbn(isbn)), degraded: invMeta.degraded || (etaSource.includes('근사') ? 'Kakao 폴백' : null), _cache: invMeta.cached };
    }, { meanMs: 140 });
  },
  reserve({ user, isbn, libCode }) {
    gw.bus.emit('loan_reserve', { isbn13: isbn, lib_code: libCode }, { userId: user.id });
    return { ok: true, pickupBy: new Date(Date.now() + 3 * 86400000).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) };
  },
};

// ── NLP ────────────────────────────────────────────────────
export const Nlp = {
  analyze({ text, totalEojeol, wpm }) { return gw.call('Nlp.Analyze', async () => analyze(text, { totalEojeol, wpm }), { meanMs: 40 }); },
};

// ── 바이오 스케줄러 ─────────────────────────────────────────
export function bookChunks(book) {
  const r = mulberry32(parseInt(book.isbn.slice(-5), 10));
  const nCh = Math.max(6, Math.round(book.pages / 40));
  const per = Math.round(book.totalEojeol / nCh);
  const out = [];
  for (let c = 1; c <= nCh; c++) {
    const parts = per > 2400 ? 3 : per > 1300 ? 2 : 1;
    for (let p = 0; p < parts; p++) out.push({ id: `${c}-${p + 1}`, chapter: c, part: p + 1, parts, eojeol: Math.round(per / parts), load: Math.min(1, Math.max(0, book.cognitiveLoad + (r() - 0.5) * 0.2)), importance: 0.8 + r() * 0.4 });
  }
  return out;
}
export const HealthKit = {
  connect() { return gw.external('HealthKit', async () => ({ ok: true, ...D.demoBio() }), async () => ({ ok: false, reason: '건강 데이터 권한을 받지 못했어요' })); },
};
export const Scheduler = {
  plan({ user, book, bio, declared = ['07:00', '21:00'], progressChunk = 0, date = new Date() }) {
    return gw.call('Scheduler.PlanSessions', async () => {
      const chrono = bio ? chronotype({ workdaySleep: bio.workdaySleep, freeSleep: bio.freeSleep }) : null;
      const params = bio ? { rmssdZ: bio.rmssdZ, sleepEffZ: bio.sleepEffZ, loadZ: 0.2, msfsc: chrono.msfsc } : null;
      const curve = bio ? readinessCurve(params) : declaredCurve(declared);
      const slots = suggestSlots(curve, D.FREE_WINDOWS, 3);
      const chunks = bookChunks(book).slice(progressChunk);
      const { plan, remaining } = planSessions({ chunks, slots, wpm: user.wpm ?? 180 });
      const h = date.getHours() + date.getMinutes() / 60;
      const nowR = bio ? readiness(h, params) : curve.reduce((a, p) => (Math.abs(p.t - h) < Math.abs(a.t - h) ? p : a), curve[0]).r;
      const remainMin = remaining.reduce((s, c) => s + c.eojeol / (user.wpm ?? 180), 0) + plan.reduce((s, p) => s + p.minutes, 0);
      return { curve, slots, plan, chrono, mode: bio ? 'bio' : 'declared', nowReadiness: +nowR.toFixed(2), totalChunks: bookChunks(book).length, remainLabel: formatMinutes(remainMin) };
    }, { meanMs: 70 });
  },
  logSession({ user, isbn, minutes, pages, chunkIds }) {
    const wpm = Math.round((pages * 160) / Math.max(1, minutes));
    gw.bus.emit('reading_session_ended', { isbn13: isbn, pages_read: pages, wpm, focus_score: null, gaze_used: false, chunk_ids: chunkIds, device_ctx: { os: 'web', battery_pct: null } }, { userId: user.id, consentScope: ['analytics', 'personalization'] });
    return { wpm };
  },
};

// ── RAG ────────────────────────────────────────────────────
export const Rag = {
  summarizeChapter({ chapter }) {
    return gw.call('Rag.SummarizeChapter', async () => gw.external('LLM 제공사',
      async () => { const s = summarize(ragIndex, { chapter, query: `${ragIndex.chunks.find((c) => c.chapter === chapter)?.chapterTitle ?? ''} 핵심` }); return { ...s, engine: '근거 추출형 생성기(데모 LLM 대체)' }; },
      async () => ({ status: 'fallback', claims: [], engine: '폴백: 사용자 하이라이트 요약', reason: '요약 엔진에 연결하지 못해 내 하이라이트만 보여줘요' })), { meanMs: 260 });
  },
  ask({ question }) {
    return gw.call('Rag.Ask', async () => answer(ragIndex, question, { tau: 0.25 }), { meanMs: 220 });
  },
  debug(query, chapter) { return retrieve(ragIndex, query, { chapter }); },
};

// ── 퀴즈 ──────────────────────────────────────────────────
export const Quiz = {
  next({ theta, used, chapter, concept }) {
    return gw.call('Quiz.NextItem', async () => {
      const bank = concept ? quizBank.filter((q) => q.concept === concept || CONCEPT_PREREQ(concept).includes(q.concept)) : chapter ? quizBank.filter((q) => q.cite === chapter) : quizBank;
      return nextItem(bank, { theta, used, rng });
    }, { meanMs: 40 });
  },
  submit({ user, item, choice, responses, srs = {} }) {
    return gw.call('Quiz.Submit', async () => {
      const correct = choice === item.answer;
      const all = [...responses, { item, correct }];
      const est = eap(all);
      const prevP = p3pl(responses.length ? eap(responses).theta : 0, item);
      const card = sm2(srs[item.concept], correct ? 4 : 2);
      const prereq = correct ? [] : prereqChain(item.concept, D.CONCEPTS).map((id) => D.CONCEPTS.find((c) => c.id === id).label);
      gw.bus.emit('quiz_answered', { item_id: item.id, bloom: BLOOM[item.bloom], correct }, { userId: user.id });
      gw.bus.emit('theta_update', { theta: est.theta, se: est.se }, { userId: user.id });
      return { correct, est, expectedP: +prevP.toFixed(2), card, prereq };
    }, { meanMs: 50 });
  },
};

const CONCEPT_PREREQ = (id) => prereqChain(id, D.CONCEPTS, 1);

// ── 실험: 오프라인 정책 평가 ───────────────────────────────
export const Experiment = {
  run({ seed = 42 } = {}) { return gw.call('Experiment.OfflineEval', async () => runOpe({ books: D.BOOKS, tastes: D.STYLE_CARDS.map((c) => c.vec), n: 3000, seed }), { meanMs: 150 }); },
};

// ── 교사 (Classroom) ──────────────────────────────────────
export const Classroom = {
  cohort({ teacher = { role: 'teacher' }, classId = '2-3' }) {
    return gw.call('Classroom.GetCohortHeatmap', async () => {
      const students = D.demoClass(classId === '2-3' ? 21 : 33, classId === '2-3' ? 26 : 4);
      const az = authorize(teacher, 'read', { kind: 'cohort', n: students.length });
      if (!az.allow) return { denied: az.reason, n: students.length };
      const X = students.map((s) => [s.acc, s.wpm, s.vocabErr, s.irregular, s.dropout]);
      const { Z } = robustScale(X);
      const km = chooseK(Z, [3, 6]);
      const risk = riskScores(Z, km.labels, km.centroids);
      const order = [...new Set(km.labels)].map((c) => ({ c, r: mean(risk.filter((_, i) => km.labels[i] === c)) })).sort((a, b) => b.r - a.r);
      const names = ['집중 지원 필요', '관찰 필요', '안정', '심화 가능', '자기주도', '균형'];
      const clusterName = Object.fromEntries(order.map((o, i) => [o.c, i === 0 ? names[0] : i === order.length - 1 ? names[3] : names[Math.min(i, 2)] + (i > 1 ? ` ${i}` : '')]));
      const thr = [...risk].sort((a, b) => b - a)[Math.floor(students.length * 0.2)];
      const rows = students.map((s, i) => {
        const cs = cusum(s.weekly);
        const flagged = risk[i] >= thr || cs.alarmAt !== null;
        const why = [];
        if (s.acc < 0.65) why.push(`정답률 ${Math.round(s.acc * 100)}%`);
        if (s.vocabErr > 0.25) why.push(`어휘 오답 ${Math.round(s.vocabErr * 100)}%`);
        if (s.dropout > 0.2) why.push('세션 중도 이탈 잦음');
        if (cs.alarmAt !== null) why.push(`${cs.alarmAt + 1}주차부터 하락 추세`);
        const support = s.vocabErr > 0.25 ? '어휘 예습 카드와 쉬운 판본 병행을 권해요' : s.dropout > 0.2 ? '15분 단위 짧은 청크로 나눠 주세요' : '1:1로 읽기 목표를 함께 정해 보세요';
        return { ...s, cluster: km.labels[i], clusterName: clusterName[km.labels[i]], risk: risk[i], flagged, why, support, cusum: cs };
      });
      const fair = fnrGap(rows, 'group');
      return { rows, k: km.k, sil: +km.sil.toFixed(2), tries: km.tries, fair, n: students.length, bioIndividual: authorize(teacher, 'read', { kind: 'bio', granularity: 'individual' }) };
    }, { meanMs: 180 });
  },
  generateMaterials({ standard, level = '보통' }) {
    return gw.call('Materials.Generate', async () => {
      const t0 = performance.now();
      const sums = D.DEMO_TEXT.chapters.map((c) => ({ ch: c, s: summarize(ragIndex, { chapter: c.id, query: c.title, maxSentences: 2 }) }));
      const lvlIdx = level === '쉬움' ? [0, 1] : level === '보통' ? [1, 3] : [3, 5];
      const items = quizBank.filter((q) => q.bloom >= lvlIdx[0] && q.bloom <= lvlIdx[1]).slice(0, 4);
      const topics = graph.edges.filter((e) => e.conf >= 0.5).slice(0, 3).map((e) => {
        const a = D.CONCEPTS.find((c) => c.id === e.a).label, b = D.CONCEPTS.find((c) => c.id === e.b).label;
        return `「${a}」과(와) 「${b}」은(는) 어떤 관계일까요? 본문에서 근거 문장을 찾아 설명해 봅시다.`;
      });
      return { standard, level, summaries: sums, items, topics, ms: Math.round(performance.now() - t0) };
    }, { meanMs: 600 });
  },
};

// ── 도서관·지자체 (Demand) ─────────────────────────────────
export const Demand = {
  forecast({ region, keyword, h = 6 }) {
    return gw.call('Demand.Forecast', async () => {
      const az = authorize({ role: 'librarian' }, 'read', { kind: 'region-aggregate', n: 120 });
      if (!az.allow) return { denied: az.reason };
      const y = D.demandSeries(region, keyword);
      const f = ensembleForecast(y, { calendar: D.CALENDAR, h });
      const cov = coverage(y, { calendar: D.CALENDAR });
      return { y, ...f, coverage: +cov.toFixed(2) };
    }, { meanMs: 320 });
  },
  purchase({ budget, minPerCategory }) {
    const catKw = { 과학: '과학 교양', 문학: '청소년 소설', 역사: '역사', 인문: '자기계발' };
    const growth = Object.fromEntries(Object.entries(catKw).map(([c, kw]) => {
      const f = ensembleForecast(D.demandSeries('삼례읍', kw), { calendar: D.CALENDAR, h: 3 });
      return [c, { p50: mean(f.band.map((b) => b.p50)), p90: mean(f.band.map((b) => b.p90)) }];
    }));
    const items = D.PURCHASE_CANDIDATES.map((p) => ({ ...p, utility: +(growth[p.category].p50 / 20).toFixed(2), cap: Math.max(1, Math.round(growth[p.category].p90 / 40)) }));
    return { ...optimizePurchase(items, budget, { minPerCategory }), items, growth };
  },
  route() { return routeMobileLibrary(D.MOBILE_DEPOT, D.MOBILE_STOPS, { capacity: 600 }); },
  literacyIndex({ epsilon = 1.0, k = 10 } = {}) {
    const r = mulberry32(77);
    const groups = D.REGIONS.flatMap((reg) => ['10대', '20~30대', '40~50대', '60대 이상'].map((age) => {
      const n = Math.round(4 + r() * 60);
      const readers = Math.round(n * (0.35 + r() * 0.45));
      return { region: reg, age, n, readers };
    }));
    return kAnonymize(groups, k).map((g) => g.suppressed ? g : { ...g, noisyReaders: dpCount(g.readers, { epsilon, rng: r }), rate: null }).map((g) => g.suppressed ? g : { ...g, rate: Math.min(1, g.noisyReaders / g.n) });
  },
};

// ── 데이터 오너십 ─────────────────────────────────────────
export const Privacy = {
  ledger: new ConsentLedger(),
  update({ user, purpose, scope, grant }) {
    return gw.call('Consent.Update', async () => {
      const e = this.ledger.append({ userId: user.id, purpose, scope, action: grant ? 'grant' : 'revoke' });
      gw.bus.emit('consent_changed', { purpose, action: e.action, ledger_hash: e.hash }, { userId: user.id });
      return e;
    }, { meanMs: 30 });
  },
  export({ user, state }) {
    return gw.call('Privacy.Export', async () => ({
      exported_at: new Date().toISOString(), user: { id: user.id, birth_year_band: user.ageBand, consent_version: 'v2.0' },
      taste_profile: { taste_vec: user.tasteVec, theta: user.theta, chronotype: user.chrono ?? null },
      reading_sessions: state.sessions, quiz_responses: state.quizLog, consent_ledger: this.ledger.entries.filter((e) => e.userId === user.id),
      note: '원시 생체 신호는 서버에 저장하지 않으므로 포함되지 않습니다.',
    }), { meanMs: 120 });
  },
};

export const util = { fmt, fnv1a };
