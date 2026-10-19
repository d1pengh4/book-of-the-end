'use client';
import { useEffect, useRef, useState } from 'react';
import { EVIDENCE, HOME, bookById, type Book } from '@/lib/boe/catalog';
import { analysisOf, fmtMin, librariesFor, minutesOf, type FeedEntry } from '@/lib/boe/recommend';
import { loadLabel } from '@/lib/boe/readability';
import type { LatLng, Ranked } from '@/lib/boe/gis';
import type { AppState } from '@/lib/boe/store';
import { Cover, Icon, Radar } from './ui';
import s from './boe.module.css';

/** 사용자와 도서관의 상대 위치를 그린 작은 지도 (지도 API 대신 쓰는 폴백) */
function MiniMap({ me, libs, pick }: { me: LatLng; libs: Ranked[]; pick?: string }) {
  const maxKm = Math.max(2, ...libs.map((l) => l.km));
  const xy = (p: LatLng) => {
    const dx = (p.lng - me.lng) * 90.5; // 위도 36도에서 경도 1도 ≈ 90km
    const dy = (p.lat - me.lat) * 111;
    return { x: 50 + (dx / maxKm) * 44, y: 50 - (dy / maxKm) * 40 };
  };
  return (
    <div className={s.map}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`도서관 ${libs.length}곳의 위치. 가장 가까운 곳은 ${libs[0]?.name}`}>
        {[15, 30, 45].map((r) => <ellipse key={r} cx="50" cy="50" rx={r} ry={r * 0.9} fill="none" stroke="var(--line)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />)}
        {libs.map((l) => {
          const p = xy(l.pos);
          const on = l.code === pick;
          return <circle key={l.code} cx={p.x} cy={p.y} r={on ? 3.2 : 2.2} fill={l.status === '대출 가능' ? 'var(--pri-2)' : l.status === '예약 가능' ? 'var(--acc)' : 'var(--sub)'} stroke="var(--card)" strokeWidth="0.8" />;
        })}
        <circle cx="50" cy="50" r="2.6" fill="var(--ink)" />
      </svg>
      <span className={s.note} style={{ position: 'absolute', left: 10, bottom: 6 }}>● 나 · 파랑 대출 가능 · 주황 예약 가능 · 반경 {maxKm.toFixed(0)}km</span>
    </div>
  );
}

export function Detail({ st, entry, pos, hour, onClose, onReserve, onStart, onQuiz, onDwell, onOpen }: {
  st: AppState; entry: FeedEntry; pos: LatLng | null; hour: number;
  onClose: () => void; onReserve: (lib: Ranked) => void; onStart: () => void; onQuiz: () => void; onDwell: () => void; onOpen: (id: string) => void;
}) {
  const b: Book = entry.book;
  const a = analysisOf(b);
  const libs = librariesFor(b.id, pos, hour);
  const held = libs.filter((l) => l.status !== '소장 안 함');
  const [pick, setPick] = useState<string | undefined>(held[0]?.code);
  const shelf = st.shelf.find((x) => x.book === b.id);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 30초 넘게 보면 관심 보상을 한 번 준다
  useEffect(() => {
    closeRef.current?.focus();
    const t = setTimeout(onDwell, 30000);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { clearTimeout(t); window.removeEventListener('keydown', esc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id]);

  const chosen = held.find((l) => l.code === pick);
  const hasQuiz = (EVIDENCE[b.id]?.length ?? 0) >= 2;

  return (
    <div className={s.sheet} role="dialog" aria-modal="true" aria-label={`${b.title} 상세`}>
      <div className={s.screen} style={{ paddingBottom: 8 }}>
        <div className={s.top}>
          <button ref={closeRef} className={s.iconBtn} aria-label="닫기" onClick={onClose}><Icon name="back" /></button>
          <span className={s.note}>{b.genre}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <Cover book={b} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 className={s.h1}>{b.title}</h1>
            <span className={s.sub}>{b.author} · 약 {b.pages}쪽 · 예상 완독 {fmtMin(minutesOf(b, st.wpm))}</span>
          </div>
        </div>

        {entry.reasons.length > 0 && (
          <div className={s.chips} aria-label="추천 근거">
            {entry.reasons.map((x) => <span key={x.label} className={s.chip}>{x.label} {x.value.toFixed(2)}</span>)}
          </div>
        )}

        <div className={s.card}>
          <div className={s.radarWrap}>
            <Radar scores={a.scores} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <b>인지 부하 <span style={{ color: 'var(--acc)' }}>{loadLabel(a.load)}</span> ({a.load})</b>
              <span className={s.note}>소개 문단을 기준 코퍼스와 비교한 상대 위치예요. 절대 등급이 아니에요.</span>
              <b>한국어 LIX {a.lix}</b>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={s.label}>어떤 책인가요</div>
          <p className={s.quote}>{b.blurb}</p>
          <span className={s.note}>본문은 저작권 때문에 싣지 않아요. 출판사 허가 발췌가 있으면 이 자리에 보여 줘요.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={s.row}><span className={s.label}>가까운 도서관</span><span className={s.note}>샘플 재고</span></div>
          <MiniMap me={pos ?? HOME} libs={held} pick={pick} />
          <div className={s.card} style={{ padding: '4px 16px' }} role="radiogroup" aria-label="도서관 고르기">
            {held.map((l) => (
              <div key={l.code} className={s.libRow}>
                <button className={s.libPick} role="radio" aria-checked={pick === l.code} onClick={() => setPick(l.code)}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{pick === l.code ? '● ' : ''}{l.name}</span>
                  <span className={s.itemMeta}>{l.km.toFixed(1)}km · {l.eta.mode} {l.eta.min}분 · 확률 {Math.round(l.p * 100)}%{l.openNow ? '' : ' · 지금 닫힘'}</span>
                </button>
                <span className={`${s.badge} ${l.status === '대출 가능' ? s.bBlue : s.bOrange}`}>{l.status}</span>
              </div>
            ))}
            {held.length === 0 && <p className={s.sub} style={{ padding: '10px 0' }}>근처에 소장한 곳이 없어요. 상호대출(수령까지 약 2~3일)이나 전자책을 찾아볼 수 있어요.</p>}
          </div>
          {!st.consent?.location && <span className={s.note}>위치가 꺼져 있어 {HOME.label} 기준으로 계산했어요.</span>}
        </div>

        {b.next.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className={s.label}>다 읽고 나면</div>
            <div className={s.chips}>
              {b.next.map((id) => <button key={id} className={s.chip} onClick={() => onOpen(id)}>{bookById(id)?.title} →</button>)}
            </div>
          </div>
        )}
      </div>

      <div className={s.bottomBar}>
        {shelf ? (
          <div className={s.actions}>
            <button className={s.btnGhost} onClick={onStart}>{shelf.status === '읽는 중' ? '스케줄 보기' : '읽기 시작'}</button>
            <button className={s.btn} onClick={onQuiz}>{hasQuiz ? '이해 확인 퀴즈' : '퀴즈 (근거 확인)'}</button>
          </div>
        ) : (
          <div className={s.actions}>
            <button className={s.btnGhost} onClick={onStart}>스케줄 등록</button>
            <button className={s.btn} disabled={!chosen} onClick={() => chosen && onReserve(chosen)}>{chosen?.status === '예약 가능' ? '예약 걸기' : '대출 예약'}</button>
          </div>
        )}
        {shelf && <span className={s.note} style={{ textAlign: 'center' }}>{shelf.status}{shelf.lib ? ` · ${shelf.lib}` : ''}</span>}
      </div>
    </div>
  );
}
