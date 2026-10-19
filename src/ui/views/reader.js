// ② 홈(Context-Aware Feed) · 탐색 · ③ 도서 상세(딥 인스펙션 + GIS 대출)
import { html, icon, when, pct, won } from '../h.js';
import { state, render, go, run, save, toast } from '../ctx.js';
import { BOOKS, LIBRARIES, USER_LOC } from '../../api/data.js';
import { Reco, Library, Nlp, bookByIsbn, getAnalysis, Scheduler } from '../../api/services.js';
import { AXES, formatMinutes, analyze } from '../../core/nlp.js';
import { declaredCurve, readinessCurve, chronotype } from '../../core/scheduler.js';
import { radarSvg, mapSvg } from '../charts.js';
import { dueConcepts } from './learn.js';

export function nowReadiness() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const curve = state.bio && state.consents.bio ? readinessCurve({ rmssdZ: state.bio.rmssdZ, sleepEffZ: state.bio.sleepEffZ, msfsc: chronotype({ workdaySleep: state.bio.workdaySleep, freeSleep: state.bio.freeSleep }).msfsc }) : declaredCurve(state.declared);
  const p = curve.reduce((a, b) => (Math.abs(b.t - h) < Math.abs(a.t - h) ? b : a), curve[0]);
  return h < 6 ? 0.2 : p.r;
}
export const readinessLabel = (r) => (r >= 0.6 ? '집중하기 좋은 시간대(추정)' : r >= 0.4 ? '가볍게 읽기 좋은 시간대(추정)' : '쉬어 가도 좋은 시간대(추정)');

export const Cover = (b, size = 'md') => html`<div class="cover ${size}" style="--c:${b.cover};--ca:${b.accent}"><span class="cover-mark"></span><span class="cover-title">${b.title}</span></div>`;

async function loadFeed() {
  if (state.feedLoading) return;
  state.feedLoading = true; render();
  const r = await run(() => Reco.getFeed({ user: state.user, readinessNow: nowReadiness(), availableMin: state.availableMin ?? 30, locationGranted: state.consents.location }));
  state.feedLoading = false;
  if (r) { state.feed = r; state.homeLib = null; loadHomeLib(r.items[0]?.isbn); }
  render();
}
async function loadHomeLib(isbn) {
  if (!isbn || !state.consents.location) return;
  const r = await run(() => Library.findAvailability({ isbn }));
  if (r) { state.homeLib = { isbn, ...r }; render(); }
}

export function homeView() {
  if (!state.feed && !state.feedLoading) queueMicrotask(loadFeed);
  const r = nowReadiness();
  const f = state.feed;
  const mins = state.availableMin ?? 30;
  const cur = bookByIsbn(state.currentIsbn);
  const prog = state.progress[state.currentIsbn] ?? 0;
  return html`
  <section class="screen">
    <div class="row between wrap gap-8">
      <div class="row gap-6 medium">${icon('pin', 18)} ${state.consents.location ? USER_LOC.label.replace('전북 ', '전북 ').split(' ').slice(0, 2).join(' ') : '위치 꺼짐'}</div>
      <span class="pill ${r >= 0.6 ? 'sage' : r >= 0.4 ? 'honey' : 'muted'}">${icon(r >= 0.4 ? 'sun' : 'moon', 14, 2)} ${readinessLabel(r)}</span>
    </div>
    <h1 class="display">지금 ${mins}분 동안<br>읽기 좋은 책</h1>
    <div class="seg" role="group" aria-label="읽을 수 있는 시간">${[15, 30, 60].map((m) => html`<button class="${m === mins ? 'on' : ''}" data-act="set-min" data-arg="${m}" aria-pressed="${m === mins}">${m}분</button>`)}</div>
    ${when(f?.fallback, () => html`<p class="note">${f.fallback}</p>`)}
    ${state.feedLoading && !f ? html`<div class="card skeleton" style="height:230px"></div><div class="card skeleton" style="height:70px"></div>` : f ? feedList(f) : ''}
    ${when(cur && prog > 0, () => html`
      <button class="card row gap-12 continue" data-act="open-schedule">
        ${Cover(cur, 'xs')}<span class="stack-4 grow left"><b>이어 읽기 · ${cur.title}</b><span class="small muted">오늘 계획을 확인해요</span></span>${icon('play', 18)}
      </button>`)}
    ${when(dueConcepts().length, () => html`
      <button class="card row gap-12 continue" data-act="home-review">
        <span class="review-badge">${dueConcepts().length}</span><span class="stack-4 grow left"><b>오늘 복습할 개념</b><span class="small muted">${dueConcepts().map((c) => c.label).join(', ')}</span></span>${icon('play', 18)}
      </button>`)}
    ${when(state.consents.location, () => homeMap())}
  </section>`;
}

