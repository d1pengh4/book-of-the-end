// 앱 상태. 설계서의 Privacy by Design에 따라 모든 개인 데이터는 이 기기(localStorage)에만 둔다.
import { freshBandit, type BanditState } from './bandit';
import type { BioInput } from './scheduler';
import type { Answer } from './irt';

export type ShelfItem = { book: string; status: '예약' | '읽는 중' | '다 읽음'; lib?: string; at: string; done: number };
export type Concept = { book: string; ease: number; interval: number; due: string; reps: number; lapses: number };
export type LogEvent = { type: string; at: string; book?: string; detail?: string };

export type AppState = {
  v: 1;
  consent: { personalization: boolean; location: boolean; bio: boolean; at: string } | null;
  onboarded: boolean;
  taste: number[];
  theta: number;
  thetaSE: number;
  wpm: number;
  sessionMin: number;
  bandit: BanditState;
  bio: BioInput;
  shelf: ShelfItem[];
  quiz: Record<string, { answers: Answer[]; theta: number; se: number }>;
  concepts: Record<string, Concept>;
  log: LogEvent[];
};

export const KEY = 'boe:v1';

export const initialState = (): AppState => ({
  v: 1,
  consent: null,
  onboarded: false,
  taste: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
  theta: 0,
  thetaSE: 1,
  wpm: 200,
  sessionMin: 30,
  bandit: freshBandit(),
  bio: { sleepHours: 7, sleepQuality: 0.75, busy: 0.4, midSleep: 3.5 },
  shelf: [],
  quiz: {},
  concepts: {},
  log: [],
});

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw);
    if (s?.v !== 1) return initialState();
    return { ...initialState(), ...s };
  } catch {
    return initialState();
  }
}

export function save(s: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 공간이 막혀 있어도 앱은 계속 쓴다 */ }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

export const logEvent = (s: AppState, e: Omit<LogEvent, 'at'>): AppState => ({
  ...s,
  log: [{ ...e, at: new Date().toISOString() }, ...s.log].slice(0, 200),
});

/**
 * 간격 반복(SM-2 단순형). 맞히면 간격을 늘리고, 틀리면 1일로 되돌린다.
 * 설계서는 FSRS를 권하지만 매개변수 학습 데이터가 없어 SM-2로 시작한다.
 */
export function review(c: Concept | undefined, book: string, correct: boolean, now = new Date()): Concept {
  const base: Concept = c ?? { book, ease: 2.5, interval: 0, due: now.toISOString(), reps: 0, lapses: 0 };
  const q = correct ? 4 : 1;
  const ease = Math.max(1.3, base.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const reps = correct ? base.reps + 1 : 0;
  const interval = !correct ? 1 : reps === 1 ? 1 : reps === 2 ? 6 : Math.round(base.interval * ease);
  const due = new Date(now.getTime() + interval * 86400000).toISOString();
  return { book, ease, interval, due, reps, lapses: base.lapses + (correct ? 0 : 1) };
}
