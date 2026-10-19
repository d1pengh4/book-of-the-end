// 데모 데이터. 도서 제목·저자는 실제 서지정보이며, 샘플 문장·재고·좌표·학생·수요 데이터는 모두 데모용으로 만든 것이다.
// (저작권: 도서 본문은 사용하지 않는다 — ADR-04. 샘플 문장은 팀이 작성한 "문체 예시"이며 원문이 아니다.)
import { mulberry32 } from '../core/math.js';

// 문체 축: [서정, 긴장, 논픽션, 사유, 에세이, 유머]
export const STYLE_AXES = ['서정', '긴장', '논픽션', '사유', '에세이', '유머'];

export const BOOKS = [
  { isbn: '9788983711892', title: '코스모스', author: '칼 세이건', genre: '과학 교양', kdc: '440', pages: 720, totalEojeol: 52000, cover: '#3B2A20', accent: '#E9B44C', styleVec: [0.5, 0.1, 0.9, 0.7, 0.3, 0.1], difficultyTheta: 0.4, cognitiveLoad: 0.62, avgChunkMin: 30, price: 19500,
    sample: '우리는 별을 올려다보며 살아왔다. 밤하늘의 빛 하나하나가 수백만 년을 건너온 소식이라는 사실을 알게 되면, 우주는 갑자기 가까워진다. 이 책은 그 거리를 좁히는 여행이다.' },
  { isbn: '9788934972464', title: '우주의 구조', author: '브라이언 그린', genre: 'SF / 하드 사이언스', kdc: '420', pages: 760, totalEojeol: 61000, cover: '#4A2E2A', accent: '#E9B44C', styleVec: [0.1, 0.2, 0.95, 0.8, 0.1, 0.1], difficultyTheta: 1.5, cognitiveLoad: 0.86, avgChunkMin: 45, price: 25000,
    sample: '시간의 흐름이 착각일 수 있다는 주장은 상대성 이론의 시공간 개념에서 출발한다. 동시성은 관찰자의 운동 상태에 따라 달라지며, 이 사실은 과거와 미래의 구분에 대한 직관적 이해를 근본적으로 흔든다.' },
  { isbn: '9788934972587', title: '사피엔스', author: '유발 하라리', genre: '역사', kdc: '909', pages: 636, totalEojeol: 47000, cover: '#5A3A26', accent: '#F2D49B', styleVec: [0.2, 0.3, 0.9, 0.6, 0.4, 0.3], difficultyTheta: 0.6, cognitiveLoad: 0.6, avgChunkMin: 35, price: 22000,
    sample: '인류는 이야기를 믿는 능력 덕분에 낯선 사람들과도 협력할 수 있었다. 돈과 국가와 법은 모두 많은 사람이 함께 믿는 이야기다. 그 믿음이 흔들리면 질서도 함께 흔들린다.' },
  { isbn: '9788936456788', title: '아몬드', author: '손원평', genre: '소설', kdc: '813', pages: 264, totalEojeol: 21000, cover: '#7A5230', accent: '#F7E7CC', styleVec: [0.6, 0.6, 0.0, 0.4, 0.2, 0.1], difficultyTheta: -0.6, cognitiveLoad: 0.32, avgChunkMin: 25, price: 12000,
    sample: '나는 무섭다는 말을 이해하지 못했다. 사람들이 울 때 나는 그 얼굴을 오래 보았다. 그리고 따라 해 보려고 했지만 잘 되지 않았다.' },
  { isbn: '9788936433598', title: '채식주의자', author: '한강', genre: '소설', kdc: '813', pages: 248, totalEojeol: 20000, cover: '#2E2119', accent: '#D9C3A5', styleVec: [0.8, 0.7, 0.0, 0.6, 0.1, 0.0], difficultyTheta: 0.5, cognitiveLoad: 0.55, avgChunkMin: 30, price: 15000,
    sample: '그날 밤 그녀는 꿈을 꾸었다고 했다. 말하는 동안 그녀의 목소리는 아주 낮았고, 창밖의 어둠은 조용히 방 안으로 스며들었다.' },
  { isbn: '9788932917245', title: '어린 왕자', author: '생텍쥐페리', genre: '고전', kdc: '863', pages: 136, totalEojeol: 9000, cover: '#9C4A2F', accent: '#F7E7CC', styleVec: [0.9, 0.1, 0.0, 0.7, 0.3, 0.3], difficultyTheta: -1.2, cognitiveLoad: 0.25, avgChunkMin: 20, price: 9800,
    sample: '어른들은 숫자를 좋아한다. 새 친구를 사귀었다고 말하면 어른들은 정말 중요한 것은 묻지 않는다. 그 친구의 목소리가 어떤지는 궁금해하지 않는다.' },
  { isbn: '9788937460449', title: '데미안', author: '헤르만 헤세', genre: '고전', kdc: '853', pages: 232, totalEojeol: 23000, cover: '#4F6B4A', accent: '#F2E5D3', styleVec: [0.6, 0.3, 0.0, 0.95, 0.2, 0.0], difficultyTheta: 0.7, cognitiveLoad: 0.64, avgChunkMin: 30, price: 10000,
    sample: '나는 내 안에서 저절로 솟아나오려는 것을 살아 보려 했을 뿐이다. 그 길은 왜 그토록 어려웠을까. 자기 자신에게 이르는 길은 누구에게도 대신 걸어 줄 수 없는 길이었다.' },
  { isbn: '9788937834790', title: '정의란 무엇인가', author: '마이클 샌델', genre: '철학', kdc: '190', pages: 444, totalEojeol: 38000, cover: '#2B3A4A', accent: '#E9B44C', styleVec: [0.0, 0.4, 0.8, 0.9, 0.2, 0.1], difficultyTheta: 0.9, cognitiveLoad: 0.7, avgChunkMin: 40, price: 18000,
    sample: '다섯 명을 구하기 위해 한 명을 희생하는 것은 정당한가. 이 질문에 대한 우리의 직관은 상황에 따라 바뀐다. 철학은 그 흔들림의 이유를 묻는 데서 시작한다.' },
  { isbn: '9788932473901', title: '이기적 유전자', author: '리처드 도킨스', genre: '과학', kdc: '476', pages: 632, totalEojeol: 50000, cover: '#3E5639', accent: '#E4EADC', styleVec: [0.1, 0.2, 0.95, 0.6, 0.2, 0.2], difficultyTheta: 1.1, cognitiveLoad: 0.78, avgChunkMin: 40, price: 22000,
    sample: '유전자의 관점에서 보면 개체는 유전자를 다음 세대로 운반하는 수단이다. 이타적으로 보이는 행동도 유전자 수준에서는 자기 복제의 확률을 높이는 전략으로 설명될 수 있다.' },
  { isbn: '9788996991342', title: '미움받을 용기', author: '기시미 이치로·고가 후미타케', genre: '에세이 / 심리', kdc: '180', pages: 336, totalEojeol: 24000, cover: '#B5541F', accent: '#FFF3E2', styleVec: [0.3, 0.1, 0.5, 0.7, 0.8, 0.2], difficultyTheta: -0.4, cognitiveLoad: 0.38, avgChunkMin: 25, price: 14900,
    sample: '청년은 물었다. 사람은 정말 변할 수 있습니까. 철학자는 웃으며 대답했다. 변하지 못하는 것이 아니라, 변하지 않기로 결심한 것일 수도 있다고.' },
  { isbn: '9788970127248', title: '총, 균, 쇠', author: '재레드 다이아몬드', genre: '역사', kdc: '909', pages: 752, totalEojeol: 60000, cover: '#5E4632', accent: '#F2D49B', styleVec: [0.1, 0.3, 0.95, 0.6, 0.3, 0.1], difficultyTheta: 1.0, cognitiveLoad: 0.74, avgChunkMin: 45, price: 28000,
    sample: '왜 어떤 대륙의 사회는 더 빨리 농업과 문자를 갖게 되었을까. 그 답은 사람들의 능력 차이가 아니라 지리와 환경, 길들일 수 있는 동식물의 분포에 있었다.' },
  { isbn: '9791161571188', title: '불편한 편의점', author: '김호연', genre: '소설', kdc: '813', pages: 268, totalEojeol: 22000, cover: '#6E8B5E', accent: '#FFF9F0', styleVec: [0.5, 0.2, 0.0, 0.3, 0.5, 0.8], difficultyTheta: -0.9, cognitiveLoad: 0.28, avgChunkMin: 25, price: 14000,
    sample: '밤 열 시의 편의점은 이상하게 따뜻했다. 삼각김밥 진열대 앞에서 그는 한참을 서 있었고, 계산대의 사장님은 아무것도 묻지 않았다.' },
  { isbn: '9791191114225', title: '지구 끝의 온실', author: '김초엽', genre: 'SF', kdc: '813', pages: 392, totalEojeol: 30000, cover: '#2F4B4B', accent: '#CFE3D8', styleVec: [0.7, 0.6, 0.2, 0.6, 0.2, 0.0], difficultyTheta: 0.0, cognitiveLoad: 0.45, avgChunkMin: 30, price: 15000,
    sample: '덩굴은 폐허의 벽을 타고 끝없이 번져 있었다. 그녀는 그 식물이 어디에서 왔는지 알고 싶었다. 그리고 누가 처음 그것을 심었는지도.' },
  { isbn: '9788972756194', title: '나미야 잡화점의 기적', author: '히가시노 게이고', genre: '소설', kdc: '833', pages: 456, totalEojeol: 34000, cover: '#8A5A3B', accent: '#F7E7CC', styleVec: [0.6, 0.5, 0.0, 0.3, 0.3, 0.4], difficultyTheta: -0.7, cognitiveLoad: 0.3, avgChunkMin: 30, price: 14800,
    sample: '셔터 틈으로 편지 한 통이 떨어졌다. 세 사람은 서로를 바라보았다. 이 오래된 가게에 누가 아직도 고민을 보내는 걸까.' },
];

