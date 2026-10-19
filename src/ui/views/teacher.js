// B2B 교사 대시보드: 코호트 히트맵(k≥5), 군집·리스크(CUSUM), 공정성 감사, AI Materials Studio
import { html, icon, when, pct } from '../h.js';
import { state, render, run, toast } from '../ctx.js';
import { STANDARDS } from '../../api/data.js';
import { Classroom } from '../../api/services.js';
import { sparkline } from '../charts.js';

async function load() {
  const t = state.teacher;
  t.loading = true; render();
  t.data = await run(() => Classroom.cohort({ classId: t.classId }));
  t.loading = false; render();
}
const COLS = [
  ['acc', '이해도(정답률)', (v) => pct(v), (v) => v],
  ['wpm', '읽기 속도', (v) => `${v}`, (v) => Math.min(1, (v - 100) / 180)],
  ['vocabAccept', '어휘 수용도', (v) => pct(v), (v) => v],
  ['dropout', '중도 이탈', (v) => pct(v), (v) => 1 - Math.min(1, v * 2.5)],
];

export function teacherView() {
  const t = state.teacher;
  if (!t.data && !t.loading) queueMicrotask(load);
  const d = t.data;
  return html`
  <section class="wide-screen">
    <header class="wide-head">
      <div class="stack-4"><span class="small muted">교사 대시보드 · B2B</span><h1 class="display sm">독서 코호트 분석</h1></div>
      <div class="row gap-8 wrap">
        <label class="sr" for="class-pick">학급</label>
        <select id="class-pick" class="select" data-change="class-pick"><option value="2-3" ${t.classId === '2-3' ? 'selected' : ''}>2학년 3반 (26명)</option><option value="tiny" ${t.classId === 'tiny' ? 'selected' : ''}>방과후 독서반 (4명)</option></select>
        <span class="pill outline xs">${icon('shield', 12, 2)} 개인 생체 지표 열람 불가</span>
      </div>
    </header>
    ${t.loading && !d ? html`<div class="card skeleton" style="height:320px"></div>` : d?.denied ? html`<div class="card stack-8"><b>개인 단위 결과를 보여드릴 수 없어요</b><p class="muted">${d.denied}. 학생 보호를 위해 5명 이상인 학급만 집계해요. 대신 학급 전체 안내 문구를 보낼 수 있어요.</p></div>` : d ? cohort(d) : ''}
    ${materials()}
  </section>`;
}

