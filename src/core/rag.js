// 6.5 RAG 파이프라인 및 환각 통제
// Ingest(계층 청킹+오버랩) → Retrieve(BM25 + Dense, RRF) → Rerank → Generate(근거 ID 인용 필수) → Verify(NLI 근사) → Gate
// 데모: 임베딩은 문자 3-gram 해시 벡터, 생성기는 근거 문장 추출·축약형(LLM 대체)으로 동작한다.
import { cosine, fnv1a } from './math.js';
import { splitSentences, eojeols, stem, isStop } from './nlp.js';

const DIM = 256;
export function embed(text) {
  const v = new Float64Array(DIM);
  const t = text.replace(/\s+/g, ' ');
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    if (/^\s+$/.test(g)) continue;
    const h = parseInt(fnv1a(g), 16);
    v[h % DIM] += (h & 1) ? 1 : -1;
  }
  return Array.from(v);
}
const tokens = (s) => eojeols(s).map(stem).filter((w) => w.length >= 1 && !isStop(w));

// 챕터→문단 계층 청킹: 목표 300~500 토큰 근사(여기선 어절 60~110), 오버랩 15%
export function chunkChapter(chapter, { minTok = 60, maxTok = 110, overlap = 0.15 } = {}) {
  const out = [];
  let buf = [], bufTok = 0, idx = 0;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(' ');
    out.push({ id: `${chapter.id}-c${idx++}`, chapter: chapter.id, chapterTitle: chapter.title, text, tok: bufTok });
    // 오버랩: 마지막 문장들을 다음 청크 앞에 남김
    const keep = [];
    let kt = 0;
    for (let i = buf.length - 1; i >= 0 && kt < bufTok * overlap; i--) { keep.unshift(buf[i]); kt += eojeols(buf[i]).length; }
    buf = keep; bufTok = kt;
  };
  for (const para of chapter.paragraphs) {
    for (const s of splitSentences(para)) {
      const t = eojeols(s).length;
      if (bufTok + t > maxTok && bufTok >= minTok) flush();
      buf.push(s); bufTok += t;
    }
    if (bufTok >= minTok) flush(); // 문단 경계(의미 경계)에서 우선 절단
  }
  if (bufTok > (out.length ? minTok * 0.5 : 0)) flush();
  return out;
}

export class Bm25 {
  constructor(docs, { k1 = 1.4, b = 0.75 } = {}) {
    this.k1 = k1; this.b = b;
    this.docs = docs.map((d) => ({ id: d.id, tf: tf(tokens(d.text)), len: tokens(d.text).length }));
    this.avg = this.docs.reduce((s, d) => s + d.len, 0) / (this.docs.length || 1);
    this.df = new Map();
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }
  idf(t) { const n = this.df.get(t) || 0, N = this.docs.length; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); }
  search(q) {
    const qt = tokens(q);
    return this.docs.map((d) => {
      let s = 0;
      for (const t of qt) {
        const f = partialTf(d.tf, t);
        if (!f) continue;
        s += this.idf(t) * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avg)));
      }
      return { id: d.id, score: s };
    }).sort((a, b) => b.score - a.score);
  }
}
function tf(ts) { const m = new Map(); for (const t of ts) m.set(t, (m.get(t) || 0) + 1); return m; }
// 한국어 어간 부분일치(접두 2음절 이상) 허용
function partialTf(map, t) {
  if (map.has(t)) return map.get(t);
  if (t.length < 2) return 0;
  let f = 0;
  for (const [k, v] of map) if (k.length >= 2 && (k.startsWith(t) || t.startsWith(k))) f += v * 0.6;
  return f;
}

export function buildIndex(chapters) {
  const chunks = chapters.flatMap((c) => chunkChapter(c));
  const vecs = new Map(chunks.map((c) => [c.id, embed(c.text)]));
  return { chunks, byId: new Map(chunks.map((c) => [c.id, c])), bm25: new Bm25(chunks), vecs };
}

