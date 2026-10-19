'use client';
import { useState } from 'react';
import { bookById } from '@/lib/boe/catalog';
import { thetaToScore } from '@/lib/boe/irt';
import { FEATURES } from '@/lib/boe/bandit';
import { inverse, matVec } from '@/lib/boe/math';
import type { AppState } from '@/lib/boe/store';
import s from './boe.module.css';

type Consent = NonNullable<AppState['consent']>;
const DIMS = ['서정', '논증', '과학', '서사', '간결', '회고'];

export function My({ st, onConsent, onWipe, onOpen, onQuiz }: {
  st: AppState; onConsent: (c: Consent) => void; onWipe: () => void; onOpen: (id: string) => void; onQuiz: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const now = Date.now();
  const due = Object.entries(st.concepts).filter(([, c]) => new Date(c.due).getTime() <= now + 86400000);
  const weights = matVec(inverse(st.bandit.A), st.bandit.b);
  const c = st.consent!;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...st }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'book-of-the-end-내-데이터.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={s.screen}>
      <h1 className={s.h1}>MY</h1>
      <div className={s.stat}>
        <div className={s.statBox}><span className={s.note}>이해 수준</span><span className={s.statNum}>{thetaToScore(st.theta)}</span></div>
        <div className={s.statBox}><span className={s.note}>다 읽음</span><span className={s.statNum}>{st.shelf.filter((x) => x.status === '다 읽음').length}</span></div>
        <div className={s.statBox}><span className={s.note}>복습할 개념</span><span className={s.statNum}>{due.length}</span></div>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className={s.h2}>내 서재</h2>
        {st.shelf.length === 0 && <p className={s.sub}>아직 비어 있어요. 홈에서 책을 골라 예약해 보세요.</p>}
        <div className={s.list}>
          {st.shelf.map((x) => {
            const b = bookById(x.book);
            if (!b) return null;
            return (
              <button key={x.book} className={s.item} onClick={() => onOpen(x.book)}>
                <span className={s.coverSm} style={{ background: b.color }} aria-hidden="true" />
                <span className={s.itemMain}><span className={s.itemTitle}>{b.title}</span><span className={s.itemMeta}>{x.lib ?? '스케줄 등록'} · {new Date(x.at).toLocaleDateString('ko-KR')}</span></span>
                <span className={`${s.badge} ${x.status === '다 읽음' ? s.bMuted : x.status === '읽는 중' ? s.bBlue : s.bOrange}`}>{x.status}</span>
              </button>
            );
          })}
        </div>
      </section>

      {due.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className={s.h2}>오늘 복습</h2>
          <div className={s.chips}>
            {due.map(([name, cc]) => <button key={name} className={s.chip} onClick={() => onQuiz(cc.book)}>{name} · {bookById(cc.book)?.title}</button>)}
          </div>
        </section>
      )}

      <section className={s.card} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className={s.h2}>추천이 나를 보는 방식</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 10px', alignItems: 'center', fontSize: 13 }}>
          {DIMS.map((d, i) => (
            <Bar key={d} label={d} v={st.taste[i]} />
          ))}
        </div>
        <span className={s.note}>문체 취향 (0~1)</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 10px', alignItems: 'center', fontSize: 13 }}>
          {FEATURES.slice(1).map((f, i) => <Bar key={f} label={f} v={Math.max(0, Math.min(1, weights[i + 1]))} />)}
        </div>
        <span className={s.note}>추천에서 각 이유를 얼마나 무겁게 보는지 (밴딧이 {st.bandit.n}번 배운 값)</span>
      </section>

      <section className={s.card}>
        <h2 className={s.h2} style={{ marginBottom: 4 }}>동의 관리</h2>
        <label className={s.toggle}><span>맞춤 추천</span><input type="checkbox" checked={c.personalization} onChange={(e) => onConsent({ ...c, personalization: e.target.checked, at: new Date().toISOString() })} /></label>
        <label className={s.toggle}><span>위치</span><input type="checkbox" checked={c.location} onChange={(e) => onConsent({ ...c, location: e.target.checked, at: new Date().toISOString() })} /></label>
        <label className={s.toggle}><span>수면·리듬 기록 <span className={`${s.badge} ${s.bOrange}`}>민감</span></span><input type="checkbox" checked={c.bio} onChange={(e) => onConsent({ ...c, bio: e.target.checked, at: new Date().toISOString() })} /></label>
        <p className={s.note} style={{ marginTop: 8 }}>끄면 그 항목으로 만든 값도 바로 지워요. 마지막 변경 {new Date(c.at).toLocaleString('ko-KR')}</p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className={s.h2}>최근 기록</h2>
        <div className={s.card} style={{ padding: '6px 16px' }}>
          {st.log.slice(0, 8).map((e, i) => (
            <div key={i} className={s.libRow} style={{ fontSize: 13 }}>
              <span>{e.type}{e.book ? ` · ${bookById(e.book)?.title ?? e.book}` : ''}{e.detail ? ` · ${e.detail}` : ''}</span>
              <span className={s.note}>{new Date(e.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
          {st.log.length === 0 && <p className={s.note} style={{ padding: '8px 0' }}>아직 기록이 없어요.</p>}
        </div>
      </section>

      <section className={s.actions}>
        <button className={s.btnGhost} onClick={exportJson}>내 데이터 내보내기</button>
        {confirm
          ? <button className={s.btn} style={{ background: 'var(--acc-soft)', color: 'var(--acc-ink)', border: '1.5px solid var(--acc)' }} onClick={onWipe}>정말 모두 지우기</button>
          : <button className={s.btnGhost} onClick={() => setConfirm(true)}>모두 지우기</button>}
      </section>
      <p className={s.note}>모든 데이터는 이 브라우저에만 있어요. 서버로 보내지 않아요. 책 재고와 도서관 위치는 시연용 샘플이에요.</p>
      <a href="https://d1pengh4-log.vercel.app/projects/book-of-the-end" target="_blank" rel="noreferrer" className={s.btnLink} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }}>프로젝트 설명 보기</a>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <>
      <span>{label}</span>
      <span className={s.meter}><span className={s.meterFill} style={{ display: 'block', width: `${Math.round(v * 100)}%` }} /></span>
      <span className={s.note}>{v.toFixed(2)}</span>
    </>
  );
}
