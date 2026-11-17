/* =====================================================================
   Plans d'expériences et modèles de surface de réponse
   ---------------------------------------------------------------------
   Variables codées dans [−1, 1] (hors points axiaux des composites
   circonscrits). Plans : factoriel complet 2^k et 3^k, fractionnaire
   2^(k−p), Plackett-Burman (12 essais), composite centré (CCF, CCC, CCI),
   Box-Behnken, hypercube latin (maximin), plans optimaux D et I
   (algorithme d'échange sur une grille de candidats).
   Modèles : linéaire, linéaire + interactions, quadratique complet.
   Ajustement par moindres carrés (Cholesky sur XᵀX), R², R² ajusté,
   Q² (PRESS), écarts-types et t des coefficients, VIF, critères D et I.
   ===================================================================== */
(function (root) {
  'use strict';

  /* ---------- outils ---------- */
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const cart = (levels, k) => { let out = [[]]; for (let j = 0; j < k; j++) { const nx = []; for (const r of out) for (const v of levels) nx.push([...r, v]); out = nx; } return out; };
  function chol(A, n) { const L = new Float64Array(n * n); for (let j = 0; j < n; j++) { let s = A[j * n + j]; for (let k = 0; k < j; k++) s -= L[j * n + k] ** 2; if (!(s > 1e-12 * Math.max(1, Math.abs(A[j * n + j])))) return null; const d = Math.sqrt(s); L[j * n + j] = d; for (let i = j + 1; i < n; i++) { let t = A[i * n + j]; for (let k = 0; k < j; k++) t -= L[i * n + k] * L[j * n + k]; L[i * n + j] = t / d; } } return L; }
  function cholSolve(L, n, b) { const y = Float64Array.from(b); for (let i = 0; i < n; i++) { let t = y[i]; for (let k = 0; k < i; k++) t -= L[i * n + k] * y[k]; y[i] = t / L[i * n + i]; } for (let i = n - 1; i >= 0; i--) { let t = y[i]; for (let k = i + 1; k < n; k++) t -= L[k * n + i] * y[k]; y[i] = t / L[i * n + i]; } return y; }
  function cholInv(L, n) { const inv = new Float64Array(n * n); for (let j = 0; j < n; j++) { const e = new Float64Array(n); e[j] = 1; const c = cholSolve(L, n, e); for (let i = 0; i < n; i++) inv[i * n + j] = c[i]; } return inv; }

  /* ---------- modèles ---------- */
  // terme = liste d'indices de facteurs : [] constante, [i] linéaire, [i, j] interaction, [i, i] carré
  function terms(k, type) {
    const T = [[]];
    for (let i = 0; i < k; i++) T.push([i]);
    if (type === 'int' || type === 'quad') for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) T.push([i, j]);
    if (type === 'quad') for (let i = 0; i < k; i++) T.push([i, i]);
    return T;
  }
  const termName = (t, names) => t.length === 0 ? 'constante' : t.length === 1 ? names[t[0]] : t[0] === t[1] ? names[t[0]] + '²' : names[t[0]] + '·' + names[t[1]];
  const row = (x, T) => T.map(t => t.reduce((s, i) => s * x[i], 1));
  const modelMatrix = (D, T) => D.map(x => row(x, T));
  function info(X, p) { const M = new Float64Array(p * p); for (const r of X) for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) M[i * p + j] += r[i] * r[j]; for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) M[i * p + j] = M[j * p + i]; return M; }

  /* ---------- plans classiques ---------- */
  const full2 = k => cart([-1, 1], k);
  const full3 = k => cart([-1, 0, 1], k);
  // fractionnaires : générateurs usuels (résolution indiquée)
  const FRAC = {
    3: [{ p: 1, gen: [[0, 1]], res: 'III', label: '2^(3−1) : C = AB' }],
    4: [{ p: 1, gen: [[0, 1, 2]], res: 'IV', label: '2^(4−1) : D = ABC' }],
    5: [{ p: 1, gen: [[0, 1, 2, 3]], res: 'V', label: '2^(5−1) : E = ABCD' }, { p: 2, gen: [[0, 1], [0, 2]], res: 'III', label: '2^(5−2) : D = AB, E = AC' }],
    6: [{ p: 1, gen: [[0, 1, 2, 3, 4]], res: 'VI', label: '2^(6−1) : F = ABCDE' }, { p: 2, gen: [[0, 1, 2], [1, 2, 3]], res: 'IV', label: '2^(6−2) : E = ABC, F = BCD' }, { p: 3, gen: [[0, 1], [0, 2], [1, 2]], res: 'III', label: '2^(6−3) : D = AB, E = AC, F = BC' }],
  };
  function frac(k, variant = 0) {
    const f = (FRAC[k] || [])[variant]; if (!f) return null;
    return full2(k - f.p).map(b => [...b, ...f.gen.map(g => g.reduce((s, i) => s * b[i], 1))]);
  }
  // Plackett-Burman à 12 essais (jusqu'à 11 facteurs) : permutations circulaires de la ligne génératrice + ligne de −1
  function pb12(k) { const g = [1, 1, -1, 1, 1, 1, -1, -1, -1, 1, -1], D = []; for (let r = 0; r < 11; r++) D.push(Array.from({ length: k }, (_, j) => g[(j - r + 11) % 11])); D.push(Array(k).fill(-1)); return D; }
  // composite centré : partie factorielle (fractionnaire de résolution V si k ≥ 5) + 2k points axiaux + nc centres
  function ccd(k, type = 'ccf', nc = 1) {
    const F = k >= 5 && FRAC[k] ? frac(k, 0) : full2(k), nf = F.length;
    let a = type === 'ccf' ? 1 : Math.pow(nf, 0.25), s = 1;
    if (type === 'cci') { s = 1 / a; a = 1; }
    const D = F.map(r => r.map(v => v * s));
    for (let j = 0; j < k; j++) for (const sg of [-1, 1]) { const r = Array(k).fill(0); r[j] = sg * a; D.push(r); }
    for (let c = 0; c < nc; c++) D.push(Array(k).fill(0));
    return { D, alpha: type === 'cci' ? Math.pow(nf, 0.25) : a };
  }
  // Box-Behnken : chaque paire de facteurs à ±1, les autres au centre (k = 3 à 6) + nc centres
  function bbd(k, nc = 1) { const D = []; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) for (const a of [-1, 1]) for (const b of [-1, 1]) { const r = Array(k).fill(0); r[i] = a; r[j] = b; D.push(r); } for (let c = 0; c < nc; c++) D.push(Array(k).fill(0)); return D; }
  // hypercube latin maximin (meilleur de nTry tirages)
  function lhs(k, n, seed = 1, nTry = 300) {
    const R = rng(seed); let best = null, bestD = -1;
    for (let t = 0; t < nTry; t++) {
      const cols = Array.from({ length: k }, () => { const p = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; });
      const D = Array.from({ length: n }, (_, i) => cols.map(c => -1 + 2 * (c[i] + 0.5) / n));
      let md = Infinity; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let d = 0; for (let q = 0; q < k; q++) d += (D[i][q] - D[j][q]) ** 2; md = Math.min(md, d); }
      if (md > bestD) { bestD = md; best = D; }
    }
    return best;
  }

  /* ---------- critères ---------- */
  function momentMatrix(k, T) { // M = moyenne de f(x) f(x)ᵀ sur [−1,1]^k (grille de Gauss-Legendre à 3 points)
    const gx = [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)], gw = [5 / 18, 8 / 18, 5 / 18], p = T.length, M = new Float64Array(p * p);
    const pts = cart([0, 1, 2], k);
    for (const ix of pts) { const x = ix.map(i => gx[i]), w = ix.reduce((s, i) => s * gw[i], 1), f = row(x, T); for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) M[i * p + j] += w * f[i] * f[j]; }
    return M;
  }
  function criteria(D, T) {
    const p = T.length, n = D.length, X = modelMatrix(D, T), A = info(X, p), L = chol(A, p);
    if (!L || n < p) return { estimable: false, n, p };
    let logdet = 0; for (let i = 0; i < p; i++) logdet += 2 * Math.log(L[i * p + i]);
    const inv = cholInv(L, p), M = momentMatrix(D[0].length, T);
    let I = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) I += inv[i * p + j] * M[j * p + i];
    // VIF : à partir de la matrice de corrélation des colonnes (hors constante)
    let maxVIF = 1;
    if (p > 1) { const cols = []; for (let j = 1; j < p; j++) { const c = X.map(r => r[j]), m = c.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(c.reduce((a, b) => a + (b - m) ** 2, 0)); cols.push(sd > 0 ? c.map(v => (v - m) / sd) : null); }
      if (cols.every(Boolean)) { const q = cols.length, Rm = new Float64Array(q * q); for (let i = 0; i < q; i++) for (let j = 0; j < q; j++) Rm[i * q + j] = cols[i].reduce((s, v, r) => s + v * cols[j][r], 0); const Lr = chol(Rm, q); if (Lr) { const Ri = cholInv(Lr, q); for (let i = 0; i < q; i++) maxVIF = Math.max(maxVIF, Ri[i * q + i]); } else maxVIF = Infinity; } }
    return { estimable: true, n, p, logdet, Deff: 100 * Math.exp(logdet / p) / n, I, maxVIF };
  }

  /* ---------- plans optimaux (échange de Fedorov simplifié) ---------- */
  function optimal(k, n, T, crit = 'D', levels = 3, seed = 1, starts = 6) {
    const lv = levels === 5 ? [-1, -0.5, 0, 0.5, 1] : levels === 2 ? [-1, 1] : [-1, 0, 1];
    const C = cart(lv, k), F = C.map(x => row(x, T)), p = T.length, M = crit === 'I' ? momentMatrix(k, T) : null, R = rng(seed);
    if (n < p) return null;
    const score = idx => { const A = info(idx.map(i => F[i]), p); for (let i = 0; i < p; i++) A[i * p + i] += 1e-9; const L = chol(A, p); if (!L) return -Infinity;
      if (crit === 'D') { let s = 0; for (let i = 0; i < p; i++) s += 2 * Math.log(L[i * p + i]); return s; }
      const inv = cholInv(L, p); let I = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) I += inv[i * p + j] * M[j * p + i]; return -I; };
    let best = null, bestS = -Infinity;
    for (let s = 0; s < starts; s++) {
      let idx = Array.from({ length: n }, () => Math.floor(R() * C.length)), sc = score(idx), tries = 0;
      while (!isFinite(sc) && tries++ < 50) { idx = Array.from({ length: n }, () => Math.floor(R() * C.length)); sc = score(idx); }
      for (let pass = 0; pass < 30; pass++) {
        let improved = false;
        for (let i = 0; i < n; i++) { let bi = idx[i], bs = sc; for (let c = 0; c < C.length; c++) { if (c === idx[i]) continue; const old = idx[i]; idx[i] = c; const v = score(idx); idx[i] = old; if (v > bs + 1e-10) { bs = v; bi = c; } } if (bi !== idx[i]) { idx[i] = bi; sc = bs; improved = true; } }
        if (!improved) break;
      }
      if (sc > bestS) { bestS = sc; best = idx.slice(); }
    }
    return best ? best.map(i => C[i].slice()).sort((a, b) => { for (let j = 0; j < k; j++) if (a[j] !== b[j]) return a[j] - b[j]; return 0; }) : null;
  }

  /* ---------- ajustement ---------- */
  function fit(D, y, T) {
    const n = D.length, p = T.length, X = modelMatrix(D, T), A = info(X, p), L = chol(A, p);
    if (!L || n < p) return { ok: false, n, p };
    const Xty = new Float64Array(p); X.forEach((r, i) => r.forEach((v, j) => Xty[j] += v * y[i]));
    const beta = cholSolve(L, p, Xty), inv = cholInv(L, p);
    const yhat = X.map(r => r.reduce((s, v, j) => s + v * beta[j], 0)), res = y.map((v, i) => v - yhat[i]);
    const ym = y.reduce((a, b) => a + b, 0) / n, sst = y.reduce((a, v) => a + (v - ym) ** 2, 0), sse = res.reduce((a, v) => a + v * v, 0);
    const h = X.map(r => { let s = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) s += r[i] * inv[i * p + j] * r[j]; return s; });
    let press = 0, pressOk = true; res.forEach((e, i) => { if (1 - h[i] < 1e-8) pressOk = false; else press += (e / (1 - h[i])) ** 2; });
    const dof = n - p, s2 = dof > 0 ? sse / dof : NaN, se = Array.from({ length: p }, (_, j) => Math.sqrt(s2 * inv[j * p + j]));
    return { ok: true, n, p, dof, beta: Array.from(beta), yhat, res, h, R2: sst > 0 ? 1 - sse / sst : 1, R2adj: sst > 0 && dof > 0 ? 1 - (sse / dof) / (sst / (n - 1)) : NaN,
      Q2: pressOk && sst > 0 ? 1 - press / sst : NaN, rmse: Math.sqrt(sse / n), s: Math.sqrt(s2), se, t: Array.from(beta).map((b, j) => b / se[j]) };
  }
  const predict = (beta, T, x) => row(x, T).reduce((s, v, j) => s + v * beta[j], 0);

  const api = { rng, terms, termName, modelMatrix, full2, full3, frac, FRAC, pb12, ccd, bbd, lhs, optimal, criteria, fit, predict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DOE = api;
})(typeof window !== 'undefined' ? window : globalThis);
