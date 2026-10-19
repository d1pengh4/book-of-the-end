// 10장 보안·프라이버시: k-익명 집계, 차분 프라이버시(라플라스), 일 단위 솔트 회전 가명화, append-only 해시체인 동의 원장, ABAC
import { fnv1a } from './math.js';

// k-익명성: 그룹 크기 < k 이면 억제
export function kAnonymize(groups, k) {
  return groups.map((g) => (g.n < k ? { ...g, suppressed: true, value: null } : { ...g, suppressed: false }));
}

// 라플라스 메커니즘: 민감도 Δ / ε 스케일
export function laplace(rng, scale) {
  const u = rng() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}
export function dpCount(count, { epsilon = 1.0, sensitivity = 1, rng = Math.random } = {}) {
  return Math.max(0, Math.round(count + laplace(rng, sensitivity / epsilon)));
}

// user_pseudo_id: 일 단위 솔트 회전 해시
export function pseudoId(userId, date = new Date(), secret = 'demo-pepper') {
  const day = date.toISOString().slice(0, 10);
  return 'u_' + fnv1a(`${secret}:${day}:${userId}`) + fnv1a(`${day}:${userId}:${secret}`).slice(0, 4);
}

// 동의 원장: append-only + 해시체인 (Repudiation 대응)
export class ConsentLedger {
  constructor(entries = []) { this.entries = entries; }
  append({ userId, purpose, scope, action, version = 'v2.0', at = new Date().toISOString() }) {
    const prev = this.entries.at(-1)?.hash ?? '00000000';
    const body = { userId, purpose, scope, action, version, at, prev };
    const hash = fnv1a(JSON.stringify(body));
    const e = { ...body, hash };
    this.entries.push(e);
    return e;
  }
  verify() {
    return this.entries.every((e, i) => {
      const { hash, ...body } = e;
      const prevOk = body.prev === (i ? this.entries[i - 1].hash : '00000000');
      return prevOk && fnv1a(JSON.stringify(body)) === hash;
    });
  }
  current(userId) {
    const st = {};
    for (const e of this.entries.filter((x) => x.userId === userId)) st[e.purpose] = e.action === 'grant';
    return st;
  }
}

// ABAC(OPA 정책 근사): 역할 + 속성 → 허용/거부
export function authorize(subject, action, resource) {
  if (subject.role === 'learner') {
    if (resource.ownerId !== subject.id) return deny('본인 데이터만 볼 수 있어요');
    if (resource.kind === 'bio' && subject.age < 14) return deny('만 14세 미만은 생체 기능이 꺼져 있어요');
    return allow();
  }
  if (subject.role === 'teacher') {
    if (resource.kind === 'bio' && resource.granularity === 'individual') return deny('교사는 개인 생체 지표를 볼 수 없어요');
    if (resource.kind === 'cohort' && resource.n < 5) return deny('집계 인원이 5명 미만이에요');
    return allow();
  }
  if (subject.role === 'librarian') {
    if (resource.kind !== 'region-aggregate') return deny('지역 집계 통계만 볼 수 있어요');
    if (resource.n < 10) return deny('k-익명성 기준(k≥10) 미달');
    return allow({ dpEpsilon: 1.0 });
  }
  return deny('권한이 없어요');
}
const allow = (obligations = {}) => ({ allow: true, obligations });
const deny = (reason) => ({ allow: false, reason });
