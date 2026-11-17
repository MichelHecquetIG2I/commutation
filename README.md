# Commutation

## Utilisation hors ligne sur téléphone ou tablette

L’application doit être publiée sur un site HTTPS (par exemple GitHub Pages) : l’ouverture directe du fichier HTML ne permet pas d’activer le mode hors ligne. Ouvrez la page une première fois avec une connexion et attendez son chargement complet. L’application et ses icônes seront alors mises en cache pour les utilisations suivantes sans réseau.

- **Android** : dans le menu du navigateur, choisissez **Installer l’application** ou **Ajouter à l’écran d’accueil**.
- **iPhone ou iPad** : dans Safari, touchez **Partager**, puis **Sur l’écran d’accueil**.

Les circuits sont enregistrés dans le stockage local du navigateur sur l’appareil. Ils ne sont pas synchronisés entre appareils ; pensez à utiliser **Enregistrer** pour en garder une copie.

## Liens directs vers les exemples (Moodle)

Une fois la page publiée (GitHub Pages : *Settings → Pages → Deploy from a branch → main / (root)*), chaque exemple s’ouvre directement avec le paramètre `ex` :

| Exemple | Lien |
|---|---|
| Circuit RL (E = 10 V, R = 10 Ω, L = 100 mH, τ = 10 ms) — avec Pr (puissance dissipée dans R) et El (énergie stockée dans L) | `https://michelhecquetig2i.github.io/commutation/?ex=rl` |
| Circuit RC (E = 10 V, R = 1 kΩ, C = 10 µF, τ = 10 ms) | `https://michelhecquetig2i.github.io/commutation/?ex=rc` |
| Circuit R-L-E (U = 24 V, R = 2 Ω, L = 20 mH, E = 12 V, τ = 10 ms) — avec puissance p = R·i² et énergie W = ∫p dt dissipées dans R | `https://michelhecquetig2i.github.io/commutation/?ex=rle` |
| Démarrage d’un robot (mécanique, analogie RL : F = 0,3 N ↔ E, m = 0,5 kg ↔ L, b = 1 N·s/m ↔ R, v ↔ i ; τ = 0,5 s, distance en 2 s ≈ 0,453 m) | `https://michelhecquetig2i.github.io/commutation/?ex=robot` |
| Machine à courant continu (modèle équivalent) | `https://michelhecquetig2i.github.io/commutation/?ex=mcc` |

Sur le schéma, les repères **a** et **b** indiquent les bornes de chaque sonde de tension (u = Va − Vb), dans la couleur de la courbe correspondante.

## Amplificateur opérationnel (AOP)

Composant **AOP** de la palette (Commutation uniquement, absent de SimCircuit) : entrées + et −, sortie, alimentations ±Vcc réglables.
Modèle : gain en boucle ouverte A0 avec pôle dominant (produit gain-bande GBW), vitesse de balayage SR, saturation près des
alimentations, résistances d’entrée Rin et de sortie Rout. Valeurs typiques des fiches techniques :

| Modèle | A0 | GBW | SR | Rin | Saturation (±15 V) |
|---|---|---|---|---|---|
| µA741 | 2·10⁵ | 1 MHz | 0,5 V/µs | 2 MΩ | ±14 V |
| TL081 | 2·10⁵ | 3 MHz | 13 V/µs | 10¹² Ω | ±13,5 V |
| LM358 | 10⁵ | 0,7 MHz | 0,3 V/µs | — | +13,5 V / −15 V |
| Idéal | 10⁶ | — | — | ∞ | ±15 V |

Rout = 75 Ω pour le 741 ; 100 Ω (valeur indicative, non spécifiée par les fiches) pour le TL081 et le LM358. Le modèle
« Personnalisé » permet de saisir toutes les valeurs. Sondes : tension de sortie, courant de sortie, tension d’entrée
ε = V+ − V−, potentiels des entrées.

Exemple : amplificateur inverseur G = −10 (`?ex=aop741`) —
`https://michelhecquetig2i.github.io/commutation/?ex=aop741`. Pistes : Ve = 2 V (saturation), f = 20 kHz (vitesse de
balayage : sortie triangulaire), modèle TL081 ou Idéal pour comparer.

## Onglet « Magnétique (éléments finis) »

`https://michelhecquetig2i.github.io/commutation/magnetique.html` (onglet en haut de l’application, Commutation uniquement).
Calcul de l’inductance d’une bobine par éléments finis (triangles, magnétostatique **axisymétrique**, potentiel vecteur Aθ),
avec carte de |B|, lignes de flux, flux embrassé λ = N·⟨Φ⟩, flux principal (plan médian), énergie et L = λ/I.

| Exemple (N = 100, rᵢ = 15 mm, rₑ = 25 mm, h = 40 mm) | Lien | L (maillage fin) | Référence |
|---|---|---|---|
| 1 · Bobine dans l’air | `…/magnetique.html?ex=air` | 217,6 µH | 217,9 µH (spires filiformes, exact) ; Wheeler 217,9 µH |
| 2 · Noyau plongeur en fer (Ø 28 × 40 mm) | `…/magnetique.html?ex=noyau` | ≈ 0,69 mH (× 3,2) | — |
| 3 · Pot fermé, entrefer 1 mm | `…/magnetique.html?ex=pot` | 8,51 mH | 7,24 mH sans épanouissement ; 8,43 mH avec facteur de McLyman |

