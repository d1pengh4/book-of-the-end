// 6.2 NLP 문체·난이도 스케일링 — 한국어 보정 LIX + 6축 레이더 + 인지부하 + 예상 완독시간
// 데모 구현: 형태소 분석기(Kiwi/Mecab) 대신 조사·어미 사전 기반 경량 분석을 사용한다.
import { normCdf, mean, std } from './math.js';

const JOSA = ['으로부터', '에게서', '로부터', '에서는', '에서도', '이라고', '라고', '으로', '에서', '에게', '까지', '부터', '처럼', '보다', '마다', '조차', '이나', '이며', '하고', '과', '와', '은', '는', '이', '가', '을', '를', '의', '에', '도', '만', '로', '나', '야'];
const ENDINGS = ['인가요', '었나요', '았나요', '나요', '까요', '는가', '가요', '었습니다', '았습니다', '습니다', 'ㅂ니다', '었다', '았다', '였다', '한다', '이다', '했다', '된다', '는다', '었고', '았고', '하고', '하며', '이며', '지만', '는데', '면서', '아서', '어서', '므로', '니까', '다', '고', '며', '면', '서'];
const CONNECTIVES = ['고', '며', '지만', '는데', '면서', '아서', '어서', '므로', '니까', '도록', '려고', '든지', '거나', '다가', '자마자'];
const ABSTRACT_SUFFIX = ['성', '론', '화', '감', '력', '의식', '개념', '관념', '본질', '구조', '원리', '가치', '존재', '체계', '현상', '의미', '자유', '정의'];
const JARGON = ['핵융합', '초신성', '중력', '스펙트럼', '분자', '원소', '은하', '광년', '엔트로피', '양자', '상대성', '시공간', '알고리즘', '데이터', '유전자', '단백질', '세포', '진화', '확률', '함수', '변수', '경제', '인플레이션', '민주주의', '헌법', '형이상학', '인식론', '대수', '미분', '적분', '방정식'];
// 고빈도 어간 (데모용 축약 빈도표: 상대빈도, 1=최다)
const FREQ = { 나: 1, 그: 1, 것: 1, 수: 1, 있: 1, 하: 1, 없: 1, 사람: 2, 때: 2, 말: 2, 우리: 2, 집: 3, 날: 3, 길: 3, 밤: 3, 눈: 3, 마음: 3, 시간: 3, 엄마: 4, 아이: 3, 물: 3, 별: 4, 하늘: 4, 바다: 4, 문: 3, 손: 3, 얼굴: 4, 이야기: 4, 세상: 4, 생각: 3, 오늘: 3, 다시: 2, 아주: 3, 정말: 3 };

