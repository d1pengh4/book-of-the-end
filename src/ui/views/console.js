// 개발자 콘솔: API 호출 로그, SLO(p95), 서킷브레이커·장애 주입, 이벤트 스트림, 밴딧 상태
import { html, icon, when } from '../h.js';
import { state, render } from '../ctx.js';
import { gw, mabModel, bookByIsbn, Experiment } from '../../api/services.js';

export function consoleView() {
  const c = state.console;
  const slo = gw.sloReport().sort((a, b) => a.method.localeCompare(b.method));
  return html`
  <section class="wide-screen">
    <header class="wide-head"><div class="stack-4"><span class="small muted">운영 · 데모 백엔드</span><h1 class="display sm">개발자 콘솔</h1></div>
      <div class="tabs" role="tablist">${[['calls', 'API 호출'], ['events', '이벤트'], ['faults', '장애 주입'], ['model', '추천 모델'], ['experiment', '오프라인 실험']].map(([k, l]) => html`<button role="tab" aria-selected="${c.tab === k}" class="${c.tab === k ? 'on' : ''}" data-act="console-tab" data-arg="${k}">${l}</button>`)}</div>
    </header>
    <p class="note">외부 API(도서관 정보나루, Kakao Mobility, HealthKit, LLM 제공사)는 같은 계약을 따르는 데모 어댑터예요. 지연·장애·폴백은 실제처럼 시뮬레이션해요.</p>
    ${c.tab === 'calls' ? html`
      <div class="wide-grid">
        <section class="card stack-8 span-2"><h2 class="h2">SLO (p95)</h2>
          <div class="table-wrap"><table class="plain"><thead><tr><th scope="col">메서드</th><th scope="col">호출</th><th scope="col">p95</th><th scope="col">목표</th><th scope="col">상태</th></tr></thead><tbody>
            ${slo.length ? slo.map((s) => html`<tr><td class="mono">${s.method}</td><td class="num">${s.n}</td><td class="num">${s.p95}ms</td><td class="num">${s.target ? `<${s.target}ms` : '-'}</td><td><span class="status ${s.ok ? 'ok' : 'warn'}">${s.ok ? '충족' : '초과'}</span></td></tr>`) : html`<tr><td colspan="5" class="muted">아직 호출이 없어요. 독자 앱을 써 보세요.</td></tr>`}
          </tbody></table></div>
        </section>
        <section class="card stack-8 span-2"><h2 class="h2">최근 호출</h2>
          <div class="table-wrap"><table class="plain"><thead><tr><th scope="col">시각</th><th scope="col">메서드</th><th scope="col">상태</th><th scope="col">지연</th><th scope="col">비고</th></tr></thead><tbody>
            ${gw.calls.slice(0, 30).map((x) => html`<tr><td class="num small">${x.at.toLocaleTimeString('ko-KR')}</td><td class="mono">${x.method}</td><td><span class="status ${x.status === 200 ? 'ok' : 'warn'}">${x.status}</span></td><td class="num">${x.ms}ms</td><td class="small muted">${[x.cache ? '캐시' : '', x.degraded ?? '', x.error ?? ''].filter(Boolean).join(' · ')}</td></tr>`)}
          </tbody></table></div>
        </section>
      </div>` : c.tab === 'events' ? html`
      <section class="card stack-8"><h2 class="h2">이벤트 스트림 (schema v3)</h2><p class="small muted">user_pseudo_id는 날마다 솔트가 바뀌는 해시예요. 원시 개인정보는 싣지 않아요.</p>
        <div class="events">${gw.bus.log.slice(0, 40).map((e) => html`<pre class="mono small">${JSON.stringify(e, null, 1)}</pre>`)}${when(!gw.bus.log.length, () => html`<p class="muted">아직 이벤트가 없어요.</p>`)}</div>
      </section>` : c.tab === 'faults' ? html`
      <section class="card stack-12"><h2 class="h2">외부 연동 장애 주입</h2>
        ${Object.entries(gw.breakers).map(([name, br]) => html`<label class="consent" for="f-${name}"><span class="stack-4"><b>${name}</b><span class="small muted">서킷 ${({ closed: '닫힘(정상)', open: '열림(차단)', 'half-open': '반열림(시험 중)' })[br.state]} · 연속 실패 ${br.fails}</span></span><input type="checkbox" class="switch" id="f-${name}" data-act="fault" data-arg="${name}" ${gw.faults[name] ? 'checked' : ''}></label>`)}
        <p class="small muted">켜면 해당 API가 실패해요. 정보나루 → 캐시와 "확인 필요" 배지, Kakao → Haversine×1.3 근사, LLM → 하이라이트 요약, HealthKit → 선호 시간 폴백으로 바뀌는 걸 확인해 보세요.</p>
      </section>` : c.tab === 'experiment' ? experiment(c) : html`
      <section class="card stack-8"><h2 class="h2">Linear Thompson Sampling 팔 상태</h2>
        <div class="table-wrap"><table class="plain"><thead><tr><th scope="col">도서</th><th scope="col">관측 수</th><th scope="col">사후 평균 θ̂ (bias, 문체, 난이도, 분량, 근처, 시간대, 준비도)</th></tr></thead><tbody>
          ${[...mabModel.arms.entries()].map(([id, a]) => { const p = mabModel.posterior(id).mean; return html`<tr><td>${bookByIsbn(id)?.title ?? id}</td><td class="num">${a.n}</td><td class="mono small">${p.map((v) => v.toFixed(2)).join(', ')}</td></tr>`; })}
        </tbody></table></div>
        <p class="small muted">보상 r = 0.2·클릭 + 0.3·(30초 이상 머묾) + 0.5·(예약 또는 읽기 시작)</p>
      </section>`}
  </section>`;
}
function experiment(c) {
  if (!c.ope && !c.opeLoading) queueMicrotask(async () => { c.opeLoading = true; c.ope = await Experiment.run({ seed: c.seed ?? 42 }); c.opeLoading = false; render(); });
  const o = c.ope;
  const f = (v) => v.toFixed(3);
  return html`<section class="card stack-12">
    <div class="row between wrap gap-8"><h2 class="h2">오프라인 정책 평가 (IPS · SNIPS · DM · Doubly-Robust)</h2><button class="btn ghost sm" data-act="ope-rerun">${icon('refresh', 14)} 다른 시드로 다시 실행</button></div>
    <p class="small muted">로깅 정책(ε=0.3 탐색 + 인기순)이 남긴 ${o ? o.n.toLocaleString() : '3,000'}건의 기록 중 앞 절반으로 새 정책을 학습하고, 뒤 절반으로 배포 전 가치를 추정해요. 시뮬레이션이라 실제 가치도 알 수 있어서 추정기 오차를 함께 보여줘요.</p>
    ${o ? html`<div class="table-wrap"><table class="plain">
      <thead><tr><th scope="col">정책</th><th scope="col">실제 가치</th><th scope="col">IPS</th><th scope="col">SNIPS</th><th scope="col">DM</th><th scope="col">DR</th><th scope="col">DR 오차</th><th scope="col">인기순 대비</th><th scope="col">추천 다양성</th></tr></thead>
      <tbody>${o.rows.map((r) => html`<tr><td>${r.name}</td><td class="num">${f(r.truth)}</td><td class="num">${f(r.ips)}</td><td class="num">${f(r.snips)}</td><td class="num">${f(r.dm)}</td><td class="num"><b>${f(r.dr)}</b></td><td class="num">${f(r.drErr)}</td><td class="num ${r.liftDR > 0.05 ? 'ok' : ''}">${r.liftDR >= 0 ? '+' : ''}${(r.liftDR * 100).toFixed(1)}%</td><td class="num">${r.coverage}권</td></tr>`)}</tbody>
    </table></div>
    <div class="row gap-16 wrap small"><span>로깅 정책 실측 보상 ${f(o.logging)}</span><span class="muted">배포 기준(안): DR 추정 +5% 이상, 다양성 10권 이상 → 5% 섀도 → 카나리</span></div>
    ${(() => { const best = [...o.rows].sort((a, b) => b.dr - a.dr)[0]; const pass = best.liftDR > 0.05 && best.coverage >= 10; return html`<p class="${pass ? 'ok-note' : 'note'}">${pass ? `${best.name}: 배포 기준을 통과했어요. 섀도 배포 후보로 올릴 수 있어요.` : '기준을 통과한 정책이 없어요. 지금 정책을 유지해요.'}</p>`; })()}`
    : html`<div class="skeleton" style="height:200px"></div>`}
  </section>`;
}

export const consoleActions = {
  'ope-rerun'() { const c = state.console; c.seed = Math.floor(Math.random() * 10000); c.ope = null; render(); },
  'console-tab'(k) { state.console.tab = k; render(); },
  fault(name, el) { gw.faults[name] = el.checked; if (!el.checked) gw.breakers[name].success(); render(); },
};
export { icon };