Fer : courbe B(H) = µ0·H + (2·Js/π)·atan(π(µr−1)µ0H/(2Js)), µr initiale 2000, Js = 1,7 T (ou µr constant), résolution non linéaire
par Newton-Raphson. Le bouton « Courbe L(I) » trace l’inductance sécante jusqu’à la saturation.
À droite de la coupe, une **vue 3D** du composant (volumes de révolution) : rotation à la souris, zoom à la molette,
coupe d’un quart avec la carte de |B| sur les faces coupées. Solveur : `fem-axi.js`
(utilisable aussi sous Node : `require('./fem-axi.js').solve({...})`).

### Réseau de réluctances maillé (MEC) — comparaison avec les éléments finis

Mode dédié **SimMEC** (troisième entrée du sélecteur, `magnetique.html?mode=mec`, aussi dans SimCircuit) : le réseau de
réluctances est le calcul principal, les éléments finis servent de référence. Dans le mode éléments finis, la case
« Comparer avec un réseau de réluctances » résout aussi le problème par un **réseau de
réluctances maillé** (modèle du L2EP : F. Gillon, O. Bouchakour ; thèse de V. Martin, § 4.2.1), transposé en axisymétrique
(`mec-axi.js`) : grille de n × n cellules (n ≤ 50) avec un nœud par cellule et 4 demi-branches, réluctances
radiales `ln(r₂/r₁)/(2πµΔz)` et axiales `(Δz/2)/(µπ(r₂²−r₁²))`, inconnues = flux de mailles aux coins des cellules,
flux nul (Dirichlet) sur le pourtour du domaine (couche d’air réglable), bobinage remplacé par des sources de f.m.m.,
B(H) non linéaire par branche (Newton-Raphson). Flux totalisé λ = N·⟨φm⟩, L = λ/I et L = 2W/I².

| Pot avec entrefer, N = 100 | EF (fin) | MEC 20×20 | MEC 30×30 | MEC 40×40 | MEC 50×50 |
|---|---|---|---|---|---|
| L à I = 1 A | 8,506 mH | 8,117 (−4,6 %) | 8,271 (−2,8 %) | 8,326 (−2,1 %) | 8,371 mH (−1,6 %) |

En saturation (MEC 50×50) : I = 10 A → 7,905 / 7,963 mH (−0,7 %) ; 20 A → 5,184 / 5,175 mH (+0,2 %) ; 40 A → 2,780 / 2,787 mH (−0,3 %).
Circuits ouverts (air, noyau plongeur) : la couche d’air doit être grande (≈ 100 mm) — avec 10 mm, la condition de flux nul
fait perdre 29 % (air) à 48 % (noyau) sur L.

## SimEF — éléments finis, réseau de réluctances et plans d’expériences

`SimEF/` (`https://michelhecquetig2i.github.io/commutation/SimEF/`) regroupe le calcul d’inductance, avec un sélecteur
**EF / MEC / Plans d’expériences** en haut à gauche :

- **EF** : `SimEF/?ex=pot` ; **MEC** : `SimEF/?mode=mec&ex=pot` (copies de l’onglet magnétique) ;
- **Plans d’expériences** : `SimEF/plans.html` — optimisation paramétrique de l’inductance en pot :
  facteurs au choix (entrefer, rayon du noyau, épaisseur et hauteur du bobinage, nombre de spires, courant), chaque
  essai calculé par EF ou MEC ; plans factoriels 2^k et 3^k, fractionnaires 2^(k−p), Plackett-Burman, composites
  centrés (CCF, CCC, CCI), Box-Behnken, hypercube latin, D-optimal et I-optimal (échange de Fedorov) ; critères
  D-efficacité, I et VIF, comparaison des plans ; modèles linéaire / interactions / quadratique (option log y) avec R²,
  R² ajusté, Q², coefficients ; surface de réponse ; optimisation sous contrainte sur le modèle et vérification par
  simulation ; export CSV.
- **Trois méthodes d’optimisation** (carte « Optimisation », `tools/simef/optim.js`) :
  1. *Plans d’expériences + modèle* : optimisation sur la surface de réponse puis vérification par une simulation ;
  2. *SQP direct sur EF ou MEC* : gradients par différences finies (avant ou centrées), hessienne BFGS amortie,
     sous-problème QP, recherche linéaire sur fonction de mérite L1 ; tableau des itérations, courbe de convergence,
     trajectoire tracée sur la surface de réponse ;
  3. *NSGA-II multi-objectif* (Deb, 2002) sur le modèle (instantané) ou en direct : front de Pareto, par défaut
     énergie emmagasinée W à maximiser / masse de fer à minimiser sous B noyau ≤ 1,2 T, points colorés par la part
     de l’énergie stockée dans l’entrefer ; clic sur un point → géométrie, réponses, vérification par simulation.
