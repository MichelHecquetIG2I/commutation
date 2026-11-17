/* =====================================================================
   Optimisation directe : SQP (une contrainte d'inégalité + bornes) et NSGA-II
   ---------------------------------------------------------------------
   Variables codées dans [−1, 1]^k. Les fonctions évaluées peuvent être
   coûteuses (calcul EF ou MEC) : les algorithmes sont asynchrones et
   comptent les évaluations.

   SQP (programmation quadratique successive), à chaque itération :
     1. gradients de f et de c par différences finies avant (k évaluations) ;
     2. hessien du lagrangien approché par BFGS amorti (Powell) ;
     3. sous-problème quadratique : min ½dᵀBd + ∇fᵀd
          s.c. c + ∇cᵀd ≤ 0 et bornes  −1 ≤ x + d ≤ 1
        (résolu exactement : bornes par ensemble actif, contrainte par
        dichotomie sur son multiplicateur µ ≥ 0) ;
     4. recherche linéaire sur la fonction de mérite L1 : φ = f + ρ·max(0, c).
   NSGA-II (Deb et al., 2002) : tri non dominé, distance de surpeuplement,
   tournoi binaire, croisement SBX, mutation polynomiale, domination sous
   contrainte (un point admissible domine un point non admissible).
   ===================================================================== */
