'use client';
import { useMemo, useState } from 'react';
import { STYLE_CARDS, VOCAB, type VocabItem } from '@/lib/boe/catalog';
import { eap, nextItem, shouldStop, thetaToScore, type Answer } from '@/lib/boe/irt';
import type { AppState } from '@/lib/boe/store';
import { shuffled } from './ui';
import s from './boe.module.css';

type Consent = NonNullable<AppState['consent']>;

/** 0단계: 목적별 동의. 필수와 선택을 나누고, 14세 미만이면 위치·생체 기능을 끈다. */
export function ConsentStep({ onDone }: { onDone: (c: Consent) => void }) {
  const [adult, setAdult] = useState<boolean | null>(null);
  const [c, setC] = useState({ personalization: true, location: false, bio: false });
  const minor = adult === false;
  return (
    <div className={s.screen}>
      <div className={s.steps} aria-hidden="true"><span className={`${s.step} ${s.stepOn}`} /><span className={s.step} /><span className={s.step} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className={s.label}>시작하기 전에</div>
        <h1 className={s.h1}>읽을 책을 고르고,<br />빌리고, 끝까지 읽기</h1>
        <p className={s.sub}>추천에 쓰는 정보는 모두 이 기기 안에만 저장돼요. 서버로 보내지 않아요. 언제든 MY에서 끄거나 지울 수 있어요.</p>
      </div>
      <fieldset className={s.card} style={{ margin: 0 }}>
        <legend className={s.label} style={{ padding: '0 4px' }}>나이 확인</legend>
        <div className={s.actions} style={{ marginTop: 6 }}>
          <button className={adult === true ? s.btn : s.btnGhost} aria-pressed={adult === true} onClick={() => setAdult(true)}>만 14세 이상</button>
          <button className={adult === false ? s.btn : s.btnGhost} aria-pressed={adult === false} onClick={() => { setAdult(false); setC((x) => ({ ...x, location: false, bio: false })); }}>만 14세 미만</button>
        </div>
        {minor && <p className={s.note} style={{ marginTop: 10 }}>만 14세 미만은 보호자 동의가 필요해요. 이 데모에서는 위치와 수면 기능을 끈 채로 시작해요.</p>}
      </fieldset>
      <div className={s.card}>
        <label className={s.toggle}>
          <span><b>맞춤 추천</b> <span className={s.badge + ' ' + s.bMuted}>선택</span><br /><span className={s.note}>고른 문체와 반응으로 추천 순서를 정해요</span></span>
          <input type="checkbox" checked={c.personalization} onChange={(e) => setC({ ...c, personalization: e.target.checked })} />
        </label>
        <label className={s.toggle}>
          <span><b>위치</b> <span className={s.badge + ' ' + s.bMuted}>선택</span><br /><span className={s.note}>가까운 도서관을 거리순으로 보여 줘요</span></span>
          <input type="checkbox" disabled={minor} checked={c.location} onChange={(e) => setC({ ...c, location: e.target.checked })} />
        </label>
        <label className={s.toggle}>
          <span><b>수면·리듬 기록</b> <span className={s.badge + ' ' + s.bOrange}>민감 · 선택</span><br /><span className={s.note}>직접 적은 수면 기록으로 읽기 좋은 시간을 추정해요</span></span>
          <input type="checkbox" disabled={minor} checked={c.bio} onChange={(e) => setC({ ...c, bio: e.target.checked })} />
        </label>
      </div>
      <div style={{ flexGrow: 1 }} />
      <button className={s.btn} disabled={adult === null} onClick={() => onDone({ ...c, at: new Date().toISOString() })}>
        {adult === null ? '나이를 먼저 골라 주세요' : '동의하고 시작'}
      </button>
    </div>
  );
}