- Réponses énergétiques : W, énergie dans l’entrefer Wg, part Wg/W, W / masse de fer.
- NSGA-II : option **variables discrètes** (N entier, cotes au pas choisi), avantage propre aux algorithmes génétiques ;
  **évolution de la bobine le long du front** (géométries à la même échelle, curseur, carte de |B| du point choisi).
- **Méthode 4 — optimisation topologique ON/OFF** (`tools/simef/topo.js`), en EF ou en réseau de réluctances maillé :
  départ d’un optimum paramétrique (méthode 1, 2 ou 3) projeté sur une grille de cellules fer/air, sensibilité B²
  (à courant imposé, dW/dν = −½∫B²dV, problème auto-adjoint), filtrage, mise à jour BESO avec retour arrière,
  arrêt sur W_min, B_max du fer ou W/masse ; vérification croisée EF ↔ MEC. Inspiré de la thèse de V. Martin (L2EP, chap. 4).
  Exemple (optimum SQP, max W sous B ≤ 1,4 T) : −16 % de fer à W constant en EF (14 calculs, 2 s), −15 % et W +7 % en MEC.

Exemple par défaut : g ∈ [0,3 ; 2] mm, rn ∈ [9 ; 15] mm, h ∈ [25 ; 50] mm, I = 10 A, plan CCF (15 essais, 1,5 s) ;
maximiser L / masse de fer sous B noyau ≤ 1,2 T → g = 1,20 mm, rn = 9 mm, h = 25 mm, L = 3,16 mH ; modèle validé
par simulation à 0,2 %. SQP direct (différences centrées) : même optimum (g = 1,205 mm) en 47 simulations EF
(≈ 5 s). NSGA-II sur le modèle : front W de 174 à 379 mJ pour 216 à 898 g de fer, Wg/W de 75 à 82 %.

Tutoriel vidéo (1 min 30, bouton « ▶ Tutoriel » ou `SimEF/plans.html?tuto`) : `tools/simef/tutoriel/plans-experiences.mp4`,
enregistré par `python3 tools/simef/record_plans.py`. Illustration « Exemple de résultats » (bas de la page,
`SimEF/illustration-optimisation-inductance.png`) : 15 calculs EF réels, scripts `tools/simef/illustration_donnees.js`
et `tools/simef/illustration_figure.py`.

Dossier généré : modifier `magnetique.html`, `fem-axi.js`, `mec-axi.js` ou `tools/simef/` puis
`python3 tools/build_simef.py`.

## Tutoriel vidéo

Le bouton **▶ Tutoriel** de l’en-tête ouvre trois courtes vidéos (fichiers dans `tutoriel/`) :

| Vidéo | Lien direct |
|---|---|
| 1 · Construire un schéma | `https://michelhecquetig2i.github.io/commutation/?tuto=1` |
| 2 · Visualiser les courbes | `https://michelhecquetig2i.github.io/commutation/?tuto=2` |
| 3 · Mesures et calculs | `https://michelhecquetig2i.github.io/commutation/?tuto=3` |

Les vidéos sont enregistrées automatiquement en pilotant l’application : après une modification de l’interface,
lancer un serveur local (`python3 -m http.server 8765`) puis `python3 tools/tuto/record.py` (Playwright + ffmpeg).

## SimCircuit

`SimCircuit/` est une version allégée. Un sélecteur **SimCir / SimEF / SimMEC** en haut à gauche donne accès soit aux circuits
de base (RL, RC, R-L-E, démarrage d’un robot, machine à courant continu), soit au calcul par éléments finis
(`SimCircuit/magnetique.html`, mêmes exemples air / noyau / pot et vue 3D) :
`https://michelhecquetig2i.github.io/commutation/SimCircuit/` (mêmes liens `?ex=rl`, `?ex=rc`, `?ex=rle`, `?ex=mcc` et `?tuto=1…3`).
Ce dossier est généré : modifier `index.html` à la racine puis lancer `python3 tools/build_simcircuit.py`.

Les exemples d’électronique de puissance sont aussi accessibles : `buck`, `boost`, `buckpi`, `flyback`, `hbridge`, `spwmblk`, `inv3`, `rect3`, `scr1`, `scr3`.

Les mêmes circuits sont fournis en fichiers dans `exemples/` (à ouvrir avec le bouton **Ouvrir…**).

### Modèle de la machine à courant continu

U = Ra·i + La·di/dt + E, E = K·Ω et J·dΩ/dt = K·i − f·Ω − Cr. La partie mécanique est représentée par des composants électriques équivalents, la tension E = K·Ω jouant le rôle de la vitesse :

- inertie J → condensateur J/K² ;
- frottement visqueux f → résistance K²/f ;
- couple résistant Cr → source de courant Cr/K.

Valeurs typiques retenues (24 V, ~100 W) : Ra = 0,5 Ω, La = 1 mH, K = 0,06 N·m/A, J = 10⁻⁴ kg·m², f = 10⁻⁵ N·m·s/rad, Cr = 0,2 N·m. En régime établi : I ≈ 3,4 A, E ≈ 22,3 V, soit Ω ≈ 372 rad/s (≈ 3 550 tr/min).
