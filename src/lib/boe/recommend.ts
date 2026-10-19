// 화면에서 쓰는 추천 조립: 맥락 만들기 → 후보 → 밴딧 점수 → MMR.
import { BOOKS, HOME, LIBRARIES, bookById, holdingsFor, wordsOf, type Book } from './catalog';
import { mmr, score, type Candidate, type Context, type Scored } from './bandit';
import { rankLibraries, type LatLng, type Ranked } from './gis';
import { analyze, readMinutes } from './readability';
import { readiness } from './scheduler';
import { rng } from './math';
import type { AppState } from './store';

const analysisCache = new Map<string, ReturnType<typeof analyze>>();
export const analysisOf = (b: Book) => {
  let a = analysisCache.get(b.id);
  if (!a) { a = analyze(b.blurb); analysisCache.set(b.id, a); }
  return a;
};

export const minutesOf = (b: Book, wpm: number) => readMinutes(wordsOf(b), wpm, analysisOf(b).load);

export function librariesFor(bookId: string, pos: LatLng | null, hour: number): Ranked[] {
  return rankLibraries(pos ?? HOME, LIBRARIES, holdingsFor(bookId), hour);
}

export function contextOf(st: AppState, hour: number): Context {
  const r = st.consent?.bio ? readiness(hour, st.bio) : readiness(hour, { ...st.bio, sleepHours: 7, sleepQuality: 0.75 });
  return { hour, readiness: r, theta: st.theta, taste: st.taste, minutes: st.sessionMin };
}

export function candidateOf(b: Book, st: AppState, pos: LatLng | null, hour: number): Candidate {
  const libs = librariesFor(b.id, pos, hour).filter((l) => l.status !== '소장 안 함');
  const best = libs[0];
  const chunkMin = Math.round((20 * 170) / st.wpm);
  return {
    id: b.id, style: b.style, difficulty: b.difficulty,
    etaMin: st.consent?.location && best ? best.eta.min : null,
    p: best ? best.p : 0, chunkMin, deep: b.deep,
  };
}

export type FeedEntry = Scored & { book: Book; lib?: Ranked };

/** 피드: 읽는 중이거나 다 읽은 책은 빼고, 밴딧 점수 상위 20권을 MMR로 5권 고른다. */
export function buildFeed(st: AppState, pos: LatLng | null, hour: number, seed: number): { feed: FeedEntry[]; all: Map<string, FeedEntry>; ctx: Context } {
  const ctx = contextOf(st, hour);
  const busy = new Set(st.shelf.map((x) => x.book));
  const cands = BOOKS.map((b) => candidateOf(b, st, pos, hour));
  const personalized = st.consent?.personalization !== false;
  const scored = score(personalized ? st.bandit : { ...st.bandit, b: st.bandit.b.map(() => 0) }, ctx, cands, rng(seed));
  const all = new Map<string, FeedEntry>();
  for (const sc of scored) {
    const book = bookById(sc.id)!;
    all.set(sc.id, { ...sc, book, lib: librariesFor(sc.id, pos, hour).find((l) => l.status !== '소장 안 함') });
  }
  const free = scored.filter((x) => !busy.has(x.id));
  const top = (free.length ? free : scored).sort((a, b) => b.score - a.score).slice(0, 20);
  const picked = mmr(top, (id) => bookById(id)!.style, 5, 0.7);
  return { feed: picked.map((p) => all.get(p.id)!), all, ctx };
}

export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`);
