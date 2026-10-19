'use client';
import { useMemo, useState } from 'react';
import { BOOKS, HOME } from '@/lib/boe/catalog';
import { analysisOf, fmtMin, minutesOf, type FeedEntry } from '@/lib/boe/recommend';
import { loadLabel } from '@/lib/boe/readability';
import type { Context } from '@/lib/boe/bandit';
import type { AppState } from '@/lib/boe/store';
import { Cover, Icon } from './ui';
import s from './boe.module.css';

const hourLabel = (h: number) => `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시`;

export function Home({ st, feed, ctx, located, onOpen, onRefresh }: {
  st: AppState; feed: FeedEntry[]; ctx: Context; located: boolean;
  onOpen: (id: string) => void; onRefresh: () => void;
}) {
  const [hero, ...rest] = feed;
  const r = ctx.readiness;
  const mood = r > 0.66 ? '집중하기 좋은 시간대로 추정돼요' : r > 0.4 ? '가볍게 읽기 좋은 시간대예요' : '짧고 쉬운 책이 어울리는 시간이에요';
  const reading = st.shelf.find((x) => x.status !== '다 읽음');
  return (
    <div className={s.screen}>
      <div className={s.top}>
        <span className={s.loc}><Icon name="pin" size={14} />{located ? '현재 위치 기준' : HOME.label}{!st.consent?.location && ' · 위치 꺼짐'}</span>
        <button className={s.iconBtn} aria-label="추천 새로 고르기" onClick={onRefresh}><Icon name="refresh" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className={s.kicker}>{hourLabel(ctx.hour)} · {mood}</div>
        <h1 className={s.h1}>지금 {st.sessionMin}분 동안<br />읽기 좋은 책</h1>
      </div>

      {reading && (
        <div className={s.dashed}>
          <span>읽는 중 · <b>{BOOKS.find((b) => b.id === reading.book)?.title}</b></span>
          <button className={s.btnSm} style={{ background: 'var(--card)', border: '1px solid var(--line)' }} onClick={() => onOpen(reading.book)}>이어서</button>
        </div>
      )}

      {hero && (
        <button className={s.hero} onClick={() => onOpen(hero.id)} aria-label={`${hero.book.title} 자세히 보기`}>
          <div className={s.heroBody}>
            <Cover book={hero.book} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{hero.book.genre}</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{hero.book.title}</span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>{hero.book.author}</span>
              <span className={s.chips} style={{ marginTop: 4, gap: 6 }}>
                <span className={s.heroChip}>예상 {fmtMin(minutesOf(hero.book, st.wpm))}</span>
                <span className={s.heroChip}>부하 {loadLabel(analysisOf(hero.book).load)}</span>
              </span>
            </div>
          </div>
          <div className={s.heroFoot}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{hero.lib ? `${hero.lib.name} · ${hero.lib.status}` : '근처 소장 없음 · 상호대출'}</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{hero.lib ? `${hero.lib.km.toFixed(1)}km · ${hero.lib.eta.mode} 약 ${hero.lib.eta.min}분 · 확률 ${Math.round(hero.lib.p * 100)}%` : '전자책 대안을 찾아볼게요'}</span>
            </span>
            <span className={s.btnSm} style={{ background: 'var(--hero-fg)', color: 'var(--hero)', display: 'inline-flex', alignItems: 'center' }}>자세히</span>
          </div>
        </button>
      )}

      {hero && hero.reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={s.label}>왜 이 책인가요?</div>
          <div className={s.chips}>
            {hero.reasons.map((x) => <span key={x.label} className={s.chip}>{x.label} {x.value.toFixed(2)}</span>)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className={s.row}>
          <h2 className={s.h2}>다음 후보</h2>
          <span className={s.note}>비슷한 책만 모이지 않게 섞었어요</span>
        </div>
        <div className={s.list}>
          {rest.map((f) => (
            <button key={f.id} className={s.item} onClick={() => onOpen(f.id)}>
              <Cover book={f.book} small />
              <span className={s.itemMain}>
                <span className={s.itemTitle}>{f.book.title}</span>
                <span className={s.itemMeta}>{f.book.author} · {f.lib ? f.lib.status : '상호대출'}</span>
              </span>
              <span className={s.itemSide}>{f.lib ? `${f.lib.km.toFixed(1)}km` : '—'}</span>
            </button>
          ))}
        </div>
      </div>
      <p className={s.note}>추천은 고른 문체, 어휘 수준, 시간대, 도서관 재고를 섞어 정해요. 책을 열어 보고 예약할수록 순서가 내게 맞춰져요. (학습 {st.bandit.n}회)</p>
    </div>
  );
}

export function Explore({ st, onOpen }: { st: AppState; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('전체');
  const genres = useMemo(() => ['전체', ...new Set(BOOKS.map((b) => b.genre))], []);
  const list = BOOKS.filter((b) => (genre === '전체' || b.genre === genre) && (!q || `${b.title} ${b.author}`.includes(q.trim())));
  return (
    <div className={s.screen}>
      <h1 className={s.h1}>탐색</h1>
      <label className={s.field}>
        <span className={s.label}>제목이나 저자</span>
        <input className={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 한강, 코스모스" type="search" />
      </label>
      <div className={s.chips} role="group" aria-label="분야">
        {genres.map((g) => (
          <button key={g} className={s.btnSm} aria-pressed={genre === g} onClick={() => setGenre(g)}
            style={genre === g ? { background: 'var(--pri)', color: 'var(--pri-fg)' } : { background: 'var(--card)', border: '1px solid var(--line)' }}>{g}</button>
        ))}
      </div>
      <div className={s.list}>
        {list.map((b) => {
          const a = analysisOf(b);
          const fit = Math.abs(b.difficulty - st.theta) < 0.8;
          return (
            <button key={b.id} className={s.item} onClick={() => onOpen(b.id)}>
              <Cover book={b} small />
              <span className={s.itemMain}>
                <span className={s.itemTitle}>{b.title}</span>
                <span className={s.itemMeta}>{b.author} · {b.genre} · LIX {a.lix} · 약 {fmtMin(minutesOf(b, st.wpm))}</span>
              </span>
              <span className={`${s.badge} ${fit ? s.bBlue : b.difficulty > st.theta ? s.bOrange : s.bMuted}`}>{fit ? '난이도 적합' : b.difficulty > st.theta ? '도전' : '가벼움'}</span>
            </button>
          );
        })}
        {list.length === 0 && <p className={s.sub}>찾는 책이 없어요. 데모에는 {BOOKS.length}권만 들어 있어요.</p>}
      </div>
    </div>
  );
}
