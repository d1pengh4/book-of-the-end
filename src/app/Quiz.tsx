'use client';
import { useMemo, useState } from 'react';
import { BLOOM, EVIDENCE, bookById, gatedItems, type QuizItem } from '@/lib/boe/catalog';
import { eap, nextItem, thetaToScore, type Answer } from '@/lib/boe/irt';
import type { AppState } from '@/lib/boe/store';
import { Icon, shuffled } from './ui';
import s from './boe.module.css';

const MAX = 5;

export function Quiz({ st, bookId, onClose, onAnswer, onFinish, onOpen }: {
  st: AppState; bookId: string; onClose: () => void;
  onAnswer: (item: QuizItem, correct: boolean) => void;
  onFinish: (theta: number, se: number, answers: Answer[]) => void;
  onOpen: (id: string) => void;
}) {
  const book = bookById(bookId)!;
  const gate = useMemo(() => gatedItems(bookId), [bookId]);
  const bank = useMemo(() => new Map(gate.items.map((q) => [q.id, q])), [gate]);
  const prior = st.theta;
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<QuizItem | undefined>(() => gate.ok ? nextItem(prior, gate.items, new Set()) : undefined);
  const [picked, setPicked] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const est = eap(answers, bank, prior, 1);

  const close = (
    <div className={s.top}>
      <button className={s.iconBtn} aria-label="닫기" onClick={onClose}><Icon name="close" /></button>
      <span className={s.note}>{book.title}{gate.ok && !done ? ` · ${Math.min(answers.length + (shown ? 0 : 1), MAX)} / ${Math.min(MAX, gate.items.length)}` : ''}</span>
    </div>
  );

  // 근거 게이트: 근거 청크가 모자라면 문항을 만들지 않는다
  if (!gate.ok) {
    return (
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="이해 확인">
        <div className={s.screen}>
          {close}
          <span className={`${s.badge} ${s.bMuted}`} style={{ alignSelf: 'flex-start' }}>근거 부족</span>
          <h1 className={s.h1}>이 책은 아직 퀴즈를 만들 수 없어요</h1>
          <p className={s.sub}>문항은 확인된 근거 문단을 인용할 때만 만들어요. 「{book.title}」은 허가된 근거 문단이 없어서, 그럴듯한 문제를 지어내는 대신 멈췄어요.</p>
          <div className={s.card}><p className={s.note}>퀴즈가 있는 책: {Object.keys(EVIDENCE).map((id) => bookById(id)?.title).join(', ')}</p></div>
          <div className={s.chips}>{Object.keys(EVIDENCE).map((id) => <button key={id} className={s.chip} onClick={() => onOpen(id)}>{bookById(id)?.title}</button>)}</div>
        </div>
      </div>
    );
  }

  if (done || !current) {
    const correct = answers.filter((a) => a.correct).length;
    const next = book.next.map(bookById).filter(Boolean);
    const wrongConcepts = answers.filter((a) => !a.correct).map((a) => bank.get(a.id)?.concept).filter(Boolean);
    return (
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label="퀴즈 결과">
        <div className={s.screen}>
          {close}
          <div className={s.label}>결과</div>
          <h1 className={s.h1}>{answers.length}문제 중 {correct}개</h1>
          <div className={s.stat}>
            <div className={s.statBox}><span className={s.note}>이해 수준</span><span className={s.statNum}>{thetaToScore(est.theta)}</span></div>
            <div className={s.statBox}><span className={s.note}>이전</span><span className={s.statNum}>{thetaToScore(prior)}</span></div>
            <div className={s.statBox}><span className={s.note}>오차</span><span className={s.statNum}>±{est.se.toFixed(1)}</span></div>
          </div>
          {wrongConcepts.length > 0 && <p className={s.sub}>다시 볼 개념: <b>{[...new Set(wrongConcepts)].join(', ')}</b>. 내일 복습 목록에 넣어 둘게요.</p>}
          {next.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className={s.label}>다음에 읽을 책</div>
              {next.map((b) => (
                <button key={b!.id} className={s.item} onClick={() => onOpen(b!.id)}>
                  <span className={s.coverSm} style={{ background: b!.color }} aria-hidden="true" />
                  <span className={s.itemMain}><span className={s.itemTitle}>{b!.title}</span><span className={s.itemMeta}>{b!.author} · 이어서 깊게</span></span>
                </button>
              ))}
            </div>
          )}
          <div style={{ flexGrow: 1 }} />
          <button className={s.btn} onClick={() => { onFinish(est.theta, est.se, answers); onClose(); }}>저장하고 닫기</button>
        </div>
      </div>
    );
  }

  const order = shuffled(current.options, current.id);
  const right = picked === current.answer;
  const submit = () => {
    if (picked === null) return;
    setShown(true);
    setAnswers((a) => [...a, { id: current.id, correct: right }]);
    onAnswer(current, right);
  };
  const advance = () => {
    const used = new Set(answers.map((a) => a.id));
    const e = eap(answers, bank, prior, 1);
    setPicked(null); setShown(false);
    if (answers.length >= MAX || used.size >= gate.items.length) { setDone(true); return; }
    setCurrent(nextItem(e.theta, gate.items, used));
  };

  return (
    <div className={s.sheet} role="dialog" aria-modal="true" aria-label="이해 확인 퀴즈">
      <div className={s.screen}>
        {close}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className={s.row}><span className={s.note}>이해 수준 추정</span><span className={s.note}>{thetaToScore(est.theta)}</span></div>
          <div className={s.meter} aria-hidden="true"><div className={s.meterFill} style={{ width: `${thetaToScore(est.theta)}%` }} /></div>
        </div>
        <div className={s.chips}>
          <span className={`${s.badge} ${s.bOrange}`}>{BLOOM[current.bloom]}</span>
          <span className={s.chip} style={{ padding: '4px 10px', fontSize: 12 }}>Bloom {current.bloom}단계</span>
        </div>
        <h1 className={s.question}>{current.q}</h1>
        <div className={s.options} role="radiogroup" aria-label="보기">
          {order.map((oi, k) => {
            const cls = shown ? (oi === current.answer ? s.optRight : oi === picked ? s.optWrong : '') : '';
            return (
              <button key={oi} role="radio" aria-checked={picked === oi} aria-pressed={picked === oi} disabled={shown} className={`${s.option} ${cls}`} onClick={() => setPicked(oi)}>
                <span className={s.optKey}>{'ABCD'[k]}</span>
                <span>{current.options[oi]}</span>
              </button>
            );
          })}
        </div>
        {shown && (
          <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b>{right ? '맞았어요' : '아쉬워요. 근거를 같이 볼까요?'}</b>
            {current.cites.map((c) => <p key={c} className={s.evidence}>[{c}] {EVIDENCE[bookId].find((e) => e.id === c)?.text}</p>)}
          </div>
        )}
        <span className={s.note} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="quote" size={14} />근거: {current.cites.join(', ')} · 근거 문단을 인용한 예시 문항</span>
      </div>
      <div className={s.bottomBar}>
        {shown
          ? <button className={s.btn} onClick={advance}>{answers.length >= MAX || answers.length >= gate.items.length ? '결과 보기' : '다음 문제'}</button>
          : <button className={s.btn} disabled={picked === null} onClick={submit}>{picked === null ? '답을 골라 주세요' : '제출하기'}</button>}
      </div>
    </div>
  );
}
