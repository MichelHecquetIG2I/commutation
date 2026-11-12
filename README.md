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
| Machine à courant continu (modèle équivalent) | `https://michelhecquetig2i.github.io/commutation/?ex=mcc` |

Sur le schéma, les repères **a** et **b** indiquent les bornes de chaque sonde de tension (u = Va − Vb), dans la couleur de la courbe correspondante.

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
