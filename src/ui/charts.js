// SVG 차트: 레이더, 준비도 곡선, 예측 밴드, 지도, 경로, 지식 그래프
import { raw } from './h.js';
import { projector } from '../core/gis.js';
import { mulberry32 } from '../core/math.js';

const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function radarSvg(scores, axes, size = 260) {
  const c = size / 2, r = size / 2 - 44, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]; };
  const rings = [0.25, 0.5, 0.75, 1].map((v) => `<polygon points="${axes.map((_, i) => pt(i, v).join(',')).join(' ')}" style="fill:none;stroke:var(--line)" />`).join('');
  const spokes = axes.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}" style="stroke:var(--line)" />`).join('');
  const poly = axes.map((a, i) => pt(i, scores[a.k] / 100).join(',')).join(' ');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" style="fill:var(--fg-2);font-size:11px">${e(a.label)}</text><text x="${x}" y="${y + 13}" text-anchor="middle" style="fill:var(--fg);font-size:11px;font-weight:700">${scores[a.k]}</text>`; }).join('');
  return raw(`<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px" role="img" aria-label="문체·난이도 6축 레이더: ${axes.map((a) => `${a.label} ${scores[a.k]}`).join(', ')}">${rings}${spokes}<polygon points="${poly}" style="fill:var(--accent-soft);stroke:var(--accent);stroke-width:2" />${axes.map((a, i) => { const [x, y] = pt(i, scores[a.k] / 100); return `<circle cx="${x}" cy="${y}" r="3.5" style="fill:var(--accent)" />`; }).join('')}${labels}</svg>`);
}

export function curveSvg(curve, slots = [], nowT = null, w = 340, h = 130) {
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const X = (t) => pad.l + ((t - 6) / 18) * (w - pad.l - pad.r);
  const Y = (r) => pad.t + (1 - r) * (h - pad.t - pad.b);
  const d = curve.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.r).toFixed(1)}`).join('');
  const area = `${d}L${X(24)},${Y(0)}L${X(6)},${Y(0)}Z`;
  const bands = slots.map((s) => `<rect x="${X(s.t) - 9}" y="${pad.t}" width="18" height="${h - pad.t - pad.b}" rx="6" style="fill:var(--accent-soft)" /><circle cx="${X(s.t)}" cy="${Y(s.readiness)}" r="5" style="fill:var(--accent)" />`).join('');
  const ticks = [6, 12, 18, 24].map((t) => `<text x="${X(t)}" y="${h - 6}" text-anchor="${t === 6 ? 'start' : t === 24 ? 'end' : 'middle'}" style="fill:var(--fg-2);font-size:10px">${t}시</text>`).join('');
  const now = nowT && nowT >= 6 ? `<line x1="${X(nowT)}" x2="${X(nowT)}" y1="${pad.t}" y2="${h - pad.b}" style="stroke:var(--fg);stroke-dasharray:3 3;opacity:.6" /><text x="${X(nowT) + 4}" y="${pad.t + 9}" style="fill:var(--fg);font-size:10px">지금</text>` : '';
  return raw(`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="하루 집중 추정 곡선과 추천 슬롯"><line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--line)" />${bands}<path d="${area}" style="fill:var(--accent);opacity:.08" /><path d="${d}" style="fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linecap:round" />${now}${ticks}</svg>`);
}

