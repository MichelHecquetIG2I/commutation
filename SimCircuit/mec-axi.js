/* =====================================================================
   Réseau de réluctances maillé (MEC) — plan méridien (r, z), axisymétrique
   ---------------------------------------------------------------------
   D'après le modèle à réluctances maillées du L2EP (F. Gillon,
   O. Bouchakour ; thèse de V. Martin, § 4.2.1) :
   - le domaine est découpé en cellules rectangulaires ; un nœud au centre
     de chaque cellule est relié à ses 4 voisines par 4 demi-branches
     (droite, haut, gauche, bas) portant chacune une réluctance ;
   - inconnues : les flux de mailles φm, un par maille (boucle autour d'un
     coin de cellule) ; flux de branche = différence de deux flux de maille ;
   - flux de maille nul sur tout le pourtour du domaine (Dirichlet) et sur
     l'axe ;
   - loi des mailles (Hopkinson) : Σ R·φ = f.m.m. enlacée ; les conducteurs
     sont remplacés par des sources de f.m.m. : chaque maille reçoit les
     ampères-tours qu'elle enlace (quart de cellule de bobinage × J).
   Version axisymétrique : le flux de maille au coin (r, z) est le flux
   traversant le disque de rayon r à la cote z (équivalent de 2π·ψ en EF).
     demi-branche radiale [ra, rb], hauteur Δz : R = ln(rb/ra) / (2π·µ·Δz)
     demi-branche axiale, hauteur Δz/2, couronne [r1, r2] : R = (Δz/2) / (µ·π·(r2² − r1²))
   Non-linéarité B(H) : chaque demi-branche a sa propre induction
   B = φ/S (section moyenne logarithmique en radial) ; f.m.m. = H(B)·l ;
   résolution par Newton-Raphson (Jacobien diagonal par branche).
   Unités SI ; dimensions géométriques en mm.
   ===================================================================== */