(function (root) {
  'use strict';
  const tick = () => new Promise(r => setTimeout(r, 0));
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const mv = (M, v) => M.map(r => dot(r, v));

  /* ---- QP en boîte : min ½dᵀHd + gᵀd, l ≤ d ≤ u (ensemble actif, H définie positive) ---- */
  function solveSmall(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c] || 1e-14; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; } }
    return M.map((r, i) => r[n] / (r[i] || 1e-14)); }
  function boxQP(H, g, l, u) {
    const n = g.length; let act = new Array(n).fill(0), d = new Array(n).fill(0);
    for (let it = 0; it < 50; it++) {
      const F = [...Array(n).keys()].filter(i => !act[i]);
      for (let i = 0; i < n; i++) if (act[i]) d[i] = act[i] < 0 ? l[i] : u[i];
      if (F.length) { const A = F.map(i => F.map(j => H[i][j])), b = F.map(i => -(g[i] + d.reduce((s, v, j) => s + (act[j] ? H[i][j] * v : 0), 0))); const z = solveSmall(A, b); F.forEach((i, q) => d[i] = z[q]); }
      // variables libres hors bornes → actives
      let ch = false; for (let i = 0; i < n; i++) if (!act[i]) { if (d[i] < l[i] - 1e-12) { act[i] = -1; ch = true; } else if (d[i] > u[i] + 1e-12) { act[i] = 1; ch = true; } }
      if (ch) continue;
      // multiplicateurs des bornes actives : grad = Hd + g ; borne basse active si grad ≥ 0, haute si grad ≤ 0
      const gr = mv(H, d).map((v, i) => v + g[i]); let rel = -1, worst = 0;
      for (let i = 0; i < n; i++) if (act[i]) { const lam = act[i] < 0 ? gr[i] : -gr[i]; if (lam < worst - 1e-12) { worst = lam; rel = i; } }
      if (rel < 0) break; act[rel] = 0;
    }
    return d.map((v, i) => Math.min(u[i], Math.max(l[i], v)));
  }
  /* ---- QP avec une contrainte linéaire aᵀd ≤ β : dichotomie sur µ ---- */
  function qp1(H, g, a, beta, l, u) {
    const solve = mu => boxQP(H, g.map((v, i) => v + mu * (a ? a[i] : 0)), l, u);
    let d = solve(0);
    if (!a || dot(a, d) <= beta + 1e-10) return { d, mu: 0 };
    let lo = 0, hi = 1; while (dot(a, solve(hi)) > beta && hi < 1e8) hi *= 4;
    for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (dot(a, solve(m)) > beta) lo = m; else hi = m; }
    d = solve(hi); return { d, mu: hi, infeasible: dot(a, d) > beta + 1e-6 };
  }

  /* ---- SQP ----
     fun(x) → {f, c}  (f à minimiser, c ≤ 0 admissible ; c = −Infinity ou absent si pas de contrainte) */
  async function sqp(fun, x0, opts = {}) {
    const k = x0.length, h = opts.h ?? 0.03, maxIter = opts.maxIter ?? 15, tol = opts.tol ?? 1e-3, log = opts.log || (() => {});
    let nev = 0; const ev = async x => { nev++; await tick(); const r = await fun(x); return { f: r.f, c: r.c ?? -Infinity }; };
    let x = x0.slice(), cur = await ev(x), B = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))), rho = 1, hist = [];
    const central = !!opts.central;
    const grads = async (x, cur) => { const gf = [], gc = []; for (let i = 0; i < k; i++) {
        if (central && x[i] - h >= -1 && x[i] + h <= 1) { const yp = x.slice(), ym = x.slice(); yp[i] += h; ym[i] -= h; const rp = await ev(yp), rm = await ev(ym); gf.push((rp.f - rm.f) / (2 * h)); gc.push(isFinite(cur.c) ? (rp.c - rm.c) / (2 * h) : 0); continue; }
        const s = x[i] + h <= 1 ? h : -h, y = x.slice(); y[i] += s; const r = await ev(y); gf.push((r.f - cur.f) / s); gc.push(isFinite(cur.c) ? (r.c - cur.c) / s : 0); } return { gf, gc }; };
    let G = await grads(x, cur), fScale = Math.max(1e-9, Math.abs(cur.f));
    // échelle initiale du hessien : ‖∇f‖ (pas initial de l'ordre de 1 en variables codées)
    const g0 = Math.sqrt(dot(G.gf, G.gf)) || 1; B = B.map((r, i) => r.map((v, j) => (i === j ? g0 : 0)));
    log({ it: 0, x: x.slice(), f: cur.f, c: cur.c, step: NaN, nev, mu: 0, note: 'point de départ' });
    for (let it = 1; it <= maxIter; it++) {
      const hasC = isFinite(cur.c);
      const q = qp1(B, G.gf, hasC ? G.gc : null, hasC ? -cur.c : 0, x.map(v => -1 - v), x.map(v => 1 - v));
      const d = q.d, nd = Math.sqrt(dot(d, d));
      rho = Math.max(rho, 1.5 * q.mu + 1e-6);
      const merit = r => r.f + rho * Math.max(0, r.c);
      const m0 = merit(cur), dd = dot(G.gf, d) - rho * Math.max(0, cur.c); // dérivée directionnelle (approchée)
      let t = 1, nx, nr, ok = false;
      for (let ls = 0; ls < 6; ls++) { nx = x.map((v, i) => Math.min(1, Math.max(-1, v + t * d[i]))); nr = await ev(nx); if (merit(nr) <= m0 + 1e-4 * t * Math.min(dd, 0) || nd < 1e-9) { ok = true; break; } t /= 2; }
      if (!ok && merit(nr) > m0) { log({ it, x: x.slice(), f: cur.f, c: cur.c, step: 0, nev, mu: q.mu, note: 'aucune amélioration : arrêt' }); break; }
      const s = nx.map((v, i) => v - x[i]), Gn = await grads(nx, nr);
      // BFGS amorti sur le gradient du lagrangien
      const gl = (Gx, mu) => Gx.gf.map((v, i) => v + mu * Gx.gc[i]), y = gl(Gn, q.mu).map((v, i) => v - gl(G, q.mu)[i]);
      const Bs = mv(B, s), sBs = dot(s, Bs), sy = dot(s, y);
      if (sBs > 1e-14) { const th = sy >= 0.2 * sBs ? 1 : 0.8 * sBs / (sBs - sy), r = y.map((v, i) => th * v + (1 - th) * Bs[i]), sr = dot(s, r);
        if (sr > 1e-14) B = B.map((row, i) => row.map((v, j) => v - Bs[i] * Bs[j] / sBs + r[i] * r[j] / sr)); }
      const step = Math.sqrt(dot(s, s)), df = Math.abs(nr.f - cur.f) / fScale;
      x = nx; cur = nr; G = Gn;
      log({ it, x: x.slice(), f: cur.f, c: cur.c, step, nev, mu: q.mu, t, note: t < 1 ? `pas réduit (t = ${t})` : '' });
      hist.push({ x: x.slice(), f: cur.f, c: cur.c });
      if (step < tol && (!isFinite(cur.c) || cur.c <= 1e-3)) break;
      if (df < 1e-6 && step < 10 * tol && (!isFinite(cur.c) || cur.c <= 1e-3)) break;
    }
    return { x, f: cur.f, c: cur.c, nev, hist };
  }

  /* ---- NSGA-II ----
     fun(x) → {f: [f1, f2, …] (à minimiser), cv: violation de contrainte (≥ 0, 0 = admissible)} */
  async function nsga2(fun, k, opts = {}) {
    const N = opts.pop ?? 40, G = opts.gen ?? 30, R = rng(opts.seed ?? 3), etaC = 15, etaM = 20, pm = 1 / k, onGen = opts.onGen || (() => {});
    let nev = 0; const ev = async x => { nev++; if (nev % 4 === 0) await tick(); const r = await fun(x); return { x, f: r.f, cv: r.cv || 0, extra: r.extra }; };
    const dom = (a, b) => { if (a.cv === 0 && b.cv > 0) return true; if (a.cv > 0 && b.cv === 0) return false; if (a.cv > 0 && b.cv > 0) return a.cv < b.cv;
      let better = false; for (let i = 0; i < a.f.length; i++) { if (a.f[i] > b.f[i]) return false; if (a.f[i] < b.f[i]) better = true; } return better; };
    function sortND(P) { const S = P.map(() => []), n = P.map(() => 0), F = [[]];
      P.forEach((p, i) => { P.forEach((q, j) => { if (i === j) return; if (dom(p, q)) S[i].push(j); else if (dom(q, p)) n[i]++; }); if (n[i] === 0) { p.rank = 0; F[0].push(i); } });
      let r = 0; while (F[r].length) { const nx = []; for (const i of F[r]) for (const j of S[i]) if (--n[j] === 0) { P[j].rank = r + 1; nx.push(j); } r++; F.push(nx); }
      F.pop(); for (const fr of F) crowd(fr.map(i => P[i])); return F; }
    function crowd(L) { L.forEach(p => p.cd = 0); if (!L.length) return; const m = L[0].f.length;
      for (let o = 0; o < m; o++) { L.sort((a, b) => a.f[o] - b.f[o]); const lo = L[0].f[o], hi = L[L.length - 1].f[o]; L[0].cd = L[L.length - 1].cd = Infinity;
        for (let i = 1; i < L.length - 1; i++) L[i].cd += hi > lo ? (L[i + 1].f[o] - L[i - 1].f[o]) / (hi - lo) : 0; } }
    const tour = P => { const a = P[Math.floor(R() * P.length)], b = P[Math.floor(R() * P.length)]; return a.rank < b.rank || (a.rank === b.rank && a.cd > b.cd) ? a : b; };
    function sbx(p1, p2) { const c1 = p1.slice(), c2 = p2.slice(); if (R() > 0.9) return [c1, c2];
      for (let i = 0; i < k; i++) { if (R() > 0.5 || Math.abs(p1[i] - p2[i]) < 1e-12) continue; const u = R(), b = u <= 0.5 ? Math.pow(2 * u, 1 / (etaC + 1)) : Math.pow(1 / (2 * (1 - u)), 1 / (etaC + 1));
        c1[i] = 0.5 * ((1 + b) * p1[i] + (1 - b) * p2[i]); c2[i] = 0.5 * ((1 - b) * p1[i] + (1 + b) * p2[i]); }
      return [c1, c2]; }
    function mut(x) { return x.map(v => { if (R() > pm) return v; const u = R(), d = u < 0.5 ? Math.pow(2 * u, 1 / (etaM + 1)) - 1 : 1 - Math.pow(2 * (1 - u), 1 / (etaM + 1)); return Math.min(1, Math.max(-1, v + 2 * d)); }); }
    const clip = x => x.map(v => Math.min(1, Math.max(-1, v)));
    let P = []; for (let i = 0; i < N; i++) P.push(await ev(Array.from({ length: k }, () => -1 + 2 * R())));
    sortND(P); onGen(0, P, nev);
    for (let g = 1; g <= G; g++) {
      const Q = []; while (Q.length < N) { const [a, b] = sbx(tour(P).x, tour(P).x); Q.push(await ev(clip(mut(a)))); if (Q.length < N) Q.push(await ev(clip(mut(b)))); }
      const U = P.concat(Q), F = sortND(U), nx = [];
      for (const fr of F) { const L = fr.map(i => U[i]); if (nx.length + L.length <= N) nx.push(...L); else { L.sort((a, b) => b.cd - a.cd); nx.push(...L.slice(0, N - nx.length)); break; } }
      P = nx; sortND(P); onGen(g, P, nev);
    }
    return { pop: P, front: P.filter(p => p.rank === 0 && p.cv === 0), nev };
  }

  const api = { sqp, nsga2, boxQP, qp1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OPTIM = api;
})(typeof window !== 'undefined' ? window : globalThis);
