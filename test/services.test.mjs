import test from 'node:test';
import assert from 'node:assert/strict';
import { Onboarding, Reco, Library, Scheduler, Rag, Quiz, Classroom, Demand, Privacy, HealthKit, gw, bookByIsbn, graph } from '../src/api/services.js';
import { USER_LOC } from '../src/api/data.js';

const user = { id: 'demo-user', tasteVec: Onboarding.tasteFromCards([0, 3, 4]), theta: 0.2, loc: USER_LOC, wpm: 180 };

test('E2E: 온보딩→추천→대출→스케줄→요약→퀴즈', async () => {
  let resp = [], r;
  do { r = await Onboarding.catNext(resp); if (r.item) resp.push({ item: r.item, correct: resp.length % 3 !== 2 }); } while (!r.done);
  assert.ok(resp.length >= 7 && resp.length <= 12);
  const feed = await Reco.getFeed({ user, date: new Date('2026-10-19T08:00:00'), readinessNow: 0.7 });
  assert.equal(feed.items.length, 5);
  assert.ok(feed.items[0].reasons.length > 0);
  const rw = Reco.feedback({ user, isbn: feed.items[0].isbn, context: feed.context, click: true, dwellMs: 40000, reserved: true });
  assert.equal(rw, 1);
  const lib = await Library.findAvailability({ isbn: '9788983711892', now: new Date('2026-10-19T10:00:00') });
  assert.equal(lib.rows[0].lib.name, '삼례도서관');
  const bio = await HealthKit.connect();
  const plan = await Scheduler.plan({ user, book: bookByIsbn('9788983711892'), bio: bio.ok ? bio : null });
  assert.equal(plan.slots.length, 3);
  assert.ok(plan.plan.some((p) => p.chunks.length));
  const s = await Rag.summarizeChapter({ chapter: 'ch3' });
  assert.ok(['ok', 'fallback'].includes(s.status), s.reason);
  const a = await Rag.ask({ question: '초신성은 무엇을 흩뿌리나요?' });
  assert.equal(a.status, 'ok');
  const it = await Quiz.next({ theta: 0, used: [] });
  const sub = await Quiz.submit({ user, item: it, choice: 1, responses: [] });
  assert.equal(sub.correct, false);
  assert.ok(graph.nodes.length >= 6 && graph.edges.length >= 5);
});

test('B2B·B2G·프라이버시', async () => {
  const c = await Classroom.cohort({});
  assert.ok(c.k >= 3 && c.rows.some((r) => r.flagged));
  assert.equal(c.bioIndividual.allow, false);
  const small = await Classroom.cohort({ classId: 'tiny' });
  assert.ok(small.denied);
  const m = await Classroom.generateMaterials({ standard: '[9과13-02]' });
  assert.ok(m.items.length && m.topics.length);
  const f = await Demand.forecast({ region: '삼례읍', keyword: '과학 교양' });
  assert.equal(f.band.length, 6);
  const p = Demand.purchase({ budget: 300000, minPerCategory: { 문학: 2 } });
  assert.ok(p.spent <= 300000);
  assert.ok(Demand.route().route.length > 2);
  assert.ok(Demand.literacyIndex().some((g) => g.suppressed));
  await Privacy.update({ user, purpose: 'bio', scope: 'sleep', grant: true });
  assert.ok(Privacy.ledger.verify());
  assert.ok(gw.sloReport().length > 5);
  assert.ok(gw.bus.log.length > 3);
});