// 온보딩 문체 카드 12장 (팀 작성 예시 문장)
export const STYLE_CARDS = [
  { text: '비가 그친 골목에 빵 굽는 냄새가 천천히 번졌다.', tag: '서정', vec: [1, 0, 0, 0.2, 0.3, 0] },
  { text: '그는 문을 열지 않았다. 열 수 없었다.', tag: '긴장', vec: [0.1, 1, 0, 0.2, 0, 0] },
  { text: '숫자는 거짓말을 하지 않지만, 질문은 고를 수 있다.', tag: '논픽션', vec: [0, 0.1, 1, 0.5, 0.1, 0.1] },
  { text: '별을 오래 보면, 내가 얼마나 작은지보다 얼마나 이어져 있는지가 보인다.', tag: '사유', vec: [0.5, 0, 0.3, 1, 0.2, 0] },
  { text: '할머니의 부엌에는 계량컵 대신 눈대중이 있었다.', tag: '에세이', vec: [0.4, 0, 0, 0.2, 1, 0.3] },
  { text: '회의는 길었고, 결론은 다음 회의였다.', tag: '유머', vec: [0, 0.1, 0, 0.1, 0.4, 1] },
  { text: '바다는 매일 같은 자리에서 다른 색으로 저물었다.', tag: '서정', vec: [1, 0, 0, 0.4, 0.1, 0] },
  { text: '시계가 자정을 넘기자, 복도 끝에서 발소리가 멈췄다.', tag: '긴장', vec: [0.2, 1, 0, 0, 0, 0] },
  { text: '농업의 시작은 인류에게 풍요와 함께 새로운 불평등을 가져왔다.', tag: '논픽션', vec: [0, 0.2, 1, 0.6, 0, 0] },
  { text: '정답을 모른다는 사실을 아는 것, 그게 공부의 첫 장이었다.', tag: '사유', vec: [0.2, 0, 0.2, 1, 0.4, 0.1] },
  { text: '출근길 버스에서 졸다가 종점까지 가 본 적이 있다면, 이 글은 당신 이야기다.', tag: '에세이', vec: [0.1, 0, 0, 0.1, 1, 0.6] },
  { text: '우리 집 고양이는 월요일을 나보다 더 싫어한다.', tag: '유머', vec: [0.1, 0, 0, 0, 0.5, 1] },
];

