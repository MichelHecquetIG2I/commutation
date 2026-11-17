/* =====================================================================
   Magnétostatique axisymétrique par éléments finis (triangles P1)
   ---------------------------------------------------------------------
   Inconnue : potentiel vecteur Aθ(r, z), nul sur l'axe. Fonction de flux
   ψ = r·Aθ : le flux à travers un disque de rayon r vaut Φ = 2π·ψ.
   Champ :  Br = −∂A/∂z ,  Bz = ∂A/∂r + A/r   (régulier sur l'axe)
   Formulation faible (le facteur 2π se simplifie) :
       ∫ ν·B(A)·B(W) r dr dz = ∫ J·W r dr dz
   Intégration à 1 point (centre de gravité) : par élément,
       Bz = g·A , −Br = h·A  avec g_i = ∂N_i/∂r + 1/(3·rc), h_i = ∂N_i/∂z,
       K_e = ν·w·(g gᵀ + h hᵀ), w = rc·aire.
   Conditions : A = 0 sur l'axe et sur la frontière extérieure (domaine
   large) ; symétrie par rapport au plan z = 0 (condition naturelle) :
   seul le demi-domaine z ≥ 0 est maillé.
   Maillage : grille rectangulaire non uniforme alignée sur toutes les
   frontières de matériaux, chaque rectangle étant coupé en 2 triangles.
   Résolution : Cholesky en bande ; fer non linéaire B(H) par
   Newton-Raphson (matrice tangente exacte, recherche linéaire).
   Unités SI (m, A, T). Les dimensions géométriques sont données en mm.
   ===================================================================== */