export function splitSentences(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.?!。…])\s+|(?<=[다요죠][.!?]?)\s*\n/).map((s) => s.trim()).filter((s) => s.length > 1);
}
export const eojeols = (s) => s.split(/\s+/).map((w) => w.replace(/[“”"'‘’(),.?!·…:;\[\]]/g, '')).filter(Boolean);

const STOP = new Set(['무엇', '어디', '어디서', '왜', '어떻게', '누가', '언제', '어떤', '무슨', '이', '그', '저']);
export const isStop = (w) => STOP.has(w);
export function stem(word) {
  let w = word;
  for (const e of ENDINGS) if (w.length > e.length + 1 && w.endsWith(e)) { w = w.slice(0, -e.length); break; }
  for (const j of JOSA) if (w.length > j.length && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
  return w;
}
const hangulLen = (w) => (w.match(/[가-힣]/g) || []).length;

// 한국어 보정 LIX: 단어→어절, 긴 단어→조사 제거 어간 4음절 이상(한자어·복합명사 근사)
export function koreanLix(text) {
  const sents = splitSentences(text);
  const words = sents.flatMap(eojeols);
  if (!words.length) return 0;
  const long = words.filter((w) => hangulLen(stem(w)) >= 4 || /[A-Za-z]{7,}/.test(w)).length;
  return words.length / sents.length + (100 * long) / words.length;
}

function bigrams(s) {
  const v = new Map();
  const t = s.replace(/\s+/g, '');
  for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); v.set(g, (v.get(g) || 0) + 1); }
  return v;
}
function bigramCos(a, b) {
  const A = bigrams(a), B = bigrams(b);
  let d = 0, na = 0, nb = 0;
  for (const [, x] of A) na += x * x;
  for (const [, x] of B) nb += x * x;
  for (const [g, x] of A) if (B.has(g)) d += x * B.get(g);
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

// 원시 특징 f1..f6
export function rawFeatures(text) {
  const sents = splitSentences(text);
  const words = sents.flatMap(eojeols);
  const stems = words.map(stem).filter(Boolean);
  const n = Math.max(words.length, 1);
  // f1 어휘 희소도: −mean(log freq) — 빈도표에 없으면 음절수 기반 희귀도 가정
  const f1 = mean(stems.map((s) => Math.log(FREQ[s] ? FREQ[s] : 4 + Math.min(hangulLen(s), 6) * 1.6)));
  // f2 문장 길이(평균 어절수)
  const lens = sents.map((s) => eojeols(s).length);
  const f2 = mean(lens);
  // f3 구문 복잡도 근사: 문장당 연결어미·쉼표·관형절 수 (의존트리 깊이 대용)
  const f3 = mean(sents.map((s) => eojeols(s).filter((w) => CONNECTIVES.some((c) => w.endsWith(c) && w.length > c.length)).length + (s.match(/,/g) || []).length));
  // f4 추상어 비율
  const f4 = stems.filter((s) => ABSTRACT_SUFFIX.some((x) => s.endsWith(x) && s.length > x.length) || ABSTRACT_SUFFIX.includes(s)).length / n;
  // f5 담화 응집도: 인접 문장 바이그램 코사인 평균
  const f5 = sents.length > 1 ? mean(sents.slice(1).map((s, i) => bigramCos(sents[i], s))) : 0.3;
  // f6 전문용어 밀도
  const f6 = stems.filter((s) => JARGON.some((j) => s.includes(j))).length / n;
  return { f1, f2, f3, f4, f5, f6, sentences: sents.length, words: words.length, lenStd: std(lens) };
}

// 기준 코퍼스 통계(μ, σ) — 데모 교과서·일반도서 코퍼스로 보정했다고 가정한 상수
export const BASELINE = {
  f1: [2.35, 0.32], f2: [9.5, 3.2], f3: [1.1, 0.7], f4: [0.05, 0.035], f5: [0.18, 0.07], f6: [0.02, 0.025],
};
export const AXES = [
  { k: 'f1', label: '어휘 희소도' },
  { k: 'f2', label: '문장 길이' },
  { k: 'f3', label: '구문 복잡도' },
  { k: 'f4', label: '추상어 비율' },
  { k: 'f5', label: '담화 응집도' },
  { k: 'f6', label: '전문용어 밀도' },
];

// S_k = 100·Φ((f_k − μ_k)/σ_k)
export function radar(text) {
  const f = rawFeatures(text);
  const scores = {};
  for (const { k } of AXES) { const [mu, sd] = BASELINE[k]; scores[k] = Math.round(100 * normCdf((f[k] - mu) / sd)); }
  return { scores, raw: f };
}

// 인지부하 CL = w1·S1 + w2·S3 + w3·S6 + w4·(1−S5)  (0~1 스케일)
export const DEFAULT_W = [0.35, 0.3, 0.2, 0.15];
export function cognitiveLoad(scores, w = DEFAULT_W) {
  const s = (k) => scores[k] / 100;
  return w[0] * s('f1') + w[1] * s('f3') + w[2] * s('f6') + w[3] * (1 - s('f5'));
}
// 난이도 보정 g(CL): 부하가 높을수록 속도 감소
export const speedFactor = (cl) => 1.25 - 0.7 * cl;
// 예상 완독시간(분) = 총어절 / (WPM · g(CL))
export const expectedMinutes = (totalEojeol, wpm, cl) => totalEojeol / (wpm * speedFactor(cl));

export function analyze(text, { wpm = 180, totalEojeol } = {}) {
  const { scores, raw } = radar(text);
  const cl = cognitiveLoad(scores);
  return {
    scores, raw, cl: +cl.toFixed(3), lix: +koreanLix(text).toFixed(1),
    minutes: totalEojeol ? Math.round(expectedMinutes(totalEojeol, wpm, cl)) : null,
    readability: Math.round(100 * (1 - cl)),
  };
}

export function formatMinutes(m) {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h ? `${h}시간 ${mm}분` : `${mm}분`;
}