function feedList(f) {
  const [top, ...rest] = f.items;
  const lib = state.homeLib?.isbn === top.isbn ? state.homeLib.rows.find((x) => x.inv.status === 'available') : null;
  return html`
    <article class="card feature">
      <button class="feature-main" data-act="open-book" data-arg="${top.isbn}">
        ${Cover(top, 'lg')}
        <span class="stack-6 left">
          <span class="small muted">${top.genre}</span>
          <span class="title-lg">${top.title}</span>
          <span class="muted">${top.author}</span>
          <span class="meta">${icon('clock', 15, 2)} 예상 완료 ${formatMinutes(top.minutes)}</span>
          ${lib ? html`<span class="meta">${icon('book', 15, 2)} ${lib.lib.name} · <b class="ok">대출 가능 ${lib.inv.copies}권</b></span>` : state.consents.location ? html`<span class="meta muted">${icon('book', 15, 2)} 재고 확인 중…</span>` : ''}
        </span>
      </button>
      ${reasons(top)}
    </article>
    <div class="row between"><h2 class="h2">함께 추천</h2><button class="link small" data-act="refresh-feed">${icon('refresh', 14)} 다시 추천</button></div>
    <ul class="list">
      ${rest.map((b) => html`<li><button class="list-row" data-act="open-book" data-arg="${b.isbn}">${Cover(b, 'xs')}<span class="stack-4 grow left"><b>${b.title}</b><span class="small muted">${b.author} · ${formatMinutes(b.minutes)}</span><span class="small reason-inline">${b.reasons.map((x) => x.text).join(' · ')}</span></span></button></li>`)}
    </ul>
    <p class="small muted">추천 다양성(ILS) ${f.ils} · 낮을수록 서로 다른 결의 책이에요</p>`;
}

export function reasons(b) {
  const open = state.whyOpen === b.isbn;
  return html`
    <div class="reasons">
      <button class="pen-btn" data-act="toggle-why" data-arg="${b.isbn}" aria-expanded="${open}">왜 이 책?</button>
      ${b.reasons.map((r) => html`<span class="chip">${r.text}</span>`)}
    </div>
    ${when(open, () => html`<div class="why small">
      <p>추천 점수는 지금 맥락(${b.phi ? '시간대·준비도·읽을 시간·위치' : ''})과 이 책의 특징을 곱해 계산해요. 피처별 기여도:</p>
      <ul class="bars">${[['문체 유사', 1], ['난이도 적합', 2], ['분량 적합', 3], ['근처 대출', 4], ['시간대', 5], ['준비도', 6]].map(([l, i]) => html`<li><span>${l}</span><i style="width:${Math.round((b.phi?.[i] ?? 0) * 100)}%"></i><b class="num">${(b.phi?.[i] ?? 0).toFixed(2)}</b></li>`)}</ul>
      <p class="muted">Linear Thompson Sampling 점수 ${b.score?.toFixed(2)} · 기대값 ${b.expected?.toFixed(2)}</p>
    </div>`)}`;
}