/** 1단계: 문체 카드 → 취향 벡터 u0 = 고른 카드 벡터의 평균 */
export function StyleStep({ onDone, onSkip }: { onDone: (taste: number[]) => void; onSkip: () => void }) {
  const [on, setOn] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOn((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const done = () => {
    const picked = [...on].map((i) => STYLE_CARDS[i].vec);
    onDone(picked[0].map((_, k) => picked.reduce((sum, v) => sum + v[k], 0) / picked.length));
  };
  return (
    <div className={s.screen}>
      <div className={s.steps} aria-hidden="true"><span className={`${s.step} ${s.stepOn}`} /><span className={`${s.step} ${s.stepOn}`} /><span className={s.step} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className={s.label}>1단계 · 문체 고르기</div>
        <h1 className={s.h1}>끌리는 문장을<br />골라 주세요</h1>
        <p className={s.sub} aria-live="polite">3개 이상 고르면 첫 추천이 시작돼요. 지금 {on.size}개.</p>
      </div>
      <div className={s.cards}>
        {STYLE_CARDS.map((c, i) => (
          <button key={c.text} className={s.styleCard} aria-pressed={on.has(i)} onClick={() => toggle(i)}>
            <span className={s.styleText}>{c.text}</span>
            <span className={s.styleTag}>{c.tag}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        <button className={s.btn} style={{ width: '100%' }} disabled={on.size < 3} onClick={done}>다음 · 짧은 어휘 확인</button>
        <button className={s.btnLink} onClick={onSkip}>건너뛰기 (기본 취향으로 시작)</button>
      </div>
    </div>
  );
}

/** 2단계: 어휘 적응형 평가 (3PL + EAP + 최대 정보량 출제, 7~12문항) */
export function VocabStep({ onDone }: { onDone: (theta: number, se: number) => void }) {
  const bank = useMemo(() => new Map(VOCAB.map((v) => [v.id, v])), []);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const est = eap(answers, bank);
  const used = new Set(answers.map((a) => a.id));
  const [current, setCurrent] = useState<VocabItem>(() => nextItem(0, VOCAB, new Set())!);
  const finished = shouldStop(answers.length, est.se) || used.size >= VOCAB.length;
  const order = shuffled(current.options, current.id);

  const answer = (choice: number | null) => {
    const next = [...answers, { id: current.id, correct: choice === current.answer }];
    setAnswers(next);
    const e = eap(next, bank);
    const u = new Set(next.map((a) => a.id));
    if (!shouldStop(next.length, e.se) && u.size < VOCAB.length) setCurrent(nextItem(e.theta, VOCAB, u)!);
  };

  if (finished) {
    return (
      <div className={s.screen}>
        <div className={s.steps} aria-hidden="true"><span className={`${s.step} ${s.stepOn}`} /><span className={`${s.step} ${s.stepOn}`} /><span className={`${s.step} ${s.stepOn}`} /></div>
        <div className={s.label}>2단계 · 결과</div>
        <h1 className={s.h1}>어휘 수준 {thetaToScore(est.theta)}점</h1>
        <p className={s.sub}>{answers.length}문항으로 추정했어요 (θ {est.theta.toFixed(2)}, 오차 ±{est.se.toFixed(2)}). 이 값에 맞춰 너무 쉽지도 어렵지도 않은 책을 먼저 보여 줄게요. 책을 읽고 퀴즈를 풀 때마다 다시 맞춰져요.</p>
        <div className={s.meter} aria-hidden="true"><div className={s.meterFill} style={{ width: `${thetaToScore(est.theta)}%` }} /></div>
        <div style={{ flexGrow: 1 }} />
        <button className={s.btn} onClick={() => onDone(est.theta, est.se)}>추천 받으러 가기</button>
      </div>
    );
  }

  return (
    <div className={s.screen}>
      <div className={s.steps} aria-hidden="true"><span className={`${s.step} ${s.stepOn}`} /><span className={`${s.step} ${s.stepOn}`} /><span className={s.step} /></div>
      <div className={s.row}>
        <span className={s.label}>2단계 · 어휘 확인 {answers.length + 1}번째</span>
        <span className={s.note}>7~12문항</span>
      </div>
      <h1 className={s.question}>‘{current.word}’의 뜻으로 알맞은 것은?</h1>
      <div className={s.options}>
        {order.map((oi, k) => (
          <button key={oi} className={s.option} onClick={() => answer(oi)}>
            <span className={s.optKey}>{'ABCD'[k]}</span>
            <span>{current.options[oi]}</span>
          </button>
        ))}
      </div>
      <button className={s.btnLink} onClick={() => answer(null)}>잘 모르겠어요</button>
      <p className={s.note}>맞히면 조금 어려운 문항이, 틀리면 조금 쉬운 문항이 나와요. 점수가 아니라 책 난이도를 맞추는 데만 써요.</p>
    </div>
  );
}
