'use client';
import { AXES } from '@/lib/boe/readability';
import type { Book } from '@/lib/boe/catalog';
import s from './boe.module.css';

const paths: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></>,
  quote: <path d="M4 4h16v12H8l-4 4z" />,
  check: <path d="M5 12l5 5 9-10" />,
};

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Cover({ book, small }: { book: Book; small?: boolean }) {
  if (small) return <span className={s.coverSm} style={{ background: book.color }} aria-hidden="true" />;
  return (
    <span className={s.cover} style={{ background: book.color }} aria-hidden="true">
      <span>{book.title}</span>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', fontWeight: 500, opacity: 0.75 }}>{book.author}</span>
    </span>
  );
}

/** 6축 문체 레이더. 값은 0~100 백분위. */
export function Radar({ scores, size = 168 }: { scores: number[]; size?: number }) {
  const c = 110, R = 80;
  const pt = (i: number, r: number) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
  };
  const ring = (r: number) => AXES.map((_, i) => pt(i, r)).join(' ');
  const label = AXES.map((a, i) => `${a} ${scores[i]}`).join(', ');
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" role="img" aria-label={`문체 레이더: ${label}`} style={{ flexShrink: 0 }}>
      <polygon points={ring(80)} fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <polygon points={ring(40)} fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <polygon points={scores.map((v, i) => pt(i, (v / 100) * R)).join(' ')} fill="var(--pri-2)" fillOpacity="0.18" stroke="var(--pri-2)" strokeWidth="2" />
      {AXES.map((a, i) => {
        const ang = (-90 + i * 60) * (Math.PI / 180);
        return (
          <text key={a} x={c + 98 * Math.cos(ang)} y={c + 98 * Math.sin(ang) + 4} textAnchor="middle" fontSize="12" fill="var(--sub)">
            {a}
          </text>
        );
      })}
    </svg>
  );
}

export function Nav({ tab, onTab }: { tab: string; onTab: (t: 'home' | 'explore' | 'schedule' | 'my') => void }) {
  const items = [
    ['home', '홈', 'home'], ['explore', '탐색', 'search'], ['schedule', '스케줄', 'cal'], ['my', 'MY', 'user'],
  ] as const;
  return (
    <nav className={s.nav} aria-label="앱 메뉴">
      {items.map(([id, label, icon]) => (
        <button key={id} className={`${s.navBtn} ${tab === id ? s.navOn : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)}>
          <Icon name={icon} size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}

/** 문항 보기를 늘 같은 순서로 섞는다 (정답이 항상 첫 번째가 되지 않게). */
export function shuffled<T>(arr: T[], seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const idx = arr.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
