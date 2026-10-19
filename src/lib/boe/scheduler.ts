// 바이오 스케줄러. 설계서 6.3절.
// 진단이 아니라 "집중하기 좋은 시간대 추정"이다. 센서가 없으면 사용자가 적은 값만 쓴다.
import { sigmoid } from './math';

export type BioInput = {
  sleepHours: number;      // 어젯밤 잔 시간
  sleepQuality: number;    // 0~1 (스스로 느낀 수면 효율)
  busy: number;            // 0~1 오늘 일정 부담
  midSleep: number;        // 수면 중간 시각(시, 예: 3.5 = 새벽 3시 반) → 크로노타입
};

/** 하루 리듬: 수면 중간 시각 + 약 10시간 무렵이 가장 또렷하다고 보는 단순 모형 */
export function circadian(hour: number, midSleep: number) {
  const peak = (midSleep + 10) % 24;
  let d = Math.abs(hour - peak);
  d = Math.min(d, 24 - d);
  // 점심 뒤(피크 + 4~6시간) 살짝 처지는 구간을 넣는다
  const dip = Math.exp(-(((hour - ((peak + 5) % 24) + 24) % 24) ** 2) / 2) * 0.25;
  return Math.cos((Math.PI * d) / 12) - dip;
}

/** 준비도 R_t = σ(b0 + b1·z(수면) + b2·z(수면효율) + b3·리듬 − b4·일정부하) */
export function readiness(hour: number, b: BioInput) {
  const zSleep = (b.sleepHours - 7) / 1.2;
  const zEff = (b.sleepQuality - 0.75) / 0.15;
  return sigmoid(0.2 + 0.45 * zSleep + 0.35 * zEff + 1.4 * circadian(hour, b.midSleep) - 1.1 * b.busy);
}

export type Slot = { hour: number; minutes: number; r: number };
export type Chunk = { id: string; label: string; minutes: number; importance: number };
export type Plan = { slot: Slot; chunks: Chunk[]; used: number }[];

/**
 * 0/1 배낭 문제(DP)로 슬롯마다 읽을 청크를 고른다.
 * 슬롯 용량 c = 가용 분 × R, 청크 비용 = 예상 분, 가치 = 중요도 + 순서 보너스.
 * 앞 청크를 건너뛰고 뒤를 읽지 않도록 순서 보너스를 크게 준다.
 */
export function knapsack(chunks: Chunk[], capacity: number) {
  const n = chunks.length;
  const C = Math.max(0, Math.floor(capacity));
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(C + 1));
  const value = chunks.map((c, i) => c.importance + (n - i) * 2);
  for (let i = 1; i <= n; i++) {
    const w = Math.ceil(chunks[i - 1].minutes);
    for (let c = 0; c <= C; c++) {
      dp[i][c] = dp[i - 1][c];
      if (w <= c) dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + value[i - 1]);
    }
  }
  const pick: Chunk[] = [];
  for (let i = n, c = C; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      pick.unshift(chunks[i - 1]);
      c -= Math.ceil(chunks[i - 1].minutes);
    }
  }
  return pick;
}

export function plan(slots: Slot[], chunks: Chunk[]): Plan {
  let rest = [...chunks];
  const order = [...slots].sort((a, b) => a.hour - b.hour);
  return order.map((slot) => {
    const cap = slot.minutes * (0.5 + slot.r * 0.7); // 준비도가 낮으면 덜 담는다
    const picked = knapsack(rest.slice(0, 12), cap);
    rest = rest.filter((c) => !picked.includes(c));
    return { slot, chunks: picked, used: picked.reduce((s, c) => s + c.minutes, 0) };
  });
}
