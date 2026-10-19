// MY · 05 데이터 오너십: 프로필, 동의 원장(해시체인), 내보내기, 삭제
import { html, icon, when } from '../h.js';
import { state, render, run, save, toast, go } from '../ctx.js';
import { STYLE_AXES } from '../../api/data.js';
import { Privacy } from '../../api/services.js';
import { wipe } from '../store.js';

const PURPOSES = [
  ['location', '위치', '가까운 도서관 재고'],
  ['libraryLink', '도서관 대출 이력', '정보나루 OAuth(데모)'],
  ['bio', '수면·HRV 요약', '독서 시간대 추천'],
  ['personalization', '맞춤 추천', '문체·난이도 학습'],
  ['gaze', '시선 추적', '연구 단계 · 사용할 수 없음'],
];

export function myView() {
  const u = state.user;
  const mins = state.sessions.reduce((s, x) => s + x.minutes, 0);
  const correct = state.quizLog.filter((q) => q.correct).length;
  const ledger = Privacy.ledger.entries.filter((e) => e.userId === u.id);
  return html`
  <section class="screen">
    <h1 class="display">내 서재 기록</h1>
    <div class="stat-row">
      <div class="stat"><span class="small muted">읽은 시간</span><b class="num">${mins}분</b></div>
      <div class="stat"><span class="small muted">세션</span><b class="num">${state.sessions.length}회</b></div>
      <div class="stat"><span class="small muted">퀴즈 정답</span><b class="num">${correct}/${state.quizLog.length}</b></div>
    </div>
    ${weekly()}
    <section class="card stack-12">
      <h2 class="h3">나에 대해 앱이 아는 것</h2>
      <div class="kv"><span>읽기 능력 θ</span><b class="num">${(u.theta ?? 0).toFixed(2)} ± ${(u.se ?? 1).toFixed(2)}</b><span>읽기 속도</span><b class="num">${u.wpm}어절/분</b><span>연령대</span><b>${u.ageBand}</b></div>
      ${when(u.tasteVec, () => html`<div class="taste-bars wide" aria-label="문체 취향">${STYLE_AXES.map((a, j) => html`<div><span>${a}</span><b style="height:${Math.round(u.tasteVec[j] * 100)}%"></b></div>`)}</div>`)}
      <button class="link small left" data-act="redo-onboarding">취향 다시 맞추기</button>
    </section>
    <section class="card stack-8">
      <h2 class="h3">${icon('shield', 18)} 동의 관리</h2>
      ${PURPOSES.map(([k, t, d]) => html`<label class="consent" for="my-${k}"><span class="stack-4"><b>${t}</b><span class="small muted">${d}</span></span><input type="checkbox" class="switch" id="my-${k}" data-act="my-consent" data-arg="${k}" ${state.consents[k] ? 'checked' : ''} ${k === 'gaze' ? 'disabled' : ''}></label>`)}
      <p class="small muted">선택 동의를 철회하면 관련 파생 데이터는 30일 안에 지워요.</p>
    </section>
    <section class="card stack-8">
      <div class="row between"><h2 class="h3">동의 이력</h2><button class="link small" data-act="verify-ledger">무결성 확인</button></div>
      ${when(state.ledgerOk != null, () => html`<p class="${state.ledgerOk ? 'ok-note' : 'note'}">${state.ledgerOk ? '해시 체인이 끊김 없이 이어져 있어요.' : '이력이 변조되었어요.'}</p>`)}
      <ol class="ledger">${ledger.slice(-6).reverse().map((e) => html`<li><span>${e.action === 'grant' ? '동의' : '철회'} · ${e.purpose}</span><span class="mono small muted">${e.hash} ← ${e.prev}</span><span class="small muted">${new Date(e.at).toLocaleString('ko-KR')}</span></li>`)}</ol>
      ${when(!ledger.length, () => html`<p class="small muted">아직 기록이 없어요.</p>`)}
    </section>
    <section class="card stack-8">
      <h2 class="h3">내 데이터</h2>
      <div class="row gap-8"><button class="btn ghost grow" data-act="export-data">내보내기</button><button class="btn danger grow" data-act="delete-ask">계정 삭제</button></div>
      ${when(state.exportJson, () => html`<label class="sr" for="export-box">내보낸 데이터</label><textarea id="export-box" class="mono small" rows="8" readonly>${state.exportJson}</textarea><button class="btn ghost sm" data-act="copy-export">${icon('copy', 14)} 복사</button>`)}
      ${when(state.confirmDelete, () => html`<div class="danger-box stack-8"><b>모든 기록을 지울까요?</b><span class="small">이 기기의 취향, 독서 기록, 퀴즈, 동의 이력을 지우고 처음 화면으로 돌아가요. 실제 서비스에서는 7일 안에 운영 DB, 30일 안에 백업까지 지우고 삭제 증적을 드려요.</span><div class="row gap-8"><button class="btn ghost" data-act="delete-cancel">취소</button><button class="btn danger grow" data-act="delete-confirm">삭제</button></div></div>`)}
    </section>
  </section>`;
}