(function (root) {
  'use strict';
  const MU0 = 4e-7 * Math.PI;

  /* ---------- Matériau fer : courbe B(H) standard ----------
     B(H) = µ0·H + (2·Js/π)·atan( π·(µri − 1)·µ0·H / (2·Js) )
     µri : perméabilité relative initiale (pente à l'origine), Js : polarisation à saturation. */
  function makeIron(mur = 2000, Js = 1.7) {
    const k = Math.PI * (mur - 1) * MU0 / (2 * Js);
    const B = H => MU0 * H + (2 * Js / Math.PI) * Math.atan(k * H);
    // table H(B) pour inverser la courbe (H de 0 à 2·10⁶ A/m, pas logarithmique)
    const Hs = [0], Bs = [0];
    for (let i = 0; i <= 600; i++) { const h = Math.pow(10, -1 + i * (7.3 / 600)); Hs.push(h); Bs.push(B(h)); }
    function H(b) {
      b = Math.abs(b);
      if (b <= 0) return 0;
      const n = Bs.length - 1;
      if (b >= Bs[n]) return Hs[n] + (b - Bs[n]) / MU0; // au-delà : pente µ0
      let lo = 0, hi = n;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Bs[m] <= b) lo = m; else hi = m; }
      const t = (b - Bs[lo]) / (Bs[hi] - Bs[lo]);
      return Hs[lo] + t * (Hs[hi] - Hs[lo]);
    }
    // réluctivité sécante ν = H/B (limite à B → 0 : 1/(µ0·µri))
    const nu = b => (Math.abs(b) < 1e-6 ? 1 / (MU0 * mur) : H(b) / Math.abs(b));
    return { mur, Js, B, H, nu };
  }

  /* ---------- Géométrie : liste de régions rectangulaires (r, z en mm, demi-domaine z ≥ 0) ---------- */
  function buildGeometry(p) {
    const ri = p.ri, re = p.re, h = p.h, regs = [];
    regs.push({ name: 'Bobine', mat: 'coil', r0: ri, r1: re, z0: 0, z1: h / 2 });
    const g = Math.max(0, p.gap || 0);
    if (p.core === 'noyau') {
      // noyau plongeur : cylindre de fer dans la bobine (avec éventuel entrefer central)
      regs.push({ name: 'Noyau', mat: 'iron', r0: 0, r1: p.rn, z0: g / 2, z1: p.hn / 2 });
    } else if (p.core === 'pot') {
      // pot fermé : noyau central (entrefer g au centre), cylindre extérieur, 2 flasques
      const jeu = p.jeu ?? 1, H = h + 2 * jeu, ro1 = re + jeu;
      const ro2 = Math.sqrt(ro1 * ro1 + p.rn * p.rn);           // section du cylindre extérieur = section du noyau
      const e = Math.max(p.rn / 2, 1);                           // section des flasques (à r = rn) ≈ section du noyau
      regs.push({ name: 'Noyau central', mat: 'iron', r0: 0, r1: p.rn, z0: g / 2, z1: H / 2 });
      regs.push({ name: 'Cylindre extérieur', mat: 'iron', r0: ro1, r1: ro2, z0: 0, z1: H / 2 });
      regs.push({ name: 'Flasque', mat: 'iron', r0: 0, r1: ro2, z0: H / 2, z1: H / 2 + e });
      regs.ro1 = ro1; regs.ro2 = ro2; regs.H = H; regs.e = e;
    }
    return regs;
  }

  /* ---------- Maillage ---------- */
  function lines(keys, ds, Rmax, grow) {
    // découpe chaque intervalle entre deux cotes « clés » en mailles ≈ ds,
    // puis grandit géométriquement (facteur grow) jusqu'à Rmax.
    keys = [...new Set(keys.map(v => +v.toFixed(6)))].filter(v => v >= 0 && v < Rmax).sort((a, b) => a - b);
    const out = [keys[0]];
    for (let k = 1; k < keys.length; k++) {
      const a = keys[k - 1], b = keys[k], n = Math.max(2, Math.ceil((b - a) / ds - 1e-9));
      for (let i = 1; i <= n; i++) out.push(a + (b - a) * i / n);
    }
    let x = out[out.length - 1], d = ds;
    while (x < Rmax) { d *= grow; x = Math.min(Rmax, x + d); if (Rmax - x < d * 0.5) x = Rmax; out.push(x); }
    return out;
  }

  function mesh(p, regs) {
    const ds = p.ds, Rmax = p.Rmax;
    const rk = [0], zk = [0];
    for (const g of regs) { rk.push(g.r0, g.r1); zk.push(g.z0, g.z1); }
    const R = lines(rk, ds, Rmax, 1.18), Z = lines(zk, ds, Rmax, 1.18);
    const nr = R.length - 1, nz = Z.length - 1, NZ = nz + 1;
    const node = (i, j) => i * NZ + j;
    const nn = (nr + 1) * NZ;
    const x = new Float64Array(nn), y = new Float64Array(nn);
    for (let i = 0; i <= nr; i++) for (let j = 0; j <= nz; j++) { x[node(i, j)] = R[i] / 1000; y[node(i, j)] = Z[j] / 1000; }
    const tri = [], reg = [];
    const regionAt = (rc, zc) => { for (let k = 0; k < regs.length; k++) { const g = regs[k]; if (rc > g.r0 && rc < g.r1 && zc > g.z0 && zc < g.z1) return k; } return -1; };
    for (let i = 0; i < nr; i++) for (let j = 0; j < nz; j++) {
      const k = regionAt((R[i] + R[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2);
      const a = node(i, j), b = node(i + 1, j), c = node(i + 1, j + 1), d = node(i, j + 1);
      tri.push(a, b, c, a, c, d); reg.push(k, k);
    }
    const fixed = new Uint8Array(nn);
    for (let j = 0; j <= nz; j++) { fixed[node(0, j)] = 1; fixed[node(nr, j)] = 1; }
    for (let i = 0; i <= nr; i++) fixed[node(i, nz)] = 1;
    return { R, Z, nr, nz, NZ, nn, x, y, tri: Int32Array.from(tri), reg: Int16Array.from(reg), fixed, bw: NZ + 1 };
  }

  /* ---------- Géométrie élémentaire (précalculée) ---------- */
  function elemGeom(m) {
    const ne = m.tri.length / 3, g = new Float64Array(3 * ne), h = new Float64Array(3 * ne), area = new Float64Array(ne), rc = new Float64Array(ne), w = new Float64Array(ne), fN = new Float64Array(3 * ne);
    for (let e = 0; e < ne; e++) {
      const n0 = m.tri[3 * e], n1 = m.tri[3 * e + 1], n2 = m.tri[3 * e + 2];
      const r = [m.x[n0], m.x[n1], m.x[n2]], z = [m.y[n0], m.y[n1], m.y[n2]];
      const A2 = (r[1] - r[0]) * (z[2] - z[0]) - (r[2] - r[0]) * (z[1] - z[0]);   // 2·aire signée
      area[e] = Math.abs(A2) / 2; rc[e] = (r[0] + r[1] + r[2]) / 3; w[e] = rc[e] * area[e];
      for (let a = 0; a < 3; a++) {
        const j = (a + 1) % 3, k = (a + 2) % 3;
        const dNdr = (z[j] - z[k]) / A2, dNdz = (r[k] - r[j]) / A2;
        g[3 * e + a] = dNdr + 1 / (3 * rc[e]); h[3 * e + a] = dNdz;
        fN[3 * e + a] = area[e] * (3 * rc[e] + r[a]) / 12;                       // ∫ N_a·r dA (exact)
      }
    }
    return { ne, g, h, area, rc, w, fN };
  }

  /* ---------- Assemblage + Cholesky en bande (stockage bande inférieure) ---------- */
  /* Assemble K(ν) (et, si tg est fourni, les termes tangents de Newton : J_e = K_e + tg_e·q qᵀ, q = (g·A) g + (h·A) h),
     applique A = 0 aux nœuds fixés et résout par Cholesky bande. */
  function solveLinear(m, G, nu, rhs, tg, A) {
    const n = m.nn, w = m.bw, K = new Float64Array(n * (w + 1)), f = Float64Array.from(rhs);
    const at = (i, j) => i * (w + 1) + (i - j); // i ≥ j
    const q = [0, 0, 0];
    for (let e = 0; e < G.ne; e++) {
      const s = nu[e] * G.w[e], t = tg ? tg[e] : 0, o = 3 * e;
      if (t) { let u = 0, v = 0; for (let a = 0; a < 3; a++) { const Av = A[m.tri[o + a]]; u += G.g[o + a] * Av; v += G.h[o + a] * Av; }
        for (let a = 0; a < 3; a++) q[a] = u * G.g[o + a] + v * G.h[o + a]; }
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const I = m.tri[o + a], J = m.tri[o + b];
        if (I < J) continue;
        K[at(I, J)] += s * (G.g[o + a] * G.g[o + b] + G.h[o + a] * G.h[o + b]) + (t ? t * q[a] * q[b] : 0);
      }
    }
    // conditions de Dirichlet ψ = 0 : ligne/colonne mises à l'identité
    for (let i = 0; i < n; i++) if (m.fixed[i]) {
      for (let k = 0; k <= w && i - k >= 0; k++) K[at(i, i - k)] = 0;
      for (let k = 1; k <= w && i + k < n; k++) K[at(i + k, i)] = 0;
      K[at(i, i)] = 1; f[i] = 0;
    }
    // Cholesky bande : K = L·Lᵀ
    for (let j = 0; j < n; j++) {
      let s = K[at(j, j)];
      for (let k = Math.max(0, j - w); k < j; k++) { const l = K[at(j, k)]; s -= l * l; }
      if (!(s > 0)) throw new Error('Matrice non définie positive (maillage ou matériau incohérent).');
      const d = Math.sqrt(s); K[at(j, j)] = d;
      for (let i = j + 1; i <= Math.min(n - 1, j + w); i++) {
        let t = K[at(i, j)];
        for (let k = Math.max(0, i - w); k < j; k++) t -= K[at(i, k)] * K[at(j, k)];
        K[at(i, j)] = t / d;
      }
    }
    for (let i = 0; i < n; i++) { let t = f[i]; for (let k = Math.max(0, i - w); k < i; k++) t -= K[at(i, k)] * f[k]; f[i] = t / K[at(i, i)]; }
    for (let i = n - 1; i >= 0; i--) { let t = f[i]; for (let k = i + 1; k <= Math.min(n - 1, i + w); k++) t -= K[at(k, i)] * f[k]; f[i] = t / K[at(i, i)]; }
    return f;
  }

  function fieldB(m, G, A) {
    const Br = new Float64Array(G.ne), Bz = new Float64Array(G.ne), Bm = new Float64Array(G.ne);
    for (let e = 0; e < G.ne; e++) {
      let u = 0, v = 0;
      for (let a = 0; a < 3; a++) { const Av = A[m.tri[3 * e + a]]; u += G.g[3 * e + a] * Av; v += G.h[3 * e + a] * Av; }
      Bz[e] = u; Br[e] = -v; Bm[e] = Math.hypot(u, v);
    }
    return { Br, Bz, Bm };
  }

  /* ---------- Problème complet ---------- */
  function solve(p) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const regs = buildGeometry(p), m = mesh(p, regs), G = elemGeom(m);
    const iron = makeIron(p.mur, p.Js ?? 1.7), linear = p.material === 'lineaire';
    const coil = regs.find(g => g.mat === 'coil');
    const Scoil = (coil.r1 - coil.r0) * (coil.z1 - coil.z0) * 1e-6;       // section dans le demi-domaine (m²)
    const J = p.N * p.I / (2 * Scoil);                                       // A/m² (section totale = 2·Scoil)
    const rhs = new Float64Array(m.nn), isIron = new Uint8Array(G.ne);
    for (let e = 0; e < G.ne; e++) {
      const g = m.reg[e] >= 0 ? regs[m.reg[e]] : null;
      if (g && g.mat === 'iron') isIron[e] = 1;
      if (g && g.mat === 'coil') for (let a = 0; a < 3; a++) rhs[m.tri[3 * e + a]] += J * G.fN[3 * e + a];
    }
    const nu0 = 1 / MU0, nu = new Float64Array(G.ne).fill(nu0);
    for (let e = 0; e < G.ne; e++) if (isIron[e]) nu[e] = 1 / (MU0 * p.mur);
    let psi, B, it = 0, err = 0, converged = true;
    const hasNL = !linear && isIron.some(v => v);
    // Newton-Raphson : résidu R(A) = K(ν(A))·A − f ; tangente J = K(ν) + Σ 2·w·(dν/dB²)·q qᵀ
    function residual(Av, nuv) {
      const r = Float64Array.from(rhs, v => -v);
      for (let e = 0; e < G.ne; e++) {
        const o = 3 * e; let u = 0, v = 0;
        for (let a = 0; a < 3; a++) { const x = Av[m.tri[o + a]]; u += G.g[o + a] * x; v += G.h[o + a] * x; }
        const s = nuv[e] * G.w[e];
        for (let a = 0; a < 3; a++) r[m.tri[o + a]] += s * (u * G.g[o + a] + v * G.h[o + a]);
      }
      let n2 = 0; for (let i = 0; i < m.nn; i++) { if (m.fixed[i]) r[i] = 0; else n2 += r[i] * r[i]; }
      return { r, norm: Math.sqrt(n2) };
    }
    function updateNu(Bf, nuv) { for (let e = 0; e < G.ne; e++) if (isIron[e]) nuv[e] = iron.nu(Bf.Bm[e]); }
    let A = solveLinear(m, G, nu, rhs); B = fieldB(m, G, A); it = 1;
    if (hasNL) {
      let fnorm = 0; for (let i = 0; i < m.nn; i++) fnorm += rhs[i] * rhs[i]; fnorm = Math.sqrt(fnorm);
      updateNu(B, nu);
      let res = residual(A, nu);
      converged = false;
      for (let k = 0; k < 40; k++) {
        err = res.norm / fnorm;
        if (err < 1e-7) { converged = true; break; }
        const tg = new Float64Array(G.ne);
        for (let e = 0; e < G.ne; e++) if (isIron[e]) {
          const b = B.Bm[e], db = Math.max(1e-4, b * 1e-3), bp = b + db, bm = Math.max(0, b - db);
          tg[e] = 2 * G.w[e] * (iron.nu(bp) - iron.nu(bm)) / (bp * bp - bm * bm);   // 2·w·dν/d(B²)
        }
        const d = solveLinear(m, G, nu, Float64Array.from(res.r, v => -v), tg, A);
        let step = 1, trial, Bt, nut, rt;
        for (let ls = 0; ls < 8; ls++) {
          trial = Float64Array.from(A, (v, i) => v + step * d[i]);
          Bt = fieldB(m, G, trial); nut = Float64Array.from(nu); updateNu(Bt, nut); rt = residual(trial, nut);
          if (rt.norm < res.norm || ls === 7) break; step /= 2;
        }
        A = trial; B = Bt; nu.set(nut); res = rt; it++;
      }
      err = res.norm / fnorm;
      if (!converged && err < 1e-5) converged = true;
    }
    psi = Float64Array.from(A, (v, i) => v * m.x[i]);          // ψ = r·A aux nœuds (lignes de flux)
    // ---- grandeurs globales ----
    const Aarr = Float64Array.from(psi, (v, i) => m.x[i] > 0 ? v / m.x[i] : 0);
    let psiCoil = 0, W = 0, Bmax = 0, BmaxIron = 0;
    for (let e = 0; e < G.ne; e++) {
      const g = m.reg[e] >= 0 ? regs[m.reg[e]] : null, Ar = G.area[e];
      const Am = (Aarr[m.tri[3 * e]] + Aarr[m.tri[3 * e + 1]] + Aarr[m.tri[3 * e + 2]]) / 3;
      if (g && g.mat === 'coil') psiCoil += G.rc[e] * Am * Ar;
      // énergie magnétique (×2 : demi-domaine), w = ∫0^B H dB
      const b = B.Bm[e], dV = 2 * Math.PI * G.rc[e] * Ar * 2;
      let wdens;
      if (isIron[e] && hasNL) { // intégration numérique de H dB sur la courbe
        const nstep = 24; wdens = 0; for (let s = 0; s < nstep; s++) { const bb = (s + 0.5) / nstep * b; wdens += iron.H(bb) * b / nstep; }
      } else wdens = 0.5 * nu[e] * b * b;
      W += wdens * dV;
      Bmax = Math.max(Bmax, b); if (isIron[e]) BmaxIron = Math.max(BmaxIron, b);
    }
    const lambda = p.N * 2 * Math.PI * psiCoil / Scoil;    // flux total embrassé (Wb) = N × flux moyen par spire
    const L = lambda / p.I;
    // flux « principal » : à travers le plan médian (z = 0), jusqu'au rayon intérieur de la bobine
    const iRi = m.R.findIndex(v => Math.abs(v - coil.r0) < 1e-9);
    const phiCore = 2 * Math.PI * psi[iRi * m.NZ];
    const iRm = m.R.reduce((best, v, i) => Math.abs(v - (coil.r0 + coil.r1) / 2) < Math.abs(m.R[best] - (coil.r0 + coil.r1) / 2) ? i : best, 0);
    const phiMean = 2 * Math.PI * psi[iRm * m.NZ];
    const t1 = (typeof performance !== 'undefined' ? performance : Date).now();
    return { p, regs, m, G, psi, B, nu, isIron, J, lambda, L, Lw: 2 * W / (p.I * p.I), W, phiCore, phiMean,
      phiPerTurn: lambda / p.N, Bmax, BmaxIron, it, converged, err, hasNL, ms: t1 - t0, iron };
  }

  /* ---------- Formules analytiques de comparaison ---------- */
  function analytic(p, regs) {
    const ri = p.ri / 1000, re = p.re / 1000, h = p.h / 1000, N = p.N;
    if (p.core === 'pot') {
      // circuit magnétique : entrefer (section du noyau) + fer (longueur moyenne, perméabilité µr)
      const rn = p.rn / 1000, g = p.gap / 1000, H = regs.H / 1000, e = regs.e / 1000, ro1 = regs.ro1 / 1000, ro2 = regs.ro2 / 1000;
      const S = Math.PI * rn * rn, lfe = (H - g) + H + 2 * ((ro1 + ro2) / 2 - rn / 2) + 2 * e;
      const Rg = g / (MU0 * S), Rfe = lfe / (MU0 * p.mur * S);
      // facteur d'épanouissement de l'entrefer (McLyman) : F = 1 + (g/√S)·ln(2·G/g), G = hauteur de la fenêtre de bobinage
      const Ff = 1 + (g / Math.sqrt(S)) * Math.log(2 * (H - 0) / g);
      return { L: N * N / (Rg + Rfe), label: 'Circuit magnétique (réluctances, sans épanouissement)',
        L2: N * N / (Rg / Ff + Rfe), label2: 'Avec épanouissement de l’entrefer (McLyman, F = ' + Ff.toFixed(3) + ')', detail: { Rg, Rfe, lfe, S, Ff } };
    }
    if (p.core === 'air') {
      // formule de Wheeler (bobine multicouche) : L(µH) = 31,6·N²·r² / (6r + 9l + 10c), r, l, c en m
      const r = (ri + re) / 2, c = re - ri;
      return { L: 31.6e-6 * N * N * r * r / (6 * r + 9 * h + 10 * c), label: 'Formule de Wheeler (bobine multicouche, précision ≈ 1 %)' };
    }
    return null;
  }

  const api = { MU0, makeIron, buildGeometry, mesh, solve, analytic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FEM = api;
})(typeof window !== 'undefined' ? window : globalThis);
