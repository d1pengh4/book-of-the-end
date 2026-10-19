# Book of the End

고르기 → 빌리기 → 읽기 → 이해 확인 → 다음 책을 한 앱에 이은 독서 앱 프로토타입. Next.js + TypeScript.

```bash
npm install
npm run dev   # http://localhost:3000
```

- `src/lib/boe/`: 알고리즘 (맥락 밴딧 추천, IRT 적응형 평가, 한국어 문체 6축, 도서관 거리·대출 확률, 배낭 DP 스케줄러, SM-2 복습)
- `src/app/`: 화면 (온보딩, 홈, 탐색, 상세, 스케줄, 퀴즈, MY)
- 개인 데이터는 모두 브라우저 `localStorage`에만 저장한다. 도서관 위치·재고는 시연용 샘플이다.
