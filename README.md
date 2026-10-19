# Book of the End — 데모 구현 (v1.1)

설계서 v2.0을 브라우저에서 동작하는 단일 페이지 앱으로 구현한 데모입니다. 외부 API는 같은 인터페이스의 데모 어댑터로 대체했습니다.

## 실행
```
npm install
npm test        # 알고리즘·서비스 단위/통합 테스트 (node:test)
npm run build   # dist/web/index.html (단일 파일, 정적 호스팅 가능), dist/artifact.html
npx serve dist/web   # 로컬 확인
```

## 배포
`main`에 푸시하면 Vercel이 `vercel.json` 설정(정적 빌드, 출력 `dist/web`)으로 자동 배포합니다.
이전 Next.js 프로토타입은 `legacy-nextjs-prototype` 브랜치에 보관되어 있습니다.

## 구조
| 경로 | 내용 (설계서 장) |
|---|---|
| `src/core/mab.js` | Linear Thompson Sampling, 보상식, MMR, 근거 코드 (6.1) |
| `src/core/ope.js` | 오프라인 정책 평가 IPS·SNIPS·DM·DR (6.1) |
| `src/core/nlp.js` | 한국어 보정 LIX, 6축 레이더, 인지부하, 예상 완독시간 (6.2) |
| `src/core/scheduler.js` | 준비도 R_t, MSFsc 크로노타입, 0/1·그룹 Knapsack, 순차 청크 계획 (6.3) |
| `src/core/gis.js` | 육각 격자 k-ring, Haversine, 베타-이항, 점수화, 상호대출 (6.4) |
| `src/core/rag.js` | 계층 청킹, BM25+Dense RRF, 재랭킹, 인용 강제 요약, 함의 검증, 근거 부족 게이트, 지식 그래프 (6.5) |
| `src/core/irt.js` | 3PL, EAP, Fisher 정보, Sympson-Hetter, Bloom 배분, SM-2, 선수 개념 역탐색, CAT 종료 (6.6) |
| `src/core/cluster.js` | RobustScaler, K-Means++, silhouette K 선택, 리스크, CUSUM, FNR 격차 (6.7) |
| `src/core/forecast.js` | Holt-Winters·계절 나이브·외생 회귀 앙상블, 컨포멀 구간, 구매 최적화, 이동도서관 경로 (6.8) |
| `src/core/privacy.js` | k-익명, 라플라스 DP, 솔트 회전 가명화, 해시체인 동의 원장, ABAC (10장) |
| `src/api/gateway.js` | 토큰버킷, 서킷브레이커, TTL 캐시, SLO p95, 이벤트 버스 (2·8·11장) |
| `src/api/services.js` | BFF 서비스: Reco, Library, Scheduler, Rag, Quiz, Classroom, Demand, Privacy, Experiment (8장) |
| `src/ui/` | 독자 앱 · 교사 · 도서관 · 개발자 콘솔 화면 |

## 데모 데이터 고지
도서 제목·저자 외의 샘플 문장, 재고, 도서관 좌표, 학생, 수요, 생체 데이터는 모두 데모용 합성 데이터입니다. RAG 코퍼스 「별에서 온 우리」는 팀이 작성한 예시 텍스트입니다.
