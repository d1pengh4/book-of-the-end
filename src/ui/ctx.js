import { state, persist } from './store.js';
export { state };
const hooks = { render: () => {} };
export const setRenderer = (f) => { hooks.render = f; };
export const render = () => { hooks.render(); };
let toastTimer;
export function toast(msg, kind = 'info') {
  state.toast = { msg, kind };
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = null; render(); }, 3200);
}
export function go(route, extra = {}) {
  state.prevRoute = state.route;
  state.route = route;
  Object.assign(state, extra);
  persist();
  render();
  document.getElementById('main')?.scrollTo?.(0, 0);
  window.scrollTo?.(0, 0);
}
export const save = persist;
// 비동기 API 호출 래퍼: 오류는 화면 토스트로 안내
export async function run(fn) {
  try { return await fn(); } catch (e) { toast(e.message || '잠시 후 다시 시도해 주세요', 'error'); return null; }
}