(function (root) {
  'use strict';
  const MU0 = 4e-7 * Math.PI;

  /* Découpe [a, b] en n intervalles alignés sur les cotes clés, n ≤ nmax, cellules d'air 2,5× plus grandes. */
  function gridLines(keys, airFrom, nmax) {
    keys = [...new Set(keys.map(v => +v.toFixed(6)))].sort((x, y) => x - y);
    const iv = []; for (let k = 1; k < keys.length; k++) { const a = keys[k - 1], b = keys[k]; iv.push({ a, b, w: (Math.abs(a) >= airFrom - 1e-9 && Math.abs(b) >= airFrom - 1e-9) || (a >= airFrom - 1e-9) ? 2.5 : 1 }); }
    const count = h => iv.reduce((s, q) => s + Math.max(1, Math.round((q.b - q.a) / (h * q.w))), 0);
    let lo = 1e-4, hi = 1e4;
    for (let k = 0; k < 80; k++) { const m = Math.sqrt(lo * hi); if (count(m) > nmax) lo = m; else hi = m; }
    const out = [keys[0]];
    for (const q of iv) { const n = Math.max(1, Math.round((q.b - q.a) / (hi * q.w))); for (let i = 1; i <= n; i++) out.push(q.a + (q.b - q.a) * i / n); }
    return out;
  }

  function build(p, regs) {
    // régions EF (demi-domaine z ≥ 0) → domaine complet par symétrie
    let rObj = p.re, zObj = p.h / 2;
    for (const g of regs) { rObj = Math.max(rObj, g.r1); zObj = Math.max(zObj, g.z1); }
    const air = p.air ?? 30, Rd = rObj + air, Zd = zObj + air;
    const rk = [0, Rd], zk = [-Zd, Zd];
    for (const g of regs) { rk.push(g.r0, g.r1); zk.push(g.z0, g.z1, -g.z0, -g.z1); }
    if (p.extraR) rk.push(...p.extraR); if (p.extraZ) for (const v of p.extraZ) zk.push(v, -v);
    const R = gridLines(rk, rObj, p.nr || 50), Z = gridLines(zk, zObj, p.nz || 50);
    const nr = R.length - 1, nz = Z.length - 1;
    const cell = new Int16Array(nr * nz);   // indice de région (−1 : air)
    for (let i = 0; i < nr; i++) for (let k = 0; k < nz; k++) {
      const rc = (R[i] + R[i + 1]) / 2, zc = Math.abs((Z[k] + Z[k + 1]) / 2);
      let id = -1; for (let q = 0; q < regs.length; q++) { const g = regs[q]; if (rc > g.r0 && rc < g.r1 && zc > g.z0 && zc < g.z1) { id = q; break; } }
      cell[i * nz + k] = id;
    }
    // optimisation topologique ON/OFF : cellule de conception de chaque cellule MEC (−1 : hors espace de conception)
    let topoCell = null;
    if (p.topo) {
      topoCell = new Int32Array(nr * nz).fill(-1);
      for (let i = 0; i < nr; i++) for (let k = 0; k < nz; k++) {
        const id = cell[i * nz + k]; if (id >= 0 && regs[id].mat === 'coil') continue;
        topoCell[i * nz + k] = p.topo.cell((R[i] + R[i + 1]) / 2, Math.abs((Z[k] + Z[k + 1]) / 2));
      }
    }
    return { R, Z, nr, nz, cell, Rd, Zd, topoCell };
  }

  /* Solveur bande symétrique (Cholesky). */
  function bandSolve(n, w, K, f) {
    const at = (i, j) => i * (w + 1) + (i - j);
    for (let j = 0; j < n; j++) {
      let s = K[at(j, j)]; for (let k = Math.max(0, j - w); k < j; k++) s -= K[at(j, k)] ** 2;
      if (!(s > 0)) throw new Error('Système MEC singulier.');
      const d = Math.sqrt(s); K[at(j, j)] = d;
      for (let i = j + 1; i <= Math.min(n - 1, j + w); i++) { let t = K[at(i, j)]; for (let k = Math.max(0, i - w); k < j; k++) t -= K[at(i, k)] * K[at(j, k)]; K[at(i, j)] = t / d; }
    }
    for (let i = 0; i < n; i++) { let t = f[i]; for (let k = Math.max(0, i - w); k < i; k++) t -= K[at(i, k)] * f[k]; f[i] = t / K[at(i, i)]; }
    for (let i = n - 1; i >= 0; i--) { let t = f[i]; for (let k = i + 1; k <= Math.min(n - 1, i + w); k++) t -= K[at(k, i)] * f[k]; f[i] = t / K[at(i, i)]; }
    return f;
  }

  function solve(p) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const FEM = root.FEM || (typeof require !== 'undefined' ? require('./fem-axi.js') : null);
    const regs = FEM.buildGeometry(p), g = build(p, regs);
    const { R, Z, nr, nz, cell } = g, mm = 1e-3;
    const iron = FEM.makeIron(p.mur, p.Js ?? 1.7), linear = p.material === 'lineaire';
    const coil = regs.find(q => q.mat === 'coil');
    const J = p.N * p.I / ((coil.r1 - coil.r0) * (coil.z1 - coil.z0) * 2 * mm * mm);     // A/m²
    const mat = id => (id < 0 ? 'air' : regs[id].mat);
    const tc = g.topoCell, matQ = q => (tc && tc[q] >= 0 ? (p.topo.on[tc[q]] ? 'iron' : 'air') : mat(cell[q]));
    // ---- inconnues : flux de mailles aux coins intérieurs (i = 1..nr−1, k = 1..nz−1)
    const ni = nr - 1, nk = nz - 1, n = ni * nk, w = nk;
    const idx = (i, k) => (i <= 0 || i >= nr || k <= 0 || k >= nz) ? -1 : (i - 1) * nk + (k - 1);
    // ---- branches : chaque branche relie deux nœuds (centres de cellules) et se compose de deux demi-branches
    // radiale entre cellules (i,k) et (i+1,k) : traverse r = R[i+1], flux = Φ(i+1,k) − Φ(i+1,k+1)
    // axiale  entre cellules (i,k) et (i,k+1) : traverse z = Z[k+1], flux = Φ(i+1,k+1) − Φ(i,k+1)
    const br = [];
    const half = (q, kind, i, k, side) => {
      const r1 = R[i] * mm, r2 = R[i + 1] * mm, rc = (r1 + r2) / 2, dz = (Z[k + 1] - Z[k]) * mm;
      let l, S;
      if (kind === 'r') { const ra = side < 0 ? r1 : rc, rb = side < 0 ? rc : r2; l = rb - ra; S = ra > 0 ? 2 * Math.PI * dz * l / Math.log(rb / ra) : 2 * Math.PI * dz * rb / 2; }
      else { l = dz / 2; S = Math.PI * (r2 * r2 - r1 * r1); }
      return { m: matQ(q), l, S, cell: i * nz + k };
    };
    for (let i = 0; i < nr - 1; i++) for (let k = 0; k < nz; k++)
      br.push({ a: idx(i + 1, k), b: idx(i + 1, k + 1), h: [half(i * nz + k, 'r', i, k, +1), half((i + 1) * nz + k, 'r', i + 1, k, -1)], dir: 'r', i, k });
    for (let i = 0; i < nr; i++) for (let k = 0; k < nz - 1; k++)
      br.push({ a: idx(i + 1, k + 1), b: idx(i, k + 1), h: [half(i * nz + k, 'z', i, k, +1), half(i * nz + k + 1, 'z', i, k + 1, -1)], dir: 'z', i, k });
    // ---- sources de f.m.m. : ampères-tours enlacés par chaque maille (quarts des cellules de bobinage autour du coin)
    const src = new Float64Array(n);
    for (let i = 0; i < nr; i++) for (let k = 0; k < nz; k++) if (mat(cell[i * nz + k]) === 'coil') {
      const A = (R[i + 1] - R[i]) * (Z[k + 1] - Z[k]) * mm * mm, ni4 = J * A / 4;
      for (const [ii, kk] of [[i, k], [i + 1, k], [i, k + 1], [i + 1, k + 1]]) { const q = idx(ii, kk); if (q >= 0) src[q] += ni4; }
    }
    // ---- f.m.m. d'une demi-branche et sa dérivée, pour un flux φ
    const hf = (hb, phi) => {
      const B = phi / hb.S, b = Math.abs(B);
      if (hb.m !== 'iron') return [B / MU0 * hb.l, hb.l / (MU0 * hb.S)];
      if (linear) { const mu = MU0 * p.mur; return [B / mu * hb.l, hb.l / (mu * hb.S)]; }
      const H = iron.H(b), db = Math.max(1e-5, b * 1e-4), dH = (iron.H(b + db) - iron.H(Math.max(0, b - db))) / (b + db - Math.max(0, b - db));
      return [Math.sign(B) * H * hb.l, hb.l / hb.S * dH];
    };
    const flux = (Phi, e) => (e.a >= 0 ? Phi[e.a] : 0) - (e.b >= 0 ? Phi[e.b] : 0);
    function assemble(Phi) {   // résidu Σ Aᵀ·F(φ) − src et Jacobien bande
      const K = new Float64Array(n * (w + 1)), res = Float64Array.from(src, v => -v), at = (i, j) => i * (w + 1) + (i - j);
      for (const e of br) {
        const ph = flux(Phi, e); let F = 0, dF = 0;
        for (const hb of e.h) { const [f, d] = hf(hb, ph); F += f; dF += d; }
        e.F = F; e.phi = ph;
        if (e.a >= 0) res[e.a] += F; if (e.b >= 0) res[e.b] -= F;
        const add = (I, J, v) => { if (I >= 0 && J >= 0) { if (I >= J) K[at(I, J)] += v; } };
        add(e.a, e.a, dF); add(e.b, e.b, dF);
        if (e.a >= 0 && e.b >= 0) { if (e.a > e.b) K[at(e.a, e.b)] -= dF; else K[at(e.b, e.a)] -= dF; }
      }
      let nr2 = 0; for (let q = 0; q < n; q++) nr2 += res[q] * res[q];
      return { K, res, norm: Math.sqrt(nr2) };
    }
    let Phi = new Float64Array(n), it = 0, converged = true;
    const sn = Math.sqrt(src.reduce((s, v) => s + v * v, 0));
    let st = assemble(Phi);
    for (; it < 50; it++) {
      if (st.norm / sn < 1e-9) break;
      const d = bandSolve(n, w, st.K, Float64Array.from(st.res, v => -v));
      let step = 1, trial, tst;
      for (let ls = 0; ls < 10; ls++) { trial = Float64Array.from(Phi, (v, q) => v + step * d[q]); tst = assemble(trial); if (tst.norm < st.norm || ls === 9) break; step /= 2; }
      Phi = trial; st = tst;
      if (linear || !br.some(e => e.h[0].m === 'iron' || e.h[1].m === 'iron')) { it++; break; }
    }
    if (st.norm / sn > 1e-6 && !linear) converged = false;
    // ---- post-traitement
    const corner = (i, k) => { const q = idx(i, k); return q >= 0 ? Phi[q] : 0; };
    let lam = 0, Scoil = 0, W = 0;
    for (let i = 0; i < nr; i++) for (let k = 0; k < nz; k++) if (mat(cell[i * nz + k]) === 'coil') {
      const A = (R[i + 1] - R[i]) * (Z[k + 1] - Z[k]);
      lam += A * (corner(i, k) + corner(i + 1, k) + corner(i, k + 1) + corner(i + 1, k + 1)) / 4; Scoil += A;
    }
    lam = p.N * lam / Scoil;
    // énergie : Σ ∫ F dφ par demi-branche
    for (const e of br) for (const hb of e.h) {
      const B = Math.abs(e.phi / hb.S), vol = hb.l * hb.S;
      if (hb.m !== 'iron') W += B * B / (2 * MU0) * vol;
      else if (linear) W += B * B / (2 * MU0 * p.mur) * vol;
      else { let s = 0; const ns = 16; for (let q = 0; q < ns; q++) s += iron.H((q + 0.5) / ns * B) * B / ns; W += s * vol; }
    }
    // induction par cellule (moyenne des branches, éq. 8 de la thèse)
    const Bmod = new Float64Array(nr * nz), Bz = new Float64Array(nr * nz), Br = new Float64Array(nr * nz);
    for (let i = 0; i < nr; i++) for (let k = 0; k < nz; k++) {
      const r1 = R[i] * mm, r2 = R[i + 1] * mm, z1 = Z[k] * mm, z2 = Z[k + 1] * mm, Sa = Math.PI * (r2 * r2 - r1 * r1);
      const bzb = (corner(i + 1, k) - corner(i, k)) / Sa, bzt = (corner(i + 1, k + 1) - corner(i, k + 1)) / Sa;
      const brl = r1 > 0 ? (corner(i, k) - corner(i, k + 1)) / (2 * Math.PI * r1 * (z2 - z1)) : 0, brr = (corner(i + 1, k) - corner(i + 1, k + 1)) / (2 * Math.PI * r2 * (z2 - z1));
      const bz = (bzb + bzt) / 2, brv = r1 > 0 ? (brl + brr) / 2 : brr;
      Bz[i * nz + k] = bz; Br[i * nz + k] = brv; Bmod[i * nz + k] = Math.hypot(bz, brv);
    }
    let BmaxIron = 0; for (let q = 0; q < nr * nz; q++) if (matQ(q) === 'iron') BmaxIron = Math.max(BmaxIron, Bmod[q]);
    // flux principal : plan médian z = 0, disque r < rᵢ
    const kz0 = Z.findIndex(v => Math.abs(v) < 1e-9), ir = R.findIndex(v => Math.abs(v - coil.r0) < 1e-9);
    const phiCore = kz0 >= 0 && ir >= 0 ? corner(ir, kz0) : NaN;
    const t1 = (typeof performance !== 'undefined' ? performance : Date).now();
    return { p, regs, grid: g, matQ, Phi, corner, lambda: lam, L: lam / p.I, W, Lw: 2 * W / (p.I * p.I), phiCore, BmaxIron, Bmod, Bz, Br,
      unknowns: n, branches: br.length, it, converged, ms: t1 - t0, J };
  }

  const api = { solve, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MEC = api;
})(typeof window !== 'undefined' ? window : globalThis);
