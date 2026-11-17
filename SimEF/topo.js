/* =====================================================================
   Optimisation topologique ON/OFF d'un circuit magnétique axisymétrique
   ---------------------------------------------------------------------
   Espace de conception : grille régulière de cellules (r, z) couvrant
   l'encombrement du pot (demi-domaine z ≥ 0, symétrie par rapport au
   plan médian). Chaque cellule est soit du fer (ON), soit de l'air (OFF).
   La bobine et l'entrefer (|z| < g/2) restent hors de l'espace de
   conception.

   Problème : à courant imposé, maximiser l'énergie emmagasinée W
   (= ½·L·I² en linéaire) pour une masse de fer donnée, ou réduire la
   masse en conservant W.

   Sensibilité (méthode ON/OFF linéarisée, problème auto-adjoint) :
   à courant imposé, dW/dν_e = −½·∫_e B² dV ; basculer une cellule
   fer ↔ air change ν d'environ ν0, d'où |ΔW| ≈ ½·ν0·B_e²·V_e.
   Rapportée à la masse de la cellule (∝ V_e), la sensibilité vaut B_e² :
   on retire le fer là où B est faible et on en ajoute là où B est fort.
   Pas de calcul adjoint supplémentaire : l'état sert d'adjoint.

   Mise à jour de type BESO (Huang & Xie) : filtre spatial et moyenne
   sur deux itérations des sensibilités, masse cible décroissant d'un
   taux ER par itération, nombre d'ajouts limité (AR), variables
   strictement binaires (comme l'algorithme ON/OFF linéarisé à
   changements limités cité dans la thèse de V. Martin, § 4.3.1).
   ===================================================================== */
