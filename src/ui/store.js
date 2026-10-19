// 앱 상태 + 개인 브라우저 저장(편의 기능; 실패해도 동작)
import { USER_LOC, QUIZ_BANK } from '../api/data.js';
import { mabModel, Privacy } from '../api/services.js';

const KEY = 'bote.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };

export function freshState() {
  return {
    persona: 'reader', route: 'onboarding', prevRoute: 'home', toast: null,
    user: { id: 'u-' + Math.random().toString(36).slice(2, 8), tasteVec: null, theta: 0, se: 1, wpm: 180, speedZ: 0, loc: USER_LOC, ageBand: '20대', age: 24, onboarded: false, finished: [] },
    consents: { location: true, bio: false, gaze: false, libraryLink: false, analytics: true, personalization: true },
    onboarding: { step: 1, page: 0, picked: [], genreMode: false, genres: [], cat: { responses: [], item: null, est: { theta: 0, se: 1 }, done: false } },
    feed: null, feedLoading: false, openedAt: null,
    detail: { isbn: null, lib: null, libLoading: false, reserved: null, showWhy: false },
    explore: { q: '', genre: '전체', text: '', analysis: null },
    currentIsbn: '9788983711892', progress: {}, bio: null, declared: ['07:00', '21:00'], plan: null, planLoading: false,
    reading: null, sessions: [],
    learn: { tab: 'summary', chapter: 'ch1', summaries: {}, qa: { q: '', res: null, loading: false }, quiz: { responses: [], item: null, last: null, choice: null }, srs: {}, mastery: {}, graphSel: null },
    quizLog: [],
    teacher: { classId: '2-3', data: null, materials: null, standard: '[9과13-02]', level: '보통', sel: null },
    library: { region: '삼례읍', keyword: '과학 교양', f: null, budget: 500000, minLit: 2, purchase: null, route: null, eps: 1.0, k: 10 },
    console: { tab: 'calls' },
    confirmDelete: false, exportJson: null,
  };
}

export const state = freshState();

export function hydrate() {
  const s = load();
  if (!s) return;
  Object.assign(state.user, s.user ?? {});
  Object.assign(state.consents, s.consents ?? {});
  for (const k of ['currentIsbn', 'progress', 'sessions', 'declared', 'bio', 'quizLog']) if (s[k] !== undefined) state[k] = s[k];
  if (s.learn) {
    state.learn.srs = s.learn.srs ?? {};
    state.learn.mastery = s.learn.mastery ?? {};
    state.learn.quiz.responses = (s.learn.responses ?? []).map((r) => ({ item: QUIZ_BANK.find((q) => q.id === r.id), correct: r.correct })).filter((r) => r.item);
  }
  if (s.model) mabModel.load(s.model);
  if (s.ledger) Privacy.ledger.entries = s.ledger;
  state.route = state.user.onboarded ? 'home' : 'onboarding';
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      user: state.user, consents: state.consents, currentIsbn: state.currentIsbn, progress: state.progress, sessions: state.sessions.slice(-50), declared: state.declared, bio: state.bio, quizLog: state.quizLog.slice(-100),
      learn: { srs: state.learn.srs, mastery: state.learn.mastery, responses: state.learn.quiz.responses.map((r) => ({ id: r.item.id, correct: r.correct })) },
      model: mabModel.toJSON(), ledger: Privacy.ledger.entries,
    }));
  } catch { /* 저장 불가 환경: 메모리 상태로만 동작 */ }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  mabModel.arms = new Map();
  Privacy.ledger.entries = [];
  const f = freshState();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, f);
}
