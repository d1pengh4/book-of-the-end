// 6.4 GIS 대출 최적 탐색 — 육각 격자 k-ring, Haversine, 베타-이항 대출가능확률, 점수화, 상호대출 대안
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// H3 res8 근사 육각 격자 (평균 변 길이 ≈ 461m). 위경도를 등거리 평면으로 투영한 뒤 axial 좌표 사용.
export const HEX_EDGE_M = 461;
export function toHex({ lat, lng }, origin = { lat: 35.9, lng: 127.05 }) {
  const x = rad(lng - origin.lng) * R * Math.cos(rad(origin.lat));
  const y = rad(lat - origin.lat) * R;
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / HEX_EDGE_M;
  const r = ((2 / 3) * y) / HEX_EDGE_M;
  return hexRound(q, r);
}
function hexRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}
export const hexDistance = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
export const hexKey = (h) => `${h.q},${h.r}`;

// k-ring 확장: k=1..kMax로 넓히며 후보가 minCount 이상이면 멈춘다
export function kRingSearch(user, libraries, { kMax = 5, minCount = 3, ringStep = 3 } = {}) {
  const uh = toHex(user);
  for (let k = 1; k <= kMax; k++) {
    const radius = k * ringStep; // 데모: 링 하나 = 3셀 (군 단위 밀도 보정)
    const found = libraries.filter((l) => hexDistance(uh, toHex(l)) <= radius);
    if (found.length >= minCount || k === kMax) return { k, cells: radius, candidates: found };
  }
  return { k: kMax, candidates: [] };
}

// 베타-이항: 과거 재고 관측(가능 a / 관측 n) → 사후평균 p = (a+α)/(n+α+β)
export function availabilityProb({ availObs = 0, totalObs = 0 }, alpha = 2, beta = 2) {
  return (availObs + alpha) / (totalObs + alpha + beta);
}

// ETA(분): 도로 기준 API 실패 시 Haversine × 1.3 근사, 평균 시속(도보 4.5km/h, 차량 30km/h)
export function etaFallback(a, b, mode = 'car') {
  const d = haversine(a, b) * 1.3;
  const v = mode === 'walk' ? 75 : 500; // m/분
  return { meters: Math.round(d), minutes: Math.max(1, Math.round(d / v)), source: 'haversine×1.3' };
}

// 운영시간 불일치 패널티: 지금부터 이동 후 도착 시각이 폐관 이후거나 휴관일이면 1
export function hoursPenalty(lib, arriveAt) {
  const d = arriveAt.getDay();
  if (lib.closedDays?.includes(d)) return 1;
  const h = arriveAt.getHours() + arriveAt.getMinutes() / 60;
  const [o, c] = lib.hours ?? [9, 18];
  if (h < o) return 0.3;
  if (h > c - 0.25) return 1;
  return 0;
}

// 점수(낮을수록 좋음) = α·ETA + β·(1−p) + γ·운영시간 패널티
export function scoreLibrary({ etaMin, p, penalty }, w = { alpha: 0.04, beta: 1.0, gamma: 1.2 }) {
  return w.alpha * etaMin + w.beta * (1 - p) + w.gamma * penalty;
}

export function rankLibraries({ user, libraries, inventory, now = new Date(), eta = etaFallback }) {
  const { k, candidates } = kRingSearch(user, libraries);
  const rows = candidates.map((lib) => {
    const inv = inventory[lib.code] ?? { status: 'none' };
    const e = eta(user, lib);
    const p = inv.status === 'available' ? Math.max(0.85, availabilityProb(inv)) : inv.status === 'reservable' ? availabilityProb(inv) * 0.5 : 0;
    const arrive = new Date(now.getTime() + e.minutes * 60000);
    const penalty = hoursPenalty(lib, arrive);
    return { lib, inv, eta: e, p: +p.toFixed(2), penalty, score: +scoreLibrary({ etaMin: e.minutes, p, penalty }).toFixed(3) };
  }).sort((a, b) => a.score - b.score);
  return { k, rows };
}

// 상호대출(LOLA) 대안: 배송 소요일 + 수령 도서관 이동을 합친 총 소요시간(시간)
export function interLibraryOptions({ user, libraries, holders, deliveryDays = 2 }) {
  return libraries.map((pickup) => {
    const e = etaFallback(user, pickup);
    return { pickup, holder: holders[0], totalHours: +(deliveryDays * 24 + e.minutes / 60).toFixed(1), eta: e };
  }).sort((a, b) => a.totalHours - b.totalHours).slice(0, 2);
}

// 지도 투영(데모 SVG 지도): 경계 상자 → 픽셀
export function projector(points, w, h, pad = 24) {
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const sx = (w - 2 * pad) / (d - c || 1e-6), sy = (h - 2 * pad) / (b - a || 1e-6);
  const s = Math.min(sx, sy);
  return (p) => ({ x: pad + (p.lng - c) * s + ((w - 2 * pad) - (d - c) * s) / 2, y: h - pad - (p.lat - a) * s - ((h - 2 * pad) - (b - a) * s) / 2 });
}
