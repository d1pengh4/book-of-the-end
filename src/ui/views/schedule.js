// ④ 바이오 딥 스케줄링 & 실행: 준비도 곡선, 슬롯 추천, 청크 계획, 집중 모드 세션
import { html, icon, when } from '../h.js';
import { state, render, go, run, save, toast } from '../ctx.js';
import { BOOKS } from '../../api/data.js';
import { Scheduler, HealthKit, Privacy, bookByIsbn, bookChunks } from '../../api/services.js';
import { curveSvg, sparkline } from '../charts.js';
import { Cover } from './reader.js';
import { formatMinutes } from '../../core/nlp.js';

async function loadPlan() {
  if (state.planLoading) return;
  state.planLoading = true;
  const book = bookByIsbn(state.currentIsbn);
  const r = await run(() => Scheduler.plan({ user: state.user, book, bio: state.consents.bio ? state.bio : null, declared: state.declared, progressChunk: state.progress[book.isbn] ?? 0 }));
  state.planLoading = false;
  if (r) state.plan = { isbn: book.isbn, ...r };
  render();
}

export function scheduleView() {
  const book = bookByIsbn(state.currentIsbn);
  if (state.reading) return readingView(book);
  if ((!state.plan || state.plan.isbn !== book.isbn) && !state.planLoading) queueMicrotask(loadPlan);
  const p = state.plan;
  const total = bookChunks(book).length, done = state.progress[book.isbn] ?? 0;
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return html`
  <section class="screen">
    <h1 class="display">오늘의 독서</h1>
    <div class="row gap-12">${Cover(book, 'xs')}<div class="stack-4 grow"><b>${book.title}</b><span class="small muted">${done}/${total} 청크 · 남은 분량 약 ${p ? p.remainLabel : '…'}</span><div class="bar"><i style="width:${(done / total) * 100}%"></i></div></div>
      <label class="sr" for="book-pick">읽을 책 바꾸기</label>
      <select id="book-pick" class="mini-select" data-change="pick-book">${BOOKS.map((b) => html`<option value="${b.isbn}" ${b.isbn === book.isbn ? 'selected' : ''}>${b.title}</option>`)}</select>
    </div>
    <section class="card stack-8">
      <div class="row between"><h2 class="h3">집중하기 좋은 시간대(추정)</h2><span class="small muted">${p?.mode === 'bio' ? `수면·HRV 요약 · ${p.chrono.label}` : '내가 정한 선호 시간'}</span></div>
      ${p ? curveSvg(p.curve, p.slots, h) : html`<div class="skeleton" style="height:130px"></div>`}
      ${when(p?.mode === 'declared', () => html`<div class="row gap-8 wrap small"><span class="muted">선호 시간</span>${state.declared.map((t, i) => html`<label class="sr" for="pref-${i}">선호 시간 ${i + 1}</label><input id="pref-${i}" type="time" value="${t}" data-change="declared" data-arg="${i}" class="time">`)}</div>`)}
    </section>
    <section class="stack-8">
      <div class="row between"><h2 class="h2">나눠 읽기 계획</h2><span class="pen">챕터 경계에서 끊어요</span></div>
      ${p ? p.plan.map((s, i) => html`
        <div class="slot">
          <div class="slot-time ${i === 0 ? 'strong' : ''}">${s.start}</div>
          <div class="slot-body ${i === 0 ? 'dark' : ''}">
            <div class="stack-4 grow">
              <b>${s.chunks.length ? chunkLabel(s.chunks) : '쉬어 가기'}</b>
              <span class="small ${i === 0 ? 'dim' : 'muted'}">${s.minutes}분 · ${s.label} 슬롯 · 준비도 ${Math.round(s.readiness * 100)}${s.chunks.length && !s.endsAtBoundary ? ' · 챕터 중간' : ''}</span>
            </div>
            ${when(s.chunks.length, () => html`<button class="btn sm ${i === 0 ? 'primary' : 'ghost'}" data-act="start-session" data-arg="${i}">시작</button>`)}
          </div>
        </div>`) : html`<div class="skeleton" style="height:180px"></div>`}
    </section>
    ${bioCard()}
    <p class="small muted">이 기능은 독서 습관을 돕기 위한 추정이에요. 건강 상태를 진단하지 않아요.</p>
    ${when(state.sessions.length, () => html`<section class="card stack-8"><h2 class="h3">최근 세션</h2>${state.sessions.slice(-4).reverse().map((s) => html`<div class="row between small"><span>${s.title} · ${s.chunks}</span><span class="muted">${s.minutes}분 · ${s.wpm}어절/분</span></div>`)}</section>`)}
  </section>`;
}
const chunkLabel = (cs) => {
  const a = cs[0], b = cs.at(-1);
  if (a.chapter === b.chapter) return `${a.chapter}장 ${a.parts > 1 ? (a.part === 1 && b.part === b.parts ? '전체' : `${a.part}${b.part !== a.part ? `–${b.part}` : ''}/${a.parts} 부분`) : '전체'}`;
  return `${a.chapter}장 ${a.part > 1 ? `${a.part}부분` : ''} → ${b.chapter}장 ${b.part === b.parts ? '끝까지' : `${b.part}/${b.parts}`}`;
};

