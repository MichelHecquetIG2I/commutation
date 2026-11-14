#!/usr/bin/env python3
"""Génère le dossier SimCircuit/ à partir de l'application Commutation (racine du dépôt).

SimCircuit est une version allégée qui ne propose que les circuits de base :
RL, RC, R-L-E et machine à courant continu.

Usage (depuis la racine du dépôt) :
    python3 tools/build_simcircuit.py

À relancer après chaque modification de index.html pour reporter les
améliorations dans SimCircuit.
"""
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
DST = ROOT / "SimCircuit"
EXEMPLES = ["rl", "rc", "rle", "robot", "mcc"]
FICHIERS_EXEMPLES = ["circuit-RL.json", "circuit-RC.json", "circuit-RLE.json", "robot-demarrage.json", "machine-courant-continu.json"]
NAV_CIR = ('<nav class="apptabs radio" aria-label="Mode"><a class="on" href="index.html" aria-current="page" title="Simulation de circuits">SimCir</a>'
           '<a href="magnetique.html" title="Calcul par éléments finis (inductances)">SimEF</a></nav>')
NAV_EF = ('<nav class="apptabs radio" aria-label="Mode"><a href="index.html" title="Simulation de circuits">SimCir</a>'
          '<a class="on" href="magnetique.html" aria-current="page" title="Calcul par éléments finis (inductances)">SimEF</a></nav>')
ICONES = ["apple-touch-icon.png", "favicon-32.png", "favicon.ico", "icon-192.png", "icon-512.png"]


def remplace(texte, ancien, nouveau, nb=None):
    n = texte.count(ancien)
    if n == 0 or (nb is not None and n != nb):
        raise SystemExit(f"Motif introuvable ou inattendu ({n} occurrence(s)) : {ancien[:70]!r}")
    return texte.replace(ancien, nouveau)


def construit_index():
    s = (ROOT / "index.html").read_text(encoding="utf-8")
    # Nom de l'application
    s = remplace(s, "<title>Commutation</title>", "<title>SimCircuit</title>", 1)
    s = remplace(s, '<div class="brand"><i></i>Commutation</div>', '<div class="brand"><i></i>SimCircuit</div>', 1)
    # Sélecteur SimCir / SimEF en haut à gauche (à la place des onglets Circuits / Magnétique)
    s, n = re.subn(r'<nav class="apptabs".*?</nav>', NAV_CIR, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Onglets d’application introuvables dans l’en-tête.")
    # Liste des exemples : uniquement les circuits de base
    s, n = re.subn(r'</optgroup><optgroup label="Électronique de puissance">.*?</optgroup>', "</optgroup>", s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Groupe « Électronique de puissance » introuvable dans la liste des exemples.")
    s, n = re.subn(r'<optgroup label="Amplificateurs opérationnels">.*?</optgroup>', "", s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Groupe « Amplificateurs opérationnels » introuvable dans la liste des exemples.")
    # Composant AOP réservé à Commutation : retiré de la palette
    s = remplace(s, "['AOP','AOP'],", "", 1)
    # Lien ?ex= : refuser les exemples absents de SimCircuit
    s = remplace(s, "return Object.prototype.hasOwnProperty.call(PRESETS,ex)?ex:null",
                 "return " + json.dumps(EXEMPLES) + ".includes(ex)?ex:null", 1)
    # Exemple chargé au premier lancement
    s = remplace(s, "else loadPreset('buck');", "else loadPreset('rl');", 1)
    # Stockage local et nom de fichier propres à SimCircuit (même domaine que Commutation)
    for cle in ("commutation-v1", "commutation-ui", "commutation-showvals"):
        s = remplace(s, f"'{cle}'", "'" + cle.replace("commutation-", "simcircuit-") + "'")
    s = s.replace("circuit-commutation.json", "circuit-simcircuit.json")
    # Tutoriel vidéo : les vidéos sont partagées avec Commutation
    s = s.replace('data-tuto-base="tutoriel/"', 'data-tuto-base="../tutoriel/"')
    return s


def construit_magnetique():
    s = (ROOT / "magnetique.html").read_text(encoding="utf-8")
    s = remplace(s, "<title>Commutation — Magnétique (éléments finis)</title>", "<title>SimCircuit — SimEF (éléments finis)</title>", 1)
    s = remplace(s, '<div class="brand"><i></i>Commutation</div>', '<div class="brand"><i></i>SimCircuit</div>', 1)
    s, n = re.subn(r'<nav class="apptabs".*?</nav>', NAV_EF, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit("Onglets introuvables dans magnetique.html.")
    return s


def main():
    if DST.exists():
        shutil.rmtree(DST)
    (DST / "exemples").mkdir(parents=True)
    (DST / "index.html").write_text(construit_index(), encoding="utf-8")
    (DST / "magnetique.html").write_text(construit_magnetique(), encoding="utf-8")
    shutil.copy2(ROOT / "fem-axi.js", DST / "fem-axi.js")

    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    sw = sw.replace("commutation-shell-", "simcircuit-shell-")
    (DST / "service-worker.js").write_text(sw, encoding="utf-8")

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    manifest.update(name="SimCircuit", short_name="SimCircuit", id="/commutation/SimCircuit/")
    (DST / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for f in ICONES:
        shutil.copy2(ROOT / f, DST / f)
    for f in FICHIERS_EXEMPLES:
        shutil.copy2(ROOT / "exemples" / f, DST / "exemples" / f)

    base = "https://michelhecquetig2i.github.io/commutation/SimCircuit/"
    lignes = [
        "# SimCircuit",
        "",
        "Version allégée de Commutation, limitée aux circuits de base.",
        "Ce dossier est **généré** : ne pas le modifier à la main, mais modifier `index.html` à la racine",
        "puis lancer `python3 tools/build_simcircuit.py`.",
        "",
        "| Exemple | Lien |",
        "|---|---|",
        f"| Circuit RL | {base}?ex=rl |",
        f"| Circuit RC | {base}?ex=rc |",
        f"| Circuit R-L-E (fcém) | {base}?ex=rle |",
        f"| Démarrage d’un robot (analogie RL) | {base}?ex=robot |",
        f"| Machine à courant continu | {base}?ex=mcc |",
        "",
        "Mode **SimEF** (sélecteur en haut à gauche) : calcul d’inductance par éléments finis, avec vue 3D.",
        "",
        "| Exemple SimEF | Lien |",
        "|---|---|",
        f"| Bobine dans l’air | {base}magnetique.html?ex=air |",
        f"| Bobine avec noyau plongeur en fer | {base}magnetique.html?ex=noyau |",
        f"| Bobine dans un pot en fer avec entrefer | {base}magnetique.html?ex=pot |",
        "",
    ]
    (DST / "README.md").write_text("\n".join(lignes), encoding="utf-8")
    print("SimCircuit généré dans", DST)


if __name__ == "__main__":
    main()