function homeMap() {
  const hl = state.homeLib;
  const top = hl?.rows.find((x) => x.inv.status === 'available') ?? hl?.rows[0];
  return html`
    <div class="row between"><h2 class="h2">가까운 도서관</h2><span class="small muted">${hl ? (hl.invMeta.needsCheck ? '캐시 · 확인 필요' : '실시간 재고(데모)') : ''}</span></div>
    <div class="map-wrap">
      ${mapSvg({ user: USER_LOC, places: LIBRARIES.map((l) => ({ ...l, muted: hl && hl.rows.find((r) => r.lib.code === l.code)?.inv.status !== 'available' })), highlight: top?.lib.code, h: 170 })}
      ${when(top, () => html`<div class="map-tag"><b>${top.lib.name}</b><span class="muted">${(top.eta.meters / 1000).toFixed(1)}km · ${top.eta.minutes}분</span></div>`)}
    </div>`;
}

// ── 탐색 ──────────────────────────────────────────────────
const GENRES = ['전체', '소설', '과학', '역사', '고전', '철학', '에세이'];
export function exploreView() {
  const e = state.explore;
  const q = e.q.trim();
  const list = BOOKS.filter((b) => (e.genre === '전체' || b.genre.includes(e.genre)) && (!q || (b.title + b.author).includes(q)));
  return html`
  <section class="screen">
    <h1 class="display sm">탐색</h1>
    <label class="search">${icon('search', 18)}<input id="explore-q" type="search" placeholder="제목이나 저자" value="${e.q}" data-input="explore-q" aria-label="책 검색"></label>
    <div class="chips scroll">${GENRES.map((g) => html`<button class="chip-btn ${e.genre === g ? 'on' : ''}" data-act="explore-genre" data-arg="${g}">${g}</button>`)}</div>
    <ul class="list">
      ${list.length ? list.map((b) => {
        const a = getAnalysis(b.isbn);
        const gap = b.difficultyTheta - state.user.theta;
        const fit = Math.abs(gap) < 0.6 ? ['딱 맞는 난이도', 'sage'] : gap > 0 ? ['도전 난이도', 'honey'] : ['가볍게', 'muted'];
        return html`<li><button class="list-row" data-act="open-book" data-arg="${b.isbn}">${Cover(b, 'xs')}<span class="stack-4 grow left"><b>${b.title}</b><span class="small muted">${b.author} · ${b.genre}</span><span class="row gap-6"><span class="pill xs ${fit[1]}">${fit[0]}</span><span class="small muted">가독성 ${a.readability}</span></span></span></button></li>`;
      }) : html`<li class="empty">찾는 책이 없어요. 다른 검색어를 넣어 보세요.</li>`}
    </ul>
    <div class="card stack-12">
      <h2 class="h2">문장 난이도 분석기</h2>
      <p class="small muted">가지고 있는 전자책이나 글을 붙여 넣으면 6축 문체·난이도를 계산해요. 글은 이 기기에서만 분석해요.</p>
      <label class="sr" for="analyzer">분석할 글</label>
      <textarea id="analyzer" rows="5" placeholder="여기에 두세 문단을 붙여 넣어 보세요" data-input="explore-text">${e.text}</textarea>
      <button class="btn primary" data-act="analyze-text" ${e.text.trim().length < 20 ? 'disabled' : ''}>분석하기</button>
      ${when(e.analysis, () => analysisBlock(e.analysis))}
    </div>
  </section>`;
}
function analysisBlock(a) {
  return html`<div class="analysis">
    ${radarSvg(a.scores, AXES)}
    <div class="kv"><span>한국어 보정 LIX</span><b class="num">${a.lix}</b><span>인지 부하 CL</span><b class="num">${a.cl}</b><span>가독성</span><b class="num">${a.readability}</b><span>문장 수 / 어절 수</span><b class="num">${a.raw.sentences} / ${a.raw.words}</b></div>
    <p class="pen small">기준 코퍼스 대비 상대 위치예요. 절대 등급이 아니에요.</p>
  </div>`;
}