// 온보딩 CAT 문해력 문항 (3PL 파라미터는 데모 사전값)
export const CAT_BANK = [
  { id: 'v1', a: 1.1, b: -2.0, c: 0.25, bloom: 0, q: "'설레다'와 뜻이 가장 가까운 것은?", options: ['마음이 들뜨다', '몸이 지치다', '화가 나다', '잠이 오다'], answer: 0 },
  { id: 'v2', a: 1.2, b: -1.4, c: 0.25, bloom: 0, q: "'고즈넉하다'와 어울리는 장면은?", options: ['조용하고 아늑한 산사', '붐비는 시장', '시끄러운 공사장', '경기장의 함성'], answer: 0 },
  { id: 'v3', a: 1.3, b: -0.8, c: 0.25, bloom: 1, q: "'그는 손사래를 쳤다'의 의미는?", options: ['거절하거나 부인했다', '박수를 쳤다', '인사를 했다', '도움을 청했다'], answer: 0 },
  { id: 'v4', a: 1.4, b: -0.3, c: 0.25, bloom: 1, q: "'반증'의 뜻으로 알맞은 것은?", options: ['어떤 주장이 틀렸음을 보이는 증거', '같은 말을 되풀이함', '반대편 사람', '증명을 미룸'], answer: 0 },
  { id: 'v5', a: 1.5, b: 0.0, c: 0.25, bloom: 2, q: '"비가 오면 길이 젖는다. 길이 젖었다." 여기서 반드시 참인 것은?', options: ['알 수 없다', '비가 왔다', '비가 오지 않았다', '내일도 젖는다'], answer: 0 },
  { id: 'v6', a: 1.4, b: 0.3, c: 0.25, bloom: 1, q: "'아이러니'에 해당하는 예는?", options: ['소방서에 불이 났다', '비 오는 날 우산을 썼다', '배고파서 밥을 먹었다', '겨울에 눈이 왔다'], answer: 0 },
  { id: 'v7', a: 1.6, b: 0.6, c: 0.25, bloom: 3, q: '필자가 "기술은 중립적이지 않다"고 말할 때 가장 가능성 높은 근거는?', options: ['설계에 만든 사람의 가치가 들어간다', '기술은 항상 비싸다', '기술은 빨리 낡는다', '기술은 자연에서 왔다'], answer: 0 },
  { id: 'v8', a: 1.5, b: 0.9, c: 0.25, bloom: 1, q: "'방증'과 '반증'의 차이로 옳은 것은?", options: ['방증은 간접 증거, 반증은 반대 증거', '둘은 같은 말이다', '방증은 반대 증거다', '반증은 간접 증거다'], answer: 0 },
  { id: 'v9', a: 1.7, b: 1.2, c: 0.25, bloom: 3, q: '"모든 백조가 희다"는 주장을 가장 강하게 흔드는 것은?', options: ['검은 백조 한 마리 관찰', '흰 백조 천 마리 관찰', '백조 사진 한 장', '백조에 관한 시 한 편'], answer: 0 },
  { id: 'v10', a: 1.6, b: 1.6, c: 0.25, bloom: 4, q: '두 연구가 상반된 결론을 낼 때 가장 먼저 확인할 것은?', options: ['표본과 측정 방법의 차이', '저자의 나이', '출판 연도만', '제목의 길이'], answer: 0 },
  { id: 'v11', a: 1.4, b: 2.0, c: 0.25, bloom: 4, q: "'상관관계는 인과관계가 아니다'의 예로 알맞은 것은?", options: ['아이스크림 판매와 익사 사고가 함께 늘어남', '불을 켜면 방이 밝아짐', '공을 차면 공이 굴러감', '물을 끓이면 수증기가 생김'], answer: 0 },
  { id: 'v12', a: 1.3, b: -1.0, c: 0.25, bloom: 0, q: "'헤아리다'의 뜻으로 알맞은 것은?", options: ['짐작하거나 세다', '버리다', '서두르다', '숨기다'], answer: 0 },
];

