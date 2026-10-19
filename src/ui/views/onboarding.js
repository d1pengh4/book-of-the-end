// ① 퀀트 온보딩: 문체 카드 → CAT 문해력(7~12문항) → 목적별 동의(필수/선택 분리)
import { html, icon, when, raw } from '../h.js';
import { state, render, go, run, save, toast } from '../ctx.js';
import { STYLE_CARDS, STYLE_AXES } from '../../api/data.js';
import { Onboarding, Privacy } from '../../api/services.js';

const GENRES = ['소설', '과학', '역사', '에세이', '철학', '고전'];

export function onboardingView() {
  const o = state.onboarding;
  return html`
  <section class="screen onb">
    <header class="row between">
      <div class="brand">Book of the End</div>
      <div class="muted small">${o.step} / 3 · ${['문체 취향', '읽기 수준', '동의와 연결'][o.step - 1]}</div>
    </header>
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${o.step}"><i style="width:${(o.step / 3) * 100}%"></i></div>
    ${o.step === 1 ? stepStyle(o) : o.step === 2 ? stepCat(o) : stepConsent()}
  </section>`;
}

function stepStyle(o) {
  if (o.genreMode) return html`
    <h1 class="display">어떤 분야를<br>좋아하세요?</h1>
    <p class="muted">문장 카드 대신 장르로 고를 수 있어요. 두 개 이상 골라 주세요.</p>
    <div class="chips wrap">${GENRES.map((g) => html`<button class="chip-btn ${o.genres.includes(g) ? 'on' : ''}" data-act="onb-genre" data-arg="${g}" aria-pressed="${o.genres.includes(g)}">${g}</button>`)}</div>
    <div class="grow"></div>
    <div class="stack-8">
      <button class="btn primary" data-act="onb-next1" ${o.genres.length < 2 ? 'disabled' : ''}>다음</button>
      <button class="btn ghost" data-act="onb-genre-mode">문장으로 고를래요</button>
    </div>`;
  const cards = STYLE_CARDS.slice(o.page * 6, o.page * 6 + 6).map((c, k) => ({ ...c, i: o.page * 6 + k }));
  const taste = Onboarding.tasteFromCards(o.picked);
  return html`
    <h1 class="display">마음이 머무는<br>문장을 골라주세요</h1>
    <p class="muted">고른 문장의 결로 첫 추천을 맞춰요. <span class="pen">정답은 없어요</span></p>
    <div class="grid-2">
      ${cards.map((c) => html`
        <button class="style-card ${o.picked.includes(c.i) ? 'on' : ''}" data-act="onb-pick" data-arg="${c.i}" aria-pressed="${o.picked.includes(c.i)}">
          <span class="serif">${c.text}</span>
          <span class="row between"><span class="tag">${c.tag}</span>${o.picked.includes(c.i) ? html`<span class="tick">${icon('check', 14, 2.4)}</span>` : html`<span class="ring"></span>`}</span>
        </button>`)}
    </div>
    ${when(o.picked.length, () => html`<div class="taste-bars" aria-label="지금까지의 취향 벡터">${STYLE_AXES.map((a, j) => html`<div><span>${a}</span><b style="height:${Math.round(taste[j] * 100)}%"></b></div>`)}</div>`)}
    <div class="grow"></div>
    <div class="row between small muted"><span>${o.picked.length}개 선택 · 12장 중 ${o.page * 6 + 1}–${o.page * 6 + 6}</span><button class="link" data-act="onb-genre-mode">장르로 고를래요</button></div>
    <div class="row gap-8">
      ${o.page === 0 ? html`<button class="btn primary grow" data-act="onb-page">다음 문장 보기</button>` : html`<button class="btn ghost" data-act="onb-page-back">이전</button><button class="btn primary grow" data-act="onb-next1" ${o.picked.length < 3 ? 'disabled' : ''}>${o.picked.length < 3 ? `${3 - o.picked.length}개 더 골라 주세요` : '취향 저장하고 계속'}</button>`}
    </div>`;
}