function bioCard() {
  if (state.consents.bio && state.bio) {
    return html`<section class="card stack-8">
      <div class="row between"><h2 class="h3">${icon('moon', 18)} 수면·HRV 요약 (7일)</h2><button class="link small" data-act="bio-disconnect">연결 끊기</button></div>
      <div class="row between small"><span>수면 효율</span>${sparkline(state.bio.days.map((d) => d.sleepEff))}<b class="num">${Math.round(state.bio.days.at(-1).sleepEff * 100)}%</b></div>
      <div class="row between small"><span>RMSSD</span>${sparkline(state.bio.days.map((d) => d.rmssd))}<b class="num">${state.bio.days.at(-1).rmssd}ms</b></div>
      <p class="small muted">기기에서 요약한 값만 받아요(HealthKit 데모). 원시 신호는 저장하지 않아요.</p>
    </section>`;
  }
  return html`<section class="card sage-card stack-8">
    <div class="row gap-8 start">${icon('moon', 22)}<p class="m0">수면 데이터를 연결하면 추천 시간대가 정교해져요.</p></div>
    <div class="row gap-8 end-j"><button class="btn sm ghost-sage" data-act="bio-later">나중에</button><button class="btn sm sage" data-act="bio-connect">연결하기</button></div>
  </section>`;
}

function readingView(book) {
  const r = state.reading;
  return html`
  <section class="screen reading" style="--read-size:${r.fontSize}px">
    <div class="row between"><button class="icon-btn" data-act="end-session-cancel" aria-label="세션 취소">${icon('x', 22, 2)}</button><span class="pill sage">${icon('clock', 14, 2)} 집중 모드</span></div>
    <div class="stack-6 center"><span class="muted">${book.title}</span><h1 class="display">${chunkLabel(r.chunks)}</h1><span class="small muted">목표 ${r.targetMin}분 · 약 ${r.chunks.reduce((s, c) => s + c.eojeol, 0).toLocaleString()}어절</span></div>
    <div class="timer" id="timer" aria-live="off">00:00</div>
    <div class="card stack-8">
      <label for="font-size" class="row between small"><span>글자 크기</span><b class="num">${r.fontSize}px</b></label>
      <input id="font-size" type="range" min="15" max="24" value="${r.fontSize}" data-input="font-size">
      <p class="read-sample serif">${book.sample}</p>
      <p class="small muted">집중이 흐려지면 글자 크기와 자간을 천천히 키워요. 시선 추적은 연구 단계라 꺼져 있고, 스크롤·터치로만 추정해요.</p>
    </div>
    <div class="grow"></div>
    ${r.ending ? html`<div class="card stack-12">
      <label for="pages-read"><b>몇 쪽 읽었나요?</b></label>
      <input id="pages-read" type="number" min="0" max="200" value="${r.pages}" data-input="pages-read" class="input">
      <div class="row gap-8"><button class="btn ghost" data-act="end-session-back">계속 읽기</button><button class="btn primary grow" data-act="end-session-save">기록하고 마치기</button></div>
    </div>` : html`<button class="btn primary" data-act="end-session">읽기 마치기</button>`}
  </section>`;
}

export const scheduleActions = {
  async 'bio-connect'() {
    const r = await run(() => HealthKit.connect());
    if (!r?.ok) { toast(r?.reason ?? '연결하지 못했어요. 선호 시간으로 계속할게요', 'error'); return; }
    state.bio = r; state.consents.bio = true;
    await run(() => Privacy.update({ user: state.user, purpose: 'bio', scope: 'sleep,hrv', grant: true }));
    state.plan = null; save(); toast('수면·HRV 요약을 연결했어요 (데모)'); render();
  },
  async 'bio-disconnect'() { state.consents.bio = false; await run(() => Privacy.update({ user: state.user, purpose: 'bio', scope: 'sleep,hrv', grant: false })); state.plan = null; save(); render(); },
  'bio-later'() { toast('선호 시간으로 계획할게요'); },
  'start-session'(i) {
    const s = state.plan.plan[+i];
    state.reading = { slot: +i, chunks: s.chunks, startedAt: Date.now(), targetMin: s.minutes, fontSize: 17, pages: Math.max(1, Math.round(s.chunks.reduce((a, c) => a + c.eojeol, 0) / 160)), ending: false };
    render();
  },
  'end-session'() { state.reading.ending = true; render(); },
  'end-session-back'() { state.reading.ending = false; render(); },
  'end-session-cancel'() { state.reading = null; render(); },
  'end-session-save'() {
    const r = state.reading, book = bookByIsbn(state.currentIsbn);
    const minutes = Math.max(1, Math.round((Date.now() - r.startedAt) / 60000));
    const demoMinutes = minutes < 3 ? r.targetMin : minutes; // 데모: 바로 끝내면 목표 시간을 읽은 것으로 기록
    const { wpm } = Scheduler.logSession({ user: state.user, isbn: book.isbn, minutes: demoMinutes, pages: r.pages, chunkIds: r.chunks.map((c) => c.id) });
    state.user.wpm = Math.round(0.7 * state.user.wpm + 0.3 * Math.min(400, Math.max(80, wpm)));
    state.progress[book.isbn] = (state.progress[book.isbn] ?? 0) + r.chunks.length;
    state.sessions.push({ isbn: book.isbn, title: book.title, chunks: chunkLabel(r.chunks), minutes: demoMinutes, pages: r.pages, wpm, at: new Date().toISOString() });
    state.reading = null; state.plan = null; save();
    toast(`${demoMinutes}분 읽었어요. 읽기 속도를 ${state.user.wpm}어절/분으로 맞췄어요`);
    render();
  },
};
export const scheduleInputs = {
  'font-size'(v) { state.reading.fontSize = +v; document.querySelector('.reading')?.style.setProperty('--read-size', `${v}px`); const b = document.querySelector('label[for=font-size] b'); if (b) b.textContent = `${v}px`; },
  'pages-read'(v) { state.reading.pages = Math.max(0, +v || 0); },
};
export const scheduleChanges = {
  'pick-book'(v) { state.currentIsbn = v; state.plan = null; save(); render(); },
  declared(v, el) { state.declared[+el.dataset.arg] = v; state.plan = null; save(); render(); },
};
export { formatMinutes, go };