// RAG 데모 코퍼스: 팀 작성 예시 텍스트(공유저작물 가정). 실제 도서 본문 아님.
export const DEMO_TEXT = {
  bookTitle: '별에서 온 우리 (데모 허가 샘플)',
  linkedIsbn: '9788983711892',
  chapters: [
    { id: 'ch1', title: '1장 · 별은 어떻게 빛나는가', paragraphs: [
      '밤하늘의 별은 스스로 빛을 내는 거대한 기체 덩어리다. 별을 이루는 기체의 대부분은 수소이며, 그 다음으로 많은 것이 헬륨이다.',
      '별의 중심은 엄청난 중력 때문에 온도와 압력이 매우 높다. 이런 조건에서 수소 원자핵들이 서로 부딪혀 헬륨 원자핵이 되는데, 이 과정을 핵융합이라고 부른다.',
      '핵융합이 일어날 때 아주 작은 질량이 사라지면서 막대한 에너지로 바뀐다. 이 에너지가 바깥으로 밀어내는 힘이 안으로 끌어당기는 중력과 균형을 이루기 때문에 별은 오랫동안 안정된 모습을 유지한다.',
      '태양도 이런 별 가운데 하나다. 태양은 약 46억 년 동안 수소를 태워 왔고, 앞으로도 수십억 년 동안 빛날 것으로 예상된다.',
    ] },
    { id: 'ch2', title: '2장 · 별의 일생과 초신성', paragraphs: [
      '별은 성운이라고 불리는 기체와 먼지 구름 속에서 태어난다. 성운의 일부가 중력으로 뭉치면서 뜨거워지고, 중심에서 핵융합이 시작되면 비로소 별이 된다.',
      '별의 일생은 질량에 따라 크게 달라진다. 태양 정도의 별은 수소를 다 쓰고 나면 부풀어 적색거성이 되었다가, 바깥층을 날려 보내고 작고 뜨거운 백색왜성으로 남는다.',
      '태양보다 훨씬 무거운 별은 중심에서 헬륨보다 무거운 탄소, 산소, 규소 같은 원소를 차례로 만든다. 그러다 중심이 철로 가득 차면 더 이상 에너지를 얻지 못하고 순식간에 무너진다.',
      '이 붕괴의 반동으로 별은 초신성으로 폭발한다. 초신성 폭발은 은하 전체만큼 밝게 빛나기도 하며, 이때 철보다 무거운 원소들도 만들어져 우주 공간으로 흩어진다.',
    ] },
    { id: 'ch3', title: '3장 · 우리 몸의 원소', paragraphs: [
      '초신성이 흩뿌린 원소들은 새로운 성운에 섞여 들어간다. 그 성운에서 다시 별과 행성이 태어나므로, 다음 세대의 별과 행성에는 앞선 별들이 만든 원소가 들어 있다.',
      '지구도 그렇게 만들어진 행성이다. 지구의 바위에 있는 규소와 철, 바다에 녹아 있는 산소는 모두 오래전 별의 내부나 폭발 속에서 만들어졌다.',
      '우리 몸을 이루는 탄소와 산소, 질소, 피 속의 철도 마찬가지다. 수소를 제외한 우리 몸의 원소 대부분은 별에서 만들어졌다고 볼 수 있다.',
      '그래서 사람은 우주를 바라보는 존재이면서 동시에 우주의 일부다. 밤하늘을 올려다볼 때 우리는 우리 몸의 고향을 보고 있는 셈이다.',
    ] },
  ],
};