export function bandSvg(y, band, w = 640, h = 220, startLabel = '') {
  const all = [...y, ...band.map((b) => b.p90)];
  const max = Math.max(...all) * 1.08, min = Math.min(0, ...y);
  const n = y.length + band.length;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const X = (i) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  const line = y.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const off = y.length - 1;
  const up = band.map((b, i) => `L${X(off + 1 + i).toFixed(1)},${Y(b.p90).toFixed(1)}`).join('');
  const dn = [...band].reverse().map((b, i) => `L${X(off + band.length - i).toFixed(1)},${Y(b.p10).toFixed(1)}`).join('');
  const bandPath = `M${X(off)},${Y(y[off])}${up}${dn}Z`;
  const p50 = `M${X(off)},${Y(y[off])}` + band.map((b, i) => `L${X(off + 1 + i).toFixed(1)},${Y(b.p50).toFixed(1)}`).join('');
  const grid = [0.25, 0.5, 0.75, 1].map((f) => { const v = min + (max - min) * f; return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line);opacity:.6" /><text x="${pad.l - 6}" y="${Y(v) + 3}" text-anchor="end" style="fill:var(--fg-2);font-size:10px">${Math.round(v)}</text>`; }).join('');
  const yrs = [0, 12, 24].map((i) => `<text x="${X(i)}" y="${h - 6}" style="fill:var(--fg-2);font-size:10px">${startLabel ? `${+startLabel + i / 12}년` : `${i}개월`}</text>`).join('');
  return raw(`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="월별 대출 수요 실적과 향후 ${band.length}개월 예측 구간">${grid}<path d="${bandPath}" style="fill:var(--accent);opacity:.16" /><path d="${line}" style="fill:none;stroke:var(--fg);stroke-width:1.8" /><path d="${p50}" style="fill:none;stroke:var(--accent);stroke-width:2.2;stroke-dasharray:5 4" /><circle cx="${X(n - 1)}" cy="${Y(band.at(-1).p50)}" r="4" style="fill:var(--accent)" />${yrs}<text x="${X(off) + 4}" y="${pad.t + 10}" style="fill:var(--fg-2);font-size:10px">예측 →</text></svg>`);
}

// 데모 지도: 실제 지도 타일 대신 좌표를 투영한 도식 지도
export function mapSvg({ user, places, highlight, w = 360, h = 200, route = null }) {
  const pts = [user, ...places].filter(Boolean);
  const P = projector(pts, w, h, 28);
  const roads = (() => { const r = mulberry32(4); return Array.from({ length: 6 }, () => { const a = [r() * w, r() * h], b = [r() * w, r() * h], c = [r() * w, r() * h]; return `<path d="M${a}Q${b} ${c}" style="fill:none;stroke:var(--map-road);stroke-width:${4 + r() * 8}" />`; }).join(''); })();
  const rpath = route ? `<path d="${route.map((p, i) => { const q = P(p); return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join('')}" style="fill:none;stroke:var(--accent);stroke-width:2.5;stroke-dasharray:6 5" />` : '';
  const pins = places.map((p, i) => {
    const q = P(p), hi = highlight && (p.code === highlight || p.name === highlight);
    const fill = hi ? 'var(--accent)' : p.muted ? 'var(--fg-3)' : 'var(--sage)';
    return `<g><path transform="translate(${q.x - 10},${q.y - 24})" d="M10 24s-8-7-8-13a8 8 0 0 1 16 0c0 6-8 13-8 13z" style="fill:${fill}" /><circle cx="${q.x}" cy="${q.y - 13}" r="3" style="fill:var(--surface)" />${hi || places.length <= 8 ? `<text x="${q.x + 11}" y="${q.y - 12}" style="fill:var(--fg);font-size:10px;paint-order:stroke;stroke:var(--map-bg);stroke-width:3px">${e(route ? `${i}. ${p.name}` : p.name)}</text>` : ''}</g>`;
  }).join('');
  const u = user ? (() => { const q = P(user); return `<circle cx="${q.x}" cy="${q.y}" r="12" style="fill:var(--accent);opacity:.15" /><circle cx="${q.x}" cy="${q.y}" r="6" style="fill:var(--fg);stroke:var(--surface);stroke-width:2" />`; })() : '';
  return raw(`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="주변 도서관 위치 도식 지도" style="display:block;background:var(--map-bg);border-radius:var(--r-lg)">${roads}${rpath}${u}${pins}</svg>`);
}

// 지식 그래프 2D (3D는 저사양·모션 줄이기 대응으로 2D 기본): 결정적 힘-기반 배치
const layoutCache = new Map();
export function graphLayout(nodes, edges, w, h) {
  const key = nodes.map((n) => n.id).join(',') + w;
  if (layoutCache.has(key)) return layoutCache.get(key);
  const r = mulberry32(9);
  const pos = Object.fromEntries(nodes.map((n, i) => [n.id, { x: w / 2 + Math.cos(i * 2.4) * w * 0.3 + r() * 10, y: h / 2 + Math.sin(i * 2.4) * h * 0.3 + r() * 10 }]));
  for (let it = 0; it < 300; it++) {
    const f = Object.fromEntries(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue;
      const dx = pos[a.id].x - pos[b.id].x, dy = pos[a.id].y - pos[b.id].y, d2 = dx * dx + dy * dy + 0.01;
      f[a.id].x += (dx / d2) * 1800; f[a.id].y += (dy / d2) * 1800;
    }
    for (const e2 of edges) {
      const a = pos[e2.a], b = pos[e2.b]; if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = (d - 80) * 0.02;
      f[e2.a].x += (dx / d) * k * d * 0.05; f[e2.a].y += (dy / d) * k * d * 0.05;
      f[e2.b].x -= (dx / d) * k * d * 0.05; f[e2.b].y -= (dy / d) * k * d * 0.05;
    }
    for (const n of nodes) {
      const p = pos[n.id];
      p.x += Math.max(-6, Math.min(6, f[n.id].x + (w / 2 - p.x) * 0.01));
      p.y += Math.max(-6, Math.min(6, f[n.id].y + (h / 2 - p.y) * 0.01));
      p.x = Math.max(40, Math.min(w - 40, p.x)); p.y = Math.max(24, Math.min(h - 24, p.y));
    }
  }
  layoutCache.set(key, pos);
  return pos;
}
export function graphSvg({ nodes, edges, mastery = {}, sel = null, w = 360, h = 300 }) {
  const pos = graphLayout(nodes, edges, w, h);
  const ed = edges.map((g) => { const a = pos[g.a], b = pos[g.b]; if (!a || !b) return ''; const on = sel && (g.a === sel || g.b === sel); return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" style="stroke:${on ? 'var(--accent)' : 'var(--line-strong)'};stroke-width:${1 + g.conf * 2};opacity:${sel && !on ? 0.3 : 0.9}" ${g.rel === 'prereq' || g.rel === 'prereq-rev' ? 'stroke-dasharray="0"' : 'stroke-dasharray="4 3"'} />`; }).join('');
  const nd = nodes.map((n) => {
    const p = pos[n.id], m = mastery[n.id];
    const fill = m == null ? 'var(--surface)' : m >= 0.7 ? 'var(--sage)' : m >= 0.4 ? 'var(--honey)' : 'var(--accent)';
    const rr = 10 + Math.min(10, n.count * 1.2);
    return `<g data-act="graph-sel" data-arg="${n.id}" style="cursor:pointer" tabindex="0" role="button" aria-label="${e(n.label)} 개념 보기"><circle cx="${p.x}" cy="${p.y}" r="${rr}" style="fill:${fill};stroke:${sel === n.id ? 'var(--fg)' : 'var(--line-strong)'};stroke-width:${sel === n.id ? 2.5 : 1.2}" /><text x="${p.x}" y="${p.y + rr + 12}" text-anchor="middle" style="fill:var(--fg);font-size:11px;paint-order:stroke;stroke:var(--surface);stroke-width:3px">${e(n.label)}</text></g>`;
  }).join('');
  return raw(`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="챕터 개념 지식 그래프">${ed}${nd}</svg>`);
}

export function sparkline(xs, w = 80, h = 22) {
  const mx = Math.max(...xs), mn = Math.min(...xs);
  const d = xs.map((v, i) => `${i ? 'L' : 'M'}${((i / (xs.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6)).toFixed(1)}`).join('');
  const last = xs.at(-1), lx = w - 2, ly = h - 3 - ((last - mn) / (mx - mn || 1)) * (h - 6);
  return raw(`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" style="fill:none;stroke:var(--fg-2);stroke-width:1.5" /><circle cx="${lx}" cy="${ly}" r="2.5" style="fill:var(--accent)" /></svg>`);
}