function stepCat(o) {
  const c = o.cat;
  if (c.done) return html`
    <h1 class="display">읽기 수준을<br>맞춰 두었어요</h1>
    <div class="card stack-12">
      <div class="row between"><span class="muted">추정 능력 θ</span><b class="num big">${c.est.theta.toFixed(2)}</b></div>
      <div class="meter"><i style="left:${((c.est.theta + 3) / 6) * 100}%"></i></div>
      <div class="row between small muted"><span>쉬운 책</span><span>표준오차 ${c.est.se.toFixed(2)} · ${c.responses.length}문항</span><span>어려운 책</span></div>
      <p class="small muted">이 값은 시험 점수가 아니에요. 첫 추천의 난이도 범위를 정하는 데만 쓰고, 읽을수록 다시 맞춰져요.</p>
    </div>
    <div class="grow"></div>
    <button class="btn primary" data-act="onb-next2">다음</button>`;
  if (!c.item) return html`<h1 class="display">읽기 수준 확인</h1><p class="muted">7~12문항이면 끝나요. 모르면 건너뛰어도 괜찮아요.</p><div class="grow"></div><button class="btn primary" data-act="onb-cat-start">시작하기</button><button class="btn ghost" data-act="onb-cat-skip">건너뛰기</button>`;
  const opts = shuffledOptions(c.item);
  return html`
    <div class="row between small muted"><span>문항 ${c.responses.length + 1}</span><span>θ ${c.est.theta.toFixed(2)} · SE ${c.est.se.toFixed(2)}</span></div>
    <h2 class="q">${c.item.q}</h2>
    <div class="stack-8">${opts.map((o2) => html`<button class="opt" data-act="onb-cat-answer" data-arg="${o2.i}"><span class="key">${o2.k}</span>${o2.t}</button>`)}</div>
    <div class="grow"></div>
    <button class="btn ghost" data-act="onb-cat-answer" data-arg="-1">잘 모르겠어요</button>`;
}
// 보기 순서를 문항별로 고정 섞기
function shuffledOptions(item) {
  const seed = [...item.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return item.options.map((t, i) => ({ t, i, r: Math.sin(seed * (i + 1)) })).sort((a, b) => a.r - b.r).map((x, j) => ({ ...x, k: 'ABCD'[j] }));
}

const CONSENTS = [
  { key: 'analytics', title: '서비스 이용 기록', desc: '추천 품질을 높이는 데 써요. (필수)', required: true },
  { key: 'location', title: '위치', desc: '가까운 도서관 재고를 보여줘요. 끄면 시간대·최근 독서만 써요.' },
  { key: 'libraryLink', title: '도서관 대출 이력 연결', desc: '정보나루 OAuth(데모). 비식별 요약만 받아요.' },
  { key: 'bio', title: '수면·심박변이(HRV) 요약', desc: '기기 안에서 요약한 값만 써요. 원시 신호는 저장하지 않아요.' },
  { key: 'gaze', title: '시선 추적 몰입 모드', desc: '연구 단계 기능이라 지금은 켤 수 없어요.', disabled: true },
];
function stepConsent() {
  return html`
    <h1 class="display">무엇을 연결할지<br>직접 정해요</h1>
    <p class="muted">선택 항목은 언제든 MY에서 바꾸거나 철회할 수 있어요.</p>
    <div class="stack-8">${CONSENTS.map((c) => html`
      <label class="consent ${c.disabled ? 'disabled' : ''}" for="cs-${c.key}">
        <span class="stack-4"><b>${c.title}${c.required ? html` <span class="badge">필수</span>` : c.disabled ? html` <span class="badge muted">R&amp;D</span>` : ''}</b><span class="small muted">${c.desc}</span></span>
        <input type="checkbox" id="cs-${c.key}" class="switch" data-act="onb-consent" data-arg="${c.key}" ${state.consents[c.key] ? 'checked' : ''} ${c.required || c.disabled ? 'disabled' : ''}>
      </label>`)}
    </div>
    <div class="row gap-8 small muted">${icon('info', 16)}<span>만 14세 미만이면 생체·위치 기능은 기본으로 꺼지고 보호자 동의가 필요해요.</span></div>
    <div class="grow"></div>
    <button class="btn primary" data-act="onb-finish">첫 추천 받기</button>`;
}

export const onboardingActions = {
  'onb-pick'(i) { const p = state.onboarding.picked; const n = +i; state.onboarding.picked = p.includes(n) ? p.filter((x) => x !== n) : [...p, n]; render(); },
  'onb-page'() { state.onboarding.page = 1; render(); },
  'onb-page-back'() { state.onboarding.page = 0; render(); },
  'onb-genre-mode'() { state.onboarding.genreMode = !state.onboarding.genreMode; render(); },
  'onb-genre'(g) { const s = state.onboarding.genres; state.onboarding.genres = s.includes(g) ? s.filter((x) => x !== g) : [...s, g]; render(); },
  'onb-next1'() {
    const o = state.onboarding;
    state.user.tasteVec = o.genreMode ? Onboarding.tasteFromGenres(o.genres) : Onboarding.tasteFromCards(o.picked);
    o.step = 2; render();
  },
  async 'onb-cat-start'() { const r = await run(() => Onboarding.catNext([])); if (r) { Object.assign(state.onboarding.cat, r); render(); } },
  'onb-cat-skip'() { Object.assign(state.onboarding.cat, { done: true, est: { theta: 0, se: 1 } }); render(); }, // 이탈 시 θ=0 사전분포
  async 'onb-cat-answer'(i) {
    const c = state.onboarding.cat;
    c.responses.push({ item: c.item, correct: +i === c.item.answer });
    const r = await run(() => Onboarding.catNext(c.responses));
    if (r) Object.assign(c, r);
    render();
  },
  'onb-next2'() { Object.assign(state.user, { theta: state.onboarding.cat.est.theta, se: state.onboarding.cat.est.se }); state.onboarding.step = 3; render(); },
  'onb-consent'(key, el) { state.consents[key] = el.checked; },
  async 'onb-finish'() {
    for (const [k, v] of Object.entries(state.consents)) await run(() => Privacy.update({ user: state.user, purpose: k, scope: k, grant: v }));
    state.user.onboarded = true;
    save();
    toast('취향과 읽기 수준을 저장했어요');
    go('home', { feed: null });
  },
};
export const _raw = raw;