export const CONCEPTS = [
  { id: 'hydrogen', label: '수소', aliases: ['수소'], prereq: [] },
  { id: 'helium', label: '헬륨', aliases: ['헬륨'], prereq: ['hydrogen'] },
  { id: 'gravity', label: '중력', aliases: ['중력'], prereq: [] },
  { id: 'fusion', label: '핵융합', aliases: ['핵융합'], prereq: ['hydrogen', 'gravity'] },
  { id: 'energy', label: '에너지', aliases: ['에너지'], prereq: ['fusion'] },
  { id: 'nebula', label: '성운', aliases: ['성운'], prereq: ['gravity'] },
  { id: 'lifecycle', label: '별의 일생', aliases: ['일생', '적색거성', '백색왜성'], prereq: ['fusion', 'nebula'] },
  { id: 'heavy', label: '무거운 원소', aliases: ['탄소', '산소', '규소', '철', '무거운 원소'], prereq: ['fusion'] },
  { id: 'supernova', label: '초신성', aliases: ['초신성'], prereq: ['lifecycle', 'heavy'] },
  { id: 'planet', label: '행성', aliases: ['행성', '지구'], prereq: ['nebula', 'supernova'] },
  { id: 'body', label: '우리 몸의 원소', aliases: ['우리 몸', '몸을 이루는'], prereq: ['heavy', 'planet'] },
];