(function (root) {
  'use strict';
  const RHO = 7650, MU0 = 4e-7 * Math.PI;

  /* Grille de conception pour le pot de paramètres p (mm). nr : cellules en r. */
  function makeGrid(p, regs, opts = {}) {
    const margin = opts.margin || 0;
    let Rb = 0, Zb = 0;
    for (const g of regs) { Rb = Math.max(Rb, g.r1); Zb = Math.max(Zb, g.z1); }
    Rb += margin; Zb += margin;
    // pas aligné sur le rayon du noyau rn (en r) et sur le haut de la fenêtre de bobinage (en z)
    const z0 = Math.max(0, p.gap / 2), core = regs.find(g => g.name === 'Noyau central');
    const d0 = Rb / (opts.nr || 30);
    const dr = core ? core.r1 / Math.max(1, Math.round(core.r1 / d0)) : d0;
    const zTop = core ? core.z1 : Zb, dz = (zTop - z0) / Math.max(1, Math.round((zTop - z0) / dr));
    const nrC = Math.max(2, Math.round(Rb / dr)), nzC = Math.max(2, Math.round((Zb - z0) / dz));
    Rb = nrC * dr; Zb = z0 + nzC * dz;
    const R = Array.from({ length: nrC + 1 }, (_, i) => i * dr), Z = Array.from({ length: nzC + 1 }, (_, k) => z0 + k * dz);
    const n = nrC * nzC, on = new Uint8Array(n), design = new Uint8Array(n), rc = new Float64Array(n), zc = new Float64Array(n), mass = new Float64Array(n);
    const coil = regs.find(g => g.mat === 'coil');
    const inReg = (r, z, mat) => regs.some(g => g.mat === mat && r > g.r0 && r < g.r1 && z > g.z0 && z < g.z1);
    for (let i = 0; i < nrC; i++) for (let k = 0; k < nzC; k++) {
      const q = i * nzC + k, r = (R[i] + R[i + 1]) / 2, z = (Z[k] + Z[k + 1]) / 2;
      rc[q] = r; zc[q] = z;
      // masse de la cellule (g), les deux moitiés z > 0 et z < 0
      mass[q] = 2 * Math.PI * r * dr * dz * 2 * 1e-9 * RHO * 1000;
      const inCoil = r > coil.r0 && r < coil.r1 && z > coil.z0 && z < coil.z1;
      design[q] = inCoil ? 0 : 1;
      on[q] = !inCoil && inReg(r, z, 'iron') ? 1 : 0;
    }
    const grid = { nr: nrC, nz: nzC, dr, dz, z0, Rb, Zb, R, Z, on, design, rc, zc, mass, n,
      cell(r, z) { if (r < 0 || r >= Rb || z < z0 || z >= Zb) return -1; const i = Math.min(nrC - 1, Math.floor(r / dr)), k = Math.min(nzC - 1, Math.floor((z - z0) / dz)), q = i * nzC + k; return design[q] ? q : -1; } };
    // voisins pour le filtre (rayon rmin en cellules)
    const rmin = opts.rmin ?? 1.5, nb = [];
    const ir = Math.ceil(rmin);
    for (let i = 0; i < nrC; i++) for (let k = 0; k < nzC; k++) {
      const L = [];
      for (let a = -ir; a <= ir; a++) for (let b = -ir; b <= ir; b++) {
        const ii = i + a, kk = k + b; if (ii < 0 || kk < 0 || ii >= nrC || kk >= nzC) continue;
        const w = rmin - Math.hypot(a, b); if (w > 0 && design[ii * nzC + kk]) L.push([ii * nzC + kk, w]);
      }
      nb.push(L);
    }
    grid.nb = nb;
    return grid;
  }

  /* Paramètres de calcul avec la grille de conception. */
  function solverParams(p, grid, solver) {
    const q = Object.assign({}, p, { topo: grid, extraR: grid.R, extraZ: grid.Z });
    if (solver === 'mec') { q.nr = grid.nr + 14; q.nz = 2 * grid.nz + 22; }
    else { q.minDiv = 1; q.ds = Math.min(p.ds || 1, grid.dr); }
    return q;
  }

  /* Calcul de la topologie courante : W, L, masse de fer, sensibilités B² par cellule de conception. */
  function evaluate(FEM, MEC, p, grid, solver) {
    const sp = solverParams(p, grid, solver), n = grid.n;
    const sB = new Float64Array(n), sw = new Float64Array(n);
    let mfe = 0, B95 = 0; const bIron = [];
    let sol;
    if (solver === 'mec') {
      sol = MEC.solve(sp); const g = sol.grid, tc = g.topoCell;
      for (let i = 0; i < g.nr; i++) for (let k = 0; k < g.nz; k++) {
        const c = i * g.nz + k, r = (g.R[i] + g.R[i + 1]) / 2, a = (g.R[i + 1] - g.R[i]) * (g.Z[k + 1] - g.Z[k]), w = r * a, b = sol.Bmod[c];
        if (sol.matQ(c) === 'iron') { mfe += 2 * Math.PI * w * 1e-9 * RHO * 1000; bIron.push([b, w]); }
        const q = tc[c]; if (q >= 0) { sB[q] += b * b * w; sw[q] += w; }
      }
    } else {
      sol = FEM.solve(sp); const G = sol.G, tc = sol.topoCell;
      for (let e = 0; e < G.ne; e++) {
        const w = G.rc[e] * G.area[e], b = sol.B.Bm[e];
        if (sol.isIron[e]) { mfe += 2 * Math.PI * w * 2 * RHO * 1000; bIron.push([b, w]); }
        const q = tc[e]; if (q >= 0) { sB[q] += b * b * w; sw[q] += w; }
      }
    }
    const alpha = new Float64Array(n), Bc = new Float64Array(n);
    for (let q = 0; q < n; q++) if (sw[q] > 0) { alpha[q] = sB[q] / sw[q]; Bc[q] = Math.sqrt(alpha[q]); }
    // B du fer dépassé sur 5 % du volume de fer
    bIron.sort((a, b) => b[0] - a[0]); const wt = bIron.reduce((s, x) => s + x[1], 0); let acc = 0;
    for (const [b, w] of bIron) { acc += w; if (acc >= 0.05 * wt) { B95 = b; break; } }
    return { W: sol.W * 1e3, L: sol.L * 1e3, mfe, alpha, Bc, B95, Bmax: sol.BmaxIron, sol, ms: sol.ms };
  }

  /* Boucle BESO ON/OFF. opts : target (fraction de masse), ER, AR, maxIter, wMin (fraction de W0), bLim (T), onIter(it, state). */
  async function beso(FEM, MEC, p, grid, opts = {}) {
    const solver = opts.solver || 'ef', ER = opts.ER ?? 0.03, AR = opts.AR ?? 0.02, maxIter = opts.maxIter ?? 60, target = opts.target ?? 0.6;
    const wMin = opts.wMin ?? 0, bLim = opts.bLim ?? Infinity, onIter = opts.onIter || (() => {}), stop = opts.stop || (() => false);
    const D = []; for (let q = 0; q < grid.n; q++) if (grid.design[q]) D.push(q);
    const hist = []; let prevA = null;
    let ev = evaluate(FEM, MEC, p, grid, solver);
    const M0 = ev.mfe, W0 = ev.W;
    const fixedMass = M0 - D.reduce((s, q) => s + (grid.on[q] ? grid.mass[q] : 0), 0);   // fer hors espace de conception
    const snap = (it, ev, note) => { const s = { it, W: ev.W, L: ev.L, mfe: ev.mfe, B95: ev.B95, Bmax: ev.Bmax, on: Uint8Array.from(grid.on), Bc: Float64Array.from(ev.Bc), note }; hist.push(s); return s; };
    await onIter(0, snap(0, ev, 'départ (pot paramétrique)'), hist);
    let Mt = M0, stopReason = 'nombre maximal d’itérations', er = ER, ar = AR, nEval = 1, it = 0, rejects = 0;
    while (it < maxIter) {
      if (stop()) { stopReason = 'arrêt demandé'; break; }
      // sensibilités filtrées et moyennées sur deux itérations
      const a = new Float64Array(grid.n);
      for (const q of D) { let s = 0, w = 0; for (const [j, wj] of grid.nb[q]) { s += wj * ev.alpha[j]; w += wj; } a[q] = w > 0 ? s / w : ev.alpha[q]; }
      if (prevA) for (const q of D) a[q] = (a[q] + prevA[q]) / 2;
      const Mtry = Math.max(target * M0, Mt * (1 - er)), Md = Mtry - fixedMass;
      // ensemble candidat : cellules triées par sensibilité décroissante jusqu'à la masse cible
      const sorted = D.slice().sort((x, y) => a[y] - a[x]);
      const cand = new Set(); let m = 0;
      for (const q of sorted) { if (m >= Md) break; cand.add(q); m += grid.mass[q]; }
      let adds = sorted.filter(q => cand.has(q) && !grid.on[q]);
      const nAddMax = Math.max(1, Math.floor(ar * D.length));
      const next = new Uint8Array(grid.n);
      if (adds.length > nAddMax) {
        adds = adds.slice(0, nAddMax); let mm = 0;
        for (const q of adds) { next[q] = 1; mm += grid.mass[q]; }
        for (const q of sorted) { if (!grid.on[q] || next[q]) continue; if (mm >= Md) break; next[q] = 1; mm += grid.mass[q]; }
      } else for (const q of cand) next[q] = 1;
      const prevOn = Uint8Array.from(grid.on);
      for (const q of D) grid.on[q] = next[q];
      let changed = 0; for (const q of D) if (prevOn[q] !== grid.on[q]) changed++;
      if (!changed) { if (Mtry <= target * M0 + 1e-9) { stopReason = 'convergence (plus aucune cellule ne change)'; break; } }
      const evn = evaluate(FEM, MEC, p, grid, solver); nEval++;
      const bad = evn.W < wMin * W0 ? `W passerait sous ${Math.round(wMin * 100)} % de W0`
        : evn.B95 > Math.max(bLim, ev.B95) + 1e-9 ? `l’induction du fer dépasserait ${bLim} T`
        : evn.W / evn.mfe < (ev.W / ev.mfe) * (1 - 1e-3) ? 'le rapport W / masse ne s’améliore plus' : '';
      if (bad) {
        // retour arrière : on réduit le pas (ER et AR divisés par 2)
        grid.on.set(prevOn); rejects++; er /= 2; ar /= 2;
        if (er < ER / 16) { stopReason = bad + ' (même avec un pas réduit)'; break; }
        continue;
      }
      prevA = a; ev = evn; Mt = Mtry; it++;
      const s = snap(it, ev, changed + ' cellules changées' + (er < ER ? ` (pas réduit : ER = ${(er * 100).toFixed(2)} %)` : ''));
      await onIter(it, s, hist);
      er = Math.min(ER, er * 1.5); ar = Math.min(AR, ar * 1.5);
      // convergence : masse cible atteinte et W stable sur 5 itérations
      if (Mt <= target * M0 + 1e-9 && hist.length > 6) {
        const last = hist.slice(-6).map(h => h.W), dW = (Math.max(...last) - Math.min(...last)) / Math.max(...last);
        if (dW < 1e-3) { stopReason = 'convergence (masse cible atteinte, W stable)'; break; }
      }
    }
    return { hist, M0, W0, stopReason, final: hist[hist.length - 1], nEval, rejects };
  }

  const api = { makeGrid, solverParams, evaluate, beso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TOPO = api;
})(typeof window !== 'undefined' ? window : globalThis);
