// B2G 도서관·지자체 콕핏: 수요 예측(P10/P50/P90), 구매 최적화, 이동도서관 경로, 문해력 지수(DP·k-익명)
import { html, icon, when, won, pct } from '../h.js';
import { state, render, run } from '../ctx.js';
import { REGIONS, KEYWORDS, MOBILE_DEPOT } from '../../api/data.js';
import { Demand } from '../../api/services.js';
import { bandSvg, mapSvg } from '../charts.js';

async function loadF() {
  const L = state.library;
  L.loading = true; render();
  L.f = await run(() => Demand.forecast({ region: L.region, keyword: L.keyword }));
  L.loading = false; render();
}
const MONTHS = (start, n) => Array.from({ length: n }, (_, i) => `${2023 + Math.floor((start + i) / 12)}.${((start + i) % 12) + 1}`);

export function libraryView() {
  const L = state.library;
  if (!L.f && !L.loading) queueMicrotask(loadF);
  if (!L.route) L.route = Demand.route();
  if (!L.purchase) L.purchase = Demand.purchase({ budget: L.budget, minPerCategory: { 문학: L.minLit } });
  const lit = Demand.literacyIndex({ epsilon: L.eps, k: L.k });
  return html`
  <section class="wide-screen">
    <header class="wide-head">
      <div class="stack-4"><span class="small muted">도서관·지자체 콕핏 · B2G</span><h1 class="display sm">완주군 독서 수요</h1></div>
      <div class="row gap-8 wrap">
        <label class="sr" for="rg">지역</label><select id="rg" class="select" data-change="lib-region">${REGIONS.map((r) => html`<option ${r === L.region ? 'selected' : ''}>${r}</option>`)}</select>
        <label class="sr" for="kw">키워드</label><select id="kw" class="select" data-change="lib-kw">${KEYWORDS.map((k) => html`<option ${k === L.keyword ? 'selected' : ''}>${k}</option>`)}</select>
      </div>
    </header>
    <div class="wide-grid">
      <section class="card stack-12 span-2">
        <div class="row between wrap"><h2 class="h2">월별 대출 수요 예측</h2><span class="small muted">2023~2025 실적(데모) + 6개월 예측 · 음영 = P10~P90</span></div>
        ${L.f ? html`${bandSvg(L.f.y, L.f.band, 640, 220, '2023')}
          <div class="table-wrap"><table class="plain"><thead><tr><th scope="col">월</th>${MONTHS(36, 6).map((m) => html`<th scope="col">${m}</th>`)}</tr></thead><tbody>
            ${['p10', 'p50', 'p90'].map((k) => html`<tr><th scope="row">${k.toUpperCase()}</th>${L.f.band.map((b) => html`<td class="num">${Math.round(b[k])}</td>`)}</tr>`)}
          </tbody></table></div>
          <div class="row gap-16 wrap small"><span>앙상블 가중치: ${Object.entries(L.f.weights).map(([k, v]) => `${{ holtWinters: 'Holt-Winters', seasonalNaive: '계절 나이브', exoRegression: '외생변수 회귀' }[k]} ${pct(v)}`).join(' · ')}</span><span class="muted">검증 sMAPE ${Object.values(L.f.errs).map((e) => e.toFixed(1)).join(' / ')} · 80% 구간 적중 ${pct(L.f.coverage)}</span></div>`
        : html`<div class="skeleton" style="height:220px"></div>`}
      </section>
      <section class="card stack-12">
        <h2 class="h2">구매 수량 제안</h2>
        <div class="row gap-8 wrap">
          <label class="stack-4 small" for="budget">예산<input id="budget" type="number" step="10000" min="0" class="input" value="${L.budget}" data-change="lib-budget"></label>
          <label class="stack-4 small" for="minlit">문학 최소 권수<input id="minlit" type="number" min="0" max="6" class="input" value="${L.minLit}" data-change="lib-minlit"></label>
        </div>
        <div class="table-wrap"><table class="plain"><thead><tr><th scope="col">도서</th><th scope="col">분야</th><th scope="col">수량</th><th scope="col">상한(P90)</th></tr></thead><tbody>
          ${L.purchase.items.map((it) => html`<tr class="${L.purchase.q[it.id] ? '' : 'dim-row'}"><td>${it.title}</td><td>${it.category}</td><td class="num"><b>${L.purchase.q[it.id]}</b></td><td class="num">${it.cap}</td></tr>`)}
        </tbody></table></div>
        <div class="row between small"><span>집행 ${won(L.purchase.spent)} / ${won(L.budget)}</span><span class="muted">효용 ${L.purchase.utility}</span></div>
        <p class="small muted">정수계획 근사: 분야 하한을 먼저 채우고, 남은 예산은 수요 기반 효용(체감)으로 knapsack 배분해요.</p>
      </section>
      <section class="card stack-12">
        <h2 class="h2">${icon('route', 18)} 이동도서관 동선</h2>
        ${mapSvg({ user: null, places: L.route.route.slice(1, -1), route: L.route.route, h: 200 })}
        <ol class="route-list small">${L.route.route.map((s, i) => html`<li><span>${i === 0 || i === L.route.route.length - 1 ? '차고지' : s.name}</span><span class="muted num">${String(Math.floor(s.arrive / 60)).padStart(2, '0')}:${String(s.arrive % 60).padStart(2, '0')}${s.window ? ' · 시간창 준수' : ''}</span></li>`)}</ol>
        <div class="small muted">총 ${Math.floor(L.route.minutes / 60)}시간 ${L.route.minutes % 60}분 · 적재 ${L.route.books}/600권 · ${L.route.feasible ? '제약 충족' : '제약 위반'}</div>
      </section>
      <section class="card stack-12 span-2">
        <div class="row between wrap"><h2 class="h2">문해력·독서율 지수</h2><span class="small muted">차분 프라이버시 ε=${L.eps} · k-익명 k≥${L.k}</span></div>
        <div class="row gap-16 wrap small">
          <label for="eps" class="stack-4">프라이버시 예산 ε <input id="eps" type="range" min="0.2" max="3" step="0.2" value="${L.eps}" data-change="lib-eps"></label>
          <label for="kk" class="stack-4">최소 집계 인원 k <input id="kk" type="range" min="5" max="30" step="5" value="${L.k}" data-change="lib-k"></label>
        </div>
        <div class="table-wrap"><table class="plain lit"><thead><tr><th scope="col">지역</th>${['10대', '20~30대', '40~50대', '60대 이상'].map((a) => html`<th scope="col">${a}</th>`)}</tr></thead><tbody>
          ${REGIONS.map((r) => html`<tr><th scope="row">${r}</th>${lit.filter((g) => g.region === r).map((g) => g.suppressed ? html`<td class="muted small">억제 (n&lt;${L.k})</td>` : html`<td><span class="num">${pct(g.rate)}</span><span class="minibar"><i style="width:${Math.round(g.rate * 100)}%"></i></span></td>`)}</tr>`)}
        </tbody></table></div>
        <p class="small muted">ε가 작을수록 개인을 더 강하게 보호하지만 수치 오차가 커져요. 행정 제출 API는 이 표를 그대로 내보내요.</p>
      </section>
    </div>
  </section>`;
}

export const libraryChanges = {
  'lib-region'(v) { state.library.region = v; state.library.f = null; render(); },
  'lib-kw'(v) { state.library.keyword = v; state.library.f = null; render(); },
  'lib-budget'(v) { state.library.budget = Math.max(0, +v || 0); state.library.purchase = null; render(); },
  'lib-minlit'(v) { state.library.minLit = Math.max(0, +v || 0); state.library.purchase = null; render(); },
  'lib-eps'(v) { state.library.eps = +v; render(); },
  'lib-k'(v) { state.library.k = +v; render(); },
};
export { MOBILE_DEPOT };