// 학습 퀴즈 은행 (Bloom 0~5, 3PL 사전값 — pilotN<200 은 베이지안 보정 대상)
export const QUIZ_BANK = [
  { id: 'q1', bloom: 0, a: 1.0, b: -1.6, concept: 'hydrogen', cite: 'ch1', q: '별을 이루는 기체 가운데 가장 많은 것은?', options: ['수소', '산소', '철', '탄소'], answer: 0, pilotN: 320 },
  { id: 'q2', bloom: 0, a: 1.1, b: -1.2, concept: 'fusion', cite: 'ch1', q: '수소 원자핵이 합쳐져 헬륨이 되는 과정의 이름은?', options: ['핵융합', '핵분열', '광합성', '증발'], answer: 0, pilotN: 410 },
  { id: 'q3', bloom: 1, a: 1.3, b: -0.5, concept: 'gravity', cite: 'ch1', q: '별이 오랫동안 안정된 모습을 유지하는 까닭으로 가장 알맞은 것은?', options: ['핵융합 에너지가 밀어내는 힘과 중력이 균형을 이룬다', '별에는 중력이 없다', '별은 차갑기 때문이다', '별은 계속 커지기 때문이다'], answer: 0, pilotN: 250 },
  { id: 'q4', bloom: 1, a: 1.2, b: -0.2, concept: 'nebula', cite: 'ch2', q: '별이 태어나는 장소는?', options: ['기체와 먼지 구름인 성운', '행성의 바다', '블랙홀 내부', '달의 표면'], answer: 0, pilotN: 230 },
  { id: 'q5', bloom: 1, a: 1.4, b: 0.2, concept: 'lifecycle', cite: 'ch2', q: '태양 정도 질량의 별이 마지막에 남기는 것은?', options: ['백색왜성', '초신성 잔해만', '새로운 행성', '아무것도 남지 않음'], answer: 0, pilotN: 210 },
  { id: 'q6', bloom: 2, a: 1.5, b: 0.5, concept: 'heavy', cite: 'ch2', q: '무거운 별의 중심이 철로 가득 차면 일어나는 일은?', options: ['더 이상 에너지를 얻지 못하고 무너진다', '다시 수소가 생긴다', '빛이 더 약해지기만 한다', '행성으로 바뀐다'], answer: 0, pilotN: 140 },
  { id: 'q7', bloom: 1, a: 1.3, b: 0.4, concept: 'supernova', cite: 'ch2', q: '초신성 폭발에 대한 설명으로 옳은 것은?', options: ['철보다 무거운 원소가 만들어져 흩어진다', '별이 처음 태어나는 순간이다', '행성끼리 부딪히는 현상이다', '태양에서 매일 일어난다'], answer: 0, pilotN: 260 },
  { id: 'q8', bloom: 3, a: 1.6, b: 0.9, concept: 'planet', cite: 'ch3', q: '지구의 바위 속 철이 오래전 별에서 왔다고 볼 수 있는 이유는?', options: ['초신성이 흩뿌린 원소가 섞인 성운에서 지구가 생겼다', '지구 중심에서 핵융합이 일어난다', '철은 바다에서 생긴다', '태양이 매일 철을 보낸다'], answer: 0, pilotN: 120 },
  { id: 'q9', bloom: 1, a: 1.4, b: 0.1, concept: 'body', cite: 'ch3', q: '이 부분의 핵심 생각과 가장 가까운 것은?', options: ['우리를 이루는 물질은 별에서 비롯되었다', '인간은 우주와 분리된 특별한 존재다', '별은 영원히 변하지 않는다', '원소는 지구에서만 만들어진다'], answer: 0, pilotN: 300 },
  { id: 'q10', bloom: 4, a: 1.7, b: 1.3, concept: 'body', cite: 'ch3', q: '"우리 몸의 원소 대부분은 별에서 왔다"는 주장에서 수소를 제외하는 까닭으로 가장 타당한 것은?', options: ['수소는 별이 만든 것이 아니라 우주 초기부터 있던 원소이기 때문', '수소는 몸에 없기 때문', '수소는 너무 무겁기 때문', '수소는 초신성에서만 생기기 때문'], answer: 0, pilotN: 90 },
  { id: 'q11', bloom: 4, a: 1.6, b: 1.6, concept: 'lifecycle', cite: 'ch2', q: '두 별의 최후가 다른 까닭을 설명할 때 가장 핵심이 되는 변수는?', options: ['별의 질량', '별의 색 이름', '별까지의 거리', '관측한 날짜'], answer: 0, pilotN: 60 },
  { id: 'q12', bloom: 5, a: 1.5, b: 2.0, concept: 'body', cite: 'ch3', q: '"사람은 우주의 일부다"라는 문장을 근거와 함께 바꿔 쓴 것으로 가장 알맞은 것은?', options: ['우리 몸의 원소가 별에서 만들어졌으므로 우리는 우주의 물질 순환 안에 있다', '사람은 우주를 볼 수 있으므로 우주다', '별이 밝으므로 사람도 밝다', '우주는 넓으므로 사람은 작다'], answer: 0, pilotN: 40 },
];