function cohort(d) {
  const flagged = d.rows.filter((r) => r.flagged).sort((a, b) => b.risk - a.risk);
  const avgFocus = d.rows.reduce((s, r) => s + r.focus, 0) / d.rows.length;
  const clusters = [...new Set(d.rows.map((r) => r.clusterName))].map((name) => {
    const m = d.rows.filter((r) => r.clusterName === name);
    return { name, n: m.length, acc: m.reduce((s, r) => s + r.acc, 0) / m.length, wpm: Math.round(m.reduce((s, r) => s + r.wpm, 0) / m.length) };
  }).sort((a, b) => a.acc - b.acc);
  return html`
    <div class="kpi-row">
      <div class="kpi"><span class="small muted">학생</span><b class="num">${d.n}명</b></div>
      <div class="kpi"><span class="small muted">학급 평균 몰입도(집계)</span><b class="num">${pct(avgFocus)}</b></div>
      <div class="kpi"><span class="small muted">군집 수 K (silhouette ${d.sil})</span><b class="num">${d.k}</b></div>
      <div class="kpi"><span class="small muted">지원 제안 대상</span><b class="num">${flagged.length}명</b></div>
    </div>
    <div class="wide-grid">
      <section class="card stack-12 span-2">
        <div class="row between"><h2 class="h2">인지 히트맵</h2><span class="small muted">학생 이름 대신 가명 번호 · 값과 색을 함께 표시</span></div>
        <div class="table-wrap"><table class="heat">
          <thead><tr><th scope="col">학생</th>${COLS.map((c) => html`<th scope="col">${c[1]}</th>`)}<th scope="col">8주 추이</th><th scope="col">군집</th></tr></thead>
          <tbody>${d.rows.map((r) => html`<tr class="${state.teacher.sel === r.id ? 'sel' : ''}">
            <th scope="row"><button class="link" data-act="t-sel" data-arg="${r.id}">${r.id}</button></th>
            ${COLS.map(([k, , f, n]) => html`<td style="--h:${Math.max(0, Math.min(1, n(r[k]))).toFixed(2)}" class="heat-cell">${f(r[k])}</td>`)}
            <td>${sparkline(r.weekly, 70, 20)}</td><td class="small">${r.clusterName}</td>
          </tr>`)}</tbody>
        </table></div>
      </section>
      ${when(state.teacher.sel, () => drill(d.rows.find((r) => r.id === state.teacher.sel)))}
      <section class="card stack-12">
        <h2 class="h2">지원이 필요해 보이는 학생</h2>
        <p class="small muted">위험 표시는 낙인이 되지 않도록 이유와 지원 방법을 함께 보여줘요.</p>
        <ul class="flag-list">${flagged.map((r) => html`<li class="${state.teacher.sel === r.id ? 'sel' : ''}">
          <div class="row between"><b>${r.id}</b><span class="small muted">${r.clusterName}</span></div>
          <span class="small">${r.why.join(' · ') || '여러 지표가 조금씩 낮아요'}</span>
          <span class="small support">${icon('heart', 13)} ${r.support}</span>
        </li>`)}</ul>
      </section>
      <section class="card stack-12">
        <h2 class="h2">군집 프로필</h2>
        ${clusters.map((c) => html`<div class="row between small"><span><b>${c.name}</b> · ${c.n}명</span><span class="muted">정답률 ${pct(c.acc)} · ${c.wpm}어절/분</span></div>`)}
        <div class="small muted">K 후보 silhouette: ${d.tries.map((t) => `K=${t.k} ${t.sil}`).join(' · ')}</div>
        <h3 class="h3">공정성 감사</h3>
        <div class="row between small"><span>그룹별 놓침률(FNR) 격차</span><b class="${d.fair.gap < 0.05 ? 'ok' : 'warn'}">${(d.fair.gap * 100).toFixed(1)}%p ${d.fair.gap < 0.05 ? '기준 충족' : '기준(5%p) 초과 · 재검토'}</b></div>
        <div class="small muted">${Object.entries(d.fair.rates).map(([g, r]) => `그룹 ${g}: ${pct(r)}`).join(' · ')}</div>
      </section>
    </div>`;
}

