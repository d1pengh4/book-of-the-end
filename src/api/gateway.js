// API Gateway & Event Streaming (데모): 토큰버킷 레이트리밋, 지연 시뮬레이션, 서킷브레이커, TTL 캐시, SLO(p95) 추적, 이벤트 버스
import { quantile, mulberry32, gaussian } from '../core/math.js';
import { pseudoId } from '../core/privacy.js';

const rng = mulberry32(Date.now() % 100000);

export const SLO = {
  'Reco.GetFeed': 250, 'Library.FindAvailability': 600, 'Scheduler.PlanSessions': 400, 'Rag.SummarizeChapter': 1200, 'Rag.Ask': 1200,
  'Quiz.NextItem': 300, 'Quiz.Submit': 300, 'Classroom.GetCohortHeatmap': 800, 'Demand.Forecast': 2000, 'Nlp.Analyze': 300, 'Onboarding.Cat': 300,
  'Consent.Update': 300, 'Privacy.Export': 800, 'Materials.Generate': 15000,
};

export class TokenBucket {
  constructor(rate = 20, burst = 40) { this.rate = rate; this.cap = burst; this.tokens = burst; this.t = performance.now(); }
  take() {
    const now = performance.now();
    this.tokens = Math.min(this.cap, this.tokens + ((now - this.t) / 1000) * this.rate);
    this.t = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1; return true;
  }
}

export class CircuitBreaker {
  constructor(name, { threshold = 3, coolMs = 15000 } = {}) { this.name = name; this.threshold = threshold; this.coolMs = coolMs; this.fails = 0; this.state = 'closed'; this.openedAt = 0; }
  canPass() {
    if (this.state === 'open' && performance.now() - this.openedAt > this.coolMs) this.state = 'half-open';
    return this.state !== 'open';
  }
  success() { this.fails = 0; this.state = 'closed'; }
  failure() { this.fails++; if (this.fails >= this.threshold || this.state === 'half-open') { this.state = 'open'; this.openedAt = performance.now(); } }
}

export class TtlCache {
  constructor() { this.m = new Map(); }
  get(k) { const e = this.m.get(k); if (!e) return null; return { value: e.value, stale: Date.now() > e.exp, age: Date.now() - e.at }; }
  set(k, value, ttlMs) { this.m.set(k, { value, exp: Date.now() + ttlMs, at: Date.now() }); }
}

// 이벤트 버스 (Kafka 토픽 근사): 스키마 버전, PII 토큰화, user_pseudo_id 일 단위 솔트 회전
export class EventBus {
  constructor() { this.log = []; this.subs = new Set(); }
  emit(topic, payload, { userId, consentScope = ['analytics'] } = {}) {
    const e = { event_id: crypto.randomUUID?.() ?? String(Math.random()).slice(2), topic, ts: new Date().toISOString(), schema_version: 3, user_pseudo_id: userId ? pseudoId(userId) : null, consent_scope: consentScope, ...payload };
    this.log.unshift(e);
    if (this.log.length > 300) this.log.pop();
    this.subs.forEach((f) => f(e));
    return e;
  }
  on(f) { this.subs.add(f); return () => this.subs.delete(f); }
}

export class Gateway {
  constructor() {
    this.bucket = new TokenBucket();
    this.calls = [];
    this.lat = {};
    this.breakers = { 정보나루: new CircuitBreaker('정보나루'), 'Kakao Mobility': new CircuitBreaker('Kakao Mobility'), 'LLM 제공사': new CircuitBreaker('LLM 제공사'), HealthKit: new CircuitBreaker('HealthKit') };
    this.faults = { 정보나루: false, 'Kakao Mobility': false, 'LLM 제공사': false, HealthKit: false };
    this.cache = new TtlCache();
    this.bus = new EventBus();
    this.listeners = new Set();
  }
  onCall(f) { this.listeners.add(f); return () => this.listeners.delete(f); }

  // 외부 연동 호출: 장애 주입·서킷브레이커·폴백
  async external(name, fn, fallback) {
    const br = this.breakers[name];
    if (!br.canPass()) return { ...(await fallback('circuit-open')), degraded: `${name} 서킷 열림` };
    await sleep(40 + Math.abs(gaussian(rng)) * 60);
    if (this.faults[name] || rng() < 0.02) {
      br.failure();
      return { ...(await fallback('error')), degraded: `${name} 응답 실패` };
    }
    br.success();
    return fn();
  }

  async call(method, handler, { meanMs = 60 } = {}) {
    const t0 = performance.now();
    if (!this.bucket.take()) {
      const rec = { method, status: 429, ms: 0, at: new Date() };
      this.record(rec);
      throw Object.assign(new Error('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'), { status: 429 });
    }
    await sleep(Math.max(5, meanMs + gaussian(rng) * meanMs * 0.3));
    try {
      const res = await handler();
      const ms = Math.round(performance.now() - t0);
      this.record({ method, status: 200, ms, at: new Date(), cache: res?._cache, degraded: res?.degraded });
      return res;
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      this.record({ method, status: e.status ?? 500, ms, at: new Date(), error: e.message });
      throw e;
    }
  }
  record(rec) {
    this.calls.unshift(rec);
    if (this.calls.length > 200) this.calls.pop();
    (this.lat[rec.method] ??= []).push(rec.ms);
    this.listeners.forEach((f) => f(rec));
  }
  sloReport() {
    return Object.entries(this.lat).map(([m, xs]) => ({ method: m, n: xs.length, p95: Math.round(quantile(xs, 0.95)), target: SLO[m] ?? null, ok: SLO[m] ? quantile(xs, 0.95) <= SLO[m] : true }));
  }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
