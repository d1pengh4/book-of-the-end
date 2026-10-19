import { html, icon } from './h.js';
import { state, hydrate, persist } from './store.js';
import { setRenderer, go, render } from './ctx.js';
import { onboardingView, onboardingActions } from './views/onboarding.js';
import { homeView, exploreView, detailView, readerActions, readerInputs } from './views/reader.js';
import { scheduleView, scheduleActions, scheduleInputs, scheduleChanges } from './views/schedule.js';
import { learnView, learnActions, learnInputs, learnSubmits } from './views/learn.js';
import { myView, myActions } from './views/my.js';
import { teacherView, teacherActions, teacherChanges } from './views/teacher.js';
import { libraryView, libraryChanges } from './views/library.js';
import { consoleView, consoleActions } from './views/console.js';
import { gw } from '../api/services.js';

const ACTIONS = { ...onboardingActions, ...readerActions, ...scheduleActions, ...learnActions, ...myActions, ...teacherActions, ...consoleActions,
  persona(p) { state.persona = p; render(); window.scrollTo?.(0, 0); },
  nav(r) { if (state.reading && r !== 'schedule') return; go(r); },
};
let theme = (() => { try { return localStorage.getItem('bote.theme') || 'system'; } catch { return 'system'; } })();
function applyTheme() {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
ACTIONS.theme = () => {
  theme = { system: 'light', light: 'dark', dark: 'system' }[theme];
  try { localStorage.setItem('bote.theme', theme); } catch { /* noop */ }
  applyTheme(); render();
};
const INPUTS ={ ...readerInputs, ...scheduleInputs, ...learnInputs };
const CHANGES = { ...scheduleChanges, ...teacherChanges, ...libraryChanges };
const SUBMITS = { ...learnSubmits };

const NAV = [['home', '홈', 'home'], ['explore', '탐색', 'search'], ['schedule', '스케줄', 'calendar'], ['learn', '학습', 'spark'], ['my', 'MY', 'user']];
const PERSONAS = [['reader', '독자 앱', 'book'], ['teacher', '교사', 'school'], ['library', '도서관', 'building'], ['console', '콘솔', 'terminal']];

function readerScreen() {
  const r = state.route;
  const body = r === 'onboarding' ? onboardingView() : r === 'detail' ? detailView() : r === 'explore' ? exploreView() : r === 'schedule' ? scheduleView() : r === 'learn' ? learnView() : r === 'my' ? myView() : homeView();
  const showNav = r !== 'onboarding' && r !== 'detail' && !state.reading;
  const active = r === 'detail' ? 'explore' : r;
  return html`<div class="phone ${showNav ? 'has-nav' : ''}">
    <main id="main">${body}</main>
    ${showNav ? html`<nav class="tabbar" aria-label="주요 메뉴">${NAV.map(([k, l, ic]) => html`<button data-act="nav" data-arg="${k}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${l}</span></button>`)}</nav>` : ''}
  </div>`;
}

function shell() {
  const p = state.persona;
  const body = p === 'teacher' ? teacherView() : p === 'library' ? libraryView() : p === 'console' ? consoleView() : readerScreen();
  return html`
  <header class="topbar">
    <div class="topbar-in">
      <span class="logo">Book <i>of the</i> End</span>
      <button class="icon-btn theme-btn" data-act="theme" aria-label="화면 테마: ${({ system: '시스템', light: '밝게', dark: '어둡게' })[theme]} (눌러서 바꾸기)">${icon(theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'contrast', 18)}</button>
      <nav class="persona" aria-label="화면 전환">${PERSONAS.map(([k, l, ic]) => html`<button data-act="persona" data-arg="${k}" class="${p === k ? 'on' : ''}" aria-pressed="${p === k}">${icon(ic, 16)}<span>${l}</span></button>`)}</nav>
    </div>
  </header>
  <div class="stage ${p === 'reader' ? 'stage-reader' : 'stage-wide'}">${body}</div>
  <footer class="foot small">데모 빌드 · 외부 API는 데모 어댑터 · 도서 샘플 문장·재고·좌표·학생·수요 데이터는 예시예요</footer>
  ${state.toast ? html`<div class="toast ${state.toast.kind}" role="status">${state.toast.msg}</div>` : ''}`;
}

let root;
function doRender() {
  const a = document.activeElement;
  const fid = a?.id, sel = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
  const scroll = window.scrollY;
  root.innerHTML = shell().s;
  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange && el.type !== 'number' && el.type !== 'range') try { el.setSelectionRange(...sel); } catch { /* noop */ } }
  }
  window.scrollTo(0, scroll);
}

export function start(el) {
  root = el;
  applyTheme();
  hydrate();
  setRenderer(doRender);
  const handle = (ev, attr, table, getVal) => {
    const t = ev.target.closest?.(`[${attr}]`);
    if (!t || !root.contains(t)) return false;
    const f = table[t.getAttribute(attr)];
    if (!f) return false;
    f(getVal(t), t, ev);
    return true;
  };
  root.addEventListener('click', (ev) => {
    const t = ev.target.closest?.('[data-act]');
    if (!t || t.disabled) return;
    if (t.matches('input[type=checkbox]')) return; // 체크박스는 change에서 처리
    ev.preventDefault();
    const f = ACTIONS[t.dataset.act];
    if (f) f(t.dataset.arg, t, ev);
  });
  root.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('g[data-act]')) { ev.preventDefault(); ACTIONS[ev.target.dataset.act]?.(ev.target.dataset.arg, ev.target, ev); }
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches?.('input[type=checkbox][data-act]')) { ACTIONS[t.dataset.act]?.(t.dataset.arg, t, ev); return; }
    handle(ev, 'data-change', CHANGES, (x) => x.value);
  });
  root.addEventListener('input', (ev) => handle(ev, 'data-input', INPUTS, (x) => x.value));
  root.addEventListener('submit', (ev) => { ev.preventDefault(); handle(ev, 'data-submit', SUBMITS, () => null); });
  // 독서 세션 타이머: 전체 렌더 없이 숫자만 갱신
  setInterval(() => {
    const t = document.getElementById('timer');
    if (t && state.reading) { const s = Math.floor((Date.now() - state.reading.startedAt) / 1000); t.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  }, 500);
  // 콘솔은 새 호출이 오면 갱신
  gw.onCall(() => { if (state.persona === 'console') queueMicrotask(doRender); });
  window.addEventListener('pagehide', persist);
  doRender();
}
