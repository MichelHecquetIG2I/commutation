#!/usr/bin/env python3
"""Génère le dossier SimEF/ : calcul d'inductance par éléments finis (EF), réseau de réluctances (MEC)
et optimisation paramétrique par plans d'expériences.

Sources : magnetique.html, fem-axi.js, mec-axi.js (racine) ; tools/simef/plans.html et tools/simef/doe.js.
Usage (depuis la racine du dépôt) :  python3 tools/build_simef.py
"""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "simef"
DST = ROOT / "SimEF"
ICONES = ["apple-touch-icon.png", "favicon-32.png", "favicon.ico", "icon-192.png", "icon-512.png"]
NAV = ('<nav class="apptabs radio" aria-label="Mode">'
       '<a class="on" href="index.html" data-mode="ef" title="Calcul d’inductance par éléments finis">EF</a>'
       '<a href="index.html?mode=mec" data-mode="mec" title="Réseau de réluctances (Magnetic Equivalent Circuit)">MEC</a>'
       '<a href="plans.html" title="Optimisation paramétrique par plans d’expériences">Plans d’expériences</a></nav>')


def remplace(texte, ancien, nouveau, nb=1):
    if texte.count(ancien) != nb:
        raise SystemExit(f"Motif introuvable ou inattendu : {ancien[:70]!r}")
    return texte.replace(ancien, nouveau)


def main():
    if DST.exists():
        shutil.rmtree(DST)
    DST.mkdir()
    s = (ROOT / "magnetique.html").read_text(encoding="utf-8")
    s = remplace(s, "<title>Commutation — Magnétique (éléments finis)</title>", "<title>SimEF — Éléments finis</title>")
    s = remplace(s, '<div class="brand"><i></i>Commutation</div>', '<div class="brand"><i></i>SimEF</div>')
    s, n = re.subn(r'<nav class="apptabs".*?</nav>', NAV, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Onglets introuvables dans magnetique.html.")
    (DST / "index.html").write_text(s, encoding="utf-8")
    for f in ["fem-axi.js", "mec-axi.js"] + ICONES:
        shutil.copy2(ROOT / f, DST / f)
    for f in ["plans.html", "doe.js", "illustration-optimisation-inductance.png"]:
        shutil.copy2(SRC / f, DST / f)
    shutil.copytree(SRC / "tutoriel", DST / "tutoriel")
    base = "https://michelhecquetig2i.github.io/commutation/SimEF/"
    (DST / "README.md").write_text("\n".join([
        "# SimEF",
        "",
        "Calcul d’inductance (bobine axisymétrique) et optimisation paramétrique. Sélecteur en haut à gauche :",
        "",
        f"- **EF** : éléments finis, coupe et vue 3D — {base}?ex=pot",
        f"- **MEC** : réseau de réluctances maillé (Magnetic Equivalent Circuit) — {base}?mode=mec&ex=pot",
        f"- **Plans d’expériences** : plans factoriels, fractionnaires, Plackett-Burman, composites centrés, Box-Behnken,",
        f"  hypercube latin, D-optimal, I-optimal ; modèles de surface de réponse ; optimisation — {base}plans.html",
        "",
        f"Tutoriel vidéo : {base}plans.html?tuto (fichier `tutoriel/plans-experiences.mp4`) ; exemple de résultats :",
        f"{base}illustration-optimisation-inductance.png",
        "",
        "Dossier **généré** : modifier `magnetique.html`, `fem-axi.js`, `mec-axi.js` (racine) ou `tools/simef/`,",
        "puis lancer `python3 tools/build_simef.py`.",
        "",
    ]), encoding="utf-8")
    print("SimEF généré dans", DST)


if __name__ == "__main__":
    main()
