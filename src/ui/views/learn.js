// ⑤ AI 지식 증폭: RAG 챕터 요약(근거 인용·검증·게이트) · 책에게 묻기 · Bloom/IRT 적응형 퀴즈 · 지식 그래프
import { html, icon, when } from '../h.js';
import { state, render, run, save, toast } from '../ctx.js';
import { DEMO_TEXT, CONCEPTS } from '../../api/data.js';
import { Rag, Quiz, ragIndex, graph } from '../../api/services.js';
import { BLOOM, eap } from '../../core/irt.js';
import { graphSvg } from '../charts.js';

const TABS = [['summary', '요약'], ['ask', '묻기'], ['quiz', '퀴즈'], ['graph', '개념 지도']];
const cidx = (id) => ragIndex.chunks.findIndex((c) => c.id === id) + 1;

export function learnView() {
  const L = state.learn;
  return html`
  <section class="screen">
    <div class="row between"><span class="small muted">${DEMO_TEXT.bookTitle}</span><span class="pill outline xs">${icon('spark', 12, 2.2)} AI 생성물 표시</span></div>
    <h1 class="display">한 장 정리</h1>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button role="tab" aria-selected="${L.tab === k}" class="${L.tab === k ? 'on' : ''}" data-act="learn-tab" data-arg="${k}">${l}</button>`)}</div>
    ${when(L.tab !== 'graph', () => html`<div class="chips scroll">${DEMO_TEXT.chapters.map((c) => html`<button class="chip-btn ${L.chapter === c.id ? 'on' : ''}" data-act="learn-chapter" data-arg="${c.id}">${c.title.split('·')[0].trim()}</button>`)}</div>`)}
    ${L.tab === 'summary' ? summaryTab(L) : L.tab === 'ask' ? askTab(L) : L.tab === 'quiz' ? quizTab(L) : graphTab(L)}
  </section>`;
}

async function loadSummary(ch) {
  state.learn.summaries[ch] = { loading: true };
  render();
  const r = await run(() => Rag.summarizeChapter({ chapter: ch }));
  state.learn.summaries[ch] = r ?? { status: 'error' };
  render();
}
function summaryTab(L) {
  const s = L.summaries[L.chapter];
  if (!s) queueMicrotask(() => loadSummary(L.chapter));
  const ch = DEMO_TEXT.chapters.find((c) => c.id === L.chapter);
  if (!s || s.loading) return html`<div class="card skeleton" style="height:180px"></div>`;
  if (s.status !== 'ok') return html`<div class="card stack-8"><b>${s.status === 'fallback' ? '요약 엔진에 연결하지 못했어요' : '근거 부족'}</b><p class="small muted">${s.reason ?? '책 안에서 충분한 근거를 찾지 못해 요약을 만들지 않았어요.'}</p><button class="btn ghost sm" data-act="resummarize">다시 시도</button></div>`;
  return html`
    <section class="card stack-12">
      <div class="row between"><h2 class="h3">${ch.title}</h2><span class="small muted">근거 ${new Set(s.claims.map((c) => c.cite)).size}개 인용</span></div>
      <p class="serif summary">${s.claims.map((c) => html`${c.text} <button class="cite" data-act="show-evidence" data-arg="${c.cite}" aria-label="근거 ${cidx(c.cite)} 보기">[${cidx(c.cite)}]</button> `)}</p>
      ${when(L.evidence, () => { const c = ragIndex.byId.get(L.evidence); return c ? html`<blockquote class="evidence"><span class="small muted">근거 ${cidx(c.id)} · ${c.chapterTitle}</span><p>${c.text}</p></blockquote>` : ''; })}
      <details class="small"><summary>어떻게 만들었나요?</summary>
        <ol class="howto">
          <li>챕터를 문단 경계로 ${ragIndex.chunks.filter((c) => c.chapter === L.chapter).length}개 청크로 나눴어요 (오버랩 15%).</li>
          <li>BM25와 밀집 벡터 검색을 RRF로 합치고 재랭킹했어요.</li>
          <li>문장마다 근거 청크를 붙이고, 함의 점수 0.7 미만 문장은 지웠어요 (${s.claims.map((c) => c.entail.toFixed(2)).join(', ')}).</li>
          <li>${s.engine}</li>
        </ol>
      </details>
    </section>`;
}

const SUGGEST = ['별은 왜 오랫동안 빛나나요?', '초신성은 무엇을 흩뿌리나요?', '우리 몸의 원소는 어디서 왔나요?', '블랙홀은 어떻게 생기나요?'];
function askTab(L) {
  const qa = L.qa;
  return html`
    <section class="card stack-12">
      <h2 class="h3">책에게 묻기</h2>
      <form class="row gap-8" data-submit="ask"><label class="sr" for="ask-q">질문</label><input id="ask-q" class="input grow" placeholder="이 책에 대해 물어보세요" value="${qa.q}" data-input="ask-q"><button class="btn primary sm" ${qa.loading ? 'disabled' : ''}>묻기</button></form>
      <div class="chips wrap">${SUGGEST.map((s) => html`<button class="chip-btn" data-act="ask-suggest" data-arg="${s}">${s}</button>`)}</div>
      ${qa.loading ? html`<div class="skeleton" style="height:60px"></div>` : qa.res ? (qa.res.status === 'ok'
        ? html`<div class="answer"><p class="serif">${qa.res.text} <button class="cite" data-act="show-evidence" data-arg="${qa.res.cite}">[${cidx(qa.res.cite)}]</button></p><span class="small muted">본문 문장을 그대로 인용했어요 · 재랭킹 점수 ${qa.res.retrieval.top[0].score.toFixed(2)}</span></div>`
        : html`<div class="note">근거 부족 · ${qa.res.reason}. 책에 없는 내용은 지어내지 않아요.</div>`) : ''}
      ${when(L.evidence && L.tab === 'ask', () => { const c = ragIndex.byId.get(L.evidence); return html`<blockquote class="evidence"><span class="small muted">근거 ${cidx(c.id)} · ${c.chapterTitle}</span><p>${c.text}</p></blockquote>`; })}
    </section>`;
}

function quizTab(L) {
  const q = L.quiz;
  const est = q.responses.length ? eap(q.responses) : { theta: state.user.theta, se: state.user.se ?? 1 };
  if (!q.item && !q.loading) queueMicrotask(nextQ);
  const it = q.item;
  const due = dueConcepts();
  return html`
    ${when(due.length, () => html`<section class="card sage-card stack-8">
      <b class="h3">${icon('refresh', 16)} 오늘 복습할 개념 ${due.length}개</b>
      <div class="chips wrap">${due.map((c) => html`<button class="chip-btn ${q.focusConcept === c.id ? 'on' : ''}" data-act="quiz-focus" data-arg="${c.id}">${c.label}</button>`)}</div>
      <span class="small muted">SM-2 간격 반복 일정에 따라 오늘 다시 볼 차례인 개념이에요.</span>
    </section>`)}
    <section class="stack-12">
      <div class="row between small"><span class="pill sage xs">${it ? `${BLOOM[it.bloom]} · Bloom ${it.bloom + 1}단계` : '문항 고르는 중'}</span><span class="muted">θ ${est.theta.toFixed(2)} · SE ${est.se.toFixed(2)} · ${q.responses.length}문항 풂</span></div>
      ${it ? html`
        <h2 class="q">${it.q}</h2>
        <div class="stack-8">${shuffle(it).map((o) => {
          const picked = q.choice === o.i, answered = q.last && q.last.itemId === it.id;
          const cls = answered ? (o.i === it.answer ? 'right' : picked ? 'wrong' : '') : '';
          return html`<button class="opt ${cls}" data-act="quiz-answer" data-arg="${o.i}" ${answered ? 'disabled' : ''}><span class="key">${answered && o.i === it.answer ? icon('check', 14, 2.6) : answered && picked ? icon('x', 12, 2.6) : o.k}</span>${o.t}</button>`;
        })}</div>
        ${when(q.last && q.last.itemId === it.id, () => feedback(q.last, it))}
      ` : html`<div class="card skeleton" style="height:220px"></div>`}
    </section>`;
}
function shuffle(item) {
  const seed = [...item.id].reduce((s, ch) => s + ch.charCodeAt(0) * 7, 3);
  return item.options.map((t, i) => ({ t, i, r: Math.sin(seed * (i + 2)) })).sort((a, b) => a.r - b.r).map((x, j) => ({ ...x, k: 'ABCD'[j] }));
}
function feedback(last, it) {
  const chunk = ragIndex.chunks.find((c) => c.chapter === it.cite);
  return html`<div class="feedback ${last.correct ? 'ok' : 'warn'}" role="status">
    <b>${last.correct ? '맞아요. 이해도에 반영했어요.' : '조금 다르게 읽혔네요. 근거를 함께 다시 볼까요?'}</b>
    <span class="small">예상 정답 확률 ${Math.round(last.expectedP * 100)}% → θ ${last.est.theta.toFixed(2)} (SE ${last.est.se.toFixed(2)}) · 다음 복습 ${last.card.interval}일 뒤</span>
    ${when(!last.correct && last.prereq.length, () => html`<span class="small">먼저 볼 개념: ${last.prereq.join(', ')}</span>`)}
    ${when(!last.correct && chunk, () => html`<button class="link small left" data-act="show-evidence-quiz" data-arg="${chunk.id}">근거 [${cidx(chunk.id)}] 펼치기</button>`)}
    <button class="btn primary sm" data-act="quiz-next">다음 문항</button>
  </div>`;
}
async function nextQ() {
  const q = state.learn.quiz;
  q.loading = true;
  const est = q.responses.length ? eap(q.responses) : { theta: state.user.theta };
  let it = null;
  if (q.focusConcept) it = await run(() => Quiz.next({ theta: est.theta, used: q.responses.slice(-2).map((r) => r.item.id), concept: q.focusConcept }));
  if (!it) it = await run(() => Quiz.next({ theta: est.theta, used: q.responses.map((r) => r.item.id), chapter: state.learn.chapter }));
  if (!it) it = await run(() => Quiz.next({ theta: est.theta, used: q.responses.map((r) => r.item.id) }));
  if (!it) { q.responses = q.responses.slice(-3); it = await run(() => Quiz.next({ theta: est.theta, used: q.responses.map((r) => r.item.id) })); }
  q.item = it; q.choice = null; q.loading = false;
  render();
}

function graphTab(L) {
  const sel = L.graphSel ? graph.nodes.find((n) => n.id === L.graphSel) : null;
  const cdef = sel ? CONCEPTS.find((c) => c.id === sel.id) : null;
  return html`
    <section class="card stack-8">
      <div class="row between"><h2 class="h3">개념 지도</h2><span class="small muted">노드 ${graph.nodes.length} · 연결 ${graph.edges.length}</span></div>
      ${graphSvg({ nodes: graph.nodes, edges: graph.edges, mastery: L.mastery, sel: L.graphSel })}
      <div class="legend small"><span><i class="dot sage"></i>익숙함</span><span><i class="dot honey"></i>보통</span><span><i class="dot accent"></i>복습 필요</span><span><i class="dot empty"></i>아직 안 풂</span></div>
      ${sel ? html`<div class="stack-6"><b>${sel.label}</b><span class="small muted">${sel.count}번 등장 · ${sel.chapters.map((c) => DEMO_TEXT.chapters.find((x) => x.id === c).title.split('·')[0].trim()).join(', ')}</span>
        ${when(cdef.prereq.length, () => html`<span class="small">먼저 알면 좋은 개념: ${cdef.prereq.map((p) => CONCEPTS.find((c) => c.id === p).label).join(', ')}</span>`)}
        <span class="small">숙련도 ${L.mastery[sel.id] != null ? Math.round(L.mastery[sel.id] * 100) + '%' : '아직 없음'}${L.srs[sel.id] ? ` · 다음 복습 ${L.srs[sel.id].interval}일 뒤` : ''}</span></div>` : html`<p class="small muted">개념을 누르면 선수 개념과 복습 일정을 보여줘요.</p>`}
    </section>`;
}

// 복습 기한이 지난 개념 (오답 직후 1일 간격 → 데모에서는 오답 개념을 바로 복습 대상으로 보여준다)
export function dueConcepts() {
  const now = Date.now();
  return Object.entries(state.learn.srs)
    .filter(([, c]) => c.due != null && (c.due <= now || c.reps === 0))
    .map(([id]) => CONCEPTS.find((c) => c.id === id)).filter(Boolean);
}

export const learnActions = {
  'quiz-focus'(id) { const q = state.learn.quiz; q.focusConcept = q.focusConcept === id ? null : id; q.item = null; q.last = null; render(); },
  'go-review'() { state.learn.tab = 'quiz'; render(); },
  'learn-tab'(k) { state.learn.tab = k; state.learn.evidence = null; render(); },
  'learn-chapter'(c) { state.learn.chapter = c; state.learn.evidence = null; state.learn.quiz.item = null; state.learn.quiz.last = null; render(); },
  'show-evidence'(id) { state.learn.evidence = state.learn.evidence === id ? null : id; render(); },
  'show-evidence-quiz'(id) { state.learn.tab = 'summary'; state.learn.chapter = ragIndex.byId.get(id).chapter; state.learn.evidence = id; render(); },
  resummarize() { delete state.learn.summaries[state.learn.chapter]; render(); },
  'ask-suggest'(s) { state.learn.qa.q = s; learnActions.ask(); },
  async ask() {
    const qa = state.learn.qa;
    if (!qa.q.trim()) return;
    qa.loading = true; state.learn.evidence = null; render();
    qa.res = await run(() => Rag.ask({ question: qa.q }));
    qa.loading = false; render();
  },
  async 'quiz-answer'(i) {
    const q = state.learn.quiz, it = q.item;
    q.choice = +i;
    const r = await run(() => Quiz.submit({ user: state.user, item: it, choice: +i, responses: q.responses, srs: state.learn.srs }));
    if (!r) return;
    q.responses.push({ item: it, correct: r.correct });
    q.last = { itemId: it.id, ...r };
    state.learn.srs[it.concept] = { ...r.card, due: Date.now() + r.card.interval * 86400000 };
    if (q.focusConcept === it.concept && r.correct) q.focusConcept = null;
    const m = state.learn.mastery[it.concept];
    state.learn.mastery[it.concept] = +((m == null ? 0.5 : m) * 0.6 + (r.correct ? 1 : 0) * 0.4).toFixed(2);
    state.user.theta = r.est.theta; state.user.se = r.est.se;
    state.quizLog.push({ id: it.id, correct: r.correct, theta: r.est.theta, at: new Date().toISOString() });
    save(); render();
  },
  'quiz-next'() { state.learn.quiz.item = null; state.learn.quiz.last = null; render(); },
  'graph-sel'(id) { state.learn.graphSel = state.learn.graphSel === id ? null : id; render(); },
};
export const learnInputs = { 'ask-q'(v) { state.learn.qa.q = v; } };
export const learnSubmits = { ask: () => learnActions.ask() };
export { toast };
