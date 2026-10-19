// 한국어 문체·난이도 6축. 설계서 6.2절을 형태소 분석기 없이 근사한 버전이다.
// 원래는 Kiwi/Mecab-ko로 형태소를 나눠야 하지만, 브라우저에서 바로 돌리려고
// 어절·음절 길이와 접미사 목록으로 대신했다. 점수는 기준 코퍼스 대비 상대 위치(백분위)다.
import { normCdf } from './math';

export const AXES = ['어휘', '문장', '구문', '추상어', '응집', '용어'] as const;
export type Radar = { scores: number[]; lix: number; load: number; words: number };

const ABSTRACT = ['성', '론', '적', '주의', '화', '감', '력', '도', '관', '의식', '개념', '본질', '가치', '구조', '체계'];
const CONNECT = ['그러나', '하지만', '그래서', '따라서', '왜냐하면', '그런데', '또한', '즉', '만약', '비록', '-면서', '면서', '는데', '지만', '므로', '라면'];
const TERMS = ['우주', '은하', '원자', '분자', '유전자', '진화', '세포', '알고리즘', '함수', '데이터', '엔트로피', '양자', '상대성', '중력', '자본', '시장', '제도', '민주', '헌법', '광자', '단백질', '변수'];

// 기준 코퍼스(교양서 표본)의 평균과 표준편차. 실제 서비스라면 라벨셋으로 다시 맞춘다.
const BASE = {
  rare: { mu: 2.6, sd: 0.35 },   // 어절 평균 음절 수
  sent: { mu: 9, sd: 3.5 },      // 문장당 어절 수
  syn: { mu: 0.9, sd: 0.6 },     // 문장당 쉼표·연결어
  abs: { mu: 0.12, sd: 0.06 },   // 추상어 비율
  coh: { mu: 0.12, sd: 0.06 },   // 이웃 문장 음절 겹침
  term: { mu: 0.03, sd: 0.03 },  // 전문용어 밀도
};

const pct = (v: number, b: { mu: number; sd: number }) => Math.round(100 * normCdf((v - b.mu) / b.sd));

function bigrams(s: string) {
  const t = s.replace(/[^가-힣a-zA-Z0-9]/g, '');
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

const stripJosa = (w: string) => w.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터|처럼|보다)$/, '');

export function analyze(text: string): Radar {
  const sentences = text.split(/(?<=[.!?。…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).map((w) => w.replace(/[^가-힣a-zA-Z0-9-]/g, '')).filter(Boolean);
  const nW = Math.max(words.length, 1);
  const nS = Math.max(sentences.length, 1);
  const stems = words.map(stripJosa);

  const avgSyl = stems.reduce((s, w) => s + w.length, 0) / nW;
  const longRatio = stems.filter((w) => w.length >= 3).length / nW;
  const perSent = nW / nS;
  const syn = (text.match(/,|，/g)?.length ?? 0) / nS + words.filter((w) => CONNECT.some((c) => w.endsWith(c.replace('-', '')))).length / nS;
  const abs = stems.filter((w) => w.length >= 2 && ABSTRACT.some((x) => w.endsWith(x))).length / nW;
  let coh = 0;
  for (let i = 1; i < sentences.length; i++) {
    const a = bigrams(sentences[i - 1]), b = bigrams(sentences[i]);
    const inter = [...a].filter((x) => b.has(x)).length;
    coh += inter / Math.max(a.size + b.size - inter, 1);
  }
  coh = sentences.length > 1 ? coh / (sentences.length - 1) : BASE.coh.mu;
  const term = words.filter((w) => /[A-Za-z]{2,}|\d/.test(w) || TERMS.some((t) => w.includes(t))).length / nW;

  const scores = [
    pct(avgSyl, BASE.rare), pct(perSent, BASE.sent), pct(syn, BASE.syn),
    pct(abs, BASE.abs), pct(coh, BASE.coh), pct(term, BASE.term),
  ];
  // LIX 한국어 보정: 문장당 어절 + 100 × (3음절 이상 어간 비율)
  const lix = Math.round(perSent + 100 * longRatio);
  // 인지 부하 CL = w1·어휘 + w2·구문 + w3·용어 + w4·(100-응집)
  const load = Math.round(0.35 * scores[0] + 0.25 * scores[2] + 0.25 * scores[5] + 0.15 * (100 - scores[4]));
  return { scores, lix, load, words: words.length };
}

export const loadLabel = (cl: number) => (cl >= 66 ? '높음' : cl >= 40 ? '보통' : '낮음');

/** 예상 완독 시간(분) = 총어절 / (WPM × 난이도 보정 g(CL)) */
export function readMinutes(totalWords: number, wpm: number, load: number) {
  const g = 1.25 - load / 200; // 부하가 높을수록 느려진다 (0.75~1.25)
  return Math.round(totalWords / (wpm * g));
}