// 학생 드릴다운: 주별 정답률 + CUSUM 누적 하락량(임계 h=0.12)
function drill(r) {
  if (!r) return '';
  const w = 320, h = 120, pad = 24, n = r.weekly.length;
  const X = (i) => pad + (i / (n - 1)) * (w - pad * 2);
  const Y = (v) => 10 + (1 - v) * (h - 30);
  const Yc = (v) => 10 + (1 - Math.min(1, v / 0.3)) * (h - 30);
  const acc = r.weekly.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join('');
  const cs = r.cusum.path.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Yc(v)}`).join('');
  return html`<section class="card stack-12">
    <div class="row between"><h2 class="h2">${r.id} 자세히</h2><button class="icon-btn" data-act="t-sel" data-arg="${r.id}" aria-label="닫기">${icon('x', 18)}</button></div>
    <svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${r.id}의 8주 정답률과 CUSUM 누적 하락량">
      <line x1="${pad}" x2="${w - pad}" y1="${Yc(0.12)}" y2="${Yc(0.12)}" style="stroke:var(--accent);stroke-dasharray:4 4;opacity:.7" />
      <text x="${w - pad}" y="${Yc(0.12) - 4}" text-anchor="end" style="fill:var(--accent-ink);font-size:10px">경보 임계</text>
      <path d="${cs}" style="fill:none;stroke:var(--accent);stroke-width:2" />
      <path d="${acc}" style="fill:none;stroke:var(--sage);stroke-width:2.2" />
      ${r.weekly.map((v, i) => html`<text x="${X(i)}" y="${h - 4}" text-anchor="middle" style="fill:var(--fg-2);font-size:10px">${i + 1}주</text>`)}
    </svg>
    <div class="legend small"><span><i class="dot sage"></i>정답률</span><span><i class="dot accent"></i>누적 하락(CUSUM)</span></div>
    <div class="kv"><span>정답률</span><b class="num">${pct(r.acc)}</b><span>읽기 속도</span><b class="num">${r.wpm}어절/분</b><span>어휘 오답</span><b class="num">${pct(r.vocabErr)}</b><span>군집</span><b>${r.clusterName}</b></div>
    <p class="small support">${icon('heart', 13)} ${r.support}</p>
    <p class="small muted">수면·심박 같은 개인 생체 지표는 교사 화면에 나오지 않아요.</p>
  </section>`;
}

function materials() {
  const t = state.teacher, m = t.materials;
  return html`<section class="card stack-12">
    <div class="row between wrap gap-8"><h2 class="h2">${icon('spark', 18)} AI 학습자료 스튜디오</h2><span class="small muted">RAG 근거 기반 · 생성물 표시</span></div>
    <div class="row gap-8 wrap">
      <label class="sr" for="std">성취기준</label>
      <select id="std" class="select grow" data-change="t-std">${STANDARDS.map((s) => html`<option value="${s.code}" ${t.standard === s.code ? 'selected' : ''}>${s.code} ${s.text}</option>`)}</select>
      <label class="sr" for="lvl">수준</label>
      <select id="lvl" class="select" data-change="t-level">${['쉬움', '보통', '심화'].map((l) => html`<option ${t.level === l ? 'selected' : ''}>${l}</option>`)}</select>
      <button class="btn primary" data-act="t-generate" ${t.generating ? 'disabled' : ''}>${t.generating ? '만드는 중…' : '활동지 만들기'}</button>
    </div>
    ${when(m, () => html`<article class="sheet" id="sheet">
      <header class="row between wrap"><b class="serif">『별에서 온 우리』 활동지 · ${m.level}</b><span class="small muted">${m.standard} · 생성 ${m.ms}ms</span></header>
      <h3 class="h3">1. 장별 핵심 정리</h3>
      ${m.summaries.map((s) => html`<p><b>${s.ch.title}</b> — ${s.s.status === 'ok' ? s.s.claims.map((c) => c.text).join(' ') : '근거 부족'}</p>`)}
      <h3 class="h3">2. 토론 주제</h3>
      <ol>${m.topics.map((x) => html`<li>${x}</li>`)}</ol>
      <h3 class="h3">3. 확인 문제</h3>
      <ol>${m.items.map((q) => html`<li>${q.q}<span class="small muted"> (${['기억', '이해', '적용', '분석', '평가', '창의'][q.bloom]})</span><ol type="A" class="small">${q.options.map((o) => html`<li>${o}</li>`)}</ol></li>`)}</ol>
      <footer class="row between small muted"><span>정답: ${m.items.map((q, i) => `${i + 1}-A`).join(', ')} (데모 보기 순서)</span><button class="btn ghost sm" data-act="t-copy">${icon('copy', 14)} 텍스트 복사</button></footer>
    </article>`)}
  </section>`;
}

export const teacherActions = {
  't-sel'(id) { state.teacher.sel = state.teacher.sel === id ? null : id; render(); },
  async 't-generate'() {
    const t = state.teacher;
    t.generating = true; render();
    t.materials = await run(() => Classroom.generateMaterials({ standard: t.standard, level: t.level }));
    t.generating = false; render();
  },
  async 't-copy'() {
    const txt = document.getElementById('sheet')?.innerText ?? '';
    try { await navigator.clipboard.writeText(txt); toast('활동지를 복사했어요'); } catch { toast('복사하지 못했어요. 직접 선택해 복사해 주세요', 'error'); }
  },
};
export const teacherChanges = {
  'class-pick'(v) { state.teacher.classId = v; state.teacher.data = null; render(); },
  't-std'(v) { state.teacher.standard = v; },
  't-level'(v) { state.teacher.level = v; },
};