// North Star: 주간 활성 독서 시간 + 연속 기록 + 퀴즈 학습 이득(앞 3문항 vs 최근 3문항 정답률)
function weekly() {
  const day = (d) => new Date(d).toDateString();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const mins = days.map((d) => state.sessions.filter((s) => day(s.at) === day(d)).reduce((a, s) => a + s.minutes, 0));
  const max = Math.max(30, ...mins);
  let streak = 0;
  for (let i = 6; i >= 0 && mins[i] > 0; i--) streak++;
  const ql = state.quizLog;
  const rate = (xs) => (xs.length ? xs.filter((x) => x.correct).length / xs.length : null);
  const first = rate(ql.slice(0, 3)), last = ql.length >= 6 ? rate(ql.slice(-3)) : null;
  const W = ['일', '월', '화', '수', '목', '금', '토'];
  return html`<section class="card stack-12">
    <div class="row between"><h2 class="h3">이번 주 독서 시간</h2><span class="small muted">${streak ? `${streak}일 연속` : '오늘 첫 세션을 시작해 보세요'}</span></div>
    <div class="week" role="img" aria-label="최근 7일 독서 시간: ${mins.map((m, i) => `${W[days[i].getDay()]} ${m}분`).join(', ')}">
      ${mins.map((m, i) => html`<div class="${i === 6 ? 'today' : ''}"><span class="num small">${m || ''}</span><b style="height:${Math.max(3, (m / max) * 100)}%"></b><span class="small muted">${W[days[i].getDay()]}</span></div>`)}
    </div>
    ${when(last != null, () => html`<div class="row between small"><span>퀴즈 학습 이득</span><b class="${last >= first ? 'ok' : 'warn'}">${Math.round(first * 100)}% → ${Math.round(last * 100)}% (${last >= first ? '+' : ''}${Math.round((last - first) * 100)}%p)</b></div>`)}
  </section>`;
}

export const myActions = {
  async 'my-consent'(k, el) {
    state.consents[k] = el.checked;
    await run(() => Privacy.update({ user: state.user, purpose: k, scope: k, grant: el.checked }));
    if (k === 'location' || k === 'personalization') state.feed = null;
    if (k === 'bio') state.plan = null;
    state.ledgerOk = null; save(); render();
  },
  'verify-ledger'() { state.ledgerOk = Privacy.ledger.verify(); render(); },
  async 'export-data'() { const r = await run(() => Privacy.export({ user: state.user, state })); if (r) { state.exportJson = JSON.stringify(r, null, 2); render(); } },
  async 'copy-export'() {
    try { await navigator.clipboard.writeText(state.exportJson); toast('복사했어요'); }
    catch { const t = document.getElementById('export-box'); t?.select(); toast('텍스트를 선택했어요. 직접 복사해 주세요'); }
  },
  'delete-ask'() { state.confirmDelete = true; render(); },
  'delete-cancel'() { state.confirmDelete = false; render(); },
  'delete-confirm'() { wipe(); toast('모든 기록을 지웠어요'); render(); },
  'redo-onboarding'() { state.onboarding = { step: 1, page: 0, picked: [], genreMode: false, genres: [], cat: { responses: [], item: null, est: { theta: 0, se: 1 }, done: false } }; go('onboarding'); },
};
