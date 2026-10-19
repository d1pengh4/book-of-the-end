'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bookById, chunksOf } from '@/lib/boe/catalog';
import { REWARD, update } from '@/lib/boe/bandit';
import { buildFeed } from '@/lib/boe/recommend';
import type { LatLng, Ranked } from '@/lib/boe/gis';
import { initialState, load, logEvent, review, save, wipe, type AppState } from '@/lib/boe/store';
import { ConsentStep, StyleStep, VocabStep } from './Onboarding';
import { Explore, Home } from './Feed';
import { Detail } from './Detail';
import { Schedule } from './Schedule';
import { Quiz } from './Quiz';
import { My } from './My';
import { Nav } from './ui';
import s from './boe.module.css';

type Tab = 'home' | 'explore' | 'schedule' | 'my';

export function BookApp() {
  const [st, setSt] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [open, setOpen] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<string | null>(null);
  const [onbStep, setOnbStep] = useState<'style' | 'vocab'>('style');
  const [seed, setSeed] = useState(() => Date.now());
  const [pos, setPos] = useState<LatLng | null>(null);
  const [hour, setHour] = useState(() => new Date().getHours() + new Date().getMinutes() / 60);
  const dwelled = useRef(new Set<string>());

  useEffect(() => { setSt(load()); }, []);
  useEffect(() => { if (st) save(st); }, [st]);
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours() + new Date().getMinutes() / 60), 60000);
    return () => clearInterval(t);
  }, []);
  // 위치는 동의했을 때만, 그리고 화면에 쓸 때만 묻는다
  useEffect(() => {
    if (!st?.consent?.location || pos || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { maximumAge: 600000, timeout: 8000 });
  }, [st?.consent?.location, pos]);

  const patch = useCallback((f: (s: AppState) => AppState) => setSt((p) => (p ? f(p) : p)), []);

  // 피드는 상태가 바뀔 때마다 다시 계산하되, 같은 seed 안에서는 같은 표본을 쓴다
  const h = Math.floor(hour);
  const built = useMemo(() => (st ? buildFeed(st, pos, h, seed) : null), [st, pos, h, seed]);

  const reward = useCallback((id: string, r: number, type: string) => {
    const phi = built?.all.get(id)?.phi;
    patch((p) => {
      let n = logEvent(p, { type, book: id });
      if (phi && p.consent?.personalization !== false) n = { ...n, bandit: update(n.bandit, phi, r) };
      return n;
    });
  }, [built, patch]);

  const openBook = useCallback((id: string) => {
    setQuiz(null);
    setOpen(id);
    reward(id, REWARD.click, '책 열어 봄');
  }, [reward]);

  if (!st) return <div className={s.app}><div className={s.phone} /></div>;

  // ───────── 온보딩 ─────────
  if (!st.consent) {
    return (
      <div className={s.app}><div className={s.phone}>
        <ConsentStep onDone={(c) => patch((p) => logEvent({ ...p, consent: c }, { type: '동의', detail: [c.personalization && '추천', c.location && '위치', c.bio && '수면'].filter(Boolean).join('·') || '필수만' }))} />
      </div></div>
    );
  }
  if (!st.onboarded) {
    return (
      <div className={s.app}><div className={s.phone}>
        {onbStep === 'style'
          ? <StyleStep onDone={(taste) => { patch((p) => ({ ...p, taste })); setOnbStep('vocab'); }} onSkip={() => setOnbStep('vocab')} />
          : <VocabStep onDone={(theta, se) => patch((p) => logEvent({ ...p, theta, thetaSE: se, onboarded: true }, { type: '온보딩 완료', detail: `θ ${theta.toFixed(2)}` }))} />}
      </div></div>
    );
  }

  const entry = open ? built?.all.get(open) : undefined;

  return (
    <div className={s.app}>
      <div className={s.phone}>
        <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }} aria-hidden={open || quiz ? true : undefined}>
          {tab === 'home' && built && <Home st={st} feed={built.feed} ctx={built.ctx} located={!!pos} onOpen={openBook} onRefresh={() => setSeed(Date.now())} />}
          {tab === 'explore' && <Explore st={st} onOpen={openBook} />}
          {tab === 'schedule' && (
            <Schedule st={st} hour={hour}
              onBio={(bio) => patch((p) => ({ ...p, bio }))}
              onSession={(m) => patch((p) => ({ ...p, sessionMin: m }))}
              onEnableBio={() => patch((p) => logEvent({ ...p, consent: { ...p.consent!, bio: true, at: new Date().toISOString() } }, { type: '수면 기록 켬' }))}
              onChunkDone={(id) => patch((p) => {
                const total = chunksOf(bookById(id)!, p.wpm).length;
                const shelf = p.shelf.map((x) => x.book === id ? { ...x, status: '읽는 중' as const, done: Math.min(total, x.done + 1) } : x);
                return logEvent({ ...p, shelf }, { type: '청크 완료', book: id });
              })}
              onQuiz={(id) => setQuiz(id)} onOpen={openBook} />
          )}
          {tab === 'my' && (
            <My st={st} onOpen={openBook} onQuiz={(id) => setQuiz(id)}
              onConsent={(c) => patch((p) => {
                const base = initialState();
                let n: AppState = { ...p, consent: c };
                // 동의를 끄면 그 목적으로 만든 값도 지운다
                if (!c.personalization) n = { ...n, bandit: base.bandit, taste: base.taste };
                if (!c.bio) n = { ...n, bio: base.bio };
                if (!c.location) setPos(null);
                return logEvent(n, { type: '동의 변경' });
              })}
              onWipe={() => { wipe(); setSt(initialState()); setOnbStep('style'); setTab('home'); }} />
          )}
        </main>
        <Nav tab={tab} onTab={(t) => { setTab(t); window.scrollTo({ top: 0 }); }} />
      </div>

      {entry && !quiz && (
        <Detail st={st} entry={entry} pos={pos} hour={h}
          onClose={() => setOpen(null)}
          onOpen={openBook}
          onDwell={() => { if (!dwelled.current.has(entry.id)) { dwelled.current.add(entry.id); reward(entry.id, REWARD.dwell, '30초 넘게 봄'); } }}
          onReserve={(lib: Ranked) => {
            reward(entry.id, REWARD.commit, lib.status === '대출 가능' ? '대출 예약' : '예약 대기');
            patch((p) => ({
              ...p,
              shelf: [...p.shelf.filter((x) => x.book !== entry.id), { book: entry.id, status: '예약', lib: lib.name, at: new Date().toISOString(), done: 0 }],
              // 고른 책 쪽으로 취향을 조금 옮긴다
              taste: p.consent?.personalization !== false ? p.taste.map((v, i) => v * 0.85 + entry.book.style[i] * 0.15) : p.taste,
            }));
          }}
          onStart={() => {
            if (!st.shelf.some((x) => x.book === entry.id)) reward(entry.id, REWARD.commit, '읽기 시작');
            patch((p) => ({
              ...p,
              shelf: p.shelf.some((x) => x.book === entry.id)
                ? p.shelf.map((x) => x.book === entry.id ? { ...x, status: x.status === '다 읽음' ? x.status : '읽는 중' as const } : x)
                : [...p.shelf, { book: entry.id, status: '읽는 중', at: new Date().toISOString(), done: 0 }],
            }));
            setOpen(null); setTab('schedule'); window.scrollTo({ top: 0 });
          }}
          onQuiz={() => setQuiz(entry.id)} />
      )}

      {quiz && (
        <Quiz key={quiz} st={st} bookId={quiz}
          onClose={() => setQuiz(null)}
          onOpen={(id) => { setQuiz(null); openBook(id); }}
          onAnswer={(item, correct) => patch((p) => ({ ...p, concepts: { ...p.concepts, [item.concept]: review(p.concepts[item.concept], item.book, correct) } }))}
          onFinish={(theta, se, answers) => patch((p) => {
            // 전체 이해 수준은 이전 값과 이번 추정을 정밀도로 가중 평균한다
            const w1 = 1 / (p.thetaSE ** 2), w2 = 1 / (se ** 2);
            const merged = (p.theta * w1 + theta * w2) / (w1 + w2);
            const shelf = p.shelf.map((x) => x.book === quiz ? { ...x, status: '다 읽음' as const } : x);
            return logEvent({ ...p, theta: merged, thetaSE: Math.max(0.3, Math.sqrt(1 / (w1 + w2))), quiz: { ...p.quiz, [quiz]: { answers, theta, se } }, shelf }, { type: '퀴즈 완료', book: quiz, detail: `${answers.filter((a) => a.correct).length}/${answers.length}` });
          })} />
      )}
    </div>
  );
}
