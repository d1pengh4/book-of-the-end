// 6.3 바이오 스케줄러 — 준비도 R_t, 크로노타입(MSFsc), 청크 분할(0/1 Knapsack + 챕터 연속성)
import { sigmoid } from './math.js';

const toH = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h + m / 60; };
const wrap = (h) => ((h % 24) + 24) % 24;

// MSFsc: 휴일 수면 중간점에서 수면부채 보정 → 크로노타입(시)
export function chronotype({ workdaySleep = ['23:30', '07:00'], freeSleep = ['00:30', '09:00'] } = {}) {
  const dur = ([s, e]) => wrap(toH(e) - toH(s));
  const mid = ([s]) => toH(s);
  const sdw = dur(workdaySleep), sdf = dur(freeSleep);
  const msf = wrap(mid(freeSleep) + sdf / 2);
  const sdweek = (5 * sdw + 2 * sdf) / 7;
  const msfsc = sdf > sdw ? wrap(msf - (sdf - sdweek) / 2) : msf;
  const label = msfsc < 3.5 ? '아침형' : msfsc < 5 ? '중간형' : '저녁형';
  return { msfsc: +msfsc.toFixed(2), label };
}

// 일주기 성분: 기상 후 2~4h 상승, 점심 뒤 저하, 저녁 2차 상승 (MSFsc로 위상 이동)
export function circadian(t, msfsc = 4) {
  const shift = msfsc - 4;
  const x = wrap(t - shift);
  const peak1 = Math.exp(-((x - 10.5) ** 2) / 6);
  const dip = Math.exp(-((x - 14) ** 2) / 2);
  const peak2 = Math.exp(-((x - 19.5) ** 2) / 5);
  const night = x < 6.5 || x > 23.5 ? 1 : 0;
  return 1.6 * peak1 + 1.2 * peak2 - 0.9 * dip - 1.8 * night - 0.2;
}

export const DEFAULT_B = { b0: -0.2, b1: 0.45, b2: 0.55, b3: 1.0, b4: 0.35 };

// R_t = σ(b0 + b1·z(RMSSD_7d) + b2·z(수면효율) + b3·circadian(t) − b4·z(일정부하))
export function readiness(t, { rmssdZ = 0, sleepEffZ = 0, loadZ = 0, msfsc = 4 } = {}, b = DEFAULT_B) {
  return sigmoid(b.b0 + b.b1 * rmssdZ + b.b2 * sleepEffZ + b.b3 * circadian(t, msfsc) - b.b4 * loadZ);
}
export function readinessCurve(bio, step = 0.5) {
  const pts = [];
  for (let t = 6; t <= 24; t += step) pts.push({ t, r: readiness(t, bio) });
  return pts;
}
// 센서 미연동 폴백: 사용자 선언 선호 시간대
export function declaredCurve(preferred = ['07:00', '21:00'], step = 0.5) {
  const ps = preferred.map(toH);
  const pts = [];
  for (let t = 6; t <= 24; t += step) pts.push({ t, r: 0.25 + 0.6 * Math.max(...ps.map((p) => Math.exp(-((t - p) ** 2) / 1.5))) });
  return pts;
}

// 0/1 Knapsack DP: O(n·C)
export function knapsack01(items, capacity) {
  const C = Math.max(0, Math.floor(capacity));
  const n = items.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(C + 1));
  for (let i = 1; i <= n; i++) {
    const w = Math.ceil(items[i - 1].w), v = items[i - 1].v;
    for (let c = 0; c <= C; c++) {
      dp[i][c] = dp[i - 1][c];
      if (w <= c && dp[i - 1][c - w] + v > dp[i][c]) dp[i][c] = dp[i - 1][c - w] + v;
    }
  }
  const chosen = [];
  for (let i = n, c = C; i > 0; i--) if (dp[i][c] !== dp[i - 1][c]) { chosen.push(i - 1); c -= Math.ceil(items[i - 1].w); }
  return { value: dp[n][C], chosen: chosen.reverse() };
}

// 다중선택 그룹 Knapsack: 챕터(그룹)마다 "읽지 않음/앞부분/전체" 중 하나만 선택 → 분할 패널티 반영
export function groupKnapsack(groups, capacity) {
  const C = Math.max(0, Math.floor(capacity));
  let dp = new Float64Array(C + 1).fill(0);
  const pick = [];
  for (const g of groups) {
    const nd = Float64Array.from(dp);
    const choice = new Int32Array(C + 1).fill(-1);
    g.options.forEach((o, oi) => {
      const w = Math.ceil(o.w);
      for (let c = w; c <= C; c++) if (dp[c - w] + o.v > nd[c]) { nd[c] = dp[c - w] + o.v; choice[c] = oi; }
    });
    pick.push(choice); dp = nd;
  }
  const out = [];
  for (let gi = groups.length - 1, c = C; gi >= 0; gi--) {
    const oi = pick[gi][c];
    if (oi >= 0) { out.unshift({ group: gi, option: oi }); c -= Math.ceil(groups[gi].options[oi].w); }
  }
  return { value: dp[C], picks: out };
}

// 순차 독서 플래너: 슬롯마다 c_s = 가용분·R_s, 남은 청크 중 앞에서부터 담되
// 챕터 중간에서 끊으면 패널티. (끝 지점 j 선택을 DP로 최적화)
export function planSessions({ chunks, slots, splitPenalty = 0.6, wpm = 180 }) {
  let i = 0;
  const plan = [];
  for (const s of slots) {
    const cap = s.availableMin * s.readiness;
    let best = { j: i, score: 0, used: 0 };
    let used = 0, val = 0;
    for (let j = i; j < chunks.length; j++) {
      const c = chunks[j];
      const cost = (c.eojeol / wpm) * (0.8 + 0.6 * c.load);
      if (used + cost > cap) break;
      used += cost; val += c.importance + (j > i ? 0.15 : 0); // 연속성 보너스
      const boundary = j + 1 === chunks.length || chunks[j + 1].chapter !== c.chapter;
      const score = val - (boundary ? 0 : splitPenalty);
      if (score > best.score) best = { j: j + 1, score, used };
    }
    const taken = chunks.slice(i, best.j);
    plan.push({ ...s, capacity: +cap.toFixed(1), minutes: Math.round(best.used), chunks: taken, endsAtBoundary: !taken.length || best.j === chunks.length || chunks[best.j]?.chapter !== taken.at(-1).chapter });
    i = best.j;
  }
  return { plan, remaining: chunks.slice(i) };
}

// 캘린더 빈 시간 + 준비도 곡선 → 추천 슬롯 상위 n개
export function suggestSlots(curve, freeWindows, n = 3) {
  const cands = [];
  for (const w of freeWindows) {
    const s = toH(w.start), e = toH(w.end);
    const inWin = curve.filter((p) => p.t >= s && p.t + 0.25 <= e);
    if (!inWin.length) continue;
    const best = inWin.reduce((a, b) => (b.r > a.r ? b : a));
    cands.push({ start: fmt(best.t), t: best.t, availableMin: Math.round((e - best.t) * 60 > 60 ? 45 : (e - best.t) * 60), readiness: +best.r.toFixed(2), label: w.label });
  }
  return cands.sort((a, b) => b.readiness - a.readiness).slice(0, n).sort((a, b) => a.t - b.t);
}
export function fmt(t) { const h = Math.floor(t), m = Math.round((t - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