// ── 상세 ─────────────────────────────────────────────────
async function loadLib(isbn) {
  state.detail.libLoading = true; render();
  const r = await run(() => Library.findAvailability({ isbn }));
  state.detail.libLoading = false;
  if (r && state.detail.isbn === isbn) state.detail.lib = r;
  render();
}
export function detailView() {
  const d = state.detail;
  const b = bookByIsbn(d.isbn);
  if (!b) return html`<section class="screen"><p>책을 찾을 수 없어요.</p></section>`;
  const a = analyze(b.sample, { totalEojeol: b.totalEojeol, wpm: state.user.wpm });
  const feedItem = state.feed?.items.find((x) => x.isbn === b.isbn);
  if (!d.lib && !d.libLoading && state.consents.location) queueMicrotask(() => loadLib(b.isbn));
  const best = d.lib?.rows.find((r) => r.inv.status === 'available');
  return html`
  <section class="screen detail">
    <div class="detail-glow"></div>
    <div class="row between"><button class="icon-btn" data-act="back" aria-label="뒤로">${icon('back', 22, 2)}</button><button class="icon-btn" data-act="bookmark" data-arg="${b.isbn}" aria-label="책갈피에 담기">${icon('bookmark', 20)}</button></div>
    <div class="row gap-16 end">${Cover(b, 'xl')}<div class="stack-6"><span class="pill outline">${b.genre}</span><h1 class="display sm">${b.title}</h1><span class="muted">${b.author}</span><span class="small muted">${b.pages}쪽 · 예상 ${formatMinutes(a.minutes)} (내 속도 ${state.user.wpm}어절/분)</span></div></div>
    ${when(feedItem, () => html`<div class="card">${reasons(feedItem)}</div>`)}
    <section class="card stack-12">
      <div class="row between"><h2 class="h2">문체 · 난이도</h2><span class="small muted">LIX ${a.lix} · CL ${a.cl}</span></div>
      ${radarSvg(a.scores, AXES, 280)}
      <p class="pen small">기준 코퍼스 대비 상대 위치예요. 절대 등급이 아니에요.</p>
    </section>
    <section class="card dark stack-8">
      <div class="row between"><span class="small">1p 대표 문체 미리보기</span><span class="pill honey xs">프리미엄</span></div>
      <p class="serif quote">“${b.sample}”</p>
      <span class="small dim">데모 샘플 문장(원문 아님) · 스포일러 분류기 통과</span>
    </section>
    ${state.consents.location ? libSection(d, best) : html`<p class="note">위치 권한이 꺼져 있어 도서관 재고는 지도 없이 보여드릴 수 없어요. MY에서 켤 수 있어요.</p>`}
    <section class="card stack-8">
      <h2 class="h2">구매 참고 가격</h2>
      ${d.lib ? html`<div class="kv">${Object.entries(d.lib.prices).map(([k, v]) => html`<span>${k}</span><b class="num">${won(v)}</b>`)}</div><p class="small muted">제휴 API 참고 가격(데모)이에요. 실제 가격은 판매처에서 확인해 주세요.</p>` : html`<p class="small muted">가격을 불러오는 중이에요.</p>`}
    </section>
    <div class="action-bar">
      <button class="btn ghost" data-act="add-schedule" data-arg="${b.isbn}">스케줄 등록</button>
      <button class="btn primary" data-act="reserve" data-arg="${best?.lib.code ?? ''}" ${best || !state.consents.location ? '' : 'disabled'}>${d.reserved ? '예약 완료' : best ? '바로 대출 예약' : '대출 가능한 곳 없음'}</button>
    </div>
  </section>`;
}
function libSection(d, best) {
  if (d.libLoading && !d.lib) return html`<div class="card skeleton" style="height:180px"></div>`;
  if (!d.lib) return '';
  const L = d.lib;
  const st = { available: ['대출 가능', 'ok'], reservable: ['예약 가능', 'warn'], loaned: ['전량 대출 중', 'muted'] };
  return html`<section class="card stack-12">
    <div class="row between"><h2 class="h2">어디서 빌릴까</h2>${L.invMeta.needsCheck ? html`<span class="pill honey xs">확인 필요</span>` : html`<span class="small muted">k-ring ${L.k}단계 탐색</span>`}</div>
    ${when(L.degraded, () => html`<p class="note">${L.degraded}: ${L.invMeta.needsCheck ? '최근 재고 기록으로 보여드려요.' : ''} 이동시간은 ${L.etaSource}</p>`)}
    ${mapSvg({ user: USER_LOC, places: L.rows.map((r) => ({ ...r.lib, muted: r.inv.status !== 'available' })), highlight: best?.lib.code, h: 160 })}
    <ul class="lib-list">${L.rows.slice(0, 5).map((r) => html`<li>
      <span class="stack-4 grow"><b>${r.lib.name}</b><span class="small muted">${(r.eta.meters / 1000).toFixed(1)}km · ${r.eta.minutes}분${r.lib.closedDays?.includes(new Date().getDay()) ? ' · 오늘 휴관' : r.penalty ? ' · 도착 시 운영시간 확인' : ''}</span></span>
      <span class="stack-4 right"><span class="status ${st[r.inv.status][1]}">${st[r.inv.status][0]}${r.inv.status === 'available' ? ` ${r.inv.copies}권` : ''}</span><span class="small muted">가능확률 ${pct(r.p)}</span></span>
    </li>`)}</ul>
    ${when(L.lola.length, () => html`<div class="stack-8"><b class="small">상호대출로 받기</b>${L.lola.map((o) => html`<div class="row between small"><span>${o.pickup.name}에서 수령</span><span class="muted">약 ${Math.round(o.totalHours / 24)}일</span></div>`)}</div>`)}
    ${when(d.reserved, () => html`<p class="ok-note">${icon('check', 16, 2.4)} ${d.reserved.lib} 예약 완료 · ${d.reserved.pickupBy}까지 찾아가세요</p>`)}
  </section>`;
}

