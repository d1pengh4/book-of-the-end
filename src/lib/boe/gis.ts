// 가까운 도서관 찾기. 설계서 6.4절.
// 실서비스는 도서관 정보나루 bookExist(도서관 코드 + ISBN)와 카카오 길찾기를 쓰고,
// 여기서는 하버사인 거리 × 1.3으로 도로 거리를 근사한다(외부 API 실패 시의 폴백과 같다).
export type LatLng = { lat: number; lng: number };
export type Holding = { total: number; out: number; history: [number, number] }; // history: [지난 관찰 중 대출가능 횟수, 대출중 횟수]
export type Library = { code: string; name: string; pos: LatLng; open: [number, number] };

export function haversine(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 이동 시간(분). 2km 안은 걸어서(시속 4.5km), 그 밖은 차로(시속 30km) 본다. */
export function eta(km: number) {
  const road = km * 1.3;
  return road <= 2 ? { min: Math.round((road / 4.5) * 60), mode: '걸어서' } : { min: Math.round((road / 30) * 60 + 4), mode: '차로' };
}

/** 대출 가능 확률: 베타-이항 사후 평균 (사전 Beta(2,2) + 과거 관찰 + 지금 남은 권수) */
export function availability(h: Holding) {
  if (h.total === 0) return 0;
  const now = h.total - h.out;
  if (now > 0) return Math.min(0.98, (2 + h.history[0] + now * 3) / (4 + h.history[0] + h.history[1] + now * 3));
  return (2 + h.history[0]) / (4 + h.history[0] + h.history[1]) * 0.5; // 지금은 다 나갔으면 반납 기대만 남는다
}

export type Ranked = Library & { km: number; eta: { min: number; mode: string }; p: number; status: '대출 가능' | '예약 가능' | '소장 안 함'; score: number; openNow: boolean };

/** 점수 = α·ETA + β·(1 − 확률) + γ·운영시간 불일치. 낮을수록 좋다. */
export function rankLibraries(user: LatLng, libs: Library[], holdings: Record<string, Holding | undefined>, hour: number): Ranked[] {
  return libs
    .map((l) => {
      const km = haversine(user, l.pos);
      const e = eta(km);
      const h = holdings[l.code];
      const p = h ? availability(h) : 0;
      const openNow = hour >= l.open[0] && hour < l.open[1];
      const status: Ranked['status'] = !h ? '소장 안 함' : h.total - h.out > 0 ? '대출 가능' : '예약 가능';
      const score = 1.0 * e.min + 40 * (1 - p) + (openNow ? 0 : 15) + (h ? 0 : 999);
      return { ...l, km, eta: e, p, status, score, openNow };
    })
    .sort((a, b) => a.score - b.score);
}