// 사용자 기본 위치: 완주군 삼례읍 (데모 좌표·근사)
export const USER_LOC = { lat: 35.9076, lng: 127.0736, label: '전북 완주군 삼례읍' };

// 데모 도서관(위치 근사). hours=[개관, 폐관], closedDays: 0=일 … 6=토
export const LIBRARIES = [
  { code: 'L01', name: '삼례도서관', lat: 35.9150, lng: 127.0812, hours: [9, 22], closedDays: [1] },
  { code: 'L02', name: '봉동도서관', lat: 35.9405, lng: 127.1630, hours: [9, 18], closedDays: [1] },
  { code: 'L03', name: '이서도서관', lat: 35.8370, lng: 127.0450, hours: [9, 18], closedDays: [1] },
  { code: 'L04', name: '고산도서관', lat: 36.0010, lng: 127.2050, hours: [9, 18], closedDays: [1] },
  { code: 'L05', name: '용진 작은도서관', lat: 35.8760, lng: 127.1180, hours: [10, 19], closedDays: [0] },
  { code: 'L06', name: '전주 송천도서관', lat: 35.8665, lng: 127.1240, hours: [9, 22], closedDays: [1] },
];

export function demoInventory(isbn) {
  const rng = mulberry32(parseInt(isbn.slice(-6), 10) || 7);
  const out = {};
  for (const l of LIBRARIES) {
    const r = rng();
    const totalObs = 20 + Math.floor(rng() * 40);
    const availObs = Math.floor(totalObs * (0.3 + rng() * 0.6));
    out[l.code] = { status: r < 0.55 ? 'available' : r < 0.8 ? 'reservable' : 'loaned', copies: 1 + Math.floor(rng() * 3), availObs, totalObs };
  }
  // 디자인 시안과 맞추기: 코스모스는 삼례도서관에 3권 대출 가능
  if (isbn === '9788983711892') out.L01 = { status: 'available', copies: 3, availObs: 31, totalObs: 40 };
  return out;
}

// 데모 HealthKit/Health Connect 요약 (원시 신호 없음, 디바이스 내 정규화된 z값)
export function demoBio(seed = 5) {
  const rng = mulberry32(seed);
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i, sleepEff: +(0.82 + rng() * 0.12).toFixed(2), rmssd: Math.round(38 + rng() * 22), sleepH: +(6 + rng() * 2).toFixed(1) }));
  const z = (arr, v) => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; const s = Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) || 1; return (v - m) / s; };
  const last = days.at(-1);
  return { days, rmssdZ: +z(days.map((d) => d.rmssd), last.rmssd).toFixed(2), sleepEffZ: +z(days.map((d) => d.sleepEff), last.sleepEff).toFixed(2), workdaySleep: ['23:40', '07:00'], freeSleep: ['00:30', '08:40'] };
}

// 데모 캘린더 빈 시간
export const FREE_WINDOWS = [
  { start: '07:00', end: '08:10', label: '아침' },
  { start: '12:30', end: '13:10', label: '점심 뒤' },
  { start: '16:40', end: '17:20', label: '오후' },
  { start: '20:30', end: '22:30', label: '저녁' },
];

// B2B: 데모 학급 (학생 이름 대신 가명 번호 — 낙인 방지·최소수집)
export function demoClass(seed = 21, n = 26) {
  const rng = mulberry32(seed);
  const archetypes = [
    { acc: 0.86, wpm: 230, vocabErr: 0.08, irregular: 0.3, dropout: 0.05 },
    { acc: 0.72, wpm: 180, vocabErr: 0.18, irregular: 0.5, dropout: 0.12 },
    { acc: 0.55, wpm: 140, vocabErr: 0.32, irregular: 0.8, dropout: 0.3 },
  ];
  return Array.from({ length: n }, (_, i) => {
    const a = archetypes[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : i % 5 === 0 ? 2 : i % 2];
    const j = (s) => 1 + (rng() - 0.5) * s;
    const acc = Math.min(0.98, a.acc * j(0.18));
    const weekly = Array.from({ length: 8 }, (_, w) => +(Math.min(0.99, acc * j(0.08) - (a.acc < 0.6 && w > 4 ? 0.04 * (w - 4) : 0))).toFixed(2));
    return {
      id: `S${String(i + 1).padStart(2, '0')}`, group: i % 2 ? 'A' : 'B',
      acc: +acc.toFixed(2), wpm: Math.round(a.wpm * j(0.25)), vocabErr: +(a.vocabErr * j(0.4)).toFixed(2),
      irregular: +(a.irregular * j(0.3)).toFixed(2), dropout: +(a.dropout * j(0.5)).toFixed(2),
      focus: +(0.4 + rng() * 0.5).toFixed(2), vocabAccept: +(0.4 + acc * 0.5 * j(0.1)).toFixed(2), weekly,
      trueRisk: a.acc < 0.6,
    };
  });
}

