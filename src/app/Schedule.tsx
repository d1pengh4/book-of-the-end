'use client';
import { bookById, chunksOf } from '@/lib/boe/catalog';
import { plan, readiness, type BioInput } from '@/lib/boe/scheduler';
import type { AppState } from '@/lib/boe/store';
import s from './boe.module.css';

const HOURS = [7, 9, 11, 13, 15, 17, 21, 23];
const fmtH = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

export function Schedule({ st, hour, onBio, onSession, onChunkDone, onQuiz, onOpen, onEnableBio }: {
  st: AppState; hour: number;
  onBio: (b: BioInput) => void; onSession: (m: number) => void; onChunkDone: (book: string) => void;
  onQuiz: (book: string) => void; onOpen: (book: string) => void; onEnableBio: () => void;
}) {
  const bio = st.consent?.bio ? st.bio : { ...st.bio, sleepHours: 7, sleepQuality: 0.75 };
  const rs = HOURS.map((h) => readiness(h, bio));
  const best = Math.max(...rs);
  const current = st.shelf.find((x) => x.status === '읽는 중') ?? st.shelf.find((x) => x.status === '예약');
  const book = current ? bookById(current.book) : undefined;

  // 앞으로 남은 시간대 중 준비도 상위 3개를 슬롯으로 쓴다
  const future = HOURS.map((h, i) => ({ hour: h, minutes: st.sessionMin, r: rs[i] })).filter((x) => x.hour >= Math.floor(hour) - 1);
  const slots = (future.length ? future : HOURS.map((h, i) => ({ hour: h, minutes: st.sessionMin, r: rs[i] }))).sort((a, b) => b.r - a.r).slice(0, 3);
  const chunks = book ? chunksOf(book, st.wpm).slice(current!.done) : [];
  const p = book ? plan(slots, chunks) : [];
  const total = book ? chunksOf(book, st.wpm).length : 0;
  const set = (k: keyof BioInput, v: number) => onBio({ ...st.bio, [k]: v });

  return (
    <div className={s.screen}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className={s.label}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
        <h1 className={s.h1}>오늘의 독서 계획</h1>
      </div>

      <div className={s.card} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className={s.row}><b style={{ fontSize: 14 }}>집중하기 좋은 시간대 추정</b><span className={s.note}>{st.consent?.bio ? '내 수면 기록 기준' : '기본 리듬 기준'}</span></div>
        <div className={s.bars} role="img" aria-label={HOURS.map((h, i) => `${h}시 ${Math.round(rs[i] * 100)}`).join(', ')}>
          {rs.map((r, i) => (
            <div key={HOURS[i]} style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div className={s.bar} style={{ width: '100%', height: `${Math.max(6, r * 100)}%`, background: r === best ? 'var(--pri)' : r > 0.55 ? 'var(--pri-2)' : 'var(--bar-lo)' }} />
            </div>
          ))}
        </div>
        <div className={s.barLabels} aria-hidden="true">{HOURS.map((h) => <span key={h}>{h}시</span>)}</div>
        <span className={s.note}>진한 막대가 오늘 가장 좋을 것 같은 시간이에요. 진단이 아니라 독서 습관을 위한 추정이에요.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className={s.row}>
          <h2 className={s.h2}>{book ? `나눠 읽기 · ${book.title}` : '나눠 읽기'}</h2>
          {book && <span className={s.note}>{current!.done}/{total} 청크</span>}
        </div>
        {!book && <p className={s.sub}>읽을 책을 예약하거나 스케줄에 등록하면 오늘 읽을 분량을 시간대별로 나눠 드려요.</p>}
        {book && current!.done >= total && (
          <div className={s.dashed}>
            <span>다 읽었어요! 이해했는지 확인해 볼까요?</span>
            <button className={s.btnSm} style={{ background: 'var(--pri)', color: 'var(--pri-fg)' }} onClick={() => onQuiz(book.id)}>퀴즈</button>
          </div>
        )}
        {p.map(({ slot, chunks: cs, used }, i) => (
          <div key={slot.hour} className={s.slot}>
            <div className={s.slotTime}>{fmtH(slot.hour)}</div>
            <div className={`${s.slotBody} ${slot.r === Math.max(...p.map((x) => x.slot.r)) ? s.slotBest : ''}`}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{cs.length ? `${cs[0].label.split('~')[0]}~${cs[cs.length - 1].label.split('~')[1]}` : '쉬어 가기'}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{cs.length ? `${used}분 · 준비도 ${Math.round(slot.r * 100)}` : '이 시간엔 분량을 담지 않았어요'}</span>
              {i === 0 && cs.length > 0 && (
                <button className={s.btnSm} style={{ marginTop: 8, alignSelf: 'flex-start', background: 'var(--hero-fg)', color: 'var(--hero)' }} onClick={() => onChunkDone(book!.id)}>
                  {cs[0].label} 읽었어요
                </button>
              )}
            </div>
          </div>
        ))}
        {book && <button className={s.btnLink} onClick={() => onOpen(book.id)}>책 정보 보기</button>}
      </div>

      <div className={s.card} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className={s.field}>
          <span className={s.fieldRow}><span>한 번에 읽을 시간</span><b>{st.sessionMin}분</b></span>
          <input type="range" min={10} max={90} step={5} value={st.sessionMin} onChange={(e) => onSession(+e.target.value)} />
        </label>
        {st.consent?.bio ? (
          <>
            <label className={s.field}>
              <span className={s.fieldRow}><span>어젯밤 잔 시간</span><b>{st.bio.sleepHours}시간</b></span>
              <input type="range" min={3} max={11} step={0.5} value={st.bio.sleepHours} onChange={(e) => set('sleepHours', +e.target.value)} />
            </label>
            <label className={s.field}>
              <span className={s.fieldRow}><span>잘 잤다고 느끼는 정도</span><b>{Math.round(st.bio.sleepQuality * 100)}%</b></span>
              <input type="range" min={0.3} max={1} step={0.05} value={st.bio.sleepQuality} onChange={(e) => set('sleepQuality', +e.target.value)} />
            </label>
            <label className={s.field}>
              <span className={s.fieldRow}><span>보통 잠드는 시각 → 수면 중간</span><b>{fmtH(st.bio.midSleep)}</b></span>
              <input type="range" min={1} max={7} step={0.5} value={st.bio.midSleep} onChange={(e) => set('midSleep', +e.target.value)} />
            </label>
          </>
        ) : (
          <div className={s.dashed} style={{ border: 0, padding: 0 }}>
            <span>수면 기록을 넣으면 추천 시간대가 정교해져요</span>
            <button className={s.btnSm} style={{ border: '1.5px solid var(--pri)', color: 'var(--pri)', background: 'transparent' }} onClick={onEnableBio}>켜기</button>
          </div>
        )}
        <label className={s.field}>
          <span className={s.fieldRow}><span>오늘 일정 부담</span><b>{['가벼움', '보통', '빠듯함'][Math.min(2, Math.floor(st.bio.busy * 3))]}</b></span>
          <input type="range" min={0} max={0.99} step={0.05} value={st.bio.busy} onChange={(e) => set('busy', +e.target.value)} />
        </label>
      </div>
      <p className={s.note}>분량은 배낭 문제(DP)로 정해요. 슬롯 용량은 시간 × 준비도이고, 앞 쪽부터 순서대로 읽도록 가중치를 줘요.</p>
    </div>
  );
}