// RRF 융합: Σ 1/(k + rank)
export function rrf(lists, k = 60) {
  const s = new Map();
  for (const list of lists) list.forEach((r, i) => s.set(r.id, (s.get(r.id) || 0) + 1 / (k + i + 1)));
  return [...s.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

// Cross-Encoder 재랭킹 근사: 질의 토큰 커버리지 × 밀집 유사도
export function rerank(index, query, ids, topK = 6) {
  const qv = embed(query), qt = new Set(tokens(query));
  return ids.map(({ id }) => {
    const c = index.byId.get(id);
    const ct = tokens(c.text);
    const cover = qt.size ? [...qt].filter((t) => ct.some((x) => x.startsWith(t) || t.startsWith(x))).length / qt.size : 0;
    const dense = cosine(qv, index.vecs.get(id));
    return { id, cover, dense, score: 0.6 * cover + 0.4 * dense };
  }).sort((a, b) => b.score - a.score).slice(0, topK);
}

export function retrieve(index, query, { topN = 30, topK = 6, chapter } = {}) {
  const inScope = (id) => !chapter || index.byId.get(id).chapter === chapter;
  const sparse = index.bm25.search(query).filter((r) => inScope(r.id)).slice(0, topN);
  const qv = embed(query);
  const dense = index.chunks.filter((c) => inScope(c.id)).map((c) => ({ id: c.id, score: cosine(qv, index.vecs.get(c.id)) })).sort((a, b) => b.score - a.score).slice(0, topN);
  const fused = rrf([sparse, dense]).slice(0, topN);
  return { sparse, dense, fused, top: rerank(index, query, fused, topK) };
}

// NLI 함의 근사: 주장 내용어가 근거에 등장하는 비율 (어간 부분일치)
export function entailment(claim, evidence) {
  const ct = [...new Set(tokens(claim).filter((t) => t.length >= 2))];
  if (!ct.length) return 0;
  const et = tokens(evidence);
  const hit = ct.filter((t) => et.some((x) => x === t || (x.length >= 2 && (x.startsWith(t) || t.startsWith(x))))).length;
  return hit / ct.length;
}

// 요약 생성(추출형): 근거 청크에서 중심성 높은 문장을 고르고 [근거 ID]를 반드시 붙인다
export function summarize(index, { chapter, query = '핵심 내용 요약', maxSentences = 3, tau = 0.12, entailMin = 0.7, passRate = 0.9 } = {}) {
  const r = retrieve(index, query, { chapter });
  // 챕터 지정 요약은 근거 범위가 챕터 자체이므로 해당 챕터 청크 전체를 근거로 쓴다
  if (chapter) r.top = index.chunks.filter((c) => c.chapter === chapter).map((c) => ({ id: c.id, score: 1 }));
  const maxSim = Math.max(0, ...r.top.map((t) => t.score));
  if (maxSim < tau) return { status: 'insufficient', reason: `최대 유사도 ${maxSim.toFixed(2)} < τ=${tau}`, retrieval: r, claims: [] };
  const evid = r.top.map((t) => index.byId.get(t.id));
  const sents = evid.flatMap((c) => splitSentences(c.text).map((s) => ({ s, chunk: c.id })));
  const uniq = [...new Map(sents.map((x) => [x.s, x])).values()];
  // TextRank 근사: 문장 간 임베딩 유사도 합으로 중심성 계산
  const vecs = uniq.map((x) => embed(x.s));
  const cent = uniq.map((_, i) => vecs.reduce((a, v, j) => a + (i === j ? 0 : Math.max(0, cosine(vecs[i], v))), 0));
  const order = uniq.map((x, i) => ({ ...x, c: cent[i], pos: i })).sort((a, b) => b.c - a.c);
  const picked = [];
  for (const o of order) {
    if (picked.length >= maxSentences) break;
    if (picked.some((p) => cosine(embed(p.s), embed(o.s)) > 0.75)) continue;
    picked.push(o);
  }
  picked.sort((a, b) => a.pos - b.pos);
  // Verify: 각 주장을 인용 근거와 대조
  const claims = picked.map((p) => {
    const text = compress(p.s);
    const e = entailment(text, index.byId.get(p.chunk).text);
    return { text, cite: p.chunk, entail: +e.toFixed(2), pass: e >= entailMin };
  });
  const kept = claims.filter((c) => c.pass);
  const rate = claims.length ? kept.length / claims.length : 0;
  if (rate < passRate) return { status: 'insufficient', reason: `검증 통과율 ${(rate * 100).toFixed(0)}% < ${passRate * 100}%`, retrieval: r, claims };
  return { status: 'ok', claims: kept, retrieval: r, citeRate: 1, maxSim: +maxSim.toFixed(2) };
}
// 문장 축약(괄호·부연 제거) — 생성 단계 대체
function compress(s) { return s.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); }

// 질의응답(근거 인용 강제)
export function answer(index, question, opts = {}) {
  const r = retrieve(index, question, opts);
  const best = r.top[0];
  if (!best || best.score < (opts.tau ?? 0.2)) return { status: 'insufficient', reason: '책 안에서 근거를 찾지 못했어요', retrieval: r };
  const chunk = index.byId.get(best.id);
  const qv = embed(question);
  const sent = splitSentences(chunk.text).map((s) => ({ s, sc: cosine(qv, embed(s)) + entailment(question, s) })).sort((a, b) => b.sc - a.sc)[0];
  return { status: 'ok', text: sent.s, cite: best.id, retrieval: r };
}

// 지식 그래프: 개념 사전 매칭 → 노드, 같은 문장 동시출현 → 엣지(신뢰도 = 동시출현/최소출현)
export function buildGraph(index, concepts) {
  const nodes = new Map(), co = new Map();
  for (const c of index.chunks) {
    for (const s of splitSentences(c.text)) {
      const found = concepts.filter((k) => k.aliases.some((a) => s.includes(a)));
      for (const f of found) {
        const n = nodes.get(f.id) || { id: f.id, label: f.label, count: 0, chapters: new Set(), chunks: new Set() };
        n.count++; n.chapters.add(c.chapter); n.chunks.add(c.id); nodes.set(f.id, n);
      }
      for (let i = 0; i < found.length; i++) for (let j = i + 1; j < found.length; j++) {
        const key = [found[i].id, found[j].id].sort().join('|');
        co.set(key, (co.get(key) || 0) + 1);
      }
    }
  }
  const edges = [...co.entries()].map(([k, n]) => {
    const [a, b] = k.split('|');
    const conf = n / Math.min(nodes.get(a).count, nodes.get(b).count);
    const pre = concepts.find((c) => c.id === b)?.prereq?.includes(a) ? 'prereq' : concepts.find((c) => c.id === a)?.prereq?.includes(b) ? 'prereq-rev' : 'related';
    return { a, b, n, conf: +conf.toFixed(2), rel: pre };
  });
  return { nodes: [...nodes.values()].map((n) => ({ ...n, chapters: [...n.chapters], chunks: [...n.chunks] })), edges };
}