export const readerActions = {
  'set-min'(m) { state.availableMin = +m; state.feed = null; render(); },
  'refresh-feed'() { state.feed = null; render(); },
  'toggle-why'(isbn) { state.whyOpen = state.whyOpen === isbn ? null : isbn; render(); },
  'open-book'(isbn) {
    const item = state.feed?.items.find((x) => x.isbn === isbn);
    if (item) Reco.feedback({ user: state.user, isbn, context: state.feed.context, click: true });
    go('detail', { detail: { isbn, lib: null, libLoading: false, reserved: null }, openedAt: Date.now() });
  },
  back() {
    if (state.route === 'detail') leaveDetail();
    go(state.prevRoute && state.prevRoute !== 'detail' ? state.prevRoute : 'home');
  },
  bookmark() { toast('책갈피에 담았어요'); },
  async reserve(code) {
    const d = state.detail;
    if (!code) return;
    const r = Library.reserve({ user: state.user, isbn: d.isbn, libCode: code });
    d.reserved = { lib: LIBRARIES.find((l) => l.code === code).name, pickupBy: r.pickupBy };
    if (state.feed) Reco.feedback({ user: state.user, isbn: d.isbn, context: state.feed.context, reserved: true, dwellMs: Date.now() - (state.openedAt ?? Date.now()) });
    save(); toast('대출 예약을 넣었어요 (데모)'); render();
  },
  'add-schedule'(isbn) {
    state.currentIsbn = isbn; state.plan = null;
    if (state.feed) Reco.feedback({ user: state.user, isbn, context: state.feed.context, started: true });
    leaveDetail(); go('schedule');
  },
  'open-schedule'() { go('schedule'); },
  'home-review'() { state.learn.tab = 'quiz'; state.learn.quiz.focusConcept = dueConcepts()[0]?.id ?? null; state.learn.quiz.item = null; state.learn.quiz.last = null; go('learn'); },
  'explore-genre'(g) { state.explore.genre = g; render(); },
  async 'analyze-text'() { const r = await run(() => Nlp.analyze({ text: state.explore.text })); if (r) { state.explore.analysis = r; render(); } },
};
export const readerInputs = {
  'explore-q'(v) { state.explore.q = v; render(); },
  'explore-text'(v) { const was = state.explore.text.trim().length >= 20; state.explore.text = v; if (was !== v.trim().length >= 20) render(); },
};
function leaveDetail() {
  const dwell = Date.now() - (state.openedAt ?? Date.now());
  if (state.feed && dwell > 30000 && !state.detail.reserved) Reco.feedback({ user: state.user, isbn: state.detail.isbn, context: state.feed.context, dwellMs: dwell });
  save();
}
export { Scheduler };
