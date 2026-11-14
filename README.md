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
par Newton-Raphson. Le bouton « Courbe L(I) » trace l’inductance sécante jusqu’à la saturation. Solveur : `fem-axi.js`
(utilisable aussi sous Node : `require('./fem-axi.js').solve({...})`).

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

`SimCircuit/` est une version allégée limitée aux circuits RL, RC, R-L-E et machine à courant continu :
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