// 2022 개정 교육과정 성취기준(데모 요약 표기)
export const STANDARDS = [
  { code: '[9국02-03]', text: '읽기 목적이나 글의 특성을 고려하여 글 내용을 요약한다.' },
  { code: '[9국02-06]', text: '자신의 배경지식을 활용하여 글의 내용을 예측하며 읽는다.' },
  { code: '[9과13-02]', text: '별의 탄생과 진화 과정을 설명할 수 있다.' },
];

// B2G: 지역×키워드 월별 대출 수요 (36개월, 데모 합성 시계열)
export const REGIONS = ['삼례읍', '봉동읍', '이서면', '고산면', '용진읍'];
export const KEYWORDS = ['과학 교양', '청소년 소설', '자기계발', '그림책', '역사'];
export const CALENDAR = { semester: [2, 3, 4, 5, 8, 9, 10, 11], vacation: [0, 1, 6, 7], newRelease: { 30: 1, 31: 1, 18: 1 }, media: { 26: 1, 27: 0.5 } };
export function demandSeries(region, keyword) {
  const seed = REGIONS.indexOf(region) * 13 + KEYWORDS.indexOf(keyword) * 7 + 3;
  const rng = mulberry32(seed);
  const base = 40 + rng() * 80, trend = 0.4 + rng() * 1.2, amp = 8 + rng() * 22;
  const kwSeason = keyword === '그림책' || keyword === '청소년 소설' ? -1 : 1;
  return Array.from({ length: 36 }, (_, t) => {
    const mo = t % 12;
    const season = kwSeason * amp * Math.sin((2 * Math.PI * (mo - 2)) / 12) + (CALENDAR.vacation.includes(mo) && kwSeason < 0 ? amp : 0);
    const exo = (CALENDAR.newRelease[t] ?? 0) * 18 + (CALENDAR.media[t] ?? 0) * 25;
    return Math.max(2, Math.round(base + trend * t + season + exo + (rng() - 0.5) * 12));
  });
}
export const PURCHASE_CANDIDATES = [
  { id: 'p1', title: '코스모스', category: '과학', price: 19500 },
  { id: 'p2', title: '이기적 유전자', category: '과학', price: 22000 },
  { id: 'p3', title: '아몬드', category: '문학', price: 12000 },
  { id: 'p4', title: '지구 끝의 온실', category: '문학', price: 15000 },
  { id: 'p5', title: '불편한 편의점', category: '문학', price: 14000 },
  { id: 'p6', title: '사피엔스', category: '역사', price: 22000 },
  { id: 'p7', title: '총, 균, 쇠', category: '역사', price: 28000 },
  { id: 'p8', title: '미움받을 용기', category: '인문', price: 14900 },
  { id: 'p9', title: '정의란 무엇인가', category: '인문', price: 18000 },
];
export const MOBILE_STOPS = [
  { name: '삼례 문화예술촌', lat: 35.9090, lng: 127.0700, demand: 9, books: 120 },
  { name: '봉동 둔산리 마을회관', lat: 35.9500, lng: 127.1500, demand: 6, books: 90 },
  { name: '이서 혁신도시 공원', lat: 35.8300, lng: 127.0500, demand: 10, books: 140, window: [600, 840] },
  { name: '고산 자연휴양림 입구', lat: 36.0150, lng: 127.2300, demand: 4, books: 60 },
  { name: '용진 로컬푸드 직매장', lat: 35.8800, lng: 127.1250, demand: 7, books: 100 },
  { name: '화산면 복지회관', lat: 36.0700, lng: 127.1500, demand: 3, books: 60 },
  { name: '소양 오성마을', lat: 35.8800, lng: 127.2200, demand: 5, books: 70 },
];
export const MOBILE_DEPOT = { name: '완주군립도서관(차고지)', lat: 35.9200, lng: 127.1600 };
