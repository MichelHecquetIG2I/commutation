# SimEF

Calcul d’inductance (bobine axisymétrique) et optimisation paramétrique. Sélecteur en haut à gauche :

- **EF** : éléments finis, coupe et vue 3D — https://michelhecquetig2i.github.io/commutation/SimEF/?ex=pot
- **MEC** : réseau de réluctances maillé (Magnetic Equivalent Circuit) — https://michelhecquetig2i.github.io/commutation/SimEF/?mode=mec&ex=pot
- **Plans d’expériences** : plans factoriels, fractionnaires, Plackett-Burman, composites centrés, Box-Behnken,
  hypercube latin, D-optimal, I-optimal ; modèles de surface de réponse ; optimisation — https://michelhecquetig2i.github.io/commutation/SimEF/plans.html

Tutoriel vidéo : https://michelhecquetig2i.github.io/commutation/SimEF/plans.html?tuto (fichier `tutoriel/plans-experiences.mp4`) ; exemple de résultats :
https://michelhecquetig2i.github.io/commutation/SimEF/illustration-optimisation-inductance.png

Dossier **généré** : modifier `magnetique.html`, `fem-axi.js`, `mec-axi.js` (racine) ou `tools/simef/`,
puis lancer `python3 tools/build_simef.py`.
